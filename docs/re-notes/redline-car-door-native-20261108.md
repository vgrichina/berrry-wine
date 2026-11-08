# Redline native relative aim and car-door boundary — 2026-11-08

**Native mouse turning works; vehicle entry and driving remain unverified.** Trusted pointer-locked mouse deltas reach the original game's owning DirectInput mouse state, and personally reviewed views show small heading changes while retaining the car. A forward approach reaches the rear quarter and the native instruction “TO ENTER A CAR USE THE DOORS.” A later forward hold returns 90 owning VK38 high-bit reads but produces no reviewed displacement, including after passive settling. Gameplay input stops at that measured approach boundary. No visible side door, door contact, changed vehicle HUD/camera, acceleration/braking/steering consequence or vehicle exit is claimed.

Evidence is retained in ignored `scratch/runs/20261108-redline-car-door-native/`. Principal records are `relative-qualification.json`, `mouse-consumption-summary.json`, `poll-approach-right-rear.json`, `poll-past-rear.json`, `retrieval-prestop-verified.json` and `normal-stop-confirmed.json`. Reviewed images are under `review/`; complete recovered originals and traces are under `retrieved/original/`, with large logs individually losslessly compressed.

## Local qualification and original controls

The shipped `test/binaries/candidates/redline-demo/original/MAINDIR/Readme.rtf` recommends mouse driving, documents left mouse for fire, right mouse for forward movement, arrows for movement/acceleration/braking/steering, and entry by walking into a driver/passenger side door. No binding, remapping, guest/configuration write or forced entry is introduced.

Before box allocation, actual Chromium executes a small ordinary DirectInput PE in the production guest Worker. A trusted click acquires native pointer lock and an independent timer releases its button. A trusted `(7, -3)` movement persists for 2300 ms without a guest poll. Subsequent native GetDeviceState calls accumulate exactly `(7, -3)` once, with zero additional displacement on the next slice and the same Worker endpoint. The fixture's guest code owns its input results; it is never substituted into Redline.

The first local experiment demonstrates that CDP's explicit `movementX/Y` fields are ignored here: its trusted event reports zero motion. The corrected route changes CDP coordinates, producing trusted DOM movement deltas while locked. Both outcomes are retained. The original-game helper admits only nonzero integer deltas bounded to 24 counts per axis, requires existing native pointer lock and a previous CDP position, and sends motion with no buttons held. Invalid/unlocked controls produce zero dispatches. Pointer lock in the original is acquired through production browser-input handling of a native click; no scripted lock request is injected into the original game.

The qualified 5000 ms maximum keyboard helpers are byte-identical to the predecessor. Original movement here uses 3500 ms holds; no larger ceiling is introduced. Independent key/button release, strict 18-field identity, module/image checks, freshness, command/CDP/ACK/UNKNOWN/browser/box deadlines and no-replay behavior remain intact. Owner/stale/exact-ACK/sticky-UNKNOWN tests pass. Actual-WASM observer tests verify exactly-once original imports, preserved returns/exceptions/instance/memory, and read-only capture of the mouse result buffer on the next import. Exact-ready startup and the existing Worker DirectX-vtable boot regression pass. No emulator code changes or performance/semantics repair are claimed.

Two local setup errors are retained with their corrections: a missing copied ACK helper and an outdated startup-test stub lacking the new passive mouse-event reader. Neither issues original-game input or creates an original command UNKNOWN.

## Actual native mouse consumption and reviewed approach

One fresh browser follows individually reviewed **Training Levels → Vehicle Training**, spawning on foot with the car rear directly ahead. A native center click acquires pointer lock; its independent button release occurs after 150 ms. That click is not a firing success claim.

| Relative command | Trusted DOM UTC | Counts X | Delay to owning mouse-state poll |
|---|---|---:|---:|
| aim-right-seven | 04:38:51.545 | 7 | 3 ms |
| aim-clear-right | 04:39:35.249 | 14 | 3033 ms |
| face-flank-one | 04:41:24.348 | -24 | 2981 ms |
| face-flank-two | 04:42:24.614 | -24 | 1 ms |
| face-flank-three | 04:42:57.092 | -24 | 0 ms |
| line-along-side-one | 04:43:49.630 | 24 | 2 ms |
| line-along-side-two | 04:44:23.772 | 24 | 2 ms |

