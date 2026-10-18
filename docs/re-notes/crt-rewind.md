# CRT rewind: bounded real FILE implementation

2026-10-18 source checkpoint after the original Mad Bomber packed zlib loader
resolved `_fdopen` and stopped at missing `rewind`. This adds a real void cdecl
handler with actual descriptor seek and stream state reset. Independent source review and the authorized normal build plus compiled
rewind, CRT stdio and fdopen tests all passed.

## Contract and source audit

[Microsoft's rewind documentation](https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/rewind?view=msvc-170)
describes seeking to the beginning and clearing both EOF and error indicators;
the function has no return value. Its console-input and modern invalid-parameter
handling are separate behavior, not asserted as fully implemented Win98 CRTDLL
semantics here. [Wine's implementation](https://github.com/wine-mirror/wine/blob/master/dlls/msvcrt/file.c)
performs a seek followed by `clearerr`, including when the seek fails.

Existing `handle_fseek` resets EOF, update-stream direction and the buffer
pointers, but preserves the error flag and exposes a return value. Existing
`clearerr` removes EOF/error only. The new helper reuses FILE lookup, flag and
buffer helpers, and the existing synchronous `fs_seek_result` import. It does
not call public handlers with their stack epilogues, alter fseek, or duplicate
the underlying VFS seek implementation.

Supported streams are this CRT's canonical owned unbuffered disk FILEs, whether
created by fopen, fdopen or a disk freopen. Writes already reach the VFS on
each call, so there are no pending output bytes to flush. Before touching the
cursor or flags, rewind requires the owned record, its matching descriptor,
valid in-use/unbuffered flags, empty count, canonical `_ptr`/`_base`, and buffer
size two. Copied/unknown/NULL/closed FILE pointers, console streams, custom or
pending buffers and tampered descriptor fields fail fast without mutation.
This avoids treating an unimplemented flush or keyboard discard as success.

The supported path calls the real host seek with offset zero and SEEK_SET.
It clears EOF/error, resets update direction and the empty buffer state even
if that seek fails. A prematurely closed descriptor therefore yields EBADF
through the existing errno cell and clears the stream indicators; the FILE
still owns the same closed tombstone until fclose releases it. Other seek
errors map to EINVAL. Success leaves errno unchanged. The inherited dynamic,
instance-local errno allocation and its whole-heap-OOM limitations are unchanged.

The host result dword uses scratch below the caller frame, leaving EAX intact.
The cdecl handler pops only the return address. No stream-list lock spans host
RPC, and a sibling instance uses the same process FILE ownership. This does
not add general concurrent FILE-operation synchronization.

## Validation

`test/test-crt-rewind.js` uses real WAT handlers and the real VFS. It covers:

- Actual written bytes, seek-to-zero, then rereading the first byte.
- EOF and error flags produced through real read/write operations; fseek still
  leaves error set while rewind clears both.
- Update-direction reset, empty buffer fields, unchanged errno on success,
  and void EAX/cdecl ESP/caller-argument preservation.
- Duplicate cursor visibility and closed underlying descriptor failure/EBADF.
- Rejection without mutation for console input, NULL/copied/freed FILEs,
  pending counts, custom buffer fields and tampered descriptors.
- Existing append behavior after rewind, and provider-backed seeks that do not
  materialize lazy data.
- A real sibling WAT instance routing seek through the synchronous host broker.
- CRTDLL dynamic GetProcAddress followed by actual thunk invocation and reread.

Source checks passed: JS syntax, WAT fragment balance and logical operands,
append-only API table, both API generators, region-literal ratchet, callback
ownership census and diff whitespace. The first census check encountered the
intentionally omitted host.js in the sparse checkout; restoring that exact
tracked file made the unchanged census pass. No baseline was regenerated.

The normal gated build and all three compiled fixtures passed against source
`c6f955b1fa5e80e0eb7f27f8436150d6ad584bfc`. Candidate module SHA-256:
`c3ae99a84199766991055f1d68196af03a9af10eeb118e97c6794f67d3ae7d1a`.
The canonical module remained `aafa600aabbf48b03ba1166ae7bf9c69dc77af499e8e4cb813e60c5bd3b924b1`.
Minimum observed free disk was 2509422592 bytes; no disk,
time or log guard fired, and each child process group was absent on completion.
Logs, command receipts, build artifact hashes, the supervisor recovery recipe
and retained previous modules are in
`/tmp/wa-crt-descriptor-oct18/scratch/runs/20261018-crt-rewind-validation/`.

The sibling broker test exercises synchronous routing, not actual OS Worker
scheduling. Concurrent operations on one FILE, buffered flushing, console
keyboard discard and whole-heap errno allocation failure remain outside this
slice. No original-game retry was run.
