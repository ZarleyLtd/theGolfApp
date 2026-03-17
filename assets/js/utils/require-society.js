/**
 * requireSociety – shared society validation for pages that need a valid society.
 * Calls AppConfig.init(), then shows error or main content and optional hero/page title.
 * Requires: AppConfig (app-config.js), Formatters (formatters.js) for escapeHtml in message.
 * @param {Object} options - { errorElId, mainElId, errorMsgElId?, heroTitleId?, pageTitleId?, heroSocietyId?, defaultPageTitle?, pageNameForUrl? }
 * @returns {Promise<{ok: boolean, societyId?: string, societyName?: string}>}
 */
async function requireSociety(options) {
  var errorElId = options.errorElId || 'society-error';
  var mainElId = options.mainElId || 'main-content';
  var errorMsgElId = options.errorMsgElId || 'society-error-message';
  var defaultPageTitle = options.defaultPageTitle || 'Golf Society';
  var pageNameForUrl = options.pageNameForUrl || 'index.html';

  if (typeof AppConfig === 'undefined' || typeof AppConfig.init !== 'function') {
    return { ok: false };
  }
  await AppConfig.init();
  var sid = AppConfig.getSocietyId();
  var errorEl = document.getElementById(errorElId);
  var errorMsg = document.getElementById(errorMsgElId);
  var mainEl = document.getElementById(mainElId);

  if (!sid) {
    document.body.classList.add('society-invalid');
    if (errorEl) errorEl.style.display = 'block';
    if (mainEl) mainEl.style.display = 'none';
    if (errorMsg) {
      var msg = '<strong>No society selected.</strong><br>Add <code>?societyId=xxx</code> to the URL (e.g. <code>' + (typeof Formatters !== 'undefined' && Formatters.escapeHtml ? Formatters.escapeHtml(pageNameForUrl) : pageNameForUrl) + '?societyId=your-society-id</code>).';
      errorMsg.innerHTML = msg;
    }
    return { ok: false };
  }
  if (!AppConfig.currentSociety) {
    document.body.classList.add('society-invalid');
    if (errorEl) errorEl.style.display = 'block';
    if (mainEl) mainEl.style.display = 'none';
    if (errorMsg) {
      errorMsg.innerHTML = '<strong>Society not found.</strong><br>Use a valid society ID in the URL (e.g. <code>' + (typeof Formatters !== 'undefined' && Formatters.escapeHtml ? Formatters.escapeHtml(pageNameForUrl) : pageNameForUrl) + '?societyId=your-society-id</code>).';
    }
    return { ok: false };
  }

  document.body.classList.remove('society-invalid');
  if (errorEl) errorEl.style.display = 'none';
  if (mainEl) mainEl.style.display = 'block';
  var societyName = AppConfig.getSocietyName() || '';

  if (options.heroSocietyId) {
    var heroSocietyEl = document.getElementById(options.heroSocietyId);
    if (heroSocietyEl) {
      heroSocietyEl.textContent = societyName;
      heroSocietyEl.style.display = societyName ? 'block' : 'none';
    }
  }
  if (options.heroTitleId) {
    var heroTitle = document.getElementById(options.heroTitleId);
    if (heroTitle) heroTitle.textContent = defaultPageTitle;
  }
  if (options.pageTitleId) {
    var pageTitleEl = document.getElementById(options.pageTitleId);
    if (pageTitleEl) pageTitleEl.textContent = (societyName ? societyName + ' - ' : '') + defaultPageTitle;
  }

  return { ok: true, societyId: sid, societyName: societyName };
}
