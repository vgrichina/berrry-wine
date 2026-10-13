# FP island predecode: P / A factorial

Follow-up: [native code in both engines/architectures and sampled hot paths](fp-native-review.md).
That review distinguishes eager TurboFan from normally tiered code and revises
the next-experiment priority toward measured loop bookkeeping costs.

Combination follow-up: [P/C/D matrix, native review and game checks](fp-combinations.md).

2026-10-01. Isolated follow-up to [the pure/mixed island split](mixed-island-census.md).
Production source and defaults are unchanged. All candidates derive from
frozen `837f0a74`, using its matching JS runner and game fixtures.

## What is being compared

```text
                    current threaded records (already decoded x86)
                                      |
             +------------------------+------------------------+
             |                        |                        |
       control: split           P: precise FP             A: operand
       pure/mixed loops         selector once             preparation
             |                  during decode             during decode
             |                        |                        |
       group/reg switches       selector br_table        base register's
       during execution         during execution         byte offset packed
             |                        +-----------+------------+
             |                                    |
             +------------------------------ compare P+A
```

P assigns 52 precise operation selectors to common arithmetic, loads, stores,
stack-register operations and integer conversions. Unsupported selectors use
the canonical FP helpers. Some uncommon operations that the control handles
inline therefore take the fallback in P; this is a measured prototype, not a
complete replacement. Arithmetic order and dynamic memory access are retained.

A packs the base-register byte offset into the operand's spare bits. It does
not cache a guest address or a thread's register-file address. Importantly,
this encoding still needs a shift and mask to extract the offset: it tests
this particular representation, not the best possible operand preparation.

P+A combines the two transformations. All arms retain the earlier pure/mixed
split and absorb the same ADD/INC/DEC bridges. Threaded record lengths and
address words are unchanged. The original operand remains in the low 12 bits.

The legacy block executor is **unsupported in the experimental encoding**:
preparation traps if that executor is enabled. The measured configuration uses
the current uop tier with the legacy block executor disabled. Integration with
its saved pre-fusion descriptors is required before any production proposal.

## Correctness and the overlap bug

Each candidate passes 1,000 deterministic randomized sequences (33,138
operations), comparing the fast island, generic island and unfused execution.
The comparison includes guest GPRs, memory, FP values/tags/status, lazy flags
and exception trace. All FP fuser mask bits are enabled; affine emission stays
disabled as in the inherited fuzzer. Every sequence has an explicit
older-fuser/island overlap regression appended.

The first prototype passed island-only fuzzing but trapped in Moorhuhn 3 and
Quake II. Earlier fusers leave their absorbed records in OP_INDEX. An unused
H451 descriptor can start inside an earlier fused span and extend beyond it:

```text
executed:  [------ older fused operation ------]  FP5  FP6
records:    FP1   FP2   FP3   FP4                 FP5  FP6
unused:          [------------ H451 island ---------------]
                              |
bad scan:        prepares the unused H451, including FP5/FP6
                 -> standalone FP handler reads metadata as opcode bits
fixed scan: skips the older fused operation's entire owned span
                 -> FP5/FP6 remain ordinary operands; no runtime check added
```

The corrected pass walks executable fused spans with `x87_fused_span` rather
than visiting every original instruction. The corrected P smoke completes
both games. The invalid v1 artifacts and their timings are excluded.

## Reproduction

Build each of `p`, `a`, `pa` into a fresh directory:

```sh
FP_PREDECODE=p node tools/bench-mw3-mixed-build.js 837f0a74 \
  build/lazy-games/fp-predecode-p2 \
  build/lazy-games/mw3-mixed3/baseline.wasm --fp-predecode

FP_PREDECODE=p FP_ALL_FUSERS=1 X87_FUZZ_CASES=1000 \
  node tools/bench-mw3-mixed-parity.js \
  build/lazy-games/mw3-mixed3 --fp-predecode
```

The builder first reproduces the original baseline byte-for-byte, then applies
the virtual-source transformations. It does not edit production WAT files.

| Arm | SHA-256 |
|---|---|
| Split control | `ac551603e51942e2d3ab78fb7dffb43249d216e206fe8f46f274a918e659f30f` |
| P | `bd854597ad90ce0e8023f2f6fec61d190c723cedffb3850d23bf147d1a54434b` |
| A | `dd0266b2f53fa07cc14e081ef483dc800fd8911e38967edf65d2bebf11a66883` |
| P+A | `b88ee0a2aa49cacbf4cea2fcd4a6a61c851c3eeb657a9a8969b76c244d0b86db` |

## Measurement protocol

Dedicated ASCII box `bx_4r5uzdwv`, this time reporting AMD Ryzen 9 9950X,
four virtual CPUs under KVM, Node 24.18.1. Do not compare absolute times with
its previous EPYC/Skylake restores. The serial game order is Moorhuhn 3,
Quake II, Heroes III, Heroes II. Within each game:

```text
control -> P -> A -> P+A -> P+A -> A -> P -> control
```

