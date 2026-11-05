# Conan: first singular-normal draw retained, 2026-11-05

Task `NEW-GAME-CONAN-DEMO-20261010`. Evidence: `scratch/runs/20261105-conan-first-draw/`.
Predecessor: [player-control investigation](conan-player-control-20261105.md), commit `5d27fd1e0`.

The diagnostic repair is published as `b3ebcdbb92b2870883c4f531171145ab8cab240a`.
The sole changed original session retained the first failing draw before retirement.
Its WORLD matrix has twelve positive-zero float words followed by a translation and 1.
Normals are supplied and lighting is active. The original producer of that matrix is
still unknown; no causal rendering repair or player-control acceptance is established.
The strict singular-transform exception remains unchanged.

## Passive executor evidence

`lib/d3d9-render-worker.js` catches the exact singular-normal exception at the actual
WebGL `device.draw` executor, copies bounded state into a deeply frozen diagnostic,
and rethrows the original error. The physical worker supplies its owning endpoint ID.
`lib/d3d-command-stream.js` transports the diagnostic with the original failure and
makes a private, deeply frozen, nonwritable received copy before queue retirement.

The retained data comprises immutable command identity; world/view/projection values
and float bits; vertex declaration and normal usage; lighting, material-source, fog,
normalization and texture-generation flags; light count/types; and the executor stack.
Bounds are 16 attributes, 8 stages, 8 light types and 8192 stack characters. No vertex,
texture, successful-command history or full stream is retained. The actual original
failure diagnostic occupies 3679 bytes as compact JSON.

`test/test-d3d9-normal-diagnostic-web.js` runs the production manager/receiver and
actual WebGL executor in a physical owning Worker. Generated controls additionally
wrap the actual adapter in that Worker to inspect the pretransport error and mutate
the private failed command afterward. Twenty-four assertions prove exact identity,
freshness against preceding state and caller mutation, pretransport and received
immutability, bounded data, payload retirement, sticky strict failure, isolation of a
healthy device, and a newly created generation-2 namespace. This is not a claim that
a reset recovers the failed generation. The baseline reached the real exception and
failed for absent evidence; the changed controls pass.

## Ordered gate and sole original

AoW2callback1945 FINAL 20:34:39, AoE3wow64setup1950 FINAL 20:43:09, then
Aranna-passive-resource2005 FINAL 20:54:13 were observed in order. Independent gate
checks at 20:55:14.671993Z found 496 absent PIDs, 190 refused ports, 61 absent
profiles, four free locks, no heavy runtime and 7,323,598,848 free bytes. The execution
deadline was 21:40:14.671993Z. Before that gate only source reading and small run-owned
inputs were prepared.

The changed original ran once, 20:58:34.310Z–21:10:58.797Z, using the predecessor
app-config/browser recipe, `defaultViewport:null`, actual guestWorkers and owning
WebGL Worker. Chrome and driver both exited 0 through ordinary quit. Commands were
issued once after captures were inspected; pending commands were never replayed.
No second original, extra guest, box, subworker or public deployment occurred.

The existing 37-file install was verified in place and reused unchanged at
`scratch/game-media/conan-installed-20261105/`:

- Manifest SHA-256: `adf7c78e9ab56519edd53479b2151f04e18496668dec450ba2af12cc0b90cd38`.
- Registry SHA-256: `64969ff6f94d58b54431e18f937af3374bda5755e233ad62517840e1611d8de3`.

`source-before.json` records the exact source commit and runtime file hashes;
`runtime-relevant.binarydiff` and `runtime-untracked-source.json` record launch-tree
state. `executor-identity.json` retains actual owning-worker script hashes and the
unique observed wasm module, SHA-256
`b6c36db2aa538aa8c6e411d1cbe421d7898f791d65003b5ed54b8564495289d2`.
The loading guest Worker had already closed when final identity was read; main guest
and owning renderer identity were retained. Identity observation set no breakpoint
and made no guest writes.

## Exact first failing draw

`first-failing-draw.json`, `after-temple-state.json`, `first-draw-analysis.json` and
`console.log` retain the original evidence.

| Field | Observed value |
| --- | --- |
| First error | 2026-11-05T21:09:53.208Z |
| Endpoint / device / generation | 1 / 136450064 / 1 |
| Failed sequence / successful prefix | 62083 / 62082 |
| Submitted at snapshot / in flight | 62086 / 0 |
| Error / opcode | EXECUTION singular normal transform / DRAW 5 |
| Geometry | TRIANGLELIST 4, 12 triangles, stride 32 |
| Declaration | POSITION FLOAT3 offset 0; TEXCOORD0 FLOAT2 offset 12; NORMAL FLOAT3 offset 20 |
| Guest shaders / native fixed | no vertex shader, no pixel shader, nativeFixed false |
| Lighting | lighting 1, specular 1, two point lights |
| Other normal flags | normalizeNormals 0, localViewer 1, colorVertex 1 |
| Material sources | diffuse/ambient/specular/emissive all 0 |
| Texture generation | none; stage indices 0–5, transform flags all 0 |
| Exact determinant | world 0; view -1; projection approximately 0.10000998824715648 |

