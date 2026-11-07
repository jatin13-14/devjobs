from datetime import timedelta

from django.contrib.auth import authenticate
from django.core.cache import cache
from django.db import IntegrityError, connection, transaction
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

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

    def test_role_change_rejects_incompatible_profile_and_partial_update(self):
        from apps.candidates.models import CandidateProfile

        user = User.objects.create_user("candidate@example.test", password="Strong-pass-123")
        CandidateProfile.objects.create(user=user, full_name="Synthetic Candidate")
        user.role = User.Role.RECRUITER
        with self.assertRaisesMessage(ValueError, "conflicts with an attached"):
            user.save()
        user.refresh_from_db()
        self.assertEqual(user.role, User.Role.CANDIDATE)

        partial_user = User.objects.create_user(
            "partial@example.test", password="Strong-pass-123"
        )
        partial_user.role = User.Role.RECRUITER
        with self.assertRaisesMessage(ValueError, "not included in update_fields"):
            partial_user.save(update_fields=["email"])

    def test_database_role_guard_blocks_queryset_bypass(self):
        from apps.candidates.models import CandidateProfile

        user = User.objects.create_user("candidate@example.test", password="Strong-pass-123")
        CandidateProfile.objects.create(user=user, full_name="Synthetic Candidate")
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.filter(pk=user.pk).update(role=User.Role.RECRUITER)
            with connection.cursor() as cursor:
                cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")
        user.refresh_from_db()
        self.assertEqual(user.role, User.Role.CANDIDATE)

    def test_database_role_guard_blocks_bulk_update_bypass(self):
        from apps.candidates.models import CandidateProfile

        user = User.objects.create_user("candidate@example.test", password="Strong-pass-123")
        CandidateProfile.objects.create(user=user, full_name="Synthetic Candidate")
        user.role = User.Role.RECRUITER
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.bulk_update([user], ["role"])
            with connection.cursor() as cursor:
                cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")

    def test_direct_sql_rejects_unknown_role_with_candidate_profile(self):
        from apps.candidates.models import CandidateProfile

        user = User.objects.create_user("candidate@example.test", password="Strong-pass-123")
        CandidateProfile.objects.create(user=user, full_name="Synthetic Candidate")
        with (
            self.assertRaises(IntegrityError),
            transaction.atomic(),
            connection.cursor() as cursor,
        ):
            cursor.execute("UPDATE accounts_user SET role = %s WHERE id = %s", ["unknown", user.pk])

    def test_direct_sql_rejects_unknown_role_with_recruiter_profile(self):
        from apps.recruiters.models import RecruiterProfile

        user = User.objects.create_user(
            "recruiter@example.test", password="Strong-pass-123", role=User.Role.RECRUITER
        )
        RecruiterProfile.objects.create(user=user, name="Synthetic Recruiter")
        with (
            self.assertRaises(IntegrityError),
            transaction.atomic(),
            connection.cursor() as cursor,
        ):
            cursor.execute("UPDATE accounts_user SET role = %s WHERE id = %s", ["unknown", user.pk])

    def test_direct_sql_rejects_unknown_role_without_profile(self):
        user = User.objects.create_user("bare@example.test", password="Strong-pass-123")
        with (
            self.assertRaises(IntegrityError),
            transaction.atomic(),
            connection.cursor() as cursor,
        ):
            cursor.execute("UPDATE accounts_user SET role = %s WHERE id = %s", ["unknown", user.pk])

    def test_supported_roles_and_same_transaction_profile_lifecycle(self):
        from apps.candidates.models import CandidateProfile
        from apps.recruiters.models import RecruiterProfile

        candidate = User.objects.create_user("candidate@example.test", password="Strong-pass-123")
        recruiter = User.objects.create_user(
            "recruiter@example.test", password="Strong-pass-123", role=User.Role.RECRUITER
        )
        admin = User.objects.create_superuser("admin@example.test", password="Strong-pass-123")
        with transaction.atomic():
            CandidateProfile.objects.create(user=candidate, full_name="Candidate")
            RecruiterProfile.objects.create(user=recruiter, name="Recruiter")
            CandidateProfile.objects.filter(user=candidate).delete()
            User.objects.filter(pk=candidate.pk).update(role=User.Role.RECRUITER)
        candidate.refresh_from_db()
        self.assertEqual(candidate.role, User.Role.RECRUITER)
        self.assertEqual(recruiter.role, User.Role.RECRUITER)
        self.assertEqual(admin.role, User.Role.ADMIN)


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
        self.assertEqual(response.data["user"]["email"], "candidate@example.com")
        self.assertEqual(response.data["user"]["role"], "candidate")
        self.assertNotIn("password", response.data["user"])

    def test_refresh_returns_access_token(self):
        User.objects.create_user(email="candidate@example.com", password="Strong-pass-123")
        login = APIClient().post(
            "/api/v1/auth/login/",
            {"email": "candidate@example.com", "password": "Strong-pass-123"},
            format="json",
        )
        refreshed = APIClient().post(
            "/api/v1/auth/token/refresh/", {"refresh": login.data["refresh"]}, format="json"
        )
        self.assertEqual(refreshed.status_code, 200)
        self.assertIn("access", refreshed.data)

    def test_refresh_rejects_invalid_and_expired_tokens(self):
        user = User.objects.create_user(email="candidate@example.test", password="Strong-pass-123")
        expired = RefreshToken.for_user(user)
        expired.set_exp(lifetime=timedelta(seconds=-1))
        client = APIClient()

        invalid_response = client.post(
            "/api/v1/auth/token/refresh/", {"refresh": "not-a-jwt"}, format="json"
        )
        expired_response = client.post(
            "/api/v1/auth/token/refresh/", {"refresh": str(expired)}, format="json"
        )

        self.assertEqual(invalid_response.status_code, 401)
        self.assertEqual(expired_response.status_code, 401)

    def test_refresh_rejects_missing_token(self):
        response = APIClient().post("/api/v1/auth/token/refresh/", {}, format="json")
        self.assertEqual(response.status_code, 400)

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


