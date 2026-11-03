# Alice demo: early thermal approach stopped before jump (2026-11-03)

The sole original native New Game / Easy attempt completed the natural opening
and first village gnome sequence, then stopped at the rising plank approach.
The final personally reviewed release capture, `approach_w4_2.png` at41352,
places Alice along the plank's left side; recognizable supported footing on the
narrow board is not established. No further simulation credits were sent.
**W+Space was never pressed.** Thermal contact, lift, lateral exit, fall,
submersion and a south landing therefore remain unresolved. Knife ownership,
attack effects and identified target damage remain untested. This is a bounded
navigation/footing blocker, not evidence of an emulator acceleration defect.

Evidence, command log, personal visual-review ledger and recovery instructions
are retained in `scratch/runs/20261103-alice-thermal-entry/`. The static input was
`8d1c578c84279ced51876cb045ee660badcb034b`; all37 released diagnosis payloads
and6054 predecessor payloads passed fresh fullSHA checks. No predecessor boat
was operated. Original15 files and exact14 companion mappings were preserved.

## What the attempt observed

| Capture / controller batch | Personally reviewed observation |
|---|---|
|`menu_load.png` /13208|Readable New Game menu; ordinary Enter selected it. An earlier attempted Enter during a dark menu transition left its capture unchanged.|
|`difficulty_load.png` /13624|Easy highlighted, then selected with ordinary key down/up.|
|`opening_1.png`–`opening_18.png`|Pandemonium load, title/corridor story sequence, Alice/Rabbit/Cat scenes, Dementia load and cave arrival, with all keys released. No cinematic skip.|
|`opening_19.png` /36464|Normal HUD and Alice standing on the cave path; opening complete.|
|`gnome_entry.png` /38680|Natural gnome/steam crossing cinematic triggered through the west timber route.|
|`gnome_natural_2.png` /41080|Dialogue finished; side HUD returned.|
|`align_axis4.png` /41338|Alice on broad timber platform; plank length nearly aligned ahead. Exact player coordinates were not measured.|
|`approach_w8_1.png` /41346|Released after W8; visibly closer to plank base, still on broad timber lip.|
|`plank_left2.png` /41348|Released after a two-credit left correction; narrow plank close to Alice's centerline in view.|
|`approach_w4_2.png` /41352|Released after W4; Alice along left side of rising board. Recognizable narrow-board footing not established; immediate stop.|

Doorway contact and heading corrections consumed substantial time and commands.
The first right strafe placed Alice against the opposite jamb; a later reviewed
left strafe cleared it. Near the thermal, short arrow/mouse transactions sometimes
produced identical captures, followed by changed views during neutral execution.
Immediate release captures do not prove the original guest had already sampled
that release. No precise input-to-motion timing or engine defect is inferred.
The complete chronological ledger retains initial review mistakes and explicit
corrections, including the early unreadable-menu frame.

The launcher initially used10000 instructions per controller batch. At41306,
while Alice was on the broad supported platform, the ordinary host command
`set-batch-size:100000` restored the launcher's usual instruction budget.
The first neutral capture after this change was41308. Frozen tick200ms and the
immutable deadline stayed unchanged. Final W8/W4 approach observations used
100000. **Credits are not measured simulation seconds**, and captures across
these budgets do not establish equal durations or distances. The initial
crossing counter remained0: the prescribed first W+Space/two-held-credit
observation and32-held/64-total caps were never entered. No80-credit blind
neutral wait was used at the thermal approach, and no jump or retry followed
uncertain footing.

The static landmark remains the narrow plank centerline x=-5074, southward
along decreasing y toward the steam. Its nose is y5152, top z=-88; original
thermal bounds are x[-5192,-4984], y[5020,5132], z[-320,96]. Original speed-1
refreshes thermal state and temporarily multiplies gravity by-0.25; it does not
set a fixed upward impulse. These are the published static findings, not a
measurement of Alice's position or contact in this attempt.

## Tested identity and limits

Fresh committed main `16948c36fb0e13240a90998b2ec6b5fc4380b89a` was streamed
from Git blobs, excluding foreign WIP. All5848 sealed source/support files were
verified before launch. A recursive literal dependency preflight derived from
the committed launcher/modules resolved its complete relative-import closure,
including `tools/disasm`; all committed runtime directories were additionally
staged as a support superset for dynamic loads. The original local app metadata
was registered only in the host process. No guest, config, registry or asset
mutation, tracing flags, browser, shortcut, synthetic save or cinematic skip
was used.

The boat-side locked `flock /tmp/wine-build.lock bash tools/build.sh` passed.
`test-keyboard-message-lparam`, `test-control-stdin-frozen-cli` and
`test-cli-di-mouse-control` passed before campaign launch. The latter two first
reported SKIP for missing Minesweeper support; its pinned fixture binary was
then staged and both were rerun successfully. Those initial SKIPs remain in the
logs. A preflight helper initially mistook a commented require example for an
import; only the owned helper was corrected before launch. An earlier partial
source upload was rejected by its hash guard when a task helper changed; a fresh
sealed stream succeeded before any game launch. No unrelated fixture or
production source was repaired.

The actual compiled **and instantiated** module is2088037 bytes, SHA256
`1f39572325be5251c4b9a923e83d4ea9ff33962d4d3e7911a4835df20cf0ae7e`.
The one process ran13:11:38.093–13:39:25.435 UTC, ordinary-stop exit0 after
1667.342 seconds, with353 commands including quit. Its immutable guest deadline
was13:41:38.093, outer deadline13:42:38.093; neither changed. Final fullSHA audit
checks the5866 runtime pins, original15/exact14 mappings and absence of scoped
helpers. All evidence is recovered locally before delegated normal boat stop;
archive verification and STOPPED lifecycle receipt are retained in the run.
The archive is54313125 bytes, SHA256
`80435f975294e69e1a2c17e5190ec1d0f793ba4d7906ef3c16b89cba10b563c1`;
all6162 payloads passed fullSHA locally before stop. Boat stop completed
13:42:31.139 UTC, `error:null`, `forced:false`, with a retained snapshot.

Own new boat `bx_hu45hbhf` had original expiry2026-11-03T15:05:58.649Z and
shutdown owner `alice-thermal-entry`, both recorded before use. Only this boat's
normal stop was explicitly delegated by the original task, after recovered
fullSHA evidence and absent scoped helpers. No additional campaign or worker
reuse is authorized. A separately authorized next attempt should establish
plank-center footing with fewer doorway/heading corrections before attempting
the same early thermal observations; natural knife-route progress still depends
on a visibly reviewed south landing.
