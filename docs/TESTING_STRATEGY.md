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

From `backend/`, with `DATABASE_URL` supplied securely for the existing dedicated
`devjobs_test` database at `127.0.0.1:5433`, run `.venv/bin/python run_browser.py`.
The runner refuses any server other than PostgreSQL 17.5, generates an administrator
password in memory, and starts its API on port 8011 and Vite on port 5174. It applies pending migrations to this dedicated database and never resets it. Both ports must be free. Never point it at production.

Each run uses UUID-tagged synthetic `example.test` identities. Synthetic records are
retained for diagnosis; the temporary administrator is disabled and its password made
unusable when the runner exits. Private resume files use a temporary directory removed
on exit. No existing records are deleted. Do not publish ignored browser reports/traces:
they can contain synthetic session credentials. The suite covers registration/login,
profile/skills persistence, resume upload/download, company/membership creation, draft
creation/publishing, discovery/apply/withdraw, recruiter review/private access revocation,
admin suspension, cross-role routing, persistence and logout. One sequential scenario
shares only its own synthetic records across isolated browser contexts.

## Release CI and dependency hardening (2026-11-07)

Backend and Chromium GitHub Actions jobs each provision their own disposable
`postgres:17.5` service. `PGPORT: 5433` configures PostgreSQL's server default;
`5433:5433` publishes that same port. Health checks explicitly probe TCP port 5433.
A host mapping `5433:5432` would fail `inet_server_port()` identity verification.
Both harnesses share the exact 17.5 version/port/database guard, allowing only a
packaging suffix after the version (for example `17.5 (Debian ...)`). The URL guard
still requires `127.0.0.1:5433/devjobs_test`; pytest retains its separate
`test_devjobs_test`. Regression tests reject 5432, different patch/major versions,
other databases and the wrong pytest database name. Local services are never
reconfigured or reset.

The browser job installs Python requirements, `npm ci`, and
`npx --no-install playwright install --with-deps chromium`, then runs
`python run_browser.py` from backend. The runner now uses its current Python
interpreter, supporting both local virtualenvs and Actions setup-python. Database
service health, bounded API HTTP polling and Playwright webServer URL polling
check startup; no fixed startup sleep is used. Poll retries have a short backoff.
Each CI job has a fresh database; each browser run also uses UUID synthetic
identities and temporary private file storage. The administrator password and
Django key are generated at runtime; no repository/environment secrets are needed.
Only failure PNG screenshots of synthetic UI state are uploaded (three-day
retention); CI disables traces and never uploads HTML reports, database contents,
network logs or environment files. Local traces remain private/ignored.

Frontend CI now gates on `npm audit`. Vitest is pinned to 4.1.12, the earliest
4.x release outside both reported mocker ranges, compatible with current Vite
6.4.5 and Node 24. The project uses no removed pool/coverage/workspace APIs, so
its existing config and 43 tests require no migration changes. Vitest 4 removes
tinypool and vite-node and reuses the secure top-level Vite/esbuild tree.
Use Node 24 in CI and locally. See `RELEASE_REVIEW.md` for the before/after audit.
