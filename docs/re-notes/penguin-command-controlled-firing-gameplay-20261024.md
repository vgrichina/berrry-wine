# Penguin Command matched ordinary-firing experiment, 2026-10-24

**Immediate firing/projectile causality remains unresolved.** One original
Normal Game control and one matched A-key variation reached visible gameplay.
A down/up reached the focused SDL window. Their first differing reviewed
capture shows different green lines with Score 0 in both, but no isolated
friendly projectile, blast or ammunition change. This experiment rejects a
claim of proved immediate firing under this schedule; it does not show that
firing is broken. No third run was made.

Evidence and executed recipes are adjacent in
`penguin-command-controlled-firing-gameplay-20261024/`.
Worker session `01a16be7-16d7-7430-8d0e-2bb4c0be527d` owns this bounded task on
`task/penguin-command-controlled-firing-gameplay-oct24`. The explicit sparse
checkout starts at accepted main `3f75d7afdfc93819d4874b2cf126ca83e66d5bd2`,
confirmed against actual remote main using strict SSH. No main merge occurs.
Root tracked files/index/refs and all input donors were read-only.

## Matched actions and actual delivery

The authentic bundled README (`original-controls.txt`) specifies mouse aim and
A or left mouse for the left cannon. Both runs use identical original assets,
runner/module, CLI settings, normal-game entry, aim, batch-clock and screenshot
schedule. The only additional ordinary events in `firing/command.json` are A
down at batch 34,800 and A up at 34,900. No config, media, guest state or memory
was patched. All events were queued in argv before each launch.

| Batch | Both runs, except the stated variation |
| --- | --- |
| 32,000 | Original menu capture |
| 33,000 / 34,000 / 34,500 | Move (420,360), left down, left up to select Normal Game |
| 34,510 | Capture, still menu |
| 34,600 | Same fixed aim (260,220) |
| 34,790 | Capture before scheduled A down, still menu |
| 34,800 / 34,900 | Variation only: A down/up, balanced |
| 34,810 / 34,850 / 34,910 | Adjacent captures, still menu |
| 35,000 / 35,200 / 35,500 / 36,000 | Captures, unchanged menu |
| 37,000 | Identical paired frame, before logged release/aim/key delivery |
| 40,000 | Both Score 0, red aiming cross at (260,220); green-line geometry differs |
| 45,000 / exit | Wave Scoring; control Score 160, variation Score 80 |

The guest did not consume ordinary events immediately at their scheduled
batches. Both full logs place WM_LBUTTONUP and WM_MOUSEMOVE after the 37,000
capture. The variation then records WM_KEYDOWN `0x100` / VK `0x41` and
WM_KEYUP `0x101`, each routed to keyboard focus `0x10001`, before the 40,000
capture. Exact delivery batch/time inside that interval is **unknown**;
6,960,000/6,980,000 ms are scheduled key clock values, not delivery timestamps.
The 37,000 and 40,000 captures log guest times 7,400,000 and 8,000,000 ms.
This delayed consumption invalidates the intended adjacent firing window.

`matched-analysis.json` decodes and compares all 28 original PNGs. Eleven
paired captures (including the menu and every capture through 37,000) have
zero differing pixels. At 40,000 there are 2,378 different pixels; at 45,000
and exit there are 10,153. Visual inspection of the control 35,200, both
40,000 and both 45,000 frames found no isolated friendly shot/blast. A
change after an input is insufficient to distinguish firing from input-induced
guest progress/timing differences at these batch boundaries. Scores are
observed during wave scoring and cannot establish a particular shot or kill.

The original window starts at desktop (20,20), with the client below the title
bar. The 640x480 host canvas clips the right and bottom of the game; cannon
and ammunition areas are below the reviewed viewport. The captures preserve
the visible upper play area and crosshair but cannot show a complete launch
path or ammunition counter. This is the concrete limit on the causal result.
A separately assigned experiment would need captures bracketing actual input
consumption during play and adequate client-area coverage. There is no
current-main qualification, audio, FPS, complete-game or sustained-play claim.

## Identity, gates and bounded execution

This is historical source **b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a** only.
The immutable normal module is 1,879,746 bytes, SHA-256
`8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`;
the compatible runner is 685,960 bytes, SHA-256
`4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`.
Original EXE SHA-256 is
`14d6e430c26c44c94ef5c176eca2f66edd82dd66fd155d29a5596e3d6e170fc1`.
`manifest.json` retains exact paths and hashes for all 287 files / 15,719,953
bytes: seven authentic DLLs, 83 graphics, 23 pinned pngjs files, the complete font closure with 20 subset
fonts mounted in both runner and runtime,
runner closure and module. The retained source release, standing CRT and codec
paths are explicit in that manifest. No download, install or source build ran.

