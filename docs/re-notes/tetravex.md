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

## The vacated slot (fixed 2026-10-10)

After a drop the supply slot used to keep the tile's old pixels. The parent's
update region already covered the area, but a moved child did not request an
erase, so the background under the vacated rect was never cleared. Moving or
resizing a visible child now invalidates its old rect in the parent with
erase (`$windowpos_expose_vacated`), unless SWP_NOREDRAW / MoveWindow
bRepaint FALSE. `test/test-child-move-exposes-vacated.js`. Evidence:
`scratch/runs/20261010T0740Z-tetravex-prop-atom-drag-w6` (before),
`scratch/runs/20261010T0800Z-tetravex-vacated-repaint-w6` (after).
