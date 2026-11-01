# Urban Chaos demo

Source https://archive.org/details/urbanchaos, urbanchaos.zip26,328,920bytes,
SHA1 ba06b6ca040359ac07dd60ca75d680c9f2b5d15c verified after resumed download
2026-10-12 05:10Z. Public endpoint returned500; direct endpoint
https://ia601406.us.archive.org/34/items/urbanchaos/urbanchaos.zip resumed the
partial8.9MB file. Evidence0504Z preflight and0509Z recovery under scratch/runs/.

ZIP contains Demo.exe26,397,184bytes (WinZip SFX) and readme.rtf. 7z extracts
387files; unshield extracts752files from installer/data1.cab. Flatten the three
groups Global_Media, Local_Media_-_English, Program_Files into game/, preserving
relative paths. Also copy ALL three installer directories clumps, data, talk2.
Fallen.ex_ is already PE32, not compressed; copy as Fallen.exe without modifying
bytes. Executable SHA256 8cc73044e19b423ef0f13858d8cb3bb3025ca023114cf87ff46c57838f4b2229.
Remote assets /home/user/urban-chaos-demo-preflight on bx_44dwy4jt snapshot.

## Installer configuration is required

0512Z first run omitted clumps and config.ini, and displayed Cannot locate Urban
Chaos CD-ROM. Trace reads D:/clumps/mib.txc after LocalInstall defaults0. The
installer script explicitly writes config.ini sections Game, LocalInstall and
TextureClumps: keys language, textures, sfx, speech, movies, enable_clumps.
setup-config.log records original script offsets; enable_clumps is literal1.
For a full local extraction, reconstructed config uses LocalInstall entries1,
TextureClumps enable_clumps1, and Game language=text/lang_english.txt (use Windows
backslash in actual INI). No guest or emulator code changed, no media fabricated.

0514Z with local files/settings passes media lookup and opens graphics/audio
setup, but initial language=0 causes missing-language labels. The actual English
file is already present at text/lang_english.txt; Game.language is a path, not a
language number.0516Z corrected config renders legible settings: primary3Dcard,
16-bit colour,640x480, MicrosoftDirectSound3Dhardware by default. Screenshots
reviewed. Setup Okay is ordinary graphics/audio selection, not a licence dialog.

Module SHA256 9e835f75dfe5d2fcfb91f592641e945f91baadcd20f6751460777f4dba888cd6; remote build PASS. This is the retained test
branch build, not a claim of testing clean main. Main0304a8549 integration remains
ops-owned. ole32.dll real-file warning retained; no ordinal trap seen so far.
Readme documents arrow movement/turn, Space jump, Enter enter vehicles; further
controls and gameplay/browser/touch/audio/FPS still unverified.


0517Z-settings: ordinary click275,445 at100 accepts the displayed graphics/audio
settings and reaches the Urban Chaos Official Demo Press Any Key screen.
Reviewed640x480 capture, exit0 at40-second bound/583batches. No licence question
was displayed or answered. Ordinary menu navigation is the next test.


0518Z character-only keypress13 at200 leaves title unchanged.0519Z normal
keydown13 at200/up230 advances to mission map (Urban Chaos Demo marker/Start).
Reviewed screenshot, exit0 at40s/2441batches. This was input semantics, not a
proven emulator input bug; use held keys for this game. Next Start on mission map.


0520Z: add Enter down500/up530 to reach demo mission briefing (objective:
eliminate/arrest targets and save hostages). Reviewed image, exit0 at60s/2141batches.
No gameplay qualification yet. Next held Enter after the briefing is visible.


0521Z: add Enter down800/up830 to enter a rendered3D mission opening/camera
sequence. Reviewed rain/street/building scene with objective caption and speaker
portrait, exit0 at80s/2131batches. This is level rendering, not yet player input.
0509Z prepared-files.json records1122files/40,299,202bytes including reconstructed
config.ini, plus the original readme.rtf. Original game file bytes unchanged.


0523Z add Enter2200..2230: final2330/120seconds shows D'arci in the player scene,
radar/health/4-minute countdown HUD visible. Planned2450 screenshot and2500
movement never execute before the time bound; before.png is therefore absent,
not missing transfer evidence.0526Z earlier2250 capture is STILL cinematic;
Up2260..2290 happens before the playable HUD. Final2350/124.6seconds shows the
same starting position as0523Z, so no player movement is verified. These two
runs establish transition to the playable scene, not successful input.