All local source hashes passed before the one staging transfer. Destination
rehash passed for every file before execution. `stage.py` preserves the accepted
serialized streaming method (431 requests, command bytes <=35,975, segment data
<=18,000 bytes); no archive or local media duplicate was created. The fresh
UID1000 PNG encode/decode, rasterCanvas/renderer, font readability and module
layout gate passed. The exact 291-import/512MiB historical ABI acceptance is
reused by module hash; no additional native ABI instantiation was performed.
`runner-preflight-initial.json` retains an insufficient literal flag search;
the corrected receipt records actual parser spellings and default tick 200.
Accepted quiet flags and output guard were checked before guest execution.

`negative-watchdog.json` proves a TERM-ignoring producer was killed with
SIGKILL (-9) and its process group disappeared. The actual unchanged supervisor
mechanics bounded each guest by 60 seconds, 45,001 batches, host wall/CPU90s,
524,288 log bytes and 24MiB per file. Both use fixed shared 512MiB and Node
oldspace512, quiet API/block flags and explicit tick-ms-per-batch=200. Fresh
MemAvailable immediately before control/firing was 7,220,494,336 /
7,154,786,304 bytes, above the 2,684,354,560-byte floor.

Control: API command `cmd_3dtbnvbrgyzk`, runner 2.593s / 30,619 API calls,
supervisor 2.913s. Variation: `cmd_ngudujslgeqx`, runner 3.039s / 30,328 API
calls, supervisor 3.370s. Both host exits were 0 at the batch cap; **neither is
claimed as a guest exit**. Both initialized seven real DLLs without an observed
trap/unimplemented API; TERM=false, KILL=false, remainingGroup=false.

## Recovery, accounting and handoff

The adjacent admission, manifest, stage, prepare, preflight, supervisor,
collection and analysis recipes retain the actual operations. Recovery requires
fresh assigned paths/box and fresh admission: `admission.py`, the remote
UID/disk/memory gate in `remote-admission.json`, `stage.py`, `prepare.py`, then
`supervise.py control` and `supervise.py firing` sequentially on the guest,
followed by `collect.py control`, `collect.py metadata`, `collect.py firing`
and `node --max-old-space-size=256 analyze.cjs` locally. Change all pinned output
roots consistently; never replay into existing run directories. The collector
was stopped once locally to replace 4,096-byte retrieval chunks with 18,000-byte
chunks; its existing completed files were hash-checked and reused. No guest was
interrupted or repeated. All earlier session/capture charges remain retained.

Initial projection was 62,905,873 / 67,108,864 bytes including 8MiB reserve.
Actual ~475KB PNG sizes prompted a revised 63,954,449-byte admission before the
second run. Both hosts' disk floors passed. `resource-final.json` retains the
full private tree/Git, local and remote evidence, complete session and launcher
history, positive SQLite growth, transport/evidence future allowance and reserve.
Text capture is conservatively charged 400,000 / 1,048,576 bytes; raster session
bytes are included separately in the measured complete session. Git/pack staging
is serialized after removing exact remote payload copies, retaining evidence.
Evidence validation passed all collection seals, matched argv and balanced-key
checks, 28 PNG decodes/comparisons and Python recipe compilation. Raw Git
whitespace checking reports original/generated CRLF options, one original README
tab and one inherited supervisor blank-space line; these exact evidence bytes
are retained. The prose/code check excluding those four raw files passes.
No task file exceeds 25,165,824 bytes. Installed tools and immutable donors remain
separate standing bytes, with no links hiding copies.

The 15,719,953-byte remote game/runner/runtime staging copies were removed after
collection and hash verification. Remote receipts/screens remain, 14,251,968
bytes. The local sparse checkout and evidence remain for review/publication.
No owned guest Node process or process group remains. The board watcher is
terminated at handoff. No public hosting, deployment, box resume/stop/delete,
Claude activity, worker launch or other game work occurred.

Box **bx_spn54373** remains **RUNNING**, actual API state `idle`, health `ok`,
expiry **2026-10-24T03:52:49.910Z**. The **coordinator owns shutdown at 03:42UTC**;
`box-final.json` is the actual observed state. The shutdown deadline has not
arrived and no shutdown receipt is claimed. Ownership returns to the coordinator.
