# backend/api/management/commands/send_reminders.py
import datetime
from django.core.management.base import BaseCommand
from django.conf import settings
from django.template.loader import render_to_string
from django.utils import timezone
from api.models import Project, Contract, send_notification_email

class Command(BaseCommand):
    help = 'Sends project completion reminders to freelancers for projects with approaching deadlines.'

    def handle(self, *args, **options):
        today = datetime.date.today()
        # Send reminders 7 days before, 3 days before, and 1 day before deadline
        reminder_days = [7, 3, 1]
        
        # Find active projects with deadlines approaching
        projects_to_remind = Project.objects.filter(
            status__in=['active', 'in_progress'],
            deadline__isnull=False,
            reminder_sent=False
        ).select_related('client')

        if not projects_to_remind.exists():
            self.stdout.write(self.style.SUCCESS('No reminders to send today.'))
            return

        reminders_sent = 0
        
        for project in projects_to_remind:
            # Skip if deadline has passed
            if project.deadline < today:
                project.reminder_sent = True
                project.save(update_fields=['reminder_sent'])
                continue
            
            # Calculate days until deadline
            days_until_deadline = (project.deadline - today).days
            
            # Check if we should send a reminder today
            if days_until_deadline not in reminder_days:
                continue
            
            # Get the freelancer for this project (from contract)
            try:
                contract = Contract.objects.get(project=project)
                freelancer = contract.freelancer
            except Contract.DoesNotExist:
                # No contract yet, skip
                continue
            
            if not freelancer.email:
                self.stdout.write(self.style.WARNING(f'Skipping {freelancer.username} for "{project.title}" (no email).'))
                continue

            subject = f"Reminder: Project '{project.title}' Deadline Approaching!"
            
            # Context for the email template
            context = {
                'username': freelancer.username,
                'project_title': project.title,
                'project_id': project.id,
                'deadline': project.deadline,
                'days_remaining': days_until_deadline,
                'frontend_url': settings.CORS_ALLOWED_ORIGINS[0] if settings.CORS_ALLOWED_ORIGINS else 'http://localhost:5173'
            }
            
            # Render text and HTML versions
            try:
                message_text = render_to_string('api/emails/project_reminder.txt', context)
                message_html = render_to_string('api/emails/project_reminder.html', context)
            except:
                # Fallback if templates don't exist
                message_text = f"Dear {freelancer.username},\n\nThis is a reminder that your project '{project.title}' has a deadline on {project.deadline}. Please ensure it is completed on time.\n\nDays remaining: {days_until_deadline}\n\nThank you,\nTalentLink Team"
                message_html = None

            try:
                send_notification_email(
                    recipient_email=freelancer.email,
                    subject=subject,
                    message_text=message_text,
                    message_html=message_html
                )
                
                # Mark as sent only if deadline is tomorrow (last reminder)
                if days_until_deadline == 1:
                    project.reminder_sent = True
                    project.save(update_fields=['reminder_sent'])
                
                reminders_sent += 1
                self.stdout.write(self.style.SUCCESS(f'Sent reminder to {freelancer.username} for "{project.title}" ({days_until_deadline} days remaining).'))

            except Exception as e:
                self.stdout.write(self.style.ERROR(f'Failed to send reminder to {freelancer.username} for "{project.title}": {e}'))
        
        self.stdout.write(self.style.SUCCESS(f'Completed: Sent {reminders_sent} reminder(s).'))