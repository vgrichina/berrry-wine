# GLTron low-latency personal WebGL review — 2026-11-04

The sole original WebGL attempt stopped at **5,496 ms** capture-to-reviewed
action, before a measurement command was queued or a counter armed. No living
five-second entered-update interval or personally reviewed after image was
obtained. Automatic first-fault closure worked without another command or
another actual attempt. The concrete blocker is live image/transport/model
handoff latency exceeding the unchanged five-second bound.

Input: `b590f8a1c55b3e1d5a04dd24527584628767dc9c` and
`gltron-atomic-ack-webgl-20261104.md`. Evidence lives in
`scratch/runs/20261104-gltron-low-latency-webgl-gameplay/`.
The accepted software result and historical qualification are not repeated.

## Offline latency work

The capture now asks Chrome for lossless PNG with `optimizeForSpeed: true`.
It preserves the complete visible canvas clip, pixels, hash, original host
capture epoch, page monotonic capture time and module generation. A separate
completion timestamp measures capture duration; neither start clock moves.
Runtime mailbox polling falls from 100 ms to 10 ms. Native ownership, input,
scene, liveness and five-second guards remain unchanged. The prior atomic ACK
and persistent first-fault/blocking/normal-close behavior remain in place.

The current complete CLI executes offline with an explicit plain mocked
Puppeteer browser, real HTTP server, real pins, both compiled-module probes,
real command mailbox, atomic ACK producer and actual CLI client. Public child
spawn methods and the native asynchronous spawn entry are independently
forbidden; only exact read-only Git inventory calls are allowed. Fixture
permission and the separate private ancestor lock apply only inside that VM;
they never provide permission to the actual browser entry.

I personally viewed the fresh 800×600 blue checkerboard returned by the exact
successful capture ACK, using `view_image` in the same tool invocation. The
next actual CLI measurement action reached the mock counter arm at **3,181 ms**
in the first probe. A second complete-entry probe injected the previously
observed **1,875 ms** capture delay. Its personally viewed capture reached the
next action at **4,859 ms** from original capture start, within the unchanged
5,000 ms guard by 141 ms. The synthetic pixels and mock counter are not live
gameplay evidence, and this narrow margin does not guarantee live timing.
Both fixture runtimes closed normally. No timestamp was refreshed or personal
review claimed by the fixture automation.

A final fresh complete-entry mechanical preflight uses the final source and
fresh pins, with zero Chrome launches. It exercises capture, ACK, balanced
controls, mock measurement and normal cleanup. Release tests now require the
exact `stronghold-repaired-entry` actor and its latest preceding ownership of
the repaired-entry assignment's exact note path, rejecting the prior
Stronghold/MDK releases, quoted messages, stale/future times, wrong ownership
and reversed record order. Actual permission comes from the real messageboard.
The initial gate demanded the task token on the release itself; this redundant
condition was corrected offline before any Chrome. The real 21:27:19Z ownership
and 21:35:31Z release provide the binding without a repeated permission request.

## Sole original WebGL attempt

The final actual entry consumed Stronghold's explicit assignment-bound release
at **21:38:40Z**, following its verified owned exits, refused ports, removed
profile and free external lock. MDK had released before Stronghold started.
The original ran from main `5d2ac7e6d8907dcf3c65b16fbc5058907a0dda13` plus
the recorded relevant binary diff. One long-lived external
`/tmp/wine-local-runtime.lock` covered the runtime. Limits stayed at
720/60/40/180 seconds with full 23:50Z/23:53Z absolute reserves.

I personally viewed fresh main, Game, paused-arena-confirm and active-before
captures returned by successful exact ACKs. An earlier capture named
paused-confirm still showed the menu; no unpause input used it. The later
paused-arena-confirm visibly showed the yellow cycle and "GAME IS PAUSED".
Active-before visibly showed the living yellow cycle in the original arena.
The next action was measurement, rejected before queuing. No further operator
command was issued and no after image is claimed.

The exact owning bridge reported `OpenGLHostBridge` / `WebGLBackend`,
`matchesOwner: true`, with WebGL 1.0 and browser-reported unmasked renderer
`ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)`.
This does not establish physical GPU performance. Ordinary balanced native
S steering had both original acknowledgements **direction 3 → 0** and
**trail offset 0 → 1** before the fault. The native steering logic was unchanged.

Active-before capture started at **21:40:43.642Z**, completed PNG acquisition
at **21:40:44.679Z** and returned its successful ACK at **21:40:44.697Z**.
Capture-to-ACK fell to **1,055 ms**, compared with the input attempt's 1,875 ms.
The remaining handoff consumed **4,441 ms**, producing the **5,496 ms**
rejection. This live handoff exceeded the offline probe's margin. Fast capture
helped but did not resolve the full live path; the five-second rule was not
weakened, and neither timestamp was refreshed.

`client-first-failure.json` retains the exact prequeue cause with `queued:
false`; the owner retained that cause, blocked further commands and requested
normal close at 21:40:49.218Z. Chrome PID **1209382**, start **187560245**, exited
0/signal null at **21:40:49.854Z**. Node **1209344**, start **187560206**, and
flock wrapper **1209343** are absent; the wrapper returned 0 (its start identity
was not recorded). HTTP **33801** and DevTools **33707** refused connections;
the exact owned profile had no processes and was removed. The server closed
and the external flock was verified available. Explicit local heavy release
was posted at **21:41:19Z**. No foreign process was signalled.

Validation: **81 focused checks**, the final fresh full-CLI mock with independent
spawn prohibition, syntax/diff checks and the full locked build passed. Both
compiled module hashes remain `78a0b1d6…` / `99b579cd…`; existing media/modules
are referenced by path and SHA only. Git SHA, relevant binary diff and new-note
patch preserve source provenance, without source/media/module snapshots or
archives. Box ID/state/expiry N/A; coordinator retains lifecycle ownership.

There is no WebGL rate result. Any future result must describe **ENTERED
nonzero-dt gameplay updates per second**, not display, completed-update or
physical GPU FPS. A further original attempt needs separate authorization and
a stronger demonstration that the full personal image handoff fits; this
assignment stops after publishing the failure and verified cleanup.
