# Quake III original WebGL firing and same-camera torch — 2026-11-07

The original demo reaches Q3DM1 through its ordinary menus, fires, moves across
the courtyard and supplies the requested same-camera torch before/after firing
pair. Both full screenshots retain the weapon, ammo, health, crosshair and owning
renderer evidence. No emulator defect was demonstrated and no emulator source
changed. Evidence is in `scratch/runs/20261107-q3-fire-torch/` (ignored).

## Reviewed gameplay

`retrieved/webgl/world-settled.png` shows the readable textured courtyard with
100 rounds and health 123. The first balanced MouseLeft hold produces
`first-fire.png`: 94 rounds, health 121, unchanged courtyard camera. The next
forward capture shows 92 rounds; the first fire capture therefore does not
represent the final settled ammunition count of that burst.

Two bounded W holds visibly advance toward the lit arch. At the torch, the
reviewed pair is:

| Capture | Ammo | Health | Scene |
| --- | ---: | ---: | --- |
| `retrieved/webgl/torch-before.png` | 92 | 117 | Wall-mounted torch and flame, arch, weapon and crosshair |
| `retrieved/webgl/torch-after-fire.png` | 82 | 115 | Same camera, flame still visible, bullet impact near crosshair |

Only a balanced MouseLeft down/up occurs between these two frames; there is no
movement, mouse move or turn command. I personally inspected both originals.
The arch edges, trim and crosshair remain aligned. Four fixed architecture
rectangles, totaling 59,150 pixels, are also byte-identical at their original
coordinates. `same-camera-review.json` records the rectangles and review.
The changed flame/weapon pixels and HUD values are retained, not normalized.
The health changes alone are not classified as bot damage or a renderer defect.
These captures establish firing and the requested torch view pair; they do not
establish muzzle-flash timing, FPS, audio, native/software parity or a full27 sweep.

The actual render Worker owns `OpenGLHostBridge`, `WebGLBackend` v1 and
`FixedFunctionGL`. Endpoint 1 is GL/WebGL, HWND 65543, with a non-software context.
The provider is WebGL 1.0 Chromium through
`ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)`.
At the final fire frame: 320,796 batches, zero software batches, write sequence
845, no endpoint failure/fallback and zero completed software draws. CPU and
render Workers both instantiated module SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
This is owning-backend evidence, not the toolbar selection.

## Closure and controls

The existing authentic PK3 at
`test/binaries/candidates/quake-3-arena-demo-installer/installed/demoq3/pak0.pk3`
was read in 90 small chunks, transferred, individually verified, assembled and
independently reread against the full 46,853,694-byte SHA-256
`e77abad2466f45a0a7ea018445528f9b95a0fe7789fa1abc1a7718bbf0754b08`.
Temporary chunks were removed. All 914 runtime pins pass before and after the
run. No media/source archive or local duplicate media was created.

The exact input checkout is `11109c52fb51ed94f8bfe016d583b65139cb5499`.
`runtime-pins.json`, `relevant-source.patch`, `new-source.patch` and the small
`run-specific-inputs.patch` record inputs; Git remains the source archive.

Five assembly controls, local serialized delayed-timeout/UNKNOWN release tests,
explicit-success transport controls and the actual-browser trusted-release
control pass. A generated browser page also proves that the absolute deadline
closes the serialized queue before input or original launch. All controls finish
before the original. No software/native original was rerun.

The initial browser preparation rejected `index.html` before app selection:
I had generated browser pins with `size` instead of the collector's required
`bytes`. The body SHA matched the runtime pin. The rejected harness is preserved
under `retrieved/webgl-prelaunch-rejected/`; its selected-app and launch-input
records are absent, and its normal exit, processes, ports and profile were
verified closed. A secondary Puppeteer connection timed out during this stalled
navigation; a later raw close found the browser already closed by the driver.
No guest input was involved. The pins were corrected on the same box, with a
local old-schema-rejecting check. Exclusive local log-name collisions and one
local helper syntax error also occurred before effects and are preserved.
There was exactly one actual original launch after complete closure.

The ordinary menu route uses Tab to Single Player, retains Q3DM1, tabs to Fight,
then uses the difficulty menu's Fight button. It omits the prior exploratory
Enter/Escape/click probes. One acknowledged Enter needed additional host runtime
to draw the level menu; a host-only resume and capture resolved it without
another guest key. No guest state, configuration, map or memory was forced.

Every one of the 23 balanced original inputs has trusted down/up events, a
successful receipt and a personally reviewed reference image. The maximum
reference age at input was 26.855 seconds, within the enforced 90-second limit.
All 27 capture/input commands succeed; no original command is UNKNOWN or failed,
and no input is replayed. The serialized finally-release gate is reused.

## Deadline and terminal recovery

The 35-minute assignment runs from 07:37:35 to 08:12:35 UTC. Command admission
closes at 08:03:30; browser cleanup is scheduled for 08:05, reserving over seven
minutes for recovery and shutdown. The successful work finished early: ordinary
quit closes the browser at 07:50:08.185Z with exit code zero and no held input.

All 204 inventoried remote artifacts (13,593,081 bytes) are hash-verified locally,
plus the separately retrieved final terminal audit. This includes unique logs,
captures, pre/postflight and the rejected prelaunch evidence. The unchanged
module already exists locally and is identified by its full hash.
Terminal checks find no runtime processes, all four HTTP/CDP ports closed, both
explicit profiles absent, no temporary Puppeteer profiles or profile locks,
physical/async keys false, queue zero and driver-held set empty.

The sole box `bx_enztnm6f` used one persisted UUID Idempotency-Key. After evidence
recovery and terminal verification, explicitly delegated normal, nonforced
shutdown completed at 07:50:56.954Z. State is `archived`; expiry is null (initial
expiry was 08:13:31.450Z). No stopped box was resumed. Local watcher cleanup,
free `/home` space above 2 GB, evidence validation and publication are recorded
before `result.json` is written last.

The firing/torch task is complete. Further compatibility or parity work needs a
separate scoped request; this run supports no broader release claim.
