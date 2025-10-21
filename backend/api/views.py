from rest_framework import viewsets, permissions, generics
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from .models import User, Profile, Skill, Project, Proposal, Contract, Message, Review
from .serializers import (
    RegisterSerializer, UserSerializer, ProfileSerializer, SkillSerializer,
    ProjectSerializer, ProposalSerializer, ContractSerializer, MessageSerializer, ReviewSerializer
)
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
import datetime
from django.db.models import Q


class IsClient(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and hasattr(request.user, 'profile') and request.user.profile.user_type == 'client'

class IsFreelancer(permissions.BasePermission):
    def has_permission(self, request, view):
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

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
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
        serializer.save(freelancer=self.request.user)

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'profile') and user.profile.user_type == 'freelancer':
            return self.queryset.filter(freelancer=user)
        elif hasattr(user, 'profile') and user.profile.user_type == 'client':
            return self.queryset.filter(project__client=user)
        return Proposal.objects.none()
    
    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        proposal = self.get_object()
        if proposal.project.client != request.user:
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        status_val = request.data.get('status')
        if status_val not in ['accepted', 'rejected']:
            return Response({'detail': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)

        proposal.status = status_val
        proposal.save()
        
        if status_val == 'accepted':
            Contract.objects.create(
                project=proposal.project,
                freelancer=proposal.freelancer,
                agreed_rate=proposal.proposed_rate,
                start_date=datetime.date.today() 
            )
            proposal.project.status = 'in_progress'
            proposal.project.save()

        return Response(self.get_serializer(proposal).data)

class ContractViewSet(viewsets.ModelViewSet):
    queryset = Contract.objects.all()
    serializer_class = ContractSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'profile') and user.profile.user_type == 'freelancer':
            return self.queryset.filter(freelancer=user)
        elif hasattr(user, 'profile') and user.profile.user_type == 'client':
            return self.queryset.filter(project__client=user)
        return Contract.objects.none()

class MessageViewSet(viewsets.ModelViewSet):
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return self.queryset.filter(Q(sender=user) | Q(receiver=user))

    def perform_create(self, serializer):
        receiver_username = self.request.data.get('receiver')
        try:
            receiver = User.objects.get(username=receiver_username)
        except User.DoesNotExist:
            raise serializers.ValidationError("Receiver not found.")
        serializer.save(sender=self.request.user, receiver=receiver)


class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.all()
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return self.queryset.filter(Q(reviewer=user) | Q(reviewee=user))

    def perform_create(self, serializer):
        project_id = self.request.data.get('project')
        project = Project.objects.get(id=project_id)
        if self.request.user.profile.user_type == 'client':
            reviewee = project.proposals.get(status='accepted').freelancer
        else:
            reviewee = project.client
        serializer.save(reviewer=self.request.user, reviewee=reviewee)