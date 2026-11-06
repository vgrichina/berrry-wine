# Spatial MIN LINEAR: first divergent quantity

Evidence destination:
`scratch/runs/20261106-legacy-spatial-min-linear/`.
The first WebGL divergence is proven below. One bounded local run stopped at a
new software precision failure before any candidate spatial WebGL cell. No
production repair is landed; the candidate and discriminating regressions are
preserved as an exact binary diff in `final-candidate-and-regression.patch`.

The predecessor's retained direct WebGL1 sample is in
`scratch/runs/20261106-legacy-mip-held-packet/matrix/result.json`,
`partial.observations[4]`. Both DIB RGB and actual WebGL RGB are
`[121,50,107]`; alpha is 255 and GL error is zero. The independent integer-center
oracle remains `[113.752,42.28,103.404992]` at tolerance 2.

The first mathematical divergence is interpolated UV. For this affine draw,
`u=.137+x/8`, `v=.193+y/8`, and Q=1. The triangle is
`[(0,0),(32,0),(0,32)]`. Both `(2,3)` and `(2+1/16,3+1/16)` are strict
interiors, so coverage ownership cannot explain this sample. The fixed vertex
lowering in `lib/d3d9-fixed.js` translates every vertex by `(-1/16,-1/16)`
relative to the D3D-to-GL center mapping. Unchanged varyings therefore evaluate
at the latter authored position. This occurs before texture sampling.

| Quantity | Integer center | Translated evaluation |
| --- | --- | --- |
| U,V | .387, .568 | .3948125, .5758125 |
| Base texture footprint | 2 | 2 |
| LOD / POINT-selected level | 1 / 1 | 1 / 1 |
| Within-level filter | LINEAR | LINEAR |
| Level dimension | 8 | 8 |
| Texel-center coordinate `8*UV-.5` | 2.596, 4.044 | 2.6585, 4.1065 |
| Bilinear fractions a,b | .596, .044 | .6585, .1065 |

The four authored mip-1 taps are `(47,37,47)`, `(159,37,143)`,
`(47,157,143)`, `(159,157,47)`. Their tensor product gives
`R=47+112*a`, `G=37+120*b`, `B=47+96*(a+b-2*a*b)`.
Substitution gives the independent expected RGB at the integer center, and
`[120.752,49.78,106.974992]` at the translated position. Rounding the latter
gives exactly the retained actual RGB. These are authored-grid calculations;
the independent pixel oracle has not been shifted or derived from production.

The inverse red/green rounding intervals also constrain the effective screen
displacement: red permits `[.06025,.0691785714)`, green permits
`[.0601666667,.0685)`. Both include `1/16`. The blue cross term then supplies
an independent channel check. This strengthens the earlier displacement
prediction; it does not constitute a new GPU capture or prove a repair.

The prepared public regression adds a negative-gradient LINEAR state with
`n=-4`, offset `(.815,.867)`, and the same integer sample `(2,3)`.
Its independently calculated expected RGB is
`[49.24,104.68,100.89824]`. Reversing the gradient reverses the UV error;
a constant UV adjustment cannot repair both states. Standard software returned
`[49,104,100]`, passing the unchanged tolerance 2.

For a repair, let N=UV*Q and Q=geometric reciprocal W at the displaced
invocation. Both are affine in GL window coordinates. The correct inputs are
`N' = N - (dFdx(N)-dFdy(N))/16` and
`Q' = Q - (dFdx(Q)-dFdy(Q))/16`, with UV'=N'/Q'. The minus between GL
derivatives accounts for screen Y increasing downward. LOD must use the
original affine numerator/Q gradients evaluated with UV' and Q', rather than
the displaced denominator or finite differences of divided UV. This can
preserve the current raster positions and ownership. Simply removing the
geometry bias, modifying the oracle, or correcting UV with a constant cannot
meet the contract. The separate experimental solid coverage backend remains
outside this task.

## New software failure and exact arithmetic reproduction

The second discriminating addition uses `q=[1,.001,.01]`, `n=4`, the original
offset `(.137,.193)`, and integer sample `(30,1)`. Its purpose is to reject a
repair that moves N but reuses the displaced Q. Both planes must move before
division; here the correct Q is .0325 and UV is `(3281/13000,3009/13000)`.
The independent quotient derivatives give rho squared 4.5312839186303 and
LOD 1.0899599446275037. It samples levels 1 and 2 with MIN LINEAR and blends
their results. The independent oracle returned
`[103.22077804435263,113.92472681378077,97.21580498154373]`.
Actual standard software returned `[103,113,95]`: blue error 2.21580498 fails
tolerance 2. This sample is covered and neither oracle nor tolerance changed.

