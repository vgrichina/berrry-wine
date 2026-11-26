# WAT representation microbenchmarks: what each state and op encoding costs on 15 wasm engines

Status: measured 2026-11-25 on an x86_64 quiet box (AMD Ryzen 7 9700X,
4 vCPU, Ubuntu 24.04). Engines are listed in §2. Native disassembly is from
V8 and SpiderMonkey on that box (x86_64) and on the M1 laptop (arm64).
Evidence: `scratch/runs/20261125-wat-repr-microbench/`. Suite:
`tools/wat-microbench/` (gen.js, run.js, report.js, native.js, driver.js,
cpurun.c). Test: `test/test-wat-microbench.js`.

The question is the one the optimizer pipeline
([uop-optimizer-pipeline.md](uop-optimizer-pipeline.md)) and the stacked
strategy ([stacked-performance-strategy.md](stacked-performance-strategy.md))
keep coming back to: when the emulator's state or an x86 operation can be
represented in wasm more than one way, which way is cheapest? The follow-up
matters just as much: is the answer a property of wasm, or a quirk of one
engine? Each family below takes the representation wine-assembly uses today
as the control. Every alternative runs the same guest work, so all variants
return identical checksums. Each is measured on every engine that can run it.

## 0. Answers

Ratios are the variant's median ns per guest op divided by the control's,
on the same engine; lower is faster. "opt JIT" is the geometric mean over
V8 TurboFan, node, SpiderMonkey Ion, JSC (BBQ→OMG), wasmtime/Cranelift and
wasmer/Cranelift. "baseline" covers Liftoff, SM baseline and JSC BBQ.
"interp" covers JSC IPInt, wasm3, wasmi and Pulley. "wasm2c" is clang 18 -O2.

