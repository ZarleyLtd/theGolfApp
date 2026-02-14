# Apps Script Deployment Checklist

## Step-by-Step Deployment Instructions

### 1. Open Your Google Sheet
- Open the Google Sheet named "theGolfApp" (or whatever you named it)

### 2. Open Apps Script Editor
- Click **Extensions** → **Apps Script**
- This opens the Apps Script editor in a new tab

### 3. Clear Existing Code
- **Select All** (Ctrl+A / Cmd+A) in the code editor
- **Delete** the existing code
- You should see a blank editor with just `function myFunction() {}` or similar

### 4. Copy the New Code
- Open `c:\CursorSites\theGolfApp\backend\code.gs` in a text editor (or VS Code)
- **Select All** (Ctrl+A / Cmd+A)
- **Copy** (Ctrl+C / Cmd+C)

### 5. Paste into Apps Script Editor
- Go back to the Apps Script editor tab
- **Paste** (Ctrl+V / Cmd+V)
- You should see a large file starting with:
  ```javascript
  /**
   * Multi-Tenant Golf App Backend - Google Apps Script
   * Handles all societies in a single master Google Sheet
   */
  
  function doGet(e) {
  ```

### 6. Save the Project
- Click the **Save** icon (💾) or press **Ctrl+S** / **Cmd+S**
- Give the project a name if prompted (e.g., "theGolfApp")

### 7. Verify the Code is Saved
- Scroll down in the editor - you should see functions like:
  - `doGet(e)`
  - `doPost(e)`
  - `getAllSocieties()`
  - `getSociety(societyId)`
  - `saveScore(societyId, data)`
  - etc.
- The file should be ~1455 lines long

### 8. Deploy as Web App
- Click **Deploy** → **New deployment** (or **Manage deployments** → Edit existing deployment)
- Click the gear icon ⚙️ next to "Select type"
- Choose **Web app**

### 9. Configure Deployment Settings
- **Description**: "Multi-Tenant Golf App API" (or any description)
- **Execute as**: **Me** (your Google account)
- **Who has access**: **Anyone** (IMPORTANT: must be "Anyone", not "Anyone with Google account")

### 10. Deploy
- Click **Deploy**
- **Copy the Web App URL** that appears (it will look like):
  `https://script.google.com/macros/s/AKfyc.../exec`
- Click **Done**

### 11. Update Frontend Config
- Open `c:\CursorSites\theGolfApp\assets\js\config\app-config.js`
- Find the line: `apiUrl: "https://script.google.com/macros/s/..."`
- Replace the URL with your **new Web App URL** from step 10
- Save the file

### 12. Test the Deployment
Open this URL in your browser (replace with your Web App URL):
```
https://script.google.com/macros/s/YOUR_WEB_APP_ID/exec?action=getAllSocieties
```

**Expected results:**
- ✅ **Success**: You see JSON like `{"success":true,"societies":[]}`
- ❌ **"Script function not found: doGet"**: The code wasn't saved or deployed correctly (go back to step 3)
- ❌ **Authorization screen**: Click "Review Permissions" → Choose your account → "Advanced" → "Go to [Project Name] (unsafe)" → "Allow"

## Common Issues

### "Script function not found: doGet"
**Cause**: The code wasn't saved or the wrong deployment is being used.

**Fix**:
1. Go back to Apps Script editor
2. Verify you see `function doGet(e) {` at the top
3. Save again (Ctrl+S)
4. **Create a NEW deployment** (don't just edit the old one):
   - Deploy → Manage deployments
   - Delete the old deployment
   - Deploy → New deployment
   - Copy the NEW Web App URL
   - Update `app-config.js` with the new URL

### "Authorization required"
**Cause**: First time running the script.

**Fix**:
1. Click "Review Permissions"
2. Choose your Google account
3. Click "Advanced" → "Go to [Project Name] (unsafe)"
4. Click "Allow"
5. Try the URL again

### Still seeing old code behavior
**Cause**: Browser cache or old deployment URL.

**Fix**:
1. Make sure you're using the latest Web App URL (from the newest deployment)
2. Hard refresh the browser (Ctrl+Shift+R / Cmd+Shift+R)
3. Clear browser cache if needed

## Verification Checklist

Before testing the landing page, verify:

- [ ] Apps Script editor shows the full `code.gs` file (~1455 lines)
- [ ] File is saved (no unsaved changes indicator)
- [ ] Web App is deployed with "Who has access: Anyone"
- [ ] Web App URL is copied correctly
- [ ] `app-config.js` has the correct `apiUrl`
- [ ] Direct API URL test returns JSON (not HTML error)

## Quick Test Commands

Test these URLs in your browser (replace `YOUR_WEB_APP_ID`):

```bash
# Test 1: Get all societies
https://script.google.com/macros/s/YOUR_WEB_APP_ID/exec?action=getAllSocieties

# Test 2: Get a specific society (after you add one)
https://script.google.com/macros/s/YOUR_WEB_APP_ID/exec?action=getSociety&societyId=bushwhackers

# Test 3: Get players (will be empty until you add some)
https://script.google.com/macros/s/YOUR_WEB_APP_ID/exec?action=getPlayers&societyId=bushwhackers
```

All should return JSON starting with `{"success":true,...}`
