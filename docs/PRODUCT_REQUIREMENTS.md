# Product requirements

## 1. Vision
Build a reliable global job marketplace that helps software developers discover relevant opportunities and helps employers recruit technical talent.

## 2. Personas
- Candidate: developer searching and applying for jobs.
- Recruiter: employer representative managing company jobs and applicants.
- Company: organization represented by one or more recruiter members.
- Admin: platform operator moderating users, companies and job listings.

## 3. MVP journeys
### Candidate
1. Register and sign in.
2. Create profile with location, headline, experience and skills.
3. Add a resume.
4. Search and filter published jobs.
5. View job details and apply.
6. Track application status.

### Recruiter
1. Register and complete recruiter profile.
2. Create or join a company profile.
3. Create, edit, publish and close jobs.
4. View applicants for authorized company jobs.
5. Update application status.

### Admin
1. Review and manage users.
2. Moderate companies and job listings.
3. View basic operational metrics.

## 4. Priorities
### P0 — MVP
- Authentication and role-aware onboarding.
- Candidate and recruiter profiles.
- Company profile and recruiter-company membership.
- Job create/edit/publish/close.
- Public job listing, detail and useful filters.
- Resume upload with private access.
- Apply once per job and track status.
- Recruiter applicant list and status updates.
- Admin moderation.

### P1 — after core MVP
- Saved jobs.
- Email notifications.
- Candidate visibility settings.
- Company verification.
- Job reporting and expiry.
- Recruiter analytics.

### P2 — later
- AI resume parsing and skill extraction.
- Job recommendations and match explanations.
- Resume improvement assistance.
- Recruiter subscriptions and featured listings.

## 5. Global product requirements
- Country represented using ISO 3166-1 alpha-2 codes.
- Salary represented as amount plus ISO 4217 currency code; do not assume one global currency.
- Store timestamps in UTC and render in the user's local timezone.
- Work modes: remote, hybrid, on-site.
- Support international phone numbers.
- Support country/city and timezone-aware display.
- English-first interface, responsive on mobile and desktop.

## 6. Non-functional requirements
- Server-side authorization on every protected operation.
- Server-side validation and safe error responses.
- Pagination for lists.
- Database indexes based on measured query patterns.
- Auditability for application status changes and moderation.
- Accessible forms, labels, focus states and keyboard navigation.
- No secrets in source control.
- Automated tests for critical workflows.

## 7. Explicit non-goals for MVP
- Microservices.
- AI matching or parsing.
- Complex recommendation engines.
- Paid subscriptions and payments.
- Real-time chat.
- Native mobile applications.

## 8. Product success signals
- Candidates can complete profile and apply without assistance.
- Recruiters can publish a job and manage applicants.
- Search filters return correct, paginated results.
- No cross-company or cross-candidate data leakage.
- Core workflows work on mobile and desktop.
