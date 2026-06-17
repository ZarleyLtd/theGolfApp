/**
 * Handicap rules, history, and apply-outing for society-admin.html
 */
(function () {
  'use strict';

  var HR = window.HandicapRules;
  var LS = window.LeaderboardShared;
  if (!HR) {
    console.warn('HandicapRules not loaded');
    return;
  }

  var handicapRulesConfig = null;
  var handicapRulesEnabled = false;
  var pendingApplyOuting = null;
  var pendingApplyRows = [];
  var pendingApplyAlreadyApplied = false;

  function getApi() {
    if (typeof ApiClient !== 'undefined') return ApiClient;
    if (typeof window !== 'undefined' && window.ApiClient) return window.ApiClient;
    return null;
  }

  function escapeHtml(text) {
    if (window.Formatters && window.Formatters.escapeHtml) {
      return window.Formatters.escapeHtml(text);
    }
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function showAlert(type, message) {
    if (typeof window.showAlert === 'function') window.showAlert(type, message);
  }

  function formatAdjInputValue(amount) {
    if (HR && HR.formatAdjustmentAmount) return HR.formatAdjustmentAmount(amount);
    var n = parseFloat(amount);
    if (!Number.isFinite(n)) return '0';
    return n > 0 ? '+' + n : String(n);
  }

  function parseAdjInputValue(raw) {
    var s = String(raw == null ? '' : raw).trim().replace(/^\+/, '');
    if (s === '' || s === '-') return 0;
    var n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }

  function attachAdjInputFormatters(root) {
    var scope = root || document;
    scope.querySelectorAll('.hc-band-amount, #hcOutsideTop10, .apply-hc-amount').forEach(function (el) {
      if (el.dataset.adjFormatBound) return;
      el.dataset.adjFormatBound = '1';
      el.addEventListener('blur', function () {
        el.value = formatAdjInputValue(parseAdjInputValue(el.value));
      });
    });
  }

  function positionGroupLabel(key) {
    if (key === 'winner') return 'Winner';
    if (key === 'runnerUp') return 'Runner-up';
    if (key === 'thirdPlace') return 'Third place';
    return key;
  }

  function renderBandRow(groupKey, bandIndex, band) {
    var b = band || {};
    return (
      '<div class="hc-band-row" data-group="' +
      groupKey +
      '" data-band="' +
      bandIndex +
      '">' +
      '<span class="hc-band-index-range">' +
      '<span class="hc-band-text">Index &gt;</span>' +
      '<input type="number" step="1" class="hc-band-min hc-input-index" value="' +
      (b.minIndex != null ? b.minIndex : '') +
      '" placeholder="any" aria-label="Minimum index">' +
      '<span class="hc-band-text">and &le;</span>' +
      '<input type="number" step="1" class="hc-band-max hc-input-index" value="' +
      (b.maxIndex != null ? b.maxIndex : '') +
      '" placeholder="any" aria-label="Maximum index">' +
      '</span>' +
      '<span class="hc-band-adj-wrap">' +
      '<span class="hc-band-text">Adj</span>' +
      '<input type="text" inputmode="decimal" class="hc-band-amount hc-input-adj" value="' +
      formatAdjInputValue(b.amount != null ? b.amount : 0) +
      '" aria-label="Adjustment">' +
      '</span>' +
      '</div>'
    );
  }

  function renderPositionGroupEditor(key, bands) {
    var list = Array.isArray(bands) ? bands : HR.defaultPositionBands([0, 0, 0]);
    var html = '<div class="hc-group" data-group-key="' + key + '">';
    html += '<h4 class="hc-group-title">' + escapeHtml(positionGroupLabel(key)) + '</h4>';
    for (var i = 0; i < list.length; i++) {
      html += renderBandRow(key, i, list[i]);
    }
    html += '</div>';
    return html;
  }

  function readBandFromRow(row) {
    var minEl = row.querySelector('.hc-band-min');
    var maxEl = row.querySelector('.hc-band-max');
    var amtEl = row.querySelector('.hc-band-amount');
    var minRaw = minEl ? minEl.value.trim() : '';
    var maxRaw = maxEl ? maxEl.value.trim() : '';
    return {
      minIndex: minRaw === '' ? null : parseFloat(minRaw),
      maxIndex: maxRaw === '' ? null : parseFloat(maxRaw),
      amount: amtEl ? parseAdjInputValue(amtEl.value) : 0,
    };
  }

  function readRulesConfigFromDom() {
    var groups = {};
    ['winner', 'runnerUp', 'thirdPlace'].forEach(function (key) {
      var container = document.querySelector('.hc-group[data-group-key="' + key + '"]');
      if (!container) return;
      groups[key] = [];
      container.querySelectorAll('.hc-band-row').forEach(function (row) {
        groups[key].push(readBandFromRow(row));
      });
    });
    var outsideEl = document.getElementById('hcOutsideTop10');
    var maxIndexEl = document.getElementById('hcMaxIndex');
    var hsDefaults = HR.mergeHighScoreRules ? HR.mergeHighScoreRules({}) : HR.defaultHighScoreRules();
    var amt4aEl = document.getElementById('hcRule4aAmount');
    var amt4bEl = document.getElementById('hcRule4bAmount');
    return {
      enabled: true,
      outsideTop10: outsideEl ? parseAdjInputValue(outsideEl.value) : 1,
      maxIndex: maxIndexEl ? parseInt(maxIndexEl.value, 10) || 40 : 40,
      positionGroups: groups,
      highScoreRules: {
        rule4a: Object.assign({}, hsDefaults.rule4a, {
          amount: amt4aEl ? parseAdjInputValue(amt4aEl.value) : hsDefaults.rule4a.amount,
        }),
        rule4b: Object.assign({}, hsDefaults.rule4b, {
          amount: amt4bEl ? parseAdjInputValue(amt4bEl.value) : hsDefaults.rule4b.amount,
        }),
      },
    };
  }

  function renderHighScoreRulesEditor(hs) {
    var rules = HR.mergeHighScoreRules ? HR.mergeHighScoreRules({ highScoreRules: hs }) : hs;
    var a = rules.rule4a;
    var b = rules.rule4b;
    return (
      '<div class="hc-group hc-group--high-score">' +
      '<h4 class="hc-group-title">Rule 4</h4>' +
      '<div class="hc-rule4-grid">' +
      '<span class="hc-band-text hc-rule4-desc">Rule 4a: 5 clear of the field</span>' +
      '<span class="hc-band-text hc-rule4-adj-label">Adj</span>' +
      '<input type="text" inputmode="decimal" class="hc-input-adj hc-rule4-adj-input" id="hcRule4aAmount" value="' +
      formatAdjInputValue(a.amount != null ? a.amount : -1) +
      '" aria-label="Rule 4a adjustment">' +
      '<span class="hc-band-text hc-rule4-desc">Rule 4b: 40+ scored</span>' +
      '<span class="hc-band-text hc-rule4-adj-label">Adj</span>' +
      '<input type="text" inputmode="decimal" class="hc-input-adj hc-rule4-adj-input" id="hcRule4bAmount" value="' +
      formatAdjInputValue(b.amount != null ? b.amount : -0.5) +
      '" aria-label="Rule 4b adjustment">' +
      '</div></div>'
    );
  }

  function renderHandicapRulesEditor(config) {
    var cfg = config || HR.defaultHandicapRuleConfig();
    var groups = cfg.positionGroups || {};
    var container = document.getElementById('handicapRulesEditor');
    if (!container) return;
    var html =
      '<div class="hc-group hc-group--limits">' +
      '<span class="hc-band-adj-wrap">' +
      '<span class="hc-band-text">Max Index</span>' +
      '<input type="number" step="1" min="0" class="hc-input-index" id="hcMaxIndex" value="' +
      (cfg.maxIndex != null ? cfg.maxIndex : 40) +
      '">' +
      '</span></div>';
    html += renderPositionGroupEditor('winner', groups.winner);
    html += renderPositionGroupEditor('runnerUp', groups.runnerUp);
    html += renderPositionGroupEditor('thirdPlace', groups.thirdPlace);
    html +=
      '<div class="hc-group hc-group--outside">' +
      '<h4 class="hc-group-title">Outside top 10</h4>' +
      '<label class="hc-band-label">Adjustment <input type="text" inputmode="decimal" class="hc-input-adj" id="hcOutsideTop10" value="' +
      formatAdjInputValue(cfg.outsideTop10 != null ? cfg.outsideTop10 : 1) +
      '"></label></div>';
    html += renderHighScoreRulesEditor(cfg.highScoreRules);
    container.innerHTML = html;
    attachAdjInputFormatters(container);
  }

  async function loadHandicapRules() {
    try {
      var result = await getApi().get({ action: 'getHandicapRules' });
      if (result.success) {
        handicapRulesEnabled = !!result.enabled;
        handicapRulesConfig = result.config || HR.defaultHandicapRuleConfig();
        var toggle = document.getElementById('hcRulesEnabled');
        if (toggle) toggle.checked = handicapRulesEnabled;
        renderHandicapRulesEditor(handicapRulesConfig);
        if (typeof refreshOutingHandicapButtons === 'function') {
          refreshOutingHandicapButtons();
        }
      }
    } catch (e) {
      console.error('loadHandicapRules', e);
    }
  }

  async function persistHandicapRules() {
    var enabledEl = document.getElementById('hcRulesEnabled');
    var config = readRulesConfigFromDom();
    var result = await getApi().post('saveHandicapRules', {
      enabled: enabledEl ? enabledEl.checked : false,
      config: config,
    });
    if (result.success) {
      handicapRulesConfig = config;
      handicapRulesEnabled = enabledEl ? enabledEl.checked : false;
    }
    return result;
  }

  function formatHistoryWhen(a) {
    if (HR && HR.isBulkDiscountRow && HR.isBulkDiscountRow(a)) {
      var bulkKey = HR.historySortKey ? HR.historySortKey(a) : '';
      if (bulkKey && bulkKey.length === 10) return bulkKey;
    }
    var eff = a.effectiveDate ? String(a.effectiveDate).trim() : '';
    if (eff) {
      var iso = eff.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
      return eff;
    }
    if (a.seasonYear != null) return String(a.seasonYear);
    return '—';
  }

  function formatHistoryBriefText(a) {
    if (!a) return 'No details recorded';
    var lines = [];
    var eff = a.effectiveDate ? String(a.effectiveDate).trim() : '';
    if (eff) lines.push(eff);
    else if (a.seasonYear != null) lines.push(String(a.seasonYear));
    lines.push((a.reason || '').trim() || 'No reason recorded');
    return lines.join('\n');
  }

  function formatHistoryLeft(a) {
    var outing = (a.outingLabel || a.courseName || '').trim();
    var detail = outing || (a.reason || '').trim() || '—';
    return formatHistoryWhen(a) + ' · ' + detail;
  }

  function formatHistoryAmount(a) {
    return HR && HR.formatAdjustmentAmount ? HR.formatAdjustmentAmount(a.amount) : String(a.amount);
  }

  function formatHistoryIndexAfter(a) {
    var formatted =
      HR && HR.formatDecimalTrimmed ? HR.formatDecimalTrimmed(a.indexAfter) : String(a.indexAfter);
    return '→ ' + formatted;
  }

  function sortHistoryNewestFirst(rows) {
    return HR && HR.sortHandicapHistoryNewestFirst
      ? HR.sortHandicapHistoryNewestFirst(rows)
      : rows.slice();
  }

  function attachHistoryRowClicks(listEl, rows) {
    if (!listEl) return;
    listEl.querySelectorAll('.hc-history-item').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        var idx = parseInt(el.getAttribute('data-hc-idx'), 10);
        var row = rows[idx];
        var text = formatHistoryBriefText(row);
        if (window.BriefMessage && typeof window.BriefMessage.show === 'function') {
          window.BriefMessage.show(text, el, { durationMs: 4500 });
        } else if (typeof window.showAlert === 'function') {
          window.showAlert('success', text);
        }
        ev.preventDefault();
      });
    });
  }

  function resolvePlayerId(player) {
    if (!player) return '';
    var id = player.playerId || player.player_id || '';
    if (id) return String(id).trim();
    var name = (player.playerName || '').trim();
    if (!name || !window.players) return '';
    var match = window.players.find(function (p) {
      return (p.playerName || '').trim().toLowerCase() === name.toLowerCase();
    });
    return match && match.playerId ? String(match.playerId).trim() : '';
  }

  async function loadPlayerHandicapHistory(playerId, playerName) {
    var listEl = document.getElementById('playerHandicapHistory');
    if (!listEl) return;
    if (!playerId && !playerName) {
      listEl.innerHTML = '<div class="hc-history-empty">No history</div>';
      return;
    }
    listEl.innerHTML = '<div class="loading">Loading history…</div>';
    try {
      var api = getApi();
      if (!api || typeof api.get !== 'function') {
        throw new Error('ApiClient is not loaded');
      }
      var params = { action: 'getHandicapHistory' };
      if (playerId) params.playerId = playerId;
      if (playerName) params.playerName = playerName;
      var result = await api.get(params);
      var rows = sortHistoryNewestFirst(result.success && result.adjustments ? result.adjustments : []);
      if (!rows.length) {
        var hint = result.playerId
          ? ''
          : ' (player id could not be resolved — save the player record first)';
        listEl.innerHTML =
          '<div class="hc-history-empty">No adjustments recorded' + hint + '</div>';
        return;
      }
      var html =
        '<div class="hc-history-head">' +
        '<span class="hc-history-left">When · Outing</span>' +
        '<span class="hc-history-col hc-history-col--amt">Adj</span>' +
        '<span class="hc-history-col hc-history-col--idx">Index</span>' +
        '</div>' +
        '<ul class="hc-history-list">';
      rows.forEach(function (a, i) {
        html +=
          '<li class="hc-history-item hc-history-item--' +
          escapeHtml(a.source || 'manual') +
          '" data-hc-idx="' +
          i +
          '" title="Click for reason">' +
          '<span class="hc-history-left">' +
          escapeHtml(formatHistoryLeft(a)) +
          '</span>' +
          '<span class="hc-history-col hc-history-col--amt">' +
          escapeHtml(formatHistoryAmount(a)) +
          '</span>' +
          '<span class="hc-history-col hc-history-col--idx">' +
          escapeHtml(formatHistoryIndexAfter(a)) +
          '</span></li>';
      });
      html += '</ul>';
      listEl.innerHTML = html;
      attachHistoryRowClicks(listEl, rows);
    } catch (e) {
      console.error('loadPlayerHandicapHistory', e);
      listEl.innerHTML =
        '<div class="hc-history-empty">Error loading history: ' +
        escapeHtml(e.message || 'Unknown error') +
        '</div>';
    }
  }

  function syncPlayerIndexFromStepper() {
    /* Index is controlled by stepper in society-admin.html */
  }

  function initPlayerHandicapFields(player) {
    if (typeof window.setPlayerHandicapIndex === 'function') {
      var idx =
        player && player.handicapIndex != null
          ? player.handicapIndex
          : player
            ? player.handicap
            : 0;
      window.setPlayerHandicapIndex(idx);
    }
    var adjEl = document.getElementById('playerHandicapAdjStep');
    if (adjEl && !adjEl.value) adjEl.value = '0.5';
    if (player) {
      var playerId = resolvePlayerId(player);
      var playerName = (player.playerName || '').trim();
      loadPlayerHandicapHistory(playerId, playerName);
    } else {
      var listEl = document.getElementById('playerHandicapHistory');
      if (listEl) {
        listEl.innerHTML =
          '<div class="hc-history-empty">Save player first to view history</div>';
      }
    }
  }

  function findPlayerForScore(sc, players) {
    if (!sc || !players || !players.length) return null;
    var pid = sc.playerId != null ? String(sc.playerId).trim() : '';
    if (pid) {
      for (var i = 0; i < players.length; i++) {
        if (players[i] && String(players[i].playerId || '').trim() === pid) return players[i];
      }
    }
    var name = (sc.playerName || '').trim().toLowerCase();
    if (name) {
      for (var j = 0; j < players.length; j++) {
        if (players[j] && (players[j].playerName || '').trim().toLowerCase() === name) {
          return players[j];
        }
      }
    }
    return null;
  }

  function buildOverallRankings(scores, players) {
    if (!LS || !scores || !scores.length) return [];
    var memberScores = scores.filter(function (sc) {
      var p = findPlayerForScore(sc, players);
      return p && isSocietyMember(p);
    });
    if (!memberScores.length) return [];
    var ranked = LS.rankAllWithCountback(
      memberScores,
      LS.compareCountbackOverall,
      LS.getCountbackLabelOverall
    );
    var out = [];
    ranked.forEach(function (group) {
      var pos = group.position;
      (group.scores || []).forEach(function (sc) {
        out.push({
          playerId: sc.playerId,
          playerName: sc.playerName,
          position: pos,
          totalPoints: sc.totalPoints,
        });
      });
    });
    return out;
  }

  function isSocietyMember(player) {
    return player && player.visitor !== true;
  }

  function buildAdjustmentReason(outing, position, positionAmount, highScore) {
    var parts = [];
    if (positionAmount !== 0) {
      parts.push('Pos ' + position + ': ' + HR.formatAdjustmentAmount(positionAmount));
    }
    if (highScore && highScore.amount !== 0) {
      var label = highScore.rule === '4a' ? 'Rule 4a' : 'Rule 4b';
      parts.push(label + ': ' + HR.formatAdjustmentAmount(highScore.amount));
    }
    return parts.join(', ') + ' at ' + (outing.courseName || 'outing');
  }

  function buildProposedAdjustments(outing, scores, players) {
    var cfg = handicapRulesConfig || HR.defaultHandicapRuleConfig();
    if (!handicapRulesEnabled) return [];
    var ranked = buildOverallRankings(scores, players);
    var memberCount = ranked.length;
    var playerMap = {};
    (players || []).forEach(function (p) {
      playerMap[p.playerId] = p;
    });

    var rows = [];
    var maxIndex = cfg.maxIndex != null ? cfg.maxIndex : 40;
    ranked.forEach(function (r) {
      var p = playerMap[r.playerId] || {};
      if (!isSocietyMember(p)) return;
      var idx = p.handicapIndex != null ? p.handicapIndex : p.handicap || 0;
      var positionAmount = HR.adjustmentForPosition(cfg, r.position, idx);
      var highScore = HR.highScoreAdjustmentForMember
        ? HR.highScoreAdjustmentForMember(cfg, ranked, memberCount, r)
        : { amount: 0, rule: null };
      var totalAmount = HR.addHandicapValues(positionAmount, highScore.amount);
      if (totalAmount === 0) return;
      var capped = HR.proposedAdjustmentAfter
        ? HR.proposedAdjustmentAfter(idx, totalAmount, maxIndex)
        : {
            indexAfter: HR.addHandicapValues(idx, totalAmount),
            amount: totalAmount,
          };
      if (!capped.amount) return;
      rows.push({
        playerId: r.playerId,
        playerName: r.playerName || p.playerName || r.playerId,
        position: r.position,
        indexBefore: idx,
        amount: capped.amount,
        indexAfter: capped.indexAfter,
        reason: buildAdjustmentReason(outing, r.position, positionAmount, highScore),
      });
    });

    return rows.sort(function (a, b) {
      return (a.playerName || '').localeCompare(b.playerName || '');
    });
  }

  function formatReviewIndex(val) {
    return HR && HR.formatDecimalTrimmed ? HR.formatDecimalTrimmed(val) : String(val);
  }

  function renderReviewTable(rows) {
    var tbody = document.getElementById('applyHandicapTbody');
    if (!tbody) return;
    if (!rows || !rows.length) {
      tbody.innerHTML = '<tr><td colspan="4">No adjustments for this outing.</td></tr>';
      return;
    }
    var html = '';
    rows.forEach(function (row) {
      html +=
        '<tr>' +
        '<td>' +
        escapeHtml(row.playerName) +
        '</td>' +
        '<td class="hc-review-col-pos">' +
        (row.position != null ? row.position : '—') +
        '</td>' +
        '<td class="hc-review-col-adj hc-review-amt">' +
        escapeHtml(formatAdjInputValue(row.amount)) +
        '</td>' +
        '<td class="hc-review-idx">→ ' +
        escapeHtml(formatReviewIndex(row.indexAfter)) +
        '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
  }

  function setReviewModalActionsVisible(visible) {
    var actionsEl = document.getElementById('applyHandicapActions');
    if (actionsEl) actionsEl.style.display = visible ? '' : 'none';
  }

  function setReviewModalHint(applied) {
    var hint = document.getElementById('applyHandicapModalHint');
    if (!hint) return;
    hint.textContent = applied
      ? 'These handicap adjustments have already been applied for this outing.'
      : 'Proposed changes from 18-hole Stableford positions and society handicap rules.';
  }

  async function refreshOutingHandicapButtons() {
    var wraps = document.querySelectorAll('[data-hc-review-wrap]');
    if (!handicapRulesEnabled) {
      wraps.forEach(function (el) {
        el.style.display = 'none';
      });
      return;
    }
    var societyOutings = window.outings || [];
    if (!societyOutings.length) {
      wraps.forEach(function (el) {
        el.style.display = 'none';
      });
      return;
    }
    var appliedSet = new Set();
    try {
      var appliedRes = await getApi().get({ action: 'getHandicapAppliedOutingIds' });
      if (appliedRes.success && appliedRes.outingIds) {
        appliedRes.outingIds.forEach(function (id) {
          appliedSet.add(String(id));
        });
      }
    } catch (e) {
      console.error('refreshOutingHandicapButtons', e);
    }
    await Promise.all(
      societyOutings.map(async function (outing) {
        var outingId = outing && outing.outingId ? String(outing.outingId) : '';
        var wrap = document.querySelector('[data-hc-review-wrap="' + outingId + '"]');
        if (!wrap || !outingId) return;
        if (appliedSet.has(outingId)) {
          wrap.style.display = '';
          return;
        }
        try {
          var scoresRes = await getApi().get({
            action: 'loadScores',
            outingId: outingId,
            limit: 5000,
          });
          var proposed = buildProposedAdjustments(
            outing,
            scoresRes.success ? scoresRes.scores || [] : [],
            window.players || []
          );
          wrap.style.display = proposed.length ? '' : 'none';
        } catch (err) {
          wrap.style.display = 'none';
        }
      })
    );
  }

  async function openReviewHandicapModal(outingId) {
    var outing = (window.outings || []).find(function (o) {
      return o.outingId === outingId;
    });
    if (!outing) return;
    if (!handicapRulesEnabled) {
      showAlert('error', 'Handicap rules are disabled. Enable them on the Profile tab.');
      return;
    }
    pendingApplyOuting = outing;
    pendingApplyAlreadyApplied = false;
    var modal = document.getElementById('applyHandicapModal');
    var tbody = document.getElementById('applyHandicapTbody');
    var title = document.getElementById('applyHandicapModalTitle');
    if (title) {
      title.textContent = 'Review handicap adjustments — ' + (outing.courseName || '');
    }
    setReviewModalActionsVisible(true);
    setReviewModalHint(false);
    if (tbody) tbody.innerHTML = '<tr><td colspan="4">Loading…</td></tr>';
    if (modal) modal.style.display = 'block';

    try {
      var appliedRes = await getApi().get({
        action: 'getOutingHandicapAdjustments',
        outingId: outingId,
      });
      if (appliedRes.success && appliedRes.applied && appliedRes.adjustments && appliedRes.adjustments.length) {
        pendingApplyAlreadyApplied = true;
        pendingApplyRows = appliedRes.adjustments;
        setReviewModalActionsVisible(false);
        setReviewModalHint(true);
        renderReviewTable(pendingApplyRows);
        return;
      }

      var result = await getApi().get({ action: 'loadScores', outingId: outingId, limit: 5000 });
      var scores = result.success ? result.scores || [] : [];
      pendingApplyRows = buildProposedAdjustments(outing, scores, window.players || []);
      renderReviewTable(pendingApplyRows);
    } catch (e) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="4">Error loading adjustments</td></tr>';
    }
  }

  function closeReviewHandicapModal() {
    var modal = document.getElementById('applyHandicapModal');
    if (modal) modal.style.display = 'none';
    pendingApplyOuting = null;
    pendingApplyRows = [];
    pendingApplyAlreadyApplied = false;
    setReviewModalActionsVisible(true);
    setReviewModalHint(false);
  }

  async function applyReviewedHandicapAdjustments() {
    if (!pendingApplyOuting || !pendingApplyOuting.outingId || pendingApplyAlreadyApplied) return;
    var adjustments = (pendingApplyRows || [])
      .filter(function (row) {
        return row && row.playerId && Number.isFinite(row.amount) && row.amount !== 0;
      })
      .map(function (row) {
        return {
          playerId: row.playerId,
          amount: row.amount,
          position: row.position,
          reason: row.reason,
        };
      });
    if (!adjustments.length) {
      showAlert('error', 'No adjustments to apply');
      return;
    }
    var btn = document.getElementById('applyHandicapConfirmBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Applying…';
    }
    try {
      var result = await getApi().post('applyOutingAdjustments', {
        outingId: pendingApplyOuting.outingId,
        effectiveDate: pendingApplyOuting.date,
        adjustments: adjustments,
      });
      if (result.success) {
        showAlert('success', 'Applied ' + result.applied + ' handicap adjustment(s)');
        closeReviewHandicapModal();
        if (typeof window.refreshSocietyAdminData === 'function') {
          await window.refreshSocietyAdminData();
        } else if (typeof window.renderOutings === 'function') {
          window.renderOutings();
        } else {
          await refreshOutingHandicapButtons();
        }
        await loadHandicapRules();
      } else {
        showAlert('error', result.error || 'Failed to apply adjustments');
      }
    } catch (e) {
      showAlert('error', e.message || 'Error applying adjustments');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Apply';
      }
    }
  }

  window.SocietyAdminHandicap = {
    loadHandicapRules: loadHandicapRules,
    persistHandicapRules: persistHandicapRules,
    initPlayerHandicapFields: initPlayerHandicapFields,
    syncPlayerIndexFromStepper: syncPlayerIndexFromStepper,
    openReviewHandicapModal: openReviewHandicapModal,
    closeReviewHandicapModal: closeReviewHandicapModal,
    applyReviewedHandicapAdjustments: applyReviewedHandicapAdjustments,
    refreshOutingHandicapButtons: refreshOutingHandicapButtons,
    getHandicapRulesConfig: function () {
      return handicapRulesConfig;
    },
    isHandicapRulesEnabled: function () {
      return handicapRulesEnabled;
    },
  };
})();
