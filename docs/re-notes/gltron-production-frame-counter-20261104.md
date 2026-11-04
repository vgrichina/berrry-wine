# Original GLTron production gameplay counter — 2026-11-04

**No gameplay FPS was measured for either backend.** The existing production
logical marker can count the original nonzero-dt gameplay update without raw
callback wall timestamps. The compiled original boundary passed offline tests
in both current modules. Two local launches stopped before gameplay because
this diagnostic's HTTP pin inventory omitted boot dependencies. These were
runner errors, not evidence of a production counter or rendering defect.

The omissions are repaired and tested offline. Both per-backend launch
allowances were consumed; neither backend was retried. No gameplay was viewed,
no before/after gameplay captures exist, and no live gameplay interval or
logical rate is claimed. The remaining measurement blocker is obtaining a
separately authorized fresh attempt using the repaired preflight, then reaching
and personally reviewing gameplay before collecting the bounded interval.

Evidence: `scratch/runs/20261104-gltron-production-frame-counter/`. Git plus
the run's binary diffs and new-file patches is the source archive. Original
media and modules are referenced by existing path, size and SHA-256; no source,
media or module copies, snapshots or tarballs were made.

## What a logical frame means

The unchanged original executable is
`test/binaries/gltron-0.70/gltron.exe`, 180,224 bytes, SHA-256
`85fb5184262490f0b5967c2b12ee27c77da058364e594b0fc86be7b5814e40ec`.
All 92 registered files still match their original hashes and sizes, totaling
4,968,893 bytes. No configuration, guest code, media or pacing was changed.

The exact original `gameCallbacks` table is at `0x42a200`; its idle callback
is `GameMode_Idle` at `0x40518f`. Current callbacks are referenced through
`0x42b230`. After `Time_Idle`, the original code at `0x40519c` loads `game2`
through `0x43d284`, compares its integer `dt` at offset `0x30` against zero,
and branches to `0x4051a9` only when nonzero. That address CALLs `Game_Idle`
at `0x4040de` once. A zero-dt poll takes `0x4051a7` → `0x4051c2` instead.
`Game_Idle` can perform several physics substeps per entry.

The candidate marker therefore means **one nonzero-dt gameplay update entered**,
not a completed update, display callback, swap, screenshot, host step, idle
poll or physics substep. Live attribution additionally requires the correct
instance/main thread and active `gameCallbacks`; static addresses alone do
not establish gameplay.

## Existing production mechanism and compiled proof

`host.js::_setLogicalFrame(address, pace)` arms its instance, the main guest
Worker if present, and other guest threads. `_readLogicalFrameCount()` sums
the main and child per-instance counters. That total cannot by itself identify
which thread entered the candidate. This diagnostic supports the observed
page-main execution route only, reads the main instance directly, and rejects
worker endpoints and any child gameplay count. Other endpoint arrangements
need their own ownership proof.

The decoder places handler 476, `$th_logical_frame`, as the first operation
of the marked block. Block splitting, `$fuse_stop` and op-index poisoning keep
the marker from being swallowed by folds or whole-block rewrites. The uop
compiler excludes that address from a program, exiting back to its threaded
block. With `pace=0`, the marker increments the lifetime unsigned i32 counter
and reads guest ticks, without sleeping or changing the global debug guards.
Changing its address requests a decoded-cache recycle. The setter does not
reset the lifetime count. Production source has only the increment assignment
to that counter; a fresh instance has a new observation generation.

`probeCompiled` loads the exact original PE and executes its original compare,
branch and CALL instructions through the actual compiled interpreter. Only
fixture registers, stack and data are initialized; executable bytes are never
patched. Ordinary one-block budgets stop before running the callee. Across
chaining/uop settings 00, 10, 01 and 11, repeated dt values 0/16/0/1/32 count
0/1/0/1/1, with correct original branch/callee endpoints, zero debug-tier
guard and no sleeps. The actual host setter/reader methods are exercised
against that instance. Disabling/rearming also exercises cached marker removal
and lifetime-count preservation.

These tiny original blocks being tested with uop enabled does not mean they
entered an installed uop program. The existing
`test/test-present-logical-frame.js` separately passes 50 checks per module,
including a hot loop that actually installs and enters the uop tier while
preserving the logical marker boundary. Neither fixture is gameplay timing.

Both tested module paths remain available:

| Module | Bytes | SHA-256 |
| --- | ---: | --- |
| `build/wine-assembly.wasm` | 2,148,150 | `78a0b1d61b23428a1ae909d739440ae0de059bbbd84a69a2ad3e4c37471ad664` |
| `build/wine-assembly.compat.wasm` | 2,150,763 | `99b579cd17b57f94145df92ae6d28110f24fc284d13a1b2c0ebe3596bd10a77f` |

No host/lib/src repair or additional production instrumentation was necessary.
Unlike `trace_eip` and `set_count`, the existing marker does not globally disable
the normal tiers. The previous note's requirement for per-callback wall
timestamps was unnecessarily restrictive for an average FPS measurement.

