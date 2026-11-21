# Moza Studio V14.9.3 — Comments Element Click Fix

## User-visible fix
- The “Ucapan & Doa” launcher is now a semantic `<button type="button">` with a dedicated `data-a="mzcm-add"` action.
- Adding the element no longer depends on the generic `[data-add]` click delegation used by draggable tiles.
- The button supports mouse, touch, keyboard activation, and focus-visible feedback.
- The edit-mode widget root explicitly accepts pointer events so the parent `.el[data-id]` selection handler can select it on the canvas.
- Child form controls remain non-interactive in edit mode, preventing accidental typing/submission while arranging the widget.
- Cache-buster updated to `moza-comments.js?v=14_9_3`.

## Data safety
- No Supabase tables, policies, Edge Functions, Apps Script, or RSVP storage paths were changed.
- No existing project schema or persisted comment data was changed.
