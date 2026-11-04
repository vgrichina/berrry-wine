# Natural original Deus Ex Draw reaches Lock; observer ends inside Render

The single original-game interval observed **MainLoop loop check 1, Tick return
1, natural Draw entry, viewport Lock callee entry and successful Lock return
(EAX=1)**. It did not observe Unlock, renderer tail, common epilogue or the
saved-caller return. The actual collector terminal is
`unobserved-unwind-or-return`, not budget/time expiry. Read-only original Render
bytes show temporary ESP reuse at that terminal; the observer's conservative
ESP threshold cannot establish a guest unwind or crash there. The first missing
checkpoint is **natural viewport Unlock callee entry/return**. The personally
reviewed capture has a black game area; no visible gameplay is claimed.

This uses published corrected observer
`b07e2e08c3446cc8e244da6f72c2acbde1a63a38` and its unchanged tested
`next-driver.cjs`/`collection.cjs`, following
[coverage and terminal diagnostics](deusex-observer-coverage-terminal-20261104.md)
and [measured readiness](deusex-measured-readiness-draw-20261104.md).
Evidence: `scratch/runs/20261104-deusex-natural-terminal-run/`.
No production code changed. The earlier 50,000-block observation's terminal PC
remains unknown; its later `0x11499fa7` is not a terminal PC. Neither previously
fixed mechanism defect is established as that historical result's cause.

## Provisioning and mechanism checks before Chrome

Only assigned fresh fork `bx_yvej9qwr` was accessed. All 337 inherited pins
matched and process inspection found no Chrome or Node driver. Seven changed
small source/test files and the newly selected WASM replaced their older files
in place; two small run helpers were added. Unchanged media, modules,
dependencies and original native support-path recipe were reused. No source
archive, repeated media, module set, save/configuration or geometry was copied.
The small legacy renderer dependencies staged here are already published inputs,
not edits to another worker's files.

The fresh manifest contains 339 SHA/size pins. Actual Puppeteer-core 25.7.0 and
all next-driver imports pass. Preflight fetches 144 actual page/Worker/runtime
graph resources with matching SHA, HTTP isolation and no-store headers. The
cache graph check passes with one authority, 98 page scripts and 13 Worker
scripts. Absent `build-info.js` is the actual supported `dev` fallback, served
as an ordinary 404; missing/unlisted inputs remain 404. Selector/classifier,
pinned HTTP mutation negatives and readiness fixtures pass. The current actual
WASM local/owning-Worker suites pass, including original PE loading and the
full next-driver integration with modeled DOM/readiness and real WorkerLink
transport/guest execution. These pre-browser fixtures are mechanism tests, not
natural original execution.

`DEUSEX_CORRECTED_HELPERS`, `DEUSEX_READINESS_HELPERS` and `DEUSEX_OUTPUT` were
absolute paths under `/home/user/deusex-natural-draw-runtime/`, respectively
`corrected-evidence`, `readiness-evidence` and `terminal-evidence`. The latter
held fresh `provision-manifest.json` and `native-paths.json` before launch.

Actual served inputs:

| Input | Bytes | SHA-256 |
| --- | ---: | --- |
| `build/wine-assembly.wasm` | 2144190 | `7ca6bf69861fbe774bf30d03163d847945b6d07d1ffeea132911b68038b7a4c3` |
| `lib/deusex-draw-observer.js` | 13732 | `4b3929cbd43656a338339edff3b62b4cea62d7eb0ca81d8f05706787bebde3a4` |
| `lib/guest-worker.js` | 71526 | `bfa5f4f25de48e79c31868ab78b784da4ad39c4591c4e5bf86ab68248eb7c344` |
| Original `deusex.exe` | 253952 | `2ed115d9dc93582273830d9ae38f92ab4379842459e24eaec11390f312d5af5f` |
| Original `engine.dll` | 1736704 | `3606d3177b4473d1a56405c3e0b372e44dfde475705460be8d68846f6d16a8d0` |
| Original `render.dll` | 233472 | `9f405de68112266bbd72cb4e37c39b3b9712052c49fcd2f7cd9f2654b443773b` |

Original binaries remain under
`test/binaries/candidates/deus-ex-demo/installed/system/`. Server response hashes
and loaded module metadata are distinct evidence; no full relocated-memory
hash or UObject allocation identity is inferred.

## Actual original session and terminal

Chrome/151.0.7922.108 ran **07:09:40.409Z–07:10:02.230Z** on 2026-11-04.
The genuine candidate selector and measured `_exeUrl` selected the original
EXE. No reload, retry, second browser, guessed boot delay, input, scheduler pulse,
forced Draw/repaint, guest call/write or breakpoint retarget occurred.

At **07:09:52.155Z**, native GIsRunning was 1 at `0x10daf434`, read through the
original EXE's relocated signature/IAT with image base `0x10900000`. At
**07:09:52.156Z**, visible non-child HWND `0x10003` was 648×488 with
`dxWriteSeq=73`, canonical version 4. The owning WorkerLink acknowledged start
at **07:09:52.162Z**, slot 0, endpoint identity 1, 2,000,000 blocks/15,000 ms.
Only ordinary host scheduling executed the guest.

