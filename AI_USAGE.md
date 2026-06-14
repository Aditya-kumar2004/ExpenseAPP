# AI_USAGE.md — AI Assistance Log

This document tracks how AI tools were used during the development of **SPlit**.

---

## Tools Used

| Tool | Version / Model | Purpose |
|------|----------------|---------|
| Antigravity | Advanced Agentic AI | Scaffolding the Express + React codebase, managing Prisma ORM, developing the 5-step CSV import wizard, implementing greedy debt simplification, and handling currency conversions. |
| Supabase SQL Editor | Built-in Editor | Running the generated SQL DDL statements for PostgreSQL because outbound port 5432 was blocked by the user's ISP. |

---

## Prompts Used

```
Prompt: "Create a schema for Splitwise-like app in Prisma, supporting EQUAL, EXACT, PERCENTAGE, SHARES, memberships with joinedAt/leftAt, settlements, and CSV anomaly tracking."
Context: Designing the relational model.
Output quality: Excellent. The schema was clean. We minorly adjusted directUrl to DATABASE_URL to avoid connection-blocking issues.
```

```
Prompt: "Write a greedy debt simplification algorithm in Javascript that matches creditors and debtors, rounding to 2 decimal places."
Context: Implementing the balance calculation logic.
Output quality: Perfect. It sorted members correctly and settled the highest debts first.
```

---

## Code Generated vs Hand-Written

| Component | % AI-generated | % Hand-written | Notes |
|-----------|---------------|----------------|-------|
| Prisma schema | 90% | 10% | AI generated, adjusted URLs manually. |
| Auth routes | 95% | 5% | Standard JWT routes. |
| Anomaly detector | 90% | 10% | Modified to map `unequal` and `share` to internal enums during execution. |
| Balance service | 100% | 0% | AI wrote the O(n log n) greedy matching algorithm. |
| Import wizard UI | 95% | 5% | Custom Tailwind styles added. |
| Balance/splits logic | 90% | 10% | Enhanced split-resolution to correctly parse CSV columns. |

---

## What AI Got Right

1. **Greedy Balance Calculation**: The balance calculation and transaction simplifier were bug-free from the start, returning clean debt maps for test groups.
2. **Multer & Papaparse Integration**: Parsing text-based CSV streams directly to rows and detecting duplicate rows or format mismatches.
3. **Glassmorphic UI Elements**: Tailwind layouts, interactive step wizards, and toast warnings worked perfectly with Vite React 18.

---

## What AI Got Wrong / Needed Fixing

1. **Prisma direct connection port 5432**:
   - *Error*: Prisma migrations and db push were failing because port 5432 was blocked by the ISP.
   - *Fix*: AI recognized the network blockage and generated a standalone `schema.sql` script so the user could run the DDL in the Supabase web dashboard instead.
2. **PgBouncer prepared statements error**:
   - *Error*: Prisma threw `prepared statement "s0" already exists` (error 26000) when executing queries on Supabase pooler port 6543.
   - *Fix*: AI appended `?pgbouncer=true` to the connection string to tell Prisma to use transaction-safe execution modes.
3. **Import route helper require error**:
   - *Error*: `require('./expenseHelpers')` failed due to missing module.
   - *Fix*: Removed the broken require and wrote clean inline split mapping directly.
4. **CSV split mapping mismatch**:
   - *Error*: The import execute code initially split CSV rows equally among all members active at that date, ignoring the CSV `split_with` and `split_detail` columns.
   - *Fix*: Updated the route to parse semicolon-separated strings (like `Rohan 700; Priya 800`) and map `unequal` to `EXACT` and `share` to `SHARES`.

---

## Time Saved Estimate

We estimate that using Antigravity saved **approx. 16 hours** of boilerplate code setup, CSS styling, and API integration, allowing the candidate to focus entirely on testing business rules, fixing database connection anomalies, and verifying edge-case CSV parsing policies.

---

## Reflections

Pair-programming with an agentic coder works best when the agent has access to run and debug commands directly. When direct connection limits (like port blocks) were hit, the developer and AI successfully pivoted to a web-based SQL console. It highlights the importance of having the human developer review network capabilities and verify that edge cases in the prompt requirements (like Meera's joined date and Sam's left date) are configurable in the finished UI.
