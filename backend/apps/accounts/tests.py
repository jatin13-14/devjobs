from django.contrib.auth import authenticate
from django.core.cache import cache
from django.db import IntegrityError, transaction
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

    def test_direct_model_creation_normalizes_and_validates_email(self):
        user = User(email=" Candidate@Example.COM ")
        user.set_password("Strong-pass-123")
        user.save()
        self.assertEqual(user.email, "candidate@example.com")

        with self.assertRaisesMessage(ValueError, "Enter a valid email address."):
            User(email="not-an-email").save()

        with self.assertRaisesMessage(ValueError, "ASCII characters only"):
            User(email="candidaté@example.com").save()

    def test_ascii_canonicalization_handles_whitespace_and_case(self):
        self.assertEqual(
            User.objects.normalize_email("  Candidate@EXAMPLE.COM  "),
            "candidate@example.com",
        )
        with self.assertRaisesMessage(ValueError, "ASCII characters only"):
            User.objects.normalize_email("İ@example.com")
        with self.assertRaisesMessage(ValueError, "ASCII characters only"):
            User.objects.normalize_email("Straße@example.com")

    def test_model_update_normalizes_email_and_database_rejects_duplicates(self):
        user = User.objects.create_user(email="first@example.com", password="Strong-pass-123")
        user.email = "  SECOND@Example.COM "
        user.save()
        user.refresh_from_db()
        self.assertEqual(user.email, "second@example.com")

        duplicate = User(email=" SECOND@example.com ")
        with self.assertRaises(IntegrityError):
            duplicate.save()

    def test_save_update_fields_email_persists_normalized_value(self):
        user = User.objects.create_user(email="first@example.com", password="Strong-pass-123")
        user.email = "  SECOND@Example.COM "
        user.save(update_fields=["email"])
        user.refresh_from_db()
        self.assertEqual(user.email, "second@example.com")

    def test_save_update_fields_excluding_modified_email_fails_explicitly(self):
        user = User.objects.create_user(email="first@example.com", password="Strong-pass-123")
        user.first_name = "Candidate"
        user.email = "second@example.com"
        with self.assertRaisesMessage(ValueError, "not included in update_fields"):
            user.save(update_fields=["first_name"])
        user.refresh_from_db()
        self.assertEqual(user.email, "first@example.com")
        self.assertEqual(user.first_name, "")

    def test_duplicate_email_reassignment_fails_without_changing_database(self):
        first = User.objects.create_user(email="first@example.com", password="Strong-pass-123")
        User.objects.create_user(email="taken@example.com", password="Strong-pass-123")
        first.email = " TAKEN@EXAMPLE.COM "
        with self.assertRaises(IntegrityError), transaction.atomic():
            first.save()
        first.refresh_from_db()
        self.assertEqual(first.email, "first@example.com")

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
    def setUp(self):
        cache.clear()

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

    def test_token_issuance_is_rate_limited(self):
        client = APIClient()
        payload = {"email": "unknown@example.com", "password": "wrong"}
        statuses = [
            client.post("/api/v1/auth/token/", payload, format="json").status_code for _ in range(6)
        ]
        self.assertEqual(statuses, [401, 401, 401, 401, 401, 429])

    def test_token_endpoint_rejects_non_ascii_email(self):
        response = APIClient().post(
            "/api/v1/auth/token/",
            {"email": "candidaté@example.com", "password": "wrong"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
