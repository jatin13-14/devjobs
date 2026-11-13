"""Temporary explicit pagination for the three Stage 2A collections."""

from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.jobs.api import JobPagination


def collection_response(request, queryset, serialize):
    """Authorize and scope before calling; serialize only the selected page."""
    if "pagination" not in request.query_params:
        return Response(serialize(queryset))
    if request.query_params["pagination"] != "page":
        raise ValidationError({"pagination": ["Unsupported pagination mode. Use 'page'."]})
    paginator = JobPagination()
    page = paginator.paginate_queryset(queryset, request)
    return paginator.get_paginated_response(serialize(page))
