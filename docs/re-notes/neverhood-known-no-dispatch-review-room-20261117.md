# Neverhood local image expiry refusal

Evidence: `scratch/runs/20261117-neverhood-known-no-dispatch-review-room/`.

The frontend now distinguishes `REFUSED_BEFORE_DISPATCH` (CLI exit 3) from
permanent UNKNOWN. Only an expired local whole image can produce this outcome,
after identity, image hash, target, review and action checks. The operation must
have sent no request and published no bind/action intent or arm. Outstanding
intents or arms prevent eligibility. The refusal invalidates the capture's
review and the operation nonce. Its immutable image and timestamps are retained.

Recovery requires an explicit new native whole-image capture, followed by a new
review. Older captures cannot be reviewed for recovery. Binding remains once
per target; a recovered action uses a new nonce. Independent release after a
refusal requires a subsequent fresh reviewed intent. No automatic input retry,
image restamp, clock reset, server guard change or UNKNOWN recovery is allowed.
The original 15/30-second freshness, 500 ms confirmation, 1,750 ms physical UP,
3,000 ms observation and 1,800/1,820-second installed runtime/watchdog remain.

Authored real native tests wait for actual expiry before binding and before
input on an existing binding, verify zero transport/intent/arm publication and
unchanged original clocks/images/reviews, then capture and review a fresh scene
and complete native input, independent UP and Quit. Separate real native
semantic/owner/focus failures and an observation timeout remain permanent
UNKNOWN with zero subsequent transport. Unit tests also reject changed request
ledgers, pending intents/arms, capture restamping and release without a new
reviewed intent. The canonical locked build and lifecycle/shortcut checks pass.

The final run outcome, published hashes, selected whole images, actual waits,
EOFs and cleanup disposition are recorded in `result.json`. Native Quit and host
cleanup are reported separately. No workers, boxes or public deployment.

The one fresh installed-shortcut preparation with published `d97dc35ad` refused
before original execution. Its real native child Quit test caught partial JSON
while reading an evolving `native-child-*-wait.json`: the producer truncated
the public file for each exit/EOF/close update. The controller correctly latched
UNKNOWN; that endpoint was never queried or retried afterward. Original game
invocations, room progress and original native Quit are all zero/unproved.

The subsequent demonstrated fault is fixed at the producer. A private file is
written, fsynced and closed before atomic rename replaces the public receipt.
Readers see a complete old or new version. A failed write preserves the last
complete receipt and removes its private partial file. This changes evidence
publication only, without changing consumption, identity, exit or EOF predicates.

The regression executes the exact old and fixed production callbacks and starts
an independent OS reader halfway through each write. The old callback exposes
partial JSON; the fixed callback never does, including a controlled failed
replacement. Fresh sealed native Play/parent exit/child capture/input/UP/Quit
and negative handoff cases validate the repair with unchanged deadlines. The
thirteen-case frontend suite passed before the wait-publication delta; fresh
game expiry/bound-owner recovery cases also passed with the repaired producer.
The native core and module are compared exactly
against the prior proof; only the reviewed wait-publication delta is excluded
from that equality claim. There is no full historical suite rerun claim.

No second original preparation or invocation was attempted. The repaired
subsequent fault is the stopping condition for this assignment; a fresh original
room/object attempt remains future work.

Two later authored positive rehearsals failed closed under the original guards:
one ordinary fixture exited before its independent UP connected; another Play
receipt was consumed at 461 ms and retained at 463 ms, but subsequent durable
receipt publication crossed the 500 ms confirmation boundary. Both became true
terminal UNKNOWN with no recovery or later transport. Their evidence is retained;
neither is counted as a passing complete suite or repaired by the atomic JSON
change. A concurrent auxiliary build was interrupted by SIGTERM before its own
wait receipt; the final locked build runs after all native rehearsals close.
