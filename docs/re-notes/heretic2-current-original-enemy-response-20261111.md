# Heretic II original enemy hit and response, 2026-11-11

The original registered demo now has a visible outgoing combat consequence.
Corvus aims the flying fist down the open alley at the blade-wielding humanoid:
red impacts appear on the target, it drops from its standing pose, and its
fallen body remains on the cobbles afterward. The native caption reads
“What ails him? He looks to be diseased.” Corvus remains alive at 8 health.
This establishes an outgoing hit and enemy response; no kill counter, route
exit beyond the furnished room, or campaign completion is claimed.

Run: `scratch/runs/20261111-heretic2-room-enemy-response-0940/` (ignored).
This follows the [interior health-vial result](heretic2-current-interior-pickup-20261111.md).
No emulator change was needed.

## Native route and decisive captures

The ordinary `heretic2_demo` entry launches the original installed executable,
companions and manifest. Game → Easy and the intro lead to the docks. Native
forward movement crosses the pier, follows the waterside lane and reaches the
stained door, which opens on approach. The humanoid emerges beside Corvus at
the threshold. This run engages that visible target instead of repeating the
room's already-proved health-vial collection.

The first close flying-fist and staff attacks do not by themselves establish
outgoing damage. Their timed frames primarily show incoming strikes, and
Corvus's health falls to 8. After turning toward the attacker in the open
alley, ordinary `2` selects the flying fist and a finite 10-second Control hold
produces the decisive sequence. No further movement occurs during that hold.

All paths below are relative to the run's `software2/` directory:

| Full capture | Visible evidence |
| --- | --- |
| `fist-ready.png` | The humanoid stands ahead in the unobstructed alley before the aimed attack. The weapon-change animation is still settling. |
| `aimed-fist-during-1500.png` | Corvus raises his casting hand; the humanoid is still standing ahead. |
| `aimed-fist-during-3500.png` | Red impact particles surround the target; the native diseased-person caption appears. |
| `aimed-fist-during-5500.png` | Continued projectile impact and a low/fallen target at the same location. |
| `aimed-settled.png` | Projectiles have cleared; the target is no longer standing and health remains 8. |
| `aftermath-approach.png`, `aftermath-close.png` | Ordinary forward movement retains the fallen green body/weapon and blood marks on the alley cobbles; health stays 8. |

Every listed full image was personally inspected. Numbered captures retain
their image hash, state and live owner/module binding. The three timed attack
images are native page screenshots scheduled inside `long-action.py`; their
hashes are in the recovered inventory. The action's review, live process/module
object check and trusted key edges bind the finite attack to the same runtime.
All 35 numbered commands succeeded without stale refusal or uncertain replay.
Full current images were reviewed before ordinary native input.

The post-combat main and Game menus were also inspected. The Game page exposes
difficulties, maps, objectives and credits, with no Save/Load entry in the
reviewed menu (`aftermath-game-menu.png`). No authentic ordinary save was
obtained. No guest state, save, configuration, console or map was edited.

## Pinned runtime and checks

The tested source remains `0db20330ccd6761a705eea70c5dd9bfc7704c147`, with the
recorded relevant patches and original media references. Both the live guest
and owning renderer report the recovered module, 2,189,363 bytes, SHA-256
`ce57f0ad80254b974a0d8bcd4e2c9cbf396d2357cbdc7874e6084e980e1e68e1`.
Advancing shared main/build outputs did not change this bundle: preparation
resolves changed tracked files from that Git commit and the module from its
retained hash. No source tree or repeated media archive was made.

The validated software GL/browser setup and repaired balanced key helpers are
reused from the prior runs. Chrome 151.0.7922.108 keeps its native viewport;
full PNGs are 780×500 and the guest context is 640×480. The owning GL endpoint
reports `backend: software`, separate from the legacy endpoint. There is no
new backend qualification or compiler fix claim.

All 3,377 staged provision files passed size/SHA checks before launch. All
2,461 runtime source/media/module/helper pins still matched after gameplay,
including the retained original installed media and manifest. The matching
locked build proof remains
`20261111-avp2-current-marine-encounter-0820/build-final.log`, referenced by
`reused-build-proof.json`. The focused helper regression passes eight checks
for balanced number/objective keys and release after partial delivery.

## Recovery and normal stop

All 409 artifact references / 335 unique contents were recovered and raw
size/SHA-256 verified before stopping the box. Validation passes all 44 PNG
CRC/IDAT checks and the decisive numbered capture bindings. The content-addressed
gzip store and `final-recovery-local-map.json` retain original paths;
`local-compaction-map.json` records lossless removal of 9,321,002 duplicate
local bytes. Decisive full PNGs remain directly viewable. Git commit plus
patches, run-specific helper inputs, media path/hash references and the exact
recovered module are the recovery inputs.

The controller, Chrome and their parent wrappers exit normally with code zero,
actual parent waits and both pipe EOFs. A separate check finds both runtime
PIDs, the profile and server port absent.

Box `bx_8ga36rk2` was created at 09:35:38 UTC with a 45-minute lease. Its
independent observable watchdog was armed before allocation with immutable
deadline 10:20:38.290 UTC; initial service expiry was 10:20:38.705 UTC.
After verified recovery, delegated normal stop `stop_24108aa1c8770e73` completed
at 09:49:51.870 UTC, forced=false and error=null. An independent subsequent GET
confirms **archived**, completed stop and expiry null. The watchdog exits zero
without firing, with actual wait and both EOFs retained. No restart, resume,
delete, additional box, worker or public deployment occurred.

Next gameplay work can pursue the route beyond the furnished health-vial room.
