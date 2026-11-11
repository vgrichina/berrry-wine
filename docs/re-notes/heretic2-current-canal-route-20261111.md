# Heretic II native flooded passage to canal, 2026-11-11

The original demo now has an ordinary route beyond the furnished health-vial
room: Corvus drops through its floor opening, turns into the low stone water
passage and swims out into the open canal. He remains alive at 71 health.
Before entering, an aimed flying-fist attack visibly breaks the doorway
humanoid into red debris and body fragments. This extends the earlier
[room pickup](heretic2-current-interior-pickup-20261111.md) and
[enemy response](heretic2-current-original-enemy-response-20261111.md).

Run: `scratch/runs/20261111-heretic2-native-room-route-onward-1045/` (ignored).
No emulator or guest-state change was needed. No campaign completion or new
objective completion is claimed.

## Route and full captures

The ordinary registered `heretic2_demo` entry, Game → Easy, starts at the docks.
Forward crosses the pier; right turns toward the waterside alley; forward and
strafe follow the cobbles to the stained door and steps. Approach opens the
door. The successful second approach stays in the alley, aligns with the open
gap and engages the humanoid head-on at the threshold with a finite ten-second
Control hold using the flying fist. It does not repeat the earlier room pickup.

All image paths below are relative to the run's `software2/` directory:

| Full capture | Visible consequence |
| --- | --- |
| `trigger-enemy.png` | Blade-wielding humanoid directly ahead in the open doorway, before the aimed attack. |
| `threshold-fist-during-1500.png`, `threshold-fist-during-3500.png`, `threshold-fist-during-5500.png` | Native casting, projectiles and the humanoid's changing pose during the finite attack. |
| `threshold-fist-after.png` | Red debris and body fragments replace the standing target; native “What ails him? He looks to be diseased.” caption; Corvus alive at 71. |
| `room-entry-after.png` | A five-second forward hold through the cleared doorway has dropped Corvus below the room floor into water; fireplace and floor edge above, cyan breath bar present. |
| `lower-turn.png`, `water-align.png` | A right turn exposes the low flooded tunnel beneath the room window; a short left correction centers it. |
| `water-passage-after.png` | After six seconds of ordinary forward plus shipped `m`/movedown, Corvus swims outside in the open canal, with gate pillar, opposite buildings and sky visible; health remains 71. |

Every listed full image was personally inspected. Full current numbered
captures were reviewed before each input. The three timed attack captures
were reviewed afterward and were not used as pre-input reviews. All 42
numbered commands succeeded; no refusal or uncertain replay occurred.
The 15 longer holds retain trusted native down/up events, fixed durations,
actual releases and passive settling. The final extra key-up in each helper's
`finally` is retained in the event log.

## Authentic recovery and save limit

The first traversal reached the room with the humanoid following. During the
survey it killed Corvus. A subsequent ordinary forward input encountered the
native **Load Game** book: `opening-advance-after.png` shows **ENTERING** selected
and **Silverspring Docks** on the opposite page; all other displayed slots are
empty. Ordinary Enter loads that native entry. `native-reload.png` shows the
loading map and `reload-ready.png` restores the docks at 100 health in the same
runtime. Thus authentic native entry recovery was exercised successfully.

No save of the canal position was obtained. The reviewed in-progress Main and
Game pages expose no Save/Load item (`canal-game-menu.png`), and the original
`Base/default.cfg` and `Base/defaultkey.cfg` contain no save shortcut. Those
observations do not establish that every possible native save path is absent.
No console, configuration, map, save or guest state was edited.

## Exact recovery inputs and verification

Tested source is `0db20330ccd6761a705eea70c5dd9bfc7704c147`, with the retained
relevant binary patches. Both the live guest and owning software renderer bind
to module SHA-256
`ce57f0ad80254b974a0d8bcd4e2c9cbf396d2357cbdc7874e6084e980e1e68e1`,
2,189,363 bytes. Preparation resolves changed tracked files from that Git
commit and the module from the retained recovery store. The canonical original
media is referenced by existing paths and hashes. No source-tree or repeated
media archive was made.

All 3,377 provisioned files passed remote size/SHA checks. All 2,461 runtime
source/media/module/helper pins still matched after gameplay. The matching
locked build proof from `20261111-avp2-current-marine-encounter-0820/build-final.log`
was rehashed against `reused-build-proof.json`; no new build or production-fix
claim is made. The reused balanced-key regression passes eight checks.
Chrome 151.0.7922.108 keeps its native 780×500 full-page capture and 640×480
guest context, with the established separate software GL renderer.

All 455 artifact references / 368 unique contents (21,014,778 referenced bytes)
were recovered and raw size/SHA verified before the box stopped, then reverified
locally. `validation.json` records 43 unique PNG CRC/IDAT passes, 42 image/owner/
module bindings, 42 successful ACKs and 15 balanced finite longer actions.
The content-addressed gzip store plus `final-recovery-local-map.json` restores
the original remote paths. `local-compaction-map.json` records lossless removal
of 9,312,725 duplicate local bytes. Decisive full images remain directly viewable.

## Normal shutdown

Browser, controller and parent wrappers exit zero with actual parent waits and
both pipe EOFs. An independent check finds controller/Chrome PIDs, browser
profile and server port absent.

Box `bx_amkxynny` was created at 10:42:29 UTC with a private 45-minute lease.
The independent observable watchdog was armed before allocation with fixed
deadline **11:27:29.288 UTC**; initial service expiry was 11:27:29.579 UTC.
After verified recovery, delegated normal stop `stop_1f3a47d8a151402b` completed
at **10:57:31.085 UTC**, forced=false and error=null. A separate subsequent GET
confirms **archived**, completed stop and expiry null. The watchdog exits zero
without firing; actual wait and both EOFs are retained. No resume, delete,
additional box, worker or public deployment occurred.

Next: follow the open canal to its next exit or objective, then obtain a native
save there if the demo exposes an ordinary save path.
