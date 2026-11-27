# Stacked performance strategy

Status: design, 2026-11-25. This is the umbrella document. Each layer has its own detailed design:

- [uop-optimizer-pipeline.md](uop-optimizer-pipeline.md): the compiler pass stack
- [known-routine-framework.md](known-routine-framework.md): native bodies for recognised library routines
- `wat-representation-bench.md` (in progress): microbenchmarks of WAT representation choices
- Delphi corpus (in progress): the test set for the Delphi entries

## 1. The thesis: we have been measuring optimisations one at a time

Every interpreter and compiler idea we tried in isolation measured as neutral or small:

| Idea | Measured alone |
|---|---|
| CMP+Jcc fusion | neutral |
| page compile | dead even |
| next-dispatch | negative |
| uop entry round trip | ~1% |
| fold-bench A: no-backedge call/ret programs | +0.4% |
| fold-bench A+B: seam skipping | −3.5% |
| fold-bench A+B+C: read-only constant folding | −2.4% |
| SSE in uop programs | −4.6%, all from coverage |

The one result that moved the needle was fold-bench **D**, a hand-written native version of the Delphi RTTI helpers: **−16.2%** on Spelunky Classic gameplay and −4.7% on metrojd. D is what you get when every optimisation is applied at once by hand: the TypeInfo loads fold, the kind ladders fold, the field loop unrolls, `Move` becomes a fixed copy, and no calls are left.

The individual passes failed because each one's output was only useful to a pass that did not exist:

```
 C folds absolute loads ── but _CopyRecord loads [ECX+k]
   ECX is constant only if a lattice carries the caller's  mov ecx,[imm]  across the call
     that needs per-CALL-SITE inlining ── shared bodies merge Move(16) and Move(4) into "unknown"
       known constants need branch folding to delete the kind ladders
         known trip counts need unrolling to delete the loop
           straight-line code is what makes dead-flag and load elimination pay
```

**Rule:** an optimisation is judged inside the stack it is meant to enable, never on its own.

## 2. Two layers, one boundary

```
                    guest x86 code
                          │
          ┌───────────────┴────────────────┐
          ▼                                ▼
  KNOWN-ROUTINE LAYER               OPTIMISER PIPELINE (uop tier)
  "this is _CopyRecord"             "this is code; make it smaller"
  matched by masked-body hash       region formation + per-call-site inlining
  or by DLL export name             constant lattice + read-only folding
  hand-verified native body         value specialisation (guarded variants)
  fitted clock table                branch fold, unroll, dead flags/loads
          │                                ▲
          └──── KCALL op inside programs ──┘
                (the region continues past the call)
```

- **Known routines** cover code where a native body is much better than anything a generic compiler would derive: memcpy-class loops, RTTI walkers, string refcounting, `_ftol`.
- **The pipeline** covers everything else, including app code that no signature will ever match.
- **The boundary:** a recognised call lowers to `KCALL` with a declared effect summary. The pipeline inlines a guest body instead only when constant folding leaves a loop-free residue of at most 16 µops; otherwise it emits `KCALL`.
- **Pure summaries feed the lattice.** For example, `_LStrAsg` keeps ESI live.

### What the census says each layer is worth

| Population | Where | Weight |
|---|---|---|
| Static MSVC helpers (`_allmul`, `_chkstk`, `memcpy`, `_ftol`, `strlen`…) | 300–850 of 2,186 images | a few % per app (GTA2: `_ftol` 6.6%) |
| Delphi System helpers | ~30–45 images | **50%** of block entries in Spelunky Classic, 21% in metrojd |
| Dynamic CRT, by import name | UT2003 / UT2004 / Unreal | 14–20% |
| App code (Heroes II, StarCraft) | everything else | 99% |

Known routines alone help a minority of apps a lot. The pipeline is the only lever for the rest, Heroes II and StarCraft included.

## 3. Shared contracts

Both layers obey the same exactness rules. They are what keep headless runs deterministic and A/Bs comparable.

1. **State at exit is the guest's.**
   - Registers and flags at any exit equal what the guest code would have left.
   - Flags are rebuilt in exit stubs; registers are dead only with evidence.
   - No guest-visible store is ever removed. A folded store becomes a constant store.
