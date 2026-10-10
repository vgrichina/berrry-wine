# Moorhuhn 1, 2, Winter-Edition, 3, Tennis and CD extras

Local candidates `moorhuhn`, `moorhuhn-2`, `moorhuhn-winter` in
`test/candidate-corpus/manifest.json` (archive.org item
`moorhuhn_1__2_with_addins`); app ids `moorhuhn`, `moorhuhn_2`,
`moorhuhn_winter` in `lib/apps.js`. All three reach gameplay headless and in
the browser (2026-09-21).

## Moorhuhn (2000, DirectDraw 640x480)

- Title at ~batch 260-300 (`--batch-size=100000`).
- Keys arrive through a `SetWindowsHookExA(WH_KEYBOARD, 0x40cb70)` hook, not
  WM_KEYDOWN. The hook writes `[0x45a200 + (ext<<8 | vk)]`; the title loop at
  `0x402d80..0x402e4d` reads Space `[0x45a220]` (start) and Esc `[0x45a21b]`.
- Space leads to an ENTER YOUR NAME screen, not the round. Name letters are
  WM_CHAR, so the harness needs `keypress`, and Enter confirms. The round is
  mouse-only.
- Route: `330:keydown:32,340:keyup:32,420..445:keypress:<letters>,450:keydown:13,452:keypress:13,455:keyup:13`.
  Gameplay is ~550-900 and the round-end wipe follows.
- The hook (`0x40cb70`) decides press vs release from **lParam bit 31**
  only, and every event also lands in a ring at `0x436bd8` (count
  `[0x436ff8]`; `0x8000|vk` = release). Space *down* clears the title
  text and Space *up* brings up the name band, so "title text gone, no
  band" means the game saw no release. That was the browser with Threads on
  (main thread in a Worker), 2026-09-28: the WinSock thread's empty
  `check_input` poll cleared the page's single `_lastInputEvent` between
  the main thread's `check_input` and its `check_input_lparam` RPC. Every
  keyup then arrived with lParam 0. Fixed per slot in the broker
  (`lib/guest-rpc.js`, `test/test-worker-input-event-slots.js`). The CLI's
  `--threads` keeps the main thread in-process and cannot reproduce it:
  use `tools/web-input-probe.js --threads` against `dev-server.js --isolate`,
  with `keydown:`/`keyup:` held ~300ms (a `key:` tap is released before
  the title loop polls). Reading the ring with an `evalfile:` through
  `window.wine.hostCtx.getMemory()` separates "no keyup" from "bad lParam".
- The black screen before the title is **CPU work, not a timed wait**
  (2026-09-28). The title lands at batch ~260 at both 200 and 50
  ms/batch, `--trace-sched` shows T1 idle in `msgwait` throughout, and
  there are only ~3K API calls to the title. The main thread is loading
  assets through `0x4094f0`, and two loops take ~100M blocks. One is an
  LZ-style decoder `0x4200fa`: bit reader `shr edx,cl`, `jmp
  [0x420a7c+ecx*4]` at `0x41febc`, and the byte copy at `0x42018f`. The
  other is a per-pixel sprite RLE encoder `0x409170`, with its head at
  `0x409227` `cmp byte [edi],0x12`. The uop tier covers ~99% of it
  (`--uop-census`: 0.7M threaded vs ~99M uop blocks). On an M1 under
  node that is ~5.3s of `$uop_fast`, and ~3x that with `--no-uop`. A
  faster boot means a faster uop engine on these two loops, not wider
  coverage.
