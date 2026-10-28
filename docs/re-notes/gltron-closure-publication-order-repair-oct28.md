# GLTron analysis publication order repair — 2026-10-28

The original recovery candidate a80fd96b969a2ac80f30fdf6793d92f23ed9a860
published `inventory.json` during payload inspection, before validating PE
headers, parsing import tables and resolving the bundled DLL closure. The
independent rejection 6c1c7d2d0ee129ffee80287661efec4d60c85940 demonstrated
an actual production `analyze` exit 1 with unresolved DLLs and a success-looking
inventory already on disk.

Analysis now requests an unpublished in-memory inventory and publishes it only
after all static analysis validation succeeds. Extraction retains its existing
inventory publication behavior. Rejected analysis preserves a preexisting
inventory and unrelated output. `closure.json` remains the causal unresolved
import diagnostic, with the same nonzero CLI status. Archive hashes, extraction
limits, PE validation and the independent experiment are unchanged.

Evidence is retained at
`scratch/usage-watch/gltron-closure-publication-order-repair-oct28/`:

- `evidence/first-boundary/decision.json`: before editing, the unchanged
  production closure counterexample rejects only
  `no-inventory-on-failed-closure`; the CLI exits 1 and reports missing DLLs.
  The exact counterexample suffix and unchanged CLI/helper prefix were selected
  from the pinned independent test, without running unrelated groups first.
- `evidence/challenges/decision.json`: the entire unchanged independent
  experiment reports **ACCEPT, 26 checks** after repair. The missing-DLL CLI
  still exits 1 and retains its unresolved closure, without inventory output.
- `evidence/focused-final.stderr`: all five existing focused regressions plus
  three new publication tests pass. Tiny fixture tests cover hash, listing,
  checksum, PE, tool, import-table and unresolved-import failures, both fresh and
  existing inventory paths; consistent successful output and extraction
  compatibility also pass. Verification/static-tool mocks are confined to the
  tiny unit fixtures; the independent CLI uses the immutable original hash.
- `mutation.json`: restoring eager publication is rejected by the new tests,
  including preservation and successful-validation ordering assertions.
- `receipt.json`: canonical source/fixture pins, decisions, commands/exits,
  resource admission, publication and cleanup; stdout and stderr remain distinct.

The existing original 92-file and 95-artifact recovery receipts and the
independent 119-artifact receipts are inherited evidence, not repackaged or
requalified here. Only the relevant publication delta was changed and tested.
The original installer and executable were never run; no redownload, extraction,
Wine, browser, build or Boat operation occurred. This is source/static
qualification only. Fresh independent acceptance is still required before
candidate integration; there is no main push or public deployment.

The standing root messageboard exceeds the assigned 12 MiB file-size cap.
`COORDINATOR-NOTE.txt` hands publication reporting to the coordinator; this
worker does not attempt an append or raise the cap. The shared root tree,
index and refs and all donor inputs remain read-only. No test box was assigned;
the coordinator retains lifecycle ownership.
