# Return Fire optional-404 cancellation, 2026-11-05

The collector now distinguishes an explicitly accepted absent classic script
from a transport abort, using the complete owning response chain. Required
bodies, raw Fetch errors, redirects, detachment and immutable first failure
retain their failure behavior. No original Return Fire/browser retry ran.

The published baseline is `fb7f45c7305bd8ba38188d39bb1a956db9895159`,
with its account in `return-fire-captured-body-gameplay-20261105.md`.
Evidence is in `scratch/runs/20261105-return-fire-optional404-cancellation/`.
Preparation stayed source-only until Strong0745 final release `2bad03fa365`
then D3Ddepth0815 final release `e708ba0f72`. Fresh independent verification
checked predecessor process identities, six normal Chrome exits, absent
profiles, sixteen refused ports, both free locks and the disk floor.

The actual original transcript shows the pinned HTML captured, verified and
continued unchanged. The optional `build-info.js` GET/404 was policy-accepted
and continued, then emitted Network response 404 and `net::ERR_ABORTED`,
`canceled=true`, before page close. The pinned HTML contains a parser-inserted
classic script for this resource. Historical resource types and detailed
response headers were not retained; they remain unknown in that transcript.

A generated loopback page in Chrome 151.0.7922.108 reproduces the same script
404 cancellation both without interception and after unchanged Fetch response
continuation. Its script error handler runs and execution reaches the following
inline script. Script 200 executes without that cancellation; ordinary fetch
404 returns its status/body without it. Explicit AbortController cancellation
still emits a real failure. A truncated script 404 additionally emits a Fetch
error for the same identity. Ten raw browser cases were retained before choosing
the remedy. They serve only generated fixture resources, with no repository
page, game, media or guest module execution. Both fixture browsers close normally.

This demonstrates the collector's mistaken equivalence between a browser
classic-script HTTP-status rejection and a failed required transfer. The actual
original sequence matches that reproduced boundary; it does not establish any
gameplay progress or grant another original attempt.

The remedy requires a synchronous policy acknowledgment tied by object identity
to the exact Fetch response identity. The composed driver returns it only after
its existing optional-absence policy has completed. The collector further
requires exactly one owning-session/network Fetch row, GET, Script, HTTP 404,
successful unchanged continuation, one matching Network request and response,
matching URLs and Script types throughout, no redirect or reused identity, and
the first terminal notification being canceled `net::ERR_ABORTED`. Blocked/CORS
errors and detached sessions cannot qualify. The notification is retained in
the raw log and classified as `optional-absence-script-rejection`; the absence
never becomes a verified body. No optional URL list exists in the collector.

Missing acknowledgment or metadata fails closed. Required 200 bodies still
must be captured and accepted. Non-canceled failures, other errors, incorrect
identity/method/type/status/URL/session, redirects, incomplete/rejected
continuation, early abort, duplicate Fetch errors and detachment remain faults.
Repeated Network response/terminal events cannot borrow an earlier absence.
The first fault remains frozen and agrees with persisted driver/terminal output.

The baseline collector's existing 27 cases passed. The new positive regression
failed with `net::ERR_ABORTED` before the repair; that normal exit-1 result is
retained. Replay of the real minimal-browser events changes only ordinary
accepted script404 from failure to success, preserving genuine-failure controls.
The repaired collector also passes the five-route real-browser fixture with
actual paused body capture, continuation and Network events.

The retained original composition is recovered in memory from the baseline Git
helper and the unchanged used driver, and matches its sealed composed SHA-256
`fda2e03fdff691ca1c867bb532ab41809bd278fcda3eefff2ec2ddf5220122b1`.
The test wrapper redirects synthetic output to this run and keeps the original
guard closed. Its original 22 cases and repaired 32 cases pass using synthetic
CDP and real FS/HTTP bytes, with public/native process-spawn guards and zero
Chrome. The new positive covers page, Worker and nested Worker identities;
nine added negatives stop before controls and preserve first-failure agreement.
These synthetic results do not demonstrate browser Worker/gameplay readiness.

Final collector tests pass 62 cases; the published composition and retained
actual composition each pass 32 cases. Two retained actual-entry positives also
pass with the exact default 2,000 ms collector timeout. The required
`flock /tmp/wine-build.lock bash tools/build.sh` passes. Literal replay of the
historical original transcript still fails closed and matches its sealed first
fault, because its resource types were not recorded. No historical artifact is
reclassified as complete.

Independent cleanup verifies normal exits, original process identities absent,
both loopback and DevTools ports refused for each fixture browser, profiles
removed only after normal close, no heavy runtime and both locks free. The sole
expected exit-1 is the pre-repair regression. Git SHA and relevant
binary diffs/new-file patches provide source recovery. Existing media/modules
are referenced by path and SHA, without copies, snapshots or archives. The
historical transcript and sealed first-failure evidence remain unchanged.

Any future original attempt requires fresh authorization and binding/preflight.
Gameplay, input readiness and audio remain unqualified by this offline repair.
No boxes were assigned: ID/state/expiry N/A; the coordinator owns shutdown.
