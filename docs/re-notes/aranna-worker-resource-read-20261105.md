# Aranna Worker resource reads, 2026-11-05

Task `NEW-GAME-ARANNA-DEMO-20261010`; evidence:
`scratch/runs/20261105-aranna-worker-resource-read/`.

The generated controls found no divergent read, offset or result. A new
regression passes through the production WAT handlers, real OS Workers and
the singleton JS filesystem broker in both compiler modes. No production
defect was demonstrated, so no emulator repair was made. The first divergent
operation in the original run remains unknown.

The retained original run establishes ordinary EULA acceptance, followed by
the guest's `Logic.dsres` error dialog, but records no individual file read,
seek, destination buffer, or checksum comparison. Its host VFS hash cannot
establish what a Worker read. See
[the original run](aranna-original-local-gameplay-20261105.md).

The original files were reused in place, without modification or copying.
`DSLOA.exe` is 3874869 bytes, SHA256
`fced0961231248c09c10d86ff51935569db5f83ed3b2ba2739f0501dbc318589`;
`Resources/Logic.dsres` is 4206880 bytes, SHA256
`90b26f179364a4d25f7053e8aa41932d51fcd0e563e37820894c3dbfdcf9d0e5`.
`original-in-place.json` records this check. No original guest was rerun:
no changed prerequisite was proved. No archive parser or archive oracle was
created, and no guest instruction or import was patched.

## Source trace

The ordinary path is `src/09a7d-handlers-shell-file.wat:$handle_ReadFile`
through `src/09a0b-handlers-base-late.wat:$host_fs_read_file_result`, then
`lib/guest-rpc.js:createWorkerImports` / `createMainBroker`, then
`lib/filesystem.js:createFilesystemImports.fs_read_file_result` and
`VirtualFS.readFile`. The adapter appends the calling instance's 1-based
thread ID and retains the host-write fence. The Worker sends the arguments
through its shared RPC slot and waits for the broker response. The broker
uses one shared VFS, as the browser does; it does not maintain a second
Worker-local copy of the mounted file.

For an eager file the VFS copies `min(requested, max(0,size-position))` bytes
and advances the handle position by the bytes actually read. The import
scatters the destination through the production guest-memory translator and
writes the returned count through the guest-addressed output pointer. Its
single result is an error code: zero for success, 997 for an internal lazy
fill retry, otherwise the operation's error. WAT returns BOOL from that
result, pops the 24-byte stdcall frame, and updates its instance's
`last_error` only on a completed failure. The lazy branch parks and reenters
the call; it is not the eager original route under investigation.

`$handle_SetFilePointer` calls `fs_seek_result`, which reads the optional high
word through the guest translator, combines signed 64-bit distance when
present (otherwise signed 32-bit distance), and invokes
`VirtualFS.setFilePointerResult`. It writes EAX through the private result
address and the successful high word through its guest pointer in the same
operation. Negative resulting positions fail with 131 without moving the
cursor; invalid methods fail with 87. A low result of `0xffffffff` can be a
success, distinguished by error zero. WAT consumes the returned error and
pops 20 bytes. `SetLastError` itself assigns the instance-local WAT global;
`GetLastError` reads it. No second shared mutable error lookup is involved.

