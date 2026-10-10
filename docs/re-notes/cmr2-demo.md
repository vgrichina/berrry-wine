# Colin McRae Rally 2.0 demo (Codemasters, 2000)

`lib/apps.js` id **`cmr2_demo`** (localhost-only), exe
`test/binaries/win98-games-a-d/Colin-Mcrae-Rally2-demo-D3D/extracted/CMR2Demo.exe`,
mounted at `c:\cmr2demo\`. Manifest: `node tools/gen-win98-games-a-d-manifests.js`.
Direct3D 7 (IDirect3DDevice7 on a 640x480x16 flip chain), DirectInput keyboard,
Bink (`binkw32.dll`) for movies.

## Install (host-side)

The fixture is an InstallShield 6 Disk1 (`Setup.exe`, `data1.hdr`,
`data1.cab`, `data2.cab`, `ikernel.ex_`). IS6 starts its engine `ikernel.exe`
as an out-of-process COM server (`CLSCTX_LOCAL_SERVER`), which the emulator
does not provide, so Setup stops at "failed to launch installation engine".
Extract the cabinets on the host instead:

```sh
node tools/is-cab.js test/binaries/win98-games-a-d/Colin-Mcrae-Rally2-demo-D3D \
  --extract=test/binaries/win98-games-a-d/Colin-Mcrae-Rally2-demo-D3D/extracted
```

221 files, each checked against its descriptor's MD5.

The game quits at once ("Program finished normally") unless
`HKLM\Software\Codemasters\Colin McRae Rally 2` holds `Sku_Type` and
`Install_Version` as well as the two paths; `startupRegistry` in `lib/apps.js`
writes what the installer would (`Game_HDPath`/`Game_CDPath` = `c:\cmr2demo`,
`Install_Version` = `Full`, `Sku_Type` = `EUROPE`).

## Emulator fix it needed (1817ff91)

Every texture is created as a **DXT5 staging surface** (`DDSD_LINEARSIZE`,
`DDPF_FOURCC`), filled through Lock, then Blt into an ARGB4444 texture: the game
relies on the driver to decompress on Blt. DirectDraw now maps the DXT1-5
FourCCs to their own surface formats, reports `LINEARSIZE` + the FourCC from
Lock/GetSurfaceDesc, and decompresses on Blt into a 16/32-bpp destination.
Before it, every texture in the game was static noise.
`test/test-directdraw-dxt-blt.js` checks it against an independent decoder.

## Running it

- Boot: language screen; **Enter** picks English, then the main menu. At the
  default clock the menu times out at once and the game loops attract demos
  (Australia stage 5, Sweden stage 4, ...) with "demo mode - press any key";
  see the route below for reaching the menu.
- Input is DirectInput `GetDeviceState` (polled 5x per frame); the key buffer is
  at `0x596128`. Default controls from `Controller.rcf`: arrows (DIK C8/D0/CB/CD),
  Space (39) and `1B 1A 2E 13`. `0x49f9e0` folds the buffer into menu flags:
  Left 1, Right 2, Up 4, Down 8, Return 0x10, Esc 0x20, F1 0x1000, F2 0x2000.
- WM_KEYDOWN queues the scan code (`0x4b7690` -> ring at `0x6e1e40`) and WM_CHAR
  the character (`0x4b7620` -> `0x6e1dc8`); the drain at `0x49f370` (ToAscii)
  is text entry. The "any key" scan at `0x49f3b0` is never called in the demo.

## The menus time out into the attract demo

The front end works. Its main menu (rally | arcade | options | quit) has an
idle timer that drops into an attract demo, and at the default 200 ms/batch it
fires within ~200 batches of the language-screen Enter, so a capture never
catches the menu. Slow the clock **before** the Enter: `29000:tick-ms:5`.
(Switching at 30300 is already too late: the timer has run out by then.)

- Game mode lives in bits 3..9 of `[0x526b8c]` (read by `0x405c80`, set by
  `0x4e8680`). The main-menu page object is `0x80f110`, built at `0x4f3060`
  (items: text ids 0x50/0x51/0x53/0x56, 20-byte records from +0x18) and its
  select callback is `0x4f0010`: item 0 (rally) sets mode 2. When the item
  word at `+0x1c` is 0 (the timeout path) it also sets the demo flag
  `[0x80b94c]` = 1, which is what shows "demo mode - press any key".
- In the attract demo, Enter does nothing; Space, Esc and Up end it, re-open
  the front-end files and fall straight back into the next demo because the
  menu times out again. Between a stage and the next menu the game spends
  ~85k batches in zlib `inflate_fast` (`0x4c3ac8`) with no presents, and the
  loading screen fades in from flat `0x9ab4a8`, so a single-colour capture
  there is a fade, not a renderer bug.

## Route to gameplay (2026-10-06, local CLI, ~45 s)

```sh
node test/run.js --app=cmr2_demo --quiet-api --max-batches=421000 --max-seconds=120 \
  --watch=0x80b94c --watch-log --input=29000:tick-ms:5,30000:di-keydown:13,30003:di-keyup:13,\
