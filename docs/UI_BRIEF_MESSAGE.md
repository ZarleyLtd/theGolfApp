# UI pattern: Brief message

Ephemeral, non-blocking feedback shown near the control the user interacted with. Adapted from [theConfessional](https://github.com/) `showInfoMessage` / `showClaimedByOtherMessage` in `assets/js/pages/claims.js`.

## When to use

- Confirm or explain something on **click** or **tap** without opening a modal or alert
- Show detail that would clutter the main UI (e.g. adjustment **reason** on a history row)
- Short status text that should disappear on its own (~1 second)

## When not to use

- Errors that need user action → use the existing admin alert banner or a modal
- Long text or forms → use a modal or expandable section
- Persistent state → update the page inline instead

## Implementation

Utility: [`assets/js/utils/brief-message.js`](../assets/js/utils/brief-message.js)

```javascript
BriefMessage.show('Historical import 2020: R1 - Elmgreen', rowElement);
// optional third argument: { durationMs: 1500, placement: 'above' | 'below' }
```

## Behaviour

1. Creates a fixed-position element with class `brief-message`
2. Positions it above the anchor element (flips below if there is no room at the top)
3. Sets `role="status"` and `aria-live="polite"` for screen readers
4. Removes the element after **1000 ms** by default (`durationMs` override allowed)
5. `pointer-events: none` so it does not block clicks

## Styling

Classes live in [`admin/society-admin.html`](../admin/society-admin.html) (or shared CSS if reused elsewhere):

- `.brief-message` — container (dark semi-opaque pill, shadow)
- `.brief-message--above` / `.brief-message--below` — vertical placement relative to anchor
- `.brief-message__text` — message copy

## Example in this project

**Handicap history** (Edit Player dialog): each row shows date/year, outing, adjustment, and resulting index. Clicking a row calls `BriefMessage.show(adjustment.reason, rowEl)`.
