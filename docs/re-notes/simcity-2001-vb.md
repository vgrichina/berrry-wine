# SimCity 2001 (VB6 p-code) — interpreter benchmark candidate

App id `simcity_2001_vb` (local-only). Files and provenance: `test/binaries/SOURCES.md`
("SimCity 2001, VB6 p-code"); archive.org item `sim2001`, anonymous 2000 freeware.

## Why it qualifies

`installed/simcity2001.exe` imports `ProcCallEngine`, `MethCallEngine`, `EVENT_SINK_*`,
`DllFunctionCall` and exactly one `__vba*` (`__vbaExceptHandler`) by name — the p-code shape.
Native-compiled VB exes import 100+ `__vba*` helpers and never `ProcCallEngine`. Seven other
VB5/6 games checked on archive.org were native code (Gridlock, Cowtris, Paku-Paku Pac-Man,
VBPong, Jouster 4, Tic Tac Doh, Space Harrier VGL, MarioNES, The Track); only Microsoft's
setup stubs (`SETUP1.EXE`) and this game were p-code.

## Load bases

- `simcity2001.exe` at its preferred `0x400000` (180 KB).
- `MSVBVM60.DLL` 6.00.8268, **the copy shipped in the CAB** (the app entry names it in
  `dlls`): loaded at `0x52e000`, origBase `0x66000000`, so `runtime = orig - 0x65ad2000`.
  Its `ENGINE` section (`0x66102000..0x6610f0b5`, runtime `0x630000..0x63d0b5`) is the p-code
  interpreter. The registry `test/binaries/dlls/msvbvm60.dll` is a different build with a
  different layout (ENGINE at `0x660fd000`); do not disassemble that one for these addresses.
- `oleaut32.dll` at `0x786000`.

## Dispatch shape: direct-threaded, replicated tail jump

There is no central loop. Every p-code handler ends with its own fetch-and-jump:

```asm
66104fbe  mov [ebp-0x14], esi
66104fc1  xor eax, eax
66104fc3  mov al, [esi+0x1]        ; next opcode byte
66104fc6  add esi, 0x2             ; esi = p-code IP
66104fc9  jmp [0x66106d14+eax*4]   ; primary 256-entry handler table
```

Runtime table base `0x634d14`. Lead bytes FB..FF select secondary tables the same way.
Handlers call into `.text` (`__vba*` helpers, variant/string ops) with ordinary calls, so the
benchmark exercises both a hot indirect `jmp` per opcode and call/ret pairs into the runtime.
Hot handler entries (runtime): `0x633cab` (push signed byte const), `0x632fbe`,
`0x6331c4`, `0x63319d`, `0x633609` (`movsx eax, word [esi]; mov ax,[eax+ebp]` — load local
I2), and a variant-type switch at `0x63497c` (`cmp eax,0x11; ja; jmp [0x66106a18+edx*4]`).

## Headless route (no input)

```
node test/run.js --app=simcity_2001_vb --quiet-api --quiet-blocks --max-seconds=60 \
  --max-batches=30000 --no-close
```

The main window (empty map, side panels) is up by batch 6000 (~4 s); the simulation timer
then advances the date and treasury every tick with no input (JAN 1900 at 6000, FEB 1901 at
15000). Over batches 20000..30000 (`--handler-hist --handler-hist-thread=0
--handler-hist-start=20000 --handler-hist-stop=30000 --hist-json`): **75.4% of block entries
in ENGINE**, 20.7% in the rest of msvbvm60, 0.6% in the exe, 0.8% oleaut32. `--count` on
`0x632fbe,0x633cab` gives 0.70M / 0.89M hits by batch 20000. The run reaches 20000 batches in
~13 s wall; `--cpu-window=10000:20000` measured 6.3 s user.

Evidence: `scratch/runs/20261124-interp-bench/simcity_2001_vb/`.

## Window tree

