# The uop optimizer as one pass stack: value specialisation plus an optimising region pipeline

Status: design only, 2026-11-25. No emulator code is written here. Evidence is in
`scratch/runs/20261125-optimizer-pipeline-design/`. The measurements it builds on
are in `scratch/runs/20261125-fold-arms-bench/` (fold-bench arms A/B/C/D),
`scratch/runs/20261125-spelunky-classic-gameplay-profile/` (Spelunky Classic
gameplay profile and uop census) and `scratch/runs/20261125-uop-sse/` (SSE in
the tier). The tier itself is described in `docs/uop-tier-design.md`. This
document cites that file by section number and does not restate it.

## 0. Thesis and one-paragraph answer

Our compiler optimisations keep measuring neutral because each one has been
tested alone, and most of them only pay when a pass before them has already
run. The clearest case has been measured, on the fold-bench branch (Spelunky
Classic gameplay, x86_64 box, window 29600:32600, null band 0.2 %):

| Arm | What it does | Result |
|---|---|---|
| A | Helper bodies become programs | +0.4 % |
| A+B | Adds seam elision | −3.5 % |
| A+B+C | Adds read-only folding at absolute addresses | −2.4 % |
| D | Hand-written native bodies for the same Delphi RTTI helpers | **−16.2 %** |

D wins because it does five things at once:
- it removes the call/ret round trips and the entry/exit cost;
- it knows the TypeInfo record is constant;
- it resolves the kind ladder;
- it runs the field loop the known number of times;
- it executes `lock inc`/`xchg` natively.

A, B and C each do one of those things, and each needs at least one of the
others first. C cannot fold anything inside `_CopyRecord`, because the address
it would need, `[ecx+6]`, is constant only after ECX is known. ECX is known
only after a lattice carries the caller's `mov ecx,[0x5436f0]` into the inlined
callee. And the callee's facts are per call site only after inlining clones the
callee per site. Today the tier shares one body between call sites (§1.3).

This document designs the passes as one ordered stack, with each dependency
explicit:

1. vocabulary
2. region formation with per-context inlining
3. a constant/copy lattice with read-only folding
4. value specialisation, which seeds the lattice
5. branch folding
6. unrolling
7. memory forwarding
8. residency in locals

It also defines a measurement protocol that only tests a pass with its
prerequisites present: cumulative prefixes, plus leave-one-out from the full
stack. §8 makes the predictions this design stands or falls on, including
which earlier "neutral" verdicts should flip.

## 1. What the tier has today

### 1.1 Shape

- **Engine (07d).** `$uop_fast` and `$uop_run` form one `br_table` loop over a
  program that is *data* in the per-instance arena. There is no runtime wasm
  codegen, which is a hard constraint (`feedback_no_runtime_wasm_codegen`).
  - Operand words are vreg byte addresses. Vregs 0–7 *are* the guest
    registers in `$REGFILE`, so entry and exit move nothing.
  - Temps live in scratch memory.
  - `$uop_fast` makes no call. Any op that needs a call (window miss, GUARD,
    GETCF, BCC, x87/SSE service, MMX) hands back to `$uop_run`, which keeps
    `pc` in a machine register (§8 of the tier doc).
- **Compiler (07e, in WAT).** It is a single forward lowering, not an IR with
  passes:
  1. `$uc_decode` produces 256-byte x86 instruction records, keyed by
     **address** in `UC_HM_INSN`.
  2. `$uc_form_loop` keeps everything reachable from the head that can reach
     it again. It follows calls within `UC_SPAN`.
  3. If that fails, `$uc_form_trace` builds a forward trace of 8–160
     instructions with cut exits (§13, §21.3).
  4. `$uc_build_blocks` builds the blocks.
  5. `$uc_liveness` / `$uc_flow` run the flag dataflow, with merge
     materialisation and first-iteration peeling.
  6. Snapshots are demand-driven and iterated to a fixed point.
  7. The emitter writes a symbolic item stream with deopt stubs, then encodes
     it in three passes.

  Optional sub-passes:
  - `$uc_sp_block`, the push/pop elision of `--aggressive-stack`, opt-in;
  - `$uc_try_mcopy`, which coalesces load/store pairs;
  - jump tables (kind 28), the `FF /2` inline cache (`--uop-icall`, off),
    MMX, native x87 forms, and SSE as handler calls (`--uop-sse`, off).
- **What "passes" exist, by toyvm's list (§4):**
  - promote: implicit, since registers are vregs;
  - flag forwarding (`cmp/test/dec + jcc` to compare-and-branch) and flag
    liveness;
  - window guard hoisting;
  - clock;
  - mcopy and stack elision.

  **There is no value lattice.** `$uc_valof` knows a constant only when the
  operand is an immediate. **There is no branch folding** beyond the flag
  forwarder, **no unrolling** (peeling is the one duplication), **no
  load/store forwarding** in the tier, and **no LICM**.

### 1.2 Guards and side exits

**Guards:**
- **Window GUARD.** A `$g2w_affine_span` proof is made per address stream,
  re-guarded per page and kept across entries under `$UOP_WIN_EPOCH` (§9).
- **Code-page test** for store windows.
- **ICG** is the indirect-call target guard.
- **RET candidate check.** A RET is kept only if
  `$uc_ret_targets` gives it one or two candidate return addresses. It
  compares the popped address and deopts on any other.
- **CHK** before every charged branch.

**Exits:**
- Every exit is a stub that sets EIP and materialises the lazy flag record
  exactly as threaded code would. A failed access exits *before* its effect.
- **Retirement.** A program is retired as "poor" when
  `enters >= 256 && blocks < 2*enters`.
- **Kills.** A code write into any of a program's guest byte ranges
  (`$uop_add_range`, which also marks the pages as code) kills the program.

### 1.3 Calls today: one shared body, return dispatched

The scan follows `E8` calls within span, so a callee's records join the
region **once per address**. A RET returns to at most two candidate addresses
by compare-and-branch. Callee code reached from two call sites is therefore
one body. That is correct, and it is cheap to compile. But any per-call-site
fact meets at the callee entry: `System.Move` is called with ECX = 16 from one
`_CopyRecord` site and ECX = 4 from the other (§3.1), and a lattice over a
shared body sees ⊤. **Per-context cloning is the first structural change the
pipeline needs** (§2, R2). It is not an optimisation in its own right.

Fold-bench's "B, inline small callees" did not inline anything. It steps over
the pending CALL/RET seam ops 79/80/87 in `$uop_fast` when no observer is armed
(`dao_status | pending_armed == 0`). Its −3.5 % is the price of those seams,
which is worth knowing on its own (§8, P-3).

### 1.4 Clock charging

**Branch clock.** Under `--branch-clock`, a batch is a count of executed x86
branches. A program charges one block per branch op (B*, JMP, BCC) and per
threaded block end it replaces. Each charge is preceded by a CHK. When the
budget is gone, the CHK's stub materialises the flags, takes the transfer and
ends in EXITB at the target, so the batch stops on the same instruction with
the tier on or off.

**Historical clock** (the default). It also charges cuts, which depend on
decode history. Features that cannot match it (trace cut exits) are restricted
to the branch clock. Every A/B runs `--branch-clock` in both arms (§8, §13).

### 1.5 What it declines, measured on Spelunky Classic gameplay

From `20261125-spelunky-classic-gameplay-profile/headless/run-b/uop-census.txt`,
window 29600..32600, 398 M threaded block entries:

**Untaken entries, by the head's verdict:**

| Verdict | Share |
|---|---|
| declined: no-backedge | **54.7 %** |
| live | 17.9 % |
| declined: head-unsupported | 9.8 % |
| poor | 8.4 % |
| no-verdict | 7.5 % |
| installed | 1.2 % |
| declined: call-indirect | 0.5 % |

**Unsupported forms in declined scans.** The weight is block entries at the
head:

