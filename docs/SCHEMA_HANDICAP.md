# Handicap tracking schema

Use this note when deploying handicap index, rules, adjustment history, and related API/frontend changes.

## DDL summary

Migration: `supabase/migrations/20260607120000_handicap_tracking.sql`

If `handicap_adjustments` was created with `numeric(4,1)`, also apply:
`supabase/migrations/20260607220000_handicap_adjustments_numeric_5_3.sql`

### `thegolfapp.players.handicap_index`

- Type: `numeric(5,3)`, NOT NULL, default `0`
- Backfilled from existing `handicap`
- **`handicap`** remains the **playing handicap** = `round(handicap_index)`
- Rule/manual adjustments update `handicap_index`; score rows still store integer playing handicap at entry time

### `thegolfapp.handicap_rules`

| Column | Notes |
|--------|-------|
| `society_id` | PK, FK → societies |
| `enabled` | Whether automatic post-outing adjustments are active |
| `config` | JSONB rule definition (see below) |
| `updated_at` | |

Botanic society is seeded with default bands on first migration.

### `thegolfapp.handicap_adjustments`

| Column | Notes |
|--------|-------|
| `society_id`, `adjustment_id` | Composite PK |
| `player_id` | FK → players |
| `effective_date` | Optional; outing date for automatic/manual when known |
| `season_year` | **Required for historical imports**; optional otherwise |
| `source` | `automatic` \| `manual` \| `historical` |
| `outing_id` | Optional FK when linked to a system outing |
| `outing_label` | e.g. `R1 - Elmgreen` for historical/standalone |
| `position` | Finishing position when relevant |
| `amount` | Adjustment applied to index (+/-); `numeric(5,3)` |
| `index_before`, `index_after` | Audit trail; `numeric(5,3)` |
| `reason` | Human-readable reason (required for manual) |

Unique partial index: one **automatic** adjustment per `(society_id, outing_id, player_id)`.

## Rule config JSON

```json
{
  "enabled": true,
  "outsideTop10": 1,
  "positionGroups": {
    "winner": [
      { "minIndex": 30, "maxIndex": null, "amount": -4 },
      { "minIndex": 18, "maxIndex": 30, "amount": -2 },
      { "minIndex": null, "maxIndex": 18, "amount": -1 }
    ],
    "runnerUp": [ "... same band shape ..." ],
    "thirdPlace": [ "... defaults all 0 for Botanic ..." ]
  }
}
```

Band match: `index > minIndex` (or any if null) **and** `index <= maxIndex` (or any if null).

Position mapping for automatic apply (18-hole Stableford):

| Position | Rule group |
|----------|------------|
| 1 | winner bands |
| 2 | runnerUp bands |
| 3 | thirdPlace bands |
| 4–10 | 0 |
| 11+ | `outsideTop10` |

### High score rules (additional, on top of position rules)

Configured under `highScoreRules` in the same JSON config:

| Rule | Condition | Default adjustment |
|------|-----------|-------------------|
| **4a** | Member scores ≥ `minPoints` (40) **and** ≥ `minLeadOverSecond` (5) Stableford points ahead of **2nd placed member**; only when ≥ `minCompetitors` (12) members have scores | -1 |
| **4b** | Member scores ≥ `minPoints` (40) | -0.5 |

Rule **4a takes precedence** over 4b (if 4a applies to a player, 4b is not applied). Rankings and competitor counts use **members only** (visitors excluded). High-score amounts are **added** to the position-based adjustment before capping at `maxIndex`.

Admin UI (Profile → Handicap Rules) exposes only the **adjustment amounts** for Rule 4a (“5 clear of the field”) and Rule 4b (“40+ scored”). Thresholds (`minPoints`, `minLeadOverSecond`, `minCompetitors`) are defined in `assets/js/utils/handicap-rules.js` (`defaultHighScoreRules`).

```json
"highScoreRules": {
  "rule4a": {
    "enabled": true,
    "minPoints": 40,
    "minLeadOverSecond": 5,
    "minCompetitors": 12,
    "amount": -1
  },
  "rule4b": {
    "enabled": true,
    "minPoints": 40,
    "amount": -0.5
  }
}
```

## API (`golfapp-api`)

**GET**

- `getHandicapRules` — society rules
- `getHandicapHistory` — optional `playerId`; returns `seasonYear` on each row

**POST**

- `saveHandicapRules` — `{ enabled, config }`
- `saveHandicapAdjustment` — manual: `{ playerId, amount, reason, effectiveDate? }`
- `applyOutingAdjustments` — `{ outingId, effectiveDate?, adjustments: [{ playerId, amount, position, reason }] }`
- `importHistoricalAdjustments` — `{ seasonYear, adjustments: [...] }`

**Extended responses**

- `getPlayers`, `getSocietyAdminData`: each player includes `handicapIndex`
- `savePlayer` / `updatePlayer`: accepts optional `handicapIndex`; stores playing handicap as `round(index)`

## Rollout order

1. Apply migration to the database.
2. Deploy the Edge Function.
3. Deploy frontend assets (society admin + handicap history page).
4. Import historical CSV via Profile → Handicap Rules (specify season year).

## Historical CSV import

Admin enters **season year** (e.g. `2020`) and uploads/pastes a grid with columns like `R1 - Elmgreen` (P, Adj, HC sub-columns). Each imported row is stored with `source = historical` and `season_year` set. Outings are linked by matching course name within that year when possible.
