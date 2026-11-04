# Stronghold passive host presentation link, offline 2026-11-04

Extends published `c168d29abab686dcad5a4f73baf17077307184fe`
[passive draw observer](stronghold-passive-draw-observer-20261104.md) in the
existing owning observer and local runtime. Evidence:
`scratch/runs/20261104-stronghold-host-presentation-link/`.
No original attempt, Chrome, game, boat, shared runtime lock, admission renewal,
module authorization/amendment, source/module restoration, deployment or npm.
Box ID/state/expiry: NA; coordinator owns shutdown.

## Original call and actual host paths

The four byte-pinned original conditional CALL blocks and their saved stdcall
returns retain target, object/vtable, source object, manager, HRESULT and
preceding draw return. The preceding draw is still only a temporal candidate.
New passive wrappers observe the owning `dx_trace`, `gdi_surface_attach` and
`gdi_surface_upload` imports during that exact native call interval. Requests
retain the native entry sequence, original arguments/result and object/source
slots read through the existing guest translator. No guest data is written.

An additional native fixture exposed a gap in the old synthetic target tests:
the interpreter dispatches API thunks before `log_block`
(`src/13-exports.wat`, `$run`). Cached dispatch can leave exported EIP at the
CALL block during the import. The new wrapper checks the existing
`com_callback_get_thunk` and `thunk_word` exports for the actual COM marker and
append-only API id 1006 (`IDirectDrawSurface_Blt`), then verifies the same
original saved return, object/vtable and target at the first owning import.
Its row says `owning-import-entry`; it never invents a block or increments the
boundary count for this observation. Ordinary x86 targets retain block-entry
observation. The saved caller/ESP return still supplies the actual HRESULT.

Inspected normal pipeline:

* `src/09a8-handlers-directx.wat`: `$dx_from_this` reads object+4 for the
  DirectDraw slot. Blt emits kind 12 with destination/source slots. A primary
  present emits kind 5 with destination slot and canonical DIB address.
  The fast path binds canonical surface id `0x200000 + slot`, attaches it to
  `$dx_surface_target_hwnd`, and requests an upload. Shared-window, child and
  clipped paths instead blit through a window DC.
* `lib/guest-rpc.js`: `dxTraceLocal` filters/coalesces trace sightings;
  `gdi_surface_upload` always queues an asynchronous call and immediately
  returns synthetic 1. `serveCall`/`serveCalls` retain endpoint slot, but carry
  no unique original-operation identifier. An import return or ACK is not a
  page upload completion.
* `lib/host-imports.js`: upload looks up `surfacePresentations`, attaches the
  actual canvas to `targetHwnd`, advances its version/write sequence and marks
  the canonical surface dirty. The surface's storage buffer/offset, not its
  sampled color, identifies backing memory. This is still not composition.
* `host.js`: `_presentDxIfDirty` may call `presentBestDxOffscreen(true)`;
  `_presentNow` uploads dirty DX state and calls renderer `flushRepaint`.
  Their truthy results alone do not identify a surface/window or establish
  composition. Frozen stepping may invoke this normal path; the observer
  does not invoke it.
* `lib/renderer.js`: `flushRepaint` may defer/skip. `repaint` guards Worker
  publication and reentrancy, calls `_repaintOnce`, publishes the display and
  advances `_immutablePublicationSequence`. The passive hook watches normal
  drawing calls and the original completed `repaint` return, rather than
  treating a flush request as completion.

## Page observation and deliberately limited join

After exact existing Worker target/session discovery, before native arming,
the local composition installs page hooks on the existing `wine` host, its
broker, original import table, GDI map, renderer and drawing context. Broker
call scope records endpoint slot; calls outside that scope have unknown slot.
Successful original upload completion records actual surface id, presentation
object, canvas, window object/HWND, version and storage offset. It checks that
storage aliases the host memory, and the window's instance/memory/process id
belong to that host. Locally assigned object IDs distinguish HWND and canvas
reuse within the observation epoch.

Only an exact presentation canvas actually passed to the normal renderer
`drawImage`, followed by an advanced publication sequence and successful
original repaint completion, becomes a renderer member. The join requires
matching native kind-12 slots, kind-5 DIB address, native attachment HWND,
canonical surface id, zero HRESULT, successful page upload, endpoint zero,
owning memory/window and identical version/object/canvas/window/destination
identities at completed composition. Shared-window blits, DX frame layers,
intermediate canvases and WebGL paths that lack these exact identities remain
unknown. Fallback and host present completion rows explicitly have null
surface relations; no ownership is inferred from their return values.

