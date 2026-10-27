# GeneRally mailbox ownership repair (source only)

The rejected candidate `e954f74d815795fbb715f54a312746f47f8e7157` locked only `--state`. The unchanged independent actual-CLI attack reproduced an alternate cursor dispatching snapshot13 into the same mailbox while its original owner remained alive, pending snapshot12, with no ACKs. The same-cursor competitor refused. This repair changes only the loading controller and focused tests/documentation; `test/run.js`, guest semantics and the frozen control protocol are unchanged. The independent rejection and its original portable reproducer are retained unchanged.

The controller now takes a nonblocking exclusive flock on the actual canonical requests-directory inode, before opening transport ownership or dispatching. Mailbox-root symlinks and a separate root aliasing that requests directory share the same lock. The old cursor lock remains. The transport journal is a hidden sidecar in the canonical requests parent, named by requests device/inode; no metadata is inserted into `requests/` or `replies/`. Request/reply directory identities and the terminal-marker root are bound in that journal. A different root sharing requests cannot silently substitute another terminal endpoint for a clean handoff.

The durable journal becomes `active` before any cursor mutation and `pending` with the exact request before its mailbox file is published. Every atomic journal/cursor write fsyncs the file and parent directory. A validated ACK advances transport history but leaves ownership active until the complete loading sequence, exact step counts, matching frozen-zero snapshots, post-loading gates and final transport integrity checks succeed. Only that success writes `clean`. Errors poison ownership; death leaves active/pending ownership unresolved. Neither a different cursor, process death, timeout, a late reply nor an apparently complete request file authorizes recovery, ID reuse or replay. Rejection does not reset the competing cursor.

Clean handoff is deliberately bounded and explicit. A fresh empty unjournaled mailbox may adopt the supplied valid clean cursor once. An existing mailbox must have a clean journal, the same endpoint identities, intact SHA256-bound request/reply history, no extra JSON request/reply files, and a clean cursor with exactly the authoritative next ID. A second state pathname is permitted only under those conditions; the same clean cursor may restart too. No automatic cursor reset, history adoption or uncertain-request recovery is offered. History is limited to4096 acknowledged requests, inventory inspection to8192 entries per directory and journal reads to1MiB. At a limit the controller refuses dispatch. Preserve the sidecar and both mailbox directories together; do not rename/replace active endpoints or delete metadata to reclaim an uncertain lane. Recovery or a new transport requires a later coordinator-owned decision.

This is trusted local cooperative CLI exclusivity. It makes no cryptographic or hostile-user isolation claim: an actor that deletes journals, replaces directory identities or ignores the lock is outside the contract. Stdio transport and the guest runner remain unchanged.

## Focused verification

The first behavioral checkpoint was the unchanged rejecting CLI test on the exact rejected source: it exited1 for request13 while request12 remained pending; all children were reaped. For repaired-source qualification the same oracle is retained byte-for-byte except its required helper SHA identity pin. Its same-state control and alternate-state challenge now pass with no request13 and zero ACKs written. A falsifiable omission control substitutes only the old unguarded Mailbox implementation (with no-op ownership hooks) into the otherwise repaired controller; the unchanged oracle again rejects the bypass. Original and variant sources, commands, observations, diagnostics and cleanup are retained.

Final-source targeted tests pass:

- Same-state exclusion, root symlink exclusion and requests-directory alias exclusion while owner12 is alive.
- Death of owner12 leaves durable pending ownership; an alternate clean cursor is rejected without request13, ACK creation or journal/cursor reset.
- Timeout leaves a poisoned journal retaining pending12; another cursor is rejected without dispatch.
- Exact pinned production controller/stdin boundary: nonmultiple total2501, chunks at most1000, exact ID/count/batch completion, intervening frozen-zero snapshots, historical pending-cursor refusal and terminal no-dispatch guarantee.
- Production-response fault controls: missing, wrong-ID, negative, wrong-count, wrong-steps, wrong-batch, not-frozen, credits, quit, snapshot-batch and exit; global deadline remains an upper bound on a38-second response allowance. All stop before post-loading input/capture.
- A persistent exact-production-boundary fixture supports clean alternate-cursor handoff IDs12..17 and same-cursor restart IDs18..20 without duplicates. No guest execution occurs.
- Changed acknowledged history, partial/stale completion ACKs, mutation of a consumed reply, a substituted terminal root and oversized journal all refuse subsequent dispatch/handoff. Fault controls explicitly corrupt fixture responses; they never supply completion for the historical uncertain request12.

The production fixture validates full runner SHA256 `6dc104b3c10db701c0b1aec5954dd00cc29a7b6009970a5876ccc27426e7fa9e`, blob `f52b03a096a9a614b681cdf0f912ce20ca19fcba` at authority `1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba`, and executes the unchanged contiguous production boundary SHA256 `96de2e3dbd35b5059e05e7a346a65f2926d643acf03b7af5cd9760255d1e2bf7`. Host observations/batch cost are stubbed; this is protocol/CLI evidence, not game timing. Node startup and fixture runs use installed `/home/user/.nvm/versions/node/v24.18.1/bin/node`, heap flag512MiB, the same controlled environment, CPU90/wall120/file24MiB guards and768MiB aggregate RSS supervision. No AS/DATA cap is applied to V8; the heap flag is not a total-process memory cap. Python-only operations use128MiB; Git alone receives DATA512MiB and aggregate RSS256MiB under the two-permit pool and Git flock. Every actual child operation uses the shared pool.

