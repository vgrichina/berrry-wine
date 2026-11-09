# Q3 generated-parent signal cancellation shadow repair — 2026-11-09

The production `drain_remote` in commit
`36d5529d2e614e4ee25056ea2919c0a683e57a6c` still rebound its output-directory
parameter to the closed `caller-cancel-sent.json` file handle. A parent signal
leaves `requested` nonempty; the next pump iteration republishes cancellation
through `Path(output)` and raises TypeError before the generated parent's child
join. The repair0737 note's assertion that this shadow was corrected is false
for those committed production bytes. Its accepted transport-publication cases
did not exercise this nonempty signal-request path.

The production change only renames that marker file handle. No cancellation,
command, CDP, ACK, runtime or cleanup deadline changes. Publication-only custody
remains UNKNOWN. Native custody is unchanged at SHA256
`5ec810c4d4704ff86afc367b38f7335edf1214e3450ebb98a62ce3df6386b5fe`;
marker remains `1858eea7efb8875e44088ffe9f5ea434c3b22915444113204fb51673e4f5ac0d`;
build CPU remains 2185596 bytes, SHA256
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.

Evidence is `scratch/runs/20261109-q3-signal-cancellation-shadow-repair-0805/`.
The extended tracked remote-cancellation test executes the actual generated
parent, strict prelaunch, composed Node consumer and current native supervisor
with inert children. Signal cases hold the runtime's pipe open in a fixture
`finally` after native drain, ensuring multiple .02-second pump iterations.
The parent receives HUP, TERM during pending CDP, or INT, then repeated copies
and all three signal kinds. Cancellation marker, first-failure content and the
single signal-sent receipt remain byte-identical. The parent stays alive during
the held pipe, and cannot write its child-wait receipt until that pipe is released.
No production source is replaced by a hand-written parent or drain mock.

`old-final-HUP`, `old-final-TERM` and `old-final-INT` each fail on the unchanged
production source with the exact `Path(TextIOWrapper)` traceback and missing
generated-parent prelaunch-child actual-wait receipt. Those missing joins remain
UNKNOWN; they are failure demonstrations, excluded from accepted custody. The
test's independently dispatched parent/request processes and watchdogs have
actual outer wait receipts. Rescue releases only the fixture pipe and signals
its actual supervisor; no original execution or capture retry is attempted.

`focused-final` passes all eight cases: three signal cases, exit/EOF during a
command wait, exit/EOF during pending CDP, and normal completion. All accepted
runtime/prelaunch, remote parent/sender, local client transport and independent
watchdog waits are recorded, with EOF separately observed. Native drains are
complete with command EOF true; ownership/reap counts are 19/19 for each signal
case, 26/26 for exit and normal, and 25/25 for the other three transport cases.
Cancellation yields no later capture or successful numbered ACK. Normal quit
keeps its successful ACK and actual runtime/prelaunch status0; cancellation
retains status1. First-failure stickiness also retains the existing pre-cancel
control's earlier failure and refuses bootstrap with zero children.

The focused launch-client suite passes (SIGPIPE/exit0/exit7, pending and before
next, normal numbered requests, early EOF and held pipe). The ten prelaunch
controls pass. `flock /tmp/wine-build.lock bash tools/build.sh` passes. The prior
accepted driver, launch-client, prelaunch and remote-cancellation proof is reused
by source match against commit36d5529d2e: 792 retained proof files independently
reread for SHA256/size/gzip CRC. Another 595 historical reference entries were
reread against their accepted manifest, without copying them or rerunning the
unrelated driver suite. Historical0052's cause, 33 missing waits and incomplete
command EOF remain UNKNOWN; no historical wait or cause is inferred here.

Development `focused` passed the five transport controls but its first signal
assertion failed because the test initially put its pipe hold after a supervisor
call that raises on cancellation. The corrected fixture puts the hold in
`finally`; the final old and repaired signal runs use that same corrected test.
The initial prelaunch invocation omitted its output directory and failed before
its controls; `prelaunch-final` supplies it and passes. Neither development run
is acceptance evidence.

Recovery records Git base plus small binary diffs for owned source/docs and
small run-specific scripts; Git holds source history. Logs are gzip from first
byte; final inventory and an independent reread check stored/original SHA256,
size and gzip CRC. There are no archives, media or module copies. All accepted
checks and their prearmed observable independent deadline watchdogs are joined.
No Chrome, guest, original game, box, worker, agent or deployment was started.
No Q2, Redline, shared host/custody/WAT, HeroesII or CLAUDE edits. Free /home
remains above 1.5GB. Box ID/state/expiry/stop receipt: NONE / NOT_CREATED / N/A / N/A.

Next is separately authorized fresh-manifest remote qualification; offline
signal delivery does not prove Boat delivery. This single task stops after
publishing its own tested paths.
