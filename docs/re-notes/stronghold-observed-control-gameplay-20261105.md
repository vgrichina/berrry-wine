# Stronghold observed controls: sole original, 2026-11-05

The sole original reached visible Deathmatch setup and stopped on the existing
`first unexpected natural scene: unknown` guard at step 10,944. Ordinary gameplay
is **not verified**. No second original, screenshot whitelist or guard correction
was attempted. The observed setup pixels do not establish native readiness.

This follows [the passive control-state implementation](stronghold-native-control-state-20261105.md)
and [fresh setup readiness requirements](stronghold-fresh-setup-readiness-20261105.md).
Evidence is local, ignored, under
`scratch/runs/20261105-stronghold-observed-control-gameplay/` (called E below).

## Actual evidence

The actual composed public entry launched the registered original demo once,
after ReturnFire0345 FINAL `69a5ea89d426b1b25552d1db1275e2746079aef7`
and MDK0405 FINAL `1774e61cffb5061a6d2b2ec3815846ac3f743a5a`, both
`runtime AND file RELEASE ALLBUILDSFINISHED`. Independent normal exact cleanup,
refused ports, absent profiles, no heavy processes and both free locks were
checked before shared edits/tests and again before the original. See
`release-gate.json`, `pre-original-cleanup.log`, `composition.json`,
`launch-identity.json`, `runtime-release.json` and `chrome-lifecycle.jsonl`.

I personally inspected all 27 captures before further commands or the final
claim. `personal-capture-inspections.jsonl` records observations and SHA-256.
The ordinary title Enter, Crusader menu and balanced Custom Game gesture were
reviewed at their fresh checkpoints; subsequent progress used only the existing
bounded arrival commands. Review receipts and completed step ACKs are distinct.

The last capture, `browser/route-native-boundary-10.png`, SHA-256
`e72390ba50ca34dca2cde420f1492ac9dfe8adeed2170fe42dd58561e793babd`,
shows Human / Lord Crusader, Deathmatch Game, a Crusader Demo map row, numbered
player circles and the sword background. It is setup, with no gameplay world.
The preceding step-10,688 capture contains only partially populated setup.
Command 15 failed at 04:59:12.267Z; no command 16 was submitted. The unchanged
scene guard remains closed; the new screenshot was not added to recognition.

`browser/preset-attachment-121.json` and `actual-evidence-summary.json` retain
140 native records, 125,223 bytes and 41,586,629 observed boundaries, ending
`command-failed`, native observer fault null. Epoch:
`BFA5223A38AF6218A7E749F876F72211/25BE8A0AB8F015D51358ACACAA4236B6`.
All three draw returns match their entry sequence and epoch:

| Entry → return | Fade entry → return | Direction entry → return | Suppression entry → return |
| --- | --- | --- | --- |
| 43 → 59 | 32 → 32 | -3 → -3 | 0 → 0 |
| 76 → 90 | 32 → 15 | -3 → -3 | 0 → 1 |
| 108 → 122 | 15 → 0 | -3 → 0 | 0 → 1 |

There is no observed unsuppressed fade-zero draw entry and return. Final native
pending is empty; that does not manufacture a fourth draw or complete the prior
run's pending draw. The prior run's artifacts and pending status are unchanged.

The trace distinguishes sampled press edges, updater entry/return, widget draw,
feedback and hover entry/return for numbered widgets 1–3. Their owner is 6893384,
descriptor 6006056; sampled widgets are unselected, hidden36/disabled38/hover32/
press34 are zero. Hover routine returns 477/478/479 are recorded values, not
proof of a user hover or preset activation. No preset activation, queue or
application event was observed. The updater returns alone do not prove an
application. Pending69165c remains zero in these samples. No preset gesture was
sent on this setup screen.

Final ACK record 138 acknowledges all 64 requested steps from 10,880 to 10,944,
Frozen, tickMs 16, input queue empty, active/last input null, button mask zero
and mouseButtons zero. Thus ACK/full-rest evidence exists independently of the
scene failure and independently of draw readiness.

