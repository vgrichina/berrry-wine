# Microsoft Hearts Network (Win16)

App id `mshearts16` (`MSHEARTS.EXE` with `CARDS.DLL`). Other Hearts work
(the virtual-LAN multiplayer route) is covered by `test/test-win16-hearts-*.js`
and `test/test-web-hearts-*.js`.

## Offline game on the CLI (2026-10-10)

At 20,000-block batches a frozen `--control` session plays a dealer game
against the three computer players: click the name edit (276,136), type a
name, choose "I want to be dealer" (68,237), OK (424,102); F2 at the "Waiting
for others" screen deals; click three cards (x 203/219/235, y 370) and "Pass
Left" (320,270); OK accepts the received cards; whoever holds the 2 of clubs
leads. Playing it completes trick 1 and the computers lead trick 2 back to the
player. An `--input` replay at the same batches is byte-identical. Evidence:
`scratch/runs/20261010T0730Z-mshearts16-control-paints`.

## Screen updates, not frames

Win16 calls are invisible to `--trace-api`; use `--trace-win16` or the
`B:set-win16-trace:1` input. Over one card play and the trick change: 7
`InvalidateRect` -> `UpdateWindow` -> `BeginPaint`/`EndPaint` cycles and 11
`GetDC`/`ReleaseDC` direct draws, with 672 `BitBlt` and 209 memory DCs for card
compositing and ~3.8k `SetPixel`/`GetPixel` for the rounded card corners. There
is no frame loop to measure.
