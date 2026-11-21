# Moza Studio V14.9.4 — Responsive Speaker QA

## Automated checks
- JavaScript syntax check for all external JavaScript files.
- JavaScript syntax check for all inline scripts in index.html.
- Static assertions for three device-specific button sizes and icon sizes.
- Static assertions for responsive CSS and editor preview breakpoint selection.
- Backward compatibility: old projects without per-device values fall back to their former global size settings.

## Breakpoints
- Desktop: >1024px.
- Tablet: 641–1024px.
- Mobile: <=640px.

## Not performed
No live authenticated browser or physical-device testing was available. Verify desktop, tablet and mobile Preview and the exported invitation on real devices before production use.
