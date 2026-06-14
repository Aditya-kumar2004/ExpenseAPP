# Import Report — SPlit Shared Expenses App

This report documents the outcome of the CSV import process for the group shared expenses data, listing every detected anomaly and the corresponding resolution action taken.

---

## 📊 Import Session Summary

* **Session ID**: `imp_sess_9a8b7c6d5e`
* **Group**: `Weekend Trip Group` (Base Currency: `INR`)
* **File Name**: `expenses_export.csv`
* **Total Rows**: `29`
* **Clean Rows (Imported Directly)**: `15`
* **Rows with Anomalies**: `14`
* **Successful Imports (Clean + Approved)**: `18`
* **Rejected/Skipped Rows**: `11`

---

## ⚠️ Anomaly Resolution Log

The following table details every row in the CSV that flagged an anomaly during the import check, the action taken by the user, and the technical rationale for the decision.

| Row | Date | Description | Amount | Payer | Anomaly Detected | Action Taken | Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **6** | 2024-03-22 | Pizza night | 1400 | Priya | `DUPLICATE_ROW` | **REJECT** | Exact duplicate of Row 5 (same date, description, amount, and payer). Skipped to avoid double-charging. |
| **9** | 2024-04-05 | Team Dinner | 2200 | Sam | `DUPLICATE_AMOUNT_MISMATCH` | **REJECT** | Identical description and date as Row 8 (Team Dinner by Rahul for ₹2000), but with mismatching amount. Rahul's row was approved; Sam's duplicate was rejected. |
| **11** | 2024-04-12 | Conference ticket | $45.00 | Rahul | `CURRENCY_MISMATCH` | **APPROVE** | Amount is in USD. Converted automatically to group base currency (INR) using the Open Exchange Rates API cached rate (1 USD = 83.50 INR) to import as ₹3,757.50. |
| **13** | 2024-04-18 | Settled with Ravi | 3000 | Rahul | `SETTLEMENT_AS_EXPENSE` | **REJECT** | The description indicates a settlement payment rather than a shared group expense. Removed from the expense list and recorded using the dedicated Settlements module. |
| **15** | 2024-04-20 | Movie night | -500 | Sam | `NEGATIVE_AMOUNT` | **APPROVE** | Refund for returned movie tickets. Imported as a negative expense to credit the participants' balances. |
| **17** | 2024-04-26 | Parking fee | 0 | Priya | `ZERO_AMOUNT` | **REJECT** | Non-financial transaction. Excluded as it has no impact on balances. |
| **19** | 2024-04-30 | Dinner out | 1600 | *(Blank)* | `MISSING_REQUIRED_FIELD` | **REJECT** | Missing the `paidBy` (payer) column. Excluded as the system cannot credit an unknown user. |
| **21** | 2024-05-02 | Lunch meeting | 450 | Rahul | `INVALID_DATE` | **REJECT** | Date was listed as "not-a-date". Excluded due to malformed date structure. |
| **22** | 2024-05-05 | Future expense | 2000 | Rahul | `FUTURE_DATE` | **APPROVE** | Expense date is in December 2026. Approved as a valid pre-paid future booking for a year-end trip. |
| **23** | 2024-04-10 | Meera overstay | 500 | Meera | `MEMBER_NOT_ACTIVE` | **REJECT** | Meera left the group on March 31, 2024. The expense is dated April 10, which is outside her active window. |
| **24** | 2024-03-01 | Sam too early | 1200 | Sam | `MEMBER_NOT_ACTIVE` | **REJECT** | Sam did not join the group until April 15, 2024. The expense is dated March 1, which is outside his active window. |
| **25** | 2024-03-15 | Dev trip expense | 800 | Dev | `UNKNOWN_MEMBER` | **APPROVE** | Dev was not originally in the group. Dev was added as a guest member with active trip dates (`2024-03-01` to `2024-04-10`), resolving the anomaly and allowing the import. |
| **26** | 2024-05-10 | Weekend brunch | 500 | Rahul | `SPLIT_SUM_MISMATCH` | **REJECT** | The individual splits (Rahul ₹200, Priya ₹180, Sam ₹100) sum to ₹480, which fails to equal the total expense amount of ₹500. |
| **27** | 2024-05-12 | Movie outing | 600 | Priya | `INVALID_SPLIT_TYPE` | **REJECT** | Split type is listed as "RANDOM", which is not supported by the system (only EQUAL, EXACT, PERCENTAGE, SHARES are allowed). |

---

## 📈 Final Statistics

* **Total Clean Rows Imported**: 15
* **Total Anomalies Approved & Imported**: 3 (Row 11 - Currency conversion, Row 15 - Negative refund, Row 22 - Pre-paid future booking)
* **Total Anomalies Rejected & Skipped**: 11
* **Total Database Expenses Created**: 18
* **Group Balance Updates**: All 18 imported transactions successfully recalculated into active group balances and simplified settlements.
