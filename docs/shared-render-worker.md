# Shared graphics render Worker

> **2026-11-16 (gl-retire S3):** the OpenGL endpoint described below is gone.
> WAT owns software GL contexts (`src/09a8cw-gl-wgl.wat`) and GL reaches the
> render Worker only as GPU stream v2 rings; `lib/gl-render-host.js`,
> `lib/gl-render-worker.js` and `lib/gl-software-producer.js` are deleted.
> The OpenGL sections remain as history of the queue design.

## Common submission queue (2026-10-21)

`RenderWorker.SubmissionQueue` now owns packet admission credits, FIFO waiting,
ordered asynchronous execution, draining and sticky execution failures for
OpenGL and Glide. Legacy D3D/software GL uses its synchronous reservation and
completion interface around the existing atomic acknowledgements. All paths
continue through the same process Manager and globally ordered render Worker.
There is one queue implementation, with per-producer capacity accounts; guest
Workers cannot share JavaScript queue objects with the page broker.

Admission happens before copying or leasing input. The queue distinguishes the
value returned at acceptance from the promise that retires payload readers.
Failed execution retains its capacity ticket and storage lease; a successful
acknowledgement releases capacity only after any readback copy-back. Explicit
GPU fences remain API operations. Closing rejects new admissions and drains
existing waiters. Waiting metadata is bounded to 1,024 entries per queue.

OpenGL retains two pending packets and its ordered GDI/query barriers. Glide
retains three slots and exclusive oversized packets, including the synchronous
fast acknowledgement used by pipelined draws/swaps. Legacy atomic producers
retain three slots and their existing 75%-full/idle-consumer batching. Packet
sizes, command formats, WASM and dispatch thresholds were unchanged by that
queue refactor. The subsequent default GL dispatch threshold is 512 KiB (below).

D3D8/9's neutral resource/receipt queue remains a separate higher-level layer
on the common process transport. Its resident texture ownership and generation
rules are not replaced by transient packet credits. This change unifies packet
submission machinery; it does not claim a single binary encoding or an FPS gain.

Validation covers FIFO/exclusive admission, capacity before snapshot, rollback
before publication, failure quarantine, stale tickets, bounded waiters, draining
close and ordered readbacks. Existing GL, Glide, legacy readiness, software GL,
D3D9 and process lifecycle regressions pass. Actual Chrome mixed-backend testing
passes with one Worker, one heap adoption, and both Glide WebGL/native software
routes wrapping all three slots with readbacks. This is functional validation,
not a new WC3 gameplay performance measurement.

## Shared packet ownership (2026-10-20)

The first migration implements common packet ownership, not a common opcode
format or a replacement scheduler. `RenderWorker.SharedPacketPool` registers
bounded shared spans and provides immutable identity leases. It rejects overlap,
double claims, stale releases and retirement with live leases. API adapters
originally owned admission, publication, completion and error handling; the
common submission queue above now supplies the reusable lifecycle. Registration
uses the canonical shared buffer, not independently cloned SAB wrappers.

OpenGL now optionally encodes directly into three allocator-owned 2 MiB WASM
slots. The two extra slots are lazy (4 MiB per active producer); allocation
failure retains the original single-buffer copied path. The existing two-pending
limit releases the oldest slot before acknowledging the third publication.
Only safe asynchronous batches use leases; queries, borrowed inputs and software
paths retain their barriers. Worker replies follow pending-geometry flush, so
slot release does not invalidate deferred vertex views. Publication carries
offset/length into the already-shared memory, not the entire memory buffer.
`?gl-copy` retains the copied transport for comparisons.

As of 2026-10-21, the GL encoder submits at a soft 512 KiB watermark while
retaining 2 MiB slots. Generic records flush preceding work before crossing
the watermark; packed draws submit after the complete record and software
consumption. Large records can exceed the watermark. Query/finish barriers and
lease ownership are unchanged. This promotes the exact WC3 active-movement
candidate (`5812db90…`); see the gameplay notes for measured FPS and limitations.

