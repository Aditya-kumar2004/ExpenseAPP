# SCOPE.md — CSV Anomaly Detection Policy

SPlit's CSV import pipeline detects **13 anomaly types**. Every anomaly is stored in the `ImportAnomaly` table and surfaced in the UI for user resolution.

---

## Anomaly Types & Policies

| # | Anomaly Type | Detection Logic | User Actions |
|---|-------------|-----------------|--------------|
| 1 | `DUPLICATE_ROW` | Exact match on (date + description + amount + paidBy). All copies after the first are flagged. | APPROVE (import this copy), REJECT (skip this row) |
| 2 | `DUPLICATE_AMOUNT_MISMATCH` | Same date + description, but different amount. Two people may have logged the same expense differently. | APPROVE one, REJECT the other |
| 3 | `NEGATIVE_AMOUNT` | `amount < 0`. Could be a refund or a data entry error. | APPROVE (treat as refund/negative expense), REJECT (discard) |
| 4 | `ZERO_AMOUNT` | `amount == 0`. Almost certainly a data entry error. | REJECT recommended; APPROVE only if intentional |
| 5 | `MISSING_REQUIRED_FIELD` | Any of: `date`, `description`, `amount`, `paidBy` is blank. | Fix data externally and re-upload, or REJECT |
| 6 | `INVALID_DATE` | Date string cannot be parsed by any supported format (YYYY-MM-DD, DD/MM/YYYY, etc.) | Fix date format, or REJECT |
| 7 | `FUTURE_DATE` | Date is more than 7 days in the future from upload time. | APPROVE if intentional (pre-planned expense), REJECT if error |
| 8 | `UNKNOWN_MEMBER` | `paidBy` or a split participant name/email not found in the group's membership records. | Add the person to the group and re-upload, or REJECT |
| 9 | `MEMBER_NOT_ACTIVE` | Expense date falls outside member's active window: `date < joinedAt` OR `date > leftAt`. Catches: Meera's expenses after March end, Sam's before mid-April, Dev's outside his trip window. | APPROVE (confirm intentional), REJECT |
| 10 | `CURRENCY_MISMATCH` | Amount has `$` prefix, or `currency` column = "USD". Cannot treat 1 USD = 1 INR. | APPROVE (convert using exchange rate at time of import), REJECT |
| 11 | `SETTLEMENT_AS_EXPENSE` | Description matches `/settle|settled|settlement|transfer|paid back|reimburse/i`. This is likely a payment, not a shared expense. | REJECT and use the Settlements feature instead; APPROVE only if genuinely a shared expense |
| 12 | `SPLIT_SUM_MISMATCH` | Explicit split amounts provided in CSV don't sum to the total (tolerance: ±₹0.01). | Fix splits, APPROVE with corrected data, or REJECT |
| 13 | `INVALID_SPLIT_TYPE` | `splitType` column value not in `[EQUAL, EXACT, PERCENTAGE, SHARES]`. | Correct the value and re-upload, or REJECT |

---

## Membership Window Rules

The `MEMBER_NOT_ACTIVE` check enforces:

```
expense.date >= membership.joinedAt
AND (membership.leftAt IS NULL OR expense.date <= membership.leftAt)
```

### Known Members in Sample CSV

| Member | Joined | Left | Window |
|--------|--------|------|--------|
| Rahul  | Jan 1, 2024 | — | Always active |
| Priya  | Jan 1, 2024 | — | Always active |
| Meera  | Jan 1, 2024 | March 31, 2024 | Expenses through March only |
| Sam    | April 15, 2024 | — | Expenses from April 15 onwards |
| Dev    | March 1, 2024 | April 10, 2024 | Trip window only |

---

## Sample CSV Anomaly Map

The file `server/sample-data/expenses-sample.csv` contains these exact problems:

| Row | Anomaly Type(s) |
|-----|----------------|
| 6 | `DUPLICATE_ROW` (same as row 5) |
| 9 | `DUPLICATE_AMOUNT_MISMATCH` (same dinner, ₹2200 vs ₹2000) |
| 11 | `CURRENCY_MISMATCH` (`$45.00`) |
| 13 | `SETTLEMENT_AS_EXPENSE` ("Settled with Ravi") |
| 15 | `NEGATIVE_AMOUNT` (`-500`) |
| 17 | `ZERO_AMOUNT` (`0`) |
| 19 | `MISSING_REQUIRED_FIELD` (blank paidBy) |
| 21 | `INVALID_DATE` ("not-a-date") |
| 22 | `FUTURE_DATE` (December 2026) |
| 23 | `MEMBER_NOT_ACTIVE` (Meera, April expense) |
| 24 | `MEMBER_NOT_ACTIVE` (Sam, before mid-April) |
| 25 | `UNKNOWN_MEMBER` (Dev, if not in group) OR `MEMBER_NOT_ACTIVE` |
| 26 | `SPLIT_SUM_MISMATCH` (splits = ₹480, total = ₹500) |
| 27 | `INVALID_SPLIT_TYPE` ("RANDOM") |

Total: **14 anomaly instances** across 13 anomaly types ✓

---

## CSV Value Mapping Policy

To ensure that the CSV is successfully imported without manual editing, the application employs the following automated value-mapping rules:
- **Split Type Mapping**:
  - `unequal` maps to `EXACT`
  - `share` maps to `SHARES`
  - `percentage` maps to `PERCENTAGE`
  - `equal` (or empty) maps to `EQUAL`
- **Split Detail Parsing**:
  - Details formatted as semicolon-separated lists (e.g. `Rohan 700; Priya 800`) are parsed using regular expressions. Name-value pairs are matched, stripping any trailing `%` symbols or symbols like `$`.
  - JSON details (e.g. `[{"name":"Rohan","amount":700}]`) are parsed directly using standard JSON parsing.
  - Semicolon-separated names (e.g. `Aisha;Rohan;Priya;Meera`) are resolved against active group member names to construct split participants.

