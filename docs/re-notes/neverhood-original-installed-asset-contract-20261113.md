# The Neverhood original installed/CD asset contract (2026-11-13)

Static examination of the original candidate's `NHC.EXE`, matching `SMACKW32.DLL`, README and `SETUP95.EXE` establishes an installed executable plus local `HD.BLB`, with the remaining archives normally found through the CD directory stored in the registry. The game enumerates archives and indexes their contents; finding an executable or registering its imports does not establish startup.

This extends the [complete CD intake](neverhood-original-cd-intake-20261113.md). It does **not** establish installed availability, successful startup, full retail status, publisher authenticity or gameplay. No installer/game/emulator/native fixture/browser/build/box ran; no guest, save or registry state was written.

## Original bytes and recovery

Evidence is `scratch/runs/20261113-neverhood-install-static-0910/`. The prior `scratch/runs/20261113-coordinator-neverhood-stream-0820/manifest.json` supplies the exact ISO extents and complete hashes of all 257 files. The image identity and seven large archive hashes remain in the intake; they were not downloaded again.

Only these six complete small files were read through bounded HTTP 206 ranges (at most 262,144 bytes each), checked for exact Content-Range/length and full manifest SHA-256, and retained temporarily in this worker's RAM directory. There were no denied responses or retry/access workarounds. `fetch.py` and `http-receipts.json` preserve the recipe and individual range hashes.

| CD path | Bytes | SHA-256 |
| --- | ---: | --- |
| `SETUP/NHC.EXE` | 810496 | `82bf1e31ad6c811a4915f49da1a5ea841cc23b37b0ee212c6d90fddbba97d011` |
| `SETUP/SMACKW32.DLL` | 66048 | `3f21682e8b2eb3ce69f776be0ef84d8bb13c295da885d509329f4f873517ae0e` |
| `SETUP95.EXE` | 202240 | `ceae7885f49569fdc1100870286634c36d05eabe6010c228efef214c9444a95e` |
| `README.TXT` | 10955 | `67d23ea0523aaf4fbc7de528f646a677b29d1c365fca3ba2311d9b7e71d26c0c` |
| `AUTORUN.INF` | 213 | `b8bb8e9c78cf10b31d59f8bd2c5f9edc8cfacbbdc0ec17da64b957550417db82` |
| `SETUP.EXE` | 5904 | `b140041bdcf2eedc266f92acd05597f921e877c8605dc62dc8c3597e76528cb8` |

Addresses below are preferred x86 virtual addresses (image base `0x400000`), not file offsets. `parse.py`, PE structure JSON, `resource-decode.json` and selected `*-disasm.txt` retain the static basis. The parser operates on bytes only. `SETUP.EXE` is the small legacy NE entry; the decoded installation contract here is the original PE `SETUP95.EXE` selected by `AUTORUN.INF` (`open=SETUP95.EXE`). Autorun also offers README and `setup\dxinstall.exe`.

## Installed and CD paths

Let `I` be the user-selected install directory, and `D` the directory containing the original CD's `SETUP95.EXE` (normally a CD root such as `D:\`). The embedded default relative install path is `DreamWorks Interactive\Neverhood`; no fixed drive or absolute Program Files path is established here.

