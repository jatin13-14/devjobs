# ADR 0002: Use React/Vite and Django REST Framework

- Status: Accepted
- Date: 2026-11-05

## Context
The product owner selected React with Vite and Django REST Framework, with PostgreSQL as the database.

## Decision
Use React + Vite + JavaScript for the client, Django REST Framework for APIs and PostgreSQL for persistence.

## Consequences
- Shared API contracts are important.
- Authentication and CORS/CSRF decisions must be documented before implementation.
- Frontend and backend have independent test/build pipelines.
