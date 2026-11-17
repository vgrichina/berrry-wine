# Current registered Jazz native rendering, 17 November 2026

Evidence is in `scratch/runs/20261117-jazz-current-native-rendered-scene/`.
This task uses the actual `scr_jazz` registry entry: `JAZZ.SCR /s`,
`JAZZ.SCN`, `JA_NOTE2.X`, `JA_NOTE4.X`, registered clock and presentation cap.
It does not reuse an original Boids observation as a Jazz observation.

`tools/jazz-current-run.cjs` reconstructs runtime source in memory from one
published Git revision, compiles before the runtime clock, and serves the
unchanged registered Jazz inputs and existing shared DLL/font closure. Node
helper imports inherit the selected Git source. Each original observation uses
the actual guest Worker route, a 300-second native deadline and an
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
The one WebGL original observation used published `bbef23f726` after this correction.

No keyboard, pointer or native Quit action is part of this task. Explicit host
shutdown is recorded separately. No boxes, Codex workers or public deployment
are used. FPS, audio, Windows-reference pixel correctness, physical GPU use,
complete saver cycles and historical corpus completion remain outside scope.


That WebGL original failed before creating a render endpoint. The genuine
COMCTL32.DLL initializer trapped with `Missing NE image COMMCTRL`, at guest
EIP `0x7463e5d2`; its module was `0x74612000`. The runner returned 404 for
all COMMCTRL alias searches. Locally, `binaries/dlls/commctrl.dll` already
symlinked to `../sims-native-common-controls/kommctrl.dll` (SHA-256
`39bbfafa8b759ebfcf6a00ee878fa494581a9144891bbd788bded61441de13f9`).
The runner's directory enumeration accepted regular files but omitted symlinked
files. This is a reproduced runner media-closure defect, not a demonstrated
D3DRM renderer defect. The software failure's exact cause remains unknown;
the WebGL diagnosis must not be retroactively assigned to it.

The fix serves file symlinks under their existing aliases and includes the
existing `test/binaries/tlbs` directory. It changes no media or filesystem
links. A separate authored native PE imports genuine InitCommonControls and
renders the literal Direct3D fixture. With published `bbef23f726` core and the
retained owned helper patch, genuine COMCTL32 DllMain returns EAX 1,
COMMCTRL and stdole2.tlb are served with their actual existing hashes, and
actual guest/render Workers instantiate module `4a5a3431…`. Its software
endpoint completes one native draw with zero software fallbacks. Every pixel
of the complete 1280×960 source and 1280×926 output passes the literal oracle;
both complete images were personally reviewed. Publication 4 retains timestamp
1794897624581; readback starts 1794897639613 and completes 1794897639751.
The complete outer capture takes 1498 ms against the unchanged 3000 ms bound.
This authored app has its own registry identity `jazz_native_authored`; it is
not an original Jazz observation or replacement Jazz executable.

The repaired authored control exits with actual native wait 0 and both EOFs,
actual preparation/runtime watchdog waits 0 and both EOFs, browser wait 0,
and actual guest/render target-destroyed events. Explicit host shutdown returns
guest result OK. The render-retirement promise field was absent at that
instant, so no normal render-retirement acknowledgement is claimed. Target
destruction and browser shutdown are separately retained. The WebGL original
has actual native wait 1, both EOFs, watchdog waits 0 and browser wait 0.

Both original endpoints are permanently closed and neither was retried.
There is no original Jazz scene, natural motion, original renderer/backend
positive, FPS or audio result. The WebGL native control uses SwiftShader;
its context renderer string reports Intel while browser SystemInfo reports
SwiftShader, so no physical GPU claim is made. Native-control proofs cannot
substitute for an original scene. The first concrete defect has a tested fix;
fresh original observations require a new task authorization.

Validation: focused Boids driver tests, GL current-display servicing (8 tests),
literal edge-corruption controls, durable-log SIGTERM child test, syntax checks,
and canonical `flock /tmp/wine-build.lock bash tools/build.sh` pass. The build
uses the shared working tree; observed browser modules use the separately
pinned published Git source and retained helper patch. See `result.json` for
exact commits, module recovery, waits, provider records and selected images.
