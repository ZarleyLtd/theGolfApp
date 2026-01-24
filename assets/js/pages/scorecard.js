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

  init: async function() {
    const scorecardForm = document.getElementById('scorecard-form');
    if (!scorecardForm) {
      return;
    }

    // Load courses from Google Sheet first
    await this.loadCoursesFromSheet();

    // Try to set default course based on next outing
    await this.setDefaultCourseFromNextOuting();

    // Load player names from Config sheet (Key="Player") for Name combobox
    await this.loadPlayersFromConfig();

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

    // Focus Name field when page is first presented
    requestAnimationFrame(() => {
      const playerInput = document.getElementById('player-name');
      if (playerInput) playerInput.focus();
    });
  },

  /**
   * Load courses from Google Sheet, fallback to hardcoded data if sheet fails
   */
  loadCoursesFromSheet: async function() {
    try {
      const url = SheetsConfig.getSheetUrl('courses');
      if (!url) {
        console.warn('Courses sheet URL not configured, using hardcoded courses');
        return; // Keep existing hardcoded courses
      }
      
      console.log('Loading courses from sheet:', url);
      const loadedCourses = await CoursesLoader.load(url);
      
      if (loadedCourses && Object.keys(loadedCourses).length > 0) {
        // Replace hardcoded courses with loaded courses
        this.courses = loadedCourses;
        console.log(`Successfully loaded ${Object.keys(this.courses).length} courses from sheet`);
      } else {
        console.warn('No courses loaded from sheet, using hardcoded courses');
      }
    } catch (error) {
      console.warn('Failed to load courses from sheet, using hardcoded courses:', error);
      // Keep existing hardcoded courses as fallback
    }
  },

  /**
   * Load next outing index from Google Sheet and set default course
   */
  setDefaultCourseFromNextOuting: async function() {
    try {
      const url = SheetsConfig.getSheetUrl('nextOuting');
      if (!url) {
        console.warn('Next outing sheet URL not configured, using default course');
        return;
      }
      
      // Load CSV with headers - Column A = Key, Column B = Value
      const data = await CsvLoader.load(url, { header: true, skipEmptyLines: true, delimiter: ',' });
      
      if (!data || data.length === 0) {
        console.warn('No next outing index received, using default course');
        return;
      }
      
      // Find the row where Key column (Column A) is "NextOuting"
      const nextOutingRow = data.find(row => {
        const key = row['Key'] || row['key'] || row[Object.keys(row)[0]];
        return key && key.toString().trim().toLowerCase() === 'nextouting';
      });
      
      if (!nextOutingRow) {
        console.warn('No "NextOuting" row found in sheet, using default course');
        return;
      }
      
      // Get the value from Column B (Value column) - it's just a number
      const valueColumn = nextOutingRow['Value'] || nextOutingRow['value'] || nextOutingRow[Object.keys(nextOutingRow)[1]] || '';
      const indexValue = valueColumn ? valueColumn.toString().trim() : '';
      const outingIndex = parseInt(indexValue, 10);
      
      if (isNaN(outingIndex) || outingIndex < 1 || outingIndex > OutingsConfig.OUTINGS_2026.length) {
        console.warn(`Invalid outing index: ${outingIndex}, using default course`);
        return;
      }
      
      // Get the outing data
      const outing = OutingsConfig.OUTINGS_2026[outingIndex - 1];
      if (!outing || !outing.clubName) {
        console.warn('Outing data not found, using default course');
        return;
      }
      
      // Map club name to course key
      let courseKey = OutingsConfig.mapClubNameToCourseKey(outing.clubName);
      
      console.log(`Next outing: ${outing.clubName}, mapped to course key: ${courseKey || 'null'}`);
      
      // If mapping failed, try direct matching against available course keys
      if (!courseKey) {
        const stripped = OutingsConfig.stripClubNameSuffixes(outing.clubName);
        const lowerStripped = stripped.toLowerCase().replace(/\s+/g, '');
        
        // Try to find a course key that matches the stripped name
        const availableCourseKeys = Object.keys(this.courses);
        for (const key of availableCourseKeys) {
          const keyLower = key.toLowerCase().replace(/\s+/g, '');
          // Check if stripped name matches or contains the course key, or vice versa
          if (keyLower === lowerStripped || 
              keyLower.includes(lowerStripped) || 
              lowerStripped.includes(keyLower)) {
            courseKey = key;
            console.log(`Found direct match: "${outing.clubName}" -> "${courseKey}"`);
            break;
          }
        }
      }
      
      if (!courseKey) {
        console.warn(`No course mapping found for "${outing.clubName}", using default course. Available courses:`, Object.keys(this.courses).join(', '));
        return;
      }
      
      // Check if the course exists in the courses object
      if (!this.courses[courseKey]) {
        console.warn(`Course "${courseKey}" not found in courses list. Available courses:`, Object.keys(this.courses).join(', '));
        return;
      }
      
      // Set as default course
      this.currentCourse = courseKey;
      console.log(`Default course set to "${courseKey}" based on next outing: ${outing.clubName}`);
    } catch (error) {
      console.warn('Failed to load next outing for default course:', error);
      // Silently fail and use default course
    }
  },

  /**
   * Load player names from Config sheet (Key="Player" keyval pairs) and populate Name combobox datalist.
   * Supports multiple rows with Key=Player (each Value = one name) or a single row with comma-separated Value.
   */
  loadPlayersFromConfig: async function() {
    try {
      const url = SheetsConfig.getSheetUrl('config');
      if (!url) {
        console.warn('Config sheet URL not configured, player list will be empty');
        return;
      }
      const data = await CsvLoader.load(url, { header: true, skipEmptyLines: true, delimiter: ',' });
      if (!data || data.length === 0) return;

      const names = new Set();
      data.forEach(row => {
        const key = (row['Key'] || row['key'] || row[Object.keys(row)[0]] || '').toString().trim();
        if (key.toLowerCase() !== 'player') return;
        const val = (row['Value'] || row['value'] || row[Object.keys(row)[1]] || '').toString().trim();
        if (!val) return;
        if (val.includes(',')) {
          val.split(',').forEach(s => {
            const n = s.trim();
            if (n) names.add(n);
          });
        } else {
          names.add(val);
        }
      });

      const list = document.getElementById('player-datalist');
      if (!list) return;
      list.innerHTML = '';
      [...names].sort().forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        list.appendChild(opt);
      });
      if (names.size > 0) {
        console.log(`Loaded ${names.size} player(s) from Config sheet`);
      }
    } catch (e) {
      console.warn('Failed to load players from Config sheet:', e);
    }
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
    
    const courseKeys = Object.keys(this.courses).sort();
    
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

    // Update totals
    document.getElementById('out-score').textContent = OUTtotScore || '0';
    document.getElementById('out-points').textContent = OUTtotPts || '0';
    document.getElementById('out-par').textContent = OUTtotPar || '0';
    document.getElementById('in-score').textContent = INtotScore || '0';
    document.getElementById('in-points').textContent = INtotPts || '0';
    document.getElementById('in-par').textContent = INtotPar || '0';
    document.getElementById('total-score').textContent = totScore || '0';
    document.getElementById('total-points').textContent = totPoints || '0';
    document.getElementById('total-par').textContent = totPar || '0';
  },

  resetAllPoints: function() {
    for (let i = 1; i <= 18; i++) {
      const pointsEl = document.getElementById(`points-${i}`);
      if (pointsEl) pointsEl.textContent = '0';
    }
    
    document.getElementById('out-score').textContent = '0';
    document.getElementById('out-points').textContent = '0';
    document.getElementById('out-par').textContent = '0';
    document.getElementById('in-score').textContent = '0';
    document.getElementById('in-points').textContent = '0';
    document.getElementById('in-par').textContent = '0';
    document.getElementById('total-score').textContent = '0';
    document.getElementById('total-points').textContent = '0';
    document.getElementById('total-par').textContent = '0';
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

};
