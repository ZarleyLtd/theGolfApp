/**
 * Session Admin Mode: unlock with a code, persist for this browser tab,
 * and notify pages (e.g. leaderboard) so they can ignore blur settings.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'golfapp_admin_mode';
  var CODE = '4312';
  var LABEL_UNLOCK = 'Unlock Admin Mode';
  var LABEL_EXIT = 'Exit Admin Mode';
  var EVENT_NAME = 'golfapp-admin-mode-change';
  var dialog = null;
  var onKeyDown = null;

  function isActive() {
    try {
      return global.sessionStorage && global.sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function setActive(on) {
    var next = !!on;
    try {
      if (next) global.sessionStorage.setItem(STORAGE_KEY, '1');
      else global.sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    if (document.body) document.body.classList.toggle('admin-mode', next);
    syncLabels();
    try {
      global.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { active: next } }));
    } catch (e2) {}
  }

  function labelForState() {
    return isActive() ? LABEL_EXIT : LABEL_UNLOCK;
  }

  function syncLabels() {
    var els = document.querySelectorAll('.js-admin-mode-toggle');
    var text = labelForState();
    for (var i = 0; i < els.length; i++) {
      els[i].textContent = text;
      els[i].setAttribute('aria-pressed', isActive() ? 'true' : 'false');
    }
  }

  function showIncorrectCode(anchorEl) {
    if (!global.BriefMessage || typeof global.BriefMessage.show !== 'function') return;
    global.BriefMessage.show('Incorrect code', anchorEl, { durationMs: 1200 });
  }

  function closeMobileNav() {
    var toggle = document.querySelector('.navbar__toggle.is-active');
    if (toggle) toggle.click();
  }

  function closeDialog() {
    if (onKeyDown) {
      document.removeEventListener('keydown', onKeyDown);
      onKeyDown = null;
    }
    if (dialog && dialog.parentNode) dialog.parentNode.removeChild(dialog);
    dialog = null;
  }

  function submitCode(input, anchorEl) {
    var entered = input ? String(input.value || '').trim() : '';
    if (entered === CODE) {
      closeDialog();
      setActive(true);
      return;
    }
    if (input) {
      input.value = '';
      input.focus();
    }
    showIncorrectCode(anchorEl || (dialog && dialog.querySelector('.admin-mode-dialog__unlock')));
  }

  function openCodeDialog() {
    closeDialog();
    closeMobileNav();
    dialog = document.createElement('div');
    dialog.className = 'admin-mode-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'admin-mode-dialog-title');
    dialog.innerHTML =
      '<div class="admin-mode-dialog__card">' +
      '<p id="admin-mode-dialog-title" class="admin-mode-dialog__title">Enter admin code</p>' +
      '<input class="admin-mode-dialog__input" type="password" inputmode="numeric" autocomplete="off" maxlength="12" />' +
      '<div class="admin-mode-dialog__actions">' +
      '<button type="button" class="admin-mode-dialog__cancel">Cancel</button>' +
      '<button type="button" class="admin-mode-dialog__unlock">Unlock</button>' +
      '</div></div>';
    document.body.appendChild(dialog);
    var input = dialog.querySelector('.admin-mode-dialog__input');
    var unlockBtn = dialog.querySelector('.admin-mode-dialog__unlock');
    dialog.querySelector('.admin-mode-dialog__cancel').addEventListener('click', closeDialog);
    unlockBtn.addEventListener('click', function () {
      submitCode(input, unlockBtn);
    });
    dialog.addEventListener('click', function (ev) {
      if (ev.target === dialog) closeDialog();
    });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        submitCode(input, unlockBtn);
      }
    });
    onKeyDown = function (ev) {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        closeDialog();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    setTimeout(function () {
      input.focus();
    }, 0);
  }

  function onToggleClick(e) {
    var link = e.target && e.target.closest ? e.target.closest('.js-admin-mode-toggle') : null;
    if (!link) return;
    e.preventDefault();
    if (isActive()) {
      setActive(false);
      return;
    }
    openCodeDialog();
  }

  function init() {
    if (document.body) document.body.classList.toggle('admin-mode', isActive());
    syncLabels();
    document.addEventListener('click', onToggleClick);
  }

  global.AdminMode = {
    isActive: isActive,
    setActive: setActive,
    EVENT_NAME: EVENT_NAME
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
