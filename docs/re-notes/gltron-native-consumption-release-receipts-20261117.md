# GLTron native receipt timing, 2026-11-17

Evidence: `scratch/runs/20261117-gltron-native-consumption-release-receipts/result.json`.

The prior `current-native-2` failure was a real freshness refusal before DOWN
application. Preparation used a 240 ms-old owning USER observation. The physical
DOWN wrapper entered at age 274 ms; the guard refused at 275 ms under its
unchanged 250 ms fence. Token remained zero, the handler applied no DOWN, and
there was no native consumption. The independent physical UP was dispatched,
but the native bridge emits an associated UP receipt only after an applied
DOWN. Thus its null receipt is consistent with this refusal; a browser ACK
cannot replace either native receipt. Wall and monotonic elapsed time agree.
The 223 ms uninstrumented interval before preparation does not identify a
GPU wait, OS scheduling cause or runtime bottleneck. No runtime change is
justified by that interval.

Two demonstrated controller defects are repaired. First, an independent
release error in `finally` replaced the native refusal error. The controller
now retains both causes and records each native status before interpreting it.
Second, the old loop checked `CONSUMED` before its elapsed-time condition,
accepting a native status reply that arrived after 500 ms. Execution of the
exact published loop reproduces that acceptance. The replacement brackets
DOWN and status with an immutable wall/monotonic deadline, closes transport on
expiry, retains late replies as discarded evidence and issues no later query.
Receipt arrival is timed before file bookkeeping. Native consumption still
requires the existing owning USER-return token and MSG identity checks.

The same minimal 480x360 eight-triangle native WebGL workload passes with the
unchanged 603 runtime graph and retained 6de8753b module plus the published 9f
canvas repair. All source/output/host images were personally inspected before
input. The final run cancels an armed edge without DOWN or UP dispatch, then
consumes Left in 98 ms with an independently dispatched trusted physical UP.
Escape consumes through USER and calls native ExitProcess(0). Three complete
captures pass. A separate real 1800 ms controller-stall case closes UNKNOWN
before any status query; independent UP still fires at its immutable deadline
and returns a trusted cleared-key receipt. Browser ACKs remain separate.

Focused tests cover timely success, cancellation, late DOWN, late status,
monotonic expiry, pending promise timeout, independent release failure and
actor/focus/modal/generation/token/target refusals. Canonical locked builds
pass. Early authored screenshot timeouts and an observer setup error are
retained as failed attempts, not input proof. The current diagnostic brackets
record snapshot spans below 0.45 ms and admission spans below 7.6 ms; those
measurements do not establish the cause of the historical missing interval.
Original gameplay is not established by these authored tests; consult the
result receipt for the single separately authorized original outcome.
