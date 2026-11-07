# Dungeon Keeper driver anchor conversion, 7 November 2026

The demonstrated fractional-anchor blocker is corrected in the retained native
CDP driver. Its bookkeeping now records the trusted **MouseEvent** client
coordinates, retaining the submitted CDP doubles separately as `sentX/sentY`.
The continuous helper, production input bridge, automatic capture selection,
identity checks, freshness, numbered ACKs and terminal UNKNOWN behavior are
unchanged. This qualifies the local input path; Dungeon Keeper steering itself
still requires a separately authorized original run.

Evidence: `scratch/runs/20261107-dungeon-keeper-anchor-conversion/`.
No original, remote box, allocation or lifecycle operation occurred. Box
ID/state/expiry are not applicable.

## Measured conversion and change

The retained `next-anchor-diagnostic.cjs` from the capture-gesture investigation
reproduced the pre-motion refusal with zero effects: driver `(352,246.8)` versus
trusted MouseEvent `(352,246)`. The equality gate was correct.

One small real Chromium HTML fixture (`conversion.cjs`) records both trusted
PointerEvents and MouseEvents from ordinary CDP motion. Chrome
151.0.7922.108 / V8 15.1.206.16 converts submitted doubles to float positions;
PointerEvent client coordinates preserve that float, whereas MouseEvent client
coordinates floor it. Examples from `conversion.json`:

| CDP input | PointerEvent client | MouseEvent client |
| --- | --- | --- |
| 352, 246.8 | 352, 246.8000030517578 | 352, 246 |
| 352.9, 246.1 | 352.8999938964844, 246.10000610351562 | 352, 246 |
| 351.999999, 246.999999 | 352, 247 | 352, 247 |
| -0.9, -0.1 | -0.8999999761581421, -0.10000000149011612 | -1, -1 |

The near-integer case distinguishes `floor(fround(value))` from flooring the
original double. Deeper negative positions outside the viewport produced no
document motion event; the fixture does not infer trusted coordinates there.
The same fixture checks a canvas at CSS `(32.5,194)`, CSS size `640x240`, backing
size `320x480`. DOM coordinate conversion precedes canvas offset and scaling;
guest mapping is a separate floor operation. This fixture was run during
discovery and again with assertions against the correction. The original
remote predecessor used Chrome 151.0.7922.71, not this local patch version.

`tools/dungeon-keeper-driver-pointer.cjs` implements only this measured
bookkeeping. The retained
`scratch/runs/20261107-dungeon-keeper-unlocked-native/browser.cjs` now invokes
`record(pointer,method,params)` in its existing send path instead of assigning
the doubles directly to `pointer.x/y`. Submitted event parameters are unchanged.
This records each attempted event as before; an unknown dispatch still closes
the lane. No anchor is read back and adopted, reset, or substituted after a
mismatch. Locked physical continuity and unlocked exact equality remain in
the unchanged helper. The conversion is scoped to this Chromium MouseEvent
driver, not a general PointerEvent or guest-coordinate conversion.

## Regression and actual production qualification

`regression-before.cjs` runs the new regression using the previous driver's
double assignment. It exits 1 at the expected `246.8 !== 246` assertion
(`fail-before.log`). The corrected regression passes. It covers positive and
negative fractions, float precision at an integer boundary, unchanged submitted
parameters, six repeated one-pixel steps across two commands, wrong-anchor
zero effects with sticky closure, every one of the 22 identity equality fields,
missing identity fields, and actual-lock versus automatic-unlocked capture
admission. Existing native-motion tests also pass.

One local actual-production `dx_ddex4` guest and its owning page Canvas2D
renderer qualified the corrected driver and unchanged continuous helper.
`prepare-local.cjs` derives the bounded local driver from the retained driver,
using existing input/transport/readiness controls. It selects only this local
registered fixture and preserves production automatic profile selection.
I personally viewed `local/startup.png`, `anchor.png` and `motion-one.png`:
three red sprites over a blue checkerboard. No Dungeon Keeper scene is claimed.

The canvas rect was `(10,194,684,480)` with `640x480` backing. The ordinary
normalized `(0.5,0.11)` gesture submitted `(352,246.8)`. Trusted MOVE/DOWN/UP
reported `(352,246)`; normal consumer events reached HWND 65537 at `(320,52)`.
Two commands then sent four `(1,0)` CSS steps apiece, with a fresh personally
reviewed owner capture between commands. All eight trusted events had
`movementX=1`, `movementY=0`, buttons zero, client X 353 through 360 and Y 246.
Consumed MOVE X values were `320,321,322,323,324,325,326,327`, Y 52. The first
one-pixel CSS step remains within the same guest pixel because of scaling.

The automatic selection was false, no explicit profile was present and no
lock was held. When capture intent is true the unchanged helper still requires
lock; only automatic false intent qualifies unlocked motion. Actual chain
admission reread the complete page/guest owner/module/window/document identity,
including recovered executing module bytes. Negative controls used isolated
lanes: stale scene and wrong window identity refused with zero effects;
wrong numbered ACK and unknown motion closed admission without replay.
The trusted independent UP was armed before DOWN and acknowledged at
15:20:56.926Z, before the deliberately delayed DOWN acknowledgement at
15:20:57.025Z. Exact successful command ACKs were numbered 0 through 3.
All controls passed; no held retry or private input handler was used.

Verification commands:

```sh
node test/test-dungeon-keeper-driver-pointer.js
node test/test-dungeon-keeper-native-motion.js
node scratch/runs/20261107-dungeon-keeper-anchor-conversion/conversion.cjs
node scratch/runs/20261107-dungeon-keeper-anchor-conversion/validate.cjs
flock /tmp/wine-build.lock bash tools/build.sh
```

The locked build passed. The global evidence checker continues to report
unrelated Alice/Tunnel-Twist containment errors and historical missing files;
this investigation has no candidate-manifest registration and is documented
here. Local assertions and custody checks passed.

## Recovery, custody and next action

`source.json` records the exact source commit, relevant tracked/new binary
patches, tested driver recovery and existing media references. The retained
executing page/guest module is
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`;
the locked rebuild has the same hash. All 647 runtime pins matched after the
run. Git and the recorded patches supply source recovery; no source tree or
media archive was made.

Both fixture browsers closed. The production browser exited zero; its driver
and Chrome PIDs 2311285/2311292 are absent, ports 37933/41189 are closed,
profile/writer lock are absent, final buttons are zero and input queue is
empty. Closing the page destroyed its observers. The conversion browser exited
zero and its profile was removed. The owned messageboard watcher was closed.
Sampled free disk remained above 2 GB.

Next, use the corrected retained driver for a separately authorized fresh
Dungeon Keeper original. Include the new pointer module in staging pins, and
recompute pin lengths/hashes for the changed browser and dependency. Preserve
the predecessor's ordinary capture gesture and reviewed-capture admission;
observe the live automatic capture decision. Require actual lock whenever
intent is true. Qualify useful consumed motion before selecting Start New
Game or claiming Eversmile, dig or build. Never resume or replay the predecessor's
closed UNKNOWN lane. This fixture proves none of those game checkpoints.
