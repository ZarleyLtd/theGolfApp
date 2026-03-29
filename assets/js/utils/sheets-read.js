/**
 * Sheets Read – fast read path: load data from published Google Sheet CSV.
 * ApiClient.get uses this by default for read actions (no _useAppsScript).
 * For a post-update refresh, callers pass _useAppsScript: true so the request goes to the backend instead.
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
    'getSocietyAdminData', 'getScorecardData',
    'getOutingTeams'
  ];
  var SUPPORTED_READ_ACTIONS = READ_ACTIONS.concat(['loadScores', 'checkExistingScore']);
  // loadScores/checkExistingScore are supported here but are opt-in from ApiClient.

  function isReadAction(action) {
    return READ_ACTIONS.indexOf(action) >= 0;
  }
  function canHandleAction(action) {
    return SUPPORTED_READ_ACTIONS.indexOf(action) >= 0;
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
      const cPlayerId = colIndex(headers, 'PlayerId');
      const cName = colIndex(headers, 'PlayerName');
      const cHcap = colIndex(headers, 'Handicap');
      const sid = String(societyId || '').toLowerCase();
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        if (rowVal(row, cSid).toLowerCase() !== sid) continue;
        var name = rowVal(row, cName);
        if (!name) continue;
        var playerId = cPlayerId >= 0 ? rowVal(row, cPlayerId) : '';
        players.push({
          playerId: playerId || undefined,
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
      const cOutingId = colIndex(headers, 'OutingId');
      const cDate = colIndex(headers, 'Date');
      const cTime = colIndex(headers, 'Time');
      const cCourse = colIndex(headers, 'CourseName');
      const cComps = colIndex(headers, 'Comps') >= 0 ? colIndex(headers, 'Comps') : colIndex(headers, 'Notes');
      const sid = String(societyId || '').toLowerCase();
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        if (rowVal(row, cSid).toLowerCase() !== sid) continue;
        var dateStr = normalizeDateStr(rowVal(row, cDate));
        if (!dateStr) continue;
        var outingId = cOutingId >= 0 ? rowVal(row, cOutingId) : '';
        outings.push({
          outingId: outingId || undefined,
          date: dateStr,
          time: cTime >= 0 ? normalizeTimeStr(rowVal(row, cTime)) : '',
          courseName: cCourse >= 0 ? rowVal(row, cCourse) : '',
          comps: cComps >= 0 ? rowVal(row, cComps) : ''
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

  function parseTeamMembersCell(cellVal) {
    return String(cellVal || '').split(/[,\s]+/).map(function(s) { return s.trim(); }).filter(Boolean);
  }

  function getOutingTeams(societyId, params) {
    var sid = String(societyId || '').toLowerCase();
    var filterOutingId = String(params.outingId || '').trim();
    var filterCourse = String(params.courseName || '').trim().toLowerCase();
    var filterDate = normalizeDateStr(String(params.date || '').trim());
    var filterTime = normalizeTimeStr(String(params.time || '').trim());
    var singleOutingByLegacy = !!(filterCourse && filterDate) && !filterOutingId;

    function fetchTeams() {
      var url = SheetsConfig.getSheetUrl('Teams');
      if (!url) return Promise.resolve([]);
      return fetch(url, { method: 'GET', redirect: 'follow' }).then(function(r) { return r.text(); }).then(parseCSV);
    }

    return fetchTeams().then(function(teamRows) {
      if (teamRows.length < 2) {
        if (filterOutingId || singleOutingByLegacy) return { success: true, teams: [] };
        return { success: true, teamsByOuting: {} };
      }

      var tHeaders = (teamRows[0] || []).map(function(h) { return String(h).trim(); });
      var cSidT = colIndex(tHeaders, 'SocietyID');
      var cOutingIdT = colIndex(tHeaders, 'OutingId');
      var cTeamIdT = colIndex(tHeaders, 'TeamId');
      var cTeamNameT = colIndex(tHeaders, 'TeamName');
      var cTeamMembersT = colIndex(tHeaders, 'TeamMembers');

      if (cOutingIdT < 0) {
        if (filterOutingId || singleOutingByLegacy) return { success: true, teams: [] };
        return { success: true, teamsByOuting: {} };
      }

      function fillTeamFromRow(row, playerIdToName) {
        var teamId = cTeamIdT >= 0 ? rowVal(row, cTeamIdT) : '';
        var teamName = cTeamNameT >= 0 ? rowVal(row, cTeamNameT) : '';
        var cellVal = cTeamMembersT >= 0 ? rowVal(row, cTeamMembersT) : '';
        var ids = parseTeamMembersCell(cellVal);
        var team = { teamId: teamId, teamName: teamName, playerNames: [], playerIds: [] };
        for (var k = 0; k < ids.length; k++) {
          var pid = ids[k];
          team.playerIds.push(pid);
          team.playerNames.push(playerIdToName[pid] || pid);
        }
        return team;
      }

      function buildWithPlayers(effectiveOutingId) {
        return getPlayers(sid).then(function(playersRes) {
          var playerIdToName = {};
          var plist = (playersRes && playersRes.players) || [];
          plist.forEach(function(p) {
            var pid = (p.playerId || '').toString().trim();
            if (pid) playerIdToName[pid] = (p.playerName || '').trim();
          });

          if (effectiveOutingId) {
            var teams = [];
            for (var i = 1; i < teamRows.length; i++) {
              var row = teamRows[i];
              if (rowVal(row, cSidT).toLowerCase() !== sid) continue;
              if (String(rowVal(row, cOutingIdT) || '').trim() !== effectiveOutingId) continue;
              teams.push(fillTeamFromRow(row, playerIdToName));
            }
            return { success: true, teams: teams };
          }

          var teamsByOuting = {};
          for (var j = 1; j < teamRows.length; j++) {
            var row2 = teamRows[j];
            if (rowVal(row2, cSidT).toLowerCase() !== sid) continue;
            var rowOutingId = String(rowVal(row2, cOutingIdT) || '').trim();
            if (!rowOutingId) continue;
            if (!teamsByOuting[rowOutingId]) teamsByOuting[rowOutingId] = [];
            teamsByOuting[rowOutingId].push(fillTeamFromRow(row2, playerIdToName));
          }
          return { success: true, teamsByOuting: teamsByOuting };
        });
      }

      if (singleOutingByLegacy) {
        return getOutings(sid).then(function(outRes) {
          var outings = (outRes && outRes.outings) || [];
          var resolved = '';
          for (var oi = 0; oi < outings.length; oi++) {
            var o = outings[oi];
            var oCourse = String(o.courseName || '').trim().toLowerCase();
            var oDate = o.date instanceof Date
              ? normalizeDateStr(o.date.toISOString().split('T')[0])
              : normalizeDateStr(String(o.date || ''));
            var oTime = '';
            if (o.time instanceof Date) {
              oTime = normalizeTimeStr(
                o.time.getHours().toString().padStart(2, '0') + ':' + o.time.getMinutes().toString().padStart(2, '0')
              );
            } else {
              oTime = normalizeTimeStr(String(o.time || ''));
            }
            if (oCourse === filterCourse && oDate === filterDate && (!filterTime || oTime === filterTime)) {
              resolved = String(o.outingId || '').trim();
              break;
            }
          }
          if (!resolved) return { success: true, teams: [] };
          return buildWithPlayers(resolved);
        });
      }

      if (filterOutingId) {
        return buildWithPlayers(filterOutingId);
      }

      return buildWithPlayers('');
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
    var playerId = params.playerId || '';
    var course = params.course || '';
    var outingId = params.outingId || '';
    var limit = parseInt(params.limit || '50', 10) || 50;
    var maxFastRows = parseInt(params.maxFastRows || params.fastMaxRows || '0', 10) || 0;
    if (!societyId) return Promise.resolve({ success: false, error: 'societyId is required' });

    return fetchSheetRows('Scores').then(function(rows) {
      if (rows.length < 2) return { success: true, scores: [] };
      var rowCount = Math.max(0, rows.length - 1);
      if (maxFastRows > 0 && rowCount > maxFastRows) {
        var tooLargeErr = new Error('Scores sheet too large for fast read');
        tooLargeErr.code = 'FAST_READ_TOO_LARGE';
        tooLargeErr.meta = { sheet: 'Scores', rowCount: rowCount, maxFastRows: maxFastRows };
        throw tooLargeErr;
      }
      var headers = rows[0].map(function(h) { return String(h).trim(); });
      var cSid = colIndex(headers, 'SocietyID');
      var cOutingId = colIndex(headers, 'OutingId');
      var cPlayerId = colIndex(headers, 'PlayerId');
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
      var filterOutingId = String(outingId || '').trim();
      var filterPlayerId = String(playerId || '').trim();
      var filterCourse = String(course || '').trim().toLowerCase();
      function normText(v) { return String(v || '').trim().toLowerCase(); }
      function normName(n) { return (n || '').toLowerCase().replace(/\s+/g, ''); }
      var hasIdSchema = cOutingId >= 0 && cPlayerId >= 0;

      function buildScoreObject(base) {
        var row = base.row;
        var holes = [];
        var holePoints = [];
        for (var h = 0; h < 18; h++) {
          holes.push(holeCols[h] >= 0 ? rowVal(row, holeCols[h]) : '');
          holePoints.push(ptsCols[h] >= 0 ? rowNum(row, ptsCols[h]) : 0);
        }
        var timestamp = cTimestamp >= 0 ? rowVal(row, cTimestamp) : '';
        return {
          outingId: base.outingId || '',
          playerId: base.playerId || '',
          playerName: base.playerName || '',
          course: base.course || '',
          date: base.date || '',
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
        };
      }

      if (hasIdSchema) {
        return Promise.all([fetchSheetRows('Outings'), fetchSheetRows('Players')]).then(function(joinRows) {
          var outingsRows = joinRows[0] || [];
          var playersRows = joinRows[1] || [];
          var outingById = {};
          if (outingsRows.length > 1) {
            var oh = outingsRows[0].map(function(h) { return String(h).trim(); });
            var oSid = colIndex(oh, 'SocietyID');
            var oOutingId = colIndex(oh, 'OutingId');
            var oDate = colIndex(oh, 'Date');
            var oCourse = colIndex(oh, 'CourseName');
            for (var oi = 1; oi < outingsRows.length; oi++) {
              var orow = outingsRows[oi];
              if (oSid >= 0 && rowVal(orow, oSid).toLowerCase() !== sid) continue;
              var oid = oOutingId >= 0 ? rowVal(orow, oOutingId) : '';
              if (!oid) continue;
              outingById[oid] = {
                date: normalizeDateStr(oDate >= 0 ? rowVal(orow, oDate) : ''),
                courseName: oCourse >= 0 ? rowVal(orow, oCourse) : ''
              };
            }
          }

          var playerById = {};
          if (playersRows.length > 1) {
            var ph = playersRows[0].map(function(h) { return String(h).trim(); });
            var pSid = colIndex(ph, 'SocietyID');
            var pPlayerId = colIndex(ph, 'PlayerId');
            var pName = colIndex(ph, 'PlayerName');
            for (var pi = 1; pi < playersRows.length; pi++) {
              var prow = playersRows[pi];
              if (pSid >= 0 && rowVal(prow, pSid).toLowerCase() !== sid) continue;
              var pid = pPlayerId >= 0 ? rowVal(prow, pPlayerId) : '';
              if (!pid) continue;
              playerById[pid] = pName >= 0 ? rowVal(prow, pName) : '';
            }
          }

          var scores = [];
          for (var i = 1; i < rows.length; i++) {
            var row = rows[i];
            if (cSid >= 0 && rowVal(row, cSid).toLowerCase() !== sid) continue;
            var rowOutingId = rowVal(row, cOutingId);
            var rowPlayerId = rowVal(row, cPlayerId);
            if (!rowOutingId || !rowPlayerId) continue;
            if (filterOutingId && rowOutingId !== filterOutingId) continue;
            if (filterPlayerId && rowPlayerId !== filterPlayerId) continue;
            var outingRef = outingById[rowOutingId] || { date: '', courseName: '' };
            var rowCourse = outingRef.courseName || '';
            var rowPlayerName = playerById[rowPlayerId] || rowPlayerId;
            if (filterCourse && normText(rowCourse) !== filterCourse) continue;
            if (playerName && normName(rowPlayerName) !== normName(playerName)) continue;

            scores.push(buildScoreObject({
              row: row,
              outingId: rowOutingId,
              playerId: rowPlayerId,
              playerName: rowPlayerName,
              course: rowCourse,
              date: outingRef.date || ''
            }));
          }

          scores.sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
          return { success: true, scores: scores.slice(0, limit), meta: { source: 'fast', rowCount: rowCount } };
        });
      }

      var scores = [];
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        if (cSid >= 0 && rowVal(row, cSid).toLowerCase() !== sid) continue;
        var rowPlayer = rowVal(row, cPlayer);
        if (!rowPlayer) continue;
        if (playerName && normName(rowPlayer) !== normName(playerName)) continue;
        if (filterCourse && normText(rowVal(row, cCourse)) !== filterCourse) continue;

        scores.push(buildScoreObject({
          row: row,
          playerName: rowPlayer,
          course: rowVal(row, cCourse),
          date: normalizeDateStr(rowVal(row, cDate))
        }));
      }
      scores.sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
      return { success: true, scores: scores.slice(0, limit), meta: { source: 'fast', rowCount: rowCount } };
    });
  }

  /** Check if a score exists for player + course + date + time. Returns { success, exists, score? }. */
  function checkExistingScore(societyId, params) {
    var playerName = String(params.playerName || '').trim();
    var course = String(params.course || '').trim();
    var searchDate = String(params.date || '').trim();
    var searchTime = String(params.time || '').trim();
    if (!playerName || !course || !searchDate || !searchTime) {
      return Promise.resolve({ success: true, exists: false });
    }
    var sid = String(societyId || '').toLowerCase();
    var normDate = normalizeDateStr(searchDate);
    var normTime = normalizeTimeStr(searchTime);
    function normName(n) { return (n || '').toLowerCase().replace(/\s+/g, ''); }
    var normalizedPlayer = normName(playerName);
    var courseLower = course.toLowerCase();

    return fetchSheetRows('Scores').then(function(rows) {
      if (rows.length < 2) return { success: true, exists: false };
      var headers = rows[0].map(function(h) { return String(h).trim(); });
      var cSid = colIndex(headers, 'SocietyID');
      var cPlayer = colIndex(headers, 'PlayerName');
      var cCourse = colIndex(headers, 'CourseName');
      var cDate = colIndex(headers, 'Date');
      var cTime = colIndex(headers, 'Time');
      var cHcap = colIndex(headers, 'Handicap');
      var holeCols = [], ptsCols = [];
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

      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        if (rowVal(row, cSid).toLowerCase() !== sid) continue;
        if (normName(rowVal(row, cPlayer)) !== normalizedPlayer) continue;
        if (rowVal(row, cCourse).toLowerCase() !== courseLower) continue;
        if (normalizeDateStr(rowVal(row, cDate)) !== normDate) continue;
        var rowTime = cTime >= 0 ? normalizeTimeStr(rowVal(row, cTime)) : '';
        if (rowTime !== normTime) continue;

        var holes = [];
        var holePoints = [];
        for (var h = 0; h < 18; h++) {
          holes.push(holeCols[h] >= 0 ? rowVal(row, holeCols[h]) : '');
          holePoints.push(ptsCols[h] >= 0 ? rowNum(row, ptsCols[h]) : 0);
        }
        var timestamp = cTimestamp >= 0 ? rowVal(row, cTimestamp) : '';
        var dateVal = rowVal(row, cDate);
        if (dateVal && String(dateVal).indexOf('T') !== -1) dateVal = String(dateVal).split('T')[0];
        var score = {
          playerName: rowVal(row, cPlayer),
          course: rowVal(row, cCourse),
          date: dateVal || searchDate,
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
        };
        return { success: true, exists: true, score: score };
      }
      return { success: true, exists: false };
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
      playerId: params.playerId || '',
      course: params.course || '',
      outingId: params.outingId || '',
      limit: params.limit || 50,
      maxFastRows: params.maxFastRows || params.fastMaxRows || 0
    });
    if (action === 'checkExistingScore') return checkExistingScore(sid, params);
    if (action === 'getOutingTeams') return getOutingTeams(sid, {
      outingId: params.outingId || '',
      courseName: params.courseName || '',
      date: params.date || '',
      time: params.time || ''
    });
    return Promise.reject(new Error('Unknown read action: ' + action));
  }

  global.SheetsRead = {
    isReadAction: isReadAction,
    canHandleAction: canHandleAction,
    getReadResponse: getReadResponse
  };
})(typeof window !== 'undefined' ? window : this);