| Form | Weight | Note |
|---|---|---|
| `ret` | 141 M | 121 M of it is no-backedge |
| `call` | 80 M | |
| `sahf` | 20 M | GML real compares: `fcomp / fnstsw ax / sahf / jcc` |
| `ret imm` | 12 M | |
| `jmp` (as a head) | 7.4 M | |
| `xchg r/m` | 6.8 M | `_LStrAsg` |
| `fs:` forms (`pfx64 mov/push/pop`) | ~9.2 M | Delphi SEH frames |
| `push` | 5.2 M | |
| `lock dec` / `lock inc` / `lock cmpxchg` | ~1.6 M combined | |

**Other counters:**
- 5308 compiles over 1694 heads, **68.1 % of them repeats**, caused by
  verdict-map aliasing. `exe+0x4abf8d` was compiled 471 times.
- Profile buckets:
  - `uop_fast` is 33.0 % of all samples;
  - `th_uop_enter` is 2.4 %, from 87.8 M enters at 48.9 ns self each, the
    most expensive threaded handler per call;
  - `uop_run` is 2.0 %;
  - threaded handlers are 16.3 %;
  - x87 is 10.5 %.
- Guest code split by function:

  | Code | Threaded instructions | uop live blocks |
  |---|---|---|
  | Delphi record RTTI | 33 % | 27 % |
  | GML interpreter | 18 % | 28 % |
  | GM instance core | 22 % | 22 % |
  | Collision | 13 % | 12 % |

**Why the shape is "no-backedge".** The RTTI helpers are called from about 22
sites each. The hot head is the helper entry. Its region has no cycle through
the head, and its final RET has no in-region return candidate, so the trace
is trimmed and declined. Arm A (RET as an exit) fixes the decline, but each
helper then becomes a short program paying ~49 ns to enter. That is the
measured +0.4 %.

## 2. The target pass stack

The passes are grouped by what they produce. Running order and dependency
order differ in one place: value specialisation runs first, to seed the
lattice, but it is *designed* after the lattice, because the lattice is what
picks its keys and makes it worth anything.

```
                         ┌──────────────────────────── vocabulary (lowering coverage) ───────────────────────────┐
                         │ V1 lock/xchg (LOCK_MODE 0)   V2 sahf, fnstsw+sahf+jcc   V3 fs: base   V4 rep ret     │
                         │ V5 SSE native arms (scalar)                                                             │
                         └──────────────┬──────────────────────────────────────────────────────────┬───────────────┘
                                        │ (a region can no longer be broken by these forms)        │
                                        ▼                                                          │
   R1 RET exit (fold-bench A) ──► R2 per-context inlining: records keyed (address, context) ──► R3 seam elision (B)
                                        │  context = call-site chain ≤3 | peel copy | unroll iteration
                                        │  + stack-slot facts (push/pop pairs, callee-saved regs, stack args)
                                        ▼
   S1 value specialisation ═══seeds═══► F1 constant/copy lattice over guest regs, ESP-relative slots, FS base
      (guarded variants, VPROF)            │            ▲                     │
      ▲ keys chosen by F1's                │            │ new facts           ▼
      │ "what-if" (wish list)              ▼            │            F2 read-only memory fold (C generalised:
      └────────────────────────────── C1 branch folding + CFG prune + region re-formation   address is any lattice
                                           │   (iterate R2→F1→F2→C1 to a fixed point, ≤3 rounds)   constant, SMC-guarded)
                                           ▼
                                      C2 unrolling of known-trip-count loops (per-iteration context → F1/F2/C1 again)
                                           │
                                           ▼
                                      M1 store→load forwarding + redundant-load removal (facts by value number;
                                           │   window-disjointness guard; reloaded values become F1 facts)
                                           ▼
                                      C3 dead-flag / dead-snapshot elimination (consumes everything C1/C2/M1 deleted)
                                           │
                                           ▼
                                      E1 residency in wasm locals (last; only if native disasm says vreg traffic dominates)
```

### 2.1 Passes, prerequisites, expected effect

The workload columns are **predicted** effects on the measured window, in
user CPU on the x86_64 box. "Alone" is the pass with nothing above it on
today's tier. "Stacked" is the pass's marginal effect when everything before
it is present. The workloads are:
- SC1, Spelunky Classic tutorial gameplay, 29600:32600;
- SHD, Spelunky Classic HD, gameplay 1-1, 213550:237550 (from the uop-sse run);
- H2/SC, Heroes II demo map 1000:1800 (the control) and StarCraft fast-route
  gameplay.

| Pass | Needs | SC1 alone → stacked | SHD | H2 / SC |
|---|---|---|---|---|
| V1 lock/xchg plain RMW while `$LOCK_MODE == 0` | none | ~0 → −1..−2 % (LStrAsg/LStrClr bodies stay in a program) | 0..−1 % | 0 / 0 |
| V2 `sahf`, `fnstsw ax+sahf+jcc` → x87 compare-branch | x87 natives (have) | −0.5 → −1..−2 % (20 M weight of GML real compares) | small | 0 / 0 |
| V3 `fs:` forms (base = per-instance constant) | none | ~0 → −0.5 % (SEH frames in Delphi try/finally) | small | 0 |
| V4 `rep ret` | none | ~0 | ~0 | 0 |
| V5 SSE scalar native arms (movss/movsd, cvtss2sd/cvtsd2ss/cvtsi2ss, add/sub/mul/div sd/ss, comis* → branch) | `--uop-sse` coverage (have) | n/a | **−3..−6 %** on top of −4.6 % | 0 |
| R1 RET exit | none | +0.4 % measured → prerequisite | 0..−1 % | ±0.5 % |
| R2 per-context inlining + stack-slot facts | R1, V1 | **+1..+3 % alone** (compile cost, bigger programs) → −2..−4 % (enters per x86 insn drop ≥30 %) | −1..−3 % | 0 / −1..−3 % (Storm call chains) |
| R3 seam elision | R2 | −3.1 % measured (A+B − A) → −2..−3 % | −1 % | 0 |
| F1 lattice | R2 | ~0 alone (no consumer) | ~0 | 0 |
| F2 RO fold | F1 | −0.5 % (absolute only, as C) → **−4..−7 %** with F1 | −0..−1 % | 0 |
| S1 value specialisation | F1, F2, C1 | ~0 alone → −1..−3 % (helper heads entered from threaded code) | 0..−1 % | 0 |
| C1 branch folding / prune | F1/F2 (+S1) | ~0 alone → −2..−4 % (RTTI kind ladders, Move size ladder) | small | 0 |
| C2 unrolling (trip ≤ 8) | C1, F1 | ~0 alone → −1..−3 % (field loop, Move qword loop) | small | 0 |
| M1 STLF / redundant loads | F1 (value numbers), windows | ~0 alone (toyvm: loads −28..−42 %, time flat) → −0.5..−1.5 % | −0.5 % | 0 / −0.5 % |
| C3 dead flags / snapshots | C1, C2 | 0 → −0.5 % | 0 | 0 |
| E1 residency in locals | all | toyvm +14..22 % on loops; predicted −1..−3 % here | −1..−3 % | −1 % |
| **Full stack** | | **−10..−14 %** (D alone: −16.2 %; full stack + D: −17..−19 %) | **−6..−10 %** (incl. V5) | H2 within null band; SC −2..−5 % |

Each prerequisite edge in the diagram has a concrete reason:

- **V → R.** An unsupported instruction ends the region. `_LStrAsg` contains
  `lock inc` and `xchg`, so without V1 a region rooted at `_CopyRecord`
  stops at its first string field. `_FinalizeArray` calls `_LStrClr`
  (`lock dec`).
- **R1 → R2.** A callee-rooted region needs a RET that may leave the program.
  Without R1, a helper head declines no-backedge, and an inlined callee has to
  return into the region.
- **R2 → F1.** Facts are per context. A shared callee body meets the
  constants of its call sites into ⊤ (§1.3). R2 also brings the stack-slot
  facts. Every Delphi helper opens with `push ebx/esi/edi` and closes with the
  matching pops, and Delphi's register convention passes the first three
  arguments in EAX/EDX/ECX. A callee-saved register pushed and popped around
  an inlined body is a fact the lattice must see through.
- **F1 → F2.** C folds a load only when its address is a bare disp32. Inside
  the helpers every RTTI read is `[reg + k]` (`mov cl,[edx+0x1]`,
  `mov edi,[ecx+edx+6]`, `mov ebp,[edi-4]`). It becomes `[const]` only from
  F1.
