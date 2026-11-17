# Neverhood separate native startup readiness

Evidence: `scratch/runs/20261117-neverhood-visible-startup-normal-install-room/`.

The wrapper now completes a passive `native-startup-readiness` preflight before
starting the initial capture clock. It uses the published ordinary USER owner,
actor, main/modal, generation and focus checks from `63d7b0d0e`. A listener or
native PID alone cannot qualify readiness. The preflight has its own bounded
30-second observation, also limited by the existing gameplay cutoff; it never
extends the native invocation or input deadlines. Failure permanently closes
UNKNOWN, including all later queries, captures and binds.

The first capture starts after readiness. Its native startedAt/completedAt
values and three-second deadline remain unchanged. Review, bind, intent,
receipt, independent physical release and observation code is byte-identical
to `97670c226`; the preparation verifies that exact component equality.

The focused sealed native run uses the retained core module SHA-256
`5a4178950559d4f677d86aa75403908abee343493805f01a0b8aae8f1df2429a`,
published main core `ef51a021`, explicit owned patches, and the two published
startup components. An authored x86 GetTickCount loop delays actual ShowWindow
by 3.8 seconds. Wrapper readiness lasts 3.471 seconds with zero capture, bind
or input before readiness; subsequent captures retain their original native
timestamps and bounds. Real BUTTON consumption, independent physical UP and
ordinary native exit pass. A never-visible window produces UNKNOWN with zero
capture/bind/input and zero later HTTP requests. Controller units, participant
diagnostics and the locked canonical build pass. Actual native and watchdog
waits with both pipe EOFs are retained.

The first generated test incorrectly used Sleep, which the uncapped CLI
intentionally charges to batch time. Its duration assertion correctly failed.
That preparation error is retained and was replaced with the ordinary real
GetTickCount loop; no runtime clock, original executable or media was edited.
No original allowance was consumed by either generated test.

Existing lifecycle, participant, actor and input proofs are reused by exact
component. The only native component differences are the passive command and
published diagnostic helper. Removing the startup addition reproduces the
published diagnostic helper exactly; removing the two-line runner command
reproduces the prior runner exactly. Full unchanged protocol suites were not
repeated. Fixture controllers retain two required Python pins and a hash of
the complete inventory instead of duplicating thousands of source records.

The fresh original installer remains pending publication of this wrapper.
Installation, authentic installed launch, room and visible object action have
not yet been established by this run. No boxes or additional workers exist.
