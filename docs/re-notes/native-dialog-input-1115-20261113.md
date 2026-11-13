# Native Save As proposed filename, 2026-11-13

Run: `scratch/runs/20261113-native-dialog-input-1115/` (fixture evidence,
not game progress). Investigation began at
`533bbba9527a81e89f1e954fdae6905dfd1fda66` on shared `main`.

The public `GetSaveFileNameA` handler reproduced an empty filename EDIT when
the caller supplied `history.pgn` in `OPENFILENAME.lpstrFile`. The extended
`test/test-open-dialog-buffer-too-small.js` failed with `'' !== 'history.pgn'`
before the production change. `create_open_dialog` always passed NULL text
when creating control 0x442; it never read the input filename. This finding
establishes a current common-dialog defect, not its historical introduction.

`src/09c3-controls2-open-save-dialog.wat` now scans the supplied filename
within `nMaxFile`, creates an independent ANSI control-text copy (converting
the W spelling), initializes the EDIT from it, and releases the temporary
copy after control creation. Opening and editing do not write the caller's
buffer. The existing acceptance path remains responsible for output.

The regression calls the public A/W Save As handlers and uses two real WAT
instances over shared memory, matching the common-modal ownership boundary.
For each spelling it checks the proposed name, replacement through native
EDIT selection/WM_CHAR, byte-for-byte preservation on Cancel, zero extended
error, modal completion, and Enter accepting `C:\history.pgn` on reopening.
Existing small-buffer failures and filename offsets remain covered.

Validation commands and outcomes:

- `node test/test-open-dialog-buffer-too-small.js`: before FAIL on the ANSI
  proposed-name assertion; after PASS, including both A/W cases.
- `node test/test-commdlg-extended-error.js`: PASS.
- `node test/test-open-dialog-filter.js`: PASS.
- `node test/test-modal-common-dialog-worker.js`: PASS.
- `node test/test-dialog-setfocus-tabstop.js`: PASS.
- `node test/test-dialog-key-posts-to-modal-pump.js`: PASS.
- `node test/test-worker-modal-key-route.js`: PASS.
- `node test/test-wat-edit-target-focus.js`: PASS.
- `flock /tmp/wine-build.lock bash tools/build.sh`: PASS, including all build
  gates and compiled data-segment overlap checks.

The broader initial probe also passed `test-renderer-shell-dialog.js` and
`test-menu-post-disabled-owner.js`. It found two separate failures:
`test-renderer-dialog-modal-input.js` expects an event without the current
`cursorWarpSerial: 0` field; `test-renderer-worker-menu-escape.js` fails its
menu-open state assertion (65537 versus 0). Neither test was modified and
neither failure is evidence of a Pawn save stall.

No Pawn game, browser runtime, or box was launched: available disk was below
the required floor. No claim is made about Pawn's second turn, committed d4,
history export, browser filename focus, or end-to-end Worker typing. The
fixture directly dispatches native control messages and does not prove DOM
keyboard delivery. Full-path initial-directory handling and default filename
extension behavior were outside this change.

Next: after sustainable disk headroom is available, use authentic Pawn
Save As interaction to establish game-specific behavior. Retain the existing
history/second-turn uncertainty until independently observed in that run.
