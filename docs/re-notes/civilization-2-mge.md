# Civilization II: Multiplayer Gold Edition (Win32 retail)

Registry id `civ2_mge`, tree `test/binaries/candidates/civilization-2-mge-win32/`
(gitignored): `cd/` is the disc, `installed/` the game install.

## Movies are Indeo 4, and Indeo is a separate install

The advisor, wonder and council movies are `cd/Civ2/VIDEO/*.AVI`, all
`IV41` (Indeo 4). Civ2 MGE reaches them through AVIFIL32 +
`ICLocate`/`ICDecompress` and `MCIWndCreateA`. It bundles no decoder: the disc
has Intel's installer under `cd/Win_95nt Indeo/IVI_95NT.EXE`, which puts
`ir41_32.dll` (plus `ir41_qc.dll`, `ir41_qcx.dll`, `ir32_32.dll`,
`iyvu9_32.dll`) in `c:\windows\system` and registers them in SYSTEM.INI:

```
[drivers32]
VIDC.IV41=ir41_32.dll
VIDC.IV32=ir32_32.dll
VIDC.IV31=ir32_32.dll
VIDC.YVU9=iyvu9_32.dll
```

Without that install, `ICLocate` returns 0 and the game skips the movie, just
as Windows does on a machine without Indeo. With it, the emulator loads the
driver and runs its DriverProc as guest x86 (see "Installable codec drivers" in
`docs/video-support-design.md`). Intel's DLLs are never committed. Take them
from the disc by running the installer.

Watch out: the installed files differ in size. `ir41_32.dll` is **739,328**
bytes and `ir32_32.dll` is 199,168. Swap them and `VIDC.IV41` loads the Indeo 3
driver, which opens, accepts the stream and then decodes black frames. Nothing
crashes. Check the size first.

## Headless Indeo install (2026-09-28)

`S` = a scratch directory. Three stages, each an ordinary `test/run.js` run.

1. **Self-extractor.** `IVI_95NT.EXE` unpacks an InstallShield 3 setup into
   `c:\windows\temp`:

   ```
   node test/run.js --exe="test/binaries/candidates/civilization-2-mge-win32/cd/Win_95nt Indeo/IVI_95NT.EXE" \
     --overlay-dir=$S/ivi-ov --screen=800x600 --no-build --quiet-api --no-close \
     --max-batches=3000 --max-seconds=90
   ```

   Copy the overlay's files out under their real names (`setup.exe`,
   `setup.ins`, `setup.pkg`, `_setup.lib`, `data.z`, `_inst32i.ex_`, …) into
   `$S/ivi-tmp` (the overlay format is `index.json` + `blobs/`).
2. **setup.exe -sms.** It unpacks the real engine and ShellExecutes it. Capture
   that launch:

   ```
   node test/run.js --exe=$S/ivi-tmp/setup.exe --args=-sms --vfs-include='*' \
     --capture-launch=$S/ivi-cap --screen=800x600 --no-build --quiet-api --no-close \
     --batch-size=100000 --max-batches=3000
   ```

   `$S/ivi-cap` then holds the VFS tree, including
   `windows/temp/_ins0432._mp`, the 32-bit IS3 engine.
3. **The engine**, with the arguments setup passed it, clicking Next through
   the wizard:

   ```
   node test/run.js --exe=$S/ivi-cap/windows/temp/_ins0432._mp --vfs-tree=$S/ivi-cap \
     '--args=-sms -fC:\SETUP.INS  -z1 -cx -xC:\WINDOWS\TEMP\' '--cwd=C:\' \
     --overlay-dir=$S/ivi-ov-s3 --screen=800x600 --no-build --no-close --max-seconds=100 \
     --input=1400:dlg-cmd:1,1700:mousedown:493:454,1705:mouseup:493:454,2100:mousedown:493:454,2105:mouseup:493:454,2500:mousedown:396:337,2505:mouseup:396:337,2900:mousedown:493:454,2905:mouseup:493:454,3300:mousedown:493:454,3305:mouseup:493:454,3700:mousedown:493:454,3705:mouseup:493:454,4100:mousedown:493:454,4105:mouseup:493:454,4500:mousedown:493:454,4505:mouseup:493:454
   ```

   (493,454 is Next/Finish on an 800x600 screen. 396,337 is the licence
   "Yes".) `$S/ivi-ov-s3` ends up holding the five DLLs, `indeo.hlp`, the new
   SYSTEM.INI and `uninst.exe`. That overlay, or just SYSTEM.INI plus
   `ir41_32.dll`, is the Indeo machine.

