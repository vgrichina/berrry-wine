# Redline production fixture repair — 2026-11-09

The tracked native fixture now launches `tools/redline-browser-run.cjs` instead
of owning a second Chrome/CDP stack or calling startup directly. Explicit
`REDLINE_NATIVE_FIXTURE=1` selects `native-fixture/` output and installs the
small ordinary PE through `tools/redline-production-fixture.cjs` after neutral
navigation and launcher readiness. The production runner still performs its
selected-CPU compile, parked preCPU/preDLLmain owning Worker/module/instance/
endpoint/slot authentication and one-shot release. Fixture providers must be
present in the verified runtime pin closure; incompatible alternate routes
are refused.

The controller uses the existing transport's numbered requests for comma,
period and ordinary quit. Synthetic capture reviews remain subject to the
same identity, freshness, input/release, capture, work and ACK checks. Fixture
sampling additionally checks high native keyboard reads during each hold,
increased counters, zero keys after release and unchanged endpoint. The
production runner owns capture and ACK completion; neither input nor startup
is dispatched by a separate fixture CDP connection.

Ordinary completion and failure now share the existing Redline joined
lifecycle helper. The terminal gate closes synchronously, ordinary protocol
producers stop, and browser close is sent independently of its CDP response.
Actual child exit, stdout EOF, stderr EOF, gzip completion and HTTP shutdown
are joined before cleanup completes. A missing close response cannot delay
the actual wait. Signal, stream and unexpected browser-exit failures close
admission. The controller prearms an observable independent process-group
deadline watchdog and joins both caller and watchdog plus their streams.
The shared `native-browser-close.cjs` and custody providers were not edited.

Offline controls execute the entire controller and production caller with
real Node children, real transport/ACK and bound-input/capture identity
helpers, and inert CDP/Worker/guest seams. The previous production caller
fails the same fixture control; the repaired caller passes ordinary quit
and absent-Browser.close-response controls. The wrong-live-module control
refuses before PE/DLL/CPU entry, joins retirement and cleanup, and permits
zero guest reads/input/captures after the first terminal marker. Explicit
post-terminal input/capture probes issue zero CDP calls. Both stream EOF
events and actual child waits are observed independently. Existing startup
negative controls and lifecycle failure controls remain covered; the latter
use the historical retired fixture body against the current lifecycle helper.

Validation: `node tools/redline-startup.test.cjs`,
`node tools/redline-fixture-shutdown.test.cjs`, and
`flock /tmp/wine-build.lock bash tools/build.sh`. Evidence, gzip logs,
Git base plus small binary patch, process joins and hashes are under
`scratch/runs/20261109-redline-production-fixture-repair-0832/`.
Selected CPU remains 2,185,596 bytes, SHA-256
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.
No source/media/module archive is retained; synthetic negative module bytes
are reproducible from the selected provider and the test's final-byte XOR.

These controls establish offline production composition, not native Chrome
qualification or gameplay progress. Native lifetime remains REVOKED;
all-writer coverage and edict ABA remain UNKNOWN. Next is a separately
authorized fresh native run with current pins and this production fixture
before original gameplay. This task created no Chrome, original guest,
leased box, agent, worker or deployment. Box ID, expiry and stop receipt are
null; state NOT_CREATED. No Heroes II, Claude, shared host/WAT/custody edits.
SingleTaskSTOP after publication.
