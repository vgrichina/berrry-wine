# Q3 startup: durable supervisor service consumed the image window

Evidence: `scratch/runs/20261110-q3-startup-deadline-cause-0053/`.
Source baseline: `f2e91406d724b894830b6abe467059569409dc73`.
Retained native run: `20261110-q3-stable-owner-native-progress-0043`.

The demonstrated bottleneck is synchronous durable journal service in the
native supervisor, while it controls stopped tasks. This is a source-backed
causal finding, not a guest failure or a repaired native gameplay claim. No
new box was allocated and no original was retried.

## Timing and awaited stage

The prior remote image command was published at 00:46:31.830177Z. Its Python
body assigned `due=time.monotonic()+50` upon remote execution. The exact
execution/start timestamp was not retained: publication is a lower bound,
not permission to infer the deadline origin to millisecond precision. Owning
cancellation was recorded at 00:47:21.916535Z, 50.086358 seconds after command
publication.

The retained endpoint receipt measures **23.849 seconds** awaiting a complete
DevTools endpoint after browser spawn. First CDP request entry was
00:47:01.660Z. The page-session `Target.setAutoAttach` request 6 was awaited
from 00:47:01.724Z to 00:47:11.922Z: **10.198 seconds**. Its valid response
resolved before `Page.enable`, `Runtime.enable`, and pre-navigation script
installation. Those stages completed within another 18 ms. `Page.navigate`
was sent at 00:47:11.940Z and remained pending at owning cancellation, about
**9.976 seconds** later. Thus request 6 did not time out, and navigation's
20-second CDP deadline was not the first failure.

The native runtime deadline was 00:54:26.798422Z, **424.881887 seconds after
owning cancellation**. The independent image observer exhausted its local
50-second allowance first. Neither deadline was extended. Zero native inputs
and zero screenshots crossed the native pre-send boundary.

## Measured service and source dependency

All 438 `Journal.write` samples were retained without truncation. They total
**80.182163 seconds** over startup and cancellation cleanup; maximum single
write was **2.930870 seconds**. Do not assign that entire total to startup.

| Retained interval | Wall seconds | Journal service seconds |
| --- | ---: | ---: |
| Image-command publication through cancellation (bounded window) | 50.086358 | 49.358286 |
| First CDP pre-send through navigation pre-send | 10.279125 | 10.221787 |
| Awaited page-session autoattach request 6 | 10.198000 | 10.140663 |
| Navigation pre-send through cancellation | 9.975880 | 9.952762 |

Intervals are clipped intersections with nonoverlapping service samples, not
a sum of unrelated durations. The paired epoch/monotonic launch records agree
within 1 ms. Python and Node monotonic records come from the same retained
native host; this analysis never subtracts a browser or local-machine clock.

`tools/q3-startup-custody.py` measures the actual synchronous `Journal.write`
call. The authenticated provider `tools/native_kernel_custody.py` implements
that call with stream write/flush, raw flush, and `os.fsync`. The Q3 adapter
also requires `journal.flush_pending()` before each actual `CONT`. Therefore
the supervisor cannot release that task until the measured service returns.
The retained journal records real consumed stops, child lineage, and subsequent
`ptrace-cont-returned` records during request 6; this is an actual supervision
dependency rather than an inference from CDP nonresponse alone.

The measurement includes compression, flush, fsync, and time descheduled
inside the write call. It does **not** isolate fsync latency or prove the
Chromium-internal dependency of request 6. The defensible causal statement is
that required synchronous durable service withheld task releases throughout
the controller's available startup window. It cannot establish guest readiness
or a native arena failure.

## Validation and repair boundary

`tools/q3-startup-deadline-cause.test.cjs` independently verifies each reused
native artifact against its retained SHA and size, checks clock alignment,
computes the intersections above, and binds them to the authenticated provider
and Q3 adapter. It then executes the actual sealed generated consumer with a
Node protocol peer and real ptrace custody. Controls cover normal stage ACK,
delayed page-session ACK with injected slow durable service, protocol refusal,
socket closure, synchronous send failure, and withheld ACK through the unchanged
20-second CDP timeout. Each checks the first failure, no subsequent native
protocol/input/capture/navigation/quit, actual child waits, separate pipe EOFs,
and complete kernel drain. These offline controls establish supervision and
consumer behavior, not native Chromium or guest execution.

The first offline invocation incorrectly expected SIGTERM for the withheld-ACK
peer. Its existing independent 35-second cap actually exits with code 9 before
the unchanged 20-second CDP timeout plus 20-second cleanup grace finish. The
expectation was corrected in this task, retaining the original failed log and
all real waits; neither cap was extended. The corrected control still requires
the CDP timeout to remain the first failure. Final suite evidence is under
`controls-2/`; the locked build log is `build-final.log`.
All six corrected generated-consumer cases pass. The delayed ACK measured
423 ms and the withheld ACK failed at 20,002 ms. The same worker's locked
build passes. Independent final protocol audits match the exact expected
prefix in every negative, with no later send. This run's evidence containment
audit passes; the repository-wide scan retains 23 unrelated existing errors.

No scheduling edit in the assigned consumer has been demonstrated to remove
this service cost. The existing Q3 adapter already batches records until actual
CONT barriers. Skipping durable barriers, moving the image deadline, dropping
custody, or claiming the valid autoattach reply was a guest fault would not be
a supported repair. Shared providers remain unchanged. With no tested causal
runtime repair, the conditional authorization for another native control and
original was not exercised.

The concrete next implementation target is durable custody service at executable
task-release barriers, preserving identity/lineage, ordered durability, terminal
retirement, sticky storage failure, and immutable deadlines. Validate an actual
service improvement before spending the one changed native control. The current
task ends with the verified source-backed finding and regression controls.

No owned box exists; box ID/expiry/stop receipt are inapplicable. Preexisting
`bx_j3afnurx` was untouched. Its retained final state remains ARCHIVED, expiry
null, completed unforced receipt `stop_a32b16d0d46e1199`; no new API request or
stop was sent to it.
