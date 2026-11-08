# Shared render publication

The Worker path uses one bounded `RenderWorker.PublicationQueue` per emulated
process. OpenGL, Direct3D immediate-mode batches and Glide use the same storage
ownership, ordering, wake-up and failure rules. API encoders and execution
adapters remain distinct.

```text
GL encoder -------- immutable command bytes ----+
Glide encoder ----- immutable packet bytes -----+--> shared publication ring
D3D encoder ------- leased-buffer descriptor ---+          |
                                                   coalesced notification
                                                          |
                                                   page admission
                                                          |
                                               existing render-worker queue
                                                          |
                                               API decoder / GPU or software
```

The ring is a separate 4 MiB shared buffer plus a 64-byte control header. It
does not change the WASM region layout. A short producer lock establishes
process-wide packet order. The producer writes a complete record and payload,
then atomically publishes its write cursor. The single consumer reads
committed bytes and advances the read cursor only after the API adapter accepts
them. Unsigned cursor differences permit wraparound. A full ring applies
backpressure; failed consumers or shutdown wake parked producers with an error.

Wake-ups are coalesced while the consumer is active. Clearing the wake flag and
rechecking the cursor closes the empty-queue race; the drain finalizer also
covers publication while an earlier drain promise is settling. Page-side work
never waits on the producer lock.

`allocateProducerId()` reserves a process-wide producer incarnation in shared
control word9. Zero is reserved for the page producer; positive IDs never recycle
when a guest thread slot is reused, and exhaustion fails instead of wrapping.
`DrawProducer({producerId})` includes this identity in its texture keys. These
resource identities are distinct from the routing slot in a publication header.

Large neutral snapshots use `publishSnapshot` rather than copying an arbitrarily
large command into the 4 MiB ring. The adapter supplies a private data-only
snapshot and its charged size (currently `D3DCommandStream.copyPayload`). A
structured-clone/transfer message carries the owned value; an 8-byte `{id,bytes}`
reference in the common ring establishes execution order. Control words10/11
bound outstanding payloads to 64 MiB and 256 messages per process; word12 issues
nonrecycled snapshot IDs. Credits retire only after adapter admission. The
payload-copy preparation is outside these pending-publication credits, and
this route still copies data; it is not a zero-copy performance claim.

`SnapshotInbox` awaits missing payload messages without blocking the page. This
matters when a second producer's wake arrives before the first producer's
payload: later GL/Glide/D3D work must not overtake that reference. Duplicate,
stale and mismatched references fail the process queue; transport failure wakes
credit waiters and rejects pending payload waits. Worker links verify the
message's owner against their routing slot.

API4 references route to `Bridge.submitSnapshot` for D3D9 DRAW/CLEAR commands.
The receiving bridge checks device generation/liveness and consumes any pending
admission token before releasing snapshot credit. Creation, resources, queries,
reset and presentation are not accepted through this entry point yet. A test
drives the actual publication broker and neutral execution path with a payload
larger than its test ring, a delayed consumer, source mutation and stale-device
rejection. The normal guest D3D9 call path is still synchronous until producer
state/resource synchronization is wired; this receiving path alone does not
complete that migration.

OpenGL retains native `gl_object_leave` publication under the shared-object
lock. Removing that native flush would break completed cross-thread texture
visibility. Instead, its host import can capture the bytes into the ring and
return without page admission. Adjacent packets of the same API and producer
are combined up to 512 KiB, rebasing captured-pointer offsets. This is a grouping
limit, not a minimum amount that must accumulate before rendering starts.

Native GL barriers, unknown operations, borrowed inputs, bitmap/child drawable
paths, software GL control metadata and unavailable canonical window ownership
retain synchronous handling. Software GL raster batches still use the common
D3D encoder publication path.
The WebGL Worker path marks the canonical window GPU-owned before publishing.
GDI must then fence prior publications and materialize the GL frame before
reading pixels. Ownership clearing uses a nonblocking empty-ring guard so an
older readback cannot clear a newer producer's dirty mark. Owned snapshots keep
their explicit command buffer even when the render adapter chooses synchronous
execution for an opcode.

When shared publication is enabled, fallback GL submissions cannot lease native
stream slots. Publication lets the producer rotate those slots independently of
renderer completion; mixing a leased fallback with copied publications could
overwrite the lease. Eligible fallback batches instead take an owned snapshot
before acknowledging the producer. The original leased path remains available
when shared publication is disabled.

