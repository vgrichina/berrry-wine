# Quake III demo: native Major encounters, 2026-11-12

Evidence: `scratch/runs/20261112-quake3-native-major-encounter-0248/`.
This extends the [movement/fire checkpoint](quake3-current-native-arena-20261112.md)
with visible Major encounters, native pointer-lock aiming attempts and explicit
combat consequences on both software GL and WebGL. It does **not** establish
outgoing damage, a player frag, measured FPS, visual parity, audio or full
GLD3D-CORPUS-27 completion.

## Original game and controls

The tested closure matches main `395de98b8d6d6b4c63be726a6d75e14cf8103e7b`,
including `199cf5b4e`. Page, actual guest Worker and actual render Worker recover
the canonical 2,189,682-byte module, SHA-256
`1165f15cb29fa4ff4b67621f3ce66f8df68fb50baea929d0b76e9b2f66118135`.
The original registered demo pak0 is 46,853,694 bytes, SHA-256
`e77abad2466f45a0a7ea018445528f9b95a0fe7789fa1abc1a7718bbf0754b08`.
Exact existing media/runtime/helper paths and hashes are in `runtime-pins.json`;
source recovery is Git plus binary diffs and owned harness patches. No source
tree or repeated media archives were created.

Both fresh routes use Enter Single Player → Up Fight → Enter Difficulty →
Enter Bring It On. Connection and Q3DM1 media loading take several minutes.
No actor, aim, health, inventory, configuration, script or guest-code patches
were applied. Controls are trusted CDP keyboard/mouse events through production
input, with separately retrieved, hash-verified and visually reviewed full
viewport captures before dependent actions. Mouse clicks acquire real browser
pointer lock (`document.pointerLockElement.id === 'screen'`); subsequent native
mouse movement changes yaw/pitch. Key and button holds have prearmed,
independent releases and acknowledged up/down receipts.

## Reviewed combat

`webgl-combat/game-media.png` shows Major in the courtyard left of the
crosshair, ammo 100 and health 108. `pointer-acquired.png` shows a muzzle flash
and ejected casing, with health 46; `aim-left.png` shows the native left/down
view adjustment and ammo 98. W advances into the courtyard. A later completed
world, `turn-settled.png`, explicitly says **Fragged by Major**, shows the player
corpse and scoreboard Major 1 / UnnamedPlayer 0.

A normal mouse click respawns the player. `respawn-settled.png` shows live Major
jumping at the right of a stone corridor, ammo 100 and health 116. The attempted
rightward mouse aim is followed by another explicit Major death, score 2–0,
with blood and gibs. After a second respawn, Major is visible near the courtyard
arch in `respawn-two.png`. A native left/down correction and 2-second attack
attempt ends in another native respawn with score 3–0. The long observation
interval can outlast a close fight. No outgoing hit is inferred from these
attempts or from the opponent portrait.

`software-combat/courtyard-forward.png` shows live Major and a projectile in
the courtyard, ammo 98 and health 73. Native locked left/down aim and two
2-second attack pulses produce muzzle flashes/casings and ammo 98→94→90;
health falls to 45. The small central object in later images resolves as the
rotating shotgun pickup, so it is not evidence of a hit or fallen opponent.
After further native movement, `left-clear.png` explicitly says
**UnnamedPlayer was melted by Major's plasmagun** and **Fragged by Major**,
with the player corpse and Major leading 1–0.

The earned result is visible original encounters and combat consequences on
both backends, with native aiming/firing attempts. A controlled outgoing hit
or player frag remains open.

## Exact producer identities and validation

`retrieval-verified.json` retains the complete identity joins. Software guest
Worker target is `596DD1414935E5C7040F641CECC487BA`, render Worker target
`28798AA6B7C43FAB772B41F3E33C2F38`, actual GL context
`c302724a-e3d8-4cc0-97ff-bffb55d0c470:3`. The software GL owner is endpoint 1;
its legacy display transport is endpoint 2. The latter's default WebGL label
does not identify the GL producer. Native software-front completions advance,
and joined presents increase 607→652→692→724→826.

WebGL guest target is `95218A9B749A1F11F53E233E65DE7C1A`, render target
`8F7D6A213627B91274B60FED2FAD2FB4`, context
`c9cf8a3c-6610-435d-b367-93f2229a50f9:3`, GL/display endpoint 1. Its actual
WebGL draws/vertices and presents advance (1050→1572 presents), with zero
software fronts. Worker instance, module, document, canvas, context and renderer
epochs remain stable within each case. This run does not independently record
the GPU vendor string; the parent's hardware label is not substituted for it.

Verification passes 481 recovered records / 393 unique raw hashes / 56 PNGs,
independent remote rereads, local rehash, served full/ranged byte hashes,
producer continuity/progress, canonical live modules and balanced input pulses.
All recorded DOM input events are trusted. Final captured host button masks are
zero; one key-up (software) or mouse-up (WebGL) remains queued at those immediate
captures. An empty final guest input queue is not claimed. Both successful
Chrome and runtime parents return 0 with separate stdout/stderr EOF. Six focused
native-input regression tests and harness syntax checks pass. No production
defect was proved or production repair made; no new locked build was required
for this evidence/docs-only follow-up.

Preserved setup failures include a caught harness pin mismatch, a missing remote
lease file before Chrome launch, and a local launch-record filename collision
after a successful fresh launch request. The first WebGL browser hit its
20-second observation-work deadline during a viewport screenshot after slow
owner inspection; its runtime parent returns 1. That browser was closed and
not reused. A fresh browser uses a run-local 40-second work budget and
`fromSurface:false`; no production behavior or guest clock was changed. A
premature frame GET returned 404 before the capture ACK; no dependent input
used it. Late software parent/stdout evidence was recovered separately after
EOF, preserving the earlier zero-length stdout version.

## Lifecycle and next step

Private box `bx_kwydc223` had an initial expiry of 03:47:33.122Z, with an
observable independent watchdog prearmed before allocation. After both runtime
parents exited and evidence was recovered/verified, normal delegated stop
completed at 03:11:33.129Z. Final state is archived, expiry cleared, receipt
`stop_2e8695fc8306f7ec`, completed / forced false / error null; an independent
final GET agrees. Lifecycle client, actual manager parent, durable watchdog and
deadline-watchdog waits/EOF return 0. The local transport wrapper also returned
0 in this run; no exit 143 occurred.

Next: reacquire and track moving Major through a complete native firing window
and verify outgoing damage or a player frag. Preserve the existing FPS/audio/
parity/full-27 open scope.