Legacy D3D uses the same helper around its existing three shared buffers and
atomic replay acknowledgements. Glide uses three 1 MiB shared snapshot slots:
credit is reserved before copying guest bytes, and the Worker reads the shared
snapshot without a second transport copy. Full pools park producers; oversized
LFB packets reserve all credits and wait for completion. Readback copies back
before releasing storage, close drains admitted work, and failed requests
quarantine leases until endpoint retirement.

D3D8/9 neutral commands are not migrated. Their backend retains some texture
pixel arrays for later draws; recycling those packets after one execution would
corrupt resident textures. Transient vertex/index uploads and resident texture
ownership need separate lifetime rules before adopting the pool.

WC3 gameplay runs `20261020-wc3-packets-{copy,shared}` used identical dispatch
boundaries and WASM `cd3b43cf…`. Shared transport recorded 3,304 leased batches
and zero batch-copy bytes; copied transport recorded 4,230,062,784 copied bytes.
These counters cover launch through the end of capture, not just the timed
window. The 20-second samples measured 25.85 versus 27.03 presents/s with unequal
host load; this is functional/copy-removal evidence, not a confirmed FPS win.
Matching ARM64 V8/SpiderMonkey review is in
`20261020-wc3-shared-packets-native`; init frames and the Ion flush frame grow.

The actual browser regression `test/test-shared-render-worker-web.js` also
exercises Glide WebGL and native software alongside GL/D3D9. Each Glide route
wraps all three shared slots, parks a fourth submission, poisons reused guest
input, checks RGB565 readback and presentation pixels, then closes without
retiring peer endpoints. One physical Worker and one final heap adoption remain.
Evidence: `20261020-common-packets-browser` (synthetic backend test, not gameplay).

### Remaining transport design

The following design describes further unification beyond the implemented pool.
The process already shares a physical Worker, renderer WASM instance,
scheduler and heap retirement. The remaining duplication is producer-side
storage, admission, acknowledgements and error handling. Keep the API
encoders and execution adapters; share the machinery beneath them.

### Current paths

| Path | Storage and publication | Important constraint |
| --- | --- | --- |
| OpenGL | Three optional WASM slots, offset-only publication and completion leases. Queries/borrowed inputs block. | Two pending acknowledgements protect the next producer slot. |
| Glide | Process-locked WAT stream copied into three shared snapshot slots. | Admission precedes snapshot; direct WAT encoding remains future work. |
| Legacy D3D/software GL | `d3d-command-stream.js` rotates three 2 MiB shared buffers with atomic replay acknowledgement. | Snapshots still copy into the pool; native replay copies into private WAT scratch. |
| D3D8/9 neutral commands | The same file also contains `CommandQueue`: copied object payloads, resource leases, generations and receipts. Worker publication structured-clones them again. | This is a separate transport, not the legacy buffer pool. The synchronous trusted-owned shortcut is not a general asynchronous ownership contract. |

`render-worker.js` already owns endpoint lifecycle and global admission limits;
`d3d-render-worker.js` serializes execution to protect native scratch across
APIs. Preserve those owners. Do not create another physical worker or bypass
the shared scheduler to obtain a faster producer path.

### Shared contract

Extract API-independent admission/lifecycle rules from `CommandQueue`, rather
than forcing every API through its current D3D opcode whitelist. Combine them
with reusable buffer slots derived from the legacy pool. A slot ring is a
simpler first implementation than a variable-length byte ring: existing WAT
records expect contiguous storage, and large records must not straddle wrap.

The proposed descriptor carries endpoint, owner, generation, sequence,
encoding version, slot lease, offset and length. Adapters validate their own
record format and return values. The common layer supplies:

- Capacity reservation **before** snapshotting or retaining data, including
  producer-side queues. Account for storage once across reserved, queued and
  active ownership; bound command metadata and total per-process allocation.
- Explicit slot leases: free → writing → published → released → free.
  Publish only complete records, with atomic ordering on shared memory.
  Validate range, sequence and generation; handle counter rollover explicitly.
- Separate acceptance, payload release, API execution and explicit fence
  completion. A message being received is not permission to reuse its bytes.
  Ordinary draw completion also does not universally mean GPU completion.
