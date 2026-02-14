// Multi-Tenant Golf App Configuration
// Centralized configuration for the multi-tenant golf app

const AppConfig = {
  // Single Apps Script Web App URL for all societies
  // This is the master API endpoint - all requests include societyId parameter
  // TODO: Update this with your actual Web App URL after deploying the Apps Script
  apiUrl: "https://script.google.com/macros/s/AKfycbyeWJPzuVI3vIRJMtDvHnA_N2YW9zSt_r99Up7GdEuk-L7TOaPWlZAlj8z0Kmmftq-ecA/exec",
  
  // Current society ID (set dynamically from URL)
  currentSocietyId: null,
  
  // Current society metadata (loaded from API)
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
   * Initialize app config - parse society ID and load society metadata
   * @returns {Promise<void>}
   */
  init: async function() {
    // Parse society ID from URL
    this.currentSocietyId = this.parseSocietyIdFromPath();
    
    if (!this.currentSocietyId) {
      // Only warn when URL looks like app path but society ID is missing (e.g. /theGolfApp/ with nothing after)
      const path = (window.location.pathname || '').toLowerCase();
      if (path.indexOf('thegolfapp') !== -1) {
        console.warn('No society ID found in URL path');
      }
      return;
    }
    
    // Load society metadata
    try {
      const response = await fetch(`${this.apiUrl}?action=getSociety&societyId=${encodeURIComponent(this.currentSocietyId)}`);
      const result = await response.json();
      
      if (result.success && result.society) {
        this.currentSociety = result.society;
        console.log('Loaded society:', this.currentSociety);
      } else {
        console.error('Failed to load society:', result.error);
      }
    } catch (error) {
      console.error('Error loading society:', error);
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
