# GLTron paired analysis independent acceptance: REJECT

Candidate: `3f56029b13937a84b27cd1996434da880b5d272a`.
Production source SHA-256:
`409404d936f6a146860bea29daf19c5104732369e1549f290ccdc6a9065f3956`.
This report adds an independent test and diagnosis only; production is unchanged.

The first counterexample is an ordinary staging cleanup failure after both
replacements. Successful generation A exists. Generation B has valid changed
payload bytes and imports. `publish_analysis` replaces both targets, then its
unconditional `finally: shutil.rmtree(stage)` raises `PermissionError(EACCES)`.
The production `main -> analyze -> publish_analysis` invocation fails before
printing success, yet both published files contain B, not A. This contradicts
the assigned failed-generation preservation contract. The two files are coherent
with each other in this counterexample; this is not another mixed-pair claim.

The exact first failure is
`cleanup-failed-generation-preserves-prior-pair`. Fault injection substitutes
only `shutil.rmtree` for the private `.analysis-pair-*` directory. Archive
authentication and objdump output are isolated using tiny synthetic PE headers;
production CLI argument dispatch, inventory inspection, PE checking, publication,
renames and filesystem bytes run unchanged. No original media is copied,
downloaded, extracted or executed. The retained stage includes A's backups;
its path and before/after bytes are preserved in the task evidence. No manual
recovery was performed on this failure artifact.

Reproduce from the candidate plus this test, with a new output directory:

```sh
python3 test/gltron-paired-cli-independent-accept-oct28.py \
  tools/recovery/gltron-original-win32-recovery-oct28.py /tmp/gltron-independent-new-output
```

Use the task's resource supervisor for host execution. Exit 1 means REJECT.
The test stops at its first failed contract assertion and writes decision and
checkpoint JSON atomically between completed checks.

Acceptance evidence:

- Unchanged required reproducer: exit 0, 8 checks pass; SHA-256 remains
  `19200bcefb9b144860b52bdd45935476f2310065c668fb550d7599af3aa858d2`.
- Candidate publication tests: exit 0, 8 tests pass. These cover initial/next
  success, absent/prior-pair unresolved rejection, malformed PE/checksum errors,
  partial staged writes, either replace failure, and rollback failure with
  retained recovery and original exception cause, including manual recovery.
- Affected predecessor `AnalysisPublication`: exit 0, 3 tests pass.
- New independent production CLI test: exit 1, 15 checks pass before the first
  failure. Missing, one-sided, stale, mismatched and malformed publications are
  preserved on unresolved rejection and rebuilt correctly on valid success.
  One-sided prior pairs also roll back on second-replace failure.
- A mutation restoring closure publication before unresolved-import validation
  is rejected through production `main`. Mutant SHA-256:
  `447d5ece6bed2eac2f59f98b7086b47d4762d1a5aea5a23902ac47ddc839b69d`.

No further acceptance checks or candidate repair followed the counterexample.
Concurrent readers, process crashes, power loss and gameplay remain unqualified.
Cleanup faults overlapping another causal failure were not additionally tested;
the passing rollback-cause group does not establish that broader guarantee.

Canonical receipt:
`/home/user/wine-assembly/scratch/usage-watch/gltron-paired-analysis-fresh-independent-accept-oct28/receipt.json`.
Per-command stdout, stderr, exits, resource samples and descendant cleanup are
under its `evidence/`; synthetic fixtures and original failure artifacts are
under `/tmp/gltron-paired-analysis-fresh-independent-accept-oct28/`.
Historical coordinator-verified manifest entries and four source pins are reused;
this task does not claim a whole historical payload rehash.

The earlier watcher reserved 125829120 bytes and missed floor plus headroom by
823296 bytes, then stopped. This incident remains recorded. Replacement aggregate
reservations are 100663296 bytes (four 24 MiB allocations), with unchanged
2982150144-byte floor plus 67108864-byte headroom. Fresh per-operation resource
receipts govern this task. No resource limit was raised, no runtime or Boat was
used, and no main, shared registry or public deployment was modified. The
coordinator owns the oversized messageboard append via `publication-note.txt`.
