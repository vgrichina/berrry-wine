# Known routines: signature-matched library code executed as native WAT

Status: design, 2026-11-25. No emulator code was written for this.
Evidence: `scratch/runs/20261125-known-routine-census/` (signature census,
three short `--no-uop` handler-hist runs, attribution of four existing hists).
Companion: `docs/design/uop-optimizer-pipeline.md` §7, which proposes the
`KCALL` interface this framework adopts (§9).

## 0. Summary

Fold-bench "arm D" (branch `fold-bench`, 58611e87e..097dcf549) ran five Delphi
`System` helpers as native WAT bodies: `_CopyRecord`, `_FinalizeRecord`,
`_FinalizeArray`, `_LStrAsg` and `_LStrClr`. It found them by their bytes,
charged the clock exactly and fell back to the guest body whenever a fast-path
precondition failed. Results: Spelunky Classic −16.2 % / −10.6 %, metrojd
−4.7 %, Heroes II inside its band. API calls, batches, presents and PNG md5
were all identical.

This document turns D into a framework, with these parts:

- a **registry** of routines;
- **two matchers**: a byte signature for statically linked code, and the
  import name for DLL exports;
- **one native-body contract**;
- a **clock-charge model** that a tool derives from the guest body rather than
  someone writing it by hand;
- **one differential harness**;
- **one flag** with a per-entry kill switch.

The census says where the payoff is. Statically linked MSVC helpers are in
nearly every PE in the corpus (`_allmul` in 846 of 2186 distinct images,
static `memcpy` in 682, `_ftol` in 549), but they are a few percent of any
one app's time. Delphi `System` helpers are in only 29–45 images, but they
are **20.6 % of threaded block entries in metrojd and 50 % in Spelunky
Classic**. The first entries are therefore the D family, done generally,
then the data-dependent MSVC loops (`memmove`, `memset`, `strlen`). The
register-only helpers come last, and only if measurement says so.

## 1. Goals and non-goals

Goals:
- **Identify by signature.** Recognise routines whose behaviour is fixed by a
  library contract, by bytes, in any module, at any load address, in any
  compiler build we have a signature for.
- **Run them natively** under exact clock charging, so batch boundaries, API
  sequences and frames are unchanged.
- **Fall back, never trap.** Any input the native body does not handle runs the
  guest body from a precise instruction boundary.
- **One mechanism.** Absorb the ad-hoc "recognise library code and run it
  natively" mechanisms we already have (§8) under one registry, harness and
  flag.

Non-goals:
- **No new calling convention, and no runtime wasm codegen.** Bodies are
  hand-written WAT compiled into the module.
- **Not idiom fusion.** Instruction idioms anywhere in the code (decoder
  fusions, `07b` loop matchers, uop `COPY`/`FILL`/`MCOPY`) stay in their
  layer (§8).
- **Not an interpreter for interpreters.** VB6's `ProcCallEngine` (68 % of
  SimCity 2001 VB's threaded entries) is a p-code interpreter. Running it
  natively is a separate project, not a registry entry.
- **No app-specific patches.** Per-app behaviour belongs in `lib/apps.js`
  perf policy, not here.

## 2. Inventory: what exists today

