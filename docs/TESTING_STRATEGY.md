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

Milestone 1 regression coverage: `apps/accounts/hardening_tests.py` covers shared
registration capacity, changing emails/forwarded headers, retry windows, distinct
client and endpoint buckets, independent throttle instances, cache failure,
refresh response/lifetimes, invalid refresh capacity, and canonical password
similarity for both roles. Existing registration/password and JWT rejection tests
remain active. `apps/jobs/api_tests.py` adds missing/null/malformed/nonexistent
company creation, PATCH omission, and malformed/combined paginated public company
filters while retaining ownership and public-visibility regressions. Database
checks use only the verified disposable runner, never the legacy host test DB.

Milestone 1 local verification (2026-11-12; no hosted CI claim):

| Command (repository root unless noted) | Outcome |
| --- | --- |
| `backend/.venv/bin/ruff check backend` | PASS |
| `backend/.venv/bin/ruff format --check backend/apps/accounts/throttles.py backend/apps/accounts/hardening_tests.py backend/apps/accounts/serializers.py` | PASS; newly added job-test methods also pass with `backend/ruff.toml`; existing unrelated formatting retained |
| `cd backend && .venv/bin/python -m unittest config.test_e2e_safety_unit config.test_e2e_runtime_unit` | PASS, 16; required loopback socket permission |
| `backend/.venv/bin/python backend/run_browser.py` | PASS, Django check, migration consistency, 159 PostgreSQL tests, Chromium 1/1 (32.8s), zero browser errors |
| `backend/.venv/bin/python backend/run_browser_concurrent.py` | PASS, two 159-test suites, independent service/cluster/credential rejection, Chromium 1/1 each (32.6s / 33.0s), zero browser errors |
| `cd frontend && npm run lint && npm test && npm run build` | PASS, 62 tests / 17 files; existing JSDOM diagnostics and bundle advisory |
| `/tmp/devjobs-m1-schema-tools/bin/python scripts/validate_openapi.py` | PASS, 39 paths / 55 operations, six serializer field sets, three negative controls |
| `backend/.venv/bin/python /tmp/devjobs-m1-redis-check.py` | PASS, ten independent processes / 200 attempts per scope, exactly 5 registration and 30 refresh admissions; owned Redis removed |
| `backend/.venv/bin/python /tmp/devjobs-m1-targeted.py` | Targeted auth 37/37 and jobs 11/11 PASS, followed by full suite; uses a temporary copy of the reviewed runner |

The targeted wrapper fixes ROOT to this checkout, adds `pytest
--ds=config.settings.e2e apps/accounts/tests.py apps/accounts/hardening_tests.py`
and `pytest --ds=config.settings.e2e apps/jobs/api_tests.py` before the existing
full suite, and retains cluster ownership/identity guards and cleanup. Its final
backend-only invocation omits browser setup after the full suite. No host database
configuration is selected. The Redis experiment creates a random-label,
password-protected, loopback-bound `redis:7.4-alpine` container with persistence
disabled; subprocesses share one generated signing key/cache URL and a fixed
clock, then exact ownership is rechecked before removal. Temporary helpers/logs
remain outside Git. These experiments exercise real shared cache operations but
not Redis failover, eviction or unsynchronized worker clocks.

OpenAPI tooling uses the documented `openapi-spec-validator==0.9.0` and
`PyYAML==6.0.3` in a temporary virtualenv; no project dependency changed.
The first backend pass failed (156/159) on registration-test cache leakage and
empty QueryDict values; fixes add cache cleanup and validate a plain parameter
dict. The first Redis harness lacked request headers; its stub was corrected,
and its owned container was cleaned even on failure. Sandbox-blocked Docker,
socket and package-network attempts were rerun with approved permissions.

Final deterministic-clock backend-only rerun:
`backend/.venv/bin/python /tmp/devjobs-m1-targeted.py >
/tmp/devjobs-m1-final-backend.log 2>&1`: auth 37 PASS, jobs 11 PASS, full suite
159 PASS (36.78s); Django system check and migration consistency PASS. The prior
targeted wrapper also completed Chromium 1/1 (31.6s). Final Docker label queries
found no remaining E2E or milestone Redis containers; `lsof` found no listeners
on owned verification service/database ports. No existing service was stopped.


## Milestone 1 independent security gate — 2026-11-12

**FAIL; stopped before staging or commit under the requested unsafe-failure stop
rule.** The fixed-window throttle uses Django RedisCache.add followed by incr.
The installed RedisCacheClient.incr performs separate EXISTS and INCR commands.
If an exhausted counter is evicted after EXISTS observes it but before INCR,
Redis recreates it at 1 without a TTL and the throttle admits another request.
This is a conditional key-loss race, not a demonstrated normal-operation or
client-controlled eviction bypass. It violates the required safe-expiration gate;
ordinary multi-process admission counts do not test this interleaving.

Database-free reproduction:
`backend/.venv/bin/python /tmp/devjobs-m1-independent-race.py` confirmed the
failure for registration (5) and refresh (30), executing the actual project
throttles and installed Django RedisCache add/incr with a simulated Redis command
interleaving. No live Redis, Docker or database was used. The first inline probe
failed because its request stub omitted headers; the corrected helper passed both
assertions. This is a deterministic command-interleaving simulation, not a live
Redis eviction experiment. Resolve with an atomic counter/expiration operation
and add key-loss/TTL regressions before repeating the full independent gate.

Baseline branch/HEAD match `feat/admin-workspace-final` /
`bd9a9c8942bf9f6f6e0ab31840406794c0e2b83f`; initial git diff --check PASS.
The 13 dirty paths match the expected milestone plus unrelated operations notes.
Historical test results above were not independently reconfirmed: full tests,
frontend, OpenAPI, Docker availability/cleanup and Redis multi-process runs were
not executed after the security stop. No staged export, tree verification or
commit exists for this audit. No hosted CI claim. Implementation, API/schema,
production settings and existing documentation text remain unchanged; only this
append-only finding is added to PROJECT_STATUS.md and docs/TESTING_STRATEGY.md.
Existing operations notes remain uncommitted. No database/service/container
access or mutation, push, merge, deployment or PR #1 modification occurred.

## Redis throttle atomicity remediation — 2026-11-12

The independent gate above found a real command-boundary defect: Django 5.2.19
RedisCacheClient.incr sends EXISTS then INCR. Key loss between those commands
recreates a counter at 1 with TTL -1. SET NX EX in the preceding cache.add does
not protect the later increment. Installed redis-py 6.4.0 sends EVAL as one command.

`apps/accounts/throttles.py` now executes one small Lua script on Django's
configured Redis write client (including key prefix/version, connection pool,
credentials and socket timeouts). Missing counters use SET EX; existing valid
counters increment within the script, retaining their expiration. Counters
saturate at the admission limit, returning limit+1 for rejected requests without
unbounded integer growth. Legacy persistent valid counters receive an expiration
without resetting their count. Invalid values and Redis/ACL/network/OOM failures
propagate and deny admission; there is no Redis-to-memory fallback. Configured
non-Redis development/test caches retain their prior behavior. Production still
requires Redis. No changes to prod.py, rates, JWT policy or API contracts.

Both minute buckets retain 120-second storage TTLs and absolute fixed-window key
selection. Ordinary expiry cannot reset an active window; existing TTLs are not
extended by requests. A deleted key is recreated with a positive TTL, but its
previous quota cannot be recovered. Eviction, restart, failover data loss and
administrative deletion can still reset a quota. Before release, verify a
capacity-planned Redis deployment with `maxmemory-policy noeviction`, adequate
memory headroom, monitoring/alerts for used_memory/maxmemory, evicted_keys,
rejected writes, availability and restarts, plus an outage/restart runbook.
Noeviction trades quota loss for fail-closed write errors; it cannot prevent
restart/failover loss. Redis ACLs must permit EVAL and GET/SET/PTTL/EXPIRE/INCR on
the configured prefixed keys. These are deployment gates, not configuration
changes applied by this task. Clock skew/window-edge bursts and existing login
DRF cache-history limitations remain. Recheck Django's private Redis client
adapter on dependency upgrades.

`apps/accounts/redis_throttle_tests.py` contains six database-free real-Redis
regressions. They verify creation, increment, retained TTL, saturation including
an int64-maximum counter, persistent-counter repair, actual expiration,
deletion/recreation, bucket isolation, next-window recovery, concurrent first and
quota-boundary requests, invalid counters and propagated connection failure.
The old race is reproduced against actual Redis by deleting a key inside the
installed backend's EXISTS hook: INCR returns 1 with TTL -1. The replacement is
then exercised with the same hook armed: EXISTS is never called and TTL is
positive. Existing hardening API tests retain shared Candidate/Recruiter quota,
HTTP 429/Retry-After, JWT success/lifetimes and login/refresh isolation coverage.

The six tests require REDIS_THROTTLE_TEST_URL explicitly; normal PostgreSQL runs
skip them rather than selecting an existing Redis. The temporary helper
`/tmp/devjobs-redis-atomic-check.py` extends the prior ten-process harness, creates
an owned randomly labelled password-protected redis:7.4-alpine container with
persistence disabled and a loopback random port, and invokes
`/tmp/devjobs-redis-regressions.py` with that URL. The latter configures Django
without a database and runs the checked-in unittest class. After six tests, ten
independent workers make 200 attempts per scope using a shared generated HMAC
secret and controlled clock. Exactly 5 registration / 30 refresh requests pass.
The helper verifies both stored TTLs, deletes only this disposable container's
counters, repeats ten workers with exactly 5/30 admissions, verifies TTLs again,
then rechecks the ownership label and removes the container. Redis credentials
and helper artifacts are not checked in. Initial sandbox Docker access was
denied before a container was created; the approved rerun passed. Initial Ruff
identified import order and a loop closure binding, corrected before validation.

Actual verification commands (repository root unless noted):

| Command | Result |
| --- | --- |
| `backend/.venv/bin/ruff check backend` | PASS |
| `backend/.venv/bin/ruff format --check backend/apps/accounts/throttles.py backend/apps/accounts/redis_throttle_tests.py backend/apps/accounts/hardening_tests.py backend/apps/accounts/serializers.py` | PASS, 4 files |
| `backend/.venv/bin/python /tmp/devjobs-redis-atomic-check.py` | PASS, six real-Redis tests, ten processes 5/30 admissions before and after recreation; positive TTLs; owned Redis cleaned |
| `backend/.venv/bin/python /tmp/devjobs-m1-targeted.py` | PASS, auth 37, jobs 11, full PostgreSQL 159 passed / 6 Redis tests explicitly skipped (39.62s); system check and migration consistency PASS; owned cluster cleaned |
| `cd backend && .venv/bin/python -m unittest config.test_e2e_safety_unit config.test_e2e_runtime_unit` | PASS, 16 |
| `cd frontend && npm run lint && npm test && npm run build` | PASS, 62 tests / 17 files; existing JSDOM and bundle advisories |
| `/tmp/devjobs-m1-schema-tools/bin/python scripts/validate_openapi.py` | PASS, 39 paths / 55 operations, six serializer field sets, three negative controls |
| `backend/.venv/bin/python backend/run_browser.py` | PASS, system/migration checks, PostgreSQL 159 passed / 6 Redis-only skipped (39.66s), Chromium 1/1 (32.3s scenario), zero browser errors; cleanup PASS |
| `backend/.venv/bin/python backend/run_browser_concurrent.py` | PASS, both PostgreSQL suites 159 passed / 6 Redis-only skipped (40.31s each), both peer service/cluster/credential isolation checks, Chromium 1/1 each (32.8s scenarios), zero browser errors; cleanup PASS |
| `docker ps -aq --filter label=devjobs.e2e` and `docker ps -aq --filter label=devjobs.m1.redis` | PASS, no containers remain |
| `lsof -nP` on the ten PostgreSQL/backend/frontend verification ports with `-sTCP:LISTEN` | No listeners (exit 1 / empty output) |
| `git diff --check` | PASS |

Only this section, an appended PROJECT_STATUS.md entry, throttles.py and the new
redis_throttle_tests.py were changed for this remediation. All prior working-tree
changes and local operations notes are preserved. No migrations, dependencies,
secrets, production settings, authorization or existing development/test database
changes. Four owned PostgreSQL containers and one owned Redis container cleaned;
unrelated Docker resources untouched. Branch/HEAD remain
feat/admin-workspace-final / bd9a9c8942bf9f6f6e0ab31840406794c0e2b83f;
index empty, no commit/push/merge/deploy. Ready for a new independent local audit,
with production operational gates and historical warnings above still applicable.


## Final independent Milestone 1 verification — 2026-11-12

Eight real-Redis regressions now include exhausted-counter deletion/recreation
for both quotas and propagated authentication, ACL and script errors. The real
old EXISTS hook race returns 1 with TTL -1; the replacement avoids EXISTS and
creates expiring counters. Ten independent processes admit exactly 5/30 before
and after deletion. Lua saturates before INCR, including int64 maximum input;
existing TTLs do not slide, persistent valid counters receive TTL repair.
The configured write pool and key prefix/version are used. No second Redis URL
or credentials are embedded. HMAC keys and separate scopes isolate auth buckets.
Default NUM_PROXIES=0 ignores spoofed forwarded headers; nonzero trusted-hop
configuration requires sanitized ingress. NAT users share limits.

Actual working-tree commands and results:

| Command | Result |
| --- | --- |
| `backend/.venv/bin/ruff check backend` | PASS |
| `backend/.venv/bin/ruff format --check backend/apps/accounts/throttles.py backend/apps/accounts/redis_throttle_tests.py backend/apps/accounts/hardening_tests.py backend/apps/accounts/serializers.py` | PASS, four files |
| `backend/.venv/bin/ruff format --check --config backend/ruff.toml /tmp/devjobs-m1-job-format.py` | PASS, extracted added job methods; unrelated legacy formatting retained |
| `cd backend && .venv/bin/python -m unittest config.test_e2e_safety_unit config.test_e2e_runtime_unit` | PASS, 16 |
| `backend/.venv/bin/python /tmp/devjobs-m1-targeted.py` | PASS, auth 37, jobs 11, full 159 passed / 8 Redis-only skipped; system and migration checks PASS |
| `backend/.venv/bin/python /tmp/devjobs-redis-atomic-check.py` | PASS, 8 Redis tests, ten processes 5/30 before/after deletion, positive TTLs and cleanup |
| `backend/.venv/bin/python /tmp/devjobs-final-failure-probe.py /Users/jatinkumarchaurasia/Downloads/devjobs` | PASS, 12 real-endpoint failure cases, generic 500, private sentinel absent, exception diagnostics captured; no database configured |
| `/tmp/devjobs-m1-schema-tools/bin/python scripts/validate_openapi.py` | PASS, 39 paths/55 operations, six field sets/three negative controls |
| `cd frontend && npm run lint && npm test && npm run build` | PASS, 62 tests/17 files |
| `backend/.venv/bin/python backend/run_browser.py` | PASS, 159 passed/8 skipped, Chromium 1/1, zero browser errors |
| `backend/.venv/bin/python backend/run_browser_concurrent.py` | PASS, both 159 passed/8 skipped, both ownership-rejection checks, Chromium 1/1 each, zero browser errors |
| `git diff --check` | PASS |

Logs use `/tmp/devjobs-final-audit-working-{browser,targeted,concurrent}.log`.
The first standalone attempt was denied Docker access before resource creation;
approved rerun passed. One safety command used an incorrect relative executable
path (exit 127); corrected backend-local command passed. An introspection import
without Django settings failed; installed sources were read directly instead.
JSDOM getComputedStyle, Ant Design and bundle-size advisories remain non-failing.

Independent staged verification uses a fresh `git checkout-index` export of the
exact index, checks every tracked blob and executable bit, and excludes unrelated
operations notes/untracked artifacts. Only installed dependency directories are
linked from the checkout; application/test source is the export. Temporary
`/tmp/devjobs-final-snapshot-targeted.py` and Redis helpers replace all checkout
source roots with the exported root while retaining reviewed isolation guards.
Run from that export: the same Ruff/format/safety/OpenAPI/frontend commands,
standalone and concurrent runners, plus exported targeted/Redis/failure probes.
All must pass before commit. Exact exported tree and post-verification commit
identity are reported at delivery without changing that tested tree.
No existing development database or devjobs_test is selected; PostgreSQL uses
verified owned tmpfs clusters and Redis uses owned disposable containers only.
No hosted CI assertion. Redis eviction/restart/failover resets, fixed-window
boundary bursts, clock skew, NAT capacity and private Django adapter compatibility
remain limitations; required production noeviction/monitoring/ACL gates are in
API_CONVENTIONS.md. Production errors retain generic 500; a controlled 503 needs
an explicit contract change. No deployment architecture change was made.

