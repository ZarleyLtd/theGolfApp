# Visitor flag, encoding, and leaderboard behaviour

This document describes how **visitor** players are identified, how **include / exclude visitors** is encoded in `thegolfapp.societies.status` and `thegolfapp.outings.comps`, and how **leaderboard** (and related) clients must apply those rules. Use it when porting the same schema to another application.

---

## 1. Who is a visitor?

| Source | Field | Meaning |
|--------|--------|--------|
| `thegolfapp.players` | `visitor` (boolean, NOT NULL, default `false`) | `true` = guest / visitor; `false` = member. |

- Score rows (`thegolfapp.scores`) do **not** carry a visitor column. Clients load players (e.g. `getPlayers`) and resolve each score’s player via **`playerId`** (preferred) or **`playerName`** (fallback) to obtain `visitor === true`.

**Reference implementation:** `LeaderboardShared.buildIsVisitorFromPlayers(players)` in `assets/js/utils/leaderboard-shared.js` returns a function `(score) => boolean`.

---

## 2. Society `status` — Overall leaderboard only

Stored on **`thegolfapp.societies.status`**. Parsed as upper-case tokens split on commas and/or whitespace.

### 2.1 Mode tokens (Overall on/off)

| Token | `overallMode` (parser output) | Overall UI |
|-------|----------------------------------|------------|
| *(none)* | `''` | Overall off |
| `OAP` | `'OAP'` | On — aggregate points across outings |
| `O10` | `'O10'` | On — 1st–10th position points per outing |

### 2.2 Visitor policy for Overall (append `V`)

| Stored value | Visitors in **Overall** section |
|----------------|----------------------------------|
| `OAP` or `O10` only | **Excluded** (default when Overall is enabled) |
| `OAPV` or `O10V` | **Included** |
| `OAP` / `O10` plus a separate token `V` (e.g. comma- or space-separated) | **Included** (same as `OAPV` / `O10V`) |

- **`V`** is either appended **directly** to the mode token (`OAP` → `OAPV`) or supplied as its **own** token after `OAP` / `O10`.
- Parser returns:
  - **`overallMode`**: `'OAP'`, `'O10'`, or `''`.
  - **`excludeVisitorsOverall`**: boolean.
    - If **`overallMode`** is empty: **`excludeVisitorsOverall` is always `false`** (no Overall section — do not treat society as “excluding visitors globally”).
    - If **`overallMode`** is `OAP` or `O10`: `true` means exclude visitors from Overall calculations; `false` means include them (`OAPV` / `O10V`).

**Reference implementation:** `LeaderboardShared.parseSocietyOverallStatus(statusStr)` in `assets/js/utils/leaderboard-shared.js`.

---

## 3. Outing `comps` — per-competition visitors

Stored on **`thegolfapp.outings.comps`**: comma- and/or whitespace-separated tokens, compared **case-insensitively** in the reference parser (tokens are lower-cased before matching).

### 3.1 Default: visitors **excluded** from that comp

If a competition is present **without** an include marker, visitor-flagged players are **omitted** from that comp’s rankings only.

The reference parser initialises all of these to **`true`** (exclude visitors):

- `excludeVisitors18`, `excludeVisitorsF9`, `excludeVisitorsB9`, `excludeVisitorsP3`, `excludeVisitors2s`, `excludeVisitors66`

### 3.2 Include marker: suffix **`v`** (lowercase in stored string)

Append **`v`** to the **same token** that enables the comp (after any numeric part).

| Competition | Exclude visitors (default) | Include visitors |
|-------------|---------------------------|------------------|
| 18-hole top N | `18:<n>` | `18:<n>v` |
| Front 9 (no exclude list) | `f9` | `f9v` |
| Front 9 (exclude top N of 18) | `f9:<n>` | `f9:<n>v` |
| Back 9 | `b9` / `b9:<n>` | `b9v` / `b9:<n>v` |
| Par 3 strokes | `p3s` | `p3sv` |
| Par 3 points | `p3p` | `p3pv` |
| Two’s | `2s` | `2sv` |
| 66 | `66` | `66v` |

**Team** tokens (`th:`, `tt:`, `tw`, `td`, `team`, `team:`) do not define visitor include/exclude in the current admin UI. The parser strips a trailing **`v`** from `th:` / `tt:` numeric tails only so a hand-edited `th:3v` does not break team N parsing; there is no separate “visitors in team comp” flag in comps today.

**Reference implementation:** `LeaderboardShared.parseComps(compsStr)` in `assets/js/utils/leaderboard-shared.js`.

### 3.3 Resolving comps for a score block

**Reference:** `LeaderboardShared.getCompsForScores(outings, courseName, dateStr, scoreDates)` matches an outing by course + date, with fallback when multiple outings share a course.

---

## 4. Leaderboard logic (this repo)

File: **`leaderboard.html`** (inline script using `LeaderboardShared` as `LS`).

