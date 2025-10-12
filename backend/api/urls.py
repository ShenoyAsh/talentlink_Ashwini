from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RegisterView, ProfileViewSet, SkillViewSet, ProjectViewSet, ProposalViewSet

router = DefaultRouter()
router.register(r'profiles', ProfileViewSet, basename='profile')
router.register(r'skills', SkillViewSet, basename='skill')
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'proposals', ProposalViewSet, basename='proposal')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('', include(router.urls)),
]
