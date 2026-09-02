/**
 * Course lookup AI prompt parts for Fill with AI / lookupCourseWithAi.
 * Part A and Part C are fixed; Part B (guidance) is configurable in admin settings.
 */
(function () {
  'use strict';

  var COURSE_LOOKUP_PROMPT_PART_C =
    'Reply with a single JSON object only (no markdown, no explanation). Valid JSON with these keys:\n' +
    '"pars" = array of 18 integers (par per hole), "indexes" = array of 18 integers (stroke index per hole), "website" = club URL or "", "clubName" = official name or "", "courseMapLoc" = Google Maps directions/search URL or "".\n' +
    'Example: {"pars":[4,4,3,4,5,4,3,4,5,4,4,3,4,5,4,3,4,5],"indexes":[5,13,17,9,1,11,15,7,3,10,16,6,2,14,18,8,4,12],"website":"https://example.com","clubName":"Club Name","courseMapLoc":"https://www.google.com/maps/search/Club+Name"}';

  var DEFAULT_COURSE_LOOKUP_GUIDANCE =
    'SOURCE (in this order):\n' +
    '1. Official club website. Look up the course, find its official website, and get the full scorecard (par and stroke index for holes 1–18) from that site. Use this if available.\n' +
    '2. Only if the official website does not have the scorecard or you cannot find it, use Hole19 to get the 18 pars and 18 stroke indexes.\n\n';

  function buildPartA(courseName) {
    return 'Get 18-hole par and stroke index (Men\'s Championship tees) for: ' + String(courseName || '').trim() + '\n' +
      'Use the following guidance...\n';
  }

  function buildCourseLookupPrompt(courseName, guidanceText) {
    var guidance = String(guidanceText || '').trim() || DEFAULT_COURSE_LOOKUP_GUIDANCE;
    if (!guidance.endsWith('\n')) guidance += '\n';
    return buildPartA(courseName) + guidance + COURSE_LOOKUP_PROMPT_PART_C;
  }

  window.CourseLookupPrompt = {
    PART_C: COURSE_LOOKUP_PROMPT_PART_C,
    DEFAULT_GUIDANCE: DEFAULT_COURSE_LOOKUP_GUIDANCE,
    buildPartA: buildPartA,
    buildCourseLookupPrompt: buildCourseLookupPrompt
  };
})();
