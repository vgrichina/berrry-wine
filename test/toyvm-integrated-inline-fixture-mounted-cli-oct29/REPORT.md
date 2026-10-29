# Mounted production CLI: inline fixture counterexample

Case 1 failed its positive acceptance oracle. Case 2 was not run. No source
repair, quota adjustment, replay, browser/game execution or main integration
was performed.

The unchanged production CLI at candidate
`52188f87d6e71949f9affd8d70083a054b2d12af` ran on task-owned Boat
`bx_45szpq2q` using supported Boat API exec. Its child used `/usr/bin/python3
-B -c` with the original 170-byte fixture text as one argv element and target
`/tmp/tvic/work/domain/f1024 1024`. All five production hashes, the Python
binary, original cancellation receipt and fixture matched the dispatch pins
both locally and remotely. The actual argv is preserved in `case1.json`.

The CLI exited 1, accepted=false, childSucceeded=false, accountingAccepted=false.
The backend reported `filesystem allocation limit`, child exit -15, live=8192,
peak=8192, written=0, inodes=2, openHandles=0 and seven filesystem operations.
The fixture completion marker was absent. This is a mounted runtime
counterexample, not a positive acceptance or a startup-denial replay.

The accepted backend charges 4096 bytes for the root inode and 4096 for a newly
created file. Its `resize` charges dense payload in 4096-byte blocks. Therefore
the first nonempty payload requires 12288 live bytes including metadata,
exceeding the prescribed live limit of 8192. This source interpretation explains
the observed authoritative failure. No exact failing syscall, observed errno,
historical FIOCLEX cause, policy-layer attribution or instantaneous-accounting
claim is made. The source-only filename diagnosis remains unproven historically.

Cleanup was established by the authoritative receipt (cleanupComplete=true,
unmountExit=0, serverExit=-15, remainingMounts=[]), and the observer found no
remaining mounts or processes bearing the owned work path. This process scan
is additional evidence, not a replacement for the supervisor's tree receipt.
The backend receipt's peakRSS was 34603008 bytes, CPU 0.072371 seconds, wall
0.058563 seconds. No child output was retained by the backend.

Remote preflight verified Landlock ABI 4, opened the real `/dev/fuse` character
device, loaded libfuse3.so.3, checked proc facilities, and ran the pinned CLI's
actual argparse help without workload. Seccomp status before confinement was
0; the unchanged confiner installs its own filter. Observer and all five source
files passed syntax parsing. No tracing or policy modifications were used.
No local checkout or filename-list/tree mount was needed: only the five files,
receipt, fixture, observer and hash manifest were transferred using Boat's
`--file` parser. The production FUSE mount argv is recorded in preflight;
its actual execution and unmount are evidenced by the case receipt. There was
no separate dry-run invocation of the fusermount parser before runtime.

The supervisor retained its supplied limits, per-operation admission checks,
owned cwd and exact trusted GitHub SSH configuration. Initial policy/supervisor
bootstrap reads used direct read-only Python before the supervisor was fully
read; subsequent commands used the supplied supervisor. One required-document
read initially used a nonexistent relative path in the sparse checkout and
was corrected to the absolute read-only path. These were not workload retries.

Boat was created at 2026-10-29T18:27:10.474Z with ttl1800 (actual initial expiry
18:57:10.510Z, later than the coordinator's scheduled 18:54:44Z expiry).
The earlier scheduled cutoff and shutdown remained controlling. Under the
task's explicit snapshot-stop delegation, stop was requested at 18:27:37.243Z;
snapshot was completed and verified at 18:28:06.589Z and state stopped was
verified. `lifecycle.json` retains the exact timestamps. The box was not deleted.

`checks.py` checks retained evidence only; it does not rerun acceptance.
Ignored raw operation envelopes and admission records remain under the owned
task root `/tmp/toyvm-integrated-inline-fixture-mounted-cli-oct29/e/`.
No shared messageboard was appended; the coordinator note requests delivery.