| Original CD source | Installed destination / role |
| --- | --- |
| `SETUP\NHC.EXE` | `I\NHC.EXE`, ordinary native game entry |
| `SETUP\SMACKW32.DLL` | `I\SMACKW32.DLL`, exact matching codec DLL beside the EXE |
| `DATA\HD.BLB` | `I\HD.BLB`, local archive |
| `SETUP95.EXE` | `I\SETUP95.EXE`, setup/uninstall UI |
| `README.TXT` | `I\README.TXT` |
| `DATA\A.BLB`, `C.BLB`, `HD.BLB`, `I.BLB`, `M.BLB`, `S.BLB`, `T.BLB` | Preserve complete `D\DATA\` archive set for play; individual first-room necessity is not established |

These destinations are decoded, not inferred from CD names: SETUP95 RT_RCDATA records 8000/8001/8002/8003/8006 (file offsets `0x2e0f4`, `0x2e118`, `0x2e144`, `0x2e168`, `0x2e1e4`) contain copy opcode 3 and the source strings. Dispatcher `0x409090` decodes opcode/flags and routes copy parsing to `0x407d10`, execution to `0x408000`. Parsing selects install-directory field `[this+0xc8]` at `0x407e80`, combines it with the source basename/extension, and execution passes source/destination to the copy helper at `0x4080d0`. Thus `HD.BLB` goes directly in `I`, not `I\DATA`.

Records 8005/8007 specify Start Menu shortcuts `DreamWorks\The Neverhood.lnk` and `DreamWorks\The Neverhood Read Me.lnk`, targeting `%esetup95.exe` and `%ereadme.txt`; setup is the ordinary launcher UI. Formatter `0x4076b0` resolves `%e` to the install directory, `%d` to source directory, `%c` to publisher, `%p` to product and `%m` to Programs. Record 7000 also identifies `setup\nhc.exe` and uninstall command `%esetup95.exe /uninstall`.

The original README requires installation, retaining the CD during play, and exiting before removing it. These remain the ordinary supported layout instructions even though the static game reader also accepts other directories.

## Configuration and registry

All following roots are **HKEY_LOCAL_MACHINE**, not HKEY_CURRENT_USER. Spelling/case below follows original strings; Windows key comparison is case-insensitive. No game INI reader/import was identified; this is evidence for the registry contract, not proof that no other configuration exists anywhere.

| Key/value | Original evidence and meaning |
| --- | --- |
| `SOFTWARE\DreamWorks Interactive\Neverhood` | Setup builds the key at `0x4073a0`; game separately opens SOFTWARE, publisher, product with KEY_READ (`0x20019`) in `0x48d790` |
| `Data Drive` (REG_SZ written by setup) | Setup write `0x4094c0`, read/default `0x409530`: source-directory field `[this+0xcc]`, falling back to the setup module's directory. This identifies the CD/source directory, not its `DATA` child |
| `Installed Directory` (REG_SZ) | Setup write `0x409e50`, read `0x409ed0`: chosen `[this+0xc8]` directory |
| `Installed` (REG_DWORD) | Setup write `0x409690`, read `0x409700`: installation state; not a game asset-path replacement |
| `MusicOn` | Game `0x469c50`: read defaults enabled; a successful nonempty value whose first byte is ASCII `0` disables music (`0x469e65`). Write branch emits a two-byte REG_SZ boolean. Startup reads it at `0x48ada2` |
| `Software\DreamWorks Interactive\Neverhood\Saved Games` | Game save/load/delete/enumerate helpers at `0x469b50`, `0x469ba0`, `0x469bf0`, `0x469c10`, `0x469c30` pass this HKLM path. README explicitly describes registry saves rather than save files |

The NHC archive lookup queries `Data Drive` with a 260-byte buffer and does not request/validate the value's registry type. Missing key/value is not immediately fatal; other search directories are still tried. `Installed` and `Installed Directory` are setup state; the examined game lookup obtains its executable directory from argv[0], not from `Installed Directory`. Do not fabricate registry/save writes merely to satisfy import registration.

## Actual asset lookup and rejection branches

`NHC.EXE:0x48d790` assembles five directories, removes one trailing backslash from each through `0x48d760`, then calls `0x4916f0(directory, "*.BLB")` in this order:

1. Current working directory (`0x48db5a`).
2. Executable directory split from argv[0] (`0x48db7e`).
3. argv[1], if present/nonempty (`0x48dba8`): one additional directory, not an established switch syntax.
4. Registry `Data Drive`, if nonempty (`0x48dbd2`).
5. Registry directory plus `\Data` (`0x48dbfc`). With no registry directory this construction still yields root-relative `\Data`; it is not automatically skipped.

Every nonempty candidate is enumerated; success in an earlier directory does not stop the later scans. At `0x4916f0`, path resolution, `FindFirstFileA`/`FindNextFileA`/`FindClose` and per-file indexing replace any hardcoded seven-filename list. Non-dot archive names go to `0x4919b0` and loader `0x493d00`. The loader checks the header magic DWORD `0x02004940`, version byte 7, and header file size against actual size (`0x493d51`–`0x493d87`), then indexes resource IDs/records. Duplicate IDs compare metadata field +4; only a higher incoming field replaces the prior record (`0x491a8f` onward). Its semantic name is not assumed here.

The return through `0x490a90` is a zero-extended 16-bit indexed-resource count, not a count of BLB files. Startup compares it against **500** (`0x48ac5c`, unsigned `jae 0x48ac96`). Below 500 it displays the CD-read error and requests termination. Reaching 500 is only this admission condition, not proof that every later room/movie resource exists. The archive-backed reader at `0x490aa0` opens the remembered path using `CreateFileA` (GENERIC_READ, sharing read/write, OPEN_EXISTING) and seeks to the resource offset. Preserve both local and CD paths for later reads; there is no basis here to substitute a single staged EXE or an arbitrary count of empty archives.

## Matching Smacker DLL and API boundary

The actual manifest-matched DLL export address table has ordinal base 1. These are its eight ordinal imports requested by NHC; ordinal indexing must include that base (objdump's bracket index alone is not the ordinal).

| Ordinal | Export name | DLL RVA |
| ---: | --- | --- |
| 32 | `_SmackWait@4` | `0x2cf0` |
| 19 | `_SmackDoFrame@4` | `0x4180` |
| 36 | `_SmackSoundUseDirectSound@4` | `0x6640` |
| 27 | `_SmackGoto@8` | `0x31d0` |
| 18 | `_SmackClose@4` | `0x4560` |
| 14 | `_SmackOpen@12` | `0x4900` |
| 23 | `_SmackToBuffer@28` | `0x36e0` |
| 21 | `_SmackNextFrame@4` | `0x3ea0` |

The prior import evidence reports 121 named imports registered in the inspected API table. That is a name inventory, not supported behavior. NHC needs functioning filesystem enumeration/read/seek, registry semantics, window/message/input dispatch, DirectDraw surfaces/presentation, DirectSound, timers and codec execution; the original DLL brings its own imported dependencies. An arbitrary modern Smacker DLL or eight dummy ordinal stubs does not close that contract.

Concrete startup branches expose some of these boundaries: `0x48ab80` checks DirectSound initialization and fails with its original error; `0x48abc6` calls Smacker ordinal 36 (a failure selects a movie-sound warning); after asset admission, `0x48ac96` onward checks graphics initialization and can display `Unable to initialize DirectDraw.` Actual backend correctness, DLL dependency execution, installed media availability, registry permissions and sustained resource reads remain untested prerequisites. This assignment did not promote any registered API to behavioral support.

## First ordinary route and later minimal test

The PE entry is `0x494f30`; WinMain is `0x43ece0`. Its duplicate-instance check uses window class `Neverhood`, title `The Neverhood`. Window construction installs procedure `0x43ea50` and requests 640×480; the README separately describes the game display as 640×400. Game construction `0x48aa90` performs sound/asset/graphics setup, reads MusicOn, then enters `0x48bc00`. Its warning-panel route leads to `0x48bb60`, which constructs the intro object (`0x4825a0`). Completion callback `0x48ccd0` proceeds to `0x48bd80`, which sets game-variable ID `0x91080831` to `0x03294419`, constructs object `0x4836c0` and installs callback `0x48cde0`. These are static control-flow observations; no rendered intro or nursery was observed.

The README's ordinary Play route starts at the beginning, wakes Klaymen and explores the nursery. Its Escape options include Resume Playing and Quit. The original window procedure routes `WM_KEYDOWN` into `0x43e890`; Escape's table entry reaches `0x48b9f0`, whose ordinary active-game branch queues the menu flag. Tick processing reaches `0x48ba20` and menu creation `0x48bac0`. Mouse messages `WM_MOUSEMOVE`, `WM_LBUTTONDOWN`, `WM_LBUTTONUP` reach `0x48b690`, `0x48b6d0`, `0x48b700`, respectively, and dispatch position/down/up events to the current game object. Native message delivery and visible consequence still need observation.

A later authorized original test should:

1. Verify the installed files and matching DLL against these pins, preserve the full CD archive set, and observe the ordinary original setup/Play route and actual registry values in an isolated writable environment. Record CWD, argv and resolved CD paths; use no invented switches or injected game state.
2. Launch the unchanged installed EXE with the CD available. Capture actual warnings/intro and the first playable room; distinguish any initialization rejection from a successful rendered frame.
3. From a fresh visible frame, choose a harmless visible walking target, send mouse down/up, and capture Klaymen's visible response. Do not reuse historical coordinates.
4. Send Escape down/up, capture the options screen, choose Resume Playing from fresh coordinates and verify return to the same room. Quit through the original UI. Save/Delete is unnecessary for this minimal interaction test.

This is a test proposal only. Installed availability, startup and interaction remain open. No complete image, large archive or source snapshot was staged; only this worker's RAM inputs were removed after verification. Exact Git identity, relevant patch, checks and lifecycle result are retained in the ignored run directory. No box was created (ID none, state NOT_CREATED, expiry null, stop receipt not applicable).
