# Darkstone close escalation: terminal drain before quit ACK

The offline repair makes quit completion wait for the actual browser terminal
and ChildProcess `close` receipt. A CDP reply, destroyed worker targets, or
`kill()` returning true cannot publish cleanup or authorize profile removal.
**Historical 1910 remains SIGKILL / normalChrome UNPROVEN.** No Chrome, game,
remote runtime or box was started for this task.

Evidence: `scratch/runs/20261108-darkstone-close-escalation-1925/` (R).
Historical source and receipts remain unchanged in
`scratch/runs/20261108-darkstone-bat-continuation-1910/` (H).
See [the saved continuation and terminal limitation](darkstone-bat-continuation-20261108.md).

## Concrete cause and limits

The selected H/browser.cjs SHA-256 is
`2535a4fea2ad1acbc245d10fd00cc6c583913095aacdc9cd92462c4d6b346a2f`.
Its close routine waits eight seconds after Browser.close, sends TERM, waits
five seconds, sends KILL, and proceeds immediately to profile removal and
`t.closed`. It checks only `exitCode !== null`; signal exits retain null code.
It never waits after KILL. Concurrent calls return immediately when `closing`
is true. H/transport.cjs publishes a successful quit reply after close returns,
so this ordering can ACK before the OS terminal receipt.

| UTC, 2026-11-08 | Concrete receipt |
| --- | --- |
| 19:16:01.148 | `close-reason.json`: ordinary completion |
| 19:16:01.164–01.185 | `target-lifecycle.jsonl`: page and worker targets detach/destroy |
| 19:16:02–07 | custody history samples Chrome root 6507 repeatedly in traced-stop state `t` |
| 19:16:07.159 | kernel journal releases root after fork of 11745 |
| 19:16:10–19 | root repeatedly sampled `t`; teardown remains in progress |
| 19:16:14.179 | `cleanup.json`: code null, before real terminal receipt |
| 19:16:14.192 | finish-run remote command completes with successful quit reply |
| 19:16:19.731 | kernel pre-exit stop for root |
| 19:16:20.158 | actual kernel terminal reap: status 9 |
| 19:16:20.454 | Node `chrome-exit.json`: code null, signal SIGKILL |

The cleanup-to-Node-exit gap is **6.275 seconds**. The recorded target teardown
precedes the process terminal by approximately 19.27 seconds. Kernel tracing
is visibly involved in the intervening process states; this evidence does not
identify which teardown operation consumed each interval, prove a debugger
pause deadlock, or establish when Chrome would have exited without escalation.
No guest worker stop ordering was changed on speculation. The kernel peer was
notified on the messageboard; its source and tests were untouched.

The repaired kernel's **357/357 actual reaps** remain a separate custody result.
They cannot turn this browser's SIGKILL into normal exit. Earlier 1810 and 1844
results retain their own distinct conclusions.

## Repair and future entry point

`tools/native-browser-close.cjs` installs one exit/close observer before issuing
one CDP close request. Exit code **or signal** establishes terminal status;
ChildProcess `close` establishes that its stdio also drained. It records the
close ACK/UNKNOWN, every signal request, the real exit and drain, and the final
receipt. Neither a disconnected nor never-settling CDP request blocks the
finite process deadline, and the close request is never replayed.

The bounded schedule is **20 seconds graceful + 5 seconds TERM + 5 seconds
post-KILL drain**, measured from one start time. The extra graceful allowance
accommodates the observed scale of traced teardown rather than the old eight
seconds; it is not proof that historical Chrome would exit normally within
20 seconds. All phases remain finite. Existing pre-close diagnostic CDP reads
retain their individual 20-second timeouts; the 30-second cap applies to the
process-close phase. A code-zero TERM handler is still recorded as escalated,
not normal graceful shutdown.

