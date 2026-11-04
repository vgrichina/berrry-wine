# Deus Ex: safe short preparation, runup guard stops before jump

The farther Z96 wood remains **unreached**. Short released adjustments safely
create 23.891 units of Small0 support margin. The subsequent forward run reaches
the conservative pre-jump guard with only 2.736 units remaining; Space is withheld.
Releasing forward does not stop momentum before the support edge, and the player
falls to the floor. This is another **support loss before jump**, with zero jumps
issued. No reload, retry, further traversal or save follows. The original immutable
count14 pair is unchanged. This result does not establish that a safe jump route
is impossible; an earlier takeoff on this bearing remains untested.

Evidence: `scratch/runs/20261104-deusex-supported-short-runup/`.
Input notes: `deusex-small0-aligned-jump-20261104.md` at
`2e802c7dfbb41dec726b7e69d580aba316cc48d2`, and
`deusex-small0-native-speed-20261104.md`.

## Inputs and preflight

Assigned bx_2t2b9xah was verified RUNNING/APIidle, healthy and hydrated, expiry
2026-11-04T03:02:57.823Z, coordinator shutdown ownership, and ACKed before use.
The initial board ACK accidentally used a future literal timestamp; an append-only
correction records the actual 02:48:15Z check. No allocation/resume/stop/delete.
All heavy execution stayed on that box. Historical source remains
`a504fa248caaecbbb042b65e9ae5384a340ade26` plus authoritative nine-file patch
`scratch/runs/20261104-deusex-supported-stack/historical-source.patch`, SHA256
`9415aea6dbced13143b9dcdceb9d2d3594219a467263f7b3cf2bb623da36c796`.
All451 inherited runtime pins matched before and after execution.
Actual canonical module SHA256:
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`,
1,898,260 bytes, recovered and verified. **Historical second module ABSENT**;
no substitute/rebuild. Original SoftDrv and three original guest workers retained.

Driver, observers, movement reader and native exporter passed syntax checks;
actual puppeteer and Chrome existed. A mocked native-export connection wrote two
byte-exact hashed outputs before Chrome, stored separately from real saves.
An initial local config lookup used the wrong inherited directory; its failure
is retained, and the actual original-configs.json reference was read. No guest
input resulted from that lookup. Original config maps C=TurnRight, Z=TurnLeft.

Exact current Git SHA and relevant binary diff are in source-record.json and
current-relevant-tracked.patch. Owned new note patch is retained separately.
Existing game-media paths/hashes are referenced by provision-manifest.json;
no source archives or media copies were made.

Immutable input directory:
`scratch/runs/20261104-deusex-small0-reload-onward/recovered/native-save-export/`.
Saveinfo SHA256
`4cfa57f28a079c1b0bcc0f4a002b24f845005122adf3d5ed39f04cd2fc2ba2a6`;
Training SHA256
`ab8b1fa27157a6dc6f6e9a000acab0082f02be3c7478a7f982c27eab2759a730`.
Both bytes were rechecked after execution. Prior count15 lower wood was not input.

## Support geometry and actual preparation

Read-only original BSP reference:
`scratch/runs/20261031T1134Z-deusex-grounded/map-bsp.json.gz`, SHA256
`4a7c95d97d44d9c85839805f7bce5028e0c4d6ba7e6f582e2f1a95dd440448d0`.
Original nodes8270/8301/8305 are extracted in original-bsp-faces.json.
Target Brush1765 is X7024–7088,Y−1872–−1808,topZ96. Tall Brush1733 is
X6960–7024,Y−1856–−1792,topZ160. Player radius20 expands its front to
Y−1772 and east to X7044. These are route geometry, not observed collision IDs.

Inspected02 shows count14/time01:17:23. Ordinary Enter restores exact location
`(7026.704590,-1707.887939,109.602844)`, yaw250640, Physics1, zero velocity,
height43 and BaseCrateUnbreakableSmall0. Small0 center is
`(6985.179199,-1700.615601,49.350189)`, radius22.5; combined radius42.5.
Initial horizontal center distance42.157384 leaves only0.342616 support margin.

Five ArrowLeft40ms pulses, then four ArrowDown40ms pulses, each released and
settled before the next, reach `(7003.777832,-1701.234131,109.602844)`.
One Left pulse produces no displacement; the actual sampled position is used.
Each adjustment has a read-only Physics guard; native reflected BaseSmall0 and
zero velocity are checked between subsequent pulses. All preparation samples
remain grounded. C20ms, released, changes yaw to251561 without translation.
The10 measured helper adjustment durations are24–45ms; browser trusted event
holds are22–43ms. There is no250ms retreat.

The resulting radial support margin is23.891085. Bearing unit vector is
`(0.527932,-0.849287)`. Its projected centerline crosses inflated tall-front
Y−1772 atX7047.7672 (3.7672 east of X7044), and target-near Y−1808 atX7070.1455.
This is a geometric candidate only. Inspected07 shows supported preparation.

## First runup guard failure and stop

A single helper connects to the existing browser and uses ordinary trusted
controls. It validates Base/Physics and the candidate line before pressing Up.
After180ms forward, a read-only check still finds Physics1/BaseSmall0 at
`(7017.654785,-1723.561279,109.602844)`, velocity
`(108.214630,-174.108551,0)` (speed204.99). Remaining radial margin2.736099
is below the helper's3-unit guard, so it records `runup margin below3`, withholds
Space and releases Up in finally. Browser measured forward hold184ms. The
failure is preserved in single-jump.json and single-jump-transport.json.

The release coasts beyond the edge: first sampled Physics2/BaseNULL is at
`(7020.425293,-1728.018066,109.602844)`, distance44.645070>42.5, zero Vz and
zero acceleration. No airborne sample has positive Vz. This support loss occurs
before reaching tall wood's inflated Y−1772 front; a tall-wood collision is not
the blocker observed here. The limiting geometry is the circular support edge
and the remaining stopping distance after the guarded run. The180ms choice was
too late for the conservative abort to preserve support. Short released setup
was safe; the continuous runup was not safely abortable at that guard.

Final settled state is `(7039.890625,-1759.343994,15.800000)`, Physics1,
BaseLevelInfo0, velocity0. Inspected08 shows the floor. No Space event exists.
No further input except cleanup follows. No new checkpoint was worth retaining:
the final floor state is below the target and loses the supported setup, so no
native save/export was requested. Original count14 remains the recovery input.

## Verification and handoff

Focused checks pass: all71 unique recovered files match full hashes; canonical
module recovered; all451 runtime pins and original checkpoint bytes unchanged;
15 sequential driver requests complete and ACK, maximum6 steps; separate guarded
run helper terminates with its documented guard failure. All32 trusted browser
events balance, final held keys empty. The single browser segment is149.636s.
No executable/config/check or production-code changes, and no build was needed.

Chrome30455/driver30447 absent, port8123closed, cleanup02:51:30.285Z; recovery
completed before02:56Z. Box remains RUNNING/APIidle, healthy, expiry03:02:57.823Z,
shutdownOwner=coordinator. No FPS/full-game/guest-exit claim. This single task
stops; any earlier guarded takeoff needs a separately assigned task from count14.
