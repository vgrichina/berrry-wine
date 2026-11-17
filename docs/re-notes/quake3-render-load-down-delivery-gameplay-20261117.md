# Quake III input under software render load — 2026-11-17

Evidence: `scratch/runs/20261117-quake3-render-load-down-delivery-gameplay/` (ignored), with `result.json` published last. This investigation did **not** establish a production input fix. One fresh original diagnostic was explicitly authorized on the board at 21:34:06 UTC and completed; the predecessor's UNKNOWN endpoints remained closed. Arena movement, Mouse1 firing/consequence and native menu Quit remain unproved.

## Retained timing and ownership

The predecessor's published `337b6205ca38badd68d308f16660e9f80db04ce6` depth repair and its five focused suites, locked build, native old-fail/new-occlusion and exact D16 proofs are reused. The tested module remains `4d8036772e86804cfcfa0d41082e9b3a0c6cc8989e44b6686415857bcfd8ef47`; none of those proofs establishes input responsiveness or gameplay.

The affected predecessor already used actual `GpuStreamSoftware.Executor` in render Worker endpoint 1, requested as `{api:'gl-gps', backend:'software'}`. `host.js` enables the shared render Worker for a guest Worker; the GL bridge in `lib/host-imports.js` passes that decision to `GpuStreamHost.Bridge`; `lib/gpu-stream-render-worker.js` selects the software executor in that Worker. Changing to this route would not fix this run: it already owned rendering. The page receives presentation pixels, while the consumer owns native render resources and D16 depth. No route/backend substitution or depth/pixel ownership change was made.

The refused mouse gesture has five distinct stages:

| Stage | Retained evidence |
| --- | --- |
| Producer DOWN timestamp | `1794949914073` ms, before a synchronous receipt-file write and before calling the transport |
| Trusted DOM mousedown | `1794949914779.89` ms, about 707 ms after that timestamp |
| Producer DOWN ACK callback timestamp | `1794949914960` ms, 887 ms after the producer timestamp |
| Host dequeue | No mouse dequeue in the independent release witness; only prior Escape dequeue |
| USER/game consumption and visible click effect | Unknown; no subsequent endpoint observation was permitted |

Trusted DOM mouseup was `1794949914871.865` ms, about 92 ms after DOM mousedown. Independent UP enqueue was `1794949914251` ms, ACK `1794949914984` ms; its witness found physical state zero. This proves release, not delivery of Mouse1 to Quake III. The observer's collection named `consumption` wraps page `takeInput`/`getAsyncKeyState`: those are host observations, not proof of native USER or game consumption.

The producer timestamps are not wire-send/receive timestamps: `record()` synchronously writes and renames receipt JSON before `send()` and inside its ACK callback. The retained files have no receipt-write duration, page long-task stack or handler profile at the failed click. Thus 887 ms cannot be assigned entirely to page rendering, CDP transport, handler work or producer scheduling. No unmeasured alternative is claimed as the cause.

## Representative native render comparison

A standalone local browser fixture uses the exact retained module and published Git sources. It runs the production `GpuStreamRenderWorker` adapter and software executor in a real Worker. Each variant submits 24 full-screen 640×480 draws (48 triangles), native pixel shader IR, D16 testing/writes, PRESENT, and color plus depth READBACK. Trusted mouse DOWN and UP both occur while the draw is in flight. A page heartbeat observes scheduling gaps.

| Debugger during rendering | Native drain | DOWN ACK | Largest observed page heartbeat gap |
| --- | ---: | ---: | ---: |
| Enabled, matching the retained helper | 5718 ms | 32 ms | 76 ms |
| Disabled after attachment | 2173 ms | 15 ms | No gap over the 30 ms collection threshold |

Both variants complete sequence 35 with error zero, return the same green RGBA pixels and exact D16 bytes `00 80`, and finish all 24 native draws and both readbacks. The render operation spans seconds while native DOM dispatch and ACK remain below the unchanged 200 ms bound. This is a counterexample to the assumption that a busy software render Worker necessarily blocks the page. Debugging demonstrably adds render cost here, but disabling it is **not** proved to repair the predecessor's input delay.

This fixture does not execute the production page renderer's hit-testing, guest RPC dequeue, USER message pump or Quake III. It therefore does not reproduce or explain the failed original. No slower ordinary hold, relaxed deadline, removed guard or fabricated consumption was used. There is no causal old-fail/new-pass product change to publish.

