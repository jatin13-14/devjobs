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

Create a local role and database. When prompted, use `devjobs` as the password to match the ignored local example configuration, or edit `DATABASE_URL` in `.env` to match your choice.

```sh
"$(brew --prefix postgresql@17)/bin/createuser" --createdb --pwprompt devjobs
"$(brew --prefix postgresql@17)/bin/createdb" --owner=devjobs devjobs
```

## Configure local environment

From the repository root:

```sh
cp .env.example .env
cp frontend/.env.example frontend/.env
```

`.env` is ignored by Git. Change its development database credentials if they differ from the local PostgreSQL role. The backend loads this root `.env` automatically; the Vite client reads `frontend/.env`.

The backend environment variables are:

| Variable | Purpose | Local example |
|---|---|---|
| `DJANGO_DEBUG` | Enables Django debug mode in development | `true` |
| `DJANGO_SECRET_KEY` | Django signing key; replace the example value for any persistent deployment | `replace-for-local-development` |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated allowed host names; required by production settings | `localhost,127.0.0.1` |
| `DATABASE_URL` | Database connection URL; use PostgreSQL locally | `postgresql://devjobs:devjobs@localhost:5432/devjobs` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated browser origins allowed by CORS | `http://localhost:5173` |

The frontend uses `VITE_API_BASE_URL` from `frontend/.env` (default: `http://localhost:8000/api/v1`). Vite exposes variables prefixed with `VITE_` to browser code; do not put secrets there.

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

The Django test suite uses the configured database. The settings accept PostgreSQL URLs via `dj-database-url` and `psycopg`; with no `DATABASE_URL`, they fall back to SQLite. On 2026-11-05, Python 3.14.4, Django 5.2.19, psycopg and PostgreSQL 18.3 (Homebrew) were used for a live PostgreSQL run. With a local `devjobs` role/database matching `.env.example`, the connection query selected `django.db.backends.postgresql`, reached database `devjobs` as user `devjobs` on `127.0.0.1:5432`, and reported PostgreSQL 18.3. Django system checks, migration consistency, all migrations, 2 backend tests, and Ruff passed against PostgreSQL. The exact commands and hosted CI status are recorded below.

### PostgreSQL and hosted CI verification (2026-11-05)

Docker was not installed. The already-running Homebrew PostgreSQL 18.3 service was used. The local development role and database were created with:

```sh
/opt/homebrew/opt/postgresql/bin/psql -h 127.0.0.1 -p 5432 -d postgres \
  -v ON_ERROR_STOP=1 \
  -c "CREATE ROLE devjobs LOGIN CREATEDB PASSWORD 'devjobs';" \
  -c 'CREATE DATABASE devjobs OWNER devjobs;'
```

From `backend/`, the same local environment was supplied for each command:

```sh
DATABASE_URL='postgresql://devjobs:devjobs@127.0.0.1:5432/devjobs' \
DJANGO_DEBUG=true DJANGO_SECRET_KEY=replace-for-local-development \
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1 .venv/bin/python manage.py check

DATABASE_URL='postgresql://devjobs:devjobs@127.0.0.1:5432/devjobs' \
DJANGO_DEBUG=true DJANGO_SECRET_KEY=replace-for-local-development \
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1 .venv/bin/python manage.py makemigrations --check --dry-run

DATABASE_URL='postgresql://devjobs:devjobs@127.0.0.1:5432/devjobs' \
DJANGO_DEBUG=true DJANGO_SECRET_KEY=replace-for-local-development \
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1 .venv/bin/python manage.py migrate --noinput

DATABASE_URL='postgresql://devjobs:devjobs@127.0.0.1:5432/devjobs' \
DJANGO_DEBUG=true DJANGO_SECRET_KEY=replace-for-local-development \
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1 .venv/bin/python -m pytest

DATABASE_URL='postgresql://devjobs:devjobs@127.0.0.1:5432/devjobs' \
DJANGO_DEBUG=true DJANGO_SECRET_KEY=replace-for-local-development \
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1 .venv/bin/ruff check .
```

Results in the same order: system check passed with no issues; no model/migration changes detected; all contenttypes, auth, accounts, admin and sessions migrations applied; 2 tests passed; Ruff passed. The separate Django connection query confirmed `DATABASE_URL` is present and parsed to PostgreSQL with the expected host, port, database and user. The local credentials are development placeholders only; do not reuse them outside a local instance.

The connection query used the same `DATABASE_URL`, `DJANGO_DEBUG`, `DJANGO_SECRET_KEY`, and `DJANGO_ALLOWED_HOSTS` values above, plus `DJANGO_SETTINGS_MODULE=config.settings.dev`:

```sh
DJANGO_SETTINGS_MODULE=config.settings.dev .venv/bin/python -c "import django; django.setup(); from django.db import connection; cursor=connection.cursor(); cursor.execute('SELECT current_database(), current_user, version()'); print(connection.settings_dict['ENGINE'], connection.settings_dict['HOST'], connection.settings_dict['PORT'], cursor.fetchone())"
```

GitHub Actions was queried for `jatin13-14/devjobs` on 2026-11-05. The GitHub API returned `total_count: 0` for both workflow runs and registered workflows. The local HEAD and `origin/main` are both `db9c9d342b9907ed3ad347b4e9a6bd049b6cd94b`; `git ls-tree -r HEAD .github/workflows` returned no files. The frontend and backend workflow definitions currently exist only as untracked local files, so GitHub has no workflow definitions to execute for this commit. To trigger hosted verification, add the workflow files to a commit and push that commit or open/update a pull request targeting `main`; the path filters cover those workflow files. The backend hosted job will run against PostgreSQL 17. No commit or push was performed.

The frontend commands above were run on 2026-11-05 with Node.js 24.1.0 / npm 11.3.0: lint passed, 1 Vitest test passed, and the production build passed. Vite reported a 609.25 kB minified JavaScript chunk, above its 500 kB advisory threshold.

Dependency installation also succeeded: `npm ci` and `python3 -m venv .venv && .venv/bin/python -m pip install -r requirements/dev.txt`.
