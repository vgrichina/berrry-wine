# Worker menu Escape, 2026-11-13

Run: `scratch/runs/20261113-menu-escape-1225/`. Exact initial main:
`56327d542083fcf4e112fd354e4ba08fa92c2058`. Read the parent
`81a430d50` note, `native-dialog-input-1115-20261113.md`.

The inherited, untracked `test/test-renderer-worker-menu-escape.js` first
failed at its owner-instance assertion: 65537 versus 0. This expectation
predated `e7bd19742`, which moved popup tracking from instance globals into
process-shared memory. Both instances must observe the open HWND, and both
must observe dismissal. The refreshed fixture explicitly asserts that contract.

With only those state expectations corrected, the test still failed:
Escape left the menu open at 65537. `handleKeyDown` returned through the
Worker queue branch before reaching renderer menu handling. The guest message
pump has no call to `menu_handle_key_open`; merely queuing Escape cannot close
the renderer menu. The final regression also fails against the exact initial
renderer loaded from Git by `baseline-runner.cjs`, without modifying checkout
source. This is a production routing defect in addition to a stale fixture.

The Worker branch now routes an open menu's Escape to its WAT menu handler.
That handler's Escape branch only closes shared tracking, finishes a parked
TrackPopupMenu, and frees popup storage; it invokes no guest callback on the
shadow CPU. Common-modal Enter/Escape routing retains precedence. Other Worker
keys retain their queue path. A renderer press flag consumes menu Escape
repeats, characters and release until keyup, including repeats after the menu
has closed. Cooperative menu dismissal uses the same press lifetime.

The regression uses production `Win98Renderer` handlers and two real instances
of the shipping module over one shared memory. Unexpected host callbacks throw.
It checks shared identity/dismissal, repeated Escape, unrelated Left down/up,
release state, a press with no character, exact ordinary Escape down/char/up
payloads in both ownership modes, and explicit cross-instance `menu_close`
followed by an ordinary Worker Escape. It drives exported menu state directly;
it is not a browser or original-game execution witness.

The related modal-input mismatch is solely an outdated exact-object fixture:
`_dispatchMouseEvent` already stamps `cursorWarpSerial` for stale mouse-position
snapshot rejection. Both queued events now explicitly expect zero in this
unwarped fixture. All native-versus-WAT synchronous/queued routing and event
payload assertions remain intact; no production mouse code changed.

Validation: the two repaired tests, Worker modal key routing, common-modal
Worker handling, TrackPopupMenu return-command behavior, disabled-owner menu
posts, menu bars without a renderer mirror, shell dialogs, modal key posting,
and renderer button holds all pass. The required locked build passes. Logs,
exact base SHA, binary diff, owned new-file patches, negative-control loader
and hashes are retained in the run directory as small compressed evidence.

No original game, browser, box, guest state/config edit, forced presentation,
worker agent or Codex worker was launched. Disk was below the 1.5 GB floor;
only local focused fixtures and the required build ran. Box ID NONE, state
NOT_CREATED, expiry NULL, stop receipt N/A. Pawn and LMarbles gameplay remain
UNKNOWN. Next: retain these regressions; obtain an authentic gameplay witness
only after sustainable disk headroom is available.