Each launch uses the existing fixed input route, pinned guest calendar,
branch clock, uop tier and cooperative guest threads. Whole-process **user CPU
seconds** include startup, JIT, host rendering and all cooperative threads.
These are fixed-work measurements, **not FPS**. `--slice-split` only measures
the initial main-instance run, so its phases are not aggregate guest CPU.

Final batches, API totals, workload counters and pixel equality must agree
before interpreting timing. Exit zero alone is insufficient: this runner can
return zero when a missing asset prevents guest execution. Restored assets and
type libraries were preflighted before starting the sweep.

MW3 additionally uses the actual projection-loop bytes copied from its EXE,
500,000 vertices, 12 warmup pairs and ten alternating ABBA/BAAB groups.
The metric is median host thread CPU time. Both normal and special FP inputs
must match output hashes, integer/FP state and dispatched handler counts.
`MIXED_CONTROL=1` asserts that the control already absorbs integer bridges.
Same-artifact A/A runs measure repeat variation.

Raw artifacts: `build/lazy-games/fp-factorial/` (remote results after download)
and `build/lazy-games/fp-factorial-local/` (laptop kernel).

## Four-game results

Each cell is the mean of two launches. Negative change means less CPU.
The control spread is the difference between its two launches divided by
their mean; it is a repeatability check, not a confidence interval.

| Game | Control CPU s | P CPU s / change | A CPU s / change | P+A CPU s / change | Control spread |
|---|---:|---:|---:|---:|---:|
| Moorhuhn 3 | 10.660 | 10.555 / −0.98% | 10.730 / +0.66% | 10.545 / −1.08% | 1.69% |
| Quake II | 5.095 | 5.060 / −0.69% | 5.155 / +1.18% | 5.095 / 0.00% | 0.59% |
| Heroes III | 38.090 | 37.705 / −1.01% | 38.170 / +0.21% | 37.075 / −2.66% | 3.78% |
| Heroes II | 1.755 | 1.745 / −0.57% | 1.765 / +0.57% | 1.810 / +3.13% | 3.99% |

All **32 runs** completed their expected routes. Every final frame matches
its control pixel-for-pixel. API totals match (MH3 492,944; Q2 77,469;
H3 87,011,857; H2 695,972), as does the entire main-instance uop summary
including installs, enters, blocks and compiled instruction counts. Visual
inspection confirms the shooting field, an in-level Quake II view and both
Heroes adventure maps. Validation is executable:

```sh
node tools/bench-fp-predecode-report.js build/lazy-games/fp-factorial/corpus \
  > build/lazy-games/fp-factorial/summary.json
```

P's small consistent direction is worth retaining as a candidate, but this
two-launch sweep does not establish a broad game-level win. A has no useful
signal. P+A does not show a reliable additive benefit. Heroes III's apparent
gain and Heroes II's apparent regression are both smaller than their control
repeat spreads. A longer or more tightly controlled measurement is needed to
resolve effects at that scale.

## MW3 projection kernel

All comparisons pass normal/special-input state and output parity, with equal
dispatched handler counts. Milliseconds below are median thread CPU per
500,000 vertices; they are not a whole MW3 frame or gameplay measurement.

| Host / candidate | Control ms | Candidate ms | Change |
|---|---:|---:|---:|
| Apple M1 / P | 58.183 | 55.082 | −5.33% |
| Apple M1 / P, reversed instantiation order | 50.813 | 49.224 | −3.13% |
| Apple M1 / A | 78.233 | 78.507 | +0.35% |
| Apple M1 / P+A | 53.407 | 53.454 | +0.09% |
| Apple M1 / same-artifact A/A | 50.944 | 51.993 | +2.06% |
| Ryzen 9950X / P | 29.991 | 26.000 | −13.31% |
| Ryzen 9950X / P, reversed instantiation order | 29.990 | 26.000 | −13.30% |
| Ryzen 9950X / A | 29.991 | 30.000 | +0.03% |
| Ryzen 9950X / P+A | 29.001 | 25.010 | −13.76% |
| Ryzen 9950X / same-artifact A/A | 29.011 | 29.999 | +3.41% |

Laptop: Apple M1, Node 24.21.0 / V8 13.6.233.17-node.53, shared machine with
load varying roughly 2–6. Its absolute control time moves considerably across
processes; compare only each paired run. The same-artifact differences and
Linux's coarse CPU accounting limit the precision of small deltas.

## Decision

Keep **P** as an isolated candidate. It helps this authentic FP-heavy kernel,
but the four-game evidence does not justify changing defaults. Do not carry
the current A representation forward on performance grounds: extracting its
packed offset replaces one shift/mask pair with another. P+A adds no established
benefit over P and loses the laptop kernel improvement in this experiment.

The next distinct experiment should retain more FP stack values in locals
(F), measured alone and with P. An improved A would need an encoding that
actually removes operand extraction work. Joining the integer uop and x87
engines is still a separate experiment; none of these results licenses that
larger change. Legacy block-executor integration remains open before promotion.
