# Pawn: live trace compression tested; native witness capacity refused

Second-move commitment and the second AI reply remain **UNKNOWN / UNPROVED**.
Run `scratch/runs/20261113-pawn-streamed-native-save-0850/` repaired the
run-local trace storage path, then refused its sole fresh launch decision at
**1,498,103,808 available bytes**, below the strictly-above-1,500,000,000 floor.
No Pawn original, watchdog, chess input, menu input or save was started.

Parent `b4548db48543339e1ae185efe07b21070dfb8559` had established delivered
e2–e4 / Ng8–f6 and displayed d2–d4, but no authentic second-turn commitment
witness. Its native Save As filename input was refused. This run does not
replay that uncertain move or promote its displayed position to commitment.

The inherited supervisor wrote stdout to a raw file. Its replacement tees
every pipe byte directly to whole-stream lossless gzip while feeding the same
bytes into a bounded in-memory parser/hash accumulator. Raw stdout is never
staged on disk. Neither trace lines nor their fields are filtered. Control
ACKs in this route use HTTP, separately from stdout; `ctl.py`, `input.py` and
`ui.py` retain the parent's control and no-replay behavior. Parser overflow is
explicitly recorded and grants no control authority.

Each stream independently stores EOF, result and seal records. A seal requires
observed EOF, closed/fsynced gzip, complete gzip decoding including trailer
validation, and decoded byte count/SHA equality with the live stream. Failure
remains UNKNOWN without a seal. Native return status and separate stream EOFs
remain in the supervisor's parent wait record; an early nonzero exit is never
turned into child success by a valid stream seal.

Focused controls used real subprocesses exiting 0 and 7, binary/non-UTF8
stdout, partial final lines and separate stderr. Full decoded bytes matched
the expected raw bytes exactly. Truncated gzip failed verification. Real
one-shot HTTP children demonstrated the unchanged ACK and malformed-response
failure paths, with exactly one request and no resend. An injected interrupted
pipe retained UNKNOWN/false EOF and no seal. Evidence includes the actual
waits and independently retained results. No unrelated owner guard matrices
were rerun; the qualified owner helper remains SHA
`9390a4b3d80c92b8c1377308839304b02eaade779cff995b0f48774ddb818581`.

Before the sole decision, the actual assigned closed-API0830 recovery outcome
and native/guard wait records were observed and hashed in
`dependency-outcome.json`. Recovery reported 17 closed logs and 13,881,344
net allocated bytes saved with its stated allowance; its native process had
already exited 0 with both EOFs. That historical result was not substituted
for this run's fresh capacity check. The frozen current04/six-media descriptor
passed its pins, but the fresh floor refused before runtime creation. There
was no disk polling, foreign cleanup, new box or second launch decision.

Source recovery uses exact Git SHA, relevant binary diffs, inherited untracked
source patches and owned helper patches. Media stays at its existing paths
with SHA-256 references. No production semantic change or locked build is
claimed; this publication changes only this note. Protected NFS0845,
LMarbles0830 and all recovery data were untouched.

Next requires a distinct real resource outcome and sustainable headroom for a
fresh guarded original, then ordinary native history/Save As evidence before
attributing the second-turn stall to commitment, computation or a host defect.
No causal runtime fix has been isolated.

Box ID **none**, state **NOT_CREATED**, expiry **null**, stop receipt **N/A**.
