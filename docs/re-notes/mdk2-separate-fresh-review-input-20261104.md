# MDK2 separate fresh review: deadline gap, no new Chrome

Run `scratch/runs/20261104-mdk2-separate-fresh-review-input/` used the
tested observation-route repair recorded in `5f9d6dd469b1eb3e718f9760b500dd90b63a8517`
for offline validation. No Chrome launched and no guest commands or inputs were
submitted. Fresh readable New Game/nativeReady, balanced New Game/Medium,
comic cancellation, cinematic and playability remain unqualified in this run.
The prior run's readable New Game is historical evidence only.

## Concrete launch blocker

The unchanged browser driver requires at least 600000 ms of remaining box
lifetime before launch. The assigned box expires at 10:27:13.933Z, so its latest
possible qualifying launch time was 10:17:13.933Z, before this worker began
inspection at 10:19:10Z. At the recorded 10:21:07.464Z check only 366469 ms
remained. The assigned 10:23 close and 10:25 recovery also provide only a
120000 ms recovery interval, below the unchanged finite-deadline helper's
180000 ms requirement. At that check the helper additionally rejected the
112536 ms remaining useful window. `deadline-gap.json` records these bounds.
No guard, authorization, configuration, expiry or budget was changed.

## Offline evidence

The exact repaired `next.py` passed all six observation-route checks: missing
review, valid review, wrong hash, steps, capture, and historical-template removal.
Six additional behavioral checks against that same file passed for separate
input reviews and local native-preflight ordering, including native rejection
preventing remote review. These use mocked subprocesses and retained fixtures;
they authorize no live input and do not constitute personally viewed fresh pixels.
Future execution must personally view and interpret each capture in one call,
then separately author the exact capture/hash/steps-bound review in a later call.

All 37 retained staged input hashes and all 432 runtime source/module/media pins
passed remotely. Actual Puppeteer 24.31.0 CJS/ESM imports, repaired helper
resolution, isolated HTTP full hashes and cache graph (98 page/12 worker scripts)
passed. Process identity inventory was empty: no Chrome or Node driver running.
No modules, media or source archives were copied. Exact 116/90/177/177 controls
were reused after verifying all 38 input hashes and four evidence hashes from
the predecessor record; they are not claimed as newly executed tests.

An extra unfiltered 17-case local selection passed 15 and failed two stale
fixture/source-shape checks: an absent old `review-native-selector-76.json`,
and a literal route expression superseded by the tested repair. Both failures
are retained in `focused.tap`; no implementation was changed to satisfy them.
The corrected applicable selection passed 15/15, and the six behavioral input
checks independently test the repaired route. No tracked production code changed,
so no new full build is claimed.

All history, fault, ACK, identity, empty/rest, readiness, native phase, first
allowance 113, 540-second construction anchor and finite budgets remain unchanged.
The Medium/comic-cancel/cinematic helpers remain byte-identical. No construction
anchor was created. No movement or fire occurred.

Evidence includes the exact checkout SHA, relevant binary diff, new-file patches,
command receipts, test results and a SHA-256 seal. Publication outcome is recorded
in the run handoff. The retained box `bx_dmq33y4w` was left RUNNING (API state
idle, healthy/hydrated), expiry 2026-11-04T10:27:13.933Z. Shutdown owner and
custody return to the coordinator. No lifecycle, allocation, source-box access,
local heavy browser, worker, successor, Heroes II or deployment occurred.
The next attempt needs an authorized runtime/deadline combination satisfying
the existing launch and recovery guards before fresh visual review can proceed.