| Mechanism | Where | Matched by | Guard / fallback | Clock | Tests | Payoff |
|---|---|---|---|---|---|---|
| Static MSVC `_ftol` → handler 500 | `$ftol_body_at` `src/10-helpers.wat`; decode-entry check in `$decode_block` (`07-decoder.wat`); `$th_ftol_native` `06-fpu.wat` | exact 39-byte body inside one 4 KB page, at block entry | publish covers the 39 bytes, so a write invalidates; no runtime fallback | one block (RET emitted after); scratch stores below ESP and flags not reproduced | `test-ftol-static-body.js` | Croc 2: 14 % of block entries; Quake 2 `ref_soft`: 182 k entries |
| MSVC SBH scan loop | `$sbh_match_mode` `10-helpers.wat`, `$sbh_note_candidate` in decoder | byte pattern with ESI/EDI variants, two armed slots | pattern match per decode | `chain_bump` | MW3 gameplay test | MSVC small-block heap scans |
| AoE `stack_packet` (356) | decoder entry + `$th_stack_packet` `05-alu.wat` | armed address and variant | app-armed | own | `test-aoe-stack-packet-handler.js` | AoE |
| Import-name native overrides | `$native_override_export_api_id` `08b-dll-loader.wat` (`_ftol`, `_stricmp`, `ceil`, `sqrt`, `sin`, `pow`, `_CIpow`, …) | export name at IAT bind | none: no way back | an API call | `test-msvcrt-ftol-native.js` | UT/Unreal math |
| CRT overrides with defer-to-authentic | `$crt_override_api_id`, `$crt_native_override_defers`, `$crt_override_record`/`_real`, `$crt_fallback` (`09a6-handlers-crt.wat`), `$patch_caller_iat` | export name, only MSVCRT/MSVCR7x with a real export record | defer to the real export (`_stricmp` locale) | "a native CRT call retires no blocks": fixed-batch comparisons drift | `test-crt-native-overrides.js` (124 cases, authentic vs thunk, EAX/ESP/12 KB arena/x87) | UT2003 ~17 % further per CPU (`floor` 19.5 %, wide-string set) |
| `msvcrt` globals init | `initMsvcrtGlobalsSteps` `lib/dll-loader.js` | `mov eax,imm32; ret` body shape; calls real `_set_sbh_threshold(0)` | the byte-pattern patch it replaced silently matched nothing on MW3's MSVCRT | n/a (load time) | loader tests | correctness |
| Clock-spin / peek-spin park | `$clock_spin_step`, `$peek_spin_step` `09a7d-handlers-shell-file.wat` | same ms, call site, ESP, register fingerprint, block-work limit | K threshold, not inside a synchronous send | yields 14/15 | `test-clock-spin-*.js`, `test-qpc-spin-park.js`, `test-sync-send-spin-park.js` | idle CPU; D2 false positive (4 → 41 fps with K=0) |
| Logical frame marker (476) | decoder; `lib/apps.js` `perf.logicalFrame` (13 apps) | address + verifier bytes | verifier | none (telemetry) | `test-present-logical-frame.js` | pacing/telemetry |
| Decoder idiom fusions | `07-decoder.wat`: RLE_RUN 429, implode 466, `test_jcc` 404, `fnstsw_test_ah_jcc` 439, stack runs 472–475, … | instruction idioms anywhere | per-fusion | per-fusion, charged against both meters | `test-tree-fold.js`, `test-wat-dib-rle.js`, … | RLE_RUN +7 % Caesar |
| `07b` loop matchers, x87 fusion | `07b-loop-match.wat` | loop shapes | shape checks | `$bc_fold_charge` | `test-debug-x87-fold.js` | x87 −16 % |
| uop `COPY`/`FILL`/`MCOPY` | `07e-uop-compiler.wat`, `07d-uop-engine.wat` | `rep movs/stos`, unrolled `mov` pairs | window guards, `$uop_bulk_slow` | uop block ends | `test-uop-compiler.js`, `test-rep-movs-fault-restart.js` | H3 gameplay −51 % (whole tier) |
| **Delphi RTTI/LStr fold** (on by default, `--no-delphi-fold`) | `src/10-helpers-delphi-fold.wat`: `$dfold_at`, threaded handler 395 | first dword + FNV-1a over the masked body, skipping E8/E9 rel32, plus callee signature (`$d_sig`, `$d_move_form`) | `entry+k` resume; native only for aligned unshared refcounts and a single AnsiString field; partial paths up to `FreeMem`; refcount/slot changes are atomic CAS, a lost CAS falls back | per-path branch tables (`$d_clr_pre`, `$d_asg_pre`, `$d_move_pre`), `$d_can` checks the budget before anything is written, otherwise falls back | `test/test-delphi-fold.js` | Spelunky Classic D −10.6 % / −16.2 % (fold-bench) |

