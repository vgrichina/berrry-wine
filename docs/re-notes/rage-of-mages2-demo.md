# Rage of Mages II: Necromancer demo

New, nonpublic candidate selected2026-10-12 after Rage I core gameplay reached
review. No existing candidate/app/task match found before selection.

Original source https://archive.org/details/RageofMagesIINecromancer_1020,
rom2demo.zip40,427,687bytes SHA1
`6657c4937e2be41497ce8f944ad15d86b71ad7ce`, downloaded and verified remotely.
Outer ZIP extracts successfully to rom2demo.exe40,551,863bytes. Nested ZIP SFX
fails 7-Zip with headers/data errors; only partial main.res/world.res result.
Do not launch or reuse those partial files. Byte audit counts150,021LF but
only4CRLF pairs, strongly consistent with destructive text conversion in
compressed data, without proving the historical cause. No emulator run yet.

Independent source https://archive.org/details/gsscda1999,
`1999-09/GS0999.iso`662,108,160bytes. Archive metadata SHA1
`74d2f13d0ccb0e0a4091606b0771bb07ddf7bc44` is not a locally verified whole-disc
hash. Direct range source:
https://ia801500.us.archive.org/4/items/gsscda1999/1999-09/GS0999.iso
ISO9660 directory `DEMOS/RAGE2` contains already unpacked game assets,
ROM2.EXE2,116,608bytes at sector190545, SCENARIO.DLL and SMACKW32.DLL,
resources, README and EULA. Recover these exact extents into a separate
`independent` directory; preserve originals. No installer execution needed.

Evidence `scratch/runs/20261012T0406Z-rage-of-mages2-preflight` includes
source identity, extraction failures, byte audit and directory-reader source/
output. Remote fixture `/home/user/rage-of-mages2-demo-preflight` on temporary
bx_yuwwama5. Next verify recovered PE/imports and bundled instructions, then
bounded launch with complete companion-file mounting. Do not assert gameplay,
audio/FPS, registration or public distribution rights from source acquisition.

Recovery completed04:12Z:17 selected game/data/readme/EULA files downloaded
in1MB ranges with exact length checks, per-file SHA256 recorded in
`independent-files.json` (complete:true). Installer support files were not
needed for this directly runnable payload. README identifies demo15May99,
Win95/98/DirectX5, and warns against dots in the install directory name.
It explicitly lists no sound until the mission starts as a known behavior;
do not report silent menus alone as a new audio bug. Ordinary keys include
M move, A attack, E select mercenaries, Esc menu, F2 save/F3 load and Space
inventory/spellbook. First runtime launch remains untested. Use ROM2.EXE with
all companion files and both SCENARIO.DLL/SMACKW32.DLL available.

## CLI player movement verified (2026-10-12 04:21 UTC)

Fresh fork bx_dc8nntjd, restored stdole2.tlb and rebuilt the preserved source.
Module SHA256 `9e835f75dfe5d2fcfb91f592641e945f91baadcd20f6751460777f4dba888cd6`;
ROM2.EXE SHA256 `c163964fca7f15958c53c29cef2fe4db4add639a95a3936453f87ccda874ae4b`.
Use `--exe=<independent>/ROM2.EXE --vfs-include=**/* --quiet-api
--batch-size=100000`. The3000-batch baseline reaches a rendered icon menu.
Ordinary click(250,90) batch3100 starts New Game and reaches the opening
world/dialogue. Click(316,310) at7100,8100,9100 clears the introduction.

Movement route: click character(110,73)11100, screenshot12000; then
click destination(170,145)12100, final screenshot17000. Reviewed selected.png
shows the character near(110,73), health bar, portrait and action buttons.
Final.png shows the selected character near(174,132), farther down the road;
terrain landmarks stay fixed and additional map area/enemies are revealed.
This establishes ordinary selection and commanded movement, not just a
menu or cinematic. All four bounded runs exit0, no guest-state patch or
emulator source change. No inference of FPS from batches/s.

Evidence:0417Z-rage2-first,0418Z-rage2-newgame,0419Z-rage2-world,
0420Z-rage2-movement under scratch/runs/20261012T*. Exact commands, logs,
exit receipts, environment/module/EXE hashes and reviewed images preserved.
The harness warns missing real ole32/shell32/comctl32 DLL files; available
WAT handlers were used, no ordinal trap occurred. Keep that fixture limit
explicit. Browser, touch, audio and qualified FPS remain unverified.
Next local-only candidate/app registration using the recovered GameStar
layout, then browser/direct-touch route. Runtime boat stopped with fixtures
retained in its snapshot; main integration remains ops-owned.

## Registered Chromium direct-touch gameplay (2026-10-12 04:31 UTC)

Local-only registration `77f25049f` on codex/dr2-registration adds candidate
`rage-of-mages2-demo`, app `rage_of_mages2_demo`, both companion DLLs and
direct-touch strategy controls (Esc/keyboard). Production DESKTOP_APPS stays
unchanged. Preparation uses the17 recovered files in `game/`; manual source
instructions pin the disc metadata hash and verified EXE hash. Prepare/build/
registry-local-only/path checks pass. No fresh automated full-disc fetch claim.

