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

API4 references route to `Bridge.submitSnapshot` for D3D9 DRAW/CLEAR commands
and owned rectangular color RESOURCE_UPDATE commands.
The receiving bridge checks device generation/liveness and consumes any pending
admission token before releasing snapshot credit. Color creation can accompany
an operation; color/depth retirement also publishes owned API4 commands.
Device teardown, queries, reset and presentation still use the broker. A test
drives the actual publication broker and neutral execution path with a payload
larger than its test ring, a delayed consumer, source mutation and stale-device
rejection. Guarded D3D9 clears and draws now capture in the guest Worker and
publish owned API4 commands. The first call establishes the endpoint through
the broker. Named color targets and render-target texture aliases use shared
owner-admission metadata once their storage exists. Unseen color resources carry
owned initial definitions alongside draws, clears and uploads. Unavailable
lifecycle state and missing guards retain ordered broker handling; device
creation and device teardown publication remain open.

`captureNativeColorDefinition` shares canonical pixel capture between the page
and guest producer. The native guard protects identity, dimensions, format,
lock state and pixels during capture; the complete operation and definitions
are copied and charged before publication. The serial API4 receiver creates
each color ID once per device epoch before submitting its dependent operation.
Duplicate definitions are ignored, including their initial pixels: they must
never overwrite renderer-owned content. Registry collisions can therefore
cause redundant capture, but not resource replacement. A full neutral queue
drains before retrying creation; ordinary creation needs no preceding drain.
Release follows prior publications and invalidates the registry. Startup still needs the broker and delivery of its
endpoint channel before this path becomes eligible.

Validation: 21 immutable snapshot cases include held publication, two different
initial images before admission, post-capture source reuse, and release followed
by re-creation. Generated public x86 COM tests assert that named color creation
actually crosses API4, then check exact geometry and writable-unlock readback
pixels on WebGL and software, normal and compatibility WASM, diagnostics off/on.
Evidence: `scratch/runs/20261109-d3d-color-create-final-{webgl,software}/test-result.json`.
The earlier `-webgl-owned` fixture failed the new publication assertion because
it did not yield to receive the endpoint channel; adding a public Sleep after
the initial clear exercises the intended path. No gameplay FPS claim follows
from these correctness tests.

`captureNativeRetirement` owns color/depth IDs and complete texture color-set
IDs under the same native state guard. Native collection requires the final
external reference and binding to be gone; surface serials are nonrecycled.
The guest can therefore free/reuse its record after publication without changing
the queued retirement identity. The receiver accepts only color, color-set and
depth release kinds, consumes the neutral result, and invalidates color admission
metadata in publication order. It waits and retries on a full queue rather than
dropping retirement. No guest writes the shared admission registry; the page
remains its single writer. Missing endpoint state or guard still uses the broker.

Retirement validation: 23 immutable snapshot cases include delayed record reuse,
cube mip identity capture, wrong-owner rejection and an actually full queue held
behind a draw. Native direct/Worker color-surface lifetime tests pass. Public COM
browser tests restore the implicit target and release the final named target;
the receiver must observe an API4 retirement. WebGL/software, normal/compatibility
WASM and diagnostics off/on all pass with exact preceding geometry/upload pixels.
Evidence: `scratch/runs/20261109-d3d-retire-{webgl,software}/test-result.json`.
These do not prove gameplay performance or the remaining cross-API lifetimes.

