# backend/api/views.py
from rest_framework import viewsets, permissions, generics, status # Ensure status is imported
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from .models import ( # Ensure all models are imported
    User, Profile, Skill, Project, Proposal, Contract, Message, Review,
    PortfolioItem, Notification
)
from .serializers import ( # Ensure all serializers are imported
    RegisterSerializer, UserSerializer, ProfileSerializer, SkillSerializer,
    ProjectSerializer, ProposalSerializer, ContractSerializer, MessageSerializer,
    ReviewSerializer, PortfolioItemSerializer, NotificationSerializer
)
from rest_framework.decorators import action
from rest_framework.response import Response # Ensure Response is imported
import datetime
# Corrected import for transaction
from django.db.models import Q
from django.db import transaction # Corrected import
from rest_framework.exceptions import PermissionDenied, ValidationError, NotFound
from django.contrib.auth import get_user_model # Import User model getter
from django.shortcuts import get_object_or_404 # Useful for getting objects or 404
import logging # Import logging

# Get an instance of a logger
logger = logging.getLogger(__name__)


# Get the User model
User = get_user_model()


# --- Permission Classes ---
# ... (IsOwnerOrReadOnly, IsClient, IsFreelancer remain the same) ...
class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object to edit it.
    Assumes the model instance has an 'user', 'profile.user', 'client',
    'freelancer', 'reviewer', or 'recipient' attribute.
    Handles Proposal specific logic (only editable if pending).
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True

        owner = None
        if hasattr(obj, 'user'): # e.g., Profile.user (if obj is Profile)
            owner = obj.user
        elif hasattr(obj, 'profile') and hasattr(obj.profile, 'user'): # e.g., PortfolioItem.profile.user
            owner = obj.profile.user
        elif hasattr(obj, 'client'): # e.g., Project.client
            owner = obj.client
        elif hasattr(obj, 'freelancer'): # e.g., Proposal.freelancer, Contract.freelancer
            owner = obj.freelancer
            # Freelancer can only edit/delete PENDING proposals (status check moved here for clarity)
            if isinstance(obj, Proposal) and obj.status != 'pending':
                return False
        elif hasattr(obj, 'reviewer'): # e.g., Review.reviewer
            owner = obj.reviewer
        elif hasattr(obj, 'recipient'): # e.g., Notification.recipient
            owner = obj.recipient
        elif hasattr(obj, 'sender') and isinstance(obj, Message): # For Messages, allow sender to delete? (Adjust logic if needed)
             # Example: allow sender to modify/delete their own messages.
             # Be careful with PUT/PATCH allowing sender change. Typically only DELETE makes sense.
             owner = obj.sender
        # Add other ownership checks if needed

        # Ensure owner was found and matches the request user
        return owner is not None and owner == request.user

class IsClient(permissions.BasePermission):
    """ Allows access only to authenticated clients with profiles. """
    def has_permission(self, request, view):
        # Check if user is authenticated, has a profile, and type is 'client'
        # Use getattr for safer access to profile
        profile = getattr(request.user, 'profile', None)
        return (request.user and
                request.user.is_authenticated and
                profile is not None and
                profile.user_type == 'client')

class IsFreelancer(permissions.BasePermission):
    """ Allows access only to authenticated freelancers with profiles. """
    def has_permission(self, request, view):
        # Check if user is authenticated, has a profile, and type is 'freelancer'
        profile = getattr(request.user, 'profile', None)
        return (request.user and
                request.user.is_authenticated and
                profile is not None and
                profile.user_type == 'freelancer')


# --- ViewSets ---

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny] # Anyone can register
    serializer_class = RegisterSerializer


class ProfileViewSet(viewsets.ModelViewSet):
    """ ViewSet for viewing and editing user profiles. """
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly] # Must be logged in, can only edit own profile

    def get_queryset(self):
        """ Admins see all, users see their own profile. """
        user = self.request.user
        if user.is_authenticated:
            if user.is_staff: # Admins can list/view all profiles
                return Profile.objects.select_related('user').prefetch_related('skills', 'portfolio_items').all()
            # Regular authenticated users can only access their own profile
            # Added prefetch_related for portfolio items here as well
            return Profile.objects.select_related('user').prefetch_related('skills', 'portfolio_items').filter(user=user)
        return Profile.objects.none() # Anonymous users see nothing

    def perform_update(self, serializer):
        # IsOwnerOrReadOnly permission already ensures user is updating their own profile
        instance = serializer.save() # Saves validated data from serializer (excluding skill_names, profile_picture)

        # Handle profile picture upload if present in the request
        if 'profile_picture' in self.request.FILES:
            instance.profile_picture = self.request.FILES['profile_picture']
            instance.save(update_fields=['profile_picture']) # Save only the picture field

        # After saving, return the instance so DRF can serialize the response
        return instance


