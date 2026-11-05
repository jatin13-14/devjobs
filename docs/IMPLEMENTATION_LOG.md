# Implementation log

## 2026-11-05 — Initial scaffold generated
- Added React/Vite frontend shell and proposed Ant Design theme.
- Added Django settings split, DRF/JWT configuration and health endpoint.
- Added initial custom email-based user model with candidate/recruiter/admin roles.
- Added starter frontend and backend tests.
- Verification status: generated files have not yet been installed or executed in the user's environment.
- Next: install dependencies, run checks, fix any version/API compatibility issues, then create the first feature branch.

## 2026-11-05 — v0.1.0 initialization and local verification
- Inspected the repository and project guidance; confirmed the React/Vite and Django/DRF scaffold and its declared dependency ranges resolve on Node.js 24.1.0 / npm 11.3.0 and Python 3.14.4 / Django 5.2.19.
- Added an email-based Django user manager because the inherited manager incorrectly required a removed `username` field, and generated the initial accounts migration.
- Required explicit production secret and allowed-host configuration to prevent startup with local fallback settings.
- Enabled loading the ignored root `.env`, added exact macOS setup/startup instructions, and linked them from the README.
- Verification: `npm run lint`, `npm test` (1 test), and `npm run build` passed; Django `manage.py check`, `makemigrations --check --dry-run`, migration application, `python -m pytest` (2 tests), and Ruff passed. The production bundle has a 609.25 kB minified JavaScript chunk warning.
- Dependency audit: `npm audit --omit=dev` reports zero vulnerabilities; full `npm audit` reports 6 development dependency advisories (3 moderate, 1 high, 2 critical). Remediation may require major test/build tooling upgrades and was not applied.
- Limitations at that verification point: backend verification used SQLite fallback, not PostgreSQL; CI had not yet been configured. The subsequent foundation verification entry records the workflow addition.

## 2026-11-05 — foundation verification pass
- Reinstalled dependencies successfully with `npm ci` and `python3 -m venv .venv && .venv/bin/python -m pip install -r requirements/dev.txt`.
- Re-ran frontend lint (pass), Vitest (1 pass), and production build (pass; 609.25 kB minified chunk warning).
- Re-ran Django system checks (pass), `makemigrations --check --dry-run` (pass), local SQLite migration state (no migrations pending), pytest (2 pass), and Ruff (pass). Separately applied the full migration set, including `accounts.0001_initial`, to a fresh in-memory SQLite database (pass).
- Verified a PostgreSQL `DATABASE_URL` is parsed into Django's PostgreSQL backend with the expected host, port, database and user. The local PostgreSQL client is installed, but `pg_isready` found no running server; live PostgreSQL migrations and tests were not run locally.
- Added frontend and backend GitHub Actions workflows. Backend CI uses PostgreSQL 17 and runs Django checks, migration consistency/application, tests, and Ruff. No hosted run has occurred yet.
- Updated README, local setup, environment variable documentation, and project status to report the exact commands and their actual outcomes.

## 2026-11-05 — final foundation verification review
- Reviewed every changed tracked and untracked file present in the working tree (14 modified tracked files and 6 untracked paths), including environment examples, Django model/migration/configuration, setup docs, dependency lockfile, and both workflows. No product features, stack changes, or Git operations were performed.
- Frontend command results from `frontend/`: `npm run lint` passed; `npm test` passed (1 test); `npm run build` passed. Vite 6.4.5 emitted a non-failing advisory because the minified JavaScript chunk is 609.25 kB (500 kB advisory threshold).
- Backend command results from `backend/`: `.venv/bin/python manage.py check` passed with no issues; `.venv/bin/python manage.py makemigrations --check --dry-run` passed with no changes detected; `.venv/bin/python -m pytest` passed (2 tests); `.venv/bin/ruff check .` passed. `DATABASE_URL='sqlite:///:memory:' .venv/bin/python manage.py migrate --noinput` applied the full migration set successfully.
- Local PostgreSQL verification could not run: `pg_isready` returned `/tmp:5432 - no response`. The backend workflow provisions PostgreSQL 17, but no hosted workflow result is available yet, so PostgreSQL CI status is pending rather than passed.
- Workflow review: frontend and backend workflows declare both `push` and `pull_request`, with relevant path filters. Neither restricts branches, therefore both cover pushes to and pull requests targeting `main` when relevant paths change; matching changes on other branches also trigger them. Backend CI provisions PostgreSQL 17 and runs checks, migration consistency/application, tests, and Ruff.
- `git diff --check` passed. A tracked-file pattern scan found no apparent real secrets or credentials. The tracked `.env.example` contains only explicit local placeholders, and `.env` files are ignored.
- Remaining verification: first hosted GitHub Actions run, especially the PostgreSQL-backed backend job. No source fixes were required by this review.

## 2026-11-05 — PostgreSQL and CI verification
- Used the already-running Homebrew PostgreSQL 18.3 service because Docker was unavailable. Created the development-only `devjobs` role (with `CREATEDB` for Django's test database) and `devjobs` database using the local example credentials.
- Against `DATABASE_URL=postgresql://devjobs:devjobs@127.0.0.1:5432/devjobs`, Django selected `django.db.backends.postgresql`; a live query confirmed PostgreSQL 18.3, database/user `devjobs`, and host/port `127.0.0.1:5432`.
- PostgreSQL-backed verification passed: `manage.py check` (no issues), `makemigrations --check --dry-run` (no changes), `migrate --noinput` (all migrations applied), `python -m pytest` (2 passed), and `ruff check .` (all checks passed). Exact environment and commands are in `docs/LOCAL_DEVELOPMENT.md`.
- Queried GitHub Actions on 2026-11-05 for `jatin13-14/devjobs`: the API reported zero registered workflows and zero workflow runs. Local HEAD and `origin/main` are both `db9c9d342b9907ed3ad347b4e9a6bd049b6cd94b`; its tree contains no `.github/workflows` files. The workflow files currently exist only as untracked local files. A commit and push, or a pull request containing the workflows, is needed to trigger the configured jobs. No commit or push was made.

## 2026-11-05 — PR #1 authentication and production security review fixes
- Standardized email identity to a trimmed, case-folded full address at creation, Django authentication lookup, and JWT issuance. Added a data migration that normalizes existing addresses and stops if collisions need manual resolution.
- Superuser creation now assigns the `admin` product role while preserving and validating Django's built-in staff/superuser flags.
- Added focused tests for password hashing, email canonicalization and duplicates, case-insensitive authentication, superuser invariants, JWT issuance, and invalid credentials/input.
- Added configurable production HTTPS redirect, HSTS, and trusted reverse-proxy settings and documented TLS termination, forwarded scheme trust, and safe HSTS rollout.
- Verification outcomes are recorded in `PROJECT_STATUS.md`. No product profile/company/job features were started; no commit, push, approval, or merge was performed.

## 2026-11-05 — PR #1 hosted CI result
- Current PR #1 head: `ae02cd75182da08a7557289a6d26ede194a710d5`.
- Backend GitHub Actions run [42062870540](https://github.com/jatin13-14/devjobs/actions/runs/42062870540) passed; frontend run [42062870578](https://github.com/jatin13-14/devjobs/actions/runs/42062870578) passed. Both runs are for the exact head commit above.
- Earlier entries stating hosted CI was pending or that no commit/push had occurred are retained as records of their earlier snapshots. PR #1 remains unmerged.
