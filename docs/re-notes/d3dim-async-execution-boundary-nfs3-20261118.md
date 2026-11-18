# D3DIM asynchronous execution boundary, 2026-11-18

The repair is implemented and published in `9191d4afb`. NFS3 driving, Pause,
Continue, and native Quit remain **unverified**: the single authorized original
exited during process-desktop initialization with `ETIMEDOUT`. That scope is
closed, with no endpoint requests or replay. This is not a gameplay pass.

Evidence: `scratch/runs/20261118-d3dim-async-execution-boundary-nfs3/`.
`result.json` is published last. Git holds the source; retained patches, module
hashes, media manifests, logs, selected whole screenshots, and actual process
waits describe the tested variants.

## Implemented boundary

`test/run.js --d3dim-render-owner` enables the Node software route with
cooperative guest scheduling. Unsupported WebGL, stream-dump, and real guest
Worker combinations are rejected. The existing default route is unchanged.

One Node render Worker consumes each shared D3DIM ring. Cooperative host bridges
share that consumer; they cannot race separate executors against the producer.
The consumer instantiates the compiled module in its own native memory and
allocator. Guest memory crosses only as published ring/arena data and completion
slots. An unexpected renderer host import throws instead of entering guest code.
Frames pass through the existing window/present-sequence admission checks.

An opt-in WAT setting publishes successful draws individually. The host import
returns a real numeric i32 and requests the existing soft yield. The API effects,
producer lock release, and normal guest epilogue finish before the next guest
block stops. After the owning main export returns, rendering is awaited
asynchronously; cooperative render threads park individually, leaving sibling
input threads runnable. Synchronous callback pumps observe atomic completion
without requiring a Promise microtask. No Promise crosses the i32 import and no
JSPI suspension crosses a live synchronous callback.

ASYNC returns after publication. SYNC/fence/readback and CLOSE retain actual
retirement semantics and propagate scoped errors. Frames/messages precede the
completion atomic. Cancellation terminates and waits the render Worker before
marking incomplete ring work failed; it cannot publish false completion. CLI
cleanup retires render ownership even when an earlier close fails. The lifecycle
VM fixture now binds `require` relative to `host.js`.

## Verification and limits

All 12 focused suites passed: decoder, ring, shared render worker, render-worker
lifecycle, software executor, bounded D3DIM readback, surface fence, doorbell
retirement, cooperative routing, current-stream shutdown, guest-main owner, and
the new asynchronous execution test. The final locked canonical build passed.
No guard or input deadline was weakened.

The final native raster test executes 64 real 512x512 draws. The old inline
consumer delays an independent event turn **2642.46 ms**; the shared native owner
allows it in **0.876 ms**, against the same 800 ms threshold. Both produce frame
SHA-256 `96b32ecdcd15e42e4bac8606616ef7cf1b6383a13b2606c594ef811998b2778d`,
retire sequence 73 and arena tail 12292, and return identical readback pixels.
The test covers order-dependent final color, numeric nested callback return,
shared-consumer identity, sibling scheduling, atomic callback-pump completion,
SYNC slots, fence, readback, CLOSE, cancellation, and scoped executor error.
A real WAT producer test preserves all three draws while toggling per-draw kicks.

The authored Device2 load32 control exposed the need for both per-draw yields
and main parking. One such run consumed Escape in 678 ms and displayed the
reviewed PAUSED caption; passive maximum synchronous kick was 80.83 ms, versus
2102.18 ms in the preceding failed variant. Independent UP completed 59 ms after
its absolute due time. Its grey caption is not game geometry evidence.

The subsequent shared-consumer regression applied input promptly but missed
native consumption at the unchanged 800 ms deadline. Its application polls USER
once per 32-draw frame. This scope is **UNKNOWN_CLOSED**, with no replay or later
queries. The boundary keeps host service responsive; it cannot promise that an
application with long intervals between USER polls consumes input within 800 ms.
All failed authored scopes remain closed. Earlier zero-GPS reports were observer
artifacts: preloading the supervisor overwrote its child's report. Native stdout
shows GPS activity; the earlier stale-module attribution was wrong. The final
observer is installed only in the native child.

## Authorized original and teardown

The original used published source `9191d4afb`, retained module
`7d347a6a631ab77335a14935a533feb896be71aa2508fc5aa19b1e5df8f096ce`,
accepted chooser export `c08b656b3718682a3a1f4324a08ab689c9444c1daf868c40f4a991cb9f1b9108`,
and all 135 media pins verified before and after. Its Git-memory source loader
and final passive observer are pinned in `original/identity.json`. The module's
inherited foreign WAT changes are preserved in `module-source.patch`; they were
neither adopted nor committed by this worker.

Native PID 2107621 exited 1 with `Process desktop: ETIMEDOUT` during client
`hello`, before game execution or any GPU kick. Source-loader worker startup is
a possible contributor, not an established cause. No subsequent endpoint was
requested. Driving/Pause/Continue/Quit cannot be assessed from this run.

`tools/native-supervise.cjs` records `leaked:false`. Supervisor 2107600 and
independent finite/disk watchdog 2107601 were actually waited, with separate
stdout/stderr EOFs. The watchdog did not fire; minimum sampled free home space
was 2467799040 bytes. All tracked PIDs from all seven native scopes are absent.
No boxes were created: ID null, state NOT_CREATED, expiry null, stop receipt null.
There was no Wine reference, media copy, source archive, deployment, or delegated
worker. Ownership is released after final evidence publication.
