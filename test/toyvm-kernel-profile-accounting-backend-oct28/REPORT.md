# Invocation-owned FUSE backend, bounded source candidate

One fresh small Boat (`bx_qb3qpmqd`) supplies an actual working unprivileged
FUSE interface unavailable to the previous local-only assignment. Opening
`/dev/fuse`, mounting through installed `fusermount3`, and unmounting all
succeeded. The machine exposes Landlock ABI 4. No package was installed,
privileged mount attempted, denied old box resumed, or browser/guest/build run.

`fuse_backend.py` implements a real, in-memory filesystem over the kernel FUSE
protocol. File contents are stored and returned, not represented by synthetic
counter injections. The server serializes requests and reserves space before
replying to writes. It never offers writeback caching and returns DIRECT_IO for
regular file handles. Writable file mappings are rejected by the actual kernel.
Unsupported filesystem operations return EOPNOTSUPP without a fallback.

The storage contract is intentionally explicit: allocated space is a conservative
virtual-filesystem reservation of 4096 bytes per inode, plus dense file data
rounded to 4096 bytes. It is not a measurement of Python allocator arenas or
kernel memory. Those remain under the separate RSS guard. The backend stores
no backing files. Allocation remains charged while an unlinked or replaced
inode has an open handle. Allocation high water never decreases. Cumulative
bytes include every successful WRITE payload, including overwrite traffic,
and positive truncate growth. Allocation, cumulative and per-file overflow
latch a permanent failure before returning ENOSPC, so catching the error and
exiting successfully cannot qualify the invocation. Sparse-file requests are
conservatively charged as dense allocation. Limits are currently restricted
to tiny fixtures (at most 1 MiB), not production browser profile sizes.

`supervise_accounted.py` delegates execution/reaping and the original CPU,
RSS, wall/output decisions to the exact immutable supervisor. It checks the
independent filesystem ledger during execution and again after descendant
reaping. Missing status, a dead server and wrong source identity are errors;
ENOENT never means zero. Shutdown unmounts and reaps the owned server. Setup
exceptions retain their original cause and separate server stdout/stderr in
the attached cleanup receipt. The pinned supervisor retains its existing
combined fixture output contract; the operation guard and API preserve their
own stdout/stderr separately from creation through terminal cleanup.

Landlock by itself is insufficient: `probe_domain.py` actually writes 8192
allocated bytes through a memfd after an ordinary outside-path write is denied.
`confine.py` therefore combines Landlock write/mutation restrictions, closed
unexpected descriptors and a default-deny x86-64 seccomp policy. Anonymous
filesystem creation, imported descriptors, sockets/IPC brokers, ioctl,
unmediated metadata mutation, mounts, process-memory access and unknown
syscalls are denied. No-new-privileges and a zero core limit are retained.
The allowlist is a deliberately restrictive tiny-program policy. Networked
browser execution and writable mapped profiles are not supported or qualified;
expanding this policy needs independent security/resource acceptance.

## Targeted acceptance

The exact prior 13-check suite and immutable fixtures are retained unchanged
from parent `6405ff9c492732302dde9a5a79a8282d8dd7228e`. They pass on the fresh
Boat, preserving the original ENOENT counterexample, two unsafe-fix rejecting
controls, cleanup and RSS precedence. Its historical literal diagnostic
`BLOCKED_STRONG_ACCOUNTING_UNAVAILABLE` describes the old guard, not this
candidate. Its injected large metadata tests are not promoted to real-backend
allocation tests.

Twelve new checks pass on the real backend: unsafe backend rejection;
create/unlink-open; rename/replacement-open; rapid allocation overflow caught
by the guest; cumulative rewrite overflow; waited descendant writes; write
domain, rename-out and mmap controls; anonymous/IPC/ioctl/metadata/descriptor
import/unknown-syscall rejection; truncate cumulative growth; rapid completely
released allocation high water (32768 bytes written, 12288 peak, 4096 final);
literal SIGCHLD auto-reaping; and per-file overflow. Five additional checks
pass for dead backend, wrong supervisor pin, writable inherited stdio, setup
failure with retained stderr, and missing authoritative status (exact ENOENT).
The separate Landlock-only escape control also passes by rejecting that unsafe
configuration. Total: 18 new checks plus 13 unchanged diagnostics.

Final operation guards observed 63,438,848 bytes peak aggregate RSS for the
12-check group and 67,493,888 for the five error controls, below 128 MiB.
Conservative CPU sums were 1.80 and 1.12 seconds; walls 0.867 and 0.451 seconds.
All children were gone. Remote inventory charged 102400 bytes of retained
task files/directories, with no remaining task mounts, fixture roots or denied
escape targets. Add the retained virtual-file peak (at most 20480 bytes in
accepted fixtures), earlier tiny probe allocations and 8 MiB reserve: this
is comfortably within the 64 MiB incremental remote allocation. Staging used
small text archives only; no Node, Chromium, assets or Git history were copied.

Retained incidents: initial terminal reads exceeded the per-operation display
gate; the original inventory's Python ru_maxrss was inherited across API exec
and reported 401608704 bytes, so it is not a passing process-RSS receipt.
Subsequent forked/guarded operations measured actual aggregate current RSS.
The first default-deny policy omitted read-only newfstatat, causing Python
startup rejection; adding that read-only syscall repaired the owned policy.
Original failure stdout/stderr and exits are retained, not promoted. The final
groups use the corrected configuration. No claim of whole-task resource
compliance is made for the historical preliminary operations.

Supervisor SHA256 remains
`9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85`.
The measured kernel header is sealed in evidence (SHA256
`e51bdccbf4bc43b60353eb367a3aa4d25b31cafb23b06d3bd7ebb2e5bde8c75d`).
The authoritative handoff is
`scratch/usage-watch/toyvm-kernel-profile-accounting-backend-oct28/receipt.json`.

## Next decision

This is a bounded backend/source candidate, not ToyVM browser acceptance.
Independent review must accept the filesystem accounting definition,
confinement allowlist/descriptor closure, production caller wiring and lifecycle
on the exact commit before any browser use. Any required network/mmap support
is a new affected acceptance boundary; do not silently relax the policy.
The original 35.353183 CPU seconds, 101.495550694 wall seconds and one capture
remain untouched. Candidate browser bundle unchanged; full qualification false.
No main integration or public deployment is performed.
