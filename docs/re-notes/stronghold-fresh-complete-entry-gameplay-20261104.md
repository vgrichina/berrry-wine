# Stronghold fresh composed entry, 2026-11-04

Input: `e283a7a3aaed569d3e364af05daded45f18a92f4` and
[the render-sized observer note](stronghold-render-sized-observer-20261104.md).
Evidence: `scratch/runs/20261104-stronghold-fresh-complete-entry-gameplay/`.

The game was never launched. An attempted offline rehearsal accidentally
started Chrome before the required GL release. That is a worker harness error,
not an authorized original outcome. Chrome exited normally, and no second
actual Chrome launch was made. CustomGame, setup, preset, Start, world and
gameplay remain untested by this assignment.

## First failure and repair

The first rehearsal replaced `require('puppeteer').launch` by assignment and
overrode the release signal with an explicitly synthetic offline fixture. On
Node 24 the installed Puppeteer package is an ESM namespace. Assigning its
`launch` export in a non-strict child script silently fails: `Reflect.set`
returns false and the export remains unchanged, even though its property
descriptor says `writable: true`. The retained composed caller therefore used
the real launch function. This was initially described as a getter problem;
the offline namespace probe disproves that diagnosis.

At 21:20:29Z Chrome PID `1171826`, start ticks `187443855`, started under the
private test flock rather than `/tmp/wine-local-runtime.lock`. The required GL
release was not yet present. The rehearsal's two-module-only manifest rejected
`index.html` as an unsealed HTTP file, returning HTTP 500. The caller's selector
readiness wait expired after 20 seconds. The game Launch button was never
clicked; there were no game inputs, guest instances, loaded game modules,
native ACKs, scenes or callback observations. No scene or gameplay evidence is
manufactured from this browser.

The repaired regression substitutes only the Puppeteer binding in the test
composition with an explicit plain mock object. It independently forbids all
child spawning. The real composed main still executes filesystem writes,
release binding, ancestor-flock validation, lifecycle installation, source pins,
HTTP server creation and the actual `launchOwned` wrapper. Its mock launch
throws an unmistakable sentinel; the test requires exactly one sentinel,
zero Chrome children and zero spawn attempts. Cleanup closes the real server.
The full-manifest execution checks 2,429 filesystem pins before reaching that
sentinel. The external release row used by this offline test is explicitly
synthetic and conveys no permission to start a browser.

## Runtime changes

The local contract now names this assignment and requires an explicit
`gltron-atomic-ack-webgl[-nov04] LOCAL HEAVY RELEASE` after the MDK 21:16:19Z
release. Earlier, foreign, future and embedded quoted release rows reject.
The existing long-lived ancestor-flock check remains in the actual entry.

The actual main installs a run-bound lifecycle recorder immediately after its
output-directory and ownership-receipt writes. It records its process identity,
launch request, exact Chrome command/profile, actual child PID/start ticks and
exit status. The launch wrapper requires the returned browser to belong to
exactly one recorded child. Installation is part of the composed entry rather
than an optional outer-wrapper prerequisite.

The accepted both-module native render parity and focused observer results
from the input commit are reused. The fixed 50M/360s continuous observer,
byte/record/nesting/input/owner/ACK guards, 720/60/40/180-second limits and
23:50/23:53Z absolute cutoffs are unchanged. No guest code, configuration or
pacing changes were made. No fresh successful native ACK exists here; an empty
host queue is not guest callback proof.

## Cleanup and validation

The actual caller closed Chrome normally through CDP `Browser.close` at
21:21:04Z: exit code 0, signal null. Its Node PID `1171814` and private flock PID
`1171813` are absent, as is Chrome `1171826`. HTTP port `37209`, DevTools port
`39917` and a repaired mock-server port refused connections. The exact owned
profile was removed after process absence was checked. No shared runtime lock
was acquired. The explicit own LOCAL HEAVY RELEASE was posted at 21:23:22Z,
after the real GL release at 21:22:51Z; no further Chrome was started.

Focused local-runtime tests pass, including the immutable-export regression,
actual fresh-directory ordering, full composed mocked entry and all 37 release
contract negatives. Full filesystem/media/helper/module preflight and 1,016
HTTP content/isolation/cache checks pass with both retained module hashes
unchanged. `flock /tmp/wine-build.lock bash tools/build.sh` passes. The input
run's 89 sealed artifacts remain unchanged.

Recovery records the exact Git SHA, relevant binary diff and this new note as
a patch. Media/modules are referenced by existing path and SHA only; no source
snapshots, media/module copies or tars were made. Box ID/state/expiry are NA;
the coordinator retains shutdown ownership. Further original gameplay requires
a separately authorized attempt through the repaired offline rehearsal.
