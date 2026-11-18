# D3DIM browser shutdown coverage: preparation preempted, November 18

No browser, original SDK application, moving frame or ordinary guest close was
executed. The independent disk watchdog terminated preparation before the
published source graph finished compiling. Browser/WebGL queued-work shutdown
and actual original guest exit remain open; this run adds no rendering pass,
production crash reproduction or repair.

Evidence: `scratch/runs/20261118-d3dim-current-browser-shutdown-crash-sweep-1220/`.
The requested `d3dim-current-stream-shutdown-crash-coverage-20261116.md` path is
absent. Its existing counterpart,
`d3dim-current-stream-shutdown-20261116.md`, and the November 17 current matrix,
paired SDK report and software Tunnel/Flip follow-up were reviewed. Those
already cover moving Tunnel scenes and Node software queued CLOSE/STOP, but
do not establish ordinary guest close while an original renders in WebGL.
Tunnel/WebGL was selected solely for this shutdown gap. No unchanged rendering
case was replayed.

The sole preparation used published main
`5146ccbcbd0ecdac398358762f591d8d4e996a37`, loading Git blobs into memory and
recording source pins and registered input hashes without source/media copies.
Relevant shared WIP was retained as a binary diff and excluded from execution.
The prepared run-local observer suffixes were intended to record actual
completed executor work, natural queue depth, endpoint CLOSE, process STOP,
native guest result and host stop bookkeeping separately. None was served.
The intended tmpfs profile helper was never reached; no Chromium profile,
server, guest endpoint, module or screenshot was created. Renderer/admission
files and Quake II/GLTron ownership were untouched.

The independent Node launcher prearmed a 240-second runtime deadline and
260-second cleanup deadline, with a 1,520,000,000-byte early reserve and
1,500,000,000-byte floor. `tools/native-supervise.cjs` used the available
`pdeathsig` process-group supervision, without ptrace or seccomp. The launcher's
100-ms statfs watchdog fired at 12:20:54.832 UTC with 1,517,010,944 bytes free.
Its minimum through supervisor drain was **1,496,621,056 bytes**, an actual
observed floor breach despite the reserve. A subsequent observation at
12:21:03 UTC found only 1,100,189,696 bytes. The run folder was 352 KiB at the
first alert. These observations do not attribute the external disk loss to a
writer or establish continuous floor compliance. No foreign cleanup was done.

The supervisor records the driver's actual SIGTERM exit, actual supervisor
status143, stdout/stderr EOF and `leaked:false`; its three tracked PIDs were
checked separately after termination. There is no guest exit code. The outer
tool session independently returned143; its enclosing sender/parent wait is
unknown and is not replaced by the supervisor's successful drain. The scope
remains closed: no runtime retry, endpoint query, threshold change or later
original follows.

Only this investigation note is published. No production code changed, no
canonical build or new focused rendering test ran, and existing passing
software tests are not relabeled browser evidence. Recovery uses the recorded
Git commit, relevant binary diff and run-local new-file patches. Selected
screenshots and tested module are null. No box was created: ID null, state
NOT_CREATED, expiry null, stop receipt null. No workers, Python, Wine, media
copies, frame bundles or public deployment were used. Browser shutdown
coverage requires a future authorized task with adequate actual disk space.
