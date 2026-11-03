# Jedi demo: southeast pipe approach; death before hostile identification

The sole original-demo campaign reached the pipe, turned toward the authentic
patrol corridor before emerging, and cleared the pipe with original C duck.
The player then died before an armed hostile was positively identified.
**No shot, visible incoming projectile/source, target effect, restart or second
campaign is claimed.** The first terminal blocker is player death, with its
source unidentified. Evidence is in gitignored
`scratch/runs/20261103-jedi-patrol-facing-encounter/`.

The [measured prior route](jedi-live-sector-route-20261103.md) reached the pipe
and died with its attacker offscreen. The
[static hostile route](jedi-hostile-route-20261103.md) identifies Bossk266 as a
candidate, not a visible attacker. Civilian65 is excluded as a target.

## Geometry, live observation and reviewed result

Fresh extraction of the original level establishes the southeast portal from
sector265 to255 near `(0.833326,2.266668)`, then the eastward portal from255
to240 near `(0.999993,2.050001)`. From the prior pipe position
`(-0.55,3.89)`, the first portal's bearing is about220.44°. This run recomputed
the bearing from its own position, turned southeast before descending, and
refined facing before the final movement. Static patrol placement was never
promoted to identification of a rendered attacker.

The original Coords routine at0x4eec10 establishes the bounded read-only
player/sector/position layout. Its174 original bytes are checked at each live
observation against SHA256
`d94012c127c570f20b7ebd4fb9f611a36725449bb38a327ccff0c2a167ff3652`.
World/player/sector pointers are read afresh in this process; no predecessor
instance pointer, guest write or engine call is used.

The routine establishes worldGlobal0x8339d0, world+0x124 local player,
player+0x5c sector, sector+0 ID, player+0x88 orientation and player+0xb8 XYZ.
The observer uses existing CLI eval with pure host `ctx.g2w`/DataView reads:
at most76 data bytes plus174 immutable original code bytes, without scanning.
During the movie the world was null, during loading player was null, then live
world/player pointers were freshly observed as0x1399d58/0x1c0d31c. Equality with
a predecessor allocation is not pointer reuse; each observation follows the
original global and validates the original code.

All50 sampled live positions fit their original sector bounding boxes.
The sampled sequence is **874 → 266 → 276 → 256 → 277 → 280 → 265**;
sector267 lies between captured passage states and is not claimed as a sample.
`observed-route.json` retains full positions, yaw and batch numbers. Selected
personally reviewed captures under `live/` show:

| Capture | Sector / XYZ / yaw | Visible result |
| --- | --- | --- |
| `world-baseline.png` | 874 / (1.07045,5.46062,0.07011) /55.00° | Courtyard/pistol; health100, shield100, ammo100. |
| `stairs-facing-east.png` | 276 / (-2.17642,4.46477,0.27011) /262.19° | Authentic stairs directly ahead. |
| `upper-landing.png` | 277 / (-1.26239,4.38903,0.67011) /267.23° | Stairs climbed through ordinary Up. |
| `patrol-facing-before-descent.png` | 280 / (-0.55101,4.13508,0.67011) /210.53° | Pipe ahead; southeast turn before clearance. |
| `duck-held-step26.png` | 280 / (-0.15742,3.54237,0.27500) /213.59° | Pipe passed while ducked; all HUD values100. |
| `pipe-cleared-standing.png` | 280 / (-0.15341,3.53633,0.32011) /213.59° | C released; walls and opening, no armed actor. |
| `southeast-refined.png` | 280 / same position /219.79° | Last living capture, all100; portal bearing about218°. |
| `emerge-step01.png` | 265 / (-0.30655,3.06402,-0.12989) /221.23° | Player corpse, health0/shield0/ammo100, restart prompt. |

Pipe travel requests were0.2s followed by key release and immediate capture.
Original C remained held across26 short forward checkpoints, then was released.
A separate0.04s Left turn refined facing. The final Up request was0.2s;
the next capture already shows death. The large final displacement is observed,
but its cause and the time of death within the capture interval are unknown.
There is no retained intermediate hit tint, projectile, attack animation or
attacker view in this run. The corpse is the player, not a hostile target.
Ctrl was never pressed;129 recorded input intents contain exactly one Play
click and one New Game click. Death review triggered the stop request with no
subsequent input. No collision, rendering or engine fault is established.

