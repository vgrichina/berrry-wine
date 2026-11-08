# Darkstone: nine-victory restore and onward road to ruined stone walls

Restored the exact nine-victory checkpoint through native **Load a Game** and
followed reviewed visible ground beyond the hollow, along the forest road,
through the large-tree junction and onward to newly revealed broken stone walls.
The native map visibly records the explored branching corridor. This is new
reviewed route exploration, but the requested saved continuation is **incomplete**:
the immutable browser deadline interrupted the final Save a Game command before
its capture/ACK. No New Save was issued or recovered. Do not replay that command
or infer that the explored route was saved.

Evidence is ignored `scratch/runs/20261108-darkstone-nine-onward/` (R).
Predecessor: [nine-victory checkpoint](darkstone-hollow-onward-20261108.md),
`da5d9514c`. No production source changed and no production build is claimed.

## Restore and visible route consequence

Both predecessor artifacts and staged inputs remain byte-identical:

| Native input | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,164 | `ba2c2c5fcbe8111c8ece302a3020c9ebe0793d2d0789b0a208b7bc388b7f74ea` |
| `game641d_6af070ba.sav` | 3,204,341 | `b56122d3ed4552f35c0e0df4cd1785d2d43b4fbedfcff8226d1792a05334c235` |

Personally reviewed R/review captures establish:

- `native-nine-slot.png`: sole native preview matches the new clearing, hollow
  lower-left, pale road above and retained red vial. Native OK restored it.
- `restored-nine-clearing.png`: load was still in progress, with a release queued.
  No movement followed. `restored-live-drained.png` subsequently matched the
  clearing and recorded buttons zero and queue EMPTY before movement.
- `baseline-nine-settled.png`: **9+0 victories / LIFE 19/35 / Gold 1532 /
  Food 58 / MANA 25/25**, red vial retained. The first I capture was still world;
  passive capture revealed the panel without replaying I.
- `road-east-bend.png` through `narrow-path-ahead.png`: visible road followed
  along the forest to a narrow wooded end. Pointer-only `path-end-native-hover`
  gave no entrance label. The route returned toward the junction.
- `ordinary-map-review.png`: ordinary Tab revealed the explored branching
  corridor. It contained no named entrance text; Tab closed it before movement.
- `lower-road-clear-bend.png`, `stonewall-road-onward.png`,
  `stonewall-opening-approach.png`, `ruined-wall-clear-ground.png`: further road
  travel revealed low stone walls, broken corners and a nearby brown recessed
  object. `native-object-by-wall.png` did not establish an object name. No object
  activation or hostile click followed. The recess is **not identified as an
  entrance or chest**.
- `new-road-counters.png`: **9+0 / LIFE 19/35 / Gold 1532 / Food 46 /
  MANA 25/25**, red vial retained after travel. `new-road-save-ready.png` shows
  the living hero beside the ruined walls and recess.

All movement holds were at most 2,000 ms, with independently armed releases.
No living hostile target was established and no hostile input was used. No human
attack, panel-pause assumption, private handler, guest write, forced scene,
configuration, clock or seed change was used. Location remained **Land of Ardyl**;
no named entrance, area transition, quest, combat, audio or FPS result is claimed.

## Deadline failure and recovery boundary

Escape opened the native menu; its immediate capture still showed world.
`native-save-menu-settled.png` subsequently showed **Save a Game**. Command 63,
`open-save-slots`, dispatched a reviewed ordinary click at 13:23:29.149 UTC;
DOWN and independently scheduled UP both acknowledged by 13:23:29.252.
The immutable runtime cap fired at **13:23:29.615**, before the requested capture
and command reply. Chrome exited **0 / no signal** at **13:23:30.045**.
The command is sticky **UNKNOWN**, retained in first-failure, first-browser-failure
and transport-closed records; it was never replayed. This is a harness deadline
collision, not evidence of a guest trap. No New Save selection occurred and no
read-only Darkstone VFS save recovery was possible after closure. The generic
close helper's `native-saves.json` is empty and does not prove save absence.

The concrete blocker is preservation of the newly explored route under that
fixed deadline. The original nine-victory recovery pair remains the restart
point. A next run should reserve substantially more time for menu settling,
New Save, read-only VFS recovery and retrieval; the deadline must remain immutable.
Do not resume this box or replay its unknown command. No second original was used.

## Providers, checks and containment

The **532 inherited exact pins** were adapted to this run; adding the owned
preflight verifier made **533 executing pins**, retaining runtime source
`90c1fcfee91c4680877083e80498afcb73c9384d`. Exact ignored original/compat providers
use R/provider-recovery.json, with no ignored-binary Git fallback or shared build
overwrite. Original module SHA-256 is
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
Seven accepted controls, native hover, startup queue and subreaper/reaper were
reused without standalone reruns. Helpers passed syntax checks. Peer WIP was
excluded from executing providers. Git SHA, relevant binary diff, small owned
helper patches and existing media paths/hashes are recorded; no archives made.

Before allocation, normal production manifest resolution, actual
`WineAssembly.loadFiles`, VFS hashes and native SAV enumeration passed.
R/manifest-derived-pin.json derives the new HTTP pin directly from
`provision.cjs.bytes`: **1,234 bytes**, SHA-256
`ff014ed37782f8c38eeb5dfe20aabf97a263f17b33511ab235f08414a3f08ee6`.
All remote pins passed before Chrome and remained unchanged at exit.

One UUID-idempotent box **bx_kmajkaur** was identified before runtime. Its own
remote lock/subreaper covered provisioning, startup, runtime and descendant drain.
All **28 exact PID/start identities**, including bootstrap, Chrome/crashpad,
adopted descendants and custodian, drained without a descendant exemption.
Endpoints/ports closed, profile/writer absent, held input empty and remote lock
free. Observer transport exited zero before stop. Local runtime lock was never
held; launch free disk exceeded 5 GB. No old box, resume, delete, deployment or
subworker was used.

R/final-audit.json records successful evidence checks separately from incomplete
task status and retains the final UNKNOWN: **63 exact command ACKs, one UNKNOWN, 58
independent pulses, 169 trusted events and 64 PNG CRC/scanline decodes**. All **726 references / 636,936,613
bytes**, representing **598 unique contents / 636,915,106 bytes**, were retrieved
and independently reread/hash-verified **before** normal stop. Earlier failures
and all captures/custody history remain retained.

The observable independent 25-minute watchdog and normal-stop supervisor were
armed before creation. Immutable browser/overall/cleanup deadlines are retained.
Normal stop **stop_ef9f58e7dd7e0010** completed **13:24:53.108 UTC**,
`forced:false`, error null. Final state **archived**, stopped **13:24:53.088**,
expiry null; R/stop-receipt.json records confirmation. Normal/watchdog exited
zero, supervisor children empty, local lifecycle PIDs absent.

Next: restart from the untouched nine-victory inputs, follow the explored road
toward the ruined walls, identify any entrance/object by native review, and
complete native New Save with an earlier finalization reserve. Full27, parity,
audio and FPS remain open. Single-task worker stops after publication.