Two source refinements were retained and requalified: the first metadata placement inside requests violated the unchanged namespace oracle and was corrected to a directory-inode lock plus sidecar; final identity binding covers the terminal root, bounded journal reads, and preserves the original terminal failed-cursor behavior. Raw failures and all pre-final evidence remain distinct from final-source passing evidence. Behavioral tests exhausted no guard. Publication later exhausted the cumulative output guard when Git whitespace checking printed the retained oversized whitespace-journal fault fixture. Both Git processes were cleaned up; publication is blocked pending coordinator authorization and a fresh bounded output allocation after lossless compression of whitespace-bearing evidence. No retry is authorized by this report. No unrelated historical709-group suite was rerun. Coordinator-verified predecessor manifest168 payloads (SHA256 `4bed9a958cda94567e80ac65f5a2fad20174e7d82c7e67f499ab9e91097265d9`) is reused without a repeated package audit.

Portable source tests (run only through the assigned pool/supervisor and admitted limits) are `test/test-generally-mailbox-ownership.py`, `test/test-generally-mailbox-handoff.py`, and `test/test-generally-loading-controller.py --group mailbox`; each takes `--evidence /OWNED/fresh-path`. The original fixed-source-PIN independent test intentionally remains the unchanged historical reproducer; repaired/mutant hash-qualified copies and the omission recipe are retained in the report payloads.

## Preservation and remaining gate

Reports and losslessly compressed raw stdout/stderr are under `reports/generally-mailbox-ownership-repair-oct27/`. The one authoritative completion manifest is `/tmp/generally-mailbox-ownership-repair-oct27/ops/receipt-manifest.json`; it binds exact tested source/test/fixture/commands/diagnostics, rejected controls, measured allocation, publication ref and cleanup. The tracked evidence index is a payload lookup, not another acceptance manifest.

No guest, Boat, compiler, module instantiation/rebuild, native recompilation, download, main integration or public deployment occurred. Retained passed modules remain untouched. No test box is assigned; existing boxes and their expiry/shutdown lifecycle remain coordinator-owned and untouched. There is no filename-bearing mount argv in this offline task; the canonical mount gate remains required for a later authorized runtime.

The real loading-delay cause remains unknown. This repair closes the demonstrated ownership bypass; it does not establish game loading or playability. Runtime is not justified until independent acceptance of this exact repair, later current-main reconciliation, fresh coordinator assignment/admission, retained module/input verification, exact startup/mount diagnostics and complete finite lifecycle/queue/time/capture/wire/staging allowances. Historical uncertain request12 must never be replayed or inferred complete. Stop at this source handoff; the coordinator assigns any next work.


### Cursor integrity transaction repair (2026-10-27)

The independent consumed-reply scenario rejected candidate4616ccf2: after valid
ACK62, changed consumed ACK61 was discovered only after snapshot63 had reserved
next64. Request63 never dispatched. This was cursor advancement, not duplicate
dispatch.

The transport now owns a bound exchange boundary with reservation and dispatch
callbacks. Mailbox checks history, owner state, ID bounds and existing files before
calling the durable cursor reservation. It checks integrity again after that write
and after the durable transport pending journal, before publication. Stdio likewise
checks for unsolicited replies before and after reservation. The controller tracks
whether publication has been attempted. A refusal before publication restores the
last acknowledged next/last identity and marks it pending+failed (terminal history
uncertainty, without a new request). A publication attempt, including a partial or
failed write, keeps the new durable pending cursor; it can never be resumed or
replayed. Poisoned transport ownership still forbids handoff.

The owner lock excludes cooperating controllers, not external file writers. Checks
observe integrity at the final prepublication boundary; they cannot make arbitrary
external writes atomic with a later filesystem operation. Mutation during either
durable reservation write is caught and the tentative cursor is abandoned. Mutation
after publication remains dispatch uncertainty, retaining its pending record. No
cursor rollback is permitted once publication is attempted. Existing ACK completion,
frozen-zero, deadline, terminal, inventory and clean-handoff rules remain in force.

The unchanged production-fixture no-advance assertions now retain next63 and only
requests61,62. Only helper/source identity bindings changed in that oracle. A mutant
with the old reservation-before-check ordering and no abort rollback is rejected by
the same assertions with next64. Separate deterministic tests cover known mutation,
mutation during cursor and journal writes, stdio unsolicited ACK during reservation,
and postdispatch uncertainty. Evidence and reused predecessor receipts are in
reports/generally-cursor-preflight-integrity-repair-oct27. This is source-only repair,
awaiting independent acceptance; no guest completion or runtime authorization.
