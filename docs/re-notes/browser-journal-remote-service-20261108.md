# Remote page journal service — 8 November 2026

**The recorder overload is reproduced and repaired in the diagnostic composition.**
The fresh Warcraft run supplies an actual final page-call boundary, followed by
renderer-process disappearance. It does not establish an emulator defect,
audio deadlock, or the cause of the historical loading stall.

Evidence: `scratch/runs/20261108-browser-journal-remote-service/`.
The predecessor [nonreturn investigation](browser-page-nonreturn-cause-20261108.md),
its `final-cause-audit.json`, and original driver were read first. One fresh box
was used; no nested worker, replay, second original, or WebGL follow-up ran.

## Narrow diagnostic change

The observer still checks its dedicated diagnostic ring every 10 ms, but emits
empty drains only on a bounded 500 ms heartbeat or explicit drain. Nonempty
records retain the existing encoding, identities, arguments, parent IDs,
entry/return/error timestamps and fragmentation. Lost slots, oversized records
and pending fragments remain explicit. No guest memory or exported function is
replaced or written by the diagnostic.

A dedicated Node recorder thread appends ordered JSONL and groups fsyncs behind
a 50 ms dispatch interval. The browser event receiver no longer compresses and
fsyncs every console batch. Outstanding queued plus in-flight serialized bytes
are capped at 32 MiB, with a persistent explicit overflow/error marker. Metrics
record receiver service, delivery lag, queue depth/bytes, persistence service
and receipt-to-durable latency. Large completed logs are compressed only after
the browser stops; both compressed and original-content hashes are retained.
The 50 ms interval is a dispatch interval, not a filesystem completion guarantee.

The existing call probes, production transforms, producer/binding/input helpers
and exact numbered ACK transport were reused. The released safety helpers and
page journal are byte-identical to their predecessor. No emulator, guest clock,
guest scheduling, lock, input-admission or export change was made.

## Qualification on the actual remote host

The first fixture iteration lacked its required `calc.exe` input. Both initial
arms and their failures are preserved. The corrected fixture was then run in
both transport modes on the same host, before any original launch. An initial
pin upload used an incorrect absolute destination; it was corrected. The repeat
baseline checked the original 631 pins and served the added fixture input; the
candidate and original checked all 632 pins. Served-file hashes retain the
extra input's identity. These iterations are not silently counted as passes.

| Measurement | Synchronous baseline, corrected fixture | Candidate, corrected fixture |
| --- | ---: | ---: |
| Recorder persistence median | 34.826 ms per batch | 30.084 ms per grouped dispatch |
| Maximum delivery lag | 56,494 ms | 75 ms |
| Maximum receipt-to-durable latency | synchronous ingestion already overloaded | 153 ms |
| Receiver enqueue median / maximum | synchronous persistence on receiver | 0.043 / 0.389 ms |
| Recorder queue maximum | no separate queue; delivery backlog grew | 3 batches |
| Startup / production controls | UNKNOWN before guest readiness | pass |

This measures the combined synchronous compression/write/fsync service; it does
not isolate a particular syscall as causal. The baseline's inspector backlog
was not directly counted. Its emission-to-receipt lag demonstrates that backlog.

Actual debugger-wait observer, renderer and guest Workers attached and resumed
in **12 / 3 / 3 ms**. A finite 1.8-second callback reached through production
`WorkerLink._onMessage` left its entry durably readable before return; an
independent Worker drain completed during it, with four durable emissions
between entry and return. Observed/unobserved controls preserved the production
undefined result, receiver, exactly-once invocation and exact thrown object.
Final fixture records have no lost slots, oversize or incomplete fragments.

Strict zero/missing/nonowner producer, context/endpoint absence, wrong guest,
renderer/endpoint replacement, stale review, module mismatch and UNKNOWN
controls dispatched zero input. Three positive commands received exact ACKs.
Delayed-DOWN controls also preserve independent native mouse/key release and
exactly-once UP. The generated red triangle was personally reviewed.
`remote-qualification.json` was written before the original launch.

## Actual Warcraft result and final call

The unchanged current-module SoftwareGL route reached the native menu, profile
`ABC`, Normal Prologue, Chasing Visions loading completion and, after one native
Enter, a rendered Prologue scene. Those images were personally reviewed. There
are **15 exact original ACKs and seven input commands**. Player control, tutorial
consequence, full27, parity, FPS and audio remain unproved.

