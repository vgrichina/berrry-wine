# Owned popup compositor clipping (2026-10-24)

Source-level implementation only; pending independent review/integration.
No guest/game, browser, native compiler, GPU or lifecycle qualification.

Baseline: actual strict-SSH remote main
`eb0c0a71c93c98bb2e394629e2c093bdcd4a9baf` (rechecked before publication).
The exact renderer blob is `ea371310c14bf39f070c3f23050dac9784700d45`,
SHA-256 `3b7b3efb1dc48b73de6d24d0c01e10650b0cc84b0b8cd80df2b49baa3680b2b2`.

`createWindow` classifies by WS_CHILD; `createDialog` records parentHwnd even
for a non-child dialog. `host-window.set_parent` also records parentHwnd but
only classifies a window as a child when WS_CHILD and an extant parent agree.
Actual owner lookup is separately available through `_windowOwnerHwnd` (WAT
`wnd_get_owner`); the recorded parentHwnd link alone is not child geometry.
The existing SetParent regression confirms the role distinction. This repair
does not change that classification or guest parent/owner semantics. It corrects
the misleading comment that previously promised popup parent clipping.

On baseline, `_topLevelWindowFor` follows a popup's parentHwnd past the popup.
Its real children consequently inherit the owner's bounds. Child surface,
shared-overlay, postprocessing and canonical readback traversals also enter
non-child popup branches although the popup already has a top-level z slot.
`drawWindow` can recursively translate a non-child dialog as child chrome.

The repair stops the clip-root walk at the first non-child window, requires
isChild on those child-only traversals, and applies the existing ancestor clip
to own-surface children in the single-source postprocessing branch (the stack
branch already did so). Popup positions remain screen coordinates. Real children
retain intersection with every ancestor client area. No unsupported-operation
behavior or fail-fast handler changed.

## Regression evidence

Run `node --max-old-space-size=256 test/test-owned-popup-clipping-current-main.js`.
The test loads the authentic renderer module, Surface raster operations and
createWindowHost methods. Synthetic 96x72 windows/canvases provide deterministic
pixels and absolute geometry exports; guest non-client painting is stubbed only
in the surface tests and exercised separately through real drawWindow.

Final candidate: **72 checks pass**. Coverage includes a popup partly beyond its
owner, real child and nested child ancestor clipping, client-versus-frame bounds,
empty/hidden branches, hidden/deleted owner records with stale popup links,
ownerHwnd-only links, unrelated top-level windows, screen hit targets, shared
child overlay selection, single/stack postprocessing, dialog recursion and
canonical screen pixels/one-copy-per-z-slot. Owner deletion is synthetic state,
not an assertion about guest DestroyWindow behavior.

Same final test with `POPUP_RENDERER_SOURCE=/path/to/exact-baseline-renderer.js`:
**30 failures, 42 passes**, exit 1. The test never substitutes hand-reimplemented
renderer methods for the baseline.

Discriminating controls against the candidate, each exits 1:

- `POPUP_MUTATION=owner-walk`: restore old root walk; 13 fail / 59 pass.
- `POPUP_MUTATION=owned-traversal`: restore old child compositor traversal;
  3 fail / 69 pass.
- `POPUP_MUTATION=no-child-clip`: remove clip calculation; 18 fail / 54 pass.

`test/test-set-parent-keeps-popup-toplevel.js` passes unchanged. `git diff --check`
passes. Existing WAT-backed tests were not run: native compilation and guest
execution are outside this allocation. The new test defaults to the repository's
unit tier by filename; no central registration edit is needed.

## Recovery and resource evidence

Ignored evidence is retained at `/tmp/owned-popup-clipping-current-main-oct24`:
`test-receipts.json`, baseline/candidate/control logs, `evidence-hashes.json`,
`focused-manifest.json`, `standing-object-stores.json`, `resource-initial.json`,
append-only `resource-history.jsonl`, `resource-check.py`, `run-checks.py`, and
final publication/cleanup/capture receipts. The prior stopped task allocation
was not reused or modified. Recover source from the published task branch;
recover baseline with `git show eb0c0a71:lib/renderer.js > baseline-renderer.js`.
The six checks and their exact environment/exit codes are in test-receipts.json;
`python3 run-checks.py` repeats them from the retained private allocation.

All Node checks use 256 MiB old-space, 60s wall and CPU limits, and admission
requires MemAvailable >=805306368. No packages, binaries, full builds or boxes.
The private sparse Git repository uses a read-only object alternate, explicitly
inventoried standing stores and installed tools; nothing was cloned/materialized
from the complete donor. Only the two implementation files, unique test and this
note are published. Root tracked files/index/refs and donor stores are untouched.

Initial combined instruction output exceeded the intended display slice; retained
and conservatively charged 150000 bytes. The first baseline assertion formatted
large canvas objects, producing a retained 379210-byte log; its display also
exceeded the intended slice. Later diagnostics truncate assertion text and compare
scalar root handles. All subsequent code/log captures are bounded below 8 KiB.
These are disclosed capture exceptions; the conservative aggregate charge remains
750000/1048576, without resetting history or weakening actual resource controls.
The ledger includes all task files, conservative full initial SQLite bytes plus
sampled positive growth, external session/launcher allowance, future growth and
8 MiB reserve. See the final receipt for measured totals. No main integration
authority was exercised. No box assigned; shutdown remains coordinator-owned.
