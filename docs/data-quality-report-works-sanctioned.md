# Data Quality Report — `data/Works_Sanctioned.csv`

Generated 2026-09-07 by profiling the raw source export (79,226 rows incl. one
footer artifact, 22 columns). Script used: pandas profiling, not committed
(ad-hoc analysis) — see summary tables below for the checks run.

## Critical issues

1. **Phantom trailing footer row.** The last row (`Sno` and every business
   field blank) carries a single value in `Total_Amt`:
   `41,767,996,784.88` — a spreadsheet grand-total that leaked into the CSV
   export. It is not a real work record.
   - **Fix:** filter out rows where `WORK_RECOMMENDATION_DTL_ID` is null
     before ingestion.

2. **`Total_Amt` is not a usable column.** Once the footer row above is
   excluded, `Total_Amt` is null for all 79,225 remaining rows. It only ever
   held the footer's grand total.
   - **Fix:** drop `Total_Amt` from the ingestion schema; compute totals from
     `SANCTION_AMOUNT` instead.

3. **`FILE_STATUS` is a near-useless boolean.** It only ever takes the value
   `True` (25,147 rows / 31.7%) or blank (54,078 rows / 68.3%) — there is no
   `False`. Blank does not necessarily mean "not sanctioned"; it correlates
   exactly with `ATTACH_ID` being blank (same 54,078 rows), suggesting it
   really means "no attachment/file uploaded yet," not a status flag.
   - **Fix:** don't treat `FILE_STATUS` as a tri-state or reliable boolean;
     derive real progress from `WORK_STAGE` instead (see below).

## Formatting artifacts (need cleanup before ingestion)

| Field | Rows affected | Issue |
|---|---|---|
| `ACTIVITY_NAME` | 1,444 | embedded tab/newline characters |
| `LETTER_NO` | 2,117 | embedded tab/newline characters |
| `WORK_DESCRIPTION` | 5,039 | embedded tab/newline characters |
| `MP_NAME` | 5,121 | leading/trailing whitespace |
| `WORK_DESCRIPTION` | 15,560 | leading/trailing whitespace |

Example raw value: `"WS/\t MP620/2024-2025/133166-Construction of..."` — the
literal tab after `WS/` is a copy-paste artifact from the source system, seen
throughout `ACTIVITY_NAME` and `LETTER_NO`. Strip/normalize whitespace
(`str.strip()` + collapse internal tabs/newlines to single spaces) during
ingestion.

## Suspicious values

- **3 rows have `SANCTION_AMOUNT` under ₹1,000**, against a dataset median of
  ₹300,000: ₹980.87 (Sno 50240, Maharashtra), ₹3.50 (Sno 78536, J&K), ₹2.46
  (Sno 62196, J&K). These look like data-entry errors (missing digits/decimal
  slips) rather than genuine sanctions — worth flagging for manual review
  rather than silently ingesting.
- Otherwise `SANCTION_AMOUNT` looks sane: min ₹2.46 (above outliers aside),
  max ₹4.97 crore, mean ₹527,207, median ₹300,000, no negatives or zeros.
- No chronological inversions: 0 rows have `SANCTION_DATE` earlier than
  `RECOMMENDATION_DATE`.
- Date ranges are plausible: `RECOMMENDATION_DATE` 2024-07-08 to 2026-09-03,
  `SANCTION_DATE` 2024-07-09 to 2026-09-06 (consistent with a live extract
  taken today).

## Completeness (excluding the phantom footer row)

All fields are complete (0% missing) **except**:

| Field | Missing | % |
|---|---|---|
| `Total_Amt` | 79,225 / 79,225 | 100.00% |
| `FILE_STATUS` | 54,078 | 68.26% |
| `ATTACH_ID` | 54,078 | 68.26% (same rows as `FILE_STATUS`) |

## Duplicates & referential integrity — all clean

- 0 fully duplicated rows.
- 0 duplicate `WORK_RECOMMENDATION_DTL_ID` (safe as a primary key).
- 0 duplicate `Sno`.
- 0 `CONSTITUENCY_ID` values that map to more than one `CONSTITUENCY` name.
- 0 MPs mapped to more than one `CONSTITUENCY_ID` within the same `TENURE`.

## Categorical field summary

- `STATE_NAME`: 36 distinct values; top by volume — Uttar Pradesh (15,039),
  Gujarat (6,399), Madhya Pradesh (5,670), West Bengal (4,804), Bihar (4,550).
- `CONSTITUENCY`: 536 distinct values.
- `WORK_CATEGORY`: 4 values — `Normal/Others` (77,651), `Repair and
  Renovation` (1,102), `Trust and Society` (470), `Bar and Associations` (2).
- `WORK_STAGE`: 6 values — `Physical Inspection` (34,397), `Sanction`
  (20,275), `Vendor Identification` (11,329), `Work partially Completed`
  (8,233), `Work Completed` (4,171), `Time Estimation` (820). This is the
  reliable progress signal to use instead of `FILE_STATUS`.
- `TENURE` and `HOUSE_OF_PARLIAMENT` are constant (`18th Lok Sabha`, `2`) —
  no discriminating value in this export; safe to drop or hardcode.

## Recommendations for the ingestion pipeline

1. Drop any row with a null `WORK_RECOMMENDATION_DTL_ID` (removes the footer
   row).
2. Drop the `Total_Amt` column entirely.
3. Normalize whitespace (strip + collapse tabs/newlines) on `ACTIVITY_NAME`,
   `LETTER_NO`, `WORK_DESCRIPTION`, `MP_NAME` before storing or matching
   against other tables.
4. Use `WORK_STAGE`, not `FILE_STATUS`, as the progress signal; treat
   `FILE_STATUS`/`ATTACH_ID` as "has an attachment," not a sanction-status
   flag.
5. Flag (don't silently accept) `SANCTION_AMOUNT` values below some sane
   floor (e.g. ₹1,000) for manual review — the 3 rows above look like typos.
6. `TENURE`/`HOUSE_OF_PARLIAMENT` carry no signal in this export and can be
   dropped from the ingested schema.