## Counter-delta measurement contract

The executable diagnostic is `tools/gltron-logical-fps.cjs`; the bounded local
driver is `tools/gltron-logical-fps-local.cjs`. The page adapter retains the
actual host, instance, memory, thread-manager and observed instantiation
generation references. It requires main thread ID **1**, checks instance
replacement and visibility/frozen transitions, and samples active callbacks,
marker address, pacing and execution-tier settings. Guest pointers are read
using that instance's `guest_to_wasm`, with raw guest addresses, translated
offsets and values retained. An arbitrary observation may have dt=0: the
original branch filters events, not a host poll's dt snapshot.

Every synchronous main-counter getter is bracketed by `performance.now()`
in the page's monotonic clock domain. The diagnostic retains raw unsigned
counts and read brackets, samples nominally every 250 ms, rejects reads over
5 ms or observation gaps over 1,500 ms, and accepts only an interval whose
minimum elapsed bound is at least 5 seconds and maximum is at most 10 seconds.
It bounds storage at 64 observations. Counter reset, stale generation, wrong
owner/scene/marker, pacing and tier changes fail closed. A single unsigned wrap
is accepted only near the wrap seam and under an explicit 40,000-frame delta
bound; larger or ambiguous deltas fail. Synthetic wrap/reset/rate fixtures are
tests, not measurements.

For start bracket [a0,a1], end bracket [b0,b1] and count delta N, elapsed time
lies in [b0−a1,b1−a0]. The diagnostic reports the midpoint rate and the resulting
enclosing rate bounds. Those are observation-timing bounds, not confidence
intervals or uninstrumented-performance estimates. No poll timestamp is
relabeled as a callback timestamp. Endpoint identity is checked at every
observation; a scene transition entirely within a guest slice is unobserved.

Instrumentation overhead includes the marker dispatch, tick read, enforced
block/uop boundary, one cache recycle when arming, and periodic ownership and
counter reads. The adapter records its read duration. A future reported rate
would include that overhead and the initial cache recycle. Module hashing
occurs before the measurement; the renderer-reference hook removes itself
after its first call. There are no per-draw hooks or globally debug-disabled
tiers. No overhead percentage was measured.

## Actual attempts and remaining limitation

The MDK poll-history worker released local resources at 18:53:13Z and the
new Stronghold current-hover worker explicitly released at 18:58:20Z. Runtime
began only after both releases, using `/tmp/wine-local-runtime.lock` for both
sequential arms, with 180 cumulative browser seconds and 180 cleanup seconds
reserved before the 21:15Z/21:18Z cutoffs.

| Requested arm | Actual result |
| --- | --- |
| Software | The runner's seal omitted `manifest.webmanifest` and the five stock `.fon` files; requests received HTTP 500. Startup never reached an emulator instance or gameplay. Chrome PID 951345 exited 0, signal null. |
| WebGL | The repaired font inventory passed, but the seal still omitted local `stdole2.tlb` and the shared `msvcrt.dll`. It stopped during startup. Chrome PID 956338 exited 0, signal null. |

The WebGL arm's actual loaded main module hash matches the canonical module
above. `webgl/ready.json` records page-main cooperative execution, generation
1, thread 1, uop enabled, chaining disabled and debug-tier guard zero, but
callbacks/game2 pointers and logical marker/count are all zero. It records no
GL context and no owning rendering bridge. **Requested backend is not an
observed active renderer.** No backend/context/renderer performance comparison
can be made. Both arms sent zero gameplay inputs and never armed the marker.

The first software capture request made after closure received connection
refused. The queued WebGL startup capture was not executed because the first
seal failure stopped its command loop. No image was available to personally
view, and no screenshot or gameplay review is claimed.

Total Chrome time, including closure, was **18.705 seconds**. Both direct
`Browser.close` requests were followed by actual owned child exits with code
0 and no signal; the helper sends no process signals or process-group kills.
Both owned Node/Chrome pairs were absent afterward and HTTP ports 36407/33143
refused connections. Local heavy resources were explicitly released at
19:05:41Z. Box ID/state/expiry: **N/A**. Coordinator retains future box and
shutdown ownership; no boats/API/SSH runtime, installs, allocations, subworkers
or deployments were used.

The final preflight derives required stock fonts and system data from the
production boot lists and the shared CRT from the production DLL registry.
Focused tests reject each omitted/stale boot pin before Chrome. All **365**
recorded requests from the two failed arms match the repaired inventory by
path/hash. This is an offline regression, not a successful new launch or a
proof that every future request is known. Original failures remain preserved.

Final validation: 37 focused checks, original registration check, syntax/diff
checks, both compiled original-path probes, 50 existing tier-boundary checks
per module, and the locked full build. Logs and exact source pins/patches are
in the run. No production gameplay counter defect was demonstrated. A fresh
authorized runtime must still validate the owning active gameplay scene and
collect personally reviewed before/after captures plus its >=5-second raw
count/time interval. Stop here under the no-retry instruction.
