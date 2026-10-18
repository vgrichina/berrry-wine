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

Authored but **not run** pending the coordinator's resource grant:
`node test/test-crt-descriptor-io.js`. This compiles actual WAT handlers,
asserts cdecl ESP preservation, exercises real read/write/seek/dup/close, and
checks a synchronous generic Worker-broker query against the same VFS. It does
not spawn an OS Worker or claim concurrent close/adoption coverage.

Remaining: strict binary stream-mode parser; FILE allocation and descriptor
ownership publication with close-race handling; errno policy; append adoption
semantics; explicit treatment of preexisting fopen and standard descriptors;
fdopen/fclose/freopen/OOM and concurrent lifecycle conformance; API registration
and both generated API tables; gated build/regressions and original-game run.
No compiled validation or game compatibility outcome is claimed here.
