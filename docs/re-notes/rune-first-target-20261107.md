# Rune first-target route attempt — 2026-11-07

**The requested new-room/target and armed-hit consequence were not achieved.**
This single bounded original-demo run acquired a sword through ordinary play
and inspected further cave geometry, but never established a visible enemy or
damageable object. No attack was sent. No emulator disagreement was demonstrated,
so no runtime repair or speculative regression was added. Evidence is retained
in `scratch/runs/20261107-rune-first-target/`.

## Exact gameplay boundary

The published mounted-child CRT, release/ACK, movement, relative mouse,
pickup and swing controls were reused. The Software Rendering wizard completed
through ordinary Next, Next, Run. Native menu hover highlighted New Game and
Easy before selection. Initial unfocused moves and known cursor-edge misses are
retained; they are not successful selections.

`review/cave-start.png` shows unarmed Ragnar in the pickup cave. A 1,650 ms
forward pulse approached the slab but did not visibly acquire a weapon. Reviewed
left strafing, short forward/back adjustments and one 150 ms Ctrl Use pulse
followed. `review/pickup-forward.png`, after the subsequent 650 ms W pulse,
shows a sword, the sword HUD icon, and the original sword tutorial. This run
therefore establishes ordinary sword acquisition; it does not establish that
Ctrl had no causal role or reproduce the predecessor's specific axe pickup.

The route then backed away from the slab and surveyed left through the existing
relative-mouse route. Eight Escape-menu pointer repositions and individually
reviewed world mouse steps exposed the skull/slab side, a triangular gap between
pillars, and further wall/pillar views. The apparent gap in
`review/survey-turn-2.png` was approached with W 1,500 ms and A 800 ms;
`review/passage-align.png` shows a close rock face, not a verified passage or
new room. S 1,800 ms backed out. These views do not prove an invisible collision
or defective portal.

Two later S 2,000 ms pulses visibly receded from the slab toward the starting
side (`review/return-start-floor.png`, `beyond-start-floor.png`). Further turning
and two A 2,000 ms pulses inspected that boundary. Nearby geometry sometimes
occluded Ragnar/camera. S 1,000 ms, the final adjoining-side turn, and D 1,500 ms
ended at `review/final-clear-view.png`, still a rock/pillar view with the sword
HUD. No target, doorway traversal, room transition, hit reaction, damage or
destruction is established. Rocks were not attacked.

This is an unresolved **ordinary-route boundary**, not a precise causal emulator
blocker. The next attempt needs a visually established exit route from this
specific tutorial chamber before further input or combat claims. Repeating an
unopposed swing, the CRT repair, or broad transport qualification would not
resolve this boundary.

## Runtime and evidence

The staged source is main `fd948930ff9dca10beb624e7ffcd11e570df5412`.
`checkout-head.txt`, relevant binary diffs, owned helper patches and
`runtime-pins.json` retain recovery references without source/media archives.
The only changed production pin since the predecessor Rune run is the published
`lib/host-audio.js` change, SHA-256
`e2ae7f782e7fbeb246471acfb3a93d7ae80eec9b195e44f02072310e81373d15`.
The actual recovered module remains 2,182,500 bytes, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.

All 143 original registered media paths, including six shipped INIs, passed
actual local HTTP size/hash checks before allocation. The 603 staged pins passed
remote verification before launch and after runtime exit. The registered EXE is
233,472 bytes, SHA-256
`dd1588a902952414917b8cfc65996d46ec0323dc7d298c5a23d5b2ccf70f7add`.
Shipped release notes and User.ini were read and hash-checked; no config, media,
clock, private state, handler, forced inventory or cursor state was changed.

All 83 commands, including quit, have exact ACKs and no UNKNOWN/replay.
All resulting captures were personally inspected before subsequent input.
Trusted mouse movement/clicks use the same existing CDP page session; input
pulses independently arm UP before DOWN. The final audit passes 41 balanced
pulses, 128 trusted native events, six canvas mouse pairs, all 83 reviewed
captures, and all 539 successful served bodies against staged pins, with no
global CRT request. Actual rendering remains software /
CanvasRenderingContext2D, with no game GL contexts or render endpoint. The toolbar
does not qualify WebGL. Audio, FPS, physics/rendering parity and combat remain
unqualified. Rune has no candidate-corpus entry, so no unrelated dashboard
candidate is assigned.

One local retrieval label collided with an existing local record and was refused
before any remote operation; a new read-only retrieval label recovered the
already-ACKed capture without input replay. The first immediate custody check
caught Node's post-quit drain interval after Chrome had exited. A later read-only
inventory confirms both runtime PIDs absent, both ports closed, profile/writer
removed and no held input. Both outcomes are preserved.

## Lifecycle

One UUID-idempotent box, `bx_8pmh2ac8`, was created at 23:20:10.913 UTC,
initial expiry 23:55:10.762 UTC. Independent detached normal-stop and 25-minute
watchdog delegates were armed before allocation, with observable heartbeats and
immutable deadline 23:45:10.923 UTC. There was one original invocation.
Chrome exited normally with code 0 at 23:36:37.786 UTC. Unique evidence retrieval,
including the live module, completed with SHA/size verification of all 892
artifact references (36,270,635 referenced bytes) before the prompt delegated
normal stop. Final box state is **archived**, expiry **null**, stop
`stop_5f76de085db5b271` **completed**, **forced=false**, ended at
23:38:38.818 UTC. Both lifecycle delegates exited 0 and the supervisor has no
remaining children. The messageboard watcher was closed. No runtime resources
remain owned. No public deployment, resume or delete was performed.

Focused media, source-pin, input/ACK, screenshot/module, served-body and custody
checks pass. The global evidence checker retains seven unrelated containment
errors and reports none for this run. This documentation-only change requires
no code rebuild.
