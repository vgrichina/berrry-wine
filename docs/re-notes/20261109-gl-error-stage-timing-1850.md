# Opt-in actual renderer glGetError stage timings

The existing bounded GL diagnostic ring now records stages inside actual
renderer opcode 12. This adds evidence for a future authorized investigation
of the preserved 12,034.885 ms boundary described in
[the offline diagnosis](20261109-q3-renderer-read-latency-repair-1840.md).
It does not explain that earlier native stall retrospectively or repair it.
Evidence: `scratch/runs/20261109-gl-error-stage-timing-1850/` (exact Git base,
small relevant patch, focused-test and locked-build logs).

## Usage

Use the established control after the GL host module loads and **before the
ordinary app's host imports/GL bridge are constructed**:

```js
GLRenderHost.configureDiagnostics({enabled: true, maxRecords: 128});
// Construct the ordinary app through its existing route.
const partial = GLRenderHost.diagnosticSnapshot(); // synchronous, no RPC
GLRenderHost.configureDiagnostics({enabled: false}); // future bridges only
```

Direct constructors can use `glBatchDiagnostics: {enabled:true,maxRecords:128}`
and `bridge.diagnosticSnapshot()`. Explicit `enabled:false` overrides the module
default. Configuration does not retrofit an existing bridge. No new flag,
endpoint, timeout or scheduling policy is introduced. Storage remains the same
private v1 shared ring: 1–128 records, default 64, 64 bytes per record plus a
64-byte header. Stage events consume this existing capacity, so old history
will overwrite sooner. The host's bounded records and latest-bridge retention
policy remain unchanged.

## Stage boundaries

Each prefix has `-enter`, `-exit` and `-error` kinds, appended to the existing
kind table without changing older IDs or the ring ABI:

| Prefix | IDs | Exact operation enclosed |
| --- | --- | --- |
| `get-error-context` | 17–19 | `_current()`, including context lookup, drawable validation and any WebGL activation it performs |
| `get-error-flush` | 20–22 | Existing conditional `frontend.flushPendingDraw()` |
| `get-error-frontend` | 23–25 | Frontend error check, return-value read and clear |
| `get-error-backend` | 26–28 | Existing `frontend.backend.getError()` call |

The backend stage includes the context error facade: it may return a retained
error without reaching the device. Otherwise it includes device `getError()`
and native WebGL `getError()`. No change to `gpu-backend.js` is necessary.
Context activation and pending-draw submission may themselves invoke backend
operations; a long enclosing stage identifies that JS operation, not a driver
cause. There is no backend stage when a frontend error is returned and no
flush/frontend/backend stage when there is no current context.

All stages carry the existing endpoint, owner, context, frame token, opcode
(12), command offset/size and aux identity. Associate stage records with their
enclosing `opcode-enter`/`opcode-exit` or `opcode-error` interval in ring
sequence order. Every exit/error links to its own stage enter through
`beginSequence`; `durationMs` is the difference between its two renderer-owner
`performance.now()` readings. Host and renderer clocks must not be subtracted.
The opcode's stats/hook/capture setup and small gaps between stages remain
outside those stages; the outer opcode interval continues to cover them.
An original thrown value is rethrown, with a stage error followed by existing
opcode/stream/batch error markers. Boundary-error counts count markers, not
distinct failed operations. Replay's existing final flush still occurs after
the opcode and is covered by the stream boundary.

The enter marker commits before the observed operation. An independent host
snapshot can read it without scheduling renderer JS. Missing exit, overwrite,
observer-clock failure, unavailable slot or retirement remains UNKNOWN; none
establishes completion or a native cause. Snapshots retain the existing
`status: 'UNKNOWN'`. Renderer destruction still marks retirement.

## Semantics and verification limits

Only an armed renderer installs the stage hook. The unarmed opcode path adds
one opcode-specific hook check and retains the existing context/flush/error
implementation; it makes no stage callback, clock read, closure allocation or
diagnostic bookkeeping. The armed path preserves context activation, access
order, pending flush, frontend error return/clear, retained backend error
return/clear, backend query and thrown-value identity. Observer failures remain
contained by the existing recorder.

Passed `node tools/q3-gl-batch-diagnostics.test.cjs`: actual renderer adapter,
Stream and `OpenGLHostBridge.call(12)`; real frontend pending-draw merging and
consumption; actual GPU context error facade and device `getError` method with
a controlled native GL stub; frontend and retained error clearing; flush-set
errors; context/flush/frontend/backend thrown values; no current context;
observer-clock failure; unarmed zero diagnostic clocks; partial enter reads;
200 additional calls in a four-record ring; existing Manager/Endpoint/Node
Worker dispatch, ordering, error and off/on parity controls. Locked
`flock /tmp/wine-build.lock bash tools/build.sh` also passed.

These offline controls establish instrumentation and semantic behavior only.
Artificial clock increments and controlled backend operations do not reproduce
or identify the cause of the native 12-second delay. No browser, local Chrome,
leased box, heavy runtime or nested worker was launched. Box ID/state/expiry
and stop receipt: NOT_CREATED / N/A; no runtime watchdog or stop was needed.
The ReturnFire1822 then Nox1828 runtime queue is unchanged. Next is a separately
authorized native observation using these stages under unchanged ownership,
routing, debugger, capture, first-failure and timeout guards; screenshot and
post-navigation transport completion remain separate unresolved evidence.