Next use control-stdin or browser HUD-gated input (not another guessed early
batch), then reviewed displacement/control comparison. Registration, browser,
touch, audio/FPS remain unqualified. No known missing payload after full1122-file
layout; config is reconstructed from installer strings and successful behavior,
not a captured completed installation. No source/emulator/binary changes.


## 2026-10-12 05:37Z live HUD-gated movement

Evidence scratch/runs/20261012T0537Z-urban-chaos-live. Same module/executable
hashes as above; remote build passed. CLI --control=8123 --frozen reaches batch
2370 using the documented menu route. Reviewed before.png shows D'arci on the
street with radar/health and3:58 timer. Only after reviewing that capture, queued
keydown38, stepped110 batches, queued keyup38 and stepped10 more. after-up.png
shows D'arci running into the car park past the alley, timer3:56: ordinary player
movement verified. Control replies confirm batches2370->2490; explicit quit exits0.
Frozen stepping is a diagnostic route, not a browser performance measurement.
The module was available when the runner loaded it; build finished shortly after
runner launch. The recorded post-build hash matches prior tested module9e835f75.

Added local-only urban_chaos_demo / urban-chaos-demo registration on the separate
codex/dr2-registration branch. Remote --prepare passes1121 data files, including
config.ini; executable is separate. Initial preparation used the wrong fixture
root demo-installers and failed clearly; corrected root is test/binaries/candidates.
Static syntax/manifest/local-only checks pass. Browser launch/touch and audio/FPS
are still pending; no public desktop entry or deployment.

Exact reconstructed config.ini (Windows path separator):

```ini
[Game]
language=text\lang_english.txt
[LocalInstall]
textures=1
sfx=1
speech=1
movies=1
[TextureClumps]
enable_clumps=1
```


## Registered Chromium gameplay and touch (2026-10-12 05:50Z)

0550Z-urban-chaos-browser: Chrome155.0.8059.39/WebGL/worker threads, module
9e835f75..8cd6, registered urban_chaos_demo. Ordinary setup Okay, held Enter
through title/map/briefing reaches player HUD (step4). ArrowUp3seconds moves
D'arci toward the alley confrontation (step5). At844x390, real CDP touch on the
direction pad held upward7seconds advances D'arci farther into the alley
(step6 before, step7 after). All images reviewed, stage complete05:54Z.
No source fix required. Buttons fit at844x390; other action bindings, physical
phone/Safari, audio and FPS are not qualified. AudioContext autoplay warnings
remain in run.log; no claim of working sound.

Initial0549Z attempt never launched: server rejects out-of-checkout fixture
symlinks. Original payload existed, but game/ linked to a custom remote directory.
Copied original files into test/binaries/candidates/urban-chaos-demo/game and
replayed as0550Z; do not weaken server containment checks. Keep real files inside
the served checkout for browser preparation. Failed capture/log retained.

## Integration reconciliation, 2026-10-13

Recovered from `origin/codex/wsasocket-capability` at `15b37458e` during the
release merge audit. The local-only registration and its required runtime fixes
are now on main. Earlier statements that integration is pending describe the
historical run, not the current branch. This recovery adds no fresh gameplay,
audio, performance, Safari, or physical-device qualification; retain the
recorded run IDs, module hashes, limitations, and failed attempts above.


## Automated recovery, 2026-10-14

Fresh ZIP acquisition from https://archive.org/download/urbanchaos/urbanchaos.zip verified26328920 bytes and SHA-1 ba06b6ca040359ac07dd60ca75d680c9f2b5d15c. Unpack Demo.exe with7-Zip23.01; extract data1.cab groups Global Media,Local Media - English,Program Files using the existing is5-extract fallback (unshield absent on this host). Copy component contents into game/ in that order, then installer clumps/,data/,talk2/ preserving relative paths. Fallen.ex_ is in installer/, NOT in Program Files; copy its unchanged bytes to game/Fallen.exe.

The exact config.ini shown above is written as documented reconstructed installation state. It is not original captured installer output. The1122-file reconstructed game tree matches the restored accepted fixture byte-for-byte, including that INI. Every other file also matches its original extracted source; EXE SHA256 remains8cc73044e19b423ef0f13858d8cb3bb3025ca023114cf87ff46c57838f4b2229. The source archive retains readme.rtf outside game/.

