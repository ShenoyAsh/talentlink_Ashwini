# backend/api/views.py
from rest_framework import viewsets, permissions, generics, status
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
from rest_framework.response import Response
import datetime
from django.db.models import Q
from rest_framework.exceptions import PermissionDenied, ValidationError, NotFound
from django.contrib.auth import get_user_model # Import User model getter
from django.shortcuts import get_object_or_404 # Useful for getting objects or 404

# Get the User model
User = get_user_model()


# --- Permission Classes ---
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
            if isinstance(obj, Proposal) and obj.status != 'pending':
                return False # Freelancer can only edit/delete PENDING proposals
        elif hasattr(obj, 'reviewer'): # e.g., Review.reviewer
            owner = obj.reviewer
        elif hasattr(obj, 'recipient'): # e.g., Notification.recipient
            owner = obj.recipient
        # Add other ownership checks if needed (e.g., Message.sender)

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
            return Profile.objects.select_related('user').prefetch_related('skills', 'portfolio_items').filter(user=user)
        return Profile.objects.none() # Anonymous users see nothing

    # Override perform_update to handle profile picture upload separately
    def perform_update(self, serializer):
        # IsOwnerOrReadOnly permission already ensures user is updating their own profile
        instance = serializer.save() # Saves validated data from serializer (excluding skill_names, profile_picture)
        # Check if a new profile picture file was uploaded in the request
        if 'profile_picture' in self.request.FILES:
            instance.profile_picture = self.request.FILES['profile_picture']
            instance.save(update_fields=['profile_picture']) # Save only the picture field


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
    queryset = Project.objects.all().select_related('client').prefetch_related('skills_required').order_by('-created_at')
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
            self.permission_classes = [permissions.IsAuthenticated, IsClient]
        elif self.action in ['update', 'partial_update', 'destroy']:
            self.permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly] # Checks obj.client
        elif self.action in ['list', 'retrieve']:
             self.permission_classes = [permissions.IsAuthenticated] # Any logged-in user can view (visibility controlled by get_queryset)
        else:
             self.permission_classes = [permissions.IsAdminUser] # Restrict other actions to admins
        return super().get_permissions()

    def perform_create(self, serializer):
        """ Automatically set the project client to the logged-in user. """
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
                proposed_project_ids = Proposal.objects.filter(freelancer=user).values_list('project_id', flat=True)
                contracted_project_ids = Contract.objects.filter(freelancer=user).values_list('project_id', flat=True)
                return queryset.filter(
                    Q(status='open') | Q(id__in=proposed_project_ids) | Q(id__in=contracted_project_ids)
                ).distinct() # Use distinct to avoid duplicates if proposed and contracted

        # Admins see all projects
        if user.is_staff:
            return queryset
        # Authenticated users without a profile (should be rare) see only open projects
        return queryset.filter(status='open')


