# Conan first-store cost controls, 2026-11-17

The replacement is **rejected**. The single-resident specialization costs
1.915–2.007x its matching standard baseline on the generated fixed-work direct
callback, exceeding the unchanged 1.20x criterion. This is a narrower route than
the required full browser shell. It does not establish a low-cost observer or
unblock original gameplay. No original was launched, no singular check changed,
and no emulator defect or CPU/timer failure was established.

Evidence is in `scratch/runs/20261117-conan-current-low-cost-first-store-gameplay/`;
`result.json` records identities, limitations, actual waits and publication.
The historical denied SSH operation and archived runtime were untouched. No
boxes, workers, downloads, original-media copies or frame series were created.
This follows the [origin rejection](conan-zero-world-origin-20261106.md),
[cost investigation](conan-low-cost-origin-20261106.md) and
[shipped loading boundary](conan-shipped-loading-boundary-20261106.md).

## Tool and measured variants

`tools/conan-first-store-cost.cjs` reads the five retained observer transforms
without changing them. Its isolated loader redirects their `store-sites.json`
write into the new output directory. An asserted adapter accounts for the
current compiler's already-unconditional native CALL/RET seams; it changes only
the inherited ENTRY-gate count assertion. No production WAT is edited. All
variants explicitly report `qualificationPass:false` and
`originalLaunchPermitted:false`.

The tool compiles the canonical WATX closure and protected-writer transform;
compatibility modules additionally use the existing dispatch trampoline. It
records module, closure, transform patch and historical helper hashes, plus the
protected function-index map used for native disassembly. Commands are:

```sh
node tools/conan-first-store-cost.cjs compile baseline OUT/baseline
node tools/conan-first-store-cost.cjs compile full OUT/full
node tools/conan-first-store-cost.cjs compile single-live-resident OUT/candidate
node tools/conan-first-store-cost.cjs compile single-live-resident OUT/compat compat
node tools/conan-first-store-cost.cjs workload OUT/candidate/module.wasm OUT/timing.json 3
node tools/conan-first-store-cost.cjs verify OUT/candidate/module.wasm OUT/bits.json
node tools/conan-first-store-cost.cjs verify-lifetimes OUT/candidate/module.wasm OUT/lifetimes.json
node tools/conan-first-store-cost.cjs native OUT single-live-resident v8
node tools/conan-first-store-cost.cjs native OUT single-live-resident sm
```

`OUT` is a new run-local directory. The retained generated PE recipe remains
`scratch/runs/20261106-conan-zero-world-origin/native-control-fixture.cjs`;
there is no original launch command in this tool. Historical ignored helper
inputs must be retained at their recorded paths and hashes for recovery.

The first specialization handles only epoch 1. The final specialization uses
direct slot-1 globals while that remains the only allocated resident slot,
including reuse with unchanged generation counters. Allocating another slot
permanently restores the original generic scan. Both retain translation,
overlap/span checks, invalidation, bounds, snapshots and completeness refusals.
The ablations deliberately remove individual mechanisms and cannot qualify:

| Direct callback variant | Wall median ms | CPU median ms |
| --- | ---: | ---: |
| baseline | 451.18 | 392.45 |
| inherited full observer | 1644.93 | 1470.01 |
| omit store-hit test | 602.92 | 447.50 |
| omit resident scan | 1286.71 | 484.16 |
| omit snapshots | 2083.78 | 1698.05 |
| restore pending ENTRY gate | 2153.29 | 2149.06 |

These sequential ablations are affected by shared host load. They locate
promising mechanisms; their wall-time differences are not exclusive cost
attribution. Profiling was a separate cell, excluded from timing. Its samples
include linear resident getters, private register-store wrappers, translations
and dispatch handlers. Correct copied matrices say nothing about CPU/timers.

Three alternating baseline/final-candidate pairs, each with one discarded
warmup and three measured repetitions, gave wall ratios 2.00715, 1.91464 and
1.94677; CPU ratios were 2.05073, 1.91369 and 1.94659. Each executed 15 million
native guest add/store iterations and produced exactly 45,000,000.

## What the controls establish

The standard baseline, inherited full observer and final candidate share source
closure `25188585292814670496007b9bbfffbb865832978c19d1bed49655c85f8c2ae3`.
Their recorded Git commits differ because unrelated publications happened in
the shared tree; closure and module hashes, not HEAD alone, identify the tests.