`tools/darkstone-browser-driver.cjs` is an exact-SHA guarded adapter over the
selected driver, avoiding edits to historical runs or a second full driver
copy. It shares the close promise across concurrent deadline/quit callers.
Successful drain precedes `browser-terminal.json`, profile removal, server
closure and quit ACK. At the drain cap it writes `browser-drain-unknown.json`,
sets failure status, releases CDP/server handles, retains the profile, and
propagates failure into the unchanged transport's sticky no-replay handling.
No cleanup or successful quit ACK is published on that path.

A separately assigned fresh run must invoke:

```sh
node tools/darkstone-browser-driver.cjs scratch/runs/NEW_RUN/browser.cjs
```

The fresh helper must retain the exact selected browser bytes. Before any new
runtime, its source selection must explicitly include and hash the new adapter
and close helper, and its launcher must use this entry point. The old
`node NEW_RUN/browser.cjs` entry point remains historical and unrepaired. This
task did not provision or claim acceptance of a new browser selection.
Independent input releases and the input/transport code remain unchanged.

## Meaningful offline validation

**10 focused controls pass** in R/focused-final.log.gz:

- Actual delayed process exit after fake-CDP ACK: no premature return/signals.
- Actual stubborn child: TERM, KILL, explicit SIGKILL receipt, actual pipe drain.
- Rejected and never-settling disconnected endpoints: finite cleanup, one request.
- Already signaled child: no extra close or signals.
- Historical selected close routine with only wait durations scaled 100:1:
  premature cleanup with null code/signal, followed by actual SIGKILL exit.
- Real inherited stdout writer surviving root exit: wait for pipe drain, and a
  separate cap-expiry case retaining terminal code zero but drain UNKNOWN.
- Exact repaired close/execute functions and actual unchanged transport consume:
  concurrent close callers share completion; profile and real HTTP port drain
  before quit ACK; cap-expiry variant retains profile, writes sticky failure,
  and produces neither cleanup nor quit ACK.

These tests run the selected routines with real OS child processes and a real
HTTP server. Fake CDP supplies only command replies; process exit and pipe
closure are observed from actual OS events. A subreaper runner consumed actual
terminal waits for all three adopted pipe-writer controls, exit zero. Its
prearmed independent GNU timeout watchdog and compressed-stream receipts are
retained. This is not a Chrome/game normal-shutdown proof.

`flock /tmp/wine-build.lock bash tools/build.sh` passed, logged directly to
R/build.log.gz with original-byte SHA-256/size and independent decompression
reread verification. No bulky uncompressed duplicate was written. The same
recovery command is `gzip -dc R/<name>.log.gz`.

R/existing-evidence-verified.json records the unchanged **548 providers /
42 helpers**, exact fallback path/Git objects, and all **68 accepted proof**
hash rereads. Accepted fixtures were not rerun. Existing source, media and
module paths/hashes were reused without archives or copies. R records the
Git revision and small owned binary patches; no peer WIP is archived.

The final1910 pair remains retained and **not reloaded**:
`characters.lpl` 1,342,316 bytes, SHA-256
`4762ae9c0d7d048595433d121629a87d5a1aa24e7c3ebe84c7605006e3c10baa`;
`game641d_6af0ca48.sav` 3,204,341 bytes, SHA-256
`5e898dc9d6f7a13350c939bf5b712eccfff95ef1072c93023103705999f84ffc`.
Live BAT, last numeric LIFE **16/35**, post-save numeric health unknown. Further
gameplay belongs to a separate task with fresh current-state review.

No boxes: ID/state **none / NOT_ALLOCATED**, expiry and stop receipt N/A.
Disk was briefly sampled below the shared 1.5 GB floor; writing/build work was
paused and the coordinator notified. After coordinator cache cleanup, focused
tests and build proceeded above the floor; no continuous global-floor claim.
No old runs were deleted. Full27, parity, audio and FPS remain open.

Next: publish this repair, then STOP. A future assigned original must retain
the actual Chrome terminal and drain receipt before claiming normal shutdown.
