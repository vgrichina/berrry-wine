# Mixed-island coverage and the pure-FP evaluator split

Next experiment: [precise FP selectors and operand preparation, separately
and stacked](fp-predecode-factorial.md).

2026-09-30/10-01. Follow-up to the [cross-game timings](mixed-island-corpus.md).
The first mixed prototype executes useful integer bridges in both Moorhuhn 3
and MW3, but also adds a classification to hundreds of millions of operations
in islands containing no integers. The block executor is disabled in these
runs; lost block-executor eligibility cannot explain their timing differences.

## Diagnostic method

`tools/bench-mixed-census.js` compiles isolated diagnostic versions of frozen
`837f0a74`, first requiring the uninstrumented baseline and candidate to
reproduce their previously measured bytes. Both evaluator bodies count
absorbed ADD/INC/DEC operations and report once per completed island to a
Node preload. Records aggregate by instance, guest block EIP, evaluator,
length and integer counts. An additional probe counts integer rejections in
both block-executor absorbed-record scans. An exported global records whether
the block executor is enabled on each guest instance at exit.

These builds and their timings are **diagnostic only**. Counts cover whole
fixed routes, including startup and cooperative threads, not just gameplay;
they count H451 islands, not every FP operation or every fused x87 family.
The EIP labels are guest block entries, not necessarily the first instruction
of each island. Multiple islands in one block can produce distinct rows.

Runs used the frozen CLI in `/private/tmp/wa-mixed-census-837f0a74`, with its
assets and dependencies linked locally, on ARM64 Node 24.21.0. The local host
was busy; no timing conclusions are drawn from it. Same routes/branch clock
and uop settings as the corpus harness: Moorhuhn 2270 batches, MW3 1150.
Both baseline/candidate pairs have identical final pixels and API counts
(492,944 / 4,423,912 respectively). MW3 reaches the cockpit. All observed
instances have `blockExecutorEnabled=0`; there are zero rejection events.

The census's positive control copies the original MW3 projection kernel:
100 vertices executed 17 times per arm give 1700 islands each. The candidate
counts two ADDs and one DEC per island; the baseline counts no integers.
Output/state parity passes for ordinary and special floating inputs.

## Actual coverage of the first mixed prototype

| Whole route | Moorhuhn 3 | MW3 |
|---|---:|---:|
| Pure-island executions | 15,447,322 | 8,645,768 |
| Operations inside pure islands | 408,437,190 | 95,301,398 |
| Mixed-island executions | 4,777,604 | 490,617 |
| Operations inside mixed islands | 60,098,496 | 8,873,912 |
| Absorbed integer operations | 11,166,124 | 1,422,990 |

The 408M/95M figures are **classification opportunities, not measured CPU
costs**. The original prototype checks `fn < 66` on every operation even in
a pure island. Most outcomes are predictable. Branch prediction, code layout
and allocation can change its cost; counts alone cannot establish that this
caused Moorhuhn's earlier +1.41% repeat signal.

Moorhuhn's busiest affected blocks:

| Block EIP | Mixed island | Executions |
|---|---|---:|
| `0x43030b` | 2 FP + 2 pointer ADDs | 2,864,735 |
| `0x432c76` | 6 FP + 2 ADDs + DEC | 1,612,222 |
| `0x432d06` | 112 FP + ADD + DEC | 299,334 |

The live unpacked bytes were captured separately; its packed on-disk EXE is
not suitable for these addresses. `0x43030b` starts with a 61-operation FP
multiply/accumulate sequence, then `SUB ESP,4`, then:

```asm
faddp st(1), st
add   ecx, 0x40
add   ebx, 0x80
fistp dword [esp]
```

The SUB splits the long pure island from this short mixed island. The result
is clamped to signed 16-bit PCM range and stored. `0x432c76` reads two float
arrays, computes sum/difference, advances the two pointers and decrements the
loop counter. `0x432d06` contains repeated coefficient-weighted FP transforms.

MW3's dominant mixed block remains `0x4fd394`: **426,405 executions**, each
with 17 FP operations, two pointer ADDs and one DEC. Baseline and candidate
visit it the same number of times. The next mixed blocks are `0x517b01`
(20,952) and `0x5171e7` (19,007), both three FP operations plus ADD/DEC.

## Isolated split variant

`tools/bench-mixed-split.js`, selected by `--split-pure` on the existing build
and parity tools, marks genuinely mixed H451 islands with operand bit 28.
The existing fields occupy bits 0..27. The marker is snapshotted at the last
FP operation, so discarded trailing integers do not mark a pure island mixed.

```text
Decode once:
  only FP                    -> unmarked
  FP ... integer ... FP      -> mixed marker

Execute once per island:
  unmarked -> original FP evaluator (no per-op integer classification)
  mixed    -> mixed evaluator
```

