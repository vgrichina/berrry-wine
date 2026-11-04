# Original Deus Ex Draw: boundary coverage and terminal diagnostics

The owning observer now inspects the final executed boundary **before** budget
expiry, captures its terminal PC synchronously, and distinguishes block budget
from monotonic time expiry. Actual WASM tests reproduce a lost last-block Draw
entry in predecessor `95d489747cec3ce841170681e5db9819019b1d78` and pass with this
fix. They also reproduce a module-generation change between slices: previously
one further block could run before rejection; ownership is now checked before
every run. Neither defect is established as the cause of the original empty
50,000-block observation.

This follows published `0e585b893` and
[measured readiness](deusex-measured-readiness-draw-20261104.md). Evidence and
runnable next-driver inputs are in
`scratch/runs/20261104-deusex-observer-coverage-terminal/`. All work was offline:
no box access, allocation, resume, lifecycle action, browser, original-game run,
heavy CLI, other worker, public deployment or Heroes II. The predecessor box
`bx_9ffuymfg` is a historical snapshot reference only; its current state/expiry
were not queried. Coordinator retains custody and shutdown ownership.

## Exact original-code audit

The files were read in place, without copying media:

| File under `test/binaries/candidates/deus-ex-demo/installed/system/` | SHA-256 |
| --- | --- |
| `deusex.exe` | `2ed115d9dc93582273830d9ae38f92ab4379842459e24eaec11390f312d5af5f` |
| `engine.dll` | `3606d3177b4473d1a56405c3e0b372e44dfde475705460be8d68846f6d16a8d0` |

The checked-in test resolves original VA to file bytes through the actual PE
section table and verifies both full file hashes. Engine preferred base is
`0x10300000`; runtime PC is `loadAddr + originalVA - 0x10300000`. The predecessor
load `0x10f82000` therefore maps Draw entry to `0x110109e0`. That arithmetic is
not a current module observation.

| Original Engine VA | Original instruction/boundary | Observer role |
| --- | --- | --- |
| `0x1038e9e0` | `55 8b ec 6a ff` prologue | Entry before prologue: ECX, argument, saved caller |
| `0x1038ed6b` → `ed6e` | `ff 50 60`, then TEST/JZ | Viewport Lock callee entry and natural return |
| `0x1038ef77` → `ef7a` | `ff 50 68` | Viewport Unlock callee entry and natural return |
| `0x1038ef7f` → `ef82` | `ff 52 6c` | Renderer tail callee entry and natural return |
| `0x1038efc9` | Common SEH epilogue; target of JZ/JNE and return from call at `efc3` | Common epilogue landing |
| `0x1038efd9` | `c2 10 00` | Saved caller must regain entry ESP + 20 and caller EBP |
| `0x1038efdc`, `eff0` | Catch entries | Incomplete caught unwind |

These are transfer boundaries, not arbitrary interior instructions requiring
breakpoint retargeting. The fixture executes exact original virtual CALL/
post-return snippets and, separately, the complete original 19-byte epilogue
including FS restoration and RET16. Synthetic objects, callees and connecting
branches supply controlled state. A further fixture loads both complete original EXE and Engine through the
actual PE loader, supplies an isolated synthetic caller and zero-valued imported
guard dependency, and executes Draw's unchanged original prologue/JZ path to
the original epilogue. It correctly terminates as bypass/missing-checkpoint,
not a render-route return. The old synthetic module is retired before changing
EXE image base, and actual loader module index/generation are used. This is
controlled instruction coverage, not natural original application execution or
proof of the original objects' lifetime.

The EXE MainLoop import read/store at `0x10914702/708` establishes GIsRunning,
not render readiness. Its loop check at `0x109147b9` and Tick return at
`0x1091487a` are useful observation counters. The actual Tick CALL at
`0x10914877` is `ff 50 54`. Loop return/branch boundaries are counted only with
matching preferred-EXE-base and relocated import-read signature. These guards
are version checks, not loaded-image file hashes. The test executes relocated
original loop-check bytes and the exact Tick CALL, connected by synthetic
branches, and demonstrates several Tick returns **without fabricating Draw**.

## Actual execution paths and two fixes

`lib/guest-worker.js` uses the observer only in its ordinary slice branch in
place of `ex.run(msg.steps)`. The actual shipped Node Worker bootstrap is used
by tests, with the actual shared WASM memory, real DLL loader/lifecycle table,
real WorkerLink messages and actual x86 instruction execution. Both relocation
signs are tested. Browser bootstrap imports the same observer script; no browser
was launched to infer browser execution from these fixtures.

Thread-send/root-send frames reject slices and end observation. Other commands
that can run or replace guest contexts end it before execution. Multimedia timer
pump execution ends it before timer callback admission. Pending yield state is
preserved; the collector does not consume loader, wait, callback or sleep
continuations. Stop/retirement/exported commands remain conservative incomplete
terminals. Existing breakpoints/counts stay installed and effective. Ordinary
execution never enables observation automatically.

The interpreter's `$run`, `$branch_end_at`, `$chain_end`, `$dispatch-next` and
resume handling were inspected. `run(1)` requests a block quantum and retains
pending decoded continuations. CALL/RET target PCs in the tested routes remain
visible, including a one-block callee and the original straight-line epilogue.
Optimized native folds can retire more than one block; counters use the actual
`get_last_run_blocks`, not an assumption that each request retires exactly one.
This audit and fixture coverage are not universal proof for every optional
execution tier, synchronous API re-entry or original-game route.

