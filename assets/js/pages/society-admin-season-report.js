/**
 * Generate AI season commentary for society-admin.html.
 * Available for the botanic society: the story of the overall leaderboard,
 * not a single outing's hole-by-hole card.
 */
(function () {
  'use strict';

  var SEASON_SOCIETY_ID = 'botanic';
  var lastReportText = '';
  var hasGeneratedOnce = false;

  function getApi() {
    if (typeof ApiClient !== 'undefined') return ApiClient;
    if (typeof window !== 'undefined' && window.ApiClient) return window.ApiClient;
    return null;
  }

  function getAiModels() {
    if (typeof AiModels !== 'undefined') return AiModels;
    if (typeof window !== 'undefined' && window.AiModels) return window.AiModels;
    return null;
  }

  function currentSocietyId() {
    if (typeof AppConfig !== 'undefined' && AppConfig.getSocietyId) {
      return String(AppConfig.getSocietyId() || '').trim().toLowerCase();
    }
    return '';
  }

  function isSeasonSociety(societyId) {
    return String(societyId || '').trim().toLowerCase() === SEASON_SOCIETY_ID;
  }

  function setError(msg) {
    var el = document.getElementById('seasonReportError');
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.style.display = '';
    } else {
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  function setGenerateButtonLabel() {
    var genBtn = document.getElementById('seasonReportGenerateBtn');
    if (genBtn) genBtn.textContent = hasGeneratedOnce ? 'Regenerate' : 'Generate';
  }

  function setResultVisible(show) {
    var wrap = document.getElementById('seasonReportResultWrap');
    var copyBtn = document.getElementById('seasonReportCopyAgainBtn');
    if (wrap) wrap.style.display = show ? '' : 'none';
    if (copyBtn) copyBtn.style.display = show ? '' : 'none';
  }

  function setWorking(on, message) {
    var working = document.getElementById('seasonReportWorking');
    var msgEl = document.getElementById('seasonReportWorkingMessage');
    var genBtn = document.getElementById('seasonReportGenerateBtn');
    var cancelBtn = document.getElementById('seasonReportCancelBtn');
    var copyBtn = document.getElementById('seasonReportCopyAgainBtn');
    var styleEl = document.getElementById('seasonReportStyleHint');
    var contentEl = document.getElementById('seasonReportContentHint');
    var closeBtn = document.querySelector('#seasonReportModal .close');

    if (working) working.style.display = on ? '' : 'none';
    if (msgEl && on && message) msgEl.textContent = message;
    if (genBtn) genBtn.disabled = !!on;
    if (cancelBtn) cancelBtn.disabled = !!on;
    if (copyBtn) copyBtn.disabled = !!on;
    if (styleEl) styleEl.disabled = !!on;
    if (contentEl) contentEl.disabled = !!on;
    if (closeBtn) closeBtn.disabled = !!on;
  }

  function showResult(text, copied) {
    var ta = document.getElementById('seasonReportResultText');
    var note = document.getElementById('seasonReportCopiedNote');
    if (ta) ta.value = text || '';
    setResultVisible(true);
    if (note) {
      note.style.display = copied ? '' : 'none';
      note.textContent = copied ? 'Copied to clipboard' : '';
    }
  }

  function copyTextToClipboard(text) {
    var value = String(text || '');
    if (!value) return Promise.resolve(false);
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(value).then(function () {
        return true;
      }).catch(function () {
        return fallbackCopy(value);
      });
    }
    return Promise.resolve(fallbackCopy(value));
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    } catch (e) {
      return false;
    }
  }

  function syncForSociety(societyId) {
    var btn = document.getElementById('seasonCommentaryBtn');
    if (!btn) return;
    btn.style.display = isSeasonSociety(societyId) ? '' : 'none';
  }

  function openSeasonReportModal() {
    if (!isSeasonSociety(currentSocietyId())) return;

    lastReportText = '';
    hasGeneratedOnce = false;

    var societyNameEl = document.getElementById('societyName');
    var societyName = societyNameEl ? String(societyNameEl.textContent || '').trim() : '';
    var subtitle = document.getElementById('seasonReportSubtitle');
    if (subtitle) {
      subtitle.textContent = societyName
        ? societyName + ' — how the overall leaderboard was won and lost'
        : 'How the overall leaderboard was won and lost';
    }

    var styleEl = document.getElementById('seasonReportStyleHint');
    var contentEl = document.getElementById('seasonReportContentHint');
    var ta = document.getElementById('seasonReportResultText');
    if (styleEl) styleEl.value = '';
    if (contentEl) contentEl.value = '';
    if (ta) ta.value = '';

    setError('');
    setWorking(false);
    setResultVisible(false);
    setGenerateButtonLabel();

    var modal = document.getElementById('seasonReportModal');
    if (modal) modal.style.display = 'block';
  }

  function closeSeasonReportModal() {
    var modal = document.getElementById('seasonReportModal');
    if (modal) modal.style.display = 'none';
    setWorking(false);
    setError('');
    hasGeneratedOnce = false;
  }

  function generateSeasonReport() {
    if (!isSeasonSociety(currentSocietyId())) {
      setError('Season commentary is only available for the botanic society.');
      return;
    }
    var api = getApi();
    if (!api) {
      setError('API client not available.');
      return;
    }
    var aiModels = getAiModels();
    if (!aiModels) {
      setError('AI model settings not available.');
      return;
    }

    var styleHint = (document.getElementById('seasonReportStyleHint') || {}).value || '';
    var contentHint = (document.getElementById('seasonReportContentHint') || {}).value || '';

    setError('');
    setWorking(true, 'Selecting an AI model…');

    aiModels.runWithFallback('generateSeasonReport', {
      styleHint: String(styleHint).trim(),
      contentHint: String(contentHint).trim()
    }, {
      onAttempt: function (attempt) {
        setWorking(true, aiModels.describeAttempt(attempt, 'writing the season review'));
      }
    }).then(function (result) {
      setWorking(false);
      if (!result || !result.success) {
        setError((result && result.error) || 'Failed to generate season commentary.');
        return;
      }
      var report = String(result.report || '').trim();
      if (!report) {
        setError('The AI returned an empty commentary.');
        return;
      }
      lastReportText = report;
      hasGeneratedOnce = true;
      setGenerateButtonLabel();
      return copyTextToClipboard(report).then(function (copied) {
        showResult(report, copied);
      });
    }).catch(function (err) {
      setWorking(false);
      setError((err && err.message) || 'Failed to generate season commentary.');
    });
  }

  function copyReportAgain() {
    var ta = document.getElementById('seasonReportResultText');
    var text = (ta && ta.value) || lastReportText || '';
    var note = document.getElementById('seasonReportCopiedNote');
    copyTextToClipboard(text).then(function (copied) {
      if (note) {
        note.style.display = '';
        note.textContent = copied ? 'Copied to clipboard' : 'Could not copy — select the text manually';
      }
    });
  }

  window.SocietyAdminSeasonReport = {
    syncForSociety: syncForSociety,
    openSeasonReportModal: openSeasonReportModal,
    closeSeasonReportModal: closeSeasonReportModal,
    generateSeasonReport: generateSeasonReport,
    copyReportAgain: copyReportAgain
  };
})();
