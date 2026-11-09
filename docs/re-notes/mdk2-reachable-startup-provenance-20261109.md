# MDK2 startup provenance: retained-driver validation blocked

No instrumentation change is published by this task. The required original
generated driver cannot be composed or tested in this checkout: all 111
distinct hash-pinned inputs in `CLOSURE` and `HELPERS` exported by
`tools/mdk2-construction-driver-integration.cjs` are absent. The existing passive
startup journal and admission guards remain unchanged.

Evidence is in `scratch/runs/20261109-mdk2-reachable-startup-provenance-1715/`.
`closure-audit.json` enumerates every missing path and its expected SHA-256,
records Git and available source/PE hashes, and reproduces the three failed
retained entry points. In particular:

| Required retained interface/input under `scratch/runs/` | Expected identity / failure |
| --- | --- |
| `20261104-mdk2-fresh-pending-scene/runtime-pins.json.gz` | Missing; decoded manifest SHA-256 must be `4a8bb12508a5f6b402880a3af9532e28ca4bd7fc18fb94bd0ccaf6c9c3ceb4ed` |
| `20261104-mdk2-fresh-pending-scene/browser-driver.cjs` | Missing; SHA-256 `4a888df46221def0396b2b6be5e52ff2423cdb26714de50127f36a807b04086c` |
| `20261104-mdk2-fresh-pending-scene/observe-browser.js` | Missing; SHA-256 `12cedfe958c4fe2acc11dfdaf4a7e06843d4826b1cc0bd0bcf92639a161e7f7a` |
| `20261104-mdk2-post-lua-native-boundary/main-state.cjs` | Missing; SHA-256 `a5e74ab20befce8196c654886b8597ed7da1cb5fddd22efada161e02a7822e32` |

`selectedRuntime()` and `pinnedRuntime()` fail opening the missing pin manifest;
`verifyClosure()` fails on missing
`20261104-mdk2-measured-escape-original/launch.cjs`. The focused integration
command fails before test discovery at its top-level `selectedRuntime()` call
(`startup-tests.log`); this is zero passing focused tests, not a test of the
proposed instrumentation. Git has no tracked files beneath the missing
fresh-pending-scene directory. This task did not reconstruct that executable
closure from synthetic fixtures or substitute today's runtime for it.

An initial diagnostic-only proposal was saved as
`unvalidated-instrumentation.patch`, then reverse-applied to the two owned
code/test files. Both match their pre-task Git content. The patch is not an
accepted implementation or runnable evidence: it proposed passive native
pending globals, candidate context within the existing journal record caps,
cumulative captured-work accounting and diagnostic-getter fault containment.
Its synthetic tests cannot establish generated-driver behavior while the
actual retained producer is absent. No speculative admission patch was made.

The [paired-original diagnosis](mdk2-reachable-checkpoint-cause-20261105.md),
[continuous-original report](mdk2-continuous-original-medium-20261105.md), and
[early-GC repair](mdk2-continuous-early-gc-repair-20261105.md) remain authoritative:
equal startup3584 host opportunities reached different PCs/stacks under adaptive
native budgets. `4641c7` remains unsupported. A stack sample never supplies
executed GC entry/return. This task read those reports; it did not rerun their
missing original evidence or infer the unknown paired budget sequences.

The remaining safety criterion is an actually reached, authenticated same-owner
native maintenance seam with the supported PC/caller/decoder context and valid
continuous relevant-call coverage proving no tracked call is pending, followed
by witnessed `443070` entry with `[ESP]=40218c` and its matching `40218c` return
at entryESP+4 in one uninterrupted observer lifetime. Passive reads of native
version/epoch/profile/reason/depth can describe diagnostics; zero depth/reason
alone cannot certify absence. Native `pending_context_status` and
`pending_context_coverage` may invalidate proof and must not be added as passive
journal reads. The existing admission proof remains separate.

Resume condition: restore and hash-verify the original retained manifest,
inventory, complete driver/helper closure and referenced exact module inputs;
then implement and exercise the actual generated driver with divergent budgets,
wrong owners, pending calls, bounded output and first-error tests. Do not hunt
past a failure, seed history, reset deadlines, alter CPU policy or widen limits.
No new original attempt is authorized by this note.

Validation: required locked build PASS (`build.log`); owned-path diff checks
PASS; focused suite BLOCKED as above. Git SHA plus small diffs are the recovery
record; no source/media/module archives or copies were created. No browser,
game, local Chrome, leased box, subagent or worker was run. Box ID/state/expiry
and stop receipt: not applicable; no box was created or changed.