- **F2 → F1 (cycle).** A folded load produces a new constant, such as the
  field count, the field typeinfo pointer or the field offset. That is a new
  fact. F1 and F2 are one fixed-point iteration, not two passes.
- **F1/F2 → C1.** `cmp al,0x0a / jz` folds only when AL is known.
- **C1 → R2 (re-formation).** Pruned arms free scan and record budget
  (`UC_MAX_SCAN` 600, `UC_MAX_LOOP` 400) that the dead ladder arms were
  using. The region is formed again over the live CFG. Bounded to three
  rounds.
- **C1 → C2.** A trip count is known only when the loop's entry test and
  bound are folded. Unrolling then gives each iteration its own context, so
  F1/F2/C1 run again per iteration. That is where field i's kind and offset
  become constants.
- **F1 → S1.** The lattice's symbolic element `entry(r) + k` says which
  entry inputs would unlock folds. That is how S1 picks keys (§3.2). Without
  the lattice, specialisation has no consumer.
- **F1 → M1.** Forwarding compares addresses by value number, which F1
  provides. M1 also feeds F1: a stack argument stored and reloaded becomes a
  fact.
- **C1/C2/M1 → C3.** Flag producers whose only consumer was a folded branch
  die. Snapshots demanded by exits that no longer exist die.
- **everything → E1.** Residency is worth doing only on what remains. toyvm
  measured +14..22 % on loops and a store-forward stall on narrow writes
  (`project_toyvm_resident_vregs`), so it goes last and is gated by native
  disassembly.

### 2.2 Worked example: `_CopyRecord(RValue)` through the stack

The bytes are in `static/rtti-helpers.asm`, `static/copyrecord-callsites.asm`
and `static/typeinfo-bytes.txt` of this run. Every caller does
`mov ecx,[0x5436f0]` (`8b 0d f0 36 54 00`) and then `call 0x40674c`.

The TypeInfo record at 0x5436f4 is in `.text`, a non-writable section:
- `0e` = tkRecord;
- `06 'RValue'` = the name;
- `18 00 00 00` = size 24;
- `01 00 00 00` = 1 field;
- `cc 10 40 00` = the field's PPTypeInfo, where `[0x4010cc]` = 0x4010d0, the
  tkLString `string`;
- `10 00 00 00` = the field's offset, 16.

| Step | Pass | What becomes known or disappears |
|---|---|---|
| 1 | F2 (as C today) | `ecx = [0x5436f0]` folds to 0x5436f4 |
| 2 | R2 | the call is inlined into the caller's context. Without R2 the fact stops at the call |
| 3 | F1+F2 | `al=[ecx+1]`=6, `edi=ecx+6+0xa`=0x543704, `ebp=[edi-4]`=1 (count), `ecx=[edi-8]`=0x18 (size), `ecx=[edi+4]`=0x10 (offset). Five loads fold |
| 4 | C1 | `sub ecx,eax / jle` (16 > 0) folds. `System.Move` is called with ECX=16, a per-context constant |
| 5 | R2+F1+C1 in Move | `cmp ecx,0x20 / ja` and `sub ecx,8 / jg` fold. The `jmp [0x403100+ecx*4]` is never reached for 16. The FILD/FISTP qword copy at 0x4030bd remains, with its count known |
| 6 | F1+F2+C1 | `edx=[[edi]]`=0x4010d0, `cl=[edx]`=0x0a: the 7-way kind ladder (`cmp cl,0xa..0x11`) folds to the tkLString arm 0x4067b7 |
| 7 | R2+V1 | `_LStrAsg` is inlined. Its refcount tests, `lock inc` and `xchg` stay, because they are data |
| 8 | C1+C2 | `dec ebp / jnz 0x406766` with EBP=1: the loop runs once and the back edge disappears |
| 9 | F1+C1 | tail: `ecx = 24 − (16+4)` = 4 > 0, so `System.Move(…, 4)` takes Move's small-size arm, folded the same way |
| 10 | R2 stack facts | the four callee-saved `push`es and `pop`s around the body become slot facts, spilled only at exits |

**What remains:** two qword loads and stores (Move 16), one dword copy
(Move 4), `_LStrAsg`'s ~10 data-dependent ops, the RET guard, and the charge
for the branches the body would have executed.

**What threaded code ran:** ~55 instructions with ~12 branch ends, three
calls and three returns.

That residue is D's native body, derived without a signature. The same chain
applies to `_FinalizeRecord`, which reaches FinalizeArray with EDX=0x4010d0
and ECX=1 (the 93.6 % case), so it folds to "`_LStrClr(rec+16)`". It also
applies to `_InitializeRecord`.

## 3. Value specialisation

### 3.1 Why both mechanisms, specialisation and context constants

`scripts/arg-profile.js` reads fold-bench's passive `--count-census` logs
(window from batch 29600). The values are the register at helper entry,
keyed with the return address. Output in `arg-profile.txt`:

| Helper | Reg | Calls | Top-1 value (share, call sites) | Top-2 cum. |
|---|---|---|---|---|
| `_CopyRecord` | ECX (TypeInfo) | 420,164 | 0x5436f4 **97.7 %** (22 sites) | 100 % |
| `_FinalizeRecord` | EDX (TypeInfo) | 670,634 | 0x5436f4 **98.5 %** (21 sites) | 100 % |
| `_FinalizeArray` | EDX (elem TypeInfo) | 706,051 | 0x4010d0 **93.6 %** (1 site) | 100 % |
| `_InitializeRecord` | EDX | 681,763 | 0x4010d0 93.4 % (1 site) | 100 % |
| `System.Move` | ECX (count) | 842,828 | 0x10 51.0 % (2 sites), 0x4 48.7 % (1 site) | 99.7 % |

Two lessons for the design:

1. **The outer helpers are monomorphic across many call sites.**
   `_CopyRecord` takes the same TypeInfo from 22 sites. One guarded variant at
   the callee head serves every caller entering from threaded code. Cloning
   `_CopyRecord` into 22 caller regions would multiply compile work for no
   new fact.
2. **The inner callees are polymorphic per callee but monomorphic per call
   site.** `System.Move` is 51/49 % between 16 and 4, and each value comes
   from one call site inside `_CopyRecord`. Specialising Move at its head
   would need two variants and two guards. R2's per-context clone gets both
   values from the lattice with **zero** guards.

**Design rule: specialise at program heads, propagate inside programs.** A
guard is paid once, at the boundary where threaded code enters. Inside a
program, the lattice carries everything.

The census also shows what *not* to key on. `_LStrAsg`'s ECX is 0x0a in
98.2 % of calls, but that is the kind byte CopyRecord left in CL; LStrAsg
writes ECX before reading it. `_LStrClr`'s EDX is 6, also dead. A
profile-first design would waste variants on both. So the compiler, not the
profiler, picks the keys (§3.2).

### 3.2 Where profiles come from, and keying

**1. Wish list at tier-1 compile.** When a head compiles for the first time
(tier 1, no specialisation), F1 runs with every entry input symbolic:
- EAX..EDI as `entry(r)`;
- the first four dwords above the return address as `entry([esp+4k])`.

Every load, branch, jump-table index or loop bound whose operand is
`entry(x) + k`, or is derived from such a value through folds, is charged to
input x, with a weight:

| Event | Weight |
|---|---|
| a load at `entry(x) + k` that would fold if x pointed into a read-only image section | 1 |
| a branch | 2 |
| a loop bound | 4 × the static body size |

Inputs with weight ≥ 4 make the **wish list**: at most two inputs, in weight
order. The analysis is static and costs one extra lattice run.

**2. VPROF in the tier-1 program.** If the wish list is non-empty, the tier-1
program begins with one `VPROF` op per wish-list input.
- The op updates a 4-entry value sketch in the program header: Misra–Gries
  counters over (value, count), plus an `other` count.
- It costs two loads, a compare chain of at most 4 and one store per entry.
- This is the "cheap counter". It sits at the callee **entry**, not at each
  call site, because the entry is where the guard will go. The return address
  may be recorded as a fifth word, but only for the census tool.
