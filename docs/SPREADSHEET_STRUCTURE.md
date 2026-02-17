# Spreadsheet Structure Reference

This document describes the **sheet** (tab) names and column headers in the master theGolfApp **spreadsheet**. Use **SocietyID** as the major key to separate data per society. Filters can be applied in Google Sheets for direct management.

---

## Societies

**Sheet name:** `Societies`

**Purpose:** Master registry of all societies.

| Column         | Description |
|----------------|-------------|
| SocietyID      | Unique slug (e.g. bushwhackers). Used in URLs and as key elsewhere. |
| SocietyName    | Display name (e.g. Bushwhackers @ the Botanic). |
| ContactPerson  | Primary contact for the society. |
| NumberOfPlayers| Number of players (optional). |
| NumberOfCourses| Number of courses (optional). |
| Status         | Active / Inactive. |
| CreatedDate    | Date the society was created. |
| NextOuting     | Next outing reference or identifier. |
| CaptainsNotes  | Multi-line notes from the captain (displayed as editor notes on the society home page). |

---

## Players

**Sheet name:** `Players`

**Purpose:** Players belonging to each society (keyed by SocietyID).

| Column    | Description |
|-----------|-------------|
| SocietyID | Links to Societies.SocietyID. |
| PlayerName| Player’s name. |
| PlayerHC  | Handicap. |

---

## Courses

**Sheet name:** `Courses`

**Purpose:** Courses and outing details per society (keyed by SocietyID).

| Column    | Description |
|-----------|-------------|
| SocietyID | Links to Societies.SocietyID. |
| CourseName| Name of the course. |
| ParIndx   | Par and/or stroke index data. |
| CourseURL | Link to course/club website. |
| CourseMaploc | Map link (e.g. Google Maps). |
| OutingDate| Date of the outing. |
| OutingTime| Time of the outing. |

---

## Scores

**Sheet name:** `Scores`

**Purpose:** Scorecard data per society (keyed by SocietyID).

| Column       | Description |
|--------------|-------------|
| SocietyID    | Links to Societies.SocietyID. |
| Player Name  | Player name. |
| Course       | Course played. |
| Date         | Date of round. |
| Handicap     | Handicap used. |
| Hole1 … Hole18 | Strokes per hole. |
| Points1 … Points18 | Points per hole. |
| Total Score  | Total strokes. |
| Total Points | Total points. |
| Out Score / Out Points | Out nine. |
| In Score / In Points | In nine. |
| Back 6 Score / Back 6 Points | Back six. |
| Back 3 Score / Back 3 Points | Back three. |

---

## Terminology

- **Spreadsheet** = the whole Google Sheets document (one file).
- **Sheet** = one tab within the spreadsheet (e.g. Societies, Players, Courses, Scores).
- **SocietyID** = the major key used to separate and filter data per society.

---

## Reference: BGS-style display of Captain's Notes

**CaptainsNotes** is a multi-line field for editor/captain's notes. When displaying on the frontend (e.g. society home page), you can:

- Preserve line breaks (e.g. render `\n` as `<br>`).
- Optionally support simple formatting: `**bold**` and `*italic*` (see `assets/js/components/editor-notes.js` for `formatText`).
- Use a styled block (e.g. `.editor-notes` in BGS) for newsletter-style presentation.
