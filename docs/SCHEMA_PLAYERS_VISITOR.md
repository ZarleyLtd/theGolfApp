# Shared schema: `thegolfapp.players.visitor`

Use this note when aligning other apps (for example BGS) with the same Supabase database.

## DDL

```sql
alter table thegolfapp.players
  add column if not exists visitor boolean not null default false;

comment on column thegolfapp.players.visitor is 'True when the player is a visitor (e.g. guest); default false for regular members.';
```

Existing rows receive `visitor = false`. New rows default to `false` if the column is omitted on insert.

## Semantics

- `visitor = true`: player is treated as a visitor (guest / non-member) for society administration and any client that reads the flag.
- `visitor = false`: regular member (default).
- **Scores** still store per-round `handicap` on `thegolfapp.scores`; the visitor flag is not duplicated on score rows.

## API (theGolfApp `golfapp-api`)

- **GET** `getPlayers`, `getSocietyAdminData`, `getScorecardData`: each object in `players` includes `visitor` (boolean).
- **POST** `savePlayer` / `updatePlayer`: optional body field `visitor` (boolean). If omitted or not strictly `true`, the backend stores `false` (backwards compatible for older clients).

## Rollout order

1. Apply the migration to the database.
2. Deploy the Edge Function that reads/writes `visitor`.
3. Deploy frontend assets (e.g. society admin) that edit or display the flag.

## Competition exclusions (leaderboard / all-results)

For **full encoding rules, legacy tokens, parser outputs, and leaderboard implications**, see **[VISITOR_LEADERBOARD_ENCODING.md](./VISITOR_LEADERBOARD_ENCODING.md)**.

Society **status** (`thegolfapp.societies.status`) for Overall:

- **`OAP`** / **`O10`**: Overall is on; visitor-flagged players are **excluded** from the Overall section (default / legacy plain values).
- **`OAPV`** / **`O10V`**: Overall is on; visitor-flagged players are **included** in the Overall section (`V` appended to the mode code).
- Legacy **`OAP,XV`** / **`O10,XV`** is still read as visitors excluded (same meaning as plain `OAP` / `O10`).

Outing **comps** (`thegolfapp.outings.comps`): each competition token defaults to **excluding** visitors; append a lowercase **`v`** to that token to **include** visitors in that comp only. Examples: `18:5`, `F9`, `F9:2`, `p3s`, `2s`, `66` (exclude); `18:5v`, `F9v`, `F9:2v`, `p3sv`, `p3pv`, `2sv`, `66v` (include). Legacy tokens **`xv18`**, **`xvf9`**, **`xvb9`**, **`xvp3`**, **`xv2s`**, **`xv66`** are still understood and force exclude for that comp. Team competition tokens are unchanged (no visitor suffix in the UI today).

Clients resolve “visitor” using `getPlayers` and matching `playerId` / `playerName` on each score row.

## Spreadsheet mirror (optional)

If a deployment still syncs Google Sheets, add an optional **Players** column `Visitor` (TRUE/FALSE). Supabase remains the source of truth for hosted API usage.
