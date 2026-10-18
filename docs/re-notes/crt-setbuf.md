# Bounded setbuf support

2026-10-18 source checkpoint, pending independent review and compiled tests.

[Microsoft's setbuf contract](https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/setbuf)
specifies a void function: NULL requests unbuffered I/O; a non-NULL pointer
supplies a BUFSIZ-sized user buffer. The stream must be open and the call made
before I/O. A successful custom-buffer call therefore cannot truthfully be
implemented by ignoring that pointer. The existing setvbuf implementation
validates requests but keeps immediate I/O and never retains custom buffers;
this patch preserves that existing contract without using it as a setbuf alias.

The bounded handler implements NULL mode for canonical FILEs owned by this CRT.
It establishes the inline char-buffer pointers, size 2, zero pending count
(validated before mutation), and _IONBF while preserving descriptor, access,
EOF and error flags. Existing stdio performs immediate I/O, so these supported
states have no pending buffered data to flush. EAX is preserved for the void
call; cdecl pops only the return address. API entry 4575 is appended and both
generated tables are regenerated.

Non-NULL buffers, unknown/closed streams, nonzero pending counts, buffered or
string FILE flags, mismatched descriptors, and foreign buffer pointers fail
through crash_unimplemented before mutation. This is explicitly partial
support, not a full setbuf implementation. Full buffering and concurrent
FILE mutation remain outside this patch; the normal pre-I/O call contract
applies. No silent success is introduced for unsupported modes.

Circus SDL startup first attempts freopen on stdout/stderr. Successful reopen
preserves their owned FILE addresses and stores the actual VFS handle, which
this handler supports. The fallback copies eight dwords from fopen's FILE into
the standard FILE. That does not transfer this emulator's separate ownership
record/handle; it also leaves pointers to the donor's internal char buffer.
Such copied FILE state is rejected rather than repaired or silently accepted.
The source evidence remains in scratch/runs/20261018-circuslinux-stdio-source.

Extended test-crt-stdio-file.js covers NULL mode, initial/reopened standard
streams, immediate VFS output, preserved EOF/error flags and void/cdecl ABI,
plus custom-buffer, NULL/unowned/closed stream and copied-FILE traps with no
FILE mutation. Its crash notification is overridden only to allow the actual
WASM unreachable to be asserted. These tests have been authored, not executed;
no build, game, browser or retry occurred in this source task.
