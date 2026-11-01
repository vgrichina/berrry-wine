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

## 2026-11-01 bounded RSX diagnosis: mixed named-event wait fails

Evidence: `scratch/runs/20261101-urban-chaos-bounded-wait/`.
The pre-Setup completion wait now has a precise generic API failure:
`ThreadManager.waitMultiple` rejects an infinite wait containing a valid
named-authority event before checking an already signaled unnamed event.
The original RSX worker receives `0xffffffff` (`WAIT_FAILED`) repeatedly,
leaves the stop event unconsumed, and does not signal completion. No production
repair was attempted. One original, zero gameplay inputs, no second original;
Setup/title/gameplay remain unreached and historical movement is not recounted.

The exact coordinator `D3D9-COM-GAP DONE RELEASE runtime/source/build` author
line at 15:51:39 UTC, its terminal result (exitCode0), and direct absence of
the owned COM test process passed the gate at 15:52:36 UTC. Actual gate main
was `73e88746fc8672d921c6bf274937ba904db702ef`, advanced from dispatch
`a1c43c412f2406bb58081ad4fa654b36b2973af3`; deadline was 16:17:36 UTC.

Hypothesis H2 disabled selected API/host tracing and retained only first64,
last64, selected-tail128 and at most256 counter keys around real event/wait
calls. Wrappers invoke the original method once and return its exact result;
they sample synchronization state without writing it. Offline comparison
exercised actual event/wait methods, identical results and whole512MB memory
with/without wrappers, plus late10,001 calls and retention caps. The separate
identity observer passed actual sync/async execution, whole512MB read-only
comparison, clock identity and late10,001 retention with correct SWEEP_CASE_DIR.
No heap increase, unbounded trace retention or tracked helper changes.

Native registered CLI used `--app=urban_chaos_demo --no-build --control-stdin
--frozen`, software rendering and batch-size100000. Step1 and step24 both
replied within180 seconds; no request exceeded25 batches. Native WAT window
inventory, renderer inventory and dialog globals at batch1 and batch25 all
show only the invisible zero-size Mucky Foot Shell window, no active dialog
or dialog backing surface. Reviewed PNGs are plain teal640x480. No blind
Setup input was sent. Native inventory resolves the omitted-dialog hypothesis
at these sampled boundaries, without claiming every intermediate state.

At batch25, read-only evaluation retrieved the original main-module probe
directly as `main-waits-batch25.json`. Its64-record tail contains63 actual
worker `waitMultiple(2, 0x08048bc8, false, INFINITE, 4)` returns of `0xffffffff`,
followed by main's completion-event poll returning258. The two handles are
`0x0e000041` and `0x0e000040`. Before and after every retained multiple wait,
the first is an auto-reset event with state1; the second is a valid issued
named-authority event (sync type4). Thus the ready event is not consumed.
Main is waiting indefinitely on unsignaled `0x0e000042`, EIP `0x023e9943`.
The sampled original object maps offsets0x88/0x8c/0x94 to those three handles.
Original aligned RSX code tests the wait result at preferred0x2500b0f9:
return0 takes the completion SetEvent path, return1 handles the other event,
and other returns loop. This links the actual failed returns and missing
consumption to the saved completion wait; it does not establish every possible
later startup prerequisite.

Exact implementation: `lib/thread-manager.js:2034` checks all handles for
issued named events and returns `0xffffffff` when timeout is nonzero, before
the wait-any readiness/consumption loop at2100. CLI `test/run.js:4806` routes
this call there. `src/09a0b-handlers-base-late.wat:1949` stores that result in
guest EAX; only internal0xffff yields. The next bounded repair should address
this generic mixed-event wait contract under the existing holds, then rerun
this reproducer and the original. No callback, concurrency, SEH or scheduler
algorithm was changed in this assignment.

Minimal real-API reproducer: `flock /tmp/wine-build.lock timeout 120s node
scratch/runs/20261101-urban-chaos-bounded-wait/reproduce.cjs`. It compiles a
separate test module using production CreateEventA/SetEvent/
WaitForMultipleObjects/WaitForSingleObject handlers and the real named-event
authority. It creates an unnamed auto-reset event and an unsignaled named
event, signals the first, then waits-any on both. INFINITE returns0xffffffff;
a subsequent single poll returns0 then258, proving the failed wait did not
consume the signal. After a fresh SetEvent, the matched timeout0 control
returns0 and the following single poll returns258, proving consumption.
`reproducer-result.json` records this reproduced defect; terminal exit0 means
the diagnostic assertions passed, not that the API is repaired. Test fixture
writes are confined to its separate module memory; original game memory was
observed without writes.

The probe saw4,393,377 total calls with bounded storage. Its256 counter keys
filled before RSX;4,391,874 overflow events are not an exact RSX failure count.
The selected tail also retains repeated failures, not unique transitions.
Inherited Node Worker preload contexts can overwrite timer snapshot files;
the explicit main-context retrieval above is the authoritative original
sample. Main's exit observer saved actual compile/read records separately
from renamed offline records. The original exited0 after93.770 seconds by
ordinary quit followed by delegated orderly SIGTERM; no heap OOM occurred in
this bounded launch. This does not isolate the predecessor's heap-allocation
cause. The first substantive API failure stopped further stepping and inputs.

All1,122 manifest paths matched, including reconstructed config.ini; Fallen.exe
retained SHA256 `8cc73044e19b423ef0f13858d8cb3bb3025ca023114cf87ff46c57838f4b2229`.
Complete accepted build reuse matched4,392 source pins and141 recorded reads.
Actual original WebAssembly.compile observed module
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
Before/after4,444 source identities,1,124 fixture/manifest identities and132
actual runtime read identities match. Read coverage includes sync whole-file
and fully covered bounded descriptors, not compiler reads, all async OS reads
or guest-memory contents. The reproducer's separately compiled test module
is not the original runtime module.

Final batch25 input counters are zero and known queues empty. Host physical,
async and pressed-key/button states remain unknown; consumed gameplay controls,
sampled releases, before/held/released/settled and matched gameplay-neutral
evidence are unavailable because no action was attempted. Guest post queues
and SDL consumption remain unknown. No audio, FPS, browser/GPU or full27 claim.
Disk guards sampled above2,000,000,000 bytes free with finite sampling gaps;
no RAM gate or foreign cleanup. Native box ID/state/expiry are N/A. Own shutdown
was delegated; cleanup/publication/final records document absent owned
processes, groups, watchers and new child temps and ownership handback.

## 2026-11-01 ready-any repair: Setup, title and mission opening recovered

