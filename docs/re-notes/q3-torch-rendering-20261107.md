# Quake III decal presentation investigation — 2026-11-07

Two emulator presentation defects are demonstrated and repaired: GL destination
alpha leaked into opaque Win32 window composition, and the native canvas reader
sampled the restored drawable FBO instead of the presented default framebuffer.
The retained torch close-up itself has **not** been reproduced with owning state;
this repair does not establish that every black shape in that image is erroneous.

Evidence: `scratch/runs/20261107-q3-torch-rendering/` (ignored). The unchanged
original was run once, before the repair, on fresh box `bx_5bnfvuv7`. No guest
binary, configuration, texture, or asset was modified. No post-repair original
or second original was launched. Foreign composition-test edits were preserved.

## Scope and observed route

The earlier `20261107-graphics-fixed-gl-originals/retrieved/progress-quake3-threads/q3t-forward.png`
has three black quadrilaterals near the burning skull torch. Its JSON is a
capture receipt, not a GL-state dump. `world02.png` is the death/scoreboard view.
Neither proves particle alpha, texture incompleteness, or draw-order failure.

The fresh original used standard WASM
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`,
threads, `--headless-gl --png-canvas --real-ticks`, and native GLFW/WebGL on
llvmpipe (LLVM 20.1.2), Node 24.22.1. `launch.py` records the exact command.
Preload `observe.cjs` records actual shader sources, ordered draw vertices,
matrices, texture completeness/alpha histograms, and frontend/backend state.
Additional read-only driver probes record actual uniforms and texture bindings.
Inputs were balanced and captured in the per-control receipts; Q3DM1 gameplay
was reached, but the historical torch viewpoint was not matched.

Firing at a nearby wall produced a black polygon cluster in
`retrieved/original/wall-fire.png`. Its owning draws are indices 25–44 in
`wall-fire-frame.json` (frame 5707, sequences 765905 onward). The recorded
matrices/vertices project onto that cluster; `project-decals.py` and
`projected-decals.json` preserve the calculation. These are decal draws:

| State | Observed value |
| --- | --- |
| Blend | ZERO / ONE_MINUS_SRC_COLOR; enabled |
| Alpha test | disabled |
| Depth | LEQUAL; writes disabled; polygon offset -1, -2 |
| Primary color | white |
| Unit 0 | RGB texture 1292, MODULATE, enabled |
| Texture levels | complete 8/4/2/1 mip chain; all alpha 255 |
| Filtering | LINEAR_MIPMAP_NEAREST / LINEAR; REPEAT |
| RGB samples | corner 1,1,0; center 231,231,231; range 0–231 |
| Unit 1 / fog | disabled |

`decal-driver-state.json` captures the actual translated shader and uniforms,
including `uTextureEnabled=1`, `uTextureFormat=3`, `uPreparedColor=1`, and
`uAlphaEnabled=0`. `binding-ids.jsonl` confirms the expected native texture ID
273 was bound; comparing wrapper object identity initially gave a false alarm.
The texture is neither incomplete nor solid white. Public `glBlendFunc` already
flushes pending draws. No change to shader math, texture upload, alpha testing,
or draw ordering is justified by this evidence.

## Independent regression and repair

`test/test-gl-window-presentation-native.js` executes public GL/WGL calls through
actual x86 thunks, presents through public `SwapBuffers`, and inspects the actual
window compositor canvas. It runs both standard and compatibility WASM. It
checks GL back/front storage separately from presentation, with distinct frames
that reject reading an old/back image.

For RGB source `[64,128,192]` (implicit alpha 255), destination
`[0.5,0.25,0.75,1]`, and ZERO / ONE_MINUS_SRC_COLOR, the independent blend
arithmetic yields approximately `[96,32,47,0]`. GL storage must retain that zero
alpha, while an opaque Win32 window must display `[96,32,47,255]`.

* With both old implementations, even the first opaque reference frame presents
  `[0,0,0,0]`, rejecting the native canvas reader's restored-FBO selection.
* With only native readback repaired and the old alpha-enabled display canvas,
  the opaque reference passes, but the decal presents `[0,0,0,0]` instead of the
  expected colored opaque pixel. This independently isolates display alpha.
* With both repairs, all three reference/decal frames pass on both modules.
  Raw/front alpha stays zero for decals; displayed alpha is 255. The second
  distinct decal is raw `[48,95,32,0]`, displayed `[48,95,32,255]`.

`lib/gl-compat.js` now requests an opaque display canvas. Drawable FBOs continue
to retain alpha for blending, GL readback, and bitmap publication.
`lib/headless-gl.js` reads the default framebuffer when exposing canvas pixels
and restores the previous framebuffer binding afterwards.

The regression rejects old behavior, rather than asserting only implementation
flags. Baseline, isolated old-alpha, final test output, and pixel evidence are
retained as `regression-before.json`, `regression-old-alpha.json`,
`final-tests.json`, and `window-presentation-evidence.json` under `retrieved/`.

## Reproduction, validation, and limits

Runtime source starts at Git `8b1dae070646b7dca5f91ca2f56cdd602e4ba745`;
`runtime-pins.json`, `relevant-source.patch`, and `new-lib_wininit-boot.js.patch`
record the staged runtime and relevant pre-existing uncommitted source. Media is
referenced by existing path and SHA-256 (307 files), never copied into evidence.
Native dependencies are pinned in `native-pins.json` and the effective npm
package files. Initial preflight correctly rejected npm's changed package files;
the effective package pins were recorded before the passing preflight and smoke.
`loaded-modules.jsonl` and `native-loaded.json` identify the actual original route.
Postflight verified all runtime/media/native pins, allowing only the two repaired
source files, with no unexpected changes.

Validation: public native presentation regression (both modules), native GL
smoke, software fragment composition (both modules), queued fragment composition
(both modules), texture-state query, WebGL1/2 bitmap coverage, and the required
locked build. Logs are retained in the run directory. Browser bitmap coverage
also checks preserved RGBA alpha in drawable storage. The first locked build
passed the shake gate but stalled in Node process exit; it was interrupted and
not counted as a pass. The complete build was rerun with `UV_USE_IO_URING=0`;
no guard was disabled. `build-stall.json` and both build logs retain the distinction.

The original terminated normally (return 0), with its process and control port
absent and no runtime browser profile. Evidence was retrieved before the
explicitly delegated normal box shutdown; lifecycle receipts record its final
archived/nonforced state.

Next evidence needed: match the retained skull-torch camera, capture its actual
owning draws and compositor output on the repaired route, and distinguish
intended dark decals from presentation artifacts. This run demonstrates a
reachable emulator mismatch, not a post-fix visual comparison of that torch,
real-Windows parity, performance, or a complete particle/ordering audit.
