# Heretic II canal exit back to the docks, 2026-11-11

The original demo's open canal has an ordinary exit onto the cobbled bank
beside the starting alley's lit arch. This closes a traversal loop through
the doorway room, its floor opening and the low flooded passage. It does
not establish a new campaign area or completed objective.

Run: `scratch/runs/20261111-heretic2-native-canal-exit-objective-1105/`
(ignored). The preceding route is in
[the canal handoff](heretic2-current-canal-route-20261111.md).

## Native route and observations

Starting fresh through the registered `heretic2_demo` entry and Game → Easy,
Corvus crosses the pier and approaches the waterside doorway. Forward plus
the shipped `a` / moveup crosses the raised steps. A close Flying Fist burst
does not immediately stop the humanoid. Corvus then switches to the shipped
Sword-staff and attacks; `doorway-face.png` later shows the fallen humanoid down the
alley and the native “What ails him? He looks to be diseased.” caption.
This is the already known doorway encounter, not a new enemy encounter.

All capture names below are relative to the run's `software2/` directory:

| Full capture | Visible route evidence |
| --- | --- |
| `room-hop-after.png` | Corvus has dropped below the furnished room floor into water; fireplace above, cyan breath bar visible. |
| `lower-turn-after.png` | The low flooded stone tunnel is visible after a right turn. |
| `tunnel-out-after.png` | Forward plus shipped `m` / movedown has crossed the tunnel into the open canal. |
| `canal-right-after.png` | One canal direction looks back toward the original pier and lit arch. |
| `canal-dive-after.png` | The gate-side corner presents solid stone walls; no continuation is visible there. |
| `overhang-back-after.png` | Backing away from the building overhang returns Corvus to open water beside the docks, with breath refilled. |
| `native-center-after.png` | The shipped End / centerview key restores a clear view of the low stone bank after camera obstruction beneath the dock. |
| `bank-face-more-after.png` | The swimmer faces the exposed low step, with the taller wall on the right and lit arch behind the bank. |
| `bank-up-after.png` | A finite six-second forward + `a` hold carries Corvus out of the water onto the cobbles. |
| `bank-landed.png` | Passive settling confirms Corvus standing alive on the dry bank. |

The useful exit is the exposed stone step, not the underside of the wooden
dock. Attempts beneath the crossbeam leave Corvus in water. Diving near the
gate-side overhang can obstruct the camera and consume breath; backing away
and forward + moveup recovered the surface without death or reload in this
run. End / centerview is useful for recovering a clear native view.

The canal therefore returns to the starting alley. A subsequent short check
beside the crate-blocked arch did not establish passage through that arch.
No new objective completion is claimed.

## Save and input limits

No progress save was obtained. After the canal exit, `exit-menu-settle.png`
and `exit-game-ready.png` show the settled native Main and in-game Game books.
Neither displayed page exposes Save or Load. The shipped `o` binding printed
the native objectives-banner setting (`canal-objective.png`), rather than
opening an objective page. No console, configuration, map, save or guest state
was edited.

Every current full numbered capture was inspected before the next input.
Longer actions used finite native key holds, actual releases and passive
settling. The small owned controller extension admits native End and
forward + Space; it changes no guest or production code. The latter action
did not establish a dock climb. Timed attack captures are retained separately
and were not pre-input reviews.

## Reproduction and lifecycle

The accepted source remains `0db20330ccd6761a705eea70c5dd9bfc7704c147`,
with the retained relevant binary patches, and module SHA-256
`ce57f0ad80254b974a0d8bcd4e2c9cbf396d2357cbdc7874e6084e980e1e68e1`
(2,189,363 bytes). All 3,377 provisioned files passed remote size/SHA checks;
all 2,461 runtime pins still matched after gameplay. The matching existing
locked-build proof was rehashed, and the reused balanced-key regression
passed eight checks. No production repair or new build claim is made.
Git plus the retained patches preserves source; existing media paths and
hashes preserve media references without another media or source archive.

All 698 artifact references / 542 unique contents were recovered and raw
size/SHA verified before shutdown, then reverified locally. Validation passes
79 unique PNG CRC/IDAT checks, 76 capture/image/owner/module bindings, 76
successful numbered ACKs and 52 finite balanced direct holds. The
content-addressed gzip store and `final-recovery-local-map.json` restore the
remote artifact paths; local metadata compaction has its own lossless map.
Full numbered screenshots remain directly viewable.

Runtime closure has actual parent waits, both pipe EOFs, zero exits and an
independent PID/profile/port absence check. Box `bx_296qm57k` was created with
a private 45-minute lease and fixed independent watchdog deadline
11:47:27 UTC. After verified recovery, normal stop
`stop_7fe722df0c6528fa` completed at 11:32:54.111 UTC, forced=false and
error=null. A separate GET confirms archived, completed stop and expiry null.
The watchdog exits zero without firing, with actual wait and both EOFs.
No resume, delete, additional box, worker or public deployment occurred.

Next: approach the crate-blocked arch from the dry starting alley, or survey
the room above its floor opening for an onward route. The flooded passage
and canal bank now provide a demonstrated return loop.
