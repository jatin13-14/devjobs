# Development workflow

## Feature lifecycle
1. Clarify user problem and acceptance criteria.
2. Review product requirements and existing architecture.
3. Record a decision in ADRs if a lasting technical choice is needed.
4. Define API contract and data changes.
5. Design UI states and component reuse.
6. Implement backend and frontend in a focused branch.
7. Add tests while implementing.
8. Run relevant checks and inspect the diff.
9. Update documentation and `PROJECT_STATUS.md`.
10. Open/review PR and merge only after checks pass.

## Daily task format
Every task should include:
- Goal and user value.
- Scope and explicit non-goals.
- Files/modules expected to change.
- API/database/UI impact.
- Ordered implementation steps.
- Acceptance criteria.
- Verification commands.
- Risks and rollback notes where relevant.

## AI-assisted development
- AI agents must read `AGENTS.md`, project status and relevant docs first.
- Give one bounded task at a time.
- Ask agents to inspect before editing.
- Require tests and exact command output summaries.
- Review diffs; generated code is not automatically trusted.
- Record new architectural decisions in ADRs.
- Keep `PROJECT_STATUS.md` truthful and based on verified work.
