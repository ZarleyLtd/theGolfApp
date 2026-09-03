/**
 * Course lookup AI prompt parts for Fill with AI / lookupCourseWithAi.
 * Part A and Part C are fixed; Part B (guidance) is configurable in admin settings.
 * Part C depends on strategy: "json" or "plainText".
 */
(function () {
  'use strict';

  var STRATEGIES = ['json', 'plainText'];
  var DEFAULT_STRATEGY = 'json';

  var COURSE_LOOKUP_PROMPT_PART_C_JSON =
    'Reply with a single JSON object only (no markdown, no explanation). Valid JSON with these keys:\n' +
    '"pars" = array of 18 integers (par per hole), "indexes" = array of 18 integers (stroke index per hole), "website" = club URL or "", "clubName" = official name or "", "courseMapLoc" = Google Maps directions/search URL or "".\n' +
    'Example: {"pars":[4,4,3,4,5,4,3,4,5,4,4,3,4,5,4,3,4,5],"indexes":[5,13,17,9,1,11,15,7,3,10,16,6,2,14,18,8,4,12],"website":"https://example.com","clubName":"Club Name","courseMapLoc":"https://www.google.com/maps/search/Club+Name"}';

  var COURSE_LOOKUP_PROMPT_PART_C_PLAIN =
    'Reply with plain text only (no markdown, no JSON, no explanation). Use exactly these lines:\n' +
    'PARS: <exactly 18 comma-separated integers — par for holes 1–18 only; values 3, 4, or 5; no yardages>\n' +
    'INDEXES: <exactly 18 comma-separated integers — stroke index for holes 1–18 only; each of 1–18 once; no yardages>\n' +
    'WEBSITE: <club URL or empty>\n' +
    'CLUB: <official club name or empty>\n' +
    'MAP: <Google Maps directions/search URL or empty>\n' +
    'Do not include distances/yardages. PARS and INDEXES must each contain exactly 18 numbers.\n' +
    'Example:\n' +
    'PARS: 4,4,3,4,5,4,3,4,5,4,4,3,4,5,4,3,4,5\n' +
    'INDEXES: 5,13,17,9,1,11,15,7,3,10,16,6,2,14,18,8,4,12\n' +
    'WEBSITE: https://example.com\n' +
    'CLUB: Club Name\n' +
    'MAP: https://www.google.com/maps/search/Club+Name\n';

  var DEFAULT_COURSE_LOOKUP_GUIDANCE =
    'SOURCE (in this order):\n' +
    '1. Official club website. Look up the course, find its official website, and get the full scorecard (par and stroke index for holes 1–18) from that site. Use this if available.\n' +
    '2. Only if the official website does not have the scorecard or you cannot find it, use Hole19 to get the 18 pars and 18 stroke indexes.\n\n';

  function normalizeStrategy(strategy) {
    var s = String(strategy || '').trim();
    if (s === 'plainText' || s === 'plaintext' || s === 'plain') return 'plainText';
    if (s === 'json' || s === 'JSON') return 'json';
    return DEFAULT_STRATEGY;
  }

  function strategyLabel(strategy) {
    return normalizeStrategy(strategy) === 'plainText' ? 'Plain Text' : 'JSON';
  }

  function partCForStrategy(strategy) {
    return normalizeStrategy(strategy) === 'plainText'
      ? COURSE_LOOKUP_PROMPT_PART_C_PLAIN
      : COURSE_LOOKUP_PROMPT_PART_C_JSON;
  }

  function buildPartA(courseName) {
    return 'Get 18-hole par and stroke index (Men\'s Championship tees) for: ' + String(courseName || '').trim() + '\n' +
      'Use the following guidance...\n';
  }

  function buildCourseLookupPrompt(courseName, guidanceText, strategy) {
    var guidance = String(guidanceText || '').trim() || DEFAULT_COURSE_LOOKUP_GUIDANCE;
    if (!guidance.endsWith('\n')) guidance += '\n';
    return buildPartA(courseName) + guidance + partCForStrategy(strategy);
  }

  function parseCsvInts(raw) {
    return String(raw || '')
      .split(',')
      .map(function (s) { return parseInt(String(s).trim(), 10); })
      .filter(function (n) { return isFinite(n); });
  }

  function parseLabeledCourseText(text, fallbackCourseName) {
    var cleaned = String(text || '')
      .replace(/```[\w]*\s*/g, '')
      .replace(/```/g, '')
      .trim();
    if (!cleaned) return null;

    var lines = cleaned.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    function getValue(prefix) {
      var upper = prefix.toUpperCase();
      var line = null;
      for (var i = 0; i < lines.length; i++) {
        var u = lines[i].toUpperCase();
        if (u.indexOf(upper + ':') === 0 || u.indexOf(upper + ' :') === 0 || u.indexOf(upper) === 0) {
          line = lines[i];
          break;
        }
      }
      if (!line) return '';
      var idx = line.indexOf(':');
      return idx >= 0 ? line.slice(idx + 1).trim() : '';
    }

    var pars = parseCsvInts(getValue('PARS'));
    var indexes = parseCsvInts(getValue('INDEXES'));
    if (pars.length < 18 || indexes.length < 18) {
      var combined = parseCsvInts(getValue('PAR_INDX'));
      if (combined.length >= 36) {
        pars = combined.slice(0, 18);
        indexes = combined.slice(18, 36);
      }
    }
    if (pars.length < 18 || indexes.length < 18) return null;
    return {
      courseName: fallbackCourseName || '',
      clubName: getValue('CLUB'),
      website: getValue('WEBSITE'),
      courseMapLoc: getValue('MAP'),
      pars: pars.slice(0, 18),
      indexes: indexes.slice(0, 18)
    };
  }

  window.CourseLookupPrompt = {
    STRATEGIES: STRATEGIES,
    DEFAULT_STRATEGY: DEFAULT_STRATEGY,
    PART_C: COURSE_LOOKUP_PROMPT_PART_C_JSON,
    PART_C_JSON: COURSE_LOOKUP_PROMPT_PART_C_JSON,
    PART_C_PLAIN: COURSE_LOOKUP_PROMPT_PART_C_PLAIN,
    DEFAULT_GUIDANCE: DEFAULT_COURSE_LOOKUP_GUIDANCE,
    normalizeStrategy: normalizeStrategy,
    strategyLabel: strategyLabel,
    partCForStrategy: partCForStrategy,
    buildPartA: buildPartA,
    buildCourseLookupPrompt: buildCourseLookupPrompt,
    parseLabeledCourseText: parseLabeledCourseText
  };
})();
