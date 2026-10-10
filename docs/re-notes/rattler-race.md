# Rattler Race (Entertainment Pack, `snake.exe`)

`lib/apps.js` id **`snake`**. It is GDI-only: every drawing operation is a
`GetDC` + `PatBlt`/`BitBlt` + `ReleaseDC`, with no DirectDraw and no frame
boundary.

## Steering, by A/B (2026-10-10)

`--tick-ms-per-batch=20`, default budget. F2 at batch 100 shows the "ROOM 01"
card, and the field is live by 303. The snake enters at the bottom heading
up, toward a red bar.

Two runs of one command differ only in a Left press (`keydown:37`) at batch
420. Captures up to 420 are byte-identical.
- Run A: the snake turns left under the bar and is alive at 520.
- Run B: it runs into the bar, a life is lost, and "ROOM 01" is back by 520.

## Step counter

One movement step is one tail-erase `PatBlt` (returns to `0x01002a18`). There
are 39 in 2.34 guest-s at both a 20 ms and a 10 ms tick, so **16.7 steps per
guest-second** is the game's own clock. The head `BitBlt` (`0x01003be2`) and
`GetDC` counts change with the tick (they are redraws), so do not count those.
The erase is skipped while the snake is still growing, so the count runs a
little low right after a (re)spawn.
Evidence: `scratch/runs/20261010T0630Z-snake-control-steps`.
