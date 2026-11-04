# Stronghold Crusader — original demo corpus request

Owner Telegram150 (2026-11-03) requests the game shown in https://x.com/oldyzach/status/2117716444364345387. The post says “We were all Crusaders once.” The saved thumbnail shows the classic desert castle interface and units; visual identification is Stronghold Crusader. The clip does not establish an exact executable version or distinguish every later release using this artwork.

Evidence: `scratch/runs/20261103-telegram150-game-identification/post.json` and `thumbnail.jpg`. Post metadata was retrieved through https://api.fxtwitter.com/oldyzach/status/2117716444364345387 after direct X access failed. Publisher reference: https://fireflyworlds.com/games/strongholdcrusader/ describes the Crusader setting, castle economy and units; its current HD product is not the selected original demo build.

## Target and current state

The original UK v1.1 multiplayer demo is registered as `stronghold_crusader_demo` and has reached its first offline skirmish, **Zephyr — Very Easy (1/10)**. Ordinary construction placed a hovel beside the keep; it persisted after switching construction categories, and housing capacity increased from 10 to 18. This is bounded CLI software-rendered gameplay evidence, not a completed battle or browser/multiplayer qualification. The existing `crusaders_mm_demo` is a different game.

An acquisition candidate is https://www.moddb.com/games/stronghold-crusader/downloads/stronghold-crusader-demo (listed `StrongholdCrusadersinglems.rar`, 92,080,301 bytes). The cached download link returned HTTP410; this is a stale mirror URL, not proof the demo is unavailable. Alternate original-demo listing: https://games.softpedia.com/get/Games-Demo/Stronghold-Crusader.shtml (`stronghold_crusader_demo_v1-1_uk.exe`). Listing metadata is not an accepted executable pin. Obtain a direct original package and inspect it before trusting its identity. Do not substitute Extreme, HD, Definitive Edition, a wrapper downloader or a fan engine.

## Bounded next action

The registration and first-skirmish construction task is complete; see the tested route below. Acquisition/extraction and the media inventory are accepted; use the existing installed files. Any broader gameplay or browser work is a separate bounded follow-up. The coordinator owns shutdown of this task's box, handed back running with unique evidence and both modules recovered locally.

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

The unapplied-patch and runtime-pending statements above describe the preparation checkpoint, superseded by the registration and execution below.

## Registered first skirmish and ordinary construction — 2026-11-04

Evidence: `scratch/runs/20261104-stronghold-registered-skirmish/`. Runtime source is input commit `dd78dad0b8322a8f4dbb7e615a890c3132437c57` plus the owned registry/census changes in `relevant-tracked.patch`. `git-blob-references.json` names 386 exact Git blobs; no source archive was made. The registration selects the existing installed EXE, guest path `c:\strongholdcrusaderdemo\Stronghold Crusader multiplayer demo.exe`, working directory `c:\strongholdcrusaderdemo`, and the accepted 1,853-companion manifest. It retains `requiredFiles: true` and concurrency 10. No guest binary, script, save or media was patched.

The coordinator's board release at 00:12:03Z and worker ACK at 00:12:15Z preceded allocation. Fresh TTL3600 box `bx_pmfcmfw2` was recorded before use, expiry **2026-11-04T01:12:18.560Z**, shutdown owner **coordinator**. It was handed back RUNNING/idle; the worker did not stop, delete or resume it. `box.json`, `runtime-release-ack.json`, and `boat-handoff-info.json` preserve identity and lifecycle observations.

The exact EXE SHA-256 remains `9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`. Both built modules were recovered from the runtime and compared byte-for-byte with the staged modules:

| Module | Bytes | SHA-256 |
| --- | ---: | --- |
| Canonical | 2,143,540 | `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee` |
| Compatibility | 2,146,153 | `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3` |

PID 18778 actually compiled and instantiated the canonical module; the compatibility module was built and recovered, not selected for this Node 24.22.1 execution. Runtime loaded the original adjacent Miles and Bink DLLs. All 2,255 sealed source/media/helper/module inputs matched after execution. `local-recovery-verified.json` and `remote-recovery-manifest.json` seal 106 recovered run files plus both modules with full SHA-256, including all unique logs, captures and sequential input receipts.

Launch used the production registered selector `--app=stronghold_crusader_demo`, `--no-build --wasm=build/wine-assembly.wasm`, software rendering, cooperative guest threads, `--batch-size=100000`, `--tick-ms-per-batch=5`, and the frozen control channel. The CLI backing canvas initially defaulted to 640×480 while the game window requested 800×600; the ordinary harness `canvas-resize:800:600` at batch 320 corrected capture dimensions without changing guest state. Use `--screen=800x600` from launch on a follow-up.

The completed route, with images under `recovered/game/`:

1. `startup64.png`: original castle artwork; `canvas321.png`: Firefly splash. Escape, then the ordinary title prompt at `menu579.png`.
2. Hold Start Game at (398,274), then release: `title_up715.png` shows the main menu and **Demo V1.1**. Hold Crusader at (304,144), release, then select the left map at (266,305). The right towers are the unavailable Crusader trail; that exploratory selection is retained.
3. Hover first numbered button (68,491): `very_easy1003.png` identifies **Zephyr — Very Easy (1/10)**. Select it, then `easy1075.png` shows the scenario description and Normal Game. Start with the green hand at (717,568).
4. `load1659.png` and `world1915.png`: live keep and construction UI. Choose Town Buildings at (145,578), then Hovel at (46,520). `hovel_preview2187.png` shows the ordinary placement preview at (190,300), cost six wood.
5. Hold at (190,300) for 16 batches and release; `hovel_placed2267.png` records placement. Escape opened Game Options, so Resume Game was used. Switch to Castle Buildings at (33,578), move the cursor away, and inspect `placed_verified2749.png`: the hovel remains beside the keep, the preview is gone, and capacity reads **5/18**, compared with the initial **1/10**. `game-result.json` identifies before/preview/after images.

`control-verification.json` checks all **180 sequential completed requests**, including 59 step requests, maximum 64 batches each, exact terminal batch progression to **2749**, 38 ordinary input commands, and no outstanding request. Inputs use the production mouse/key path; held presses span guest frames. One-shot click at the title only produced hover, and one-shot right-click did not cancel the hovel preview; category switching provided the clean final proof. The harness then received a normal quit request; Node exited 0, its process was absent, and port 8123 was closed before evidence recovery. The box remained running for coordinator custody.

Validation: actual registry/picker/path/size/guest-mapping/lazy-policy checks for all 1,853 companions; `node test/test-app-files-policy.js`; `node test/test-callback-ownership-census.js`; mandatory `flock /tmp/wine-build.lock bash tools/build.sh`; visible reviewed construction captures and completed receipt checks. The first build stopped on the `lib/apps.js` whole-file census seal; only declarative selector/path data changed, so its hash and review reason were updated, retaining ownership pending. The subsequent full build passed. A provisioning helper omitted `registry-path-check.js`; that staging failure is preserved in `provision.log`, repaired by uploading the single missing helper, and the remote path check passed before launch. **No production game failure or runtime fix was encountered in this route.**

Recovery: retain the existing installed media and `installed-pin.json`; source comes from the recorded Git blobs plus `relevant-tracked.patch`. `provision.py` documents direct per-file verification/staging, `game-drive.py` the exact launch, `route.py` bounded ordinary controls, and `recover.py` full-SHA recovery. Do not rerun provisioning into the occupied root or resume the old box. A new authorized run should use a fresh runtime and the published registration, with original pinned media and the recorded module hashes.
