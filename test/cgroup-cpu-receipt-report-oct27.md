# Invocation-isolated kernel CPU diagnostic candidate — 2026-10-27

Bounded cooperative-fixture acceptance PASS. Diagnostic candidate only: no
production installation, build authorization, independent review or integration.
Historical conservative CPU105.48018 >90 remains REJECTED; prior modules remain
UNQUALIFIED. No reconstruction establishes that historical unique CPU was below90.

## Cause and measurement boundary

The predecessor's ancestor wait4 receipts lose CPU when a descendant sets
SIGCHLD=SIG_IGN and lets children auto-reap. An invocation-isolated cgroup-v2
cpu.stat retains this departed descendant CPU. The candidate is a separate helper;
it neither edits nor replaces any enforcing supervisor or conservative metric.
The trusted supervisor is executed from its original path, pinned SHA256
9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85.
Default CPU90/wall120, RSS128MiB for these small Python fixtures, file24MiB,
output2MiB and existing disk/process cleanup controls remain authoritative.

The helper resolves /proc/self/cgroup against a verified root-mapped writable
cgroup2 mount, creates one exclusive UUID child of its current delegated scope,
and records uid/device/inode, zero initial CPU and empty membership/events.
A fresh fork child sends readiness and blocks on a pipe. Only that child is
attached. Parent verifies exact membership and PID/start identity before releasing
the barrier; the child verifies membership before exec. No fixture or invoked
supervisor can execute before release. The exec imports and runs the exact trusted
supervisor, so its startup, sampled work, waits, final output and exit are included.

The kernel measurement starts at the new group's initial counters and ends after
the measured supervisor has been waited and cgroup.events reports populated=0.
Final ownership and monotonic CPU counters are verified and retained; removal is
nonrecursive rmdir of the owned empty group. A failed removal prevents a finalized
receipt. No parent subtree_control/controller/limit/ownership/permission was changed.
No coordinator, client, existing supervisor or other preexisting process migrated.
The nested-cgroup fixture creates/removes its own empty subgroup, attaches only
its fresh barrier-held fork child and never adds subgroup counters to parent CPU.

Pre-attachment bootstrap CPU is outside this boundary. Its pre-barrier self-rusage
sample is recorded, but excludes reporting/blocking tail and is not an exact full
outside-lifetime total. Observer self CPU is separately measured. Neither is added
to invent a whole-invocation total. For ordinary waiting fixtures the outer wait4
includes bootstrap CPU; that independently observed difference is retained.

## Evidence and limits

| Fixture | Kernel CPU(s) | Independent outer wait4(s) | Difference(s) |
| --- | ---: | ---: | ---: |
| flat | .342199 | .342669 | -.000470 |
| nested waiter | .380254 | .380640 | -.000386 |
| short-lived between polls | .188823 | .189176 | -.000353 |
| simultaneous siblings | .876854 | .877239 | -.000385 |
| SIGCHLD auto-reap | .439227 | .188904 | +.250323 |
| orphan/detach adoption | .365673 | .366033 | -.000360 |
| killed descendant | .213219 | .213571 | -.000352 |
| nested supervisors | .551569 | .552047 | -.000478 |
| nested cgroup | .331795 | .332191 | -.000396 |
| synthetic rejection control | .122759 | .123276 | -.000517 |

The auto-reaped child independently reports at least .25 own process CPU seconds.
Kernel CPU exceeds incomplete outer wait4 by .250323s and includes the measured
supervisor's own CPU. Ordinary wait-propagating fixtures agree within .52ms; nested
work is counted once. At least one short child is proved absent from the trusted
supervisor's proc inventory despite its retained kernel CPU. No90-second burn ran.

Both comparison counters are kernel microsecond accounting, not proc tick samples.
The test allows60ms for outside bootstrap and kernel counter flush/batching; this
is a bounded local fixture tolerance, not an arbitrary-workload error guarantee.
The auto-reap control demands kernel CPU >= self-burn + supervisor own-at-print
minus10ms, and lost CPU difference within60ms of the independently measured burn.
The unchanged flat/nested duplication reproducer and unchanged auto-reap reproducer
ran FIRST under trusted limits; existing predecessor acceptance groups were reused.

