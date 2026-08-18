// Image Lightbox Component (view-only)
// Fullscreen viewer for a single image: close button, backdrop click, and Escape.
// Unlike the scorecard photo lightbox, this has no replace/remove actions.
// Injects its own styles so any page can use it by just including this script.

const ImageLightbox = {
  _overlayEl: null,
  _keydownHandler: null,
  _stylesInjected: false,

  /** @param {string} url Full-size image URL to display. */
  open: function(url) {
    if (!url) return;
    this.close();
    this._injectStyles();

    const overlay = document.createElement('div');
    overlay.className = 'image-lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Image viewer');

    const content = document.createElement('div');
    content.className = 'image-lightbox__content';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'image-lightbox__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => this.close());
    content.appendChild(closeBtn);

    const img = document.createElement('img');
    img.className = 'image-lightbox__img';
    img.alt = 'Scorecard photo';
    img.src = url;
    content.appendChild(img);

    overlay.appendChild(content);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    const onKeydown = (e) => {
      if (e.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', onKeydown);
    this._keydownHandler = onKeydown;

    document.body.appendChild(overlay);
    this._overlayEl = overlay;
    closeBtn.focus();
  },

  close: function() {
    if (this._overlayEl && this._overlayEl.parentNode) {
      this._overlayEl.parentNode.removeChild(this._overlayEl);
    }
    this._overlayEl = null;
    if (this._keydownHandler) {
      document.removeEventListener('keydown', this._keydownHandler);
      this._keydownHandler = null;
    }
  },

  _injectStyles: function() {
    if (this._stylesInjected) return;
    this._stylesInjected = true;
    const style = document.createElement('style');
    style.textContent = [
      '.image-lightbox {',
      '  position: fixed;',
      '  inset: 0;',
      '  z-index: 10001;',
      '  background: rgba(0, 0, 0, 0.88);',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  padding: 1.5em 1em;',
      '  box-sizing: border-box;',
      '}',
      '.image-lightbox__content {',
      '  position: relative;',
      '  max-width: 100%;',
      '  max-height: 100%;',
      '  display: flex;',
      '  flex-direction: column;',
      '  align-items: center;',
      '}',
      '.image-lightbox__close {',
      '  position: absolute;',
      '  top: -1em;',
      '  right: -0.5em;',
      '  width: 2.2em;',
      '  height: 2.2em;',
      '  margin: 0;',
      '  padding: 0;',
      '  border: none;',
      '  border-radius: 50%;',
      '  background: rgba(0, 0, 0, 0.6);',
      '  color: #fff;',
      '  font-size: 1.2rem;',
      '  line-height: 1;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  cursor: pointer;',
      '  z-index: 1;',
      '}',
      '.image-lightbox__close:hover {',
      '  background: rgba(0, 0, 0, 0.8);',
      '}',
      '.image-lightbox__img {',
      '  max-width: 100%;',
      '  max-height: calc(100vh - 8em);',
      '  width: auto;',
      '  height: auto;',
      '  object-fit: contain;',
      '  display: block;',
      '  border-radius: 4px;',
      '}',
    ].join('\n');
    document.head.appendChild(style);
  },
};
