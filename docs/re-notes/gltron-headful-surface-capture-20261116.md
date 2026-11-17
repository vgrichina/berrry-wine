# GLTron private headful surface experiment, 2026-11-16

Evidence: `scratch/runs/20261116-gltron-private-headful-surface-capture/`.

**Private headful presentation did not qualify the full-host capture route.**
The focused native experiment becomes permanent UNKNOWN at the unchanged
3,000 ms observation bound. Browser CopyFromSurface enters only 3,533.453 ms
after capture entry, although renderer drawing and Viz surface activation occur
before the deadline. No original game, consent click or guest input was sent.
The earlier headless/new-surface evidence and every older UNKNOWN endpoint are
unchanged. This is an execution-route negative, not an emulator repair.

## Route and source

Normal local packages `xvfb` and `x11-apps` were installed after refreshing the
package index; the first install could not locate them. Xorg/dummy-driver and
Openbox were already present. Only newly created private Xvfb displays were
used, with MIT-MAGIC-COOKIE authentication, mode-0600 authority files and
`-nolisten tcp`. The final display rejected an actual unauthenticated xdpyinfo
connection. No existing X0 session, laptop, box, public service or other user's
browser was used. Chrome, HTTP/CDP ports and profiles were independently owned.

The test serves immutable Git
`30bb96a5a44b5e67c64b9a65bcc6fdbab49664de` directly from memory and compiles
that commit's WATX closure in memory. The actual module is 2,279,037 bytes,
SHA-256 `83703369cc49c3e16077a4abd43def27262487f83dd52583d1b433adf7095f5f`.
Actual guest/render Worker source and module inventories are retained. Shared
build outputs and foreign source WIP are not used by the experiment. The
canonical build is a separate required repository check.

The continuous native Win32/OpenGL executable is byte-identical to the earlier
authored fixture: SHA-256
`a282fde427480359786e060285a52a0cb94517e2df9ab7a40a9b91bb90e43bbf`.
It retains native message pumping, ChangeDisplaySettings, GL drawing and
SwapBuffers, 1,000-step slices and the normal real clock. No idle/finish,
renderer warmup, publication change, paint suppression or forced application
frame is introduced. The new test derives the fixture/compiler from the
released read-only test; its compiler import-hook restoration also removes
temporary extension hooks absent before compilation.

Chrome is 151.0.7922.108, binary SHA-256
`22e4d5ef0c637a87b59a9baad42625aba3284dc03d4a5908748e253556318c97`.
No headless switch or CDPScreenshotNewSurface switch is used. The ordinary
headful window is sized to the same **1024×757**, scale-1 viewport, without
viewport emulation or clipping. The private X root is 1280×1024. The final
browser launches directly at the full production host, brings that tab forward
and confirms actual visible, focused BODY before launching the fixture.

The launcher explicitly selects ANGLE/SwiftShader, and `/dev/dri` is absent.
The reported Intel renderer string does not establish physical GPU use.
The actual WebGL backend, native current context and draws/transfers are
recorded in `native-v6/actual-gl.json`: 324 device draws, 162 presents/transfers,
zero observed readbacks at the pre-capture inventory. Native GL routed through
WebGL and Chrome's software device must not be described as hardware parity.

## Observed boundary

Final `native-v6` has one native owner (process 1000, HWND 65537), guest endpoint
1, GL render endpoint 1, publication 7 at host inventory, and separate actual
guest/render Worker targets. Object/document tokens and recovered modules are
in the retained owner, host and Worker records. The consent button is normally
visible, enabled and hit-tested in the DOM, at `(351.515625,165,131.875,22)`.
No button is hidden, clicked or exempted from an ownership/visibility check.

An independently bounded, ACK-prearmed perf recorder samples only the owned
browser/renderer/GPU process set. Ten native entry probes observe capture,
old visual request, browser copy, Viz Skia copy, surface result, PNG encode,
renderer draw, Viz draw/swap, swap ACK and surface activation. The executable
segment's 0x1000 virtual/file offset difference is retained in the symbol/probe
records. These are passive probes, not additional GL work or browser commands.
Their possible measurement overhead is not removed by this experiment.

| Native event | Monotonic seconds | Since capture |
| --- | --- | --- |
| PageHandler::CaptureScreenshot | 2876199.916579 | 0 ms |
| Old visual-state call | 2876199.917024 | 0.445 ms |
| Viz swap ACK | 2876202.101174 | 2184.595 ms |
| Renderer DrawLayers | 2876202.102609 | 2186.030 ms |
| Viz Surface::ActivateFrame | 2876202.106349 | 2189.770 ms |
| Viz draw/swap | 2876202.106548 | 2189.969 ms |
| Browser CopyFromSurface | 2876203.450032 | **3533.453 ms** |

