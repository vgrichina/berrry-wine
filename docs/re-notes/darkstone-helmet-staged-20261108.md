# Darkstone helmet staging: missing-helper guard repair

Completed the permitted **first new tested generic integration repair before
allocation**. No box, Chrome, original game, native input, new save or dungeon
consequence was produced. The helmet-bearing checkpoint remains unchanged and
has still not been reloaded. Evidence is in ignored
`scratch/runs/20261108-darkstone-helmet-staged/` (R).

## New defect and repair

`tools/runtime_helper_closure.py` previously searched the whole CJS file for an
inactive conditional import. An inactive `process.env.FIXTURE?require(...)`
could therefore excuse **another unconditional import of the same absent
physical helper**, including the ternary's executed false branch. A logically
true OR condition could also be mistaken for an inactive environment guard.
This allowed an incomplete provision plan through the preallocation check.

The repair binds each exemption to its exact import occurrence and accepts only
a standalone simple environment ternary with an explicitly inactive environment.
Unsupported control-flow forms fail closed. It is deliberately a conservative
literal-import check, not a general JavaScript dependency parser.

- R/closure-before.log retains six incorrect acceptances reproduced against the
  old implementation. R/closure-after.log passes all **12 tests**, including
  nine new adversarial source forms covering import order, same-line imports,
  false branches, OR conditions, multiline expressions and misleading comments.
- R/provision-integration.py executes the **actual run-specific provision.py**
  with a recording transport. That script now checks the physical closure before
  opening its ledger or uploading. The old tool uploaded an incomplete plan and
  reached receipt publication. The repaired tool refused it with **zero uploads,
  zero publish calls and no ledger**. Explicitly inactive imports and present
  pinned imports passed. These are orchestration mocks, not remote execution.
- `flock /tmp/wine-build.lock bash tools/build.sh` passed; R/build.log.
  Existing ten closure tests remain covered. The accepted seven controls and
  native hover evidence were hash-checked for reuse, without rerunning fixtures.
  The unchanged barrier source/tests and its prior **11 passing tests** were
  verified against `8d00bdda5`; R/barrier-reuse.json.

## Prepared boundary and preserved checkpoint

The small owned harness carries the previous barrier integration: successful
uploads finish serially before content/hash receipt publication; queue creation
requires the exact receipt; the custodian requires it again before consuming the
request. The barrier itself is a physically pinned provider. Queue and provision
were never invoked against a remote box in this run. No claim of a newly exercised
remote lock or drain is made.

The fresh **541-provider** plan normalizes absolute and relative helper directory
arguments and binds the new physical upload targets. All exact provider bytes
were checked using pinned Git source and explicit ignored-module recovery;
R/cheap-exact-check.json. Runtime source remains
`90c1fcfee91c4680877083e80498afcb73c9384d`, with ignored module
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
No shared binary was restored or overwritten by provisioning.

The conservative closure **refuses the current driver** because its inactive
fixture branches reference unprovisioned `generated.cjs`. This refusal was
retained before allocation; it was not bypassed. A successor must use a normal
driver with its actual dependencies pinned, or prove a supported inactive branch.
The plan is not advertised as launch-ready.

The normal composed manifest was derived directly from actual `provision.bytes`
before allocation: **1,238 bytes**, SHA-256
`2e86b11e035e73263b1a54fd1c57e41c5c37f25317393a2b1b481f593aca3fa3`.
HTTP/loadFiles/VFS/native preview were not reached.

Both original final-recovery artifacts selected by the predecessor's
`new-save-recovery.json`, and the new staged copies, passed exact size/hash checks
before preparation and again at completion:

| Native file | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,204 | `70fcfbe302a9ff1f1b7452223e67e800371086812d679ba04c03d4adffca036a` |
| `game641d_6af08808.sav` | 3,204,341 | `a4ecb215f5ffab7524cc0524c419c46498eb7ef14a0e3f404c880f72a769f45d` |

Their exact source/native mapping is R/checkpoint-provenance.json. The inherited
baseline remains 9+0 victories, LIFE 19/35, MANA 25/25, Gold 1532, Food 49, AC 12,
helmet and red quickslot vial. These are predecessor observations, not new
measurements. No current-run PNG exists.

## Lifecycle and recovery

New box ID/state/expiry/stop receipt: **not applicable; no allocation**. No
watchdog, custodian, runtime endpoint, profile, writer, held input or billing
resource was created. Local wine-runtime.lock was never acquired. All preexisting
boxes were untouched. No remote lock coverage or process census is inferred from
prior evidence. No old-box resume, deletion, public deployment, worker spawning,
private handler, guest write, configuration, clock or seed change occurred.

R/source-head.txt records the exact starting checkout SHA. Relevant binary diff,
small owned input patches, media path/hash references and ignored-provider recovery
recipes are retained; no source archive or repeated media bundle was made. Earlier
preparation and test failures are retained in R/first-error.json and test logs.

Next separately assigned work: make the normal driver's physical closure pass,
then use the pinned startup barrier to restore this exact pair and continue past
the second opening with reviewed native hovers, early native New Save and unique
read-only recovery. Full27, parity, audio and FPS remain open. Single-task worker
stops after publication.
