# Darkstone loot/save: disk floor interrupts final qualification

Loot pickup, a native inventory consequence and save/reload remain **unproved**.
The first concrete blocker was `/home` falling to **1,999,630,336 free bytes**
at **2026-11-07 11:35:43.300Z**, below this task's 2,000,000,000-byte floor.
The final local qualification browser was closed normally. **No box was
allocated and the original demo was never launched.** This is an environment
blocker, not a demonstrated emulator mismatch; no emulator repair was made.

Evidence is in ignored `scratch/runs/20261107-darkstone-loot-save/` (R).
The [November 4 combat result](darkstone-webgl-ardyl-combat-20261104.md)
already establishes Town → Ardyl, Victories 0 → 1 and survival at LIFE 20/35.
This investigation adds no original-game progress to that result.

## Completed prerequisite checks

R/preflight.cjs passed imports and fourteen actual trusted Chromium mouse/key
release controls using the SimGolf independent-release helper read-only. Each
release is armed before DOWN is invoked, including delayed/rejected/pending
DOWN, an earlier deadline and rejected/pending UP acknowledgements. Fault cases
remain UNKNOWN and are never replayed. The minimum sampled free disk during
this first control was 2,014,601,216 bytes. Its browser closed and profile was
removed.

The adapted R/browser.cjs then ran the production guest Worker and owning
`lib/d3d-render-worker.js` through the generated public-COM legacy fixture.
`qualification/startup-state.json` identifies endpoint 1 with
`{api:"legacy",backend:"webgl"}`, a WebGL 2 context and zero software draw
completions. Live debugger retrieval from guest and renderer recovered module
SHA-256 `e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`
(2,182,493 bytes). This is a generated fixture, not Darkstone gameplay.

Both fixture runs passed stale-capture refusal, all exact identity-field
negatives, actual replacement of the generated process wrapper, and wrong
executing-module refusal, with zero negative-case input effects. Both also
passed fourteen native Chromium independent-release controls through the
driver's actual CDP connection. R/ack-controls.json rejects wrong-ID, missing
and rejected ACKs and proves the closed queue cannot admit a retry.

The first fixture's full-page startup and after-click captures were personally
inspected: a generated-fixture caption and white canvas. Reviewed click and H
key commands and ordinary quit received three matching ACKs. Those captures
do not establish visible game rendering or a native gameplay consequence.
The initial fixture pin set still included unrelated SimGolf media; the final
proposed set removes it and contains 469 files, including the fifteen original
Darkstone paths. The final set was not remotely staged.

The browser's read-only `SystemInfo.getInfo` identifies **ANGLE SwiftShader**,
Google Vulkan Subzero, driver 5.0.0 in both fixture runs. The worker context's
Intel string therefore does not establish physical GPU execution.

## Blocker and closure

During `qualification-final`, the disk monitor recorded the floor crossing
and issued `Browser.close`; Chrome exited **0** at **11:35:43.629Z**, without
a termination signal. The final identity and release controls had completed,
but its startup capture and ordinary exact-ACK command sequence had not.
The pending observation subsequently timed out as `CDP UNKNOWN Runtime.evaluate`.
No input was replayed and no admission guard was relaxed. Final end-to-end
qualification is incomplete; allocation was not authorized by these results.

The task explicitly delegates normal shutdown after recovery, but no remote
lifecycle action was reached. Box ID, state, expiry, archived state and remote
module retrieval are not applicable; there is no box custody to hand back.
R/cleanup-local.json records local PID, port, profile, writer and input checks.

Recovery uses R/checkout-head.txt, the relevant tracked binary diff and
R/owned-harness.patch for new run helpers. Git holds the source; original media
is referenced by existing path, size and SHA-256. No source/media archive was
created. R/source-recovery.json and R/evidence-inventory.json record recovery
and artifact hashes; R/result.json is written last after publication.

Next: restore sustained free space above 2 GB, complete the final pinned
guest/legacy-WebGL qualification and ordinary ACK sequence, then allocate one
fresh UUID-idempotent 40-minute box with an immutable 25-minute browser
deadline. The original route must use fresh inspected captures to obtain
actual loot and demonstrate inventory or native save/reload consequences.
There is no FPS, audio, parity or full-game claim.
