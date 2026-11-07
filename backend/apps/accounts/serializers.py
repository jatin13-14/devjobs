from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.accounts.models import User
from apps.candidates.models import CandidateProfile
from apps.recruiters.models import RecruiterProfile


class RegistrationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    profile_name_field = ""
    role = ""

    def validate_email(self, value):
        try:
            canonical = User.objects.normalize_email(value)
        except ValueError as error:
            raise serializers.ValidationError(str(error)) from error
        if User.objects.filter(email=canonical).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return canonical

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(list(error.messages)) from error
        return value

    def create(self, validated_data):
        profile_name = validated_data.pop(self.profile_name_field)
        password = validated_data.pop("password")
        try:
            with transaction.atomic():
                user = User.objects.create_user(
                    email=validated_data["email"],
                    password=password,
                    role=self.role,
                )
                if self.role == User.Role.CANDIDATE:
                    CandidateProfile.objects.create(user=user, full_name=profile_name)
                else:
                    RecruiterProfile.objects.create(user=user, name=profile_name)
        except IntegrityError as error:
            # The unique constraint handles two concurrent registrations of one identity.
            if User.objects.filter(email=validated_data["email"]).exists():
                raise serializers.ValidationError(
                    {"email": ["An account with this email already exists."]}
                ) from error
            raise
        return user

    def to_representation(self, instance):
        return SafeUserSerializer(instance).data


class CandidateRegistrationSerializer(RegistrationSerializer):
    full_name = serializers.CharField(max_length=160, allow_blank=False)
    profile_name_field = "full_name"
    role = User.Role.CANDIDATE


class RecruiterRegistrationSerializer(RegistrationSerializer):
    name = serializers.CharField(max_length=160, allow_blank=False)
    profile_name_field = "name"
    role = User.Role.RECRUITER


class SafeUserSerializer(serializers.ModelSerializer):
    is_platform_admin = serializers.SerializerMethodField()

    def get_is_platform_admin(self, obj):
        return obj.is_active and (obj.is_staff or obj.is_superuser)

    class Meta:
        model = User
        fields = ("id", "email", "role", "is_platform_admin")
        read_only_fields = fields


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        try:
            attrs["email"] = User.objects.normalize_email(attrs["email"])
        except ValueError as error:
            raise serializers.ValidationError({"email": str(error)}) from error
        data = super().validate(attrs)
        data["user"] = SafeUserSerializer(self.user).data
        return data
