# GeneRally

Freeware top-down 3D racer (2002). Fixture `test/binaries/candidates/generally/`
(`GeneRally.exe`, `TrackEditor.exe`, `Cars\`, `Drivers\`, `Tracks\`, `gr.ini`).
Registered as `generally` (and `generally_track_editor`). DirectDraw with the
game's own software 3D renderer, DirectSound, DirectInput 8.

## Input

The keyboard is read through **DirectInput 8** (`DINPUT8.dll`
`DirectInput8Create`), not window messages. Bindings live per driver in
`Drivers\*.drv`: `Player.drv` holds DIK `0xC8/0xD0/0xCB/0xCD` at file offset
80 = Up/Down/Left/Right (accelerate, brake, steer). `$di_dik_to_vk` maps those
to the arrow VKs, so `--input=B:keydown:38` drives the car.

## Route to a race (headless)

```sh
node test/run.js --app=generally --quiet-api --stuck-after=0 --no-close \
  --tick-ms-per-batch=2 --max-batches=119250 \
  --input=13000:click:432:100,13300:click:120:288,13600:click:558:464,113600:keydown:13,113700:keyup:13,117700:keydown:38,119201:keyup:38
```

1. Main menu at ~13000: click "player" in the driver list (432,100) to put
   it on the grid, click track "agari" (120,288), Start (558,464).
2. "LOADING..." is compute: ~100k batches (it is not waiting for anything).
3. A "Time trial / 5 laps / Best time" overlay waits for **Enter**.
4. Three countdown lights, then the race; the timer reads 00.00 until the
   start line is crossed.

## The clock is the trap

One frame costs ~47-75 batches of interpreter work (one `BltFast` + one
`Flip` per frame), and the game runs a fixed-step simulation that catches up
on elapsed time. At the default 200 ms/batch a frame therefore spans ~14 guest
seconds: the countdown passes inside a single frame and a short held key is
sampled at most once, so driving input looks dead. That is what stalled the
2026-10-03 browser run. Use `--tick-ms-per-batch=2`.

Frame counter (`--present-distinct`, slot 5 = the Flip): qualified 1:1, every
present a new picture, but the rate is interpreter-bound, not the game's pace:
the same 1500-batch window gives 10.6 frames/guest-s at a 2 ms tick and 3.6
at 4 ms (47 -> 75 batches per frame). Quote work or browser wall-clock FPS,
never a headless per-guest-second rate.

Evidence: `scratch/runs/20261010T0630Z-generally-control-frames-w6` (A/B:
both arms identical at 117700; only the post column sways without input; the
car drives to the top straight with Up held).
