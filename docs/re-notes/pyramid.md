# Pyramid (Funpack, `Pyramid.exe` + `FunPack.dll`)

`lib/apps.js` id **`pyramid`**. GDI card game: cards are drawn with `BitBlt`
inside `BeginPaint`/`EndPaint`. Starting is `WM_COMMAND 40003` (the top-level
Start!), then the Game menu (42,52) and New (57,72), as in
`test/test-pyramid-menu.js`. At 50000-block batches the deal is up by batch
61.

## A completed move, by A/B (2026-10-10)

That deal's bottom row is 9D JH 10C QD 6C 8C AS, and Q + A = 13 is a legal
pair. Click QD (310,385) at batch 61 and AS (535,385) at 72. Both cards leave
the row, the ace goes to the discard pile, and the score goes from $-168 to
$-156. The same command without the clicks keeps the row, and the deal frames
match byte for byte.

## Repaint counter

There is no animation loop, so there is no frame rate to quote.
- **Idle:** one `BeginPaint` (returns to `0x00410dd1`) per second, invalidated
  at `0x00403f35`; this is the Time display. That is 5 in 5.8 guest-s at the
  200 ms default and 6 in 5.9 guest-s at 100 ms, so the game's own 1 Hz timer.
- **A move:** adds 2 repaints and the card `BitBlt`s (returns to
  `0x004027eb`), 33 for the pair above.

Evidence: `scratch/runs/20261010T0650Z-pyramid-pair-removal`.