32000:keydown:13,32020:keyup:13,165000:keydown:38,181000:keyup:38,\
182000:keydown:39,182020:keyup:39,186000:keydown:39,186020:keyup:39,190000:keydown:39,190020:keyup:39,\
195000:keydown:13,195020:keyup:13,340000:di-keydown:38
```

Language Enter, main menu Enter (rally), the rally hub (Information | Set Up |
Repair | Race | Quit, Australia stage 5), Right x3 to Race, Return, the stage
loads and the start lights go green by ~330k. Holding Up (DirectInput)
accelerates: off the line, 50 mph by 360k. Without it the car sits on the line.
Menu presses need ~2000+ batches between them or they land during a page
transition and are lost. The route was captured with that `--watch` on; it
changes block granularity, and without it the same inputs were seen to land in
the attract demo, so keep it until the route is re-timed without it.
Evidence: `scratch/runs/20261006T1650Z-cmr2_demo-gameplay-w6`.

## Car lighting (fixed 9d35dc49)

The car is FVF `0x2d2` (XYZ|NORMAL|DIFFUSE|SPECULAR|TEX2) drawn with LIGHTING=TRUE,
DIFFUSEMATERIALSOURCE=MATERIAL and a zero diffuse dword. The light setup at `0x4b68b0`
switches on a pass number: case 2 (the car) sets AMBIENT from `[0x6d4fe4]`
(`0xff698299` on Australia 5) and enables light 0, the sun; cases 0/1 use
`[0x6d5878]` (never written, so 0) and point lights 1/2, which `[0x51d024]` (a
per-stage table value read at `0x46492e`, headlights) switches off in daylight.
Device7 SetLight/LightEnable/SetMaterial were stored but never applied, so the
car kept its zero diffuse dword. Evidence:
`scratch/runs/20261006T1715Z-cmr2_demo-car-lighting-w6`.

## Text as solid blocks at a 32-bit display (fixed 2026-10-10)

The game sets the display mode at the depth GetDisplayMode reports before it:
640x480x16 while an unset mode defaulted to 16 bpp, **640x480x32** since
c7e568b90 made the default the real (32-bit) desktop. It then takes its
texture format from EnumTextureFormats at that depth. We offered only
XRGB8888 at 32 bits, so every DXT5 texture was decompressed into a surface
with no alpha: each glyph drew as a filled rectangle and the language
screen's round flag dots as squares, in software and on WebGL alike (not a
WebGL bug; w4's report came first from the WebGL arm). EnumTextureFormats now
also offers ARGB8888, as 32-bit DX7 drivers do. Check the mode at batch
33000 with `dump-mem` of `$DX_PROCESS_STATE` (+0/+4/+8 = 640/480/32); the
surface-format table (`$DX_SURF_FMT`, kinds 5 = ARGB8888, 6 = XRGB8888) held
34 XRGB8888 textures and no ARGB4444 before the fix.
`test/test-cmr2-menu-text-gameplay.js` pins it. Evidence:
`scratch/runs/20261010T2020Z-cmr2-glyph-blocks-d10ba697`.

## Open

- Not checked: night stages (headlight point lights) and the browser.

- The inflate page `0x4c3000` is rewritten while it runs: 6927 page
  invalidations, 4435 of which retired a block (a cost, not a correctness issue).
