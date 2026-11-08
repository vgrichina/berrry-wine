# Redline slice work cause — 2026-11-08

**An observed synchronous viewport Clear waits 3,383 ms for its render sequence to complete, delaying the owning guest's next native keyboard read.** This identifies the blocking dependency in a fresh passive Vehicle Training run. It does not establish a generic semantic mismatch, explain the renderer's internal cost, or retrospectively measure the previous run's slice9504. No emulator repair, left-window replay, turn, car approach or vehicle entry followed.

Evidence is retained in ignored `scratch/runs/20261108-redline-slice-work-cause/`. The independently checked correlation is `retrieved/original/causal-correlation.json`; its source snapshots are the `vehicle-start-trace-*.json` files named inside it. Personally reviewed `review/vehicle-start.png` and `review/passive-work.png` show the original training world, on-foot weapon, health100 and car ahead. They establish no heading change or vehicle progress.

## Invocation and input evidence

The owning CPU slice is **7087**, admitted with89,000 steps at03:35:21.898Z and completed at03:35:25.293Z, reporting **3,394.29 ms /89,000 blocks / yield0**. Per-slice host-import durations total3,386.65 ms; nested render-method/wait spans are excluded from that sum.

| Observed event | UTC | Invocation / actual value |
|---|---|---|
| Last owning VK37 read before the wait | 03:35:21.903 | `get_key_down_state(37) = 0`, slice7087 |
| Host import entry | 03:35:21.906 | id23116123, `gpu_gl_call(0x20004, 0x4e2c0c, 0)` |
| Encoder call and wait entry | 03:35:21.906 | child23116124 → child23116127, `_waitFor(17417)` |
| Existing outgoing render message | 03:35:21.906 | parent23116124, `legacy-call`, seq17417, opcode0x20004 |
| Renderer message delivery | 03:35:22.730 | endpoint1, seq17417, transport17418, same opcode/descriptor |
| Renderer's actual completion store | 03:35:25.289 | endpoint1 `COMPLETED = 17417` |
| Encoder wait / host import return | 03:35:25.289 | wait`true`, import`1`; import duration3,383.29 ms |
| Next owning VK37 read | 03:35:25.629 | `get_key_down_state(37) = 0`, slice7089 |

There are no owning VK37 import entries during this import's interval. The detailed rings begin before both bracket reads and before the matching renderer request, despite earlier overwrite. The real DirectInput state calls retain native return`0x48eefe` and256-byte argument. These are actual imported scalar state results; no full DirectInput HRESULT/buffer is claimed. No gameplay key was held: the passive brackets alone show why this thread cannot poll while the synchronous import is outstanding.

The host import entry captures EIP`0x44e4b0`, ESP`0x074ffae8`, and native stack words beginning `[0x44e4d0, 0x08222040, 1, 0x074ffb0c, 3, …]`. Thus the observed original call has receiver`0x08222040`, count1, rectangle pointer`0x074ffb0c`, flags3, and return`0x44e4d0`. Original PE disassembly shows the indirect call at`0x44e4cd`, vtable offset`0x30`, with exactly that argument construction. The new attribution uses the observed import, parent chain and receiver/arguments, not the return address alone.

The implementation chain is:

- `src/09a8-handlers-directx.wat`, `$handle_IDirect3DViewport3_Clear` → `src/09ab-handlers-d3dim-core.wat`, `$d3dim_viewport_clear_full` / `$d3dim_gpu_try_clear`, which issues opcode`0x20004`.
- `lib/guest-rpc.js`, final`gpu_gl_call` → `opts.d3dCommands.call`; `lib/guest-worker.js` provides the shared Encoder and forwards its existing`renderLegacy` message.
- `lib/d3d-command-stream.js`, `Encoder.call`: submit pending work, issue`legacy-call` with a fresh sequence, then synchronously`_waitFor(seq)` using the existing completion word.
- `lib/d3d-render-worker.js`, `sharedMessage`: dispatch the legacy call to the endpoint adapter; after its result, store RESULT and COMPLETED and notify. The observed transport17418 also emits its matching`render-done`.

Other retained passive slices repeat the same host opcode and native stack: slice7050 takes3,118.06 ms with3,108.73 ms in this import; slice7121 takes2,535.56 ms with2,523.05 ms in it. The later passive snapshot includes slice7379 at2,808.73 ms with2,799.11 ms in the same dependency. These are observations from one instrumented run, not performance comparisons.

