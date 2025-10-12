from rest_framework import serializers
from .models import User, Profile, Skill, Project, Proposal, Contract, Message, Review

class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ['id', 'name']

class RegisterSerializer(serializers.ModelSerializer):
    user_type = serializers.CharField(write_only=True, required=True)
    class Meta:
        model = User
        fields = ('username', 'password', 'email', 'user_type')
        extra_kwargs = {'password': {'write_only': True}}
    def create(self, validated_data):
        user_type = validated_data.pop('user_type')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        Profile.objects.create(user=user, user_type=user_type)
        return user

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        # Important: We removed user_type from here, as it lives on the profile
        fields = ('id', 'username', 'email')

class ProfileSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    skills = SkillSerializer(many=True, read_only=True)
    class Meta:
        model = Profile
        fields = ('id', 'user', 'user_type', 'headline', 'bio', 'skills', 'portfolio_link', 'hourly_rate')

class ProjectSerializer(serializers.ModelSerializer):
    client = serializers.StringRelatedField(read_only=True)
    skills_required = SkillSerializer(many=True, read_only=True)
    class Meta:
        model = Project
        fields = '__all__'

# --- UPDATED ProposalSerializer ---
class ProposalSerializer(serializers.ModelSerializer):
    # We want to show the freelancer's username, not just their ID
    freelancer = serializers.StringRelatedField(read_only=True)
    # When listing proposals, we also want to know which project it's for
    project_title = serializers.CharField(source='project.title', read_only=True)

    class Meta:
        model = Proposal
        # We need the 'project' ID when creating a proposal
        fields = ('id', 'project', 'project_title', 'freelancer', 'cover_letter', 'proposed_rate', 'status', 'submitted_at')
        # The freelancer is set automatically, so it's read-only
        read_only_fields = ('freelancer', 'project_title')