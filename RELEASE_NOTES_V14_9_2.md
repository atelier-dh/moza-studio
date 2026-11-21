# Moza Studio V14.9.2 — Responsive FAQ & Editor QA

- FAQ / Sliding Tabs: independent Desktop, Tablet and Mobile inner scale (50–150%).
- FAQ scale is synchronized to the active breakpoint in the editor and published site via postMessage to the sandboxed iframe.
- Zoom / pinch: transform-only updates; no full canvas DOM rebuild per zoom step.
- Pages: semantic page buttons, validated target, stale selection/group/path context cleared on page switch.
- Guest greeting: desktop shortcut, mobile/desktop token insertion, explicit mobile apply/save.
- No Supabase, SQL, RSVP backend, Apps Script, Code.gs, or existing RSVP data changes.

See `QA_REPORT_V14_9_2.md` for automated checks and manual acceptance steps.
