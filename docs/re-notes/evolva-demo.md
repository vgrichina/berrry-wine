# Evolva (demo)

Computer Artworks / Interplay, 2000, Direct3D 7 squad action (four
"Genohunters", third person). Candidate `evolva-demo`, app `evolva_demo`,
local only.

## Source and layout

- archive.org `Evolva_1020`, `evolvademo.zip` (31,649,248 bytes, sha1
  40e5cbc407348c8357d97d3e872f1af43fe93276). archive.org sometimes answers
  with a 170-byte nginx 500 page; the fetcher's sha1 check catches it.
- The zip holds `evolvademo.exe`, an InstallShield 5 self-extractor. 7z opens
  it to `Disk1\data1.cab`. The candidate extracts five file groups with
  `unshield` (or `tools/is5-extract.js`) and merges them into
  `installed/evolva` (guest `c:\evolva`):
  - Resources (Animations, DMLevels, Informs, Level, Music, Sounds, Textures)
  - Program Executable Files (`Evolva.exe`)
  - Program DLLS (`4xm_sdk.dll`, the FMV codec, declared in `dlls`)
  - Language DLL (English) (`EvolvaLang.dll`)
  - Registering DLLs (`ImageLoader.dll`)
- `ImageLoader.dll` is the "Media Loader" COM server. When `CoCreateInstance`
  fails, Evolva calls `LoadLibrary("C:\evolva\ImageLoader.dll")` and
  `DllRegisterServer`, then activates it again through the registry. Without
  the file it stops on "A file required by Evolva ... (ImageLoader.dll)".
- The installer writes
  `HKLM\Software\Computer Artworks\Evolva Demo\1.0` (InstallDir, ResourceDir,
  SaveDir, DNADir, ScreenShotDir). The game reads one search path per asset
  class (TextureDir, SoundDir, MusicDir, LevelDir, AnimationDir, InformDir,
  DMLevelDir, SceneDir, BackdropDir, FMVDir). `startupRegistry` seeds all of
  them. The game then calls `SearchPathA("C:\evolva;c:\evolva\Textures", ...)`.

## Emulator bugs it found (all fixed)

1. `CoCreateInstance(CLSID_DirectInput)` was unknown, and
   `IDirectInput::Initialize` popped 20 bytes for its 3 arguments. That
   corrupted the caller's EBX/ESI/EDI, so the next CreateDevice got a NULL out
   pointer. Fixed in c9b5904a4.
2. D3D7 `EnumDevices` left `D3DDEVICEDESC7.deviceGUID` zero, so the game threw
   "D3DMgr: Could not set up preferred device". Fixed in f44edf4e7.
3. `SearchPathA` treated a semicolon-separated `lpPath` as one directory. No
   texture, font, sound or movie was found, and every frame was white.
4. Vertices without a specular colour got specular 0. That covers D3D-lit
   D3DVERTEX, and LVERTEX/TLVERTEX FVFs without `D3DFVF_SPECULAR`. The
   specular alpha is the vertex fog factor, so with FOGENABLE on (Evolva sets
   no fog mode) the whole 3D world drew as the fog colour, 0xff788c78. They
   now get 0xFF000000 (black, no fog).

## Route (headless, `--batch-size=100000`)

The game cursor is DirectInput relative motion. Absolute clicks don't move it;
use `relmousemove`. The cursor starts at the screen centre.

- About batch 200: the main menu (New Game 137,143; Options 480,377).
- `300:relmousemove:-183:-97:10`, then click: team select (four animated
  Genohunters). Confirm checkmark at about 560,435
  (`1200:relmousemove:423:292:12`, click at 1250).
- About batch 1600: Mission Briefing "Land 4" (rotating planet). Click the
  same checkmark again (batch 2400).
- The level loads for about 13,000 batches (white screen). By batch 16,500:
  gameplay, a Genohunter in the jungle with four squad views and radar.
