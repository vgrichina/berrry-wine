# SkiFree, 16-bit (Entertainment Pack 3)

Registered as `wep16_ski` (`wep16('WEP3', 'SKI')`). The 32-bit build is
`skifree.md`.

## Route and controls (headless)

The start screen is up by ~1500 batches: skier standing, HUD all zero.
Holding Down (`keydown:0x28` ... `keyup:0x28`, ~200 batches) sends the skier
downhill; the scenery scrolls and the HUD distance rises (986 m by batch 1800
in the evidence run). The HUD Time stays 0:00:00.00 in free skiing; see below.

## Frame counter

`--trace-win16`, windowed with `--input=B:set-win16-trace:1/0`: each game
frame makes one `GetTickCount` (USER.13) call and redraws the four HUD lines
(`TextOut` x4). Over 100 batches: 23 frames skiing, 34 idle. The rate is
interpreter-bound: 23 frames per 100 batches at both 200 ms and 20 ms per
batch, while the guest time between frames scales with the tick. Evidence
`scratch/runs/20261010T0920Z-wep16_ski-control-frames-w6`.

## The HUD Time is a slalom course timer (2026-10-10)

`GetTickCount` (USER.13) is SKI.EXE's only clock. HUD Time is `DS:0xbb4` =
tick - `DS:0xbb0`, updated only while `DS:0xbc6` is set (`seg1:0x1c12`) and
frozen at the finish (Y > `0x21c0`). `seg1:0x1d60` sets `DS:0xbc6` only when
the skier crosses the start line with relative X in [-576, -320]: the slalom
gate. `--trace-at=0x101d56` prints that crossing X in AX: straight down is 0
and down-left -311 (Time stays 0); Left for ~20 batches then down-left is -331
and the Time runs (0:00:36.86). Evidence
`scratch/runs/20261010T1000Z-skifree16-hud-time-w6`.
