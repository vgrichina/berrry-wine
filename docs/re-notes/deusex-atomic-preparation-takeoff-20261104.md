# Deus Ex: atomic transport validated; original route guard withholds takeoff

Atomic command publication works in this bounded runtime: fourteen sequential
requests ACK without partial JSON, missing startup ACK, pending-request overlap,
or command failure. One native count14 Load restores the exact original Small0
position. Measured short preparation remains supported, but the original
geometric route guard fails before forward input. **No forward run or jump is
issued; Z96 remains unproven.** No retry, reload, subsequent adjustment or save
follows that safety failure.

Evidence: `scratch/runs/20261104-deusex-atomic-preparation-takeoff/`.
Predecessor: `deusex-preparation-readiness-timing-20261104.md`, commit
`e696e01be3c6fe226a582d2a6020e904857ebb22`; its predecessor task and original
short-runup, native-speed and aligned-jump notes were read before execution.

## Preflight and immutable runtime

Assigned bx_a9uvp4n2 was verified and board-ACKed before use: RUNNING/APIidle,
health ok, hydrated true, expiry `2026-11-04T03:35:26.275Z`. Coordinator owns
shutdown; no allocation, resume, stop or delete. All Chrome/game execution stayed
on that box; there was no local heavy runtime or production repair/build.

The predecessor's run-only queue_io.py fsync/atomic-rename fix is reused. A new
startup-ready prerequisite prevents publishing before ready.json. The sender
waits boundedly for that startup acknowledgement and requires each preceding
successful terminal receipt. Existing fourteen timing/readiness/support cases
and three queue tests pass locally and remotely before Chrome. Three additional
sequencing cases cover absent startup ACK, attempted advance while startup is
pending, and successful prior ACK permitting the next request. Nine JS helpers
pass syntax checks; actual Puppeteer/Chrome dependencies and the native-export
mock pass. Mock export bytes are separate from real saves.

All453 runtime pins match before and after execution. Historical source remains
`a504fa248caaecbbb042b65e9ae5384a340ade26` plus the authoritative nine-file
historical-source.patch, SHA256
`9415aea6dbced13143b9dcdceb9d2d3594219a467263f7b3cf2bb623da36c796`.
Actual canonical module is1,898,260 bytes, SHA256
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`.
Historical second module is **ABSENT**; no substitution or rebuild. Original
SoftDrv and three original guest workers remain. Exact current Git SHA, relevant
binary diff and owned new-file patches are retained; Git is the source archive.
Media remain at existing paths with full manifest hashes, without evidence copies.

The immutable input remains
`scratch/runs/20261104-deusex-small0-reload-onward/recovered/native-save-export/`:
saveinfo SHA256 `4cfa57f28a079c1b0bcc0f4a002b24f845005122adf3d5ed39f04cd2fc2ba2a6`,
training SHA256 `ab8b1fa27157a6dc6f6e9a000acab0082f02be3c7478a7f982c27eab2759a730`.
Both hashes remain unchanged. Earlier count15 lower wood is not input. Original
BSP target Brush1765/node8270 remains topZ96, X7024–7088/Y−1872–−1808;
tall front/east nodes8301/8305 and radius-expanded boundaries are unchanged.

## Measured preparation and first safety failure

Inspected02-count14-dialog.png shows count14/time01:17:23. A single ordinary
Enter loads it. Inspected04-restored.png shows the crate room, gameplay HUD and
inventory without LOADING. Native reads restore
`(7026.704590,-1707.887939,109.602844)`, yaw250640, Physics1, BaseSmall0,
height43, zero velocity and healthy standing running state. The driver explicitly
records inspected visual approval and rechecks native settled support.

Ten sequential, individually measured adjustments use strict settled Physics1,
BaseCrateUnbreakableSmall0 and positive radial margin guards before and after
each released pulse. Directions/durations are chosen from each measured position,
not a replayed historical pulse sequence. Requested holds are20–40ms; trusted
holds are21–43ms, independently recorded from28–45ms operation overhead. One
Left40 and one Down30 produce no displacement. Their results are retained; the
next adjustments use the actual unchanged position and remaining offset.

Preparation reaches `(7003.402832,-1702.310059,109.602844)`, settled on Small0,
with24.197760 units radial margin. Two ordinary c pulses, requested20 and30ms,
measure21 and31ms trusted hold but leave yaw250640 unchanged. No native turn is
claimed and no cause for the unchanged yaw is established. The inspected prepared
capture still shows supported gameplay. All basic/reflected history remains
Physics1, with all reflected Base samples Small0.

The inherited single-attempt helper is invoked only after request13 ACK. Its
original read-only support and geometric guards execute before any input. At
the measured position/bearing, direction is `(0.450981,-0.892534)`;
projected X at tall-front Y−1772 is7038.615893, below original required7047.
Projected X at target-near Y−1808 is7056.806039. It records
`Error: geometric route guard`, actions empty and jumpIssued false. This is the
first live safety failure. The145ms runup and eight-unit pre-Space guard are
never reached. No further gameplay command follows; request14 only closes.

No guest writes, console/cheat commands, config/executable/game-check changes,
native save/export or fresh Load occur. Target/time conditions for saving were
not met. There is no floor/lower-wood progress, FPS, full-game or guest-exit claim.

## Verification and handoff

All65 preclose files and the actual canonical module are recovered and full-hash
verified before normal close. Final70 files also pass size/SHA checks; fourteen
requests ACK in sequence, maximum6 steps, and all30 trusted input events balance.
No ArrowUp or Space event exists. Final held keys are empty. An offline checker
initially expected22 pulse records instead of the actual20; that failure is
preserved, its counting error corrected, and the focused checker passes without
runtime repetition.

Browser segment is190.299seconds, below8minutes. Cleanup completes
`2026-11-04T03:19:12.713Z`: Chrome21558/driver21550 absent, port8123 closed,
browser/helpers recovered and closed before03:25Z. Box bx_a9uvp4n2 remains
RUNNING/APIidle, healthy and hydrated, expiry03:35:26.275Z, handed back to the
coordinator for shutdown. This single task stops. Any future authorized attempt
must establish a measured bearing satisfying the unchanged original route guard
before forward input; this run does not establish an earlier supported takeoff.
