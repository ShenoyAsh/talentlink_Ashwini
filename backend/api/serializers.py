# backend/api/serializers.py
from rest_framework import serializers
# Make sure to import models correctly
from .models import (
    User, Profile, Skill, Project, Proposal, Contract, Message, Review,
    PortfolioItem, Notification
)
# Import the function to get the currently active User model
from django.contrib.auth import get_user_model

# Get the User model defined in settings (likely 'api.User')
User = get_user_model()


class SkillSerializer(serializers.ModelSerializer):
    """ Serializer for Skill model. """
    class Meta:
        model = Skill
        fields = ['id', 'name']

class RegisterSerializer(serializers.ModelSerializer):
    """ Serializer for user registration. """
    user_type = serializers.CharField(write_only=True, required=True, help_text="User type ('freelancer' or 'client')")

    class Meta:
        model = User
        fields = ('username', 'password', 'email', 'user_type')
        extra_kwargs = {
            'password': {'write_only': True, 'style': {'input_type': 'password'}},
            'email': {'required': True} # Ensure email is required
        }

    def validate_user_type(self, value):
        """ Ensure user_type is valid. """
        if value not in ['freelancer', 'client']:
            raise serializers.ValidationError("User type must be either 'freelancer' or 'client'.")
        return value

    def create(self, validated_data):
        user_type = validated_data.pop('user_type')
        # Use create_user to handle password hashing
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        # Create the associated profile
        Profile.objects.create(user=user, user_type=user_type)
        return user

class UserSerializer(serializers.ModelSerializer):
    """ Basic serializer for User model display. """
    class Meta:
        model = User
        fields = ('id', 'username', 'email') # Only include fields safe for general display

class PortfolioItemSerializer(serializers.ModelSerializer):
    """ Serializer for PortfolioItem model. """
    profile = serializers.PrimaryKeyRelatedField(read_only=True)
    image = serializers.ImageField(required=False, allow_null=True, use_url=True) # Ensure URL is used

    class Meta:
        model = PortfolioItem
        fields = ('id', 'profile', 'title', 'description', 'link', 'image', 'created_at')
        read_only_fields = ('profile', 'created_at')


class ProfileSerializer(serializers.ModelSerializer):
    """ Serializer for the Profile model. """
    user = serializers.StringRelatedField(read_only=True)
    skills = SkillSerializer(many=True, read_only=True)
    # Allows updating skills by providing a list of skill names
    skill_names = serializers.ListField(
        child=serializers.CharField(max_length=100), write_only=True, required=False
    )
    portfolio_items = PortfolioItemSerializer(many=True, read_only=True)
    # Profile picture field for reading (URL). Upload handled in view.
    profile_picture = serializers.ImageField(read_only=True, required=False, allow_null=True, use_url=True)

    class Meta:
        model = Profile
        fields = (
            'id', 'user', 'user_type', 'headline', 'bio', 'skills', 'skill_names',
            'portfolio_link', 'portfolio_items', 'hourly_rate', 'country',
            'timezone', 'profile_picture', 'created_at', 'updated_at'
        )
        # Fields not typically changed via this serializer directly
        read_only_fields = (
            'id', 'user', 'user_type', 'skills', 'portfolio_items', 'profile_picture',
            'created_at', 'updated_at'
         )

    def update(self, instance, validated_data):
        skill_names = validated_data.pop('skill_names', None)

        # Perform the standard update for other fields
        instance = super().update(instance, validated_data)

        # Handle skill updates if 'skill_names' was provided
        if skill_names is not None: # Use `is not None` to allow empty list to clear skills
            skill_objects = []
            for name in skill_names:
                name_stripped = name.strip()
                if name_stripped: # Avoid creating empty skills
                    skill, created = Skill.objects.get_or_create(
                        name__iexact=name_stripped, # Case-insensitive lookup
                        defaults={'name': name_stripped} # Use stripped name for creation
                    )
                    skill_objects.append(skill)
            instance.skills.set(skill_objects) # `.set()` handles add/remove automatically

        return instance


