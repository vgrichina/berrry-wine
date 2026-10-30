# Independent RENAME evidence acceptance — 2026-10-30

Accepted source candidate `f40300ca8a982cee856547cfffe49c42a1ea30bf`.
No production changes. New independent assertions are in
`test/toyvm-rename-wire-independent-oct30.py`.

## Identity and evidence

Pinned production backend SHA-256:
`13bf42f071f5eb84542286f35faf2dc814aaf63bf1bcfe7bb306e3e2f7f4f963`.
Pinned existing transport/test SHA-256:
`1a43a9305f1b3d92957ef03c34caec6eb0990dc03f2f23c0d20f0ca53b9fa751`.
The new test verifies both before importing. Candidate HEAD and all dispatch source
pins matched; reviewed the candidate production diff and existing test.

Canonical receipt:
`/tmp/toyvm-rename-wire-coverage-instrumentation-oct30/completion-receipt.json`,
SHA-256 `9c618fefe7235a18c9d449c2fb122bf1c7b65a5ba6d433bf72867605413b5b92`.
Reviewed and hash-verified its final `wire-acceptance` log (8 passing groups)
and `original-parity.stdout`. Earlier failed fixture runs remain historical;
the reused result is specifically `wire-acceptance`. These unchanged groups
were not rerun for packaging. Original-default exact wire/state parity and
unchanged filesystem-handler AST evidence are reused from that receipt.

## Additional acceptance

All four new groups pass through the actual pinned `Backend.serve`, using
AF_UNIX SOCK_SEQPACKET requests and the real stream status socket. No direct
`handle` calls or replacement production runner.

* Cross-directory RENAME2 and RENAME success, missing-source and non-directory
  rejection. Exact opcode, request unique, old-parent inode and positive errno
  are checked against the wire reply. Includes max uint64, repeated, decreasing
  and zero request IDs, distinct destination/child inodes and immediate status.
* Every enabled retention size 1 through 64: exact full eviction order after N+1,
  mixed opcodes, intervening non-rename requests, and saturation across three
  callbacks. Only the otherwise unreachable starting counter is seeded to
  uint64-max minus one; measured transitions still traverse serve.
* Every RENAME short binary prefix (0..7 bytes) and RENAME2 short prefix
  (0..15 bytes), plus missing name separator, returns EIO and is recorded.
  Serve remains usable for a subsequent success; errno resets to zero.
  Disabled and enabled runs have identical replies and ordinary status fields.
  Disabled instances allocate neither evidence deque nor callback counter.
* Sensitive names, non-UTF8 names, credentials and root path do not appear in
  the checked status. Records match exactly the five numeric fields.
* A source-derived mutant removes exactly the sole serve hook. The same
  independent boundary rejects it with `serve evidence hook missing`;
  the test requires that precise assertion, rather than accepting any failure.

Oracle derives from the pinned serve order (handle/exception translation, hook,
reply), opcodes 12/45, rename validation and numeric state schema. Malformed
callback payload EIO is supported; this does not assert recovery from malformed
outer frame headers, which the source intentionally rejects outside that catch.

## Reproduction and limits

From this task's owned repository, using the unchanged task supervisor:

```sh
python3 ../ops.py boundary python3 test/toyvm-rename-wire-independent-oct30.py Acceptance.test_00_production_boundary
python3 ../ops.py adversarial python3 test/toyvm-rename-wire-independent-oct30.py Acceptance.test_all_retention_limits_and_saturation Acceptance.test_malformed_payload_and_disabled_exact_parity Acceptance.test_removed_hook_rejected_at_boundary
```

Fresh evidence is under
`/tmp/toyvm-rename-wire-evidence-independent-accept-oct30/e/`;
completion/recovery receipts are in its parent task root. The supervisor retains
disk/physical-memory admission, Python DATA128MiB, parent RSS128MiB, group
RSS512MiB, CPU60/wall90, file12MiB and capture512KiB guards. Git DATA256MiB
applies only to Git children. No Node acceptance was executed, so no Node
startup qualification is claimed. No filename-bearing mount argv was executed.

This is source/socket acceptance only: no kernel FUSE mount, confinement,
guest, browser, gameplay or deployment claim. No Boat was allocated.
Coordinator retains lifecycle ownership. No production defect found.
