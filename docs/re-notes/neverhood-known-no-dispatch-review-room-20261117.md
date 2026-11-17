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
