# Quake II launcher teardown investigation, 0300

Production remains unchanged. No causal Chrome repair or real Chrome pass is
claimed. Both Q2close0244 rejected patches remain evidence in their original
run; neither was applied. The released fixture helper remains inherited WIP.

Evidence: `scratch/runs/20261109-quake2-launcher-teardown-repair-0300/`.
The run records the Git SHA, relevant diff, inherited untracked helper patch,
and SHA/size references to the prior launcher, close summary and rejected
patches. Referenced gzip files passed decompression and GNU gzip CRC checks.
No source tree, media, module or prior evidence was copied into an archive.

## Offline finding

The recovered remote launcher ends with `exec > >(exec cat)` and
`exec 2> >(exec cat >&2)` before executing Chrome. The second relay inherits
the stdout relay's write end; the first relay inherits the original stderr.
The prior outer-socket scan identifies the cats, but does not identify every
writer of their upstream pipes. It cannot establish why Chrome itself exited
late. Root exit, relay exit and each readable EOF must remain separate facts.

Four browser-free controls exercised these exact Bash redirections, with and
without relays and with and without a descendant retaining inherited writers.
All passed. A dedicated Linux subreaper recorded actual `waitpid` statuses
for the root and all adopted descendants; stdout and stderr each recorded an
actual zero-byte read separately. Both relay and direct controls drained
promptly without the extra writer. Both delayed-writer controls retained
their streams for approximately 800 ms despite the root's earlier successful
wait. Thus these redirections alone did not deadlock in this control, and
removing relays is not an established Chrome fix. The control is a pipe
diagnostic, not a replacement for composed Chrome acceptance.

Next diagnostic work should map the cats' input pipe inodes to all writable
FDs, preserving PID/start identities and kernel waits, and measure the
observer's own cost. The inherited fixture scans every process FD every
250 ms; its effect on the traced Chrome run remains UNKNOWN. No signal,
deadline, close phase or normal-success rule was changed.

## Concrete runtime blocker

The explicit task requires BOTH Warcraft0244 and Super0251 exact
`ARCHIVED PHYSICAL_DRAINED` receipts before creating the one fixture.
Super0251's 02:56:04Z STOP says it created no box, so it has no such receipt.
Warcraft0244's release was also absent at this check. A subsequent board
entry assigns a new Super0300 successor and changes the proposed runtime
order; that is recorded in `gate-evidence.json`, but is not the task's exact
Super0251 gate. No earlier run's receipt substitutes for either dependency.
Runtime work needs a corrected prerequisite naming the actual successor and
the required completed physical drains. Single-task STOP; no repeated wait
or limitation report is scheduled.

No box was created: box ID/state/expiry/stop receipt are all inapplicable.
No watchdog was armed, browser launched, peer box accessed, agent spawned,
original started or deployment performed. Disk was above 1.5 GB at the final
evidence check. No production edits means no new build or focused production
test pass is claimed. The four offline pipe controls passed; the required
Chrome fail-before/pass-after, negative controls and locked build remain
outstanding.
