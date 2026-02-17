// Scorecard Page - Golf Scorecard Calculator
// Calculates Stableford points based on handicap and stroke inputs

// Scorecard Page - Golf Scorecard Calculator
// Calculates Stableford points based on handicap and stroke inputs

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

  /** When set, only these course names (from Outings sheet) are shown in the Course dropdown. Null = show all. */
  societyOutingCourseNames: null,

  /** Full outings array (from getScorecardData) for default course logic */
  societyOutings: [],

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
      const result = await ApiClient.get({ action: 'getScorecardData' });
      const outings = (result && result.outings) || [];
      const apiCourses = (result && result.courses) || [];
      const players = (result && result.players) || [];

      this.societyOutings = outings;

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
        this.currentCourse = courseKeys[j];
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
          // Clear all inputs and recalculate
          this.clearInputs();
        }
      });
      
      // Check for existing score when course loses focus
      courseSelect.addEventListener('blur', () => {
        this.checkForExistingScore();
      });
    }

    // Handle input field changes (auto-tab and calculation)
    for (let i = 1; i <= 18; i++) {
      const input = document.getElementById(`hole-${i}`);
      if (input) {
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

    // Player name input - tab to handicap
    const playerInput = document.getElementById('player-name');
    if (playerInput) {
      playerInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
          document.getElementById('handicap')?.focus();
        }
      });
      
      // Check for existing score when name loses focus
      playerInput.addEventListener('blur', () => {
        this.checkForExistingScore();
      });
    }

    // Save score button
    const saveBtn = document.getElementById('save-score-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveScore();
      });
    }

    // Transfer to side-scroll view: save draft and navigate (only on standard page)
    const sidescrollLink = document.querySelector('.scorecard-view-toggle[href="scorecard-sidescroll.html"]');
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
        const draft = {
          course: courseSelect ? courseSelect.value || '' : '',
          playerName: playerInput ? (playerInput.value || '').trim() : '',
          handicap: handicapInput ? (handicapInput.value || '').trim() : '',
          holes: holes
        };
        try {
          sessionStorage.setItem('bgs_scorecard_draft', JSON.stringify(draft));
        } catch (err) {}
        window.location.href = 'scorecard-sidescroll.html';
      });
    }
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

  // Check for existing score when course or name changes
  checkForExistingScore: function() {
    const playerName = document.getElementById('player-name')?.value.trim();
    const courseSelect = document.getElementById('course-select');
    // Use the actual select value, not this.currentCourse which might be out of sync
    const course = courseSelect ? courseSelect.value : this.currentCourse;
    
    // Only check if both course and name are provided
    if (!playerName || !course) {
      return;
    }
    
    // Show loading message
    this.showLoadingMessage('Checking for existing score...');
    
    // Get current date
    const date = new Date().toISOString().split('T')[0];
    
    // Check for existing score
    ApiClient.post('checkExistingScore', {
      playerName: playerName,
      course: course,
      date: date
    })
      .then(result => {
        this.hideLoadingMessage();
        if (result.exists && result.score) {
          // Load the existing score into the form
          this.loadScoreIntoForm(result.score);
        }
      })
      .catch(error => {
        this.hideLoadingMessage();
        // Silently fail - API might not be configured
        if (!error.message.includes('API URL not configured')) {
          console.error('Error checking for existing score:', error);
        }
      });
  },

  // Save/Load functionality
  saveScore: function() {
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
      this.showMessage('Please enter at least one hole score', false);
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
    
    // Get current date
    const date = new Date().toISOString().split('T')[0];
    
    const scoreData = {
      playerName: playerName,
      course: course,
      date: date,
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
    const saveBtn = document.getElementById('save-score-btn');
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

    try {
      sessionStorage.removeItem('bgs_scorecard_draft');
    } catch (err) {
      // continue to apply draft
    }

    let draft;
    try {
      draft = JSON.parse(raw);
    } catch (err) {
      return;
    }
    if (!draft || !draft.holes || draft.holes.length !== 18) return;

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

    // Focus first blank field so user can continue typing
    const playerEl = document.getElementById('player-name');
    const handicapEl = document.getElementById('handicap');
    const toFocus =
      (playerEl && (!draft.playerName || String(draft.playerName).trim() === '')) ? playerEl :
      (handicapEl && (!draft.handicap || String(draft.handicap).trim() === '')) ? handicapEl :
      (function() {
        for (let i = 0; i < 18; i++) {
          const v = draft.holes[i];
          if (v === undefined || v === null || String(v).trim() === '') {
            const input = document.getElementById('hole-' + (i + 1));
            if (input) return input;
          }
        }
        return null;
      })();
    if (toFocus) {
      requestAnimationFrame(function() {
        toFocus.focus();
      });
    }
  },

};
