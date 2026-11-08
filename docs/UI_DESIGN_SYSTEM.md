# UI design system

## Direction
A clear, trustworthy, developer-focused marketplace. Prioritize scanability, readable job information and predictable interaction patterns over decorative complexity.

## Proposed component foundation
Ant Design is the proposed component library. Wrap and theme it through project-owned tokens so product styling is not scattered across screens. This is a proposed decision pending owner confirmation.

## Token categories
Define tokens centrally for:
- Brand, neutral, success, warning, error and info colors.
- Typography family, sizes, weights and line heights.
- Spacing scale.
- Border radii and border colors.
- Elevation/shadows.
- Breakpoints and content widths.
- Focus ring and interaction states.

Do not hard-code one-off colors, spacing or radii in feature components when a token exists.

## Atomic composition
- Atoms: Button, Text, Input, Badge, Avatar, Icon wrapper.
- Molecules: FormField, SearchInput, FilterSelect, SalaryRange, SkillTagGroup.
- Organisms: Header, JobCard, JobFilters, JobResults, CandidateSummary, ApplicantTable.
- Templates: PublicLayout, AuthLayout, CandidateDashboardLayout, RecruiterDashboardLayout.
- Pages: JobSearchPage, JobDetailPage, CandidateProfilePage, RecruiterJobsPage.

## UX rules
- Keep primary actions visually obvious and consistent.
- Use the same form label, validation, help and error patterns everywhere.
- Provide loading, empty, error and success states for every data-driven screen.
- Preserve filter state when navigating where practical.
- Confirm destructive actions.
- Support keyboard navigation, visible focus and accessible names.
- Design mobile behavior intentionally; do not merely shrink desktop tables.
- Use consistent date, salary and location formatting.

## Component acceptance checklist
- Reusable only when there is a real second use case or clear design-system role.
- Props have sensible defaults and documented variants.
- No duplicated business logic.
- Accessible labels and keyboard behavior.
- Responsive behavior verified.
- Unit or interaction tests for non-trivial behavior.

## Implemented role workspaces (2026-11-07)

React, Ant Design and JavaScript remain the component foundation. Shared Ant
Design tokens live in `frontend/src/styles/theme.js`; CSS spacing/surface tokens
remain in `tokens.css`, with role accents and responsive layout in `global.css`.
Candidate indigo, recruiter teal and administrator purple accompany explicit role
labels, icons and active navigation indicators. Role identity never depends on
color alone. No dependencies or external fonts were added.

`PublicLayout` composes the header and role navigation around existing lazy routes.
Desktop sidebars become wrapping navigation on mobile, keeping every destination
keyboard accessible. The layout includes a skip link, focus outlines, long-text
wrapping and reduced-motion overrides. Tables retain internal horizontal scrolling.
`WorkspaceUI` supplies PageHeader, StatCard and StatusLabel primitives.

Candidate `/candidate` now presents actual profile completion, private resume
status and recent applications. Completion uses name, headline, country, city,
about and years of experience (zero is valid). Application totals use the API
count; status summaries explicitly identify the current page when more exist.
Skills have a separate navigation destination; the existing combined profile editor
remains available. Job search has clear-filter recovery and shared card styling.

Recruiters have company and applicant entry directories backed by active
memberships. Applicant review proceeds through company → job → applicants, keeping
existing company and object permissions authoritative. Company job search uses
the existing server search parameter, alongside status filtering and pagination.
Job forms group responsibilities, work arrangement and compensation. Existing
preview and publish/close confirmations are retained.

Admin navigation links directly to resource sections through `/admin?section=...`.
Overview statistics come from the existing API. Moderation labels use shared status
presentation, decisions show success feedback, and audit timestamps use the user's
local timezone. The audit section contains history, without moderation buttons.
`/admin/login` provides a separate sign-in presentation with no registration.

Authentication uses role-specific registration copy and a split introduction/form
layout that stacks on mobile. JWT storage, refresh and logout remain unchanged.
Login return paths are checked against the authenticated role before navigation.
No APIs, database schema, ownership policies or backend files changed.

## Candidate indigo and navy refinement — 2026-11-08

Candidate navigation uses navy #172554, indigo #4F46E5 (hover #4338CA), soft
indigo #EEF2FF, canvas #F8FAFC, ink #0F172A and border #E2E8F0. Ant Design
semantic success/warning/error/info tokens are configured in `theme.js`.
System sans-serif uses Inter when already installed; no font download is required.
Desktop uses one sidebar; below 761px a labeled button opens an Ant Design drawer.
Job filters similarly move into a drawer. The header exposes a user menu with
profile and logout actions. Existing role-specific recruiter/admin colors remain.

Candidate completion now uses nine equally weighted checks: nonblank name,
headline, country, city, summary, supplied years of experience (zero counts),
at least one skill, at least one professional link, and an existing resume.
Percent is round(completed / 9 * 100). Missing items link to profile, skills or
resume editing. This replaces the previous six-field formula above. Overview
shows actual profile, initials, skills, links, resume filename, published jobs and
recent applications. API totals are authoritative; no baseline counts are assumed.
Profile cancel restores the last loaded/saved values after confirmation.
Applications support server pagination; job-detail and resume failures have retry.

## Approved candidate references — 2026-11-08

This supersedes the candidate navy-sidebar/overview direction above. The supplied
Opportunity Dashboard image determines desktop structure; Mobile App Dashboard
determines mobile ordering; Candidate Dashboard Modes determines theme consistency.
`CandidateLayout` isolates candidate tokens and Ant Design light/dark algorithms
from recruiter/admin layouts. `candidate.css` supplies full-width workspace,
240px fixed desktop sidebar, 80px header, published-job rows and compact right
column. Below 761px the sidebar is replaced by safe-area-aware bottom navigation;
profile, resume and recent applications follow jobs. Tablet panels reflow without
horizontal page scrolling. Candidate login/registration share these theme tokens.
Light is default; `devjobs.candidate.theme` stores explicit light/dark preference.

Dashboard has no metrics or separate profile overview. The existing nine-check
completion formula is unchanged; five visible groups summarize actual supported
fields. Jobs use the published-jobs endpoint with its existing ordering, API salary,
experience level and fallback company initials. Unsupported bookmarks, Saved Jobs,
Settings, notifications and Career Growth are omitted; no fabricated counts,
recommendations, logos, experience-year ranges or resume/application data.
Resume download reuses the authenticated private-resume utility; upload/replacement
remain on the existing resume page. All styling is scoped to the candidate shell.
Candidate Ant Design motion and click waves are disabled to keep account dropdowns
usable with the existing global reduced-motion rule; scoped CSS hover/focus
transitions remain restrained and honor reduced motion.