Color/depth retirement does not call `glFinish` in either the local or Worker
WebGL executor. Ordered GL object deletion preserves references needed by
preceding commands; it does not require a CPU-visible completion boundary
([WebGL deletion semantics](https://registry.khronos.org/webgl/specs/latest/1.0/)).
Context-loss detection remains, as do explicit fences, readbacks, reset and
device-teardown completion. The local/Worker protocol test verifies these
boundaries separately. `test-d3d9-queued-texture-residency-web.js` queues a draw
sampling a color resource and then deletes that resource (including its sampled
texture composition) before readback. WebGL1 and WebGL2 both retain the expected
pixels and record no added GPU finish between draw and retirement. Public COM
normal/compatibility WASM checks also pass; evidence:
`scratch/runs/20261109-d3d-retire-no-finish/test-result.json`. This removes a
forced synchronization point; gameplay FPS impact has not been measured.

**Native copy publication is active.** `d3d9_color_stretch` captures an
invocation-owned 112-byte packet and dispatches opcode0x30019. The common
page/guest decoder owns resource identities, rectangles and filter selection;
unseen resources carry initial definitions through the same publication path.
There is no source readback, CPU resampling or canonical destination write.
The invocation retains its packet across a broker park and nested calls restore
the parent packet. Completion does not touch native resource dirty counters;
the renderer updates its destination revision for texture alias sampling.
CPU LockRect/GetDC reads still wait and materialize renderer-owned contents.

`D3DCommandStream.colorCopy` validates and owns distinct source/destination
identities, bounded top-left rectangles and point/linear filter selection;
null denotes the implicit backbuffer. The initial contract matches existing
native StretchRect support: A8R8G8B8/X8R8G8B8 targets, no same-resource feedback.
WebGL executes a textured rectangle against renderer-owned color storage.
It explicitly samples source pixel centers, clamps interpolation to the source
subrectangle, preserves untouched destination pixels and forces alpha for X8
copies. It works on WebGL1 and WebGL2 and performs no CPU readback or GPU finish.
Software uses the same contract and invokes the existing native
`d3d9_stretch_pixels` scaler through the new `d3d_software_copy_color` export,
with a bounded renderer-owned temporary packet; it does not implement a second
JS resampler. Both executors retain the actual implicit format across reset.
Previously software collapsed X8 to A8, which loses required copy alpha semantics.

Validation: shared independent color fixtures perform 1,120 checks per route
(software direct/Worker and WebGL1/2), including point/linear up/downscaling,
one-pixel edge expansion, preserved destination regions, explicit/implicit
roundtrips and alpha. Filtered GPU pixels permit one byte of rounding tolerance;
roundtrip ownership/orientation checks are exact. Separate X8 tests assert exact
opaque alpha. A real WebGL1/2 Worker queues COPY, sampled draw and color-set
retirement before readback, retaining exact pixels with no intervening finish.
24 snapshot/contract tests, software backend regressions, existing native
StretchRect/suspend/nested-call tests and the full normal/compat build pass.
The initial tests caught an unsupported `2f` uniform setter (the helper now uses
the existing `4f` contract) and an incorrect test assumption about default A8
backbuffer alpha. Build reconciliation reviewed the earlier DrawProducer factory
addition to guest-worker and updated only its stale callback census hash/review;
callback ownership remains pending. Evidence and source patch are recorded in
`scratch/runs/20261109-d3d-copy-executors/`.

Activation validation additionally checks descriptor mutation before delayed
publication, nested pending calls and absence of readback/upload host opcodes.
The public x86 COM browser fixture copies each rendered geometry target before
checking pixels and requires three published copies per run. WebGL and software
run both WASM builds with diagnostics off/on; evidence is recorded under
`scratch/runs/20261109-d3d-copy-activation-{webgl,software}/test-result.json`.
No gameplay FPS improvement is claimed for this change.

ColorFill (native opcode0x30014) uses `RenderClear.captureNativeColorFill` in
both the guest producer and page bridge. It names its destination explicitly,
owns its rectangle/color, and ignores draw viewport, scissor, channel mask and
depth attachment. It publishes ordinary API4 CLEAR commands, including an
initial color definition when needed; startup fills also deliver the endpoint
channel for subsequent publication. Invalid captures keep the broker's error
path. Delayed-publication tests mutate the descriptor before admission and
verify original pixels/rectangle metadata and scissor independence. The public
x86 geometry fixture uses three ColorFill backgrounds and requires exactly
three published clears before checking its readback pixels on both renderers
and both WASM builds, diagnostics off/on. Evidence:
`scratch/runs/20261109-d3d-colorfill-{webgl,software}/test-result.json`.
Native direct/Worker ColorFill tests cover bound-target independence, subrects,
invalid extents, locks and RGB565 destinations. No new performance claim.

`DrawProducer.captureNativeColorUpdate` is the common page/guest decoder for
the native UpdateSurface upload descriptor (opcode0x30015). It
validates destination bounds, format, source stride/range and allocation budget,
then owns only the requested rows with padding removed. The guest publishes
under the native state guard and checks the endpoint epoch again after capture.
The receiver consumes the neutral update result before retiring its publication
reference. Subsequent readbacks remain ordered behind the upload.
Invalid or unadmitted uploads fall back before publication; an accepted upload
never carries a borrowed guest-memory view.

Validation includes a held-consumer Worker upload with immediate source reuse,
padded32-bit and RGB565 rows, invalid extents/ranges and allocation budget.
Generated x86 public-COM tests (`--color-upload`) upload one pixel, overwrite
the source, and check the original destination via LockRect alongside the
independent geometry oracle. WebGL named-target and software implicit-backbuffer
cases pass on normal/compat modules, diagnostics on/off, with nonzero actual
upload-publication counters. Evidence is under
`scratch/runs/20261108-d3d-upload-webgl` and
`scratch/runs/20261108-d3d-upload-software-format` (`test-result.json`).
The first software fixture rejected UpdateSurface because its hard-coded source
format differed from the implicit destination; the fixture now uses public
GetDesc to select the matching source format. Failed attempts are retained in
the corresponding `-software` and `-software-diagnostic` evidence folders.
Native direct/Worker color surface and shared GL protocol regressions also pass.
These tests establish ownership and ordering, not a gameplay FPS improvement.

Writable surface UnlockRect uploads (opcode0x30011) now use the same owned
RESOURCE_UPDATE publication path. `captureNativeSurfaceUpload` shares native
identity/range validation between the broker and guest producer and packs full
surface rows without padding. Only this upload resolver permits a locked native
record: the native unlock handler holds the D3D guard and clears its lock after
the import has captured/published the bytes. Draw and clear resolvers still
reject locked resources. Read locks/readbacks retain their synchronous broker
result, fenced behind all previous publications. Unadmitted surfaces retain the
existing broker behavior, and a native read-only unlock issues no upload.

The `--surface-upload` generated-PE fixture writes through LockRect, unlocks,
reuses the old pixel storage, and reads back the original uploaded pixel. Every
normal/compat WebGL/software run (diagnostics on/off) records exactly three
published writable-unlock uploads, with no read-only unlock uploads. Evidence:
`scratch/runs/20261109-d3d-unlock-webgl/test-result.json` and
`scratch/runs/20261109-d3d-unlock-software/test-result.json`. Transport tests hold
consumption during pixel reuse, check packed RGB565 rows, wrong-device rejection
and inconsistent native size; all21 snapshot cases and native direct/Worker
color-surface regressions pass. No gameplay FPS gain is inferred from these
correctness checks.

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
completion counters. No extra copy of D3D vertices is introduced. Eligible
Direct3D9 draws, clears, color uploads/definitions and resource retirement use
API4 snapshots described above; result-bearing lifecycle/readback calls retain
their existing synchronous contracts.

Synchronous broker requests with graphics dependencies fence earlier shared publications before
dispatch. Publication admission is not GPU completion. Existing render-worker
fences still implement queries, readbacks and API completion requirements.
The only broker exception currently is `get_mouse_position`: it checks queue
failure but does not wait for render admission. The page still answers the
query after preceding async cursor warps have been flushed in FIFO order;
clipping and active-event coordinates remain page-owned. A warp invalidates
the producer's pointer cache even if the shared input epoch has not changed.
The real-Worker test holds a Glide publication while two clipped cursor
queries complete, then proves a following graphics-dependent invalidate
cannot dispatch until that publication is admitted. Other imports remain
conservatively fenced unless separately proven independent of graphics.
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

* **D3D9 producer snapshots:** `guest-rpc.js` now captures eligible draws under
  the native D3D state guard, with a lazily loaded `DrawProducer`. First calls,
  unadmitted color resources and capture failures retain broker handling.
  Complete the resource migration and publish owned bytes
  or leases through the common queue. Passing raw guest addresses asynchronously
  would introduce a mutation race. Keep validation results, readbacks, queries,
  device loss and lifetime boundaries synchronous where their contracts require.
  `d3d9-host.js` now exports a renderer-independent `DrawProducer`; the existing
  bridge inherits it and calls `captureDraw` before submission. The builder
  owns vertex/index bytes, constants, converted textures and shader IR, and
  returns a residency plan that is committed only after admission. A
  render-target texture uses an explicit `resolveColor` capability supplied by
  the endpoint owner; the builder copies the returned resource metadata. It
  cannot infer GPU color-storage residency from native texture bytes. Missing
  resolution fails explicitly, and the normal bridge creates storage in queue
  order before the draw. This repairs an extraction regression where this path
  referenced the bridge's out-of-scope `ensureColor` helper. The native color
  surface regression exercises sampling rendered pixels through this boundary.
  `DrawProducer.nativeDrawContext` now also owns native color/depth attachment
  and scissor decoding, shared by the live bridge and `captureNativeDraw`.
  Named colors require the explicit resolver; returned color metadata is copied,
  and target-specific dimensions govern default scissor bounds. A real Worker
  captures through this native entry point before guest mutation of vertex,
  constant, texture, depth-identity and scissor bytes, then verifies the original
  packet retains the original state. The live bridge uses the same decoder.
  A real worker test captures from shared memory, then replaces guest vertices,
  constants and texels before consuming the first packet. This separation is
  now wired into the guest Worker transport using `allocateProducerId()` for
  texture-key ownership. Residency belongs to one device generation and snapshot
  epoch; reset creates a fresh cache entry and republishes texture definitions.
  The immutable copy is charged before publication, and residency commits only
  after successful publication. Capture/validation failure falls back before
  publication; publication failure is terminal and never duplicates a draw via
  the broker. A bounded 32KB shared color registry per endpoint carries admitted
  identities, dimensions, format and epoch, never pixels. Its page owner writes
  after queueing creation; release invalidates identity and reset changes epoch.
  Each record has an atomic 64-bit sequence; a reader returns unavailable on an
  odd/changed sequence without waiting for the page. Sequence exhaustion closes
  the channel rather than wrapping. Hash collisions only evict metadata and
  cause repeated owned color-definition capture; they never retire renderer storage. Guest resolvers
  also check native ownership, lock state and matching layout under the native
  D3D guard. Already-admitted targets and aliases need no per-draw page RPC.
  A real-worker test
  verifies two independent producers and a replacement can publish to one
  device without overwriting each other's resident texture definitions.
  Activation validation: production GuestRpc/WorkerLink tests hold publication,
  mutate texels, verify original pixels, reuse resident texture references,
  and require fresh definitions after reset. Missing native guards, invalid
  draws preserve broker handling. Unknown colors now carry initial definitions.
  The generated x86
  multiply-transform fixture's `--default-target` mode exercises the implicit
  backbuffer; normal and compatibility builds each publish two draws without
  page-side draw capture, then public LockRect pixels match its independent
  geometry oracle. Both WebGL and `--software` pass with diagnostics on/off.
  Evidence: `scratch/runs/20261108-d3d-guest-draw-default` and
  `scratch/runs/20261108-d3d-guest-draw-software` (raw test results and served
  module hashes). The original explicit-target fixture now also proves two
  published draws per run and exact readback pixels on both backends and both
  modules; evidence `20261108-d3d-color-registry-webgl` and
  `20261108-d3d-color-registry-software`. Transport tests additionally cover
  admitted alias references (without copying stale guest pixels), named clears,
  release/readmission, collision and reset, and a real Worker reads during
  20,000 metadata updates without observing mixed fields.
  These are correctness tests, not FPS
  or hardware execution-overlap measurements. The older Calc-based fixture
  failed startup on its static server's external binary/DLL allowlist; that
  failure is not counted as renderer validation.
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
  `Bridge.snapshotState(deviceId)` now supplies a shared lifecycle channel for
  that endpoint incarnation. `SnapshotState` in the neutral command transport
  keeps immutable device/generation metadata and one atomic signed 64-bit epoch:
  positive means ready, negative means unavailable, and zero means permanently
  retired. Readiness and epoch cannot be observed from different resets. The
  full JavaScript safe-integer epoch range is retained. Reading an unavailable
  channel returns immediately; producers must fall back or await lifecycle
  completion rather than spinning on the page's progress.
  Reset closes readiness before submission and reopens it only when its result
  is consumed successfully; failed reset and asynchronous renderer failure leave
  it unavailable. Release and bridge close retire the channel before waiting
  for old work. Reusing a device address creates a distinct channel/generation.
  A real Worker regression observes these transitions, including renderer
  completion before guest finalization and reuse after release. The receiving
  bridge still validates every snapshot: reading ready is not a lease against
  a later reset, nor a GPU completion fence. Capturing native state still requires
  the native D3D guard; the readiness signal does not replace it. The broker
  piggybacks channel delivery on an accepted ordinary draw or clear. WorkerLink
  sends it once per device generation and receiving Worker incarnation, using
  the endpoint identity to reject late delivery after replacement. Guest RPC
  caches the channel when its event loop processes the message; until then
  calls continue through the ordinary broker. Reset readiness changes require
  no more messages, while a recreated device or reused thread slot receives
  a fresh delivery. A real-thread test drives the production RPC and WorkerLink
  and checks local reads, reset, recreation, stale generations and slot reuse.
  Draw and named-color-target capture are now wired as described above. Clears
  use `RenderClear.captureNative` in both the page and guest paths, so viewport,
  scissor, rectangle, depth/stencil and attachment validation have one decoder.
  Guest capture requires the current instance's `d3d_state_guard_held()` export,
  a ready lifecycle channel. Named colors use admitted metadata or owned initial
  definitions. Capture copies
  the complete descriptor, checks the epoch again, and publishes through API4.
  Initial calls, older WASM without the guard export, unguarded calls and
  rejected captures retain the ordinary broker. The receiver still
  validates epoch/generation at admission. A real Worker/RPC test delays
  admission, mutates guest color/rectangles, verifies the original clipped clear
  and checks that the eligible call adds no RPC. It also checks named-target
  publication, missing-guard and invalid-input fallbacks. The transport fixture supplies a
  guard test double; the separate native two-instance test proves the production
  export distinguishes the owner, a competing instance and nested/outer return.
  Native color-surface and depth/stencil regressions pass; both normal/compat
  WASM builds pass. No gameplay FPS gain is claimed for clear publication yet.
  The byte-pinned clear-contract test needs its recorded compiler blobs (the
  default compiler has changed since those hash and size pins). It passes with
  `WINE_CLEAR_COMPILER=scratch/clear-pinned-compiler/tools/watx.js`, reconstructed
  from `test/support/d3d9-clear-excerpt-pins.json`; no pins were weakened or changed.
  Delivery validation: all 18 immutable-snapshot cases, GL shared protocol,
  real x86 D3D9 draw/Present/retirement, browser cache graph and reviewed host
  census pass. The broader browser guest-Worker suite passes its threading,
  windows, input, Win16 and playback checks, but its COM-load probe reports
  zero DLL-count increment and zero load address. A focused headless replay
  serving the four changed runtime files from control commit `157b7a991` gives
  the identical result; this is not a newly introduced failure or a passing
  COM claim. Evidence: `scratch/runs/20261108-d3d-state-com/probe.json`, replay
  harness `scratch/d3d-state-com-control.cjs`.
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
  A stronger dependency probe now records both independent Worker release and
  release requiring a message serviced by the local host event loop. On Node
  v24.21.0 at `6b7eeeaf8`, the local callback abandoned the former in 0.126ms
  and the latter in 0.042ms. In both cases its pre-call increment executed once
  but its post-call completion marker stayed zero. The host-dependent order was
  `send entered -> send returned -> host serviced owner request`; both fresh
  sends after release completed normally. Thus restoring the outer registers
  does not roll back the abandoned callback's effects, and replaying the
  callback from its entry would duplicate them. A blocking wait or a larger
  retry limit cannot service the host-dependent owner request.
  Evidence: `scratch/runs/20261109-d3d-callback-dependency/probe.json`.
  Run `node tools/d3d-state-callback-probe.js --require-preserved` to make this
  unresolved condition fail the process; `--output=PATH` preserves separate
  investigation runs. Ordinary diagnostic mode still exits successfully after
  recording the failure, not after proving callback correctness.

  Required continuation work: move saved registers, interpreter/yield state,
  invocation identity and scratch ownership out of `wnd_send_message_inner`'s
  native locals before allowing a local callback to park. Its native callers
  must also retain their remaining work and temporary output lifetimes; merely
  returning a pending result from the inner function would unwind those frames.
  Resume the existing child at its blocked API, not at the wndproc entry, only
  after the host services the owner and the guard can be reacquired. Validate
  same-child completion, exactly-once effects, parent restoration and failure
  cleanup. An owning guest-main Worker keeps this native stack alive using the
  existing local Worker wait and is the browser's current supported topology;
  extending that topology to the CLI is an alternative to a full native-caller
  continuation migration. The probe now supports `--worker-main`, using the
  production `GuestThreadHost`/`guest-worker.js` slot-0 transport under Node
  rather than an imitation Worker import table. With `--require-preserved`,
  this route passes the same independent 100ms hold and host-dependent release
  cases: elapsed 101.615ms and 21.607ms, respectively, with return value 0x1234,
  one pre-call increment, one completion and restored synchronous depth. The
  host-dependent release is gated on the guest's pre-call side effect, then
  delayed 20ms, so it cannot accidentally pass by releasing before dispatch.
  Its order is `send entered -> callback entered while owner held -> host
  serviced owner request -> send returned`. Evidence:
  `scratch/runs/20261109-d3d-callback-owner-gated/probe.json`; the matching local
  control remains a strict failure in `20261109-d3d-callback-local-gated`.
  This validates the Node owning-Worker route for this callback case, not a
  completed migration of `test/run.js`: that runner still supplies
  `localMainExports`, runs local native slices and uses synchronous exports for
  startup, inspection, input and DLL/yield handling. Those operations must move
  to the owning endpoint together; making only its ordinary `run` asynchronous
  would leave guest state mutations on the idle shadow. The production Node
  probe also does not establish rendering throughput or full CLI flag parity.
  The CLI's three ordinary/interleaved slice sites now await the shared
  `guest-main-owner.js` execution boundary. Local calls remain inline; a Worker
  owner delegates to `GuestThreadHost.slice`, `callExport` and `readExports`
  without a shadow fallback. The same boundary drives the production Node
  callback probe. Scheduler observation retains its admitted-main identity
  until asynchronous completion or failure. The runner still explicitly selects
  the local owner while startup, register inspection, input and yield handling
  migrate; this preparatory change alone does not resolve its callback gap.
  PE placement/loading and launch name/drive/arguments now use shared
  `stageAndLoadPeOwned`/`configureExeOwned` helpers in both the CLI and
  `GuestThreadHost.loadPe`. The existing `stagePe` still owns oversized PE/NE
  and self-extractor mapping policy. Placement is read from the selected owner;
  host code only copies bytes, then invokes `load_pe` on that same owner.
  Metadata staging is bounded and setter errors propagate instead of silently
  continuing with the wrong identity. Startup-show setup in the CLI also uses
  the owner, preserving explicit SW_HIDE. Callers must keep startup quiescent;
  these helpers do not replace loader/callback lifecycle ownership.
  `test-cli-main-worker-boot.js` checks both shipped WASM builds with local and
  production Node Worker owners: identical entry/EIP/image base, retained
  metadata and an unloaded host shadow. Evidence:
  `scratch/runs/20261109-cli-owner-boot/test-result.json`.
  The remaining startup setters, compatibility patches and DLL initialization,
  plus inspection/input/yield paths, still require migration before enabling
  a Worker-owned main thread in the full CLI runner.
  Pre-DLL CLI configuration now routes window-handle base, API logging, code
  page, cache layout, process identity, desktop depth, CPU feature switches,
  multimedia-timer mode, network settings, atomic-lock mode, virtual allocation
  limit, CS tuning, DirectX thunk initialization and Windows version through
  the owner. `supports`/`optionalCall` use the selected Worker's compiled
  function-export list, never a shadow instance or an RPC failure as a
  capability signal. Missing module metadata throws; present-export failures
  propagate. Actual local/Node Worker tests on both WASM builds read back CPU,
  code-page, Windows-version and allocation settings, and verify that Worker
  configuration leaves the host shadow's local globals unchanged. Evidence:
  `scratch/runs/20261109-cli-owner-config/test-result.json`.
  Graphics backend attachment, environment setup, compatibility patches,
  remaining debug hooks and DLL initialization still have local
  paths; the CLI continues to select a local owner until all are migrated.
  Post-load interpreter options now share one `visitMain` setting policy
  between synchronous compatibility callers and awaited owner application.
  The owner route validates required exports before applying settings, preserves
  flag precedence and zero values, awaits each call in order, and stops on
  failure. It publishes enabled interpreter-reporting state only after success.
  Presentation cap/vsync/mode, logical-frame registration, spin tuning and
  post-load trace/fault setters also route to the owner. Tests compare local and
  asynchronous command sequences, hold the first setting to detect overtaking,
  and reject absent required exports and real call failures. Normal/compat Node
  Worker tests read back interpreter options and zero spin thresholds while
  proving shadow globals remain untouched. Evidence:
  `scratch/runs/20261109-cli-owner-postload/test-result.json`.
  This moves configuration ownership, not interpreter algorithms or rendering
  throughput. Watchpoint/control callbacks and diagnostic reads still require
  migration along with the remaining initialization and runtime paths.
  CLI renderer shutdown now adopts retired native heap blocks through the
  selected guest owner. `WorkerConsumer` already awaits this handoff after
  renderer termination; the CLI no longer writes the host shadow's allocator.
  Actual Node guest/renderer Worker tests create a software device, verify all
  64 BGRA pixels after clear/readback, and prove exactly one adoption into the
  owning instance after termination with the shadow free list unchanged.
  Local and Worker owners pass on normal and compatibility WASM builds:
  `scratch/runs/20261109-cli-render-retirement/test-result.json`.
  Renderer construction still obtains image-base metadata locally in the CLI;
  this change completes heap handoff ownership, not full Worker-main startup.
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