1. Before this fix, `observe()` checked `left <= 0` before reading the returned
   EIP. A CALL reaching Draw on block 1 of a one-block budget produced empty
   events. The regression now retains `entry`, PC, module and block exhaustion;
   the predecessor fails that exact assertion. A complete saved-caller return
   reached on the final block also takes precedence over expiry.
2. The prior cross-slice `boundaryObserved` optimization skipped module/thread
   validation before the next run. After an actual lifecycle generation change
   in shared memory it executed another block, then rejected the module. The
   new pre-run check rejects without executing that block. Retired/unmapped
   Engine and foreign-thread/instance cases remain incomplete.

These are demonstrated mechanism defects. The original 50,000-block result's
terminal PC remains **unknown**. Its later `0x11499fa7` sample is not promoted
to terminal PC, assigned to a guessed module or used to claim either fix explains
that historical result.

## Terminal contract

Existing result statuses and null qualification fields are preserved. The new
`terminal` object is assembled synchronously by the owning observer, once:

- Exact reason (`block-budget`, `time-limit`, both, or the actual incomplete/
  route status), boundary kind and monotonic elapsed/remaining time.
- Requested limits, actual retired blocks, charged blocks, remaining blocks,
  run calls, observed boundaries and time spent inside completed WASM runs.
- Actual EIP/ESP/EBP, current thread, yield and halt at that terminal boundary.
- Original pinned Engine identity and current Engine identity/error; PC's LIVE
  DLL index/name/base/size/generation/RVA, or EXE base/size/RVA, or explicit null.
- Last sixteen observed PCs with block positions and MainLoop/Tick counters.

A trapping run is explicitly marked uncounted: the WASM call did not publish a
completed last-run count. Zero-block returns consume one charged opportunity to
keep the observer bounded, and actual blocks remain separately reported. A
Worker deadline timer samples its **own event boundary**, not a fictitious last
WASM boundary. It re-arms if the timer fires before the fractional monotonic
deadline. Later scheduling and status/stop requests cannot overwrite a result.
DLL lifecycle identity is not UObject allocation identity; PC-module metadata
and version guards are not binary hash verification.

## Next bounded original opportunity and driver

Defaults remain 50,000 blocks/1,000 ms. Explicit opt-in ceilings are now
2,000,000 blocks/15,000 ms. `collection.cjs` and `next-driver.cjs` select those
ceilings for one next original observation. The prior collector spent about
436 ms on 50,000 blocks (about 115k blocks/s), exhausting blocks with roughly
544 ms still available at a later sample. Fifteen seconds at that rate would
cover about 1.72M blocks, below the 2M safety ceiling. This is a measured sizing
basis, not a guarantee of throughput, a completed Tick or Draw.

The driver retains actual original selector/EXE checks, the measured GIsRunning
plus source-bearing-window gate, one browser and ordinary host scheduling. It
starts collection immediately when that gate passes; it adds no guessed boot
delay, scheduler pulse, input, forced Draw, guest call/write or breakpoint. It
waits for terminal status and reports whether any actual MainLoop Tick return
occurred. Empty events with Tick returns differ from no observed completed Tick;
either remains an incomplete Draw observation. Module/error/ownership terminals
are surfaced directly. A missing terminal object is rejected, and later-PC
substitution is forbidden.

Run-specific staged dependencies are the existing corrected helpers
(`session.cjs`, `launch-prerequisite.cjs`, `server.cjs`), existing measured
`readiness.cjs`, these two new driver helpers, original native-path recipe and a
**fresh** provision manifest for current served inputs. Set absolute
`DEUSEX_CORRECTED_HELPERS`, `DEUSEX_READINESS_HELPERS`, and `DEUSEX_OUTPUT` paths,
then run `node next-driver.cjs` from the served checkout. `DEUSEX_OUTPUT` must
already contain `provision-manifest.json` and `native-paths.json`. Stage and hash
current observer/Worker/browser dependency graph and chosen WASM first; do not
reuse predecessor pins for changed code. Browser provisioning/access remains a
separate coordinator assignment; this task only tests the mechanism offline.

## Validation and remaining unknowns

`flock /tmp/wine-build.lock bash tools/build.sh` passes. Fresh normal and compat
WASM both pass local and actual owning-Worker suites. Tests cover original
machine-code snippets, relocation, last-block entry and complete return, budget
versus idle timer expiry, frozen terminal state after ordinary execution, missing
entry, direct landing without call, missing intermediate return/checkpoint,
failed Lock, catch/unwind, wrong cleanup, viewport mismatch, trap, module
retirement/reuse, foreign exports/thread, pending yield, stop, command and
teardown. Worker registry and callback census focused checks pass.

The next driver's actual serialized command and collection helper run against
the real WorkerLink/WASM with an independent ordinary scheduler. The **complete
next-driver** also executes offline with an injected browser factory, modeled
DOM/boot/readiness observations and real collector transport/guest execution.
It verifies actual selection flow, readiness before start, 2M/15s options,
terminal assessment, null claims, stop and browser cleanup. No real browser,
original application boot or actual native readiness transition is claimed by that fixture.
The optional driver integration is reproduced with:

```
DEUSEX_COLLECTION_DRIVER=scratch/runs/20261104-deusex-observer-coverage-terminal/collection.cjs \
  node test/test-deusex-owning-draw-observer.js
```

Evidence includes exact Git SHA, relevant binary diffs including peer hunks used
by the build, owned new-file patches, hashes and test logs; Git is the source
archive. No source archives, module copies or media copies were made. The only
remaining original-run questions are whether this wider natural interval sees
MainLoop Tick/Draw, which terminal PC/module it actually reaches, and, after a
verified return route, object lifetime and viewport-to-host surface binding.
`engineRender` and `viewportPlayer` remain null; lifetime/surface remain unknown.
