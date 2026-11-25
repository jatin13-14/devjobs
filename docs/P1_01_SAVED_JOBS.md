# P1-01 — Saved Jobs (initial implementation)

**Branch:** `feat/p1-01-saved-jobs`  
**Scope:** Post-MVP candidate bookmarks. No deployment, external service, subscription, or notification changes.

## Product behavior

- A signed-in active candidate with a candidate profile can save a currently visible/published, non-expired job. Recruiter/admin/anonymous access cannot read or mutate saved jobs.
- Save is **idempotent**: first request creates the bookmark (201), repeated request returns it (200). A database unique constraint on candidate/job prevents duplicates.
- Unsave is **idempotent** (204), scoped to the current candidate. It works even if a formerly saved job has been closed/hidden or expired.
- Saved-jobs list is private and paginated (20 items by default, 100 maximum), ordered by saved time (newest first). It only returns *currently public* jobs: published, non-hidden, non-suspended companies and unexpired deadlines. Existing hidden/closed/expired bookmarks remain stored but invisible until eligible again; unsave still works via direct detail endpoint.
- Job detail offers Save/Remove saved job to candidate accounts. Candidate user menu links to `/candidate/saved-jobs`. Other users retain existing public job discovery.

## API

| Endpoint | Method | Success |
|---|---|---|
| `/api/v1/candidates/me/saved-jobs/` | GET | 200 with `{count,next,previous,results:[{job,saved_at}]}`; `job` uses existing public JobSerializer fields |
| `/api/v1/candidates/me/saved-jobs/{job_id}/` | GET | 200 with `{saved:boolean}` for the authenticated candidate (no other candidate's state) |
| same item endpoint | PUT | 201 on new bookmark or 200 if already saved; `{job,saved_at}`. 404 if job not public |
| same item endpoint | DELETE | 204, including already-removed or currently hidden job |

- All endpoints require an authenticated candidate; invalid or absent candidate profile is denied. Unexpected server errors use existing safe API/transport behavior.
- No public job or recruiter API response is changed. The model is `jobs.SavedJob`, migration `jobs.0004_savedjob`, UUID identity and unique candidate/job constraint with index on candidate/saved_at.
- Candidate bookmarks are **not** applications, notifications, or endorsements.
- No fake user emails or credentials are added to configs; tests reuse the repository's existing synthetic fixture creator.

## Acceptance gates

- Django check; `makemigrations --check --dry-run`; migration up on disposable PostgreSQL 17; all existing and added backend tests; Ruff.
- Frontend lint/tests/build and targeted candidate bookmark UI tests. Enforced `npm audit` remains active.
- Real Chromium: candidate save, reload/state persistence, saved list, unsave; candidate A/B isolation and recruiter denial; public visibility after hiding/closing/expiry.
- Verify exact PR commit and hosted checks before merge. Do not merge, deploy, or run on a real-user database without review.

**Delivery status:** initial code and tests on feature branch; hosted/standalone verification pending. See PR discussion. This file is not a claim that release acceptance has passed.