## Milestone 2, Stage 1 — M-05 query growth — 2026-11-12

Scope: existing candidate application and recruiter applicant lists, and admin
candidate/recruiter moderation collections. There is no admin application
moderation collection in this API. Admin company/job lists already use scalar
fields/company joins; history serializes the administrator foreign-key ID without
loading its user. Overview uses four counts. Application detail, creation and
status responses serialize one application, so their fixed related-object reads
are not N+1 list growth; their querysets and authorization remain unchanged.

Original application lists selected job/company/candidate but loaded candidate
user, optional resume and skills separately per result. Recruiter lists also ran
two wasted skill prefetch queries: serializer order_by/values_list bypassed the
cache. Candidate lists repeated these reads even for the same candidate.
Admin representation tried candidate_profile and then recruiter_profile, causing
one extra query per candidate or two per recruiter (including absent relations).

Application lists now join job/company, candidate/user and optional resume and
use one ordered CandidateSkill/Skill Prefetch with to_attr. Serializer iteration
consumes that list; single-object callers retain an ordered queryset fallback.
Database skill ordering, including collation, is retained. Admin collection GET
joins both optional profiles, preserving missing-profile fallback. These nullable
joins are deliberately kept out of moderation select_for_update mutation paths.
To-many relationships are prefetched, not joined, preserving pagination counts
and preventing duplicate application rows. Page size 20 / maximum 100 unchanged.

Actual HTTP SQL measurements (forced authentication; fixture creation excluded):

| Endpoint | Records | Before | After |
| --- | ---: | ---: | ---: |
| Candidate applications | 1 | 6 | 4 |
| Candidate applications | 5 | 18 | 4 |
| Candidate applications | 20 | 63 | 4 |
| Recruiter applicants | 1 | 12 | 8 |
| Recruiter applicants | 5 | 24 | 8 |
| Recruiter applicants | 20 | 69 | 8 |
| Admin candidates | 1 | 3 | 2 |
| Admin candidates | 5 | 7 | 2 |
| Admin candidates | 20 | 22 | 2 |
| Admin recruiters | 1 | 4 | 2 |
| Admin recruiters | 5 | 12 | 2 |
| Admin recruiters | 20 | 42 | 2 |

Candidate totals comprise profile lookup, count, joined page, skill prefetch.
Recruiter totals additionally include job lookup and existing recruiter/user/
company/membership authorization reads. Admin totals are count plus joined page.
Before: application skill/user/resume lookups each occur N times; recruiter has
two additional prefetch queries. After: one skill query per application page,
zero separate per-row user/resume/profile reads. Query tests print table-specific
FROM counts for inspecting these patterns; joined relations are in the page SQL.

`backend/apps/applications/query_tests.py` adds five PostgreSQL HTTP tests:
three growth guards at 1/5/20 rows, visibility/pagination/permissions, and missing
admin profiles/state filtering. Distinct recruiter candidates/users/skills/resumes
and candidate jobs/companies prevent identity reuse from hiding defects. Growth
is allowed at most one SQL query across sizes to tolerate a fixed setup query;
it cannot admit per-row reads. All three growth tests failed on original code,
and passed after optimization. The initial admin baseline stopped at its first
assertion; the corrected baseline gathers both admin collections before asserting.
Other checks cover field values, sorted skills, resume availability/missing/
withdrawn/inactive cases, duplicate-free ordering across pages, candidate isolation,
outsider/MEMBER denial, company ADMIN access, admin denial and private-key absence.
Existing application/moderation tests cover detail/status/resume permissions.

Verification commands use only independently verified owned PostgreSQL 17 tmpfs
clusters. A temporary helper `/tmp/devjobs-m2-measure.py` copies the committed
runner's lifecycle/identity guards, fixes ROOT to this checkout and runs just
query_tests.py after migration/checks. `/tmp/devjobs-m2-targeted.py` uses the same
guards, running applications/api_tests.py plus applications/query_tests.py,
moderation/tests.py, then the full suite. Neither helper is a repository artifact.
Logs: `/tmp/devjobs-m2-{before-all,after,targeted,browser,concurrent}.log`.
No latency measurements or latency improvement claim. Query count is bounded by
page size; skill payload/memory still grows with skills per candidate. Single
object reads retain fixed costs; no unrelated endpoint optimization or M-06/M-07.

Final verification (all commands from repository root unless noted):

| Command | Result |
| --- | --- |
| `backend/.venv/bin/python /tmp/devjobs-m2-measure.py` (before / after) | Original: 3 growth tests FAIL as expected; optimized: 3 PASS; all 12 measurement rows above verified |
| `backend/.venv/bin/python /tmp/devjobs-m2-targeted.py` | PASS: applications/query 12, moderation 8, full 164 passed / 8 Redis-only skipped (39.98s); Django check and migration consistency PASS |
| `backend/.venv/bin/ruff check backend` | PASS |
| `backend/.venv/bin/ruff format --check backend/apps/applications/api.py backend/apps/applications/query_tests.py backend/apps/moderation/api.py` | PASS, 3 files |
| `cd backend && .venv/bin/python -m unittest config.test_e2e_safety_unit config.test_e2e_runtime_unit` | PASS, 16 tests, before database-backed execution |
| `cd frontend && npm run lint && npm test && npm run build` | PASS, 62 tests / 17 files |
| `/tmp/devjobs-m1-schema-tools/bin/python scripts/validate_openapi.py` | PASS, 39 paths / 55 operations, six serializer field sets and three negative controls |
| `backend/.venv/bin/python backend/run_browser.py` | PASS: full 164 passed / 8 skipped (41.00s); Chromium 1/1 (32.7s scenario), zero browser errors; cleanup PASS |
| `backend/.venv/bin/python backend/run_browser_concurrent.py` | PASS: both full suites 164 passed / 8 skipped (41.25s / 41.55s), both peer ownership rejections, Chromium 1/1 each (32.2s / 32.3s), zero browser errors; cleanup PASS |
| `docker ps -aq --filter label=devjobs.e2e` | PASS, empty after all runs; seven owned measurement/verification containers removed |
| `lsof -nP` with `-sTCP:LISTEN` on all 13 logged verification ports | PASS, empty / exit 1 (no listeners) |
| `git diff --check` | PASS |

Safety review before DB-backed execution verified explicit environment/URL checks,
owned tmpfs containers, independently compared pg_control_system identity, removed
inherited DATABASE_URL/PG variables and disabled dotenv. Existing development DBs
and devjobs_test were not accessed. Initial sandbox safety run could not bind
loopback sockets; approved rerun passed all 16 tests. Baseline failure was expected;
no security controls were disabled. Existing JSDOM/Ant Design, NO_COLOR/Babel and
bundle-size advisories remain non-failing. Redis-only tests were skipped because
this stage does not provision Redis or alter throttles. No hosted CI claim.

Task files: applications/api.py, applications/query_tests.py, moderation/api.py,
this document and append-only PROJECT_STATUS.md. Existing LOCAL_DEVELOPMENT.md
operations edits remain byte-for-byte untouched; prior PROJECT_STATUS.md bytes
remain an unchanged prefix. No migrations, dependencies, API/auth/permission,
production settings or secrets changed. Starting/ending branch/HEAD:
feat/admin-workspace-final / 77625e0a5f7c70314e8d833b0069e9a2fd44c23c.
Index remains empty. Nothing staged, committed, pushed, merged, deployed or changed
on PR #1. M-06/M-07 and Stage 2 were not started.

### Independent M-05 audit — 2026-11-12

Working-tree commands independently repeated (all PASS unless stated):
- `backend/.venv/bin/ruff check backend`
- `backend/.venv/bin/ruff format --check backend/apps/applications/api.py backend/apps/applications/query_tests.py backend/apps/moderation/api.py`
- `cd backend && .venv/bin/python -m unittest config.test_e2e_safety_unit config.test_e2e_runtime_unit` (16)
- `backend/.venv/bin/python /tmp/devjobs-m2-targeted.py` (12 applications/query, 8 moderation, full 164 passed/8 Redis-only skipped; system/migration checks)
- `backend/.venv/bin/python /tmp/devjobs-independent-m2-measure.py` (3 growth tests, all optimized counts reproduced using `-s`)
- `backend/.venv/bin/python /tmp/devjobs-independent-m2-baseline.py` (expected FAIL: all 3 growth guards on separate original HEAD export; all baseline counts reproduced)
- `/tmp/devjobs-m1-schema-tools/bin/python scripts/validate_openapi.py` (39 paths/55 operations)
- `cd frontend && npm run lint && npm test && npm run build` (62 tests/17 files)
- `backend/.venv/bin/python backend/run_browser.py` (164 passed/8 skipped; Chromium 1/1, zero browser errors)
- `backend/.venv/bin/python backend/run_browser_concurrent.py` (164 passed/8 skipped each; both peer checks; Chromium 1/1 each)

Logs use `/tmp/devjobs-independent-m2-*.log`; helpers are unversioned session
artifacts inspected for owned tmpfs/cluster identity and cleanup guards before use.
Initial sandbox Docker inspection was denied; permitted rerun succeeded. Baseline
FAIL is intentional and cleaned its owned cluster. Existing JSDOM/Ant Design and
bundle warnings remain. No latency or hosted CI claim. Exact-index export repeats
Ruff/format/safety/schema/frontend and both browser commands plus the targeted
helper adapted only to the exported backend ROOT. All application source used by
those checks comes from the export; environment dependencies are reused. Final
results/tree/commit/cleanup are reported separately to keep the tested tree fixed.

## Milestone 2 Stage 2A — opt-in pagination (2026-11-13)

`config/collection_pagination_tests.py` exercises all three authorized GETs over
104 skills / 105 memberships / 105 recruiter companies in the verified disposable
PostgreSQL runner. Three HTTP tests use per-endpoint subtests for legacy field/order
identity, ignored page-only parameters, default/maximum/capped sizes, two pages,
last page, navigation links, invalid modes/pages/sizes, empty caller collections,
role/authentication boundaries, caller/company counts, MEMBER denial and suspended
company exclusion/denial. Existing company/profile/service tests retain mutation,
canonicalization, ownership-transfer and inactive-membership coverage.

SQL capture at page sizes 1/20/100 requires database COUNT and LIMIT, exact returned
page size, and constant query counts per endpoint. The helper slices before calling
the serializer; existing joins remain. Unique skill names need no new tie-breaker.
Company-members empty success is unreachable under active OWNER/ADMIN authorization;
empty envelope behavior is tested through both other endpoints. No benchmark or
latency/memory claim; legacy collections remain unbounded. M-06 remains open.

Verification uses `/tmp/devjobs-stage2a-targeted.py`, copied from the documented
owned-container runner with ROOT fixed to this checkout, targeted pytest invocations
inserted, and browser fixture/startup omitted. Its identity verification, inherited
DB-variable clearing, tmpfs ownership and exact-resource cleanup remain intact.
No existing development/test database is used. Temporary helper is not source.

Commands and local results (repository root unless indicated):

| Command | Result |
|---|---|
| `backend/.venv/bin/python /tmp/devjobs-stage2a-targeted.py` | PASS: targeted companies API + candidates API + pagination 16; companies/recruiters services 27; full PostgreSQL 167 passed / 8 Redis-only skipped (72.40s); system check and migration consistency PASS |
| `backend/.venv/bin/ruff check backend` | PASS |
| `backend/.venv/bin/ruff format --check backend/config/collection_pagination.py backend/config/collection_pagination_tests.py` | PASS |
| `backend/.venv/bin/ruff format --check --range 81-89 backend/apps/candidates/api.py` | PASS |
| `backend/.venv/bin/ruff format --check --range 154-164 backend/apps/companies/api.py` | PASS |
| `backend/.venv/bin/ruff format --check --range 64-77 backend/apps/recruiters/api.py` | PASS; only changed methods formatted; surrounding historical style retained |
| In `backend/`: `.venv/bin/python -m unittest config.test_e2e_safety_unit config.test_e2e_runtime_unit` | PASS: 16 |
| `/tmp/devjobs-m1-schema-tools/bin/python scripts/validate_openapi.py` | PASS: 39 paths / 55 operations, six field sets and three negative controls |
| In `frontend/`: `npm run lint`, `npm test`, `npm run build` | PASS: 62 tests / 17 files; existing JSDOM warnings and 755.17 kB bundle advisory |
| `backend/.venv/bin/python backend/run_browser.py` | PASS: 167 passed / 8 skipped (68.07s), Chromium 1/1 (36.7s scenario), zero browser errors; 15 existing Ant Design warnings; cleanup PASS |

An offline semantic comparison against HEAD confirmed that only the three approved
GET OpenAPI operations changed; other operations and components are identical.
Initial schema-generation attempts had indentation/newline errors; corrected before
the successful validator. Initial synthetic fixture omitted required profile names
(13 passed / 3 setup errors); corrected before final runs. Initial sandbox attempts
could not access Docker/bind sockets; rerun with approved access, safety 16 PASS.
Range formatting initially identified formatting changes, applied only within the
three GET methods and rechecked successfully. These are local results, not hosted CI.
Redis-only tests were skipped because these PostgreSQL workflows do not provision
Redis; throttles are unchanged and Redis integration was not rerun in this task.

`backend/.venv/bin/python backend/run_browser_concurrent.py` PASS: both full
PostgreSQL suites 167 passed / 8 skipped (72.65s / 72.78s), both peer
service/cluster/credential rejection checks, Chromium 1/1 each (33.4s / 33.9s
scenarios), zero browser errors and 15 existing Ant Design warnings per scenario.
Standalone and concurrent workflows retain skill management, company selection,
membership management and role restrictions against default legacy arrays.
All five owned PostgreSQL containers (including the initial failed fixture run)
were removed; unrelated stopped `welcome-to-docker` remains. No listeners on the
ten final logged verification ports: 63737, 63756, 63757, 63758, 63795, 63796,
63797, 63798, 63799, 63800. No unrelated Docker resources removed.
Final baseline branch/HEAD/tree unchanged; index empty. Initial PROJECT_STATUS.md
bytes retained as a prefix and LOCAL_DEVELOPMENT.md identical to its initial copy.
No staging, commit, push, merge, deployment, PR #1 edit or Stage 2B/2C work.

## Independent Stage 2A audit and exact-index commit gate — 2026-11-13

Independent implementation/security review found no serious defect. Authorization,
caller/company filters and deterministic ordering precede COUNT and slicing; joins
are retained and mutation methods, schema/indexes, dependencies, frontend and
production settings are unchanged. Repeated query parameters consistently use the
last value in Django/DRF; both mode orders are regression-tested. No authorization
or count-scope bypass was found. Added coverage asserts independent names/field
sets, active ADMIN access, retained query parameters, huge invalid pages and SQL
LIMIT/OFFSET. Five pagination tests now include actual datasets of 100/20/1 rows
and page sizes 1/20/100: skills 3/3/3 queries, recruiter companies 3/3/3, company
members 6/6/6, using force-authenticated HTTP requests. Legacy arrays still bypass
pagination. Existing tests exercise ownership transfer, skill normalization and
POST/DELETE contracts. Missing-profile behavior is preserved by unchanged lookups.
COUNT/sort/deep-offset costs and concurrent-write page drift remain; no measured
latency, memory or payload improvement is asserted. M-06 remains open.

Final working commands (all PASS):
- `backend/.venv/bin/python /tmp/devjobs-stage2a-targeted.py` with log
  `/tmp/devjobs-stage2a-independent-working-final-targeted.log`: system/migration
  checks, targeted API/pagination 18, company/recruiter services 27, full PostgreSQL
  169 passed / 8 Redis-only skipped.
- `backend/.venv/bin/ruff check backend`; documented new-file and three changed
  method range format checks; `git diff --check`.
- In backend: `.venv/bin/python -m unittest config.test_e2e_safety_unit config.test_e2e_runtime_unit`
  (16 passed).
- `/tmp/devjobs-m1-schema-tools/bin/python scripts/validate_openapi.py`: OpenAPI 3.1,
  39 paths/55 operations, six field sets and three negative controls. Independent
  semantic comparison with HEAD found only the three approved GETs changed.
