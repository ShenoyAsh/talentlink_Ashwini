# backend/api/serializers.py
from rest_framework import serializers
from .models import User, Profile, Skill, Project, Proposal, Contract, Message, Review, PortfolioItem, Notification

# --- SkillSerializer, RegisterSerializer, UserSerializer remain the same ---

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
        fields = ('id', 'username', 'email')

# --- PortfolioItemSerializer remains the same ---
class PortfolioItemSerializer(serializers.ModelSerializer):
    profile = serializers.PrimaryKeyRelatedField(read_only=True)
    class Meta:
        model = PortfolioItem
        fields = ('id', 'profile', 'title', 'description', 'link', 'image', 'created_at')
        read_only_fields = ('profile', 'created_at')


# --- MODIFIED ProfileSerializer ---
class ProfileSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    # Display skills using the SkillSerializer (read-only)
    skills = SkillSerializer(many=True, read_only=True)
    # Accept a list of skill names for writing
    skill_names = serializers.ListField(
        child=serializers.CharField(max_length=100), write_only=True, required=False
    )
    portfolio_items = PortfolioItemSerializer(many=True, read_only=True)
    # Make profile_picture read-only here, handle upload in the view if necessary
    profile_picture = serializers.ImageField(read_only=True)

    class Meta:
        model = Profile
        # Added 'skill_names', removed 'skill_ids'
        fields = ('id', 'user', 'user_type', 'headline', 'bio', 'skills', 'skill_names',
                  'portfolio_link', 'portfolio_items',
                  'hourly_rate', 'country', 'timezone', 'profile_picture')
        # Note: profile_picture removed from writable fields here

    def update(self, instance, validated_data):
        skill_names = validated_data.pop('skill_names', None)

        # Standard update for other fields
        instance = super().update(instance, validated_data)

        # Handle skills: Get or create Skill objects from names
        if skill_names is not None: # Check if skill_names was provided
            skill_objects = []
            for name in skill_names:
                skill, created = Skill.objects.get_or_create(name__iexact=name.strip(), defaults={'name': name.strip()})
                skill_objects.append(skill)
            instance.skills.set(skill_objects) # Use set() to replace existing skills

        return instance
# --- End MODIFIED ProfileSerializer ---

# --- ProjectSerializer: Accept skill_ids (no change needed here for profile skills) ---
class ProjectSerializer(serializers.ModelSerializer):
    client = serializers.StringRelatedField(read_only=True)
    skills_required = SkillSerializer(many=True, read_only=True)
    skill_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, queryset=Skill.objects.all(), source='skills_required', required=False # Make optional
    )
    class Meta:
        model = Project
        fields = '__all__'
        read_only_fields = ('client', 'created_at', 'updated_at')

# --- ProposalSerializer, ContractSerializer, MessageSerializer, ReviewSerializer, NotificationSerializer remain the same ---
class ProposalSerializer(serializers.ModelSerializer):
    freelancer = serializers.StringRelatedField(read_only=True)
    project_title = serializers.CharField(source='project.title', read_only=True)

    class Meta:
        model = Proposal
        fields = ('id', 'project', 'project_title', 'freelancer', 'cover_letter', 'proposed_rate', 'status', 'submitted_at', 'time_available', 'additional_info')
        read_only_fields = ('freelancer', 'project_title', 'submitted_at', 'status')

class ContractSerializer(serializers.ModelSerializer):
    project = ProjectSerializer(read_only=True)
    freelancer = UserSerializer(read_only=True)

    class Meta:
        model = Contract
        fields = '__all__'

class MessageSerializer(serializers.ModelSerializer):
    sender = serializers.StringRelatedField(read_only=True)
    receiver_username = serializers.CharField(write_only=True, required=False)
    receiver = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Message
        fields = ('id', 'sender', 'receiver', 'receiver_username', 'content', 'timestamp')
        read_only_fields = ('sender', 'timestamp', 'receiver')


class ReviewSerializer(serializers.ModelSerializer):
    reviewer = serializers.StringRelatedField(read_only=True)
    reviewee = serializers.StringRelatedField(read_only=True)
    project_title = serializers.CharField(source='project.title', read_only=True)

    class Meta:
        model = Review
        fields = ('id', 'project', 'project_title', 'reviewer', 'reviewee', 'rating', 'comment', 'created_at')
        read_only_fields = ('reviewer', 'reviewee', 'created_at', 'project_title')

class NotificationSerializer(serializers.ModelSerializer):
    recipient = serializers.StringRelatedField(read_only=True)
    project_id = serializers.PrimaryKeyRelatedField(source='project', read_only=True, allow_null=True) # Allow null
    proposal_id = serializers.PrimaryKeyRelatedField(source='proposal', read_only=True, allow_null=True) # Allow null
    message_id = serializers.PrimaryKeyRelatedField(source='related_message', read_only=True, allow_null=True) # Allow null

    class Meta:
        model = Notification
        fields = ('id', 'recipient', 'message', 'read', 'timestamp',
                  'project_id', 'proposal_id', 'message_id')
        read_only_fields = ('recipient', 'message', 'timestamp',
                            'project_id', 'proposal_id', 'message_id')