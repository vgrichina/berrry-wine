# Legacy Gouraud RGB sample placement

Run: `scratch/runs/20261105-legacy-subpixel-color-placement/`.
Baseline Git: `45046072e7d234f8fd18d63dfe564e60f4b85f51`.
Follows published `b635e9142` (subpixel contract) and `743ae441d`
(independent exact rational / IEEE binary32 reference).

The minimal RGB placement repair passes both shipped module variants and all
four public Draw/Lock routes against independently sealed complete targets.
The primary pixel changes from `[108,51,133]` to `[104,51,131]`; cyclic near
red 99 and reversed far blue 116 remain. Existing clip-generated packed colors,
coordinate storage, alpha/fog and final byte-conversion policy are preserved.

All reference preparation and baseline runs preceded production edits. MDK's
final release was `2026-11-05T00:14:23Z`; Stronghold's was `00:23:18Z`.
`runtime-cleanup-independent.json` records this worker's independent checks of
both owners' exact process IDs, refused ports and absent profiles, together
with hashes of their normal-cleanup records. Production source ownership began
at `00:24:29Z`, after both final releases. Their original runtime closures stayed
unchanged throughout the required interval. No runtime lock was acquired here.

## Scope and justification

The [published contract research](legacy-d3d-color-contract-20261104.md)
establishes linear Gouraud interpolation, integer sample centers, and our
advertised SUBPIXEL capability. Assigning a floating edge's color to a rounded
integer endpoint moves the field. Removing that displacement is justified.
This does not establish universal DX7 internal precision or byte-conversion
rules. The [precision investigation](legacy-color-precision-20261104.md)
explains cyclic near red 99 and far blue 116; neither requires changing clip
packing to recover ideal-real 100 or 117.

The retained candidate was read IN PLACE at
`scratch/runs/20261104-legacy-fractional-color/candidate-undivided-f32.diff.patch`.
It changes alpha interpolation and explicit-TL fog placement as well as RGB.
Those changes are excluded here. The repair changes only RGB sample
placement in the existing textured-span path, including its shared white-texel
untextured route. Existing clip-generated packed bytes, TL coordinate storage,
coverage, alpha interpolation/tests, fog setup/application, depth, texture Q
and final saturating/truncating channel conversion remain fixed.

For TL positions p0/p1/p2 and a packed channel c0/c1/c2, define edges
u=p1-p0, v=p2-p0, determinant D=ux*vy-vx*uy, channel differences d1/d2,
A=d1*vy-d2*uy and B=ux*d2-vx*d1. Sample integer (x,y) using

```
c0 + (A*(x-p0.x) + B*(y-p0.y)) / D
```

Each operation rounds separately to binary32, then the existing unsigned
truncate/saturate-to-byte policy applies. This is an explicitly chosen software
interpolation graph, not an exact native D3D7 conformance claim. The anchor
matches the existing lerp's base-plus-displacement form. Unlike multiplying
c0 by D before division, it preserves zero displacement and constant channels
exactly. It also avoids dividing the gradients separately. No bias, epsilon,
byte tolerance or primary-pixel special case is introduced.

## Independent expectations before any production edit

`test/test-legacy-color-precision.js` reuses its existing BigInt rational and
integer-quotient/remainder binary32 ties-to-even implementation. The scoped
reference takes authored fixture inputs, with explicitly selected existing
projection, clipping, packing, coverage, alpha/fog and channel conversions.
It imports no production interpolation, clipping or raster helpers and consumes
no renderer trace. Expected tables are written before each public draw.

The same reference has a separately selectable old RGB placement calculation.
On unchanged canonical and compatibility modules, all four public Draw/Lock
routes reproduce the final 224-scene baseline exactly, including every
pixel of every complete 32x32 target (1,835,008 RGB pixels across eight routes),
and exact captured screen x/y, z/w and 1/w storage. These baseline comparisons
test the arithmetic model against
independently predicted values; observed bytes never populate expectations.

At the primary forward pixel (16,4), old placement independently yields
`[108,51,133]`; anchored RGB placement yields `[104,51,131]`. The latter's
binary32 pre-conversion values are
`13689459/131072`, `3395269/65536`, `8646971/65536`.
Cyclic near yields `[99,54,133]`, with red `13107199/131072`.
Reversed far yields `[46,62,116]`, with blue `15308117/131072`.
Their existing coordinate/clip-packing explanations remain intact.

The strict new reference rejects the unchanged canonical module at 219 of
1,554 selected samples and 12,595 complete-target pixels on its first route.
An unclipped discriminator at (1,1) produces
old `[23,49,87]` versus predicted placed `[24,50,87]`; this also demonstrates
that the test is broader than the primary clipped pixel. The rejected run,
full failures, and all expected values are retained under `before-strict/`
and `before-full-strict/`.

