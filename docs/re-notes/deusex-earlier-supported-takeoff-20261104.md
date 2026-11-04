# Deus Ex: earlier takeoff blocked by preparation timing guard

The Z96 wood remains **unreached**, and the earlier takeoff is **untested**.
The fourth released Left preparation pulse requested40ms but measured51ms,
exceeding the inherited helper's50ms guard. The helper released the key,
recorded the first failure and closed Chrome normally. The safe preparation
was not reproduced completely. No forward run, Space, jump, retry, second
reload or new native save followed. This is a helper timing failure, not an
observed support loss or a failed jump.

Evidence: `scratch/runs/20261104-deusex-earlier-supported-takeoff/`.
Prior supported-short-runup note was read at
`78762ed1467f05751264f50f378756b7934fffd3`, together with the native-speed
and aligned-jump notes. No production code, guest state, executable, config
or check was edited; no build/rebuild or lifecycle operation ran.

## Runtime and immutable input

Assigned bx_a9uvp4n2 was checked and ACKed before use: RUNNING/APIidle,
healthok, hydratedtrue, expiry2026-11-04T03:35:26.275Z,
shutdownOwner=coordinator. The installed CLI is `boat`; the failed initial
`boat-dev` lookup is preserved in first-preflight-failure.json.

The prepared snapshot contained an older checkpoint. Its existing evidence
was preserved under `earlier-takeoff-inherited-evidence` on the assigned box,
and a separate evidence directory was prepared. Only the immutable count14
checkpoint was staged as the new input; earlier count15 lower wood was not
used. Existing media were referenced through the pinned runtime, without
copies or source archives.

Input remains
`scratch/runs/20261104-deusex-small0-reload-onward/recovered/native-save-export/`:

| File | SHA256 |
| --- | --- |
| saveinfo.dxs | `4cfa57f28a079c1b0bcc0f4a002b24f845005122adf3d5ed39f04cd2fc2ba2a6` |
| 00_training.dxs | `ab8b1fa27157a6dc6f6e9a000acab0082f02be3c7478a7f982c27eab2759a730` |

Historical source remains `a504fa248caaecbbb042b65e9ae5384a340ade26` plus
the authoritative nine-file historical-source.patch SHA256
`9415aea6dbced13143b9dcdceb9d2d3594219a467263f7b3cf2bb623da36c796`.
Actual canonical module is1,898,260 bytes, SHA256
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`;
the module was recovered and verified. **Historical second module ABSENT**;
no substitution. Original SoftDrv and three original guest workers retained.
All453 provision pins, including the staged checkpoint pair, match after use.
Current Git SHA and relevant binary diff are recorded in source-record.json
and current-relevant-tracked.patch; the new note has its own retained patch.

Before Chrome, all seven JS helpers passed syntax checks, actual Puppeteer
resolved, Chrome existed, and the exporter mock wrote two byte-exact hashed
files. Those mock outputs are explicitly separate from real native saves.
The inherited single-jump helper was prepared for145ms instead of180ms,
with Physics1/BaseSmall0 and at least8 units radial margin immediately before
Space in the same helper. It was never invoked, so neither that timing nor
the guard constitutes a measured takeoff result.

## Exact load and first failure

Inspected02-count14-dialog.png shows count14/time01:17:23. Ordinary Enter
restores `(7026.704590,-1707.887939,109.602844)`, yaw250640, Physics1,
height43, velocity0 and reflected BaseCrateUnbreakableSmall0. The restored
capture still displays LOADING, despite the valid native actor state; this
run has no inspected gameplay capture after that point.

The first requested40ms Left pulse measured45ms and moved to
`(7019.030762,-1711.765381,109.602844)`. Released, settled reflection confirms
Physics1/BaseSmall0 and zero velocity, with radial margin6.859491. The next
two Left pulses measured46ms each and produced no sampled displacement;
their settled Base/Physics/velocity checks also pass. These observations do
not establish why the pulses produced different movement.

The fourth Left pulse measured51ms including input dispatch; its trusted
browser keydown-to-keyup duration was47ms. The inherited helper guards its
entire measured operation, so it reports `pulse duration over 50ms` before
the post-pulse settle/check. Request7 is terminal with completed0/requested1
and that error; requests1–6 completed normally. No further request was sent.
The error and stack are retained in recovered/first-failure.json.

All796 recorded basic actor samples are Physics1; none establishes a fall.
The final retained sample, just before keyup, is
`(7012.119629,-1715.257568,109.602844)` with horizontal velocity
`(-78.539032,-39.685684)`. There is no settled post-failure Base reading,
so no stable final footing or recovered setup is claimed. No Down preparation
or bearing adjustment occurred. The planned145ms runup and single jump
remain unexecuted. The prior180ms failure was not repeated.

## Verification and handoff

All47 unique recovered files and the canonical module match their full hashes.
Seven sequential requests were acknowledged, maximum6 steps; the seventh
preserves the timing failure. All18 trusted browser input events balance,
including four Left pulses; no ArrowUp or Space event exists. Immutable
count14 bytes remain unchanged. No real native save/export was requested:
the target was not reached and the browser had already closed on the guard.

Cleanup completed02:59:02.185Z, before03:25Z: Chrome9236/driver9228 absent,
port8123closed and held keys empty. The single browser segment stayed within
12minutes. Box remains RUNNING/APIidle, healthy and hydrated with the same
expiry; ownership returns to the coordinator for shutdown. No stop, delete,
resume or allocation occurred.

No floor/lower-wood progress, FPS, full-game, guest-exit or fresh-load claim.
This single task stops. Any separately authorized continuation must address
the preparation timing/visual-readiness dependency while retaining measured,
balanced native input and support checks; this worker launches no successor.
