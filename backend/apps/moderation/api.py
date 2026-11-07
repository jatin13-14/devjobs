from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.companies.models import Company
from apps.jobs.api import JobPagination, RejectUnknownFieldsMixin
from apps.jobs.models import Job

from .models import ModerationEvent


class IsPlatformAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user.is_authenticated and user.is_active and (user.is_staff or user.is_superuser)
        )


class DecisionInput(RejectUnknownFieldsMixin, serializers.Serializer):
    action = serializers.ChoiceField(choices=["suspend", "reactivate", "hide", "restore"])
    reason = serializers.CharField(max_length=2000, allow_blank=False)


class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModerationEvent
        fields = (
            "id",
            "administrator",
            "target_type",
            "target_id",
            "action",
            "reason",
            "previous_state",
            "new_state",
            "created_at",
        )


def objects(kind):
    if kind == "companies":
        return Company.objects.all()
    if kind == "jobs":
        return Job.objects.select_related("company")
    return User.objects.filter(
        role={"candidates": "candidate", "recruiters": "recruiter"}.get(kind, "")
    )


def representation(obj):
    if isinstance(obj, Company):
        return {
            key: getattr(obj, key)
            for key in ("id", "name", "description", "website", "is_suspended", "created_at")
        }
    if isinstance(obj, Job):
        return {
            **{
                key: getattr(obj, key)
                for key in ("id", "title", "description", "status", "is_hidden", "created_at")
            },
            "company": obj.company.name,
        }
    profile = getattr(obj, "candidate_profile", None) or getattr(obj, "recruiter_profile", None)
    return {
        "id": obj.pk,
        "email": obj.email,
        "role": obj.role,
        "is_active": obj.is_active,
        "name": getattr(profile, "full_name", getattr(profile, "name", "")),
        "created_at": obj.date_joined,
    }


class AdminView(APIView):
    permission_classes = (IsPlatformAdmin,)


class OverviewView(AdminView):
    def get(self, request):
        return Response(
            {
                kind: objects(kind).count()
                for kind in ("companies", "recruiters", "candidates", "jobs")
            }
        )


class CollectionView(AdminView):
    def get(self, request, kind):
        qs = objects(kind)
        search = request.query_params.get("search", "").strip()
        if search:
            field = "name" if kind == "companies" else "title" if kind == "jobs" else "email"
            qs = qs.filter(**{f"{field}__icontains": search})
        state = request.query_params.get("state")
        if state in ("active", "restricted"):
            field = (
                "is_suspended"
                if kind == "companies"
                else "is_hidden"
                if kind == "jobs"
                else "is_active"
            )
            qs = qs.filter(
                **{field: (state == "active") if field == "is_active" else (state == "restricted")}
            )
        if kind == "jobs" and request.query_params.get("status"):
            qs = qs.filter(status=request.query_params["status"])
        pager = JobPagination()
        rows = pager.paginate_queryset(qs.order_by("pk"), request)
        return pager.get_paginated_response([representation(obj) for obj in rows])


class DetailView(AdminView):
    def get(self, request, kind, target_id):
        return Response(representation(get_object_or_404(objects(kind), pk=target_id)))

    @transaction.atomic
    def post(self, request, kind, target_id):
        data = DecisionInput(data=request.data)
        data.is_valid(raise_exception=True)
        action = data.validated_data["action"]
        if action not in (("hide", "restore") if kind == "jobs" else ("suspend", "reactivate")):
            raise serializers.ValidationError({"action": "Action does not apply to this target."})
        if kind == "jobs":
            reference = get_object_or_404(Job, pk=target_id)
            Company.objects.select_for_update().get(pk=reference.company_id)
        obj = get_object_or_404(objects(kind).select_for_update(), pk=target_id)
        if isinstance(obj, User) and (
            obj.pk == request.user.pk or obj.is_staff or obj.is_superuser
        ):
            raise PermissionDenied("Administrator accounts require operational management.")
        field = (
            "is_hidden"
            if kind == "jobs"
            else "is_suspended"
            if kind == "companies"
            else "is_active"
        )
        previous = getattr(obj, field)
        new = action in ("hide", "suspend") if field != "is_active" else action == "reactivate"
        if previous == new:
            raise serializers.ValidationError({"action": "Target is already in this state."})
        setattr(obj, field, new)
        obj.save(update_fields=[field])
        ModerationEvent.objects.create(
            administrator=request.user,
            target_type="users" if isinstance(obj, User) else kind,
            target_id=obj.pk,
            action=action,
            reason=data.validated_data["reason"],
            previous_state=previous,
            new_state=new,
        )
        return Response(representation(obj))


class HistoryView(AdminView):
    def get(self, request):
        qs = ModerationEvent.objects.all()
        for key in ("target_type", "action"):
            if request.query_params.get(key):
                qs = qs.filter(**{key: request.query_params[key]})
        if request.query_params.get("target_id"):
            value = serializers.UUIDField().run_validation(request.query_params["target_id"])
            qs = qs.filter(target_id=value)
        pager = JobPagination()
        return pager.get_paginated_response(
            EventSerializer(pager.paginate_queryset(qs, request), many=True).data
        )
