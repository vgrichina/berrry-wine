# Legacy variable texture q composed with vertex fog

2026-11-04. Evidence: `scratch/runs/20261104-legacy-variable-q-fog/`.
Initial input main: `116f2c134f16b7cfe34a8d2a9a3ba9c573ca6019`.
Locked-build input main: `fa01ce04166cc1a756b3415cc73a9775bc43540e`.

The remaining supplied COUNT3 variable-texture-q/vertex-fog composition passes
discriminating public x86 COM rendering on both shipped software modules.
No production defect was demonstrated, so this change adds a regression and
evidence only. PROJECTED remains unadvertised. This extends the bounded
[constant-q composition result](legacy-projection-fog-composition-20261104.md)
without treating vertex predivision as equivalent for a varying denominator.

## Independent rational expectation

`test/test-legacy-variable-q-fog.js` reuses the preceding public fixture plumbing:
original calc PE bootstrap, real x86 indirect COM calls obtaining DD7/D3D7/
Device7, public Surface7 Lock/Unlock texture upload and target readback, checked
HRESULTs, guarded output storage and stdcall cleanup. The asserted pixels come
from public Lock, with no private draw entry or fabricated COM objects. The
Node canvas accommodation only receives the presentation bytes.

Each triangle supplies FLOAT2 coordinates `(.137,.193)`, `(.887,.193)` and
`(.137,.943)`. The authored matrix produces
`U=.5u+.25v+.09375`, `V=.125u+.5v+.15625` and either
`Q=.75u+.25v+.3125` or `Q=.125u+.875v+.21875`.
Both Q fields are positive and have three distinct vertex values. COUNT3|
PROJECTED uses that third component as the texture denominator.

For screen barycentrics b, the independent oracle computes
`u = sum(b_i U_i/w_i) / sum(b_i Q_i/w_i)` and likewise for v. It point-samples
the nonsolid 16×16 parity texture with wrapping, then mixes RGB with fog color
`[173,41,219]`. Fog factors interpolate screen-linearly from specular alpha.
The oracle uses authored coefficients and does not call production transform,
interpolation, texture sampling or fog helpers. It never adjusts geometric rhw
to incorporate Q and never uses predivided vertices as a positive reference.

The sixteen states combine two Q fields, unit or varying geometric w
`[1.1,1.4,1.3]`, constant `[96,96,96]` or varying `[32,128,224]` fog alpha,
and fog disabled/enabled. Geometric object z is `.5` in the unit-w case and
`[.2,.8,.6]` otherwise. FOGTABLEMODE and FOGVERTEXMODE remain NONE. Every
q/w case has samples that distinguish texture colors; every fog-on sample
differs from its fog-off counterpart. The cheap default invocation checks the
analytic plan, including a witness against early vertex division, but makes
no rendered claim.

## Public pixels and retained replay

Each module passes 64 positive public draws and 192 sample RGB observations:
sixteen states through ordinary/indexed DrawPrimitive, immediately and through
the physical production `lib/d3d-render-worker.js` Node Worker. Samples are
`(4,6)`, `(8,12)` and `(6,4)`. All four routes produce identical complete
32×32 target images. Independent sample comparisons retain the established
two-byte rounding tolerance; full-image route comparisons are exact.

Each module also supplies 32 held production records. After capture, public
calls change TEXTURE0 to identity, disable projection, reverse fog enable and
replace fog color. Vertex and index source storage is overwritten before
delivery. Complete held-command SHA-256 values remain unchanged. Record
checks verify type 5, the original full matrix and FLOAT2 values, specular fog
alpha, geometric `1/w` and geometric `z/w`. The physical Worker consumes the
held commands; public Lock fences completion. Each queued route reports
16 replay commands, 16 fences and zero fallback.

Four controls per module retain successful public Draw and Lock but fail
specifically at PIXEL ORACLE: ignored projection, early per-vertex division,
fog forced off, and the captured matrix replaced with the later identity
matrix. At `(4,6)` with the first Q field, varying geometric w and varying fog,
the rational result is `[125,50,170]`; early division produces `[137,35,170]`.
This directly distinguishes the inequivalent varying-Q interpolation paths.

`initial-*` records the first passing matrix. An added analytic nonsolid-color
check exposed an insufficient three-sample selection for the second Q field;
the final selection replaces `(12,8)` with `(6,4)`. This was a fixture coverage
refinement, not a production failure. `final-*` and the post-build `built-*`
results pass the strengthened fixture. The locked full build, indexed-texture,
second-instance Worker-parity and ProcessVertices-fog neighbors pass.

## Reproduction and scope

```sh
flock /tmp/wine-build.lock bash tools/build.sh
node test/test-legacy-variable-q-fog.js
node test/test-legacy-variable-q-fog.js --wasm=build/wine-assembly.wasm --out=<run>/normal
node test/test-legacy-variable-q-fog.js --wasm=build/wine-assembly.compat.wasm --out=<run>/compat
```

The build reproduces the existing shipped module SHA-256 values:

- canonical: `78a0b1d61b23428a1ae909d739440ae0de059bbbd84a69a2ad3e4c37471ad664`
- compatibility: `99b579cd17b57f94145df92ae6d28110f24fc284d13a1b2c0ebe3596bd10a77f`

Recovery records Git SHA, relevant binary diffs, owned new-file patches and
existing dependency/media/module paths with SHA-256. No archived input needed
restoration; no source snapshot, tar, module/media copy or npm operation was
used. Large released run JSON is gzip-compressed with SHA roundtrip mapping.

This closes supplied variable-Q/vertex-fog software composition coverage for
these unclipped COUNT3 draws. Depth occlusion (Z testing is disabled), clipping,
computed/table fog and complete PROJECTED capability support remain outside
the result. No Chrome, boat, heavy local game, GPU, native Windows, gameplay,
deployment, subworker or runtime lifecycle action was used. No box is assigned;
box ID, state and expiry are not applicable. Shutdown remains coordinator-owned.
The next distinct composition boundary is clipping or depth occlusion.