Evidence: `scratch/runs/20261101-urban-chaos-ready-wait-repair/`.
The generic mixed-event ready-any defect is repaired in `waitMultiple`.
The complete handle set is validated before acquisition, including closed and
tagged authority handles, local generations, thread aliases and process handles.
Bounded byte reads support unaligned x86 handle arrays. Ordered zero-time
acquisitions select the lowest ready index and consume only that object.
Valid named events no longer reject a nonzero-timeout call before checking
readiness. Named wait-all and nonzero-timeout multiple waits with no ready
object still return WAIT_FAILED: cross-process blocking multiple waits are
not implemented by this repair. Single-wait, scheduling, callback, concurrency,
SEH and CRT nonlocal-jump algorithms are unchanged.

The exact Battlezone black-dialog author DONE/PUSH RELEASE at 16:12:35 UTC,
fresh launcher result0/final, and direct absence of eight owned PIDs/seven
groups passed the gate at 16:12:43 UTC. Dispatch was `4d9446b48`; actual gate
main was `6f4fa1d5ecb75f03aea8e0b354dbe7c051ca3c5f`; original deadline
16:37:43 UTC. The first locked build failed the conservative whole-JS-file
callback census SHA check. `first-build-failure.log` is retained. Following
the documented inventory maintenance procedure, the complete producer delta
was reviewed, and only the matching thread-manager seal SHA/reason changed.
Ownership remains pending; no gate or held algorithm was bypassed. Locked
builds after review and after the final unaligned-read adjustment both passed.

Focused thread-manager, named-event authority/API/end-to-end, callback census
and census rejection-control tests passed. Maintained end-to-end regressions
invoke production WAT CreateEventA, SetEvent, WaitForMultipleObjects,
WaitForSingleObject and CloseHandle with a real authority in another process.
They exercise both ready indices, both-ready ordering, finite/INFINITE/zero
timeouts, auto-reset consumption, manual-reset persistence, partial/final close,
private creation tags, invalid later handles and unsupported no-ready/wait-all
cases. Unit cases additionally cover recycled local handles, pending/exited/
closed thread aliases, process validity, semaphore consumption and array bounds.
These are API/state-consumer tests, not native-Windows conformance certification.
The retained real-API reproducer now returns `[0,258,258,0,258]`: both INFINITE
and timeout0 return index0 and consume the signal. Its pass now means repaired
semantics, unlike the predecessor's diagnostic pass.

One original used the registered frozen native software CLI, batch-size100000,
bounded probes and sequential step requests of at most25 batches/180 seconds.
It ran 440.539 seconds and exited0 after ordinary quit and delegated orderly
SIGTERM. At batch25, native inventory and reviewed native backing show the
ordinary graphics/audio Setup dialog. `main-waits-setup.json` retains the
actual RSX wait on `[0x0e000041,0x0e000040]`, INFINITE: result0, first event
state1 before/state0 after. Its worker subsequently exits. This directly
connects ready-event consumption to recovery of the previously blocked Setup.

After backing inspection, normal mouse-down/up on visible Okay at275,445
dismissed Setup. Title is reviewed at205; held Enter reaches mission map307,
briefing409 and the loading image511. Rendered opening scenes at711,911,1111
and final1436 show rain, buildings, characters and objective captions.
Playable HUD, player movement, combat and interaction success were not reached
or claimed. No second original, alternate settings or game-specific workaround.

Every navigation action has before/held/released/settled samples and a matched
neutral interval. Three held Enter pairs have six actual matching dequeue,
route and DispatchMessageA records. The briefing release scheduled at485 is
still pending in samples486/511 during loading; actual dequeue/route/dispatch
occurs at658, and sample711 confirms its consumption. The first evidence-check
assertion incorrectly required immediate consumption; its failure and corrected
trace-based check are retained. No input was replayed. The native Setup mouse path records host
actions, a visibly pressed button and dialog dismissal, but does not populate
those generic guest dispatch counters; no equivalent mouse dispatch proof is
claimed. Final1436 known queues are empty; sampled physical/async keys,
including VK1/VK13, are false and numeric mouse mask is0. Their pressed latches
remain true; guest post queues and SDL consumption are unknown.

Further progression stopped when the auxiliary disk-guard process was found
terminal143, cause undetermined. Its last record is 16:22:23 UTC; discovery
was 16:25:18 UTC. The independent primary driver remained live, sampling disk
and enforcing disk/time/log guards. Its minimum was2,257,408,000 bytes; the
auxiliary guard's earlier minimum was2,037,649,408. This is a helper-lifecycle
blocker, not a game crash or a claim of continuous filesystem coverage between
samples. The active advance controller was stopped, then final released-state
and scene samples were obtained before shutdown. No original retry followed.

Actual observer prerequisites passed sync/async execution, whole512MB memory
read-only comparison, clock identity and late10,001 retention. The bounded
wait probe passed real-call result/whole-memory equivalence. Scratch observers
now write only from the controlling main context to prevent Worker snapshot
overwrites. Actual original compilation observed canonical module
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
All4,444 source identities,1,124 fixture/manifest identities and289 observed
runtime reads match before/after. All1,122 manifest paths match, preserving
original Fallen.exe SHA256 and the reconstructed-config distinction above.
Read coverage excludes all-async/direct-OS/compiler-read and guest-memory
identity claims. All43 PNGs pass CRC/complete-deflate checks; full runtime gzip
passes. Primary milestone captures were visually reviewed. No FPS, audio,
browser/GPU or full27 claim. Native box ID/state/expiry are N/A; own shutdown
was delegated. Cleanup/publication records carry final ownership handback.

Next: investigate the auxiliary guard's unexplained termination before a fresh
bounded original continuation toward playable HUD and held movement. The API
correction does not authorize broader retained-context or blocking-wait work.


## 2026-11-01 guard lifecycle investigation and current-main HUD/movement

Evidence: `scratch/runs/20261101-urban-chaos-guard-gameplay/`.
The prior auxiliary guard's signal sender and reason remain **UNKNOWN**.
Retained raw worker events establish that its tool-owned launcher shell ended
143 at16:22:24.467 UTC,779.120 seconds after startup. The primary driver's
launcher shell ended143 at16:22:24.459, just8ms earlier. Its Python child
survived with PPID1 and the original remained live. The guard's last heartbeat
was16:22:23.486, free2,261,217,280 bytes; neither its disk-stop path nor a
normal guard-stop explains shell status143. This supports a correlated external
launcher/session lifecycle hypothesis, but no retained siginfo/audit record
identifies the sender or reason. It does not establish a game crash.
`guard-diagnosis.json` preserves the exact terminal events and limits.

