/**
 * Player-facing handicap adjustment history.
 */
(function () {
  'use strict';

  var HR = window.HandicapRules;

  function escapeHtml(text) {
    if (window.Formatters && window.Formatters.escapeHtml) {
      return window.Formatters.escapeHtml(text);
    }
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function sourceLabel(source) {
    if (source === 'automatic') return 'Automatic';
    if (source === 'historical') return 'Historical';
    if (source === 'manual') return 'Manual';
    return source || '';
  }

  function formatAmount(amount) {
    if (HR && HR.formatAdjustmentAmount) return HR.formatAdjustmentAmount(amount);
    var n = parseFloat(amount);
    if (!Number.isFinite(n)) return '0';
    return n > 0 ? '+' + n : String(n);
  }

  function formatIndex(indexAfter) {
    if (HR && HR.formatDecimalTrimmed) return HR.formatDecimalTrimmed(indexAfter);
    return String(indexAfter);
  }

  function formatHistoryYear(a) {
    var eff = a && a.effectiveDate ? String(a.effectiveDate).trim() : '';
    if (eff) {
      var iso = eff.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.slice(0, 4);
      var yearMatch = eff.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) return yearMatch[0];
    }
    if (a && a.seasonYear != null) return String(a.seasonYear);
    return '—';
  }

  function formatPosition(position) {
    if (position == null || position === '') return '—';
    if (window.Formatters && Formatters.formatOrdinal) {
      var ord = Formatters.formatOrdinal(position);
      if (ord) return ord;
    }
    return String(position);
  }

  function formatOutingCell(a) {
    var outing = (a.outingLabel || a.courseName || '').trim();
    if (outing) return outing;
    var reason = a && a.reason ? String(a.reason).trim() : '';
    return reason || '—';
  }

  function renderTimeline(adjustments) {
    var container = document.getElementById('hc-history-timeline');
    if (!container) return;
    if (HR && HR.sortHandicapHistoryNewestFirst) {
      adjustments = HR.sortHandicapHistoryNewestFirst(adjustments || []);
    }
    if (!adjustments || !adjustments.length) {
      container.innerHTML = '<p class="hc-empty">No handicap adjustments recorded for this player.</p>';
      return;
    }
    var html = '<table class="hc-timeline-table"><thead><tr>';
    html += '<th>Year</th><th>Outing</th><th class="hc-col-pos">Pos</th><th>Adj</th><th>Index after</th><th>Playing H/C</th><th>Source</th>';
    html += '</tr></thead><tbody>';
    adjustments.forEach(function (a) {
      var playing = HR ? HR.playingHandicapFromIndex(a.indexAfter) : Math.round(a.indexAfter);
      html += '<tr>';
      html += '<td>' + escapeHtml(formatHistoryYear(a)) + '</td>';
      html += '<td>' + escapeHtml(formatOutingCell(a)) + '</td>';
      html += '<td class="hc-col-pos">' + escapeHtml(formatPosition(a.position)) + '</td>';
      html += '<td>' + formatAmount(a.amount) + '</td>';
      html += '<td>' + escapeHtml(formatIndex(a.indexAfter)) + '</td>';
      html += '<td>' + playing + '</td>';
      html += '<td>' + escapeHtml(sourceLabel(a.source)) + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  async function loadHistoryForPlayer(playerId) {
    var container = document.getElementById('hc-history-timeline');
    if (container) container.innerHTML = '<p class="loading">Loading…</p>';
    try {
      var result = await ApiClient.get({ action: 'getHandicapHistory', playerId: playerId });
      renderTimeline(result.success ? result.adjustments || [] : []);
    } catch (e) {
      if (container) {
        container.innerHTML = '<p class="hc-empty">Unable to load handicap history.</p>';
      }
    }
  }

  async function init() {
    var req = await requireSociety({
      errorElId: 'society-error',
      mainElId: 'main-content',
      heroSocietyId: 'hero-society-name',
      defaultPageTitle: 'Handicap History',
      pageTitleId: 'page-title',
      pageNameForUrl: 'handicap-history.html',
    });
    if (!req.ok) return;

    var select = document.getElementById('hc-player-select');
    if (!select) return;

    try {
      var playersRes = await ApiClient.get({ action: 'getPlayers' });
      var players = playersRes.success ? playersRes.players || [] : [];
      players.sort(function (a, b) {
        return (a.playerName || '').localeCompare(b.playerName || '', undefined, { sensitivity: 'base' });
      });
      select.innerHTML = '<option value="">Select a player…</option>';
      players.forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p.playerId;
        opt.textContent = p.playerName || '';
        select.appendChild(opt);
      });
      select.addEventListener('change', function () {
        if (select.value) loadHistoryForPlayer(select.value);
        else renderTimeline([]);
      });
    } catch (e) {
      select.innerHTML = '<option value="">Error loading players</option>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
