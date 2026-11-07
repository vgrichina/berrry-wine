# Quake III original browser launch and torch followthrough — 2026-11-07

The first reproduced browser crash was stale emulator asset-size metadata,
not a torch shader defect. The registered first-launch controls file is 567
bytes, while `lib/app-file-sizes.generated.js` stamped 488 bytes onto it.
The production loader correctly rejected that mismatch, aborting the unchanged
registered `quake3_demo` browser launch before gameplay.

Repair `e0194cce7` updates only that generated size record. The actual config,
original EXE, PK3 and media remain unchanged. The new production-host/VirtualFS
regression loads the actual registered controls and compares mounted bytes;
it fails against the old metadata and passes after repair. It also explicitly
rejects the stale 488-byte declaration without mounting it. The focused eager
integrity and stamped-registry tests, input clock/release controls and required
locked build passed. Standard module SHA-256 remains
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.

Evidence is in `scratch/runs/20261107-q3-browser-torch/` (ignored). Git at
`ff012b5b4dccfc371ddb1137b36d2a8aef62dfa0`, `relevant-source.patch`,
`new-lib_wininit-boot.js.patch` and `repair.patch` recover the tested runtime;
`runtime-pins-before-repair.json` and `runtime-pins.json` pin individual inputs.
No source or media archive was made. Media is referenced by existing paths
and SHA-256, not duplicated into evidence.

The fresh UUID-idempotent box is `bx_uxq2jhhy`, initially expiring at
07:24:26.511Z. Initial preflight ran before the PK3 upload finished and rejected
its absence before a guest launched. Complete transfer then passed all 909
input pins. The first browser collector attempt rejected an unclassified
local-static VLAN-discovery 404; its error is preserved. After its browser,
processes, ports and profile were verified terminal, the exact optional
endpoint was classified. That is a harness correction, not an emulator fix.
The subsequent original launch demonstrated the size mismatch above.

The cheap browser controls passed 323 drawable/WGL/shader checks for each of
WebGL 1 and 2, 13 endpoint checks and 26 actual browser-worker checks. Those
controls reported an Intel/Mesa provider, but their context is separate from
the original and is not used to identify the original's owning backend.

## Followthrough

**Software:** the original main menu and Q3DM1 level selection were inspected.
A normal local single-player launch reached the textured world, bot death
(`Fragged by Major`) and ordinary mouse-button respawn. `respawn.png` shows
100 rounds and health 124. Paired W/mouse inputs led to the inner ornate-arch
hall; `world-paused.png` shows 96 rounds and health 21. This establishes
world progress, not a complete intervening damage trajectory.

`world-paused.png` and `torch-camera-paused.png` show a small camera turn
beside the same clean skull torch. Paired firing from the second camera,
`torch-fire-paused.png`, consumes two rounds (96 to 94), with the same health
21 and corresponding weapon pose. The flame remains readable. These are
personally inspected original compositor captures, not a synthesized scene
or an identical-camera comparison with native history. The large dark ceiling
shape is not classified as a defect.

The owning render Worker retains an actual `OpenGLHostBridge`, GL endpoint 1
with backend software, a context marked `software:true`, and no WebGL context
or provider for that GL backend. Its replay/software-front counters advance.
The process also has a legacy endpoint requested as WebGL; that label is not
used to claim accelerated GL. CPU and render Worker instantiated-bytecode
hashes match the standard module above. The per-capture owner snapshots retain
both endpoints and fallback counters. Final physical/async keys and the known
host input queue are recorded in `software/release-state.json`.

An auxiliary Puppeteer connection initially changed the viewport to 800×600
while the primary driver retained 1024×768 capture settings. The transient teal
captures are retained but not classified as renderer defects. Auxiliary
connections were corrected to preserve the viewport, then the original
1024×768 viewport was restored. The final torch pairs report 1024×768. Host
freeze/resume controls pause after balanced game inputs for inspection; they do
not modify guest memory, config, scene or graphics state.

The software browser exited 0 at 07:02:52.569Z. All tracked owned processes,
HTTP/CDP ports and profile were verified absent before the WebGL launch at
07:03:01Z. The routes are serial on the same sole fresh box.

**WebGL boundary:** the original reached its main menu and level-selection
menu only. The render Worker owns `OpenGLHostBridge` with actual
`WebGLBackend` version 1, `FixedFunctionGL`, context HWND 65543 and GL endpoint
1 configured as WebGL. The actual context reports WebGL 1.0 Chromium and
`ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)`.
At `final-menu-paused.json` the GL counters are 416,992 batches, zero software
batches and context write sequence 1504; endpoint fallback is null, failure
null and completed software draws zero. CPU and render bytecodes match the
same standard module. This verifies the owner at the menu, without claiming
WebGL gameplay, torch parity or physical GPU parity.

The auxiliary CDP navigation timed out at 8 seconds on the fourth Tab keydown
while focusing the level-menu controls. The earlier three Tab pairs completed;
the fourth keydown eventually arrived after the driver timeout. An already
queued ordinary Enter pair then ran. Its `difficulty-menu.png` filename is
misleading: inspection shows level selection, with Q3TOURNEY2 highlighted.
After recognizing this driver boundary, only recovery Tab keyup, inspection
and normal quit followed. No held-risk keydown was retried. Final key 9 and
13 physical/async states are false, input queue zero and driver-held set empty.
The final frozen capture is still level selection, not gameplay. WebGL world
and torch behavior remain **unproved**. A follow-up needs navigation with
release in a finally block and explicit command-success gating before Enter.
No renderer defect is inferred from this driver timeout.

## Recovery and closeout

Both repaired-route browsers exited zero normally. WebGL terminated at
07:06:06.863Z; its tracked processes, HTTP/CDP ports and profile were verified
absent. `postflight.json` verifies all 909 runtime/media input hashes unchanged
from the repaired pinned set, and retains cleanup for all four serial attempts.
Terminal evidence retrieval verified 152 files (14,419,383 bytes) across the
three software attempts and 41 files (3,032,211 bytes) for WebGL. Unique logs,
captures, owner snapshots and the tested standard WASM were recovered with
exact byte/hash checks. Existing media paths and hashes remain the recovery
recipe; no source/media bundle was created.

Normal shutdown was explicitly delegated by this task. Box `bx_uxq2jhhy`
reached `archived`, stop completed without force at 07:07:58.600Z, stopped at
07:07:58.581Z, with active expiry cleared. All owned browser/server processes,
ports and profiles were cleared before shutdown; the local messageboard
watcher is also absent. Free space remained above the requested 2 GB floor.
The first demonstrated launch crash is repaired and published; software world
progress and clean paired torch/camera/fire views are inspected. The remaining
boundary is WebGL gameplay navigation. No full sweep, historical-cause,
audio, FPS or physical-GPU claim is made.
