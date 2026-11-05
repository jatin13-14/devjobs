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
