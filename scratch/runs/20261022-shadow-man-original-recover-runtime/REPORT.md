# BLOCKED — original Shadow Man Setup initialization

Task `NEW-GAME-SHADOW-MAN-DEMO-20261013`, 2026-10-22. The verified original
German demo was recovered and native-inspected, then its intact original
`Demos/Shadowman/Setup.exe` ran once. The first behavior blocker was its own
**Setup Initialization Error**: “Setup is unable to decompress and copy all of
the program files needed to proceed with the installation. Contact your
software vendor.” The log continues **Error 112**. The screenshot clips that
last line; it is preserved in `raw/setup-run/output.log`.

`raw/setup-run/initial-error.png` and `final.png` were directly inspected and
are byte-identical. This is an installer error dialog, not configuration,
menu or gameplay evidence. No license screen was reached or answered;
`acceptedInGuest=false`. No installed demo, original 3D configuration,
Neues Abenteuer, world, movement, action, or gameplay screenshot was obtained.
The exact failing operation/API and the cause of Error 112 remain unproved.
There was no unsupported-API trap in the captured log. Static unknown imports
do not establish an invoked failure.

## Fresh original media and native closure

Accepted source receipt: `b65bc9ebcf430f8b977d38af3e413717a3438dc7`, branch
`task/shadow-man-original-source-oct22`. Its helper, closure and report are
included in `raw/receipt/`; the complete receipt is also inherited in this
checkout's sibling run directory. Recovery used that exact helper on assigned
`bx_5mu9dnhg`, with no alternate source or substitution. Download started
09:19:19 UTC and completed successfully within the helper's finite bound;
`raw/recovery-{start,end,exit}.txt` and `recovery.log` preserve actual times.

| Artifact | Fresh size | Fresh hash |
| --- | ---: | --- |
| `GS1199.iso` | 674328576 | SHA-1 `f985ca1349af958f886957aa662e87956a7db22d` |
| Same ISO | 674328576 | SHA-256 `db9ca33413c53d2d333a3d4b2e220d19daab625526d8acf55c1f11e780b28a12` |
| `Demos/Shadowman/data1.cab` | 67648523 | SHA-256 `2754130ab01997713d0c03ff48c0a443c3d45e7a98d5b4b09a33e4b174d4089f` |
| Original `Setup.exe` | 73728 | SHA-256 `5656e87da0641c9dcfcd0ee8949ce72b3fa6a7d0e8b1fd985a16f6bd6c34ce52` |

Exact endpoint:
`https://archive.org/download/gsscda1999/1999-11/GS1199.iso`.
Whole-image size/SHA-1 passed before extraction; SHA-256 was freshly computed
and independently rehashed again at handoff. Original hierarchy and case were
preserved by `7z x`. The full **23-file / 73339636-byte** source set matches
the accepted directory enumeration, every size, and all ten previously sealed
whole-member hashes. Fresh SHA-256 for every member is in
`raw/recovery/extracted-members.json`. `Diverses/Directx6/Dx61ger.exe`
(7014176 bytes) is preserved and freshly hashed in
`raw/recovery/directx-recovered.sha256`. The entire ISO remains available for
any additional original disc dependency. DirectX was not executed.

Unshield 1.5.1 list/test/extraction completed before Setup. Its hierarchy was
preserved: `native/Program_Executable_Files/...`. Fresh output is exactly
**1959 files / 100354053 bytes**, and every extracted path/size matches the
native listing after unshield's group-name space-to-underscore normalization.
This equals the historical count/total, but fresh hashes in
`raw/native-audit/native-manifest.json` are the present evidence.
`_sys1.cab` and `_user1.cab` were separately extracted under `support/` for
inspection, preserving six support/license/string-table files. Original
installer inputs were unchanged. A 7-Zip inspection of `_inst32i.ex_` could
not identify it as an archive; it was retained unchanged and left to Setup.

`raw/native-audit/import-audit.json` and raw objdump outputs inventory 13 PE
images plus two NE/MZ libraries. Across the source, original support, game,
configuration and DirectX images, there are 12 unmatched named import rows
and eight unresolved ordinal rows. They are an inventory, not invocation
claims. Original DLL exports and the canonical API table are recorded.
Neither game nor D3D configuration was launched, and the compressed installer
engine was not claimed to be fully recovered.

## Exact runtime and the sole execution

No engine was built or changed. Before execution, the preserved qualification
archive was inventoried in place: SHA-256
`3e308c0012e996070a01c1f77d6f399e9aaf7adb2d2620b27af018a80d29e248`.
Its 1878971-byte module is exactly
`f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7`.
Historical source is `c26252c4a95babe583ade1d1c6e2da0c050be45c`; source,
library, tool, host, HTML and lock-file identities match canonical qualification
`ce4ce4f95eacaedff1b3e386f3ce3ae5d85bd16c`. This is historical canonical
runtime evidence, not current-main qualification.

