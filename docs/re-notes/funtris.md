# Funtris local idle audit

2026-09-10, source304, headful Chrome. This is a realtime falling-tetromino
game. Actual Game/New menu command40001 starts a piece; the before/after
screenshots show it falling while no further input is sent. Renderer CPU1.68%
over10s, host load5.57, main parked at414fd1 (yield7), helper
sleeping at403f3a. Raw `/private/tmp/wa-idle-puzzles-start304/funtris.json`
and matching PNGs. The previous102% startup helper-wait spin is fixed by the
generic cooperative deadline change; this confirms gameplay still advances.
Existing browser gameplay regression: `test/test-funtris-web-launch.js`.

## Input A/B and gravity counter (CLI, 2026-10-10)

An About box comes up first (OK at 315,277). Game/New is `post-cmd:40001`.
At a 20 ms tick: OK at batch 100, New at 153, and a piece falls at Level 1.
- **Input:** the same command with and without three Left presses
  (`keydown:37` at 200/210/220). The piece ends three columns further left
  only in the run that presses. Everything up to 200 is byte-identical, and
  the piece's height matches.
- **Gravity:** one row of fall is one `GetDC` (returns to `0x00416048`) with
  two `BitBlt` (returns to `0x00403b62`). That is 12 rows in 4.8 guest-s at
  both a 20 ms and a 10 ms tick, so **2.5 rows per guest-second** at Level 1,
  on the game's own timer.
- Moves use the same draw path (the three Lefts add 6 passes), so count
  gravity in a run without input. This is a gravity rate, not a frame rate.

Evidence: `scratch/runs/20261010T0640Z-funtris-control-gravity`.