D's block publish covers only the first instruction, to avoid re-hashing when
the guest body resumes. Code writes are covered separately: `$dfold_emit`
registers every byte range the native form rests on (the body, each callee it
includes, the System.Move `_CopyRecord` assumes) in up to four per-instance
range groups, and `$invalidate_code_range` calls `$dfold_code_write`, which
drops every page of a group a store lands in. The next entry re-decodes and
re-checks the signature. It landed in the retired SMACK_HUFF slot 395, because
502–511 belong to `--sse-fast` and growing the table past 512 would also grow
the 1 MB handler pair-histogram region, which the memory map has no room for.

## 3. Census

Method: `scripts/krsig.js` (a research prototype, JS).

- `extract` builds a signature from a reference binary:
  - the first ≤32 bytes, cut at an instruction boundary;
  - masked bytes: HIGHLOW base-relocation targets, E8/E9/0F8x rel32, and, in
    a binary with no `.reloc`, any in-image 4-byte value;
  - plus the masked body up to the next known start, as a full-length check.
- `scan` walks `test/binaries` (2186 distinct PE images, deduplicated by
  hash), finds the longest unmasked anchor with `indexOf`, and counts prefix
  and full matches.
- `weigh` charges handler-hist blocks to matched extents:
  - matched extent = signature start → next known start, capped at 2 KB;
  - DLL exports fall back to "nearest preceding export";
  - full matches beat prefix-only matches.

The reference bodies come from five sources:
- the exports of five CRT DLLs (VC2, VC6, VC7.0, VC7.1, VC8);
- static helpers seeded from `gta2.exe` and `H2DEMOW.EXE`;
- Delphi 7 `System` from Spelunky Classic, at the VAs in
  `docs/re-notes/spelunky-classic.md`.

### 3.1 Presence: distinct PE images with a full masked-body match

| Routine (static unless noted) | Images | Note |
|---|---|---|
| `_allmul` | 846 | 25 bytes, register-only |
| `_aulldiv` / `_aullrem` | 824 / 748 | |
| `_chkstk` | 788 | probe loop, one trip per page |
| static `memcpy` (VC5/6 lib) | 640 (682 prefix) | |
| `strchr` | 619 | |
| `_ftol` | 549 | handler 500 already covers this exact body |
| `strlen` | 486 | dword sentinel scan |
| `memset` | 458 | |
| `memmove` (H2 build) | 308 (314 prefix) | |
| `strcmp` | 69 (347 prefix) | a variant family |
| `_alldiv` / `_allshl` / `_allshr` | 246 / 261 / 75 | |
| Delphi `_LStrClr` / `_LStrAsg` | 45 / 43 | Game Maker 5/7/8, Delphi 6/7 tools, Age of Wonders 2, Far Manager, Tetravex, … |
| Delphi `_FinalizeRecord` / `_FinalizeArray` / `_CopyRecord` / `_InitializeRecord` | 30 / 30 / 29 / 26 | the 13 Game Maker game exes are all here |
| Delphi `Move` (GM8 build) | 11 | other `Move` builds differ: one entry per variant |
| zlib (`inflate 1.` string) | 113 | presence only; no body census |
| MSVBVM60 import string / FastMM string | 26 / 11 | |

SEH helpers (`_global_unwind2` 822, `_except_handler3` 773) are everywhere
and cold: they are not candidates.

### 3.2 Weight: share of threaded block entries

