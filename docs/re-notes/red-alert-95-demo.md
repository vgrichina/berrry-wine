# Command & Conquer: Red Alert (Win95 demo)

Westwood's 1997 demo CD in `test/binaries/win98-games-a-d/CnC-Red Alert Demo-SW/`.
The CD's `INSTALL\` directory is the game itself: `RA95.EXE` (v1.19 demo) runs
straight from it, with `MAIN.MIX`, `REDALERT.MIX`, `REDALERT.INI`, `RESLIB.DLL`
and the `THIPX16/32.DLL` IPX thunk pair beside it. No installer run needed.
Registry id `red_alert_95_demo` (localhost-only), manifest written by
`tools/gen-win98-games-a-d-manifests.js`.

## Route to winning Allied mission 1 (frozen control, 33 ms/batch)

Run `20261124-red-alert-win` won this mission. It was played frame by frame,
taking a step/png before every action, with:

```
node test/run.js --app=red_alert_95_demo --control=8125 --frozen \
  --tick-ms-per-batch=33 --batch-size=100000 --quiet-api --quiet-blocks
node tools/ctl.js -s :8125 step N | png F | click X,Y | key VK | cmd ...
```

Each batch is 33 ms of guest time, so a `ctl record on F --every=1 --scale=2`
recording plays back in real time at 30.3 fps. That recording is 1280x960;
crop it to the game with `crop=1280:800:0:80`.

**Coordinates are now letterbox-mapped.** `snapshot`'s `pointerMapping` puts
the 640x400 game at dst y=40, so click where a thing is drawn on the 640x480
PNG. The "click (x, y-40)" rule in the older route below is obsolete.
Mid-run `ctl png` captures are not black.

| batch | action / screen |
|---|---|
| ~1800 | main menu; click (321,223) Start New Game |
| | click (125,270) twice to pick Easy, then OK at (498,292) |
| | click (260,268) Allies; the briefing comes about 200 batches later |
| ~2400 | click OK (318,311) on the briefing: the snow map, MCV and squad in the NE corner |
| ~40650 | MISSION ACCOMPLISHED, then the score screen |

After the menus, `cmd set-batch-size:80000`. RA spins on API calls when idle,
so that budget still leaves it spare capacity and it runs at full guest speed.
Wall cost is about 1.5-2x real time.

Play:

1. Deploy the MCV.
2. Build 2 power plants, a refinery, a war factory and a barracks.
3. Build light tanks plus rifle and rocket infantry. RA 1.19 has no build
   queue, so click again after each unit finishes.
4. Ctrl+1 assigns the team (`cmd keydown:17`, `cmd keydown:49`, then the two
   keyups). `key 1` selects it and `key H` jumps home.
5. The Soviet base is west along the bottom road, on this side of the river.
   Shoot the explosive barrels:
   - the barrels by the entry turret
   - the cluster by the power plants

   Each chain-explodes most of the base. Then kill the barracks, the war
   factory, the kennel and the stray infantry on both river banks.
6. Clear the NW road and keep your tanks off it. The convoy trucks enter from
   the NW, ford the river (barrels blew the first bridge), drive east along
   the bottom road and leave off the SE edge. The win fires when they are gone.

These all worked: edge scrolling (park on x=0/639 or y=40/439, then step),
drag-select, attack and move cursors, building placement, sidebar arrows and
hotkeys. No emulator gap was hit on this route.

## Older route (headless, default 200 ms/batch clock)

All mouse coordinates are host canvas coordinates. The game runs a 640x400
mode that we letterbox 40 px down inside 640x480, but `GetCursorPos` is not
letterbox-corrected. **A host point (x, y) lands at game (x, y)**, so to hit
something the screen shows at (x, y+40), click (x, y).

| batch | action / screen |
|---|---|
| ~96 | `timeSetEvent(16ms periodic)` + `Sleep(1000)` timer self-check (see below) |
| ~100000 | main menu: Start New Game / Exit Game |
| 120000 | click (321,183): Start New Game, then the difficulty slider |
| 170000 | click (500,253): OK, then "Choose your side" |
| 200000 | click (260,228): Allies, then the mission briefing |
| 640000 | click (318,271): OK, then the first Allied mission (snow map, squad + MCV) |
| 900000+ | click a unit, click ground: it drives there |

Use end-of-run `--png-canvas --png=` captures. Mid-run `B:png:` captures came
back black on this 640x400 mode, which is a capture-path gap, not the game.

## Emulator gaps fixed

- **THIPX32 `_IPX_Initialise`.** THIPX32 is a flat thunk to THIPX16 and the
  real-mode IPX driver. Our `ThunkConnect32` reports success without
  connecting, so loading the real DLL jumps into its unfilled thunk table.
  `_IPX_Initialise` (cdecl, no args) is a constant-FALSE stub row in
  `api_table.json`, the answer of a box without IPX installed. The other
  `_IPX_*` exports stay unimplemented: they are only reached after a
  successful initialise.
- **Main-thread Sleep between thread slices** (`lib/thread-manager.js`
  `noteMainSleep`). At `0x553ad0` the game starts a 16 ms periodic
  `timeSetEvent`, Sleeps 1000 ms and compares a tick counter (`0x6525bc`); an
  unchanged counter is "There has been a timer initialization error". The CLI
  re-ran main between cooperative slices before recording the Sleep deadline,
  so the Sleep returned before the new winmm timer thread had run once.

## Open

- Mouse input is letterbox-mapped as of the 2026-11-24 run; the older note
  saying it was not is outdated.
- FPS and the browser path were not evaluated. The CLI recorder captured
  audio, but nobody has listened to it.

Evidence:
- `scratch/runs/20261006T005200Z-red-alert-95-demo-claude202b4b39-mission1`
- `scratch/runs/20261124-red-alert-win`: mission 1 won, with a 1280x800 video
