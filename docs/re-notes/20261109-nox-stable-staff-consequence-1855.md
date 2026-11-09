# Nox stable staff consequence preparation, 2026-11-09

Run `20261109-nox-stable-staff-consequence-1855` ended offline on a worker
command error. **No staff pickup, equipment, hit, defeat or onward consequence
was verified.** The worker invoked
`node --test test/browser-native-input.test.cjs`; that nonexistent path caused
exit 1 before tests. The existing test is `ops/browser-native-input.test.cjs`.
The first-failure rule was applied without retry. This is an invocation error,
not a reproduced production defect or evidence that the native controls fail.

The assigned 1750 and 1828 notes and repository instructions were read. The
three provider changes published in
`c6094c4edf87dcd7b80c4caa4225857bc3a5eb00` were reviewed against their source;
their working bytes matched that commit. `gl-compat.js` adds an armed opcode
12 path around context lookup, pending flush, frontend error read/clear and
backend error query. `gl-render-host.js` appends diagnostic stage names.
`gl-render-worker.js` installs the stage callback only when diagnostics are
armed and counts the appended error stages. This task did not enable those
diagnostics, modify providers or establish a cause for the earlier GL delay.

Before the command error, offline tests passed for the copied lifecycle
watchdog using a fake API, including actual supervisor wait and separate
stdout/stderr EOFs. Tests of the actual copied request and phase entrypoints
also passed: both terminal markers and the exact 1,500,000,000-byte disk floor
prevented remote dispatch. These are offline control checks only. The locked
build already running at failure finished successfully; its log is retained
in the run evidence. No code repair was attempted.

No current plan inspection or generation occurred. The historical consumer,
all original media were not edited or repinned; no fresh current-plan module
validation or generated-consumer validation is claimed. Native default
left pickup, I inventory, V swap and Network/Host/Conjurer/Bunker remain route
preparation from the supplied handoffs. Staff appearance alone remains
insufficient evidence of pickup. Capture the Flag availability is unverified.

ReturnFire1853 had reported its own offline terminal failure but had not yet
published its final release when this task failed. Runtime admission therefore
never opened. No predecessor API shutdown verification was performed in this
task. No real watchdog, UUID, leased box, native fixture, original guest,
browser, local Chrome or nested worker was started. Box ID/state/expiry/stop
receipt: **NOT_CREATED / NOT_CREATED / null / not applicable**. Actual runtime
watchdog wait and runtime EOFs are not applicable; the offline fake-API test
must not be substituted for them.

Evidence is retained under the assigned run directory: the invocation failure,
source-backed provider review, small relevant patches, exact Git SHA and test
logs. Git is the source archive; no source or media archive was created. Next
work requires a separately assigned fresh attempt with the correct existing
test path and the same unchanged runtime prerequisites and first-failure
guards. This task releases its files and stops with the objective incomplete.
