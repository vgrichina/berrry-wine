# Original Kkrieger input progress: source-only next probe

The verified 900-second capture established level rendering, not directional
response. No emulator input correction is supported. This change prepares a
narrower W hold with independent original-game state observations. It has not
run in a browser or executed the guest.

## Original route and observation semantics

Evidence is the retained 128KB original unpacked image in
`scratch/runs/20261014-kkrieger-loop-condition/unpacked-800000.bin`, SHA256
`42b8f545db0fce60f8f1b22035386c2a6b87653741bbb5ae4a9d24c2b6df76aa`,
and `20261014-kkrieger-mesh-writer/unpacked-disassembly.txt`, SHA256
`8b0026617d971d6c82606d4824cc512346515b84861f775f3b238829563dd0b6`.
These are historical source observations. The page reader requires full SHA256
matches of four relevant code spans before interpreting fresh memory; a mismatch
fails closed. It resolves the game object live and bounds-checks every byte.

Keyboard movement in this code follows ordinary window messages. The main loop
at 0x805392 drains PeekMessage/TranslateMessage/DispatchMessage, then delivers
translated queued events through callback 0x81e8cb. Wndproc 0x803af6 translates
VK codes using 0x821138; keyup ORs 0x80000000. Callback branch 0x81eafa reads
the object pointer at 0x14a0998 and calls 0x81daae. That handler masks the event
with 0x8001ffff and stores it at object+0x1553c. W/w reaches 0x81dc8a, copying
the float at +0x153b8 into +0x15358; W/w keyup reaches 0x81dd35 and clears
+0x15358. A/D use +0x1535c. These are guest movement-input fields, not player
position. There is no need to assume GetAsyncKeyState or DirectInput keyboard
polling for this identified route.

The callback's update path calls 0x81dd4c at 0x81eae6 with a tick-count argument.
After nonzero checks of object+0x14960 and +0x14a18, 0x81dd74 adds that argument
to object+0x15540. It then selects a path using byte +0x14fe9; zero reaches the
gameplay update at 0x81ddac. Later code reads the forward/strafe fields, including
0x81dfb6 and 0x81dfcb. The counter increments **before** the phase branch and
movement calculations: observing it proves entry/progress into this update
routine, not completion of simulation, displacement, or one logical frame.
The stop condition therefore also requires phase zero, a positive forward speed,
the matching guest forward field, physical W held, and matching nonnull guest
focus/main HWND. Two separately sampled counter changes must follow the first
accepted state. Samples cannot establish continuous state between observations.

The host's `renderer-input.js` updates physical state in handleKeyDown/Up and
dequeues window messages separately in takeInput. A DOM/CDP key event alone is
insufficient. This reader inspects physical state without calling consuming
GetAsyncKeyState, and separately inspects the guest's accepted input field.
No trace hook, forced callback, guest write, synthetic frame success, or extra
guest API call is installed. Presentation callbacks are not its progress source.

## Bounded next run

Use the existing `tools/kkrieger-gameplay-capture.js` with its exact source/module
pins, fresh exclusive output directory, runtime-owner grant, and additionally
`WA_INPUT_PROGRESS=1`. Keep canonical contained-file, actual HTTP, fresh-page
digest and no-fallback guards. The controller's original absolute 900-second
deadline includes everything and is unchanged. The same current-run visual menu
and level confirmations remain necessary; Enter is still ordinary five-second
input. No automatic level classification is added.

After level confirmation, the option requires 160 seconds available before the
existing 30-second shutdown reserve. Late confirmation stops without squeezing
in a shorter test or extending the owner. The sequence is:

1. Verify original code, capture a 20-second idle series and before/after images.
2. Hold ordinary W until two accepted-state update-counter changes, with a
   ten-second minimum; stop polling after 60 seconds even without progress.
3. On accepted progress, capture the held image; always release W in `finally`.
   On timeout, release immediately without an extra held screenshot. CDP calls
   retain the owner's five-second protocol timeout; the 60 seconds bounds the
   polling loop, not an independently preemptible guest instruction.
4. Observe release for at most 60 seconds and capture the final image. Persist
   `acceptedProgress`, `holdOutcome`, `releaseObserved`, and `releaseOutcome`;
   both no-progress and uncleared-release timeouts are explicit. Capture sequence
   completion means only that collection finished. `gameplayVerified` stays false.

Review the original landmarks in idle/held/released images. If the guest accepts
W and advances but there is no directional change, investigate movement/collision
or rendering with that evidence; do not call it a browser key-delivery bug. If
physical W is true but the guest field never changes, the next diagnostic is the
already identified message/queue path. If the field changes but the update
counter does not advance, the observation is stalled update progress, not missing
key delivery. A fresh trace would require its own bounded plan; none is enabled.

## Relative mouse follow-up, deliberately separate

Original helper 0x801bae calls IAT slot 0x81f09c with a POINT-shaped output,
accumulates x-400/y-300 into globals 0x83f8dc/0x83f8d8, then calls slot
0x81f0a0 with (400,300). This is the cursor-read/recenter pattern consistent with
GetCursorPos/SetCursorPos; resolve the fresh IAT thunks before claiming API names.
The update at 0x81ddde invokes that helper; 0x81ddf3/0x81de11 compute differences
from the previous sample and update orientation fields +0x1495c/+0x14958. A
1000ms interval gate at 0x81dde3 can skip orientation changes, another reason
that one absolute movement and a late screenshot cannot establish relative input.

`lib/browser-input.js` takes real movementX/Y through handleRelativeMouseMove
only when the canvas owns pointer lock. The existing trusted canvas mousedown
requests capture if exclusive presentation and registry/runtime relative-input
signals allow it. The Kkrieger registry has no explicit relativeMouse setting.
Capture-transition deltas are intentionally suppressed until button release.
A later separately bounded look test should inspect those gates, use one ordinary
trusted click and release, confirm pointerlockchange and the canvas lock owner,
then send ordinary pointer motion and record actual movementX/Y plus original
cursor/orientation observations. A click may fire; document that action. If lock
is not granted, record failure and stop that subtest. Do not force pointer lock,
alter the registry, inject renderer deltas, or treat absolute motion as relative
delivery. This prepared W-only mode does not attempt mouse capture or combat.

## Validation

`WA_KKRIEGER_UNPACKED=/home/user/wine-assembly/scratch/runs/20261014-kkrieger-loop-condition/unpacked-800000.bin node --test test/test-kkrieger-input-progress.js`
passes five tests, with no skips: held progress and minimum duration, negative
host/phase/focus cases, all four code hashes against the complete pinned original
image, counter/object discontinuity, and actual capture-function execution with
a fake clock/page proving 60-second no-progress/release timeouts remain failures.
The fake-page test does not execute browser input or x86. Both changed scripts
pass Node syntax checks and `git diff --check`. No full VM, build, browser, Boat,
runtime, deployment or serving-checkout changes were made.
