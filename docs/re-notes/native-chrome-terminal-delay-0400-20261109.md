# Native terminal delay 0400: pending kernel stops before output durability

Evidence: `scratch/runs/20261109-native-chrome-terminal-delay-0400/`.
Browser-free OFFLINE; no Chrome, browser, box, agents, workers or deployment.
Q20350/Super0400 pinned remote snapshots are untouched. Historical 0244
identities remain UNKNOWN. Warcraft startup/staging WIP remains unpublished.

## Retained Warcraft0350 mapping and limits

`retained-map.json` maps every retained identity by TGID, creator, start time,
EXIT stop, actual wait and explicit creator-release receipt. The retained
custody source matches published `2df8d81b41da78ac0ab846137cf4137f0f1c4a86`
SHA-256 `a3a802d1f7cff96b7ee7351702f09284426a8881e81b2f49f607c42869e714ee`.
The actual retained terminal adapter matches local released WIP SHA-256
`76b869107fc588bc02a8cc4f4a5b8270b60bc378605f2b20897f47eba48b8992`.

Chrome 7341/start29523 was forked by driver 7332/start29437 at sequence 30.
Its last recorded creation stop around close was sequence 416 at
03:53:49.040641, creating thread 7523, with creator-release queued by sequence
418 at 03:53:49.097518. Browser.close ACK was 03:53:48.983. The journal then
records unrelated creation activity and thread exits through TERM
03:54:02.983 and KILL 03:54:04.982. Chrome's leader EXIT stop was first consumed
at 03:54:12.665654, pre-exit receipt sequence 834 at 12.697294, and real
status-9 wait sequence 838 at 12.901435. Driver SIGCHLD was consumed at
03:54:13.016522; driver status-256 wait arrived at 21.456354. After driver
exit, Chrome's zombie was adopted by custodian 7331 and separately waited at
21.514103. These are two real parent obligations, not a synthetic reap.
All 123 owned identities have actual terminal receipts and complete=true.

The Node driver holds the read ends of two separate Chrome pipes; Chrome
inherits fd1/fd2, and descendant inheritance is possible. Custodian 7331's
command-output pipe is distinct. The 18-second adapter receipt has neither
Chrome EOF nor terminal; abandonment destroys its read handles with UNKNOWN.
The later driver/command EOF does not prove earlier Chrome EOF. There is no
retained per-inode writer census at that deadline, ordinary CONT receipt, or
per-output-fsync timing. Thus Chrome's runnable intervals, exact inherited
writers and the cause of this particular normal-close failure remain UNKNOWN.
Neither its later wait nor the reproduction below establishes that cause.

## Bounded concrete defect and production repair

Published custody called `pump_output()` before `waitid(P_ALL, WNOWAIT)`.
One pump can perform sixteen durable output writes. A child already stopped
at PTRACE_EVENT_EXIT cannot close its writers or notify its real parent until
the tracer consumes that stop and resumes it. Storage latency therefore
needlessly delays a pending terminal barrier even though its kernel status
is already available. Existing `exit_wait()` only prioritizes exits whose
initial EXIT stop has already been consumed.

The repair checks the real pending wait first and pumps output only when no
status is pending. At ECHILD it still pumps until real command EOF. Every
write retains its flush/fsync, journal hash and gzip finalization. Creator
scanning, queued resumes, nonleader EXEC binding, identity checks, immutable
deadlines and real waits with separate EOF requirements are unchanged.
No terminal adapter production file is changed.

The new regression runs a real Node parent spawning native `/bin/true` or
`/bin/false`, with separate child stdout/stderr pipes and concurrent command
output. A ptrace hook waits for the real native EXIT stop before allowing the
supervisor loop to proceed. A one-shot command-output storage stall overlaps
that pending stop; no status or EOF is fabricated. The external observable
60-second watchdog is armed before releasing custody and is actually waited
with SIGTERM after each fixture. All fixture children are actually waited.

The exact retained adapter's 14/16/18-second schedule was also exercised with
a 19-second injected storage stall:

- Published 2df8 old FAIL: native EXIT release delayed 19.019 seconds; adapter
  receipt at 18 seconds has terminal=null, stdoutEOF=false, stderrEOF=false,
  drained=false, normal=false, with actual TERM/KILL escalation.
- Patched new PASS: native EXIT released in 2.6 ms; exit 0 and separate EOFs
  produce normal close in 75 ms, without escalation.
- Patched native exit 1: actual wait status 256 and both EOFs, normal=false.

This is a causal proof for the bounded scheduling defect under controlled
storage latency, not a reproduction of all Chrome shutdown behavior. The
committed regression uses ordinary Node close observation and has no dependency
on untracked Warcraft WIP; the retained adapter is an explicit optional input
for the exact 18-second control. Its recovery patch and hashes are evidence.

## Validation and next step

39 custody tests pass, including native EXEC, creator cancellation barriers,
identity/reuse failures, missing waits, missing EOF, gzip integrity, independent
watchdog and adoption controls. Focused final output/command tests and exact
18-second adapter controls pass. `flock /tmp/wine-build.lock bash tools/build.sh`
passes. Git base, owned small patch and retained adapter input patch are in
`source-recovery.json`; no source/media/module archives were made.

Next: separately authorized fresh runtime can test normal close with this
published custody fix. Warcraft0350 and historical 0244 remain UNKNOWN pending
actual causal evidence. No box was created: ID/state/expiry/stop receipt are
NOT_CREATED/null. Single task stops after publishing this bounded repair.
