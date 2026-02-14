// API Client Utility
// Handles communication with Google Apps Script backend
// Centralizes fetch API usage and error handling
// Automatically includes societyId from AppConfig

const ApiClient = {
  /**
   * Make a POST request to the backend API
   * @param {string} action - The action to perform (saveScore, loadScores, deleteScore, etc.)
   * @param {Object} data - The data to send
   * @param {string} [societyId] - Optional society ID (defaults to AppConfig.currentSocietyId)
   * @returns {Promise} Promise that resolves with the response data
   */
  post: function(action, data, societyId) {
    return new Promise((resolve, reject) => {
      const apiUrl = AppConfig.apiUrl;
      
      if (!apiUrl) {
        reject(new Error('API URL not configured. Please update app-config.js'));
        return;
      }
      
      // Get society ID (use provided one, or current from AppConfig, or throw error)
      const currentSocietyId = societyId || AppConfig.getSocietyId();
      
      // Master admin actions don't require societyId
      const masterAdminActions = ['createSociety', 'updateSociety', 'deleteSociety', 'getAllSocieties'];
      if (!masterAdminActions.includes(action) && !currentSocietyId) {
        reject(new Error('Society ID is required. Make sure you are accessing the site via /theGolfApp/<society-id>/'));
        return;
      }
      
      // Log for debugging
      console.log('Making POST request to:', apiUrl);
      console.log('Action:', action);
      console.log('Society ID:', currentSocietyId);
      
      const requestData = {
        action: action,
        societyId: currentSocietyId,
        data: data
      };
      
      // Use form-encoded data instead of JSON to avoid CORS preflight
      // Google Apps Script Web Apps don't handle CORS preflight (OPTIONS) properly
      const formData = new URLSearchParams();
      formData.append('data', JSON.stringify(requestData));
      
      fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString(),
        redirect: 'follow'
      })
      .then(response => {
        // 404 = Web App URL not found - deployment may be wrong or URL changed
        if (response.status === 404) {
          throw new Error('404_NOT_FOUND');
        }
        
        // Try to read as text first (more reliable)
        return response.text().then(text => {
          
          // If text is empty but status is ok, might still be success
          if (!text && (response.ok || response.status === 0)) {
            return { success: true, message: 'Request completed' };
          }
          
          // Try to parse as JSON
          try {
            return JSON.parse(text);
          } catch (e) {
            // If it's not JSON, check if it's an HTML error page
            if (text.includes('<html') || text.includes('<!DOCTYPE')) {
              throw new Error('Server returned HTML instead of JSON. The Web App may not be deployed correctly.');
            }
            // If we got some text but not JSON, return it as an error message
            throw new Error(`Server response: ${text.substring(0, 200)}`);
          }
        });
      })
      .then(result => {
        if (result && result.success) {
          resolve(result);
        } else if (result && result.error) {
          const error = new Error(result.error);
          if (result.debug) {
            error.debug = result.debug;
            error.response = result;
          }
          reject(error);
        } else {
          reject(new Error('Unknown error from server'));
        }
      })
      .catch(error => {
        // 404 = Web App URL not found
        if (error.message === '404_NOT_FOUND') {
          reject(new Error('404 Not Found: The Web App URL is invalid or the deployment no longer exists. Go to your Google Apps Script project → Deploy → Manage deployments. Copy the Web App URL (it may have changed) and update apiUrl in assets/js/config/sheets-config.js'));
          return;
        }
        
        // Network/CORS errors
        if (error.message.includes('Failed to fetch') || 
            error.message.includes('NetworkError') ||
            error.name === 'TypeError' ||
            error.message.includes('CORS')) {
          reject(new Error('Network/CORS error: Could not connect to server. Verify: 1) Open the Web App URL in your browser to test it, 2) Deployment is set to "Anyone", 3) Script is authorized.'));
        } else {
          reject(error);
        }
      });
    });
  },
  
  /**
   * Make a GET request to the backend API
   * @param {Object} params - Query parameters (action is required)
   * @param {string} [societyId] - Optional society ID (defaults to AppConfig.currentSocietyId)
   * @returns {Promise} Promise that resolves with the response data
   */
  get: function(params, societyId) {
    return new Promise((resolve, reject) => {
      const apiUrl = AppConfig.apiUrl;
      
      if (!apiUrl) {
        reject(new Error('API URL not configured. Please update app-config.js'));
        return;
      }
      
      // Get society ID
      const currentSocietyId = societyId || AppConfig.getSocietyId();
      
      // Master admin actions don't require societyId
      const masterAdminActions = ['getAllSocieties'];
      if (!masterAdminActions.includes(params.action) && !currentSocietyId) {
        reject(new Error('Society ID is required. Make sure you are accessing the site via /theGolfApp/<society-id>/'));
        return;
      }
      
      // Add societyId to params if not already present
      const requestParams = { ...params };
      if (currentSocietyId && !requestParams.societyId) {
        requestParams.societyId = currentSocietyId;
      }
      
      const queryString = new URLSearchParams(requestParams).toString();
      const url = `${apiUrl}?${queryString}`;
      
      console.log('Making GET request to:', url);
      
      // Do not set Content-Type (or other custom headers) on GET - it triggers CORS preflight (OPTIONS)
      // which Google Apps Script does not handle. A simple GET with no custom headers works from localhost.
      fetch(url, {
        method: 'GET',
        redirect: 'follow'
      })
      .then(response => {
        if (response.status === 404) {
          throw new Error('404_NOT_FOUND');
        }
        // Google Apps Script may return status 0 or other non-standard status codes
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return response.json();
        } else {
          return response.text().then(text => {
            try {
              return JSON.parse(text);
            } catch (e) {
              if (response.status === 0 || response.ok) {
                try {
                  return JSON.parse(text);
                } catch (e2) {
                  throw new Error('Invalid response format from server');
                }
              }
              throw new Error(`Server error: ${text.substring(0, 100)}`);
            }
          });
        }
      })
      .then(result => {
        if (result && result.success) {
          resolve(result);
        } else if (result && result.error) {
          reject(new Error(result.error));
        } else {
          reject(new Error('Unknown error from server'));
        }
      })
      .catch(error => {
        console.error('API request error:', error);
        if (error.message === '404_NOT_FOUND') {
          reject(new Error('404 Not Found: The Web App URL is invalid or the deployment no longer exists. Update apiUrl in sheets-config.js with the URL from Deploy → Manage deployments.'));
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          reject(new Error('Network error: Could not connect to server. Check the Web App URL in app-config.js.'));
        } else {
          reject(error);
        }
      });
    });
  }
};
