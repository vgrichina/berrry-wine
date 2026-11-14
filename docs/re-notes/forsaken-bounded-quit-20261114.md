# Forsaken bounded controller repair, 2026-11-14

The repaired controller is now a permanent tool, with production HTTP/guard
regressions. The fresh original run is **not launched**: offline recovery is
missing nine required native provider files. Native Quit, target damage,
enemy kills and full27 remain unproved. Evidence belongs to
`scratch/runs/20261114-forsaken-bounded-quit/`.

## Release ordering and transport limits

`tools/forsaken-controller.py` adopts the repaired `control.py` from the prior
run's exact `run-inputs.patch`. An independent release child acknowledges its
arm before DOWN. An absolute two-second cap is persisted before the first
DOWN, and the consumed-time schedule is persisted before the late-ACK
assertion. A late ACK remains terminal; the tool never replays or rebinds it.
The production guard, owner checks and nonce tombstones are unchanged.

The guard envelope also expires at the pre-DOWN cap. This prevents an input
handler delayed beyond independent release from subsequently applying DOWN.
A successful action requires the release ACK to complete within two seconds
of each consumed edge. A release-fired timestamp only records a request;
physical completion is bounded by its ACK and verified against actual fixture
DOWN/UP effects. A blocked synchronous server can prevent physical UP even
though the independent child has fired. The regression deliberately exercises
that failure and retains terminal input state.

The prior final Enter80 has consumption at1794674244.362 and a DOWN-record
mtime at1794674244.542, a180ms consumption-to-record interval. That record is
after receipt persistence; it is not an exact measurement of HTTP return.
The retained run does not separately timestamp ACK return. Other prior menu
consumption-to-schedule intervals reach56.922ms. The new tool records ACK
return separately. A finite400ms menu gesture is tested against a280ms busy
synchronous endpoint and a180ms delayed response. The80ms known-late negative
is preserved; its physical UP occurs after the requested pulse, so it remains
terminal. No transport-late acceptance exception is added.

Combat keys enforce a five-second scene limit even if a caller supplies the
menu's thirty-second limit. Fresh personally reviewed captures remain bound
by hash, native PID/start identity, exclusive listening socket and single use.
The CLI bind now reserves its intent before calling the endpoint, avoiding
Python argument evaluation rebinding an owner before a file collision fails.
No production guard or guest input mapping is changed: A is forward, Z reverse.

## Checks and publication

The durable regression uses `lib/control-server.js` and
`lib/cli-guarded-input.js`, OS-assigned fixture ports and actual child PID/socket
checks. It covers delayed consumption, delayed ACK, busy native-like batches,
dropped ACK/UNKNOWN, pre-DOWN cap, pending late DOWN, paired A+Ctrl, stale aim,
owner permanence, collisions, independent release after parent death, and
postrelease progress. `tools/forsaken-supervisor.py` preserves actual native,
watchdog and supervisor child waits with separate stdout/stderr EOFs. Tests
also cover real TERM, invoker KILL, independent deadline and late inherited
pipes in both release-child and native-supervisor paths. A killed parent
cannot produce its release-child wait; the test explicitly preserves that
missing wait while establishing physical UP separately.

The first22 controls pass. The next28-control run retains one60ms baseline
timing failure and one partial fixture-endpoint JSON read. The fixture now
publishes endpoint identity atomically, and its ordinary menu baseline uses
the justified400ms gesture. These failures are not relabelled as passes. The
following29-control run finds one real `/proc` descriptor-close race during
binding. The controller now reads each descriptor once and skips only a
vanished descriptor; the actual native PID and exclusive listening-socket
requirement remain intact.

The final29 controls pass, including both late inherited EOF regressions.
The three production guard/owner/transport tests also pass. Both required
heavy/build-locked builds pass; the final build has zero drift across1647
source pins and module SHA256
`c94ccf1b179f18bd4b47867445afed8cef2f1393b19aabfd259c7f3b94a7be09`.
Explicit-path publication includes only the controller, supervisor, Python
regression, HTTP fixture and this report.

## Original-run blocker and retained predecessor

Offline `npm ci --ignore-scripts` restores153 of162 exact provider files.
The missing files are deps-opengl's `libGL.so`, `libGLEW.so.2.2`, `libXrandr.so`,
`libXrender.so`, `libglfw.so.3`, and the glfw, segfault, uv-loop and webgl
`.node` binaries. Their required hashes are retained in `native-pins.json`.
Repeating the prior `npm ci --offline` recipe with outbound proxies blocked
also leaves those same nine files absent. The install helper invokes curl;
npm's offline flag alone does not establish offline native asset recovery.
No matching local native files or retained provider archive was found. No
network recovery, root dependency installation or replacement provider is used.

The original600/independent620 attempt remains unspent. Its prerequisites were
LM900 followed by SuperTux pit1200; only the permitted short repair build runs
after LM's actual terminal completion. No original watchdog, process, aimed
action or Quit gesture is launched with missing dependencies. There is no new
native Quit or combat outcome to claim. The precise next requirement is local,
hash-matching recovery of those nine files, followed by a separately assigned
bounded original attempt.

The prior living run remains closed, with no replay or rebind. Its900-second
timeout was not Quit; EXITGAME was never reached, so this evidence does not
disprove modal repair `a56ebeec0`. Its5.745-second hold violation and143/missing
outer wait remain unchanged. The predecessor's terminal files are hash-pinned.
No box is created: ID and expiry null, state NOT_CREATED, stop receipt not
applicable. No deployment or worker is launched.
