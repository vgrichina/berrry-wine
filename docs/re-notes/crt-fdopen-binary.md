# Binary `_fdopen` adoption slice

2026-10-18 source checkpoint, following tested descriptor prerequisite
`baa7ecacd`. This adds a real cdecl handler and API-table entry, backed by the
existing 48-byte stream record and real 32-byte guest FILE. Compiled validation
of this adoption slice is **pending**; prerequisite validation does not cover it.

## Bounded contract

Accepted mode grammar is `rb`, `wb`, `r+b`, `rb+`, `w+b`, `wb+`; `ab`, `a+b`,
and `ab+` additionally require a descriptor already opened with `_O_APPEND`.
The descriptor must be a live explicit `_O_BINARY` descriptor created by this
CRT `_open`, or a duplicate of one, with sufficient granted data access.
The access check uses actual VFS rights, including narrowed duplicates.

Valid text/default modes, text/default descriptors and append requests against
non-append descriptors explicitly invoke the existing unimplemented trap before
acquiring ownership. Other modifiers and malformed strings return NULL/EINVAL;
the parser inspects at most four bytes. Null mode is EINVAL. Invalid, closed,
console and foreign Win32 descriptors are EBADF; incompatible access is EACCES;
allocation failure is ENOMEM. An already-adopted descriptor is EINVAL. These
are a stated bounded policy, not a claim to all vintage CRTDLL edge cases.

Adoption never opens, duplicates, truncates, reads or seeks. `w` selects write
access only. Descriptor append behavior is preserved and enforced by the VFS
at every write, without the separate seek/write RPC pair used by older stdio.
The FILE's `_file` is exactly the caller's descriptor. Existing fread/fwrite,
fseek, fclose, freopen and process cleanup reuse their real stream paths.
Successful fclose closes the passed descriptor, leaving independent duplicates
alive. A premature `_close` makes later stream I/O/fclose fail against the closed
tombstone; it cannot close a newly opened file under a recycled descriptor.

Microsoft documents that the returned FILE owns its descriptor and closes it
on fclose, and describes append and mode behavior. Its contemporary invalid
parameter machinery is not asserted as the Win98 contract. Wine's `_wfdopen`
parses `open_flags` but passes only `stream_flags` into FILE initialization,
supporting preservation of existing descriptor state rather than reopening or
mutating it. These sources do not establish every historical append combination;
the non-append-descriptor/append-stream case is therefore explicitly unsupported.

References: [Microsoft `_fdopen`](https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/fdopen-wfdopen?view=msvc-170),
[Wine file.c](https://github.com/wine-mirror/wine/blob/master/dlls/msvcrt/file.c).

## Ownership linearization

1. Parse bounded mode and inspect read-only metadata. Reject unsupported mode,
   invalid descriptor or denied rights without allocating a FILE record.
2. Allocate and initialize an unpublished ordinary FILE record. OOM leaves the
   descriptor and list unchanged. No ownership lock spans allocation.
3. Synchronous main-host `fs_crt_descriptor_adopt` revalidates the live handle,
   mode and granted rights, then atomically reserves its unique FILE owner.
   This operation neither allocates nor touches guest memory or provider data.
4. Only on success link the fully initialized record into the process-shared
   stream list, with the existing short list lock. No host RPC occurs while
   that lock is held. Failed revalidation frees the unpublished record.

The host reservation is the adoption linearization point. A close before it
causes EBADF; a close after it closes the adopted descriptor normally, even if
the list publication has not completed. The returned FILE may then already be
unusable, as when the caller concurrently closes its fd after successful
adoption. Since VFS handle IDs are never recycled, this cannot adopt a different
file or close another identity. The test forces both interleavings explicitly.
Simultaneous adoption attempts cannot both reserve the same descriptor.

The owner marker resides on the process-owned VFS record. Duplication clears
that marker while copying scalar CRT flags and sharing position; otherwise a
post-adoption `_dup` would incorrectly look already owned. Close retires the
marker with its tombstone, and freopen closes the old descriptor as usual.
Console descriptors, foreign FILEs and preexisting fopen descriptors are not
bridged into this binary subset.

## Validation and limits

Pure real-VFS metadata/adoption tests pass, including access rejection,
unchanged bytes/cursor, unique adoption, post-adoption dup ownership separation,
closed identity rejection and dedicated lazy-provider open/query checks.
Import signatures, JS syntax, WAT fragment balance and logical operands are
checked. Both API generators were run after the real handler/test were written.

`test/test-crt-fdopen.js` is authored but **not run** pending review/resource grant.
It exercises real WAT handlers and VFS bytes, shared descriptor/FILE cursor,
no-truncate w adoption, rights and mode failures, append after seek, duplicate
lifetimes, close on either side of the adoption operation, sibling-instance
ownership, freopen and process cleanup. It resolves CRTDLL `_fdopen` dynamically
and invokes that thunk. Its OOM variant alters only fdopen's allocation size to
an impossible request so the real allocator refuses it; this is deterministic
allocation-failure injection, not measured whole-process memory exhaustion.

A second actual WAT instance routes open, query and adoption through the
generic synchronous broker and publishes a FILE that the first instance reads
and closes. The test asserts that all three calls crossed the broker and that
the reservation names the real returned FILE. This remains an in-process
round trip rather than an OS Worker scheduling test.

The current CRT's errno cell is dynamically allocated and instance-local.
The OOM test preallocates it, proving ENOMEM survives failed FILE allocation;
it does not establish behavior when allocating the errno cell itself fails,
nor errno isolation across multiple threads. The error helper safely returns
NULL if that cell cannot be allocated. General CRT errno storage is unchanged.

No OS Worker/concurrent execution or game outcome is claimed. Concurrent
operations on the same FILE still use the existing stdio synchronization
contract; this patch does not add general stream locking. Termination racing
with creation is likewise outside the existing stream API contract. Next gates
are the normal build and compiled suite, independent review, then a separately
authorized original Mad Bomber run.

Prepared validation sequence (not executed for this slice): normal gated
`bash tools/build.sh`, then `test-crt-fdopen.js`,
`test-crt-descriptor-io.js`, `test-duplicate-handle.js`,
`test-crt-stdio-file.js`, and the pure `test-crt-descriptor-metadata.js`.
Reuse the existing dependency NODE_PATH and isolated worktree; expand only
root files, test JS/shell files, fonts and the two committed toy-VM browser
bundles needed by build gates (about 37 MB additional on disk). Admit each
process above 2 GiB + 128 MiB and stop below 2 GiB + 64 MiB. After the build,
hash and remove only the reproducible isolated `build/combined.wat` to recover
about 20 MB. Preserve the existing prerequisite evidence and use a new evidence
directory for this slice. Recheck exact sizes and admission after the other
runtime lane releases; no sparse expansion is authorized by this plan alone.