- In frontend: `npm run lint && npm test && npm run build`: 62 tests/17 files.
- `backend/.venv/bin/python backend/run_browser.py`: full 169/8, Chromium 1/1,
  zero browser errors; final log uses the independent-working-final-browser suffix.

Exact staged export repeats Ruff, formatting, system/migration checks, targeted
18 and services 27, full PostgreSQL, OpenAPI, safety 16, frontend lint/tests/build,
standalone and concurrent Chromium. Export uses only Git-tree source and reused
installed dependencies; the temporary targeted helper changes only backend ROOT
and import path. Tracked bytes/modes are verified before and after. Export results,
tree SHA and single local commit identity are reported at delivery, keeping the
verified tree fixed. Earlier intermediate runs passed 167/168 before the added
tests; they do not replace the final gates. Initial sandbox Docker access failed;
approved isolated reruns succeeded. Hosted CI was not run. Existing JSDOM,
Ant Design and bundle warnings remain. No Stage 2B/2C, remote or deployment work.

Final working concurrent command `backend/.venv/bin/python backend/run_browser_concurrent.py`
PASS: 169 passed / 8 skipped in each cluster; both peer rejection checks and
Chromium 1/1 each, zero browser errors. Log:
`/tmp/devjobs-stage2a-independent-working-final-concurrent.log`. All owned runs
reported cleanup. Unrelated stopped Docker resources are preserved.

## Stage 2B.1 recruiter company discovery — 2026-11-13

Added two PostgreSQL HTTP tests to collection_pagination_tests.py: trimmed/case
search, 200-character/NUL validation, exact/blank/malformed/inaccessible UUIDs,
combined intersections, legacy ignored filters, repeated last-value parameters,
link preservation, filtered count and second-page LIMIT/OFFSET; suspended companies
and inactive memberships remain excluded. Existing size 1/20/100 query-growth,
authorization and legacy contracts continue to run.

Frontend coverage now includes exact membership roles/loading/empty/error/retry,
rapid switching and stale responses, logout invalidation, picker manual paging,
deduplication/external selection/search races/error retry, directory count/page/
search reset/context/retry, dashboard total versus page length and explicit
selection outside page one, plus API parameter allowlisting and AbortSignal.
The expanded disposable Chromium scenario creates 21 extra companies via the
existing authenticated API, discovers/searches the 22nd via UI, resolves its
membership and switches back. Existing OWNER/MEMBER and three-role workflows
remain; ADMIN permission behavior is covered by unit/backend tests rather than a
new browser role fixture. No development database fixtures were written.

Commands and final local results:

- `backend/.venv/bin/python /tmp/devjobs-stage2a-targeted.py > /tmp/devjobs-2b1-targeted.log 2>&1`: PASS, targeted API/pagination 20; company/recruiter services 27; full PostgreSQL 171 passed / eight Redis-only skipped (48.59s); Django system and migration consistency checks PASS.
  Temporary helper is the previously documented owned-runner derivative: ROOT
  targets this checkout, verified fresh tmpfs PostgreSQL cluster, generated
  credentials, inherited DB environment scrubbed, e2e_exec identity guard, exact
  ownership cleanup. No development fallback. Initial run: 19/20, caught DRF
  HTML-form empty optional UUID omission; explicit last-value mapping fixed it.
- `backend/.venv/bin/ruff check backend`: PASS.
- `backend/.venv/bin/ruff format --check --config backend/ruff.toml /tmp/devjobs-2b1-format.py backend/config/collection_pagination_tests.py`: PASS. Temporary file contains changed RecruiterCompaniesView and filter serializer; unrelated pre-existing formatting retained. First temporary check omitted project config and failed on default line length; corrected command above passes.
- From backend: `.venv/bin/python -m unittest config.test_e2e_safety_unit config.test_e2e_runtime_unit`: PASS, 16 tests. Initial root-qualified invocation failed import resolution; corrected backend working directory passes.
- `/tmp/devjobs-m1-schema-tools/bin/python scripts/validate_openapi.py`: PASS, 39 paths / 55 operations, six field sets, three negative controls.
- `npm run lint --prefix frontend`, `npm test --prefix frontend`, `npm run build --prefix frontend`: PASS, 75 tests / 18 files. Initial new tests needed Ant Design searchbox selector and mock call reset; corrected. Existing JSDOM diagnostics and bundle-size advisory remain non-failing.
- `backend/.venv/bin/python backend/run_browser.py > /tmp/devjobs-2b1-browser.log 2>&1`: PASS, full PostgreSQL 171/8 (47.67s), Chromium 1/1 (36.1s), zero browser errors, 17 known Ant Design warnings; owned resources cleaned.

Legacy arrays are still unbounded for clients outside this migration. M-06 remains
open; Stage 2B.2/2B.3/2C and M-07 aggregation optimization are not implemented.
COUNT/sort/deep OFFSET costs and concurrent-write page drift remain. No latency,
production, hosted CI, Redis-only integration or cross-browser certification.

Final concurrent command:
`backend/.venv/bin/python backend/run_browser_concurrent.py > /tmp/devjobs-2b1-concurrent.log 2>&1`
PASS: full PostgreSQL 171 passed/eight Redis-only skipped each (46.93s/46.95s),
both peer service/cluster/credential ownership rejections PASS; Chromium 1/1 each
(37.4s each), zero browser errors, 17 known Ant Design warnings per scenario.
Both owned containers and services cleaned. Final Docker inventory contains only
the pre-existing stopped welcome-to-docker container 8b3d57ba510f. Four successful
owned clusters total (targeted, standalone, concurrent pair), plus the initial
failed targeted run's cluster, were cleaned. Final lsof checks found no listeners
on ports 60172, 60233, 60234, 60247, 60894, 60895, 60896, 60897, 60917, 60918.

Final Git checks: status/name-status reviewed, diff --check PASS, cached stat empty;
branch feat/admin-workspace-final, HEAD 6f4f6bab00f68aba9d558996d42f2e868255c3a7,
committed tree 2112fb7ec4d5a93e2f5f882eda877d778afaea82 unchanged. No stage/commit/
push/merge/deploy/PR modification. Original PROJECT_STATUS bytes verified as exact
prefix, LOCAL_DEVELOPMENT bytes unchanged against initial backups. Existing dirty
operations notes remain outside this task. No existing database/service mutated.


## Independent Stage 2B.1 audit stop — 2026-11-13

**FAIL; stopped before staging or committing under the requested serious
correctness-defect stop rule.** useCompanyMembership retains its previous result
and keys it only by user ID, company ID and retry revision. After A resolves as
OWNER, switch to B with its request pending, then return to A. The old A key
matches again and restores canManage=true while the new A request is unresolved.
This is a reproducible stale-permission UI failure; no backend authorization
bypass or cross-tenant database disclosure has been demonstrated. A revoked or
changed A membership can therefore retain stale management controls until lookup
completes. Starting a new lookup must invalidate prior results even when returning
to the same company; keep stale-response protection and cover this sequence.

Added a narrow failing regression in
frontend/src/features/companies/discovery.test.jsx. Independent command from
frontend/: `npm test -- --run src/features/companies/discovery.test.jsx`:
**FAIL, 1 failed / 10 passed**. The A -> B -> A assertion expects canManage=false
but receives true. Implementation was left unchanged for remediation.

Baseline verified: branch feat/admin-workspace-final, HEAD
6f4f6bab00f68aba9d558996d42f2e868255c3a7, committed tree
2112fb7ec4d5a93e2f5f882eda877d778afaea82; initial index empty and
git diff --check PASS. Full backend/frontend, OpenAPI, runner safety, standalone
and concurrent Chromium, Docker/listener inventory and staged-snapshot gates were
not run after this stop. Historical passes do not satisfy this independent gate.
No staged tree or commit created. No database, Docker resource or service accessed
or modified. Original documentation bytes preserved as prefixes; unrelated
LOCAL_DEVELOPMENT.md unchanged (SHA-256
6f241a47289e316ad893d3e153a9bf5bb1b7c89d8cc1d56c4a4561c04c881e60).
Initial whole PROJECT_STATUS.md SHA-256 before this audit:
9866008e42e2b79fc9a1ff10861dc602353548b346570af431643f1636e4f859.
No hosted CI verification, push, merge, deployment or PR #1 modification.
M-06 remains open; Stage 2B.2/2B.3/2C and M-07 were not started.


## Stage 2B.1 stale membership permission repair — 2026-11-13

**PASS for focused remediation; independent audit remains pending.** Reproduced
existing A -> B -> A regression: discovery suite failed 1/11 because returning to
A matched the retained user/company/retry key and exposed cached OWNER permissions
before the new lookup completed. Historical audit failure above is preserved.

useCompanyMembership now rotates an explicit selection resolution identity in
conditional render-time state when user ID, company ID or retry revision changes.
The changing render returns loading without membership; subsequent renders accept
only results carrying that exact identity. Returning to A or an earlier user is a
new lookup. Effect cleanup retains both AbortController cancellation and a live
flag to ignore completions after switching or unmount, including transports that
ignore abort. Errors and missing memberships cannot recover old permissions.
Hook API usage remains compatible; no backend/API/schema/dependency changes.

Inspected all hook consumers in RecruiterPages and RecruiterLayout: management
controls depend on current canManage/membership and pending lookups expose neither.
CompanyPage uses a separate lookup, clears membership on reload, hides the form
while loading and remounts by company ID. Existing tenant/job remounts and data
identity guards retained; no consumer implementation changes needed. Server-side
authorization remains authoritative and unchanged.

Commands from frontend/:
- `npm test -- --run src/features/companies/discovery.test.jsx`: PASS, 19 tests;
  original A -> B -> A regression unchanged. Eight additional cases cover both
  OWNER/MEMBER directions, every-render pending state and disabled controls,
  retry failure/empty after OWNER, older OWNER responses after new MEMBER result,
  aborted unmount and logout/user changes followed by original identity return.
- `npm test -- --run src/features/companies/CompanyPage.test.jsx`: PASS, 2 tests.
- `npm test -- --run src/features/jobs/pages/RecruiterPages.test.jsx`: PASS,
  11 tests, including added actual Create job/Applicants controls pending lookup.
- `npm run lint`: PASS.
- `npm test`: PASS, 85 tests / 18 files. Existing non-failing JSDOM pseudo-element
  getComputedStyle diagnostics remain.
- `npm run build`: PASS; existing >500 kB chunk advisory remains (756.31 kB).
Root `git diff --check`: PASS; `git status --short` reviewed;
`git diff --cached --stat`: empty. Initial/final branch feat/admin-workspace-final,
HEAD 6f4f6bab00f68aba9d558996d42f2e868255c3a7, committed tree
2112fb7ec4d5a93e2f5f882eda877d778afaea82 unchanged. Five repair paths only:
useCompanyMembership.js, discovery.test.jsx, RecruiterPages.test.jsx,
PROJECT_STATUS.md and docs/TESTING_STRATEGY.md. Documentation is append-only;
pre-repair PROJECT_STATUS bytes preserved as a prefix and LOCAL_DEVELOPMENT.md
preserved byte-for-byte. Existing Stage 2B.1 work and regression retained.

Remaining gates: repeat full independent audit and exact staged-snapshot
verification separately; no database-backed, browser E2E, Docker or hosted CI
checks run for this repair. Stage 2B.1 is uncommitted and M-06 remains open.
No staging, commit, push, merge, deployment or PR #1 change. Stage 2B.2 not begun.


## Resumed independent Stage 2B.1 audit stop — 2026-11-13

**FAIL; stopped before staging or committing.** A separate stale-permission
path remains in CompanyPage's CompanyEditor, which does not use the repaired
useCompanyMembership hook. Its component key is company ID only; its load
callback/effect depends on id/form, not authenticated user ID. After an OWNER
lookup succeeds, changing the authenticated recruiter while retaining the same
company route keeps the previous membership and enabled Save company and Add
membership controls indefinitely, without initiating a new membership lookup.
The repaired hook's identity invalidation therefore does not cover this screen.
This is a stale UI authorization defect; no server-side authorization bypass or
cross-tenant database disclosure was demonstrated. Invalidate editor permissions
synchronously on user identity changes and guard obsolete asynchronous results;
add identity-change coverage before resuming the independent acceptance gate.

Added one narrow regression in CompanyPage.test.jsx; existing assertions retained.
Commands from frontend/:
- `npm test -- --run src/features/companies/CompanyPage.test.jsx`: FAIL,
  one failed / two passed. Save company remains present and enabled after changing
  the authenticated user from self to other-recruiter with the same company route.
- `npm test -- --run src/features/companies/discovery.test.jsx src/features/jobs/pages/RecruiterPages.test.jsx`:
  PASS, 30 tests / two files. These passes do not cover the separate editor defect.
Root `git diff --check`: PASS; cached stat empty. Baseline branch
feat/admin-workspace-final, HEAD 6f4f6bab00f68aba9d558996d42f2e868255c3a7,
committed tree 2112fb7ec4d5a93e2f5f882eda877d778afaea82 unchanged.

The hook uses conditional same-component render-time state updates rather than
render-time ref mutation; identity comparison and effect live/abort guards were
inspected. Full Strict Mode/interrupted-render verification was not completed;
no full rendering-safety acceptance is claimed. Backend query construction and
frontend consumers were partially inspected before the defect stop; full SQL,
backend, lint/build, OpenAPI, runner safety, disposable PostgreSQL, standalone and
concurrent Chromium, exact staged-snapshot and post-commit gates were not run in
this resumed audit. Historical passes do not satisfy these gates. No staged tree
or commit exists. No Docker/database/listener was created, accessed or modified;
current Docker/listener inventory was not checked. Existing documentation bytes
preserved as exact prefixes; LOCAL_DEVELOPMENT.md untouched by this audit.
M-06 remains open (legacy arrays, COUNT/deep-offset costs, concurrent-write drift).
Hosted CI was not run. No push, merge, deployment, PR #1 edit or Stage 2B.2/2B.3.


## Stage 2B.1 CompanyPage cross-user permission repair — 2026-11-13

**PASS for focused repair; independent acceptance audit remains pending.**
Reproduced the unchanged audit regression: CompanyPage suite initially failed
1/3 because CompanyEditor was keyed only by company ID and its local membership
load did not depend on authenticated user identity. OWNER controls survived a
same-route recruiter change. The earlier hook repair did not cover this editor;
historical findings above are retained.

CompanyPage now keys CompanyEditor by user ID and company ID, resetting forms,
member lists, errors and pending operations on either change, including logout
and A -> B -> A. Authorization reuses the existing repaired useCompanyMembership
hook and its fresh resolution identity, abort and obsolete-response guards.
Pending/error/empty lookups grant no management permissions. Exact bounded
company-ID discovery remains unchanged; suspended/ineligible memberships remain
excluded by the existing backend lookup. No new company discovery or ownership
transfer UI was introduced. Existing CompanyPage has no ownership-transfer
control; role choices remain ADMIN/MEMBER and owner/self protections remain.

Company/details/member requests use effect-local live guards after each await;
obsolete responses cannot populate the current editor. A commit-time layout-effect
permit invalidates retained mutation handlers on identity change/unmount and
revalidation; reload invalidates it immediately. Company create/edit, membership
create, role/status updates and removal all pass through the guard. In-flight
operations cannot update forms, navigate or trigger reload after invalidation.
Already-issued HTTP mutations are not cancelled/undone; server authorization
remains authoritative. No render-time ref mutation was added. Hook implementation
is unchanged. No backend/API/schema/dependency/production configuration changes.

Repair files only:
- frontend/src/features/companies/CompanyPage.jsx
- frontend/src/features/companies/CompanyPage.test.jsx
- PROJECT_STATUS.md (append only)
- docs/TESTING_STRATEGY.md (append only)

Regression coverage retains the original test and adds OWNER -> MEMBER/ADMIN,
unaffiliated/error/logout, A -> B -> A with late OWNER completion, same-user
company switching, old member-data completion, membership mutation/revalidation
failure and retry, post-logout mutation completion and retained form/role/status/
remove callbacks. Pending assertions run before controlled responses resolve.
Real Ant Design components render; thin test observers retain actual callbacks
for invocation after identity changes. OWNER/ADMIN success and MEMBER restrictions
pass. Missing membership also models the existing suspended-company exclusion;
no live backend suspension test was run in this focused repair.

