// Main Entry Point & Page Router
// Determines which page module to initialize based on DOM elements

document.addEventListener('DOMContentLoaded', function() {
  // Initialize image loading
  if (typeof ImageLoader !== 'undefined' && typeof ImageLoader.init === 'function') {
    ImageLoader.init();
  }
  
  // Page detection and initialization
  // Home page - Knockout tournament display
  if (document.getElementById('champ-semis') || 
      document.getElementById('champ-final') ||
      document.getElementById('plate-qf') ||
      document.getElementById('plate-sf') ||
      document.getElementById('plate-final')) {
    IndexPage.init();
  }
  
  // Fixtures page
  if (document.getElementById('fixtures-list')) {
    FixturesPage.init();
  }
  
  // Results page
  if (document.getElementById('results-list')) {
    ResultsPage.init();
  }
  
  // Leagues page (league-one, league-two)
  if (document.getElementById('league-one') || 
      document.getElementById('league-two')) {
    LeaguesPage.init();
  }
  
  // Handicaps page
  if (document.getElementById('handicaps')) {
    HandicapsPage.init();
  }
  
  // Under development page (league-a, league-b)
  if (document.getElementById('league-a') || 
      document.getElementById('league-b')) {
    UnderDevelopmentPage.init();
  }
  
  // Scorecard page
  if (document.getElementById('scorecard-form')) {
    // Check if ScorecardPage is defined before calling init
    if (typeof ScorecardPage !== 'undefined' && typeof ScorecardPage.init === 'function') {
      ScorecardPage.init();
    } else {
      // Fallback: try again after a short delay in case of script loading timing issues
      setTimeout(function() {
        if (typeof ScorecardPage !== 'undefined' && typeof ScorecardPage.init === 'function') {
          ScorecardPage.init();
        } else {
          console.error('ScorecardPage is not defined. Check if scorecard.js is loaded correctly.');
        }
      }, 100);
    }
  }
  
  // Gallery page
  if (document.getElementById('gallery-app')) {
    if (typeof GalleryPage !== 'undefined' && typeof GalleryPage.init === 'function') {
      GalleryPage.init();
    }
  }

  // Check for placeholder replacement (for old front page)
  if (document.body.innerHTML.includes('[aleader]') || 
      document.body.innerHTML.includes('[bleader]')) {
    LeagueLeadersPlaceholder.init();
  }
  
  // Editor Notes and Next Outing (home page) - skip when index uses ?societyId= (initialized after society load)
  var search = window.location.search || '';
  var usesSocietyParam = search.indexOf('societyId=') !== -1 || search.indexOf('sociietyId=') !== -1;
  if (!usesSocietyParam) {
    if (document.getElementById('editor-notes-content') && typeof EditorNotes !== 'undefined' && typeof EditorNotes.init === 'function') {
      EditorNotes.init();
    }
    if (document.getElementById('next-outing-content') && typeof NextOuting !== 'undefined' && typeof NextOuting.init === 'function') {
      NextOuting.init();
    }
  }
});