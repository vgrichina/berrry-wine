# LTris: one paused Normal board, 2026-11-14

The requested line clear and native Quit remain **unproved**. One original
`ltris_128` process ran one human Normal board with native level 0 displayed.
A non-square T moved left and subsequently settled. Native Pause was reviewed
repeatedly, but the original UI masks the bowl while paused. The last board
review showed Pieces Placed 9, Lines 0, Score 0. Ordinary **host shutdown**, not
native Quit, ended the process normally after 581.522 seconds. No second board,
Training, gameover restart or second original was used.

Evidence: `scratch/runs/20261114-ltris-paused-normal/`. The predecessor
[recovered run](ltris-recovered-line-clear-20261114.md), its host-quit failure
and all 1,579 manifest artifacts were hash/size checked without alteration.
The [registration](../ltris-registration.md) and
[source notes](../ltris-original-source.md) remain unchanged.

## Preparation and controller changes

The four released helper/test files were adopted directly in the shared main
checkout. Their before-patches are preserved under `Gitpatches/`. Back-route
tests first reproduced four failures, then passed with a distinct
`select-back` Enter route requiring fresh, personally reviewed selected Back.
It is nonfinal; it cannot satisfy selected Quit or confirmation. Missing,
contradictory, wrong-route, expired, cutoff and UNKNOWN cases were tested.
Commit `3f7513f540e4f20ac4d5a4a94472054d36a4d115` published this closure before
the original. Fifteen policy tests, fourteen HTTP/terminal tests, nine actual
CLI transport tests and the locked full build passed before launch. Synthetic
Back reviews in fixtures are not original native Back evidence.

The run followed Barrage and GLTron's actual terminal waits, both EOFs and
heavy releases. It retained the registered `-w`/cwd, default batch size 1000,
real ticks, 1024×768 canvas, one fixed 1200-second deadline, independently
prearmed 1220-second watchdog and immutable final 180-second Quit reserve.
The full native scene was submitted and personally reviewed before the single
permanent input bind. Exact original 40-file/39-companion and authentic CRT
verification passed before and after play. Existing media outside runs was
used; nothing was downloaded or copied into evidence.

## Personally reviewed original pixels

`controls-click.png` shows Pause Key P. `player1-click.png` shows Left/Right,
Up for Rotate Left, PageDown for Rotate Right, Down, End for Drop and Delete
for Hold. No bindings changed. `setupfresh.png` shows Modern, Normal and
Starting Level 0. Level 0 was already present in the prior run; it is not a
new fix. The README was used for installation information only.

`resume1.png` → `leftT.png` shows the same T move from the middle to the left
edge with Pieces Placed still 1. `active2.png` shows that T settled at bottom
left with Pieces Placed 2. This establishes manually controlled non-square
placement. The attempted End drop and later Z rotation expired before delivery;
neither is claimed. The later Right gesture crossed a piece transition, so no
orange-L placement is inferred from its acknowledgement.

`p1.png`/`p1stable.png`, `p2stable.png` and `p8s.png` establish the actual
native Paused overlay and unchanged counters during individually chosen pauses.
`p2.png` and the separately resumed `r5.png` expose the same settled T/L layout
around the pause. Masked paused pixels alone cannot establish the underlying
cell layout. Resume and movement were separate, freshly reviewed gestures;
there was no pause/action macro, solver, autoplay or guest-clock freeze.

There is no disappearing full row, increased Lines/Score or settled post-clear
view. Nine stale intents were refused with no DOWN. Nineteen finite gestures
were consumed, with unique nonces, independent releases and actual release-child
waits/both EOFs. Maximum consumed scene age was 4.983 seconds for play and
14.195 seconds for menus; maximum release ACK hold was 0.451 seconds. No
UNKNOWN, replay, rebinding, configuration, piece, board, score or clock edits
occurred in the original.

## Quit failure and post-terminal repair

Quit became irreversible at 491.939 seconds, before the 1020-second play cutoff.
Escape opened **End Game? y/n** (`quitmenu.png`). The frozen policy lacked an
affirmative Y route for ending a still-active board. This is a second own-helper
omission: the repaired Enter-on-Back route was never reached. A separately
reviewed Escape dismissed the prompt to the paused board (`aftercancel.png`).
Further play stayed closed. No prompt was falsely labeled Quit, and the policy
was not changed or bypassed while the original was alive. Ordinary host shutdown
then returned 0; selected Back, selected Quit and full native Quit remain missing.

After actual terminal waits, three failing prompt regressions reproduced the
omission. The subsequent repair adds a fresh `end-game-prompt` Y route that is
nonfinal and mutually exclusive with Back/Quit proof. Final policy, HTTP/terminal,
actual CLI transport and locked-build results are retained in `post-*` logs.
The first positive-Y CLI fixture inherited a deliberate 2250ms Y stall and
correctly closed on timeout. Its positive observer was corrected before permanent
bind; the busy-server negative remains intact. Final results were 20 policy,
15 HTTP/terminal and 10 actual CLI tests passing, plus the locked full build.
These are controller regressions,
not evidence that the original End Game/Back/Quit sequence completed. No original
was relaunched to test the post-terminal repair. No public emulator fix is claimed.

## Identity and shutdown

Runtime source commit, all relevant dirty Git patches and 1,657 source/module
pins are retained. The executed standard module is 2,200,987 bytes, SHA-256
`c94ccf1b179f18bd4b47867445afed8cef2f1393b19aabfd259c7f3b94a7be09`.
Only the three owned controller/test files changed after terminal for the prompt
repair; runtime evidence retains their earlier identities.

Native PID 3900728, watchdog 3900727, supervisor 3900711 and outer 3900710
have actual exit-0 waits and both EOFs. The watchdog did not fire, the heavy lock
was released, all recorded runtime PIDs disappeared and port 8578 closed.
Free `/home` space remained above 12 GB. No box was created: ID none, state
`NOT_CREATED`, expiry none, stop receipt not applicable. No deployment occurred.
`result.json` names the retained selected PNGs; unselected captures were removed.
There is no frame series, source archive, module copy or media bundle.

This bounded task stops with missing line-clear/counter and native-Quit proof.
Any future original requires a new assignment, effective manual placement within
the unchanged precision window, and original-pixel review of the entire native
End Game → Back → Quit route. No full-27, browser, FPS or audio claim is made.
