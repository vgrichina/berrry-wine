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
fixtures. GREEN and fresh-source/native qualification are still required.

Evidence destination: `scratch/runs/20261115-quake3-fullscreen-exit-layout-gameplay/`.
Source is preserved by Git SHA plus binary patches, with media referenced by
existing path and hash. Sims885263 → TIM799706 → this worker is a start
condition; no shared source/build/runtime is taken during the wait.