WORLD, in captured flat float order:

```
0 0 0 0
0 0 0 0
0 0 0 0
38.767112731933594 248.01272583007812 16.380149841308594 1
```

All first twelve uint32 words are exactly `0x00000000`; the last four words are
`1109070214, 1131938626, 1099106956, 1065353216`. Full view/projection bits are in
the retained diagnostic. Exact rational determinant checks used the captured float
values, not an epsilon heuristic.

The owning stack is `normalMatrix` (`lib/d3d9-fixed.js:18`) from the lighting branch
of `compile` (line 145), through `TLCache.compile`, `Device.draw`, adapter `execute`,
receiver `drain` and physical-worker `control`. This rules out the proposed unused
normal / texgen-only explanation for this draw. Ordinary repeated sticky error logs
continue until quit; they are not additional captured failing draws.

## Contract, producer review and next discriminator

Microsoft documents normals as transformed by the inverse transpose of the complete
world-view matrix, with normalization afterward if enabled:
[camera-space transformations](https://learn.microsoft.com/en-us/windows/win32/direct3d9/camera-space-transformations).
Its [lighting equations](https://learn.microsoft.com/en-us/windows/win32/direct3d9/mathematics-of-lighting)
use normals for diffuse and specular terms.
[D3DXMatrixInverse](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dxmatrixinverse)
can fail inversion. These contracts provide no basis here to substitute a matrix,
suppress the exception or discard the draw. They do not establish native rasterizer
behavior for this singular, lit input.

Source review found `d3d9_transform_index` maps VIEW 2 to slot 0, PROJECTION 3 to
slot 1 and WORLD 256 to slot 10. `d3d9_transform` copies exactly 64 bytes through the
guest mapping into the canonical slot or recorded state block. The D3D8 setter
routes through that implementation. The draw bridge copies view/projection/world
from the matching slots using `.slice()` in `lib/d3d9-host.js`. The existing generated
state-block test passes default identity, independent slots, immutable recorded
copies, last-write semantics and Capture/Apply. This supports the mapping, but it
does not reconstruct the original setter or prove the original guest computed the
zero matrix correctly. No evidence says the original called MultiplyTransform.

The next discriminator is a bounded last-writer trace on the owning guest producer
for WORLD 256: retain SetTransform versus state-block Apply/MultiplyTransform,
device and state version, caller return address/EIP and the raw 64-byte guest source;
compare the canonical slot-10 bytes and draw-bridge copy to the executor bits at the
first singular DRAW. This distinguishes guest-supplied zero scale from corruption
before or during state production. That requires a separately authorized future
original session; this task did not run a second session.

## Visual review and validation

Reviewed captures show logos, New Game, Warrior difficulty, Kordava loading, town
and story cinematics, rooftop/street/eastern-edge/temple views, and then a black
scene retaining the temple subtitle when the queue failed. One ordinary Escape
changed the cinematic view. It supplies no movement/control evidence. Both final
black captures were reviewed. No changed player position followed by a second
control response was established. FPS and audio are unknown.

Focused checks passed: the 24 owning-WebGL-Worker diagnostic controls;
`test-d3d9-fixed-plan-cache.js`, `test-d3d9-fixed-cascade.js`,
`test-d3d9-worker-survives-draw-failure.js`, `test-d3d9-shared-render-worker.js`,
`test-d3d-neutral-command-stream.js`, and `test-d3d9-stateblocks.js`.
`flock /tmp/wine-build.lock bash tools/build.sh` passed before the diagnostic commit
and original launch. No rendering semantics changed afterward. The early cleanup
probe during that build correctly reported the build lock occupied; a subsequent
independent cleanup passed after the build and again after the original session.

Final independent cleanup, source comparison, media-pin verification, artifact
hashes and recovery instructions live in the run directory. Owned process/port/
profile cleanup is checked independently of ordinary browser shutdown. No assigned
boxes exist (ID/state/expiry: not applicable). Git is the source archive: evidence
contains exact commits, relevant binarydiffs and owned new-file patches, unique
logs/captures/module, and no source archive or copied game media.

Conan has no entry in `test/candidate-corpus/manifest.json`; per the capture workflow,
evidence remains attached to this investigation rather than an unrelated dashboard
candidate. `node ops/check-run-evidence.js` exits 0 with zero containment errors;
its historical missing/invalid records are retained separately from this run.
