from rest_framework import viewsets, permissions, generics
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from .models import User, Profile, Skill, Project, Proposal
from .serializers import (
    RegisterSerializer, UserSerializer, ProfileSerializer, SkillSerializer,
    ProjectSerializer, ProposalSerializer
)
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status

# --- (Permissions classes remain the same) ---
class IsClient(permissions.BasePermission):
    def has_permission(self, request, view):
        # Check if the user has a profile and if that profile is a client
        return request.user and request.user.is_authenticated and hasattr(request.user, 'profile') and request.user.profile.user_type == 'client'

class IsFreelancer(permissions.BasePermission):
    def has_permission(self, request, view):
        # Check if the user has a profile and if that profile is a freelancer
        return request.user and request.user.is_authenticated and hasattr(request.user, 'profile') and request.user.profile.user_type == 'freelancer'


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer


class ProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Profile.objects.filter(user=self.request.user)

class SkillViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Skill.objects.all()
    serializer_class = SkillSerializer
    permission_classes = [permissions.AllowAny]

# --- UPDATED ProjectViewSet ---
class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all().order_by('-created_at')
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    # Add filtering backends
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]

    # Define fields for filtering and searching
    filterset_fields = ['status', 'skills_required']
    search_fields = ['title', 'description']
    ordering_fields = ['budget', 'created_at']


    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            self.permission_classes = [IsClient]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(client=self.request.user)

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated and hasattr(user, 'profile') and user.profile.user_type == 'client':
            return self.queryset.filter(client=user)
        # Freelancers and guests can see all open projects
        return self.queryset.filter(status='open')

# --- UPDATED ProposalViewSet ---
class ProposalViewSet(viewsets.ModelViewSet):
    queryset = Proposal.objects.all()
    serializer_class = ProposalSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action == 'create':
            self.permission_classes = [IsFreelancer]
        elif self.action == 'update_status':
            self.permission_classes = [IsClient]
        return super().get_permissions()

    def perform_create(self, serializer):
        # Automatically set the freelancer to the current user
        serializer.save(freelancer=self.request.user)

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'profile') and user.profile.user_type == 'freelancer':
            # A freelancer can see all proposals they have submitted
            return self.queryset.filter(freelancer=user)
        elif hasattr(user, 'profile') and user.profile.user_type == 'client':
            # A client can see all proposals submitted to their projects
            return self.queryset.filter(project__client=user)
        return Proposal.objects.none()
    
    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        proposal = self.get_object()
        # Check if the user is the client for the project
        if proposal.project.client != request.user:
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        status_val = request.data.get('status')
        if status_val not in ['accepted', 'rejected']:
            return Response({'detail': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)

        proposal.status = status_val
        proposal.save()
        return Response(self.get_serializer(proposal).data)