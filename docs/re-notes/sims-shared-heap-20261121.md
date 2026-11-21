# Sims shared heap prerequisite

`HEAP_SHARED` (0x04000000) now selects a system-owned allocator and byte store.
Previously repeated public `HeapCreate(0x04000000,4096,0)` calls created distinct
private records; the retained original public fixture exited with guest code
121. This change provides actual shared bytes across process memories, rather
than giving private heaps a common numeric handle.

`lib/shared-heap.js` owns a 16 MiB arena at guest 0x80000000–0x80ffffff. The Node
implementation runs inside the existing authenticated named-event system
namespace. Real Workers and child processes inherit its endpoint, not its byte
buffer. Browser host imports use one authority on the desktop page. Allocator
metadata, scalar reads/writes, and compare-and-swap execute at that authority;
there is no process-private mirror. A tagged opaque heap handle must match the
authority's generation; its tag alone grants nothing. Freed blocks coalesce,
including releasing the bump tail, and failed reallocations retain the old
allocation. Heap APIs reject wrong heaps, freed pointers, unsupported flags,
and exhausted capacity. Private heaps cannot free/reallocate shared blocks.

`HeapDestroy` succeeds without retiring the system heap. Guest thread/process
exit and transport disconnect do not release live system allocations. The
system namespace owns their lifetime: the Node root hosting that namespace
must remain alive; closing the complete namespace destroys it. A browser page
owns its namespace until page teardown. This is not an OS daemon that survives
the entire emulator host exiting. HeapCreate's initial/maximum sizes do not
resize the fixed system arena, matching the Win9x compatibility implementation
referenced in the November 16 notes. No Windows VM measurement is claimed.

Guest 8/16/32-bit accesses reach the store, as do the scalar lanes of 64/128-bit
accessors. Supported LOCK read-modify-write and memory XCHG instructions use
an authority CAS loop, including unaligned operands. They retain atomic
routing under the cooperative scheduler because separate processes can still
run concurrently. API errors travel with their result in one RPC; a separate
mutable host LastError query would race between browser CPUs. The internal
error marker is decoded only for API results, never for memory data.

The reservation cannot be aliased with a private `VirtualAlloc`. Helpers or
host APIs requiring a raw WASM linear pointer into shared memory stop explicitly
with `ESHAREDHEAP_LINEAR_ACCESS`; unsupported locked instruction forms such as
CMPXCHG8B are not enabled by this change. Wide scalar lanes are not a 64/128-bit
atomic transaction. Shared executable-memory cache coherence, host buffer APIs,
and general shared-memory virtual protection/query support remain outside this
prerequisite. `InitializeCriticalSection` writes the actual six shared words;
Enter/Leave/Delete and global promotion still require authority-aware critical
section implementation. `MakeCriticalSectionGlobal` and `ConvertToGlobalHandle`
remain explicit unimplemented boundaries.

Validation is retained in `scratch/runs/20261121-sims-shared-heap/`:

- `test/test-shared-heap.cjs` exercises public handlers and stdcall cleanup in
  the main instance, a real Worker sharing its process memory, and a forked
  process with a different WASM memory. It checks visibility, ordinary heap
  isolation, allocation survival after creator exit, stale/forged handles,
  freed access, system HeapDestroy lifetime, zero growth, OOM, full capacity
  reclamation, private-heap misuse, and VirtualAlloc exclusion. Actual x86
  LOCK loops run on all three CPUs; main/process loops start after a handshake
  and conserve 384 increments on a shared unaligned dword. A browser-script VM
  control verifies one page authority with two separate process memories; it
  is not a native browser capture.
- Existing heap API, all supported LOCK-form memory/register/flag expectations,
  and named-event authority regression tests pass. The canonical build passes
  under `flock /tmp/wine-build.lock bash tools/build.sh`.
- A bounded original RPCRT4 startup returns a real shared heap, allocates 64
  bytes at 0x80000000, and initializes the section at allocation +24. Authority
  writes are exactly `[0,-1,0,0,0,0]`. Original RPCRT4 then calls the still
  unimplemented `MakeCriticalSectionGlobal(0x80000018)` at guest EIP 0x0050ee4b;
  host exit 1 is the expected explicit boundary, not startup success.

The original runtime SHA-256 is
`f5719c28ce60526cb4873332073c21148ce4c74427197aa6a4438c2951af9c5a`;
objectps SHA-256 is
`32c6ad91dc66bc12e1273b1e13eb7a15d6e8f63b93447909ca2163dd21b22998`.
The first proxy-only control did not initialize RPCRT4: today's dependency
resolver looked beside the proxy, while the runtime was mounted in the system
directory. That successful exit is unqualified. The bounded runtime probe
explicitly seeds the mounted original RPCRT4, so its startup runs before the
fixture can initialize objectps. No dependency-search changes, registrar,
factory, service, gameplay, or completed global synchronization are claimed.
The read-only run-local observer records authority inputs/results; it does not
modify guest execution. Native runs have finite supervision and no leaked
owned processes. No Wine, Python, media copies, remote boxes, or deployment.
