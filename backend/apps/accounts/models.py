import uuid

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    @classmethod
    def normalize_email(cls, email):
        """Treat the full email address as case-insensitive and trim whitespace."""
        return email.strip().casefold() if isinstance(email, str) else email

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


class User(AbstractUser):
    class Role(models.TextChoices):
        CANDIDATE = "candidate", "Candidate"
        RECRUITER = "recruiter", "Recruiter"
        ADMIN = "admin", "Admin"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = None
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CANDIDATE)
    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ()

    def __str__(self):
        return self.email
