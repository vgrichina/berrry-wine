# Conan lazy palette inputs, 2026-11-06

Actual lazy-updater inputs are captured. No emulator mismatch is proved in the
observed cache/parent decisions, channel comparisons, or scale stores. The first
observed zero palette entry comes from two active channels whose weights are
both `+0.0`; the guest skips both and passes zero scales to the palette builder.
The next causal boundary is the earlier production of those channel weights
and channel-table changes. No implementation change is justified by this run.

Evidence: `scratch/runs/20261106-conan-lazy-inputs/` (ignored).
Tested source: `dc9d1a51126dae8f011fa2a06eeb6d3ffffa6b15` on `main`.
The [prior producer investigation](conan-palette-producer-20261106.md) supplies
released recipes; its failed controls and disqualified source-drift original
remain untouched. The proved REP copy and initial products in the
[matrix-write investigation](conan-matrix-write-20261106.md) are accepted without
repeating their diagnosis.

## Actual failing input

`palette-first-zero-884a260-93570.json` records the first observed zero palette
update, at `0x431e7b`, serial **93570**. The callback retains its then-current
87-row uncached update. Subsequent full captures retain the completed nested
update; `merged-upstream.json` deduplicates by owner/index/start serial/slot and
selects the longest copy. Raw captures remain available.

| Input or boundary | Copied value / observation |
| --- | --- |
| Updater entry | `0x431e30`, serial 93484, actual owner `0x0884a260`, index 72 |
| Cache flag address/value | `0x0884a158`, byte `0`; uncached path delivered at `0x431e52` |
| Parent address/value | `0x0884a210`, word `4`; observed parent path `0x431f02` |
| Index-72 channel table address | `0x00c34cfc` |
| Four table words | `003f0000 003f0001 ffffffff ffffffff` |
| Channel 0 record / weight field | `0x0884a28c` / `0x0884a298`, weight bits `00000000` |
| Channel 1 record / weight field | `0x0884a2bc` / `0x0884a2c8`, weight bits `00000000` |
| Compare threshold | `[0x54ef74]`, bits `00000000` |
| Active channel key | 63 for each of channels 0 and 1 |
| Channel decisions | serials 93508 and 93510, both delivered at skip target `0x4314c7` |
| Decomposition at builder entry | `0x074ff0a8`, serial 93512: nine zero words, then `3f800000` |
| Copied scale words | all three `00000000`; x87 control word `0x023f` |
| Palette destination | `0x032e7a34` |
| Rotation before scale stores | identity at `0x430e23`, serial 93545 |
| Palette after scale stores | fifteen zero words followed by `3f800000`, serial 93570 |

Read-only guest disassembly in the prior run shows `0x431364..0x43137b`
initializing nine decomposition words to zero and `0x43137e` setting quaternion
W to 1. The copied words match that initialization before the first active
channel comparison and remain unchanged through builder entry. Both active
channel comparisons skip. The two sentinel slots are present in the copied
table, but their individual branch boundaries were not delivered; this report
does not count four independently observed skips. The optional analyzer check
requiring four delivered skips therefore remains empty.

