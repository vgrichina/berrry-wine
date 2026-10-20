# Endpoint regression fixture closure — 2026-10-20

**ACCEPT_SOURCE_FIXTURE_CLOSURE.** The complete requested source acceptance
suite passes, including the formerly blocked compiled process regression.
No production defect was found. Only two regression fixture files and this
review/test pair change; production and main remain unchanged.

The supplied commit `1e31aed6e412219bda266befbdc12c6b7e1f583f` was available
in the supplied isolated repository. It includes real-wire fixture correction
`2879625917f538b121fd5d55e7f254764b39e534` and assembled prerequisite
`f2afd75169dd898f0dd6001440f76af8f7773f8b`, whose tree is exactly
`7f31dd6f5970fb0b0b58325bf20e3624f4006401`. No prerequisite was reconstructed
from a different production revision.

## Dependency audit and repair

The pre-edit audit is recorded in `audit.json`. The predecessor loads
`process-alias-boundary-fix-20261020.js`, whose regression replay loads
`process-alias-correct-port-20261020.js`. That nested suite also extracts the
CLI process controller/event callbacks, child-process-object controller
fixture, host-import fallback, thread waits and process API WAT branches.
It reads the historical four-file WATX compiler and pipe helpers from
`a54049d1`; the boundary suite compiles complete WaitForSingleObject/Ex
functions. Independent/submitted/lifecycle suites use complete production
wire modules, host spawn/controller, shell launch and lifecycle callbacks,
host methods and waits. All transitive source inputs are sealed by the new
runner, including historical comparisons and baseline controls.

The nested callback fixture used the obsolete `(child)` signature and
`const ok = shell.launchVfsExe` end marker. It now extracts the complete
`(child, outcome)` callback through its closing declaration, ending before
`rec.object.complete = onExit`. The launch `let ok`/`try` block lies outside
that function. No regex skips a branch and no production text is rewritten.
The predecessor's runtime signature-replacement adapter is removed.

The callback's `childWire` free variable now receives a real endpoint from
the complete production `LoopbackSegment`. The caller's EOF observation
delegates to real `peerGone`, preserving the original merge/EOF ordering,
close-before-callback and exit259 assertions. Added checks observe queued
frame disposal, callback release, exact surviving endpoint identities,
one real GONE frame, later sibling traffic and closed-sender refusal.
The initial new array comparison encountered different VM array prototypes;
explicit length and element identity checks preserve its exact membership
expectation. This fixture-only attempt is retained in the evidence.

All original assertions remain. The predecessor's existing exclusion of
the historical DXSETUP known-defect observation remains unchanged; its
17-group positive acceptance and old-shell rejecting control replace that
observation. Existing explicit environment fixtures and trapped unrelated
WAT branches remain unchanged. The repaired callback is a complete function;
the inherited process-only WAT prefixes are still deliberately limited.

## Acceptance

Run at the isolated repository root:

```sh
SOURCE_REV=HEAD node docs/reviews/shell-endpoint-regression-closure-20261020.js
```

The runner verifies checkout production against exact Git blobs, seals
fixtures/historical dependencies, records child commands/output/status,
requires control failures at behavioral assertions, and verifies inputs
remain unchanged.

- Predecessor: 17 groups.
- Compiled regression: 13 groups, plus its nested 17-group replay and eight
  nested rejecting controls; three additional boundary mutation controls.
- Nested standalone replay: 17 groups with the same eight internal controls.
- Independent endpoint acceptance: 13 groups, 216 retirements and 180009
  later frames with live siblings.
- Submitted endpoint suite: 17 groups.
- Real-wire fixture lifecycle: four modes.
- Fourteen external rejecting invocations: lifecycle retained-child,
  predecessor old-shell baseline, independent baseline and three mutations,
  submitted baseline and six mutations, and the repaired nested callback
  with exactly one `childWire.close()` removed.
- JavaScript syntax checks and `git diff --check` pass.

Inherited regression output still names its historical candidate constant;
that label is not the tested source revision. The closure runner's exact
blob mapping and seals identify the actual inputs. Full logs and input seals
are in `tests.json` and `source-seals.json`.

## Recovery and limits

Evidence directory:
`scratch/runs/20261020-shell-endpoint-regression-closure-oct20/`.
`receipt.json` records the final local commit and branch.
`change.patch` preserves this task; `candidate.patch` preserves the cumulative
candidate relative to assembled main `f3698d8827aa048af14e0f0cbaa733bb96801949`.
`validation.json`, `preserved.json`, `setup.json`, `audit.json`,
`committed-inputs.json` and `SHA256SUMS.json` record recovery and provenance.

Fresh exact sparse patterns were installed before checkout, using read-only
flattened supplied alternates. Shared and supplied HEAD/index/config are
unchanged; old WIP was never edited. Writes were gated at available space
at least 2277507072 bytes, conservatively reserving the entire 8 MiB cap:
2210398208 + 33554432 + 25165824 + 8388608. The evidence and isolated
repository remain below the cap.

Publication remains blocked by the already reported missing HTTPS
credentials and configured SSH destination's host-key verification failure.
No auth/trust changes, rerouting or publication retry was performed.
**Local commit and patches only: no remote backup.**

This acceptance covers source fixtures, full production wire queues and
small compiled process/wait slices. It does not qualify a full build, guest
pipe reads, Worker IPC, browser, game, heap or concurrent runtime. No Boat,
runtime403 retry, full build, browser, public deployment, Claude, laptop,
worker/refill or main integration action was taken. This bounded task ends
with fixture acceptance; integration remains coordinator-owned.
