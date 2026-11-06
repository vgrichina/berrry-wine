# Aranna setup input, 2026-11-06

Outcome: **blocked in the input harness; player-controlled gameplay was not
reached.** Evidence and experimental helpers are in
`scratch/runs/20261106-aranna-setup-input/`. No production files changed.

The predecessor [stable menu input run](aranna-stable-menu-input-20261106.md)
reached reviewed Main Menu → Single Player → Start New Game → Choose Hero.
Its subsequent setup move refused before dispatch because a sampled input
generation changed. That is a harness boundary, not an emulator defect.

## Route under qualification

`lib/browser-input.js` obtains lock in `canvas.onmousedown` through
`requestGuestPointerLock`. The synchronous optionless request belongs to the
trusted browser event. Automatic capture expires through
`releaseExpiredAutomaticLock` when the guest no longer requests relative input.
The acquisition down suppresses capture-transition motion until balanced release;
subsequent pointer-locked movement uses guest counts. The adapter previously
prohibited all reacquisition, although this ordinary browser route exists.

The run-local observer distinguishes actual protocol events (lock/focus/visibility)
from fluctuations in the sampled recentring hint. Dispatch retains exact reviewed
Worker/session/module, app identity, presentation geometry, trusted movement
generation and live focus/visibility checks. Absolute pointer actions require
stable unlocked input; relative pointer actions require current screen lock.
Keyboard events do not require a stable mouse recentring hint. Reacquisition
requires reviewed and live unlocked relative intent, with an ordinary trusted
canvas click. Existing first-target native provenance and quota checks remain.

## Focused controls and their limit

Both standard and compatibility generated full-shell controls passed ordinary
Space expiry/resume → trusted canvas reacquisition → balanced release → native
target movement and click. Personally reviewed `control-reacquire-standard/response-07.png`
and `control-reacquire-compat/response-06.png` show **ACTIVATED TARGET A**,
hit=1 and down/up=3/3. Acquisition itself had down/up=2/2 and hit=0. Observed
requests came from `requestGuestPointerLock` with active browser user activation;
expiry came from `releaseExpiredAutomaticLock`. No injected lock request was used.

`route-qualification.json` records these two passes and 18 negative checks on
actual owner/module, protocol, native point/provenance and unchanged quotas.
`route-contract-controls.json` records 32 pure contract checks for the initial
qualified adapter version. Prior successful native controls, 112 negatives and
eight-cell passive observer equivalence were reused. These results do not qualify
every later experimental adapter revision.

The original encountered a different ordering: lock expired **after** the native
target proof was armed. Additional generated controls tested acquisition at that
point. `control-target-standard2/action-05.json` completed one balanced trusted
down/up and acquired lock, but the native cursor moved from (398,155) to
(396,-22), with hit=0. A subsequent ordinary relative movement reached (399,156)
and produced a fresh hover transaction. The unchanged eight-store coordinate
journal, shared by DRAW and MANAGER writes, was exhausted; the latest recorded
manager point remained (396,-22). Strict proof therefore rejected with
`no later point change`. See `target-acquire-boundary.json` and reviewed
`control-target-standard2/response-06.png`. No subsequent target click was sent.

This route **did not qualify**, and its experimental Node adapter reload was
never applied to the original. An earlier generated attempt also terminated on
missing harness pointer bookkeeping after a Node-only adapter reload; that
command had zero attempted effects. The evidence preserves that failure rather
than treating it as a pass or replaying it. No native checks or observer quotas
were relaxed to admit the original.

## Sole original and reviewed responses

The registered original ran from 23:30:50.198Z to normal exit at 23:56:19.422Z
on November 6, within its 40-minute limit. The actual owning standard-module
Worker/session remained bound throughout. Its reviewed startup/EULA, title and
Main Menu captures are retained; `original/response-06.png` shows Main Menu and
`original/response-10.png` shows the highlighted Single Player target with the
completed native (398,155) proof.

`original/action-11.json` refused the attempted first target click **before
input**, effectsAttempted=0: reviewed relative screen lock had actually become
unlocked absolute mode. This was an incompatible protocol transition, not merely
a harmless generation increment. An early review sentence incorrectly called
that click completed; `original/response-11.review-correction.json` explicitly
corrects it. No original target mouse-down was dispatched.

Freshly reviewed ordinary Enter, Space and ArrowDown events reached the original
without a visible menu response. Enter also demonstrates admission across a
harmless hint-generation change while actual protocol stayed fixed. Absolute
movement attempts were refused with zero effects because the live recentring
hint did not satisfy the adapter's stable-unlocked condition. Each new attempt
followed a fresh review and a known zero-effect receipt; no uncertain input was
replayed. `original/response-19.png` is the personally reviewed final Main Menu.
This run did not reach Single Player, Choose Hero, setup or the world. The
predecessor's Choose Hero result remains valid evidence from that separate run.

The concrete remaining work is to qualify an ordinary route for lock expiry
after arming, with enough bounded native evidence to certify subsequent
targeting. The successful pre-arm acquisition controls alone do not establish
that route. There is no demonstrated emulator defect, no guest-memory write,
guest patch, heavy benchmark or production repair in this investigation.

## Reproducibility and cleanup

`source-identity-v*.json` records exact Git revisions, relevant binary diffs and
run-local helper patches; retained modules and game media are referenced by
existing path and SHA-256. No source/media archive was made. The original's
596 HTTP identity checks passed before launch. No full build was needed for this
documentation-only publication; no production change is proposed.

All five owned browser sessions are closed. `cleanup-runtime.json` verifies
runner, driver, Chrome and recorded descendants absent, server/debug ports
refused and temporary profiles absent. Four sessions exited normally; the
bookkeeping-failure control exited 1 as described above. `runtime-release.json`
records the absent lock holder and independent acquisition/release of all three
local runtime locks. Explicit release was posted for Lords2 after actual cleanup.
No test boxes were allocated or changed. Free /home space remained above 2 GB.