class ProjectSerializer(serializers.ModelSerializer):
    """ Serializer for Project model. """
    client = serializers.StringRelatedField(read_only=True)
    skills_required = SkillSerializer(many=True, read_only=True)
    # Allows setting/updating required skills using a list of Skill IDs
    skill_ids = serializers.PrimaryKeyRelatedField(
        queryset=Skill.objects.all(), many=True, write_only=True,
        source='skills_required', required=False # Optional on update/create
    )

    class Meta:
        model = Project
        fields = '__all__' # Include all fields from the model
        read_only_fields = ('id', 'client', 'created_at', 'updated_at', 'status')


class ProposalSerializer(serializers.ModelSerializer):
    """ Serializer for Proposal model. """
    freelancer = serializers.StringRelatedField(read_only=True)
    project_title = serializers.CharField(source='project.title', read_only=True)
    # Allows associating with a project by its ID during creation
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.filter(status='open')) # Only allow proposing on open projects

    class Meta:
        model = Proposal
        fields = (
            'id', 'project', 'project_title', 'freelancer', 'cover_letter',
            'proposed_rate', 'status', 'submitted_at', 'time_available', 'additional_info'
        )
        # Fields determined by the system or read-only context
        read_only_fields = ('id', 'freelancer', 'project_title', 'submitted_at', 'status')


class ContractSerializer(serializers.ModelSerializer):
    """ Read-only serializer for Contract model. """
    project = ProjectSerializer(read_only=True) # Show nested project details
    freelancer = UserSerializer(read_only=True) # Show nested freelancer details

    class Meta:
        model = Contract
        fields = '__all__' # Read all fields


class MessageSerializer(serializers.ModelSerializer):
    """ Serializer for Message model. Handles reading and writing. """
    # Read-only field showing sender's username
    sender = serializers.SlugRelatedField(slug_field='username', read_only=True)
    # Read-only field showing receiver's username
    receiver = serializers.SlugRelatedField(slug_field='username', read_only=True)
    # Write-only field accepting the receiver's username string on create
    receiver_username = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = Message
        fields = ('id', 'sender', 'receiver', 'receiver_username', 'content', 'timestamp')
        read_only_fields = ('id', 'sender', 'receiver', 'timestamp')

    # No custom methods needed if view handles receiver lookup


class ReviewSerializer(serializers.ModelSerializer):
    """ Serializer for Review model. """
    reviewer = serializers.StringRelatedField(read_only=True)
    reviewee = serializers.StringRelatedField(read_only=True)
    project_title = serializers.CharField(source='project.title', read_only=True)
    # Allows associating with a project by its ID during creation
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all())

    class Meta:
        model = Review
        fields = (
            'id', 'project', 'project_title', 'reviewer', 'reviewee',
            'rating', 'comment', 'created_at'
        )
        read_only_fields = ('id', 'reviewer', 'reviewee', 'created_at', 'project_title')

    def validate_rating(self, value):
        """ Ensure rating is within the allowed range. """
        if not 1 <= value <= 5:
            raise serializers.ValidationError("Rating must be between 1 and 5.")
        return value


class NotificationSerializer(serializers.ModelSerializer):
    """ Read-only serializer for Notification model. """
    recipient = serializers.StringRelatedField(read_only=True)
    # Use PrimaryKeyRelatedField for related objects - more efficient
    project = serializers.PrimaryKeyRelatedField(read_only=True)
    proposal = serializers.PrimaryKeyRelatedField(read_only=True)
    related_message = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Notification
        # Ensure field names match the model field names
        fields = (
            'id', 'recipient', 'message', 'read', 'timestamp',
            'project', 'proposal', 'related_message'
        )
        # Notifications are typically created by signals, so most fields are read-only
        read_only_fields = (
            'id', 'recipient', 'message', 'timestamp', 'project',
            'proposal', 'related_message'
            # 'read' status is updated via specific actions in the view
        )