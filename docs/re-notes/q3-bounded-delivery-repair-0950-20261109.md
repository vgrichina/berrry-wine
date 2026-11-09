# Q3 bounded delivery repair, 0950

The genuine Q3 composition now loads `tools/q3-input-delivery.cjs` through
`compileBoundInput`. The historical scratch helper and adapter are unchanged.
The new provider has a literal SHA pin and participates in the existing strict
prelaunch dependency gate. Shared launch clients, custody, Redline and Q2 are
unchanged by this task.

The 0924 first 100ms Enter had DOWN reply at 3546ms, UP attempt at 101ms,
UP reply at 3547ms and zero held samples. Tracing the retained `send` and
`evaluate` finds no caller queue that serializes those two submissions. Reply
delay and delayed application reach the same historical assertion in the inert
full-controller controls. Neither supports a native application-time, actual
held-interval or guest-poll inference; the native latency cause remains UNKNOWN.

The supported correction is failure handling and release scheduling. At the
unchanged hold deadline, an unresolved DOWN now fails terminal immediately,
after submitting one UP for each attempted DOWN. UP submissions run independently
in reverse order: an unanswered first UP cannot prevent the second submission.
The old implementation's sequential UP await demonstrably prevented that second
submission. No retry or later DOWN is allowed. First failure closes the actual
pending CDP map and starts the existing joined browser cleanup. Existing hold,
work, CDP, ACK and cleanup caps and the before-first-DOWN timer origin remain.

The actual command saves `input-<id>-delivery.json` on every transition, including
failure, alongside gzip physical telemetry. Per-key submission and promise
settlement times, sample bounds, first failure and cleanup settlement survive.
A rejected promise explicitly leaves protocol reply/application timing UNKNOWN;
a successful CDP reply still makes no application-time claim. Terminal failure
cannot publish a positive ACK or continue into settle/capture.

Evidence: `scratch/runs/20261109-q3-bounded-delivery-repair-0950/`. Full composed
controller tests use the real bound module, send/pending map, evaluate and
numbered transport with inert browser/page seams. Four actual old-code negative
controls and seven repaired cases cover reply delay, application delay, stalled
DOWN, independent UP, sticky sample failure, normal key/combo completion and
ordinary quit. Node children and pipe writers actually wait with separate EOF
checks under independent watchdogs. These are offline controls, not native proof.
Focused telemetry, dependency and prelaunch checks and the locked build pass.
Accepted unchanged startup/identity/fixture source proof is hash-verified and
reused; only the changed delivery/controller behavior is newly exercised.

No box, Chrome or guest was created. Box ID/state/expiry/stop receipt are null /
NOT_CREATED. Native lifetime REVOKED; allwriters and edictABA UNKNOWN; actual
Boat cancellation NOT_PROVEN. Next: separately authorized native fixture using
the new pinned helper before any original game run. SingleTaskSTOP.
