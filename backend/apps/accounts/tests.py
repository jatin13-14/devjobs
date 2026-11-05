from django.test import TestCase
from .models import User

class UserModelTests(TestCase):
    def test_user_uses_email_as_login_identifier(self):
        user = User.objects.create_user(email='candidate@example.com', password='Strong-pass-123')
        self.assertEqual(user.USERNAME_FIELD, 'email')
        self.assertEqual(str(user), 'candidate@example.com')
        self.assertEqual(user.role, User.Role.CANDIDATE)

    def test_email_is_unique(self):
        User.objects.create_user(email='same@example.com', password='Strong-pass-123')
        with self.assertRaises(Exception):
            User.objects.create_user(email='same@example.com', password='Strong-pass-123')
