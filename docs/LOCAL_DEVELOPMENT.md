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
| `CORS_ALLOWED_ORIGINS` | Comma-separated browser origins allowed by CORS | `http://localhost:5173` |
| `DJANGO_SECURE_SSL_REDIRECT` | In production, redirect HTTP requests to HTTPS | `false` locally |
| `DJANGO_SECURE_HSTS_SECONDS` | Production HSTS max-age in seconds; start small, then increase after HTTPS is stable | `0` locally |
| `DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS` | Include all subdomains in HSTS; enable only when every subdomain supports HTTPS | `false` |
| `DJANGO_SECURE_HSTS_PRELOAD` | Opt into browser preload lists; requires an intentional long-term HTTPS commitment | `false` |
| `DJANGO_SECURE_PROXY_SSL_HEADER` | Trust `X-Forwarded-Proto: https` from a TLS-terminating proxy | `false` locally |

The frontend uses `VITE_API_BASE_URL` from `frontend/.env` (default: `http://localhost:8000/api/v1`). Vite exposes variables prefixed with `VITE_` to browser code; do not put secrets there.

## Production HTTPS and reverse proxy

Production traffic must use HTTPS from the browser to the trusted edge, and the reverse proxy/load balancer must forward requests to Django over a private, trusted connection. Configure the proxy to overwrite (not append or accept from clients) `X-Forwarded-Proto` with the original scheme. Only then set `DJANGO_SECURE_PROXY_SSL_HEADER=true`; otherwise clients could spoof the scheme signal. Set `DJANGO_SECURE_SSL_REDIRECT=true` to enable Django's HTTP-to-HTTPS redirect after the proxy is configured. Ensure the proxy forwards the original host and configure `DJANGO_ALLOWED_HOSTS` accordingly.

After confirming HTTPS works across the whole domain, set `DJANGO_SECURE_HSTS_SECONDS` to a short initial duration and increase it deliberately. Enable `DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS=true` only if all subdomains support HTTPS. Enable `DJANGO_SECURE_HSTS_PRELOAD=true` only when the domain is ready for the browser preload process and its long-lived consequences. HSTS is emitted only over HTTPS by Django. These controls are configurable in production settings and default to redirect off/HSTS zero so local HTTP development and tests are unaffected. Secure session and CSRF cookies remain enabled in production.

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

The Django test suite uses the configured database. The settings accept PostgreSQL URLs via `dj-database-url` and `psycopg`; with no `DATABASE_URL`, they fall back to SQLite. On 2026-11-05, Python 3.14.4, Django 5.2.19, psycopg and PostgreSQL 18.3 (Homebrew) were used for a live PostgreSQL run. Django system checks, migration consistency, all migrations, 2 backend tests, and Ruff passed against PostgreSQL. The exact commands and hosted CI status are recorded below.

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

GitHub Actions was queried for `jatin13-14/devjobs` on 2026-11-05. The GitHub API returned `total_count: 0` for both workflow runs and registered workflows. The local HEAD and `origin/main` are both `db9c9d342b9907ed3ad347b4e9a6bd049b6cd94b`; `git ls-tree -r HEAD .github/workflows` returned no files. The frontend and backend workflow definitions currently exist only as untracked local files, so GitHub has no workflow definitions to execute for this commit. To trigger hosted verification, add the workflow files to a commit and push that commit or open/update a pull request targeting `main`; the path filters cover those workflow files. The backend hosted job will run against PostgreSQL 17. No commit or push was performed.

The frontend commands above were run on 2026-11-05 with Node.js 24.1.0 / npm 11.3.0: lint passed, 1 Vitest test passed, and the production build passed. Vite reported a 609.25 kB minified JavaScript chunk, above its 500 kB advisory threshold.

Dependency installation also succeeded: `npm ci` and `python3 -m venv .venv && .venv/bin/python -m pip install -r requirements/dev.txt`.
