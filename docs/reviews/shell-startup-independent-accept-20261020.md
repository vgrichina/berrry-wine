# Independent startup acceptance review — rejected

Candidate `b09ba2e350bf8789210c8bf6ad2fa3299b15045b` is **REJECTED at source/slice level**.
Base: `8bcd437fa4852417b13d375e54e07280621a161a`.
Production predecessor: `ea6f896e8099fc8072009fbf0014b52fa06bbedd`.
The base differs from the predecessor only in the original review pair, not production.
No production change or main integration belongs to this review.

Two confirmed startup-state defects prevent acceptance. The ordinary submitted
matrix passes; neither failure below is a missing fixture dependency.

## 1. NULL HWND steals the first-show choice

`src/09a5-handlers-window.wat:$handle_ShowWindow` rejects a handle only when
`wnd_table_find` returns a negative slot. The complete implementation in
`src/09c0-window-table.wat:$wnd_table_find` deliberately gives HWND zero its
old **find an empty slot** meaning. Thus zero passes the new validity check.
The empty record has zero style and owner, so `startup_show_select` treats it
as eligible and consumes the process latch.

Compiled reproduction:

1. Publish startup SW_HIDE (0).
2. Call the complete `ShowWindow(0, SW_SHOWNORMAL)` handler.
3. It returns zero, leaves last-error at zero rather than 1400, and clears the latch.
4. Create a real unowned WS_VISIBLE application window and finish its callbacks.
   Its renderer surface is visible; SW_HIDE was lost.

The corresponding `0xDEAD` call rejects without consuming the latch. The
submitted invalid-HWND case covers only that nonzero form. The new independent
`NULL HWND consumes first-show latch` probe executes the real lookup, handler,
selection, creation and return continuations. Its `nullguard` counterfactual
rejects the defect-observation assertion: the latch remains armed instead.
This is a diagnostic mutation, not a committed production repair.

The empty-slot lookup predates this change; the startup-latch loss is new.
The contract requires a window handle, not an empty record.
[Microsoft ShowWindow reference](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-showwindow).

## 2. Failed creation consumes startup before any successful implicit show

`$handle_CreateWindowExA` calls `startup_show_select` near entry, before class
initialization, WM_NCCREATE and WM_CREATE. It also calls `host_show_window`
before those callbacks. `$create_window_abort` in `src/09b-dispatch.wat`
deletes the failed window and returns NULL but has no startup-state handling.

Two separate compiled reproductions publish SW_HIDE, request WS_VISIBLE, and:

- Return FALSE from WM_NCCREATE; or
- Accept WM_NCCREATE, then return -1 from WM_CREATE.

Both return NULL, remove the actual WND record, and leave the startup latch
cleared. A subsequent successful WS_VISIBLE creation appears normally. This
is observable startup loss, beyond a possible transient surface flash.
The original fixture supplies successful creation callbacks exclusively.

The failure probes compile the complete production creation handler,
`create_window_abort`, WND deletion and continuations. They record rather than
execute WM_NCDESTROY notification, timer/post cleanup and host teardown; those
boundaries do not read or write startup state. The second window's actual
renderer show state is checked. A diagnostic `rollback` mutation in abort
rejects the observation that the latch remains zero. It is **not** a proposed
fix: blindly restoring shared startup state would need a reentrancy analysis.

