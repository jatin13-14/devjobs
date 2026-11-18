import uuid

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Func, Value
from django.db.models.functions import Lower

# Python str.strip()'s ASCII whitespace set, mirrored by PostgreSQL TRIM(..., chars).
EMAIL_SURROUNDING_WHITESPACE = " \t\n\r\f\v"


def canonical_email_expression():
    return Lower(EmailTrim("email", Value(EMAIL_SURROUNDING_WHITESPACE)))


class EmailTrim(Func):
    function = "BTRIM"

    def as_sqlite(self, compiler, connection, **extra_context):
        return super().as_sql(compiler, connection, function="TRIM", **extra_context)


class UserManager(BaseUserManager):
    use_in_migrations = True

    @classmethod
    def normalize_email(cls, email):
        """Canonicalize MVP email identities as trimmed ASCII lowercase."""
        if not isinstance(email, str):
            return email
        email = email.strip(EMAIL_SURROUNDING_WHITESPACE)
        if not email.isascii():
            raise ValueError("Email addresses must contain ASCII characters only.")
        return email.lower()

    def get_by_natural_key(self, username):
        return self.get(email=self.normalize_email(username))

    def create_user(self, email, password=None, **extra_fields):
        if extra_fields.get("is_staff", False):
            raise ValueError("Normal users cannot have is_staff=True.")
        if extra_fields.get("is_superuser", False):
            raise ValueError("Normal users cannot have is_superuser=True.")
        if extra_fields.get("role") == User.Role.ADMIN:
            raise ValueError("Normal users cannot have the admin role.")
        return self._create_user(email, password, **extra_fields)

    def _create_user(self, email, password=None, **extra_fields):
        email = self.normalize_email(email) if email else email
        if not email:
            raise ValueError("An email address is required.")
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("A superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("A superuser must have is_superuser=True.")
        if extra_fields.get("role", User.Role.ADMIN) != User.Role.ADMIN:
            raise ValueError("A superuser must have the admin role.")
        extra_fields["role"] = User.Role.ADMIN
        return self._create_user(email, password, **extra_fields)


class AccountRole(models.TextChoices):
    CANDIDATE = "candidate", "Candidate"
    RECRUITER = "recruiter", "Recruiter"
    ADMIN = "admin", "Admin"


class User(AbstractUser):
    Role = AccountRole

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = None
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CANDIDATE)
    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ()

    class Meta:
        verbose_name = "user"
        verbose_name_plural = "users"
        constraints = (
            models.CheckConstraint(
                condition=models.Q(role__in=[choice for choice, _label in AccountRole.choices]),
                name="accounts_user_role_supported",
            ),
            models.CheckConstraint(
                condition=models.Q(email__regex=r"^[\x01-\x7F]+$"),
                name="accounts_user_email_ascii",
            ),
            models.CheckConstraint(
                condition=models.Q(email=canonical_email_expression()),
                name="accounts_user_email_canonical",
            ),
            models.UniqueConstraint(
                canonical_email_expression(), name="accounts_user_email_canonical_uniq"
            ),
        )

    def save(self, *args, **kwargs):
        update_fields = kwargs.get("update_fields")
        if self.pk and not self._state.adding:
            previous = type(self)._base_manager.using(kwargs.get("using") or self._state.db).only("role").get(pk=self.pk)
            if previous.role != self.role:
                incompatible = (
                    self.role == self.Role.CANDIDATE
                    and hasattr(self, "recruiter_profile")
                    or self.role == self.Role.RECRUITER
                    and hasattr(self, "candidate_profile")
                    or self.role == self.Role.ADMIN
                    and (hasattr(self, "candidate_profile") or hasattr(self, "recruiter_profile"))
                )
                if incompatible:
                    raise ValueError("Role change conflicts with an attached candidate or recruiter profile.")
                if update_fields is not None and "role" not in update_fields:
                    raise ValueError("Role was modified but is not included in update_fields.")
        if update_fields is not None and "email" not in update_fields and not self._state.adding:
            try:
                persisted_email = (
                    type(self)
                    ._base_manager.using(kwargs.get("using") or self._state.db)
                    .only("email")
                    .get(pk=self.pk)
                    .email
                )
            except type(self).DoesNotExist:
                persisted_email = self.email
            if self.email != persisted_email:
                raise ValueError(
                    "Email was modified but is not included in update_fields; "
                    "save with update_fields including 'email'."
                )
        if isinstance(self.email, str):
            self.email = UserManager.normalize_email(self.email)
        try:
            self.email = self._meta.get_field("email").clean(self.email, self)
        except ValidationError as error:
            raise ValueError("Enter a valid email address.") from error
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.email