Recovery: `node tools/fetch-candidate-corpus.js --id=urban-chaos-demo`; pristine verification: `node test/test-urban-chaos-recovery.js`. test/candidate-corpus/urban-chaos-demo-files.json pins all1122 paths,sizes and SHA256 values and labels config.ini reconstructed. First draft failed explicitly on a wrong Fallen.ex_ source path; corrected recipe was rerun from fresh forced acquisition. Mutable files may differ after playing. Private-fixture restrictions remain; no binary, public deployment or fresh gameplay acceptance is part of this recipe change.

## 2026-11-01 confrontation attempt: worker control timeout

Evidence: `scratch/runs/20261101-urban-chaos-confrontation/`. No new combat or
interaction success. One original launched; zero gameplay inputs. The accepted
street/alley movement above remains historical evidence and is not counted again.

Gate verified before tests/runtime: exact predecessor-authored
`battlezone-target-hit-command DONE/PUSH RELEASE` at 14:37:30 UTC, fresh launcher
`final.txt`/`result.json` with exitCode 0, and direct absence checks for all six
owned PIDs and four process groups. Actual main at the 14:43:28 gate was
`2f5a350f043ace3d7db5791f09b10e8ada2e5644`, advanced from dispatch
`ad94d102f5b4a239e86d7b38970455dada45dabe`; gate deadline was 15:08:28 UTC.

All 1,122 game files match the bundled file manifest, including the explicitly
reconstructed config.ini. Original Fallen.exe SHA256 remains
`8cc73044e19b423ef0f13858d8cb3bb3025ca023114cf87ff46c57838f4b2229`.
The complete accepted build comparison matched all 4,392 source pins and 141
recorded read pins from accepted build d86935e8274cd5d70a53bcc50c5d8bf5632d95c3,
so no fresh build was needed. Actual runtime WebAssembly.compile observation
recorded module SHA256
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
Before/after source inventory, original tree, manifest and observed file-read
identity comparisons are retained separately. The observer records JavaScript
file reads and module identity, not compiler reads, every lazy read API, or
guest-memory contents. Offline validation passed actual sync/async execution,
whole 512 MB shared-memory read-only comparison, host/native clock identity,
and emitted late-event retention through event 10,001.

Native frozen CLI used registered `urban_chaos_demo`, software rendering,
`--no-build --wasm=build/wine-assembly.wasm --batch-size=100000
--control-stdin --frozen --trace-input-dispatch`. Ping, step25, input-state and
the batch25 PNG succeeded. Reviewed `readiness-25.png` is a plain teal 640x480
startup surface. The next request, step75 toward batch100, received no reply
within the worker helper's 120-second bound: this is the first prerequisite
failure. The final log nevertheless records 98 batches in 173.990 seconds;
this establishes progress, not a game freeze or emulator defect. No repair,
bypass, retry or second original was attempted. An automatically following
capture command queued a read-only host renderer key/button expression after
the timeout; it also received no reply and did not access guest memory.

Ordinary quit was requested, then SIGTERM requested orderly shutdown; the
runner exited 0 after 176.9995 seconds. Reviewed `final.png` is identical to
the readiness image. Setup Okay, title/map/briefing, playable HUD and alley
were not reached. The actual bundled English text names Kick, Punch, Action
and Controls, but supplies no binding values; the historical external
readme.rtf is absent from this local candidate tree. No combat binding was
invented or sent. The controls screen was not reached.

The batch25 input sample has zero scheduled/enqueued/dequeued/routed/dispatched
gameplay events and empty known queues. Per-key physical/async samples and mouse
buttons were unknown at that startup boundary. Final released per-key/button
samples, before/held/released/settled combat captures and a matched neutral
control were not obtained; no action was attempted. Guest post queues and SDL
consumption remain unknown. The existing ole32.dll real-file warning remains
in the log; no ordinal trap was observed. This run qualifies neither audio,
FPS, browser/GPU/touch nor the full game.

