# Quake III browser current-display and queued input, 2026-11-14

The ONE registered original is closed with a startup partial. A startup
`Runtime.evaluate` exceeded the fixed three-second transport bound and became
UNKNOWN before a personally reviewable menu or host-consent scene. No original
capture ticket, game input, visible opponent, frag, score increase, persistent
result or native Quit was established. No restart, rebind or extension occurred.
The earlier native Major run and released Quake II helper remain read-only.

Code commit `dd42351da84be1e99602e36df4b6ca9f02ae9899` was tested and published
on main before this original. Evidence is in ignored
`scratch/runs/20261114-quake3-browser-current-frag/`, with final `result.json`.
Git SHA plus relevant binary patches preserve source; media and compiled modules
are referenced by path, served size and SHA-256, without copies or source archives.

## What the paint-gate investigation established

Production `lib/renderer-input.js` queues ordinary keys for the owning guest
Worker. Modal Enter and tracked-menu Escape can synchronously enter native
handlers. The derivative therefore separates capture readiness from narrowly
qualified ordinary key and client Mouse1 readiness; it does not remove the
capture paint guard or qualify arbitrary mouse/modal/focus paths.

The metadata-only input gate retains exact process/window/Worker/module identity,
visibility, nonce, scene age and independent UP checks. It excludes native modal,
menu, child-control, drag, nonclient and foreign-capture paths. It reads no
Guest-backed display surface. Passive readiness expires inside the original
intent deadline, with zero DOWN/prearm/ticket on expiry; it creates no renewed
intent or observation timestamp. After input or ticket creation, failure and
UNKNOWN remain terminal. Capture has one original three-second transaction,
including any passive readiness at any phase before requesting its single ticket.
Complete tickets retain their immutable pixels and actual timestamps across
later Worker painting; pending, failed, cancelled and UNKNOWN tickets are never
replayed.

Final production Chrome control `chrome-full13/report.json` passed with a small
synthetic native PE, the actual compiled interpreter, production DOM input bridge
and GuestRPC in a real Worker. The earlier 5bec-style gate refused held paint;
the candidate admitted ordinary queued keys without synchronous Guest entry.
Trusted ArrowDown DOWN/UP reached native MSG 256/257 (VK40), and trusted Mouse1
DOWN/UP reached MSG 513/514 while the real WebGL Worker painting hold remained
active. There was no forced paint release. Native consumption was observed in
the synthetic fixture only, never by reading the game's private world. The mouse
fixture's synthetic exclusive getter and registered-relative-mouse setting are
explicitly recorded; its trusted click acquired actual pointer lock. This is a
route qualification, not Quake III gameplay evidence.

The retained complete ticket's pixels, copy isolation, publication/display and
readback timestamps remained identical during later held paint. Negative controls
covered owner replacement, stale scenes, nonces, passive expiry, late ACK,
UNKNOWN/no replay, visibility and overlays, native modal/menu/control routes,
independent key/mouse release and parent death. The selected result PNG is
`result-qualified-queued-native-control.png`: synthetic control output only.
There is no original-game screenshot.

The registered attack binding is Mouse1; Enter uses an item, and Tab opens the
native score UI. The controller supports personally reviewed finite Mouse1 with
independent mouse UP and the ordinary Quit confirmation paths. The original
qualification guard checks the frozen Chrome certificate and exact helper,
test and compiled-module hashes before launch. No game renderer/provider,
clock, AI, seed, configuration or registered runtime defaults were changed.

## Validation and ONE original

Focused tests and post-Quit focused checks passed. Twenty renderer/capture tests
passed. Real Chrome release controls passed for finite keys and mouse, scheduled
and parent-EOF releases, UNKNOWN and identity failures. The required
`flock /tmp/wine-build.lock bash tools/build.sh` passed in 46.207 seconds.
The final combined Chrome control passed before explicit-path publication.
Earlier diagnostic control failures are retained honestly in compact logs.

JezzBall and Tutstomb actual native/watchdog/supervisor waits, both EOF, heavy
release and absent PIDs were verified before heavy work. Ancillary wrapper
UNKNOWN remained separate. The original launched at 2026-11-15 00:17:16 UTC with
an immutable 1800-second deadline, independent watchdog and 180-second Quit
reserve. It failed at about 00:17:52, and teardown completed about 00:17:57.
No host-consent click or game DOWN was sent. Public console output mentioned
creation of the Quake 3 window, but this is not a reviewed display or established
exact original owner binding. The blocking evaluate expression and underlying
cause are not established; the transport was not reopened to investigate.

Actual controller PID 6226 exited 1; Chrome 6280, watchdog 6225, supervisor 6223
and outer waiter 6222 exited 0. All applicable stdout/stderr EOF and actual waits
are recorded. The supervisor reports heavyReleased. All those PIDs are absent,
HTTP is closed and the Chrome profile is gone. Host teardown is distinct from
native Quit, which is false. The runtime slot was released for Tetravex16.

## Pins, closure limitation and next work

All 1004 prelaunch pinned paths, including 307 registered media/control files,
retained their sizes and hashes after the original. Registered args and modern
control files and cooperative runSlice 10000 remained unchanged. The module was
`build/wine-assembly.wasm`, 2201160 bytes, SHA-256
`c5d48cf634f3dcd14453f82be512f879459d305d92c2d3ffb6cc0d8c603fb398`.
HTTP recorded 679 successful responses across 547 distinct URLs. Their sizes and
hashes matched the frozen pins except one known-autoimport closure omission:
`test/binaries/tlbs/stdole2.tlb` was served at 15088 bytes with SHA-256
`db456130e4b131aff27a6a3179464a28c9452f06eb6f2081d2aea38128d31895` but
was not prelaunch-pinned. Its served hash is evidence, not proof of before/after
identity. Full prelaunch served closure is therefore not claimed.

A future separately authorized task must diagnose startup evaluate UNKNOWN and
include the type-library closure before any fresh original. This task stops here;
the spent original remains closed. No box was created (ID/expiry null,
state NOT_CREATED, stop receipt not applicable); /home stayed above 1.5 GB free.
No workers were spawned and no public deployment occurred.
