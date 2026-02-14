// Club Image Loader Utility
// Handles loading golf club images with naming convention and fallback

const ClubImageLoader = {
  /**
   * Normalize golf club name to image filename
   * @param {string} golfClubName - The golf club name from outing data
   * @returns {string} Normalized filename (without extension)
   */
  normalizeClubName: function(golfClubName) {
    if (!golfClubName) return 'default';
    
    return golfClubName
      .toLowerCase()
      .replace(/\s+/g, '-')           // Replace spaces with hyphens
      .replace(/[^a-z0-9-]/g, '')     // Remove special characters
      .replace(/-+/g, '-')            // Replace multiple hyphens with single
      .replace(/^-|-$/g, '');         // Remove leading/trailing hyphens
  },

  /**
   * Get image URL for a golf club
   * @param {string} golfClubName - The golf club name
   * @returns {string} Image URL path
   */
  getImageUrl: function(golfClubName) {
    const normalized = this.normalizeClubName(golfClubName);
    return `assets/images/clubs/${normalized}.jpg`;
  },

  /**
   * Get default image URL
   * @returns {string} Default image URL
   */
  getDefaultImageUrl: function() {
    return 'assets/images/clubs/default.jpg';
  },

  /**
   * Check if an image exists (async)
   * @param {string} imageUrl - Image URL to check
   * @returns {Promise<boolean>} True if image exists
   */
  imageExists: function(imageUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = imageUrl;
    });
  },

  /**
   * Get image URL with fallback to default
   * Checks if the specific image exists, falls back to default if not
   * @param {string} golfClubName - The golf club name
   * @returns {Promise<string>} Image URL (specific or default)
   */
  getImageUrlWithFallback: async function(golfClubName) {
    if (!golfClubName) {
      return this.getDefaultImageUrl();
    }

    const specificUrl = this.getImageUrl(golfClubName);
    const exists = await this.imageExists(specificUrl);
    
    return exists ? specificUrl : this.getDefaultImageUrl();
  },

  /**
   * Create an img element with proper src and error handling
   * @param {string} golfClubName - The golf club name
   * @param {Object} options - Options for the img element (alt, className, etc.)
   * @returns {Promise<HTMLImageElement>} Image element
   */
  createImageElement: async function(golfClubName, options = {}) {
    const img = document.createElement('img');
    const url = await this.getImageUrlWithFallback(golfClubName);
    
    img.src = url;
    img.alt = options.alt || golfClubName || 'Golf club';
    
    if (options.className) {
      img.className = options.className;
    }
    
    // Fallback on error
    img.onerror = function() {
      this.src = ClubImageLoader.getDefaultImageUrl();
    };
    
    return img;
  }
};
