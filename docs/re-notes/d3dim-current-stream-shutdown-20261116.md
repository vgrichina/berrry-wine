# Current D3DIM stream shutdown coverage — 2026-11-16

`node test/test-d3dim-current-stream-shutdown.js` exercises the current
`d3dim-gps` endpoint through `lib/gpu-stream-render-worker.js` and a real
`lib/d3d-render-worker.js` Worker. No production defect was reproduced and no
production repair is claimed. The new test restores runnable coverage without
bringing back the deleted GPU engine.

The historical readback, worker-close and passive-inspection tests remain
unmodified, unadopted WIP. Their module loaders require `lib/d3dim-gpu.js`,
deleted by `51ca79f5dc81d838b29f235776f6137153ce1829`. The old readback test
currently exits 1 with ENOENT. Their historical distinctions—normal completion
before close, cancellation before disposal, late continuations, identity
replacement, and passive observation versus publication proof—inform this
test, but their PBO/fence promises are not current D3DIM capabilities.
The requested `d3dim-async-readback-regression-contract-20261113.md` is absent.
Ownership history and the retained new-file patches were reviewed before
choosing to leave those old tests untouched.

Current contracts and assertions:

- The software adapter executes synchronously. Its routing check uses a real
  SharedArrayBuffer and explicitly scripted exports; that portion is not
  native rendering evidence. Neither an asynchronous adapter fence nor
  post-destroy rejection from foreign WIP is required for this test to pass.
- The stream software executor performs real WAT CLEAR, READBACK and PRESENT.
  Tests compile the canonical full source closure independently, instantiate
  real shared WebAssembly memory, check exact RGBA pixels, readback pitch
  padding and surrounding canaries, and check shared completion sequences.
- A real Atomics.waitAsync callback is held at the supported scheduler boundary
  while published records remain pending. CLOSE drains those records before
  detaching; preserving this behavior matters. A late callback cannot drain
  a reopened ring at the same address (three generations), or another ring
  address. The replacement's ordinary notification still completes.
- Endpoint destruction cancels the deferred drain, leaves pending readback
  bytes and done_seq untouched, detaches the consumer, releases a real SYNC
  producer Worker blocked in Atomics.wait, and permits repeated destruction.
  Late wakes cannot publish a frame/readback or emit a stream error.
- The real process render Worker receives pending requests immediately
  followed by render-close and render-stop. Its serialized queue completes
  the earlier work, emits exactly one frame for each request before retirement,
  acknowledges shutdown, and rejects work after STOP. Reusing an endpoint ID
  completes ordinary work. A subsequent transport round trip provides the
  post-STOP barrier. The deterministic scheduler tests separately force the
  late-callback races; the process-Worker case does not claim a particular
  scheduling race occurred merely because messages were queued together.

The current-tree test and the same test loading committed worker/adapter
sources at `358a20bae58e01713036332cb443426d98cd7b48` both pass. The committed
source loader runs inside the real Worker too. Foreign worker/adapter WIP is
recorded as patches, remains unadopted and is not committed by this task.
An isolated in-memory mutation removing both stream subscription generation
checks fails at `retired generation cannot drain replacement` (done_seq 5
instead of 2). This is test sensitivity evidence, not a reproduced production
defect. The existing doorbell-retirement regression also passes.

The canonical `flock /tmp/wine-build.lock bash tools/build.sh` passed, as did
focused tests, syntax, test-tier membership and timeout checks. Evidence:
`scratch/runs/20261116-d3dim-current-stream-shutdown-crash-coverage/result.json`.
It retains exact Git identity, relevant binary diffs, owned new-file patches,
source hashes, compact output and actual process wait/EOF records. Each run
has a prearmed independent native Python supervisor deadline and process-group
cleanup; the watchdogs did not fire. The process render Worker's STOP retires
its heap but keeps its message port alive; the harness explicitly terminates
that Worker and awaits its exit (1 for requested termination). The SYNC
producer Worker exits normally with 0. No box was created: ID/expiry null,
state NOT_CREATED, stop receipt not applicable.

Limits: the producer is the existing JS byte-for-byte shared-ring fixture,
not a guest D3DIM/WAT producer invocation. Rendering evidence uses the real
software WAT executor, not browser WebGL, native GPU fences, context loss,
ImageBitmap disposal or the removed asynchronous PBO readback engine. Ring
subscription identity is tested; guest surface generation and page publication
joins are not inferred from it. No game, original media or input was used.
Whole27, hardware behavior and general crash freedom remain unproved.

Next work, if requested, is browser WebGL stream lifecycle qualification
against its actual synchronous presentation/readback contract; the old async
test should not be counted as passing coverage in the meantime.
