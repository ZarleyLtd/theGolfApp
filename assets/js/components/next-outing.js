// Next Outing Component
// Loads the current "next outing" index from Google Sheet and renders the corresponding outing
// Uses index-based approach: Google Sheet contains a single number (1-10) that references the outing array

const NextOuting = {

  /**
   * Initialize and load next outing (from Outings/Courses API when society set, else from sheet)
   */
  init: async function() {
    const container = document.getElementById('next-outing-content');
    if (!container) {
      console.warn('Next outing container not found');
      return;
    }

    // When society is loaded from API, use Outings and Courses from backend
    if (typeof AppConfig !== 'undefined' && AppConfig.currentSociety && typeof ApiClient !== 'undefined') {
      try {
        const [outingsRes, coursesRes] = await Promise.all([
          ApiClient.get({ action: 'getOutings' }),
          ApiClient.get({ action: 'getCourses' })
        ]);
        const outings = (outingsRes && outingsRes.outings) || [];
        const courses = (coursesRes && coursesRes.courses) || [];
        const courseMap = {};
        courses.forEach(function(c) {
          courseMap[(c.courseName || '').toLowerCase()] = c;
        });
        // Next outing = first where (outing date/time + 5 hours) > now (so we don't switch away too early on the day)
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
        if (next) {
          var course = courseMap[(next.courseName || '').toLowerCase()] || {};
          this.renderFromApi(container, next, course);
          return;
        }
        container.innerHTML = '<p style="text-align: center; color: #666;">No upcoming outings scheduled.</p>';
      } catch (err) {
        console.error('Failed to load next outing from API:', err);
        container.innerHTML = '<p style="text-align: center; color: #666;">Unable to load next outing.</p>';
      }
      return;
    }

    try {
      const url = SheetsConfig.getSheetUrl('nextOuting');
      if (!url) {
        console.error('Invalid next outing sheet URL');
        this.renderFallback(container);
        return;
      }

      const data = await CsvLoader.load(url, { header: true, skipEmptyLines: true, delimiter: ',' });

      if (!data || data.length === 0) {
        this.renderFallback(container);
        return;
      }

      const nextOutingRow = data.find(row => {
        const key = row['Key'] || row['key'] || row[Object.keys(row)[0]];
        return key && key.toString().trim().toLowerCase() === 'nextouting';
      });

      if (!nextOutingRow) {
        this.renderFallback(container);
        return;
      }

      const rowKeys = Object.keys(nextOutingRow);
      const keyIndex = rowKeys.findIndex(k => (k.toLowerCase() === 'key'));
      let valueColumn = keyIndex >= 0 && keyIndex < rowKeys.length - 1
        ? nextOutingRow[rowKeys[keyIndex + 1]] || ''
        : nextOutingRow['Value'] || nextOutingRow['value'] || nextOutingRow[Object.keys(nextOutingRow)[1]] || '';
      const outingIndex = parseInt(String(valueColumn).trim(), 10);

      if (isNaN(outingIndex) || outingIndex < 1 || outingIndex > OutingsConfig.OUTINGS_2026.length) {
        this.renderFallback(container);
        return;
      }

      const outing = OutingsConfig.OUTINGS_2026[outingIndex - 1];
      this.render(container, outing);
    } catch (error) {
      console.error('Failed to load next outing:', error);
      this.renderFallback(container);
    }
  },

  /**
   * Parse outing date + time to a Date for comparison. Handles sheet dates like
   * "Mon Feb 23 2026 00:00:00 GMT+0000" and ISO "2026-02-23" so we get a valid Date.
   * @returns {Date|null}
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

  /**
   * Format time as "11:30 am"
   */
  formatTimeSimple: function(timeStr) {
    if (!timeStr) return '';
    var m = String(timeStr).trim().match(/(\d{1,2}):(\d{2})/);
    if (!m) return timeStr;
    var h = parseInt(m[1], 10);
    return (h % 12 || 12) + ':' + m[2] + ' ' + (h >= 12 ? 'pm' : 'am');
  },

  /**
   * Format date + time as "Tue Feb 17 2026 @ 11:30 am" (no timezone)
   */
  formatOutingDateTime: function(dateStr, timeStr) {
    if (!dateStr) return timeStr ? (' @ ' + this.formatTimeSimple(timeStr)).trim() : '';
    var raw = String(dateStr).trim();
    var gmtIdx = raw.search(/\s(00:00:00|GMT|\d{2}:\d{2}:\d{2})/);
    if (gmtIdx !== -1) raw = raw.substring(0, gmtIdx).trim();
    var dateOnly = raw.split('T')[0];
    if (dateOnly.indexOf('-') === -1) dateOnly = raw;
    var d = new Date(dateOnly + (timeStr ? 'T' + timeStr : ''));
    if (isNaN(d.getTime())) d = new Date(dateOnly);
    if (isNaN(d.getTime()) || d.getFullYear() < 2000 || d.getFullYear() > 2100) {
      return (dateOnly.indexOf('-') !== -1 ? dateOnly : raw) + (timeStr ? ' @ ' + this.formatTimeSimple(timeStr) : '');
    }
    var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var s = days[d.getDay()] + ' ' + months[d.getMonth()] + ' ' + d.getDate() + ' ' + d.getFullYear();
    if (timeStr) s += ' @ ' + this.formatTimeSimple(timeStr);
    return s;
  },

  /** Default image when course has none or file missing */
  defaultImage: 'assets/images/golfBanner.jpg',

  /**
   * Render next outing from API data (outing + course): image, course name, date/time, links
   */
  renderFromApi: function(container, outing, course) {
    var clubName = (course.clubName || outing.courseName || 'Course').trim();
    var courseName = this.escapeHtml(outing.courseName || clubName);
    var courseUrl = (course.courseURL || '').trim() || '#';
    var mapsUrl = (course.courseMaploc || '').trim() || '#';
    var dateTimeStr = this.formatOutingDateTime(outing.date, outing.time);
    var imgFile = (course.courseImage || '').trim();
    var imgSrc = imgFile ? ('assets/images/' + imgFile) : this.defaultImage;

    var html = '<div style="text-align: center; margin: 2em 0;">';
    html += '<div style="position: relative; display: inline-block; max-width: 100%;">';
    html += '<a href="' + this.escapeHtml(courseUrl !== '#' ? courseUrl : '#') + '" target="_blank" rel="noreferrer noopener" style="display: block;">';
    html += '<img src="' + this.escapeHtml(imgSrc) + '" alt="' + courseName + '" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: block;" onerror="this.onerror=null; this.src=\'' + this.escapeHtml(this.defaultImage) + '\';">';
    html += '</a>';
    if (mapsUrl !== '#') {
      html += '<a href="' + this.escapeHtml(mapsUrl) + '" target="_blank" rel="noreferrer noopener" style="position: absolute; top: 8px; right: 8px; width: 40px; height: 40px; background-color: rgba(255, 255, 255, 0.9); border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 4px; display: flex; align-items: center; justify-content: center; text-decoration: none; box-shadow: 0 2px 4px rgba(0,0,0,0.2);" title="View on map">📍</a>';
    }
    html += '</div>';
    html += '<p style="font-size: 1.2em; font-weight: 600; margin: 1em 0 0.5em;">' + courseName + '</p>';
    if (dateTimeStr) html += '<p style="color: #666; margin-bottom: 1em;">' + this.escapeHtml(dateTimeStr) + '</p>';
    html += '<p style="margin: 1em 0;">';
    if (courseUrl !== '#') html += '<a href="' + this.escapeHtml(courseUrl) + '" target="_blank" rel="noreferrer noopener" class="btn" style="margin-right: 0.5em;">Course info</a>';
    if (mapsUrl !== '#') html += '<a href="' + this.escapeHtml(mapsUrl) + '" target="_blank" rel="noreferrer noopener" class="btn btn-secondary">Map</a>';
    html += '</p></div>';
    container.innerHTML = html;
  },
  
  /**
   * Render the next outing HTML
   * @param {HTMLElement} container - Container element to render into
   * @param {Object} outing - Outing data object
   */
  render: function(container, outing) {
    const html = `
      <div style="text-align: center; margin: 2em 0;">
        <div style="position: relative; display: inline-block; max-width: 100%;">
          <a href="${this.escapeHtml(outing.clubUrl)}" target="_blank" rel="noreferrer noopener" style="display: block;">
            <img
              src="${this.escapeHtml(outing.imagePath)}"
              alt="${this.escapeHtml(outing.clubName)}"
              style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: block;"
            />
          </a>
          <a href="${this.escapeHtml(outing.mapsUrl)}" target="_blank" rel="noreferrer noopener" style="position: absolute; top: 8px; right: 8px; width: 40px; height: 40px; background-color: rgba(255, 255, 255, 0.9); border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 4px; display: flex; align-items: center; justify-content: center; text-decoration: none; box-shadow: 0 2px 4px rgba(0,0,0,0.2);" title="View on Google Maps">
            <span style="font-size: 20px;">📍</span>
          </a>
        </div>
      </div>
    `;
    
    container.innerHTML = html;
  },
  
  /**
   * Render fallback content if loading fails
   * @param {HTMLElement} container - Container element to render into
   */
  renderFallback: function(container) {
    // Default to first outing if sheet loading fails
    const defaultOuting = OutingsConfig.OUTINGS_2026[0];
    this.render(container, defaultOuting);
    console.warn('Using default (first) outing as fallback');
  },
  
  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml: function(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
