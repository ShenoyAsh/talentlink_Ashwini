# backend/api/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings
from django.db.models.signals import post_save, pre_save # Import signals
from django.dispatch import receiver # Import receiver decorator
import django.utils.timezone

# This is a custom User model that extends Django's default.
class User(AbstractUser):
    pass

class Skill(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name

class Profile(models.Model):
    USER_TYPE_CHOICES = (
        ('freelancer', 'Freelancer'),
        ('client', 'Client'),
    )
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    user_type = models.CharField(max_length=10, choices=USER_TYPE_CHOICES, default='freelancer')
    headline = models.CharField(max_length=255, blank=True, null=True)
    bio = models.TextField(blank=True, null=True)
    profile_picture = models.ImageField(upload_to='profile_pics/', blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    timezone = models.CharField(max_length=100, blank=True, null=True)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    skills = models.ManyToManyField(Skill, blank=True)
    portfolio_link = models.URLField(blank=True, null=True) # General portfolio link
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile of {self.user.username}"

# New Model for individual portfolio items
class PortfolioItem(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='portfolio_items')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    link = models.URLField(blank=True, null=True) # Link to live project, github, etc.
    image = models.ImageField(upload_to='portfolio_images/', blank=True, null=True) # Optional image
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} - {self.profile.user.username}"

class Project(models.Model):
    STATUS_CHOICES = (
        ('open', 'Open'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    )
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='projects')
    title = models.CharField(max_length=255)
    description = models.TextField()
    budget = models.DecimalField(max_digits=10, decimal_places=2)
    duration = models.IntegerField(null=True, blank=True, help_text="Duration in days")
    skills_required = models.ManyToManyField(Skill, blank=True)
    time_slot = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class Proposal(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    )
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='proposals')
    freelancer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='proposals')
    cover_letter = models.TextField()
    proposed_rate = models.DecimalField(max_digits=10, decimal_places=2)
    time_available = models.CharField(max_length=100, blank=True, null=True)
    additional_info = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    submitted_at = models.DateTimeField(auto_now_add=True)
    # Store the previous status to detect changes
    _original_status = None

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._original_status = self.status

    def __str__(self):
        return f"Proposal for {self.project.title} by {self.freelancer.username}"

class Contract(models.Model):
    project = models.OneToOneField(Project, on_delete=models.CASCADE)
    freelancer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    agreed_rate = models.DecimalField(max_digits=10, decimal_places=2)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    is_completed = models.BooleanField(default=False)

    def __str__(self):
        return f"Contract for {self.project.title}"

class Message(models.Model):
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_messages')
    receiver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_messages')
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"From {self.sender.username} to {self.receiver.username}"

class Review(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='reviews')
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='given_reviews')
    reviewee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_reviews')
    rating = models.IntegerField(choices=[(i, i) for i in range(1, 6)])
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Review for {self.project.title}"

class Notification(models.Model):
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    message = models.TextField()
    read = models.BooleanField(default=False)
    timestamp = models.DateTimeField(auto_now_add=True) # Changed from default=now
    # Link notification to relevant objects
    project = models.ForeignKey(Project, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    proposal = models.ForeignKey(Proposal, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    # Add message link if needed
    related_message = models.ForeignKey(Message, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"Notification for {self.recipient.username}: {self.message[:30]}"


# --- Signals for Notifications ---

# Use pre_save to capture the state *before* saving
@receiver(pre_save, sender=Proposal)
def capture_proposal_original_status(sender, instance, **kwargs):
    try:
        # Store original status if it's an existing proposal being updated
        if instance.pk:
            original_instance = sender.objects.get(pk=instance.pk)
            instance._original_status = original_instance.status
        else:
            instance._original_status = 'pending' # Default for new proposals
    except sender.DoesNotExist:
        # Handle case where the object might be deleted between check and fetch
        instance._original_status = 'pending'


@receiver(post_save, sender=Proposal)
def create_proposal_status_notification(sender, instance, created, **kwargs):
    # Check if the status has changed from its original state before saving
    if not created and instance.status != instance._original_status:
        if instance.status == 'accepted':
            message = f"Your proposal for '{instance.project.title}' has been accepted!"
            recipient = instance.freelancer
        elif instance.status == 'rejected':
            message = f"Your proposal for '{instance.project.title}' has been rejected."
            recipient = instance.freelancer
        else:
            # Handle other status changes if needed, or ignore
            return

        Notification.objects.create(
            recipient=recipient,
            message=message,
            project=instance.project,
            proposal=instance
        )

    # Optionally, notify the client when a *new* proposal is submitted
    if created:
         message = f"You received a new proposal from {instance.freelancer.username} for your project '{instance.project.title}'."
         Notification.objects.create(
             recipient=instance.project.client,
             message=message,
             project=instance.project,
             proposal=instance
         )


@receiver(post_save, sender=Message)
def create_message_notification(sender, instance, created, **kwargs):
    if created:
        message = f"You have a new message from {instance.sender.username}."
        Notification.objects.create(
            recipient=instance.receiver,
            message=message,
            related_message=instance # Link the notification to the message
        )