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

## Browser workflow suite

Install the test-only `@playwright/test` dependency with `npm ci` in `frontend/`, then
`npx --no-install playwright install chromium`. Existing Vitest/jsdom tests do not execute
Playwright specs. No additional runtime dependency is required.

Run `.venv/bin/python run_browser.py` from `backend/` with Docker available.
See [E2E isolation](E2E_ISOLATION.md) for guards, fixture lifecycle and results.
The old `devjobs_test` browser target is disabled. The runner applies migrations, executes Django system/migration checks and the
full backend pytest suite with `--ds=config.settings.e2e` against its verified
disposable cluster before creating browser fixtures. Legacy unit-test settings
remain strict; do not run default pytest against existing local databases.
The browser workflow now uses the runner-owned container rather than a service
with fixed credentials. Local and CI traces are disabled; only synthetic failure
screenshots are uploaded. Existing backend CI remains unchanged.

Frontend CI now gates on `npm audit`. Vitest is pinned to 4.1.12, the earliest
4.x release outside both reported mocker ranges, compatible with current Vite
6.4.5 and Node 24. The project uses no removed pool/coverage/workspace APIs, so
its existing config and 43 tests require no migration changes. Vitest 4 removes
tinypool and vite-node and reuses the secure top-level Vite/esbuild tree.
Use Node 24 in CI and locally. See `RELEASE_REVIEW.md` for the before/after audit.


## Hardened E2E ownership regression (2026-11-11)

The browser runner now holds per-run OS-assigned sockets continuously through
startup and cleanup, with inherited descriptors and signed run/role/PID readiness.
It owns both WSGI and Vite processes; Playwright does not start or reuse a server.
Signals are deferred across Docker creation; exact-label discovery and verified
IDs make cleanup interruption-safe under the tested conditions and idempotent.
Run the pure regression suite with `.venv/bin/python -m unittest
config.test_e2e_safety_unit config.test_e2e_runtime_unit` from backend. Run
`backend/.venv/bin/python backend/run_browser_concurrent.py` from root to execute
two full disposable runs and require cross-run service/cluster/credential rejection.
Both themes for all three roles now assert real rendered styles and reload
persistence, with page/console errors captured. Commands, actual results, ownership
protocol and POSIX/daemon limits are recorded in `docs/E2E_ISOLATION.md`.
