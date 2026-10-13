# FP island combinations: P / C / D

2026-10-01. Isolated experiments based on frozen revision `837f0a74`; no production default changed. This continues [the predecode factorial](fp-predecode-factorial.md) and [native review](fp-native-review.md).

Follow-up: [P versus P+C in actual MW3 and five other games](fp-pc-game-followup.md).

## What was combined

```text
control = separate pure-FP and mixed integer/FP evaluators
   P    = predecode precise FP semantic selector
   C    = count remaining records down to zero
   D    = compact address tags + three-way address dispatch

             P       C       D
control      .       .       .
P            x       .       .
C            .       x       .
PC           x       x       .
D            .       .       x
PD           x       .       x
CD           .       x       x
PCD          x       x       x
```

D rewrites only records owned by live islands: H188/H189/H190 become tags 0/1/2. Integer bridges keep their handler IDs, so the mixed evaluator classifies values >=3 as integer operations. It skips spans owned by earlier fusers. Dynamic guest addresses, guest memory checks, fault behavior and dirty tracking remain intact. **PD still performs address selection and semantic selection separately**; this does not test a fused address-plus-operation selector. Additional FP value caching is also outside this matrix.

P/D deliberately reject the legacy block executor. All measurements use the uop executor, matching frozen host code; this is not ready to enable for every execution mode.

## Correctness and reproducibility

`tools/bench-fp-combos.js` transforms frozen sources; `tools/bench-mw3-mixed-build.js --fp-combos` builds them. Set `FP_COMBO` to an arm name. `tools/bench-fp-combos-run.js` runs the serial native/kernel/tiered/game matrix.

The dedicated remote builder first reproduced the original baseline SHA-256 `c1c92840fde2c9ae2809154ea64ea9ab91b11effdb0a541099b695f1567a6b93`, then built the eight variants. Control/P also reproduced the preceding experiment's bytes. Modules and full hashes are in `build/lazy-games/fp-combos/<arm>/build.json`.

Each new arm C/PC/D/PD/CD/PCD passed 1,000 differential sequences containing 34,428 operations, comparing fast, generic and unfused execution. Checks cover registers, memory, FP values/tags/status, lazy flags and exception traces. All earlier fusers were enabled (mask31, affine emission disabled), including overlapping-owned-span regression and lengths crossing the 255-record island boundary.

Both architectures passed kernel normal/special-input parity and dispatch-count checks for all eight arms. All 64 game captures also passed pixel, API, batch and uop-counter equality against their game control. Control frames were visually inspected: Moorhuhn gameplay, Quake II gameplay, and both Heroes adventure maps.

Artifacts: `build/lazy-games/fp-combos-results/`. ARM64 uses Apple M1, Node24.21 / V8 13.6 node.53, SpiderMonkey155. x64 uses Ryzen9 9950X (4-vCPU dedicated box), Node24.18.1 / V8 13.6 node.50, SpiderMonkey158. Exact versions, hashes, commands and host load are in capture/host JSON files. The laptop was busy; its small timing differences are provisional.

| Arm | Candidate SHA-256 |
|---|---|
| control | `ac551603e51942e2d3ab78fb7dffb43249d216e206fe8f46f274a918e659f30f` |
| p | `bd854597ad90ce0e8023f2f6fec61d190c723cedffb3850d23bf147d1a54434b` |
| c | `29a102a16fec49b3fa67f6ed6328cd38f48c89b43a51e3cbe94b077fcfe470ff` |
| pc | `8e503d1e1588ca5292af82d63e56ba07eb6dca5d6c0803f161459b96fc8fb4d9` |
| d | `6fef14823ca7ced9905cbcddadf11a65f424e7ea25912b9ad070e1b011d17ad0` |
| pd | `adbced703c80e97f48785fe630be169bb2a2c3c238454caf8d1ffaab61045ddd` |
| cd | `a49dd0d159e1e7ef96d0496e5a6186a518ceea99249936f1405895967fdaba4f` |
| pcd | `8f8aed1a40051cc276dfb557d9ee1ddcf9c7114281919c3a6df4563f7ee778a4` |

## Copied MW3 projection kernel

500,000 vertices, 12 warmup pairs, ten alternating ABBA/BAAB groups. Each candidate is paired with control within its own process. These are median thread-CPU kernel improvements, **not whole-game FPS gains**. Negative means less time. Linux CPU samples fall into approximately 1ms bins.

| Arm | M1 vs control | Ryzen vs control |
|---|---:|---:|
| Same-artifact control | +0.7% | 0.0% |
| P | -4.0% | -9.4% |
| C | -1.2% | -3.1% |
| PC | -4.5% | -12.5% |
| D | +0.6% | -9.1% |
| PD | -3.0% | -12.5% |
| CD | +0.8% | -12.1% |
| PCD | -4.0% | -12.2% |

