# LMarbles distinct targeting and completion deadlines, 2026-11-16

New finite intents keep three deadline domains separate. The reviewed capture
and personal review must still be fresh at DOWN admission and actual native
consumption (5 seconds in game, 30 seconds in menus). The native consumption
guard retains the minimum of targeting expiry, operation expiry, independently
prearmed release cap and gameplay cutoff. Its existing hold cleanup is unchanged.

The operation starts once on entering `pulse`, before policy and lease work, and
ends 3000 ms later. It no longer ends at targeting-image expiry. The existing
2.15-second admission allowance still applies against the operation deadline;
it does not require 2.15 seconds of targeting-image life. NEW strict intents
reserve the existing 500 ms confirmation interval against targeting expiry,
including the native integer-millisecond deadline floor. This derived reserve
adds no numeric limit. Admission is checked
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

The fresh original exposed one additional boundary: native validation can pass
before calling its effect handler, while its published `consumedAt` timestamp
falls after the deadline. NEW receipts now must also satisfy
`floor(dispatchAt * 1000) <= consumedAt < guard.deadline`. A violation permanently
closes the controller; the independent UP is still awaited. This is a receipt
validation fence, not a claim that it can undo an effect already made by native
code. An actual native fixture crosses expiry inside the effect callback and
proves rejection, independent release and zero subsequent HTTP/rebind/replay.

Evidence: `scratch/runs/20261116-lmarbles-distinct-admission-completion-deadlines/result.json`.
The published411626622 original and earlier sg1 outcome are historical and
unchanged; neither endpoint is contacted or restarted by this work.

## Verification

Fifteen native cases pass (the final fourteen-case suite plus one additional
native confirmation-reserve refusal). Nine budget tests cover the separate exact freshness and operation admission
boundaries, unchanged limits and actual prelaunch 3600/3620/300 watchdog/reserve
records. Eleven reserve/lifecycle tests pass. Native tests use authored Solitaire
fixtures with actual threaded USER windows, the production HTTP transport and
an independent release process, never an original game as a fault fixture.
They exercise near-expiry consumed DOWN with UP after image expiry and timely
completion, stale admission/consumption with spare operation time, spent prearm
and dispatch budgets, slow confirmation/UP/completion, focus/owner cancellation,
new capture/nonce after proven NOT_SENT, independent fallback and permanent
closure with zero later HTTP requests.

The initial, pre-reserve positive native boundary had 465.8 ms remaining at dispatch and consumed
DOWN 442.9 ms before targeting expiry. Independent UP was acknowledged 410.5 ms
after expiry (876.3 ms from dispatch); the complete operation took 2485.7 ms.
The physical-UP fault additionally stalls the actual native event loop, retaining
the independent child and unchanged deadlines, and triggers the 1750 ms failure.

The first diagnostic suite retained one startup bind refusal: Solitaire was
still painting its initial deal. Fixture-only settling precedes its single bind
in the final suite. Production paint binding is unchanged.
An earlier 180 ms positive fixture was safely NOT_SENT when prearm exhausted its
targeting life; this is retained as a diagnostic test expectation failure. The
final positive leaves 900 ms before starting, without changing production limits.
Its DOWN dispatch has 799.9 ms remaining, consumption precedes expiry by
788.1 ms, and UP is acknowledged 39.6 ms after image expiry. The native
stale-consumption and crossing-effect fault fixtures bypass only the derived
admission reserve to exercise the independent native and receipt fences;
they retain the actual native expiry and immutable operation start.
The required canonical
`flock /tmp/wine-build.lock bash tools/build.sh` passed and shared outputs were
released. Independent runtime sources come from published Git358a20bae58e01713036332cb443426d98cd7b48 plus recorded owned patches,
with canonical sealed module83703369cc49c3e16077a4abd43def27262487f83dd52583d1b433adf7095f5f.
No foreign uncommitted source is adopted. The 86-file original-media verifier passes.

## Single fresh original: consumption-timestamp blocker

The one original launched after material publication85f7dd61a and successful
native proof, with 3600 native seconds, the independently prearmed 3620-second
watchdog and irreversible 300-second Quit reserve recorded before launch.
Personally reviewed menus confirmed Normal/Original, then the ordinary level-8
confirmation entered Tier1 Puzzle8, Moves96. The final complete frame shows
Moves94: two slides are verified. There is no clear, tally or Puzzle9.

Full-frame PNG display intermittently appeared blank despite byte-identical
captures. Whole-frame JPEG presentations, including smaller complete displays,
were retained alongside their original PNGs. No crop, OCR, board-memory read,
solver, route/progress import, queued input or clock/config/EXE change was used.
Expired reviews were cleanly NOT_SENT, with new captures/nonces for subsequent
intentions. One review description overclaimed a blank duplicate presentation;
its attempt was already NOT_SENT without effects and an append-only correction
is retained. No historical record was rewritten.

Audit found `down3` reports consumption 3.349 ms after targeting expiry and
4 ms after its integer guard deadline. Its UP took 214.7 ms from dispatch and
operation completion 2113.0 ms, both timely in their separate domains. No visible
slide followed that DOWN. The native pre-effect guard and post-effect timestamp
straddle expiry; this does not prove exactly when within the callback the
physical effect occurred. It does demonstrate absent receipt-time validation.
The controller had allowed later intentions before the audit discovered this
gap; those records remain unchanged. Ten submitted finite intents have UP ACKs
within 178.5–281.3 ms and completion within 1787.1–2511.0 ms.

The audit permanently closed this new endpoint and prohibited further HTTP,
capture, rebind and input. No original was restarted. Host cancellation produced
actual native exit0 and both EOFs, plus actual watchdog/supervisor waits. It was
not ordinary native Quit. The subsequent receipt fence is qualified only with
native fixtures; there is no second original attempt or post-fix completion claim.
The new demonstrated blocker is the original's late consumption receipt and
its resulting permanent closure. Further original work requires new authority.

The first sealed holder's invoking tool ended143 without a normal-close receipt;
its PID/descriptors are absent. Each original/fixture had already verified and
resealed its own immutable inputs. A later qualification refused the vanished
holder before launching native processes; those failures were retained and
stopped. A fresh owned holder recompiles the same pinned module for final fixtures.
One concurrent canonical compiler was killed137; it is retained as a failed
build; sequential canonical builds after the receipt fence and final derived
reserve both passed with actual tool waits. Synthetic fixture partial-JSON
startup/transport failures and an earlier final-suite failure are retained;
corrected controls and the complete final fourteen-case suite pass. Final holder
source/module hashes were verified before normal shutdown; its actual tool
wait is exit0 and its descriptors are closed. The first holder's abnormal tool
termination remains a distinct limitation.

No box has been created; box ID null, state NOT_CREATED, expiry null, stop N/A.
