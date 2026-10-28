# TuxRacer closure/publication independent acceptance, 2026-10-28

ACCEPT for static closure and ordinary-exception publication rollback of
candidate `a52929b9faf82c58b57d11c550120f6bd687e1d0`. Production recipe SHA256:
`567a716c33e97d9c8547a02c77ff10dc1839308afb45c3fe9848effb60a3134d`.
The recipe and both inherited tests remain unchanged. This commit adds only
independent tests and this report.

Behavioral verification began with the unchanged historical stage reproducer
and its exact pinned historical production recipe. Its exit 0 documents two
historical REJECT findings; it is not candidate acceptance. Its fixed source
identity assertion cannot run against the changed candidate. The independent
suite explicitly repeats those stage concerns against the pinned candidate's
actual `main()` before testing broader concerns. All synthetic stage calls use
a declared fixture-only digest seam; a separate unpatched production CLI call
rejects that fixture with the original SHA256 mismatch and creates no payload
or report. No original archive is opened, copied or extracted here.

Six independent test methods cover the two historical counterexamples,
malformed executable and bundled DLL, unresolved non-system import, missing
deterministic literal Tcl source, absent and preexisting report pairs, complete
static closure with a valid bundled DLL and literal source, two successful
generations, failure at each report replacement, and a failed second generation
preserving the first payload and report pair. Success inventories are checked
against actual fixture and extracted-file digests. Validation/publication
failures assert causal errors, empty success stdout, unchanged old/absent pair,
no new payload, and no leaked staging directory. A deliberate mutation allowing
unresolved DLLs is rejected with specific failed rejection assertions.

Reuse the coordinator-verified repair receipt at
`scratch/usage-watch/tuxracer-closure-publication-repair-oct28/receipt.json`:
15 repair groups and the affected original PE group pass; unchanged focused
groups and original171/prior190 evidence are inherited without historical
packaging replay. The three canonical dispatch input hashes were independently
verified at their actual donor paths and again against the sparse checkout.

Acceptance covers recognized static direct imports, the documented lexical Tcl
subset, and ordinary synchronous exceptions. Dynamic Tcl/loading, original
archive acceptance, gameplay, concurrent-reader visibility and power-loss
atomicity remain unproved. Serialized integration may consume the candidate
plus this independent test/report commit. No main, registry or deployment
operation is authorized by this acceptance.

Canonical independent receipt:
`scratch/usage-watch/tuxracer-bounded48-pair-accept-oct28/receipt.json`.
It records commands/exits, distinct stdout/stderr, source/fixture pins, fresh
aggregate disk and physical-memory admission, strict-SSH task publication,
exact remote verification, recovery and cleanup. A failed initial checkout
caused by nested Git alternates is retained; only the owned clone's alternates
were flattened to existing read-only stores before checkout succeeded.
Initial read-only terminal inspection exceeded the intended output gate; it is
not claimed as controlled acceptance. Behavioral/Git operations use the bound
supervisor and retain its admission and process cleanup records.

The 48MiB task allocation includes session/events and positive WAL growth once,
prospective growth and an internal 8MiB reserve. Donor stores are standing,
read-only inputs. The oversized standing board is not appended by this worker;
the coordinator publishes the bounded task-owned publication note. No test box
is assigned; no runtime lifecycle change is made. Stop after this finite
source-only handoff; original/gameplay qualification needs a separate task.
