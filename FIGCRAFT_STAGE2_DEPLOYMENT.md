# Moza Studio × FigCraft — Stage 2 Deployment Guide

## What this package changes

- Moza remains the parent Web Builder.
- FigCraft remains the original Rust/WebAssembly application.
- FigCraft is built by GitHub Actions and published at `/figcraft/` on the same site.
- Moza loads the FigCraft iframe only when **Design Editor** is opened.
- The parent and iframe use FigCraft's documented `?host=parent` protocol.
- `.figcraft` and `.json` document files are stored separately from the Moza project JSON, using `figcraft:` keys through Moza's existing `store` abstraction.
- Non-document exports (PNG, SVG, PDF, etc.) are downloaded normally by the parent page.
- No copy-paste conversion is included in Stage 2.

## Required repository layout

Upload/extract this package into the root of one GitHub repository. Keep the layout below:

```text
repository-root/
├── index.html
├── moza-*.js / moza-*.css
├── moza-figcraft-integration.js
├── moza-figcraft-integration.css
├── .github/
│   └── workflows/
│       └── build-deploy-figcraft.yml
└── figcraft-source/
    ├── Cargo.toml
    ├── Cargo.lock
    ├── apps/
    ├── crates/
    └── packaging/
```

The workflow expects the GitHub default deployment branch to be named `main`. If your branch has another name, change `branches: [main]` in `.github/workflows/build-deploy-figcraft.yml` to that branch.

## Activate GitHub Actions and GitHub Pages

1. Create a new GitHub repository, or open the repository where Moza will live.
2. Extract this ZIP on your computer. Upload the package contents (not the ZIP file itself) to the repository root. The `figcraft-source/` folder is required; it contains the Rust source that GitHub Actions compiles.
3. Commit the files to the `main` branch.
4. In GitHub, open **Settings → Pages**.
5. Under **Build and deployment → Source**, select **GitHub Actions**. Do not select “Deploy from a branch” for this workflow.
6. Open the repository's **Actions** tab. Select **Build and deploy Moza Studio + FigCraft** and choose **Run workflow** if the first push did not start it automatically.
7. Wait for both the `build` and `deploy` jobs to finish with green check marks.
8. Open the Pages URL shown in the deployment job. Moza is at the site root; FigCraft is at the same site's `/figcraft/` path.

The workflow installs Trunk `0.22.1` and runs `trunk build --release` from `figcraft-source/apps/figcraft-web`. The app's `Trunk.toml` pins Binaryen `wasm-opt` to `version_131`; Trunk downloads and caches that exact tool when the system tool is missing or has a different version. This avoids accidentally using an older Ubuntu apt `wasm-opt` that does not recognize FigCraft's `--enable-bulk-memory-opt` feature flag.

For web text rendering, the workflow also checks out `storytold/craft-fonts` at the FigCraft release-pinned revision `37827adc41fd165f9a9234ac40f94dbad353aa69` and builds with `CRAFT_FONTS_DIR` plus `CRAFT_FONTS_REQUIRED=1`. It runs `cargo clean -p figcraft-text` before Trunk so a restored cache cannot reuse a previously generated empty font catalog. The required flag makes a missing font checkout or required face fail the build instead of silently producing a WebAssembly app without its document-text fonts. Font bytes are embedded into the WASM at compile time; they are not separate `.ttf` files in `dist/web`. The workflow writes `figcraft-fonts.json`, inserts a `figcraft-embedded-fonts` meta marker into the generated FigCraft `index.html`, checks the WASM filename, and copies the relevant OFL licence texts into `figcraft/font-licenses/`. It uses the absolute output path `$GITHUB_WORKSPACE/figcraft-source/dist/web` and verifies the exact final `/figcraft/` artifact before upload. The existing `Trunk.toml` writes to `figcraft-source/dist/web`; the workflow copies that output into the published site's `figcraft/` directory.

## GitHub Pages MIME type and headers

FigCraft requires `.wasm` responses to use `Content-Type: application/wasm`. GitHub Pages supports MIME types from its MIME database, including supported WebAssembly types, but it does not provide per-repository custom HTTP response headers. The workflow therefore cannot force a custom MIME type on GitHub Pages. Check the deployed `.wasm` response in browser DevTools → Network → select the `.wasm` request → Headers. It must show `application/wasm`.

