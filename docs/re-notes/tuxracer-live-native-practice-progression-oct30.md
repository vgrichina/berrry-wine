# Tux Racer live native input: acknowledgement without observed consumption

One new original-game execution ran on 2026-10-30, using the retained compiled
module and unchanged historical production runner. Live stdin commands for Enter
down/up, mouse movement and a click at the historical Practice position all
acknowledged. A new renderer capture still shows the title screen, “PRESS ANY KEY
TO START”, personally inspected. This execution does not demonstrate Main Menu,
Practice, course selection, race/gameplay or ordinary Quit. No production defect
or repair is claimed. The previous main-menu observation remains historical.

## Exact execution

Historical source a998bf36b108275335af501d8ae774731495b9b2; module 1881806 bytes,
SHA256 5a39225e1a8381ce1c4530d2ce7cd6311bd75576d10968c20e963baf033d41eb.
Runner 692809 bytes, SHA256
f96e9bb924700ee571e2904e097f80742ff55638399898ae1dc32454af05b02d.
These pins describe the actual runtime, not current main or this report branch.
The registered app was tuxracer_original_061a. No module transfer or compilation
occurred. The canonical validateLocalManifestSync parser verified the registered
manifest and all intended filename-bearing mounts before the guest started;
the complete enumeration is retained in capture/mount-startup.json. No selected
filename contains a comma. Startup used the same Node executable, heap flag,
environment and child limits as the game: Node v24.22.1, installed executable
126879696 bytes SHA256
e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb.

The exact argv in test/tuxracer-live-native-practice-progression-oct30/runtime.json
uses --no-build --wasm=build/wine-assembly.wasm --gl-renderer=software
--no-threads --control-stdin --max-seconds=55, quiet API/block/FS output,
--trace-input-dispatch --trace-main-scheduler --trace-from=16000 --trace-to=100000.
No frozen mode, eval, guest-memory forcing, synthetic guest callback or source
edit was used. Guest startup/initializers ran through the unchanged runner.

Process start 09:40:06.022646 UTC; end 09:41:01.500827 UTC; wall55.478181 seconds;
exit0, no signal; measured child CPU55.889306 user +0.419883 system seconds.
The harness printed its55-second cutoff at batch36930. Final guest EIP0x00a69449;
guest thread1 remained reported active, EIP0x919ab2, yield0, waitH0xe0005.
Peak observed process-tree RSS294178816 bytes. Child CPU60/60, FSIZE12MiB,
group RSS2GiB and external wall90-second guards remained in place. Node DATA/AS
were inherited unlimited; --max-old-space-size=512 is a heap flag, not an RSS cap.
The Node group was killed if present and its child reaped after termination.

## Live commands and the actual boundary

An early snapshot command id1 was sent at09:40:07.048851; no acknowledgement was
observed within8 seconds or later in the captured log. Its cause is unknown and
it was not replayed. The first controller continued observing the same process.
A separate short controller wrote uniquely named commands to the existing
--control-stdin pipe via /proc/10075/fd/0 through supported Boat API execution.
It did not start another guest. Commands were wall-paced; later collected
acknowledgement times establish that each of these native commands completed
before the next was sent. This was a bounded stream, not a batch-only schedule.
The original unacknowledged snapshot remains a qualification gap.

| Command | Host send UTC | Observed acknowledgement UTC | Batch |
|---|---|---|---:|
| new boundary PNG | 09:40:55.566590 | 09:40:55.649102 |34193|
| Enter down |09:40:55.766784|09:40:55.775207|34252|
| Enter up |09:40:56.067077|09:40:56.114885|34407|
| mousemove320,260 |09:40:57.067567|09:40:57.098292|34899|
| click320,260 |09:40:57.467856|09:40:57.482942|35085|
| new after PNG |09:40:59.468191|09:40:59.523705|36065|

These are host/renderer command acknowledgements, not guest consumption.
The click targeted the historical Practice coordinates; this run's title had
not transitioned, so it cannot be described as clicking a visible Practice item.
The bounded log contains four input schedule/action pairs and six successful
control replies, but zero input-dequeue or dispatch-input records. Absence of
those records does not establish absence of queued input. Queue depth, individual
queue provenance and SDL consumption are unknown. The input-state observation
requires frozen mode and was deliberately not used in this live-only task.

