# Enigma independent source acceptance — e8bceb04

Accepted for source review only. Main forbidden and untouched. No source repair,
Wasm compile, module instantiation, guest/browser execution, Boat operation,
service/restart/deployment, worker or refill. No assigned box; ID/state/expiry N/A;
coordinator lifecycle unchanged. All 14 pinned candidate files remain unchanged.
Only new independent tests/fixture/evidence are added by this branch.

The first behavioral group uses the exact pinned production runner SHA256
f9bca23e0e8f786ba66e5756132b24e2300e3a23984264f7ae0b6cb7b6b6ed97.
It executes byte-exact installation, qualification and earliest stageAndLoadPe
statement with a host loader substitute. Whole-runner source order places those
wires before stageAndLoadPe, loadWin16Dlls and loadDlls. Enabled, disabled and old
module cases pass; omission of installation/setter/qualification and late enable
all reject. Boot remains paused; installation before a loader does not establish
that a real guest initializer executed correctly.

New tests then pass 33 exact-function cases: real Get/PeekA/W WM_QUIT fetch and
pump early-park paths, conserved retry tokens; all four wrappers through actual
full unchanged win32_dispatch_inner CACA0011 typed continuation routing; nested
PeekA inside an outstanding GetW keyboard callback; keyboard-to-WH_GETMESSAGE
handoff; final mutated MSG, saved BOOL, caller ESP/EIP/hook ownership observed
before the fixture's next phase; failed Get/empty Peek and PM_NOREMOVE semantics;
stale/duplicate/unrelated context refusal; diagnostics-off memory/register/control
comparisons. Eight real wire/order mutations reject, including omitted actual
keyboard/message dispatcher branches and observation before caller restoration.

A separate independent production JS owner schedule checks 396 completions with
reverse deferred completion order, cross-kind handoff, double resume, stale
and duplicate token refusal, slot reuse, 128 outstanding-slot exhaustion,
argument mismatch and context collision. Five production guard mutations reject.
Twelve additional source route omission checks bind thunk-zone and decoded
CALL/JMP/API table routing. These structural checks do not execute decoder
lowering or prove compiled dispatch. New tests do not rerun donor test groups.

The source fixture interprets byte-exact functions without compiling them. It
extends the pinned restricted interpreter with bounded loops/branches and a few
i32 operations. Full dispatcher and real quit/early-park pump paths are interpreted;
hook bodies, host scheduling, locks, and remaining pump paths are supplied
fixtures. Register-return-address coincidence does not establish completion.
Physical/source fixture qualification is explicit in each result receipt.

Unchanged original six groups (including 96 baseline guest-state comparisons),
three legacy groups, import/structure receipts, and prior renderer/dequeue/Dispatch
evidence are reused by exact hashes and ORIGINAL UNCOMPILED qualifications.
See reused-evidence.json and the unchanged donor notes at
../../re-notes/enigma-canonical-msg-completion-hook-repair-oct26/README.md.
canonicalRuntimeQualified remains false. No original-game/input/gameplay claim.

## Incidents and resource controls

First owned fixture expected API argument2 as token instead of actual token1;
debug retained two correct events. Second omission harness dereferenced absent
bind before its oracle. Both corrected by capturing actual begin return tokens.
Third run reparsed unchanged dispatcher ASTs per mutation and hit the enforced
physical limit at 134443008 bytes; the reproducer and stop remain. Reuse of
immutable parsed functions reduced passing continuation peak to 127348736 bytes
without weakening coverage or limits. Early-observation mutation now asserts
nonnull final MSG before reading it. Two source-review receipt-writing mistakes
(reserved Python keyword and variable reuse) are retained and corrected. Initial
readonly excerpts exceeded8192 in tool messages; no test output gate was raised.
All historical platform denials, guest timeouts, earlier donor memory/disk/index
incidents, and erroneous individual128MiB client policy remain unchanged in the
donor evidence. They are not new denials and were not retried.

Installed Node24.18.1 heap64; DATA/AS unlimited verified at startup. Each focused
check reserves one shared128MiB permit, then physical supervision counts its
pool/supervisors and descendants. Git reserves both permits before exclusive
/tmp/wine-ops-production-git.lock; DATA512MiB applies only to Git child,
physical256MiB aggregate. CPU90/wall120/file24MiB/output2MiB/excerpt8192.
Measurements are sampled RSS, not continuous maxima; Node old-space is not a
process-RSS ceiling. No inherited heavybuild RAM floor or per-client RSS stop.
Fresh full96MiB allocation includes source/.git/outputs/publication/launcher/
session/events/positiveWALgrowth once/future16MiB/reserve8MiB plus separate
10MiB remaining publication/Git allowance. Installed tools/immutable standing
inputs excluded; no links/alternates concealing task bytes. Current free space
already accounts for materialized bytes; subtract only remaining growth, retain
2982150144B projected free. RAM retains768MiB host +shared256MiB execution pool
+64MiB future growth per resident client once; no new clients are launched.

## Reproduction and next gates

Extract ops.tar.gz into this task directory to recover supervisors and original
failures. New commands: python3 ops/run.py production-boundary, continuations,
ownership; python3 ops/run-review.py. Each uses the shared permit wrapper and
retained supervisor. Standing donor/source paths are explicit in common.py and
source-review.py; immutable pins and baseline inputs are in the receipts.
Do not rerun passing groups unless affected inputs change.

The independent source-review reconstructed completion.patch.gz byte-for-byte
for all14 candidate files. Baseline source239 is754c97d3ff22ce0a0cd06d08ac06dc0446fbcbb2;
JS parent40699f72bef9b5339c5371d9bdc0dd6e0efb8b25 is a SEPARATE prerequisite.
NEVER copy whole historical donor files onto main. Reconcile the separately
compressed partial-runner-prerequisite.patch.gz against current runner first,
and add/reconcile its message-boundary helper/tests from the verified partial
parent as appropriate. That runner patch alone is not the complete prerequisite
closure. Then apply/reconcile the donor minimal completion.patch.gz against its
recorded per-file baselines (source-review-result.json), including added helper
files; independently preserve all unrelated current-tree changes. Regenerate
signatures against the FINAL reconciled main.watx closure, not historical whole
files. Our independent tests are evidence fixtures, not authorized main adoption.

A future separate coordinator-authorized Boat task must admit that reconciled
closure, run node tools/gen-host-import-sigs.js --check and bash tools/build.sh,
bind exact resulting module/import/runner/worker hashes, and qualify actual
initializers plus thunk-zone, decoded CALL/JMP, immediate/park/retry, nested
A/W keyboard/WH_GETMESSAGE mutations and async continuation ownership before
ANY next guest instruction. Include omitted controls on real compiled wiring,
diagnostics-off equivalence and step-completion gate on exact production runner
before any Enigma input. No timed-out100000-batch replay, overlapping step,
second click, menu-title inference or timeout inference. This source acceptance
is not runtime admission and grants none of those operations to this worker.

The first evidence commit 259fd2b6eaaa94e4900dac6f463c966f6ba51aae was pushed and its exact remote
ref verified. External ops/publication.json records final closeout commit/ref.
Passing sampled peaks: tests127348736B/Git71225344B including supervisors.
Final pre-closeout projection43278336B/100663296B, projectedfree3223318528B;
newest external admission supersedes this timestamped sample. Sparse commit
Error building trees for an intentionally absent historical README was retained;
supported write-tree --missing-ok plus exact-parent commit-tree preserved all
historical entries without acquiring/retrying absent blobs. Only owned new paths
were reviewed/staged; no deletion/source/main change.
