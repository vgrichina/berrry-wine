# Q3 bounded GL batch execution diagnostics — 2026-11-08 22:36Z

Opt-in production instrumentation landed in `lib/gl-render-worker.js` and
`lib/gl-render-host.js`. This supplies missing execution boundaries; it does
not diagnose either retained stall or authorize another original run. The
[11,152 ms renderer-owner span 2667 and final pending PAGE419](q3-owner-capture-latency-2203-20261108.md)
remain separate observations. [Accepted page-entry instrumentation](q3-execution-boundary-diagnostics-2215-20261108.md)
is unchanged.

## Enable and retrieve

After the GL host module loads, **before constructing the app's host imports**,
an explicitly authorized diagnostic caller can run:

```js
GLRenderHost.configureDiagnostics({enabled: true, maxRecords: 64});
// Create/run the ordinary app through its existing path.
const partial = GLRenderHost.diagnosticSnapshot(); // synchronous, no RPC/await
GLRenderHost.configureDiagnostics({enabled: false}); // future bridges only
```

Direct callers can instead pass `glBatchDiagnostics: {enabled:true,maxRecords:64}`
to `new GLRenderHost.Bridge(options)` and use `bridge.diagnosticSnapshot()`.
An explicit `{enabled:false}` overrides the module default. Defaults are off;
no opcode wrapper, clock read, context lookup or per-op trace allocation is
installed when unarmed. Configuration applies to future bridges, not an owner
already running. No host.js/host-imports edit, query flag, backend switch or
transport timeout change is needed. This is usage documentation, not run approval.

The module retains only the latest armed bridge's bounded **data**, not its
bridge, windows, port or owning objects. Earlier bridges' history is UNKNOWN;
use the instance method if retaining a particular bridge. Disabling future
instrumentation leaves that latest partial snapshot available. Each close sets
host `closed`; actual render adapter destruction sets `retired` in shared memory.
No diagnostic endpoint or owner lifetime is extended.

## Genuine boundaries and correlation

The existing `Manager.createEndpoint` → render-open options carry a private
shared diagnostic buffer to the existing GL adapter. The existing
`Endpoint.request` → production `d3d-render-worker` render-request dispatcher →
`GLRenderWorker.execute` still execute each batch once. Its first marker is
`batch-enter`, before drawable/surface reconciliation. `stream-replay-enter`
immediately precedes the real `OpenGLHostBridge.replay`; its exit includes
Stream parsing, dispatch and the existing replay-finally pending-geometry
flush. Neither batch nor replay exit means GPU completion.

Only the armed adapter wraps its own real `bridge.call`. `opcode-enter` occurs
before the existing call's stats/hook/capture and `_call` dispatch; exit/error
surround exactly that original call. Return values, `this`, original thrown
values and the existing replay finally are preserved. Parsing failure can have
stream/batch error without opcode entry. A replay-finally flush can fail after
an opcode exit; it is covered by stream/batch error, not relabelled opcode error.

WebGL `frame-produce` surrounds the existing `transferToImageBitmap` operation
after a usable layer/canvas was found. Software `frame-produce` surrounds the
existing leased-front validation and BGRA→RGBA copy. `frame-send` surrounds the
existing `sendFrame`, which uses the real render-event transport. Host
`frame-consume` surrounds the existing ownership checks, canvas update, merge,
repaint scheduling and callback. `frame-rejected` explicitly records the existing
stale/closed/replaced-window drop and bitmap disposal. A consume exit can follow
rejection: it is callback return, not successful presentation. Actual browser
compositing, display scanout and GPU execution remain unobserved.

Records carry the actual endpoint ID supplied by render-open, batch owner,
existing frame token, stream offset/bytes, dispatched opcode/aux, actual current
context handle and production frame HWND where available. Zero means unavailable
or no current context, not an invented identity. Context entry/exit can differ
for WGL context operations. Host request records map frame token/endpoint to the
**actual** `port.sequence` assigned synchronously by `Endpoint.request`, read
after that call, never predicted. Request IDs are not injected into the payload.
The ring sequence is a cursor and entry reference, never a frame, module or
generation identity. No sampled absence is promoted to progress/readiness.

Render spans contain `beginSequence` and `durationMs`, computed exclusively
from that render owner's `performance.now()` entry/exit. Host records use the
host's `performance.now()` separately. Subtract only matched records in one
domain; host send/receive and render timestamps cannot measure queue residence
or cross-owner latency. Marker overhead is included. There are no GPU fences,
readbacks, extra awaits, guest writes, input changes or native completion claims.

## Bounds and stuck-JS availability