Glide publishes ordinary batch packets; open/close, swap and readback retain
their existing synchronous contracts. Each Glide packet's execution boundary
is retained, including front-buffer publication. Direct3D publishes descriptors
for already-leased buffers; those buffers still retire through its existing
completion counters. No extra copy of D3D vertices is introduced. Direct3D9's
separate validation/resource operations retain their existing synchronous path.

All synchronous broker requests fence earlier shared publications before
dispatch. Publication admission is not GPU completion. Existing render-worker
fences still implement queries, readbacks and API completion requirements.
Normal thread exit publishes buffered D3D draws and fences admission after DLL
detach callbacks, before reporting exit to the scheduler. Otherwise a producer's
endpoint could retire while its last packets still wait in the publication ring.
Forced process cancellation continues to fail the ring and wake blocked writers.

This implementation still copies GL/Glide bytes into the ring and snapshots
them for render admission. The reader borrows contiguous ring ranges until
admission completes, copying a range only when it crosses the ring boundary.
It removes per-command message round trips; it does
not claim zero-copy native encoding or direct producer-to-renderer routing.
The page remains responsible for drawable routing and presentation metadata.

Validation lives in the existing render lifecycle, GL shared-worker, Glide
shared-worker, GL/GDI composition and Direct3D browser tests. Real producers
exercise wraparound, tiny-ring backpressure, immutable payloads, query ordering,
coalesced wake-ups, cross-API packet ordering, failure wake-ups and dirty-window
ownership. Gameplay evidence and limitations are in `re-notes/half-life-uplink.md`.

## Remaining migration and verification

This is not yet a completed migration of every graphics API. The following
requirements remain open; a passing GL gameplay run does not discharge them.

* **D3D9 producer snapshots:** `guest-rpc.js` still brokers opcodes
  `0x30000..0x30017` synchronously. `d3d9-host.js` validates and snapshots draws
  on the page, then submits neutral commands to the process render Worker.
  Move immutable draw/resource capture to the producer and publish owned bytes
  or leases through the common queue. Passing raw guest addresses asynchronously
  would introduce a mutation race. Keep validation results, readbacks, queries,
  device loss and lifetime boundaries synchronous where their contracts require.
  `d3d9-host.js` now exports a renderer-independent `DrawProducer`; the existing
  bridge inherits it and calls `captureDraw` before submission. The builder
  owns vertex/index bytes, constants, converted textures and shader IR, and
  returns a residency plan that is committed only after admission. A real
  worker test captures from shared memory, then replaces guest vertices,
  constants and texels before consuming the first packet. This separation is
  tested but not yet wired into the guest Worker transport. That wiring must
  supply an ID from `allocateProducerId()`, coordinate device-wide residency/reset,
  and capture attachments and clear/resource packets too. A real-worker test
  verifies two independent producers and a replacement can publish to one
  device without overwriting each other's resident texture definitions.
  Extraction validation: immutable-snapshot tests (including the real Worker),
  texture-cache, byte-identity, source-identity, indexed-access instrumentation,
  fixed-position and real-operation accounting tests pass. The browser pipeline
  fixture is not green: calls96/116/121 return `-2005530516` on both the original
  `e087da397` bridge and the extracted bridge. All captured pipeline fields,
  including pixels and queue counts, compare exactly equal. Evidence:
  `scratch/runs/20261108-d3d9-producer-extraction/{baseline,extracted}.json`;
  harness `scratch/d3d9-pipeline-compare.cjs`. These preexisting rejected draws
  were traced subsequently to the fixture leaving cube samplers at WRAP when
  the LOD atlas requires CLAMP. The positive fixture now configures CLAMP on
  both stages and checks the implemented mixed-filter bias path's actual pixel
  color instead of its obsolete expected rejection. Non-CLAMP atlas behavior
  remains explicitly unsupported and covered by `test-d3d9-cube-lod-web.js`.
  After the fixture correction the full native/browser pipeline passes, as do
  8,880 WebGL1/2 cube-LOD pixel checks (including unsupported metadata checks).
