# Quake III torch on repaired presentation — 2026-11-07

One unchanged original reached Q3DM1 on the presentation repair from
`36a212cac`. The retained skull-torch scene was closely matched before firing:
skull facing the camera, ornate arch left, pillar behind the pole, brick wall
right. No black quadrilateral cluster is visible in that capture. This is a
scene match, not an identical camera, game history, or proof of the historical
artifact's cause. No new emulator mismatch was demonstrated and no source fix
was made. Foreign composition-test edits were preserved.

Evidence: `scratch/runs/20261107-q3-repaired-torch-world/` (ignored).
`historical-torch.png` retains the prior capture with its provenance in
`historical-reference.json`. The useful new captures are
`retrieved/original/retained-view-clean.png` and its matching `-frame.json`,
and the separate inner-room firing capture `inner-torch-fire.png` with its
matching `-frame.json`. All screenshots use `--png-canvas`, the actual
compositor route, and were taken while paused after balanced controls.

## Observations and limits

The first world spawn and ordinary movement reached the side hall and both
sides of the central ornate arch. The retained close scene was reached without
firing at that wall. Its flame candidates are ordered draws 1170–1175, sequences
200675–200680, using textures 1099–1101, complete RGB 64×128 images with opaque
alpha, additive ONE/ONE blending, and alpha test disabled. Their projected
geometry overlaps the flame pixels; the full vertices, matrices, texture mip
metadata, blend/depth state and shader identifiers remain in the frame capture.
`retained-torch-flame-candidates.json` and `retained-view-clean-projected.json`
preserve this correlation. Generated shader files themselves were not retrieved;
the runtime source and shader identifiers are pinned.

The player had already taken bot damage. During the subsequent weapon-switch
and firing controls, Major killed the player. `torch-fire.png` is explicitly a
death/scoreboard view, not a torch decal comparison. Mouse release was delivered.
The same original was respawned normally; no second original was launched.

In the inner room, four machinegun rounds were consumed beside another skull
torch. This is distinct evidence from the retained camera. Frame 927 contains
16 decal draws, indices 63–78, sequences 256570–256585. Their texture 1292 is
complete RGB; blending is ZERO/ONE_MINUS_SRC_COLOR, alpha test disabled, depth
LEQUAL with writes disabled, polygon offset enabled. Texture mip metadata and
ordered state are retained in the frame. Projection places the actual triangles
of draws 65 and 68 over compositor pixel (320,224), which is `[17,8,3,255]`.
`inner-decal-owning-pixel.json` records the triangle coverage and state;
`inner-torch-compositor-pixels.json` records seven actual compositor samples.

A bounded passive native probe during that firing sequence recorded 80 decal
draw observations with seven before/after pixels each, plus actual shader
uniforms. For example, the center pixel changes from `[67,30,11,255]` to
`[13,6,2,0]`: darkened RGB and zero destination alpha are expected for this
blend. Another observed decal pixel is `[17,8,3,0]`, while the final opaque
compositor sample is `[17,8,3,255]`. The native probe events are not assigned
the final frame ID, so this is a fixed-camera sequence correlation, not a claim
that a particular native event is the final presented draw. The center
compositor pixel includes the crosshair and is not used as a decal-only oracle.
These original-game observations support the repaired presentation behavior;
they do not replace the predecessor's independent rejecting regression.

## Runtime recovery and validation

Runtime source was pinned at main
`1ef8e1183e4f132e0f621c417cc3f2f81811c034`, including the presentation repair.
`runtime-pins.json`, `relevant-source.patch`, and
`new-lib_wininit-boot.js.patch` provide the Git recovery recipe and relevant
uncommitted input. No source or media archive was made. Existing media paths
and SHA-256 values are recorded; no guest binary, config, asset or GL state was
edited or forced. The passive observer and later bounded read-only pixel probe
are retained separately.

`loaded-modules.jsonl` verifies the actual standard module:
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
The module is retained as `tested-standard.wasm`. Loaded repaired JS hashes are
`b007377dd11a736b3eeb36f8191597b9657323900fe4698f0c489779b8a6380b` for
`lib/gl-compat.js` and
`d6f7d834de30711d61f4782b73fda4d13cfe1a8581b81a42d80a3246c33bdc24` for
`lib/headless-gl.js`. Effective npm files, native pins, loaded shared-library
hashes and original arguments are retained. The route was Node 24.22.1,
threads, real ticks, native GLFW/WebGL 1 on llvmpipe LLVM 20.1.2.

The initial native smoke skipped because optional native bindings were absent;
that was not counted as a pass. The predecessor's native rebuild recipe then
completed and explicit `PASS test-headless-gl` was required before the original.
Postflight verified all 753 effective runtime/media inputs and 161 native files
unchanged. No unchanged predecessor presentation regression was repeated.
There is no code change requiring a new locked full build.

The sole fresh UUID-idempotent box was `bx_mfyt8ear`, initially expiring
2026-11-07T06:13:49.685Z. The original exited normally with return 0 at
05:56:47Z. Its process, control port 18123 and owned browser profiles were absent
before shutdown. Evidence was retrieved first; the task's explicit delegation
then authorized normal stop. Terminal state was **archived**, stop completed
2026-11-07T05:57:56.475Z, `forced:false`, with no active expiry. No resume or
access-error retry occurred.

Next boundary: reproduce firing at the retained torch camera while still alive
and retain synchronized native event/frame IDs if a suspect shape appears.
The historical three black quads still lack owning state. This run establishes
a repaired original-game decal presentation and a close clean torch scene,
not real-Windows parity or the exact historical artifact's cause.
