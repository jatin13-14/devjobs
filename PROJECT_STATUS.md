# Project status

**Status:** Foundation not yet applied to a connected source repository  
**Product version:** 0.1.0 (pre-release planning baseline)  
**Last updated:** 2026-11-05

## Confirmed decisions
- Global developer job marketplace.
- Initial audience: IT, AI and full-stack developers.
- Free initial product; monetization later.
- React + Vite + JavaScript frontend.
- Django REST Framework backend.
- PostgreSQL database.
- JWT authentication.
- Atomic UI composition and consistent design system.
- Modular monolith; no premature microservices.
- Git-based versioning, documented tests and release gates.

## Proposed decisions requiring owner confirmation
- Product name "DevJobs" is provisional.
- Ant Design is the proposed UI component foundation.
- UUID primary keys are proposed for externally exposed entities.
- Initial hosting and production storage provider are not finalized.

## Delivery phases
| Phase | Scope | Status |
|---|---|---|
| 0 | Repository, conventions, docs, CI baseline | Not started in source repo |
| 1 | Auth, roles and profiles | Not started |
| 2 | Companies and recruiter membership | Not started |
| 3 | Job creation and publishing | Not started |
| 4 | Job discovery and filters | Not started |
| 5 | Resume and applications | Not started |
| 6 | Recruiter applicant workflow | Not started |
| 7 | Admin moderation | Not started |
| 8 | Security, accessibility, regression and deployment | Not started |

## Definition of done
A task is complete only when:
- Acceptance criteria are met.
- Tests are added/updated and relevant checks pass.
- Authorization and validation are verified where relevant.
- UI is responsive and accessible where relevant.
- Documentation and this status file are updated.
- Changes are reviewed and committed on the correct branch.

## Current blockers
- Source repository has not yet been connected or identified.
- Product name and UI library need final confirmation before implementation.
