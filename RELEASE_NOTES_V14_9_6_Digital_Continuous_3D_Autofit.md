# Moza Studio V14.9.6 — Digital Haus Continuous 3D Auto-Fit

## Design correction
This release does not introduce a separate carousel frame or replace the Digital Haus Continuous layout.
It adds a new visual effect mode (`arc3d`) on top of the existing Digital Haus Continuous carousel structure.

## Preserved from Digital Haus Continuous
- The same `.car` / `.car-track` / `.cs` slide markup.
- The existing frame shape classes (`rounded`, `rect`, `circle`, `arch`, `hex`, `blob`, `polaroid`, `film`).
- The same frame ratio, width, border, radius, shadow and image-fit controls.
- The same smooth continuous scrolling, drag/swipe, loop, pause behavior and visible-video handling.
- The existing ResizeObserver-based layout recalculation.
- The existing Desktop/Tablet/Mobile bounding-box mapping stored on `flow.bp`.

## New 3D effect
- Adds a curved horizontal perspective treatment using `translate3d`, `rotateY`, depth and scale.
- Side cards recede and turn inward while the center remains the visual anchor.
- Curve rise, depth, tilt, center/side scale and spacing can be tuned in the inspector.
- The 3D effect reuses the Digital Haus frame; it does not create a different frame component.
- 3D track uses `preserve-3d`; overflow is kept visible inside the track and clipped by the outer carousel.
- `object-fit` now respects the existing Photo fit selector (`cover` / `contain`).

## Auto-fit improvements
- Frame width and height are calculated from the live carousel container.
- The selected frame aspect ratio is preserved when height constraints require scaling.
- The entire source bounding box (x, y, width, height) is proportionally scaled when a breakpoint viewport is narrower than the original source box.
- ResizeObserver recalculates the card geometry when the canvas/container changes size.

## Files
- `index.html` — runtime, inspector and effect conversion changes.
- All other V14.9.5 project files retained.

## Backend impact
No Supabase schema, Edge Function, RSVP data, Comments data, Apps Script, or Code.gs changes.
