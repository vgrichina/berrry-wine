# Additive CPU receipt candidate — 2026-10-27

**INCOMPLETE / UNKNOWN finalized unique CPU. Do not install or use for production.**
The bounded candidate retains useful disjoint reap evidence, but cannot prove a
complete unique subtree receipt for arbitrary commands under the available
controls. Independent acceptance remains pending. No build or runtime is
authorized by this candidate.

The historical build rejection remains binding: conservative CPU105.48018 >90,
with no contemporaneous unique accounting. Canonical and compatibility modules
remain UNQUALIFIED. This task neither reconstructs their unique CPU nor accepts
their emitted artifacts. It made no change to the trusted supervisor in place,
its authoritative CPU quantity, its allowances, or production source.

## Candidate and unchanged enforcement

`helpers/palette-browser-supervisor-candidate-oct27.py` is an owned copy of the
trusted supervisor SHA256
`9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85`.
Only the four additions recorded in `helpers/unique-cpu-additions-oct27.json`
differ. The focused test removes those exact additions and reproduces the
trusted SHA, verifying all original enforcement statements, stop reasons,
CPU90/wall120 defaults, RSS/output/file controls, disk-check hook, pidfd
signaling, subreaping and cleanup remain intact.

The additive `uniqueCPUReceipt` is never read by enforcement or acceptance.
`helpers/unique-cpu-evidence-oct27.py` retains only successful direct/adopted
`wait4` usage as candidate disjoint subtree evidence. It does not sum sampled
own CPU, subtract presumed overlap, remove waited CPU from enforcement, or
combine nested supervisors' diagnostic JSON. Supervisor own-only interval CPU
comes from `RUSAGE_SELF`; startup/finalization outside that interval is excluded
explicitly. A configured bootstrap has no proven finalized own-only lifetime
bound and adds a specific incomplete reason. No bootstrap CPU is guessed.

Every finalized receipt has `status: incomplete`, `uniqueCPUSeconds: null`,
`diagnosticOnly: true`. Its observed subtotal is **not** a complete unique total
or an alternate pass criterion. Validation rejects duplicate identity reaps,
missing/invalid usage, reap-sum disagreement with supervisor
`RUSAGE_CHILDREN`, preexisting children, nondefault supervisor SIGCHLD,
remaining direct children and incomplete cleanup. PID identity is `(pid,start)`;
reuse of a PID with a different start is distinct.

## Precise completeness blocker

A descendant can set SIGCHLD to SIG_IGN (or use SA_NOCLDWAIT), run children and
allow the kernel to auto-reap them. Their CPU need not propagate into the
ancestor's eventual `wait4` usage. They can disappear before a proc sample and
never become adoptable children. The supervisor cannot prove their absence
using proc sampling, its own reaps, or its own `RUSAGE_CHILDREN` cross-check.
That cross-check can agree while descendant CPU is missing. An independent
outer wait4 has the **same propagation limitation** for this workload.

The executable auto-reap fixture independently reports its child's own
`process_time()` burn (at least0.25s). The final accepted diagnostic run records
only0.043771s of root reap CPU; outer wait4 minus measured monitor own lifetime
records0.053193s. Thus declaring either a complete unique metric would undercount
the known child burn. The receipt correctly remains unknown even though the
reap consistency checks agree. Merely testing ordinary waiting workloads is
insufficient to establish completeness.

A complete receipt would require independently enforced/proven lifetime
ownership, wait propagation for every descendant, no auto-reaping or external
reaper/ownership escape, exclusive supervisor waits, full cleanup, pinned reap
identities, and finalized own-only supervisor/bootstrap overhead. These
conditions are not established for arbitrary commands here. Invocation-isolated
kernel CPU accounting could address the missing evidence if separately
authorized and available; this task did not access cgroups, change permissions,
bypass restrictions, or add an opt-in override that asserts completeness.

## Bounded verification

The unchanged `census-cpu-accounting-review-oct27.py` ran first, retaining its
original pin and reproducer bytes. Flat conservative CPU1.436972 versus outer
wait4 CPU0.861619, nested2.136582 versus0.937759, again demonstrate duplicate
charge. This does not prove the historical build rejection false.

