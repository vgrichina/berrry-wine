# AoW II: per-Worker drains survive later failures; terrain capture still pending

2026-11-06, worker `aow2-worker-drain-persistence0725`.
Evidence: `scratch/runs/20261106-aow2-worker-drain-persistence/` (ignored).

The run-local CPU collector now persists each individual Worker drain before
contacting another Worker or GPU endpoint. Failure controls demonstrate that
an earlier 496-event receipt survives later real Worker termination, a GPU
message error, and a separate GPU filesystem write failure. Both shipped-module
public COM pixel/architectural controls and the locked full build pass.

The sole original reached a reviewed main menu, then stopped because Chromium
could not return three response bodies through CDP. No gameplay input followed;
terrain startup was not reached, and no original was restarted. This establishes
a collector retention improvement, **not** a terrain repair or an emulator
semantic mismatch. No emulator, guest, input, or media implementation changed.

## Prior evidence remains distinct

The preceding run, documented in `aow2-earliest-dib-writer-20261106.md`, retained
successful zero-initialization of surface 65, observer-local generation 1:
RGB565, 1024×525, 1,075,200 zero bytes. That is successful allocation
initialization. Its cumulative 13 successful Device7 draws do not establish
source data, packing, coverage, or intended contribution. The missing original
CPU orders 312–807 remain lost; this run's synthetic retention control does
not recover those game records.

## Release gates and identities

The exact releases were Aranna0600, the coordinator's explicit release of the
stopped D3D9Clip0625 task, KKnD0640, then Lords2FirstDestroy0700. The stopped
task was not continued. Fresh independent checks covered 1,224 PID entries,
118 ports and 64 profiles across predecessor inventories; all were absent or
refused. All four locks were free and no heavy runtime remained. These counts
include repeated resources across inventories, not unique-process claims.
`release-gate.json` fixes the window at **07:54:07–08:39:07 UTC**, including
cleanup. No boxes or Codex workers were launched.

The locked build used main `4c34366c714a0810734153772d34dae4b0124369`.
The original's prelaunch source record is main
`6f06770d8a6bfb495f1e0c5275d9f1c676078d52`; concurrent documentation commits
did not change the 301 relevant source-file identities. Before/after source
manifests, exact Git SHAs, binary diffs and the separate untracked
`lib/wininit-boot.js` patch record shared-tree context without a source archive.
That untracked file is not this worker's change. All 1,064 media path/size/hash
references matched before and after; no media was copied.

Both shipped modules remained unchanged through the build and original:

| Module | Bytes | SHA-256 |
| --- | ---: | --- |
| Standard | 2178481 | `41d3ed6a2b52b46d25550dd54f582c574a7acc48f2024c3e01f878bdafbe470f` |
| Compat | 2181127 | `2c94cba0b6138e51d2d69ed19f938f2cb6abd7b83cd3cc0363ce232119cbaf7a` |

The original executable remains the existing extracted `AoW2.exe`, SHA-256
`a10590e5dbd013d154b00ea53e66670f4e74d38ab33adb2523f0a662af8f89f7`.

## Persistence implementation and failure controls

Run-owned `drain-store.cjs` writes a separate compressed raw receipt for each
CPU Worker, with actual CDP target/session ID, Worker slot and endpoint identity.
It exclusively creates a temporary file, writes and fsyncs it, renames it, and
fsyncs the containing directory **before** accounting or another destructive
drain. Accounting is retained separately. A nonempty drain directory is refused.
CPU evaluation errors are recorded per target; GPU inventory, request and
persistence are separate boundaries. A persistence failure stops collection
before another destructive drain, and original shutdown skips a retry drain.

Each stream accounts for repeated orders, conflicting replays, regressions,
gaps, explicit drops and observer errors. Target/slot/endpoint distinguish
lifetimes; CPU and GPU are never assigned an invented total order. Persistent
birth summaries are deduplicated separately from destructively drained events.
The existing event, birth, source-byte and detail quotas were not expanded.

`collector-controls.json` and its individual receipts demonstrate:

- A real Chrome Worker drains synthetic orders 312–807 after a retained prefix
  1–311. A later actual Worker is terminated and its evaluation fails. The
  earlier 496 rows remain byte-identical, and another healthy CPU Worker still
  drains successfully.
- A later request to the third Worker returns an injected GPU-channel error.
  Both errors retain target/slot identity. A separate Node process reopens the
  earlier receipt and verifies SHA-256, all 496 events, range, target and slot.
- A separate case produces an actual exclusive-file-open failure during GPU
  receipt persistence. The preceding CPU receipt survives unchanged and the
  `gpu-persistence` error is retained. A CPU persistence failure prevents the
  next destructive drain.
- Duplicate, conflicting duplicate, late-order, missing-order and explicit
  observer-error fixtures are retained and accounted; a new target using the
  same slot/order remains a distinct stream.

