# Original GLTron logical gameplay timing — 2026-11-04

No logical gameplay FPS was measured. The offline investigation stopped at the
first instrumentation dependency, before acquiring the runtime lock or launching
either browser arm. A static gameplay boundary is identifiable in the original
executable, but the audited production interfaces do not establish an authentic
live stream of its callback wall timestamps while preserving the normal
execution tiers. No screenshot, present, host-step, idle-poll or physics-substep
rate substitutes for that missing measurement.

Evidence: `scratch/runs/20261104-gltron-logical-fps/`. The initial inspected main
was `7bd2cd305eca803c3463ac0bd10fc174b8a4e9e8`; the final audit/build source pin
and relevant binary diff are recorded in `provenance.json`. Git and those patches
are the source archive. Owned new files have individual new-file patches. No
source snapshots, new archives, media copies or module copies were created.

## Original boundary and ownership requirements

The existing `APPS.gltron` registration points to the unchanged original
`test/binaries/gltron-0.70/gltron.exe`, SHA-256
`85fb5184262490f0b5967c2b12ee27c77da058364e594b0fc86be7b5814e40ec`,
180,224 bytes. `offline-audit.json` verifies all 92 registered file sizes and
SHA-256 values at their existing paths (4,968,893 bytes). Configuration and
controls were untouched, including `settings.show_fps = 0`.

The retained original source archive was read in place, without extraction or
copying: `scratch/runs/20261030T2210Z-gltron-render-after/gltron-source.tar.gz`.
Its path/hash and the previously retained source-excerpt path/hash are in the
provenance record. These source names explain the code; byte checks and the
retained disassembly tie the findings to this exact original Win32 executable.

| Original VA | Meaning established offline |
| --- | --- |
| `0x42a200` | `gameCallbacks` table: display `0x40eef1`, idle `0x40518f`, name pointer `0x424b98` (`game`) |
| `0x42b230` | Current callbacks pointer, assigned by `SystemRegisterCallbacks` at `0x4104ce` |
| `0x41049f` / `0x4104af` | Main loop calls current display or current idle, respectively; these are separate branches |
| `0x40518f` | `GameMode_Idle`: sound idle, then `Time_Idle` at `0x4032df` |
| `0x4051a1` | Tests `game2->time.dt` at offset `0x30`; zero returns without a gameplay update |
| `0x4051a9` | Nonzero-dt branch calls `Game_Idle` at `0x4040de`, then video, input, scripting and post-redisplay |
| `0x43d284` | Pointer to `game2`; a guest VA, not a fixed Wasm-memory offset |

`Game_Idle` contains a bounded-dt physics loop, so several physics substeps can
belong to one nonzero-dt update. The idle callback entry also includes zero-dt
polls. Counting either as logical gameplay frames would answer a different
question. The nonzero-dt branch is a static candidate for one gameplay update;
its live ownership and correspondence to the active gameplay scene remain
unverified. Display callbacks remain a separate measure.

The earlier current paired rendering note establishes historical page-local
`Bridge.local` / `OpenGLHostBridge` rendering. It does not prove the current
launch's endpoint. A valid future event must establish the actual owning host,
instance/memory, main thread, generation, active `gameCallbacks` pointer and
nonzero dt at the event. The original guest memory must be translated through
that instance's production translator. This task has no live endpoint evidence.

## First concrete blocker

`APPS.gltron` supplies no `perf.logicalFrame`. The actual production host's
`_normalizePerfLogicalFrame` returns null for that registration. Setting a
candidate address would establish neither its active scene nor its owner.

The existing `$th_logical_frame` marker counts entries and saves a guest-clock
millisecond value; it does not emit raw callback wall timestamps. The HUD polls
aggregate counts every 500 ms. Poll timestamps cannot be relabeled as callback
timestamps, and guest-clock pacing is a separate measure.

The audited per-entry route is `set_trace_eip_range` → `$host_log_eip` →
`window.__waProfileEipHit`. In `src/13-exports.wat`, the setter calls
`$dbg_recompute`, which puts `trace_eip_flag` into both `dbg_chain_guard` and
`dbg_tier_guard`. This routes block transfers through the debug desk and prevents
micro-op-tier loop execution throughout the interval, even for a one-address
trace range. It could support a diagnostic trace, but its rate would describe
that altered execution mode. It cannot establish the requested unchanged
production timing. No tracing setter, marker setter or guest write was issued.

`tools/gltron-logical-fps.cjs` therefore performs a read-only offline admission
audit and explicitly returns `NO_UNCHANGED_PRODUCTION_CALLBACK_TIMESTAMPS` with
`logicalFPS: null`. Its small bounded collector preserves raw incoming events
for a future authenticated adapter, rejects invalid events and latches the first
failure. It is deliberately unconnected to production and never asserts FPS.
Its positive test uses synthetic events, not observed gameplay.

## Validation and lifecycle

Focused tests cover exact original identity/bytes, the actual production host's
absent metric, debug-guard coupling, a raw-event positive, wrong endpoint/thread,
stale generation, zero/negative/nonfinite dt, wrong scene/boundary, stale or
nonmonotonic timestamps, capacity/deadline overruns and short intervals. Test and
locked full-build results are retained in `focused-tests.log` and `build.log`.

Browser launches: **0**; cumulative browser time: **0 seconds**. No current scene
was inspected, no interval ran, and no backend/context/renderer was observed.
No Chrome/server/port was created; consequently no owned runtime process or
port remains to close. The runtime flock was never acquired or probed by taking
it. The newly launched Stronghold worker's explicit release was still pending
when this offline dependency was established; this task did not jump its queue
or claim the lock was available. Prior MDK abnormal Chrome closure remains
unexplained and supplies no timing evidence here.

Box ID/state/expiry: **N/A**. No boats, API, SSH runtime, allocations, installs,
subworkers, binary patches, forced state, crash probes, rendering reacceptance,
fullgame, audio or physical-GPU qualification. Coordinator retains future box
and shutdown ownership.

Next dependency: establish a tier-preserving timestamp observation mechanism
for the pinned nonzero-dt path and validate its live endpoint/scene ownership
before attempting the paired bounded browser intervals. This note leaves the
general browser-FPS followup open.
