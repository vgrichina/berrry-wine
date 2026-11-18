# NFS3 ordinary browser driving and Pause/Continue, 2026-11-18

Ordinary production-browser input raised the original Corvette from 2 to 15 MPH,
advanced the road view, opened the original pause menu, and resumed the cockpit
with its clock advancing. Steering changed the wheel, but the separately reviewed
captures allowed the car to coast to zero: they do not isolate a causal road/yaw
effect. Ordinary Quit reached the original System confirmation; native process
exit was not observed within the predeclared 15-second terminal window. This is
partial control evidence, not completed driving/steering/Quit acceptance.

Evidence: `scratch/runs/20261118-nfs3-current-browser-driving-pause/result.json`.
All screenshots are named whole private-display XGetImage captures, without crops
or replacement pixels. No full-27, parity, FPS, or audio claim follows.

## Actual runtime and route

The first original used immutable published Git
`ac2e2b69ae1428dac7610c736a9607730ee4db1b`; the affected second original used
published helper commit `95df0faa906cba19b7987d1417a38f061e63bade`.
Their src/lib/host/index bytes are equal. Both used the same retained compiled
module, 2,413,749 bytes, SHA256
`a6e2bb71152d588f71e9059f9df3105349e1fd64811a81de0bb5aeeaa18d2f42`.
Debugger-extracted guest/render Worker bytecode, live endpoint, primary window,
canvas, and bridge generation were checked. Prepared manifests retain exact
source hashes. Foreign working-tree overlays were excluded from the served
immutable runtime and preserved.

Launch was the supported registered `nfs3_demo` production Worker route with
unchanged 135 media, all rehashed. Its unchanged registered startup registry chose
**Glide/WebGL**. This is not fresh Direct3D DIM acceptance of the earlier
cf7044e37/1fe5e1baf repairs. The original game automatically reached its race;
no game, INI, registry, or state was authored. The first original showed rainy Hot
Pursuit, the second dry Single Race, reflecting their actual unmodified starts.

## Concrete helper repair and validation

The first original's throttle worked, then the old harness armed its independent
UP child before checking the full live owner twice. Those checks exhausted the
1,750ms physical release window and the left DOWN was refused before delivery.
The helper now validates the owner **before** arming that short clock, checks
remaining hold capacity, and always waits for independent release after DOWN.
It introduces no guest poll, wake, focus, clock, handler ACK, or runtime write.

Focused old-order-fail/new-order-pass tests, the existing browser controller
loopback and NFS control-observer tests passed. The required locked full build
passed before the explicit helper/test commit `95df0faa9`, followed immediately
by strict pull/push (both zero). Calibration4 and calibration5 exercised the
changed helper through trusted ordinary browser Enter, visibly changing the
native fixture blue to red. Calibration4's later Escape was refused on the
separate 1-second release-child startup bound; a 5-second startup bound was
declared before fresh calibration5 and original2. Calibration5 did not establish
native exit with its immediate terminal assertion. Calibration3 independently
established the earlier capture/release route and fixture ExitProcess(0).

Original2 predeclared capture 3s (measured whole capture/encode 282–507ms), review
90s, transport 3s, child startup 5s, fallback UP 1,750ms, holds at most 1,200ms,
runtime 900s, Quit reserve 180s, terminal observation 15s and enclosing cleanup
20s. No in-flight deadline extension or closed-scope replay occurred.

## Original2 observed consequences

* `cockpit-ready.png` → `after-throttle-one.png`: 2 MPH/0.9 RPM at 0:09.90
  becomes 15 MPH/1.7 RPM at 0:24.82 after ordinary Up held 1,200ms; the chalet
  and road approach. A second pulse reached 12 MPH. This exceeds autonomous creep.
* `after-steer-left.png` and `after-moving-left.png`: ordinary Left held 700ms
  changed the cockpit wheel. By each later capture speed was zero. Different road
  views do not by themselves isolate the steering contribution.
* `pause-held-result.png`: Escape held 1,200ms opened “Single Race - Paused”.
  The earlier 120ms attempt did not. The rotating pause camera is not race motion.
* The ordinary Continue mouse click did not visibly activate the button.
  `continue-escape-result.png` shows the restored cockpit after Escape 1,200ms;
  `continued-clock.png` shows its race timer at **3:04.71**, proving continued
  clock progress. One later gesture's review prose incorrectly transcribed that
  value as 3:06.96; the retained image is authoritative.
* ArrowRight navigation visibly highlighted Continue, Restart, then Quit in
  `after-quit-navigation.png`, `quit-selection-two.png`, `quit-selected.png`.
  Enter opened `after-activate-quit.png`, the original “Quit to” dialog. Up
  highlighted System in `system-selected.png`; Enter was delivered with
  independently released UP. The fixed 15-second observation still reported
  `running:true`, `processExited:false`, process exit code 259. Its assertion
  closed the scope. No subsequent endpoint or replay was attempted.

Trusted DOM edges and independent UP child waits are retained per gesture.
Available host check_input logs show Up/Left/Escape messages actually dequeued;
the passive native API observer collected zero handler records, so no custom
per-action native consumption ACK or complete DirectInput proof is claimed.

## Remaining blocker and cleanup limits

Next bounded work is the original System-Quit transition and a steering hold
while throttle is maintained, with a preplanned capture short enough to avoid
coasting between controls. Do not infer a runtime crash or an exact Quit failure
cause from a 15-second non-exit alone. No runtime input/render code was changed.

All seven browser/display scopes have actual browser, Xvfb, Openbox and native
supervisor waits; all native supervisor receipts report no leaks. Original2's
outer tool session was actually reaped with status 143, but its enclosing launch
script did not retain its pipe-EOF wait receipt. The board watcher was also
actually reaped 143. Consequently enclosing-launcher EOF and complete cleanup
attestation are unavailable for that scope; process absence is not substituted
for a wait. Earlier six enclosing-launcher receipts exist. No test box was
created: ID/state/expiry/stop receipt = null/NOT_CREATED/null/null.

Git is the source archive. The run retains the unique tested module, exact Git
and relevant binary/source diffs, owned new-file patches and recovery recipe;
no source snapshot, media copy or continuous frame series was made.
