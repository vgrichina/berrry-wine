# Warcraft III fresh streamed objective assignment, 0615

Fresh assignment after the demonstrated upload transport repair in
`49525601dee074aa1f85e1cc1c2d4b2206fe5ef7`. Evidence belongs to
`scratch/runs/20261109-warcraft-streamed-objective-0615/`.
This is a new generation and does not reuse the archived WC0558 box.

Read CLAUDE/AGENTS, WC0545 cancellation/wait repair, WC0535 startup evidence,
WC0558 provisioning failure, WC0607 transport repair and its recovery patch.
Verified the retained patched actual0558 recipe SHA against its recovery record,
then made small fresh run inputs with the exact Q20600 release gate.
All provider staging uses the published bounded streaming helper, with exclusive
per-generation timed start/end/error evidence and no automatic retry or redirect.
Existing game media and CPU are referenced by path and SHA; no duplicate media,
source tree or module archive is made.

Fresh offline staging negatives and actual composed `DRIVER_PREFLIGHT=1` pass.
The 626 production providers match final0545 byte for byte; the fresh staged
closure has 629 providers. Reopened ten final0545 proof logs and 306 selected
indexed proof files, verified SHA-256 and size and gzip CRC, and verified the
tested sources and CPU before reusing the exact locked build and focused proofs.
Eight upload controls pass against this fresh recipe, including actual provision
composition, first-error cancellation, blocked writers, absolute timeout,
bounded exact streaming, source pin rejection and redirect rejection.

An offline check of the actual numbered transport found that the inherited local
request recipe's 50-second minimum ACK reservation rejects even zero-wait input
after 15 seconds of the 90-second case. The normal 20-second request minimum
passes with the same 20-second work, 2-second ACK and 30-second cleanup reserve.
The new local recipe uses that existing default; production providers and caps
are unchanged. `caller-budget-control.json` retains both actual outcomes. This
is not attribution of any historical gameplay or startup failure.

Production remains c4b4cd337 with custody
`5ec810c4d4704ff86afc367b38f7335edf1214e3450ebb98a62ce3df6386b5fe`
and CPU `a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.
Strict lineage, all flags, pre-CPU/pre-DLL-main barrier, immutable 90-second case,
work/ACK limits and 14/16/18-second close schedule remain unchanged. Historical
missing waits, creator identities and startup readiness timing remain UNKNOWN.
Untimed stderr cannot establish endpoint chronology. Q2/Super providers and
runtime artifacts are not edited. No agents, workers, local browser or deployment.

## Actual fresh attempt

The one fresh run failed before readiness, original launch or any gameplay PNG.
The timed first terminal reason is **immutable runtime cap**, at
**06:20:01.907 UTC**. The actual pending operation is page-session
`Target.setAutoAttach`, request 6, entered at 06:19:43.375 and interrupted after
18,532 ms. This is an immutable-cap cancellation, not a claimed 20-second CDP
timeout. No later gameplay command, input, capture or retry was issued; only
independent no-input cleanup, evidence recovery and delegated archive followed.

Provisioning passed: all 632 unique provider/metadata PUTs have timed start/end
pairs and no errors. Original `war3.mpq` streamed successfully. The unchanged
remote hash/size barrier exactly matched 629 providers, 161,569,143 bytes, before
Chrome. `provider-upload-events.jsonl`, `upload-events-verified.json` and
`identical-local-remote-barrier.json.gz` retain that evidence. No missing provider
or ambiguous upload was retried.

This assignment has actual timed endpoint evidence: startup observation began
at 06:18:56.090 with bound 06:19:56.090; the endpoint was accepted at
06:19:42.950, within that bound. Browser.getVersion returned Chrome
151.0.7922.108; browser-level discovery/auto-attach, target enumeration and
attachment completed before the page-session request stalled. Page enable,
renderer qualification, navigation, original launch and readiness were not
reached. The retained await trace identifies the blocked request and first cause;
it does not identify Chrome's internal reason for withholding that reply.
No production defect was isolated sufficiently to justify a production patch.
The historical missing waits and startup endpoint timing remain UNKNOWN.

## Drain, lifecycle and recovery

Observed exact Q20600 bx_jk86n7mq, UUID
c4984652-877f-47a7-b5b8-50469a9a2142, ARCHIVED PHYSICAL_DRAINED release
`stop_0369b7c1d554a80e` before creation. Independent observable watchdog was
armed at 06:18:01.156, before create, with immutable UUID
`0aa11959-720d-49e6-b1c8-21e673938153` and deadline 06:43:01.015.
Fresh box **bx_k3qt7q23** used TTL1491, initial archiveAfter
06:43:00.633; expiresAt was not returned.

Independent Browser.close received ACK at 06:20:01.908. Actual terminal,
ChildProcess close and separate Chrome pipe EOF were still absent after the
full 18,000.581 ms close schedule, including TERM at 14 seconds and KILL at
16 seconds. Browser receipt remains abnormal and undrained.

Kernel custody has 110 owned identities, 15 actual terminal waits in 739 events,
95 missing waits and commandEOF=false, complete=false. It records one unresolved
resume, zero unresolved lineage/ptrace rows and the immutable cleanup deadline
failure. Cancellation begins at sequence729, followed by two signal records
interleaved with actual clone-stop consumption and lineage records. This is
not the old unbroken 68-signal broadcast. The current missing 95 waits remain
UNKNOWN; the controlled c4b4cd337 repair proof does not supply them.

Independent census at 06:20:36.421 found all 110 recorded identities absent,
service port33419 and debug port35383 closed, no profile FD writers, and
inventoried remaining profile caches before removal. That establishes physical
drain, without replacing missing terminal waits or browser EOF. The actual
supervised case wait is 1 with separate parent pipe EOF. The outer suite returns
0 after preserving that failed result; it is not runtime success. Local caller,
watchdog and lifecycle waits are 0 with separate pipe EOF and runtime-lock release.

All **31 unique remote files, 432,122 stored bytes**, were retrieved and
independently verified for SHA-256, size, decoded gzip hashes and GNU gzip CRC
before delegated normal archive. Final box state is **archived**;
`stop_407013aed3cf9a58` completed 06:20:48.165, forced=false, error=null,
archiveAfter=null, final expiresAt not returned. Physical drain was posted at
06:21:08, followed by an append-only correction of a transcribed service port.
The box was never deleted or resumed.

`causal-diagnosis-v2.json.gz`, the original timed await/lifecycle and custody
logs, `retrieval-verified.json.gz` and `stop-complete.json` preserve the result.
Git base plus relevant dirty/new-input patches recover the source and recipe;
existing media/module paths are SHA-pinned. No source/media/module archive or
duplicate was created. Free `/home` stayed above 1.5 GB, the only resource gate.

Next: offline diagnosis of the retained page-session auto-attach handoff and
incomplete custody cleanup. No further runtime in this assignment. Single task
STOP.