- Resource-version leases distinct from packet storage leases. Preserve
  resource lifetime until the adapter's relevant completion point.
- Worker-side atomic waits and page-side Promise-based waits. Never block the
  browser main thread with `Atomics.wait`, and never return a Promise through
  an existing synchronous cooperative WASM import.
- Sticky failures, waking blocked producers, generation-safe late replies,
  and retirement only after execution/termination proves storage is unused.
  Endpoint close must preserve peers and the existing single heap handoff.

The existing neutral receiver sends `consumed` **before** invoking its
executor. That is an ownership acknowledgement for an already-cloned object;
it must not become a shared-slot release signal unchanged. Likewise legacy
`COMPLETED` means ordinary replay retirement, with separate materialization
fences. Use explicit payload-release acknowledgements in the new protocol.

### Removing copies and preserving overlap

For Glide's next phase, follow GL and allocate leased slots inside shared WASM linear memory and
encode directly into the current slot. The WAT encoders cannot directly write
an unrelated JavaScript `SharedArrayBuffer`; simply extracting D3D's existing
external pool would still require a whole-stream copy. Use allocator-owned,
validated spans rather than new hard-coded memory-map addresses. Allocation
is lazy and charged against a process budget; do not reserve three large
buffers for every idle guest thread.

Publishing then sends a small descriptor, not a copied command buffer.
Initially preserve the existing broker/control route; direct producer
notification is a later optimization that must retain cross-endpoint ordering,
context ownership, GDI/readback barriers and shutdown coordination. Binary
D3D9 uploads can use the same leases while small structured metadata remains
API-specific. Guest inputs still require snapshots when the game may mutate
them immediately, and native software replay may still need private scratch.
This removes redundant transport copies, not every data copy in rendering.

An adapter releases a slot only when no pending draw, software continuation
or upload references it. GL's `enqueuePacked` retains typed-array views until
`flushPendingDraw`; removing the current end-of-batch geometry flush therefore
also requires retaining the corresponding slot leases. Bound that retention
and flush pending geometry when necessary to release capacity, or the pool
can deadlock. A storage boundary should not automatically be a GPU finish.

Dispatch policy is separate from storage. Legacy D3D already submits when
its consumer catches up, in addition to a size threshold. Evaluate a bounded
size/age/consumer-idle policy for the common path, without polling per vertex
or issuing a message for every draw. Worker wakeups should be coalesced with
a protocol that cannot lose an empty-to-nonempty notification. A GPU flush,
where needed to submit work, remains distinct from a blocking GPU finish.

The WC3 experiment in `20261020-wc3-gl-dispatch-{control,512k}` demonstrated
renderer replay starting about 16 ms earlier and a median finish wait falling
from 4.4 to 1.2 ms, but no FPS benefit in the measured pair. Use that as evidence
for available overlap, not evidence that a pool or smaller batches are faster.

### Migration and validation

1. Extract and test common admission, ownership milestones and failure rules;
   retain existing encoders and API barriers. Include pre-post backlog limits.
2. Add bounded shared slots and migrate GL first, keeping borrowed/query
   handling conservative. Compare copied versus leased packets with identical
   dispatch boundaries before changing batching policy.
3. Migrate Glide under its existing process lock, preserving swap pacing,
   result-bearing calls and LFB readback. Reuse the same storage and lifecycle
   tests; then migrate legacy D3D buffers and D3D9 binary payloads.
4. Tune earlier dispatch and cross-batch geometry combining independently.
   Only then consider bypassing the page for descriptor wakeups.

Tests must cover delayed consumption with producer overwrite attempts, pool
exhaustion/wrap, stale generations, failed enqueue, blocked-producer shutdown,
API query results, readback/GDI ordering, shared software scratch, pending
geometry retaining a slot, cross-API resource fences and one heap retirement.
Build on `test-d3d-neutral-command-stream.js`, `test-shared-render-worker.js`,
`test-glide-render-worker.js`,
`test-d3d9-shared-render-worker.js` and `test-render-worker-lifecycle.js`.
Browser validation should exercise mixed endpoints and representative gameplay
sequentially. Record copied bytes, submissions/wakeups, pool-full wait time,
first replay relative to finish, render time, frame pacing and matched audio
work. Keep cooperative and software behavior in the regression matrix.

