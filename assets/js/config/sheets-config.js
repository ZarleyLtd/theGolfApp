// Google Sheets Configuration
// Published sheet: used for all READ operations (faster than Apps Script).
// Apps Script (app-config.js apiUrl): used for WRITE operations only.

// Base URL for published sheet CSV export (replace /pubhtml with /pub for CSV).
// Add ?output=csv&gid=XXX to fetch a specific sheet tab.
const PUBLISHED_SHEET_BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQkAaqBMxr_CnhXKhJpF4F3o-c0ivRugvM66mvUnf6V4UtZ4Y_WcLNemY_8-VQO7mUDTyMA_H--9T9P/pub';

// Sheet tab GIDs: open each tab in the spreadsheet and copy gid=XXXXX from the URL.
const SHEET_GIDS = {
  Societies: 0,
  Players: 539233931,
  Courses: 1746655943,
  Outings: 412933874,
  Scores: 525945652
};

const SheetsConfig = {
  /** Base URL for published sheet (no query string). */
  getPublishedBaseUrl: function() {
    return PUBLISHED_SHEET_BASE;
  },

  /** CSV URL for a sheet tab by name (e.g. 'Societies', 'Players'). */
  getSheetUrlByGid: function(gid) {
    return PUBLISHED_SHEET_BASE + '?output=csv&gid=' + (gid == null ? 0 : gid);
  },

  /** CSV URL for a sheet by logical name. */
  getSheetUrl: function(sheetName) {
    const gid = SHEET_GIDS[sheetName];
    if (gid == null) return null;
    return this.getSheetUrlByGid(gid);
  },

  /** GID for a sheet name (for use by sheets-read.js). */
  getGid: function(sheetName) {
    return SHEET_GIDS[sheetName];
  }
};
