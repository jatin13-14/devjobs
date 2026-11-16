# Git integration and disposable E2E audit — 2026-11-11

## Finalization audit — 2026-11-11

This entry records the independent working-tree review for the local commit gate.
The dated entries below are historical. Exact-index verification results, tested
tree identifier and resulting commit identity are reported separately at delivery
so that recording them does not change the tree being tested.

Starting branch/HEAD: `feat/admin-workspace-final` /
`ca9a7c3b081c3dcdbc342a3350bfb4d8aced0f21`; empty index, 11 modified
tracked files and 11 individual untracked files. Every changed and untracked file
was read. No production configuration, API, schema, dependency or product change.

### Complete file inventory and commit boundary

| Files | Classification / disposition |
| --- | --- |
| `backend/run_browser.py` | E2E orchestration, database provisioning, ownership checks and cleanup; include |
| `backend/config/e2e_runtime.py` | Port/process ownership, readiness HMAC, Docker cleanup, peer checks; include |
| `backend/e2e_exec.py` | Child signal-mask reset and PID-preserving exec; include |
| `backend/e2e_server.py` | Inherited backend socket and E2E-only readiness; include |
| `backend/run_browser_concurrent.py` | Two complete independent runs and barrier; include |
| `backend/config/e2e_safety.py` | Fail-closed database target and actual cluster validation; include |
| `backend/config/settings/e2e.py` | Explicit disposable settings and pre-write identity guard; include |
| `backend/conftest.py` | Verified disposable pytest database branch; include |
| `backend/config/settings/test.py`, `backend/config/test_settings.py`, `backend/config/test_database_identity.py` | Extract unchanged legacy identity policy to avoid importing legacy database settings during E2E collection; include |
| `backend/config/test_e2e_runtime_unit.py`, `backend/config/test_e2e_safety_unit.py` | 16 pure ownership/failure/signal/database regressions; include |
| `frontend/scripts/e2e-server.mjs` | Owned frontend HTTP socket and shared Vite websocket transport; include |
| `frontend/playwright.config.js`, `frontend/e2e/workflows.spec.js` | Explicit runner environment, isolated outputs, three-role assertions; include |
| `.github/workflows/browser.yml` | Same owned Docker runner and failure PNG upload; include |
| `frontend/src/styles/candidate.css` | Four Candidate-only shrink/ellipsis rules; include |
| `docs/E2E_ISOLATION.md`, `docs/TESTING_STRATEGY.md` | Testing documentation; include |
| `docs/LOCAL_DEVELOPMENT.md` | Include only replacement browser-runner instructions; exclude appended local startup/account/cleanup operations history |
| `PROJECT_STATUS.md` | Include E2E audit/remediation/preparation/completion entries; exclude local readiness, role-account provisioning and demo-cleanup operations entries |

No generated artifact or real credential was found among these paths. Synthetic
test literals are distinct from generated per-run secrets. Environment files,
virtual environments, browser caches, screenshots and databases are excluded.
Mixed documentation is staged with explicit selected patches, never whole-file
staging. No broad add, remote operation or development-database connection is used.

### Security findings

No serious isolation defect was found in the reviewed implementation. Exclusive
loopback listeners remain held by the parent through startup; `pass_fds` grants
each service only its own socket. Exec preserves the tracked child PID. Vite HTTP
and websocket traffic share the frontend listener, avoiding implicit port 24678.
Both services must prove run/role/actual PID with HMAC-SHA256 before browser use.
Each probe generates a fresh 256-bit challenge, making previous responses unusable;
each run generates a new key. Python uses `hmac.compare_digest`. The server signs
challenges without transmitting its key. Malformed/unavailable/wrong ownership
responses fail closed. No E2E readiness route is added to production URL handling.

PostgreSQL credentials are generated per run; the runner removes inherited
`DATABASE_URL` and `PG*` variables and disables dotenv. Docker provides a random
loopback port and tmpfs cluster. Ownership and mount checks precede independent
SQL system-identifier/database/internal-port/version checks and all migrations.
No existing development target is selected. Peer tests require distinct endpoints
and identifiers, reject the other service identity, reject the other cluster ID
and require authentication failure with the current run's credentials on the peer.

Signal tests actually deliver SIGINT/SIGTERM to the test process while mocking
Docker creation, including pending-signal delivery after tracking, CLI failure
before returned ID, repeated cleanup signals and original-failure preservation.
They do not constitute a real-daemon interruption experiment. Cleanup discovers
only the exact random ownership label and rechecks each ID before removal.
Normal live-run cleanup is checked separately. POSIX-only operation, SIGKILL,
host loss and hung/unreachable Docker remain limitations; there is no global prune.

