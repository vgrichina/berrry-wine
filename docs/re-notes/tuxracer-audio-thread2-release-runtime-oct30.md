# TuxRacer SDL audio mutex release boundary — 2026-10-30

The actual cooperative runtime releases the SDL audio mutex. Main can miss the
release because the audio worker reacquires it before main's next scheduler
poll. A candidate release-boundary scheduler poll restores repeated main
acquisitions and title animation. Native input/menu progression remains
unverified: the retest controller incorrectly required the old frozen title's
exact PNG hash and consequently sent no key. No third execution was attempted.

## Actual execution and causal evidence

Two original-game executions used app `tuxracer_original_061a`, Node24.22.1,
software GL, and cooperative guest threads (`--no-threads` does not disable
guest audio threads). Both used the retained 692809-byte runner SHA256
`f96e9bb924700ee571e2904e097f80742ff55638399898ae1dc32454af05b02d`
and 1881806-byte module SHA256
`5a39225e1a8381ce1c4530d2ce7cd6311bd75576d10968c20e963baf033d41eb`.
Neither runner nor module was rebuilt or edited. The task-only preload observes
actual ThreadManager wait/release calls and the actual WinMM header completion
write. Every wrapped original call is forwarded once. Sync records are read
through the manager's exported table view and `_getSyncIdx`; audio header
addresses come from the completion function's arguments. No guessed addresses,
forced unlock, callback injection, disabled audio or guest control writes.

The original run lasted23.212s, exit0, peak group RSS286535680 bytes.
Mutex0xe0004 had8978 successful thread2 releases,8979 thread2 acquisitions,
and8202 failed main scheduler polls. All8978 observed wave submissions reached
the real WHDR_DONE write (flags18→3); registration type3 was a function
callback. Main's observed callback-active state confirms callback activity,
without claiming every callback was delivered.

The retained terminal sequence removes the coarse-sampling ambiguity:
main is parked on0xe0004; seq622232 successfully releases owner2/count1 to
owner0/count0; seq622233 submits a real audio buffer; seq622234 reacquires
owner2/count1; seq622239 main's next poll returns WAIT_TIMEOUT; seq622240
completes that buffer. No intervening scheduler slice occurs between the
release and reacquisition. `observation.json` retains these exact events.

## Candidate and bounded retest

`mutex-handoff.patch` adds one ordinary `checkMainYield()` at a final successful
mutex release when a cooperative worker releases the exact mutex on which main
is already parked in a plain wait. The normal scheduler acquires/completes that
wait before the releasing worker can reacquire. It does not execute main
recursively. Worker-backed execution, wrong owners/handles, partial recursive
releases, nonmatching waits and multiple-object waits retain their prior path.

The original-source test reproduces reacquisition before main's poll. The
candidate tests verify main ownership/count1, one ordinary completion, rejection
of the releaser's zero-time reacquisition, recursive acquisition/release, and
the excluded cases above. Preload tests verify forwarding and reject missing
audio instrumentation markers. Test output is included in `observation.json`.

The sole candidate retest lasted55.810s, exit0, peak group RSS347926528 bytes.
Main acquired/released the audio mutex938 times, compared with3 in the original
run. The audio worker now also parks on the real mutex (913 blocking waits).
Both runs reached the actual title. The original capture stayed byte-identical;
the candidate capture shows the same PRESS ANY KEY TO START title with changed
snow animation. Both selected640x480 frames were personally inspected.

The retest's old exact-hash title predicate rejected that animated frame.
Its controller reports `actual title render not observed; no input sent`,
which is a controller rejection, not an absence of the actual title. Zero native
key commands were sent in the retest. This establishes restored mutex handoff
and title liveness; it does not establish input consumption, main-menu access,
race progression, or a fully accepted production fix. A future input acceptance
needs a title predicate that permits animation; no further run is authorized
by this task's two-execution limit.

## Source identity and recovery

The reported historical source revision is
`a998bf36b108275335af501d8ae774731495b9b2`. As already documented for its
retained runner, this is not sufficient to recover exact deployed JS bytes:
its Git thread-manager blob is229006 bytes, SHA256
`afbd576a564dcc304d11c885b70b4a1ccd65db9a40e1407ac45ea0f098d7f08a`.
The actual retained library is227263 bytes, SHA256
`f4ba190b2dbf5e2cf2dac82398577bedfb13aa26d332fb7480b4d9d7e4ea2f78`;
candidate227988 bytes, SHA256
`92a5671ad712d9ac943559a009496000e28a7fe98f34e66c2f453ba8fc9bac3d`.
The recipe deliberately rejects every other source identity. The patch is
historical-runtime WIP, not current-main qualification or integration.

The task parent65435857077f14303e0fe2be83b1df416715be6f has no
`lib/thread-manager.js` entry. This branch therefore publishes the exact tested
patch, pinned application recipe, tests and evidence under its task-only path;
it does not manufacture a complete production source tree from a different
historical Git blob. No main branch or shared-root file was edited.

Boat `bx_7t9jk37y` was forked once from the freshly verified stopped snapshot
of `bx_9wfvrup2`, TTL1800, with independent watchdog and explicit all-path
shutdown delegation. After both terminal boundaries and evidence preservation,
snapshot completed/verified11:11:52.422Z and stop completed11:11:52.517Z.
Raw observations, full canonical mount enumerations, supervisor/startup records,
original-library recovery gzip and patch are in retained remote archive
`/home/user/tuxracer-render/audio-thread2-handoff-closed-oct30.tar.xz`,
363792 bytes, SHA256
`9507ba51af0d3debaddc241fb9082e10862c8d279dc225be3e4d272f80321782`.
Retrieve only selected required members through a separately authorized lifecycle.
The stopped snapshot also retains the original module/assets/runner and prior
`audio-mutex-closed-oct30.tar.xz` (308736 bytes, SHA256
`15a0aada0115d58e8931ba1f200d8e356c2127444065f59fa3b8b961f3a0a499`).

The previous unpublished mutex observation and its allocation denial remain at
`/tmp/tuxracer-main-menu-race-progression-oct30/tuxracer-audio-mutex-causal-runtime-oct30/`.
The prior closed stall observation is preserved by its completion receipt and
closed-task archive. They are supporting history, not replayed acceptance.
This follow-up publishes the useful new causal boundary and candidate WIP.

Selected media is287381 deduplicated bytes, selected observation5078 bytes.
Full physical-union allocation includes inherited roots and this worker's actual
rollout/launcher, with separate8MiB work and8MiB publication reserves; RAM
admission is off. Git DATA256MiB applies only to Git children, Python DATA128MiB
to controlled Python children; Node startup records show no inherited DATA or
address-space cap. Generated-file limit12MiB is separate from capture512KiB
per stream/4MiB aggregate. Exact unchanged wrapper receipt is reused; original
denials remain intact. Coordinator owns shared messageboard delivery.
