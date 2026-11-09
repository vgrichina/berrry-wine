# Q3 first-image investigation: blocked at pending fixture readiness

Evidence: `scratch/runs/20261109-q3-missing-fixture-image-cause-2325/`.
No causal production defect was demonstrated; production code is unchanged.
The retained evidence identifies the pending operation but cannot establish why
it remained pending. No box, native runtime, local Chrome or worker was launched.

Seven relevant retained artifacts were independently SHA/size-verified against
the settled inventory from `20261109-q3-observer-terminal-coupling-2305`.
`retained-analysis.json` records their original paths, retained hashes, request
entries and settlements. The await trace continues beyond the general startup
wire recorder's navigation stop and substantially narrows the earlier report:

- DevTools readiness consumed 17.900 seconds. Page-scoped auto-attach request 6
  consumed another 15.801 seconds. Neither is established as a code defect.
- Navigation request 10 resolved at **23:14:19.904 UTC**. Both recorded worker
  attachment tasks completed, including render instrumentation and
  `Runtime.runIfWaitingForDebugger`. Guest module source retrieval completed.
- Startup admission explicitly **released** the exact selected CPU and owner;
  release request 345 completed at **23:14:28.061 UTC**.
- Fixture readiness request 346 completed at **23:14:28.069 UTC**. The generated
  flow then waited 100 ms and issued request 347, implying that 346 returned
  boolean false. Its predicate was
  `!!(typeof runningApps!=='undefined'&&runningApps.find(a=>a.name==="dx_tunnel")?.wine?.guestWorker)`.
- Request **347**, the same predicate on page session
  `D348B5D8BEE7EA0B3A80E30BA403E893`, entered at **23:14:28.172 UTC** and its
  promise rejected on owner cancellation at **23:14:34.916 UTC**, after 6.744 s.
  This preceded its existing 20-second protocol cap. There were zero screenshot
  requests in the retained await trace. The consumer had not reached
  `local-controls.run`, its first capture, or the review service's capture hook.

The concrete missing evidence is the raw receipt/result/error for request 347
and the page plus owning guest/render worker execution state between
23:14:28.172 and observer cancellation at 23:14:34.893578. Generated fixture
progress/error state during that interval is also absent. The startup wire
recorder had stopped after navigation, so a missing promise completion cannot
distinguish browser execution blockage from transport or consumer delivery.
The final independent page console sample predates release. No retained
exception or worker-error artifact explains the stall. HTTP records show only
an unrelated favicon 404. Absent errors do not establish healthy execution.

`offline-stage.cjs` executes the exact generated fixture transition, evaluate
and event function bytes from the current authenticated composition, including
the deployed native input diagnostic and wire transforms. It uses the real
startup controller, readiness helper and input review service. Delayed worker
attachment plus delayed readiness reaches capture and holds the simulated
continuation until review; missing attachment refuses before release; a
controlled interruption at the second readiness evaluation reproduces release
followed by zero capture/input. CDP replies, capture provider and continuation
are controlled: this tests the generated state transition, not native execution
or physical admission. It does not prove that any injected condition happened
live. `native-stage/` retains hashes and per-control requests/results.

Focused checks pass: actual production CLI/staged closure/generated relative
caller with 27 refusal controls; the full sealed generated consumer's delayed,
large and missing screenshot replies with its real 20-second cap; seven review
and eight native wire revocation controls; six observer/review controls. The
locked `flock /tmp/wine-build.lock bash tools/build.sh` passes. The existing
full-consumer capture test substitutes launch/readiness, so its success alone
does not qualify the live startup path.

Stop at this evidence blocker. No guard widening, provider changes, screenshot
repair, gameplay qualification or successful native timing claim is justified.
Next requires the missing browser-side state or request-347 delivery evidence
under separate authorization; repeating the unchanged live timeout would not
supply a cause. Exact Git plus small input/note patches are retained; no source
tree or media archive was created. `/home` retains 5.7 GiB free. Box ID, state,
expiry and stop receipt: **N/A — none created or operated in this task**.
