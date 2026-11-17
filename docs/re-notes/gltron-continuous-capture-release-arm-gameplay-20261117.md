# GLTron continuous capture and independent release, 2026-11-17

Evidence: `scratch/runs/20261117-gltron-continuous-capture-release-arm-gameplay/`.

The predecessor's software read-ticket timeout and WebGL pre-DOWN arm refusal
remain closed. No queries are sent to either endpoint.

After the first current-display request, the renderer retains each subsequent
ordinary publication's source and output canvas caches together. Retention
occurs synchronously after successful display, with no executing writer or
GDI paint. A later request can read that exact publication while another
native writer runs. The source is never reconstructed from the newer live
producer. A new host request also refuses an already recorded native GPS producer error
before it can wait behind a running slice. Identity, geometry, visibility, opacity, context loss, producer
retirement and readback errors still refuse observation. First observations
without a retained cache keep the existing ordinary-publication fences.
No observer schedules a render, surface upload, guest entry or publication.
Retained canvases are reused and only enabled after capture is requested.

The independent physical-release process connects before native launch.
Each reviewed edge then arms over local IPC, with an immutable nonce and its
own deadlines. Startup and WebSocket/target/Runtime phases are recorded.
Both processes tombstone nonces; a real-browser test found and fixed the
parent's old-reply match on a reused nonce. Cancellation before DOWN sends
no input, idle parent EOF closes cleanly, and a stale browser start token
refuses startup. Real native recipes, rather than protocol test stand-ins,
qualify trusted physical UP and native USER return.

The arm bound remains 1000 ms. Fallback UP is sent at 1500 ms after arming,
leaving delivery margin within the unchanged 1750 ms DOWN-to-UP maximum.
Admission retains 500 ms before that send, and native context freshness
remains 250 ms. Successful edges explicitly check the actual renderer UP
timestamp against the actual applied DOWN. The software parent-stall recipe
also retained the earlier boundary result: a real 1900 ms parent stall with
trusted UP at 1748 ms after DOWN. The earlier send provides more margin.

Complete capture selects the immutable ticket before starting two independent
reads: byte transport and a later full host screenshot. Both must join within
the same original 3000 ms total deadline. A late branch cannot retain pixels
or cause another endpoint call after UNKNOWN. Source/output still belong to
one exact publication; the host screenshot records its separate later time.

Development failures are retained without success credit. A no-idle native
producer first prevented any initialized display, then exhausted CDP
responsiveness after Enter; it is not a qualification recipe. The faithful
timer-driven native producer continuously presents while the game logic is
idle, and records actual active writer captures. A development WebGL capture
completed its ticket but exhausted the total bound during the serial host
screenshot; concurrent byte transport repairs that serial overhead. A native
retirement harness also attempted to serialize complete typed arrays through
CDP; lifecycle results now report metadata and lengths instead of millions of
numeric properties. These are distinct from native gameplay proof.

Focused tests cover active and parked writers, exact literal retained pixels,
later publication isolation, queued damage, paint, cancellation, stale owner,
process/instance replacement, producer errors and epochs, context loss,
retirement, opaque output, concurrent transport and late-result discard.
Real native/browser recipes and final original outcomes are recorded in the
run's result JSON. Original allowances are used only after the fixes, complete
recipes, focused tests, locked build and strict publication.

Foreign guest-thread, render-worker, NE and child runtime work is excluded
from publication and immutable runtime inputs. Only the renderer review row
is owned in the shared review file. Evidence records Git and binary patches;
media are referenced by existing path and SHA-256. No source archive, frame
archive, media copy, worker, box or public deployment is created.
