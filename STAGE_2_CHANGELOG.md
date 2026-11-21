# Stage 2 Changelog — Moza Studio × FigCraft

## Version

`Moza_Studio_V14_9_6_FigCraft_Stage2_v1.0.1_WASM_OPT_FIX`

## Fixed in v1.0.1

- Pin Trunk to `0.22.1` and Binaryen `wasm-opt` to `version_131` through `figcraft-source/apps/figcraft-web/Trunk.toml`.
- Remove the Ubuntu apt `binaryen` install that supplied an older `wasm-opt` binary and caused `Unknown option '--enable-bulk-memory-opt'`.
- Keep FigCraft's existing `data-wasm-opt="z"` and required WebAssembly feature flags; optimization remains enabled.

## Added

- GitHub Actions workflow to compile FigCraft WebAssembly using `trunk build --release` and publish the combined static site.
- FigCraft static output is copied from `figcraft-source/dist/web` to the site subfolder `/figcraft/`.
- Lazy-loaded FigCraft iframe entry point in the Moza toolbar and mobile menu.
- Loading, failure, dirty, and saved status UI.
- Same-origin `postMessage` host bridge using FigCraft's `?host=parent` protocol.
- Parent-side validation of both `event.origin` and `event.source`.
- Separate `figcraft:` storage entries for design files and metadata.
- Reopening the last saved FigCraft document after a page refresh.
- Focus routing so Moza's parent-page shortcuts do not capture keyboard/clipboard events while the FigCraft overlay is active; the hidden iframe is non-interactive when Moza is active.
- Confirmation before returning to Moza with unsaved FigCraft changes.

## Preserved

- Moza's original `S`, `ACT`, `store`, renderer, document model, and internal clipboard implementation.
- FigCraft's original Rust/WASM engine and `?host=parent` implementation.

## Not included

- Cross-editor copy/paste or element conversion (reserved for a later stage).
- Changes to the FigCraft Rust source or engine.

## Verification status

- JavaScript syntax check: to be recorded in the Stage 2 report.
- Browser runtime, WebAssembly build, GitHub Pages deployment, real-device touch/keyboard, and save/restore: not claimed until run in their target environments.