class PortfolioItemViewSet(viewsets.ModelViewSet):
    """ ViewSet for managing freelancer portfolio items. """
    serializer_class = PortfolioItemSerializer
    # Must be authenticated, IsOwnerOrReadOnly checks profile.user
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]

    def get_queryset(self):
        """ Freelancers see their own portfolio items. """
        user = self.request.user
        # Check if the user has a profile before filtering
        profile = getattr(user, 'profile', None)
        if profile and profile.user_type == 'freelancer':
            return PortfolioItem.objects.filter(profile=profile).order_by('-created_at')
        return PortfolioItem.objects.none()

    def perform_create(self, serializer):
        """ Associate the new portfolio item with the freelancer's profile. """
        profile = getattr(self.request.user, 'profile', None)
        # Ensure user has a profile and is a freelancer
        if not profile:
             raise PermissionDenied("User profile required to add portfolio items.")
        if profile.user_type != 'freelancer':
             raise PermissionDenied("Only freelancers can add portfolio items.")
        # Save the item, linking it to the user's profile
        serializer.save(profile=profile)


class SkillViewSet(viewsets.ReadOnlyModelViewSet):
    """ Read-only ViewSet for listing skills. """
    queryset = Skill.objects.all().order_by('name') # Order alphabetically
    serializer_class = SkillSerializer
    permission_classes = [permissions.AllowAny] # Anyone can view the list of available skills


class ProjectViewSet(viewsets.ModelViewSet):
    """ ViewSet for creating, viewing, updating, and deleting projects. """
    # Optimized queryset
    queryset = Project.objects.all().select_related('client__profile').prefetch_related('skills_required').order_by('-created_at') # Added client__profile
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated] # Base permission, refined in get_permissions
    # Filtering, Searching, Ordering configuration
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'skills_required', 'client__username'] # Fields for exact filtering
    search_fields = ['title', 'description', 'skills_required__name'] # Fields for text search
    ordering_fields = ['budget', 'created_at', 'duration'] # Fields allowed for ordering

    def get_permissions(self):
        """ Set permissions based on the action being performed. """
        if self.action == 'create':
            # Only authenticated clients can create projects
            self.permission_classes = [permissions.IsAuthenticated, IsClient]
        elif self.action in ['update', 'partial_update', 'destroy']:
            # Only the client owner of the project can modify/delete it
            self.permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly] # Checks obj.client
        elif self.action in ['list', 'retrieve']:
             # Any authenticated user can view lists/details (visibility controlled by get_queryset)
             self.permission_classes = [permissions.IsAuthenticated]
        else:
             # Restrict other non-standard actions to admins
             self.permission_classes = [permissions.IsAdminUser]
        return super().get_permissions()

    def perform_create(self, serializer):
        """ Automatically set the project client to the logged-in user. """
        # Permission check ensures user is a client
        serializer.save(client=self.request.user)

    def get_queryset(self):
        """ Filter projects based on user role and authentication status. """
        user = self.request.user
        # Start with the base optimized queryset
        queryset = super().get_queryset()

        if not user.is_authenticated:
            return Project.objects.none() # No projects for anonymous users

        profile = getattr(user, 'profile', None)
        if profile:
            if profile.user_type == 'client':
                # Clients see only their projects
                return queryset.filter(client=user)
            elif profile.user_type == 'freelancer':
                # Freelancers see 'open' projects + projects they proposed on + projects they have contracts for
                # Optimize by fetching related project IDs once
                proposed_project_ids = Proposal.objects.filter(freelancer=user).values_list('project_id', flat=True)
                contracted_project_ids = Contract.objects.filter(freelancer=user).values_list('project_id', flat=True)

                # Combine filters using Q objects
                return queryset.filter(
                    Q(status='open') | Q(id__in=proposed_project_ids) | Q(id__in=contracted_project_ids)
                ).distinct() # Use distinct to avoid duplicates if proposed and contracted
        # Admins see all projects
        elif user.is_staff:
            return queryset

        # Fallback for authenticated users without a profile (should be rare) - show only open projects
        return queryset.filter(status='open')


