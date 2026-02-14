# Multi-Tenant Golf App - Setup Guide

## Current Status

✅ **Backend (Apps Script)** - Created and ready to deploy
✅ **Frontend Config** - Multi-tenant config system created
✅ **API Client** - Updated to include societyId in all requests
✅ **Landing Page** - Created to list all societies
✅ **Index Page** - Updated to be society-aware

## Next Steps

### 1. Deploy Apps Script Backend

1. Open your Google Sheet "theGolfApp"
2. Go to **Extensions** → **Apps Script**
3. Copy the entire contents of `backend/code.gs` and paste into the Apps Script editor
4. Save (Ctrl+S / Cmd+S)
5. Click **Deploy** → **New deployment** (or **Manage deployments** → Edit existing)
6. Set:
   - **Execute as**: Me
   - **Who has access**: Anyone
7. Click **Deploy** and copy the Web App URL
8. Update `assets/js/config/app-config.js` - replace the `apiUrl` value with your Web App URL

### 2. Create Societies Tab

1. In your Google Sheet, add a new sheet named **"Societies"**
2. Add these column headers in row 1:
   ```
   SocietyID | SocietyName | ContactPerson | NumberOfPlayers | NumberOfCourses | Status | CreatedDate
   ```
3. Add a test society (row 2):
   ```
   bushwhackers | Bushwhackers @ the Botanic | John Doe | 20 | 10 | Active | 2026-02-13
   ```

### 3. Test the Setup

1. Open `landing.html` in your browser
   - Should show your test society
2. Click on the society link
   - Should navigate to `/theGolfApp/bushwhackers/`
   - Should load the society name in the page title

### 4. Test API Endpoints

Test these URLs in your browser (replace with your Web App URL):

```
# Get all societies
https://script.google.com/macros/s/YOUR_WEB_APP_ID/exec?action=getAllSocieties

# Get a specific society
https://script.google.com/macros/s/YOUR_WEB_APP_ID/exec?action=getSociety&societyId=bushwhackers

# Get players (will be empty until you add some)
https://script.google.com/macros/s/YOUR_WEB_APP_ID/exec?action=getPlayers&societyId=bushwhackers
```

## File Structure

```
theGolfApp/
├── backend/
│   ├── code.gs          # Apps Script backend (copy to Google Apps Script)
│   └── README.md        # Backend setup instructions
├── assets/
│   └── js/
│       ├── config/
│       │   ├── app-config.js      # Multi-tenant config (NEW)
│       │   └── sheets-config.js    # Legacy config (kept for compatibility)
│       └── utils/
│           └── api-client.js       # Updated to include societyId
├── landing.html         # Landing page listing all societies (NEW)
├── index.html          # Main app page (updated for multi-tenant)
└── SETUP.md            # This file
```

## What's Been Done

1. **Apps Script Backend** (`backend/code.gs`)
   - Multi-tenant routing by `societyId`
   - CRUD operations for societies, players, courses, outings, scores
   - Automatic section creation in society tabs

2. **Frontend Config** (`assets/js/config/app-config.js`)
   - Parses `societyId` from URL path
   - Loads society metadata from API
   - Provides `getSocietyId()` and `getSocietyName()` helpers

3. **API Client** (`assets/js/utils/api-client.js`)
   - Automatically includes `societyId` in all requests
   - Uses `AppConfig.apiUrl` instead of `SheetsConfig.apiUrl`
   - Handles master admin actions (no societyId required)

4. **Landing Page** (`landing.html`)
   - Lists all active societies from API
   - Links to each society's main page

5. **Index Page** (`index.html`)
   - Includes `app-config.js`
   - Updates page title/meta tags with society name
   - Redirects to landing if no societyId found

## Still To Do

- [ ] Update scorecard page to use new API (load courses/players from API)
- [ ] Create master admin UI (`admin/societies.html`)
- [ ] Create society admin UI (`<society-id>/admin/`)
- [ ] Update outings page to load from API
- [ ] Set up image library structure
- [ ] Remove hardcoded branding from other pages

## Troubleshooting

**"Script function not found: doGet"**
- Make sure you've copied `backend/code.gs` into Apps Script and saved
- Redeploy the Web App

**"Society ID is required"**
- Make sure you're accessing via `/theGolfApp/<society-id>/` path
- Check that `app-config.js` is loaded before other scripts

**"Society not found"**
- Make sure the Societies tab exists with correct headers
- Check that the societyId matches exactly (case-insensitive)

**"Failed to fetch" / CORS errors when testing from localhost (e.g. 127.0.0.1:5500)**
- The landing page will automatically retry via a CORS proxy when the direct request is blocked. If you still see an error:
  1. Open the API URL directly in your browser to authorize the script and confirm it returns JSON:
     `https://script.google.com/macros/s/YOUR_WEB_APP_ID/exec?action=getAllSocieties`
  2. Ensure the Web App is deployed with **Who has access: Anyone** (not "Anyone with Google account").
  3. After authorizing, reload the landing page.
- For production (e.g. GitHub Pages), the same-origin or correct CORS headers from Google usually work without a proxy.
