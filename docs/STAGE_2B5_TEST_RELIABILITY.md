# F-02 hosted profile integration-test reliability

Hosted frontend runs 43819578250 (F-03) and 43822026159 (F-04) fail only
ProfilePage.test.jsx's combined candidate save/skill CRUD scenarios at the
unchanged five-second test deadline. Other frontend assertions and hosted F-03
Chromium pass. Local exact-export suites pass, so hosted CI is not inferred from
local results. Hosted logs identify test-duration exhaustion, not a product
assertion failure or known network error.

The scenario repeatedly searched the entire profile form, sibling skills card
and static message roots by accessible role. Those queries compute accessibility
styles while Ant Design renders many unrelated fields. The test now scopes role
queries to the profile form, skills card and confirmation popup. Save-button
loading is observed through the same captured DOM element. A later loaded full-suite run still exhausted the combined scenario deadline,
so scoping alone was insufficient. The candidate save and skill lifecycle now
run as separate focused scenarios, both on the full ProfilePage and both in
ordinary and Strict Mode. Every assertion, mutation, controlled pending POST
and refresh observation remains; the browser suite retains the combined journey; no timeout, delay, skip, production code changes. A further concurrent full run exposed the same
duration exhaustion in the short F-04 UI regression. The host reports ten
available CPUs and installed Vitest selects nine forks by default, oversubscribing
CPU alongside three isolated Chromium/Vite/PostgreSQL runners. Vitest now uses a
two-worker budget, retaining file parallelism and all explicit concurrency tests.
Request race tests and the independent Chromium pair remain concurrent; no
test deadline or assertion changes.

A disposable instrumented original test reproduced the same five-second timeout
under concurrent local workload. getComputedStyle call counts were 115/228 for
the two candidate scenarios; an instrumented scoped run passed with 108/110.
These runs support the redundant-query diagnosis, but differing scheduling means
they are not a controlled latency benchmark or proof of the exact hosted schedule.
Metrics instrumentation exists only in a disposable reproduction directory.
Logs: /tmp/devjobs-2b5-profile-baseline-metrics.log and
/tmp/devjobs-2b5-profile-scoped-metrics.log. The first two frozen exports are superseded by the split scenarios and scoped
confirmation query plus the two-worker DOM budget; hosted verification must establish whether these repairs
are sufficient on Linux. A failed full run is retained at
/tmp/devjobs-m09-full.log; it is not an accepted gate. No claim of resolved CI before its actual result.

Commands: from frontend, npm test -- src/features/profiles/ProfilePage.test.jsx;
npm test; npm run lint; npm run build. Exact-export acceptance also runs the full
owned PostgreSQL 17/Chromium standalone and concurrent pair, peer isolation,
Django/migration checks, Ruff, existing formatting policy, OpenAPI and 16 pure
runner-safety tests. Final tree/commit identities and results remain external.
No API/schema/dependency/authentication/production behavior change.
