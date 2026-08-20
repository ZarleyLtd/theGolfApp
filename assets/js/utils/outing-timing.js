// Outing timing helpers — shared "default / next outing" selection.

const OutingTiming = {
  /**
   * Parse outing date + time to a Date for comparison. Handles sheet dates like
   * "Mon Feb 23 2026 00:00:00 GMT+0000" and ISO "2026-02-23".
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
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
   * Pick the default outing for home / scorecard.
   * Walk chronologically; switch from outing i to i+1 when `now` is closer to the
   * next outing start than to (outing i start + 6 hours). If there is no next
   * outing, the last outing remains the default.
   *
   * @param {Array} outings - Society outings in date/time order
   * @param {number} [nowMs] - Epoch ms (defaults to Date.now())
   * @returns {object|null} Selected outing, or null if none usable
   */
  selectDefaultOuting: function(outings, nowMs) {
    var list = outings || [];
    if (list.length === 0) return null;
    var now = nowMs != null ? nowMs : Date.now();
    var sixHoursMs = 6 * 60 * 60 * 1000;
    var timed = [];
    for (var i = 0; i < list.length; i++) {
      var start = this.parseOutingDateTime(list[i].date, list[i].time);
      if (!start) continue;
      timed.push({ outing: list[i], startMs: start.getTime() });
    }
    if (timed.length === 0) return null;

    var selected = timed[0].outing;
    for (var j = 0; j < timed.length - 1; j++) {
      var latestPlus6 = timed[j].startMs + sixHoursMs;
      var nextStart = timed[j + 1].startMs;
      if (Math.abs(now - nextStart) < Math.abs(now - latestPlus6)) {
        selected = timed[j + 1].outing;
      } else {
        break;
      }
    }
    return selected;
  }
};
