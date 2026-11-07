from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.candidates.models import CandidateProfile, CandidateSkill, Skill


class IsCandidate(BasePermission):
    message = "Candidate account required."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.CANDIDATE)


class RejectUnknownFieldsMixin:
    def to_internal_value(self, data):
        if hasattr(data, "keys"):
            writable = {name for name, field in self.fields.items() if not field.read_only}
            unknown = set(data.keys()) - writable
            if unknown:
                raise serializers.ValidationError({key: ["Unknown field."] for key in sorted(unknown)})
        return super().to_internal_value(data)


class CandidateProfileSerializer(RejectUnknownFieldsMixin, serializers.ModelSerializer):
    class Meta:
        model = CandidateProfile
        fields = (
            "id", "full_name", "professional_headline", "country", "city", "about",
            "years_of_experience", "current_designation", "portfolio_url", "github_url",
            "linkedin_url", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ("id", "name")
        read_only_fields = fields


class SkillInputSerializer(RejectUnknownFieldsMixin, serializers.Serializer):
    name = serializers.CharField(max_length=80, allow_blank=False, trim_whitespace=False)

    def validate_name(self, value):
        normalized = " ".join(value.split()).lower()
        if not normalized:
            raise serializers.ValidationError("This field may not be blank.")
        return normalized


class CandidateProfileView(APIView):
    permission_classes = (IsAuthenticated, IsCandidate)

    def get_profile(self, request):
        return get_object_or_404(CandidateProfile, user=request.user)

    def get(self, request):
        return Response(CandidateProfileSerializer(self.get_profile(request)).data)

    def patch(self, request):
        profile = self.get_profile(request)
        serializer = CandidateProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class CandidateSkillsView(APIView):
    permission_classes = (IsAuthenticated, IsCandidate)

    def get_profile(self, request):
        return get_object_or_404(CandidateProfile, user=request.user)

    def get(self, request):
        skills = Skill.objects.filter(candidate_skills__candidate=self.get_profile(request)).order_by("name")
        return Response(SkillSerializer(skills, many=True).data)

    def post(self, request):
        serializer = SkillInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = self.get_profile(request)
        name = serializer.validated_data["name"]
        try:
            with transaction.atomic():
                skill, _ = Skill.objects.get_or_create(name=name)
                relation, created = CandidateSkill.objects.get_or_create(candidate=profile, skill=skill)
        except IntegrityError:
            # Re-read after a concurrent insert wins the unique candidate/skill constraint.
            skill = Skill.objects.get(name=name)
            relation, created = CandidateSkill.objects.get_or_create(candidate=profile, skill=skill)
        return Response(SkillSerializer(relation.skill).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class CandidateSkillDetailView(APIView):
    permission_classes = (IsAuthenticated, IsCandidate)

    def delete(self, request, skill_id):
        profile = get_object_or_404(CandidateProfile, user=request.user)
        relation = get_object_or_404(CandidateSkill, candidate=profile, skill_id=skill_id)
        relation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