Eight mutation controls reject missing/changed ownership, pre-attachment execution,
invalid/nonmonotonic counters, premature populated state, failed cleanup, and missing
supervisor membership. They suppress the finalized number. Real pipe/membership
checks accompany these synthetic receipt mutations. The original synthetic100CPU
observation still reaches the actual unchanged aggregate CPU limit rejection even
when the diagnostic kernel CPU is .122759s. A smaller diagnostic never clears a
trusted rejection. Diagnostic finalization does not imply command acceptance.

Cooperative assumptions: these audited, pinned fixtures and their descendants
remain in their owned group/subgroups, do not write ancestor/sibling cgroup controls,
do not create outside helpers, and have no interfering same-UID external process.
UUID creation and pid/start/barrier verification establish initial invocation
ownership, not hostile containment. Same-UID migration out remains possible and
cannot be excluded for arbitrary workloads by polling. Every diagnostic retains
invocationCompleteness=UNKNOWN; kernelCPUSeconds is only the finalized kernel-group
boundary. This task closes the demonstrated auto-reaping accounting loss under
these bounded assumptions, not general whole-invocation completeness.

## Retained incidents and publication

Canonical evidence: /tmp/airstrike-cgroup-cpu-receipt-oct27/ops/receipt-manifest.json.
The compact checks-checkpoint.json pins exact source and fixture receipts; explicit
pinned reuse is required. Fresh tests use a fresh output directory:

    python3 -S test/cgroup-cpu-receipt-oct27.py checks OWN_EMPTY_OUTPUT_DIRECTORY

Execution must still be placed under trusted outer admission/supervision. The owned
run.py adapts the authorized donor wrapper without executing/overwriting donors.
It measures checkout/Git, launcher/events/session and conservative full shared WAL
once (no initial baseline), prospective176MiB including32MiB reserve, aggregate
remaining client growth,768MiB child and805306368-byte host headroom before commands.
It preserves90CPU/120wall,24MiB files/2MiB output; Git DATA512MiB applies only to Git
children. The512MiB task allocation and projected host floor remain enforced.

First setup missed one explicit sparse helper pattern, then corrected it; Git's
deep donor alternate-chain diagnostics are retained. First focused test misparsed
cgroup.events with CPU-required fields before any fixture; the empty group was
verified and removed under a distinct cleanup receipt. A later nested-wrapper run
hit unchanged128MiB RSS (143917056B), was rejected and cleaned by the trusted guard.
Its final empty UUID group/counters and actual removal are retained separately;
no finalized CPU is claimed for that interrupted attempt. The fixture removed one
redundant Python subprocess via exec and used -S harness startup, without raising
limits. The remaining three groups passed at124256256B peak RSS; seven completed
unchanged measurement groups were reused. Helper edits between those groups added
only write-ahead evidence persistence. Pinned reuse/control validation passed.
Original failures and stderr are preserved, not relabeled as passing attempts.

Read-only donor a5fb7afa75f36efaed88cbc8c76802ff62b4c0dd and coordinator-verified
predecessor manifest SHA795bd0229d5aab72b5508f87a79c2dbffb2cffd4712e7040ec6251a06663cf27
are reused; no entire payload sweep. Checkout is sparse with read-only local object
alternates, no clone/fetch/repack. Only the assigned task branch is published, with
strict dedicated SSH identity/known-hosts and Git flock. Root/donor refs/index/tracked
files remain read-only; board updates append-only. Root's initial streaming ref
receipt is reused; no full ref listing. No mount argv, Node, guest/browser/module
build/instantiation or Boat invocation is applicable. No box assigned. Coordinator
owns independent review, production decisions and any later build/runtime lifecycle.

Publication setup incident: initial commit failed because the isolated repository
had no author identity. An incorrectly unguarded dependent push then created the
assigned remote task branch at the unchanged donor commit. This is retained as a
sequencing failure, not candidate publication. The worker reused the donor's
configured Wine Ops identity for its subsequent local commit and verified the
final fast-forward remote SHA separately. No main ref changed and no force push
was used. Initial instruction/source reads also exceeded the requested per-operation
terminal8192B ceiling; these setup reads are a workflow deviation, not compliant
bounded operation receipts. Later operational commands retain bounded output.
