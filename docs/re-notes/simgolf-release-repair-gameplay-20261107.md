# SimGolf: independent release repaired; fresh hole opened

Run `scratch/runs/20261107-simgolf-release-repair-gameplay/` (R) repairs the
known harness prerequisite and completes ordinary architect progress on the
unchanged original demo. Personally reviewed full-page before/after captures
show a fresh **Dolphin Coast MC**, a constructed tee and green, and the native
banner **Hole #1, a scenic 127 yard par 3, is now open for play**.
`review/generation.png`, `review/green-placed.png`, `review/hole-opened.png`
and `review/final-course.png` retain the visible evidence. This is an opened
hole, not a completed player round or a score claim.

## Harness repair and qualification

The predecessor's exact `tools/web-input-probe.js` click body awaits DOWN
before scheduling its hold and UP. R's `release-controls.cjs` executes that
body and reproduces the missing release with a pending acknowledgement.
R's reusable `input.cjs` provides mouse/key transport through `pulse` and
ordinary key descriptors. It arms release **before invoking DOWN**, bounds
DOWN and UP acknowledgement waits separately, and releases at the earlier
of the requested hold and immutable browser deadline. Rejected or pending
acknowledgements produce UNKNOWN and close admission; neither event is
retried. Receipt write failures after arming cannot prevent release.
The approach reuses the actual Chromium controls from the Aranna release
run; no Aranna-owned file was edited.

`release-controls.json` records fourteen actual trusted Chromium mouse/key
controls: normal, delayed/rejected/pending DOWN, deadline release, and
rejected/pending UP. `qualified-production/production-native-release-controls.json`
repeats all fourteen through the final staged driver's actual CDP connection
with production guest/render Workers. Delayed DOWN completes after UP;
pending/rejected cases still deliver exactly one matching trusted release.
UNKNOWN cases are isolated fault controls, never replayed gameplay commands.

Before allocation, the same `browser.cjs`, capture/review admission,
`transport.cjs` numbered exact-ID ACK queue and native input path were exercised
locally. The generated fixture uses the production guest Worker, physical
process render Worker and GL bitmap adapter. A cyan bitmap oracle reaches
GDI storage and the personally inspected full-page capture. Tests reject
stale captures, every changed owner identity field, an actual replaced fixture
process object and a wrong executing module, with zero negative-case input
effects. Missing/rejected/wrong-ID ACK controls close admission without replay.
Reviewed click and H-key commands receive exact ACKs and balanced releases.
The final local browser exits normally with no held inputs or private profile.
`preallocation-qualification.json` records this gate; the driver fixes its
deadline once and refuses a launch window of thirty minutes or longer.

`flock /tmp/wine-build.lock bash tools/build.sh` passes. Both rebuilt modules
are byte-identical to those qualified before allocation. There is no proven
emulator mismatch or production emulator change in this task.

## Current rendering and ordinary construction

One UUID-idempotent fresh box ran one original-demo browser, using the current
main runtime and production guest Workers. All **1,763 original files /
65,166,518 bytes** match the recorded SHA-256 census. No guest code, media,
configuration, clock, memory, skills or camera was edited. No CSE was imported
and the empty AS1 alias was not mounted. Startup generated the fresh career
through its normal route.

Both executing guest and render Worker module bytes, recovered with the
debugger, hash to
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
The reproducible source baseline is `fc1b3bfa0a1eb88583ed7d7a13b3a944b1fb854f`
plus R's relevant tracked patch and ignored-driver patches. `runtime-pins.json`
pins 2,212 staged files. Actual Chrome is 151.0.7922.108, V8 15.1.206.16.

Owner-side passive observation records GL context 1, **hwnd 0**, bitmap
**0x410008**, `software=false`, WebGL 1, **800×600**. The actual provider is
`ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)`.
The page's native 800×600 window has no window GPU layer; GDI composes the
bitmap into the visible course. The full-page captures show grass, river,
trees, people, interface and construction. The bitmap target and measured
provider, rather than the URL, window-layer absence or a frame counter,
establish the rendering route. There is no FPS, audio or parity claim.

Fresh screenshot review precedes each gameplay input within the two-minute
freshness bound, binding exact process, Worker target/instance/module,
renderer endpoint/epoch and canvas identity. After the welcome dialog,
ordinary Build Course → Tee → grass → Green → grass constructs hole 1.
The balance changes 120,000 → 119,500 → 118,500. Native H opens it, with the
explicit playable-hole banner retained. The native retirement dialog was
inspected and declined; it offers saving Gary for championship play, not a
career checkpoint.

The native Save Course button reports **Dolphin Coast Municipal saved for
championship play** (`review/native-options.png`). Its new **86,831-byte CSE**
is preserved at `native/after-native-export-save-5.bin`, SHA-256
`beac714ef16e3574a517c272e5d99b495b1b9eec0f4a4b4e726f121b1eb74cca`,
native path `c:\themes\championship\dolphin coast mc.cse`.
It is a course export, **not a resumable career save**. No nonempty `.sve`
was observed; the original empty marker remains empty. An initial read-only
retrieval attempted an async original-file getter and was rejected; the
corrected extractor inspects resident data descriptors without materializing
original providers. No native input was repeated because of this retrieval
error. The exported bytes were SHA-verified locally before browser closure.

## Recovery and custody

All 17 original-run commands have exact ACKs, with no UNKNOWN gameplay input
or replay. Normal browser closure exits 0. Fourteen recorded PIDs are absent,
both ports are closed, and the private profile, writer lock and held input
are absent. All **196 terminal files / 9,864,304 bytes** were retrieved and
SHA-verified **before** the explicitly delegated normal, nonforced box stop.
Box `bx_bevw9s9b` was created at 11:16:45Z; the immutable browser deadline was
11:45:45Z and the original box expiry 11:56:45Z. Final archived state and stop
operation are recorded in R. No old box was resumed.

`source-recovery.json` records Git SHA, relevant binary diff and new-file
patches for every ignored driver dependency. Original media is referenced by
path/hash, never copied into evidence; executing modules and unique outputs
are retained individually. There are no source or media archives.

The requested visible construction and current bitmap rendering are verified.
The remaining save limitation is native career persistence: this run retains
the championship export and makes no career reload claim. A future career
continuation needs an ordinary native career-save route; importing this CSE
would again select championship play rather than recover editing.
