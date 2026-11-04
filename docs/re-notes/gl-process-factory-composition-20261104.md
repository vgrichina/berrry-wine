# Production GL process factory composition — 2026-11-04

`test/test-gl-process-factory-composition-web.js` follows `5ae6ef0be` through
the previously uncovered physical process startup and endpoint factory. It
reuses that test's actual public x86 producer and independent composition
equations through an optional transport hook; the original direct-endpoint
test retains its WebGL1/2 route.

The new test loads `host.js` and invokes the actual
`WineAssembly._getRenderWorkerManager` and `_createRenderWorkerEndpoint`
methods on an isolated process owner with the real compiled module, shared
memory, and native exports. It does not launch a full application UI. The
manager launches `lib/d3d-render-worker.js`, which imports and constructs its
production GL adapter. The context probe prepended to the served worker source
only observes real OffscreenCanvas context creation. The delivery gate holds
existing `render-message` publications; it neither creates packets nor replaces
the factory, adapter, GL calls, or rasterizer.

The caller contract is **backend selection, not a WebGL version selector**.
`lib/host-imports.js` selects `ctx.glBackend`, the `gl-renderer` query parameter,
or the default `webgl`. `GLRenderHost.Bridge._port` forwards `{api:'gl',backend}`
to the process factory. It does not forward `apiVersion`. The GL adapter defaults
to WebGL1. Although the lower-level `GLRenderWorker.create` supports an explicit
`apiVersion`, that is not a supported version-selection contract on this caller
route. The process factory's nested `options` therefore does not demonstrate a
lost caller-supported WebGL2 option, and this change invents no such API.

The matrix requests default selection, explicit `webgl`, and the reachable
`software` alternative on both existing modules. For WebGL it asserts actual
context class and adapter response version 1; for software it requires native
producer configuration and no WebGL context. Software means the real compiled
WAT backend, not a test rasterizer. Chrome uses ANGLE SwiftShader for WebGL;
this is not hardware GPU coverage.

Each case resolves public exports through LoadLibraryA/GetProcAddress and
executes generated x86 call sequences, checking completion and stdcall cleanup.
The fixture uses the existing calc PE only to initialize import metadata. The
compiled producer publishes shared leased command storage. Independent RGBA8
equations check nonzero destination, RGBA texture modulation, RGB-only fog,
blend, changed texture/fog/blend state and ordered overlap. A subsequent
DST_ALPHA draw exposes retained alpha in RGB; presentation must match its RGB.
WebGL delivery is held until draw plus changed texture binding occupy both
production queue credits. Native software draws execute on the producer; their
publication/presentation route is checked without pretending they are deferred
WebGL draws. Both routes must retire endpoint, physical worker, and render heap.

Run only under the authorized sole local runtime turn:

```sh
GL_PROCESS_FACTORY_EVIDENCE=scratch/runs/20261104-gl-process-factory-composition \
GL_PROCESS_FACTORY_CUTOFF=2026-11-04T19:45:00Z \
  flock /tmp/wine-local-runtime.lock node test/test-gl-process-factory-composition-web.js
```

The browser has a cumulative 180 second watchdog; the dated task cutoff is
19:45Z with cleanup by 19:48Z. Evidence records exact Git SHA, relevant binary
diff, owned new-file patches, existing module/PE paths and SHA-256, logs, pixels,
and small captures. No source snapshot, module/media copy, or archive is made.

Validation: **PASS** all six module/selection cases, 101 public x86 calls each.
Default and explicit WebGL selected actual WebGL1 contexts and response
versions, each with 36 shared leases and zero copied batches. Native software
selected its real producer configuration, created no WebGL context, and used
parked shared commands with zero deferred leases and zero copies. All cases
checked 64 pixels at each RGBA stage, all eleven alternative equations,
presentation RGB, context deletion, endpoint closure, physical worker stop,
and empty manager queues. The render heap handoff was zero in each case.

Composition left/right pixels were `[114,68,172,116]` / `[231,56,109,194]`;
DST_ALPHA witness pixels were `[178,37,94,92]` / `[249,13,26,95]`. The
compat-module default capture was personally inspected and shows the expected
purple/red witness halves. Software presents native pixels, while WebGL
presents an ImageBitmap; neither presentation's alpha replaces RGBA readback.
CDP reports ANGLE SwiftShader. As in the prior test, the page's Intel renderer
string is not evidence of hardware execution.

The first browser run passed both main-module WebGL selections and software
pixel/presentation checks, then failed a test assertion that incorrectly
expected deferred leases on the synchronous software route. Inspection of
`GLRenderHost.Bridge._admit` established that asynchronous lease admission is
explicitly limited to `webgl`. The test assertion was corrected; no production
code changed. Its failure report and log remain as `attempt-1.*`.

The final six-case browser run passed in 18.335 seconds. The original direct
WebGL1/2 route also passed all four cases after the shared helper refactor.
Including that regression and the first fixture attempt, cumulative browser
time is bounded above by **55.857 seconds**. All three own Chrome root PIDs
were verified absent, all servers closed, and the local flock was verified
available before normal heavy release at 18:13:32Z. The native synchronous and
queued composition regressions passed on both modules, along with syntax
checks and the locked full build. No production defect was demonstrated.

Box ID/state/expiry: NA. The coordinator owns future allocation and shutdown;
this worker closes only its own local browser, server, and physical workers.
