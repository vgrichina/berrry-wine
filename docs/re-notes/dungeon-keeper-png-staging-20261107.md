# Dungeon Keeper PNG staging repair, 7 November 2026

The missing Node encoding dependency is repaired in the run-only staging recipe.
The production Canvas2D binding and original input driver remain unchanged.
No original game, boat allocation, native input, guest/configuration/clock edit,
held-risk retry or public deployment occurred. Original gameplay remains untested.

Evidence and runnable helpers are retained in
`scratch/runs/20261107-dungeon-keeper-png-staging/`. The predecessor original
failure is documented in `dungeon-keeper-repaired-canvas-gameplay-20261107.md`;
the released binding is documented in `dungeon-keeper-canvas-binding-20261107.md`.

`stage.cjs` adds pngjs **7.0.0**, using its Node entrypoint `lib/png.js`.
It recursively follows every literal local require, allows Node builtins,
rejects external package dependencies, and checks that every shipped library
module is covered. The closure is **24 files / 65,014 bytes**: 22 library
modules, `package.json`, and `LICENSE`. There are no external runtime packages.
The async modules are required by the public entrypoint even though this binding
uses synchronous encoding. Browser bundles, development dependencies and package
installation are unnecessary. Every file has a SHA-256 and byte length.

`original-runtime-pins.json` demonstrates the augmentation: all **619** original
pins remain identical and the completed deployment manifest contains **643**
files. This is a manifest recipe check, not a claim that today's changed checkout
still matches that historical runtime. Fresh original staging must verify its
own immutable source/media pins before upload and again at the destination.
Existing game media is referenced by path and hash; none was copied here.

The focused test stages only the small Node driver import closure. It uses the
retained original browser adapted to the existing installed `dx_ddex4` SDK sample,
serving the actual production index/host/Win98Renderer/guest Worker from the
checkout without copying the website or media. Test-only changes select this
sample, supply its expected executing module pin, serve that explicit web root,
decode the returned PNG, and exit immediately after the first capture. No prior
capture/input fixture matrix executes. `prepare.cjs` records these adaptations;
production binding bytes are copied unchanged into the stage.

Before staging pngjs, this actual driver passed strict readiness and immutable
owner readback, then failed at encoding with `MODULE_NOT_FOUND: pngjs` and closed
its chain. After adding the closure, the staged production binding completed
`requestImmutableCapture({hwnd})`, encoded and decoded its actual output.
`deployment-manifest.json` covers all **39** small staged driver/dependency files;
SHA/length verification passed before execution and afterward. Both launches use
`--no-global-search-paths`, empty `NODE_PATH`/`NODE_OPTIONS`, and a preloaded resolver
which rejects every nonbuiltin JavaScript resolution outside the isolated root.
The recorded successful cache contains all **22** pngjs modules inside that root,
with zero external resolutions; checkout node_modules cannot satisfy the missing
package. HTTP serving of the production website is explicit and separate from
Node module resolution.

I reviewed `immutable.png`: three red sprites over a blue perspective
checkerboard, black side borders and the caption “Press F12 to Exit.” Decoded
output is **684×480**, 81 RGBA colors, with RGBA SHA-256
`8cf7e3772a4c3c97b0bd0f10d2105021746b026298cdd75f5e0c086953c5d366`.
The selected guest window is 640×480; the output includes presentation borders.
The capture metadata retains the selected process/window and publication.
Page and guest executing modules both hash to
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
This is the observed binary identity, not a fresh-build assertion.

The strict live owner/module/window/epoch comparisons, naturally advancing
publication, timestamp-before-readback freshness, exact reviewed immutable hash,
numbered ACK transport, independently scheduled UP and sticky UNKNOWN/no replay
semantics are unchanged. No input command was submitted in this staging test.
Both browsers exited with code 0; owned Node/Chrome PIDs were absent and profiles
removed. No box was assigned: box ID/state/expiry and lifecycle handback are N/A.
The existing one-second browser disk guard remained active; no floor event was
recorded, and completion free space exceeded 3.6 GB. The locked build passed.
Syntax, isolated capture regression, decode, dependency completeness, manifest
verification and owned evidence checks passed. A post-capture assertion had a
local variable-shadowing error; it was corrected and existing artifacts were
verified without rerunning either browser. The global evidence checker retains
its unrelated historical errors; this run introduces no containment error.

For the separately authorized next original attempt, use this exact augmentation
on that attempt's freshly pinned base manifest, before the existing upload loop.
`NEXT_RUN` is that successor run's repository-relative path; `DEPLOY_ROOT` is
its isolated runtime root. Preserve `owned.patch` with the run: it reconstructs
the small run-only helper sources, while Git SHA and relevant binary patches
identify production sources without archiving the tree. Commands:

```bash
node scratch/runs/20261107-dungeon-keeper-png-staging/stage.cjs \
  "$NEXT_RUN/runtime-pins.base.json" "$NEXT_RUN/runtime-pins.json"
```

The upload loop must iterate **the augmented `files` array**, read bytes from the
checkout, and verify SHA/length before transfer as the retained allocator does.
At the isolated deployment root, before starting Chrome, run the same helper
(copied as a small run-specific input):

```bash
node stage.cjs --verify "$DEPLOY_ROOT" "$DEPLOY_ROOT/$NEXT_RUN/runtime-pins.json"
cd "$DEPLOY_ROOT"
BROWSER_DEADLINE="$FRESH_IMMUTABLE_DEADLINE_MS" CASE_TAG=original \
  node "$NEXT_RUN/browser.cjs"
```

`--verify` checks every deployed manifest entry, recomputes the complete pngjs
closure, and proves `pngjs` resolves from the deployed binding into that root's
node_modules. Preserve the original registered `dungeon_keeper_demo` route and
retained browser/transport/input files; the sample driver adaptations are solely
for this bounded regression. Set a new immutable deadline only for the new
explicitly authorized runtime, preserve its disk guard and lifecycle ownership,
and review fresh immutable original pixels before any native input. The PNG
staging repair is complete; no original runtime was started here.