At batch34000 (before the Enter command), window-local cumulative mainPolls=2;
at35000 and36000 it is still2. Between34000 and36000 decisions increase from
1150800 to1278800, and runnable/main-runs/returned from1150797 to1278797.
Suspended remains3, threw0, workerPolls/outsidePolls0. Last decisions report
cooperative-interleaved, runnable, yieldReason1. Counters are unsaturated.
Detailed scheduler events hit their256-event cap near16001; the21 separately
bounded summaries remain available. There is no terminal scheduler summary
after36000. This establishes a measured boundary, not the cause of the stall.

The actual renderer wrote new-live-boundary.png at34193 and
new-after-practice.png at36065. Both are640x480,136760 bytes, SHA256
bc919a5423476c23686c8d0231a4480e51b20250338cec7b09b50447641014f9.
They match the historical title image bytes; their new origin is supported by
this run's commands and acknowledgements, not by a new filename alone. The
selected new capture was personally inspected and shows the title. No new scene
or Main Menu transition is asserted.

## Evidence, controls and lifecycle

Canonical external evidence root:
/tmp/tuxracer-main-menu-race-progression-oct30/tuxracer-live-native-practice-progression-oct30.
completion-receipt.json records publication, pins, capture manifest, resources and
cleanup. Raw runtime.stdout remains in the stopped Boat at
/home/user/tuxracer-render/capture-live-native-oct30/runtime.stdout:
58125 bytes SHA256 de660daecf6b36c66aac2da0bd2ea0abc809f76aabe00317be221526684788f6.
Its stderr is empty. A field-select causal extract and both controllers' compact
records were collected; there was no broad archive, snapshot pull or SSH runtime
access. The explicit pre-download selection was189015 bytes including one PNG,
under512KiB. Collector gap: it searched the wrong retained PNG directories and
downloaded the fresh capture even though its bytes match the old title. The
duplicate was subsequently verified and removed locally, with the retained
representative referenced explicitly. Download accounting retains the actual
189015 bytes; this does not retroactively qualify the no-duplicate-transfer rule.

The first API smoke verified the exact module and a unique8-byte file, then failed
reading a missing retained docs/design-agent-control.md. Local documentation and
the retained implemented runner schema were inspected instead. A first remote
supervisor failed before Node startup with MemoryError while reading the installed
126MB Node executable into Python DATA128MiB. A streaming executable hash fixed
that internal wrapper issue without changing limits; failed evidence is retained.
Exactly one original-game execution occurred. Wrapper controls pass a legitimate
655360-byte generated file under12MiB FSIZE, reject600000-byte captured output
under512KiB, and reject omitted/root/donor subprocess working directories.

Local accounting includes every inherited allocation root, relevant launcher and
historical Tux rollout plus this task's exact session01a18c29-7f0c-7933-953d-acb9357915fc
derived from thread.started. Startup used49123328 bytes; complete forecast64987136
including remaining8MiB work and separate8MiB publication reserve fits67108864.
Host free3280502784 bytes at that sample; current user floor1.5GiB after267292672
remaining aggregate growth; RAM admission off. Remote retained allocation peaked
61956096 plus8MiB reserve within256MiB. Final publication accounting is in the
canonical receipt. No closed source staging or old Git index was restored.

Only authorized fork bx_bzsa3u6q was created, from stopped bx_b9s6w3bm,
09:36:37.946 UTC; expiry10:06:37.923; cutoff09:56:37.946,
handback09:59:37.946, shutdown10:01:37.946. Task-owned independent watchdog was
armed before API execution. Explicit delegated snapshot-stop was performed once:
snapshot completed/verified09:42:01.840, actual stopped09:42:01.907,
operation stop_f9abb669d7465083 completed09:42:01.932. The snapshot is later than
this run's terminal boundary. No old stopped receipt was substituted. Ownership
returns to the coordinator with this new box stopped and recoverable. No main
write/merge, other-game change, worker launch, Telegram or public hosting occurred.
