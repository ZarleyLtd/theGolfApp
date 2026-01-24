# Scripts

## generate-gallery-manifest.ps1

Generates `assets/data/gallery-manifest.json` from the convention-based gallery structure.

**Convention:** Albums = direct subfolders of `assets/images/Gallery/`:

- **Year folders:** `2016`, `2017`, … (one album per year)
- **General:** `General` (photos with no identifiable year)

**When to run:** After adding or moving photos in `assets/images/Gallery/`.  
**How to run:** From project root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\generate-gallery-manifest.ps1
```

**Output:** `assets/data/gallery-manifest.json` (used by the gallery page).
