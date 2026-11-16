# LMarbles distinct targeting and completion deadlines, 2026-11-16

New finite intents keep three deadline domains separate. The reviewed capture
and personal review must still be fresh at DOWN admission and actual native
consumption (5 seconds in game, 30 seconds in menus). The native consumption
guard retains the minimum of targeting expiry, operation expiry, independently
prearmed release cap and gameplay cutoff. Its existing hold cleanup is unchanged.

The operation starts once on entering `pulse`, before policy and lease work, and
ends 3000 ms later. It no longer ends at targeting-image expiry. The existing
2.15-second admission allowance still applies against the operation deadline;
it does not require 2.15 seconds of targeting-image life. Admission is checked
before prearm, after prearm and immediately before dispatch. Expiry while arming
or checking policy disarms an unsent child safely. DOWN confirmation remains
500 ms, independent physical-UP acknowledgement remains 1750 ms from dispatch,
and release confirmation is also bounded to 500 ms. Release is not a new
targeting decision and does not require an unexpired targeting image.

Postrelease progress and full-frame capture consume the remaining original
operation time. Their request timeouts cannot start a fresh three-second
completion window. No numeric contract, capture/review timestamp, running
deadline, native paint binding or permanent-context rule was enlarged or reset.
The prearmed release child still runs after failed/lost DOWN confirmation;
UNKNOWN remains closed to capture, binding and new input.

Evidence: `scratch/runs/20261116-lmarbles-distinct-admission-completion-deadlines/result.json`.
The published411626622 original and earlier sg1 outcome are historical and
unchanged; neither endpoint is contacted or restarted by this work.

## Verification

Thirteen native cases and the additional actual-event-loop physical-UP fault
pass. Eight budget tests cover the separate exact freshness and operation admission
boundaries, unchanged limits and actual prelaunch 3600/3620/300 watchdog/reserve
records. Eleven reserve/lifecycle tests pass. Native tests use authored Solitaire
fixtures with actual threaded USER windows, the production HTTP transport and
an independent release process, never an original game as a fault fixture.
They exercise near-expiry consumed DOWN with UP after image expiry and timely
completion, stale admission/consumption with spare operation time, spent prearm
and dispatch budgets, slow confirmation/UP/completion, focus/owner cancellation,
new capture/nonce after proven NOT_SENT, independent fallback and permanent
closure with zero later HTTP requests.

The positive native boundary had 465.8 ms remaining at dispatch and consumed
DOWN 442.9 ms before targeting expiry. Independent UP was acknowledged 410.5 ms
after expiry (876.3 ms from dispatch); the complete operation took 2485.7 ms.
The physical-UP fault additionally stalls the actual native event loop, retaining
the independent child and unchanged deadlines, and triggers the 1750 ms failure.

The first diagnostic suite retained one startup bind refusal: Solitaire was
still painting its initial deal. Fixture-only settling precedes its single bind
in the final suite. Production paint binding is unchanged.
An earlier 180 ms positive fixture was safely NOT_SENT when prearm exhausted its
targeting life; this is retained as a diagnostic test expectation failure. The
final positive leaves 650 ms before starting, without changing production limits.
The required canonical
`flock /tmp/wine-build.lock bash tools/build.sh` passed and shared outputs were
released. Independent runtime sources come from published Git358a20bae58e01713036332cb443426d98cd7b48 plus recorded owned patches,
with canonical sealed module83703369cc49c3e16077a4abd43def27262487f83dd52583d1b433adf7095f5f.
No foreign uncommitted source is adopted. The 86-file original-media verifier passes.

## Conditional original

The single authorized fresh Normal/Original/Puzzle8 attempt follows successful
native proof and material publication. Its actual outcome will be recorded here
and in result.json after closure. Native Quit and host cleanup are separate facts.
No box has been created; box ID null, state NOT_CREATED, expiry null, stop N/A.