### Coverage findings and limits

Browser operations cover Candidate registration/login/profile saving/skill add,
resume upload/download/removal, job search/details/apply/withdraw and logout;
Recruiter registration/login/profile, company creation, membership invitation and
activation, disabled MEMBER controls, draft creation/publication, applicants,
resume download and REVIEWING transition; Admin login/dashboard, user/job
moderation and reversal, reason-required controls and company suspension.
All roles explicitly switch both themes, verify rendered colors and persistence,
and check document overflow at 1440/768/390. Candidate's long synthetic name
exercises the narrowly scoped header fix. Recruiter/Admin stylesheet sources are
unchanged and their theme/viewport checks provide runtime regression checks.

API assistance covers member account setup, job edit/close, application lookup,
duplicate rejection, anonymous/role/member denials, all five Admin listing
responses, and blocked publication after suspension. Four Admin resource screens
are browser-operated; history is checked through the listing API. Listing checks
assert response shape, not exhaustive rows/filter correctness. Downloads assert
the event/filename, not byte-for-byte content. Recruiter/Admin logout, anonymous
Admin routing, all job editing/status permutations, arbitrary-length names and
exhaustive outsider/filter/pagination journeys are not covered by this scenario.
Candidate logout and authenticated cross-role route rejection are covered.
One sequential Chromium scenario is not exhaustive E2E certification.

### Verification procedure

Working tree: frontend `npm run lint && npm test && npm run build`; backend
`.venv/bin/ruff check .` and `.venv/bin/python -m unittest
config.test_e2e_safety_unit config.test_e2e_runtime_unit`; root
`backend/.venv/bin/python backend/run_browser.py` and
`backend/.venv/bin/python backend/run_browser_concurrent.py`.
Each runner executes `manage.py migrate --noinput`, `manage.py check`,
`manage.py makemigrations --check --dry-run` and
`python -m pytest --ds=config.settings.e2e` against its verified owned cluster.
No default pytest/development-database fallback is allowed.

The same gates must pass on an export of the exact index before committing.
Export all indexed paths with `git checkout-index` into a new temporary directory,
preserving modes and excluding unstaged/untracked source. Reuse only installed
dependencies: frontend `node_modules` and the backend interpreter/site-packages;
all project source, settings, test configuration and runner paths come from the
export. Record `git write-tree`, check exported tracked contents against that
tree before and after verification, then require the index still matches it.
The only permitted commit message is
`test(e2e): secure isolated full-stack browser testing`.

## Critical isolation remediation — 2026-11-11 (current implementation)

This section supersedes the fixed-port/released-probe and unsigned-readiness
architecture described in the historical audit entries below. Runtime results
for this revision are recorded at the end of this section.

### Ownership and readiness

Each runner generates a UUID and a cryptographically random, process-only readiness
key. It binds two IPv4 loopback sockets to OS-selected ephemeral ports, listens,
and retains both descriptors until cleanup. There is no probe/release/rebind gap,
SO_REUSEPORT, fixed application port, or server reuse. The kernel's exclusive bind
is the OS-backed coordination mechanism. The test-only WSGI server and Node/Vite
middleware server inherit their respective descriptor with `pass_fds`; neither
selects or rebinds an application port. A startup failure cannot redirect browsers
to a development server. The parent retaining its descriptor means a child crash
leaves a reserved, unavailable endpoint rather than allowing another listener.

The runner starts both services itself, records each Popen PID, and independently
polls `/__e2e_ready__` with a fresh random challenge. Responses must identify the
exact run, role and child PID and carry HMAC-SHA256 over those fields and the
challenge. Arbitrary 200 responses, another run, wrong keys, wrong roles/PIDs and
replayed challenge signatures fail before Playwright starts. The secret is never
sent over HTTP or printed. HTTP proxy environment variables are bypassed. This
readiness route exists only in the two explicit E2E server entry points; production
URLs, authentication, settings and schema are unchanged. E2E CORS and browser API
URLs follow the reserved frontend/backend endpoints. Vite cache, Playwright output
and synthetic screenshots have per-run paths, preventing concurrent artifact races.
Vite websocket upgrades attach to the same inherited HTTP server; middleware mode
otherwise opens implicit port 24678 even with `hmr: false`.

### Interruption and cleanup

SIGINT and SIGTERM handlers are installed before allocating resources. Docker
`create` is separate from `start`; signals are blocked through creation and ID
assignment, and the Docker CLI inherits that mask so terminal SIGINT cannot kill
it midway. Pending interruption is delivered after the synchronous creation call
returns, before further work. The same tracking protection applies to socket
allocation and service Popen calls. Exec helpers clear child signal masks before
starting services and checks. Each service/check owns a new process session.

