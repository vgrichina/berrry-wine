# Thief II: The Metal Age demo

Source: https://archive.org/details/ThiefIiTheMetalAgeDemo
Metadata artifact thief2.exe,136880529 bytes, SHA1
e812b6d8a41c7755f87e1e17bf8e7ef11a57de5a. Metadata identifies Looking Glass
Studios/Eidos demo,2000; listing contains a1999 demo payload. Private local
compatibility fixture only, no redistribution/deployment authorized.
Not in current corpus/public registry or existing task list when selected.

## Source preflight 2026-10-12 07:06Z

Evidence scratch/runs/20261012T0706Z-thief2-preflight/. Standard endpoint
initially appeared stalled. The original completed at07:10:51Z after the last status check. An unchecked
mirror retry started at07:11:03Z and overwrote that full file with partial bytes. Original download.json and
listing.txt record the earlier complete download, not current payload validity.
Current-payload.json is authoritative:59440936 bytes, SHA1
0ea8dbb7247fa7c4a022eb846dc06cee4e72d660, NOT the required complete hash.
It was renamed /home/user/thief2-demo-preflight/thief2.exe.part on bx_gqubeuhs
before stop. Check the final snapshot; a pre-rename snapshot may retain it as
thief2.exe. Rehash either file before using it. Next resume the partial from
https://ia801501.us.archive.org/21/items/ThiefIiTheMetalAgeDemo/thief2.exe
with a unique destination and no overlapping download, then verify full hash.
Use curl -C - with a sufficiently long bounded timeout after checking range
support. Never extract or qualify the partial file.

Complete-download listing shows61 files/168447241 expanded bytes, including
thf2demo/MOVIES, mission miss11.mis, readme.wri and installer components.
Next extract verified payload with7z, inspect original executable/imports and
readme, then bounded remote-only launch. No game executable extracted or
launch/input/browser/audio/FPS qualification yet. Exact missing prepared
path: /home/user/thief2-demo-preflight/game/ (not created).

## Verified resume and startup (2026-10-12 07:23Z–07:28Z)

Remote bx_vujsz54x resumes the single partial with curl -C -; no overlapping
writer. Full 136880529-byte SHA1 e812b6d8a41c7755f87e1e17bf8e7ef11a57de5a
verified, then 7z extraction succeeds. Evidence 20261012T0723Z-thief2-resume.
Original thf2demo.exe SHA256:
5e5f831ba549081c35e592afaa540f336f76c828a996b4fcb74edef46beba942.
Test build is main0304a8549 plus pending Z16 correction3a4fcf883,
module3c3a4efe77335ac8af1719f435d222fc142b330f23ae234171ad42512588fb4d.
Build gates pass. No Thief-specific emulator or executable patch.

First direct launch0725Z lacked installer-generated DARKINST.CFG, did not
open the resource archives, and called NULL from538d87 at batch36.
Adding install_path, resname_base, load_path, script_module_path all C:\,
plus movie_path C:\MOVIES, loads intrface.crf but hits integer divide by
zero (C0000094, reported block44b375) at batch93. Actual divide44b37a
uses animation frame count at object+4. Main animation list MAINM.STR names
maina/mainb/mainc/main; the last animation's MAIN_1.PCX resides under english/.
Original SETUP.ins contains all these path keys and literal language english.
Add language english to DARKINST.CFG:0728Z renders normal main menu, no
divide fault. This is installer reconstruction, not a game/code workaround.
Keep the original CRFs, MOVIES and configuration files.

Ordinary click310,240 at batch400 reaches difficulty in0729Z. Click330,238
at800 selects Play/Normal;0730Z renders The Unwelcome Guest objectives.
Menu/mission objectives are not gameplay qualification.

Registered local app thief2_demo/candidate thief2-demo is prepared remotely
(40 data files plus original executable). CLI0731Z Continue392,444 at1400
reaches loadout. A PlayMission click at2600 is too early during loading;
0735Z delays it to6000 at530,456 and reaches the textured first-person
mission with HUD, reviewed final.png. No movement in that capture.
The probe inherited a60000ms spawnSync timeout despite a90s game guard:
exit.json records ETIMEDOUT, but the child continued and ended0 at90.018s
with final PNG. Preserve that caveat; do not treat this as clean timing data.
Future probes must set the external timeout above the internal guard.
Browser0737Z uses registered local launch on main+Z16 and Chrome155, waits
for each menu state before proceeding; validation ongoing.

### Registered browser movement and mobile limitation

0737Z-thief2-browser (started07:36:23Z) on Chrome155/WebGL/workers:
ordinary menu clicks at240394,249394,290538; wait35s for loadout;
389546 PlayMission, wait45s. ArrowUp2s moves forward beyond the starting
arch; ArrowRight500ms visibly turns right. Before/walk/turn reviewed.
This is actual ordinary player-controlled gameplay. No FPS/audio assessment.

0742Z-thief2-touch displays all six controls at844x390 and dispatches actual
CDP dpad touch, but the mobile menu clicks used whole-canvas coordinates
without compensating for game letterboxing. Captures remain at main menu:
FAILED mobile navigation, not touch gameplay. Next map guest coordinates
with renderer._unmapExclusiveInputPoint plus its canvas CSS bounding rect,
then verify actual dpad displacement. Shorten Objectives label to Goals to
avoid the top-right button clipping in phone landscape. Physical device,
Safari, full actions and audio/FPS remain unverified.
Registration30014ef63 is pushed, ops main integration pending.

