"""Bounded company application summaries for the existing recruiter dashboard."""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.core.exceptions import PermissionDenied
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied as APIPermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.companies.models import CompanyMembership
from apps.companies.services import authorize_company_operation
from apps.recruiters.api import IsRecruiter
from apps.recruiters.models import RecruiterProfile

from .models import Application


def company_application_overview(company_id, zone, now):
    """Aggregate in SQL; materialize only seven day counts and three recent rows."""
    today = now.astimezone(zone).date()
    dates = [today - timedelta(days=6 - index) for index in range(7)]
    boundaries = [datetime.combine(day, time.min, zone) for day in dates]
    boundaries.append(datetime.combine(today + timedelta(days=1), time.min, zone))
    queryset = Application.objects.filter(job__company_id=company_id)
    metrics = {
        "total": Count("id"),
        "submitted": Count("id", filter=Q(status=Application.Status.SUBMITTED)),
        "reviewing": Count("id", filter=Q(status=Application.Status.REVIEWING)),
    }
    metrics.update(
        {
            f"day_{index}": Count(
                "id", filter=Q(applied_at__gte=start, applied_at__lt=boundaries[index + 1])
            )
            for index, start in enumerate(boundaries[:-1])
        }
    )
    counts = queryset.aggregate(**metrics)
    recent = queryset.order_by("-applied_at", "id").values(
        "id",
        "applied_at",
        "job_id",
        "job__title",
        "candidate__full_name",
        "candidate__professional_headline",
    )[:3]
    return {
        "total": counts["total"],
        "submitted": counts["submitted"],
        "reviewing": counts["reviewing"],
        "days": [
            {"date": day.isoformat(), "count": counts[f"day_{index}"]}
            for index, day in enumerate(dates)
        ],
        "recent": [
            {
                "id": row["id"],
                "applied_at": row["applied_at"],
                "job": {"id": row["job_id"], "title": row["job__title"]},
                "candidate": {
                    "full_name": row["candidate__full_name"],
                    "professional_headline": row["candidate__professional_headline"],
                },
            }
            for row in recent
        ],
    }


class CompanyApplicationOverviewView(APIView):
    permission_classes = (IsAuthenticated, IsRecruiter)

    def get(self, request, company_id):
        actor = get_object_or_404(RecruiterProfile, user=request.user)
        try:
            authorize_company_operation(
                recruiter=actor,
                company_id=company_id,
                allowed_roles=[CompanyMembership.Role.OWNER, CompanyMembership.Role.ADMIN],
            )
        except PermissionDenied as error:
            raise APIPermissionDenied(str(error)) from error
        name = request.query_params.get("time_zone", "UTC")
        try:
            if not name or len(name) > 128:
                raise ValueError
            zone = ZoneInfo(name)
        except (ZoneInfoNotFoundError, ValueError):
            raise serializers.ValidationError({"time_zone": ["Use an IANA time zone."]}) from None
        return Response(
            {"time_zone": name, **company_application_overview(company_id, zone, timezone.now())}
        )
