# Kios Nusa POS — Project Architecture & Coding Standards

## 1. Database & Persistence Layer
- **Engine**: SQLite embedded file database (`file:kios_nusa.db`) via `@libsql/client` and `drizzle-orm/sqlite-core`.
- **Zero External DB Dependency**: Never introduce MySQL/Postgres server requirements. All queries, migrations, and seeds must run self-contained.
- **Timestamps**: Stored as integer milliseconds (`unixepoch() * 1000`) or ISO date strings (`YYYY-MM-DD`).

## 2. API & Frontend Architecture
- **API**: Full end-to-end type safety via tRPC v11 (`server/routers/`). All procedures must use `zod` input validation.
- **State & Real-time**:
  - React Query v5 for server state.
  - `BroadcastChannel("kiosnusa-customer-display")` for real-time dual screen synchronization (`/display`).
- **Touch Ergonomics**: All interactive buttons, quantity adjustments, and modal triggers must have `min-height: 44px` on mobile viewports.
- **Thermal Receipt Isolation**: All printable areas must use monospace typography, high-contrast black/white styling, and `no-print` classes for screen-only controls.

## 3. Verification Discipline
- Always ensure `npx tsc --noEmit` and `npx vitest run` pass with 0 errors before committing or pushing changes.