Final commands from frontend/:
- `npm test -- --run src/features/companies/CompanyPage.test.jsx`: PASS, 15 tests.
- `npm test -- --run src/features/companies/discovery.test.jsx`: PASS, 19 tests.
- `npm test -- --run src/features/jobs/pages/RecruiterPages.test.jsx`: PASS, 11 tests.
- `npm run lint`: PASS, no warnings/errors.
- `npm test`: PASS, 98 tests / 18 files. Existing non-failing JSDOM pseudo-element
  getComputedStyle diagnostics remain.
- `npm run build`: PASS; existing 756.31 kB chunk advisory remains.
Root `git diff --check`: PASS; `git status --short` reviewed;
`git diff --cached --stat`: empty. Intermediate repair checks exposed mock-once
leakage after logout (fixed test reset) and a hook dependency lint warning (fixed
by binding stable retry). One npm invocation from repository root failed ENOENT;
all required commands were rerun successfully from frontend/.

Branch feat/admin-workspace-final, HEAD
6f4f6bab00f68aba9d558996d42f2e868255c3a7, committed tree
2112fb7ec4d5a93e2f5f882eda877d778afaea82 unchanged; index empty. Prior documentation
bytes preserved as exact prefixes; docs/LOCAL_DEVELOPMENT.md unchanged with SHA-256
6f241a47289e316ad893d3e153a9bf5bb1b7c89d8cc1d56c4a4561c04c881e60.
Existing Stage 2B.1 changes preserved. No staging, commit, push, merge, deployment
or PR #1 modification. No backend/database/Docker/Chromium or hosted CI checks
run. Full independent audit, rendering/concurrency review and exact staged-snapshot
verification remain subsequent gates; this entry does not certify Stage 2B.1 as
committed. M-06 remains open; Stage 2B.2/2B.3 not started.


## Independent Stage 2B.1 audit stop — 2026-11-13 (CompanyJobsList)

**FAIL; stopped before staging or committing.** Baseline confirmed:
branch feat/admin-workspace-final, HEAD
6f4f6bab00f68aba9d558996d42f2e868255c3a7, committed tree
2112fb7ec4d5a93e2f5f882eda877d778afaea82; index empty.
Independent consumer review found CompanyJobsList retains previous-user private
job data on same-company authentication changes. Its wrapper key contains company
and search only; its jobs fetch does not depend on authenticated identity and has
no effect cleanup generation guard. The repaired membership hook hides content
while resolving, then an empty membership allows rendering the retained jobs
because jobsCompanyId still matches companyId. No server authorization bypass was
demonstrated: this is previous-user data retained in frontend state.

Added a narrow regression to RecruiterPages.test.jsx using the real membership
hook and a controlled AuthContext identity change. OWNER loads a private draft;
an unaffiliated user on the same route gets a fresh pending lookup, then an empty
result. The old draft reappears after that result. The test supplies Forbidden
for any subsequent jobs request; none is initiated by identity change.
Required follow-up: bind job data and request lifetimes to authenticated identity,
fail closed for missing membership, and audit other recruiter consumers' retained
data and mutation callbacks before resuming acceptance. No repair performed under
the explicit serious-defect stop rule.

Command from frontend/:
- `npm test -- --run src/features/jobs/pages/RecruiterPages.test.jsx`: FAIL,
  1 failed / 11 passed; failure at the post-empty-lookup private-draft assertion.
Root `git diff --check`: PASS before review and after documentation update.
The two earlier repairs were inspected: hook selection identity rotates through
conditional same-component state updates, with effect-local live/abort guards;
CompanyPage keys by user/company and uses layout-effect mutation permits. No
new defect in those two repairs was established, but complete Strict Mode and
interrupted-render verification is not certified by this stopped audit.

Backend SQL/runtime, full frontend lint/test/build, OpenAPI, runner safety,
disposable PostgreSQL, standalone/concurrent Chromium and staged-export gates
were not run. No staged tree or new commit exists. No Docker/database/listener
was accessed or created; current resource inventory and cleanup were not checked.
All pre-existing documentation bytes retained as exact prefixes;
docs/LOCAL_DEVELOPMENT.md untouched. No API/schema/dependency/production-settings
change. Hosted CI not run. M-06 remains open: legacy arrays, COUNT/deep-offset
costs and concurrent-write drift. No remote operation, push, merge, deployment,
PR #1 modification or Stage 2B.2/2B.3/2C work.


## Stage 2B.1 private-job repair focused verification — 2026-11-13

PASS for the current frontend working tree; independent acceptance remains pending.
Starting snapshot already contained AuthorizedJobScreen, request cleanup, mutation
lifetime guards and 24 recruiter-page tests. The first requested regression run
passed all 24; the historical failing state was not reproduced in this session.
Existing repair/test changes were preserved rather than replaced or attributed
as newly implemented here. This session corrected dynamic component rendering
with React createElement to satisfy the existing no-unused-vars lint rule.

Historical root cause: CompanyJobsList owned private results by company only,
retaining OWNER drafts across same-route user changes and empty membership results.
Current repair keys authorization/data subtrees by authenticated user, company,
job/application route and search. Pending/error authorization unmounts data owners;
logout renders no private subtree. Returning A -> B -> A creates a fresh lookup
and fetch. Fetch generations/cleanup ignore obsolete responses; layout-effect
lifetimes guard retained mutation callbacks and post-request UI effects. No
render-time ref mutation is introduced. Already-issued mutations are not undone.

Backend CompanyJobsView was inspected, not changed: active OWNER/ADMIN may see
private jobs; MEMBER and unaffiliated callers receive the existing published,
non-expired public queryset. Empty membership therefore permits only a fresh
server-authorized public fetch, never retained OWNER results. Filtering, ordering,
pagination and API contracts remain unchanged. Related job detail/editor and
applicant list/detail share the keyed boundary and obsolete-response safeguards;
identity-change regressions cover private details, editable fields and applicant
names. No separate broader defect was established in this focused review.

Existing StrictMode regressions cover immediate and post-lookup absence for
OWNER -> unaffiliated/MEMBER/ADMIN, pending/error/empty membership, retry/fetch
failure, user A -> B -> A, company A -> B -> A, loaded/pending logout, late and
out-of-order responses, reauthorized fresh drafts and current public-only results.
The original unaffiliated regression remains unchanged.

Commands from frontend/:
- npm test -- --run src/features/jobs/pages/RecruiterPages.test.jsx: PASS, 24 tests.
- npm test -- --run src/features/companies/discovery.test.jsx: PASS, 19 tests.
- npm test -- --run src/features/companies/CompanyPage.test.jsx: PASS, 15 tests.
- npm run lint: initial FAIL (unused Component); PASS after createElement fix.
- npm test: PASS, 111 tests / 18 files; existing non-failing JSDOM pseudo-element
  getComputedStyle diagnostics remain.
- npm run build: PASS; existing 756.31 kB chunk advisory remains.
Root git diff --check: PASS; git status --short inspected; cached stat empty.
An inspection command used nonexistent AuthProvider.jsx and failed; the actual
AuthContext.jsx was subsequently read. No backend/PostgreSQL/Chromium audit run.

Repair-related paths: frontend/src/features/jobs/pages/RecruiterPages.jsx and
RecruiterPages.test.jsx (implementation/regressions already present at entry),
PROJECT_STATUS.md and docs/TESTING_STRATEGY.md (this append-only verification).
Earlier membership and CompanyPage repairs retained. LOCAL_DEVELOPMENT.md remains
untouched, SHA-256 6f241a47289e316ad893d3e153a9bf5bb1b7c89d8cc1d56c4a4561c04c881e60.
No backend/API/schema/dependency/production-settings change in this session.
Branch feat/admin-workspace-final; HEAD 6f4f6bab00f68aba9d558996d42f2e868255c3a7;
committed tree 2112fb7ec4d5a93e2f5f882eda877d778afaea82; index empty.
Nothing staged, committed, pushed, merged, deployed or changed in PR #1.
Independent full audit, disposable PostgreSQL, standalone/concurrent Chromium,
exact staged-snapshot verification and hosted CI remain gates. Stage 2B.1 is
uncommitted. M-06 remains open (legacy arrays, COUNT/deep-offset costs and
concurrent-write drift). Stage 2B.2/2B.3 not started.


## Stage 2B.1 final cross-identity audit stop — 2026-11-13 (CompanyDirectory)

FAIL; stopped before staging or committing under the requested serious-defect rule.
Verified starting branch feat/admin-workspace-final, HEAD
6f4f6bab00f68aba9d558996d42f2e868255c3a7 and committed tree
2112fb7ec4d5a93e2f5f882eda877d778afaea82; index empty.

CompanyDirectory retains previous-user membership data across same-route account
changes. Its state key contains page/search only, and its request effect has no
authenticated-user dependency. A controlled auth identity change from an OWNER
to an unaffiliated user leaves the original company card and OWNER membership
in the rendered directory. This exposes previous-user membership information;
no server authorization bypass was established. CompanyPicker also lacks a user
dependency, but independent reproduction of that component was not completed.
Dashboard/profile rendering and the remaining recruiter consumers are not certified.

Added a narrow regression in frontend/src/features/companies/discovery.test.jsx
using the existing controlled useAuth mock and real CompanyDirectory rendering.
The new identity's response is held pending; the immediate stale-card assertion
fails. Existing 19 tests pass. No implementation repair was performed.
Required follow-up: bind directory membership state and request lifetime to auth
identity, invalidate rendered memberships synchronously, and cover logout,
returning identities, late responses and failure/retry before resuming acceptance.

Command from frontend/:
- npm test -- --run src/features/companies/discovery.test.jsx: FAIL, 1 failed /
  19 passed (20 total); previous-user company card remains after identity change.

No backend runtime/SQL, PostgreSQL, full frontend lint/test/build, OpenAPI,
runner-safety, standalone/concurrent Chromium or exact staged-export checks ran.
No staged tree or commit was created. No Docker/database/listener was accessed or
created by this audit; existing resource inventory/cleanup status is unverified.
No development database was accessed. No API/schema/dependency/production-settings
change. Earlier documentation bytes preserved by appending; LOCAL_DEVELOPMENT.md
untouched. M-06 remains open: legacy arrays, COUNT/deep-offset costs and
concurrent-write drift. Hosted CI not run. No push, merge, deployment or PR #1
modification; Stage 2B.2/2B.3 not started.


## Stage 2B.1 CompanyDirectory identity repair — 2026-11-13

PASS for focused frontend repair; independent acceptance remains pending.
Reproduced the original discovery regression: 1 failed / 19 passed, with the
previous user's company card and OWNER label still visible after an account
change. The regression is preserved unchanged. Root cause: directory data and
request dependencies were associated only with page/search, not authenticated
identity.

CompanyDirectory now owns results inside a stable user-ID-keyed subtree, rendering
no membership directory on logout. RecruiterLayout similarly keys the authenticated
workspace, including Outlet, by user ID. This small shared boundary resets profile,
dashboard selection, picker pages/search, exact membership lookups and screen state
on identity changes without remounting the application or changing public routes.
Ordinary same-user rerenders preserve state; persisted theme preference survives.
Existing hook and CompanyPage/job-screen authorization repairs remain intact.
CompanyPicker is used inside the recruiter dashboard; its parent selection and
request state are both covered by the shared boundary. It is not independently
hardened for use outside that boundary. No further independent serious defect was
established in this focused review; this is not a complete consumer audit.

Remounting synchronously removes prior memberships and role labels. A -> B -> A
starts a new data owner and fresh requests. Existing effect-local live flags and
AbortControllers prevent obsolete directory, picker and membership completions
from updating the new owner even if transport ignores abort. Search/page URL
parameters remain current route input, while results are newly fetched per user;
no automatic unbounded fetching was added. Existing server authorization remains
authoritative. No render-time ref mutation, dependencies, backend/API/schema or
production configuration change.

Regression coverage: original same-route OWNER -> unaffiliated pending response;
StrictMode OWNER -> MEMBER/ADMIN/empty/error, retry and fresh membership results;
user A -> B -> A, loaded/pending logout, late/out-of-order search and pagination
responses and aborted old signals. Workspace regressions cover stale selection,
ordinary-rerender preservation, profile reset, returning identities, logout,
pending picker load-more/search and exact-company lookup completions. Real Ant
Design controls and actual routed Outlet are used. Existing membership-hook,
CompanyPage and private-job tests remain passing.

Commands from frontend/ (final results):
- `npm test -- --run src/features/companies/discovery.test.jsx`: PASS, 26 tests.
- `npm test -- --run src/features/companies/CompanyPage.test.jsx`: PASS, 15 tests.
- `npm test -- --run src/features/jobs/pages/RecruiterPages.test.jsx`: PASS, 24 tests.
- `npm test -- --run src/components/templates/RecruiterLayout.test.jsx`: PASS, 5 tests.
- `npm run lint`: PASS.
- `npm test`: PASS, 122 tests / 18 files; existing non-failing JSDOM pseudo-element
  getComputedStyle diagnostics remain.
- `npm run build`: PASS; 756.38 kB main chunk retains the existing size advisory.
Root `git diff --check`: PASS. Git status reviewed; cached stat empty.
An initial test-writing script ran from frontend/ with root-relative paths and
failed before writing; it was rerun successfully from root. An inspection used
nonexistent frontend/src/App.jsx; actual layout usages were subsequently located.

Files changed by this repair only: frontend/src/features/jobs/pages/CompanyDirectory.jsx,
frontend/src/features/companies/discovery.test.jsx,
frontend/src/components/templates/RecruiterLayout.jsx,
frontend/src/components/templates/RecruiterLayout.test.jsx,
PROJECT_STATUS.md and docs/TESTING_STRATEGY.md (append only).
Prior Stage 2B.1 work and operations notes preserved. LOCAL_DEVELOPMENT.md unchanged,
SHA-256 6f241a47289e316ad893d3e153a9bf5bb1b7c89d8cc1d56c4a4561c04c881e60.
Branch feat/admin-workspace-final; HEAD 6f4f6bab00f68aba9d558996d42f2e868255c3a7;
committed tree 2112fb7ec4d5a93e2f5f882eda877d778afaea82; staging index empty.
No staging, commit, push, merge, deployment, PR #1 modification or remote operation.
No PostgreSQL, Docker, Chromium or hosted CI verification ran. Independent full
review, disposable PostgreSQL, standalone/concurrent Chromium, exact staged-export
verification and hosted CI remain audit gates. Stage 2B.1 is uncommitted; M-06
remains open (legacy arrays, COUNT/deep-offset costs, concurrent-write drift).
Stage 2B.2/2B.3 not started.


## Stage 2B.1 independent audit stop — 2026-11-13 (cross-account HTTP replay)

FAIL; stopped on a serious defect before staging or committing. Starting and
ending branch feat/admin-workspace-final; HEAD
6f4f6bab00f68aba9d558996d42f2e868255c3a7; committed tree
2112fb7ec4d5a93e2f5f882eda877d778afaea82. Index empty.

Inspected PublicLayout/App routing: recruiter routes do traverse RecruiterLayout,
whose workspace is keyed by stable user.id; directory has its own user boundary.
These boundaries discard local state but do not cancel shared HTTP retries.
Independent complete acceptance of all four repairs is not certified by this stop.

Serious finding: frontend/src/features/auth/api.js handles a late 401 by reading
current storage and retrying whenever its access token differs from the original
request token, without checking the original request identity. An A-account PATCH
held pending, followed by login B and then A's 401, is replayed with B's bearer
and A's original payload. If B is authorized for the target, the server can accept
an unintended mutation as B. This is a client identity-confusion defect; no server
permission bypass is asserted. Remount/lifetime guards cannot prevent the HTTP
interceptor from issuing this retry. The during-refresh identity check does not
cover the earlier newer-token retry branch.

Added a narrow failing regression to frontend/src/features/auth/api.test.js using
the real Axios interceptors and a controlled adapter, synthetic recruiter tokens
and a synthetic PATCH target. It explicitly observes B's token on the replay.
No implementation repair, authentication-model or API-contract change was made.
Required follow-up: bind requests/retries to their originating session and reject
cross-session replay, while retaining same-session refresh behavior; test late 401,
logout, returning identities and pending refresh before resuming this audit.

Command from frontend/: npm test -- --run src/features/auth/api.test.js
FAIL twice: 1 failed / 6 passed (7 total); final assertion shows the old PATCH
payload sent with Bearer recruiter-b-access. Root git diff --check PASS;
baseline/status/cached stat inspected (index empty). One inspection referenced a
nonexistent app/router.jsx; actual app/App.jsx and PublicLayout were then read.

