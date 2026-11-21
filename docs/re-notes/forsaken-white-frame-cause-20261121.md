# Forsaken white interval: independent sampler state repair

Run: `scratch/runs/20261121-forsaken-white-frame-cause/` (ignored evidence).

The retained combat evidence does not establish a rendering cause. The
missing-triangle allegation is resolved: 180 packet vertices describe 60
triangles; the observer truncated its serialization. The accepted November 12
complete 28-triangle unsaturated-texture analysis remains accepted. Neither
observation supplies all vertices, textures, state, destination contents and
source identity for the retained white interval. No raster, texture, blend or
clear attribution follows from those incomplete inputs. The Quit13 Windows
caller question remains parked; no Wine reference was used.

## Concrete adjacent contract defect

`lib/d3d-renderer.js` is retired. The current GPU-stream WebGL executor is
`lib/gpu-stream-webgl.js`, loaded through the production render Worker paths
`lib/d3d-render-worker.js` and `lib/gpu-stream-render-worker.js`. Guest stream
encoding includes `src/09a8gs-gpu-stream.wat` and `src/09abg-d3dim-gps.wat`.

Binding one 2D image to two shader slots with different sampler states let the
last slot overwrite the image's WebGL texture parameters. A fully authored
production render-Worker draw sampling cyan through clamp and red through wrap
should multiply to black. The old executor produced red, or cyan after reversing
the slots. Point multiplied by linear sampling should produce dark red
`[128,0,0]`; the old executor produced gray `[64,64,64]`. Mirror/wrap also failed.
The software executor passed these same inputs.

The repair uses the existing shader filtering path for aliased 2D images and
render targets. Each slot applies its own integer-tap addressing and filtering;
the shared GL image uses identical clamp/nearest parameters. Mixed mip/no-mip
slots explicitly fetch level zero for the no-mip slot, including images with one
real level and allocated zero tail levels. Non-mipped aliases do not require
explicit-LOD extensions. Cube sampling is unchanged. No image clones, cache
resources, guest input changes or observer instrumentation were introduced.

## Validation and limits

The old and repaired actual production render Workers used the same retained
module (`integrated.wasm`, SHA-256
`10d037a7f8dcbcb92f79bdc3f51fffaa3c9a6689aa354bfcf3bfd09f00b098b7`).
`integrated-old-owner-results.json` records four expected WebGL pixel failures;
`published-owner-results.json` passes 58 WebGL and 45 software checks. Source
and module HTTP identities are retained. Complete authored vertices, two-slot
textures, sampler/raster state, destination, depth and expected pixels are in
`owner-case.cjs`. Controls cover ordinary identical samplers, both binding
orders, depth rejection in both draw orders, presentation/readback identity,
readback canaries, ring retirement, upload visibility, release/recreate/rebind
and rejection of a stale binding without writing the trailing readback/frame.

The shared browser scenario passes 128/128 checks on both WebGL1 and WebGL2
with SwiftShader, including distinct-image sampling, mip selection, mixed
filters, border taps, aliased render-target orientation, blending and depth.
The software suite passes D1 60/60 and 9.4a 69/69. The literal locked build is
required before publication; its final receipt is
`publish-build-retry-outer-close.json` (PASS). An earlier publication build
launcher terminated during compilation; its native receipts and incomplete
launcher joins are retained separately. Native OpenGL tests were skipped
because optional native bindings are absent; they are not claimed as passing.

Selected personally inspected authored captures are
`integrated-old-owner-webgl-{clamp-wrap,point-linear}.png` and
`published-owner-webgl-{clamp-wrap,point-linear}.png`. These are small control
tiles, not gameplay evidence.

One immutable Forsaken attempt was made after the integrated repair, focused
tests and locked build passed. Exact module/media HTTP validation passed, but
the admission gate had proved only the guest Worker. Complete Worker proof
failed before input. The scope closed UNKNOWN with zero actions, no later
endpoint/input requests and no replay. Useful movement/fire, trusted UP/guard
ACK and enemy readability were therefore not observed. A subsequent portability
refinement to avoid unnecessary LOD extensions was tested only with authored
controls and the final locked build. This task proves the generic sampler
repair; it does not prove that repair causes the retained Forsaken white interval
or improves combat, enemy damage or defeat. No test box was created.
