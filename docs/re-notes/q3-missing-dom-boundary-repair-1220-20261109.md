# Q3 missing DOM boundary: actual fixture ACK rejection repaired

Fixed a deterministic diagnostic execution defect confirmed in retained1200.
The generated positive-control `transport.request()` starts an ACK watcher,
then awaits `t.consume()` before awaiting that request. When DOWN fails, the
watcher can reject during consume's cleanup. Node treats it as unhandled and
terminates before the browser close/stream drain joins. Retained
`kernel-command.log.gz` contains the fatal `Error: runtime first fault` stack
through `commandAck` and `exports.request`, Node24.22.1. The generated parent
stdout alone concealed this stack; it was in the kernel command log.

`tools/q3-native-driver-composition.cjs` now immediately observes the ACK
promise rejection. The original promise still rejects at its existing await;
no failure becomes success. This follows the initial input failure and cannot
explain why DOWN247 first lacked a reply. Native input cause remains UNKNOWN.

Offline old/new controls execute the whole actual generated consumer, actual
CLI composition/diagnostic/wire/execution preloads, compiled fixture and
production renderer methods with inert external services. Omitting just the
new rejection observer reproduces abrupt Node exit and missing joined-close
receipt. With it, the identical serviced DOWN/independent UP and absent replies
retain the original DOWN failure, reject both pending requests, and complete
normal browser/child waits with separate stdout/stderr EOF. An independent
subreaper actually waits orphaned Node children in the old control.

The normal whole fixture still passes all nine refusal controls, physical
high/release-zero samples, positive capture/ACK0 and ordinary joined quit/ACK1.
Additional full compiled page controls cover untrusted/lifecycle refusal,
production callback throw, console sink failure and64-marker cap. The offline
page harness now retains every capture/bubble listener; its former single
listener map discarded capture observation. Production browser code is intact.
Existing diagnostic tests retain physical/queue parity and session/context
separation. Delivery, wire, caller-cancellation and dependency suites passed;
the locked build passed. No browser-startup regression suite was run.

Verified all58 retained artifact SHA/size/gzip CRC records. Reconstructed served
generated HTML is exactly16018 bytes, SHA256
`37372c58c06e5fbba652a9b1452b732bed88805d26205fba06954e6691e1594c`, matching
the actual HTTP response. Served production renderer SHA matches. The compiled
fixture does execute the diagnosed handler; no handler-source drift is shown.
Actual setup enables Runtime on the explicitly attached page session before
navigation. Installed marker and evaluation246 use session
`E76DF92B94E3AC97863A0252C1E83E34`, context1. Actual socket requests247/248
use that session. Native payload bytes were not retained; event construction
comes from the authenticated unchanged helper, not a claimed native packet.

The retained19-row console ends at11:36:24.411Z, just after DOWN entry; only
one of64 cause markers is present. No cap exhaustion or deterministic consumer
filter explains the absence. Inert socket controls run the same real handlers
and physical high/release-zero transitions, withhold replies in both cases,
and either deliver or withhold callback console packets. The latter reproduces
the installed-only record. Thus absence cannot distinguish missing DOM service
from console delivery censored by process termination. This establishes an
alternative mechanism, not the native cause.

Next causal experiment, only after separate authorization: run the repaired
whole fixture with the same existing preloads and Enter100ms bound. Keep the
first failure terminal, independent UP, request order and all caller/CDP/work/
ACK bounds. Observe the existing console stream through actual joined cleanup.
If callback markers arrive after failure, correlate page session/context and
page clocks to test prior console censoring; if absent, DOM service remains
UNKNOWN. No new instrumentation, longer hold, original game or retry now.

Evidence: `scratch/runs/20261109-q3-missing-dom-boundary-repair-1220/`, exact Git
base plus small relevant patch; no source archives, media or module copies.
No Box/browser/guest contact, agents/workers or deployment. Prior1200
`bx_tnpyaj2h`, UUID `1d6608dc-ea49-4d93-b1c3-09285ac41fe7`, retained
UNCONTACTED: ARCHIVED/PHYSICAL_DRAINED, `stop_00f9e6ff22026a3c`, initial expiry
12:00:27.150Z. New box ID/state/expiry/stop NOT_CREATED. Whole actual native
fixture NOT_PASS; actual Boatcancel NOT_PROVEN; native REVOKED;
allwriters/edictABA UNKNOWN. SingleTaskSTOP.

Test-output incident: initial delivery/wire commands used historical default
folders before EEXIST. Three sealed1045 metadata files were restored to exact
original hashes. Three unsealed post0950 metadata files lack original hashes
and remain explicitly excluded; original logs and1200 evidence are intact.
Fresh task-owned reruns passed. Details and restoration proof are in the run.
