# Maelstrom retained probe independent review, 2026-10-24

Verdict: independent acceptance **INCOMPLETE**. Candidate
`cbac94c066710c18a74b6802b1f50b0b475a6603` was not integrated. No substantive
candidate defect was demonstrated. The worker's added native fixture polluted
the counter state; the candidate correctly rejected that state. A subsequent
fresh publication admission failed and was retained. A later actual capacity
recovery allowed report-only task-branch publication. No second native invocation,
main integration, integration lock, or merged-tree acceptance was attempted.

The report-only task branch is based on main `2545fba6c8234031bc8fbdcb5273491cbc4461ca`;
it does not include the candidate. The candidate was tested at tree
`11d4d873d16ec38a0a2b0f9236beec79de35250e`. New review evidence is retained
adjacent to this report; publication refs and final status are in the external
`/tmp/maelstrom-retained-probe-independent-integrate-oct24/ops/` directory. Donors and root tracked files/index/refs were read only;
the shared messageboard received append-only ownership/result entries.

## Independent source and provenance review

`identities.json` records verification of the coordinator's four pinned input
hashes against immutable Git blobs and donor files. All 25 candidate evidence
seals matched their actual immutable Git blobs. Historical source was recovered
with read-only `git show b41a7c5…:src/PATH` and checked against the supplied
lengths/hashes. The historical runner was independently recovered at
`d8cd8c54…:test/run.js`, not equated with current exports. The actual original
24576-byte SDL_net.dll matched its pinned SHA-256, and its 96-byte window matched
the candidate extraction. The standing 1879746-byte native module matched SHA-256
`8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`.

The candidate's limits are sound on source review: the original prefix is
MOV EBP,EAX; CALL EDI; the breakpoint follows that CALL. Its generic interior
instruction example does not explain the original game. A passive head count
does not establish target execution or 972 native API calls. The historical
zero-target cause, EDI target/return and errno remain UNKNOWN. The retained
candidate native log is prior evidence, not this worker's fresh acceptance.

The executable probe contains direct live assertions for wrong target evidence,
blocking yield, counter totals, breakpoint skip-once/reentry, cached successor
entry and benchmark chaining. Its cheap test alone does not run native code;
this review does not promote that test or prior logs into live native acceptance.

## Exact candidate-tree checks

On the byte-unchanged candidate tree, the single supervisor ran:

```
python3 /tmp/maelstrom-retained-probe-independent-integrate-oct24/ops/supervise.py focused
python3 /tmp/maelstrom-retained-probe-independent-integrate-oct24/ops/supervise.py boundary
python3 /tmp/maelstrom-retained-probe-independent-integrate-oct24/ops/supervise.py native
```

The focused suite passed, including wrong halt/EIP/readback and removing each
target-evidence guard. The existing unchanged boundary suite passed its seven
rejecting mutations, watchpoint/anchor/export checks and finite no-hit control.
Their underlying exact Node argv and terminal/cleanup records are retained.
No merged tree exists to test.

## Independent live contradiction control and worker fixture error

`independent-native.cjs` checks the exact candidate source hash, inserts one
uniquely anchored control in memory, and invokes the real candidate probe once
against the retained module. No candidate file was edited. This single invocation
uses the same fixed 512 MiB arena and real native exports as the candidate.

The added control places a pending blocking yield at the exact breakpoint. Its
assertions require: halt5 before counting; resume returns halt4 and count1 without
decode or EBP change; next entry halts5 again; wrong requested target cannot
invoke the read callback. These assertions preceded the eventual failure.
Because the probe prints its rows only after full success, there is no retained
row log for these controls. Their completion is an execution-order deduction
from the later assertion location, not independent per-row output evidence.

The worker then incorrectly used `clear_counts()` and same-address `set_count()`
to restore the candidate fixture. Historical exports lines 2620–2640 show why
this does not reset the memory values: `clear_counts` disables the slot count;
`set_count` zeros stored values only when the address changes. Two blocked skip
entries had left target count2. The candidate subsequently completed its 972
blocking-loop iterations and rejected `row.interiorCount === 0` with `2 !== 0`
at instrumented line147 column44. `failure-source-mapping.txt` and
`historical-counter-semantics.txt` preserve the exact mapping and source excerpt.

This is a worker-designed fixture restoration error, not a candidate rejection.
The fresh invocation never reached the final unblocked MOV/CALL/synthetic RET
assertions. Successful full native acceptance therefore remains incomplete.
All original assertions remained active; no failure was bypassed. The command
exited1 naturally, output218 bytes, no TERM/KILL, wait/reaped, remainingGroupfalse.
The one permitted fresh native invocation was used; no retry was performed.
A future coordinator-authorized run can restore slots by first changing their
addresses, then rearming them, or isolate this control after the candidate's
original assertions. This task did not execute either correction.

## Resource and publication blocker

The initial allocation and checkout gates passed with full external session,
launcher/events/history, positive SQLite growth/future allowance and 8 MiB reserve
inside 64 MiB, plus the other task's 64 MiB reservation. Each cheap/native command
had a fresh passing disk/memory receipt. The native supervisor measured
MemAvailable2921943040 >=2684354560. Native heap512 MiB, CPU90s/wall60s;
cheap heap256 MiB/CPU60s/wall60s. Pipe cap131072 and per-file24 MiB were separate.
All test groups exited naturally and were reaped. No mounts were used: the local
module filename is a direct Node argv argument, so there is no guest mount argv
for the canonical mount parser. The exact trusted Git SSH configuration was
recorded without changing trust files or credentials.

The first publication gate then measured free2465501184, below2982150144 even
before projected growth. Its full projection36421632 plus other67108864 left
2361970688. `publication-admission.json` retains the rejection. The preparation
script asserted before reset, copying report evidence into Git, staging, commit
or remote access. Publication stopped. A later actual measurement recovered free space to
3122585600; `publication-recovered-admission.json` records a fresh passing
projection after that material capacity change. Only this report and evidence
were then prepared for task-branch publication; no unchanged denial retry occurred.

Full native acceptance requires a new explicitly authorized native attempt
with corrected independent fixture restoration. The existing failed receipts
must remain preserved. No source build, toy WAT, acquisition, game guest,
production patch, public deployment, worker spawning or box operation occurred.
Box ID/state/expiry: none assigned; lifecycle remains coordinator-owned.
