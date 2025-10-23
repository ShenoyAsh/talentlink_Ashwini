# backend/api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RegisterView, ProfileViewSet, SkillViewSet, ProjectViewSet,
    ProposalViewSet, ContractViewSet, MessageViewSet, ReviewViewSet,
    PortfolioItemViewSet, NotificationViewSet # Added PortfolioItemViewSet, NotificationViewSet
)

router = DefaultRouter()
router.register(r'profiles', ProfileViewSet, basename='profile')
router.register(r'skills', SkillViewSet, basename='skill')
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'proposals', ProposalViewSet, basename='proposal')
router.register(r'contracts', ContractViewSet, basename='contract')
router.register(r'messages', MessageViewSet, basename='message')
router.register(r'reviews', ReviewViewSet, basename='review')
router.register(r'portfolio-items', PortfolioItemViewSet, basename='portfolioitem') # New
router.register(r'notifications', NotificationViewSet, basename='notification') # New


urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('', include(router.urls)),
    # Note: update_status is now handled within the router using @action,
    # so this specific path might not be needed unless you want a different URL structure.
    # The default URL for the action would be /api/proposals/{pk}/update_status/
    # If you keep this path, ensure the view mapping is correct:
    # path('proposals/<int:pk>/update_status/', ProposalViewSet.as_view({'patch': 'update_status'}), name='proposal-update-status'),
]