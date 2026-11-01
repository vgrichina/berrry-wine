# MDK2 demo (BioWare/Interplay, 2000)

**Status: registered (`mdk2_demo`), playable in the browser.** Projective
vertices work since 9be0a0efb. Menu, New Game, the intro and the tutorial
level all render and take input (Chromium, real WebGL), but the world is
black after the intro until the FSCALE fix (see Black world). The "attract demo ignores
input" puzzle was only the menu's idle timer (see Menu). The fetch
needs a real `unshield` (IS6 cabs; `tools/is5-extract.js` refuses them).

## Source

archive.org `Mdk2Demo`: `MDK2Demo.exe`, 86,442,069 bytes, SHA-1
`981cd1f0774c6dae690cdf97bf08d975a43f8e81`. No licence or redistribution
grant (readmeEN.txt names BioWare Corp. and Interplay registration only), so
local-only.

It is an InstallShield 6 self-extractor: 7z unpacks `data1.cab`/`data2.cab`;
**unshield** reads them (`tools/is5-extract.js` refuses: cab version
0x100600c). The game is file group `Minimum` (MDK2.exe launcher,
mdk2Main.exe, `data\base.zip`/`scripts.zip`/`sounds.zip`, Music\*.acm) plus
group `english` (`data\local.zip`, the string tables). Installed to
`c:\mdk2demo`.

## Startup

