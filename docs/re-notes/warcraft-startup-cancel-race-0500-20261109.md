# Warcraft startup cancellation race, 0500

Fixed the production native composition offline. Closing rejects pending ordinary
CDP requests immediately; their awaited continuations and startup success
publications check terminal state again. Late version replies and connection
completion cannot resume startup. UNKNOWN retains the first reason, including
when a later cancellation follows the runtime cap. A close that interrupts an
ordinary request is abnormal even if the child subsequently exits cleanly.
Repeated close joins the same cleanup promise. Late quit, ordinary commands,
input and capture are refused; exact key-up/mouse-release and independent
Browser.close remain allowed. The CDP message handler is installed before
awaiting connection, so cleanup replies can be observed during that wait.

The commit includes the released native composition, startup observer, fixture,
tests and minimal `prepare.js --native`/provider-closure dependencies needed to
run them coherently. Other shared WIP remains uncommitted. Published custody
`4341b87723a7d56bc98223215cca4cdc878fcae2`, strict lineage, prepared module
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`,
case budget, work/ACK limits and 14/16/18-second close schedule are unchanged.
The original game was neither run nor rescheduled.

## Retained cause and actual waits

Evidence: `scratch/runs/20261109-warcraft-startup-cancel-race-0500/`.
`retained-analysis.json` records a fresh verification of all 171 WC0445 evidence
files, stored SHA-256/size and 114 gzip decoded hashes/CRC checks. The retained
trace requests Browser.getVersion at 04:51:03.163 UTC. Runtime-cap close starts
at 04:51:15.007; the request returns at 04:51:15.008 and the old fixture publishes
startup success. The old composition accepted the pending response during
closing and had no publication check after its await. This supports the stale
startup completion defect; it does not isolate slow startup/response/terminal
delivery or observer overhead, or show that a full 18-second close would pass.

Reopened actual creator witnesses: 5,304 scans and 196 ordered PID-matched
CONT-before/return pairs. Matched all 21 actual reaps to their before-reap
sequences in 610 custody events. WC0445 still has 74 owned identities, 53 missing
actual waits, one unresolved resume, command EOF=false and complete=false.
Known kernel fork lineage is complete, but that does not satisfy drain.
Later physical absence supplies no missing wait or Chrome pipe EOF.
Historical WC0410 creator lineage remains UNKNOWN.

## Offline regression and build

`old-fail-sealed` reconstructs the exact pre-fix startup module from its retained
small source patch and runs the actual native composition with the current
fixture. The real Node protocol child returns its version over stdout after
close starts. The old driver publishes `fixture-startup.json` and exits 0;
the regression fails its required exit-1 assertion. Driver actual wait and
separate stdout/stderr EOF are retained, as are browser terminal/pipe events.

`regressions-sealed` passes the same race, explicit cancellation, a version reply
delivered after completed cleanup, late connection, ordinary close interrupting
startup, and later cancellation preserving the runtime-cap reason. Each case
rejects later command/input/capture/quit and disguised release, allows actual
release and Browser.close, publishes no version/startup/ready success, and
retains UNKNOWN despite clean terminal/EOF. The fixture protocol uses real Node
children and separate pipes; its WebSocket boundary is an offline adapter.
This is not a Chrome cleanup acceptance result.

Also passed: ordinary valid startup/close, delayed endpoint, startup deadline,
early terminal, cancellation, missing endpoint, forced termination, five direct
terminal/separate-EOF/deadline controls including a descendant holding pipes,
38 renderer identity controls, existing contracts, staging omission/SHA/path/
symlink negatives, and the 626-provider production preflight. The locked build
`flock /tmp/wine-build.lock bash tools/build.sh` passes on the final code.
Independent GNU timeout supervisors are recorded before each offline command;
actual command waits and separate pipe EOF are stored. Initial fixture reply
ordering and test invocation/observation errors were corrected in this same
assignment; their earlier logs remain distinguishable from final checks.

Recovery uses the exact Git base and small binary diffs, including relevant
uncommitted preparation dependencies. Media/modules are referenced by existing
path and SHA only; no tree archive or duplicate media/module was made. No
agents, workers, browser, runtime box or deployment was used. This task's box
ID/expiry/stop receipt are null, state NOT_CREATED. WC0445's earlier box remains
archived under its existing stop receipt; this task did not touch it or peers.

Next: actual Chrome cleanup is unresolved and requires separate authorization
for any fresh runtime. No cap increase or original rescheduling is proposed.
Single task STOP.