`module-inventory.json` records these trees and 196 matching Git files; two
ignored native support fixtures (msvcrt/shlwapi) were checked against their
existing pinned local bytes. All 199 remote runtime files, including API table,
CLI helpers and 29 font/support assets, and all 28 pngjs runner dependency files
were verified before copying into this task's own root, then after copying.
The original AoE3 runtime/tree was read in place and left unchanged. No new
packages were installed. Native `_Setup.dll` and existing pinned msvcrt were
seeded using the existing loader. Raw startup output records its ordinary
native-DLL initialization; no task-added engine/API/stub/memory or executable
patch, fabricated registry/config, or gate bypass was used.

`launch-stage.py` is the exact remote driver; `raw/setup-run/command.json`
records every flag. Node v24.18.1 ran the existing CLI software renderer at
640x480 on Linux. The source directory was mounted intact with
`--vfs-include=**/*`; guest process spawning was enabled rather than replacing
installer child execution with a fabricated result. Parent control was 8123,
and any real installer child would have used 8124. No child was launched.

The guest loop had `--max-seconds=240`; an external process-group watchdog
would send TERM at 255 seconds and KILL at 260. Actual run:
**09:23:08.747660–09:23:42.169507 UTC, 33.421842585 seconds, exit 0**,
without watchdog signals. The error appeared before license acceptance or
installation. Controls were read-only snapshot, PNG, then harness `quit`;
there were no guest clicks or key presses. One premature read-only request to
the nonexistent child port was refused and delivered no guest input.

`raw/setup-run/vfs-manifest.json` independently confirms all 23 original
source members were mounted byte-identically. Setup left only its small
partial temporary engine output at
`windows/temp/_istmp1.dir/_ins5576._mp`: 69632 bytes, SHA-256
`23eaf19af07202fae358284fcc2d9e045b1fd16fbfecc2066136b3f3ba311d90`.
That exact file is preserved locally and remotely; it was not executed.
No captured child launch exists. The actual exported registry has 69 entries
and no Acclaim/Shadow Man install-state mention. Nothing was fabricated to
continue past this point.

The first behavior blocker ended the task. There was **no runtime retest**
and no cheap staging correction was justified by this evidence. Before guest
execution, two audit-script mistakes were corrected: ignored native fixtures
were initially treated as Git blobs, and the unshield summary line was
initially counted as a member. The failed native-audit receipt is retained;
neither failure executed a guest. Initial inventory count wording was later
clarified to distinguish 196 Git files from two ignored fixtures; pins and
executed artifacts were unchanged.

## Verification, recovery and handback

`verify.py` independently replays **53 recovered remote files / 1863322
bytes**, 53 archive-copy equalities, exact source set/known hashes, native
listing/manifest equality, source-in-VFS equality, archive/module identity,
250 pre/post pins (199 runtime + 28 runner + 23 source), error log, screenshot
identity, actual registry state and process/port handoff. The raw evidence
archive is 351752 bytes, SHA-256
`8ac2d9dcf22721eddc22b1b5f7e12968c8c078a21b4aa4087eb5ee4a84baa83b`.
`seals.json`, verification logs and allocation/diff checks cover the authored
bundle. Raw objdump whitespace is preserved unchanged. Shadow Man has no
candidate entry in the existing manifest; `task-result.json` is an
investigation receipt, with no unrelated dashboard candidate attached.

The same **bx_5mu9dnhg is left RUNNING** (API `idle`, health `ok`, no stop
operation). The guest process group is absent and ports 8123/8124 are closed.
Handoff had **44566994944 bytes free**. Retained root:
**`/home/user/shadow-man-original-oct22`**, with ISO, intact source/DirectX,
native/support extraction, exact runtime/runner, original source receipt,
saved VFS/registry, all logs and `HANDOFF.json`. Large media never came local.
Local floor 2982150144 bytes and 64 MiB overall task allocation were respected.

Coordinator owns lifecycle, preservation and next assignment. Handback is
before **10:28 UTC**, shutdown checkpoint **10:38**, expiry
**2026-10-22T10:48:47.315Z**. No compute creation/resume/fork, lifecycle
mutation, public hosting/deployment, children/delegation/refill, main merge,
root WIP/index/config/TODOS/STATUS edits or other held work occurred. No
Windows/audio/FPS/full-game claim is made. Worker process metadata confirmed
gpt-6.1-sol medium and 200000 TOTAL automatic-compaction launch settings.

Recovery and bounded reproduction instructions are in `RECOVERY.md`.
