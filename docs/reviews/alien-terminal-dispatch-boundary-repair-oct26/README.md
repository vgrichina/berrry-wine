# Alien terminal dispatch boundary source repair

Candidate input `f4455d87f011890622b76c846e342492b2bdcfda`, tree
`d4d5c1a7b95e93fe2a093a4b02bf40764ee5c8e3`; independent rejection
`38f7b011d3079942f8bafeea6b521845a0c46842`. Only the controller helper
changes production behavior. The actual CLI, production control server, historical
fixture, and existing tests remain byte-identical. No game change or runtime run.

## Observed repair

The first run used the original independent reproducer (SHA-256
`c009312a10ca4e05df15c9375e77cdf92f789d25923542ab4d2d685b3a0abc2a`),
actual tracked CLI main, real HTTP control server and durable ledger. Terminal
publication followed intent file and directory fsync but preceded transport.
Before repair: snapshot then PNG dispatched, next=2. After repair: snapshot only,
next=1, pending PNG remains and the terminal receipt is recorded. A restart sends
nothing in both cases. First failure and original independent rejection are retained.
The original script expects failure and therefore exits 1 on successful assertions;
`after-original.py` interprets that unchanged historical driver convention, verifies
the receipt, and changes neither the original assertions nor the injection.

The controller now observes terminal state after durable intent, before invoking
any transport. Its HTTP transport checks again at HTTPConnection.send, after
connection setup and before each header/body write. Request construction, handler
selection, connection setup and intent persistence can yield; an earlier check
alone is insufficient. The final check is wired through the production CLI's real
Controller/HttpTransport pair. The pending command remains an intent, not an ACK.
Exceptions latch refusal, and every existing ledger refuses restart even if a
process dies before terminal-latch persistence. Locks and uncertainty are unchanged.

## Evidence and scope

Thirty targeted HTTP challenges cover all ten command positions (snapshot,
step, PNG, eval, input and quit) at durable-intent, request-prepared and
connected-before-bytes boundaries. All refuse subsequent complete commands,
retain the pending intent, preserve prior ACKs and send nothing on restart.
The focused test fixture was then extended with partial-header observation;
`fixture-before-partial-extension.py` preserves the exact earlier fixture.
The four cases pass together at PNG in `boundary-3-final`, including the new
partial-header case. With terminal publication after headers, the already sent
headers cannot be retracted: the body is refused, intent stays pending, and the
server's command callback is not invoked. This is not zero-wire dispatch.

Custom-transport post-intent cases cover all ten positions. Four actual process
exits cover intent-file fsync (before rename), intent-directory fsync, HTTP request
preparation, and durable terminal publication before ledger latch. Every retained
ledger refuses restart and has no progress ACK. Lock conflict and malformed terminal
refuse sends. A default-off CLI case and actual historical subprocess regression
pass, including last ACK4650 vs terminal4754, partial104 and unACKed256 never replayed.
Normal production input ACK means queued only; it does not establish guest acceptance.

Both deliberate source omissions fail unchanged assertions: omitting the post-WAL
check allows a custom callback after terminal; omitting only the HTTP send check
allows a PNG after terminal during request preparation. Real server semantics
and the oracle are unchanged. Affected helper unit and production groups pass;
unchanged donor acceptance groups and original incidents are retained by reference.
Read `review.json`, `checkpoint.json`, per-group execution/output receipts and
`incidents.json`. RSS is sampled, not an exhaustive peak measurement. The original
134811648-byte physical stop is retained; exec removed an idle Python driver without
raising the 134217728-byte cap. Git reserves both permits and uses DATA512MiB on
Git children only. Node24.18.1/heap64 retains unlimited inherited DATA/AS and the
exact successful startup receipt. Full task allocation includes new Git/source,
staging, temp, evidence, launcher/session/events, positive WAL growth once,
publication/growth and reserve. Standing donor/tools are separately recorded.

## Concurrency limit and remaining gates

The controller flock serializes ledger owners, not the independent terminal-file
writer. The CLI accepts an external supervisor receipt; no cooperating writer
lock or transport authorization protocol exists in this candidate. File/directory
fsync orders intent and injected terminal durability, not atomic agreement with
socket delivery. A writer can publish immediately after any observation, including
between the last check and socket send. Checks before body writes can stop a
partial request but cannot retract earlier bytes. No exhaustive concurrent-writer,
filesystem/power-loss, guest-lifecycle or gameplay guarantee is claimed.

Independent acceptance of this source candidate is still required, then coordinator
integration. Guest/browser/Wasm compilation, Boat/API/lifecycle, services, deployment,
credentials and trust changes were outside scope and not performed. A later fresh
guest needs separate readiness/resource/lifecycle admission and step ACK followed by
frozen zero-credit snapshot before input. Historical unknown gameplay stays unknown.
No test box was assigned; coordinator retains both existing boxes and shutdown
2026-10-27T00:20Z. This task performs no lifecycle operation and stops at handback.
