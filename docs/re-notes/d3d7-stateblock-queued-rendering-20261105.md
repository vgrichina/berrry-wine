# D3D7 selective state-block rendering and delayed production replay

`test/test-legacy-texture-rendered-contract.js --stateblocks` now exercises
public DD7/D3D7 acquisition, two Device7 objects, texture and target creation,
sampler setters, Begin/EndStateBlock, Apply/Capture, draws and Surface7 Lock
through real x86 COM vtable calls. It draws before and during recording, after
End, after selective Apply and after two Captures. A changed texture binding
must survive because the block contains only sampler members.

The Worker arm uses the actual guest Worker, production encoder, render-worker
manager, production render Worker and WebGL executor. Three real batches
alternate A/B/A. Each batch is held before delivery while both devices' live
states change. The shared completion counter proves consumption has not
occurred; after delivery, public Lock fences and reads the rendered pixels.
Small batches are held and drained individually, respecting the production
encoder's submission policy. The last queued draw uses the recaptured block.

Independent expected RGB values use texture coordinates and separable tent
weights, without production state or shader helpers. Hand-calculated witnesses
include `[160,32,64]` for the original point/wrap sample, `[48,16,208]` for the
alternate clamped corner and `[93,163,61]` for alternate linear/wrap sampling.
All twenty generated captures were personally inspected, including eight
state-block fault captures and six unchanged sampler regression captures.

Both existing shipped modules passed, with identical counts per module:

| Arm | State-block pixel observations | Public COM calls |
| --- | ---: | ---: |
| Software | 7 | 154 |
| Direct WebGL | 7 | 154 |
| Production queued render Worker | 11 | 225 |

Call counts exclude the six duplicate release-summary records in the evidence.
Each queued positive run holds sequence 15/17/19 at completed 14/16/18, changes
live state, then observes completion 16/18/20 and its own expected pixels.
GPU arms report every draw executed with zero fallbacks and zero errors.
Direct WebGL reports WebGL2 and ANGLE/Intel UHD Graphics620/Mesa23.2.1; that
renderer string is recorded evidence, without a separate hardware claim.

All four mutation controls were rejected on both modules at their designated
pixel checkpoints, after successful bootstrap:

| Fault | Observed RGB | Required RGB |
| --- | --- | --- |
| Premature recorded-state effects, modeled by early public Apply | 64,192,32 | 160,32,64 |
| Full-state overwrite, modeled by restoring the excluded binding | 64,192,32 | 48,16,208 |
| Actual queued snapshot replaced by an earlier same-device snapshot | 160,32,64 | 93,163,61 |
| Actual queued snapshot replaced by the other device's snapshot | 160,32,64 | 93,163,61 |

The last two controls replace the actual 4096-byte production command state,
preserving the receiving command header. Donor/receiver identities are saved.
No unexpected failure or additional production defect was observed. Native
Windows block reference counts remain unknown. This fixture adds no supported
capability and establishes no gameplay, full27 or general native equivalence.

Validation also passed: `flock /tmp/wine-build.lock bash tools/build.sh`, both
module public state-block regressions (1071 logged records/1065 invocations,
10 groups), second-instance Worker parity (242 lit bytes), and the existing
sampler fixture on both modules (software 18/direct WebGL 18/queued Worker 26
pixels each, plus nearest-only and
stale-address control rejection). No arm was skipped.

Exact tested source SHA: `331c216924d16740884620b44b040755480a926c`, plus
`tested-relevant.diff` in `scratch/runs/20261105-d3d7-stateblock-queued-rendering/`.
The production sources and these existing binaries are unchanged:

- `build/wine-assembly.wasm`: `3859c274df0233659eb10fe4d2784fff7d1553242b4ae2b3bf653e5d2ebdd95b`
- `build/wine-assembly.compat.wasm`: `9f042b70d7e43d3947415e1de01e7a540b3c7f7fa6c7fbefabdbea17e9633e95`

Repeat using `LEGACY_RENDER_MODULE_DIR=build`, a suitable `CHROME`, a fresh
`LEGACY_RENDER_EVIDENCE` directory and `node
test/test-legacy-texture-rendered-contract.js --stateblocks`; repeat with
`--compat`. The fixture enforces 180-second browser and 30-second normal-cleanup
deadlines. Missing runtime arms fail and remain untested.

The run directory contains unique logs/captures/results, source SHA and binary
diffs/new-file patches, existing input path hashes, the independently checked
MDK0405/Stronghold0422 release gate and final cleanup verification. No source
snapshot, archive, module/media copy, original game, subworker or deployment
was used. All four Chrome children exited normally with code 0/signals null;
their exact process identities, ports and profiles were independently checked
absent, with both shared locks free. Box ID/state/expiry:NA, local coordinator
box; shutdown ownership remains with the coordinator.
