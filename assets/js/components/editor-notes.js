// Editor Notes Component
// Loads and renders editor notes from Google Sheet with newsletter styling

const EditorNotes = {
  /**
   * Initialize and load editor notes (from Societies CaptainsNotes when using API, else from sheet)
   */
  init: async function() {
    const container = document.getElementById('editor-notes-content');
    if (!container) {
      console.warn('Editor notes container not found');
      return;
    }

    // When society is loaded from API, use CaptainsNotes from Societies sheet
    if (typeof AppConfig !== 'undefined' && AppConfig.currentSociety && AppConfig.currentSociety.captainsNotes != null) {
      const text = String(AppConfig.currentSociety.captainsNotes || '').trim();
      if (text) {
        this.renderFromText(container, text);
        return;
      }
      container.innerHTML = '<p><em>No captain\'s notes for this society.</em></p>';
      return;
    }

    try {
      const url = SheetsConfig.getSheetUrl('editorNotes');
      if (!url) {
        console.error('Invalid editor notes sheet URL');
        container.innerHTML = '<p><em>Editor notes will appear here once configured.</em></p>';
        return;
      }

      console.log('Loading editor notes from:', url);

      // Don't skip empty lines - we need them for spacing
      const data = await CsvLoader.load(url, { header: false, skipEmptyLines: false, delimiter: ',' });

      if (!data || data.length === 0) {
        console.warn('No editor notes data received');
        container.innerHTML = '<p><em>No editor notes available.</em></p>';
        return;
      }

      this.render(container, data);
    } catch (error) {
      console.error('Failed to load editor notes:', error);
      container.innerHTML = '<p><em>Error loading editor notes. Please check the browser console for details.</em></p>';
    }
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
   * Render editor notes with newsletter styling
   * @param {HTMLElement} container - Container element to render into
   * @param {Array} data - CSV data rows
   */
  render: function(container, data) {
    // The Google Sheet should have a simple structure:
    // Each row is a paragraph, empty rows create spacing
    // First column contains the text content
    
    let html = '<div class="editor-notes__content">';
    let hasContent = false;
    
    data.forEach((row, index) => {
      // Handle both array format (header: false) and object format (header: true)
      let text = '';
      if (Array.isArray(row)) {
        text = row[0] || ''; // First column
      } else if (typeof row === 'object' && row !== null) {
        // If header: true was used, get first property value
        const keys = Object.keys(row);
        text = keys.length > 0 ? (row[keys[0]] || '') : '';
      } else {
        text = String(row || '');
      }
      
      const trimmedText = text.trim();
      
      if (trimmedText === '') {
        // Empty row = spacing
        html += '<p>&nbsp;</p>';
      } else {
        hasContent = true;
        // Check if it's a heading (starts with ** or is all caps and short)
        if (trimmedText.startsWith('**') && trimmedText.endsWith('**')) {
          // Bold heading
          const headingText = trimmedText.replace(/\*\*/g, '');
          html += `<p><strong>${this.escapeHtml(headingText)}</strong></p>`;
        } else if (trimmedText.length < 50 && trimmedText === trimmedText.toUpperCase() && trimmedText.match(/^[A-Z\s]+$/)) {
          // All caps short line = heading
          html += `<p><strong>${this.escapeHtml(trimmedText)}</strong></p>`;
        } else {
          // Regular paragraph
          html += `<p>${this.formatText(trimmedText)}</p>`;
        }
      }
    });
    
    html += '</div>';
    
    if (!hasContent) {
      container.innerHTML = '<p><em>No content found in editor notes. Please add text to the Google Sheet.</em></p>';
    } else {
      container.innerHTML = html;
    }
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
