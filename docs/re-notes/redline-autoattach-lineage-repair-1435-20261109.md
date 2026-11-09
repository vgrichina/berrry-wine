# Redline autoattach lineage evidence repair

The actual1395 receipt still has unresolved PID 8107/start 33709. Its 81 terminal waits and physical drain do not establish creation lineage. This change retains the missing categories of kernel observations for future diagnosis; it does not repair the historical binding or explain Chrome startup. Startup cause remains UNKNOWN.

Evidence is in `scratch/runs/20261109-redline-autoattach-lineage-repair-1435/`. The historical run remains at `scratch/runs/20261109-redline-current-module-startup-fixture-1395/`, published by `8fd1a54210d7e3c4e1c47e4559f9c1498afdf02f`.

## Actual sequence and source

The actual runtime manifest pins `tools/native_kernel_custody.py` to SHA-256 `05b7fe42cf7ac09df5f12f0ea073ea066892efb598b64b05fae19a3492c9f32c`, 31987 bytes. It matches the published Git source exactly. The manifest does not pin `native_custody_reaper.py`; that separate direct/adopted-child reaper is not the kernel event consumer. No demonstrated defect requires changing it.

The retained 790-record journal has contiguous sequences and matches its drain receipt's original SHA-256 `7a2b3e74e7022a96ebf614d54f6a53838d64f8a27a05857c48bcc7de72f6070c`, 128130 bytes.

| Sequence | Retained fact |
| --- | --- |
| 522 | PID 7542/start 31630 peeked CLONE, `siStatus=773`. |
| 523 | The pinned consumer classified that task's consumed event as EXIT. The raw consumed status and kernel message were not retained. |
| 532 | PID 8107/start 33709 first registered at an autoattach stop with no parent custodian; TGID 7542, sampled PPID 7496. |
| 533–534 | Its observed EXIT stop, `siStatus=1541`, allowed irreversible retirement only; kernel exit status 9, `lineageResolved=false`. |
| 537–538 | The task had a real SIGKILL terminal wait. |

There is no retained creation event/message binding 8107 to a particular creator. TGID, sampled PPID, neighboring PIDs, start-time proximity, and the earlier CLONE peek cannot supply that binding. The sequence is consistent with creation-stop supersession during fatal group termination, but it does not prove which creator made 8107 or who initiated the kill.

[Linux ptrace documentation](https://man7.org/linux/man-pages/man2/ptrace.2.html) describes automatic attachment at fork/clone, creator event messages, SIGKILL killing the thread group, and EXIT stops before final death. An event message's interpretation depends on its event. A message sampled after an earlier peek may already describe a superseding event. The new preconsume capture is therefore explicitly observation-only.

## Narrow source change

The actual supervisor now records:

- The exact `waitpid` status, the preceding peek's code/status, PID/start identity, and a reference to the before-consume record.
- Successful `GETEVENTMSG` results associated with that consumed status.
- Successful CONT returns associated with the consumed wait and delivered signal.
- A preconsume creation-message observation, including errors, associated with its peek. It never registers a child or authorizes CONT.

The latest consumed-wait reference uses one entry per already-owned task. Diagnostic records share the existing Journal's maximum 1 MiB/4096-record pending batch. Existing admission barriers flush the ordered prefix before executable CONT; finalization persists the remaining evidence and gzip footer. There is no new logger process, thread, timer, deadline extension, lineage inference, or receipt-success exception. Additional records and one observation syscall per creation peek have an unmeasured runtime cost.

Q31415 refused before allocating a box. The coordinator explicitly released the shared-source gate at 13:12:49Z; the Q31415 final release is `c3a215f99`. The shared source was edited only afterward. Other workers' WAT, host, clients, and caller files were excluded.

## Actual process verification

`tools/native_autoattach_lineage_test.py` compiles the exact published predecessor and the small candidate transform in memory, then also tests the edited shared source. Eight scenarios across all three versions produce 24 actual inert Linux supervisor runs. Each starts behind a prearmed independent process watchdog, joins actual processes, and records captured-pipe EOF separately.

The controls cover clone and fork cancellation, descendant exec and CONT, child-before-parent autoattach stops, late parent lineage, rejected PID reuse observations, inherited output writers after root exit, and CLONE peeks superseded by actual SIGKILL/EXIT. The PID reuse observation is injected because deliberately forcing host PID reuse is unsafe; the stops, descendants, signals, and waits are real.

In the supersession scenario, the predecessor lacks exact consumed-status/message evidence. The candidate and shared source retain the earlier creation-message observation and the consumed EXIT status, while leaving the child unresolved and the receipt incomplete. The earlier message is never promoted to accepted lineage.

Every run's real journal and receipt also pass through actual1395's generated inventory/retrieval consumer using local file transport. Received bytes and kernel-completeness values match the actual supervisor output. Collection retains `fixturePASS=false` and does not assert browser EOF. Dropped and reordered transport bytes fail that consumer's SHA-size check before a verification receipt is written. Semantic loss, order, identity, status, and missing-peek negatives fail the event audit, including missing-peek loss with rewritten sequence numbers.

The existing 46 kernel-custody tests and 8 direct/adopted-child reaper tests pass. Their durability, first-fault, cancellation, PID/start, nonleader exec, terminal-wait, and separate EOF requirements remain in force. The EXEC fault hook now ends its injection window at the actual CONT, so a later diagnostic CLONE message read cannot receive an EXEC-specific corruption injection. All refusal assertions are preserved.

The first locked build attempt refused unrelated in-progress Q21425 worker lifetime fingerprints. After its owner's census updates, `flock /tmp/wine-build.lock bash tools/build.sh` passed on the shared tree. Both logs are retained.

## Historical limits and next action

The historical `unresolvedLineage`, `kernelForkLineageComplete=false`, `complete=false`, browser EOF failures, two invalid browser gzip artifacts, and first startup failure remain unchanged. No browser, guest, local Chrome, Box, native game run, agent, or worker was launched for this task.

No new Box ID, expiry, or stop receipt exists. The inherited actual1395 Box `bx_rfgz429k`, UUID `5adf5b34-c76e-447d-b734-996cfe43bfd0`, remains offline and uncontacted: its retained receipt says ARCHIVED/PHYSICAL_DRAINED, completed unforced stop `stop_c6f706024295cebc` at 13:03:19.518Z, initial expiry 13:24:02.050Z, final expiry not returned.

Use the added records if a separately authorized future run encounters another loss. The existing historical binding cannot be reconstructed from these retained facts. Native startup cause remains UNKNOWN.