These controls follow Microsoft's documented
[synchronous EOF behavior](https://learn.microsoft.com/en-us/windows/win32/fileio/testing-for-the-end-of-a-file),
[signed seek and failure rules](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-setfilepointer),
and [per-thread last-error semantics](https://learn.microsoft.com/en-us/windows/win32/api/errhandlingapi/nf-errhandlingapi-getlasterror).
Error `0x17` is
[ERROR_CRC](https://learn.microsoft.com/en-us/windows/win32/debug/system-error-codes--0-499-).
The ordinary eager VFS read/seek path does not generate that value; a
successful read also does not establish which earlier operation set it.

## Original static error propagation

The original PE's preferred image base is `0x00400000`. Its IAT slots are
`SetLastError=0x007290d4`, `SetFilePointer=0x00729110`,
`GetLastError=0x00729154`, `ReadFile=0x00729270`.
The static reader recipe and selected original disassembly are retained,
with the original file referenced by path/hash rather than copied.

Original routine `0x00655577` loads a buffer from `[ESI+0x0c]`, its length
from `[ESI+0x9c]`, and calls the table-driven checksum routine `0x0041b19c`
with initial value zero. At `0x00655597` it compares the returned EAX with
`[ESI+0xd8]`; on mismatch it explicitly pushes 23 and calls `SetLastError`
at `0x006555a1`, then returns false. The checksum routine complements the
accumulator and uses byte-indexed table lookups and right shifts. Its caller
at `0x006558e7` conditionally requests this check after buffer setup.
Separately, resource error handling calls `SetLastError(23)` at `0x00653498`.

These are static paths in this exact Aranna executable, not a claim that
either executed in the retained original run. They show why the displayed
value cannot identify the first failing Windows read. An earlier I/O error
could be overwritten by a guest resource check. The older Dungeon Siege
demo's reserved-page/SEH findings are historical context, not proof of this
Aranna run's fault flags, page state or chosen path.

## Generated regression and validation

[test-worker-resource-read.js](../../test/test-worker-resource-read.js)
compiles the complete production WAT closure with small test entry points,
then instantiates it in two Node OS Workers over shared memory. It dispatches
the real `ReadFile`, `SetFilePointer`, `SetLastError` and `GetLastError` APIs
through the production dispatch table. File reads and seeks use the actual
RPC transport and filesystem imports; none are replaced by test operations.
Only unused GDI imports trap if called. Fixture handles are opened by the
host before the control begins; guest open flags/path selection remain part
of the missing original observation.

The generated file has 4206880 bytes and SHA256
`aa21816066ac7a046236e00e111deaf9c3e1bfc49779423ca79b09c180d22ad0`.
The full Worker-delivered buffer matches that hash. Controls also check:

- Exact EOF and beyond-EOF reads return TRUE with zero bytes; a tail read
  returns 17 of 32 requested bytes without changing the unwritten suffix.
- Zero-byte reads, signed FILE_BEGIN/CURRENT/END moves, failed negative and
  invalid-method seeks with unchanged positions, and 64-bit high/low results
  including a successful low `0xffffffff`.
- Actual access-denied and invalid-handle reads return FALSE, zero the count,
  and report 5 and 6 to their own calling instance. Successful reads preserve
  that instance's previous last-error value, including 23, without changing
  the other Worker's value.
- A seek by one Worker controls the cursor consumed by the other Worker.
  Reading 8200 bytes from file offset 4194299 into three guest pages with
  deliberately nonadjacent backing reproduces the exact generated slice.
- Real adapters carry thread IDs 2 and 3, and WAT removes each stdcall frame
  exactly once. There are no broker exceptions.

Both runs passed all assertions: 21 guest API calls and 16 filesystem broker
operations each. `worker-standard.log` and `worker-compat.log` retain actual
arguments, offsets before/after and operation errors. These are generated
file controls, not execution of the original archive or its decoder. They
cover the ordinary synchronous eager path; IOCP, provider retry, the browser
Worker lifecycle and guest lazy-page loading are not qualified by this test.

Tested main SHA `a5c90bfd0ccc40c96ad457c617e898ae9064bda3`, Node
`v24.18.1`, empty relevant production binary diff, plus the owned new test
patch. The unique harness modules and hash manifests are retained:

| Module | Bytes | SHA256 |
| --- | ---: | --- |
| Standard harness | 2173453 | `7d17a1e86d57a61ff402786963e914afc5312939e1231bf77e21b51f283f279a` |
| Compatibility harness | 2174522 | `60406c26a2850b6cffeaacf86d7740998d73a8c23f5ef732300d2db888d78e93` |

`flock /tmp/wine-build.lock bash tools/build.sh` then passed every gate at
17:31:00Z. Its production standard module is 2173299 bytes, SHA256
`10462bd9693cf4f51d382d33767674b736b84e74346f328306d59e35c5e60031`;
production compatibility module is 2175945 bytes, SHA256
`eb59d32227cc18233f93c7b757e0700f9558f0a31af7e3d38090669d4fc15158`.
These match the prior original run's production build hashes; the controls
execute the separately identified harness modules above.

The required Shadow FINAL17:14:24 then Conan FINAL17:28:50 releases preceded
every shared edit, test and build. Independent cleanup found 302 recorded
PIDs absent, 119 ports refused, 27 profiles absent, four locks free and no
heavy runtime before ownership. Generated runs were serialized under the
local/heavy locks. Their Workers were terminated in `finally`; all logged
validation processes exited, and the owned board watcher was stopped before
final release. No browser, original guest, test box, agent subworker or
deployment was used. Box ID/state/expiry are N/A; coordinator lifecycle
ownership and laptop Heroes II are unchanged. Evidence contains hashes,
binary diffs, owned new-file patches and unique modules/logs, without source
archives or repeated original media.

## Missing discriminating observation

To identify a first divergent read, capture an ordered per-thread record for
the `Logic.dsres` handle: open access/flags, each seek's signed low/high
distance and method, position before/after, each read's requested count,
returned BOOL/count/error, destination guest address, and bytes or a hash of
the exact written range compared with the canonical file at that offset.
Record completion before another thread can change a shared cursor.

If the reads agree, observe the actual guest resource/checksum failure path.
At the valid return boundary `0x00655594`, capture EAX, ESI, `[ESI+0x0c]`,
`[ESI+0x9c]`, `[ESI+0xd8]`, and the exact checksum input bytes/page state
before interpreting a mismatch. If no payload read precedes that access,
observe the buffer allocation/protection and first guest fault/filter/fill
path, including the effective fault mode. A decompression failure needs its
actual compressed input and decoder result; no such result is in the
retained log. Without these observations, file delivery, guest buffer
population, checksum computation and decompression remain distinguishable
hypotheses, not established causes.