| # | Family: control (today) → best measured | opt JIT | baseline | interp | wasm2c | Holds across classes? |
|---|---|---:|---:|---:|---:|---|
| 1 | GPRs in memory, constant address → **wasm locals** | **0.47** | **0.52** | **0.52** | 0.11 | yes, every engine |
| 1 | ... → regfile via a base global (`$reg_base`, today's real shape) | 1.15 | 1.63 | 1.34 | 1.14 | yes (costs everywhere) |
| 1 | narrow AL/AH/AX: `store8/16` (today) → **32-bit load-merge-store** | **0.44** | **0.53** | 1.27 | 0.82 | JITs yes; interpreters the reverse |
| 2 | lazy flags (today) → **eager + dead-flag elimination** | **0.46** | **0.55** | **0.37** | 1.15 | all but JSC-OMG (1.33) and wasm2c |
| 2 | lazy → eager, no DCE | 0.78 | 0.91 | 0.78 | 1.12 | engine-dependent (V8 0.92/Liftoff 1.29/JSC 2.27) |
| 2 | `fcom/fnstsw/sahf/jcc` lazily → **fused f64 compare-branch** | **0.49** | **0.47** | **0.34** | 0.79 | yes, every engine |
| 3 | threaded `return_call_indirect` (today) → **one br_table loop** | **0.34** | **0.35** | **0.57** | – | yes; smallest on SM Ion (0.72) / JSC (0.61) |
| 3 | ... → call_indirect loop | 0.87 | 0.98 | 1.06 | – | no gain |
| 3 | ... → compiled region (br_table CFG / straight) | **0.07 / 0.05** | 0.07 / 0.05 | 0.12 / 0.09 | – | yes |
| 4 | inline `g2w` fast path (today) → **one check per 16-byte group** | **0.65** | 1.02 | **0.42** | 0.61 | JITs + interp; baseline flat |
| 4 | ... → `call $gl32`/`$gs32` (today's handlers) | 1.79 | 2.92 | 2.24 | 0.95 | yes (calls cost everywhere but wasm2c) |
| 4 | ... → flat page table inline / hoisted | 1.20 / 0.68 | 1.45 / 0.89 | 1.27 / 0.56 | 1.69 / 0.79 | yes: PTE per access +20..45 %, hoisted ≈ affine hoisted |
| 5 | XMM via `$xmm_addr`/`$xmm_get` calls (today) → inline const-offset `v128.load` | **0.11** | **0.10** | **0.09** | 0.70 | yes |
| 5 | ... → v128 locals (in a region) | **0.03** | 0.05 | 0.04 | 0.16 | yes |
| 5 | scalar ss/sd via lane extract/replace (today) → **f32/f64 load/store of lane 0** | **0.20** | **0.15** | **0.06** | 1.14 | all but wasm2c |
| 6 | LOCK RMW: i64 CAS loop (today) → `atomic.rmw` | 1.12 | 1.01 | **0.45** | 1.17 | no gain on JITs |
| 6 | ... → **plain load/op/store** (single-thread mode) | **0.11** | **0.13** | **0.41** | 0.13 | yes, every engine, 8–9× on JITs |
| 6 | ... on **non-shared** memory | 0.99 | 0.99 | 1.03 | 0.24 | engines emit `lock` anyway |
| 7 | op word (handler, operand) pair (today) → packed / separate / imm-stream / pre-addressed | 0.90–1.06 | 0.92–1.03 | 0.82–0.97 | 0.82–0.99 | **no encoding matters** beyond the null band |
| 8 | budget: 2 globals per block (today) → 1 global / local / weighted | 0.89–0.97 | 0.96–1.17 | 0.87–0.91 | 0.96–1.07 | mostly inside the null band |
| 8 | ... → per instruction | 1.20–1.82 | 1.30–1.48 | 1.24–1.42 | 1.28–1.88 | yes: never charge per insn |
| 8 | ... → one charge per back edge / none | **0.87** / 0.78 | 0.91 / 0.91 | **0.74** / 0.70 | 0.84 / 0.92 | yes, a weaker effect |
| 9 | memory32 → memory64 (same code) | 1.13 | 1.56 | 1.11 | 1.24 | costs everywhere; worst on baseline tiers |
| 9 | regs in memory 0 → in a second memory | 1.22 | 1.58 | 1.09 | 0.96 | free on V8/SM/wasmtime; **JSC 3.1–3.3×**, wasm3 1.84× |

What this means for wine-assembly (details in §4):

- **The large wins are structural:**
  - Dispatch: threaded → loop is 3×; loop → region is 7×.
  - XMM access through calls is 9–30×.
  - Locked ops in single-thread mode are 8–9×.
  - Flag DCE and the FPU compare fusion are ~2× each.

  All of these hold on every engine class. They are properties of wasm on
  current engines, not of V8.
- **Narrow register writes should merge, not `store8`.** The `$set_reg8` /
  `$set_reg16` shape costs 2.3× on every JIT tier against a 32-bit
  load-merge-store. Only the pure interpreters prefer `store8`, and only
  iOS Lockdown Mode (JSC IPInt, 1.20, not significant) runs one in a
  browser.
- **Some proposed optimisations are not worth doing:**
  - The op encoding (pair, packed, separate, immediate stream or
    pre-scaled register addresses) does not move outside the null band on
    any class.
  - `atomic.rmw` instead of the CAS loop gains nothing on JITs.
  - Dropping the second budget global is within noise on most engines.
- **memory64 is a 13–56 % tax on every access**, so it is not a free way to
  grow past 4 GB. Multi-memory is free on V8/SM/wasmtime, but JSC runs a
  second memory at about 3×, so it is ruled out while Safari matters.

## 1. Method

Each module is standalone: its own 2 MB memory, no imports, and an exported
`run(k) → i32` that does k iterations of a fixed guest workload. State is
kept between calls, and `run` returns a checksum of the whole architectural
state. A program's variants are generated from one seeded guest program, so
their checksums must be equal.

**Checksum vote.** `run.js --check` runs every (module, engine) pair and
takes the majority checksum per program. A pair that ran but disagrees is
reported `WRONG` and is never timed. One pair disagreed: an engine bug, §2.

**What is timed.** The CPU time (user + sys, from `wait4` rusage via
`cpurun.c`) of a whole process doing fixed work:
- A JS shell or wasm2c binary makes N calls of `run(k)`.
- A CLI runtime makes one call of `run(N·k)`.

Each repetition runs a big N and N/5 back to back, and

    ns/op = (cpu(big) − cpu(small)) / ((Nbig − Nsmall) · k · ops_per_iteration)

so process start, compilation and tier-up cancel out.

**Calibration.** N is calibrated per (program, engine) on the control, and
every variant on that engine then does the same work. Calibration
re-measures the big/small pair until big − small is about 0.8 × 0.3 s; the
landed values ran 0.15–0.8 s.

An early version estimated N from 1 vs 5 calls, before tier-up. On JSC that
estimate was 100× too slow, which left a 2 ms difference buried in startup
noise. That gave JSC null bands of ±500 % and impossible 0.04 ns/op values.
That sweep is kept as `box-x86_64/timing-v1-miscalibrated.json` and is not
used anywhere.

**Repetitions.** There are five repetitions, rep-major, with the variant
order rotated each repetition and big/small order alternating. A cell is the
median of the five.

**Null band.** `<control>~copy` is a byte-identical second module timed as
its own row. Its ratio to the control is the null band for that
(program, engine). A cell is starred `*` in the full matrix only when its
whole min..max range lies beyond that band. With a 0.15–0.5 ns/op control
(regs, clock, multimem), one cycle is 0.2 ns and bands of ±10–25 % are
normal. Read those families by class geomeans, not single cells.

**Timing location.** All timing is from the quiet box. Load average was
0.48 before and 0.89 after, with one benchmark process at a time on
4 vCPU. The laptop was used for correctness (every module on 11 engines)
and arm64 disassembly only. No arm64 timing is reported.

**What a microbenchmark is not.** These are per-op costs of a
representation in a hot, warmed loop: an upper bound on what the change is
worth in place. Whether a whole-app number moves depends on how much of the
app's time is in that op, which the profile-driven pipeline doc owns. Two
places where the bench is deliberately kinder than the emulator:
- Register numbers are compile-time constants, as in a compiled region.
  The threaded interpreter computes `reg_base + r*4` from the operand.
- The guest window always hits.

## 2. Engines

Engines are the jsvu shells on the box, plus the CLIs built or downloaded
there:

| Engine id | What | Version | Ran | n/a | Notes |
|---|---|---|---:|---:|---|
| v8-tf | d8 `--no-liftoff --no-wasm-lazy-compilation` (TurboFan only) | d8 16.0.128 | 78 | 0 | |
| node | node default (Liftoff→TurboFan dynamic tiering) | node v24.22.1, V8 13.6.233.17 | 78 | 0 | the CLI harness engine |
| sm-ion | `sm --wasm-compiler=ion` | SpiderMonkey 162.0b2 | 78 | 0 | |
| jsc | jsc default (BBQ→OMG) | JSC 327663 | 78 | 0 | `--useWebAssemblyTailCalls=true` |
| wasmtime | Cranelift | wasmtime 39.0.0 | 78 | 0 | |
| wasmer | Cranelift | wasmer 6.1.0 | 73 | 5 | refuses tail calls, memory64, multi-memory |
| v8-liftoff | `--liftoff --no-wasm-tier-up` | d8 16.0.128 | 78 | 0 | |
| sm-baseline | `--wasm-compiler=baseline` | SM 162.0b2 | 78 | 0 | |
| jsc-bbq | `--useOMGJIT=0` | JSC 327663 | 78 | 0 | |
| jsc-ipint | `--useBBQJIT=0 --useOMGJIT=0` (in-place interpreter) | JSC 327663 | 78 | 0 | what iOS Lockdown Mode runs |
| wasm3 | interpreter | 0.9.2 | 65 | 13 | no SIMD; `return_call_indirect` overflows its stack (no real tail calls) |
| wasmi | interpreter | 2.0.3 | 72 | 6 | no threads/atomics (refuses shared memory) |
| wasmtime-pulley | `--target pulley64` interpreter | wasmtime 39.0.0 | 72 | 6 | `wasm_threads` unsupported |
| wasm2c | WABT wasm2c → clang -O2 + simde 0.8.2 | wasm2c 1.0.37 (`--version` prints 1.0.36 git~1.0.37), Ubuntu clang 18.1.3 | 75 | 2 | **2 bugs, below**; check.json's version string says `cc` (gcc 13), but `CC=clang` compiled it (label fixed in run.js afterwards) |
| wasmer-singlepass | | wasmer 6.1.0 | 0 | 78 | refuses every module, even one with no proposals ("does not support the required features") |
| v8-drumbrake | `--wasm-jitless` | d8 16.0.128 | 0 | 78 | DrumBrake is not compiled into the jsvu d8 build (`Contradictory value for readonly flag --wasm-jitless`), on the laptop too |

**Engine bugs found:**

1. **wasm2c 1.0.37, non-shared `i32.atomic.rmw.cmpxchg` returns the
   expected value, not the loaded value.** Its non-shared atomics are plain
   C, and the cmpxchg returns `expected_wrapped`. `lock.rmw8.rmw-ns` gives
   checksum 2502755541 against 3726944176 on all 85 other votes.
2. **wasm2c emits invalid C for tail-calling functions with locals.** It
   writes a duplicated type token, `u32   u32 var_i0…`. The threaded dispatch
   module cannot be built.
3. **Every JIT emits `lock`-prefixed instructions for atomics on non-shared
   memory.** This is not a bug, but it is unexpected (§3.6).

## 3. The matrix

The control row shows absolute ns per guest op. Other rows show ratios to
the control on the same engine. The full table, with all 16 columns and
per-cell significance stars, is
`scratch/runs/20261125-wat-repr-microbench/box-x86_64/report.md`, generated
by `node tools/wat-microbench/report.js --res=…/box-x86_64`. The condensed
tables below keep one engine per tier plus the class geomeans.

### 3.1 Registers

The `wide` program is 48 ops of add, sub, xor-imm, rol, load and store over
8 GPRs. `narrow` is the same op mix plus 30 % movb/movh/movw writes to
AL..BH and AX.

| regs.wide | V8 TF | SM Ion | JSC | wt CL | Liftoff | SM base | IPInt | wasm3 | wasmi | Pulley | wasm2c |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| mem, constant addr (control) | 0.16 ns | 0.16 | 0.16 | 0.15 | 0.15 | 0.42 | 6.40 | 1.89 | 1.88 | 3.79 | 0.50 |
| mem via base global (today) | 1.19 | 1.07 | 1.01 | 1.24 | 1.28 | 1.19 | 0.76 | 1.98 | 1.75 | 1.22 | 1.14 |
| globals | 0.67 | 0.75 | 0.65 | 1.02 | 0.73 | 0.37 | 0.81 | 0.98 | 1.08 | 1.07 | 0.24 |
| locals | **0.47** | **0.46** | **0.47** | **0.49** | **0.46** | **0.37** | 0.73 | **0.42** | **0.54** | **0.42** | **0.11** |
| i64 pairs | 2.32 | 2.27 | 2.32 | 2.25 | 2.33 | 0.87 | 1.58 | 2.03 | 2.18 | 1.50 | 0.16 |
| null band (copy) | 1.04 | 1.19 | 1.08 | 1.01 | 1.00 | 0.97 | 1.04 | 1.06 | 1.23 | 1.01 | 1.13 |

| regs.narrow | V8 TF | SM Ion | JSC | wt CL | Liftoff | SM base | IPInt | wasm3 | wasmi | Pulley | wasm2c |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| mem + store8/16 (control, today's `$set_reg8`) | 0.41 ns | 0.42 | 0.41 | 0.40 | 0.41 | 0.64 | 6.66 | 1.75 | 1.96 | 3.44 | 0.56 |
| mem + 32-bit load/merge/store | **0.41** | **0.37** | **0.48** | **0.41** | **0.45** | **0.69** | 1.20 | 1.46 | 1.23 | 1.21 | 0.82 |
| globals | 0.35 | 0.29 | 0.25 | 0.41 | 0.33 | 0.29 | 0.93 | 1.21 | 1.09 | 1.34 | 0.48 |
| locals | **0.22** | **0.22** | **0.23** | **0.22** | **0.23** | **0.28** | 0.86 | 0.66 | 0.72 | 0.49 | 0.14 |
| i64 pairs | 0.85 | 0.90 | 0.81 | 0.87 | 0.84 | 0.67 | 1.57 | 2.53 | 2.41 | 1.81 | 0.14 |

**Verdict: locals win everywhere; i64 packing loses everywhere but wasm2c;
narrow writes should merge on every JIT; a base global costs.**

- **Locals** are about 2× faster than memory in every class. They are 4.5×
  faster on narrow code, where the memory form also pays a store-forwarding
  failure.
- **i64 pairs** cost 2.3×: the shift/mask work outweighs half the loads.
  clang alone turns them into registers.
- **Narrow writes.** On every JIT tier, a narrow `store8` followed by the
  next 32-bit `i32.load` of the same slot is 2.3× slower than writing the
  merged 32-bit value. That is consistent with narrow-store-to-wide-load
  forwarding failing on x86, the same store-forward stall toyvm saw on
  resident narrow vregs; no hardware counters were read. Interpreters are the exception: they dispatch per wasm
  instruction, so the three extra wasm ops of a merge cost more than the
  stall.
- **Globals** are a middle ground: 0.67–0.75 on V8, SM and JSC, but no win
  on Cranelift and the interpreters.
- **A base global (`$reg_base`)** in front of every access costs
  +15 % (opt JIT) and +63 % (baseline). JSC BBQ pays 2.8×, re-reading the
  global per access.

Native shape (`$run`, x86_64, insns / stack-slot accesses):
- SM Ion: wide mem 249/10, wide local 149/10.
- V8 TF: wide mem 562/60, wide local 472/74. V8 keeps locals in registers
  but spills more around the loop.
- SM baseline: local 316/151. The baseline compiler keeps every local in a
  stack slot, so locals win there by turning loads into cheaper
  stack-slot moves, not by register allocation.

### 3.2 Flags

`flags.alu` is a 40-item ALU sequence: add/sub/cmp/logic/adc with Jcc
consumers, and lahf/sahf round trips. Flag liveness is computed per item;
the region exit needs every flag. `flags.fpu` is
`fld; fcomp; fnstsw ax; sahf; jcc; add` groups.

| flags.alu | V8 TF | node | SM Ion | JSC | wt CL | Liftoff | SM base | JSC BBQ | IPInt | wasm3 | wasmi | wasm2c |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| lazy (control, today's op/a/b/res record) | 0.44 ns | 0.37 | 0.97 | 0.22 | 1.11 | 0.32 | 1.93 | 2.27 | 45.7 | 14.4 | 10.3 | 0.11 |
| lazy, dead records skipped | 0.51 | 0.61 | 1.02 | 1.16 | 1.01 | 0.69 | 0.90 | 0.92 | 0.85 | 1.03 | 0.95 | 1.01 |
| eager flag word | 0.92 | 1.11 | 0.47 | 2.27 | 0.45 | 1.29 | 0.96 | 0.61 | 0.57 | 0.85 | 1.06 | 1.12 |
| eager, dead bits not computed | **0.57** | **0.68** | **0.28** | 1.33 | **0.26** | 0.85 | **0.67** | **0.29** | **0.35** | **0.34** | **0.46** | 1.15 |
| null band | 0.97 | 0.91 | 1.31 | 1.16 | 0.96 | 1.39 | 1.04 | 1.00 | 1.00 | 1.03 | 1.15 | 1.10 |

| flags.fpu | V8 TF | node | SM Ion | JSC | wt CL | Liftoff | SM base | JSC BBQ | IPInt | wasm3 | wasmi | wasm2c |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| lazy (control) | 0.39 ns | 0.40 | 0.69 | 0.36 | 0.79 | 0.47 | 1.98 | 1.41 | 25.9 | 10.2 | 7.46 | 0.68 |
| eager C0/C2/C3 → flags | 1.68 | 1.59 | 0.84 | 1.49 | 0.72 | 1.33 | 0.71 | 0.59 | 0.59 | 0.57 | 0.69 | 0.91 |
| fused compare-branch | **0.77** | **0.62** | **0.39** | 0.72 | **0.32** | **0.60** | **0.68** | **0.25** | **0.35** | **0.28** | **0.35** | **0.79** |

**Verdict: the win is dead-flag elimination and fusion, not eager vs lazy.**

- Eager flags with liveness are 0.46 / 0.55 / 0.37 by class.
- Eager *without* liveness is a coin toss per engine: V8 TF 0.92, Liftoff
  1.29, JSC 2.27, SM and Cranelift 0.45.
- JSC's OMG is the one optimising compiler where even eager-DCE loses
  (1.33). The lazy form is unusually fast there (0.22 ns, the fastest
  control of all JITs), because OMG's B3 eliminates the dead record stores
  itself.
- wasm2c does the same, at 0.11 ns. clang removes the whole lazy record,
  which is why every variant is ≥ 1 there.
- The FPU fusion (`fcom … sahf; jcc` → `f64.lt` + `br_if`) is a consistent
  2–3× on every engine.

Native (x86_64, `$run`): SM Ion lazy 714 insns / 45 calls (the `$get_*`
if-chains stay calls) vs eager-DCE 378 / 7. V8 TF inlines the getters
(5 calls either way) and goes 772 → 570.

### 3.3 Dispatch

A 33-op bytecode loop (add/sub/xor/shift/load/store/branch) runs under
five dispatch shapes.

| dispatch.bc33 | V8 TF | node | SM Ion | JSC | wt CL | Liftoff | SM base | JSC BBQ | IPInt | wasmi | Pulley |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| threaded `return_call_indirect` (control = `dispatch-next`) | 4.19 ns | 3.86 | 1.60 | 1.46 | 4.14 | 3.58 | 2.84 | 3.22 | 54.3 | 23.2 | 67.4 |
| one br_table loop | **0.16** | **0.25** | 0.72 | 0.61 | **0.27** | **0.17** | 0.60 | 0.40 | 0.67 | 0.43 | 0.65 |
| call_indirect loop | 0.72 | 0.76 | 1.12 | 1.47 | 0.54 | 0.83 | 0.83 | 1.35 | 1.10 | 0.95 | 1.13 |
| region: blocks + br_table | 0.04 | 0.06 | 0.19 | 0.10 | 0.04 | 0.07 | 0.11 | 0.05 | 0.18 | 0.13 | 0.08 |
| region: straight code | 0.03 | 0.04 | 0.09 | 0.11 | 0.03 | 0.04 | 0.06 | 0.06 | 0.12 | 0.09 | 0.06 |

(wasm3, wasmer and wasm2c cannot run the threaded control, §2. Their loop
numbers are in the full matrix.)

**Verdict: a threaded tail call is the most expensive way to dispatch on
every engine. V8 and Cranelift pay most for it.**

- **V8.** A threaded op costs 4.2 ns, about 21 cycles. The x86_64
  `$th_ADD` hot path is ~45 instructions. The add itself is 6 of them. The
  rest:
  - `$steps` global load/test and the `$ip` load/bump/store, both through
    the globals area;
  - the operand-pair load;
  - a table bounds check, then a signature check (`cmp $0x20`);
  - frame teardown;
  - a `jmp *(%r10,%rcx)` through the code-pointer table.

  That is two indirections from table to code. The op-to-op chain goes
  through memory: `$ip`, then the op word, then the table entry, then the
  code pointer.
- **SM Ion** pays less (1.6 ns), so the loop's advantage there is 0.72.
- **JSC** is 1.46 ns threaded but only 0.61 for the loop.
- A **call_indirect loop** is no better than the tail call.
- A **compiled region** is a further 5–10× below the loop on every engine,
  interpreters included.

This is the main-emulator confirmation of toyvm's verdict
(`project_toyvm_uop_tier`: one-function br_table loop ≈ 3× threaded on
arm64 and x86_64). It holds on baseline compilers and interpreters too,
not just TurboFan.

### 3.4 Guest memory access

Four groups of 3 loads + 1 store at random 16-byte-aligned guest addresses
in a 1 MB window.

| memacc.g16 | V8 TF | node | SM Ion | JSC | wt CL | Liftoff | SM base | JSC BBQ | IPInt | wasm3 | wasmi | wasm2c |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| inline affine window check (control, `g2w-fast`) | 0.40 ns | 0.59 | 0.70 | 0.58 | 0.69 | 0.54 | 0.60 | 0.63 | 34.2 | 5.75 | 4.74 | 0.55 |
| `call $g2w` | 1.36 | 1.16 | 2.80 | 1.07 | 2.01 | 1.07 | 2.87 | 4.57 | 2.12 | 2.58 | 3.09 | 0.90 |
| `call $gl32/$gs32` (today's handler path) | 2.19 | 1.35 | 1.98 | 1.38 | 2.59 | 1.50 | 3.39 | 4.90 | 2.03 | 2.73 | 2.84 | 0.95 |
| one check per 16-byte group | 1.00 | **0.60** | **0.66** | **0.60** | **0.48** | 0.89 | 1.24 | 0.96 | **0.45** | **0.38** | **0.41** | 0.61 |
| no check (floor) | 0.73 | 0.58 | 0.60 | 0.59 | 0.43 | 0.70 | 0.96 | 0.84 | 0.40 | 0.69 | 0.51 | 0.75 |
| page table, inline | 1.79 | 1.40 | 0.98 | 1.09 | 1.05 | 1.38 | 1.57 | 1.41 | 0.90 | 1.33 | 1.31 | 1.69 |
| page table, call | 1.35 | 1.13 | 2.76 | 1.08 | 2.32 | 1.34 | 3.29 | 5.23 | 1.84 | 2.77 | 3.94 | 1.14 |
| page table, per group | 1.12 | 0.63 | 0.73 | 0.66 | 0.59 | 0.86 | 1.02 | 0.81 | 0.55 | 0.42 | 0.51 | 0.79 |

**Verdict: today's inline fast path is right; calls cost on every engine
but wasm2c; one check per group reaches the floor; a page table per access
costs 20–45 %.**

- **Calls.** SM Ion (2.8×), Cranelift (2.0×), the baseline compilers and
  the interpreters do not inline a 6-instruction helper. V8 TurboFan does
  (1.36 / 2.19), and so does clang (0.9). This matches
  `project_toyvm_mem_accessor_calls` (Ion inlines no accessor call).
  `$gl32`/`$gs32` is today's threaded-handler load path, so on Firefox and
  Safari every guest load in a handler pays 2–5×.
- **Hoisting.** One window test per 16-byte group (the pipeline's window
  guard hoisting) lands at the no-check floor: 0.65 vs 0.55 for opt JIT,
  0.42 vs 0.46 for interp. The bounds check is the cost, not the address
  arithmetic.
- **Page table vs affine.** A flat page table (one PTE load per access)
  costs +20 % (opt JIT) to +69 % (wasm2c) over the affine test. With one
  PTE per group it is within 5 % of affine-per-group, so the translator
  choice matters only where nothing is hoisted.

### 3.5 SSE

`sse.packed` is movaps/addps/mulps/subps/shufps/andps groups over 8 XMM
registers. `sse.scalar` is addss/mulss/subss and addsd/mulsd/subsd with a
packed andps/orps every group.

| sse.packed | V8 TF | node | SM Ion | JSC | wt CL | Liftoff | SM base | JSC BBQ | IPInt | wasmi | Pulley | wasm2c |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `$xmm_addr`/`$xmm_get`/`$xmm_set` calls (control) | 2.20 ns | 2.24 | 5.94 | 2.83 | 5.31 | 3.52 | 7.16 | 7.68 | 159 | 46.8 | 111 | 0.67 |
| inline `v128.load offset=16i (global.get $xmm_base)` | 0.21 | 0.22 | 0.08 | 0.09 | 0.07 | 0.13 | 0.08 | 0.11 | 0.05 | 0.12 | 0.11 | 0.70 |
| v128 locals | **0.04** | **0.06** | **0.02** | **0.03** | **0.02** | **0.04** | 0.07 | 0.04 | 0.03 | 0.03 | 0.04 | **0.16** |
| v128 globals | 0.08 | 0.09 | 0.03 | 0.05 | 0.04 | 0.05 | 0.08 | 0.05 | 0.04 | 0.08 | 0.09 | 0.28 |

| sse.scalar | V8 TF | node | SM Ion | JSC | wt CL | Liftoff | SM base | JSC BBQ | IPInt | wasmi | Pulley | wasm2c |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| lane extract/replace via `$xmm_get/set` (control) | 3.06 ns | 2.80 | 6.45 | 3.91 | 5.78 | 3.74 | 7.65 | 8.05 | 175 | 56.5 | 126 | 0.84 |
| f32/f64 load+store of lane 0 at its address | **0.28** | **0.33** | **0.12** | **0.22** | **0.15** | **0.23** | **0.13** | **0.11** | **0.04** | **0.08** | **0.08** | 1.14 |
| whole-vector op, then shuffle lane 0 back | 0.97 | 1.01 | 0.99 | 1.06 | 1.02 | 1.05 | 1.15 | 1.19 | 1.17 | 1.02 | 1.09 | 1.02 |
| v128 locals + lane ops | 0.09 | 0.10 | 0.04 | 0.07 | 0.05 | 0.07 | 0.15 | 0.06 | 0.06 | 0.11 | 0.05 | 0.25 |

**Verdict: the XMM accessor calls are the single most expensive
representation in the suite, 9–30× on every engine.**

- Inlining the address with a constant `offset=` recovers almost all of
  it.
- Scalar ss/sd are 3.5–5× cheaper as a plain `f32.load`/`f32.store` (or
  f64) of lane 0 at its address than as extract/replace on a loaded
  vector. Doing the op on the whole vector and shuffling lane 0 back
  gains nothing.
- wasm2c is the exception: clang inlines the calls, so only residency
  (locals 0.16) helps there.

### 3.6 Locked RMW

`lock.rmw8` is lock add/sub/and/or/xor/xadd/inc/dec over 32 counters.

| lock.rmw8 | V8 TF | node | SM Ion | JSC | wt CL | Liftoff | SM base | JSC BBQ | IPInt | wasm3 | wasm2c |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| i64 load + i64 cmpxchg retry loop, shared (control, `05-alu.wat`) | 2.86 ns | 2.88 | 2.62 | 2.55 | 2.47 | 3.03 | 3.29 | 3.24 | 44.9 | 10.5 | 2.49 |
| one `i32.atomic.rmw.*`, shared | 1.07 | 1.09 | 1.05 | 1.15 | 1.22 | 1.06 | 0.98 | 0.99 | 0.44 | 0.47 | 1.17 |
| plain load/op/store, shared | **0.09** | **0.11** | **0.09** | **0.11** | **0.14** | **0.07** | **0.21** | **0.15** | **0.44** | **0.38** | **0.13** |
| CAS loop, non-shared memory | 0.97 | 0.98 | 1.02 | 0.94 | 1.04 | 0.94 | 0.99 | 1.03 | 0.99 | 1.08 | 0.24 |
| plain, non-shared | 0.11 | 0.11 | 0.12 | 0.12 | 0.12 | 0.08 | 0.23 | 0.22 | 0.45 | 0.26 | 0.13 |

**Verdict: a locked op costs ~2.5 ns (one `lock`-prefixed instruction) on
every JIT, whatever the wasm form; plain RMW is 8–9× cheaper.**

- `atomic.rmw` is no cheaper than the CAS loop on JITs. x86 `lock xadd` /
  `lock cmpxchg` dominate, and and/or/xor compile to cmpxchg loops anyway.
- `atomic.rmw` is 2.2× cheaper on interpreters, since it is fewer wasm
  instructions.
- **Making the memory non-shared changes nothing on any JIT.** The x86_64
  disassembly has the same 40 `lock` instructions in V8's `$run` for the
  shared and non-shared CAS loops; SM Ion has 10 in both non-shared
  variants. Only wasm2c compiles
  non-shared atomics to plain C, and it gets cmpxchg wrong (§2).

So the only way to stop paying for LOCK in single-threaded mode is to emit
a plain RMW. That is the pipeline's V1 (`$LOCK_MODE == 0`); a non-shared
memory does not help.

### 3.7 Op encoding

This is the bytecode loop of 3.3 in its br_table form, with 5 encodings of
the op word.

| encoding.bc33 (class geomean) | opt JIT | baseline | interp | wasm2c |
|---|---:|---:|---:|---:|
| (handler, operand) 8-byte pair (control, today) | 1 | 1 | 1 | 1 |
| one packed 32-bit word | 1.06 | 1.00 | 0.97 | 0.91 |
| separate handler / d / s / imm fields | 1.03 | 0.98 | 0.96 | 0.99 |
| immediate inline in the stream | 1.02 | 0.92 | 0.92 | 0.82 |
| operand pre-scaled to a register byte address | 0.90 | 1.03 | 0.82 | 0.97 |

**Verdict: no encoding is worth changing to.** Null bands here are
±15–25 % (0.6–1.4 ns/op controls). Only pre-scaled register addresses show
any consistent effect, −10 % on opt JIT and −18 % on interpreters, and only
the interpreter cells clear the band. That is the shape the uop tier
already uses: operand words are vreg byte addresses.

### 3.8 Clock / budget charging

A 30-instruction compiled region in 7 basic blocks, joined by br_table.
The budget never runs out, so every check is a not-taken branch.

| clock.r30 (class geomean) | opt JIT | baseline | interp | wasm2c |
|---|---:|---:|---:|---:|
| test + decrement 2 globals per block (control, `$block_budget`+`$steps`) | 1 | 1 | 1 | 1 |
| 1 global per block | 0.97 | 1.01 | 0.91 | 1.07 |
| 1 local per block | 0.89 | 0.96 | 0.87 | 0.96 |
| 1 global per block, decremented by block length | 0.89 | 1.17 | 0.87 | 1.05 |
| global, per instruction | 1.82 | 1.48 | 1.42 | 1.88 |
| local, per instruction | 1.20 | 1.30 | 1.24 | 1.28 |
| one weighted charge per loop back edge | **0.87** | 0.91 | **0.74** | 0.84 |
| no clock (floor) | 0.78 | 0.91 | 0.70 | 0.92 |

**Verdict: per-block charging of two globals costs ~20–30 % over no clock
in a region of short blocks, and the cheap fix is fewer charges, not
cheaper ones.**

- One weighted charge per back edge recovers most of the gap (0.87 / 0.74
  vs floor 0.78 / 0.70).
- One global instead of two, or a local instead of a global, is inside the
  null band on most engines.
- Per-instruction charging is 1.4–1.9× and never right.

This supports the pipeline's §4.1 rule (charge the block ends the body
would have executed, as one sum at exits and back edges).

### 3.9 memory64 and multi-memory

- **memory64.** `ext.mem64` is the memacc program with i64 addresses and
  an i64 memory. It is slower on every class (1.13 / 1.56 / 1.11 / 1.24):
  - On x86_64, 32-bit memories are bounds-checked by guard pages. 64-bit
    ones get explicit compares: V8 TF `$run` has 69 vs 37 calls/traps,
    SM baseline is 2.04×.
  - Without the window check the gap shrinks but stays: m64-nocheck vs
    m32-nocheck is 0.67 vs 0.52 for opt JIT.
- **multi-memory.** `ext.multimem` moves the register file to a second
  memory:
  - free on V8, SM and wasmtime;
  - **3.1× on JSC OMG and 3.3× on BBQ**, consistent with memory 1's base
    and bound being reloaded per access (JSC disassembly not captured, so
    the mechanism is unverified);
  - 1.84× on wasm3;
  - unsupported on wasmer.

  JSC 327663 runs multi-memory, despite the older note that it lacks it,
  but too slowly to use.

## 4. What this says about current wine-assembly choices

| Choice today | Verdict from this suite | Where it applies |
|---|---|---|
| Regfile in memory, `reg_base`-relative (`03-registers.wat`) | Keep for the threaded interpreter: globals are no win on Cranelift or the interpreters, and the `regfile_in_memory` landing measured −7.3 % against globals. Inside compiled regions, residency in locals is 2× (wide) to 4.5× (narrow) on every engine. | pipeline E1 (residency), uop tier vregs |
| `$set_reg8` / `$set_reg16` = `i32.store8/16` | **Change**: a 32-bit load-merge-store is 2.3× faster on every JIT tier, because a narrow store followed by a wide load fails store forwarding. Only pure interpreters prefer store8. In regions with resident vregs, a narrow write must merge into the local (toyvm's store-forward stall result). | threaded handlers and uop lowering |
| Lazy flags, if-chain getters | Keep the lazy record in the interpreter (eager without liveness is engine-dependent and loses on V8/Liftoff/JSC). In compiled regions, eager computation of only the live bits is ~2× on every class except JSC OMG. | pipeline C3 (dead flags) and flag forwarding |
| `fnstsw ax; sahf; jcc` through the lazy record | Fuse to an f64 compare-branch: 2–3× on every engine. | pipeline V2 |
| `dispatch-next` threaded `return_call_indirect` | It is the costliest dispatch on every engine (V8 4.2 ns/op, 21 cycles). A br_table loop is 3×, a region 15–25×. The baked-in replication of `dispatch-next` (−4.9 % StarCraft) cut one call per op, but did not change the shape. The uop tier's one-function br_table engine is the right shape, and coverage (more code in programs) is the lever. | uop tier coverage; R1/R2 |
| `$gl32`/`$gs32` calls in handlers | 1.4–2.2× on V8, 2–5× on SM, JSC BBQ, Cranelift and interpreters. Inline the window fast path at hot call sites (as `g2w-fast` does) or hoist one check per address stream (pipeline window guard hoisting, already in 07e). | hot handlers, Firefox/Safari |
| `$xmm_addr` / `$xmm_get` / `$xmm_set` calls (06c-mmx) | **Change**: the worst representation in the suite. Inline `v128.load offset=16·i` (8–10×). Scalar ss/sd as `f32/f64.load/store` of lane 0 (5×). v128 locals in regions (30×). | pipeline V5, `--uop-sse` |
| LOCK RMW as i64 CAS loop | Equivalent to `atomic.rmw` on JITs, so do not bother converting. A plain RMW in single-thread mode is 8–9×. Non-shared memory gives nothing. | pipeline V1 |
| Op encoding (handler, operand) pairs | Keep; nothing measured is better beyond noise. | — |
| Two budget globals per block | Charge once per back edge / exit with the summed block weight (−13 % opt JIT, −26 % interp); merging the two globals alone is noise. | pipeline §4.1 clock |
| 32-bit memory, one memory | Keep. memory64 costs 13–56 %; a second memory is 3× on JSC. `bigMemory` beyond 4 GB would need a different design than memory64-everywhere. | — |

**For the optimizer pipeline's ordering**
([uop-optimizer-pipeline.md §2](uop-optimizer-pipeline.md)):

- The vocabulary passes it ranks cheapest are also those with the largest
  per-op effect here: V1 lock is 8–9×, V2 fused FPU compare 2–3×, V5 SSE
  scalar 5×.
- E1 residency is worth 2–4.5× per register op in isolation, on every
  engine. The pipeline places it last because whole-app value depends on
  what remains; nothing here argues against that order. It does argue
  that E1's narrow-write lowering must merge, not store8.
- M1 (store→load forwarding) matters most where narrow writes meet wide
  reads, since a failed forward is the cost here.

## 5. Native disassembly

Native disassembly was captured for every non-copy module with
`tools/wat-microbench/native.js`, which calls `tools/wasm-native.js`:
- engines: V8 TurboFan, SM Ion, SM baseline;
- x86_64 on the box (GNU objdump 2.42, d8 16.0.128, SM 162.0b2);
- arm64 on the M1 laptop: d8 15.4.49, SM 155.0, Homebrew binutils objdump.
  These are older shells than the box's, so the arm64 rows are structure
  from a different engine build, not a twin of the x86_64 capture.

Static per-function counts are in `native/<arch>/metrics.json`:
instructions, stack-relative accesses, calls and indirect jumps. Cold
paths are included, so read shape from them, not cost.

Winner vs loser, `$run` (x86_64 | arm64), insns / stack accesses / calls:

| Pair | V8 TF x64 | SM Ion x64 | SM base x64 | V8 TF arm64 | SM Ion arm64 |
|---|---|---|---|---|---|
| regs.narrow mem → local | 533/60/7 → 481/72/7 | 233/10/5 → 164/10/5 | 355/12/5 → 348/160/5 | 502 → 433 | 249 → 179 |
| flags.alu lazy → eager-dce | 772/99/5 → 570/73/5 | 714/283/45 → 378/31/7 | 1062/442/45 → 779/414/7 | 744 → 537 | 818 → 420 |
| flags.fpu lazy → fused | 947/95/6 → 660/86/6 | 677/204/35 → 369/33/7 | 910 → 621 | 827 → 585 | 739 → 349 |
| dispatch threaded `$th_ADD` (per op) | 64 insns, 1 indirect jmp | 108, 26 stack | 140, 40 stack | 84 | 112 |
| memacc inline → call-gl32 → hoisted | 637/37 → 622/49 → 379/13 calls | 432/23 → 224/23 → 176/11 | 556 → 336 → 312 | 619 → 590 → 381 | 421 → 302 → 241 |
| sse.packed mem-call → locals | 612/151/54 → 556/86/7 | 392/129/78 → 161/12/7 | 624/197/78 → 334/142/7 | 574 → 488 | 561 → 154 |
| lock cas64 → plain | 1553/309/23 → 550/86/7 | 448/68/7 → 191/14/7 | 831 → 378 | 1366 → 497 | 450 → 198 |
| clock blk-2global → insn-global → backedge | 497 → 659 → 460 | 249 → 365 → 196 | 373 → 507 → 331 | 441 → 520 → 397 | 242 → 320 → 198 |
| ext m32 → m64 | 637/37 → 752/69 | 432 → 500 | 556 → 620 | 619 → 715 | 421 → 505 |

What the code shows:
- **Ion does not inline the small helpers.** The call count stays at 23
  for `call-gl32` and 78 for `mem-call`.
- **V8 TF inlines them** (37/49 call sites include its inlined bodies' slow
  paths and stack checks).
- **SM baseline** keeps every local in a stack slot: `local` variants have
  ~150 stack accesses.
- **The arm64 shape matches x86_64 for every pair.** No arm64 timing was
  taken (laptop, not quiet), so arm64 evidence is structural only.
- **Not captured.** No JSC, wasmtime or wasm2c disassembly was captured.
  `tools/wasm-native.js` supports V8 and SM only. Their verdicts rest on
  timing.

## 6. Reproduce

```sh
node tools/wat-microbench/gen.js --out=W/mods --wat2wasm=$(command -v wat2wasm)
node tools/wat-microbench/run.js --engines-only                 # what is installed
node tools/wat-microbench/run.js --mods=W/mods --out=W/res --check   # checksum vote
node tools/wat-microbench/run.js --mods=W/mods --out=W/res --reps=5 --target-sec=0.3   # quiet box only
node tools/wat-microbench/report.js --res=W/res --md=W/res/report.md
OBJDUMP=/usr/bin/objdump node tools/wat-microbench/native.js --mods=W/mods --out=W/res
node test/test-wat-microbench.js    # generator + in-node checksum agreement
```

Engine binaries come from `$D8 $SM $JSC $WASM3 $WASMI $WASMTIME $WASMER`.
`$WABT_DIR` (WABT build with `bin/wasm2c` and the runtime) and `$SIMDE_INC`
come from the environment; `$CC` is the wasm2c compiler. The box sweep ran
14 engines × 1045 rows × 5 reps in 36 minutes.
