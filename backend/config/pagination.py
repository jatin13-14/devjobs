"""Compatible page numbers and explicit, forward-only keyset traversal."""

from django.core import signing
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import F, Field, Func, Q, Value
from django.db.models.lookups import GreaterThan, LessThan
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.utils.urls import replace_query_param


class CollectionPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
    cursor_ordering = None

    def paginate_queryset(self, queryset, request, view=None):
        self.keyset = request.query_params.get("pagination") == "cursor"
        if not self.keyset:
            return super().paginate_queryset(queryset, request, view)
        self.request = request
        size = self.get_page_size(request)
        ordering = tuple(
            self.cursor_ordering or queryset.query.order_by or queryset.model._meta.ordering
        )
        queryset = queryset.order_by(*ordering)
        scope = {
            "path": request.path,
            "user": str(request.user.pk),
            "query": sorted(
                [key, request.query_params.getlist(key)]
                for key in request.query_params
                if key not in ("cursor", "page_size")
            ),
            "ordering": list(ordering),
        }
        token = request.query_params.get("cursor")
        if "cursor" in request.query_params:
            try:
                if not token or len(token) > 16384:
                    raise ValueError
                payload = signing.loads(token, salt="devjobs.keyset.v1", max_age=86400)
                if payload["scope"] != scope or len(payload["values"]) != len(ordering):
                    raise ValueError
                values = []
                condition = Q()
                prefix = Q()
                for field, raw in zip(ordering, payload["values"], strict=True):
                    name = field.lstrip("-")
                    model = queryset.model
                    for part in name.split("__"):
                        column = model._meta.pk if part == "pk" else model._meta.get_field(part)
                        model = column.related_model
                    value = column.to_python(raw)
                    values.append(value)
                    operator = "lt" if field.startswith("-") else "gt"
                    condition |= prefix & Q(**{f"{name}__{operator}": value})
                    prefix &= Q(**{name: value})
                # Uniform-direction row comparison lets PostgreSQL seek directly
                # into a composite B-tree instead of filtering a deep index prefix.
                if len(ordering) > 1 and len({field.startswith("-") for field in ordering}) == 1:
                    compare = LessThan if ordering[0].startswith("-") else GreaterThan
                    condition = compare(
                        Func(
                            *(F(field.lstrip("-")) for field in ordering),
                            function="ROW",
                            output_field=Field(),
                        ),
                        Func(
                            *(Value(value) for value in values),
                            function="ROW",
                            output_field=Field(),
                        ),
                    )
                queryset = queryset.filter(condition)
            except (
                signing.BadSignature,
                ValueError,
                TypeError,
                KeyError,
                DjangoValidationError,
            ) as error:
                raise ValidationError({"cursor": ["Invalid or expired cursor."]}) from error
        rows = list(queryset[: size + 1])
        self.next_link = None
        if len(rows) > size:
            last = rows[size - 1]
            values = []
            for field in ordering:
                value = last
                for part in field.lstrip("-").split("__"):
                    value = getattr(value, part)
                values.append(str(value))
            token = signing.dumps(
                {"scope": scope, "values": values}, salt="devjobs.keyset.v1", compress=True
            )
            self.next_link = replace_query_param(request.build_absolute_uri(), "cursor", token)
        return rows[:size]

    def get_paginated_response(self, data):
        if not self.keyset:
            return super().get_paginated_response(data)
        return Response({"next": self.next_link, "previous": None, "results": data})
