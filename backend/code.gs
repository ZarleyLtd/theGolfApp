/**
 * Multi-Tenant Golf App Backend - Google Apps Script
 * Handles all societies in a single master Google Sheet
 *
 * Sheet Structure:
 * - Societies: Master registry (SocietyID, SocietyName, ContactPerson, NumberOfPlayers, NumberOfOutings, Status, CreatedDate, CaptainsNotes)
 * - Players: SocietyID, PlayerId, PlayerName, Handicap (all societies)
 * - Courses: CourseName, ParIndx, CourseURL, CourseMaploc, ClubName (independent of societies)
 * - Outings: SocietyID, OutingId, Date, Time, CourseName, Comps (all societies)
 * - Scores: SocietyID, OutingId, PlayerId, Handicap, Hole1..18, Points1..18, totals, Timestamp (all societies)
 * - Teams: SocietyID, OutingId, TeamId, TeamName
 * - TeamMembers: SocietyID, OutingId, PlayerId, TeamId
 *
 * All requests must include societyId parameter (except master admin actions and Courses operations)
 */

const AI_MODEL_CONFIG = {
  COURSE_LOOKUP_DEFAULT: 'gemma-3-27b-it',
  SCORECARD_IMAGE_DEFAULT: 'gemini-2.5-flash'
};

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
    if (action === 'backfillPlayerAndOutingIds') {
      return backfillPlayerAndOutingIds();
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
          outingId: e.parameter.outingId || '',
          playerId: e.parameter.playerId || '',
          playerName: e.parameter.playerName || '',
          course: e.parameter.course || '',
          limit: parseInt(e.parameter.limit || '50')
        });
      case 'getOutingTeams':
        return getOutingTeams(societyId, {
          outingId: e.parameter.outingId || '',
          courseName: e.parameter.courseName || '',
          date: e.parameter.date || '',
          time: e.parameter.time || ''
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
    if (action === 'lookupCourseWithAi') {
      return lookupCourseWithAi(requestData.societyId || '', requestData.data || {});
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
    } else if (action === 'analyzeScorecardImage') {
      return analyzeScorecardImage(societyId, requestData.data || {});
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
    } else if (action === 'saveOutingTeams') {
      return saveOutingTeams(societyId, requestData.data);
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

/** Generate a short random ID with prefix (e.g. p_abc12xyz, o_def34uvw). */
function generateId(prefix) {
  return (prefix || '') + '_' + Math.random().toString(36).slice(2, 11);
}

function getPlayersSheet() {
  const sheet = getOrCreateSheet('Players');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['SocietyID', 'PlayerId', 'PlayerName', 'Handicap']);
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
    sheet.appendRow(['SocietyID', 'OutingId', 'Date', 'Time', 'CourseName', 'Comps']);
  }
  return sheet;
}

function getTeamsSheet() {
  const sheet = getOrCreateSheet('Teams');
  const requiredHeaders = ['SocietyID', 'OutingId', 'TeamId', 'TeamName'];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(requiredHeaders);
    return sheet;
  }
  var numCols = Math.max(sheet.getLastColumn(), 4);
  var row1 = sheet.getRange(1, 1, 1, numCols).getValues()[0] || [];
  var headers = row1.map(function(h) { return String(h || '').trim(); });
  if (headers.indexOf('OutingId') < 0) {
    sheet.getRange(1, 1, 1, 4).setValues([requiredHeaders]);
  }
  return sheet;
}

function getTeamMembersSheet() {
  const sheet = getOrCreateSheet('TeamMembers');
  const requiredHeaders = ['SocietyID', 'OutingId', 'PlayerId', 'TeamId'];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(requiredHeaders);
    return sheet;
  }
  var numCols = Math.max(sheet.getLastColumn(), 4);
  var row1 = sheet.getRange(1, 1, 1, numCols).getValues()[0] || [];
  var headers = row1.map(function(h) { return String(h || '').trim(); });
  var hasOutingId = headers.indexOf('OutingId') >= 0;
  var hasPlayerId = headers.indexOf('PlayerId') >= 0;
  if (!hasOutingId || !hasPlayerId) {
    sheet.getRange(1, 1, 1, 4).setValues([requiredHeaders]);
  }
  return sheet;
}

