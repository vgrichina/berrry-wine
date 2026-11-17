# Quake III fullscreen exit and output layout, 2026-11-15

The predecessor feature `ec4644fdd` and report `c4d097e83` remain closed.
Its public metadata shows native fullscreen at 09:43:23.886Z (1920×996),
then no fullscreen at 09:43:27.444Z (1024×757), with the wrapper still fixed
at (0,0,1920,996) and output at (0,34,1920,962). Readiness 753 returned a
visibility exception in 58.241 ms. Screenshot 754 then became permanently
UNKNOWN at its fixed three-second deadline. Neither record is a timeout
diagnosis for the readiness expression. No old-run recovery is authorized.

Source inspection finds `resizeCanvas()` writes fixed pixel geometry
onto the wrapper during fullscreen. The browser's `:fullscreen` CSS already
owns that geometry. When fullscreen exits, the inline values persist until
the JavaScript fullscreenchange/resize callback runs. The recorded ordinary
flow stack at y=34 inside a still-fixed fullscreen-sized wrapper is consistent
with this stale inline state. Why the original browser exited, and whether
this callback was delayed, remain unproved. The historical exit trigger remains unproved.

The repair removes only those inline fullscreen layout writes;
the guest display mode, backing size, presentation resize, paint and guards
remain unchanged. The focused test verifies the unchanged sizing and repaint paths.

Actual Chrome RED (`layout-red-3`) ran before the production edit. Personally
reviewed host consent used trusted independent native DOWN/UP. Genuine exit
and a smaller 900×720 viewport, with only shell event callbacks delayed,
reproduced the exact (0,34,1920,962) output inside a stale 1920×996 wrapper.
The existing guard refused it. The guest backing stayed 1920×996. Draining
the real callbacks restored complete current output, whose immutable PNG
matched Chrome compositor pixels. A genuinely retired realm refused the old
unique context. Direct native/watchdog/supervisor waits reached both EOF;
postflight has no pin drift, HTTP mismatch or post-terminal requests.

The first fixture attempt reproduced refusal but exposed a synthetic mode
connected to the wrong shell renderer; it failed the later backing check.
The second corrected that setup and passed browser assertions, but using a
second diagnostic module collided connection IDs, so closure refused it.
Both attempts remain immutable and are not qualification evidence. The third
uses one connection allocator and passes. No original was started in these
fixtures. GREEN (`native-controls`) then passed the same genuine exit and viewport
shrink. During the callback gap the full output was (10,224,560,458), inside
the 900×720 viewport, with 18 delayed callbacks and unchanged 1920×996 guest
backing. The existing immutable current publication remained admissible.
After ordinary callbacks converged, complete compositor pixels matched the
current immutable capture. No viewport enlargement, exit suppression,
reentry loop, guest resolution change, clipped acceptance, guard change or
manufactured acknowledgement was used in production. Explicit fixture-only
restoration served the remaining controls.

Feature `5e63c90575df362d19603d35a598bfc8f1bfd5d8` was committed on main and
strictly pulled/pushed before the original. Validation: 69 focused tests
passed (one opt-in Chrome test skipped), helper controls passed, exact full
`flock /tmp/wine-build.lock bash tools/build.sh` passed, fresh Chrome source
inventory passed, full native qualification passed, and all five causal
controls passed. Native key/Mouse1 independent UP acknowledgements occurred
137/138 ms after arming. Replacement owner, retired context, overlay, top
layer, pending paint, and terminal UNKNOWN refusals remained effective.
Original admission checked all fresh qualification and source/host hashes.

The ONE authorized unchanged registered original consumed its authorization.
It used real clocks, cooperative 10000, fixed native 1800/watchdog 1820,
180-second Quit reserve, and three-second operations. Before host consent
or permanent binding, worker startup GL snapshot request 835 (47 bytes)
became terminal UNKNOWN at 10:38:41.883Z. Its response arrived after
4085.162 ms and did not reopen the connection. No later requests, host
consent, game binding, game DOWN, menu, arena, enemy consequence, or native
Quit occurred. Initial GL metadata had one draw and no transfer/present;
it is not a personally reviewed game scene. This is an exact partial
original outcome, not gameplay success. Offline attribution of the entire fresh trace has no overflow: 377 requests
are attributable. Request 835 has 4054.314 ms pre-entry, 0.020 ms body,
27.835 ms post-body delivery, and 4050.349 ms observed synchronous WebGL
overlap (2 ms cross-clock tolerance). Two getShaderParameter calls lasted
1909.605 and 2299.520 ms. This measures worker occupancy; GPU execution and
driver-internal root cause remain unproved. The late response remains
terminal UNKNOWN. No original retry or UNKNOWN recovery was attempted.

Direct closure: native exit 1, watchdog exit 0, supervisor child exit 0,
Chrome exit 0, all actual waits with both EOF. Across this task, 58 sealed
waits and 182 recorded PIDs plus groups were personally checked absent;
1023 source/media and 1365 host pins were unchanged through shutdown, with
zero HTTP mismatches or post-terminal requests. Both locks were free.
Runtime release SHA-256:
`56ceaa98ede3ae89d03f33ea2325b14ba261e97b61d326928a987f63b54ee374`.
No boxes were created: ID null, state NOT_CREATED, expiry null, stop receipt
NOT_APPLICABLE. Selected result screenshots show the qualified layout fixture;
there is no original game screenshot to substitute for the missing outcome.

Next: investigate startup worker observation scheduling during synchronous
shader-status queries from the immutable metadata, qualify any necessary
separate change, and obtain fresh original authorization. The published layout repair is complete. Historical
original exit cause and old full-trace overflow remain unproved/refused;
no sampling cap or deadline was increased.

Evidence destination: `scratch/runs/20261115-quake3-fullscreen-exit-layout-gameplay/`.
Source is preserved by Git SHA plus binary patches, with media referenced by
existing path and hash. Sims885263 → TIM799706 → this worker is a start
condition; no shared source/build/runtime is taken during the wait.
