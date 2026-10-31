# Blood II: The Chosen (demo)

Monolith's 1998 LithTech demo in `test/binaries/win98-games-a-d/Blood2-demoD3D/`.
The CD layout has an InstallShield 5 setup (`SETUP.EXE`, `_INST32I.EX_`) beside
`Game\`, which is already the unpacked install: `B2Demo.exe` (MFC launcher),
`Client.exe` (the engine), `B2Demo.rez` (the resource archive), renderers
`d3d.ren`/`soft.ren`, sound `softsnd.dll`, and Microsoft Interactive Music 2.5
(`IMA.DLL`, `IMUSIC25.DLL`, `IMRT25.DLL` + 16/32 variants, `MSynth25.dll`,
`AM18.dll` = Microsoft AudioMan 1.80) with `Music\` styles and sections.

Registry id `blood2_demo` (localhost-only), manifest from
`tools/gen-win98-games-a-d-manifests.js` (root `Game`, 97 companion files).
The registry runs `Client.exe` directly with the command line the launcher
builds (strings in `B2Demo.exe`): `-rez B2Demo.rez -windowtitle "Blood2 Demo"
-config defaults.cfg`. Without `-rez`, Client.exe stops at boot with the
LithTech message box "No game resources specified."

`autoexec.cfg` selects `"RenderDLL" "d3d.ren"` (Direct3D through DDRAW, 640x480).
Client.exe imports WINMM, DPLAYX, DINPUT, KERNEL32, USER32, GDI32, ole32,
WSOCK32 and LoadLibrary's the rest, in this order: `de_msg.dll`, `cshell.dll`,
`cres.dll`, `softsnd.dll`, `d3d.ren`, `ima.dll` (+ its imports), `imrt25.dll`,
then at level load `object.lto` and `sres.dll`.

## Route (headless, `--batch-size=20000`, ~200 batches/s in-level)

| batch | action / screen |
|---|---|
| <3000 | MAIN MENU: SINGLE PLAYER / BLOODBATH / OPTIONS / PRIME GIBS / QUIT, "DEMO V1.0A (BUILD 109)" |
| 3500 | Enter: SINGLE PLAYER -> CALEB / CHOSEN |
| 5500 | Enter: Caleb -> difficulty GENOCIDE / HOMICIDE / SUICIDE (Homicide highlighted) |
| 7500 | Enter: "DEMO LEVEL 1", Center for Disease Management |
| 9500 | Enter: in-level from ~11000, in the starting elevator |

Bindings come from `autoexec.cfg` `rangebind` lines (DIK codes): arrows move
and turn (200/208/203/205), Left Ctrl fires (29), Space opens (57), A jumps (30).
Evidence: `scratch/runs/20261006T015805Z-blood2-demo-app-route` (turn right,
fire: ammo 50 -> 46 with a bullet hole) and
`scratch/runs/20261006T015102Z-blood2-demo-walk` (walk out of the elevator,
take enemy fire to a death camera).

## What it needed

1. **LoadLibrary maps static imports first.** `ima.dll` imports
   `IMUSIC25.DLL` (which imports `AM18.dll`) and `MSYNTH25.DLL`; only
   Client.exe's LoadLibrary names ima.dll. The runtime yield pump in
   `lib/process-boot.js` mapped just the named file, so those imports fell to
   WAT stubs and the game trapped on `_AllocAAEngine2@8`. It now walks the
   target's imports (registry-loadable names only, not yet mapped, looked up
   beside the importer), maps and patches them deepest first and runs their
   DllMains before the target's. `imusic25.dll`, `msynth25.dll`, `am18.dll` are
   in `APP_LOCAL_DLLS`.
2. **`StringFromIID`** (ole32 alias of `StringFromCLSID`), called by IMUSIC25.
3. **DirectInput application-defined data formats.** The device loop at
   `0x429810` walks devices made by the EnumDevices callback `0x4292f0`.
   Creation (`0x42968e`) does CreateDevice, QI, SetCooperativeLevel, then
   SetDataFormat with a DIDATAFORMAT of **zero objects**; on failure it
   releases the device and stores 0, after which every poll skips it (no key
   in-level ever reached the game, though menus worked through WM_KEYDOWN).
   Later `0x429ea0` Unacquires, builds a format naming each bound object by
   its EnumObjects `dwType` and GUID at `dwOfs = 4*i`, and SetDataFormat's it;
   the poll reads `GetDeviceData` and indexes `[dev+0x8c + (dwOfs>>2)*4]`.
   Our DirectInput accepted only the standard keyboard/DIMOUSESTATE layouts.
   It now matches custom formats object by object (GUID, DIDFT type and
   instance, DIDFT_OPTIONAL) into a per-device offset map (guest heap block,
   pointer at +0 of the device's `DX_SURF_STATE` record, freed in `$dx_free`)
   and reports buffered and immediate data at the format's offsets, dropping
   objects the format omits.

## Not yet looked at

- Audio (DirectSound through softsnd.dll, plus the Interactive Music engine).
- The InstallShield setup and the `B2Demo.exe` launcher dialog.
- `ole32.dll` is in `APP_LOCAL_DLLS` but absent from this box's
  `test/binaries/dlls`, so ole32 imports fall to WAT stubs here.
- FPS and the browser.

## 2026-10-31 original-fixture gate: stopped before runtime

Run `20261031T1932Z-blood2-native-browser` reread published main
`e2a73b33a23a27c9fae7d581ca045e434cf36572` after task input `1b4af19af`.
The candidate preflight's public registry SHA-256 is
`63bb9815e404dd7e446d3748e195c621782a04c8358580bd2cf1a864cb57e209`;
its `DESKTOP_APPS` excludes `blood2_demo`. The local registration and assets
were preserved. All 97 companion sizes match the manifest, and fresh hashes
of those files plus `Client.exe` match all 98 preflight baseline hashes.
The manifest SHA-256 is
`a46bb10441eeb182ff5a28effd8112f507d6a510a25fba48d06870b8fea19519`;
`Client.exe` SHA-256 is
`1fea9e1400b948153341bd38f8b66beba885d45d21d202cab3c39bcc173b53b2`.
These comparisons establish local consistency, not original provenance.

The documented source in `test/binaries/SOURCES.md` is
[Win98_Games-A-D.7z](https://archive.org/details/win-98-games-a-d.-7z).
A single bounded metadata request (20-second timeout, 2 MiB response cap)
returned HTTP 200 and 5,134 bytes. It confirms the documented container size
7,169,873,753 bytes, SHA-1 `c53417bcc617790d9671ec385c49ee6f018846c9`
and MD5 `7610b389f075be9f4ea8b521157e87d2`. It supplies whole-container
checksums, with no individual game-file hashes. A filename search under
`/home/user` and `/tmp` found no preserved original container or matching
Blood II demo package. Only about 2.57 GB was free at the initial disk check;
acquiring this 7.17 GB container would exceed the bounded verification and
disk constraints. No archive download or asset overwrite was attempted.

**Blocker:** no independently pinned original bytes or per-member hash record
were available to compare the 98 local fixture files. Per task instruction,
work stopped before runtime. No build, browser, heavy CLI, guest input,
server, profile, or runtime helper was launched. The browser lifetime lock
and the current Slave Zero terminal-lifecycle release gate were not entered;
foreign work was left alone. Boat ID/state/expiry are N/A for this local task.

There are no new screenshots to review and no new browser menu, intro,
player-control, hit, kill, objective, audio, or FPS findings. The historical
headless route above remains a navigation reference; its movement, ammo
change, and enemy fire do not establish current browser control. No emulator
failure or repair boundary was observed, and no source repair was attempted.

Evidence is in the ignored run directory: `archive-metadata.json`,
`archive-metadata-check.json`, `candidate-result.json`,
`candidate-local-file-hashes.json`, `local-current-hashes.json`, and
`findings.json`. No candidate-corpus entry matches this game, so the findings
remain linked here without attaching a dashboard capture to another candidate.
Validation: all 98 baseline hashes, 97 companion sizes, documented archive
metadata pins, evidence containment/schema checks, and documentation diff
check; no full-build or runtime test claim.

Next boundary: obtain a preserved independently pinned original container,
or a bounded original package/per-member hash record for this exact demo,
then compare every fixture file. Only after that passes may a fresh task
enter the current Slave Zero terminal-lifecycle release and independent
whole-Chrome/global-crashpad/profile PID/start-time gate under inherited
lifetime FD9, before following the native menu route with balanced inputs.
