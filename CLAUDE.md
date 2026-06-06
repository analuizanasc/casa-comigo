# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start server
npm start           # production
npm run dev         # development with hot reload (nodemon)

# Unit tests (Jest) — cover src/services/**/*.js
npm test
npm run test:coverage

# Run a single unit test file
npx jest tests/services/distribution.service.test.js

# Integration tests (Mocha + Supertest) — POST endpoints only
npm run test:api              # runs + generates HTML report at src/tests/api/reports/relatorio-api.html
npm run test:api:simples      # runs without report generation
```

## Environment

Copy `.env.example` to `.env` before first run:

```
PORT=3000
JWT_SECRET=<secret>
JWT_EXPIRES_IN=7d
DATABASE_PATH=./data/casa-comigo.db
```

Integration tests override `DATABASE_PATH` to `./data/casa-comigo-test.db` automatically via `src/tests/api/helpers/setup.js`, which must be the first require in any integration test suite.

## Architecture

Strict three-layer architecture: **routes → controllers → services**. No business logic in routes or controllers.

- **[src/app.js](src/app.js)** — Express setup, Swagger mount, all routes registered, migrations run at startup.
- **[src/models/migrations.js](src/models/migrations.js)** — Creates all tables with `CREATE TABLE IF NOT EXISTS` on every startup. Schema changes go here.
- **[src/config/database.js](src/config/database.js)** — Singleton `better-sqlite3` connection. WAL mode, foreign keys enabled. `DATABASE_PATH` env var selects the file.
- **[src/middleware/auth.middleware.js](src/middleware/auth.middleware.js)** — JWT verification; sets `req.user = { id, email, name }`.
- **[src/middleware/roles.middleware.js](src/middleware/roles.middleware.js)** — House-scoped access control; sets `req.member` and guards `admin` / `catalog_manager` roles. Must run after `authenticate`.

### Data model

```
users → house_members ← houses
task_catalog → task_dependencies (self-referencing)
member_preferences (user × task × house)
task_assignments (task × user × date)
```

All PKs are UUIDs (`uuid` package). Dates stored as `TEXT` in `YYYY-MM-DD` format; always parse as UTC to avoid timezone drift.

### Distribution algorithm (`src/services/distribution.service.js`)

The core business logic. Given a period and a house:
1. Expands every active task into `(task, date)` occurrences for the period.
2. Groups occurrences per day by room and dependency chains using union-find.
3. Topologically sorts tasks within each group (RN01).
4. Scores each member per group: preference score + load-balance score. Physical limitations hard-block assignment (RN03).
5. Assigns the best-scoring member to the whole group (tasks stay together).
6. Persists all assignments in a single SQLite transaction.
7. Returns a balance report comparing actual vs. target effort percentages within the configured tolerance (default ±10pp, RN02).

### Business rules reference

| ID | Rule | Implementation |
|----|------|----------------|
| RN01 | Dependent tasks assigned to same member in order | `distribution.service.js` — topological sort + `group_id` |
| RN02 | Effort distribution within ±10pp tolerance (configurable) | `distribution.service.js` scoring + `PATCH /houses/:id/tolerance` |
| RN03 | Physical limitations never assigned | `scoreMember()` returns `-Infinity` |
| RN04 | Redistribution picks member with lowest load | `schedule.service.js` |
| RN06 | Three roles: `admin`, `catalog_manager`, `resident` | `roles.middleware.js` |
| RN07 | Weight change warns if redistribution recommended | `members.service.js` returns `warning` field |

## Test structure

**Unit tests** (`tests/`) use Jest with full DB mocking via `tests/helpers/db-mock.js`. Each `db.prepare()` call must be mocked in the exact order the service invokes it.

**Integration tests** (`src/tests/api/`) use Mocha + Chai + Supertest against the real running app and a dedicated test DB. Tests follow the **VADER** heuristic per endpoint: Verb, Authorization, Data, Errors, Responsiveness. Fixtures in `src/tests/api/fixtures/` supply test data; helpers in `src/tests/api/helpers/` handle auth tokens and DB teardown between suites.
