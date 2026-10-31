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
No production change or retry was made in that run. The demonstrated issue was an ordinary
browser startup failure at the ImageLoader load/registration dependency;
the exact failing call and generic root cause were then unresolved.
Movement/look/fire, browser mission gameplay, touch, FPS, audio, multiplayer,
and full-27 coverage remain unqualified.

## 2026-10-31: worker DLL registry omission repaired; visible menu still blocked

Run `scratch/runs/20261031T1707Z-evolva-imageloader-cause/` investigated current
main `9534a8b16`, rather than editing or reusing the frozen UT0542 source.
The unchanged diagnostic browser reproduced the dialog (`01-diagnostic-startup.png`,
reviewed). Its trace proves that `LoadLibraryA` and `GetProcAddress` succeed,
and the real `DllRegisterServer` executes and writes the MediaLoader class
keys. It never reaches the second activation. Original EXE disassembly places
that failure on the negative `DllRegisterServer` result branch after
`0x6ef431`, rather than a missing file or export.

ImageLoader's registration routine calls OLEAUT32 ordinal 161, `LoadTypeLib`,
through IAT RVA `0x1f15c` at DLL RVA `0x143a4`, with a `.tlb` fallback at
`0x1442f`. The built-in handler returns `TYPE_E_CANTLOADLIBRARY` (`0x80029c4a`).
This inner HRESULT is a source/disassembly inference, not a captured return-value
trace. The causal host discrepancy is independently reproduced: classic browser
Workers neither imported `dll-registry.js` nor had its window-only export;
`process-boot.js` also looked only at `window`. Their dynamic dependency walker
therefore skipped the registered, ordinal-only OLEAUT32 dependency. Node's
`require` path retained the registry, explaining the historical CLI difference.

The generic repair imports the existing DLL registry before process boot in
`lib/guest-worker.js` and exposes/reads it through `globalThis` in
`lib/dll-registry.js` and `lib/process-boot.js`. No registry entries, guest files,
COM results, launch arguments, interpreter handlers, or thread-manager code were
changed. The two whole-file callback census seals were updated after reviewing
this bootstrap-only delta; callback/context ownership assertions remain pending.
`test/test-worker-dll-registry.js` runs the production browser bootstrap and
dependency walker in a window-less realm, using synthetic PE imports. It fails
on unchanged source because OLEAUT32 and its nested CRT dependency are skipped,
then passes with the repair. It also checks existing-module skipping, system
fallback, fatal missing vendor dependencies, and versioned Worker imports.

The `repaired-browser/` subdirectory holds the single bounded original browser
attempt after repair. It actually served the existing 598,288-byte OLEAUT32
(SHA-256 `baeb2f7c1b8be56738d34e1d1ddf8e0eebd3a633215dc1575e14656be38b939d`),
completed the native type-library registration, and reached the second
MediaLoader `CoCreateInstance` at return address `0x6ef487`; the host reported
`COM_RESOLVED_INPROC` (`2`), resolving the real `DllGetClassObject` for guest-side
activation, rather than an activation HRESULT. Execution proceeds to menu asset
loading. The ImageLoader startup dialog is cleared.

Reviewed `01-repaired-startup.png`, `02-menu-wait.png`, and
`03-native-canvas-focus.png` show a white game surface, not a visible menu.
The legacy WebGL endpoint owns an actual 640×480 WebGL2 target, with context
not lost, completed draws, texture uploads, fences/readbacks, and zero reported
GPU errors/fallbacks. Menu texture files were served successfully. The balanced
native focus click reached DirectInput and acquired pointer lock on `screen`,
but the surface stayed white. No blind menu route, jungle transition, movement,
look, or fire was attempted or qualified. Next investigation must distinguish
GPU pixels, `D3DIMGpu.fence`/`_writeBack`, shared DIB/flip ownership, and browser
presentation (`lib/d3dim-gpu.js`, `lib/d3d-render-worker.js`, then the presentation
consumer). Draw counters alone do not establish correct visible rendering.

The full `flock /tmp/wine-build.lock bash tools/build.sh` passed under lifetime
FD9 `/tmp/wine-browser.lock`; eight focused loader/COM/bootstrap/cache checks
passed. An earlier repaired build stopped at the census review gate before
runtime; that failure is preserved in `repair/`. The tested current WAT module
is SHA-256 `078d81cba6ab755d6a05e5e234a259df9e867ecc8848899705a45739fab0e9a9`
(1,898,571 bytes), identical between the diagnostic and repaired JS runs.
Their source manifests identify the exact changed JS bytes; the successful run
verifies 295 source files, seven compiler files, the original 1,163 fixture
pins, and the two existing system DLL pins before and after execution. All
202 HTTP responses carried COOP/COEP; isolation, threads, default guest Worker,
normal WebGL selection, and stable 1024×768/defaultViewport-null configuration
were verified before guest input. All seven native events were trusted and
mouse down/up were balanced. Original ImageLoader bytes retain the hash above.