Scratch-only prevention replaces the foreground tool-owned auxiliary guard with
a primary supervisor detached into its own session by a short, successful
launcher. An independent quarter-second watchdog writes atomic heartbeats and
enforces disk headroom and the absolute deadline; signal/exception records and
owned child shutdown are explicit. The primary driver independently checks
heartbeat freshness, process presence, disk, deadline, log bounds and original
exit. Requests require a live guard and have finite180-second timeouts.
`guard-live-proof.json` records advancing heartbeat counters/process identity
before original launch. This supervisor remained live through the entire new
attempt and ended normally:6,196 samples over its complete lifecycle, including
the gate wait, minimum2,145,710,080 bytes free.
These are sampled bounds with finite gaps, not continuous filesystem observation.

The exact battlezone-dialog-capture-harvest author DONE/PUSH RELEASE at16:53:27,
fresh launcher result0/final, and direct owned-process/group absence passed the
gate at16:53:41.915. Dispatch input was`a17c5a7c85aae38a97653b801da68de6147048df`;
actual main was`6ca46f8ffced6b6e4331e8fa4efa33e4d91c6872`; deadline17:18:41.915.
All4,444 scoped source pins matched the accepted ready-any repair's final state,
so its exact locked build and seven focused checks were reused, with local
copies/hashes retained. No production source, build, test or fixture edits.
Fresh manifest verification passed all1,122 paths, original Fallen.exe SHA256
`8cc73044e19b423ef0f13858d8cb3bb3025ca023114cf87ff46c57838f4b2229`, and the
reconstructed-config distinction. Fresh observer validation passed actual
sync/async execution, whole512MB read-only comparison, unchanged clocks within
a180-second bound (560ms observed), and late10,001 retention. SWEEP_CASE_DIR
pointed to this run; only the controlling main context wrote observations.

One original used the registered native software CLI, frozen batch-size100000,
step requests at most25, and no build. Immediate startup free space was
2,203,303,936 bytes. It exited0 after826.358 seconds, with no runtime/guard
failure or second original. Native Setup backing was inspected at25; ordinary
Okay, title205, map307, briefing409 and loading511 were reviewed. Opening711,
1111 and1711 show changing cinematic scenes. HUD appears naturally at2011:
D'arci on the street, radar/health, fist icon and3:58 timer. No extra cinematic
skip input was needed.

**Current-main ordinary movement is demonstrated.** Matched neutral samples
at2011/2111/2112/2137 leave D'arci in the same starting street position.
ArrowUp samples at2137/2237/2238/2263 show movement from the street into the
passage toward the car park, then release and settlement at the new location.
Each interval uses100 held/neutral batches,1 release-phase batch and25 settling
batches, with individual requests capped25. All eight neutral/movement phase
captures were inspected. VK38 is physically/asynchronously false before, true
held, false released/settled. Actual dequeue/route/DispatchMessageA edges match:
keydown2140, keyup2237. Three Enter pairs also match actual consumers; the
briefing keyup is deferred until658 rather than claimed consumed at486/511.
Final2263 known scheduled/pending/cross-thread/renderer queues are empty, sampled
physical/async keys false and mouse mask0. Pressed latches remain set; guest
post queues and SDL sampling remain unknown. The104 step replies are all
present, maximum25; all recorded request latencies are within180 seconds
(max74.611s). Native Setup mouse evidence is ordinary host input/dialog dismissal,
not equivalent generic guest-dispatch proof.

Actual runtime compilation observed canonical module
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
All4,444 source and1,124 fixture/manifest pins match after runtime. All304
observed read hashes match after-run files:256 also match fresh before pins;
48 font/PNG dependency reads lack fresh current-run before hashes and instead
match retained accepted prior observations. That narrower coverage is explicit
in`identity-comparison.json` and`accepted-prior-loaded.json`; no fresh
before/after claim is made for those48. Observation excludes unhooked async,
direct-OS and compiler reads and guest-memory identity. All52 PNGs pass CRC and
complete-deflate validation; the full runtime gzip passes. Selected milestones
and every neutral/movement phase were visually reviewed, not every remaining
PNG. No FPS, audio, full27, browser/GPU or combat qualification.

Own original/driver/supervisor completed, watchers were explicitly stopped,
and cleanup records verify listed own PIDs/groups/helpers and new child temps
absent. Native box ID/state/expiry are N/A; own shutdown was explicitly delegated
and ownership handed back. Remaining diagnostic gap: historical SIGTERM sender
and reason cannot be recovered from these records. The scoped HUD/movement goal
has no remaining gameplay gap; no broader source repair is authorized here.

## 2026-11-01 native encounter attempt: guard-check failure before gameplay

Evidence: `scratch/runs/20261101-urban-chaos-native-encounter/`.
No encounter or objective interaction was reached. The first guard failure
stopped the single original at batch26 before any gameplay input; no retry.
Historical HUD/movement evidence above remains historical.

Exact `battlezone-renderer-dialog-freshness DONE/PUSH RELEASE` at17:23:38,
fresh launcher final/result0 and independent absence of its21 listed PIDs/
20 groups passed the gate at17:23:46.034 UTC. Dispatch input was
`f20e19b24651f2e37fe53b422378205328338270`; actual main was
`ebd313fd0b3415fe1dc0c6e7154317f855dbbfea`, including renderer fix
`feb4934388f06da990a750d0073fd38776fa0c41`. Gate deadline was17:48:46.034,
inside the18:15 overall bound. The renderer worker's passing locked build
and relevant checks were reused after exact comparison of its4,063 pins and
the prior Urban run's pins (4,445 unique accepted inputs, zero differences).
Fresh renderer freshness, thread-manager and real-WAT named-event end-to-end
checks also passed. No production source, test, build or fixture edit.

All1,122 manifest paths matched; Fallen.exe SHA256 remains
`8cc73044e19b423ef0f13858d8cb3bb3025ca023114cf87ff46c57838f4b2229`.
Config.ini remains explicitly reconstructed installation state. Original
readme.rtf was recovered read-only from the retained recovery ZIP into this
run, without a download or rewriting archived evidence. Its controls tables
specify arrows for movement/turning, C for action, Z punch, X kick and Space
jump. It describes talking to a person with action and arresting a prone
suspect. The vehicle hint conflicts with the table (Enter versus C); no
vehicle input was selected. Bundled config and English instructions were
also read. No combat/action binding was guessed or sent.

The prior guard controller and diagnosis were read, and its proven detached
supervisor/independent heartbeat-thread mechanism was reused. Advancing
before-launch heartbeat samples and the final during-original heartbeat are
retained. Original startup free space was2,182,414,336 bytes, above the
2,150,000,000-byte immediate-launch minimum. Registered native software CLI
used `--no-build --control-stdin --frozen`, batch-size100000, step requests
1/24/1 and180-second finite request bounds. All recorded requests were
acknowledged, maximum latency0.627 seconds. Reviewed Setup at25 is readable
in the standard640x480 capture and the332x470 native dialog backing; final
capture shows the same ordinary graphics/audio Setup. Okay was never pressed.

