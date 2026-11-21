# Stage 2.0.1 — Fix GitHub Actions wasm-opt error

## Root cause

The supplied GitHub Actions log shows Rust/WASM compilation finished, then Trunk called `/usr/bin/wasm-opt`. The installed Ubuntu Binaryen version did not recognize `--enable-bulk-memory-opt`, which FigCraft passes from `apps/figcraft-web/index.html`. This is a tool-version mismatch, not a Rust compilation failure.

## Patch

1. Pin Trunk to `0.22.1` in `.github/workflows/build-deploy-figcraft.yml`.
2. Pin Binaryen in `figcraft-source/apps/figcraft-web/Trunk.toml` with `[tools] wasm_opt = "version_131"`. Trunk uses the pinned tool and downloads/caches it when the system `wasm-opt` does not match.
3. Remove `sudo apt-get install binaryen`; that was putting the older system `wasm-opt` on PATH.
4. Keep `data-wasm-opt="z"` and the original feature flags. Optimization remains enabled.

## What was not changed

- No Rust source, engine, renderer, document model, or FigCraft host bridge changes.
- No Moza `S`, `ACT`, `store`, renderer, element model, or internal clipboard changes.
- No copy-paste integration was added.

## Apply the fix

1. Download and extract the new `Moza_Studio_V14_9_6_FigCraft_Stage2_v1.0.1_WASM_OPT_FIX.zip`.
2. Upload/replace the package contents in the root of the same GitHub repository. Keep `.github/workflows/` and `figcraft-source/` paths intact.
3. Commit the changes to `main`. A push should start the workflow automatically.
4. Open **Actions → Build and deploy Moza Studio + FigCraft**.
5. Confirm the build log selects/downloads `wasm-opt version_131` and then completes `Build FigCraft WebAssembly application`.
6. Confirm both `build` and `deploy` jobs are green before testing `/moza-studio/figcraft/`.

## Verification status

The patch files were inspected and archive/config syntax checks are performed when packaging. A fresh GitHub Actions run, deployment, MIME response, and browser runtime test are not claimed until the user runs the workflow.
