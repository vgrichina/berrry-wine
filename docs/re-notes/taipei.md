# Taipei (Microsoft Entertainment Pack)

App id `taipei` (`binaries/entertainment-pack/taipei.exe`), Win32 Mahjong
solitaire by Dave Norris (v2.00).

## Pair removal and paints on the CLI (2026-10-10)

At 20,000-block batches a click on the title (220,180) shows a fixed deal,
Game #17344. The two free West-wind tiles at (328,283) and (307,223) form a
pair; clicking both removes them. Game > Autoplay (menu at 47,50, item at
70,151) then removes pairs on its own. An `--input` replay is byte-identical.
Evidence: `scratch/runs/20261010T0745Z-taipei-control-paints`, which also
holds the `zoom.js` crop/upscale helper used to read the 16-pixel tiles.

Taipei repaints on demand: each removal invalidates both tiles
(`InvalidateRect` x2) and they coalesce into one `WM_PAINT` that redraws the
exposed tiles with ~21 `StretchBlt` calls. Over the pair plus Autoplay: 48
invalidations, 23 paints, 491 `StretchBlt`, no `BitBlt`. Count paints per
removal; there is no frame loop.
