# CRT descriptor metadata prerequisite

This source checkpoint implements the descriptor foundation for the binary
`_fdopen` plan in `madbomber-fdopen-design.md`; it does not register `_fdopen`.

`_open` now invokes one synchronous host operation that opens the real VFS
file and retains the caller's CRT flags before returning the handle. The
read-only `fs_crt_descriptor_query(fd)` returns these bits:

| Bit | Meaning |
| --- | --- |
| 1 | Live descriptor created by this CRT's `_open` |
| 2 / 4 | Currently granted read / write data access |
| 8 / 16 / 32 | Explicit binary / explicit text / unspecified translation |
| 64 | `_O_APPEND` |

Zero means invalid, closed, foreign Win32 handle, existing fopen handle, or
console descriptor. Explicit conflicting text/binary and invalid access modes
fail before opening, allocating a handle, or truncating. Retaining flags is
not a claim that every historical CRT open flag is implemented. Existing
text/default byte-passthrough behavior is unchanged; future binary `_fdopen`
must fail fast on these translation modes rather than treating them as binary.

The existing opaque disk handle is the identity: VFS allocation retains closed
tombstones and never recycles a number, including after wraparound. A separate
generation counter is therefore unnecessary. Query reads only the live handle
record; it never loads lazy bytes, changes position or transfers ownership.
Duplication copies the scalar CRT flags while retaining the existing shared
position. Query derives rights from the duplicate's granted access, preventing
access escalation through metadata. Close invalidates query through the same
tombstone used by reads, writes and seeks. Process cleanup and stream close
already go through this same VFS lifetime; no second descriptor table exists.

CRT append writes now append on every nonempty VFS write, including after
seeking and through duplicates. Access and write-protection validation precede
cursor changes. Zero-length writes retain the existing no-position-change
behavior. The existing initial `_open` append seek is retained.

Both imports use the normal generated synchronous Worker broker. Cooperative
instances share `vfs` through `processSharedCtx`; real Workers execute the same
operations on the main host. There is no new region or per-instance mutable
descriptor metadata.

## Validation and outstanding work

Executed: `node test/test-crt-descriptor-metadata.js`, generated import signature
freshness, JavaScript syntax, WAT fragment balance and diff whitespace checks.
The small real-VFS test covers actual bytes, shared cursor, independent close,
invalid/foreign descriptors, access denial and narrowed duplicate rights,
per-write append, translation classification, query without data access, and
same-process context sharing versus independent VFS isolation.

Executed after the coordinator's separate resource grant:
`node test/test-crt-descriptor-io.js`. This compiles actual WAT handlers,
asserts cdecl ESP preservation, exercises real read/write/seek/dup/close, and
checks synchronous generic Worker-broker open and query against the same VFS. It does
not spawn an OS Worker or claim concurrent close/adoption coverage.

Remaining: strict binary stream-mode parser; FILE allocation and descriptor
ownership publication with close-race handling; errno policy; append adoption
semantics; explicit treatment of preexisting fopen and standard descriptors;
fdopen/fclose/freopen/OOM and concurrent lifecycle conformance; API registration
and both generated API tables; subsequent fdopen build/regressions and original-game run.
No game compatibility outcome is claimed here.

## Compiled validation, 2026-10-18

The normal gated `bash tools/build.sh` and all four focused tests passed:
`test-crt-descriptor-metadata.js`, `test-crt-descriptor-io.js`,
`test-duplicate-handle.js`, and `test-crt-stdio-file.js`. The metadata test now
includes a dedicated provider-backed file whose read methods throw, proving
open/dup/query do not materialize its data. The broker test opens a real file
through the broker, then reads and closes that descriptor through WAT.

The isolated candidate is 1,866,851 bytes, SHA-256
`2f73127d24220248885e32c886538d236a68b04ae6ce7dec7b5fb8a012182166`.
The canonical recovery worktree artifact remained SHA-256
`67aaa6df401d2039bd70dd4f71bd683b69524918dda5c7e93d735f19688e147f`.
Each supervised process exited zero with no remaining process group and no
guard trigger. Minimum free disk across the successful build and tests was
2,272,362,496 bytes, above the 2 GiB + 64 MiB stop threshold. Each process
started above the 2 GiB + 128 MiB admission threshold. The first build attempt
stopped at missing committed toy-VM bundles in the sparse checkout; after
materializing those exact files, the full build passed. Both attempts are saved.

Evidence and the JavaScript supervisor/recovery recipe remain under the
isolated worktree's `scratch/runs/20261018-crt-descriptor-validation/`:
per-command logs/JSON, `artifacts.json` (candidate and exact test hashes), and
`run.js`. Reproduce with the repository build and the four tests above using
the existing `NODE_PATH=/home/user/wine-dashboard-deps-20261014/node_modules`;
no installation was needed. The reproducible generated `build/combined.wat`
was hashed then removed to recover disk margin; rebuild regenerates it.
