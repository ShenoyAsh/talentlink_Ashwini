from rest_framework import viewsets, permissions, generics
from rest_framework.response import Response
from .models import User, Profile, Skill, Project, Proposal, Contract, Message, Review
from .serializers import (
    UserSerializer, ProfileSerializer, SkillSerializer, ProjectSerializer,
    ProposalSerializer, ContractSerializer, MessageSerializer, ReviewSerializer
)

class IsClient(permissions.BasePermission):
    """
    Allows access only to client users.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.user_type == 'client'

class IsFreelancer(permissions.BasePermission):
    """
    Allows access only to freelancer users.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.user_type == 'freelancer'


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = UserSerializer

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

class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            self.permission_classes = [IsClient]
        else:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(client=self.request.user)
    
    def get_queryset(self):
        # Allow clients to see their own projects, freelancers to see all open projects
        user = self.request.user
        if user.user_type == 'client':
            return Project.objects.filter(client=user)
        return Project.objects.filter(status='open')

class ProposalViewSet(viewsets.ModelViewSet):
    queryset = Proposal.objects.all()
    serializer_class = ProposalSerializer

    def get_permissions(self):
        if self.action == 'create':
            self.permission_classes = [IsFreelancer]
        else:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(freelancer=self.request.user)

    def get_queryset(self):
        # Freelancers see their proposals, clients see proposals for their projects
        user = self.request.user
        if user.user_type == 'freelancer':
            return Proposal.objects.filter(freelancer=user)
        elif user.user_type == 'client':
            return Proposal.objects.filter(project__client=user)
        return Proposal.objects.none()

# ... You can create similar ViewSets for Contract, Message, and Review with appropriate permissions ...
