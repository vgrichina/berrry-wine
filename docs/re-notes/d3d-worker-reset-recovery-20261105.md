# Native software-worker Reset and post-refusal recovery

The real-worker coverage gap is closed for the two supported software endpoint
topologies. Both shipped modules pass healthy host Reset, native draw refusal,
unaffected-device pixel readback, and supported retirement/recreation. No
production defect was reproduced; production behavior is unchanged.

Evidence: `scratch/runs/20261105-d3d-worker-reset-recovery/` (ignored).

## Production contract exercised

`test/test-d3d9-worker-reset-recovery.js` submits fixture descriptors through
the production `D3D9Host.Bridge`. Shader resource records contain IR from the
actual native shader validator. Production `d3d-render-worker.js`, command
receiver, adapters, and WAT rasterizer execute the work in actual Node worker
threads. There is no synthetic executor, source transform, guest instruction
execution, browser, or private queue-error clearing. Readback uses the bridge's
ordinary command submission method; Reset and Release use host opcodes
`0x30009` and `0x30004`.

Healthy Reset submits `RESOURCE_UPDATE {kind:'reset'}`. The test resizes an
8×8 target to 12×10, verifies newly drawn pixels, and asserts the generation
stays 1. A finite positive `w=1e-39` vertex then produces the ordinary native
`raster execution failed (-1)` refusal. An already-transported next command
receives `earlier render command failed`. A subsequent host Reset fails without
publishing a command, erasing the error, or advancing the generation.

| Topology | Failure/release/recovery result |
| --- | --- |
| Shared physical worker, per-device endpoints | Peer pixels pass before and after failed-device Release. Host recreation reuses device ID 7 at generation 2 on a new endpoint, with new native pixels; the same physical worker survives. |
| Legacy `createSoftwareWorker` / `asyncSoftware` | Peer pixels pass after refusal and **before** failed-device Release. Release intentionally retires the shared worker and marks every device lost. Same-bridge recreation remains unsupported. A new bridge creates a new physical worker and successfully renders recovery pixels in a fresh generation-1 namespace. |

Generation 2 is never forced into an executor map that still owns generation 1.
On shared endpoints, the new queue rejects a generation-1 submission locally;
a separately transported generation-1 descriptor is also rejected by the
actual owning receiver after generation-2 pixels have been read. This malformed
protocol descriptor closes that endpoint, as required by strict validation.
The peer then produces a different expected pixel pattern on the surviving
physical worker. The host discovers the closed endpoint on its next command
and releases it normally. Retired consumers reject further execution.
Legacy recovery proves rejection of the old worker lifetime; it does not claim
cross-bridge generation numbering or same-worker higher-generation recovery.

## Pixels and retirement

The oracle uses solid, asymmetric BGRA colors and opposite clip-space
triangles, with separate covered and uncovered corner witnesses. It does not
derive expected colors from another renderer. For example, the peer after
refusal has top-left `[101,67,33,255]` and bottom-right `[215,145,59,255]`;
the recovered device has top-left `[101,67,33,255]` and bottom-right
`[185,39,141,255]`. Both modules produce matching full-frame hashes for every
corresponding witness. Four topology/module runs check 24 native readbacks,
including recovery on every run.

Failed queues retire all in-flight entries and serialized bytes while keeping
their failure. Every consumer finishes with an empty pending map. Shared host
Release removes all endpoints; manager shutdown returns a native heap handoff
adopted by the parent (18 free-list blocks in each module). This attests the
supported endpoint-destruction/heap-handoff path, not an independent per-device
native allocation census. Legacy failed-worker shutdown independently reports
two devices destroyed, zero remaining device bytes, and 20 adopted free-list
blocks. The recreated legacy worker also asserts zero remaining device bytes
and a successful heap adoption at shutdown. No forced death is used in the new
fixture.

At every pixel checkpoint and after retirement, the parent retains its guest
allocation sentinels, full native target pixels, EIP, and ESP. The fixture uses
one physical worker at a time; legacy recreation starts only after its
predecessor thread has exited.

## Validation and identity

Ordered gate: AoW2 FINAL `21:50:39Z`, Aranna FINAL `22:10:42Z`, Conan FINAL
`22:51:21Z`. Independent verification at `22:53:21Z` passed 443 PID, port,
profile, and lock checks with no heavy runtime and more than 5 GB free.
The immutable runtime deadline was `23:38:21Z`.

Source commit at build/test start:
`97f1cda7429a33a7fac48f3d0c769d752da49fec`, plus the recorded owned test
patches. Coordinator documentation advanced HEAD during testing; all 18
recorded relevant file/module hashes stayed unchanged. Evidence includes
`before-test-identity.json`, `after-test-identity.json`, tracked binary diffs,
and owned new-file patches. Git and those patches are the source recovery
recipe; no source tree archive or media copy was created.

| Actual shipped module | Bytes | SHA-256 |
| --- | ---: | --- |
| `wine-assembly.wasm` | 2,175,008 | `3d59cca0579d2ccfdec1561d7403c371af771943f6c8385ce814eacb008c6821` |
| `wine-assembly.compat.wasm` | 2,177,654 | `05949f1fd23f5e911db1550e691446f306de39230f5c0014fa796687b67254c2` |

Unique tested module bytes are retained as `standard.wasm` and `compat.wasm`.
Reproduce the full new matrix after building with
`node test/test-d3d9-worker-reset-recovery.js`, or select a module and topology
with `node test/test-d3d9-worker-reset-recovery.js MODULE shared|legacy`.

All ten supervised commands in `outcomes.json` passed: the required
`flock /tmp/wine-build.lock bash tools/build.sh`, four new module/topology
cases, and the focused neighbors `test-d3d9-worker-survives-draw-failure.js`,
`test-d3d9-worker-alive-after-refused-draw.js`, `test-d3d9-software-worker.js`,
`test-d3d9-shared-render-worker.js`, and `test-shared-render-worker.js`.
The existing live-worker test now sends its adversarial follow-on descriptor
without clearing a queue error. Receiver-only comments no longer describe its
synthetic generation rollover as the production Reset path.

This is bounded native software-worker coverage. It does not establish GPU or
browser recovery, public x86 COM Reset execution, gameplay, general crash
freedom, or recovery after arbitrary forced worker termination. No boxes were
assigned or operated. Next: retain this regression for future changes to Reset,
failure retirement, generation handling, and endpoint lifetime.
