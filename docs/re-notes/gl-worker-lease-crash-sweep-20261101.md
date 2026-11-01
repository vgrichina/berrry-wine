# OpenGL worker/RPC and render-bridge lease sweep — 2026-11-01

Run `20261101-gl-worker-lease-crash-sweep`: both requested fixtures passed,
sequentially, with original assertions and 120-second command limits. No
unexpected native crash, unhandled Wasm trap, signal, assertion failure or
timeout occurred. The first fixture executes the native producer in real
Node `worker_threads`; the second uses deferred endpoints and VM/backend
doubles. These are distinct coverage results, not an end-to-end native
producer-to-render-worker/GPU result.

## Revision, build and exact identity

Requested baseline: `6f1f57602e36c30fc45fdd755f7286b20d39cf4a`, shared `main`.
Both commands ran at `81b757b5614dc495d31e7134826ac7b8b063497d`; only
`TODOS.md` and `ops/STATUS.md` advanced, within the allowed documentation-only
exception. All 4,462 inventoried inputs match baseline tracked bytes and
accepted build `scratch/runs/20261101-d3d-typed-stateblock-injection/inputs-after.json`;
they remain unchanged before/after these tests. All 19 distinct loaded
CommonJS files match baseline and their exit-time hashes. VM-loaded endpoint
sources are separately preserved and hashed. The input inventory also covers
the sealed compiler graph, which is not represented fully by CommonJS cache.

Reused accepted `build.log` and `outcomes.json` from that build run:
`timeout 120s flock /tmp/wine-build.lock bash tools/build.sh`, exit 0,
46.479 seconds. No accepted test or build was rerun. Current primary artifact:
2,025,029 bytes, SHA-256
`2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`.
Local environment: Linux x86-64, Node 24.18.1, V8 13.6.233.17-node.50.
No compiler/artifact or NODE_OPTIONS override was used.

Both real workers instantiated the same 2,024,992-byte module, SHA-256
`ac9beb2ae3f746c621d0f258d4d3a2d1910207b0006e13ed96856bd0ac4975d9`.
All nine non-custom sections equal the shipping primary module; only its
37-byte encoded `wine-region-layout` custom section is absent. This fixture
calls `compileSrcWasm()` without a transform. Exact module captures from
threads 1 and 2 and section hashes are retained in `module-identity.json`.
The bridge fixture compiles or instantiates no Wasm module.

Original fixture SHA-256 identities:

| Fixture | SHA-256 |
| --- | --- |
| `test/test-opengl-wat-worker.js` | `a8747025d2b4ffba88b605d00dfbdfc61c91618aa91fb25a29887b02378cd926` |
| `test/test-gl-shared-render-worker.js` | `a1f85520b08c1899c75f5d35d3e3b39e69b2145dd681b1d7baf4e5708721453b` |

## Commands and outcomes

Evidence is ignored under `scratch/runs/20261101-gl-worker-lease-crash-sweep/`.
Each test argument followed this exact prefix, with `RUN` the absolute path
of that directory:

```sh
SWEEP_CAPTURE_PREFIX="$RUN/<stem>" timeout 120s node --require "$RUN/capture-module.cjs"
```

The scratch-only hook is copied unchanged from the preceding native-encoder
sweep. It captures bytes before module construction/instantiation and hashes
loaded CommonJS files at exit; it does not replace source, compiler behavior,
fixture assertions or results. Workers inherit the preload. Full argument
arrays, HEADs, timings and logs are retained in `outcomes.json` and the logs.

| Test argument, in order | Exit | Seconds | Result |
| --- | ---: | ---: | --- |
| `test/test-opengl-wat-worker.js` | 0 | 3.588 | Real-worker single-buffer and triple-pool cases both PASS |
| `test/test-gl-shared-render-worker.js` | 0 | 0.068 | Entire shared-render protocol fixture PASS |

## Real native worker/RPC execution

The first fixture creates two actual Node workers sequentially, each with a
real fixed 512 MiB shared Wasm memory and the full native module. It invokes
`gl_wat_encoder_call` in each worker through production
`GuestRPC.createWorkerImports`. Assertions reject runtime JS-encoder selector
exports. Process/thread bootstrap RPC identity is checked before GL work.

The main thread receives native shared-range descriptors rather than a
structured-cloned command buffer, observes `STATUS_REQ`, and deliberately
delays each GL broker service by 25 ms. The worker's query and finish calls
must each remain blocked for at least 15 ms. Production
`createMainBroker().serveGlBatch` consumes the request; query output is
written before response/wake, and the worker immediately observes value 4
plus return `0x2468`. Finish returns `0x1357`; the RPC slot finishes IDLE.