Cleanup stops only live tracked child process groups, closes held descriptors,
and discovers containers by exact `devjobs.e2e=<run UUID>` label even when the CLI
failed before returning an ID. Every discovered ID is inspected again before
removal, then the label query must return no containers. Repeated cleanup is safe;
further SIGINT/SIGTERM during cleanup are absorbed. Cleanup failures are reported
without replacing an existing failure or signal exit status. Generated PostgreSQL
credentials and temporary private resume/Vite storage remain process-only/run-owned.
No global prune, broad name match, existing database URL, host mount or database
reset is used. Unrelated operation notes and resources are preserved.

### Commands and regression coverage

From repository root:

```sh
backend/.venv/bin/python backend/run_browser.py
backend/.venv/bin/python backend/run_browser_concurrent.py
```

The second command runs two complete Docker/PostgreSQL/backend/Chromium lifecycles
concurrently. A temporary barrier exchanges only public endpoints, run IDs, PIDs
and cluster identifiers. Both runners require six distinct application/database
endpoints and distinct PostgreSQL system identifiers. Each probes the actual peer
services using its own expected identity/key and requires rejection. Each rejects
the peer cluster identifier on its own verified SQL connection and attempts a
connection to the peer using its own credentials, requiring password-authentication
failure before issuing any query. Loopback TCP reachability itself is not blocked;
service identity checks and independent database credentials prevent cross-run use.
Both checks must finish before either starts browser mutations. Both then execute
the full three-role scenario independently. All containers are disposable tmpfs
instances. No existing database is contacted.

From backend:

```sh
.venv/bin/ruff check .
.venv/bin/python -m unittest config.test_e2e_safety_unit config.test_e2e_runtime_unit
```

16 pure guard tests cover environment/cluster guards; simultaneous exclusive port
allocation; collision with an existing disposable listener; valid backend/frontend
identity; wrong keys/run/role/PID and arbitrary 200; service exit/timeout; SIGINT and
SIGTERM during creation; CLI failure before returned ID; repeated cleanup; changed
ownership; cleanup of only labelled resources; repeated signals during cleanup;
missing Docker and missing daemon; preservation of the original failure when cleanup fails. Failure paths use mocks; socket tests use fresh
loopback listeners. The complete PostgreSQL suite also collects these guard tests.

The browser scenario explicitly switches Candidate, Recruiter and Admin to both
Light and Dark, checks role shell and expected rendered background colors, saves
and reloads each preference, rejects other role shells, and checks overflow at
1440/768/390 in each theme. Page exceptions and console errors fail the scenario. Two exact existing Ant Design
development warning messages (unconnected useForm and static message theme context)
are counted separately, including member contexts; all other console errors fail.
Token query parameters are redacted from captured console errors.
Existing candidate/recruiter mutation and administrator moderation checks remain.

### Limits

This is a POSIX/macOS/Linux test harness: descriptor inheritance, pthread signal
masks and process sessions are required. Windows is unsupported. Docker creation
is deliberately allowed to finish before handling interruption; a hung daemon can
delay cleanup. SIGKILL, host loss or an unreachable Docker daemon cannot guarantee
immediate resource removal. Recovery must inspect the exact run label and remove
only verified IDs; never prune globally. A malicious same-user/root process able
to read child environments is outside this isolation boundary. Hosted CI and other
browser engines have not been exercised by this local task. Existing Vite bundle
size and JSDOM diagnostics remain unrelated, non-failing advisories.

### Actual verification results

Final verification on 2026-11-11:

| Command (working directory) | Outcome |
| --- | --- |
| `npm run lint` (frontend) | PASS |
| `npm test` (frontend) | PASS, 62 tests / 17 files |
| `npm run build` (frontend) | PASS; existing 755.17 kB chunk advisory |
| `.venv/bin/ruff check .` (backend) | PASS |
| `.venv/bin/ruff format --check config/e2e_runtime.py config/test_e2e_runtime_unit.py e2e_server.py e2e_exec.py run_browser.py run_browser_concurrent.py` (backend) | PASS, six files |
| `.venv/bin/python -m unittest config.test_e2e_safety_unit config.test_e2e_runtime_unit` (backend) | PASS, 16 tests |
| `backend/.venv/bin/python backend/run_browser_concurrent.py` (root) | PASS, both complete runners exited 0 |
| `backend/.venv/bin/python backend/run_browser.py` (root) | PASS, exit 0; 150 backend tests and 1 Chromium scenario |
| `npm run test:e2e -- --list` without runner environment (frontend) | Expected rejection before services/browser/database access |
| `git diff --check` (root) | PASS |

