# Original LBreakout initialization cost and board readiness

Evidence: `scratch/runs/20261110-lbreakout-init-cost-cause-0142/` (ignored).
Initial repair shipped as `5cbb2a8f4` on main before the sole original run.
Accepted fixture `4fc62b7d7` was independently hash-checked and reused unchanged.

## Cause and repair

The previous two-second observation entered original local-init after 1281ms,
leaving 719ms. Its one-address trace still globally disabled transfer chaining
and the micro-op tier. Filtering callbacks does not remove that execution cost.
The generated level-start observer now uses the existing compiled breakpoint
and target-aware chain exit. It follows original entry/return boundaries without
guest writes, artificial handler calls, module edits, or provider changes.
Moving the target retires the old breakpoint's skip-once block first. The
unarmed run and metric functions retain native function identity.

Completion polling also repeatedly fetched and hashed the entire 2,186,068-byte
Wasm through CDP. The consumer now validates bytes before arming and checks the
immutable owning instance, endpoint, command, and DLL binding on each poll.
Full byte validation still brackets the first capture. This removes downloads
from the unchanged two-second completion/presentation budget.

## Offline evidence

`tools/lbreakout-init-cost.test.cjs` executes actual original EXE, SDL and CRT
instructions through the actual compiled module. Alternating matched samples
cover original background tiling/software blits and all 25 original levels
parsed through original fopen/fgets. Identical complete pixel outputs, 125
precise hits, four moving boundaries, debugger conflicts, native restoration,
and the full generated preload all pass.

Five background-work pairs (25 calls/sample) had median milliseconds:
disabled 58.38, trace 62.01, target 55.96. Three complete-levelset pairs:
disabled 11.62, trace 14.38, target 11.04. Trace enabled the global tier guard
even with zero callbacks; disabled/target left it zero. These isolated workloads
demonstrate instrumentation cost without claiming to reproduce every browser
service or all initialization. Retained logs cannot exclude earlier Worker RPC
stalls; no completed HTTP request followed the earlier arm.

Actual generated-consumer controls exercise success, wrong command/module
binding, incomplete work, failure, presentation refusal, and foreign immutable
instance. Negatives withhold the first image and prohibit subsequent input,
capture, and quit. The previous consumer made three full-module transfers during
completion; the initial repair made one, and the final offline repair makes zero.
Byte validation before arming and around capture remains enforced. Ten inspection
tests include native unarmed identity and emitted-function presentation behavior.
Level-start, pause, and original SDL input tests pass; locked builds pass.

## Sole live result and terminal boundary

Every dependent image was individually model-reviewed. Native original menu
navigation reached the real Late At Night board, level 1/25, Michael score 0,
bricks, paddle, attached ball, and lives visible. From Enter arm: local-init
entry +505ms, return +829ms (324ms inside), game-run +830ms, fade return and
first display completed +1210ms. The board image passed the presentation gate.

The next ordinary P command reached the original pause handler, original pause
display return, state 20, handler return, and released P. Guest completion took
1921ms. The remaining full-module owner revalidation exhausted the presentation
budget and failed at the original deadline before any pause image. Immediate
owning cancellation followed. There was no later protocol, input, capture,
retry, quit, extension, or second box. Visible pause, score progress and clear
are unconfirmed. This is not a first-level-clear acceptance.

That terminal evidence caused the final offline removal of the redundant
pre-presentation module download. Capture already validates the full bytes
before returning an image. The final change is tested offline only; this task's
one-live-attempt authorization is exhausted. Pause's remaining trace cost may
still constrain the two-second bound; no new live success is claimed.

## Lifecycle and next step

Only new box `bx_chfab9w3`, immutable UUID
`42b0055d-0daa-4cdb-8d21-182048b42b2c`, was touched. The independent watchdog
was armed before allocation with deadline `2026-11-10T02:20:26.691281Z`;
initial API expiry was `2026-11-10T02:20:26.467Z`. All 115 artifact references
(100 unique) were recovered and independently reread for SHA/size; seven PNGs
passed CRC/decompression, and no gzip artifact was present. Actual launcher
wait and separate stdout/stderr EOF were verified before normal stop.

Exactly one delegated unforced stop, `stop_fb0a2cdd6cf8f5ac`, completed at
`2026-11-10T02:02:12.778Z`. Final state is archived, expiry null. The watchdog
was actually waited and reaped with exit 0 and separate EOF. Exact deadline,
retrieval, final API state and operation receipts are retained in the run.

Next work requires separate authorization for a fresh bounded original attempt
to review visible pause and then launch/score. No live continuation remains
authorized in this worker. Shared providers, Q3 and Nox were read-only.
