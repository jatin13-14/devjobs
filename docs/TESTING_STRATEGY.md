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
