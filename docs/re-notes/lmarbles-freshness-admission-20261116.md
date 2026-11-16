# LMarbles finite-intent freshness admission, 2026-11-16

The controller now rejects insufficient remaining operation time **before
DOWN**, normally before prearming its independent release child. The one
authorized fresh Normal / Original / Tier 1 Puzzle 8 session reached Moves 96,
but every subsequent board intention was NOT_SENT. The manual full-image review
turnaround left too little of the five-second capture window. Escape was also
NOT_SENT. There was no clear, tally, Puzzle 9, or ordinary native Quit.

Evidence: `scratch/runs/20261116-lmarbles-freshness-release-admission-repair/result.json`.

## Admission and immutable bounds

The predecessor's `sg1` had only 121.8 ms remaining before DOWN. Its 100 ms
pulse left 21.8 ms for UP acknowledgement; UP took 190.4 ms overall and arrived
68.6 ms beyond the immutable deadline. That original remains permanently closed.
No old endpoint was contacted or restarted.

Strict admission now requires **strictly more than**
`max(1.750, 0.500 + pulseSeconds + 0.500, 1.650 + 0.500)` seconds. These are the
existing physical-UP bound, confirmation/pulse/confirmation path, and independent
fallback plus confirmation allowance. For all supported 40–1000 ms pulses the
result is 2.15 seconds. This is not a measured-latency timeout adjustment.

The deadline is computed once as the minimum of the existing three-second
operation window, capture freshness expiry, and personal review freshness expiry.
It is never refreshed. Admission is checked before prearm, after arm, and again
immediately before dispatch. The latter checks also require enough room before
the already fixed fallback for confirmation and the requested pulse.

An armed release child can be disarmed before dispatch. It independently checks
the no-dispatch/disarm records and exits without HTTP or physical release when
no DOWN was authorized. Dispatch is durably marked before sending DOWN; once
effects are possible the independent UP remains mandatory. Slow ACK, invalid
focus/owner, UNKNOWN, release failures and post-effect timing failures still
permanently close the controller. They cannot become NOT_SENT or permit replay.

Confirmation 500 ms, independent physical UP 1750 ms, observation 3000 ms,
game freshness 5 s, menu freshness 30 s, and the 300 s Quit reserve remain
unchanged. The reserve is irreversible, including when an explicit Quit intent
is rejected as NOT_SENT.

## Verification

Seven completion-budget tests pass, including equality at the admission boundary
with zero request or child creation, both sides of that boundary, scene freshness,
and actual 3600/3620/300 prelaunch watchdog/reserve records and complete waits.
Eleven existing reserve/lifecycle tests pass.

Eight focused native tests exercise actual threaded `test/run.js`, real USER
windows and guard consumption, the production HTTP transport, and an independently
executed UP child. They cover sufficient room, actual elapsed capture age,
budget spent during prearm and immediately before dispatch, a fresh capture and
new nonce after proven NOT_SENT, slow ACK, lost ACK/UNKNOWN, focus and owner.
Positive consumption, release and confirmation pass within the unchanged bounds.
Predispatch refusals issue no DOWN; armed refusals issue neither DOWN nor UP HTTP.
Every fault control attempts capture, rebind and another pulse after closure and
proves zero later requests.

The final focus control changes actual native focus through the exported USER
setter. The final owner control replaces the fixture's bound renderer window
reference. Production guard receipts are CANCELLED/unconsumed with respectively
`reviewed native scene changed` and `owner/epoch/queue/device/window changed`.
An earlier diagnostic control attempted a forbidden second bind; its expectation
of a failed UP child was wrong because the permanent-bind fence rejected it
before changing ownership. That assertion failure is retained. The corrected
actual-window replacement control passes. These are fixtures, not game inputs.

The required `flock /tmp/wine-build.lock bash tools/build.sh` passed with actual
native/watchdog/supervisor waits and both EOFs. Shared outputs were released
promptly; subsequent runs did not read them. Exact 86-file media/CRT checks and
seven manifest corruption controls pass; postflight verification also passes.

## Startup adoption and fresh original

The runtime uses published Git `08d860b1809f678b912f21f2c85689ee9f21c3dc`, a
canonical independently compiled sealed module
`83703369cc49c3e16077a4abd43def27262487f83dd52583d1b433adf7095f5f`, and the
predecessor's unchanged indexed-source loader/supervisor. Its exact missing and
tampered source/index/module validation is retained unchanged. The predecessor's
observed cold startup result and native two-guest-Worker fixture are recorded in
`20261116-lmarbles-threaded-desktop-startup-repair`; no unchanged startup or GL
suite was repeated here. The new original itself instantiated both actual guest
Workers and displayed its ordinary menu and Puzzle 8 scene. Authentic SDL and
the exact original media inventory are unchanged.

The new original recorded 3600 native seconds, 3620 independent watchdog seconds
and the 300-second Quit reserve before launch. Four personally reviewed setup
inputs completed; physical UP acknowledgements took 123–184 ms. The complete
Normal/Original setup, level-8 confirmation and Moves96 board were reviewed.
There was no old progress, save, solver route, private board read, OCR, autoplay,
or queued action. Full-frame JPEG display conversions were tried to reduce review
turnaround; intent hashes and timestamps still refer to the original PNG capture.
No crop or timestamp refresh was used.

Five board/Escape intentions were cleanly NOT_SENT: two captures had expired,
and three retained only 1.079–1.625 seconds at admission. None reached prearm or
DOWN. Each new intention followed a new capture and nonce after its predecessor
was provably unsent. The final Escape intent irreversibly entered Quit phase but
also lacked admission room. The last complete image still shows Moves96.
This is an observed manual-review freshness blocker, not UNKNOWN and not a
physical release failure. No second original was launched.

Owned local cancellation shut down the host; native exit0 is not game Quit.
Native/watchdog/supervisor actual waits and both EOFs are retained. All 204
recorded process IDs and the original port are absent; 167 paired process waits
are indexed. The source/module holder's invoking tool exited143 without a normal
close receipt; its PID/descriptors are absent, and native launches had already
verified and resealed their own inputs. The board watcher also returned143;
the tool API does not separately report its pipe EOFs. These limitations are
retained without fabricating shutdown receipts.

No box was created: ID null, state NOT_CREATED, expiry null, stop receipt N/A.
Git plus owned binary/new-file patches are the source archive; no source tree,
media copies or WASM dump was archived. Only selected named images are retained.
Any further original attempt requires separate authorization and must preserve
these bounds. This worker releases its files and stops after publication.