The driver then raised `RuntimeError('primary guard lost')` in its combined
heartbeat-age>1second / missing-supervisor / guard-failure-file check. The
failing operand and age were not retained. The supervisor has no signal or
failure file and ended normally with reason null after823 samples, minimum
free2,180,182,016 bytes. Its last heartbeat was17:25:14.888; driver terminal
was17:25:15.139 and supervisor terminal17:25:15.156. This does not establish
supervisor death, a game crash or the cause of the rejected check. It differs
from the prior foreground launchers' unexplained143. The driver requested
ordinary failure-quit (acknowledged); original exit0 after20.163 seconds,
then driver0 and normal supervisor completion. The Setup-neutral helper
subsequently rejected the now-stopped guard before sending its first request.
No unchanged retry, second original, guard bypass or source repair followed.

Fresh observer validation passed actual sync/async execution, whole512MB
read-only comparison, unchanged host/native clocks bounded456..457ms, and
late-event10,001 retention. Actual original compile observed canonical module
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
All4,678 source/dependency pins and1,124 fixture/manifest pins matched after;
all133 actual observed read hashes matched fresh before and after pins.
Coverage excludes unhooked async/direct-OS/compiler reads and guest-memory
identity. All four PNGs passed CRC/complete-deflate; full runtime gzip passed.
Recover the log with `gzip -dc runtime.log.gz` inside the run directory.

The batch25 state has zero gameplay counters and empty known queues. Sampled
physical/async/pressed keys and mouse mask were unknown; final released-state
sampling was not obtained because shutdown had already completed. No held keys
were injected. Before/held/released/settled gameplay and matched neutral captures
are unavailable. No HUD, movement, combat, objective, FPS, audio, browser/GPU
or full27 claim. Disk evidence has finite sampling gaps; continuous coverage
is not claimed. Local native box ID/state/expiry are N/A; delegated own shutdown
completed. Cleanup records verify known own PIDs/groups/watchers/helpers and
new child temps absent, with ownership handed back.

Next: retain the rejected guard predicate's exact operand, monotonic age and
heartbeat history before a separately assigned original continuation. The
ordinary encounter/objective goal remains open; recovered original controls
and the prior HUD-to-carpark route are ready for that continuation.

## 2026-11-01 guard diagnostics: controlled checks pass; helper terminal143 stops encounter attempt

Evidence: `scratch/runs/20261101-urban-chaos-guard-diagnostic-encounter/`.
The encounter/objective goal remains **unachieved**. One original reached the
loading screen at batch386; no gameplay movement or encounter input followed.
The first new lifecycle blocker ended this attempt without a second original
or replaying the interrupted request. Historical HUD/ArrowUp evidence above
is not new encounter evidence.

The predecessor Urban driver/supervisor and retained diagnosis were read.
Its combined age/process/failure-file predicate still has an unknown historical
failed operand. Separately, retained Battlezone evidence measured1.119649s
heartbeat age before its primary advanced454→455; that does not identify the
cause of either historical delay. Cheap no-game controls now separately retain
healthy advancement, a healthy measured1.500946s pause, stale3.152561s age,
dead process, replaced process-start identity, and explicit failure-file cases.
Each control includes wall/monotonic timestamps and ages, process start ticks,
failed operands and heartbeat history. Atomic scratch writes plus gzip
encode/read/decode produced52 healthy I/O samples, maximum observed check
interval0.930804s. `no-game-delay-analysis.json` corrects an overly broad
`observedIoMaxEmitGap` label in the retained raw controls: that statistic includes
the deliberately injected pauses and must not be called an I/O-only delay.

Scratch freshness policy is now a bounded3-second monotonic tolerance, informed
by those measured healthy delays; stale3.15s is still rejected. This is an
engineering margin, not proof of the historical cause or a measured need for
exactly3seconds. Detached primary supervision and a separate independent
process retain direct disk/deadline enforcement, reciprocal heartbeat/process
checks and process start identity checks. The driver independently checks
original liveness, both heartbeats, disk, deadlines, request/log/capture bounds.
The independent process detects primary absence and owned-process identity
replacement; missing-original detection specifically remains the driver's
poll, not a separately claimed independent missing-original predicate.
Guard rejections retain operand details and bounded heartbeat histories.
An exclusive-create initiating guard-failure file cannot be overwritten by
later signal/cleanup records. No safeguards, production code or tests changed.

Exact Battlezone `battlezone-fixed-capture-harvest DONE/PUSH RELEASE` at17:31:26,
fresh launcher result0/final and direct absence of its listed owned PIDs/groups
passed the gate at17:41:41.263 UTC. Dispatch input was`7d47a40e5`;
actual main was`98c2a1d5e2aa1fef348a0697aed7de58c59fc1d7`.
The25-minute gate deadline was18:06:41.263, within the19:15 overall bound.
All4,445 accepted build inputs matched, permitting exact renderer locked-build
and focused-check reuse. Fresh manifest, observer whole512MB read-only
sync/async/clock/late10,001, renderer, thread-manager and real-WAT named-event
checks passed. All1,122 manifest paths matched, including original Fallen.exe
SHA256 `8cc73044e19b423ef0f13858d8cb3bb3025ca023114cf87ff46c57838f4b2229`;
config.ini remains reconstructed installation state. Original controls were
read: C action, Z punch, X kick, arrows movement/turn. No combat binding was
sent or guessed.

The registered native software original used `--no-build --control-stdin
--frozen`, batch-size100000, requests at most25 and finite180-second bounds.
Immediate startup free space was2,169,905,152 bytes, above2,150,000,000.
Reviewed standard/native Setup, ordinary Okay, held Enter navigation, mission
map182, briefing284/335 and loading360/386 were retained. Menu actions have
before/held/released/settled and matched neutral captures. Five actual key
edges match dequeue/route/DispatchMessageA; the third Enter key-up remains
queued at386 and is not claimed consumed. Final sampled physical/async keys
are false and mouse mask0; scheduled/pending/cross-thread queues are empty,
renderer queue contains that one key-up, pressed latches remain set, and guest
post/SDL consumption is unknown. Native Setup mouse evidence is host input
and visible dismissal, not generic guest-dispatch proof.