Capacity defaults to 64, accepted range 1–128. A 16-word header and 16-word
slots use at most 8,256 bytes of diagnostic SAB per armed bridge; host records
have the same capacity. A negative slot stamp invalidates an overwrite; readers
check the expected committed sequence before and after copying each slot and
skip races as `unavailable`. Pulls make one bounded pass and never retry or wait
for a writer. Overwrites increment `dropped`; observer failures increment
`errors`. `boundaryErrors` counts failed boundaries, so one dispatch exception
normally contributes opcode, stream and batch errors. Counters saturate at
signed INT32 maximum; the sequence stops before wrap and subsequent marks drop.
Unrepresentable signed-32-bit tokens are dropped with error/drop counters rather
than wrapped into another identity; unsigned opcode aux is retained as UINT32.
Invalid options/SAB availability fail diagnostic setup without failing rendering.

The independent host can retrieve the last committed pre-op marker from shared
memory while render JS is synchronously blocked. The test proves that during a
real production render-request, **100 synchronous pulls** neither enqueue work
nor settle/join the pending batch. Entry without exit remains a partial marker.
The top-level snapshot deliberately always reports `status: UNKNOWN`: missing
markers, dropped/racing records, retired owners and truncated history cannot
establish progress or complete coverage. A retained entry may outlive its owner.

**Availability limit:** this is not an independent Node/CDP telemetry channel.
If the host/page JS itself is stuck, its synchronous snapshot function cannot run
there. No live page snapshot is claimed for the final pending PAGE419 interval.
The SAB retains the last committed render pre-operation marker for a runnable
host reader; the existing accepted Node deadline/console path can still retain
its previously delivered page-entry markers. GL records are not automatically
exported into that preload's gzip file. Host callback entry is retained in the
bounded host data, but reading it also requires a runnable host. Process death
without a previously retrieved snapshot can lose diagnostics. No new service,
pending-request observer RPC, polling loop or fabricated liveness is introduced.

## Offline controls and evidence

`node tools/q3-gl-batch-diagnostics.test.cjs` passes. It uses actual
`GLRenderHost`, `Manager`/`Endpoint`, an actual Node Worker running the production
dispatcher, real Stream parsing and real GL bridge dispatch. WASM exports and
the canvas consumer are synthetic: this establishes plumbing and JS semantics,
not native rasterization, hardware latency or Q3 behavior. A separate synthetic
GPU context adapter exercises the real WGL dispatch/replay/publish path and
bitmap transfer/send success/errors; it supplies no GPU evidence.

Controls cover direct and normal-constructor module opt-in, off/on command,
result, memory, frame, error and blocked-owner ordering parity; matched render
span durations; real pending opcode partial pulls; late requests rejected by an
already failed dispatcher; original thrown-object identity; late/reused-HWND
frames; consumer errors; ring bounds/overwrites/racing slots; observer clock
failure; setup failure; owner retirement and no per-op wrapper when off.
Every fixture prearms a parent deadline and awaits worker termination.

`node test/test-gl-shared-render-worker.js` and
`node test/test-opengl-webgl-drawables.js` pass, as does the required
`flock /tmp/wine-build.lock bash tools/build.sh` after the final production edits.
The optional broader `node test/test-shared-render-worker.js` fails at line 287
in its legacy DIB-flip fixture. An isolated rerun confirms **neither changed GL
module is loaded**; that unrelated test was not modified or reported as passing.
Initial test-fixture failures (wrong Manager method, expected sticky close
rejection and missing fixture renderer return) are preserved before correction.

Evidence: `scratch/runs/20261108-q3-gl-batch-diagnostics-2236/`. Command/output
streams are gzip from their first stored byte. Every regular evidence file is
inventoried with original/stored SHA-256, size and independent gzip CRC reread;
the inventory's own seal is external. Exact Git base plus small owned binary
patches preserve the source; existing module/media are referenced by PATH/HASH,
not copied or archived. No peer WIP, old-run deletion or RAM gate. An observable
3,600-second independent board-watch timeout was prearmed and stopped at finish.
Only sampled /home free-space compliance above 1,500,000,000 bytes is claimed.

No Chrome/browser, original/game, remote runtime, box, input, other agent or
deployment was used. Box **NONE**, state **NOT_CREATED**, expiry **NULL**, stop
receipt **NA**. Accepted SoftwareGL torch evidence is preserved. Full27, parity,
audio, FPS and WebGL gameplay remain open. Next: only a separately authorized
run may arm these boundaries and inspect actual records before a cause claim or
repair. Single task; publish owned paths, release and stop.
