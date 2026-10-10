# Tetravex (wep32-community)

Visual Basic app: `binaries/wep32-community/Tetravex/Tetravex.exe`, registered
as `tetravex`. Each tile is its own 60x60 child window sitting on titled slot
frames (`D1-1`..`D3-3` grid, `S1-1`..`S3-3` supply); drawing is `StretchBlt`.

## Route (headless)

New Game at (193,155) on the 640x480 screen. Drag a supply tile with
`mousedown`, a dozen `mousemove`s a couple of batches apart, `mouseup`, at
`--tick-ms-per-batch=5`: e.g. (366,198) -> (155,198) moves the top-left supply
tile into the top-left grid cell.

## Window properties are keyed by atom (fixed 2026-10-10)

The VB runtime subclasses a tile for the drag: `SetPropA(tile, "<name>")`,
`SetWindowLongA(GWL_WNDPROC)`, and on every message `GetPropA(tile, 0xC000)`,
the global atom of that name. Properties used to be keyed by a hash of the
string, so the atom lookup missed, VB subclassed the tile over itself, and
messages fell through to `DefWindowProc`: the tile moved one step and the drag
died. USER keys properties by atom (SetProp adds the string as a global atom);
so do we now. `test/test-window-prop-atom.js`.

## Open: the vacated slot is not repainted

After a drop the tile window is at its new position (window list), but the
supply slot it left keeps its old pixels: moving a child window does not
invalidate the uncovered area of the parent and underlying siblings. A
2026-10-03 repair of this never reached git. Evidence for both:
`scratch/runs/20261010T0740Z-tetravex-prop-atom-drag-w6`.
