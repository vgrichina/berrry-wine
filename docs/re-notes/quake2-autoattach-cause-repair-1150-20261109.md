# Q2 auto-attach causal isolation, 1150

Delivered a tested extension of the existing Q2 observer, not a native causal
repair. Q21135 cannot identify which of the two actual `Target.setAutoAttach`
requests timed out. No new native attempt or box contact occurred. Native
REVOKED; all-writers/edict ABA UNKNOWN. SingleTaskSTOP.

Evidence: `scratch/runs/20261109-quake2-autoattach-cause-repair-1150/`.
Git base: `14381d50ee2832147b12bcfd72c33fdf097ae5b4`; recovery is that commit
plus `owned.patch`, including new test and this note. No archives, source/module
copies or media copies. Retained input identities are in `retained-facts.json`.

## Retained facts and exact production order

Q21135's `startup-readiness.jsonl.gz` reports DevTools ready after 24,717ms.
Its first transport failure is 11:19:07.020Z; the browser failure file follows
at .021Z with `CDP UNKNOWN Target.setAutoAttach; no replay`. The input observer
clock anchor is 11:18:19.373Z / Node 1540.790223ms; first terminal is Node
49187.620208ms. Socket error/close are later at Node 55971.003832 / 55971.091423ms.
Those later transport events cannot establish a transport failure before timeout.
No retained raw setup request/reply, session, browser task timing, keyboard hold,
READY, or original launch exists. Browser service/application times are UNKNOWN.

The retained 0105 consumer, current production composition, eager 1135 health
wrapper and outer observer generate this actual sequence, before keyboard input:

1. `Browser.getVersion`, browser scope.
2. `Target.setDiscoverTargets`, browser scope.
3. `Target.setAutoAttach`, browser scope, `autoAttach:true`,
   `waitForDebuggerOnStart:false`, `flatten:true`.
4. `Target.getTargets`; require exactly one page.
5. `Target.attachToTarget` for that page, `flatten:true`; assign returned
   `sessionId` to `pageSession`.
6. The same `Target.setAutoAttach` parameters on `pageSession`.
7. `Page.enable`, then `Runtime.enable`, on `pageSession`.
8. About-blank native keyboard preflight, then app selection and owning load.

Automatic attachment emits a distinct session in the test control; the consumer
only handles worker attachments and obtains its page session from explicit attach.
`send` assigns globally increasing IDs and optional top-level session IDs.
Incoming replies settle by ID alone, without validating session ID. Neither a
wrong-session reply nor browser task delay is established in retained native
facts. Changing session routing or attachment ordering would therefore be
speculative. Request timeout deletes its pending entry before `observeTerminal`;
the old empty pending snapshot is not evidence that no request was outstanding.
The reused Q3 recorder deliberately filters `Input.*`, explaining why the old
Q2 setup transcript is empty, despite zero observer drops/errors.

## Narrow diagnostic

Extend `tools/quake2-input-wire-observation.cjs` in place. The existing opt-in
preload and authenticated provider references remain the integration path; no
second recorder/preload, transport mutation, additional CDP call or startup wait.
The same `input-wire.jsonl` now includes a bounded `startup` window:

- Up to 32 setup request identities and 128 ordered events; drops/errors explicit.
- Socket send entry/return/throw with ID, session and setup parameters.
- Raw replies before consumer lookup/discard, including unmatched IDs, actual
  and expected session, pending presence, protocol error/result and late status.
- Target attachment/detachment and execution-context events during setup.
- Timeout request and pending list BEFORE deletion, elapsed monotonic time and
  overrun relative to the unchanged 20,000ms timer.
- Stage transitions, sticky first terminal, and socket error/close ordering.

Raw setup values are truncated at 4096 characters with byte length/truncation
metadata. Input payloads/expressions are not added. Node timer overrun reports
Node task scheduling delay only; it never proves browser service/application
latency. Diagnostic sink failures cannot settle/reject a request or block a send.
Late raw replies remain observations, never ACKs. Existing input recorder and
independent UP, lifetime/readiness/caps, health and first-HP-loss gates are intact.

## Verification and limitation

`tools/quake2-startup-cause.test.cjs` executes the actual health-composed production
startup/error/cleanup code using existing inert Node process/server/CDP seams.
It stops before input/app selection. Only the test timer seam accelerates the
20,000ms timer to 60ms; the production source and recorded budget are unchanged.
Full generated source and tested boundary-source SHA-256 identities are retained,
without source copies.

Nine old-missing/new-evidenced pairs pass: normal setup, root timeout, page timeout,
protocol refusal, synchronous send throw, socket error, late reply, delayed reply,
and wrong-session reply. Every pair preserves exact request order and failure;
all use normal process cleanup and separately ended stdout/stderr. Tests assert
both auto-attach scopes/flags, context ordering, pending before deletion, raw
late/wrong-session reply, no input/READY/navigation, and actual Browser.close
request without a fabricated close ACK. Additional sink failure, bounded storage,
truncation, unmatched reply and deterministic 25ms Node timer overrun controls pass.
This is oldFAIL/newPASS for missing diagnostic evidence, not for native causality.

Existing observer's 3 provider preflights, 8 paired generated keyboard startup
controls and sink failure pass, preserving independent UP and sticky failures.
Actual composition/transport/input/quit regression, passive damage reader tests,
and `flock /tmp/wine-build.lock bash tools/build.sh` pass. Failed test-development
runs are retained and excluded from passing claims.

Constraint violation: I mistakenly invoked
`tools/quake2-browser-startup-failure.test.cjs` as an assumed inert regression.
It launched local Chrome and browser Workers (no guest instructions/original).
This violated OFFLINE/no-browser and is excluded from offline validation claims.
`startup-regression.log` retains its prearmed watchdog and normal exit0 cleanup;
`accidental-local-browser-cleanup.json` independently confirms Chrome PID 1653127,
watchdog PID 1653076 and its temporary profile absent. No box was created, queried,
resumed or contacted. No further browser test was run.

Next: review/use the new startup evidence only in a separately authorized fresh
whole fixture; no unchanged native retry is authorized by this diagnostic.
Prior Q21135 box `bx_py2e33kc`, UUID `441ad5bf-1891-4ddd-97b4-074bb54bfb50`,
remains retained UNCONTACTED: recorded ARCHIVED/PHYSICAL_DRAINED, normal stop
`stop_c13a36e5850d38ad`, initial expiry 11:41:40.730Z, completed 11:19:45.275Z.
No new box/state/expiry/stop receipt exists for this task.
