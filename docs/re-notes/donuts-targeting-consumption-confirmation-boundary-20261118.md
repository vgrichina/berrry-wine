# Donuts targeting and confirmation boundary, 18 November 2026

The native-scene controller now admits delivery while the reviewed target is
fresh, without reserving another 500 ms inside targeting freshness. The same
immutable targeting expiry still fences server preparation, physical application,
native dequeue/validation and owner USER-return consumption. A receipt at or
after that expiry is rejected permanently. Confirmation remains limited to
500 ms from delivery, physical UP to 1750 ms, and full operation/observation to
three seconds. Legacy routes retain the conservative confirmation reserve.

Evidence: `scratch/runs/20261118-donuts-targeting-consumption-confirmation-boundary/`.

The applicable contract is the owner's explicit separation of native consumption
from confirmation. The LMarbles distinct-deadlines and recovered-headroom notes
were read alongside its older admission notes. Historical helpers reserved
confirmation inside freshness, but supplied no independent authority requiring
that extra reserve. LMarbles admission notes provide the completion allowance
and independent-release design reference; they do not authorize a Donuts change.
Applicability here rests on the actual Donuts native-scene transport and checks
in `lib/cli-guarded-input.js`: `valid`, `consume`, `dequeued`, `nativeValid`,
`nativeConsumed` and `delivered`. Queued stale effects are purged; release uses
the original owner independently of freshness. Native receipts now additionally
require the exact owner, epoch, nonce, deadline and owner USER-return boundary.
The client keeps its strict consumption timestamp check and sticky terminal latch.
As the LMarbles notes explain, a pre-effect check cannot undo an effect if a
callback straddles expiry. Such a late receipt is never accepted or replayed;
the independent UP is still awaited. This change supplies no exception to that
receipt fence.

The old helper refused an actual elapsed-age crossing control before DOWN.
The corrected helper consumed the compiled authored fixture before the identical
five-second expiry while confirmation crossed that expiry within its separate
500 ms delivery bound. No capture or review timestamp was moved. Negative
controls cover arrival after expiry, native queuing until expiry, actual native
focus change, confirmation overrun, independently delayed UP, operation overrun,
lost ACK with independent UP, and zero later controller endpoint calls after
closure. The queued-expiry fixture remains alive past its real ten-second pump;
its exact DOWN is purged and no native-return candidate is recorded.

An immutable published-source native fixture also passed the personal workflow.
The whole 1024x712 desktop and its PUBLIC MENU were personally reviewed before
one finite Right. Consumption occurred 3.973 seconds after capture, confirmation
at 3.983 seconds, and independent UP at 4.094 seconds. Some earlier fixture
captures displayed only teal despite live window metadata; these are retained as
limitations, not treated as reviewed visible menus. Explicit authored-fixture
repaint requests preceded a subsequent complete visible frame. They do not alter
the original or supply original gameplay evidence.

The single authorized original reached LEVEL001 and accepted five finite
gameplay gestures: Space, Right, Up, Space and Right. The post-turn frame visibly
shows the ship facing right. Later frames show different positions, but motion
was not isolated from respawn. These are
actual consumed controls, but their score changes do not isolate a shot's
consequence: score and fragments also changed while all preceding gameplay
intentions were NOT_SENT. A last fragment remained in reviewed frames. LEVEL001
clear and LEVEL002 are unproved. Gameplay stopped at the fixed Quit reserve.

Ordinary Escape then consumed through the owner's USER-return boundary and the
native exited0 with both EOFs, without host cancellation or watchdog signals.
The existing final-choice path independently verified that exact owner's actual
normal wait after release found the closed port. Physical UP was unacknowledged;
it is recorded as OWNER_EXITED, never fabricated as an UP ACK. No later endpoint
request, capture, rebind or replay followed terminal closure.

Shorter manual invocation permitted five gameplay gestures, although other
complete-frame reviews still expired before DOWN. Whole-frame display at reduced
scale was also tried, with native PNG hashes/timestamps unchanged. A duplicate
review-file refusal before any input was followed by a new capture and intention;
it was not an ambiguous transport result. Earlier black title captures were
honestly reviewed as black; one finite Enter used the title's already-observed
documented Begin Play route and produced the visible LEVEL001 frame.

The unchanged EXE, 37-file manifest, presentCap60 and normal guest Worker used
sealed published source95997a6a5. Canonical module eb2395e1c115980dd78db646a26f755a4119a2a1e086942e715240e07c34bc6
was compiled from published e89057abd; the complete src closure is identical at
the original source commit. Actual loaded module/source hashes are verified for
the main thread and Workers. Preparation and native renderer/PNG preflight ran
before the clock. Prior disk-stopped and UNKNOWN scopes stay closed.
DirectDraw/Canvas2D does not prove a GL backend.

All eight final focused native cases and the locked build passed. One earlier
near-expiry diagnostic safely refused while compiler load spent its prearm
margin; the test expected a postdispatch fault and failed. A run-local manifest
writer also encountered the append-only save rule. These failures are retained;
the corrected manifest writer and final sequential suite pass. Automated tests
pin the compiled module but use the live checkout, whose relevant patches are
retained; the personal fixture and original instead use verified sealed sources.
Both sealed launchers' invoking tool waits returned143 with unknown sender,
despite their own completed normal owner/native/watchdog waits and descriptor
closure receipts. Separate invoking-tool EOFs are not established. This limitation
is not replaced with the inner native exit0 or a fabricated normal outer wait.

Native-supervise supplies finite process containment; independent watchdogs
monitor actual home disk above 1.5 GB. No RAM gate, Python, Wine, box, worker,
deployment, source archive or media copy is used. Git plus relevant patches is
the recovery source. Selected whole PNGs, unique inputs/modules, actual waits
and media hashes remain in the run; `result.json` is written last.
