# GLTron validated analysis pair repair

Base: `55cc37b594fbf3a099ba3d8035c1cf56aafa3b95`. This is a source-only repair;
fresh independent acceptance is required before integration. Earlier candidate
`80f02f5f2235560f0705880544f0403dfda906b4` remains rejected.

The unchanged `test/gltron-publication-order-independent-accept-oct28.py` first
reproduced `failed-reanalysis-preserves-published-pair`: after successful A,
unresolved B retained A's inventory but replaced its closure. That original
failure and before/after bytes remain under the task's evidence directory.

`analyze` now validates before publishing either success file. Rejected import
details go to `rejected-closure.json`, separately from the successful pair.
Earlier checksum, malformed PE and other validation exceptions still propagate.
A rejected attempt with no previous success leaves both success files absent;
an existing successful pair remains byte-for-byte unchanged. Rejection evidence
can remain after later success and is not the current successful closure.

Successful publication serializes both documents, prepares new files and any
old-byte backups in a private same-filesystem directory, then replaces each
success file. Ordinary staging errors affect neither target. A replace failure
rolls back already replaced targets from prepared backups (or removes the new
file when absent before), then rethrows the original exception. A rollback
failure reports both the original cause and retained recovery directory. Fix
the filesystem problem before manually replacing the affected target(s) from
their `.old` files; do not treat a rollback failure as successful publication.

This is a single-writer ordinary-error rollback mechanism. The two renames do
not give concurrent readers an atomic pair view. There is no lock, fsync-based
durability, journal, or power-loss/process-crash recovery guarantee. Temporary
files may remain after abrupt termination. Concurrent writers are unsupported.

Validation (tiny synthetic fixtures only; no original copied, downloaded,
re-extracted or executed):

- Unchanged independent reproducer: original REJECT (7 pass, 1 fail), repaired
  ACCEPT (8/8). Independent source SHA-256 remains
  `19200bcefb9b144860b52bdd45935476f2310065c668fb550d7599af3aa858d2`.
- New `test/gltron-paired-analysis-publication-oct28.py`: 8 tests pass, including
  new/replacement success, unresolved imports with/without existing pair,
  checksum/PE failures, each staged write (including partial writes), either
  replacement failure with/without an existing pair, persistent rollback
  failure with retained recovery, and rejection of a mutation restoring eager
  closure publication before unresolved-import validation.
- Affected predecessor `AnalysisPublication`: 3 tests pass. Its rejected-import
  diagnostic assertion now uses the separate filename. The independent
  reproducer and original independent acceptance source remain unchanged.
- Reuse coordinator-verified predecessor 26 experiment checks and unchanged
  guard groups from `gltron-publication-order-independent-accept-oct28/receipt.json`;
  no original-material CLI group is replayed under this task's prohibition.

Canonical task evidence is
`scratch/usage-watch/gltron-bounded24-pair-repair-oct28/receipt.json`, with
`evidence/before/decision.json`, `evidence/after/decision.json`, and separate
stdout/stderr plus command/exit/cleanup records for each supervised operation.
The receipt binds the new delta, resource admission, exact task-branch remote
verification and recovery instructions. Main ownership stays with TuxRacer.
