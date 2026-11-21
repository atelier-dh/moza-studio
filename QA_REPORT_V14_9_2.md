# Moza Studio V14.9.2 — QA Report

## Scope

- Responsive RSVP / FAQ sizing
- Canvas zoom and pinch performance path
- Page selection and editing context
- Guest greeting editor and apply flow
- JavaScript / CSS syntax and generated FAQ widget

## Fixes implemented

1. FAQ / Sliding Tabs now stores independent inner-content scales for Desktop, Tablet and Mobile (50–150%, step 5%). The existing device selector chooses which value is edited. Existing FAQ widgets without the new field default to 100%.
2. Isolated FAQ widget iframes receive the active breakpoint through `postMessage` in both the editor and published site. No app API, Supabase credentials, or Apps Script secrets are passed into the iframe.
3. Zoom controls and pinch zoom update the CSS transform and wrapper size without rebuilding the entire canvas DOM on every zoom step/frame.
4. Page switching uses semantic buttons, validates the destination page ID, clears stale multi-selection/group/path/drawing context, and resets the canvas scroll position.
5. Guest greeting shortcut now works in desktop Properties as well as the mobile guest sheet. Insert-token supports either panel. Mobile Done explicitly applies/saves values and refreshes the canvas.

## Automated checks

- All external `.js` files: `node --check` passed.
- Both inline scripts extracted from `index.html`: `node --check` passed.
- Generated FAQ widget test: breakpoint message listener, CSS scale variable, 3 independent device values, default 100%, Desktop initial scale and Mobile message update all passed.
- Source regression assertions: page navigation reset, zoom path, guest shortcut branches, guest apply action, iframe breakpoint marker and FAQ scale controls all passed.
- CSS parser (`tinycss2`): `moza-interactive.css` and generated FAQ CSS parsed with zero parse errors.

## Not completed / must be checked on devices

Headless Chromium in the build environment did not return a DOM even for `about:blank`, so interactive browser automation could not be completed here. This report does not claim a full end-to-end browser/device pass.

Before replacing production, manually test:

- Desktop: Pages list, selecting every page, zoom +/−/Fit, adding/editing/applying a guest greeting.
- Tablet: switch device, change FAQ scale, switch back to Desktop and confirm its scale is unchanged.
- Android Chrome and iOS Safari: pinch zoom, Fit, mobile guest Done, FAQ scale and FAQ accordion/tabs interaction.
- Preview and exported HTML: confirm FAQ scale changes with device width and `?to=NamaTamu` replaces `{{nama_tamu}}`.

## Data / backend safety

No Supabase Edge Function, SQL schema, RSVP database row, Apps Script project, `Code.gs`, RSVP API endpoint, or existing RSVP response data was changed in this revision.