**Registry quirk.** The IS script writes its ICM registration to
**HKCR**`\System\CurrentControlSet\control\MediaResources\icm\vidc.IV41`. The
guest really passes `hKey = 0x80000000`, so that is the script's own doing
and not an emulator bug. It means no Windows finds the codec through the
registry, and SYSTEM.INI `[drivers32]` is the lookup that matters on Win9x.

## Proving the decode without Civ2's own route

The simplest player that exercises the path is Half-Life: Uplink's intro, which
plays `media\intro.avi` with MCI `play sierravideo wait` into a 320x240 window
at (160,120) of 640x480. Give it Civ2's `ANARCHY0.AVI` (480x120, 15 fps,
111 frames) as `c:\media\intro.avi` in the overlay:

- `test/test-icm-indeo4-candidate.js` builds that overlay at run time from
  `INDEO_IR41_DLL` or `test/binaries/candidates/civilization-2-mge-win32/indeo/ir41_32.dll`,
  and SKIPs if either is missing.
- `--tick-ms-per-batch=20`, capture at batch 900: the stop/close come back 0.
  The best-matching ffmpeg `indeo4` frame (56), point-sampled the way
  StretchDIBits scales, is **99.98% within 24, max delta 27**, and 94.4% within
  8. The rest is YUV→RGB rounding. About 6 s wall.

Getting there took two emulator fixes (details in the design doc):
- ROL/ROR set ZF/SF. Indeo's generated VLC reader loops on `ror eax,0x10 / jz`.
- `$current_thunk_eip` was not restored after a nested DriverProc, which made
  the parked `play wait` land at address 0.

ir41_32 also calls `LocalHandle` as the stream ends.

## The game's own movies (2026-09-28)

`--app=civ2_mge` plays `opening.avi` with nothing extra: no overlay and no
`--media-mount`. `test/test-civ2-mge-movie.js` pins this. The same route works
in the browser with the guest in a Worker. It took three fixes:

- **The CD's data track.** The registered CUE is mixed-mode, and the movies
  live on its data track (`D:\civ2\video`). Registry `cdAudio` mounts used to
  mount only the audio tracks. Now both hosts mount a data track as the ISO it
  is: test/run.js through `openParts`, and lib/browser-shell.js through
  `HttpRangeProvider`s sized from the manifest's `trackSizes`. Both then go
  through `mediaImport.analyzeCueBundle`, the same plan a dropped CUE gets. The
  disc's label is its own (`Civ2:MGE v1.0`; the Win16 disc's label is blank),
  not the registry's `volumeLabel`. test/static-server.js now serves byte
  ranges for the browser tests.
- **Indeo.** The registry entry mounts `indeo/ir41_32.dll` (the file the
  install recipe above produces) at `c:\windows\system`, marked
  `optional: true`: without it the game still launches, it just has no codec.
  It also sets `HKLM\...\Windows NT\CurrentVersion\Drivers32` `vidc.iv41`,
  which `$icm_drv_lookup` reads when SYSTEM.INI has no `[drivers32]` line.
- **Audio clock.** Civ2 paces video off `waveOutGetPosition` and refills audio
  only on `MM_WOM_DONE` to its `CALLBACK_WINDOW`. The host read the callback
  record from stale pre-allocator literals (`0xD164`/`0xD16C`) instead of
  `$WAVE_OUT_SHARED`, so `WOM_DONE` was never posted and the movie froze after
  its first 8 buffers (1.49s). Fixed in 4e5bd041, which also keeps a lazily
  backed `AVIFileOpen` handle parked, so that closing it no longer cancels the
  read it is waiting on.

Headless recipe: `--batch-size=100000 --tick-ms-per-batch=20`. The Diplomatic
Heralds prompt (first launch) appears around batch 500. Its OK button is at
403,387 (mousedown at batch 1210, mouseup at 1230). The movie follows; after it
comes the main menu with its animated IV41 map.

## Not yet done

- Advisor and wonder movies have not been driven. They use the same AVIFIL32 +
  `ICLocate` path as `opening.avi`.
