# Dependent legacy native framebuffer draws

Evidence: `scratch/runs/20261105-legacy-dependent-alpha16/`. This follows
[the single-draw alpha16 repair](legacy-alpha16-target-20261105.md).
The test found two emulator defects; the coverage gap alone was not evidence
of either defect.

## Contract and public route

`FRAMEBUFFER_DEPENDENT=1 node test/test-legacy-framebuffer-blend-web.js` uses
the existing actual x86 public COM harness. Both shipped modules create their
Surface7, Device3 and Viewport3, check unchanged blend caps, and submit
DrawPrimitive3/DrawIndexedPrimitive3 through software, direct WebGL and the
actual owning queued Worker. Device7 creation is probed, but rendered calls
use Device3. Targets are A1R5G5B5, A4R4G4B4, X1R5G5B5, RGB565, A8R8G8B8 and
opaque X8R8G8B8.

Each independent pair initializes its surface once, submits two overlapping
public draws with distinct asymmetric colors and alphas, and reads all 64
final native pixels with one final public Lock. There is no intermediate
Lock, readback, clear, Blt or injected color upload. The depth/scissor control
clears only depth before either draw. GPU sync/upload counters are exactly
one final readback and one initial upload per pair. Worker delivery is held
until both immutable draw packets have been inspected; later setters change
the live blend factors before release. The second partial packet is flushed
by starting the final Lock after both draw calls, then the Worker drains.

The independent oracle derives channel widths/shifts from the public masks,
retains high bits at each store, and expands native values by bit replication.
It applies the RGBA blend equations after every primitive. The first draw
uses SRCALPHA/INVSRCALPHA; the second uses DESTALPHA/INVDESTALPHA,
DESTCOLOR/INVDESTCOLOR or SRCALPHA/INVSRCALPHA. Selected native16 vectors give
the identical stored result for every floor/ceil byte alternative at each
operation; native16 comparisons have zero tolerance. The 32-bit controls
allow one byte for normalized framebuffer arithmetic. This declares the
bounded emulator storage contract, not universal historical hardware rounding.

Native16 cases include two overlapping triangles inside one public draw and
same-state draws merged by the GPU adapter. Depth/scissor cases preserve
untouched pixels and retain the first draw when the later, farther draw fails
depth. Negative controls execute real successful COM draws and compare their
pixels with deliberately wrong independent alternatives: stale whole
destination, stale destination alpha, quantization only at the final result,
and quantization only between public calls. These are rejected alternative
oracles, not injected renderer failures or independent native Windows runs.

## Baseline and causal changes

The source baseline is `c97b57f90ce1e5500e617790f4346ad5ebb6ff9f`. Its relevant
test patches, production JS hashes, exact module identities and pixels are
retained. `baseline2/result.json` completed both modules, six targets and
three routes before the first renderer edit: 54 pairs, with all 24 native16
GPU pair observations wrong. Every wrong result matched deferred final-only
quantization. Software and 32-bit controls passed that initial matrix.
For example, an A1 dependent result required `(49,156,206,255)` but returned
`(90,132,181,255)`; an A4 stored alpha required 238 but returned 221.

The GPU held RGBA8 between draws and reduced it to native16 only on readback.
`lib/d3dim-gpu.js` now stores the native high bits on the GPU after each
canonical primitive, including within batched public draws. It copies color
to a scratch GPU texture and draws bit-replicated native values back. It does
not read pixels to the CPU, upload replacement pixel data, clear the target or
write depth. Backend-owned texture/program/buffer resources are destroyed with
the device. Tracked raster state, viewport and color mask are restored;
backend failures remain strict and caps are unchanged.

Expanded repeated-primitive software RGB565 witnesses then exposed a separate
existing destination decode defect. `software565-baseline/result.json`
reproduces three mismatches per shipped module before changing that WAT path,
including green 65 instead of 69. The old branch zero-extended 5/6-bit channels
instead of replicating their low bits. The software blend now uses the existing
declared-format decoder for RGB565 as well as the other native16 formats.

The baseline modules are SHA-256:

| Module | Baseline | Repaired |
| --- | --- | --- |
| standard | `3d59cca0579d2ccfdec1561d7403c371af771943f6c8385ce814eacb008c6821` | `a971c7d471dd1a83288c88aadb6fe123a39e584b101a1393466cbe5ca52fdcbb` |
| compat | `05949f1fd23f5e911db1550e691446f306de39230f5c0014fa796687b67254c2` | `6f189196d4c2294cb2b7a4c6771b3096e79d9fc536d87199305a647315235510` |

All four unique modules are retained under `modules/`. Git plus recorded
binary diffs recovers source; no source tree or media archive was created.

## Validation and limits

`regression-final/result.json` passes 36 module/target/route cases, 174 draw
pairs, 11,136 final native pixels, 348 public draws and 5,060 public COM call
records. It rejects 102 negative controls and includes 60 pairs with repeated
primitives, 24 depth/scissor pairs and 40 merged draws. GPU errors and fallbacks
are zero. Representative compatibility A4 Worker baseline and repaired captures
were personally inspected; alpha correctness comes from native pixel values,
not the opaque screenshot display.

Both GPU routes report WebGL 2.0 / Chromium OpenGL ES 3.0 and ANGLE Intel UHD
620 (KBL GT2), Mesa 23.2.1 OpenGL 4.6. Chrome is 151.0.7922.108 and closes
normally. Launch flags requested SwiftShader; the reported Intel renderer is
the actual retained identity. No SwiftShader result is claimed for this matrix.

The original single-draw suite also passes both modules across all seven
original targets and three routes. Focused unit tests cover indexed textures,
batching, point lowering, depthless Z/lines, async Flip, fallback counters and
draw tracing. The fake point/line targets now explicitly check the new
per-primitive storage boundary while retaining geometry/state assertions.
Required locked full builds pass; exact commands and logs are retained.

The actual bounded-readback WebGL neighbor passes. Three other neighboring
checks have reproduced baseline failures: viewport-background yields the same
missing gradient and byte-identical capture on old/repaired standard modules;
the caps excerpt fixture cannot locate `gl_texture_combine` with either Git
HEAD's original or repaired core; the WebGL point fixture fails A1 alpha
parity in case 8 on both original/repaired GPU JS. All 20 first-version point
pixel arrays are identical between those two runs (four A1 cases disagree with
the software point oracle). That fixture stops at WebGL1's first assertion,
so it does not establish WebGL2 point parity. These independent paths were not
repaired in this task. Their logs, pixel arrays and baseline wrappers remain
in the run. Final cleanup is recorded in the run investigation metadata. Intermediate fixture failures are retained separately: held Worker
partial-batch timing, candidate selection and initial depth setup were corrected
before the final successful matrix. They are not attributed to the renderer.

The GPU repair adds a copy and fullscreen storage pass per native16 primitive;
performance has not been benchmarked. Native Windows parity, game behavior,
other formats, dithering and a general hardware qualification remain outside
this result. No games, boxes, crash lanes, subworkers or public deployment were
used. Box ID/state/expiry are not applicable.

The ordered AoW2, Aranna and Conan predecessor FINAL gate was independently
checked before runtime at 23:57:57.973661Z. One heavy local runtime was used at
a time, with hard deadline 00:42:57.973661Z. Process/port/profile/lock cleanup
and the published main commit are retained in this run; the next worker must
verify that cleanup before taking the runtime.