Disk guards and controller sampled above 2,000,000,000 bytes free, with finite
sampling gaps; no RAM gate or foreign cleanup. Local box ID/state/expiry are
N/A. Owned runtime shutdown was explicitly delegated. Cleanup, publication and
final/result records in the run directory document ownership handback. The
concrete blocker is the worker's startup step timeout; any further attempt
requires a separate assignment rather than continuing this stopped run.

## 2026-11-01 small-step confrontation attempt: startup readiness bound

Evidence: `scratch/runs/20261101-urban-chaos-small-step-confrontation/`.
No new confrontation or interaction outcome. One original, zero gameplay inputs;
historical movement is not counted again. Only scratch controllers changed.

The exact `battlezone-target-hit-corrected DONE/PUSH RELEASE` author line at
15:05:43 UTC, terminal launcher final/result (exitCode 0), and direct absence
checks for eight predecessor PIDs and five groups passed the gate at 15:06:13.
Actual main was `60500ae55fa28dc658402496afb6e36f88d4296f`, advanced from dispatch
`c6fba571254a85245166115a08880cec00dc911d`; the gate deadline was 15:31:13 UTC.

All 1,122 manifest paths matched, including explicitly reconstructed config.ini;
Fallen.exe retained SHA256
`8cc73044e19b423ef0f13858d8cb3bb3025ca023114cf87ff46c57838f4b2229`.
Complete accepted build reuse matched 4,392 source pins and 141 recorded reads;
no new build was required. Actual runtime WebAssembly.compile observed module
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
Fresh offline observer validation passed actual sync/async execution, whole
512 MB shared-memory read-only comparison, host/native clock identity and late
event retention through 10,001. Before/after comparison passed 4,444 source
identities, 1,124 fixture/manifest identities and 132 actual observed reads.
Observation covers sync whole-file and fully covered bounded descriptor reads;
async file APIs, compiler reads and guest-memory content identity are not covered.

Native registered CLI retained software rendering, `--no-build --control-stdin
--frozen --trace-input-dispatch`, batch-size 100000 and the accepted observer.
The actual stdin protocol was read before launch. All 31 sequential step requests
were exactly 25 batches, each with a 180-second controller bound; every reply
arrived. The earlier step75/120-second request was not repeated. Final batch775
advanced in 1,379.457 runtime seconds. All 32 PNGs have identical decoded pixels:
the reviewed plain teal 640x480 startup surface. PNG CRC/deflate and full gzip
validation passed. Thus the controller sizing fix permits continued stepping,
but Setup Okay, title/map/briefing, HUD, controls and alley remain unreached.

The first blocker is visible startup readiness not reached before the controller's
shutdown reserve. The incremental loop stopped at 15:29:17; its 23-minute outer
guard then requested ordinary quit, received acknowledgement, and requested
orderly SIGTERM. Exit0 after 1,380.891 seconds was inside the 25-minute gate bound.
No individual step timeout or crash occurred; batch progress does not establish
a game freeze or its cause. The exit log reports one main-owned held critical
section; its causal significance is unestablished. No second original or bypass.

Final batch775 input counters are all zero, with known scheduled/pending/
cross-thread/renderer queues empty. Explicit host per-key physical/async/pressed
and mouse-button samples remain unknown; released state cannot be claimed.
Guest post queues and SDL consumption are unknown. The bundled language file
names combat actions without binding values; no binding was invented. Combat
before/held/released/settled captures and matched gameplay neutral are unavailable
because readiness failed. No audio, FPS, browser/GPU/touch or full-game claim.

Controller minimum free disk was 2,041,864,192 bytes, above the required floor;
the separate guard and publication samples are retained with finite sampling-gap
limitations. No RAM gate or foreign cleanup. Local box ID/state/expiry are N/A;
owned shutdown was explicitly delegated. Cleanup/publication/final/result records
document absent owned processes, groups, watchers and new child temps, and handback.
Further work requires a fresh assignment to investigate the startup-readiness
blocker; this attempt stops without source or configuration changes.

## 2026-11-01 startup diagnosis: RSX wait localized; trace host abort

Evidence: `scratch/runs/20261101-urban-chaos-startup-readiness/`.
The saved startup state localizes the pre-Setup wait to the Miles RSX provider;
the underlying reason it does not finish remains unproven. A fresh targeted
trace aborted in Node with JavaScript heap exhaustion before the first step25
reply. This is the first substantive failure of this attempt. One original,
zero gameplay inputs, no retry, no Setup/title/HUD or new gameplay acceptance.

