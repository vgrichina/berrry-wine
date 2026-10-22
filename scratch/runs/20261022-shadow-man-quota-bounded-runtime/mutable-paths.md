# Storage admission and path audit

The existing mount `/home/user/shadow-man-bounded-runtime` is tmpfs, exactly
150994944 bytes, with 16384 inodes. It was not remounted or enlarged. The
coordinator's retained receipt records ordinary full writes receiving ENOSPC
under an exact 1 MiB tmpfs fixture, then removal/unmount of that fixture.
`preflight.json` records this mount's actual type/size and actual allocated
blocks for every fixed active source/runtime/codec/support file and directory.

All mutable runtime paths are below this mount:

| Writer | Destination / control |
| --- | --- |
| Ordinary child full VFS input/output and registry transport | `test/run.js:4124` uses `os.tmpdir()/wa-child-*`; TMPDIR, TMP and TEMP all equal `attempt/tmp` |
| All normal descendants | `ThreadManager.namedEventEnvironment()` spreads process.env; the unchanged runner passes it to fork and recursively passes pipe-child-args |
| Named-event authority | `lib/named-event-authority.js` uses `os.tmpdir()/wine-event-*`; actual fork fixture records its socket under `attempt/tmp` |
| Parent full VFS and registry export | Absolute `attempt/parent-vfs` and `attempt/parent-registry.json` |
| Observer JSONL, PNG, summary and boundary receipt | Only OUT relocated to `attempt`; ROOT relocated to exact staged runtime |
| Parent PNG and backing images | Absolute `attempt/parent-final.png` and its filename-derived siblings |
| stdout/stderr, command, attempt, process and exit receipts | `attempt`; raw output.log receives all bytes without truncation |
| Cwd-relative defaults and diagnostic files | Process cwd is `attempt` and is inherited by ordinary forks |
| Launcher/fixture/preflight evidence | `attempt` on the same tmpfs |

The exact Node fork fixture calls the real namedEventEnvironment method,
writes an ordinary child file, and records actual PID, tmpdir, TMP, TEMP and
named-event socket path. Its pass is unrelated to any guest run.

Parent `--vfs-include=**/*` is rooted at the immutable original Setup directory,
not cwd. No parent vfs-tree includes the quota. The immutable DLL seeds are the
original `_Setup.dll` and exact staged authentic msvcrt. No fixed control port,
input, capture-launch, guest-page-stats, CPU profile, memory dump, cursor dump,
or other diagnostic output flag is enabled. NODE_OPTIONS was checked empty.
The observer mechanics are unchanged; relocation is reversible to the pinned
original hash. No exporter, fork, VFS or emulation behavior was modified.

The fixed active measurement includes all 23 originals, the whole exact staged
runtime, pinned codec and six support files, including directory blocks. The
inert ISO, retained staging archives and previous receipt files remain in the
separate existing recovery phase and are never ingested. The fixed 96 MiB
allowance plus enforced 144 MiB mutable quota leaves the full 16 MiB reserve in
the 256 MiB cap. No finite descendant-count assumption is needed for storage.
System Node/Python executables and base OS are infrastructure, not task payload.

Storage exhaustion is a bounded resource result. It cannot establish an
installer incompatibility. Absence of a child PNG cannot be replaced with a
parent screenshot or WinExec's synchronous transport-accepted return33.
