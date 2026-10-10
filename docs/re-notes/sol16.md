# Solitaire, 16-bit (`win98-16bit/SOL.EXE`)

`lib/apps.js` id **`sol16`**: the Win98 NE build, not the 32-bit NT debug
build in `solitaire.md`. It is Win16 GDI, so `--trace-api` shows nothing for
it (NE apps report 0 API calls); judge it by captures and host flushes.

## A tableau move, by A/B (2026-10-10)

With the default budget and 200 ms tick, the deal is up by batch 100:
6H 4D 5C 7C JC QD QH. To drag 6H onto 7C, use mousedown at (70,230) at 102,
four mousemoves to (310,245) at 105-111, and mouseup at 113. The deal frames
of the two runs match byte for byte, and only the run that drags shows 6H on
7C with an empty first column.

The "blank gray caption" reported on 2026-10-03 does not reproduce: the
title bar renders normally.

## The game timer drifted at coarse headless ticks (fixed in 6e4d29e8)

20 guest-s after the move, the status bar's Time read:
- **13** at `--tick-ms-per-batch=200`
- **18** at 100 ms
- **22** at 50 ms

22 is the right answer (the timer starts at the mouse-down, ~2.2 s before
the move ends). `$timer_check_due` restarted each `WM_TIMER`'s period from
its late delivery. Since 6e4d29e8 the period keeps its phase, as USER's does,
and the Time reads **22 at all three tick sizes**
(`test/test-wm-timer-phase.js` pins it). There is no frame rate: repaints
are one per pointer step while dragging (48 host flushes at 2-batch
spacing), and rare while idle.

Evidence: `scratch/runs/20261010T0655Z-sol16-move-timer`.