- **Stuck on the title with the frame cap on** (`?present-cap=60` /
  `--present-cap=60`), 2026-09-28. Space was never seen, but uncapped it
  worked. The cause was keyboard routing, not the pacer:
  - **The WinSock thread polls input too.** T1 (the WinSock thread, start
    `0x418ac0`) owns a hidden "WinSock Window" (hwnd `0x18001`) and pumps
    `GetMessageA` at `0x418b12`, with its dispatch at `0x418b18`. The
    host input FIFO is shared, so whichever guest thread polls first takes
    the event.
  - **The cap made T1 win.** Under the cap, main sleeps ~15 of every 16ms.
    T1 in msgwait is resumed as soon as input is queued, so it won the
    race.
  - **T1 kept the key.** T1 has no focus, so the key's hwnd was 0.
    `$input_route_to_owner` then fell back to `$main_hwnd`, a per-instance
    global that in T1 is the socket window. T1 kept the key and dispatched
    it to the socket window. The hook `0x40cb70` never ran and `[0x45a220]`
    stayed 0.
  - **Real Windows does not get stuck.** It queues keys to the foreground
    thread, so a held key is seen at 60fps with vsync.
  - **The fix.** A focusless poller now routes keyboard input to the
    thread that owns the host's foreground window (`$host_foreground_window`).
    It is covered by `test/test-input-route-foreground-thread.js`.
  - **Why the CLI missed it.** `run.js` used to hand every poller the
    *main* instance's focus, which hid the bug. It now passes the polling
    thread's own focus, as `host.js` does.
  - **Repro:** `--present-cap=60 --tick-ms-per-batch=2 --batch-size=100000
    --input=6000:keydown:32,6100:keyup:32,7000:png:X --count=0x40cb70,0x418b18
    --stuck-after=1000000 --no-close --max-batches=7001` (title by ~5000).
    Broken: hook 0 / T1 dispatch 1. Fixed: hook 2 / T1 0 and ENTER YOUR NAME.
  - **Same route for the other two apps.** `gallinelle` reaches its name
    screen ("Inserisci il tuo nome"). `moorhuhn_winter` (a click at
    320,250) reaches the round.
  - **Ruled out:** a frame-count timeout, the pacer's own sleep arithmetic
    and a stuck hook key.
  - **A caveat that holds on real hardware too.** The pump at
    `0x40e89c..0x40e8d6` drains the whole queue per frame, so a down and up
    both inside one frame cancel. A tap shorter than a frame (~17ms capped)
    is lost on real Windows as well.

## Moorhuhn 2 (v1.1)

- Static imports mudGE/wtnlib/fmod/pluginpack/FModPlugin plus `_strdate`,
  which is absent from the built-in MSVCRT, so the real `test/binaries/dlls/msvcrt.dll` goes
  first in `dlls`.
- `fmod.dll` is UPX-packed. Its stub GetProcAddresses MSACM32 (acmFormatSuggest,
  acmStream*) and `mciGetErrorStringA`, and DllMain returns 0 if any one is
  missing, which led to a jump to EIP 0. `upx -d` to a scratch copy lists the real imports.
- The load is ~500 batches of guest compute (218k `_CIpow` calls). A click at 320,250
  held ~10 batches starts a round, and the highscore screen appears at ~1300.

## Moorhuhn Winter-Edition (2001, Haribo)

- The Moorhuhn 1 engine, with no keyboard hook on the title. The load takes ~1100 batches;
  a click (not Space) starts the round, which runs ~1850-2400.

## Moorhuhn 3 (2001 download edition, German)

Source: `Moorhuhn.zip` from archive.org `moorhuhn_202112`. It holds
`Setup_Moorhuhn3DL_DE.exe` (InstallShield); 7z that, then
`unshield -g "App Executables"` on `Disk1/data1.cab`. The candidate fetcher
does both steps (`moorhuhn-3`). `Moorhuhn3.exe` + `moorhuhn3.dat` are the
whole game. It uses DirectDraw 640x480x16 and DirectSound, and its audio is an
FPU MP3 synthesis filter at `0x43030b`, the hottest block in gameplay.

The exe is packed, and the packer is hostile. Four things had to be real:

