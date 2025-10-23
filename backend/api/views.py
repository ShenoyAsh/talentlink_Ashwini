# backend/api/views.py
from rest_framework import viewsets, permissions, generics
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from .models import User, Profile, Skill, Project, Proposal, Contract, Message, Review, PortfolioItem, Notification # Added PortfolioItem, Notification
from .serializers import (
    RegisterSerializer, UserSerializer, ProfileSerializer, SkillSerializer,
    ProjectSerializer, ProposalSerializer, ContractSerializer, MessageSerializer, ReviewSerializer,
    PortfolioItemSerializer, NotificationSerializer # Added PortfolioItemSerializer, NotificationSerializer
)
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
import datetime
from django.db.models import Q
from rest_framework.exceptions import PermissionDenied, ValidationError # Import PermissionDenied


# --- Permission Classes ---
class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object to edit it.
    Assumes the model instance has a 'user' or 'profile.user' attribute.
    """
    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request,
        # so we'll always allow GET, HEAD or OPTIONS requests.
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write permissions are only allowed to the owner.
        if hasattr(obj, 'user'): # Direct user link (e.g., Profile)
             return obj.user == request.user
        if hasattr(obj, 'profile'): # Link via profile (e.g., PortfolioItem)
             return obj.profile.user == request.user
        if hasattr(obj, 'client'): # Link via client (e.g., Project)
             return obj.client == request.user
        if hasattr(obj, 'freelancer'): # Link via freelancer (e.g., Proposal)
             # Allow edit/delete only if status is pending for proposals
             if isinstance(obj, Proposal):
                 return obj.freelancer == request.user and obj.status == 'pending'
             return obj.freelancer == request.user
        if hasattr(obj, 'reviewer'): # Link via reviewer (e.g., Review)
             return obj.reviewer == request.user

        return False


class IsClient(permissions.BasePermission):
    def has_permission(self, request, view):
        # Check profile exists before accessing user_type
        return request.user and request.user.is_authenticated and hasattr(request.user, 'profile') and request.user.profile.user_type == 'client'

class IsFreelancer(permissions.BasePermission):
    def has_permission(self, request, view):
         # Check profile exists before accessing user_type
        return request.user and request.user.is_authenticated and hasattr(request.user, 'profile') and request.user.profile.user_type == 'freelancer'


# --- ViewSets & Views ---

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer


class ProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly] # Allow editing only by owner

    def get_queryset(self):
        # Allow users to view any profile, but restrict list to their own if needed,
        # or filter based on user type etc. For now, let's allow viewing all.
        # However, the IsOwnerOrReadOnly permission will prevent modification.
        return Profile.objects.all()

    # Override perform_update/perform_create if needed to ensure user association
    def perform_update(self, serializer):
         instance = serializer.save()
         # Additional logic if needed

# New ViewSet for Portfolio Items
class PortfolioItemViewSet(viewsets.ModelViewSet):
    serializer_class = PortfolioItemSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]

    def get_queryset(self):
        # Users should only see/manage their own portfolio items
        if getattr(self.request.user, 'profile', None):
            return PortfolioItem.objects.filter(profile=self.request.user.profile)
        return PortfolioItem.objects.none() # Return empty if no profile

    def perform_create(self, serializer):
        # Associate the portfolio item with the logged-in user's profile
        if not hasattr(self.request.user, 'profile'):
             raise PermissionDenied("User does not have a profile to add portfolio items to.")
        if self.request.user.profile.user_type != 'freelancer':
             raise PermissionDenied("Only freelancers can add portfolio items.")
        serializer.save(profile=self.request.user.profile)


class SkillViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Skill.objects.all()
    serializer_class = SkillSerializer
    permission_classes = [permissions.AllowAny] # Skills are public


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all().order_by('-created_at')
    serializer_class = ProjectSerializer
    # Apply IsOwnerOrReadOnly for update/destroy, IsClient for create
    permission_classes = [permissions.IsAuthenticated]

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'skills_required', 'client'] # Allow filtering by client
    search_fields = ['title', 'description']
    ordering_fields = ['budget', 'created_at']

    def get_permissions(self):
        if self.action == 'create':
            # Only clients can create
            self.permission_classes = [permissions.IsAuthenticated, IsClient]
        elif self.action in ['update', 'partial_update', 'destroy']:
            # Only the owning client can modify/delete
            self.permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]
        elif self.action in ['list', 'retrieve']:
             # Any authenticated user can view list/details (filtered queryset applies)
             self.permission_classes = [permissions.IsAuthenticated]
        else:
             # Default for other actions (if any added later)
             self.permission_classes = [permissions.IsAdminUser] # Or restrict further
        return super().get_permissions()

    def perform_create(self, serializer):
        # Assign the client automatically
        serializer.save(client=self.request.user)

    def get_queryset(self):
        user = self.request.user
        # Clients see their own projects (all statuses)
        if user.is_authenticated and hasattr(user, 'profile') and user.profile.user_type == 'client':
            return self.queryset.filter(client=user)
        # Freelancers and others see only 'open' projects
        elif user.is_authenticated:
            return self.queryset.filter(status='open')
        # Unauthenticated users see nothing (or adjust if public viewing is desired)
        return Project.objects.none()


class ProposalViewSet(viewsets.ModelViewSet):
    queryset = Proposal.objects.all()
    serializer_class = ProposalSerializer
    permission_classes = [permissions.IsAuthenticated] # Base permission

    def get_permissions(self):
        if self.action == 'create':
            self.permission_classes = [permissions.IsAuthenticated, IsFreelancer]
        elif self.action == 'update_status': # Custom action needs specific permission
            self.permission_classes = [permissions.IsAuthenticated, IsClient]
        elif self.action in ['update', 'partial_update', 'destroy']:
            # Only owner freelancer can modify/delete IF status is 'pending'
            self.permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]
        elif self.action in ['list', 'retrieve']:
            # Owner (freelancer or client involved) can see
            self.permission_classes = [permissions.IsAuthenticated] # Queryset filters further
        else:
             self.permission_classes = [permissions.IsAdminUser]
        return super().get_permissions()

    def perform_create(self, serializer):
        # Check if project exists and is open
        project_id = self.request.data.get('project')
        try:
            project = Project.objects.get(pk=project_id, status='open')
        except Project.DoesNotExist:
            raise ValidationError("Project not found or is not open for proposals.")

        # Check if freelancer already proposed for this project
        if Proposal.objects.filter(project=project, freelancer=self.request.user).exists():
             raise ValidationError("You have already submitted a proposal for this project.")

        serializer.save(freelancer=self.request.user, project=project)

    def perform_update(self, serializer):
        # Ensure status isn't changed here, only via update_status action
        if 'status' in serializer.validated_data and serializer.instance.status != serializer.validated_data['status']:
            raise PermissionDenied("Cannot change status directly. Use the update_status action.")
        # Ensure only pending proposals are edited
        if serializer.instance.status != 'pending':
            raise PermissionDenied("Cannot edit proposals that are not in 'pending' status.")
        serializer.save()

    def perform_destroy(self, instance):
         # Ensure only pending proposals are deleted
         if instance.status != 'pending':
             raise PermissionDenied("Cannot delete proposals that are not in 'pending' status.")
         instance.delete()

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Proposal.objects.none()

        # Freelancers see their proposals
        if hasattr(user, 'profile') and user.profile.user_type == 'freelancer':
            return self.queryset.filter(freelancer=user)
        # Clients see proposals for their projects
        elif hasattr(user, 'profile') and user.profile.user_type == 'client':
            return self.queryset.filter(project__client=user)
        # Other authenticated users (e.g., admin) might see all or based on roles
        # if user.is_staff: return self.queryset.all()
        return Proposal.objects.none() # Default deny for others

    @action(detail=True, methods=['patch'], url_path='update-status') # Ensure url_path matches urls.py if needed
    def update_status(self, request, pk=None):
        proposal = self.get_object() # This applies object-level permissions

        # Additional check: only project client can update status
        if proposal.project.client != request.user:
             raise PermissionDenied("You are not the client for this project.")

        status_val = request.data.get('status')
        if status_val not in ['accepted', 'rejected']:
            return Response({'detail': 'Invalid status value.'}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure proposal is pending before changing status
        if proposal.status != 'pending':
             return Response({'detail': f'Proposal is already {proposal.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        original_status = proposal.status # Store before changing
        proposal.status = status_val
        proposal.save()
        proposal._original_status = original_status # Manually update for signal consistency if needed immediately

        if status_val == 'accepted':
            # Create contract only if one doesn't exist for this project
            if not Contract.objects.filter(project=proposal.project).exists():
                Contract.objects.create(
                    project=proposal.project,
                    freelancer=proposal.freelancer,
                    agreed_rate=proposal.proposed_rate,
                    start_date=datetime.date.today()
                    # Add end_date logic if needed based on project duration
                )
            # Update project status
            proposal.project.status = 'in_progress'
            proposal.project.save()

            # Reject other pending proposals for the same project
            Proposal.objects.filter(project=proposal.project, status='pending').exclude(pk=proposal.pk).update(status='rejected')

        # Signal will handle notification creation post_save

        return Response(self.get_serializer(proposal).data)

class ContractViewSet(viewsets.ReadOnlyModelViewSet): # Typically contracts aren't modified/deleted this way
    queryset = Contract.objects.all()
    serializer_class = ContractSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Contract.objects.none()
        # Filter contracts where the user is either the client or the freelancer
        if hasattr(user, 'profile'):
             if user.profile.user_type == 'freelancer':
                 return self.queryset.filter(freelancer=user)
             elif user.profile.user_type == 'client':
                 return self.queryset.filter(project__client=user)
        return Contract.objects.none()

class MessageViewSet(viewsets.ModelViewSet):
    queryset = Message.objects.all().order_by('-timestamp') # Show newest first
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Users can only see messages they sent or received
        return self.queryset.filter(Q(sender=user) | Q(receiver=user))

    def perform_create(self, serializer):
        # Use 'receiver_username' from the request data
        receiver_username = serializer.validated_data.get('receiver_username')
        if not receiver_username:
             raise ValidationError("Receiver username is required.")
        try:
            receiver = User.objects.get(username=receiver_username)
            if receiver == self.request.user:
                 raise ValidationError("You cannot send a message to yourself.")
        except User.DoesNotExist:
            raise ValidationError(f"Receiver with username '{receiver_username}' not found.")

        # Save with sender and found receiver, removing receiver_username
        serializer.save(sender=self.request.user, receiver=receiver) # receiver_username is write_only


class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.all().order_by('-created_at')
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly] # Only owner can edit/delete

    def get_queryset(self):
        user = self.request.user
        queryset = Review.objects.all()
        # Allow filtering by project ID from query params
        project_id = self.request.query_params.get('project')
        if project_id:
             queryset = queryset.filter(project_id=project_id)
        # Allow users to see reviews related to them (reviewer or reviewee)
        # return queryset.filter(Q(reviewer=user) | Q(reviewee=user))
        # Or make reviews public once submitted? Let's keep it filtered for now.
        if project_id: # If filtering by project, return those
             return queryset
        # Otherwise, maybe return reviews where user is reviewer/reviewee?
        return queryset.filter(Q(reviewer=user) | Q(reviewee=user))


    def perform_create(self, serializer):
        project_id = serializer.validated_data.get('project').id
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            raise ValidationError("Project not found.")

        user_profile = getattr(self.request.user, 'profile', None)
        if not user_profile:
             raise PermissionDenied("User profile not found.")

        reviewee = None
        # Client reviews the accepted freelancer
        if user_profile.user_type == 'client' and project.client == self.request.user:
            try:
                accepted_proposal = project.proposals.get(status='accepted')
                reviewee = accepted_proposal.freelancer
            except Proposal.DoesNotExist:
                 raise ValidationError("Cannot review: No accepted proposal found for this project.")
            except Proposal.MultipleObjectsReturned:
                 # Handle case with multiple accepted proposals if possible, maybe take the latest?
                 # For simplicity, let's assume only one for now or raise error.
                 raise ValidationError("Consistency error: Multiple accepted proposals found.")

        # Freelancer reviews the client
        elif user_profile.user_type == 'freelancer':
             # Ensure this freelancer was the one accepted for the project
             try:
                 accepted_proposal = project.proposals.get(status='accepted', freelancer=self.request.user)
                 reviewee = project.client
             except Proposal.DoesNotExist:
                 raise PermissionDenied("You cannot review this project as you were not the accepted freelancer.")

        else:
            raise PermissionDenied("You are not authorized to review this project.")

        if not reviewee:
             raise ValidationError("Could not determine the reviewee.")

        # Check if reviewer already reviewed this reviewee for this project
        if Review.objects.filter(project=project, reviewer=self.request.user, reviewee=reviewee).exists():
             raise ValidationError("You have already submitted a review for this user on this project.")

        serializer.save(reviewer=self.request.user, reviewee=reviewee)

# New ViewSet for Notifications
class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Users only see their own notifications
        return Notification.objects.filter(recipient=self.request.user).order_by('-timestamp')

    # Allow users to mark notifications as read/unread
    @action(detail=True, methods=['patch'])
    def mark_read(self, request, pk=None):
        notification = self.get_object() # Checks ownership via queryset
        if notification.recipient != request.user:
             raise PermissionDenied("Cannot modify this notification.")
        notification.read = True
        notification.save()
        return Response(self.get_serializer(notification).data)

    @action(detail=True, methods=['patch'])
    def mark_unread(self, request, pk=None):
        notification = self.get_object()
        if notification.recipient != request.user:
             raise PermissionDenied("Cannot modify this notification.")
        notification.read = False
        notification.save()
        return Response(self.get_serializer(notification).data)

    # Action to mark all as read
    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        Notification.objects.filter(recipient=request.user, read=False).update(read=True)
        return Response({'status': 'All notifications marked as read'}, status=status.HTTP_200_OK)