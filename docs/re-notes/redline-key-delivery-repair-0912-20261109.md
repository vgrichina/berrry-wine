# Redline bounded key delivery — offline diagnosis, 2026-11-09

The first-comma native failure from 0856 remains a concrete blocker. No safe
delivery-latency repair is justified by the retained evidence. The implemented
correction preserves the failed hold receipt and records send/response timing;
it does not claim to make that native run pass.

The actual path is `redline-native-fixture.cjs` → production
`redline-browser-run.cjs` → numbered transport → `execute` → identity admission
→ fixture baseline poll → the retained
`scratch/runs/20261108-redline-car-door-native/bound-input.cjs` hold. That helper
arms its independent 600 ms release before sending comma keydown through the
production pending-CDP map. It awaits the response before sampling. The timer
dispatches keyup independently. On a response after release it rejects with
`input delivery exceeded hold bound`, attaches `holdReceipt`, and joins release.
The transport records first failure; the caller closes admission and joins
independent cleanup. No later input, capture or retry is allowed.

0856 admission was recorded at 08:59:41.553Z, first transport failure at
08:59:42.547Z, and caller failure at 08:59:42.548Z. The stack identifies this
exact retained helper and production caller. There is no saved hold receipt,
sample, individual CDP dispatch/response timestamp or native held-read proof
for the failed command. Admission-to-failure elapsed time includes the
pre-hold fixture poll and cannot be assigned wholly to keydown service.
Custody evidence does not identify this CDP command's service latency. No
specific Chrome, ptrace, fsync or guest scheduling cause is established.

The new `redline-key-delivery.cjs` observer delegates to that exact helper with
the same options and send order. It records monotonic elapsed and wall times
for each dispatch and response, including errors, and saves the helper's
failure receipt in `input-ID-delivery.json`. It returns the original successful
receipt or throws the original exception. An evidence-write error cannot
replace the first input error. The production caller now invokes this observer
and requires it in the verified startup-provider closure. Future staging must
include this provider; an incomplete pin set fails closed. No timing constant,
timer origin, sampling condition, input type or CDP timeout changed.

The offline test executes the actual fixture controller and production caller,
real retained input/identity helpers, numbered file transport, real Node child
waits and separate stream EOF. CDP/page/Worker/PE execution is inert. Controls:

- The pre-change caller fails after a 750 ms delayed keydown response and loses
  its attached hold receipt. The corrected caller preserves it: old FAIL/new
  PASS applies to evidence recovery, not native key delivery.
- Normal comma/period holds, release-zero assertions, capture ACKs and ordinary
  quit pass through the actual production sequence.
- Applying keydown immediately but delaying its response 750 ms fails closed,
  with zero held samples and release dispatched at the original 600 ms timer.
- Delaying application itself 750 ms also fails closed. The inert service can
  apply down after up; the two controls leave different inert key states despite
  the same helper error. A late response alone cannot distinguish these cases.
- A stalled keydown still releases independently. The existing 20 s command
  work deadline wins before its later 20 s CDP timeout, closes pending sends,
  and joins cleanup. Work, ACK and cleanup caps are unchanged.
- Release failure rejects the command despite earlier samples. It produces no
  successful hold/capture ACK and cannot continue to period.

All negative controls prohibit post-terminal guest reads/input/captures and
retries, observe the actual inert child exit and both stream EOF events, and
join the independent controller watchdog. No fabricated native held read is
introduced. Restarting the timer after ACK, granting delivery grace, or treating
pre-ACK observations as held proof would weaken the required bound or evidence;
none is implemented. The historical failure therefore remains terminal.

Evidence is in `scratch/runs/20261109-redline-key-delivery-repair-0912/`.
Accepted unchanged proof references and exact retained helper bytes were
SHA/size checked and reused. Removing only the observation call and provider
requirement reconstructs the pre-change caller exactly. Startup admission,
fixture PE, module/instance/endpoint/slot checks, flags, freshness, native
REVOKED and all-writers/edict-ABA UNKNOWN semantics remain unchanged. Recovery
uses the recorded Git base and small binary patch; no source/media/module
archive was made. Gzip logs begin compressed at first byte. The initial
offline watcher compression error and initial stalled-control expectation
error are retained and excluded; neither ran a browser or guest.

Validation: `node tools/redline-key-delivery.test.cjs` and
`flock /tmp/wine-build.lock bash tools/build.sh`. No unchanged native run or
separate qualification task was performed. No Chrome, box, guest, worker,
agent, deployment, shared host/WAT/custody, Q3, Heroes II or Claude edits.
This task's box ID, UUID, expiry and stop receipt are null; state NOT_CREATED.
There is no allocation wait or physical-drain claim for this offline task.

Next, only under runtime authorization, collect the new bounded delivery
receipt through a fresh production fixture before considering original input.
Native key-delivery latency and gameplay consequence remain unverified.
SingleTaskSTOP.