The final passive capture, command 15, received no ACK. Its strict page-owner
request 1411 was sent at **04:53:17.923 UTC** and timed out after 20,000 ms.
The command work deadline fired 55 ms earlier. Input stopped; neither request
nor input was replayed. A subsequent read-only capture retrieval found no final
image and its failure is retained.

The independent journal's final three nested entries are:

| Call ID / parent | Entry at 04:52:59.323 UTC | Exact context |
| --- | --- | --- |
| 2968485 / null | `WorkerLink._onMessage` | RPC, slot 4, endpoint 5, receiver ref 53283 |
| 2968486 / 2968485 | `GuestRpc.invoke.voice_play_ring` | import ID 266, slot 4 |
| 2968487 / 2968486 | `GuestRpc.host.voice_play_ring` | undefined receiver; arguments `[720900, 24246244, 136704, 0, 2]` |

No matching return or error was retained for these entries. The shared argument
array identity is ref **10131032**. Both timestamps, all arguments and parent
identities remain in `final-cause-audit.json` and the raw journal. The selected
host import calls `ctx._voices.playRing(...)` and returns zero afterward;
`loop === 2` selects the existing ring-refresh path. There are no inner method
brackets, so no particular branch, native API or lock is implicated.

The last observer emission is **04:52:59.324**, fully drained through sequence
**5,937,009**, zero oversized records and zero pending fragments. Earlier there
are **10 explicit lost ranges, 8,528 slots**, producing two old unmatched entries
and six returns whose entries are absent. Those are not stalls. After the last
loss, **218,625 slots are contiguous**, including the final nested call chain.
The retained journal contains 2,964,221 entries and 2,964,222 returns.

Crucially, independent observer emissions stop too. Browser process samples show
active renderer PID **11520** present at **04:52:58.956** and absent at
**04:52:59.954**, remaining absent through the timeout. Browser-level process
requests still answer in about 1 ms, and `Browser.close` ACKs in 1 ms. This is
evidence of renderer-process disappearance before the pending owner read, not
proof of uninterrupted synchronous JavaScript inside `voice_play_ring`.
No renderer exit signal, crash reason, target-crash event or native stack was
captured. OOM, browser failure and an emulator regression are not established.
The historical Warcraft stall remains unattributed.

Under the actual original load, **all 32,552 admitted recorder batches became
durable**. Median delivery lag is 3 ms, maximum 500 ms; maximum receipt-to-durable
latency is 2,295 ms. Persistence median/max are 67.759 / 1,963.351 ms. Queue
maximum is 143 batches / 12,702,113 bytes, below the 33,554,432-byte cap. Thus
the Node receiver overload is resolved for this measured load, while the
observer ring's burst losses remain an explicitly demonstrated limitation.

The next prerequisite is to qualify full-load burst handling and capture
renderer target/exit evidence plus the inner `playRing` boundary before another
original. The final entry alone does not justify an audio or synchronization fix.

## Verification, source and shutdown

Staged source commit: `4428e7bb749258d6d203d275a58c45ebc2b46191`.
The relevant binary diff, untracked boot-file patch, new diagnostic helper
patches and runtime pins preserve source recovery without a source archive.
All 632 remote runtime pins remained unchanged. Twelve original media files
retain registered paths and hashes; media/source archives were not created.
CPU and renderer module SHA-256 both equal
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.

Focused checks cover 1,000 ordered recorder records and explicit bounded
overflow, independent release, remote production Worker/busy/strict controls,
20 PNG CRC/IDAT decodes and capture/module bindings, and 18 total exact ACKs.
No emulator code changed, so there is no new build or emulator-regression claim.

All **340 artifacts / 296 unique hashes** were retrieved and independently
reread at **04:56:02.168 UTC**, before normal stop. The 2,582,639,811-byte journal
is retained as a 131,820,796-byte gzip; its original SHA-256 is
`bb37538245ebad990e24f07e91e64c7b43cad35d6e1666cfd0f5458b07639668`.
All compressed logs were independently expanded through hashes locally.

Fresh box **bx_6f2py3r4** had an observable independent 25-minute watchdog before
allocation, initial expiry **05:05:40.205 UTC**. Normal stop completed at
**04:56:04.275 UTC**, receipt **stop_4eab031e3cdcb2d2**, `forced: false`.
Final state is **archived**, expiry **null**. All five controller/Chrome pairs
are absent, ports closed, profiles/writer locks removed; both lifecycle children
exited zero and the supervisor has no remaining children. Disk remained above
5,000,000,000 free bytes. No RAM gate, old-box resume/delete, public deployment
or nested worker was used. `RECOVERY.md` preserves the no-replay boundary.
