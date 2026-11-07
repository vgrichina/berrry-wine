# Registered DX samples: November 7, 2026

Run `scratch/runs/20261107-graphics-dx-samples/` adds named coverage for
`dx_globe`, `dx_viewer`, and `dx_flip3dtl`. All three started and rendered in
cooperative and threaded execution with software and WebGL D3DIM: **12 bounded
startup cases, 20 seconds per title/mode/backend**, followed by ordinary-control
observations. No escaped guest trap, unimplemented-API failure, or new
reproducible original-scene rendering failure was found in the accepted runs.
No emulator implementation was changed. The registered Globe's historical band
observation remains open. Historical27 membership remains unresolved.

## Source, closure, and box

One fresh box, `bx_a2jkhpsf`, was created at `2026-11-07T07:58:02.490Z` with a
persisted UUID Idempotency-Key (`boat-create-key.json`). Its original expiry was
`2026-11-07T08:33:02.506Z`. Only one browser/runtime ran at a time. No held-risk
lane was reused, stopped box resumed, or public service deployed.

Git reconstructed source commit
`fe995f4db6d9d1b794f94e0959fd0717bed3cfda`, then applied explicit binary-capable
tracked and new-file patches. Git remains the source archive; no source/media
archive was made. `source.json`, `dirty-source.patch`, and `new-source.patch`
record the shared checkout's tested state. Patch SHA-256 values are respectively
`476714a55e6515fb874d6d1cdac572bd7dede67aeb5892223b770eed9682b29d`
and `fb82c82addff18a7842dea81e108ae591e1d3990991ca15f1ba4f14edb482476`.
This is the tested source identity, independently of this report's later commit.

`runtime-pins.json` records 1,560 paths with size/SHA-256: registered EXEs and
scene files, runtime source, fonts, available shared DLL directory, icons/TLB,
package metadata, and both built modules. All registered lists matched
`20261107-corpus-next-inputs/registered-pins.json`. The ignored
`binaries -> test/binaries` link was reconstructed explicitly. An expanded
166-file icon/TLB inventory was checked against the same Git commit already
reconstructed before launch. Postflight rehashed all 1,560 files with **zero
mismatches**, including unchanged original inputs. Media is referenced by path
and hash, without repeated copies in evidence.

Shared DLL closure matters: Globe/Viewer actually load pinned `d3drm.dll` and
`oleaut32.dll`; their OLE32 imports use the existing builtin route. Imports and
the complete available DLL directory are pinned, rather than assuming the
coordinator's scene lists included them. Loader probes for executable-directory
`d3dxof.dll` return 404 before shared-DLL resolution; raw logs preserve this.

The locked local build passed (`build.log`). Retained modules:

| Module | SHA-256 | Execution evidence |
| --- | --- | --- |
| canonical | `e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467` | Observed compiled/instantiated module and CPU/render-worker module messages |
| compatibility | `04acbb89f66ad9814836b5e2c34de659b518f4e1994f50c4ee8069c991f02f72` | Pinned and retained; not exercised by this Chrome |

Chrome was `151.0.7922.108`, viewport 1100×820, cross-origin isolated, served
only on box loopback. The browser's supplied unsafe-SwiftShader permission did
not determine D3D ownership. Cooperative WebGL records actual D3DIM GPU targets;
threaded WebGL records render-endpoint statistics and context identity. Both
report **ANGLE / Intel Mesa UHD Graphics 620 (KBL GT2), OpenGL 4.6 Mesa 23.2.1**,
WebGL 2.0. Accepted WebGL startup statistics report zero GPU errors/fallbacks.
Software observations have no D3DIM GPU target; threaded guest configuration
records `d3dimGpu:false`. Flip3DTL additionally records software render-endpoint
completion counters and no GL renderer. Globe/Viewer software endpoint counters
are empty, so no draw-count or performance conclusion is drawn from them.

`served-and-module-audit.json` checks 4,149 retrievable HTTP 200 bodies against
the closure with zero mismatches. Another 439 response bodies were unavailable
to Puppeteer's body reader; this is explicitly not complete wire-body hashing.
Direct pre/post file hashes and actual module instrumentation provide the
closure/loaded-module evidence. Optional bundle/auth/build-info/favicon/app-icon
404s and DLL search probes are retained, not silently counted as successes.

## Named observations

| Registered app | Software coop / threads | WebGL coop / threads | Ordinary route and inspected images |
| --- | --- | --- | --- |
| `dx_globe` | Both 20-second starts pass | Both 20-second starts pass | Render menu → Wireframe changes solid textured globe to visible triangle edges in both modes/backends; later images show animation |
| `dx_viewer` | Both 20-second starts pass | Both 20-second starts pass | File → Open Mesh; select exact listed `mslogo.x`; Open; Renderer → Wireframe. Loaded lettering and wireframe geometry are visible in all four cases |
| `dx_flip3dtl` | Both 20-second starts pass | Both 20-second starts pass | Original Windows-textured cube, HAL-labelled window/HUD, changing orientation. Software additionally receives ordinary F7 down/up and visibly shrinks the cube |