The briefing helper's tool session79606 returned143 after printing
`NAVIGATED briefing`. Helper3968062 was subsequently absent. Its final PNG
request was acknowledged in the original runtime log, but the helper did not
record receipt. That request was not repeated; its helper receive time/latency
is unknown. All other recorded request latencies are below180seconds,
maximum2.246387s;27 step requests have maximum25. Sender/reason for the helper
terminal status remain **UNKNOWN**. At discovery, original3966982 and both
detached guards3966061/3966066 remained live; no guard rejection/failure file
was present. This is not evidence of a game crash, a failed heartbeat check,
or signal143 delivered to the original. `initiating-failure.json` preserves
the helper event separately from orderly shutdown. No helper/request/original
retry followed; only final read-only sampling and ordinary quit were performed.

The original exited0 after170.797s, driver0, primary/independent normal with
null reasons. Primary861 samples had minimum2,163,261,440 bytes free and maximum
observed gap0.529202s; independent860 samples had minimum2,163,302,400 and
maximum gap0.399494s. Direct disk stop remained2,020,000,000, before the required
2,000,000,000 floor. These are finite sampled bounds, not continuous disk
observation. Guard freshness worked during this short run; it is not qualified
for a complete encounter flight. No unchanged1-second monitor was reused.

Actual original compilation observed canonical module
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
Before/after4,678 source/dependency and1,124 fixture identities match; all269
observed runtime reads match fresh before/after pins. Coverage excludes
unhooked async/direct-OS/compiler reads and guest-memory identities. All40
PNGs pass CRC/complete-deflate; full runtime gzip passes. Selected useful
images were visually inspected, not every PNG. No FPS/audio/full27,
browser/GPU, deployment, guest patch or replacement claim.

Own shutdown was explicitly delegated. Direct cleanup verified19 known PIDs
and17 groups absent, no matching helpers/watchers and no new child temps.
Native box ID/state/expiry are N/A; ownership is handed back. Recover the log
with `gzip -dc scratch/runs/20261101-urban-chaos-guard-diagnostic-encounter/runtime.log.gz`.
The directory retains executable scratch guard/control/observer scripts,
accepted build hashes/logs, original-command and gate records, immutable
initiating failure, final state and cleanup records; do not treat recovery
recipes as permission to launch another original in this assignment.
Next: separately diagnose the controller/tool terminal143 lifecycle before
another assigned continuation toward an ordinary encounter. This assignment
stops with that concrete blocker and the gameplay objective gap disclosed.

## 2026-11-01 detached commands: receipts survive; heap failure and stale heartbeat stop continuation

Evidence: `scratch/runs/20261101-urban-chaos-detached-controller-encounter/`.
The ordinary encounter/objective goal remains **unachieved**. One original
completed step1936; the next25-batch request has no retained ACK and was not
replayed. Useful actual PNGs show standard/native Setup, mission map, briefing,
loading and changing cinematic scenes through1586. No new HUD capture,
gameplay movement, combat or contextual interaction is verified. The accepted
HUD2011/neutral2137/ArrowUp2263 evidence above remains historical.

Scratch `detached.py` launches each named command in an owned detached session,
records runner/child PID and start identity, uses explicit interpreter/argument
vectors, serializes commands with a lock, and bounds each command. Terminal
receipts use fsynced temporary files, atomic publication and directory fsync;
exclusive atomic links preserve complete immutable first-failure records.
Unique job directories reject command replay. Individual control requests also
retain durable sent/ACK records and finite180-second waits, with steps at most25.
The no-game harness killed its initiating clients with SIGTERM: the detached
success command still completed, exit7 retained a terminal failure, and a finite
timeout retained its first cause through a secondary cleanup write. All three
passed; their owned processes subsequently disappeared. A detached Node dispatch
control passed too. After Battlezone release, its Python-only `runpy` helper was
consulted; this wrapper uses the correct explicit Node/Python interpreter.
The predecessor's immutable failure is copied without alteration. Its historical
status143 sender/reason remains UNKNOWN; identification was not a prerequisite.

Exact `battlezone-guarded-capture-harvest` author DONE/PUSH RELEASE, fresh external
launcher result0/final and direct owned PID/group absence passed the gate at
17:54:20.945 UTC. Dispatch input was`c32bdc566`; actual main was
`19f8b03404cbb6a79bdedf02c33f9e39255610dc`, deadline18:19:20.945 within20:00.
All4,678 accepted source/dependency pins and compiled-module hashes matched,
allowing locked-build/focused-test reuse. Fresh fixture verification passed all
1,122 manifest paths and original Fallen.exe SHA256
`8cc73044e19b423ef0f13858d8cb3bb3025ca023114cf87ff46c57838f4b2229`;
config.ini remains reconstructed. Fresh observer sync/async execution,
whole512MB read-only comparison, clock identity/bounds and late10,001 retention
passed. No source, build, production-test or fixture edits were made.

The single registered software original used `--no-build --control-stdin
--frozen`, batch100000 and finite bounds. Immediate launch free space was
2,155,229,184 bytes, above2,150,000,000. The detached menu and advance commands
passed the predecessor's interrupted386 point with complete receipts. Eleven
command terminal receipts exist: ten succeeded and the last retained exit1
with its traceback. This demonstrates the new command receipt path on an actual
failure, not complete runtime-lifecycle qualification.

At18:01:26.521 the driver rejected primary heartbeat1449 at monotonic
age3.012139s against the3-second tolerance. The primary PID/start identity still
matched and its sampled state was S. The immutable `guard-failure.json` retains
the exact operands and128 preceding observations. Later primary/independent
rejections and the detached command's exit1 record are separate. The3-second
monotonic/identity predicates were retained; scratch persistence additionally
changed heartbeat/failure writes to fsynced atomic publication. That persistence
change was not independently qualified under game load. Stored heartbeat
timestamps do not measure publication completion; the cause of the stale
published observation remains unknown. No guard relaxation or retry followed.

The recovered runtime stream also contains133 guest heap allocation failures,
beginning after the1936 ACK: sparse commit and bump/low/sparse exhaustion at
EIP`0x00494d9f`, caller`0x0048c76e`. This is a concrete changed runtime blocker,
not a host-RAM admission measurement. Exact OOM onset versus guard timing is
unknown because those log lines lack wall timestamps. No guest crash/trap cause
is established. The Node exit hook reports1; the original OS wait receipt and
driver terminal receipt are missing. Supervisors entered owned SIGTERM cleanup;
no ordinary original exit0 is claimed. The driver gzip footer is incomplete.
Its original bytes are preserved; `runtime-recovered.log.gz` contains all207,005
decodable bytes, with no claim that an unflushed tail was recovered.

Of218 manual requests,217 have unique durable successful ACK receipts; the one
unresolved step was not repeated. There are89 bounded step requests, maximum25;
maximum recorded successful reply latency13.365361s. All six Enter edges match
actual dequeue/route/DispatchMessageA records. No gameplay key was sent. Last
sample1586 has physical/async keys false, mouse mask0 and empty known queues;
there is no fresh post-failure released-state sample. Pressed latches and guest
post/SDL consumption remain distinct/unknown. Before/held/released/settled and
matched neutral menu captures exist; encounter phase captures do not.

