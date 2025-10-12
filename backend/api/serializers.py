from rest_framework import serializers
from .models import User, Profile, Skill, Project, Proposal, Contract, Message, Review

class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ['id', 'name']

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'user_type', 'password']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        Profile.objects.create(user=user) # Create a profile for the new user
        return user

class ProfileSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    skills = SkillSerializer(many=True, read_only=True)

    class Meta:
        model = Profile
        fields = '__all__'

class ProjectSerializer(serializers.ModelSerializer):
    client = serializers.StringRelatedField(read_only=True)
    skills_required = SkillSerializer(many=True, read_only=True)
    
    class Meta:
        model = Project
        fields = '__all__'

class ProposalSerializer(serializers.ModelSerializer):
    freelancer = serializers.StringRelatedField(read_only=True)
    project = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Proposal
        fields = '__all__'

class ContractSerializer(serializers.ModelSerializer):
    freelancer = serializers.StringRelatedField(read_only=True)
    project = serializers.StringRelatedField(read_only=True)
    
    class Meta:
        model = Contract
        fields = '__all__'

class MessageSerializer(serializers.ModelSerializer):
    sender = serializers.StringRelatedField(read_only=True)
    receiver = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Message
        fields = '__all__'

class ReviewSerializer(serializers.ModelSerializer):
    reviewer = serializers.StringRelatedField(read_only=True)
    reviewee = serializers.StringRelatedField(read_only=True)
    project = serializers.StringRelatedField(read_only=True)
    
    class Meta:
        model = Review
        fields = '__all__'
