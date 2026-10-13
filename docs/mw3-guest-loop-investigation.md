# MW3 guest execution investigation — 2026-09-30

The strongest structural opportunity is executing mixed x87/integer loops as
larger regions. The integer uop tier is active, but rejects the hot floating-point
heads. A smaller experiment allowing two-instruction x87 islands passed focused
parity tests; it has **no demonstrated whole-game speedup**. Production code and
the canonical WASM were not changed by this investigation.

## Real-game evidence

Two 15-second gameplay census windows on remote BOX8 retained 302 and 297
presents. Original EXE addresses, with executions per present:

| Head | Work found by disassembly | Window 1 | Window 2 |
|---|---|---:|---:|
| `0x4fd394` | Reciprocal depth, projection, float stores | 4,420 | 4,428 |
| `0x51bc31` | Clamp/compare float array | 3,589 | 3,595 |
| `0x51bf10` | Float-to-index trigonometric table lookup | 3,590 | 3,595 |
| `0x5242fd` | Squared-length/threshold calculations | 3,479 | 3,483 |

These are entry counts, **not CPU percentages**. Block-histogram collision
counts were about 0.3% of retained entries. Region grouping is by address
proximity, not control flow. DLL addresses from the first capture are not
attributed here because that capture lacks the later module-base snapshot.

The uop tier executed 60.2/61.3 million blocks, averaging 7.72/7.64 blocks per
entry, with zero failed memory guards. It is not globally disabled or constantly
failing guards. The census instead shows hot float heads rejected at FLD/FCOMP:
the compiler has no x87 lowering. Around four compile declines per present recur
through verdict-cache aliasing; this is a secondary opportunity, not an
established dominant cost.

The projection loop computes a reciprocal, updates integer pointers/counter,
then performs further x87 arithmetic and stores before branching. These integer
instructions split floating-point islands. The clamp loop repeatedly uses
`FLD; FCOMP; FNSTSW AX; TEST AH; Jcc`. The status/test/branch already has a fused
handler, but the two floating-point operations miss the island minimum of three.
ST0/TOP/tag caching already exists inside the fast island evaluator. Likewise,
the frequently entered `_ftol` trampoline already has a native optimization.

## Isolated two-instruction experiment

`tools/bench-mw3-x87-build.js` first reproduces the frozen baseline byte-for-byte,
then changes only the x87 island minimum from three operations to two in the
compiler's virtual source inputs. It writes a separate candidate artifact.

* Baseline SHA-256: `2c3477ace32507c4f24c252eafd49ae24ce0e6bfda872ee391f05c7aae4d7878`
* Candidate SHA-256: `19030aeb908b9c76dcae0c28c4590e71504c89a68d648313afc06e42401cc0be`

The candidate census increased island executions from 75–77k to 181–190k per
present and reduced scalar FPU-memory handlers from 258–273k to 84–89k. Total
handler work did not decrease across those independent launches. Census FPS
was 20.11/19.77 baseline and 19.50/19.36 candidate; this is instrumented,
scene-dependent evidence, not a causal speed comparison. Candidate load rose
to 4.18, and its first window had 96 fallback events versus zero in its second.
Both windows had zero GPU errors; the inspected gameplay capture looked intact.

Validation:

* `X87_FUZZ_CASES=1000 node tools/bench-mw3-x87-pairs.js`: PASS. Runs existing
  x87 fast/generic/unfused state and output comparisons with two-op sequences
  and the isolated source transform. This uses the local source tree, not the
  frozen remote binary.
* `tools/bench-mw3-clamp-kernel.js`: copies the original EXE loop
  `0x51bc31..0x51bc7a`, preserving its instructions and absolute constants, into
  each exact WASM artifact. Runs 100,000 array elements containing zero, 0.5,
  1, 2, -1 and quiet NaN. Complete output and checked register/FPU/flag state
  match in both run orders. Eight warmups precede eight measured runs per arm.

Local Node 24 main-thread CPU medians (milliseconds per 100,000 elements):

| Run order | Baseline | Candidate | Reduction |
|---|---:|---:|---:|
| Baseline then candidate | 29.968 | 28.340 | 5.43% |
| Candidate then baseline | 28.045 | 27.963 | 0.29% |

The host was heavily loaded. Thread CPU excludes descheduling and background
compiler threads, but not frequency/thermal differences; the order sensitivity
means this is not a reliable magnitude of improvement. Nor does a copied-loop
result establish game FPS. The older `clamp-kernel.json` using whole-process CPU
is superseded by the `clamp-kernel-thread-{ab,ba}.json` files.

BOX8 stopped responding during the clean candidate gameplay timing run. That
run is excluded; remote process cleanup could not be verified. The candidate
was subsequently reconstructed locally from the frozen baseline and named
function map, changing the unique count-threshold instruction; its hash exactly
matches the candidate built remotely before the outage.

## Next experiments

1. Finish clean real-game ABBA plus repeated-baseline controls before accepting
   the two-op change. Preserve scene/work counters and screenshots.
2. Prototype a bounded mixed x87/integer region for the projection loop, reusing
   existing x87 semantics. Crossing pointer updates and the loop backedge can
   remove more dispatch/state traffic than joining one pair. Preserve operation
   order, f32 store rounding, NaNs, status flags and memory-fault behavior; the
   current evidence does not justify SIMD reassociation or approximate math.
3. Measure before broadening to the clamp and table-lookup families. Their stable
   counts establish repeatable workloads, not the amount of CPU a change saves.

Local artifacts: `build/lazy-games/mw3-loops1/` (baseline census and decoded
summaries), `build/lazy-games/mw3-loops-min2/` (candidate census, captures,
candidate WASM and copied-kernel results). The diagnostic switch is
`node tools/bench-lazy-games.js --app=mw3 --shipped-default --guest-census
--seconds=15 --samples=2 --wasm=PATH --out=DIR`. See also the
[whole-frame profile](mw3-whole-frame-profile.md) for actual sampled CPU costs.
