# MDK2 post-Lua boundary: observe the actual main Worker before Level creation

The next action is **a separately reviewed, input-free construction observation**,
using the existing `construction-control:observe-construction` route and its
16-slice quantum. Add the tested passive main-Worker sidecar described below.
The completed file request needs no further input or callback. The first
unobserved boundary is consumption of the loaded script by the custom native
`dofile`, parsing/executing its buffer, and the first `Level = {}` assignment.
There is no evidence of a guest loader failure or a justified emulator repair.

This investigation is entirely offline. RUN is
`scratch/runs/20261104-mdk2-post-lua-native-boundary/`. It reads the original PE,
compressed script archive and immutable recovered evidence from
[61cbd27bc's personally reviewed execution](mdk2-personally-reviewed-title-onward-20261104.md).
It runs no Chrome/game, remote command/API, allocation or lifecycle action.
No successor was launched. Only this note is committed; the small audit,
observer adapter and tests remain in RUN with new-file patches.

The original bytes narrow the boundary beyond a generic resource wait.
`mdk2Main.exe` remains at
`test/binaries/candidates/mdk2-demo/installed/mdk2demo/mdk2Main.exe`, SHA-256
`b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1`.
Adjacent `data/scripts.zip` is
`cfdae6e7d02b1823a59d0b85aa8eaca2f057dbb27e7b86d9a7199fc069f642d8`.
`audit.cjs` checks 19 exact PE sequences and records selected disassembly with
VA/hex bytes. It decodes only the required archive entries in memory; no
executable, archive, script tree or module is copied.

| Original location | Boundary established by the bytes |
| --- | --- |
| `0x41fc69`, `0x41fc73` | Registers function `0x41fcc0` under string `dofile` at `0x4a0a90`; this custom resource path supersedes assuming ordinary CRT file I/O. |
| `0x41fcd1–0x41fcdb` | Looks up the requested name with `.lua` at `0x4a0a88`. |
| `0x41fce5–0x41fcea` | Calls synchronous resource demand `0x44fc40`; return is `0x41fceb`. |
| `0x44fbda`, `0x44fbe4`, `0x44fbec` | Completion consumption writes entry status2, finalizes, then clears active at `0x4b7d14`. Type10 finalization selects `0x44f515`, just `pop esi; ret`. It cannot construct Level through a type-specific callback. |
| `0x41fcf9–0x41fd05` | Pushes name, entry size `[esi+8]`, buffer `[esi]`; calls `0x444f80` at `0x41fd01`, returning to `0x41fd06`. |
| `0x444fb7`, `0x444fcc` | Initializes the memory stream through `0x44a670`, then calls protected parse/run `0x444dc0`. |
| `0x444ebc`, `0x444f48` | Text branch calls parser `0x44a7a0`; a successfully parsed closure subsequently executes through `0x446c30`. These are observation landmarks, never instructions to call guest functions. |
| `0x451f51`, `0x451f5b–0x451f65` | File Worker sets completion1, calls SleepEx wrapper with zero delay, and loops back to the request check. |

The unique 192320-byte `level1.lua` decodes to SHA-256
`7d7de7b115b6fb1deb6290791c222e59c2726c607324095d3ba4c6136d9c08fe`.
It begins with text byte `0x4c`, followed by `Level = {}`, then assigns
`doscenegraph=1`, file `l1` and `loadscreen1`. `mdk2.lua:385–397` clears Level,
sets level/checkpoint/section and calls `dofile(name)`. Thus Level absence does
not locate a parser PC, and Lua resource completion does not mean script
execution completed. The resource name itself was not captured; identifying
this request as level1.lua remains an inference from type, unique size and the
original calling contract. The later loading-screen call is separate.

The exact latest state is retained in
`personally-reviewed/recovered/browser/comic-control-115.json` and
`comic-control-115-owner.json`. Their bytes and the PNG are checked against
the recorded recovery inventory, along with all 118 successful ACKs.
At step3408/guestMs56314: Level tag−6/absent; level1/checkpoint9/section−1;
game/game schemes; queue1; active0; request6174784 (`0x5e3840`);
prepared1/pending0/completion1; active metadata null. Completed bytes1175012
minus previous982692 equals192320 exactly. Retained queue/prepared/request
fields therefore do not indicate a pending decode.

The file Worker handle is921600 (`0xe1000`), guest export thread ID2.
Its exact registers are:

| Register | Value | Register | Value |
| --- | --- | --- | --- |
| EIP | `0x4515cd` | previous EIP | `0x4515c0` |
| ESP | `0x7effffbc` | EBP | `0x7efffff4` |
| EAX | `0` | EBX | `0` |
| ECX | `0x2ef40` (192320) | EDX | `0x60db1ff1` |
| ESI | `0x083f0f00` | EDI | `0` |

Stack begins `0x451f62, 0, 0x481388`. The first return address and argument
identify the idle zero-delay loop, replacing the preceding archive callback
return `0x45774a`. Owner state is active, not in flight; suspendCount, waitPolls,
sleepUntil, lastYield, yieldReason and waitHandle are all0; workerSlices3341.
Its stored creation flags4 do not mean it is currently suspended.

**Actual main-Worker registers and parser position are unknown.** The retained
step report's `eip=0x00000000` is not that PC: pinned execution-source
`1329b1ba6eb00144ff77d4cd92a8513d4fc953ad:host.js:frozenStatus` reads
`this.instance.exports.get_eip`, the page instance. The existing owner sidecar
reads the distinct file thread. Neither supplies main-Worker PC/stack. Active
clear shows resource finalization was consumed; it cannot distinguish return
from demand load, stream setup, text parsing, or execution before the first
Level assignment. No exact current main PC can be recovered from these files.

The route stopped for a measured external reason. Last executed command117
is the final shot at13:31:51.914Z; capture state time13:31:52.016Z leaves
**8021ms** before the unchanged deadline13:32:00.037Z. Final cleanup state at
13:32:00.039Z still has3408 slices. Chrome closed normally at13:32:00.634Z.
There was no post-completion step, controller rejection or lost requested
execution: command116 ran16/16, and commands0–117 all ACKed successfully.
The continuation ledger used112/12288 slices and7/192 quanta, with pendingQuanta3
and skipAttempted false. The deadline, not those allowances, ended progression.
Quit118 was submitted after closure and never ACKed. Frozen inspection/transfer
time supplies no further main-thread credits; the pinned `_frozenPump` exits
when its budget is zero. This does not diagnose a parser stall.

The tested recipe for the coordinator's separately authorized successor is:

1. Preserve the original execution source/module/media pins, absolute deadline,
   menu/continuation ledgers and capture-bound personal reviews. Qualify the
   new adapter locally before its sole launch; retain its exact generated-source
   hash. Use `require(RUN+'/main-state.cjs').sourceForRun(FRESH_RUN)` through
   the established wrapper compilation interface. This delegates to the existing
   fixed wrapper and inserts only a passive read before its original screenshot.
2. Review each actual fresh capture independently. After ordinary New Game and
   Medium, select pending versus construction from current native facts.
   At the completed/nil-Level boundary use `operator.py construction CAPTURE
   CURRENT_PERSONAL_REVIEW.json`, with a separately supplied truthful black
   construction review. The existing phase gate and inspection approval remain
   mandatory. Do not reuse this closed run or its reviews.
3. The existing construction controller sends `state`, `step n=16`, then `shot`.
   Obtain its new `CAPTURE-native-main.json` alongside the existing PNG/raw/owner
   records. It reads only actual `wine.guestWorker.readExports`, general registers,
   lazy flags,48 stack words, and bounded raw words for Lua-state/request pointers.
   Missing Worker/exports, unmapped reads, multiple/unfrozen hosts, or changing
   steps/ticks/guestMs fail closed. It never substitutes the page instance.
4. Correlate actual PC/stack with the landmarks above. Separately observe
   Level's real table/`l1` fields, then the real next queue/resource; do not assume
   105 resources,699228 bytes or any historical slice is a timing target.
   Only the already qualified Level branch may select its existing64-slice
   quantum. Visible loading/comic needs another matching personal review;
   no input follows merely from black pixels or a native table.
5. Finish reviews/transfers with enough remaining wall time for the next guarded
   action and orderly handback. If the original bound or first-error gate fires,
   stop and recover; no reset, timer extension, retry, callback or guest write.

Seventeen focused tests pass. The actual final recovered state passes the
unchanged phase gate and actual construction controller through approval/ACK/
ledger checks to `state → step16`; an inert peer deliberately stops before
execution. The old pending route rejects the same state. Missing review/Medium,
expired deadline and already closed browser remain rejected, including tests
of the actual original Spool. The generated-shot test exercises real adapter
source with inert page/I/O peers and verifies raw/owner/main/PNG order. Removing
the sole added sidecar expression yields byte-identical base generated source,
including every timer, command bound and capture guard. Serialized readback
tests prove getter-only Worker use and unchanged mock memory; the pinned actual
Worker readExports branch is also exercised offline. These are protocol tests,
not a claimed new gameplay execution or current main-register capture.

The fourteen retained construction/raw/owner controls also pass, as does
`flock /tmp/wine-build.lock bash tools/build.sh`. The first build encountered
the concurrently owned new Deus observer's missing census registration; its
owner added that registration, and the subsequent locked build passed. Both
logs remain. This compilation is not the historical execution module. RUN records
Git SHA, relevant binary diff, small owned new-file patches, selected byte
evidence, restoration manifest and test logs. Two adjacent native-menu helpers
were restored only after decoded size/SHA matched the recorded import inventory;
both compressed files remain. Predecessor evidence was not rewritten.
No renderer, D3D, Deus observer, Stronghold input or production file changed.
No box is assigned here. Predecessor bx_gw6xp8cz expiry14:00:53.351Z was reported
normally STOPPED by the coordinator at13:35:37Z; that is a retained board report,
not a query or lifecycle action by this worker. The coordinator owns successor
allocation and lifecycle.
