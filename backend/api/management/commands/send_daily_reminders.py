import datetime
from django.core.management.base import BaseCommand
from django.conf import settings
from django.template.loader import render_to_string
from django.contrib.auth import get_user_model
from api.models import send_notification_email # We reuse the email function from models.py

User = get_user_model()

class Command(BaseCommand):
    help = 'Sends a daily reminder email to all active users to visit the site.'

    def handle(self, *args, **options):
        # Get all active users who have an email address
        users_to_remind = User.objects.filter(is_active=True).exclude(email__exact='')
        
        if not users_to_remind.exists():
            self.stdout.write(self.style.SUCCESS('No active users with emails found to remind.'))
            return

        self.stdout.write(f'Sending daily reminders to {users_to_remind.count()} users...')
        
        subject = "Don't Miss What's New on TalentLink!"
        
        # Get the frontend URL from your settings, or default to localhost
        frontend_url = 'http://localhost:5173'
        if settings.CORS_ALLOWED_ORIGINS:
            frontend_url = settings.CORS_ALLOWED_ORIGINS[0]
        
        sent_count = 0
        failed_count = 0

        for user in users_to_remind:
            context = {
                'username': user.username,
                'frontend_url': frontend_url
            }
            
            try:
                # Render both text and HTML versions of the email
                message_text = render_to_string('emails/daily_reminder.txt', context)
                message_html = render_to_string('emails/daily_reminder.html', context)
                
                # Use the existing email sending function
                send_notification_email(
                    recipient_email=user.email,
                    subject=subject,
                    message_text=message_text,
                    message_html=message_html
                )
                sent_count += 1
            
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'Failed to send reminder to {user.username}: {e}'))
                failed_count += 1
        
        self.stdout.write(self.style.SUCCESS(f'Successfully sent {sent_count} reminders.'))
        if failed_count > 0:
            self.stdout.write(self.style.WARNING(f'Failed to send {failed_count} reminders.'))