# Redline Clear executor cause — 2026-11-08

**The measured Clear waits in the renderer queue behind an earlier batch; its own implementation and native WebGL clear complete in under one millisecond.** This fresh passive Vehicle Training run resolves the predecessor's delivery-versus-execution ambiguity. It demonstrates no incorrect emulator behavior warranting a generic repair. No emulator source changed, turning input was sent, car approach occurred, or vehicle entry was claimed.

Evidence: ignored `scratch/runs/20261108-redline-clear-executor-cause/`, especially `retrieved/original/causal-execution.json`, its named raw trace snapshots, `queue-detail.json`, `inspector-requests.jsonl`, and local `retrieval-verified.json`. The selected new invocation is slice7330 / sequence18610; this does not retrospectively split predecessor slice7087 / sequence17417.

## Located boundary

The owning host import is `gpu_gl_call(0x20004, 0x4e2c0c, 0)`, invocation34120339, returning1 after **3,037.575 ms** in slice7330 (**3,042.065 ms**). Its captured native stack retains return`0x44e4d0`, viewport receiver`0x08222040`, count1, rectangle`0x074ffb0c`, flags3. The actual Encoder call, outgoing sequence, renderer endpoint, transport, executor start, implementation invocation and completion store all correlate.

| Boundary | UTC | Identity / duration |
|---|---|---|
| Preceding batch starts executing | 03:48:18.381 | endpoint1, transport18610, inner sequence18609 |
| Clear is sent | 03:48:18.392 | endpoint1, transport18611, inner sequence18610 |
| Clear reaches renderer ingress | 03:48:18.835 | 443 ms after send |
| Preceding batch publishes completion and `render-done` | 03:48:21.429 | sequence18609, transport18610 |
| Clear starts executing | 03:48:21.429 | **2,594.265 ms after ingress**, renderer monotonic clock |
| `D3DIMGpu._clear` | 03:48:21.429–21.430 | invocation158409, result1, **0.145 ms** |
| Nested native `WebGL2RenderingContext.clear` | same invocation interval | invocation158417, **0.005 ms** |
| Clear publishes `COMPLETED = 18610` | 03:48:21.430 | **0.160 ms after executor start**, renderer monotonic clock |

The wall-clock dequeue-to-store difference is1 ms; monotonic spans resolve the sub-millisecond interval. These are measurements under observation, not an uninstrumented performance comparison. The detailed rings begin before the selected host call and renderer ingress. Native VK37 reads bracket the outstanding import with zero results and none inside it; no gameplay left hold was required.

The production path is `Encoder.call` / `_waitFor` → `d3d-render-worker.js`'s serialized `messageChain` → `processMessage` → `sharedMessage` → the D3DIM adapter → `D3DIMGpu._clear` → D3D9/backend clear → native WebGL. The executor-start span sits at the first `processMessage` invocation inside the existing promise-chain job, after queue admission. The prior batch's completion precedes Clear's start on that same serialized scheduler. Clear is therefore waiting for earlier work, rather than spending those seconds inside its own clear implementation.

Two other retained passive Clear dependencies show the same distinction: sequence18621 waits2,544 ms between ingress and executor start, then `_clear` takes0.105 ms; sequence18627 queues2,372 ms, then `_clear` takes0.075 ms. Inspector activity differs: sequence18621 overlaps four evaluations, including one782 ms request; sequence18627 overlaps a2,697 ms screenshot request. **The selected sequence18610 overlaps no logged inspector/source/screenshot request.** Logging preserves sent/response times, sessions, script identities and request sizes. This does not eliminate observer overhead, browser scheduling, earlier instrumentation effects or external system activity as influences.

The prior batch runs from03:48:18.381 to03:48:21.429. Retained draw/flush spans locate some of its work, but do not explain its entire interval. In particular, no complete asynchronous Flip/fence/poll/timer span was captured. The source contains an awaited Flip readback path, but this run does not identify that path's internal wait as the measured cause. No driver defect, expensive native `gl.clear`, removable dependency or safe asynchronous conversion follows. The next useful measurement is the preceding batch's replay/Flip continuation and fence-status/scheduling boundaries, preserving scratch, snapshot, surface and completion ownership.

## Controls and observed behavior

Before original allocation, extended the existing bounded transparent observer with renderer ingress, executor start, Clear entry/exit, nested backend/native operations, result/completion publication and endpoint/transport/inner-sequence identities. The8,192-row rings retain slow spans and operations nested inside Clear; completed guest slices remain bounded at512. Calls retain their receivers, exact return objects/promises and thrown objects. The observer adds no Promise reaction, guest write, input poll, scheduling replacement, clock/configuration change, instance substitution or API-log flood.

`test-executor.cjs` uses the production renderer scheduler, adapter and Clear implementation with emitted WASM and a controlled preceding request. It proves a queued Clear cannot start before that predecessor releases, actual completion occurs exactly once, and native receiver/result/exception identities survive wrapping. Production RPC/emitted-WASM import and Encoder controls also pass, including bounded retention, unchanged fixture memory and independent key-up during a slow sample. The exact-ready startup waiter and browser DirectX vtable boot regression pass. A final extra exactly-once assertion passes locally; both preallocation and final script patches are retained. No production code changed, so no repair, failing-before/passing-after regression or locked-build claim is made.

Personally reviewed `review/vehicle-start.png` and `review/passive-work.png`: original Vehicle Training world, on-foot weapon, health100, car ahead. Menu traversal used individually reviewed native Down/Enter actions. All11 numbered commands have exact successful ACKs; zero UNKNOWN/replay, left windows, approach, fire or entry. Final physical keys are up and the input queue is empty. Turn, driving, FPS, audio, backend parity and full playability remain open.

## Provenance and shutdown

Tested Git SHA`af4ddd281b931e8648779471961b22e1a1b0da31`; relevant tracked/untracked runtime patches and run-input patches are retained with `runtime-pins.json` and `RECOVERY.md`. All694 non-run runtime/media pins match the predecessor; all65 original media paths/sizes/SHA-256 values recheck unchanged. Actual guest/renderer module SHA-256 remains`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`. All18 owner identity fields remain stable. Provider: legacy/WebGL2,640×480, ANGLE Intel UHD Graphics620 / Mesa23.2.1, context intact, fallback count0. Git remains the source archive; no source/media archive was made.

Independent local verification passes **180 retrieved references /168 unique hashes /117,607,277 reference bytes**,11 PNG CRC/IDAT checks,11 ACKs, original media, owner identities and selected invocation/queue/native-call correlation. Verification passed before normal stop. Chrome exited0 at03:49:34.376Z; controller6089 and Chrome6101 are absent, HTTP45581/CDP41921 closed, profile and writer lock absent.

The single UUID-idempotent fresh box **`bx_g25hktb8`** had observable independent25-minute watchdog and normal-stop delegates prearmed before allocation. It was normally **archived at03:51:14.710Z**, receipt **`stop_2490a045bd6ed49c`**, completed03:51:14.731Z, `forced:false`. Final expiry is **null**; initial expiry was04:10:20.549Z. Both delegates exited0 and the supervisor has no remaining children. Disk remained above5,000,000,000 bytes. No RAM gate, old403 action, resume/delete, nested worker or public deployment occurred.
