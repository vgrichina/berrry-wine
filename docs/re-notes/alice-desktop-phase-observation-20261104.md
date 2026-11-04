# Alice desktop request observations, 2026-11-04

The original Alice batch1681 `ETIMEDOUT` cause remains unknown. This change
adds diagnostic evidence for a future authorized execution; injected controls
do not reproduce or repair the original failure. Input diagnosis:
`af727325512faa8855efba86adefd6a11c1b4f9b` and
[the retained timeout analysis](alice-desktop-timeout-20261104.md).

## Opt-in trace and interpretation

Set `WINE_PROCESS_DESKTOP_OBSERVE` to an existing, private, writable, local
run directory, or pass `observeDirectory` to `ProcessDesktop`. Each main client,
authority and bridge writes its own mode0600 fixed-size file. No logging,
preload hashing, request ID generation or additional wire metadata occurs with
observation disabled. The enabled trace is synchronous diagnostic I/O and can
perturb timing; use a local filesystem, never a network mount.

Each file is 536576 bytes: three reserved 4096-byte slots for identity, first
error and exit, followed by 128 rotating phase slots. Memory per write is
bounded; there is no accumulated event array in a worker. A root desktop has
three files; each additional client adds two. Use a fresh directory per bounded
run; file count follows participant count, not poll count. Normal client close
closes its trace descriptor; worker descriptors close on thread exit. Run files
remain for evidence recovery. This is a bounded recent history, not a complete
audit trail. Each JSON slot has a SHA256 checksum; the reader skips incomplete
or checksum-mismatched slots during concurrent writes;
missing/overwritten/torn records cannot prove non-execution. It returns sorted
records for offline analysis and should not be called on every guest poll.

Records use `process.hrtime.bigint()` nanoseconds, PID, Node threadId, role,
writer serial and a random client ID plus per-client request sequence and known
operation name. An authority shared by several OS processes therefore retains
unambiguous request correlation. No request/window/message payload, endpoint
path, authentication token, raw execArgv or raw NODE_OPTIONS is recorded.
The namespace token is also redacted from captured error stacks. Stack strings
are bounded to2400 characters (further truncated if necessary for a slot).

Phase names are `main-submission`, `bridge-receipt`, `socket-write`,
`authority-receipt`, `handler-completion`, `reply-write`, `bridge-frame-receipt`,
`shared-notification`, `main-return`, `timeout` and `request-error`.
Poll submission includes requested limit and local pending count; authority
receipt/completion include queue before/after and returned message count.
Timeout captures the two response words before terminating the bridge. Word0
is the response-ready flag; word1 can still be the **previous** reply length
when word0 is zero. The words are separate atomic loads, not a coherent
transactional snapshot if a response races the deadline.

Write markers follow `socket.write()` returning, meaning accepted into Node's
socket write path, not kernel transmission or peer receipt. The notification
marker follows the response stores and `Atomics.notify`; the main thread may
wake before that marker is written. Only the normal response path acknowledges
the request. Handler completion, queue removal, reply-write or trace presence
never changes the return value, timeout, delivery status or unknown outcome.
The3000ms timeout and fail-closed/no-retry policy are unchanged. A timed-out
client cannot call again or reuse its response buffer. `firstError` and the
reserved error slot preserve the first request error when observation is enabled.

Worker identity is written from the worker itself, before serving requests:
Linux `/proc/thread-self/stat` TID (null elsewhere), Node version, hashes of
inherited execArgv and NODE_OPTIONS, and a bounded loaded CommonJS module
inventory (`preloads`, including entry/transitive modules). At most eight paths
of200 characters are recorded; files up to1MiB have a SHA256, larger entries
retain size with a null hash. Preserve the separately pinned launch/preload
manifest for the complete inventory. An `uncaughtExceptionMonitor` writes the
first worker error without handling it; worker `exit` writes its code when Node
runs exit hooks. Forced `Worker.terminate()` may skip those hooks. Main records
creation, eventual error and exit callbacks with the original Node threadId;
those callbacks still require a main event-loop turn. An inherited preload can
fail or block **before this module starts**: no worker identity in that case
does not diagnose the cause. Retain inherited preload stderr and supervisor
exit/error evidence as well as the trace.

## Commands for the next authorized diagnostic execution

This task ran no Alice route and touched no remote box. A future execution
requires coordinator `RUNTIME RELEASE Alice timeout`, a newly pinned input
manifest containing this change and the external scheduling observer below.
Do not resume the stopped original box or retry its unknown pending command.
After provisioning the existing pinned local-entry/module-observer preloads,
the launch from the runtime checkout is:

