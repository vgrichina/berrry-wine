# Current TR3 Jungle movement after restored headroom — 2026-11-08

**Current Software D3DIM shows persistent bounded Jungle translation and a
separate heading change. Current WebGL shows a persistent heading change, but
terrain-relative translation remains unproved.** No emulator regression was
established and no emulator code changed. Full27, backend parity, FPS, audio and
level completion remain open.

Evidence is in ignored `scratch/runs/20261108-tr3-current-movement-after-headroom/`.
This follows `tr3-current-native-gl-gameplay-20261108.md` and keeps its accepted
WebGL world/pistol draw separate. The older November 7 software result is not
substituted for this run.

## Route and personally reviewed pixels

One fresh UUID-idempotent box ran WebGL, drained completely, then ran software.
Each backend used one original executable launch and unchanged native welcome
OK → setup OK → Game → visibly open New Game passport → Jungle. Setup retained
Primary Display Driver, Direct3D HAL, Hardware Acceleration, 640×480 High Colour
16 Bit and ZBuffer. Ordinary host renderer queries selected the backend. No
media/config/save/clock/seed edits, forced scene, private handler, guest memory
writes or repeated launch were used.

Raw captures were opened at their original 945×889 resolution. All 38 retained
PNGs pass chunk CRC and complete PNGjs pixel decoding. The game buffer is
640×480. Review sidecars bind the exact image hash and current owner to each
input. Captures named `startup` were superseded by personally reviewed fresh
welcome captures; capture existence alone is not acceptance.

For **WebGL**, `jungle-before.png` still includes startup animation and the
Controls overlay. Left2000 followed by four seconds idle gives `left-after.png`;
six more seconds idle gives `left-persistent.png`, a stationary side view beside
the moss wall and tree. The initial change is not isolated from startup and is
not accepted as movement or heading by itself.

From that settled image, a separate Right2000 produces `right-after.png` and,
after eight more seconds idle, `right-persistent.png`. Lara's torso/backpack and
feet retain a changed orientation while the same moss wall, tree and starting
rock remain fixed. This supports a bounded heading change independent of
forward travel. No angle is measured.

Two separately inspected Up2000 pulses produce `forward-after.png` and
`up-after.png`, each followed by ten seconds without input in
`forward-persistent.png` and `up-persistent.png`. The viewpoint changes
substantially, including camera follow around Lara. These images do not isolate
an unambiguous persistent terrain-relative displacement, so **current WebGL
translation is not accepted**. The last Up hold's passive samples all retain
slice sequence 8953; the earlier Up samples span 8419–8425. These are sparse
host observations, not guest keyboard-poll, simulation-step or FPS measurements.
They explain why physical ACKs cannot establish movement. The exact remaining
blocker is insufficient visible displacement evidence within the qualified
50–2000 ms physical-input envelope, with camera follow confounding the views.
No longer hold, timing patch or blind repetition was used to bypass that limit.

For **software**, `jungle.png` shows the settled side view and Controls overlay.
Space300 and four seconds idle give `armed.png`; another five seconds idle gives
`armed-persistent.png`, with raised pistols and unchanged terrain. Up100 gives
`forward-after.png`, retained six seconds later in `forward-persistent.png`.
That first change includes camera follow and is not the sole translation proof.

From this already settled downhill view, a second separately reviewed Up100
gives `step-after.png`. Lara stands farther along the same foreground rock,
with the large boulder to her left and the downhill stump/corridor still
identifiable. `step-persistent.png`, six seconds later without input, retains
that changed location and stationary armed stance. This is the bounded visual
translation result; no world-space distance is claimed.

A separate Left300 then gives `heading-after.png`: Lara faces toward the large
boulder instead of down the corridor. `heading-persistent.png` retains this
orientation after six more seconds idle. The camera follows the turn, but the
changed relationship between Lara's facing direction and the boulder/corridor
persists without forward input. All reviewed gameplay remains in the same living
Jungle scene: no death pose, title return, New Game repetition or respawn was
observed or used as displacement evidence.

One stationary software Control1000 was attempted after that armed scene.
`fire-after-held.png` and `fire-after.png` show armed poses, but no unmistakable
muzzle flash, impact, ammunition change or target consequence. **Firing and its
consequence remain unverified.** No target was visible and no second shot test
was attempted. WebGL firing was not attempted.

