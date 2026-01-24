// Gallery Configuration (convention-based)
// Albums = assets/images/Gallery/{year} and assets/images/Gallery/General
// Run scripts/generate-gallery-manifest.ps1 after adding photos.

const GalleryConfig = {
  basePath: "assets/images/Gallery",
  manifestUrl: "assets/data/gallery-manifest.json",

  albumImageUrl: function(albumId, filename) {
    return this.basePath + "/" + encodeURIComponent(albumId) + "/" + encodeURIComponent(filename);
  }
};
