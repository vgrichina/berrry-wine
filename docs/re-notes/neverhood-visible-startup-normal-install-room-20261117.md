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
values and three-second deadline remain unchanged. Review, bind, intent
receipt and independent physical release code is byte-identical to
`97670c226`; preparation verifies equality after removing only the new atomic
pending-presentation observation branch.

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

The first genuine installer used published wrapper `c1ec636f6`. It completed
passive startup readiness, produced a personally reviewed complete launcher
image and consumed Install with a genuine native-button-dispatch-return
receipt and independent physical UP. The subsequent public snapshot qualified
presentation, but the following capture saw a newly created hidden modal and
correctly refused `modal.visible`. UNKNOWN permanently closed the endpoint:
seven requests, one bind, one DOWN and one physical release; no later HTTP.
This is an actual snapshot-to-capture wrapper race, not a blank PNG inference.

The independent native watchdog subsequently observed disk-floor failure at
1,494,720,512 free bytes and delivered SIGTERM. Its deadline had not elapsed.
The operator's cancellation request came later and was not the shutdown cause.
Native, outer, persistent owner and all watchdogs have actual wait and both EOF
receipts, with no remaining scope. Exit zero is host cleanup, not native Quit.

The transition fix adds `native-presentation-capture`: it tests public USER and
ordinary actor readiness and invokes the existing capture synchronously when
ready. Pending readiness allocates no capture, input owner or PNG. There is no
await, pump or renderer operation between the readiness check and capture. The
existing capture validator, native timestamps and three-second deadline remain
unchanged. A refused capture is never retried. Python polls pending readiness
only inside its existing initial capture or aggregate intent deadline.

The focused authored native fixture reproduces the same modal.visible refusal
during real WM_INITDIALOG. The atomic path observes pending with no PNG until
the real dialog is presented, then produces a valid native capture. A real
MessageBox-to-delayed-DialogBox transition passes the full wrapper, genuine
BUTTON receipt, independent UP and final ordinary exit: the two finite intents
complete in 1,300 ms and 461 ms. Units, participant diagnostics and the locked
build pass. The first transition test used a MessageBox-only export to locate
the DialogBox button and correctly failed its test assertion; that authored
lookup was replaced by the public USER snapshot. Neither preparation fault
consumed an original invocation.

The conditional second ordinary installer is pending publication of this
faithfully tested transition fix. Installation, authentic installed launch,
room and visible object action remain unproved. No boxes or workers were added.
