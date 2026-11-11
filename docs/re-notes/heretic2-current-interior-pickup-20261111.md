# Heretic II current browser interior pickup, 2026-11-11

The original registered demo now has a conclusive interior pickup consequence:
Corvus crosses the opened stained door, traverses the furnished room, and
collects its blue health flask with ordinary movement. The native message
“HEALTH VIAL” appears, the flask disappears, and health rises from 25 to 35.
Outgoing enemy damage, a kill and campaign objective completion remain unproved.

Run: `scratch/runs/20261111-heretic2-current-outgoing-hit-objective-0840/`
(ignored). This extends the [previous browser route](heretic2-current-browser-backends-20261108.md)
without repeating backend qualification. No emulator change was necessary.

## Route and paired evidence

One software GL browser configuration was used: the ordinary registered
`heretic2_demo` entry, original `Heretic2.exe`, companions and manifest, stock
1998 clock, guest Worker and separate owning software GL render Worker.
Chrome 151.0.7922.108 uses its native headless viewport; full page PNGs are
780×500 and the guest context is 640×480. No viewport emulation, guest-state,
configuration, save, console or map editing was used.

The successful second runtime retains every numbered control ACK and full
capture in `software2/`. Game → Easy and the intro lead to the docks. Reviewed
Up/turn/strafe/jump controls reach the waterside alley and the ordinary native
“What has befallen my people?” trigger (`forward-hop.png`). The stained door
opens on approach. A blade-wielding humanoid is visible at the threshold
(`ascend-after.png`); Control attacks show effects, but occlusion prevents an
outgoing-hit claim. Health falls to 25 during the encounter.

`clear-panel-after.png` establishes passage beyond the threshold into the room;
`interior-face-after.png` shows the fireplace, logs, table, chair and pickups.
Subsequent room traversal retains full scene captures. The floating green
object remains present; neither its collection nor descent through the floor
opening was established. Failed navigation is not a collision-defect finding.

The decisive blue-flask pair is:

| Capture | Visible consequence |
| --- | --- |
| `software2/blue-walk-after.png` | Corvus beside chair, blue flask immediately to his left, health 25. |
| `software2/blue-align-after.png` | After native comma/strafe-left for 1,800 ms, “HEALTH VIAL”, flask absent, health 35. |

Both full PNGs were personally inspected. Their `*-capture.json` files bind
image hashes to the live registered app and module object; the corresponding
`*-state.json`, numbered ACKs and `blue-align-long-dispatch-*` retain identity,
trusted native key edges and finite release. This is a deeper interior resource
pickup, not a claimed campaign objective or enemy kill. The in-progress Game
menu exposed difficulty/map/objective entries but no Save/Load entry in the
reviewed menu; no authentic ordinary save was obtained.

## Exact runtime and validation

Tested main source is `0db20330ccd6761a705eea70c5dd9bfc7704c147`.
The actual recovered module is 2,189,363 bytes, SHA-256
`ce57f0ad80254b974a0d8bcd4e2c9cbf396d2357cbdc7874e6084e980e1e68e1`.
Matching locked build evidence is reused from
`20261111-avp2-current-marine-encounter-0820/build-final.log`; this task makes
no production fix or new-build claim. Exact source SHA, relevant binary diffs,
owned helpers, original media paths/hashes and recovered modules provide the
recovery inputs; no source or repeated media archive was made. All 1,825
original installed files and the browser manifest matched the retained closure.

The first controller stopped on its own unsupported number-key assertion
before that input was delivered. Its actual exit and independent PID/profile/
port absence were confirmed before the repaired controller restarted in the
same box and fixed lease. Both ordinary key helpers were repaired together;
a focused balanced-key regression passes. Other pre-dispatch observer/stale
capture refusals are retained without replay. No guest or emulator defect was
inferred from these harness failures. The successful runtime closes normally
with code zero and actual parent wait/EOF; independent checks find controller,
Chrome, profile and port absent.

## Recovery and shutdown

All 816 second-runtime artifact references / 646 unique contents (34,403,984
referenced bytes), plus the first runtime's 144 references / 120 unique
contents, were recovered and raw SHA-256/size verified before normal shutdown.
The compact content-addressed gzip store and `*-recovery-local-map.json` retain
exact original paths; `local-compaction-map.json` records lossless removal of
redundant local copies. The decisive before/after PNGs remain directly viewable.
All staged runtime/media pins still match after gameplay.

Box `bx_2cbyr9ww` was allocated at 08:34:38 UTC with a 45-minute lease.
An observable independent watchdog was armed before allocation, with immutable
deadline 09:19:37.994 UTC (initial service expiry 09:19:38.357 UTC).
After recovery, normal stop `stop_bc34ed22959d6191` completed at
09:12:47.065 UTC, forced=false and error=null. A separate subsequent GET
confirms **archived**, expiry null and completed stop. The watchdog exits zero
without firing; actual parent wait and both pipe EOFs are retained. No resume,
delete, additional box, worker or public deployment occurred.

Next gameplay work can pursue an actual enemy hit or the route beyond this
room. This result establishes the room traversal and native health pickup only.
