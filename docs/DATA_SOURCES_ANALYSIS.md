# Data Sources Analysis

Full analysis of data sources used across the codebase, Google Sheets usage and permissions, hardcoded data, and risk of predecessor Google Sheet still being accessed.

---

## 1. Data source overview

| Source | Type | Used by | Permission / binding |
|--------|------|---------|----------------------|
| **Google Apps Script Web App** | REST API | All society-aware pages (API calls) | Execute as: Me; Who has access: Anyone. Sheet = bound to script. |
| **Google Sheet (CSV publish)** | Public CSV URL | Next-outing fallback when no society | Public “Publish to web” link; no auth. |
| **Default / fallback values** | Static JS | Default images, society name | N/A |

The app uses a single data path: **API (bound sheet)** via `app-config.js` apiUrl.

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
- **Mechanism:** Uses a **published** Google Sheet URL (File → Share → Publish to web). Format:
  - `baseUrl`: `https://docs.google.com/spreadsheets/d/e/{SHEET_ID}/pub?gid={GID}&single=true&output=csv`
  - `baseSheetId`: `2PACX-1vSbyD2GbfL6fcwx7yg54-iRgg1Tu5lMNBpg3mPNN3rZpodq3hV6YJs3I6Rc1kcnxWfDh8kQ68aQKYWz`
  - `sheetTabs.nextOuting` and `sheetTabs.courses`: gid `5218768`
- **Permission:** Public CSV. No login; anyone with the link can read. No write. Permission is “given” by the sheet owner when they publish that sheet/tab to the web.

---

## 3. Where each data source is used

### 3.1 Apps Script API (bound spreadsheet)

- **Config:** `assets/js/config/app-config.js` → `apiUrl`  
  `https://script.google.com/macros/s/AKfycbyeWJPzuVI3vIRJMtDvHnA_N2YW9zSt_r99Up7GdEuk-L7TOaPWlZAlj8z0Kmmftq-ecA/exec`
- **Usage:** `assets/js/utils/api-client.js` uses `AppConfig.apiUrl` for all `ApiClient.get()` and `ApiClient.post()`.
- **Pages:** All society-based flows: index (with society), scorecard, scorecard-sidescroll, leaderboard, outings, admin (societies, society-admin). All read/write to the **bound** sheet via this single Web App.

So: **one Google Sheet (the bound one) is the source of truth for API data.**

### 3.2 Published CSV sheet (SheetsConfig.baseSheetId)

- **Config:** `assets/js/config/sheets-config.js` → `baseSheetId`, `sheetTabs.nextOuting`, `sheetTabs.courses` (gid `5218768`).
- **Usage:**
  - **Next-outing fallback:** When there is **no** society (`!AppConfig.currentSociety`), `assets/js/components/next-outing.js` calls `SheetsConfig.getSheetUrl('nextOuting')`, then `CsvLoader.load(url)` to fetch CSV and read a “NextOuting” key/value row; it then uses `OutingsConfig.OUTINGS_2026[outingIndex - 1]` to render.
- **Not used for API:** `api-client.js` does not use `SheetsConfig.apiUrl`; it uses `AppConfig.apiUrl` only.

So: **the current repo still accesses the Google Sheet identified by `SheetsConfig.baseSheetId`** when the app is used without a society (fallback next-outing path).

### 3.3 Unused / legacy references to sheets

- **SheetsConfig.apiUrl** in `sheets-config.js`: different deployment ID than `app-config.js`. It is **not** used by `api-client.js`. So it is dead config and could be an old/predecessor deployment.
- **SheetsConfig.getSheetUrl(tab)** for tabs other than `nextOuting` / `courses`:
  - `assets/js/pages/leagues.js`, `fixtures.js`, `handicaps.js`, `league-leaders.js`, `results.js`, `under-development.js`, `index.js` call `SheetsConfig.getSheetUrl('leagues'|'fixtures'|'handicaps')`.
  - `sheets-config.js` only defines `sheetTabs.nextOuting` and `sheetTabs.courses`. So `getSheetUrl('fixtures')` etc. return `null` and those pages would fail or show “Unknown sheet tab” if they run. These are legacy/alternate flows (e.g. knockout/fixtures/leagues) and do not point at a defined sheet in the current config.
- **CoursesLoader** (`assets/js/utils/courses-loader.js`): loads courses from a CSV URL (key-value “Course” rows). Scorecard does **not** use CoursesLoader; it uses API `getScorecardData`. So CoursesLoader is only relevant if something passes it a URL (e.g. from `SheetsConfig.getSheetUrl('courses')`). That URL exists and points at the same published sheet/tab as next-outing; but no active page in the main flow uses it for scorecard.

---

## 4. Predecessor Google Sheet – is it still accessed?

- **Predecessor app:** “Ierne Snooker League” (see `assets/js/custom.js.backup`).
- **Predecessor spreadsheet ID (published CSV):**  
  `2PACX-1vSE9aMT0c6AQ-wBzuXwYm5iQoAkwJLi0kaPuL3BfoJNT2dJXvr9r8WY_b4eJqDmAy5e4nnDgHbhpE4z`
- **Current repo:**
  - **API:** Uses only the bound spreadsheet (no ID in code). So the backend never references the predecessor sheet by ID.
  - **app-config.js apiUrl:** Different deployment (`AKfycbyeWJPzuVI3vIRJMtDvHnA_...`). This is the one used for all API calls.
  - **sheets-config.js:**
    - **baseSheetId:** `2PACX-1vSbyD2GbfL6fcwx7yg54-iRgg1Tu5lMNBpg3mPNN3rZpodq3hV6YJs3I6Rc1kcnxWfDh8kQ68aQKYWz` — **different** from the predecessor ID.
    - **apiUrl:** `AKfycbyFLGipEbcRZUk_loJsQe-X4b6EleRe0q8p8qYx-rYf5nliJPemDnenhw0B0cB3S9Ij` — not used by the app; could be an old/predecessor deployment.

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