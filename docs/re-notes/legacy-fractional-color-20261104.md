# Fractional clipped colour: reproduced defect, exact-packing blocker

2026-11-04. Evidence: `scratch/runs/20261104-legacy-fractional-color/`.
Initial Git: `be8b46aab93b0e205dd64196d1304b5b32976933`.

**No production change is published.** A four-byte diffuse placement error is
reproducible independently of accepted texture repair `9422cf64c`. A candidate
plane repair removes that error but fails two exact-byte controls. Its patch
and failures are preserved; production source is restored byte-for-byte to
main. The next condition is an independent finite-precision clipping/packing
reference that resolves those cases without changing coverage, packing rules
or tolerances.

## Before editing

Both shipped modules reproduce a public Draw/Lock failure: z `[-.5,.8,.6]`,
geometric w `1+.5*z`, forward order, pixel `(16,4)`: actual `[108,51,133]`,
independent homogeneous geometric reference `[104,51,131]`. All four public
x86 COM routes reproduce it: ordinary/indexed, immediate/physical production
Node Worker. Stage zero selects DIFFUSE, bypassing texture sampling entirely.

`before-normal/` and `before-compat/` preserve 120 scenes, 240 draws and 840
selected RGB observations per route, with 92 oracle disagreements per route.
These are characterization results, not conformance passes. Initial shipped
module SHA-256, existing paths, media SHA and Git are in
`initial-provenance.json`:

- canonical `018c94ffbde8c857587c25c860db988d603d0662df9a18901f00c183af7493cd`;
- compatibility `4e684af48e4ec06ae8aada0d5cd2b522345a7a51b8ed89988d4d8fa0d75ea7c2`.

The predecessor's old/new texture witnesses were read and verified against its
recovery map's compressed and decompressed SHA-256. Existing paths/hashes are
in `predecessor-witnesses.json`: old `[130,34,161]`, repaired `[115,34,147]`
at `(8,12)`, on both modules. No archive was expanded or module copied.

## Reference and conventions

