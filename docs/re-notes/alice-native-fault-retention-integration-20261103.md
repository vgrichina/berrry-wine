# Alice native fault retention integration, 2026-11-03

The retained eight-file native fault retention and input cleanup candidate is
integrated byte-for-byte from
`scratch/runs/20261103-alice-cooperative-fault-owner-repair/candidate/`.
Input is `0799643ef40099bc1fe297f496784ed7f7decb72`; committed production
source is unchanged from the tested `a441d1912` input. Foreign uncommitted
WAT/compiler edits were excluded from the test source snapshot and commit.
Jedi explicitly released the shared census for this host seal; its WAT entries
are unchanged. The original candidate's whole-file host seal is retained,
including its pending broader ownership assessment.

## Behavior and review

Frozen cooperative CLI control can explicitly arm retention using the discovered
PID, process UUID and generation. Main and cooperative native failures retain
the first actual Error before diagnostics, retirement or another sibling. The
faulting exports object remains private and supplies subsequent inspection;
its WeakMap instance identity, scheduler slot, kernel handle and native thread
ID remain distinct. The cooperative proof is slot 1 / native 2 / handle 000e1000.

Stack capture validates a maximum 128-byte contiguous prefix through production
translation, stops at the first unreadable byte, and preserves zero/partial
capture metadata and secondary diagnostics. The original Error and WASM stack
remain primary. Inspection spans keep strict bounds and all-or-error reads.
Held control permits status, inspection, ping and snapshot; guest mutation,
step, resume and ordinary quit are refused. No failed batch credit completes.

Explicit termination clears host keyboard/modifier/mouse/DirectInput and queued
input without guest dispatch, preserving the nullable CLI queue sentinel. It
exclusively creates and syncs the failure file and parent directory before
waking execution, rejects the outstanding step with the original Error and
exits 1. Persistence failure leaves inspection and explicit retry available;
successful termination is idempotent. Unarmed main failures still exit 1;
unarmed cooperative failures retain ordinary retirement and sibling progress.

## Evidence

Run: `20261103-alice-land-native-fault-retention`. The eight integrated hashes
match the retained candidate. Local helper/lifecycle checks pass. Source blobs,
all 27 `pngjs` package files and the needed winmine fixture were pinned, and
actual host/canvas/renderer imports passed before allocating the fresh boat;
staged bytes and actual imports were checked again before build.

The [retained four actual CLI cases](alice-cooperative-fault-owner-repair-20261103.md)
are reused with explicit hashes in `native-evidence-reuse.json`: armed main
UD2, armed cooperative UD2 with 8/128 stack bytes, unarmed main failure and
unarmed cooperative retirement/sibling continuation all pass. They also cover
stable delayed inspections, wrong identity/token rejection, forbidden mutators,
unreadable inspection, two persistence failures, a dropped HTTP connection,
input release and final exit behavior. These are existing functional results,
not new native runs. The predecessor's late preallocation `pngjs` pin is a
recorded workflow issue; exact package bytes and actual imports preceded its
successful tests. The owner accepted those functional results for integration.

The integration's required
`flock /tmp/wine-build.lock bash tools/build.sh` passed, followed by all six
focused suites: CLI fault lifecycle, native fault latch, keyboard-message-lparam,
frozen stdin control, CLI DirectInput mouse and thread manager. No suite was
skipped. The rebuilt 2089591-byte WASM SHA256 is
`0a58fd7b9ac82c5303048776f442b15e72528b55ddf85564e0df92fcb1aa384d`,
identical to the retained four-case module. The snapshot has no Git metadata;
the build retains its existing offline Big5 header/invariant check.

The first frozen-control attempt failed before native startup because this
integration staged winmine but omitted the eagerly mounted `stdole2.tlb` support
file. Its unchanged predecessor SHA256
`db456130e4b131aff27a6a3179464a28c9452f06eb6f2081d2aea38128d31895`
was checked locally, transferred and verified before retry. Frozen control,
DirectInput mouse and thread manager then passed. No production or compile
input changed, so the successful full build and preceding three suite results
remain applicable. The initial failure, startup diagnosis and supplemental
input pins remain explicit evidence; no second build or four-case rerun occurred.

Runtime was released at 18:01:52Z. All 5898 recovered payloads passed local
size/full-SHA checks before the original-task-delegated normal STOP. Archive:
37,369,640 bytes, SHA256
`ad324201e68be88a1d5e2f7490be27095068b0a0f67c085c09daf9291df18f52`.
`archive-verification.json`, `SHA256SUMS`, recovered source pins/modules/logs,
`native-evidence-reuse.json` and `RECOVERY.md` provide recovery. No active
runtime helper or listener on 8123 remained before STOP. Local disk stayed above 2 GB.

Own fresh boat `bx_qv2efjss`, finite TTL 3600 and original expiry
`2026-11-03T18:52:36.687Z`, was recorded before use. Delegated normal STOP
`stop_37dc400fde2fcd80` completed at 18:02:26.913Z, error null, forced false.
Actual state is STOPPED at 18:02:26.894Z, with an available completed snapshot
verified 18:02:26.851Z. Custody returns to the coordinator; no active expiry
remains. No foreign/predecessor boat, Claude, HeroesII, held CACA003B or deployment
was touched. Single worker, no subworkers or successor.

## Remaining Alice gameplay prerequisite

This lands fault retention only. A separately authorized original opening must
still produce authenticated coherent bytes after a completed movement update:
runtime module identity/base and relocation, actual local channel/qport and
engine-selected client, API roots, record/Player/state backlinks, and independent
capture phase/session/time anchors. Establish allocation-generation continuity,
two neutral supported-ground samples and a known unsupported/airborne comparison
before using origin/yaw/contact as a footing observer. A static slot-zero fixture,
JSON phase assertion or native fault test cannot establish that live sample.
Knife acquisition, attack effect and the wind/plank route remain unverified.
No Alice original, opening, route or gameplay run occurred in this integration.
