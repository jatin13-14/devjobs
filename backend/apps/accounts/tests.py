from django.contrib.auth import authenticate
from django.db import IntegrityError
from django.test import TestCase
from rest_framework.test import APIClient

from .models import User


class UserModelTests(TestCase):
    def test_user_uses_email_as_login_identifier_and_hashes_password(self):
        user = User.objects.create_user(email=" Candidate@Example.COM ", password="Strong-pass-123")
        self.assertEqual(user.USERNAME_FIELD, "email")
        self.assertEqual(str(user), "candidate@example.com")
        self.assertEqual(user.role, User.Role.CANDIDATE)
        self.assertNotEqual(user.password, "Strong-pass-123")
        self.assertTrue(user.check_password("Strong-pass-123"))
        self.assertFalse(user.check_password("wrong-password"))

    def test_email_case_variants_are_canonicalized_and_duplicate_rejected(self):
        User.objects.create_user(email="Same@Example.com", password="Strong-pass-123")
        with self.assertRaises(IntegrityError):
            User.objects.create_user(email="same@example.COM", password="Strong-pass-123")

    def test_email_case_variants_authenticate(self):
        user = User.objects.create_user(email="Candidate@Example.com", password="Strong-pass-123")
        self.assertEqual(
            authenticate(email="CANDIDATE@example.COM", password="Strong-pass-123"),
            user,
        )

    def test_empty_email_is_rejected(self):
        with self.assertRaisesMessage(ValueError, "An email address is required."):
            User.objects.create_user(email="  ", password="Strong-pass-123")

    def test_normal_user_creation_rejects_admin_privileges(self):
        for field in ("is_staff", "is_superuser"):
            with self.subTest(field=field), self.assertRaises(ValueError):
                User.objects.create_user(
                    email="candidate@example.com",
                    password="Strong-pass-123",
                    **{field: True},
                )
        with self.assertRaisesMessage(ValueError, "Normal users cannot have the admin role."):
            User.objects.create_user(
                email="candidate@example.com",
                password="Strong-pass-123",
                role=User.Role.ADMIN,
            )

    def test_superuser_has_admin_role_and_django_superuser_flags(self):
        user = User.objects.create_superuser(email="Admin@Example.com", password="Strong-pass-123")
        self.assertEqual(user.role, User.Role.ADMIN)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.is_active)

    def test_superuser_rejects_invalid_builtin_flags_and_product_role(self):
        for field in ("is_staff", "is_superuser"):
            with self.subTest(field=field), self.assertRaises(ValueError):
                User.objects.create_superuser(
                    email="admin@example.com", password="Strong-pass-123", **{field: False}
                )
        with self.assertRaisesMessage(ValueError, "A superuser must have the admin role."):
            User.objects.create_superuser(
                email="admin@example.com", password="Strong-pass-123", role=User.Role.CANDIDATE
            )


class EmailJwtTests(TestCase):
    def test_token_issuance_accepts_differently_cased_email(self):
        User.objects.create_user(email="candidate@example.com", password="Strong-pass-123")
        response = APIClient().post(
            "/api/v1/auth/token/",
            {"email": " CANDIDATE@EXAMPLE.COM ", "password": "Strong-pass-123"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_token_rejects_invalid_credentials_and_missing_email(self):
        User.objects.create_user(email="candidate@example.com", password="Strong-pass-123")
        client = APIClient()
        bad_password = client.post(
            "/api/v1/auth/token/",
            {"email": "candidate@example.com", "password": "wrong"},
            format="json",
        )
        missing_email = client.post(
            "/api/v1/auth/token/", {"password": "Strong-pass-123"}, format="json"
        )
        self.assertEqual(bad_password.status_code, 401)
        self.assertEqual(missing_email.status_code, 400)
