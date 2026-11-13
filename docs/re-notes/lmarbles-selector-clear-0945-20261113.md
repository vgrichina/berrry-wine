# LMarbles selector: remaining event recovery exhausted below floor

Puzzle 2 selection, CLEAR and next/tally remain unproved. The assigned fresh
resource phase completed while its Pawn worker PID1007028 was still live;
this task did not wait for whole Pawn completion. Its inventory found 26 raw
event streams: four eligible, eleven without unambiguous processed canonical
completion, ten current or pending predecessors, and one unsuccessful worker.
The four eligible streams were recovered, saving a reported 1,257,472 allocated
bytes including that worker's evidence. Reported available space afterward was
1,488,596,992 bytes, 11,403,009 bytes short of strictly above 1,500,000,000.
The remaining eligible pool was exhausted at that inventory snapshot.

Before publication finished, two additional streams became eligible after new
coordinator reviews. Observed the resource worker's completed second phase
without waiting for Pawn completion, and verified both full compressed/decoded
hash pairs. Phase two reported another 548,864 bytes net recovered and
1,486,884,864 bytes available. Shared capacity changes are not attributed to
this task. Its final inventory has twenty raw streams, zero eligible bytes:
eleven without canonical completion, eight current/pending and one unsuccessful.
The six-stream recovery still did not provide native-input headroom.

Evidence: `scratch/runs/20261113-lmarbles-selector-clear-0945/`.
`dependency-resource-outcome.json` records the phase result, inventory, observed
live dependency, source evidence hashes and four full decoded gzip checks.
All four compressed hashes and decoded raw hashes passed. This verifies the
referenced bytes; recovery accounting and eligibility decisions belong to the
resource worker. Its recovery data, recipes and all excluded files remain
untouched. No broader cleanup was performed or inferred to be authorized.

Read parent `ec8fb9df4`, corrected pointer-helper handoff `98d6bdbea`, and the
actual published source delta `418099fe9` before freezing runtime hashes.
Guarded CLI input is opt-in; ordinary corrected motion/down/up remains
supported. Prepared the existing route and corrected helper as small run-local
inputs, preserving their patches. Both syntax checks and all 88 original
media/CRT/current04-module pins passed. Recorded exact Git SHA, relevant tracked
binary diff, untracked runtime patch and 165 runtime path hashes. No source or
media archive was created. No production code changed, so no build was needed.

No further floor-only launch decision or native launch was made after this
distinct inventory outcome. There was no native input, hover, selector label
review, Tutorial move, Puzzle 2 move or progress claim. Selector availability
and any prerequisite remain UNKNOWN. The historical parent image was inspected
only to prepare the pointer route; it is not fresh gameplay evidence.

The independent deadline supervisor is prepared but was never started because
no native process was launched. Native parent waits, stream EOFs and independent
UP are not applicable to this run; helper review confirms UP is in finally and
there is no automatic replay. No external box was created: ID none, state
NOT_CREATED, expiry null, stop receipt N/A. No workers or agents were launched.

Concrete new blocker: the assigned remaining eligible event pool produced only
1.26 MB of net recovery and ended below the required floor. Next needs a
different authorized source of sustainable headroom, then observed watchdog,
fresh above-floor native launch/input checks, pointer-first Puzzle 2 selection
and individually reviewed legal moves through earned CLEAR and next/tally.
