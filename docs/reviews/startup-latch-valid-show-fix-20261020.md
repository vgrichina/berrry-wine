# Startup latch: commit only at a valid show

Source/slice acceptance passes for the two assigned defects. Starting point:
review `3ba8e4a46ea18955c95ae7a9540e1e27e4bc421d`, containing candidate
`b09ba2e350bf8789210c8bf6ad2fa3299b15045b`. No main integration.
The historical independent review and its diagnostic assertions are unchanged.

`ShowWindow` now explicitly rejects NULL before selection, returning zero and
ERROR_INVALID_WINDOW_HANDLE (1400), just like an invalid nonzero HWND.
The window table's separate empty-slot lookup convention remains unchanged.

Creation no longer selects/consumes startup before WM_NCCREATE and WM_CREATE.
It retains the requested visible style and initially hides the renderer surface
when startup selection is pending. After WM_CREATE succeeds, the CREA
continuation passes the invocation's stack-saved HWND to `startup_create_show`.
That helper selects the current command, applies visibility/min/max state and
renderer state, and updates the main window's activation decision before the
existing continuation chain runs. The native return path calls the same helper.
Without published startup information the helper leaves existing behavior alone.

There is no provisional latch reservation and no abort rollback. A successful
nested ShowWindow can consume startup during either creation callback; failure
of the outer creation cannot undo that consumption. The saved HWND belongs to
the invocation, not the mutable createwnd_saved_hwnd global. The existing callback
order and ordinary activation/size continuation are retained.

## Tests

From this isolated repository:

```sh
node docs/reviews/shell-startup-complete-path-fix-20261020.js
node docs/reviews/shell-startup-finish-validation-20261020.js
node docs/reviews/startup-latch-valid-show-fix-20261020.js ../acceptance.json
REVIEW_REV=b09ba2e350bf8789210c8bf6ad2fa3299b15045b REVIEW_PROBE='failed CREATE' \
  node docs/reviews/startup-latch-valid-show-fix-20261020.js ../original-create.json
REVIEW_MUTATION=rollback REVIEW_PROBE='nested successful' \
  node docs/reviews/startup-latch-valid-show-fix-20261020.js ../mutation-rollback.json
```

- Complete submitted fixture: **24 cases pass**, including retained commands,
  hidden/visible creation, subsequent default, prior visibility, minimized and
  maximized messages, and pending Get/Peek size behavior.
- Submitted validation: **58 checks and 3 rejecting transport controls pass**.
- New fixture: **18 acceptance groups pass**, plus three separately identified
  inherited diagnostic observations. Acceptance covers NULL, invalid nonzero
  handles, child/owned/bare-popup eligibility, both failed creation callbacks,
  a successful retry receiving SW_HIDE, and nested successful ShowWindow followed
  by outer failure at each callback. The latter asserts that the nested window
  receives SW_HIDE, the failed HWND is removed, the latch stays consumed, and a
  subsequent visible creation receives normal show.
- Original candidate controls separately reject the NULL, failed WM_NCCREATE,
  and failed WM_CREATE acceptance assertions.
- Four effective mutations reject behavioral assertions: remove the NULL guard,
  consume early, restore the latch blindly on abort, or omit successful commit.
  Mutation source hashes are recorded separately from input source hashes.
- Six unchanged submitted source mutations reject assertions: explicit, info,
  continuation, renderer, iconic and retval. The historical creation and
  activation mutation targets no longer test the moved selection boundary;
  the new early/commit controls cover that boundary. No missing-target or
  compilation failure is counted as a rejected behavioral control.
- JS syntax, whitespace, fragment balance, logical-operand and silent-stub gates
  pass. No full build was run.

An intermediate submitted run caught a missing WS_VISIBLE clear for deferred
SW_HIDE; it was corrected before the final complete runs above.

## Seals and adapter limits

Final production SHA-256:

| Input | SHA-256 |
| --- | --- |
| src/09a5-handlers-window.wat | `11feb8f27c040256a3e42bfea987abbb3775eab2238718a895f479a7c95d77d5` |
| src/09b-dispatch.wat | `df689900332c057f75bcc974382997f603af6ae117df11edb3097b447eee0643` |

The final expanded acceptance slice is 61,254 bytes:
module source `9d0b8bfe7a53523cec00f882e505d66a4c641420dd6f81f2dabe78f277017903`,
wasm `61c3548d16940149f40141680154a304f05783818e1bf6ca0e55119d0af74e0b`.
`source-seals.json` and `acceptance.json` record every source input, the sealed
assembler, all 47 assembly attempts, included functions and import boundaries.
Inventory of all WAT is not execution of all WAT.

The new oracles reuse the submitted slice assembler and compiler, with identity
guest addressing, seeded class records, ret16 callback simulation, deterministic
scratch memory and graphics/paint sinks. Actual creation, ShowWindow, lookup,
selection, abort deletion and return branches execute as compiled WAT.
WM_NCDESTROY notification, timer/post cleanup and host teardown are recording
boundaries; they do not implement or repair startup state. There are no new
silent production stubs. This is not an independent compiler, x86 execution,
full VM, real PE, browser, Worker, game or concurrency qualification.

Inherited dialog-marker message/return defects, nested-creation activation
ownership, and continuation liveness after record removal still reproduce.
They are intentionally not repaired. Record removal is not full DestroyWindow.
Native WAT class failure semantics, CBT reentrancy and actual DLGPROC execution
are not newly qualified by these custom-wndproc fixtures. The native helper call
keeps the existing successful native return path connected to deferred selection;
it does not add native creation failure handling.

## Preservation

Evidence root:
`scratch/runs/20261020-startup-latch-valid-show-fix-oct20/`.
Acceptance, fixture, validation, original controls, effective mutations,
source/module seals, receipt and patches are retained there. `receipt.json`
records the final local commit, branch, capacity and protected-file checks.

The new exact sparse checkout was configured before materialization. Only its
alternates file was populated with the flattened read-only object closure.
The supplied repository and shared HEAD/index/config were not modified.
Writes use the fixed 2,285,895,680-byte available-space guard; checkout and
evidence remain below the 16 MiB cap.

Publication remains blocked by the established HTTPS credential / configured
SSH host-key failures. No auth/trust changes, rerouting or push retry occurred.
Local commit and patch are recovery evidence, **not a remote backup**.
No workers, queue refill, main merge/rebase, heavy runtime, runtime403 retry,
deployment, endpoint/host/wire changes or protected laptop work occurred.
