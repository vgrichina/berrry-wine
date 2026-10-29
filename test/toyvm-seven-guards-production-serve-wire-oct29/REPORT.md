# Seven namespace guards: production serve wire acceptance

PASS on the exact five pinned production sources at base 513f22d8db9fc9b7d65d0c224b25d6439268b9e8. All five are unchanged. The retained canonical receipt and every supplied accepted artifact were hash-verified before use; previous loader/control suites were not executed.

The candidate completed 83 binary requests through the unmodified production Backend.serve implementation, including INIT 7.31, successful requests before and after rejection, and cross-guard sequences. Exact expected negative protocol errno was asserted for every rejection. Full node mode/data/names/link/open state, next inode, allocation live/peak/written/limits/failure/inode/handle accounting were compared before and after each rejected mutation. Only operations is allowed to increment, exactly once. A positive root GETATTR immediately follows every rejected mutation.

Coverage: rename file-to-directory EISDIR, directory-to-file ENOTDIR, descendant/self cycles EINVAL, missing source/destination parent ENOENT, non-directory source/destination parent ENOTDIR, invalid old/new names EINVAL, nonempty replacement ENOTEMPTY; UNLINK-directory EISDIR, RMDIR-file ENOTDIR, nonempty RMDIR ENOTEMPTY, missing UNLINK ENOENT; CREATE and MKDIR missing/non-directory parent and dot/dotdot/slash/empty/overlong names; rejected SETATTR unsupported flags plus growth EOPNOTSUPP before and after successful growth; nested READDIR dot/dotdot identity before and after cross-parent rename. Successful rename, growth, unlink, rmdir and release follow rejected requests.

Source-derived ABI: fuse_backend.py Backend.serve unpacks little-endian 2I2Q4I (40-byte request header), checks length against the complete read, and replies with IiQ (16-byte header), negative OSError errno and matching unique ID. Backend.handle defines INIT=26, GETATTR=3, MKDIR=9, CREATE=35, UNLINK=10, RMDIR=11, RENAME=12, RENAME2=45, READDIR=28, SETATTR=4, RELEASE=18 and their payload offsets. INIT supplies major/minor 7/31. CREATE name starts at offset 16, MKDIR at 8; rename newdir is Q then names at 8 or 16; SETATTR size is Q at offset 16. No external or invented ABI is used.

The exact Python fixture forks one bounded Python child inside the pinned ops supervisor process group, without an executable subprocess or guest launch. The child inherits Python DATA 128 MiB, CPU 90 s, file 12 MiB and the supervisor wall/group/physical RSS controls. The candidate compiles the exact pinned source unchanged, instantiates Backend with an absolute task-owned fixture root and explicit tiny allocation limits, assigns an unnamed duplex socketpair descriptor, and calls serve. A second private socketpair and observation thread serialize state snapshots only after a reply, while the server waits for its next request. No handle call, method replacement or namespace mutation is used for observation. The production status socket is a short absolute task-owned pathname. Each request is a single small write and waits for its complete reply before the next, preserving this server's read-per-request framing. This does not qualify fragmented/coalesced socket transport, which is outside the FUSE device framing contract.

The private control removes exactly the UNLINK-directory type guard in an in-memory source copy; all other source bytes and the entire wire fixture are unchanged. It fails on request 7, UNLINK directory: expected -21 (EISDIR), actual 0. The candidate passes the same assertion. Full raw request/reply hex and the distinguished control line are retained in the result JSON files. No control change touches production files.

Candidate child 2793972 and control child 2793982 both returned exit 0 after clean write-half EOF and were waitpid-reaped. Status paths were removed. No task box exists; coordinator lifecycle ownership is unchanged.

Scope is source/local private-wire serve decoding, errno propagation and namespace/accounting behavior only. Mounted/kernel, CLI, browser, guest execution, adapter invocation, resource qualification, selector lifetime and public deployment remain unqualified. No production repair or integration was performed.

Reproduction on this retained owned fixture (each invocation from the original shell, login=false, cwd=/tmp/toyvm-seven-guards-production-serve-wire-oct29/repo):

```text
/usr/bin/python3 /tmp/toyvm-seven-guards-production-serve-wire-oct29/ops.py candidate-serve /usr/bin/python3 /tmp/toyvm-seven-guards-production-serve-wire-oct29/repo/test/toyvm-seven-guards-production-serve-wire-oct29/wire.py candidate
/usr/bin/python3 /tmp/toyvm-seven-guards-production-serve-wire-oct29/ops.py control-serve /usr/bin/python3 /tmp/toyvm-seven-guards-production-serve-wire-oct29/repo/test/toyvm-seven-guards-production-serve-wire-oct29/wire.py control
```

Publication commit, remote SHA verification, resource receipts and coordinator messageboard handoff are recorded in the task-root completion-receipt.json and coordinator-note.txt after publication, avoiding a self-referential Git hash. Test evidence is committed with this report.
