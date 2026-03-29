# Data Sources Analysis

Full analysis of data sources used across the codebase, Google Sheets usage and permissions, hardcoded data, and risk of predecessor Google Sheet still being accessed.

---

## 1. Data source overview

| Source | Type | Used by | Permission / binding |
|--------|------|---------|----------------------|
| **Google Apps Script Web App** | REST API | All society-aware pages (API calls) | Execute as: Me; Who has access: Anyone. Sheet = bound to script. |
| **Google Sheet (CSV publish)** | Public CSV URLs by GID | Fast read path for many GET actions | Public “Publish to web” link; no auth. |
| **Default / fallback values** | Static JS | Default images, society name | N/A |

The app uses a hybrid read model:

- fast reads from published CSV (`SheetsRead`)
- backend reads from Apps Script Web App (`ApiClient.get` with `_useAppsScript: true`)
- writes always via Apps Script (`ApiClient.post`)

---

## 2. Google Sheets and how permission is given

### 2.1 Backend (Apps Script) – primary data

- **File:** `backend/code.gs`
- **Access:** `SpreadsheetApp.getActiveSpreadsheet()` only (no `openById` / `openByUrl`).
- **Implication:** The only sheet the backend uses is the one **bound** to the Apps Script project (the “theGolfApp” sheet from SETUP.md). There is no spreadsheet ID in the backend code.
- **Permission:**
  - Deploy as Web App: **Execute as: Me**, **Who has access: Anyone**.
  - First run: script runs as the deploying user; that user must authorize the script (including access to the bound spreadsheet).
  - After that, any user can call the Web App URL; they do not need to log in. Access to sheet data is via the script (as the owner), not as the end user.

So: **permission is given once by the sheet/script owner when they deploy and authorize; the sheet is identified only by being the active spreadsheet of the script project.**

### 2.2 Frontend CSV (published sheet)

- **Config:** `assets/js/config/sheets-config.js`
- **Mechanism:** Uses published CSV URLs built from:
  - `PUBLISHED_SHEET_BASE` (public published doc URL)
  - `SHEET_GIDS` map per tab (`Societies`, `Players`, `Courses`, `Outings`, `Scores`, `Teams`)
- **Permission:** Public CSV. No login; anyone with the link can read. No write. Permission is “given” by the sheet owner when they publish that sheet/tab to the web.

---

## 3. Where each data source is used

### 3.1 Apps Script API (bound spreadsheet)

- **Config:** `assets/js/config/app-config.js` → `apiUrl`  
  `https://script.google.com/macros/s/AKfycbyeWJPzuVI3vIRJMtDvHnA_N2YW9zSt_r99Up7GdEuk-L7TOaPWlZAlj8z0Kmmftq-ecA/exec`
- **Usage:** `assets/js/utils/api-client.js` uses `AppConfig.apiUrl` for all `ApiClient.get()` and `ApiClient.post()`.
- **Pages:** All society-based flows: index (with society), scorecard, scorecard-sidescroll, leaderboard, outings, admin (societies, society-admin). All read/write to the **bound** sheet via this single Web App.

So: **one Google Sheet (the bound one) is the source of truth for API data.**

### 3.1a Two read methods (hybrid model)

- **Config:** `assets/js/config/sheets-config.js` → `PUBLISHED_SHEET_BASE` and `SHEET_GIDS`. Read actions can be served either by published CSV or by the Apps Script Web App.
- **Fast read (default):** Published sheet CSV via `SheetsRead` (`assets/js/utils/sheets-read.js`). Used for initial loads and navigation so the UI stays responsive.
- **Slow read (after update):** GET request to the Apps Script Web App. Use when an update (save/delete) has just been done and the next screen or list must show fresh data; pass `_useAppsScript: true` to `ApiClient.get()`. The published sheet may lag, so the backend is the source of truth after writes.
- **Usage:** By default, all **read** operations use the published sheet. Callers that need a post-update refresh use `ApiClient.get({ ..., _useAppsScript: true })`. **Write** operations always go to the Apps Script Web App (`ApiClient.post`).

### 3.2 Published CSV read path

