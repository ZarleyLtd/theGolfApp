// Image Compression Utility
// Resizes + re-encodes an image file to a compressed JPEG before it is uploaded to
// Supabase Storage, keeping payloads small while still legible for scorecard photos.

const ImageCompress = {
  DEFAULT_MAX_WIDTH: 1600,
  DEFAULT_QUALITY: 0.82,

  /**
   * @param {File} file
   * @param {{ maxWidth?: number, quality?: number }} [options]
   * @returns {Promise<{ base64: string, mimeType: string }>} base64 has no data-URL prefix
   */
  compressImage: function(file, options) {
    const maxWidth = (options && options.maxWidth) || this.DEFAULT_MAX_WIDTH;
    const quality = (options && options.quality) != null ? options.quality : this.DEFAULT_QUALITY;

    return this._readFileAsDataUrl(file)
      .then((dataUrl) => this._drawResizedAndExport(dataUrl, maxWidth, quality))
      .catch((err) => {
        console.warn('ImageCompress: falling back to uncompressed file:', err);
        return this._readFileAsDataUrl(file).then((dataUrl) => {
          const parts = dataUrl.split(',');
          const mimeMatch = /^data:([^;]+);base64$/.exec(parts[0]);
          return {
            base64: parts[1] || '',
            mimeType: (mimeMatch && mimeMatch[1]) || file.type || 'image/jpeg',
          };
        });
      });
  },

  _readFileAsDataUrl: function(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  },

  _drawResizedAndExport: function(dataUrl, maxWidth, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / (img.width || maxWidth));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas toBlob failed'));
              return;
            }
            this._blobToBase64(blob).then((base64) => {
              resolve({ base64, mimeType: 'image/jpeg' });
            }, reject);
          },
          'image/jpeg',
          quality,
        );
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = dataUrl;
    });
  },

  _blobToBase64: function(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const commaIdx = result.indexOf(',');
        resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to encode blob'));
      reader.readAsDataURL(blob);
    });
  },
};