Each complete runner executes, from backend with its generated verified environment:
`python manage.py migrate --noinput`, `python manage.py check`,
`python manage.py makemigrations --check --dry-run`, and
`python -m pytest --ds=config.settings.e2e`. These are the runner's actual
`sys.executable`, not a different global interpreter. All pass in both final
concurrent runs (150 backend tests each, 34.76s). Django reports zero system issues
and no migration changes. Both Chromium scenarios pass (32.2s each), including
Candidate/Recruiter/Admin workflows and all six role/theme combinations, rendered
colors, persistence and 18 viewport/theme captures per run. Zero page/console
errors; 15 occurrences per scenario of two exact pre-existing Ant Design warning
messages are counted separately. Existing JSDOM, NO_COLOR/FORCE_COLOR, Vite bundle
and Babel large-generated-file diagnostics are non-failing and remain visible.

Final concurrent identity evidence (public metadata only):

| Run | Container | Backend | Frontend | PostgreSQL host port | Cluster identifier |
| --- | --- | --- | --- | --- | --- |
| `f4164ca8af1e4255b45faa26ac3b1d5b` | `094dd6327b38` | 62212 / PID 40111 | 62214 / PID 40113 | 62217 | `7706878984703066157` |
| `6bfaac134c324421bb2c352b13993bd7` | `0596a51059d1` | 62213 / PID 40112 | 62215 / PID 40114 | 62216 | `7706878984699519020` |