Before/after4,678 source and1,124 fixture identities match, as do300 observed
runtime reads. Actual compilation observed canonical module
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
All42 actual PNGs pass CRC, complete deflate and raster-length checks; selected
milestones were visually reviewed. Primary1,450 history samples had minimum
2,108,903,424 bytes free; independent1,449 had minimum2,110,160,896. These are
finite sampled bounds, not continuous disk/freshness coverage. Direct stop
remained2,020,000,000 before the2,000,000,000 floor. No FPS/audio/full27 claim.

Direct cleanup verifies40 recorded owned PIDs and38 groups absent, no matching
helpers/watchers and no new child temps. Native box ID/state/expiry are N/A;
explicitly delegated own shutdown is complete and ownership handed back.
`RECOVERY.txt` preserves executable scratch recipes and the log limitations.
Next requires a separately assigned investigation of the guest heap failure
and heartbeat publication/cleanup-receipt gap before another encounter attempt.
No second original, unchanged replay, source repair or broader qualification
was performed in this assignment.

## 2026-11-01 offline heap diagnosis: vertex-pack refusal; capacity versus fragmentation still unmeasured

Evidence: `scratch/runs/20261101-urban-chaos-heap-cause/` (`analysis.json`,
`failure-events.json`, three disassemblies and `RECOVERY.txt`). Static analysis
only: no original, runtime, build or tests ran, and no production files changed.
Dispatch input was `7699f3fb00184b5d46c2cd98ad03569c5017318d`; actual main
repinned to `424b9e1b1813da28543fe19c5770016227f34b3c`.
Original Fallen.exe SHA256 is
`8cc73044e19b423ef0f13858d8cb3bb3025ca023114cf87ff46c57838f4b2229`.
Ten relevant allocator/dispatch/layout/host source hashes match both retained
runs and this analysis tree; both runs loaded canonical WASM
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.

**The failing operation is runtime vertex packing, not an oversized game malloc.**
At `0x00494d60`, Fallen builds a triangle fan's WORD indices at `0x00ee4438`.
The loop exits at `0x00494d9f` (`pop ebp`); `0x00494dbf` calls vtable slot35
(`+0x8c`) with primitive4/TRIANGLELIST, VB=`[ecx+0x80]`, generated indices/count
and flags`0x1c`: `IDirect3DDevice3::DrawIndexedPrimitiveVB`. The EBP-chain return
`0x0048c76e` follows `call 0x00487020` at `0x0048c769`; it is an outer frame,
not the allocating function. The interpreter's `$th_call_ind` dispatches a thunk
before updating EIP to the return address, so the logged EIP can be this block's
entry rather than the actual COM call instruction. There is no malloc at that EIP.

The handler calls `$d3dim_vb_draw_indexed_primitive`, clamps the VB capacity and
packs only through the highest referenced index. `$d3dim_pack_fvf_vertices`
requests `count * 32` bytes. The66 complete small failures report aligned
allocator extents25,960..44,072 bytes, all `32*N+8`, consistent with811..1,377
vertices; the first32,296-byte extent corresponds to a32,288-byte/1,009-vertex
pack on this path. These are inferred pack operands from code and logged
extents, not captured VB/index measurements. Successful packs are freed after
the draw. Failed packs skip the draw and still return S_OK: visible HUD and
movement do not prove all geometry drew or all allocations succeeded.

The67 separate1,048,576-byte messages are `$heap_sparse_alloc`'s minimum new
arena commit, not67 independent1MiB game allocations. After a free-list miss
and low-arena refusal, it reserves guest address space, then
`$virtual_map_commit` returns0; reason3 is emitted after its reclaim/retry path.
Reason1 subsequently reports the original aligned small extent. The recovered
stream ends on an extra reason3 with no following small failure/site retained.
It establishes **new arena commit refusal**, not which commit check failed.
The nominal sparse backing window is288MiB inside the fixed512MiB memory;
there is no extension at that size. Actual live committed bytes, map count
(limit8,192), largest gaps, arena live-byte counts and free lists were not saved.
Reason3 can also cover metadata/lease/page-publication refusal. It does not
uniquely mean the288MiB pool was fully occupied.

Fragmentation is a specific candidate: ordinary heap free prepends blocks,
allocation splits them, and this path does not coalesce adjacent free blocks.
Reclaim deliberately releases only whole-block sparse arenas, so carved arenas
can retain backing even when their live-byte count is0. The render coalescer
exists but is called by the D3D9 software backend, not this legacy VB pack path.
That mechanism is present in the pinned code; its occurrence/byte cost in this
game is **unmeasured**. The pack's balanced success/free path does not establish
a leak, and no allocation history identifies the owner of the retained backing.
Expected live capacity, fragmentation, another owner's leak and a commit
bookkeeping failure therefore remain distinguishable hypotheses. No bad-size
reason5 or absent VB implementation explains the observed refusal.

**Correction to interpreting the successful HUD route:** its retained
`20261101-urban-chaos-guard-gameplay/runtime.log.gz` contains20,432 OOM lines
(10,216 reason3/reason1 pairs), first after ACK2061, including19,468 site lines
at the same EIP/caller. It subsequently reached2263 and ordinary exit0 with the
documented HUD/movement evidence. Its lack of a terminal runtime failure must
not be read as absence of heap failures. The detached run first logs OOM after
ACK1936; differing batch onset is not a controlled memory comparison. Among
shared before pins only renderer.js and the callback-census JSON differ; the
allocator/WASM identity is unchanged. Neither log supplies OOM wall timestamps.
No OOM-to-guard causality, guest crash or host RAM failure is established.

The smallest next discriminator is a **single first-refusal allocator snapshot**,
before another encounter flight: retain wall/monotonic time, batch, instance,
size/reason and WASM stack at the existing `heap_oom_trace` import; copy the
bounded map/reservation/heap-arena tables using the matched generated region
map, plus pure heap cursor/stat getters and the passive
`d3d_render_free_list_diagnostic` fields. Read free headers through a host-side
translator; calculate live backing union/free gaps, per-arena live bytes,
free-byte total/largest fit and validated adjacent free extents offline. Capture
the active Win16 lease ledger only if its arena is nonzero. Do not call
`get_free_list` or `heap_free_census` as passive probes: both flush bins.
Reason3 alone needs a branch-specific commit refusal code if these data leave
more than one failing predicate possible. Capture before expensive formatting,
publish once, bound output, and retain the original guard predicates.

