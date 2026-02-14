# Multi-Tenant Golf App - Backend Setup

## Setup Instructions

1. **Open your Google Sheet** ("theGolfApp")

2. **Create the Societies tab**:
   - Click the "+" button to add a new sheet
   - Name it "Societies"
   - Add these column headers in row 1:
     - `SocietyID` | `SocietyName` | `ContactPerson` | `NumberOfPlayers` | `NumberOfCourses` | `Status` | `CreatedDate`
   - Example row (row 2):
     - `bushwhackers` | `Bushwhackers @ the Botanic` | `John Doe` | `20` | `10` | `Active` | `2026-02-13`

3. **Open Apps Script**:
   - In your Google Sheet, go to **Extensions** → **Apps Script**
   - Delete any existing code
   - Copy the entire contents of `backend/code.gs` and paste it into the Apps Script editor
   - Save the project (Ctrl+S / Cmd+S)

4. **Deploy as Web App**:
   - Click **Deploy** → **New deployment**
   - Click the gear icon ⚙️ next to "Select type" and choose **Web app**
   - Configure:
     - **Description**: "Multi-Tenant Golf App API"
     - **Execute as**: **Me** (your Google account)
     - **Who has access**: **Anyone** (or "Anyone with Google account" for more security)
   - Click **Deploy**
   - **Copy the Web App URL** - you'll need this for the frontend config

5. **Authorize the Script** (First Time Only):
   - When you first test the API, Google will ask for authorization
   - Click **Review Permissions** → Choose your Google account → **Advanced** → **Go to [Project Name] (unsafe)** → **Allow**

## API Endpoints

All endpoints require a `societyId` parameter (except master admin actions).

### Master Admin Actions

- **GET** `?action=getAllSocieties` - Get all active societies

### Society Actions

- **GET** `?action=getSociety&societyId=<id>` - Get society metadata
- **GET** `?action=getPlayers&societyId=<id>` - Get players list
- **GET** `?action=getCourses&societyId=<id>` - Get courses list
- **GET** `?action=getOutings&societyId=<id>` - Get outings list (sorted by date)
- **GET** `?action=loadScores&societyId=<id>&playerName=<name>&course=<course>&limit=<limit>` - Get scores

### Score Actions (POST)

- `saveScore` - Save or update a score
- `loadScores` - Load scores (with filters)
- `deleteScore` - Delete a score
- `checkExistingScore` - Check if a score exists

### Admin Actions (POST)

- `savePlayer` / `updatePlayer` - Save or update a player
- `deletePlayer` - Delete a player
- `saveCourse` / `updateCourse` - Save or update a course
- `deleteCourse` - Delete a course
- `saveOuting` / `updateOuting` - Save or update an outing
- `deleteOuting` - Delete an outing
- `createSociety` - Create a new society (master admin)
- `updateSociety` - Update society metadata (master admin)
- `deleteSociety` - Mark society as Inactive (master admin)

## Sheet Structure

Each society gets a tab named `Society_<society-id>` (e.g., `Society_bushwhackers`).

Each society tab contains sections:
- **=== PLAYERS ===** (rows 1-9)
  - Headers: `PlayerName`, `Handicap`
- **=== COURSES ===** (rows 10-19)
  - Headers: `CourseName`, `Par1`-`Par18`, `Index1`-`Index18`
- **=== OUTINGS ===** (rows 20-29)
  - Headers: `Date`, `Time`, `GolfClubName`, `CourseName`, `CourseKey`, `ClubUrl`, `MapsUrl`
- **=== SCORES ===** (rows 30+)
  - Same structure as BGS scores

The script automatically creates these sections when a new society is created or when data is first written.

## Testing

Test the API by visiting:
```
https://script.google.com/macros/s/YOUR_WEB_APP_ID/exec?action=getAllSocieties
```

You should see JSON with an empty `societies` array if no societies exist yet.

## Troubleshooting

- **"Script function not found: doGet"** - Make sure you've saved the code and redeployed
- **"Society not found"** - Make sure the Societies tab exists and has the correct column headers
- **"Permission denied"** - Make sure you've authorized the script and set "Who has access" to "Anyone"
