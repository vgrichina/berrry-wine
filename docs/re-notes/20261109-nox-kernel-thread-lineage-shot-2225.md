# Nox custody scan after durable service

Evidence: `scratch/runs/20261109-nox-kernel-thread-lineage-shot-2225/`.

The Nox adapter now checks real pending creation stops after its durable journal
flush and before a queued userspace CONT. A creator can enter clone while that
flush blocks, after the preceding event-loop scan. Releasing another thread
into exit_group can then replace the creator's unconsumed message. The late
scan defers that queued CONT; the ordinary consumed wait and GETEVENTMSG still
provide the only creation proof. It does not register from a peek, infer a
creator from TGID/PPID, or resolve missing lineage from terminal receipts.

The shared custody provider remains byte-identical and SHA-authenticated.
First-observed unlinked EXIT retirement, every-CONT full-prefix durability
outside ESRCH handling, sticky service errors, bounded batches, deadlines,
terminal transport behavior, and original-media identities are retained.

## Retained ordering and its limits

The independently decoded previous journal matches SHA-256
`3e9a974509e6854471bd5ffd4fd7bd3c99111cb3fc93690d31a79bc01f61b8ad`.
Leader 6760 was registered by consumed FORK/GETEVENTMSG at 1807–1809. Its
last retained consumed CLONE identified 6769 at 1912–1914. Leader 6760 resumed
at 1917; 6769's initial stop was consumed at 1919 and resumed at 1920.
6771 then appeared unlinked at 1921, parked, consumed EXIT/GETEVENTMSG and
was reaped at 1932. 6770 first appeared at EXIT at 1933 and was reaped at
1941. Leader 6760's EXIT was consumed at 1999, released at 2001, and reaped
at 2008. Neither missing child has a retained creator message. There is no
nonleader EXEC transfer in the journal, nor an EXEC stop for leader 6760.

The journal records event observations, consumed waits, messages, and CONT
returns; it does not trace syscalls. It cannot establish the actual creator
of either missing thread or which thread initiated group termination. The
durable-service race below is a real reproduced mechanism, not a recovered
historical syscall sequence. The old run remains refused.

## Causal controls

`tools/nox-kernel-lineage.test.py` compiles a small pthread fixture and controls
only scheduling around actual fsync. While the killer thread's resume barrier
is servicing the journal, an already admitted creator reaches a real CLONE
stop. No wait status or event message is synthesized. The previous adapter
releases the killer, loses lineage, reaps all five tasks, and refuses. The
repair consumes the CLONE and message and records custody before the killer
CONT; all five tasks reap with complete lineage. Every actual CONT is checked
against the full prefix witnessed at successful fsync.

A real SIGKILL that destroys the creator evidence still refuses despite all
tasks reaping; the unlinked child never executes userspace. The generated
adapter also passes the real leader EXIT/nonleader EXEC/successor-wait
control; missing former-TID binding and missing successor wait remain refused.
Failed fixture descendants are independently adopted and actually waited.

## Validation and native outcome

Code commit `ca5880f0114978186b13eda5c0ee40ad457d7be0` was published to main
before allocation. `lineage-tested/` retains all six real-kernel controls and
actual child waits. The locked build passed, as did the generated actual-consumer
20-control suite, custody durability/first-unlinked-EXIT/sticky-service suite,
seven terminal cleanup cases, and three native-input controls. The supported
LEFT-click/150ms command also passed generated command validation; this is not
a native staff-shot claim.

Both native phase manifests were sealed and independently reread before the
single allocation (833 pins each). The sole changed native fixture passed:
Chrome 0, consumer 0, actual parent wait 0 with separate stdout/stderr EOF,
146 owned/146 reaped, complete kernel lineage, no failure or cancellation.
Its final boundary recorded zero original launches. Only then did the single
conditional original launch start. It reached the Bunker and ordinary movement
worked; every returned image was separately viewed before dependent input.
The last reviewed image shows full health and the fist HUD in a stone corridor.
The staff was not acquired and no staff shot was attempted.

The original terminated at request 29 with `current reviewed capture required`
at 22:46:43.983Z, before dispatch. I omitted `label` from request 28; movement
succeeded and the driver saved the capture under the undefined filename. I
retrieved and viewed that existing capture, then incorrectly supplied the string
`undefined` as the next review reference, which did not match the driver's
undefined label. This is a task-local orchestration error, not a kernel lineage
failure. The guard was retained. There was no subsequent game protocol, input,
capture, retry, or quit. The original's Chrome exited 0; the consumer and actual
parent wait exited 1, both output EOFs were observed, and all 343 tasks reaped
with complete kernel lineage. Both runs had no remaining or unreaped tasks,
no cancellation, closed ports, absent processes and profiles, and closed gzip
journals with command-log EOF.

`retrieval-verified.json` independently rereads all 390 remote artifacts by
SHA-256 and size, validates gzip and PNG CRCs, and reports no content errors.
Only after that receipt did the independent watchdog issue exactly one delegated
normal unforced stop. Box `bx_6cre9386` is independently confirmed archived;
receipt `stop_4fc816999dde403a` completed at 22:47:36.380Z. Its immutable UUID is
`db6fee49-ed88-4a5b-abdf-8fa81a0cf02a`; deadline was
2026-11-09T23:01:41.507860Z and initial API archive expiry was 23:01:42.929Z.
The watchdog's actual wait returned 0 with separate stdout/stderr EOF; a separate
API state and stop-receipt read confirmed completion and unchanged config SHA.

The tested custody repair and native fixture succeeded. Native staff charge and
target-change validation remain untested. Any future shot requires a separately
authorized fresh run; this terminal run must not be resumed.
