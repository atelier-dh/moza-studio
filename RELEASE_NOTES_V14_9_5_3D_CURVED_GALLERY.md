# Moza Studio V14.9.5 — Responsive 3D Curved Gallery

## User-facing changes
- Added a dedicated `3D Curved · perspective flow` Carousel style.
- Added a one-click `3D Curved` preset for existing Carousel elements.
- Added a `3D Curved` action in Gallery properties to convert a Gallery into the effect.
- Kept the original `Digital Haus · Continuous` effect as a separate option.
- 3D curved cards use perspective depth, side-facing rotation, and side emphasis while retaining continuous horizontal motion and drag/swipe interaction.
- Added controls for card spacing, center size, side size, 3D depth, 3D tilt, side darkness, speed, and direction.
- The Gallery-to-Carousel conversion now records effective geometry separately for Desktop, Tablet, and Mobile instead of using only Desktop geometry.
- Existing Gallery photos are preserved in the carousel slides; the original Gallery element is retained in `a329Originals` and can be restored through the existing restore action.
- The runtime recomputes the curved layout from the rendered carousel container size, so card dimensions follow the active responsive viewport.

## Compatibility
- Existing Carousel styles are unchanged.
- Existing Continuous Flow remains available and unchanged in behavior.
- Existing projects without `arc3d` properties receive defaults at render time.
- No Supabase schema, Edge Functions, RSVP data, Apps Script, or comment data changed.

## QA
- All external JavaScript files and inline JavaScript blocks pass Node syntax checks.
- Static checks confirm the new style, runtime branch, Gallery action, Carousel preset, and breakpoint geometry persistence.
- Behavioral smoke tests cover responsive geometry capture and arc scaling/depth calculations.
- Real-device/browser interaction testing is still required after installation.
