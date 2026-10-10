# Driver demo (Reflections / GT Interactive, 1999)

`lib/apps.js` id **`driver_demo`** (localhost-only), exe
`test/binaries/win98-games-a-d/Driver-Demo-Glide-D3D/installed/game.exe`
("Driver V5.7t"), mounted at `C:\Program Files\GT Interactive\Driver Demo\`.
Manifest: `node tools/gen-win98-games-a-d-manifests.js`.

## Install (headless)

The fixture is an InstallShield 5 Disk1 (16-bit `SETUP.EXE`, `_INST32I.EX_`,
`data1.cab`):

1. `run.js --exe=.../SETUP.EXE --vfs-include='*' --tick-ms-per-batch=5
   --capture-launch=cap` -> `c:\windows\temp\_ins5176._mp` (at 200 ms/batch
   the bootstrap's splash timer quits before `_INST32I.EX_` is expanded).
2. `run.js --exe=cap/windows/temp/_ins5176._mp --exe-guest-path='c:\windows\temp\_ins5176._mp'
   --vfs-tree=cap --tick-ms-per-batch=5 --control --frozen --save-vfs=inst
   --save-vfs-prefix='c:\program files'`: Next, Next, Next, copy, OK.
3. `game.exe` says "Please run 'Config' first" until `config.dat` exists. Run
   `config.exe` (same mount), **Test Settings** -> "Configuration OK", **Save
   Settings**: it writes the 256-byte `config.dat` beside the exe. The tree
   keeps that file, i.e. it is the state after the user ran Config once.

`config.exe` only offers "3Dfx (Glide 2.x)". Our Direct3D HAL is accepted by its
`EnumDevices` callback (`0x4050ad`) and added as a device record by
`0x4051ed`, yet the dropdown fill (`0x401825`) lists only Glide: the record is
lost somewhere between `0x4098e2` and the `CB_ADDSTRING` loop. Not followed up;
Glide works.

## Emulator fixes it needed (3bbc7155)

- `GetMessageA` returned a posted `WM_QUIT` without removing it. Driver drains
  with `PeekMessage(PM_NOREMOVE)` + `GetMessage` (`0x513335`) and spun forever.
- `grSstControl(GR_CONTROL_MOVE/RESIZE)` returned FALSE; Driver posts
  `WM_CLOSE` when it fails, and a `WM_MOVE` arrives at window creation.
- `guDrawTriangleWithClip` was missing; the NULL from `GetProcAddress` jumped to
  EIP 0 on the first in-game triangle (`0x4ce149`, slot `0x106dcdc`).

## Running it

- CLI captures need **`--glide-renderer=software`** (the default WebGL Glide
  backend gives a blank PNG headless).
- Boot spends ~230k batches in a palette-table build (`0x40686a` calling
  `abs()` at `0x51ccb0` 256x per colour); it is real work, not a hang.
- Use **`--tick-ms-per-batch=5`**: the front end times out into "Demonstration"
  replays on guest time, and at 200 ms/batch that happens within a few hundred
  batches.
- Input is DirectInput (keyboard + mouse, `GetDeviceState` and `GetDeviceData`).
  Menus use the arrows and Enter; **driving keys come from `config.dat`, not the
  arrows** - the defaults include `'` and `Z` (accelerate / steer) at offset
  0x18 (DIK 3b 3c 3d 3e 2c 2d 28 35 39 1c ...). Escape leaves a demo.

## Route to gameplay (2026-10-06, boat, ~700k batches)

```sh
node test/run.js --app=driver_demo --glide-renderer=software --quiet-api \
  --tick-ms-per-batch=5 --control=8187 --frozen --max-seconds=4000 --max-batches=100000000
```

Step to the title/attract loop, Escape out of a demo, then Enter on the front
end starts the "Lose the tail!" chase. From GAME OVER: Down x3 (Restart), Enter,
Left (YES), Enter; the level reloads (~13k batches), then hold `'` + `Z`.
Without input the car sits still and is rammed: GAME OVER at 01:04.48 every
time. With input it burns out, turns and drives to the garage exit, alive at
01:02. Evidence: `scratch/runs/20261006T1520Z-driver_demo-gameplay-w6`.

The whole route is minutes of CPU (software Glide ~2.6k batches/s in 3D): run it
on a boat.

## Glide on WebGL (2026-10-10, boat, `--headless-gl`)

The default Glide backend (WebGL) reaches gameplay headless on a boat with Xorg
(llvmpipe): attract replays, the front end, the chase with its HUD and minimap,
GAME OVER at 01:04.48 without input, and with `'` + Z a burnout, a turn and the
garage exit at 01:01. Evidence:
`scratch/runs/20261010T2200Z-driver_demo-glide-webgl-d10ba697`.

```sh
DISPLAY=:0 node test/run.js --app=driver_demo --headless-gl --quiet-api \
  --real-ticks --control=8187 --max-seconds=4000 --max-batches=100000000
```

- **Use `--real-ticks` on a fast host, not `--tick-ms-per-batch=5`, unfrozen.**
  At ~16k batches/s, 5 ms per batch runs the guest ~80x real time, so the
  front end times out into a replay between two ctl commands.
- **Send menu keys as DirectInput** (`ctl cmd di-keydown:N` / `di-keyup:N`).
  From a replay: Escape (27) -> promo screen; any arrow -> front end on
  "Demo Chase" (items: Driving Games | Demo Chase | Options); Enter (13)
  starts the chase. A Left on the promo can land on the "Cancel | Quit"
  prompt instead, and Enter there quits. GAME OVER -> Restart: Down x3,
  Enter, Left (YES), Enter. Send the drive keys in the same `boat exec` as
  the restart: the cop wrecks a still car about 5 s later.
- The "Demonstration" label blinks, so a frame without it can still be a
  replay; the real chase has the Damage/Felony HUD and the timer.
- **Escape from a replay costs ~75k batches of black screen**: the game
  rebuilds its palette tables (`0x40686a`/`abs()` at `0x51ccb0`, no API calls,
  no Glide presents) before the loading bar. A frozen `ctl png` there is the
  real black frame (a 2061-byte PNG), not a capture bug: frozen captures match
  unfrozen ones once the work is done (+80k batches). Step at least 80k after
  Escape. Evidence: `scratch/runs/20261010T2150Z-ctl-frozen-png-glide-d10ba697`.
