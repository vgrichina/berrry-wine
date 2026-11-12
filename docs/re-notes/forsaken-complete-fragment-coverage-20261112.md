# Forsaken: complete natural draw and actual GL sampling, 2026-11-12

No renderer mismatch is proved. A fresh natural additive submission has complete
coverage and actual texture sampling evidence: its center pixel was already
white before the draw, and white is the bounded result for every possible depth
outcome. This explains that submission's white pixel. It does **not** explain
how historical GPU24138 first became white, or replace that witness with a claim
about the same draw.

Parent: [texture and target provenance](forsaken-texture-target-provenance-20261112.md),
commit `aae90a9d0`; final1735 source/remaining-witness pins are reused.
Evidence directories, both gitignored:

- `scratch/runs/20261112-forsaken-complete-fragment-coverage-1815/` (analysis and controls).
- `scratch/runs/20261112-forsaken-complete-fragment-coverage-1815-live/` (one fresh lifecycle).

## Historical witness: what is actually retained

Inspection of final1735 `remaining-witness.json`, tick70, and emitted boundary
observer finds **count180**, not the complete 5,760 vertex bytes. Only the four
covering triangles13,17,18,21 were serialized. The other56 triangles cannot be
reconstructed from these records. GPU24337/texture210 remains excluded; the
closed620 selector/1142 restore proof was not repeated.

The current pinned POSITIONT shader offsets screen position by0.4375; the
selected pixel therefore evaluates the original triangle at320.0625,240.0625.
The pinned 16bpp `_submitImmediate` submits each triangle separately and calls
`_storeNative16` after each. That store rounds RGBA8, takes the565 high bits,
and bit-replicates them into the next RGBA target. A sum of ideal bilinear
contributions is consequently insufficient to predict the final native pixel.

`oracle-result.json` uses the actual pinned shader/backend in local Chrome,
the retained four vertex records and16 known decoded texels, on separate scratch
targets. Unknown texels filled with either0 or255 produce the same selected
pixel. Actual source-on-black RGB results are64,64,63;64,64,63;46,27,10;29,19,12.
If all four pass depth, native red evolves41→107→173→222→255; the last blended
red251 becomes255 at the565 store. Thus ideal red243.469 is not a defect.

That all-pass case is conditional. The retained preceding opaque24137 triangle332
covers the selected pixel, has z vertices0.80767578,0.81119841,0.81332654,
ZWRITE enabled, LESS, and no recorded alpha/key/cull discard. Its correct depth
would reject additive17/18/21 (z approximately0.8162/0.823/0.8171).
The actual-GL reconstruction of opaque332 followed by a **color-only** clear to
observed41,166,189 leaves107,231,255 after the four retained additive triangles.
These are scratch reconstructions, not observed historical intermediate pixels.
Later omitted triangles remain a possible explanation. No production fix follows.

## Complete fresh witness

The new run-local observer selects one natural640×480,16bpp,256×128 texture,
ONE/ONE additive submission with ZWRITE disabled and at least four inclusive
center coverings. It records all vertices, all original per-triangle color
readbacks, state, viewport/scissor, and the already-uploaded keyed GL texture.
No guest writes/calls, blend override, debug draw on the original target, extra
fence, or forced batch flush is used. After the original draw, a temporary
framebuffer reads the existing keyed texture; framebuffer binding is restored
and the temporary framebuffer deleted. No texture is replaced or reuploaded on
the original target. The original receiver/arguments/return/error are preserved.

