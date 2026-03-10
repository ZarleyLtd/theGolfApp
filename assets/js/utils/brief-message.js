/**
 * BriefMessage – show a short message just above a button, then remove it after ~1s.
 * Use for no-op feedback (e.g. "Score already recorded", "No Score entered").
 * @param {string} text - Message to show (will be escaped for HTML).
 * @param {HTMLElement|null} buttonEl - Button (or other element) to position the message above.
 */
function BriefMessage(text, buttonEl) {
  var msg = document.createElement('div');
  msg.className = 'brief-message brief-message--above';
  msg.setAttribute('role', 'status');
  msg.setAttribute('aria-live', 'polite');
  msg.innerHTML = '<span class="brief-message__text">' + (text || '').replace(/</g, '&lt;') + '</span>';
  document.body.appendChild(msg);
  if (buttonEl) {
    var rect = buttonEl.getBoundingClientRect();
    var centerX = rect.left + rect.width / 2;
    msg.style.top = (rect.top - 8) + 'px';
    msg.style.left = centerX + 'px';
    var msgRect = msg.getBoundingClientRect();
    var pad = 8;
    var left = centerX;
    if (msgRect.left < pad) {
      left = left + (pad - msgRect.left);
    } else if (msgRect.right > window.innerWidth - pad) {
      left = left - (msgRect.right - (window.innerWidth - pad));
    }
    msg.style.left = left + 'px';
    if (msgRect.top < pad) {
      msg.style.top = (rect.bottom + 8) + 'px';
      msg.classList.remove('brief-message--above');
      msg.classList.add('brief-message--below');
    }
  }
  setTimeout(function () {
    if (msg.parentNode) msg.parentNode.removeChild(msg);
  }, 1000);
}