function getScoresSheet() {
  const sheet = getOrCreateSheet('Scores');
  if (sheet.getLastRow() === 0) {
    const headers = [
      'SocietyID', 'OutingId', 'PlayerId', 'Handicap',
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

/**
 * One-time backfill: add PlayerId/OutingId column if missing and fill empty IDs for existing rows.
 * Run once from Apps Script editor or via GET ?action=backfillPlayerAndOutingIds (no societyId).
 */
function backfillPlayerAndOutingIds() {
  try {
    const playersSheet = getPlayersSheet();
    let pRows = playersSheet.getDataRange().getValues();
    let pH = (pRows[0] || []).map(function(h) { return String(h || '').trim(); });
    let colPlayerId = pH.indexOf('PlayerId');
    if (colPlayerId < 0 && pRows.length > 1) {
      playersSheet.insertColumnBefore(2);
      playersSheet.getRange(1, 2).setValue('PlayerId');
      colPlayerId = 1;
      pRows = playersSheet.getDataRange().getValues();
    }
    for (let i = 1; i < pRows.length; i++) {
      const existingId = colPlayerId >= 0 ? String(pRows[i][colPlayerId] || '').trim() : '';
      if (colPlayerId >= 0 && !existingId) {
        playersSheet.getRange(i + 1, colPlayerId + 1).setValue(generateId('p'));
      }
    }

    const outingsSheet = getOutingsSheet();
    let oRows = outingsSheet.getDataRange().getValues();
    let oH = (oRows[0] || []).map(function(h) { return String(h || '').trim(); });
    let colOutingId = oH.indexOf('OutingId');
    if (colOutingId < 0 && oRows.length > 1) {
      outingsSheet.insertColumnBefore(2);
      outingsSheet.getRange(1, 2).setValue('OutingId');
      colOutingId = 1;
      oRows = outingsSheet.getDataRange().getValues();
    }
    for (let i = 1; i < oRows.length; i++) {
      const existingId = colOutingId >= 0 ? String(oRows[i][colOutingId] || '').trim() : '';
      if (colOutingId >= 0 && !existingId) {
        outingsSheet.getRange(i + 1, colOutingId + 1).setValue(generateId('o'));
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Backfill completed for Players and Outings'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
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
    const headers = (rows[0] || []).map(function(h) { return String(h || '').trim(); });
    const colSid = headers.indexOf('SocietyID') >= 0 ? headers.indexOf('SocietyID') : 0;
    const colPlayerId = headers.indexOf('PlayerId');
    const colName = headers.indexOf('PlayerName') >= 0 ? headers.indexOf('PlayerName') : (colPlayerId >= 0 ? 2 : 1);
    const colHcap = headers.indexOf('Handicap') >= 0 ? headers.indexOf('Handicap') : (colPlayerId >= 0 ? 3 : 2);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (String(row[colSid] || '').toLowerCase() !== sid) continue;
      const playerName = String(row[colName] || '').trim();
      if (!playerName) continue;
      const playerId = colPlayerId >= 0 ? String(row[colPlayerId] || '').trim() : '';
      players.push({
        playerId: playerId || undefined,
        playerName: playerName,
        handicap: row[colHcap] || 0
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
    const headers = (rows[0] || []).map(function(h) { return String(h || '').trim(); });
    const colSid = headers.indexOf('SocietyID') >= 0 ? headers.indexOf('SocietyID') : 0;
    const colPlayerId = headers.indexOf('PlayerId');
    const colName = headers.indexOf('PlayerName') >= 0 ? headers.indexOf('PlayerName') : (colPlayerId >= 0 ? 2 : 1);
    const colHcap = headers.indexOf('Handicap') >= 0 ? headers.indexOf('Handicap') : (colPlayerId >= 0 ? 3 : 2);
    const sid = String(societyId || '').toLowerCase();
    const existingPlayerId = data.playerId ? String(data.playerId || '').trim() : '';

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][colSid] || '').toLowerCase() !== sid) continue;
      const rowId = colPlayerId >= 0 ? String(rows[i][colPlayerId] || '').trim() : '';
      const rowName = String(rows[i][colName] || '').trim();
      const matchById = existingPlayerId && rowId === existingPlayerId;
      const matchByName = rowName.toLowerCase() === playerName.toLowerCase();
      if (matchById || matchByName) {
        const numCols = Math.max(4, colHcap + 1);
        const newRow = [];
        newRow[colSid] = societyId;
        if (colPlayerId >= 0) newRow[colPlayerId] = rowId || existingPlayerId || generateId('p');
        newRow[colName] = playerName;
        newRow[colHcap] = data.handicap != null ? data.handicap : (rows[i][colHcap] || 0);
        const flat = [];
        for (let c = 0; c < numCols; c++) flat.push(newRow[c] !== undefined ? newRow[c] : (rows[i][c] || ''));
        sheet.getRange(i + 1, 1, 1, numCols).setValues([flat]);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: 'Player updated successfully'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    const newPlayerId = generateId('p');
    const appendRow = [societyId, newPlayerId, playerName, data.handicap != null ? data.handicap : 0];
    sheet.appendRow(appendRow);
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
    const playerId = String(data.playerId || '').trim();
    if (!playerId) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'PlayerId is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const sid = String(societyId || '').toLowerCase();

    const scoresSheet = getScoresSheet();
    const scoresRows = scoresSheet.getDataRange().getValues();
    if (scoresRows.length >= 2) {
      const sH = (scoresRows[0] || []).map(function(x) { return String(x || '').trim(); });
      const colSidS = sH.indexOf('SocietyID') >= 0 ? sH.indexOf('SocietyID') : 0;
      const colPlayerIdS = sH.indexOf('PlayerId');
      if (colPlayerIdS >= 0) {
        for (let i = 1; i < scoresRows.length; i++) {
          if (String(scoresRows[i][colSidS] || '').toLowerCase() !== sid) continue;
          if (String(scoresRows[i][colPlayerIdS] || '').trim() === playerId) {
            return ContentService.createTextOutput(JSON.stringify({
              success: false,
              error: 'Cannot delete player: one or more scores exist for this player. Delete the scores first.'
            })).setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
    }

    const sheet = getPlayersSheet();
    const rows = sheet.getDataRange().getValues();
    const headers = (rows[0] || []).map(function(h) { return String(h || '').trim(); });
    const colSid = headers.indexOf('SocietyID') >= 0 ? headers.indexOf('SocietyID') : 0;
    const colPlayerId = headers.indexOf('PlayerId');
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][colSid] || '').toLowerCase() !== sid) continue;
      const rowId = colPlayerId >= 0 ? String(rows[i][colPlayerId] || '').trim() : '';
      if (rowId === playerId) {
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
    const headers = (rows[0] || []).map(function(h) { return String(h || '').trim(); });
    const colSid = headers.indexOf('SocietyID') >= 0 ? headers.indexOf('SocietyID') : 0;
    const colOutingId = headers.indexOf('OutingId');
    const colDate = headers.indexOf('Date') >= 0 ? headers.indexOf('Date') : (colOutingId >= 0 ? 2 : 1);
    const colTime = headers.indexOf('Time') >= 0 ? headers.indexOf('Time') : (colOutingId >= 0 ? 3 : 2);
    const colCourse = headers.indexOf('CourseName') >= 0 ? headers.indexOf('CourseName') : (colOutingId >= 0 ? 4 : 3);
    const colComps = headers.indexOf('Comps') >= 0 ? headers.indexOf('Comps') : (colOutingId >= 0 ? 5 : 4);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (String(row[colSid] || '').toLowerCase() !== sid) continue;
      const dateStr = formatOutingDateFromSheet(row[colDate]);
      const timeStr = formatOutingTimeFromSheet(row[colTime]);
      const courseName = String(row[colCourse] || '').trim();
      if (!dateStr || !timeStr || !courseName) continue;
      const outingId = colOutingId >= 0 ? String(row[colOutingId] || '').trim() : '';
      outings.push({
        outingId: outingId || undefined,
        date: dateStr,
        time: timeStr,
        courseName: courseName,
        comps: String(row[colComps] || '').trim()
      });
    }
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
    const pHeaders = (pRows[0] || []).map(function(h) { return String(h || '').trim(); });
    const colSidP = pHeaders.indexOf('SocietyID') >= 0 ? pHeaders.indexOf('SocietyID') : 0;
    const colPlayerIdP = pHeaders.indexOf('PlayerId');
    const colNameP = pHeaders.indexOf('PlayerName') >= 0 ? pHeaders.indexOf('PlayerName') : (colPlayerIdP >= 0 ? 2 : 1);
    const colHcapP = pHeaders.indexOf('Handicap') >= 0 ? pHeaders.indexOf('Handicap') : (colPlayerIdP >= 0 ? 3 : 2);
    const players = [];
    for (let i = 1; i < pRows.length; i++) {
      const row = pRows[i];
      if (String(row[colSidP] || '').toLowerCase() !== sid) continue;
      const playerName = String(row[colNameP] || '').trim();
      if (!playerName) continue;
      const playerId = colPlayerIdP >= 0 ? String(row[colPlayerIdP] || '').trim() : '';
      players.push({ playerId: playerId || undefined, playerName: playerName, handicap: row[colHcapP] || 0 });
    }

    // Outings
    const outingsSheet = getOutingsSheet();
    const oRows = outingsSheet.getDataRange().getValues();
    const oHeaders = (oRows[0] || []).map(function(h) { return String(h || '').trim(); });
    const colSidO = oHeaders.indexOf('SocietyID') >= 0 ? oHeaders.indexOf('SocietyID') : 0;
    const colOutingIdO = oHeaders.indexOf('OutingId');
    const colDateO = oHeaders.indexOf('Date') >= 0 ? oHeaders.indexOf('Date') : (colOutingIdO >= 0 ? 2 : 1);
    const colTimeO = oHeaders.indexOf('Time') >= 0 ? oHeaders.indexOf('Time') : (colOutingIdO >= 0 ? 3 : 2);
    const colCourseO = oHeaders.indexOf('CourseName') >= 0 ? oHeaders.indexOf('CourseName') : (colOutingIdO >= 0 ? 4 : 3);
    const colCompsO = oHeaders.indexOf('Comps') >= 0 ? oHeaders.indexOf('Comps') : (colOutingIdO >= 0 ? 5 : 4);
    const outings = [];
    for (let i = 1; i < oRows.length; i++) {
      const row = oRows[i];
      if (String(row[colSidO] || '').toLowerCase() !== sid) continue;
      const dateStr = formatOutingDateFromSheet(row[colDateO]);
      if (!dateStr) continue;
      const timeStr = formatOutingTimeFromSheet(row[colTimeO]);
      const courseName = String(row[colCourseO] || '').trim();
      const outingId = colOutingIdO >= 0 ? String(row[colOutingIdO] || '').trim() : '';
      outings.push({
        outingId: outingId || undefined,
        date: dateStr,
        time: timeStr,
        courseName: courseName,
        comps: String(row[colCompsO] || '').trim(),
        hasScores: outingId ? outingHasScores(societyId, outingId) : false
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
    var sid = String(societyId || '').toLowerCase();

    // Build set of outing IDs that have at least one score (one Scores read instead of N+1)
    var outingIdsWithScores = {};
    var scoresSheet = getScoresSheet();
    var scoresRows = scoresSheet.getDataRange().getValues();
    if (scoresRows.length >= 2) {
      var sh = (scoresRows[0] || []).map(function(x) { return String(x || '').trim(); });
      var colSidS = sh.indexOf('SocietyID') >= 0 ? sh.indexOf('SocietyID') : 0;
      var colOutingIdS = sh.indexOf('OutingId');
      if (colOutingIdS >= 0) {
        for (var si = 1; si < scoresRows.length; si++) {
          var srow = scoresRows[si];
          if (String(srow[colSidS] || '').toLowerCase() !== sid) continue;
          var oid = String(srow[colOutingIdS] || '').trim();
          if (oid) outingIdsWithScores[oid] = true;
        }
      }
    }

    var outings = [];
    var outingsSheet = getOutingsSheet();
    var outRows = outingsSheet.getDataRange().getValues();
    var oH = (outRows[0] || []).map(function(h) { return String(h || '').trim(); });
    var colSidO = oH.indexOf('SocietyID') >= 0 ? oH.indexOf('SocietyID') : 0;
    var colOutingIdO = oH.indexOf('OutingId');
    var colDateO = oH.indexOf('Date') >= 0 ? oH.indexOf('Date') : (colOutingIdO >= 0 ? 2 : 1);
    var colTimeO = oH.indexOf('Time') >= 0 ? oH.indexOf('Time') : (colOutingIdO >= 0 ? 3 : 2);
    var colCourseO = oH.indexOf('CourseName') >= 0 ? oH.indexOf('CourseName') : (colOutingIdO >= 0 ? 4 : 3);
    var colCompsO = oH.indexOf('Comps') >= 0 ? oH.indexOf('Comps') : (colOutingIdO >= 0 ? 5 : 4);

    for (var oi = 1; oi < outRows.length; oi++) {
      var row = outRows[oi];
      if (String(row[colSidO] || '').toLowerCase() !== sid) continue;
      var dateVal = row[colDateO];
      var dateStr;
      if (dateVal instanceof Date) {
        var y = dateVal.getFullYear(), m = dateVal.getMonth() + 1, d = dateVal.getDate();
        dateStr = y + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d);
      } else {
        dateStr = String(dateVal || '').trim();
      }
      const timeStr = formatOutingTimeFromSheet(row[colTimeO]);
      const courseName = String(row[colCourseO] || '').trim();
      if (!dateStr || !timeStr || !courseName) continue;
      const outingId = colOutingIdO >= 0 ? String(row[colOutingIdO] || '').trim() : '';
      outings.push({
        outingId: outingId || undefined,
        date: dateStr,
        time: timeStr,
        courseName: courseName,
        comps: String(row[colCompsO] || '').trim(),
        hasScores: !!(outingId && outingIdsWithScores[outingId])
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
    var pH = (pRows[0] || []).map(function(h) { return String(h || '').trim(); });
    var colSidP = pH.indexOf('SocietyID') >= 0 ? pH.indexOf('SocietyID') : 0;
    var colPlayerIdP = pH.indexOf('PlayerId');
    var colNameP = pH.indexOf('PlayerName') >= 0 ? pH.indexOf('PlayerName') : (colPlayerIdP >= 0 ? 2 : 1);
    var colHcapP = pH.indexOf('Handicap') >= 0 ? pH.indexOf('Handicap') : (colPlayerIdP >= 0 ? 3 : 2);
    for (var pi = 1; pi < pRows.length; pi++) {
      var prow = pRows[pi];
      if (String(prow[colSidP] || '').toLowerCase() !== sid) continue;
      var pName = String(prow[colNameP] || '').trim();
      if (!pName) continue;
      var playerId = colPlayerIdP >= 0 ? String(prow[colPlayerIdP] || '').trim() : '';
      players.push({ playerId: playerId || undefined, playerName: pName, handicap: prow[colHcapP] || 0 });
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

/** Check if any scores exist for an outing (by societyId and outingId). */
function outingHasScores(societyId, outingId) {
  if (!outingId) return false;
  const scoresSheet = getScoresSheet();
  const scoresRows = scoresSheet.getDataRange().getValues();
  if (scoresRows.length < 2) return false;
  const h = (scoresRows[0] || []).map(function(x) { return String(x || '').trim(); });
  const colSocietyId = h.indexOf('SocietyID') >= 0 ? h.indexOf('SocietyID') : 0;
  const colOutingId = h.indexOf('OutingId');
  if (colOutingId < 0) return false;
  const sid = String(societyId || '').toLowerCase();
  const oid = String(outingId || '').trim();
  for (let i = 1; i < scoresRows.length; i++) {
    if (String(scoresRows[i][colSocietyId] || '').toLowerCase() !== sid) continue;
    if (String(scoresRows[i][colOutingId] || '').trim() === oid) return true;
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
        error: 'Time is required for outings'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const sid = String(societyId || '').toLowerCase();
    const existingOutingId = String(data.outingId || '').trim();
    const isEdit = !!existingOutingId;

    const rows = sheet.getDataRange().getValues();
    const headers = (rows[0] || []).map(function(h) { return String(h || '').trim(); });
    const colSid = headers.indexOf('SocietyID') >= 0 ? headers.indexOf('SocietyID') : 0;
    const colOutingId = headers.indexOf('OutingId');
    const colDate = headers.indexOf('Date') >= 0 ? headers.indexOf('Date') : (colOutingId >= 0 ? 2 : 1);
    const colTime = headers.indexOf('Time') >= 0 ? headers.indexOf('Time') : (colOutingId >= 0 ? 3 : 2);
    const colCourse = headers.indexOf('CourseName') >= 0 ? headers.indexOf('CourseName') : (colOutingId >= 0 ? 4 : 3);
    const colComps = headers.indexOf('Comps') >= 0 ? headers.indexOf('Comps') : (colOutingId >= 0 ? 5 : 4);

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][colSid] || '').toLowerCase() !== sid) continue;
      const rowOutingId = colOutingId >= 0 ? String(rows[i][colOutingId] || '').trim() : '';
      if (isEdit && rowOutingId === existingOutingId) {
        const outingId = rowOutingId || generateId('o');
        const newRow = [societyId, outingId, date, timeStr, courseName, String(data.comps || '').trim()];
        const numCols = 6;
        sheet.getRange(i + 1, 1, 1, numCols).setValues([newRow]);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: 'Outing updated successfully'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    const newOutingId = generateId('o');
    sheet.appendRow([societyId, newOutingId, date, timeStr, courseName, String(data.comps || '').trim()]);
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
    const outingId = String(data.outingId || '').trim();
    if (!outingId) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'OutingId is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const sid = String(societyId || '').toLowerCase();
    if (outingHasScores(societyId, outingId)) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Cannot delete outing: one or more scores exist for this outing. Delete the scores first.'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const sheet = getOutingsSheet();
    const rows = sheet.getDataRange().getValues();
    const headers = (rows[0] || []).map(function(h) { return String(h || '').trim(); });
    const colSid = headers.indexOf('SocietyID') >= 0 ? headers.indexOf('SocietyID') : 0;
    const colOutingId = headers.indexOf('OutingId');
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][colSid] || '').toLowerCase() !== sid) continue;
      const rowId = colOutingId >= 0 ? String(rows[i][colOutingId] || '').trim() : '';
      if (rowId === outingId) {
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
// OUTING TEAMS (read: optional fallback; write: saveOutingTeams)
// ============================================

/**
 * Return teams and members for a society, optionally filtered by one outing.
 * Prefer params.outingId; legacy params.courseName+date+time resolve to outingId via Outings sheet.
 */
function getOutingTeams(societyId, params) {
  try {
    const sid = String(societyId || '').toLowerCase();
    let filterOutingId = String(params.outingId || '').trim();
    const filterCourse = String(params.courseName || '').trim().toLowerCase();
    const filterDate = normalizeDate(String(params.date || '').trim());
    const filterTime = normalizeTime(String(params.time || '').trim());
    const useLegacy = !filterOutingId && filterCourse && filterDate;
    if (useLegacy) {
      const oRows = getOutingsSheet().getDataRange().getValues();
      const oH = (oRows[0] || []).map(function(h) { return String(h || '').trim(); });
      const colSidO = oH.indexOf('SocietyID') >= 0 ? oH.indexOf('SocietyID') : 0;
      const colOutingIdO = oH.indexOf('OutingId');
      const colDateO = oH.indexOf('Date') >= 0 ? oH.indexOf('Date') : (colOutingIdO >= 0 ? 2 : 1);
      const colTimeO = oH.indexOf('Time') >= 0 ? oH.indexOf('Time') : (colOutingIdO >= 0 ? 3 : 2);
      const colCourseO = oH.indexOf('CourseName') >= 0 ? oH.indexOf('CourseName') : (colOutingIdO >= 0 ? 4 : 3);
      for (let r = 1; r < oRows.length; r++) {
        if (String(oRows[r][colSidO] || '').toLowerCase() !== sid) continue;
        if (formatOutingDateFromSheet(oRows[r][colDateO]) !== filterDate) continue;
        if (filterTime && formatOutingTimeFromSheet(oRows[r][colTimeO]) !== filterTime) continue;
        if (String(oRows[r][colCourseO] || '').trim().toLowerCase() !== filterCourse) continue;
        filterOutingId = colOutingIdO >= 0 ? String(oRows[r][colOutingIdO] || '').trim() : '';
        break;
      }
    }
    const singleOuting = !!filterOutingId;

    const teamsSheet = getTeamsSheet();
    const membersSheet = getTeamMembersSheet();
    const teamRows = teamsSheet.getDataRange().getValues();
    const memberRows = membersSheet.getDataRange().getValues();

    const tHeaders = (teamRows[0] || []).map(function(h) { return String(h || '').trim(); });
    const cSidT = tHeaders.indexOf('SocietyID') >= 0 ? tHeaders.indexOf('SocietyID') : 0;
    const cOutingIdT = tHeaders.indexOf('OutingId');
    const cTeamIdT = tHeaders.indexOf('TeamId');
    const cTeamNameT = tHeaders.indexOf('TeamName');
    const hasNewSchema = cOutingIdT >= 0;

    const mHeaders = (memberRows[0] || []).map(function(h) { return String(h || '').trim(); });
    const cSidM = mHeaders.indexOf('SocietyID') >= 0 ? mHeaders.indexOf('SocietyID') : 0;
    const cOutingIdM = mHeaders.indexOf('OutingId');
    const cTeamIdM = mHeaders.indexOf('TeamId');
    const cPlayerIdM = mHeaders.indexOf('PlayerId');
    const cPlayerM = mHeaders.indexOf('PlayerName');

    if (!hasNewSchema || cPlayerIdM < 0) {
      if (singleOuting) return ContentService.createTextOutput(JSON.stringify({ success: true, teams: [] })).setMimeType(ContentService.MimeType.JSON);
      return ContentService.createTextOutput(JSON.stringify({ success: true, teamsByOuting: {} })).setMimeType(ContentService.MimeType.JSON);
    }

    const playerIdToName = {};
    const pRows = getPlayersSheet().getDataRange().getValues();
    const pH = (pRows[0] || []).map(function(h) { return String(h || '').trim(); });
    const colPlayerIdP = pH.indexOf('PlayerId');
    const colNameP = pH.indexOf('PlayerName') >= 0 ? pH.indexOf('PlayerName') : 2;
    for (let r = 1; r < pRows.length; r++) {
      if (String(pRows[r][0] || '').toLowerCase() !== sid) continue;
      const pid = colPlayerIdP >= 0 ? String(pRows[r][colPlayerIdP] || '').trim() : '';
      const name = String(pRows[r][colNameP] || '').trim();
      if (pid) playerIdToName[pid] = name;
    }

    const teams = [];
    for (let i = 1; i < teamRows.length; i++) {
      const row = teamRows[i];
      if (String(row[cSidT] || '').toLowerCase() !== sid) continue;
      const rowOutingId = cOutingIdT >= 0 ? String(row[cOutingIdT] || '').trim() : '';
      if (singleOuting && rowOutingId !== filterOutingId) continue;
      const teamId = cTeamIdT >= 0 ? String(row[cTeamIdT] || '').trim() : '';
      const teamName = cTeamNameT >= 0 ? String(row[cTeamNameT] || '').trim() : '';
      const team = { teamId: teamId, teamName: teamName, playerNames: [], playerIds: [] };
      for (let j = 1; j < memberRows.length; j++) {
        const mRow = memberRows[j];
        if (String(mRow[cSidM] || '').toLowerCase() !== sid) continue;
        if (String(mRow[cOutingIdM] || '').trim() !== rowOutingId) continue;
        if (String(mRow[cTeamIdM] || '').trim() !== teamId) continue;
        const pid = String(mRow[cPlayerIdM] || '').trim();
        if (pid) {
          team.playerIds.push(pid);
          team.playerNames.push(playerIdToName[pid] || pid);
        } else if (cPlayerM >= 0) {
          const pn = String(mRow[cPlayerM] || '').trim();
          if (pn) team.playerNames.push(pn);
        }
      }
      teams.push(team);
    }

    if (singleOuting) {
      return ContentService.createTextOutput(JSON.stringify({ success: true, teams: teams })).setMimeType(ContentService.MimeType.JSON);
    }
    const teamsByOuting = {};
    for (let i = 1; i < teamRows.length; i++) {
      const row = teamRows[i];
      const rowOutingId = cOutingIdT >= 0 ? String(row[cOutingIdT] || '').trim() : '';
      if (!rowOutingId) continue;
      if (String(row[cSidT] || '').toLowerCase() !== sid) continue;
      if (!teamsByOuting[rowOutingId]) teamsByOuting[rowOutingId] = [];
      const teamId = cTeamIdT >= 0 ? String(row[cTeamIdT] || '').trim() : '';
      const teamName = cTeamNameT >= 0 ? String(row[cTeamNameT] || '').trim() : '';
      const team = { teamId: teamId, teamName: teamName, playerNames: [], playerIds: [] };
      for (let j = 1; j < memberRows.length; j++) {
        const mRow = memberRows[j];
        if (String(mRow[cSidM] || '').toLowerCase() !== sid || String(mRow[cOutingIdM] || '').trim() !== rowOutingId || String(mRow[cTeamIdM] || '').trim() !== teamId) continue;
        const pid = String(mRow[cPlayerIdM] || '').trim();
        if (pid) { team.playerIds.push(pid); team.playerNames.push(playerIdToName[pid] || pid); }
      }
      teamsByOuting[rowOutingId].push(team);
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true, teamsByOuting: teamsByOuting })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Replace all teams and members for one outing.
 * data: { outingId, teams: [ { teamId?, teamName, playerIds: [] } ] }
 */
function saveOutingTeams(societyId, data) {
  try {
    const outingId = String(data.outingId || '').trim();
    if (!outingId) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'outingId is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const teams = Array.isArray(data.teams) ? data.teams : [];
    const allPlayerIds = [];
    for (let t = 0; t < teams.length; t++) {
      const team = teams[t];
      const ids = Array.isArray(team.playerIds) ? team.playerIds : [];
      for (let n = 0; n < ids.length; n++) {
        const id = String(ids[n] || '').trim();
        if (!id) continue;
        if (allPlayerIds.indexOf(id) >= 0) {
          return ContentService.createTextOutput(JSON.stringify({
            success: false,
            error: 'Each player can be on only one team. Duplicate playerId: ' + id
          })).setMimeType(ContentService.MimeType.JSON);
        }
        allPlayerIds.push(id);
      }
    }

    const sid = String(societyId || '').toLowerCase();
    const teamsSheet = getTeamsSheet();
    const membersSheet = getTeamMembersSheet();
    const teamRows = teamsSheet.getDataRange().getValues();
    const memberRows = membersSheet.getDataRange().getValues();
    const tHeaders = (teamRows[0] || []).map(function(h) { return String(h || '').trim(); });
    const cSidT = tHeaders.indexOf('SocietyID') >= 0 ? tHeaders.indexOf('SocietyID') : 0;
    const cOutingIdT = tHeaders.indexOf('OutingId');
    const cTeamIdT = tHeaders.indexOf('TeamId');
    const cTeamNameT = tHeaders.indexOf('TeamName');
    const mHeaders = (memberRows[0] || []).map(function(h) { return String(h || '').trim(); });
    const cSidM = mHeaders.indexOf('SocietyID') >= 0 ? mHeaders.indexOf('SocietyID') : 0;
    const cOutingIdM = mHeaders.indexOf('OutingId');
    const cPlayerIdM = mHeaders.indexOf('PlayerId');
    const cTeamIdM = mHeaders.indexOf('TeamId');

    const toDeleteTeams = [];
    for (let i = 1; i < teamRows.length; i++) {
      if (String(teamRows[i][0] || '').toLowerCase() !== sid) continue;
      const rowOid = cOutingIdT >= 0 ? String(teamRows[i][cOutingIdT] || '').trim() : '';
      if (rowOid === outingId) toDeleteTeams.push(i + 1);
    }
    const toDeleteMembers = [];
    for (let j = 1; j < memberRows.length; j++) {
      if (String(memberRows[j][0] || '').toLowerCase() !== sid) continue;
      const rowOid = cOutingIdM >= 0 ? String(memberRows[j][cOutingIdM] || '').trim() : '';
      if (rowOid === outingId) toDeleteMembers.push(j + 1);
    }
    for (let d = toDeleteTeams.length - 1; d >= 0; d--) teamsSheet.deleteRow(toDeleteTeams[d]);
    for (let d = toDeleteMembers.length - 1; d >= 0; d--) membersSheet.deleteRow(toDeleteMembers[d]);

    function generateTeamId() { return 't' + Math.random().toString(36).slice(2, 11); }

    for (let t = 0; t < teams.length; t++) {
      const team = teams[t];
      const teamName = String(team.teamName || '').trim();
      const playerIds = Array.isArray(team.playerIds) ? team.playerIds : [];
      const teamId = team.teamId && String(team.teamId).trim() ? String(team.teamId).trim() : generateTeamId();

      // Write team row aligned to header order (handles legacy column ordering)
      if (tHeaders.length > 0) {
        const newTeamRow = new Array(tHeaders.length).fill('');
        if (cSidT >= 0) newTeamRow[cSidT] = societyId;
        if (cOutingIdT >= 0) newTeamRow[cOutingIdT] = outingId;
        if (cTeamIdT >= 0) newTeamRow[cTeamIdT] = teamId;
        if (cTeamNameT >= 0) newTeamRow[cTeamNameT] = teamName;
        teamsSheet.appendRow(newTeamRow);
      } else {
        teamsSheet.appendRow([societyId, outingId, teamId, teamName]);
      }

      // Write member rows aligned to header order (critical for getOutingTeams to match)
      for (let p = 0; p < playerIds.length; p++) {
        const pid = String(playerIds[p] || '').trim();
        if (!pid) continue;
        if (mHeaders.length > 0 && cOutingIdM >= 0 && cPlayerIdM >= 0 && cTeamIdM >= 0) {
          const newMemberRow = new Array(mHeaders.length).fill('');
          if (cSidM >= 0) newMemberRow[cSidM] = societyId;
          newMemberRow[cOutingIdM] = outingId;
          newMemberRow[cPlayerIdM] = pid;
          newMemberRow[cTeamIdM] = teamId;
          membersSheet.appendRow(newMemberRow);
        } else {
          membersSheet.appendRow([societyId, outingId, pid, teamId]);
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Teams saved successfully'
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
    const outingId = String(data.outingId || '').trim();
    const playerId = String(data.playerId || '').trim();
    if (!outingId || !playerId) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'outingId and playerId are required for scores'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const sheet = getScoresSheet();
    const rows = sheet.getDataRange().getValues();
    const h = (rows[0] || []).map(function(x) { return String(x || '').trim(); });
    const colSid = h.indexOf('SocietyID') >= 0 ? h.indexOf('SocietyID') : 0;
    const colOutingId = h.indexOf('OutingId');
    const colPlayerId = h.indexOf('PlayerId');
    if (colOutingId < 0 || colPlayerId < 0) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Scores sheet must have OutingId and PlayerId columns'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const sid = String(societyId || '').toLowerCase();
    let existingRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][colSid] || '').toLowerCase() !== sid) continue;
      if (String(rows[i][colOutingId] || '').trim() !== outingId) continue;
      if (String(rows[i][colPlayerId] || '').trim() !== playerId) continue;
      existingRowIndex = i + 1;
      break;
    }
    const holePoints = data.holePoints || [];
    const scoreRow = [
      societyId,
      outingId,
      playerId,
      data.handicap != null ? data.handicap : 0,
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
    const h = (rows[0] || []).map(function(x) { return String(x || '').trim(); });
    const colOutingId = h.indexOf('OutingId');
    const colPlayerId = h.indexOf('PlayerId');
    if (colOutingId < 0 || colPlayerId < 0) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        scores: []
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const sid = String(societyId).toLowerCase();
    const filterOutingId = String(data.outingId || '').trim();
    const filterPlayerId = String(data.playerId || '').trim();

    const outingById = {};
    const oRows = getOutingsSheet().getDataRange().getValues();
    const oH = (oRows[0] || []).map(function(x) { return String(x || '').trim(); });
    const colOid = oH.indexOf('OutingId');
    const colDateO = oH.indexOf('Date') >= 0 ? oH.indexOf('Date') : 2;
    const colTimeO = oH.indexOf('Time') >= 0 ? oH.indexOf('Time') : 3;
    const colCourseO = oH.indexOf('CourseName') >= 0 ? oH.indexOf('CourseName') : 4;
    for (let r = 1; r < oRows.length; r++) {
      if (String(oRows[r][0] || '').toLowerCase() !== sid) continue;
      const oid = colOid >= 0 ? String(oRows[r][colOid] || '').trim() : '';
      if (!oid) continue;
      let dateVal = oRows[r][colDateO];
      let dateStr = dateVal instanceof Date ? (dateVal.getFullYear() + '-' + (dateVal.getMonth() + 1 < 10 ? '0' : '') + (dateVal.getMonth() + 1) + '-' + (dateVal.getDate() < 10 ? '0' : '') + dateVal.getDate()) : String(dateVal || '').trim();
      outingById[oid] = {
        date: dateStr,
        time: formatOutingTimeFromSheet(oRows[r][colTimeO]),
        courseName: String(oRows[r][colCourseO] || '').trim()
      };
    }
    const playerById = {};
    const pRows = getPlayersSheet().getDataRange().getValues();
    const pH = (pRows[0] || []).map(function(x) { return String(x || '').trim(); });
    const colPid = pH.indexOf('PlayerId');
    const colNameP = pH.indexOf('PlayerName') >= 0 ? pH.indexOf('PlayerName') : 2;
    for (let r = 1; r < pRows.length; r++) {
      if (String(pRows[r][0] || '').toLowerCase() !== sid) continue;
      const pid = colPid >= 0 ? String(pRows[r][colPid] || '').trim() : '';
      if (pid) playerById[pid] = String(pRows[r][colNameP] || '').trim();
    }

    const colSid = h.indexOf('SocietyID') >= 0 ? h.indexOf('SocietyID') : 0;
    const colHcap = h.indexOf('Handicap') >= 0 ? h.indexOf('Handicap') : 3;
    const scores = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (String(row[colSid] || '').toLowerCase() !== sid) continue;
      const oid = String(row[colOutingId] || '').trim();
      const pid = String(row[colPlayerId] || '').trim();
      if (!oid || !pid) continue;
      if (filterOutingId && oid !== filterOutingId) continue;
      if (filterPlayerId && pid !== filterPlayerId) continue;
      const outing = outingById[oid];
      const playerName = playerById[pid] || pid;
      const courseName = outing ? outing.courseName : '';
      const dateStr = outing ? outing.date : '';
      let timestamp = row[50] || '';
      if (timestamp instanceof Date) timestamp = timestamp.toISOString();
      else if (timestamp) timestamp = String(timestamp);
      scores.push({
        outingId: oid,
        playerId: pid,
        playerName: playerName,
        course: courseName,
        date: dateStr,
        handicap: row[colHcap] || 0,
        holes: [row[4] || '', row[5] || '', row[6] || '', row[7] || '', row[8] || '', row[9] || '', row[10] || '', row[11] || '', row[12] || '', row[13] || '', row[14] || '', row[15] || '', row[16] || '', row[17] || '', row[18] || '', row[19] || '', row[20] || '', row[21] || ''],
        holePoints: [row[22] || 0, row[23] || 0, row[24] || 0, row[25] || 0, row[26] || 0, row[27] || 0, row[28] || 0, row[29] || 0, row[30] || 0, row[31] || 0, row[32] || 0, row[33] || 0, row[34] || 0, row[35] || 0, row[36] || 0, row[37] || 0, row[38] || 0, row[39] || 0],
        totalScore: row[40] || 0,
        totalPoints: row[41] || 0,
        outScore: row[42] || 0,
        outPoints: row[43] || 0,
        inScore: row[44] || 0,
        inPoints: row[45] || 0,
        back6Score: row[46] || 0,
        back6Points: row[47] || 0,
        back3Score: row[48] || 0,
        back3Points: row[49] || 0,
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
    const outingId = String(data.outingId || '').trim();
    const playerId = String(data.playerId || '').trim();
    if (!outingId || !playerId) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        exists: false
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const sheet = getScoresSheet();
    const rows = sheet.getDataRange().getValues();
    const h = (rows[0] || []).map(function(x) { return String(x || '').trim(); });
    const colSid = h.indexOf('SocietyID') >= 0 ? h.indexOf('SocietyID') : 0;
    const colOutingId = h.indexOf('OutingId');
    const colPlayerId = h.indexOf('PlayerId');
    if (colOutingId < 0 || colPlayerId < 0) {
      return ContentService.createTextOutput(JSON.stringify({ success: true, exists: false })).setMimeType(ContentService.MimeType.JSON);
    }
    const sid = String(societyId || '').toLowerCase();
    let bestRow = null;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][colSid] || '').toLowerCase() !== sid) continue;
      if (String(rows[i][colOutingId] || '').trim() !== outingId) continue;
      if (String(rows[i][colPlayerId] || '').trim() !== playerId) continue;
      bestRow = rows[i];
      break;
    }
    if (bestRow) {
      const row = bestRow;
      const oid = String(row[colOutingId] || '').trim();
      const pid = String(row[colPlayerId] || '').trim();
      let playerName = '';
      let dateValue = '';
      let courseName = '';
      const oRows = getOutingsSheet().getDataRange().getValues();
      const oH = (oRows[0] || []).map(function(x) { return String(x || '').trim(); });
      const colOid = oH.indexOf('OutingId');
      const colDateO = oH.indexOf('Date') >= 0 ? oH.indexOf('Date') : 2;
      const colCourseO = oH.indexOf('CourseName') >= 0 ? oH.indexOf('CourseName') : 4;
      for (let r = 1; r < oRows.length; r++) {
        if (String(oRows[r][colOid] || '').trim() === oid) {
          dateValue = formatOutingDateFromSheet(oRows[r][colDateO]);
          courseName = String(oRows[r][colCourseO] || '').trim();
          break;
        }
      }
      const pRows = getPlayersSheet().getDataRange().getValues();
      const pH = (pRows[0] || []).map(function(x) { return String(x || '').trim(); });
      const colPid = pH.indexOf('PlayerId');
      const colNameP = pH.indexOf('PlayerName') >= 0 ? pH.indexOf('PlayerName') : 2;
      for (let r = 1; r < pRows.length; r++) {
        if (String(pRows[r][colPid] || '').trim() === pid) {
          playerName = String(pRows[r][colNameP] || '').trim();
          break;
        }
      }
      let timestamp = row[50] || '';
      if (timestamp instanceof Date) timestamp = timestamp.toISOString();
      else if (timestamp) timestamp = String(timestamp);
      const score = {
        outingId: oid,
        playerId: pid,
        playerName: playerName,
        course: courseName,
        date: dateValue,
        handicap: row[3] || 0,
        holes: [row[4] || '', row[5] || '', row[6] || '', row[7] || '', row[8] || '', row[9] || '', row[10] || '', row[11] || '', row[12] || '', row[13] || '', row[14] || '', row[15] || '', row[16] || '', row[17] || '', row[18] || '', row[19] || '', row[20] || '', row[21] || ''],
        holePoints: [row[22] || 0, row[23] || 0, row[24] || 0, row[25] || 0, row[26] || 0, row[27] || 0, row[28] || 0, row[29] || 0, row[30] || 0, row[31] || 0, row[32] || 0, row[33] || 0, row[34] || 0, row[35] || 0, row[36] || 0, row[37] || 0, row[38] || 0, row[39] || 0],
        totalScore: row[40] || 0, totalPoints: row[41] || 0,
        outScore: row[42] || 0, outPoints: row[43] || 0, inScore: row[44] || 0, inPoints: row[45] || 0,
        back6Score: row[46] || 0, back6Points: row[47] || 0, back3Score: row[48] || 0, back3Points: row[49] || 0,
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
    const outingId = String(data.outingId || '').trim();
    const playerId = String(data.playerId || '').trim();
    if (!outingId || !playerId) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'outingId and playerId are required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const sheet = getScoresSheet();
    const rows = sheet.getDataRange().getValues();
    const h = (rows[0] || []).map(function(x) { return String(x || '').trim(); });
    const colSid = h.indexOf('SocietyID') >= 0 ? h.indexOf('SocietyID') : 0;
    const colOutingId = h.indexOf('OutingId');
    const colPlayerId = h.indexOf('PlayerId');
    if (colOutingId < 0 || colPlayerId < 0) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Score not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const sid = String(societyId || '').toLowerCase();
    for (let i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][colSid] || '').toLowerCase() !== sid) continue;
      if (String(rows[i][colOutingId] || '').trim() !== outingId) continue;
      if (String(rows[i][colPlayerId] || '').trim() !== playerId) continue;
      sheet.deleteRow(i + 1);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Score deleted successfully'
      })).setMimeType(ContentService.MimeType.JSON);
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

// ============================================
// SCORECARD IMAGE ANALYSIS (Gemini)
// ============================================
// Requires GEMINI_API_KEY in Script Properties (Project Settings > Script properties).

/**
 * Analyze a scorecard image with Gemini; return strokes and optional card metadata.
 * data: { base64: string, mimeType?: string, context?: { currentCourseName, currentPlayerName, currentHandicap } }
 */
function analyzeScorecardImage(societyId, data) {
  const base64 = data.base64;
  const mimeType = data.mimeType || 'image/jpeg';
  if (!base64) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Missing image data'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'GEMINI_API_KEY not set in script properties. Add it in Apps Script Project Settings > Script properties.'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const context = data.context || {};
  let prompt = 'Objective: Extract hole-by-hole gross scores for "Player A" from the provided golf scorecard image.\n\n' +
    'Instructions:\n\n' +
    'Identify the Player: Locate "Player A" or the first name listed in the scoring grid.\n\n' +
    'Hole Identification: Map the scores to hole numbers 1 through 18. These are typically organized in a "Front Nine/OUT" and "Back Nine/IN" layout.\n\n' +
    'Score Extraction: Extract the Gross Score (the larger handwritten number in the cell) for each hole.\n\n' +
    'Zero/No-Score Logic: If a cell contains a dash (—), a diagonal stroke (/), or is left completely blank, record the score as 0.\n\n' +
    'Validation: Locate the "Total Points" or "Stableford" total (often circled on the card). If there are handwritten "Points" or "Net" columns next to the scores, use them to cross-reference that you are reading the correct row.\n\n' +
    'Output Format: Return only a CSV formatted list with the headers Hole and Score. Example:\nHole,Score\n1,4\n2,5\n3,4\n4,3\n5,5\n6,4\n7,4\n8,4\n9,5\n10,4\n11,3\n12,4\n13,4\n14,5\n15,4\n16,4\n17,3\n18,5';
  if (context.currentCourseName != null || context.currentPlayerName != null || context.currentHandicap != null) {
    prompt += '\n\nOptional context (for your reference only; do not change the output format): The current app has course = ' + (context.currentCourseName || '') + ', player = ' + (context.currentPlayerName || '') + ', handicap = ' + (context.currentHandicap ?? '') + '.';
  }

  const modelName = getGeminiModelName('SCORECARD_IMAGE_MODEL', AI_MODEL_CONFIG.SCORECARD_IMAGE_DEFAULT);
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelName) + ':generateContent?key=' + encodeURIComponent(apiKey);
  const payload = {
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: base64 } },
        { text: prompt }
      ]
    }],
    generationConfig: {
      temperature: 0,
      topP: 1
    }
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    const code = response.getResponseCode();
    const text = response.getContentText();
    if (code !== 200) {
      const err = JSON.parse(text || '{}');
      const msg = (err.error && err.error.message) ? err.error.message : ('Gemini API error: ' + code);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: msg
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const json = JSON.parse(text);
    const textPart = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0];
    const extractedText = textPart ? (textPart.text || '') : '';
    if (!extractedText) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'No extraction result from Gemini'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const parsed = parseGeminiScorecardCsv(extractedText);
    return ContentService.createTextOutput(JSON.stringify(parsed)).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: e.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Parse Gemini scorecard CSV from response text; ensure strokes array length 18.
 * Expected: "Hole,Score" header then 18 rows of "holeNum,score" (or legacy two-line format).
 */
function parseGeminiScorecardCsv(text) {
  const cleaned = text.replace(/```[\w]*\s*/g, '').trim();
  const lines = cleaned.split(/\r?\n/).map(function(line) { return line.trim(); }).filter(function(line) { return line.length > 0; });
  const result = { success: true, strokes: [] };
  const strokesByHole = {};
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (lower.indexOf('hole') !== -1 && lower.indexOf('score') !== -1) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex >= 0) {
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(function(p) { return p.trim(); });
      if (parts.length >= 2) {
        const holeNum = parseInt(Number(parts[0]), 10);
        const raw = parts[1];
        if (holeNum >= 1 && holeNum <= 18 && !isNaN(holeNum)) {
          if (raw === '' || raw === '-' || raw === '/') {
            strokesByHole[holeNum] = null;
          } else {
            const n = parseInt(Number(raw), 10);
            strokesByHole[holeNum] = (!isNaN(n) && n >= 0 && n <= 9) ? n : null;
          }
        }
      }
    }
  }
  if (Object.keys(strokesByHole).length === 0) {
    const first = lines[0].split(',');
    const second = lines.length >= 2 ? lines[1].split(',') : [];
    if (second.length >= 18 && second.slice(0, 18).every(function(c) { return c.trim() === '' || c.trim() === '-' || !isNaN(Number(c.trim())); })) {
      for (let i = 0; i < 18; i++) {
        const raw = (second[i] != null ? String(second[i]).trim() : '');
        result.strokes.push(parseScoreCell(raw));
      }
    } else if (first.length >= 18 && first.slice(0, 18).every(function(c) { return c.trim() === '' || c.trim() === '-' || !isNaN(Number(c.trim())); })) {
      for (let i = 0; i < 18; i++) {
        const raw = (first[i] != null ? String(first[i]).trim() : '');
        result.strokes.push(parseScoreCell(raw));
      }
    } else {
      const withEnough = lines.filter(function(l) { return l.split(',').length >= 18; });
      if (withEnough.length > 0) {
        const parts = withEnough[0].split(',');
        for (let i = 0; i < 18; i++) result.strokes.push(parseScoreCell(parts[i] != null ? String(parts[i]).trim() : ''));
      } else {
        throw new Error('Could not find 18 stroke values in CSV response');
      }
    }
  } else {
    for (let h = 1; h <= 18; h++) {
      result.strokes.push(strokesByHole[h] !== undefined ? strokesByHole[h] : null);
    }
  }
  return result;
}

function parseScoreCell(raw) {
  if (raw === '' || raw === '-' || raw === '/') return null;
  const n = parseInt(Number(raw), 10);
  return (!isNaN(n) && n >= 0 && n <= 9) ? n : null;
}

/**
 * Use Gemini + Google Search grounding to find course par/index/website/club details.
 * data: { courseName: string, prompt?: string, model?: string }
 */
function lookupCourseWithAi(societyId, data) {
  try {
    const courseName = String((data && data.courseName) || '').trim();
    if (!courseName) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Course name is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'GEMINI_API_KEY not set in script properties. Add it in Apps Script Project Settings > Script properties.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const prompt = String((data && data.prompt) || '').trim() || buildDefaultCourseLookupPrompt(courseName);
    const requestedModel = String((data && data.model) || '').trim();
    const modelName = getGeminiModelName('COURSE_LOOKUP_MODEL', AI_MODEL_CONFIG.COURSE_LOOKUP_DEFAULT, requestedModel);
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelName) + ':generateContent?key=' + encodeURIComponent(apiKey);
    const generationConfig = {
      temperature: 0.2,
      topP: 0.95
    };
    const payload = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      tools: [{ google_search: {} }],
      generationConfig: generationConfig
    };

    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    const code = response.getResponseCode();
    const text = response.getContentText();
    if (code !== 200) {
      const err = safeJsonParse(text, {});
      const msg = (err.error && err.error.message) ? err.error.message : ('Gemini API error: ' + code);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: msg
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const json = safeJsonParse(text, {});
    const rawText = extractGeminiText(json);
    if (!rawText) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'No course data returned from Gemini'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var result = parseAiCourseJson(rawText);
    if (!result || typeof result !== 'object') {
      // Retry once with stricter formatting instruction.
      const retryPayload = {
        contents: [{
          parts: [{
            text: prompt + '\n\nIMPORTANT: Return ONLY one valid JSON object. No markdown, no prose, no code fences.'
          }]
        }],
        tools: [{ google_search: {} }],
        generationConfig: generationConfig
      };
      const retryResponse = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(retryPayload),
        muteHttpExceptions: true
      });
      if (retryResponse.getResponseCode() === 200) {
        const retryJson = safeJsonParse(retryResponse.getContentText(), {});
        const retryRawText = extractGeminiText(retryJson);
        result = parseAiCourseJson(retryRawText);
      }
    }

    if (!result || typeof result !== 'object') {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'AI response was not valid JSON'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const normalized = normalizeCourseLookupResult(result, courseName);
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: normalized
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: e.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function buildDefaultCourseLookupPrompt(courseName) {
  return 'Get 18-hole par and stroke index (Men\'s/Championship tees) for: ' + courseName + '.\n\n' +
    'SOURCE (in this order):\n' +
    '1. Official club website. Look up the course, find its official website, and get the full scorecard (par and stroke index for holes 1–18) from that site. Use this if available.\n' +
    '2. Only if the official website does not have the scorecard or you cannot find it, use Hole19 to get the 18 pars and 18 stroke indexes.\n\n' +
    'Reply with a single JSON object only (no markdown, no explanation). Valid JSON with these keys:\n' +
    '"pars" = array of 18 integers (par per hole), "indexes" = array of 18 integers (stroke index per hole), "website" = club URL or "", "clubName" = official name or "", "courseMapLoc" = Google Maps directions/search URL or "".\n' +
    'Example: {"pars":[4,4,3,4,5,4,3,4,5,4,4,3,4,5,4,3,4,5],"indexes":[5,13,17,9,1,11,15,7,3,10,16,6,2,14,18,8,4,12],"website":"https://example.com","clubName":"Club Name","courseMapLoc":"https://www.google.com/maps/search/Club+Name"}';
}

function getGeminiModelName(propertyKey, fallbackModel, requestedModel) {
  const requestValue = String(requestedModel || '').trim();
  const propertyValue = String(PropertiesService.getScriptProperties().getProperty(propertyKey) || '').trim();
  const chosen = requestValue || propertyValue || fallbackModel;
  // Compatibility alias: many docs/UI references use "gemini-3-flash", while v1beta expects preview id.
  if (chosen === 'gemini-3-flash') return 'gemini-3-flash-preview';
  return chosen;
}

function extractGeminiText(json) {
  if (!json || !json.candidates || !json.candidates.length) return '';
  const parts = (((json.candidates[0] || {}).content || {}).parts || []);
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] && parts[i].text) return String(parts[i].text);
  }
  return '';
}

function extractFirstJsonObject(text) {
  const cleaned = String(text || '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace < 0) return cleaned;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = firstBrace; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return cleaned.substring(firstBrace, i + 1);
    }
  }
  return cleaned;
}

function safeJsonParse(text, fallbackValue) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return fallbackValue;
  }
}

function parseAiCourseJson(text) {
  if (!text) return null;
  const direct = safeJsonParse(text, null);
  if (direct && typeof direct === 'object') return direct;
  const extracted = extractFirstJsonObject(text);
  const parsed = safeJsonParse(extracted, null);
  if (parsed && typeof parsed === 'object') return parsed;
  // Mild cleanup for common model artifacts (trailing commas).
  const cleaned = String(extracted || '').replace(/,\s*([}\]])/g, '$1');
  const parsedCleaned = safeJsonParse(cleaned, null);
  if (parsedCleaned && typeof parsedCleaned === 'object') return parsedCleaned;
  return null;
}

function normalizeCourseLookupResult(result, fallbackCourseName) {
  const parsRaw = Array.isArray(result.pars) ? result.pars : [];
  const indexesRaw = Array.isArray(result.indexes) ? result.indexes : [];
  const pars = [];
  const indexes = [];
  for (let i = 0; i < 18; i++) {
    const par = parseInt(Number(parsRaw[i]), 10);
    const idx = parseInt(Number(indexesRaw[i]), 10);
    pars.push(!isNaN(par) ? par : 0);
    indexes.push(!isNaN(idx) ? idx : 0);
  }

  const website = String(result.website || '').trim();
  const clubName = String(result.clubName || '').trim();
  const courseMapLoc = String(result.courseMapLoc || result.courseMaploc || '').trim();
  const courseName = String(result.courseName || fallbackCourseName || '').trim();

  return {
    courseName: courseName,
    clubName: clubName,
    website: website,
    courseMapLoc: courseMapLoc,
    pars: pars,
    indexes: indexes
  };
}

