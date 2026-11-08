# Redline left-input consumption — 2026-11-08

**The tested left window missed the owning guest's state polling. No turn was demonstrated, so vehicle entry/driving was withheld.** This is a measured transient-input consumption gap, not a binding diagnosis, renderer diagnosis or emulator repair. The reason the guest did not reach its next input read sooner remains unresolved. The preceding run's other left attempts have not been retrospectively diagnosed.

Evidence is retained in ignored `scratch/runs/20261108-redline-left-consumption/`. Reviewed images are `review/vehicle-start.png`, `left-window-held.png`, `left-window.png` and `final-view.png`: on-foot weapon, health100, car ahead, with no reviewed heading change or vehicle HUD/camera. No approach, firing, controls-menu survey, configuration change or forced entry followed the failed turn.

## Actual consumption and completed slices

The sole gameplay command was a native CDP ArrowLeft hold, from **03:13:46.100Z to 03:13:48.102Z**, with independent key-up initiation after **2,002 ms**. The observer retained these actual returns from the owning guest's imported input functions:

| Observation | UTC time | CPU slice | Actual return |
|---|---|---|---|
| Last VK37 state read before hold | 03:13:46.055 | 9503 | `get_key_down_state(37) = 0` |
| Completed slice spanning the entire hold | 03:13:48.525 | 9504 | 2,468.07 ms, 9,236 reported blocks, yield0, end EIP `0x44e4d0` |
| Queued left key-down dequeued for owner | 03:13:48.988 | 9511 | `check_input() = 0x250100` (VK37, WM_KEYDOWN) |
| Queued left key-up dequeued for owner | 03:13:48.989 | 9511 | `check_input() = 0x250101` (VK37, WM_KEYUP) |
| First VK37 state read after hold | 03:13:48.989 | 9511 | `get_key_down_state(37) = 0` |

There is **no observed VK37 state import overlapping the hold** and no completed owning CPU slice within it. The next state read occurs887ms after release; both queued edges are consumed after release. The state reads' actual native stack return is `0x48eefe`, with a256-byte buffer argument: original disassembly shows `IDirectInputDevice::GetDeviceState` through vtable offset`0x24` at `0x48eefb`. The WAT implementation zeroes that buffer and fills DIK cells according to the returned high bits. This observation records the real scalar input to that handler, not a separately sampled physical table. A completed HRESULT or full returned DirectInput buffer was not captured and is not claimed. The queued-message records prove host dequeue for the owning guest, not an independently traced DispatchMessage/game callback.

`retrieved/original/left-correlation.json`, `poll-window-proof.json`, `input-left-window-hold.json` and `left-window-trace-376E2E638748F95AA533B07E8A5ADD48.json` preserve the records. Although the8,192-record ring overwrote earlier history, its earliest retained record is03:13:22.689Z, before this window, and its latest record is after release. Verification checks that the relevant interval is retained, including calls crossing either endpoint. The other guest worker has no VK37 read in the window either; renderer traces are identified separately.

The sole passive physical sample started during the hold but finished after release, observing keys up. There are **zero wholly-held physical high-bit samples**. The requested held screenshot also finished late. They do not establish in-hold physical state. Native down/up dispatch, the independent release receipt and the actual later dequeue of both queued edges are retained instead. This limitation is not hidden by another attempt.

Slice9504's reported duration covers the whole input interval and completes423ms after key-up. Its end EIP follows an original indirect COM call at`0x44e4cd`, vtable offset`0x30`; the receiver and time spent inside that particular call were not observed. Neither this address nor cumulative render waits identifies the blocking API or proves renderer causality. The next useful dependency is an invocation-correlated span for the work inside this slice before the next keyboard read, preserving ordinary scheduling. A longer blind hold or another door approach is not justified by these data.

## Observer and original route

Before allocation, read `docs/tracing.md`, host/window input imports, the worker RPC fast paths, GetAsyncKeyState and DirectInput state implementations, and original PE imports. Redline imports `GetAsyncKeyState` and `DirectInputCreateA`, but not `GetKeyboardState` statically. Its helper at`0x470971` explicitly tests`0x8000` after GetAsyncKeyState. The accepted high-bit behavior was not changed.

The bounded, run-local `input-observer.js` wraps existing WASM input imports, calling each original exactly once and returning its exact result. It observes incoming slice messages and outgoing existing sliceDone messages. It reads timestamps, exported register getters and the existing stack; it does not poll input again, write guest memory/registers, change clocks, enable API logging, replace exported instances or modify scheduling. The predecessor's texture observer, which enables API logging, was replaced for this diagnostic. This is instrumentation of the current production path, not a timing comparison against that predecessor. Local emitted-WASM tests check return/exception/instance preservation, exactly-once calls, unchanged fixture memory, slice correlation, bounded retention and independent release during a slow sample. Additional emitted-message tests verify that observing dequeue does not take a second event. Existing exact-ready waiter and browser DirectX-vtable boot regressions pass. No emulator source changed and no repair/build claim is made.

One UUID-idempotent fresh box/browser followed the ordinary launcher and **Training Levels → Vehicle Training** route. The inherited normalized Display click landed on the desktop because this browser's native canvas dimensions differed; a passive capture and reviewed coordinates corrected it. The attempted Training Levels mouse click opened the mission grid; Escape and individually reviewed Down/Enter navigation reached the real training list without starting Stadium City. One review text mistakenly named New Game where Multiplayer was highlighted; the next review explicitly corrects it. All attempts remain in the ledger. There are16 exact successful ACKs, no UNKNOWN, replay or outstanding command.

## Provenance, verification and shutdown

Tested source SHA: `18cbfbba245d1f1d8279dadeb9ed56f56c79d490`. Source SHA, relevant binary diff, untracked boot-helper patch, runtime pins and owned input patches record recovery; Git remains the source archive. All65 original media paths/sizes/SHA-256 values recheck unchanged. No source/media archive was created. Actual guest and renderer module SHA-256 is `f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`. All18 compared owner fields match from spawn to final view, process1000, guest endpoint1/slot0 and render endpoint1.

Actual provider inspection reports WebGL2, legacy/WebGL,640×480, **ANGLE Intel UHD Graphics620 / Mesa23.2.1**, context intact, fallback count0. This differs from the predecessor's SwiftShader provider; no paired-backend or performance conclusion is made.

`verify.py` independently passes243 retrieved artifact references,225 unique hashes,120,629,337 reference bytes, all17 PNG CRC/IDAT checks,16 ACKs, original media pins, owner identity, polling-window coverage, late message words and drain. It passed **before** normal box stop was requested. Chrome exited0 at03:15:19.985Z; controller5883 and Chrome5895 are absent, HTTP45187/CDP41755 closed, profile and writer lock absent. Final physical keys are released and the input queue is empty.

The observable independent watchdog and normal-stop delegate were prearmed before allocation with the immutable25-minute deadline. Fresh box **`bx_23fgar6m`** was normally archived at **03:17:16.405Z**, stop receipt **`stop_bf82fb6c5d87c79d`**, completed03:17:16.429Z, `forced:false`. Final expiry is **null**; initial expiry was03:34:42.583Z. Both delegates exited0 and the supervisor has no children. Local disk stayed above5GB. No resume/delete, old403 operation, deadline extension, nested worker or public deployment occurred.

Next: observe the specific work spanning a missed input window before attempting another native turn. Vehicle entry/driving, FPS, audio, paired backends and full playability remain open.
