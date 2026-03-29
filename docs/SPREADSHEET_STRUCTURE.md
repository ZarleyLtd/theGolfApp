# Spreadsheet Structure Reference

This document describes the live spreadsheet schema used by the app today.
It reflects the current backend model in `backend/code.gs` (ID-based scores with joins to players/outings).

---

## Key Model (PK/FK)

Google Sheets does not enforce database constraints, but the app uses these logical keys:

- `Societies`: PK = `SocietyID`
- `Players`: logical PK = (`SocietyID`, `PlayerId`)
- `Outings`: logical PK = (`SocietyID`, `OutingId`)
- `Scores`: logical PK = (`SocietyID`, `OutingId`, `PlayerId`)
- `Teams`: logical PK = (`SocietyID`, `OutingId`, `TeamId`)

Foreign-key intent:

- `Players.SocietyID` -> `Societies.SocietyID`
- `Outings.SocietyID` -> `Societies.SocietyID`
- `Scores.SocietyID` -> `Societies.SocietyID`
- `Scores.OutingId` -> `Outings.OutingId` (within same `SocietyID`)
- `Scores.PlayerId` -> `Players.PlayerId` (within same `SocietyID`)
- `Teams.(SocietyID, OutingId)` -> `Outings.(SocietyID, OutingId)`
- Each `PlayerId` listed in `Teams.TeamMembers` (comma-separated) -> `Players.PlayerId` (within same `SocietyID`)

Assumptions confirmed for docs:

- `PlayerId` and `OutingId` are documented as society-scoped identifiers.
- `TeamId` is documented as outing-scoped.

---

## Societies

**Sheet name:** `Societies`  
**Purpose:** Master registry of societies.

| Column | Description |
|---|---|
| `SocietyID` | Society slug used in URLs and cross-sheet joins. |
| `SocietyName` | Display name. |
| `ContactPerson` | Primary contact. |
| `NumberOfPlayers` | Optional metric. |
| `NumberOfOutings` | Optional metric. |
| `Status` | Common values include `Active`, `Inactive`, plus scoring modes like `OAP`/`O10`. |
| `CreatedDate` | Created date. |
| `CaptainsNotes` | Rich text/notes shown on home page. |

---

## Players

**Sheet name:** `Players`  
**Purpose:** Players per society.

| Column | Description |
|---|---|
| `SocietyID` | Tenant key. |
| `PlayerId` | Society-scoped stable player ID (for scores/teams joins). |
| `PlayerName` | Display name. |
| `Handicap` | Player handicap. |

---

## Courses

**Sheet name:** `Courses`  
**Purpose:** Global course catalog (not society-scoped in current backend).

| Column | Description |
|---|---|
| `CourseName` | Course key/display name. |
| `ParIndx` | Par/index string used by score views. |
| `CourseURL` | Course/club URL. |
| `CourseMaploc` | Map URL/location string. |
| `ClubName` | Club display name. |
| `CourseImage` | Optional image filename/path reference. |

---

## Outings

**Sheet name:** `Outings`  
**Purpose:** Scheduled outings per society.

| Column | Description |
|---|---|
| `SocietyID` | Tenant key. |
| `OutingId` | Society-scoped outing ID used by scores/teams. |
| `Date` | Outing date (normalized to `YYYY-MM-DD` by app readers). |
| `Time` | Outing time. |
| `CourseName` | Link-by-name into `Courses` catalog. |
| `Comps` | Competition config tokens (legacy `Notes` may appear in old sheets). |

---

## Scores

**Sheet name:** `Scores`  
**Purpose:** Scorecard rows keyed by outing/player IDs.

| Column | Description |
|---|---|
| `SocietyID` | Tenant key. |
| `OutingId` | FK to outing context (within society). |
| `PlayerId` | FK to player context (within society). |
| `Handicap` | Handicap at time of score entry. |
| `Hole1` ... `Hole18` | Strokes per hole. |
| `Points1` ... `Points18` | Points per hole. |
| `Total Score` | Total strokes. |
| `Total Points` | Total points. |
| `Out Score` / `Out Points` | Front nine totals. |
| `In Score` / `In Points` | Back nine totals. |
| `Back 6 Score` / `Back 6 Points` | Back six totals. |
| `Back 3 Score` / `Back 3 Points` | Back three totals. |
| `Timestamp` | Save/update timestamp. |

Important: `Scores` does not store canonical `PlayerName`, `CourseName`, or `Date` in the live backend model.
Those are resolved at read time by joining `PlayerId` -> `Players` and `OutingId` -> `Outings`.

---

## Teams

**Sheet name:** `Teams`  
**Purpose:** Team definitions per outing.

| Column | Description |
|---|---|
| `SocietyID` | Tenant key. |
| `OutingId` | Outing key. |
| `TeamId` | Outing-scoped team ID. |
| `TeamName` | Team display name. |
| `TeamMembers` | Comma-separated `PlayerId` list for the team (no separate membership sheet). |

---

## Terminology

- **Spreadsheet** = one Google Sheets file.
- **Sheet** = one tab in that file.
- **SocietyID** = tenant partition key used across domain tables.