Both runners logged `Concurrent isolation PASS`: signed cross-run readiness,
cluster mismatch rejection and peer password-authentication rejection all passed
before browser mutations. Both containers, listeners and temporary private/cache
storage were cleaned. Final `docker ps -a --format '{{.ID}} {{.Names}} {{.Status}}' shows
only the pre-existing stopped `8b3d57ba510f` welcome container.
`docker ps -aq --filter label=devjobs.e2e` returns no IDs.
`lsof -nP -iTCP:62212 -iTCP:62213 -iTCP:62214 -iTCP:62215
-iTCP:63697 -iTCP:63698 -sTCP:LISTEN` reports no listeners (expected exit 1).
No existing database was selected or mutated; no existing application service
was stopped or modified. No generated credentials or readiness keys appear here.

Earlier attempts in this remediation task are recorded as failures, not passes:

1. Initial guard invocation was denied loopback binds by the sandbox; approved
   rerun exposed macOS lacking SO_ACCEPTCONN support. The assertion now verifies
   a real connection to the preserved disposable listener. Fixed a mock label
   parser using the wrong delimiter; final 16 guard tests pass.
2. First standalone run: 147 backend tests pass, browser fails because default
   light preference has no localStorage key until toggled. The test now explicitly
   toggles into each theme before testing persistence; cleanup passes.
3. Second standalone run: 149 backend tests and all workflow/theme assertions
   pass; final console assertion fails on existing Ant Design development warnings.
   Those two exact warning messages now have explicit counts, while all unexpected
   console errors and page exceptions continue to fail. Cleanup passes.
4. First concurrent command: 149 backend tests pass in each runner; both signed
   peer/cluster/credential checks pass; one browser passes and one fails on Vite's
   implicit websocket port 24678. Attached websocket upgrades to the inherited
   HTTP server and redacted token query parameters in captured console errors.
   Both failed-attempt containers were cleaned. Final concurrent rerun passes.
5. A file-edit helper initially ran from frontend with a repository-relative path
   and raised FileNotFoundError without changing a file; rerun from root applied
   the intended theme assertion change. No test failure was hidden.

Task-edited paths (existing unrelated changes remain intact):

- `backend/run_browser.py`, `backend/config/settings/e2e.py`
- `backend/config/e2e_runtime.py`, `backend/config/test_e2e_runtime_unit.py`
- `backend/e2e_server.py`, `backend/e2e_exec.py`, `backend/run_browser_concurrent.py`
- `frontend/scripts/e2e-server.mjs`, `frontend/playwright.config.js`,
  `frontend/e2e/workflows.spec.js`
- `.github/workflows/browser.yml` (per-run failure screenshot path)
- `docs/E2E_ISOLATION.md`, `docs/TESTING_STRATEGY.md`, `PROJECT_STATUS.md`

API/schema/production authentication/settings impact: none. No new dependencies.
Prior changes in conftest, legacy test settings/identity tests, safety settings,
Candidate CSS and local-development operations notes were preserved. No stage,
commit, push, merge, rebase, deployment or PR #1 modification. Final branch/HEAD:
`feat/admin-workspace-final` / `ca9a7c3b081c3dcdbc342a3350bfb4d8aced0f21`.
Git status: 11 modified tracked and 11 untracked individual files; index empty.
All work remains unstaged, including the original dirty paths.

Final standalone run `e87beb0b78994ffe9258a770bf79ae8a`: container
`c17e7c06a81c`, cluster `7706879319707226156`, PostgreSQL host port 63699;
backend PID 40325 on 63697, frontend PID 40326 on 63698. Signed readiness,
migrations/system/migration consistency checks PASS, 150 backend tests PASS
(34.38s), Chromium 1 PASS / 0 FAIL (31.8s), six role/theme combinations PASS,
zero browser errors and 15 counted known development warnings. Cleanup PASS.

**Verdict: PASS for this local isolation remediation and verification.** Hosted
CI/cross-browser/Windows/host-loss guarantees remain outside the verified boundary.


## Final independent audit — 2026-11-11: FAIL, commit stopped

This audit supersedes earlier completion claims for the final commit gate.
Starting branch/HEAD match `feat/admin-workspace-final` /
`ca9a7c3b081c3dcdbc342a3350bfb4d8aced0f21`; 11 modified tracked and
5 untracked paths, empty index. Unrelated operations notes remain untouched.

Blocking static finding: `run_browser.py` releases its 8011/5174 bind probes
before starting either service. Concurrent invocations can both pass preflight.
The backend readiness check accepts any HTTP 200 without verifying run ownership;
the spawned server can still be alive while failing to bind, so its preceding
`poll()` check does not prove ownership. Browser URLs are fixed. Consequently a
run can target another run's API (or a service started after preflight), violating
the no-other-database-writes guarantee. PostgreSQL cluster checks protect each
runner's direct Django connection, but do not authenticate the browser API target.
This is a code-path finding, not a reproduced concurrent mutation experiment.
Per the requested serious-isolation-defect stop rule, no staging/commit or Docker
mutation scenario was attempted. Remediation needs exclusive ownership across the
entire lifecycle or isolated per-run endpoints, with regression verification.

Additional review limits: the browser scenario checks widths 1440/768/390 but
does not explicitly select both themes. Candidate CSS changes are narrowly scoped,
but light/dark long-name regression acceptance is not independently established.
One sequential scenario exercises the requested three-role operations with real
UI/API assertions; five Admin listing APIs are checked for result arrays, which
does not independently establish every listing UI's behavior. It is not a broad
collection of independent cases. Job edit/close use API calls. CI remains unrun.
SIGTERM during `docker run`, before its returned ID is assigned, can also leave
an owned container outside the current finally cleanup condition; child-process
termination and container-creation interruption need dedicated verification.

Commands actually run in this final audit:

- Root: `git status --short --branch`, `git rev-parse HEAD`,
  `git diff --stat`, `git diff --check`, `git diff --name-status`,
  `git ls-files --others --exclude-standard`: PASS; baseline matches.
- `docker info --format '{{.ServerVersion}}'`: PASS, server 29.7.2.
- Frontend: `npm run lint && npm test && npm run build`: PASS,
  62 tests / 17 files. Existing JSDOM diagnostics and 755.17 kB chunk advisory.
- Backend: `.venv/bin/ruff check . && .venv/bin/python -m unittest config.test_e2e_safety_unit`:
  PASS, 3 pure guard tests.

Full PostgreSQL suite, Django system/migration checks, isolated E2E, runtime
cleanup and staged-snapshot verification were not rerun after the safety finding.
Earlier 137-test/browser results below are historical, not independent results
from this final audit. No database connection or container creation was needed.
No source fix, API/schema/production configuration change, commit SHA or committed
file list exists for this finalization attempt. Index remains empty. Recommended
next work: resolve runner ownership/termination defects and complete both-theme
checks, then repeat this milestone's working-tree and exact-index verification.

## Integration verdict

Current branch `feat/admin-workspace-final`, HEAD
`ca9a7c3b081c3dcdbc342a3350bfb4d8aced0f21`. The graph is linear:

`main db9c9d3 → foundation e0fe214 → API/security/browser work → 8fbec6e → Candidate 84b3381 → Recruiter bd98fc9 → Admin ca9a7c3`.

| Local/cached branch | Candidate | Recruiter | Admin |
|---|---|---|---|
| main / origin/main | absent | absent | absent |
| chore/foundation-ci / origin/chore/foundation-ci | absent | absent | absent |
| origin/feat/private-candidate-resumes | absent | absent | absent |
| feat/private-candidate-resumes | present | absent | absent |
| feat/recruiter-workspace-final | present | present | absent |
| feat/admin-workspace-final | present | present | present |

Candidate is one commit ahead of its cached upstream. Foundation/main match their
cached upstreams. Recruiter/Admin have no upstream. Admin is nine commits ahead of
foundation, zero behind. No missing milestone, merge conflict or duplicate milestone
commit appears in this graph; no pending merge is recorded. No live remote was read
or fetched: remote divergence and current PR state remain unknown. Historical docs
identify PR #1 with foundation and last verified head d048b17, an ancestor of HEAD;
this is historical evidence, not live PR metadata. Safest path: retain the existing
linear integration; after owner review and a future authorized remote refresh,
select the integrated branch for review. Do not cherry-pick these milestones again.
No integration, staging, commit, push or PR operation was performed.

## Existing configuration

Base settings load the root `.env` and support development SQLite fallback.
`config.settings.test` requires `127.0.0.1:5433/devjobs_test`; pytest independently
checks PostgreSQL 17.5 and uses retained `test_devjobs_test`. The old browser runner
also selected those settings, migrated `devjobs_test`, and created persistent
fixtures directly there. It raised JWT throttling to 100/minute. These browser
behaviors are removed. Unit-test settings and existing backend CI are unchanged.
No existing database was connected to, migrated, reset or queried during this audit.

## New architecture and lifecycle

`backend/run_browser.py` requires Docker. It checks application ports 8011/5174 are
free before provisioning. Every invocation owns a UUID-labelled `postgres:17.5`
container with tmpfs data, no host data mounts, generated database password,
loopback-only random host port and database `devjobs_e2e_disposable`. Ports 5432 and
5433 are refused as host endpoints. No existing database URL is accepted as input.
The PostgreSQL cluster system identifier is obtained through `docker exec` on the
exact owned container; Django independently verifies it through its actual database
connection before migrations. Every direct E2E settings entry point also verifies
identity before returning settings. The identifier, database, internal server port
5432 and PostgreSQL major 17 must match. A database name alone is insufficient.

Required process-only environment: `DEVJOBS_E2E=1`, `E2E_DATABASE_URL`,
`E2E_SYSTEM_IDENTIFIER`, `E2E_RUN_ID`; the runner generates these, the Django key,
fixture password and admin identity. No credentials are written to environment
files. Playwright requires explicit mode, identity and dedicated local URLs.
There is no development target fallback. Authentication remains at 5/minute.
Temporary resume storage explicitly uses the local default backend. API readiness
checks database/cache/storage; Vite readiness is managed by Playwright with no
server reuse. Each context uses synthetic `example.test` identities containing the
run UUID; data shapes are repeatable, identities are unique per run.

Finally, the runner terminates its backend and removes only the exact container ID
it created, destroying its tmpfs data. Resume files are scoped to its temporary
directory. Playwright manages its frontend process. No DROP DATABASE or existing
PostgreSQL service management is used. On an uncatchable host termination, inspect
Docker for this run's exact `devjobs-e2e-<UUID>` name and label; stop/remove only
that verified resource. Never use a global prune or delete local databases.

## Commands

Install existing locked dependencies and Chromium as described in TESTING_STRATEGY.
From the repository root, with Docker running and both application ports free:

```sh
backend/.venv/bin/python backend/run_browser.py
```

From backend, pure guard tests (no Django initialization/database connection):

```sh
.venv/bin/python -m unittest config.test_e2e_safety_unit
.venv/bin/ruff check .
```

The runner now also executes `manage.py check`,
`manage.py makemigrations --check --dry-run`, and
`python -m pytest --ds=config.settings.e2e` after migrations and before browser
fixtures. The explicit E2E branch in `conftest.py` independently checks cluster
identity and uses only the already migrated disposable database; no host test
DB is created or retained. The legacy test settings and CI path remain strict.
Do not invoke the default pytest command against existing local databases.
The runner removes inherited `DATABASE_URL` and libpq `PG*` variables and disables
python-dotenv before Django imports. Generated credentials remain process-only.

## Coverage and verification limits

The sequential browser scenario covers candidate/recruiter registration and login,
role routing, profile/skills/resume, company creation and membership restrictions,
draft creation/edit/publication/closing, discovery/details/application/history,
duplicate rejection, withdrawal, applicant details/review and denied member status
updates, admin listings/search/suspension, admin API role rejection and logout.
Some operations (draft edit/close and negative authorization assertions) use API
requests within the browser scenario. Broad admin filter combinations, unrelated
company outsider access, anonymous API denial and additional moderation kinds still
need expanded scenarios. No unsupported product workflows were added.

Execution: frontend `npm run lint`, `npm test`, `npm run build` PASS (62 tests /
17 files). Existing JSDOM diagnostics and 755.17 kB shared chunk warning remain.
Backend `.venv/bin/ruff check .` PASS; pure safety unittest 3 tests PASS.
`DJANGO_SECRET_KEY=synthetic-check-only-key-at-least-32chars DATABASE_URL=sqlite:///:memory: .venv/bin/python manage.py check`
PASS, using default development settings with no persistent database connection.
Initial root unittest discovery failed import resolution; corrected backend-module
invocation passed. Initial Ruff findings were corrected. Backend full database
suite and migration execution were skipped to preserve the prohibited databases.

