# GLTron WebGL through atomic ACK publication — 2026-11-04

The sole original WebGL attempt passed the repaired atomic ACK path, but did
**not** produce a measured entered-update interval. The actual client rejected
the measurement request at **5,246 ms**, exceeding the unchanged 5,000 ms
capture/review limit, before queuing it. No counter was armed. The next operator
command was normal quit; there was no second original attempt. There is no
WebGL updates/s result or personally reviewed before/after measurement pair.

Input: `ca8ee37f38923ec097b2afc621f7737587263cf3` and
`gltron-repaired-live-backends-20261104.md`. The accepted software result and
historical review packaging were not repeated. Current evidence:
`scratch/runs/20261104-gltron-atomic-ack-webgl/`.

## Fresh original observations

Personally viewed the exact successful-ACK capture paths for the fresh main
menu, Game menu, paused arena confirmation and active-before image. The first
capture named paused-arena still displayed the menu despite a paused callback;
only a later read-only paused-confirm image showed the arena. No input used
the stale image. Active-before shows the living yellow player and original
trail before its first steering turn. It does not show a post-turn result.

The repaired writer delivered drive reply 6 and exact-capture reply 7 as
complete JSON. Twenty-five retained steering samples were all living. Two
ordinary native S turns have original direction **and** trail acknowledgements:
`3/0 → 0/1`, then `0/1 → 1/2`. The first was sent at 21:22:00.508Z and
acknowledged at 21:22:01.855Z; the second was sent at 21:22:04.370Z and
acknowledged at 21:22:04.516Z. The automatic steering loop remained active
until quit was processed; the second turn occurred after the client rejection.
No further operator gameplay command was issued. Native ACK samples alone do
not establish visually reviewed steering or a five-second entered-update rate.

The actual owning bridge was `OpenGLHostBridge` / `WebGLBackend`, matching the
main owner. Its observed context reported WebGL 1.0 and unmasked renderer
`ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)`.
This is the browser-reported renderer; no physical GPU performance claim is made.

## First cause and offline repair

Active-before capture started at 21:21:56.171Z; its successful ACK returned at
21:21:58.046Z. The client rejected review at 21:22:01.417Z. The capture-to-ACK
portion consumed 1,875 ms and the remaining handoff consumed 3,371 ms. The
recorded cause is capture/review latency, not an engine fault, empty ACK, player
death or counter failure. The five-second guard was retained and no request
was resent. `operator-first-fault.json` preserves the cause and `commands.jsonl`
contains shots, route inputs, drive and quit, with no measure command.

The observed rejection also exposed a lifecycle gap: this prequeue client
error did not persist a first-fault record or automatically notify the running
owner. The offline repair now atomically records `client-first-failure.json`,
forbids subsequent capture/gameplay commands, and makes the running owner
notice the fault and perform ordinary closure. The original cause remains in
the separate client record. This repairs first-fault handling; it does not
claim to shorten personal review latency or qualify a future measurement.

The actual complete CLI/runtime and actual client were exercised with a fresh
synthetic browser fixture. With the pre-repair client/loop mutation, a 5,247 ms
review rejection leaves the runtime running without the client cause record;
the fixture must send quit. With the repaired client/loop, the same rejection
persists the cause and closes normally without another command. Both reject
measurement before queuing or arming. Both use the real pinned HTTP server,
actual ACK producer/client and balanced mock keyboard calls; zero real Chrome
launches. These post-release fixtures use a separate external fixture lock,
leaving the local heavy runtime available to Stronghold. Preparation-only pin
and existing-directory failures are preserved alongside the successful checks.

The launcher was also restricted to this task's sole WebGL backend and exact
fresh installed-MDK release instead of its predecessor's software/WebGL pair
and old release requirements. Negative release, lock, path, hash, epoch,
owner/native/input/liveness/scene and five-second tests remain. No guest,
code, configuration or pacing writes were made in the original.

## Entry, validation and closure

Before the sole Chrome, the actual current CLI completed a fresh mocked-browser
entry, bootstrap, HTTP request, shot/ACK/review queue, balanced controls,
measurement command and normal closure. Its synthetic pixels were explicitly
fixtures, never historical or live gameplay evidence. A newly produced exact
fixture capture was personally viewed before the real review/run gate. The
real gate consumed that proof within its unchanged bounds.

Full original media/dependency/module path and SHA preflight passed: 1,010
offline HTTP routes, with all 234 actual original HTTP responses matching
pinned paths and hashes. The original ran from main commit
`cd788045394d877eb28cdb9f01c3acc62cc13bb4` plus the recorded prelaunch binary diff.
Modules remained `78a0b1d6…` and `99b579cd…`, referenced at their existing paths.
Final validation: **81 focused checks**, executable actual complete-entry
old/new fault handling, syntax/diff checks and the full locked build.

The explicit installed-MDK release at 21:16:19Z preceded the original. One
long-lived ancestor flock covered the sole WebGL runtime; 720/60/40/180-second
runtime/bootstrap/command/cleanup limits and full absolute 23:50Z/23:53Z
reserves remained. Chrome PID 1173079/start 187448798 exited 0/signal null;
Node PID 1173066/start 187448767 and wrapper exited 0 and are absent. The exact
owned profile has no remaining processes and was removed after HTTP 39473 and
DevTools 33625 refused connections. The server closed and flock was verified
available. Explicit `LOCAL HEAVY RELEASE` was posted at 21:22:51Z for Stronghold.
Browser lifetime: 49,807 ms. No foreign processes were signalled.

Evidence retains fresh actual images, ACKs, logs, exact Git SHA and relevant
binary diffs/new-note patch. Existing media and modules are referenced by path
and SHA; no source/media/module snapshots, copies or tar archives. Prior
evidence is untouched. Box ID/state/expiry N/A; coordinator retains lifecycle
and shutdown ownership.

Next requires separate authorization: resolve the personal capture/review
handoff latency offline, then a fresh complete-entry check and a new bounded
original WebGL attempt. This assignment stops after publication of this result
and the tested first-fault handling repair.
