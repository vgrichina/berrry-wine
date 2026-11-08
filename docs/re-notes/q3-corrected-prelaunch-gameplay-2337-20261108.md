# Q3 corrected prelaunch and visible menu progress — 2026-11-08

One fresh original reached the Quake III main menu and the **Q3DM1: Arena Gate**
level-selection screen. The reviewed screenshots are retained in
`scratch/runs/20261108-q3-corrected-prelaunch-gameplay-2337/` as
`startup-review.png`, `singleplayer-review.png`, and `enter-menu-review.png`;
their original downloads were stored as gzip first. Movement, firing, torch,
in-world playability and death status are **UNVERIFIED**. No second original,
replay, game/backend/configuration/cap/clock change or agent launch occurred.

Offline controls found and reproduced a substantive diagnostic defect:
`q3-execution-boundary.cjs` subtracted entry/exit marker clocks even when their
execution-context IDs differed. It now requires one positive integer context
ID, finite nonnegative ordered timestamps, and a nonduplicated entry/exit order.
Invalid pairs retain their observations and report a concrete unavailable reason
and null duration. A CDP response remains independent. The composition's exact
provider pin was updated. Published code commit:
`7227918eb` (actual production-expression wrapper negatives, composition compile
and locked build PASS). The new controls use local protocol marker delivery,
not a browser, game or GPU fixture. Accepted 2248/2305/2332 controls are reused
by PATH/SHA references, without identical native reruns.

The actual published `tools/q3-native-prelaunch.py --check-only` was executed
locally before allocation. Its first full graph correctly refused duplicate
providers: local `/binaries` is a symlink to `/test/binaries`, whereas earlier
remote uploads had made both aliases separate files. The corrected run input
pins the 913 canonical providers once; the retained static server already
rewrites `/binaries/` to `/test/binaries/`. The barrier itself is unchanged.
The corrected actual local check bound the runtime imports and passed without
an original claim. The remote destination was different and fresh; its final
full provider barrier preceded the sole claim and native parent. Neither the
old launch-code.py nor the invalid module-name import was executed.

SuperTux2330's explicit archived/drained release at 23:37:31Z preceded allocation.
A durable UUID, immutable 25-minute deadline, finite TTL and observable independent
watchdog were recorded before creating `bx_bfn5frew`. The browser retained its
480-second ceiling and the existing supervisor, composition-then-execution
preload order, 20-second work allowance, and 30-second close cap. The executing
CPU and render-worker module SHA is
`4b45bda53a90b665896cf3b85d9a157b7c3703563c88b6666e4ee2e4b346bcc3`.
The provider source base is recorded in the manifest plus small owned patches;
no peer WIP, source archive, repeated media or module copy was staged.

Actual console evidence records `Q3_DIAGNOSTICS_ARMED` with
`beforeHostImports:true`. Actual render-worker observations report WebGL 1.0,
ANGLE with Intel/Mesa, an owning `api:gl/backend:webgl` endpoint, and zero
software batches in the captured snapshots. These are observations, not GPU
completion, device-performance or successful guest-input inferences. The GL
partial explicitly remains UNKNOWN: its bounded ring overwrote records.
PAGE, RENDER, WORKER and CDP observations remain separate; marker intervals are
only within a validated execution context. No cross-clock subtraction is used.

Three bounded reviewed inputs were submitted: one 500ms menu click, a 500ms
Enter that led to the captured level-selection screen, and a 500ms Enter on
the selected level. The click has trusted DOM DOWN/UP and CDP completion but
no claimed guest effect. Both key holds have independent UP attempts, actual
UP completion and settled release promises in the unique run's compressed
physical-completion telemetry. These host receipts do not prove DirectInput
polls or simulation steps. Commands 0 and 1 received actual ACKs.

Command 2 (`level_select`) hit its unchanged work deadline at
**23:44:57.824Z** and received **no ACK**. At that instant the Node trace has
`Page.captureScreenshot` request 345 pending for 16,726ms. Separate passive page
evaluations 346/347 had returned; the last PAGE/WORKER/RENDER owner reads before
the screenshot also returned. The screenshot later reached its own CDP deadline
and remained UNKNOWN. The partial `level-select-state.json` is not a screenshot
or successful command. No further gameplay input or capture was requested.
This distinguishes observed boundaries without assigning GPU/driver/guest cause.

Automatic first-failure close produced an actual Browser.close ACK, Chrome exit0
without signals, normal:true and drained:true in 13,648ms. The native command,
runtime parent and outer launch exited1; this failure is preserved. Final custody
had 332 owned tasks, 332 actual reaps and 3,316 journal events, with each
before-reap PID/start witness checked. Actual parent wait and stdout EOF,
closed ports45445/37763, absent profile and writer lock, empty runtime FD holders
and a free runtime lock were verified before normal stop. Untraced clone flags
remain unaudited and nonleader completeness UNKNOWN; these final observations
do not repair or qualify historical runs.

All 81 remote regular files (78 unique contents) were inventoried and recovered
or matched to an existing retained gzip artifact before stop. Stored/original
SHA-256, sizes and gzip CRC were independently reread. An initial recovery
assertion correctly rejected using an equivalent decompressed gzip with different
stored bytes; exact remote gzip members were then retained and checked. Initial
pre-ACK screenshot fetches returned404 and are preserved as orchestration errors;
they sent no guest/CDP request and did not replay a command. The completed
`enter-menu` capture was subsequently retrieved and reviewed.

`bx_bfn5frew` is **archived**, stopped at **23:46:39.017Z**.
Stop `stop_4a533be78017c274` completed at **23:46:39.039Z**,
`forced:false,error:null`. Final archiveAfter:null; expiresAt:NOT RETURNED.
Initial archiveAfter was `2026-11-09T00:06:02.128Z`, TTL1499s. The independent
watchdog and its same-shell EXIT wait completed with status0 and EOF; the outer
launch and every owned command child were actually awaited. Board-watch wait
and exhaustive local inventory are sealed in the run. Free disk samples exceeded
1,500,000,000 bytes; no continuous-floor or RAM claim is made.

Next: investigate the actual screenshot request's missing completion using these
retained independent boundaries before a separately authorized fresh gameplay
attempt. This single task stops with the diagnostic implementation published,
visible menu/level-selection progress, an explicit gameplay limit and an archived
box receipt.
