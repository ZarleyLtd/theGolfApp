# Schema Relationships (Current Backend Model)

This document captures the current logical schema used by `backend/code.gs` and clarifies joins that drive leaderboard/scorecard reads.

## Scope and key decisions

- `PlayerId` and `OutingId` are treated as society-scoped identifiers.
- `TeamId` is treated as outing-scoped.
- Google Sheets does not enforce constraints; these are application-level rules.

## Entity key map

| Sheet | Logical primary key |
|---|---|
| `Societies` | `SocietyID` |
| `Players` | (`SocietyID`, `PlayerId`) |
| `Outings` | (`SocietyID`, `OutingId`) |
| `Scores` | (`SocietyID`, `OutingId`, `PlayerId`) |
| `Teams` | (`SocietyID`, `OutingId`, `TeamId`) |
| `TeamMembers` | (`SocietyID`, `OutingId`, `TeamId`, `PlayerId`) |
| `Courses` | Natural key by `CourseName` (global catalog) |

## Foreign-key intent

- `Players.SocietyID` -> `Societies.SocietyID`
- `Outings.SocietyID` -> `Societies.SocietyID`
- `Scores.SocietyID` -> `Societies.SocietyID`
- `Scores.OutingId` -> `Outings.OutingId` (within same `SocietyID`)
- `Scores.PlayerId` -> `Players.PlayerId` (within same `SocietyID`)
- `Teams.(SocietyID, OutingId)` -> `Outings.(SocietyID, OutingId)`
- `TeamMembers.(SocietyID, OutingId, TeamId)` -> `Teams.(SocietyID, OutingId, TeamId)`
- `TeamMembers.PlayerId` -> `Players.PlayerId` (within same `SocietyID`)

## Canonical score read/write model

- `saveScore` upserts by (`SocietyID`, `OutingId`, `PlayerId`) and stores scoring fields plus `Timestamp`.
- `loadScores` reads `Scores` rows, then enriches with:
  - `playerName` from `Players` via `PlayerId`
  - `course`/`date`/`time` from `Outings` via `OutingId`
- `checkExistingScore` also keys by (`SocietyID`, `OutingId`, `PlayerId`).

## Fast-read caveat

The current CSV fast reader for `loadScores` in `assets/js/utils/sheets-read.js` expects legacy denormalized score columns (`PlayerName`, `CourseName`, `Date`).  
The backend canonical model is ID-based (`OutingId`, `PlayerId`). If fast score read is used, it must join IDs via `Outings` and `Players` to match backend output.
