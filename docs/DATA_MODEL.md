# Data model baseline

This is a conceptual model. Exact fields, constraints and migrations must be reviewed before implementation.

## Entities
- User: email, password hash, role, active state, timestamps.
- CandidateProfile: user, display name, headline, bio, country code, city, experience range.
- RecruiterProfile: user, name, designation.
- Company: name, website, description, logo reference, verification state.
- CompanyMembership: company, recruiter, membership role and status.
- Skill: normalized name and slug.
- CandidateSkill: candidate, skill, optional proficiency/years.
- Resume: candidate, private storage reference, original filename, content type, size, uploaded timestamp, default flag.
- Job: company, creator, title, description, employment type, work mode, location, salary range/currency, experience range, status, publication and expiry timestamps.
- JobSkill: job and skill.
- Application: job, candidate, selected resume snapshot/reference, cover letter, current status and timestamps.
- ApplicationStatusHistory: application, previous status, new status, actor, timestamp and optional note.
- SavedJob: candidate and job.

## Integrity and access rules
- Unique email, normalized consistently.
- Unique company membership per company/user.
- Unique candidate application per job.
- Unique candidate-skill and job-skill pairs.
- Salary minimum must not exceed salary maximum.
- Experience minimum must not exceed experience maximum.
- Only published, non-expired jobs appear in public discovery.
- Candidate can read/update only their own profile, resumes and applications.
- Recruiter can manage jobs and applicants only for companies where they have the required membership role.
- Status changes create immutable history records.

## Database conventions
- Prefer UUID primary keys for public-facing domain entities.
- Use explicit `created_at` and `updated_at` timestamps.
- Use ISO country and currency codes.
- Store timestamps as timezone-aware UTC values.
- Add indexes to support actual filters and ordering; verify with query plans.
- Avoid storing derived values unless there is a measured reason.

## Resume handling
A resume selected at application time should remain associated with that application even if the candidate later uploads a new default resume. Define whether this is implemented as an immutable resume version or a file snapshot before coding the application flow.
