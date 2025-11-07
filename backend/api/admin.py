
from django.contrib import admin

from .models import (
    Transaction, User, Profile, Skill, Project, Proposal, Contract, Message, Review,
    PortfolioItem, Notification,Milestone, ProjectFile, Payment, Invoice, Wallet
)


admin.site.register(User)
admin.site.register(Profile)
admin.site.register(Skill)
admin.site.register(Project)
admin.site.register(Proposal)
admin.site.register(Contract)
admin.site.register(Message)
admin.site.register(Review)
admin.site.register(PortfolioItem)
admin.site.register(Notification)
admin.site.register(Transaction)
admin.site.register(Milestone)
admin.site.register(ProjectFile)
admin.site.register(Payment)
admin.site.register(Invoice)
admin.site.register(Wallet)
