# SuperTux native confirmation contract and platform landing, 2026-11-18

Manual native play reached and settled on the first raised block platform in
Welcome to Antarctica. Ordinary Quit remains unachieved: the next Escape was
refused before DOWN because the controller queried a compound aggregate nonce
that `guarded-status` does not retain. This task changes no production code.
Both new runtime scopes are permanently closed; host cancellation is not Quit.

Evidence is sealed in
`scratch/runs/20261118-supertux-native-poll-confirmation-contract-course/`.
`causal-findings.json`, individually compressed passive observations, public
input traces, original receipts and selected whole frames distinguish measured
facts from unresolved causes. Existing UNKNOWN scopes were never contacted.

## Native poll delay: narrowed, not repaired

The first fresh scope used the same coherent 253-source graph and module
`0d383140f6d4207d18860e3cb22fc8fcc47a5d260b8d5f2443222396b245fdd5`.
The original 789 media/settings pins passed preflight. The existing sealed
module was reused without compilation. Main/thread quantum remained
10000/1000 from the prior incomplete cadence scope; neither guest time nor
poll/state/consumption was forced.

Title Enter passed actual native USER consumption at about 400 ms. Slot Enter
then became UNKNOWN. Relative to public prepare, the handler entered at
17.705 ms and returned at 18.369 ms; delivery became pending at 18.590 ms.
Transport disconnection cancelled it UNKNOWN at 492.581 ms. There was no native
dequeue or USER-return receipt for that DOWN. Independent UP completed about
1197 ms after dispatch, within the unchanged 1750 ms bound.

During delivery-pending through cancellation, 124 observed main slices used
4.990 ms wall time and 4.854 ms process CPU. In 122 of them, both entry and exit
were yield reason 1 at EIP `0x5eef19`. Across the entire observed window,
330/334 slices had that wait state (16.866 ms wall, 10.125 ms process CPU).
No sampled event-loop gap exceeded 30 ms during the pending interval.

The original loaded SDL.dll base is `0x5ca000`; this instruction maps to
original `0x10024f19` in exported SDL_mutexP. Disassembly shows an infinite
WaitForSingleObject call immediately following it. Thus this new failure is
predominantly repeated admission of a waiting owner, rather than sustained
guest computation or guest sleep. A scheduler label saying runnable records
admission, not forward progress. CPU samples include Node work and are not
exclusive guest instruction accounting.

The second fresh scope additionally observed public mutex create/wait/release
calls without changing arguments/results. It did not reproduce the slot
failure: Start, slot and story Enter passed. Its bounded mutex log reached
16384 rows and dropped later records, so it does not establish continuous
mutex ownership at the later jump. In particular it cannot prove a bad mutex
owner, a missing wakeup, or the reason for the predecessor's 466 ms queue wait.
A legitimate slow consumer is not itself a bug.

## Response budget and ticket lifetime

The controller's HTTP confirmation limit is 500 ms. A ticket's immutable
deadline instead comes from targeting freshness, operation completion and the
release cap. Transport disconnection marks a pending ticket UNKNOWN. These are
distinct contracts, not proof that a late native consumer is defective.

The new failed slot's handler had already applied input about 18 ms after
prepare. It therefore cannot honestly be classified definitely unapplied.
Early cancellation could only establish no effect while still queued before
handler entry, using server-owned state. No caller no-effect flag, receipt
substitution, timeout increase, replay, or cancellation repair was introduced.
The published 09d56288b release reserve remains 1250+500 within 1750 ms.

## Manual landing and the exact next failure

Whole frames were personally inspected before finite manual gestures. Stale
overworld reviews were refused locally without DOWN. For the static map, one
new capture was required to match the exact PNG hash of the personally reviewed
whole frame before issuing the individually chosen Down or Enter. A mismatch
would refuse that gesture; there was no automatic retry or action selection.

After entering the course, Right for 550 ms and Right+Space for 600 ms both
received native USER-return receipts and independent UP acknowledgements.
`mutex/c2.png` shows the initial ground position, `c3.png` the approach,
`c4.png` the raised-platform position, and `landed.png` the settled landing.
The settled frame shows score 0, coins 0 and four lives. The camera scrolled
right; this is platform/course progress, not score gain or course completion.

The next manually chosen Escape failed in `lease()`, before arming or dispatch:
`unknown guarded nonce`. This is a concrete compound-status contract mismatch,
not ticket retention expiry. `compound()` reserves its aggregate nonce in a
Set, while only its `/0` and `/1` edge tickets enter the receipts Map.
`status()` consults that Map. The controller saves the aggregate nonce in
`last-intent.json`, then queries it on its next pulse. The preceding successful
native chord receipt proves both edge nonces consumed; the absence of
`pause-dispatch.json` and the terminal failure identify the refusal boundary.

This finding is not published as a repaired input contract. A future change
must validate subsequent lease/ordinary Quit after a successful nonempty
native chord, plus late consumer, partial effect, lost/late reply, refusal and
independent release controls, run the locked build, and exercise the affected
original in that same task. It must preserve every existing UNKNOWN closure.

## Lifecycle and recovery

Finite detached native-supervise wrappers, individual native/watchdog/holder
and parent waits with EOF are retained. Browser and display were not created.
Both native waits exited 0 after explicit host cancellation; neither is Quit.
The second outer tool invocation returned 143 despite nested parent/native
waits returning 0; that invoker limitation is retained rather than relabelled.
All 24 recorded owned PIDs were absent at the final read-only check.

The task initially encountered free disk below 1.5 GB and launched no runtime
until other owners restored capacity. Each runtime sampled the floor every
500 ms; this is not continuous global capacity proof. All test growth was
owned tmpfs. Selected whole PNGs and unique nonmedia evidence were retrieved,
fsynced and hash/roundtrip verified before owned tmpfs removal. Runtime Git
identities, binary dirty patches, source pins, owned new-file patches and the
module recovery recipe are retained; no source-tree or media bundle was copied.
No worker, Wine, remote box or deployment was used. Box ID/state/expiry/stop
receipt are null/NOT_CREATED/null/null.
