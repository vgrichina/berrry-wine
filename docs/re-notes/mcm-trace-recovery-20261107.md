# MCM trace recovery: transport works, production stream exceeds cap

Chrome's actual tracing start/end/stream lifecycle works on an idle page. The
single subsequent production `dx_boids` sample received a completion notification,
but its stream exceeded the **64 MiB cap before EOF**. The retained production
trace is incomplete. **GPU execution versus scheduling remains unknown**, and
there is no demonstrated production repair or speedup. The sample was not repeated.

Evidence: `scratch/runs/20261107-mcm-trace-recovery/`. Predecessor:
[`mcm-gpu-service-20261107.md`](mcm-gpu-service-20261107.md), `0b95dee4a`.
Only this note is committed; all drivers, controls, logs, traces and patches are
run evidence. Production module, automatic configuration, native16 copy/draw/query
ordering, error checks and exact input guards remain unchanged. Zero input,
original launches, box launches or nested workers.

## Actual lifecycle and terminal failure

The retained `next-trace-browser/control` was adapted into the owned run. One
Chrome process first traces `about:blank`, before navigating to any guest workload.
Both phases select timeline/user timing and the required GPU, service, decoder
and command-queue categories. There is one immutable browser deadline,
15:27:31.447Z, established before launch; completion waits are at most 60 seconds
and stop 15 seconds before that deadline. Stream reads preserve a cleanup reserve.
The cumulative stream write cap is 67,108,864 bytes. Notification logging is
bounded to 1 MiB, with uncapped notification counters.

| Check | Idle lifecycle | Production sample |
| --- | --- | --- |
| Start/end accepted | yes | yes |
| `Tracing.tracingComplete` | yes | yes |
| Producer `dataLossOccurred` | false | false |
| Stream EOF / valid whole JSON | yes / yes | **no / no** |
| Retained stream bytes | 135,044 | 66,846,720 |
| Clock markers found | idle marker | both Worker markers in prefix |

The idle marker, parsed nonempty trace and EOF pass the transport gate before
the production navigation. Production tracing begins at 15:24:15.213Z. End is
accepted at 15:24:57.070Z; completion arrives at 15:25:04.079Z. At 15:25:05.459Z,
the next stream chunk would exceed the cap, so the first terminal failure is
preserved, the partial stream is closed, and Chrome is closed. Total retained
stream bytes are 66,981,764. The production JSON ends inside an event; no tail
metadata or EOF was recovered. A false producer loss flag does not make this
capped transport complete. The predecessor's missing completion is not explained
by this later run's successful notification.

`trace-notification-counters.json` records 43 notifications, 6046 logged bytes,
zero notification drops: two completion notifications and 41 buffer reports.
No unbounded inline event logging is used.

## Coverage and limits

`python3 scratch/runs/20261107-mcm-trace-recovery/analyze.py` validates recorder
expiry, zero drops, paired retained spans, all instrumented guest/service/fence/
replay calls against uncapped counters, one error query per native16 store, and
wrapper restoration. Guest has 204 rows; renderer has 2216. Five delayed identity
reads, 3102–7852 ms, fall within both recorder coverage windows. All 13,678
recorded error queries return zero. These are observations under instrumentation,
not comparable performance measurements or removable-query evidence. Fast calls
are counted; sparse renderer rows retain slow calls, errors and successful polls.
Coverage excludes startup, uninstrumented functions and calls pending at read.

The retained prefix contains 400,665 complete event lines. `gpu` and
`gpu,toplevel.flow` account for 57,208,341 bytes of those lines. Names include
`Scheduler::RunTask`, `Scheduler::ScheduleTask`, `Scheduler::FinishTask` and
command-buffer service events. Prefix presence does not establish complete
service execution coverage, matched scheduling spans or hardware execution time.
No execution/scheduling attribution is made from these incomplete events.

Both unique Worker `console.timeStamp` markers match retained events and Worker
sessions/threads. `timeOrigin + now` differs from `Date.now()` by less than 1 ms;
the two local wall-minus-trace offsets differ by about 0.288 ms. This establishes
marker correspondence in the prefix, without verifying clock coverage across a
complete trace. Missing service/execution detail remains unknown.

Source SHA is `c1b447b7c686b937a8b579c668a54fce7fb03c11`. Relevant dirty hunks
and new `lib/wininit-boot.js` are binary patches; owned run scripts and this note
also have patches. Both actual Workers identify the production module
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`, 2,182,493
bytes, retained once. Chrome is 151.0.7922.108. The bound production statistics
report ANGLE / Intel UHD Graphics 620 / Mesa 23.2.1; the separate early backend
probe has empty targets and does not supply that identity. Served responses are
verified against existing paths/hashes: 171 source responses and 39 media
responses. Media is referenced, not copied. No source or media archives.

## Exact next executable diagnostic

The **unlaunched** `next-short-browser.cjs`, `next-short-control.cjs` and
`next-short-spans.cjs` retain the idle lifecycle gate, required GPU categories,
markers, sparse probes, cap and deadline. They explicitly exclude unselected
categories and reduce the production trace body from two bound captures to
**one bound `chain.readLive()`**. Keeping `gpu` preserves the category that
actually emitted the observed scheduler/service events. The shorter window is
a transport diagnostic, with no promised size, service detail or speedup:

```sh
CASE=short SPANS=1 BROWSER_DEADLINE=$(($(date +%s%3N)+210000)) \
  node scratch/runs/20261107-mcm-trace-recovery/next-short-browser.cjs
```

This command was prepared and mock-tested, not executed here. A separately
authorized run must obtain EOF, valid complete JSON, loss indicators, clock
markers and complete relevant probe coverage before attributing execution or
scheduling. If hardware execution detail is absent, it remains unknown. No
timeout, yield, slice-budget, freshness, error-suppression or native16 ordering
change is justified. Any later production repair still requires error injection
before completion, primitive ordering/state restoration regressions, focused
tests and the locked build.

## Verification and handoff

Run-only controls pass trace lifecycle/EOF/marker checks, unavailable-category
rejection, missing completion, producer-loss rejection, the cumulative cap and
stream closure. Sparse-recorder controls pass native call/return/throw
transparency, ordering, explicit drops with continuing counters, expiry bypass
and restoration. The prepared successor passes syntax and controls proving one
bound read, no capture/input and both recorder reads/disposal. Existing Node
async-readback and GPU-batching tests pass. No accepted fixture matrix was
repeated. No production source change or new locked build is claimed.
The global evidence checker reports existing Alice and Tunnel/Twist containment
errors and historical missing/invalid records; none names this run. Own artifact
hashes and containment are verified separately in `evidence-manifest.json`.

Chrome exits zero. Driver/Chrome PIDs are absent, ports 41821/37739 closed,
profile and writer absent, guest/renderer wrappers restored. The board watcher
is stopped at release. Free disk remains above 2 GiB at recorded checks. No box
was assigned: ID/state/expiry are not applicable; coordinator lifecycle ownership
is unchanged. Evidence and the first failure are retained; stop after this one
bounded task, own-file commit and immediate main pull/push.