- VPROF is a fast-path op with no call, so it costs `$uop_fast` nothing.

**3. Tier 2.** After `V` profiled entries (default 256), the head recompiles.
- **Key.** A value becomes a variant key when its share is ≥ 1/8 and
  re-running F1/F2/C1/C2 with it bound would delete at least `G` dynamic ops
  per entry (default 6 uops, or any loop trip or kind ladder).
- **Variant identity** is `(head eip, input location, value)`, with at most
  two inputs per variant. Value equality is exact. Equality alone is enough,
  because the folds come from the value pointing into read-only memory.

### 3.3 Guards, layout, cap

- **One compound program per head.** The layout is
  `[header][key dispatch][variant 1][variant 2][variant 3][generic]`, with
  one window table and one range set for all of them.
- **Guard.** The dispatch is a chain of existing ops: `BNE reg, pool(k) →
  next`. That is two loads and one compare per key, about 3–4 native
  instructions on the fast path, and needs no new op.
  - Variants live in **one** program because a jump into another program
    would skip that program's enter-op epoch check (§9). The compound layout
    avoids new engine mechanics entirely.
- **Cap.** Three variants plus generic, which Spelunky needs at most (two
  values cover ≥ 99.7 % on every helper above). The compound program must also
  fit `uop_code_bytes / 4` (decline 24). A head that would need more is
  **megamorphic**:
  - it keeps the generic body only;
  - it is marked so VPROF is not re-armed;
  - this mirrors `--uop-icg-mega` (§23.4).
- **Guard-failure accounting.** Each variant entry and the generic
  fallthrough get a counter in the header. If, after 4096 entries, the
  generic share exceeds 50 %, the head re-profiles once, then goes
  megamorphic.

### 3.4 Invalidation

**Code writes.** A specialised variant depends on code bytes, exactly like
today's programs, so the existing range kill covers it.

**Read-only data.**
- Every read-only dword F2 folded, in any variant, is registered as a
  program range. This is fold-bench C's soundness rule, kept: soundness rests
  on the write-kill, never on the section flag.
- Ranges are coalesced per contiguous run, so one TypeInfo record is one
  range, not five. That keeps `UOP_RANGES_MAX` (decline 25) from binding.
- `$uop_add_range` marks those pages as code, so a store to them takes
  `$code_write_hit` and kills the compound program.
- Read-only pages are written only after `VirtualProtect`, so the cost on
  writable data stays nil.

**Mapping and protection changes.**
- An unmap or protection change of a page holding folded data is not a store,
  so it does not trip the range kill.
- The `$guest_page_clear_range` path and VirtualProtect on image pages must
  kill programs with ranges there. Today they only bump the window epoch.
- A page made writable by VirtualProtect is also removed from F2's
  foldable set for the rest of the run.

**Profiles.** These are hints, not premises. A stale profile costs guard
failures, never correctness.

**Code flush** (`uop_flush`). Variants die with their program. The head
re-profiles from tier 1 next time, which is cheap compared to correctness
risk.

## 4. Exactness

### 4.1 The clock: charge the block ends the body would have executed

Fold-bench D made a native helper exact under `--branch-clock`:
- every native path charges the branch ends its body would have executed;
- a partial path charges up to its resume point;
- a path the budget cannot pay for falls back to the body's first instruction.

The general form for an optimised program:

- **Segments.** A *segment* is a maximal run of the optimised program with
  no runtime branch and no exit. Branches folded by C1, back edges removed by
  C2, and inlined CALL/RET/JMP all live *inside* segments.
- **Charge per segment.** The charge `C(s)` is the number of block ends the
  threaded execution of the same x86 path would charge:
  - every executed x86 Jcc/JMP/CALL/RET and every resolved loop trip;
  - under the historical clock, also every cut the tier's per-instruction
    block-end model (`$uc_block_ends`) places on that path.

  `C(s)` is a compile-time constant. Folding removes *work*, never *charge*.
- **Emission.** One `CHK n` at segment entry, then one `BUDGET n`. A runtime
  branch that remains still charges itself as today.
- **Running out mid-segment.** If the budget left is below `n`, the CHK stub
  exits to the **segment's entry instruction** in the state the threaded code
  would have there, and threaded code runs the segment. It stops at the exact
  transfer where the budget runs out.
  - This is D's "a path the budget cannot pay for falls back", generalised.
  - It is exact by construction, because a segment entry is always a precise
    x86 instruction boundary with a materialisable state (§4.2).
  - It costs at most one deopt per batch.
- **Per-budget exactness test.** For every unit-test program, run batches cut
  at every budget `1 .. blocks + 1`. Registers, flags, memory hash and EIP
  must be identical to threaded code. That is `test-fold-arms.js`'s check,
  promoted to a property of the optimiser.
- **Which clock.** A pass computes `C(s)` from the same block-end model the
  tier uses today, so it is exact under whichever clock the tier is exact
  under. Wherever today's tier restricts a feature to `--branch-clock` (trace
  cut exits), the new passes inherit the restriction.

### 4.2 Precise side-exit state

**Registers.** The core invariant: **the optimiser removes computation, never
a guest-visible write.**
- Vregs 0–7 are the guest registers, so every guest register write still
  lands.
- A constant-folded write becomes `MOVI r, k`.
- An unrolled induction variable is written with its per-iteration constant
  before any exit of that iteration.
- So every stub sees architected registers without reconstruction. A future
  write-sinking pass would need a per-stub materialisation list. The existing
  demand-snapshot machinery is the model for one.

**Flags.**
- A folded compare whose flags are live at an exit gets its record
  materialised in the stub from pooled constants. The REC operands are
  vregs, and constants are pool vregs already.
- Folded `sahf`: the stub materialises what `sahf` writes (SF, ZF, AF, PF,
  CF from AH) on top of the lazy state, as the threaded `$th_sahf` does.

**Stack.**
- Push/pop pairs elided by R2's slot facts spill at every exit they span.
  `$uc_spill_at` already does this for `--aggressive-stack`.
- An inlined CALL still writes its return address to the guest stack, unless
  an elided pair spills it at exits.
- An inlined RET checks the popped address against its context's return
  address, and deopts on any other.

**Memory.**
- M1 removes loads, never stores.
- No dead-store elimination of guest memory is in scope, except stack
  push/pop pairs.

**Faults.**
- A folded read-only load cannot fault: its page was mapped at compile time,
  and an unmap kills the program (§3.4).
- Each remaining memory access keeps its own deopt stub. That includes each
  unrolled copy, whose stub writes its iteration's constants first.
- `#DE`, window misses and ICG mismatches work as today.

**Locks.** V1 lowers `lock inc/dec/add/xadd/cmpxchg [m]` and `xchg [m],r` to
plain read-modify-write.
- This is exactly what threaded code does when `$LOCK_MODE == 0`: the
  cooperative scheduler interleaves instances only at slice boundaries, so the
  ordinary handlers run (05-alu.wat, handler 499 comment).
- The program records the `$LOCK_MODE` it was compiled under, and the enter
  op compares it, a single global load.
- Under `$LOCK_MODE == 1` (Worker threads), V1 declines in phase 1. Phase 2
  is a CAS op over the aligned qword, the same as handler 499, with
  split-lock fallback to the service path.

### 4.3 Self-modifying code and threads

**Self-modifying code.**
- A compound program's ranges cover:
  - every x86 byte of every context, including all inlined callee bodies and
    each unrolled copy's source bytes;
  - every folded read-only dword.
- A write to any of them kills all variants together.
- A region that stores to a constant address inside its own bytes is refused
  at build time, as toyvm's `patchesItself` refuses it.

**Threads.**
- Arenas, compiled programs and VPROF sketches are per instance. The compile
  scratch is shared under the existing try-lock.
- Cross-instance invalidation of folded data follows the same path as code
  writes today: the shared code-page bitmap, plus the writer's
  `$uop_code_write`.