**Review-order limitation:** `duck-held-step02` image output and step03 steering
were batched in one host tool call. Step02 reached the model after step03 had
already executed, so that step was not reviewed before steering. Step03 and
all subsequent checkpoints were personally reviewed in separate calls before
further steering. `review-order-limits.json` preserves this deviation; this run
does not claim exact compliance with the requested review order.

## Execution, identity and preservation

Only fresh boat **bx_zpht2gb2** was used, finite TTL7200, original expiry
**2026-11-03T14:07:13.833Z**, shutdownOwner `jedi-patrol-facing-encounter`,
recorded before use. The task explicitly authorized native CLI without an
Alice/GL gate and delegated this boat's normal stop after evidence preservation.
No subworker, Chrome/browser, predecessor boat operation or public deployment
occurred; held/laptop/font/HeroesII and foreign code lanes were untouched.

Source was sealed committed main
`30932ca54be80b5fda5e6d8a9e0a13383711019c`: all5827 exact Git-blob inputs
streamed directly to the boat, excluding foreign WIP including
`lib/wininit-boot.js`. Every input was unchanged after build and independently
verified recoverable from Git. No duplicate local archive or checkout was made.
Fresh boat-side `flock /tmp/wine-build.lock bash tools/build.sh` passed, as did
four focused shell CLI routing/WinExec readiness/keyboard lParam/process desktop
tests and four no-guest observer controls.

Built module2088037 bytes, SHA256
`7c22e2715377fd09a71887a62211ccd3cc0e8c96e56cbc65ca792e8c35213726`;
source dictionary SHA256
`77ecc8f049d0e448a67a77716624ec4b7feae61ae50b773b9bde0d7767bbdde5`.
Actual compile-input and completed-instantiation receipts separately identify
launcherPID21117, gamePID21196/control8144 and duplicate-childPID21227/control8145,
all matching that module. Both original WinExec calls executed; the second
child found the game window and exited through the original path.

One `node test/run.js` session followed original Play → full unskipped movie →
Player/Medium → Single Player → New Game. Guest1200s/outer1260s limits were fixed
at launch2026-11-03T12:10:37.021404Z, with immutable outer deadline
**2026-11-03T12:31:37.021422Z**. The supervisor stopped early on the terminal
blocker after **883.255755004s**, exitCode-9. Its process group required TERM
then KILL after5s grace. That cleanup is separate from the boat's normal stop.

Original JkDemo.exe1388032 bytes has SHA256
`0f8a1b01cfdcb196b043ebb4ebf42dc3a6d4fa394034ebfb8cad9e383e14aa46`.
Fresh original09fuelstation.jkl3547906 bytes has SHA256
`3cc6db585f16f2976d12750848498a39942088bad85372882c934c0e506572ae`.
Before/after checks preserve all28 originals/39900850 bytes, genuine
DSOUND.VXD/DDHELP, builtin DDRAW/DSOUND and219 runtime files. All61 captured
states preserve original registry values and original file pins;60 child states
have only allowed Version0.1. The parent's76 exported entries are unchanged.
Initial extraction-header errors and readiness capture races were corrected;
`helper-errors.json` distinguishes these from guest failures.

All232 retrieved payloads passed stored/decompressed byte-count and fullSHA
checks. Evidence archive8737543 bytes, SHA256
`f962e88d1ce26e3698c2e9d5271c0b3597340d1f6433722801d62e7054676ebd`.
Recovery5830 bytes, SHA256
`a1e4ea8c0d94698e06831ac58cff896cd9921d49d6737b82da5e0bf361e92db7`,
was uploaded and independently retrieved byte-for-byte **before** normal stop.
`RECOVERY.md`, recovery scripts, source seal, manifests, instance receipts,
input records and reviewed images preserve the recovery recipe.

Only own boat completed normal stop **stop_a8b7d82c79eb4cbf** at
**2026-11-03T12:27:48.738Z**: **STOPPED/completed/error:null/forced:false**.
Normal snapshot/metadata remain retained and available. Scoped helpers and
ports8143..8159 are absent. No assigned boat remains running; local /home free
remained above2GB. This task is finished at its concrete blocker. A further
campaign requires separate authorization and cannot assume Bossk266 caused
this death.
