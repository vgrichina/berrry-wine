# LTris final wire freshness, 2026-11-18

Published transport repair: `75f495225`. Focused transport tests, the SDL
startup regression and the locked build passed. Evidence is in
`scratch/runs/20261118-ltris-final-wire-freshness-manual-line-clear/`.

`tools/ltris-reviewed-transport.cjs` checks the reviewed whole frame inside the
disk admission lock immediately before the actual socket send. A stale DOWN
returns local `NOT_SENT`, removes its pending request and timer, and keeps the
scope usable. Actual send failures, timeouts, protocol errors and replacements
close UNKNOWN without replay. Costly source preparation precedes capture;
identity checks precede independent release arming. No identity query follows
arming before DOWN. The shared helpers and `cf132e191` disk guard are unchanged.

One fresh authored browser scope qualified the final transport. A deliberately
stale Enter produced zero DOWNs, joined its fallback independent UP with
physical state zero, then required a new capture and personally reviewed intent.
The new Enter visibly changed the black native window to the green fixture
board; Escape completed ordinary SDL Quit/ExitProcess(0). Both actual DOWNs
had matching independent UPs with physical zero. Actual guest process and
document replacements were rejected, followed by permanent UNKNOWN closure and
zero later wire requests. These are fixture results, not original gameplay.

The ONE unchanged registered `ltris_128` attempt used all 43 media pins,
`C:\LTRIS`, `-w`, the frozen `f6962ba5b` source graph and the published transport.
Compiled and served module SHA-256 was
`a6002d5dbcfeb534a0eadd223da616e525aa1542dad2bde381fe54e00ee862f8`.
The independently executing child module remains unknown; optional child
Runtime/Debugger inspection was omitted.

Personally reviewed whole frames show the actual main menu, Controls and
Player1 bindings: Left/Right, Up/PageDown rotation, Down, End drop, Delete hold,
and P pause. No bindings or settings were changed. Six original DOWNs each had
an independent matching UP with physical zero. All eight actual DOWNs across
the two scopes were within 15 seconds of review and readback; the maximum
readback age was 10,697 ms and guard-to-socket delay was at most 1 ms.

Shared disk preemption permanently closed the original at
2026-11-18T11:06:45.010Z with 1,638,060,032 free bytes. The browser/profile and
supervised descendants closed; no ordinary wire request followed closure.
A subsequently written local Escape command was never consumed and its local
35-second file wait expired. It sent no input and did not reopen the scope.
There was no second original, board, line clear, score consequence or original
ordinary Quit. This is a bounded resource interruption, not a game defect.

Original bounds were startup 180 seconds, total 1,200 seconds, final Quit
reserve 180 seconds, cleanup 20 seconds, transport 3 seconds, independent UP
fallback 5 seconds and maximum hold 1,200 ms. No bound was extended. An initial
unmeasured 2.1 GB admission rule was withdrawn before browser launch; the
required floor stayed 1.5 GB, with temporary 1.65 GB preemption. The two runtime
watchdogs sampled above the floor through their closes. An additional
tool-managed disk sampler unexpectedly exited 143 without a summary; its exact
death time and separate EOF flags are unavailable. Continuous disk coverage
through that offline gap is not claimed. A finite retained-child guard covers
the subsequent offline flush/seal. Arbitrary foreign write bursts are not
bounded by closing a browser profile.

The audit retains 22 actual runtime/admission close waits with both EOFs,
65 recorded PIDs absent, no supervised leaks, media revalidation, socket
freshness records, exact Git/diffs, input patches and recovery recipes.
Selected whole screenshots are retained; unselected images were removed.
The final result is published last. No agents, workers, boxes, Python, Wine,
deployment, solver, OCR, board-memory reads, autoplay, forced focus, state,
save or clock edits were used. Foreign WIP, held BloodII and UT media were
preserved. Box ID/expiry/stop receipt are null; state is `NOT_CREATED`.
