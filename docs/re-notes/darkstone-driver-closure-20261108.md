# Darkstone normal driver closure and before-reap custody

Resolved the missing `generated.cjs` closure without changing the failclosed
import rules. The run now has a normal-only driver, with fixture routing,
fixture controls and their imports removed. Before allocation, actual provision
execution exposed a second closure defect and the custody review reproduced a
new census/reap race. Both received tested generic repairs. This ends on the
permitted new integration repair, with **no box or original game launched**.

Evidence is ignored `scratch/runs/20261108-darkstone-driver-closure/` (R).
Predecessors: [staged closure](darkstone-helmet-staged-20261108.md), `0099373b4`;
[startup barrier](darkstone-helmet-onward-20261108.md), `8d00bdda5`;
[earned helmet](darkstone-level-one-20261108.md), `f40be5335`.

## Physical closure and actual provision boundary

R/browser.cjs uses only the production Darkstone manifest handler and launch
route. No inactive fixture branch, missing fixture dependency or environment
exemption is needed. The current exact-call dependency checker remains intact.
R/prepare.py and R/owned-harness.patch recover the small run-specific changes.

`runtime_helper_closure.relocate()` previously flattened every required physical
target to its basename. A pinned `checkpoint/game641d_6af08808.sav` therefore
became a requirement for a nonexistent top-level SAV. Actual R/provision.py
refused before its first upload even though the initial explicit-helper check
passed. R/provision-normal-first-failure.log retains that failure. The generic
repair preserves each required target's full path relative to the helper
directory. The new nested-target regression also tests two distinct files with
the same basename and refuses removal of one exact target. It failed before the
repair and passes afterward; R/nested-before.log and R/nested-after.log.

The final frozen plan has **547 exact providers**, including the barrier,
checker and new reaper. Exact bytes are verified using historical Git sources
and the explicit ignored-provider recovery map, without restoring shared
binaries. Runtime remains `90c1fcfee91c4680877083e80498afcb73c9384d`, ignored module
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
R/cheap-exact-check.json records all providers and seven fallback recoveries.

R/provision-normal-check.py executes the **actual provisioner** with a recording
transport: the dependency/read/upload checks pass; **550 uploads** (547 providers,
manifest, simulated lifecycle descriptor and repeated exact barrier bootstrap)
finish before publication is invoked. This is an orchestration test, not a
remote receipt or remote staging claim. The simulated lifecycle descriptor was
removed. No launch request was created.

Serial provisioning, exact-generation receipt publication, pre-request require
and custodian pre-consumption require remain wired. The barrier is physically
pinned. Its source, tests and predecessor's **11 passing tests** were hash-checked
for reuse; no unchanged barrier/adversarial fixtures were rerun. Seven accepted
controls and hover evidence were also hash-checked without rerunning them.

## Newly reproduced custody race

The prior custodian censused `/proc`, called a WNOHANG reaper, then asserted that
every reaped child already appeared in its ownership table. A child born and
exited between census and reaping could be removed before its PID/start identity
was recorded, leaving the assertion to fail after irreversible consumption.
R/reproduce-reaper.py and R/reaper-before.json reproduce that interleaving with a
real child and the inherited reaper; `/proc/PID` is already absent at assertion.

[`tools/native_custody_reaper.py`](../../tools/native_custody_reaper.py) peeks with
`waitid(WEXITED|WNOHANG|WNOWAIT)`, reads the waitable child's actual PID/start/PPID,
registers it, fsyncs an append-only before-reap receipt, then consumes that exact
PID with `waitpid`. It durably records the consumed status as well. Identity,
registration or initial journal failure leaves the child waitable. It requires
a sole reaper. R/reap-owned.py physically imports this pinned generic tool, and
R/custody.py registers exact PID/start keys before reaping.

Eight focused kernel tests pass: missed-census ordering, registration/identity/
fsync failure, live-child nonblocking behavior, signal status, 32-child burst,
and real subreaper double-fork adoption. R/test-custody-integration.py executes
the actual custodian loop and provisioned wrapper with the missed-census
interleaving in an isolated fixture directory. Identity receipts precede reaping;
the ownership assertion passes, the child is absent and the fixture lock releases
after drain. R/custody-integration.json and integration receipts retain proof.
The locked full build passes; R/build.log.

Scope is explicit: this fixes waitable direct/adopted children missed by census.
It does not recover intermediate children already reaped by their own parent.
The inherited sampling custodian is not exhaustive kernel fork history. A future
runtime requiring that history must cross-apply kernel fork-event custody before
launch; this run makes no exhaustive remote descendant or remote drain claim.

## Checkpoint, HTTP and lifecycle

The source pair selected by Level 1's `new-save-recovery.json` and both staged
copies were verified again at completion and remain unchanged:

| Native file | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,204 | `70fcfbe302a9ff1f1b7452223e67e800371086812d679ba04c03d4adffca036a` |
| `game641d_6af08808.sav` | 3,204,341 | `a4ecb215f5ffab7524cc0524c419c46498eb7ef14a0e3f404c880f72a769f45d` |

The fresh manifest derives from actual `provision.bytes` before allocation:
**1,240 bytes**, SHA-256
`248e16c0197b1f38a6f329bef42d10bf007d622b914c32dc196a9edfc20ba140`.
An actual local HTTP response from the production manifest handler matched these
bytes and hash. Production loadFiles, VFS and native Load preview were not reached.
There is no current PNG, new gameplay, save, encounter or counter consequence.
The inherited baseline remains 9+0, LIFE 19/35, MANA 25/25, Gold 1532, Food 49,
AC 12, helmet and red vial, inventory closed; these are predecessor observations.

New box ID/state/expiry/stop receipt: **not applicable, no allocation**. No remote
watchdog or runtime needed arming. No Chrome, native input, runtime endpoint,
profile, writer or local wine-runtime.lock acquisition occurred. The lightweight
custody fixture used its own lock. Preexisting boxes were untouched. No old-box
resume, deletion, deployment, subworker, guest write, private handler, forced
scene, configuration, clock or seed change occurred.

R/source-head.txt, relevant owned binary diff, small owned tool/harness patches,
media path/hash references and provider recovery recipes preserve reproducibility;
no source archive, repeated media bundle or peer WIP was executed. First failures
remain retained. R/final-owned-evidence.json independently hashes owned evidence.

Next separately assigned work: use this normal driver and corrected nested
closure, finish kernel custody integration, prearm the independent watchdog, then
restore the exact helmet pair and review current pixels before walking through
the second opening. Native identification, low-health precautions, early save
and independent read-only recovery remain required. Full27/parity/audio/FPS open.
