/**
 * Multi-Tenant Golf App Backend - Google Apps Script
 * Handles all societies in a single master Google Sheet
 *
 * Sheet Structure:
 * - Societies: Master registry (SocietyID, SocietyName, ContactPerson, NumberOfPlayers, NumberOfCourses, Status, CreatedDate, NextOuting, CaptainsNotes)
 * - Players: SocietyID, PlayerName, Handicap (all societies)
 * - Courses: CourseName, ParIndx, CourseURL, CourseMaploc, ClubName (independent of societies)
 * - Outings: SocietyID, Date, Time, CourseName, Notes (all societies)
 * - Scores: SocietyID, Player Name, Course, Date, Handicap, Hole1..18, Points1..18, totals, Timestamp (all societies)
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
    
    // Course actions (independent of society)
    if (action === 'saveCourse' || action === 'updateCourse') {
      return saveCourse(societyId, requestData.data);
    } else if (action === 'deleteCourse') {
      return deleteCourse(societyId, requestData.data);
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
    const colNumberOfCourses = headers.indexOf('NumberOfCourses');
    const colStatus = headers.indexOf('Status');
    const colCreatedDate = headers.indexOf('CreatedDate');
    const colNextOuting = headers.indexOf('NextOuting');
    const colCaptainsNotes = headers.indexOf('CaptainsNotes');
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const status = colStatus >= 0 ? String(row[colStatus] || '').trim() : 'Active';
      societies.push({
        societyId: colSocietyId >= 0 ? String(row[colSocietyId] || '').trim() : '',
        societyName: colSocietyName >= 0 ? String(row[colSocietyName] || '').trim() : '',
        contactPerson: colContactPerson >= 0 ? String(row[colContactPerson] || '').trim() : '',
        numberOfPlayers: colNumberOfPlayers >= 0 ? (row[colNumberOfPlayers] || 0) : 0,
        numberOfCourses: colNumberOfCourses >= 0 ? (row[colNumberOfCourses] || 0) : 0,
        status: status || 'Active',
        createdDate: colCreatedDate >= 0 ? String(row[colCreatedDate] || '') : '',
        nextOuting: colNextOuting >= 0 ? String(row[colNextOuting] || '').trim() : '',
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
    const colNumberOfCourses = headers.indexOf('NumberOfCourses');
    const colStatus = headers.indexOf('Status');
    const colCreatedDate = headers.indexOf('CreatedDate');
    const colNextOuting = headers.indexOf('NextOuting');
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
            numberOfCourses: colNumberOfCourses >= 0 ? (row[colNumberOfCourses] || 0) : 0,
            status: colStatus >= 0 ? String(row[colStatus] || '').trim() : 'Active',
            createdDate: colCreatedDate >= 0 ? String(row[colCreatedDate] || '') : '',
            nextOuting: colNextOuting >= 0 ? String(row[colNextOuting] || '').trim() : '',
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
      const headers = ['SocietyID', 'SocietyName', 'ContactPerson', 'NumberOfPlayers', 'NumberOfCourses', 'Status', 'CreatedDate', 'NextOuting', 'CaptainsNotes'];
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
    
    // Add row to Societies sheet (match column order: SocietyID, SocietyName, ContactPerson, NumberOfPlayers, NumberOfCourses, Status, CreatedDate, NextOuting, CaptainsNotes)
    const newRow = [
      societyId,
      String(data.societyName || '').trim(),
      String(data.contactPerson || '').trim(),
      parseInt(data.numberOfPlayers || 0),
      parseInt(data.numberOfCourses || 0),
      'Active',
      new Date().toISOString().split('T')[0],
      String(data.nextOuting || '').trim(),
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
        if (data.numberOfCourses !== undefined) {
          const colNumberOfCourses = headers.indexOf('NumberOfCourses');
          if (colNumberOfCourses >= 0) sheet.getRange(rowIndex, colNumberOfCourses + 1).setValue(data.numberOfCourses);
        }
        if (data.status !== undefined) {
          const colStatus = headers.indexOf('Status');
          if (colStatus >= 0) sheet.getRange(rowIndex, colStatus + 1).setValue(data.status);
        }
        if (data.nextOuting !== undefined) {
          const colNextOuting = headers.indexOf('NextOuting');
          if (colNextOuting >= 0) sheet.getRange(rowIndex, colNextOuting + 1).setValue(data.nextOuting);
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
    sheet.appendRow(['CourseName', 'ParIndx', 'CourseURL', 'CourseMaploc', 'ClubName']);
  }
  return sheet;
}

function getOutingsSheet() {
  const sheet = getOrCreateSheet('Outings');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['SocietyID', 'Date', 'Time', 'CourseName', 'Notes']);
  }
  return sheet;
}

function getScoresSheet() {
  const sheet = getOrCreateSheet('Scores');
  if (sheet.getLastRow() === 0) {
    const headers = [
      'SocietyID', 'Player Name', 'Course', 'Date', 'Handicap',
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
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const courseName = String(row[0] || '').trim();
      if (!courseName) continue;
      
      courses.push({
        courseName: courseName,
        parIndx: String(row[1] || '').trim(),
        courseURL: String(row[2] || '').trim(),
        courseMaploc: String(row[3] || '').trim(),
        clubName: String(row[4] || '').trim()
      });
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
      String(data.clubName || '').trim()
    ];
    
    const rows = sheet.getDataRange().getValues();
    
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').trim().toLowerCase() === courseName.toLowerCase()) {
        sheet.getRange(i + 1, 1, 1, 5).setValues([newRow]);
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

function getOutings(societyId) {
  try {
    const sheet = getOutingsSheet();
    const rows = sheet.getDataRange().getValues();
    const outings = [];
    const sid = String(societyId || '').toLowerCase();
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (String(row[0] || '').toLowerCase() !== sid) continue;
      const date = String(row[1] || '').trim();
      if (!date) continue;
      outings.push({
        date: date,
        time: String(row[2] || '').trim(),
        courseName: String(row[3] || '').trim(),
        notes: String(row[4] || '').trim()
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
    
    const newRow = [
      societyId,
      date,
      String(data.time || '').trim(),
      courseName,
      String(data.notes || '').trim()
    ];
    
    const rows = sheet.getDataRange().getValues();
    const sid = String(societyId || '').toLowerCase();
    
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').toLowerCase() !== sid) continue;
      const rowDate = String(rows[i][1] || '').trim();
      const rowCourse = String(rows[i][3] || '').trim().toLowerCase();
      if (rowDate === date && rowCourse === courseName.toLowerCase()) {
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
    const sheet = getOutingsSheet();
    const date = String(data.date || '').trim();
    const courseName = String(data.courseName || '').trim().toLowerCase();
    
    if (!date) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Date is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const rows = sheet.getDataRange().getValues();
    const sid = String(societyId || '').toLowerCase();
    
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').toLowerCase() !== sid) continue;
      const rowDate = String(rows[i][1] || '').trim();
      const rowCourse = String(rows[i][3] || '').trim().toLowerCase();
      if (rowDate === date && (!courseName || rowCourse === courseName)) {
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

function normalizeDate(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  let str = String(value).trim();
  str = str.replace(/\+/g, ' ');
  const parsedDate = new Date(str);
  if (!isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString().split('T')[0];
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
    const playerName = String(data.playerName || '').trim();
    const course = String(data.course || '').trim();
    const date = String(data.date || new Date().toISOString().split('T')[0]).trim();
    const normalizedPlayerName = normalizeName(playerName);
    const sid = String(societyId || '').toLowerCase();
    
    let existingRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').toLowerCase() !== sid) continue;
      const rowPlayerName = String(rows[i][1] || '').trim();
      const rowCourse = String(rows[i][2] || '').trim();
      const rowDate = normalizeDate(rows[i][3] || '');
      if (normalizeName(rowPlayerName) === normalizedPlayerName && rowCourse === course && rowDate === date) {
        existingRowIndex = i + 1;
        break;
      }
    }
    
    const holePoints = data.holePoints || [];
    const scoreRow = [
      societyId,
      data.playerName || '',
      data.course || '',
      data.date || new Date().toISOString().split('T')[0],
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
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (String(row[0] || '').toLowerCase() !== sid) continue;
      const rowPlayerName = String(row[1] || '').trim();
      if (!rowPlayerName) continue;
      
      if (data.playerName && normalizeName(rowPlayerName) !== normalizeName(data.playerName)) continue;
      if (data.course && String(row[2] || '').trim() !== data.course) continue;
      
      let timestamp = row[51] || '';
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
        handicap: row[4] || 0,
        holes: [row[5] || '', row[6] || '', row[7] || '', row[8] || '', row[9] || '', row[10] || '', row[11] || '', row[12] || '', row[13] || '', row[14] || '', row[15] || '', row[16] || '', row[17] || '', row[18] || '', row[19] || '', row[20] || '', row[21] || '', row[22] || ''],
        holePoints: [row[23] || 0, row[24] || 0, row[25] || 0, row[26] || 0, row[27] || 0, row[28] || 0, row[29] || 0, row[30] || 0, row[31] || 0, row[32] || 0, row[33] || 0, row[34] || 0, row[35] || 0, row[36] || 0, row[37] || 0, row[38] || 0, row[39] || 0, row[40] || 0],
        totalScore: row[41] || 0,
        totalPoints: row[42] || 0,
        outScore: row[43] || 0,
        outPoints: row[44] || 0,
        inScore: row[45] || 0,
        inPoints: row[46] || 0,
        back6Score: row[47] || 0,
        back6Points: row[48] || 0,
        back3Score: row[49] || 0,
        back3Points: row[50] || 0,
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
    const sheet = getScoresSheet();
    const rows = sheet.getDataRange().getValues();
    const playerName = String(data.playerName || '').trim();
    const course = String(data.course || '').trim();
    const date = String(data.date || new Date().toISOString().split('T')[0]).trim();
    const normalizedPlayerName = normalizeName(playerName);
    const sid = String(societyId || '').toLowerCase();
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (String(row[0] || '').toLowerCase() !== sid) continue;
      const rowPlayerName = String(row[1] || '').trim();
      const rowCourse = String(row[2] || '').trim();
      const rowDate = normalizeDate(row[3] || '');
      if (normalizeName(rowPlayerName) !== normalizedPlayerName || rowCourse !== course || rowDate !== date) continue;
      
      let timestamp = row[51] || '';
      if (timestamp instanceof Date) timestamp = timestamp.toISOString();
      else if (timestamp) timestamp = String(timestamp);
      let dateValue = row[3] || '';
      if (dateValue instanceof Date) dateValue = dateValue.toISOString().split('T')[0];
      else if (dateValue) dateValue = String(dateValue).includes('T') ? String(dateValue).split('T')[0] : String(dateValue);
      
      const score = {
        playerName: rowPlayerName,
        course: rowCourse,
        date: dateValue,
        handicap: row[4] || 0,
        holes: [row[5] || '', row[6] || '', row[7] || '', row[8] || '', row[9] || '', row[10] || '', row[11] || '', row[12] || '', row[13] || '', row[14] || '', row[15] || '', row[16] || '', row[17] || '', row[18] || '', row[19] || '', row[20] || '', row[21] || '', row[22] || ''],
        holePoints: [row[23] || 0, row[24] || 0, row[25] || 0, row[26] || 0, row[27] || 0, row[28] || 0, row[29] || 0, row[30] || 0, row[31] || 0, row[32] || 0, row[33] || 0, row[34] || 0, row[35] || 0, row[36] || 0, row[37] || 0, row[38] || 0, row[39] || 0, row[40] || 0],
        totalScore: row[41] || 0, totalPoints: row[42] || 0,
        outScore: row[43] || 0, outPoints: row[44] || 0, inScore: row[45] || 0, inPoints: row[46] || 0,
        back6Score: row[47] || 0, back6Points: row[48] || 0, back3Score: row[49] || 0, back3Points: row[50] || 0,
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
      const rowTimestamp = String(row[51] || '').trim();
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
