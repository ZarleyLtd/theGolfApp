// Scorecard Page - Golf Scorecard Calculator
// Calculates Stableford points based on handicap and stroke inputs

function escapeHtml(text) {
  if (text == null || text === '') return '';
  const s = String(text);
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const ScorecardPage = {
  // Course data - pars and stroke indexes
  // Will be loaded from Google Sheet, fallback to hardcoded data if sheet fails
  courses: {
    Ardee: {
      pars: [4,3,4,5,4,4,4,4,3,4,4,4,3,5,4,4,4,4],
      indexes: [8,14,4,18,2,12,10,6,16,9,15,5,17,1,11,13,7,3]
    },
    DonabateYR: {
      pars: [3,5,4,3,4,5,4,3,5,4,3,4,4,4,4,4,5,4],
      indexes: [9,7,3,17,1,5,15,13,11,4,10,16,6,12,8,18,14,2]
    },
    DeerPark: {
      pars: [4,3,4,4,4,3,5,4,5,4,3,4,4,5,3,4,4,5],
      indexes: [10,2,14,16,9,18,5,6,12,1,15,11,17,8,13,7,4,3]
    },
    Balcarrick: {
      pars: [4,4,4,4,3,5,3,5,4,4,4,4,4,4,5,3,5,4],
      indexes: [17,7,3,13,11,5,15,9,1,18,2,12,10,4,8,16,14,6]
    },
    Elmgreen: {
      pars: [4,5,4,4,3,4,3,4,4,4,3,4,4,4,4,5,3,4],
      indexes: [3,11,15,5,13,17,9,7,1,10,18,12,2,8,14,4,16,6]
    },
    HeadfortNew: {
      pars: [4,5,4,3,4,5,3,4,4,4,3,4,4,5,4,5,3,4],
      indexes: [6,18,10,14,2,8,16,4,12,9,11,5,1,15,3,17,13,7]
    },
    HeadfortOld: {
      pars: [5,3,4,5,4,4,5,3,4,3,5,4,4,3,4,4,4,4],
      indexes: [17,12,5,8,1,3,18,14,10,16,13,4,6,11,15,2,7,9]
    },
    HollywoodLakes: {
      pars: [4,4,4,3,5,3,4,4,5,4,3,4,4,5,5,4,3,4],
      indexes: [8,4,12,14,18,10,2,6,16,3,11,17,9,1,15,5,13,7]
    },
    KilkeaCastle: {
      pars: [4,5,4,3,5,3,4,4,4,3,4,5,4,3,4,3,4,4],
      indexes: [11,4,12,6,13,18,2,3,15,17,10,14,8,16,7,5,1,9]
    },
    Killeen: {
      pars: [5,4,4,4,4,3,4,3,5,5,4,4,4,3,4,5,4,3],
      indexes: [14,4,12,8,2,16,6,18,10,15,7,3,11,9,1,17,5,13]
    },
    KilleenCastle: {
      pars: [4,5,4,4,4,3,5,3,4,4,4,5,4,3,5,3,4,4],
      indexes: [3,9,12,13,4,11,15,17,1,5,7,16,8,14,18,10,6,2]
    },
    Moyvalley: {
      pars: [4,3,4,4,3,5,4,5,4,4,4,4,5,3,4,4,3,5],
      indexes: [10,16,4,8,18,6,2,14,12,15,7,5,9,13,17,3,11,1]
    },
    Newbridge: {
      pars: [5,4,3,5,4,3,4,4,5,4,3,4,4,3,4,4,4,5],
      indexes: [16,10,12,6,8,18,2,4,14,1,11,17,3,9,13,7,5,15]
    },
    Roganstown: {
      pars: [4,3,4,5,5,3,4,4,3,5,4,3,4,4,4,4,3,5],
      indexes: [4,18,6,16,14,8,2,10,12,11,7,15,1,13,9,3,17,5]
    },
    Rosslare: {
      pars: [4,3,5,4,4,4,5,3,4,3,4,5,4,3,4,4,4,5],
      indexes: [10,9,14,8,2,13,6,12,3,11,1,17,16,15,7,5,4,18]
    },
    Sillogue: {
      pars: [4,3,5,4,5,4,3,4,3,4,4,5,3,4,4,4,4,4],
      indexes: [4,10,7,12,5,16,15,1,17,2,8,3,13,14,11,9,18,6]
    },
    RoyalCurragh: {
      pars: [5,4,4,3,4,4,5,4,4,4,3,5,5,3,4,3,4,4],
      indexes: [14,6,17,4,16,8,12,3,10,7,13,5,2,15,11,18,1,9]
    },
    Rathcore: {
      pars: [5,4,4,3,4,4,4,4,3,5,3,4,5,4,4,3,4,5],
      indexes: [5,9,7,11,3,17,15,1,13,18,14,2,12,10,4,6,16,8]
    },
    StMargarets: {
      pars: [4,3,5,4,3,4,4,5,4,4,4,5,3,4,3,5,5,4],
      indexes: [13,17,11,1,15,3,5,9,7,10,6,18,12,4,14,16,8,2]
    },
    Trim: {
      pars: [3,5,5,4,4,4,3,4,5,4,4,3,4,4,4,4,4,5],
      indexes: [10,4,6,14,2,12,16,8,18,17,7,15,5,13,11,3,1,9]
    },
    Tulfarris: {
      pars: [5,3,4,4,4,3,4,4,5,4,3,4,5,4,5,3,4,4],
      indexes: [12,16,4,2,14,10,18,8,6,1,17,7,15,9,13,11,5,3]
    },
    Rathsllagh: {
      pars: [5,4,4,3,4,5,3,4,4,4,5,4,3,4,4,5,3,4],
      indexes: [13,2,15,11,9,6,17,4,7,1,10,12,18,14,8,5,16,3]
    },
    ConcraWood: {
      pars: [5,4,4,5,4,3,4,4,3,4,4,3,5,3,5,4,4,4],
      indexes: [13,3,17,5,1,15,11,7,9,6,4,16,12,18,14,2,8,10]
    },
    Royal_Tara: {
      pars: [5,4,5,4,3,4,4,3,5,4,3,4,3,5,3,4,4,5],
      indexes: [12,4,6,16,18,14,2,10,8,1,17,5,15,11,13,3,7,9]
    },
    Font: {
      pars: [4,4,3,4,5,4,4,3,5,4,5,3,4,4,5,3,3,5],
      indexes: [17,5,6,7,15,2,18,11,1,10,8,12,16,3,14,13,9,4]
    },
    Alicante: {
      pars: [5,4,3,5,4,3,4,3,5,5,4,3,4,5,3,5,3,4],
      indexes: [17,5,15,13,1,9,3,7,11,18,6,16,2,12,8,14,4,10]
    },
    Millicent: {
      pars: [5,5,4,3,4,4,4,4,3,4,4,4,5,4,3,5,3,5],
      indexes: [2,18,10,16,12,4,6,8,14,5,7,13,17,15,11,3,9,1]
    }
  },

  currentCourse: null,
  pars: null,
  indexes: null,

  /** Selected outing { outingId, date, time, courseName } - used when saving score. */
  currentOuting: null,

  /** Selected player's ID (from society players); required for save/check/delete. */
  currentPlayerId: null,

  /** When set, only these course names (from Outings sheet) are shown in the Course dropdown. Null = show all. */
  societyOutingCourseNames: null,

  /** Full outings array (from getScorecardData) for default course logic */
  societyOutings: [],

  /** When an existing score is loaded (loadScoreIntoForm), we store it here for "already recorded" check and delete */
  _loadedExistingScore: null,

  init: async function() {
    const scorecardForm = document.getElementById('scorecard-form');
    if (!scorecardForm) {
      return;
    }

    // Society validation - require valid society (same as outings page)
    if (typeof AppConfig !== 'undefined' && typeof AppConfig.init === 'function') {
      await AppConfig.init();
    }
    const sid = typeof AppConfig !== 'undefined' ? AppConfig.getSocietyId() : null;
    const errorEl = document.getElementById('society-error');
    const errorMsg = document.getElementById('society-error-message');
    const mainEl = document.getElementById('scorecard-main-content');
    var pageName = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname.split('/').pop() || 'scorecard.html' : 'scorecard.html';
    if (!sid) {
      document.body.classList.add('society-invalid');
      if (errorEl) errorEl.style.display = 'block';
      if (mainEl) mainEl.style.display = 'none';
      if (errorMsg) {
        errorMsg.innerHTML = '<strong>No society selected.</strong><br>Add <code>?societyId=xxx</code> to the URL (e.g. <code>' + pageName + '?societyId=your-society-id</code>).';
      }
      return;
    }
    if (typeof AppConfig !== 'undefined' && !AppConfig.currentSociety) {
      document.body.classList.add('society-invalid');
      if (errorEl) errorEl.style.display = 'block';
      if (mainEl) mainEl.style.display = 'none';
      if (errorMsg) {
        errorMsg.innerHTML = '<strong>Society not found.</strong><br>Use a valid society ID in the URL (e.g. <code>' + pageName + '?societyId=your-society-id</code>).';
      }
      return;
    }
    document.body.classList.remove('society-invalid');
    if (errorEl) errorEl.style.display = 'none';
    if (mainEl) mainEl.style.display = 'block';

    // Single round-trip: outings, courses (filtered by outings), and players
    await this.loadScorecardData();

    // If no default was set, try to use Millicent, or fall back to first available course
    if (!this.currentCourse) {
      const availableCourses = Object.keys(this.courses);
      if (availableCourses.length > 0) {
        // Try Millicent first if it exists
        if (this.courses['Millicent']) {
          this.currentCourse = 'Millicent';
        } else {
          // Otherwise use the first available course (sorted alphabetically)
          this.currentCourse = availableCourses.sort()[0];
          console.log(`No default course found, using first available: ${this.currentCourse}`);
        }
      }
    }

    // Populate course dropdown with the default course already set
    this.populateCourseDropdown();
    
    // Update course data and display
    this.updateCourseData();
    
    // Ensure dropdown reflects the selected course (in case populateCourseDropdown didn't set it)
    const courseSelect = document.getElementById('course-select');
    if (courseSelect && this.currentCourse) {
      // Verify the course exists in the dropdown before setting it
      if (courseSelect.querySelector(`option[value="${this.currentCourse}"]`)) {
        courseSelect.value = this.currentCourse;
        // Trigger change event to ensure any listeners are notified
        courseSelect.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        console.warn(`Course "${this.currentCourse}" not found in dropdown, selecting first available`);
        // Select first non-empty option
        const firstOption = courseSelect.querySelector('option:not([value=""])');
        if (firstOption) {
          this.currentCourse = firstOption.value;
          courseSelect.value = this.currentCourse;
          this.updateCourseData();
        }
      }
    }

    // Set up event listeners
    this.setupEventListeners();

    // Focus Name field when page is first presented (desktop only)
    // On touch devices, skip auto-focus so the mobile keyboard doesn't open until the user taps the field
    requestAnimationFrame(() => {
      const playerInput = document.getElementById('player-name');
      const isTouchDevice = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
      if (playerInput && !isTouchDevice) playerInput.focus();
    });

    // If user came from sidescroll with partly filled data, restore it (no submit)
    this.applyDraftFromSidescroll();
  },

  /**
   * Normalize course name for matching (outings may use "Concra Wood", courses "ConcraWood")
   */
  normalizeCourseNameForMatch: function(name) {
    return (name || '').toString().toLowerCase().replace(/\s+/g, '');
  },

  /**
   * Single round-trip: load outings, courses (filtered by outings), and players via getScorecardData.
   * Sets societyOutings, societyOutingCourseNames, courses, populates player datalist, and default course.
   */
  loadScorecardData: async function() {
    try {
      // Use cached scorecard data from home (Next Outing) if available for instant default course
      const sid = typeof AppConfig !== 'undefined' ? AppConfig.getSocietyId() : null;
      if (sid) {
        try {
          const cached = sessionStorage.getItem('bgs_scorecard_data_cache');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.societyId === sid && parsed.outings && parsed.outings.length >= 0) {
              this.societyOutings = parsed.outings || [];
              var cachedCourses = parsed.courses;
              if (cachedCourses) {
                if (Array.isArray(cachedCourses)) {
                  var loaded = {};
                  for (var j = 0; j < cachedCourses.length; j++) {
                    var c = cachedCourses[j];
                    var cName = (c.courseName || '').trim();
                    if (!cName) continue;
                    var parIndx = (c.parIndx || '').toString().trim();
                    var parts = parIndx ? parIndx.split(',') : [];
                    if (parts.length >= 36) {
                      var pars = [];
                      var indexes = [];
                      if (parts.length >= 37) {
                        for (var p = 1; p <= 18; p++) pars.push(parseInt(parts[p], 10) || 0);
                        for (var x = 19; x <= 36; x++) indexes.push(parseInt(parts[x], 10) || 0);
                      } else {
                        for (var p2 = 0; p2 < 18; p2++) pars.push(parseInt(parts[p2], 10) || 0);
                        for (var x2 = 18; x2 < 36; x2++) indexes.push(parseInt(parts[x2], 10) || 0);
                      }
                      if (pars.length === 18 && indexes.length === 18) {
                        loaded[cName] = { pars: pars, indexes: indexes };
                      }
                    }
                  }
                  if (Object.keys(loaded).length > 0) this.courses = loaded;
                } else if (Object.keys(cachedCourses).length > 0) {
                  this.courses = cachedCourses;
                }
              }
              if (parsed.players && parsed.players.length >= 0) {
                this.playersWithHandicap = parsed.players;
                var list = document.getElementById('player-datalist');
                if (list) {
                  list.innerHTML = '';
                  var pNames = parsed.players.map(function(p) { return (p.playerName || '').trim(); }).filter(Boolean);
                  pNames.sort();
                  for (var m = 0; m < pNames.length; m++) {
                    var opt = document.createElement('option');
                    opt.value = pNames[m];
                    list.appendChild(opt);
                  }
                }
              }
              if (this.societyOutings.length > 0) {
                this.setDefaultCourseFromNextOuting();
              }
            }
          }
        } catch (cacheErr) {
          // ignore cache parse errors
        }
      }

      const result = await ApiClient.get({ action: 'getScorecardData' });
      const outings = (result && result.outings) || [];
      const apiCourses = (result && result.courses) || [];
      const players = (result && result.players) || [];

      this.societyOutings = outings;
      this.playersWithHandicap = players;

      // Unique course names from outings for dropdown filter
      var names = [];
      var seen = {};
      for (var i = 0; i < outings.length; i++) {
        var cn = (outings[i].courseName || '').trim();
        if (!cn) continue;
        var norm = this.normalizeCourseNameForMatch(cn);
        if (norm && !seen[norm]) {
          seen[norm] = 1;
          names.push(cn);
        }
      }
      this.societyOutingCourseNames = names.length ? names : null;

      // Parse courses (already filtered by backend to only outing courses)
      var loaded = {};
      for (var j = 0; j < apiCourses.length; j++) {
        var c = apiCourses[j];
        var cName = (c.courseName || '').trim();
        if (!cName) continue;
        var parIndx = (c.parIndx || '').toString().trim();
        var parts = parIndx ? parIndx.split(',') : [];
        if (parts.length >= 36) {
          var pars = [];
          var indexes = [];
          if (parts.length >= 37) {
            for (var p = 1; p <= 18; p++) pars.push(parseInt(parts[p], 10) || 0);
            for (var x = 19; x <= 36; x++) indexes.push(parseInt(parts[x], 10) || 0);
          } else {
            for (var p2 = 0; p2 < 18; p2++) pars.push(parseInt(parts[p2], 10) || 0);
            for (var x2 = 18; x2 < 36; x2++) indexes.push(parseInt(parts[x2], 10) || 0);
          }
          if (pars.length === 18 && indexes.length === 18) {
            loaded[cName] = { pars: pars, indexes: indexes };
          }
        }
      }
      if (Object.keys(loaded).length > 0) {
        this.courses = loaded;
        console.log('Loaded ' + Object.keys(this.courses).length + ' courses for society (from getScorecardData)');
      }

      // Players
      var list = document.getElementById('player-datalist');
      if (list) {
        list.innerHTML = '';
        var pNames = [];
        for (var k = 0; k < players.length; k++) {
          var n = (players[k].playerName || '').trim();
          if (n) pNames.push(n);
        }
        pNames.sort();
        for (var m = 0; m < pNames.length; m++) {
          var opt = document.createElement('option');
          opt.value = pNames[m];
          list.appendChild(opt);
        }
        if (pNames.length > 0) {
          console.log('Loaded ' + pNames.length + ' player(s) from getScorecardData');
        }
      }

      // Set default course from next outing (uses this.societyOutings)
      this.setDefaultCourseFromNextOuting();

      // Cache for home/next visit so scorecard is ready when built
      try {
        if (sid) {
          sessionStorage.setItem('bgs_scorecard_data_cache', JSON.stringify({
            societyId: sid,
            outings: this.societyOutings,
            courses: this.courses,
            players: this.playersWithHandicap || []
          }));
        }
      } catch (cacheErr) {}
    } catch (e) {
      console.warn('Failed to load scorecard data:', e);
    }
  },

  /**
   * Set default course from next upcoming outing (this.societyOutings).
   * Same logic as index page Next Outing: first outing where date/time + 5 hours > now.
   */
  setDefaultCourseFromNextOuting: function() {
    var outings = this.societyOutings || [];
    if (outings.length === 0) return;

    var now = Date.now();
    var fiveHoursMs = 5 * 60 * 60 * 1000;
    var next = null;
    for (var i = 0; i < outings.length; i++) {
      var outingStart = this.parseOutingDateTime(outings[i].date, outings[i].time);
      if (!outingStart) continue;
      if (outingStart.getTime() + fiveHoursMs > now) {
        next = outings[i];
        break;
      }
    }
    if (!next || !next.courseName) return;

    var courseNameFromOuting = (next.courseName || '').trim();
    var normOuting = this.normalizeCourseNameForMatch(courseNameFromOuting);
    var courseKeys = Object.keys(this.courses);
    for (var j = 0; j < courseKeys.length; j++) {
      if (this.normalizeCourseNameForMatch(courseKeys[j]) === normOuting) {
        // If the computed default outing and course match what is already set, avoid re-logging/re-setting
        // This prevents duplicate "Default course set" messages when data is loaded first from cache
        // and then refreshed from the backend with the same next outing.
        if (this.currentCourse === courseKeys[j] &&
            this.currentOuting &&
            this.currentOuting.outingId === next.outingId) {
          return;
        }
        this.currentCourse = courseKeys[j];
        var dateStr = next.date instanceof Date ? next.date.toISOString().split('T')[0] : String(next.date || '').trim();
        var timeStr = next.time instanceof Date ? (next.time.getHours().toString().padStart(2, '0') + ':' + next.time.getMinutes().toString().padStart(2, '0')) : String(next.time || '').trim();
        this.currentOuting = { outingId: next.outingId, date: dateStr, time: timeStr, courseName: courseNameFromOuting };
        console.log('Default course set to "' + courseKeys[j] + '" from next outing: ' + courseNameFromOuting);
        return;
      }
    }
  },

  /**
   * Parse outing date + time to a Date for comparison. Same logic as NextOuting.parseOutingDateTime.
   */
  parseOutingDateTime: function(dateStr, timeStr) {
    if (!dateStr) return null;
    var raw = String(dateStr).trim();
    var gmtIdx = raw.search(/\s(00:00:00|GMT|\d{2}:\d{2}:\d{2})/);
    if (gmtIdx !== -1) raw = raw.substring(0, gmtIdx).trim();
    var dateOnly = raw.split('T')[0];
    if (dateOnly.indexOf('-') === -1) dateOnly = raw;
    var timePart = (timeStr && String(timeStr).trim()) ? String(timeStr).trim() : '00:00';
    var d = new Date(dateOnly + 'T' + timePart);
    if (!isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100) return d;
    d = new Date(dateOnly);
    if (!isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100) return d;
    function applyTime(date, tStr) {
      if (!date || !tStr) return date;
      var tm = String(tStr).trim().match(/(\d{1,2}):(\d{2})/);
      if (tm) {
        date.setHours(parseInt(tm[1], 10), parseInt(tm[2], 10), 0, 0);
      }
      return date;
    }
    var parts = dateOnly.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (parts) {
      var y = parseInt(parts[3], 10), m1 = parseInt(parts[1], 10) - 1, d1 = parseInt(parts[2], 10);
      if (m1 >= 0 && m1 <= 11 && d1 >= 1 && d1 <= 31) {
        var dTry = new Date(y, m1, d1);
        if (!isNaN(dTry.getTime())) return applyTime(dTry, timeStr);
      }
      var m2 = parseInt(parts[2], 10) - 1, d2 = parseInt(parts[1], 10);
      if (m2 >= 0 && m2 <= 11 && d2 >= 1 && d2 <= 31) {
        dTry = new Date(y, m2, d2);
        if (!isNaN(dTry.getTime())) return applyTime(dTry, timeStr);
      }
    }
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var monMatch = dateOnly.match(/^\w{3}\s+(\w{3})\s+(\d{1,2})\s+(\d{4})$/);
    if (monMatch) {
      var mi = months.indexOf(monMatch[1]);
      if (mi !== -1) {
        var day = parseInt(monMatch[2], 10), year = parseInt(monMatch[3], 10);
        if (year >= 2000 && year <= 2100 && day >= 1 && day <= 31) {
          d = new Date(year, mi, day);
          if (!isNaN(d.getTime())) return applyTime(d, timeStr);
        }
      }
    }
    return null;
  },

  updateCourseData: function() {
    const course = this.courses[this.currentCourse];
    if (course) {
      this.pars = course.pars;
      this.indexes = course.indexes;
      this.updateScorecardDisplay();
    }
  },

  populateCourseDropdown: function() {
    const select = document.getElementById('course-select');
    if (!select) {
      return;
    }

    select.innerHTML = '<option value="">Select Course</option>';
    
    let courseKeys = Object.keys(this.courses).sort();
    // Restrict to courses that appear in this society's Outings sheet
    if (this.societyOutingCourseNames && this.societyOutingCourseNames.length > 0) {
      const self = this;
      const allowedNorm = new Set(
        this.societyOutingCourseNames.map(function(c) {
          return self.normalizeCourseNameForMatch(c);
        })
      );
      courseKeys = courseKeys.filter(function(key) {
        return allowedNorm.has(self.normalizeCourseNameForMatch(key));
      });
    }
    
    courseKeys.forEach(courseName => {
      const option = document.createElement('option');
      option.value = courseName;
      option.textContent = courseName;
      if (courseName === this.currentCourse) {
        option.selected = true;
      }
      select.appendChild(option);
    });
    this.setCurrentOutingFromCourse();
  },

  /** Set currentOuting from the selected course using the next upcoming outing from Outings sheet. */
  setCurrentOutingFromCourse: function() {
    const course = this.currentCourse;
    if (!course) {
      this.currentOuting = null;
      this.checkForExistingScore();
      return;
    }
    const outings = this.societyOutings || [];
    const norm = this.normalizeCourseNameForMatch(course);
    const now = Date.now();
    const fiveHoursMs = 5 * 60 * 60 * 1000;
    var next = null;
    for (var i = 0; i < outings.length; i++) {
      if (this.normalizeCourseNameForMatch(outings[i].courseName) !== norm) continue;
      var start = this.parseOutingDateTime(outings[i].date, outings[i].time);
      if (!start) continue;
      if (start.getTime() + fiveHoursMs > now) {
        next = outings[i];
        break;
      }
    }
    if (!next) {
      for (var j = outings.length - 1; j >= 0; j--) {
        if (this.normalizeCourseNameForMatch(outings[j].courseName) !== norm) continue;
        next = outings[j];
        break;
      }
    }
    if (next) {
      var dateStr = next.date instanceof Date ? next.date.toISOString().split('T')[0] : String(next.date || '').trim();
      var timeStr = next.time instanceof Date ? (next.time.getHours().toString().padStart(2, '0') + ':' + next.time.getMinutes().toString().padStart(2, '0')) : String(next.time || '').trim();
      this.currentOuting = { outingId: next.outingId, date: dateStr, time: timeStr, courseName: (next.courseName || '').trim() };
    } else {
      this.currentOuting = null;
    }
    this.checkForExistingScore();
  },

  updateScorecardDisplay: function() {
    if (!this.pars || !this.indexes) return;

    // Update par and index displays for all holes
    for (let i = 0; i < 18; i++) {
      const holeNum = i + 1;
      const parEl = document.getElementById(`par-${holeNum}`);
      const indexEl = document.getElementById(`index-${holeNum}`);
      
      if (parEl) parEl.textContent = this.pars[i];
      if (indexEl) indexEl.textContent = this.indexes[i];
    }
    
    // Update par totals
    this.updateParTotals();
  },

  updateParTotals: function() {
    if (!this.pars) return;
    
    let OUTtotPar = 0, INtotPar = 0;
    
    // Calculate front 9 par total
    for (let i = 0; i < 9; i++) {
      OUTtotPar += this.pars[i] || 0;
    }
    
    // Calculate back 9 par total
    for (let i = 9; i < 18; i++) {
      INtotPar += this.pars[i] || 0;
    }
    
    const totPar = OUTtotPar + INtotPar;
    
    const outParEl = document.getElementById('out-par');
    const inParEl = document.getElementById('in-par');
    const totalParEl = document.getElementById('total-par');
    
    if (outParEl) outParEl.textContent = OUTtotPar || '0';
    if (inParEl) inParEl.textContent = INtotPar || '0';
    if (totalParEl) totalParEl.textContent = totPar || '0';
  },

  setupEventListeners: function() {
    // Course selection change
    const courseSelect = document.getElementById('course-select');
    if (courseSelect) {
      courseSelect.addEventListener('change', (e) => {
        this.currentCourse = e.target.value;
        if (this.currentCourse) {
          this.updateCourseData();
          this.setCurrentOutingFromCourse();
          this.clearInputs();
        } else {
          this.currentOuting = null;
          this.setCurrentOutingFromCourse();
        }
      });
      courseSelect.addEventListener('blur', () => {
        this.checkForExistingScore();
      });
    }

    // Handle input field changes (auto-tab and calculation); track last-focused hole for view-switch draft
    for (let i = 1; i <= 18; i++) {
      const input = document.getElementById(`hole-${i}`);
      if (input) {
        input.addEventListener('focus', () => {
          this._lastFocusedHole = i;
        });
        input.addEventListener('input', (e) => {
          this.handleInput(e.target, i);
        });
        
        input.addEventListener('keyup', (e) => {
          if (e.key === 'Enter') {
            this.autotab(e.target, i);
          }
        });
      }
    }

    // Handicap input change
    const hcInput = document.getElementById('handicap');
    if (hcInput) {
      hcInput.addEventListener('input', (e) => {
        // Limit to 2 digits
        const value = e.target.value;
        if (value.length > 2) {
          e.target.value = value.slice(0, 2);
        }
        
        this.calculateScores();
        
        // Auto-tab to hole 1 when 2 digits are entered
        if (e.target.value.length >= 2) {
          const hole1Input = document.getElementById('hole-1');
          if (hole1Input) {
            hole1Input.focus();
            hole1Input.select();
          }
        }
      });
    }

    // Player name input - tab to handicap, fill H/C from Players when name matches
    const playerInput = document.getElementById('player-name');
    if (playerInput) {
      var playerInputDebounce = null;
      playerInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
          document.getElementById('handicap')?.focus();
        }
      });
      // When value exactly matches a player (e.g. after picking from datalist), fill H/C, check existing score, then advance to hole 1
      playerInput.addEventListener('input', () => {
        clearTimeout(playerInputDebounce);
        var self = this;
        playerInputDebounce = setTimeout(function() {
          var name = (playerInput.value || '').trim();
          if (!name || !self.playersWithHandicap || !self.playersWithHandicap.length) return;
          var matches = self.playersWithHandicap.some(function(p) {
            return (p.playerName || '').trim() === name;
          });
          if (matches) {
            self.fillHandicapFromPlayer();
            self.checkForExistingScore();
          }
        }, 150);
      });
      playerInput.addEventListener('blur', () => {
        if (this._skipNextPlayerBlurCheck) {
          this._skipNextPlayerBlurCheck = false;
          return;
        }
        this.fillHandicapFromPlayer();
        this.checkForExistingScore();
      });
      playerInput.addEventListener('change', () => {
        this.fillHandicapFromPlayer();
      });
    }

    // Save score button
    const saveBtn = document.getElementById('save-score-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveScore();
      });
    }

    // Delete score button (shown when an existing score is loaded)
    const deleteBtn = document.getElementById('delete-score-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        this.deleteLoadedScore();
      });
    }

    // Transfer to side-scroll view: save draft and navigate (only on standard page)
    const sidescrollLink = document.querySelector('.scorecard-view-toggle[href*="scorecard-sidescroll"]');
    if (sidescrollLink) {
      sidescrollLink.addEventListener('click', (e) => {
        e.preventDefault();
        const courseSelect = document.getElementById('course-select');
        const playerInput = document.getElementById('player-name');
        const handicapInput = document.getElementById('handicap');
        const holes = [];
        for (let i = 1; i <= 18; i++) {
          const input = document.getElementById('hole-' + i);
          holes.push(input ? (input.value || '') : '');
        }
        let focusedHole = null;
        const active = document.activeElement;
        if (active && active.id && /^hole-\d+$/.test(active.id)) {
          const n = parseInt(active.id.replace('hole-', ''), 10);
          if (n >= 1 && n <= 18) focusedHole = n;
        }
        if (focusedHole == null && this._lastFocusedHole >= 1 && this._lastFocusedHole <= 18) {
          focusedHole = this._lastFocusedHole;
        }
        const draft = {
          course: courseSelect ? courseSelect.value || '' : '',
          playerName: playerInput ? (playerInput.value || '').trim() : '',
          handicap: handicapInput ? (handicapInput.value || '').trim() : '',
          holes: holes,
          focusedHole: focusedHole
        };
        try {
          sessionStorage.setItem('bgs_scorecard_draft', JSON.stringify(draft));
        } catch (err) {}
        // Use link's href so ?societyId= etc. is preserved (e.g. by preserve-society-param.js)
        const targetUrl = sidescrollLink.getAttribute('href') || 'scorecard-sidescroll.html' + (window.location.search || '');
        window.location.href = targetUrl;
      });
    }

    // Scan scorecard button (only on page that has the modal)
    const scanBtn = document.getElementById('scorecard-scan-btn');
    if (scanBtn) {
      scanBtn.addEventListener('click', () => { this.openScanModal(); });
    }
    const scanOverlay = document.getElementById('scan-scorecard-modal');
    if (scanOverlay) {
      scanOverlay.addEventListener('click', (e) => {
        if (e.target === scanOverlay) this.closeScanModal();
      });
    }
  },

  openScanModal: function() {
    const overlay = document.getElementById('scan-scorecard-modal');
    const content = document.getElementById('scan-modal-content');
    if (!overlay || !content) return;
    overlay.classList.add('scan-modal--open');
    overlay.setAttribute('aria-hidden', 'false');
    this.renderScanStep1(content);
  },

  closeScanModal: function() {
    const overlay = document.getElementById('scan-scorecard-modal');
    if (!overlay) return;
    overlay.classList.remove('scan-modal--open');
    overlay.setAttribute('aria-hidden', 'true');
    const cameraInput = document.getElementById('scan-camera-input');
    const galleryInput = document.getElementById('scan-gallery-input');
    if (cameraInput) cameraInput.value = '';
    if (galleryInput) galleryInput.value = '';
  },

  renderScanStep1: function(contentEl) {
    const self = this;
    contentEl.innerHTML =
      '<h2 id="scan-modal-title" class="scan-modal__title">Scan scorecard</h2>' +
      '<p>Take a photo or choose an image of your scorecard. We will analyze it and fill in the strokes.</p>' +
      '<div class="scan-modal-upload-buttons">' +
      '<input type="file" accept="image/*" capture="environment" id="scan-camera-input" class="scan-modal-file-input" aria-hidden="true">' +
      '<input type="file" accept="image/*" id="scan-gallery-input" class="scan-modal-file-input" aria-hidden="true">' +
      '<label class="scan-modal-upload-btn" for="scan-camera-input" title="Take photo">Camera</label>' +
      '<label class="scan-modal-upload-btn" for="scan-gallery-input" title="Choose from gallery">Gallery / File</label>' +
      '</div>' +
      '<div id="scan-modal-status" class="scan-modal-status"></div>' +
      '<div class="scan-modal-actions">' +
      '<button type="button" class="scan-modal-cancel">Cancel</button>' +
      '</div>';
    contentEl.querySelector('.scan-modal-cancel').addEventListener('click', function() { self.closeScanModal(); });
    function handleImageChosen(input) {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function() {
        const dataUrl = reader.result;
        const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        const mimeType = (match && match[1]) || 'image/jpeg';
        const base64 = (match && match[2]) || '';
        if (!base64) return;
        self.handleScanImageChosen({ base64: base64, mimeType: mimeType });
      };
      reader.readAsDataURL(file);
      input.value = '';
    }
    const cameraInput = document.getElementById('scan-camera-input');
    const galleryInput = document.getElementById('scan-gallery-input');
    if (cameraInput) cameraInput.addEventListener('change', function() { handleImageChosen(this); });
    if (galleryInput) galleryInput.addEventListener('change', function() { handleImageChosen(this); });
  },

  handleScanImageChosen: function(imageData) {
    const contentEl = document.getElementById('scan-modal-content');
    if (!contentEl) return;
    this.renderScanAnalyzing(contentEl);
    const courseSelect = document.getElementById('course-select');
    const playerInput = document.getElementById('player-name');
    const handicapInput = document.getElementById('handicap');
    const context = {
      currentCourseName: courseSelect ? courseSelect.value || '' : '',
      currentPlayerName: playerInput ? (playerInput.value || '').trim() : '',
      currentHandicap: handicapInput ? (handicapInput.value || '').trim() : ''
    };
    const self = this;
    ApiClient.post('analyzeScorecardImage', {
      base64: imageData.base64,
      mimeType: imageData.mimeType,
      context: context
    })
      .then(function(result) {
        if (result && result.success && Array.isArray(result.strokes)) {
          self.renderScanResult(result);
        } else {
          self.renderScanError(result && result.error ? result.error : 'Could not analyze the image.');
        }
      })
      .catch(function(err) {
        self.renderScanError(err.message || 'Could not analyze the image.');
      });
  },

  renderScanAnalyzing: function(contentEl) {
    contentEl.innerHTML = '<p class="scan-modal-status">Analyzing…</p>';
  },

  renderScanError: function(message) {
    const contentEl = document.getElementById('scan-modal-content');
    if (!contentEl) return;
    const self = this;
    contentEl.innerHTML =
      '<h2 id="scan-modal-title" class="scan-modal__title">Scan scorecard</h2>' +
      '<div class="scan-modal-error">' + escapeHtml(message) + '</div>' +
      '<div class="scan-modal-actions">' +
      '<button type="button" class="scan-modal-cancel">Close</button>' +
      '</div>';
    contentEl.querySelector('.scan-modal-cancel').addEventListener('click', function() { self.closeScanModal(); });
  },

  renderScanResult: function(result) {
    const contentEl = document.getElementById('scan-modal-content');
    if (!contentEl) return;
    const courseSelect = document.getElementById('course-select');
    const playerInput = document.getElementById('player-name');
    const handicapInput = document.getElementById('handicap');
    const currentCourse = courseSelect ? (courseSelect.value || '').trim() : '';
    const currentPlayer = playerInput ? (playerInput.value || '').trim() : '';
    const currentHandicap = (handicapInput && handicapInput.value) ? String(handicapInput.value).trim() : '';
    const warnings = [];
    if (result.playerNameOnCard && currentPlayer && (result.playerNameOnCard.trim().toLowerCase() !== currentPlayer.toLowerCase())) {
      warnings.push('The card shows a different name: ' + escapeHtml(result.playerNameOnCard));
    }
    if (result.handicapOnCard != null && currentHandicap !== '' && Number(result.handicapOnCard) !== Number(currentHandicap)) {
      warnings.push('The card shows a different handicap: ' + result.handicapOnCard);
    }
    if (result.courseNameOnCard && currentCourse && this.normalizeCourseNameForMatch(result.courseNameOnCard) !== this.normalizeCourseNameForMatch(currentCourse)) {
      warnings.push('The card appears to be for a different course: ' + escapeHtml(result.courseNameOnCard));
    }
    let warningsHtml = '';
    if (warnings.length > 0) {
      warningsHtml = '<div class="scan-modal-warnings"><ul>' + warnings.map(function(w) { return '<li>' + w + '</li>'; }).join('') + '</ul></div>';
    }
    const self = this;
    contentEl.innerHTML =
      '<h2 id="scan-modal-title" class="scan-modal__title">Scan scorecard</h2>' +
      warningsHtml +
      '<p>Scores were read from the image. Apply to fill the stroke fields (name and handicap on the page will not be changed).</p>' +
      '<div class="scan-modal-actions">' +
      '<button type="button" class="scan-modal-apply">Apply scores</button>' +
      '<button type="button" class="scan-modal-cancel">Cancel</button>' +
      '</div>';
    contentEl.querySelector('.scan-modal-apply').addEventListener('click', function() {
      self.applyScannedScores(result);
      self.closeScanModal();
    });
    contentEl.querySelector('.scan-modal-cancel').addEventListener('click', function() { self.closeScanModal(); });
  },

  applyScannedScores: function(result) {
    const strokes = result.strokes || [];
    for (let i = 1; i <= 18; i++) {
      const input = document.getElementById('hole-' + i);
      if (!input) continue;
      const v = strokes[i - 1];
      if (v != null && v !== '' && !isNaN(Number(v))) {
        const n = parseInt(Number(v), 10);
        input.value = (n >= 0 && n <= 9) ? String(n) : '';
      } else {
        input.value = '';
      }
    }
    this.calculateScores();
  },

  handleInput: function(input, holeNum) {
    // Ignore decimal point - strokes are integers only
    if (input.value.includes('.')) {
      input.value = input.value.replace(/\./g, '');
    }
    // Validate input (0-9 for strokes)
    if (input.value && (parseInt(input.value, 10) < 0 || parseInt(input.value, 10) > 9)) {
      input.value = '';
    }
    
    // Auto-tab only if max length reached AND next field is empty
    if (input.value.length >= 1 && parseInt(input.value) >= 0) {
      this.autotab(input, holeNum);
    }
    
    // Recalculate scores
    this.calculateScores();
  },

  autotab: function(currentInput, currentHole) {
    // Only auto-tab if we've reached max length (1 digit) and value is valid
    const maxLength = currentInput.getAttribute('maxlength');
    if (!maxLength || currentInput.value.length < parseInt(maxLength)) {
      return;
    }
    
    // Only proceed if we have a valid digit (0-9)
    const value = parseInt(currentInput.value);
    if (isNaN(value) || value < 0 || value > 9) {
      return;
    }
    
    // If on hole 18, go to Submit Score button instead of wrapping to hole 1
    if (currentHole === 18) {
      const submitBtn = document.getElementById('save-score-btn');
      if (submitBtn) {
        submitBtn.focus();
      }
      return;
    }
    
    // Focus next hole input
    const nextHole = currentHole + 1;
    const nextInput = document.getElementById(`hole-${nextHole}`);
    
    // Always advance to next input, whether it has a value or not
    if (nextInput) {
      nextInput.focus();
      nextInput.select();
    }
  },

  ifZero: function(value, defaultValue) {
    return value === 0 || value === '' || value === null ? defaultValue : value;
  },

  calculateScores: function() {
    if (!this.pars || !this.indexes) return;

    const hc = parseInt(document.getElementById('handicap')?.value) || 0;
    if (hc === 0) {
      this.resetAllPoints();
      return;
    }

    const strokes = [];
    const shots = [];
    const points = [];

    // Get stroke inputs
    for (let i = 0; i < 18; i++) {
      const input = document.getElementById(`hole-${i + 1}`);
      strokes[i] = input && input.value ? parseInt(input.value) : 0;
      shots[i] = 0;
      points[i] = 0;
    }

    // Calculate shots received per hole
    for (let i = 0; i < 18; i++) {
      if (this.indexes[i] <= hc) {
        shots[i] = Math.floor((hc - this.indexes[i]) / 18) + 1;
      } else {
        shots[i] = Math.floor(Math.max((hc - this.indexes[i]), 0) / 18);
      }
    }

    // Calculate stableford points
    for (let i = 0; i < 18; i++) {
      // If strokes is 0, points are 0
      if (strokes[i] === 0) {
        points[i] = 0;
      } else {
        const netStrokes = strokes[i] - shots[i];
        const netVsPar = this.pars[i] - netStrokes;
        points[i] = Math.max(netVsPar + 2, 0);
      }
    }

    // Calculate totals
    let OUTtotScore = 0, INtotScore = 0;
    let OUTtotPts = 0, INtotPts = 0;
    let OUTtotPar = 0, INtotPar = 0;

    // Calculate front 9 totals
    for (let i = 0; i < 9; i++) {
      const input = document.getElementById(`hole-${i + 1}`);
      if (input && input.value !== '') {
        OUTtotScore += strokes[i] || 0;
        OUTtotPts += points[i] || 0;
      }
      OUTtotPar += this.pars[i] || 0;
    }

    // Calculate back 9 totals
    for (let i = 9; i < 18; i++) {
      const input = document.getElementById(`hole-${i + 1}`);
      if (input && input.value !== '') {
        INtotScore += strokes[i] || 0;
        INtotPts += points[i] || 0;
      }
      INtotPar += this.pars[i] || 0;
    }

    const totScore = OUTtotScore + INtotScore;
    const totPoints = OUTtotPts + INtotPts;
    const totPar = OUTtotPar + INtotPar;

    // Update point displays
    for (let i = 0; i < 18; i++) {
      const pointsEl = document.getElementById(`points-${i + 1}`);
      const input = document.getElementById(`hole-${i + 1}`);
      if (pointsEl) {
        // Show points if input has a value (including 0), otherwise show 0
        if (input && input.value !== '') {
          pointsEl.textContent = points[i];
        } else {
          pointsEl.textContent = '0';
        }
      }
    }

    // Update totals (use optional checks for par elements - not present on side-scroll page)
    const outScoreEl = document.getElementById('out-score');
    const outPtsEl = document.getElementById('out-points');
    const outParEl = document.getElementById('out-par');
    const inScoreEl = document.getElementById('in-score');
    const inPtsEl = document.getElementById('in-points');
    const inParEl = document.getElementById('in-par');
    const totalScoreEl = document.getElementById('total-score');
    const totalPtsEl = document.getElementById('total-points');
    const totalParEl = document.getElementById('total-par');
    const outScoreVal = OUTtotScore || '0';
    const outPtsVal = OUTtotPts || '0';
    const inScoreVal = INtotScore || '0';
    const inPtsVal = INtotPts || '0';
    const totalScoreVal = totScore || '0';
    const totalPtsVal = totPoints || '0';
    if (outScoreEl) outScoreEl.textContent = outScoreVal;
    if (outPtsEl) outPtsEl.textContent = outPtsVal;
    if (outParEl) outParEl.textContent = OUTtotPar || '0';
    if (inScoreEl) inScoreEl.textContent = inScoreVal;
    if (inPtsEl) inPtsEl.textContent = inPtsVal;
    if (inParEl) inParEl.textContent = INtotPar || '0';
    if (totalScoreEl) totalScoreEl.textContent = totalScoreVal;
    if (totalPtsEl) totalPtsEl.textContent = totalPtsVal;
    if (totalParEl) totalParEl.textContent = totPar || '0';
    // Update header labels (side-scroll page: "Holes 1-9  Strokes [x] Points [y]")
    document.querySelectorAll('.out-score-header').forEach(el => { el.textContent = outScoreVal; });
    document.querySelectorAll('.out-points-header').forEach(el => { el.textContent = outPtsVal; });
    document.querySelectorAll('.in-score-header').forEach(el => { el.textContent = inScoreVal; });
    document.querySelectorAll('.in-points-header').forEach(el => { el.textContent = inPtsVal; });
  },

  resetAllPoints: function() {
    for (let i = 1; i <= 18; i++) {
      const pointsEl = document.getElementById(`points-${i}`);
      if (pointsEl) pointsEl.textContent = '0';
    }
    
    const totals = ['out-score','out-points','out-par','in-score','in-points','in-par','total-score','total-points','total-par'];
    totals.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '0';
    });
    document.querySelectorAll('.out-score-header, .out-points-header, .in-score-header, .in-points-header').forEach(el => { el.textContent = '0'; });
  },

  clearInputs: function() {
    this._loadedExistingScore = null;
    this.updateDeleteButtonVisibility();
    // Clear all stroke inputs
    for (let i = 1; i <= 18; i++) {
      const input = document.getElementById(`hole-${i}`);
      if (input) input.value = '';
    }
    this.resetAllPoints();
  },

  // Normalize name for comparison (case-insensitive, ignore spaces)
  normalizeName: function(name) {
    if (!name) return '';
    return name.toLowerCase().replace(/\s+/g, '');
  },

  // Show subtle loading message (non-blocking, auto-dismisses)
  showLoadingMessage: function(message) {
    // Remove any existing loading message
    const existing = document.querySelector('.scorecard-loading-message');
    if (existing) {
      existing.remove();
    }

    // Find the scorecard header to position message below name field
    const header = document.querySelector('.scorecard-header');
    if (!header) {
      // Fallback to body if header not found
      console.warn('scorecard-header not found, using body');
      return;
    }

    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'scorecard-loading-message';
    loadingMsg.innerHTML = `
      <div class="spinner"></div>
      <span>${message}</span>
    `;
    header.appendChild(loadingMsg);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      loadingMsg.classList.add('fade-out');
      setTimeout(() => {
        if (loadingMsg.parentNode) {
          loadingMsg.remove();
        }
      }, 300);
    }, 3000);

    return loadingMsg;
  },

  // Hide loading message
  hideLoadingMessage: function() {
    const loadingMsg = document.querySelector('.scorecard-loading-message');
    if (loadingMsg) {
      loadingMsg.classList.add('fade-out');
      setTimeout(() => {
        if (loadingMsg.parentNode) {
          loadingMsg.remove();
        }
      }, 300);
    }
  },

  // Show user-friendly message (blocking, requires acknowledgment)
  showMessage: function(message, isError = false) {
    // Remove any existing message
    const existing = document.querySelector('.scorecard-message-overlay');
    if (existing) {
      existing.remove();
    }

    const overlay = document.createElement('div');
    overlay.className = 'scorecard-message-overlay';
    
    const messageBox = document.createElement('div');
    messageBox.className = 'scorecard-message';
    if (isError) {
      messageBox.style.background = '#b82e35';
    }
    
    messageBox.innerHTML = `
      <div>${message}</div>
      <button type="button" class="scorecard-message-close">OK</button>
    `;
    
    overlay.appendChild(messageBox);
    document.body.appendChild(overlay);

    // Close on button click
    const closeBtn = messageBox.querySelector('.scorecard-message-close');
    closeBtn.addEventListener('click', () => {
      overlay.remove();
    });

    // Close on overlay click (outside message box)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });

    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Focus the button for accessibility
    closeBtn.focus();
  },

  /** When player name matches a Players sheet entry, fill H/C from that player's handicap. */
  fillHandicapFromPlayer: function() {
    const list = this.playersWithHandicap;
    if (!list || !list.length) return;
    const playerInput = document.getElementById('player-name');
    const handicapInput = document.getElementById('handicap');
    if (!playerInput || !handicapInput) return;
    const name = (playerInput.value || '').trim();
    if (!name) {
      this.currentPlayerId = null;
      return;
    }
    const norm = (this.normalizeName && this.normalizeName(name)) || name.toLowerCase().replace(/\s+/g, '');
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const pName = (p.playerName || '').trim();
      const pNorm = (this.normalizeName && this.normalizeName(pName)) || pName.toLowerCase().replace(/\s+/g, '');
      if (pNorm === norm) {
        const hc = p.handicap != null && p.handicap !== '' ? String(p.handicap).trim() : '';
        handicapInput.value = hc;
        this.currentPlayerId = p.playerId || null;
        return;
      }
    }
    this.currentPlayerId = null;
  },

  /** Normalize outing time to HH:MM for API. Handles Date, "10:00", or Sheets serial number (e.g. 0.41666). */
  normalizeTimeForApi: function(val) {
    if (val == null || val === '') return '';
    if (val instanceof Date) {
      const h = val.getHours(), m = val.getMinutes();
      return (h < 10 ? '0' + h : '' + h) + ':' + (m < 10 ? '0' + m : '' + m);
    }
    const str = String(val).trim();
    const match = str.match(/^(\d{1,2}):(\d{2})/);
    if (match) {
      const h = parseInt(match[1], 10), m = parseInt(match[2], 10);
      return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    }
    const num = parseFloat(str);
    if (!isNaN(num) && num >= 0 && num < 1) {
      const totalMins = Math.round(num * 24 * 60) % (24 * 60);
      const h = Math.floor(totalMins / 60), m = totalMins % 60;
      return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    }
    return str;
  },

  // Check for existing score when course or player changes. Uses outingId and playerId.
  // Only one request at a time; skip blur-triggered check when we move focus to hole 1.
  checkForExistingScore: function() {
    if (this._applyingDraft) return;
    if (this._checkExistingScoreInFlight) return;
    this.fillHandicapFromPlayer();
    const outing = this.currentOuting;
    if (!outing || !outing.outingId) {
      this._loadedExistingScore = null;
      this.updateDeleteButtonVisibility();
      return;
    }
    if (!this.currentPlayerId) {
      this._loadedExistingScore = null;
      this.updateDeleteButtonVisibility();
      return;
    }

    this._checkExistingScoreInFlight = true;
    this.showLoadingMessage('Checking for existing score...');
    const payload = { outingId: outing.outingId, playerId: this.currentPlayerId };
    ApiClient.post('checkExistingScore', payload)
      .then(result => {
        this._checkExistingScoreInFlight = false;
        this.hideLoadingMessage();
        if (result.exists && result.score) {
          this.loadScoreIntoForm(result.score);
        } else {
          this._loadedExistingScore = null;
          this.clearInputs();
          this.updateDeleteButtonVisibility();
        }
        this._skipNextPlayerBlurCheck = true;
        this.focusHole1();
      })
      .catch(error => {
        this._checkExistingScoreInFlight = false;
        this.hideLoadingMessage();
        this._loadedExistingScore = null;
        this.updateDeleteButtonVisibility();
        if (!error.message.includes('API URL not configured')) {
          console.error('Error checking for existing score:', error);
        }
        this._skipNextPlayerBlurCheck = true;
        this.focusHole1();
      });
  },

  /** Focus hole 1 input (used after player selection / score check). */
  focusHole1: function() {
    requestAnimationFrame(() => {
      const hole1 = document.getElementById('hole-1');
      if (hole1) {
        hole1.focus();
        hole1.select();
      }
    });
  },

  /** Show or hide the delete score button based on whether we have a loaded existing score. */
  updateDeleteButtonVisibility: function() {
    const btn = document.getElementById('delete-score-btn');
    if (btn) {
      btn.style.display = this._loadedExistingScore ? 'inline-flex' : 'none';
    }
  },

  /** Delete the currently loaded existing score (called when user clicks Delete score button). */
  deleteLoadedScore: function() {
    const score = this._loadedExistingScore;
    if (!score || !score.outingId || !score.playerId) {
      this.showMessage('No score loaded to delete.', false);
      return;
    }
    const deleteBtn = document.getElementById('delete-score-btn');
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.textContent = 'Deleting…';
    }
    const payload = { outingId: score.outingId, playerId: score.playerId };
    ApiClient.post('deleteScore', payload)
      .then(() => {
        this._loadedExistingScore = null;
        this.updateDeleteButtonVisibility();
        this.clearInputs();
        if (deleteBtn) {
          deleteBtn.disabled = false;
          deleteBtn.textContent = 'Delete score';
        }
        this.showMessage('Score deleted.', false);
      })
      .catch((err) => {
        if (deleteBtn) {
          deleteBtn.disabled = false;
          deleteBtn.textContent = 'Delete score';
        }
        this.showMessage(err.message || 'Unable to delete score.', true);
      });
  },

  // Save/Load functionality
  saveScore: function() {
    const saveBtn = document.getElementById('save-score-btn');
    const playerName = document.getElementById('player-name')?.value.trim();
    const handicap = parseInt(document.getElementById('handicap')?.value) || 0;
    const course = this.currentCourse;
    
    if (!playerName) {
      this.showMessage('Please enter your name', false);
      return;
    }
    
    if (!course) {
      this.showMessage('Please select a course', false);
      return;
    }
    
    if (handicap === 0) {
      this.showMessage('Please enter your handicap', false);
      return;
    }
    
    if (!this.pars || !this.indexes) {
      this.showMessage('Please select a course', false);
      return;
    }
    
    // Get all hole scores (strokes)
    const holes = [];
    const holePoints = [];
    let hasScores = false;
    
    // Calculate shots received per hole
    const shots = [];
    for (let i = 0; i < 18; i++) {
      if (this.indexes[i] <= handicap) {
        shots[i] = Math.floor((handicap - this.indexes[i]) / 18) + 1;
      } else {
        shots[i] = Math.floor(Math.max((handicap - this.indexes[i]), 0) / 18);
      }
    }
    
    // Get strokes and calculate points for each hole
    for (let i = 0; i < 18; i++) {
      const input = document.getElementById(`hole-${i + 1}`);
      const strokes = input && input.value ? parseInt(input.value) : 0;
      holes.push(strokes);
      
      // Calculate points for this hole
      let points = 0;
      if (strokes > 0) {
        const netStrokes = strokes - shots[i];
        const netVsPar = this.pars[i] - netStrokes;
        points = Math.max(netVsPar + 2, 0);
      }
      holePoints.push(points);
      
      if (strokes > 0) hasScores = true;
    }
    
    if (!hasScores) {
      if (typeof BriefMessage === 'function' && saveBtn) {
        BriefMessage('No Score entered', saveBtn);
      } else {
        this.showMessage('Please enter at least one hole score', false);
      }
      return;
    }
    
    // Calculate totals
    let OUTtotScore = 0, INtotScore = 0;
    let OUTtotPts = 0, INtotPts = 0;
    let BACK6totScore = 0, BACK6totPts = 0;
    let BACK3totScore = 0, BACK3totPts = 0;
    
    // Calculate front 9 totals (holes 1-9, indices 0-8)
    for (let i = 0; i < 9; i++) {
      if (holes[i] > 0) {
        OUTtotScore += holes[i];
        OUTtotPts += holePoints[i];
      }
    }
    
    // Calculate back 9 totals (holes 10-18, indices 9-17)
    for (let i = 9; i < 18; i++) {
      if (holes[i] > 0) {
        INtotScore += holes[i];
        INtotPts += holePoints[i];
      }
    }
    
    // Calculate back 6 totals (holes 13-18, indices 12-17)
    for (let i = 12; i < 18; i++) {
      if (holes[i] > 0) {
        BACK6totScore += holes[i];
        BACK6totPts += holePoints[i];
      }
    }
    
    // Calculate back 3 totals (holes 16-18, indices 15-17)
    for (let i = 15; i < 18; i++) {
      if (holes[i] > 0) {
        BACK3totScore += holes[i];
        BACK3totPts += holePoints[i];
      }
    }
    
    const totalScore = OUTtotScore + INtotScore;
    const totalPoints = OUTtotPts + INtotPts;
    
    const outing = this.currentOuting;
    if (!outing || !outing.date) {
      this.showMessage('No outing found for this course. Add an outing in Admin first.', false);
      return;
    }
    const date = outing.date instanceof Date ? outing.date.toISOString().split('T')[0] : String(outing.date || '').trim();
    const time = this.normalizeTimeForApi(outing.time);

    // If we have a loaded existing score and form data is unchanged, show "Already recorded"
    if (this._loadedExistingScore) {
      const sameHc = Number(this._loadedExistingScore.handicap) === handicap;
      let sameHoles = true;
      for (let i = 0; i < 18; i++) {
        const existingVal = this._loadedExistingScore.holes[i];
        const existing = existingVal === '' || existingVal === null ? '' : String(existingVal);
        if (String(holes[i] || '') !== existing) {
          sameHoles = false;
          break;
        }
      }
      if (sameHc && sameHoles) {
        if (typeof BriefMessage === 'function' && saveBtn) {
          BriefMessage('Score already recorded', saveBtn);
        } else {
          this.showMessage('Already recorded.', false);
        }
        return;
      }
    }
    
    const scoreData = {
      outingId: outing.outingId,
      playerId: this.currentPlayerId,
      playerName: playerName,
      handicap: handicap,
      holes: holes,  // Strokes for each hole
      holePoints: holePoints,  // Points for each hole
      totalScore: totalScore,
      totalPoints: totalPoints,
      outScore: OUTtotScore,
      outPoints: OUTtotPts,
      inScore: INtotScore,
      inPoints: INtotPts,
      back6Score: BACK6totScore,
      back6Points: BACK6totPts,
      back3Score: BACK3totScore,
      back3Points: BACK3totPts
    };
    
    // Show loading state with spinner
    const originalBtnText = saveBtn ? saveBtn.innerHTML : 'Submit Score';
    
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = 'Saving<span class="scorecard-saving-indicator"><span class="spinner"></span></span>';
    }
    
    ApiClient.post('saveScore', scoreData)
      .then(result => {
        // Restore button
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = originalBtnText;
        }
        // Set loaded score to what we just saved so a second Submit without changes shows "Already recorded"
        this._loadedExistingScore = {
          outingId: scoreData.outingId,
          playerId: scoreData.playerId,
          playerName: scoreData.playerName,
          course: (outing && outing.courseName) || '',
          date: outing ? (outing.date instanceof Date ? outing.date.toISOString().split('T')[0] : String(outing.date || '').trim()) : '',
          handicap: scoreData.handicap,
          holes: scoreData.holes.slice ? scoreData.holes.slice() : scoreData.holes,
          timestamp: (result && result.timestamp) ? result.timestamp : ''
        };
        this.updateDeleteButtonVisibility();
        // Show user-friendly success message with points score
        const pointsMessage = `Your points score of ${totalPoints} was successfully recorded`;
        this.showMessage(pointsMessage, false);
      })
      .catch(error => {
        // Restore button
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = originalBtnText;
        }
        
        // Show user-friendly error message
        let errorMessage = 'Unable to save your score.';
        if (error.message) {
          // Make error messages more user-friendly
          if (error.message.includes('404')) {
            errorMessage = 'Unable to connect to the server. Please check your connection and try again.';
          } else if (error.message.includes('Network') || error.message.includes('CORS')) {
            errorMessage = 'Network error. Please check your connection and try again.';
          } else {
            errorMessage = `Unable to save your score: ${error.message}`;
          }
        }
        this.showMessage(errorMessage, true);
      });
  },


  loadScoreIntoForm: function(score) {
    // When loading an existing score, only update handicap and scores
    // Do NOT change Course or Player - they were already entered by the user
    
    this._loadedExistingScore = score;
    this.updateDeleteButtonVisibility();

    // Set handicap
    const handicapInput = document.getElementById('handicap');
    if (handicapInput) handicapInput.value = score.handicap;
    
    // Do NOT set course - keep the user's current selection
    // The course was already selected when checking for existing score
    
    // Set hole scores
    for (let i = 0; i < 18; i++) {
      const input = document.getElementById(`hole-${i + 1}`);
      if (input && score.holes[i] !== '' && score.holes[i] !== null) {
        input.value = score.holes[i];
      } else if (input) {
        input.value = '';
      }
    }
    
    // Recalculate scores
    this.calculateScores();
    
    // Scroll to top of form
    document.getElementById('scorecard-form')?.scrollIntoView({ behavior: 'smooth' });
  },

  /**
   * If user navigated from the other scorecard view with partly filled data, restore it.
   * Runs on both standard and side-scroll pages when bgs_scorecard_draft is in sessionStorage. Does not submit.
   */
  applyDraftFromSidescroll: function() {
    let raw;
    try {
      raw = sessionStorage.getItem('bgs_scorecard_draft');
    } catch (err) {
      return;
    }
    if (!raw) return;

    this._applyingDraft = true;

    try {
      sessionStorage.removeItem('bgs_scorecard_draft');
    } catch (err) {
      // continue to apply draft
    }

    let draft;
    try {
      draft = JSON.parse(raw);
    } catch (err) {
      this._applyingDraft = false;
      return;
    }
    if (!draft || !draft.holes || draft.holes.length !== 18) {
      this._applyingDraft = false;
      return;
    }

    const courseSelect = document.getElementById('course-select');
    if (courseSelect && draft.course) {
      courseSelect.value = draft.course;
      if (courseSelect.value === draft.course) {
        this.currentCourse = draft.course;
        this.updateCourseData();
      }
    }

    const playerInput = document.getElementById('player-name');
    if (playerInput && draft.playerName !== undefined) playerInput.value = draft.playerName;

    const handicapInput = document.getElementById('handicap');
    if (handicapInput && draft.handicap !== undefined) handicapInput.value = draft.handicap;

    for (let i = 0; i < 18; i++) {
      const input = document.getElementById('hole-' + (i + 1));
      if (input) {
        const v = draft.holes[i];
        input.value = (v !== undefined && v !== null && v !== '') ? String(v) : '';
      }
    }

    this.calculateScores();
    document.getElementById('scorecard-form')?.scrollIntoView({ behavior: 'smooth' });

    // Focus the hole field that had focus when the user clicked the link, or hole 1
    const holeNum = (draft.focusedHole >= 1 && draft.focusedHole <= 18) ? draft.focusedHole : 1;
    const toFocus = document.getElementById('hole-' + holeNum);
    const self = this;
    if (toFocus) {
      requestAnimationFrame(function() {
        toFocus.focus();
        toFocus.select();
        // Clear flag after any blur-triggered checkForExistingScore would have run
        setTimeout(function() { self._applyingDraft = false; }, 0);
      });
    } else {
      this._applyingDraft = false;
    }
  },

};
