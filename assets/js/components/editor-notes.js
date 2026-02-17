// Editor Notes Component
// Loads and renders editor notes from Societies CaptainsNotes (API)

const EditorNotes = {
  /**
   * Initialize and load editor notes from Societies CaptainsNotes
   */
  init: async function() {
    const container = document.getElementById('editor-notes-content');
    if (!container) {
      console.warn('Editor notes container not found');
      return;
    }

    if (typeof AppConfig !== 'undefined' && AppConfig.currentSociety && AppConfig.currentSociety.captainsNotes != null) {
      const text = String(AppConfig.currentSociety.captainsNotes || '').trim();
      if (text) {
        this.renderFromText(container, text);
        return;
      }
    }

    container.innerHTML = '<p><em>No captain\'s notes for this society.</em></p>';
  },

  /**
   * Render editor notes from a single text string (e.g. CaptainsNotes), splitting on newlines
   */
  renderFromText: function(container, text) {
    const lines = text.split(/\r?\n/);
    let html = '<div class="editor-notes__content">';
    let hasContent = false;
    lines.forEach(function(line) {
      const trimmed = line.trim();
      if (trimmed === '') {
        html += '<p>&nbsp;</p>';
      } else {
        hasContent = true;
        if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
          html += '<p><strong>' + EditorNotes.escapeHtml(trimmed.replace(/\*\*/g, '')) + '</strong></p>';
        } else {
          html += '<p>' + EditorNotes.formatText(trimmed) + '</p>';
        }
      }
    });
    html += '</div>';
    container.innerHTML = hasContent ? html : '<p><em>No content.</em></p>';
  },
  
  /**
   * Format text - convert line breaks and handle basic formatting
   * @param {string} text - Text to format
   * @returns {string} Formatted HTML
   */
  formatText: function(text) {
    // Escape HTML first
    let formatted = this.escapeHtml(text);
    
    // Convert line breaks within the text
    formatted = formatted.replace(/\n/g, '<br>');
    
    // Handle bold (**text**)
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Handle italic (*text*)
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    return formatted;
  },
  
  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml: function(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
