# Darkstone parked exit-stop drain repaired, 2026-11-08

Repaired the retained kernel-custody drain defect without replaying the original.
A small real kernel thread/fork reproduction fails with the predecessor and
drains with the repair. The actual Darkstone bootstrap/custodian/reaper integration
passes, and the selected 548-provider generation preserves the current bounded
browser-endpoint wait. This meets the assigned substantive-repair stopping
condition; native helmet restoration and onward gameplay remain unperformed.

Evidence: `scratch/runs/20261108-darkstone-parked-exit/` (R). Predecessors:
[helmet startup](darkstone-helmet-native-20261108.md), `b3377657b`, and
[custody integration](darkstone-custody-ready-20261108.md), `0696e8112`.
R/source-head.txt records the exact starting checkout. Git plus R/owned-code.patch
and the small fixture inputs provide recovery; no source archive was created.

## Retained cause and repair

The unchanged retained journal registers Chrome thread 6624, start12915,
TGID6483, at sequence498. Its initial SIGSTOP is parked at500. At578 its
next status is PTRACE_EVENT_EXIT (`siStatus1541`); at579 the old supervisor
parks it again because its registration still awaits lineage. There is no
kernel clone receipt for6624 in that journal. Its leader reaches its own exit
stop at680–681. R/retained-cause.json records the source hash and selected rows.
The prior normal drain failure and supervisor EXITKILL failure retirement are
preserved in the predecessor; they are not relabeled successful normal drain.

The causal reproduction creates a forked process which creates one thread.
Only wait selection is controlled: statuses come from real TRACEME, WNOWAIT,
waitpid and GETEVENTMSG. Delivering SIGKILL to the creating thread group after
the child's initial stop is consumed supersedes the parent's pending clone
event. The unlinked child's next stop is EXIT. The predecessor then reaches its
immutable cleanup timeout. R/before-confirmed/ and its test log retain that
failure. This establishes the mechanism independently; the historical trace
does not contain GETEVENTMSG's exit message, so its exact value is not invented.

[`tools/native_kernel_custody.py`](../../tools/native_kernel_custody.py) now reads
the kernel exit message for an unlinked EXIT stop and requires SIGKILL. It fsyncs
an `unlinked-exit-retirement` receipt before continuing that irreversible exit.
This completes termination without executing the child's userspace. Other
unlinked stops stay parked until durable kernel lineage arrives. Non-SIGKILL
unlinked exits refuse. Durable WNOWAIT identity receipts before consuming/reaping,
initial barriers, fork-parent ordering and the inner reaper are preserved.

If the creator's event was lost, the final drain retains `unresolvedLineage` and
sets `kernelForkLineageComplete:false`; termination does not manufacture a
parent. If a delayed parent fork event arrives after the killed child was reaped,
it binds to the retained registration; observed PID reuse refuses. A separate
real fork ordering regression exercises that delayed receipt. The accepted
CLONE_UNTRACED syscall-audit and nonleader-exec limitations remain unchanged.

## Tests and selected generation

Six focused tests pass: the two new kernel exit/late-lineage orderings, the
existing parked-autoattach/nonterminal-zero regressions, and both deadline
refusals. R/after/ retains successful normal drain for all three fixture tasks,
including the unresolved thread and its SIGKILL exit message. No supervisor
EXITKILL retirement is needed for that repaired case.

Two actual-startup tests pass against the current tool: clean five-input
bootstrap, actual custodian lock, nested WNOWAIT reaper and complete drain;
changed bootstrap bytes refuse before uploads or starts. The existing test
logic is referenced from the custody-ready run with its destination bound to R.
The first local test invocation lacked its small runtime-pins fixture for the
refusal test; R/startup-integration.log retains that harness error. The clean
startup test already passed in that invocation. R/startup-integration-final.log
records both passing after supplying the fixture.

The four current endpoint-helper tests pass. The final locked full build passes.
Seven accepted controls, native hover, eleven barrier tests and the 56 accepted
kernel evidence references are independently hash-checked and reused without
additional unchanged Chrome fixtures. The exact helper closure/content barrier
is unchanged: joined uploads precede publication, and verification precedes
queue creation and parent consumption.

R/runtime-pins-selected.json derives from the predecessor's immutable repaired
548-provider plan and changes only the kernel-tool pin. All548 selected bytes
pass exact resolution; current peer WIP falls back to accepted Git/media
providers. The42-helper physical/call closure passes. The endpoint helper is
included unchanged, SHA256
`11683651fa033d56f861adeb64a3f46cb8422553b9651ba051f5200111614ecc`.
Neither predecessor plan is overwritten. Original source
`90c1fcfee91c4680877083e80498afcb73c9384d` and module
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`
remain selected. The direct provision.bytes HTTP manifest is still1238B,
SHA256 `1eae58509019b8551f46fdbd5a54da5c3a28d29c811df349645c08b5be5a8946`.
No upload/allocation/runtime follows this preflight.

Both source and predecessor-staged checkpoint files remain byte-identical:
characters.lpl1342204B, SHA256
`70fcfbe302a9ff1f1b7452223e67e800371086812d679ba04c03d4adffca036a`;
game641d_6af08808.sav3204341B, SHA256
`a4ecb215f5ffab7524cc0524c419c46498eb7ef14a0e3f404c880f72a769f45d`.
Media is referenced by existing path/hash, without new checkpoint copies.

## Lifecycle and next step

All recorded local kernel task identities are independently absent, including
failed reproduction tasks retired when their isolated test supervisor exited.
The successful startup retains and verifies the supervisor's exact identity;
the initial failed reproduction supervisor start was not recorded. Fixture
custodians release their fixture locks. No browser, game input, held buttons,
profile, endpoint, remote writer or remote runtime lock was created by this
task. The local runtime lock was not acquired: these small kernel/startup
fixtures do not execute a heavy runtime. No new box was allocated, so box ID,
state, expiry and stop receipt are N/A. No preexisting box was resumed or altered.

Publish the exact repaired commit to the Recoil-generation-ready peer through
the board. The next original remains separately executed: preserve the selected
endpoint helper and repaired custody tool, prearm the observable independent
25-minute watchdog with immutable deadlines, verify production loadFiles/VFS,
native Load preview and buttons0/queueEMPTY, review current pixels, then identify
native hover targets and advance beyond the second opening. Retrieve and
independently hash incremental native NewSave by minute10, followed by final
save and owned drain before delegated normal stop. The inherited helmet baseline
9+0, LIFE19/35, MANA25, Gold1532, Food49, AC12 is unchanged and not re-observed.
Full27/parity/audio/FPS remain open. No replay, private guest write, deployment,
clock/config/seed change, old-box resume/delete, or subworker occurred.
