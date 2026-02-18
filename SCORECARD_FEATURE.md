# Golf Scorecard Recording Feature

## Overview

This feature extends the existing scorecard page to allow users to save, load, and manage their golf scores. The implementation follows the same architecture pattern as the booking system example (rnrREADME.md), using Google Apps Script as a backend and Google Sheets for data storage.

## What Was Added

### Backend (Google Apps Script)
- **File**: `backend/code.gs`
- Handles saving, loading, and deleting golf scores
- Stores data in a Google Sheet with columns for player name, course, date, handicap, all 18 holes, and totals
- Provides REST API endpoints via Google Apps Script Web App

### Frontend Components

#### 1. API Client Utility
- **File**: `assets/js/utils/api-client.js`
- Centralized utility for making API requests to the backend
- Handles POST and GET requests with error handling
- Follows the project's modular architecture

#### 2. Configuration Update
- **File**: `assets/js/config/sheets-config.js`
- Added `apiUrl` property for the Google Apps Script Web App URL
- Maintains single source of truth for configuration

#### 3. Scorecard Page Extension
- **File**: `assets/js/pages/scorecard.js`
- Added methods:
  - `saveScore()` - Saves current scorecard data
  - `loadSavedScores()` - Loads user's saved scores
  - `displaySavedScores()` - Displays scores in a list
  - `loadScoreIntoForm()` - Loads a saved score into the form
  - `deleteScore()` - Deletes a saved score

#### 4. HTML Updates
- **File**: `scorecard.html`
- Added "Save Score" and "Load My Scores" buttons
- Added container for displaying saved scores
- Updated script loading order to include config and API client

## Features

### Save Score
- Validates that player name, course, handicap, and at least one hole score are entered
- Saves all 18 hole scores, totals (score and points), and metadata
- Provides user feedback on success/failure

### Load Scores
- Loads saved scores filtered by player name and/or course
- Displays scores in a scrollable list with course, date, and totals
- Shows most recent scores first (up to 20 by default)

### Load Score into Form
- Click "Load" button on any saved score
- Automatically populates the form with that score's data
- Recalculates points based on the loaded handicap

### Delete Score
- Click "Delete" button on any saved score
- Confirms before deletion
- Refreshes the list after deletion

## Architecture

The implementation follows the project's established patterns:

1. **Modular JavaScript**: Code is organized into utilities, config, and page-specific modules
2. **No Code Duplication**: API client is reusable across the application
3. **Configuration Centralization**: All API URLs are in `sheets-config.js`
4. **Component-Based**: HTML components are kept in `/components/` (though this feature doesn't require new components)

## Setup Required

Before using this feature, you must:

1. **Set up Google Apps Script Backend**:
   - Follow instructions in `backend/README.md`
   - Deploy as Web App
   - Copy the Web App URL

2. **Configure Frontend**:
   - Add the Web App URL to `assets/js/config/sheets-config.js`
   - Update the `apiUrl` property

3. **Authorize Script** (first time only):
   - When first saving a score, authorize the script in Google

## Data Storage

Scores are stored in a Google Sheet with the following structure:

| Column | Description |
|--------|-------------|
| PlayerName | Name of the golfer |
| CourseName | Course name |
| Date | Date of the round (YYYY-MM-DD) |
| Handicap | Player's handicap |
| Hole1-Hole18 | Scores for each hole |
| Total Score | Sum of all hole scores |
| Total Points | Sum of all Stableford points |
| Out Score | Front 9 total score |
| Out Points | Front 9 total points |
| In Score | Back 9 total score |
| In Points | Back 9 total points |
| Timestamp | When the score was saved (ISO format) |

## User Experience

1. **Enter Score**: User fills out the scorecard as before
2. **Save**: Click "Save Score" button to store the round
3. **Load**: Click "Load My Scores" to see past rounds
4. **Review**: View saved scores with course, date, and totals
5. **Reuse**: Click "Load" to populate the form with a past score
6. **Manage**: Delete old scores if needed

## Error Handling

- Validates required fields before saving
- Shows user-friendly error messages
- Handles API connection errors gracefully
- Provides feedback during save/load operations

## Future Enhancements

Potential improvements:
- Filter saved scores by date range
- Export scores to CSV
- Statistics view (average score, best round, etc.)
- Compare scores across different courses
- Share scores with other players