- **`fs:[0x30]`** must be a Win9x process database (>0x80000000). A zero
  sends it down the NT PEB path, which faults. `$WIN9X_PROCESS_DB`; worker
  TIBs copy it.
- **It jumps into bytes it just zeroed** and expects the access violation
  that `add [eax],al` with a bad EAX raises. The decoder emits
  `$th_zero_entry` (handler 469) for eight zero bytes in 32-bit code, and that
  handler raises `EXCEPTION_ACCESS_VIOLATION` when EAX is unmapped.
- **Its SEH handler is a raw one**, not `__except_handler3`. `$seh_walk_from`
  calls any frame that does not look MSVC-shaped with a real
  EXCEPTION_RECORD and CONTEXT (`$seh_call_raw_handler`, continuation thunk
  `CACA0037`). The handler edits `CONTEXT.Eip` and returns
  ExceptionContinueExecution. Without this the stub loops ~150 times.
- **The anti-speed-hack watchdog.** After unpacking, the game calibrates RDTSC
  across `Sleep(1001)`. `SetTimer(hwnd, 1, 509, 0x413970)` then compares TSC
  time with GetTickCount time into `[0x4876c0]`. When the gap is over 1093ms
  (`[0x43f3e8]`), it calls `0x4132a0`, which exits the process. Headless,
  the Sleep used to end at the next 200ms batch boundary, so the TSC measured
  240MHz against the real 200MHz. By the first timer after loading, the drift
  had passed a second. `test/run.js` now moves the batch clock straight to a
  main-thread Sleep deadline when no other guest thread is alive.

It also writes `C:\WINDOWS\TEMP\gsm3sys32.exe` one byte at a time and
ShellExecutes it, and probes `highscores.txt` ~26 times.

Route (batch size 200000): the title is up by ~2400 batches as of
2026-09-28 (it was ~1400 when first written). A click at ~2600 leaves it,
another click at ~2850 and Space at ~3050 start the round. The first
gameplay frames are a venetian-blind wipe (4px vertical stripes). That is the
game's transition, not a blit bug. By ~4300 the round is clean.

```
node test/run.js --app=moorhuhn_3 --quiet-api --no-close --batch-size=200000 --max-batches=4301 \
  --input=2600:mousedown:320:240,2603:mouseup:320:240,2850:mousedown:320:240,2853:mouseup:320:240,3050:keydown:32,3053:keyup:32 \
  --png=/tmp/mh3.png
```

Unpacked code is only in memory, so read it with
`--input=B:dump-mem:0xVA:LEN` + `node tools/disasm-dump.js <log> --addr=0xVA`.

Frame loop (2026-10-10, dumped at batch 4300): `0x413f74` reads timeGetTime,
calls the game step `0x4144b0` with `[0x487680]`, reads timeGetTime again,
Flips `[0x4876b0]` (vtbl+0x2c; DDERR_SURFACELOST restores via `0x406ef0` and
retries), busy-waits until 10 ms have passed since the first read, then bumps
the frame counter `[0x4876a4]` at `0x413fd9`. `perf.logicalFrame` is
`0x4144b0` with verifier `0x413fd9`: `--count` gives 5332 hits on each of the
step, the verifier, the loop head and the Flip return over the 4301-batch
route, and `--present-frames=4300` 778 steps for 778 frame ends. The loop runs
on every screen; by batch ~4350 the round has ended and the high-score entry
is up.

### Bonus puzzles (`MOORHUHN 3 - BONUS GAMES/`)

All three are Jigs@w Puzzle (Tibo Software, 2000-2001) self-extractors:

