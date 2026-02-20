/**
 * Sheets Read – load data from published Google Sheet CSV for all read operations.
 * Used by ApiClient.get for read actions; writes still go to Apps Script.
 * Requires: SheetsConfig, AppConfig (for societyId when needed).
 */
(function(global) {
  'use strict';

  function parseCSV(text) {
    if (typeof text !== 'string') return [];
    // Strip BOM if present (Google Sheets CSV export can include it)
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = [];
    let i = 0;
    const len = text.length;
    let row = [];
    let cell = '';
    let inQuotes = false;

    while (i < len) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            cell += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cell += ch;
        }
        i++;
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (ch === ',') {
        row.push(cell.trim());
        cell = '';
        i++;
        continue;
      }
      if (ch === '\r') {
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = '';
        i++;
        if (text[i] === '\n') i++;
        continue;
      }
      if (ch === '\n') {
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = '';
        i++;
        continue;
      }
      cell += ch;
      i++;
    }
    row.push(cell.trim());
    rows.push(row);
    return rows;
  }

  function fetchSheetRows(sheetName) {
    const url = SheetsConfig.getSheetUrl(sheetName);
    if (!url) return Promise.reject(new Error('Sheet URL not configured for: ' + sheetName));
    return fetch(url, { method: 'GET', redirect: 'follow' })
      .then(function(r) { return r.text(); })
      .then(parseCSV);
  }

  function colIndex(headers, name) {
    const i = headers.findIndex(function(h) { return String(h).trim().toLowerCase() === name.toLowerCase(); });
    return i >= 0 ? i : -1;
  }

  function rowVal(row, idx) {
    if (idx < 0 || idx >= row.length) return '';
    return String(row[idx] || '').trim();
  }

  function rowNum(row, idx) {
    const v = rowVal(row, idx);
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  /** Normalize date string to YYYY-MM-DD for comparison/display. */
  function normalizeDateStr(val) {
    if (!val) return '';
    const s = String(val).trim();
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
      return y + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return s;
  }

  /** Normalize time to HH:MM (e.g. from "2:30 PM" or "14:30"). */
  function normalizeTimeStr(val) {
    if (!val) return '';
    const s = String(val).trim();
    const match = s.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = match[2];
      if (/pm/i.test(s) && h < 12) h += 12;
      if (/am/i.test(s) && h === 12) h = 0;
      return (h < 10 ? '0' + h : '' + h) + ':' + m;
    }
    return s;
  }

  var READ_ACTIONS = [
    'getAllSocieties', 'getCourses', 'getSociety', 'getPlayers', 'getOutings',
    'getSocietyAdminData', 'getScorecardData', 'loadScores'
  ];

  function isReadAction(action) {
    return READ_ACTIONS.indexOf(action) >= 0;
  }

  function getAllSocieties() {
    return fetchSheetRows('Societies').then(function(rows) {
      if (rows.length < 2) return { success: true, societies: [] };
      const headers = rows[0].map(function(h) { return String(h).trim(); });
      const cId = colIndex(headers, 'SocietyID');
      const cName = colIndex(headers, 'SocietyName');
      const cContact = colIndex(headers, 'ContactPerson');
      const cNumP = colIndex(headers, 'NumberOfPlayers');
      const cNumO = colIndex(headers, 'NumberOfOutings');
      const cStatus = colIndex(headers, 'Status');
      const cCreated = colIndex(headers, 'CreatedDate');
      const cNotes = colIndex(headers, 'CaptainsNotes');
      const societies = [];
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        societies.push({
          societyId: cId >= 0 ? rowVal(row, cId) : '',
          societyName: cName >= 0 ? rowVal(row, cName) : '',
          contactPerson: cContact >= 0 ? rowVal(row, cContact) : '',
          numberOfPlayers: cNumP >= 0 ? rowNum(row, cNumP) : 0,
          numberOfOutings: cNumO >= 0 ? rowNum(row, cNumO) : 0,
          status: cStatus >= 0 ? rowVal(row, cStatus) || 'Active' : 'Active',
          createdDate: cCreated >= 0 ? rowVal(row, cCreated) : '',
          captainsNotes: cNotes >= 0 ? rowVal(row, cNotes) : ''
        });
      }
      return { success: true, societies: societies };
    });
  }

  function getSociety(societyId) {
    return fetchSheetRows('Societies').then(function(rows) {
      if (rows.length < 2) return { success: false, error: 'Society not found' };
      const headers = rows[0].map(function(h) { return String(h).trim(); });
      const cId = colIndex(headers, 'SocietyID');
      const cName = colIndex(headers, 'SocietyName');
      const cContact = colIndex(headers, 'ContactPerson');
      const cNumP = colIndex(headers, 'NumberOfPlayers');
      const cNumO = colIndex(headers, 'NumberOfOutings');
      const cStatus = colIndex(headers, 'Status');
      const cCreated = colIndex(headers, 'CreatedDate');
      const cNotes = colIndex(headers, 'CaptainsNotes');
      const sid = String(societyId || '').toLowerCase();
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        if (rowVal(row, cId).toLowerCase() !== sid) continue;
        return {
          success: true,
          society: {
            societyId: rowVal(row, cId),
            societyName: cName >= 0 ? rowVal(row, cName) : '',
            contactPerson: cContact >= 0 ? rowVal(row, cContact) : '',
            numberOfPlayers: cNumP >= 0 ? rowNum(row, cNumP) : 0,
            numberOfOutings: cNumO >= 0 ? rowNum(row, cNumO) : 0,
            status: cStatus >= 0 ? rowVal(row, cStatus) || 'Active' : 'Active',
            createdDate: cCreated >= 0 ? rowVal(row, cCreated) : '',
            captainsNotes: cNotes >= 0 ? rowVal(row, cNotes) : ''
          }
        };
      }
      return { success: false, error: 'Society not found: ' + societyId };
    });
  }

  function getPlayers(societyId) {
    return fetchSheetRows('Players').then(function(rows) {
      const players = [];
      if (rows.length < 2) return { success: true, players: players };
      const headers = rows[0].map(function(h) { return String(h).trim(); });
      const cSid = colIndex(headers, 'SocietyID');
      const cName = colIndex(headers, 'PlayerName');
      const cHcap = colIndex(headers, 'Handicap');
      const sid = String(societyId || '').toLowerCase();
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        if (rowVal(row, cSid).toLowerCase() !== sid) continue;
        var name = rowVal(row, cName);
        if (!name) continue;
        players.push({
          playerName: name,
          handicap: cHcap >= 0 ? rowNum(row, cHcap) : 0
        });
      }
      return { success: true, players: players };
    });
  }

  function getOutings(societyId) {
    return fetchSheetRows('Outings').then(function(rows) {
      const outings = [];
      if (rows.length < 2) return { success: true, outings: outings };
      const headers = rows[0].map(function(h) { return String(h).trim(); });
      const cSid = colIndex(headers, 'SocietyID');
      const cDate = colIndex(headers, 'Date');
      const cTime = colIndex(headers, 'Time');
      const cCourse = colIndex(headers, 'CourseName');
      const cNotes = colIndex(headers, 'Notes');
      const sid = String(societyId || '').toLowerCase();
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        if (rowVal(row, cSid).toLowerCase() !== sid) continue;
        var dateStr = normalizeDateStr(rowVal(row, cDate));
        if (!dateStr) continue;
        outings.push({
          date: dateStr,
          time: cTime >= 0 ? normalizeTimeStr(rowVal(row, cTime)) : '',
          courseName: cCourse >= 0 ? rowVal(row, cCourse) : '',
          notes: cNotes >= 0 ? rowVal(row, cNotes) : ''
        });
      }
      outings.sort(function(a, b) {
        var tA = new Date(a.date + (a.time ? 'T' + a.time : ''));
        var tB = new Date(b.date + (b.time ? 'T' + b.time : ''));
        return tA - tB;
      });
      return { success: true, outings: outings };
    });
  }

  function getCourses() {
    return fetchSheetRows('Courses').then(function(rows) {
      const courses = [];
      if (rows.length < 2) return { success: true, courses: courses };
      const headers = rows[0].map(function(h) { return String(h).trim(); });
      const cName = colIndex(headers, 'CourseName');
      const cPar = colIndex(headers, 'ParIndx');
      const cUrl = colIndex(headers, 'CourseURL');
      const cMap = colIndex(headers, 'CourseMaploc');
      const cClub = colIndex(headers, 'ClubName');
      const cImg = colIndex(headers, 'CourseImage');
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        var name = cName >= 0 ? rowVal(row, cName) : '';
        if (!name) continue;
        var course = {
          courseName: name,
          parIndx: cPar >= 0 ? rowVal(row, cPar) : '',
          courseURL: cUrl >= 0 ? rowVal(row, cUrl) : '',
          courseMaploc: cMap >= 0 ? rowVal(row, cMap) : '',
          clubName: cClub >= 0 ? rowVal(row, cClub) : ''
        };
        if (cImg >= 0) course.courseImage = rowVal(row, cImg);
        courses.push(course);
      }
      return { success: true, courses: courses };
    });
  }

  function getSocietyAdminData(societyId) {
    return Promise.all([
      getSociety(societyId),
      getPlayers(societyId),
      getOutings(societyId)
    ]).then(function(results) {
      var societyRes = results[0];
      if (!societyRes.success || !societyRes.society) {
        return societyRes;
      }
      return {
        success: true,
        society: societyRes.society,
        players: results[1].players || [],
        outings: results[2].outings || []
      };
    });
  }

  function getScorecardData(societyId) {
    return Promise.all([
      getOutings(societyId),
      getCourses(),
      getPlayers(societyId)
    ]).then(function(results) {
      var outings = results[0].outings || [];
      var allCourses = results[1].courses || [];
      var players = results[2].players || [];
      var courseNorm = {};
      outings.forEach(function(o) {
        var cn = (o.courseName || '').toLowerCase().replace(/\s+/g, '');
        if (cn) courseNorm[cn] = o.courseName;
      });
      var courses = allCourses.filter(function(c) {
        var norm = (c.courseName || '').toLowerCase().replace(/\s+/g, '');
        return courseNorm[norm];
      });
      return { success: true, outings: outings, courses: courses, players: players };
    });
  }

  function loadScores(params) {
    var societyId = params.societyId || '';
    var playerName = params.playerName || '';
    var course = params.course || '';
    var limit = parseInt(params.limit || '50', 10) || 50;
    if (!societyId) return Promise.resolve({ success: false, error: 'societyId is required' });

    return fetchSheetRows('Scores').then(function(rows) {
      var scores = [];
      if (rows.length < 2) return { success: true, scores: scores };
      var headers = rows[0].map(function(h) { return String(h).trim(); });
      var cSid = colIndex(headers, 'SocietyID');
      var cPlayer = colIndex(headers, 'PlayerName');
      var cCourse = colIndex(headers, 'CourseName');
      var cDate = colIndex(headers, 'Date');
      var cHcap = colIndex(headers, 'Handicap');
      var holeCols = [];
      var ptsCols = [];
      for (var h = 1; h <= 18; h++) {
        holeCols.push(colIndex(headers, 'Hole' + h));
        ptsCols.push(colIndex(headers, 'Points' + h));
      }
      var cTotalScore = colIndex(headers, 'Total Score');
      var cTotalPoints = colIndex(headers, 'Total Points');
      var cOutScore = colIndex(headers, 'Out Score');
      var cOutPoints = colIndex(headers, 'Out Points');
      var cInScore = colIndex(headers, 'In Score');
      var cInPoints = colIndex(headers, 'In Points');
      var cBack6Score = colIndex(headers, 'Back 6 Score');
      var cBack6Points = colIndex(headers, 'Back 6 Points');
      var cBack3Score = colIndex(headers, 'Back 3 Score');
      var cBack3Points = colIndex(headers, 'Back 3 Points');
      var cTimestamp = colIndex(headers, 'Timestamp');
      var sid = String(societyId).toLowerCase();
      function normName(n) { return (n || '').toLowerCase().replace(/\s+/g, ''); }

      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        if (rowVal(row, cSid).toLowerCase() !== sid) continue;
        var rowPlayer = rowVal(row, cPlayer);
        if (!rowPlayer) continue;
        if (playerName && normName(rowPlayer) !== normName(playerName)) continue;
        if (course && rowVal(row, cCourse) !== course) continue;

        var dateStr = normalizeDateStr(rowVal(row, cDate));
        var holes = [];
        var holePoints = [];
        for (var h = 0; h < 18; h++) {
          holes.push(holeCols[h] >= 0 ? rowVal(row, holeCols[h]) : '');
          holePoints.push(ptsCols[h] >= 0 ? rowNum(row, ptsCols[h]) : 0);
        }
        var timestamp = cTimestamp >= 0 ? rowVal(row, cTimestamp) : '';
        scores.push({
          playerName: rowPlayer,
          course: rowVal(row, cCourse),
          date: dateStr,
          handicap: cHcap >= 0 ? rowNum(row, cHcap) : 0,
          holes: holes,
          holePoints: holePoints,
          totalScore: cTotalScore >= 0 ? rowNum(row, cTotalScore) : 0,
          totalPoints: cTotalPoints >= 0 ? rowNum(row, cTotalPoints) : 0,
          outScore: cOutScore >= 0 ? rowNum(row, cOutScore) : 0,
          outPoints: cOutPoints >= 0 ? rowNum(row, cOutPoints) : 0,
          inScore: cInScore >= 0 ? rowNum(row, cInScore) : 0,
          inPoints: cInPoints >= 0 ? rowNum(row, cInPoints) : 0,
          back6Score: cBack6Score >= 0 ? rowNum(row, cBack6Score) : 0,
          back6Points: cBack6Points >= 0 ? rowNum(row, cBack6Points) : 0,
          back3Score: cBack3Score >= 0 ? rowNum(row, cBack3Score) : 0,
          back3Points: cBack3Points >= 0 ? rowNum(row, cBack3Points) : 0,
          timestamp: timestamp
        });
      }
      scores.sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
      return { success: true, scores: scores.slice(0, limit) };
    });
  }

  function getReadResponse(params, societyId) {
    var action = params.action;
    var sid = societyId || (params && params.societyId) || (typeof AppConfig !== 'undefined' && AppConfig.getSocietyId ? AppConfig.getSocietyId() : null);

    if (action === 'getAllSocieties') return getAllSocieties();
    if (action === 'getCourses') return getCourses();
    if (action === 'getSociety') return getSociety(sid);
    if (action === 'getPlayers') return getPlayers(sid);
    if (action === 'getOutings') return getOutings(sid);
    if (action === 'getSocietyAdminData') return getSocietyAdminData(sid);
    if (action === 'getScorecardData') return getScorecardData(sid);
    if (action === 'loadScores') return loadScores({
      societyId: sid,
      playerName: params.playerName || '',
      course: params.course || '',
      limit: params.limit || 50
    });
    return Promise.reject(new Error('Unknown read action: ' + action));
  }

  global.SheetsRead = {
    isReadAction: isReadAction,
    getReadResponse: getReadResponse
  };
})(typeof window !== 'undefined' ? window : this);
