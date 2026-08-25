/**
 * Generate AI outing commentary report for society-admin.html
 */
(function () {
  'use strict';

  var OUTING_REPORT_MODEL = 'gemini-2.5-flash';

  var currentOutingId = '';
  var lastReportText = '';
  var hasGeneratedOnce = false;

  function getApi() {
    if (typeof ApiClient !== 'undefined') return ApiClient;
    if (typeof window !== 'undefined' && window.ApiClient) return window.ApiClient;
    return null;
  }

  function findOuting(outingId) {
    var list = window.outings || [];
    var id = String(outingId || '');
    for (var i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].outingId || '') === id) return list[i];
    }
    return null;
  }

  function formatOutingLabel(outing) {
    if (!outing) return '';
    var course = outing.courseName || 'Outing';
    var dateStr = outing.date instanceof Date
      ? outing.date.toISOString().split('T')[0]
      : String(outing.date || '').trim();
    if (typeof window.formatOutingDateTime === 'function') {
      var timeStr = outing.time instanceof Date
        ? (outing.time.getHours().toString().padStart(2, '0') + ':' +
          outing.time.getMinutes().toString().padStart(2, '0'))
        : String(outing.time || '').trim();
      return course + ' — ' + window.formatOutingDateTime(dateStr, timeStr);
    }
    return dateStr ? course + ' — ' + dateStr : course;
  }

  function setError(msg) {
    var el = document.getElementById('outingReportError');
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
    var genBtn = document.getElementById('outingReportGenerateBtn');
    if (genBtn) genBtn.textContent = hasGeneratedOnce ? 'Regenerate' : 'Generate';
  }

  function setResultVisible(show) {
    var wrap = document.getElementById('outingReportResultWrap');
    var copyBtn = document.getElementById('outingReportCopyAgainBtn');
    if (wrap) wrap.style.display = show ? '' : 'none';
    if (copyBtn) copyBtn.style.display = show ? '' : 'none';
  }

  function setWorking(on, modelName) {
    var working = document.getElementById('outingReportWorking');
    var msgEl = document.getElementById('outingReportWorkingMessage');
    var genBtn = document.getElementById('outingReportGenerateBtn');
    var cancelBtn = document.getElementById('outingReportCancelBtn');
    var copyBtn = document.getElementById('outingReportCopyAgainBtn');
    var styleEl = document.getElementById('outingReportStyleHint');
    var contentEl = document.getElementById('outingReportContentHint');
    var closeBtn = document.querySelector('#outingReportModal .close');
    var model = String(modelName || OUTING_REPORT_MODEL).trim() || OUTING_REPORT_MODEL;

    if (working) working.style.display = on ? '' : 'none';
    if (msgEl && on) {
      msgEl.textContent = 'The AI model ' + model + ' is preparing its report.';
    }
    if (genBtn) genBtn.disabled = !!on;
    if (cancelBtn) cancelBtn.disabled = !!on;
    if (copyBtn) copyBtn.disabled = !!on;
    if (styleEl) styleEl.disabled = !!on;
    if (contentEl) contentEl.disabled = !!on;
    if (closeBtn) closeBtn.disabled = !!on;
  }

  function showResult(text, copied) {
    var ta = document.getElementById('outingReportResultText');
    var note = document.getElementById('outingReportCopiedNote');
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

  function openGenerateOutingReportModal(outingId) {
    currentOutingId = String(outingId || '').trim();
    lastReportText = '';
    hasGeneratedOnce = false;
    if (!currentOutingId) return;

    var outing = findOuting(currentOutingId);
    var subtitle = document.getElementById('outingReportSubtitle');
    if (subtitle) subtitle.textContent = formatOutingLabel(outing) || ('Outing ' + currentOutingId);

    var styleEl = document.getElementById('outingReportStyleHint');
    var contentEl = document.getElementById('outingReportContentHint');
    var ta = document.getElementById('outingReportResultText');
    if (styleEl) styleEl.value = '';
    if (contentEl) contentEl.value = '';
    if (ta) ta.value = '';

    setError('');
    setWorking(false);
    setResultVisible(false);
    setGenerateButtonLabel();

    var modal = document.getElementById('outingReportModal');
    if (modal) modal.style.display = 'block';
  }

  function closeGenerateOutingReportModal() {
    var modal = document.getElementById('outingReportModal');
    if (modal) modal.style.display = 'none';
    setWorking(false);
    setError('');
    currentOutingId = '';
    hasGeneratedOnce = false;
  }

  function generateOutingReport() {
    if (!currentOutingId) {
      setError('No outing selected.');
      return;
    }
    var api = getApi();
    if (!api) {
      setError('API client not available.');
      return;
    }

    var styleHint = (document.getElementById('outingReportStyleHint') || {}).value || '';
    var contentHint = (document.getElementById('outingReportContentHint') || {}).value || '';

    setError('');
    setWorking(true, OUTING_REPORT_MODEL);

    api.post('generateOutingReport', {
      outingId: currentOutingId,
      styleHint: String(styleHint).trim(),
      contentHint: String(contentHint).trim()
    }).then(function (result) {
      var model = (result && result.model) || OUTING_REPORT_MODEL;
      setWorking(false, model);
      if (!result || !result.success) {
        setError((result && result.error) || 'Failed to generate report.');
        return;
      }
      var report = String(result.report || '').trim();
      if (!report) {
        setError('The AI returned an empty report.');
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
      setError((err && err.message) || 'Failed to generate report.');
    });
  }

  function copyReportAgain() {
    var ta = document.getElementById('outingReportResultText');
    var text = (ta && ta.value) || lastReportText || '';
    var note = document.getElementById('outingReportCopiedNote');
    copyTextToClipboard(text).then(function (copied) {
      if (note) {
        note.style.display = '';
        note.textContent = copied ? 'Copied to clipboard' : 'Could not copy — select the text manually';
      }
    });
  }

  window.SocietyAdminOutingReport = {
    openGenerateOutingReportModal: openGenerateOutingReportModal,
    closeGenerateOutingReportModal: closeGenerateOutingReportModal,
    generateOutingReport: generateOutingReport,
    copyReportAgain: copyReportAgain
  };
})();