- **`MDK2.exe` is only the hardware launcher** (a comctl32 property sheet;
  needs the real comctl32/oleaut32 in `test/binaries/dlls`). *Play MDK2*
  writes `save\config.lua` and spawns `mdk2main.exe`. Without that file
  mdk2Main.exe stops with "ERROR: Missing file. Please make sure the game is
  being run from the install directory." (it loads `config`, then
  `defaultconfig`, as Lua from `save\ scripts\ override\ override\english\
  data\` and the zips; `0x41fbc0`, error helper `0x4522e0`).
- The launcher's defaults (Default OpenGL Driver, 640x480x16, bilinear,
  mipmap, full screen) write exactly these 88 bytes, captured from a CLI run:
  `chSetVideoMode(640, 480, 16, 16, 60, 1, 1, 0.8, 0, 1, 0, 0)\r\n`
  `chSndForceSoftwareMode(1)\r\n` (note `1`, not `0`).
- Through the launcher the spawned child sits in the same wait as below; run
  mdk2Main.exe directly with that config installed (as shogo_demo does).

## OpenGL init (what was fixed)

`0x4526e0` suspends the worker thread (`SuspendThread([0x4b8810])`, the
`_beginthread(0x451f30)` file-request worker), sets the video mode and
resumes it at `0x4534a3`. If GL init fails, the error path loads strings
through that **suspended** worker and both threads idle in `SleepEx` forever
(main polls `[0x4b87d0]` at `0x4522b0`/`0x4522d0`) — no window, no message.
GL init failed for two reasons, both fixed:

1. `ReBaseImage` (imagehlp) had no api_table row: it rebases the GL driver
   file below 0x64500000 before LoadLibrary and ignores the result. A missing
   image is now FALSE/ERROR_FILE_NOT_FOUND (`test-rebaseimage.js`).
2. Its GL loader resolves every name with GetProcAddress and gives up on a
   NULL: `wglDescribeLayerPlane`, `wgl{Get,Set}LayerPaletteEntries`,
   `wglRealizeLayerPalette` (now answered from the pixel format: no layer
   planes) and `wglUseFont{Bitmaps,Outlines}A` (fail-fast rows)
   (`test-wgl-layer-planes.js`).

It then creates its context (ChangeDisplaySettingsA, wglCreateContext,
wglMakeCurrent) and draws. `glVertex4f`/`glVertex4fv` with w = 1.0 are now
exactly glVertex3f/3fv (11,890 calls in one run).

Projective vertices (fixed 9be0a0efb): the level draws through ~3.5M
glVertex4f and ~380K glVertex4fv per run, many with w ≠ 1 (call site
`0x464ffb`). The packed vertex now carries w and both rasterizers divide
by clip w.


## Input

- Keyboard is a DirectInput device (c_dfDIKeyboard, cooperative level 6,
  `Acquire` + 256-byte `GetDeviceState` every frame); the mouse is a
  DirectInput relative device (16-byte state). The CLI needs both the WM and
  the DI form of every action (`keydown`+`di-keydown`,
  `mousedown`+`di-mousedown:1`); the browser feeds both by itself.
- A key must be held across a poll: Playwright `keyboard.press` (down+up in
  one turn) is sometimes dropped at the difficulty prompt; hold 200-400 ms.
- Menu cursor: DI relative motion, ~0.47-0.61 guest px per host px. The
  Options dialogs follow the mouse, not the arrow keys; in the CLI use
  `relmousemove:DX:DY:4` (negative deltas work).
- **Default bindings**, read from the game's own Options (tower icon) ->
  Controls -> Customize screen (CLI frame:
  `scratch/runs/20261011T1745Z-mdk2_demo-controls-screen-w5/customize-bindings.png`):

  | Action | Key |
  |---|---|
  | move forward / backward | Num 8 / Num 2 (arrow keys also work in play) |
  | turn left / right | Z / X |
  | strafe left / right | Num 4 / Num 6 (Left/Right arrows strafe too) |
  | look up / down | Num 7 / Num 1 |
  | jump | Mouse B2 (right button) |
  | shoot / combine | Mouse B1 (left button) |
  | quick save / load | F6 / F7 |

  Further pages: Kurt / Max / Dr. Hawkins Controls, Default Keys 1/2. Space
  toggles Kurt's sniper mode (seen in play). The touch layout maps the arrow
  pad, Fire = MOUSE1, Jump = MOUSE2, Sniper = Space, Enter, Esc.

## Menu and the "attract demo"

Startup runs the Lua scripts `mdk2` and `menu` (`0x41fbc0`;
`0x4426a0(name)` calls a Lua function). The copyright/logo screen *is* the
menu's entry: with no input, the idle timer `[0x4b657c]` runs "playdemo"
(`0x402378`; `-test` on the command line does too), the "Demo"-labelled
level that looped in every early run. Click the logo screen before it fires
(~25 s in the browser) and the main menu appears. Icons: gamepad = New Game,
tower = Options (Video/Audio/Controls/Game), monitor, floppy, red X = quit.

## Route (browser, Chromium, desktop 1280x900, Threads on)

t~12 s click the logo -> menu; Enter -> Select Difficulty (Medium
highlighted; one Up = Easy); Enter -> LOADING comic (~t24-160 if not
skipped). Esc every 10 s from t40 to t110 skips the comic, the title card
"The Jim Dandy, Earth Orbit 8:59AM" and the in-engine cutscenes; one more Esc
pauses (Enter on Paused = Continue). Timing drifts run to run: a lost
difficulty Enter leaves the Esc presses backing out to the quit prompt. When
the route reaches play lit (2 of ~6 runs), Kurt stands on the tutorial pad by
t~114: "Use your directional keys..." -> "Use the mouse to look..." -> "stand
by the arrow... face the exit". Unskipped, the Jim Dandy cutscene is still
running at t260. Evidence:
`scratch/runs/20261011T1715Z-mdk2_demo-browser-gameplay-w5`.

## Black world (NaN camera) -- FIXED: our FSCALE

**Root cause (fixed in the commit that added `test/test-x87-fscale.js`):** our
FSCALE computed `ST0 * pow2(trunc(ST1))` as one f64 factor. The MSVC CRT's
transcendental exit (`_check_range_exit`, `0x484b29`) sends every result
whose double exponent is 0 -- including an exact `0.0` -- through an
underflow fix-up at `0x484b7a`: `fld qword [1536.0] ; fxch ; fscale`.
2^1536 is +Inf in f64 (x87's 80-bit exponent holds it), so `0 * Inf = NaN`:
every CRT math call that legitimately returned 0.0 handed the game a NaN. Four
such calls during the intro produced the NaNs at an object transform
(`0x084da14c/150`), which spread through the matrix code
(`0x46d520/0x46d756/0x46d8b0`) into the camera; with a NaN camera the 3D pass
culls all level geometry and only the ortho HUD draws. FSCALE is now an exact
ldexp (`$fpu_scale`, 06-fpu.wat): zero/Inf/NaN scale to themselves (x87's
invalid `0*2^+Inf`/`Inf*2^-Inf` give NaN) and the exponent is applied in
representable steps. After it: no IE flood, the tutorial room renders in the
CLI route at b6000/b6400 (evidence
`scratch/runs/20261011T2110Z-mdk2_demo-fscale-fix-w5`).

How it was found (tools worth reusing; boat-only hooks in
`scratch/runs/20261011T2000Z-mdk2_demo-nan-source-w5`):
- `--trace-gl` on a black frame: world sprites `xyz=NaN`, no geometry.
- `--trace-fpu` counts the IE flood; a boat-only hook logging the guest
  address + thread of every NaN x87 m32 load found the first NaN floats and,
  in order before them, the four CRT math-error IEs (`0x484b7a`).
- A red herring on the way: `Ricochet.mod`'s colour record (`0xffc9a893`)
  is copied into node 0's weight by the node init at `0x45eefe` and
  overwritten with 1.0 at `0x45ef8e`; harmless, same on hardware.
- Also checked and not the cause: the initial x87 control word (ours 0x037F,
  Windows 0x027F; the CRT exit compares the saved CW with 0x27F, but switching
  did not change the frame), SSE/3DNow/MMX, decompression (JS blast port,
  `scratch/wip/mdk2-dcl-explode-zipblast-w5.js`, 856/856 entries).
- Tooling gotchas: `--trace-at` halts each batch at its first hit, so those
  runs fall behind; plain `--watch` shifts allocation addresses, and neither
  watch mode sees a value written and read inside one fall-through chain.

## Open

- Jump: the binding is the game's own (Mouse B2) and the button is mapped;
  not yet verified in lit play. The historical FSCALE fix reached the lit
  room, but the bounded native check below stopped before window creation.
- Playwright WebKit on Linux has no WebGL on a Worker's OffscreenCanvas
  (control: `getContext` returns null there, a main-thread canvas works), so
  the GL render worker cannot create a context and the game area stays gray.
  Real iOS Safari 17+ has worker WebGL; the WebKit touch pass used
  `?gl-renderer=software`.

## 2026-11-01 bounded native jump check: startup blocker

Run `scratch/runs/20261101-mdk2-lit-jump-control/` leaves jump/landing open.
One unchanged original ran for 54.232 seconds with the registered `mdk2_demo`,
default software renderer, cooperative scheduler, 100000-block batches,
200 ms guest ticks, and frozen CLI control. Small steps reached batch 3110;
reviewed captures at batches 10, 110, 1110 and 3110 remained blank teal.
Snapshots at batches 610 and 2610 reported no windows and no main/focus HWND.
Main EIP stayed at `0x4515cd` (the return after the indirect call at
`0x4515c7`); the sole worker, handle `0xe1000`, start `0x481331`, remained
active with suspend count 1. This is the first observed failure, before the
title click or tutorial route. Its cause was not diagnosed; this run does
not establish recurrence of the historical GL-init/FSCALE faults.

No ordinary input was sent: scheduled, enqueued, dequeued, routed and
dispatched counters were all zero at batch 3110. There is no lit-play,
same-life before/held/released/landed series or consumed Mouse B2 receipt,
and no jump, landing, movement or player-versus-camera claim. The original
exited 0 after an ordinary CLI quit. No second original or repair was tried.

Actual source baseline was `c0c991a95002574a602fa1dfeb50e0d980084b50`
(dispatch baseline `0a33e2db441b3e7dfd987783b0e47229500420b7`). Fresh
predecessor final/result and explicit runtime/source/build release were
verified before the 09:40:14 UTC gate; its runtime deadline was 10:10:14 UTC,
within the overall 10:34:34 UTC bound. The accepted build's 4392 input hashes
and 141 recorded build reads matched, so it was reused. All 4444 pinned
source/module files and all 28 installed-tree files plus the manifest
were unchanged afterward. The original EXE is 761856 bytes, SHA-256
`b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1`;
manifest SHA-256 is
`a0c90df1480e9e81c5734dca97a8e8b308c3709e87964433fe1f4df5875c6316`.
The existing 88-byte `save/config.lua`, derived from the launcher capture
documented above and already installed by the retained candidate recipe,
remained SHA-256
`87261f003683d21f366e28e3c37c89d85804e69daaa2348b17da15bfe8e902ba`.
No config synthesis, download, installer or default changes occurred.

The observed WebAssembly compile input matched the pinned production module
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
All 124 recorded synchronous file reads matched their final local hashes.
The reused observer passed actual synchronous/asynchronous execution,
whole shared 512 MB memory equality, clock identity, and emitted late-10001
retention checks. These validation executions do not extend file-read
coverage: asynchronous/promise/stream reads, incomplete/unclosed descriptors,
descriptors over 24 MiB and reads after the exit flush remain gaps.
Compilation reads are not game runtime reads; compiled-Module instantiation
did not emit separate instance bytes. Logs are compressed and size guarded;
minimum free disk during execution was 2249818112 bytes. Native local box
ID/state/expiry are N/A. Evidence includes `verification.json`,
`input-consumption.json`, `scheduler-snapshots.json`, full before/after pins,
reviewed PNGs and `runtime.log.gz`. No browser/GPU/audio/FPS or broad
playability conclusion follows from this startup check.
