/**
 * Multi-Tenant Golf App Backend - Google Apps Script
 * Handles all societies in a single master Google Sheet
 *
 * Sheet Structure:
 * - Societies: Master registry (SocietyID, SocietyName, ContactPerson, NumberOfPlayers, NumberOfOutings, Status, CreatedDate, CaptainsNotes)
 * - Players: SocietyID, PlayerName, Handicap (all societies)
 * - Courses: CourseName, ParIndx, CourseURL, CourseMaploc, ClubName (independent of societies)
 * - Outings: SocietyID, Date, Time, CourseName, Comps (all societies)
 * - Scores: SocietyID, PlayerName, CourseName, Date, Time, Handicap, Hole1..18, Points1..18, totals, Timestamp (all societies)
 *
 * All requests must include societyId parameter (except master admin actions and Courses operations)
 */

// ============================================
// MAIN REQUEST HANDLERS
// ============================================

function doGet(e) {
  try {
    const action = e.parameter.action || '';
    const societyId = e.parameter.societyId || '';
    
    // Master admin actions (no societyId required)
    if (action === 'getAllSocieties') {
      return getAllSocieties();
    }
    if (action === 'getCourses') {
      return getCourses(societyId); // Courses are independent, societyId ignored
    }
    
    // Society-specific actions
    if (!societyId) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'societyId parameter is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    switch (action) {
      case 'getSociety':
        return getSociety(societyId);
      case 'getPlayers':
        return getPlayers(societyId);
      case 'getOutings':
        return getOutings(societyId);
      case 'getSocietyAdminData':
        return getSocietyAdminData(societyId);
      case 'getScorecardData':
        return getScorecardData(societyId);
      case 'loadScores':
        return loadScores({
          societyId: societyId,
          playerName: e.parameter.playerName || '',
          course: e.parameter.course || '',
          limit: parseInt(e.parameter.limit || '50')
        });
      default:
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: 'Unknown action: ' + action
        })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    // Parse request data
    let requestData;
    if (e.postData && e.postData.contents) {
      const contents = e.postData.contents;
      if (contents.trim().startsWith('{')) {
        requestData = JSON.parse(contents);
      } else {
        const dataMatch = contents.match(/data=([^&]*)/);
        if (dataMatch && dataMatch[1]) {
          // application/x-www-form-urlencoded uses + for space; decode before JSON.parse
          let raw = dataMatch[1].replace(/\+/g, ' ');
          const decodedData = decodeURIComponent(raw);
          requestData = JSON.parse(decodedData);
        } else {
          throw new Error('No data parameter found in form data');
        }
      }
    } else if (e.parameter && e.parameter.data) {
      // Decode + to space in case parameter was form-encoded
      const paramData = (e.parameter.data || '').replace(/\+/g, ' ');
      requestData = JSON.parse(paramData);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'No data received'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const action = requestData.action || '';
    const societyId = requestData.societyId || '';
    
    // Master admin actions
    if (action === 'createSociety') {
      return createSociety(requestData.data);
    }
    if (action === 'updateSociety') {
      return updateSociety(requestData.data);
    }
    if (action === 'deleteSociety') {
      return deleteSociety(requestData.data);
    }
    if (action === 'saveCourse' || action === 'updateCourse') {
      return saveCourse(requestData.societyId || '', requestData.data);
    }
    if (action === 'deleteCourse') {
      return deleteCourse(requestData.societyId || '', requestData.data);
    }
    
    // Society-specific actions require societyId
    if (!societyId) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'societyId parameter is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Score actions
    if (action === 'saveScore') {
      return saveScore(societyId, requestData.data);
    } else if (action === 'loadScores') {
      return loadScores(requestData.data || { societyId: societyId });
    } else if (action === 'deleteScore') {
      return deleteScore(societyId, requestData.data);
    } else if (action === 'checkExistingScore') {
      return checkExistingScore(societyId, requestData.data);
    }
    
    // Admin actions (players, outings)
    if (action === 'savePlayer' || action === 'updatePlayer') {
      return savePlayer(societyId, requestData.data);
    } else if (action === 'deletePlayer') {
      return deletePlayer(societyId, requestData.data);
    } else if (action === 'saveOuting' || action === 'updateOuting') {
      return saveOuting(societyId, requestData.data);
    } else if (action === 'deleteOuting') {
      return deleteOuting(societyId, requestData.data);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Unknown action: ' + action
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// SOCIETIES MANAGEMENT (Master Admin)
// ============================================

function getAllSocieties() {
  try {
    const sheet = getOrCreateSheet('Societies');
    
    if (sheet.getLastRow() <= 1) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        societies: []
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];
    const societies = [];
    
    // Find column indices
    const colSocietyId = headers.indexOf('SocietyID');
    const colSocietyName = headers.indexOf('SocietyName');
    const colContactPerson = headers.indexOf('ContactPerson');
    const colNumberOfPlayers = headers.indexOf('NumberOfPlayers');
    const colNumberOfOutings = headers.indexOf('NumberOfOutings');
    const colStatus = headers.indexOf('Status');
    const colCreatedDate = headers.indexOf('CreatedDate');
    const colCaptainsNotes = headers.indexOf('CaptainsNotes');
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const status = colStatus >= 0 ? String(row[colStatus] || '').trim() : 'Active';
      societies.push({
        societyId: colSocietyId >= 0 ? String(row[colSocietyId] || '').trim() : '',
        societyName: colSocietyName >= 0 ? String(row[colSocietyName] || '').trim() : '',
        contactPerson: colContactPerson >= 0 ? String(row[colContactPerson] || '').trim() : '',
        numberOfPlayers: colNumberOfPlayers >= 0 ? (row[colNumberOfPlayers] || 0) : 0,
        numberOfOutings: colNumberOfOutings >= 0 ? (row[colNumberOfOutings] || 0) : 0,
        status: status || 'Active',
        createdDate: colCreatedDate >= 0 ? String(row[colCreatedDate] || '') : '',
        captainsNotes: colCaptainsNotes >= 0 ? String(row[colCaptainsNotes] || '').trim() : ''
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      societies: societies
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getSociety(societyId) {
  try {
    const sheet = getOrCreateSheet('Societies');
    
    if (sheet.getLastRow() <= 1) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Society not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];
    
    const colSocietyId = headers.indexOf('SocietyID');
    const colSocietyName = headers.indexOf('SocietyName');
    const colContactPerson = headers.indexOf('ContactPerson');
    const colNumberOfPlayers = headers.indexOf('NumberOfPlayers');
    const colNumberOfOutings = headers.indexOf('NumberOfOutings');
    const colStatus = headers.indexOf('Status');
    const colCreatedDate = headers.indexOf('CreatedDate');
    const colCaptainsNotes = headers.indexOf('CaptainsNotes');
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowSocietyId = colSocietyId >= 0 ? String(row[colSocietyId] || '').trim() : '';
      
      if (rowSocietyId.toLowerCase() === societyId.toLowerCase()) {
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          society: {
            societyId: rowSocietyId,
            societyName: colSocietyName >= 0 ? String(row[colSocietyName] || '').trim() : '',
            contactPerson: colContactPerson >= 0 ? String(row[colContactPerson] || '').trim() : '',
            numberOfPlayers: colNumberOfPlayers >= 0 ? (row[colNumberOfPlayers] || 0) : 0,
            numberOfOutings: colNumberOfOutings >= 0 ? (row[colNumberOfOutings] || 0) : 0,
            status: colStatus >= 0 ? String(row[colStatus] || '').trim() : 'Active',
            createdDate: colCreatedDate >= 0 ? String(row[colCreatedDate] || '') : '',
            captainsNotes: colCaptainsNotes >= 0 ? String(row[colCaptainsNotes] || '').trim() : ''
          }
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Society not found: ' + societyId
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function createSociety(data) {
  try {
    const societiesSheet = getOrCreateSheet('Societies');
    
    // Ensure headers exist (match user's spreadsheet structure)
    if (societiesSheet.getLastRow() === 0) {
      const headers = ['SocietyID', 'SocietyName', 'ContactPerson', 'NumberOfPlayers', 'NumberOfOutings', 'Status', 'CreatedDate', 'CaptainsNotes'];
      societiesSheet.appendRow(headers);
    }
    
    const societyId = String(data.societyId || '').trim();
    if (!societyId) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'SocietyID is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Check if society already exists
    const rows = societiesSheet.getDataRange().getValues();
    const headers = rows[0];
    const colSocietyId = headers.indexOf('SocietyID');
    
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][colSocietyId] || '').trim().toLowerCase() === societyId.toLowerCase()) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: 'Society already exists: ' + societyId
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // Add row to Societies sheet (match column order: SocietyID, SocietyName, ContactPerson, NumberOfPlayers, NumberOfOutings, Status, CreatedDate, CaptainsNotes)
    const newRow = [
      societyId,
      String(data.societyName || '').trim(),
      String(data.contactPerson || '').trim(),
      parseInt(data.numberOfPlayers || 0),
      parseInt(data.numberOfOutings || 0),
      'Active',
      new Date().toISOString().split('T')[0],
      String(data.captainsNotes || '').trim()
    ];
    societiesSheet.appendRow(newRow);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Society created successfully',
      societyId: societyId
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function updateSociety(data) {
  try {
    const sheet = getOrCreateSheet('Societies');
    const societyId = String(data.societyId || '').trim();
    
    if (!societyId) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'SocietyID is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];
    const colSocietyId = headers.indexOf('SocietyID');
    
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][colSocietyId] || '').trim().toLowerCase() === societyId.toLowerCase()) {
        // Update the row
        const rowIndex = i + 1;
        if (data.societyName !== undefined) {
          const colSocietyName = headers.indexOf('SocietyName');
          if (colSocietyName >= 0) sheet.getRange(rowIndex, colSocietyName + 1).setValue(data.societyName);
        }
        if (data.contactPerson !== undefined) {
          const colContactPerson = headers.indexOf('ContactPerson');
          if (colContactPerson >= 0) sheet.getRange(rowIndex, colContactPerson + 1).setValue(data.contactPerson);
        }
        if (data.numberOfPlayers !== undefined) {
          const colNumberOfPlayers = headers.indexOf('NumberOfPlayers');
          if (colNumberOfPlayers >= 0) sheet.getRange(rowIndex, colNumberOfPlayers + 1).setValue(data.numberOfPlayers);
        }
        if (data.numberOfOutings !== undefined) {
          const colNumberOfOutings = headers.indexOf('NumberOfOutings');
          if (colNumberOfOutings >= 0) sheet.getRange(rowIndex, colNumberOfOutings + 1).setValue(data.numberOfOutings);
        }
        if (data.status !== undefined) {
          const colStatus = headers.indexOf('Status');
          if (colStatus >= 0) sheet.getRange(rowIndex, colStatus + 1).setValue(data.status);
        }
        if (data.captainsNotes !== undefined) {
          const colCaptainsNotes = headers.indexOf('CaptainsNotes');
          if (colCaptainsNotes >= 0) sheet.getRange(rowIndex, colCaptainsNotes + 1).setValue(data.captainsNotes);
        }
        
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: 'Society updated successfully'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Society not found: ' + societyId
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function deleteSociety(data) {
  try {
    const sheet = getOrCreateSheet('Societies');
    const societyId = String(data.societyId || '').trim();
    if (!societyId) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'SocietyID is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];
    const colSocietyId = headers.indexOf('SocietyID');
    if (colSocietyId < 0) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'SocietyID column not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][colSocietyId] || '').trim().toLowerCase() === societyId.toLowerCase()) {
        const rowIndex = i + 1;
        sheet.deleteRow(rowIndex);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: 'Society deleted successfully'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Society not found: ' + societyId
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// SHARED SHEETS (Players, Courses, Outings, Scores)
// ============================================

function getPlayersSheet() {
  const sheet = getOrCreateSheet('Players');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['SocietyID', 'PlayerName', 'Handicap']);
  }
  return sheet;
}

function getCoursesSheet() {
  const sheet = getOrCreateSheet('Courses');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['CourseName', 'ParIndx', 'CourseURL', 'CourseMaploc', 'ClubName', 'CourseImage']);
  }
  return sheet;
}

function getOutingsSheet() {
  const sheet = getOrCreateSheet('Outings');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['SocietyID', 'Date', 'Time', 'CourseName', 'Comps']);
  }
  return sheet;
}

function getScoresSheet() {
  const sheet = getOrCreateSheet('Scores');
  if (sheet.getLastRow() === 0) {
    const headers = [
      'SocietyID', 'PlayerName', 'CourseName', 'Date', 'Time', 'Handicap',
      'Hole1', 'Hole2', 'Hole3', 'Hole4', 'Hole5', 'Hole6', 'Hole7', 'Hole8', 'Hole9',
      'Hole10', 'Hole11', 'Hole12', 'Hole13', 'Hole14', 'Hole15', 'Hole16', 'Hole17', 'Hole18',
      'Points1', 'Points2', 'Points3', 'Points4', 'Points5', 'Points6', 'Points7', 'Points8', 'Points9',
      'Points10', 'Points11', 'Points12', 'Points13', 'Points14', 'Points15', 'Points16', 'Points17', 'Points18',
      'Total Score', 'Total Points', 'Out Score', 'Out Points', 'In Score', 'In Points',
      'Back 6 Score', 'Back 6 Points', 'Back 3 Score', 'Back 3 Points', 'Timestamp'
    ];
    sheet.appendRow(headers);
  }
  return sheet;
}

// ============================================
// PLAYERS MANAGEMENT
// ============================================

function getPlayers(societyId) {
  try {
    const sheet = getPlayersSheet();
    const rows = sheet.getDataRange().getValues();
    const players = [];
    const sid = String(societyId || '').toLowerCase();
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (String(row[0] || '').toLowerCase() !== sid) continue;
      const playerName = String(row[1] || '').trim();
      if (!playerName) continue;
      players.push({
        playerName: playerName,
        handicap: row[2] || 0
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      players: players
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function savePlayer(societyId, data) {
  try {
    const sheet = getPlayersSheet();
    const playerName = String(data.playerName || '').trim();
    
    if (!playerName) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'PlayerName is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const rows = sheet.getDataRange().getValues();
    const sid = String(societyId || '').toLowerCase();
    
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').toLowerCase() !== sid) continue;
      if (String(rows[i][1] || '').trim().toLowerCase() === playerName.toLowerCase()) {
        sheet.getRange(i + 1, 1, 1, 3).setValues([[societyId, playerName, data.handicap || 0]]);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: 'Player updated successfully'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    sheet.appendRow([societyId, playerName, data.handicap || 0]);
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Player saved successfully'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function deletePlayer(societyId, data) {
  try {
    const playerName = String(data.playerName || '').trim();
    
    if (!playerName) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'PlayerName is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Block delete if any scores exist for this player
    const scoresSheet = getScoresSheet();
    const scoresRows = scoresSheet.getDataRange().getValues();
    const sid = String(societyId || '').toLowerCase();
    const normalizedPlayerName = normalizeName(playerName);
    for (let i = 1; i < scoresRows.length; i++) {
      if (String(scoresRows[i][0] || '').toLowerCase() !== sid) continue;
      if (normalizeName(String(scoresRows[i][1] || '').trim()) === normalizedPlayerName) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: 'Cannot delete player: one or more scores exist for this player. Delete the scores first.'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    const sheet = getPlayersSheet();
    const rows = sheet.getDataRange().getValues();
    
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').toLowerCase() !== sid) continue;
      if (String(rows[i][1] || '').trim().toLowerCase() === playerName.toLowerCase()) {
        sheet.deleteRow(i + 1);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: 'Player deleted successfully'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Player not found'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// COURSES MANAGEMENT
// ============================================

function getCourses(societyId) {
  try {
    const sheet = getCoursesSheet();
    const rows = sheet.getDataRange().getValues();
    const courses = [];
    if (rows.length < 2) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        courses: courses
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const headers = rows[0].map(function(h) { return String(h || '').trim(); });
    const colCourseName = headers.indexOf('CourseName') >= 0 ? headers.indexOf('CourseName') : 0;
    const colParIndx = headers.indexOf('ParIndx') >= 0 ? headers.indexOf('ParIndx') : 1;
    const colCourseURL = headers.indexOf('CourseURL') >= 0 ? headers.indexOf('CourseURL') : 2;
    const colCourseMaploc = headers.indexOf('CourseMaploc') >= 0 ? headers.indexOf('CourseMaploc') : 3;
    const colClubName = headers.indexOf('ClubName') >= 0 ? headers.indexOf('ClubName') : 4;
    const colCourseImage = headers.indexOf('CourseImage') >= 0 ? headers.indexOf('CourseImage') : -1;

    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      var courseName = String(row[colCourseName] || '').trim();
      if (!courseName) continue;
      var course = {
        courseName: courseName,
        parIndx: String(row[colParIndx] || '').trim(),
        courseURL: String(row[colCourseURL] || '').trim(),
        courseMaploc: String(row[colCourseMaploc] || '').trim(),
        clubName: String(row[colClubName] || '').trim()
      };
      if (colCourseImage >= 0) {
        course.courseImage = String(row[colCourseImage] || '').trim();
      }
      courses.push(course);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      courses: courses
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function saveCourse(societyId, data) {
  try {
    const sheet = getCoursesSheet();
    const courseName = String(data.courseName || '').trim();
    
    if (!courseName) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'CourseName is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const newRow = [
      courseName,
      String(data.parIndx || '').trim(),
      String(data.courseURL || '').trim(),
      String(data.courseMaploc || '').trim(),
      String(data.clubName || '').trim(),
      String(data.courseImage || '').trim()
    ];
    
    const rows = sheet.getDataRange().getValues();
    const searchName = String(data.originalCourseName || data.courseName || '').trim().toLowerCase();

    for (let i = 1; i < rows.length; i++) {
      const rowName = String(rows[i][0] || '').trim().toLowerCase();
      if (rowName === searchName) {
        sheet.getRange(i + 1, 1, 1, 6).setValues([newRow]);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: 'Course updated successfully'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    sheet.appendRow(newRow);
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Course saved successfully'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function deleteCourse(societyId, data) {
  try {
    const sheet = getCoursesSheet();
    const courseName = String(data.courseName || '').trim();
    
    if (!courseName) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'CourseName is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const rows = sheet.getDataRange().getValues();
    
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').trim().toLowerCase() === courseName.toLowerCase()) {
        sheet.deleteRow(i + 1);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: 'Course deleted successfully'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Course not found'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// OUTINGS MANAGEMENT
// ============================================

/** Format sheet date value to YYYY-MM-DD for consistent comparison and API response. */
function formatOutingDateFromSheet(val) {
  if (val instanceof Date) {
    const y = val.getFullYear(), m = val.getMonth() + 1, d = val.getDate();
    return y + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d);
  }
  return String(val || '').trim();
}

/** Format sheet time value to HH:MM for time input and display. Handles Date, number (Sheets serial), or HH:MM string. */
function formatOutingTimeFromSheet(val) {
  const normalized = normalizeTime(val);
  return normalized || String(val || '').trim();
}

function getOutings(societyId) {
  try {
    const sheet = getOutingsSheet();
    const rows = sheet.getDataRange().getValues();
    const outings = [];
    const sid = String(societyId || '').toLowerCase();
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (String(row[0] || '').toLowerCase() !== sid) continue;
      const dateStr = formatOutingDateFromSheet(row[1]);
      const timeStr = formatOutingTimeFromSheet(row[2]);
      const courseName = String(row[3] || '').trim();
      if (!dateStr || !timeStr || !courseName) continue;
      outings.push({
        date: dateStr,
        time: timeStr,
        courseName: courseName,
        comps: String(row[4] || '').trim()
      });
    }
    
    // Sort by date and time
    outings.sort((a, b) => {
      const dateA = new Date(a.date + (a.time ? 'T' + a.time : ''));
      const dateB = new Date(b.date + (b.time ? 'T' + b.time : ''));
      return dateA - dateB;
    });
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      outings: outings
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Single round-trip for society admin page: society metadata, players, and outings.
 */
function getSocietyAdminData(societyId) {
  try {
    const sid = String(societyId || '').toLowerCase();
    if (!sid) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'societyId is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Society
    const societiesSheet = getOrCreateSheet('Societies');
    let society = null;
    if (societiesSheet.getLastRow() >= 1) {
      const sRows = societiesSheet.getDataRange().getValues();
      const sHeaders = sRows[0];
      const colSocietyId = sHeaders.indexOf('SocietyID');
      const colSocietyName = sHeaders.indexOf('SocietyName');
      const colContactPerson = sHeaders.indexOf('ContactPerson');
      const colNumberOfPlayers = sHeaders.indexOf('NumberOfPlayers');
      const colNumberOfOutings = sHeaders.indexOf('NumberOfOutings');
      const colStatus = sHeaders.indexOf('Status');
      const colCreatedDate = sHeaders.indexOf('CreatedDate');
      const colCaptainsNotes = sHeaders.indexOf('CaptainsNotes');
      for (let i = 1; i < sRows.length; i++) {
        const row = sRows[i];
        if (String(row[colSocietyId] || '').toLowerCase() !== sid) continue;
        society = {
          societyId: String(row[colSocietyId] || '').trim(),
          societyName: colSocietyName >= 0 ? String(row[colSocietyName] || '').trim() : '',
          contactPerson: colContactPerson >= 0 ? String(row[colContactPerson] || '').trim() : '',
          numberOfPlayers: colNumberOfPlayers >= 0 ? (row[colNumberOfPlayers] || 0) : 0,
          numberOfOutings: colNumberOfOutings >= 0 ? (row[colNumberOfOutings] || 0) : 0,
          status: colStatus >= 0 ? String(row[colStatus] || '').trim() : 'Active',
          createdDate: colCreatedDate >= 0 ? String(row[colCreatedDate] || '') : '',
          captainsNotes: colCaptainsNotes >= 0 ? String(row[colCaptainsNotes] || '').trim() : ''
        };
        break;
      }
    }
    if (!society) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Society not found: ' + societyId
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Players
    const playersSheet = getPlayersSheet();
    const pRows = playersSheet.getDataRange().getValues();
    const players = [];
    for (let i = 1; i < pRows.length; i++) {
      const row = pRows[i];
      if (String(row[0] || '').toLowerCase() !== sid) continue;
      const playerName = String(row[1] || '').trim();
      if (!playerName) continue;
      players.push({ playerName: playerName, handicap: row[2] || 0 });
    }

    // Outings
    const outingsSheet = getOutingsSheet();
    const oRows = outingsSheet.getDataRange().getValues();
    const outings = [];
    for (let i = 1; i < oRows.length; i++) {
      const row = oRows[i];
      if (String(row[0] || '').toLowerCase() !== sid) continue;
      const dateStr = formatOutingDateFromSheet(row[1]);
      if (!dateStr) continue;
      const timeStr = formatOutingTimeFromSheet(row[2]);
      const courseName = String(row[3] || '').trim();
      outings.push({
        date: dateStr,
        time: timeStr,
        courseName: courseName,
        comps: String(row[4] || '').trim(),
        hasScores: outingHasScores(societyId, dateStr, timeStr, courseName)
      });
    }
    outings.sort((a, b) => {
      const dateA = new Date(a.date + (a.time ? 'T' + a.time : ''));
      const dateB = new Date(b.date + (b.time ? 'T' + b.time : ''));
      return dateA - dateB;
    });

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      society: society,
      players: players,
      outings: outings
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Single round-trip: outings, courses (filtered by outing course names), and players for a society.
 * Used by scorecard page to reduce GET requests.
 */
function getScorecardData(societyId) {
  try {
    var outings = [];
    var outingsSheet = getOutingsSheet();
    var outRows = outingsSheet.getDataRange().getValues();
    var sid = String(societyId || '').toLowerCase();

    for (var oi = 1; oi < outRows.length; oi++) {
      var row = outRows[oi];
      if (String(row[0] || '').toLowerCase() !== sid) continue;
      var dateVal = row[1];
      var dateStr;
      if (dateVal instanceof Date) {
        var y = dateVal.getFullYear(), m = dateVal.getMonth() + 1, d = dateVal.getDate();
        dateStr = y + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d);
      } else {
        dateStr = String(dateVal || '').trim();
      }
      const timeStr = formatOutingTimeFromSheet(row[2]);
      const courseName = String(row[3] || '').trim();
      if (!dateStr || !timeStr || !courseName) continue;
      outings.push({
        date: dateStr,
        time: timeStr,
        courseName: courseName,
        comps: String(row[4] || '').trim()
      });
    }
    outings.sort(function(a, b) {
      var dateA = new Date(a.date + (a.time ? 'T' + a.time : ''));
      var dateB = new Date(b.date + (b.time ? 'T' + b.time : ''));
      return dateA - dateB;
    });

    // Unique course names from outings (normalized for matching)
    var outingCourseNorms = {};
    for (var i = 0; i < outings.length; i++) {
      var cn = (outings[i].courseName || '').trim();
      if (!cn) continue;
      var norm = cn.toLowerCase().replace(/\s+/g, '');
      if (norm) outingCourseNorms[norm] = cn;
    }

    // Courses: only those that appear in outings
    var courses = [];
    var coursesSheet = getCoursesSheet();
    var cRows = coursesSheet.getDataRange().getValues();
    if (cRows.length >= 2) {
      var headers = cRows[0].map(function(h) { return String(h || '').trim(); });
      var colCourseName = headers.indexOf('CourseName') >= 0 ? headers.indexOf('CourseName') : 0;
      var colParIndx = headers.indexOf('ParIndx') >= 0 ? headers.indexOf('ParIndx') : 1;
      var colCourseURL = headers.indexOf('CourseURL') >= 0 ? headers.indexOf('CourseURL') : 2;
      var colCourseMaploc = headers.indexOf('CourseMaploc') >= 0 ? headers.indexOf('CourseMaploc') : 3;
      var colClubName = headers.indexOf('ClubName') >= 0 ? headers.indexOf('ClubName') : 4;
      var colCourseImage = headers.indexOf('CourseImage') >= 0 ? headers.indexOf('CourseImage') : -1;

      for (var ci = 1; ci < cRows.length; ci++) {
        var crow = cRows[ci];
        var cName = String(crow[colCourseName] || '').trim();
        if (!cName) continue;
        var cNorm = cName.toLowerCase().replace(/\s+/g, '');
        if (!outingCourseNorms.hasOwnProperty(cNorm)) continue;
        var course = {
          courseName: cName,
          parIndx: String(crow[colParIndx] || '').trim(),
          courseURL: String(crow[colCourseURL] || '').trim(),
          courseMaploc: String(crow[colCourseMaploc] || '').trim(),
          clubName: String(crow[colClubName] || '').trim()
        };
        if (colCourseImage >= 0) course.courseImage = String(crow[colCourseImage] || '').trim();
        courses.push(course);
      }
    }

    // Players
    var players = [];
    var playersSheet = getPlayersSheet();
    var pRows = playersSheet.getDataRange().getValues();
    for (var pi = 1; pi < pRows.length; pi++) {
      var prow = pRows[pi];
      if (String(prow[0] || '').toLowerCase() !== sid) continue;
      var pName = String(prow[1] || '').trim();
      if (!pName) continue;
      players.push({ playerName: pName, handicap: prow[2] || 0 });
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      outings: outings,
      courses: courses,
      players: players
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/** Check if any scores exist for an outing (societyId + date + time + courseName).
 *  Matches on society + course + date. For time: if both outing and score have a time, they must match;
 *  otherwise a match on date+course is sufficient. normalizeTime handles Date objects, "HH:MM", numeric serials. */
function outingHasScores(societyId, date, time, courseName) {
  const scoresSheet = getScoresSheet();
  const scoresRows = scoresSheet.getDataRange().getValues();
  if (scoresRows.length < 2) return false;
  const h = scoresRows[0].map(function(x) { return String(x || '').trim(); });
  const colSocietyId = 0;
  const colCourse = h.indexOf('CourseName') >= 0 ? h.indexOf('CourseName') : 2;
  const colDate = h.indexOf('Date') >= 0 ? h.indexOf('Date') : 3;
  const colTime = h.indexOf('Time') >= 0 ? h.indexOf('Time') : -1;
  const sid = String(societyId || '').toLowerCase();
  const normDate = normalizeDate(date);
  const normTime = normalizeTime(time || '');
  const normCourse = String(courseName || '').trim().toLowerCase();
  for (let i = 1; i < scoresRows.length; i++) {
    const row = scoresRows[i];
    if (String(row[colSocietyId] || '').toLowerCase() !== sid) continue;
    const rowCourse = String(row[colCourse] || '').trim().toLowerCase();
    const rowDate = normalizeDate(row[colDate]);
    if (rowDate !== normDate || rowCourse !== normCourse) continue;
    const rowTime = colTime >= 0 ? normalizeTime(row[colTime]) : '';
    if (normTime && rowTime && rowTime !== normTime) continue;
    return true;
  }
  return false;
}

function saveOuting(societyId, data) {
  try {
    const sheet = getOutingsSheet();
    const date = String(data.date || '').trim();
    
    if (!date) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Date is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const courseName = String(data.courseName || '').trim();
    if (!courseName) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'CourseName is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const timeStr = String(data.time || '').trim();
    if (!timeStr) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Time is required for outings (PK: Course/Date/Time)'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const newRow = [
      societyId,
      date,
      timeStr,
      courseName,
      String(data.comps || '').trim()
    ];
    
    const sid = String(societyId || '').toLowerCase();
    const originalDate = String(data.originalDate || '').trim();
    const originalTime = String(data.originalTime || '').trim();
    const originalCourse = String(data.originalCourseName || '').trim();
    const isEdit = !!(originalDate && originalCourse);

    if (isEdit) {
      // Editing existing outing: find by ORIGINAL values
      const hasScores = outingHasScores(societyId, originalDate, originalTime, originalCourse);
      const dateChanged = normalizeDate(date) !== normalizeDate(originalDate);
      const timeChanged = normalizeTime(timeStr) !== normalizeTime(originalTime);
      const courseChanged = courseName.toLowerCase() !== originalCourse.toLowerCase();
      if (hasScores && (dateChanged || timeChanged || courseChanged)) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: 'Cannot change course, date, or time: scores have already been recorded for this outing.'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    const rows = sheet.getDataRange().getValues();
    const dateNorm = normalizeDate(date);
    const timeNorm = normalizeTime(timeStr);
    const searchDate = isEdit ? normalizeDate(originalDate) : dateNorm;
    const searchTime = isEdit ? normalizeTime(originalTime) : timeNorm;
    const searchCourse = isEdit ? originalCourse.toLowerCase() : courseName.toLowerCase();
    
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').toLowerCase() !== sid) continue;
      const rowDate = formatOutingDateFromSheet(rows[i][1]);
      const rowTime = formatOutingTimeFromSheet(rows[i][2]);
      const rowCourse = String(rows[i][3] || '').trim().toLowerCase();
      const dateMatch = rowDate === searchDate;
      const timeMatch = !searchTime || rowTime === searchTime;
      if (dateMatch && timeMatch && rowCourse === searchCourse) {
        sheet.getRange(i + 1, 1, 1, 5).setValues([newRow]);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: 'Outing updated successfully'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    sheet.appendRow(newRow);
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Outing saved successfully'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function deleteOuting(societyId, data) {
  try {
    const date = String(data.date || '').trim();
    const time = String(data.time || '').trim();
    const courseName = String(data.courseName || '').trim().toLowerCase();
    
    if (!date) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Date is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const normDate = normalizeDate(date);
    const normTime = normalizeTime(time);
    const sid = String(societyId || '').toLowerCase();
    
    // Block delete if any scores exist for this outing (date + time + course)
    const scoresSheet = getScoresSheet();
    const scoresRows = scoresSheet.getDataRange().getValues();
    if (scoresRows.length >= 1) {
      const h = scoresRows[0].map(function(x) { return String(x || '').trim(); });
      const colSocietyId = 0;
      const colPlayerName = h.indexOf('PlayerName') >= 0 ? h.indexOf('PlayerName') : 1;
      const colCourse = h.indexOf('CourseName') >= 0 ? h.indexOf('CourseName') : 2;
      const colDate = h.indexOf('Date') >= 0 ? h.indexOf('Date') : 3;
      const colTime = h.indexOf('Time') >= 0 ? h.indexOf('Time') : -1;
      for (let i = 1; i < scoresRows.length; i++) {
        const row = scoresRows[i];
        if (String(row[colSocietyId] || '').toLowerCase() !== sid) continue;
        const rowCourse = String(row[colCourse] || '').trim().toLowerCase();
        const rowDate = normalizeDate(row[colDate]);
        if (rowDate !== normDate || rowCourse !== courseName) continue;
        const rowTime = colTime >= 0 ? normalizeTime(row[colTime]) : '';
        if (normTime && rowTime && rowTime !== normTime) continue;
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: 'Cannot delete outing: one or more scores exist for this outing. Delete the scores first.'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    const sheet = getOutingsSheet();
    const rows = sheet.getDataRange().getValues();
    
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').toLowerCase() !== sid) continue;
      const rowDate = formatOutingDateFromSheet(rows[i][1]);
      const rowTime = formatOutingTimeFromSheet(rows[i][2]);
      const rowCourse = String(rows[i][3] || '').trim().toLowerCase();
      const dateMatch = rowDate === normDate && (!courseName || rowCourse === courseName);
      const timeMatch = !normTime || rowTime === normTime;
      if (dateMatch && timeMatch) {
        sheet.deleteRow(i + 1);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: 'Outing deleted successfully'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Outing not found'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// SCORES MANAGEMENT (adapted from BGS)
// ============================================

function normalizeName(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/\s+/g, '');
}

/** Normalize time to HH:MM for comparison. Handles Date objects, "HH:MM", "HH:MM:SS", numeric serial (0.4375 = 10:30), or string that is a number (e.g. "0.41666"). */
function normalizeTime(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    const h = value.getHours(), m = value.getMinutes();
    return (h < 10 ? '0' + h : '' + h) + ':' + (m < 10 ? '0' + m : '' + m);
  }
  // Google Sheets time serial: fraction of day (0.4375 = 10:30), or string that parses as number
  const num = typeof value === 'number' ? value : (typeof value === 'string' && /^-?\d*\.?\d+$/.test(value.trim()) ? parseFloat(value) : NaN);
  if (!isNaN(num)) {
    const frac = num >= 1 ? num % 1 : (num < 0 ? 0 : num);
    const totalMins = Math.round(frac * 24 * 60) % (24 * 60);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  const str = String(value).trim();
  const m = str.match(/(\d{1,2}):(\d{2})/);
  return m ? (parseInt(m[1], 10) < 10 && m[1].length === 1 ? '0' : '') + m[1] + ':' + m[2] : str;
}

function normalizeDate(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    // Use local date components so sheet dates (stored as midnight local) match frontend YYYY-MM-DD
    var y = value.getFullYear(), m = value.getMonth() + 1, d = value.getDate();
    return y + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d);
  }
  let str = String(value).trim();
  str = str.replace(/\+/g, ' ');
  const parsedDate = new Date(str);
  if (!isNaN(parsedDate.getTime())) {
    var y = parsedDate.getFullYear(), m = parsedDate.getMonth() + 1, d = parsedDate.getDate();
    return y + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d);
  }
  if (str.includes('T') && str.length > 10) {
    return str.split('T')[0];
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  return str;
}

function saveScore(societyId, data) {
  try {
    const sheet = getScoresSheet();
    const rows = sheet.getDataRange().getValues();
    const h = rows.length >= 1 ? rows[0].map(function(x) { return String(x || '').trim(); }) : [];
    const colDate = h.indexOf('Date') >= 0 ? h.indexOf('Date') : 3;
    const colTime = h.indexOf('Time') >= 0 ? h.indexOf('Time') : 4;
    const playerName = String(data.playerName || '').trim();
    const course = String(data.course || '').trim();
    if (!playerName || !course) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'PlayerName and Course are required for scores (PK: Player/Course/Date/Time)'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const date = String(data.date || '').trim();
    const timeRaw = String(data.time || '').trim();
    if (!date || !timeRaw) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Date and Time are required for scores (PK: Player/Course/Date/Time)'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const normalizedPlayerName = normalizeName(playerName);
    const sid = String(societyId || '').toLowerCase();
    const normDate = normalizeDate(date);
    const normTime = normalizeTime(timeRaw);
    const scoreDate = date;
    const scoreTime = normTime || timeRaw;

    // Match on full PK: player + course + date + time
    let existingRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').toLowerCase() !== sid) continue;
      const rowPlayerName = String(rows[i][1] || '').trim();
      const rowCourse = String(rows[i][2] || '').trim();
      if (normalizeName(rowPlayerName) !== normalizedPlayerName || rowCourse.toLowerCase() !== course.toLowerCase()) continue;
      const rowDate = normalizeDate(rows[i][colDate]);
      const rowTime = colTime >= 0 ? normalizeTime(rows[i][colTime]) : '';
      if (rowDate !== normDate || rowTime !== normTime) continue;
      existingRowIndex = i + 1;
      break;
    }
    
    const holePoints = data.holePoints || [];
    const scoreRow = [
      societyId,
      data.playerName || '',
      data.course || '',
      scoreDate,
      scoreTime,
      data.handicap || 0,
      data.holes[0] || '', data.holes[1] || '', data.holes[2] || '', data.holes[3] || '',
      data.holes[4] || '', data.holes[5] || '', data.holes[6] || '', data.holes[7] || '',
      data.holes[8] || '', data.holes[9] || '', data.holes[10] || '', data.holes[11] || '',
      data.holes[12] || '', data.holes[13] || '', data.holes[14] || '', data.holes[15] || '',
      data.holes[16] || '', data.holes[17] || '',
      holePoints[0] || 0, holePoints[1] || 0, holePoints[2] || 0, holePoints[3] || 0,
      holePoints[4] || 0, holePoints[5] || 0, holePoints[6] || 0, holePoints[7] || 0,
      holePoints[8] || 0, holePoints[9] || 0, holePoints[10] || 0, holePoints[11] || 0,
      holePoints[12] || 0, holePoints[13] || 0, holePoints[14] || 0, holePoints[15] || 0,
      holePoints[16] || 0, holePoints[17] || 0,
      data.totalScore || 0, data.totalPoints || 0,
      data.outScore || 0, data.outPoints || 0, data.inScore || 0, data.inPoints || 0,
      data.back6Score || 0, data.back6Points || 0, data.back3Score || 0, data.back3Points || 0,
      new Date().toISOString()
    ];
    
    if (existingRowIndex > 0) {
      sheet.getRange(existingRowIndex, 1, 1, scoreRow.length).setValues([scoreRow]);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Score updated successfully'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    sheet.appendRow(scoreRow);
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Score saved successfully'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function loadScores(data) {
  try {
    const societyId = data.societyId || '';
    if (!societyId) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'societyId is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const sheet = getScoresSheet();
    const rows = sheet.getDataRange().getValues();
    const scores = [];
    const sid = String(societyId).toLowerCase();
    const hasTimeCol = rows.length >= 1 && rows[0].some(function(h) { return String(h || '').trim() === 'Time'; });
    const o = hasTimeCol ? 1 : 0;
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (String(row[0] || '').toLowerCase() !== sid) continue;
      const rowPlayerName = String(row[1] || '').trim();
      if (!rowPlayerName) continue;
      
      if (data.playerName && normalizeName(rowPlayerName) !== normalizeName(data.playerName)) continue;
      if (data.course && String(row[2] || '').trim() !== data.course) continue;
      
      let timestamp = row[51 + o] || '';
      if (timestamp instanceof Date) timestamp = timestamp.toISOString();
      else if (timestamp) timestamp = String(timestamp);
      
      let date = row[3] || '';
      if (date instanceof Date) date = date.toISOString().split('T')[0];
      else if (date) {
        const str = String(date);
        date = str.includes('T') && str.length > 10 ? str.split('T')[0] : str;
      }
      
      scores.push({
        playerName: rowPlayerName,
        course: String(row[2] || '').trim(),
        date: date,
        handicap: row[4 + o] || 0,
        holes: [row[5 + o] || '', row[6 + o] || '', row[7 + o] || '', row[8 + o] || '', row[9 + o] || '', row[10 + o] || '', row[11 + o] || '', row[12 + o] || '', row[13 + o] || '', row[14 + o] || '', row[15 + o] || '', row[16 + o] || '', row[17 + o] || '', row[18 + o] || '', row[19 + o] || '', row[20 + o] || '', row[21 + o] || '', row[22 + o] || ''],
        holePoints: [row[23 + o] || 0, row[24 + o] || 0, row[25 + o] || 0, row[26 + o] || 0, row[27 + o] || 0, row[28 + o] || 0, row[29 + o] || 0, row[30 + o] || 0, row[31 + o] || 0, row[32 + o] || 0, row[33 + o] || 0, row[34 + o] || 0, row[35 + o] || 0, row[36 + o] || 0, row[37 + o] || 0, row[38 + o] || 0, row[39 + o] || 0, row[40 + o] || 0],
        totalScore: row[41 + o] || 0,
        totalPoints: row[42 + o] || 0,
        outScore: row[43 + o] || 0,
        outPoints: row[44 + o] || 0,
        inScore: row[45 + o] || 0,
        inPoints: row[46 + o] || 0,
        back6Score: row[47 + o] || 0,
        back6Points: row[48 + o] || 0,
        back3Score: row[49 + o] || 0,
        back3Points: row[50 + o] || 0,
        timestamp: timestamp
      });
    }
    
    scores.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const limit = data.limit || 50;
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      scores: scores.slice(0, limit)
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function checkExistingScore(societyId, data) {
  try {
    // PK for scores is Player + Course + Date + Time; all must be present
    const playerName = String(data.playerName || '').trim();
    const course = String(data.course || '').trim();
    const searchDate = String(data.date || '').trim();
    const searchTime = String(data.time || '').trim();
    if (!playerName || !course || !searchDate || !searchTime) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        exists: false
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = getScoresSheet();
    const rows = sheet.getDataRange().getValues();
    const h = rows.length >= 1 ? rows[0].map(function(x) { return String(x || '').trim(); }) : [];
    const hasTimeCol = h.indexOf('Time') >= 0;
    const o = hasTimeCol ? 1 : 0;
    const colDate = h.indexOf('Date') >= 0 ? h.indexOf('Date') : 3;
    const colTime = h.indexOf('Time') >= 0 ? h.indexOf('Time') : -1;
    const courseLower = course.toLowerCase();
    const normDate = normalizeDate(searchDate);
    const normTime = normalizeTime(searchTime);
    const normalizedPlayerName = normalizeName(playerName);
    const sid = String(societyId || '').toLowerCase();
    let bestRow = null;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (String(row[0] || '').toLowerCase() !== sid) continue;
      const rowPlayerName = String(row[1] || '').trim();
      const rowCourse = String(row[2] || '').trim();
      if (normalizeName(rowPlayerName) !== normalizedPlayerName || rowCourse.toLowerCase() !== courseLower) continue;
      const rowDate = normalizeDate(row[colDate]);
      const rowTime = colTime >= 0 ? normalizeTime(row[colTime]) : '';
      if (rowDate !== normDate) continue;
      if (rowTime !== normTime) continue;
      bestRow = row;
      break;
    }
    if (bestRow) {
      const row = bestRow;
      let timestamp = row[51 + o] || '';
      if (timestamp instanceof Date) timestamp = timestamp.toISOString();
      else if (timestamp) timestamp = String(timestamp);
      let dateValue = row[3] || '';
      if (dateValue instanceof Date) dateValue = dateValue.toISOString().split('T')[0];
      else if (dateValue) dateValue = String(dateValue).includes('T') ? String(dateValue).split('T')[0] : String(dateValue);
      const score = {
        playerName: String(row[1] || '').trim(),
        course: String(row[2] || '').trim(),
        date: dateValue,
        handicap: row[4 + o] || 0,
        holes: [row[5 + o] || '', row[6 + o] || '', row[7 + o] || '', row[8 + o] || '', row[9 + o] || '', row[10 + o] || '', row[11 + o] || '', row[12 + o] || '', row[13 + o] || '', row[14 + o] || '', row[15 + o] || '', row[16 + o] || '', row[17 + o] || '', row[18 + o] || '', row[19 + o] || '', row[20 + o] || '', row[21 + o] || '', row[22 + o] || ''],
        holePoints: [row[23 + o] || 0, row[24 + o] || 0, row[25 + o] || 0, row[26 + o] || 0, row[27 + o] || 0, row[28 + o] || 0, row[29 + o] || 0, row[30 + o] || 0, row[31 + o] || 0, row[32 + o] || 0, row[33 + o] || 0, row[34 + o] || 0, row[35 + o] || 0, row[36 + o] || 0, row[37 + o] || 0, row[38 + o] || 0, row[39 + o] || 0, row[40 + o] || 0],
        totalScore: row[41 + o] || 0, totalPoints: row[42 + o] || 0,
        outScore: row[43 + o] || 0, outPoints: row[44 + o] || 0, inScore: row[45 + o] || 0, inPoints: row[46 + o] || 0,
        back6Score: row[47 + o] || 0, back6Points: row[48 + o] || 0, back3Score: row[49 + o] || 0, back3Points: row[50 + o] || 0,
        timestamp: timestamp
      };
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        exists: true,
        score: score
      })).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      exists: false
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function deleteScore(societyId, data) {
  try {
    const sheet = getScoresSheet();
    const rows = sheet.getDataRange().getValues();
    const hasTimeCol = rows.length >= 1 && rows[0].some(function(h) { return String(h || '').trim() === 'Time'; });
    const o = hasTimeCol ? 1 : 0;
    const searchPlayerName = String(data.playerName || '').trim();
    const searchCourse = String(data.course || '').trim();
    const searchDate = normalizeDate(data.date || '');
    const searchTimestamp = String(data.timestamp || '').trim();
    const sid = String(societyId || '').toLowerCase();
    
    for (let i = rows.length - 1; i >= 1; i--) {
      const row = rows[i];
      if (String(row[0] || '').toLowerCase() !== sid) continue;
      const rowPlayerName = String(row[1] || '').trim();
      const rowCourse = String(row[2] || '').trim();
      const rowDate = normalizeDate(row[3] || '');
      const rowTimestamp = String(row[51 + o] || '').trim();
      if (rowPlayerName === searchPlayerName && rowCourse === searchCourse && rowDate === searchDate &&
          (!searchTimestamp || rowTimestamp === searchTimestamp)) {
        sheet.deleteRow(i + 1);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: 'Score deleted successfully'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Score not found'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  return sheet;
}
