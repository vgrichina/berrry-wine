# Original DXSDK retained-mode Globe and Viewer, 2026-11-17

Run: `scratch/runs/20261117-dxsdk-globe-viewer-paired-retained-rendering/`.
Product repair published on main: `3ab982f2d` (strict pull and push succeeded).

| Original/backend | Observed result after repair | Motion evidence |
|---|---|---|
| Globe/software | Full textured, faceted sphere; actual software GPU-stream executor | Two whole captures, 41,276 changed client pixels, no input |
| Globe/WebGL | Full textured, faceted sphere; actual WebGL executor | Two whole captures, 13,488 changed client pixels, no input |
| Viewer/software | Original automatically loads its supplied Microsoft model; one whole attached observation shows the extruded word model | **Unproved**: both subsequent runner captures are blank; do not promote executor progress to scene motion |
| Viewer/WebGL | Original supplied Microsoft model, including readable complete extruded word in later capture; actual WebGL executor | Back-facing to front-facing model, 20,978 changed client pixels, no input |

This is a partial paired-motion result. Software Viewer requires a newly authorized original with the inspection viewport correction already prepared; its closed scope is not reopened. No full27, membership census, backend parity, FPS, audio or broad retained-mode qualification claim. Original Oct6 has 37 named candidates; no entries were removed to manufacture 27.

## Demonstrated public lifecycle defect and repair

Both initial Viewer originals exited before a render endpoint or scene, at the same native resize-handler path. The native caller creates a hidden overlapped frame, then initializes its context/device after CreateWindowEx returns, before ShowWindow. The create continuation in `src/09b-dispatch.wat` incorrectly called WM_SIZE/WM_MOVE synchronously for every hidden top-level custom window. The callback therefore entered Viewer resize handling before the caller had initialized its device.

The authored native API counterexample fails on the preceding implementation: after WM_NCCREATE/WM_CREATE, execution enters another callback instead of returning to the API caller. The repaired test returns the HWND first for hidden overlapped windows. Hidden popup creation still calls WM_SIZE/WM_MOVE in order; rejected ANSI/Unicode WM_NCCREATE/WM_CREATE, child creation refusal and teardown negatives remain covered. Existing callback frames, window liveness checks and restoration paths are unchanged. Positioning/show, secondary top-level sizing, child sizing and startup neighbors pass. The historical WordPad comment overgeneralized creation notifications; this is not a WordPad original acceptance claim.

