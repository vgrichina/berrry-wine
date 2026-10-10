# Cruel (Win16, Entertainment Pack 1)

Registry id `wep16_cruel`: `test/binaries/wep16/WEP1/CRUEL.EXE` with `CARDS.DLL`. This is the 16-bit NE build;
the 32-bit `entertainment-pack/cruel.exe` is a different binary with its own test
(`test-cruel-maximized-launch-layout.js`).

## Startup and layout

- `CreateWindow` makes the main window 480x321 at (20,20), then `ShowWindow(SW_MAXIMIZE)`. The Deal button
  (child 0x10002, id 4000) is created for the maximized size at (510,34).
- Maximized, there are four foundations (aces) on the top row and twelve tableau piles of four, in two rows of
  six.
- Fixed b5684b431: Win16 ShowWindow invalidated the client before `$defwndproc_do_nccalcsize` made it the
  maximized one. The update region stayed 472x275, and only five piles showed, cut at x=476.
  `test-win16-cruel-maximized-paint.js` guards this.

## Headless route

```
node test/run.js --app=wep16_cruel --stuck-after=0 --input=200:click:26:31,220:click:38:52,280:png:/tmp/deal.png
```

- Game > New at batches 200/220 gives a deal whose tops include 8C 7C ... 5S 6S. Two legal builds:
  7C -> 8C (drag 158,238 -> 60,240) and 5S -> 6S.
- The first deal (batch 200) has no legal move. Deal (cmd 4000) gathers the piles in order and redeals them in
  fours, so with no move made it reproduces the same layout. That is correct behaviour, not a dead button.
- Cards are drawn with `CARDS.cdtDraw` plus `GDI.34 BitBlt`; count them with `--trace-win16`. The game draws only
  on input.

Evidence: `scratch/runs/20261010-wep16_cruel-move-deal-ab`.

## Open

- The Game menu's accelerator column shows `??` and `?Re`, which looks like a mis-decoded Win16 menu tab or
  accelerator string.