## Authorized fresh diagnostic

The board authorized one original diagnostic after the fixture failed to resolve the 887 ms interval. A passive observer was prepared and qualified before launch: actual calls preserve receiver, arguments, return value and thrown-error identity; failing observer clocks/selectors do not escape; the pinned native getter leaves the full memory hash unchanged. The observer adds no guest slices or input. The existing independent release service was initialized before PE launch, with a finite independent watchdog and normal shutdown already armed. Sources and module were pinned to the predecessor, preserving actual software Worker ownership and its depth fix.

The personally reviewed whole screenshot showed the native main menu. One ordinary 200 ms Mouse1 press targeted Single Player. Its measurements were:

| Boundary | Actual measurement |
| --- | --- |
| Producer DOWN timestamp to wire-send entry | About 0.214 ms, measured with the producer monotonic clock |
| Wire-send entry to ACK socket callback | 59.138 ms |
| Trusted DOM DOWN capture | `1794951605311.17` ms, about 38 ms after wire entry |
| Production `handleMouseDown` | 9.075 ms |
| Trusted DOM UP | `1794951605475.53` ms; approximately 164 ms after DOM DOWN |
| Independent UP ACK and physical state | 4 ms ACK; physical Mouse1 state zero |
| Host dequeue | DOWN `takeInput` at `1794951608991.55` ms, about 3680 ms after DOM DOWN; UP about 59 ms later |
| Native USER consumption | Not established; no receipt token was armed or invented |
| Visible effect | Main menu remained visible in the selected post-click screenshot |

The producer receipt write/rename before DOWN took approximately 0.149 ms in total; the corresponding ACK receipt write/rename took approximately 0.474 ms. The bounded transport and I/O collections did not fill. No page long task overlapped this press. Actual software Worker statistics advanced through 71,589 triangles and over 93 seconds of accumulated native draw CPU before the click; these cumulative figures are workload evidence, not a per-click latency measurement. The immediate release witness had no dequeue, but the final passive log recorded the later DOWN and UP. `check_input` returned the corresponding messages as well. Native USER consumption remains unobserved, and the selected screenshot remained on the main menu.

The 887 ms ACK failure did not recur. This diagnostic separates prompt page handling from delayed host dequeue under the original render workload. It does not identify which production operation caused that dequeue delay: the retained Worker slice/RPC statistics are sampled, not an exact stack trace across the interval. A slow software render fence can defer the guest's own message pump, but no such specific fence is proved responsible for this click. No further original retry or gameplay attempt followed.

## Lifecycle and next boundary

The comparison's Chrome and independent finite watchdog both have actual wait, code zero and stdout/stderr EOF receipts. The fresh diagnostic closed normally at 21:40:56 UTC; driver, helper, supervisor and watchdog have actual zero waits and both EOFs, and the temporary profile was removed. Watchdog cancellation followed normal completion. This browser closure is not native Quit. Small preguest launcher failures are retained separately: delayed DevTools-file startup, discovery of an empty-URL Worker target, and a refused direct Worker attachment. The latter was sealed and received cleanup only; the final fixture uses the existing page auto-attachment/resume pattern. Their actual waits and EOF are retained rather than inferred from process absence. No boxes, deployments, media/config/save/clock changes or foreign edits occurred. The run records final disk availability and source/helper hashes.

Focused observer controls, exact native load/readback checks and offline diagnostic timing/lifecycle checks pass. The canonical locked build passed after the shared owners closed their earlier syntax/API/review window. That build checks the current shared tree; the actual diagnostic intentionally used the pinned predecessor module and source. No production code changed in this task; this publication records the measured limits rather than claiming a repair.

The concrete unresolved boundary is the production cause: retained evidence does not identify an operation responsible for the old ACK interval, the representative Worker load does not reproduce it, and the authorized fresh diagnostic completed ACK promptly but delayed host dequeue by seconds. A next authorized investigation needs a source-correlated production counterexample covering guest render waits and native USER consumption. No causal old-fail/new-pass patch exists, so the affected-original gameplay authorization has not been reached. The closed UNKNOWN original remains closed. Gameplay and native Quit cannot be inferred from these fixtures.