- **Open item to verify before stage 5:** check that a Worker's store into a
  folded page kills another instance's programs, not only its own. If it does
  not, F2 is restricted to `$LOCK_MODE == 0` until it does. The §3 gap in
  `docs/uop-tier-design.md` (another instance modifying code *during* a run)
  applies to folded data too, and is documented the same way.
- **Answer (as built, §10): no.** `$uop_code_write` walks only the writing
  instance's range table. Every guest thread is its own instance, Worker or
  cooperative, each with its own arena and ranges. The shared code-page
  bitmap only makes the writer *look*; it never reaches another instance's
  programs. F2 is therefore restricted to a single instance and to
  `$LOCK_MODE == 0`:
  - `init_thread` sets the shared word `$UOP_MULTI_INST` with an atomic
    store the first time a second instance starts;
  - `$uc_fold_ok` folds nothing once it is set;
  - a folded program's header stamp bit 4 makes every entry re-check the
    word, so a program folded before the second thread started is dropped
    (`stampfail`, flush) at its next entry.

**Determinism.** Every compile decision depends on entry counts and guest
bytes, never on wall time, so headless runs stay deterministic per arm. They
are not identical across arms (§5.3).

## 5. Measurement plan

### 5.1 Arms: cumulative, leave-one-out, oracle, null

- **One build for all arms.** Every pass is a bit in one flag,
  `--uop-opt=MASK`, inherited by workers. All arms run **one wasm module**
  (one SHA-256), so build variance cannot enter. `MASK=0` must emit
  byte-identical programs to today's tier. The gate is a program-hash
  equality test over the `test-uop-compiler.js` corpus and the Spelunky
  census heads.
- **Cumulative arms.** The arms follow dependency order:
  - S0 = today;
  - S1 = +V1..V4+R1;
  - S2 = +R2+R3;
  - S3 = +F1+F2;
  - S4 = +C1;
  - S5 = +C2;
  - S6 = +S1 (specialisation);
  - S7 = +M1+C3;
  - S8 = +V5;
  - S9 = +E1.
- **Leave-one-out from the full stack.** For each pass P, run full − P.
  There are two variants, and both are reported:
  - **pure LOO:** dependents still run on weaker input, which is the number
    the user asked for;
  - **closure LOO:** P and everything that needs it are off, which shows how
    much P is an enabler.