The focused final suite passed under the unchanged trusted outer supervisor,
CPU90/wall120, aggregate128MiB RSS, file24MiB/output2MiB and task disk/memory
controls. Outer peakRSS109182976 bytes, charged CPU16.752114s, exit0,
stopReason null, cleanupComplete true. Fixtures are small; no90CPU burn,
module compilation/instantiation, full build, guest/browser, Boat or Node ran.

For ordinary waiting fixtures, an independent outer Linux wait4 measures the
entire monitor subtree. The inner monitor separately records its full own-only
CPU at print, including import/startup. Subtracting that measured own-only
component, not guessed overlapping descendant CPU, leaves the candidate reap
subtotal plus the final print/exit tail. The retained residuals are:

| Fixture | Reap subtotal(s) | Outer minus measured monitor own(s) | Print/exit residual(s) |
| --- | ---: | ---: | ---: |
| flat |0.257433|0.265980|0.008547|
| nested waiting parent |0.290616|0.301620|0.011004|
| short children |0.150576|0.161123|0.010547|
| concurrent siblings |0.816340|0.828089|0.011749|
| detached/orphan adoption |0.242533|0.252797|0.010264|
| killed descendants/cleanup |0.139495|0.149599|0.010104|
| nested wrapper supervisors |0.477617|0.490107|0.012490|

The bounded fixture tolerance is60ms for the measured final print/exit tail;
actual residuals are8.5–12.5ms. This is a local measurement tolerance, not a
universal completeness claim. Both sides use kernel rusage rather than sampled
proc ticks. The much tighter internal reap/rusage consistency tolerance is10us.
The short-child check proves at least one child entirely escaped the owned proc
inventory, yet its waiting parent supplies aggregate reap evidence. Detached
children use setsid/double-fork; cleanup kills a live detached descendant.
The nested-wrapper check requires exactly one outer reap and never adds inner
reported CPU to it.

Rejecting controls cover synthetic PID reuse, duplicate identity charge,
deleted usage, inflated usage against independent kernel cross-check, explicit
missing usage, cleanup failure and bootstrap uncertainty. The real original
check-hook rejection remains rejected by trusted and candidate helpers. A
synthetic100CPU observation also exercises the actual unchanged default90CPU
branch in each helper without spending90CPU: both retain `aggregate CPU limit`,
even though the candidate diagnostic subtotal is below1s and never becomes a
unique total. No original rejection can become acceptance through the additive
field.

## Retained failures and publication evidence

Owned evidence is `/tmp/airstrike-unique-cpu-receipt-repair-oct27/ops/`:
canonical `receipt-manifest.json`, compact `checks-checkpoint.json`, per-command
admission/supervisor/stdout/stderr and publication receipts. The initial two
focused attempts exceeded the original128MiB cap (149159936 and137101312B),
were rejected and cleaned up. The harness removed a redundant Python wrapper
and changed flat-burn children to small `python -S -c` processes; no cap was
raised. The next attempt fit109182976B but caught a test assertion that failed
to separate monitor overhead for the auto-reap control; its stderr is retained.
The corrected final assertion uses measured monitor own CPU. Initial setup
also encountered an absent `python` alias and an overly broad diagnostic search;
those are documented in `launch-configuration.json` without changing donors.

Verified donor commit `fa4e1642c32dea08b03f6d64d3d4ddcfd9722453` and coordinator-
verified manifest SHA256
`457b9b3150c944600c158e078c6e9650ade7eb172afeb1631c1c8d74267d1c58`
are reused unchanged; no repeated payload sweep. Checkout used narrow sparse
patterns before checkout and read-only local object alternates, no clone,
fetch or repack. Root/donor tracked files/index/refs remain read-only; only the
shared append-only board is written. The streaming initial root-ref receipt is
reused without capturing a ref listing. No mount argv exists to parse, and no
Node startup or guest launch is applicable. Strict pinned Git SSH configuration
is retained in each admission. Publication is only the assigned task branch;
no main integration. No test box was assigned/accessed; coordinator retains
runtime lifecycle and the next task decision. Worker stops at this incomplete
candidate, focused diagnostic evidence and branch publication.
