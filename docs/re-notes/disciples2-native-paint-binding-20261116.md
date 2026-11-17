# Disciples II native reviewed-paint investigation, November 16

Evidence: `scratch/runs/20261116-disciples2-native-menu-paint-binding-cause/`.
No original game was launched in this task. The previous original endpoints
remain closed. NewQuest, quest/town/turn consequence, and native Quit remain
unproved. There is no demonstrated causal repair to the original paint mismatch,
so the conditional original authorization was not exercised.

The actual old failure is narrowly established: native process, USER main-window
generation and focus matched, then the complete PNG hash differed at binding.
The old run retained its reviewed menu PNG, but neither the binding PNG nor its
hash. Those missing bytes cannot be reconstructed from the retained source,
window tuple or 4.806-second review age. Animation, cursor changes, a publication
race and other genuine paint changes cannot be distinguished retrospectively.
No specific cause among them is claimed.

Both production capture routes and reviewed binding call `canvasToPng`, which
forces pending DirectDraw publication, composites the desktop, then serializes
`renderer.canvas`. The controller requests the USER snapshot and scheduled PNG
separately; their batches can differ. That observation alone does not establish
a defective paint guard. `test/run.js` and `lib/cli-native-scene.js` were not
changed, and all pixel/identity/focus/freshness checks remain intact.

The new authored PE fixture creates an ordinary USER main window and STATIC
menu on thread 1. A real Node guest Worker repeatedly calls SetWindowTextA,
either with identical text or changing numbered paint. It uses the production
capture and native-scene-v1 binding routes, without freezing execution or
suppressing rendering. A fixture-only encoder observer calls the original
encoder unchanged and records the returned full PNG hash, time, main/focus and
public renderer-window metadata. Source metadata is sampled after encoding;
it is not an atomic snapshot of concurrent Worker writes. Full images were
personally reviewed before each accepted diagnostic intention. The test does
not manufacture personal review records.

The sealed runtime source is published Git
`32101cbd4563289cfc05cc1c8818342c98e130d1` plus owned diagnostic/controller
changes. It excludes foreign WIP. Its privately compiled canonical module is
`83703369cc49c3e16077a4abd43def27262487f83dd52583d1b433adf7095f5f`.
Source and module bytes lived in sealed memfds; Git and owned patches provide
recovery, with no source-tree archive, persisted Wasm or copied game media.

The final stable native fixture bound the same complete image after 20.296
seconds: zero changed RGBA pixels. Its finite arrow input confirmed in 6.950 ms
and independently released physically in 126.306 ms, below 500/1750 ms, with the
3000 ms operation bound unchanged. This is a public-fixture result, not a game
progress or gameplay-freshness qualification. The historical assertion field
`nativeWorkerThread` contains the USER owner thread ID (1); the native log
separately proves the actual guest Worker backend.

The changing-paint fixture refused before consumer binding or input. Its
capture-to-bind interval was 9.520 seconds, and the exact encoder output at
binding differed by 18 pixels in the numbered menu text. The native main and
focus identities remained valid. This is a correct paint refusal in this
fixture; it does not identify the original game's changing pixels. Focus and
renderer-owner mutation negatives also refused/cancelled without effects.
A native process-group suspension produced a real capture timeout; the caller
closed permanently and issued zero later requests. Suspension was used only
for this explicit fault test, never to stabilize or review paint.

A separate controller defect was proved and fixed: `bind()` previously raised
on refusal without writing its local terminal latch. A later `capture()` could
therefore make another endpoint request. The focused test executes the old
published controller in memory and demonstrates that extra request, then proves
the repaired controller closes immediately with zero later capture/bind
requests. Binding attempts are now locally permanent even before an owner is
returned. This closure repair does not make changing original paint acceptable
and is not a repair to the original admission blocker.

Qualification is incomplete. During the real elapsed-time stale-review test,
the native process crashed with `Process desktop: ETIMEDOUT` in its ordinary
GetMessage/desktop poll before the stale-binding assertion completed. Its
actual native wait is exit 1 with both EOFs. That is a new genuine fixture
blocker, not a stale-negative PASS or permission to enlarge a deadline. Earlier
setup failures, review-window expirations and an alternating-paint fixture
whose bind legitimately accepted a matching recurring image are retained.
No original was used to resolve these diagnostic failures.

The required locked full build passed; focused closure/context/PE tests and all
128 genuine media SHA-256 pins, 127 manifest rows and real-DLL closure passed.
Native/watchdog/driver waits and both pipe EOFs are recorded, including failed
runs. The source/module holder closed normally and its invoking tool waited
zero. Shared build outputs were released immediately after the build; no
runtime read them. No box was created: ID null, state NOT_CREATED, expiry null,
stop receipt not applicable.

The remaining contract is unchanged: a complete personally reviewed original
image must still equal the current full composite at one permanent binding.
A future investigation needs actual bind-frame evidence and a causal repair,
plus completed native fault qualification, before any conditional original.
