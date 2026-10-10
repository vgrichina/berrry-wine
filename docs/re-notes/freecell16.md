# FreeCell, 16-bit (`win98-16bit/FREECELL.EXE`)

`lib/apps.js` id **`freecell16`**. It is Win16 GDI, so `--trace-api` sees
nothing; use captures and host flushes.

## Route and a move, by A/B (2026-10-10)

The table is empty until a game is dealt. With the default budget and
200 ms tick, F2 at batch 100 deals Game #28655 by 150. Moves are
click-to-select, then click-destination:
- Click the A♦ at the bottom of column 6, (437,290), at batch 160.
- Click the first home cell, (390,90), at 180.

The ace moves home and column 6 then ends on the J♠. The same command
without the clicks keeps the deal; the two deal frames match byte for byte.

There is no clock and no animation loop, so there is no frame rate. Repaints
follow input: over 80 batches there are 7 host flushes idle and 20 with the
move.

Evidence: `scratch/runs/20261010T0700Z-freecell16-home-move`.
