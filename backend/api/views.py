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
# backend/api/views.py
# ... (imports remain the same) ...

# --- Permission Classes remain the same ---
class IsOwnerOrReadOnly(permissions.BasePermission):
    # ... (no changes needed here) ...
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if hasattr(obj, 'user'):
             return obj.user == request.user
        if hasattr(obj, 'profile'):
             return obj.profile.user == request.user
        if hasattr(obj, 'client'):
             return obj.client == request.user
        if hasattr(obj, 'freelancer'):
             if isinstance(obj, Proposal):
                 return obj.freelancer == request.user and obj.status == 'pending'
             return obj.freelancer == request.user
        if hasattr(obj, 'reviewer'):
             return obj.reviewer == request.user
        if hasattr(obj, 'recipient'): # Added for Notification
             return obj.recipient == request.user
        return False

class IsClient(permissions.BasePermission):
    # ... (no changes needed here) ...
     def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and hasattr(request.user, 'profile') and request.user.profile.user_type == 'client'

class IsFreelancer(permissions.BasePermission):
    # ... (no changes needed here) ...
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and hasattr(request.user, 'profile') and request.user.profile.user_type == 'freelancer'


# --- RegisterView remains the same ---
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

# --- MODIFIED ProfileViewSet ---
class ProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]

    def get_queryset(self):
        # Only allow users to see/edit their own profile via this viewset
        if self.request.user.is_authenticated and hasattr(self.request.user, 'profile'):
            return Profile.objects.filter(user=self.request.user)
        return Profile.objects.none()

    def perform_update(self, serializer):
        instance = serializer.save()
        # Handle profile picture upload separately if present in request.FILES
        if 'profile_picture' in self.request.FILES:
            instance.profile_picture = self.request.FILES['profile_picture']
            instance.save()
# --- End MODIFIED ProfileViewSet ---

# --- PortfolioItemViewSet, SkillViewSet, ProjectViewSet remain the same ---
class PortfolioItemViewSet(viewsets.ModelViewSet):
    serializer_class = PortfolioItemSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]

    def get_queryset(self):
        if getattr(self.request.user, 'profile', None):
            return PortfolioItem.objects.filter(profile=self.request.user.profile)
        return PortfolioItem.objects.none()

    def perform_create(self, serializer):
        if not hasattr(self.request.user, 'profile'):
             raise PermissionDenied("User does not have a profile to add portfolio items to.")
        if self.request.user.profile.user_type != 'freelancer':
             raise PermissionDenied("Only freelancers can add portfolio items.")
        serializer.save(profile=self.request.user.profile)


class SkillViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Skill.objects.all()
    serializer_class = SkillSerializer
    permission_classes = [permissions.AllowAny]


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all().order_by('-created_at')
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'skills_required', 'client']
    search_fields = ['title', 'description']
    ordering_fields = ['budget', 'created_at']

    def get_permissions(self):
        if self.action == 'create':
            self.permission_classes = [permissions.IsAuthenticated, IsClient]
        elif self.action in ['update', 'partial_update', 'destroy']:
            self.permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]
        elif self.action in ['list', 'retrieve']:
             self.permission_classes = [permissions.IsAuthenticated]
        else:
             self.permission_classes = [permissions.IsAdminUser]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(client=self.request.user)

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated and hasattr(user, 'profile') and user.profile.user_type == 'client':
            return self.queryset.filter(client=user)
        elif user.is_authenticated:
            # Freelancers should see ALL projects, not just open, if they might have proposals on them
            # Let's adjust this slightly - show open, or projects they have proposed on
            if hasattr(user, 'profile') and user.profile.user_type == 'freelancer':
                proposed_project_ids = Proposal.objects.filter(freelancer=user).values_list('project_id', flat=True)
                return self.queryset.filter(Q(status='open') | Q(id__in=proposed_project_ids)).distinct()
            else: # Other authenticated users might just see open ones
                return self.queryset.filter(status='open')
        return Project.objects.none()


