// Scorecard Side-Scroll Page - Scroll-into-view and focus styling
// Works with scorecard.js which provides all calculation and save/load logic

(function() {
  'use strict';

  const front9Track = document.getElementById('front9-track');
  const back9Track = document.getElementById('back9-track');

  if (!front9Track || !back9Track) return;

  function scrollHoleIntoView(input, holeNum) {
    const track = holeNum <= 9 ? front9Track : back9Track;
    if (!track) return;

    const card = document.getElementById('hole-card-' + holeNum);
    if (!card || !track.contains(card)) return;

    const cardLeft = card.offsetLeft;
    const cardWidth = card.offsetWidth;
    const trackWidth = track.clientWidth;
    const trackScrollWidth = track.scrollWidth;

    // Scroll so the focused hole card is visible (prefer centering when possible)
    let targetScroll = track.scrollLeft;
    const cardCenter = cardLeft + cardWidth / 2;
    const idealScroll = cardCenter - trackWidth / 2;
    targetScroll = Math.max(0, Math.min(trackScrollWidth - trackWidth, idealScroll));

    track.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });
  }

  function updateFocusStyle(holeNum) {
    document.querySelectorAll('.hole-card').forEach(function(card) {
      card.classList.remove('hole-card--focused');
    });
    const card = document.getElementById('hole-card-' + holeNum);
    if (card) card.classList.add('hole-card--focused');
  }

  function setupSidescrollListeners() {
    for (let i = 1; i <= 18; i++) {
      const input = document.getElementById('hole-' + i);
      if (!input) continue;

      input.addEventListener('focus', function() {
        scrollHoleIntoView(this, i);
        updateFocusStyle(i);
      });
    }

    // Clear focus style when focus leaves the form
    document.getElementById('scorecard-form').addEventListener('focusout', function(e) {
      if (!e.relatedTarget || !e.relatedTarget.closest('.hole-card')) {
        document.querySelectorAll('.hole-card').forEach(function(card) {
          card.classList.remove('hole-card--focused');
        });
      }
    });
  }

  // Run after scorecard.js has initialized
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSidescrollListeners);
  } else {
    setupSidescrollListeners();
  }
})();
