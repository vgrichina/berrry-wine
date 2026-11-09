# Native queued-resume replacement, 0420

Evidence: `scratch/runs/20261109-native-chrome-creator-loss-0420/`.
Offline only: no browser, Chrome, box, workers, agents or deployment.
The concrete repair is a queued CONT scheduling defect proved against published
`9ab247857d0f5b341d2502d8b7191a20b4dfd762`. Warcraft0410's two lost creator
messages, its close failure, and historical 0244/0350 causes remain UNKNOWN.

## Retained Warcraft0410 ordering

The retained raw journal is
`scratch/runs/20261109-warcraft-custody-normal-close-0410/retrieved-fixture/cases/after-late/custody.ndjson.gz`.
`retained-trace.json` records its stored SHA and the relevant raw rows. The
published supervisor SHA is
`a2d9ca6f74bdb193e017c3b340a450ee0b0b13736030e0d512ff500b26fda9b3`.

At sequence 519, 04:13:32.269 UTC, task 6730/start12182 has a real CLONE stop.
GETEVENTMSG binds child 6771/start12717 at 520. Its previously observed initial
stop permits a queued child release at 521; creator release is announced at 522.
The child CONT has an explicit success receipt at 526, 32.435. Other group 6734
creation events intervene at 523–525 and 528–530. Task 6774/start12744 first
appears at 531, 32.598, already at an irreversible EXIT stop: 532 observes 1541,
533 consumes its kernel exit message 0 and retires it at 32.675. Its actual
status-0 wait is 538 at 32.905. No kernel creation message binds 6774 anywhere
in the retained journal. The sampled TGID 6730 is group membership, not proof
that 6730, 6771 or another sibling created it.

For group 6722, child 6798/start13331 is initially parked at 668–670. The leader's
CLONE stop at 673 binds 6798 at 674; queued release 675 and creator announcement 676
precede the child's successful CONT 677 at 04:13:38.622. Another task's SIGSTOP
is observed at 678. Task 6799/start13370 first appears at 679, 39.158, already
at EXIT: 680 observes 1541, 681 retires with kernel message 0 at 39.498, and 685
records its actual status-0 wait at 39.591. Neither 6799's creator nor an earlier
initial stop is retained. TGID 6722 cannot establish its creator.

`fork-parent-release` is logged before the creator CONT is queued; it is not
a successful CONT receipt. Ordinary queued creator CONT calls and the results
of each creator scan were not journaled. Thus these rows establish the last
consumed creation events and explicit child releases, but cannot reconstruct
the creators' exact runnable intervals or distinguish a message replaced by
group exit from a scan/resume race. Retrospective lineage repair would invent
kernel proof. Both unresolved rows and complete=false remain intact.

Chrome 6034/start8732's real status-9 wait at 927, 04:13:49.370, follows the
18-second adapter result at 42.962. Neither it nor the later adopted wait 1018
proves earlier Chrome stdout/stderr EOF. Parent EOF and command EOF remain
separate obligations; the historical normal-close failure is not fixed by
claim or by this native reproduction.

## Proven scheduling defect and repair

A queued CONT belongs to an already consumed stop. While queued, normal
exit_group or a nonleader exec can replace that stop with PTRACE_EVENT_EXIT.
Published 9ab's creator scan sees but ignores that replacement because it
selects only FORK/VFORK/CLONE statuses. With queued resumes present it skips
P_ALL, then issues the stale CONT. That releases the unconsumed EXIT stop
without its before-consume/pre-exit witness. During nonleader exec, the later
EXEC binding correctly refuses because the leader EXIT was never consumed.

The repair remembers an actual pending status belonging to a queued resume
during the existing scan. It still searches all eligible creators first; only
when none has a creation event does it return the superseding status. Normal
stop consumption removes the stale queued CONT and processes EXIT/EXEC through
the existing strict paths. No waits, reaps, kernel messages or lineage are
fabricated. Durability, immutable deadlines, separate EOF, unresolved-lineage
failure and nonleader EXEC binding requirements are unchanged. This repairs a
specific observed-status ordering bug; it does not make scans atomic against
events that arrive after a scan.

## Real-kernel controls

`SupersededResume` compiles one small pthread ELF in temporary storage. A real
native parent forks a multithread child. A running nonleader either calls
_exit(0) or execs /bin/true while the leader is stopped at SIGUSR1. A hook
consumes only that real signal stop, releases a file gate, and waits with
WNOWAIT for the real replacement EXIT before returning. It never substitutes
a wait result. Each run prearms an observable independent ten-second watchdog
before releasing the supervisor. Actual wait statuses, the pending status at
CONT, durable custody journals, gzip hashes and independent fixture pipe EOF
are retained. The isolated subreaper actually waits EXITKILL survivors on the
expected failing control. Native source/binary hashes and regeneration recipe
replace source archives.

Six old/new controls prove:

- Normal group exit: old CONT sees pending 1541 and skips the leader EXIT;
  new consumes that actual EXIT before CONT. Both retain real terminal waits;
  the old drain's complete=true does not establish that its EXIT was consumed.
- Cancellation after the replacement: the same old missing EXIT/new consumed
  EXIT distinction; cancellation remains abnormal, with actual waits and EOF.
- Nonleader exec: old fails `unbound nonleader exec`, complete=false, with
  retained unreaped obligations and actual isolated cleanup waits; new passes
  with the consumed leader EXIT, explicit former-TID kernel binding and actual
  successor terminal wait. No separate former-TID reap is invented.

An added fixture assertion initially counted the successor's later EXIT as
the replacement EXIT; the corrected assertion restricts actual waits to those
before the first CONT. Both logs are retained; no production change was
needed for that correction.

All 40 custody tests pass, including existing real creator-loss, cancellation,
late-lineage, nonleader-exec and output-durability controls. The final focused
six controls pass. `flock /tmp/wine-build.lock bash tools/build.sh` passes.
Evidence includes exact Git base plus small owned patches; no source tree,
media or module archives. Only free /home above 1.5 GB gated resources.

Next: separately authorized investigation may collect actual creator scans
and CONT receipts to distinguish the historical loss mechanisms. Fresh Chrome
was not authorized or run. This task stops after publishing the bounded repair.
Box ID/state/expiry/stop receipt: NOT_CREATED/null; no runtime was allocated.
