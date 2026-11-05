# Conan: nonsingular producer result becomes zero before WORLD submission

NEW-GAME-CONAN-DEMO-20261010 remains short of verified player-controlled gameplay.
One changed original session narrowed the first unresolved producer interval to
**guest 0x42a42e → 0x42a5a6**, on the same CPU thread, stack frame, node and matrix.
The matrix is nonsingular after the node method returns and has twelve zero
words at the second boundary. No causal emulator mismatch was isolated, so this
change publishes findings only. It does not diagnose a game bug or repair the
renderer by accepting singular state.

Evidence is `scratch/runs/20261105-conan-upstream-world-producer/` (ignored).
`verified-boundary.json` records the passing offline assertions;
`first-producer-boundary.json` contains the selected raw words, registers, stack,
x87 state and decoded values. The preceding boundary and its passive diagnostic
commits are documented in [the WORLD-writer note](conan-world-writer-20261105.md).

## Exact observed boundary

All following rows are copied from the actual owning guest Worker: endpoint 1,
slot 0, guest thread 1. The matrix address is **0x74ff2d0**. Every selected row has
zero unavailable reads. At both interval endpoints ESP is **0x74ff1ec** and the
renderer caller's node is **0x88496f0**.

| Diagnostic serial | Guest boundary | Observed matrix |
| --- | --- | --- |
| 32195 | 0x42a41c, before node-method call | Destination scratch contents; not a producer result |
| 32196 | 0x4ab9f0, composer entry | Destination still scratch; input node is 0x884ae70 |
| 32197 | 0x42a42e, node-method return | Rotation/translation, determinant 0.9999999826119712 |
| 32198 | 0x42a5a6 | First twelve words are +0; determinant 0 |
| 32199 | 0x42a5bf | Same zero words |
| 32200 | 0x42a65f | Same zero words |
| 32201 | 0x41c990, consumer entry | Same zero words; return address 0x42a71c |
| 32202 | 0x41ccee, WORLD-writer block | Same zero words |

The nonsingular result at serial 32197 is approximately:

```text
 0.79863548  0.60181504  0  0
-0.60181504  0.79863548 -0  0
-0           0           1  0
38.76711273 248.01272583 16.38014984 1
```

The translation and homogeneous last word remain **bit-for-bit unchanged** when
its first twelve words become zero. The final words are exactly:

```text
0 0 0 0 0 0 0 0 0 0 0 0 1109070214 1131938626 1099106956 1065353216
```

The forwarded composer input at serial 32196 has scale `(1,1,1)` and finite
quaternion `(0,0,-0.31730467081069946,0.948323667049408)`. Its return address is
0x492d32, after the call in node method 0x492cf0. This method can forward to
another node; the renderer node and composer node differ here. The measured
nonsingular return rules out blaming this composer invocation's output for the
subsequent zero matrix. A later first-zero-at-composer-entry packet observes
reused destination scratch, not a returned composer result.

The consumer's actual return 0x42a71c confirms the indirect call at 0x42a716.
Its fifth argument is the matrix pointer: `[entry ESP+0x14]`, later
`[consumer block ESP+0xe4]`. Its tenth argument identifies the renderer node:
`[entry ESP+0x28]`, later `[consumer block ESP+0xf8]`. These offsets and copied
registers/stack establish the join; two uses of a stack address alone would not.

## Strict failure and the remaining gap

The original first fails with `D3D9 fixed function: singular normal transform`
at **queue 72140, completed prefix 72139, device 136450064, generation 1,
endpoint 1**. Its first-zero WORLD snapshot is also queue 72140. The last live
writer is SetTransform (operation 2), block 0x41ccee, return 0x41cd09,
source guest 0x74ff2d0. Its source words, stored WORLD words, lowered snapshot
and executor words all match the words above. The previous run failed at queue
66517; this run reproduces the same matrix contents and strict error with a
different preceding command count.

**The measured interval contains multiple calls.** In particular, 0x42a5a6 is
the return from `0x42a5a1 → 0x41cfd0`, but there is no observation at that
callee's entry. Calls earlier in the interval include 0x401000, 0x43a110,
indirect node/renderer methods and conditionally 0x458c10/0x412e80. Their actual
branch sequence and the first store that changes the matrix are not captured.
It would therefore overstate this result to attribute the mutation to 0x41cfd0
alone.

Read-only disassembly identifies candidate matrix-producing paths inside
0x41cfd0: 0x431bc0, table-derived matrix pointers through 0x4130a0/0x431ff0,
products through 0x414f60, and REP MOVSD copies back into the supplied matrix.
Those paths and their operand matrices are **not dynamically distinguished**.
The explicit inverse-helper call `0x42a5ba → 0x415450` is after serial 32198's
zero observation, so that call site cannot be the first zero-producing step.
MultiplyTransform remains the old success-noop; this observation does not
establish it as the cause.

