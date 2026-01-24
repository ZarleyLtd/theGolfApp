// Google Sheets Configuration
// Centralized configuration for all Google Sheets used by the site
// To change the Google Sheet: Update baseSheetId and sheetTabs as needed

const SheetsConfig = {
  // Base Google Sheet ID - Change this to switch to a different sheet
  // To get this ID: Open your Google Sheet -> File -> Share -> Publish to web -> Copy the ID from the URL
  baseSheetId: "2PACX-1vSbyD2GbfL6fcwx7yg54-iRgg1Tu5lMNBpg3mPNN3rZpodq3hV6YJs3I6Rc1kcnxWfDh8kQ68aQKYWz",
//  https://docs.google.com/spreadsheets/d/e/2PACX-1vSbyD2GbfL6fcwx7yg54-iRgg1Tu5lMNBpg3mPNN3rZpodq3hV6YJs3I6Rc1kcnxWfDh8kQ68aQKYWz/pubhtml
  // Sheet Tab IDs (gid) for different data sources
  // These are the tab/worksheet IDs within the Google Sheet
  sheetTabs: {
    editorNotes: "383526357",          // Editor's Notes (same sheet as scorecard, different tab - update gid as needed)
    nextOuting: "5218768",              // Next Outing & Courses (key-value format: Key column with "NextOuting" and "Course" rows) - update gid as needed
    courses: "5218768",                 // Same as nextOuting - uses same sheet tab with key-value approach
    config: "5218768"                   // Config (key-value: Key="Player" rows supply player names for scorecard combobox) - same sheet as courses by default
  },
  
  // Google Apps Script Web App URL for scorecard API
  // To set this up:
  // 1. Create a Google Sheet
  // 2. Go to Extensions → Apps Script
  // 3. Paste the code from backend/code.gs
  // 4. Deploy as Web App (Execute as: Me, Who has access: Anyone)
  // 5. Copy the Web App URL and paste it here
  apiUrl: "https://script.google.com/macros/s/AKfycbyFLGipEbcRZUk_loJsQe-X4b6EleRe0q8p8qYx-rYf5nliJPemDnenhw0B0cB3S9Ij/exec", // TODO: Add your Google Apps Script Web App URL here
  
  // Base URL template for Google Sheets CSV export
  baseUrl: "https://docs.google.com/spreadsheets/d/e/{SHEET_ID}/pub?gid={GID}&single=true&output=csv",
  
  /**
   * Get the CSV export URL for a specific sheet tab
   * @param {string} tabName - The name of the sheet tab (fixtures, leagues, or handicaps)
   * @returns {string} The full URL to the CSV export, or null if tabName is invalid
   */
  getSheetUrl: function(tabName) {
    const gid = this.sheetTabs[tabName];
    if (!gid) {
      console.error(`Unknown sheet tab: ${tabName}`);
      return null;
    }
    return this.baseUrl
      .replace("{SHEET_ID}", this.baseSheetId)
      .replace("{GID}", gid);
  },
  
  /**
   * Get a sheet URL by directly specifying a gid
   * @param {string} gid - The Google Sheet tab ID
   * @returns {string} The full URL to the CSV export
   */
  getSheetUrlByGid: function(gid) {
    return this.baseUrl
      .replace("{SHEET_ID}", this.baseSheetId)
      .replace("{GID}", gid);
  }
};