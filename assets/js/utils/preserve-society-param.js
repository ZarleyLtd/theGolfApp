/**
 * Preserve ?societyId=xxx when navigating between app pages.
 * Rewrites internal nav/footer links to include the current societyId so it stays in the URL.
 */
(function() {
  var params = new URLSearchParams(window.location.search || '');
  var sid = params.get('societyId') || params.get('sociietyId');
  if (!sid) return;

  var appPages = ['index.html', 'outings.html', 'scorecard.html', 'scorecard-sidescroll.html', 'leaderboard.html'];

  function run() {
    document.querySelectorAll('a[href]').forEach(function(a) {
      var href = a.getAttribute('href');
      if (!href || href.indexOf('http') === 0 || href.indexOf('//') === 0 || href === '#' || href.charAt(0) === '?') return;
      var path = href.split('?')[0];
      var filename = path.replace(/^.*\//, '');
      if (appPages.indexOf(filename) === -1) return;
      try {
        var url = new URL(href, window.location.href);
        url.searchParams.set('societyId', sid);
        a.setAttribute('href', filename + (url.search ? url.search : ''));
      } catch (e) {}
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