- **Oracle and null.** D (fold-bench's known-routine arm) runs alone and on
  top of the full stack, which measures overlap. Two control arms give the
  null band.
- **Smoke screen.** Single-pass arms are run only as a smoke screen. Their
  numbers are not verdicts, which is the trap this plan exists to avoid.

### 5.2 Ledger, not uop counts

Fewer uops is not a time proxy:
- toyvm: −18 % µops, run time flat;
- CMP+Jcc: one dispatch less per site, neutral;
- page compile: 30 M lookups less, dead even.

A pass is credited for what it deletes from the work that does cost time:
- dynamic **memory loads and stores** executed by the program;
- **enters + exits**, at ~49 ns per enter on Spelunky;
- **service calls**, meaning `$uop_run` handbacks: x87/SSE/MMX service and
  window misses;
- **charged branches** that remain as runtime ops.

The ledger comes from a **counting run** with `--uop-census` plus the new
per-program engine counters, which are compiled in but off by default. It is
never taken from the timed run. Each arm's ledger delta must be monotone in
the cumulative sequence. A pass that deletes nothing in its stacked position
is not timed further.

### 5.3 Box protocol

- **One disposable ascii.dev box per sweep, created by the main session.**
  Subagent box creation is denied (`reference_ascii_bench_box`).
  - Clone from the public remote; do not upload the tree.
  - rsync only gitignored assets: Spelunky, `test/binaries/dlls` for HD, and
    StarCraft's assets.
  - Delete the box with `X-Ascii-Confirm-Delete` at the end.
- **Fixed work.** `--branch-clock` in every arm, and fixed batch windows:
  - Spelunky Classic 29600:32600 (band 0.2 %) and 21000:29000 (band 3.9 %),
    `--d3d9-gps=null`, route from fold-bench `scripts/fold-sweep.sh`;
  - Spelunky HD 213550:237550 (band 1.5 %);
  - Heroes II 1000:1800 (band 0.7 %);
  - StarCraft fast route in-mission.
- **Rounds.** Five alternating rounds, arm order rotated per round. The
  statistic is median user CPU over the window (`--cpu-window`). The null
  band is |ctl − null| on the same box.
- **Exactness per arm.** API call count, batches and presents must be
  identical to control. Frames must be md5-identical within the box, from a
  separate frames pass with the software executor, as fold-bench did. A
  mismatch voids the arm. Frames are not compared across machines.
- **Decision rule.** A pass ships default-on only if:
  - its closure-LOO from the full stack is outside the null band on at least
    one workload;
  - no workload regresses outside its band, and Heroes II is the control.

### 5.4 Native disassembly (CLAUDE.md requirement)

For every stage that adds or changes engine ops (VPROF, the guard chain, V1's
RMW arms, V2's x87 compare-branch, V5's SSE arms, KCALL, E1's local-slot
variants), and for `$uop_fast` after each stage:

- Capture `tools/wasm-native.js --engine=v8` and `--engine=sm` on:
  - the laptop (arm64);
  - the box (x86_64, `OBJDUMP=/usr/bin/objdump`).
- Compare against the same capture of the control module, using the same
  function indices from the named wasm.
- Check:
  - `$pc` and `$budget` stay in registers, with zero stack references in the
    loop (§8 of the tier doc);
  - no new spills;
  - per-op instruction counts for the new arms;
  - no `call` added to `$uop_fast`. Two calling arms were enough to make Ion
    spill `$pc` in toyvm E1.
- Record module hashes, engine versions and tiers. Fold-bench noted d8 15.4
  and 16.0 against node's V8 13.6. That is a version mismatch, and it must be
  reported explicitly, not silently mixed.
- Disassembly shows structure. Time attribution comes from `--cpu-prof`
  buckets.

## 6. Staged implementation plan

Every stage lands behind its `--uop-opt` bits, default off. Each has unit
tests in `test/test-uop-opt.js`, a generalisation of `test-fold-arms.js`: a
differential against threaded code, plus a per-budget exactness sweep.

| Stage | Content | Reuse | Exit criteria |
|---|---|---|---|
| **0 Hygiene** | Fix verdict-map aliasing. Add the `--uop-opt` mask and the per-program ledger counters (census-only). | — | Spelunky repeat compiles 68 % → < 15 %; `MASK=0` program hashes identical; ledger printed by `tools/uop-census.js` |
| **1 Vocabulary + R1** | V1 (LOCK_MODE 0), V2 (`sahf`, fused `fnstsw/sahf/jcc`), V3 (`fs:` base constant per instance), V4 (`rep ret`), R1 | **A verbatim:** `rep ret` decode; RET-without-candidate exit as GOTO to the deopt stub with the bd4c09da0 clock fix | Declines in the Spelunky census: `ret`/`xchg`/`lock`/`sahf`/`fs:` rows → ~0; API/frames identical; box numbers recorded, not gated |
| **2 Contexts (R2) + R3** | Records keyed `(address, context)`; peeling re-expressed as a context; inline clone budget; stack-slot facts (promote `$uc_sp_block`'s analysis); seam elision decided at compile time (entry guard on `dao_status/pending_armed`) | **B's** runtime seam step stays as the fallback path | `_CopyRecord` and `_FinalizeRecord` compile as one program each, callees cloned; enters per x86 insn ↓ ≥ 30 % vs S1; per-budget exactness on all cases |
| **3 Lattice F1 + RO fold F2** | Forward dataflow over contexts, with an element per reg/slot of ⊥, const k, `entry(x)+k`, ⊤; F2 on any lattice-constant address | **C's** `$uc_ro_addr` section walk and range-registration rule; the fold table grows from 4 globals to a scratch array, ranges coalesced | Folded loads per program on the Spelunky helpers match the hand trace in §2.2 (5 in `_CopyRecord` per field); unmap/protect kill tests |
| **4 Branch fold C1 + re-formation** | Resolve Jcc / jump-table index; prune; re-form (≤ 3 rounds); segment charges | **D's** branch-count tables, as the oracle for `C(s)` | Kind ladders folded; per-budget exactness; compile µs per head within 2× of S0 |
| **5 Unroll C2** | Full unroll of trip ≤ 8 with body ≤ 64 insns; each iteration a context | — | `_CopyRecord(RValue)` residue = §2.2's list; Move(16)/Move(4) fixed copies |
| **6 Specialisation S1** | Wish list, VPROF, compound program, guard chain, megamorphic marking, invalidation | `--count-census` as the cross-check for VPROF sketches | ≥ 90 % of `_CopyRecord`/`_FinalizeRecord` entries take a variant; guard-failure share reported |
| **— Sweep 1** | Box: cumulative S0..S6, LOO, D oracle, null | fold-bench `scripts/` harness | §8 predictions P-1..P-6 confirmed or refuted |
| **7 Memory M1 + C3** | STLF / redundant loads by value number; `sdisj`-style window-disjointness guard; dead flags/snapshots over the folded program | — | Ledger loads ↓; frames identical |
| **8 SSE native V5** | Native arms for the hot scalar forms (`movss` rm/mr, `cvtss2sd`, `cvtps2pd`, `cvtsi2ss`, `comisd` → branch, add/sub/mul sd) over the XMM file in memory, service path as fallback (like x87 91–107) | uop-sse's SSER/SSEM as the fallback | Spelunky HD service calls ↓ ≥ 80 %; bit-exact against 06c on the uop-sse equivalence tests |
| **9 Residency E1** | Only if stage-8 disassembly shows vreg load/store dominating `$uop_fast`; a fixed build-time set of local-slot op variants (toyvm's corpus-union idea), full-width only (no narrow store into a 32-bit-read slot) | toyvm `allRP` model | Native: fewer memory ops per register uop with no spill; box: outside band, or drop it |
| **10 Known-routine integration** | KCALL op and summaries (§7) | D as the first client | Full stack + D ≥ max(full stack, D) |
| **— Sweep 2** | Full cumulative + LOO across all four workloads | | Default-on decision per pass |

## 7. Boundary with the known-routine (FLIRT-style) framework

`docs/design/known-routine-framework.md` is being written by another agent
and is not on main yet, so this section proposes the interface rather than
quoting it.

**Division of labour.**
- **The known-routine framework:** routines identified by signature, whose
  behaviour is fixed by a library's contract and whose cost is dominated by
  data-dependent work. Examples: `System.Move` of unknown size, `_LStrCmp`,
  memcpy/memset/strlen, CRT math, FastMM.
  - Each gets a native WAT body with a declared clock charge function, as D
    has.
  - The pipeline cannot beat a native body on data-dependent loops.
- **The pipeline:** everything else, *and* library routines whose cost is
  interpreting constant arguments. The RTTI walkers are the overlap case.
  With the typeinfo constant, the pipeline derives D's residue generically
  (§2.2), and it does so for any Delphi version or Game Maker build, not only
  the signature-matched one. D needed a callee-bytes check because metrojd
  links a different Move under the same CopyRecord.

**The interface the pipeline needs, so that the two compose instead of
overlapping.** Fold-bench measured an overlap: D −16.2 %, D + A+B+C −17.2 %.
Part of the reason is that D's helper addresses are `$uc_unsup` to the tier,
so every program ends at them. The proposal:

1. **A claimed routine is an op, not an exit.** A call to a claimed entry
   lowers to `KCALL id` with these properties:
   - it is a service op, so the handback costs nothing on the fast path;
   - it charges the routine's declared clock function;
   - its summary is declared: registers read and clobbered, flags written,
     memory read and written (by argument), whether it may free, call out or
     fault.

   The region continues after it. That removes the region break D causes
   today.
2. **Pure summaries feed the lattice.** A known routine marked pure on
   read-only input (`strlen` of a read-only string, a CRC table lookup) may
   be folded by F1/F2 to a constant at compile time.
3. **Precedence at a call site.** When both could apply:
   - if C1/C2 can fold the routine's control flow with the context's
     constants, so that the inlined residue has no loop and no more than 16
     uops, the pipeline inlines it;
   - otherwise the claimed routine's KCALL is used.

   This is decided per call site, at compile time. Both outcomes are
   measurable, as arm "pipeline" against "D" against "both" (§5.1).
4. **Clock contract.** Both sides use §4.1's rule. A KCALL that cannot pay its
   charge falls back to the guest body's first instruction.

## 8. Risks and testable predictions

### 8.1 Predictions, including which earlier verdicts flip

The workloads are Spelunky Classic (SC1), Spelunky HD (SHD), Heroes II (H2)
and StarCraft (SC). Each prediction is checked by the §5 sweep. A miss
refutes the stated mechanism.

| # | Prediction | Earlier verdict | Flips? |
|---|---|---|---|
| P-1 | R1 (fold-bench A) is +0.4 % alone, but closure-LOO of R1 from the full stack loses **≥ 2/3** of the full stack's SC1 gain | A neutral | **Yes**: A is a prerequisite, not a lever |
| P-2 | RO folding: fold-bench C made 2,261 static folds and measured ≈ 0 (A+B+C − A+B = +1.1 %). With F1, folds on SC1's hot heads grow **≥ 10×**, and pure-LOO of F2 from the full stack costs **≥ 4 points** on SC1 | C neutral | **Yes** |
| P-3 | Seam elision (B) keeps its −3 % in the stack (it is independent). R2's cloning makes most seams compile-time-absent, so pure-LOO(R3) shrinks to **≤ 1.5 %** | B positive | No (shrinks) |
| P-4 | Entry cost. toyvm priced the round trip at ~1 %. In the main emulator `th_uop_enter` is 2.4 % of SC1 samples (87.8 M enters). After R2, enters per x86 insn fall **≥ 30 %** vs S1, and `th_uop_enter + uop_run` self time falls by **≥ 1.5 points** | uop entry "~1 %" | **Partly**: entry is a lever for call-chain code, through inlining, not chaining |
| P-5 | Full stack without D is **−10..−14 %** on SC1 29600:32600 (D alone −16.2 %). Full stack + D is −17..−19 %. Pure-LOO of D from (full + D) is **< 6 points**: the pipeline makes most of D redundant | D −16 %, A+B+C −2.4 % | **Yes** for A+B+C as a family |
| P-6 | Specialisation S1 is worth −1..−3 % on SC1 in the stack and ~0 alone. Its gain comes only from helper heads entered by threaded code; heads inlined into caller programs get their constants from contexts | (new) | — |
| P-7 | Load forwarding (M1) cuts executed loads by ≥ 15 % on SC1 programs, but its time effect alone stays inside the band (toyvm: loads −28..−42 %, time flat). In the stack its pure-LOO is ≤ 1.5 %, and any gain comes from facts it feeds F1, visible as fewer folds when M1 is off | toyvm load forwarding flat | **No** (stays small) |
| P-8 | CMP+Jcc fusion (threaded) and next-dispatch stay neutral or negative. They delete dispatches, not memory traffic, entries, service calls or charged work. This design does not resurrect them | neutral / negative | **No** |
| P-9 | Page compile stays dead even. The pipeline acts inside programs, not on lookups | dead even | **No** |
| P-10 | SSE: V5 native arms on top of `--uop-sse` give a further **−3..−6 %** on SHD gameplay. `uop_sse_svcs` falls ≥ 80 % | uop-sse −4.6 % (coverage only) | **Extends** |
| P-11 | Residency in locals (E1) at the end of the stack is −1..−3 % on SC1 and SHD, and has no effect on narrow-register code if full-width only | toyvm slots "not the lever" | **No** (small, as toyvm said) |
| P-12 | Heroes II stays inside its 0.7 % band in every arm, because it has no Delphi RTTI and no SSE. A regression above the band means compile cost, so check `uc` compile µs and repeat compiles | fold-bench: all arms in band | — (control) |
| P-13 | StarCraft gains −2..−5 % from S2 (R2+R3) and nothing measurable from S3..S6. Its untaken entries are call/ret chains (Storm), not constant interpretation | (new) | — |

### 8.2 Risks

1. **Compile cost.** Spelunky already compiles 5,308 times in the window, 68 %
   of them repeats. Every pass multiplies that. Stage 0's aliasing fix is a
   hard prerequisite. Compile µs per head is a gate in stages 4–6.
2. **Program size and region caps.** Cloning and unrolling grow programs.
   Decline 24 (program too big), `UC_MAX_LOOP`, `UC_MAX_STUBS` 2048 and
   `UOP_RANGES_MAX` will bind before the lattice does. Coalesced ranges and
   the re-formation budget address the last two.
3. **Arena churn.** Compound programs are bigger, so there are more
   `uop_flush` calls. `flushes: 32` in the Spelunky window today. Watch it in
   the ledger.
4. **The fixed engine's native shape.** Every new op is an arm in
   `$uop_fast`. One call in the wrong arm makes Ion spill `$pc` for the whole
   loop (toyvm E1, `callSafe`). That is why the disassembly check runs on
   every stage, not at the end.
5. **Cross-instance invalidation of folded data** (§4.3, open item). If a
   Worker store does not kill another instance's program, F2 must stay
   `$LOCK_MODE == 0` only.
6. **Clock divergence that looks like a semantic bug.** A frame diff between
   arms is a clock question first (`project_x87_fusion_mcm`,
   `region_jit_payoff`). Use the per-budget exactness test and the API-count
   identity before chasing semantics.
7. **The pipeline is tuned to one app.** Delphi RTTI is Spelunky Classic's
   third. SHD, StarCraft and Heroes II are in every sweep to catch that. The
   decision rule requires that no workload regress.
8. **V1 under Worker threads.** Plain read-modify-write is exact only while
   `$LOCK_MODE == 0`. The compile-time stamp plus the enter-op check is the
   guard. A program with lock ops must never run when the mode has changed.

## 9. Evidence index

In `scratch/runs/20261125-optimizer-pipeline-design/`:

- `static/rtti-helpers.asm`, `static/rtti-helper-cases.asm`,
  `static/lstr-move.asm`, `static/copyrecord-callsites.asm`: disassembly of
  the Delphi helpers, their call sites, `_LStrAsg`, `_LStrClr` and
  `System.Move`. Made with `tools/disasm_fn.js` on
  `test/binaries/candidates/spelunky-classic/extracted/Spelunky.exe`, whose
  SHA-256 is in `static/spelunky-exe.sha256`.
- `static/typeinfo-bytes.txt`, `static/sections.txt`: the RValue/RToken
  TypeInfo records, the string TypeInfo, Move's jump table and the section
  map (`tools/dump_va.js`, `tools/pe-sections.js`).
- `scripts/arg-profile.js` and `arg-profile.txt`: argument concentration
  from fold-bench's passive count census.
- `predictions.json`: §8's predictions in machine-readable form, for the
  sweep to score.

The numbers cited from other runs are the fold-bench summary
(`20261125-fold-arms-bench/box/slim/summary.txt`), the Spelunky uop census,
attribution and cpuprofile buckets
(`20261125-spelunky-classic-gameplay-profile/headless/run-b`, `run-c`), and
the SSE census and A/B (`20261125-uop-sse/census`, `remote/`).

## 10. As built: branch `uop-opt` (2026-11-25)

Stages 0–4 landed as one change behind `--uop-opt=MASK` (browser
`?uop-opt=MASK`), default 0, inherited by every Worker and cooperative
instance through `set_uop_opt`. Stages 5–8 and the stage-1/4 parts listed
under "Cut" were not built. No threaded handler was added: everything lives
in `src/07d-uop-engine.wat` and `src/07e-uop-compiler.wat`, plus two kill
hooks (`$guest_page_clear_range` in 03, VirtualProtect in 09a0b) and the
`init_thread` multi-instance word in 13. Run evidence:
`scratch/runs/20261125-uop-opt/`.

### 10.1 Bits

| Bit | Pass | What it does as built |
|---|---|---|
| `0x001` | stage 0 decline table | Fixes the verdict-map aliasing: a declined head is recorded in a direct-mapped table keyed by the full address (`$uop_decl_slot`), so a colliding head no longer re-compiles a decline. Cleared by `mark_dead` / `flush_all`. |
| `0x002` | R1 + V4 | `rep ret` decodes as `ret`. A RET with no candidate target exits the program as a charged GOTO to the deopt stub. **Branch clock only** (`$uc_retx_on`, header stamp 8): see §10.3. |
| `0x004` | R3 seam elision | A runtime decision, not the compile-time entry guard of §6: the seam ops (79/80/87) are skipped in `$uop_fast` when `dao_status \| pending_armed` is 0. |
| `0x008` | V1 | `LOCK` ALU/INC/DEC/NOT/NEG and memory `XCHG` lower as the plain RMW while `$LOCK_MODE` is 0. A guard leaves any address ≥ `0x80000000` (the shared heap, whose CAS the host serialises) to threaded code before it reads. Stamp 1 drops the program if `LOCK_MODE` changes. |
| `0x010` | V2 (`sahf` only) | `sahf` compiles as the SSER service op (op 108, calling threaded handler 212), so it no longer declines the region. It is still a handback, not a native op. |
| `0x020` | V3 | `fs:` integer forms fold `fs_base` into the displacement, recorded at header +40. Stamp 2 drops the program when the instance's `fs_base` differs. No ESP-based operand, LEA or string op. |
| `0x040` | F1 | Forward constant lattice over the region (`$uc_lat_xfer`): ⊥ / const / ⊤ per register, joined at merge points. |
| `0x080` | F2 | A load from a lattice-constant address in a non-writable image section folds to its value. Adjacent folded dwords are coalesced into SMC ranges (`$uc_fold_ranges` → `$uop_add_range`, which also code-marks the page). Stamp 4 re-checks the single-instance word (§4.3). A page that ever took a guest store is recorded in `$UOP_FOLD_WRITTEN` (64 entries, process-wide) and is never folded again. |
| `0x100` | C1 | A Jcc whose flags the lattice resolves becomes an unconditional edge, and the dead arm is pruned. The clock is charged per pruned segment, so the batch stop is unchanged. Needs `0x040`. |

Header stamp (+36) bits: 1 = `LOCK_MODE` 0, 2 = `fs_base` (+40), 4 = single
instance, 8 = branch clock. They are checked by `$uop_hdr_bad` in
`$th_uop_enter` only when the stamp is non-zero. A failure counts
`stampfail`, flushes, and continues in threaded code.

### 10.2 Cut, and why

- **R2 contexts / inlining.** The `(address, context)` record key is the
  prerequisite of C2 (an unrolled iteration is a context), S1 (a variant is a
  context) and the compound-program form that M1/C3 work over. It is a
  rewrite of the record and range model, not one more pass, and it did not
  fit in this change alongside a provably identical mask 0. Cutting it cuts
  **C2, S1, M1 and C3** with it.
- **C1 re-formation rounds.** C1 folds and prunes once. Re-forming the region
  after pruning needs R2's context records to be worth anything.
- **The fused `fnstsw/sahf/jcc` → f64 compare-branch.** Only the `sahf`
  decline was removed. The WAT microbench (`docs/design/wat-representation-bench.md`)
  measures the fusion at 2–3× everywhere, so it is the next V2 step.
- **V5 SSE native ops.** These overlap the landed `--uop-sse` / `--sse-fast`
  arms (796e017da). The microbench says the representation matters more
  than the op list: `$xmm_addr` calls are the worst form measured, inline
  const-offset `v128.load` is 9×, and ss/sd lane-0 loads are 5×. V5 should
  be built on that, as its own change.
- **E1, KCALL:** out of scope (stages 9–10).

### 10.3 Exactness, as measured

- **The branch clock is the exactness clock.** Under `--branch-clock` the
  tier off (`--no-uop`), mask 0 and every arm give identical API histograms,
  present lines and end frames.
- **The block clock is not tier-exact on main.** Its cuts follow threaded
  decode history, so any change in what compiles moves the batch stop.
  - metrojd_gm7, 70000 batches: `--no-uop` 1148493 API calls, mask 0
    1133243, main's own `--uop-icall` 1130214.
  - heroes2_demo, 2400 batches: `--no-uop` 1348459, mask 0 1077776.
  - So block-clock runs of a coverage-changing arm (`0x008`, `0x010`) differ
    from mask 0 exactly as main's widenings do: same presents count, a
    different amount of work drawn in the window. That is not a pass bug.
  - It is why §5.3 already fixes `--branch-clock` for every timed arm.
- **The RET exit made the block clock worse than that.** A mid-block deopt
  at a RET creates a threaded block head that tier-off code never makes, and
  four suite cases changed their batch stop under the block clock. R1 is
  therefore gated on the branch clock (stamp 8 drops such a program if the
  clock changes). A block-clock-exact R1 would need dynamic-target budget
  stubs.
- **Unit level:** `test/test-uop-opt.js` runs every arm over the
  `test-uop-compiler.js` corpus under both clocks. Each 37-block batch stop,
  register, flag and byte must match threaded code. That covers clock
  charging at budget cuts, C1's segment charges, and the flags each cut
  materialises. On top of that, seven invalidation checks:
  - `.data` is not folded;
  - VirtualProtect kills;
  - page release kills;
  - a guest store kills, and the page is never refolded;
  - a `LOCK_MODE` flip drops the program;
  - an `fs_base` change drops it;
  - a second instance drops it.
- **Mask 0 is main:** `test/test-uop-opt-identity.js` hashes the program
  arena over the whole corpus. Unset equals `set_uop_opt(0)`, and both equal
  control builds of 5ac21c5f8 and of main 28b658ece, which has D.

### 10.4 Notes for the sweep

- **R1 can lower coverage.** test-uop-compiler's trace-callee case: 256
  enters over 360 blocks, against 2736 over 10204. The ledger's enters and
  charged blocks show it per app.
- **A once-folded page stays code-marked.** A store to it exits every
  program entry that reaches it. F2 only folds non-writable sections, so
  this needs a VirtualProtect'd section.
- **`sahf` is a service op,** so `service-calls` rises with `0x010`. Fusing it
  is §10.2's next step.
- The `service-calls` counter runs at mask 0 too: it is the tier's own
  handback count.
- **F2 folds nothing on Spelunky Classic** (`folds=0` at `0x1ff`). The
  constant addresses §2.2 counts on are TypeInfo pointers *passed in* to
  `_CopyRecord` / `_FinalizeRecord`. Those become lattice constants only
  inside an inlined context (R2) or a specialised variant (S1), and both
  were cut. On their own, F1 and F2 are the plumbing for those passes. C1
  does fold on its own lattice: 706 Jcc sites at `0x140`.
- **R3 is the biggest single ledger delta on Spelunky Classic.** It skips
  309M seam ops and halves service calls, from 620.7M to 311.5M. The seam
  ops were handbacks.
- **Microbench guidance taken:** clock charged at exits and back edges only
  (C1 charges per segment at the exit), and LOCK as plain RMW (8–9× over
  CAS). Not yet taken: inline `$gl32`/`$g2w` fast paths in program ops, and
  dead-flag elimination (C3, cut).

### 10.5 App exactness matrix (`tools/uop-opt-exact.js`)

Each cell compares the run with mask-0 control on the same clock and the
same D setting. The comparison covers the whole API histogram
(`--trace-api-counts`), the present/GPS lines with wall-clock fields
stripped, and the end-frame PNG's SHA-256. Every run is serial, under 3
minutes, and headless GL held awake by `caffeinate -d -i`.

Routes:
- `spel`: Spelunky Classic, title room, 23500 batches.
- `spelhd`: Spelunky Classic HD rope route, 181000.
- `metro`: metrojd_gm7, Delphi 6-7 by `tools/delphi-detect.js`, first room,
  run and jump, 70000.
- `h2`: Heroes II demo, scenario and scroll, 2400.
- `sc`: StarCraft shareware, `--no-threads`, Terran base, 3500.

| Arms | Clock | D | spel | spelhd | metro | h2 | sc |
|---|---|---|---|---|---|---|---|
| each bit alone (0x1 … 0x80), 0x140, 0x1ff | branch | absent (pre-rebase) | identical | identical | identical | identical | identical |
| each bit alone, 0x140, 0x1ff | branch | `--no-delphi-fold` | 0x1ff identical | 0x1ff identical | identical | identical | identical |
| 0x1ff | branch | on (default) | identical | identical | identical | identical | identical |
| 0x1ff | block | off | differs (timing) | differs (timing) | differs (timing) | identical | identical |

Notes on the table:
- **Branch clock:** the control hashes are equal across D off, D on and the
  pre-D build:
  - spel 2245487 calls, frame 6a4436d8;
  - spelhd 2333089, 78cf8e1d;
  - metro 1213199, c8cbac72;
  - h2 1520029, 55aaf300;
  - sc 353869, c821b6c5.
  `--no-uop` gives the same on metro and h2.
- **Block clock, metro:** single bits `0x008` and `0x010` differ (§10.3).
  The other bits are identical.
- **Mid-route frames are compared too.** Under the branch clock the guest is further along at a
  given batch, and the Spelunky Classic end frame is a black fade. So the
  driver also captures `B:png` frames mid-route and compares their hashes:
  - spel at 15000/19000/21000/22500 (title, intro);
  - spelhd at 100000/140000/170000;
  - metro at 61000/63000/66000/69000.

  All of them are identical at `0x1ff` vs 0, with D off and with D on
  (`exact/frames-d-off`, `exact/frames-d-on`).
- **Two runs were rejected as invalid, not counted as divergences.** The
  laptop display slept in the middle of a sweep, so `--headless-gl` reported
  zero displays. The driver now holds the display awake and fails such a run
  as "GL unusable".

### 10.6 Ledger on Spelunky Classic (branch clock, D off, 23500 batches)

| Mask | enters | charged blocks | service calls | seams skipped | ret-exits | jcc-folded | lock | sahf | fs | decl-hits | folds |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 97.65M | 1704.9M | 620.7M | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 0x001 | 100.55M | 1700.1M | 616.7M | 0 | 0 | 0 | 0 | 0 | 0 | 248 | 0 |
| 0x002 | 91.57M | 1727.6M | 638.3M | 0 | 6858 | 0 | 0 | 0 | 0 | 0 | 0 |
| 0x004 | 97.65M | 1704.9M | 311.5M | 309.1M | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 0x008 | 101.73M | 1744.7M | 652.5M | 0 | 0 | 0 | 3652 | 0 | 0 | 0 | 0 |
| 0x010 | 98.25M | 1711.1M | 632.3M | 0 | 0 | 0 | 0 | 470 | 0 | 0 | 0 |
| 0x020 | 100.53M | 1708.4M | 624.7M | 0 | 0 | 0 | 0 | 0 | 1848 | 0 | 0 |
| 0x040 | = 0 | = 0 | = 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 0x080 | = 0 | = 0 | = 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 0x140 | 100.41M | 1698.9M | 615.7M | 0 | 0 | 706 | 0 | 0 | 0 | 0 | 0 |
| 0x1ff | 99.91M | 1744.8M | 334.8M | 325.0M | 7592 | 1114 | 4518 | 464 | 1964 | 326 | 0 |
| 0 + D on | 84.50M | 1647.7M | 584.0M | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 0x1ff + D on | 84.15M | 1657.1M | 289.8M | 302.6M | 3764 | 744 | 1405 | 506 | 1432 | 193 | 0 |

How to read it:
- **Charged blocks are the tier's coverage, not work.** More blocks inside
  programs means more x86 executed by the tier.
- **Enters go up when coverage widens.** Newly accepted regions add their
  own enters.
- **R1 (`0x002`) cuts enters by 6 %.** Programs that used to stop at a RET
  now continue through it.
- **R3 (`0x004`) cuts service calls by 50 %.** It is the one pass the ledger
  says is worth timing alone.
- **F1/F2 alone do nothing on this route** (§10.4).
- **With D on, R3 still removes 294M service calls.** D removes the helper
  bodies; it does not remove the seams.
- **Wall time on the laptop is not a measurement.** The box sweep times these
  arms.
