# CREATE/MKDIR direct-handler collision contract

Candidate: 1fa831cbde34a5943fd7888b30409bd8e918663a.
Production is unchanged. Five current input pins are embedded in contract.py and
results.json and match the dispatch, checked before and after execution.

Eight existing-file/existing-directory collisions across root and nested
directory parents returned EEXIST. Full instance state except operations was
preserved, including namespace, contents, modes, inode sequence, accounting,
failure latch, and open handles. Eight successful creations cover siblings,
nested directories and files, reply inode/mode/open-handle fields, initial root
4096-byte metadata charge and another 4096 bytes per inode. Expected namespace
and accounting are explicit fixture data; backend helpers are not used as oracle.

Four direct-handler parent counterexamples:
- CREATE (35) and MKDIR (9), parent 999: KeyError(999), rather than the test's
  Linux-like ENOENT requirement. State is preserved. The server catches a
  non-OSError as EIO and sets failure; that server path was inspected, not run.
- First CREATE root/file (inode 2); then CREATE or MKDIR parent 2, child "child":
  success instead of ENOTDIR, an entry appears beneath a regular file, live
  metadata increases from 8192 to 12288 and next inode advances from 3 to 4.
  CREATE also increases open handles from 1 to 2.

These are demonstrated direct-handler robustness gaps. Kernel-generated FUSE
traffic may prevent such invalid-parent requests; this does not establish
mounted filesystem reachability, kernel behavior or a caller-visible defect.
Missing-node ENOENT is an explicit test requirement for this proposed direct
contract, not a claim that a stale FUSE node must have that public error.
No unsupported name validation expectations are imposed.

Four source-copy mutations are all rejected: missing collision guard, wrong
errno, allocation before rejection, and inode consumption before rejection.
Copies are under mutants/ and never imported as production. The unchanged
production bytes were exercised first, before mutation controls.

Run from repository root:
  python3 -B test/toyvm-create-mkdir-collision-contract-oct29/contract.py
The collector records failures and exits zero after successful evidence capture.
Use --strict for a regression gate (currently expected to exit 1 on four cases).
No production repair, UNLINK/RMDIR, rename, READDIR, mount, Boat, Node, browser or
gameplay execution was performed. No mount argv or runtime checkout was needed.
Remaining gate: combined repairs, caller backend pin (still old), full CLI
qualification.

Evidence includes bounded supervisor execution/admission receipt, exact result,
dispatch and reused prelaunch/initial-ref receipts. Git status emitted alternate
object-store nesting warnings but exited zero; no denied operation was retried.
No shared messageboard writes; coordinator-note.json delegates append-only entry.
