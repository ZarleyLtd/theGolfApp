/**
 * In-app share / copy link for installed PWAs (no browser chrome).
 * Ensures shared URLs include ?app=play|boss|admn so BOSS / PLAY / ADMN stay distinct.
 * PLAY + ADMN: include societyId from URL, AppConfig, or localStorage (single society at a time).
 */
(function() {
  var STORAGE_KEY = 'thegolfapp_last_society_id';

  function normalizeSid(value) {
    var sid = String(value || '').trim().toLowerCase();
    if (!sid) return '';
    if (sid === 'admin' || sid === 'assets' || sid === 'docs' || sid === 'backend') return '';
    return sid;
  }

  function getStoredSocietyId() {
    try {
      return normalizeSid(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
      return '';
    }
  }

  function getAppRoleFromButton(btn) {
    var role = (btn && btn.getAttribute('data-app')) || '';
    role = String(role).trim().toLowerCase();
    if (role === 'play' || role === 'boss' || role === 'admn') return role;
    return 'play';
  }

  function resolveSocietyId() {
    var u;
    try {
      u = new URL(window.location.href);
    } catch (e) {
      return '';
    }
    var fromUrl = normalizeSid(
      u.searchParams.get('societyId') || u.searchParams.get('sociietyId')
    );
    if (fromUrl) return fromUrl;
    if (typeof AppConfig !== 'undefined' && AppConfig.getSocietyId) {
      var fromConfig = normalizeSid(AppConfig.getSocietyId());
      if (fromConfig) return fromConfig;
    }
    return getStoredSocietyId();
  }

  function buildShareUrl(appRole) {
    var u = new URL(window.location.href);
    u.searchParams.set('app', appRole);

    if (appRole === 'boss') {
      u.searchParams.delete('societyId');
      u.searchParams.delete('sociietyId');
      return u.toString();
    }

    var sid = resolveSocietyId();
    if (sid) {
      u.searchParams.set('societyId', sid);
      u.searchParams.delete('sociietyId');
    }
    return u.toString();
  }

  function showToast(message) {
    var existing = document.getElementById('thegolfapp-share-toast');
    if (existing) existing.remove();
    var el = document.createElement('div');
    el.id = 'thegolfapp-share-toast';
    el.className = 'brief-message';
    el.setAttribute('role', 'status');
    el.style.left = '50%';
    el.style.top = 'auto';
    el.style.bottom = 'calc(env(safe-area-inset-bottom, 0px) + 5rem)';
    el.style.transform = 'translateX(-50%)';
    var span = document.createElement('span');
    span.className = 'brief-message__text';
    span.textContent = message;
    el.appendChild(span);
    document.body.appendChild(el);
    window.setTimeout(function() {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 2500);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function(resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('copy failed'));
      } catch (e) {
        document.body.removeChild(ta);
        reject(e);
      }
    });
  }

  function onShareClick(btn) {
    var role = getAppRoleFromButton(btn);
    var url = buildShareUrl(role);
    var title = document.title || 'The Golf App';
    var text =
      role === 'boss'
        ? 'The Golf App — Master admin'
        : role === 'admn'
          ? 'The Golf App — Society admin'
          : 'The Golf App';

    if (navigator.share) {
      navigator
        .share({ title: title, text: text, url: url })
        .then(function() {})
        .catch(function(err) {
          if (err && err.name === 'AbortError') return;
          copyText(url)
            .then(function() {
              showToast('Link copied');
            })
            .catch(function() {
              window.prompt('Copy this link:', url);
            });
        });
    } else {
      copyText(url)
        .then(function() {
          showToast('Link copied');
        })
        .catch(function() {
          window.prompt('Copy this link:', url);
        });
    }
  }

  function bind() {
    document.querySelectorAll('.js-app-share').forEach(function(btn) {
      if (btn.getAttribute('data-share-bound') === '1') return;
      btn.setAttribute('data-share-bound', '1');
      btn.addEventListener('click', function() {
        onShareClick(btn);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  window.AppShare = window.AppShare || {};
  window.AppShare.buildShareUrl = buildShareUrl;
})();