## Limit and next dependency

**824 ms elapse before renderer delivery, and2,559 ms from delivery to completion.** Delivery is not executor start: that interval can include queued earlier work and execution. No executor-start, individual WebGL-call, driver-completion or CPU-profile span was captured. Consequently this evidence does not distinguish renderer queueing from work inside the adapter, prove that clearing itself costs2,559 ms, or identify`readPixels`, a GPU driver, shader compilation or a semantic bug as the cause. Cumulative renderer counters are not used for that inference.

The located blocker is the owning thread's synchronous Clear completion dependency. The next investigation should correlate processing start and the adapter's actual operations for the same sequence, including earlier queued batches, before proposing a generic repair or optimization. No guessed optimization was made; CLAUDE.md's engine/native-disassembly and benchmark requirements still apply to one. Native turn remains the prerequisite for a later car approach. Driving/full playability/FPS/audio/backend parity remain open.

## Observation controls and provenance

Before allocation, inspected existing tracing in`lib/guest-worker.js`, `lib/worker-imports.js`, `lib/guest-rpc.js`, `lib/d3d-command-stream.js`, `lib/render-worker.js`, `lib/d3d-render-worker.js` and`docs/tracing.md`. The run-local`input-observer.js` retains the existing input-observer/driver route and adds invocation parents, bounded slow-call records, incoming/completed slices, per-slice import totals, Encoder spans, original Atomics waits, and existing renderer delivery/completion stores. It invokes originals exactly once with their receiver and propagates exact values/exceptions. It reads existing registers/stack where available. No extra input poll, memory/register write, clock/configuration change, API-log enablement, scheduling replacement or exported-instance substitution is added. Observer overhead is present; no uninstrumented timing equivalence is claimed. Retention is8,192 detailed records and512 completed slices per worker; correlation verification proves this selected interval survives.

Preallocation tests pass for emitted WASM using production RPC imports (including exactly-once dequeue and thrown RPC error), production Encoder receiver/exception identity, original completion-store result, bounded retention, unchanged fixture memory and independent key-up during a slow sample. The exact-ready waiter regression and`test/test-worker-directx-vtable-boot.js` pass. No production code changed, so there is no repair/build claim.

Tested source SHA:`de659e701700e70aee6eff700f27847d753c49e4`. `relevant-source.patch`, `new-wininit-boot.js.patch`, `owned-run-inputs.patch`, `runtime-pins.json` and`RECOVERY.md` preserve recovery references. Git remains the source archive. All694 non-run runtime/media pins match the predecessor; all65 original media paths/sizes/SHA-256 values recheck unchanged. Guest and renderer module SHA-256 is`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`. All18 owner fields match between world captures. The observed provider is legacy/WebGL, WebGL2,640×480, ANGLE Intel UHD Graphics620 / Mesa23.2.1, context intact, fallback count0. No paired-backend conclusion follows.

One UUID-idempotent fresh box/browser followed launcher Play Redline → individually reviewed native Down/Enter menu selections → Training Levels → Vehicle Training. There are11 exact successful command ACKs, zero UNKNOWN/replay, zero gameplay left windows, and no approach/fire/entry command. Final physical keys are up and input queue empty.

`verify.py` independently passes178 retrieved artifact references,166 unique hashes,98,982,704 reference bytes,11 PNG CRC/IDAT checks,11 ACKs, original pins, owner identity, parent/sequence/transport correlation and input brackets. Verification passed before the normal box-stop request. Chrome exited0 at03:37:31.230Z; the initial immediate drain still saw the controller, preserved in`drain.json`; the later read-only`drain-settled.json` confirms controller18440 and Chrome18452 absent, HTTP44669/CDP45279 closed, profile and writer lock absent.

The observable independent25-minute watchdog and normal-stop delegate were prearmed before allocation. Box **`bx_k8u82f73`** was normally archived at **03:38:57.509Z**, receipt **`stop_55722c9d11c1082c`**, completed03:38:57.544Z, `forced:false`. Final expiry is **null**; initial expiry was03:57:25.543Z. Both delegates exited0 and the supervisor has no remaining children. Local disk stayed above5GB. No RAM gate, old403 action, resume/delete, source/media archive, public deployment or nested worker occurred.