First use a bounded no-game pack/free sequence varying811..1,377 vertices on
the pinned allocator: a refusal with low live bytes and enough adjacent free
space identifies fragmentation without spending another original attempt.
If live backing instead approaches capacity, collect allocation/free ownership
before choosing a memory-size experiment; if maps are full or publication/lease
checks fail with space available, target that exact runtime behavior. No memory
increase, coalescer mutation or guard change is justified by the present logs
alone. This assignment stops at that precise missing measurement. Recovery is
offline via `python3 scratch/runs/20261101-urban-chaos-heap-cause/analyze.py`;
the predecessor's truncated original gzip and completed recovered gzip remain
untouched. Native box ID/state/expiry N/A; no boxes were created or altered.

## 2026-11-01 no-game allocator probe: balanced pack sizes reproduce fragmentation-driven retention

Evidence: `scratch/runs/20261101-urban-chaos-allocator-probe/`. Dispatch main
was `a34f3648016a508b5fd268297ff84e7c00a5fe8e`; actual measurement main was
`39242f4b76421b468157ee51d7593037fcb527de`. After Battlezone's explicit release,
fresh launcher result/final and direct absence checks for its55 PIDs/groups,
136 source/module/interface hashes matched the accepted build. The unchanged
canonical WASM SHA256 was
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
One Node24.18.1 instance used fixed512MiB memory, public `init_thread`,
`heap_init`, `guest_alloc` and `guest_free`; no PE, vertex payload, rendering,
game replay, source edits or build. Host imports were stubs except the OOM
capture. Heap initialization used the matched generated GUEST_HEAP_BASE.

**Balanced varying pack sizes alone reproduce a refusal.** The exact sequence
was2,000 `alloc(32*1009)/free` pairs, then ascending
`alloc(32*(811+(i%567)))/free` pairs, with at most one live request and each
success freed immediately. The constant control retained one low arena and no
sparse backing. Ascending iteration15,051 (zero-based) refused1,120 vertices:
35,840 requested bytes, aligned need35,848. It emitted reason3/1MiB followed
by reason1/35,848 bytes. There were17,051 completed balanced pairs in total;
measurement elapsed5.15s, supervisor exited0/reaped its child in5.27s. Limits
were100,000 ascending pairs,540s internally/570s externally, and a direct disk
stop at2,020,000,000 bytes; minimum observed free disk was2,094,579,712 bytes.

| First-refusal measurement | Bytes/count |
|---|---:|
| Sparse backing union / capacity | 301,989,888 / 301,989,888 |
| Free backing / largest backing gap | 0 / 0 |
| User live requested bytes / summed arena live bytes | 0 / 0 |
| Free carved headers, including off-list blocks | 15,320 / 305,107,584 bytes |
| Largest free header / required extent | 35,816 / 35,848 |
| Largest adjacent free run within one arena | 1,048,576 |
| Maps / limit; arenas / limit | 288 / 8,192; 291 / 1,024 |

All288 sparse arenas retained their backing. Of these,287 were retired,
zero-live and carved:300,941,312 bytes could not satisfy the whole-block
reclaim predicate because the first header did not span its arena. The active
sparse arena also had zero live bytes. Three low arenas brought retained arena
space to305,135,616 bytes;28,032 bytes remained unused tails. The validated
ordinary list held15,216 blocks/305,092,608 bytes;14,976 header bytes were
off-list. Their free status follows from this balanced sequence and zero arena
live counts, and is not an inference to apply to an arbitrary game snapshot.

The first OOM import copied bounded map/reservation/hole/arena/shared/Win16
tables, cursors, counters and headers once, before formatting. Passive
`d3d_render_free_list_diagnostic` reported valid; no bin-flushing getter,
retirement, coalescer or allocator mutation was used for measurement. Offline
walks validated all headers, adjacency and table hashes. First-import and final
tables, headers, list, cursors and counters were identical. The Win16 arena was0;
map/reservation/arena limits were not full. Fully occupied backing leaves no
fit for even the recursive64KiB commit floor. The matched source therefore
explains the arena commit refusal through backing no-fit/split exhaustion;
the exact internal branch was inferred, not instrumented. The measured
underlying mechanism is fragmented, empty carved arenas retaining backing.

**This establishes a sufficient allocator-only mechanism, not the game's
actual first-refusal cause or OOM-to-guard causality.** The successful HUD route
also emitted heap OOMs. The remaining game-only discriminator is the same
passive first-refusal snapshot on the allocating instance, with size/reason,
wall/monotonic time, batch and allocation ownership/bin information if live
counts are nonzero. A branch-specific refusal code is needed only if that
snapshot leaves multiple predicates possible. No memory increase, coalescer
change or guard rewrite is justified by this probe alone.

Recovery is offline:
`python3 scratch/runs/20261101-urban-chaos-allocator-probe/analyze.py`.
`RECOVERY.txt` records the exact sequence, bounds and module recovery recipe;
`pins.json`, snapshots, `measurement.json`, `runtime-result.json` and
`verification.json` preserve the evidence. No further runtime is needed to
reanalyze it. Own local helpers were stopped; native box ID/state/expiry N/A.

## 2026-11-01 generic allocator repair: reuse a provably local empty sparse arena

Evidence: `scratch/runs/20261101-urban-chaos-empty-arena-repair/`. This is an
allocator regression repair; **Urban Chaos's actual first-refusal cause and
gameplay failure cause remain unmeasured**. No game was replayed. Runtime work
started only after exact Battlezone worker `01a19867-ff52-75a3-8cf4-57531732e92d`
released runtime/source/build, its launcher result/final arrived, and all22
recorded PIDs/groups were directly absent. Measurement input main was
`02b44b8944e97cd518c7349119037eb43bedccb5`; all136 probe source/module/interface
pins matched before editing.

Simply broadening `$heap_arena_release_free` is unsafe. Arena records/maps are
shared, but bins and free lists are instance-private. Another instance may own
freed carved headers even when the shared live-byte count is0. Releasing and
reserving that guest range again can make its surviving links validate against
new live allocations. The existing whole-block release guard prevents this
aliasing and remains in force.

The repair instead rewinds **only this instance's current sparse bump arena**
on an exhausted bump request. It requires the exact current base/high/end
record, zero live bytes, a fitting arena, and a carved first header. It flushes
this instance's bins, validates the complete local free list, then walks actual
carved header boundaries and proves every header is on that list. Matching
header/list-entry counts reject extra interior entries. The proof is bounded
to65,536 list entries and1,000,000 combined search steps; failure retains the
existing allocation path. Success purges local links before clearing the old
prefix through page-aware guest memset and rewinding cursor/high. The arena's
mapping, reservation and record base stay intact. New bump allocations retain
zero-filled semantics. No memory increase, global coalescing, CRT, callback,
guard, concurrency or SEH change is involved.