2. **The clock is charged exactly.**
   - Each straight-line segment, or native path, charges the blocks the guest would have retired: base + trips × per-trip.
   - Tables are fitted by tool (`tools/kr-clock.js`, or D's branch counts used as an oracle), never written by hand.
   - When the budget cannot pay, execution falls back to the segment start, or the routine declines at entry.
3. **Decline before side effects.**
   - Native bodies range-check before their first write and never fault themselves.
   - Partial paths resume at a precise instruction boundary.
4. **Invalidation covers everything folded.**
   - The whole matched body extent and every folded read-only range are registered for code-write invalidation.
   - `VirtualProtect` and unmap must kill folded programs too; today they only bump the epoch.
5. **Threads.**
   - Locked operations lower to plain RMW only under `LOCK_MODE` 0, where only one guest thread exists. The mode is stamped at compile time and checked on enter.
   - Read-only folding stays cooperative-only until cross-Worker invalidation is proven.
   - Every new mutable global is per-thread or propagated at spawn.

## 4. How it is built

- **One implementation pass.** Pipeline stages 0–8 are written together on branch `uop-opt` and land once. Session history and WIP commits are the checkpoints.
- **Mask bits are not stages.** `--uop-opt=MASK` has one bit per pass, default 0, and `MASK=0` must produce byte-identical programs. The bits exist only for leave-one-out measurement and for bisecting a divergence.
- **Deferred items, each waiting on another result:**
  - stage 9, register residency in locals: waits on the WAT representation microbench;
  - stage 10, `KCALL`: waits on the first known-routine entries.
- **Known-routine rollout:**
  - `--known-routines=none|all|ids`, default off;
  - an entry turns on only after it passes the differential harness (registers, flags, memory hash, x87, both clock meters at every budget cut, two-thread race) and a box A/B;
  - first entries, in order: Delphi RTTI, Delphi LStr, Delphi `Move`, static `memcpy`/`memmove`, then the `_ftol` migration;
  - the existing one-off mechanisms move onto it: the `_ftol` static body, the SBH matcher, CRT and native overrides, and fold-bench D.

## 5. How it is measured

```
 correctness (laptop, counts only)            timing (disposable quiet ascii.dev box)
 ─────────────────────────────────            ───────────────────────────────────────
 API counts / presents / PNG md5 identical    S0 → S8 cumulative curve
   per bit alone (with prerequisites)         leave-one-out from the full stack,
   and with all bits on                         pure and with its dependents off
 under --branch-clock and the default clock   D as the oracle the stack should match
 ledger counters: folds, deleted loads,       null arms for the band (~0.2–1.5%)
   enters per x86 instruction, service calls  V8 + SpiderMonkey disassembly,
                                                x86-64 and arm64
```

- **Credit each pass by its ledger counts as well as by time.** A pass that only enables others shows up in the leave-one-out column, not the cumulative one.
- **Workloads:**
  - Spelunky Classic and metrojd: Delphi-heavy;
  - Spelunky HD: SSE and D3D9;
  - Heroes II and StarCraft: app code, the controls that keep us from tuning to one game;
  - the Delphi corpus: at least 8 binaries across compiler versions, plus a Free Pascal negative control.
- **The microbench** checks the representation choices underneath both layers: registers in memory/globals/locals, lazy vs eager flags, dispatch shape, inline memory access, XMM state, atomic vs plain RMW, op encoding and clock charging. It runs on V8 (TurboFan, Liftoff), SpiderMonkey, JSC, a pure interpreter, and wasm2c+clang. A choice is adopted only if it wins across engines, not on one JIT.

## 6. Predictions (testable)

| Claim | Expected |
|---|---|
| Full stack without D, Spelunky Classic | −10 to −14% |
| Full stack + D (or the Delphi known-routine entries) | −17 to −19% |
| Leave out A (RET exits) | loses ≥ 2/3 of the gain: A flips from neutral to essential |
| Leave out C (read-only folding) | costs ≥ 4 points; folds grow ≥ 10× with the lattice |
| SSE native ops, Spelunky HD | further −3 to −6% |
| StarCraft | −2 to −5%, from inlining |
| Heroes II | inside its null band in every arm |
| CMP+Jcc fusion, next-dispatch, page compile | stay neutral |
| Register residency in locals | −1 to −3% at most |

If the cumulative curve flattens before folding (stage 3), the thesis is wrong for this tier, and we stop before stages 4–8. If it holds, the Delphi known-routine entries are confirmed as the expected bonus on top of a generic win, not the only win.

## 7. Risks

- **Compile cost.** 68% of compiles today are repeats caused by verdict-map aliasing. Stage 0 fixes that first.
- **Clock mismatches that look like semantic bugs.** Mitigation: every-budget-cut tests and the bisect bits.
- **Spills.** Any call added to the hot engine loop makes SpiderMonkey Ion spill `$pc`; the disassembly gate catches it.
- **False-positive signatures.** Mitigation: full masked-body hash, callee constraints, function-entry plausibility, the Free Pascal negative control, and corpus match counts as a regression check.
- **Tuning to one game.** Every sweep includes the control workloads.
