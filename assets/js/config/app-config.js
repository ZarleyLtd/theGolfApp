// Multi-Tenant Golf App Configuration
// Centralized configuration for the multi-tenant golf app

const AppConfig = {
  // Single Apps Script Web App URL for all societies
  apiUrl: "https://script.google.com/macros/s/AKfycbyeWJPzuVI3vIRJMtDvHnA_N2YW9zSt_r99Up7GdEuk-L7TOaPWlZAlj8z0Kmmftq-ecA/exec",

  /** sessionStorage key prefix for cached society row (stable data, cache survives navigation in same tab) */
  societyCacheKeyPrefix: 'thegolfapp_society_',

  currentSocietyId: null,
  currentSociety: null,
  
  /**
   * Parse society ID from URL path
   * Expected format: /theGolfApp/<society-id>/ or /theGolfApp/<society-id>/index.html
   * @returns {string|null} Society ID or null if not found
   */
  parseSocietyIdFromPath: function() {
    const path = window.location.pathname;
    
    // Remove leading/trailing slashes and split
    const parts = path.replace(/^\/+|\/+$/g, '').split('/');
    
    // Look for 'theGolfApp' in the path
    const appIndex = parts.indexOf('theGolfApp');
    if (appIndex >= 0 && appIndex < parts.length - 1) {
      // Next part after 'theGolfApp' is the society ID
      const societyId = parts[appIndex + 1];
      // Filter out common file names
      if (societyId && !societyId.match(/\.(html|js|css|json)$/i)) {
        return societyId.toLowerCase();
      }
    }
    
    // Fallback: check if path is directly /theGolfApp/<society-id>
    if (parts.length >= 2 && parts[parts.length - 2] === 'theGolfApp') {
      const societyId = parts[parts.length - 1];
      if (societyId && !societyId.match(/\.(html|js|css|json)$/i)) {
        return societyId.toLowerCase();
      }
    }
    
    return null;
  },
  
  /**
   * Parse society ID from query string (?societyId=xxx or ?sociietyId=xxx)
   * @returns {string|null}
   */
  parseSocietyIdFromQuery: function() {
    const params = new URLSearchParams(window.location.search || '');
    return params.get('societyId') || params.get('sociietyId') || null;
  },

  /**
   * Initialize app config - parse society ID and load society metadata
   * @returns {Promise<void>}
   */
  init: async function() {
    // Parse society ID from URL path first, then from query string
    this.currentSocietyId = this.parseSocietyIdFromPath();
    if (!this.currentSocietyId) {
      this.currentSocietyId = this.parseSocietyIdFromQuery();
    }
    if (this.currentSocietyId) {
      this.currentSocietyId = this.currentSocietyId.trim().toLowerCase();
    }

    if (!this.currentSocietyId) {
      const path = (window.location.pathname || '').toLowerCase();
      if (path.indexOf('thegolfapp') !== -1) {
        console.warn('No society ID found in URL path');
      }
      return;
    }

    // Already in memory for this society
    if (this.currentSociety && String(this.currentSociety.societyId || '').toLowerCase() === this.currentSocietyId) {
      return;
    }

    // Try cache first (sessionStorage – survives navigation, cleared when tab closes)
    const cacheKey = this.societyCacheKeyPrefix + this.currentSocietyId;
    try {
      const cached = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.societyId) {
          this.currentSociety = parsed;
          return;
        }
      }
    } catch (e) {
      // Invalid or missing cache – fetch below
    }

    // Load society metadata from API
    try {
      const response = await fetch(`${this.apiUrl}?action=getSociety&societyId=${encodeURIComponent(this.currentSocietyId)}`);
      const result = await response.json();

      if (result.success && result.society) {
        this.currentSociety = result.society;
        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(cacheKey, JSON.stringify(this.currentSociety));
          }
        } catch (e) {}
      } else {
        this.currentSociety = null;
      }
    } catch (error) {
      console.error('Error loading society:', error);
      this.currentSociety = null;
    }
  },
  
  /**
   * Get the current society ID
   * @returns {string|null}
   */
  getSocietyId: function() {
    return this.currentSocietyId;
  },
  
  /**
   * Get the current society name
   * @returns {string}
   */
  getSocietyName: function() {
    return this.currentSociety ? this.currentSociety.societyName : 'Golf Society';
  }
};

// Initialize on load
if (typeof window !== 'undefined') {
  AppConfig.init();
}