`test/test-heap-empty-arena-reuse.js` calls the actual production WASM public
allocation/free exports in fixed512MiB memory. The original pinned module
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`
again failed at ascending iteration15,051/request35,840 after17,051 completed
pairs, with288 maps and reason3/1MiB followed by reason1/35,848. The repaired
module
`7278c1018fa8208731a8e285f0bb2a5c35aa8e299592750ce3cedf6d354caef0`
completed2,000 constant plus100,000 ascending pairs with **one1MiB backing
map and no OOM events**, then20,000 varying-size pairs across bins, page sizes
and the large-allocation threshold. Live peer/large allocation contents were
checked byte-for-byte, and reused allocations were zeroed. Separate ownership
cases prove a locally owned binned header permits rewind with identical map
records; a live header or peer-owned binned header prevents it. Subsequent
small allocations and peer reuse preserve the new live allocation. Surviving
arena headers, map translations and passive free-list diagnostics validate.

The mandatory locked `tools/build.sh` passed. Existing arena-tail reuse
(11 cases), cross-instance release, randomized bins, large-free map pressure
and large-block arena tests all passed on the repaired source; tail reuse also
used the production module directly. The new regression took28.45s; the old
exact reproduction took2.25s including its supervisor. Logs, module/source pins
and command results are retained in the evidence directory.

This prevents the demonstrated balanced-pack accumulation; it does not reclaim
arbitrary retired carved arenas or fragments owned by another instance. Those
still need an explicit cross-instance ownership/generation solution before
releasing their guest ranges. This scope is deliberate: zero live bytes alone
does not make surviving free-list pointers safe to invalidate.

## 2026-11-01 repaired-allocator encounter attempt: disk stop at Setup

Evidence: `scratch/runs/20261101-urban-chaos-repaired-encounter/`, with the
actual original under `ready-runtime/`. **No new HUD, movement or encounter
was reached.** The first real run failure was the disk guard at
19:33:53.365540 UTC: free space sampled at2,003,222,528 bytes, below the
unchanged2,020,000,000-byte stop threshold. Launch free space was
2,152,325,120 bytes, above the2,100,000,000-byte requirement. Free space had
rebounded to2,151,092,224 bytes at19:34:03. The responsible disk writer and
duration of the transient are unmeasured; none of these finite samples was
below2GB. No RAM gate, threshold relaxation, second original or replay followed.

The exact Battlezone worker `01a19875-ed1d-7551-84ea-e74fb416adc1` author
DONE/PUSH RELEASE, fresh launcher final/result0 and direct owned PID/group
absence passed at19:32:26.191 UTC. Actual input main was
`732f271c20da0df9561d73293576e17fa847f795`; the25-minute gate ended19:57:26,
inside the20:19:28 outer deadline measured from this worker's launch. The
coordinator reclaimed a SHA-verified duplicate before the gate to restore
launch headroom. Runtime/source/build ownership was serialized; this worker
made no production source, test, build, fixture, TODOS or STATUS changes.

The corrected scratch guard reads/parses heartbeat before sampling its
comparison clocks. Deterministic controls reproduce the old false future
rejection and pass the corrected order while still rejecting genuine future,
stale6.15s, dead/replaced processes and explicit failure records. Healthy3.5s
delay, immutable first failure and direct disk/deadline controls pass. Detached
Node and Python exit0/7/timeout controls retain durable terminal records.
The exact accepted readonly observer was reused, including its whole512MiB,
clock-identity and late10,001 retention validation.

One preparation error occurred before any original: the prerequisite helper
checked the independent guard before its first heartbeat existed. The guard
correctly rejected the absent file and both preparation supervisors stopped.
Root `guard-failure.json`, `initiating-failure.json` and terminal records remain
unchanged. `preparation-race.json` records the error, hashes and direct cleanup.
The scratch scheduling correction waits for `independent-ready` and two
advancing healthy guards in a fresh `ready-runtime/` directory. It preserves
every guard predicate and the original gate/deadline; no game was replayed.

Fresh checks matched4,294 source/module/dependency pins and the1,122-file game
manifest. Fallen.exe SHA256 remains
`8cc73044e19b423ef0f13858d8cb3bb3025ca023114cf87ff46c57838f4b2229`;
config.ini remains reconstructed installation state. The published allocator
repair's exact locked build, regression and five focused tests were reused.
Actual runtime compilation observed repaired WASM SHA256
`7278c1018fa8208731a8e285f0bb2a5c35aa8e299592750ce3cedf6d354caef0`.
After shutdown all4,294 pins,1,124 fixture/manifest pins and133 observed read
hashes match. Observation covers main-context synchronous whole-file and
complete bounded descriptor reads, excluding unhooked async/direct-OS reads
and guest-memory identity.

The sole original PID4084652 used the registered native software CLI,
`--no-build --control-stdin --frozen --batch-size=100000`, with steps at most25
and finite180s reply waits. Standard and native Setup PNGs at25 were visibly
reviewed. Last acknowledged batch26 processed the ordinary `dlg-png` request;
no mouse/key gameplay edge or Setup Okay was sent. The subsequent setup helper
rejected stopped guards before sending its first request. All four actual PNGs
pass CRC/complete-deflate checks; final.png has the same filtered raster as
the reviewed standard Setup image. The full runtime gzip is complete. No heap
refusal appears in this short startup log; it does not measure the game's
allocator behavior during gameplay or historic OOM/guard causality. The reused
observer has no first-refusal import sampler; no new production hook or
bin-flushing diagnostic was introduced.

Cleanup has a specific remaining evidence gap: the original Node exit hook
records0, and the supervisor's actual OS wait records driver exit1, but there
is **no durable original OS-wait receipt**. Primary and independent shutdown
both sent SIGTERM; repeated driver signals interrupted its exception handling
and finally block before it could publish that receipt. Its lost wait cannot
be reconstructed from process absence or the Node hook. No fresh final key
release/settled sample exists; no physical input was sent in this original.
All recorded owned original/helper/watch PIDs and groups are directly absent,
with no remaining helpers or new child temps. Own shutdown was delegated;
native box ID/state/expiry are N/A.

The concrete blocker is the transient disk stop before gameplay, accompanied
by the shutdown receipt gap. A separately authorized attempt needs sustained
disk headroom and a single-owner, idempotent shutdown path that waits the
original and records its result despite repeated shutdown requests. Preserve
these first failures; `RECOVERY.txt`, control terminal records, identity and
capture validation permit offline recovery without another game launch.
Historical HUD2011/neutral2137/ArrowUp2263 remains the latest movement evidence.
The synthetic allocator repair is not demonstrated encounter success. No FPS,
audio, full27, browser or GPU qualification is claimed.
