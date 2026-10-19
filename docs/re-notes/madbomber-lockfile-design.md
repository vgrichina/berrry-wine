# LockFile implementation checkpoint

Baseline: origin/main 3c791a0231267d4bd5a2db3160ad830c40a869da.
Original run `20261019-madbomber-dbcs-retry` stops when the KERNEL32
LockFile name lookup returns NULL. API IDs 453 and 711 already exist.

The implementation must enforce locks, not just expose the name. Proposed
ownership is a stable file entry plus a separate open-file owner shared by
DuplicateHandle. Independent opens, including adopted child filesystems,
have separate owners. Closing the final duplicate removes its locks.
Process teardown closes all disk handles before shell snapshot handoff;
adoption itself must not release the still-running parent's locks.

Store unsigned offsets and lengths as BigInt. Reject ranges extending past
2^64, support ranges ending exactly there and locks beyond EOF. Unlock must
match one exact original region. Conflicts report ERROR_LOCK_VIOLATION (33),
missing unlock reports ERROR_NOT_LOCKED (158), invalid handles report 6.
Ordinary reads/writes through a different owner fail before modifying file
position, bytes, guest buffers, or invoking lazy providers. Scatter reads
must preflight the whole request. Memory mappings are exempt, per Win32.

Necessary prerequisite: handles currently resolve mutable path names on
each operation. Retain the opened entry instead; CREATE_ALWAYS must truncate
that same entry, and a rename/replacement must not retarget an existing open.
File entry references and lock state must remain out of serialized artifacts.

Conformance cases: exact/partial/adjacent overlap, repeated lock, exact
unlock and wrong owner, duplicate access and final close, close-source,
zero-byte ranges, offsets above 2^53 and 2^64 overflow, EOF, lazy provider
noninvocation, append writes, scatter read nonmutation, rename/recreate,
parent/child adoption, process teardown, and KERNEL32 export/stdio cleanup.
Source/JavaScript tests run locally only; compiled guest and real Worker
validation require a separate coordinator grant. No gameplay claim.

References:
- https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-lockfile
- https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-unlockfile
- https://learn.microsoft.com/en-us/windows/win32/fileio/file-handles
- https://github.com/wine-mirror/wine/blob/master/dlls/kernel32/tests/file.c
- https://github.com/wine-mirror/wine/blob/master/server/fd.c

## Source implementation and validation

Implemented per-entry WeakMap lock tables and per-open owner tokens.
DuplicateHandle shares a token only for the current process; cross-process
disk transfer was previously an incorrect local alias and now fails error 6.
Pipe, console, mapping and other-object duplicate dispatch stays separate.
The existing process validator accepts -1 and real current-process handles.
Disk inheritance is not implemented by adoptFrom; child opens have independent
owners. CRT `_dup` carries the new argument; `_dup2` remains unimplemented.

Pending host reads reserve their full range across provider yields;
conflicting locks fail while that operation is outstanding. Completion,
failure, close, thread retirement and process teardown release reservations.
Process exit and WineAssembly.stop close disk handles and reject late opens,
so a retiring Worker cannot reacquire a lock. Adoption does not close a live
parent's handles. Mapped views bypass byte-range locks.

KERNEL32 names use ordinals 591/592 after the coordinator's reserved 588..590.
API IDs 453/711 remain unchanged. Loader image and 281-import mirror updated.

Passed without building wasm:

- `node test/test-file-byte-locks.js`: includes forced four-byte scatter runs,
  parent/child ownership, exact 64-bit ranges, append nonmutation, mapped-view
  exemption, and pending-read contention.
- `node test/test-vfs.js`: 46 checks.
- `node test/test-vfs-adopt.js`.
- `node test/test-vfs-lazy-entry.js '--filter=^(?!.*(?:scheduler retries|thread-owned reads|two real Workers|browser and CLI)).*$'`: 47 checks.
- Four changed WAT fragments balanced; generator freshness, JavaScript syntax,
  diff whitespace, and signature parity against the full source closure.

An initial unfiltered lazy suite could not load four sparse dependencies
(including the compiled Worker closure helper), before compilation. Two old
path-replacement tests expected an open handle to retarget a new file. They
now assert retained opened-entry identity and pass. The filter permits
explicit source-only runs; the normal full suite still runs every case.

`test/test-lockfile-handlers.js` is authored and syntax-checked, **not run**.
It covers BOOL/last-error/ESP, high offsets, DuplicateHandle and CRT `_dup`.
Full build gates, real Worker RPC, public GetProcAddress execution, native
Windows zero-byte/duplicate edge comparison, and original Mad Bomber replay
remain coordinator validation work. No gameplay or runtime compatibility
conclusion follows from the JavaScript checks.

Independent review corrections: unsupported cross-process duplication now
passes through CLOSE_SOURCE cleanup on failure, releasing the lock only when
no duplicate remains. FlushFileBuffers validates the retained opened entry,
so rename no longer makes a valid writable handle fail. Focused regressions
cover both final-owner and surviving-duplicate rejection, renamed flush, and
closed renamed handles. No native execution was added for these corrections.
