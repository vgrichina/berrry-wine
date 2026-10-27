# Independent kernel-group CPU acceptance — 2026-10-27

ACCEPT the bounded additive diagnostic in candidate
`ed8d8279793fbf076335e42120dd00c676f25d9e`. It measures one fresh kernel cgroup
from zero counters through verified empty final membership, includes the attached
trusted supervisor, and finalizes only after successful removal of the owned empty
group. This is not whole-invocation CPU, hostile containment, production installation,
a changed enforcing metric, or new build authority.

Helper SHA256 `ddd770715ff69dea7e42c14f8760553da5403dc81105310622710b07c5229ac3`;
harness SHA256 `1e179c6316850960a5fccfe9d653c7b0a6869165adb6a3831541085e70e8ef15`.
Trusted enforcing helper remains exactly
`9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85`.
CPU90/wall120 remains authoritative. Historical conservative CPU105.48018 remains
REJECTED and prior modules UNQUALIFIED. A smaller diagnostic cannot clear rejection.

## Boundary-first evidence

Source inspection preceded behavioral execution. The fresh fork blocks on a pipe
before any supervisor/fixture exec. The parent attaches only that child, verifies
/proc membership and singleton group membership, then releases it. The child checks
its membership again before exec. The supervisor imports the pinned trusted guard
inside the group. Its startup, child execution, waits and exit are kernel-accounted.
The bootstrap PID/start token is recorded, not reread after attachment; the child
remains unreaped and pipe-held at this boundary, so PID reuse cannot occur here.

First behavioral verification was the unchanged `unique-cpu-receipt-oct27.py
measure auto-reap` reproducer under the unchanged trusted guard. Initial attempt
exposed a sparse dependency omission; its stderr is retained. Adding the exact
unchanged dependency made it pass. Fresh final-helper measurement then captured
0.491926 kernel CPU seconds against 0.241779 outer wait4 seconds; the auto-reaped
child reported 0.250154459 own CPU seconds. Supervisor own CPU is included, and
all enforcing wrappers exited cleanly with complete descendant cleanup.

The coordinator-verified 161-payload canonical donor manifest is reused unchanged:
`/tmp/airstrike-cgroup-cpu-receipt-oct27/ops/receipt-manifest.json`, SHA256
`8edae8128dcfb84b171ee5b7596814d4d1a2e8084abd744d2dd6bd69f1cf9dff`.
No unchanged flat/nested/short/siblings/orphan/killed/wrapper/subgroup/rejection
measurement group was replayed. Those retained groups establish hierarchical
parent cpu.stat accounting without adding subgroup counters and retain short-lived
children missed by proc polling. Final helper never sums subgroup counters.

I reconstructed the actually executed earlier helper from retained command events
using constant-only AST interpretation, never executing donor commands. Its SHA256
is `475c804bff9feeeeb3dbb90d79c486616e44628825a35ecffb703e93ff1ae817`.
Exact comparison with the final pinned file proves precisely two added write-ahead
JSON evidence writes. The source diff and reconstruction script are retained.
These add outside observer persistence work; they do not change the group CPU
calculation, exec barrier, or finalization. Earlier measurements are observations
of their earlier invocations, not newly claimed measurements of final invocations.
The first comparison failed because my heredoc extractor retained its `PY` delimiter;
correcting only that extraction produced exact equality. Both receipts are retained.

## Independent adversarial results

- A real fresh fixture migrated itself into a fresh owned sibling group, burned
  0.250992222 CPU seconds, and exited. The measured group finalized at 0.136615,
  the sibling accumulated 0.255189, and outer wait4 observed 0.392293. The diagnostic
  correctly still reports invocationCompleteness UNKNOWN. Every migrated PID and
  both groups belonged to this fixture; no existing process or parent control moved.
- An injected attachment PermissionError and an actual attachment into a wrong
  fresh owned group both stopped before barrier release. Child exit124, no fixture
  marker, no finalized diagnostic, and owned empty groups removed were verified.
  The injected denial tests error handling; it is not a claim of platform denial.