This classification matches the primary [Wine WIN_CreateWindowEx implementation](https://goma.googlesource.com/wine/+/wine-1.3.19/dlls/user32/win.c): ordinary overlapped windows set WIN_NEED_SIZE and skip creation-time size/move; popups and children differ. The affected ordinary Viewer originals were retested by this worker after publishing the repair and now create their device and render the supplied model.

A separate feature-owned, hash-anchored review file records the changed producer without adopting the foreign uncommitted callback registries. The review-chain loader rejects wrong/stale anchors, duplicate entries, unknown producers, invalid hashes and ownership assertions; existing producer-shape and semantic-mutation refusals still apply. General callback ownership remains pending; nonlocal APIs remain disabled.

Validation: `flock /tmp/wine-build.lock bash tools/build.sh` PASS (2,408,676-byte canonical module, no overlapping data segments); focused create-window counterexample/negatives, windowpos-changing, showwindow-secondary-top-size, showwindow-child-size, startup-info-boundaries, callback-ownership-review-chain and callback-ownership-census tests PASS. First locked attempt stopped at the expected review hash; final locked build passed. Canonical build used the shared tree; it was not used as the original runtime module.

## Runtime graph and actual draw path

Initial ordinary scopes used published source `70a680b54bf1f4f62243f6218314cb45610a1bd2` only as abbreviated in their receipts (`70a680b54`); the authoritative full SHA is in `result.json`. Their reused module is SHA-256 `cf674e8d1780249498a3b9797142d5d9f01e9daedcf2089c8fc880f515c753c0`. Repair retests use the single published Git graph `3ab982f2d`, compiled independently in memory without shared WIP: module SHA-256 `06eaa397b64a453ca830b39dad70d63e409bd2f3d2d6bd586687eb0bef541023`, 2,408,432 bytes. The canonical shared-tree module is deliberately different.

Native `d3drm.dll`, `d3dxof.dll` and `oleaut32.dll` are served from existing paths; no executable, model, texture, app config or registered media is changed or copied. Native DLL initialization, original app windows, actual page/guest/render-worker module bytes, `d3dim-gps` endpoint identities and completed GPU executor records are retained. The only served source suffixes are bounded passive executor/presenter observations. Each suffix, base hash and served hash is checked. No legacy replay path, guest mesh injection, private guest calls, input, clock change or forced pump was used. Ordinary startup loads the supplied Viewer model automatically, so File/Open is unnecessary.

Completed executor counts between observations:

| Scope | Executor | DRAW_UP | PRESENT |
|---|---|---:|---:|
| Globe/software | GpuStreamSoftware | 204 → 414 | 101 → 207 |
| Globe/WebGL | GpuStreamWebGL | 1182 → 1924 | 590 → 962 |
| Viewer/software | GpuStreamSoftware | 1363 → 1683 | 680 → 840 |
| Viewer/WebGL | GpuStreamWebGL | 662 → 1507 | 329 → 753 |

These establish nontrivial actual execution, not a frame-rate measurement. Software Viewer execution counts do not repair its missing paired screenshots. The registered sphere reference has 56 vertices and 108 triangular faces, all edges twice and Euler characteristic 2; this is a source structure check, not a claim about an unprovided archive sphere or exact pixel parity. Globe's yellow/black band is preserved; this task does not declare every texture sample correct.

## Capture limitations and closed failures

The first software Globe ordinary scope lacked the native DLL closure in the run-specific server and showed Direct3DRMCreate failure. It was closed and retained as failed, not relabeled a successful preparation. The subsequent initial WebGL Globe scope rendered a sphere in its later image; its earlier image was blank, so that pair does not establish motion. Both initial Viewer scopes exited before scenes. Four serial affected-original repair retests followed the published lifecycle change; all initial failures remain explicit.

The inherited exact-native Device2 literal/pixel/11 ownership controls for both backends and the passed windowed native GetPixel whole-page recipe were reused with hashes. A small authored viewport recipe control also passed. The ordinary whole-page capture deadline remains 3,000 ms, identities are checked around capture and no failed/expired/UNKNOWN scope is replayed. Selected screenshots remain whole images, not crops or frame series.

For software Viewer, the attached inspection helper used Puppeteer's implicit 800×600 viewport. Its whole screenshot shows the model, but the runner's later 1280×960 captures are blank. Console logs record alternating 1280×960/800×600 resizes. Installed Puppeteer BrowserConnector defaults to DEFAULT_VIEWPORT; CdpPage._create calls setViewport when it is non-null. This observer side effect is a concrete capture limitation, not a new native rendering defect inferred from blank pixels. The helper is corrected to `defaultViewport:null`; that correction has not been used to rerun the closed software Viewer original. No ordinary UI actions were sent; the unused UI-action helper was never executed.

## Lifecycle, evidence and next step

Every ordinary scope has a prearmed independent local finite watchdog, native driver wait plus both EOFs, awaited Chromium close, preparation/runtime watchdog waits plus both EOFs, durable enclosing command/watchdog waits, and adopted helper waitpid evidence. Initial failed drivers exit 1; the four repaired drivers, browsers and enclosing scopes exit 0. No remaining scoped processes are reported. Browser closure is an awaited owner shutdown, not a claimed guest File/Quit. No boxes were created: ID null, NOT_CREATED, expiry null, stop receipt N/A.

`validation.json` checks exact Git source pins, passive suffixes, actual modules, 200-response hashes, unchanged media and lifecycle receipts. `result.json` is written last, with artifact hashes, Git SHAs, relevant binary diffs and owned run-input patches. No source archive, media copy, deployment, worker, box or held Sims artifact was created or used. Foreign WIP and live NFS/Caesar/BW2 files remain untouched. /home stayed above the required 1,500,000,000-byte floor in this task's recorded measurements; no RAM gate.

Next: software Viewer paired motion remains open. Use the corrected non-resizing inspection preparation before any newly authorized original; retain the existing closed failures. No further original is launched by this worker.
