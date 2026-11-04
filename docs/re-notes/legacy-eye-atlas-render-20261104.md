# Eye-plane mip rendering accepted, opt-in only

The released eye-plane backend and corrected atlas fixture pass the required
bounded real-render acceptance. This publishes the WIP from main
`2d97e23c4d91fc0ff7f8a9f6fa22ac46cdb66324` plus the recorded relevant diff.
Evidence: `scratch/runs/20261104-legacy-eye-atlas-render/`.

The production shader uses original window-homogeneous edge and near/far
halfspaces for eye-plane crossings, rejects a zero XYW determinant, avoids
projecting W=0 clipped vertices, and derives winding from the original XYW
matrix. It preserves rational attributes, depth, original numerator/Q mip
derivatives, integer sample centers, top-left ownership and primitive order.
It remains behind `solidCoverageTransport:true`; no CPU substitute, fixed LOD
or default enable was introduced. The backend SHA-256 remains
`8f83009153d8587b5947fc0bf1f8148e9a69cdac6a3cc545dabbd11751c3c501`.
The fixture includes `texCoordIndex:0`, maps public mip values using `mip-1`
and requests the public atlas route with `clampMipChain:true`.

## Actual rendering

Exactly one Chrome 151.0.7922.108 ran from **06:22:21.062Z to
06:22:33.798Z**, then closed normally. CDP identifies ANGLE/SwiftShader;
this is not physical GPU hardware evidence. No second browser or reload ran.
Actual Puppeteer 24.31.0 require/import, dependency-lock hash, all staged and
HTTP source pins, both retained module isolation checks and real
Device.draw/upload/fixed-compiler preflight passed before browser launch.
Only the small new driver and source seal needed uploading; modules, media
and source dependencies were reused in place after hash verification.

Both WebGL1 and WebGL2 pass **37 grids / 37,888 pixel comparisons each**,
including four rational mip grids per version, W=0 and negative W, near/far
cuts, degenerates, both windings, shared edges, 19-primitive bank crossings,
both orders, alpha, depth, smooth rational color, culling and stencil.
Each version records 56 actual GPU submissions. The independent BigInt
coverage/attribute oracle and public analytic mip oracle retain tolerance 2.
The rounded clipped-edge mutation rejects in both versions at
`zero W direction/false pixel 4,14 actual 0,0,0 expected 255,0,0`.

All eight canonical/compat × Worker/direct × WebGL1/2 public cells pass:
**120 observations**, zero errors and zero fallbacks. Previously accepted
interior/batching controls are referenced in place rather than broadly rerun.
`rendered-validation.log` records the source-pinned acceptance check.
The preflight correctly reports **40 Device.draw calls**, four textures and
filter metadata `[1,1,2,2]`; the earlier handoff's 76-draw description is not
the successful fixture call count. Its three historical mutations reject
(missing coordinate index, unchanged public mip enum, missing atlas route).

The direct browser screenshots show a black canvas because the canvas export
did not retain its drawing buffer; they are not pixel acceptance evidence.
The recorded synchronous `finalRGBA` arrays contain the rendered mip output.
`readpixels-webgl1.png` and `readpixels-webgl2.png` encode those exact arrays
with only row orientation changed for PNG display. Acceptance uses every
synchronous readback comparison, not a screenshot or exported canvas.

## Validation and recovery

Focused transport/batching, exact eye oracle, rounded numerical reproducer,
integer-center interpolation, fixed top-left diagnostic, fixed-plan cache,
fixed-function shader/position types, shader/unsupported cases and backend
validation pass. The required `flock /tmp/wine-build.lock bash tools/build.sh`
passes. Source hashes stayed unchanged through rendering and validation.
No unrelated full-27, performance, gameplay or hardware claim is made.

Unique remote logs/captures were recovered and checked against remote full
SHA-256 before 06:24Z. Git SHA, starting/final relevant binary diffs and patches
for the new note/driver provide source recovery without source archives or
repeated media/module copies. Retained canonical/compat modules and calc media
remain at their pinned existing paths in `source-seal.json`.

The assigned box **bx_vcdyb63z** is left RUNNING (API idle), healthy and hydrated,
expiry **2026-11-04T06:33:43.769Z**. The coordinator owns shutdown. No allocation,
resume, stop/delete, subworker, successor, public deployment or Heroes II run
occurred. This completes the requested rendering-fix publication; broader
hardware/full-suite qualification remains outside this task.
