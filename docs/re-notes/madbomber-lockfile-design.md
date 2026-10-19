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
