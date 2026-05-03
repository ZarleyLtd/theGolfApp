# theGolfApp API Compatibility Contract

This document freezes the backend contract expected by the current frontend so the Supabase migration can preserve behavior.

## Response envelope

- Every endpoint returns JSON with `success: boolean`.
- On success, action-specific fields are included (`societies`, `players`, `scores`, etc.).
- On error, return `success: false` and `error: string`.

## Required query/body conventions

- `societyId` is required for society-scoped actions.
- Master/global actions do not require `societyId`:
  - `getAllSocieties`
  - `createSociety`
  - `updateSociety`
  - `deleteSociety`
  - `getCourses`
  - `saveCourse`
  - `updateCourse`
  - `deleteCourse`
  - `lookupCourseWithAi`
- GET actions currently use `action` query param.
- POST actions currently send `{ action, societyId, data }` from `ApiClient.post()`.

## GET actions and expected payload shape

- `getAllSocieties` -> `{ success, societies: Society[] }`
- `getSociety` -> `{ success, society: Society }`
- `getPlayers` -> `{ success, players: Player[] }`
- `getOutings` -> `{ success, outings: Outing[] }`
- `getCourses` -> `{ success, courses: Course[] }`
- `getSocietyAdminData` -> `{ success, society, players, outings }`
- `getScorecardData` -> `{ success, outings, courses, players }`
- `getOutingTeams` -> `{ success, teams: Team[] }` or `{ success, teamsByOuting: Record<string, Team[]> }`
- `loadScores` -> `{ success, scores: Score[], meta? }`
- `checkExistingScore` -> `{ success, exists: boolean, score?: Score }`
- `backfillPlayerAndOutingIds` (maintenance) -> `{ success, ... }`

## POST actions and expected payload shape

- `createSociety`, `updateSociety`, `deleteSociety`
- `savePlayer`, `updatePlayer`, `deletePlayer` (`savePlayer` / `updatePlayer` accept optional `visitor` boolean; omit or non-`true` means `false`)
- `saveCourse`, `updateCourse`, `deleteCourse`
- `saveOuting`, `updateOuting`, `deleteOuting`
- `saveOutingTeam`
- `saveScore`, `deleteScore`, `checkExistingScore`, `loadScores`
- `analyzeScorecardImage`
- `lookupCourseWithAi`

Minimum return expectations used by UI:

- `saveScore` returns `{ success: true, timestamp }` (timestamp read by scorecard UI).
- `checkExistingScore` returns `exists` and optional `score` object.
- `saveOutingTeam` returns created/updated `teamId`.

## Canonical objects

- `Society`: `societyId`, `societyName`, `contactPerson`, `numberOfPlayers`, `numberOfOutings`, `status`, `createdDate`, `captainsNotes`
- `Player`: `playerId`, `playerName`, `handicap`, `visitor` (boolean; `true` = visitor/guest, default `false`)
- `Outing`: `outingId`, `date`, `time`, `courseName`, `comps` (see [VISITOR_LEADERBOARD_ENCODING.md](./VISITOR_LEADERBOARD_ENCODING.md) for `comps` and society `status` visitor encoding used by leaderboard clients)
- `Course`: `courseName`, `parIndx`, `courseURL`, `courseMaploc`, `clubName`, `courseImage`
- `Team`: `teamId`, `teamName`, `playerIds[]`, `playerNames[]`
- `Score`: `outingId`, `playerId`, `playerName`, `course`, `date`, `handicap`, `holes[18]`, `holePoints[18]`, totals, `timestamp`
