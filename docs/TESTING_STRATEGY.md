# Testing strategy

## Quality gates
A feature is not complete until its relevant checks pass and results are recorded.

## Frontend
- Unit tests for utilities and non-trivial hooks.
- Component tests for form validation, loading, empty, error and interaction states.
- Integration tests for key user journeys.
- Accessibility checks for labels, focus and keyboard interaction.
- Production build and lint checks.

## Backend
- Model and constraint tests.
- Serializer validation tests.
- Permission and object-ownership tests.
- API tests for success, validation errors, unauthorized and forbidden access.
- Service tests for multi-model business workflows.
- Migration checks and database-backed tests using PostgreSQL in CI.

## Critical end-to-end journeys
1. Candidate registers, signs in and updates profile.
2. Recruiter creates company and publishes a job.
3. Candidate finds job using filters and applies.
4. Candidate cannot apply twice to the same job.
5. Candidate cannot read another candidate's application or resume.
6. Recruiter cannot view applicants for another company's job.
7. Authorized recruiter updates application status and history is recorded.
8. Admin moderates a job and the public listing reflects the result.

## Security regression tests
- IDOR/object-level authorization.
- Role escalation.
- Resume upload validation and private access.
- Authentication expiration and refresh.
- Input validation and unsafe HTML handling.
- Rate limits on sensitive actions.

## CI checks
Run formatter/linter, frontend tests/build, backend tests, migration consistency and dependency/security checks as configured. CI must report actual results; do not suppress failing checks to get a green build.
