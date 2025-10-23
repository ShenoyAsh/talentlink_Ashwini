# backend/api/serializers.py
from rest_framework import serializers
from .models import User, Profile, Skill, Project, Proposal, Contract, Message, Review, PortfolioItem, Notification # Added PortfolioItem, Notification

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

# New Serializer for Portfolio Items
class PortfolioItemSerializer(serializers.ModelSerializer):
    profile = serializers.PrimaryKeyRelatedField(read_only=True) # Should be set automatically based on logged-in user

    class Meta:
        model = PortfolioItem
        fields = ('id', 'profile', 'title', 'description', 'link', 'image', 'created_at')
        read_only_fields = ('profile', 'created_at')

class ProfileSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    skills = SkillSerializer(many=True, read_only=True)
    skill_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, queryset=Skill.objects.all(), source='skills'
    )
    # Include portfolio items (read-only in the main profile view)
    portfolio_items = PortfolioItemSerializer(many=True, read_only=True)

    class Meta:
        model = Profile
        fields = ('id', 'user', 'user_type', 'headline', 'bio', 'skills', 'skill_ids',
                  'portfolio_link', 'portfolio_items', # Added portfolio_items
                  'hourly_rate', 'country', 'timezone', 'profile_picture')

class ProjectSerializer(serializers.ModelSerializer):
    client = serializers.StringRelatedField(read_only=True)
    skills_required = SkillSerializer(many=True, read_only=True)
    skill_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, queryset=Skill.objects.all(), source='skills_required'
    )
    class Meta:
        model = Project
        fields = '__all__'
        read_only_fields = ('client', 'created_at', 'updated_at') # Ensure client isn't writable here

class ProposalSerializer(serializers.ModelSerializer):
    freelancer = serializers.StringRelatedField(read_only=True)
    project_title = serializers.CharField(source='project.title', read_only=True)

    class Meta:
        model = Proposal
        fields = ('id', 'project', 'project_title', 'freelancer', 'cover_letter', 'proposed_rate', 'status', 'submitted_at', 'time_available', 'additional_info')
        read_only_fields = ('freelancer', 'project_title', 'submitted_at', 'status') # Status is usually changed via specific actions

class ContractSerializer(serializers.ModelSerializer):
    project = ProjectSerializer(read_only=True)
    freelancer = UserSerializer(read_only=True)

    class Meta:
        model = Contract
        fields = '__all__'

class MessageSerializer(serializers.ModelSerializer):
    sender = serializers.StringRelatedField(read_only=True)
    # Allow specifying receiver by username on creation
    receiver_username = serializers.CharField(write_only=True, required=False) # Changed receiver field
    receiver = serializers.StringRelatedField(read_only=True) # Display receiver username

    class Meta:
        model = Message
        fields = ('id', 'sender', 'receiver', 'receiver_username', 'content', 'timestamp') # Added receiver_username
        read_only_fields = ('sender', 'timestamp', 'receiver')


class ReviewSerializer(serializers.ModelSerializer):
    reviewer = serializers.StringRelatedField(read_only=True)
    reviewee = serializers.StringRelatedField(read_only=True)
    project_title = serializers.CharField(source='project.title', read_only=True) # Added project title

    class Meta:
        model = Review
        fields = ('id', 'project', 'project_title', 'reviewer', 'reviewee', 'rating', 'comment', 'created_at') # Added project_title
        read_only_fields = ('reviewer', 'reviewee', 'created_at', 'project_title')


# New Serializer for Notifications
class NotificationSerializer(serializers.ModelSerializer):
    recipient = serializers.StringRelatedField(read_only=True)
    # Optionally include links or details about related objects
    project_id = serializers.PrimaryKeyRelatedField(source='project', read_only=True)
    proposal_id = serializers.PrimaryKeyRelatedField(source='proposal', read_only=True)
    message_id = serializers.PrimaryKeyRelatedField(source='related_message', read_only=True)

    class Meta:
        model = Notification
        fields = ('id', 'recipient', 'message', 'read', 'timestamp',
                  'project_id', 'proposal_id', 'message_id') # Include related object IDs
        read_only_fields = ('recipient', 'message', 'timestamp',
                            'project_id', 'proposal_id', 'message_id') # User can only update 'read' status usually