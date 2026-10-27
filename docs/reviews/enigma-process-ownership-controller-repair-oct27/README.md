# Enigma process ownership repair: tested locally, publication blocked

**Historical checkpoint, superseded and independently rejected:** the alternate
inherited listener failure demonstrated that FD/PID possession does not establish
original-runtime authority. The claims below describe that earlier implementation,
not a current acceptance result. See
[`../enigma-supervisor-owned-controller-implementation-oct27.md`](../enigma-supervisor-owned-controller-implementation-oct27.md)
for the new production-supervisor contract and retained failure references.

Base commit `36723a46880442a4e04a9ca31f23ec0f4ebb6340`, tree
`cba7cd2b83c5d5bf4da8394471ddee833c3f5cf0`. Local branch:
`task/enigma-process-ownership-controller-repair-oct27`.
There is **no repair commit, published repair tree, verified remote repair ref,
or remote backup**. The branch still points at the base with uncommitted owned
changes. Packaging was denied before its child executed. Main was never edited.

The controller claims the original process using boot identity, PID namespace,
PID and start ticks in a fixed private UID directory under `/tmp`. Exclusive
creation precedes HTTP. The original configuration and request intents are
durably recorded; the directory entry is synced before dispatch. Claims remain
after quit, controller death, uncertain responses and evidence failures. Output,
URL, terminal, allowance and time changes cannot create another claim for that
process. A new PID lifetime has a distinct identity; stale supplied ticks refuse.

The actual workflow continues image review through the original live CLI and
its decision file, within the original batch/time limits and exact reviewed
frame binding. No ownership handoff or automatic recovery is implemented.
Never delete a claim to restart a possibly live/uncertain invocation. This is
cooperative local ownership, not an OS sandbox against same-UID deletion or a
caller bypassing this client.

The unchanged original challenge is retained byte-for-byte. Its ownership block
was executed without repeating the historical 19969+256 failure or the already
passed first CLI group. Baseline: second CLI dispatched seven HTTP commands
while the first remained at review. The diagnostic's exit zero means rejection.
The same inputs with an explicit corrected expected-refusal oracle passed:
second CLI exited one before any HTTP or second evidence-directory creation.

Eight new actual-CLI ownership methods passed across retained groups: racing
owners, alternate output/URL/time/budget configuration after ordinary quit,
review continuity in the original owner, crashes at step/input request intent,
dead/mismatched identities, separate guests, uncertain step/input responses,
and empty persistent claims. Six affected existing methods passed, including
ACK/frozen-zero refusal, uncertain no-replay, terminal state, reviewed action,
stale review and cleanup. Python idle processes stand in for fake guest process
identities; HTTP responses use the pinned production runner's existing schema.
The actual production CLI controller is invoked directly, without shell surrogates.

The final production edit after initial ownership groups only converts a missing
`/proc` read into explicit Refusal; the negative identity group and six affected
regressions tested this final source. Unchanged positive-path receipts are reused.
Two test harness incidents remain in raw logs: missing evidence parent, then
two clock reads accidentally making a nominal 110-second window too long.
Parents creation and a 109-second test window corrected them; only affected
methods were rerun. Early helper checkpoint overwriting is documented; raw
execution logs remain, and later groups retain per-group hash checkpoints.

Final source SHA256:
`7706cb34749cbc0c20c892fe363e72a3eab86653fb60d3f6547d2ce00985ee48`.
Existing fixture SHA256:
`19abee2507c3c1ee217a176757e35229d520cf7f8c10f6ee1308e116ad8c62ce`.
New ownership fixture SHA256:
`ff79de7fee8db18bf6e0e7fa254b5946eacb781e32ead087868b29116f55ae18`.
Original fixture remains
`61c62560161fbe7f5ed4850eb9f66cf84b74e76b6e0ded27495c533ae3cb8f58`.

Evidence and recovery source remain at
`/tmp/enigma-process-ownership-controller-repair-oct27/{repo,ops}`.
Read `ops/result.json`, `checkpoint.json`, `baseline-receipt.json`,
`corrected/ownership-rejection.json`, execution logs and per-group checkpoints.
`ops/unchanged-challenge.py` and `retained-ownership-rejection.json` preserve the
pinned original inputs. The prior acceptance result remains at
`/tmp/enigma-batch-controller-independent-accept-oct27/ops/result.json` and was
never committed/pushed because its projection was 884736 bytes short.

The current package gate projected 2979598336 free bytes, below the required
2982150144 by **2551808 bytes**, after the complete 36 MiB task envelope and
active Alien's 44 MiB future allocation. MemAvailable was 3807391744 bytes and
own client RSS 194871296 bytes, within allowance. Peak supervised test-tree RSS
was 131919872 bytes, below 128 MiB. Tests used one execution-pool permit;
setup Git used two then the shared lock, with 512 MiB DATA on Git children only.
No limits or floors were raised and no unchanged denial retry occurred.

Resume only after an actual capacity change or coordinator-approved revised
valid allocation, with fresh admission. Reuse this tested source and receipts;
package compact evidence once, review the sparse diff and preserve all unrelated
tree entries, then commit/push the task branch and verify its exact remote ref.
Fresh independent acceptance remains required before integration; separately
admitted runtime and gameplay gates remain unqualified. There was no emulator,
guest, native, browser, Node, build, Boat, main integration or lifecycle action.
No assigned box. Alien paths were preserved, Claude stayed idle and Heroes II
remained laptop-owned. This worker releases ownership and stops on this blocker.