`python run_browser.py` FAILS CLOSED: Docker is not installed here. No container,
database, migrations, fixture writes, browser mutation tests or screenshots were
created. Runtime container identity and browser selector correctness remain
unverified. This milestone is **blocked**, not a production-readiness pass.

Browser CI now delegates container ownership to the same runner on the Ubuntu
Docker host, installs Chromium and uploads only failure PNGs. No fixed database
credentials or separate service remain in that workflow. Other passing workflows
are unchanged. CI changes are reviewable but unexecuted; no remote CI was triggered.
Next action: run the harness on a Docker-enabled machine, resolve real failures,
expand remaining authorization/filter coverage, then review integration with fresh
remote information under separate authorization.

Final checks: backend `manage.py makemigrations --check --dry-run` with the same
explicit in-memory URL/key as the system check PASS (no changes detected).
`git diff --check` PASS. Direct frontend `npm run test:e2e -- --list` without the
runner environment was intentionally rejected before browser startup, confirming
the missing-mode guard. Final working tree: 7 modified tracked files, 4 untracked
files, empty index; the two original dirty documentation paths remain preserved.


## Successful Docker runtime completion — 2026-11-11

This entry supersedes the blocked runtime result above. **PASS**: actual local
Docker-isolated PostgreSQL and Chromium execution completed. No remote CI,
development-database connection, staging, commit, push, merge, deployment or PR
operation was performed. Existing operations notes were preserved.

