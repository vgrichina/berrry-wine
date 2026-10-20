# Jedi Select Components: overlapping dialog input

The ordinary mouse failure is a renderer hit-order defect, not a misplaced
replay click. The fix ranks distinct top-level window trees by their painted
stacking order before applying the existing embedded-dialog preference.
It changes only `lib/renderer-input.js`; no installer or app-specific behavior
is added. Original installation and game launch remain unverified.

## Evidence and cause

Reviewed run `20261020-jedi-original-accept-launch`, report commit
`c0de2a2040954dc1ff58668f19e7b619fe442855`, actual installer log, click receipt,
stop snapshot, and before/after PNGs. License Yes acceptance was observed.
The original installed payload was absent; only `deisl1.isu` was present.

The snapshot records:

| Window | Coordinates | Size | Relationship |
| --- | --- | --- | --- |
| Setup `0x10001` | 0,0 | 640×480 | top-level |
| Progress `0x1000f` | 155,304 | 323×139 | child of Setup |
| Components `0x1006b` | 80,59 | 480×362 | owned popup, not child |

Progress coordinates are **parent-client relative**, not screen coordinates.
With Setup's client origin (3,23), its screen rectangle begins (158,327),
and its own client begins (161,350). The log's mouse lParam `0x002d00fe`
is precisely `(415−161,395−350) = (254,45)`. Components' client begins
(83,82). The logged Next control `0x10077`, ID 1, has client rectangle
(295,301,75,23): its screen rectangle is (378,383,75,23). Click (415,395)
is inside it, at button-local (37,12). No coordinate correction is needed.

Before the fix `handleMouseDown` sorted same-instance overlapping dialogs by
area. Progress has area 44,897, Components 173,760. The smaller hidden-behind
surface won despite Components being visibly on top. The actual-source
regression chooses `0x1000f` on baseline, matching the run. Subsequent
activation of that surface explains the caption change visible after the
click. The captured WM_CHAR 13 went to focus `0x10001`; it was not an Enter
keydown/keyup sequence. This task does not establish an independent keyboard
or modal-manager defect, and changes neither.

The fix uses existing `_findTopWindow` / production `wnd_top_level` and
`_compareTopLevelZ`. `wnd_top_level` follows WS_CHILD parentage only, so the
owned Components popup remains its own top-level surface. Within the same
surface, embedded wizard-page behavior is preserved. Existing desktop and
cross-process ordering remain in place.

## Bounded regression

Run from the checkout:

```sh
node test/test-jedi-components-input.js
node test/test-renderer-dialog-modal-input.js
node test/test-renderer-dialog-button-queue.js
```

All pass. The dedicated test calls actual `handleMouseDown`/`handleMouseUp`
at (415,395). It compiles unchanged production `wnd_top_level`,
`dialog_route_mouse_screen`, `dialog_route_mouse`, and `ctrl_style_disabled`
with the canonical WATX compiler. The 1,119-byte module SHA-256 is
`f24f3533441957d52c465350428aa0654d47e8d1e35525d1a4809c4c802c1ddc`.
The router delivers DOWN and UP to `0x10077` with correct child coordinates.
Window metadata, chrome layout, repaint/activation side effects and the final
wndproc delivery boundary are explicit adapters. No button activation,
BN_CLICKED processing, guest continuation, full VM or browser is claimed.
No WM_COMMAND is injected.

Controls cover hidden progress, larger progress, an embedded wizard page,
and a different popup genuinely above Components. All pass. These commands
must fail at the first real DOWN target assertion (`0x1000f` vs `0x1006b`):

```sh
node test/test-jedi-components-input.js --baseline
node test/test-jedi-components-input.js --mutate-owner-as-parent
node test/test-jedi-components-input.js --mutate-reverse-z
```

All three fail as intended, not at compilation or fixture setup. The first
loads the pre-fix production renderer, the second wrongly climbs popup
ownership in the compiled ancestry function, and the third reverses surface
stacking order. The test is automatically in the default unit tier.

## Preservation and limits

Evidence: `scratch/runs/20261020-jedi-components-input-fix/`, including actual
input/log/snapshot and PNG copies, source identities, test logs, preflight,
checks and publication receipt. Production routing/compiler inputs are
identical between actual tested source `14792a36` and reconciled main
`aaf8599291b278b5cf1b9e53c654b5bb8cd5dfe6`. Fresh main
`71a60db4004e5df74cfa232f7a59edc109ffc660` adds only the independent MadBomber
registry/report/test changes; no routing overlap.

Work used an isolated exact sparse task checkout. An initial setup error ran
read-tree before installing sparse patterns and briefly materialized 244 MiB,
exceeding the 12 MiB task cap. It was immediately pruned to the exact admitted
paths; the disk floor plus reserves was never breached. Git also automatically
added this task's upstream stanza; only that stanza was removed, restoring the
shared config's exact original hash. Shared HEAD/index were unchanged.
These deviations are recorded rather than represented as a clean preflight.

No runtime, browser, heavy build, main merge, workers, registry edits, synthetic
payloads or installer bypass occurred. A later coordinator-assigned ordinary
installer replay must establish advancement and investigate missing payloads.
This source fix is not an installed-game or playable claim.
