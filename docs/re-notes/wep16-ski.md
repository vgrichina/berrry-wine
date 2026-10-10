# SkiFree, 16-bit (Entertainment Pack 3)

Registered as `wep16_ski` (`wep16('WEP3', 'SKI')`). The 32-bit build is
`skifree.md`.

## Route and controls (headless)

The start screen is up by ~1500 batches: skier standing, HUD all zero.
Holding Down (`keydown:0x28` ... `keyup:0x28`, ~200 batches) sends the skier
downhill; the scenery scrolls and the HUD distance rises (986 m by batch 1800
in the evidence run). The HUD Time stays 0:00:00.00 in free skiing: SkiFree
only times a course, from its start gate. `GetTickCount` advances normally.

## Frame counter

`--trace-win16`, windowed with `--input=B:set-win16-trace:1/0`: each game
frame makes one `GetTickCount` (USER.13) call and redraws the four HUD lines
(`TextOut` x4). Over 100 batches: 23 frames skiing, 34 idle. The rate is
interpreter-bound: 23 frames per 100 batches at both 200 ms and 20 ms per
batch, while the guest time between frames scales with the tick. Evidence
`scratch/runs/20261010T0920Z-wep16_ski-control-frames-w6`.
