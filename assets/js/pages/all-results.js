/**
 * All Results page: Players / Teams tabs, per-outing comp rows with leaderboard-style detail.
 * Depends: Formatters, ApiClient, AppConfig, requireSociety, LeaderboardShared (as LS).
 */
(function () {
  'use strict';

  var LS = window.LeaderboardShared;
  if (!LS) {
    console.error('LeaderboardShared not loaded');
    return;
  }

  function formatNumber(num) {
    if (num == null || num === '') return '-';
    var n = parseFloat(num);
    return isNaN(n) ? '-' : n.toString();
  }

  function outingKey(course, date) {
    return (course || '').trim().toLowerCase() + '|' + (date || '').trim();
  }

  function escapeDetailAttr(html) {
    return String(html || '')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function scoreFingerprint(scores) {
    var list = Array.isArray(scores) ? scores : [];
    var parts = [String(list.length)];
    var maxCompare = Math.min(list.length, 60);
    for (var i = 0; i < maxCompare; i++) {
      var sc = list[i] || {};
      parts.push(
        [String(sc.playerName || ''), String(sc.course || ''), String(sc.date || ''), String(sc.totalPoints || ''), String(sc.timestamp || '')].join(
          '~'
        )
      );
    }
    return parts.join('|');
  }

  /** Players tab: Comp (LB pos styling) | Pos (LB name styling) | Points. Hcp shown in outing header only. */
  function rowPairPlayer(compHtml, posHtml, ptsHtml, detailHtml) {
    var esc = escapeDetailAttr(detailHtml);
    var block =
      '<div class="lb-outing-block"><div class="lb-outing-main lb-outing-row lb-outing-row--player" data-detail-html="' +
      esc +
      '">' +
      '<span class="lb-cell-comp leaderboard-position">' +
      compHtml +
      '</span><span class="lb-cell-pos leaderboard-player-name">' +
      posHtml +
      '</span><span class="lb-cell-pts leaderboard-points">' +
      ptsHtml +
      '</span></div>' +
      '<div class="lb-hole-detail-panel"></div></div>';
    var table =
      '<tr class="lb-outing-row" data-detail-html="' +
      esc +
      '">' +
      '<td class="leaderboard-position lb-ar-comp">' +
      compHtml +
      '</td>' +
      '<td class="leaderboard-player-name lb-ar-pos">' +
      posHtml +
      '</td>' +
      '<td class="text-right leaderboard-points">' +
      ptsHtml +
      '</td></tr>' +
      '<tr class="lb-detail-row lb-detail-row--table"><td colspan="3">' +
      detailHtml +
      '</td></tr>';
    return { block: block, table: table };
  }

  /** Teams tab (All Results): Pos | Name (+ member first names) | Points — no Hcp column. */
  function rowPairTeam(posHtml, nameCombinedHtml, ptsHtml, detailHtml) {
    var esc = escapeDetailAttr(detailHtml);
    var block =
      '<div class="lb-outing-block"><div class="lb-outing-main lb-outing-row lb-outing-row--team-ar" data-detail-html="' +
      esc +
      '">' +
      '<span class="lb-cell-pos">' +
      posHtml +
      '</span><span class="lb-cell-name lb-cell-name--team-ar">' +
      nameCombinedHtml +
      '</span><span class="lb-cell-pts">' +
      ptsHtml +
      '</span></div>' +
      '<div class="lb-hole-detail-panel"></div></div>';
    var table =
      '<tr class="lb-outing-row" data-detail-html="' +
      esc +
      '">' +
      '<td class="leaderboard-position">' +
      posHtml +
      '</td>' +
      '<td class="leaderboard-player-name lb-name-cell lb-name-cell--team-ar">' +
      nameCombinedHtml +
      '</td>' +
      '<td class="text-right leaderboard-points">' +
      ptsHtml +
      '</td></tr>' +
      '<tr class="lb-detail-row lb-detail-row--table"><td colspan="3">' +
      detailHtml +
      '</td></tr>';
    return { block: block, table: table };
  }

  /** Build one expandable row (mobile block + desktop table) matching leaderboard pattern. */
  function rowPair(posHtml, nameHtml, hcpHtml, ptsHtml, detailHtml) {
    var esc = escapeDetailAttr(detailHtml);
    var block =
      '<div class="lb-outing-block"><div class="lb-outing-main lb-outing-row" data-detail-html="' +
      esc +
      '">' +
      '<span class="lb-cell-pos">' +
      posHtml +
      '</span><span class="lb-cell-name">' +
      nameHtml +
      '</span>' +
      '<span class="lb-cell-hcp">' +
      hcpHtml +
      '</span><span class="lb-cell-pts">' +
      ptsHtml +
      '</span></div>' +
      '<div class="lb-hole-detail-panel"></div></div>';
    var table =
      '<tr class="lb-outing-row" data-detail-html="' +
      esc +
      '">' +
      '<td class="leaderboard-position">' +
      posHtml +
      '</td>' +
      '<td class="leaderboard-player-name lb-name-cell">' +
      nameHtml +
      '</td>' +
      '<td class="text-center leaderboard-section">' +
      hcpHtml +
      '</td>' +
      '<td class="text-right leaderboard-points">' +
      ptsHtml +
      '</td></tr>' +
      '<tr class="lb-detail-row lb-detail-row--table"><td colspan="4">' +
      detailHtml +
      '</td></tr>';
    return { block: block, table: table };
  }

  function buildCourseParMap(courses) {
    var courseParMap = {};
    for (var c = 0; c < courses.length; c++) {
      var cn = (courses[c].courseName || '').trim().toLowerCase();
      if (!cn) continue;
      var pars = LS.parseParIndx(courses[c].parIndx);
      var parIndexPairs = LS.parseParIndexPairs(courses[c].parIndx);
      courseParMap[cn] = { pars: pars, par3Indices: LS.getPar3Indices(pars), parIndexPairs: parIndexPairs };
    }
    return courseParMap;
  }

  function outingDisplayName(oKey, courseKeyToDisplayName) {
    var coursePart = (oKey || '').split('|')[0] || '';
    return courseKeyToDisplayName[coursePart] || coursePart || oKey;
  }

  /**
   * Returns { html: string } for one outing section for selected player, or null if no player score.
   */
  function renderPlayerOutingSection(
    oKey,
    scoresByOuting,
    outings,
    courses,
    courseKeyToDisplayName,
    courseParMap,
    playerNameLower,
    isVisitorScore
  ) {
    isVisitorScore = isVisitorScore || function () {
      return false;
    };
    var keyParts = oKey.split('|');
    var courseName = keyParts[0] || oKey;
    var outingDateStr = keyParts[1] || '';
    var rawScores = (scoresByOuting[oKey] || []).slice();
    var byPlayer = {};
    for (var ri = 0; ri < rawScores.length; ri++) {
      var rs = rawScores[ri];
      var pkey = (rs.playerName || '').trim().toLowerCase();
      if (!pkey) continue;
      var pts = parseFloat(rs.totalPoints) || 0;
      if (!byPlayer[pkey] || (parseFloat(byPlayer[pkey].totalPoints) || 0) < pts) byPlayer[pkey] = rs;
    }
    var playerSc = byPlayer[playerNameLower];
    if (!playerSc) return null;

    var outingScores = [];
    for (var pk in byPlayer) outingScores.push(byPlayer[pk]);

    var courseNameDisplay = courseName;
    if (courses.length) {
      for (var x = 0; x < courses.length; x++) {
        if ((courses[x].courseName || '').trim().toLowerCase() === courseName) {
          courseNameDisplay = (courses[x].courseName || courseName).trim();
          break;
        }
      }
    }
    if (courseNameDisplay === courseName && outingScores[0] && (outingScores[0].course || '').trim()) {
      courseNameDisplay = outingScores[0].course.trim();
    }

    var courseData = courseParMap[courseName];
    var par3Indices = courseData && courseData.par3Indices ? courseData.par3Indices : [];
    var parIndexPairs = courseData && courseData.parIndexPairs ? courseData.parIndexPairs : [];

    var firstScoreDate = outingDateStr || (outingScores[0] && outingScores[0].date) || '';
    var scoreDates = outingScores.map(function (s) {
      return s.date;
    });
    var compsStr = LS.getCompsForScores(outings, courseName, outingDateStr || firstScoreDate, scoreDates);
    var comps = LS.parseComps(compsStr);

    var outingScores18 = comps.excludeVisitors18
      ? outingScores.filter(function (s) {
          return !isVisitorScore(s);
        })
      : outingScores;
    var rank18 = LS.rankAllWithCountback(outingScores18, LS.compareCountbackOverall, LS.getCountbackLabelOverall);
    var place18 = LS.findRankForPlayerName(rank18, playerNameLower);
    var outingScores66 = comps.excludeVisitors66
      ? outingScores.filter(function (s) {
          return !isVisitorScore(s);
        })
      : outingScores;
    var rank66 = comps.show66 ? LS.rankAllWithCountback(outingScores66, LS.compareCountback66, LS.getCountbackLabel66) : [];

    var par3Candidates = [];
    if (par3Indices.length) {
      for (var q = 0; q < outingScores.length; q++) {
        var sq = outingScores[q];
        if (comps.excludeVisitorsP3 && isVisitorScore(sq)) continue;
        var holes = sq.holes || [];
        var holePoints = sq.holePoints || [];
        var par3Strokes = 0,
          par3Points = 0;
        var labels = [];
        var hasAllPar3Scores = true;
        for (var hi = 0; hi < par3Indices.length; hi++) {
          var idx = par3Indices[hi];
          var stroke = parseInt(holes[idx], 10);
          if (!isNaN(stroke) && stroke > 0) {
            par3Strokes += stroke;
          } else {
            hasAllPar3Scores = false;
          }
          var pt = parseFloat(holePoints[idx]) || 0;
          par3Points += pt;
          labels.push(LS.par3StrokeToLabel(holes[idx]));
        }
        if (hasAllPar3Scores) {
          par3Candidates.push({ score: sq, par3Strokes: par3Strokes, par3Points: par3Points, labels: labels });
        }
      }
      par3Candidates.sort(function (a, b) {
        return LS.comparePar3Candidates(a, b, comps.p3UsePoints);
      });
    }
    var rankP3 =
      comps.showP3 && par3Indices.length
        ? LS.rankAllWithCountback(par3Candidates, function (a, b) {
            return LS.comparePar3Candidates(a, b, comps.p3UsePoints);
          }, null)
        : [];

    var holes2 = playerSc.holes || [];
    var indices2s = [];
    for (var h2 = 0; h2 < 18; h2++) {
      if (parseInt(holes2[h2], 10) === 2) indices2s.push(h2);
    }

    var blocks = [];
    var tables = [];

    var compOverall = Formatters.escapeHtml('18-Hole');
    var comp66 = Formatters.escapeHtml('66');
    var compP3 = Formatters.escapeHtml('Par 3s');
    var comp2s = Formatters.escapeHtml('Two\'s');

    var d18 = LS.buildHoleDetailHtml(playerSc, parIndexPairs);
    var pos18 = place18 ? place18.label : '—';
    var r18 = rowPairPlayer(
      compOverall,
      pos18,
      LS.formatPointsWithCountback(playerSc.totalPoints, place18 ? place18.countbackLabel : null, formatNumber),
      d18
    );
    blocks.push(r18.block);
    tables.push(r18.table);

    if (comps.show66) {
      var p66 = LS.findRankForPlayerName(rank66, playerNameLower);
      if (p66) {
        var pts66 = LS.points66(playerSc);
        var d = LS.buildHoleDetailHtml(playerSc, parIndexPairs, null, LS.indices66(playerSc));
        var r = rowPairPlayer(
          comp66,
          p66.label,
          LS.formatPointsWithCountback(pts66, p66.countbackLabel, formatNumber),
          d
        );
        blocks.push(r.block);
        tables.push(r.table);
      }
    }
    if (comps.showP3 && par3Indices.length) {
      var p3Row = null;
      for (var pi = 0; pi < par3Candidates.length; pi++) {
        if ((par3Candidates[pi].score.playerName || '').trim().toLowerCase() === playerNameLower) {
          p3Row = par3Candidates[pi];
          break;
        }
      }
      if (p3Row) {
        var p3p = LS.findRankForPar3Candidate(rankP3, playerNameLower);
        var tcVal = comps.p3UsePoints ? p3Row.par3Points : p3Row.par3Strokes;
        var p3Suffix = comps.p3UsePoints ? ' pts' : ' strokes';
        var d = LS.buildHoleDetailHtml(p3Row.score, parIndexPairs, par3Indices, undefined, comps.p3UsePoints);
        var posLab = p3p ? p3p.label : '—';
        var r = rowPairPlayer(
          compP3,
          posLab,
          formatNumber(tcVal) + p3Suffix,
          d
        );
        blocks.push(r.block);
        tables.push(r.table);
      }
    }
    if (comps.show2s && indices2s.length > 0 && !(comps.excludeVisitors2s && isVisitorScore(playerSc))) {
      var d = LS.buildHoleDetailHtml(playerSc, parIndexPairs, null, undefined, undefined, indices2s);
      var twosNote = indices2s.length > 1 ? ' <span class="lb-twos-count">(x' + indices2s.length + ')</span>' : '';
      var r = rowPairPlayer(
        comp2s,
        '—',
        'Two\'s carded' + twosNote,
        d
      );
      blocks.push(r.block);
      tables.push(r.table);
    }

    var dateLine =
      '<span class="lb-section-title-subline">' +
      (outingDateStr ? '<span>' + Formatters.formatDate(outingDateStr) + '</span>' : '<span></span>') +
      '<span class="lb-section-title-scores" aria-hidden="true"></span></span>';

    var hcpHdr = formatNumber(playerSc.handicap);
    var titleRow =
      '<div class="lb-section-title-row"><h2 class="lb-section-title">' +
      Formatters.escapeHtml(courseNameDisplay) +
      ' <span class="lb-outing-title-hcp">(H/C: ' +
      Formatters.escapeHtml(hcpHdr) +
      ')</span></h2></div>' +
      dateLine;

    var blockHtml =
      '<div class="lb-section lb-section--outing lb-section--player" data-outing-key="' +
      Formatters.escapeHtml(oKey) +
      '">' +
      titleRow +
      '<div class="lb-outing-block-wrap">' +
      '<div class="lb-outing-header lb-outing-header--player"><span>Comp</span><span>Pos</span><span style="text-align:right">Points</span></div>' +
      blocks.join('') +
      '</div>' +
      '<div class="lb-table-scroll-wrap"><table class="leaderboard-table leaderboard-table--outing leaderboard-table--player">' +
      '<thead><tr><th>Comp</th><th>Pos</th><th class="text-right">Points</th></tr></thead><tbody>' +
      tables.join('') +
      '</tbody></table></div></div>';

    return { html: blockHtml };
  }

  function renderTeamsOutingSection(oKey, scoresByOuting, outings, courses, teamsByOuting, outingKeyToOutingId, courseParMap, outingObj, sectionDomId) {
    var keyParts = oKey.split('|');
    var courseName = keyParts[0] || oKey;
    var outingDateStr = keyParts[1] || '';
    var rawScores = (scoresByOuting[oKey] || []).slice();
    var byPlayer = {};
    for (var ri = 0; ri < rawScores.length; ri++) {
      var rs = rawScores[ri];
      var pkey = (rs.playerName || '').trim().toLowerCase();
      if (!pkey) continue;
      var pts = parseFloat(rs.totalPoints) || 0;
      if (!byPlayer[pkey] || (parseFloat(byPlayer[pkey].totalPoints) || 0) < pts) byPlayer[pkey] = rs;
    }
    var outingScores = [];
    for (var pk in byPlayer) outingScores.push(byPlayer[pk]);

    var courseData = courseParMap[courseName] || {};
    var parIndexPairs = courseData.parIndexPairs || [];

    var firstScoreDate = outingDateStr || (outingScores[0] && outingScores[0].date) || '';
    var scoreDates = outingScores.map(function (s) {
      return s.date;
    });
    var compsStr = LS.getCompsForScores(outings, courseName, outingDateStr || firstScoreDate, scoreDates);
    var comps = LS.parseComps(compsStr);
    var teamN = comps.teamN;
    var teamRule = comps.teamRule;

    var outingTeamsList = [];
    var outingIdForTeam = outingKeyToOutingId[oKey];
    if (outingIdForTeam && teamsByOuting[outingIdForTeam]) {
      outingTeamsList = teamsByOuting[outingIdForTeam];
    } else {
      var teamKey = null;
      for (var tk in teamsByOuting) {
        if (tk.indexOf(courseName + '|' + outingDateStr + '|') === 0) {
          teamKey = tk;
          break;
        }
      }
      outingTeamsList = teamKey ? teamsByOuting[teamKey] || [] : [];
    }
    var scoreByPlayer = {};
    for (var si = 0; si < outingScores.length; si++) {
      var s = outingScores[si];
      var pkey2 = (s.playerName || '').trim().toLowerCase();
      if (pkey2) scoreByPlayer[pkey2] = s;
    }

    var teamScores = [];
    for (var ttx = 0; ttx < outingTeamsList.length; ttx++) {
      var trec = outingTeamsList[ttx];
      var members = trec.playerNames || [];
      if (members.length === 0) {
        teamScores.push({ teamName: trec.teamName || 'Unnamed', score: 0, playerNames: [] });
        continue;
      }
      var teamPts = LS.computeTeamCompStablefordScore(members, scoreByPlayer, teamRule, teamN);
      teamScores.push({ teamName: trec.teamName || 'Unnamed', score: teamPts, playerNames: members.slice() });
    }
    teamScores.sort(function (a, b) {
      return b.score - a.score;
    });
    var teamRankRows = LS.rankTeamsByScore(teamScores);

    var blocks = [];
    var tables = [];
    for (var ti = 0; ti < teamRankRows.length; ti++) {
      var tier = teamRankRows[ti];
      for (var g = 0; g < tier.teams.length; g++) {
        var tm = tier.teams[g];
        var detailHtml = LS.buildTeamHoleDetailHtml(tm.playerNames || [], scoreByPlayer, parIndexPairs, teamRule, teamN);
        var nameHtml = LS.formatTeamDisplayNameHtml(tm.teamName, tm.playerNames || []);
        var r = rowPairTeam(tier.label, nameHtml, formatNumber(tm.score), detailHtml);
        blocks.push(r.block);
        tables.push(r.table);
      }
    }

    var courseNameDisplay = (outingObj && outingObj.courseName) || courseName;
    var teamCompSubtitle = LS.formatTeamCompetitionHeaderSubtitle(teamRule, teamN);
    var dateLine =
      '<span class="lb-section-title-subline">' +
      (outingDateStr ? '<span>' + Formatters.formatDate(outingDateStr) + '</span>' : '<span></span>') +
      '<span class="lb-section-title-scores">Teams</span></span>';

    if (!blocks.length) {
      return { html: '' };
    }

    var sectionIdAttr =
      sectionDomId && /^[a-zA-Z][\w-]*$/.test(sectionDomId) ? ' id="' + Formatters.escapeHtml(sectionDomId) + '"' : '';
    return {
      html:
        '<div class="lb-section lb-section--outing lb-section--teams-ar"' +
        sectionIdAttr +
        '>' +
        '<div class="lb-section-title-row"><h2 class="lb-section-title lb-section-title--teams-ar">' +
        Formatters.escapeHtml(String(courseNameDisplay).trim()) +
        '<span class="lb-section-title-team-comp"> ' +
        Formatters.escapeHtml(teamCompSubtitle) +
        '</span></h2></div>' +
        dateLine +
        '<div class="lb-outing-block-wrap">' +
        '<div class="lb-outing-header lb-outing-header--team-ar"><span>Pos</span><span>Name</span><span style="text-align:right">Points</span></div>' +
        blocks.join('') +
        '</div>' +
        '<div class="lb-table-scroll-wrap"><table class="leaderboard-table leaderboard-table--outing leaderboard-table--teams-ar">' +
        '<thead><tr><th>Pos</th><th>Name</th><th class="text-right">Points</th></tr></thead><tbody>' +
        tables.join('') +
        '</tbody></table></div></div>',
    };
  }

  function wireExpandClicks(container) {
    container.addEventListener('click', function (e) {
      var vw = window.innerWidth;
      var usePanel = vw <= 599;
      var row = e.target && e.target.closest && e.target.closest('tr.lb-outing-row');
      var blockRow = e.target && e.target.closest && e.target.closest('.lb-outing-main.lb-outing-row');
      var detailRow = e.target && e.target.closest && e.target.closest('tr.lb-detail-row');
      if (usePanel && blockRow) {
        var block = blockRow.closest('.lb-outing-block');
        var panel = block ? block.querySelector('.lb-hole-detail-panel') : null;
        if (blockRow.classList.contains('is-open')) {
          blockRow.classList.remove('is-open');
          if (panel) panel.classList.remove('is-visible');
          return;
        }
        var allPanels = container.querySelectorAll('.lb-hole-detail-panel');
        for (var p = 0; p < allPanels.length; p++) allPanels[p].classList.remove('is-visible');
        var openBlocks = container.querySelectorAll('.lb-outing-main.is-open');
        for (var o = 0; o < openBlocks.length; o++) openBlocks[o].classList.remove('is-open');
        var html = blockRow.getAttribute('data-detail-html');
        if (html && panel) {
          var decoded = html.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
          panel.innerHTML = decoded;
          panel.classList.add('is-visible');
          blockRow.classList.add('is-open');
        }
        return;
      }
      if (detailRow && detailRow.classList.contains('is-open')) {
        var prevRow = detailRow.previousElementSibling;
        if (prevRow && prevRow.classList) prevRow.classList.remove('is-open');
        detailRow.classList.remove('is-open');
        return;
      }
      if (!row) return;
      var table = row.closest('table');
      var next = row.nextElementSibling;
      if (!usePanel) {
        if (next && next.classList && next.classList.contains('lb-detail-row')) {
          var isOpen = next.classList.contains('is-open');
          if (table) {
            var open = table.querySelectorAll('tr.lb-detail-row.is-open');
            for (var i = 0; i < open.length; i++) open[i].classList.remove('is-open');
          }
          if (!isOpen) {
            next.classList.add('is-open');
            row.classList.add('is-open');
          }
        }
      }
    });
  }

  function initAllResultsPage(containerId, opts) {
    opts = opts || {};
    var container = document.getElementById(containerId);
    if (!container) {
      return {
        setState: function () {},
        renderPlayerContent: function () {},
        renderTeamsAllOutings: function () {},
      };
    }

    var state = {
      scores: [],
      outings: [],
      courses: [],
      teamsByOuting: {},
      players: [],
      overallStatus: '',
      courseKeyToDisplayName: {},
      outingKeyToOutingId: {},
    };

    function renderPlayerContent(playerName) {
      var playerNameLower = (playerName || '').trim().toLowerCase();
      var courseParMap = buildCourseParMap(state.courses);
      var scoresByOuting = {};
      for (var si = 0; si < state.scores.length; si++) {
        var sc = state.scores[si];
        var k = outingKey(sc.course, sc.date);
        if (!k || !k.split('|')[0]) continue;
        if (!scoresByOuting[k]) scoresByOuting[k] = [];
        scoresByOuting[k].push(sc);
      }
      var keys = [];
      for (var ok in scoresByOuting) {
        var raw = scoresByOuting[ok] || [];
        var bp = {};
        for (var r = 0; r < raw.length; r++) {
          var rs = raw[r];
          var pk = (rs.playerName || '').trim().toLowerCase();
          if (!pk) continue;
          var pts = parseFloat(rs.totalPoints) || 0;
          if (!bp[pk] || (parseFloat(bp[pk].totalPoints) || 0) < pts) bp[pk] = rs;
        }
        if (bp[playerNameLower]) keys.push(ok);
      }
      keys.sort(function (a, b) {
        var dA = new Date((a.split('|')[1] || '').trim());
        var dB = new Date((b.split('|')[1] || '').trim());
        return dA - dB;
      });
      if (keys.length === 0) {
        container.innerHTML = '<div class="no-scores"><p>No scores for this player yet.</p></div>';
        return;
      }
      var html = '';
      var isVisitorScore = LS.buildIsVisitorFromPlayers(state.players);
      for (var i = 0; i < keys.length; i++) {
        var sec = renderPlayerOutingSection(
          keys[i],
          scoresByOuting,
          state.outings,
          state.courses,
          state.courseKeyToDisplayName,
          courseParMap,
          playerNameLower,
          isVisitorScore
        );
        if (sec) html += sec.html;
      }
      container.innerHTML = html;
    }

    function renderTeamsAllOutings() {
      var courseParMap = buildCourseParMap(state.courses);
      var scoresByOuting = {};
      for (var si = 0; si < state.scores.length; si++) {
        var sc = state.scores[si];
        var k = outingKey(sc.course, sc.date);
        if (!k || !k.split('|')[0]) continue;
        if (!scoresByOuting[k]) scoresByOuting[k] = [];
        scoresByOuting[k].push(sc);
      }
      var eligible = [];
      for (var oi = 0; oi < state.outings.length; oi++) {
        var o = state.outings[oi];
        if (LS.outingHasTeamCompetition(o.comps)) eligible.push(o);
      }
      eligible.sort(function (a, b) {
        var dA = new Date(String((a && a.date) || '').trim());
        var dB = new Date(String((b && b.date) || '').trim());
        return dA - dB;
      });
      if (eligible.length === 0) {
        container.innerHTML = '<div class="no-scores"><p>No team competitions configured.</p></div>';
        return;
      }
      var built = [];
      for (var i = 0; i < eligible.length; i++) {
        var outing = eligible[i];
        var oKey = outingKey(outing.courseName, outing.date);
        var secId = 'ar-team-outing-' + built.length;
        var sec = renderTeamsOutingSection(
          oKey,
          scoresByOuting,
          state.outings,
          state.courses,
          state.teamsByOuting,
          state.outingKeyToOutingId,
          courseParMap,
          outing,
          secId
        );
        if (sec && sec.html) built.push({ html: sec.html, outing: outing, secId: secId });
      }
      if (!built.length) {
        container.innerHTML = '<div class="no-scores"><p>No team results to show yet.</p></div>';
        return;
      }
      var html = '';
      for (var h = 0; h < built.length; h++) html += built[h].html;
      container.innerHTML = html;
    }

    wireExpandClicks(container);

    return {
      setState: function (s) {
        state = s;
      },
      renderPlayerContent: renderPlayerContent,
      renderTeamsAllOutings: renderTeamsAllOutings,
    };
  }

  window.AllResultsPage = {
    initAllResultsPage: initAllResultsPage,
    outingKey: outingKey,
    scoreFingerprint: scoreFingerprint,
    buildCourseParMap: buildCourseParMap,
    outingDisplayName: outingDisplayName,
  };
})();