Backend targeted/service/SQL checks, full disposable PostgreSQL, Ruff/format,
Django/migration/OpenAPI/runner safety, full frontend lint/test/build, standalone
and concurrent Chromium and exact staged-export gates were not run in this audit.
No staged-tree SHA or commit SHA was created. All pre-existing modified/untracked
files remain uncommitted, plus the auth regression and these append-only notes.
No Docker resource, listener or database was accessed/created; existing cleanup
and listener status is unverified. Development databases were not accessed.
LOCAL_DEVELOPMENT.md and prior documentation bytes preserved. No production
settings, schema, dependencies or implementation changed. M-06 remains open:
legacy arrays, COUNT/deep-offset costs and concurrent-write drift. Hosted CI not
run. No push, merge, deployment, PR modification or Stage 2B.2 work.


## Focused cross-account HTTP replay repair — 2026-11-13

PASS for focused frontend security repair; independent Stage 2B.1 acceptance
remains pending. Reproduced the preserved original regression before editing:
`npm test -- --run src/features/auth/api.test.js` FAIL, 1 failed / 6 passed;
A's PATCH payload was observed with B's bearer token. The newer-access-token
retry branch had no originating-session check; the refresh branch compared user
IDs, which cannot distinguish logout/re-login as the same user.

The shared HTTP client now captures a local session generation synchronously at
its callable/request/method boundary before Axios queues interceptors. Every
public writeAuth (login, logout or replacement) rotates a random local-storage
session marker, even for identical credentials. Credential/marker snapshots and
storage-event invalidation detect external replacements. Credentials remain the
existing authentication source of truth; no backend token semantics change.
Only the internal refresh persistence path retains the generation.

Request interception rejects obsolete generations before attaching credentials.
Both successful and failed obsolete responses reject with Axios ERR_CANCELED
and sessionExpired=true. Response handling checks before refresh, credential
mutation, newer-token retry and after awaiting refresh; retry request interception
checks again before attaching its bearer. Refresh flights are scoped by generation;
a stale flight cannot clear the replacement flight. One current-session flight
persists rotated tokens once for all waiters. Stale refresh success/failure cannot
restore/overwrite credentials or signal logout for a replacement login. Retries
remain bounded to one and authentication endpoints bypass refresh recursion.
Requests already dispatched are not undone or transport-aborted; their obsolete
completions and retries are invalidated. Server authorization remains authoritative.

Audited AuthContext/AuthPages, storage access, HTTP initialization and API service
imports: production login/logout use writeAuth; all application API services use
the shared http client; plainHttp is used only for refresh. No independent auth
truth, dependencies, backend/API/schema/migration or production-settings changes.
The original cross-account PATCH regression is unchanged. One existing late-401
test now releases its deferred response after actual refresh persistence instead
of simulating refresh with the public login/replacement helper; its success and
single-refresh assertions remain intact.

Controlled adapters/deferred promises verify actual bearer headers and payloads
for GET/POST/PUT/PATCH/DELETE across account switching and same-session refresh,
pending refresh success/failure during B login, B's independent concurrent refresh,
no stale token overwrite/logout, concurrent old requests, identical re-login,
logout/re-login as A, external storage replacement, delayed initial interception,
delayed retry interception and obsolete successful responses. Existing concurrent
refresh, missing restoration, endpoint exclusion and bounded-loop tests pass.

Commands from frontend/:
- `npm test -- --run src/features/auth/api.test.js`: PASS, 26 tests.
- `npm test -- --run src/features/companies/discovery.test.jsx`: PASS, 26 tests.
- `npm test -- --run src/features/companies/CompanyPage.test.jsx`: PASS, 15 tests.
- `npm test -- --run src/features/jobs/pages/RecruiterPages.test.jsx`: PASS, 24 tests.
- `npm test -- --run src/components/templates/RecruiterLayout.test.jsx`: PASS, 5 tests.
- `npm run lint`: PASS.
- `npm test`: PASS, 142 tests / 18 files; existing non-failing JSDOM
  getComputedStyle pseudo-element diagnostics remain.
- `npm run build`: PASS; existing main-chunk size advisory remains (~757 kB).
Root `git diff --check`: PASS; `git status --short` inspected;
`git diff --cached --stat`: empty.

Files changed by this repair only: frontend/src/features/auth/api.js,
frontend/src/features/auth/api.test.js, PROJECT_STATUS.md and
 docs/TESTING_STRATEGY.md (documentation appended). Earlier Stage 2B.1 changes,
regressions and operations notes preserved. LOCAL_DEVELOPMENT.md untouched,
SHA-256 6f241a47289e316ad893d3e153a9bf5bb1b7c89d8cc1d56c4a4561c04c881e60.
Branch feat/admin-workspace-final; HEAD
6f4f6bab00f68aba9d558996d42f2e868255c3a7; committed tree
2112fb7ec4d5a93e2f5f882eda877d778afaea82; index empty.
No staging, commit, push, merge, deployment or PR #1 modification. No PostgreSQL,
Docker, Chromium or hosted CI run. Remaining gates: full independent review,
disposable PostgreSQL, standalone/concurrent Chromium, exact staged-export checks
and hosted CI. Stage 2B.1 remains uncommitted; M-06 remains open (legacy arrays,
COUNT/deep-offset cost and concurrent-write drift). Stage 2B.2/2B.3 not started.


## Stage 2B.1 independent authentication continuation audit stop — 2026-11-13

FAIL; stopped on a serious authentication lifecycle defect before staging or
committing. Baseline matches branch feat/admin-workspace-final, HEAD
6f4f6bab00f68aba9d558996d42f2e868255c3a7 and committed tree
2112fb7ec4d5a93e2f5f882eda877d778afaea82. Index empty.

AuthContext.jsx login awaits authApi.login and then unconditionally calls
writeAuth/setAuth. The HTTP response interceptor checks session generation before
this promise continuation, but the provider does not revalidate ownership before
persisting credentials. A logout between completed API validation and provider
continuation is overwritten by the old login result, restoring authentication.
This fails the requested guarantee that obsolete responses cannot mutate a
replacement authentication state. No new cross-account HTTP mutation replay or
server authorization bypass was established by this reproduction.

Added frontend/src/features/auth/AuthContext.test.jsx, a narrow controlled
microtask-ordering regression. It uses the real AuthProvider, authApi login and
Axios interceptors with a synthetic adapter, then wraps authApi.login only to
register logout on the completed API promise before the provider continuation.
This deliberately exercises the asynchronous boundary; it does not claim a
manual browser reproduction. The request URL/payload assertion passes and the
stored-auth-is-null assertion fails: synthetic login credentials are restored.
No implementation repair was made. Follow-up: carry originating session ownership
through the provider credential commit and reject obsolete login continuations,
including logout, replacement login and identical-user re-login.

Command from frontend/:
`npm test -- --run src/features/auth/AuthContext.test.jsx src/features/auth/api.test.js`
FAIL: 1 failed / 26 passed, 2 files. Existing HTTP replay/refresh tests all pass;
provider regression fails. An initial shell write used a root-relative path from
frontend/ and failed without writing; that initial test invocation ran only the
existing API file (26 passed). The test was then added at the correct path.
Root `git diff --check` PASS; final baseline/index/status rechecked.

Remaining recruiter identity/rendering, backend authorization/SQL/pagination,
frontend integration, full lint/test/build, OpenAPI 39/55 inventory, runner safety,
disposable PostgreSQL, standalone/concurrent Chromium and exact staged-export
verification gates were not completed. No staged/tested tree or new commit exists.
No Docker, database or listener operation was performed; existing resources and
listeners were not inventoried and their status is unverified. No development
database was accessed. Only this regression and append-only documentation were
added; prior implementation, regressions and operations notes preserved.
LOCAL_DEVELOPMENT.md, API/schema/migrations/dependencies/production settings were
not changed by this audit. M-06 remains open (legacy arrays, COUNT/deep-offset
costs, concurrent-write drift). Hosted CI not run. Nothing pushed, merged,
deployed or changed in PR #1; Stage 2B.2/2B.3 not started.


## Focused stale login continuation security repair — 2026-11-13

PASS for focused frontend repair; independent Stage 2B.1 acceptance remains pending.
Baseline reproduced with the exact requested auth command: 1 failed / 26 passed.
The original controlled regression is preserved: logout after Axios validation but
before AuthProvider resumes previously allowed unconditional writeAuth/setAuth to
restore the obsolete login. No backend authentication contract change is needed.

Pending login ownership now lives alongside the existing session-generation logic
in auth/api.js. Each beginLogin creates a unique operation associated with the
current session generation and supersedes the previous pending operation. Starting
an attempt does not rotate the established session or invalidate ordinary requests.
Logout/replacement writeAuth rotates the existing session generation, including
identical-user re-login. Same-session refresh retains that generation. commitLogin
synchronously validates operation identity and session generation, writes credentials,
and consumes ownership. AuthProvider immediately sets its state in the same call
stack, without an await. Stale success/failure rejects with Axios ERR_CANCELED and
sessionExpired=true; failures never clear the active session. Current login failure
retains existing credentials, as before. Effect cleanup cancels the provider-owned
pending operation; Strict Mode cleanup/setup performs no credential writes. No
render-time mutation or additional persisted authentication source is introduced.

All production credential writers remain the shared writeAuth and internal refresh
persistence path. Existing Axios request/retry generation protections are unchanged
by this repair. Provider and shared credentials agree on current login/logout;
refresh changes stored tokens while provider continues to represent the same user.
AuthPages only navigates after successful login, so cancellation rejects that path.
A real LoginPage/router regression verifies no authenticated destination is reached
after logout at the validated-response boundary. No additional independent serious
defect was established within this focused scope; this is not a complete audit.

AuthProvider tests cover the original boundary, pending logout, validated-response
supersession, older success/failure after B succeeds, three concurrent attempts,
same-user logout/re-login, current success/failure, StrictMode unmount/remount,
no stale token/state/navigation commit, and real same-session refresh while another
login is pending. They assert stored credentials and rendered user state. Existing
26 Axios regressions preserve cross-account replay and refresh coverage.

Commands from frontend/ (final results; output logs under /tmp/devjobs-login-*):
- npm test -- --run src/features/auth/AuthContext.test.jsx src/features/auth/api.test.js:
  PASS, 37 tests (11 provider + 26 Axios); original baseline FAIL recorded above.
- npm test -- --run src/features/companies/discovery.test.jsx: PASS, 26 tests.
- npm test -- --run src/features/companies/CompanyPage.test.jsx: PASS, 15 tests.
- npm test -- --run src/features/jobs/pages/RecruiterPages.test.jsx: PASS, 24 tests.
- npm test -- --run src/components/templates/RecruiterLayout.test.jsx: PASS, 5 tests.
- npm run lint: PASS, including final added navigation test.
- npm test: PASS, 153 tests / 19 files on final source; existing non-failing JSDOM
  getComputedStyle pseudo-element diagnostics remain.
- npm run build: PASS; existing main-chunk advisory remains (757.69 kB).
Root git diff --check: PASS; git status --short inspected;
git diff --cached --stat: empty. One initial inspection referenced nonexistent
features/auth/pages/AuthPages.jsx; actual features/auth/AuthPages.jsx was read.

Files modified by this repair only: frontend/src/features/auth/AuthContext.jsx,
frontend/src/features/auth/api.js (pending-operation helpers only),
frontend/src/features/auth/AuthContext.test.jsx (original regression retained),
PROJECT_STATUS.md and docs/TESTING_STRATEGY.md (append only). Existing Stage 2B.1
work/security tests retained. LOCAL_DEVELOPMENT.md preserved, SHA-256
6f241a47289e316ad893d3e153a9bf5bb1b7c89d8cc1d56c4a4561c04c881e60.
No public API/schema/migration/dependency/backend/production-settings changes.
Branch feat/admin-workspace-final; HEAD 6f4f6bab00f68aba9d558996d42f2e868255c3a7;
committed tree 2112fb7ec4d5a93e2f5f882eda877d778afaea82; index empty.
No staging, commit, push, merge, deployment, PR #1 modification or remote action.
No backend/PostgreSQL/Docker/Chromium audit run. Independent full review,
disposable PostgreSQL, standalone/concurrent Chromium, exact staged-export checks
and hosted CI remain gates. Already-dispatched server requests are not undone by
client cancellation. Stage 2B.1 remains uncommitted; M-06 remains open (legacy
arrays, COUNT/deep-offset costs, concurrent-write drift). Stage 2B.2/2B.3 not started.


## Stage 2B.1 Gate 1 independent audit stop — 2026-11-14

FAIL; stopped on a serious cross-tab authentication identity-isolation defect.
Starting branch feat/admin-workspace-final; HEAD
6f4f6bab00f68aba9d558996d42f2e868255c3a7; committed tree
2112fb7ec4d5a93e2f5f882eda877d778afaea82. Baseline matches the requested values.
Working-tree status, diff summary and all untracked filenames inspected. Existing
Stage 2B.1 implementation/regressions and unrelated operations notes preserved.

Finding: auth/api.js observes localStorage replacement/storage events and rotates
its request generation, but AuthProvider initializes from readAuth only once and
listens only for devjobs:logout. A different same-origin tab logging in as B
changes shared credentials without updating A's mounted provider. The provider,
route guards and user-keyed recruiter boundaries continue representing A; newly
created requests capture B's generation and attach B's token. This permits A's
visible editor payload to be dispatched as B. Existing request-generation checks
correctly reject old requests but do not protect new requests from a stale UI
identity. No server permission bypass is asserted; a mutation can succeed if B
is authorized for its target. This also leaves prior-user UI state mounted.

Added one narrow regression in frontend/src/features/auth/AuthContext.test.jsx.
It uses the real AuthProvider, real HTTP interceptors, synthetic credentials and
a controlled Axios adapter. A minimal identity-owned editor is rendered as A;
shared storage is replaced with B plus a storage notification, simulating another
tab. Clicking the currently rendered editor (not a retained stale callback)
observes Authorization Bearer b-access with title 'a private draft'. The safety
assertion fails on exactly that combination. This is a deterministic JSDOM
reproduction, not a Chromium or full CompanyPage integration reproduction.
Implementation was not changed and existing assertions were not weakened.

Command from frontend/:
`npm test -- --run src/features/auth/AuthContext.test.jsx src/features/auth/api.test.js`
FAIL: 1 failed / 37 passed, 38 tests across 2 files; all prior 11 provider and
26 Axios tests pass. New provider regression fails on the actual header/payload.
Root `git diff --check`: PASS. Branch/HEAD/tree, git status --short and
`git diff --cached --stat` rechecked at delivery; index empty.

Review before stopping covered auth lifecycle/commit/refresh code, auth tests,
auth pages/routing, storage/HTTP consumers, recruiter identity boundaries and
membership/company code. Existing synchronous login commit and HTTP generation
checks do not resolve the reproduced provider/storage mismatch. All six repairs,
remaining recruiter consumers, React concurrent-rendering safety and complete
regression quality are NOT independently certified by this stopped audit.
Remaining requested discovery/CompanyPage/RecruiterPages/RecruiterLayout tests,
full frontend tests, lint and build were not run after the serious finding.

Follow-up: synchronize or invalidate mounted authentication consumers on external
session replacement/logout and ensure visible identity, private state and request
ownership agree before accepting another action. Preserve ordinary same-session
refresh behavior and add external logout/account-switch integration coverage.
Resume Gate 1 after repair; Gate 2 and subsequent disposable PostgreSQL,
standalone/concurrent Chromium, exact staged-export and hosted CI checks remain.
Stage 2B.1 remains uncommitted; M-06 remains open (legacy arrays, COUNT/deep-offset
costs and concurrent-write drift). Stage 2B.2 was not started.

Audit changes only: this append-only entry in PROJECT_STATUS.md and
 docs/TESTING_STRATEGY.md, plus the regression in AuthContext.test.jsx.
No API/schema/migration/dependency/backend/production-settings change.
LOCAL_DEVELOPMENT.md was not edited. No PostgreSQL, Docker, Chromium, database,
listener or remote operation performed. No staging, commit, push, merge,
deployment or PR #1 modification occurred.


## Security Repair 7 design-decision stop — 2026-11-14

FAIL / repair not implemented. The original cross-tab regression was preserved
unchanged and reproduced: A's rendered editor dispatches its private draft with
B's Authorization header. AuthProvider reads credentials only at initialization
and observes only same-document devjobs:logout. The HTTP proxy binds newly
initiated operations to current storage, without the initiating UI's ownership.
No backend authorization bypass is asserted.