The exact `battlezone-scavenger-arrival DONE/PUSH RELEASE` at 15:42:03 UTC,
fresh terminal launcher final/result (exitCode 0), and direct absence checks
for its six PIDs and five groups passed the gate at 15:42:09. Actual main was
`a5981a6108e86462ba3379f9decf7e84dfa8e82d`; runtime deadline 16:07:09 UTC.
All 1,122 manifest paths matched, including explicitly reconstructed config.ini;
Fallen.exe retained SHA256
`8cc73044e19b423ef0f13858d8cb3bb3025ca023114cf87ff46c57838f4b2229`.
This is reconstructed installation state, not a completed upstream installation.

Named hypothesis H1 was recorded before launch: distinguish an omitted native
dialog from a pre-dialog audio-provider wait. CLI `controlPng` copies only
`renderer.canvas`; scheduled `dlg-png` instead copies a visible dialog's
`_backCanvas`. Therefore teal captures alone cannot establish absent Setup.
The predecessor's actual batch25 through batch775 input-state records keep
main waiting indefinitely on handle `0x0e000042`, EIP `0x023e9943`, with an
RSX worker repeatedly near `0x023ea0f9`. Its log records only the zero-size
Mucky Foot Shell window, audio-provider loading and an rsxtool.exe ShellExecute.

Original MSSRSX.M3D SHA256 is
`8639a7812e87738040f487693baca9778689130e8fc9882de91bae2154edc827`.
Recorded DllMain `0x02400f7c` minus PE entry RVA `0x21f7c` gives runtime base
`0x023df000`, preferred base `0x25000000`. Saved main/worker EIPs translate
to `0x2500a943`/`0x2500b0f9`. Aligned disassembly and original PE imports
identify the cleanup path: EnterCriticalSection, signal the object's event at
offset `0x88`, then WaitForSingleObject(INFINITE) on its completion event at
offset `0x94`. The worker loops over WaitForMultipleObjects on two events.
This identifies a wait chain; it does not prove why its signal is not completed,
that rsxtool.exe is the missing prerequisite, or an emulator deadlock.

Fresh native CLI retained `--app=urban_chaos_demo --no-build --control-stdin
--frozen`, software rendering and batch-size 100000, adding selected window,
load/event/wait API tracing and register_dialog_frame tracing. Ping at batch0
succeeded. The only step request was 25 batches with a 180-second reply bound.
The retained log contains 13,351 RSX worker WaitForMultipleObjects entries,
the zero-size shell creation, rsxtool.exe request and SetEvent(`0x0e000041`)
at return `0x023e9943`. Node then reports “Allocation failed - JavaScript heap
out of memory” and exits by SIGABRT (-6), after 45.524 seconds. Trace overhead
may contribute; it was not isolated, so no trace-allocation root cause is claimed.
No window inventory, dialog backing capture, final PNG or final input-state
sample completed. Capture omission remains unresolved; no blind Setup click,
licence input, guessed binding or memory write was attempted.

Complete build reuse matched 4,392 accepted source pins and 141 recorded reads;
no new build was needed. Canonical module before/after was
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
Fresh offline observer validation, with explicit SWEEP_CASE_DIR, passed actual
sync/async execution, whole 512 MB shared-memory read-only comparison, clock
identity and emitted late-event retention through 10,001. The original's abort
prevented its exit observer from saving actual reads and compile events: those
runtime identities are unavailable. Offline records are explicitly renamed;
they are not original-runtime observations. Before/after inventories match
4,444 source identities and 1,124 fixture/manifest identities. These checks
do not establish compiler reads, all async file reads or guest-memory identity.

The original died before input sampling; released per-key/button state and
consumed releases are unavailable. No action was sent; combat controls and
before/held/released/settled or matched gameplay-neutral evidence were not
reached. Disk samples stayed above 2,000,000,000 bytes, with finite sampling
gaps; no RAM gate or foreign cleanup. Native box ID/state/expiry are N/A;
owned shutdown was delegated. Cleanup and publication records document absent
owned processes/groups/watchers/temps and ownership handback. Next work needs
a fresh assignment with bounded diagnostic logging before native-window
inspection; this stopped attempt makes no production fix or new acceptance.
