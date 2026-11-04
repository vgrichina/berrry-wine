# Stronghold Crusader — original demo corpus request

Owner Telegram150 (2026-11-03) requests the game shown in https://x.com/oldyzach/status/2117716444364345387. The post says “We were all Crusaders once.” The saved thumbnail shows the classic desert castle interface and units; visual identification is Stronghold Crusader. The clip does not establish an exact executable version or distinguish every later release using this artwork.

Evidence: `scratch/runs/20261103-telegram150-game-identification/post.json` and `thumbnail.jpg`. Post metadata was retrieved through https://api.fxtwitter.com/oldyzach/status/2117716444364345387 after direct X access failed. Publisher reference: https://fireflyworlds.com/games/strongholdcrusader/ describes the Crusader setting, castle economy and units; its current HD product is not the selected original demo build.

## Target and current state

Select an original Windows Stronghold Crusader demo, acquire its actual files, and pin the executable plus sorted per-file SHA-256 manifest before registration. The original demo installer is acquired and hashed; the installed game executable still needs extraction and its own pin. No launch, registered selector entry or gameplay is claimed. Local filename search found no Stronghold Crusader package; the existing `crusaders_mm_demo` is a different game.

An acquisition candidate is https://www.moddb.com/games/stronghold-crusader/downloads/stronghold-crusader-demo (listed `StrongholdCrusadersinglems.rar`, 92,080,301 bytes). The cached download link returned HTTP410; this is a stale mirror URL, not proof the demo is unavailable. Alternate original-demo listing: https://games.softpedia.com/get/Games-Demo/Stronghold-Crusader.shtml (`stronghold_crusader_demo_v1-1_uk.exe`). Listing metadata is not an accepted executable pin. Obtain a direct original package and inspect it before trusting its identity. Do not substitute Extreme, HD, Definitive Edition, a wrapper downloader or a fan engine.

## Bounded next action

Fresh task: `scratch/usage-watch/stronghold-crusader-original-next.task.txt`, prioritized for the next free production slot under the owner's cap of two. Acquire/extract the demo, register actual installed paths, reach the ordinary menu and attempt a visible unit order or building placement. Record the first real failure if progress stops. Runtime tests remain serialized behind the existing legacy/Alice assignments.

Git is the source archive: record commit and relevant binary diff, never source-tree tarballs. Reference original media by path and hash, provision only what the test runtime needs, and never copy media into repeated evidence packages. A compilation container is not the target build or download prerequisite.

## Installer acquired 2026-11-03 23:59Z

Direct mirror: https://ftp.zx.net.nz/pub/archive/ftp.gamers.org/pub/mirrors/ftp.gamesdomain.co.uk/demos/Stronghold_Crusader_Demo_V1-1_UK.exe (HTTP200; Last-Modified 2002-11-11). Local installer: `test/binaries/candidates/stronghold-crusader-demo/Stronghold_Crusader_Demo_V1-1_UK.exe`, 92,364,284 bytes, SHA-256 `0d4f49e83c81d0f9b60c592103267b27e84a34d05c7c11be8b1e13bf2a32ff45`. File inspection identifies a PE32 x86 InstallShield self-extractor; its outer CAB lists Setup.ini/data1/data2 payloads dated 2002-10-31. This is an installer pin, not yet the executable target pin or gameplay evidence.

Owner Telegram151 suggested Archive.org. Its bounded software/demo search returned seven compilation collections/discs, with no standalone demo result; no compilation was downloaded. Search response and installer acquisition pin are retained in `scratch/runs/20261103-stronghold-acquisition/`. Next worker should use this local installer instead of downloading another copy.
