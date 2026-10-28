# Transient profile accounting: reproduced, repair blocked

The exact rejected callback has an enumeration/stat race. `check()` in the
diagnostic donor's `guard.py` first calls `Path.is_file()` while building a list,
then independently calls `Path.stat()` when summing logical lengths. Unlinking
`.org.chromium.Chromium.hbL1Tj` between those operations deterministically raises
ENOENT. The pinned production supervisor converts this into `accounting check
failed`, terminates owned children and retains rejection. This is a correct
fail-closed response to an unknown sample. No failed limit is increased, and the
previous rejected browser diagnostic remains rejected.

No production correction is published. The stronger required accounting cannot
be established through the existing pathname-sampling callback. A whole-sample
retry, even bounded and using non-following fd-relative traversal, can accept a
later empty tree while an unlinked file remains open and allocated. The test
holds such a descriptor: 8192 logical/allocated bytes, zero links, successful
empty retry. A rename out of the root followed by replacement has a similar
gap. The old callback also follows symlinks outside its root. This report does
not substitute or approve that behavior.

An instantaneous pathname sum is neither whole-invocation cumulative bytes nor
true peak allocated footprint. Creating, writing and deleting a file wholly
between samples yields the same two pathname observations as doing nothing.
Retaining previously observed maxima cannot charge an inode never observed.
`st_size` is logical length; `st_blocks*512` is allocated size. Neither provides
the missing history. Host free-space sampling may include open-unlinked blocks
but cannot attribute them to this invocation or establish its individual cap;
concurrent frees and between-sample peaks remain invisible. A `/proc` fd scan
would itself be a sampled observation and cannot prove complete write history.

The helper's existing `AllocatedDisk` explicitly documents that its bounded
consistency observations are not a snapshot or quota. Substituting that helper
would improve path safety but would not satisfy the stronger requirement.
Blanket ENOENT ignore and whole-sample retry are both rejected by a test oracle
using the held descriptor's ground truth. That oracle is diagnostic; it is not
a proposed production accounting source.

## Evidence and scope

Base: `0911cf213d1424b94758958868b905fe9b42ec95`, diagnostic donor branch
`task/toyvm-capture-cancellation-qualification-oct28`.

`pinned-guard.py` is byte-identical to the executed callback source (SHA256
`c332e1d3ee0e9a0c47af78e9be0638eafc522e93251bc1a507902094d4a8992f`).
`pinned-supervisor.py` is byte-identical to the specified trusted supervisor
(SHA256 `9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85`).
These files are forensic inputs. Do not execute the guard's top-level body.

Run `python3 -B test/toyvm-transient-profile-accounting-repair-oct28/test_accounting.py`
from a recovered checkout under the prescribed source-test limits. The script
extracts and compiles the unchanged `check()` AST only; it substitutes a clock
before the expired cutoff so the resource branches are reachable. No browser
wrapper, guest, build, Node guest runner or qualification group is invoked.

Thirteen deterministic checks pass: stable file; real enumeration/stat unlink;
permission failure; aggregate and per-file over-limit rejection; held-unlinked
inode; rename/replacement; escaping symlink; missed between-sample peak;
two unsafe-fix rejecting controls; exact production supervisor error/cleanup;
and RSS rejection precedence. Large-size gate tests inject stat metadata for a
tiny persistent file; they do not allocate or write over-limit fixtures. All
real fixture files are at most 8192 bytes. Two short Python children exercise
the exact production supervisor. Unchanged CPU, RSS, wall, output, file and disk
controls, aggregation, cleanup and rejection precedence remain untouched.

## Required next decision

Reject runtime resumption and independent runtime acceptance of this proposed
repair: there is no repair candidate to accept. A separately assigned design
must first define and supply authoritative accounting for the invocation's
entire storage domain, including open-unlinked and renamed files, and distinguish
allocated-footprint enforcement from cumulative writes. A kernel-enforced
invocation-owned quota/domain with appropriate retained write accounting is a
possible prerequisite, not an available or tested facility in this task. It
would still need independent source and resource acceptance before runtime.
Changing the requirement to sampled pathname bytes is a user decision and was
not assumed.

No browser allowance was consumed: remaining 35.353183 CPU seconds,
101.495550694 wall seconds and one capture are unchanged. Full ToyVM
qualification remains false; natural mouse pointercancel remains unseen.
Candidate bundle unchanged. No Boat assigned or lifecycle operation performed;
previous `bx_266epr5b` stays stopped. Coordinator retains lifecycle ownership.
