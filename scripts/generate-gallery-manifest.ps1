# Generate gallery-manifest.json from assets/images/Gallery
# Convention: albums = direct subdirs (year folders 2016, 2017, ... and General)
# Run after adding new photos. Output: assets/data/gallery-manifest.json

$ErrorActionPreference = "Stop"
$GalleryRoot = Join-Path $PSScriptRoot "..\assets\images\Gallery"
$OutputDir = Join-Path $PSScriptRoot "..\assets\data"
$OutputFile = Join-Path $OutputDir "gallery-manifest.json"

$ImageExtensions = @(".jpg", ".jpeg", ".png", ".gif", ".webp")

function Get-ImageFiles {
    param([string]$Dir)
    Get-ChildItem -Path $Dir -File | Where-Object {
        $ext = [System.IO.Path]::GetExtension($_.Name).ToLowerInvariant()
        $ImageExtensions -contains $ext
    } | Sort-Object Name | ForEach-Object { $_.Name }
}

if (-not (Test-Path $GalleryRoot)) {
    Write-Error "Gallery root not found: $GalleryRoot"
}

$dirs = Get-ChildItem -Path $GalleryRoot -Directory | Sort-Object Name
$albums = @()

foreach ($d in $dirs) {
    $images = @(Get-ImageFiles -Dir $d.FullName)
    if ($images.Count -eq 0) { continue }
    $cover = $images[0]
    $albums += @{
        id = $d.Name
        name = $d.Name
        images = $images
        cover = $cover
    }
}

# Sort: numeric years descending, then "General" last
$yearAlbums = $albums | Where-Object { $_.id -match "^\d{4}$" } | Sort-Object { [int]$_.id } -Descending
$otherAlbums = $albums | Where-Object { $_.id -notmatch "^\d{4}$" }
$sorted = @($yearAlbums) + @($otherAlbums)

$manifest = @{ albums = $sorted }
$json = $manifest | ConvertTo-Json -Depth 4 -Compress:$false

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}
$json | Set-Content -Path $OutputFile -Encoding UTF8
Write-Host "Wrote $OutputFile ($($sorted.Count) albums)"