`browser/host-presentation-12.json` contains 91 records: 41 host-present,
37 renderer, four upload, four fallback completion events and five capture
brackets. Ordinary repaint and owning-memory/window upload observations exist.
The retained link reports still have status unknown, empty relations and null
operation completion/fresh pixels. `operationRelation` is null,
`pixelsAccepted` and `readinessGranted` are false. No uniquely identified
ordinary host publication of a completed unsuppressed fade-zero draw is proven.

## Changes and validation

Only the local runtime contract and matching tests changed. Seven explicit
named amendments bind the published `f1d62b136` D3D7 sources/module pair,
published `89caed5d1` passive observers and this run's local contract. The other
historical rows remain exact; the immutable 2,429-row historical manifest and
all historical run artifacts remain unchanged. The contract names this
assignment, RF0345 then MDK0405 FINAL releases, dependency deadline 11:30Z,
host cutoff 11:57Z and final cleanup deadline 12:00Z. Existing relative browser
720s/cleanup 180s bounds are unchanged. These bindings authorize this run only.

No production observer, renderer, input, scheduling, guest clock or guest state
was changed. First-fault, full-rest, and 50M/360s/2,048-record/1MiB observer caps
remain unchanged. No guest writes, forced rendering, increased budgets or
blanket dependency rehash were used.

`validation.json` records these passing checks before the original:

- `node test/test-stronghold-local-runtime.js`: actual composed 2,429 FS and
  HTTP inputs, public/native spawn prohibited, zero Chrome, closed server and
  45 negative contracts.
- `node test/test-stronghold-owning-callback-observer.js --controls-only`:
  both shipped modules, all-page/register/command parity, 20 checkpoints and
  696 slices per arm, control negatives and host-link regressions.
- `node test/test-stronghold-native-preset-observer.js`: both modules pass;
  retained ordinary-untraced RPC page exception is not hidden.
- Run-specific actual entry/public negative checks: five and nine cases,
  respectively, with native/public spawn prohibited.
- `flock /tmp/wine-build.lock bash tools/build.sh`: pass, module pair unchanged.

The first controls test stopped on its stale expectation that the newly
authorized current binding must fail. Its failure log is preserved as
`owning-controls.log`. The test now verifies current named acceptance and
explicit immutable historical-manifest rejection; the focused rerun passed in
`owning-controls-repaired.log`. No original had run at that correction.

## Recovery, cleanup and remaining prerequisite

Git is the source archive. Pre-original source base was
`1774e61cffb5061a6d2b2ec3815846ac3f743a5a`; `relevant-uncommitted.patch`,
`small-run-inputs.patch`, `new-note.patch` and `source-recovery.json` preserve
the relevant binary diff and small new-file patches. No source snapshot,
archive or media/module copy was made. Existing inputs:

| Existing path | SHA-256 |
| --- | --- |
| `build/wine-assembly.wasm` | `3859c274df0233659eb10fe4d2784fff7d1553242b4ae2b3bf653e5d2ebdd95b` |
| `build/wine-assembly.compat.wasm` | `9f042b70d7e43d3947415e1de01e7a540b3c7f7fa6c7fbefabdbea17e9633e95` |
| `test/binaries/candidates/stronghold-crusader-demo/installed/App_Executables/Stronghold Crusader multiplayer demo.exe` | `9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f` |

Normal Browser.close produced Chrome PID 2008167/startTicks 190149476 exit 0,
signal null, at 04:59:12.391Z. Node 2008122 and flock parent 2008121 (both
startTicks 190149299) exited normally. `cleanup-verification.json` verifies
these exact processes absent, ports 40333/38323 refused, no profile users,
own profile removed and runtime lock free. `final-independent-cleanup.log`
adds the fresh predecessor/mock exact checks, no heavy work, both locks free
and disk above 1.5GB. Box ID/state/expiry: N/A, local execution; coordinator
retains shutdown ownership. No box was stopped, deleted or resumed.

The concrete blocker is the unchanged scene guard at naturally reached setup,
before an actual same-owner/epoch unsuppressed fade-zero draw return. Fresh
identified host publication and reviewed control/application/gameplay evidence
also remain absent. The screenshot does not justify bypassing that prerequisite.
This assignment ends with evidence and unknowns; no further original is
authorized or attempted here.
