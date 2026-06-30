# Brief message (this project)

This project uses the shared CursorSites **brief message** pattern.

- **Canonical spec:** [`../../cursor-sites-shared/ui/BRIEF_MESSAGE.md`](../../cursor-sites-shared/ui/BRIEF_MESSAGE.md)
- **Synced utility:** [`../assets/js/utils/brief-message.js`](../assets/js/utils/brief-message.js)
- **Synced styles:** [`../assets/css/brief-message.css`](../assets/css/brief-message.css) (imported from `style.css`)

## Example in this project

**Handicap history** (Edit Player dialog): clicking a row calls `BriefMessage.show(text, rowEl, { durationMs: 4500, multiline: true })`.

**Scorecard**: `BriefMessage('No Score entered', saveBtn)` on save no-ops.
