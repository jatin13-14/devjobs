# P0 candidate repair acceptance handoff — 2026-11-17

Preservation checkpoint, not complete acceptance. Do not start M-02 or new work.
Branch `fix/p0-candidate-pages`; HEAD
`819f8d687fe25a7f7ea4b6000e58a666aeba79ef`. Index empty at inspection.

## Saved changes and review

Repair source: `frontend/src/features/auth/validateResponse.js` (five added lines).
Tests: adjacent `validateResponse.test.js` (nine added lines) and
`frontend/e2e/routes.spec.js` (21 added lines). No unrelated source changes found.
`docs/P0_ROUTE_RENDERING.md` contains the existing 66-line recovery record.
`PROJECT_STATUS.md` mixes P0 recovery with earlier operations and M-02 notes;
never stage it wholesale without hunk review. `docs/LOCAL_DEVELOPMENT.md` contains
160 pre-existing added operations lines; preserve and exclude from repair staging.
Untracked `docs/M02_JWT_REVOCATION.md` is existing design work; preserve/exclude.
This handoff and its status entry are documentation-only additions.

The stale November 9 Django process ignored skills pagination and returned HTTP
200 arrays. Dashboard expects cursor envelopes; Profile expects page envelopes.
An identity-checked backend restart restored the current API. Shared GET response
validation rejects arrays for explicit page/cursor requests before React renders,
activating existing Error/Retry UI. Unpaged legacy arrays remain supported.
No API/schema/authentication/dependency/backend source change.

Coverage reviewed: unit tests reject page/cursor arrays and malformed roots or
envelopes, and preserve legitimate responses. Two saved Chromium regressions
exercise `/candidate` and `/candidate/profile`: injected HTTP 200 `[]`, visible
error, absence of render fallback, removal of interception, Retry, intended
content, reload, and zero page exceptions. They still require owned-runner execution.

## Evidence and quick verification

Previously recorded PASS (not rerun for this handoff): frontend 385 tests/32 files,
lint/build, dashboard/skills 27 tests, and real-local browser recovery/hard reload.
See `P0_ROUTE_RENDERING.md` for exact previous commands and known warnings.
Existing `/tmp/devjobs-candidate-verify.log` was inspected and records successful
local route/fault/Retry checks and zero page exceptions. Helpers
`/tmp/devjobs-candidate-verify.cjs` and `/tmp/devjobs-candidate-restart.py` exist;
they are temporary historical evidence, not the acceptance entry point.
Do not rerun registration/restart helpers without reviewing their side effects.

This handoff ran `cd frontend && npm test -- src/features/auth/validateResponse.test.js`:
PASS, 17 tests/one file. `git diff --check`: PASS. Git/source/test review completed.
No full acceptance, lint/build repetition, database mutation, staging or commit.

Older `/tmp/devjobs-p0-current-unit.log` records **380**, not 385 tests;
`/tmp/devjobs-p0-resume-unit.log` contains historical failures. Neither proves
the final 385-test result. That result is recorded in the existing recovery docs
and supplied verified session state; a separate final full-suite log was not
identified during this handoff. Do not relabel older logs as current evidence.
Temporary paths may disappear; use versioned tests to reproduce acceptance.

## Exact next acceptance commands

From repository root, inspect `git status --short`, branch and HEAD again, then
run the first pending gate (save its exit status; do not mask failures with tee):

```sh
backend/.venv/bin/python backend/run_browser.py > /tmp/devjobs-p0-candidate-owned.log 2>&1
```

Expected: exit 0; verified disposable PostgreSQL 17.12; Django and migration
checks pass; full backend pytest summary passes (only documented optional skips);
all development Chromium specs pass, including both new
`legacy skills server response is recoverable` tests; owned cleanup reported.
Do not assume historical test counts equal today's counts.

Then separately, checking each exit code before continuing:

