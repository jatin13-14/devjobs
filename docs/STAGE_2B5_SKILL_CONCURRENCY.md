# Stage 2B.5 F-12 concurrent skill creation

Disposable PostgreSQL 17 API regressions confirm a defect. Both requests first
observe an absent canonical skill. Request one completes before request two's
model validation. Skill.full_clean then raises a name uniqueness ValidationError;
Django get_or_create retries IntegrityError but not this validation exception.
The baseline API returns 500 for the second request. The original outer handler
only catches IntegrityError. Same-candidate and different-candidate ASCII and
Unicode cases reproduce [201, 500]. Evidence:
/tmp/devjobs-2b5-f12-http-red.log (four failing subcases, four passes).

The new add_candidate_skill service owns the transaction and retains model
validation. It recovers only name-field errors whose codes are all unique, and
only if the exact canonical winner can be re-read. Other errors propagate.
An inner savepoint contains the failed creation attempt; global creation and
association remain in one outer transaction. Association get_or_create retains
its database uniqueness handling. No constraints are weakened or removed. The
API remains 201 for the first association, 200 for an existing association; two
different candidates both receive 201 and share one global Skill row.

Four PostgreSQL-only concurrency tests cover same/different candidates under
both unique-INSERT contention and insertion between lookup and validation. Each
runs ASCII whitespace/case and Unicode lowercase-expansion variants. Barriers
synchronize the observed-missing lookups or completed validation snapshots; an
event permits the first response to complete before the second validation.
There are no sleeps. Threads own separate Django connections and API clients.
Assertions check statuses, canonical names, one global row, equal skill IDs and
exact per-candidate associations. Three service tests check unrelated validation,
uniqueness without a winner, and rollback after association failure.

Final focused command uses the existing owned disposable runner lifecycle with
only its pytest selection changed to skills_concurrency_tests.py and
skills_service_tests.py, exiting before browser fixture creation. Seven tests
passed on a fresh PostgreSQL 17 cluster; cleanup confirmed. No development DB or
devjobs_test is used. The runner source is not changed by this focused harness.
An initial imported TestCase unintentionally collected six contract tests; fixture
reuse now imports the module. One reproduction attempt had an indentation error;
its log is retained separately and the corrected baseline produced actual 500s.
Ruff initially found import/closure/context-manager issues in the new tests; they
were repaired and the final lint and formatting checks pass.

New Python files follow full-file Ruff formatting. Only the changed API method
is reformatted; historical surrounding formatting is retained. Full exact-export
frontend/backend/browser/peer/security acceptance remains mandatory before commit;
identities and final counts are external to the tested tree. No schema, migration,
public API shape, normalization policy, dependencies, authentication policy or
production settings change. Unicode normalization here means existing whitespace
collapse and lowercasing, not a new NFC/NFKC equivalence policy.
