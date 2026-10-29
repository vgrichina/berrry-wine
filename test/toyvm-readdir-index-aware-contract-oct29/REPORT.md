# READDIR parent-entry contract — expected failure

Candidate: `3eebad217b2784af8e74e3f919cb9b122532ac64`.
Production is read-only. The five immutable source pins are in
[source-pins.json](source-pins.json); the exact declarative namespace and
rename/move sequence are in [fixture.json](fixture.json).

Run from the repository root:
`python3 -B test/toyvm-readdir-index-aware-contract-oct29/contract.py`.
On this pinned candidate, exit zero means the **expected defect was reproduced**
and every surrounding control passed. It does not mean production satisfies the
parent-entry contract. A repaired backend requires updating this expected-failure
harness in a separate task, with new source pins.

## Canonical result

[results.json](results.json) retains original observations, binary minimal
request/response, source pins and fixture SHA256. There were 870 direct READDIR
callback calls: 780 passing controls and 90 wrong-parent cases. No other
mismatch was accepted. The minimal namespace is root=1, /a=2, /a/b=3.
READDIR on inode 3 returns `[(3, ".", directory), (1, "..", directory)]`;
ordinary topology requires parent inode **2**.

The independent model uses only declared mkdir and rename operations, never
backend node tables or implementation-derived parent values. Setup uses actual
pinned Backend.handle MKDIR and RENAME callbacks; READDIR op28 returns real bytes
parsed with struct into aligned Linux fuse_dirent records. Root and root-child
dotdot, dot=self, ordinary directory entries, complete record count/order/types,
offset cookies, exhausted offsets, padding and bounded buffers are checked.
Depth2/depth3, same-parent rename and cross-parent move are covered.
No hardlink behavior is asserted. The oracle rejects a wrong expected parent,
a skipped record and an incorrectly claimed acceptance of the counterexample.

## Evidence and limits

[evidence/contract-final.json](evidence/contract-final.json) records the bounded
execution and fresh disk/RAM admission. The unchanged coordinator startup PASS
receipt is retained with its verified pin; startup was not replayed. Each
supervisor was invoked directly under the original unlimited DATA hard limit;
parent soft128MiB/hard unchanged, Python child128MiB and Git child256MiB remained
in force. No nested supervisor/configurator was executed.

No Boat, mount, Node, browser, game, kernel-mediated runtime or main/public
deployment ran. Mount argv validation and Node startup are inapplicable because
neither operation was attempted. Trusted Git SSH configuration is supplied by
the task supervisor. The sparse index was used without requiring or creating a
sparse-checkout file. Existing passing runtime evidence remains unchanged.

Remaining gates: production parent-inode repair, followed by separately assigned
kernel-mediated acceptance. The kernel may reject operations before callbacks;
these source-level observations do not establish mounted behavior.