| App, window | Known-routine share | Source |
|---|---|---|
| Spelunky Classic gameplay 29600:32600 | **Delphi System 50.3 %**: `_FinalizeArray` 12.7, `_FinalizeRecord` 11.1, `Move`\* 9.8, `_CopyRecord` 9.6, `_LStrAsg` 5.8, `_LStrClr` 1.1, `_InitializeRecord` 0.3 | existing run-b hist (uop on: 822 M uop blocks not attributable) |
| metrojd GM7, `--no-uop`, 1500:3000 | **Delphi System 20.6 %**: `_FinalizeArray` 5.7, `_FinalizeRecord` 5.5 (2.7 of it a GM7 variant that only matched the prefix), `_InitializeRecord` 4.7, `_LStrClr` 2.5, `_CopyRecord` 1.7, `_LStrAsg` 0.6 | `runs/metrojd-weigh.txt` |
| Heroes II demo, `--no-uop`, 1000:1800 | `memmove` 0.82 %, `memset` 0.08 %; game code 99 % | `runs/heroes2-weigh.txt` (fold-bench's cpu-window; D neutral there). Other windows: `memmove` ~6.5 pts (`hot-loop-vocabulary-2026-09`) |
| Quake 2 gameplay (threaded part) | `_ftol` 0.45 %, `_chkstk` 0.34 % | `runs/q2-weigh.txt`, from the uop-coverage census |
| GTA2 loading / gameplay | `_ftol` 6.6 %, `__allmul` 2.95 %, `__allshr` 2.66 % / `__allshr`+`__allmul` 2.84 % | `hot-loop-vocabulary-2026-09` TSVs |
| SimCity 2001 VB | `ProcCallEngine` 68 % (out of scope); helpers, by nearest export: `__vbaVar2Vec` 6.2, `__vbaVarCat` 3.5, `__vbaUnkVar` 3.5, `rtcCommandBstr` 2.3 | `runs/sc2001vb-weigh.txt` |
| UT2003 / UT2004 / Unreal / Morrowind (dynamic CRT) | `floor` 19.5 %; `_woutput` 14.5 %, `mbtowc` 5.5 %, `_wcsicmp` 2.8 %; `fread` 13.9 %; `_output` 4.4 %, `qsort` 4 % | `docs/crt-native-overrides.md` |
| Black & White 2 | `strlen` 10.5 % (exe body) | re-notes |

\* The Spelunky `Move` extent runs to the next known start, so it
over-counts: the re-notes measure `Move` at 4 %. Each row is a lower bound
on library time, because threaded entries do not count uop-tier blocks.

**Reading.** A routine pays when two things hold:
1. It is hot in some app.
2. Its cost is **data-dependent work** (a refcount walk, a byte loop) rather
   than dispatch of a short fixed path.

This matches the fold verdict: memory-traffic folds pay, control-flow folds
don't, and fewer dispatches ≠ faster. `_allmul` passes test 1 in GTA2, but it
is a 25-byte single-branch body that the uop tier already compiles, so it is
expected to be small. The Delphi family and the byte loops pass both tests.

## 4. Matching

**Two matchers, one registry.**

- **Bind matcher (DLL exports).** It matches on module class plus export name
  at IAT bind, as `$crt_override_api_id` does today. It needs no bytes,
  because the DLL's identity *is* the contract (with the existing guard:
  MSVCRT/MSVCR7x with a real export record). The per-entry fallback is the
  real export, the existing `$crt_fallback`.
- **Signature matcher (static code).** It is used for everything linked into
  an exe or a non-CRT DLL.

**When the signature matcher runs.** It runs at **module load**, not per
decode.

- After a module is mapped and relocated, a WAT pass scans the module's
  executable sections once for each signature's anchor. It writes every
  full-match start into a **claim table**, a hash of guest EIP →
  `{entry id, extent}`.
- The decoder then does one hash probe per block entry. That replaces the
  current "try `$ftol_body_at`, `$sbh_note_candidate`, … at every decode".
- Masked bytes are exactly the ones relocation or linking change, so a
  post-relocation scan matches the same bytes as the reference.
- Cost: the census scanned 9.8 GB in 61 s of JS with `indexOf`. One module
  is a few MB, so it costs milliseconds.
- Code generated at runtime (unpackers, self-extracting exes) is caught
  lazily. A decode at an unclaimed EIP inside a page whose code bytes were
  written after load asks the same matcher once and caches the result.

**Signature format** (registry JSON, generated into a WAT data segment by a
tool, as `gen_dispatch.js` does):

```
{ id, name, family, variant, conv: "cdecl|stdcall|delphi-register",
  prefix: "8b54240c8b4c2404 85d20f84........",   // bytes and wildcards
  body:   { len, fnv1a },                        // hash over masked body
  callees: [{ at: 0x1c, sig: "Move/gm8" }],      // rel32 targets must match
  extent, semantics: "<id of native body>",
  clock: "<id of charge table>", ref: "path#sha256@va" }
```

