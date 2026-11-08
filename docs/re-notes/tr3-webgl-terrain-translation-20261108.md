# TR3 WebGL terrain-relative translation — 2026-11-08

**Current WebGL shows bounded forward translation relative to Jungle terrain,
retained after release.** The decisive comparison is a separately reviewed
Up1000 from an already established downhill view, followed by two no-input
captures. No emulator mismatch was demonstrated and no emulator code changed.
Full27, parity, audio, FPS, firing consequence and level completion remain open.

Evidence: ignored `scratch/runs/20261108-tr3-webgl-terrain-translation/`.
This extends [the previous movement note](tr3-current-movement-after-headroom-20261108.md)
and its accepted WebGL heading/software translation without repeating those
tests. There was no weapon action or software run.

## Route and original-pixel review

One fresh UUID-idempotent box ran one original TR3 executable and one heavy
browser runtime. Ordinary native welcome OK → unchanged setup OK → Game →
visibly open New Game passport → Jungle passed. Setup retained Primary Display
Driver, Direct3D HAL, Hardware Acceleration, 640×480 High Colour 16 Bit and
ZBuffer. The normal host renderer query selected WebGL. No guest patch,
config/scene/clock/seed/save edit, private handler or forced launch was used.

All 18 PNGs pass chunk CRC and complete PNGjs decoding. Seventeen raw 945×889
images were personally opened; the automatic `startup.png` is unreviewed and
superseded by the fresh reviewed welcome. The game buffer is 640×480.
Input reviews bind each exact capture hash and current owner.

`jungle-start.png` shows startup and the Controls overlay. Twelve seconds of
no input gives `jungle-settled.png`, a side view of Lara on the mossy starting
rock beside the right wall, with the tree to the left. A further ten-second
idle gives `landmark-baseline.png`, retaining that view. This isolates the
substantial initial camera motion from later input.

One Up100, then a separately reviewed Up500, each followed by release and an
eight-second persistence capture, show no clear displacement. These are
negative visual observations, not proof that the guest ignored the input.
Lara remains standing at the same part of the foreground rock. The passive
hold observations retain one slice sequence each (8653 and 8779 respectively),
despite the physically held Up state being observed. Physical ACKs alone do
not establish a guest keyboard poll or simulation step.

A separately reviewed Up1000 gives `forward3-after.png`: the Controls overlay
has cleared and the camera is behind Lara looking downhill. Eight more seconds
without input gives `forward3-persistent.png`. Lara remains standing on the
foreground rock, with the large boulder to her left, the orange slope to her
right, and the downhill stump/corridor ahead. The camera continues to adjust
between these images; this first substantial view change is not the sole
translation proof.

From that reviewed downhill view, a separate Up1000 gives
`forward4-after.png`. Lara now stands farther along the same rock: her feet
are nearer its far edge and her figure is smaller relative to the left
boulder, while the boulder, right slope and downhill stump remain identifiable.
`forward4-persistent.png`, after twelve seconds without input, retains that
farther position. `translation-final-idle.png`, after another ten seconds
without input, retains it again. Some camera adjustment remains, but the
changed relationship of Lara to the foreground rock and adjacent boulder
persists; the result is not inferred merely from a changed viewpoint or ACK.
No world-space distance, speed or simulation rate is claimed.

All these captures remain in the same living Jungle scene. There was no death
pose, title return, second New Game, respawn or life boundary used as movement
evidence. Lara is unarmed throughout the movement checks. No firing claim is
made from a pose.

## Current runtime identity and controls

Staged source is published Git commit
`78df2e4d90114320f68ed2b44014f6d10d929e06`; tracked files were staged from its
Git blobs, excluding peer WIP whose relevant binary diff is retained.
Existing helpers and modules have separate path/size/SHA-256 pins. There was
no rebuild or source-to-module equivalence claim.

All 48 actual guest/render Worker module references match the 2,182,452-byte
module SHA-256
`7ec49cbbae4cb177909fd8fd9d3599713ee5f2a5ffb7f7e8c890848a540052bf`.
All 189 complete successful HTTP responses and four loaded host scripts match
their staged pins. The final process drain verifies all 603 pins unchanged.
Ten TR3 fixture files are referenced by existing path and SHA-256, without
media copies. Git plus retained patches is the source archive.

Guest owner `D9F25B16201B5AEA9C88026EBAA2A63C` uses endpoint 1, slot 0, GPU
enabled. Actual render owner `579628E199281CF51529FD2704DF5AA5` owns
`legacy/webgl`, an observed OffscreenCanvas WebGL2 context at 640×480 and
advancing production commands. The observed renderer string is
`ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)`;
physical GPU remains unknown. Gameplay checkpoints retain errors=0,
fallbacks=0 and both software-completion counters=0. Chrome is
151.0.7922.108, with production guest Workers and native viewport.

Released controls passed native-before-render input, one-way actual-owner
binding, replacement rejection, stale zero-effect refusal, slow-sampler
independent release, atomic numbered publication, exact ACK identity,
duplicate rejection and sticky UNKNOWN closure. The actual browser also ran
the helper's native-key/invalid-duration preflight. All 18 original commands
have exact complete ACKs, with no stale refusal, UNKNOWN or replay. Forward
holds released at 100, 500, 1000 and 1000 ms. The two 1000-ms intervals observe
slice sequences 8908–8915 and 9082–9092 respectively; these are sparse host
observations, not poll, step or FPS measurements.

## Recovery and delegated shutdown

An operator helper-selection error invoked live inventory retrieval before
the first input instead of a capture command. A changing-file hash mismatch
stopped that retrieval. The failed attempt and partial files are retained
separately under `early-*`; no input was dispatched by that invocation. The
correct command helper then used new original command IDs normally. Final
evidence comes from the settled, fully drained inventory.

Chrome exited zero at 06:09:42.536 UTC. Two immediate read-only drains still
saw the controller completing; the settled check at 06:09:56.861 proves all
owned controller/Chrome/profile processes, ports, profile and writer lock
absent. All **204 artifact references, 184 unique hashes**, were retrieved and
independently size/SHA-256 verified at **06:10:08.589 UTC**, before stop.

The detached observable independent 25-minute watchdog was armed before
allocation. Box **bx_z9dzmgyt** is **archived**, final expiry null; initial
expiry was **06:29:31.921 UTC**, independent deadline **06:29:31.709 UTC**.
Delegated normal stop **stop_dbd23f440e10e3c4** completed
**06:10:10.244 UTC**, forced=false, error=null. Both lifecycle delegates exited
zero and the supervisor records no remaining children. Observed local disk
samples stayed above 5 GB. No RAM gate, old-box resume/delete, deployment,
source/media archive or nested worker occurred.

Only this findings note is committed. The translation question is closed at
this bounded visual level; measured timing, broader gameplay and the other
open qualifications require separate evidence.
