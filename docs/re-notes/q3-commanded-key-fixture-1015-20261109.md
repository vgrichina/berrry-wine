# Q3 commanded-key fixture observation, 1015

The generated fixture now installs the unchanged production
`renderer-input.js` key handlers on its renderer. Trusted DOM key events enter
`handleKeyDown`/`handleKeyUp`; the sampler reads that renderer's physical state
through `peekKeyDownState`. No command-authored key map or CDP reply supplies
the observed state. The fixture's existing Worker link owns the input route;
renderer, Worker, module, endpoint and slot changes refuse input.

The current composition changes only the loaded fixture and bound-input source;
historical helpers remain untouched. Sampling selects the commanded VKs,
including Enter13 and both combo keys. Samples identify the actual renderer,
reader function, Worker, module and endpoint. The fixture requires a wholly
held high sample and a same-source zero sample after completed release before
capture/ACK. Missing/wrong keys, changed sources and missing release fail
terminally. Original-game observations retain UNKNOWN guest polling/application
timing; fixture physical evidence and fixture GL rendering prove neither.

The full composed controller and generated fixture ran offline with inert
browser, graphics and guest execution. The old composition failed the physical
gate; the new path passed Enter, ArrowUp and a+Control high/release checks.
Missing input, wrong key, stuck release, replaced renderer and untrusted events
failed closed, with sticky first failure and no later input/capture/ACK. Tests
used actual Node child waits and separate stream EOF with independent deadline
watchdogs. Startup, dependency, telemetry and bounded-delivery regressions and
the locked build passed. Existing accepted proofs were hash-verified and reused.

Evidence: `scratch/runs/20261109-q3-commanded-key-fixture-1015/`, exact Git base
plus a small binary patch; diagnostic file journals retain unique log bytes
with SHA-256 recovery checks. No source tree, game media or module archive.
Shared free space briefly measured 1,499,811,840 bytes during diagnostics;
own diagnostic compaction recovered space, and final free space exceeds 1.5 GB.
An initial test setup omitted its untrusted-event injection and a rerun reused
an exclusive log path; both failures and corrections are retained. A startup
test's newly created default output directory was moved into this task's run.

No box, Chrome, guest, agent, worker or deployment was started. Box ID/state/
expiry/stop receipt: NOT_CREATED / not applicable. Native remains REVOKED;
allwriters/edictABA UNKNOWN; actual Boat cancellation NOT_PROVEN. Next is only
a separately authorized native fixture and actual owning-caller cancellation
prerequisite before any original-game attempt. SingleTaskSTOP.