The final public plan has 224 scenes: the original 180, six constant-green
channel controls, and 36 explicit-TL fractional-x/y scenes translated across
rounding cells, three vertex orders, constant/varying RGB/fog and alpha tests,
plus two exactly collinear stored-TL controls. The latter have no unique affine
RGB field, but rounding gives them thin coverage; exact-zero determinant
retains their existing span interpolation without an epsilon cutoff.
Both geometric w fields, near/far clipping, the two precision boundaries,
explicit TL, independent texture Q, occlusion and clear samples are retained.
Every complete target is predicted independently as well as compared across
immediate/indexed/physicalWorker routes. `scoped-reference-seal.json` pins the
complete 224-scene proposed target table before any production edit, together
with source, module and reference-file hashes.
Capture hashes must remain immutable after live source/index/state mutation;
captured projected values have independent exact binary32 assertions.

`independent-byte-ledger.json` was generated before any production edit. It
records every changed selected byte, its independently calculated old and new
field, the stored clipped triangle, final pre-conversion channel fractions,
unchanged alpha and fog factor, and historical ideal-real diagnostic. Eleven
selected diagnostic differences remain in the expanded plan: cyclic red 99
(also in the constant-green variant), far blue 116, two original explicit-TL
fog samples, and six new fractional-TL fog samples. The latter eight preserve
the existing explicit-TL fog plane through rounded coordinates, rather than
adopting the historical candidate's different fog placement. For example the
original unit-w TL sample at (16,4) uses factor `13579677/33554432`, producing
blue 189 instead of the ideal fog diagnostic's 188. Varying-w TL uses factor
`11718081/33554432`, producing red 148 instead of 149 after the corrected RGB
field. This is preservation of the assigned fog mechanism, not a fog repair.

The historical ideal-real oracle remains available via `--characterize` and
`--ideal-strict`, including all its failures. Module-mode acceptance defaults
to the scoped fixed-conversion reference; `--placement` selects it explicitly
and `--baseline-placement` tests the former placement. No historical mismatch
is silently dropped or turned into a tolerance.

## Validation and publication

The production diff adds 83 lines in `src/09ab-handlers-d3dim-core.wat`: RGB
plane setup, integer-position sampling with the retained f32 channel conversion,
RGB replacement preserving the old diffuse alpha, and draw/Worker transient
reset. Constant RGB and flat faces retain the existing path. Exactly zero
determinants retain span behavior. No coordinate, clip packing, fog, alpha,
coverage, texture, depth or capability code was removed or rewritten.

`flock /tmp/wine-build.lock bash tools/build.sh` passed, building canonical
and compatibility modules. Their existing paths and new SHA-256 are recorded
in `after-path-sha256.txt`; binaries were not copied into evidence.

```
node test/test-legacy-fractional-color.js --wasm=build/wine-assembly.wasm --out=<run>/after-normal --placement
node test/test-legacy-fractional-color.js --wasm=build/wine-assembly.compat.wasm --out=<run>/after-compat --placement
node test/test-legacy-color-precision.js --wasm=<module> --out=<run>/precision-after-<variant> --placement
```

Both module variants pass all four ordinary/indexed immediate/physicalWorker
routes: 224 scenes, 448 public draws, 1,568 selected samples and 229,376 complete
RGB pixels per route. Across eight routes, all 1,835,008 RGB pixels equal the
pre-edit sealed reference exactly; all complete targets also agree across
routes and modules. Recomputed expected-table hashes match the pre-edit seal,
and the reference source-file hashes remain unchanged since that seal.
Worker fallbacks are zero. Input records and immutable command hashes also
match their BEFORE-repair values exactly, besides remaining unchanged after
live source/index/state mutations. `final-verification.json` records these
checks. No production trace or observed color populated any expected table.

The precision suite separately passes thirty scenes and five boundary/neighbor
samples per scene on each of the eight routes, including independently packed
TL controls. Its exact binary32 captured z/w and 1/w checks pass. Rendered
constant-diffuse, fog-off and alpha-off negative controls successfully Draw and
Lock and disagree with the independent expected colors on both modules.

Both modules pass the accepted fractional-texture, clipped-depth/fog and
variable-Q/fog suites, including their rendered negatives. Indexed texture,
vertex fog and shared-render-Worker neighbors pass. Commands, exit codes and
individual logs are in `regressions.json`; the locked build log is `build.log`.

The unchanged historical 180-scene ideal-real diagnostic has FOUR disagreements
per route, all retained under `historical-after-{normal,compat}/`: cyclic near
red 99 versus ideal 100; reversed far blue 116 versus ideal 117; unit-w TL fog
blue 189 versus ideal 188; varying-w TL fog red 148 versus ideal 149. Their
independent arithmetic is above and in `independent-byte-ledger.json`.
`historical-ideal-strict/` deliberately still rejects those four differences
(exit 1). The earlier strict corrected-placement test's 219 selected and
12,595 complete-target failures against the old module are also retained.
There is no tolerance increase, bias, failure deletion or native D3D7 exactness
claim. Remaining unspecified native conversion details do not block this
scoped placement repair under the preserved software conversion policy.

Evidence records Git SHA plus relevant binary diff and owned new-file patches;
Git remains the source archive. Existing module/media paths and SHA-256 are
retained without snapshots, archives or copies. No Chrome, game, boat, native
Windows D3D7, heavy-runtime lock, subworker, npm, deployment or Heroes II is
used. Box ID/state/expiry: not applicable; coordinator owns shutdown. This
worker stops after publishing this single task; further native conformance or
gameplay qualification would require a separate assignment.
