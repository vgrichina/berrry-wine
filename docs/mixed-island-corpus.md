# Mixed integer/x87 islands: cross-game measurements

Follow-up: [island coverage, live disassembly, and an isolated pure/mixed
evaluator split](mixed-island-census.md).

2026-09-30. Follow-up to [the isolated MW3 prototype](mw3-mixed-island.md).
This compares the same frozen baseline and candidate, without changing the
production interpreter or its defaults.

## Method

Dedicated ASCII box `bx_4r5uzdwv`, restored onto an AMD EPYC-Rome KVM host,
4 vCPU / 8 GB, Node 24.18.1, V8 13.6.233.17-node.50. Initial load was
0.14 / 0.09 / 0.08. This is a different host from the earlier Ryzen MW3 run;
absolute times must not be compared across those machines.

Frozen source revision: `837f0a74`.

- Baseline SHA-256: `c1c92840fde2c9ae2809154ea64ea9ab91b11effdb0a541099b695f1567a6b93`
- Candidate SHA-256: `2a43980dc0fa1ad5b02a233354fb26a3fd503de924e7d581bd9fa2e07286f4f2`

The existing `tools/uop-game-ab.js` drives fixed input routes with a pinned
guest calendar, branch clock and uop tier enabled in both arms. Runs are
serial, with separate processes, in ABBA order. Quake II and Moorhuhn 3
receive a second BAAB group to check the first group's apparent effect.

```sh
node tools/uop-game-ab.js --no-build --games=h2,h3,q2,mh3 \
  --arms=control,candidate,candidate2,control2 \
  --arm=control=--wasm=baseline.wasm \
  --arm=candidate=--wasm=candidate3.wasm --jobs=1 \
  --extra="--max-seconds=600 --no-threads --x87-fusion" \
  --out=build/mixed-corpus2
```

Repeat with `--games=q2,mh3`,
`--arms=candidate,control,control2,candidate2`, and `--out=build/mixed-corpus3`.
The numeric arm suffix repeats the same artifact. `--no-threads` selects
cooperative guest scheduling; guest audio threads still execute.

The primary metric is whole-process **user CPU seconds**, including startup,
JIT compilation, host rendering and cooperative guest threads. These are
fixed-route timings, **not browser FPS**. The harness's `--slice-split`
measures only the initial main-instance run per batch, omitting cooperative
thread work and extra main interleaves; it is not an aggregate guest CPU
measurement, especially for Heroes III's audio-heavy workload.

| Game | Route | Final batch |
|---|---|---:|
| Heroes II | Enter scenario and scroll adventure map; integer control | 2400 |
| Heroes III | Enter scenario and scroll adventure map; includes audio thread | 5101 |
| Quake II | `+set vid_ref soft +map demo1`; software rendering | 1400 |
| Moorhuhn 3 | Start round and shoot across field; renderer-heavy with FP audio | 2270 |

The first attempted sweep lacked `test/binaries/tlbs/stdole2.tlb` and stopped
before guest execution. Its timings are excluded entirely. The CLI returned
zero even on that startup failure, so validity requires the expected final
batch count and a rendered frame, not just exit status. Restoring the shared
type-library fixture and checking startup preceded all measurements below.

## Results

Positive change means the candidate consumed more CPU. Each row averages
two baseline and two candidate launches; repeat groups remain separate so
machine drift is visible rather than hidden in a pooled average.

| Game / order | Baseline CPU s | Candidate CPU s | Change | Baseline repeat spread |
|---|---:|---:|---:|---:|
| Heroes II / ABBA | 5.410 | 5.395 | −0.28% | 2.59% |
| Heroes III / ABBA | 108.205 | 108.230 | +0.02% | 2.06% |
| Quake II / ABBA | 15.230 | 15.800 | +3.74% | 2.63% |
| Quake II / BAAB | 14.295 | 14.255 | −0.28% | 1.05% |
| Moorhuhn 3 / ABBA | 31.260 | 30.950 | −0.99% | 10.75% |
| Moorhuhn 3 / BAAB | 30.090 | 30.515 | +1.41% | 0.47% |

Spread is the absolute difference between the two baseline launches divided
by their mean, not a confidence interval. Two samples per arm per group do
not support a precise estimate of a small effect on a virtual machine.

All **24 runs** reached their expected final batch. API-call totals agree
within each game: Heroes II 695,972; Heroes III 87,011,857; Quake II 77,469;
Moorhuhn 3 492,944. No startup error or WASM trap was found. Every final
frame, including repeats, is pixel-identical to its game's first baseline.
Visual inspection confirms adventure maps for both Heroes games, an in-level
Quake II view, and Moorhuhn's shooting field at the round's end (timer 0:00,
score 250). This checks final visible output, not full state or audio parity.

**No cross-game speedup is established.** Heroes II/III are neutral at this
resolution. Quake II's initial slowdown did not reproduce. Moorhuhn's first
group has substantial drift; its tighter repeat suggests a possible small
regression (+1.41%), so it must not be described as an improvement.

These measurements retain the prototype's conservative block-executor
restriction and extra per-operation classification. They do not isolate
which mechanism accounts for any difference, or count mixed-island coverage
in these games. Keep the prototype isolated; before enabling it, investigate
Moorhuhn's repeat signal and measure affected hot paths directly. The earlier
MW3 projection-kernel gain is still valid, but is not a general game-speed claim.

Raw logs, frames, machine metadata and pixel comparisons are under
`build/lazy-games/mixed-corpus/` locally. `runs/` contains ABBA, `repeat/`
contains BAAB, and `summary.json` is produced by the artifact-local
`summarize.cjs`, which rejects missing/truncated routes, errors, differing
API totals within a group, or differing final pixels. The original harness's
printed candidate/control percentage compares the first pair only; the table
above uses both repetitions. Final observed load during the repeat was
1.09 / 0.64 / 0.49 with one benchmark child at a time.