### Runtime and isolation evidence

- `docker --version`: 29.7.2; `docker compose version`: v5.5.1.
  `docker info`: Docker Desktop server 29.7.2, Linux/aarch64. Initial sandbox
  socket access was denied; approved execution succeeded. `docker ps` initially
  showed no running containers. No Compose configuration exists in this repository;
  the owned runner uses `docker run` directly.
- `postgres:17.5` downloaded and ran natively as linux/arm64; image manifest digest
  `sha256:aadf2c0696f5ef357aa7a68da995137f0cf17bad0bf6e1f17de06ae5c769b302`.
- Final run UUID `2eda597c795d4fb2a710353a7ce6b767`, container `2700b27983c6`,
  PostgreSQL cluster identifier `7706873809033093165`, actual database
  `devjobs_e2e_disposable`, host endpoint `127.0.0.1:58645`, server port 5432.
  Ownership label, tmpfs-only storage, generated password, database/version and
  independent SQL cluster identity passed before migrations. No host data mount,
  existing database URL or development credentials were used by this run.
- Runner environment now removes inherited `DATABASE_URL` and libpq `PG*` values
  and disables dotenv. Backend pytest independently revalidates the same cluster.
  The pure legacy identity policy moved to `config/test_database_identity.py` so
  collection does not import legacy settings or require a development target.
- `docker ps -a --format '{{.ID}} {{.Image}} {{.Names}} {{.Status}}'` after completion
  showed only the pre-existing stopped `8b3d57ba510f` welcome container. All three
  runner-created containers were removed after success/failure; temporary private
  storage was cleaned. No unrelated resources were stopped or deleted. The pulled
  image remains cached. SIGTERM now enters runner cleanup; SIGKILL/host loss still
  requires the exact ownership-based recovery documented above.

### Failed scenarios and corrections

1. Initial browser run: 1 failed, Candidate header overflow at 768px with the long
   synthetic account name. Corrected the application CSS with a shrinkable search
   field and bounded, ellipsized account text; kept avatar/menu affordances visible.
   The same long-name viewport assertion passes in the final run.
2. Immediate rerun: stopped before container creation with `Address already in use`
   during the port bind probe; no listener was found. Added `SO_REUSEADDR` so closed
   connections in TIME_WAIT do not block the probe. Active listeners still fail bind.
3. Expanded browser run: backend 137 passed; browser 1 failed because the new Admin
   row locator expected email while rows render profile names. Corrected selectors,
   scoped modal close to its footer, and matched the existing uppercase CLOSED tag.
   Set a 10s action timeout for actionable failures and 120s for the full scenario.
