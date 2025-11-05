# backend/api/tests.py
from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from .models import Profile, Project, Proposal, Contract, Skill

User = get_user_model()

class TalentLinkAPITests(APITestCase):

    def setUp(self):
        # 1. Create Users
        self.client_user = User.objects.create_user(username='testclient', email='client@test.com', password='password123')
        self.freelancer_user = User.objects.create_user(username='testfreelancer', email='freelancer@test.com', password='password123')
        
        # 2. Create Profiles (associated via signals, but we'll ensure they exist)
        # Note: Your RegisterSerializer test will handle the signal-based creation.
        # Here we'll create them manually for other tests.
        Profile.objects.filter(user=self.client_user).update(user_type='client')
        Profile.objects.filter(user=self.freelancer_user).update(user_type='freelancer')

        self.client_user.refresh_from_db()
        self.freelancer_user.refresh_from_db()

        # 3. Create a Skill
        self.skill = Skill.objects.create(name='React')

        # 4. Create a Project (as the client)
        self.client.login(username='testclient', password='password123')
        self.project = Project.objects.create(
            client=self.client_user,
            title='Test Project',
            description='A test project.',
            budget=1000.00,
            status='open'
        )
        self.project.skills_required.add(self.skill)
        self.client.logout()

    def get_token(self, username, password):
        """Helper to get auth token."""
        response = self.client.post('/api/token/', {'username': username, 'password': password})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data['access']

    def test_register_user_and_profile_creation(self):
        """Test user registration and automatic profile creation."""
        url = '/api/register/'
        data = {
            'username': 'newfreelancer',
            'email': 'new@test.com',
            'password': 'password123',
            'user_type': 'freelancer'
        }
        response = self.client.post(url, data, format='json')
        
        # Check if user was created
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.count(), 3) # 2 from setUp, 1 new
        
        # Check if profile was created by the signal
        new_user = User.objects.get(username='newfreelancer')
        self.assertTrue(hasattr(new_user, 'profile'))
        self.assertEqual(new_user.profile.user_type, 'freelancer')

    def test_login_user(self):
        """Test user login and token retrieval."""
        token = self.get_token('testclient', 'password123')
        self.assertIsNotNone(token)

    def test_client_cannot_create_proposal(self):
        """Test that a user with 'client' role gets 403 when creating a proposal."""
        token = self.get_token('testclient', 'password123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        
        url = '/api/proposals/'
        data = {
            'project': self.project.id,
            'cover_letter': 'I am a client, this should fail.',
            'proposed_rate': 100
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_freelancer_create_proposal(self):
        """Test that a freelancer can successfully submit a proposal."""
        token = self.get_token('testfreelancer', 'password123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        
        url = '/api/proposals/'
        data = {
            'project': self.project.id,
            'cover_letter': 'I am a freelancer, I can do this.',
            'proposed_rate': 900.00
        }
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Proposal.objects.count(), 1)
        self.assertEqual(Proposal.objects.first().freelancer, self.freelancer_user)

    def test_freelancer_cannot_submit_duplicate_proposal(self):
        """Test that a freelancer cannot submit two proposals for the same project."""
        # Submit first proposal
        token = self.get_token('testfreelancer', 'password123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
        url = '/api/proposals/'
        data = {
            'project': self.project.id,
            'cover_letter': 'First proposal.',
            'proposed_rate': 900.00
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Attempt to submit second proposal
        data['cover_letter'] = 'Second proposal, should fail.'
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['detail'], 'You have already submitted a proposal for this project.')

    def test_client_accept_proposal_flow(self):
        """Test the entire flow: proposal -> accept -> contract created -> project status updated."""
        # 1. Freelancer makes proposal
        freelancer_token = self.get_token('testfreelancer', 'password123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + freelancer_token)
        proposal_data = {
            'project': self.project.id,
            'cover_letter': 'Please hire me!',
            'proposed_rate': 950.00
        }
        response = self.client.post('/api/proposals/', proposal_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        proposal_id = response.data['id']
        
        # 2. Client logs in and accepts the proposal
        client_token = self.get_token('testclient', 'password123')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + client_token)
        
        # Use the custom action URL
        url = f'/api/proposals/{proposal_id}/update-status/'
        data = {'status': 'accepted'}
        response = self.client.patch(url, data, format='json')
        
        # 3. Verify the results
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check proposal status
        proposal = Proposal.objects.get(id=proposal_id)
        self.assertEqual(proposal.status, 'accepted')
        
        # Check project status
        project = Project.objects.get(id=self.project.id)
        self.assertEqual(project.status, 'in_progress')
        
        # Check contract creation
        self.assertTrue(Contract.objects.filter(project=project).exists())
        contract = Contract.objects.get(project=project)
        self.assertEqual(contract.freelancer, self.freelancer_user)
        self.assertEqual(contract.agreed_rate, proposal.proposed_rate)