## Existing implementation

Threaded browser processes now own one render Worker. D3D 5–7, D3D8/9,
OpenGL and Glide use independent endpoints on that owner. Both WebGL and
software devices execute there; the main thread retains window composition.
The existing cooperative/CLI entry points remain available for hosts that
do not run the guest main thread in a Worker.

```text
guest CPU Workers
  | D3DIM / software-GL snapshots    | GL / Glide batches   | D3D9 commands
  +---------------------------------+----------------------+------+
                                    |
                      process RenderWorker.Manager
                                    |
                           ONE physical Worker
                 +------------------+-------------------+
                 | independent API/device endpoints     |
                 | globally ordered execution           |
                 | one renderer-only WASM instance      |
                 +------------------+-------------------+
                                    |
                         software or WebGL backend
                                    |
                    pixels / transferable ImageBitmap
                                    |
                         main-thread compositor
```

## Ordering and ownership

`lib/render-worker.js` multiplexes virtual ports over the process-owned
`lib/d3d-render-worker.js`. Commands have bounded queue storage. Ordinary
messages are snapshotted before submission. Legacy D3DIM/software-GL buffers
use the existing shared buffer ring: the producer cannot reuse a buffer
until the consumer has acknowledged its sequence.

The worker scheduler awaits each native software draw's completion, including
sliced draws, before another endpoint may use shared WASM scratch. API state,
device identifiers and generations stay within their endpoint namespace.
Separate endpoints do not imply simultaneous execution on the render owner.
Dependencies load once per physical Worker. A completed or failed operation
clears transient native raster hooks before another endpoint executes.

GL query results and borrowed GL input spans remain protected by the guest's
blocking RPC lease until replay finishes. The main-thread broker accepts
Promises and wakes that guest through its shared response slot; it never
uses `Atomics.wait` itself. Glide batches own packet copies, including LFB
readback responses. D3D9 retains its existing command receipts and continuation
tokens.

Legacy GPU draws use the queued state snapshot through
`d3dim_gpu_state_override`, reset after each call. Packet consumption permits
ring-buffer reuse; an explicit fence additionally materializes outstanding
GPU writes before guest pixel access. This avoids a synchronous main-thread
round trip per draw.
Startup waits for the shared renderer's readiness flag on the guest Worker;
initialization and fence failures report errors instead of rendering locally.
The former `?no-d3d-worker` opt-out no longer disables rendering offload in
threaded browser mode.

## Presentation and compatibility

GL, Glide and D3D9 WebGL presentation transfers an `ImageBitmap` from a
separate presentation surface. Persistent drawing attachments survive frame
export. The main thread composes the frame and releases bitmap ownership.
Software Glide sends an owned RGBA frame. Software GL uses the producing
guest's front-surface descriptor, not the render instance's unrelated globals.
The GL reply also supplies drawable configuration through a small shared
mailbox. The guest applies enablement, sizing and bitmap binding to its own
instance before continuing; the render consumer never initializes guest-owned
GL state. Software GL bitmap draws fence before returning, preserving their
immediate visibility to GDI and direct guest reads.

Legacy D3DIM retains its fenced DIB presentation in this change. Its Flip
still reads GPU pixels into shared memory before swapping the native surface
chain. Moving rendering to one Worker does not by itself remove that readback.
GL bitmap drawables and GL/GDI composition also preserve CPU-visible pixel
semantics. These cases must not silently receive a stale GPU-only image.

This change does not merge the API adapters into one shader translator or
merge all WebGL devices into one context. It centralizes execution and lifetime.

## Shutdown

Closing a context/device closes its endpoint, not the physical Worker or its
peers. Process teardown drains/closes all endpoints, retires the native render
heap once, adopts the returned free list, and then terminates the Worker.
Cleanup failures are reported; unsafe heap handoff is not reported as success.