The inspected [Wine creation implementation](https://github.com/wine-mirror/wine/blob/master/dlls/win32u/window.c)
returns on either callback failure before its eventual `NtUserShowWindow`.
It applies startup selection at that show boundary. This supports the
ordering requirement; no native Windows differential experiment was run.
Selection must belong to the successful applicable show, with invocation
state surviving callbacks, rather than merely to attempted allocation.

## Other production paths and inherited limits

| Boundary | Finding |
| --- | --- |
| GetStartupInfo A/W | Complete handlers and initializer report retained commands; independent checks cover 7 commands × 2 encodings, output canaries, flags, cb and stdcall cleanup. Submitted matrix covers absence and all 11 permitted stored commands. |
| Browser / CLI | Actual browser PE-call expression, both complete CLI spawn callbacks, argv construction, child parser and pre-PE setter replay successfully. Full host `loadExe` inspection puts publication before both Worker `loadPe` and local `stageAndLoadPe`. Actual boot/fork/Worker transport remains unexecuted. |
| First show / later default | Full-handler tests cover all eligibility shapes, invalid nonzero handles, first-hide consumption and retained later SW_SHOWDEFAULT. NULL is the exception above. |
| Child / owned eligibility | In addition to record-setter probes, actual visible custom child, owned captioned popup and bare popup creation completes without stealing SW_HIDE. The next actual eligible creation is hidden. Real child return branches CACA002E/CACA0027 are included. |
| Ordinary callback path | Submitted 24-case matrix reproduces hidden, minimized, maximized, nonactivating and normal creation/first-show state, prior-visibility return, HWND return and pending Get/Peek size branches. Independent creation probes inspect actual state before WM_NCCREATE as well as after callback completion. |
| Dialog-marker branch of ShowWindow | Confirmed remaining source defect: hidden dialog + startup 2 + ShowWindow(1) sets iconic state but sends WM_ACTIVATE wParam=1, WM_SIZE SIZE_RESTORED with nonzero dimensions, and returns 1. Expected iconic activation bit, minimized size/zero dimensions and prior-visibility return are absent. Full handler executes against a recording `dialog_default_proc` boundary; actual DLGPROC is not executed. Exact base with explicit ShowWindow(2) reproduces the same output. These are inherited omissions, not claimed new regressions. |
| Nested creation | Actual hidden owned creation inside an outer WM_CREATE consumes the global `createwnd_implicit_show` and runs the outer window's activation chain before the outer callback completes. Both candidate and exact base reproduce it. Stack/HWND returns remain intact in this probe. This is an inherited invocation-ownership defect. |
| Target destruction | Actual WND removal during WM_ACTIVATEAPP is followed by another WM_ACTIVATE callback frame targeting the removed handle, with EIP=0 in this setup. Exact base reproduces it. This probe uses record removal, **not full DestroyWindow**. Source inspection of `handle_DestroyWindow`, `destroy_main_window_lifecycle` and `wnd_destroy_recursive` shows that real destruction also changes main/active/focus state; the probe cannot establish the exact full-API aftermath. It establishes the continuation's missing liveness validation only. |

The ordinary custom-wndproc minimized continuation was corrected, but its
dialog alternative was not. Neither that observation nor the destruction
adapter justifies claiming all callbacks are qualified. No unrelated feature
repair was attempted.

## Reproduction and controls

From this task repository:

```sh
node docs/reviews/shell-startup-independent-accept-20261020.js ../independent.json
REVIEW_REV=8bcd437fa4852417b13d375e54e07280621a161a \
  node docs/reviews/shell-startup-independent-accept-20261020.js ../baseline.json
REVIEW_MUTATION=nullguard \
  node docs/reviews/shell-startup-independent-accept-20261020.js ../mutation-nullguard.json
```

The first command succeeds when **19 independent observation groups reproduce**;
it does not mean the candidate is accepted. The exact baseline fails the
startup-info acceptance assertion. Use `REVIEW_PROBE='dialog-marker'`,
`'nested hidden'` or `'removed target'` with REVIEW_REV to replay each inherited
finding separately. All three reproduce on exact base production bodies,
without candidate WAT mixed in.

Seven independent mutations reject assertions: info, eligibility, latch,
activation, defer, rollback and nullguard. The first four break behavior
accepted by the independent oracles. The last three are diagnostic
counterfactuals that change the early-show/failed-creation/NULL observations.
Their effective source hashes are separate from original input hashes.
No compile error or missing dependency counts as a rejected control.

Also reproduced unchanged:

- Submitted complete-path fixture: 24 creation/first-show combinations.
- Submitted validation: 57 checks and 3 rejecting transport controls.
- All 8 submitted source mutation controls: assertion rejection.
- Original predecessor report: 10 gap checks and 10 rejected acceptance
  expectations; these are expected old failures, not candidate acceptance.

The new JS reuses the **sealed submitted slice assembler**, not its test
oracles. It replaces the source reader with exact Git-commit reads, adds child
continuations and independent probes, and records complete source hashes,
effective mutation hashes, module source/wasm hashes, compiled functions and
all import boundaries. Graphics/paint sinks, identity guest addressing,
seeded class records and the ret16 callback driver remain explicit. Inventory
reads all WAT fragments, but only the recorded dependency slices are compiled.
This is not an independent compiler and not full VM execution.

## Evidence and preservation

Evidence: `scratch/runs/20261020-shell-startup-independent-accept-oct20/`.
`independent.json`, `independent-controls.json`, `baseline*.json` and
`mutation-*.json` contain new observations. `fixture.json`, `validation.json`,
`submitted-controls.json`, `negative-*.json`, and `tests.json` contain replays.
`input-seals.json` maps replay inputs to exact committed blobs;
`setup.json`, `receipt.json`, `SHA256SUMS.json`, `remote.txt` and `change.patch`
record isolation, publication and recovery.

Exact sparse paths were installed before checkout in a new repository.
Its alternate points read-only into the supplied preserved repository;
the transitive object directory closure was flattened in this new repo only.
Git still warns while recursively reading older alternates, but every tested
input resolves and is hash-verified. No old repository was changed.

All writes use the conservative fixed threshold **2,285,895,680 bytes**
(the required reserves plus the entire 16 MiB cap), stronger than subtracting
remaining allocation. No cleanup/retry loop was used. Shared HEAD/index/config
and old WIP are preserved. Only this report/test pair is committed.
No runtime403 retry, Boat, full build, browser, game, public deployment,
Claude/laptop change, worker launch, queue refill or main integration occurred.
The coordinator retains integration ownership.
