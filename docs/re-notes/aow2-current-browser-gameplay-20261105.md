# Age of Wonders II: current browser gameplay, 2026-11-05

Task: AOW2-RENDERING-COVERAGE-20261009. Evidence directory:
`scratch/runs/20261105-aow2-current-browser-gameplay/`.

**Result: current browser gameplay remains unqualified.** The sole original
session reached the main menu and opened Scenario, then an owning-Worker
reservation error stopped this investigation before Single/Start. No shared
emulator source was changed and no original session was repeated.

The accepted native evidence in
`scratch/runs/20261101-aow2-current-original-control/` remains untouched.
The accepted viewport, vblank and native army-control work is not repeated.
This task requests one current browser session with ordinary inputs and
completed-slice Worker renderer observations, using the existing extracted
original and its retained companion identities. No download, media copy,
source archive, box or subworker is used. Box ID/state/expiry: N/A.

All work stayed source-only until the ordered exact final releases:
AoE3 repaired2005 at 18:55:54Z, Conan residency1825 at 19:17:29Z and Aranna
loader1840 at 19:27:34Z. Independent `release-gate.json` checks passed for
391 absent PIDs, 155 refused ports, 43 absent profiles, four free locks and
zero heavy processes. Runtime ownership began 19:28:03Z with a 20:13Z cleanup
deadline. No test, build, browser or shared source edit preceded that gate.

The cheap prerequisites passed: all **1,064** retained original fixture pins
(including the manifest), current boot/system data, fonts and native DLL
closure, runner syntax/dependency checks, WAT manifest and Worker import
signatures. The EXE remains 5,748,736 bytes, SHA-256
`a10590e5dbd013d154b00ea53e66670f4e74d38ab33adb2523f0a662af8f89f7`.
The original companion tree and manifest are referenced in place, never copied.
Static imports remain an inventory, not complete API compatibility: BPL name
casing produces native-export false positives in the generic scanner, and
Windows imports include unimplemented/unknown names such as GetOverlappedResult
and ActivateKeyboardLayout. Invocation of those names was not established.
The scanner's immediate `process.exit(0)` truncated piped JSON at 65,536 bytes;
the incomplete output is retained and a direct file-descriptor capture parsed
successfully before the original launch (`static-import-correction.json`).

One `flock /tmp/wine-build.lock bash tools/build.sh` passed. Actual tested Git
commit was `d7731080d044023b2d6977b6fc2c7119d074b3f6`; the earlier preflight
commit was `3088e2ec61dd8b44c4a56117061aa9ce9627c84e`. All 1,300 relevant source
file identities matched before/at/after execution; relevant tracked binary
diffs are empty. The three source JSON records, binary diffs and 28 indexed
new-file patches per phase preserve relevant pre-existing untracked inputs.
The new investigation-note patch is also retained. No source tree archive was
made. Tested modules are retained:

- Standard: `78a9e8d7563c94b1e002a688c5e65d4269946ab8dd9eb68aa3edf271f4cb1c24`.
- Compat: `5663c49c8620789c681af2133839a886ba5d5ea877c988289c7a0a682bf29b66`.

The original browser command was
`node scratch/runs/20261105-aow2-current-browser-gameplay/browser.cjs --threads`.
It used Chrome 151.0.7922.108, Node v24.18.1, a fresh owned profile, headless
1280×900 and ANGLE/SwiftShader flags. Serving origin was
`http://127.0.0.1:41949`, route
`/index.html?debug&threads&d3d-renderer=webgl`, with COOP/COEP and
`crossOriginIsolated=true`. The actual noncached HTTP 200 browser response
`build/wine-assembly.wasm?v=dev` was retained and hashed to the standard module
above; normal host code compiles those bytes and shares the resulting module
with guest Workers. Worker target URLs and complete browser arguments are
retained. Browser identity is distinct from the requested renderer.