4. During implementation Ruff found an unused/redundant helper import, and whitespace
   checking found a trailing blank line; corrected both. Final checks pass.

No authorization, throttle, production settings, API or schema change was made.
No dependencies were added. Authentication retains the normal 5/minute limit.

### Exact commands and final outcomes

From repository root:

```sh
backend/.venv/bin/python backend/run_browser.py
```

Final exit 0: migrations PASS; internal commands below PASS in the verified cluster:

```sh
# Runner executes these from backend/ with its generated isolated environment:
python manage.py migrate --noinput
python manage.py check
python manage.py makemigrations --check --dry-run
python -m pytest --ds=config.settings.e2e
```

The runner uses its actual `sys.executable` (local backend/.venv/bin/python).
Backend suite: **137 passed**; system check: zero issues; migration consistency:
no changes detected. Final browser suite: **1 executed, 1 passed, 0 failed**, 26.8s
scenario / 27.6s Playwright total. Across three browser executions: two failed
attempts and one complete passing rerun; the separate port-preflight failure
executed no tests. These are one sequential multi-role scenario, not independent
per-role test counts.

- Candidate PASS: registration/login, desktop/tablet/mobile layout, profile/skill
  persistence, resume upload/download/removal, discovery/details, application,
  duplicate rejection, withdrawal, role routing, logout/protection.
- Recruiter PASS: registration/login/profile, company and membership management,
  draft creation/edit/publication/closing, applicant listing/status, authorized
  resume download, denied MEMBER resume/status operations, withdrawal revocation.
- Admin PASS: dashboard/layout, Candidate route/API rejection, candidate/recruiter/
  job inspection, reason-required restriction and reversal, company suspension,
  all five listing APIs and blocked publication for the suspended company.
  Anonymous applications API denial also passes. Admin application management is
  unsupported and was not invented. Backend tests supply broader object ownership,
  concurrency, migration, resume and moderation regressions.

```sh
# frontend/
npm run lint
npm test
npm run build
# backend/
.venv/bin/python -m unittest config.test_e2e_safety_unit
.venv/bin/ruff check .
# repository root
git diff --check
```

All PASS: frontend 62 tests / 17 files; pure safety 3 tests; Ruff; whitespace.
Existing non-failing JSDOM diagnostics and shared-chunk 755.17 kB advisory remain.

`docker buildx imagetools inspect postgres:17.5` PASS: manifest explicitly lists
linux/amd64 and linux/arm64/v8. Docker image inspection confirmed native local ARM64.

CI review: existing workflow installs locked frontend dependencies and Chromium,
then invokes this same runner; migrations/checks/backend tests precede fixtures and
API readiness precedes Playwright's isolated Vite server. No reused web servers,
fixed database credentials, traces or network logs. Failure PNG upload remains
conditional with three-day retention. Actual hosted AMD64 execution is unverified;
no push or CI trigger occurred. This is a local milestone pass, not production or
cross-browser certification. Exhaustive admin filter combinations and additional
outsider browser contexts remain coverage opportunities, not supported-feature
blockers. API/schema impact: none.


Task-edited paths: `backend/run_browser.py`, `backend/conftest.py`,
`backend/config/settings/test.py`, `backend/config/test_settings.py`,
`backend/config/test_database_identity.py`, `backend/config/test_e2e_safety_unit.py`,
`frontend/e2e/workflows.spec.js`, `frontend/playwright.config.js`,
`frontend/src/styles/candidate.css`, `docs/E2E_ISOLATION.md`,
`docs/TESTING_STRATEGY.md`, `PROJECT_STATUS.md`.
Existing uncommitted browser CI/E2E settings/guard work remains available alongside
these changes; `docs/LOCAL_DEVELOPMENT.md` was preserved without task edits.
Final working tree: 11 modified tracked / 5 untracked paths, empty index;
branch `feat/admin-workspace-final`, HEAD `ca9a7c3b081c3dcdbc342a3350bfb4d8aced0f21`.

## Current disposable PostgreSQL security baseline — 2026-11-16

The owned runner now selects digest-pinned PostgreSQL 17.12 Bookworm and rejects
server versions below 17.12 before writes, while retaining the PostgreSQL 17 major
version boundary and all identity/cleanup checks. Earlier 17.5 runtime records
above are historical compatibility evidence. See POSTGRESQL_RUNNER_SECURITY.md
for the exact digest, upstream release notes, focused version regressions and
remaining deployment gates. Existing development databases and their separate
legacy test policy are not changed or used by these acceptance runs.
