# backend/api/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings
from django.db.models.signals import post_save, pre_save # Import signals
from django.dispatch import receiver # Import receiver decorator
from django.dispatch import receiver # Import receiver decorator
import django.utils.timezone
from django.core.mail import send_mail # Import Django's email function
from django.template.loader import render_to_string

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
        ('active', 'Active'),
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
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    deadline = models.DateField(null=True, blank=True, help_text="Project completion deadline")
    reminder_sent = models.BooleanField(default=False, help_text="Whether reminder has been sent")
    view_count = models.IntegerField(default=0, help_text="Number of times project has been viewed")
    image = models.ImageField(upload_to='project_images/', blank=True, null=True)
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
    rating = models.IntegerField(null=True, blank=True, choices=[(i, i) for i in range(1, 6)], help_text="Client rating for this proposal (1-5)")
    # Store the previous status to detect changes
    _original_status = None

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._original_status = self.status

    def __str__(self):
        return f"Proposal for {self.project.title} by {self.freelancer.username}"

class Contract(models.Model):
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    )
    project = models.OneToOneField(Project, on_delete=models.CASCADE)
    freelancer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    agreed_rate = models.DecimalField(max_digits=10, decimal_places=2)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    is_completed = models.BooleanField(default=False)
    reminder_sent = models.BooleanField(default=False)

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


# --- Utility function to send email (placeholder) ---
def send_notification_email(recipient_email, subject, message_text, message_html=None):
    """Sends an email notification."""
    if not recipient_email:
        print(f"Skipping email for notification '{subject}': Recipient has no email address.")
        return
    try:
        send_mail(
            subject=subject,
            message=message_text, # Plain text version
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient_email],
            html_message=message_html, # Optional HTML version
            fail_silently=False, # Set to True in production if you don't want errors to stop execution
        )
        print(f"Email notification '{subject}' sent/printed for {recipient_email}")
    except Exception as e:
        # Log the error in a real application
        print(f"Error sending email notification '{subject}' to {recipient_email}: {e}")

# --- Signals for Notifications ---

# Use pre_save to capture the state *before* saving
@receiver(pre_save, sender=Proposal)
def capture_proposal_original_status(sender, instance, **kwargs):
    # ... (this function remains the same) ...
    try:
        if instance.pk:
            original_instance = sender.objects.get(pk=instance.pk)
            instance._original_status = original_instance.status
        else:
            instance._original_status = 'pending' # Default for new proposals
    except sender.DoesNotExist:
        instance._original_status = 'pending'


@receiver(post_save, sender=Proposal)
def create_proposal_status_notification(sender, instance, created, **kwargs):
    recipient = None
    subject = ""
    message = ""
    send_email_flag = False

    # Check if the status has changed from its original state before saving
    if not created and instance.status != instance._original_status:
        recipient = instance.freelancer
        project_title = instance.project.title
        if instance.status == 'accepted':
            subject = f"Proposal Accepted: {project_title}"
            message = f"Congratulations! Your proposal for the project '{project_title}' has been accepted."
            send_email_flag = True
        elif instance.status == 'rejected':
            subject = f"Proposal Update: {project_title}"
            message = f"Regarding your proposal for '{project_title}', the client has chosen another direction. Thank you for your interest."
            send_email_flag = True

    # Notify the client when a *new* proposal is submitted
    elif created:
         recipient = instance.project.client
         project_title = instance.project.title
         freelancer_name = instance.freelancer.username
         subject = f"New Proposal Received: {project_title}"
         message = f"You have received a new proposal from {freelancer_name} for your project '{project_title}'. Please review it in your dashboard."
         send_email_flag = True

    if send_email_flag and recipient:
        # Create the in-app notification (existing logic)
        Notification.objects.create(
            recipient=recipient,
            message=message,
            project=instance.project,
            proposal=instance
        )
        # Also send the email notification
        send_notification_email(
            recipient_email=recipient.email,
            subject=subject,
            message_text=message # Use the same message for plain text email
            # message_html=render_to_string('emails/notification_template.html', {'message': message}) # Optional: use a template
        )


@receiver(post_save, sender=Message)
def create_message_notification(sender, instance, created, **kwargs):
    if created:
        recipient = instance.receiver
        sender_name = instance.sender.username
        subject = f"New Message from {sender_name}"
        message = f"You have received a new message from {sender_name}. Check your messages."

        # Create the in-app notification (existing logic)
        Notification.objects.create(
            recipient=recipient,
            message=message,
            related_message=instance # Link the notification to the message
        )
        # Also send the email notification
        send_notification_email(
            recipient_email=recipient.email,
            subject=subject,
            message_text=message
            # message_html=render_to_string(...) # Optional HTML version
        )


# --- New Models for Additional Features ---

