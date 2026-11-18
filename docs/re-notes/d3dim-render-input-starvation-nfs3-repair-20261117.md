# D3DIM input starvation repair boundary, 2026-11-18

The repair is **not implemented**. The authored native 32-draw control again
expires an unchanged 800 ms Escape before application. New per-record timings
show that its long kick contains many short draws: 320 `DRAW_UP` records total
5,958.527 ms, with a maximum individual record of 35.279 ms. The longest full
kick in that run is 769.720 ms. This measures the authored fixture, not an
individual record from the previously closed NFS3 original.

Evidence: `scratch/runs/20261117-d3dim-render-input-starvation-nfs3-repair/`.
The preceding original and its 2,916.589 ms kick remain documented in
[the supervision investigation](nfs3-supervision-signal-source-driving-20261117.md).
No new original was launched. NFS3 driving after repair, Pause, Continue and
native Quit remain unproved. The old SIGTERM sender remains unknown.

## Native controls

The controls reuse published source `013d916c64632243ff0aa768debbbc39870f04d5`,
module SHA-256
`cf674e8d1780249498a3b9797142d5d9f01e9daedcf2089c8fc880f515c753c0`,
and the existing Device2 indexed RGB565+D16 fixtures. Source bodies stay in a
sealed memfd; Git and the recorded patches remain the source archive. The
published `976156b26` public observer is unchanged. A separate bounded passive
wrapper measures executor records without additional native reads or yields.

There are three launched native controls: the first uses only the existing
public observer, the second adds record timings to the 32-draw fixture, and
the third adds record timings to the one-draw fixture. Both loaded controls
cancel Escape before handler application. The timed loaded control observes
physical Escape/arrow UP and an empty queue 959 ms after the intended release.
That is late physical release, not proof of on-time release or native input
consumption. A preceding invocation failed locally on a missing argument before
creating a native process.

The one-draw control consumes Escape at the native USER return boundary and
changes its visible caption to `AUTHORED PAUSED Escape delivered`. The selected
whole PNG was inspected. Its grey caption fixture proves input handling and
the authored Pause consequence, not game geometry or NFS3 playability.

Each launched control prearms an independent observable 65-second deadline and
disk-floor watchdog. The launcher actually waits the supervisor and retains
its stdout/stderr EOFs. The supervisor actually waits native exit 0 and
watchdog exit 0, retaining both native pipes and both watchdog EOFs. Each
independent release helper is separately waited with both EOFs. No watchdog
fires. Loaded cancellation is terminal: no later query, capture, rebind or
input is sent; only the already armed release and owned shutdown run. Native
exit 0 is owned TERM cleanup, not native Quit.

## Concrete scheduling blocker

`GpuStream.drain()` executes each complete record before publishing its
`read_pos`, arena retirement, `done_seq`, and fence/readback slot completion.
`GpuStreamHost.Bridge.kick()` calls that drain synchronously in cooperative
mode. The native backend already offers `prepare/step/release/cancel`, but the
software executor selects its synchronous `draw()` wrapper. Yielding between
kicks therefore cannot interrupt the measured drain.

NFS3's previous native log identifies rendering on a cooperative guest thread.
`ThreadManager.runSlice()` invokes its native `run()` synchronously, then reads
registers, yield state and sleep state, with `_runningThreadHandle` held across
that call. Synchronous message and DLL callbacks also enter guest execution.
The CLI's main-owner facade deliberately remains local until its remaining
startup, observation and yield paths stop accessing local guest registers.
The existing worker import broker can park a worker, but the native CLI does
not select that guest-main ownership route. The foreign guest-host,
render-manager and legacy-adapter WIP were neither modified nor adopted into
the sealed controls.

A small independently executed Wasm counterexample makes the missing seam
concrete. On default Node v24.18.1, `WebAssembly.Suspending` and `promising` are
absent; returning `Promise.resolve(1)` through a plain `i32` import immediately
returns **0** to Wasm. With `--experimental-wasm-jspi`, a promising export and
suspending import correctly return 1, but an ordinary synchronous JS callback
that re-enters Wasm before suspension throws `SuspendError: trying to suspend
JS frames`. Adding a Promise to `kick`, or enabling JSPI only for the outer
slice, is consequently insufficient. Neither experiment modifies the emulator
or supplies a production repair.

The unresolved implementation requirement is an async-safe cooperative guest
execution boundary, including synchronous callback entry and sibling scheduler
exclusion, or a completed owning-guest-worker CLI route. It must preserve
SYNC/readback return values, record/arena retirement, ordered presentation and
close cancellation while permitting host input/release. No worker-busy wait,
early successful SYNC, draw omission, weaker ownership predicate or clock
change was introduced to obtain a passing result.

## Validation limits

Decoder, ring and final passive-observer tests pass. The shared render-worker
test passes its ordering, ownership/bounds, scoped-error and heap-retirement
checks. The current render-worker lifecycle suite fails in its pre-existing
VM fixture because `require` is undefined while loading `browser-native-input`;
this is recorded, not reported as a pass. A canonical locked build was also
attempted; its exact completion and any subsequent native GPS tests are in the
result record. These controls do not qualify an absent repair.

No production files changed. This report records a concrete unresolved
execution boundary; it does not claim that the task's repair or affected-original
acceptance is complete. No boxes, additional workers, archives, source-tree
snapshots, media copies or deployments were created. Box ID null, state
NOT_CREATED, expiry null, stop receipt N/A. The task releases its file claims
and stops after preserving evidence.
