"""Offline OpenAPI 3.1 semantics and Django API route checks; no database writes.

Run with an isolated interpreter providing openapi-spec-validator and PyYAML.
The backend interpreter is used only to inspect Django routes/serializer fields.
"""

import json
import os
import re
import secrets
import subprocess
from pathlib import Path

import yaml
from openapi_spec_validator import validate

ROOT = Path(__file__).resolve().parents[1]
METHODS = {"get", "post", "put", "patch", "delete"}


def verify(spec, routes):
    validate(spec)
    ids = set()
    documented = set()
    for path, item in spec["paths"].items():
        for method in METHODS & item.keys():
            op = item[method]
            ident = op.get("operationId")
            assert ident and ident not in ids, (
                f"Missing/duplicate operationId: {path} {method}"
            )
            ids.add(ident)
            documented.add((path, method))
            parameters = item.get("parameters", []) + op.get("parameters", [])
            path_params = {p["name"]: p for p in parameters if p["in"] == "path"}
            assert set(re.findall(r"{(.*?)}", path)) == path_params.keys(), path
            assert all(
                p["required"] and p["schema"].get("format") == "uuid"
                for p in path_params.values()
            ), path
            assert "security" in op, f"Implicit authentication: {path} {method}"
            public = path in {
                "/api/v1/health/",
                "/api/v1/ready/",
                "/api/v1/auth/candidate/register/",
                "/api/v1/auth/recruiter/register/",
                "/api/v1/auth/login/",
                "/api/v1/auth/token/",
                "/api/v1/auth/token/refresh/",
            } or (
                method == "get"
                and path
                in {
                    "/api/v1/jobs/",
                    "/api/v1/jobs/{job_id}/",
                    "/api/v1/companies/{company_id}/",
                    "/api/v1/companies/{company_id}/jobs/",
                }
            )
            assert op["security"] == ([] if public else [{"bearerAuth": []}]), path
            for code, response in op["responses"].items():
                if code.startswith("2") and code != "204" and "$ref" not in response:
                    assert response.get("content"), (
                        f"Missing success schema: {path} {method}"
                    )
            if "requestBody" in op:
                assert all(
                    "schema" in media for media in op["requestBody"]["content"].values()
                ), path
    assert documented == routes, (
        f"Route mismatch: undocumented={routes - documented}; stale={documented - routes}"
    )

    def walk(value):
        if isinstance(value, dict):
            assert "nullable" not in value, "Use JSON Schema null types in OpenAPI 3.1"
            if "$ref" in value:
                assert value["$ref"].startswith("#/"), (
                    "External references require separate review"
                )
                target = spec
                for part in value["$ref"][2:].split("/"):
                    target = target[part.replace("~1", "/").replace("~0", "~")]
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)

    walk(spec)
    return len(ids)


if __name__ == "__main__":
    spec = yaml.safe_load((ROOT / "docs/openapi.yaml").read_text())
    env = os.environ | {
        "DJANGO_SETTINGS_MODULE": "config.settings.dev",
        "DJANGO_SECRET_KEY": secrets.token_urlsafe(48),
    }
    code = """
import django, json, re
django.setup()
from config.urls import urlpatterns
from django.urls import URLPattern
from apps.jobs.api import JobSerializer
from apps.applications.api import ApplicationSerializer
from apps.candidates.api import CandidateProfileSerializer
from apps.companies.api import CompanySerializer, MembershipSerializer
from apps.recruiters.api import RecruiterProfileSerializer
rows=[]
for route in urlpatterns:
    if not isinstance(route, URLPattern) or not str(route.pattern).startswith('api/v1/'):
        continue
    path='/' + re.sub(r'<uuid:(.*?)>', r'{\\1}', str(route.pattern))
    view=route.callback.view_class
    for method in ('get','post','put','patch','delete'):
        if hasattr(view, method): rows.append((path,method))
serializers={name: list(cls().fields) for name,cls in [('Job',JobSerializer),('Application',ApplicationSerializer),('CandidateProfile',CandidateProfileSerializer),('Company',CompanySerializer),('CompanyMembership',MembershipSerializer),('RecruiterProfile',RecruiterProfileSerializer)]}
print(json.dumps({'routes':rows,'serializers':serializers}))
"""
    result = subprocess.run(
        [str(ROOT / "backend/.venv/bin/python"), "-c", code],
        cwd=ROOT / "backend",
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    actual = json.loads(result.stdout)
    routes = {tuple(row) for row in actual["routes"]}
    count = verify(spec, routes)
    for name, fields in actual["serializers"].items():
        expected = set(fields) - ({"company_id"} if name == "Job" else set())
        assert set(spec["components"]["schemas"][name]["properties"]) == expected, name
    # Mutation checks ensure contract regressions fail this gate.
    from copy import deepcopy

    mutations = []
    bad = deepcopy(spec)
    bad["paths"]["/ready/"] = bad["paths"].pop("/api/v1/ready/")
    mutations.append(bad)
    bad = deepcopy(spec)
    bad["paths"]["/api/v1/candidates/me/resume/"]["put"]["security"] = []
    mutations.append(bad)
    bad = deepcopy(spec)
    bad["paths"]["/api/v1/health/"]["get"]["operationId"] = bad["paths"][
        "/api/v1/ready/"
    ]["get"]["operationId"]
    mutations.append(bad)
    for bad in mutations:
        try:
            verify(bad, routes)
        except Exception:  # noqa: BLE001, S112 - negative controls must reject any invalid contract
            continue
        raise AssertionError("Invalid contract was accepted")
    print(
        f"PASS: OpenAPI 3.1, {len(spec['paths'])} paths, {count} operations; routes, UUID parameters, authentication, references, success schemas, six serializer field sets; three negative controls"
    )
