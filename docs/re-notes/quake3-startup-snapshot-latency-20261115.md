# Quake III render Worker snapshot timing, 2026-11-15

Evidence: `scratch/runs/20261115-quake3-startup-snapshot-latency/`.
The originals reported by 900623a47 and 8e8241de stay closed. This task has
not launched an original or changed production startup, rendering, input,
qualification, capture, clocks, or the three-second transaction.

## Historical boundary

The raw operation log for request 1574 confirms **4445.490118 ms from send**,
**1433.425190 ms after the terminal decision**. The earlier result summary's
ambiguous prose does not change these measurements. This is the 47-byte
expression `globalThis.__gltronObserver?.snapshot?.()??null`, SHA-256
`000ba5e8856b8d2a95512815f84b8ee419cdcb73dbe015ee87dc832cc883f31c`,
on target 97012ADB48A78A3445DAE9BAB8740FF4, session
C463DFCA3684D3852B6F3CBF1987471E. It returned an object without a protocol
error or expression exception. No request followed the terminal decision.

The snapshot installed by `tools/quake3-browser-controller.cjs` reads
JavaScript counters, stored WebGL version/renderer strings, canvas dimensions,
bridge contexts and owner maps. It does not call a renderer snapshot API,
GL finish, readPixels, a guest export or a game function. The last successful
observation had one actual WebGL2 device/context/owner, one frontend/GL draw,
and zero presents/transfers. This characterizes that observation; it does not
measure the failed operation's body.

The actual `lib/d3d-render-worker.js` serializes production messages through
`messageChain`. Render initialization awaits WebAssembly instantiation;
GL endpoint creation imports its production adapters. GL batches execute
through `lib/gl-render-worker.js` and `OpenGLCompat`. Compilation, a synchronous
WebGL operation, pending Worker work, inspector dispatch and response delivery
are distinct possible contributors. The helper also enables Debugger and
fetches script source for each scriptParsed event, including anonymous snapshot
evaluations. None is yet established as the historical cause.

The scriptParsed notification just before the late response is a received
notification timestamp, not an in-Worker body-entry timestamp. The old log
has neither body-entry/completion samples nor a task trace. Its queue and
body times must remain null unless new evidence actually measures them.

## Diagnostic controls

`tools/quake3-startup-latency-controller.cjs` provides explicitly separate
diagnostic fixtures using the real production RenderWorker.Manager,
`d3d-render-worker.js`, current interpreter module and WebGL GL endpoint.
It never launches a game. The fixture submits a normal clear/present and a
packed triangle through the production command stream, recording ordinary
frame publication and batch completion without retaining pixels or buffers.

The exact original expression is sent through the existing helper's unchanged
three-second connection. A diagnostic-only wrapper calls the original snapshot
once and retains its result/exception. Binding notifications contain only
sequence, stage and actual clock samples. They record wrapper entry, original
body entry/completion and wrapper completion; separately sampled host operation
start/response identify the enclosing request and original target/session.
The wrapper also times ordinary WebGL compile/link/status/draw calls without
changing arguments, return values or exceptions, or adding GL synchronization.

The controls compare Debugger/source-fetch enabled and disabled, an ordinary
first triangle, an explicit bounded JavaScript compilation task, a bounded
Debugger-event/source-fetch burst, a bounded synthetic Worker native wait,
a deliberately slow diagnostic wrapper, expression error, and Worker
termination. Artificial work is identified as fixture work; in
particular the slow wrapper's inserted delay is separated from the real
snapshot body. These controls cannot retrospectively supply timing missing
from request 1574.

Worker performance.timeOrigin + performance.now and host Date.now share the
epoch. The report retains their raw difference with a two-millisecond sampling
tolerance; it never clamps a negative sample, changes a clock, or treats a
submillisecond residual as exact queue latency. The reported queue interval
includes protocol transport, inspector dispatch and all work before entry;
the native-wait fixture additionally proves overlap with an actual pending
Worker wait. Body durations use one Worker
monotonic clock. Identity invalidation, missing or duplicate samples, bad clock
ordering and expression errors cannot qualify as queue/body attribution.

Late binding/response observation is passive. After an UNKNOWN, no evaluation,
source fetch, cleanup CDP command or other request is issued on that route.
Independent diagnostic fixtures use distinct targets; none can replace an
original's identity. Process teardown remains separate from native Quit.

## Native findings and remaining cause

After verifying JezzBall and TriPeaks actual waits, EOF, absent PIDs and explicit
source/runtime releases, all eight native fixtures passed on Chrome
151.0.7922.108 / V8 15.1.206.16. Durations below are milliseconds. Pre-entry
and delivery intervals have the epoch sampling tolerance described above.

