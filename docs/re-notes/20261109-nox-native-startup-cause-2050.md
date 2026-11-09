# Nox startup: measured custody suspension, fast instrumented native fixture

Run: `scratch/runs/20261109-nox-native-startup-cause-2050/`.
Tested Git base: `02e95626dcbc46b7cab11618eec1b904f844f7b9`, with
`code.patch` and the small run-specific inputs. Git remains the source archive.

## New discriminating evidence; causal repair remains unselected

The retained 2020 failure contains **about 6.007 seconds of observed Chrome
main-thread ptrace suspension inside its 10.144656-second readiness window**.
These are 43 nonoverlapping spans from the journal's `before-consume` stop
observation to the matching successful `ptrace-cont-returned`, clipped to the
startup window (wall-clock journal times; the failure endpoint has millisecond
precision). `retained-analysis.json` records each sequence pair and hashes
the independently reread original journal, process record and failure record.
This is measured suspension, not an estimate from DBus stderr. It excludes
unobserved stop time. The old journal timestamps do not separate journal writes,
fsync, scheduling, kernel waiting and other tracer work.

One fresh, instrumented native fixture **passed**, with no original selected.
Within **1,314.989 ms after spawn returned**, its unchanged startup block had
read the port file and opened the WebSocket, after 11 existing 100 ms polling
waits. This is an upper bound on the file read, including connection setup;
it is not an exact port-file creation timestamp and excludes synchronous spawn
time. Over that same remote monotonic interval:

| Observation | Measured result |
| --- | ---: |
| Synchronous custody journal service | 531.465 ms, 747 calls |
| Time inside fsync calls | 468.277 ms |
| Main-thread samples | 12 |
| Sampled main-thread states | 3 tracing-stop, 2 sleeping, 2 running, 5 D |
| Dropped journal/fsync/ptrace timing samples | 0 / 0 / 0 |

The five D samples recorded the literal wait channel
`kvm_async_pf_task_wait_schedule`; three tracing-stop samples recorded
`ptrace_stop.part.0`. These observations do not establish the wait state of the
earlier failed process or a host/page-fault causal explanation. Other Chrome
threads are not sampled. Fsync call duration includes descheduling inside the
call; it is not isolated device latency. Journal service also includes
compression, writes and flushes.

This distinguishes substantial retained main-thread suspension from the fast
fixture's directly measured journal/fsync service. It does **not** prove that
fsync caused the old failure, nor that DBus, ptrace itself, or a Chrome defect
did. No causal startup repair was selected. The original was **not launched**:
a successful observation fixture alone does not satisfy the repair condition.
There were zero native screenshots, no original gameplay input and no retries.

## Changes and actual-consumer proof

`tools/nox-current-driver.cjs` now emits bounded process-state observations on
the existing readiness polls and a success/failure monotonic timing record.
Readiness still uses only `DevToolsActivePort`; the 100 × 100 ms bound, original
exception, terminal handler, source/media/module guards and input behavior
remain unchanged. Timing publication errors cannot replace the first failure.

The Nox-only `tools/nox-startup-custody.py` authenticates the exact published
`native_kernel_custody.py` bytes, executes them unchanged, and measures journal
writes, fsync calls and actual ptrace returns. It retains at most 4,096 samples
per category and aggregate counters. There is no new timer, logger process,
retry, wait or admission rule. The actual native `runtime.py` calls this adapter;
the exact adapter and caller are in the independently verified staged inputs.
No shared provider was edited. All four owned tools were independently absent
from 15 RF2045/Q32045 manifests.

- Generated-consumer controls: **14 passed**, including an actual SIGSTOP child,
  missing port with listening-only stderr, early death 17, malformed port,
  source/module/media/repin refusals and ordinary/drag/first-drag-failure paths.
  Stopped and absent process samples were checked against real Node children.
- Whole generated consumer under **actual Linux kernel custody**, with a Node
  browser peer and deliberately slow synchronous journal service: **passed**;
  all 18 owned tasks were really reaped. The consumer observed its real tracer
  PID, reached the no-original-selection boundary and closed once. The bounded
  observer measured the deliberately slow service and real fsync calls.
- Three actual custody controls passed: durable ordered prefix before executable
  CONT, sticky service failure, and final-sync failure refusing acceptance.
  Separate observer-error controls preserved the exact first exception even
  when timing publication also failed.
- `node --test ops/browser-native-input.test.cjs`: **3 passed**.
- `flock /tmp/wine-build.lock bash tools/build.sh`: **passed**, actual exit 0;
  repeated after the final observer change.

The initial offline preflight child hung before any browser launch; it was
terminated and retained. A direct preflight immediately passed, and the full
fresh run passed. Two subsequent offline custody reruns refused an existing
output directory; the retained output was moved to its test directory before
the final passing run. The test now moves successful output itself. These were
offline harness corrections, not native stage retries. A documentation-only
HEAD advance also required a reviewed plan metadata correction; every input pin
was reread unchanged and the actual provider Git diff was empty.

All 776 consumer inputs differ from 2020 only in the owned Nox composer. Both
freshly recompiled modules and all 126 media pins match the predecessor. Module
SHA-256 identities are `3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`
and `ecb45716b1ee7fc5218b1670dd270b19c7664ee30d000b3360a12786a1c21eaf`.
No game module is claimed loaded by this fixture. Actual browser: Chrome
151.0.7922.108 / V8 15.1.206.16.

## Native custody and delegated stop

One box: **bx_jrdhbjw4**, watchdog UUID
**b3f158a8-698c-4ec1-b364-7cc9473d6d6d**. The independent watchdog was armed and
observed before creation, with immutable deadline **21:23:41.057Z** and initial
box expiry **21:23:41.940Z**. Browser work deadline was two minutes earlier.
All **833 individual staged inputs / 107,843,593 bytes** were independently
SHA/size checked remotely before the sole fixture. No source or media archive
was created, no local Chrome ran, and no other box was controlled.

Chrome exited **0**, no signal. The custody parent actually waited **0**, with
separate stdout/stderr EOFs. All **147** tasks were reaped, with complete kernel
drain, no remaining/unreaped identities and command-output EOF. Independent
checks found all four recorded PIDs absent, both ports closed and profile absent.

Before exactly one delegated unforced normal stop, **36 artifact references /
34 unique SHA identities / 638,997 referenced bytes** were retrieved or matched
to retained local bytes and independently reread for SHA-256/size and gzip CRC.
The native PNG set was independently empty. The watchdog reread the retrieval
pins again before requesting stop.

Independent final API read: **ARCHIVED**, archiveAfter **null**, expiresAt not
returned. Stop **stop_69088fb8fad7b876** completed **forced:false** at
**21:00:58.440Z**. The watchdog actually waited **0**, with separate stdout/stderr
EOFs and its child reaped. No second stop, resume or delete was issued.

The next useful investigation is timing a slow startup with these observers,
or proving a custody service change preserves every existing durable barrier
before selecting it as a repair. Repeating the unchanged readiness limit or
using the later stderr listening line cannot establish that cause.