0427Z-rage2-browser: Chrome155, same module9e835f75..8cd6, worker threads.
Actual touch taps open New Game at(268,323), clear dialogue at(336,550),
select at(124,305) then order(185,380). Reviewed step3/4 show the selected
character move from about(124,305) to(190,365), revealing more map, with fixed
terrain landmarks. This establishes registered browser touch gameplay.
At844x390, the full game and Esc/keyboard affordances remain visible; touch
(340,185) opens a new in-world NPC conversation. That last dialogue obscures
the character, so it proves touch interaction, not a separate measured
displacement at the narrow viewport. Desktop Chromium touch emulation is not
Safari or physical-device validation. Audio, qualified FPS and broader
combat/save/load remain unverified.

Exact probe/command1..6, screenshots, logs, environment and stage preserved.
Stage complete04:31:02; browser/server closed despite outer transport141.
No guest crash inferred from that transport status. Core task moves to ops
review; Outcast demo refills the new-game lane alongside Dark Reign2.

## Integration reconciliation, 2026-10-13

Recovered from `origin/codex/wsasocket-capability` at `15b37458e` during the
release merge audit. The local-only registration and its required runtime fixes
are now on main. Earlier statements that integration is pending describe the
historical run, not the current branch. This recovery adds no fresh gameplay,
audio, performance, Safari, or physical-device qualification; retain the
recorded run IDs, module hashes, limitations, and failed attempts above.


## Full-disc automated recovery, 2026-10-14

The complete662108160-byte GS0999.iso was freshly downloaded from https://archive.org/download/gsscda1999/1999-09/GS0999.iso and SHA1 74d2f13d0ccb0e0a4091606b0771bb07ddf7bc44 verified locally. This supersedes the historical limitation that only metadata/ranges were verified. Recipe extraction uses7-Zip23.01 Joliet names. Copy Demos/Rage2 into game/, preserving all companion/installer files. Add unchanged uppercase ROM2.EXE,SCENARIO.DLL,SMACKW32.DLL aliases for existing registration. No configuration synthesis.

Run `node tools/fetch-candidate-corpus.js --id=rage-of-mages2-demo`, then `node test/test-rage-of-mages2-demo-recovery.js`. All32 output files are pinned in test/candidate-corpus/rage-of-mages2-demo-files.json and compared byte-for-byte with the independently downloaded/extracted disc tree. Previously recorded executable SHA256 matches. Restored-fixture differences: none. Private-fixture restrictions remain; full-disc download needs roughly1.5GB temporary/free space and contains unrelated disc material. No new game launch/audio/FPS/deployment qualification.

## Current Chromium player control and squirrel deaths, 2026-11-11

Run `20261111-rage2-current-browser-player-consequence-0900` verifies the
registered `rage_of_mages2_demo` through the normal browser shell and native
mouse/key input. Installed `game/rom2.exe` and all32 recovery files pass their
pinned hashes; uppercase aliases and both companion DLLs are present. Tested
source is `0dcbfc19153cd7c34bedfd4e5db65351bbc9e197`, module SHA256
`75ecda5701c15f6fe2c269455ead4e15457b90653733df15d35674b08e8849d5`.
Current runtime pins match the retained locked-build proof and the relevant
source diff is empty. Chromium uses the guest worker and DirectDraw canvas,
not a D3D render worker; viewport1440x1000, guest640x480 displayed at
(10,162) with1100x800 canvas bounds. Local and fresh same-box harmless native
input controls pass trusted/balanced mouse/key checks and five refusals;
viewport-preserving observer tests pass. Actual game logs show mouse down/up
and key down/up delivery, with trusted DOM down events. DOM mouseup is not
asserted from the document listener alone.

Personally reviewed complete frames19/21 show hero selection;23/25 show
commanded displacement from approximately(210,282) to(313,382), with the
pillars, road and sidebar fixed. The initial explicit A attack on the nearby
armored unit targeted a **friendly King's soldier**: the proximity dialogue
opened first, then the pending attack caused the native Mission Failed screen
(frame41). Recover normally with Exit to Main Menu, New Game and the three
intro OKs. This stays in the same guest process; it is not an emulator fault.

Successful route: select the hero, use M and move to southeast ground past the
guards; clear the three proximity-dialogue paragraphs. Follow the southeast
road using ordinary minimap clicks to move the camera and ground clicks to
move the hero. Do not attack the soldiers. Frame110 shows a live orange
squirrel near(690,714); the move toward(650,650) brings the hero into automatic
combat. Frames112/114 show the game's dialogue reporting the squirrels
cleared from the road. After normal dismissal,116 shows the prone orange
body and117 white skeletal remains near(695,740). Roadside rocks, trees,
minimap and sidebar stay fixed across these combat frames. This establishes
player control and visible target-death consequence; no numeric damage,
exact kill count, pickup, victory, audio or FPS claim.

Exact commands, fullframes, visual review with SHA256, source/module/media
pins, failed first mission, recovery instructions, runtime waits and stop
receipts are retained in the run directory. No production code change,
guest-state patch, media/source archive or public deployment was needed.
