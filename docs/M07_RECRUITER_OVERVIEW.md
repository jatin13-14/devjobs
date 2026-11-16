# M-07 bounded recruiter dashboard aggregation

The dashboard previously traversed every company job page and every applicant
page, retained every application (including skills/cover letters) and computed
counts/daily activity in the browser. Each response was paginated, but total
requests and retained data grew with the company. First-page totals would have
silently changed the product's existing company-wide metrics.

A compatible additive GET /api/v1/companies/{company_id}/application-overview/
uses the existing active recruiter OWNER/ADMIN authorization boundary. MEMBER,
outsider, candidate, platform administrator, inactive account and suspended company
or membership cannot read applicant metrics. Existing endpoints, response shapes,
legacy arrays, JWT policy, throttling, schema and ownership rules remain unchanged.
No new analytics feature or job/applicant mutation is introduced.

Optional time_zone is an IANA zone (UTC default, 1–128 characters); invalid values
return a field-level 400 after authorization. The response contains time_zone,
total/submitted/reviewing application counts, seven calendar-day {date,count}
buckets ending today, and at most three recent rows ordered by applied_at DESC,
id ASC. All application statuses contribute to total and daily submission activity;
status-specific counts remain separate. Recent rows contain only application
id/applied_at, job id/title and candidate full_name/professional_headline.
No cover letter, skills, resume metadata/storage keys, emails or credentials.

SQL performs one aggregate statement and one LIMIT 3 recent-row statement. With
forced authentication the endpoint executes six queries at 1/20/50 application
and job rows. This bounds statement count and materialized response data, not SQL
execution time: aggregation still reads matching rows, and no throughput claim is
made. Counts and recent rows are separate read-committed snapshots, so concurrent
writes can cause minor differences. Day boundaries use aware local midnights,
including DST. The browser sends its actual IANA zone and renders returned dates
as local calendar labels rather than parsing date-only strings as UTC.

The dashboard requests one published-job row and uses the collection's count for
Active Jobs. The application summary runs through the existing membership execute
capability; known 403 retires controls and revalidates membership. MEMBER continues
to see its existing public job count without requesting applicant data. Replaced
company/session/view completions cannot display old summary data. Error states
offer Retry activity instead of displaying partial totals.

Seven real-PostgreSQL regressions cover zeros, all statuses, company scoping,
minimal fields, bounded recent rows, deterministic ties, DST/calendar edges,
invalid zones, OWNER/ADMIN and denial/revocation matrices and query growth.
Frontend service/component/page tests cover server-wide totals, local date labels,
no MEMBER summary, replacement, unmount, errors and known-denial revalidation.
Chromium verifies real totals and recent applicants after REVIEWING without any
per-job applicant-list request during dashboard load. Existing complete role,
mobile/keyboard, cross-tab, deadline and concurrent peer-isolation suites remain.

Exact staged-export acceptance must pass frontend tests/lint/build, Ruff,
changed-Python formatting, OpenAPI (40 paths / 56 operations), runner safety,
standalone plus concurrent owned PostgreSQL 17/Chromium and peer rejection before
commit. Final results/tree/commit identities are recorded externally. M-06 legacy
retirement and deployment/operational release gates remain separate.