## Validation

Run on the remote Linux box with the current production build:

```sh
node test/test-shared-render-worker.js
node test/test-glide-render-worker.js
node test/test-d3d9-shared-render-worker.js
node test/test-render-legacy-ready.js
node test/test-render-worker-lifecycle.js
CHROME=/path/to/chrome node test/test-shared-render-worker-web.js --swiftshader --no-sandbox
```

The browser test uses real WebGL and the native software shader VM, verifies
pixels and query writes across API endpoints, and checks one physical Worker
and one heap handoff. The protocol tests cover ownership, queue bounds,
completion ordering, endpoint failure isolation and frame lifetime. Original
NFS3 Glide software/WebGL and D3DIM WebGL provide additional gameplay smoke
coverage. SwiftShader smoke timings are not hardware-GPU performance claims.

Validated on 2026-09-29 on the reserved Linux box (4 vCPUs, Ryzen 9950X,
Chrome 152 with SwiftShader), using the feature worktree sources:

- Full build, including its repository gates, passed.
- Shared manager/API protocols, startup/failure waits, shutdown, software GL
  bitmap parity, native D3DIM parity and GL RPC ordering passed.
- The actual browser test verified mixed GL and D3D9 endpoints, textured GPU
  draws and resident texture reuse, explicit readback, native software pixels,
  transferable frame lifetime, one physical Worker and one heap handoff.
- Boids software and WebGL each queued over 5,000 draws with zero local
  fallbacks, exactly one render Worker, and clean process retirement.
- Quake II reached textured gameplay and responded to movement on both WebGL
  and software GL. The software route additionally reported queued GL work and
  native triangles on the shared renderer, with zero local fallbacks.
- NFS3 reached racing on D3DIM WebGL, Glide WebGL and Glide software. Eight-second
  smoke windows measured 20.74, 16.99 and 2.12 FPS respectively. These are short
  functional checks on a software GPU, not a controlled performance comparison.

Remote captures and counters are under `~/nfs-movsd/build/shared-render-final-smoke`
and `~/nfs-movsd/build/quake2-shared-{webgl,software}`. The NFS report's Git field
names the remote checkout base; source files were overlaid from this feature
worktree, so use its recorded source hashes rather than that base commit as
implementation provenance.

### Rebase onto main `01b1f0b9`

The rebase preserves main's API IDs 0–3755 and appends Glide at 3756–3885.
MOVSD uses compiler kind 29 and micro-op 78, leaving main's MMX and switch-table
assignments intact. Scoped D3DIM fences carry their address and length through
both the guest command queue and the main-thread bridge. The completion result
remains 2 when other GPU targets still need materialization; global fences
continue to complete all outstanding work.

Remote validation on 2026-09-29 passed all 23 focused compiler, Glide ABI,
renderer protocol, native parity, lifecycle and texture-cache tests. Chrome
also passed mixed GL/D3D9 software/WebGL rendering and all three D3DIM worker
cases (software, legacy opt-out, WebGL), each using one worker and retiring
cleanly. Logs are in `~/nfs-movsd/build/rebase-tests/`.
NFS3 also reached racing on D3DIM WebGL, Glide WebGL and Glide software;
captures and counters are in `~/nfs-movsd/build/rebase-nfs-smoke/`. These were
functional smoke checks, not controlled performance measurements.

The normal build stops at `union-gate.js` for
`$gdi_bitmap_create_system` at `src/10a-gdi-bitmap.wat:1014`. This same failure
was independently reproduced from unchanged main `01b1f0b9`. A temporary
remote validation driver omitted only that gate: all remaining gates, WATX
compilation of both WASM artifacts and compiled data-overlap checks passed.
The shipping build script is unchanged.

The subsequent rebase onto `f3ec3a2f` includes main's shared GPU dropdown and
opt-in lazy surface synchronization. The remaining build gates and both WASM
compiles passed again, as did the expanded surface-fence test and the browser
GPU-selector test, including Glide's software backend. The selector harness
now mounts `/binaries/` from the corpus and explicitly enables thread isolation.