Top-level form, client origin screen (48,43) in the headless 640x480 layout. Map picture box `pbSCREEN`
(`0x10072`, client ~ screen 58,53, 13-px tiles) with a mask box `0x10073` under it. The tool
buttons are `Selector` control arrays inside three VB6 Frames (BS_GROUPBOX superclass, style
`0x56010007`): Frame3 "Road $2000" (`0x1004e`), "Buy Small $90,000" (`0x1005a`), "Buy BIG
$300,000" (`0x10065`). Status/Population/Income panels on the right.

Turf is drawn as random pixels on purpose and changes with the season: spring green/pink,
summer green, fall orange, winter white. A building is bought and placed whole; population
moves into what you buy (nothing grows on its own zone the way SimCity's does).

## Bugs fixed (2026-11-24)

1. **White map** (066cf7431). USER links a new WS_CHILD at HWND_BOTTOM; we linked it at the
   top. The mask box, created after `pbSCREEN`, sat above it and clipped all of the map's
   painting away. `test/test-create-child-zorder-bottom.js`.
2. **Tool buttons unclickable.** `$wnd_child_from_point_deep` skipped group boxes as
   transparent, and with them their children, so every click on a Selector went to the form.
   A group box is still transparent itself, but a child under the point now wins.
   `test/test-child-from-point-deep-zorder.js`.
3. **Quick clicks on tools did nothing.** VB's control proc reads `GetKeyState(VK_LBUTTON)` on
   WM_LBUTTONDOWN and only captures (and so only raises Click) if it reads down. GetKeyState
   is queue-synchronous; we returned the device state, already up while the game was busy
   redrawing. Mouse-button VKs now come from the MK_* flags of the last mouse message removed
   from the queue. `test/test-getkeystate-queue-sync-mouse.js`.
4. **A tool click right after a map click became a second map click.** The host routes a mouse
   event to the capture window when it happens; USER does it when the thread reads it. The game
   holds capture on the map for a whole slow placement, so the next press, made before the
   game read the release, was addressed to the map. A client mouse message addressed to the
   window that last lost capture, with its point outside that window, is resolved again at
   GetMessage/PeekMessage time (`$input_retarget_stale_capture`).
   `test/test-mouse-retarget-stale-capture.js`.

## Play route (ctl.js, headless)

```
node test/run.js --app=simcity_2001_vb --no-build --quiet-api --quiet-blocks \
  --control=8166 --frozen --stuck-after=0 &
C(){ node tools/ctl.js -s :8166 "$@"; }
C step 8000                                   # main window up
C click 111,428; C step 600                   # Road: horizontal
for x in 150 163 176 189 202 215 228 241 254; do C click $x,200; C step 600; done
C click 111,452; C step 1500                  # Road: vertical
for y in 162 175 188 214 227 240; do C click 267,$y; C step 800; done
C click 171,404; C step 1500; C click 160,186; C step 1000; C click 186,186   # small Res x2
C click 170,427; C step 1500; C click 212,186                                 # small Com
C click 172,452; C step 1500; C click 238,215                                 # small Ind
C click 318,414; C step 1500; C click 300,150                                 # BIG Res
C step 10000; C png city.png
```

Roads cost $2000 a tile, small buildings $90k, BIG $300k. The game redraws in p-code and lags
input by thousands of batches: a click registers, but the map/title can show it only 2000-6000
batches later. Judge by funds after waiting, not by the next frame. Result: OCT 1901 pop 33
-> OCT 1903 pop 501, income 4254 -> DEC 1904 income 9084, funds rising
(`scratch/runs/20261124-sc2001-white-map/route2/`, contact sheet beside it; an earlier session
reached OCT 1908, pop 941, $55,822 rising).

Verdict: playable. Roads, small and BIG buildings place, the date advances, population moves in
and income turns positive. Remaining: input lag from the slow p-code redraw (a CPU cost, not a
routing bug); File menu save/load not exercised.
