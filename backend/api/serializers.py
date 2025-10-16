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
    
        fields = ('id', 'username', 'email')

class ProfileSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    skills = SkillSerializer(many=True, read_only=True)
    skill_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, queryset=Skill.objects.all(), source='skills'
    )

    class Meta:
        model = Profile
        fields = ('id', 'user', 'user_type', 'headline', 'bio', 'skills', 'skill_ids', 'portfolio_link', 'hourly_rate', 'country', 'timezone', 'profile_picture')

class ProjectSerializer(serializers.ModelSerializer):
    client = serializers.StringRelatedField(read_only=True)
    skills_required = SkillSerializer(many=True, read_only=True)
    skill_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, queryset=Skill.objects.all(), source='skills_required'
    )
    class Meta:
        model = Project
        fields = '__all__'

# --- UPDATED ProposalSerializer ---
class ProposalSerializer(serializers.ModelSerializer):

    freelancer = serializers.StringRelatedField(read_only=True)
    
    project_title = serializers.CharField(source='project.title', read_only=True)

    class Meta:
        model = Proposal
       
        fields = ('id', 'project', 'project_title', 'freelancer', 'cover_letter', 'proposed_rate', 'status', 'submitted_at', 'time_available', 'additional_info')
       
        read_only_fields = ('freelancer', 'project_title')

class ContractSerializer(serializers.ModelSerializer):
    project = ProjectSerializer(read_only=True)
    freelancer = UserSerializer(read_only=True)

    class Meta:
        model = Contract
        fields = '__all__'

class MessageSerializer(serializers.ModelSerializer):
    sender = serializers.StringRelatedField(read_only=True)
    receiver = serializers.StringRelatedField()

    class Meta:
        model = Message
        fields = ('id', 'sender', 'receiver', 'content', 'timestamp')
        read_only_fields = ('sender', 'timestamp')


class ReviewSerializer(serializers.ModelSerializer):
    reviewer = serializers.StringRelatedField(read_only=True)
    reviewee = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Review
        fields = ('id', 'project', 'reviewer', 'reviewee', 'rating', 'comment', 'created_at')
        read_only_fields = ('reviewer', 'reviewee', 'created_at')