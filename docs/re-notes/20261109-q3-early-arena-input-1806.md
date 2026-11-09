# Q3 early arena input: actual original caller scheduling repair

The production preparer now repairs the generated original interactive caller's
`select()` / buffered `readline()` scheduling mismatch. A single pipe write
containing two complete commands let Python read both into its text buffer,
but the next `select()` saw an empty kernel pipe. The second command remained
idle until another write or EOF. On EOF, the old caller could then dispatch
that buffered command before observing the closed writer.

`tools/q3-current-module.cjs` now composes an explicit byte buffer and `poll()`
into that exact authenticated caller. Complete pending lines require no new
writer wake. Partial lines, including split UTF-8, wait without dispatching.
HUP/error/EOF and the existing owning Session terminal check precede admission.
Historical callers remain unchanged. The native consumer, rendering, transport,
review and ownership checks, routing, auto-attach, debugger policy, 20-second
work/CDP bounds, 55-second minimum ACK, 30-second cleanup reserve and immutable
runtime/watchdog deadlines retain their existing behavior.

Evidence is in `scratch/runs/20261109-q3-early-arena-input-1806/`. The extended
`q3-local-interactive-controller.test.py`, passed the freshly prepared caller,
executes the entire original `launch` function, real owning Session, real local
controller and retained command branch. Only outer transport/native execution
are inert. The first read-only capture command succeeds. The authenticated
1748 caller then demonstrably strands the second complete line until writer
closure. The new caller reaches the second command without another write and
preserves its injected terminal failure, suppressing the third command. Separate
split UTF-8 and EOF-with-pending cases pass. Existing first-command failure,
actual parent waits and separate stdout/stderr EOF tests also pass. The initial
new test incorrectly expected the old caller to report EOF after writer closure;
its retained failure shows that closure instead wakes and dispatches its buffered
second command. The corrected test verifies both observations.

The seven generated arena command/screenshot cases, 27 foreign closure refusal
controls, both actual generated prelaunch/custody/staged consumer preflights and
generated owning-caller integration pass. Their independent offline watchdogs
were actually joined with separate stream EOF; none is a native box receipt.
`flock /tmp/wine-build.lock bash tools/build.sh` passes. The rebuilt primary and
compat modules remain `3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`
and `ecb45716b1ee7fc5218b1670dd270b19c7664ee30d000b3360a12786a1c21eaf`.

The prior native trace was independently SHA/size verified and analyzed without
copying it or its media. `prior-scheduling-analysis.json` records 17,322.692 ms
between world capture completion and the W request, then 31,223.125 ms between
the W capture and the fire request. These gaps include review, retrieval and
tool latency; they do not prove that the newly reproduced read-ahead defect
occurred in that native run. Its reviewed current Q3DM1 world screenshot remains
accepted; its death scene does not prove movement, and its fire was never queued.
No renderer/transport causal repair or new gameplay success is claimed here.

`early-actions.json` prepares sequential ordinary fire (300 ms) and W (500 ms),
each with zero extra passive settle. These are unsubmitted templates: review
fresh world pixels/HUD before firing, then review the successful fire capture,
alive HUD and ammo before admitting movement. Never submit both in advance of
their separate reviews. Reuse the already published current startup capture
for the first menu review, prepare retrieval before launch, and retrieve PNG
and capture metadata concurrently only after the corresponding successful ACK.
First failure or death ends this test without later input/capture/retry.
`check-budget.cjs` exercises the actual retained numbered transport at the exact
55-second ACK plus 30-second cleanup boundary: admission is possible exactly
85 seconds before browser stop; one millisecond later the real request refuses
before publishing an ID or command. No deadline extension is proposed.

This task completes the requested alternative of a concrete causal scheduling
repair tested on the actual path. It does not jump the queue behind Nox1750
and ReturnFire1758. No watchdog was armed and no native preflight, original,
Chrome, agent, worker or box was launched. Own box ID/state/UUID/expiry/stop
receipt are **NOT_CREATED / N/A**; no normal-stop operation is required. Native
movement and firing await a separately authorized runtime using the prepared
schedule and unchanged gates after both predecessors finish. Historical missing
ReturnFire joins stay failed and are not new launch prerequisites.

Recovery uses `gitbase.txt` plus `relevant-uncommitted.patch`, and the published
commit. Only small explicit run inputs, generated callers/runtime wrappers and
unique test evidence are retained; there is no source-tree or media archive.