I personally reviewed `initial.png` and `scenario.png`. The former shows the
original 800×600 main menu inside a live canvas rectangle
`left=10, top=186, width=940, height=676`. The visible Scenario button centered
near page `(674,578)` supplied the input geometry; historical coordinates were
not replayed. The one game click has a reviewed-image reference, recorded
geometry/fractions, trusted DOM mouse-down receipt and actual host input logs
for HWND `0x10002`, `WM_LBUTTONDOWN (0x201)` and `WM_LBUTTONUP (0x202)`.
The second capture shows Single/Internet/LAN/Email/Cancel, proving that this
click changed the menu. No Single, Start or army input was sent. There was no
control-wait timeout or input replay.

The first actionable blocker is recorded at **19:30:52.660Z**:
`[guest-worker 0] callExport: Callback wait reservation fences export clear_yield`.
The retained owning-Worker stack identifies `ThreadSendWaits.checkExport`
(`lib/thread-send-waits.js:294`) through `handleMessage`
(`lib/guest-worker.js:1382`). Duplicate console records do not establish two
distinct requests. The stack does not identify the issuing host continuation
or the active reservation token/epoch; several host paths can clear a yield.
Source review identifies `releaseMainMessagePoint` as one candidate, not a
proved caller. Removing the reservation fence would violate the existing
ownership contract and is not a justified repair.

Earlier context is retained without assigning causality: at 19:30:35.699Z
Miles thread 2 exited at EIP 0, previous EIP `0x15cf9e3`
(`mss32.dll+0x209e3`); at 19:30:35.704Z its scheduler logged
`slice failed: Callback owner retired`, followed by two unexpected sliceDone
messages. Thread 1 exited at EIP 0 at 19:30:40.562Z, previous EIP
`0x15b05b6` (`mss32.dll+0x15b6`). These precede the Scenario click and are not
proved causes of the later reservation conflict. No CPU trap was captured.
Optional/local HTTP 404s are preserved in `responses.json`, including native
ole32/olepro32 lookup candidates; they are not established causes either.

Read-only state collection used page objects and retained completed slices,
with no guest export calls, renderer flushes or guest advancement. Main
completed-slice sequence advanced `8806 → 11579 → 14980`; guest execution was
Worker-backed. Initial child threads 1/2/3 occupied slots 1/2/3; threads 1/2
were exited in the Scenario capture. All captured D3D objects were empty and
there were no render endpoints. Consequently **WebGL was requested but actual
WebGL gameplay/draw ownership was not attested**. No terrain/panel gameplay
patches, selected/plotted/arrived captures, changed party position or movement
points exist in this run. Logical gameplay FPS is unknown: no game-update
witness was collected. Audio is unqualified; Chrome's headless arguments
included `--mute-audio` and no audible output was captured.

Focused existing checks passed after closing the original:
`test/test-thread-send-wait-reservation.js` and
`test/test-thread-send-scoped-yields.js`, each in real Worker and local contexts.
They cover fenced clear_yield rejection, ownership, stale epochs, delayed
I/O/render and continuation handling. They validate the guard contract, not
the original's unidentified caller or a gameplay fix. No viewport/vblank or
native army-control qualification was repeated.

The sole browser ran 19:29:04.620Z–19:31:27.234Z. Chrome exited 0 and the driver
wrote its terminal state and `CLOSED ordinary stop`; its enclosing execution
returned 143, whose cause is unknown. Independent cleanup proved both driver
and Chrome absent, serving port 41949 and CDP port 40509 refused, owned profile
absent, four locks free and zero heavy processes. All 1,064 fixture pins still
match; observed free space at cleanup was 7,510,904,832 bytes. No box lifecycle
action occurred, and no runtime was handed off alive.

Next: isolate the clear_yield issuer and reservation token/epoch in a small
source regression. Any repair must preserve scoped callback ownership. Current
browser army movement and terrain/panel rendering remain open; this result
does not authorize another unchanged original run.
