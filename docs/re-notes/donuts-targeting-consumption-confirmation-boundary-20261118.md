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

The unchanged original's EXE, 37-file manifest, presentCap60 and normal guest
Worker are prepared with matching published source and canonical compiled module
before its clock. Original gameplay and ordinary Quit results will be recorded
after the single authorized attempt. Prior disk-stopped and UNKNOWN scopes stay
closed. DirectDraw/Canvas2D does not prove a GL backend.

Native-supervise supplies finite process containment; independent watchdogs
monitor actual home disk above 1.5 GB. No RAM gate, Python, Wine, box, worker,
deployment, source archive or media copy is used. Git plus relevant patches is
the recovery source. Selected whole PNGs, unique inputs/modules, actual waits
and media hashes remain in the run; `result.json` is written last.
