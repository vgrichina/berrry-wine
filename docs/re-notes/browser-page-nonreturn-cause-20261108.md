# Warcraft page nonreturn investigation — 8 November 2026

**The original synchronous page operation remains unidentified.** The new
independent journal passes local production controls, but its fresh remote
delivery fails before Warcraft startup readiness. This attempt supplies no
emulator regression or justified synchronization change. The previous reviewed
Prologue loading/cinematic evidence remains the gameplay boundary; Thrall
control is unproved.

Evidence: `scratch/runs/20261108-browser-page-nonreturn-cause/`. The predecessor
[capture investigation](browser-page-capture-cause-20261108.md), its final audit
and trace, and [producer-ready gameplay](warcraft3-producer-ready-gameplay-20261108.md)
were read and preserved. No failed command was replayed.

## Source audit and diagnostic coverage

The actual synchronous path is `GuestWorkerLink._onMessage` →
`GuestRpc.createMainBroker` → its selected host import. `serveRpc` reads the
parked Worker's numeric arguments, invokes the import and publishes its answer.
The diagnostic brackets both the broker invocation and all five existing host
function call sites, preserving the original undefined receiver. It records
the message parent, slot, import name, exact numeric arguments and object
identities. The original broker still owns dispatch and exception handling.

The VFS path merits observation: `lib/filesystem.js`'s `writeGuestBytes` copies
through sparse-safe chunks, then `notifyGuestWrite` calls
`ctx.exports.invalidate_code_range(guestAddr >>> 0, size)`. That exact call is
bracketed, with its original exports receiver and both arguments. VFS
`writeFile`/`setEndOfFile`, Worker message callbacks, thread-slot retirement,
`workerSyncState`, `publishWorkerThunkState` and host DLL-count publication are
also bracketed. These are coverage choices, not suspected defects.

`host.js` establishes a distinct host shadow before Worker PE loading and
initializes its metadata with thread ID 7. The current
`src/13-exports.wat:3957` invalidation export already saves and enables
`d3dim_lazy_bypass`, performs page-watch/code invalidation and restores the
prior value. The lazy access/fence paths test that bypass before entering the
shared lazy lock. Neither this audit nor the runtime evidence establishes a
lock cycle or supports removing synchronization. Cache retirement and
page-watch loops were inspected without promoting a speculative repair.
`source-callpath-audit.json` retains the relevant excerpts and line references.

Run-local HTTP transforms insert synchronous call brackets and append narrow
method wrappers. No exported instance or export is replaced. The diagnostic
does not write guest memory, poll input, alter guest clocks/scheduling or add
page Promise reactions. Wrappers return the original result immediately,
including Promise identity; a synchronous return record is not an async
completion claim.

A separate observer Worker reads a dedicated 16.8 MB diagnostic
SharedArrayBuffer, never guest memory. Records carry entry/return/error,
wall/monotonic timestamps, receiver identity, arguments and synchronous message
parent. Data descriptors are encoded without invoking getters. Buffer/view
arguments retain exact identity/type/range; their contents are explicitly
unsampled. Large structured messages use bounded fragmentation/reassembly.
Overflow, lost slots and incomplete fragments are explicit, not silent
truncation or `"Object"`. Probe console payloads are strings. The independent
Node recorder writes gzip members and fsyncs each received observer batch.

## Local qualification and preserved failures

Before allocation, `qualified-software/` and `qualified-webgl/` passed through
actual Chrome, production guest/render Workers, the unchanged released
producer/binding helpers and numbered native-input/ACK transport. Both native
red triangle controls were personally reviewed. Strict missing/zero/nonowner
producer, missing context/endpoint, wrong guest, renderer replacement,
postbinding endpoint replacement, stale review, module mismatch and UNKNOWN
controls dispatched zero input. Six positive commands received exact ACKs;
independent native release under delayed DOWN also passed.

The actual observer was attached while paused, enabled and resumed through
CDP. A finite 1.8-second busy callback reached through production
`WorkerLink._onMessage` left the observer independently readable. Fsynced
samples arrived between entry and return. Observed/unobserved controls preserved
receiver, exactly-once invocation, undefined result and exact thrown object.
Both final arms have zero oversized/lost records and no unfinished fragments.
`preallocation-qualification.json` records these results.

Failures remain intact: the initial callback expectation missed production's
message prefix; the next control referenced an undeclared counter and exited
Node, requiring SIGTERM of its own Chrome and verified profile cleanup; an
anchor-count assertion expected four host calls instead of the audited five;
one software message exceeded the initial record size, requiring fragmentation
and complete requalification; a historical-evidence path assertion used the
review folder instead of the retrieved folder. These iterations are excluded
from qualification. An early remote status read raced directory creation and
is also retained.

