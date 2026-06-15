# Handicap Chain Integrity Report

**Society:** botanic  
**Last updated:** 2026-06-07 (bulk discount gap-aligned to first 2025 outing)  
**Source:** live database via `scripts/report-handicap-chain.mjs`

Re-run anytime:

```bash
node scripts/report-handicap-chain.mjs
```

Import / align 2025 bulk discounts:

```bash
node scripts/import-2025-bulk-discount.mjs --dry-run
node scripts/import-2025-bulk-discount.mjs
node scripts/fix-2025-bulk-discount-gap.mjs --dry-run
node scripts/fix-2025-bulk-discount-gap.mjs
```

## Scope

Three checks against all players and `handicap_adjustments` rows:

1. **Row math** — does `index_before + amount = index_after`?
2. **Chain continuity** — does each row’s `index_before` equal the previous row’s `index_after`?
3. **Latest index** — does the final chain `index_after` match `players.handicap_index`?

**Totals (current):** 53 players, **644** adjustment rows (+34 bulk discount), 42 players with adjustment history.

**Overall:** issues remain (see categories below).

---

## Change log: 2025 bulk discount import (2026-06-07)

At the start of the 2025 season, 34 players received a society-wide handicap reduction. These were loaded as historical adjustments:

- **season_year:** 2025  
- **outing_label / reason:** `Bulk discount 2025`  
- **effective_date:** 2025-01-01  
- **outing_id:** null (not linked to an outing)  
- **amount:** negative of the discount (e.g. discount 3 → amount −3)  
- **index_before:** last `index_after` from pre-2025 history  
- **index_after:** `index_before − discount`

Data file: [scripts/data/2025-bulk-discount.json](../scripts/data/2025-bulk-discount.json)

### Impact on year-boundary gaps

| Metric | Before bulk import | After bulk import | After gap alignment |
|--------|-------------------|-------------------|---------------------|
| Total chain gaps | 28 | 27 | **11** |
| Cross-season gaps | **26** | **5** | **5** |
| Bulk → first 2025 outing gaps | — | 16 | **0** |
| Within-season gaps (other) | 2 | 6 | **6** (John Barry manual only) |

**2024 → 2025 year-boundary gaps: eliminated.** Bulk discount rows now use the exact reduction from prior-season end to each player’s first 2025 outing `index_before` (where they have 2025 history).

**16 players** had listed admin discounts that did not match the spreadsheet year boundary; bulk rows were corrected:

| Player | Listed discount | Gap discount (applied) |
|--------|-----------------|------------------------|
| John Barry | 2.5 | **3** |
| Noel Brady | 2 | **2.5** |
| Charlie Butler | 4 | **4.5** |
| Tony Corcoran | 4 | **5** |
| Niall Cullen | 4 | **5** |
| John Donnelly | 2 | **0** (no reduction at boundary) |
| Kevin Duggan | 3.5 | **4** |
| Sean Duggan | 2 | **2.5** |
| Paul Flynn | 3 | **3.5** |
| Mick Gilligan | 1.5 | **0** (no reduction at boundary) |
| Stephen Hanna | 2 | **2.5** |
| David Kernan | 3 | **3.5** |
| Paudge Neary | 2.5 | **3** |
| John Power | 2.5 | **3** |
| Noel Smith | 2.5 | **3** |
| Bill Tonge | 2 | **2.5** |

**8 players** listed discount already matched the gap (unchanged): Jim Brennan, Declan Byrne, Michael Connolly, Dave Doyle, Michael Garrahan, Aidan Kelly, Shay Ryan, Sean Ward.

**10 players** with no 2025 outing history kept the listed discount (no boundary target to align to).

---

## 1. Row math errors (2)

Both are **John Barry** manual adjustments with incorrect stored values:

| Before | Amount | Stored after | Expected after |
|--------|--------|--------------|----------------|
| 29.8 | +0.3 | 30 | **30.1** |
| 30.25 | +0.5 | 30.8 | **30.75** |

These should be corrected in `handicap_adjustments` (or removed and re-entered).

