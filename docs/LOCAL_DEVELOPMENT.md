# Local development on macOS

## Requirements

- macOS with [Homebrew](https://brew.sh/) installed.
- Node.js 22 or later and npm. The initial scaffold was verified with Node.js 24.1.0 and npm 11.3.0.
- Python 3.12 or later. Python 3.14.4 was verified with the current Django constraint.
- PostgreSQL 17 for running the app against the intended database.

If needed, install the runtimes and database with Homebrew:

```sh
brew install node python postgresql@17
node --version
npm --version
python3 --version
```

## Install PostgreSQL and create a local database

```sh
brew services start postgresql@17
```

Create a local PostgreSQL role and database using names and a password you choose. Keep the password local; do not put it in a tracked file. For example, `createuser --createdb --pwprompt <your-role>` prompts for a password, and `createdb --owner=<your-role> <your-database>` creates the database.

```sh
read -r -p 'Local PostgreSQL role name: ' PG_ROLE
read -r -p 'Local PostgreSQL database name: ' PG_DATABASE
"$(brew --prefix postgresql@17)/bin/createuser" --createdb --pwprompt "$PG_ROLE"
"$(brew --prefix postgresql@17)/bin/createdb" --owner="$PG_ROLE" "$PG_DATABASE"
```

## Configure local environment

From the repository root:

```sh
cp .env.example .env
cp frontend/.env.example frontend/.env
```

`.env` is ignored by Git. Set `DATABASE_URL` there to your PostgreSQL connection details, using the role, password, host, port, and database you configured. URL-encode reserved characters in the password. The backend loads this root `.env` automatically; the Vite client reads `frontend/.env`.

Generate a unique Django secret key locally, from `backend/` with the virtual environment active, then paste the output into the ignored root `.env` as `DJANGO_SECRET_KEY`:

```sh
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

The backend environment variables are:

| Variable | Purpose | Local example |
|---|---|---|
| `DJANGO_DEBUG` | Enables Django debug mode in development | `true` |
| `DJANGO_SECRET_KEY` | Required Django signing key of at least 32 characters; generate a unique key for each environment | blank in example; generate locally using the command above |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated allowed host names; required by production settings | `localhost,127.0.0.1` |
| `DATABASE_URL` | PostgreSQL connection URL containing your local role, password, host, port, and database | blank in example; set your actual local connection details in `.env` |
| `DJANGO_CACHE_URL` | Production shared Redis URL used by anonymous JWT throttling | unset locally; required in production (`redis://` or `rediss://`) |
| `CORS_ALLOWED_ORIGINS` | Comma-separated browser origins allowed by CORS | `http://localhost:5173` |
| `DJANGO_SECURE_SSL_REDIRECT` | In production, redirect HTTP requests to HTTPS | `false` locally |
| `DJANGO_SECURE_HSTS_SECONDS` | Production HSTS max-age in seconds; start small, then increase after HTTPS is stable | `0` locally |
| `DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS` | Include all subdomains in HSTS; enable only when every subdomain supports HTTPS | `false` |
| `DJANGO_SECURE_HSTS_PRELOAD` | Opt into browser preload lists; requires an intentional long-term HTTPS commitment | `false` |
| `DJANGO_SECURE_PROXY_SSL_HEADER` | Trust `X-Forwarded-Proto: https` from a TLS-terminating proxy | `false` locally |
| `JWT_TOKEN_RATE` | Anonymous JWT token issuance rate limit (DRF rate syntax, scoped to token obtain only) | `5/minute` |
| `DRF_NUM_PROXIES` | Number of trusted reverse proxies in front of Django for DRF client-IP selection | `0` (ignore forwarded IP headers) |

Automated backend tests use `config.settings.test` rather than the local development settings. They require `DATABASE_URL` to point to PostgreSQL 17 at `127.0.0.1:5433`, with original database `devjobs_test`. Tests use the dedicated `test_devjobs_test` database and stop if the configured engine, database, port, or server major version differs. Do not set `DATABASE_URL` to SQLite for tests.

JWT token issuance is throttled per client IP using Django REST Framework's anonymous cache throttle. Development and tests use Django's local-memory cache. Production requires `DJANGO_CACHE_URL` to point to a reachable shared Redis service (`redis://` or `rediss://`); production settings validate the URL at startup; readiness checks service availability. Use the same Redis service and database across all workers and instances. Supply credentials through the deployment secret manager as part of this URL; never put real Redis credentials in tracked example files. The preserved default anonymous JWT issuance rate is `5/minute`, configurable with `JWT_TOKEN_RATE`.

The frontend uses `VITE_API_BASE_URL` from `frontend/.env` (default: `http://localhost:8000/api/v1`). Vite exposes variables prefixed with `VITE_` to browser code; do not put secrets there.

## Production HTTPS and reverse proxy

Production traffic must use HTTPS from the browser to the trusted edge, and the reverse proxy/load balancer must forward requests to Django over a private, trusted connection. Configure the proxy to overwrite (not append or accept from clients) `X-Forwarded-Proto` with the original scheme. Only then set `DJANGO_SECURE_PROXY_SSL_HEADER=true`; otherwise clients could spoof the scheme signal. Set `DJANGO_SECURE_SSL_REDIRECT=true` to enable Django's HTTP-to-HTTPS redirect after the proxy is configured. Ensure the proxy forwards the original host and configure `DJANGO_ALLOWED_HOSTS` accordingly.

For DRF throttling, the proxy must also overwrite or sanitize `X-Forwarded-For`; never trust a value supplied or extended by an arbitrary client, since clients can forge it to evade per-IP limits or make other addresses appear responsible. `DRF_NUM_PROXIES` maps to DRF's `NUM_PROXIES`: `0` (the safe default) ignores forwarded addresses and uses the direct peer address; a positive value tells DRF how many trusted proxy hops exist and selects the client address immediately before those hops in the sanitized `X-Forwarded-For` chain. Set it only to the known proxy count after configuring the edge to replace client-supplied forwarding headers. Do not use a trusted proxy count with direct, untrusted access to Django. The cache must be shared across workers (for example, Redis), or each worker will enforce an independent throttle counter.

After confirming HTTPS works across the whole domain, set `DJANGO_SECURE_HSTS_SECONDS` to a short initial duration and increase it deliberately. Enable `DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS=true` only if all subdomains support HTTPS. Enable `DJANGO_SECURE_HSTS_PRELOAD=true` only when the domain is ready for the browser preload process and its long-lived consequences. HSTS is emitted only over HTTPS by Django. These controls are configurable in production settings and default to redirect on/HSTS zero in production so local HTTP development and tests are unaffected. Secure session and CSRF cookies remain enabled in production.

## Install dependencies

In one terminal, from the repository root:

```sh
cd frontend
npm ci
```

In a second terminal, from the repository root:

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements/dev.txt
```

## Initialize and start the app

In the backend terminal, with the virtual environment active:

```sh
python manage.py migrate
python manage.py runserver
```

In the frontend terminal:

```sh
npm run dev
```

Open <http://localhost:5173>. The API health endpoint is <http://localhost:8000/api/v1/health/>.

## Verification

Frontend, from `frontend/`:

```sh
npm run lint
npm test
npm run build
```

Backend, from `backend/` with `.venv` active:

```sh
python manage.py check
python -m pytest
python manage.py makemigrations --check --dry-run
ruff check .
```

The Django test suite requires the PostgreSQL 17 target described above and never falls back to SQLite. Only development settings retain the SQLite fallback. Tests retain the dedicated test database between runs; Django's test isolation still creates and cleans synthetic test records. The PostgreSQL 18.3 verification below is a historical foundation snapshot, not the current automated test configuration.

### PostgreSQL and hosted CI verification (2026-11-05)

Docker was not installed. The already-running Homebrew PostgreSQL 18.3 service was used. The local role and database were provisioned for that verification run; credentials are omitted here.

The local role/database were provisioned for that verification run; credentials are omitted.

From `backend/`, the same local environment was supplied for each command:

```sh
.venv/bin/python manage.py check

.venv/bin/python manage.py makemigrations --check --dry-run

.venv/bin/python manage.py migrate --noinput

.venv/bin/python -m pytest

.venv/bin/ruff check .
```

Results in the same order: system check passed with no issues; no model/migration changes detected; all contenttypes, auth, accounts, admin and sessions migrations applied; 2 tests passed; Ruff passed. The separate Django connection query confirmed `DATABASE_URL` was present and parsed to PostgreSQL for the local database.

The connection query used the local values in ignored `.env`, plus `DJANGO_SETTINGS_MODULE=config.settings.dev`:

```sh
DJANGO_SETTINGS_MODULE=config.settings.dev .venv/bin/python -c "import django; django.setup(); from django.db import connection; cursor=connection.cursor(); cursor.execute('SELECT current_database(), current_user, version()'); print(connection.settings_dict['ENGINE'], connection.settings_dict['HOST'], connection.settings_dict['PORT'], cursor.fetchone())"
```

## Production deployment readiness

See [Production deployment and release runbook](PRODUCTION_DEPLOYMENT.md) for current strict production configuration, dependency readiness, durable private storage, rollout and rollback gates. Production requires explicit PostgreSQL, hosts, a strong secret and Redis configuration. `/api/v1/health/` is liveness; `/api/v1/ready/` tests database/cache/private-storage availability. Infrastructure has not been provisioned or verified.


PR #1 is open and unmerged. Its latest verified head is `d048b1720602bcbe19c78d3725a9c07c900e4ce4`; [backend verification #9](https://github.com/jatin13-14/devjobs/actions/runs/42076673522) and [frontend verification #6](https://github.com/jatin13-14/devjobs/actions/runs/42076673521) both passed on that head. The backend hosted job uses PostgreSQL 17.

Email identity permits ASCII only, removes surrounding ASCII whitespace (`space`, tab, line feed, carriage return, form feed, vertical tab), and lowercases the result. Python normalization, migration preflight, PostgreSQL canonical checks, and the unique expression share that exact whitespace set. The database check requires stored values to already be canonical, so direct database writes cannot create padded identities that collide after application normalization. Migration preflight aborts without changing accounts if existing rows are non-ASCII or collide after normalization.
`User.save()` validates syntax after normalization. If `update_fields` omits `email` while the in-memory email differs from the stored value, save raises `ValueError`; include `email` to persist the reassignment. Do not use `QuerySet.update()`, `bulk_create()`, or `bulk_update()` to write user emails: Django bulk operations bypass model validation and normalization. No such bulk email write path currently exists in the repository.

The frontend commands above were run on 2026-11-05 with Node.js 24.1.0 / npm 11.3.0: lint passed, 1 Vitest test passed, and the production build passed. Vite reported a 609.25 kB minified JavaScript chunk, above its 500 kB advisory threshold.

Dependency installation also succeeded: `npm ci` and `python3 -m venv .venv && .venv/bin/python -m pip install -r requirements/dev.txt`.

## Private resume storage (2026-11-07)

Install updated backend requirements (`pypdf==6.12.0` supplies structural PDF validation; Django/stdlib do not parse PDFs) and run `python manage.py migrate` before using resumes. Migration `candidates.0011_candidateresume` is additive. The milestone verification applies it only through Django's dedicated test-database setup; development migration application is an operator step.

`PRIVATE_RESUME_ROOT` defaults to `backend/private-resumes` (Git ignored). `RESUME_MAX_BYTES` defaults to `5242880` (5 MiB) and must be positive. Keep the root outside any served static/media tree; provision it exclusively for the backend OS account with mode `0700`. New files use `0600`, generated UUID names and fixed `.pdf` suffixes; uploaded names are discarded. Do not permit untrusted OS users or processes to write this directory or plant symlinks. No Django media route serves it. No resume endpoint returns its path or a storage URL. Set the root to an absolute private path for deployment.

The candidate navigation includes **My Resume**. Use a real PDF from a synthetic/test document, not personal production fixtures. The upload endpoint accepts multipart `file`; ownership is always obtained from the authenticated account. Backend tests use temporary private roots and synthetic in-memory PDFs and remove them after the tests.

Replacement writes a new unique file inside a durable database transaction, serializes on the candidate row, and removes the previous file only in a robust post-commit callback. A normal database/storage failure rolls back the reference and attempts new-file cleanup. Deletion commits removal of the reference before unlinking bytes. Services reject nesting inside ordinary caller transactions to avoid later outer rollbacks. Do not enable ATOMIC_REQUESTS for these views without revisiting this boundary. Cleanup failure does not invalidate a committed replacement/deletion; it emits a generic warning without paths. Process crashes, partial writes, failed cleanup, account/profile cascades or ambiguous database commit failures can leave private orphan files. Database and filesystem cannot provide a distributed atomic commit; back up/restore them as a coordinated pair.

Run `python manage.py cleanup_resumes` for a count-only dry run. For removal, **stop all workers that can upload/delete resumes first**, then run `python manage.py cleanup_resumes --delete` and restart workers. The command removes only unreferenced UUID PDF files older than 24 hours (or the larger `--min-age-hours` value), never prints paths and preserves referenced and recent files. Run it with the same database/root configuration as the service. Do not run destructive reconciliation concurrently with upload transactions, during restore, or with mismatched DB/storage snapshots. Unknown filenames and subdirectories require operator inspection and are deliberately untouched. Schedule a maintenance window and monitor generic cleanup warnings; no scheduler or infrastructure is provisioned here.

Production remains blocked on a selected durable private storage integration (persistent restricted volume shared appropriately across workers, or an explicitly implemented private storage adapter), backup/restore and retention/deletion procedures. Never expose a bucket, volume or media alias publicly. Configure edge request/body-size limits consistent with the application file limit plus multipart overhead, temporary upload-disk quotas and worker resource/time limits; Django may spool oversized multipart uploads before file validation. Structural PDF validation is not malware scanning or content sanitization; downloads remain attachments and PDFs must be treated as untrusted documents. Add a separately approved quarantine/scanning integration if production threat requirements demand it. No cloud provider has been selected or provisioned. Admin moderation and private resume functionality are implemented locally; deployment gates remain in the production runbook.

## Administrator provisioning and moderation

Apply migrations before enabling `/admin` in the frontend or `/api/v1/admin/` APIs. With the correct environment and PostgreSQL database selected, a trusted operator runs `python manage.py createsuperuser` interactively on the backend host, supplying an authorized operator's actual email and a unique strong password. Do not create default accounts, fixtures, shared credentials or passwords in shell arguments/source control. This creates the existing product admin role with Django staff/superuser identity. Keep operator identities separate from candidate/recruiter profiles. No public endpoint provisions or elevates staff.

Log in normally and use **Administration**. Existing sessions need a new login to receive the navigation capability flag. Revoke a staff identity using a trusted Django management shell with a reviewed account UUID, setting `is_active=False` (and removing staff/superuser flags if permanently revoked); verify another authorized operator retains access first. Ordinary moderation cannot suspend staff/superusers or itself. Restrict host/database/Django admin access, log operational provisioning/revocation in the operator's secure change-management system, and never include passwords/tokens in tickets. No administrator account was provisioned by this implementation.

Suspension retains records and private resume bytes. Subsequent requests recheck identity and company membership; already authorized in-flight requests/streams can finish. Database and private storage backup requirements still apply. The immutable audit trigger intentionally prevents application-level history editing; database superusers can bypass database protections and require operational access controls.

### Browser workflow verification

See `TESTING_STRATEGY.md` for Playwright installation and the guarded
`backend/run_browser.py` runner. It uses only PostgreSQL 17.5 on port 5433 with the
existing dedicated `devjobs_test` database, applies pending migrations without resetting
it, and launches separate local API/Vite ports 8011/5174. Supply DATABASE_URL securely;
do not change or print `.env`. Generated synthetic data remains distinguishable by run
UUID and `example.test` identities. Reports/traces are private ignored artifacts.
