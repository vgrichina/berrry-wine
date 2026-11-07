# MW3 mouse consumption — 2026-11-07

The trusted Instant Action click targeted the renderer's absolute cursor, while
MW3 maintains a separate cursor by integrating DirectInput mouse counts. The
first absolute move initializes the renderer's DirectInput reference without
emitting any counts. This is a concrete production conversion mismatch, confirmed
in one small local production guest/renderer sample. It explains the retained
stationary game cursor. The original's returned button state and acquisition
state during the click remain **UNKNOWN**; no complete original-consumption or
passing-after repair is claimed.

Evidence: `scratch/runs/20261107-mw3-mouse-consumption/`. Predecessor
`67cca849e` was terminal/released. Its reviewed images, native events, owner
bindings and geometry were read and the menu/after-click images personally
reviewed again. No original game or boat was launched. Dungeon Keeper owned
`tools/dungeon-keeper-native-motion.cjs` and its test throughout; neither was
edited or used by this sample.

## Requested point versus actual consumers

The retained original command requested normalized canvas `[0.30,0.44]`.
`browser.cjs` converts that using the canvas CSS rect: left 10, top 194,
width 684, height 480, giving CSS `(215.2,405.2)`. Production
`lib/browser-input.js:eventPointFromClient` floors CSS-to-logical-canvas
coordinates. `lib/renderer-input.js:_mapExclusiveInputPoint` then maps the
logical canvas through the exclusive presentation viewport into guest pixels;
it does not merely multiply the normalized point by 640/480.

The retained renderer ended at **(182,211)**; its initial point was
**(320,240)**. The reviewed game cursor remains near native **(320,240)** in
both images. The requested point lies on the Instant Action row, while the
game cursor lies below it. The original did not retain its exclusive viewport
object or native event client coordinates, so the final rounding/letterbox
arithmetic cannot be independently reconstructed exactly from its JSON alone.
The measured `(182,211)` is the renderer observation, not a claimed guest
DirectInput result.

`handleMouseMove` uses a WeakMap keyed by the target process memory:

* With no previous absolute reference, `dx=dy=0`, then it stores the new point.
* Subsequent absolute moves subtract that previous point.
* Relative motion supplies explicit counts, including on its first event.
* Guest `SetCursorPos` updates the virtual cursor without manufacturing counts.

Thus a single absolute `mouseMoved` preceding DOWN does not position a
DirectInput software cursor. Even subsequent absolute moves need not align it:
the guest applies sensitivity and its own bounds. The existing
`tools/mw3-gameplay-route.js` explicitly uses relative motion and software-cursor
calibration; that private-handler route was read only and was not invoked.

## Automatic mode and actual MW3 polling

MW3 has no explicit `relativeMouse` registry override. Automatic detection in
`renderer-input.js` uses a recent recenter loop or the acquired/exclusive mouse
hint from `src/13-exports.wat`, cached for at most 250 ms. The browser requests
Pointer Lock inside trusted DOWN. An earlier unlocked move has already taken
the absolute path; detection at DOWN cannot retroactively turn it into counts.
Acquisition-click locked movement is suppressed until release. No profile,
automatic detector, cursor, guest state, clock or pointer-lock implementation
was changed here. The original did not record whether Pointer Lock succeeded.

Read-only `objdump` of the existing, SHA-pinned demo identifies the consumer:

| Address | Meaning |
| --- | --- |
| `0x4fa379..38f` | SetCooperativeLevel with flags from `0x5b6d78`; binary default is 5 (exclusive/foreground), runtime value unobserved |
| `0x4fa553..569` | Mouse device at `0x600ac8`; Poll, then GetDeviceState with size 16 into `0x600f68` |
| `0x4fa56c..582` | Check HRESULT; reacquire on `0x8007001e`; skip processing other failures |
| `0x4fa588..5ef` | Copy previous/current X/Y/Z/buttons, then process motion |
| `0x4fa640..690` | Scale X/Y through `0x5b6d70/74` and add to software cursor `0x600f90/94` |
| `0x4fa420..446` | Compare current/previous button bytes to derive button transitions |

The binary sensitivity defaults are approximately 1.3 per axis; current runtime
values are unobserved. WAT `IDirectInputDevice_GetDeviceState` atomically takes
shared X/Y deltas and reads `host_get_mouse_buttons_live`, not queued Win32
message coordinates/buttons. `lib/host-window.js` derives this mask from live
physical key state. A trusted DOM DOWN, numbered command ACK, and drained
Win32 queue do not prove that this guest poll returned `rgbButtons[0]=0x80`
during the original 100 ms hold. No such return was retained.

## One small actual production sample

`sample/` ran registered `dx_boids` via production `index.html`, actual guest
Worker and owning D3D render Worker, Chrome 151/SwiftShader. Both executing
modules were recovered through CDP and matched SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`
(2,182,493 bytes). The checkout was
`34384c0938832cc8d32a26c061b41947ad30c490`.

The unchanged predecessor MW3 admission chain validated all 18 identity fields,
live modules and its existing freshness bound. Personally reviewed Boids pixels
were bound to exact command/consumer ACK **0**, followed by one trusted move,
DOWN and independently armed UP at 100 ms. No accepted matrix was repeated.

Passive wrappers called the original methods exactly once and were restored.
Before the move the DirectInput reference was absent and X/Y accumulators zero.
CSS `(215.2,429.84)` became DOM `(215,429)`, logical `(191,210)`, and mapped
guest **(191,209)** through this sample's measured viewport. The renderer moved
there, but DirectInput X/Y stayed **(0,0)**. The button FIFO write index advanced
by two after the balanced click. This proves publication, not guest polling:
Boids did not supply a DirectInput mouse-consumer observation, and the optional
`takeInput` wrapper recorded no calls. Its automatic hint was false and profile
absent; that is not a measurement of MW3's runtime hint. Before/after images
were personally reviewed as the same small Boids scene, not MW3 progress.

## Required next observation and custody

Before another navigation claim, qualify a bounded ordinary native continuous
motion path with unchanged automatic detection, then in a separately authorized
original observe actual GetDeviceState completion at `0x4fa56c`: HRESULT,
`0x600f68..77`, cursor `0x600f90/94` and button transitions, correlated with
native event times and immutable reviewed pixels. Read current cooperative/
acquisition flags and Pointer Lock state too. A sampler that misses the 100 ms
DOWN interval must report UNKNOWN; it cannot infer a returned press from ACK.
Do not repeat the same one-jump click or write/calibrate guest memory.

No general first-event repair is justified by this evidence: manufacturing a
delta from an arbitrary virtual cursor would change first-entry/touch semantics
without proving original button consumption. This task therefore ends with the
precise missing observation, rather than a failing-before/passing-after claim.

`source.json`, relevant binary patches, run-input patch and
`retained-references.json` record Git/module/source identity and existing media
references without copying media or archiving source trees. Syntax, focused
artifact assertions, PNG/module hashes, exact ACK, independent UP, and cleanup
passed. Production code was unchanged, so no build was required. Sampled free
disk stayed above 2 GB; continuous minimum telemetry was not retained.

Chrome exited normally with code 0; driver/Chrome PIDs absent, both owned ports
closed, profile absent, no matching Chrome process, mouse mask zero, observer
restored. The command writer lock was released. No test box was assigned:
box ID/state/expiry **not applicable**. No lifecycle ownership remains. No
cockpit, movement, fire, FPS or parity result is claimed.