The semantic JS consumer validates packed triangle mode, 3×19 vertex floats,
first position/color, and exact batch opcode order. Single-buffer mode has
two synchronous GL submissions; pooled mode has four. Import statistics
require respectively two/four sync and local crossings after bootstrap.
The released first range is demonstrably overwritten while its saved
snapshot stays distinct. Triple-pool metadata must describe three distinct
in-bounds 2 MiB slots, rotate in order, remain stable, and preserve the first
two snapshots while the third is encoded before wrapping to slot zero.

This is real native producer execution, worker scheduling, shared memory and
blocking RPC. The consumer is a deterministic semantic callback, not an
OpenGL backend or `GLRenderHost.Bridge`. It does not stress asynchronous
bridge admission while the native worker rotates its pool. The fixture
terminates its own Node workers in `finally`; these are not managed boxes.

## Bridge leases, ordering and backpressure through doubles

The second fixture executes production `Bridge`, `SubmissionQueue`,
`SharedPacketPool`, command replay and broker code with manually resolved
endpoint promises. It never constructs a real worker. Meaningful assertions
include:

- Safe void commands acknowledge early only after canonical GPU ownership
  is marked. Copied scalar and packed-vertex bytes survive producer overwrite.
  Two admitted batches bound the queue; a third producer waits, and a later
  query from another owner cannot overtake it. Query memory remains leased
  until completion and returns the actual result.
- Shared triple-pool transport sends offsets without command-buffer copies.
  Third publication waits for oldest consumption before rotation; first and
  third pending payloads survive the relevant writes. Four batches report
  exactly four leases, zero copies and zero copied bytes. Overlapping pool
  slots reject; `sharedPackets:false` uses the copy comparison path.
- Presentation drain and `glFinish` wait for replay. Borrowed pointers,
  unknown operations and software backend keep synchronous leases. Eight
  copied vector cases survive overwrite with a present at the tail; twelve
  malformed vector cases retain synchronous transport and actual result 37.
  Three supported small texture shapes, including the 65,536-byte threshold,
  own copied bytes; ten large/padded/unsupported/malformed upload cases retain
  leases and actual results.
- GDI synchronization runs readback before later producer admission, with
  ownership flag order `[1,0,1]`. Cross-owner context deletion invalidates
  early-ACK eligibility. Async queue rejection propagates through drain,
  subsequent barriers and close without further submission. Close waits for
  pending replay, terminates the endpoint and rejects reopening/late frames.
- Admission snapshots capture nested window rectangles and authoritative
  client sizes. Replaced HWND frames close their bitmaps, cannot attach to
  reused windows, and retire frame-owner references. Query writes, software
  producer configuration and surface copy-back precede lease completion.
  A live endpoint remains selected after its enable predicate changes.
- The broker leaves a promise-backed GL request in REQ, rejects duplicate
  GL/RPC service, and publishes result/output before RESP. This broker case
  uses direct shared-memory setup, without a waiting native worker.

VM execution of production `gl-render-worker.js` uses `FakeGL` to check owned
command-buffer selection, captured geometry overrides/live-export fallback,
and bitmap write-then-read coherence. D3DIM checks use deferred proxy ports,
`FakeGPU` cleanup and an actual JS `D3DIMGpu` wrapper with a deliberately
unavailable canvas and stub native exports. They check ready/fence results,
`stop()`, diagnosed fallback, state override cleanup, no per-triangle context
retry, and fatal propagation of an injected shader error. Those deliberately
rejected promises, overlap rejection and caught JS errors are successful
negative assertions, not unexpected native crashes or Wasm traps.

## Limits and handoff

No source, test, helper, compiler, census, TODOS/STATUS or foreign WIP edits
were made. No accepted fixture reruns, REP tests/diagnostics, held work,
Heroes II, browser, GPU, heavy benchmark, boat, download, access retry,
agent/successor or deployment was used. No crash reproduction was needed.

Remaining gaps: native producer connected to an actual render worker under
consumer load, browser/GPU execution, broader concurrent scheduling, failed
shared-packet lease quarantine/retirement, and application gameplay. These
fixtures do not establish full-27 coverage or overall crash freedom.

`environment.json`, before/after input inventories, `verification.json`,
`loaded-verification.json`, exact original sources, modules and logs retain
reproduction identities. Post-test free disk: 2,427,588,608 bytes, above 2 GB.
Box ID/state/expiry and lifecycle: N/A; no managed box or ownership to hand
back. Next: coordinator reviews this single completion; this worker stops.
