# Maxwell's Maniac (WEP4 / Win16)

`binaries/wep16/WEP4/MAXWELL.EXE`, app id `wep16_maxwell`, a 16-bit NE game. It
uses WEP4UTIL (loaded as a Win16 module) and CARDS, staged for LoadLibrary.
The chamber is split by a vertical slidegate. Balls bounce around. A left
click moves the gate and a held button stops it (the game's Help). Letting
balls through the gate's opening is the game.

## Route (headless, CLI 640x480 screen)

No dialog to dismiss: `--app=wep16_maxwell --batch-size=20000
--tick-ms-per-batch=20` is in a live chamber by batch ~400 ("Level: 1",
"Good Time Left: 132" at batch 410). The window sits at 21,21. The chamber's
floor is x ~45..525, y ~100..355. The gate column is x 272..288, and its
opening is about y 200..285 before any click. A click anywhere in the chamber
(400,150) slides the gate down. At 520 the opening sits at the bottom, about
y 270..350.

## Input A/B (`test/test-win16-wep4-gameplay.js maxwell`)

Two runs with the test's flags (`--repaint-every=5`, 20 ms/batch). They are
byte-identical through batch 420. The click arm presses at 430 and releases
at 432. At batch 520 the gate column differs (1963 px). The ball heading left
went **through** the opened passage into the left chamber (x 265..272,
y 314..324). In the no-click arm it bounced off the closed gate and is at
x ~318 on the right.

Without `--repaint-every=5` the same A/B changes only the gate column (1942 px).
At 520 the balls are identical, because the ball had not yet reached the gate.
So the ball crossing depends on the run's flags, and the gate move does not.
Treat the crossing as the test asserts it: same flags, same batches.

## Frame counter

Win16 calls are invisible to `--trace-api`. Use the `B:set-win16-trace:1/0`
input action over a batch window, then count `[win16]` lines. A frame is one
WM_TIMER (timer id 1, hwnd 0x010a): `USER.66 GETDC`,
`GDI.52 CREATECOMPATIBLEDC`, 4x `GDI.34 BITBLT`, `GDI.68 DELETEDC`,
`USER.68 RELEASEDC`. Every other frame adds `EXTTEXTOUT` (the score and time
text). Over batches 300..400:

| ms/batch | guest-s | WM_TIMER = GETDC frames | frames/guest-s |
|---|---|---|---|
| 5 | 0.5 | 10 | 20 |
| 20 | 2 | 34 | 17 |
| 200 | 20 | 100 | 5 (one WM_TIMER per batch) |

The rate is timer-paced: about 18 Hz, a ~55 ms timer. It is not
interpreter-bound. At the 200 ms default only one WM_TIMER is delivered per
batch, so use 20 ms/batch or less for anything timed.
