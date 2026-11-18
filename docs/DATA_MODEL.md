# Data model baseline

This document records the Stage 1 schema implemented in Django. Later-stage entities remain conceptual.

## Entities
- User: email, password hash, role (`candidate`, `recruiter`, or `admin`), active state, timestamps. Supported role values are enforced by a database check constraint.
- CandidateProfile: UUID, one-to-one user, full name, headline, about, ISO alpha-2 country, city, experience years, current designation, portfolio/GitHub/LinkedIn URLs, timestamps.
- RecruiterProfile: UUID, one-to-one user, name, designation, optional work email and phone, timestamps.
- Company: UUID, name, website, description, industry, size, headquarters country/city, private logo storage reference, timestamps.
- CompanyMembership: UUID, company, recruiter profile, OWNER/ADMIN/MEMBER role, INVITED/ACTIVE/SUSPENDED status, timestamps; one membership per recruiter/company pair and one or more ACTIVE OWNER memberships at commit.
- Skill: UUID and lowercase, trimmed, single-space internal whitespace canonical unique name.
- CandidateSkill: UUID and unique candidate/skill pair, with indexes supporting candidate lookup and reverse skill lookup.
- Resume: candidate, private storage reference, original filename, content type, size, uploaded timestamp, default flag.
- Job: company, creator, title, description, employment/workplace/experience types, location, ISO alpha-2 country, salary range and ISO 4217 currency, application deadline, draft/published/closed status, publication time and timestamps.
- JobSkill: unique job and existing canonical skill pair.
- Application: candidate profile, job, unique candidate/job pair, status (`SUBMITTED`, `REVIEWING`, `SHORTLISTED`, `REJECTED`, `WITHDRAWN`), optional cover letter, applied/updated timestamps and optional withdrawal timestamp.
- ApplicationStatusHistory: application, previous/new status, acting user and timestamp. Records initial submission and every status transition.
- SavedJob: candidate and job.

## Integrity and access rules
- Unique email, normalized consistently.
- Unique company membership per company/recruiter profile.
- Company creation through the domain service atomically creates its first ACTIVE OWNER membership. PostgreSQL deferred constraint triggers check company and membership insert/update/delete at commit, locking the company row before checking ownership to serialize concurrent direct writes. The trigger also covers cascades from recruiter/user deletion. The partial unique database constraint prevents multiple ACTIVE OWNER memberships; together they guarantee at least one active owner on PostgreSQL. SQLite development does not install this trigger.
- Ownership transfer, membership status changes, and removal are transactional and lock the company row before membership rows. Transfer requires an existing active member and demotes the former owner to ADMIN.
- Only active recruiter accounts with an ACTIVE OWNER or ADMIN membership may manage company settings or memberships. The sole ACTIVE OWNER cannot be suspended or removed; transfer ownership first.
- Unique candidate application per job.
- Unique candidate-skill and job-skill pairs.
- Salary minimum must not exceed salary maximum.
- Experience minimum must not exceed experience maximum.
- Only published, non-expired jobs appear in public discovery.
- Job creation/editing/publishing/closing requires active OWNER or ADMIN membership. Only OWNER/ADMIN members can see company drafts; other callers see only published jobs before their application deadline.
- Candidate can read/update only their own profile, resumes and applications.
- Recruiter can manage jobs and applicants only for companies where they have the required membership role.
- Application status changes are recorded with the previous status, new status, acting user, and timestamp.

## Database conventions
- Prefer UUID primary keys for public-facing domain entities.
- Use explicit `created_at` and `updated_at` timestamps.
- Use ISO country and currency codes.
- Store timestamps as timezone-aware UTC values.
- Add indexes to support actual filters and ordering; verify with query plans.
- Avoid storing derived values unless there is a measured reason.

PostgreSQL deferred triggers run on account inserts/role updates and candidate/recruiter profile writes. They lock the account row before checking compatibility, including direct and bulk writes, and fail closed for unknown role values. A database check constraint independently limits roles to the account model's supported choices. Model validation and `User.save()` also reject incompatible transitions and protect `update_fields`. SQLite has no equivalent cross-table enforcement.

Country fields allow blank values. Nonblank values use the ISO 3166-1 alpha-2 set from pinned `pycountry==24.6.1`, enforced in Python and by PostgreSQL check constraints. Migrations store a static country-code snapshot so the schema does not change when the package changes; deliberately update the package and checks together when changing that set.

Skill model and bulk create/update paths normalize names to lowercase and collapse all Python-recognized whitespace to one ordinary ASCII space, with no leading or trailing space. PostgreSQL rejects any stored name that is not already lowercase and uses exactly one internal ASCII space; the existing unique name constraint prevents duplicate canonical names. CandidateSkill pair uniqueness is database-enforced. Migrations preflight existing names and do not merge, rewrite, or delete skill records.

## PostgreSQL test setup

Automated tests load `config.settings.test` through `pytest.ini`. `DATABASE_URL` is required and must identify PostgreSQL database `devjobs_test` at `127.0.0.1:5433`; tests fail on SQLite, any other target identity, or PostgreSQL versions other than 17. The test runner prints only engine, host, port, original/test database names, and server version before creating the separate `test_devjobs_test` database. Keep local development settings separate from automated test settings.

Company logo is a storage reference field only. Resume storage is private and does not use a public `MEDIA_URL`; application submission does not require a resume.

## Resume handling
Resume upload now uses the private current-document association described below. Applications deliberately use the current resume; no immutable application-time snapshot is retained.

## CandidateResume (private current document)

`candidates.0011_candidateresume` adds one optional row per candidate (candidate one-to-one primary key, cascading deletion), unique server-generated `storage_key`, byte `size`, and `updated_at`. File bytes are outside PostgreSQL in private storage. No original filename or public URL is stored. Applications refer to the current candidate resume, not a snapshot. Applying remains possible without a resume. Resume mutation services lock the candidate row, including first upload, to serialize replacement/deletion. Database-only account/profile deletion may leave an unreferenced file; offline reconciliation removes it. No existing records are rewritten by the migration.

## Platform moderation

Additive fields: `Company.is_suspended` and `Job.is_hidden`, both false by default. Accounts reuse Django `User.is_active`. `ModerationEvent` stores UUID identity, protected administrator FK, target type/UUID, action, reason, previous/new boolean state and creation timestamp, indexed by target/time. Target UUIDs deliberately preserve audit identity independent of target lifecycle. PostgreSQL trigger rejects event updates/deletes; trusted database operators retain ultimate control. No audit registration in Django admin and no API mutation route for history. No historical job/application deletion or membership status rewrite occurs.

Migrations: `companies.0008_company_is_suspended`, `jobs.0002_job_is_hidden`, `moderation.0001_initial`, `moderation.0002_immutable_history`.
