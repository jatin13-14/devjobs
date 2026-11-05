# API conventions

## Base path
Use `/api/v1/` for versioned application endpoints.

## Naming and methods
- Collection resources are plural nouns.
- `GET` reads; `POST` creates/actions; `PATCH` partial updates; `PUT` full replacement only where needed; `DELETE` removes where product rules permit.
- Use consistent trailing-slash behavior across the API.
- Return appropriate HTTP status codes and stable error shapes.

## Proposed endpoint map
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/auth/register/` | Register |
| POST | `/api/v1/auth/token/` | Obtain JWT |
| POST | `/api/v1/auth/token/refresh/` | Refresh JWT |
| GET/PATCH | `/api/v1/candidates/me/` | Candidate profile |
| GET/PATCH | `/api/v1/recruiters/me/` | Recruiter profile |
| GET/POST | `/api/v1/companies/` | List/create companies |
| GET/PATCH | `/api/v1/companies/{id}/` | Company detail/update |
| GET/POST | `/api/v1/jobs/` | Search/create jobs |
| GET/PATCH | `/api/v1/jobs/{id}/` | Job detail/update |
| POST | `/api/v1/jobs/{id}/publish/` | Publish job |
| POST | `/api/v1/jobs/{id}/close/` | Close job |
| POST | `/api/v1/jobs/{id}/applications/` | Apply |
| GET | `/api/v1/applications/me/` | Candidate's applications |
| GET | `/api/v1/recruiter/jobs/{id}/applications/` | Applicants for owned job |
| PATCH | `/api/v1/applications/{id}/status/` | Recruiter status update |

## List behavior
- Paginate all potentially large collections.
- Document filter names, allowed values and default ordering.
- Validate page size and impose a maximum.
- Return total count and next/previous navigation consistently.

## Error shape
Use one documented error format, for example:
```json
{
  "detail": "Human-readable summary",
  "code": "stable_machine_code",
  "fields": {
    "email": ["Enter a valid email address."]
  }
}
```

## API compatibility
- Avoid breaking response changes within a version.
- Add fields compatibly where possible.
- Breaking changes require a new API version or an explicit migration plan.
- Generate and review an OpenAPI schema once the API is implemented.
