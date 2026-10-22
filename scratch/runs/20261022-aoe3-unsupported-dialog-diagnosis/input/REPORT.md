# Original AoE3 Trial recovered; post-EULA unsupported dialog blocks progress

Task **NEW-GAME-AOE3-DEMO-20261010** completed its bounded attempt on
2026-10-22. The original game launches, its populated EULA was reviewed, and
ordinary **Accept** input dismissed it. The next visible checkpoint is an
original dialog titled **`<unsupported>`**, HWND **0x1000f**, with blank body,
edit, checkbox and button labels. No menu or gameplay was reached. No button
in that unlabeled dialog was pressed, no engine/API/stub/guest changes were
made, and no configuration retest or second original game launch occurred.

The exact observed blocker is this post-EULA dialog, not a demonstrated
unimplemented API invocation. Read-only resource inspection identifies the
title in original `age3.exe` **RT_DIALOG 177, language 1033**, offset **8631880**,
432 bytes, SHA-256
`9c2480eae1444b90eff519a7451235f21a4ee79ea175b86605fc240f5a659fb6`.
The caption is in the original media; it is not an emulator diagnostic label.
Why its dynamic text remains empty is unproved. No failing API or specific
hardware requirement is attributed without evidence.

## Original media, freshly verified

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Authorized exact installer | 383598224 | `4ef69289dfa0817ec14942d85ef597835a9d2b09e1506c60b9938b20daa274ad` |
| Captured original MSI | 375136768 | `7acf583b5d6af78f352a341ca87166a890ac149724a73e43947520e9879aa01b` |
| Original embedded Data1.cab | 370869423 | `0666e034f1cfa40336a9a3a462ad636e1647ec7dc025d68f00ab941b8c87f49f` |
| Installed age3.exe | 8826880 | `5d7fb9a8ae28e3e3758cee1346b2960f20ba7b4feaa511fa7f52ceffeeeca256` |

The exact Archive.org member download returned HTTP 200 after one redirect,
with TLS verification result 0. Its response headers, full curl receipt,
byte count and hash were preserved before execution. No alternate bytes or
historical-only hash claim was substituted. `RECOVERY.md` gives exact URL,
bootstrap command, MSI/CAB extraction, source/module recipe and remote paths.

The bootstrap exited 0 after extracting the completed MSI; its requested
instmsia child was captured and was not executed. Host msiextract then mapped
all **174 original files / 569072090 bytes**. The full installed SHA-256
manifest and MSI Directory/File/Component tables are recovered locally as
evidence. Original native MSXML4/resource DLLs, rockall/granny2/deformer/bink
and the existing msvcrt/Explorer98 shlwapi fixtures are retained and pinned.
Original `data/stringtable.xml` is 2404654 bytes, SHA-256
`62fa66202af9e6ea6b98a7bb4b429a6fc724f51b57831c2b3062253ddb249f17`.
Its lowercase on-disk spelling is not a missing-payload failure.

## Tested identity and route

The focused task checkout is based on accepted main
`63d563df7a2b901d222a311ceaf55a0823a22261`; the tested engine is historical
source **c26252c4a95babe583ade1d1c6e2da0c050be45c**, module
**f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7**,
1878971 bytes. The accepted canonical archive was located from prior AoW2/
Arcanum receipts and read in place, SHA-256
`3e308c0012e996070a01c1f77d6f399e9aaf7adb2d2620b27af018a80d29e248`.
Canonical qualification ce4ce4f95eacaedff1b3e386f3ce3ae5d85bd16c has matching
src/lib/tools/host/index/lock trees. All **5625** source/supplement blobs were
rehashed. No build was run. This result does not qualify current main.

Environment: assigned Boat bx_5mu9dnhg, Linux x86-64, Node **v24.18.1**,
existing CLI raster renderer, **640×480**, XP guest version **0x0a280105**.
CLI main-thread guest execution was used; no browser or additional game worker
was launched. The original game was run once with the exact command in
`raw/installed-audit/launch-command.json`, explicit native DLLs and native
MSXML CLSID configuration. Module/source/API table, 29 fonts, support fixtures,
matching CLI helper closure and installed tree were verified before execution.
All **373** runtime-plus-installed pins passed again after exit. Separate
runner pngjs 7.0.0 dependencies are inventoried in `runner-manifest.json`.

Static import audit retains raw objdump outputs. Its simple comparison finds
**53 unmatched named entries** plus **45 ordinal rows it does not resolve**;
these are inventory, not 98 demonstrated unsupported API invocations.
Native ordinal dispatch and unused imports cannot be classified as runtime
failures from this audit. There is no unimplemented-API trap in the captured
game log. The existing harness's MSVCRT initialization warning
`MSVCRT rejected _set_sbh_threshold(0)` is retained, and did not prevent EULA
display. Existing harness CRT environment initialization is unchanged.

Reviewed `raw/game-run/eula-before.png` shows the populated English EULA and
Accept button. `control-accept-click.json` records successful ordinary
`click:163:424` at batch **4700011**. The EULA disappears and the next dialog
appears in `raw/game-run/after-accept.png`. Thus **acceptedInGuest=true** for
this observation under the supplied authorization; persistence on another
launch is untested. The initial png and click protocol requests were rejected
without guest input and are retained as such; they are not additional launches.

Read-only snapshot and `dlg-dump` receipts identify controls **2, 1032, 1034,
1035, 1036, 1030**, with empty captions. Snapshot EIP **0x075010d8** shows a
live modal wait; this is not a crash-PC attribution. The reviewed final PNG
matches the post-Accept dialog. The sole game run ended after **168.017308s**,
exit **0**, on a bounded harness quit. This exit is not completion of the game.
No speculative buttons, capability bypass, API fixes, audio/FPS/parity/full-game
claims, or additional route were attempted.

## Handoff and scope

**SAME box bx_5mu9dnhg is RUNNING**, API state `idle`, health `ok`, stop `null`.
No guest/controller remains and port 8123 is closed. Retained root:
`/home/user/aoe3-original-oct22`; `HANDOFF.json` exists there and locally.
The original installer, MSI, CAB, installed tree, historical runtime, final
registry/VFS and full logs remain on that box. At handoff verification free
space was **45548572672 bytes**. Expiry **10:48:47.315 UTC today**, coordinator
shutdown checkpoint **10:38**, requested handback **10:28**. The coordinator
owns preservation/shutdown. This worker did not stop/delete/resume/fork it.

Local evidence is bounded: only important receipts, logs, manifests and PNGs
were recovered. No media, extraction or build artifact was stored locally.
The full Git commit object and a narrowed **56640-byte** checkout projection
were verified before materialization; an earlier 37.2MB projection plus 32MiB
reserve was rejected before writes and narrowed. Total task allocation remains
below **64MiB**, with free space above **2982150144 bytes**; final measurement
is in `allocation.json`. Root WIP/index/config/TODOS/STATUS were not edited.

This unregistered title has no candidateId in the accepted manifest; no
dashboard `result.json` was fabricated. `task-result.json` is task metadata.
Evidence seals/replay and syntax checks precede the task-branch push; exact
commit, independent actual GitHub ref verification and allocation are appended
to the root messageboard. No main merge, public hosting/deployment, other box,
other game, worker/delegation/refill, or held timer-thread/CMR3 work occurred.
The bounded task stops here with ownership returned to the coordinator.

Authored diff check passes. Raw HTTP headers/MSI TSV CRLF and objdump whitespace
are preserved byte-for-byte; `diff-check.json` lists the exact raw-only exceptions.
