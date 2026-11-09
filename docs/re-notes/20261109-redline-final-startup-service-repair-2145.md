# Redline startup service investigation

Evidence: `scratch/runs/20261109-redline-final-startup-service-repair-2145/`.

The retained final generation has 6,002 custody rows and 4,096 observer records.
Its last SYSCALL release precedes Chrome's spawn; there are zero syscall-stepped
releases during the 10.038-second, 100 × 100 ms port gate. Chrome main PID 7267
has a 5.716837-second consumed-stop lower bound and 4.321163 seconds with execution
permitted between completed resume and next consumed stop. Execution permitted
includes kernel waits and descheduling. Neither interval attributes storage,
DBus or kernel cause. The 306-row startup consumer diagnostic has zero drops.

The Redline adapter now measures fsync, ptrace service and priority wait scans,
with monotonic wall and thread CPU clocks. At consumed waits it records bounded
comm/executable/command-line snapshots, verifies their start-time binding and
retains actual wait sequence references. These observations do not establish
ownership or lineage. The separate diagnostic has fixed record/byte bounds and
writes only at finalization. No new ptrace stop, clock extension, admission or
shared-provider edit is introduced. The existing every-CONT full-prefix barrier,
first-unlinked-EXIT handling, sticky failure and final-sync checks remain intact.

The composed fixture controller now waits for separate exact-image review. Its
failure path suppresses Browser.close after the first failure. The conditional
original caller uses the same terminal composition.

Offline causal controls ran the actual generated supervisor and shipped Node
port consumer with a small real publisher (no local Chrome). An injected 8 ms
storage service changed measured fsync wall time from 0.096 to 0.761 seconds;
an injected 4 ms ptrace service changed measured ptrace time from 0.006 to 0.411
seconds. Raising the syscall observer cap from 2 to 4,096 changed measured ptrace
calls from 92 to 1,446. All four publishers passed the unchanged port consumer.
This distinguishes instrumentation pressure and operation service in controls;
it does not establish the native failure's cause.

The final candidates were independently sealed and all 904 providers reread
before allocating one box. Native manifest:
`35f149ab0bc430fead0e950d82015af73b223ad4b69bdd08fa377ffce373aec8`.
The adapter was `2cc5b9b6231c6b3f1ffcc6307e8ad11815168a7e47bc464702f33d644d9101b6`.
Exact Git base and small binary diffs are retained; no source or media archive
was made. Shared providers and Nox/Q3 files were not edited.

One instrumented native fixture passed: Chrome PID 7857 published in 4,520 ms,
45 polls of the unchanged 100 × 100 ms gate. The synthetic fixture's startup
image was separately reviewed before comma input; its comma image was also
reviewed. It completed its supported comma-only path and ordinary quit ACK.
Custody reaped all 175 owned tasks; parent exit 0 has actual wait and separate
stdout/stderr EOF.

This supplies a new measured service boundary. In that gate, measured durable
journal fsync calls overlap 4.304231 seconds; measured ptrace service overlaps
0.003447 seconds and priority scans 0.008201 seconds. Roles include the real
Chrome launcher and its readlink/dirname/mkdir/touch/hash/curl/jq helpers,
Chrome main, Chrome_IOThread and Chrome_DevTools. The bounded diagnostic retained
29,846 rows with zero drops. These are call-service wall measurements including
descheduling, not evidence of a filesystem, DBus, kernel or CPU-time cause.
There is no native A/B causal improvement claim and no proven startup service
repair: the earlier timeout's underlying cause remains unknown. This fixture
was justified by the missing task/service identity, and supplies that boundary.
The durable release barrier was preserved rather than weakened.

The one conditional original then published in 2,708 ms / 27 polls. Separate
image reviews showed the Win32 launcher, title, Start Up menu and level grid.
The first runtime refusal occurred at 21:59:16.456Z: the level grid had acquired
pointer lock, so the ordinary absolute Stadium City click was rejected before
input. I incorrectly relied on the preceding menu's unlocked state. This is
an input-admission refusal, not proof of guest failure. No input, capture,
retry or quit followed. No side-door entry or driving was reached. Original
custody reaped all 354 tasks; parent exit 1 has actual wait and separate
stdout/stderr EOF. Independent socket checks found both lanes' server and
DevTools ports closed and no profile processes; remaining profile files were
removed only after that physical drain.

Meaningful checks passed: actual generated supervisor plus shipped startup
consumer under independent storage/ptrace/stepping controls; fixed diagnostic
bounds and failure propagation; actual composed terminal-close and external
image-review gates; durable-prefix/first-unlinked-EXIT/sticky/saturation/final
sync tests; bounded custody creation/cancellation controls; startup/boundary
consumer tests; full generated parent/controller/caller offline preflight
(10 tasks reaped, expected missing native ACK); conditional original preflight;
and `flock /tmp/wine-build.lock bash tools/build.sh`.

Joining the actual consumed-stop and service rows sharpens that boundary:
Chrome main's fixture consumed-stop lower bound is 2.597204 seconds, of which
2.557263 seconds overlap measured journal fsync service in the single supervisor.
1.337116 seconds match that main task's exact consumed wait sequence; the rest
serviced other task releases while main remained stopped. Main's 1.922796-second
execution-permitted interval is not CPU time. The original independently has
1.481210 seconds stopped with 1.450417 seconds overlapping journal fsync service
(0.745583 seconds matching main's wait sequence). Both gates have zero SYSCALL
releases. Thus the newly identified serial service is durable release journaling,
not active SYSCALL stepping. No attribution is retroactively assigned to the
retained failed gate. Original diagnostic retention later saturated at 32,768
rows with 235,717 explicit drops; aggregate totals survived. Startup's 88-row
consumer diagnostic had zero drops. Analysis outputs retain per-task roles,
wait sequences, intervals and the service intersection calculation.

Before shutdown, 223 remote artifacts / 204 distinct hashes / 13,768,449 bytes
were downloaded and separately reread against independent size/SHA inventories;
PNG CRCs and gzip CRC/EOF were checked. One original Chrome stderr gzip is
truncated and retained explicitly as failed cleanup evidence. It is not claimed
as browser stream EOF. The original's shutdown-failure preserves the first
pointer-lock refusal; custody/parent EOF and physical drain are separate proofs.

The sole box was `bx_fb2ugk2y`, UUID
`df08822e-66d9-471d-a83b-7d6192521aa0`. Initial expiry was
2026-11-09T22:14:47.669Z; the independently observed immutable watchdog deadline
was 2026-11-09T22:14:47.928Z. Exactly one delegated normal unforced stop completed
at 22:01:43.883Z, receipt `stop_5ed6ce24ec1fbe4b`. An independent API reread reports
`archived` (final archiveAfter null). The watchdog was actually waited, exit 0,
with separate stdout/stderr EOF and unchanged configuration hash. It is absent
from /proc. No box remains running for this task.

Next, only under a new assignment: test a durability-preserving lane-specific
release-service repair against this measured boundary before any fresh replay.
For gameplay, the visible level menu requires a current pointer-lock observation
and supported reviewed relative/cursor-only input. This task stops here.