Inspection also identified a cross-tab coordination constraint, distinct from
the reproduced regression. writeAuth synchronously writes the session marker and
credentials as separate localStorage operations. Refresh checks a process-local
generation before a separate read/merge/write; failure similarly checks before
clearing storage. Another document can write between those operations. This is a
static concurrency finding, not an additional controlled runtime reproduction.
The current generation includes token strings, so an external same-session token
refresh is also treated as a session change. A storage-event subscription alone
would neither close the pre-event initiation race nor serialize credential commits.
All production protected services inspected use the shared HTTP client;
plainHttp is used for refresh only. No subscription/epoch/dispatch repair is claimed.

Stopped at the request's explicit requirement to report before a broader
authentication-contract change. Proposed decision: replace split storage with
one credential/session-epoch record, preserving the epoch on refresh and replacing
it on login/logout, including same-user re-login. Serialize ALL credential writers
across documents (for example with a supported browser lock), revalidate ownership
inside that serialization boundary, and make the affected synchronous commit
lifecycle asynchronous. Browser-support/fail-closed behavior and existing-tab
migration must be specified. This is an internal browser lifecycle change, not a
proposal to change JWT endpoints or backend permissions. Owner approval requested;
no such change implemented. No sensitive event payloads or new dependencies added.

The eventual repair must bind requests to provider-owned session capabilities,
validate those capabilities at initiation and immediately before transport, and
retain ownership through refresh/retry. External adoption must validate identity
and remount account/session-specific state, including same-user re-login; external
logout must invalidate it. Token rotation within the same epoch must retain valid
operations. These are proposed guarantees, not verified behavior. Stale-editor
safety currently FAILS; cross-tab same-session refresh continuity is not repaired.

Commands run from frontend/ on unchanged implementation:
- npm test -- --run src/features/auth/AuthContext.test.jsx src/features/auth/api.test.js:
  FAIL, 37 passed / 1 failed (provider 11 passed / 1 failed; Axios 26 passed).
- npm test -- --run src/features/companies/discovery.test.jsx: PASS, 26 tests.
- npm test -- --run src/features/companies/CompanyPage.test.jsx: PASS, 15 tests.
- npm test -- --run src/features/jobs/pages/RecruiterPages.test.jsx: PASS, 24 tests.
- npm test -- --run src/components/templates/RecruiterLayout.test.jsx: PASS, 5 tests.
- npm run lint: PASS.
- npm test: FAIL, 153 passed / 1 failed, 19 files; same cross-tab regression.
  Existing JSDOM getComputedStyle pseudo-element diagnostics also appeared.
- npm run build: PASS; existing 757.69 kB main-chunk advisory remains.
Root git diff --check: PASS; git status --short inspected;
git diff --cached --stat: empty. Earlier six repairs' regression tests remain
passing; all seven repairs cannot be certified because repair 7 still fails.

Only PROJECT_STATUS.md and docs/TESTING_STRATEGY.md appended by this attempt.
All source/tests, prior Stage 2B.1 work and unrelated operations notes preserved.
LOCAL_DEVELOPMENT.md SHA-256 remains
6f241a47289e316ad893d3e153a9bf5bb1b7c89d8cc1d56c4a4561c04c881e60.
No API/schema/backend/production-settings/dependency changes.
Branch feat/admin-workspace-final; HEAD
6f4f6bab00f68aba9d558996d42f2e868255c3a7; committed tree
2112fb7ec4d5a93e2f5f882eda877d778afaea82; index empty.
Remaining gates: approved session design and repair, complete new cross-tab/race
regressions, independent review, disposable PostgreSQL, standalone/concurrent
Chromium, exact staged-export checks and hosted CI. No PostgreSQL, Docker or
Chromium run. Stage 2B.1 remains uncommitted; M-06 remains open (legacy arrays,
COUNT/deep-offset costs and concurrent-write drift). Stage 2B.2/2B.3 not started.
Nothing staged, committed, pushed, merged, deployed or changed in PR #1.


## Security Repair 7 canonical-session continuation — 2026-11-14

Owner approved Option 1: the external-tab regression now uses an independent
createSessionStore writer with shared storage/Web Locks and separate document
operation state. A remains mounted while B commits, before A receives a storage
notification. The real mounted editor first demonstrates A's actual bearer header
and JSON payload at the Axios adapter, then attempts its existing A draft after
B commits. That attempt must reject with ERR_CANCELED/sessionExpired before any
additional adapter dispatch. The explicit forbidden B-header/A-payload assertion
and regression remain; no test is deleted or skipped.

A separate legacy split-storage integration test proves legacy records alone
produce neither provider authentication nor a bearer header, and cannot replace
an established canonical A session or its dispatch ownership. Additional provider
tests verify external same-epoch token rotation preserves A's request payload
and uses the rotated token, and external replacement/logout remount private state.

Connected auth/api.js and AuthContext.jsx to the existing canonical session store.
All login/logout/refresh/expiry commits use the serialized canonical protocol;
request initiation uses the mounted provider's opaque capability, then actual
adapter dispatch revalidates it under a shared lock before reading the token.
Axios configuration preserves the opaque capability through retries. Provider
subscriptions reread current storage, epoch transitions remount private state,
and children mount after request ownership is installed. Login and logout are
asynchronous; existing authenticated test fixtures now await the canonical writer.
JSDOM uses a shared deterministic lock queue; native browser locking is not
claimed verified. Missing Web Locks fails closed for authenticated session work.
Legacy keys are deliberately ignored, so existing legacy sessions require login.
No new dependency, public HTTP API, schema, migration or backend/settings change
was made by this continuation. Existing unrelated working-tree changes remain.

Final commands from frontend/:
- npm test -- --run src/features/auth/AuthContext.test.jsx src/features/auth/api.test.js src/features/auth/sessionStore.test.js:
  PASS, 54 tests across 3 files.
- npm test: PASS, 170 tests across 20 files.
- npm run lint: PASS.
- npm run build: PASS; 761.80 kB main-chunk advisory remains.
Root git diff --check: PASS. Earlier intermediate integration runs failed and
were repaired before these final runs. Existing JSDOM pseudo-element
getComputedStyle diagnostics remain non-failing.

PROJECT_STATUS.md and docs/TESTING_STRATEGY.md updated with this result.
Focused verification is complete; independent review, native multi-tab browser
coverage, backend/PostgreSQL, standalone/concurrent Chromium, exact staged-export
and hosted CI gates have not been run by this continuation. Already dispatched
server requests cannot be undone by client cancellation. The in-memory JSDOM
scheduler checks protocol ordering, not browser implementation correctness.
Stage 2B.1 remains uncommitted; M-06 remains open; Stage 2B.2/2B.3 not started.
No staging, commit, push, merge, deployment, PR or remote action. Index remains
empty on feat/admin-workspace-final.


## Autonomous concurrent-edit recovery and authentication repair — 2026-11-14

PASS for the approved focused frontend repair. Stage 2B.1 remains uncommitted;
this does not certify its independent audit or release gates. M-06 remains open
(legacy arrays, COUNT/deep-offset costs and concurrent-write drift). Stage 2B.2
and 2B.3 were not started.

Safety investigation: captured SHA-256 and nanosecond modification times for
api.js, AuthContext.jsx, sessionStore.js and their three test files at four
snapshots separated by 10 seconds (30 seconds total). All were stable. Sandboxed
process inspection was denied; an approved read-only process listing succeeded.
Several long-lived Codex app servers and the code-mode host were present, but no
active conflicting file writer was evident. Stable hashes are not proof of
exclusive access. All six source/test hashes and both documentation hashes were
rechecked before every edit and again after verification. No unexpected changes
were observed; no processes were terminated. Existing Stage 2B.1 work and all
unrelated operations notes were preserved.

Reconciliation retained the existing canonical sessionStore implementation,
opaque WeakMap-backed permits, locked pending-login ownership, token revisions,
AuthProvider synchronization and Axios request ownership. No second session
ownership mechanism was added. One incomplete boundary was repaired: refresh
requests now revalidate the originating permit and token revision under a shared
Web Lock at actual refresh transport dispatch, after asynchronous interceptors.
A delayed-refresh regression proves replacement login prevents that transport
from receiving old refresh credentials. Existing security assertions were not
weakened. Added unsupported-lock authenticated-dispatch, pending-transport lock
release and identical-user external replacement/remount coverage.

Final architecture and guarantees:
- One persisted record, devjobs.auth.v2, contains schema, epoch, revision,
  credentials and pendingLogin. Legacy devjobs.auth/devjobs.auth.session values
  are never imported or accepted as canonical ownership. Existing legacy sessions
  require a new login in the updated client. Old clients do not participate in
  the new protocol; no control over already-running legacy code is claimed.
- All cooperating updated documents use the same native Web Locks name.
  Exclusive locks serialize login ownership writes, credential commits, logout,
  refresh persistence and expiry; validation occurs inside the lock. localStorage
  is a record store, not a compare-and-swap or locking primitive.
- Login/logout rotate epochs, including identical-user re-login. Refresh retains
  the epoch and increments the credential revision. A pending login keeps current
  session requests usable. Competing login attempts share canonical ownership;
  canceled/unmounted/stale attempts cannot commit a replacement session.
- AuthProvider rereads storage on notifications rather than trusting event data;
  same-document writes notify subscribers too. Epoch changes remount the private
  subtree, including same-user replacement and external logout. Same-epoch token
  rotation retains the mounted identity and private state.
- Mounted provider ownership binds new requests before Axios interception.
  Opaque permits survive Axios config cloning. Initiation, request interception,
  transport dispatch, refresh dispatch/commit, response completion and retry
  validate session ownership. Shared dispatch locks exclude credential writers
  until the actual transport is invoked and its bearer token is selected.
  Locks are released while network responses are pending, so refresh/logout
  cannot deadlock behind a pending request. Replacement tokens are never attached
  to an obsolete request. Obsolete completions reject with ERR_CANCELED and
  sessionExpired=true. Already-dispatched server effects cannot be undone.
- Without Web Locks, credential writes and authenticated dispatch fail closed;
  no localStorage spin-lock or insecure fallback is used. Storage denial or
  malformed canonical records do not import legacy credentials. Public requests
  remain unauthenticated. This requires supported secure-context browser Web
  Locks for authenticated operation; no browser-support expansion is claimed.

All seven regression areas pass: membership A -> B -> A, CompanyPage cross-user
permissions, CompanyJobsList private drafts, CompanyDirectory memberships, Axios
cross-session replay, AuthProvider stale login completion and cross-tab stale
editor mutation. The cross-tab editor regression retains real action and actual
header/payload assertions; its external-tab setup uses a second canonical store
with independent operation state. A separate legacy split-storage test remains.

Exact final commands from frontend/:
- npm test -- --run src/features/auth/sessionStore.test.js: PASS, 15 tests / 1 file.
- npm test -- --run src/features/auth/AuthContext.test.jsx src/features/auth/api.test.js:
  PASS, 43 tests / 2 files (16 provider, 27 Axios).
- npm test -- --run src/features/companies/discovery.test.jsx: PASS, 26 tests.
- npm test -- --run src/features/companies/CompanyPage.test.jsx: PASS, 15 tests.
- npm test -- --run src/features/jobs/pages/RecruiterPages.test.jsx: PASS, 24 tests.
- npm test -- --run src/components/templates/RecruiterLayout.test.jsx: PASS, 5 tests.
- npm run lint: PASS.
- npm test: PASS, 174 tests / 20 files. Existing non-failing JSDOM
  getComputedStyle pseudo-element diagnostics remain.
- npm run build: PASS; existing main-chunk advisory remains (762.00 kB).
Root git diff --check: PASS; git status --short inspected;
git diff --cached --stat: empty. Focused/full logs are under
/tmp/devjobs-recovery-{discovery,company,recruiter,layout,full}.log.

Recovery edited only frontend/src/features/auth/api.js, api.test.js,
AuthContext.test.jsx, sessionStore.test.js and appended PROJECT_STATUS.md and
 docs/TESTING_STRATEGY.md. Existing AuthContext.jsx/sessionStore.js implementation
and other frontend/backend/docs changes were retained. No dependency, public API,
backend contract, schema, migration or production-settings change was made.

Native multi-document Web Locks/transport behavior is not runtime-certified by
JSDOM's deterministic scheduler. Independent full review, disposable PostgreSQL,
standalone/concurrent Chromium, exact staged-export verification and hosted CI
remain gates. No PostgreSQL, Docker or Chromium command was run during recovery.

Repository identity: branch feat/admin-workspace-final; HEAD
6f4f6bab00f68aba9d558996d42f2e868255c3a7; committed tree
2112fb7ec4d5a93e2f5f882eda877d778afaea82; index empty. No staging, commit, push,
merge, deployment, PR #1 modification or remote action occurred.


## Resumed Stage 2B.1 Gate 1 independent audit — 2026-11-14

**FAIL; stopped on a deterministic provider-lifetime vulnerability.** Existing
implementation and both interrupted E2E files were preserved. Only one regression
was added to frontend/src/features/auth/AuthContext.test.jsx, and this entry
appended to PROJECT_STATUS.md and docs/TESTING_STRATEGY.md. No production source,
API, schema, migration, dependency or settings changes.

Finding: SessionProvider.login captures lifecycle.current when invoked, rather
than enforcing that its originating provider remains mounted. Cleanup increments
the counter and cancels the existing attempt, but a retained callback invoked
after cleanup captures the incremented value, begins a new operation against the
current canonical epoch and can commit successfully. The regression renders A,
retains its actual context.login, commits and renders B (confirming the callback
changed), then invokes the obsolete callback with synthetic A credentials.
Actual Axios adapter dispatch records POST /auth/login/ with A's login payload;
the result succeeds, canonical B is replaced by A and the UI renders A. Expected
behavior is sessionExpired/ERR_CANCELED, no transport and unchanged B. This is
a provider/API integration regression with a controlled adapter, not a claimed
native-browser exploit or server authorization bypass. No stale A-payload/B-token
mutation was observed in this regression. Retained authentication callbacks
need lifetime ownership even when invoked after unmount; fixing only pending
operations is insufficient. Implementation intentionally left unchanged under
the owner's serious-vulnerability stop instruction.

Recovered interrupted-run evidence: /tmp/devjobs-gate1-browser.log is complete,
not an unknown/in-progress result. Run 4478f58d3de849c799a67e3f2c79b7c4 used owned
container 397b48e5c6db, cluster 7708000011796447277, PostgreSQL 17 database
devjobs_e2e_disposable on ephemeral port 55508. Migrations, system check and
migration consistency PASS; pytest 171 passed / 8 skipped (40.45s).
Chromium executed two tests: cross-tab PASS (7.7s); role workflow FAIL (33.9s),
total 42.3s. Failure occurs at admin login, workflows.spec.js:234; retained error
context reports authentication throttling with 25 seconds remaining. No throttle
configuration was changed. No fresh browser/container run was started after the
serious finding; these are recovered results, not rerun certification.

Cross-tab spec review: both pages use one browser context and real shared
localStorage/native Web Locks. A's capture listener queues canonical storage
notifications before the application receives them; the test waits for a queued
event and confirms shared storage already contains B while A's draft remains.
Real PATCH headers/payloads are checked by a positive A control, no subsequent A
draft transport, and B's successful own mutation on a shared authorized object.
Releasing notifications checks remount/private-state invalidation. Refresh keeps
the epoch/draft. Concurrent refresh routing holds both transports until both
arrive; one successful request and one cancellation, a single revision increment
and both documents' recovery are asserted. It does not force a particular
response to win or independently control late-failure-after-winning-commit
ordering. Same-user replacement, external logout/re-login and unavailable locks
are included. Legacy storage rejection is covered by unit integration tests,
not this browser spec. Browser coverage is therefore not comprehensive.

Review inspected exclusive canonical writes/shared transport dispatch locking,
opaque permits, provider synchronization, refresh dispatch/commit/retry revision
checks and recruiter callbacks. Job mutation callbacks use unmount lifetime
guards; CompanyPage uses authorization guards. The mounted-owner mechanism does
not make an obsolete AuthProvider login callback safe. Full independent review
certification stops at the reproduced defect.

