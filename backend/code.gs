/**
 * Multi-Tenant Golf App Backend - Google Apps Script
 * Handles all societies in a single master Google Sheet
 * 
 * Sheet Structure:
 * - Societies tab: Master registry of all societies
 *   Columns: SocietyID, SocietyName, ContactPerson, NumberOfPlayers, NumberOfCourses, Status, CreatedDate
 * - Society_<society-id> tabs: One tab per society
 *   Each tab contains: Players, Courses, Outings, Scores sections
 * 
 * All requests must include societyId parameter (except master admin actions)
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
      case 'getCourses':
        return getCourses(societyId);
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
    
    // Admin actions (players, courses, outings)
    if (action === 'savePlayer' || action === 'updatePlayer') {
      return savePlayer(societyId, requestData.data);
    } else if (action === 'deletePlayer') {
      return deletePlayer(societyId, requestData.data);
    } else if (action === 'saveCourse' || action === 'updateCourse') {
      return saveCourse(societyId, requestData.data);
    } else if (action === 'deleteCourse') {
      return deleteCourse(societyId, requestData.data);
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
      
      // Only return active societies (or all if Status column doesn't exist)
      if (colStatus < 0 || status === 'Active' || status === '') {
        societies.push({
          societyId: colSocietyId >= 0 ? String(row[colSocietyId] || '').trim() : '',
          societyName: colSocietyName >= 0 ? String(row[colSocietyName] || '').trim() : '',
          contactPerson: colContactPerson >= 0 ? String(row[colContactPerson] || '').trim() : '',
          numberOfPlayers: colNumberOfPlayers >= 0 ? (row[colNumberOfPlayers] || 0) : 0,
          numberOfCourses: colNumberOfCourses >= 0 ? (row[colNumberOfCourses] || 0) : 0,
          status: status,
          createdDate: colCreatedDate >= 0 ? String(row[colCreatedDate] || '') : '',
          nextOuting: colNextOuting >= 0 ? String(row[colNextOuting] || '').trim() : '',
          captainsNotes: colCaptainsNotes >= 0 ? String(row[colCaptainsNotes] || '').trim() : ''
        });
      }
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
    
    // Create society tab
    const societyTabName = 'Society_' + societyId;
    const societySheet = getOrCreateSheet(societyTabName);
    
    // Initialize sections with headers
    initializeSocietyTab(societySheet);
    
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
  // Mark as Inactive instead of deleting
  return updateSociety({
    societyId: data.societyId,
    status: 'Inactive'
  });
}

// ============================================
// SOCIETY DATA MANAGEMENT
// ============================================

function getSocietySheet(societyId) {
  const societyTabName = 'Society_' + societyId;
  return getOrCreateSheet(societyTabName);
}

function initializeSocietyTab(sheet) {
  // Clear existing content
  sheet.clear();
  
  // Players section
  sheet.getRange(1, 1, 1, 2).setValues([['=== PLAYERS ===', '']]);
  sheet.getRange(2, 1, 1, 2).setValues([['PlayerName', 'Handicap']]);
  
  // Courses section (start at row 10)
  sheet.getRange(10, 1, 1, 2).setValues([['=== COURSES ===', '']]);
  sheet.getRange(11, 1, 1, 20).setValues([['CourseName', 'Par1', 'Par2', 'Par3', 'Par4', 'Par5', 'Par6', 'Par7', 'Par8', 'Par9', 'Par10', 'Par11', 'Par12', 'Par13', 'Par14', 'Par15', 'Par16', 'Par17', 'Par18', 'Index1', 'Index2', 'Index3', 'Index4', 'Index5', 'Index6', 'Index7', 'Index8', 'Index9', 'Index10', 'Index11', 'Index12', 'Index13', 'Index14', 'Index15', 'Index16', 'Index17', 'Index18']]);
  
  // Outings section (start at row 20)
  sheet.getRange(20, 1, 1, 2).setValues([['=== OUTINGS ===', '']]);
  sheet.getRange(21, 1, 1, 7).setValues([['Date', 'Time', 'GolfClubName', 'CourseName', 'CourseKey', 'ClubUrl', 'MapsUrl']]);
  
  // Scores section (start at row 30)
  sheet.getRange(30, 1, 1, 2).setValues([['=== SCORES ===', '']]);
  const scoreHeaders = [
    'Player Name', 'Course', 'Date', 'Handicap',
    'Hole1', 'Hole2', 'Hole3', 'Hole4', 'Hole5', 'Hole6', 'Hole7', 'Hole8', 'Hole9',
    'Hole10', 'Hole11', 'Hole12', 'Hole13', 'Hole14', 'Hole15', 'Hole16', 'Hole17', 'Hole18',
    'Points1', 'Points2', 'Points3', 'Points4', 'Points5', 'Points6', 'Points7', 'Points8', 'Points9',
    'Points10', 'Points11', 'Points12', 'Points13', 'Points14', 'Points15', 'Points16', 'Points17', 'Points18',
    'Total Score', 'Total Points', 'Out Score', 'Out Points', 'In Score', 'In Points',
    'Back 6 Score', 'Back 6 Points', 'Back 3 Score', 'Back 3 Points', 'Timestamp'
  ];
  sheet.getRange(31, 1, 1, scoreHeaders.length).setValues([scoreHeaders]);
}

// ============================================
// PLAYERS MANAGEMENT
// ============================================

function getPlayers(societyId) {
  try {
    const sheet = getSocietySheet(societyId);
    const players = [];
    
    // Find Players section (starts after "=== PLAYERS ===" header)
    const rows = sheet.getDataRange().getValues();
    let playersStartRow = -1;
    
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] || '').includes('=== PLAYERS ===')) {
        playersStartRow = i + 2; // Skip header and column headers
        break;
      }
    }
    
    if (playersStartRow < 0 || playersStartRow >= rows.length) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        players: []
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Read players until we hit another section or empty row
    for (let i = playersStartRow; i < rows.length; i++) {
      const row = rows[i];
      const playerName = String(row[0] || '').trim();
      
      // Stop if we hit another section marker or empty row
      if (playerName.includes('===') || !playerName) {
        break;
      }
      
      players.push({
        playerName: playerName,
        handicap: row[1] || 0
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
    const sheet = getSocietySheet(societyId);
    const playerName = String(data.playerName || '').trim();
    
    if (!playerName) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'PlayerName is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Find Players section
    const rows = sheet.getDataRange().getValues();
    let playersStartRow = -1;
    
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] || '').includes('=== PLAYERS ===')) {
        playersStartRow = i + 2; // Skip header and column headers
        break;
      }
    }
    
    if (playersStartRow < 0) {
      initializeSocietyTab(sheet);
      playersStartRow = 2;
    }
    
    // Check if player exists
    let existingRow = -1;
    for (let i = playersStartRow; i < rows.length; i++) {
      const row = rows[i];
      const rowPlayerName = String(row[0] || '').trim();
      if (rowPlayerName.includes('===')) break; // Hit another section
      if (rowPlayerName.toLowerCase() === playerName.toLowerCase()) {
        existingRow = i + 1;
        break;
      }
    }
    
    const newRow = [playerName, data.handicap || 0];
    
    if (existingRow > 0) {
      // Update existing
      sheet.getRange(existingRow, 1, 1, 2).setValues([newRow]);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Player updated successfully'
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      // Find next empty row in Players section
      let nextRow = playersStartRow;
      for (let i = playersStartRow; i < rows.length; i++) {
        const row = rows[i];
        const rowPlayerName = String(row[0] || '').trim();
        if (rowPlayerName.includes('===')) break; // Hit another section
        if (!rowPlayerName) {
          nextRow = i + 1;
          break;
        }
        nextRow = i + 2;
      }
      sheet.getRange(nextRow, 1, 1, 2).setValues([newRow]);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Player saved successfully'
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function deletePlayer(societyId, data) {
  try {
    const sheet = getSocietySheet(societyId);
    const playerName = String(data.playerName || '').trim();
    
    if (!playerName) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'PlayerName is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const rows = sheet.getDataRange().getValues();
    let playersStartRow = -1;
    
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] || '').includes('=== PLAYERS ===')) {
        playersStartRow = i + 2;
        break;
      }
    }
    
    if (playersStartRow < 0) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Players section not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    for (let i = playersStartRow; i < rows.length; i++) {
      const row = rows[i];
      const rowPlayerName = String(row[0] || '').trim();
      if (rowPlayerName.includes('===')) break;
      if (rowPlayerName.toLowerCase() === playerName.toLowerCase()) {
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
    const sheet = getSocietySheet(societyId);
    const courses = {};
    
    // Find Courses section
    const rows = sheet.getDataRange().getValues();
    let coursesStartRow = -1;
    
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] || '').includes('=== COURSES ===')) {
        coursesStartRow = i + 2; // Skip header and column headers
        break;
      }
    }
    
    if (coursesStartRow < 0 || coursesStartRow >= rows.length) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        courses: {}
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Read courses
    for (let i = coursesStartRow; i < rows.length; i++) {
      const row = rows[i];
      const courseName = String(row[0] || '').trim();
      
      if (courseName.includes('===') || !courseName) {
        break;
      }
      
      const pars = [];
      const indexes = [];
      for (let j = 1; j <= 18; j++) {
        pars.push(parseInt(row[j] || 0));
      }
      for (let j = 19; j <= 36; j++) {
        indexes.push(parseInt(row[j] || 0));
      }
      
      courses[courseName] = {
        pars: pars,
        indexes: indexes
      };
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
    const sheet = getSocietySheet(societyId);
    const courseName = String(data.courseName || '').trim();
    
    if (!courseName) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'CourseName is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Find Courses section
    const rows = sheet.getDataRange().getValues();
    let coursesStartRow = -1;
    
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] || '').includes('=== COURSES ===')) {
        coursesStartRow = i + 2;
        break;
      }
    }
    
    if (coursesStartRow < 0) {
      initializeSocietyTab(sheet);
      coursesStartRow = 11;
    }
    
    // Check if course exists
    let existingRow = -1;
    for (let i = coursesStartRow; i < rows.length; i++) {
      const row = rows[i];
      const rowCourseName = String(row[0] || '').trim();
      if (rowCourseName.includes('===')) break;
      if (rowCourseName.toLowerCase() === courseName.toLowerCase()) {
        existingRow = i + 1;
        break;
      }
    }
    
    const pars = data.pars || [];
    const indexes = data.indexes || [];
    const newRow = [courseName].concat(
      pars.slice(0, 18).concat(new Array(18 - pars.length).fill(0)),
      indexes.slice(0, 18).concat(new Array(18 - indexes.length).fill(0))
    );
    
    if (existingRow > 0) {
      sheet.getRange(existingRow, 1, 1, 37).setValues([newRow]);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Course updated successfully'
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      let nextRow = coursesStartRow;
      for (let i = coursesStartRow; i < rows.length; i++) {
        const row = rows[i];
        const rowCourseName = String(row[0] || '').trim();
        if (rowCourseName.includes('===')) break;
        if (!rowCourseName) {
          nextRow = i + 1;
          break;
        }
        nextRow = i + 2;
      }
      sheet.getRange(nextRow, 1, 1, 37).setValues([newRow]);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Course saved successfully'
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function deleteCourse(societyId, data) {
  try {
    const sheet = getSocietySheet(societyId);
    const courseName = String(data.courseName || '').trim();
    
    if (!courseName) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'CourseName is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const rows = sheet.getDataRange().getValues();
    let coursesStartRow = -1;
    
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] || '').includes('=== COURSES ===')) {
        coursesStartRow = i + 2;
        break;
      }
    }
    
    if (coursesStartRow < 0) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Courses section not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    for (let i = coursesStartRow; i < rows.length; i++) {
      const row = rows[i];
      const rowCourseName = String(row[0] || '').trim();
      if (rowCourseName.includes('===')) break;
      if (rowCourseName.toLowerCase() === courseName.toLowerCase()) {
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
    const sheet = getSocietySheet(societyId);
    const outings = [];
    
    // Find Outings section
    const rows = sheet.getDataRange().getValues();
    let outingsStartRow = -1;
    
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] || '').includes('=== OUTINGS ===')) {
        outingsStartRow = i + 2; // Skip header and column headers
        break;
      }
    }
    
    if (outingsStartRow < 0 || outingsStartRow >= rows.length) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        outings: []
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Read outings
    for (let i = outingsStartRow; i < rows.length; i++) {
      const row = rows[i];
      const date = String(row[0] || '').trim();
      
      if (date.includes('===') || !date) {
        break;
      }
      
      outings.push({
        date: date,
        time: String(row[1] || '').trim(),
        golfClubName: String(row[2] || '').trim(),
        courseName: String(row[3] || '').trim(),
        courseKey: String(row[4] || '').trim(),
        clubUrl: String(row[5] || '').trim(),
        mapsUrl: String(row[6] || '').trim()
      });
    }
    
    // Sort by date
    outings.sort((a, b) => {
      return new Date(a.date) - new Date(b.date);
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
    const sheet = getSocietySheet(societyId);
    const date = String(data.date || '').trim();
    
    if (!date) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Date is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Find Outings section
    const rows = sheet.getDataRange().getValues();
    let outingsStartRow = -1;
    
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] || '').includes('=== OUTINGS ===')) {
        outingsStartRow = i + 2;
        break;
      }
    }
    
    if (outingsStartRow < 0) {
      initializeSocietyTab(sheet);
      outingsStartRow = 21;
    }
    
    // Check if outing exists (by date and golfClubName)
    let existingRow = -1;
    const golfClubName = String(data.golfClubName || '').trim();
    for (let i = outingsStartRow; i < rows.length; i++) {
      const row = rows[i];
      const rowDate = String(row[0] || '').trim();
      if (rowDate.includes('===')) break;
      if (rowDate === date && String(row[2] || '').trim().toLowerCase() === golfClubName.toLowerCase()) {
        existingRow = i + 1;
        break;
      }
    }
    
    const newRow = [
      date,
      String(data.time || '').trim(),
      golfClubName,
      String(data.courseName || '').trim(),
      String(data.courseKey || '').trim(),
      String(data.clubUrl || '').trim(),
      String(data.mapsUrl || '').trim()
    ];
    
    if (existingRow > 0) {
      sheet.getRange(existingRow, 1, 1, 7).setValues([newRow]);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Outing updated successfully'
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      let nextRow = outingsStartRow;
      for (let i = outingsStartRow; i < rows.length; i++) {
        const row = rows[i];
        const rowDate = String(row[0] || '').trim();
        if (rowDate.includes('===')) break;
        if (!rowDate) {
          nextRow = i + 1;
          break;
        }
        nextRow = i + 2;
      }
      sheet.getRange(nextRow, 1, 1, 7).setValues([newRow]);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Outing saved successfully'
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function deleteOuting(societyId, data) {
  try {
    const sheet = getSocietySheet(societyId);
    const date = String(data.date || '').trim();
    const golfClubName = String(data.golfClubName || '').trim();
    
    if (!date) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Date is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const rows = sheet.getDataRange().getValues();
    let outingsStartRow = -1;
    
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] || '').includes('=== OUTINGS ===')) {
        outingsStartRow = i + 2;
        break;
      }
    }
    
    if (outingsStartRow < 0) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Outings section not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    for (let i = outingsStartRow; i < rows.length; i++) {
      const row = rows[i];
      const rowDate = String(row[0] || '').trim();
      if (rowDate.includes('===')) break;
      if (rowDate === date && (!golfClubName || String(row[2] || '').trim().toLowerCase() === golfClubName.toLowerCase())) {
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
    const sheet = getSocietySheet(societyId);
    
    // Find Scores section
    const rows = sheet.getDataRange().getValues();
    let scoresStartRow = -1;
    
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] || '').includes('=== SCORES ===')) {
        scoresStartRow = i + 2; // Skip header and column headers
        break;
      }
    }
    
    if (scoresStartRow < 0) {
      initializeSocietyTab(sheet);
      scoresStartRow = 31;
    }
    
    const playerName = String(data.playerName || '').trim();
    const course = String(data.course || '').trim();
    const date = String(data.date || new Date().toISOString().split('T')[0]).trim();
    const normalizedPlayerName = normalizeName(playerName);
    
    // Check if score exists
    let existingRowIndex = -1;
    if (rows.length > scoresStartRow) {
      for (let i = scoresStartRow; i < rows.length; i++) {
        const row = rows[i];
        const rowPlayerName = String(row[0] || '').trim();
        if (rowPlayerName.includes('===')) break; // Hit another section
        const rowCourse = String(row[1] || '').trim();
        const rowDate = normalizeDate(row[2] || '');
        
        if (normalizeName(rowPlayerName) === normalizedPlayerName &&
            rowCourse === course &&
            rowDate === date) {
          existingRowIndex = i + 1;
          break;
        }
      }
    }
    
    const holePoints = data.holePoints || [];
    const scoreRow = [
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
      data.totalScore || 0,
      data.totalPoints || 0,
      data.outScore || 0,
      data.outPoints || 0,
      data.inScore || 0,
      data.inPoints || 0,
      data.back6Score || 0,
      data.back6Points || 0,
      data.back3Score || 0,
      data.back3Points || 0,
      new Date().toISOString()
    ];
    
    if (existingRowIndex > 0) {
      sheet.getRange(existingRowIndex, 1, 1, scoreRow.length).setValues([scoreRow]);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Score updated successfully'
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      let nextRow = scoresStartRow;
      // Find next empty row
      for (let i = scoresStartRow; i < rows.length; i++) {
        const row = rows[i];
        const rowPlayerName = String(row[0] || '').trim();
        if (rowPlayerName.includes('===')) break;
        if (!rowPlayerName) {
          nextRow = i + 1;
          break;
        }
        nextRow = i + 2;
      }
      sheet.getRange(nextRow, 1, 1, scoreRow.length).setValues([scoreRow]);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Score saved successfully'
      })).setMimeType(ContentService.MimeType.JSON);
    }
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
    
    const sheet = getSocietySheet(societyId);
    const rows = sheet.getDataRange().getValues();
    let scoresStartRow = -1;
    
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] || '').includes('=== SCORES ===')) {
        scoresStartRow = i + 2;
        break;
      }
    }
    
    if (scoresStartRow < 0 || scoresStartRow >= rows.length) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        scores: []
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const scores = [];
    
    for (let i = scoresStartRow; i < rows.length; i++) {
      const row = rows[i];
      const rowPlayerName = String(row[0] || '').trim();
      
      if (rowPlayerName.includes('===') || !rowPlayerName) {
        break;
      }
      
      if (data.playerName) {
        const normalizedSearchName = normalizeName(data.playerName);
        const normalizedRowName = normalizeName(rowPlayerName);
        if (normalizedRowName !== normalizedSearchName) {
          continue;
        }
      }
      
      if (data.course && String(row[1] || '').trim() !== data.course) {
        continue;
      }
      
      let timestamp = row[50] || '';
      if (timestamp instanceof Date) {
        timestamp = timestamp.toISOString();
      } else if (timestamp) {
        timestamp = String(timestamp);
      }
      
      let date = row[2] || '';
      if (date instanceof Date) {
        date = date.toISOString().split('T')[0];
      } else if (date) {
        const str = String(date);
        if (str.includes('T') && str.length > 10) {
          date = str.split('T')[0];
        } else {
          date = str;
        }
      }
      
      const score = {
        playerName: rowPlayerName,
        course: String(row[1] || '').trim(),
        date: date,
        handicap: row[3] || 0,
        holes: [
          row[4] || '', row[5] || '', row[6] || '', row[7] || '',
          row[8] || '', row[9] || '', row[10] || '', row[11] || '',
          row[12] || '', row[13] || '', row[14] || '', row[15] || '',
          row[16] || '', row[17] || '', row[18] || '', row[19] || '',
          row[20] || '', row[21] || ''
        ],
        holePoints: [
          row[22] || 0, row[23] || 0, row[24] || 0, row[25] || 0,
          row[26] || 0, row[27] || 0, row[28] || 0, row[29] || 0,
          row[30] || 0, row[31] || 0, row[32] || 0, row[33] || 0,
          row[34] || 0, row[35] || 0, row[36] || 0, row[37] || 0,
          row[38] || 0, row[39] || 0
        ],
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
      };
      
      scores.push(score);
    }
    
    scores.sort((a, b) => {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    
    const limit = data.limit || 50;
    const limitedScores = scores.slice(0, limit);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      scores: limitedScores
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
    const sheet = getSocietySheet(societyId);
    const rows = sheet.getDataRange().getValues();
    let scoresStartRow = -1;
    
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] || '').includes('=== SCORES ===')) {
        scoresStartRow = i + 2;
        break;
      }
    }
    
    if (scoresStartRow < 0 || scoresStartRow >= rows.length) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        exists: false
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const playerName = String(data.playerName || '').trim();
    const course = String(data.course || '').trim();
    const date = String(data.date || new Date().toISOString().split('T')[0]).trim();
    const normalizedPlayerName = normalizeName(playerName);
    
    for (let i = scoresStartRow; i < rows.length; i++) {
      const row = rows[i];
      const rowPlayerName = String(row[0] || '').trim();
      if (rowPlayerName.includes('===') || !rowPlayerName) break;
      
      const rowCourse = String(row[1] || '').trim();
      const rowDate = normalizeDate(row[2] || '');
      
      if (normalizeName(rowPlayerName) === normalizedPlayerName &&
          rowCourse === course &&
          rowDate === date) {
        let timestamp = row[50] || '';
        if (timestamp instanceof Date) {
          timestamp = timestamp.toISOString();
        } else if (timestamp) {
          timestamp = String(timestamp);
        }
        
        let dateValue = row[2] || '';
        if (dateValue instanceof Date) {
          dateValue = dateValue.toISOString().split('T')[0];
        } else if (dateValue) {
          const str = String(dateValue);
          if (str.includes('T') && str.length > 10) {
            dateValue = str.split('T')[0];
          } else {
            dateValue = str;
          }
        }
        
        const score = {
          playerName: rowPlayerName,
          course: rowCourse,
          date: dateValue,
          handicap: row[3] || 0,
          holes: [
            row[4] || '', row[5] || '', row[6] || '', row[7] || '',
            row[8] || '', row[9] || '', row[10] || '', row[11] || '',
            row[12] || '', row[13] || '', row[14] || '', row[15] || '',
            row[16] || '', row[17] || '', row[18] || '', row[19] || '',
            row[20] || '', row[21] || ''
          ],
          holePoints: [
            row[22] || 0, row[23] || 0, row[24] || 0, row[25] || 0,
            row[26] || 0, row[27] || 0, row[28] || 0, row[29] || 0,
            row[30] || 0, row[31] || 0, row[32] || 0, row[33] || 0,
            row[34] || 0, row[35] || 0, row[36] || 0, row[37] || 0,
            row[38] || 0, row[39] || 0
          ],
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
        };
        
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          exists: true,
          score: score
        })).setMimeType(ContentService.MimeType.JSON);
      }
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
    const sheet = getSocietySheet(societyId);
    const rows = sheet.getDataRange().getValues();
    let scoresStartRow = -1;
    
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] || '').includes('=== SCORES ===')) {
        scoresStartRow = i + 2;
        break;
      }
    }
    
    if (scoresStartRow < 0 || scoresStartRow >= rows.length) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'No scores to delete'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const searchPlayerName = String(data.playerName || '').trim();
    const searchCourse = String(data.course || '').trim();
    const searchDate = normalizeDate(data.date || '');
    const searchTimestamp = String(data.timestamp || '').trim();
    
    for (let i = rows.length - 1; i >= scoresStartRow; i--) {
      const row = rows[i];
      const rowPlayerName = String(row[0] || '').trim();
      if (rowPlayerName.includes('===')) break;
      
      const rowCourse = String(row[1] || '').trim();
      const rowDate = normalizeDate(row[2] || '');
      const rowTimestamp = String(row[50] || '').trim();
      
      if (rowPlayerName === searchPlayerName &&
          rowCourse === searchCourse &&
          rowDate === searchDate &&
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
