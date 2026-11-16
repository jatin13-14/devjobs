"""Compatible explicit pagination for the three legacy array collections."""

from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from config.pagination import CollectionPagination


def collection_response(request, queryset, serialize):
    """Authorize and scope before calling; serialize only the selected page."""
    if "pagination" not in request.query_params:
        return Response(serialize(queryset))
    if request.query_params["pagination"] not in ("page", "cursor"):
        raise ValidationError(
            {"pagination": ["Unsupported pagination mode. Use 'page' or 'cursor'."]}
        )
    paginator = CollectionPagination()
    page = paginator.paginate_queryset(queryset, request)
    return paginator.get_paginated_response(serialize(page))
