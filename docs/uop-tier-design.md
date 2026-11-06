# A toyvm-style micro-op tier for the main emulator

Status: design + phase-0 prototype, 2026-09-26. Off by default; nothing ships
from this document until phase 0 says the engine is worth building.

## 1. Why the block executor did not pay, measured in machine code

The H454/H458 block executor (`src/07c-block-exec.wat`, `--block-exec`) was
timed on the quiet box for the first time in September 2026:

| app | executor off → on | native share |
|---|---|---|
| Heroes III gameplay | 13.52 → 13.10 ms/batch (−3%), boot +9%, total user CPU +7% | 97.6% |
| MechWarrior 3 gameplay | 553.8 → 519.1 ms/batch (inside a ~9% null band) | 99.87% |
| MCM race | 2.345 → 2.462 s (+5%) | 95.6% |
| Diablo II to Act I load | 21.99 → 23.01 s (+4.6%) | — |

Coverage was not the problem: 95–99.9% of ops ran natively. So the question is
what each native op costs, and `tools/wasm-native.js --func='$th_block_exec'`
(SpiderMonkey Ion, arm64) answers it directly.

- **The per-op prefix is ~100–120 instructions and 3–4 indirect jumps before
  the kind `br_table` is even reached.** It covers:
  - the handler-hist test;
  - the six descriptor fields stored to frame slots;
  - three 15-arm register `br_table`s (d, `TU_B_SRC0`, a);
  - the lane/width/no-flags/EA decode;
  - the SIB range test.
- **The arm then does real work plus overhead.** Most arms *call*
  `$set_flags_*` (`mov sp` / `bl` / restore around each call), and a writeback
  `br_table` follows.
- **The "registers in wasm locals" are not in registers.** The function is 11 KB
  and 2789 instructions. Ion spilled `r0..r14` to stack slots
  (`ldr w16,[x20,#192..220]`), so every register read is a jump-table jump to a
  stack load.

A threaded handler is ~150 Ion instructions including its dispatch. The
executor removed that dispatch and paid the same amount back in its own
prefix. That is why it measured flat.

toyvm's E1 engine (`tools/toyvm/uop-wasm.js`) pays **11 instructions per
transition** on the same compiler. It has the same one-function `br_table`
shape, but:

- An operand is the vreg's byte address, so `V(k) = load(load(pc + 4k))`: two
  loads, no jump.
- No op makes a call.
- No op writes lazy-flag globals; the optimizer forwarded them.
- The function has a handful of locals, so nothing spills.

toyvm measured the full effect at ns per x86 instruction (V8/SM):

| engine | ns / x86 insn |
|---|---|
| L1 interpreter | 3.71 / 2.82 |
| E1 loop engine | 0.64 / 0.92 |
| straight wasm (not an engine, upper bound) | 0.23 / 0.20 |

**Engine shape and the optimizer passes are the lever, not op coverage.**
(Memories: `project_block_exec_native_cost`, `project_toyvm_uop_tier`.)

## 2. Constraints this design keeps

- **No runtime wasm codegen.** The engine is one fixed function compiled with
  the build. A program is data in linear memory, as with E1.
- **Exactness.** Every exit leaves the machine exactly as the threaded path
  would. That means:
  - guest registers;
  - the five lazy-flag globals, when live;
  - EIP;
  - memory, including SMC retirement.
- **Threads.** Every guest thread is its own wasm instance, and a program bakes
  its instance's `$reg_base`, temps and windows, so each instance has its own
  arena: the main thread uses `$UOP_ARENA`, worker `tid` uses slot `tid-1` of
  `$UOP_THREAD_ARENAS` (15 x 256 KB, paid for by shrinking each
  `$THREAD_CACHE_BASE` partition from 1 MB to 768 KB). `init_thread` points the
  instance at its slot with `$uop_set_arena`, which empties the map. The
  compiler's scratch `$UOP_CSCRATCH` stays shared and is taken with an atomic
  try-lock; a thread that finds it held skips the compile (answer 1, "busy")
  and retries at the head's next hot bump rather than marking it dead.
  `set_uop` and `set_branch_clock` are in `INHERITED_WASM_GLOBALS`, so both
  `--threads` workers and cooperative threads inherit the switch.
- **Fail-soft.** Anything the lowering does not model ends the program with an
  exit to the threaded interpreter at that instruction. That is never a crash
  and never an approximation.

## 3. The engine (E1 shape)

One function, `$uop_run(pc) -> exit code`: a `loop` over one `br_table` on
`i32.load(pc)`.

**Vregs live in memory.**
- **Vregs 0–7 are the guest registers themselves** (`$reg_base` + 4r). Entry
  and exit need no GETR/PUTR, and falling back to threaded code needs no spill.
  This is the main emulator's advantage over toyvm, whose guest registers are
  separate.
- Vregs 8+ are temporaries in a per-thread scratch page.
- An operand word is the vreg's absolute byte address, pre-scaled at lowering
  time, so reading or writing an operand is one load of the operand word plus
  one load or store of the vreg.

**Ops are a small RISC set, all 32-bit, each doing only its own work:**

| family | ops |
|---|---|
| move | `movi`, `mov` |
| ALU | `add sub and or xor` + immediate forms, `shli shri sari`, `mul`, `sx8 sx16 zx8 zx16`, `merge8l merge8h merge16`, `ext8h` |
| branch | compare-and-branch `bcc cc,a,b,w,target` (flag-forwarded cmp/test + jcc) and `bccf` (test one materialized flag bit) |
| memory | `ld{8,16,32}{s,u}` and `st{8,16,32}`, addressed as window-relative `base + (index << s) + disp` |
| guard | `guard w, base, lo, hi, rw, exit` |
| flags | `rec op,a,b,res,shift`: writes the five lazy globals; emitted only on exit paths where flags are live |
| control | `jmp`, `clock n, exit` (one per loop header), `exit eip` |

