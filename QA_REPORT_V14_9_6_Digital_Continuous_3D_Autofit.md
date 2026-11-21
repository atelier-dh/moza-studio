# QA Report — Moza Studio V14.9.6

## Automated checks performed
- JavaScript syntax: all 35 external `.js` files passed `node --check`.
- Inline JavaScript: both inline script blocks in `index.html` passed `node --check`.
- Static integration assertions:
  - `arc3d` is registered as a Carousel style.
  - Gallery effect action `a329-photo-arc` remains available.
  - `arc3d` uses the same `.car` / `.car-track` / `.cs` structure as Digital Haus Continuous.
  - The runtime shares the continuous branch and ResizeObserver.
  - `flow.bp.t` and `flow.bp.m` are populated from source element geometry.
  - The 3D track preserves 3D transforms and does not get inline `overflow:hidden`.
  - Visible video handling treats `arc3d` as a continuous strip.
  - Existing frame fit selector is respected through `object-fit:var(--fit,cover)`.
- Geometry checks:
  - Auto-fit preserves the frame aspect ratio when constrained by container height.
  - Breakpoint fit scales x/y/width/height together when the source width exceeds the device viewport.

## Manual tests still required
This build has not been tested in the user's authenticated Moza session or on physical devices. Verify:
1. Select Gallery or multiple images → Gallery Effects → Continuous 3D Curve.
2. Confirm frame shape and Photo fit settings can be changed in Properties.
3. Switch Desktop / Tablet / Mobile and confirm the gallery stays inside the canvas without distortion.
4. Preview/export and test automatic movement, mouse drag, and touch swipe.
5. Test with 1–5 photos (runtime clones only in preview/publish) and with 6+ photos.

## Safety
No Supabase, SQL, RSVP, Comments, Apps Script or Google Sheets backend code changed.
