# Changelog — Moza Studio × FigCraft Stage 2.1

## v1.0.4 — Step 1 diagnostic and deployment-path correction

- Kept the pinned `storytold/craft-fonts` revision and `CRAFT_FONTS_REQUIRED=1` strict web-font build.
- Added `cargo clean -p figcraft-text` before Trunk so a restored pre-font Cargo cache cannot keep an empty font catalog.
- Changed font verification and static assembly to use the absolute Trunk output path under `figcraft-source/dist/web`.
- Added a `figcraft-embedded-fonts` meta marker to the built FigCraft page after the strict font build succeeds.
- Added final-artifact checks to ensure `/figcraft/index.html`, the font marker, `figcraft-fonts.json`, and a non-empty `*_bg.wasm` are present before GitHub Pages upload.
- Fixed licence collection to remain idempotent when a licence file already exists.
- Updated Moza diagnostics to derive the FigCraft URL from the Moza project directory and inspect the actual same-origin iframe document and loaded WASM resource.
- A missing JSON diagnostic manifest is no longer incorrectly treated as proof that embedded fonts are missing when the HTML marker and WASM are valid.
- A GitHub Pages 404 page inside the iframe is detected immediately when `#figcraft_canvas` is absent, instead of leaving the loading spinner until timeout.
- Preserved Trunk `0.22.1` and Binaryen `wasm_opt = "version_131"` from v1.0.1.
- No Rust engine, Moza core state/store/renderer/element model, or internal clipboard changes.

### Not included in v1.0.4

- Mobile initial-screen and FigCraft compact-header changes (Step 2).
- Moza mobile top-toolbar horizontal scrolling and compact Design Editor button (Step 3).
- Cloud B2 modal layering and scrolling fix (Step 4).
- Cross-editor copy/paste.

### Verification

JavaScript syntax, YAML parsing, workflow shell syntax, fixture-based font manifest generation, and fixture-based static-site assembly passed locally. The real Rust/WASM build, GitHub Actions deployment, MIME response, and real-device text rendering remain untested until the patch is committed and deployed.

## Preserved from v1.0.2 / v1.0.3

- Pinned font checkout and strict embedded-font build.
- Clean workflow with no Git merge-conflict markers.
- Trunk `0.22.1` and Binaryen `version_131`.
- Same-origin `/figcraft/` static-site assembly and GitHub Pages deployment.
