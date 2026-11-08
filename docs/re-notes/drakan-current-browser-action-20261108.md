# Drakan current-browser control attempt, November 8

Player movement, flight, turning and attack consequence remain **unverified**.
The original registered demo reached its native beta warning, but the driver
required a graphics producer before admitting the warning's OK input. At that
point the guest had created no render endpoint or renderer Worker. The unbound
readiness loop therefore exhausted its twelve observations without opening the
input queue. This is an observed driver bootstrap/admission gap, not evidence
of a Direct3D rendering or game-input regression.

Evidence: `scratch/runs/20261108-drakan-current-browser-action/`. The personally
reviewed `retrieved/software/unbound-startup.png` shows “Drakan Beta Demo
Warning” and its OK button. It is a diagnostic image, never an input-admission
reference. At 03:42:25.626 UTC the matching state records `drakan_demo`, PID
1000, running guest Worker endpoint 1 / slot 0, focus HWND 65539, empty
`d3dStats`, no render endpoints, no owning renderer/context and no input events.
The twelve subsequent page observations retain that absence; readiness fails
at 03:42:31.676 UTC. No commands or ACKs exist. No beta OK, menu selection,
level, movement or attack was attempted. The WebGL arm was not launched.

The production URL selected **both** `gl-renderer=software` and
`d3d-renderer=software`, with Threads enabled. These selectors do not prove an
actual software D3DIM draw: no graphics backend was instantiated. The staged
D3DIM-specific producer projection was never reached because the existing
prebinding no-endpoint guard returned pending first. Its positive behavior is
unqualified and must not be treated as a passing D3DIM readiness helper.
There was no CDP timeout or ambiguous guest-input delivery; the terminal
failure was the explicit readiness exhaustion. The driver closed and did not
replay or start another arm.

Before allocation, one focused generated setup used trusted native Chromium
T/G key events, the production DOM/Win98Renderer input bridge, production
GuestWorkerLink/RPC, the current full module and generated x86 calls to public
`GetAsyncKeyState`. Both 400 ms holds produced high-bit samples wholly inside
the hold and zero high bits after release. Four trusted DOWN/UP events were
balanced. The existing independent release timer was reused, adding only T/G
VK and DOM-code mappings to the held-key helper. This proves that keyboard
path only; it does not prove Drakan DirectInput polling, relative mouse,
mouse-button delivery, flight or attack. The local screenshot shows the host
desktop/readme, not gameplay. No unrelated suites or emulator changes were made.

All 64 existing fixture files were freshly SHA-256 hashed; all 62 manifest
entries match their recorded sizes. No retained per-file historical game
digests were located in the available October 7 handoff or cited run paths
(the cited historical run directories are absent here). Historical hash
equality is therefore explicitly unknown. Current file hashes, paths and
sizes are retained in `media-preflight.json`; resource bytes, working
directory and the registered `startupRegistry` were not changed. The original
readme COMMANDS and October 7 `a1710870` acceptance were read. That acceptance
establishes rainy-level rendering in both thread modes, not player action.

The tested source is `e450426c216fbf13d3a711e26d486160241dd17e`, with an empty
tracked runtime diff and a retained patch for the relevant untracked
`lib/wininit-boot.js`. All run helper inputs also have new-file patches.
Recovered actual guest module SHA-256 is
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`
(2,182,500 bytes). Chrome is 151.0.7922.108 / V8 15.1.206.16. The 677 staged
pins were unchanged at terminal audit; 160 complete HTTP responses matched
their staged digests, including the original executable and media manifest.
No renderer module/context proof exists because no renderer Worker existed.
Both retained PNGs passed CRC/decode checks. No source/media archives were made.

All 31 remote artifact references (30 unique digests) were retrieved and
independently reread/size/SHA-256 verified at 03:42:51.772 UTC before normal
stop. Chrome exited 0 at 03:42:32.043 UTC; driver PID 6327 and Chrome PID 6339
were absent, HTTP/CDP ports 35595/34607 closed, and profile/writer lock absent.
The independently prearmed 25-minute watchdog and normal-stop child both
exited 0, with an empty supervisor. Box `bx_2gqa2txn` is **archived**, stopped
03:42:56.036 UTC, expiry cleared (initial expiry 04:06:22.163 UTC). Stop
`stop_af6b78f0f57dd2e1` completed at 03:42:56.055 UTC, `forced:false`.
Local and remote disk checks stayed above 5 GB. No resume, delete, old-box
reuse, RAM gate, public deployment or nested worker occurred.

Next: qualify a separate native-dialog bootstrap against its actual owning
guest/module and presented GDI dialog, allowing reviewed beta OK before a
graphics endpoint exists. Then require actual D3DIM producer/presentation and
transport readiness before the first graphics binding and menu/gameplay input.
Keep exact postbinding ownership, module, freshness, independent-release and
UNKNOWN closure controls. A fresh original run must still establish visible
terrain-relative movement/heading and a reviewed outgoing attack consequence
on each viable backend. FPS, audio, parity and full-game support remain separate.