```bash
alice_diag_run="$PWD/scratch/runs/alice-desktop-next-diagnostic"
alice_preloads="$PWD/scratch/runs/20261103-alice-provisioned-dialogue"
mkdir -m 700 -p "$alice_diag_run/desktop"
ALICE_DIAG_DIR="$alice_diag_run" WINE_PROCESS_DESKTOP_OBSERVE="$alice_diag_run/desktop" \
node -r "$alice_preloads/module-observer.cjs" -r "$alice_preloads/local-entry.cjs" \
  test/run.js --app=alice_original_local --no-build \
  --wasm="$PWD/build/wine-assembly.wasm" --quiet-api --quiet-blocks \
  --no-threads --gl-renderer=software --frozen --control=8123 \
  --batch-size=100000 --max-seconds=1800 --trace-input \
  >"$alice_diag_run/original.log" 2>&1
```

Use the existing bounded supervisor/driver with unchanged first-error and
unknown-command handling to launch that command; this bare command specifies
the diagnostic environment and exact guest options, and does not supply the
external sampler. Record the new PID, boot ID, launch/preload hashes, Git SHA
and relevant binary diff before issuing input. The earlier path/app ID is a
run-specific local registration, not a new public app registration.

Read current or recovered traces from another Node process, even while main
waits synchronously:

```bash
node -e 'const d=require("./lib/process-desktop"); console.log(JSON.stringify(d.readProcessDesktopObservations(process.argv[1]),null,2))' \
  "$alice_diag_run/desktop" > "$alice_diag_run/desktop-phases.json"
```

The next runtime **still needs** an external supervisor sampling continuously
from before worker creation through the wait/deadline, before normal cleanup
removes workers. Keep a bounded recent window with monotonic and wall times:

- `/proc/PID/task/TID/stat` (state and CPU times), `status` (affinity), `wchan`,
  `schedstat` (on-CPU time, run-queue wait and timeslice count) and `sched`
  (switch counts), for main and both observed worker TIDs; preserve task
  appearance/disappearance and map TIDs to trace identities.
- Resolve `/proc/PID/cgroup` and mountinfo to its actual cgroup, retaining
  cgroup-v2 `cpu.stat` **deltas** (`nr_periods`, `nr_throttled`, `throttled_usec`,
  usage), `cpu.max`, `cpu.pressure` and `cpuset.cpus.effective`; use corresponding
  v1 CPU accounting/throttling files on a v1 host. Retain process CPU and host
  CPU/load/pressure baselines and deltas so idle time is distinguishable from
  cgroup throttling or runnable-but-unscheduled workers.
- Snapshot the same files on the first observed timeout and preserve errors
  such as ESRCH. Main immediately terminates a timed-out bridge; an external
  poll after the timeout can miss it. Samples **during** the3000ms wait are
  necessary. Exact scheduler attribution or a missed short transition needs
  an external scheduler event trace (for example permitted `perf sched`/eBPF),
  synchronized to monotonic timestamps, rather than inferring it from JS
  timestamps or aggregate process stats. Do not delay production cleanup to
  obtain samples.

A dead bridge with its worker-written error distinguishes a worker failure.
Authority receipt without completion locates the last observed execution
phase. Queue removal/reply-write without bridge receipt distinguishes the
injected lost-reply case. None by itself proves an OS scheduling cause. A
late marker requires the external scheduling/throttling deltas to explain
delay. Pre-module preload failures still require supervisor evidence.

## Focused validation and evidence

Run: `scratch/runs/20261104-alice-desktop-phase-observation/`.
Small test command (no guest module, media or browser):

```bash
node test/test-process-desktop-observation.js
flock /tmp/wine-build.lock bash tools/build.sh
```

The dedicated test is automatically in the unit tier through
`tools/test-tiers.js`; this checkout has no `tools/test-tiers.json`.
The real-worker cases cover disabled observation, real publish/post/one-time
poll transport, full phases and queue counts, checksum rejection of a parseable
torn slot, bounded history wrap and first
error retention, token/payload exclusion, terminated authority, dead bridge,
and a real authority behind a reply-dropping socket proxy. The latter proves
one destructive poll and a discarded reply with the consumed event while the
caller still throws and rejects further calls. A real worker with an inherited
preload exercises worker-written uncaught-error/exit and preload identity.

One attempted final fixture run exceeded the Linux Unix-socket path limit
because the evidence path was long. Its original error is preserved in
`focused-path-limit-failure.log`; the fixture now creates only its proxy socket
under a short temporary directory and removes it afterwards. This was a test
setup error, not a production desktop timeout.

Node v24.18.1 focused results are retained as `focused-final.log`; the required
locked build is in `build-checksum.log`. `input-head.txt`, `relevant.diff` and
`publication.json` record exact source provenance and publication. No source
tarball or copied game media was made. The WAT/game integration test was not
executed; source build validation is not a gameplay claim. No box was assigned
to this worker. Stronghold's separately owned `bx_pmfcmfw2` was reported
RUNNING/idle at00:20Z and subsequently STOPPED by coordinator at00:21:20.638Z
per board00:21:44 (original expiry01:12:18.560Z). This task neither queried nor
changed its state and has no runtime lifecycle ownership to hand back.
