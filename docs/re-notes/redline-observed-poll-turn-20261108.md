# Redline observed native turn — 2026-11-08

**The original game turns left across observed owning keyboard polls. Vehicle entry/driving remains unverified.** The single qualified 5000 ms ArrowLeft window reaches 85 actual VK37 returns with the high bit set, then a zero return after release. Personally reviewed before/after captures show the centered car replaced by the left cliff. A later short right adjustment misses guest polling and produces no reviewed heading change; input stops at that boundary without another attempt.

Evidence is retained in ignored `scratch/runs/20261108-redline-observed-poll-turn/`. Key artifacts are `poll-summary.json`, `poll-correlation-left-window.json`, `approach-boundary.json`, `retrieval-prestop-verified.json`, and the complete input/slice snapshots under `retrieved/original/`. Large logs are individually losslessly compressed, with original and compressed hashes verified. Reviewed images include `review/vehicle-start.png`, `left-window.png`, `face-car.png`, `face-known-car.png` and `final-view.png`.

## Qualified physical window and actual consumption

The predecessor's 2000 ms ceiling was a run-local guard. A run-local candidate changes only the keyboard hold ceiling to 5000 ms in its copied admission/hold helpers. Command work, CDP, capture, ACK, freshness, browser and box deadlines remain unchanged. No tracked emulator source, guest state, clocks, scheduler, fences or readback dependencies changed. This longer physical input establishes no emulator repair, performance improvement or parity conclusion.

Before allocation, actual local Chromium and the production guest Worker execute an ordinary x86 fixture importing GetAsyncKeyState(VK_LEFT). Trusted DOM DOWN/UP events, an in-hold native guest high-bit result, subsequent native zero results, stable Worker endpoint and final released physical state are retained. The independent release timer is armed before DOWN. It initiates UP after 5000 ms while a slow sample is still pending, and also while a different sample remains pending before throwing. The old helper refuses 5000 with zero effects; the candidate admits 5000 and rejects 5001, fractional, out-of-range and invalid windows with zero effects. Production transport tests establish exact ACK identity, wrong-ID rejection and sticky UNKNOWN even after a late ACK, without queuing a replay. Owner/module/freshness checks, the low-overhead emitted-WASM observer controls, exact-ready startup regression and existing browser DirectX-vtable boot regression pass.

One fresh browser follows the reviewed native **Training Levels → Vehicle Training** route. The shipped original Readme documents door-contact entry, arrows for movement/acceleration/braking/steering, and Delete/Page Down for exits. No mission/configuration changes, forced entry or control remapping occur.

| Owning guest observation | UTC | Result |
|---|---|---|
| Native ArrowLeft window starts | 04:21:56.822 | Independent release prearmed |
| First held VK37 return | 04:21:56.824 | `get_key_down_state(37) = 0x8000`, slice9517 |
| Entire retained hold interval | 5000 ms | 86 VK37 calls, 85 high-bit results; 30 completed CPU slices |
| Independent key-up initiation | 04:22:01.822 | Exactly5000 ms after start |
| First VK37 call after release | 04:22:02.108 | Zero, slice9551 |

All held high-bit records and the first released record retain original native stack return `0x48eefe` and the256-byte GetDeviceState argument. This observes the actual scalar input to the production DirectInput handler; a full returned DirectInput buffer/HRESULT is not independently captured. There are47 wholly-held passive samples observing physical VK37 high. Detailed input retention spans both hold endpoints with no missing interval; completed CPU slices are also retained. The observer calls each original import once and preserves its return/exception; it does not issue an extra input getter or broad import trace.

## Exact vehicle boundary

The proved left turn leaves the known car outside the view. A bounded3500 ms ArrowRight adjustment returns67 owning VK39 high-bit calls and changes the view to a nearby wall/cliff, but does not reacquire the car. A shorter500 ms right adjustment is then used to refine the heading. Its reviewed before/after view is unchanged apart from weapon animation. This is not a second attempt at the original left-turn test.

That short window is **04:23:27.747–04:23:28.247Z**. The owning VK39 call at04:23:27.638 returns zero; the next at04:23:28.883 also returns zero. There are **no in-hold owning VK39 calls and no completed CPU slices**. Slice10255 takes1091.380 ms and spans the entire500 ms window, completing04:23:28.729Z at EIP`0x44e4d0`. The retained interval covers both endpoints. Its particular blocking work is not invocation-traced here, and no renderer diagnosis is inferred from the end EIP.

Gameplay input stops immediately at this missed-poll/unchanged-heading boundary. Only passive capture and quit follow. No forward approach, visible side-door contact, changed vehicle HUD/camera, acceleration, braking, steering consequence or exit is claimed. The final view remains on foot with weapon and health100. Reliable native car reacquisition and door approach remain the next dependency; no longer hold, repeated adjustment or emulator change is justified by this run alone.

## Provenance, verification and shutdown

Tested Git SHA: `ae025011b7193d943bff4af4cb8c2745094f51ea`. `relevant-source.patch`, the untracked boot-helper patch, owned input patches and dependency-helper pins preserve recovery; Git remains the source archive. All694 non-run runtime/media pins equal the predecessor, including65 rehashed original media files. Nine bounded segments assemble the original Redline.bgd hash and are removed before launch; no source/media archive or repeated media copy is retained. Actual guest/renderer module SHA-256 remains `f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`. All18 compared owner fields remain stable from training spawn through final capture.

The actual owning provider is WebGL2,640×480, ANGLE Intel UHD620 / Mesa23.2.1, context intact, fallback0. There is no paired-backend or FPS claim. One initial read-only correlation script fails locally before reading the saved trace because its remote snippet lacks `__file__`; the corrected diagnostic reads the same immutable evidence. Both outcomes are retained. This is not a guest command UNKNOWN or input replay. An initial boot-regression invocation names a nonexistent test; the corrected existing test passes, with both logs preserved.

Independent verification passes **222 artifact references /207 unique hashes /144,559,428 reference bytes**,14 PNG CRC/IDAT checks,14 exact successful ACKs, original media, owner identity, both input boundaries and browser/process drain **before normal stop is requested**. Compressed retrieved evidence occupies about13.4 MB. Final physical keys are up and the input queue is empty. Chrome exits0 at04:24:32.151Z; the second drain confirms controller6780/Chrome6792 absent, HTTP34553/CDP36491 closed, profile/writer absent.

Fresh box **`bx_n3psdfhd`** is normally **archived04:25:46.035Z**, receipt **`stop_aea33bdaf1ebe6ad`**, completed04:25:46.076Z, `forced:false`. Final expiry is **null**, initial expiry04:43:21.578Z. Observable independent watchdog and normal-stop delegates were armed before allocation with the original25-minute deadline; both exit0 and supervisor has no remaining children. Local disk stays above5GB. No RAM gate, old403 action, resume/delete, nested worker or public deployment occurs. FPS, audio, full playability and vehicle driving remain open.
