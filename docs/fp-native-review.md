# Native-code review of control, P, A and P+A

2026-10-01. Follow-up to [the P/A factorial](fp-predecode-factorial.md).
No new interpreter variant or production change is introduced here.

## Capture coverage and provenance

All four frozen modules were captured in V8 and SpiderMonkey on ARM64 and
x86-64: **16 optimized native-code captures**, including the pure and mixed
fast/generic FP evaluators and `uop_fast`. Module hashes are the same as the
factorial report. Each capture retains raw code, function maps, disassembly,
engine version, architecture and module hashes under
`build/lazy-games/fp-native/{arm64,x64}/{node,sm}/{control,p,a,pa}/`.

| Host | V8 | SpiderMonkey |
|---|---|---|
| Apple M1 | Node 24.21.0, V8 13.6.233.17-node.53 | JavaScript-C155.0 / Ion |
| Remote Intel Xeon Skylake KVM, 4 vCPU | Node 24.18.1, V8 13.6.233.17-node.50 | SpiderMonkey 158.0b2 / Ion |

The resumed remote box is **Skylake, not the Ryzen used in the previous
factorial**. Absolute times cannot be compared between restores. SpiderMonkey
versions also differ between architectures; this is not a controlled comparison
of engine performance. No SpiderMonkey execution-speed claim is made.

`tools/bench-fp-native.js` reuses the existing SpiderMonkey extractor and V8
jitdump decoder. V8 addresses are retained rather than rebasing every object
to zero. SpiderMonkey segments use the existing extractor's offset correction;
the inspected prologues begin with the expected frame setup. Direct Ion calls
can be annotated from the segment map. V8 calls through unrecorded jump stubs
remain unresolved; the tool records that limitation instead of inventing names.

## Crucial finding: eager code is not normally tiered code

The first V8 captures used `--no-liftoff --no-wasm-lazy-compilation`, compiling
everything eagerly with TurboFan. In this configuration, V8 inlines the mixed
evaluator into `x87_island_fast`. A raw-PC profile of the MW3 kernel therefore
lands in the inlined mixed copy inside that function. Ion instead keeps a
direct call from the pure/mixed entry to the separate mixed evaluator.

But normal V8 warmup produces a different result: it keeps the mixed evaluator
separate, and the hot mixed body is much smaller. Additional **normally tiered
execution captures for every variant on both architectures** preserve that
code and its own sampled PCs under `tiered/`.

Example ARM64 code sizes:

| Variant | Eager V8 mixed body | Normally tiered V8 mixed body | Ion mixed body |
|---|---:|---:|---:|
| Control | 16,864 B | 9,248 B | 9,592 B |
| P | 15,872 B | 8,928 B | 8,240 B |
| A | 16,896 B | 9,280 B | 9,616 B |
| P+A | 15,904 B | 8,960 B | 8,256 B |

Corresponding x86-64 mixed bodies:

| Variant | Eager V8 | Normally tiered V8 | Ion |
|---|---:|---:|---:|
| Control | 20,672 B | 11,200 B | 10,128 B |
| P | 20,224 B | 11,200 B | 8,432 B |
| A | 21,184 B | 12,032 B | 10,152 B |
| P+A | 20,608 B | 11,264 B | 8,432 B |

The eager V8 *entry* includes an additional inlined copy: 24,832 / 22,848 /
24,896 / 22,880 bytes respectively. Do not add those sizes as if all copies
execute, or use static byte counts as dynamic instruction counts.

A matched, **unprofiled** P/control check on the current Skylake host confirms
that the compilation configuration matters:

| Configuration | Control median thread CPU | P | Change |
|---|---:|---:|---:|
| Default tiering | 218.939 ms | 200.589 ms | −8.38% |
| Forced eager TurboFan, synchronous compilation | 185.972 ms | 197.965 ms | +6.45% |

Each uses 500,000 vertices, 12 warmup pairs and ten alternating ABBA/BAAB
groups, with state/output parity. These are kernel measurements. The second
row is a diagnostic configuration, not a replacement for the normal benchmark.
Its reversal is why compile-only disassembly cannot explain a speedup by itself.

## P: removes the second semantic selection, not the interpreter loop

The control extracts the FP group and sub-operation, selects a group and then
tests which arithmetic/stack operation to perform. P extracts the precise
selector and jumps directly to one of 53 entries (52 operations plus fallback).
Both V8 and Ion emit a native jump table for that selector.

P still performs the following work per operation:

```text
load handler + operand record
       |
mixed? classify integer bridge
       |
resolve memory/register addressing form
       |
extract selector -> indirect jump -> FP semantics
       |
advance cursor + maintain loop count -> next record
```

It does not eliminate address-kind tests, stack-validity handling, guest-memory
translation, stores/dirty tracking or helper-boundary spills. Its smaller
native bodies support the intended simplification, but the cost of the loop
around the operation remains substantial.

## A: the disassembly explains the lack of benefit

In V8 ARM64 the control folds scaling into the address add:

```asm
; control: two instructions to form the register-file address
and  wSlot, wOperand, #15
add  wAddress, wRegBase, wSlot, lsl #2

; A: three instructions for the same address
lsr  wSlot, wMetadata, #20
and  wSlot, wSlot, #60
add  wAddress, wRegBase, wSlot
```

Ion ARM64 also retains A's shift/mask/add sequence. The x86 captures retain
the offset extraction rather than turning it into a constant address. A must
also keep its metadata live alongside the original semantic operand. The
observed V8 frame reservations and allocation change with A; this is not a
free rewrite even when a benchmark calls it neutral.