* **Shared device/resource safety:** prove multiple guest producers cannot
  interleave state mutation with another producer's snapshot. Cover device
  reset/release, texture replacement, shared GL objects, and thread-slot reuse
  with delayed consumers and actual concurrent producers. Generic ring ordering
  alone is not evidence for API-level state correctness.
  The D3D9 receiving adapter now requires both endpoint generation and a
  `snapshotEpoch`. Reset increments the epoch before submission and refuses
  snapshots until the guest consumes the reset result and residency is cleared.
  Old epochs remain invalid afterward; a failed reset keeps snapshot admission
  closed until a successful reset retry or device recreation. Pending reset and
  snapshot validity are separate: consuming failure releases the pending flag
  without validating producer snapshots. A pre-admission allocation failure
  must not permanently disable a healthy device's reset path. Tests hold an earlier draw to delay reset,
  reject overlapping resets and old/current snapshots while pending, and verify
  a fresh definition after finalization. This protects receiving-side lifetime.
  Native reset checks creation-thread ownership before touching an existing
  plan, polling a render token or changing device-lost state. A second native
  instance sharing guest memory is tested against both healthy and pending
  resets; it cannot poll or dispose the owner's transaction. The reset and
  presentation regression covers recoverable pre-admission failures too.
  It does not by itself serialize native device setters with producer capture.
  Generated D3D8/9 dispatch now guards synchronous handler execution and owned
  host capture with one process-wide native try-lock. Contention uses the
  existing thunk retry/yield protocol without popping arguments; it never spins
  on the page while a Worker may need page-side RPC service. Nested native
  entries retain the lock until the outer return. A parked render operation
  releases it: command inputs must already be owned before the host returns.
  `test-d3d9-state-guard.js` executes the actual generated dispatcher in two
  native instances sharing memory, checks contention from both sides, nesting,
  retry stack preservation and 4,000 concurrent consistent state updates.
  The real x86 COM/software Worker/Present test also passes. This guard does
  not yet protect multi-phase reset finalization, direct guest writes through
  resource locks, or shared DirectDraw object allocation; those lifetimes need
  explicit coordination before guest-producer activation. Native Worker callbacks
  now use private host opcode `0x30018` to wait locally on the guard rather than
  unwinding their native stack into the bounded synchronous-send loop. Outer
  unlock notifies waiters. The page import returns immediately without blocking.
  Pending publication failure is checked before and after the bounded wait, so
  a failed process is not silently reported as a completed callback.
  `test-d3d9-callback-guard.js` runs a real native callback in a Worker through
  the production import table, checks that nested unlock retains ownership,
  lets the page service a timer during contention, and verifies the same callback
  continues with its result and restored depth. It also checks queue failure.
  The mixed local-main/Worker topology is still unresolved: the local synchronous
  callback loop abandons a contended call after 64 rounds, observed in 0.094ms
  with a 100ms owner hold. Uncontended and post-release controls complete.
  Reproduce with `node tools/d3d-state-callback-probe.js`; the report is
  `scratch/runs/20261108-d3d-callback-contention/probe.json`. A zero probe exit
  is execution success, not callback-retention success (`callbackPreserved:false`).
  Browser threaded execution uses a guest-main Worker and an idle page shadow;
  `test/run.js --threads` still keeps the guest main local. Do not treat those
  topologies as equivalent or block the page to conceal this remaining gap.
  It serializes capture
  across devices but leaves accepted renderer work asynchronous. No performance
  claim is made for the guard; device-level granularity remains a tuning option.
  Bridge `_submit` also closes admission uniformly once device release starts
  (or the entry is dead). Draw-only checks were insufficient: event fences and
  resource retirements could otherwise queue behind destruction. A held-consumer
  regression proves late work is refused without changing queue/request counts
  or poisoning the stream, while the admitted draw and release finish normally.
  This protects the endpoint boundary; it is not proof of every native resource
  reference or pending callback lifetime.
* **2D interoperability:** audit GDI/DirectDraw CPU surface writes, locks,
  blits and presentation against queued GL/D3D/Glide ownership. Existing GL/GDI
  tests cover a subset, not every surface lifetime or mixed-API transition.
* **Software and cooperative routes:** verify equivalent output and ownership
  for the software implementations and non-Worker execution, retaining native
  synchronous semantics without introducing a second rendering state authority.
* **Performance:** measure representative D3D9, D3DIM, Glide and GL gameplay
  separately with visible browsers, one workload at a time. Record CPU and
  renderer timing/overlap as well as presents. The current 6.45x GL corridor
  result is not a cross-API or mobile speedup claim.
