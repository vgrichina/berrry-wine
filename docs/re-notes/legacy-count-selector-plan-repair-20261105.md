# Legacy count-selector plan scope repair — 2026-11-05

The concrete `ReferenceError: transport is not defined` is repaired in the
isolated callback regression in `test/test-legacy-count-selector-webgl.js`.
No production renderer or shader code changed. The emitted public COM fixture,
independent oracle, two-byte tolerance, historical module pins and accepted
positive evidence identity remain unchanged.

Evidence: `scratch/runs/20261105-legacy-count-selector-plan-repair/`.
The first executable test after the required releases and independent cleanup
was the unchanged count-selector `--plan`. It exited 1 at
`capturedMatrixControls`, on `transport.batches.push` in the extracted
`port.postMessage` wrapper. Tested main was
`f8b9f49d4194505eaf3f311134e295ad4d5010dc`; the relevant test/fixture and
backend/shader files matched published
`ddc9e0e51136132e8c00725756ad91d45f6ad6ab` exactly.

## Actual faulty scope

The full ancestor `browserFixture` in
`test/test-legacy-texture-rendered-contract.js` declares `transport`,
`queueBuffers`, `queueControl` and `heldPackets`. Its real Worker callback
records batch headers before deciding whether delivery is held. The isolated
regression extracted that callback into a hand-built VM context which omitted
those locals. Non-strict init assignments could create accidental globals;
the first batch then failed on the missing `transport` binding. This was not a
renderer scope failure or a failing captured-matrix pixel control.

Git history explains the drift: `f1dc763eb3` added the queue fields and
`fbc8051625` added transport instrumentation after the isolated callback check
from `bf257f136f`. The repair executes the actual emitted declaration prefix
together with the actual emitted wrapper in a strict isolated realm.
It preserves the real fixture's transport instrumentation and Worker guards.

The regression executes init, immediate delivery, held batch plus following
message, and ordered drain. It checks captured sequence/index/command/header
metadata, shared control/buffer identity, no premature mutation, selected
endpoint buffer only, type-4 matrix only, adjacent byte guards and malformed
record rejection. In-memory omissions of each of the four bindings must fail
with the corresponding ReferenceError before delivery or matrix mutation.
The historical missing-`identity` helper mutation also rejects without changing
bytes. Parsing alone cannot satisfy these checks.

## Related projected fixture failure

The focused `test-legacy-projected-webgl.js --plan` also exposed a pre-existing
`unique fault seam ignored` assertion. Its old ignored/early fault injectors
searched for `stage.transformFlags = 0x103;`; the current adapter conditionally
leaves type-6 FLOAT3/4 inputs unprojected. The test injectors now target the
current conditional assignment. Early division changes projected type-4/type-5
coordinates while preserving type 6. Nine isolated controls execute the actual
adapter transform block, checking transformed coordinates, divisor, geometric
RHW and stage flags for baseline/ignored/early variants. No production adapter
or sampling path was changed. The original related failure log is retained.

## Validation and evidence limits

- Count-selector `--plan`: passes all 155 states, compiler/Device checks and
  the strict isolated callback positive/negative controls.
- Projected WebGL `--plan`: passes, including nine executed adapter fault
  controls. Coordinate-contract and base public-texture plans pass.
- Bounded public x86 COM software fixture: COUNT2/3/4, selector 7, scale 16,
  independent geometric W, both shipped modules, direct software and actual
  native Worker replay. Four routes, 12 successful public draws and 36
  independently recomputed pixel observations pass. Both queued routes hold
  batches before live mutation, replay production commands and report zero
  queue fallback. These are software results, not WebGL pixels.
- `flock /tmp/wine-build.lock bash tools/build.sh`: passes.

`baseline-identities.json` and `unchanged-contract-final.json` record source,
emitted-fixture and oracle hashes. No historical fixture pin was renewed.
The retained historical module prerequisites may therefore reject current
modules; this repair does not claim those historical hashes identify today's
build. The current tested modules are:

| Module | SHA-256 |
| --- | --- |
| Normal | `10462bd9693cf4f51d382d33767674b736b84e74346f328306d59e35c5e60031` |
| Compat | `eb59d32227cc18233f93c7b757e0700f9558f0a31af7e3d38090669d4fc15158` |

The [published quotient-gradient repair](d3dim-keyed-mip-formats-20261105.md)
already has 598 rendered observations across 20 routes. `reused-598.json`
records the retained result hash, counts and matching current renderer/module
identities. That matrix was reused, not rerun. The count-selector emitted
fixture SHA-256 remains
`11dbf0bb5d7f43297d45ae522148cdf1f3e096c32c9ad7a7741049bfc2217ffd`;
the independent coordinate oracle remains
`f2968810d7ec9a961861d90328c4f47a95b94a1a3d8e8170fc1d04adf3e56025`.
Plans and isolated transport checks are not pixel evidence. The revised fault
injectors have isolated execution coverage, not new rendered-fault coverage.
There is no new GL, physical-GPU, native-Windows, original-game or gameplay claim.

Ordered ReturnFire1435, Lords1450 and Strong1500 FINAL releases were observed
before shared edits or executable tests. Independent cleanup verified 187
PIDs absent, 90 ports refused, 16 profiles absent, four locks free and no heavy
runtime before reproduction. Git SHA plus relevant binary diff and the new
note patch preserve recovery; no source archive, module copy or media copy was
made. No browser, box, subworker, public deployment or platform rejection
occurred. Box ID/state/expiry are N/A; lifecycle ownership stays with the
coordinator. Own command processes and the board watcher are cleaned up before
the final runtime/file release. Next: continue the broader advertised texture
behavior audit; this plan repair requires no additional matrix run.
