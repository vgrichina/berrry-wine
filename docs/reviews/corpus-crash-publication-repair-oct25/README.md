# Candidate replacement crash recovery

Base: `d9012a86a91c13dbe70dbcc4dceff2d7895c18a4`. No main integration.

The old replacement publisher moved the live fixture into `previous` before
renaming the verified stage into place. A real subprocess SIGKILL after the
first rename leaves the final path missing. The unchanged crash oracle fails
against the pinned old tool: its next invocation attempts acquisition rather
than restoring the original fixture. No external acquisition occurs in tests.

The repair writes and fsyncs a journal containing the candidate/destination
identity, directory inode identities and SHA-256 tree digests before renaming.
Staged files and affected directories are synced. Every invocation reconciles
before KEEP, PREP or acquisition. A missing final with a verified previous tree
restores that tree, including original saves and metadata. An interrupted first
installation can publish its verified stage; an already published replacement
can complete cleanup. Existing caught-exception rollback remains in place.

Ambiguous stages, foreign or changed candidate records, stale inode identities,
missing/truncated journals, symlinks, special files, hardlinked files and changed
tree bytes are rejected without removing the transaction or originals. The
tree hash includes names, file bytes, sizes and empty directories. It does not
authenticate a malicious writer with access to rewrite the journal and trees.

Validation: 24 real subprocess crash/restart and rejecting cases; existing force
recovery 7/7, DOS safety 8/8 plus cached reuse, memory/directory overlay atomicity
10/10, VFS overlay 20/20. Existing tests and overlay source bytes are unchanged.
The fixture replaces acquisition/extraction only with synthetic bounded data;
it executes the actual publication source and actual filesystem renames. The
DOS oracle uses a loopback-only synthetic ZIP server. No game/corpus assets,
guest runtime, browser, Wasm, compiler, remote box or external download is used.

Run with Node's 128 MiB heap under the task's 60-second CPU/wall supervisor:

```
node test/test-candidate-publication-crash.js
node test/test-candidate-force-recovery.js
node test/test-dos-recovery-safety.js
node test/test-overlay-memory-publication.js
node test/test-vfs-overlay.js
```

The first test accepts an optional source filename to run the identical oracle
against the old source, recovered using `git show BASE:tools/fetch-candidate-corpus.js`.

Limits: this is recoverable publication on one filesystem with one writer, not
an atomic exchange of two paths or a cross-filesystem guarantee. The final path
can be absent until the next invocation reconciles it. Concurrent fixture edits
or publishers are unsupported; stop writers before recovery. Directory fsync
and O_NOFOLLOW support are required. Hardware/power-loss durability was not
tested. A death before journal completion or during recursive cleanup may leave
incomplete state that is safely rejected rather than guessed at. Retain all
such state and manually inspect the journal, inode identities and byte hashes;
do not delete a previous tree until its final replacement is independently
verified. Changed saves after a crash deliberately require manual resolution.

Task-local consolidated receipts and recovery object-view recipe are in
`/tmp/corpus-crash-publication-repair-oct25/ops`. Evidence committed here binds
the exact source/oracle hashes and baseline/repaired outcomes. Early diagnostic
output guard mistakes and sparse dependency corrections are recorded in
`incidents.json`; they are not presented as compliant test executions.