- Changed inode, populated final events, failed removal, duplicate counters,
  regressing counters and missing supervisor membership each suppress the number.
  An owned symlink fails the actual lstat-based directory identity check.
- Final counters follow supervisor wait and populated=0; identity is checked against
  initial device/inode/uid, then the group is removed nonrecursively. A populated or
  replaced group is not accepted or recursively removed. Error paths preserve the
  causal receipt and may need explicit owned-process reap/empty-group cleanup,
  which the independent failure fixtures performed.

Path checks are pathname-based snapshots, not open-fd authority against a hostile
same-UID actor. Polling cannot exclude migration out and back, outside helpers or
interference. Pre-attachment bootstrap CPU and outside observer CPU also remain
outside the finalized group interval. Initial rusage is not a full bootstrap total.
These are real completeness gaps, explicitly permitted by the cooperative bounded
claim; the escape proves why they cannot be promoted to invocation completeness.
No defect in that bounded claim was reproduced.

## Decision and specific next step

This acceptance permits reuse of the kernel-group diagnostic as supporting evidence
only. It permits no immediate build decision under unchanged controls: even a
complete future diagnostic could not override the authoritative conservative guard.
Historical CPU cannot be reconstructed from these new fixtures.

A concrete next justified task is a bounded source-level compiler cost reduction
at `tools/build-compile-wat.js:172`: the canonical tail and compatibility artifacts
invoke compileClosure separately. Determine whether any immutable front-end work
can safely be shared, accounting for the compatibility VFS transform; implement
only a demonstrated reusable stage and compare both modes' exact bytes and errors
on small existing fixtures under unchanged controls. This is a specific candidate
cause-changing path, not a measured historical bottleneck or promised speedup.
Only an independently accepted real reduction with preserved build gates can
justify a separately admitted changed-source build, still required to pass the
unchanged CPU90/wall120 guard. If no safe reduction exists, report that blocker.
Do not replay the unchanged rejected full build or use its emitted modules.

## Preservation and lifecycle

Own sparse checkout and flattened read-only local object alternates only; no
clone/fetch/repack, main, guard edits, builds, module instantiation, Node, guest,
browser, mounts or Boats. Mount argv is empty; mount parser/runtime launch is
inapplicable because this task performs no mount operation. Strict dedicated Git
SSH identity/known-hosts configuration is retained. Git DATA512MiB applies only to
Git children; each dependent operation has fresh complete-footprint/remaining-client
growth admission, trusted enforcement, distinct bounded stdout/stderr, and pool/flock.
512MiB allocation includes prospective growth and32MiB reserve; host floor and
aggregate RAM headroom remain enforced. No box is assigned; lifecycle stays with
coordinator.

The donor's original sparse/parser/RSS rejection, missing author/unguarded initial
donor push, and oversized setup-read incidents remain in its report and canonical
manifest. This review also retained its initial alternate-depth checkout failure,
sparse dependency failure, source-extractor failure, and initial setup reads that
exceeded the requested8192-byte terminal ceiling. Later operational output is
bounded. No failure was overwritten or relabeled as passing. Task Git identity was
configured before publication; a push depends on successful commit and exact
remote verification. Tracked report/reproducers and bounded evidence provide remote
recovery; the own ops canonical manifest/checkpoint bind the originals.

Recovery: retrieve this task branch, retain the immutable donor object store and
trusted helper at their recorded paths, and restore the tracked evidence directory
into the recorded own ops directory. Use fresh distinct receipt labels/output paths;
`auto-kernel.py` and `adversarial.py` are the independent reproducers. Run them only
through a copied/adapted own wrapper after fresh admission, not by executing donor
wrappers. Their absolute fixture paths intentionally bind this reviewed setup.
The adversarial script's final edit only removed an always-true dead assertion;
its substantive measured fixture and assertions are unchanged. No replay was needed.
