# Independent cleanup rollback acceptance, 2026-10-29

Accepted production candidate `ac78ee2a1b2fa6ee38b1862d49635851ea5a72dd`,
`tools/recovery/gltron-original-win32-recovery-oct28.py` SHA-256
`aa7d8c7668a6ea466f2099bb1966d8f725ed660c47fcf961826e35f9c19be53d`.
No production code was changed. Main integration remains coordinator-owned.

The first behavioral check executed the unchanged
`cleanup-failed-generation-preserves-prior-pair` CLI reproducer from
`test/gltron-paired-cli-independent-accept-oct28.py`, SHA-256
`af1f66fae66ad59f09110b60bb19148bb4ecb814f1b8a49628b64910cc8e524c`.
Its original definitions and final reproducer were executed as exact slices;
unrelated prior groups were skipped. Diagnostics were preserved. It passed.

The new independent test runs the actual pinned `publish_analysis` API and
`main -> analyze -> publish_analysis` CLI. CLI fixtures substitute archive
verification and objdump text only. Each lane passed these 16 challenges:

- Existing complete pair and initial absence, each with first/second replace
  failure and cleanup failure before deletion, after partial deletion and after
  total deletion: ten checks.
- Existing pair with persistent backup write, restore write, restore replace
  and recovery-directory creation denial: four checks.
- Initial absence with persistent rollback unlink and recovery-directory
  creation denial: two checks.

All 32 checks passed. Recoverable failures restored exact prior bytes or initial
absence and preserved the causal exception. Cleanup recovery preserved backups
and reported their location. Persistent filesystem denial reported explicit
rollback failure, chained the original fault, included recovery diagnostics,
and did not claim successful rollback. Where the injected filesystem allowed
backup creation, complete prior backup bytes were retained and checked.

A mutation changing `if changed:` to `if changed and not cleaning:` was rejected
on `api-pair-cleanup-none`, the first changed cleanup boundary. It lost the prior
pair. The same independent test, without altered expectations, detected this.

Reproduce with an unused owned output directory:

```sh
python3 test/gltron-cleanup-fresh-independent-accept-oct29.py \
  tools/recovery/gltron-original-win32-recovery-oct28.py OWNED_OUTPUT
```

Predecessor 16 CLI, eight transaction, four new cleanup tests, eight publication
order and eleven original recovery checks are reused by their exact pinned
receipts. They were not rerun as full groups:
`scratch/usage-watch/gltron-two-lane-cleanup-repair-oct28/receipt.json` and its
coordinator review, referring to the earlier paired-analysis acceptance receipt.

Canonical task receipt and bounded coordinator publication note:
`/tmp/gltron-cleanup-fresh-independent-accept-oct29/receipt.json` and
`publication-note.txt`. All positive fixture bytes were retained in a verified
base64 snapshot before deleting their generated directories. The unchanged
reproducer and rejecting mutation retain their ordinary fixture paths.

Resource incidents are recorded in the canonical receipt: early read output
exceeded the terminal bound; the initial Git setup failed because an owned
Python wrapper propagated its hard data limit; the wrapper was corrected
without raising the prescribed per-process limits. Closeout found expanded
fixture allocation above the 1 MiB source/fixture projection, while total usage
remained below the 24 MiB allocation; byte-preserving compaction corrected the
retained footprint. No passed tests were repeated. These are operational
limitations of this acceptance run, not a rollback defect.

Acceptance is limited to one writer, ordinary exceptions, and these synthetic
static production API/CLI paths. It establishes no crash safety, concurrent
reader atomicity, archive/media validation, gameplay, browser or guest runtime
qualification. No boxes or mount operations were used.
