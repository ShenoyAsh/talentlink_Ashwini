# backend/api/views.py
from rest_framework import viewsets, permissions, generics, status # Ensure status is imported
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from .models import ( # Ensure all models are imported
    User, Profile, Skill, Project, Proposal, Contract, Message, Review,
    PortfolioItem, Notification, SavedProject, ActivityLog, ProjectAnalytics,
    AchievementBadge, Milestone, ProjectFile, Payment, Invoice, Wallet, Transaction
)
from .serializers import ( # Ensure all serializers are imported
    RegisterSerializer, UserSerializer, ProfileSerializer, SkillSerializer,
    ProjectSerializer, ProposalSerializer, ContractSerializer, MessageSerializer,
    ReviewSerializer, PortfolioItemSerializer, NotificationSerializer,
    SavedProjectSerializer, ActivityLogSerializer, ProjectAnalyticsSerializer,
    AchievementBadgeSerializer, MilestoneSerializer, ProjectFileSerializer,
    PaymentSerializer, InvoiceSerializer, WalletSerializer, TransactionSerializer
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
from django.utils import timezone
import io
from django.http import HttpResponse
from django.template.loader import get_template
from xhtml2pdf import pisa

# Get an instance of a logger
logger = logging.getLogger(__name__)

User = get_user_model()

class IsOwnerOrReadOnly(permissions.BasePermission):
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
        elif self.action in ['list', 'retrieve', 'update_status']:
             # Any authenticated user can view lists/details (visibility controlled by get_queryset)
             self.permission_classes = [permissions.IsAuthenticated]
        else:
             # Restrict other non-standard actions to admins
             self.permission_classes = [permissions.IsAdminUser]
        return super().get_permissions()

    def get_serializer_context(self):
        """Add request to serializer context for is_saved field."""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def perform_create(self, serializer):
        """ Automatically set the project client to the logged-in user. """
        # Permission check ensures user is a client
        project = serializer.save(client=self.request.user)
        # Create analytics record for the project
        ProjectAnalytics.objects.create(project=project)
        # Create activity log
        ActivityLog.objects.create(
            user=self.request.user,
            action='project_created',
            description=f"Created project: {project.title}",
            related_project=project
        )
        return project

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
                # Freelancers see 'active' projects + projects they proposed on + projects they have contracts for
                # Optimize by fetching related project IDs once
                proposed_project_ids = Proposal.objects.filter(freelancer=user).values_list('project_id', flat=True)
                contracted_project_ids = Contract.objects.filter(freelancer=user).values_list('project_id', flat=True)

                # Combine filters using Q objects
                return queryset.filter(
                    Q(status='active') | Q(id__in=proposed_project_ids) | Q(id__in=contracted_project_ids)
                ).distinct() # Use distinct to avoid duplicates if proposed and contracted
        # Admins see all projects
        elif user.is_staff:
            return queryset

        # Fallback for authenticated users without a profile (should be rare) - show only active projects
        return queryset.filter(status='active')

    def retrieve(self, request, *args, **kwargs):
        """Override retrieve to increment view count and update analytics."""
        instance = self.get_object()
        # Increment view count
        instance.view_count += 1
        instance.save(update_fields=['view_count'])
        
        # Update analytics
        analytics, created = ProjectAnalytics.objects.get_or_create(project=instance)
        analytics.total_views += 1
        if created or not analytics.last_viewed:
            analytics.unique_views += 1
        analytics.last_viewed = timezone.now()
        analytics.save(update_fields=['total_views', 'unique_views', 'last_viewed'])
        
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'], url_path='update-status', permission_classes=[permissions.IsAuthenticated])
    def update_status(self, request, pk=None):
        """Allow client to update project status."""
        project = self.get_object()
        
        # Only project owner (client) can update status
        if project.client != request.user:
            raise PermissionDenied("Only project owner can update status.")
        
        new_status = request.data.get('status')
        if new_status not in ['active', 'in_progress', 'completed', 'cancelled']:
            return Response({'detail': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)
        
        project.status = new_status
        project.save(update_fields=['status'])
        
        # Create activity log
        ActivityLog.objects.create(
            user=request.user,
            action='project_created',
            description=f"Updated project status to {new_status}",
            related_project=project
        )
        
        serializer = self.get_serializer(project)
        return Response(serializer.data)
    
    



class ProposalViewSet(viewsets.ModelViewSet):
    """ ViewSet for managing project proposals. """
    # Optimized queryset
    queryset = Proposal.objects.all().select_related('project__client', 'freelancer__profile').order_by('-submitted_at') # Added profile relations
    serializer_class = ProposalSerializer
    permission_classes = [permissions.IsAuthenticated] # Base permission

    @action(detail=True, methods=['patch'], url_path='rate', permission_classes=[permissions.IsAuthenticated])
    def rate(self, request, pk=None):
        """Allow the client to rate a proposal (1-5)."""
        proposal = get_object_or_404(Proposal.objects.select_related('project', 'freelancer'), pk=pk)
        # Only the client who owns the project can rate
        if proposal.project.client != request.user:
            raise PermissionDenied("Only the project owner can rate this proposal.")
        rating = request.data.get('rating')
        try:
            rating = int(rating)
        except (TypeError, ValueError):
            return Response({'detail': 'Rating must be an integer between 1 and 5.'}, status=status.HTTP_400_BAD_REQUEST)
        if rating < 1 or rating > 5:
            return Response({'detail': 'Rating must be between 1 and 5.'}, status=status.HTTP_400_BAD_REQUEST)
        proposal.rating = rating
        proposal.save(update_fields=['rating'])
        serializer = self.get_serializer(proposal)
        return Response(serializer.data)

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
        if not project or project.status != 'active':
             raise ValidationError("Project not found or is not open for proposals.")

        # Ensure client cannot propose on their own project (although IsFreelancer perm should prevent this)
        if project.client == user:
             raise PermissionDenied("Clients cannot submit proposals for their own projects.")

        # Prevent duplicate proposals from the same freelancer for the same project
        if Proposal.objects.filter(project=project, freelancer=user).exists():
             raise ValidationError("You have already submitted a proposal for this project.")

        # Set freelancer automatically and save
        proposal = serializer.save(freelancer=user)
        # Create activity log
        ActivityLog.objects.create(
            user=user,
            action='proposal_submitted',
            description=f"Submitted proposal for project: {project.title}",
            related_project=project
        )
        # Update project analytics
        analytics, created = ProjectAnalytics.objects.get_or_create(project=project)
        analytics.proposals_count += 1
        analytics.save(update_fields=['proposals_count'])
        return proposal

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
        if new_status == 'accepted' and proposal.project.status != 'active':
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
                        
                        # Update contract status
                        contract.status = 'in_progress'
                        contract.save(update_fields=['status'])

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


class ContractViewSet(viewsets.ModelViewSet):
    """ ViewSet for viewing and updating contracts. """
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

    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['update', 'partial_update']:
            # Both client and freelancer can update contract status
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()

    @action(detail=True, methods=['patch'], url_path='update-status', permission_classes=[permissions.IsAuthenticated])
    def update_status(self, request, pk=None):
        """Allow client or freelancer to update contract status."""
        contract = self.get_object()
        
        # Check if user is client or freelancer for this contract
        if contract.project.client != request.user and contract.freelancer != request.user:
            raise PermissionDenied("Only contract parties can update status.")
        
        new_status = request.data.get('status')
        if new_status not in ['active', 'in_progress', 'completed', 'cancelled']:
            return Response({'detail': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)
        
        contract.status = new_status
        if new_status == 'completed':
            contract.is_completed = True
        contract.save(update_fields=['status', 'is_completed'])
        
        serializer = self.get_serializer(contract)
        return Response(serializer.data)


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
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['read']

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


class SavedProjectViewSet(viewsets.ModelViewSet):
    """ViewSet for managing saved/bookmarked projects."""
    serializer_class = SavedProjectSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]

    def get_queryset(self):
        """Return saved projects for the authenticated user."""
        user = self.request.user
        if not user.is_authenticated:
            return SavedProject.objects.none()
        return SavedProject.objects.filter(user=user).select_related('project', 'project__client').prefetch_related('project__skills_required').order_by('-saved_at')

    def get_serializer_context(self):
        """Add request to serializer context."""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def perform_create(self, serializer):
        """Save project for the current user."""
        project_id = serializer.validated_data.get('project_id')
        project = get_object_or_404(Project, pk=project_id)
        saved_project, created = SavedProject.objects.get_or_create(
            user=self.request.user,
            project=project
        )
        if created:
            # Update analytics
            analytics, _ = ProjectAnalytics.objects.get_or_create(project=project)
            analytics.saved_count += 1
            analytics.save(update_fields=['saved_count'])
        serializer.instance = saved_project

    def perform_destroy(self, instance):
        """Update analytics when unsaving."""
        project = instance.project
        super().perform_destroy(instance)
        # Update analytics
        try:
            analytics = project.analytics
            analytics.saved_count = max(0, analytics.saved_count - 1)
            analytics.save(update_fields=['saved_count'])
        except ProjectAnalytics.DoesNotExist:
            pass


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only ViewSet for activity logs."""
    serializer_class = ActivityLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return activities for the authenticated user and related users."""
        user = self.request.user
        if not user.is_authenticated:
            return ActivityLog.objects.none()
        # Show user's own activities and activities related to them
        return ActivityLog.objects.filter(
            Q(user=user) | Q(related_user=user)
        ).select_related('user', 'related_user', 'related_project').order_by('-timestamp')[:50]  # Limit to 50 most recent


class ProjectAnalyticsViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only ViewSet for project analytics."""
    serializer_class = ProjectAnalyticsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return analytics for projects the user can access."""
        user = self.request.user
        if not user.is_authenticated:
            return ProjectAnalytics.objects.none()
        profile = getattr(user, 'profile', None)
        if profile:
            if profile.user_type == 'client':
                # Clients see analytics for their projects
                return ProjectAnalytics.objects.filter(project__client=user).select_related('project')
            elif profile.user_type == 'freelancer':
                # Freelancers see analytics for projects they're involved with
                proposed_project_ids = Proposal.objects.filter(freelancer=user).values_list('project_id', flat=True)
                contracted_project_ids = Contract.objects.filter(freelancer=user).values_list('project_id', flat=True)
                return ProjectAnalytics.objects.filter(
                    Q(project__id__in=proposed_project_ids) | Q(project__id__in=contracted_project_ids)
                ).select_related('project')
        elif user.is_staff:
            return ProjectAnalytics.objects.all().select_related('project')
        return ProjectAnalytics.objects.none()


class AchievementBadgeViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only ViewSet for achievement badges."""
    serializer_class = AchievementBadgeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return badges for the authenticated user or all if viewing others."""
        user = self.request.user
        if not user.is_authenticated:
            return AchievementBadge.objects.none()
        # Allow viewing own badges or all badges if admin
        target_user_id = self.request.query_params.get('user_id')
        if target_user_id and user.is_staff:
            return AchievementBadge.objects.filter(user_id=target_user_id).select_related('user')
        return AchievementBadge.objects.filter(user=user).select_related('user')


class MilestoneViewSet(viewsets.ModelViewSet):
    """ViewSet for managing project milestones."""
    serializer_class = MilestoneSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return milestones for projects the user can access."""
        user = self.request.user
        if not user.is_authenticated:
            return Milestone.objects.none()
        project_id = self.request.query_params.get('project')
        if project_id:
            return Milestone.objects.filter(project_id=project_id).select_related('project')
        # Return milestones for projects user is involved with
        profile = getattr(user, 'profile', None)
        if profile:
            if profile.user_type == 'client':
                return Milestone.objects.filter(project__client=user).select_related('project')
            elif profile.user_type == 'freelancer':
                contracted_project_ids = Contract.objects.filter(freelancer=user).values_list('project_id', flat=True)
                return Milestone.objects.filter(project_id__in=contracted_project_ids).select_related('project')
        return Milestone.objects.none()

    def perform_create(self, serializer):
        """Ensure user has permission to create milestone."""
        project = serializer.validated_data.get('project')
        if project.client != self.request.user:
            raise PermissionDenied("Only project owner can create milestones.")
        serializer.save()

    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        """
        Override partial_update to handle payment logic when a milestone
        is marked as 'approved'.
        """
        milestone = self.get_object()
        new_status = request.data.get('status')
        old_status = milestone.status

        # Check if this is an approval action (from 'completed' to 'approved')
        if new_status == 'approved' and old_status == 'completed':
            logger.info(f"Attempting to approve milestone {milestone.id} and process payment.")
            
            # We wrap the *entire* logic in a try/except to ensure the transaction rolls back
            try:
                project = milestone.project
                client = project.client
                amount = milestone.amount

                # 1. Find the freelancer from the project's contract
                try:
                    contract = Contract.objects.get(project=project)
                    freelancer = contract.freelancer
                except Contract.DoesNotExist:
                    logger.error(f"Payment failed for milestone {milestone.id}: No contract found for project {project.id}.")
                    raise ValidationError("Payment failed: Cannot find a contract associated with this project.")

                # 2. Get and LOCK both wallets
                # This is the most robust way: get_or_create, then re-fetch with a lock.
                Wallet.objects.get_or_create(user=client)
                Wallet.objects.get_or_create(user=freelancer)
                
                # Lock the rows for the duration of this transaction
                client_wallet = Wallet.objects.select_for_update().get(user=client)
                
                # --- FIX: Corrected 'frelancer' to 'freelancer' ---
                freelancer_wallet = Wallet.objects.select_for_update().get(user=freelancer)

                # 3. Check client's balance
                if client_wallet.balance < amount:
                    logger.warning(f"Payment failed for milestone {milestone.id}: Client {client.username} has insufficient funds (Balance: {client_wallet.balance}, Needed: {amount}).")
                    raise ValidationError(f"Payment failed: Client's wallet has insufficient funds.")

                # 4. Transfer funds
                client_wallet.balance -= amount
                freelancer_wallet.balance += amount

                # 5. Create transactions for logging
                Transaction.objects.create(
                    wallet=client_wallet,
                    transaction_type='payment',
                    amount=amount,
                    description=f"Milestone payment for '{milestone.title}' to {freelancer.username}"
                )
                Transaction.objects.create(
                    wallet=freelancer_wallet,
                    transaction_type='deposit',
                    amount=amount,
                    description=f"Milestone payment received for '{milestone.title}' from {client.username}"
                )

                # 6. Save wallet changes
                client_wallet.save(update_fields=['balance'])
                freelancer_wallet.save(update_fields=['balance'])

                # --- FIX: Manually save milestone status and completed_at ---
                milestone.completed_at = timezone.now()
                milestone.status = new_status
                milestone.save(update_fields=['status', 'completed_at'])

                logger.info(f"Milestone {milestone.id} approved. Transferred {amount} from {client.username} to {freelancer.username}.")

                # 9. Return a serialized response directly
                serializer = self.get_serializer(milestone)
                return Response(serializer.data)
                # --- END FIX (Replaced super() call) ---

            except Exception as e:
                # Catch any error (insufficient funds, DB error, etc.)
                logger.error(f"Payment processing failed for milestone {milestone.id}: {e}", exc_info=True)
                # Re-raise the error to force the @transaction.atomic to ROLLBACK
                if isinstance(e, ValidationError):
                    raise e # Re-raise the specific "insufficient funds" error
                else:
                    raise ValidationError(f"An error occurred during payment processing: {e}")

        # If the status was NOT 'approved', just run the normal update
        return super().partial_update(request, *args, **kwargs)


class ProjectFileViewSet(viewsets.ModelViewSet):
    """ViewSet for managing project files."""
    serializer_class = ProjectFileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return files for projects the user can access."""
        user = self.request.user
        if not user.is_authenticated:
            return ProjectFile.objects.none()
        project_id = self.request.query_params.get('project')
        if project_id:
            return ProjectFile.objects.filter(project_id=project_id).select_related('project', 'uploaded_by')
        return ProjectFile.objects.filter(uploaded_by=user).select_related('project', 'uploaded_by')

    def perform_create(self, serializer):
        """Set uploaded_by automatically."""
        serializer.save(uploaded_by=self.request.user)


class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only ViewSet for payments (typically created automatically)."""
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return payments for the authenticated user."""
        user = self.request.user
        if not user.is_authenticated:
            return Payment.objects.none()
        return Payment.objects.filter(
            Q(from_user=user) | Q(to_user=user)
        ).select_related('project', 'milestone', 'from_user', 'to_user')


class InvoiceViewSet(viewsets.ModelViewSet):
    """ViewSet for managing invoices."""
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return invoices for the authenticated user."""
        user = self.request.user
        if not user.is_authenticated:
            return Invoice.objects.none()
        profile = getattr(user, 'profile', None)
        if profile:
            if profile.user_type == 'freelancer':
                return Invoice.objects.filter(freelancer=user).select_related('project', 'client')
            elif profile.user_type == 'client':
                return Invoice.objects.filter(client=user).select_related('project', 'freelancer')
        return Invoice.objects.none()

    def perform_create(self, serializer):
        """Set freelancer/client automatically based on user type."""
        project = serializer.validated_data.get('project')
        profile = getattr(self.request.user, 'profile', None)
        if not profile:
            raise PermissionDenied("User profile required.")
        if profile.user_type == 'freelancer':
            serializer.save(freelancer=self.request.user, client=project.client)
        else:
            raise PermissionDenied("Only freelancers can create invoices.")
        
    @action(detail=True, methods=['patch'], url_path='update-status', permission_classes=[permissions.IsAuthenticated])
    def update_status(self, request, pk=None):
        """
        Allow the client or freelancer to update the invoice status.
        """
        invoice = self.get_object()

        # Check if user is client or freelancer for this invoice
        if invoice.client != request.user and invoice.freelancer != request.user:
            raise PermissionDenied("Only the client or freelancer on this invoice can update its status.")

        new_status = request.data.get('status')
        status_choices = [choice[0] for choice in Invoice.STATUS_CHOICES]

        if new_status not in status_choices:
            return Response({'detail': f'Invalid status. Must be one of {status_choices}'}, status=status.HTTP_400_BAD_REQUEST)

        invoice.status = new_status

        # Set paid_at date if status is 'paid'
        if new_status == 'paid':
            invoice.paid_at = timezone.now()
        else:
            # Clear paid_at if status is changed to something else
            invoice.paid_at = None 

        invoice.save(update_fields=['status', 'paid_at'])

        serializer = self.get_serializer(invoice)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'], url_path='download')
    def download_invoice(self, request, pk=None):
        """
        Generate and return a PDF version of the invoice.
        """
        invoice = self.get_object()

        # Check permission
        if invoice.client != request.user and invoice.freelancer != request.user:
            raise PermissionDenied("You do not have permission to download this invoice.")

        # Get related data for the template
        try:
            client_profile = invoice.client.profile
        except Profile.DoesNotExist:
            client_profile = None

        try:
            freelancer_profile = invoice.freelancer.profile
        except Profile.DoesNotExist:
            freelancer_profile = None

        # Calculate tax amount for the template
        tax_amount = (invoice.amount * invoice.tax_rate) / 100

        # Get the template
        template = get_template('pdf/invoice.html')
        context = {
            'invoice': invoice,
            'project_title': invoice.project.title, # Pass project title
            'client_profile': client_profile,
            'freelancer_profile': freelancer_profile,
            'tax_amount': tax_amount,
        }
        html = template.render(context)

        # Create a file-like buffer to receive PDF data
        result = io.BytesIO()

        # Convert HTML to PDF
        pdf = pisa.pisaDocument(io.BytesIO(html.encode("UTF-8")), result)

        if not pdf.err:
            # PDF generation success
            response = HttpResponse(result.getvalue(), content_type='application/pdf')
            # This header tells the browser to download the file
            response['Content-Disposition'] = f'attachment; filename="invoice-{invoice.invoice_number}.pdf"'
            return response

        # PDF generation failed
        return Response({'detail': f'Error generating PDF: {pdf.err}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class WalletViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for user wallet."""
    serializer_class = WalletSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return wallet for the authenticated user."""
        user = self.request.user
        if not user.is_authenticated:
            return Wallet.objects.none()
        wallet, created = Wallet.objects.get_or_create(user=user)
        return Wallet.objects.filter(user=user)


class TransactionViewSet(viewsets.ModelViewSet):
    """ViewSet for wallet transactions."""
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return transactions for the authenticated user's wallet."""
        user = self.request.user
        if not user.is_authenticated:
            return Transaction.objects.none()
        wallet, created = Wallet.objects.get_or_create(user=user)
        return Transaction.objects.filter(wallet=wallet).select_related('wallet', 'related_payment')

    @transaction.atomic
    def perform_create(self, serializer):
        """Create transaction and update wallet balance."""
        wallet, created = Wallet.objects.get_or_create(user=self.request.user)
        transaction_type = serializer.validated_data.get('transaction_type')
        amount = serializer.validated_data.get('amount')
        
        # --- FIX: Ensure amount is a number ---
        if amount is None or amount < 0:
            raise ValidationError("A valid amount is required.")
        
        transaction = serializer.save(wallet=wallet)
        
        # Update wallet balance
        if transaction_type == 'deposit':
            wallet.balance += amount
        elif transaction_type == 'withdrawal':
            if wallet.balance < amount:
                raise ValidationError("Insufficient balance.")
            wallet.balance -= amount
        
        # --- FIX: Ensure update_fields is correct ---
        wallet.save(update_fields=['balance'])
        
        return transaction