class ProposalViewSet(viewsets.ModelViewSet):
    """ ViewSet for managing project proposals. """
    # Optimized queryset
    queryset = Proposal.objects.all().select_related('project__client', 'freelancer__profile').order_by('-submitted_at') # Added profile relations
    serializer_class = ProposalSerializer
    permission_classes = [permissions.IsAuthenticated] # Base permission

    def get_permissions(self):
        """ Set permissions based on the action. """
        if self.action == 'create':
            # Only freelancers can create proposals
            self.permission_classes = [permissions.IsAuthenticated, IsFreelancer]
        elif self.action == 'update_status': # Custom action for client acceptance/rejection
            # Permission check is inside the action itself (must be project client)
            self.permission_classes = [permissions.IsAuthenticated]
        elif self.action in ['update', 'partial_update', 'destroy']:
            # Freelancer can only modify/delete their *pending* proposals
            # IsOwnerOrReadOnly checks freelancer owner AND proposal status='pending'
            self.permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]
        elif self.action in ['list', 'retrieve']:
            # Visibility controlled by get_queryset
            self.permission_classes = [permissions.IsAuthenticated]
        else:
             # Restrict other actions to admins
             self.permission_classes = [permissions.IsAdminUser]
        return super().get_permissions()

    def perform_create(self, serializer):
        """ Validate project status and uniqueness before saving. """
        project = serializer.validated_data.get('project')
        user = self.request.user

        # Ensure project exists and is open (serializer queryset also helps)
        if not project or project.status != 'open':
             raise ValidationError("Project not found or is not open for proposals.")

        # Ensure client cannot propose on their own project (although IsFreelancer perm should prevent this)
        if project.client == user:
             raise PermissionDenied("Clients cannot submit proposals for their own projects.")

        # Prevent duplicate proposals from the same freelancer for the same project
        if Proposal.objects.filter(project=project, freelancer=user).exists():
             raise ValidationError("You have already submitted a proposal for this project.")

        # Set freelancer automatically and save
        serializer.save(freelancer=user)

    # perform_update and perform_destroy rely on IsOwnerOrReadOnly permission check

    def get_queryset(self):
        """ Filter proposals based on user role. """
        user = self.request.user
        queryset = super().get_queryset() # Use the optimized queryset from class definition

        if not user.is_authenticated:
            return Proposal.objects.none()

        profile = getattr(user, 'profile', None)
        if profile:
            if profile.user_type == 'freelancer':
                # Freelancer sees their proposals
                return queryset.filter(freelancer=user)
            elif profile.user_type == 'client':
                # Client sees proposals for their projects
                return queryset.filter(project__client=user)
        elif user.is_staff: # Admin sees all
             return queryset

        # Users without profiles (or other roles) see none
        return Proposal.objects.none()

    @action(detail=True, methods=['patch'], url_path='update-status', permission_classes=[permissions.IsAuthenticated])
    def update_status(self, request, pk=None):
        """ Custom action for clients to accept or reject proposals. """
        proposal = get_object_or_404(Proposal.objects.select_related('project', 'freelancer'), pk=pk) # Optimize lookup

        # Ensure the request user is the client for this project
        if proposal.project.client != request.user:
             raise PermissionDenied("You do not have permission to modify this proposal's status.")

        new_status = request.data.get('status')
        if new_status not in ['accepted', 'rejected']:
            return Response({'detail': 'Invalid status. Must be "accepted" or "rejected".'}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure proposal is pending before changing status
        if proposal.status != 'pending':
             return Response({'detail': f'Proposal status is already "{proposal.status}".'}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure project hasn't already been assigned (edge case)
        if new_status == 'accepted' and proposal.project.status != 'open':
            return Response({'detail': f'Project status is already "{proposal.project.status}". Cannot accept proposal.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic(): # Ensure atomicity for related updates
                # Update the proposal status (this triggers the post_save signal *after* transaction commit)
                proposal.status = new_status
                proposal.save(update_fields=['status']) # Save proposal status change

                # If accepted, create contract, update project, reject others
                if new_status == 'accepted':
                    # Create contract (get_or_create handles potential race conditions)
                    contract, created = Contract.objects.get_or_create(
                        project=proposal.project,
                        defaults={
                            'freelancer': proposal.freelancer,
                            'agreed_rate': proposal.proposed_rate,
                            'start_date': datetime.date.today() # Or get from proposal/request if needed
                        }
                    )
                    # Only proceed if the contract was newly created by this acceptance
                    if created:
                        # Update project status
                        proposal.project.status = 'in_progress'
                        proposal.project.save(update_fields=['status'])

                        # Reject other *pending* proposals for this project
                        Proposal.objects.filter(
                            project=proposal.project, status='pending'
                        ).exclude(pk=proposal.pk).update(status='rejected')
                    else:
                        # If contract already existed (shouldn't happen with project status check), raise error
                         raise ValidationError("Contract for this project already exists.")


        except Exception as e:
             # Log the detailed error
             logger.error(f"Error during proposal status update (ID: {proposal.pk}) to '{new_status}': {e}", exc_info=True)
             # Inform user of failure
             return Response({
                 'detail': f'Failed to update proposal status or related objects: {e}'
             }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Return the updated proposal
        serializer = self.get_serializer(proposal)
        return Response(serializer.data)


class ContractViewSet(viewsets.ReadOnlyModelViewSet):
    """ Read-only ViewSet for viewing contracts. """
    # Optimized queryset
    queryset = Contract.objects.all().select_related('project__client__profile', 'freelancer__profile').order_by('-start_date') # Added profile relations
    serializer_class = ContractSerializer
    permission_classes = [permissions.IsAuthenticated] # Must be logged in

    def get_queryset(self):
        """ Filter contracts based on user role. """
        user = self.request.user
        queryset = super().get_queryset() # Use optimized queryset from class

        if not user.is_authenticated:
            return Contract.objects.none()

        profile = getattr(user, 'profile', None)
        if profile:
             if profile.user_type == 'freelancer':
                 # Freelancer sees contracts where they are the freelancer
                 return queryset.filter(freelancer=user)
             elif profile.user_type == 'client':
                 # Client sees contracts for their projects
                 return queryset.filter(project__client=user)
        elif user.is_staff: # Admin sees all
            return queryset

        return Contract.objects.none()


class MessageViewSet(viewsets.ModelViewSet):
    """ ViewSet for sending and viewing messages. """
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated] # Must be logged in
    # Prevent PUT requests (force update of all fields), allow PATCH if needed later
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        """ Filter messages involving the current user, ordered chronologically. """
        user = self.request.user
        if not user.is_authenticated:
            return Message.objects.none()
        # Optimize query by selecting related sender and receiver profiles if needed elsewhere,
        # but for basic display, just sender/receiver is fine.
        return Message.objects.select_related('sender', 'receiver').filter(
            Q(sender=user) | Q(receiver=user)
        ).order_by('timestamp') # Ascending order for chat history

    # --- SIMPLIFIED perform_create ---
    def perform_create(self, serializer):
        """ Set sender, find receiver by username, and save. """
        receiver_username = serializer.validated_data.get('receiver_username')
        sender = self.request.user

        # Validation (most should be handled by serializer)
        if not receiver_username:
             raise ValidationError({"receiver_username": "This field is required."})

        try:
            receiver = User.objects.get(username=receiver_username)
        except User.DoesNotExist:
             raise ValidationError({"receiver_username": f"User '{receiver_username}' not found."})

        if receiver == sender:
             raise ValidationError({"receiver_username": "You cannot send messages to yourself."})

        # Save the message instance - the serializer's overridden create method
        # will handle removing 'receiver_username' before model creation.
        # DRF automatically passes sender and receiver to the serializer's create method.
        serializer.save(sender=sender, receiver=receiver)
        logger.info(f"Message sent from {sender.username} to {receiver.username}")
        # No need for explicit try/except here for the TypeError anymore
        # Let DRF's default exception handling manage other potential errors (like DB errors)
        # It will typically return appropriate 400 or 500 JSON responses.

    # If you need specific permissions for deleting/updating messages (e.g., only sender can delete):
    # Add IsOwnerOrReadOnly to permission_classes and ensure it checks obj.sender for Message instances.


class ReviewViewSet(viewsets.ModelViewSet):
    """ ViewSet for creating and viewing reviews. """
    # Optimized queryset
    queryset = Review.objects.all().select_related('project', 'reviewer__profile', 'reviewee__profile').order_by('-created_at') # Added profile relations
    serializer_class = ReviewSerializer
    # Base permissions: Must be logged in. Owner check for modification.
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly] # Checks reviewer for edit/delete
    # Allow GET, POST, PATCH, DELETE. PUT is usually unnecessary.
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        """ Filter reviews by project or user involvement. """
        user = self.request.user
        queryset = super().get_queryset() # Use optimized queryset
        project_id = self.request.query_params.get('project')

        if project_id:
            # If filtering by project, ensure the project exists first
            project = get_object_or_404(Project, pk=project_id)

            # Check if user is the client or the accepted freelancer for this project
            is_client = project.client == user
            is_accepted_freelancer = Contract.objects.filter(project=project, freelancer=user).exists()
            # Alternative check using proposal status (less direct if contract exists):
            # is_accepted_freelancer = project.proposals.filter(freelancer=user, status='accepted').exists()

            # Allow view if user is staff, client, or the accepted freelancer
            if user.is_staff or is_client or is_accepted_freelancer:
                return queryset.filter(project=project)
            else:
                 # Raise 403 Forbidden if user is not allowed to see reviews for this specific project
                raise PermissionDenied("You do not have permission to view reviews for this project.")

        elif user.is_authenticated:
            # If not filtering by project, show reviews where user is reviewer or reviewee
            return queryset.filter(Q(reviewer=user) | Q(reviewee=user))
        else:
            # Anonymous users see nothing without a project filter (which would fail anyway)
            return Review.objects.none()

    def perform_create(self, serializer):
        """ Validate who can review whom for a specific project and save. """
        project = serializer.validated_data.get('project')
        user = self.request.user
        profile = getattr(user, 'profile', None)

        if not profile:
             raise PermissionDenied("User profile is required to submit reviews.")

        # Ensure the project is completed or at least in progress? (Optional check)
        # if project.status not in ['completed', 'in_progress']:
        #      raise ValidationError("Reviews can only be submitted for in-progress or completed projects.")

        reviewee = None
        is_client_reviewing = False
        is_freelancer_reviewing = False

        # Determine reviewer's role in the project
        if profile.user_type == 'client' and project.client == user:
            is_client_reviewing = True
        elif profile.user_type == 'freelancer':
            # Check if this freelancer has a contract for this project
            try:
                contract = Contract.objects.get(project=project, freelancer=user)
                is_freelancer_reviewing = True
            except Contract.DoesNotExist:
                 # If no contract, check if they had an accepted proposal (fallback, less reliable)
                 # if project.proposals.filter(freelancer=user, status='accepted').exists():
                 #      is_freelancer_reviewing = True
                 # else:
                 raise PermissionDenied("You are not the accepted freelancer for this project.")

        # Determine the reviewee based on the reviewer's role
        if is_client_reviewing:
            try:
                # Client reviews the freelancer associated with the contract
                contract = Contract.objects.get(project=project) # Assuming one contract per project
                reviewee = contract.freelancer
            except Contract.DoesNotExist:
                 raise ValidationError("Cannot create review: No contract found for this project.")
        elif is_freelancer_reviewing:
             # Freelancer reviews the client who posted the project
             reviewee = project.client
        else:
             # Should be caught earlier, but safety check
             raise PermissionDenied("You are neither the client nor the contracted freelancer for this project.")

        if not reviewee: # Should be caught above, but safety check
            raise ValidationError("Could not determine who to review.")

        # Prevent duplicate reviews (reviewer -> reviewee for this project)
        if Review.objects.filter(project=project, reviewer=user, reviewee=reviewee).exists():
             raise ValidationError("You have already reviewed this user for this project.")

        # Save the review with reviewer and reviewee set
        serializer.save(reviewer=user, reviewee=reviewee)


class NotificationViewSet(viewsets.ModelViewSet):
    """ ViewSet for user notifications with mark read/unread actions. """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly] # Checks recipient
    # Limit allowed methods: GET (list/detail), PATCH (actions), POST (mark all read), DELETE (optional)
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        """ Return notifications only for the authenticated user. """
        user = self.request.user
        if not user.is_authenticated:
            return Notification.objects.none()
        # Order by most recent first
        # Optimize by selecting related objects if needed by serializer (PKRelatedField is efficient)
        return Notification.objects.filter(recipient=user).select_related(
            'project', 'proposal', 'related_message' # Select related if using deeper serializers
        ).order_by('-timestamp')

    # Allow PATCH on detail view for individual read/unread
    @action(detail=True, methods=['patch'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        """ Mark a specific notification as read. """
        notification = self.get_object() # Permission check included (IsOwnerOrReadOnly)
        if not notification.read:
            notification.read = True
            notification.save(update_fields=['read'])
        serializer = self.get_serializer(notification)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'], url_path='mark-unread')
    def mark_unread(self, request, pk=None):
        """ Mark a specific notification as unread. """
        notification = self.get_object() # Permission check included
        if notification.read:
            notification.read = False
            notification.save(update_fields=['read'])
        serializer = self.get_serializer(notification)
        return Response(serializer.data)

    # Allow POST on list view for bulk action
    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        """ Mark all unread notifications for the user as read. """
        user = request.user
        updated_count = Notification.objects.filter(recipient=user, read=False).update(read=True)
        return Response({'status': f'{updated_count} notifications marked as read.'}, status=status.HTTP_200_OK)

    # By default, ModelViewSet provides destroy. Permission restricts deletion to recipient.
    # No custom perform_destroy needed unless extra logic is required.