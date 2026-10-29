# Independent READDIR parent acceptance

Candidate: `7193af5f8f591ed05ab058f8a4ef268de38ca7ec`.

PASS for direct `Backend.handle(op=28)` source behavior. All five current source identities are exclusively taken from the coordinator dispatch; historical hashes and candidate IDs in copied predecessor files are provenance only.

The unchanged repaired predecessor gate passed once: 870/870 original case observations are retained in `original-observations.json`, together with the three original oracle rejection controls. Seven predecessor dependencies were copied byte-for-byte; see `predecessor-copy-hashes.json`. The original diagnostic tail intentionally expects the old bug, so `gate.py` uses the copied repaired acceptance entry point's unchanged-case and oracle-control functions. It does not run the obsolete diagnostic entry point.

The independent `independent.py` oracle uses declared operation-derived parent edges and explicit little-endian byte encoding. It imports no predecessor parser or validator. It passed 7,329 exact wire comparisons across root, child, deep directories, three cross-parent moves and one same-parent rename. Checks cover dot/dotdot inode, record cookies, entry type, raw UTF-8 and non-UTF-8 names, comma-bearing names, 255-byte names, all prefix/resumption buffer boundaries, empty results and very large offsets. Ten deliberate corrupt-state controls return EIO for missing or ambiguous parents, including zero-sized buffers. These injections are not presented as supported namespace operations.

Seven owned source-copy mutants were independently rejected: rootconstant, wrongparent, wrongdot, offset-skip, offset-cookie, wrong-name-length and wrong-dot-type. Each retained first counterexample includes request and exact expected/actual bytes. Production files stayed byte-fixed.

Validation order: supplied literal checkpoint and startup receipt; current dispatch identities; unchanged production-boundary gate once; independent acceptance; exact pin/copy recheck and cached Git whitespace/scope review. All execution used the unchanged task supervisor directly from the original shell: parent soft DATA 128 MiB with inherited hard unchanged, Python DATA 128 MiB, Git DATA 256 MiB only, parent RSS 128 MiB/group RSS 512 MiB, CPU 90 seconds, wall 120 seconds, file 12 MiB, capture 2 MiB, evidence 1 MiB, 24 MiB allocation and unchanged per-operation admission floors. No Node executable, mount argv, runtime, Boat, checkout, donor mutation or root ref mutation was used. Mount/Node conditional checkpoints are therefore inapplicable. Git uses the exact supplied trusted SSH command.

Replay from repository root:
```sh
python3 /tmp/toyvm-readdir-repair-independent-accept-oct29/ops.py unchanged-gate python3 -B test/toyvm-readdir-repair-independent-accept-oct29/gate.py
python3 /tmp/toyvm-readdir-repair-independent-accept-oct29/ops.py independent python3 -B test/toyvm-readdir-repair-independent-accept-oct29/independent.py
```
The absolute dispatch and supplied supervisor are required recovery inputs; source/receipts are retained under `evidence/`. Completed groups were not rerun during this task.

Remaining gates: combined repairs, caller still pins OLD backend, and full CLI qualification. No mounted/kernel/browser/gameplay or combined-integration acceptance is claimed. No main/public deployment. No box assigned; coordinator retains lifecycle ownership.

Initial Git status returned success with alternate-object-store nesting diagnostics. They did not reject an operation; the full bounded stderr remains in task supervisor evidence. No object-store topology was changed.