`src/09ab-handlers-d3dim-core.wat` `$d3dim_bilerp` quantizes the two fractional
weights with `trunc(fraction*256)`, truncates each horizontal interpolation,
then truncates the vertical interpolation. `$d3dim_color_lerp` truncates the
subsequent mip blend again. An offline arithmetic model of these operations,
using the independent intended UV/LOD, reproduces all three actual channels:

| Level | Fractions scaled/truncated to 256 | Ideal RGB | Integer bilerp RGB |
| --- | --- | --- | --- |
| 1 | 132, 90 | 100.863385,114.796923,95.543217 | 101,114,94 |
| 2 | 130,109 | 127.068308,105.101538,114.135804 | 126,105,113 |

Blending the integer colors gives approximately
`[103.248999,113.190361,95.709239]`; final truncation gives `[103,113,95]`.
The first arithmetic divergence in this software model is weight quantization;
successive intermediate truncations accumulate the failing blue error. This
is source arithmetic reproduction, not an instrumented capture of internal
float values. It does not establish that every perspective sampling case is
otherwise correct. The native sampler was unchanged by the GPU candidate.
See `software-rounding-analysis.json` and the original raw `matrix/result.json`.

## Executed checks and limits

Ordered DisciplesCorrected1040, HelpSuspension1048, KKnDMenuConsumer1055 FINAL
releases and independent cleanup checks passed before production edits or
runtime. One local runtime began at 11:50:41.470962Z on 2026-11-06, with an
immutable 12:35:41.470962Z deadline. Browser interval was
11:51:29.754Z–11:51:48.365Z; cleanup passed at 11:51:49.860478Z.
There was no retry, second browser, box, deployment, or guest-fixture edit.

`flock /tmp/wine-build.lock bash tools/build.sh` passed both modules.
Focused shader, fixed top-left, existing integer-center, backend validation,
mirror-UV/Worker plans and public mip plan checks passed. These checks used the
candidate; they do not qualify its unexecuted spatial WebGL output.

All ten solid cells passed: software, direct WebGL1/2 and owning Worker
WebGL1/2 on both modules, 214 pixel observations, 28 negative controls, and
12 held-packet checks. Packet immutability, completion ordering and retirement
checks passed. Original standard-software spatial observations and the reversed
gradient passed (13 observations total), then the steep case failed. No spatial
cell completed. Candidate spatial direct/Worker WebGL1/2 and compatibility
software were not reached. Physical GPU and game behavior were not tested.
The viewed failure screenshot is a synthetic test triangle, not gameplay.

Tested source was Git `d069c09cd291a719a709a2d1c55ef9ef7ad6b270` plus
`tested-source.patch` and `newfilepatches.patch`; `tested-source.json`
records 304 file hashes and `source-postcheck.json` confirms no runtime drift.
The exact shipped module copies are retained individually in `matrix/`:

| Module | SHA-256 |
| --- | --- |
| standard | 220beaba026d0aabaf25b4193a345ca6d704be64b0812a72d68adb0700ad80f2 |
| compatibility | 2b180ff8bbf552a10d97ac21d8ed5bf820e712e5c658bb29f0006e623a867326 |

The unchanged guest reference is existing `test/binaries/calc.exe`, SHA-256
`cb71fcc9726f756421519a215c39cf89efd930c9ae0fa5bbb59b64050faef52b`.
It was referenced, not copied. No source archives were made.

The candidate production edits and proposed public-test additions were reverted
after preserving the tested diff. No failing regression or unqualified repair
is committed to main. This is a documentation-only result. Cleanup verified
140 absent owned PIDs, three refused ports, one absent browser profile, all
four locks free and 4.68 GB free disk. Box ID/state/expiry are not applicable;
local runtime ownership returns to the coordinator.

Next work must resolve the accumulated software filtering precision error
with the preserved steep regression, then qualify N/Q reconstruction against
the unchanged oracle and finish all ten spatial cells. Preserve top-left
ownership, held-packet lifetime and the already passing solid controls.