The next bounded observation should locate the first write to this 64-byte
matrix in **0x42a42e–0x42a5a6**, preserving the store's PC, operands and active
call context. If the write is a product or copy, capture its input matrices and
their producer before testing documented x86 semantics. No second original
session or live instrumentation change was attempted here.

## Passivity controls and limits

Before the original, a run-owned compiler transform added copied-value packets
at selected delivered block boundaries. It never calls guest setters, evaluates
lazy flags, changes the debug mode, plants breakpoints, materializes DIB memory,
or calls the faulting `g2w`/`gl32` readers. Reads use the direct affine window or
already-PRESENT sparse PTEs and return an explicit unavailable word on rejected
reads. Raw x87 physical words/top/control/status/tag are copied without popping
or evaluating the stack. Guest disassembly is evidence only.

An independently generated ordinary x86 PE ran through the production owning
CPU Worker and shared WebGL Worker with both baseline and diagnostic modules.
Its ordinary FLD/FADDP/FSTP result and a CMP/JNE branch survive observation;
unmapped object observation does not cause a guest fault. Existing public COM
controls additionally preserve copied setter inputs, state-block origins,
Reset identity, all twelve writer routes, queue correlation, the old Multiply
no-op observation, and the original strict lit-singular draw error. Final
`producer-controls.json` is PASS. The first un-stamped control pass is preserved
in `controls-unstamped/`; the final stamped controls passed before launch.

This proves the tested functional passivity cases, not universal timing
invariance or complete CPU correctness. The original delivered **40,185**
complete snapshots with zero packet errors or incomplete packets. The
1,000,000-snapshot cap was not reached. The host keeps 128 recent rows, 64 zero
events with 16 preceding rows, and four writer rows per node for at most 1,024
nodes. First zero at each watched PC is saved immediately. Interior fused
instructions and discarded history remain unobserved. The 1,745 captured
completed initial scale-read nodes had no all-zero scale; that is not an
exhaustive inventory of node constructors or later writes.

For semantics, the [Microsoft SetTransform contract](https://learn.microsoft.com/en-us/windows/win32/api/d3d9/nf-d3d9-idirect3ddevice9-settransform)
identifies the supplied matrix as the transform input. The
[Intel architecture manuals](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
are the reference for x87 arithmetic, stack operations and stores. No observed
instruction here was shown to violate those contracts. A mathematical
quaternion cross-check in the offline helper is explicitly not a bit-exact
instruction oracle.

## Recovery, ordinary input and cleanup

Compilation was pinned to Git **25cd5f11331d880ea27277b8b2f0427fdf1bcee2**;
launch was pinned to **71a0ca4706f6a0dc0724eb6014569985f0c6bcfb**. The intervening
change is coordinator documentation. `identity-verification.json` verifies
301 relevant source files unchanged, 18 served JavaScript script identities,
and the diagnostic module in three actual page/guest/render contexts.
Relevant tracked binary diffs are empty; the pre-existing untracked
`lib/wininit-boot.js` is recorded as a new-file patch without editing it.
`diagnostic.source.patch` records the run-owned instrumentation hunks, and
helper identities are recorded separately. No source archive was made.

| Module | Bytes | SHA-256 |
| --- | ---: | --- |
| Baseline, byte-identical to shipped production | 2175008 | `3d59cca0579d2ccfdec1561d7403c371af771943f6c8385ce814eacb008c6821` |
| Diagnostic actually executed | 2176480 | `1c6a57797a3e29d5f6d6837d66ea72a8b160cc9620c494abe62eaa66ddfe5525` |

The existing installation at
`scratch/game-media/conan-installed-20261105/` was hashed in place: all 37 files
match its manifest, manifest SHA-256
`adf7c78e9ab56519edd53479b2151f04e18496668dec450ba2af12cc0b90cd38`,
registry SHA-256
`64969ff6f94d58b54431e18f937af3374bda5755e233ad62517840e1611d8de3`.
No game media was copied.

The ordered predecessor releases and independent cleanup passed at
**23:33:40.622874 UTC**, establishing a fixed deadline of **00:18:40.622874 UTC**.
The single original launched at 23:36:20 and closed normally at 23:48:59,
exit 0. Captures were inspected before each ordinary key action: Escape to the
main menu, Enter to Difficulty, an initially unaccepted short Enter, then an
accepted longer Enter to Kordava loading. `kordava-loading.png` is still the
Difficulty screen despite its filename; `warrior-confirmed.png` shows actual
loading. Later captures show the town/street/temple cinematic. Escape did not
establish a skip to player control. No player movement plus second response was
verified. FPS and audio remain unknown.

No shared production code changed, so there is no causal fix or code regression
commit and no code-change full-build requirement to claim. The two run modules
were compiled under `/tmp/wine-build.lock`; generated production controls and
offline boundary/identity assertions passed. Final owned-process, port, profile,
lock and disk checks are recorded in `owned-runtime-cleanup.json`. No boxes,
public deployment or Heroes II were used.
