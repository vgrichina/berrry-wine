# Steep software sampler stages

Evidence destination: `scratch/runs/20261106-legacy-sampler-stage/`.

This investigation follows [the rejected diagnostic](legacy-steep-software-20261106.md).
The retained public sample is integer pixel `(30,1)`, with independent RGB
`[103.220778044,113.924726814,97.215804982]` and tolerance 2. Geometry,
the oracle and tolerance stay unchanged.

Diagnostic declarations are prepared in the included core VFS fragment under
all three normal aliases. The root remains byte-identical and include-only.
The original malformed-root transform is separately replayed with a compiler
entry counter before any diagnostic compilation. Runtime detection, protected
exports and strict declarations remain enabled through `compileClosure`.

Prepared trace events distinguish lookup UV from quotient-plane UV/Q, rho
squared and LOD, selected mip dimensions, bilinear taps/fractions, quantized
weights, actual horizontal rows, packed bilinear colors and the mip blend.
Diagnostic modules cannot qualify the shipped-module matrix.

The original malformed-root negative passed: the exact predecessor transform
raised `protected runtime requires an include-only root`, with **zero compiler
entries**. The corrected diagnostic compiled normally. Its bootstrap and
browser both armed an exported writer, observed its rejection, disarmed it,
and verified the mapped bytes remained unchanged. The focused protected
closure contract also passed. No protection/compiler policy was changed.

## Actual retained stages

Unchanged production again passed the original twelve samples, then returned
`[103,113,95]` at `(30,1)`. The diagnostic returned the same pixel and captured:

| Stage | Actual value |
| --- | --- |
| Lookup UV | `.25238463282585144, .23146159946918488` |
| Quotient-plane UV | `.25238463282585144, .2314615696668625` |
| Q | `.03249996900558472` |
| rho squared / LOD | `4.5312957763671875 / 1.0899618864059448` |
| Mip fraction | `.08996188640594482` |
| Selected dimensions | `8x8`, then `4x4` |
| Level 1 fractions / integer weights | `.5190770626068115, .351692795753479 / 132,90` |
| Level 2 fractions / integer weights | `.5095385313034058, .4258463978767395 / 130,109` |
| Level 1 horizontal RGB rows | `[101,157,96]`, `[101,37,93]` |
| Level 2 horizontal RGB rows | `[126,54,114]`, `[126,174,113]` |
| Packed bilinear results | `[101,114,94]`, `[126,105,113]` |
| Packed mip blend | `[103,113,95]` |

`stage-observations.json` retains all actual taps and events. Its arithmetic
checks reproduce every observed horizontal row and packed bilinear result.
The first filtering discrepancy is fractional-weight quantization, followed
by horizontal and vertical truncations. Ideal bilinear results using the
**actual traced inputs** are `[100.863369,114.796865,95.543219]` and
`[127.068316,105.101568,114.135805]`; their blend is
`[103.220815,113.924657,97.215843]`. The actual packed levels instead blend to
`[103.249047,113.190343,95.709276]`, which the final conversion truncates.
Thus the observed filtering stages explain the failing blue channel. The
tiny lookup/plane UV difference and LOD approximation do not explain this
pixel's error. This is stage evidence, not a general legacy precision bound
or a claim that all perspective interpolation cases are correct.

## Candidate and first new failure

`candidate-repair-and-regression.patch` preserves an unqualified candidate:
fractional SIMD bilinear rows with one final rounded packed conversion, the
reversed-gradient/steep public regressions and their analytic references, and
the predecessor's GL numerator/Q reconstruction without changing raster
positions. Both modules passed the locked full build. Shader, analytic
integer-center, ValidateDevice, protected-closure and public-plan checks passed.

Validation stopped at an operator invocation failure at
`2026-11-06T12:47:42.900099Z`: I named nonexistent
`test/test-d3d9-fixed.js`. Concurrent mirror and Worker-plan commands also
omitted their required `--plan` flag and rejected missing runtime configuration.
These errors are preserved in the focused command records/logs; they are not
emulator defects. There was no retry or candidate rendering afterward.

All four owned production/test edits were restored after saving the patch and
candidate modules. **No repair or regression is landed.** Candidate public
software pixels, fixed/top-left and mirror/Worker plan checks, native sampler
regressions, and every candidate solid/spatial matrix cell remain unexecuted.
The next worker must first use the actual existing fixed test filename
(`test/test-d3d9-fixed-top-left-bias.js`) and explicit plan/runtime arguments,
then qualify the retained candidate's software regression and full matrix.

## Identity and cleanup

Baseline, diagnostic and candidate source records pin Git
`f22af401717fb054b429a954b393bd4e306b5ae5`; each has a Git binary diff and
4,061 source hashes. The diagnostic additionally has `trace-transform.patch`.
No source tree or media was archived. The existing calc fixture was referenced
at SHA-256 `cb71fcc9726f756421519a215c39cf89efd930c9ae0fa5bbb59b64050faef52b`.

| Module | Standard SHA-256 | Compatibility SHA-256 |
| --- | --- | --- |
| Unchanged production | `220beaba026d0aabaf25b4193a345ca6d704be64b0812a72d68adb0700ad80f2` | `2b180ff8bbf552a10d97ac21d8ed5bf820e712e5c658bb29f0006e623a867326` |
| Diagnostic | `24a70494fe4005dc979b6404843709c22056ce824c1ffbd64c9473a7239929d8` | unchanged, bootstrap only |
| Candidate, build only | `a26cbca6cb7e1a5aa106048138248f18b610a1eed3222f526c79cee74327c962` | `99e657781f4cab4e2bf3c3f985f53dddd699f4e1c8082be3f1343ad0c312f785` |

Ordered Legacy1200, Disciples1216 and KKnD1221 FINAL releases and independent
cleanup passed before the sole window, `12:44:17.103448Z`–`13:29:17.103448Z`.
Both synthetic browsers closed normally; their failure image was reviewed as
a synthetic triangle only. Final cleanup verified 131 absent recorded PIDs,
six refused ports, two absent profiles, four free locks and over 4.4 GB free
disk, within the window. The board watcher was already absent when cleanup
attempted to close it; this is recorded separately from test failures.
Baseline module bytes were restored to `build/`; ignored `build/combined.wat`
was generated by the candidate build and requires the next normal rebuild.
No boxes were assigned: ID/state/expiry are not applicable. Runtime ownership
returns to the coordinator. Evidence is published in `result.json` last.
