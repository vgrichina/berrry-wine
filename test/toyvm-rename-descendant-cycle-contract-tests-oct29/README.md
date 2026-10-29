# Direct rename cycle contract — expected baseline FAIL

Candidate: `5a88ca099b962e946160afd2d4d71a950bf46db3`.
Actual production source: `test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py`
(10877 bytes, SHA-256 `e281eb058cee5e65797566c738d0330d2449ec6fe84572d572cfbf181c32ec41`).
No production files changed. No mount, Boat, kernel callback, or gameplay run.
The kernel may reject an invalid move before invoking this handler; these
results establish a direct handler defect only.

From the repository root, canonical required-contract command:

```sh
python3 -B test/toyvm-rename-descendant-cycle-contract-tests-oct29/contract.py --report test/toyvm-rename-descendant-cycle-contract-tests-oct29/baseline-results.json
```

Result on the pinned source: **exit 1; 8 PASS, 6 FAIL**. Failures are required
contract assertions, not expected-failure annotations or a passing reproduction
test. Observation-oracle selfchecks pass (16 mutations); independently runnable:

```sh
python3 -B test/toyvm-rename-descendant-cycle-contract-tests-oct29/contract.py --oracle-only
```

`baseline-results.json` records request bytes, actual/expected errno, full before,
after and expected nodes/names/links/opens/data, allocation state, inode allocator,
operation counts and root reachability. Cases for each opcode: move directory
into itself, direct child, deeper descendant (EINVAL22 and unchanged state),
move into unrelated sibling, move to root, move child to ancestor, and same-path
success. Controls assert exact resulting namespace and unchanged accounting.
Setup uses actual production create/open/write paths to retain nonzero handles,
opens, live, peak and written counters. No TYPE/UNLINK/RMDIR contract replay.

The supplied unchanged reproducer was run first against the exact source pin:
create root/A inode2, A/child inode3 using production `create`, then call
`handle(12, 1, struct.pack('<Q', child) + b'A\0moved\0')`.
It returned `b''`; root names changed from `{b'A': 2}` to `{}` and child names
from `{}` to `{b'moved': 2}`. Live/peak stayed 12288, written stayed 0, and
operations changed 0 to 1. The separate diagnostic assertion confirmed that
mismatch (exit 0); it did not establish contract acceptance. Its supervisor
receipt is `/tmp/toyvm-rename-descendant-cycle-contract-tests-oct29/e/reproduce-unchanged.json`.

Diagnosis: handler op12/op45 reads `newdir` at byte 0, takes names at byte 8
for op12 or byte 16 for op45, and checks op45 flags at byte 8. Requests use
`<Q` and `<QII` respectively, with both flags and padding zero for op45.
After source/name/replacement validation it executes
`dest[new] = source.pop(old)` without checking whether newdir is the source
directory or one of its descendants. This deletes the reachable root edge and
inserts an edge into that directory's own subtree, forming an unreachable cycle.
The extended fixture loses root reachability of inodes 2, 3, 4 and 6 while
retaining all nodes and charges. EINVAL must precede any namespace, replacement,
link, open, or accounting mutation. Normal same-path remains success.

Serial repair gate: source owner adds ancestor detection, then reruns this
unchanged suite with `--expect-sha256 REPAIRED_SOURCE_SHA256`. The source pin
override is explicit so the baseline identity remains auditable. Required result
is all 14 cases passing, with the eight current controls continuing to pass.
No repair, main merge or public deployment is authorized by this task.

Host execution uses the supplied task-owned `ops.py`: fresh disk/RAM admission,
128 MiB Python DATA, 256 MiB Git child DATA only, inherited parent hard DATA
unchanged, 90 CPU seconds, 120 wall seconds, 12 MiB file, 2 MiB capture,
128 MiB physical parent RSS and 512 MiB process-group RSS. All five dispatch
source pins were verified before tests. Supervisor receipts remain under the
task-owned `/tmp/.../e/` directory; retained contract evidence is committed here.