A direct M1 P-versus-PC pair measured 51.359ms versus 50.978ms (-0.74%), similar to the same-artifact variation. There is no convincing additional M1 gain from C yet. A direct Ryzen comparison measured P 29.000ms versus PC 28.001ms (**-3.4%**). Adding D did not help in either direct check: PC 26.990ms versus PCD 35.991ms (+33.3%), then reverse-order PCD 27.985ms versus PC 27.009ms (PCD +3.6%). The first PCD result is an unexplained outlier, retained in the evidence. These checks do not establish a stable slowdown magnitude; they do rule out claiming a demonstrated extra gain from D. Different normally tiered code placement/compilation is a possibility, not a proven cause.

## Native code and sampled execution

All eight arms have V8 and SpiderMonkey native captures on both architectures (32 captures), plus normal-tier V8 execution/disassembly captures for every arm on both architectures (16). Eager forced-optimized captures are kept separate from normally tiered code, since their inlining/code generation differs. SpiderMonkey review is structural, not a SpiderMonkey performance benchmark.

The countdown survives compilation. Normal V8 PC on M1 ends its loop with a remaining-count reload, `sub #1`, and `cbnz`; x64 uses a reload, `add $0xffffffff`, and `jne`. Both retain a counter spill, but no longer load and compare an independent limit each iteration.

D does not universally produce the requested jump table: V8 turns the three address cases into comparisons. SpiderMonkey Ion emits an additional indirect address dispatch ahead of semantic dispatch. This explains a structural reason D need not stack, but is not proof that the extra dispatch caused a measured timing difference.

Normal-tier V8 mixed-evaluator body sizes:

| Arm | ARM64 bytes | x64 bytes |
|---|---:|---:|
| control | 9,248 | 10,816 |
| P | 8,928 | 10,944 |
| C | 9,184 | 11,328 |
| PC | 8,928 | 10,880 |
| D | 9,600 | 11,584 |
| PD | 8,928 | 10,944 |
| CD | 9,504 | 11,520 |
| PCD | 8,928 | 10,688 |

Same-run V8 tick mapping attributes 81–84% of mapped WASM samples on M1 and 76–81% on Ryzen to the mixed evaluator. This is 65–68% / 58–65% of all sampled ticks respectively; unmapped baseline/host/JS samples remain explicitly unattributed. These shares locate the kernel's work; they are not per-instruction cycle counts or whole-game profiles.

## Fixed-work game sweep

Serial forward/reverse arm order on Ryzen, identical guest clock/input routes, cooperative guest threads. Reported numbers are **whole-process user CPU**, including startup/JIT/host work, not FPS. Two samples per arm are insufficient for confidence intervals; control repeat spread is an empirical warning, not a statistical significance threshold.

| Game | Control CPU | P | C | PC | D | PD | CD | PCD | Control spread |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Moorhuhn III | 11.565s | -2.59% | -0.99% | -6.18% | -5.10% | -2.46% | +1.82% | -0.91% | 14.79% |
| Quake II | 5.215s | +0.38% | +0.00% | -0.86% | -0.29% | -0.29% | -0.58% | -0.10% | 0.96% |
| Heroes III | 38.170s | -0.37% | -0.48% | +0.18% | +0.31% | -1.18% | -0.67% | -1.24% | 1.36% |
| Heroes II | 1.755s | +1.42% | +1.71% | +1.14% | +2.28% | +0.28% | -0.28% | +0.85% | 0.57% |

Moorhuhn drifted substantially (control 12.42s then 10.71s), so its apparent PC gain is not reliable. Quake II changes are around the repeat variation. Heroes III has no demonstrated PC gain. Heroes II is only ~1.8s long and shows small possible regressions, requiring more runs before promotion. No combination has established a reliable whole-game win across these routes.

## Decision

P+C is the most useful next candidate: its additional Ryzen kernel gain was reproduced directly, its encoding is no more complicated than P, and the loop change survives native compilation. Keep D experimental. The M1 incremental result and real-game gains need stronger evidence before changing production defaults. A full MW3 gameplay benchmark is still needed for these exact combinations; this matrix used MW3's copied projection kernel plus four other games. Caching additional FP values and a truly fused address/semantic selector remain separate future experiments.

Raw game validation is `games-summary.json`; paired timings are `arm64/kernel/*/kernel.json`, `arm64/p-vs-pc.json`, `x64/kernel/*/kernel.json`, and `x64/{p-vs-pc,pc-vs-pcd,pcd-vs-pc-repeat}.json`. Native captures and same-run sampled profiles are under each architecture's `native/` and `tiered/` directories. All are under `build/lazy-games/fp-combos-results/` and were downloaded before archiving the dedicated box.
