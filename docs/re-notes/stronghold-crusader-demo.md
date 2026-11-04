# Stronghold Crusader — original demo corpus request

Owner Telegram150 (2026-11-03) requests the game shown in https://x.com/oldyzach/status/2117716444364345387. The post says “We were all Crusaders once.” The saved thumbnail shows the classic desert castle interface and units; visual identification is Stronghold Crusader. The clip does not establish an exact executable version or distinguish every later release using this artwork.

Evidence: `scratch/runs/20261103-telegram150-game-identification/post.json` and `thumbnail.jpg`. Post metadata was retrieved through https://api.fxtwitter.com/oldyzach/status/2117716444364345387 after direct X access failed. Publisher reference: https://fireflyworlds.com/games/strongholdcrusader/ describes the Crusader setting, castle economy and units; its current HD product is not the selected original demo build.

## Target and current state

The original UK v1.1 multiplayer demo is acquired, extracted without installer execution, and pinned per file. Its readme confirms three offline skirmishes as well as multiplayer. No launch, registered selector entry or gameplay is claimed. The existing `crusaders_mm_demo` is a different game.

An acquisition candidate is https://www.moddb.com/games/stronghold-crusader/downloads/stronghold-crusader-demo (listed `StrongholdCrusadersinglems.rar`, 92,080,301 bytes). The cached download link returned HTTP410; this is a stale mirror URL, not proof the demo is unavailable. Alternate original-demo listing: https://games.softpedia.com/get/Games-Demo/Stronghold-Crusader.shtml (`stronghold_crusader_demo_v1-1_uk.exe`). Listing metadata is not an accepted executable pin. Obtain a direct original package and inspect it before trusting its identity. Do not substitute Extreme, HD, Definitive Edition, a wrapper downloader or a fan engine.

## Bounded next action

Fresh task: `scratch/usage-watch/stronghold-crusader-original-next.task.txt`, prioritized for the next free production slot under the owner's cap of two. Acquire/extract the demo, register actual installed paths, reach the ordinary menu and attempt a visible unit order or building placement. Record the first real failure if progress stops. Runtime tests remain serialized behind the existing legacy/Alice assignments.

Git is the source archive: record commit and relevant binary diff, never source-tree tarballs. Reference original media by path and hash, provision only what the test runtime needs, and never copy media into repeated evidence packages. A compilation container is not the target build or download prerequisite.

## Installer acquired 2026-11-03 23:59Z

Direct mirror: https://ftp.zx.net.nz/pub/archive/ftp.gamers.org/pub/mirrors/ftp.gamesdomain.co.uk/demos/Stronghold_Crusader_Demo_V1-1_UK.exe (HTTP200; Last-Modified 2002-11-11). Local installer: `test/binaries/candidates/stronghold-crusader-demo/Stronghold_Crusader_Demo_V1-1_UK.exe`, 92,364,284 bytes, SHA-256 `0d4f49e83c81d0f9b60c592103267b27e84a34d05c7c11be8b1e13bf2a32ff45`. File inspection identifies a PE32 x86 InstallShield self-extractor; its outer CAB lists Setup.ini/data1/data2 payloads dated 2002-10-31. This is an installer pin, not yet the executable target pin or gameplay evidence.

Owner Telegram151 suggested Archive.org. Its bounded software/demo search returned seven compilation collections/discs, with no standalone demo result; no compilation was downloaded. Search response and installer acquisition pin are retained in `scratch/runs/20261103-stronghold-acquisition/`. Next worker should use this local installer instead of downloading another copy.

## Extracted original media — preparation only, 2026-11-04

Preparation HEAD was `0e95d0bba311706ca945abf1a05893cfac2d5bf0` on main; the dispatch reference was `be2fc974600230e15c1f05ee06c05890d2411dab`. Foreign working changes were excluded. Runtime remains unallocated behind Alice pending explicit coordinator release through queue and board, followed by worker ACK. No sandbox was created or used, and no game, installer, or emulator module was executed.

Installed root: `test/binaries/candidates/stronghold-crusader-demo/installed/App_Executables/`. The original `Stronghold Crusader multiplayer demo.exe` is 2,699,264 bytes, SHA-256 `9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`. It is PE32 x86, preferred base `0x00400000`, entry RVA `0x0017941d`, COFF timestamp 2002-10-29 16:14:52 UTC. Imports include DirectDraw, DirectPlay, Miles `mss32.dll`, and `binkw32.dll`; the latter two DLLs are present beside the executable.

The App Executables InstallShield group contains 1,856 files totaling 128,461,571 bytes. Every file has a sorted path/size/SHA-256 record in `.wine-assembly-sha256.json` under the candidate root and `installed-pin.json` in `scratch/runs/20261103-stronghold-crusader-original/`. The browser companion manifest is `.wine-assembly-browser.json`, SHA-256 `d51be8d9ab1038b7dc2b3242f3a4ebed382f1fbf33d558211a80bd36ab112b21`. It maps 1,853 companions to `c:\strongholdcrusaderdemo\`, omitting the separately loaded main executable and the optional GameSpy Arcade installer and hardware checker. Those two optional executables remain pinned on disk but are not runtime inputs.

The shipped `Stronghold Crusader Multiplayer Demo Readme.doc` identifies the UK multiplayer v1.1 master in its metadata and describes three playable skirmishes, an in-game tutorial, and two-player multiplayer. Start with the first, Very Easy, offline skirmish for a bounded ordinary unit-order or building-placement proof. No exact-build relationship to the owner's clip is asserted.

Recovery from the existing pinned installer (no download or installer execution):

```sh
7z x -y -otest/binaries/candidates/stronghold-crusader-demo/installer-payload \
  test/binaries/candidates/stronghold-crusader-demo/Stronghold_Crusader_Demo_V1-1_UK.exe
unshield -g 'App Executables' \
  -d test/binaries/candidates/stronghold-crusader-demo/installed x \
  test/binaries/candidates/stronghold-crusader-demo/installer-payload/Disk1/data1.cab
python3 scratch/runs/20261103-stronghold-crusader-original/prepare.py
```

The run retains the extraction logs, CAB listing, static PE inspection, readme text, pin inventory, manifest-generation recipe, and `registry-proposal.patch`. The patch is unapplied: `lib/apps.js` has not been claimed or edited. Its in-memory registry evaluation and all companion path/size/guest-mapping checks passed, including the production lazy-loading policy. An initial preparation assertion incorrectly expected the lazy-policy return value to be an array; that harness failure is retained separately and was corrected to read `.files`. It was not a game failure.

After explicit runtime release, check ownership before applying the registry patch, run focused registry/path checks and the mandatory locked build before any code commit, then test ordinary startup and offline gameplay on the fresh assigned runtime. Preserve exact tested source/module/media identities and the first actual failure. Runtime, menu, gameplay, build, and publication of a functioning registration are still pending; static preparation does not establish compatibility.