Thus the earlier source-level explanation was incomplete: on ARM64, A can
replace an already-folded scale with **an extra native instruction**, not merely
exchange equivalent bit operations. A better encoding would need to reduce
the executed extraction/addressing work.

## Sampled execution, not just static assembly

`tools/bench-fp-native-ticks.js` maps V8 `--prof` leaf PCs to the same process's
`--perf-prof` objects and records disassembly around the hottest PCs. It does
not attribute unrecognized JS/host/compiler or baseline-tier addresses to WASM.
Shares below use only mapped optimized-WASM leaf samples; they are not whole
application CPU percentages. Sampling can skid around nearby instructions, so
a hot PC is evidence for its surrounding path, not an exact cycle charge to
that one instruction.

Normally tiered MW3 projection, ARM64:

| Variant | Mixed evaluator | Loop backedge handler `th_jcc_nz` |
|---|---:|---:|
| Control | 83.0% | 9.9% |
| P | 83.0% | 9.8% |
| A | 83.8% | 9.7% |
| P+A | 82.7% | 9.9% |

Normally tiered x86-64 puts 84.7 / 84.2 / 85.4 / 85.0% of mapped WASM
samples in the mixed evaluator for control / P / A / P+A; the external loop
backedge accounts for 7.4 / 7.5 / 6.9 / 6.8%. Its leading PCs also expose the
inlined `gl32_native` path: subtract `image_base`, add `GUEST_BASE`, spill
live state, test the direct window, then load or call the slow helper. This
matches `03-registers.wat`'s address translation, not FP-stack manipulation.
For example, the control's mixed offsets `+0x25c0/+0x25cc` and P's `+0x2570`
land in that path. P's `+0x144` lands at integer/address-kind classification.
On x86, memory translation and its surrounding spills therefore deserve a
separate experiment alongside loop bookkeeping.

Across all four ARM64 variants, the leading sampled regions include the loop
tail reloading the iteration index and limit from stack slots, incrementing,
comparing and branching; the record-fetch/stack-limit-check path; and spills
around selector dispatch. P's hottest tail remains:

```asm
ldr wIndex, [sp, #120]
add wIndex, wIndex, #1
ldr wLimit, [sp, #128]
cmp wLimit, wIndex
b.hi next_record
```

V8 keeps ST0 in a native FP register on ordinary arithmetic paths; helper
boundaries still spill state. Ion's generated paths have more explicit stack
loads/stores around dispatch. That difference is structural evidence only;
the Ion captures have no accompanying sampled-runtime profile.

Eager profiles were retained under `profiles/`, but are **not the basis for
normal-tier hotspot conclusions**. In particular, their apparent rise in
`gl32_native` self samples for P reflects a different compiled call/inlining
shape. It must not be reported as a regression in the normal benchmark path.

## Real-game context: Moorhuhn 3

All four variants also ran the existing 2,270-batch shooting route with Node's
CPU profiler and default tiering. Final pixels match; each recorded 492,944
API calls. The laptop was loaded (roughly 7–9 at the start), so these are broad
sampled-time attribution results, **not new performance comparisons**.

| Variant | `uop_fast` self share | Fast FP evaluators combined self share |
|---|---:|---:|
| Control | 59.4% | 9.5% |
| P | 63.9% | 8.9% |
| A | 59.8% | 8.7% |
| P+A | 58.9% | 8.6% |

The remainder includes color-key copying, specialized FP pipelines, standalone
FP handlers, branches and host work. FP evaluator optimization therefore
addresses a much smaller part of this real game's cost than the projection
kernel. Shares are self time, not inclusive time, and cannot be multiplied by
the kernel speedup to predict a game FPS gain.

## What to test next

1. Simplify island loop bookkeeping: a remaining-count loop is a bounded
   candidate for reducing the index/limit spills seen in the actual hot code.
2. Specialize addressing with the precise selector, if it removes the repeated
   H188/H189/H190 classification without increasing record bandwidth or spills.
   Separately test guarded memory-window reuse or slow-path layout changes
   against the x86 load-path hotspots; preserve fault and synchronization rules.
3. Retain more FP values in locals as a separate experiment, but require the
   native review to show which loads disappear and whether register pressure
   increases. It is not yet the best-established bottleneck.

For broad game improvement, profile the dominant integer uop loop as well;
Moorhuhn's approximately 60% there is a larger opportunity than its FP islands.
Any new variant still needs correctness checks, native review in both engines,
and separate/stacked benchmarks. Current A should remain parked; P remains
experimental.

## Reproduction

```sh
node tools/bench-fp-native.js node MODULE.wasm MODULE.named.wasm OUT/node
node tools/bench-fp-native.js sm MODULE.wasm MODULE.named.wasm OUT/sm
```

The native kernel profiles use the existing `bench-mw3-mixed-kernel.js` with
the same module in both slots (`MIXED_CONTROL=1`, 500,000 vertices). Normal-tier
profiles use 20 groups and `--prof --perf-prof --no-wasm-async-compilation`;
eager profiles use 30 groups and additionally `--no-liftoff
--no-wasm-lazy-compilation`. Synchronous compilation avoids an observed early
process exit while awaiting asynchronous instantiation with the profiling
flags; the incomplete initial ARM64 `profiles/control/` is excluded.

Set `--logfile=OUT/v8.log --perf-prof-path=OUT`, decode the captured jitdump with
`bench-mw3-mixed-native.js decode` and `NATIVE_FUNCS=x87_island_fast,x87_island_fast_mixed`,
then run `bench-fp-native-ticks.js OUT`. Raw profiles include initialization and
the harness's parity/census passes; no sampled total is treated as a timing
benchmark. `bench-fp-native-game-profile.js` summarizes the four default-tier
Moorhuhn CPU profiles using each module's own function map.