The first control attempt incorrectly expected `EISDIR` for exclusive creation
at an existing directory. Node correctly returned `EEXIST`. The fixture was
corrected to require that exact error code, syscall and path. Its failed output,
tested helpers and receipts remain under `collector-attempt1/`; the first
`focused.log` also remains. This was a test expectation error, not an emulator
repair or a discarded persistence failure.

`focused2.log` passes the collector controls, passive surface observer, and the
five existing draw-trace, batching, point, fallback-counter and Worker-parity
regressions. `build.log` records the passing locked full build.

## Both-module public COM and passivity checks

`producer-controls.json` passes standard/compat × observer disabled/armed in
actual owning CPU/GPU Workers: 27 draws per case, identical independent pixels
and renderer counters. Armed cases retain 159 CPU API events and 57 GPU events
each, without observer errors or drops. These actual control drains are also
persisted individually under `control-drains/`.

Coverage includes genuine public sparse VirtualAlloc stacks, split-page
descriptors/output pointers, creation normal return and zero initialization,
RGB565 Lock/raw write/Unlock, production GDI GetDC/SetPixel/ReleaseDC, Blt,
upload, covering draw and Clear. Per-hook and cross-case comparisons preserve
nonzero GPRs, unresolved lazy flags, live x87 state, FPU/XMM files and MMX values.
Actual instantiated CPU bytecode matches the selected shipped module in every
case. The CDP observer uses no breakpoints or guest writes; timing/performance
equivalence is not claimed.

## Sole original: precise new boundary

The only original ran **07:57:15–07:58:27 UTC**, Chrome 151.0.7922.108, Node
v24.18.1, local isolated HTTP, threads enabled, requested legacy WebGL, viewport
1280×813. Four independently extracted instantiated CPU modules match the
standard hash: slots 0–3, endpoints 1–4, with distinct actual CDP target IDs.
The reviewed `initial.png` shows the AoW II main menu. The ordinary launcher
click was the only trusted input; no Scenario/gameplay input was sent.

There are **44 durable CPU receipts**, 161 surface/API events, four persistent
births and 3,735 legacy DX events. Surface/API orders have zero gaps, duplicates,
conflicts, regressions or drops. The DX stream has 336 gaps comprising 672 serial
numbers; its cumulative `outside-selected-target` count is exactly 672. That
observer advances its serial before filtering small/invalid targets, explaining
these omissions without calling them collector loss. Neither observer reports
an error or dropped event. No original GPU diagnostic endpoint or terrain
creation/upload/draw was reached. Generated-control GPU success does not fill
that original evidence gap.

The first actual original failure is retained at **07:57:16.206Z** in
`fault-00001.json`: CDP could not load a response body. Two more such errors
follow at 07:57:41.758Z and 07:57:41.914Z. The initial capture's identity guard
rejects incomplete response proof, then closes the browser normally with code
0; the driver exits 1. It does not restart or send gameplay input.

Offline audit of actual server-written bodies matches **598 known responses**,
including 431 distinct media files, the transformed helpers and shipped WASM.
This is server-side HTTP evidence, not a replacement for the failed browser
body proof. Four server responses lack matching browser rows: one surface
observer, two draw-trace scripts and one audio-worklet response. Three CDP
failures do not uniquely assign those four unmatched responses. The outer
response promise catch retained error/time but omitted the failing request URL,
request ID and target/session identity. An exact failed-request join is therefore
unavailable; a preflight-request cause is only Chromium's generic error text,
not a demonstrated cause. `bounded-findings.json` preserves these distinctions.

## Next missing evidence and cleanup

Before a separately assigned future original, qualify owning-target HTTP body
or compiled-script provenance with generated page/Worker/worklet controls.
Persist URL, method, status, request ID, target/session and errors before
asynchronous body retrieval; prove unavailable-body behavior without silently
ignoring it. Retain the tested immediate per-Worker persistence. Only then can
a fresh single original attempt the missing terrain creation-to-first-upload
interval, first raw/prepacking draws and selected-point contribution. Neither
zero allocation bytes nor successful draw HRESULTs justify a terrain repair.

The initial nohup holder/watcher exited after its preparation shell; this was
caught before controls or browser execution. The build itself held its required
flock. `holder-first-failure.json` records the ownership gap and unknown sender.
Foreground supervised holder/watcher sessions replaced them before controls;
locks were independently checked held before the original. The holder later
exited 0 after the explicit release marker. Own watchers were stopped explicitly;
their SIGTERM sender is known. No claim of uninterrupted ownership across the
failed first setup is made. Final process/port/profile/lock/disk checks and
artifact hashes are retained; `result.json` is published last. No box was
assigned, so box ID/state/expiry are not applicable.