- Options > Configure Controls has the authoritative chart: W/S
  (Cursor Up/Down) forwards/backwards, A/D (Cursor Left/Right) strafe, Left
  Ctrl Walk, Left mouse Fire, Left Shift Beam Up, Right mouse Jump, 1-0 and
  NumPad 1-0 weapons, mouse wheel next/previous weapon.

## Historical limits (2026-10-11)

Movement and fire in the mission (only reaching it), the browser and touch
layout in a running mission (the load is long), audio, the 4XM FMVs (the
Intro FMV option is off), multiplayer.

## 2026-10-31: original browser launch stops before the menu

Run `scratch/runs/20261031T1656Z-evolva-native-control/` made one ordinary
registered `evolva_demo` launch. The first concrete failure is the game's
startup dialog: “A file required by Evolva to run properly is missing or has
not been installed correctly (ImageLoader.dll). Please re-install Evolva.”
Reviewed `01-menu-wait.png` shows the dialog, and `console.jsonl` records the
same MessageBox. `02-imageloader-first-failure.png` is a later desktop frame
without the dialog painted; it does not demonstrate recovery. No menu or
mission was reached, and no guest movement, look, or fire input was sent.
The historical jungle scene (messageboard entry 22136) remains scene-only
evidence, explicitly without mission input or browser verification.

Cheap preparation found all 1,161 manifest files at their recorded sizes
(47,453,646 bytes), plus the separately registered 4,325,376-byte EXE.
`original-inputs.json` pins all 1,163 fixture files including the manifest;
their hashes match before and after execution. In particular,
`ImageLoader.dll` exists (172,032 bytes, SHA-256
`b252056a62cd7e3c53e26c9f39e5b6c7acee5d7bd2f35554871efcfa6adb94e5`)
and was actually served with HTTP 200 and that hash. The fixture was not
changed, copied, or re-extracted; the upstream archive hash was not rechecked.
The fresh public desktop selection excludes this app. No later gameplay
qualification or runtime rejection was found; the candidate's local-only,
no-redistribution restriction still applies.

The tested module was the existing UT0542/1642Z frozen build, SHA-256
`9b4e39a22c9c3abe4608e5f55e2db0eb5818da59cec04bc7b7406a0b8504d1b8`,
with its complete 295-file source snapshot and seven compiler files verified
before and after execution. Its recorded source HEAD is `a08890203bb22db6`,
with the retained predecessor dirty patch and successful build log; it is
not a build of the current documentation HEAD. The frozen app registration
matches the current registration, with no extra arguments or launch patches.
The browser received 105 pinned source/module responses. No build or frozen
hardlink was modified.

The sole runtime lasted 16:59:26–17:00:13 UTC, after the new UT2003 execution
FULLRELEASE at 16:58:19 and an independent entire Chrome/global-crashpad/profile
PID/start gate under inherited lifetime FD9. Chrome 151.0.7922.108 used the
normal WebGL selector, default guest worker, threads, and stable 1024×768
viewport. Isolation was true before any guest input, and all 166 observed
HTTP responses carried COOP `same-origin` and COEP `require-corp`.
No render-owner endpoint or graphics device existed at the failure, so
selected WebGL does not establish executed WebGL rendering. The only three
trusted native events were the balanced host Launch click and its mouse move.

Explicit shutdown completed with Chrome/controller/wrapper/monitor exit 0,
no monitor signals, all owned runtime/supervisor identities absent, both
ports closed, profile removed, no held inputs, and full flock available.
Disk remained above the 2.1 GB stop threshold. Boat ID/state/expiry: N/A.
`focused-check.json` records the identity, HTTP, input, and cleanup checks.
No production change or retry was made. The demonstrated issue is an ordinary
browser startup failure at the ImageLoader load/registration dependency;
the exact failing call and generic root cause remain unresolved. Next work
is a bounded loader/COM investigation before retrying the original menu route.
Movement/look/fire, browser mission gameplay, touch, FPS, audio, multiplayer,
and full-27 coverage remain unqualified.
