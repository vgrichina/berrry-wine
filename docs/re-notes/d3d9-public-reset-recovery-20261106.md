# Public x86 COM D3D9 Reset in the production browser Worker

Result: PASS on both shipped modules, using one production Chrome session on
2026-11-06 02:31:47–02:32:04 UTC. The public guest/browser gap left by
Reset0032 is covered. No production mismatch was demonstrated and no production
code changed.

The released Reset0032 fixture built an ordinary PE image but returned its raw
machine-code buffer. The successor returns `bytes:b` and retains `codeBytes`.
Static ABI review also corrected GetBackBuffer from device vtable slot13
(CreateAdditionalSwapChain) to slot18, retaining all four public arguments.

The regression follows the production MultiplyTransform browser harness:
an ordinary generated PE runs in the owning x86 CPU Worker, calls public COM
vtables, and reads actual render targets using public GetBackBuffer/GetDesc/
LockRect. The renderer is the production shared WebGL Worker. Every COM call
checks stdcall stack restoration and EBX/ESI/EDI/EBP preservation.

Public behavior verified on both shipped modules: two independent devices;
8×8 render; successful Reset to12×10 plus presentation in/out and viewport
checks; fresh asymmetric redraw; peer pixels; ordinary executor refusal of a
singular lit normal transform; failed Reset returning DEVICELOST followed by
TestCooperativeLevel; exact queue error and lifetime preservation; supported
Release/CreateDevice recreation; recovered pixels and an isolated stale
protocol descriptor control; a different peer pattern after the control.

The scalar oracle uses literal asymmetric colors, D3D9 integer pixel centers,
and triangle half-plane classification. It checks every pixel farther than
.8px from all edges, with covered and uncovered witnesses. Clear-only,
reversed-triangle, changed-size and changed-color controls prevent agreement
with omitted drawing or a stale image. No expected pixel is derived from
another production renderer. Retained PNGs depict actual public LockRect
readbacks and are generated emulator regression previews, not gameplay.

The malformed descriptor is a separate transport control after successful
recreation and a valid production FENCE. If public creation reuses the device
identity, the descriptor retains the old generation with the next valid current
sequence; an ordering-only failure cannot satisfy this control. If the public
identity changes, report rejection of the old device identity separately and
do not claim generation rollover. No producer error or receiver stream is
cleared or changed. Retirement uses public Release and production teardown.
Both observed creations changed public identity from 136450064 to 136450112;
the actual owning receiver rejected the old identity with
`missing/stale D3D9 worker device`. This run proves old-identity rejection,
not generation rollover. The test conditionally checks rollover when creation
actually reuses the identity. The peer redraw after this refusal passed, and
the same physical render Worker survived every control in each module case.

Primary references consulted:

- [Microsoft Reset contract](https://learn.microsoft.com/en-us/windows/win32/api/d3d9/nf-d3d9-idirect3ddevice9-reset)
- [Microsoft surface access and lockable backbuffers](https://learn.microsoft.com/en-us/windows/win32/direct3d9/accessing-surface-memory-directly)
- [Wine public D3D9 interface declaration](https://raw.githubusercontent.com/wine-mirror/wine/master/include/d3d9.h)

Reset is an in/out transaction, loses bindings/state, requires released default
resources, and failure permits only Reset/TestCooperativeLevel/Release on the
failed device. The test follows these constraints; the singular draw refusal
is an emulator strict capability contract, not a native Windows comparison.

The PE/ABI preflight ran before Chrome: a 131584-byte PE32 with 33380 code bytes,
three import descriptors, bounded sections/entrypoint/data, and 131 COM calls
checked against the public slot/argument specification and production API
table. It rejects both the predecessor's raw-code return and slot13 error.
During actual execution every COM call also checked ESP and EBX/ESI/EDI/EBP.
Each module passed 258 independent safe-pixel comparisons across seven frames
(516 comparisons and 14 readbacks total), plus full-frame peer equality.
Clear-only and reversed-triangle oracle controls reject all seven cases.

Reproduce with `node test/test-d3d9-public-reset-web.js`; set
`D3D9_RESET_EVIDENCE` to an output directory to retain JSON, HTTP response
hashes, individual readback PNGs, and the contact-sheet screenshot. The fixture
is `test/fixtures/d3d9-reset-fixture.js`. Rendering uses the production WebGL
Worker and SwiftShader in headless Chrome, with immediate command completion
configured through the supported `maxDeferredCommands:0` option.

Validation passed:

- `flock /tmp/wine-build.lock bash tools/build.sh`
- `node test/test-d3d9-public-reset-web.js` (both shipped modules)
- `node test/test-d3d9-reset-presentation.js`
- `node test/test-d3d9-worker-reset-recovery.js` (both modules, shared and legacy)
- `node test/test-d3d9-worker-survives-draw-failure.js`
- `node test/test-d3d9-shared-render-worker.js`

Evidence is in `scratch/runs/20261106-d3d9-public-reset-recovery/`.
`tested-source.json` pins baseline Git commit
`0f474b7ada6d2ab4d444936a2ca7b26a7b2c4c5c`, relevant file hashes and binary
diff/new-file patches. Standard module SHA-256 is
`881a4ffc816bb2a752febff01551ade99dfc5680dc8a3a6a4222f0bb8d2c1951`;
compat is `721dea351a4ac638cc275b9fa30101be050b0836eb6d44de0230e9edb38e2079`.
Browser module hashes matched the shipped files. The only intervening committed
change before final review was `TODOS.md`; relevant source hashes were unchanged.

`browser/result.json` retains checkpoints, exact refusal diagnostic, pixels,
and successful supported retirement. There was no failing execution attempt;
the two deliberately broken fixture controls were rejected before Chrome.
`capture-review.json` records personal inspection of all 14 readbacks in
`browser/public-reset-readbacks.png`: orange initial triangle, resized magenta
triangle, stable blue peers, recovered purple triangle, and final green peer.
These are generated emulator regression images.

The ordered predecessor releases were independently verified before any
shared edits/tests/build/runtime: 1036 absent PIDs, 43 refused ports, 26 absent
profiles and four free locks. `gate.json` fixes the local runtime window at
02:30:43–03:15:43 UTC. All execution finished by 02:32:52.
`owned-runtime-cleanup.json` verifies own process/profile absence, refused
ports, free locks, no heavy runtime, and the disk floor. No boxes, original
game, media/source archives, deployment, private queue clearing or arbitrary
physical Worker death were used by the new browser regression.