At each active comparison, native x87 gives equality (`C3=1,C2=0,C0=0`, masked
condition bits `0x4000`); the captured status word is `0x4084`, and the observed
`FNSTSW AX; TEST AH,0x41; JNZ` branch skips. This agrees with Intel's documented
FCOMP condition bits. The comparison has no Win32 API behavior to resolve.
See [Intel SDM Volume 2A, FCOM/FCOMP/FCOMPP, pages 3-324–325](https://cdrdv2.intel.com/v1/dl/getContent/671199).

Nine actual stores attributed to guest PCs `0x430e39`, `0x430e41`, `0x430e4a`,
`0x430e53`, `0x430e5c`, `0x430e65`, `0x430e6e`, `0x430e77`, and `0x430e81`
have copied pre/post operands. Native `FLD m32; FMUL m32; FSTP m32`, using the
copied `0x023f` control word, predicts all nine results exactly: the identity
basis multiplied by positive zero becomes positive zero. This follows the
precision/rounding and store rules documented in
[Intel SDM Volume 2A, FMUL and FST/FSTP](https://cdrdv2.intel.com/v1/dl/getContent/671199).
Zero scale alone establishes no defect.

The completed zero update contains six nested builder calls, all with zero
scale words: 54 checked multiply/store results and 12 active-channel decisions.
The six distinct retained root updates together contain **99 multiply/store
checks, 17 channel decisions, and 15 cache/parent decisions**, with no mismatch,
no unresolved retained decisions, and no omitted update rows. These counts are
coverage of captured operations, not qualification of earlier unobserved work.
The decoder reports 385055 mapping arrivals; its bounded relocation/eviction
records and the production owningWorker store attribution are retained.

A later update on the **same owner** starts at serial **96456**. Its table now
begins `003f0000 003fffff ffffffff ffffffff`; channel 0's weight field is
`3f800000` (1.0), its comparison takes `0x4313c3`, and the copied scale words are
`3f7ffffc 3f7ffff8 3f7ffffd`. All nine subsequent scale stores also match native
x87. This establishes a changing input boundary, without establishing why the
earlier weights were zero or whether that state should have reached a draw.

## Rendering and observation limits

The same original session reaches an unsuppressed
`D3D9 fixed function: singular normal transform` at render sequence 72745
(device 136450064, generation 1). The captured WORLD basis is zero, with
translation `(38.767112731933594, 248.01272583007812, 16.380149841308594)` and W=1.
`producer-final-state.json` retains the error, WORLD provenance, command, and
executor stack. This is downstream corroboration; the previously proved copy
chain is not re-diagnosed here. No guest instructions or data were modified and
no rendering error was suppressed.

Personally inspected captures show the menu, Warrior selection, Kordava load,
and cinematic town/character/subtitle images, followed by a black render area.
The final and normal-close captures were also inspected. Cinematic content is
not gameplay; no gameplay, FPS, or audio success is claimed.

The next useful observation is the writer and arithmetic/control inputs for
`owner+0x38` and `owner+0x68` (the two weight fields), paired with channel-table
production and the draw scheduling/consumer boundary. These producers were not
captured by this observer. Their zero values must not be replaced with invented
weights or treated as an emulator bug without an independent expected result.

## Validation and reproducibility

The ordered Caps0135 then Aranna0205 releases were followed by independent
cleanup verification before any build/control/runtime. The immutable window is
**03:10:25.039152–03:55:25.039152 UTC**. There was exactly one improved original,
launched by trusted input at **03:13:19.358**, and normal shutdown completed at
**03:38:54.743**, with Chrome exit 0. No boxes or subworkers were used.

`flock /tmp/wine-build.lock bash tools/build.sh` passed. Standard/compat baseline
and diagnostic modules were built from the same current closure:
`dba4d3b013cc1f620d76cf7ae984c28d428c88c4e8b239894f6dddcd72b215b4`.
Baselines were byte-identical to the shipped modules. Imports and exports were
compared exactly, with no normalization.

| Module | SHA-256 |
| --- | --- |
| Standard baseline | `881a4ffc816bb2a752febff01551ade99dfc5680dc8a3a6a4222f0bb8d2c1951` |
| Compat baseline | `721dea351a4ac638cc275b9fa30101be050b0836eb6d44de0230e9edb38e2079` |
| Standard diagnostic | `2ee0e6b792b0950dac548bf107bfe0e00d59214c9349e5aaafa810902195078c` |
| Compat diagnostic | `feb84c1c90bd284b6fa86c7cbc6e1787323e5f1943bb243e3396b5305f90ba52` |

Passed controls: 20 real production owningWorker producer cases (scalar,
FSTP, REP, fused x87 island, palette; baseline/diagnostic in both module modes),
16 real guest SEH/pager cases, and 24 independent native x87 oracle cases.
They validate passive unmapped reads, exact-width flag/parent reads, decoder
publication/relocation/eviction, actual guest-PC store attribution, and matching
architectural registers, flags, FPU environment/save state, thread behavior and
fault delivery. Reserved-page cases deliver the guest handler exactly once;
committed sparse pages do not acquire extra faults. Strict singular-render
failure remains enabled. Fixture and helper syntax checks also passed.

`preoriginal-closure.json` records a fresh closure, module, shipped-byte,
exact-contract, tested-control-hash and tracked/untracked source/helper check
immediately before the trusted launch. `runtime-evidence-verification.json`
verifies 301 runtime source files and actual page, owning CPU worker, and render
worker WebAssembly identities, plus 18 served JS scripts. Post-runtime checking
also verifies all 314 pinned tracked paths, one untracked runtime source, and the
same closure; runtime observer helpers remain unchanged.

Postprocessing corrections are explicit and preserved. An initial false cache
candidate looked past the actual `0x431e52` uncached path into a nested cached
parent; `first-candidate-rejection.json` rejects it using the actual path and
read-only instruction semantics. The merger was corrected to exclude its own
output and deduplicate independently of source key format; pre-dedup artifacts
are retained, and a repeated merge has an identical hash. Nested channel indices
are derived from the documented table offset (`index*16`), with the raw boundary
index retained. Only analyzer/merger helpers changed after launch; their original
and final new-file patches are both retained. No guest/runtime change followed
these analysis corrections.

Exact Git SHA, relevant binary diffs, untracked-source patches and run-helper
new-file patches provide source recovery; no source archives were made.
All 37 media file hashes and registration inputs were checked in place at
`scratch/game-media/conan-installed-20261105/`; EXE SHA-256:
`c343ef6a51a88c5b01a3c3e1511035359d25336fbe010123bd2e02962b77df56`.
No media copies were created.

Independent cleanup passed: 118 absent owned PIDs, six refused ports, six absent
profiles, four free locks, no heavy processes, and more than 1.5 GB free disk.
The board watcher is separately checked absent before final release. Box
ID/state/expiry: not applicable. Artifact hashes are reopened and verified;
`result.json` is written last after publication and final cleanup.