Seven existing regression areas in the full frontend run:
1. Membership A -> B -> A: existing regressions pass.
2. CompanyPage cross-user permissions/retained callbacks: existing regressions pass.
3. CompanyJobsList private drafts: existing regressions pass.
4. CompanyDirectory memberships: existing regressions pass.
5. Axios cross-session replay/refresh ownership: existing regressions pass.
6. AuthProvider stale login completion: prior tests pass, new post-remount
   invocation regression FAILS.
7. Cross-tab stale editor mutation: existing unit regression passes; recovered
   native-browser scenario passes with the ordering limits above.
Passing tests do not override the new lifecycle defect.

Commands run during this resumed audit:
- frontend/: npm test -- --run src/features/auth/AuthContext.test.jsx:
  FAIL, 16 passed / 1 failed (17 tests), repeated after diagnostic-only assertion
  refinement with the same result; final log /tmp/devjobs-gate1-resumed-provider.log.
- frontend/: npm test > /tmp/devjobs-gate1-resumed-full.log 2>&1:
  FAIL, 174 passed / 1 failed, 20 files. Only the new regression fails.
- frontend/: npm run lint: PASS.
- frontend/: npm run build > /tmp/devjobs-gate1-resumed-build.log 2>&1: PASS;
  existing chunk-size advisory remains.
- root: git diff --check: PASS.
- Read-only process inventory and docker ps -a --filter label=devjobs.e2e:
  no interrupted runner, pytest, Playwright, owned API/Vite service or labeled
  container remains. Recovered log reports successful cleanup; private temporary
  directory devjobs-e2e-8576a4xf is absent. Failure screenshots/context under the
  run-specific results directory are retained as evidence. No process/container
  was stopped or removed by this continuation. Development PostgreSQL 17/18 and
  Vite processes were left alone; development databases and devjobs_test were
  not accessed.

Branch feat/admin-workspace-final and HEAD
6f4f6bab00f68aba9d558996d42f2e868255c3a7 unchanged; index empty.
Working tree retains all 25 modified tracked and 7 untracked paths.
Stage 2B.1 remains uncommitted. No staging, commit, push, merge, deployment or
PR #1 change. Resume Gate 1 after lifecycle repair; Gate 2 remains pending,
including remaining independent acceptance review, clean standalone/concurrent
isolated Chromium, exact staged-export verification when authorized and hosted
CI. M-06 remains open; Stage 2B.2 was not started.


## Authentication hardening contract — 2026-11-14 (before implementation)

A/G: Each effect setup owns a unique provider lifetime. Cleanup permanently
invalidates that identity synchronously; Strict Mode setup receives a new identity.
Retained callbacks cannot acquire authority from a later setup or provider.
B: Login binds lifetime, attempt generation and initiating canonical epoch. Check
before acquisition, inside the lock, at transport, and inside credential commit.
New attempts synchronously supersede older attempts even while queued.
C: devjobs.auth.v2 is the sole persisted authority. Login/logout replace epochs;
refresh preserves epoch and advances revision. Legacy records cannot authenticate.
D: Requests retain their initiating permit through interceptors, dispatch, refresh,
retry and completion; replacement-account credentials must never be attached.
E: All credential writers use the same exclusive Web Lock; transport initiation
uses a shared lock and releases it before awaiting the network response.
F: Cancellation is idempotent, cannot restore credentials and cannot log out an
unrelated epoch. No-lock browsers fail closed for authenticated operations.

Verification must distinguish deterministic scheduler coverage from native browser
ordering; already-dispatched server effects cannot be canceled retroactively.


## Stage 2B.1 resumed final verification — 2026-11-15

**PASS for working-tree Gate 1; recommend Gate 2 staged-snapshot verification.**
Recovered complete hardening logs and independent Playwright .last-run.json
artifacts (status passed, failedTests empty) for all three runs. Completed tests
were not restarted. This continuation changed only this documentation and
PROJECT_STATUS.md; existing implementation and unrelated operations notes retained.

Authentication review confirms originating layout-effect lifetime objects become
permanently dead on cleanup, cancel pending login and revoke request permits.
Retained login/logout callbacks assert their original live owner; Strict Mode
setup creates a new owner. Generation checks supersede older attempts before
lock acquisition; actual login dispatch validates again after interceptors.
Canonical devjobs.auth.v2 epochs, locked pending-login ownership, revision-checked
refresh dispatch/commit/expiry, opaque initiating request permits and shared
transport locks prevent obsolete attempts/requests using replacement credentials.
Missing Web Locks reject credential writes/authenticated dispatch. No material
security issue found in the reviewed boundaries. All original seven regression
areas pass: membership A/B/A, CompanyPage permissions, private job drafts,
directory membership, Axios replay/refresh, provider stale login and cross-tab
stale editor mutation. Multi-page company lookup now captures one initiating
ownership; the earlier failing review-regression log predates its repair and the
passing final auth/full logs.

Recovered commands/results (run on November 14):
- frontend: npm test — PASS, 184 tests / 20 files
  (/tmp/devjobs-hardening-full.log).
- frontend: npm test -- --run src/features/auth/AuthContext.test.jsx
  src/features/auth/api.test.js src/features/auth/sessionStore.test.js — PASS,
  68 tests / 3 files (/tmp/devjobs-hardening-auth.log).
- frontend: npm test -- --run src/features/companies/discovery.test.jsx
  src/features/companies/CompanyPage.test.jsx
  src/features/jobs/pages/RecruiterPages.test.jsx
  src/components/templates/RecruiterLayout.test.jsx — PASS, 70 tests / 4 files
  (/tmp/devjobs-hardening-integration.log).
- frontend: npm run build — PASS (/tmp/devjobs-hardening-build.log).
- backend/.venv/bin/python backend/run_browser.py — PASS, PostgreSQL 17:
  171 passed / 8 skipped (179 collected, 38.58s), Chromium 3/3 (1.2m).
  Run 783a2bba7ed645f58209b89362bc45e3; container 959da4c41850;
  cluster 7708052352626552877; /tmp/devjobs-hardening-browser.log.
- backend/.venv/bin/python backend/run_browser_concurrent.py — both PASS.
  Runner 1: 0920bfb6837e49efa1794bf3210d9049, container 46cfed3a08a0,
  cluster 7708052700176879661. Runner 2:
  bf191b6394564577a0cf84df8584c520, container 9ffede27e4bf,
  cluster 7708052700135534637. Each: 171 passed / 8 skipped (179 collected,
  40.09s); peer service/cluster isolation PASS; Chromium 3/3 (1.2m).
  /tmp/devjobs-hardening-concurrent.log contains both completion and cleanup lines.
- Each Chromium execution passes native cross-tab security, Strict Mode provider
  lifetime/queued transport and candidate/recruiter/admin workflow scenarios.
  Zero unexpected browser errors. Workflow honors server Retry-After without
  changing throttle configuration. All runners applied migrations, passed Django
  system checks and reported no migration changes against their owned databases.

Commands run in this continuation:
- frontend: npm run lint — PASS.
- backend/.venv/bin/ruff check backend — PASS.
- backend/.venv/bin/ruff format --check
  backend/config/collection_pagination_tests.py backend/config/e2e_safety.py
  backend/config/test_e2e_safety_unit.py — PASS, 3 files.
- backend/.venv/bin/ruff format --check --config backend/ruff.toml
  /tmp/devjobs-2b1-format.py — PASS; extracted changed recruiter view/filter
  matches current source; historical surrounding formatting retained.
- /tmp/devjobs-m1-schema-tools/bin/python scripts/validate_openapi.py — PASS:
  OpenAPI 3.1, 39 paths / 55 operations, six serializer sets, 3 negative controls.
- Read-only ps inventory and docker ps -a --filter label=devjobs.e2e — PASS:
  no runner-owned process/container. Private devjobs-e2e/devjobs-concurrent
  temporary directories absent. Run-specific result directories are retained
  evidence, not live resources. No existing development service was stopped.
- git diff --check and git diff --cached --quiet — PASS; index empty.
  git branch --show-current: feat/admin-workspace-final.
  git rev-parse HEAD: 6f4f6bab00f68aba9d558996d42f2e868255c3a7.
  git rev-parse 'HEAD^{tree}': 2112fb7ec4d5a93e2f5f882eda877d778afaea82.
  git status --short, git diff --name-only and
  git ls-files --others --exclude-standard inspected.

Limits: 8 optional Redis tests skipped per PostgreSQL run; these are not claimed
passed. Chromium only; secure-context native Web Locks required. Native refresh
coverage does not force every late-response ordering; deterministic regressions
cover additional orderings. Already-dispatched server effects cannot be undone.
Existing JSDOM/Ant Design diagnostics and 762.49 kB bundle advisory remain.
Full tests/build and browser results are recovered, not rerun today; source
mtime inspection found no later frontend production/unit changes. Later browser
fixture and safety changes are covered by the completed concurrent run.
Gate 2 exact snapshot and hosted CI remain pending; M-06 limitations remain.
No dependency, production-settings, API or schema change in this continuation.
No staging, commit, push, merge, deployment or PR #1 modification. Stage 2B.2
not started.

Modified tracked paths (27):
```text
PROJECT_STATUS.md
backend/apps/recruiters/api.py
backend/config/collection_pagination_tests.py
backend/config/e2e_safety.py
backend/config/test_e2e_safety_unit.py
docs/API_CONVENTIONS.md
docs/LOCAL_DEVELOPMENT.md
docs/TESTING_STRATEGY.md
docs/openapi.yaml
frontend/e2e/workflows.spec.js
frontend/src/components/templates/RecruiterLayout.jsx
frontend/src/components/templates/RecruiterLayout.test.jsx
frontend/src/features/auth/AuthContext.jsx
frontend/src/features/auth/AuthPages.test.jsx
frontend/src/features/auth/api.js
frontend/src/features/auth/api.test.js
frontend/src/features/companies/CompanyPage.jsx
frontend/src/features/companies/CompanyPage.test.jsx
frontend/src/features/jobs/pages/CompanyDirectory.jsx
frontend/src/features/jobs/pages/JobsPages.test.jsx
frontend/src/features/jobs/pages/RecruiterPages.jsx
frontend/src/features/jobs/pages/RecruiterPages.test.jsx
frontend/src/features/jobs/services/api.js
frontend/src/features/jobs/services/api.test.js
frontend/src/features/resumes/ResumePage.test.jsx
frontend/src/features/resumes/api.test.js
frontend/src/test/setup.js
```

Untracked individual files (9):
```text
frontend/e2e/auth-cross-tab.spec.js
frontend/e2e/fixtures/provider-lifetime.jsx
frontend/e2e/provider-lifetime.spec.js
frontend/src/features/auth/AuthContext.test.jsx
frontend/src/features/auth/sessionStore.js
frontend/src/features/auth/sessionStore.test.js
frontend/src/features/companies/CompanyPicker.jsx
frontend/src/features/companies/discovery.test.jsx
frontend/src/features/companies/useCompanyMembership.js
```


## Stage 2B.1 Gate 2 exact snapshot procedure — 2026-11-15

Gate 2 audits the authorized company discovery implementation, authentication
repairs, regression/browser tests and API/testing documentation. The baseline is
feat/admin-workspace-final at 6f4f6bab00f68aba9d558996d42f2e868255c3a7,
tree 2112fb7ec4d5a93e2f5f882eda877d778afaea82, initially empty index.
The four unrelated local operations sections in PROJECT_STATUS.md and all
uncommitted LOCAL_DEVELOPMENT.md operations notes are excluded through index-only
staging; their working-tree bytes are preserved. No schema, migration, dependency
or production-settings changes are included.

Verification uses git archive of git write-tree, locked npm ci dependencies,
frontend lint/unit/build, backend Ruff/changed-code format, OpenAPI validation,
pure runner safety tests and standalone plus concurrent disposable PostgreSQL 17
and Chromium runners. All project code comes from the export. Existing backend
installed packages may be reused. Tree hashes, actual results and local commit
identity are recorded in the delivery report outside the tested tree to avoid
changing the snapshot after verification. Commit is conditional on every required
check passing and the index still matching the tested tree. No push, merge,
deployment or PR operation is authorized.

Security review covers originating provider lifetimes and retained callbacks,
canonical ownership, serialized credential writes, missing-lock rejection, stale
login/refresh cancellation, request initiation/dispatch/retry, membership A/B/A,
private drafts, stale editors and legacy storage rejection. Native browser refresh
coverage explicitly selects each document as winner with late success and late
failure; deterministic unit regressions cover both commit orders. These are
bounded regression guarantees, not exhaustive concurrency certification.
Secure-context Web Locks and Chromium remain required verification boundaries;
eight optional Redis tests may skip. Already-dispatched server effects cannot
be undone. M-06 remains open; Stage 2B.2 is not started.


## Stage 2B.1 Gate 2 exact snapshot result — 2026-11-15

**FAIL; no commit created.** Tested staged tree
59232ebfabfb0ca2dd6b257250bc5779bc7817d2 was exported with git archive.
35 authorized paths staged; LOCAL_DEVELOPMENT.md excluded entirely and four
PROJECT_STATUS local operations sections excluded in two diff hunks. Original
work preserved. This result is an unstaged append after testing; it is not part
of the tested tree and must be included in any rebuilt snapshot before a future
commit. Branch/HEAD remain the expected feat/admin-workspace-final /
6f4f6bab00f68aba9d558996d42f2e868255c3a7.

Fresh exported-source verification: npm ci, lint, 184 frontend tests / 20 files,
build, Ruff, three changed Python files plus extracted recruiter view/filter
format, OpenAPI 39 paths / 55 operations / three negative controls and 16 runner
safety tests PASS. Initial pure safety invocation was denied loopback sockets by
the sandbox; approved rerun passed. Initial OpenAPI invocation lacked exported
backend/.venv; linking the permitted installed dependency environment corrected
the harness setup without changing any exported source.

Standalone owned PostgreSQL 17: 171 passed / 8 optional Redis skipped; Django
check and migration consistency PASS; Chromium 3/3 PASS. Concurrent runners each
passed PostgreSQL 171/8, Django/migrations and peer service/cluster/credential
isolation. Runner c645570f0f494f519d62e92afae7a043 Chromium 3/3 PASS. Runner
b7d4116b9caa4dac8225767281a43249 Chromium 2 passed / 1 failed: native cross-tab
and retained-provider lifetime regressions PASS, role workflow FAIL at admin
login (workflows.spec.js:248). waitForResponse and form-button click at lines
44/45 timed out after 10000ms. Admin failure screenshot shows the preceding
429 with 25 seconds remaining. Helper honors Retry-After; evidence does not
explain why the subsequent form-button lookup/response failed. A specific
product defect or complete root cause is not established. No test or throttle
policy was weakened, and no retry was used to erase the failure.

Evidence: /tmp/devjobs-gate2-{frontend-tests,build,browser,concurrent}.log,
/tmp/devjobs-gate2-reviewed-staged.diff, export manifest and archive, and
/tmp/devjobs-e2e-b7d4116b9caa4dac8225767281a43249-results/. All three owned
containers cleaned; Docker inventory retains only the original stopped welcome
container. Final resource/hash verification is recorded in the delivery report.
No development database, schema, dependencies or production settings were
changed. Index remains staged for review; no commit/push/merge/deployment/PR
operation occurred. M-06 remains open; Stage 2B.2 not started.


## Stage 2B.1 Gate 2 login blocker repair — 2026-11-15

The starting index was verified as tree
59232ebfabfb0ca2dd6b257250bc5779bc7817d2, 35 authorized paths on
feat/admin-workspace-final at 6f4f6bab00f68aba9d558996d42f2e868255c3a7.
The earlier failed Gate 2 result above is retained and included in the rebuilt
snapshot. Four unrelated PROJECT_STATUS operations sections and all local
LOCAL_DEVELOPMENT notes remain excluded through index-only staging.

The quota response is expected policy: the cross-tab scenario makes two logins,
then the role workflow makes four. All are anonymous requests from 127.0.0.1;
separate browser contexts/accounts do not create separate client-IP quotas.
The sixth request within 60 seconds exceeds 5/minute. Each runner has a separate
backend process and process-local cache, independent UUID accounts, database,
ports and browser contexts. Production Redis is not used by these E2E settings;
there is no demonstrated cross-run cache or credential leak.

