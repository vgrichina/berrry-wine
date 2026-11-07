# Aranna movement: retained rejection is capture expiry

Causal player movement remains unverified. The retained world reacquisition
did **not** fail an ownership or input-mode check: command 49 was refused
because its reviewed capture was 17.931 seconds old. The unchanged harness
requires capture age at dispatch to be at most 15 seconds. No emulator or
harness implementation was changed, and no new box or original was launched.

Evidence: `scratch/runs/20261107-aranna-world-movement/` (R). This is a
read-only diagnosis of the released
[point-transform run](aranna-point-transform-20261107.md), not another gameplay
attempt. Its original response49 was personally inspected again: the hero and
green selection ring stand outside the snowy house, with portrait, compass,
and action HUD. It supplies no causal before/after player-action pair.

## Exact rejection and resolved helpers

R/diagnosis.json records execution of the retained contract against the exact
saved tickets and live snapshots. All 52 relevant source/helper pins match the
prior runtime manifest, including production browser/renderer input, the probe,
passive snapshot, mapper, adapter, and wrapper chains. This verifies these
diagnostic inputs, not complete runtime/media coverage for a new launch.

| Original command | Input | Capture age at dispatch | Recorded and replayed result |
| --- | --- | --- | --- |
| 46 | Canvas acquisition click | 15.890 s | Freshness refusal, zero effects |
| 47 | Canvas acquisition click | 11.406 s | Completed |
| 48 | Absolute move to (490,315) | 16.700 s | Freshness refusal, zero effects |
| 49 | Canvas acquisition click | 17.931 s | Freshness refusal, zero effects |

Command 49 reviewed response48, captured at 07:56:12.805Z. Its review was
written at 07:56:29.998Z; live validation occurred at 07:56:30.736Z. The
capture had therefore expired **before the review was written**. The error is
`BeforeInputRefusal: capture freshness exceeds 15 seconds`, from the current
run's contract wrapper before the inherited contract executes. The adapter
persists `effectsAttempted: 0`; command completion is `rejected-before-input`.

The actual adapter chain is point-transform → relative-move →
atomic-observation → native-point → setup-input. Each `retained.cjs` compiles
the inherited text with the current run's filename. Its `require('./contract.cjs')`
therefore resolves the point-transform freshness wrapper. That wrapper invokes
relative-move → atomic-observation → native-point → setup-input validation.
The driver follows the same inheritance chain; native-point replaces `toPage`
with the current run's `point-mapping.cjs`. No wrapper silently selects another
run's mapping or freshness policy.

Command 49's ticket and live snapshot have the same exact Worker target,
session, module, endpoint, app, geometry, protocol epoch 13, movement epoch 12,
and mode epoch 25. Both have null lock and positive relative intent. A pure
diagnostic call to the inherited contract without the outer freshness check
accepts those saved values. This is **not** permission to remove freshness;
the actual full contract correctly rejects them.

## Live recentring and real automatic lock expiry

Response49's lifecycle `now` is 1192487.840 ms. Its latest warp is at
1192305.780 ms, only 182.060 ms earlier; `recentringUntil` is 1194305.780 ms,
still 1817.940 ms ahead. The warp run is 65. The last automatic poll was false
at 1152228.260 ms, 40259.580 ms earlier. That old false poll does not determine
the result: the passive snapshot ORs it with **current** `recentringActive`.
The saved response44–49 snapshots all agree with that formula. The active
recentering signal is not demonstrated stale lifecycle state.

The existing passive trace establishes the earlier real lock transition.
Command 47 requested pointer lock with user activation at 07:55:50.621Z and
received a trusted lock-change event. At 07:55:52.982Z the host called
`exitPointerLock` from `releaseExpiredAutomaticLock`. At that moment recentring
had expired and the automatic capture hint was false. Response47 correctly
shows unlocked/stable absolute input. Before command48, repeated guest warps
resumed and its live state became unlocked/active-relative again. Even without
freshness, command48 fails `actual stable unlocked input required`.

This is a real runtime transition, not evidence of a changed owner or module.
The last attempt to review response49 subsequently failed in `runtime-gate.cjs`
with `kill ESRCH`: the supervisor had ended. It did not enqueue a fresh action.

## Checks, boundary, and lifecycle

`node scratch/runs/20261107-aranna-world-movement/diagnose.cjs` passes exact
receipt replay, 52 retained pin checks, current-recentring calculations, trace
transition assertions, and nine pure-contract negative checks: retired owner,
wrong module, expired capture, partial lock transition, changed protocol,
intervening movement, lost relative intent, changed exclusive mapping, and
changed app endpoint. UNKNOWN/partially dispatched receipts remain
nonrecoverable. Counterfactual timestamps were used only in cloned pure
function arguments; retained evidence was not edited or dispatched.

These are **not real-browser transition tests**. No corrected helper exists to
qualify, and no safe follow-on player action was demonstrated from the retained
expired captures and transient lock. Under the task's boundary/stop rule, this
worker stops at the exact demonstrated refusal rather than launching another
original on an unproved repair. A future attempt would need a personally
reviewed capture delivered inside 15 seconds, a completed ordinary acquisition
if still needed, then another freshly reviewed action under the resulting real
mode. Lock duration and resulting player displacement would still need testing;
neither is established by the pure-contract acceptance or command47 ACK.

No journal was reset. Global serials 8257/8359 already exceed the target-proof
limit of 8192; the retained target-click path remains unavailable under its
unchanged quota. The acquisition path does not consume that proof, and its
pure validation acceptance must not be read as fresh target-proof coverage.
The prior resource broker overflow remains: no complete post-overflow resource
coverage, FPS, audio, or full27 claim is made. There is no demonstrated CPU,
Win32, or memory mismatch and no production repair/build claim.

Inherited actual runtime identity remains module SHA-256
`88ff2708a2dec89af430fac2ba778f39857c2716e851299c3ecbfa62fd5e7d1f`,
2,221,881 bytes, slot 0 / endpoint 1, legacy API / requested WebGL / WebGL 2 /
ANGLE Mesa Intel UHD Graphics 620. Its runtime manifest names inherited commit
`d14a8e882f9cee83408ba67587591f90bd921957`; current main is not substituted
for that runtime identity.

The prior worker explicitly released ownership after delegated normal shutdown.
Its retained terminal census has all 13 recorded PIDs absent, three ports
closed, temporary profile absent, and all four locks free. A new read-only
`boat --no-update --json info bx_c9bc8zsn` reports **stopped**, completed stop,
`forced:false`, stopped at 07:59:13.590Z, and `archiveAfter:null`. The prior API
called this state archived; the current CLI spelling is retained separately.
The box was neither resumed nor stopped again. This worker owns no test box,
runtime process, browser profile, port, or runtime lock to hand back.

Git SHA, relevant working-tree diff, owned diagnostic patch, exact evidence
hashes, validation, publication, free disk, and final boundary are recorded in
R. No source tree or media archive was created. `result.json` is written last.
