# Synthetic guest D3D9 worker continuations and D3DIM parity — 2026-11-01

All three original fixtures passed sequentially with 120-second timeouts.
No unexpected native crash, unhandled Wasm trap, assertion failure, signal or
timeout occurred. Coverage includes synthetic x86 COM-to-real-render-worker
continuations and older D3DIM second-instance pixel parity. It does not establish
full-27 coverage, original-game compatibility, gameplay or general crash freedom.

Evidence: `scratch/runs/20261101-d3d-guest-worker-crash-sweep/` (ignored).
Only this findings document changed; no source, assertions, helpers or compiler
were edited, and no previously accepted tests were rerun.

## Identity and build evidence

Requested baseline: `984f3e496a95965e9ae3c8ca5e51fa3829713c83`.
Tested HEAD: `16a30b4a78dd3fcd7f422606d4add855f17eeca2`; only `TODOS.md`
and `ops/STATUS.md` advanced from baseline. All 4,462 recorded tracked inputs
matched baseline and the accepted build inventory before execution, after
execution and at final verification. The three parent-process require-cache
manifests contain 66 distinct modules: 44 tracked modules matched baseline;
22 installed dependencies matched their recorded exit hashes. Worker-thread
exit manifests were not emitted during termination; worker source identity is
covered by the input inventory, and its passed module is identified below.

| Original fixture | SHA-256 |
| --- | --- |
| `test/test-d3d9-guest-render-worker.js` | `0e4ae126bee90c629a5b8940eb4afb3859837885ab8eb4654244ffaa9a046452` |
| `test/test-d3d9-shared-render-worker.js` | `5389300507e2351e64b536cb09f93f91105686b7577f0d37ad403f0a62a007a9` |
| `test/test-d3dim-worker-parity.js` | `181c943bf460f1baa2457360bbf0218e9d8fdcfc40c33a475635ade767dd10aa` |

The evidence-only preload intercepts `WebAssembly.compile` and byte-form
`instantiate` solely to save exact bytes, delegates unchanged, and hashes loaded
module files on process exit. It does not wrap the compiler, change source
transforms, inject results or weaken assertions. The original render helper
privately compiles its sealed source graph with each fixture's original
`extraWat` appended to `13-exports.wat`. Extracted extra WAT, complete input
hashes, executable section hashes and exact commands are retained in evidence.

| Captured executable | Bytes | SHA-256 |
| --- | ---: | --- |
| Guest-render module passed to actual worker | 2,025,096 | `ba45f2aded7e88ddc8d9c4ef2a0379a96e1234d98d80b527180cb0be83c59b59` |
| D3DIM module, captured at both instantiations | 2,025,397 | `7e6c8e60bb3db80c5ab57661f09cb1fe729906dcbc4a6408c17a6c8240f74cb6` |

Both differ from the primary build in function, export and code sections
(IDs 3, 7, 10), consistent with their fixture-specific appended functions.
Their other six non-custom sections, including data, match the primary.
They are not byte-identical primary-build modules. Shared-render creates no
Wasm module. The primary remains 2,025,029 bytes, SHA-256
`2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`.

Reused accepted `flock /tmp/wine-build.lock bash tools/build.sh` PASS from
`scratch/runs/20261101-d3d-typed-stateblock-injection/build.log` and
`outcomes.json` (46.479 s), supported by the identical input inventory and
unchanged primary bytes. No redundant build was run. Runtime: Linux x86-64,
Node 24.18.1, V8 13.6.233.17-node.50; no WINE/NODE environment overrides.

## Sequential results and coverage

Each command was `timeout 120s node --require /home/user/wine-assembly/scratch/runs/20261101-d3d-guest-worker-crash-sweep/capture.cjs test/FILE`.
`SWEEP_CAPTURE_PREFIX` selected the evidence filename. `run.py` preserves the
sequence and stops on an unexpected native trap, signal or timeout.

| FILE, in execution order | Exit | Elapsed | Result |
| --- | ---: | ---: | --- |
| `test-d3d9-guest-render-worker.js` | 0 | 4.574 s | PASS |
| `test-d3d9-shared-render-worker.js` | 0 | 0.039 s | PASS |
| `test-d3dim-worker-parity.js` | 0 | 3.771 s | PASS |

The guest-render fixture starts one actual Node `worker_threads` render worker
using production `lib/d3d-render-worker.js`, `WorkerConsumer`, Bridge and native
WAT software rasterization over shared memory. It loads `calc.exe` solely to
initialize the PE image base, then writes synthetic x86 push/call/store/return
sequences targeting initialized COM thunks. No original Calc instructions or
original-game/held-guest replay are driven. The exact PE SHA-256 is
`cb71fcc9726f756421519a215c39cf89efd930c9ae0fa5bbb59b64050faef52b`.

Guest calls create an 8×8 device, set render state/FVF, draw, Present and Release.
Assertions check bounded continuation slices, yield reason 16 and pending
tokens, an unchanged return marker while parked, restored ESP and successful
HRESULTs. Mutating the submitted vertices cannot change the queued snapshot.
Canonical pixels remain unchanged until the relevant Present poll, then all
64 pixels match the expected green triangle/background. A 2,950-triangle UP
draw crosses both batch limits while remaining one queue command and one COM
submission; its alternating colors resolve to the expected red triangle.
One-frame Present pipelining hides intermediate output until the later poll.
Submission counts reject duplicate retries; at least three asynchronous waits
are required. Release submits once, worker exit is observed (`threadId == -1`),
and a positive native heap handoff is adopted only after exit. These are
synthetic workloads, including the fixture's game-sized draw, not game evidence.

The shared-render fixture uses ordinary ArrayBuffer memory, mocked render
ports, synthetic pixel arrays/bitmaps and a fake GPUDevice. It checks software
pixel copying, GPU bitmap publication without readback, replaced/closed bitmap
retirement, recursive SendMessage presentation without parking, state snapshot
ownership, independent device cancellation and identity generation reuse.
The adapter checks draw/present versus readback/finish behavior and rejects
stale generations and calls after close. No actual worker thread, Wasm raster,
browser, WebGL context or real GPU is exercised by that fixture.

D3DIM creates two distinct production-WAT instances over the same shared
memory in one Node thread. A direct 16×16 Gouraud triangle produces 242 nonzero
target bytes at 64-byte pitch. After clearing the target, the second instance's
`d3dim_worker_draw` reproduces the full target bytes, with nonblank guards.
An indexed quad is also compared against the direct indexed path. A synchronous
encoder stand-in snapshots 4,096 state bytes and expanded vertices, queues one
six-vertex draw without rasterizing on the caller, and replays on the second
instance at one fence. A second empty fence is suppressed; complete output
matches the direct indexed reference. This proves native second-instance
pointer/state resolution and those pixels, but not real-thread D3DIM transport,
concurrent execution, or an end-to-end production encoder.

No real GPU/browser, held topics, REP tests/diagnostics, HeroesII, heavy
benchmarks, boxes, downloads, access retries, agents, successors or deployment
were used. Free disk stayed above 2 GB. Box ID/state/expiry and lifecycle: N/A;
ownership: none. Next: coordinator reviews these bounded findings; this worker
stops after publishing its single assignment.
