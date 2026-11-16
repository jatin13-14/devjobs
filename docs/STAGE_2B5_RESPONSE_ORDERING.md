# Stage 2B.5 F-03 application response ownership

Baseline: feat/admin-workspace-final, HEAD
095cf6e82a1cf899e5fcc3a315d5abda71b1fb29, tree
b6e538158c3bb4264e31f497d909c9b6d16693d5.

Both candidate application views previously accepted every GET completion. A
controlled route A/B regression on the frozen baseline renders B, releases A,
and fails because A replaces B. Evidence: /tmp/devjobs-2b5-f03-red.log.

useApplicationResource composes existing useViewAuthority with individual read
ownership. Every replacement aborts the previous request; dispatch/retry and
completion require the same live view, canonical session and active request.
Data, error and loading are updated together only by that owner. A new page or
route hides previous data immediately. Unmount aborts reads; session-provider
epoch replacement retires all state. Withdrawal callbacks capture the rendered
request, check authority at initiation/dispatch/retry/completion, and refresh only
their originating view. Synchronous busy ownership prevents duplicate mutations.
Detail errors now offer Retry. Already-dispatched server mutations cannot be
recalled by client cancellation.

Regression tests use real Axios/session integration for page and route changes,
late success/errors, aborts, concurrent retries, A/B and A/B/A account replacement,
same-account re-login, logout, unmount, retained callbacks, mutation refresh,
page A/B/A, and Strict Mode. The separate page integration test intentionally
ignores cancellation to exercise completion ownership. Existing withdrawal UI
coverage now verifies the authority config passed to the API.

Commands (frontend): npm test; npm run lint; npm run build. Focused tests:
npm test -- src/features/jobs/useApplicationResource.test.jsx
src/features/jobs/pages/ApplicationsPage.ordering.test.jsx
src/features/jobs/pages/JobsPages.test.jsx.
Commands (root): backend/.venv/bin/python backend/run_browser.py;
backend/.venv/bin/python backend/run_browser_concurrent.py;
backend/.venv/bin/ruff check backend;
/tmp/devjobs-m1-schema-tools/bin/python scripts/validate_openapi.py.
Runner safety (backend): .venv/bin/python -m unittest
config.test_e2e_safety_unit config.test_e2e_runtime_unit.

Initial root-level npm commands failed ENOENT; corrected frontend invocations
are required. Initial browser invocation could not access Docker in the sandbox;
the approved runner uses owned disposable PostgreSQL 17. No existing database is
used. Eight optional Redis tests may skip. Historical Python formatting debt and
Vite bundle advisory remain. Final acceptance identities/results are recorded
outside the tested tree. No backend/API shape/schema/migration/dependency or
production setting change. F-04 and F-12 remain separate pending workstreams;
this document does not claim Stage 2B.5 complete.
