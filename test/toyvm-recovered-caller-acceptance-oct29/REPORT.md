# ToyVM recovered caller acceptance: BLOCKED

Candidate: `635633c8bc665451fd5a981108147b1c783e2f8a`.
Required backend main: `3898e008861bad6c274506664b2804dbdc7d236a`.
Final dispatch: 1761 bytes, SHA-256 `5b4038ee291d1b43a85dbf067a3a0d8d42bd5f495c5932bf453efbe91e4ffdee`.

No behavioral acceptance result is claimed. Before backend import or execution,
Git could not supply the first required backend input from the exact main pin:
`test/toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py`.
The first `git show MAIN:PATH` exited 128 (op-007). Its original stderr is retained
unchanged. A distinct exact-tree lookup, `git ls-tree MAIN -- PATH`, exited 128
with `fatal: not a tree object` (op-008). Thus this is an unavailable immutable
tree/input closure, not a demonstrated caller defect or proven absence on main.
The configured stores also emit a nested-alternate-depth diagnostic. No donor
alternate configuration was modified and no fetch/download was attempted.

All four candidate caller/document/test files passed the dispatch byte-count and
SHA-256 checks before this failure. The caller itself was not modified. RECOVERY.md
and REPORT.md were read. Their 25 passing predecessor checks are referenced, not
replayed or independently accepted here; their stated backend groups remain
historical evidence. The remaining three dispatched backend pins and immutable
pinned-supervisor closure were not validated after the first failed input.

Resume condition: coordinator supplies a verified, locally readable exact-main
backend and flattened dependency closure under the same resource/access controls.
Then a fresh assigned acceptance can exercise actual API/CLI boundary, malformed
receipts/limits, authoritative accounting, owned workdir, backend selection and a
rejecting mutation. No test result, backend correctness or production readiness is
inferred from source inspection or fixture-only predecessor results.

This is an independent report-only root commit on the assigned task branch,
without an unavailable main tree as parent. No candidate integration is included.
The coordinator may recover the report using this commit; source integration and
main publication remain separately serialized and unauthorized in this task.

Containment negative controls rejected omitted, root and donor cwd before spawn;
an owned sentinel ran under the explicit keyword-only cwd supervisor. Every Git
command used explicit git -C and subprocess cwd; actual toplevel/git-dir were
checked before Git mutation. The independent guard and original command receipts
are retained here. Physical RSS, process-group cleanup, CPU90/wall120, file12MiB,
output2MiB, Python DATA128MiB and Git-only DATA256MiB were applied by the guard.
No Node was needed. Source reads used read-only process-local donor alternates.
Initial session/WAL baselines preceded production; fresh capacity checks accompany
operations. Task allocation remains retained through coordinator closeout.

No browser, guest, Boat, FUSE, mount, build or real production child ran. Intended
mount argv and intended mounted files are empty. No box is assigned. Coordinator
owns lifecycle. Browser remaining CPU35.353183/wall101.495550694/capture1 is unchanged
and unconsumed. Real-kernel/browser acceptance remains open.

The shared messageboard already exceeds the worker file-size cap and was not
modified. A bounded external publication-note.txt hands board delivery to the
coordinator. Canonical post-publication receipt and full changed manifest reside
at `/tmp/toyvm-recovered-caller-acceptance-oct29/receipt.json`.