The exact full-host request is unchanged:
`Page.captureScreenshot({format:'png',captureBeyondViewport:false})`.
It is sent at **11:36:19.300 UTC** and becomes permanent UNKNOWN at
**11:36:22.304 UTC** (3,004 ms observed timer delivery, configured bound
3,000 ms). No screenshot reply or pixels are adopted. There are zero later CDP
requests, no connection reopening, rebind, replay or input. The late native
copy entry is passive evidence after closure. No Viz Skia-copy/surface-result/
PNG entry is observed through recorder completion; cancellation after UNKNOWN
limits what that absence can establish.

The activation/draw probes are process-scoped and do not identify a particular
surface or fence. They establish that presentation-pipeline work occurred;
they do not prove which frame satisfied the screenshot or identify a scheduler
defect. They cannot turn the previous headless alternative-branch
**1.957 ms browser-copy / 7,075.295 ms further Viz-copy** result into a fix.
That branch was not re-experimented with here.

## Actual full-frame evidence and preparations

XGetImage/xwd captures the **entire private root window**, including Chrome
decorations and the complete host viewport. PNGs are decoded from retained XWD
bytes with ImageMagick, without crop or pixel filtering. All four selected
full images were personally viewed.

* `native-v2/presented-before-capture.png`: older displayed host shell.
* `native-v2/presented-pending-capture.png`: complete host, normal consent
  button, native GL triangle and log. The address bar still has focus.
* `native-v6/presented-before-capture.png`: focused browser with an older
  displayed shell, despite current DOM consent visibility.
* `native-v6/presented-pending-capture.png`: still the older displayed shell,
  sampled 1,003 ms after the capture request, before permanent UNKNOWN.

DOM readiness is therefore not proof that those current pixels have reached
the X display. No stale root frame is substituted for a fresh full-host CDP
image or admitted for input. V2's actual presentation establishes a real
headful output path; it does not repair capture or supply a focused-input
positive. Its capture also becomes permanent UNKNOWN, with only old visual
request entries in the passive trace.

Six bounded native preparations are preserved rather than counted as six
qualified comparisons. V1 compiled the correct module but stopped before any
browser on a temporary compiler extension-hook cleanup bug. V3 and V5 stopped
before capture while sizing the headful window: early outer dimensions were
zero or not yet synchronized with the viewport. The final helper sends only
one resize from valid visible geometry and waits within the same 3-second
preparation bound. V4 had real content focus but its expanded perf recorder
missed the unchanged 3-second enable-ACK bound, so no capture was sent. V6 uses
a reduced event set with inheritance disabled and obtains ACK before capture.
Only V2 and V6 consume screenshot requests. No preparation launches GLTron.

## Checks, shutdown and recovery

The canonical `flock /tmp/wine-build.lock bash tools/build.sh` passed under an
observable 180-second timeout, actual tool wait 0. Its log is closed and its
outputs are released. The native experiment reads none of those outputs.
The focused `--verify-negative` check passes on V6: correct full request,
module/viewport, visible consent, content focus, private-X denial, pipeline
events, permanent closure, zero subsequent requests/input, retained full root
frames and actual browser/display/probe/child/watchdog waits. Fixture byte
equality and JS/Python syntax checks pass. These checks qualify the negative
evidence, not native trusted input.

The 500 ms confirmation, independently prearmed 1,750 ms physical UP, 3,000 ms
observation and 5-second game/30-second menu freshness limits are unchanged.
Actual trusted finite input and owner/focus/occlusion/stale/late/UNKNOWN fault
qualification remain incomplete. No overall fault PASS is claimed.

All six native children and independent deadline watchdogs have actual waits
and both pipe EOFs. All five owned browsers/displays/window managers and three
recorders are joined; recorded profiles, authentication files, display locks,
sockets, loopback ports and 702 sampled exact PIDs/TIDs are absent/closed.
Subreaper-adopted descendant waits are retained. The inventory does not claim
exhaustive coverage before process detachment. All 26 task-created uprobes,
including the separate setup probe, were removed. Host shutdown is distinct
from native guest Quit. `/home` remained above 1.5 GB free.

Git and binary/new-file patches are the source archive. Launch-version patches,
source/module inventories, actual Worker hashes, media pins, phase evidence,
waits, closure audit and selected PNG/XWD files are in the run. No source-tree,
media or Wasm archive is added. All 92 existing game media files were
hash-verified by path without copying or launching them. Older helper/test
code and permanent baseline results remain unchanged.

**Conditional original: NOT_LAUNCHED, zero attempts.** No current full-host
capture/input route is qualified, so there is no cycle identity, turn,
natural-round or ordinary native Quit claim. The 1,200/1,220-second original
guards and 180-second Quit reserve were never consumed. Full-27, FPS, audio,
physical-GPU and parity work remain open. A future investigation must resolve
actual presented-frame/visual-state scheduling at the same bounds before
trusted-input qualification and any separately authorized original.

Box ID null; state NOT_CREATED; expiry null; stop receipt N/A. This single-task
worker publishes its own diagnostic tools/test/note, releases them and stops.