class SavedProject(models.Model):
    """Model for users to save/bookmark projects for later."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='saved_projects')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='saved_by_users')
    saved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'project')  # Prevent duplicate saves
        ordering = ['-saved_at']

    def __str__(self):
        return f"{self.user.username} saved {self.project.title}"


class ActivityLog(models.Model):
    """Model for tracking user activities across the platform."""
    ACTION_CHOICES = (
        ('project_created', 'Project Created'),
        ('proposal_submitted', 'Proposal Submitted'),
        ('proposal_accepted', 'Proposal Accepted'),
        ('proposal_rejected', 'Proposal Rejected'),
        ('contract_created', 'Contract Created'),
        ('review_submitted', 'Review Submitted'),
        ('message_sent', 'Message Sent'),
        ('profile_updated', 'Profile Updated'),
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='activities')
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    description = models.TextField()
    related_project = models.ForeignKey(Project, on_delete=models.CASCADE, null=True, blank=True, related_name='activities')
    related_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='related_activities')
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.user.username} - {self.get_action_display()}"


class ProjectAnalytics(models.Model):
    """Model for tracking detailed project analytics."""
    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name='analytics')
    total_views = models.IntegerField(default=0)
    unique_views = models.IntegerField(default=0)
    proposals_count = models.IntegerField(default=0)
    saved_count = models.IntegerField(default=0)
    last_viewed = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Analytics for {self.project.title}"


class AchievementBadge(models.Model):
    """Model for user achievement badges and verification."""
    BADGE_TYPES = (
        ('verified', 'Verified Account'),
        ('top_freelancer', 'Top Freelancer'),
        ('top_client', 'Top Client'),
        ('first_project', 'First Project'),
        ('first_proposal', 'First Proposal'),
        ('completed_5', 'Completed 5 Projects'),
        ('completed_10', 'Completed 10 Projects'),
        ('excellent_review', 'Excellent Reviews'),
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='badges')
    badge_type = models.CharField(max_length=50, choices=BADGE_TYPES)
    earned_at = models.DateTimeField(auto_now_add=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ('user', 'badge_type')  # Prevent duplicate badges
        ordering = ['-earned_at']

    def __str__(self):
        return f"{self.user.username} - {self.get_badge_type_display()}"


# --- Additional Professional Features ---

class Milestone(models.Model):
    """Model for project milestones."""
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('approved', 'Approved'),
    )
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='milestones')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="Amount for this milestone")
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.title} - {self.project.title}"


class ProjectFile(models.Model):
    """Model for file attachments to projects and proposals."""
    FILE_TYPE_CHOICES = (
        ('project_attachment', 'Project Attachment'),
        ('proposal_attachment', 'Proposal Attachment'),
        ('deliverable', 'Deliverable'),
        ('contract_document', 'Contract Document'),
    )
    project = models.ForeignKey(Project, on_delete=models.CASCADE, null=True, blank=True, related_name='files')
    proposal = models.ForeignKey(Proposal, on_delete=models.CASCADE, null=True, blank=True, related_name='files')
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='uploaded_files')
    file = models.FileField(upload_to='project_files/')
    file_type = models.CharField(max_length=50, choices=FILE_TYPE_CHOICES, default='project_attachment')
    description = models.TextField(blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.file.name} - {self.uploaded_by.username}"


class Payment(models.Model):
    """Model for payment transactions."""
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    )
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='payments')
    milestone = models.ForeignKey(Milestone, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    from_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_payments')
    to_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    transaction_id = models.CharField(max_length=255, blank=True, null=True)
    payment_method = models.CharField(max_length=50, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Payment of ₹{self.amount} - {self.project.title}"


class Invoice(models.Model):
    """Model for invoices."""
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
        ('cancelled', 'Cancelled'),
    )
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='invoices')
    milestone = models.ForeignKey(Milestone, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    freelancer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='invoices')
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_invoices')
    invoice_number = models.CharField(max_length=50, unique=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    due_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            # Generate invoice number
            from django.utils import timezone
            self.invoice_number = f"INV-{timezone.now().strftime('%Y%m%d')}-{self.id or '0000'}"
        if not self.total_amount:
            self.total_amount = self.amount + (self.amount * self.tax_rate / 100)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Invoice {self.invoice_number} - ₹{self.total_amount}"


class Wallet(models.Model):
    """Model for user wallet/balance."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='wallet')
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Wallet - {self.user.username}: ₹{self.balance}"


class Transaction(models.Model):
    """Model for wallet transactions."""
    TRANSACTION_TYPE_CHOICES = (
        ('deposit', 'Deposit'),
        ('withdrawal', 'Withdrawal'),
        ('payment', 'Payment'),
        ('refund', 'Refund'),
        ('commission', 'Commission'),
    )
    wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPE_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True, null=True)
    related_payment = models.ForeignKey(Payment, on_delete=models.CASCADE, null=True, blank=True, related_name='transactions')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_transaction_type_display()} - ₹{self.amount}"