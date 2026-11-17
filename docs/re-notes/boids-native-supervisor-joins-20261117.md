# Boids supervisor termination and joins

The original motion result remains as recorded in
[the natural display notes](boids-natural-display-completion-20261117.md).
Publications 58/122/244 completed within 3000 ms, and the selected 122/244
outputs establish colored flock motion over 16,413 ms. The original outer
143 has no native/watchdog wait or EOF receipts. Its cause remains UNKNOWN.
Browser close zero and absent original PIDs are separate facts. This work
does not access or replay either closed original. Photo 2927 is earlier,
2926 later; correction 2928 records that chronology.

`tools/boids-current-supervise.py` now owns every acquired native/watchdog
process through one cleanup path. TERM/INT record shutdown intent without
raising inside pending child startup; repeated signals cannot interrupt joins.
Both native pipes drain throughout preparation, runtime and cleanup, using
nonblocking reads into log files rather than an accumulating memory buffer.
EOF means an actual zero-byte pipe read. Receipts retain each actual wait,
native numeric exit and signal, outer requested exit, timeout/error cause,
pipe byte counts and EOF/wait timestamps. A log-open/write failure fails the
supervisor while it continues draining. Missing/unstarted resources remain
null, and failed joins/EOF are never reported as passed.

Cleanup discovers only the invocation's fresh exact environment token. It
checks process start identity before and after opening a Linux pidfd and
signals through that fd, excluding itself. It never signals a process group,
matches a command-line substring, or uses absence as a wait. The watchdog
does not inherit the native token. TERM is followed by bounded KILL escalation
for owned survivors, including descendants holding pipes. Native wait and
observed EOF precede final watchdog cancellation; if native closure fails,
the independent watchdog remains armed through its deadline. Runtime watchdog
arming precedes preparation watchdog retirement. Production preparation
240/260 seconds, runtime 300/320 seconds and capture 3000 ms are unchanged.
Linux pidfd support is checked before any child launch.

The narrow runner changes preserve a failed observation as a nonzero native
exit, record browser target destruction, and await page closure on authored
fixtures before the existing actual Chromium close wait. Browser target
destruction is browser evidence, not a guest ExitProcess/native Quit claim.

Evidence: `scratch/runs/20261117-boids-native-supervisor-joins/result.json`.
The focused suite exercises twenty-one actual OS cases: normal and noisy output,
literal exit 143 versus SIGTERM, token-owned descendants, an unowned pipe
holder that must finish without being signalled, outer TERM/repeated TERM,
pending native/watchdog startup, an exception after acquisition, preparation
and runtime timeouts, late exit 23 during cleanup, both watchdog prearm
failures, native spawn failure, log-open failure, a stopped supervisor with
an independently firing watchdog, and a deadline firing during cleanup. An
injected missing EOF observation produces a bounded failure with false EOF
and leaves the independent watchdog uncancelled through its actual firing.
Identity controls cover self, sibling token mismatch, stale identity,
identity change across pidfd opening, and an exited PID. Receipts verify
actual native/watchdog/outer joins and observed pipe EOF for resources that
were started, plus chronological cancellation after native closure.

A newly authored public Device2 fixture runs through the current runner with
real guest Worker and render Worker WebGL. The final run records actual
native/watchdog/outer zero waits and both pipes at EOF, awaited page closure,
guest/render target destruction and actual Chromium close zero. Its page,
guest and render debugger module hashes match the recorded Git-built module;
the literal source/output check uses the existing independent integer/half
centre oracle. No original EXE, media, input, unpause, configuration or clock
changes occur. Only the named selected authored source/output screenshots
remain; no source archive, frame series or capture bundle is created.

The focused suite, Boids rendering controls and locked canonical build pass.
Exact Git identities, relevant binary patches (including the new test and
these notes), tested module hashes, logs and actual receipts are retained.
No box is created: ID/expiry null, state NOT_CREATED, stop receipt N/A.
Uncatchable supervisor SIGKILL/host loss cannot produce a supervisor wait
receipt; that limit is not converted into success. No further original is
authorized or needed. Next work can use this supervisor for separately
authorized authored investigations; the historical gap stays UNKNOWN.