| Module | SHA-256 |
| --- | --- |
| standard baseline | `9be4491daf35df204ca50486165952dad7bb5a9766828374083a6d16edde3a92` |
| compatibility baseline | `915c2c7ed533a7423968daca502e0bdc83ca584aa6a6655bb74cde61016505f1` |
| inherited full standard | `9e2df0fdb63e620e2b03c0bd858cb955dc4f1319682e220e30f8faa91f66d567` |
| final candidate standard | `39407f1a5be74d4661a5e738979fa8906e27453d4654705b82e03b6f0b0359dd` |
| final candidate compatibility | `15226003444ac91fdfc3719f5ab4ee8eca18199c4d4da250642a8823ba37dea3` |

**The final compatibility candidate has closure `8cb4a168…`; the compatibility
baseline has `25188585…`.** A foreign ordinal change landed between their
compiles. Their import/export contracts and tested values agree, but they are
not a matching-source compatibility proof. The final locked canonical build
also used the newer closure and passed; it does not retroactively qualify the
older timing modules. Further foreign WORD-width changes followed that build.

`check-controls.cjs` in the run verifies module/helper hashes, contracts, final
exported register/lazy-flag/FPU values and selected guest-data hashes. Full and
specialized observers have identical complete trace-stream hashes for each
tested scalar workload. Separate captures map adjacent pre/post packets to
actual guest instruction PCs, with matching owner slot/epoch and exact bits:

| PC | Store | Owner offset | Before → after |
| --- | --- | --- | --- |
| `431955` | MOV | `04` | `3f800000 → 00000000` |
| `431958` | MOV | `38` | `3f800000 → 00000000` |
| `43195b` | MOV | `68` | `3f800000 → 00000000` |
| `4310a7` | MOV | `04` | `00000000 → 40000000` |
| `4310b0` | FST | `38` | `00000000 → 3f000000` |
| `4310b3` | FSTP | `68` | `00000000 → 3f000000` |

The generated two-owner control observes births 1/2, destruction of 1,
reconstruction as generation 3, then destruction of 2/3. Its destructor is a
generated scalar stub, not the original hot destructor implementation. Existing
consumer guards still refuse absent constructor history, unknown instruction
mapping, owner mismatch and selected native writers lacking full snapshots.
No `nativeEntries == 0` result is treated as positive coverage.

Complete architectural passivity, nesting, REP/SEH, selected hot native writers,
actual destructor coverage, full-shell cost and matching-source compatibility
qualification remain unproved. Those gaps independently refuse an original.

## Native code review and raster clarification

Matching-module x86-64 baseline/full/final-candidate disassembly was captured
with `tools/wasm-native.js` for V8 TurboFan and SpiderMonkey Ion. Full V8
`cww_hit` has a 0x48-byte local frame; specialization reduces it to 0x40 but
retains translation/helper calls and the generic fallback. The full observer's
linear getter comparisons and private register-store instrumentation appear in
hot code, with extra frames/spills. SpiderMonkey retains calls and a 0x30-byte
frame in the scan. Native files and per-function byte ranges are retained.

Static V8 is 15.7.57; measured Node embeds 13.6.233.17-node.50. SpiderMonkey is
JavaScript-C158.0. This is an explicit timing-engine mismatch, not matched Node
native-code proof. The separate shell execution attempts failed during PE load
on an unexpected `beep_process_begin` import; both processes were waited and
both EOFs drained. Those harness failures do not diagnose an emulator defect.
There were no ARM64 measurements or captures.

The 18:27 same-task clarification suggested investigating finite collapsed
solid triangles before demanding source construction. Microsoft's
[D3D9 rasterization rules](https://learn.microsoft.com/en-us/windows/win32/direct3d9/rasterization-rules)
describe triangle filling separately from point/line rules. OpenGL 4.6
[sections 14.6.1–14.6.6](https://registry.khronos.org/OpenGL/specs/gl/glspec46.core.pdf)
likewise distinguish polygon fill, point/line modes and multisampling. These
contracts motivate a narrowly conditioned semantic test; they do not establish
Conan's actual fill/blend/shader state.

The historical `conan-shipped-loading-boundary/original/first-render-failure.json`
is absent. Retained validation/review/result files prove copied zero components
and the image boundary but do not supply that complete draw state. It was not
reconstructed from defaults. No native raster semantic control or concrete
raster defect was proved, and no guard suppression was implemented.

Next work needs either a substantially cheaper design with positive native
writer/destructor coverage and matching-source standard/compat full-shell
controls, or recovered actual sequence-keyed draw state plus native semantic
proof for the narrow raster hypothesis. Original source construction and player
movement, a second visible response and native Quit all remain UNKNOWN.