Local qualification did **not** qualify the fresh remote transport. No native
trace is used or claimed. Browser `SystemInfo.getProcessInfo` samples are
streamed before failure; an independent OS sample preserves thread stats,
wait channels and explicit permission-denied kernel-stack reads. These are
process samples, not JavaScript/WASM stack attribution.

## Fresh attempt: delivery fails before startup readiness

One UUID-idempotent no-environment box, **bx_8yacs6h8**, was created at
04:31:05.334 UTC. The supervisor, independent 25-minute watchdog and normal-stop
child were observable before allocation. The allocation expiry was
04:56:05.194 UTC; browser stop remained the separately fixed 04:42:43.500 UTC.
The unchanged original app/module/media and strict driver were selected for
SoftwareGL. There was no native command, screenshot or startup owner binding.

`final-cause-audit.json` establishes the narrower failure:

- Readiness `Runtime.evaluate` request 25 was sent at **04:31:53.963** and
  timed out UNKNOWN at **04:32:14.002**, after 20,039 ms.
- The page emitted **seven heartbeats after that request was sent**. The
  last retained page emission is **04:32:00.238**, received at
  **04:32:53.805**. This excludes uninterrupted synchronous page execution
  throughout that interval; it does not prove entry of the requested body.
- All **1,097 durable observer drains** report journal sequence zero, no
  production entry, no loss/oversize and no pending fragments. Median receipt
  lag is **32,946 ms**, maximum **53,720 ms**. Seven browser process samples
  were recovered; subsequent browser-level requests also missed deadlines.
- The observer drain request after UNKNOWN timed out. `Browser.close` was
  sent at **04:32:34.014**; Chrome actually exited zero at
  **04:32:34.561**, although its ACK timed out at **04:32:54.047**.
- The guest Worker script was served at 04:31:58.365, but its
  `Debugger.enable` attach handling was not entered until **04:32:46.285**,
  after Chrome had exited. No guest Worker resume/module proof completed.
  The observer's earlier attach/resume did complete.

The journal/console delivery and Node ingestion path did not retain bounded
service on this remote host. The idle observer emits a batch every 10 ms and
the receiver synchronously compresses/fsyncs every batch; that is an important
unqualified load, not an established slow syscall or Chrome defect. No
per-batch service-time measurement separates recorder I/O, WebSocket delivery
and inspector event queuing. Consequently this fresh failure cannot be
substituted for the historical Warcraft stall or attributed to VFS,
invalidation, a lazy lock, renderer or guest code.

The precise remaining gap is **remote observer/recorder delivery qualification
before original launch**, followed by acquisition of an actual production
entry without return during the historical loading interval. Idle batch
coalescing, a bounded heartbeat, recorder service-time/queue-depth measurements
and attach/resume/drain timing need a failing-before/passing-after control
before another original. None was silently changed mid-run. First UNKNOWN
closed the attempt; no input, replay, second original or WebGL arm followed.

## Source, verification and shutdown

Staged Git SHA: `8fdba6283331ae518068cf0260fb9d4ba6e77ca5`.
`runtime-pins.json`, `relevant-source.patch`, the new boot-file patch and
`owned-helper-patches.patch` retain exact source references and relevant hunks.
The released binding/producer/observer/input helpers are byte-identical to the
predecessor. All **630 remote runtime pins** remained unchanged. Twelve media
files are referenced by registered path/current SHA; four historical hashes
match and eight independent historical hashes remain unavailable. No source
tree or media archive was created.

All **32 remote artifacts / 32 unique hashes** were retrieved and independently
reread for size/SHA at **04:33:28.033 UTC**, before requesting normal stop.
Image/module/identity/ACK validation passes for the qualified local controls:
eight PNG CRC/IDAT decodes and capture hashes, six exact ACKs and matching
CPU/render module hash
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
The fresh original has no completed module/owner proof and receives no such
claim. Its controller/Chrome PIDs are absent, both ports closed and profile
and writer lock removed.

Normal stop completed at **04:33:30.050 UTC**, receipt
**stop_69deb02fa52f1fed**, `forced: false`. Final box state is **archived**,
expiry **null**. Both lifecycle children exited zero; the supervisor has no
remaining children. Local/remote disk stayed above 5,000,000,000 free bytes.
Own completed logs were losslessly compressed, and identical captured modules
link only to an immutable retrieved module, not the mutable build output.

No emulator code change or build claim, guessed lock removal, RAM gate,
old-box resume/delete, nested worker, public deployment or gameplay progress
claim. Full27, parity, FPS, audio, control and campaign completion remain open.
`RECOVERY.md` identifies the evidence and prohibits replay/resume.
