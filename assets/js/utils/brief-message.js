/**
 * Brief message — ephemeral anchored feedback (pattern from theConfessional claims UI).
 * Shows a short message near an anchor element, then auto-dismisses.
 */
(function (global) {
  'use strict';

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * @param {string} text - Message to show
   * @param {Element|null} anchorEl - Element to position near (centre of anchor)
   * @param {{ durationMs?: number, placement?: 'above'|'below' }} [options]
   */
  function showBriefMessage(text, anchorEl, options) {
    options = options || {};
    var duration = options.durationMs != null ? options.durationMs : 1000;
    var placement = options.placement || 'above';

    var msg = document.createElement('div');
    msg.className =
      'brief-message brief-message--' + (placement === 'below' ? 'below' : 'above');
    msg.setAttribute('role', 'status');
    msg.setAttribute('aria-live', 'polite');
    msg.innerHTML = '<span class="brief-message__text">' + escapeHtml(text) + '</span>';
    document.body.appendChild(msg);

    if (anchorEl && typeof anchorEl.getBoundingClientRect === 'function') {
      var rect = anchorEl.getBoundingClientRect();
      var centerX = rect.left + rect.width / 2;
      msg.style.top = (rect.top - 8) + 'px';
      msg.style.left = centerX + 'px';
      var msgRect = msg.getBoundingClientRect();
      var pad = 8;
      var left = centerX;
      if (msgRect.left < pad) {
        left = left + (pad - msgRect.left);
      } else if (msgRect.right > global.innerWidth - pad) {
        left = left - (msgRect.right - (global.innerWidth - pad));
      }
      msg.style.left = left + 'px';
      if (placement === 'above' && msgRect.top < pad) {
        msg.style.top = (rect.bottom + 8) + 'px';
        msg.classList.remove('brief-message--above');
        msg.classList.add('brief-message--below');
      }
    } else {
      msg.style.top = '50%';
      msg.style.left = '50%';
    }

    global.setTimeout(function () {
      if (msg.parentNode) msg.parentNode.removeChild(msg);
    }, duration);
  }

  global.BriefMessage = {
    show: showBriefMessage,
  };
})(typeof window !== 'undefined' ? window : globalThis);