```sh
E2E_PRODUCTION=1 backend/.venv/bin/python backend/run_browser.py > /tmp/devjobs-p0-candidate-production.log 2>&1
backend/.venv/bin/python backend/run_browser_concurrent.py > /tmp/devjobs-p0-candidate-concurrent.log 2>&1
```

Production expects fresh bundle build, route-only Chromium suite including both
new regressions, backend gates, cleanup and exit 0. Concurrent expects both full
runners exit 0, both peer identity checks completed, and both cleanups. Browser
failure artifacts: `/tmp/devjobs-e2e-<run-id>-results`; retain run IDs and summaries.
These runners must own all services/databases; do not point Playwright directly
at development ports or bypass identity guards. Requirements: working Docker,
digest-pinned PostgreSQL image, installed frontend dependencies/Chromium and backend
virtual environment. Request sandbox escalation if execution is denied.

After these gates, prepare a focused candidate snapshot using the repository's
documented exact-index/export process (`docs/TESTING_STRATEGY.md` and
`docs/E2E_ISOLATION.md`). Review individual documentation hunks; exclude M-02 and
operations notes. Record the candidate tree identity externally and run on the
unchanged exported snapshot:

```sh
cd frontend
npm run lint
npm test
npm run build
cd ..
backend/.venv/bin/python backend/run_browser.py
E2E_PRODUCTION=1 backend/.venv/bin/python backend/run_browser.py
backend/.venv/bin/python backend/run_browser_concurrent.py
git diff --check
```

Expected frontend baseline: 385 passing tests unless intentionally changed;
lint/build exit 0, existing chunk advisory allowed. Check exported inputs match
the proposed staged tree and no changes occurred after verification. Do not reuse
old `/tmp/devjobs-p0-final-export-v3` as proof for this newly modified source.
Do not commit/push/open a PR in this preservation task. A later session must honor
the owner's verification/authorization gates. Hosted CI for the repaired tree is
still pending and requires a separately authorized publication after local gates;
record actual workflow URLs, tested SHA and success, never infer hosted success
from old branch runs. No current hosted result is claimed.

No source blocker found. Remaining blockers to acceptance are unexecuted owned,
production, concurrent and exact-snapshot gates, followed by hosted verification.
M-02 design approval remains outside this task. All unrelated work was preserved.

## Acceptance delivery continuation

The owner's completion request supersedes this checkpoint's preservation-only
publication restriction: commit the accepted repair, push `fix/p0-candidate-pages`
normally and open a separate draft PR targeting `fix/p0-route-rendering` only
after exact-export gates pass. Existing PR targets must remain unchanged.

Fresh working-tree results: development Chromium 85/85; production-bundle routes
75/75; concurrent Chromium 85/85 in each runner, both peer-isolation checks PASS.
Each of four fresh owned PostgreSQL 17.12 clusters passed migrations, Django and
migration-consistency checks, and 209 backend tests with eight documented optional
Redis skips. All four cleanups were reported. Frontend lint, 385 tests/32 files,
build, Ruff, OpenAPI (40 paths/56 operations/three negative controls), 17 pure
runner-safety tests and whitespace checks PASS. No intermittent test failure was
observed. Docker/socket sandbox denials were rerun with permissions; the old
OpenAPI virtualenv lacked PyYAML, so the existing M-06 schema environment was used.
No dependency or source change was needed during this acceptance continuation.

Only the validator, its unit/browser regressions, this handoff, the candidate
recovery section of P0_ROUTE_RENDERING.md and P0-only PROJECT_STATUS.md additions
belong in the snapshot. M-02 and earlier operations entries remain excluded.
The exact staged export must repeat every gate above before commit. Exported blob
hashes/modes, unchanged index, cleanup, tested/committed tree identities, final
commands/counts and actual hosted results are recorded in the external delivery
manifest and draft PR so they do not alter the tested artifact. Historical pending
statements above describe the earlier checkpoint, not the final delivery result.
