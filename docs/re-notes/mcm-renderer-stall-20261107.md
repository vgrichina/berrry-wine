# MCM renderer stall: synchronous legacy Flip readback

Evidence: `scratch/runs/20261107-mcm-renderer-stall/`. Read-only analysis of
the retained `20261107-mcm-independent-sampling` original; no new runtime,
boat, build, generated-control qualification or gameplay claim.

The concrete blocking operation is the legacy renderer's synchronous surface
fence at queued Flip. The strongest remaining discriminator is **time in
`gl.readPixels` versus `_writeBack`/page-watch capture inside that fence**.
The receipts do not establish a correctness defect that justifies changing
fence ordering, yielding, surface ownership or guest execution.

## Timing evidence

Original runtime commit: `7715eab3fe3cbc4f429fb850ccc0ccd58e5796ed`.
The six relevant renderer/stream/WAT/input-helper files still exactly match
the original runtime SHA-256 pins. Current `host.js` has subsequent MIDI
callback changes; the slice-await/publication region used here matches that
original commit exactly. Full hashes and input hashes are in
`timing-analysis.json`; `analyze.py` reproduces and asserts these checks.

Physical Up interval remains 08:52:21.329–08:52:23.330Z, 2,001 ms.
Twenty whole page observations took 1–3 ms. Sequence advanced 7893→7901,
then remained 7901. This is the last completed guest slice, not a direct
observation of an executing instruction or proof of guest keyboard polling.

The first renderer read, 08:52:21.331–21.351Z, returned completion 296.
The second, 08:52:21.452–24.159Z, returned completion 298, error 0 and
7,902 replayed commands. It crossed physical release and remains excluded
from in-hold progress. The read is an aggregate of page/renderer/page CDP
evaluations, without individual stage timings. The fast independent page
stream narrows the delay toward the renderer, but cannot date each stage.

Compare the page receipt ending 08:52:21.435Z with `quick-response-state.json`
at 08:52:25.161Z. The former already shows the stagnant slice 7901. The
following are **deltas over that bracketing interval**, not measurements
precisely confined to the 2,707 ms read:

| Counter | Delta |
| --- | ---: |
| Replay time | 2,825.585 ms |
| Surface sync time | 2,471.160 ms |
| GPU submission time | 351.855 ms |
| Replay minus sync minus submission | 2.570 ms |
| Guest render wait time | 2,808.865 ms |
| Surface syncs | 1 |
| Readback area / RGBA bytes | 307,200 pixels / 1,228,800 bytes |
| Replay batches / commands | 3 / 160 |
| Draw calls / submissions / triangles | 159 / 52 / 3,396 |
| Native software / fallback draws | 0 / 0 |

The sync region accounts for 87.46% of replay growth in this interval.
These counters support a synchronous GPU readback bottleneck, with additional
GPU submission cost. They do not support a software rasterizer fallback,
unbounded guest slice budget, expensive passive counter expression, or proof
that the entire stall occurred in one particular WebGL call. GPU stats on
the page are cached fence reports; their lack of change during the hold does
not mean the renderer was doing no work. Replay counters are shared but reach
the page only with a completed guest slice.

## Call path and scheduling

1. WAT `$d3dim_worker_try_flip` submits opcode `0x20003`, records an owed
   presentation and preserves ordered surface ownership. The guest encoder
   writes a `RECORD_FLIP` and submits the batch immediately
   (`lib/d3d-command-stream.js`, `enqueueFlip`). Its buffer acquisition and
   explicit fence paths wait for the renderer's shared COMPLETED word via
   `_waitFor`/`Atomics.wait`. The wait counter is updated only after returning.
2. The one process renderer serializes messages through `messageChain`
   (`lib/d3d-render-worker.js`). `replayBatch` invokes `replay` synchronously.
   Replay's `RECORD_FLIP` branch calls `adapter.fence()` **before**
   `d3dim_worker_flip`; it does not call the adapter's opcode `0x20003` route.
3. `lib/d3dim-render-worker.js` forwards that fence directly to
   `D3DIMGpu.fence()`. It flushes queued GPU draws, binds the implicit target,
   performs `gl.readPixels` into a client `Uint8Array`, then converts/copies
   the rows into the guest DIB and captures page-watch state. `syncMs` begins
   before target binding/readback and ends after `_writeBack`; it excludes
   the preceding `_flushDraws`. The GPU submission counter separately wraps
   device drawing/native16 storage work.
4. This region neither returns a pending promise nor yields the Worker event
   loop. A renderer observation cannot rely on getting an execution turn
   inside it. The renderer publishes COMPLETED only after replay returns;
   the guest may meanwhile block waiting for the batch or for buffer reuse.
   `host.js` publishes `_workerLastSlice` only after its awaited guest slice
   completes. Thus a responsive page with a stagnant slice is compatible with
   render backpressure and does not demonstrate guest execution starvation by
   the page scheduler.
5. WAT `d3dim_worker_flip` only swaps two DIB pointers. Software draw counters
   remain zero. This makes native rasterization or an expensive WAT Flip
   implementation an unsupported explanation for this interval.

The existing WebGL2 PBO `_flip` path is opt-in and has an explicit same-thread
ownership restriction. The legacy Worker uses the synchronous branch above;
recorded `asyncFlips`/`asyncReads` are zero. Turning on the other path, dropping
the fence, or blindly slicing replay would change ownership semantics, not
repair a demonstrated scheduling error. Splitting batches also cannot make
one synchronous `readPixels` interruptible.

## Exact next discriminator and disposition

On the next separately authorized original run, measure bounded entry/exit
times on the **actual owning renderer**, keyed by its endpoint/epoch and
batch sequence/record ordinal, for: whole replay; Flip fence; `_flushDraws`;
`bindImplicitTarget`; `gl.readPixels`; `_writeBack`; and its page-watch
capture. Preserve a bounded completion record and read it after the blocked
operation returns, without introducing a flush or extra fence for diagnostics.
Individual CDP evaluation start/reply times should distinguish the renderer
read from its page checks. Existing aggregate counters are insufficient to
separate driver/GPU wait from conversion or page-watch work.

If readPixels dominates, an asynchronous readback design must retain the
single renderer scheduler, scratch lifetime, snapshot leases, DIB ownership,
and publish COMPLETED only after readers retire. A meaningful regression
would hold readback completion pending, verify that passive observations can
run while the guest/snapshot remain protected, then complete it and check
ordered copy, Flip and completion. If conversion or page-watch capture
dominates, reproduce that exact span before choosing a targeted fix. No such
regression is claimed here because no behavior change is justified yet.

All exact live owning Worker/module/epoch checks, 12-second freshness,
independent balanced native release and sticky UNKNOWN closure remain
unchanged. No guest program, scene, configuration or time was modified.
No emulator/helper code was edited and no fixture suites were rerun.
Small retained-evidence assertions passed. Free `/home` fell from
2,731,278,336 to 1,656,422,400 bytes during analysis; no build or large write
was attempted. No WIP code is left behind.

No box was assigned or created; state/expiry: none. Historical original box
`bx_z3xstz2x` remains archived as recorded by the prior run; no lifecycle
operation was performed. This assignment ends at the concrete readback
discriminator; at-speed driving and steering remain unproved for this run.
