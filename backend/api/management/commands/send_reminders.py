# backend/api/management/commands/send_reminders.py
import datetime
from django.core.management.base import BaseCommand
from django.conf import settings
from django.template.loader import render_to_string
from api.models import Contract, send_notification_email  # Ensure send_notification_email is imported from models

class Command(BaseCommand):
    help = 'Sends project completion reminders to freelancers for contracts ending soon.'

    def handle(self, *args, **options):
        today = datetime.date.today()
        # Define the reminder threshold (e.g., 3 days before end date)
        reminder_date = today + datetime.timedelta(days=3)

        # Find active contracts ending on the reminder date that haven't had a reminder sent
        contracts_to_remind = Contract.objects.filter(
            is_completed=False,
            end_date=reminder_date,
            reminder_sent=False
        ).select_related('freelancer', 'project')

        if not contracts_to_remind.exists():
            self.stdout.write(self.style.SUCCESS('No reminders to send today.'))
            return

        self.stdout.write(f'Found {contracts_to_remind.count()} contract(s) to remind...')

        for contract in contracts_to_remind:
            freelancer = contract.freelancer
            project = contract.project
            
            if not freelancer.email:
                self.stdout.write(self.style.WARNING(f'Skipping {freelancer.username} for "{project.title}" (no email).'))
                continue

            subject = f"Reminder: Your Project '{project.title}' is Due Soon!"
            
            # Context for the email template
            context = {
                'username': freelancer.username,
                'project_title': project.title,
                'project_id': project.id,
                'end_date': contract.end_date,
                'frontend_url': settings.CORS_ALLOWED_ORIGINS[0] if settings.CORS_ALLOWED_ORIGINS else 'http://localhost:5173' # Use first configured origin
            }
            
            # Render text and HTML versions
            message_text = render_to_string('api/emails/project_reminder.txt', context)
            message_html = render_to_string('api/emails/project_reminder.html', context)

            try:
                send_notification_email(
                    recipient_email=freelancer.email,
                    subject=subject,
                    message_text=message_text,
                    message_html=message_html
                )
                
                # Mark as sent
                contract.reminder_sent = True
                contract.save(update_fields=['reminder_sent'])
                
                self.stdout.write(self.style.SUCCESS(f'Sent reminder to {freelancer.username} for "{project.title}".'))

            except Exception as e:
                self.stdout.write(self.style.ERROR(f'Failed to send reminder to {freelancer.username} for "{project.title}": {e}'))