# D3D software-worker isolation and refused-draw sweep — 2026-11-01

All three original standalone synthetic fixtures passed sequentially. No
unexpected native crash, unhandled Wasm trap, assertion failure, signal or
timeout occurred. This establishes the specific software-worker properties
below; it does not establish gameplay, full-27 coverage or general crash freedom.

Evidence run: `scratch/runs/20261101-d3d-worker-failure-crash-sweep/` (ignored).
No production source, test assertions, shared helpers or compiler files changed.

## Source and executable identity

Requested baseline: `5e46345eabbdfc5e88d03b13f9058715fd4efc85`.
Tested HEAD: `896edb18e9eff1586fd5b2320a322335ba9ba8c1`; its only committed
changes from baseline were `TODOS.md` and `ops/STATUS.md`. All 4,462 recorded
inputs matched the accepted build's `inputs-after.json` before execution and
remained identical afterwards. Tracked input bytes matched baseline. The 67
distinct loaded repository/installed modules were hashed at process exit and
checked against current bytes; all 45 tracked loaded modules matched baseline.
The other 22 are installed dependencies, recorded by exact hash in evidence.

| File | SHA-256 |
| --- | --- |
| `test/test-d3d9-software-worker.js` | `3c7c121647983a6e16448bbaec145347e3fe1729b56cee7a52d054b6e4a0efb7` |
| `test/test-d3d9-worker-survives-draw-failure.js` | `4af416d14a29ccdbff439d62fb8578250220f99c5769b0dca8586c25264e8227` |
| `test/test-d3d9-worker-alive-after-refused-draw.js` | `1e342c6fe39d11179803841e3de6064f67d6cead323fb55a526a2dc06479e19a` |
| `lib/d3d-render-worker.js` | `f3d77c20eb14a8f72233216af03d2a50e60862b2fd10202e4970878050124b52` |
| `lib/d3d-command-stream.js` | `ea1080750e8557f261d2b62f646b2cbc317be1b639cdc566b022c9a6ad494945` |
| `lib/d3d9-software-backend.js` | `d73d855a6936881712c7b75e203cfc717c43dd82ca38fe67a576f4fc37da93ee` |

Both native fixtures compiled the canonical source closure. The two captured
modules are each 2,024,992 bytes, SHA-256
`ac9beb2ae3f746c621d0f258d4d3a2d1910207b0006e13ed96856bd0ac4975d9`.
Each has all nine non-custom sections byte-identical to the accepted primary
build, including code and data. The primary is 2,025,029 bytes, SHA-256
`2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`;
the difference is its 37-byte custom stamp. Workers instantiate the compiled
module passed by their parent over shared memory. The receiver-only fixture
does not compile or execute Wasm.

Reused accepted `flock /tmp/wine-build.lock bash tools/build.sh` PASS evidence
from `scratch/runs/20261101-d3d-typed-stateblock-injection/build.log` and
`outcomes.json` (46.479 s). Inputs and primary bytes are unchanged; neither that
build nor previously accepted tests were rerun. Runtime: Linux x86-64,
Node 24.18.1, V8 13.6.233.17-node.50; no WINE/NODE environment overrides.

## Commands and results

For each row, in this exact order, the command was
`timeout 120s node --require /home/user/wine-assembly/scratch/runs/20261101-d3d-worker-failure-crash-sweep/capture.cjs test/FILE`.
The evidence-only preload records Wasm bytes and loaded module hashes; it
delegates compilation/instantiation unchanged and does not alter assertions,
executors, source transforms or responses. `SWEEP_CAPTURE_PREFIX` selected
the corresponding evidence filename. Exact argument vectors are in
`outcomes.json`; `run.py` reproduces the sequence and stops on unexpected
native trap, signal or timeout.

| FILE | Exit | Elapsed | Result |
| --- | --- | --- | --- |
| `test-d3d9-software-worker.js` | 0 | 4.247 s | PASS |
| `test-d3d9-worker-survives-draw-failure.js` | 0 | 0.040 s | PASS |
| `test-d3d9-worker-alive-after-refused-draw.js` | 0 | 3.917 s | PASS |

## What the passing assertions cover

The software-worker fixture uses three actual `worker_threads` instances and
production WAT software rasterization. It checks direct-versus-worker full
pixel equality and a known BGRA pixel, immutable input snapshots/readbacks,
consumed-versus-completed ordering, parent allocation sentinels and x86
EIP/ESP preservation. Native query counts cover overlapping/restarted/released
queries, wireframe, point fill, point-list clipping/size/batch boundaries, user
clip planes and stencil rejection. Reset retires query brackets, changes
target dimensions and preserves independent A/B depth contents. Graceful
cancellation retires command leases only after exit, reports zero remaining
native device allocation and proves parent reuse of handed-off heap storage.
Intentional forced termination releases the transport lease only after exit
and reports `ORPHANED`; it does **not** prove killed-worker heap reclamation.

The receiver-only fixture schedules JavaScript executor throws. It checks
healthy ordering, per-command consumed/failed replies after a refused draw,
suppression of subsequent execution on that failed stream, independence of a
second device, recovery on a higher generation, and continued rejection of
bad protocol versions or unordered descriptors. This is mocked receiver
failure coverage, not evidence of a live thread or native pixels.

The final fixture starts one actual render worker with two software devices.
A clip-space vertex with positive `w = 1e-39` causes native projection/raster
execution to refuse the draw. A subsequent draw on that device receives
`earlier render command failed`; after 250 ms the worker thread remains alive.
The second device then completes a valid native draw with a clean queue, and
the worker is still alive. This fixture does not read back pixels or exercise
real-worker generation recovery; receiver recovery is covered only by the
preceding fixture. It loads `test/binaries/calc.exe` solely to establish an
image base and executes no guest instructions. Final termination is the
fixture's intentional cleanup, not an unexpected crash.

There is no real GPU or browser coverage here. BlackWhite2, held guests,
replays/diagnostics, REP work, HeroesII and heavy benchmarks were not run.
No boxes, downloads, access retries, agents, successors or deployment were
used. Box ID/state/expiry and lifecycle: N/A; ownership: none. Free disk
remained above 2 GB. Next step is coordinator review of these bounded findings;
this single assignment is complete.