class ProposalViewSet(viewsets.ModelViewSet):
    """ ViewSet for managing project proposals. """
    queryset = Proposal.objects.all().select_related('project', 'freelancer').order_by('-submitted_at')
    serializer_class = ProposalSerializer
    permission_classes = [permissions.IsAuthenticated] # Base permission

    def get_permissions(self):
        """ Set permissions based on the action. """
        if self.action == 'create':
            self.permission_classes = [permissions.IsAuthenticated, IsFreelancer]
        elif self.action == 'update_status': # Custom action
            self.permission_classes = [permissions.IsAuthenticated] # Specific client check is inside the action
        elif self.action in ['update', 'partial_update']:
            # IsOwnerOrReadOnly checks freelancer owner AND status='pending'
            self.permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]
        elif self.action == 'destroy':
            # IsOwnerOrReadOnly checks freelancer owner AND status='pending'
            self.permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]
        elif self.action in ['list', 'retrieve']:
             # Visibility controlled by get_queryset
            self.permission_classes = [permissions.IsAuthenticated]
        else:
             self.permission_classes = [permissions.IsAdminUser]
        return super().get_permissions()

    def perform_create(self, serializer):
        """ Validate project status and uniqueness before saving. """
        project = serializer.validated_data.get('project')
        # Ensure project exists and is open (serializer queryset also helps)
        if not project or project.status != 'open':
             raise ValidationError("Project not found or is not open for proposals.")
        # Prevent duplicate proposals
        if Proposal.objects.filter(project=project, freelancer=self.request.user).exists():
             raise ValidationError("You have already submitted a proposal for this project.")
        # Set freelancer automatically
        serializer.save(freelancer=self.request.user)

    # perform_update and perform_destroy rely on IsOwnerOrReadOnly permission check

    def get_queryset(self):
        """ Filter proposals based on user role. """
        user = self.request.user
        queryset = super().get_queryset()
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

        if user.is_staff: # Admin sees all
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

        if proposal.status != 'pending':
             return Response({'detail': f'Proposal status is already "{proposal.status}".'}, status=status.HTTP_400_BAD_REQUEST)

        # Update the proposal status (this triggers the post_save signal)
        proposal.status = new_status
        proposal.save(update_fields=['status'])

        # If accepted, create contract, update project, reject others
        if new_status == 'accepted':
            try:
                with transaction.atomic(): # Ensure atomicity for related updates
                    contract, created = Contract.objects.get_or_create(
                        project=proposal.project,
                        defaults={
                            'freelancer': proposal.freelancer,
                            'agreed_rate': proposal.proposed_rate,
                            'start_date': datetime.date.today()
                        }
                    )
                    # Only proceed if the contract was newly created by this acceptance
                    if created:
                        proposal.project.status = 'in_progress'
                        proposal.project.save(update_fields=['status'])
                        # Reject other *pending* proposals for this project
                        Proposal.objects.filter(
                            project=proposal.project, status='pending'
                        ).exclude(pk=proposal.pk).update(status='rejected')

            except Exception as e:
                 # Log error and inform user
                 # Consider more specific error handling if needed
                 print(f"Error in post-acceptance logic for proposal {proposal.pk}: {e}")
                 # Note: Proposal status is already saved as 'accepted' here.
                 return Response({
                     'detail': f'Proposal accepted, but failed to create contract or update project: {e}'
                 }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Return the updated proposal
        serializer = self.get_serializer(proposal)
        return Response(serializer.data)


class ContractViewSet(viewsets.ReadOnlyModelViewSet):
    """ Read-only ViewSet for viewing contracts. """
    queryset = Contract.objects.all().select_related('project__client', 'freelancer').order_by('-start_date')
    serializer_class = ContractSerializer
    permission_classes = [permissions.IsAuthenticated] # Must be logged in

    def get_queryset(self):
        """ Filter contracts based on user role. """
        user = self.request.user
        queryset = super().get_queryset()
        if not user.is_authenticated:
            return Contract.objects.none()

        profile = getattr(user, 'profile', None)
        if profile:
             if profile.user_type == 'freelancer':
                 return queryset.filter(freelancer=user)
             elif profile.user_type == 'client':
                 return queryset.filter(project__client=user)

        if user.is_staff: # Admin sees all
            return queryset
        return Contract.objects.none()


class MessageViewSet(viewsets.ModelViewSet):
    """ ViewSet for sending and viewing messages. """
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated] # Must be logged in
    # Prevent PUT requests, allow PATCH if needed later
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        """ Filter messages involving the current user, ordered chronologically. """
        user = self.request.user
        if not user.is_authenticated:
            # Added check here to prevent potential errors if user is None
            return Message.objects.none()
        # Optimize query by selecting related sender and receiver
        return Message.objects.select_related('sender', 'receiver').filter(
            Q(sender=user) | Q(receiver=user)
        ).order_by('timestamp') # Ascending order for chat history

    def perform_create(self, serializer):
        """ Set sender and find receiver by username. """
        receiver_username = serializer.validated_data.get('receiver_username')
        if not receiver_username:
             # This should be caught by serializer validation, but belts and suspenders
             raise ValidationError({"receiver_username": "This field is required."})

        # Find the receiver user, raise validation error if not found or is self
        try:
            receiver = User.objects.get(username=receiver_username)
        except User.DoesNotExist:
             raise ValidationError({"receiver_username": f"User '{receiver_username}' not found."})

        if receiver == self.request.user:
             raise ValidationError({"receiver_username": "You cannot send messages to yourself."})

        # Save the message instance with sender and receiver set
        serializer.save(sender=self.request.user, receiver=receiver)


