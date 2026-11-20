# Hexen II owned DOM target, 2026-11-20

Run `20261120-hexen2-owned-dom-target-gameplay` proves trusted mouse delivery
to an intended localhost canvas using the new operator helper
`tools/hexen2-owned-dom-target.cjs`. It checks the browser PID/start identity,
exactly one visible window for that PID, its `_NET_WM_PID`, active window,
the exact page target, loopback URL, document incarnation, actual page focus,
current viewport, canvas rectangle and hit test. Child command failures throw.
Coordinates are current page CSS coordinates; unsupported visual zoom/offsets
are refused. Canvas coordinates are derived using its actual backing scale.
No class-name heuristic, synthetic DOM event or guest focus override is used.

The initial diagnostic delivered trusted CDP events at 250,250 and native
XTest events at 246,254. Estimating the browser content origin from outer/inner
dimensions was four pixels wrong; it is not the helper's coordinate route.
The separate helper fixture delivered trusted DOM DOWN and independent UP
at exactly 264,198 on the current canvas (backing point 160,120). The release
child was ready and unarmed before capture/input, sent only UP, and joined
with exit 0 and both pipe EOFs. Two finite native-supervise receipts report
exit 0, leaked false, and all tracked processes are nonlive. The selected
whole viewport was personally inspected. The old empty bubble-listener ledger
is not retrospectively repaired or explained by these observations.

Focused Node controls passed (42 native-consumption controls plus eight startup
tests after adding the target checks). The trusted fixture is separate actual
browser evidence; mocked/unit controls are not trusted-input evidence. Existing
capture/API/ownership tests and locked build 0 from `72dc77da0` are reused
unchanged and do not qualify this new helper.

The fresh original was prepared for exact graph
`34c794d549c4ad71dfe40c1647e4ffd0c7a4f8af` and retained candidate
`10bdae2c56c79eeb5d0b4ebbc602c8a233e36351380da274a70f7f5e25363564`.
Its independent monitor found only 1,498,386,432 free bytes and closed the
scope before the launcher or browser existed. No original module fetch, menu
input, living-enemy consequence or ordinary Quit occurred. No endpoint was
reopened or successor original launched. The prepared operator includes
navigation/unload/focus/exit-import observations, but these were never executed
and establish no new guest-exit cause. Prior Enter-to-ExitProcess0 remains
unknown. No guest, renderer, WAT or shared capture source was changed.

The targeting helper and focused test additions remain **uncommitted WIP**:
available disk fluctuated around the floor and a new locked build was not run.
The final extra unit-only ledger checks ran without a browser; there is no
whole-task continuous-floor claim. This note is committed separately. Strict
publication results and all actual joins are retained in the run. No remote
box was created: ID null, state NOT_CREATED, expiry null, stop receipt null.