Both runtimes followed the new SlaveZero terminal no-runtime release and
independent whole-Chrome/global-crashpad/profile PID/start gates. The repaired
guest ran 17:19:09–17:20:34 UTC; explicit cleanup returned Chrome/controller/
wrapper/monitor 0 without signals. The final PID/start scan found all owned
runtime/supervisor identities absent, both ports closed, profile removed,
held inputs empty, and lifetime flock available. Minimum monitored free disk
was 2,613,260,288 bytes. Boat ID/state/expiry: N/A. No further browser/heavy CLI,
public deployment, redistribution, guest overrides, or successor worker was
launched. The app remains local-only and excluded from the public desktop;
browser menu/jungle gameplay, movement/look/fire, audio, and touch remain open.

## 2026-10-31: white presentation repaired; collapsed geometry remains

Evidence: `scratch/runs/20261031T1733Z-evolva-white-presentation/`.
The first diagnostic used the existing GPU `readColor()` and shared surface
metadata without forcing a draw, flush, or writeback. Actual GPU pixels, its
cached 16-bit DIB, both flip-chain DIBs, and the window's canonical back canvas
were black. The browser screen and `_dxFrameLayer` were white. The second
capture isolated the divergence: explicitly presented primary slot 12 and back
slot 13 were all zero, while unrelated offscreen slot 15 was all white. Gamma
was unset. `lib/host-imports.js` rejected the explicit primary because a byte
sampler equated all-zero storage with “never written”, then selected the white
offscreen surface. This was a presentation ownership defect, not evidence of a
GPU fence or DIB writeback defect.

The generic repair keeps a live, explicitly presented primary authoritative,
including all-zero frames. Existing surface retirement (`dx_trace` kind 22)
already clears its ownership; a recreated surface can use fallback until it
presents. The unused content sampler is removed. The new
`test/test-dx-explicit-primary-black.js` fails against the old implementation
and passes after correction, covering 8-, 16-, and 32-bit black primaries,
retained writes, clears, retirement/recreation, and replacement presentation.
The older blank-primary test now exercises actual retirement instead of
asserting content-based ownership. The callback census host-imports seal was
reviewed and updated; no callback/context ownership claim was added.
`lib/d3dim-gpu.js` and `lib/d3d-render-worker.js` remain unchanged.

One corrected original/default-worker WebGL browser attempt ran
17:41:00–17:42:17 UTC. Reviewed `repaired-browser/01-authoritative-primary.png`
and `02-projection-boundary.png` are black, matching GPU, shared DIB, canonical
canvas, and frame layer. White presentation is fixed; no visible menu, jungle,
movement, look, fire, or gameplay screenshot is qualified. Only trusted,
balanced host Launch input was sent; no blind guest menu route was attempted.

The remaining captured boundary is upstream vertex projection. The last
four-vertex triangle-strip descriptor has TL vertex type 3; all four screen
positions are `(0,0)`, with `z=0.5`, `rhw=1`, white diffuse colour, and nonzero
texture coordinates. The queued GPU vertices are likewise collapsed. Decoded
texture caches contain nonzero pixels and many colours. The captured render
workspace has zero viewport rectangle at offset 3088, zero XY scale at 3104,
and zero origin at 3120, despite populated matrices. These are snapshots, not
a captured viewport setter call or HRESULT. The existing bounded draw trace
stopped at an unsupported legacy call with no commands; it does not establish
call ordering. Next work must capture the actual device/viewport API version,
setter arguments and return, selected viewport descriptor, and their path
through `src/09ab-handlers-d3dim-core.wat` into vertex projection. No viewport
default, guest state edit, or speculative renderer bypass was introduced.

Ten focused presentation/GPU suites and callback census check pass
(`focused-tests.log`); the causal before-failure and after-pass are preserved.
The corrected full `flock /tmp/wine-build.lock bash tools/build.sh` passed under
inherited lifetime FD9 `/tmp/wine-browser.lock`. The exact executed module is
SHA-256 `078d81cba6ab755d6a05e5e234a259df9e867ecc8848899705a45739fab0e9a9`.
Each browser attempt cached and hashed current checkout source bytes, rather
than serving an old frozen image: 295 source files, seven compiler files,
1,163 original fixture pins plus two system DLL pins matched before and after.
Per-response receipts identify the bytes actually served; all 202/203/203 HTTP
responses carried COOP/COEP. Isolation, normal WebGL, default guest Worker,
1024×768 geometry and defaultViewport-null were checked before input. Large
pixel captures are losslessly stored as `.json.gz`, with summaries/hash receipts.

All three bounded attempts followed SlaveZero FULLRELEASE 17:29:35 and their
own independent whole-Chrome/global-crashpad/profile PID/start gate under FD9.
Explicit shutdown returned all runtimes/controllers/wrappers/monitors zero,
without monitor signals. Release proofs find every owned runtime/supervisor
PID/start absent, both ports closed, profiles absent, held input empty, and
lifetime lock available. Lowest monitored free disk across all attempts was
2,354,913,280 bytes. No further browser/heavy CLI is planned in this task.
Boat ID/state/expiry: N/A. The candidate remains local-only; no public desktop
selection, deployment, redistribution, guest overrides, or audio/worker changes.
