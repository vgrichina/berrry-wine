# TIM positively unsent review recovery, 2026-11-15

Evidence: `scratch/runs/20261115-tim-unsent-review-puzzle2/`.
The previous original in `20261115-tim-smart-handle-puzzle2` remains closed
UNKNOWN. Its five delivered menu operations reached untouched Puzzle 1; its
first construction drag was refused at review age 6.304 seconds before any
command write. This task neither reopens nor reclassifies that run.

The old published policy was reproduced from Git in a disposable policy-only
fixture: exactly 6.304 seconds yields `current scene expired`, permanent
UNKNOWN, zero command records and zero consumed records. This is a controller
classification problem, not evidence of a native engine defect.

The implemented recovery is limited to a native-attested REVIEWING capture with
no held input and no delivery, atomically refused before a command is written.
A refusal burns that capture and contains no action or coordinates. Native
confirmation and a new complete capture precede a new review, intent and nonce.
No action is automatically retried. Five-second gameplay and thirty-second
menu limits remain fixed. Any command write, hover, queue, DOWN, uncertain ACK,
transport failure or conflicting decision remains terminal UNKNOWN.

The atomic frame decision either refuses before command write or permanently
claims an input nonce. A refusal receipt contains no gesture or coordinates.
Native code verifies its current untouched review token before acknowledging
zero send and publishing a fresh complete capture. A new intent identifier and
personal review are required; the refused frame cannot be used again. Expiry
after command write remains UNKNOWN, even if it produces zero native callbacks.
UNKNOWN permits no new cleanup input; only an already armed independent UP may
release a held operation. The bound is strictly below 1500 ms for chosen holds,
with the independent UP deadline capped at 1750 ms.

Twenty-six policy checks and thirteen actual 16-bit COM controls pass. The
native stale construction refusal has zero adapter calls, queued events, held
buttons and callbacks, including 200 subsequent native probe steps. Native
confirmation, a new complete capture and a separate fixture review then admit
exactly one click with native movement/press/release conditions 1/2/4. There is
no game model in this fixture. Separate native controls establish right input,
held drag, late/dropped ACK terminality, expiry after write, Quit reserve,
capture refusal while held, cancellation, independent UP and death after an
executed native press. Normal holds are 100 ms; deliberately interrupted holds
release at 300 ms. Parent death is actually waited with exit 17. The native
interrupted-context/caller-stack/RETF and range/ratio suite also passes.

The first late-ACK diagnostic accidentally left the separate guard unmodified.
Its assertion therefore failed after a normally balanced click; it was
cancelled and actually waited (native -9, watchdog 0, supervisor-child 247,
both EOFs). The corrected fixture injects faults in both processes and passes.
This was a test-harness error, not evidence of a game or production engine bug.

LS32 and Q3 explicitly released source/build/runtime before these controls.
Personally verified LS32 evidence contains 160 named hashed wait files,
80 native/watchdog/supervisor-child wait triples and 321 absent PIDs/groups.
Q3 contains 54 hashed actual wait files with both EOFs, its direct original
native/watchdog/supervisor-child closure, 109 absent PIDs and 96 absent recorded
groups. Historical missing outer/ancillary EOFs stay UNKNOWN. Both locks were
observed free. No workers or boxes are created.

The locked full build passes. Route publication and the one newly authorized
original remain pending; native transport controls do not prove a TIM handle.

The prior smart-handle, direction/belt and construction notes were read.
Actual manual printed pages 12–16 and six selected original prior gameplay
images were personally viewed. The manual specifies drag, separate placement
click and then a handle click; attachment belts use separate endpoints. Prior
images prove floating/anchored/picked-up/invalid cage states, not a flip. Each
new original action will require its own complete current scene. Native Quit,
host shutdown, input acknowledgment and visible puzzle completion are distinct.
