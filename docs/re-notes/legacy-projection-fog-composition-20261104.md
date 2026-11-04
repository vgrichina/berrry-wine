# Legacy supplied projection composed with vertex fog

2026-11-04. Evidence: `scratch/runs/20261104-legacy-projection-fog-composition/`.
Tested input main: `52a88675b69533b4f2a07af891ce1771e924f18f`.

The previously unverified supplied-coordinate projection/vertex-fog combination
passes a discriminating public COM comparison on both shipped software modules.
No production behavior defect was demonstrated, so no production change or
capability restoration is justified. This closes a bounded coverage gap listed
in [the supplied projection note](legacy-supplied-uv-projection-20261104.md).
PROJECTED remains unadvertised. The advertised vertex-fog behavior is tested in
composition with the implemented supplied COUNT3 projected path.

## Equivalent geometry and independent expectations

`test/test-legacy-projection-fog-composition.js` reuses the accepted public
fixture plumbing from the projected-coordinate regression. Original calc PE
bootstrap obtains DD7/D3D7/Device7 through real x86 indirect COM calls. Public
surface Lock/Unlock uploads the nonsolid parity texture and reads target pixels.
Calls check HRESULT, bounded execution, stdcall stack cleanup and guarded
outputs. No fabricated COM object, extracted WAT or private draw entry supplies
the rendered result. The Node canvas accommodation receives presentation bytes;
the asserted pixels come from public Surface7 Lock.

Each pair has identical XYZ, projection, diffuse, specular fog alpha and FLOAT2
input dimensions. The projected arm applies an off-axis texture matrix with
translation and constant texture q=0.5, using COUNT3|PROJECTED. The reference
arm disables texture transformation and independently supplies
`((0.5u+0.25v+0.09375)/0.5, (0.125u+0.5v+0.15625)/0.5)`.
A constant texture denominator makes those predivided vertices mathematically
equivalent throughout the triangle while preserving geometric rhw. Variable
texture q would generally make vertex predivision inequivalent; it is outside
this comparison, and no rhw adjustment is used to disguise that distinction.

The independent oracle perspective-interpolates those reference UVs using
geometric w, selects a point-sampled texel, and mixes its RGB with fog color
`[173,41,219]` using screen-linear specular-alpha factors. It does not call a
production coordinate, fog or sampling helper. Two geometric w configurations
are tested: unit w and independently varying w `[1.1,1.4,1.3]`, with object z
`[0.2,0.8,0.6]`. Fog factors are constant `[96,96,96]` or varying `[32,128,224]`;
each runs with fog disabled and enabled, FOGTABLEMODE and FOGVERTEXMODE NONE.
Z testing remains disabled in this fixture; queued vertex checks explicitly
verify unchanged z/w and 1/w. Depth occlusion, computed vertex fog, table fog,
clipping and variable texture-q composition are not qualified here.

## Observed public results

For each canonical and compatibility module, sixteen states run through four
routes: ordinary/indexed DrawPrimitive, immediate/physical native Worker replay.
There are 64 positive draws and 192 sample observations per module. Every
projected/predivided pair has exact equality across the complete 32×32 target,
and all four routes produce identical complete images. Independent expected
samples use the established two-byte rounding tolerance. The sample set
distinguishes texture colors, and every fog-on sample differs from its fog-off
counterpart. For example, `(4,6)` in the unit-w constant-factor projected arm
changes from `[60,70,30]` to `[130,51,147]` with fog enabled.

Each module also exercises 32 held production command records. After the
producer captures a draw, public calls replace the live texture matrix,
projection flags, fog enable and fog color. Source vertex and index storage is
overwritten before delivery. Complete held command SHA-256 values remain
identical. Record checks verify type 5 projected/type 3 nonprojected vertices,
geometric rhw/depth, original fog alpha, and supplied FLOAT2 UVs. The physical
`lib/d3d-render-worker.js` consumer replays those original commands, public Lock
fences completion, and transport reports actual replay with zero fallback.
This is software Worker rendering; no GPU preparation hook contributes evidence.

Two negative controls per module preserve successful public Draw and Lock,
then fail specifically at PIXEL ORACLE: ignore projection, or force fog off.
Positive pixels, pair equality, cross-route equality and negative failures are
retained in `built-normal/` and `built-compat/`, rerun after the locked build and
the recorded source/input seal. `final-normal/` and `final-compat/` contain the
identical pre-build results; the build reproduced both module hashes.
The first fixture attempt omitted
the inherited PE image-base config; the second expected historical internal
type 4 instead of current type 5. Those failures are fixture errors, retained
under `baseline/` and `baseline-v2/`; neither is a production failure.
`baseline-v3/` passed before adding the stronger held source/fog mutations.

The locked full build and focused indexed-texture, Worker-parity and
ProcessVertices-fog neighbors pass. Existing accepted larger projection/count/
generated matrices remain unchanged and are referenced by path and SHA in the
run provenance, without repeating their acceptance claims.

## Reproduction and boundaries

After `flock /tmp/wine-build.lock bash tools/build.sh`:

```sh
node test/test-legacy-projection-fog-composition.js
node test/test-legacy-projection-fog-composition.js \
  --wasm=build/wine-assembly.wasm --out=<new-run>/normal
node test/test-legacy-projection-fog-composition.js \
  --wasm=build/wine-assembly.compat.wasm --out=<new-run>/compat
```

The default invocation is an analytic plan/source-seam check; only explicit
`--wasm` execution establishes public rendering. Tested module SHA-256 values:

- canonical: `78a0b1d61b23428a1ae909d739440ae0de059bbbd84a69a2ad3e4c37471ad664`
- compatibility: `99b579cd17b57f94145df92ae6d28110f24fc284d13a1b2c0ebe3596bd10a77f`

Recovery records exact Git SHA, relevant binary diff and owned new-file patches.
Existing fixtures, production dependencies, modules and calc media are
referenced by path and SHA; no source snapshot, tar, module/media copy or npm
operation is used. No browser, game, GPU, native Windows, remote/box API,
deployment, lifecycle action or subworker was used. No box is assigned: box ID,
state and expiry are not applicable; shutdown remains the coordinator's duty.

The next evidence boundary is a separately scoped variable-texture-q/fog or
clipped composition with an independent rational oracle, rather than treating
per-vertex predivision as equivalent for a varying denominator. This result
establishes neither full PROJECTED capability support nor gameplay behavior.
