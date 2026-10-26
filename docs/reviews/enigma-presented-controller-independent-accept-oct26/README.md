# Independent controller acceptance: REJECT

Candidate `90a65119543037f17f5db17a2ef00880fc659c30` remains unchanged.
Controller SHA256 `b405130b6189e6a6c4115720c40464f45548be7613e11c48f0311c0c27d5bed5`.
The candidate's 24 supplied checks (20 negative, two positive) are reused,
not replayed. Independent execution produced 11 passing controls and two
unchanged defect reproducers. No production repair or main integration is made.

## Reproduced safety failures

1. **Lost witness silently passes cleanup.** Between readback and cleanup the
   fault injector deletes the controller's global Symbol state. The real runner
   executes the unchanged cleanup expression: absent `s` skips restoration and
   still returns `true`. The controller then queues exactly one click and reports
   success, leaving `renderer.repaint` wrapped. Expected: absent owned state must
   reject before queueing; cleanup success must prove restoration and ownership.
2. **Late batch drift queues input before rejection.** The fault injector advances
   `tickState.batch` immediately before cleanup. Cleanup checks neither the frozen
   transaction nor its batch. The real click handler queues the click at the new
   batch. Only its acknowledgement triggers `click queue acknowledgement invalid`.
   Expected: invalidated transaction must reject before enqueueing input.

These are explicitly injected state-loss/interleaving faults at the cleanup request
boundary, not evidence that a second client or unsolicited batch actually ran in
an exclusive frozen guest session. The controller documents exclusive access as a
caller obligation; it does not acquire an exclusive lease. Acceptance requires
rejecting the assigned cleanup/TOCTOU challenges, which these tests disprove.
For a rigorously guaranteed unchanged exclusive frozen runner, late batch drift
would be unreachable; this narrower assumption does not establish the broader
fault-rejection contract. Lost witness likewise needs a state-corruption or
interleaving cause; no spontaneous occurrence is claimed.

## Exact repair scope for the coordinator

Reject missing ownership state at cleanup rather than returning true. Validate
batch, frozen/no-credit/no-recording state and observer identity/count at the
final pre-enqueue boundary. Preserve original repaint restoration even on failure
when ownership can be established safely. Bind validation and one-time enqueue
atomically in a runner-owned operation or an enforceable exclusive transaction;
an additional remote snapshot alone leaves an inter-request race. Retain the
unchanged reproducers; do not adjust expected menu hashes or repair production
in this independent acceptance branch. A new assigned repair and independent
acceptance are required before runtime reuse.

## Independent protocol coverage and limits

`runner-slices.json` contains byte-exact complete parseInputEntries,
controlSafeValue/controlSnapshot, controlEval, controlPng, handleControlCommand,
and canonical presentForRead/canvasToPng/dxPresentHook from pinned runner SHA256
`4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`.
`source-checkpoint.json` gives byte counts, line origins and hashes.
The test executes these declarations inside a VM. Snapshot, parser, frozen
queue semantics and acknowledgements are real source slices. HTTP envelopes,
filesystem, canvas serialization, guest state and presentation implementation
are mocked. The mock serializer returns the retained inspected PNG; this does
not establish native canvas/codec equivalence. The changed-frame challenge
mutates stored PNG bytes and proves exact-hash rejection, not real pixel decode.
The candidate's previous changed-pixel test is reused with its stated limits.

Legitimate lazy/eager menus each repaint once, restore the observer, queue one
click at344,212 and reject one-shot replay. Live/credits/recording, missing hook,
wrong PNG path, changed PNG bytes, failed envelope, replaced wrapper and cleanup
transport failure reject before clicks. The two defect cases deliberately assert
the unchanged unsafe before result; command exit0 means reproduction confirmed,
not candidate acceptance. No guest or actual down/up input delivery executes.

Reproduce from this sparse task checkout, under the recorded supervisor:

```sh
/home/user/.nvm/versions/node/v24.18.1/bin/node --max-old-space-size=192 docs/reviews/enigma-presented-controller-independent-accept-oct26/independent.cjs
```

No runtime invocation is approved: repair first. Any future separately authorized
runner must preserve canonical presentation/readback, original inspected PNG
`8ffead1b04adbe5fac8d82c5a374375f5883898b29e87962d72c3c3e26da18d5`,
640x480 and the single-frame capture allowance. Queuing remains distinct from
input delivery, Start Game, level selection and gameplay acceptance.

## Resources, identity and publication

Flat immutable recovery copied only candidate commit, bounded trees and focused
blobs; no root ref listing was captured. The supplied streaming root-ref digest
was reused. Read-only donor warning receipts are in checkout.json and Git logs.
Trusted SSH identity/host configuration and empty canonical mount-parser argv
were checked in this task before checkout. No filenames/mounts/guest were used.
Standing installed Node24 and immutable donors were executed/read in place.
Node heap192MiB is not a process memory cap: startup records inherited DATA/AS
and CPU90s/file24MiB limits. Wall120s/output2MiB/excerpt8192B apply in supervisor.
Git DATA512MiB applies only to child Git. Four new clients reserve256MiB each,
three concurrent Node allowances320MiB each and768MiB floor were admitted without
subtracting already-accounted RSS twice. Client RSS and host measurements are in
admission receipts. Total task projection includes checkout/Git/copies, launcher,
session, positive shared WAL once, future growth and8MiB reserve under64MiB;
projected remaining host disk exceeds2,982,150,144B. No acquisition/build/runtime,
box/APIexec/SSH runtime/browser/services/deployment/Telegram/workers/main edits.
No test/operation denial occurred. Initial absent target directory was expected;
no acceptance loader/capture failure occurred. No full-ref recovery was needed.
Final publication changes only this focused evidence directory atop candidate;
controller, original tests/fixture and all other candidate tree entries unchanged.
Box ID/state/expiry: none/unassigned/not contacted/none; coordinator owns lifecycle.