- **Config:** `assets/js/config/sheets-config.js` → `PUBLISHED_SHEET_BASE`, `SHEET_GIDS`.
- **Usage:** `assets/js/utils/sheets-read.js` serves read actions from CSV for most non-admin page loads.
- **Score nuance:** fast `loadScores` currently expects legacy denormalized score columns (`PlayerName`, `CourseName`, `Date`) while backend canonical scores are ID-based (`OutingId`, `PlayerId`). This can create mismatches unless the fast reader is updated to join IDs through `Outings`/`Players`.

### 3.3 Unused / legacy references to sheets

- **SheetsConfig.apiUrl** no longer exists in the current `sheets-config.js` structure.
- **SheetsConfig.getSheetUrl(tab)** for tabs other than `nextOuting` / `courses`:
  - Calls to tabs not present in `SHEET_GIDS` still resolve to `null` and are legacy-risk paths.
- **CoursesLoader** (`assets/js/utils/courses-loader.js`): loads courses from a CSV URL (key-value “Course” rows). Scorecard does **not** use CoursesLoader; it uses API `getScorecardData`. So CoursesLoader is only relevant if something passes it a URL (e.g. from `SheetsConfig.getSheetUrl('courses')`). That URL exists and points at the same published sheet/tab as next-outing; but no active page in the main flow uses it for scorecard.

---

## 4. Predecessor Google Sheet – is it still accessed?

- **Predecessor app:** “Ierne Snooker League” (see `assets/js/custom.js.backup`).
- **Predecessor spreadsheet ID (published CSV):**  
  `2PACX-1vSE9aMT0c6AQ-wBzuXwYm5iQoAkwJLi0kaPuL3BfoJNT2dJXvr9r8WY_b4eJqDmAy5e4nnDgHbhpE4z`
- **Current repo:**
  - **API:** Uses only the bound spreadsheet (no ID in code). So the backend never references the predecessor sheet by ID.
  - **app-config.js apiUrl:** Different deployment (`AKfycbyeWJPzuVI3vIRJMtDvHnA_...`). This is the one used for all API calls.
  - **sheets-config.js:** uses a published base URL + per-tab GIDs; no API deployment URL is referenced there.

**Conclusion:**  
- **The predecessor’s Google Sheet (Ierne Snooker League) is not used by the current repo.** Its ID appeared only in `custom.js.backup`, which has been removed.  
- **Recommendation:** Confirm in Google Drive/Sheets that `2PACX-1vSbyD2GbfL6fcwx7yg54-iRgg1Tu5lMNBpg3mPNN3rZpodq3hV6YJs3I6Rc1kcnxWfDh8kQ68aQKYWz` is the intended sheet (e.g. “theGolfApp” or your multi-tenant sheet). If the Apps Script is bound to a different sheet, you have two sheets in play: one for API (bound) and one for CSV (this published ID).

---

## 5. Hardcoded data

### 5.1 Default / fallback values

- **Default society name:** `app-config.js`: `'Golf Society'` when `currentSociety` is null.
- **Default image:**  
  - `outings.html`: `DEFAULT_IMAGE = 'assets/images/golfBanner.jpg'`  
  - `next-outing.js`: `defaultImage: 'assets/images/golfBanner.jpg'`  
  - Club images: `assets/js/utils/club-image-loader.js` uses `assets/images/clubs/default.jpg` as fallback.

### 5.2 Config

- **app-config.js:** `apiUrl` – Google Apps Script Web App URL (single source for API).

### 5.3 Backend

- No spreadsheet IDs or URLs; only sheet names: Societies, Players, Courses, Outings, Scores. Structure is documented in `backend/README.md`.

---

## 6. Summary table

| Item | Location | Purpose |
|------|----------|---------|
| **Bound Google Sheet** | Apps Script project (no ID in code) | All API data (Societies, Players, Courses, Outings, Scores). |
| **AppConfig.apiUrl** | `app-config.js` | Single Web App URL used for all API calls. |
| **Default images** | Multiple files | `golfBanner.jpg`, `clubs/default.jpg`. |

---

## 7. Recommendations

1. **Single source of truth:** The bound spreadsheet via `AppConfig.apiUrl` is the single source of truth for all data.

 If they differ, document which is “theGolfApp”