## Actual owners and current module

Published staging Git commit is
`0a38cf48438096482d059c5d8f27c048474c83b9`. Individual tracked runtime files came
from that commit's Git blobs; peer WIP was excluded and its relevant binary diff
retained. Existing non-Git helpers and module pins are recorded separately.
There was no rebuild and no source-to-module equivalence claim.

Actual guest and render Worker bytecode is 2,182,452 bytes, SHA-256
`7ec49cbbae4cb177909fd8fd9d3599713ee5f2a5ffb7f7e8c890848a540052bf`.
All 48 WebGL and 42 software module/checkpoint references match that pin.
All 189 WebGL and 181 software complete successful HTTP responses, plus four
loaded host scripts per backend, match staged pins. Both final drains verified
all 603 runtime pins unchanged. Ten TR3 fixture files remain referenced by
existing path and SHA-256; no media is repeated in the evidence.

WebGL guest target is `504B663F0B93C039A4E77A75EB532A93`, endpoint 1, slot 0,
GPU enabled. Actual render owner `E4B813D322B9138F247EB27E5DC0EB57` owns
`legacy/webgl`, an observed OffscreenCanvas WebGL2 context at 640×480, and
advancing production commands. The observed renderer string is
`ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)`.
Physical GPU remains unknown. Reviewed WebGL checkpoints have errors=0,
fallbacks=0, software completions=0 and GPU-fallback software completions=0.

Software guest target is `512289E41E22286BBCEE270B0900B2C9`, GPU disabled.
Actual owner `EC28526E011065C0EC04D3267BED7E1D` owns endpoint 1,
`legacy/software`, with no GPU adapter or observed GL context. Its direct
native software completions advance from 137,838 at persistent weapons to
176,592 at persistent translation and 198,912 at persistent heading. Shared
control remains ready=1/error=0, failed=null; guest fallback and GPU-fallback
software completions remain zero. Sequential samples are not atomic pairs.
Chrome is 151.0.7922.108, with production guest Workers and native viewport.

## Guards, retrieval and normal shutdown

Reused local controls passed native input before graphics, one-way actual owner
binding, replacement-owner rejection, stale zero-effect refusal, independent
release despite slow sampling, atomic numbered publication, exact ACK identity,
duplicate rejection and sticky UNKNOWN closure. Each backend also passed actual
trusted blank-page native key pairs and invalid-duration zero-effect tests.

The original queues contain **37 exact complete ACKs**: 20 WebGL and 17 software.
Three are stale refusals before dispatch, effects=0. Continuation used fresh
captures and new IDs, never consumed-ID replay. No original UNKNOWN or partial
action occurred. A proposed Shift+Up combination was rejected by local helper
validation before locks/publication/input because the released helper does not
support that combination. No helper relaxation or runtime change followed.
The read-only local retrieval helper was changed to fetch the three image
sidecars concurrently, reducing review latency while preserving all guards.

The first immediate WebGL drain saw its controller finishing after Chrome exit;
a later read-only drain and both final drains prove all owned controllers,
Chrome/profile processes, ports, profiles and writer locks absent. Chrome exited
zero at 05:53:44.184 UTC (WebGL) and 05:57:36.898 UTC (software).

All **415 artifact references, 369 unique hashes**, were retrieved and
independently size/SHA-256 verified at **05:58:04.181 UTC**, before stop.
Unique modules, captures, logs and exact command/ACK records are retained.
The independent observable 25-minute watchdog was armed before allocation.
Box **bx_yh7snky3** is **archived**, final expiry null; initial expiry was
**06:12:58.222 UTC**, independent deadline **06:12:58.011 UTC**.
Delegated normal stop **stop_fca890eb187e1b98** completed **05:58:05.036 UTC**,
forced=false, error=null. Both delegates exited zero and the supervisor records
no remaining children. Recorded disk samples remained above 5 GB; final sample was
6,290,513,920 bytes. No RAM gate, HTTP403 resume, box deletion, source/media
archive, deployment or nested worker occurred.

Only this findings note is committed. Next work is an ordinary-input method that
can isolate current WebGL terrain displacement within the qualified input
limits; no emulator repair is justified by this run alone.