| Fixture | Send to response | Before entry | Original body | Completion to response |
| --- | ---: | ---: | ---: | ---: |
| Debugger + source fetch | 12.655 | 6.625 | 0.405 | 5.605 |
| Debugger disabled | 2.539 | 1.615 | 0.290 | 0.900 |
| First ordinary triangle | 10.324 | 3.475 | 0.145 | 6.285 |
| JavaScript compilation | 80.791 | 49.055 | 9.580 | 22.230 |
| Debugger/source burst | 106.528 | 3.665 | 0.295 | 101.975 |
| Pending native wait | 3351.761 | 3350.190 | 0.225 | 1.480 |
| Slow diagnostic wrapper | 3402.827 | 1.100 | 0.285 | 0.305 |

The native-wait fixture proves that the request was sent inside the actual
pending wait. The slow-wrapper fixture measures 3400.595 ms in the wrapper,
including 3400.175 ms before entering the original body. Both expire through
the unchanged three-second helper, receive valid late object responses,
remain permanently UNKNOWN and send zero post-terminal requests. Artificial
wait/wrapper work is not attributed to production snapshot code.

The bounded compilation task took 54.985 ms. The burst generated 212 actual
source-fetch requests; its snapshot finished in the Worker about four
milliseconds after send, while its entry/completion notifications reached the
controller around 105–106 ms. This establishes a separately measurable
notification/response-delivery cost under Debugger traffic. It does not prove
that such traffic caused the original overrun. The first triangle produced its
second ordinary frame; the longest observed GL stage was a 7.405 ms shader
status call. No ordinary fixture reproduced the original three-second failure.

In the queued control, scriptParsed arrived 3351 ms after send, one millisecond
before the response. In the slow-wrapper control it arrived five milliseconds
after send, 3397 ms before the response. The original's late notification
resembles the queue control. This comparison favors a pre-entry explanation
but cannot substitute for the original's absent in-target timestamps or
identify its pending native task, compilation or inspector work. **Original
queue/body attribution remains unproved and null.** Worker termination also
produced a distinct detached identity and terminal UNKNOWN; replacement
targets cannot inherit the old identity. Expression exceptions retained a live
transport in the separate nonterminal controls.

No production fix is warranted. Deferring the first query or suppressing
source fetches would change startup behavior without an established causal
red/green result. The precise next missing evidence is timing of the actual
startup task/GL call enclosing the original pre-entry interval, together with
snapshot entry/completion and ordinary publication on that exact owner.
The new fixtures demonstrate how to collect those boundaries; they do not
authorize reopening either original. Zero fresh originals were launched.

## Validation, closure and publication

All 12 focused timing/observer tests and the existing helper focused suite
passed. `flock /tmp/wine-build.lock bash tools/build.sh` passed in 45.077 seconds.
The complete existing current-module Chrome suite also passed: native queued
key and Mouse1 consumption, independent finite UP, immutable capture,
startup/capture negative controls, full owner/module/visibility validation,
and terminal UNKNOWN without replay. Its actual host-only consent PNG was
personally viewed and reviewed 20.116 seconds after capture. The selected
queued-input PNG was also personally viewed: a synthetic purple rectangle on
teal, with no original game or menu claim. Admission and qualification code,
including the original guard's accepted destinations, remains unchanged.

Before native launch, the timing run pinned 1013 source/input files and 585
host files; the qualification run pinned 1014 and 585. Actual resolved PATH
Node/Python, Chrome, known DLL autoimports and system TLB files including
stdole2.tlb were included. Both postflight checks found zero pin drift. All
244 successful served responses matched their pins, including the eight
pre-pinned synthetic HTML responses. There were no unpinned served bytes or
hash mismatches. No complete live host process-map inventory is claimed.

Six actual render-Worker CDP bytecode receipts matched the current module:
2202536 bytes, SHA-256
`f866c8a9247f51fabd296b012d5b963c51afb97fc29f786b22798c39d4e2cff0`.
Actual received renderer script hashes matched `lib/d3d-render-worker.js`,
46288 bytes, SHA-256
`94f9d3ee76a6a0707f4e7169974751343c2f464fef5be0e5896b450aa715da18`.
Git SHAs plus relevant binary diffs preserve source provenance, including
foreign WIP; source trees, game media and WASM files were not copied.

Both native controllers, Chrome processes, watchdogs, supervisors and outer
waiters exited zero with actual waits and both EOF. Both supervisors released
the heavy lock; all recorded PIDs, including 17 observed Chrome processes
from the timing run, are absent, HTTP ports are closed and profiles removed.
This is host teardown, not native Quit. There is no original capture, menu,
game input, permanent binding, score or progress claim. No box was created
(ID/expiry null, state NOT_CREATED, stop receipt not applicable), no workers
were spawned and nothing was publicly deployed. /home remained above 1.5 GB.
