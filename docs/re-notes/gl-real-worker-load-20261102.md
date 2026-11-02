# Native OpenGL producer to real render worker under delay

The integration gap in [the lease sweep](gl-worker-lease-crash-sweep-20261101.md)
is exercised by `test/test-gl-native-render-load-web.js`. The final run passed
both WebGL and native software paths. No production defect was reproduced and
no production source changed. This is a bounded integration result, not a
general claim of crash freedom.

Evidence is retained in `scratch/runs/20261102-gl-real-worker-load/` (ignored),
especially `evidence-review.json`, `retrieved/gl-load-final/observations.json`,
the two PNGs, `final-locked-build.json`, and `RECOVERY.txt`.

## Actual components and fixture boundaries

The producer is a physical browser Worker instantiating the shipping Wasm over
shared process memory. It calls the native encoder export, uses the native
three-slot pool, and blocks through production `GuestRpc.createWorkerImports`.
Production `createMainBroker`, `GLRenderHost.Bridge`, shared-packet pool,
submission queue, `RenderWorker.Manager`, endpoint protocol,
`d3d-render-worker.js`, `gl-render-worker.js`, and backend execute unchanged.

The harness supplies a minimal window/DC and real native-backed GDI surface,
uses the production renderer's three canonical readback methods, and supplies
the host's GL descriptor adapter. Unrelated host imports are inert. This does
not boot `host.js`, an x86 application or a game. There is no FakeGL, VM worker
double, semantic replacement consumer or replacement rendering result.

A worker wrapper queues real incoming render messages for 300 ms before
delegating to the unmodified worker handler. Its observers hash submitted
bytes and inspect contexts without replacing commands, replay or replies.
The remote supervisor bounds the complete invocation to 90 seconds; the final
invocation took 9.74 seconds.

| Path | Actual rendering/presentation | Coverage limit |
| --- | --- | --- |
| WebGL | Actual worker GL backend; CDP `SystemInfo` reports `ANGLE_SWIFTSHADER`, SwANGLE 5.0.0 | Software WebGL, no hardware GPU coverage |
| Native software | Shipping WAT rasterizer in producer; actual render worker mirrors the leased software front and presents it | Synchronous software lease; not the separate queued D3DIM draw executor |
| Context retirement | Real backend deletion and owner invalidation, then a native producer present | Cross-owner deletion record is deliberately fixture-authored shared memory, not a second native producer |

The installed Chrome launcher adds a fingerprint seed. Its page-level WebGL
identity reported Intel/Mesa, while browser GPU information identified
SwiftShader. The fixture requires browser-level SwiftShader confirmation and
retains both observations. Node was v24.22.1; installed Chrome reported
151.0.7922.108. Nothing was downloaded.

## Independent output and ordering assertions

Each backend presents six frames with literal red, green, blue, yellow,
magenta and cyan background pixels, plus a literal white packed triangle
pixel in every frame. Native `glReadPixels` returns `[0,255,255,255]` and native
GDI `GetPixel` returns COLORREF `0xffff00`. Query and pixel destination
canaries remain `0xa5a5a5a5`.

Every native packet follows exact three-slot rotation. Hash/offset/length
observations immediately before real consumption equal the published bytes,
despite subsequent visible overwrites of reused slots. WebGL reports six
leased frame batches, zero copied batches and zero copied bytes. The first
two frame acknowledgements precede first consumption; the third waits
451 ms, until the oldest presentation retires. Live submissions stay at most
two. All six frame results are 1 and their observed pixels retain FIFO order.

The WebGL queued finish waits 910 ms; native pre-GDI readback waits 613 ms;
finish, backend `RED_BITS` query and `glReadPixels` each wait about 301–303 ms.
`RED_BITS` writes literal 8 before the producer continues. Software frames
each wait for presentation, and finish/readback wait about 301–302 ms.
Software `MAX_TEXTURE_UNITS` writes literal 2 locally in the native producer;
its 0.29 ms query is explicitly not evidence of a backend query barrier.

After cross-owner deletion both paths report zero contexts, invalidate active
owners and return 0 from the native producer's subsequent present. RPC slots
are idle. Endpoint closure removes ports, frame owners and layers. The actual
worker acknowledges `render-stopped` with `heapHead: 0`; the manager invokes
physical termination, pending requests drain, and CDP reports no surviving
fixture worker targets. Browser Workers have no independent OS exit code.

## First failures, validation and recovery

The first concrete unexpected result was the fixture's SwiftShader-only
page-renderer assertion rejecting the fingerprinted Intel identity. Its six
pixel frames and native output checks had passed. That run is preserved in
`first.tar.gz` with its exact fixture source and input hashes. Two subsequent
fixture failures are also preserved: unhandled production async `dx_trace`
messages, then an incorrect software query expectation of 4. The harness now
routes async calls through production `serveCalls`; current native source
explicitly returns 2 for `MAX_TEXTURE_UNITS`. These were harness assumptions,
not production fixes. No old-source production rejection experiment was
appropriate because production remained unchanged.

Final Node PID 34247 exited 0; Chrome PID 34254 exited 0 without a signal.
Earlier Node invocations exited 1 on assertions; each Chrome exited 0. None
timed out. All four evidence archives and their 24 listed files matched SHA256
before shutdown; all 43 final served hash records matched pinned runtime
files or recorded virtual fixture sources. The final archive SHA256 is
`129f86001e302991dc6b7045a1fe14467ebe5b50dcb1636261b9fb9f3bd79e98`.

The unchanged shipping module is 2,069,384 bytes, SHA256
`6d9563ff4a1c089c9d0ac4153748411990dc3c92f3a50e2509bbe9ffaaca30a7`.
Both locked full builds passed. Final source verification matched 1,264
entries; all 1,263 entries apart from the new fixture also match admission.
The original two accepted test files retain their hashes and assertions;
neither was rerun or represented as integration.

Execution started only after DBTS19762 then Asghan25107 actual terminal,
result/final, exact author release and helper-absence gates. Separate boat
`bx_3yvraw6k` had finite TTL 5,400 seconds and original expiry
`2026-11-02T17:51:41.686Z`, recorded before execution. All named processes,
crashpad helpers and temporary profiles were absent before the explicitly
delegated stop. Retrieved evidence was verified first; boat state is
STOPPED at `2026-11-02T16:27:48.027Z`. Observed local free space stayed above
the owner's 2,000,000,000-byte floor.

Recovery needs only a fresh finite-TTL box with installed Node/Chrome, the
17 pinned runtime files and this fixture. Run
`GL_LOAD_OUTPUT=/absolute/evidence/observations node test/test-gl-native-render-load-web.js`
from that minimal runtime, under the documented supervisor deadline. Detailed
transfer, verification, failure archives and recovery commands remain in
`RECOVERY.txt`; no stopped boat must be resumed to inspect the retained result.
