# Darkstone kernel custody integrated, 2026-11-08

Integrated the accepted Recoil fork-event supervisor into the actual Darkstone
startup/custodian/drain path and repaired a reproduced clean-bootstrap failure.
Also repaired a newly reported stop-peek race before publishing the supervisor.
The launch-specific independent watchdog is wired, observed and drained.
This completes the task's substantive integration-repair condition. No fresh
box, Chrome or original game was launched; the helmet checkpoint is unchanged.

Evidence: `scratch/runs/20261108-darkstone-custody-ready/` (R).
Predecessors: [normal driver and reaper](darkstone-driver-closure-20261108.md),
`34c92d72c`; [accepted Recoil kernel supervisor](recoil-software-utf8-20261108.md).

## Actual startup and custody

[`tools/native_kernel_custody.py`](../../tools/native_kernel_custody.py) promotes
the accepted Recoil supervisor without replacing its fork/vfork/clone barriers,
parked initial-stop handling, durable registration, EXITKILL or WNOWAIT terminal
handling. Its deadlines now come from the preallocation lifecycle descriptor.
It records the supervisor's own start identity as well as every traced task.
The accepted 197-task result and 56 artifact hashes were independently reread;
the unchanged 50-task/Chrome controls were not rerun.

R/start-custody.py uploads and starts this supervisor **before** the actual
custodian acquires the remote lock and awaits provision/queue. The custodian
keeps its existing WNOWAIT reaper; `tools/native_custody_reaper.py` is byte-for-byte
unchanged from `34c92d72c`. Bootstrap readiness requires the traced custodian PID,
outer supervisor PID/start and immutable deadlines to agree. The remote runtime
lock remains inside the custodian from startup through runtime drain.

The first clean-bootstrap integration test reproduced a real missing dependency:
the inherited startup uploaded `reap-owned.py` before provisioning, but omitted
the generic module it imports. The child failed with
`ModuleNotFoundError: native_custody_reaper` before custody readiness. Retained:
R/bootstrap-before.log and R/bootstrap-custody.stdout. The corrected bootstrap
hash-checks **all five** Python inputs before its first upload, transfers both
generic tools, joins the transfers, then starts the supervisor. A changed reaper
pin refuses with **zero uploads and zero starts**.

R/test-startup-integration.py executes the actual startup, supervisor, custodian
and reaper wrapper in a small isolated fixture. A forked intermediate reaps its
own immediate child before a sampled census can discover it. The outer journal
retains all three traced tasks, their registration and durable pre-reap records;
the inner reaper independently retains its before-reap/reaped pair. All three
tasks and the supervisor's exact identity are independently absent after drain.
The fixture lock releases. This tests the new integration without game media,
Chrome or an additional unchanged kernel stress fixture.

## New stop-peek race repaired

During this work, the Recoil worker reported an actual inherited-supervisor
failure: `waitid(WNOWAIT)` observed a stop but the following
`waitpid(WNOHANG)` returned zero. Its first actual failure remains in that worker's
`watchdog-kernel/custody.ndjson` and `watchdog-test.log`; R/stop-race-validation.json
records their independent hashes. Those files and processes were not modified.

The promoted tool now treats a nonterminal peek followed by zero as a superseded
stop, journals it and peeks again. It does not release the task on that path.
Every nonterminal consume also has a durable identity receipt in case a signal
changes its next status to terminal. A zero consume after a terminal peek still
fails closed. The focused regression uses a real TRACEME child and injects that
single zero result without consuming its pending stop; it proves the retry
precedes barrier release and the task is registered, reaped and absent. A second
controlled kernel regression forces a child's autoattach stop before its parent
fork event, then injects zero: the child stays parked through retry until its
lineage is durably supplied. The real
kernel journal is retained in R/stop-race/. No additional Chrome run was made.

