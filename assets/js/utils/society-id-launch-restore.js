/**
 * Preserve societyId across installed-app launches.
 * - When URL has ?societyId=..., persist it.
 * - When URL has no societyId and app opens in standalone mode, restore last value.
 */
(function() {
  var STORAGE_KEY = 'thegolfapp_last_society_id';
  var RESERVED = { admin: true, assets: true, docs: true, backend: true };

  function normalizeSid(value) {
    var sid = String(value || '').trim().toLowerCase();
    if (!sid) return '';
    return RESERVED[sid] ? '' : sid;
  }

  function isStandaloneLaunch() {
    try {
      return !!(
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        window.navigator.standalone === true
      );
    } catch (e) {
      return false;
    }
  }

  var url;
  try {
    url = new URL(window.location.href);
  } catch (e) {
    return;
  }

  var sidFromUrl = normalizeSid(
    url.searchParams.get('societyId') || url.searchParams.get('sociietyId')
  );

  if (sidFromUrl) {
    try {
      localStorage.setItem(STORAGE_KEY, sidFromUrl);
    } catch (e) {}
    return;
  }

  if (!isStandaloneLaunch()) return;

  var savedSid = '';
  try {
    savedSid = normalizeSid(localStorage.getItem(STORAGE_KEY));
  } catch (e) {}
  if (!savedSid) return;

  url.searchParams.set('societyId', savedSid);
  window.location.replace(url.toString());
})();
