# Golf Club Images Library

## Directory Structure

This directory contains images for golf clubs used in outings.

## Naming Convention

Images should be named using the **GolfClubName** from the Outings data, normalized as follows:

1. Convert to **lowercase**
2. Remove or replace **spaces** with hyphens (`-`)
3. Remove special characters (keep only letters, numbers, hyphens)
4. File extension: `.jpg` or `.png`

### Examples

- Golf Club Name: `Powerscourt Golf Club` → `powerscourt-golf-club.jpg`
- Golf Club Name: `Corballis Links Golf Club` → `corballis-links-golf-club.jpg`
- Golf Club Name: `Newlands` → `newlands.jpg`

## Default Image

- `default.jpg` - Used when no specific image exists for a golf club

## Image Loading Logic

The frontend will:
1. Extract the `GolfClubName` from outing data
2. Normalize it: `golfClubName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')`
3. Try to load: `assets/images/clubs/{normalized-name}.jpg`
4. If not found, fall back to: `assets/images/clubs/default.jpg`

## Adding Images

1. Save your golf club image as `{normalized-club-name}.jpg` in this directory
2. Ensure the image name matches the normalization rules above
3. Recommended image size: 800x600px or similar aspect ratio
4. File format: JPG or PNG

## Testing

To test if an image will load correctly:
1. Check the `GolfClubName` value in your Outings data
2. Normalize it using the rules above
3. Verify a file with that name exists in this directory