- **Variants are separate entries.** Several entries may share one native
  body when they differ only in encoding.
- **Callee constraints are part of the match.** D needed this, because metrojd
  links a different `Move` under the same `_CopyRecord` bytes.
- **Callee signatures match recursively.** A callee signature is itself
  another entry's signature, not a bare hash.

**Compiler-version variants.** The census shows that real variation is per
library build:
- the VC6 DLL and static-lib `memcpy` share a prefix but not a body (682
  vs 640);
- `strcmp` has a 347-image prefix family with only 69 full matches;
- GM7's `_FinalizeRecord` matched the GM8 prefix but not the body.

**Rule: only full matches claim.** A prefix-only match is a census lead for a
new variant entry, never a claim.

**False positives.** A full match must also:
- start at a plausible function entry (preceded by `ret`/`int3`/`nop`
  padding, or the target of a `call` in the module);
- have extents that do not overlap.

`kr-sig scan --verify` reports every full match that fails either check
across the corpus. The build gate checks that the registry's expected
corpus counts still hold. A full masked body of ≥ 24 unmasked bytes plus
callee constraints has never collided in the census. Short bodies (`_allshr`,
16 bytes) need an anchor that includes the instruction after the body (the
next function's alignment padding), or else they stay bind-only.

## 5. The native body contract

A native body replaces "CALL target … RET" as observed by the caller. Its
obligations follow.

**Entry and exit.** At entry:
- EIP = the routine start;
- the return address is at `[ESP]`;
- arguments follow the declared convention.

On success:
- EIP = the popped return address;
- ESP is adjusted as the body's `RET`/`RET n` would leave it;
- return values are in EAX/EDX (or ST0 for x87 returns);
- callee-saved registers (EBX/ESI/EDI/EBP) are unchanged.

**Clobbers.** The caller-saved registers the guest body leaves
(ECX/EDX/EAX scratch, flags, the x87 control word) are **reproduced
exactly**. The exception is a register declared `dead` in the entry, which
needs evidence:
- the convention makes it dead;
- the harness has compared it under the convention's live set;
- the corpus has no caller that reads it.

`_ftol`'s flags and scratch are the existing precedent.

**Stack below ESP.** Scratch stores below the final ESP (`_ftol`'s
`fnstcw`/`fistp` slot, Delphi `Move`'s FILD/FISTP temp) are dead by the ABI.
They are not reproduced, and are declared per entry.

**Memory.** All guest accesses go through the same translation and
permission path as the interpreter (`g2w` with the NULL sentinel, the page
table, `$code_page_mark` on writes).

- **Writes to code pages** must invalidate exactly as interpreted stores do,
  through the shared store helper. A native `memcpy` over code is allowed and
  must invalidate.
- **Faults.** A native body **never faults itself**. Before its first side
  effect it validates every range it will touch, as the uop `COPY` window
  guard does. If validation fails, it falls back to the guest body at entry,
  which then faults (or doesn't) authentically.
- **Commit point.** A body that can only discover a problem midway must
  have reached a precise instruction boundary of the guest body. It resumes
  there, which is D's `entry+k` partial path. "Precise" means the register,
  flag and stack state equal what the guest body holds at that instruction.

**Calls out.** Bodies that would call another guest routine (Delphi
`FreeMem`, `_LStrClr` → `_FreeMem`, VB `SysFreeString`) take a **partial
path**: they run natively up to the call instruction and resume the guest
there. A native body never calls guest code itself, and never calls host
imports except through the existing API dispatch.

**Threads and LOCK.** A guest body that uses `LOCK INC/DEC/XADD/CMPXCHG`
(Delphi refcounts) is implemented with the same `i32.atomic.rmw` forms that
`$th_lock_rmw` uses, on the same addresses, in the same order. Non-locked
read-modify-writes stay plain. In a Worker-threads build every guest-visible
access is a plain or atomic access to shared memory. No body caches guest
memory across instructions that another thread could interleave with,
unless the guest body is itself non-atomic there. D's race counter becomes
a standard per-entry statistic.

**Fallback is always available.** Every entry's semantics include an
explicit `decline` outcome (run the guest body from entry), so a native body
can be partial in coverage without being wrong.

## 6. Exact clock charging

**Rule** (shared with `uop-optimizer-pipeline.md` §4.1): a native execution
charges the block ends the guest body would have executed on the same path,
on both meters (`$steps` and `$block_budget`). It charges the `$uc_block_ends`
model's cuts under the historical clock, and executed branches under
`--branch-clock`. If the budget left cannot pay, it declines to entry.

**D's hand-written tables generalise into a charge function per entry:**

```
charge(path, n1, n2, …) = base[path] + Σ trips_i × per_trip[path][i]
```

`path` is the enumerated control path through the body. The `trips_i` are
its loop counts, which the native body knows by computing them (`memmove`:
byte head, dword loop, byte tail as functions of `n` and alignment; RTTI
walkers: field count, element count). The table has one row per clock model.

**Deriving it, without writing it by hand.** `tools/kr-clock.js` does this:

1. Loads the entry's reference body (from `ref`) into the harness arena.
2. Runs it in the threaded interpreter, under each clock, over generated
   inputs from the entry's input classes. It records block ends and the
   resolved path (the sequence of taken/not-taken Jcc outcomes, compressed
   to the path enumeration).
3. Fits `base`/`per_trip` per path by exact integer solve. Each path's charge
   is linear in trip counts by construction, because a loop body's block
   ends per trip are constant.
4. Emits the table.

A residual on any sample is a fit failure, and the entry is not generated.
The same tool checks the native body's computed `(path, trips)` against the
interpreter's observed ones, so a mis-enumerated path is caught there rather
than in an app. Budget exhaustion mid-routine is handled by declining at
entry. A batch boundary can then land inside the guest body exactly as it
would have, at the cost of one guest execution per batch.

## 7. Guards

**Code-write invalidation over the whole extent.** A claim registers its
extent like a uop program's ranges (`$uop_add_range`). A write to any byte
in the extent drops the claim and the decoded entry block. The next decode
at that EIP re-probes the matcher.

This removes D's gap, where the publish covered only the first instruction.
D's stated reason (avoid a re-hash when the guest body is resumed at
`entry+k`) does not arise. The claim belongs to the extent, not to the
decoded block, so resuming at `entry+k` decodes an ordinary block inside a
claimed extent without re-matching.

**Fast-path preconditions** are evaluated before any side effect, and
failing one is a decline, not an error. Examples: refcount aligned and not
in the shared heap, a single AnsiString field, `n` under the window limit,
the ranges translatable. Counters per entry: `native`, `partial`,
`decline:<reason>`.

**Module identity.** A claim made by signature is valid for any module. A
claim made by bind (export name) requires the module class check that
`$crt_override_api_id` applies. The loader's existing "real export record"
proof carries over.

## 8. What migrates and what stays

| Mechanism | Verdict |
|---|---|
| Static `_ftol` (500) | **Migrates first**. It is the simplest conformance target, and its `$ftol_body_at` check becomes the first signature entry |
| SBH scan matcher | Migrates as a signature entry: it is library code with a fixed contract |
| Import-name native overrides and CRT overrides | Migrate into the registry as **bind** entries, unchanged in behaviour. `test-crt-native-overrides.js` becomes their harness instance. The no-way-back group gains `decline` → real export. This also gives them clock charging, which today they lack ("retires no blocks") |
| Fold-bench D | Re-landed as the first signature family, with whole-extent invalidation and derived charge tables |
| AoE `stack_packet`, logical-frame marker | Stay: app-armed perf policy, not library code |
| `msvcrt` globals init | Stays: a loader correctness step, not execution |
| Clock-spin / peek-spin park | Stay: scheduling heuristics with their own safety rules |
| Decoder fusions, `07b` loop matchers, uop `COPY`/`FILL`/`MCOPY`/JTBL | Stay in their layer: idioms anywhere, decided per instruction sequence. Native bodies reuse their primitives (`$rep_movs_mem`, the uop bulk window guards) rather than copying them |

## 9. Boundary with the optimiser pipeline

This adopts `uop-optimizer-pipeline.md` §7.

- **Threaded tier.** The decoder emits one handler, `KR_CALL` (operand =
  entry id), at a claimed entry, followed by nothing. On success the handler
  sets EIP to the return address. On decline it dispatches the guest body's
  first block, decoded as an ordinary block inside the claimed extent. It
  needs one new handler-table slot (not 502), and the handler count is bumped
  per the CLAUDE.md rule.
- **Uop tier.** A call to a claimed entry lowers to `KCALL id`, a service op
  with a declared summary:
  - registers read and clobbered;
  - flags;
  - memory read and written, by argument;
  - may-free, may-call-out, may-fault (always "declines instead").

  The region continues after it, so the claimed routine no longer ends every
  uop program, which is one cause of D + A+B+C ≈ D.
- **Precedence** per call site: when the pipeline's constant-context folding
  reduces the routine to a loop-free residue of ≤16 uops (the RTTI-walker
  overlap case with a constant typeinfo), it inlines. Otherwise `KCALL`.
- **Pure entries.** Those marked `pure-on-readonly-input` (`strlen` of a
  read-only string) may be folded to constants by the pipeline.
- **Ownership.** The framework owns semantics and charges. The pipeline owns
  inlining decisions.

## 10. Testing

1. **Differential harness** (`test/test-known-routines.js`, one generic
   driver):
   - **Setup.** For each entry, load the reference body's bytes (from `ref`,
     relocated into the arena), and generate inputs from the entry's
     declared input classes. Coverage includes edge sizes (0, 1, 3, 4, 5,
     page−1, page+1), overlap in both directions, alignment 0–3, unmapped
     and read-only ranges, nil/literal/shared refcounts and nested RTTI.
   - **Arms.** Run each input under both arms (`--known-routines=none`
     vs `=id`).
   - **What is compared:**
     - the live register set and every non-`dead` register;
     - flags per the declaration;
     - ESP, EIP;
     - a memory hash over the arena (excluding declared below-ESP scratch);
     - the x87 state;
     - `$steps`, `$block_budget`, and the branch-clock count.
   - **Budget cuts.** It runs at every budget cut `1 .. blocks+1`, which is
     `test-fold-arms.js`'s check promoted to every entry.
   - **Threads.** A threads variant races two workers on shared refcounts and
     checks the final counts.
2. **Signature regression:** `kr-sig scan --expect` checks the registry's
   recorded corpus counts (prefix/full per entry) and the false-positive
   verifier. It runs in tier membership as a slow test, not in the build.
3. **App determinism:** Spelunky Classic, metrojd and Heroes II at fixed
   `--branch-clock` batches, all-entries vs none. API calls, batches,
   presents and PNG md5 must be identical (D's protocol). The default clock
   is checked too, once the historical-clock tables exist.
4. **Build gates:**
   - the registry ↔ generated WAT table is fresh;
   - every entry has a harness input class and a derived clock table;
   - handler-count sync.

## 11. Tooling

- `tools/kr-sig.js`: promoted from `scripts/krsig.js`. Subcommands:
  `extract` (from exports, `--va`, or a `--find` seed), `scan`, `verify`,
  `weigh` (hist → routine shares; it should use `tools/hist-blocks.js`
  attribution instead of its own), and `variants` (cluster prefix-only
  matches into proposed new entries).
- `tools/kr-clock.js`: the charge-table derivation in §6.
- `tools/gen_known_routines.js`: registry JSON → `src/NN-known-routines.generated.wat`
  (signature data segment, claim-table sizes, clock tables), with a freshness
  gate.
- Run-time stats: `--kr-stats` prints per-entry `native/partial/decline:*`
  and races, as D's `fold_dn*` counters do.

## 12. Flags, rollout, kill switch

- `--known-routines=none|all|<id,…>` (CLI, `runner-experiments.js`
  appPolicy key `knownRoutines`, `lib/apps.js` perf override) and
  `--no-known-routines`. Per-entry disable: `--known-routines=all,-<id>`.
- Default **off** until an entry has passed the harness, the determinism
  check and a box A/B (fixed-work user CPU, quiet box, with null band). Each
  entry is then defaulted on individually.
- **Native disassembly, V8 and SpiderMonkey,** per the CLAUDE.md
  optimisation rule, for every new native body against its guest-body
  control.
- **Kill switch.** One global (`$kr_enabled`) checked at claim time:
  claims are not made when it is off, so the shipped wasm runs the plain
  interpreter. One bit per entry is checked at `KR_CALL`, which declines.

## 13. First entries, ranked

| # | Entry family | Evidence | Expected | Notes |
|---|---|---|---|---|
| 1 | Delphi RTTI walkers: `_CopyRecord`, `_FinalizeRecord`, `_FinalizeArray`, `_InitializeRecord`, `_AddRefRecord`; variants GM5/GM7/GM8/D6/D7 | Spelunky 34 %+ of threaded entries, metrojd 17.6 %; 26–31 images | Spelunky −10–16 %, metrojd −5 % (D measured) | Re-land D generally; the GM7 `_FinalizeRecord` variant is already a prefix lead |
| 2 | Delphi LStr: `_LStrAsg`, `_LStrClr`, `_LStrLAsg`, `_LStrCmp`, `_LStrCat` | 43–45 images; Spelunky 6.9 %, metrojd 3.1 % | part of D | LOCK refcounts; partial path at `FreeMem` |
| 3 | Delphi `Move` (GM8, REP MOVSD, FastCode variants) | Spelunky 4 % (re-notes); 11 images for the GM8 build | memory-traffic win | reuses uop bulk copy |
| 4 | Static MSVC `memcpy`/`memmove` | 640/308 images; Heroes II up to ~6.5 pts by window | per-window | `rep movsd` inner loop: uop COPY already helps, so the win is head/tail dispatch; measure |
| 5 | Static `_ftol` (migration) | 549 images; GTA2 6.6 % loading, Croc 2 14 % | already landed | first conformance target for harness/charging |
| 6 | Static `strlen`/`strchr`/`memset`/`strcmp` | 486/619/458/69 images; BW2 `strlen` 10.5 % | data-dependent | sentinel scans are 305 instances in 6 DLLs (`loop-idiom-superops-design.md`) |
| 7 | CRT bind entries (existing overrides) | UT2003 `floor` 19.5 %, wide-string set; Morrowind `_output`; Unreal `fread` | already landed | migration adds clock charging and `decline` |
| 8 | `_chkstk` | 788 images; Q2 0.34 % | small | trivial charge (one trip per page) |
| 9 | 64-bit helpers `_allmul`/`_alldiv`/`_aulldiv`/`_aullrem`/`_allshr`/`_allshl` | ~850 images; GTA2 ~5.6 % combined | probably small (control-flow class) | measure before landing; candidates for pipeline pure summaries instead |
| 10 | VB6 msvbvm60 helpers by export (`__vbaVarCat`, `__vbaVar2Vec`, `__vbaStrCopy`, …) | SimCity 2001 VB ~16 % in helpers by nearest-export attribution | unknown | bind matcher; `ProcCallEngine` (68 %) is out of scope |

Not in the list: zlib `inflate` (113 images, no hot measurement yet), D3DX
math (needs a census on a D3DX app run), FastMM (0.7 % in Spelunky).

## 14. Open questions

- Historical-clock tables need `$uc_block_ends`-equivalent cut modelling for
  the threaded path, not only branch counts. `kr-clock.js` must run under
  both clocks before any entry defaults on outside `--branch-clock`.
- Whether a load-time claim table (hash) is cheaper than the decoder's
  current per-decode checks needs a decode-cost measurement. Decode is <1 µs
  per block (`project_fused_entry_decode_pingpong`), so this is about
  simplicity more than speed.
- Signatures are derived from binaries in `test/binaries`. The registry
  records a reference path, SHA-256 and VA, never the bytes of a proprietary
  body beyond the masked signature itself.
