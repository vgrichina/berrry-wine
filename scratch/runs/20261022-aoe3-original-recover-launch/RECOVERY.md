# Original Age of Empires III Trial recovery

Task `NEW-GAME-AOE3-DEMO-20261010`, single bounded assignment. All large files
remain on assigned **bx_5mu9dnhg**, under `/home/user/aoe3-original-oct22`.
Coordinator owns shutdown. Leave this same box running; expiry
**2026-10-22 10:48:47.315 UTC**, shutdown checkpoint 10:38, handback by 10:28.
No new, resumed, or forked box is authorized by this recipe.

## Acquisition and extraction actually performed

On that box, curl followed the exact authorized Archive.org member URL:

```
https://archive.org/download/win-98-games-a-d.-7z/Win98_Games-A-D.7z/Age-of-empire-3trial-Win98-SW.exe
```

`acquisition/response-headers.txt`, `curl-receipt.json`, `curl-exit.txt`,
`started.txt`, `bytes.txt`, and `SHA256SUMS` retain the response and fresh
identity. HTTP 200 after one redirect; 383598224 bytes; SHA-256
`4ef69289dfa0817ec14942d85ef597835a9d2b09e1506c60b9938b20daa274ad`.
Any mismatch must stop before execution. No alternative package was used.

7-Zip identified an InstallShield overlay, not a directly extractable MSI.
Existing distro tools were installed on the assigned box: p7zip-full,
msitools, cabextract, unshield. The original bootstrap was then run once with
the verified historical module and exact matching CLI source:

```
cd /home/user/aoe3-original-oct22/runtime
NODE_PATH=/home/user/aoe3-original-oct22/runner/node_modules timeout --signal=TERM --kill-after=15 480 node test/run.js --exe=/home/user/aoe3-original-oct22/acquisition/Age-of-empire-3trial-Win98-SW.exe --no-build --wasm=/home/user/aoe3-original-oct22/runtime/build/wine-assembly.wasm --max-batches=1000000000 --max-seconds=420 --stuck-after=0 --no-close --quiet-api --quiet-blocks --save-vfs=/home/user/aoe3-original-oct22/bootstrap-run/vfs --capture-launch=/home/user/aoe3-original-oct22/bootstrap-run/capture --png=/home/user/aoe3-original-oct22/bootstrap-run/final.png
```

It exited 0, without answering an installer dialog or launching a child.
`bootstrap-run/capture/launch.json` records the requested instmsia child and
arguments. Capture preserved the completed MSI before bootstrap cleanup:

```
bootstrap-run/capture/windows/temp/_is1/age of empires iii trial.msi
```

MSI: 375136768 bytes, SHA-256
`7acf583b5d6af78f352a341ca87166a890ac149724a73e43947520e9879aa01b`.

From the task root, the exact extraction was:

```
msiextract -C installed 'bootstrap-run/capture/windows/temp/_is1/age of empires iii trial.msi'
msiinfo extract 'bootstrap-run/capture/windows/temp/_is1/age of empires iii trial.msi' Data1.cab > msi/Data1.cab
```

The CAB is retained as `msi/Data1.cab`, SHA-256
`0666e034f1cfa40336a9a3a462ad636e1647ec7dc025d68f00ab941b8c87f49f`.
`msi/{Directory,File,Component}.tsv` retain the original MSI mapping;
`installed-audit/installed-manifest.json` seals all **174 files / 569072090
bytes**. `installed/Age of Empires III/age3.exe` is SHA-256
`5d7fb9a8ae28e3e3758cee1346b2960f20ba7b4feaa511fa7f52ceffeeeca256`.
The original StringTable is `data/stringtable.xml`, 2404654 bytes; case is
lowercase on disk and the guest filesystem is case insensitive.

## Historical runtime and launch configuration

`stage.py` inventories the existing accepted module before transfer, reads the
canonical archive in place, and verifies each staged historical runtime file
against Git. `stage-cli.py` adds matching CLI helpers. Neither builds an engine.
`module-inventory.json` and `canonical-source-verification.json` identify
historical source `c26252c4a95babe583ade1d1c6e2da0c050be45c`, canonical
qualification `ce4ce4f95eacaedff1b3e386f3ce3ae5d85bd16c`, archive SHA-256
`3e308c0012e996070a01c1f77d6f399e9aaf7adb2d2620b27af018a80d29e248`,
module SHA-256
`f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7`
(1878971 bytes), and matching source trees. This is not main qualification.

`prepare-installed.py` hashes the untouched installed tree, inventories raw
imports, creates the XP/native-MSXML registry configuration and writes the
exact command to `installed-audit/launch-command.json`. Eight explicit native
DLLs are msvcrt, Explorer98 shlwapi, original rockall/granny2/deformer/bink,
and original MSI `System:System/msxml4r.dll` and `msxml4.dll`. The resource
DLL is visible in VFS before MSXML initialization. The CLSID
`{7c6e29bc-8b8b-4c3d-859e-af6cd158be0f}` maps to `c:\msxml4.dll`.
The complete 199 runtime/helper/font/support pins plus 174 installed pins
passed before and after the game run. Runner pngjs 7.0.0 was installed in a
separate `runner/` package; served package files were not changed.

`launch-game.py` executes the saved command once with a fresh output directory,
600-second guest-loop bound and 660-second outer timeout. `control.py` uses
the existing loopback control server for screenshots and ordinary input.
The sole successful game input was `click:163:424` on the reviewed Accept
button. No unsupported-system button was pressed. `quit` stopped the harness.
The initial png/click requests used rejected protocol shapes; their failure
receipts remain, and they caused no guest input. There was no second game
launch or configuration retest.

## Recoverable state and evidence

`acquisition/` holds original media; `bootstrap-run/capture/` holds MSI and
captured bootstrap state; `msi/` holds the CAB and mapping tables;
`installed/` is the original mapped tree; `runtime/` holds the historical
module/source/fonts/fixtures; `game-run/` holds log, captures, final registry
and saved VFS. No extra game-created files were found outside mounted original
files and standard system/support fixtures in the final VFS.

`collect.py` recovers only bounded logs, receipts, manifests, configuration and
images. Local `raw/` is the evidence subset, not a media backup. The remote
originals require the coordinator's lifecycle preservation. No public hosting,
deployment, runtime admission retry, other box access, or lifecycle action was
performed. A future runtime attempt requires a new coordinator assignment;
this task stops at the observed dialog blocker.
