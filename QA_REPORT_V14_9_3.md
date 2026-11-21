# Moza Studio V14.9.3 — Targeted QA Report

## Scope
- Ucapan & Doa add-element launcher clickability.
- Canvas selection of an existing Ucapan & Doa element in edit mode.
- Edit-mode protection of the widget child form controls.

## Source changes
1. Replaced generic draggable `div[data-add="comments"]` with a semantic button using dedicated `ACT['mzcm-add']`.
2. Added handler that creates `newEl('comments')` and calls `addEl(...)`, which uses the existing editor selection and Properties flow.
3. Changed edit-mode pointer behavior: widget root accepts pointer events; descendants remain pointer-disabled. The canvas `.el[data-id]` ancestor can therefore receive pointerdown and run normal element-selection logic.
4. Added accessible label, keyboard-native button behavior, focus-visible state, touch manipulation and cache-busting.

## Automated checks
- `moza-comments.js`: Node syntax check.
- All external JavaScript files in package: Node syntax check.
- Inline JavaScript blocks in `index.html`: Node syntax check.
- Static assertions: launcher is a button, dedicated action exists, handler calls `newEl('comments')` and `addEl`, edit root has `pointer-events:auto`, child controls remain disabled, cache-buster updated.

## Limits
The environment cannot interact with the authenticated Moza browser session or physical device touch hardware. This report does not claim live end-to-end click testing on Android/iOS/desktop. Verify after install:
1. Open Elements → click Ucapan & Doa once; one widget should be added.
2. Click the widget body on canvas; right Properties panel should show Ucapan & Doa controls.
3. Inputs inside the widget should not accept typing in Design mode.
4. Open Preview; the public form should be interactive there.

## Backend
No Supabase schema, Edge Function, RSVP data, Google Apps Script, or Code.gs changed.
