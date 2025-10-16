from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RegisterView, ProfileViewSet, SkillViewSet, ProjectViewSet, ProposalViewSet, ContractViewSet, MessageViewSet, ReviewViewSet

router = DefaultRouter()
router.register(r'profiles', ProfileViewSet, basename='profile')
router.register(r'skills', SkillViewSet, basename='skill')
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'proposals', ProposalViewSet, basename='proposal')
router.register(r'contracts', ContractViewSet, basename='contract')
router.register(r'messages', MessageViewSet, basename='message')
router.register(r'reviews', ReviewViewSet, basename='review')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('', include(router.urls)),
    path('proposals/<int:pk>/update_status/', ProposalViewSet.as_view({'patch': 'update_status'}), name='proposal-update-status'),
]