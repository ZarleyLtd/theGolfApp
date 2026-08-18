// Scorecard Photo Upload Component
// Reusable button + action-sheet used by both scorecard pages (scorecard.html and
// scorecard-sidescroll.html) to attach a photo of the player's paper scorecard.
// This component only handles UI state (button rendering, camera/gallery pickers,
// the action sheet, and client-side compression). Network calls (upload/remove/save)
// are driven by the page module via the callbacks passed to init().

const ScorecardPhotoUpload = {
  _buttonEl: null,
  _callbacks: null,
  _cameraInput: null,
  _galleryInput: null,
  _overlayEl: null,
  _lightboxEl: null,
  _lightboxKeydownHandler: null,
  _hasImage: false,
  _currentImageUrl: null,

  /**
   * @param {HTMLElement} buttonEl
   * @param {{ onPhotoSelected: (base64: string, mimeType: string, previewUrl: string) => void,
   *           onRemoveRequested: () => void }} callbacks
   */
  init: function(buttonEl, callbacks) {
    if (!buttonEl) return;
    this._buttonEl = buttonEl;
    this._callbacks = callbacks || {};
    this._hasImage = false;

    this._renderButtonContents();
    this._createHiddenInputs();

    buttonEl.setAttribute('type', 'button');
    buttonEl.setAttribute('aria-label', 'View or attach a photo of your scorecard');
    buttonEl.addEventListener('click', () => {
      if (this._hasImage) {
        this._openLightbox();
      } else {
        this._openPickerMenu();
      }
    });
  },

  /** Show a persisted image (signed URL) in the button. */
  setImage: function(url) {
    if (!this._buttonEl || !url) return;
    this._hasImage = true;
    this._currentImageUrl = url;
    const img = this._buttonEl.querySelector('.scorecard-photo-btn__thumb');
    const icon = this._buttonEl.querySelector('.scorecard-photo-btn__icon');
    if (img) {
      img.src = url;
      img.style.display = 'block';
    }
    if (icon) icon.style.display = 'none';
    this._buttonEl.classList.add('scorecard-photo-btn--has-image');
  },

  /** Reset the button back to the placeholder camera-icon state. */
  clearImage: function() {
    if (!this._buttonEl) return;
    this._hasImage = false;
    this._currentImageUrl = null;
    const img = this._buttonEl.querySelector('.scorecard-photo-btn__thumb');
    const icon = this._buttonEl.querySelector('.scorecard-photo-btn__icon');
    if (img) {
      img.removeAttribute('src');
      img.style.display = 'none';
    }
    if (icon) icon.style.display = '';
    this._buttonEl.classList.remove('scorecard-photo-btn--has-image');
  },

  /** Toggle a small spinner overlay on the button while a network call is in flight. */
  setBusy: function(isBusy) {
    if (!this._buttonEl) return;
    this._buttonEl.disabled = !!isBusy;
    const spinner = this._buttonEl.querySelector('.scorecard-photo-btn__spinner');
    if (spinner) spinner.style.display = isBusy ? 'flex' : 'none';
  },

  _renderButtonContents: function() {
    this._buttonEl.innerHTML =
      '<span class="scorecard-photo-btn__icon" aria-hidden="true">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>' +
          '<circle cx="12" cy="13" r="4"/>' +
        '</svg>' +
      '</span>' +
      '<img class="scorecard-photo-btn__thumb" alt="Scorecard photo" style="display:none;">' +
      '<span class="scorecard-photo-btn__spinner" style="display:none;"><span class="spinner"></span></span>';
  },

  _createHiddenInputs: function() {
    this._cameraInput = document.createElement('input');
    this._cameraInput.type = 'file';
    this._cameraInput.accept = 'image/*';
    this._cameraInput.setAttribute('capture', 'environment');
    this._cameraInput.className = 'scorecard-photo-file-input';
    this._cameraInput.addEventListener('change', (e) => this._handleFileChosen(e));

    this._galleryInput = document.createElement('input');
    this._galleryInput.type = 'file';
    this._galleryInput.accept = 'image/*';
    this._galleryInput.className = 'scorecard-photo-file-input';
    this._galleryInput.addEventListener('change', (e) => this._handleFileChosen(e));

    document.body.appendChild(this._cameraInput);
    document.body.appendChild(this._galleryInput);
  },

  /** Take Photo / Choose from Gallery / Cancel — shown when there's no photo yet, or via "Replace Photo" from the lightbox. */
  _openPickerMenu: function() {
    this._closeMenu();

    const overlay = document.createElement('div');
    overlay.className = 'scorecard-message-overlay scorecard-photo-menu-overlay';

    const card = document.createElement('div');
    card.className = 'scorecard-photo-menu-card';

    const takeBtn = document.createElement('button');
    takeBtn.type = 'button';
    takeBtn.className = 'scorecard-photo-menu-btn';
    takeBtn.textContent = 'Take Photo';
    takeBtn.addEventListener('click', () => {
      this._closeMenu();
      this._cameraInput.click();
    });
    card.appendChild(takeBtn);

    const galleryBtn = document.createElement('button');
    galleryBtn.type = 'button';
    galleryBtn.className = 'scorecard-photo-menu-btn';
    galleryBtn.textContent = 'Choose from Gallery';
    galleryBtn.addEventListener('click', () => {
      this._closeMenu();
      this._galleryInput.click();
    });
    card.appendChild(galleryBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'scorecard-photo-menu-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this._closeMenu());
    card.appendChild(cancelBtn);

    overlay.appendChild(card);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this._closeMenu();
    });
    document.body.appendChild(overlay);
    this._overlayEl = overlay;
  },

  _closeMenu: function() {
    if (this._overlayEl && this._overlayEl.parentNode) {
      this._overlayEl.parentNode.removeChild(this._overlayEl);
    }
    this._overlayEl = null;
  },

  /** Full-size view of the current photo, with Replace / Remove actions. */
  _openLightbox: function() {
    this._closeLightbox();
    if (!this._currentImageUrl) {
      this._openPickerMenu();
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'scorecard-photo-lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Scorecard photo');

    const content = document.createElement('div');
    content.className = 'scorecard-photo-lightbox__content';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'scorecard-photo-lightbox__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => this._closeLightbox());
    content.appendChild(closeBtn);

    const img = document.createElement('img');
    img.className = 'scorecard-photo-lightbox__img';
    img.alt = 'Scorecard photo';
    img.src = this._currentImageUrl;
    content.appendChild(img);

    const actions = document.createElement('div');
    actions.className = 'scorecard-photo-lightbox__actions';

    const replaceBtn = document.createElement('button');
    replaceBtn.type = 'button';
    replaceBtn.className = 'scorecard-photo-menu-btn';
    replaceBtn.textContent = 'Replace Photo';
    replaceBtn.addEventListener('click', () => {
      this._closeLightbox();
      this._openPickerMenu();
    });
    actions.appendChild(replaceBtn);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'scorecard-photo-menu-btn scorecard-photo-menu-btn--danger';
    removeBtn.textContent = 'Remove Photo';
    removeBtn.addEventListener('click', () => {
      this._closeLightbox();
      if (this._callbacks.onRemoveRequested) this._callbacks.onRemoveRequested();
    });
    actions.appendChild(removeBtn);

    content.appendChild(actions);
    overlay.appendChild(content);

    const onBackdropClick = (e) => {
      if (e.target === overlay) this._closeLightbox();
    };
    overlay.addEventListener('click', onBackdropClick);

    const onKeydown = (e) => {
      if (e.key === 'Escape') this._closeLightbox();
    };
    document.addEventListener('keydown', onKeydown);
    this._lightboxKeydownHandler = onKeydown;

    document.body.appendChild(overlay);
    this._lightboxEl = overlay;
  },

  _closeLightbox: function() {
    if (this._lightboxEl && this._lightboxEl.parentNode) {
      this._lightboxEl.parentNode.removeChild(this._lightboxEl);
    }
    this._lightboxEl = null;
    if (this._lightboxKeydownHandler) {
      document.removeEventListener('keydown', this._lightboxKeydownHandler);
      this._lightboxKeydownHandler = null;
    }
  },

  _handleFileChosen: function(e) {
    const input = e.target;
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;

    this.setBusy(true);
    const compress = (typeof ImageCompress !== 'undefined')
      ? ImageCompress.compressImage(file)
      : Promise.reject(new Error('ImageCompress not available'));

    compress
      .then((result) => {
        const previewUrl = 'data:' + result.mimeType + ';base64,' + result.base64;
        this.setImage(previewUrl);
        this.setBusy(false);
        if (this._callbacks.onPhotoSelected) {
          this._callbacks.onPhotoSelected(result.base64, result.mimeType, previewUrl);
        }
      })
      .catch((err) => {
        console.error('Failed to process scorecard photo:', err);
        this.setBusy(false);
        if (typeof BriefMessage === 'function') {
          BriefMessage('Unable to process that photo', this._buttonEl);
        }
      });
  },
};
