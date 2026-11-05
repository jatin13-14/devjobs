# ADR 0001: Start with a modular monolith

- Status: Accepted
- Date: 2026-11-05

## Context
The MVP has related domains (accounts, companies, jobs and applications) and needs fast iteration by a small team.

## Decision
Use one Django application deployment with domain-oriented Django apps and clear service boundaries. Use a React/Vite frontend as a separate client application.

## Consequences
- Simpler local development and deployment.
- Easier transactions across related entities.
- Domain boundaries remain explicit.
- Independent service extraction can be considered later if justified by scale, team ownership or reliability needs.