All seven trusted events have pointer lock, zero buttons and zero Y movement. Each has exactly one matching retained nonzero owning 16-byte mouse-state result, followed by zero. Native return address is `0x48f066`, buffer guest address `0x0881dafc`; the original imports are called exactly once. These are read-only post-handler buffer observations at the next import, not an independently captured HRESULT. They establish actual game input consumption, rather than merely host delivery. The three-second cases demonstrate that relative motion survives a slow interval until this game's normal poll.

Presentation can lag consumption. The first capture after the 14-count adjustment and after the first -24-count adjustment shows no new heading; passive settle captures then show the changed heading. No duplicate input is issued to obtain those views. Subsequent dependent inputs use the reviewed changed views.

The initial forward interval is **04:40:40.407–04:40:43.906Z**: 129 owning VK38 high-bit reads, 43 completed slices, and a later zero. Reviewed `approach-right-rear.png` shows the car close at the left and the native door instruction. Small left turns expose more rear-quarter body and tail light, but do not expose an identifiable side door. Two reviewed right adjustments restore a forward line beside that visible rear quarter.

The final forward interval is **04:44:54.211–04:44:57.711Z**. All 90 in-window owning VK38 polls return `0x8000`, with 32 completed slices. The first high result is 04:44:57.088Z; the last is 04:44:57.230Z. Native stack return is `0x48eefe` with a 256-byte keyboard-state argument. Zero results bracket the window at 04:44:54.208Z and 04:44:59.889Z. Trace retention covers both endpoints without observer errors. This is not a missed short pulse.

Reviewed `line-along-side-two.png`, `past-rear.png` and `past-rear-settled.png` retain the same car rear-quarter and terrain alignment, on-foot weapon and health100. The final passive capture completes **04:45:47.112Z** without showing displacement. Gameplay input stops: no repeat, longer hold, extra firing or control escalation follows. Collision with the rear/corner is a possible explanation; collision geometry, guest simulation state and underlying cause are not established. Door-contact entry is never reached. The next dependency is a reviewed path that clears this rear/corner boundary and exposes a side door; any additional native strafe route should first qualify its actual guest consumption locally.

## Provenance, retrieval and shutdown

Tested Git SHA is `9842f2e8aff8cdcb6ac8691ba5b6dc38fb767661`. `relevant-source.patch`, `new-wininit-boot.js.patch`, run-input patches and dependency-helper pins preserve recovery; Git is the source archive. All 694 non-run runtime/media pins equal the predecessor, including 65 rehashed original media files. The 705-file launch closure is verified remotely. Nine bounded segments assemble original Redline.bgd SHA-256 `840dc1421e88708bb64de686e6a996e2638c27693b25ecdb54237824c64808aa` and are removed before launch. No source/media archive or repeated media copy is retained.

Actual guest and renderer module SHA-256 remains `f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`; recovered modules are retained. All 18 owner identity fields match from Training spawn through final capture. The owning provider is WebGL2, legacy/WebGL, 640×480, ANGLE Intel UHD620 / Mesa23.2.1, fallback0. There is no paired-backend or FPS conclusion.

Verification independently rereads **362 artifact references / 325 unique hashes / 254,996,024 reference bytes**, checks 23 PNG CRC/IDAT streams, all 23 exact successful ACKs, seven relative movements, both forward polling boundaries, original media and browser/process drain **before requesting normal stop**. Retrieved transfer storage is about16.8 MB. All sampled final physical keys are up; the acquisition mouse-up and motion events record buttons0. Final input-queue length was not independently sampled. No original command UNKNOWN, refusal or replay occurs.

Chrome exits0 at **04:46:10.601Z**. Drain confirms controller6276/Chrome6288 absent, HTTP42047/CDP33639 closed, and profile/writer lock absent. Fresh box **`bx_jb827hmf`** is normally **archived04:47:55.464Z**, receipt **`stop_ab07fb642497d085`**, completed04:47:55.485Z, `forced:false`. Final expiry is **null**; initial expiry was04:59:46.650Z. Observable independent watchdog and normal-stop delegates are armed before allocation; both exit0 and supervisor has no remaining children. Local disk stays above5GB. No RAM gate, old403 action, resume/delete, nested worker or public deployment occurs.

No Redline corpus manifest entry exists, so evidence remains investigation metadata rather than a result for an unrelated candidate. Vehicle entry/driving, FPS, audio, parity and full playability remain open.