A controlled Chromium regression holds the real Ant Design loading-icon leave
transition across a 429. The button's native accessible name is then
"loading Log in", although its visible text is "Log in". The old exact-name
selector fails after the quota wait and its unobserved response promise also
times out. The control run reproduces this failure (11.8s), and the old helper's
role workflow fails again at admin login. An initial diagnostic run passed,
confirming the renderer timing is intermittent. The historical failed run had
no accessibility trace: its exact renderer schedule cannot be reconstructed.
This is a demonstrated helper defect, not a proven production login defect.
Control evidence: /tmp/devjobs-login-red.log and preserved old helper
/tmp/devjobs-login-red-helper.js; diagnostic: /tmp/devjobs-login-investigate.log.

The shared E2E helper now selects the form's submit button independently of its
decorative icon and waits for visibility, enabled state and React's non-loading
class. Click and matching POST response are observed together with Promise.all.
Only one bounded retry is allowed, using precisely the server's Retry-After;
there is no arbitrary padding or enlarged action/scenario timeout. It checks
that the original URL, document and anonymous session record survive the wait,
and verifies the final account identity as well as the workspace menu.
No production/frontend application source, throttle policy, runner architecture,
API, schema, migration or dependency change is required by this repair.

Regression coverage adds native 429/held-icon retry with a real admin login,
retry cancellation on navigation, anonymous session replacement and context
closure, plus a component test for anonymous credentials, retained form values,
idle submit state and no automatic resubmission after admin 429. Existing
cross-tab, provider-lifetime, company-discovery and role assertions remain.
Focused AuthPages command: npm test -- --run
src/features/auth/AuthPages.test.jsx — PASS, 8 tests. Frontend ESLint PASS.
An initial npm run lint from repository root failed ENOENT; the correct frontend
working directory passed. Browser and exact-snapshot acceptance results are
recorded in the delivery report, outside the tested tree, to keep its identity
stable. No check is accepted merely because the earlier snapshot passed.

The rebuilt staged tree must be exported using git archive and verified with
fresh npm ci, full frontend tests/lint/build, backend Ruff/changed-code format,
OpenAPI, 16 pure runner safety tests, standalone owned PostgreSQL 17/Chromium,
and three complete fresh concurrent pairs with peer rejection. Commit is
conditional on every required check passing and an unchanged tested index.
Only the requested local commit is authorized; no push, merge, deployment or PR
operation. Chromium/native Web Locks remain the boundary; optional Redis tests
may skip, hosted CI is pending, and repeated passes are bounded evidence rather
than a proof of race freedom. M-06 remains open. Stage 2B.2 is not started.


## Stage 2B.2 blocking ownership regression — 2026-11-15

Added CompanyApiTests.test_admin_cannot_take_company_ownership_from_active_owner
in backend/apps/companies/api_tests.py. It authenticates an existing company ADMIN,
PATCHes that admin's membership with role OWNER, and asserts HTTP 403 and unchanged
OWNER/ADMIN database roles. This is intentionally failing evidence, not xfail.

Command: `backend/.venv/bin/python /tmp/devjobs-2b2-contract-audit.py`
(output redirected to `/tmp/devjobs-2b2-contract-audit.log`). The temporary audit
harness derives from run_browser.py, retaining owned disposable PostgreSQL 17,
connection verification and finally cleanup; it narrows pytest to this regression
and stops before browser provisioning. Result: **FAIL, 1 failed in 0.38s**, actual
HTTP 200 and roles ADMIN/OWNER. Migrations, Django check and migration consistency
passed before pytest. Runner reported cleanup for run
5c1d2b37027c4c8e87adadb43c09c6f0. No development database was used.
An initial temporary harness import failed before resource creation; its import
path was corrected. Full frontend/backend, browser, concurrent and staged-export
acceptance checks were not run because the explicit security stop rule applies.

## Stage 2B.2 ownership repair verification — 2026-11-15

Reproduction: `backend/.venv/bin/python /tmp/devjobs-2b2-contract-audit.py`
with output `/tmp/devjobs-2b2-reproduce.log`: FAIL as expected, original regression
HTTP 200, OWNER/ADMIN swapped. Runner-owned PostgreSQL 17; cleanup confirmed.
Repair gate: `backend/.venv/bin/python /tmp/devjobs-2b2-security.py`:
34 company tests PASS. Full initial backend gate:
`backend/.venv/bin/python /tmp/devjobs-2b2-backend.py`: 176 PASS / 8 optional Redis
SKIP, Django check and migration consistency PASS. Wrappers retain run_browser.py
container identity/connection verification/finally cleanup and stop before browser.
Never target development databases or devjobs_test.

New regressions cover ADMIN self/other promotion, owner demotion/suspension/removal,
MEMBER/suspended ADMIN/outsider/candidate/anonymous transfer denial, no-side-effect
snapshots, sole-owner success, direct service creation/assignment rejection,
rollback and exactly one concurrent authorized transfer. Original regression is
preserved without weakening assertions. Existing invalid-target, cross-company,
deferred-integrity and pagination query-growth tests remain required.

Frontend checks: `npm test`, `npm run lint`, `npm run build` in frontend.
Focused company tests cover bounded pages, no following untrusted navigation URLs,
OWNER-only eligible transfer, post-transfer ADMIN permissions, obsolete confirmation
rejection and 403 authority revocation, alongside all Stage 2B.1 regressions.
Chromium workflow adds a real ownership round trip, role restoration, suspension,
removal and revoked member access. Existing native cross-tab/Strict Mode/429
regressions remain enabled without retries or relaxed timeouts/throttles.

Final gates use `backend/.venv/bin/python backend/run_browser.py` and
`backend/.venv/bin/python backend/run_browser_concurrent.py` (owned PostgreSQL 17,
full pytest/check/migrations plus Chromium and peer identity rejection). Ruff:
`backend/.venv/bin/ruff check backend`. Format: extract changed company functions
with ast, dedent, then `ruff format --check --config backend/ruff.toml` on the
combined fragment; full-file formatting flags historical unchanged code.
OpenAPI: `/tmp/devjobs-m1-schema-tools/bin/python scripts/validate_openapi.py`.

After working-tree gates pass, stage only authorized files/hunks, run
`git diff --cached --check`, `git write-tree`, export with `git archive`, and run
fresh `npm ci`, all frontend checks, Ruff/changed-function format, OpenAPI, pure
runner safety tests and standalone/concurrent runners against that export.
Exact results/tree/commit identities belong in the external delivery manifest
so recording them does not mutate the tested tree. Any failed final gate prevents
commit. Inventory containers, processes and private temporary resources afterward.

Independent continuation review added page 1 -> 2 -> 1 callback invalidation and
queued transport revocation. The queued membership regression first failed with
21 passes / 1 failure (`/tmp/devjobs-2b2-queue-red.log`): no dispatch authority
validator was supplied. Mutations now pass the existing Axios `_assertAuthority`
check tied to the originating action lifetime; dispatch/retry rejects a retired
editor. Page transitions use distinct action identities so returning to a numeric
page cannot revive its old callbacks. Company targeted gate after synchronized
concurrency coverage: 37 PASS (`/tmp/devjobs-2b2-security-final.log`).

Development Chromium failures were retained: the first run selected Ant Design's
hidden virtual accessibility option; the second selector also matched its visible
label and failed strict selection, as did the overlapping concurrent pair. The
corrected selector targets visible `.ant-select-item-option-content` with exact
text. No timeout, throttle or assertion was weakened; no automatic retry enabled.
Logs: `/tmp/devjobs-2b2-browser.log`, `-browser-final.log`, `-concurrent.log`.
Final fresh standalone/concurrent and exported-tree outcomes are in delivery.

Working-tree completed commands: frontend lint, `npm test` (192 / 20 files),
build PASS (`/tmp/devjobs-2b2-frontend-complete.log`, `-build-complete.log`).
Standalone `backend/.venv/bin/python backend/run_browser.py` PASS: 179 PostgreSQL
tests / 8 optional Redis skipped, checks/migrations, Chromium 7/7
(`/tmp/devjobs-2b2-browser-corrected.log`, run 05879391d258421db52d9b682849d699).
Concurrent `backend/.venv/bin/python backend/run_browser_concurrent.py` PASS:
both 179/8 plus 7/7 Chromium; peer service/cluster rejection; zero browser errors.
Runs 82062704c9294e2c8dec964c3cbd99cb / f3f51d4466064babbf071f50b62e035d;
`/tmp/devjobs-2b2-concurrent-corrected.log`. All owned resources reported cleaned.
Some working-tree runs observed Vite updates; the frozen exported snapshot must
pass again. Ruff, changed-function format, OpenAPI (39 paths / 55 operations,
three negative controls) and 16 pure isolation tests PASS. Existing Ant Design
warnings and 762.49 kB bundle advisory remain. Final snapshot results are external.

Export review added a 390px membership-screen horizontal-overflow and keyboard
focus check. The target-specific transfer accessible name remains intact while
its visible button label is bounded. The initial exported tree is superseded;
all exact-snapshot gates must pass again on the rebuilt tree before commit.


## Stage 2B.3 candidate skills blocking contract audit — 2026-11-15

New `backend/apps/candidates/skills_contract_tests.py` verifies normalization,
Unicode/punctuation support, duplicate reuse, unknown/invalid input, cross-account
privacy, GET/POST/DELETE role denial and last-page deletion/fallback. Its Unicode
length-expansion regression intentionally fails: POST 80 U+0130 characters returns
500 instead of 400 because normalized model length validation is not translated
into a DRF field error. Do not skip/xfail or weaken this assertion.

Command from repository root:
`backend/.venv/bin/python /tmp/devjobs-2b3-contract-audit.py`
(log `/tmp/devjobs-2b3-contract-audit.log`). This session-only wrapper derives from
run_browser.py, retains owned disposable PostgreSQL 17 identity checks/finally
cleanup, and runs pytest with `--ds=config.settings.e2e` on
`apps/candidates/skills_contract_tests.py`, `apps/candidates/api_tests.py` and
`config/collection_pagination_tests.py`; stops before browser provisioning.
Final result: **18 passed / 1 failed / 0 skipped, 19 collected, 3.32s**.
Migrations, Django check and migration consistency PASS. Run
39f26fbf6b31465f965e09fb88585dc5; owned cleanup reported. No development database.
Initial sandbox Docker denial preceded resource creation. Initial host run had
17 passes and 2 failures, one caused by an incorrect ADMIN test fixture; fixed via
create_superuser. Original log retained as `-audit-initial.log`.

`backend/.venv/bin/ruff check backend/apps/candidates/skills_contract_tests.py`,
`backend/.venv/bin/ruff format --check backend/apps/candidates/skills_contract_tests.py`
and `git diff --check` PASS. Full acceptance, frontend, standalone/concurrent
Chromium, peer isolation, accessibility, OpenAPI, runner safety and exact staged
export checks were not run; no commit was created. See STAGE_2B3_SKILLS.md for
root cause and the narrow backend validation repair requiring authorization.

### Authorized Stage 2B.3 continuation

The blocking audit above is superseded by the authorized serializer repair.
Original regression retained; valid ASCII, Unicode and 40 U+0130 (80 normalized
code points) coverage added, alongside empty input. Reproduction in this session:
18 PASS / 1 FAIL, exact stack CandidateSkillsView.post → get_or_create →
Skill.save → full_clean → Django ValidationError. Repaired focused API/profile/
pagination run: 20 PASS. Full owned PostgreSQL 17 backend gate: 185 PASS / 8
optional Redis SKIP (193 collected), Django checks and migration consistency PASS.

Commands: `backend/.venv/bin/python /tmp/devjobs-2b3-contract-audit.py`,
`backend/.venv/bin/python /tmp/devjobs-2b3-backend-gate.py` (session-only isolated
wrappers); frontend `npm test`, `npm run lint`, `npm run build`; backend
`.venv/bin/python -m unittest config.test_e2e_safety_unit config.test_e2e_runtime_unit`
(16 PASS); `backend/.venv/bin/ruff check backend`; changed-method formatting
(extracted validate_name) and full skills_contract_tests.py formatting;
`/tmp/devjobs-m1-schema-tools/bin/python scripts/validate_openapi.py` (39 paths /
55 operations / three negative controls). Existing surrounding api.py formatting
is preserved; full-file format check reports baseline differences.

Skills component tests exercise synchronous duplicate guards, field errors,
page/unmount authority invalidation, pagination fallback and late results.
Real Axios/provider tests cover GET/POST/DELETE across A→B, A→B→A, logout,
same-user replacement, unmount, plus queued transport cancellation. Existing
authentication tests remain required. Native Chromium checks include held storage
events before cross-tab replacement, real API skill pagination/add/remove/Unicode
400, profile integration, 1440/768/390 widths and keyboard focus/removal.

Development-only failures: an initial command used frontend-prefixed paths while
already in frontend; no source was changed by that invocation. The profile test
initially submitted while skills were still loading; it now awaits the actual
empty state and configures the server list before submitting. Stable Add skill
accessible name avoids decorative loading-icon selector changes. A direct pytest
invocation for pure safety tests lacked Django settings; the documented unittest
command passed without database setup. Logs remain under /tmp/devjobs-2b3-*.
Final frozen export results and tested/commit identities are reported externally
to avoid changing the tree after verification. No earlier run substitutes for
that final acceptance gate.

The first combined Chromium run passed the two new skill scenarios but failed
existing admin retry/registration workflows because the three new accounts
consumed shared anonymous quotas. The owned runner now provisions those synthetic
candidate profiles and JWT fixtures directly in its already-verified disposable
cluster, alongside its existing admin fixture. No rate, cache, retry limit or
arbitrary sleep changed. Tokens remain process-only and are not logged. The
failed run cleaned its resources; final standalone/concurrent gates must rerun.
Final working-tree frontend gate: 213 tests / 22 files PASS, lint and build PASS
(existing large-chunk advisory). Session coverage includes three queued transport
cancellation tests. Strict Mode effect cleanup also invalidates each GET response
independently of the rendered page lifetime.

### Interrupted verification recovery — 2026-11-16

Recovered complete working-tree logs, including final summaries and cleanup:
`/tmp/devjobs-2b3-browser-final.log` records run
8f3c180bd0454e8e969d1de4582332be, PostgreSQL 185 passed / 8 optional Redis
skipped, Chromium 9/9. `/tmp/devjobs-2b3-concurrent.log` records runs
7269e35b8ab84411aa797f2149ad4aac and 47649f54e81749cbaf035442b27071f6,
each PostgreSQL 185/8 and Chromium 9/9, peer rejection and owned cleanup.
No interrupted run is counted as a pass. Docker inventory contains only the
unrelated stopped welcome container. Earlier fixture-quota failure remains
historical evidence and is superseded by these completed corrected runs.

Separate final source review found no critical issue in normalized-length checks,
candidate ownership, page fallback, synchronous duplicate guards, Strict Mode
response invalidation, retained callbacks, session replacement, stale responses
or queued dispatch. The shared Axios transport validates both session and view
authority at dispatch, retry and response; provider epoch remounts invalidate
A/B/A and same-user replacement lifetimes. Tests cover these bounded guarantees.
Cancellation cannot roll back a request already dispatched to its original user.

Final acceptance runs `/tmp/devjobs-2b3-snapshot-verify.py <export>` against a
`git archive` export of the staged tree, with locked `npm ci`, full frontend
tests/lint/build, Ruff, changed-code format, OpenAPI, pure runner safety, standalone
and concurrent owned PostgreSQL 17/Chromium. Exact results and tree/commit IDs
remain external so the tested tree does not change after verification.

## Stage 2B.4 callback authority acceptance

See [STAGE_2B4_CALLBACK_AUTHORITY.md](STAGE_2B4_CALLBACK_AUTHORITY.md) for the
independent baseline dispatch reproduction, 82 real-Axios lifecycle regressions,
ordinary/Strict Mode profile integration, controlled pending mutations, awaited
static-message teardown and exact exported-tree acceptance commands. The original
intermittent Remove python audit failure is preserved; its precise historical
renderer schedule is not established. No earlier working-tree pass substitutes
for the full exact staged-snapshot gate.

## M-06 exact-export acceptance

See M06_API_SCALABILITY.md for new keyset/lookup/query-plan HTTP regressions,
frontend stale-view/preview coverage and Chromium count-free assertions. Run
frontend full tests/lint/build, backend lint/changed-format, OpenAPI, pure runner
safety, standalone and concurrent owned PostgreSQL 17.12/Chromium on the same
staged-tree export. Verify every exported blob and the staged tree before commit;
keep results/commit identities outside that tree. Existing array, numbered-page,
JWT, cross-tab, refresh/deadline, ownership and isolation assertions are retained.