Scope stays explicit: this is recorded kernel ptrace lineage, **not** a syscall
audit of adversarial `CLONE_UNTRACED` flags or reconstruction of earlier history.
The accepted unsupported nonleader-exec transition still refuses. Inner sampling
is retained for operational drain checks; it supplies no exhaustive history claim.

## Watchdog, provision and checkpoint

R/arm-watchdog.py starts the independent local normal-stop/watchdog supervisor
before allocation. The launch gate checks exact PID/start identities and fresh
preallocation heartbeats. The existing UUID-idempotent allocation freezes the
23-minute browser, 25-minute independent normal-API-stop and 26-minute expiry
deadlines before create. The remote kernel supervisor reads those same fixed
deadlines. R/launch-watchdog-armed.json records the actual observer identities.
With no allocation, explicit cancellation ends both observers at exit0 and leaves
the supervisor empty; all three exact identities are independently absent.
The local runtime lock was never acquired; the test uses only its fixture lock.

The actual normal provisioner is exercised with a recording transport: **547
exact providers, 550 completed mock uploads, then publication**. The production
content barrier remains required before queue creation and before parent
consumption. The corrected exact-call/nested-target closure is unchanged.
The runtime provider remains `90c1fcfee91c4680877083e80498afcb73c9384d`, with ignored
module `6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
Seven accepted controls, hover evidence and the 11 barrier tests were independently
hash-checked and reused without rerunning their fixtures.

The recovery descriptor is Level One's `new-save-recovery.json`; its selected
bytes live under `final-recovery/` (there is no descriptor inside that directory).
That exact source pair and both staged copies were independently verified unchanged:

| Native file | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,204 | `70fcfbe302a9ff1f1b7452223e67e800371086812d679ba04c03d4adffca036a` |
| `game641d_6af08808.sav` | 3,204,341 | `a4ecb215f5ffab7524cc0524c419c46498eb7ef14a0e3f404c880f72a769f45d` |

The HTTP manifest was derived directly from actual `provision.bytes` before any
allocation: 1,238 bytes, SHA-256
`a614227784a5b50bbeda23103482c6143296434a7be9ec5fad2600c0f933d5f3`.
An actual local HTTP response from the production handler matches it exactly.
Production loadFiles, VFS and native preview were not reached. No new PNG,
encounter, dungeon consequence or save is claimed. The predecessor baseline
remains 9+0, LIFE19/35, MANA25, Gold1532, Food49, AC12, helmet/red vial,
inventory closed.

## Validation and recovery

Four focused tool tests pass: two deadline refusals before fork/subreaper and
two stop-peek regressions. Two actual-startup integration tests pass, covering
clean bootstrap/nested custody/drain and changed-bootstrap zero-side-effect
refusal. Final `flock /tmp/wine-build.lock bash tools/build.sh` passes. Relevant
helper syntax, physical closure, all selected provider bytes, source/staged save
hashes, accepted control hashes and owned evidence are independently checked.

Initial failures remain retained, including the test harness's first temporary
upload-path mismatch. The original failed bootstrap did not retain its initial
PID/start; this is explicit in R/local-final-drain.json. A final independent
process/FD scan finds no reference to any owned bootstrap fixture. Final successful
custody and watchdog runs retain exact PID/start identities and absence checks.

R/source-head.txt, relevant binary diff, small owned tool/harness patches and
existing provider/media paths with hashes preserve recovery. No source archive,
repeated media bundle, peer WIP execution, public deployment, old-box resume,
deletion, guest private write, config/clock/seed change or subworker occurred.
New box ID/state/expiry/stop receipt: **N/A; no allocation or API stop needed**.

Next: use this integrated launch path for the separately executed helmet restore,
verify production loadFiles/VFS/native preview and buttons0/queueEMPTY, review
current pixels, identify native hover targets, then walk beyond the second opening.
Recover and independently hash an incremental native NewSave by minute10, with a
final save and cleanup before cap. Full27/parity/audio/FPS remain open.
