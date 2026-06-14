# DECISIONS.md — Technical Decision Log

## Database: Supabase (PostgreSQL) over MongoDB

**Decision**: Use Supabase (PostgreSQL) with Prisma ORM instead of MongoDB with Mongoose.

**Rationale**:
- **Relational data** — expenses, splits, memberships, settlements all have well-defined foreign key relationships that are a natural fit for SQL
- **Prisma type safety** — generated types provide compile-time safety across the codebase
- **Supabase free tier** — 500 MB, unlimited API calls, built-in auth UI (if needed later), realtime subscriptions
- **ACID transactions** — critical for expense + split creation (must be atomic)
- **`MEMBER_NOT_ACTIVE` query** — date range queries with `joinedAt`/`leftAt` are trivial in SQL but require manual validation in MongoDB
- **`Json` fields for anomaly `rowData`** — Prisma's `Json` type gives us MongoDB-style flexibility for the one field that genuinely benefits from schemaless storage

**Why not MongoDB**: The `Membership` model with date ranges, the `ExpenseSplit` join table, and the `ImportAnomaly` foreign keys all naturally express as relational tables. MongoDB would require complex application-level joins.

---

## ORM: Prisma over Raw SQL / Knex

- **Prisma schema** serves as single source of truth for DB schema + TypeScript types
- **`prisma migrate dev`** gives version-controlled, reproducible migrations
- **`prisma studio`** provides a GUI for debugging data during development
- Prisma's `$transaction()` API is clean for the expense + splits atomic write

---

## Auth: JWT In-Memory + httpOnly Cookie

**Decision**: Access token in React `useRef` (memory), refresh token in `httpOnly` cookie.

**Tradeoffs**:
- Access token in `localStorage` → vulnerable to XSS
- Access token in `httpOnly` cookie → vulnerable to CSRF (requires double-submit cookie or `SameSite=Strict`)
- **Access token in memory + httpOnly refresh cookie**: XSS cannot steal the access token; CSRF cannot trigger a new access token without the refresh endpoint. Best of both worlds.

**Rotation**: Each `/api/auth/refresh` call deletes the old refresh token and issues a new one (refresh token rotation prevents reuse after theft).

---

## CSV Parsing: papaparse

- Most battle-tested CSV parser in the JS ecosystem
- `header: true` auto-maps columns to keys
- `transformHeader` strips whitespace from column names
- `transform` strips whitespace from values
- Handles quoted fields, escaped commas, Windows line endings
- Runs in Node.js (backend) and browser (frontend preview) — same library both places

---

## Split Type Design

Four split types cover all common real-world scenarios:

| Type | Use case | Validation |
|------|----------|------------|
| `EQUAL` | Default — split evenly | At least 1 member selected |
| `EXACT` | Different fixed amounts | Sum of amounts = total (±₹0.01) |
| `PERCENTAGE` | Proportional by % | Sum of percentages = 100% (±0.01%) |
| `SHARES` | Unit-based (e.g., 2x room vs 1x room) | Total shares > 0 |

Rounding strategy: compute all shares, assign remainder to first member (avoids ₹0.01 drift accumulation).

---

## Balance Calculation: Greedy Debt Simplification

**Algorithm**: Sort creditors and debtors by amount (largest first), greedily match until zero.

**Complexity**: O(n log n) — fast enough for any realistic group size.

**Correctness**: Produces the minimum number of transactions needed to settle all debts (proven optimal for this greedy approach when balances sum to zero, which they always do).

**Precision**: All amounts rounded to 2 decimal places using `Math.round(x * 100) / 100`.

---

## Currency Conversion: Open Exchange Rates + DB Cache

- Free tier gives USD-based rates (all major currencies)
- Cross-rate computed as: `rate = rates[target] / rates[source]`
- Cached in `ExchangeRateCache` table with `fetchedAt` timestamp
- Cache TTL: 24 hours — balances freshness vs. API call limits
- **Original currency + rate + original amount stored separately** — full audit trail, can recompute historical conversions

---

## Soft Delete for Expenses

- `isDeleted: Boolean` flag — expenses are never hard-deleted
- Audit trail: imported expenses retain `originalRowIndex` linking back to the CSV import session
- Balance calculations filter `isDeleted: false`
- UI shows deleted expenses greyed out (optional toggle)

---

## Import Pipeline: Synchronous Detection

For typical group expense CSVs (< 1000 rows), anomaly detection runs synchronously in the upload request handler. No background job queue needed.

If scaling to large imports (> 10k rows), the detection could be moved to a Supabase Edge Function or BullMQ job queue.

---

## Import `allRows` Strategy

The server does not store raw CSV content in the database (avoids large blob storage). Instead:

1. Client parses CSV with papaparse on upload
2. Client caches `allRows` in a `useRef`
3. On execute, client sends `allRows` in the request body
4. Server uses `allRows` to reconstruct which rows to insert

Trade-off: client must keep the tab open between upload and execute. Acceptable for an MVP; a production system would store the CSV in Supabase Storage.