**Memory: the hoisted range guard (the user's rule).** Guest virtual mappings do
not change between iterations of a loop that makes no calls out of the program.
So translation is proved once per *window*, not once per access:

- **`guard` at the preheader** calls `$g2w_affine_span(lo, hi - lo)`. That
  function already proves a whole span shares one guest→wasm delta (direct
  window, DIB window, or a contiguous sparse run).
  - For a written window, `guard` also tests the code-page bitmap
    (`$code_write_is_code`) for each page in the span.
  - On success it stores `delta` and `[lo, hi)` in window slot `w`. On failure
    it takes `exit`, before any instruction has had an effect.
- **An access** computes the guest address `ga` and then does
  `if (ga - lo) >u (span - size) → slow; else load/store at ga + delta`.
  That is one subtract and one compare: no call, no bitmap, no page-cross test.
- **Choosing `[lo, hi)`.** When the lowering can bound the address range from
  induction variables and a trip count, the guard covers it exactly. When it
  cannot, the guard covers the page the stream *starts* in. The user's
  heuristic is that a fast start means the stream is almost always fast
  throughout.
- **The slow path** re-guards on the page of `ga`. It calls `$g2w_affine_span`
  on that page and refreshes slot `w`; if that fails too, it exits at the
  instruction. So a stream that walks off its first page costs one re-guard per
  page crossed, not per access.

What the window proves, and for how long:

- A window is valid only **within one `$uop_run` call**. Every entry
  re-establishes it, so a mapping change between batches is always seen.
- Nothing inside a program can change a mapping, because calls to APIs are
  exits.
- A decode of new code into a written window by *another* guest thread
  mid-slice is the one gap. x86 requires software serialization for
  cross-modifying code (SDM 8.1.3), so a program relying on it without a lock
  is already undefined there. This is documented rather than guarded.

**Flags.** The lowering starts naive, like toyvm: every flag producer is a
`rec`. Two passes then work on it:

- flag forwarding turns `cmp/test/sub/dec + jcc` into `bcc`;
- flag liveness over the loop deletes every `rec` whose flags die before an
  exit.

Surviving `rec`s sit on exit stubs, so the steady-state loop writes no flag
globals at all.

**Clock.** The threaded path charges `$steps` per block transfer. The program
keeps the same accounting exactly: `clock n` at each loop header subtracts the
iteration's block transfers, and exits with a precise EIP when the budget runs
out.

## 4. The lowering and the passes

Input is the region the H458 machinery already discovers, a loop nest of
decoded blocks. But the lowering reads the *x86 instruction*, not the handler
index, for the reason `tools/toyvm/uop-x86.js` gives: a handler index hides its
operands. The main emulator's decoder already decodes ModRM and SIB; the
lowering calls into that decode rather than copying it.

Passes are ported from `tools/toyvm/uop-opt.js`, first those that toyvm
measured as paying:

1. promote: guest regs stay in their vregs; temps coalesce.
2. constprop + addrfold: `[esi+4]` becomes one address expression.
3. forwardFlags + flagLiveness: `bcc`, dead `rec` removal.
4. guard hoisting: the per-access window checks above.
5. licm: loop-invariant loads (`[esp+0x40]`, a LUT base).
6. clock: one check per header.
7. dce.

Later, if the census says so: inlined call/ret (toyvm's call contexts), and
load forwarding (toyvm measured it as nearly free: `project_toyvm_uop_tier`).

**Where the optimizer runs: in WAT** (`src/07e-uop-compiler.wat`, since
2026-09-27). It started as `lib/uop-compiler.js` behind a synchronous host
import, which was the quickest route to a first measurement, and was ported so
browser workers and every host get it without an RPC and without a host call
per hot head. `$uop_try` (07d) calls `$uop_compile` directly; the compiler
decodes the guest bytes, forms the loop, lowers it and writes the encoded
program into `$UOP_ARENA`. That is data, not code, so the no-codegen rule
holds. Its working memory is the `$UOP_CSCRATCH` region; nothing in it
outlives one compile.

The port was checked word for word against the JS reference before the JS was
deleted: every instruction address of every `test-uop-compiler.js` case under
both clocks, and every head MW3, MCM, D2 and Heroes III compiled on their
benchmark routes, produced identical programs (or the same decline reason).

Exports: `uop_compile(eip)` (what `$uop_try` calls; answers the program, 1
when another thread holds the scratch, or 0), `uop_cstat(k)` (compiled,
declined, instructions, uops, flushes, words), `uop_decline_count(reason)`.

## 5. Phases and the numbers that gate them

**Phase 0: price the engine, not the compiler.** Add the `$uop_run` engine plus
a `bench-loops.js` arm that runs a hand-lowered program for existing shapes
(`lut`, `blk_mix512`, and a Heroes III RLE-run shape) next to the threaded and
block-executor arms, in one process with alternating reps. Hand-lowered means
written the way the optimizer is expected to emit it, so phase 0 is toyvm's
"what is the engine worth on this loop" before any compiler work.
- **Gate:** the uop arm is at least 2x faster than threaded per x86
  instruction on the non-periodic shape (`blk_mix512`).
- **Also:** `wasm-native.js` shows ≤ 20 instructions per transition for a
  register op, with no spills.

**Phase 1: JS lowering + passes on real regions (CLI).** Install on the loops
H458 would install on, and compare final state against threaded code.
- **Correctness gate:** equal registers, flags and memory hash on every
  installed program across the `block-exec-sweep.js` app list.
- **Speed gate:** box A/B with user CPU plus `--slice-split` on Heroes III, MW3,
  MCM and D2, with interleaved reps and a null band.

**Phase 2: move the lowering into WAT; browser and worker coverage.**

**Phase 3: calls.** Inline short leaf calls, so regions stop ending at every
`call`. The H458 census shows `shortChain` and `unsafeOp` as the biggest
decline rows, and MW3's regions are almost all one block because of calls.

## 6. What phase 0 does NOT prove

- A periodic microbench loop predicts every branch. `blk_mix512` exists to
  remove that bias, but the real apps' hot code (Heroes III RLE runs,
  `COMPLEX`/`DIAMOND` classes) is branchier than any synthetic shape.
- The lowering and passes have to reach the hand-lowered program's quality on
  real code. That is phase 1's question, and toyvm's coverage census says it
  is usually the harder one: 117/191 programs never installed.

## 7. Phase 0 results (2026-09-26)

**Engine code (Ion, arm64, `tools/wasm-native.js --func='$uop_run'`).**
`$uop_run` is 2992 bytes of Ion code, against 11 KB for `$th_block_exec`.
- Dispatch costs about 11 instructions: interrupt check, op load, bounds check,
  table load, `br`.
- A register ADD arm is 13 more instructions, including a `pc` spill to the
  frame.
- So a register op costs **~24 instructions and one indirect jump**, against
  ~110 for 07c's prefix alone before its arm even starts.

**Timing** (`node tools/uop-engine-bench.js --bytes=4m --reps=7`, laptop at
load ~5.5, V8). Every rep of every arm had identical registers, CF/ZF/SF/OF,
EIP and destination hash; no guard failed.

| shape | threaded ns/insn | block-exec | uop ns/insn | uop vs threaded |
|---|---|---|---|---|
| `lut` (byte LUT blit) | 12.50 | x0.96 | 3.28 | **x3.81** |
| `ckey` (colour-key diamond) | 12.71 | x0.93 | 3.60 | **x3.53** |
| `h3shadow` (Heroes III `0x471da6`, 16-bit) | 11.97 | x0.96 | 3.19 | **x3.75** |

How to read it:
- **Block-exec is x0.93–0.96 on the same code.** That matches the whole-app
  timings in section 1 and the native-code explanation of them.
- **The uop engine is ~3.7x.** That is in line with toyvm's E1 against its L1,
  as the shape argument predicts.
- **The `folds` arm matched threaded** (not in the table): LUT_RUN did not fire
  on this encoding, so it is not a fold-vs-engine comparison.
- **Re-guards fired once per 4 KB page per stream,** because the windows were
  guarded at their start byte only (the user's "fast start → fast whole" rule),
  and cost nothing measurable.

**Not yet shown:**
- A non-periodic block working set (`blk_mix512`-style).
- Deopt stubs that restore exact flags (here they only exit and never fire).
- Any real lowering. The programs are hand-written at the quality section 4's
  passes must reach: forwarded `cmp/test/dec+jcc`, flags materialized only on
  the exit path, one CLOCK per iteration.

Phase 1 is the question now.

## 8. Games, and the call-free engine (2026-09-27)

**Games** (`node tools/uop-game-ab.js`, each game's own gameplay route, both
arms `--branch-clock`, laptop at load ~2-4). Frames first: every game's final
frame matches off vs uop, or differs by no more than off vs off.

| game | frames | whole-run user CPU | gameplay phase |
|---|---|---|---|
| Heroes III | identical | -7.7% | **-41%** |
| Diablo (shareware) | identical | -6.2% | **-34%** |
| StarCraft | 1.48%, null band 1.43-1.51% | ~-5.5% | -- |
| Warcraft III (menu, software GL) | identical | -3.4% | flat (GL-bound) |
| Warcraft III **gameplay** (`wc3g`, headless GL) | identical | -8.8% | **-20%** (4.4 -> 3.5s); map load -7% |
| Warcraft III gameplay, software GL | identical | -5.7 to -7.5% | 0% and +13% in two concurrent pairs (noise; GL-bound) |
| Heroes II, Diablo demo menu | identical | flat | flat |
| Diablo II | nondeterministic off vs off too | -3.5% | -- |

**The call-free split.** With any call inside the dispatch loop, Ion kept
`$pc` and `$budget` in stack slots: 110 `[x20,#28]` references in the old
`$uop_run`, a store after every op and a reload on the pc chain every op
depends on. The loop called `$uop_reguard` from 16 memory ops plus
`$uop_window_set`, `$get_cf` (x2) and `$eval_cc`. Now `$uop_fast` makes no
call at all and hands any op that needs one back to `$uop_run` (a window
miss, GUARD, SAVECF, GETCF, BCC). A missed op is re-run from scratch after
the re-guard; nothing in it changed before its window check. Result: pc lives
in `w0` with **zero** stack references in the loop, and a register MOV is 7
instructions plus an 8-instruction dispatch.

What it bought is small, and the reason is the finding:
- Microbench: h3shadow -6%, lut -3%, ckey +1%.
- Heroes III, Diablo and StarCraft gameplay: flat against the pre-split
  engine (`--ref-wasm=`), with identical frames.
- A `--cpu-prof` of the Heroes III uop arm shows why. `$uop_fast` is 6.8% of
  self time. The whole enter/re-guard path (`$th_uop_enter`, with
  `$uop_run`/`$uop_reguard`/`$uop_window_set` inlined into it) is 0.6%.
  `$g2w_affine_span` is 0.0%. The x87 handlers (`$th_fpu_mem_ro`,
  `$fpu_exec_mem`, `$th_fpu_reg`, `$fpu_exec_reg`) are ~18%.

So windows that survive across entries (an epoch bumped on every mapping
change and code-page mark, shared across Worker instances) would buy under 1%
of Heroes III. That is not worth a stale-window SMC hole. The remaining lever
is **coverage**: the declines are `no-backedge` and `head-unsupported`, and
Heroes III's hot threaded time is FPU code the tier does not lower.

(Section 9 built those windows anyway. The epoch closes the stale-window hole
within a thread. Building them also found a real SMC hole in store windows.)

**Where that FPU time is, measured (2026-09-28).** It is not on the thread the
tier works on. `--handler-hist` per guest thread over gameplay batches
4100-4300 (`--handler-hist-thread=1,3,2`; the main thread over 4100-5101):

| thread | x87 dispatches | share of that thread's dispatches |
|---|---|---|
| T0 (game) | 585 of 1.19G | 0.00% |
| T1 (start `0x8414a0`) | 66.6M of 141M | **47%** |
| T2, T3 | 0 | 0% |

So the ~18% x87 CPU in the profile is all T1, and "x87 in uops" would be
aimed at the wrong thread. The existing semantic x87 folds (`--x87-fusion`:
pipeline4, island, affine) already reach it. On T1 they cut unfused x87
dispatches from 66.6M to 14.1M (plus 4.2M fused: H449 pipeline4 3.08M and
H451 1.13M). That is **79% of x87 dispatches absorbed**, and T1's total
dispatches fall from 141M to 93M. With `--uop` as well, T1 reads 15.3M raw
and 4.6M fused, so the fold and the tier compose: the tier is on T0, the fold
on T1. The remainder is mostly `$th_fpu_mem_ro` (8.4M).

The fold is **off** for Heroes III: `x87Fusion: true` is set only for
`ut2003_demo` in `lib/apps.js`. Fewer dispatches is not a time win by itself
(on MCM the fold was flat until the x87 file moved to memory; see
`project_x87_fusion_mcm`), so the time A/B is the `fold` / `uopfold` arms of
`tools/uop-game-ab.js`.

**Bench box, 2026-09-28** (x86_64 V8, node 20, Ryzen 9 9950X, 4 vCPU, idle,
serial arms, HEAD 84e79bb4). `gameplay` is the `--slice-split` main-thread
guest slice, so guest-thread (T1) work shows only in user CPU.

| game | frames | uop vs off: gameplay | uop vs off: user CPU | null band (user / gameplay) |
|---|---|---|---|---|
| Heroes III | identical | -52.9% | -5.2% | 1.8% / 3.3% |
| Diablo shareware | identical | -43.2% | -4.1% | 0.2% / 0% |
| Warcraft III, software GL (wc3g)* | identical | -13.0% | -6.0% | 0.3% / 0% |
| StarCraft | nondeterministic (off~off2 differ too) | -5.9% (0.1 s resolution) | -2.3% | 0.9% / 0% |

\*wc3g needs the then-uncommitted Game.dll ordinal-import linking from the
working tree; on bare HEAD, Game.dll's DllMain stops at `KERNEL32.#00001`.

Heroes III x87 fold, same box, frames identical in every pair:
`uopfold` vs `uop` user CPU **-4.3%** (86.58/86.53 s vs 90.46/90.49 s, null
band 0.03%), gameplay slice 0.0%. `fold` vs `off` is -5.3% (null 0.9%). All
of the saving is guest-thread time, as the dispatch counts predicted.

Moorhuhn, same box. These ran on the working tree as of 2026-09-28 morning;
routes are `mh1`/`mh2`/`mhw`/`mh3` in `tools/uop-game-ab.js`, and every final
frame was looked at and shows a live round:

| game | frames | uop vs off: gameplay | uop vs off: user CPU | null band (user) |
|---|---|---|---|---|
| Moorhuhn | nondeterministic (off~off2 1.4%) | -14.3% | -30.0% | 1.2% |
| Moorhuhn 2 | identical | -4.5% (0.1 s resolution) | -14.0% | 0.5% |
| Moorhuhn Winter | nondeterministic (off~off2 17.6%) | -13.2% | -13.9% | 1.1% |
| Moorhuhn 3 | nondeterministic (off~off2 67%) | -25.3% | -32.4% | 0.2-2.5% |

On Moorhuhn 3 the x87 fold (`uopfold` vs `uop`) is inside its 3.5% null band,
so it has no measurable effect, even though an FPU MP3 filter is its hottest
gameplay block.

## 9. Entry cost: chaining measured, windows kept (2026-09-28)

**Chaining** would let a program exit that lands on another installed
program's head jump straight into that program. It was measured before
anything was built, with `uop-game-ab.js --arms=uop` on the gameplay routes
under `--branch-clock`:

| game | enters | exit lands on a live head | same program as the last entry |
|---|---|---|---|
| Heroes III | 7.81M | 2,188 (0.03%) | 83% |
| Diablo | 115.4M | 3,779 (0.003%) | 70% |
| StarCraft | 3.52M | 12,295 (0.36%) | 68% |

Programs exit into threaded code that is not another loop head, so chaining
would remove at most 0.36% of entries. It was not built.

**Where an entry's cost went.** Every entry poisoned all of its windows,
2.1 to 3.7 per entry on average. The first access through each window then
missed and paid `$uop_run` → `$uop_reguard` → `$uop_window_set` →
`$g2w_affine_span`, plus the code-page walk for a written window. These
first touches after poisoning, rather than streams walking off a page, were:

| game | first-touch re-guards | share of all re-guards | per entry |
|---|---|---|---|
| Heroes III | 20.5M | 90% | 2.6 |
| Diablo | 168.8M of 256.6M | 66% | 1.5 |
| StarCraft | 7.9M | 86% | 2.3 |

**Windows now outlive a run.** Header +28 holds the `$UOP_WIN_EPOCH` under
which the windows were last poisoned. The enter op poisons only when the
shared epoch has moved since then. The epoch is bumped atomically, after the
change, in four places:

- `$guest_page_publish_range` or `$guest_page_clear_range`, when a present
  PTE is replaced or removed;
- `$code_page_mark`, when a page first becomes code;
- `$code_note_decode`, when it widens the sparse generated-code span.

Each program now owns its window slots, placed after its code, instead of
all programs sharing one set. Interleaved programs therefore keep their
windows too.

**The SMC hole this closed.** It predates this change:

- The poison loop wrote `rw = 0` into every slot, and nothing ever set it
  back to 1.
- So a re-guard of a *store* window never asked `$code_write_is_code`.
- A program's store into a page holding decoded code therefore went straight
  to memory. It did not retire the blocks it overwrote, and it did not kill
  a program lowered from those bytes.

The fix:

- Slots carry `rw` from compile time. `$uc_encode_write` marks the windows of
  store ops, and poisoning leaves `rw` alone.
- A failed `$uop_window_set` now leaves the slot poisoned instead of at
  span 0. For a 4-byte access, span 0 reads as "hit everything", which
  mattered only while a slot could outlive its run.

**What the fix cost, and the retirement that pays for it.** With `rw`
honoured, StarCraft's head exits went from 283 to about 770K. Four programs
(`0x4b4417`, `0x4c789f`, `0x4b57a1`, `0x4b43f6`) store into pages that hold
decoded code on their first access. Each entry therefore exited at its own
head with zero blocks run: 720K entries that did no work at all. The
poor-retirement check only ran on non-head exits, so these programs were
never retired. It now also runs on a head exit that spent no block. Such an
exit made no progress, so the same `enters >= 256 && blocks < 2*enters`
rule applies to it unchanged. After the change, StarCraft has 2,891 head
exits and 35 programs retired as poor (15 before).

`test-uop-compiler.js` `window-keep` covers all three parts:

- A program proves a store window on a page.
- The page then gets decoded code. The program's next store there must exit,
  so that threaded code invalidates the block. A build without the
  `$code_page_mark` bump fails here with the stale immediate.
- Further stores into that page must get the program retired. It retires
  after 236 head exits, is not entered again, and the threaded store it
  leaves behind still lands.

**Measured** with `uop-game-ab.js --arms=off,off2,uop,refuop`, where `refuop`
is the base build. Load was 9-19, so timings are noisy.

| game | frames off~uop | re-guards base → new | windows kept | gameplay phase uop vs refuop | null band (off2/off) |
|---|---|---|---|---|---|
| Heroes III | IDENTICAL | 22.76M → 5.51M (-76%) | 7,807,899 of 7,808,452 | 15.2s vs 15.4s | 1.2% |
| Diablo | IDENTICAL | 256.6M → 147.3M (-43%) | 115,365,124 of 115,365,490 | 6.3s vs 6.4s | 0.0% |
| StarCraft | 0.94% (off~off2 1.41%) | 8.87M → 2.08M (-77%) | 3,609,198 of 3,689,426 | 1.7s vs 1.6s | 5.6% |

For Heroes III, enters, blocks and installs are identical between the two
builds. Diablo differs by a few installs, and the base build alone varies
by that much from run to run (179, then 177). StarCraft has 7.7% more
enters. Those are programs whose stores now correctly exit partway through
a trip on a code page.

The re-guard counters fall a great deal, but the time saved is inside the
noise: -1.3% on Heroes III gameplay against a 1.2% band, and -0.9% on
Diablo's whole-run user CPU. The per-entry saving is real but small next to
what an entry already costs. It needs the quiet box to price.

**What remains unguarded** is the cross-thread case §3 already documents:
another instance decoding or remapping *during* this instance's run. Between
runs the epoch catches that case too, because the epoch is shared.
## 10. Coverage: what declined scans actually stop on (2026-09-28)

`--uop-census` now also records the instructions that end each declined scan:
kind-9 records, keyed by an opcode signature. `tools/uop-census.js` prints them
as "unsupported instructions in declined scans, by form", weighted by the
threaded block entries at the declined head in the histogram window. Before
this change, the top non-FPU forms were:

| game | top unsupported forms (weight = block entries at head) |
|---|---|
| StarCraft | `mov eax,moffs` 14.5M, `sbb` 8.6M, `push imm8` 7.5M, `call` 6.1M, `setcc` 5.3M, `shr r,cl` 4.3M |
| Diablo | `mov eax,moffs` 67M, `mov al,moffs` 32M, `setcc` 16M, `mov moffs,eax` 12M |

New lowerings in `07e`, all without any call on the fast path:

- **`A0-A3` moffs.** A kind-5 move with a disp32-only memory operand.
- **`rol`/`ror r/m, imm`.** Kind 11, ops 3 and 4.
- **Shift by CL (kind 18).** The flag effect depends on the runtime count, and
  a zero count leaves the flags untouched. The lowering therefore leaves the
  record in the globals (state G): `BNZL` (64, free) skips the flag write on a
  zero count, and `SETSS` (65, free) stores the sign shift. Exits need nothing
  extra.
- **`setcc` (kind 19, cc at R+20).** `$uc_setv` forwards cmp/sub, logic/test
  and inc/dec/add recipes into SLTU/SLT/EQ forms. Every other case
  materializes the record and runs `GETCC` (66), a service op that calls
  `$eval_cc`, so the result is bit-exact with the threaded path.
- **32-bit `sbb` (kind 20).** Covers the ALU `18-1D` forms and group
  `80/81/83 /3`, and writes flag_a/flag_b exactly as the threaded
  `$set_flags_sub(a, b+CF, r)` does. `adc` and the 8/16-bit forms are still
  declined.

Results. hu = `head-unsupported`, nb = `no-backedge`. Each census is one run of
the game's route. The hot-window share is the share of threaded entries the
tier did not take, by verdict.

| game | installs before → after | declines before → after | hot-window verdicts after |
|---|---|---|---|
| StarCraft | 578 → 711 | nb 1111 → 899, hu 248 → 205 | nb 15.4% → 3.9%, hu 6.2% → 1.2%, poor 4.3% → 0.2% |
| Heroes III | 290 → 432 | nb 1370 → 1205, hu 418 → 364 | unchanged (its hot code is x87) |
| Diablo | 249 → 254 | nb 835 → 804, hu 1663 → 1535 | hu 26.1% → 22.1% |

Every targeted form is gone from all three censuses. What still stops a scan
is almost entirely stack and control transfer: `push r`, `call`, `push imm`,
`pop r`, `ret`, `ret imm`, `loop`, `jmp` (as a head). After those come `div`,
`rep movsd`/`rep cmpsb` and `lodsb`. Push, pop and call cover the most
weight, well ahead of everything else. That is the next coverage step:
straight-line stack traffic, and possibly inlining a callee that returns.
The FPU is a separate step.

**Speed (bench box, 2026-09-28).** Candidate = 38144a80 + this section's
lowerings; reference = 38144a80. `uop-game-ab.js --arms=uop,refuop,uop2,refuop2
--ref-wasm`, serial, idle box (load 0.0), mean of two repeats per arm.

| game | frames | user CPU, candidate vs main | gameplay slice | null band (user) |
|---|---|---|---|---|
| StarCraft | nondeterministic (repeats of one build differ 1.2-1.5%) | 19.66 vs 31.46 s, **-37.5%** | 1.2 vs 1.75 s | 0.1% / 0.8% |
| Diablo shareware | identical | 195.5 vs 198.2 s, **-1.35%** | 5.15 vs 5.3 s | 0.4% / 0.5% |
| Heroes III | identical | 80.2 vs 85.0 s, **-5.6%** | 5.65 vs 5.7 s | 1.3% / 0.4% |
| Warcraft III, software GL | identical | 114.1 vs 137.7 s, **-17.2%** | 1.8 vs 2.0 s | 0.1% / 0.1% |

Most of the win is guest-thread time, which the main-thread gameplay slice
does not see: StarCraft's thread 1 runs 340M blocks in the tier against 84M,
and Warcraft III's Miles audio thread 432M against 90M (the moffs forms were
what kept its mixer loop out). Installs rise on every game (StarCraft 344 ->
425, Warcraft III 743 -> 791); StarCraft's `head-unsupported` declines fall
from 841 to 206.

## 11. Remaining bottlenecks (2026-09-28)

§8 and §9 asked whether the tier pays. This section asks the next question:
with the tier and the x87 fold both on by default (89c6890c), where does
gameplay CPU go now, and what should be built next? Every number is from the
gameplay window of a `tools/uop-game-ab.js` route (batches `split..max-1`), not
the whole run.

### 11.1 Method, and a tooling bug that invalidated earlier histograms

- **Box.** The quiet bench box (4 vCPU, load 0-1 throughout), worktree
  `~/prof` at 60a24244, which has the same tree as main 38144a80. Runs were
  serial, one at a time.
- **CPU.** `--cpu-prof-window=SPLIT:END` with `--cpu-window` user CPU. It
  covers the main instance and every cooperative guest-thread instance.
  wasm-function indices were named with `tools/wasm-func-name.js --dump` and
  bucketed by subsystem. **`--slice-split`'s "guest slice" is not the right
  denominator for a threaded game.** On WC3g the main slice is 2.6s of a 26.4s
  window, and the rest is guest threads.
- **Coverage and loads.** `--uop --uop-census --handler-hist-thread=N
  --hist-json --hot-block-dump --batch-stats --decode-stats`. A local
  measurement-only `--input=B:uop-stats` action snapshots the `uop_stats`
  counters of every instance at SPLIT and END. The tier's share of block
  entries is (uop blocks) / (uop blocks + threaded block hits) over the same
  window. None of these patches are committed.
- **The bug: `--handler-hist` turns the tier off on the thread it profiles.**
  `$handler_hist_enabled` raises `$dbg_any`, which raises `$dbg_chain_guard`.
  `$th_uop_enter` (07d) and the `$branch_end_at` fast path both bail on
  `$dbg_chain_guard`. So every histogram window measured the tier-off state,
  including §8's per-thread histograms and any `uop-census.js --hist` coverage
  figure. The box runs here patch the `$th_uop_enter` guard to
  `(i32.and $dbg_chain_guard (i32.eqz $handler_hist_enabled))`. **This belongs
  in main.** Until it lands, a histogram taken with `--uop` silently describes
  a different program.
  **Fixed since:** `$th_uop_enter` now tests `$dbg_tier_guard`, which is
  `$dbg_chain_guard` without the histogram (13-exports.wat
  `$dbg_recompute`). The transfer fast paths still take the desk under
  `--handler-hist`, because `$hot_block_hist_record` runs there; that costs
  time, not coverage. `--break`/`--watch`/`--count`/`--trace-*` still hold
  the tier off. test-uop-compiler `hist-keeps-tier` checks both halves.
- **Uncovered: guest-thread verdicts.** `--uop-census` records from guest
  threads are not in the log. `uop-census.js --thread=N` finds no `[i32 TN]`
  records, so the verdicts for WC3's audio thread below are inferred from its
  disassembly, not observed.
  **Cause, since fixed:** cooperative threads' records were in the log all
  along, tagged `[i32 T<tid>]`; the `uop[thread 0x…]` summary names the
  thread HANDLE, and `--thread=` wants the tid. The summary now prints
  `tid=N`, and `uop-census.js --thread=0xHANDLE` maps through it. `--threads`
  workers now forward their log under `--uop-census` too (they have no exit
  dump, so only live events appear).

### 11.2 Where the time goes, per game

Share of window user CPU, by self time, grouped by subsystem:

| group | H3 | Diablo | SC | MH3 | WC3g |
|---|---|---|---|---|---|
| window user CPU | 12.6s | 45.8s | 14.7s | 6.9s | 26.4s |
| threaded dispatch/handlers | 30.9% | 34.7% | 49.9% | 16.5% | 43.4% |
| uop tier (`$uop_fast`…) | 19.3% | 6.1% | 20.4%¹ | 8.4% | 4.1% |
| x87 (fold + handlers) | 21.3% | ~0 | ~0 | 0.3% | 13.3% |
| wasm other (`$read_thread_word`, `$bx_hot_bump`, paint scans…) | 10% | 26% | 15.1% | — | 16.6% |
| memory translation (`$g2w`/`$gl32`/`$gs32`) | 8.4% | 8.1% | 7.3% | — | 12.4% |
| decode/cache (`$page_*`, `$code_page_test`, decode) | 5.2% | 13.9% | 6.1% | — | 8.3% |
| DirectDraw handler | — | — | — | **60.1%** | — |
| JS (harness canvas + `h.log`) | 4.7% | 7.1% | — | — | — |

¹ SC's uop group is dominated by `$uop_code_write` (14.5%). `$uop_fast`
itself is 5.0%.

Named hot spots (self time unless marked incl):

- **H3.**
  - `$uop_fast` 18.3%.
  - `$th_x87_island` 14.0% incl, pipeline4 3.4% incl, `$th_fpu_mem_ro` 3.7% incl.
  - `$branch_end_at` 7.1% incl.
  - `$read_thread_word` 4.3%, `$g2w` 4.0%.
  - `$decode_block` 3.4% incl, `$invalidate_code_write` 2.0% incl, `$bx_hot_bump` 1.3%.
- **Diablo.**
  - `$win32_dispatch` 27.3% incl, of which `$handle_PeekMessageA` 16.1% incl.
    The paint and non-client scans under `PeekMessageA_fetch` cost:
    `$paint_flag_mine` 6.4% + `$nc_flags_scan` 3.1% +
    `$paint_select_next_dirty` 2.2% + `$paint_drain_native_control_paints` 2.1%
    = **13.8% self**.
  - Block transfer: `$branch_end_at` 6.3% (19.9% incl), `$page_resolve` 3.4%,
    `$page_enter` 3.2%.
  - Stack handlers: `$th_push_r` 3.8%. `$gs32` is 8.0% incl, of which the SMC
    check `$invalidate_code_write` is 5.3% incl, mostly from push/call.
  - `$code_page_test` 3.1%, `$gl32` 2.9%, `$bx_hot_bump` 2.6%.
  - The run makes 424M API calls.
- **SC.**
  - **`$uop_code_write` 14.5%**, reached through `$invalidate_code_range` ←
    `$gs8` ← `$th_store8_ro`. `$invalidate_code_write` is 16.2% incl.
  - The cache counted 6.95M page invalidations in the window, and only 18,301
    of them dropped a block.
  - `$read_thread_word` 7.0%, `$branch_end_at` 6.7% (17.2% incl),
    `$uop_fast` 5.0%, `$bx_hot_bump` 3.0%.
- **MH3.** **`$handle_IDirectDrawSurface_BltFast` 60.1% self** (61.4% incl via
  `$win32_dispatch`). Its SRCCOLORKEY path is a scalar per-pixel loop. It
  branches on bytes-per-pixel inside the loop and recomputes `row*pitch` per
  pixel.
- **WC3g.**
  - `$th_x87_island` 10.1% incl.
  - `$g2w` 4.6%, `$gl32` 3.7%, `$guest_page_translate` 1.2%.
  - `$read_thread_word` 4.8%, `$branch_end_at` 10.5% incl, `$bx_hot_bump` 2.8%.
  - GL is 0.2%.
  - The time is on the Miles audio thread. See the next table.

Tier coverage and the threaded remainder (load-immune counts, window only):

| | tier share of block entries | threaded ops/block | threaded remainder by handler class |
|---|---|---|---|
| H3 main | **77.1%** (81M uop vs 24.1M) | 9.74 | alu/mov 40.9%, mem 39.7%, branch 6.9%, stack/call 5.3% |
| H3 T1 (audio) | 35.2% | — | mem 31.8%, alu 26%, **x87 24.7%** |
| Diablo main | 28.4% (732M threaded entries) | 2.86 | **stack/call/ret 43.4%** (push_r 14.1, pop_r 9.3, call_rel 5.9, call_ind 4.3, ret 4.0, push_i32 3.9, ret_imm 2.0), alu 17.9%, mem 16.9%, branch 16.8% |
| SC main | 36.3% (T0xe1001 adds 37.8M uop blocks) | — | alu 39.3%, mem 27.1%, branch 13.3%, stack 6.6% |
| MH3 main | 66.5% | — | mem 30.5%, stack/call 25.4%, alu 21.9% |
| WC3g main | 47.0% (79.5M vs 89.7M) | 7.46 | alu 40.2%, mem 25.7%, stack/call 16.2% |
| WC3g audio thread (h=0xe1006) | **~5%** (≈3.1M uop vs 60.4M per ⅓ window) | 7.11 | alu 46.3%, mem 31.1%, branch 13.8%, x87 4.1% |

The WC3g audio thread runs **~1.29G threaded dispatches** over the window,
about twice the main thread's 669M. Two blocks make up **54% of its block
entries**: Mss32.dll `0x2113c300`/`0x2113c334`, the Miles resampling mixer
(`mov eax,[moffs]; … imul; add [edi],eax; …; add edx,[moffs]; jnb head`). The
MP3 decoder in mp3dec.dll (`+0x38f6` and neighbours) is most of the rest.

Why the untaken entries were not taken (share of threaded entries, by the
block's verdict as a head):

| | no-backedge | head-unsupported | no-verdict (of which in a shared hot slot) | poor | live |
|---|---|---|---|---|---|
| H3 T0 | 41.5% | 14.2% | 15% | 15% | 10.9% |
| H3 T1 | 74% | — | — | — | — |
| Diablo | 37.6% | 36.0% | 22.1% (13.7%) | 0.1% | 3.9% |
| SC | 25.9% | 9.5% | 31.9% (18%) | 14.7% | — |
| MH3 | 44.4% | — | 39.8% (30.4%) | — | — |
| WC3g main | 31.4% | 10.6% | 12.9% (7.3%) | 0.8% | 0.7% |

Notes on the verdicts:

- **H3's biggest head-unsupported case** is one switch loop,
  `jmp [0x472a9c+ecx*4]` at exe+0x47227c. Its case blocks 0x472266, 0x472283,
  0x47229d and 0x472320 are each 6.17% of threaded entries, about 31% of
  T0's remainder.
- **SC's poor heads.** storm.dll+0x1502508b is poor (5.7%). exe+0x4b43ea and
  0x4b43f6 (4.1% each) are poor only because their stores land on a code page.
- **Diablo's remainder** is short storm.dll functions whose heads are
  `mov eax,[esp+4]`, `push eax` and `ret` (2.2% each). That is call-heavy
  straight-line code with no back edge for the tier to key on.
- **Hot-table churn.** The 512-slot table saw 51.9M (H3), 73.0M (Diablo),
  11.2M (SC), 25.7M (MH3) and 120.6M (WC3g) slot takeovers in the run.

Decode is not a lever any more. Gameplay decodes in the window were:

| game | decodes |
|---|---|
| H3 | 5,033 (93.9% of batches decode-free) |
| Diablo | 858 |
| SC | 1,851 |
| MH3 | 306 |
| WC3g | 34,572 (`$decode_block` 1.3%) |

Batches overwhelmingly stop on "budget spent".

Machine-code sizes (SpiderMonkey Ion, arm64, `tools/wasm-native.js`) that
bear on the ideas below:

| function | instructions | notes |
|---|---|---|
| `$uop_fast` | 1146 | |
| `$th_uop_enter` | 280 | 2 indirect tail calls |
| `$fpu_exec_reg` | 1415 | 10 indirect calls |
| `$fpu_exec_mem` | 594 | |
| `$x87_island_body` | 111 | a compare chain into the two above, per op |
| `$branch_end_at` | 226 | |
| `$bx_hot_bump` | 82 | |
| `$read_thread_word` | 12 | not inlined, 237 call sites |
| `$uop_code_write` | 111 | a linear scan over `$uop_nranges` |
| `$handle_IDirectDrawSurface_BltFast` | 487 | |

### 11.3 Ranked ideas

Saving = measured share × plausible speedup of that share, per game. Shares
are self time unless marked incl.

1. **BltFast colour-key blit: specialise and vectorise.**
   - What: hoist the bytes-per-pixel switch out of the pixel loop, keep row
     pointers, and do the key compare and select with v128 (`i8x16.eq` /
     `v128.bitselect` on 8bpp, `i16x8` on 16bpp).
   - Games: MH3, plus every DirectDraw sprite game that blits with a colour
     key (unmeasured).
   - Share: 60.1% of MH3.
   - Saving: **−45-50% MH3 CPU** (at 4-6x on the blit).
   - Cost/risk: low. One handler, and its output is checkable
     pixel-for-pixel against the scalar path.
   - Evidence: MH3 cpu-prof, `$handle_IDirectDrawSurface_BltFast` 60.1% self.
2. **Stop `$uop_code_write` scanning every uop range on every code-page
   store.**
   - What: gate it on a per-page "has uop range" bit, set at install and
     cleared at flush, or at least on a hull test over all ranges.
   - Games: SC, and any game that writes data on pages it also executes.
   - Share: 14.5% of SC.
   - Saving: **−13-14% SC**.
   - Cost/risk: low. The check must stay conservative, and
     test-uop-compiler's SMC cases cover it.
   - Evidence: SC cpu-prof, `$uop_code_write` ← `$invalidate_code_range` ←
     `$gs8` ← `$th_store8_ro`.
3. **Make PeekMessage's empty-queue path O(1).**
   - What: keep dirty/non-client counts, or a summary bit, so
     `$paint_flag_first`/`any`/`select_next_dirty` and `$nc_flags_scan` do
     not walk MAX_WINDOWS per poll when nothing is pending.
   - Games: Diablo, and every PeekMessage-polling game loop.
   - Share: 13.8% self in Diablo (16.1% incl under `$handle_PeekMessageA`).
   - Saving: **−12% Diablo**.
   - Cost/risk: low-medium. The counters must stay exact, and the paint-order
     tests guard it.
   - Evidence: Diablo cpu-prof.
4. **uop compiler: accept `mov eax,[moffs32]` / `mov [moffs32],eax` (A1/A3).**
   - What: 07e decodes the 88-8B forms but not the moffs encodings, so any
     loop whose body uses them is declined.
   - Games: WC3g. Miles is also used by H3 and others, but not verified
     there.
   - Share: WC3's Miles mixer head `0x2113c300` has one in its second
     instruction and another in its tail. Its two blocks are 54% of the audio
     thread's block entries. The audio thread is ~⅔ of WC3g's threaded
     dispatches, and threaded is 43% of WC3g CPU, so the loop is **≈15% of
     WC3g CPU**.
   - Saving: **−7-10% WC3g** at the tier's 2-3x.
   - Cost/risk: trivial. It is a disp32 memory operand with no base.
   - Evidence: WC3g guest-thread hist (`e07300`/`e07334` = 27.1% each) plus
     disassembly. The verdict itself was not observed (§11.1).
5. **Cheaper x87 island body.**
   - What: `$x87_island_body` dispatches each op through a compare chain into
     `$fpu_exec_mem` (594) or `$fpu_exec_reg` (1415 instructions, 10
     indirect calls). Pre-decode each island op to a direct small handler
     index at fold time, and keep ST(0)/ST(1) in locals across the island.
     Alternatively, give the uop tier an f64 register class for pure x87
     islands inside loops.
   - Games: H3, WC3g, and H3's MP3 thread.
   - Share: H3 `$th_x87_island` 14.0% incl; WC3g 10.1% incl.
   - Saving: **−6-7% H3, −4-5% WC3g** at 2x.
   - Cost/risk: medium. The fold's results must stay bit-exact, which
     test-x86-ops' x87 cases check.
   - Evidence: H3 and WC3g cpu-prof, plus Ion sizes.
   - **Done (2026-09-28, `$x87_island_fast` in 07b):** ST(0), TOP and the two
     tag bytes in locals, one `br_table` per op, write-back once; unmodelled
     forms publish and call `$fpu_exec_*`. No fold-time rewrite, so the
     records and the 07c walkers are unchanged. `--no-x87-island-predecode`
     is the A/B partner; `test/test-x87-island-predecode.js` fuzzes it
     bit-for-bit against the old walk and the unfused handlers. Box2, same
     build, interleaved, frames identical in every pair: **H3 −5.8% user**
     (68.0/68.7s vs 72.9/72.2s; main 73.1/72.6s; null band <1%), **WC3g
     −5.9%** (101.1/101.0s vs 107.9/107.0s; band 0.8%). Island incl time:
     H3 14.0% → 8.5%, WC3g 11.5% → 6.5% (`cpuprof-top.js --incl=x87_island`).
     Ion: 2248 instructions, one 17-way table, 69 direct calls (29 of them
     `$fpu_set_exc` on cold paths) against the old per-op call into
     `$fpu_exec_reg` (1415 insns, 10 indirect calls) / `$fpu_exec_mem`.
6. **Inline `$read_thread_word`.**
   - What: make it a `defmacro`, as dispatch-next is. It is 12 instructions,
     called from 237 sites, and V8 does not inline it.
   - Games: all.
   - Share: H3 4.3%, Diablo 3.5%, SC 7.0%, WC3g 4.8%.
   - Saving: **−2-3.5%** everywhere, taking call overhead as about half of it.
   - Cost/risk: trivial. The body grows, measured at the §8 dispatch-macro
     scale.
   - Evidence: all five cpu-profs.
7. **push/pop/call/ret in the tier, with shallow callee inlining.**
   - What: the lowering §7-§8 deferred. The tier still keys on back edges,
     so on its own this converts loops that call leaves, not Diablo's loopless
     call chains. The Diablo win needs call-inlined traces (a trace head at
     a hot call target).
   - Games: Diablo; also MH3 (stack/call 25% of remainder) and WC3g main
     (16%).
   - Share: Diablo stack/call/ret is 43.4% of threaded dispatches, the
     threaded group is 34.7% of CPU, and 72% of Diablo's entries are untaken.
   - Saving: **−10-20% Diablo** if half the call chains convert; −3-5% MH3
     and WC3g.
   - Cost/risk: high. It needs ESP-relative guest stores under the SMC
     guard, and exact exceptions at every push.
   - Evidence: Diablo census (no-backedge 37.6% + head-unsupported 36.0%,
     storm.dll leaf functions).
8. **Sub-page code-write granularity.**
   - What: split `$code_page_test` into 64-256 B code bits, or a
     per-page "code range" hull, so a data store beside code is not an
     invalidation.
   - Games: SC, Diablo.
   - Share: SC's 6.95M invalidations dropped a block 0.26% of the time, and
     two heads (8.1% of untaken entries) are "poor" only because of
     same-page stores. Diablo's `$invalidate_code_write` is 5.3% incl from
     stack pushes, and `$code_page_test` is 3.1%.
   - Saving: **−2-4% SC** (beyond idea 2, plus un-poored heads); **−3-4%
     Diablo**.
   - Cost/risk: medium. Correctness is central (a missed SMC is silent), and
     `--trace-code-writes` is the check.
   - Evidence: SC and Diablo cpu-prof, SC cache counters, SC census.
   - **Status 2026-09-28 (built, page-granular, not sub-page):** SC's
     storm was not same-page stores at all. The old filter OR'd the page
     bitmap with a *min..max span* over sparse generated code
     (0x7c6d0000..0x7ef81000 on SC), so every store to the data pages
     inside that span (0x7e07x000, writer exe+0x4b43f6) walked. The
     bitmap is now indexed by `(ga>>12 ^ ga>>28) & 0xFFFF` (identity
     below 0x10000000, conservative aliasing above), the span is no
     longer a filter, and `$gs8/16/32/64` test the bit inline and call
     `$code_write_hit` only on a flagged page (so stack stores make no
     call). `--code-write-legacy` restores the span filter for A/B.
     box3, uop arms vs ae31f419, two reps each, user CPU:
     SC −7.0% (null 1.4%; frames differ 1.36% vs the app's own 1.46%),
     walks 7.41M→22-32K with blocks dropped unchanged (~18.2K), misses
     7,546,085→17,822, uop kills 35→15; Diablo −4.8% (null 0.3%,
     frames IDENTICAL), walks 536K→496K; H3 −3.1% (null 0.8%, IDENTICAL),
     walks unchanged, so its win is the inline test alone. Same build
     with `--code-write-legacy` on SC: +8.8% and 7.8M walks again.
     Remaining: Diablo's 473K misses are real same-page stores into code
     page 0x00e60000 — the sub-page case, not built.
9. **Multiway branch in the tier (`jmp [tbl+r*4]`).**
   - What: lower an in-image jump table as a guarded br_table over its
     in-loop targets, and exit on any other target.
   - Games: H3 (other switch loops unmeasured).
   - Share: about 31% of H3 T0's untaken entries, with H3 main already at
     77% coverage, is ≈6% of H3 CPU.
   - Saving: **−3% H3**.
   - Cost/risk: medium. Table bounds are read from guest memory, so there
     is SMC and table-write exposure.
   - Evidence: H3 census, switch loop at exe+0x47227c.
10. **A bigger, or 2-way, hot table.**
    - What: grow the 512-slot table so hot heads stop evicting each other.
    - Games: SC, MH3, Diablo.
    - Share: no-verdict entries in a shared slot are 18% (SC), 30.4% (MH3)
      and 13.7% (Diablo) of untaken entries.
    - Saving: **−1-3%**. Many of those blocks are bodies, not heads, so this
      is an upper bound.
    - Cost/risk: trivial (a region size). Try it first, because it is
      cheapest to price.
    - Evidence: census hot-table lines, with takeovers in the tens of
      millions.
11. **Skip `$bx_hot_bump` for blocks that already have a verdict or an
    installed program.**
    - Games: all five.
    - Share: 1.3-3.0% self.
    - Saving: −1-2%.
    - Cost/risk: trivial.
12. **Headless only: the per-API `log` + `log_api_exit` host calls.**
    - What: two host calls per Win32 call even under `--quiet-api` (88M of
      each in one H3 run). The browser no-ops them, so this is benchmark
      hygiene rather than product speed. `--quiet-api-fast` exists and should
      become what `--quiet-api` does.
    - Share: Diablo `h.log` is 2.3%.

Not recommended:

- **Exit chaining of uop windows.** It takes <0.4% of entries (§9), and
  block chaining priced +1.4% *slower* on the box
  (docs/block-chaining-design.md §11.1). Block transfer
  (`$branch_end_at` + `$page_resolve` + `$page_enter`) is 13% of Diablo self
  time, but that time is paid on call/ret transfers, which idea 7 removes
  and chaining would not.
- **Decode or cache work.** Decode rates are low on every game (the table
  above).
- **String ops, adc, setcc in the tier.** None shows as a measurable share
  of any threaded remainder in these windows.

**Order of work:**

1. Build ideas 1, 2, 3, 4 and 6. Each is a day or less, with a large,
   single-game-proven share.
2. Fix the handler-hist guard (§11.1).
3. Then idea 5.
4. Idea 7 is the large project, and the only one that moves Diablo's
   remaining two thirds.

## 12. Aggressive stack tier: `--aggressive-stack` (opt-in, 2026-09-28)

The exact tier lowers `push`/`pop`/`call`/`ret` to real stores and loads
(`$uc_insn` kinds 21-24). The aggressive tier drops the memory traffic of a
push when its value never needs to be in memory. It is **off by default**.
You turn it on with `--aggressive-stack` (run.js, via
`test/runner-experiments.js`), `aggressiveStack: true` on an app in
`lib/apps.js`, `?aggressive-stack` in the page, or the `aggr` arm of
`tools/uop-game-ab.js`. Worker and cooperative thread instances inherit it
(`set_aggressive_stack` in `lib/worker-imports.js`). The setter flushes
every program, because the choice is made at compile time.

**Mechanism.** `$uc_sp_analyze` runs once per compile, just before
emission. It calls `$uc_sp_block`, which walks each block twice.

- **Pass 1** tracks ESP as an offset from the block's entry. It keeps an
  open list of pushes and matches each pop against the top entry (LIFO,
  with the same slot).
- **Pass 2** marks the pairs that are still elidable. It also marks the
  accesses that are forwarded.

An elided push becomes `MOV temp(20, push address), value`, and its pop
becomes `MOV reg, temp`. ESP still moves by 4 each time, so registers and
flags are exact.

The rules for what happens between an elided push and its pop:

| Access | Result |
|---|---|
| `[esp+d]`, or `[ebp+d]` where EBP comes from a tracked `mov ebp, esp` in the same block, not overlapping the slot | the pair stays elided |
| same address kinds, an exact 32-bit read (`mov`/`alu`/`test`/`cmp`/`imul`/`sbb` source, or a `cmp`/`test` destination) | forwarded: reads the temp |
| same address kinds, a pure 32-bit write (`mov` destination) | forwarded: writes the temp |
| partial overlap, narrower access, or read-modify-write (`add [esp], r`) | that push materializes (it is a real store) |
| any other address (register base other than ESP, EBP unknown, absolute address, index register) | every open push materializes |
| ESP written other than by `add`/`sub esp, imm` | every open push materializes, and tracking restarts |
| `call`/`ret` | every open push materializes, so return addresses are never elided |
| `add esp, imm` released a slot | that push stays materialized (its pop never comes) |

- **Rule 2 (unknown addresses).** The runtime guard, a range check of the
  address against the open slots, is **not built**. An unknown address
  always materializes. The report counts how often it did, so the guard's
  value can be read off: `unknown-addr` below.
- **Escapes.** An escaping `lea r, [esp+d]` needs no rule of its own. The
  only way to reach the slot through `r` is to dereference `r`, and that is
  an unknown address.
- **Exits.** A stub that leaves the program between an elided push and its
  pop first spills the temps to their slots, using the new `SPILL s base
  disp` op (op 67, a service op calling `$gs32`). `$uc_flush_stubs` calls
  `$uc_spill_at` for every exit or deopt stub (kind 0 or 1). The page-seam
  CHK stub is the one that matters in practice.
  `test/test-uop-compiler.js` `sp-seam-spill` has a pair straddling a
  page; with the spill disabled that case fails with wrong `edx`/`ebx`.

**Observable differences from the exact tier.** This is why it is opt-in.

1. **Memory below ESP after a pop.** On real hardware the popped value is
   still at `[esp-4]`. With the pair elided, that slot holds whatever was
   there before. Code that reads below ESP after a pop sees a different
   value. That is legal but rare, and the tracker does not model it,
   because a closed pair leaves the open list.
2. **Other observers during the pair.** While a pair is open, its slot is
   not in guest memory. Nothing inside the block can see this: every
   access is either proven disjoint, forwarded or materialized. What can
   see it:
   - another guest thread reading this thread's stack;
   - a host-side `--watch` or `dump-mem` on the stack;
   - a `--threads` worker sampling it.
3. **Stack faults.** An elided push does not touch its page. A push into
   a guard page, which on Windows grows the stack, does not happen, so
   the fault or the growth happens at the next real access instead.
   Guest stacks here are preallocated, so no app is known to depend on
   this.
4. **Where a spill writes.** The spill happens at the stub, at the exit
   EIP, not at the push's EIP. A memory fault it raises would name the
   wrong instruction. The stack is always mapped, so this is not expected.
5. **What does not change.** Registers, flags, EIP, batch stops (under
   both clocks, checked per batch), and every memory byte the block itself
   can observe. Return addresses are never elided.

**Tests** (`test/test-uop-compiler.js`, the `sp-*` cases). Each case runs
threaded against hot and pre-installed tier runs with the aggressive tier
on, and pins the compile counters.

| Case | Covers | Pinned counters |
|---|---|---|
| `sp-fwd-load` | rule 1, exact read | 2 elided, 2 forwarded reads |
| `sp-nonoverlap` | rule 1 / 3, disjoint locals | 1 elided, rescued past another slot |
| `sp-fwd-store` | rule 3, exact write, then read | 1 forwarded write, 1 forwarded read |
| `sp-partial-rmw` | movzx of a byte of the slot; `add [esp], ecx` | 2 materialized, partial |
| `sp-unknown-escape` | `add ebx,[esi]`; `mov [edi],ebx`; `lea edx,[esp]` + `mov [edx],ecx` | 3 materialized, unknown address |
| `sp-release-espw` | `add esp, 4` releases a slot; `mov esp, edx` | 1 elided, 1 unmatched pop |
| `sp-ebp-frame` | `push ebp; mov ebp, esp; push edi; mov [ebp-4], eax; mov eax, [esp]` in a called function | 2 elided, 1 forwarded write, 1 forwarded read |
| `sp-seam-spill` | a pair across a page seam | 4 spills under the block clock |

All of the exact tier's `push-pop`, `call-*` and `ret-*` cases are also
re-run with the aggressive tier on (`+A`).

**Counters.** `$uop_cstat 6..25` hold the totals over kept programs. The
run.js report prints them as the `uop stack:` line.

| Counter | Meaning |
|---|---|
| `pushes` | pushes seen |
| `matched` | push/pop pairs matched |
| `elided` | pairs elided |
| `plain` | elided pairs with no memory access between; the conservative "any stack access blocks" rule would have elided these |
| `rescued` | elided pairs with some access between (= elided - plain); broken down as `other-slot`, `fwd-read`, `fwd-write` |
| `unknown-addr` … `list-full` | matched pairs that were materialized, by reason |

## 13. Trace heads: `--uop-trace-heads` (opt-in, 2026-09-28)

**What it is.** This is §11.3 idea A. A hot head with no back edge used to
decline as `no-backedge`. With `--uop-trace-heads` (or `?uop-trace-heads`,
or `set_uop_trace_heads(1)`), `$uc_form_loop` instead calls
`$uc_form_trace` (07e). That function works in three steps.

1. **BFS.** It walks the supported successors from the head, up to
   `$uc_trace_max` (160) instructions.
2. **Trim.** It drops every non-branch member whose successor is outside
   the trace, repeating until nothing changes. A trace therefore leaves
   only through a branch, exactly like a loop.
3. **Minimum size.** It keeps the trace only if at least `$uc_trace_min` (8)
   instructions remain.

The trim step is what keeps a trace off `$logical_frame_addr`.

- A fall-through into the marker block ends a threaded block, because
  `$fuse_stop` cuts it there.
- A trace that ran through that seam put the block clock out of step (the
  `trace-logical` case). The same case also showed that the marker is
  always reached threaded.

The remaining pieces:

- `$uc_is_trace` is recorded in the census event, and `tools/uop-census.js`
  prints `(traces: N)`.
- `uop_cstat 26` counts the traces formed.
- `set_uop_trace_limits(min,max)` tunes both limits.

**Enter path.** `$th_uop_enter` also got cheaper.

- The window epoch is read with a plain load instead of an atomic. Only the
  owning thread bumps it.
- The poor check now runs on side exits only once a program has 256 enters
  with fewer than 2 blocks per enter.

SpiderMonkey Ion, before and after:

| | bytes | instructions | `dmb` | `bl` |
|---|---|---|---|---|
| before | 1120 | 280 | 1 | 3 |
| after | 1144 | 286 | 0 | 2 |

`$uop_run`, `$uop_fast` and `$uop_poor_check` did not change.

**Tests.** `test/test-uop-compiler.js` adds five cases:

- `trace-callee`, `trace-main` and `trace-callchain`: call/ret regions with
  a diamond and a `bsr`.
- `trace-logical`: a marker inside the traced path. It checks that every
  iteration counts one logical frame.
- `loop-logical`: a control loop whose exit falls into the marker.

### A/B

Box8, `tools/uop-game-ab.js`, `--jobs=2`, user CPU, interleaved.
Each figure is the mean of two runs.

**Base 40c1c484** (before G/H/code-write/x87-predecode):

| game | off / off2 | uop / uop2 | trace / trace2 | trace vs uop | K=16 trace | frames |
|---|---|---|---|---|---|---|
| sc | 28.10 / 27.97 | 16.75 / 16.98 | 16.36 / 16.59 | **−2.3%** (uop band 1.4%) | 17.83 (+8%) | not assessable: off~off2 differ 1.14% |
| diablo | 129.72 / 129.65 | 119.45 / 118.76 | 112.99 / 113.07 | **−5.1%** (band 0.6%) | 114.95 | identical |
| h3 | 83.16 / 82.34 | 73.36 / 73.06 | 63.53 / 63.80 | **−13.0%** (band 0.4%) | 64.49 | identical |
| wc3g | 148.01 / 148.57 | 108.41 / 109.06 | 101.96 / 100.80 | **−6.8%** (band 1.1%) | 113.54 (+12%) | identical |

**Gameplay phase** (uop → trace):

| game | uop | trace |
|---|---|---|
| sc | 0.9 s | 0.9 s |
| diablo | 4.6 s | 4.3 s |
| h3 | 5.05 s | 3.95 s |
| wc3g | 1.65 s | 1.5 s |

`refuop` (the base wasm) matched `uop` to within 1% everywhere, so the
cheaper enter op on its own is neutral.

**Rebased on eca2b53a** (after G no-bump and H quiet-api):

| game | off / off2 | uop / uop2 | trace / trace2 | trace vs uop | gameplay uop → trace | frames |
|---|---|---|---|---|---|---|
| h3 | 73.80 / 73.16 | 61.93 / 61.58 | 55.75 / 55.00 | **−10.3%** (band 1.4%) | 4.7 → 4.55 s | identical |
| diablo | 117.47 / 117.40 | 102.52 / 101.24 | 98.51 / 98.24 | **−3.4%** (band 1.3%) | 4.1 → 3.9 s | identical |

Most of the whole-run win now lands in boot and loading. After G, H3's
gameplay gain dropped from −22% to −3%.

### Counters

**Declines, uop → trace (base run):**

| game | no-backedge | head-unsupported |
|---|---|---|
| diablo | 892 → 480 | – |
| h3 | 1210 → 595 | – |
| wc3g | 8375 → 1978 | 685 → 1398 |

In WC3g, trace heads now reach more heads that open on a call or ret.

**Installs, kills and flushes, uop → trace:**

| game | installs | kills | flushes |
|---|---|---|---|
| sc | 406 → 867 | 36 → 143 | 1 → 3 |
| diablo | 184 → 3371 | 10 → 2491 | 0 → 13 |
| h3 | 236 → 661 | 29 → 60 | 0 → 2 |
| wc3g | 1126 → 3857 | 67 → 255 | 3 → 14 |

Diablo's kills are mostly arena flushes. Its traces are many and short.

**Game-thread instances**, uop → trace:

| game | installs | enters | blocks |
|---|---|---|---|
| sc | 177 → 1205 | 2.44M → 19.5M | 342M → 410M |
| h3 main | 26 → 927 | 9.8M → 33M | 131M → 190M |

**K sweep.** `--block-exec-walk-k=16` (the `tracek16` arm) is worse than
the default everywhere.

- WC3g: 152,400 installs and 590 flushes. Its gameplay phase is back to the
  off arm's 2.3 s.
- SC: 70 flushes.

A lower threshold compiles cold traces, which thrash the arena. K=4 and K=8
would only be worse, and K=64 was not run.

### Verdict

Trace heads win on every game where frames reproduce, and frames are
identical there. SC is the one exception: its −2.3% sits just above its
1.4% band, and its frames do not reproduce even off vs off2.

The feature stays **opt-in** for now, for three reasons:

- The post-G gameplay gain is small.
- Diablo's arena churn (13 flushes) is a cost the next arena-size change
  could turn around.
- Flipping the default is a one-line change (`$uc_trace` initial value) for
  whoever merges.

The recommended next step is to flip the default once one browser
spot-check agrees.

### Default-on decision (post-g2w-fast, 2026-09-28)

This round re-ran the A/B on main 754d307e, which includes the `$g2w`
fast-path inline. It weighted each run toward gameplay, and it added a
correctness sweep and a browser check.

**Method.**

- Tool: `tools/uop-game-ab.js`. Arms `uop` (tier on, trace heads off) and
  `trace` (`--uop-trace-heads`), 3 reps each, interleaved. Each game ran on
  one quiet bench box, one job at a time.
- The **band** is an arm's own (max−min)/mean over its 3 reps; that is the
  same-build null band.
- `--extend=GAME:N` (new) runs N more batches past the route's end and adds
  a `--slice-split` at that end. The route's own `--slice-split` stays, so
  the phases are:
  - phase 0: boot through the route's split;
  - phase 1: the rest of the route;
  - phase 2: the extension (SC, H3 and Diablo have a separate extension
    phase).

  "Gameplay" is the guest-slice seconds of every phase after phase 0.
  Guest seconds are printed to 0.1 s, so a 1.3 s phase cannot resolve
  anything under 8%.
- **user** is the whole run's user CPU.
- **Frames** compare every arm's final PNG against the `uop` arm's.

| game (box, extension) | user uop (band) | user trace (band) | Δ user | gameplay uop (band) | gameplay trace (band) | Δ gameplay | frames |
|---|---|---|---|---|---|---|---|
| sc (box9, +20000) | 50.46 (0.9%) | 50.59 (2.7%) | +0.3% | 5.57 (1.8%) | 5.77 (3.5%) | **+3.6%** | nondeterministic (uop~uop2 1.8%) |
| h3 (box9, +6000) | 109.91 (2.2%) | 101.49 (1.0%) | **−7.7%** | 29.77 (3.4%) | 28.73 (1.4%) | −3.5% | IDENTICAL |
| diablo (box8, +8000) | 274.52 (1.8%) | 268.58 (7.3%) | −2.2% | 34.93 (2.3%) | 32.90 (9.4%) | −5.8% | IDENTICAL |
| diablo (box9, +8000, 2nd set) | 271.28 (1.7%) | 257.95 (1.5%) | **−4.9%** | 34.57 (3.8%) | 31.90 (6.0%) | −7.7% | IDENTICAL |
| wc3g (box8, +40000) | 170.04 (0.4%) | 161.91 (2.8%) | **−4.8%** | 4.50 (0.0%) | 4.37 (4.6%) | −3.0% | IDENTICAL |
| wc3 menu (box9) | | | −3.2% (bands 0.8/0.5%) | 1.97 | 1.90 | −3.6% | IDENTICAL |
| mh3 (box9) | | | −4.6% (bands 0.6/1.2%) | 2.63 | 2.20 | −16.5% | nondeterministic (uop~uop2 ~68%) |
| mh1 (box1) | 10.71 (0.6%) | 10.17 (0.4%) | **−5.1%** | 1.30 (0.0%) | 1.20 (0.0%) | −7.7% | nondeterministic (uop~uop2 0.9%) |
| mh2 (box1) | 30.68 (0.7%) | 30.79 (6.9%) | +0.4% | 3.53 (2.8%) | 3.60 (8.3%) | +1.9% | IDENTICAL |
| mhw (box1) | 9.87 (0.4%) | 9.38 (1.2%) | **−5.0%** | 1.37 (7.3%) | 1.10 (0.0%) | −19.5% | nondeterministic (uop~uop2 18%) |
| h2 (box1) | 2.15 (0.9%) | 2.02 (2.0%) | **−5.7%** | 0.70 | 0.60 | (too short) | IDENTICAL |
| diablo_demo (box1) | 17.34 (7.4%) | 16.34 (1.3%) | −5.7% | 0.77 (boot) | 0.50 (boot) | (no gameplay phase) | IDENTICAL |
| d2 (box1) | 30.56 (4.6%) | 30.59 (0.9%) | +0.1% | — | — | — | 06-rogue-encampment differs in every arm, uop~uop2 included |

The bold Δ user values are outside both arms' bands. Diablo has two sets
on two boxes. The box8 set has a wide trace band because trace3 was an
outlier at 279.67 s; the box9 set is tight. Its numbers are never compared
across boxes.

**What the table says.**

- Trace heads cost whole-run CPU on no game. Ten of thirteen rows are
  faster, and eight of those by more than both bands. The three that are
  not faster are
  sc (+0.3%), mh2 (+0.4%) and d2 (+0.1%), all inside their bands.
- **SC gameplay is the one out-of-band loss** (+3.6%): uop 5.5–5.6 s,
  trace 5.7–5.9 s. SC frames are nondeterministic headless, even uop vs
  uop2, so it has no frame check. Its census shows 70 code-write kills in
  the trace arm (`0x7c6000de` ×36, `0x7ef60858`/`898` ×13), 3 flushes and
  389 traces.

**Churn (Diablo).** Only the trace arm churns.

| arm | compiles | kills | flushes |
|---|---|---|---|
| trace | 3353 | 2415 | 13 |
| uop | 212 | 14 | 0 |

The `--uop-census` kind-3 records (code-write kills) show why:

- 2364 of the kills fall on 19 heads at `0xc374ec..0xc3764c` (`0xc374ec`
  ×957, `0xc375fc` ×536, `0xc3763c` ×211) and `0x7ec687e8` ×297.
- Every one of those writes lands on the same byte, `0xc376ed`. That is a
  blitter which patches an operand in its own code before each call.
- Each killed trace ran about 60 times before the next write killed it, so
  71.5% of all compiles are recompiles of a head that was just killed.
- This is **boot/menu only**. The unextended run already has 2491 kills,
  and the gameplay extension has 2 decodes in total, so the churn stops
  before gameplay.
- The loop-only tier never compiles those heads at all (no back edge), and
  so it never churns.

**Knob tried: `--uop-cw-dead=N` (not committed).**

- What it does: when a code write kills a program that had run fewer than
  N times, the head also gets a dead mark in the verdict map, so it is not
  compiled again.
- Result on box9 at N=256, 3 reps interleaved with the arms above:
  - It set 14 marks and cut Diablo's churn to 574 compiles, 73 kills and
    1 flush.
  - CPU did not move: user 257.66 s (band 1.0%) vs trace 257.95 s (−0.1%);
    gameplay 31.33 s vs 31.90 s (−1.8%, inside trace's 6.0% band).
  - Frames were identical.
- So the churn is cheap. The recompiles cost less than the noise, and the
  trace arm still wins over uop. The knob was not committed.

**Correctness sweep.**

- Setup: `tools/block-exec-sweep.js --flag=uop-trace-heads
  --stats-flag=branch-clock --budgets=1000,2000 --batch-size=50000
  --control` over 59 apps, on box1.
  - The apps: aoe1, atomic_bomberman_june_demo, blobby_volley, bricks,
    caesar3_demo, calc, captain_claw_demo, cave_story, civ2_mge, cruel,
    darkstone_demo, dx_boids, dx_ddex3, dx_donut, dx_globe, dx_stretch,
    dxball, elasto_mania, fallout_demo, far_manager_170, fourstones,
    freecell, funtris, golf, gta2_demo, heroes2_demo, icewind_dale_demo,
    icy_tower, jardinains, jazz2_demo, little_fighter_2, mirc59, moorhuhn,
    moorhuhn_2, mspaint, nethack_win32, notepad, peaks, pegged,
    pocket_tanks, rct, reversi, scr_architec, scr_geometry, scr_scifi,
    simgolf_demo, ski32, snake, sol, sol16, taipei, tetravex, tictac,
    wep16_chess, winamp, winamp_mod, winmine, winrar_310, worms2_demo.
  - The tier is on in both arms. The only difference between them is
    trace heads.
- Result: **57 IDENTICAL, 1 DIFFERENT, 1 NOPIC, 0 CRASH, 0 NONDET.**
  Many rows formed hundreds of traces: darkstone 483, jardinains 454,
  fallout 316, captain_claw 315.
- **The sweep needs `--branch-clock`.** An earlier pass without it (budgets
  400/800) reported dx_boids, dx_globe, fallout, heroes2 and scr_geometry
  as DIFFERENT. All five were clock artifacts: a tier config changes block
  counts, and the block count is the clock.
- **captain_claw_demo (DIFFERENT)** is not caused by trace heads.
  - Its off-vs-off control is identical, and trace vs trace2 is identical.
  - With the uop tier off (`--no-uop`), the frame also differs from the
    tier-on frame: 1305 px at 100 batches and 4973 px at 1000.
  - The API call count at batch 100 differs between the three
    configurations: 128173 no-uop, 128061 uop, 126866 trace.
  - So the app takes a different path under any change to how its blocks
    are grouped. The difference was there before trace heads, and each
    configuration is deterministic on its own.
  - Repro: `node test/run.js --app=captain_claw_demo --batch-size=50000
    --max-batches=1000 --branch-clock --wall-clock-ms=1789000000000
    --quiet-api --no-close --png=a.png [--no-uop | --uop-trace-heads]`.
- civ2_mge's NOPIC happens in both arms: it has no picture on this box.

**Browser.** On box3, with headless Chrome 152,
`WA_QUERY='?uop-trace-heads' node test/test-diablo-shareware-browser-web.js`
reached all six stages: intro, title, menu, character select, loading and
gameplay. The HUD orbs were present (`red:1641, blue:228`), and the test
printed PASS. The test's new `WA_QUERY` variable appends a query string to
the page URL.

**Verdict: flip the default on.**

- Trace heads lower whole-run CPU on ten of thirteen rows, and on no route
  do they raise it outside the band.
- Every frame that reproduces is identical.
- The 59-app sweep found no trace-specific difference.
- Diablo's churn is real but is limited to boot, and the gameplay phase
  still gains.
- The one cost is SC's gameplay phase, +3.6% just outside its band. That is
  a lead for the next round (its 70 code-write kills and 3 flushes), not a
  reason to hold back gains of 3–8% elsewhere.

The off switches are `--no-uop-trace-heads` and `?no-uop-trace-heads`.
`uop-game-ab.js`'s new `notrace` arm uses the CLI switch.

## 14. Windows and VirtualAlloc contiguity: measured, then widened (2026-09-28)

The question was whether guaranteeing each VirtualAlloc reservation's backing
as one contiguous wasm run (or compacting the pool now and then) would speed
the tier up. `--uop-win-census` (test/runner-win-census.js) counts every
window proof by memory class and failure reason, classifies each re-guard
against its slot's previous window, counts sparse `$g2w_affine_span`
fallbacks, and reads VIRTUAL_MAP_TABLE / VIRTUAL_RESERVE_TABLE at exit. One
run per game on the bench box, `tools/uop-game-ab.js` routes, main instance.

**What it found.** The GUARD op never fires in these games; every window is a
one-page `$uop_reguard`, so non-adjacent backing causes *zero* window
failures or exits. Bulk-path non-adjacent fallbacks: StarCraft 105 of 2.24M,
Warcraft III 5,006 of 5.17M, none elsewhere.

| game | re-guards | per enter | direct / DIB / sparse | in previous window's affine run | only if backing were contiguous |
|---|---|---|---|---|---|
| StarCraft | 3.36M | 1.8 | 55% / 0.03% / 44.5% | direct 87%, sparse 54.7% | 221K (6.6% of all) |
| Heroes III | 13.5M | 2.4 | 56% / 22.5% / 21% | DIB 100%, direct 70%, sparse 16.7% | 0.3% of sparse |
| Moorhuhn 3 | 23.8M | 4.9 | 98.9% / - / 1% | direct 99% | - |
| Diablo | 147M | 1.46 | 5% / - / 95% | sparse 99.98% | 0.007% |
| Warcraft III | 32.4M | 2.0 | 35% / - / 63% | direct 94.6%, sparse 24% | 2.45M (7.6% of all) |

The allocator is not fragmented: every commit is one contiguous extent
(best-fit hole, else bump, else gap scan, then the extension window, then
64KB-granule splits); non-adjacency inside a reservation comes only from
separate commits interleaved with other allocations (StarCraft commits 4KB
~13,700 times; Warcraft III has 64KB reservations committed as sixteen 4KB
records). At exit 61-62% of committed reservations are one affine run, but
the pool is nearly all wilderness: StarCraft 24MB used, 291.8MB largest free
run, no holes; Warcraft III 88.7MB used, 227.2 of 227.3MB free in one run.

So the lever is window width, not contiguity. `$uop_reguard` now widens a
re-guard to the 64KB-aligned block around the missed page
(`$uop_reguard_wide`; `--uop-reguard-span=N` sets the block, 4096 restores
one page): the whole block in one `$g2w_affine_span` plus one 16-bit load of
the code-page bitmap (the block's sixteen slots are one aligned group), else
page-by-page growth that stops at a non-adjacent/unmapped page or, for a
store window, a code page. Every page it covers is proved as
`$uop_window_set` proves one, so the epoch rules are unchanged.
`uop_stats` 14/15 are pages the widening proved and growth stops at a
non-adjacent page.

| game | re-guards one-page -> widened | user CPU widened vs one-page (2 x 2 interleaved, box2) |
|---|---|---|
| Diablo | 147.2M -> 1.46M | -2.1% (null 0.45%); rerun -3.4% (null 2-4%) |
| Moorhuhn 3 | 23.8M -> 5.6M | -1.3% (null 0.9%) |
| Heroes III | 13.5M -> 5.9M | -0.6% (null 1.3%) |
| StarCraft | 3.36M -> 1.36M | +0.3% (null 1.4%) |
| Warcraft III | 32.4M -> 21.5M | 0.0% (null 1.8%) |

Frames identical on Diablo, Heroes III and Warcraft III; StarCraft and
Moorhuhn 3 differ between two runs of the same arm by as much as between
arms. A first version that grew page by page for every re-guard was +1.1%
on Warcraft III and +2.2% on Moorhuhn 3 (87.7M page proofs replacing 23.8M
re-guards); the block fast path is what made it neutral there.

**Verdict on contiguity.** Only after widening does contiguity reach
anything, and then only Warcraft III's growth stops at non-adjacent pages
(8.97M) and StarCraft's (138K). Warcraft III's 34% re-guard cut from
widening moved its CPU by 0.0%, so the smaller cut contiguity could add is
below the null band. A contiguous-commit guarantee is not worth building,
and a compacting defragmenter less so: moving backing at a safe point would
have to cover every holder of a raw wasm address into sparse backing --
uop windows (covered: the move rewrites PTEs, which bumps
`$UOP_WIN_EPOCH`); native shader allocations and the software D3D raster,
which retain wasm pointers (`$w2g_sparse` exists to map them back); GL/DX
client arrays and locked buffers and the audio mixer reading guest PCM
between batches; JS-side typed-array views and cached offsets; the D3DIM
render worker and every guest thread's Worker running concurrently on the
shared memory (no stop-the-world protocol exists, so a main-thread safe
point does not cover them); and in-flight host calls/thread RPCs carrying a
wasm pointer. None of those has a relocation hook today.

## 15. Call forms by runtime weight: no inline-cache ceiling (2026-09-29)

The static census (`tools/call-form-census.js`) said jgl.dll is 48% vtable
calls, Game.dll 11%, H3 3.7%. That is reach. The question for a better
vtable inline cache (vptr guard hoisted out of the loop, call out into
threaded code on a miss instead of exiting, 2-4 entry polymorphic cache) is
how much *execution* sits at those sites, so it was measured by weight:
`test/run.js --handler-hist --handler-hist-thread=0,0,0 --edge-hist
--hist-json=F --hist-json-blocks=0 --uop-census`, read with
`tools/call-form-weighted.js <windows> --exe= --pe-dir= --log=`.
`--edge-hist` (new) records every (previous block, next block) transfer in the
window into the borrowed 1MB handler-pair matrix, which is what counts an
indirect site's distinct targets. The tool decodes each hot block's exit
instruction, splits indirect exits into host API and guest targets (IAT import
DLL, else the edge successor), and weights uop-census verdicts by block entries.
All percentages below are of **all** block entries, threaded plus inside uop
programs. There are three windows per app, and they agree to within 0.1pp
unless a range is shown.

| app (window) | in uop programs | guest-target indirect | of which vtable/reg calls | sites with 2-4 targets | loops declined for call-indirect: head / whole loop body |
|---|---|---|---|---|---|
| SimGolf gameplay (2500..4000, golfers walking) | 74.2% | 0.21% | 0.19% | 0 | 0.04% / 0.41-0.51% |
| WC3 Prologue HUD (19170..21530, wc3g route) | 58.3-60.2% | 0.95-0.98% | 0.61-0.64% | 0.21-0.24% | 0.42-0.49% / 2.9-3.6% |
| Heroes III adventure map (4100..5101, h3 route) | 87.2-89.7% | 0.00-0.01% | 0.00-0.01% | ~0.005% (0x58cd32, 6 targets) | 0.03% / 0.05-0.07% |

Every indirect guest site hot enough to list is monomorphic, apart from a few
exceptions:

- WC3 `game.dll+0x6f203b33 call eax`, 0.06%, 4 targets split 46/23/23/8.
- WC3 `game.dll+0x6f082159 call [edx+0x20]`, 0.03%, 90% one target.
- WC3 `game.dll+0x6f4278fc jmp [abs]`, 0.04%. It hit 61-72 targets because it
  is an import stub, a tail call.
- H3's known `0x58cd32`, 0.01%, 6 targets.

The largest single WC3 guest vtable call is 0.05% of entries.

SimGolf's jgl.dll is 48% vtable calls statically, but only 0.19% of block
entries end at one at runtime. Its hot code is per-pixel loops with no calls
in them.

**Verdict.** None of the three reaches the 3% bar:

- **(a) Guard and hoist.** At most 0.64% of entries (WC3) end at a guest
  vtable or register call. Hoisting helps only the fraction of those that sit
  inside a uop loop.
- **(b) Call-out on a miss.** The loops a call-out would let the tier keep
  are 2.9-3.6% of WC3's entries, measured as the head's SCC in the edge
  graph within +-4KB, which is an upper bound. That is the only
  near-threshold number, and `--uop-icall` already ran WC3g's 40 guarded
  sites (2.64M passes) with a neutral A/B. SimGolf's figure is 0.5% and H3's
  is 0.07%.
- **(c) Polymorphic cache.** It could add at most 0.24% of entries over a
  monomorphic guard.

So indirect calls are not where the threaded remainder lives. By verdict
share of all entries it lives in:

- WC3: blocks that never became a head (no-verdict, 24-26%: call-return
  landings and fallthroughs inside called functions) and `no-backedge`
  (5.5-6.5%).
- SimGolf: one loop the tier cannot enter (below).
- H3: `poor` programs (2.9-3.6%) and `head-unsupported` (1.4-1.7%).

H3's biggest threaded exit is a switch, not a call:
`exe+0x47227c jmp [0x472a9c+ecx*4]` is 1.3% of all entries and always takes
the same arm.

**SimGolf: the gap is `adc r32,[m32]`, not calls.** 79.5% of SimGolf's
*threaded* block entries, which is 20% of all its entries, are one loop:
jgl.dll's scaled colour-key/shadow blitter at `0x100180df..0x1001811a`. Its
step is `add dx,bx` / `adc esi,[0x10062e58]`, a 16.16 fixed-point source
advance. The scan stops at `adc` (form 0x13, `adc r32, r/m32`):

- `0x10018108` declines `no-backedge` behind it, weight 28.5M entries in one
  500-batch window.
- The head `0x100180df` installs a program that exits at `0x10018108` every
  pixel, 1.5 blocks per entry, and is retired `poor`.

Supporting `adc r32,m32` with the carry from an o16 add is the next SimGolf
lever. It lives in the uop compiler, not the call path.

### 15.1 The rest of the C++ and runtime-heavy corpus (2026-09-29)

The same measurement was run on the Unreal family, GoldSrc, Arcanum, the
Infinity engine, Morrowind, ScummVM, Delphi and VB6. It asked whether any app
class has hot indirect calls. Boxes 1 and 2 ran the heavy apps and the laptop
ran the small ones. Every row is three windows of
`--handler-hist-thread=0,0,0 --edge-hist --hist-json-blocks=0 --uop-census`,
read with the fixed `tools/call-form-weighted.js` (below). All shares are of
**all** block entries.

| app (window, what it shows) | in uop programs | guest-target indirect | vtable/reg calls | monomorphic | declined for call-indirect: head / loop body |
|---|---|---|---|---|---|
| Unreal SE (900..1800, Nyleve flyby, SoftDrv) | 43-50% | 0.79-0.96% | 0.18-0.26% | 0.54-0.73% | 0.38-0.64% / 2.2-4.7% |
| Deus Ex demo (450..800, in-engine 3D logo, SoftDrv) | 22-26% | 2.50-3.02% | 0.71-0.76% | 1.8-2.5% | 2.3-2.8% / 4.9-6.0% |
| UT2003 demo (70..520, **package load**, stalls at the first D3D8 draw) | 42-55% | 5.2-8.3% | 2.0-5.2% | 4.0-5.0% | 1.1-7.3% / 2.4-16.6% |
| UT2004 demo (600..2100, **package load**, same stall) | 54-68% | 4.5-8.4% | 3.7-6.6% | 3.1-4.7% | 3.4-10.4% / 3.4-9.7% |
| Half-Life Uplink (100k..160k, corridor, walking and turning) | 71-87% | 0.09-0.26% | 0.01-0.04% | 0.02-0.06% | 0.4-1.1% / 2.3-5.6% |
| Arcanum demo (45k..54k, crash site, HUD, idle NPCs) | 58-59% | 0.23-0.28% | 0.23-0.28% | 0.11-0.16% | 0.07-0.09% / 0.3-0.5% |
| Morrowind (13.0M..13.6M, prison-ship hold under the chargen Name box, software D3D9) | 40.5-40.7% | **5.5-5.6%** | 5.0-5.1% | 4.5-4.6% | 6.6-6.7% / **11.0-11.3%** |
| Icewind Dale demo (6000..6600, Easthaven tavern, walking) | 76-77% | 0.68-0.70% | 0.68-0.70% | 0.63-0.65% | 0.7% / 1.3-1.4% |
| ScummVM 2.0 FOTAQ (12200..16000, room, idle) | 94% | 0.57% | 0.17% | 0.55% | 0.15% / 0.16% |
| Blobby Volley, Delphi (700..900, live rally) | 38% | **7.2%** | **7.2%** | **7.2%** | 7.1% / 0 (not loops) |
| Rodent2000, VB6 native (3000..4400, level 1 played) | 20-24% | 3.7% | 3.2-3.3% | 3.1% | 2.1-2.2% / 1.1% |

Not measured:

- **Baldur's Gate.** Its assets are on no machine.
- **UT2003 and UT2004 gameplay.** With `--d3d9-renderer=software`, the first
  `IDirect3DDevice8_DrawIndexedPrimitive` never returns on this tree. The
  window stays grey. `--headless-gl` needs a display, and box1 has none. So
  their rows describe loading scripts and packages.
- **JigSawedME (VB6).** It spins inside one batch on a repeated access
  violation that returns to `msvbvm60+0x66006554`.
- **FOTAQ with the mouse.** Any click crashes on the unimplemented
  `GetMessageExtraInfo`, which SDL2 calls on mouse messages. So the Queen
  script VM was never measured hot.
- **Tetravex.** It goes idle once it has drawn.

**No megamorphic dispatch site anywhere.** The sites with most targets are all
tiny:

- Unreal `engine+0x1037a430 jmp [0x1037f4ec]`: 36-47 targets, 0.02-0.03%.
- Unreal `render+0x1081cf80 jmp [0x1081e228]`: 16 targets.
- Unreal `core+0x10115aa0 call [tbl+eax*4]`: 14-15 targets.
- Deus Ex `core+0x1013fa40 call [0x101f4088+eax*4]`, the UnrealScript native
  table: 18 targets, 0.16%.
- UT2003 `core+0x1011679a jmp [tbl+edx*4]`: 26-28 targets.
- UE2's bytecode loader `UStruct::SerializeExpr` (`core+0x1011d330`): a 24-28
  way `jmp [0x1011d9f4+edx*4]` token switch, plus a monomorphic self-recursive
  `call [edx+0x98]`.

None of these is above 0.4% of entries. The script interpreters are either not
hot in the reachable windows (UnrealScript during a flyby, FOTAQ idle), or they
spend their entries in their bodies, not at the dispatch.

**Where the indirect share is highest, it is monomorphic.**

- **Blobby (7.2%)** is VCL:
  - `exe+0x4158b3 call [edx+0x10]` (4.7%, 1 target) is `TCanvas.GetHandle`
    calling its virtual `Changing`, twice per BitBlt in the sprite loop.
  - `exe+0x415a03 call [ebx+0x30]` (2.4%, 1 target) is the `TNotifyEvent`
    `FOnChanging(Self)` method-pointer call.
  - They are function entries, not loop heads, so the tier loses no loop to
    them.
- **UE2 load (4-8%)** is `FArchive::Serialize` through `call [eax+4]`, with
  1-3 targets per site.
- **VB6 (3.7%)** is COM `call [r+8]` Release/AddRef in msvbvm60, 3 targets at
  most.

A monomorphic inline cache (`--uop-icall`) is the right shape for all of
these. The ceiling is small, though:

- Blobby is a 38%-uop app that spends 20% of its entries at `call rel32` and
  18% at `ret`. The two virtual calls only matter if the tier ever runs the
  sprite loop around them.
- UE2's is a load phase.

**Morrowind is the one frame loop where a call-indirect ceiling reaches the
3% bar.** Its guest indirect transfers are spread thin, but they lose it
loops:

- About 115 sites, the top one at 0.68%: `exe+0x6f38d0 call [esp+0x2c]`, a
  float interval-overlap callback with one target.
- `exe+0x69a097 call [edx+0x8]`, 0.51%, one target.

The loops declined for call-indirect hold 11.0-11.3% of all entries. The
largest is msvcrt `qsort` (`0x7801ed9a..0x7801ee6f`, 42 blocks, 3.9-4.0%). Its
comparator call `call [ebp+0x14]` (three sites) splits exactly 1/3 each over
three per-axis float comparators, `exe+0x6e9710/0x6e9750/0x6e9790`, which looks
like a sweep-and-prune sort.

That comparator site is polymorphic per site, but **each qsort invocation is
monomorphic**: the comparator is a qsort argument, fixed for the whole sort. So
the right mechanism is a guard hoisted to loop entry (or a program specialised
on the comparator), then a call-out into the comparator. A per-site
polymorphic cache is not what it needs. The ceiling is ~4% of entries for
qsort and ~11% for all such loops.

Two caveats: the window is one frame under a modal box, not free roam, and the
chargen Name box takes no input on software D3D9. The load-phase windows
(`morrowind.esm`, 5.0-6.2M) had 2.4-3.3% guest indirect, mostly
`exe+0x4d11c7 call [edx+0xe8]` (1.6%, monomorphic).

**Unreal-1 IAT traffic into core.dll is real but small.**

- **Deus Ex:** `call [abs] -> guest` is 1.4-1.9%. Five hot `call [IAT]` calls
  in one `render.dll+0x10b0baff` loop go to core.dll FVector operators, at
  0.22-0.30% each, all monomorphic. Every one lands on an incremental-link
  `jmp rel32` thunk in core.dll, so each costs an indirect hop *and* a
  `jmp rel` block. That loop (1.4-2.1% of entries) is the biggest gameplay
  loop in the table lost to a *guest* indirect call.
- **Unreal SE:** `call [abs] -> guest` is 0.25-0.30%.

IAT-direct (resolve the slot at decode time and follow the thunk) would be
worth at most ~2% of Deus Ex entries.

**Half-Life's 2-6% declined loop bodies are host calls, not guest ones.** The
heads are `hw.dll+0x1000a8f1/a85d/a869`. They are GoldSrc's per-vertex
immediate-mode loop: three `call [qgl slot]` per vertex into
GetProcAddress-filled GL pointers, and the tool counts those as api. The lever
there is the tier calling a host API from inside a program. A guest inline
cache would not help.

**What the threaded remainder is instead.**

- **Unreal-1 on SoftDrv:** `head-unsupported` is 24-28% of all entries on
  Unreal SE, and 60% of the entries the tier did not take on Deus Ex. The
  refused ops are MMX: `movq [edi],mm0` fill loops (`softdrv+0x10d3ed70` alone
  is 24.6% of Deus Ex entries), `pxor`, `pmulhw mm0,[edx+eax*8]` and `psraw`.
  MMX in the uop compiler is the Unreal-1 lever, the way `adc` is SimGolf's.
- **Arcanum:** `declined:no-backedge` is 16.4-16.7% and no-verdict is 9%.
  jcc/call/ret-heavy straight-line code, plus five small CRT and game switch
  tables at 0.1-0.4% each, among them the CRT `_output` state machine at
  `exe+0x5789a2`.

**Verdict for the corpus.** No app class makes indirect calls both hot and
polymorphic:

- **(a) Inline cache.** Its ceiling is Blobby's 7.2% of entries, which is
  function-entry calls in a mostly threaded app, Morrowind's 5.5%, and UE2's
  loading phase at 4-8%.
- **(c) Polymorphic cache.** It adds under 0.5% anywhere over a monomorphic
  guard. Morrowind's 3-way qsort comparator (~0.7% of entries at the call) is
  monomorphic per invocation, so a guard hoisted to loop entry covers it.
- **(b) Call-out.** This is the only mechanism with a gameplay ceiling over
  3%, and only on **Morrowind**: 11% of entries in loops declined for
  call-indirect, ~4% of them in msvcrt `qsort`. Everywhere else it is 0.2-6%
  in gameplay. Its largest body overall is UT2003 load, at 13-17%. That
  number is dominated by msvcr70's `_getptd` (`0x7c00137f/0x7c00139f`:
  GetLastError, TlsGetValue and SetLastError through the kernel32 IAT), which
  is reached from every CRT call the loader loops make. So even there the
  declined calls are host APIs; the lever would be calling APIs from inside a
  program, as in Half-Life. In gameplay it is 2-6%.
- **Jump-table op.** It has no window above 1.3%, Arcanum included.
- **IAT-direct.** At most ~2% (Deus Ex).

Only one of these is a gameplay lever on this corpus: call-out with an
entry-hoisted guard, for Morrowind. It is worth measuring there first with
`--uop-icall` on the qsort loop. Otherwise the measured gameplay levers are
opcode coverage in the uop compiler: MMX for Unreal-1/SoftDrv, and `adc` for
SimGolf (§15).

Tool fixes made for this round (`tools/call-form-weighted.js`):

- An indirect target outside every module now counts as guest `anon:` code
  when it ran as a block. This covers VB6's per-object heap thunks behind
  msvbvm60's `jmp [eax+edx]`, and Galaxy's generated mixer called through
  `galaxy+0x105085d2 call [0x1054c260]`. Both used to read as api.
- `call/jmp [abs]` through a slot that is not in an IAT is now labelled
  `[global]`. It is a code pointer in a writable global, which is not an
  import stub.
- The declined-loop body total is taken over the **union** of the heads'
  SCCs. UT2003 had read 120%.
- A one-block SCC with no self edge no longer counts as a loop.
- A slot into a loaded DLL whose export the emulator overrides natively is
  now api. The edges show control never entered the DLL (msvcrt `_ftol`
  through `jmp [0x738264]` had read as guest with 24-27 "targets", which were
  the callers' return sites).

Artifacts: box1 `~/cf2-out/<app>/` and box2 `~/cf2-out/<app>/`, each holding
run logs, windows and PNGs. Box2 `~/cf2` is a tree at e4dddd7d.

### 15.2 adc/sbb lowered, with memory operands (2026-09-29)

**What lowers now.** Kind 20 used to be sbb only. It is now adc and sbb,
32-bit, in every form the decoder has:

- `11/13/19/1B` r/m forms, with memory on either side;
- `15/1D` eAX,imm;
- `81/83 /2 /3` with a register or memory destination.

8- and 16-bit adc/sbb still decline. The 16-bit `add dx,bx` before the
blitter's adc was already supported, and `$uc_cf_into` has a recipe for its
carry.

**Flags.** The record matches `$do_alu32` and the `th_adc_*`/`th_sbb_*`
handlers bit for bit:

- adc records `set_flags_add(a, b+CF, r)`. When `b+CF` wraps, it uses raw
  mode instead: `flag_op` 8, `flag_a` 1, `flag_b` 0, `flag_res` r. That is a
  different op, so it takes two RECs behind a BNZL/GOTO layout branch.
- sbb records `set_flags_sub` with the `flag_a` 0 / `flag_b` 1 fix-up, done
  arithmetically.

**Store before the record.** A memory destination is now stored *before*
the REC. A store that deopts re-executes the instruction threaded from its
entry state. With CF coming from the globals ('G'), a record that was already
written would hand that re-execution the wrong carry. The old sbb code wrote
the record first, so this was a latent bug.

**Tests.** New `test/test-uop-compiler.js` cases, each checked against the
threaded path:

- `adc-forms`: carry-in 0 and 1, carry-out and OF via jb/jl.
- `adc-sbb-chain`: 64-bit style chains through a memory destination.
- `adc-scale-blit`: SimGolf's `add dx,bx / adc esi,[abs]` step.
- `adc-guard-fail`: an `adc [edi],eax` sweep whose written window runs onto
  the code page. The re-guard refuses it, and the deopt path must leave
  memory, registers and flags identical to the threaded run.

**The record skip, and a Heroes III regression it caused.** The first cut
skipped the kind-20 REC whenever `$uc_live_out` said the flags were dead,
as kinds 18 and 25 already do. That broke Heroes III under `--branch-clock`:

- the uop frame came out 99.97% off the reference;
- the game made a NULL call at batch 3651 (`dbg_prev_eip=0x0059a7b2`) and
  ran only 3652 of 5101 batches.

It was deterministic across uop/uop2. Bisected on box 3:

| variant | H3 frame vs reference |
|---|---|
| adc rejected, sbb still skipping | DIFF, same crash |
| adc accepted, record always written | IDENTICAL, uop counters equal to the reference to the unit |

So the culprit is the *sbb* skip. H3 compiles no program containing an adc:
its counters with adc accepted equal the reference exactly. Some
observer of the globals is not a consumer in `$uc_liveness`, and a 'G'
producer is the only kind whose skipped record nothing re-materializes. It
was not found.

A narrower skip was tried next (ab66e8b3): skip only when the single
successor is an in-loop register alu/test/neg with no branch, seam or cut.
It broke H3 identically, with the same counters to the unit. So even "the
next instruction overwrites every flag and cannot exit first" is observable
somewhere. The kind-20 record is now written **every** time (856774d5). This
is the configuration shown identical to the reference.

**Resolved: the skip was never the bug.** Nothing reads those globals. The
skip only changed program sizes, and that was enough to hit the arena-reuse
bug that 553db124 fixed ("never enter a freed program"). Bisected on box 1
with the original 17d31c31 skip compiler dropped into each tree (H3,
`--branch-clock`, uop arm):

| tree | 07e | H3 result |
|---|---|---|
| 8e534d4f | skip | NULL call at 3651, 3652 batches |
| 1b5655cf | skip | NULL call at 3651, 3652 batches |
| 1b5655cf | its own (always writes) | 5101 batches |
| 553db124 (only 07d changed) | skip | 5101 batches |

On the 2026-09-29 main, the kind-20 skip re-enabled gives an H3 frame
identical to off, and so does the pre-553db124 07d with the same main. The
second result is consistent too: a different layout does not forge the
header.

Two checks came back clean for kinds 18 and 25:

- **Reading the code.** No liveness hole turned up. CL=0 keeps the old
  flags, but the skip is taken only when nothing after the shift reads them,
  so no hole there. mul's record is only CF/OF. The overwriting instruction's
  own exits count as consumers of the state *before* it.
- **Instrumented run.** `$uc_step` marks a skipped class-3 record **D**
  (dead) instead of G (`$uc_rec_skip`). Any consumer the liveness pass
  missed would then decline rather than read an older record. On H3 and SC,
  with and without `--uop-muldiv`, the uop counters are equal to the unit
  with G marking. The unit suite is unchanged too (274 compiled / 97
  declined).

The D marking stays as hardening. Kind 20 still writes its record every
time: re-enabling the skip is frame-safe, but has not been measured to save
anything.

**SimGolf.** Census window 2500..4000, box 3. Counts are load-immune.

| | base e4dddd7d | adc (856774d5) |
|---|---|---|
| uop share of all block entries | 77.05 / 74.23 / 74.32% | **94.30 / 94.60 / 94.65%** |
| threaded block entries per 500 batches | 46.7M / 52.5M / 52.4M | 11.6M / 11.0M / 10.9M |

- The blitter head `jgl+0x100180df` is now a live 31-insn program: 4710 blocks
  per entry, 158.9M blocks in the window.
- `jgl+0x10018108` is live too, at 3117 blocks per entry.
- Before the change, the head was retired poor with an exit at `0x10018108`
  every pixel, and `0x10018108` itself declined no-backedge.
- The largest decline left is `mul8` at `jgl+0x100153ed`: 0.3M entries, or
  0.15%.
- Otherwise the remaining threaded entries are exe call/ret chains, with no
  verdict or declined `no-backedge`.

#### A/B timing (box 3, load ~1, build 856774d5, `tools/uop-game-ab.js --branch-clock --jobs=1`)

Reference arms run the e4dddd7d wasm (`--ref-wasm`), which has no adc
lowering. Each build is run twice (uop/uop2, refuop/refuop2), and that
repeat is the null band.

| game | frames | uop / uop2 user | refuop / refuop2 user | gameplay phase (uop vs ref) |
|---|---|---|---|---|
| sg (SimGolf, split 2500) | IDENTICAL x4 | 20.85 / 21.53s | 23.10 / 23.56s | 1.3 / 1.4s vs 1.9 / 2.0s |
| h3 | IDENTICAL x4 | 54.93 / 54.59s | 55.74 / 55.85s | 4.8 / 4.8s vs 4.9 / 5.0s |
| wc3g, run 1 | IDENTICAL x4 | 100.68 / 96.11s | 93.62 / 93.01s | 1.9 / 1.7s vs 1.7 / 1.6s |
| wc3g, run 2 (arm order reversed) | IDENTICAL x4 | 92.98 / 93.63s | 92.46 / 93.52s | 1.7 / 1.6s vs 1.7 / 1.7s |

- **SimGolf wins.** Whole-run user CPU is **−10.8%**, against a null band of
  about 3% (uop vs uop2) and 2% (ref vs ref2). The 2500..4000 gameplay phase
  goes from about 1.95s to 1.35s. This is the same window where the uop
  share rose from 74–77% to 94.3–94.65%.
- **H3 is neutral.** It moves −1.5%, within the band, and its counters match
  the reference exactly.
- **WC3g is neutral.** Run 1 showed uop +5% slower, but its uop/uop2 pair
  spread 4.6% on its own. The repeat with the arm order reversed came out
  +0.6% whole-run and 0.0% in the gameplay phase. So run 1 was noise. WC3g
  never executes the new lowering in its hot loops; its install counters
  differ by 3 heads (4154 vs 4157).

The lowering is pure coverage and has no flag. It is on whenever the uop tier
is on (`--no-uop` still turns off the whole tier).

### 15.3 Host API calls inside uop programs: not worth building yet (2026-09-29)

The proposal was to stop exiting a uop program for some host API calls:

- **Tier 1**, inline as micro-ops: GetLastError/SetLastError,
  TlsGetValue/TlsSetValue, GetCurrentThreadId/ProcessId/Thread/Process,
  GetProcessHeap, the Interlocked* family, and uncontended
  Enter/LeaveCriticalSection.
- **Tier 2**, call the WAT handler from inside the program ("hostcall"):
  gl* immediate mode, HeapAlloc/Free/ReAlloc/Size,
  GetTickCount/timeGetTime/QPC (these carry the clock-spin detector caveat),
  and native CRT overrides that run no guest code (`2crt`).
- **Exit**: everything else, meaning anything that runs guest code, yields,
  blocks or switches threads.

The question is how much execution sits behind those calls. It was measured
with `tools/call-form-weighted.js --apis`, reusing the §15 and §15.1
histograms: 11 apps, 3 windows each.

How the tool counts:

- For each API it reports:
  - its call sites' share of **all** block entries;
  - how much of that share lies inside a loop the uop tier declined, split by
    the innermost declined loop's reason;
  - the number of sites;
  - the tier.
- A declined loop is the head's strongly connected component in the edge
  graph, plus every block its calls reach before returning (callee extents).
  Without the extents, the CRT's `_getptd` calls in callees were invisible.
- A loop whose own blocks plus its callees exceed `UC_MAX_LOOP` (400
  instructions) is tagged `>400`. No call lowering would admit such a loop,
  so it is excluded from the "inside declined loops" column and from every
  ceiling.
- The **ceiling** for tier k counts the threaded entries of declined loops
  that meet all of these:
  - they make at least one host call;
  - every host call they make is tier ≤ k;
  - they make no guest indirect call.
- **Strict** counts only loops declined for `call-indirect`. **Loose** also
  counts scan-limit, head-unsupported and no-backedge loops. Loose is
  optimistic, because removing the call does not by itself fix those reasons.

Tool and runtime changes:

- `$win32_dispatch` records a (calling block → thunk) edge when
  `--edge-hist` is on.
- A new `thunk_word` export and `test/run.js` together write
  `thunks {addr: api name}` into the histogram JSON. New runs therefore name
  GetProcAddress and COM targets.
- The existing histograms predate this change, so only calls through an IAT
  slot are named. The rest print as `?call [global]`, `?call r` and so on.
- `--app=ID` takes the PE set from `lib/apps.js`.
- `--merge` builds the tables below.
- `--assume-tier='NAME:T'` bounds a ceiling for a call the histogram cannot
  name.

No new runs were needed, because the bounds below decide the question with
margin.

**Ranked APIs** (max over all windows):

| API | tier | max share of all block entries | max share inside declined loops of ≤400 insns | where |
|---|---|---|---|---|
| `?call [global]` = HL qgl* (glTexCoord2f, glColor4f, glVertex3f, glBegin, glEnd) | 2 (gl) | 1.78% | 0.53% | HL 1.78, UT2004 load 0.53 (msvcr71 `_getptd`'s TlsGetValue via a pointer) |
| `?call [r+d]` (COM/D3D, callbacks) | exit | 0.68% | 0.04% | Morrowind |
| GetLastError | 1 | 0.53% | 0.53% | UT2004 load, UT2003 load 0.16 |
| SetLastError | 1 | 0.53% | 0.53% | UT2004 load, UT2003 load 0.16 |
| `?call r` | exit | 0.49% | 0.21% | HL, UT2004 load 0.13 |
| EnterCriticalSection | 1 | 0.20% | 0.01% | IWD, Morrowind 0.18 |
| LeaveCriticalSection | 1 | 0.20% | 0.01% | IWD, Morrowind 0.18 |
| TlsGetValue | 1 | 0.16% | 0.16% | UT2003 load |
| IntersectRect | exit | 0.11% | 0.00% | IWD |
| GetCurrentThreadId | 1 | 0.09% | 0.00% | Morrowind |
| `_ftol` | 2crt | 0.07% | 0.00% | Unreal SE |

Nothing else reaches 0.05%. That includes Heap*, the clock reads and every
other CRT export.

The HL names were resolved statically:

- The hot `hw.dll+0x1000a8b8..0x1000e1ca` sites call through
  `0x1068a4fc` = glTexCoord2f, `0x10689c24` = glColor4f,
  `0x1068a39c` = glVertex3f, `0x1068a4a0` = glBegin and
  `0x10689c64` = glEnd.
- Each slot is filled at a `push "glXxx"; call [GetProcAddress]; mov [slot],eax`
  site, e.g. `hw.dll+0x10047b6a`.

**Per-app ceilings** (share of all block entries):

| app (windows) | API calls | tier-1 calls | tier-2 calls | tier-1 ceiling strict / loose | tier-1+2 ceiling strict / loose |
|---|---|---|---|---|---|
| SimGolf gameplay (2500..4000) | 0.03% | 0.00% | 0.00% | 0 / 0 | 0 / 0 |
| WC3 Prologue HUD | 0.56-0.58% | 0.10% | 0.24-0.25% | 0 / 0.39-0.40% | 0.29-0.32% / 0.67-0.71% |
| Heroes III map | 0.04-0.06% | 0.01-0.02% | 0.02-0.03% | 0 / 0 | 0 / 0 |
| Unreal SE flyby | 0.14-0.15% | 0.07-0.08% | 0.05-0.08% | 0 / 0 | 0 / 0 |
| Deus Ex | 0.10-0.12% | 0.09-0.11% | 0.01% | 0 / 0 | 0 / 0 |
| UT2003 **load** | 0.29-0.52% | 0.25-0.49% | 0.00% | 0-4.71% / 1.07-5.05% | same |
| UT2004 **load** | 0.48-1.61% | 0.20-1.06% | 0.00% | 0 / 0 (1.11-3.79% loose with the `_getptd` pointer call assumed tier 1) | same |
| Half-Life gameplay | 0.88-2.28% | 0.00% | 0.00% (unnamed) | 0 / 0 | 0.44-1.10% with every unnamed `call [global]`/`call r` assumed tier 2 |
| Arcanum | 0.02% | 0.00% | 0.00% | 0 / 0-0.01% | 0 / 0-0.01% |
| Morrowind (13.0M..13.6M) | 1.14-1.16% | 0.45-0.46% | 0.01-0.03% | 0 / 0 | 0 / 0 |
| Icewind Dale | 0.70-0.71% | 0.39-0.40% | 0.01% | 0 / 0 | 0 / 0 |

Verdict:

- **Tier 1 is not worth building for gameplay.** In no gameplay window does
  tier-1 traffic reach 0.5% of entries. Its ceiling is 0.00% strict
  everywhere, and at most 0.40% loose (WC3).
- It clears the 2-3% bar only in the UT2003/UT2004 **loading** phase.
  - There msvcr70/71's `_getptd` runs inside declined per-character loops:
    `msvcr70+0x7c00137f..0x7c00139f` at 4.71% in UT2003 220..370, and
    msvcr71 at up to 3.79% loose.
  - `_getptd` is the trio GetLastError → TlsGetValue → SetLastError. In
    msvcr71 the TlsGetValue goes through a function pointer.
- **Tier 2 is not worth building.**
  - WC3's HUD ceiling is 0.29-0.71%.
  - Half-Life's gl immediate-mode calls are the largest API traffic measured
    (1.78%). But even treating every unnamed indirect call there as a
    hostcall gives a ceiling of 1.10%. Most of its gl calls sit in loops
    already over 400 instructions (`no-backedge>400` 1.09%).
  - Heap*, the clock reads and the CRT overrides never reach 0.1%.
- **What limits these loops is size, not API calls.** The declined loops that
  do contain API calls are mostly `>400` once their callees are counted.
  Neither tier would admit them.
- **If tier 1 is ever built, do the `_getptd` trio first:**
  - GetLastError, SetLastError and TlsGetValue, as per-thread loads and
    stores of `$last_error` and the TLS slot array.
  - Accept TlsGetValue reached through a function pointer that resolves to
    the thunk (msvcr71). Otherwise the trio does not help UT2004.
  - This would speed up loading, not gameplay.
  - Enter/LeaveCriticalSection come next (Morrowind, IWD at 0.18-0.20%), and
    only once a gameplay window shows them in a sub-400 declined loop. None
    does today.

Reproduce:

```
node tools/call-form-weighted.js <windows> --app=ID --log=run.log --apis \
  --apis-json=X.apis.json --label=NAME
node tools/call-form-weighted.js --merge *.apis.json
```

A run with `--edge-hist` from this build also names every
GetProcAddress/COM target through its thunk, so no `--assume-tier` is needed.

## 16. MMX lowered, and scan-limit retried at a narrower span (2026-09-29)

SoftDrv (Deus Ex, Unreal SE) spends its frame in MMX texture-mapping loops,
and the tier refused all of them as `head-unsupported`.

### 16.1 MMX: compiler kind 27, engine ops 72-77

- **Compiler.** `$uc_decode` gives 32-bit MMX a kind 27 record. +12 holds the
  06c subop, from the same `$mmx_opcode_subop`/`$mmx_group_subop` tables the
  threaded handlers use. +28 holds the form: rr/movd-reg, load, store, or the
  71-73 imm shift group.
- **Registers.** An MMX register is a cell of the per-thread `$MMX_FILE`. Arg
  type 7 (`aM`) resolves to `$mmx_base + 8n` at encode time, and cell 8 is
  staging for a memory source.
- **Where the file lives.** `$MMX_FILE` is 16 × 0x80 bytes in the top half of
  `$UOP_CSCRATCH`'s last page, not a region of its own. The map is at its
  ceiling: a new 0x800-byte region failed `region-alloc --shake-all`, and so
  did paying for it with one or two pages of `$UOP_ARENA`.
- **Engine ops.**
  - `LDX64`/`STX64` are 8-byte guest loads and stores through the ordinary
    window and reguard, with size 8.
  - `MXOP sub d a b` and `MXSHI sub d a n` share one core with the threaded
    handlers.
  - `MXFROM32`/`MXTO32` implement movd.
- **Not lowered.** `pmovmskb` (D7), the register form of `movntq`, and `emms`
  are not lowered. A loop containing one of them declines.
- **Gate.** `--no-uop-mmx` / `set_uop_mmx(0)` turns the family off (the app
  key is `uopMmx:false`). Programs compiled before the switch are flushed.
- **ESP.** `mov esp,[abs]` inside a loop needs nothing special: ESP is an
  ordinary register to the tier.

### 16.2 Scan limit: halve the span and retry

With MMX lowered, SoftDrv's span heads (`+0x10d2b0be` and its neighbours)
moved from `head-unsupported` to `scan-limit`. `$uc_form_loop` floods
everything reachable within `UC_SPAN` (16 KB) of the head. The unrolled
rasterizer around the loop is more than `UC_MAX_SCAN` (600) instructions,
although the loop itself is 202-276. On a scan-limit decline,
`$uc_lower_head` now halves `$uc_span` and tries again, down to `UC_SPAN_MIN`
(0x200). Code outside the narrower span becomes side exits.

`test/test-uop-compiler.js` `span-shrink` covers this: a never-taken exit
leads 4 KB away into 700 supported instructions. With the retry disabled the
case declines `scan-limit`.

### 16.3 Exactness

`test/test-uop-compiler.js` has cases `mmx-*` for every lowered op, in
register and memory form. They cover shift counts from a register, from memory
and as immediates in and out of range, movd/movq in both directions, a
page-straddling movq, and the ESP-as-bound loop. Each case compares registers,
the MMX file, memory and per-batch stop EIPs against the threaded tier. A
mutation (paddb computed as i16x8, and a movd-out shifted by one) fails these
cases.

### 16.4 A/B

Box5, load ~1. Flags: `--batch-size=200000 --tick-ms-per-batch=25
--repaint-every=10 --branch-clock --wall-clock-ms=1790673326000 --quiet-api`.
Two runs per arm, alternating. User CPU covers the whole route (800 or 1800
batches).

| app, window | threaded entries base -> cand | user CPU base | user CPU cand | change |
|---|---|---|---|---|
| Deus Ex, 450..800 | 177.5M -> 100.4M | 55.83 / 55.94 s | 27.69 / 27.75 s | **−50.4%** (null band 0.2%) |
| Unreal SE, 900..1800 | 116.1M -> 68.8M | 28.42 / 28.93 s | 18.45 / 19.01 s | **−35.1%** (null band 1.8-3.0%) |

- **Frames.** All frames are md5-identical in every run: Deus Ex at
  450/560/680/790/end, Unreal at 900/1200/1500/1790/end.
- **MMX only.** Without the span retry, the Deus Ex window was at 154.9M
  threaded entries: the span heads were still at `scan-limit`.
- **Control.** The candidate with `--no-uop-mmx` runs 56.45 s (Deus Ex) and
  28.74 s (Unreal), the same as base. The span retry alone does not change
  these apps.
- **Next.** On Deus Ex, what remains hot in SoftDrv is x87 triangle setup:
  `+0x10d2759d`/`+0x10d27656`, `fld` heads at 4% each.

## 17. Switch jump tables as a primitive in both tiers (2026-09-29)

`jmp dword [disp + r*4]` (FF /4, no base, scale 4) is the compiled `switch`.
Before this change, both tiers treated it as an unknown indirect jump. The
threaded tier ended the block and did a cache lookup on the loaded target.
The uop tier declined any loop that contained one (`call-indirect`).

- **Threaded tier.** The decoder emits handler 498 (`$th_jmp_tbl`, table size
  499) for the base-less, scale-4 form. The handler loads the entry and jumps
  to it.
- **Compiler: kind 28.** `$uc_jt_targets` reads the table out of the image. The
  record holds the table length at +140, up to 16 distinct targets at +160, and
  the target count at +224. `$uc_nsucc`/`$uc_succ` return every target, so the
  loop flood, the back-edge walk and the predecessor lists all see the switch
  arms as ordinary successors.
- **Engine: op 81 (`JTBL i n x`).** An index below `n` takes the index-th of
  the `n` GOTOs that follow. Each arm re-checks the entry it loaded against the
  compiled target with XORI/BNZL, so a table rewritten at runtime side-exits.
  Any other index goes to `x`, a side exit. Ops 78-80 are unused `$c0` slots.
- **Switch.** `--no-jump-table` or `set_jump_table(0)` turns off both tiers at
  once. `uop-game-ab` has the arms `nojt` (uop plus the flag) and `nojtoff`
  (off plus the flag).
- **Tests.** `test/test-jump-table.js` runs six cases under the block clock
  and the branch clock: in range, out of range, a rewritten table, and a
  host-rewritten table. It checks exactness against the flag-off threaded
  tier, and it checks that the uop program is entered. `tools/find-jump-tables.js`
  is the static census.

### 17.1 A/B

Box1, load 1-2.5, `--jobs=1`, branch clock. User CPU covers the whole run.
Gameplay is the last `--slice-split` phase.

| game | uop | nojt | change |
|---|---|---|---|
| H3, before rebase | 52.62 / 54.93 s, gameplay 3.5 / 3.6 s | 54.12 / 57.46 s, gameplay 4.7 / 4.9 s | −3.6% whole run (inside the ~4-6% null band); **−25% gameplay** |
| H3, after rebase onto 02abe273 | 53.36 / 53.09 s, gameplay 3.5 / 3.5 s | 54.23 / 53.87 s, gameplay 4.7 / 4.7 s | −1.3% whole run (null band ~0.5%); **−26% gameplay** |
| SC, before rebase | 17.54 / 16.53 s | 16.67 / 16.60 s | flat; gameplay 0.8 s in all runs |
| SC, after rebase | 16.20 / 16.62 s | 16.18 / 16.25 s | flat; gameplay 0.7-0.8 s |

- **H3 uop counts.** The table jump raises uop enters from 44.3M to 53.3M and
  installs from 664 to 749.
- **Threaded tier alone.** Off against nojtoff was −2.5% on H3 in single runs.
- **H3 frames.** Identical in every arm.
- **SC frames.** Uop and nojt are identical to each other (0 px after the
  rebase). Both differ from off:
  - Before the rebase, the difference was 30-35 px, all inside StarCraft's
    animated cursor. That class came from main's uop tier, not from this
    change.
  - After the rebase, the difference is 5100 px in a 509x260 box. The cause is
    02abe273's MMX lowering: with `--no-uop-mmx`, the uop frame matches the
    pre-rebase frame exactly and differs from off by the same 35 px cursor.

## 18. Game-specific threaded folds against the uop tier (2026-09-29)

The threaded tier had grown exact-byte folds for single games: Smacker and
Storm helpers, SimGolf's colour-keyed blits, MW3's RGB565 rows, Jazz 2's
lighting and masked copy, and others. The uop tier's enter op (470) is emitted
**before** any block-start fold. So wherever uop compiles a head, it runs that
head, and the fold only runs in the threaded fallback.

This section asks, fold by fold, whether the uop tier alone is as fast. Each
fold stays only where it still pays for itself.

### 18.1 Method

- **Switch.** Every fold has an off switch, `--no-fold=NAME`
  (`test/runner-experiments.js`), inherited by every guest-thread instance.
  - Folds that already had a setter map to it.
  - The rest share `$fold_off_mask` in `07-decoder.wat`.
- **Arms.** `tools/uop-game-ab.js` runs `uop` (fold on) against `--arm=` (uop
  plus the fold off). `--arm-off=` adds the same pair on the threaded tier, as
  a control: it shows what the fold does when uop is not in front of it.
- **Setup.**
  - Box2, one run.js at a time, `--branch-clock`, fixed work (the route's
    `--max-batches`).
  - User CPU, arms alternating, at least two runs per arm.
  - The null band is the uop arm's own run-to-run spread.
- **Frames.** Every arm's last frame is md5-compared. When the app disagrees
  with itself, the arms are compared against the fold-off threaded frame.
- **Census.** A handler histogram (`--handler-hist-thread=0`) with the fold on,
  threaded against uop:
  - a fold handler that drops to a few hundred dispatches under uop marks a
    loop uop compiles;
  - **zero in both arms means the route never runs the fold, and the A/B says
    nothing about it.**
- **Rule.** Retire when the fold-off uop arm is not slower than the band and
  frames match. Keep otherwise, or when no route in the corpus reaches the fold.

### 18.2 Census and decisions

Dispatch counts are the fold's handler, fold on, threaded → uop, on the A/B
route unless noted.

| fold (handler) | switch | app | threaded → uop | decision |
|---|---|---|---|---|
| SMK_TREE (461) | `smk-tree` | StarCraft, Heroes III (Smacker) | H3 835K → 275K | retired, 99aab153 |
| SMACK_HUFF (395) | `smack-huff` | Smacker | H3 1.74M → 1.3K | retired, 4a481444 |
| STORM_BITREADER (396) | `storm-bitreader` | StarCraft, Diablo (Storm PKWARE) | fires on SC | retired, 605eeaba |
| SimGolf CK_LUT16/BLEND16/SHADOW16/COPY8 (455-457, 460) | `ck-*` setters | SimGolf `jgl.dll` | 11.4M → 4.2K | retired, 97781af9 |
| LUT_RUN u16 counted (418 forms) | `lut16-counted` | Heroes III 0x470927 | 3.75M → 12K | retired, 11e746cd |
| CASE_CHAIN (428) | `case-chain` | Caesar III, StarCraft | SC 10,759 → 6,876; C3 1 → 1,008 (RLE_RUN takes the ladder) | retired, bddcd57a |
| MMX masked row copy (419 `0x80000000`) | `mmx-mask-copy` | Jazz 2 | jazz2g 54,857 → 2,108 (all H419) | retired, b1a7ab29 |
| MW3 RGB565 alpha / colour-key / grid filter (436/440/441) | `mw3-blit` | MechWarrior 3 | 440: 293K → 293K; 441: 68K → 255; **436: 0 / 0** | retired, 50ff31cb |
| LUT_SPAN (431), incl. Jazz 2 lighting mode 2 | `lut-span` | Diablo II `d2gfx`, Jazz 2 | jazz2g 641,572 → 765 | retired, 0cc038f1 |
| COPY32 counted (419 `0x80000004`) | `copy32-counted` | Diablo (app profile) | H419 22.0M → 111K | retired, cb514459 |
| RLE_RUN (429) | `rle-run` | Caesar III | 4.76M → 1,074 | **kept** |
| RECT_RUN (427) | `rect-run` | Caesar III | 577K → 482K (uop did not take it then) | kept then; **retired** in 4a9dc294 (§21) |
| PCX_RUN (462) | `pcx-run` (removed) | Quake II | 9,918 → 1,318 | kept, then **retired** once uop lowered `rep stos` (section 19) |
| AoE span prefix (438) | `aoe-span` | Age of Empires I/II | 2.17M → 1,020 | **kept** |
| AoE grid fill (437) | `aoe-fill` | Age of Empires I/II | 0 / 0 on aoe1 | **kept** (not reached) |
| XLAT/STOSB (418 form) | `xlat-stosb` | Diablo | not reached on the route | **kept** (not reached) |
| COLORKEY8 (443) | `colorkey8` | Alpha Centauri | no assets on the boxes | **kept** (not measured) |
| MMX copy64 / fill64 (419 `0x80000001-3`, `0x80000005`) | `mmx-copy64`, `mmx-fill` | Deus Ex / UE1 SoftDrv | no assets on the boxes | **kept** (not measured) |
| IMPLODE_CMP_RUN (466) | `--implode-cmp-run` | prototype | off by default | untouched |
| packed average (435) | — | generic recognizer | not game-specific | untouched |
| generic COPY_RUN | `--copy-superops` | MW3 opts in (`copySuperops`) | neutral on MW3: 320.57 / 322.90 s off vs 322.31 / 323.33 s on | untouched (generic, off by default) |

Each retired slot becomes `$th_retired_fold`, so the handler table, elem list
and cache guard stay at 499 and no later index moves. None of the retirements
needed a uop compiler extension: in every case uop already compiled the loop,
or (MW3 440) ran the surrounding code at least as fast.

### 18.3 A/B results

User CPU in seconds. Whole run unless a gameplay phase (the last
`--slice-split` phase) is given.

| app, fold | fold on (uop) | fold off + uop | threaded control | frames | decision |
|---|---|---|---|---|---|
| StarCraft, SMK_TREE / SMACK_HUFF / STORM | 16.86, 16.45 | 16.59, 16.09 / 16.82, 16.05 / 16.46, 16.30 | all off 29.32 vs on 28.85 | fold-off uop = fold-off threaded | retired (band 0.41) |
| Heroes III, SMK_TREE / SMACK_HUFF | 52.29, 52.05 | 52.32, 52.67 / 51.83, 50.91 | — | identical | retired |
| Heroes III, LUT_RUN u16 | 52.29, 52.05, 52.64, 51.96 | 52.14, 52.84 | off 73.18 | identical | retired |
| SimGolf, four CK folds | 20.09-20.66 (7 runs) | 20.14-20.49 (7 runs) | — | identical, also to fold-off threaded | retired |
| Caesar III, CASE_CHAIN | 4.79, 4.77 | 4.77, 4.78 | — | identical | retired |
| Caesar III, RLE_RUN | 4.79, 4.77 | 4.83, 4.89 (+1.3%) | — | — | kept |
| Caesar III, RECT_RUN | 4.79, 4.77 | 6.40, 6.42 (+34%) | — | — | kept; retired later (§21: +0.9% once uop takes the blit) |
| Quake II, PCX_RUN | 6.78, 6.88 | 6.96, 7.17 (+3%) | off 8.31, fold off 8.47 | identical | kept; retired in section 19 (fold off with COPY/FILL: −0.5%) |
| MW3, all three blits | 322.31, 323.33 | 308.22, 319.71 (−4.4%; gameplay −1.8%) | off 326.85 | identical | retired |
| Jazz 2 level (jazz2g), mask copy | 14.25, 14.08, 14.12 | 14.02, 13.99, 14.69 | off 28.54, fold off 28.43 | see below | retired |
| Jazz 2 level (jazz2g), LUT_SPAN | 14.25, 14.08, 14.12 | 14.30, 14.16, 14.06 | fold off 28.39 | identical | retired |
| Diablo II, LUT_SPAN | 30.80, 32.05 | 30.93, 32.92 (+1.6%, band 1.25) | off 32.65, fold off 33.43 | 6 shots identical | retired |
| Diablo, COPY32 counted | 91.70, 93.42, 92.01, 92.85, 92.75 (mean 92.55) | 94.48, 96.67, 91.19, 91.25, 93.33 (mean 93.38, +0.9%) | — | identical | retired (band 1.72) |
| AoE I, both AoE folds | 11.01, 11.09, 10.99, 11.10, 11.02, 11.12; gameplay 4.75 mean | 11.06, 11.35, 11.23, 11.18, 11.16, 11.05; gameplay 4.90 mean (+1.1% / +3.2%) | off 12.75-13.10, fold off 12.93-13.00 | see below | kept |
| AoE I, span only | 11.07, 11.00, 11.04 | 11.06, 11.16, 11.09 (gameplay +1.4%) | fold off 12.98 | see below | kept |
| AoE I, fill only | 11.07, 11.00, 11.04 | 11.02, 11.01, 11.11 | fold off 12.72 | identical | kept (H437 never runs) |

### 18.4 Findings

- **Two game folds change the program's result on the threaded tier.**
  - *Jazz 2's masked MMX row copy.* On jazz2g, with the fold off, uop and
    threaded produce one md5-identical frame. With it on, the two tiers produce
    two *different* frames, and both differ from the fold-off frame.
  - *AoE's span prefix.* Fold-on threaded differs from fold-off threaded by
    6,660 px (1.39%). Every uop arm equals the fold-off threaded frame, because
    under uop the fold barely runs (1,020 dispatches).
  - Both routes are demo/AI playback on `--branch-clock`. A fold that charges
    `$steps` or advances the branch clock differently from the x86 it replaces
    moves guest time. That alone is enough to change such a replay, so this is
    a clock-accounting divergence at least, not necessarily wrong pixels.
  - The mask copy is retired. The span prefix is kept for its gameplay margin,
    and it is the first thing to look at if AoE threaded runs ever disagree
    with uop.
- **The first Jazz 2 route measured nothing.** The title-only `jazz2` route
  never reaches the level renderer: 0 dispatches of H419 and of H431 with the
  folds on. The first two Jazz 2 A/Bs (fold off 3.73-3.78 s against 3.83 s)
  were noise over code that never ran.
  - `jazz2g` presses Escape through the title and loading screen and runs the
    DEMO level.
  - Any fold A/B should check the census first: a fold that never runs is
    "not slower" by construction.
- **MW3's alpha row (436) was not exercised** by the MW3 route (0 dispatches in
  both arms). It was retired with 440/441 on the strength of the combined arm.
  If a later MW3 scene shows an alpha-heavy blit regressing, that is the one
  retirement here without a direct measurement.
- **What is left is either measured or unreachable.**
  - RECT_RUN (+34%), PCX_RUN (+3%) and RLE_RUN (+1.3%) still pay. RECT_RUN is
    straight-line unrolled rows, not a loop, so uop did not take it. Section
    21 makes the tier take it as straight-line traces and retires the fold.
    PCX_RUN's margin was the two `rep stos` the tier could not lower; section
    19 lowers them and retires it.
  - The AoE folds, XLAT/STOSB, COLORKEY8 and the UE1 MMX folds stay until a
    route that reaches them exists.

## 19. Bulk memory: COPY/FILL and `rep movs`/`rep stos` (2026-09-29)

Before this, any `rep` prefix declined the instruction, so a loop that
contained one compiled only up to it: the program side-exited at every rep and
re-entered after the threaded block ran it. Quake II's PCX expander (two
`rep stos` per token) is the case that kept PCX_RUN alive in section 18.

- **Engine: op 82 `COPY d s n w wd ws x` (32 bytes) and op 83 `FILL d v n w wd
  x` (28 bytes).** `d`/`s`/`n` are the EDI/ESI/ECX slots, `w` the element width
  (1/2/4, and 8 for an MMX FILL whose `v` is an MMX cell), `wd`/`ws` the
  destination/source windows and `x` the side-exit stub.
  - *Fast arm, in `$uop_fast`.* A count of 0 is a no-op. The whole extent,
    DF-adjusted to its low end, must lie inside the (re-guarded) window, and a
    count above 1M elements goes to the slow arm. FILL is `memory.fill` for a value of one
    repeated byte, else one element stored and doubled with `memory.copy`.
    COPY is one `memory.copy`, and only when the two *wasm* ranges do not
    overlap at all -- any overlap goes to the slow arm, which keeps element
    order.
  - *Slow arm, `$uop_bulk_slow` via `$uop_run`.* Re-guards the windows, then
    walks every page of both extents: each must be mapped, and a destination
    page must not need a store barrier (code or watched page). A failing page
    side-exits to `x` *before anything is written*, so the threaded rep runs
    the instruction and does its own code-write invalidation. Otherwise it runs
    05b's shared core and updates the registers.
  - Both arms leave ECX 0 and ESI/EDI moved by ±count·w with DF, exactly as
    the instruction does. Clock charge is 0: a rep is one instruction of its
    threaded block, and the threaded handler charges nothing extra.
  - Counters: `uop_bulk_stats(0)` slow-arm runs, `(1)` deopts to threaded.
- **05b core, shared.** `$rep_movs_mem`/`$rep_stos_mem` replaced the four
  per-width rep bodies: invalidate the destination extent, then an element
  loop when the guest ranges overlap in the copy direction or either range is
  not contiguous in wasm memory, else `memory.copy`/`memory.fill`. The threaded
  handlers, 07c's region executor and the uop slow arm all run this one code.
- **Compiler: kind 30.** `F3 A4/A5/AA/AB`, with `66` for the word forms, 32-bit
  addressing, no segment override; `F2`, 16-bit addressing, segment overrides,
  `cmps`/`scas`/`lods`/`ins`/`outs` all stay unsupported. `--no-uop-rep`,
  `set_uop_rep(0)` or `uopRep: false` turns the lowering off; the setter is
  inherited by worker instances.
- **Tests (`test/test-uop-compiler.js`).** Sixteen table cases (every width,
  both directions, overlapping, uniform fill, the gate off, a segment-prefixed
  decline) under both clocks; `rep-oracle`, an element-by-element JS model
  over six forms × DF × seven layouts (disjoint, hazardous and benign overlap,
  exact alias, zero, one, a 900-element run across a page seam) checked in
  both the threaded and the compiled arm; `rep-sparse`, non-contiguous sparse
  pages that must take the slow arm; `rep-code-write`, a FILL over a compiled
  program that must deopt and kill it; and `pcx-body`, ref_soft's 108-byte PCX
  loop verbatim against threaded code, with the rep lowering on and off.

### 19.1 Quake II A/B, and PCX_RUN retired

Box2 (5.39.74.209), `tools/uop-game-ab.js --games=q2`, branch clock, fixed
work (1400 batches), user CPU, arms interleaved, three runs each:

| arm | runs (s) | mean | vs uop |
|---|---|---|---|
| uop (fold on, rep lowering on) | 6.83, 6.90, 6.87 | 6.87 | — |
| fold off, rep lowering on | 6.89, 6.95, 6.66 | 6.83 | −0.5% |
| fold off, rep lowering off (section 18's fold-off arm) | 7.05, 7.18, 7.19 | 7.14 | +4.0% |
| fold on, rep lowering off (section 18's uop arm) | 6.82, 7.14, 7.29 | 7.08 | +3.1% |
| threaded (`--no-uop`) | 8.18 | — | +19% |

All 13 final frames are one md5. With the fold off, uop enters fall from
10.59M to 8.82M once the fills stay inside the program. Fold off with COPY/FILL
is not slower than fold on, so PCX_RUN is retired: slot 462 is
`$th_retired_fold`, and its matcher, handler, counters, exports, `--no-pcx-run`
/ `--no-fold=pcx-run` switch, worker setter and `test-stream-fold.js` are gone
(the loop itself lives on as the `pcx-body` exactness case).

Not done: collapsing counted load/store loops (UE1's MMX copy64/fill64, AoE's
grid fill) into COPY/FILL. Those folds have no route on the boxes that reaches
them (section 18.2), so a retirement could not be measured, and they stay.

## 20. Trace instruction limit, and why Caesar's unrolled blit stays threaded (2026-09-29)

Two questions:

- Why does uop not take Caesar III's RECT_RUN blit, which is still worth +37%
  as a threaded fold (§18.3)?
- Is 160 the right `$uc_trace_max` (§13)?

### 20.1 The flag

`--uop-trace-heads=MIN,MAX` sets both trace bounds
(`test/runner-experiments.js`, which calls `set_uop_trace_limits`). The
setting is inherited by every worker instance through `INHERITED_WASM_GLOBALS`
in `lib/worker-imports.js`. The flag already existed; no new one was added.

- **The maximum is clamped to `$UC_MAX_LOOP` (400).** Asking for 600 or 1000
  silently means 400.
- **Going past 400 needs a rebuild**, and more than one constant has to move:
  - `$UC_MAX_LOOP` itself;
  - `$UC_MAX_SCAN` (600): exceeding it halves the span and retries;
  - the `UC_INSN` scratch: 256 bytes per instruction below `UC_LOOP` at
    `0x26000`, so about 600 records fit.
- The sweep's 600 arm is a separate build with `$UC_MAX_LOOP` 600 and nothing
  else changed.
- `test/test-uop-compiler.js` now has a `trace-limits` case. It builds heads of
  K straight instructions and a `jmp`, and checks four things:
  - the default 160 declines K=200, and 320 compiles it;
  - 1000 is clamped: K=390 compiles, K=450 does not;
  - the minimum decides K=5.

  It runs under `--branch-clock`. On the instruction clock, the per-page
  200-instruction block check in 07e (`long-block`, reason 7) refuses K≥200
  first.

### 20.2 Caesar III's blit, per site

Full disassembly and table: [re-notes/caesar3-demo.md](re-notes/caesar3-demo.md).

`exe+0x41ceb0` is `pushad`, then two unrolled copies with no loop, then
`popad`:

- **Top half:** `exe+0x41cf0f`..`exe+0x41d799`, about 467 instructions. Its
  only branch is the `jnz` at the end.
- **Bottom half:** `exe+0x41d7a0`, about 470 instructions, falling straight
  into `popad` at `exe+0x41e085`.

With the fold off, H421 is 67.3% of the gameplay window's threaded dispatches.
Verdicts with the fold off (`--uop-census`, `--branch-clock`):

- **`exe+0x41cf0f`** declines `no-backedge` at 160, at 400, and in the 600
  build.
  - At 160 and 400 the cap cuts a run that has no branch in it, so the trim
    leaves nothing.
  - At 600 it still declines, most likely on the scan budget and the
    halved-span retry.
- **`exe+0x41d002`** (the threaded decoder's second block of the top half)
  compiles at 400: 397 instructions.
  - It is then **retired poor**: 256 enters, 152 blocks, exiting at
    `exe+0x41d7a0`.
  - The 600 build gives 160 blocks and the same outcome.
- **`exe+0x41d7a0`** declines `no-backedge` at every cap: `popad` (op 61) is
  unsupported and comes before any branch.
- **`exe+0x41ceb0` and `exe+0x41ced7`**: the entry is retired poor, exiting at
  `pushad`; `pushad` itself is head-unsupported (op 60).

**The poor rule is structurally wrong for straight-line traces.**
`$uop_poor_check` wants at least 2 blocks per enter, but a block is a *branch*
on `--branch-clock`. A trace that runs 397 instructions to one `jnz` scores at
most 1, so it is retired however much work it does per enter.

Taking this function would need all of:

1. `pushad`/`popad`;
2. a cap and scan budget above about 470;
3. a poor rule that counts retired instructions, not blocks.

At the default cap the fold does not change a single uop counter: fold on and
off give the same 828 installs and the same 8,040,181 enters. It only changes
what the threaded fallback runs. RECT_RUN stays -- until section 21, which
makes the tier take the blit and retires the fold.

### 20.3 Sweep

**Setup**

- `tools/uop-game-ab.js` on box2 (c3, sc) and box5 (h3, diablo).
- Arms, each on top of `uop` (`--branch-clock --uop`, trace heads on at
  8,160):
  - `tA` = `--uop-trace-heads=8,80`
  - `tB` = `8,320`
  - `tC` = `8,400`
  - `tW` = `8,600` on the `$UC_MAX_LOOP` 600 build
- Three reps each, interleaved (uop, tA, tB, tC, tW, then again), one run at a
  time.

**How to read the table**

- User CPU is the mean of three runs, whole run.
- The band is the arm's own (max−min)/mean.
- Δ is against `uop`.
- Every arm's counters were identical across its three reps. Every frame of
  every arm matched `uop` (c3: 3 shots each; the others: final frame).
- "blk/enter" = uop blocks ÷ enters.

| game | arm | user s (runs) | band | Δ | installs | kills (poor) | flushes | enters | blk/enter | compiled / traces |
|---|---|---|---|---|---|---|---|---|---|---|
| c3, RECT_RUN on | uop (160) | 4.63 (4.62, 4.65, 4.62) | 0.6% | — | 828 | 44 (44) | 5 | 8.04M | 30.3 | 828 / 524 |
| | tA (80) | 4.82 | 1.0% | +4.2% | 786 | 54 (54) | 4 | 10.77M | 22.5 | 786 / 505 |
| | tB (320) | 4.57 | 0.9% | −1.3% | 833 | 47 (47) | 6 | 6.77M | 36.2 | 833 / 464 |
| | tC (400) | 4.52 | 0.9% | **−2.3%** | 766 | 47 (47) | 5 | 6.76M | 36.5 | 766 / 430 |
| | tW (600) | 4.51 | 0.7% | **−2.6%** | 758 | 47 (47) | 5 | 6.49M | 38.0 | 758 / 424 |
| c3, `--no-fold=rect-run` | uop (160) | 6.35 (6.51, 6.25, 6.29) | 4.1% | — | 828 | 44 (44) | 5 | 8.04M | 30.3 | 828 / 524 |
| | tA (80) | 6.49 | 2.8% | +2.3% | 786 | 54 (54) | 4 | 10.77M | 22.5 | 786 / 505 |
| | tB (320) | 6.19 | 0.8% | −2.5% | 833 | 47 (47) | 6 | 6.77M | 36.2 | 833 / 464 |
| | tC (400) | 6.11 | 0.2% | −3.8% | 742 | 51 (51) | 5 | 6.72M | 36.7 | 742 / 421 |
| | tW (600) | 6.10 | 0.5% | −3.9% | 737 | 47 (47) | 5 | 6.45M | 38.2 | 737 / 412 |
| sc | uop (160) | 15.94 (15.86, 15.94, 16.02) | 1.0% | — | 834 | 117 (48) | 3 | 5.65M | 28.2 | 834 / 362 |
| | tA (80) | 16.25 | 0.6% | +2.0% | 714 | 92 (50) | 2 | 6.01M | 26.4 | 714 / 316 |
| | tB (320) | 15.95 | 1.1% | +0.0% | 796 | 125 (44) | 3 | 5.95M | 27.2 | 796 / 376 |
| | tC (400) | 16.04 | 0.4% | +0.6% | 899 | 187 (43) | 4 | 5.33M | 29.8 | 899 / 441 |
| | tW (600) | 16.06 | 0.5% | +0.8% | 842 | 151 (47) | 4 | 5.46M | 29.2 | 842 / 401 |
| h3 | uop (160) | 52.04 (51.80, 52.38, 51.93) | 1.1% | — | 755 | 45 (45) | 3 | 53.36M | 12.0 | 755 / 438 |
| | tA (80) | 52.16 | 0.2% | +0.2% | 718 | 62 (62) | 2 | 61.91M | 10.3 | 718 / 429 |
| | tB (320) | 52.14 | 1.6% | +0.2% | 770 | 45 (45) | 4 | 53.10M | 12.1 | 770 / 443 |
| | tC (400) | 52.19 | 0.7% | +0.3% | 755 | 43 (43) | 4 | 52.93M | 12.1 | 755 / 439 |
| | tW (600) | 51.97 | 1.3% | −0.1% | 746 | 45 (45) | 4 | 52.87M | 12.2 | 746 / 438 |
| diablo | uop (160) | 91.21 (91.02, 91.86, 90.75) | 1.2% | — | 2791 | 1943 (53) | 10 | 215.2M | 6.39 | 2791 / 2453 |
| | tA (80) | 90.99 | 1.0% | −0.2% | 2249 | 1551 (57) | 5 | 217.2M | 6.33 | 2249 / 1967 |
| | tB (320) | 94.13 | 1.6% | **+3.2%** | 3413 | 2361 (53) | 23 | 188.2M | 6.68 | 3413 / 3023 |
| | tC (400) | 91.38 | 1.2% | +0.2% | 3829 | 2611 (51) | 30 | 214.5M | 6.44 | 3829 / 3387 |
| | tW (600) | 94.28 | 2.6% | **+3.4%** | 4201 | 2936 (49) | 42 | 207.0M | 6.47 | 4201 / 3738 |

In the c3 fold-off rows, tC's three runs (6.10-6.11 s) all sit below `uop`'s
three (6.25-6.51 s). The −3.8% is still inside `uop`'s 4.1% band, which one
slow first run widened.

### 20.4 Verdict

- **Keep 160. The default does not change.**
  - A bigger cap wins only on Caesar: −2.3% with RECT_RUN on, outside that
    arm's 0.6% band.
  - It is neutral on Heroes III and StarCraft, within their bands, and
    StarCraft's point estimates go the wrong way (+0.6% to +0.8%).
  - It **loses on Diablo**: +3.2% at 320 and +3.4% at 600, outside the 1.2%
    band. 400 comes out at +0.2%, which is not a real minimum: its compile
    and flush counts sit between 320's and 600's.
  - Diablo compiles and flushes much more as the cap grows. Emitted uops go
    520K → 1.14M / 1.47M / 2.04M, and arena flushes 10 → 23 / 30 / 42. So the
    guest re-pays compilation, and every flush throws away the program mix
    that was working.
  - The rule was "wins outside its band everywhere", so the default stays.
    This change commits only the unit test and these notes.
- **80 is worse or neutral everywhere.** It costs +0.2% to +4.2% on c3, sc
  and h3, and comes out at −0.2% on Diablo, inside the band.
  - It cuts traces short, so there are more enters with fewer blocks each:
    c3 goes from 30.3 to 22.5 blk/enter, h3 from 12.0 to 10.3.
  - More of those traces are retired poor (c3 44 → 54, h3 45 → 62).
- **What a bigger cap buys on Caesar is not the blit.**
  - The blit program at `0x41d002` is retired within its first 256 enters.
  - The gain is longer traces elsewhere: 36-38 blk/enter against 30, and 16%
    fewer enters.
  - The blit itself needs §20.2's three changes, not a cap.
- **Keep counting x86 instructions, not emitted uops.**
  - Every resource the cap protects is sized in x86 instructions: the
    `UC_INSN` scratch records, `$UC_MAX_SCAN`, and the trim, which walks x86
    members.
  - The uop count is only known after lowering, and it varies by app: about
    3.9-4.5 uops per x86 instruction on c3, sc and h3, and 2.9 on Diablo
    (520,372 / 180,387).
  - The arena is the one uop-denominated resource.
    - Its pressure shows up as flushes, which barely moved on three games
      (c3 5 → 6, sc 3 → 4, h3 3 → 4).
    - Diablo's flushes quadrupled, and that is what made the larger caps
      lose there.
  - So if a larger cap is ever tried again, keep the x86 cap and add a second
    guard in uops, or in arena share per program, rather than switch units.
    It is the arena, not the per-trace length, that Diablo runs out of.

## 21. Straight-line traces take Caesar III's tile blit (RECT_RUN retired)

Question: can the tier run Caesar III's fully unrolled tile blit
(`exe+0x41ceb0`) as ordinary straight-line code, well enough that the
one-app fold RECT_RUN (H427) has nothing left to earn? It can. The fold was
retired in 4a9dc294. What follows is the order the pieces landed in, and what
each one did. All numbers come from box2, with `--branch-clock`, fixed work,
user CPU in seconds and 3 interleaved reps, via `tools/uop-game-ab.js`.

### 21.1 Poor rule credits work, not loop iterations (b25d5a47)

- **Old rule.** The poor-program rule killed a program whose entries retired
  too few blocks per enter.
- **Why that was wrong here.** A straight-line trace of 160 x86 instructions
  retires only one or two blocks per enter, yet it is exactly the program we
  want.
- **New rule.** Op 84 (`WORK`) credits a trace its x86 instruction count.
  - `$UOP_POOR_WORK` (16) is the per-enter work floor.
  - `--uop-poor-work=N` tunes it. A huge N restores the old behaviour.

### 21.2 pushad/popad as micro-ops (af219050)

- **Change.** Kind 31 lowers `pushad`/`popad` to eight stores or loads plus
  the ESP adjust. Previously they were a head-unsupported decline.
- **Why it matters.** The blit opens with `pushad` and closes with `popad`,
  so every trace through either end was declined before this.

### 21.3 Trace cut exits (bc395325, `--no-uop-trace-cut`)

- **Change.** At the x86 cap, a trace now ends in a cut exit to the next
  instruction instead of declining the whole head.
- **Why.** The blit halves are ~470 instructions each, far over the cap, so
  they become chains of 160-instruction traces.
- **Accounting.**
  - A cut is not a branch. `$th_block_end` refunds it, so the branch-clock
    charge is identical.
  - The cap is still counted in x86 instructions.

### 21.4 MCOPY: coalesced load/store pairs (ae4ad127, `--no-uop-mcopy`)

- **Change.** Within one compiler block, a run of k >= 2 pairs becomes LEA,
  LEA and one op 85 (`$uc_try_mcopy`). A pair is
  `mov r,[S+ds+4i] / mov [D+dd+4i],r`, with one `r`, and `r` in neither
  address form.
- **What it preserves.**
  - **Final registers.** Every member is a `mov`, so no flag and no address
    register moves inside the run. `r` is left holding the last dword
    written, which is what the last load read.
  - **Order under aliasing.**
    - Semantics are k dwords copied forward, element by element, in x86
      order.
    - The fast arm is one `memory.copy`, taken only when both extents sit
      inside their windows and do not overlap, so the order cannot show.
    - Otherwise `$uop_mcopy_slow` copies element by element through
      `$gl32`/`$gs32`.
  - **Page safety and code-write invalidation.**
    - If a page is unmapped, or a destination page needs a store barrier,
      nothing has been written yet.
    - The run then exits to its first load's deopt stub, and threaded code
      runs every pair.
  - **Branch clock and cap.** Both are unchanged: the run stays inside one
    block, and the cap counts the member instructions.
  - **Cut boundaries.**
    - Only the first member may be a seam.
    - The run ends before the block's last instruction, so exit handling
      stays with the ordinary path.
    - No member may be an aggressive-stack forward.
- **Bug found on the way.** The COPY/FILL store window was being recorded
  read-only instead of read-write. It is fixed in the same commit.

### 21.5 Sticky hot-table slots (943c97b9, `--no-uop-hot-sticky`)

- **Problem.** The bottom-half tail (`exe+0x41de07`) never reached its
  install threshold. Its hot-table slot was evicted by a foreign EIP between
  visits, and the count restarted at zero every time.
- **Change.** In `$bx_hot_bump`, a foreign EIP now decrements a nonzero count
  (counted by `uop_hot_decays`) instead of evicting it.
- **Effect.**
  - Before sticky, c3's gameplay window was 25.96M ops with H421 at 1.68M
    (fold on) and 33.8M ops with H421 at 9.36M (fold off).
  - After it, the window is 22.13M ops with H421 693K (fold on) and 22.11M
    ops with H421 900K (fold off).
- **Known cost: compile churn.** The old reset acted as a time decay, and
  sticky counts let more lukewarm heads install:

  | game | installs sticky / old | kills | flushes |
  |---|---|---|---|
  | c3 | 1488 / 900 | 40 / 33 | 9 / 5 |
  | sc | 5972 / 833 | 2473 / 110 | 24 / 3 |
  | h3 | 1874 / 739 | 113 / 46 | 10 / 3 |

  It is time-neutral on every guard (21.8), so it stays on. A faster decay
  or periodic halving is the obvious knob if the churn ever shows up in time.

### 21.6 Cut landings are block boundaries (013ad3cf)

- **Symptom.** With cut exits on, Diablo regressed.
- **Mechanism.**
  - The cut exits land mid-way through threaded blocks in Smacker-generated
    blitter code (heap memory past smackw32, `0xac9xxx`).
  - The threaded path then publishes a block at the landing, which retires
    the covering block (one owner per byte, `$page_retire_at`).
  - The next entry from the head re-decodes the covering block, and the two
    keep retiring each other.
  - Result: 99,556 overlap retirements against 1,914 without cuts, and full
    clears rose from 9 to 16.
- **Fix.**
  - `$uc_form_trace` records each cut landing in a 256-entry table in the
    arena (`$uop_cut_note`), when trace cuts and the branch clock are on.
  - `$fuse_stop` consults it (`$uop_cut_probe`), so the threaded decoder ends
    a block at a cut landing instead of running through it.
  - `$uop_flush_all` clears the table.
- **Effect.** Retirements fall to 4,928 and full clears to 2. Diablo moves
  from +1.4% slower than the old configuration to 2.4% faster (21.8).

### 21.7 Code-page slot fold (97dda357; census refusals in a3aa6b14)

- **Problem.** The code-page bitmap slot dropped address bit 30, so DIB pages
  (guest `0x50000000`) aliased `.text`.
- **Consequence.** Every blit store into the DIB looked like a code write,
  and the census refused windows for it.
- **Fix.** Bit 30 is folded into slot bit 15.
- **Effect.** This single fix took the c3 fold-off penalty from +30% to
  +6.5% (21.8).

### 21.8 A/B

**c3, fold on vs fold off, by build**

| build | fold on | fold off | fold off cost |
|---|---|---|---|
| before (section 20) | 4.63 | 6.35 | +37% |
| ae4ad127 | ~5.71 | ~7.45 | +30% |
| 97dda357 | ~4.47 | ~4.76 | +6.5% |
| 013ad3cf | 4.548 | 4.590 | **+0.9%** |

**c3 on 013ad3cf, per rep**

| arm | reps | mean | vs uop |
|---|---|---|---|
| uop | 4.54 4.57 4.52 | 4.548 (with the uop2 reps) | 0 |
| uop2 (null) | 4.55 4.53 4.58 | same | band 1.3% |
| nf (`--no-fold=rect-run`) | 4.60 4.59 4.58 | 4.590 | +0.9% |
| nfns (fold off, no sticky) | 4.72 4.68 4.68 | 4.693 | +3.2% |
| retired build 4a9dc294 | 4.58 4.61 4.58 | 4.590 | same as nf |

- Frames are identical in every arm and rep, 3 shots each.
- On the retired build, the md5 of all three shots matches nf, and so does
  the census.

**Guards on 013ad3cf.** `old` means all four changes off: no trace cut,
poor-work at 1073741824, no mcopy, no hot sticky.

| game | uop | old | delta |
|---|---|---|---|
| Diablo | 90.55, 92.42 | 94.39, 93.17 | -2.4% (band 1.3%) |
| StarCraft | 16.01, 16.23 | 15.86, 16.34 | +0.1% |
| Heroes III | 53.17, 52.61 | 53.08, 52.55 | +0.1% |

- Diablo's boot phase is 21.2 / 21.4 (uop) against 23.4 / 23.0 (old).
- All guard frames are identical.

**Counters on 013ad3cf**

| game | arm | installs | kills (poor) | flushes | enters | blocks/enter |
|---|---|---|---|---|---|---|
| c3 | uop | 1488 | 40 (40) | 9 | 8.91M | 28.2 |
| c3 | nf | 1524 | 38 (38) | 9 | 8.94M | 28.2 |
| Diablo | uop | 10805 | 7763 (95) | 34 | 219.9M | 6.36 |
| Diablo | old | 2809 | 1911 (58) | 11 | 215.5M | 6.32 |
| sc | uop | 5972 | 2473 (171) | 24 | 8.42M | 21.3 |
| h3 | uop | 1874 | 113 (113) | 10 | 62.2M | 10.4 |

### 21.9 Per-site census of the blit (fold off, 013ad3cf)

| head | status |
|---|---|
| `41ceb0` | trace, 36 insns, x5 |
| `41cef6` | head-unsupported, dead (sig `0x400f7`) |
| `41cf0f`, `41d1b6`, `41d4ca` | traces, 160 insns, x5 |
| `41d7a0` | trace, 160, x5 |
| `41d7db`, `41daf3` | traces, 160, x5 |
| `41dab9` | trace, 160, x4 |
| `41ddcd` | trace, 149, x5 |
| `41de07` | trace, 137, x5 (runs through `popad`) |
| `41e007` | trace, 32, x1 |
| `41e085` (`popad`/`ret`) | declined, why 4 (no back edge), marked dead |
| `41e08a` | declined, why 3 |

- Every trace listed is a live program at exit.
- The fold-on arm has the same list, plus `41d793` and `41da8d`/`41dda1`.
  Those are the pair-fold boundaries the fold leaves behind.

### 21.10 Verdict

- **RECT_RUN is retired** (4a9dc294). Fold off sits inside the band of fold
  on (+0.9% against a 1.3% band) and the frames match.
  - Slot 427 is `$th_retired_fold`.
  - The handler, `$sprite_scan`, `$try_emit_rect_run`, `set_rect_run` and
    `--no-rect-run` / `--no-fold=rect-run` are gone.
- **All four mechanisms stay on by default.** No guard regressed outside its
  band. Each keeps its A/B flag:
  - `--uop-poor-work`;
  - `--no-uop-trace-cut`;
  - `--no-uop-mcopy`;
  - `--no-uop-hot-sticky`.
- **Left open:** the compile churn from sticky slots (21.5). Closed in
  section 22.

## 22. Hot-table aging: sticky slots with a time decay (2026-09-30, `--uop-hot-age=N`)

### 22.1 Problem

- Sticky slots (21.5) made the hot-head gate a *count*, not a *rate*.
  - A count only falls when a foreign head lands on the slot.
  - So a head entered a few hundred times across a whole run reaches the
    256 threshold eventually and installs.
- These lukewarm heads are what the churn in 21.5 was. Most are later
  retired as poor or killed by a code write:
  - StarCraft installs went from 833 to 5972;
  - Diablo from 2809 to 10805;
  - flushes about doubled everywhere.
- The old reset-on-sight gate did forget, but it also evicted Caesar's
  bottom-half tail between visits, which is why 21.5 exists.

### 22.2 Change (07c `$bx_hot_bump`)

- Every N hot-table bumps, `$bx_hot_halve` halves all 512 slot counts.
  - The clock is bumps, not wall time or batches, so it is deterministic
    under both guest clocks.
  - A head must now see about 128 entries per N bumps to install. That
    makes the gate a rate again, while a foreign head still only wears a
    count down (sticky) instead of evicting it.
- Only acts when sticky slots are on. `--no-uop-hot-sticky` is still exactly
  the pre-21.5 gate.
- Flags and counters:
  - `--uop-hot-age=N` / `set_uop_hot_age(n)`; 0 is the 21.5 behaviour.
  - `uop_hot_halvings()` counts halvings, printed on the `uop hot:` line.
  - Inherited by worker instances (`lib/worker-imports.js`).
- **Default: N = 32768 (0x8000).**
- Unit test `UOP_CASE=hot-age` in `test/test-uop-compiler.js`:
  - age 1 halves on every bump, so a 1000-trip loop never installs
    (4096 halvings, 0 installs);
  - age 0 installs it.

### 22.3 Counter sweep (one rep per age, branch clock, fixed work)

Cells are installs / kills / flushes / enters.

| game | nosticky (pre-21.5) | noage (21.5, old main) | 8K | 16K | 32K | 64K |
|---|---|---|---|---|---|---|
| sc | 1273/383/5/5.25M | 5972/2473/24/8.42M | 1699/1052/5/5.12M | 2123/1367/6/5.79M | 3107/1914/10/7.28M | 3691/2274/12/7.92M |
| h3 | 1041/99/5/61.9M | 1874/113/10/62.2M | 555/54/2/60.9M | 748/72/3/61.7M | 1196/96/6/62.0M | 1205/98/6/62.1M |
| diablo | 4252/2911/16/218.9M | 10805/7763/34/219.9M | 4805/4373/13 | 3177/2709/10/217.9M | 6660/6078/17/218.3M | 5059/4352/16 |
| c3 | 900/33/5/8.78M | 1524/38/9/8.94M | 266/18/1/7.93M | 294/21/1/8.17M | 320/23/1/8.24M | 601/36/3/8.72M |

- **4K is too aggressive.** h3's enters fell from 62M to 7.4M, and user CPU
  rose by 15%.
- **Diablo's installs are not gate churn.** They are dominated by code-write
  kills of Smacker's generated heap code: `0xc375ec` alone is recompiled
  1442-1753 times in every arm. Poor kills are 95 (noage), 49 (16K) and
  52 (32K).
- **Caesar's blit keeps compiling at 8K, 16K and 32K.** The `--uop-census`
  shows every head in 21.9 entered and live:
  - `41ceb0`, `41cf0f`, `41d1b6`, `41d4ca`, `41d7a0`, `41d7db`, `41dab9`,
    `41daf3`, `41ddcd`, `41de07`, `41e007`;
  - each with ~7K-247K entries, the same as the noage arm.
- Frames are md5-identical to the noage arm in every game at every age.

### 22.4 Timing (user CPU, fixed work, `--branch-clock`, fast-near-9tb-1, jobs 4)

**ab1: 16K vs noage, 3 interleaved reps**

| game | noage reps | mean (null band) | 16K reps | mean | delta |
|---|---|---|---|---|---|
| c3 | 9.15 9.31 9.02 | 9.16 (3.2%) | 9.30 9.28 9.33 | 9.30 | +1.5% |
| sc | 30.11 30.03 30.21 | 30.12 (0.6%) | 27.98 27.78 27.84 | 27.87 | **-7.5%** |
| h3 | 102.3 103.5 102.7 | 102.8 (1.1%) | 100.8 100.2 101.0 | 100.66 | -2.1% |
| diablo | 184.1 184.2 169.4 | 179.3 (8.3%) | 186.1 183.6 173.4 | 181.0 | +1.0% |

- Diablo's gameplay phase (batches 2900-4100) was consistently about 10%
  slower at 16K: 7.0 / 7.0 / 6.1 against 6.4 / 6.4 / 5.4.
- That prompted a run weighted toward gameplay.

**ab2: gameplay extended (`--extend=sc:3000,diablo:3000,h3:2000`), 3 reps**

| game | noage (band) | 16K | 32K | extended phase noage / 16K / 32K |
|---|---|---|---|---|
| sc | 45.39 (0.7%) | 44.05 (-2.9%) | **42.55 (-6.3%)** | ~2.0 / 2.2-2.3 (+10%) / 2.0 (flat) |
| diablo | 320.3 (5.5%) | 322.5 (+0.7%) | 317.2 (-1.0%) | 17.9 / 19.07 (+6.5%) / 18.77 (+4.8%) |
| h3 | 133.6 (6%) | 128.6 (-3.7%) | 131.6 (-1.5%) | flat (rep drift) |

**ab3c3: c3 at 32K, 4 reps.** noage 8.16 against 32K 8.17, neutral. Frames
identical.

### 22.5 Verdict

- **Default on at 32768.**
  - StarCraft: -6.3% on the extended route, -7.5% on the short one, with no
    penalty in its gameplay phase.
  - Heroes III: -1.5% to -2.1%.
  - Caesar III: neutral, with every blit head still compiled.
  - Diablo: -1.0% overall, inside its 5.5% band.
  - Installs, kills and flushes fall about halfway back toward the pre-21.5
    counts.
- 16K saves more churn, but it costs StarCraft's and Diablo's gameplay
  phases 6-10%. At that age a gameplay loop's heads get halved out of the
  table between their visits. 32K keeps StarCraft's gameplay flat.
- **Caveat.** Diablo's gameplay phase alone is +4.8% at 32K (17.9 against
  18.77). That is near its 5.5% band and within the whole run's -1.0%.
  - It is the one reading that leans the wrong way.
  - `--uop-hot-age=0` restores the 21.5 gate for any A/B that needs it.

## 23. FF /2 inline cache: measured, megamorphic sites retired, still off (2026-09-30)

### 23.1 What is there

The inline cache itself predates this section and is behind `--uop-icall`.

- **Compile time (07e).** `$uc_icall_class` / `$uc_icall_target` lower
  `call reg`, `call [reg]` and `call [base+idx*s+disp]` (never through ESP)
  as a kind-23 call to the target the slot holds at compile time.
- **Run time (07d).** The call is guarded by engine op 71, ICG (`v t cls eip x`).
  - The guard reads the slot again and compares it with the recorded target.
  - On a mismatch it leaves to `x`, *before the push*, with the entry
    flags. The threaded code then runs the call to whatever the slot holds
    now, so no side effect of the call precedes the check.
- **Plumbing.**
  - `set_uop_icall(0|1)` / `--uop-icall`, an app policy `uopIcall: true`,
    and a `lib/worker-imports.js` entry.
  - uop-game-ab arm `icall`.
  - Counters `uop_stats` 17/18 (pass/fail) and `uop_cstat` 28 (sites kept),
    plus the top-4 failing sites.

### 23.2 Unit tests (`test/test-uop-compiler.js`)

Every case is checked against threaded execution under both the block and
the branch clock: registers, flags, memory hash and every batch stop.

| case | what it covers |
|---|---|
| `icall-vtable`, `icall-reg`, `iat-call` | the hit path |
| `icall-mismatch` | the slot alternates between two callees every trip: miss, then deopt |
| `icall-rewrite` (new) | the loop rewrites the slot once, halfway through; the guard passes, then fails on every later trip |
| `icall-vptr-swap` (new) | `mov edx,[obj] / call [edx]` over two objects whose vptrs name two vtables; the object swaps every 128 trips |
| `icall-mega` (new) | the megamorphic rule at 4 fails: the site is marked, the failing program killed, and the head recompiled without the cache |
| `icall-poly` (new) | the same loop with the rule off: every guard is kept |

### 23.3 First A/B, and what it showed (ab4, 3 reps, hot age 32768)

| game | uop user | icall user | delta | counters uop -> icall |
|---|---|---|---|---|
| Rodent | 3.71 3.75 3.75 | 3.82 3.85 3.91 | +3.0% (band 1.1%) | installs 142->235, kills 38->140 (poor 131), enters 265K->300K; pass 199, fail 0; call-indirect declines 24->24 |
| c3 | 9.10 9.15 9.17 | 9.24 9.27 9.05 | +0.3% | pass 26; call-indirect 2->2 |
| sc | 27.89 28.07 27.64 | 28.83 28.98 28.71 | +3.4% | installs 3107->3288; pass 622874, fail 59314 over 51 sites; call-indirect 45->37 |
| h3 | 101.0 100.9 90.3 | 103.5 104.0 92.6 | +2.5% (consistent per rep) | pass 3457, **fail 298545**; enters 62.0M->50.3M; blocks 647M->585M; call-indirect 43->39 |

- Frames are identical in every arm.
- Blobby is not a fixed-work benchmark. Its thread tid=1 runs a bimodal
  352M or 603M blocks, and off-vs-off frames differ, so only its counters
  are usable: pass 600532, fail 5, 7 sites, call-indirect 9->7.
- **Heroes III's fails are one polymorphic site.** `0x58cd32` failed
  250,981 times and `0x4d1e23` 46,601 times. There is no
  re-specialization, so a program compiled around such a site leaves at the
  call on every trip.

### 23.4 Megamorphic sites (07d `$uop_icg_count`, `--uop-icg-mega=N`, default 32)

- **Counting.** Every ICG fail counts against its call EIP in a 256-entry
  direct-mapped table `{eip, fails}`.
  - It lives in the windows area's free `0x3400..0x3C00`, just past the cut
    table.
  - `$uop_flush_all` clears it along with the other verdicts.
- **Kill.** A fail at a site past the threshold sets a flag.
  `$th_uop_enter` sees it when the program returns and kills the program.
  - It is a kill, not a poor retirement, so the head may compile again. The
    program's enters are zeroed so neither poor test marks the head.
- **Refusal.** `$uc_decode` refuses a marked site's FF /2 (`uop_cstat` 31).
  The call goes back to the threaded code, exactly as without `--uop-icall`.
- **Exactness.** The rule changes only which programs exist, never what one
  does.
  - A stale or aliased table entry can only cost an inline cache.
  - The `uop_run` export clears the flag, since a direct test run has no
    enter op to act on it.
- **Plumbing.**
  - `set_uop_icg_mega(n)`, 0 to turn the rule off, inherited by workers.
  - uop-game-ab arm `icallpoly` = icall with `--uop-icg-mega=0`, which is
    exactly ab4's icall.
  - Counters `uop_stats` 21 (sites marked) and 22 (programs killed).
- No new engine op or compiler kind: ICG's slow path and the enter op carry
  it.

### 23.5 Second A/B (ab5: uop / icall / icallpoly, 3 interleaved reps each, hot age 32768)

| game | uop (band) | icall (rule on) | icallpoly (rule off) | icall counters |
|---|---|---|---|---|
| Rodent | 3.67 3.69 3.69 = 3.68 (0.5%) | 3.70 3.81 3.78 = 3.76 (+2.2%) | 3.73 3.74 3.89 = 3.79 (+2.8%) | no fails, rule idle; installs 142->235, poor 38->131 |
| c3 | 8.94 8.99 9.09 = 9.01 (1.7%) | 9.02 9.00 8.91 = 8.98 (-0.3%) | 8.97 9.10 8.97 = 9.01 (0%) | 8 sites, 26 passes |
| sc | 27.82 28.02 27.77 = 27.87 (0.9%) | 28.60 28.34 28.35 = 28.43 (+2.0%) | 28.47 28.37 28.50 = 28.45 (+2.1%) | **fail 59314 -> 100**; 3 sites marked, 4 kills, 35 refusals; installs 3288 -> 3119 (uop 3107) |
| h3 | 100.56 101.96 100.19 = 100.90 (1.8%) | 103.2 103.58 99.32 = 102.03 (+1.1%) | 104.83 104.23 89.62 | **fail 298545 -> 160**; 5 sites marked; **enters 62.0M -> 50.3M either way** |

- Frames are identical in every arm and rep.
- Declines of `call-indirect`, uop -> icall: Rodent 24 -> 24, c3 2 -> 2,
  sc 45 -> 39, h3 43 -> 41, Blobby 7 -> 6.
- Blobby, counters only (one rep per arm): pass 102-172K, fail 4, 5 sites.
- h3's third rep dropped for both icall arms but not for uop. Read h3
  pairwise by rep: icall is +2.6%, +1.6%, -0.9%.

### 23.6 Verdict

- **`--uop-icall` stays default-off.** With or without the megamorphic rule
  it is +2% on Rodent and StarCraft, at best neutral on Caesar III, and
  slightly worse on Heroes III.
  - Those deltas are outside the uop arm's band on Rodent and StarCraft.
- **The megamorphic rule works, but the fails were not the cost.**
  - It removes 99.8% of guard fails (sc 59K -> 100, h3 299K -> 160), and
    StarCraft's user CPU does not move.
- **The cost is what the cache does to program shape.**
  - Traces that now run through a call lengthen and multiply. Rodent
    installs 142 -> 235, and 131 of them are retired as poor.
  - Heroes III loses 19% of its enters (62.0M -> 50.3M, blocks 647M -> 585M).
    The first guess was that callee heads stop being entered because a
    caller's trace now covers them. §23.7's per-head census refutes that.
    The loss is the nocall retry declining or truncating call-headed heads
    once the icall edge makes their calls-followed region too big.
  - The `call-indirect` declines barely fall (2-6 per game), because most
    FF /2 sites that decline sit on paths the cache does not make hot.
- The rule is kept, default 32, active only under `--uop-icall`, because an
  inline cache without it is strictly worse on polymorphic code.
- **What would pay next** is not a better guard but a fix to the
  calls-followed fallback in `$uc_lower_head` (§23.7, option C). This
  section first proposed ending the trace at a hot callee instead; §23.7
  prices that at about 0.

### 23.7 Per-head census: the swallowing hypothesis is refuted (2026-09-30)

§23.6 guessed that callee heads stop being entered because a caller's trace,
grown through an icall, now covers their code. A per-head census of both arms
says no. Almost none of the loss is swallowing. It comes from the **nocall
fallback in `$uc_lower_head`**: once the icall edge makes a calls-followed
region too big, the retry without calls declines or truncates heads that
used to compile.

**Setup.** `fast-near-9tb-1`, one build (branch commit 1a729ae4 on 01e15d73).
Arms `uop` and `icall` (`--uop-icall`), same fixed work, `--branch-clock`,
`--uop-census`. The census counters match §23.5's totals exactly, and they
are identical across reruns. So the census does not perturb the run.
`--handler-hist` does perturb Rodent (see below).

#### The instrumentation

All records are behind `$uop_census`. The 07d header comment has the layout.
With the census off, the only cost is one global test per program entry.

- **Lifetimes.** Kinds 10 (live at a flush), 11 (live at exit) and 12
  (killed at a megamorphic ICG). With kinds 2 and 3 they give every
  program's final enters, blocks and work. A head's counts therefore sum
  over all its programs, including ones lost to a flush or a kill.
- **Exits.** Kind 13 carries a Misra-Gries dominant exit and the number of
  exits that landed on a trace cut.
- **Shape at install.** Kinds 14, 15 and 16:
  - 14: every call a program kept, with its target;
  - 15: the program's instructions as runs of consecutive addresses;
  - 16: every cut landing.
- **Kind 17** (head, first reason, calls followed, is-trace). It is emitted
  in `$uc_lower_head` just before the `$uc_nocall` retry. This record is what
  exposed the mechanism.

**`tools/uop-census-diff.js A.log B.log [--thread=N] [--json=F]`** joins the
two arms by head EIP and ranks heads by lost and gained enters and blocks.

- It marks a head *swallowed* when its EIP sits inside another head's arm-B
  program, that program keeps an icall or IAT site, and the other head's
  arm-A programs did not cover that EIP.
- It splits the change into classes:
  - **0**: the head installed in A; in B it was declined head-unsupported
    after a failed calls-followed attempt;
  - **a**: swallowed;
  - **b**: killed poor;
  - **c**: mega-killed;
  - **d**: lost install;
  - **e**: inside another program with no icall site;
  - **f**: new in B;
  - **g**: same program set.

Runbook:

```
node tools/uop-game-ab.js --games=h3,rodent --arms=uop,icall --jobs=2 --out=OUT --extra='--uop-census'
node tools/uop-census-diff.js OUT/h3-uop.log OUT/h3-icall.log --top=20 --json=OUT/h3-diff.json
```

#### Heroes III, main thread

| | uop | icall | delta |
|---|---:|---:|---:|
| enters | 61,991,195 | 50,278,513 | **-11.71M** |
| blocks in programs | 647.19M | 584.99M | **-62.19M** |
| installs | 1196 | 1050 | -146 |
| poor kills | 96 | 105 | +9 |
| mega kills | 0 | 5 | +5 |
| programs keeping an icall site | 0 | 20 | |

Thread 1 is unaffected: enters -0.2M, blocks +0.04M.

Top heads by enters lost, and the heads that took their place:

| head | enters uop -> icall | blocks uop -> icall | uop program | icall result | what happened |
|---|---:|---:|---|---|---|
| 0x4522f9 | 11.20M -> 0 | 44.79M -> 0 | trace/160 | declined, reason 3 after 1 | `call 0x58c380` head; nocall retry makes the head unsupported |
| 0x590061 | 3.76M -> 0 | 3.76M -> 0 | trace/17 | declined, reason 3 after 1 | `call 0x4d1df0` head; same |
| 0x59009b | 3.76M -> 0 | 15.05M -> 0 | trace/160 | trace/10, killed poor | retried after reason 8; nocall trace stops at its first call |
| 0x4c5d9b | 0.74M -> 0 | 2.98M -> 0 | trace/160 | declined, reason 3 after 1 | call head |
| 0x451e32 | 0.05M -> 0 | 0.37M -> 0 | trace/160 | not installed | |
| 0x4d4c79 | 3.72M -> 3.72M | 48.33M -> 14.87M | trace/160 | trace/74 | retry reason 1; the rest moved to 0x4d4e1c |
| 0x5977e1 | ~0 | 53.49M -> 34.63M | loop/198 | loop/198 | blocks moved to twin head 0x5977dc (+19.5M) |
| *gained:* 0x4d1df0 | 0.01M -> 3.78M | 0 -> 0 | trace/16 | trace/16, mega-killed once | the displaced callee of 0x590061, cutting at its icall 0x4d1e23 on every entry |
| *gained:* 0x4d4e1c | 0 -> 3.72M | 0 -> 37.17M | none | trace/160 | new head from the 0x4d4c79 split |
| *gained:* 0x58ccf0 | 0 -> 0.25M | 0 -> 0.50M | trace/31 | trace/31 | |

The full top-20 lists (lost and gained, by enters and by blocks) are printed
by the runbook above.

By class:

| class | enters net | blocks net |
|---|---:|---:|
| 0: call head, calls-followed failed, retry declined (4 heads) | **-15.71M** | **-51.54M** |
| a: "swallowed" | +0.25M | -14.52M, almost all 0x59009b |
| d: lost install | -0.08M | -1.89M |
| f: new in B | +3.73M | +37.50M, 0x4d4e1c |
| g: same program set | +0.06M | -31.38M, including 0x4d4c79 at -33.5M |

Calls-followed failures retried, by first reason:

| arm | 1 scan-limit | 4 no-backedge | 5 | 8 unreached-block |
|---|---:|---:|---:|---:|
| uop | 386 | 13 | 3 | 69 |
| icall | 352 | 14 | 3 | 76 |

The retry is common in both arms. What changes is *which* heads land in it:
the hot ones whose calls-followed region now runs through an icall. Class a
is a tool label, not a mechanism. 0x59009b sits inside 0x590066's arm-B
trace, but it lost its own program to a reason-8 retry that produced a poor
10-instruction trace. Heads that genuinely lost enters to a covering caller
total about 3.7K enters: 0x5998dd (3,420 enters, 6.9K blocks) and 0x4d4e63
(256).

**Mechanism.** `--uop-icall` turns FF /2 into a guarded kind-23 call. Regions
that follow calls then grow through targets they used to stop at, and more
hot heads hit scan-limit (1) or unreached-block (8). `$uc_lower_head` then
retries with `$uc_nocall=1`, which marks every kind-23 instruction
unsupported. That retry does three things:

1. It declines, as head-unsupported (reason 3), any head whose own
   instruction is the call: 0x4522f9, 0x590061, 0x4c5d9b.
2. It truncates other heads at their first call: 0x59009b becomes a poor
   trace/10, and 0x4d4c79 splits.
3. It pre-empts §16's span-halving retry, which only runs while the error
   is 1.

#### Rodent

| | uop | icall | delta |
|---|---:|---:|---:|
| enters | 265,075 | 300,362 | +35,287 |
| blocks in programs | 2.44M | 2.23M | -0.21M (-8.7%) |
| installs | 142 | 235 | +93 |
| poor kills | 38 | 131 | +93 |
| programs keeping an icall site | 0 | 14 | all tiny, mostly poor |
| compiled instructions / uops | 6006 / 28615 | 10744 / 53969 | about 1.8x |

- Nothing in Rodent is hot. The top-20 lists are all under 0.01M enters per
  head.
- Swallowing and option A are worth 0 here.
- The extra poor kills: 89 of 95 are not retry-related, and 54 of those are
  heads that are new in the icall arm. They sum to -156K blocks. Most are
  programs that exit at or below their head on the first ret-type exit.
- Retries by first reason: uop 1:9, 4:4, 8:6; icall 1:25, 4:7, 8:17.
- The execution shift is 0.2M blocks, which is too small to cost +2%. The
  cost is consistent with compile-side work: nearly twice the compiled
  volume, 103 more compile attempts, and 93 more installs that are then
  killed. That is not measured.

#### Connection to CPU (H3, `--handler-hist --handler-hist-thread=0`)

| | uop | icall | delta |
|---|---:|---:|---:|
| threaded ops | 1,186.03M | 1,456.69M | +270.7M (+22.8%) |
| threaded block entries | 464.07M | 533.98M | +69.9M (+15.1%) |
| blocks inside programs | 647.2M | 585.6M | -61.6M |
| H470 `uop_enter` dispatches | 116.6M | 135.4M | +18.8M |
| H39 `call_rel` | 48.1M | 67.5M | +19.4M |
| H45 `block_end` | 40.1M | 59.2M | +19.1M |
| H42 `ret_imm` | 25.3M | 36.5M | +11.2M |

- The hist runs installed 876 and 907 programs, against the census's 1196
  and 1050. Their enters and blocks still agree with the census within 0.5%.
- Threaded plus program blocks is roughly conserved (+0.75%): the work
  the tier stopped covering is run by the threaded interpreter instead, at
  about 3.9 extra threaded ops per moved block.
- The blocks that gained threaded entries are exactly the lost programs'
  bodies:
  - 0x58c380, 0x58c395, 0x58c3e5 and 0x58c3eb, +11.9M each (the callee of
    0x4522f9);
  - 0x4522fe, +11.15M;
  - 0x5900ab, 0x5900b2 and 0x5900e5, +3.7M each;
  - 0x4d1df0 and 0x58ccf0, +3.7M.
- `uop_enter` dispatches *rise* while program enters fall. The failed-install
  heads keep probing the tier from threaded code.
- The census run's own single-run, loaded-box timing had icall at +1.9%
  gameplay and +3.0% for the whole run. That agrees in sign with §23.5 and is
  not a measurement.

On Rodent `--handler-hist` changes tier behaviour: both arms install 86
programs, and the icall effect disappears. The Rodent hist pair is therefore
unusable, and Rodent's CPU claim rests on the census alone.

#### Verdict and what to change

- **Swallowing is not the mechanism.**
  - The measured cost of callee heads covered by an icall caller's trace is
    about 3.7K enters on H3 and 0 on Rodent.
  - H3's -11.7M enters and -62M blocks are the nocall-retry fallout above.
  - Rodent's +2% is compile churn from 93 extra short-lived installs.
- **Option A** (end a trace at a guarded call whose target is already a hot
  head) prices at **about 0 on both games**.
  - It targets the covering, which costs nothing measurable.
  - It could help only indirectly, by shrinking the regions that hit
    scan-limit. That is a blunt form of option C and is not measured.
- **Option C** is the lever; it is not implemented. When a calls-followed
  attempt fails, `$uc_lower_head` should:
  - retry first with only the icall sites as the edge (keep E8 calls
    followed), and/or halve the span, before falling back to nocall;
  - never let the nocall retry decline a head whose own instruction is
    the call.

  The upper bound is the icall arm back at the uop arm's program coverage on
  H3: about +11.7M enters and +62M program blocks, and 62-70M fewer threaded
  block entries. That removes the +22.8% threaded ops seen above. Whether the
  inline cache then turns positive is a separate question; §23.5's A/B would
  have to be rerun.
- `--uop-icall` stays default-off.

## 24. Retry ladder: calls-followed failures no longer fall straight to nocall (2026-11-06, default on)

§23.7's option C, implemented in `$uc_lower_head` (07e). It ships in the
default build as mask `$uc_ladder` = 7. `--no-uop-retry-ladder` (mask 0)
restores the pre-§24 order exactly, and `--uop-retry-ladder=N` selects
rungs one at a time.

### 24.1 What it does

When a calls-followed attempt fails, the compiler now tries these in order
before it gives up on following calls (`$uc_nocall` mode in brackets):

1. **icall cut** (mask 1, mode 1). Retry with only the FF /2 inline-cache
   sites as the region's edge. E8 calls are still followed. This runs only
   when the scan actually met such a site.
2. **halve first** (mask 2, mode 0). Halve the span with calls still
   followed, on scan-limit (1) or unreached-block (8). The old order halved
   only after the nocall retry, and only on reason 1.
3. **nocall keeps the head's own call** (mask 4, mode 2). The nocall retry
   cuts every call except the head instruction's. So a head that *is* a
   call compiles with its callee followed, instead of declining as
   head-unsupported (reason 3).

Census kind 18 records which rung ended the ladder. `uop_cstat` 32-36 count
the rungs, run.js prints them as a `uop ladder:` line, and
`tools/uop-census-diff.js` prints "ladder endings" per arm. The new
uop-game-ab arms are `ladder`, `noladder`, `icladder`, `icnoladder`,
`ladhalve`, `ladhead` and `ladicut`. `--trim=GAME:N` ends a route early so a
timed run fits the 30 s cap.

### 24.2 Unit tests

`test/test-uop-compiler.js` has one case per rung, each with an old-order
control, run on both clocks:

- `ladder-halve`: the old order loses the head as no-backedge.
- `ladder-icut`: the old order enters 0 times.
- `ladder-head-call`: the old order declines head-unsupported.

The suite passes in full on main ed1aa7e6 plus the ladder.
`movsd-nfs-record-loop` and `nobump-mark`, flagged as at risk when this work
was paused, pass under mask 7.

### 24.3 Counters and frames (fast-near-9tb-1, i9-9900K, Node 20.11.1, one build, `--branch-clock`, `--uop-census`)

The box built the same wasm as the laptop: sha256 `a8c622f8...`, identical.

**Heroes III, main thread:**

| arm | program enters | program blocks | installs | poor | gameplay guest s (4100..5101) | ladder endings |
|---|---:|---:|---:|---:|---:|---|
| noladder | 62.08M | 647.6M | 1044 | 95 | 7.4 | nocall 308, failed 94 |
| ladder | 61.96M | 649.7M | 1034 | 91 | 7.4 | halved 111, nocall-head 52, nocall 166 |
| icnoladder | 63.31M | **456.5M** | 1699 | 538 | **17.9** | nocall 458, failed 100 |
| icladder | 62.11M | **671.7M** | 1252 | 118 | 7.4 | halved 164, icut 41, nocall-head 63, nocall 211 |

- Final frames are identical in all four arms.
- Gameplay times come from concurrent census runs (jobs=4), so they are
  not a timing. A 2.4x gap is still unambiguous.
- **The §23.7 call heads install again.**
  - The work 0x4522f9 carried under uop (11.15M enters, 44.6M blocks) is
    entered at 0x4522f6, three bytes earlier, on today's main. In
    icnoladder that head is declined (reason 4 after 1). In icladder it is a
    trace/160 with 11.15M enters and 44.6M blocks.
  - 0x590061 goes from decline 3 to trace/17 (3.72M enters), and 0x4c5d9b
    from decline 3 to trace/160 (0.74M).
  - The H3 icall arm therefore ends with 24M *more* program blocks than
    plain uop, where before it had 191M fewer.
- With icall off, the ladder moves 0x4522f9's work to a trace headed at the
  caller 0x4521db (11.20M enters, 56.0M blocks). Net program blocks change
  by +2.1M.

**StarCraft (main + tid 2):**

- Frames are identical in all four arms.
- Ladder vs noladder: installs 2979 -> 2832, main blocks 169.6M -> 172.1M.
  Rungs: halved 93, nocall-head 30.

**Rodent:**

- Frames are identical in all four arms.
- icnoladder -> icladder: program enters 284K -> 411K, blocks 2.20M -> 3.19M
  (uop: 2.45M).

**Caesar III:**

- Program enters 32.3M -> 39.0M with the ladder, and installs 432 -> 464.
- Frames differ, but this is not a ladder fault:
  - `off` already differs from `noladder` on city.png and city-later.png,
    and `noladder` and `noladder2` are identical. So c3 is not clock-exact
    across tiers on main (the fold families that §8 notes do not charge
    trips under `--branch-clock`).
  - Ladder vs noladder: city.png is identical. name.png differs by a 4x2
    caret, and city-later.png is a later simulation frame. Both are timing
    divergence of the same kind.

**Diablo:** stopped. The census run reached batch 1080 of 4100 in 70
minutes on this box.

### 24.4 Timing (fast-near-9tb-1, quiet, load 1.0-1.2)

The method:
- one run at a time, under `/tmp/wine-assembly-diablo-benchmark.lock`;
- arm order rotated every rep;
- fixed work, process user CPU (`/usr/bin/time -p`);
- band = (max - min) / median.

| game | noladder | ladder | icnoladder | icladder |
|---|---|---|---|---|
| Rodent, whole run, n=7 | 4.79 [4.77..4.84] band 1.5% | 4.79 [4.76..4.83] **0.0%** | 4.87 [4.84..4.94] **+1.7%** | 4.81 [4.77..4.85] **+0.4%** |
| sc `--trim=sc:2800`, n=5 | 27.71 [27.54..27.73] band 0.7% | 27.89 [27.83..28.13] **+0.6%** | 27.19 [27.13..27.32] **-1.9%** | 27.93 [27.79..28.43] **+0.8%** |

- **Rodent.** The ladder is neutral. It recovers icall's loss: +1.7%,
  outside the band, becomes +0.4%, inside it.
- **StarCraft.** This run is boot-dominated: gameplay 1750..2800 is 0.8 s of
  guest time.
  - The ladder costs +0.6%, and the ranges do not overlap. That is the
    price of the extra compile attempts (halving retries) during boot.
  - icnoladder at -1.9% reverses §23.5's +2.0%, which was a full route on
    another box. This is one window on one box; it is not read as an icall
    win.
- **Heroes III and Caesar III** were not timed. Their routes run about
  130 s and 70 s, over the 30 s cap. Their counters are in §24.3.

### 24.5 Native code

Native code was not captured. The ladder changes which programs are
compiled, not how they run:
- 07d's source diff is a comment;
- the engine ops and lowering are unchanged;
- 07e's change is confined to `$uc_lower_head`, `$uc_form_loop`'s call
  classification and new counters.

The disassembly rule in CLAUDE.md applies to runtime code-shape variants.

### 24.6 Verdict

- **The ladder stays on (mask 7).**
  - It is neutral on Rodent and on H3 gameplay, and it adds coverage on
    H3, StarCraft and c3.
  - It costs +0.6% on StarCraft's boot-heavy window.
  - It is the prerequisite for `--uop-icall`: without it, icall loses 29%
    of H3's program blocks and runs gameplay 2.4x slower.
- **`--uop-icall` stays default-off.** With the ladder it is at parity, not
  a win: Rodent +0.4%, sc +0.8%, H3 gameplay 7.4 s vs 7.4 s.
- **What is left:**
  - a timed H3 gameplay comparison that fits the cap (it needs a cheaper
    way into the adventure map);
  - pricing StarCraft's boot compile cost per rung (`ladhalve` / `ladhead`
    arms);
  - Diablo counters on a faster box.
