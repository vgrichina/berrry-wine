# Current registered Jazz native rendering, 17 November 2026

Evidence is in `scratch/runs/20261117-jazz-current-native-rendered-scene/`.
This task uses the actual `scr_jazz` registry entry: `JAZZ.SCR /s`,
`JAZZ.SCN`, `JA_NOTE2.X`, `JA_NOTE4.X`, registered clock and presentation cap.
It does not reuse an original Boids observation as a Jazz observation.

`tools/jazz-current-run.cjs` reconstructs runtime source in memory from one
published Git revision, compiles before the runtime clock, and serves the
unchanged registered Jazz inputs and existing shared DLL/font closure. Node
helper imports inherit the selected Git source. Each original observation uses
an actual guest Worker and render Worker, a 300-second native deadline and an
independent 320-second watchdog from the published Boids supervisor. Complete
current-display capture has its unchanged 3000 ms deadline. Failure permanently
closes that observation; it never triggers another guest request or retry.

The pre-original native Direct3D fixtures use published core revision
`a578380694975018eb42b58723ee6c76da118027`, module
`4a5a343182dd68c141d2d7646880186f555e83169b8fb493d9b61272815bc356`.
All three software complete frames passed the literal source/output oracle.
The authored Device2 WebGL source contains exactly the authored 320 by 240
blue rectangle on white, with all 307200 source and 1185280 output pixels
passing the corrected literal oracle. Both selected complete output frames
were personally reviewed. Main, guest Worker and render Worker instantiated
module receipts match the retained module.

Two obsolete qualification assumptions were reproduced and corrected. The
generic owner-fault loop attempted to replace a GPU bridge source on the
software route, which has no GPU bridge. GPU-specific faults now require that
bridge. The Device2 oracle expected rows 1 through 240, predating the published
top-left raster repair. The authored integer-centred rectangle includes row 0
and excludes row 240. The old oracle fails the retained native capture; the
corrected oracle checks every source/output pixel and rejects independent
upper/lower edge corruptions. These changes repair qualification helpers;
they are not new Jazz renderer fixes. The software fixture's post-capture
control failure remains recorded with native exit 1 and actual waits/EOF.

The one software original observation on `abe9413a9` did not produce a live
scene window or a complete capture. A passive read before its deadline found
the shell's fatal overlay reporting `scr_jazz stopped`, with no running app.
The precise guest/launch exception was lost: the helper buffered console and
network observations until async cleanup, but the native 300-second supervisor
deadline terminated Node first. Native signal 15, supervisor exit 124, both
native pipe EOFs, actual watchdog waits and an empty token scope are retained.
Browser/Worker retirement acknowledgements are unavailable for this attempt.
The endpoint is permanently closed and the software original is not retried.

The helper now persists each console/error/network event immediately, and
observes the shell's existing read-only crash-report textarea during startup.
This permits early refusal with the exact report instead of waiting until the
runtime deadline. An actual OS-child test writes through the helper's logger,
then receives SIGTERM; its single exact record survives, with actual wait and
both EOFs. This is an evidence-lifecycle repair, not a Jazz renderer repair.
The unspent WebGL original observation follows publication of this correction.

No keyboard, pointer or native Quit action is part of this task. Explicit host
shutdown is recorded separately. No boxes, Codex workers or public deployment
are used. FPS, audio, Windows-reference pixel correctness, physical GPU use,
complete saver cycles and historical corpus completion remain outside scope.
