# Mounted production CLI RENAME qualification, 2026-10-29

One invocation of the unchanged `qualify_accounted.py --domain tiny-fixture`
passed six mounted syscall cases against the five integrated production sources
pinned in manifest.json. No baseline/quota group was replayed. Production source
was unchanged before and after execution. No browser or gameplay acceptance.

| Case | Observed result | State |
| --- | --- | --- |
| File replaces directory | EISDIR (21) | unchanged |
| Directory replaces file | ENOTDIR (20) | unchanged |
| Absent destination parent | ENOENT (2) | unchanged |
| Nondirectory destination parent | ENOTDIR (20) | unchanged |
| Directory into its descendant | EINVAL (22) | unchanged |
| Same file path | success | unchanged |

Each case snapshots the complete mounted tree, inode/type/link/size identities
and file bytes immediately before and after os.rename. The initial tree and
ordered per-case errno/state/digest records are retained in the authoritative
caller's base64 output in guards.json. The fixture stops at its first mismatch;
no unexpected mismatch occurred. Four offline altered-receipt controls were
rejected, including an erroneously successful rejected rename. These controls
test the evidence oracle, not a modified production backend.

The source-derived budget uses six metadata blocks (root, three directories,
two files) and two dense payload blocks: live/peak 32768 bytes, written 26,
inodes 6. Final backend counters match exactly; no allocation failure and no
open handles. Limits were live262144/write32768/file32768, payload RSS64MiB,
CPU10s/wall20s/output8192. Reported payload peakRSS36962304, CPU0.189252s,
wall0.135406248s. The external group peaked at51380224 bytes.

The external observer saw an actual fuse.toyvm-accounting mount owned by uid1000
at /tmp/tvmr/work/domain. Caller cleanup reports unmount exit0, server exit-15,
empty stderr, no remaining mounts; observer found no work-path processes.
Cheap preflight opened /dev/fuse, loaded libfuse3, checked Landlock ABI4,
proc/FD/seccomp, Python identity/executable, a26-byte AF_UNIX pathname and
MemAvailable3202215936. The production argparse parser accepted --help; exact
caller argv is retained. There are no emulator --mount/--vfs-tree arguments or
comma-bearing fixture filenames. The fixed fusermount argv is in contract.json.
No Node executable was run, so no Node startup configuration was applicable.
Environment evidence records the explicit PYTHONDONTWRITEBYTECODE=1 setting;
the complete inherited environment and its digest were not retained. No full
environment reproducibility claim is made.

This is mounted syscall contract evidence. Kernel VFS path/type/cycle checks
can reject before a FUSE RENAME callback; same-path can short-circuit. The
unmodified backend exposes no per-opcode trace. Consequently this test does
not establish execution of every backend RENAME branch or exclusive backend
responsibility for the rejection. No manually called backend method stands
in for namespace mutation; only the constructor was used locally to source-check
the exact quota parameters before runtime.

Evidence was copied locally before delegated snapshot-stop. Boat bx_xkgx2pm3
is stopped with verified snapshot, operation stop_feab780ac9300803 completed
2026-10-29T23:43:37.109Z, before the00:02 guest cutoff/00:06 shutdown checkpoint.

Recovery: retain the five files listed in manifest.json at their exact repository
paths; copy this observer/fixture/manifest plus the original cancellation receipt
SHA543b076948699e1607179782b472f4863125064cdfa3a4632351e8a1f6ed7870 under
/tmp/tvmr. The original receipt is an identity prerequisite, not a fresh browser
acceptance. Observer preflight then guards uses INLINE /usr/bin/python3 -B -c
and absolute mount paths. Do not rerun completed groups without new authorization.
verify.py can verify retained guards.json and rejecting receipt controls offline;
run with PYTHONDONTWRITEBYTECODE=1. Observer is recovery code, not an instruction
to restart the stopped Boat. Coordinator owns subsequent lifecycle assignments.
