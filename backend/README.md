# Multi-Tenant Golf App - Backend Setup

## Setup Instructions

1. **Open your Google Sheet** ("theGolfApp")

2. **Create the Societies tab**:
   - Click the "+" button to add a new sheet
   - Name it "Societies"
   - Add these column headers in row 1:
     - `SocietyID` | `SocietyName` | `ContactPerson` | `NumberOfPlayers` | `NumberOfOutings` | `Status` | `CreatedDate` | `CaptainsNotes`
   - Example row (row 2):
     - `bushwhackers` | `Bushwhackers @ the Botanic` | `John Doe` | `20` | `10` | `Active` | `2026-02-13` | (notes)

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

Most endpoints require a `societyId` parameter (except master admin actions and Courses).

### Master Admin Actions

- **GET** `?action=getAllSocieties` - Get all active societies
- **GET** `?action=getCourses` - Get all courses (independent of societies, societyId optional)

### Society Actions

- **GET** `?action=getSociety&societyId=<id>` - Get society metadata
- **GET** `?action=getPlayers&societyId=<id>` - Get players list for a society
- **GET** `?action=getOutings&societyId=<id>` - Get outings list for a society (sorted by date)
- **GET** `?action=loadScores&societyId=<id>&outingId=<outingId>&playerId=<playerId>&limit=<limit>` - Get scores
  - `outingId` and `playerId` are optional filters.
  - Returned score rows are enriched via joins:
    - `Scores.PlayerId` -> `Players.PlayerId` for `playerName`
    - `Scores.OutingId` -> `Outings.OutingId` for `course`/`date`/`time`

### Score Actions (POST)

- `saveScore` - Save or update a score
- `loadScores` - Load scores (with filters)
- `deleteScore` - Delete a score
- `checkExistingScore` - Check if a score exists

### Admin Actions (POST)

- `savePlayer` / `updatePlayer` - Save or update a player (requires societyId)
- `deletePlayer` - Delete a player (requires societyId)
- `saveCourse` / `updateCourse` - Save or update a course (independent of society, societyId optional)
- `deleteCourse` - Delete a course (independent of society, societyId optional)
- `saveOuting` / `updateOuting` - Save or update an outing (requires societyId)
- `deleteOuting` - Delete an outing (requires societyId)
- `createSociety` - Create a new society (master admin)
- `updateSociety` - Update society metadata (master admin)
- `deleteSociety` - Mark society as Inactive (master admin)

## Sheet Structure

All data is stored in shared sheets (one sheet per entity type). The script creates these sheets with headers if they do not exist.

- **Societies** – Master list: `SocietyID` | `SocietyName` | `ContactPerson` | `NumberOfPlayers` | `NumberOfOutings` | `Status` | `CreatedDate` | `CaptainsNotes`
- **Players** – All societies: `SocietyID` | `PlayerId` | `PlayerName` | `Handicap`
- **Courses** – Independent (no SocietyID): `CourseName` | `ParIndx` | `CourseURL` | `CourseMaploc` | `ClubName` | `CourseImage` (filename in `assets/images/`, e.g. `golfBanner.jpg`)
- **Outings** – All societies: `SocietyID` | `OutingId` | `Date` | `Time` | `CourseName` | `Comps`
- **Scores** – All societies: `SocietyID` | `OutingId` | `PlayerId` | `Handicap` | `Hole1..18` | `Points1..18` | totals (`Total/Out/In/Back6/Back3`) | `Timestamp`
- **Teams** – All societies: `SocietyID` | `OutingId` | `TeamId` | `TeamName`
- **TeamMembers** – All societies: `SocietyID` | `OutingId` | `PlayerId` | `TeamId`

### Logical key relationships

- `Societies`: PK `SocietyID`
- `Players`: logical PK (`SocietyID`, `PlayerId`)
- `Outings`: logical PK (`SocietyID`, `OutingId`)
- `Scores`: logical PK (`SocietyID`, `OutingId`, `PlayerId`)
- `Teams`: logical PK (`SocietyID`, `OutingId`, `TeamId`)
- `TeamMembers`: logical PK (`SocietyID`, `OutingId`, `TeamId`, `PlayerId`)

Google Sheets does not enforce FK constraints, but the app expects the above relationships.

**Note:** Courses are independent of societies and can be shared across multiple societies. When creating an Outing, the CourseName must reference an existing course in the Courses sheet.

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