This keeps the matcher, integer flag semantics, operation order and
conservative block-executor rejection unchanged. It duplicates the evaluator
body instead of making pure loops pay its inner check. Module size grows from
1,646,105 baseline / 1,646,427 first candidate to **1,652,336 bytes**. The code
size and per-island selection are real tradeoffs, to be judged by timing.

Split SHA-256:
`ac551603e51942e2d3ab78fb7dffb43249d216e206fe8f46f274a918e659f30f`.
Validation: **1000 randomized sequences, 26,138 operations**, fast == generic
== unfused including GPRs/flags/FP state/exception traces; copied projection
kernel ordinary/special-input parity passes. Production sources/defaults are
unchanged.

## Timing and artifacts

Clean timing is separate from the census. The resumed dedicated box
`bx_4r5uzdwv` was provisioned on **Intel Xeon (Skylake, IBRS, no TSX)**,
4 vCPU, Node 24.18.1 / V8 13.6.233.17-node.50. This is another host change;
only within-sweep comparisons are meaningful. Initial valid-sweep load was
0.2 / 0.5 / 0.7. The snapshot lacked game assets and type libraries; the
failed startup sweep is excluded, the fixtures were restored, and a one-batch
guest preflight passed before the valid sweep.

Order per game: baseline, original mixed, split, split, original mixed,
baseline. Serial processes, same frozen CLI, branch clock/uop/cooperative
threads, existing routes. Values below are means of two **whole-process user
CPU** times; they include startup and rendering and are not FPS.

| Game | Baseline s | Original mixed s | Split s | Split vs baseline | Baseline spread |
|---|---:|---:|---:|---:|---:|
| Moorhuhn 3 | 39.035 | 39.400 | 38.915 | −0.31% | 2.13% |
| Quake II | 18.080 | 18.490 | 18.220 | +0.77% | 0.88% |

Split vs original mixed is −1.23% / −1.46% respectively. All 12 runs reached
their expected batch counts and produced identical pixels within each game.
The same API totals persist (492,944 / 77,469). The changes are small relative
to repeat variation, and this sweep does **not establish a general speedup**.
It does not prove that the earlier regression was caused by the inner check.

A separate local uninstrumented split MW3 run reaches batch 1150 / 4,423,912
API calls and matches the earlier baseline/candidate cockpit pixels exactly.
Its timing is excluded: local load and diagnostic instrumentation differ.

The copied projection-kernel benchmark on this Skylake host retains a clear
benefit: **138.986 → 120.000 ms guest-thread CPU (−13.66%)** for 500,000
vertices, twelve warmups and ten ABBA/BAAB groups (20 samples per arm).
Same-artifact control medians are 133.962 / 133.987 ms (0.019% difference).
Output, GPR/FP/flag parity passes; the diagnostic post-timing census shows
1,000,000 ADD and 500,000 DEC dispatches disappear, with 500,000 islands in
both arms. This is baseline versus split, not split versus the original
mixed prototype, and is not comparable to absolute times on the earlier
Ryzen host. Results are `split-kernel-x64.json` and
`split-kernel-control-x64.json`. Final box load was 0.38 / 0.50 / 0.66.

The split has passed correctness checks and removes a demonstrated source of
redundant work, but remains an experiment. No production default is enabled.

Local artifacts: `build/lazy-games/mixed-census/` has diagnostic WASM, JSON,
logs, identical-frame evidence, `moorhuhn-hot.asm` and parity results.
`build/lazy-games/mixed-split2/` contains the measured uninstrumented split
artifacts. `mixed-split3/` reproduces their exact bytes after cleaning up
source extraction to avoid duplicating adjacent macro declarations.
The first split build directory is an unsuccessful builder attempt; it is
not a measured artifact. Remote logs/frames are in `remote-runs/`, with
two-sample means and frame comparisons in `remote-summary.json`.

Reproduction:

```sh
node tools/bench-mixed-census.js build build/lazy-games/mw3-mixed3/src \
  build/lazy-games/mw3-mixed3 build/lazy-games/census-new
MIXED_CENSUS_OUT='out/%APP%-%ARM%.json' \
  node --require=/absolute/path/tools/bench-mixed-census.js test/run.js \
  --app=moorhuhn_3 --no-build --wasm=/absolute/path/census-new/candidate.wasm \
  <the existing fixed-route arguments>
node tools/bench-mw3-mixed-build.js 837f0a74 build/lazy-games/split-new \
  build/lazy-games/mw3-mixed3/baseline.wasm --split-pure
X87_FUZZ_CASES=1000 node tools/bench-mw3-mixed-parity.js \
  build/lazy-games/mw3-mixed3 --split-pure
```

Use the frozen runner for these old modules, with its matching region map and
host imports. Census JSON records full runner arguments. `MIXED_CENSUS_CODE=1`
also saves 512 live guest bytes at up to 32 hot block EIPs after execution.