Accepted startup artifacts are `recovered/startup4-webgl-*` and
`recovered/startup-software-*`, with raw console/guest logs, state snapshots,
10/20-second PNGs, response receipts, and trial results. Control artifacts are
`controls2-webgl-*` (five trials), `controls-webgl-dx_globe-coop` (the sixth
visually successful route), and `controls-software-*` (six). Images were
personally inspected, including all twelve final startup images, Globe menu /
wireframe views, Viewer loaded / wireframe views, and Flip3DTL rotation / F7
before-after views. Native browser input, trusted event observations, paired
press/release acknowledgements, and final released mouse state are preserved
where recorded in `actions.jsonl` and snapshots. The earliest Globe control
trial predates the action-receipt extension; its native input observations and
captures remain available.

These are the registered scene files. Globe retains registered `sphere3.x`
(56 vertices / 108 faces, SHA-256
`bb8bd85a4f13ef27777690295264f7f2475b3b4bb4e936e3b3394ee08c05360f`).
The separately named archive Globe's 296-vertex / 588-face mesh and viewport
fix are outside acceptance. Viewer opens the original registered `mslogo.x`
(SHA-256 `bbe967bbe686d5b3bc25979b70abf2d8ce6aea4b821f4ced9ca59d7902a6727d`)
through its ordinary file dialog, not a replacement fixture/configuration.
The focused Viewer selection regression's synthetic fixture is supporting test
evidence only. Flip3DTL's historical Frame04211 is not an exact-frame requirement;
no displayed FPS figure is treated as measured performance.

No software/WebGL frame parity is claimed. Captures at equal wall time have
different animation progress. No change was inferred from those differences,
and aligned-callback parity was not established. The historical Globe band
remains visible; [the earlier trace analysis](dx-sdk-d3drm-samples.md#october-31-globe-texture-band-diagnosis-and-original-mesh-limit)
records original-texture bands, valid RGB565 texels, 108 primitives and matching
per-triangle wrap UVs. This run neither changes that diagnosis nor claims the
band fixed.

## Tests and bounded investigation

The four supplied route tests were inspected before choosing inputs. Three
focused tests executed on the reconstructed box passed:

- `test/test-d3dim-globe-render-menu.js`: all 11 menu items and point/wire/solid rendering.
- `test/test-d3dim-viewer-selection.js`: ordinary selection behavior in its explicit regression fixture.
- `test/test-d3dim-flip3dtl-render.js`: original textured cube regression.

The additional unchanged `test/test-d3dim-texture-wrap.js` **failed** in its GPU
recording fake, after its software assertions passed. The fake has a 16-bit
target whose `device` implements only `draw`; current `_submitImmediate` also
calls `_storeNative16`, which requires `device.gpu.gl`. The failure is an
undefined synthetic GL device, not an escaped API/trap in a registered scene.
Its raw stack and test log are retained. No shared source/test was edited.

A run-local diagnostic, `texture-recording-control.cjs`, bypasses only
`_storeNative16` while asserting that the target has no `device.gpu`, then runs
the original test unchanged. It passes the existing software, descriptor-field
33, WRAPU/WRAPV/WRAP0 and GPU per-triangle coordinate assertions. This isolates
the recording-fixture incompatibility; it does **not** test native16 storage or
turn the unmodified test into a pass. The documented wrap contract under test
is short-seam interpolation, independently per triangle and enabled U/V axis;
no observed contract violation justifies an implementation repair here.

An early Globe control assertion also incorrectly expected checked bit 4 from
`menu_child_flags`; it returned 0 although the captured renderer visibly
switched to wireframe. The harness assertion was removed only for subsequent
run-specific observations; raw failure and successful images remain. This is
not reported as an emulator fix. An implementation change would need a
reproducible original failure and old-failing regression first.

Initial picker/provisioning trials are preserved separately: hidden app-picker
options prevented initial launch; missing ignored `binaries` link caused the
first three `startup3-webgl` launches to return 404. Only complete clean
`startup4-webgl` and software batches count as startup coverage. Read-only
retrieval encountered HTTP 500 and one hash mismatch while an active log grew;
completed evidence was subsequently recovered from the running box with fresh
read-only requests. No unknown guest input was replayed and no stop/resume was
used to recover it.

## Recovery, cleanup, and next work

`final-02-inventory.json` / `final-02-verified.json` record 404 recovered evidence
files, 13,792,616 bytes, SHA-256 verified. This includes unique captures, raw
logs, failed test output, terminal phase records, and `postflight.json`. Earlier
partial retrieval attempts are retained and are not the authoritative final
inventory. Source patches and both modules are retained separately locally.

Postflight found all 42 recorded browser/server PIDs absent, no active run
processes, all eight server ports closed, all 34 attempted trial browsers
closed, and no trial profile directories. Only after verified recovery, the
explicitly delegated **normal nonforced stop** completed at
`2026-11-07T08:17:00.728Z`. Final box state is `archived`, stop operation
`stop_12c3924caa965bc0` completed, forced=false (`boat-final-state.json`). No
runtime ownership remains to hand back. Local free disk remained above 2 GB.

Next useful work is to repair the narrow recording-test fixture separately,
and, if investigating Globe further, capture the registered scene's draw stream
at aligned animation callbacks against a documented/native reference. Do not
replace its mesh to obtain acceptance. No candidate-corpus manifest entry was
found for these three registry IDs; this is investigation evidence with no
unrelated candidate attachment, full27, audio, FPS, or native-parity claim.
