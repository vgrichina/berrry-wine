# Native parent lineage before userspace release, 2026-11-08

The tracer could resume a linked child while another creator's kernel clone or
fork event was already pending. The resumed child can call `exit_group`, which
replaces the creator's event stop with EXIT. The new child then first appears
at EXIT, can be actually reaped, and correctly remains an unresolved lineage.
The repair queues ordinary CONT operations and probes real pending creation
events before each userspace release, including release of a parked child.
It preserves the accepted priority for terminal waits after EXIT.

Evidence: `scratch/runs/20261108-native-parent-lineage-2224/`. The predecessor
is accepted `bcf8c7bd788f2c63668406b11f72652006cde8dc`, kernel SHA-256
`5371233b12d3a63e13a9768529af43e5a61b7ff1682b2d3c09e4db6a976e12d0`.
Its 155 existing evidence references are independently reread by path/hash;
no qualification run, module, source tree, binary archive, or media copy is made.
Recovery uses Git plus the small owned patches retained in this run.

## Historical boundary

The recovered Drakan2203 journal is independently decoded and checked against
its original size/hash: 599,021 bytes, SHA-256
`39d28dded22047bd4931b4015dcf3b901ebf7e806be86c9166f603fb181b6f06`.
PID7411/start29590 first appears at custody917, already at EXIT1541 (918);
GETEVENTMSG reports exit0 (919), then actual before-reap922/reap923 status0.
The surrounding records release newly linked threads into TGID7399, including
7410 at816 and7412 at824. None contains a creator event naming7411. The original
356 actual reaps, completeFALSE and outerWAIT1 remain unchanged.

Darkstone2116 likewise first observes PID7535/start17834 at EXIT, with empty
cancellation and no recorded creator message. Neither journal identifies the
missing creating TID or the precise syscall that superseded its stop. The new
native proof demonstrates the event-loss mechanism; it does not fabricate that
missing historical boundary or identify either historical parent by inference.
Sampled PPID, TGID, adoption, and later absence never supply fork evidence.

## Actual native oldFAIL/newPASS

`ParentLineage` compiles a small C fixture containing a real process fork,
pthread creator, sibling killer, and nested pthread clone or process fork.
The creator waits for a file gate. Once the sibling's clone event is consumed,
the test opens that gate and observes the creator's actual pending kernel event
with WNOWAIT and GETEVENTMSG. Only selection among real waitable statuses and
the delay after the killer's actual CONT are controlled. No status, event PID,
identity, lineage, userspace exit, or terminal wait is manufactured.

Three pairs cover a linked sibling's initial-stop release, a sibling parked
before its parent event, and a process fork from a nonleader creator. The exact
accepted predecessor loses attribution in each pair and exits1. For the clone
pairs its first observation of the nested thread is irreversible EXIT, all five
identities have actual reaps, native root exit is0, and complete remains false.
For the process-fork pair the orphan stays stopped until the unchanged runtime
deadline cancels it; its real retirement still cannot resolve its lost parent.
The repair captures the actual creator/child event before the sibling resumes;
all three pairs exit0 with five identities actually reaped, complete true,
empty unresolved lineage/ptrace/resume sets, and native root exit0.

Each fixture has an independently observable PID/start watchdog armed before
the supervisor launch gate. The parent records actual supervisor/watchdog waits;
the isolation wrapper also waits adopted tasks. Temporary fixture source and
binaries are generated from Git and removed normally, with their hashes recorded.

Ordinary resumes carry the registered start identity and original delivery
signal. A newer real stop supersedes a queued resume. CONT ESRCH retains the
existing pending obligation. Irreversible EXIT retirement and its terminal wait
remain immediate; cancellation still preserves pending fork messages before
signals. Queued resumes are explicitly reported and cannot count as complete.
No timeout, ptrace option, signal escalation interval, or error is relaxed.

This protects available pending evidence before tracer-controlled userspace
release. A signal from outside the tracer or a running sibling racing after the
last probe can still destroy a message. Existing lost-event SIGTERM/SIGKILL
negative controls continue to fail honestly. CLONE_UNTRACED coverage and
nonleader exec remain unsupported; no blanket coverage or reliable Chrome
original claim follows from these offline fixtures.

## Validation and retained development failures

The full 35-test custody suite passes, including prior WNOWAIT retirement,
PID/start reuse refusal, terminal/adoption waits, cancellation priority, ESRCH,
and output EOF controls. The new six-arm test passes separately.
`flock /tmp/wine-build.lock bash tools/build.sh` passes.

An initial parked-fixture shim tried to select a SIGSTOP already naturally
consumed; those two fixture failures are retained. The shim now recognizes the
actual consumed stop. A new unavailable-observation check initially counted the
supervisor's own identity read; its retained failure is corrected by counting
only child observations. The initial outer command logger also mistakenly passed
a GzipFile descriptor directly to its subprocess, bypassing compression. Those
mixed bytes are retained verbatim inside `focused-first-mixed-output.bin.gz`,
explicitly excluded as valid compressed-log proof. Subsequent command output is
piped through compression before storage. All retained custody/command streams
are gzip from their first byte. The final inventory independently rereads every
regular file, original/stored SHA and size, gzip CRC, and producer receipts;
symlinks are recorded without following them. No peer or old-run data is deleted.

No Chrome, browser, game, input, remote runtime, box, or worker was launched.
Box ID NONE, state NOT_CREATED, expiry NULL, stop receipt NA. `/home` free-space
samples exceed1,500,000,000 bytes; continuous-floor monitoring is not claimed.
Next: a separately authorized original must pin the newly published kernel and
keep rejecting incomplete custody. No original retry is authorized by this task.