- **Loaders**: `Moorhuhn 3.exe`, `Moorhuhn 3 Fisch.exe` and `Moorhuhn 3 Leuchtturm.exe`.
- **Unpacking**: each writes ten files to `C:\WINDOWS\TEMP\tsldrl6660\` and ShellExecutes `setup.exe` there. That `setup.exe` is byte-identical across all three; the picture is in `data.pck`/`puzzle.pzl`.
- **Capturing**: headless ShellExecute starts nothing, so capture the folder with `--capture-launch=DIR`. Don't use `--save-vfs`: the loader deletes the folder again before exit. The fixture is `candidates/moorhuhn-3-puzzles/{moorhuhn3,fisch,leuchtturm}/`.
- **Registry ids**: `moorhuhn_3_puzzle`, `moorhuhn_3_puzzle_fisch` and `moorhuhn_3_puzzle_leuchtturm`.

What it took to run them:

- **`lt_init: version not found (sfiles/lang.ini)`**: the INI stores `Version="1"`. `GetPrivateProfileString` must drop one matching pair of quotes; `...Section` keeps them. The fix is in `lib/storage.js`, covered by `test/test-profile-string-quotes.js`.
- **DrawDib calls**: it needed `DrawDibBegin`, `DrawDibEnd`, `DrawDibSetPalette` and `DrawDibRealize`.
- **Banded smear on the board**: the board is a 648x424 bottom-up DIB repainted in 8-row strips (`DrawDibDraw` with `ySrc` = 0, 8, 16…). DrawDib counts `ySrc` from the top and StretchDIBits from the bottom, so the handler converts before calling the raster path.

The board is up by about batch 700 of 500000, and dragging a piece works (hover, mousedown, several mousemoves, mouseup):

```
node test/run.js --app=moorhuhn_3_puzzle_fisch --quiet-api --no-close \
  --batch-size=500000 --max-batches=900 --png=/tmp/fisch.png