GitHub Pages also does not process Apache `.htaccess` or Cloudflare/Netlify `_headers` rules. The workflow includes those sample files in `/figcraft/` for compatible hosts, but they are ignored by GitHub Pages. If a host serves `.wasm` with the wrong MIME type or you need custom cache headers, use a host/CDN that supports header rules (for example Cloudflare Pages with `_headers`, Netlify, or an Apache/Nginx server).

FigCraft's own hosting guide says the hashed `.wasm` and `.js` assets should be cacheable as immutable, while `index.html` should be revalidated. The copied `_headers` and `.htaccess` files contain those sample rules for hosts that support them.

## Same-origin requirement

Do not put FigCraft on a different domain or a different origin. The intended URLs are:

- Moza: `https://YOUR-SITE/.../`
- FigCraft: `https://YOUR-SITE/.../figcraft/?host=parent`

The path may differ (for example, GitHub Pages project sites include `/repository-name/`), but the scheme, hostname, and port must match. The iframe URL is resolved relative to the Moza page, and the host bridge rejects messages unless both the origin and iframe source match.

## Storage notes

The integration writes design files separately from `atelier:p:<project-id>`:

- `figcraft:index:<project-id>` — saved design metadata.
- `figcraft:last:<project-id>` — ID of the last opened/saved design.
- `figcraft:file:<project-id>:<file-id>` — the file bytes encoded as Base64 in a separate storage entry.

The Base64 data is not inserted into the Moza project's main JSON. This keeps Moza's existing project payload and renderer untouched. The existing Moza `store` chooses its available backend (server KV, `window.storage`, or IndexedDB). A browser-only GitHub Pages deployment normally uses IndexedDB; it does not provide Moza's optional `/api/kv/` backend. Browser storage is per browser/profile and can be cleared by the user, so export/backup remains important.

## What is intentionally not included

- No cross-editor copy/paste or element conversion.
- No changes to the FigCraft Rust/WASM engine.
- No changes to Moza's `S`, `ACT` core definitions, store implementation, renderer, element schema, or internal clipboard logic.
- No cloud sync service for FigCraft documents beyond the storage backend already selected by Moza's `store`.

## Build fix: Binaryen / wasm-opt version

The release build must retain FigCraft's `data-wasm-opt="z"` optimization and feature flags. Do not install the Ubuntu repository's `binaryen` package as a global `wasm-opt` for this workflow: an older binary can fail with `Unknown option '--enable-bulk-memory-opt'`. The fixed package pins `wasm_opt = "version_131"` in `Trunk.toml`, and Trunk downloads that exact compatible tool. The workflow pins Trunk `0.22.1` so the tool-version configuration is supported.

## Troubleshooting

- **FigCraft is blank or stays on loading:** verify `/figcraft/index.html` exists and the workflow deployed the `figcraft/` folder. Check the browser console and the `.wasm` Network response.
- **Text layers exist but their text is invisible:** check that the workflow checked out the pinned `craft-fonts` repository and that `CRAFT_FONTS_REQUIRED=1` was present on the Trunk build step. The Moza host inspects the same-origin FigCraft iframe's embedded-font meta marker and the actual loaded WASM resource. `figcraft-fonts.json` is a diagnostic fallback, not the font payload; its absence alone does not prove that the embedded fonts are missing. The host warns when the required marker/faces are missing, the WASM resource is not found or returns 404, or the WASM MIME is not `application/wasm`.
- **WASM MIME error:** the `.wasm` response must be `application/wasm`. GitHub Pages cannot be given custom per-repository headers; use a header-capable host if its default MIME is wrong.
- **Host bridge does not connect:** Moza and FigCraft must share the same origin. Do not use a separate subdomain for FigCraft.
- **Save fails:** check IndexedDB quota or the configured KV backend. The integration reports a storage error instead of marking the file saved.
- **FigCraft does not start on a browser:** FigCraft requires a current browser with WebAssembly SIMD and WebGPU or WebGL2. Try a current Chrome, Edge, Firefox, or Safari version; the FigCraft runtime selects its supported GPU backend.

## Stage 2 smoke test

Use the checklist in `STAGE_2_INTEGRATION_REPORT.md` after the GitHub Actions deployment has completed. Source-level checks are not a substitute for testing the deployed site on Desktop, Tablet, and a real phone.
