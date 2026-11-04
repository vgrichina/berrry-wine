# Public child mip update: bounded queued Worker WebGL1 coverage

Canonical queued Worker WebGL1 PASS: 25 observations / 21 public draws,
including an acquired child mip overwritten through public Lock/Unlock and
subsequent sampling of its new authored color. Overall execution stopped at
the first failure: the stale-child-upload negative did not inject into the
Worker. Its URL match is repaired and HTTP-tested; the repaired negative has
not run in Chrome. Seven remaining module/backend/version cells are open.
This extends published `460484dc6`, whose direct results remain separate.

`test/test-legacy-public-mip-webgl.js` retains public x86 vtable acquisition,
stdcall/guard checks, five mip dimensions/formats, the independent perspective
LOD oracle, original rendered negatives and three queued held-batch transitions.
It adds exact pitch checks and a before/after observation selecting level 2
of the 16x16 chain using ordinary derivatives and POINT mip selection. The
acquired 4x4 child's public Lock/Unlock overwrites all texels with authored
RGB `[192,48,224]`. A second public lock verifies every persisted pixel,
dimensions, format, pointer and pitch. The new expected color comes only from
the authored inputs and independent oracle. No fixed LOD, production sampler
oracle, Wasm patch or fixture-only export is used; tolerance remains 2.

The stale-upload control wraps the JavaScript executor's `_textureLevel`
only in the served negative script, retaining its first 4x4 decoded generation.
It leaves public guest writes, other mip levels, draws and GL readback active.
The negative must successfully draw, retain the pre-update sampled pixels and
fail the new-color oracle after verified public writes. Browser-free mock
controls check old/new generation discrimination and unaffected other levels.
Production sources are unchanged.

## Exact execution and first failure

Before Chrome, both pinned modules passed public bootstrap and exact HTTP
COOP `same-origin` / COEP `require-corp` checks for the fixture page, actual
module bytes and guest-worker route. Module HTTP bytes matched their full SHA.

| Module | Backend | Explicit version | This run |
| --- | --- | --- | --- |
| canonical | queued Worker | WebGL1 | 25 observations / 21 draws PASS; two old negatives rejected; new negative failed to inject |
| canonical | queued Worker | WebGL2 | unexecuted |
| canonical | direct | WebGL1 / WebGL2 | unexecuted |
| compatibility | queued Worker | WebGL1 / WebGL2 | unexecuted |
| compatibility | direct | WebGL1 / WebGL2 | unexecuted |

The successful cell sampled `[0,0,255]` before overwrite and `[192,48,224]`
afterward. Texture uploads increased from 5 to 6; all 21 draws reached the
legacy WebGL endpoint 1 with 21 fences / 21 readback syncs, zero errors,
fallbacks or native/fallback software draws. Actual Worker VERSION was
`WebGL 1.0 (OpenGL ES 2.0 Chromium)`. All five perspective observations and
three live-state-before-drain held batches passed. Maximum channel error was
0.5 at tolerance 2. Worker GL readback is the production fence/readPixels path;
the unchanged direct fixture additionally calls `gl.readPixels` itself.

The level-zero-only and stale-filter negatives reached successful public
draws and failed discriminating pixels. The new stale-child-upload negative
instead completed 25 observations and 21 draws successfully, so the driver
correctly failed with `negative must fail actual pixels: undefined` and stopped.
The Worker imports `d3dim-gpu.js?v=legacy-texture-public-com`; the tested
custom negative route matched only the unversioned URL. No production stale
upload defect was demonstrated. The final repair matches the parsed pathname
and checks exact injected response bodies and no-store headers for both URL
forms. These cheap controls pass, but the single browser allowance was consumed;
there was no second browser, retry or continued execution after failure.

Chrome 151.0.7922.108 / Node 24.22.1 ran from 04:09:05.766Z to
04:09:10.960Z (5.194 seconds). CDP reports Vulkan SwiftShader/Subzero driver
5.0.0; Worker stats report an Intel UHD 620 ANGLE renderer string. Both exact
reports are retained; physical GPU attribution remains unknown.

## Provenance and recovery

Run: `scratch/runs/20261104-legacy-public-mip-update-worker/`.
Git baseline: `90a03a024b3b8adce7f3510335b44ff4a47dd76f`.
`tested-candidate.patch` reconstructs the browser-tested change;
`source-seal.json` pins all 36 staged inputs. `relevant.patch` records the
final fixture including the browser-free URL repair; the owned note is retained
as a new-file patch. The existing minimal staged runtime was reused; only the
owned fixture and its manifest were uploaded. No source archives or media
evidence copies were made.

- Canonical: 2,143,712 bytes,
  `1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58`.
- Compatibility: 2,146,325 bytes,
  `74b34125e175895dc3ca843ccaa555f934611e3bd676e1e95f25aae9c2e7be66`.
- Existing calc bootstrap:
  `cb71fcc9726f756421519a215c39cf89efd930c9ae0fa5bbb59b64050faef52b`.

Nine unique stable files (including actual modules, capture, results and logs)
were recovered with sizes and full SHA-256. All 36 staged pins remained
unchanged after execution. Browser and driver absence and completed helper
closure were verified before the 04:28Z recovery deadline. The assigned box
`bx_4hx68dxv` is handed back RUNNING/APIidle, healthy/hydrated, expiry
`2026-11-04T04:38:03.251Z`; coordinator retains lifecycle/shutdown ownership.

Validation: final planner/oracle/seam/options and exact HTTP controls PASS;
both-module public bootstrap PASS; predecessor WebGL1 options/planner PASS;
test-tier regression and membership PASS; locked full build PASS with both
module hashes unchanged. Evidence verification independently checks the
executed cell, held batches, public child writes, pixels, module SHA and exact
first-failure scope. No fallback-counter, lifetime, rejected-texture or sampler
detours were performed.

Next: a separately authorized browser attempt must exercise the repaired
stale-upload negative and remaining seven cells. Physical GPU, full27, games,
non-solid mip texels, other formats/padded pitch and other dimensions remain
unknown. No successor task or public deployment was launched.
