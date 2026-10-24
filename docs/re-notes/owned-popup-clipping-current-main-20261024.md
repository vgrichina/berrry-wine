# Owned popup compositor clipping (2026-10-24)

Source-level implementation; independently accepted with focused test additions.
No guest/game, browser, native compiler, GPU or lifecycle qualification.

Baseline: actual strict-SSH remote main
`eb0c0a71c93c98bb2e394629e2c093bdcd4a9baf` (rechecked before publication).
The exact renderer blob is `ea371310c14bf39f070c3f23050dac9784700d45`,
SHA-256 `3b7b3efb1dc48b73de6d24d0c01e10650b0cc84b0b8cd80df2b49baa3680b2b2`.

`createWindow` classifies by WS_CHILD; `createDialog` stores a non-child
dialog's relationship in ownerHwnd and clears parentHwnd. `host-window.set_parent`
records parentHwnd even for a non-child popup but
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

## Independent review (2026-10-24)

Reviewed producer commit `ad114b9de8f36b94c0ab7b4406836a43599553a4`
against its exact remote-main parent above; strict trusted SSH verified both refs.
All 27 producer source/evidence seals match. Independently reran the unmodified
producer test: baseline 30 failures / 42 passes, candidate 72 passes, rejecting
owner-walk 13 failures, owned-traversal 3 failures, no-child-clip 18 failures.
The unchanged SetParent regression passes.

Verdict: PASS for this source-level repair. Inspection confirms `isChild` controls
child geometry and traversal; ownership alone does not. The regression loads the
real renderer, Surface and host methods. Synthetic exports provide absolute
window geometry; the canvas adapter delegates blits and clipping to RasterSurface.
Its no-op translate is used only by the separate dialog visitation assertion,
which proves traversal rather than chrome pixel placement. Surface tests bypass
drawWindow to isolate composition; the separate assertion calls real drawWindow.
Hidden/deleted owners are synthetic host records, not guest lifecycle tests.

The reviewer corrected the createDialog description above: it already separates
ownerHwnd from parentHwnd. The failing case is a non-child popup with a recorded
parentHwnd (exercised through real set_parent), not ordinary createDialog alone.
No production changes beyond the producer's two-file repair were needed.

Added 13 independent checks for GPU client-layer offsets and ancestor clipping
through single-source, stack and ordinary screen composition, plus empty child
clips and restoration before a later sibling. Expanded test: candidate 85 passes;
exact baseline 37 failures / 48 passes. Expanded rejecting controls: owner-walk
21 failures, owned-traversal 3, no-child-clip 23. Independent source mutations
removing GPU offset or only single-source child clipping fail 3 and 5 checks,
respectively. These controls preserve the production module and change only the
named behavior; they are retained outside the committed source.

Review evidence and recovery scripts are in
`/tmp/owned-popup-independent-integrate-oct24`: `test-receipts.jsonl`, individual
logs, producer-seal verification, exact baseline renderer, rejecting renderer
copies, `checks.py`, focused manifest, strict remote receipts, standing donor/tool
identities and resource history. Recover the test and repair from the published
review branch; rerun the test with the baseline/POPUP_MUTATION options above.
GPU-offset control inserts a zero return at _frameLayerOffset; the single-source
control replaces only that branch's clip lookup with null.

The private checkout uses explicit sparse paths and immutable object alternates.
An initial Git checkout failed because nested alternates exceeded Git's traversal
depth; listing the same standing chain explicitly, deepest first, fixed it without
copying or modifying donors. This was a fixture dependency correction, not a
resource denial. No full builds, packages, guest execution, browser/GPU runtime,
boxes or other workers were used. Initial broad board/status and a few display
slices exceeded the intended focused display size; retained tool captures remain
within the conservative 260000-byte charge and 1 MiB cap. All resource history is
retained; final integration/ref and cleanup receipts are published separately.