# --- ProposalViewSet: Fix potential permission issue in update_status ---
class ProposalViewSet(viewsets.ModelViewSet):
    queryset = Proposal.objects.all()
    serializer_class = ProposalSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        # --- Action-specific permissions ---
        if self.action == 'create':
            self.permission_classes = [permissions.IsAuthenticated, IsFreelancer]
        elif self.action == 'update_status':
            # *** IMPORTANT: Make sure the client owning the PROJECT can perform this ***
            # We'll check object-level permission *inside* the action method.
            # Base permission here should just be IsAuthenticated or IsClient. Let's use IsAuthenticated.
            self.permission_classes = [permissions.IsAuthenticated]
        elif self.action in ['update', 'partial_update', 'destroy']:
            self.permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly] # Checks freelancer owner & pending status
        elif self.action in ['list', 'retrieve']:
            self.permission_classes = [permissions.IsAuthenticated]
        else:
            self.permission_classes = [permissions.IsAdminUser]
        return super().get_permissions()

    # --- perform_create, perform_update, perform_destroy, get_queryset remain the same ---
    def perform_create(self, serializer):
        project_id = self.request.data.get('project')
        try:
            project = Project.objects.get(pk=project_id, status='open')
        except Project.DoesNotExist:
            raise ValidationError("Project not found or is not open for proposals.")
        if Proposal.objects.filter(project=project, freelancer=self.request.user).exists():
             raise ValidationError("You have already submitted a proposal for this project.")
        serializer.save(freelancer=self.request.user, project=project)

    def perform_update(self, serializer):
         instance = serializer.instance # Get instance before calling super().save()
         if 'status' in serializer.validated_data and instance.status != serializer.validated_data['status']:
            raise PermissionDenied("Cannot change status directly. Use the update_status action.")
         if instance.status != 'pending':
            raise PermissionDenied("Cannot edit proposals that are not in 'pending' status.")
         # Pass the instance to save
         serializer.save()


    def perform_destroy(self, instance):
         if instance.status != 'pending':
             raise PermissionDenied("Cannot delete proposals that are not in 'pending' status.")
         instance.delete()

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Proposal.objects.none()
        if hasattr(user, 'profile') and user.profile.user_type == 'freelancer':
            return self.queryset.filter(freelancer=user)
        elif hasattr(user, 'profile') and user.profile.user_type == 'client':
            return self.queryset.filter(project__client=user)
        return Proposal.objects.none()

    # --- MODIFIED update_status ---
    @action(detail=True, methods=['patch'], url_path='update-status', permission_classes=[permissions.IsAuthenticated]) # Keep base permission simple
    def update_status(self, request, pk=None):
        try:
            proposal = self.get_object() # Fetches based on pk
        except Proposal.DoesNotExist:
             return Response({'detail': 'Proposal not found.'}, status=status.HTTP_404_NOT_FOUND)


        # *** Explicit Permission Check: Only project client can update ***
        if proposal.project.client != request.user:
             raise PermissionDenied("You are not the client for this project.")

        status_val = request.data.get('status')
        if status_val not in ['accepted', 'rejected']:
            return Response({'detail': 'Invalid status value. Must be "accepted" or "rejected".'}, status=status.HTTP_400_BAD_REQUEST)

        if proposal.status != 'pending':
             return Response({'detail': f'Proposal is already {proposal.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        # --- Logic for status change, contract creation, project update, other proposal rejection ---
        original_status = proposal.status # Store before changing
        proposal.status = status_val
        proposal.save()
        # Manually update _original_status after save if signals need it immediately
        # proposal._original_status = original_status

        if status_val == 'accepted':
            # Ensure atomicity later if needed (database transaction)
            try:
                if not Contract.objects.filter(project=proposal.project).exists():
                    Contract.objects.create(
                        project=proposal.project,
                        freelancer=proposal.freelancer,
                        agreed_rate=proposal.proposed_rate,
                        start_date=datetime.date.today()
                    )
                proposal.project.status = 'in_progress'
                proposal.project.save()
                Proposal.objects.filter(project=proposal.project, status='pending').exclude(pk=proposal.pk).update(status='rejected')
            except Exception as e:
                 # Handle potential errors during contract creation or project update
                 # Optionally revert proposal status if needed
                 # proposal.status = original_status
                 # proposal.save()
                 print(f"Error during post-acceptance processing: {e}") # Log the error
                 return Response({'detail': f'Proposal status updated, but failed to create contract or update project: {e}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


        # Signal will handle notification creation after save completes

        return Response(self.get_serializer(proposal).data)
    # --- End MODIFIED update_status ---

# --- ContractViewSet, MessageViewSet, ReviewViewSet remain the same ---
class ContractViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Contract.objects.all()
    serializer_class = ContractSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Contract.objects.none()
        if hasattr(user, 'profile'):
             if user.profile.user_type == 'freelancer':
                 return self.queryset.filter(freelancer=user)
             elif user.profile.user_type == 'client':
                 return self.queryset.filter(project__client=user)
        return Contract.objects.none()

class MessageViewSet(viewsets.ModelViewSet):
    queryset = Message.objects.all().order_by('-timestamp')
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return self.queryset.filter(Q(sender=user) | Q(receiver=user))

    def perform_create(self, serializer):
        receiver_username = serializer.validated_data.get('receiver_username')
        if not receiver_username:
             raise ValidationError("Receiver username is required.")
        try:
            receiver = User.objects.get(username=receiver_username)
            if receiver == self.request.user:
                 raise ValidationError("You cannot send a message to yourself.")
        except User.DoesNotExist:
            raise ValidationError(f"Receiver with username '{receiver_username}' not found.")
        serializer.save(sender=self.request.user, receiver=receiver)


class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.all().order_by('-created_at')
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        queryset = Review.objects.all()
        project_id = self.request.query_params.get('project')
        if project_id:
             queryset = queryset.filter(project_id=project_id)
        elif user.is_authenticated: # Only filter by user if not filtering by project
             queryset = queryset.filter(Q(reviewer=user) | Q(reviewee=user))
        else:
            queryset = Review.objects.none()
        return queryset


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
        if user_profile.user_type == 'client' and project.client == self.request.user:
            try:
                accepted_proposal = project.proposals.get(status='accepted')
                reviewee = accepted_proposal.freelancer
            except Proposal.DoesNotExist:
                 raise ValidationError("Cannot review: No accepted proposal found for this project.")
            except Proposal.MultipleObjectsReturned:
                 raise ValidationError("Consistency error: Multiple accepted proposals found.")

        elif user_profile.user_type == 'freelancer':
             try:
                 accepted_proposal = project.proposals.get(status='accepted', freelancer=self.request.user)
                 reviewee = project.client
             except Proposal.DoesNotExist:
                 raise PermissionDenied("You cannot review this project as you were not the accepted freelancer.")
        else:
            raise PermissionDenied("You are not authorized to review this project.")

        if not reviewee:
             raise ValidationError("Could not determine the reviewee.")

        if Review.objects.filter(project=project, reviewer=self.request.user, reviewee=reviewee).exists():
             raise ValidationError("You have already submitted a review for this user on this project.")

        serializer.save(reviewer=self.request.user, reviewee=reviewee)

# --- NotificationViewSet: Ensure IsOwnerOrReadOnly handles recipient ---
class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly] # Add IsOwnerOrReadOnly

    def get_queryset(self):
        # Users only see their own notifications
        return Notification.objects.filter(recipient=self.request.user).order_by('-timestamp')

    # --- mark_read, mark_unread, mark_all_read remain the same ---
    @action(detail=True, methods=['patch'])
    def mark_read(self, request, pk=None):
        notification = self.get_object() # Checks ownership via IsOwnerOrReadOnly
        notification.read = True
        notification.save()
        return Response(self.get_serializer(notification).data)

    @action(detail=True, methods=['patch'])
    def mark_unread(self, request, pk=None):
        notification = self.get_object() # Checks ownership via IsOwnerOrReadOnly
        notification.read = False
        notification.save()
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        # Don't need get_object here, filter by user directly
        updated_count = Notification.objects.filter(recipient=request.user, read=False).update(read=True)
        # return Response({'status': f'{updated_count} notifications marked as read'}, status=status.HTTP_200_OK)
        return Response({'status': 'All notifications marked as read'}, status=status.HTTP_200_OK)