---

## 2. Chain gaps (11 total)

See **Change log** above. Summary:

- **Cross-season:** 5 (pre-2025 boundaries and John Barry manual)
- **Bulk discount → first outing:** 0 (all aligned)
- **Other within-season:** 6 (John Barry manual rows only)

---

## 3. Latest index mismatch (30 players)

Final chain `index_after` ≠ `players.handicap_index`.

Several players who only received bulk discount (no 2025 outings) now end at bulk `index_after` but `handicap_index` was never updated:

| Player | Chain end (after bulk) | DB index | Δ |
|--------|------------------------|----------|---|
| Alan Neary | 15.5 | 14 | −1.5 |
| Andy Ryan | 12.5 | 10 | −2.5 |
| Colin Moore | 40 | **0** | −40 |
| Frank Lynott | 40.5 | 40 | −0.5 |
| Garry kelly | 30 | **0** | −30 |
| Key Byrne | 33.5 | 21 | −12.5 |
| Mark Fowler | 27.5 | 20 | −7.5 |
| Mark Mulholland | 22.5 | 16 | −6.5 |
| Paul Murphy | 40.5 | 40 | −0.5 |
| Tony Neary | 40 | 32 | −8 |

Players with 2025 outing history and small deltas (±0.5 or ±1) unchanged from prior report: Aidan Kelly, Declan Byrne, John Donnelly, Michael Garrahan, Niall Cullen, Noel Brady, Seán Duggan, Sean Ward, Shay Ryan, Stephen Hanna, etc.

**John Barry** chain end is now **31.25** (manual rows sort after 2025 history) vs DB index **28** — manual adjustment sequencing needs cleanup.

Stale DB index from pre-2025 last adjustment: Brian Maher, Colum Doyle, Cormac Murphy, Gerry Duffy, John Brady, Kevin Daly, Rory Cronin.

**Kevin Duggan:** chain ends 29.5 (2025 R4) vs DB **0**.

---

## 4. Players with index but no adjustment history (9)

| Player | handicap_index |
|--------|----------------|
| Adam Mahon | 19 |
| John Kelly | 24 |
| John McElroy | 30 |
| Lee Doyle | 20 |
| Lorcan Kelly | 22 |
| Lorcan Kennedy Kelly | 22 |
| Peter Glynn | 20 |
| Test Player | 18 |
| Trevor Cudden | 27 |

---

## Summary

| Check | Before bulk | After bulk | After gap align | Severity |
|-------|-------------|------------|-----------------|----------|
| Row math errors | 2 | 2 | 2 | **Fix** — John Barry manual rows |
| Cross-season chain breaks | 26 | 5 | 5 | Pre-2025 / manual only |
| Bulk → first outing gaps | — | 16 | **0** | Resolved |
| Other within-season breaks | 2 | 6 | 6 | John Barry manual rows |
| Latest index ≠ chain end | 29 | 30 | 30 | **Sync** `players.handicap_index` |
| Index with no history | 9 | 9 | 9 | Members never adjusted |

---

## Recommended follow-up

1. **Correct John Barry’s manual adjustment rows** (math + ordering vs 2025 history).
2. **Sync `players.handicap_index`** from final chain end — especially Colin Moore, Garry kelly, Kevin Duggan (0), and bulk-only players.
3. **Optional:** Load Paudge Neary 2022 history to close the 2021→2023 gap.

---

## Related

- Schema: [SCHEMA_HANDICAP.md](./SCHEMA_HANDICAP.md)
- Spreadsheet layout: [SPREADSHEET_STRUCTURE.md](./SPREADSHEET_STRUCTURE.md)
- Report script: [scripts/report-handicap-chain.mjs](../scripts/report-handicap-chain.mjs)
- Bulk import script: [scripts/import-2025-bulk-discount.mjs](../scripts/import-2025-bulk-discount.mjs)
- Gap alignment script: [scripts/fix-2025-bulk-discount-gap.mjs](../scripts/fix-2025-bulk-discount-gap.mjs)
