# Neverhood fixture release and confirmation timing

Evidence: `scratch/runs/20261117-neverhood-native-release-confirmation-timing-room/`.

The authored ordinary MessageBox fixture could reach ExitProcess before its
independent physical release connected. Its final path now calls the real
GetAsyncKeyState API for VK_LBUTTON and VK_RETURN and waits for each physical
high bit to clear before exiting. The child-handoff fixture uses the same guest
behavior instead of an incidental Sleep delay. This changes authored inputs,
not the emulator, original game, native acknowledgement, or shutdown policy.

A failed independent release can now report OWNER_EXITED when an already
published matching OS wait proves that the owner exited and both pipes drained.
It still records physicalUpACK=false and fails. No dead endpoint is queried to
obtain this explanation. A regression uses a real OS process and actual wait,
then verifies refusal before transport and no invented UP acknowledgement.

The retained historical Play input was consumed at 461.280 ms; its receipt
record was formed at 463.393 ms, before durable publication and the 500 ms
confirmation check. Those records do not identify a syscall duration or
scheduler delay. They cannot establish which caused the boundary crossing.

Optional NEVERHOOD_CONFIRMATION_PHASES=1 diagnostics now record process CPU,
monotonic time, Linux scheduler run/wait counters, identity/HTTP phases, durable
write/fsync/publication phases, and the unchanged confirmation check. Records
are emitted after the controller operation. They never replace policy clocks
or native receipts. Focused sealed native handoff and repaint workloads have
not reproduced that historical boundary failure. Their small measured fsync
durations are not evidence that the historical failure had the same cause.

No speculative timing repair, deadline movement, restamp, successful stub, or
UNKNOWN recovery is applied. Confirmation remains 500 ms, independent physical
UP 1,750 ms, aggregate observation 3,000 ms, and image freshness 15/30 seconds.
The original installed-shortcut launch is withheld until the distinct timing
blocker is resolved. There is no original room/object or native Quit claim.

The result lists exact tested variants and exclusions. An initial diagnostic
hook naming error and an interrupted combined probe are retained as failures,
not counted as complete passing suites. All endpoints latched UNKNOWN remain
terminal. Host cleanup is distinguished from native Quit. No workers, boxes,
public deployment, media duplication, or source archive was created.