Normal VOLCANO gameplay, after a short forward approach and primary-fire pulse,
produced source command**22284/5**, texture generation**d3dim44**,14 triangles,
42 vertices/**1,344 retained bytes**. This is a different natural submission from
GPU24138. The source texture entry is131840960, DIB476553216, pitch512; target
entry131805408, DIB471527424. Addresses identify only this execution.

`natural-witness.json.gz` retains the complete draw. Its full131,072-byte uploaded
RGBA texture equals the decoded cache byte-for-byte, SHA256
`1676c8476888538d4227a25d6ccffc68f56ad713ae1868e0603b796cf046b29d`.
Repeat U/V, linear min/mag and mip0 are retained. No live filename/gamma/Load
kind23 expansion was needed for this witness; historical SMLEXPL provenance is
not asserted for this different full generation.

`natural-oracle.cjs` runs every retained triangle through the actual pinned
shader/backend and uploaded pixels on a separate local GL target. The renderer
matches the original run: Intel UHD620, ANGLE/Mesa23.2.1, WebGL2, subpixelBits4.
The analytic inclusive candidate list and actual GL source-on-black coverage
agree exactly:

| Triangle | Interpolated z (analytic) | Actual GL source RGBA |
| --- | --- | --- |
| 1 | 0.6004319034 | 192,192,192,255 |
| 2 | 0.6451031039 | 0,0,0,255 |
| 6 | 0.7851300093 | 64,64,54,255 |
| 8 | 0.6082895687 | 2,1,1,255 |
| 11 | 0.6779905401 | 64,64,62,255 |

All other nine source-on-black results are0,0,0,0. The black covered triangle2
is distinguished from a missing fragment by its alpha255. These are GL
measurements, not ideal bilinear estimates. Analytic z does not claim exact
GPU depth quantization or pass status.

The original pre-draw pixel, every triangle's before/afterBlend/afterNative,
and the final pixel are255,255,255,255. Actual observed depth state for every
triangle is enabled LESS, write false, range0..1, target depthBits16.
The oracle tests each passing fragment against its actual original incoming
white pixel, then applies the pinned565 store: every result remains white.
A rejected fragment also preserves white. Induction in original triangle order
therefore bounds the final pixel to exactly white even over the conservative
superset of all**16,384** independent pass/reject assignments. Actual fixed-depth
visibility permits fewer assignments; no assumption about ideal depth arithmetic
is required. Saturation means individual pass/reject outcomes remain **UNKNOWN**.
This is a rigorous color bound, not a measurement of the original depth buffer.
`complete-analysis.json` records the complete candidates and verification.

## Qualification, evidence and lifecycle

Before box allocation the final emitted observer passed real-Chrome full-target
passivity (baseline/observed SHA identical; original input bytes unchanged), four
return/error identity cases including observer failure, actual full CPU bootstrap,
and actual full GPU bootstrap. See `fragment-control-result.json`,
`fragment-identity-result.json`, `actual-guest-worker-full-bootstrap-ready/`, and
`actual-d3d-render-worker-full-bootstrap-frozen/`. The frozen1,553-file import gate
and stale-pin negative passed. Existing final1735 attach/private translator,
Execute/selection,19-field identity, ACK/readiness and prearmed independent
release helpers were reused by SHA; `helper-parent-pins.json`,
`live-frozen-control-reuse.json`, and `qualified-observer-controls.json` bind them.

The pinned source commit is `5ed39acacdf6a48e2eda7e2efb864f5e229d1aac`;
normal actual CPU and GPU module SHA remains
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
Original media was referenced by existing path/SHA. No source/media archives or
production changes were made. Relevant source Git SHA and binary patches are
retained. This docs-only result needs no production build/regression run.

An actual local free-disk reading1,441,419,264 stopped allocation before any
provider request; after shared cleanup a fresh reading above1.5GB permitted
continuation. Native allocation/input used actual free-disk checks, no RAM gate
or host reserve change. An initial local lifecycle attempt collided with an old
local-control watchdog receipt and failed **before create-attempt/provider API**;
its actual terminal receipts are retained. A fresh sibling lifecycle directory
avoided that collision without replaying a provider mutation.

Box**bx_n95a3zj9** was created18:26:21Z with an observable independent two-hour
watchdog prearmed, initial expiry20:26:20.600Z. Normal quit18 was acknowledged.
Chrome and remote browser parent both have actual exit0 and separate stdout/
stderr EOF. Recovery verified576 unique outputs twice by independent signed GET
and local SHA, then separately recovered/verified the late outer-parent receipt:
**577 paths,42,619,466 raw bytes**. Nineteen complete captures have exact matching
19-field identities, original PNG SHA checks, and unchanged normal04 CPU/GPU.

The original local lifecycle caller ended143; its own child/owner wait was not
observed and is **UNKNOWN**. The independent durable owner survived. Its actual
manager wait0, watchdog wait0, stream EOF and custodyComplete receipts are
retained; the manager also actually waited its independent deadline watchdog0.
The browser cleanup marker conservatively says pending UNKNOWN/never replay;
all submitted command IDs0..18 have ACK, and no command was replayed.

Normal delegated stop completed18:39:44.317Z, receipt
`stop_d6ecc2224908e622`, forced=false, error=null. Verified final state**archived**,
expiry**null**, in `stop-confirmed.json`. No box is left running for this task.

## Exact remaining historical witness

To explain historical GPU24138's transition from41,166,189 to white requires its
missing full180 vertices plus original per-triangle color/depth visibility and
its existing full uploaded generation, in unchanged target/depth context. Those
historical bytes cannot be recovered from final1735. A future fresh witness
intended to explain **first whitening** must select an unsaturated incoming
pixel (or passively retain the preceding whitening submission), rather than
infer depth visibility from saturated color. This run closes full coverage and
sampling for one natural draw, but does not close that historical transition.