class RegistrationApiTests(TestCase):
    def test_candidate_registration_canonicalizes_email_hashes_password_and_ignores_role(self):
        response = APIClient().post(
            "/api/v1/auth/candidate/register/",
            {
                "email": " Candidate@Example.COM ",
                "password": "Strong-pass-123",
                "full_name": "Synthetic Candidate",
                "role": "admin",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email="candidate@example.com")
        self.assertEqual(user.role, User.Role.CANDIDATE)
        self.assertTrue(user.check_password("Strong-pass-123"))
        self.assertEqual(user.candidate_profile.full_name, "Synthetic Candidate")
        self.assertEqual(response.data["role"], User.Role.CANDIDATE)
        self.assertNotIn("password", response.data)
        self.assertEqual(User.objects.count(), 1)

    def test_recruiter_registration_creates_recruiter_profile_and_cannot_escalate(self):
        response = APIClient().post(
            "/api/v1/auth/recruiter/register/",
            {
                "email": "recruiter@example.test",
                "password": "Strong-pass-123",
                "name": "Synthetic Recruiter",
                "role": "admin",
                "is_staff": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email="recruiter@example.test")
        self.assertEqual(user.role, User.Role.RECRUITER)
        self.assertFalse(user.is_staff)
        self.assertEqual(user.recruiter_profile.name, "Synthetic Recruiter")

    def test_registration_rejects_invalid_input_and_duplicate_canonical_email(self):
        client = APIClient()
        missing_profile_name = client.post(
            "/api/v1/auth/candidate/register/",
            {"email": "candidate@example.test", "password": "Strong-pass-123"},
            format="json",
        )
        invalid_email = client.post(
            "/api/v1/auth/candidate/register/",
            {
                "email": "not-an-email",
                "password": "Strong-pass-123",
                "full_name": "Synthetic Candidate",
            },
            format="json",
        )
        weak_password = client.post(
            "/api/v1/auth/candidate/register/",
            {"email": "weak@example.test", "password": "123", "full_name": "Synthetic"},
            format="json",
        )
        first = client.post(
            "/api/v1/auth/candidate/register/",
            {
                "email": "duplicate@example.test",
                "password": "Strong-pass-123",
                "full_name": "Synthetic Candidate",
            },
            format="json",
        )
        duplicate = client.post(
            "/api/v1/auth/recruiter/register/",
            {
                "email": " DUPLICATE@EXAMPLE.TEST ",
                "password": "Strong-pass-123",
                "name": "Synthetic Recruiter",
            },
            format="json",
        )
        self.assertEqual(missing_profile_name.status_code, 400)
        self.assertEqual(invalid_email.status_code, 400)
        self.assertEqual(weak_password.status_code, 400)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(duplicate.status_code, 400)
        self.assertIn("email", duplicate.data)
        self.assertEqual(User.objects.count(), 1)
