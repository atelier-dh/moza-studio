# QA Report — Moza Studio V14.9.5

## Scope
Restore/add the curved 3D photo-carousel effect shown in the supplied reference and retain it across Desktop, Tablet, and Mobile.

## Automated checks
- Node syntax check: all 35 external JavaScript files.
- Node syntax check: both executable inline JavaScript blocks in `index.html`.
- Static assertions:
  - `arc3d` appears in the Carousel style selector.
  - Gallery Properties exposes a `3D Curved` action.
  - Carousel Properties exposes a `3D Curved` preset.
  - Runtime routes `arc3d` through the continuous drag/swipe layout.
  - Responsive Gallery conversion saves `x/y/w/h` overrides for Tablet and Mobile.
  - Published Carousel markup adds the perspective-flow class.
- Behavioral smoke tests:
  - Desktop/Tablet/Mobile bounding boxes are independently retained.
  - Side-card scale grows relative to center-card scale.
  - `arcDepth: 0` and `arcTilt: 0` are honored.

## Manual verification still required
- Apply the 3D Curved action to a Gallery in the Moza editor.
- Check Desktop, Tablet, and Mobile editor previews.
- Verify drag/swipe and continuous movement in Preview.
- Export HTML and test on real Android/iOS browsers.

## Data safety
No Supabase, SQL, RSVP, Apps Script, or Google Sheets code was changed.