Engine remained LIVE, index 2, base `0x10f82000`, generation 1, size 2,859,008.
Before/after passive Worker samples retained slot 0/thread 1, 2,263 export names,
536,870,912-byte memory and their within-sample exports identity checks. These
checks do not claim cross-sample object allocation lifetime.

| Natural checkpoint | Actual evidence |
| --- | --- |
| Draw entry `0x110109e0` | ECX `0x103ef0a0`, viewport argument `0x19309380`, entry ESP `0x179ff878`, EBP `0x179ff8b0`, saved caller `0x1134426e` |
| Lock callee entry `0x1133d145` | ESP `0x179ff788`, EBP `0x179ff874`, stack return `0x11010d6e` |
| Lock return `0x11010d6e` | EAX 1, ESI `0x19309380`, ESP `0x179ff7c8`, EBP `0x179ff874` |
| Unlock/tail/epilogue/saved caller | Not observed; `observedReturnPair=false` |

The first terminal status reply arrived at **07:10:01.680Z**. Exact terminal
timing is the observer's monotonic boundary, not that reply's wall timestamp:

| Terminal field | Actual value |
| --- | --- |
| Reason / boundary | `unobserved-unwind-or-return` / `guest-run-boundary` |
| Monotonic time / elapsed | 19491.735 ms / 9511.330 ms |
| Remaining time | 5488.670 ms |
| Actual / charged blocks | 502441 / 502441 |
| Remaining blocks | 1497559 |
| Run calls / observed boundaries | 502441 / 502442 |
| Completed WASM run time | 204.390 ms |
| PC / ESP / EBP | `0x1175527a` / `0x19508430` / `0x7` |
| Thread / yield / last-run halt | 1 / 0 / 1 |
| PC module | LIVE `Render.dll`, index 6, base `0x11752000`, size 405504, generation 1, RVA `0x327a` |
| MainLoop signature / loop check / Tick return | true / 1 / 1 |
| Diagnostic error / module error / trapping run | null / null / false |

Halt 1 means the last `run(1)` block quantum exhausted; it is not application
exit, a trap or the collector's 2M-block budget being exhausted. The actual
terminal retains its final sixteen PCs. Later `native-after.json` is explicitly
a later event sample and does not replace this PC/time. Both stop replies
preserve the exact frozen terminal result.

## Read-only explanation of the conservative terminal

The original Render preferred base is `0x10b00000`, so this observed LIVE
module's RVA maps to original VA `0x10b0327a`. Original PE section mapping and
full-file SHA checks verify the following bytes in place:

- `0x10b03246`: save ESP to `[0x10b38a08]`; `0x10b0324c`: save EBP.
- `0x10b0325e`: `mov esp,[ebp-0xc]`; `0x10b0326f`: `lea esp,[esp+edx]`.
- `0x10b03275`: `mov dl,[esp+ecx]`; conditional branch falls through to
  terminal `0x10b0327a`, `lea ebx,[ebx]`.
- `0x10b03310` and `0x10b03316`: restore saved EBP and ESP before subsequent
  conventional frame work and eventual RET.

Published observer `observe()` ends when ESP is at least entry ESP + 20 outside
its recognized checkpoints. Recorded `0x19508430 >= 0x179ff878 + 20` satisfies
that condition during original Render's explicit temporary ESP data-pointer
use. Therefore the terminal label alone does not establish that Draw unwound or
returned. The restoration instructions exist in the original file; their later
execution was not collected. This audit is original static bytes plus recorded
natural registers, not a new instruction-execution fixture, a repaired observer
or a demonstrated complete render route. No historical cause is inferred.

The concrete remaining observer limitation is distinguishing temporary ESP use
from an unobserved unwind while preserving conservative frame/owner checks.
Any future repair needs focused original-instruction coverage before a separately
authorized original run. This worker made no production repair or second run.

## Capture, recovery and handoff

I personally viewed `recovered/fresh-host.png`, 93,610 bytes, SHA-256
`39d012a92406ce9cdfae054a99c937ddaa9fc67467f2f79632a284506216a8bd`.
It shows the emulator UI, Deus Ex Demo selected, launch logs and a black game
area. It does not establish nonblack engine pixels, gameplay or immutable
source-to-host provenance. `engineRender` and `viewportPlayer` remain null;
object lifetime and viewport-to-host surface binding remain unknown.

All 58 closed files, 3,949,481 bytes, were recovered or matched to identical local
small inputs with full SHA/size verification; remote verification completed at
07:10:13.684Z. All 339 staged pins still matched, with no Chrome or Node driver
remaining. The offline analyzer verifies recovered artifacts, actual served
identities, selector, readiness ordering, exact terminal/counters/checkpoints,
null claims, frozen stop, cleanup and original Render ESP save/reuse/restore
bytes. Git SHA, relevant binary diff and owned new-file patches are retained;
Git is the source archive. No production build was required for this note/run.

**bx_yvej9qwr remains RUNNING** (API `idle`, healthy/hydrated), expiry
**2026-11-04T08:06:42.503Z**. Coordinator owns shutdown and receives the box back.
No allocation, resume, stop/delete, source-box access, subworker, successor,
local heavy runtime, Heroes II or public deployment occurred. Visible original
gameplay remains the goal; this task ends with exact partial natural Draw and
terminal evidence, not gameplay acceptance.
