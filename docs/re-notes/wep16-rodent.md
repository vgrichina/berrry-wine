# Rodent's Revenge (Win16, Entertainment Pack 2, VB1)

Registry id `wep16_rodent`.

## Headless route (deterministic, 2026-10-10)

```
node test/run.js --app=wep16_rodent --batch-size=2000 --repaint-every=20 --input=200:mousedown:300:55,\
201:mouseup:300:55,500:mousedown:202:72,501:mouseup:202:72,520:mousedown:240:93,521:mouseup:240:93,\
1100:keydown:39,1105:keyup:39
```

- The clicks at batches 200, 500 and 520 start a new game.
- Holding RIGHT for 5 batches steps the grey mouse one cell right and pushes its whole row of blocks. One block
  ends up sticking out past the right edge of the field (strip 311,250 108x12 on screen); the mouse's old cell
  is left empty.
- Do not use `--real-ticks` for an A/B. Two wall-clock runs are not comparable, and the cats move by themselves,
  so a single before/after board diff proves nothing about input. `test-win16-vb-gameplay.js` runs a
  steered-vs-control A/B.

## Pace

- Timer-driven: about 15 SelectObject calls per guest second (batches 1000-1300), the same with or without input.
- `--trace-win16` gives the census.

Evidence: `scratch/runs/20261010-wep16_rodent-push-ab`.