```

**All three variants and the frame counter (claude:202b4b39, 2026-10-10).**
`moorhuhn_3_puzzle` and `_leuchtturm` reach their boards the same way, and a
piece drag on the CLI (640x480: hover, `mousedown`, five `mousemove`s two
batches apart, `mouseup`, from batch 900) moves it; a no-drag control is
pixel-identical before/after. `setup.exe` is byte-identical in the three
packages, so one counter serves all of them (`perf.logicalFrame` in
`moorhuhn3Puzzle()`):

- `0x40478c` (called through a function pointer) is the repaint poll: it is
  entered ~11k times per 900 batches and leaves at once when nothing is
  dirty, so its entry is not a frame.
- `0x4047a2` is its draw path: `DrawDibBegin` (`0x42a4f4` thunk), the 8-row
  `DrawDibDraw` strip loop (`0x42a4ee`, back-edge `0x404863`), `DrawDibEnd`
  (`0x42a4e8`). FRAME = `0x4047a2`, verifier = `0x404872` (after
  DrawDibEnd); `0x40481b` (after DrawDibBegin) agrees too.
- Idle: 2 passes at load, both full boards (106 strip landings = 2 x 53).
  A drag adds one pass per mouse move, each redrawing only the dirty band
  (~15 strips).
- Page (`?debug&perf`): FRAME 0/s idle; a synthetic 61.5 Hz drag
  (window `mousemove` every 16 ms while the button is held) gave one repaint
  per move, 615 of 615 -- the rate is input-bound. The page desktop is larger
  than the CLI's 640x480 (canvas rect 940x734), so page coordinates differ.
Evidence `scratch/runs/20261010T1130Z-moorhuhn_3_puzzle-gameplay-frame`.

**Snapping and completion (claude:202b4b39, 2026-10-10).** The piece table:
`[0x45eda0]` = array base, `[0x45ed94]` = piece count (35 = 5x7 in Moorhuhn 3
and Fisch, **40 = 5x8 in Leuchtturm** -- read it, do not assume it), one
0x1b0-byte record per piece. In record `p`: current board rect at `p+0`
(l, t, r, b; screen = board + (0, 64) under the banner), outline corners as
doubles after it, home (picture-space) top-left at `p+0x140`, id at
`p+0x148`, held flag at `p+0x168`, neighbour count at `p+0x190` and ids at
`p+0x194`. (Reading a dump by the `ff ff ff ff` markers misaligns by one
record: the rect after a marker belongs to the next piece.)

- Drop handler `0x415f4e` (mouseup only): for the held piece calls
  `0x41629b` -> `0x4162ff`, which walks the neighbours and joins on a fit
  (`0x41651a`, then `0x4163b1`); on a join it plays a sound, then
  `0x415fde` counts the group, and when that equals the piece count it sets
  `[0x45ed8c] = 100` and calls `0x415b62` / `0x4154a0` -- the
  "Gratulation! Mehr Puzzles auf meiner Seite..." dialog. Outside that branch
  `[0x45ed8c]` reads as a percentage (77, 65, 86 on partial solves).
- Two neighbours fit when their rects' offset equals their homes' offset. A
  drop a few pixels off (3, 2) is pulled to the exact fit, and from then on
  dragging either moves both.
- UI in the way: the Bild reference window (close X at screen 148,272) and
  the Bild/Minimieren/Exit panel, which is movable by its blue title bar
  (65,122) and hides piece 8 completely; a grab on the panel presses
  Minimieren/Exit. The shuffle does not depend on the calendar (same layout
  on three pinned dates).
- Solved the base puzzle with 35 ordinary drags through `run.js --control
  --frozen` (driver `jigsaw-solve.js` in the evidence folder: target = piece
  0's position + home offset, readback after every move, undo when a grab
  picked up something else, shift the assembled group aside between passes
  to uncover what lies under it). **All three solved**, each to the game's
  own Gratulation dialog and `[0x45ed8c] = 100`. What the other two needed:
  Leuchtturm has 40 pieces (an early run that assumed 35 left five loose
  pieces it could not see and stuck at 86%); Fisch's picture is 520 x 381 on
  a 640 x 416 table, so the group cannot be shifted aside -- instead every
  loose piece over the picture area is first piled in the free strip right
  of it, and the pile is worked from the top (a 1 px probe drag names the
  piece a grab picked up, which is then sent to its target). A grab that
  picks up the wrong loose piece sends that one home instead ("dig").
  Evidence `scratch/runs/20261010T1200Z-moorhuhn_3_puzzle-snap-complete`.

## Best Of Moorhuhn (2001 CD, `archive.org/details/best_of_mh`)

The ISO holds three InstallShield 5 setups (`unshield` each `data1.cab`).

- **Moorhuhn 1**: `moorhuhn.exe` is byte-identical to the `moorhuhn` candidate.
- **Moorhuhn 2 and Winter-Edition**: other builds of games already listed, not new content.
- **What is new**: MH1's `spiel1.exe`, `spiel2.exe` and `making_of.exe`. These are registry ids `moorhuhn_training_1`, `moorhuhn_training_2` and `moorhuhn_2_making_of`, with the fixture in `candidates/best-of-moorhuhn/`.

Each of the three is a Delphi **Jester** wrapper:

- **What it does**: it opens itself, reads data appended to the image and writes the real Flash projector plus `jesterrun0.dll` to `C:\WINDOWS\TEMP\Jgl_Rt\`. It sets WH_KEYBOARD/CBT/MOUSE hooks from the DLL and deletes everything again.
- **Headless**: the wrapper launches nothing and posts itself WM_CLOSE. The hooks are what hide the projector's menu bar on a real machine.
- **First failure**: `EFOpenError "Cannot open file C:\spiel1.exe"`. The first VFS handle was `0xF0000001`, and Delphi's `FileOpen` treats any handle < 0 as failure. Handles now start at `0x70000001` (`lib/filesystem.js`, covered by `test/test-vfs-handle-sign.js`).
- **Getting the projector out**: neither `--save-vfs` nor `--capture-launch` works, because the files are deleted and there is no launch. Export them mid-run instead:

  ```
  --batch-size=5000 --input=300:vfs-export:\WINDOWS\TEMP\Jgl_Rt\spiel1.exe:/tmp/x/300.exe,...
  ```

  Keep the last full-size export.
- **Running them**: the projectors run standalone. START is at (305,160) in Training 1 and (320,140) in Training 2, and the stopwatch counts down with `--batch-size=400000`.
- **Shooting (2026-10-10)**: the hits/misses boards respond in both trainings.
  - **Training 1**: the targets are chicken cutouts on a fence that slides left. They turn edge-on (the black poles) and face the player for about 7 batches at a time.
  - **A shot that counts nothing**: one that lands just after a bird turns edge-on scores neither a hit nor a miss.
  - **Finding a facing bird**: take a `png` first, because the headless canvas only repaints on capture and an eval otherwise reads a stale frame. Then scan the field (x 108-500, y 250-362) for white pixels; a facing bird is about 50 px wide.
  - **Training 2**: its cutouts fly over a sky scene. Runs are deterministic, so a shot at a position read off an earlier run's frame hits.
- **Frame counter**: each projector frame is exactly one `GetDC` + dirty-rect `BitBlt` + `ReleaseDC` from one site (`BitBlt` returns to `0x40b479`). There are no DirectDraw presents. A live round draws 101 frames per 120 batches of 400000 blocks in both trainings.
- **`making_of.exe`**: a Flash slideshow, not a game. `>>` at (330,437) turns the page.
- Evidence is in `scratch/runs/20261010T0850-moorhuhn_*`.

## Gallinelle XXL (2003 Italian Moorhuhn 1, `archive.org/details/gallinelle-xxl`)

**The image**: the zip is a raw MODE2/2352 BIN/CUE. Keep bytes 24..2071 of every sector to get an ISO, then `unshield` `SETUP/DATA1.CAB`.

**The game** (`gallinelle`): `Game/Gallinelle.exe` is a different build from our `Moorhuhn.exe`, but it runs unchanged. The route is the same:

- Title at ~300 (`--batch-size=100000`).
- Space, a typed name, Enter.
- The round is up by ~650.

**Bonus**: `Bonus/trainingsarea{1,2}.exe` are plain Flash 6 projectors with no Jester wrapper, the Italian twins of the Best Of Training-Areas. They are kept in the fixture but not in the dropdown.

## Moorhuhn Tennis (2002, Flash)

Source: `Moorhuhn-Tennis.exe` from archive.org `moorhuhn-tennis`, a Wise
installer. Its payload is in an overlay 7z cannot open, so install it inside
Wine Assembly. Control id 3 exists on a hidden progress dialog as well
(its Abbrechen), so `wait-dlg-control:3` + `dlg-click:3` cancels setup.
Click Weiter by position (378,395) every ~400 batches of 10000 instead.

The installed `moorhuhn_tennis.exe` is only a wrapper. It unpacks
`swfxxlrt.dll` and a `<random>TMP\` folder holding `MH_Tennis_V14.exe`,
`source.swf` and `basepath.txt`, then CreateProcesses the exe and polls
EnumWindows/GetWindowThreadProcessId/Sleep for its window. Headless
CreateProcess does not start a child, so it waits forever. `MH_Tennis_V14.exe`
is a stock Macromedia Flash Player 6 projector with the game appended (it
seeks to its own tail). It runs directly. `lib/apps.js` `moorhuhn_tennis`
points at it, and the candidate manifest entry is manual and lists these
steps.

Route (batch size 100000): the instruction screen appears by ~300 batches. Hover
"weiter" (243,462), press at 1500 and release at 1520; a two-batch click only
highlights the button. The chicken follows the mouse.

### No game-step counter yet (2026-10-10)

The game is the SWF appended to `MH_Tennis_V14.exe` (trailer `0xFA123456` +
length; 291,139 bytes, Flash 6, **25 fps, 69 frames**); `source.swf` beside it
is a one-frame 12 fps loader. The projector ticks a periodic
`timeSetEvent(23 ms, res 11, 0x4644e0)` after `timeBeginPeriod(1)`, plus a
400 ms `SetTimer`. `0x42cf20` (single caller `0x46450b`; clears a slot at
`+0xd0`, calls `[vtbl]`, reads timeGetTime) runs once every second tick:
1706 hits for 3338 ticks of `0x4644e0`, ~21.3/s, which is the 25 fps
timeline quantised to 46 ms. As `perf.logicalFrame` it counts 638 steps from
batch 0 but **zero** in the match at the serve, where the movie is stopped
and only redraws when the player acts. So it is the timeline advance, not a
per-frame game tick; it was not declared. A real step needs the player's
per-frame ActionScript dispatch (onEnterFrame/clip events), not yet located.
Presents are GDI, so `--present-frames` sees no frame ends either.

## Gallinelle XXL: frame counter and the hit test (2026-10-10)

`gallinelle` at 100,000-block batches: Space held 330-340, name letters as
`keypress` (420-436) and Enter (444-449) start a round by batch 549 (timer
01:15, eight shells). Each frame is exactly one `IDirectDrawSurface_Flip` of
the primary from one site (return `0x4152f8`), after one Lock/Unlock of a
compose surface and one Blt into the back buffer: over 549-800, 2,030 presents
== 2,030 Flips, 1,422 of them changed. `--frame-stats` records each Flip twice.

The first aimed CLI shots registered no hit. That was the route, not the
emulator. A hover-then-press shot scores 0 -> 25
(`scratch/runs/20261010T0735-gallinelle-hit-scored`; the earlier misses are
in `…T0800Z-gallinelle-control-frames` and `…T0715-gallinelle-aim-check`).
The input path, as RE'd:

- **Wndproc `0x40cdc0`.** Mouse messages go through a jump table: index
  msg-0x200, bytes at `0x40de48`, targets at `0x40de1c`. Every target calls
  `0x412ae0(wParam, lParam)`.
- **Event ring.** `0x412ae0` pushes {type, buttons, x, y} into a 64-entry
  ring of 6-byte records at `0x43962c`. The write index is `0x439624`, the
  read index `0x439628`, and the pop is `0x412c10`.
- **Per-frame pump `0x408840`.** It drains the ring into the cursor
  position `[0x45074c]`/`[0x450750]` and the press bits `[0x450754]` (1 is
  left, 2 is right/reload).
- **Hit test `0x405f40`.** This runs every frame, **before** that frame's
  pump. It sets `[0x45ae50]` = -1, then walks the objects at `0x45af00`
  (stride 0x5c: float x/y at +0x10/+0x14, w/h at +0x38/+0x3c, active
  +0x58). For each object it tests the point (cursor x+16, cursor y+16),
  which is the crosshair centre and the source of the "+15,+16" drawing
  offset. Inside a bounding box it re-draws the sprite at (0,0) into a
  scratch buffer (`[0x4372a4]`, cleared to colour key 0x12, pitch w). It is
  a hit only if that pixel is opaque *and* equals the screen buffer
  `[0x45d424] + y*[0x45d420]` there, i.e. the bird is visible on top.
- **Shot `0x407125`.** It reads `[0x45ae50]`: `0x40715e` is the hit branch,
  which adds the bird's points to the score `[0x45aee4]`, and `0x4078a8` is
  the miss branch.

**Aiming, for routes.** The press uses the hit index from the frame
*before* the press arrives. Move the cursor onto the bird, step at least
one batch, then press, never `mousemove`+`mousedown` in the same batch. Aim
at the art, not the box: a 30x20 bird's opaque pixels are columns ~12-24 and
rows ~5-15, so `(x+2, y-6)` from the object's x/y is a body pixel. A ctl
eval that lists live birds is saved with the run
(`chicken-list.eval.js`).
