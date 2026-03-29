/**
 * Shared leaderboard scoring, detail HTML, and ranking helpers.
 * Depends on global Formatters (formatters.js).
 */
(function (global) {
  'use strict';

  /** formatters.js assigns `const Formatters` to global lexical scope; also mirrored on window. */
  var Formatters = global.Formatters || (global.window && global.window.Formatters);

  function defaultFormatNumber(num) {
    if (num == null || num === '') return '-';
    var n = parseFloat(num);
    return isNaN(n) ? '-' : n.toString();
  }

  function parseParIndexPairs(parIndx) {
    var s = (parIndx || '').toString().trim();
    if (!s) return [];
    var parts = s.split(',');
    var out = [];
    if (parts.length >= 36) {
      for (var i = 0; i < 18; i++) {
        out.push({ par: parseInt(parts[i], 10) || 0, index: parseInt(parts[i + 18], 10) || 0 });
      }
    } else if (parts.length >= 18) {
      for (var j = 0; j < 18; j++) {
        out.push({ par: parseInt(parts[j], 10) || 0, index: 0 });
      }
    }
    return out.length === 18 ? out : [];
  }

  function buildHoleDetailHtml(score, parIndexPairs, par3Indices, highlight66Indices, p3UsePoints, highlight2sIndices) {
    var holes = score.holes || [];
    var pts = score.holePoints || [];
    var strokeVals = [],
      pointVals = [];
    var outStrokes = 0,
      inStrokes = 0,
      outPoints = 0,
      inPoints = 0;
    for (var h = 0; h < 18; h++) {
      var s = holes[h] !== '' && holes[h] != null ? String(holes[h]) : '-';
      var p = pts[h] !== undefined && pts[h] !== '' ? String(pts[h]) : '-';
      strokeVals.push(s);
      pointVals.push(p);
      var sn = parseInt(holes[h], 10),
        pn = parseFloat(pts[h]);
      if (!isNaN(sn) && sn > 0) {
        if (h < 9) outStrokes += sn;
        else inStrokes += sn;
      }
      if (!isNaN(pn)) {
        if (h < 9) outPoints += pn;
        else inPoints += pn;
      }
    }
    var totStrokes = outStrokes + inStrokes,
      totPts = outPoints + inPoints;
    var parCells = [];
    var parOut = 0,
      parIn = 0,
      parTot = 0;
    if (parIndexPairs && parIndexPairs.length === 18) {
      for (var i = 0; i < 18; i++) {
        var pr = parIndexPairs[i].par || 0;
        parCells.push(pr || '-');
        if (i < 9) parOut += pr;
        else parIn += pr;
      }
      parTot = parOut + parIn;
    } else {
      for (var k = 0; k < 18; k++) parCells.push('-');
    }
    var indexCells = [];
    if (parIndexPairs && parIndexPairs.length === 18) {
      for (var ii = 0; ii < 18; ii++) {
        var idx = parIndexPairs[ii].index;
        indexCells.push(idx ? String(idx) : '-');
      }
    } else {
      for (var ik = 0; ik < 18; ik++) indexCells.push('-');
    }
    var p3 = par3Indices || [];
    var highlight66Set = {};
    if (highlight66Indices && highlight66Indices.length) {
      for (var z = 0; z < highlight66Indices.length; z++) highlight66Set[highlight66Indices[z]] = true;
    }
    var highlight2sSet = {};
    if (highlight2sIndices && highlight2sIndices.length) {
      for (var z2 = 0; z2 < highlight2sIndices.length; z2++) highlight2sSet[highlight2sIndices[z2]] = true;
    }
    function isPar3(i) {
      return p3.indexOf(i) >= 0;
    }
    function cell(txt, cls, holeIdx, rowType, pointHighlight, strokeHighlight) {
      var c = cls || '';
      if (pointHighlight && holeIdx != null && (highlight66Set[holeIdx] || (isPar3(holeIdx) && p3UsePoints)))
        c = (c ? c + ' ' : '') + 'lb-detail-points-66';
      if (strokeHighlight && holeIdx != null && isPar3(holeIdx) && p3UsePoints === false)
        c = (c ? c + ' ' : '') + 'lb-detail-strokes-p3';
      if (strokeHighlight && holeIdx != null && highlight2sSet[holeIdx]) c = (c ? c + ' ' : '') + 'lb-detail-strokes-2s';
      return (
        '<span' +
        (c ? ' class="' + c + '"' : '') +
        '>' +
        (typeof txt === 'number' ? txt : Formatters.escapeHtml(String(txt))) +
        '</span>'
      );
    }
    function parCell(v, holeIdx, rowType) {
      return '<span class="lb-detail-par">' + v + '</span>';
    }
    var cells = [];
    for (var n = 1; n <= 9; n++) cells.push(cell(n, null, n - 1, 'first'));
    cells.push(cell('OUT', 'lb-detail-col-total'));
    for (var n = 10; n <= 18; n++) cells.push(cell(n, null, n - 1, 'first'));
    cells.push(cell('IN', 'lb-detail-col-total'));
    cells.push(cell('TOT', 'lb-detail-col-total'));
    cells.push(cell('Par:', 'lb-detail-label lb-detail-par'));
    for (var pi = 0; pi < 9; pi++) cells.push(parCell(parCells[pi], pi, 'mid'));
    cells.push(parCell(parIndexPairs && parIndexPairs.length === 18 ? parOut : '-'));
    for (var pj = 9; pj < 18; pj++) cells.push(parCell(parCells[pj], pj, 'mid'));
    cells.push(parCell(parIndexPairs && parIndexPairs.length === 18 ? parIn : '-'));
    cells.push(parCell(parIndexPairs && parIndexPairs.length === 18 ? parTot : '-'));
    cells.push(cell('Index:', 'lb-detail-label lb-detail-index'));
    for (var idi = 0; idi < 9; idi++) cells.push(cell(indexCells[idi], 'lb-detail-index', idi, 'mid'));
    cells.push(cell('-', 'lb-detail-index'));
    for (var idj = 9; idj < 18; idj++) cells.push(cell(indexCells[idj], 'lb-detail-index', idj, 'mid'));
    cells.push(cell('-', 'lb-detail-index'));
    cells.push(cell('-', 'lb-detail-index'));
    cells.push(cell('Strokes:', 'lb-detail-label lb-detail-strokes'));
    for (var si = 0; si < 9; si++) cells.push(cell(strokeVals[si], 'lb-detail-strokes', si, 'mid', undefined, true));
    cells.push(cell(outStrokes, 'lb-detail-col-total lb-detail-strokes'));
    for (var sj = 9; sj < 18; sj++) cells.push(cell(strokeVals[sj], 'lb-detail-strokes', sj, 'mid', undefined, true));
    cells.push(cell(inStrokes, 'lb-detail-col-total lb-detail-strokes'));
    cells.push(cell(totStrokes, 'lb-detail-col-total lb-detail-strokes'));
    cells.push(cell('Points:', 'lb-detail-label lb-detail-points'));
    for (var qi = 0; qi < 9; qi++) cells.push(cell(pointVals[qi], 'lb-detail-points', qi, 'last', true));
    cells.push(cell(outPoints, 'lb-detail-col-total lb-detail-points'));
    for (var qj = 9; qj < 18; qj++) cells.push(cell(pointVals[qj], 'lb-detail-points', qj, 'last', true));
    cells.push(cell(inPoints, 'lb-detail-col-total lb-detail-points'));
    cells.push(cell(totPts, 'lb-detail-col-total lb-detail-points'));
    return (
      '<div class="lb-hole-detail-wrap"><div class="lb-hole-detail-scroll"><div class="lb-hole-detail-grid">' +
      cell('Hole#:', 'lb-detail-label') +
      cells.join('') +
      '</div></div></div>'
    );
  }

  function buildTeamHoleDetailHtml(teamPlayerNames, scoreByPlayer, parIndexPairs, teamRule, teamN) {
    var n = Math.min(teamN || 1, (teamPlayerNames || []).length);
    var pointCountsForTeam = {};
    var pointCountsHole = [];
    if (teamRule === 'total' && teamPlayerNames && scoreByPlayer) {
      var totals = [];
      for (var m = 0; m < teamPlayerNames.length; m++) {
        var sc = scoreByPlayer[(teamPlayerNames[m] || '').trim().toLowerCase()];
        totals.push({ idx: m, pt: sc ? parseFloat(sc.totalPoints) || 0 : 0 });
      }
      totals.sort(function (a, b) {
        return b.pt - a.pt;
      });
      for (var i = 0; i < n && i < totals.length; i++) pointCountsForTeam[totals[i].idx] = true;
    } else if (teamRule === 'hole' && teamPlayerNames && scoreByPlayer) {
      for (var h = 0; h < 18; h++) {
        pointCountsHole[h] = {};
        var holePts = [];
        for (var m = 0; m < teamPlayerNames.length; m++) {
          var sc = scoreByPlayer[(teamPlayerNames[m] || '').trim().toLowerCase()];
          var pt =
            sc && sc.holePoints && sc.holePoints[h] !== undefined && sc.holePoints[h] !== null
              ? parseFloat(sc.holePoints[h])
              : NaN;
          if (!isNaN(pt)) holePts.push({ idx: m, pt: pt });
        }
        holePts.sort(function (a, b) {
          return b.pt - a.pt;
        });
        for (var j = 0; j < n && j < holePts.length; j++) pointCountsHole[h][holePts[j].idx] = true;
      }
    }
    function cell(txt, cls, highlight) {
      if (highlight) cls = (cls ? cls + ' ' : '') + 'lb-detail-points-66';
      return (
        '<span' + (cls ? ' class="' + cls + '"' : '') + '>' + (typeof txt === 'number' ? txt : Formatters.escapeHtml(String(txt))) + '</span>'
      );
    }
    function firstColLabel(labelText, extraClass) {
      var labelCls = 'lb-detail-label-part' + (extraClass ? ' ' + extraClass : '');
      return (
        '<span class="lb-detail-label lb-detail-first-col"><span class="lb-detail-name-part"></span><span class="' +
        labelCls +
        '">' +
        Formatters.escapeHtml(labelText) +
        '</span></span>'
      );
    }
    function firstColLabelWithName(name, labelText, extraClass, outerClass) {
      var labelCls = 'lb-detail-label-part' + (extraClass ? ' ' + extraClass : '');
      var namePart = '<span class="lb-detail-name-part">' + (name ? Formatters.escapeHtml(name) : '') + '</span>';
      var outerCls = 'lb-detail-label lb-detail-first-col' + (outerClass ? ' ' + outerClass : '');
      return (
        '<span class="' + outerCls + '">' + namePart + '<span class="' + labelCls + '">' + Formatters.escapeHtml(labelText) + '</span></span>'
      );
    }
    function parCell(v) {
      return '<span class="lb-detail-par">' + Formatters.escapeHtml(String(v)) + '</span>';
    }
    var parCells = [],
      parOut = 0,
      parIn = 0,
      parTot = 0;
    var indexCells = [];
    if (parIndexPairs && parIndexPairs.length === 18) {
      for (var i = 0; i < 18; i++) {
        var pr = parIndexPairs[i].par || 0;
        parCells.push(pr || '-');
        if (i < 9) parOut += pr;
        else parIn += pr;
        indexCells.push(parIndexPairs[i].index ? String(parIndexPairs[i].index) : '-');
      }
      parTot = parOut + parIn;
    } else {
      for (var k = 0; k < 18; k++) {
        parCells.push('-');
        indexCells.push('-');
      }
    }
    var out = [];
    out.push(firstColLabel('Hole#:'));
    for (var n = 1; n <= 9; n++) out.push(cell(n));
    out.push(cell('OUT', 'lb-detail-col-total'));
    for (var n = 10; n <= 18; n++) out.push(cell(n));
    out.push(cell('IN', 'lb-detail-col-total'));
    out.push(cell('TOT', 'lb-detail-col-total'));
    out.push(firstColLabel('Par:', 'lb-detail-par'));
    for (var pi = 0; pi < 9; pi++) out.push(parCell(parCells[pi]));
    out.push(parCell(parIndexPairs && parIndexPairs.length === 18 ? parOut : '-'));
    for (var pj = 9; pj < 18; pj++) out.push(parCell(parCells[pj]));
    out.push(parCell(parIndexPairs && parIndexPairs.length === 18 ? parIn : '-'));
    out.push(parCell(parIndexPairs && parIndexPairs.length === 18 ? parTot : '-'));
    out.push(firstColLabel('Index:', 'lb-detail-index'));
    for (var idi = 0; idi < 9; idi++) out.push(cell(indexCells[idi], 'lb-detail-index'));
    out.push(cell('-', 'lb-detail-index'));
    for (var idj = 9; idj < 18; idj++) out.push(cell(indexCells[idj], 'lb-detail-index'));
    out.push(cell('-', 'lb-detail-index'));
    out.push(cell('-', 'lb-detail-index'));
    for (var wp = 0; wp < (teamPlayerNames || []).length; wp++) {
      var pName = (teamPlayerNames[wp] || '').trim();
      var sc = scoreByPlayer && pName ? scoreByPlayer[pName.toLowerCase()] : null;
      var holes = sc && sc.holes ? sc.holes : [];
      var pts = sc && sc.holePoints ? sc.holePoints : [];
      var strokeVals = [],
        pointVals = [];
      var outSt = 0,
        inSt = 0,
        outPt = 0,
        inPt = 0;
      for (var h = 0; h < 18; h++) {
        var s = holes[h] !== '' && holes[h] != null ? String(holes[h]) : '-';
        var p = pts[h] !== undefined && pts[h] !== '' ? String(pts[h]) : '-';
        strokeVals.push(s);
        pointVals.push(p);
        var sn = parseInt(holes[h], 10),
          pn = parseFloat(pts[h]);
        if (!isNaN(sn) && sn > 0) {
          if (h < 9) outSt += sn;
          else inSt += sn;
        }
        if (!isNaN(pn)) {
          if (h < 9) outPt += pn;
          else inPt += pn;
        }
      }
      var totSt = outSt + inSt,
        totPt = outPt + inPt;
      out.push(firstColLabelWithName(pName || '\u2014', 'Strokes:', 'lb-detail-strokes'));
      for (var si = 0; si < 9; si++) out.push(cell(strokeVals[si], 'lb-detail-strokes'));
      out.push(cell(outSt, 'lb-detail-col-total lb-detail-strokes'));
      for (var sj = 9; sj < 18; sj++) out.push(cell(strokeVals[sj], 'lb-detail-strokes'));
      out.push(cell(inSt, 'lb-detail-col-total lb-detail-strokes'));
      out.push(cell(totSt, 'lb-detail-col-total lb-detail-strokes'));
      out.push(firstColLabel('Points:', 'lb-detail-points'));
      for (var qi = 0; qi < 9; qi++) {
        var hl =
          (teamRule === 'total' && pointCountsForTeam[wp]) || (teamRule === 'hole' && pointCountsHole[qi] && pointCountsHole[qi][wp]);
        out.push(cell(pointVals[qi], 'lb-detail-points', hl));
      }
      out.push(cell(outPt, 'lb-detail-col-total lb-detail-points'));
      for (var qj = 9; qj < 18; qj++) {
        var hlIn =
          (teamRule === 'total' && pointCountsForTeam[wp]) || (teamRule === 'hole' && pointCountsHole[qj] && pointCountsHole[qj][wp]);
        out.push(cell(pointVals[qj], 'lb-detail-points', hlIn));
      }
      out.push(cell(inPt, 'lb-detail-col-total lb-detail-points'));
      out.push(cell(totPt, 'lb-detail-col-total lb-detail-points'));
    }
    var teamPointByHole = [];
    var teamOutPt = 0,
      teamInPt = 0;
    for (var th = 0; th < 18; th++) {
      var sum = 0;
      for (var tp = 0; tp < (teamPlayerNames || []).length; tp++) {
        var count =
          (teamRule === 'total' && pointCountsForTeam[tp]) || (teamRule === 'hole' && pointCountsHole[th] && pointCountsHole[th][tp]);
        if (count) {
          var tsc = scoreByPlayer && teamPlayerNames[tp] ? scoreByPlayer[(teamPlayerNames[tp] || '').trim().toLowerCase()] : null;
          var tpts =
            tsc && tsc.holePoints && tsc.holePoints[th] !== undefined && tsc.holePoints[th] !== null ? parseFloat(tsc.holePoints[th]) : 0;
          if (!isNaN(tpts)) sum += tpts;
        }
      }
      teamPointByHole.push(sum);
      if (th < 9) teamOutPt += sum;
      else teamInPt += sum;
    }
    var teamTotPt = teamOutPt + teamInPt;
    function cellTotal(txt, cls) {
      var c = (cls || '') + ' lb-detail-cell-total';
      return '<span class="' + c.trim() + '">' + (typeof txt === 'number' ? txt : Formatters.escapeHtml(String(txt))) + '</span>';
    }
    out.push(firstColLabelWithName('Team Total', '', 'lb-detail-points', null, 'lb-detail-points'));
    for (var qi = 0; qi < 9; qi++) out.push(cellTotal(teamPointByHole[qi], 'lb-detail-points'));
    out.push(cellTotal(teamOutPt, 'lb-detail-col-total lb-detail-points'));
    for (var qj = 9; qj < 18; qj++) out.push(cellTotal(teamPointByHole[qj], 'lb-detail-points'));
    out.push(cellTotal(teamInPt, 'lb-detail-col-total lb-detail-points'));
    out.push(cellTotal(teamTotPt, 'lb-detail-col-total lb-detail-points'));
    return (
      '<div class="lb-hole-detail-wrap"><div class="lb-hole-detail-scroll"><div class="lb-hole-detail-grid lb-hole-detail-grid--team">' +
      out.join('') +
      '</div></div></div>'
    );
  }

  function parseParIndx(parIndx) {
    var s = (parIndx || '').toString().trim();
    if (!s) return [];
    var parts = s.split(',');
    var pars = [];
    if (parts.length >= 36) {
      if (parts.length >= 37) {
        for (var p = 1; p <= 18; p++) pars.push(parseInt(parts[p], 10) || 0);
      } else {
        for (var i = 0; i < 18; i++) pars.push(parseInt(parts[i], 10) || 0);
      }
    } else if (parts.length >= 18) {
      for (var j = 0; j < 18; j++) pars.push(parseInt(parts[j], 10) || 0);
    }
    return pars.length === 18 ? pars : [];
  }

  function getPar3Indices(pars) {
    var out = [];
    for (var i = 0; i < pars.length; i++) {
      if (pars[i] === 3) out.push(i);
    }
    return out;
  }

  function sumHolePoints(score, indices) {
    var pts = score.holePoints || [];
    var sum = 0;
    for (var i = 0; i < indices.length; i++) {
      var p = parseFloat(pts[indices[i]]);
      if (!isNaN(p)) sum += p;
    }
    return sum;
  }

  function sort66Compare(a, b) {
    if (a.p !== b.p) return b.p - a.p;
    return b.i - a.i;
  }

  function points66(score) {
    var pts = score.holePoints || [];
    var withIdx = function (start, end) {
      var list = [];
      for (var i = start; i < end; i++) {
        var p = parseFloat(pts[i]);
        list.push({ i: i, p: isNaN(p) ? 0 : p });
      }
      list.sort(sort66Compare);
      var sum = 0;
      for (var k = 0; k < 6 && k < list.length; k++) sum += list[k].p;
      return sum;
    };
    return withIdx(0, 9) + withIdx(9, 18);
  }

  function indices66(score) {
    var pts = score.holePoints || [];
    var withIdx = function (start, end) {
      var list = [];
      for (var i = start; i < end; i++) {
        var p = parseFloat(pts[i]);
        list.push({ i: i, p: isNaN(p) ? 0 : p });
      }
      list.sort(sort66Compare);
      var outIdx = [];
      for (var k = 0; k < 6 && k < list.length; k++) outIdx.push(list[k].i);
      return outIdx;
    };
    return withIdx(0, 9).concat(withIdx(9, 18));
  }

  function compareCountbackOverall(a, b) {
    var pa = parseFloat(a.totalPoints) || 0,
      pb = parseFloat(b.totalPoints) || 0;
    if (pa !== pb) return pb - pa;
    var ranges = [
      [9, 10, 11, 12, 13, 14, 15, 16, 17],
      [12, 13, 14, 15, 16, 17],
      [15, 16, 17],
      [17],
    ];
    for (var r = 0; r < ranges.length; r++) {
      var sa = sumHolePoints(a, ranges[r]),
        sb = sumHolePoints(b, ranges[r]);
      if (sa !== sb) return sb - sa;
    }
    return 0;
  }

  function compareCountbackF9(a, b) {
    var pa = parseFloat(a.outPoints) || 0,
      pb = parseFloat(b.outPoints) || 0;
    if (pa !== pb) return pb - pa;
    var ranges = [
      [3, 4, 5, 6, 7, 8],
      [6, 7, 8],
      [8],
    ];
    for (var r = 0; r < ranges.length; r++) {
      var sa = sumHolePoints(a, ranges[r]),
        sb = sumHolePoints(b, ranges[r]);
      if (sa !== sb) return sb - sa;
    }
    return 0;
  }

  function compareCountbackB9(a, b) {
    var pa = parseFloat(a.inPoints) || 0,
      pb = parseFloat(b.inPoints) || 0;
    if (pa !== pb) return pb - pa;
    var ranges = [
      [12, 13, 14, 15, 16, 17],
      [15, 16, 17],
      [17],
    ];
    for (var r = 0; r < ranges.length; r++) {
      var sa = sumHolePoints(a, ranges[r]),
        sb = sumHolePoints(b, ranges[r]);
      if (sa !== sb) return sb - sa;
    }
    return 0;
  }

  var OVERALL_RANGES = [
    [9, 10, 11, 12, 13, 14, 15, 16, 17],
    [12, 13, 14, 15, 16, 17],
    [15, 16, 17],
    [17],
  ];
  var OVERALL_LABELS = ['back-9', 'back-6', 'back-3', 'back-1'];
  var F9_RANGES = [
    [3, 4, 5, 6, 7, 8],
    [6, 7, 8],
    [8],
  ];
  var F9_LABELS = ['4-9', '7-9', 'hole 9'];
  var B9_RANGES = [
    [12, 13, 14, 15, 16, 17],
    [15, 16, 17],
    [17],
  ];
  var B9_LABELS = ['back-6', 'back-3', 'back-1'];

  function getCountbackLabelOverall(winner, runnerUp) {
    if ((parseFloat(winner.totalPoints) || 0) > (parseFloat(runnerUp.totalPoints) || 0)) return null;
    for (var r = 0; r < OVERALL_RANGES.length; r++) {
      var sw = sumHolePoints(winner, OVERALL_RANGES[r]),
        sr = sumHolePoints(runnerUp, OVERALL_RANGES[r]);
      if (sw > sr) return OVERALL_LABELS[r];
    }
    return null;
  }

  function getCountbackLabelF9(winner, runnerUp) {
    if ((parseFloat(winner.outPoints) || 0) > (parseFloat(runnerUp.outPoints) || 0)) return null;
    for (var r = 0; r < F9_RANGES.length; r++) {
      var sw = sumHolePoints(winner, F9_RANGES[r]),
        sr = sumHolePoints(runnerUp, F9_RANGES[r]);
      if (sw > sr) return F9_LABELS[r];
    }
    return null;
  }

  function getCountbackLabelB9(winner, runnerUp) {
    if ((parseFloat(winner.inPoints) || 0) > (parseFloat(runnerUp.inPoints) || 0)) return null;
    for (var r = 0; r < B9_RANGES.length; r++) {
      var sw = sumHolePoints(winner, B9_RANGES[r]),
        sr = sumHolePoints(runnerUp, B9_RANGES[r]);
      if (sw > sr) return B9_LABELS[r];
    }
    return null;
  }

  function compareCountback66(a, b) {
    var pa = points66(a),
      pb = points66(b);
    if (pa !== pb) return pb - pa;
    return compareCountbackOverall(a, b);
  }

  function getCountbackLabel66(winner, runnerUp) {
    if (points66(winner) > points66(runnerUp)) return null;
    return getCountbackLabelOverall(winner, runnerUp);
  }

  function rankWithCountback(scores, compareFn, maxPositions, getLabelFn) {
    if (scores.length === 0) return [];
    var sorted = scores.slice().sort(compareFn);
    var result = [];
    var runningCount = 0;
    var i = 0;
    while (result.length < maxPositions && i < sorted.length) {
      var group = [sorted[i]];
      while (i + 1 < sorted.length && compareFn(sorted[i], sorted[i + 1]) === 0) {
        i++;
        group.push(sorted[i]);
      }
      var countbackLabel = null;
      if (group.length === 1 && i + 1 < sorted.length && getLabelFn) {
        countbackLabel = getLabelFn(group[0], sorted[i + 1]);
      }
      var n = runningCount + 1;
      var suf =
        n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th';
      var ord = n + suf + (group.length > 1 ? '*' : '');
      result.push({ position: n, label: ord, scores: group, countbackLabel: countbackLabel });
      runningCount += group.length;
      i++;
    }
    return result;
  }

  /** Full ranking (all places). Same tie / label rules as rankWithCountback. */
  function rankAllWithCountback(scores, compareFn, getLabelFn) {
    if (!scores || scores.length === 0) return [];
    var sorted = scores.slice().sort(compareFn);
    var result = [];
    var runningCount = 0;
    var i = 0;
    while (i < sorted.length) {
      var group = [sorted[i]];
      while (i + 1 < sorted.length && compareFn(sorted[i], sorted[i + 1]) === 0) {
        i++;
        group.push(sorted[i]);
      }
      var countbackLabel = null;
      if (group.length === 1 && i + 1 < sorted.length && getLabelFn) {
        countbackLabel = getLabelFn(group[0], sorted[i + 1]);
      }
      var n = runningCount + 1;
      var suf =
        n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th';
      var ord = n + suf + (group.length > 1 ? '*' : '');
      result.push({ position: n, label: ord, scores: group, countbackLabel: countbackLabel });
      runningCount += group.length;
      i++;
    }
    return result;
  }

  function bestWithCountback(candidates, compareFn, getLabelFn) {
    if (candidates.length === 0) return { scores: [], countbackLabel: null };
    var sorted = candidates.slice().sort(compareFn);
    var best = [sorted[0]];
    for (var j = 1; j < sorted.length && compareFn(sorted[0], sorted[j]) === 0; j++) best.push(sorted[j]);
    var countbackLabel = null;
    if (best.length === 1 && sorted.length > 1 && getLabelFn) {
      countbackLabel = getLabelFn(best[0], sorted[1]);
    }
    return { scores: best, countbackLabel: countbackLabel };
  }

  function formatPointsWithCountback(points, countbackLabel, formatNumber) {
    var fn = formatNumber || defaultFormatNumber;
    if (!countbackLabel) return fn(points);
    return '<span class="lb-countback">(' + Formatters.escapeHtml(countbackLabel) + ')</span> ' + fn(points);
  }

  function par3StrokeToLabel(strokes) {
    var s = parseInt(strokes, 10);
    if (isNaN(s) || s < 1) return '-';
    if (s === 1) return 'Ace';
    if (s === 2) return 'Birdie';
    if (s === 3) return 'Par';
    if (s === 4) return 'Bogey';
    if (s === 5) return 'Double';
    return 'Triple+';
  }

  var MAX_PLACES = 20;

  function parseComps(compsStr) {
    var tokens = (compsStr || '')
      .trim()
      .toLowerCase()
      .split(/[,\s]+/)
      .filter(Boolean);
    var out = {
      topN: 0,
      f9ExclN: 0,
      b9ExclN: 0,
      showF9: false,
      showB9: false,
      showP3: false,
      p3UsePoints: false,
      show2s: false,
      show66: false,
      showTeam: false,
      teamN: 1,
      teamRule: 'hole',
    };
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.indexOf('18:') === 0) out.topN = Math.min(MAX_PLACES, parseInt(t.slice(3), 10) || 0);
      else if (t === 'f9') {
        out.showF9 = true;
        out.f9ExclN = 0;
      } else if (t.indexOf('f9:') === 0) {
        out.showF9 = true;
        out.f9ExclN = Math.min(MAX_PLACES, parseInt(t.slice(3), 10) || 0);
      } else if (t === 'b9') {
        out.showB9 = true;
        out.b9ExclN = 0;
      } else if (t.indexOf('b9:') === 0) {
        out.showB9 = true;
        out.b9ExclN = Math.min(MAX_PLACES, parseInt(t.slice(3), 10) || 0);
      } else if (t === 'p3s') {
        out.showP3 = true;
        out.p3UsePoints = false;
      } else if (t === 'p3p') {
        out.showP3 = true;
        out.p3UsePoints = true;
      } else if (t === '2s') {
        out.show2s = true;
      } else if (t === '66') {
        out.show66 = true;
      } else if (t.indexOf('th:') === 0) {
        out.showTeam = true;
        out.teamRule = 'hole';
        out.teamN = Math.min(10, Math.max(1, parseInt(t.slice(3), 10) || 1));
      } else if (t.indexOf('tt:') === 0) {
        out.showTeam = true;
        out.teamRule = 'total';
        out.teamN = Math.min(10, Math.max(1, parseInt(t.slice(3), 10) || 1));
      } else if (t === 'team') {
        out.showTeam = true;
        out.teamN = 1;
      } else if (t.indexOf('team:') === 0) {
        out.showTeam = true;
        out.teamN = Math.min(10, Math.max(1, parseInt(t.slice(5), 10) || 1));
      } else if (t === 'teamhole') out.teamRule = 'hole';
      else if (t === 'teamtotal') out.teamRule = 'total';
    }
    return out;
  }

  function getCompsForScores(outings, courseName, dateStr, scoreDates) {
    var cn = (courseName || '').trim().toLowerCase();
    var dt = (dateStr || '').trim();
    for (var i = 0; i < outings.length; i++) {
      var o = outings[i];
      if ((o.courseName || '').trim().toLowerCase() === cn && (o.date || '').trim() === dt) return o.comps || '';
    }
    var byCourse = [];
    for (var j = 0; j < outings.length; j++) {
      var o2 = outings[j];
      if ((o2.courseName || '').trim().toLowerCase() === cn) byCourse.push(o2);
    }
    if (byCourse.length === 0) return '';
    if (byCourse.length === 1) return byCourse[0].comps || '';
    var scoreDateCounts = {};
    for (var k = 0; k < (scoreDates || []).length; k++) {
      var d = (scoreDates[k] || '').trim();
      scoreDateCounts[d] = (scoreDateCounts[d] || 0) + 1;
    }
    var best = byCourse[0];
    var bestCount = scoreDateCounts[(best.date || '').trim()] || 0;
    for (var m = 1; m < byCourse.length; m++) {
      var cnt = scoreDateCounts[(byCourse[m].date || '').trim()] || 0;
      if (cnt > bestCount) {
        best = byCourse[m];
        bestCount = cnt;
      }
    }
    return best.comps || '';
  }

  /** Same token rules as admin society-admin outingHasTeamCompetition */
  function outingHasTeamCompetition(compsStr) {
    var tokens = (compsStr || '')
      .trim()
      .toLowerCase()
      .split(/[,\s]+/)
      .filter(Boolean);
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.indexOf('th:') === 0 || t.indexOf('tt:') === 0) return true;
      if (t === 'team' || t.indexOf('team:') === 0) return true;
    }
    return false;
  }

  function comparePar3Candidates(a, b, p3UsePoints) {
    if (p3UsePoints) {
      if (a.par3Points !== b.par3Points) return b.par3Points - a.par3Points;
    } else {
      if (a.par3Strokes !== b.par3Strokes) return a.par3Strokes - b.par3Strokes;
    }
    var hcpA = parseFloat(a.score.handicap) || 0,
      hcpB = parseFloat(b.score.handicap) || 0;
    return hcpB - hcpA;
  }

  /** Find rank tier for a player name in rankAllWithCountback result (scores are raw score rows). */
  function findRankForPlayerName(rankings, playerNameLower) {
    for (var r = 0; r < rankings.length; r++) {
      var grp = rankings[r].scores;
      for (var g = 0; g < grp.length; g++) {
        if ((grp[g].playerName || '').trim().toLowerCase() === playerNameLower) return rankings[r];
      }
    }
    return null;
  }

  /** Par-3 candidate rows { score, par3Strokes, par3Points, labels } */
  function findRankForPar3Candidate(rankings, playerNameLower) {
    for (var r = 0; r < rankings.length; r++) {
      var grp = rankings[r].scores;
      for (var g = 0; g < grp.length; g++) {
        var sc = grp[g].score;
        if (sc && (sc.playerName || '').trim().toLowerCase() === playerNameLower) return rankings[r];
      }
    }
    return null;
  }

  /** Rank teams { teamName, score, playerNames } by score desc, same tie rules as overall points. */
  function rankTeamsByScore(teamScores) {
    if (!teamScores || teamScores.length === 0) return [];
    var sorted = teamScores.slice().sort(function (a, b) {
      return (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0);
    });
    var result = [];
    var runningCount = 0;
    var i = 0;
    while (i < sorted.length) {
      var group = [sorted[i]];
      var pts = parseFloat(sorted[i].score) || 0;
      while (i + 1 < sorted.length && (parseFloat(sorted[i + 1].score) || 0) === pts) {
        i++;
        group.push(sorted[i]);
      }
      var n = runningCount + 1;
      var suf =
        n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th';
      var ord = n + suf + (group.length > 1 ? '*' : '');
      result.push({ position: n, label: ord, teams: group });
      runningCount += group.length;
      i++;
    }
    return result;
  }

  function findTeamRank(rankRows, teamName) {
    var tn = (teamName || '').trim().toLowerCase();
    for (var r = 0; r < rankRows.length; r++) {
      var grp = rankRows[r].teams;
      for (var g = 0; g < grp.length; g++) {
        if ((grp[g].teamName || '').trim().toLowerCase() === tn) return rankRows[r];
      }
    }
    return null;
  }

  global.LeaderboardShared = {
    defaultFormatNumber: defaultFormatNumber,
    parseParIndexPairs: parseParIndexPairs,
    buildHoleDetailHtml: buildHoleDetailHtml,
    buildTeamHoleDetailHtml: buildTeamHoleDetailHtml,
    parseParIndx: parseParIndx,
    getPar3Indices: getPar3Indices,
    sumHolePoints: sumHolePoints,
    points66: points66,
    indices66: indices66,
    compareCountbackOverall: compareCountbackOverall,
    compareCountbackF9: compareCountbackF9,
    compareCountbackB9: compareCountbackB9,
    compareCountback66: compareCountback66,
    getCountbackLabelOverall: getCountbackLabelOverall,
    getCountbackLabelF9: getCountbackLabelF9,
    getCountbackLabelB9: getCountbackLabelB9,
    getCountbackLabel66: getCountbackLabel66,
    rankWithCountback: rankWithCountback,
    rankAllWithCountback: rankAllWithCountback,
    bestWithCountback: bestWithCountback,
    formatPointsWithCountback: formatPointsWithCountback,
    par3StrokeToLabel: par3StrokeToLabel,
    parseComps: parseComps,
    getCompsForScores: getCompsForScores,
    outingHasTeamCompetition: outingHasTeamCompetition,
    comparePar3Candidates: comparePar3Candidates,
    findRankForPlayerName: findRankForPlayerName,
    findRankForPar3Candidate: findRankForPar3Candidate,
    rankTeamsByScore: rankTeamsByScore,
    findTeamRank: findTeamRank,
    MAX_PLACES: MAX_PLACES,
  };
})(typeof window !== 'undefined' ? window : this);
