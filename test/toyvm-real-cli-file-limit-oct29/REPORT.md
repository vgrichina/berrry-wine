# Actual production CLI per-file rejection

On candidate `5a88ca099b962e946160afd2d4d71a950bf46db3`, exactly one unchanged
`qualify_accounted.py` CLI invocation used the synchronous FUSE backend on fresh
Boat `bx_38g4dtgr`. All five production pins were checked locally and at the
remote execution location before launch. Python and fusermount executables and
the 25-byte status socket path were checked remotely.

The confined Python workload opens one new `/tmp/tvfile/w/domain/profile`, calls
`os.write(fd, b"X"*16385)` once, and closes in `finally` if possible. There are no
payload retries, loops, additional payload files or output. Its cwd is the remote
repository; the absolute path is inside the sole authorized FUSE domain.

The exact separate flags are live 32768, write 65536, file 16384, RSS 134217728,
CPU 2, wall 5, output 4096. The pinned WRITE handler checks cumulative write,
then per-file size, then resize/allocation and mutation. Root and new inode
cost 8192; a hypothetically accepted 16385-byte dense payload rounds to 20480,
giving 28672 < 32768. The attempted 16385 < 65536 but exceeds file 16384.

Observed PASS: CLI exit 1, accepted false, backend failure and stop reason both
exactly `filesystem per-file limit`. Live and peak remained 8192, accepted
written bytes 0, two inodes, zero handles. The rejected file never accepted any
payload, including an oversized version. Backend child was terminated by the
production supervisor (exit -15); no different gate was reported. Unmount exit
0, server exit -15, no residual mount or owned observed PID/start identities,
cleanupComplete true. The 8-second outer safety guard did not act.

Raw CLI stdout/stderr, actual argv, backend counters, identity observations,
remote preflight, API responses and canonical receipt are in `evidence/`.
Only the per-file gate qualifies. Full resource/browser/gameplay remain unknown.
Browser allowance remains CPU 35.353183, wall 101.495550694, captures 1.

The explicitly delegated preservation and snapshot-stop completed; actual
stopped state and completed snapshot are verified in `stopped-final.stdout`.
Original expiry was 04:45:12.444 UTC and the task cutoff was 04:40 UTC.
No old box was reused; no other acceptance group was repeated.

Recovery: the scripts are the exact task-owned fixtures used, with absolute
task paths. They require the existing isolated checkout, pinned dispatch and
cancellation receipt. Do not rerun this task or reuse its work directory.
Reconstruction for a newly authorized task requires rebinding all task paths
and fresh dispatch/admission; production files must remain pinned and unchanged.
No clone, fetch, sparse expansion, main integration, or public deployment occurred.

Procedural limitations are retained in the canonical receipt. Initial policy
and source inspection preceded the guarded supervisor and one combined source
inspection exceeded terminal8192 presentation. The first post-stop info was
still stopping; a later read-only info confirmed stopped without another stop
or runtime invocation. Historical output-task procedural limitations are retained.
The task prohibits guest mount-parser execution and uses no guest mount argv.
Per-operation monitors do not establish all unobserved controls. The oversized
shared board is handled by a coordinator publication note, without append.
