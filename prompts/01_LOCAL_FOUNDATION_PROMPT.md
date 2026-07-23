# Phase 1 — Local Foundation Prompt

Inspect the repository and complete the local development foundation.

Tasks:
1. Verify Next.js, TypeScript strict mode, Prisma, PostgreSQL, and Docker Compose.
2. Ensure `.env.example` documents every variable without secrets.
3. Create and validate Prisma migrations.
4. Add a deterministic seed for plans, a demo company, owner user, subscription, usage period, and pricing profile.
5. Replace fragile quote numbering based on count with a concurrency-safe strategy.
6. Add Vitest unit tests for:
   - metal density conversion;
   - price calculation;
   - median aggregation;
   - confidence aggregation.
7. Add integration tests for quote creation and tenant isolation.
8. Add scripts for test, typecheck, lint, build, database reset, and seed.
9. Update README with Windows/WSL, macOS, and Linux instructions.

Acceptance:
- `docker compose up -d` starts PostgreSQL.
- migration and seed complete from an empty database.
- tests, lint, typecheck, and build pass.
- no secret is committed.
