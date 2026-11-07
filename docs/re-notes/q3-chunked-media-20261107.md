# Quake III chunked media and original WebGL world — 2026-11-07

The authentic demo PK3 transferred in 90 small chunks, assembled remotely and
passed the complete known hash before the sole original launch. The original
WebGL route reached the textured Q3DM1 world, and ordinary balanced W input
visibly moved across the courtyard toward the lit arch. Fire and the requested
same-camera torch before/after pair remain unproved: the inherited runtime
watchdog closed the browser during the final camera-turn command.

Evidence is in `scratch/runs/20261107-q3-chunked-media/` (ignored). No emulator
mismatch was demonstrated and no emulator source changed.

## Transfer and launch admission

The existing source is
`test/binaries/candidates/quake-3-arena-demo-installer/installed/demoq3/pak0.pk3`,
46,853,694 bytes, SHA-256
`e77abad2466f45a0a7ea018445528f9b95a0fe7789fa1abc1a7718bbf0754b08`.
The transfer reads it in 512 KiB buffers without creating local chunk files or
duplicate media. All 90 upload buffers are individually size/hash checked.
Remote assembly checks every chunk before exclusive target creation, checks
again while writing, fsyncs, then independently rereads the complete assembled
file and verifies the known full hash. Only after success are temporary chunks
removed. `retrieved/assembly-receipt.json` confirms all 90 chunks, exact full
size/hash and cleanup. All 913 runtime pins passed preflight and postflight.
No whole-file media PUT was attempted.

The first create request returned HTTP 502. Following the coordinator's explicit
07:21:07Z messageboard clarification, an identical request with the original
persisted UUID Idempotency-Key recovered the single box `bx_pax6nz2r`; no new key
or replacement box was used. Initial expiry was 07:52:12.964Z.

The first assembly command failed explicitly with `ModuleNotFoundError` before
media effects: five small harness inputs had an incorrectly duplicated absolute
path prefix. Those small inputs were uploaded to their correct paths and the
path construction was repaired. The corrected assembly, complete pin preflight
and actual-browser control then passed before launch. This was a run harness
correction, not an emulator fix or an UNKNOWN guest-input replay.

Five local assembly controls pass: exact reconstruction/chunk deletion, corrupt
and missing chunks rejected before target creation, incorrect full hash rejected,
and existing target preserved. The authentic source's full hash and 90 chunk
hashes are also verified locally. The release-before-await/finally and serialized
sticky gate from `19c7c0d4b` is reused. Local delayed-keydown timeout/UNKNOWN and
explicit-success transport controls pass. The actual-browser delayed Tab control
records trusted down/up, no queued Enter, no held keys and zero original launches.
No full build was needed for this docs-only change and ignored run harness work.

## Personally inspected original scenes

The registered `quake3_demo` route launched once. Initial mouse and Enter commands
received balanced host receipts without advancing the scene. Subsequent Tab
navigation visibly advanced the menu highlight. Every next ordinary command
required the preceding SUCCESS receipt and a personally inspected capture;
there was no queued gameplay sequence or auxiliary CDP gameplay controller.
A separate connection, preserving the viewport, performed only host freeze/resume
for loading after successful primary receipts. No guest memory, config, scene,
map command or state was forced.

The inspected level selection retained Q3DM1, Arena Gate. The inspected Fight
selection opened difficulty, and its ordinary Fight action progressed through
connecting and BSP loading. `world-settled.png` shows the textured courtyard,
statues, weapon and HUD, with 100 rounds and health 124. The first short W input
has too little visible displacement to establish useful movement. The longer
bounded W pair in `forward-progress.png` clearly moves the camera across the
courtyard, with 100 rounds and health 122. `torch-approach.png` then reaches the
ornate arch, with the tall golden flame visible inside, 100 rounds and health
121. These images were personally inspected. The health differences alone are
not classified as bot damage or an emulator defect.

The actual render Worker owns `OpenGLHostBridge` with `WebGLBackend` v1 and
`FixedFunctionGL`; GL endpoint 1 is WebGL, HWND 65543, and the context is not
software. Its provider is WebGL 1.0 Chromium with
`ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)`.
At the final successful approach capture it reports 184,400 batches, zero
software batches, write sequence 343, no endpoint failure/fallback, and zero
completed software draws. CPU and render Worker instantiated bytecodes both
hash to `e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
This is original owning-backend/module/provider evidence, not the toolbar label.

## Boundary and recovery

The reused browser harness has a 12-minute deadline with cleanup three minutes
before it: nine minutes of original runtime, substantially shorter than this
assignment's 35-minute allowance. It closed at 07:32:20Z while command 29 was
finishing its ArrowRight turn. The native action log records keyup and an empty
held set, but the subsequent ACK evaluation hit a detached frame and produced
`29.failed.json`. No successful `torch-before` capture exists. Its attempted
fetch failed for the absent expected files; no result was inferred from the
filename. There was no later input, replay, fire attempt or second original
launch. The watchdog/admission timing is the concrete followthrough blocker.

All 205 remote output/input artifacts in the recovery inventory (13,739,992
bytes) were verified against remote hashes, retaining unique logs and captures
and matching existing local inputs. Recovery preceded delegated normal box
shutdown. The original browser exited zero; all tracked process identities,
both original HTTP/CDP ports, its profile and locks were verified absent.
Terminal physical/async states for Tab, Enter, Escape, ArrowRight and W are
false, queue length is zero and the driver-held set is empty.

`runtime-pins.json` records the exact source commit and input hashes;
`relevant-source.patch` and `new-lib_wininit-boot.js.patch` preserve relevant
uncommitted inputs. `run-specific-inputs.patch` preserves the small run harness.
Git is the source archive; no source/media archive was made. Box terminal state,
local watcher cleanup, free-home space above 2 GB and publication are retained
in the final run records. `result.json` is written last.

The next bounded attempt should allocate its host command-admission and shutdown
reserve from the actual assignment deadline, refusing new commands early enough
to finish their ACK/capture before cleanup. Reuse the verified chunk protocol,
then complete ordinary fire and personally reviewed same-camera torch views.
No software/native route was repeated and no FPS, audio, parity or full-sweep
claim is made.