[Microsoft's Gouraud description](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/bb153356(v=vs.85))
specifies linear colour interpolation. The legacy
[D3DPRIMCAPS contract](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/d3dcaps/ns-d3dcaps-_d3dprimcaps)
describes subpixel colour placement and interpolation of specular-alpha fog.
[D3DCOLOR](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dcolor)
is a four-byte colour. These sources do not mandate exact intermediate clip
rounding and cannot establish every ideal-real oracle byte as required output.

The existing implementation uses packed `0xAARRGGBB` TL colours, f32
interpolation/truncation at generated vertices, then affine screen-space
Gouraud interpolation. Specular alpha supplies affine fog. Texture `Q/w` and
geometric `1/w` are distinct from this colour field. Nonzero specular RGB is
supplied as a sentinel with SPECULARENABLE explicitly disabled; additive
specular RGB is not qualified or repaired.

The new test independently constructs homogeneous geometry from authored
positions/z/w, clips against z>=0 and z<=w, packs intersection colour/fog bytes,
projects the fan and evaluates barycentrics at integer sample centres. It uses
no production projection, clipping, plane, span, colour or sampler helpers.
The continuous geometry and truncating clip-byte reference remain fixed.
RGB tolerance is zero. Tiny arithmetic epsilons only stabilize mathematical
integers in the JS reference; they never permit an observed byte discrepancy.
Characterization records failures without granting conformance.

Public controls establish bounded distinctions:

- Unclipped sample `(1,1)` is geometrically `[24,50,87]`; the half-centred
  alternative differs. Constant `[64,96,128]` checks channel ordering.
- Candidate independently clipped, explicitly packed XYZRHW controls reproduce
  the baseline forward XYZ witness at `(16,4)`, with unit/varying w and fog
  on/off. Restored production has an additional fogged explicit-TL difference:
  `[154,45,189]` versus authored XYZ `[154,45,188]`; characterization records
  this separately instead of asserting an unsupported equivalence.
- Constant colour/fog targets agree completely under reversed/cyclic order.
  Changing texture Q leaves complete DIFFUSE-only targets identical.
- Real GREATER alpha tests exercise varying diffuse alpha. Candidate rendered
  constant-diffuse, fog-off and alpha-off negatives disagree after successful
  public Draw and Lock calls.
- Held Worker records retain depth/write/LESS, Gouraud, fog, alpha-test,
  specular-off, matrix, FLOAT2, z/w, 1/w, colour bytes and order after state and
  source/index mutations. Command hashes are unchanged; fallback count is zero.

Winding invariance is not assumed. At the main sample, reversed/cyclic varying-w
geometric reference `[100,54,133]` differs from forward `[104,51,131]`.
Intersection byte packing can change unit-w fans by a byte; homogeneous clipping
followed by affine screen interpolation also changes varying-w fan fields.
Each order has its own oracle. Reverse-order image differences alone do not
prove incorrect interpolation.

## Causal calculation

The primary fan has projected P=`(0,208/11)`, R=`(224/13,0)`, B=`(32,0)`,
with packed RGB P=`[37,84,145]`, R=`[96,44,116]`, B=`[224,40,176]`.
At `(16,4)`, barycentrics `[11/52,5/8,17/104]` give unquantized channels
`[104.442308,51.807692,131.942308]`, hence `[104,51,131]`.

The old raster rounds P/R/B to `(0,19)/(17,0)/(32,0)`. Row-4 edges at
13.421053 and 25.263158 snap to 13 and 25 while retaining their edge colours,
packed to `[83,52,122]` and `[184,49,169]`. Interpolation at
`(16-13)/(25-13)=1/4` produces exactly `[108,51,133]`. The analytic test
asserts this causal alternative separately from its oracle.

## Rejected candidate and blocker

The candidate evaluates RGBA planes through floating clipped TL vertices at
integer samples, retaining clip packing and coverage, and uses floating fog
geometry for explicit TL draws. An initial f32-gradient variant passed 132
scenes but failed an expanded integral far control. Undivided f64, f64 with
existing f32 packing, and undivided f32 were subsequently characterized against
the unchanged reference. No rounding bias or wider tolerance was introduced.

The final undivided-f32 candidate still disagrees at two samples on every
ordinary/indexed, immediate/physical Worker route:

| Scene, varying geometric w | Pixel | Actual | Geometric reference |
| --- | --- | --- | --- |
| z `[-.5,.8,.6]`, cyclic `[1,2,0]` | `(16,4)` | `[99,54,133]` | `[100,54,133]` |
| z `[0,4,0]`, reversed `[0,2,1]` | `(5,6)` | `[46,62,116]` | `[46,62,117]` |

`undivided-f32-normal/` preserves all four routes. The additional public
`precision-isolation-{normal,compat}-{false,true}.json.gz` controls isolate
these cases on both candidate modules, immediate and physical Worker:

- The cyclic near sample remains `[99,54,133]` with explicit TL vertices.
- The integral far XYZ sample is `[46,62,116]`; the explicit TL control is
  `[46,62,117]`.

Thus the ideal homogeneous oracle does not isolate every finite-precision
effect of projected TL storage, clipping and byte conversion. Biasing packing,
enlarging tolerance or changing the oracle to obtain acceptance is unjustified.
The candidate is not ready for main. `candidate-undivided-f32.diff.patch` and
`candidate-provenance.json` record its exact Git base, source/module hashes and
recoverable production diff. The production source is restored to main.

The next condition is an independently justified finite-precision reference for
these two public boundary cases, or an explicitly authorized pinned native
D3D7 reference, determining required clip-coordinate/colour conversions. Keep
the primary four-byte failure and exact discriminating controls. No further
production change is justified by this run alone.

## Validation and recovery

The final 180-scene plan covers unclipped, integral/fractional near/far,
unit/varying geometric w, three fan orders, constant/varying diffuse/fog,
explicit TL, alpha test and distinct texture Q. Fractional far z `[.2,2.7,.6]`
crosses z=w for both w fields; the analytic plan asserts this. Selected pixels
include the causal witness, neighbours, occlusion and clear. Complete targets
are compared between public routes.

```sh
node test/test-legacy-fractional-color.js
node test/test-legacy-fractional-color.js --wasm=build/wine-assembly.wasm --out=<run>/normal --characterize
node test/test-legacy-fractional-color.js --wasm=build/wine-assembly.compat.wasm --out=<run>/compat --characterize
```

Default invocation checks only the analytic plan. Without `--characterize`,
module mode intentionally rejects the shipped defect. Final restored-module
characterization, locked full build and accepted texture/clipped-depth/
variable-Q/fog regressions are retained with rendered negative controls.
Indexed-texture, vertex-fog and shared-render-Worker neighbors were exercised;
intermediate candidate logs do not qualify restored bytes.

Final restored characterization records 360 draws and 1,260 selected RGB
observations per route, with 140 disagreements per route on both modules.
All complete targets match across ordinary/indexed, immediate/physical Worker,
and canonical/compatibility modules. This establishes transport parity, not
colour conformance. Restored module hashes exactly match the initial pair.

Git is the source archive: recovery records contain Git SHA, relevant binary
diff and owned new-file patches. Media/modules use existing path plus SHA-256
only. No source snapshot, tar, module/media copy, npm, deployment, Chrome, game,
boat, shared heavy-runtime lock or subworker was used. No GPU, capability
restoration, Windows hardware identity or gameplay result is claimed.

Box ID/state/expiry: not applicable. No runtime ownership was acquired;
shutdown remains coordinator-owned. This worker stops with an evidence-backed
packing blocker and no speculative production edit.
