/**
 * Handicap rule defaults and lookup helpers (client + server mirror).
 */
(function (global) {
  'use strict';

  function defaultPositionBands(amounts) {
    return [
      { minIndex: 30, maxIndex: null, amount: amounts[0] },
      { minIndex: 18, maxIndex: 30, amount: amounts[1] },
      { minIndex: null, maxIndex: 18, amount: amounts[2] },
    ];
  }

  /** Thresholds (40 pts, 5 clear of 2nd, 12 members) are fixed here; admin UI only edits amount. */
  function defaultHighScoreRules() {
    return {
      rule4a: {
        enabled: true,
        minPoints: 40,
        minLeadOverSecond: 5,
        minCompetitors: 12,
        amount: -1,
      },
      rule4b: {
        enabled: true,
        minPoints: 40,
        amount: -0.5,
      },
    };
  }

  function defaultHandicapRuleConfig() {
    return {
      enabled: true,
      outsideTop10: 1,
      maxIndex: 40,
      positionGroups: {
        winner: defaultPositionBands([-4, -2, -1]),
        runnerUp: defaultPositionBands([-2, -1, -0.5]),
        thirdPlace: defaultPositionBands([0, 0, 0]),
      },
      highScoreRules: defaultHighScoreRules(),
    };
  }

  function mergeHighScoreRules(config) {
    var defaults = defaultHighScoreRules();
    var hs = (config && config.highScoreRules) || {};
    return {
      rule4a: Object.assign({}, defaults.rule4a, hs.rule4a || {}),
      rule4b: Object.assign({}, defaults.rule4b, hs.rule4b || {}),
    };
  }

  function secondPlaceMemberPoints(ranked) {
    var list = Array.isArray(ranked) ? ranked : [];
    var second = list.filter(function (r) {
      return r && r.position === 2;
    });
    if (!second.length) return null;
    return toNum(second[0].totalPoints, null);
  }

  /**
   * Rule 4a: 40+ points and 5+ ahead of 2nd (members), when 12+ members competed.
   * Rule 4b: 40+ points, additional -0.5. Rule 4a takes precedence over 4b.
   * Returns { amount, rule: '4a'|'4b'|null }.
   */
  function highScoreAdjustmentForMember(config, ranked, memberCount, memberRanking) {
    var hs = mergeHighScoreRules(config);
    var points = toNum(memberRanking && memberRanking.totalPoints, 0);
    var rule4a = hs.rule4a;
    var rule4b = hs.rule4b;

    if (rule4a.enabled !== false && memberCount >= toNum(rule4a.minCompetitors, 12)) {
      var minPts4a = toNum(rule4a.minPoints, 40);
      var minLead = toNum(rule4a.minLeadOverSecond, 5);
      var secondPts = secondPlaceMemberPoints(ranked);
      if (points >= minPts4a && secondPts != null && points - secondPts >= minLead) {
        return { amount: toNum(rule4a.amount, -1), rule: '4a' };
      }
    }

    if (rule4b.enabled !== false && points >= toNum(rule4b.minPoints, 40)) {
      return { amount: toNum(rule4b.amount, -0.5), rule: '4b' };
    }

    return { amount: 0, rule: null };
  }

  function toNum(v, fallback) {
    var n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }

  /** Band match: index > minIndex (or any if null) AND index <= maxIndex (or any if null). */
  function lookupBandAmount(index, bands) {
    var idx = toNum(index, 0);
    var list = Array.isArray(bands) ? bands : [];
    for (var i = 0; i < list.length; i++) {
      var band = list[i] || {};
      var minEx = band.minIndex != null && band.minIndex !== '' ? toNum(band.minIndex, -Infinity) : -Infinity;
      var maxIn = band.maxIndex != null && band.maxIndex !== '' ? toNum(band.maxIndex, Infinity) : Infinity;
      if (idx > minEx && idx <= maxIn) return toNum(band.amount, 0);
    }
    return 0;
  }

  function groupKeyForPosition(position) {
    if (position === 1) return 'winner';
    if (position === 2) return 'runnerUp';
    if (position === 3) return 'thirdPlace';
    return null;
  }

  function adjustmentForPosition(config, position, handicapIndex) {
    var cfg = config || {};
    if (position >= 11) return toNum(cfg.outsideTop10, 0);
    if (position >= 4 && position <= 10) return 0;
    var groups = cfg.positionGroups || {};
    var key = groupKeyForPosition(position);
    if (!key) return 0;
    return lookupBandAmount(handicapIndex, groups[key]);
  }

  function playingHandicapFromIndex(index) {
    return Math.round(toNum(index, 0));
  }

  function trimDecimalZeros(s) {
    if (s.indexOf('.') === -1) return s;
    return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  }

  function roundHandicapValue(n) {
    var num = toNum(n, 0);
    if (!Number.isFinite(num)) return 0;
    return parseFloat(num.toFixed(3));
  }

  function addHandicapValues(a, b) {
    return roundHandicapValue(roundHandicapValue(a) + roundHandicapValue(b));
  }

  function capHandicapIndex(index, maxIndex) {
    var max = toNum(maxIndex, 40);
    var idx = roundHandicapValue(index);
    return idx > max ? max : idx;
  }

  function proposedAdjustmentAfter(indexBefore, amount, maxIndex) {
    var before = roundHandicapValue(indexBefore);
    var rawAfter = addHandicapValues(before, amount);
    var after = capHandicapIndex(rawAfter, maxIndex);
    var effectiveAmount = roundHandicapValue(after - before);
    return { indexAfter: after, amount: effectiveAmount };
  }

  /** Display numeric(5,3) without rounding away stored precision. */
  function formatDecimalTrimmed(n) {
    if (n == null || n === '') return '0';
    if (typeof n === 'string') {
      var raw = n.trim();
      if (!raw || !Number.isFinite(parseFloat(raw))) return '0';
      return trimDecimalZeros(raw);
    }
    var num = toNum(n, 0);
    if (Math.abs(num - Math.round(num)) < 1e-9) return String(Math.round(num));
    return trimDecimalZeros(num.toFixed(3));
  }

  function formatAdjustmentAmount(amount) {
    var n = toNum(amount, 0);
    var formatted = formatDecimalTrimmed(n);
    if (n > 0) return '+' + formatted;
    return formatted;
  }

  /** Sort key: historical rows with a real date after season year use that date. */
  function historySortKey(a) {
    var eff = a && a.effectiveDate ? String(a.effectiveDate).trim().slice(0, 10) : '';
    var sy = a && a.seasonYear != null ? parseInt(a.seasonYear, 10) : null;
    if (eff && sy != null) {
      var ey = parseInt(eff.slice(0, 4), 10);
      if (!isNaN(ey) && ey > sy) return eff;
    }
    if (eff) return eff;
    if (sy != null) {
      var r = String(a.outingLabel || '').match(/^R(\d+)/i);
      var round = r ? parseInt(r[1], 10) : 0;
      var mm = String(Math.min(12, Math.max(1, Math.ceil(round / 2) + 1))).padStart(2, '0');
      var dd = String(Math.min(28, Math.max(1, round * 2))).padStart(2, '0');
      return sy + '-' + mm + '-' + dd;
    }
    return '0000-01-01';
  }

  function sortHandicapHistoryNewestFirst(rows) {
    return rows.slice().sort(function (a, b) {
      var ac = String(a.createdAt || '');
      var bc = String(b.createdAt || '');
      if (ac !== bc) return bc.localeCompare(ac);
      var ak = historySortKey(a);
      var bk = historySortKey(b);
      if (ak !== bk) return bk.localeCompare(ak);
      var ar = String(a.outingLabel || '').match(/^R(\d+)/i);
      var br = String(b.outingLabel || '').match(/^R(\d+)/i);
      if (ar && br) return parseInt(br[1], 10) - parseInt(ar[1], 10);
      return String(b.outingLabel || '').localeCompare(String(a.outingLabel || ''));
    });
  }

  global.HandicapRules = {
    defaultHandicapRuleConfig: defaultHandicapRuleConfig,
    defaultHighScoreRules: defaultHighScoreRules,
    defaultPositionBands: defaultPositionBands,
    mergeHighScoreRules: mergeHighScoreRules,
    secondPlaceMemberPoints: secondPlaceMemberPoints,
    highScoreAdjustmentForMember: highScoreAdjustmentForMember,
    lookupBandAmount: lookupBandAmount,
    adjustmentForPosition: adjustmentForPosition,
    playingHandicapFromIndex: playingHandicapFromIndex,
    roundHandicapValue: roundHandicapValue,
    addHandicapValues: addHandicapValues,
    capHandicapIndex: capHandicapIndex,
    proposedAdjustmentAfter: proposedAdjustmentAfter,
    formatDecimalTrimmed: formatDecimalTrimmed,
    formatAdjustmentAmount: formatAdjustmentAmount,
    historySortKey: historySortKey,
    sortHandicapHistoryNewestFirst: sortHandicapHistoryNewestFirst,
    groupKeyForPosition: groupKeyForPosition,
  };
})(typeof window !== 'undefined' ? window : globalThis);