class ReviewViewSet(viewsets.ModelViewSet):
    """ ViewSet for creating and viewing reviews. """
    queryset = Review.objects.all().select_related('project', 'reviewer', 'reviewee').order_by('-created_at')
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly] # Checks reviewer for edit/delete
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options'] # No PUT needed usually

    def get_queryset(self):
        """ Filter reviews by project or user involvement. """
        user = self.request.user
        queryset = super().get_queryset()
        project_id = self.request.query_params.get('project')

        if project_id:
            # If filtering by project, ensure user has permission to view reviews for it
            project = get_object_or_404(Project, pk=project_id)
            is_client = project.client == user
            # Check if user was the accepted freelancer for this project
            is_freelancer = project.proposals.filter(freelancer=user, status='accepted').exists()

            if user.is_staff or is_client or is_freelancer:
                return queryset.filter(project=project)
            else:
                 # Raise 403 if user not allowed to see reviews for this project
                raise PermissionDenied("You do not have permission to view reviews for this project.")
        elif user.is_authenticated:
            # If not filtering by project, show reviews where user is reviewer or reviewee
            return queryset.filter(Q(reviewer=user) | Q(reviewee=user))
        else:
            return Review.objects.none() # No reviews for anonymous users without project filter

    def perform_create(self, serializer):
        """ Validate who can review whom for a specific project. """
        project = serializer.validated_data.get('project')
        user = self.request.user
        profile = getattr(user, 'profile', None)
        if not profile:
             raise PermissionDenied("User profile is required to submit reviews.")

        reviewee = None
        try:
            # Client reviewing the accepted freelancer
            if profile.user_type == 'client' and project.client == user:
                proposal = project.proposals.get(status='accepted')
                reviewee = proposal.freelancer
            # Accepted freelancer reviewing the client
            elif profile.user_type == 'freelancer' and project.proposals.filter(freelancer=user, status='accepted').exists():
                 reviewee = project.client
            else:
                 raise PermissionDenied("You are not the client or the accepted freelancer for this project.")

        except Proposal.DoesNotExist:
             raise ValidationError("Cannot create review: No accepted proposal found.")
        except Proposal.MultipleObjectsReturned:
             raise ValidationError("Data Error: Multiple accepted proposals found.") # Should not happen

        if not reviewee: # Should be caught above, but safety check
            raise ValidationError("Could not determine who to review.")

        # Prevent duplicate reviews (reviewer->reviewee for this project)
        if Review.objects.filter(project=project, reviewer=user, reviewee=reviewee).exists():
             raise ValidationError("You have already reviewed this user for this project.")

        serializer.save(reviewer=user, reviewee=reviewee)


class NotificationViewSet(viewsets.ModelViewSet):
    """ Read-only ViewSet for user notifications with mark read actions. """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly] # Checks recipient
    # Limit allowed methods: GET (list/detail), PATCH (actions), DELETE (optional)
    http_method_names = ['get', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        """ Return notifications only for the authenticated user. """
        user = self.request.user
        if not user.is_authenticated:
            return Notification.objects.none()
        # Order by most recent first
        return Notification.objects.filter(recipient=user).order_by('-timestamp')

    @action(detail=True, methods=['patch'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        """ Mark a specific notification as read. """
        notification = self.get_object() # Permission check included
        if not notification.read:
            notification.read = True
            notification.save(update_fields=['read'])
        return Response(self.get_serializer(notification).data)

    @action(detail=True, methods=['patch'], url_path='mark-unread')
    def mark_unread(self, request, pk=None):
        """ Mark a specific notification as unread. """
        notification = self.get_object() # Permission check included
        if notification.read:
            notification.read = False
            notification.save(update_fields=['read'])
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        """ Mark all unread notifications for the user as read. """
        user = request.user
        updated_count = Notification.objects.filter(recipient=user, read=False).update(read=True)
        return Response({'status': f'{updated_count} notifications marked as read.'}, status=status.HTTP_200_OK)