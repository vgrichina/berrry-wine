# Legacy clipped/depth-occluded projected texture and vertex fog

2026-11-04. Evidence: `scratch/runs/20261104-legacy-clipped-depth-fog/`.
Initial main: `fab45a090276222579c86980a6126a105e538a45`.
Build/test main: `3fc9d35c67958c6ccf9f2115244d448fefaf02d6`.

The bounded clipped/depth composition boundary passes on both shipped software
modules after [0333ca256](legacy-variable-q-fog-20261104.md). This adds a test
and documentation; no production defect or repair was demonstrated. PROJECTED
capability remains unadvertised.

`test/test-legacy-clipped-depth-fog.js` uses the preceding fixture's original
calc PE bootstrap and actual x86 indirect public COM calls. It creates a 16-bit
DDPF_ZBUFFER/DDSCAPS_ZBUFFER surface, attaches it through Surface7 slot 3, and
clears color and depth through Device7. All resource creation, setters, Draw,
and target Lock calls check HRESULT, output guards and stdcall cleanup. No
private raster entry or fabricated COM object supplies the asserted pixels.

Sixteen scenes combine two varying texture-Q fields, unit/varying geometric w,
constant/varying supplied fog alpha, and both submission orders. Each scene
draws two nonsolid-textured triangles under ZENABLE, ZWRITEENABLE and LESS.
The clipped triangle has object z `[-.5,.5,1.5]`; the occluder has constant
object z `.35` and shifted texture coordinates. Projection uses either w=1 or
w=1+.5z. Thus unit-w triangles cross both near and far planes; varying-w
triangles cross the near plane. The farther triangle wins where the first is
clipped away or behind it; it loses elsewhere, regardless of draw order.

The independent reference clips authored homogeneous geometry to `0<=z<=w`,
with a predecessor/current polygon traversal and a fan from the first retained
vertex. It interpolates attributes at intersections, projects them, then
computes screen barycentrics. Texture sampling uses `sum(b U/w)/sum(b Q/w)`
and its V counterpart, wrapping a nonsolid 16x16 point texture. Depth and
supplied fog factors interpolate affinely in the resulting screen triangles;
the latter mix the sampled RGB with `[173,41,219]`. The reference does not
call production transform, clipping, interpolation, sampling or fog helpers.
It retains exact intersection fog factors; two-byte tolerance covers packed
vertex-color quantization. Geometric rhw never incorporates texture Q.

The authored near intersections land exactly at `(16,0)/(0,8)` for unit w and
`(20,0)/(0,14)` for varying w. Unit-w far intersections are integral too. This
isolates composition from the existing software rasterizer's integer vertex
coordinate convention. Samples `(1,1)`, `(16,4)`, `(8,12)`, `(4,22)` and
`(28,28)` include clipped-away/occluder, clipped-texture winner, depth-occluded
and untouched-clear regions. Every scene analytically contains both primitive
winners and clear, and the reference is invariant under reversed submission.

Each module passes 128 positive public draws and 320 RGB observations across
ordinary/indexed and immediate/physical production Node Worker routes. All
complete 32x32 targets agree exactly between routes and reversed orders.
Each queued route replays 32 commands with 16 public Lock fences and zero
fallback. Both production records per scene are inspected: one submitted batch
is held and the other buffered command is retained until Lock. After capture,
public calls disable depth/write, change depth function to ALWAYS, replace the
texture matrix and projection flags, reverse fog enable and replace fog color;
source vertices and indices are overwritten. Both complete command hashes
remain unchanged. Record checks verify original depth/write/LESS/fog state,
matrix, FLOAT2, fog alpha, geometric z/w and 1/w. Both records reach the actual
`lib/d3d-render-worker.js` native Worker; Lock performs the production fence.

Six controls per module preserve successful public Draw and Lock, then fail
specifically at PIXEL ORACLE: depth disabled, near clipping removed, projection
ignored on the clipped primitive, early vertex texture division on that
primitive, its fog disabled, and held matrix replacement. For example, the
first scene at `(16,4)` expects `[115,51,161]`; disabled depth gives
`[109,57,112]`, ignored projection/early division `[115,34,147]`, and disabled
fog `[20,70,65]`. Removing clipping changes `(1,1)` from occluder
`[42,27,57]` to `[130,51,147]`.

Two fixture refinements remain in evidence. The initial reference used a
different fan diagonal, producing a three-byte varying-w fog discrepancy;
specifying the retained polygon fan resolved it. An exploratory fractional
intersection fixture with z `[-.5,.8,.6]` then produced a second-Q texture
mismatch against the continuous geometric reference. That cell does not
establish a composition defect: its fractional geometry requires a separate
reference for integerized raster coordinates. It is unqualified here, not
silently accepted with larger tolerance. The final integral-intersection
fixture passes both Q fields without a production edit. Neither arbitrary
fractional clipping nor all clipping/depth semantics are claimed supported.

Reproduce entirely offline:

```sh
flock /tmp/wine-build.lock bash tools/build.sh
node test/test-legacy-clipped-depth-fog.js
node test/test-legacy-clipped-depth-fog.js --wasm=build/wine-assembly.wasm --out=<run>/normal
node test/test-legacy-clipped-depth-fog.js --wasm=build/wine-assembly.compat.wasm --out=<run>/compat
```

The default invocation checks the analytic plan only. The locked full build,
focused public matrices and existing indexed-texture/second-instance Worker
neighbors pass. Module SHA-256 remains canonical
`78a0b1d61b23428a1ae909d739440ae0de059bbbd84a69a2ad3e4c37471ad664`
and compatibility
`99b579cd17b57f94145df92ae6d28110f24fc284d13a1b2c0ebe3596bd10a77f`.
Recovery records Git SHA, relevant binary diffs, new-file patches and existing
dependency/media/module paths with SHA-256. No gzip input needed restoration;
released large logs use SHA-roundtrip gzip with a recovery mapping.

No Chrome, boat, game runtime, GPU, native Windows, capability restoration,
deployment, source snapshot, tar, module/media copy, npm or subworker was used.
Box ID/state/expiry: not applicable; no box assigned. Runtime shutdown remains
coordinator-owned. The remaining distinct question is fractional-intersection
raster semantics, which requires separately scoped evidence. This assignment
stops at the tested software composition result.