Even a successful join says **structural candidates only**: matching slot and
storage address plus a completed page upload and exact canvas draw. Allocation
generation across realms and the unique native-operation-to-RPC-upload link
remain unknown. The unmodified RPC transport cannot prove which repeated or
queued upload came from that native call. The code does not pair records by
wall time, ACK or proximity. `operationCompletion` and `freshPixels` stay null;
native `presentation.hostRelation` stays null, and readiness/pixel acceptance
remain false. No normal-frame fence, forced flush/render, new input, or fade
classification is introduced.

The existing screenshot call is bracketed by passive page tokens. Only an
unchanged epoch, sequence, completed frame and zero pending async calls admits
the external screenshot name/hash as a capture bracket. A changed frame,
upload, pending call, missing frame or stale epoch rejects that bracket. The
screenshot's browser raster/pixel relationship remains explicitly unknown;
this metadata is not a fresh-pixel witness or a personal image review.

## Bounds, transparency and lifecycle

Native rows use the existing continuous 50M boundaries / 360s / 2048 records /
1 MiB budget. The separate page report has at most 2048 rows / 1 MiB, at most
16 pending async completions and 16 exact canvas members per frame, and ends
by the earlier existing deadline or 360s after installation. The join retains
at most 16 candidates and stops after 8192 candidate comparisons; oversized
reports reject. No existing native, navigation, command, owner, input, ACK,
16ms, 512/544, frozen-review or production deadline/config limit is raised.

Wrappers forward original receiver, arguments, return object, Promise and
thrown error unchanged. Async requests remain pending until the original
Promise settles; observing completion does not replace the returned Promise.
Observation faults terminate evidence without replacing a function's result
or error. Terminal/deadline/owner replacement restores only wrappers still
owned by this observer. Late async settlements cannot add terminal records.
Attachment cleanup also uninstalls page hooks; native cleanup is attempted
even if page cleanup fails. Owning-session detachment requests page cleanup.

## Offline verification and remaining original witness

The shipped OS Worker fixture executes all previous original draw/fade and
four surface instruction cases, including a failing HRESULT and early return.
It additionally executes an original conditional CALL block against the
actual shipped Blt API thunk, with initialized synthetic COM/table/DIB/rect
data and fixture broker replies. This proves native thunk/import recovery,
not a real surface/window or historical game draw. Both canonical and compat
module variants compare observer off, trace only and observer on: common
Worker command prefix, registers, whole memory hash, results and slice counts
match. Each module is read once in memory per fixture; no modules are copied.

Independent host pipeline mocks drive normal producer methods, not observer
record APIs. They compare off/on call/result/memory state and test wrong
surface/source/window/HWND/owner/epoch/storage/canvas/version/destination,
failed HRESULT/upload/present, pending/rejected async completion, stale capture,
terminal/uninstall/late completion, record/byte/deadline bounds and receiver,
Promise and exception identity. A page VM runs the exact serialized production
controller. The full local entry test still uses its plain Puppeteer mock,
independent spawn-FORBIDDEN guard, private fixture flock and real temporary
HTTP server with normal cleanup: ZERO Chrome. Its two module pins and fixture
clock are fixture identity only, not acceptance of the preserved historical
filesystem/HTTP closure. Production authorization remains expired.

Focused observer and local runtime tests and the required
`flock /tmp/wine-build.lock bash tools/build.sh` pass. Run evidence records Git
SHA, relevant binary diff, this new note's patch, and existing input/module
paths with SHA-256. Git remains the source archive; there are no source
snapshots, tars or media/module copies.

Still required, under separate future authorization: stable published
source/module correspondence and complete original filesystem/HTTP/composed
entry preflight; actual same-history original draw/update/late-clock/return,
taken original surface target/source/HRESULT, a provable unique transport and
allocation-generation relationship through successful normal host upload and
renderer completion, and independently reviewed fresh pixels of that same
draw/window/frame. This task supplies offline passive instrumentation and
structural discrimination, not that original witness or a gameplay claim.
