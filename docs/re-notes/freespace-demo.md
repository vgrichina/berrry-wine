# Descent: FreeSpace - The Great War (demo)

Volition / Interplay, 1998. Four-mission demo (training + campaign start).
Registered as `freespace_demo`.

## Fixture and install (headless)

- Source: `test/binaries/win98-games-a-d/Descent-Freespace-sdemo10-SW-Glide.exe`,
  a WinZip SFX around an InstallShield 5 Disk1 (16-bit `SETUP.EXE`).
- `7z x` it; run `SETUP.EXE` with `--vfs-include='*' --tick-ms-per-batch=5
  --capture-launch=cap` (at 200 ms/batch the 16-bit launcher's splash timer
  quits before `_INST32I.EX_` is expanded) -> `_ins0576._mp`.
- Run that from the capture (`--exe-guest-path`, `--vfs-tree=cap`, frozen
  `--control`), Next x4, step to "Setup Complete", with
  `--save-vfs-prefix='c:\games'`: 6 files + `data\`, 39 MB, in
  `C:\Games\FreeSpaceDemo`. Kept at `Descent-Freespace demo-SW/installed`;
  `node tools/gen-win98-games-a-d-manifests.js` writes its manifest.
- `fs.exe` is the game (DDRAW, DINPUT, MSACM32...); `freespace.exe` is the
  launcher/configurator.

## What it needed (2026-10-06)

1. **acmGetVersion** (bc86ea02): not an API before; the import trapped.
2. **Monotonic QueryPerformanceCounter** (64355808): its timer
   (`exe+0x438cf0`) resets its base whenever QPC goes backwards; ours could,
   across guest threads (per-instance sub-ms counter), so the frame limiter
   at `exe+0x411980` computed a negative elapsed time and slept 31.9M ms in
   flight. Now one process-wide count.

It warns "Could not properly initialize the Microsoft ADPCM codec" (no ACM
codecs are installed here) and offers to continue: `dlg-cmd:6` (Yes).

## Route (CLI, default clock)

`--input=60000:dlg-cmd:6`, then at ~200K batches type a callsign (VIPER)
and Enter -> main hall; click the ready-room door (380,310) -> Training
Mission 01 briefing; COMMIT (595,440) -> in flight. The directive "Target
Instructor - Press T": T targets the GTF Apollo instructor (target box,
target panel, directive cleared).

Evidence: `scratch/runs/20261006-freespace-demo-target`.

## Open

Audio (missing MS-ADPCM ACM codec), FPS, browser route.

**ACM drivers (2026-10-11, w5; Telegram #39).** Startup's sound setup:
1. `acmGetVersion`.
2. `acmDriverEnum(..., fdwEnum=ACM_DRIVERENUMF_DISABLED)`, with `acmDriverDetailsA` for each driver.
3. `acmDriverPriority(MS-ADPCM hadid, 0, 0)`. This is a no-op call; it was unimplemented and crashed the page after dc7e8454d added the ADPCM codecs.
4. `acmStreamOpen` through the MS-ADPCM driver handle, with `fdwOpen=NONREALTIME`. The source is MS-ADPCM, mono, 22050 Hz, 512-byte blocks; the destination is **8-bit** mono PCM at 22050 Hz.
5. `acmStreamSize` and `acmStreamConvert` follow.

What changed:
- `acmDriverPriority` is implemented with shared enable/priority state (`$ACM_DRIVER_STATE`).
- The ADPCM codecs now also decode to 8-bit PCM. Before that, step 4 returned ACMERR_NOTPOSSIBLE.

The game now reaches Choose Pilot with its ADPCM streams converting.

**Mission launch "Illegal subsystem type" (2026-10-11, w5).** Once FreeSpace found ADPCM codecs, COMMIT ended in `Error: Illegal subsystem type. File: Ship\AiCode.cpp Line: 8931` over a noise-filled view. The route flew on Oct 6 (0bf7f395) and on dc7e8454d^, when no codec existed.

Bisecting is not useful here: every commit from dc7e8454d up to d33ffec74 crashes earlier, at the missing acmDriverPriority. dc7e8454d with d33ffec74 cherry-picked fails identically to main, with the same API count.

How the fault was found:
- `--break-api=MessageBoxA` gives the caller `0x4a312d`. Disassembly shows a subsystem loop with `type = [esi+0x4c]`, valid 1..10.
- A dump at the assert shows ESI's record (`0x937bdc`) full of ADPCM-looking nibbles.
- `--watch=0x937bdc --watch-js-only --watch-log` keeps the timing unchanged and shows the record overwritten at batch 1424. That is a 0x8D659-byte ReadFile into 0x8c391c from thread 3, the voice streamer.

The streamer (T2) loops `acmStreamSize(has, N, &src, DESTINATION)` → `mmioRead(src)` → `acmStreamConvert`. At a stream's tail N=1792 is less than one 2024-byte block. We returned ACMERR_NOTPOSSIBLE without writing `*pdwOutputBytes`, and FreeSpace ignores the error and read the stale stack value.

msacm32 (and Wine) clear the output before asking the driver, so `acmStreamSize` now does too. With that the mission flies with voice streams on, and T targets the instructor.

Evidence:
- `scratch/runs/20261011T1200Z-freespace_demo-mission-regression-w5` (diagnosis);
- `scratch/runs/20261011T1240Z-freespace_demo-flight-w5` (fixed).

Note for timing: `--watch` without `--watch-js-only` arms a per-block WAT watchpoint, and that moved this crash away. Sample in JS when timing matters.

## Original browser DirectX startup blocker (2026-10-31)

The current original software/threaded browser stops at **DirectX required**,
not Choose Pilot. A fresh CLI startup reproduces the same failure at batch 27;
this is not a browser-only DirectDraw problem. No menu/flight claim applies to
this retest.

The original `fs.exe` (SHA256
`4f3601f058b7eba75a35d092414d1edcc95d82e24dff5f3090bc6639beea2f2a`)
opens `HKLM\Software\Microsoft\DirectX` at `0x413d78`. It queries `Version`
into a 32-byte buffer, finds the first dot and parses the following integer.
If that query fails it tries `InstalledVersion` into a four-byte buffer.
At `0x413e0d` it requires the resulting signed integer to be at least 3.
A failed key open jumps straight to that comparison with zero; the message
call returns to `0x413e26`, then startup returns failure. The CLI trace records
`RegOpenKeyExA` returning `ERROR_FILE_NOT_FOUND` (2). The browser trace and
reads of the original guest strings confirm the same key/caller/message.
There are no file-version calls before this rejection.

The October 6/11 CLI flight observations above predate `58e90870a` (October
22), which intentionally removed the fabricated global DirectX 7 registry
stamp, as well as synthetic DirectX DLL version resources. Those historical
routes therefore do not demonstrate that an actual runtime was installed.
`lib/storage.js` now correctly leaves the key absent unless an installer or
import supplies it. `lib/process-boot.js` correctly supplies no fabricated
DirectX file versions. Neither policy was changed here.

The retained installed fixture has the game, data, launcher and uninstall
files, but no DirectX runtime/installer or installer-produced registry export.
The source SFX path in the historical installation recipe is also absent in
this checkout. **Unresolved prerequisite:** recover and run a genuine DirectX
installer, preserving its actual files and exported registry state, or recover
an existing installation with that provenance. Then replay the original
startup toward Choose Pilot/main hall/flight. Setting a version merely to pass
this comparison would conceal the missing prerequisite and is not a fix.

Evidence: `scratch/runs/20261031T0252Z-freespace-directx/` contains the reused
`driver.cjs`, two inspected browser PNGs, API console, CLI trace, original
startup disassembly, removal diff, input hashes, complete captured host/module
snapshots, replay verification and `REPORT.md`. It reuses
`20261031T0250Z-freespace-browser` rather than restaging assets: all eight
original pins match; all 103 host/module snapshots match; 113 recorded host
responses match those snapshots. Actual module SHA256:
`8333a35b1efa694462033e87f62ce4a3f5497941d1423540b39a590c9d31134a`;
full compiled-source identity remains unknown. Chrome 151.0.7922.108,
1024x768, cross-origin-isolated, software renderer, guest Worker enabled.

Focused checks passed: `test/test-directx-registry-metadata.js`,
`test/test-static-dx-version.js` (12 assertions using that pinned module), and
`test/test-directx-system-files.js` (current source compilation). No production
source changed, so no canonical build was required. The own browser/controller
exited, profile was removed and server port was verified closed. No Boat or
assigned test box was used (ID/state/expiry: N/A).

## Genuine DX7a setup: reboot pending (2026-10-31, evening)

One real setup run now supplies the missing installer provenance, but **the
installation is not complete enough to launch the game**. The installer reports
success requiring restart, and four core DLL replacements remain queued.
No FreeSpace launch, Choose Pilot, main hall, targeting or flight was attempted
from this incomplete state.

The owner-designated local source is
`test/binaries/win98-games-a-d/Colin-Mcrae-Rally2-demo-D3D/extracted/dx7aeng.exe`,
6,340,040 bytes, SHA256
`564de93dcc50691480332e2ccb5565908760b295faa70f8c68854f69dad87189`.
This is a pinned local candidate, not an independently authenticated upstream
package. `7z x` recovers 109 cabinet members. `directx.inf` selects actual
`WIN98_INSTALL` file-copy and registry sections; `dxver.inf` contains the
version entry. Neither INF was manually applied.

Evidence and recovery: `scratch/runs/20261031T2018Z-freespace-real-dx/`.
`package/` retains every extracted member; `original-pins.json` and
`input-vfs-pins.json` pin all installer members, the original game fixture and
available DLL fixtures before execution. Important native installer identities:

| File | SHA256 |
| --- | --- |
| dxsetup.exe | a4f7e853c6b910ecc421d10ade8fa7b2da83dc3ee11424eea320788bd02fad16 |
| DSETUP.dll | 58224deca14927e84d876f1a353d9996303fa61be6990da2470d5635ad692f18 |
| dsetup32.dll | e1ab548cc74c1a81002176174122f75c555f4b0ba9857f3da99e2a0339392a46 |
| setupapi.dll | 51f2682279e28386aa9c0eb8ba4f8ac3000c9ff75cf7e2456e8cdd9f0c544159 |
| cfgmgr32.dll | 572387372791a7bc8d336fbbb6af6a9651a627124599f862ac2bd235145b7b80 |

The isolated CLI run executes `C:\directx\dxsetup.exe /silent` with real
elapsed ticks, default guest threading, the pinned canonical module and private
`--vfs-tree`, `--save-vfs` and `--reg-export` destinations. The exact argument
array is `installer-command.json`. `installer.log` records native
`DirectXSetupA` at `0x012e02d7`, then native `iDirectXSetup` in `dsetup32.dll`;
the built-in success-only `DirectXSetup` handler was not called. Native
SETUPAPI/CFGMGR32 and the ordinary retained COMCTL32 were loaded. No global DLL
policy, registry default, installed foreign fixture or production source changed.

`result-vfs/` preserves the real resulting files, including
`windows/directx.log` and `windows/wininit.ini`; `result-vfs-pins.json` hashes
every exported file. `installer-registry.json` is the unedited installer-produced
export, containing `HKLM\Software\Microsoft\DirectX\Version=4.07.00.0716`
and `RC=1`. The final installer log says
`Installation ended with value 1 = Installation succeeded need restart`.
The guest exits with 1; the CLI host exits with 0. No unimplemented API trapped.

**Exact remaining prerequisite:** native setup queued these `[Rename]`
operations in WININIT.INI. Each staged file exactly matches its package member
(full hashes and joins in `pending-reboot.json`), while each current target
remains a 1,024-byte built-in placeholder:

| Target in C:\WINDOWS\SYSTEM | Queued source | Bytes |
| --- | --- | ---: |
| ddraw.dll | SETP5.tmp | 352528 |
| d3drm.dll | SETPc.tmp | 437008 |
| dplayx.dll | SETP13.tmp | 218384 |
| dsound.dll | SETP21.tmp | 399120 |

The file also queues deletion of old dplayx.dll and dsound.dll. No retained
`wininit.exe` or existing WININIT replay path was located in the current runner,
boot helper or VFS implementation. Complete the genuine reboot/install
transition against this retained private state before importing it into an
original-game context. Merely importing its now-present Version value would
skip the installer's pending file operations. No manual rename, registry stamp,
INF-only shortcut or setup retry was performed.

Recovery without another download: verify the source hash, extract with
`7z x -o<private-package> <source>`, verify all members against
`original-pins.json`, and use the retained `result-vfs/` plus
`installer-registry.json` as the reboot-pending checkpoint. Preserve the raw
WININIT file, including duplicate NUL entries and ordered operations.
`prepare.py`, `install.py` and `finalize.py` document the actual preparation,
single execution, hash joins and cleanup; do not rerun setup just to recover
state already retained here.

Input main was `eecf56f5c`; actual preparation/run main was `2d61cfa16`.
All 528 retained source and 867 compiler/input hashes matched the preceding
canonical build, whose module SHA256 is
`d39f362187ce89abda47fa53bca6bb6576badd8d21b78e44c6fbad973d1636d8`.
Before/after original, source and compiler checks passed. The registry metadata
test passed; static version test passed all 12 assertions against that module;
system-files test passed with current source compilation. Fabricated-metadata
removal policy and tests remain intact. No source change required a new build.

The silent setup's final PNG was personally inspected: plain teal desktop,
not an installer-success or gameplay screen. The log, exported files and pending
operations establish the result. No audio/FPS claim applies. No browser/server
or helper process was launched; the own CLI was durably reaped, its PID/start
identity absent, whole Chrome/crashpad census empty, predecessor ports closed,
no profile or held input, and `/tmp/wine-browser.lock` free. See
`full-release-final.json`. Boat ID/state/expiry: N/A.