0750Z-touch-mapped repeats with the renderer inverse presentation transform;
still main menu. Therefore correcting coordinate mapping alone has NOT
established the cause. Next compare actual p.touchscreen taps against mouse
events under mobile emulation, capturing each menu checkpoint. No further
blind route replay. WinePerf.snapshot counters all0 in this run; instrumentation
was not enabled, so this is unavailable measurement, NOT measured0FPS.
Core keyboard gameplay remains reviewable; mobile/audio/FPS have a separate
ready follow-up. Goals label change e2c8bd4cd pushed; debug close overlay still
overlaps top-right control in debug mode.

## Integration reconciliation, 2026-10-13

Recovered from `origin/codex/wsasocket-capability` at `15b37458e` during the
release merge audit. The local-only registration and its required runtime fixes
are now on main. Earlier statements that integration is pending describe the
historical run, not the current branch. This recovery adds no fresh gameplay,
audio, performance, Safari, or physical-device qualification; retain the
recorded run IDs, module hashes, limitations, and failed attempts above.


## Native interaction attempt, 2026-11-01

Run `scratch/runs/20261101-thief2-native-interaction/` did **not** establish
opening a door, taking loot, or visible objective progress. One native original
reached Normal / The Unwelcome Guest, then stopped at the first attempted-route
navigation blocker: the nearby torch-side barred window above a raised stone
sill. No reachable door or loot item was identified; no use/attack was attempted
against the window. Other routes remain untested; no emulator-defect finding.
No second original was launched.

Original `readme.wri` and unchanged `DARK.BND` / `user.bnd` document right mouse
as `+use_item`, left mouse as `+use_weapon`, S walking, Up running, M map, and
F4/F5 lockpick selection. The readme says to approach a highlighted door and
hold right mouse to pick its lock. Highlight alone would not establish opening.
The reconstructed `DARKINST.CFG` and registered defaults were preserved.

The coordinator explicitly overrode the interrupted Quake II launcher gate at
12:53:34Z after original exit 0 and four absent PIDs. ACK at 12:54:36Z set the
13:19:36Z runtime deadline. Actual gate/source main was
`90aa4059d818f50185ae5724a945f3b3de34f77b`, rather than dispatch `f581e849f`.
All 4,392 accepted source pins and 141 accepted read pins matched; reused module
SHA256 `dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`
also matched actual runtime-compiled bytes. Before original use the observer
passed actual sync/async execution, whole shared 512 MB read-only comparison,
clock identity and emitted late-10001 retention. The run's 4,444 source/module
pins, 41 fixture files plus registered manifest and recovery inventory, full
fixture tree and 142 observed runtime reads remained unchanged. EXE SHA256
matched `5e5f831ba549081c35e592afaa540f336f76c828a996b4fcb74edef46beba942`.
Observer coverage is string-path readFileSync/readFile/promises.readFile,
not exhaustive descriptor/OS I/O or compiler-source provenance.

Native CLI used 100,000-block batches, registered-default 200 ms/batch guest
clock, software rendering, frozen stdin control, a 1,300-second internal guard
and longer 1,380-second outer allowance bounded by the gate deadline. Menu,
Normal, objectives, loadout (batch 2400), and world/HUD (3500) were inspected.
Browser milliseconds were not replayed as native batches. Captures sometimes
preceded consumption/presentation: the map became visible at 4376 after its key
at 4085. The initial five-batch turn release was still queued at 3535; another
turn was issued before it drained, so early captures do not isolate those turns.
Later controls used longer settling. All 20 keyboard edges / ten balanced pairs
ultimately dequeued, routed and dispatched to HWND 0x10001. Final known queues
were empty; guest post queue unknown. No interaction-button consumption claim.

Before/held/released/settled captures document approach to the window. Neutral
batches 5431–5631 retained identical sampled window, sill, floor and HUD pixels;
torch/snow animation is not interaction progress. All 61 PNGs passed CRC/deflate
checks, full compressed runtime log decoded, and focused identity/input/evidence
checks passed. PID 3671463 exited 0 after 366.488 seconds at batch 5631 without
external timeout. Runtime disk minimum was 2,038,202,368 bytes; no RAM gate.
Native local box ID/state/expiry N/A; local shutdown explicitly delegated.
No audio, FPS, GPU, browser or full-suite qualification is added.

## Automated recovery, 2026-10-14

Fresh acquisition from https://archive.org/download/ThiefIiTheMetalAgeDemo/thief2.exe verified SHA1 e812b6d8a41c7755f87e1e17bf8e7ef11a57de5a (metadata size136880529). Extract with7-Zip23.01 and copy archive/thf2demo/ to game/, then write documented DARKINST.CFG: install_path,resname_base,load_path,script_module_path each C:\; movie_path C:\MOVIES; language english. This file is reconstructed installer state, not original installer output.

Run `node tools/fetch-candidate-corpus.js --id=thief2-demo`, then `node test/test-thief2-recovery.js` on the pristine recovery. The41-file inventory test/candidate-corpus/thief2-demo-files.json pins paths,sizes,SHA256 and labels DARKINST.CFG reconstructed. All other files matched extracted source bytes; thf2demo.exe matches its prior recorded hash. Comparison with restored fixture differed at: none. Runtime-written settings may differ after playing; no new gameplay or audio/FPS qualification is claimed. Existing private-fixture restrictions unchanged; no public deployment.