### 4.1 Data dependencies

1. **`AppConfig.currentSociety.status`** — society Overall mode + visitor policy (`parseSocietyOverallStatus`).
2. **`outings`** — each row’s **`comps`** string for per-outing comps (`getCompsForScores` + `parseComps`).
3. **`players`** — list with **`visitor`** boolean (`getPlayers`); passed into `buildIsVisitorFromPlayers` to classify each score row.

If players are not yet loaded, visitor classification may be wrong until a re-render (first paint may use an empty list).

### 4.2 Overall section

Compute:

```text
overallStatus = parseSocietyOverallStatus(...).overallMode   // '', 'OAP', or 'O10'
overallExcludeVisitors = (overallStatus is OAP or O10) AND parseSocietyOverallStatus(...).excludeVisitorsOverall
```

**Important:** `excludeVisitorsOverall` from the parser is **`false` when Overall is off** (`overallMode` empty). The UI must **AND** with “Overall is on” so visitor filtering is **not** applied when there is no Overall competition.

**Where filtering applies:**

- Building **`playerTotals`** (stableford totals by player across outings): skip scores when `overallExcludeVisitors && isVisitorScore(score)`.
- **`outingPositions`** (per-outing position for OAP detail): optionally filter raw scores when `overallExcludeVisitors`.
- **O10** path: per-outing ranking inputs filter visitors when `overallExcludeVisitors`.
- **`overallList` filter** before ranking: drop entries when `overallExcludeVisitors && isVisitorScore({ playerName })`.

When **`OAPV` / `O10V`** is stored, `excludeVisitorsOverall` is **`false`** → none of the above visitor skips run for Overall.

### 4.3 Per-outing sections (18, F9, B9, 66, Par 3, Two’s)

For each outing block:

1. `comps = LS.parseComps(compsStr)`.
2. For each sub-competition, if `comps.excludeVisitorsX` is **`true`**, remove visitor scores from the **input list** for that comp only (e.g. `outingScores18` filters `outingScores` for 18-hole top-N).

Examples:

- **`excludeVisitors18`**: filtered list passed to `rankWithCountback` for 18-hole positions.
- **F9 / B9**: candidates only added if not `(excludeVisitorsF9 && isVisitorScore)` (same pattern for B9).
- **66 / Par 3 / Two’s**: same idea — skip or filter when the corresponding `excludeVisitors*` flag is true.

Team stableford aggregation uses member names against `outingScores` without an extra visitor strip in the current file; team comps do not read a visitor flag from `comps`.

---

## 5. Society admin (encoding writers)

**Profile → Overall:** `getOverallStatus()` saves `OAP` / `O10` (exclude) or `OAPV` / `O10V` (include).

**Outings → comps:** `getCompsFromToggles()` emits tokens with or without **`v`** per tall comp button `data-visitor-comp` (`include` → suffix `v`, `exclude` → no suffix).

---

## 6. Semantic migration (for old data)

Older deployments may have used different defaults. The current encoding uses:

- Plain **`OAP` / `O10`** and plain **`18:n`** now mean **exclude** visitors unless **`V` / `v`** suffixes are present.

Re-save society **status** and outing **comps** from admin, or migrate strings in bulk, where the old behaviour must be preserved.

---

## 7. Checklist for another project (same schema)

1. Read **`players[].visitor`** and map scores → players by id/name.
2. Implement **`parseSocietyOverallStatus`** (or equivalent): `OAPV`/`O10V`, optional separate `V` token with `OAP`/`O10`, plain `OAP`/`O10`; return **`excludeVisitorsOverall === false` when `overallMode` is empty**.
3. Implement **`parseComps`** (or equivalent): default **`excludeVisitors* === true`**; `*v` / `18:nv` sets the relevant flag to **`false`**.
4. In leaderboard (or any aggregate):
   - Apply Overall visitor filter **only if** Overall mode is on **and** `excludeVisitorsOverall` is true.
   - Apply per-comp filters using each `excludeVisitors*` flag from `parseComps`.
5. Ensure **getSociety** (or your API) returns **`status`** and **getOutings** returns **`comps`** so clients stay in sync with admin.

---

## 8. Related files in this repository

| Area | Path |
|------|------|
| Parser + visitor classifier | `assets/js/utils/leaderboard-shared.js` (`parseSocietyOverallStatus`, `parseComps`, `buildIsVisitorFromPlayers`, `getCompsForScores`) |
| Leaderboard UI | `leaderboard.html` |
| All-results (passes `overallStatus`; per-player rendering uses comps elsewhere) | `all-results.html`, `assets/js/pages/all-results.js` |
| Admin writers | `admin/society-admin.html` (`getOverallStatus`, `setOverallFromStatus`, `getCompsFromToggles`, `setCompsToToggles`) |
| Player column DDL / API note | `docs/SCHEMA_PLAYERS_VISITOR.md` |