- The Win16 intro's "black" space renders as dark grey (index value 0x1c).
  That may be the movie's own palette or the 8-bit output palette; it is
  unchecked.

## The Win16 build plays its movies through the disc's 16-bit Indeo (2026-09-28)

The Win16 disc (`civ2_win16`) ships Video for Windows 1.1 setup media in
`VFW_INST\`. Its `IR41.DL_` is Intel's **16-bit** Indeo 4 driver, KWAJ
method 3 compressed and with no stored length. `SETUP.INF` gives the size:

```
node tools/kwaj.js "…/cd/VFW_INST/IR41.DL_" …/civilization-2-win16/vfw/ir41.dll --size=774960
```

(sha256 `88f156f5…d99721`; `test/test-kwaj-expand.js` checks it.) `lib/apps.js`
mounts it as `c:\windows\system\ir41.dll` and writes `VIDC.IV41=ir41.dll` into
`system.ini [drivers]`. The game calls Win16 MSVIDEO `ICLocate`/`ICSendMessage`/
`ICMessage` in `src/09e-win16-api.wat`. Those load the NE driver and run its
`DriverProc` as a far call.

What the driver needs from the emulator, in the order it hit them:

- **LocalInit(sel, 0, cb)**: its heap goes after the segment's data, and the
  segment grows. DGROUP is 0x4EEE bytes with a 0xB102 heap. A heap at offset 0
  overwrote the data, and DRV_LOAD failed on its own check of `[0xa2]`.
- **DPMI int 31h 06h/0Ah/0Bh/0Ch with the G bit.** It aliases data segments
  11-14 (0Ah) and sets them to limit FFFFFh with G+D, i.e. 4 GB flat. It sets
  D on code segments 2-9 and B on the stack segment, and reads bases back
  with 06h.
- **USE32 code inside a 16-bit task.** The codec lives in segments 2-9 and is
  entered from seg10:0x17f2 with `66 FF 5E xx` (CALL FAR m16:32). The
  32-bit CALL/RET/RETF/JMP/ENTER/LEAVE forms are `$th_xfer32` (handler 477,
  05c).
- **ESP as the guest sees it.** The register file keeps ESP linear. The seg3:0
  thunk switches SS to a flat alias (base 0x02260000 in the run above). From
  then on, every instruction that exposes ESP's value must use the offset
  into SS: `mov r,esp`, `push esp`, `pop esp`, `lea r,[esp+N]` and ALU ops
  between ESP and another register (xfer32 kinds 13-18). The codec refuses
  every frame unless `lea eax,[esp+838h] / sub eax,esp` gives 838h
  (seg6:0x0ef0). Before that fix ICM_DECOMPRESSEX returned -100 on every frame.
- KERNEL `GlobalFix`/`GlobalUnfix` (197/198) and `IsBadReadPtr`/
  `IsBadWritePtr` (334/335, plus the Huge forms 346/347).
- KERNEL `LocalHandle` (11), at seg10:0x2618, when the movie stops. Only a
  skipped or finished intro reaches it; without it, clicking through the
  intro trapped in the codec.
- AVIFILE `AVIStreamFindSample` (163), from the game itself (seg66:0x562a),
  FIND_NEXT|FIND_KEY. It runs only once decoding falls behind the clock.
  That happens in a browser, and headless at `--tick-ms-per-batch=200`, but
  never at the 20 ms recipe above. The Win16 index keeps idx1's
  AVIIF_KEYFRAME as bit 8 of each record's stream word for it.
- MMSYSTEM `timeGetTime` (607) must not go through the Win32 handler. The
  game polls it in a delay loop after the language dialog, the clock-spin
  park armed, and the Win16 bridge trapped (`0xCA16A9F7`) when Enter was
  pressed there.

Where to look when a frame fails: seg10:0x969a maps the codec's internal
status (0..0x16) to an ICERR. The 32-bit decode is seg10:0x16a0 → 0x17f2.
Segment bases in these runs: seg2 0x021a0000 … seg10 0x02220000, DGROUP
(seg19) 0x022b0000.

Headless recipe: `node test/run.js --app=civ2_win16 --quiet-api --no-close
--batch-size=100000 --tick-ms-per-batch=20 --input=400:mousemove:209:280,
410:mousedown:209:280,430:mouseup:209:280,700:mousemove:322:327,
710:mousedown:322:327,730:mouseup:322:327,950:png:a.png,1200:png:b.png`.
The intro's starfield, title and galaxy burst decode frame by frame.
`test/test-win16-use32-stack.js` pins the ESP semantics.

## Gameplay (city screen, naming)

Route to the first city, controlled: `node test/run.js --app=civ2_win16
--no-close --control=PORT --frozen --batch-size=100000 --tick-ms-per-batch=20`,
then drive it with `tools/ctl.js` (Enter through setup, then `cmd keypress:98`
for `b` on the tutorial's "good site for a city"). `ctl key` sends
keydown/keyup only, so letter commands need `cmd keypress:<ascii>`.

- USER `ShowScrollBar` (267), when the city screen opens (its two SB_CTL
  bars).
- The city screen is a child covering the main window, opened *after* the
  map screen's World (454,0) and Status (454,135 178x299) panels. The
  renderer's deep hit test took the first child in creation order, so every
  city-screen button click went to the Status panel. The game answers that
  with "You must close the City Window before the game can proceed". It now
  takes the topmost sibling by z rank (`test-child-from-point-deep-zorder.js`).
- City and rename names are read by subclassing an edit and calling
  `CallWindowProc(WM_GETTEXT)` with a far buffer (after `WM_GETTEXTLENGTH`).
  The packed lParam went to the native edit unconverted, so every city kept
  the terrain name the buffer already held ("Hills", "Grassland")
  (`test-win16-gettext-lparam.js`).

## Civilopedia (Win16, 2026-09-29)

The Civilopedia menu does not show a dialog. Civ2 `WinExec`s
`PEDIA\GET_INFO.EXE`, an 11 MB Authorware 2 runtime (its image is ~750 KB; the
rest is an overlay it reads from its own file). The two talk through
`FindWindow("Get_Info")` and `ShowWindow`, plus a `get_info.txt` Civ2 writes
with the topic. GET_INFO loads `PEDIA\CIVJUMP.DLL`, a small NE, by full path.
It runs as a second Win16 task: see docs/win16-multitask-design.md.

Controlled route: from the setup screens, Enter ×16 (with `step 250` between)
reaches the map. `cmd post-cmd:386` then opens the Civilopedia's
Civilization Advances list; the menu item ids are the WM_COMMAND the bar
sends. After about 240 batches the list is up. A click on a name (for
example 102,117 for Alphabet) opens its page. EXIT on a topic page is at
497,461, and on the list at 425,432.

## Network game over the virtual LAN (Win32, 2026-10-10)

Two seats, `test/test-civ2-mge-vlan-gameplay.js` (uncommitted draft; needs
`CIV2_DIR` = an installed copy and `CIV2_CD_EXE` = the CD's `Civ2\civ2.exe`,
which is mounted at `D:\civ2\civ2.exe` because the CD check opens only that
file). Route: Heralds OK, Multiplayer, Network Game, TCP/IP; the host then
picks Start New Multiplayer Game and walks the setup to the lobby
("Available Players <Waiting for Players>"); the guest picks Join.

- The network layer is `XDaemon.dll` (base 0x10000000; it loaded at runtime
  base 0x765000 in these runs). UDP socket bound to 4994 (discovery
  broadcast), TCP listen on 4993. Its receive loop is at `0x10004831`:
  `recvfrom` at `0x1000487b`; a 6-byte datagram matching the string at
  `0x10013abc` is answered from XDaemon itself (`sendto` at `0x1000494f`);
  every other datagram goes to the app callback `[ctx+0x12]` with
  `(buf+4, len-4, first dword)`.
- The callback is civ2 `0x5420d3`. It checks the magic `0x66606660`, drops a
  packet whose address strings (payload +0x30, +0x50) equal the seat's own
  (`0x5eb1d0`), and otherwise queues it with `0x4d69af` on the object at
  `0x6260f8` (a ring of messages; counters at +0x5dc0/+0x5dc4, type at
  payload +4).
- The guest's Net Name dialog's edit field is `MSEditBoxClass`, a class
  registered with the wndproc read from a throwaway EDIT via
  `GetWindowLong(GWL_WNDPROC)`. That value used to be the generic native
  marker, so the field had no edit state and the dialog (which refuses an
  empty name) could not be passed. Fixed by da6a67bd.
- **The join works (9cdf1a19).** The host's "Available Players" lobby lists
  the guest, and the guest reaches "We are waiting for the game machine to
  connect"; frames go both ways and the guest's TCP SYN to 10.0.0.1:4993 is
  accepted. Evidence: scratch/runs/20261010T0550Z-civ2_mge-vlan-join-w4.
- **Route gotchas.** Both name dialogs (Net Name, then Game Name) refuse an
  empty name, and **Enter in the name field moves focus to OK instead of
  accepting** -- type the name, then click OK (213,292 / 209,292). The guest
  sends a 120-byte discovery broadcast (type 0, magic, length 0x74, its
  address "10.0.0.2" twice) every few seconds; the host answers it only once
  its lobby is up.

### Host internals, and a misdiagnosis to avoid (2026-10-10)

**Read this first:** the section below was written while the host was still
sitting at its empty Net Name dialog -- the "lobby" screenshot it relied on
came from a run before da6a67bd. So "the host never runs the pump" was true
but was not an emulator bug: the host's network session (`0x416d80` builds
it, `0x416ddd` runs it, both called only from `0x4325e3`/`0x432616` in the
MP setup function `0x431ba0`) had simply not started yet. That session
installs the pump idle callback `0x418eca` on the main window's modal loop
(push at `0x417661`) -- the guest did so once and pumped 11.2M times. The
lesson: when a seat "never answers", photograph that seat at the moment of
the claim, and walk its EBP chain (saved EBP at [ebp], return at [ebp+4]) to
see which dialog it is really in. Stale-entry stack scans misled here.

- The queue is a 2000-slot ring of `{from, msg copy, len}` (head +0x5dc0,
  tail +0x5dc4, count +0x5dc8 of the object at `0x6260f8`); the only
  consumer is `0x4d6ff6`, called only from the network pump `0x460379`
  (`thiscall` on `0x6217a0`, 117 call sites). The pump bails while any of 18
  flags at this+0x794..0x7dc is set or `XD_InFlushSendBuffer` is nonzero.
- On the host route the pump is **never called** (0 hits for the whole run,
  `--count`), so the queue only grows and nothing is ever sent -- not even
  the host's own broadcasts (`XD_SendBroadcastData` thunk `0x55ad3a`, called
  from `0x4508a1` <- the generic net-send `0x45094d`).
- The lobby is the generic dialog runner `0x54bad5`: if the dialog object
  has an idle hook at +0x250 it loops calling it, otherwise it runs the plain
  modal loop `0x565ce0` on `[obj]+0x48`. The modal loop pumps one message
  (`0x407a60` -> `0x55b57f`) and calls an idle callback at this+0xa4 when
  set. The host lobby takes the plain path with no callback (0x565d88: 0 hits
  over 505K loop turns).
- Every site that installs the network idle callback does so through the
  setter `0x407d70`, gated on the network mode byte `[0x5da722] >= 3` (it
  reads 3 in the lobby): `0x542893` (pump only, 14 sites) and `0x4a0bf0`
  (pump + a 0x4b0 timeout, sites `0x4a1c6c`/`0x4a2055`). The setter is never
  called on the host route. The +0x250 setter (`0x5447e1`) has no references.
- No SetTimer, timeSetEvent or CreateThread on the main thread; sockets use
  WSAAsyncSelect only (UDP FD_READ as 0x401, TCP accept/close as 0x402, to
  XDaemon's hidden windows -- its wndproc is `0x100047d0`).
- Open: what drives the pump in the lobby on real Win98. Candidates: a
  dialog-runner idle hook installed some other way, or a branch on the host
  route (a failed check during Open Game) that skips the dialog code which
  would install it.
- Probe recipe: `CIV2_VLAN_HOST_ONLY=1` stops at the lobby (one seat),
  `CIV2_VLAN_LOBBY_DUMP=ADDR:LEN,...` dumps guest memory there (256-byte cap
  per dump), `CIV2_VLAN_TRACE_API=...` replaces the default socket trace, and
  `CIV2_VLAN_{HOST,GUEST}_EXTRA` adds run.js flags. Batch numbers are not
  stable between runs (3K-4K batches/s, varies with flags), so do not aim a
  `--trace-from` window at the lobby; dump over the control channel instead.
