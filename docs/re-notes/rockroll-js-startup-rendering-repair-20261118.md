# ROCKROLL startup preparation repair, 2026-11-18

Run: `scratch/runs/20261118-rockroll-js-startup-rendering-repair/`.

The prebinding failure was reproduced as a preparation problem: the previous
capture helper enabled V8's debugger on the page and native guest/render Workers
before startup to collect module bytecode. An authored native public-COM Device2
fixture measured its 50-million-iteration startup work at 5.724 seconds with that
attachment and 2.220 seconds with deferred inspection. This is native workload
latency evidence, not an FPS measurement or a Windows reference.

`tools/rm-startup-run.cjs` inventories actual instantiated module bytecode after
the motion interval. Startup and motion therefore run without the debugger.
The same 15-second admission deadline, 300 ms stable geometry interval, completed
native presentation requirement, ownership/generation baseline, null-viewport
secondary attachment and three-second whole lossless capture limit remain.
Timeout observations are serialized. A late screenshot cannot initiate another
state query after its scope has closed. There is no runtime/asset change, longer
clock, missing-file suppression or rendering-guard exemption.

The self-contained native fixture and inventory/late-capture controls live in
`test/test-rm-startup-run.cjs`; they read no retained run directory. The fixture
uses public Device2 indexed drawing to RGB565 with D16 depth and an authored
integer startup workload. Admission starts at navigation for these controls,
which is stricter than the original's native window/stream checkpoint. The
200-million-iteration early-debugger control refused at the unchanged 15-second
limit, with no baseline or image. Deferred software admitted in 14.365 seconds;
deferred WebGL admitted in 7.406 seconds. Both produced the expected blue/white
whole 1280×960 image, completed DRAW_UP/PRESENT records and three actual matching
page/guest/render module receipts. Early exploratory controls, including a
misplaced workload outside the entry checkpoint, remain explicitly separate.
An initial WebGL assertion exposed a scalar observer being overwritten by the
unused software executor; the repaired observer keeps separate executor records.
The corrected WebGL control passed. Existing inspection geometry, generation,
never-ready, unstable, stalled and whole-image refusal controls also passed.

## Two authorized originals

Exactly two fresh registered `/s` originals ran serially, with no guest input.
JAZZ's accepted software/WebGL pairs from
`20261118-rm-jazz-rockroll-paired-rendering` were reused, never rerun.

| Original | Startup | Meaningful whole-frame motion |
|---|---|---|
| ROCKROLL software | Admitted in 5.410 s | Passed: guitars/picks change pose, placement and extent against the sunset gradient |
| ROCKROLL WebGL | Passed the unchanged finite prebinding guard and secondary attachment | Unproved: external supervisor SIGTERM closed the scope before its first capture |

Software completed `GpuStreamSoftware` DRAW_UP 388 → 895 and PRESENT 12 → 31
across the two reviewed 1280×960 images. The first shows a large edge-on guitar
ring and distributed picks; the second shows a compact, face-on guitar grouping
and central picks. This is substantial scene motion, not a cursor/overlay-only
change (224,044 whole-frame pixels differ). Native `d3drm.dll` load/import receipts and all ordinary registered assets
are retained; media hashes are unchanged. Three actual module inventories match
`06eaa397b64a453ca830b39dad70d63e409bd2f3d2d6bd586687eb0bef541023`.

The WebGL supervisor received SIGTERM from an unknown sender, then killed its
remaining native child after the existing five-second grace. Its receipt says
`leaked:false`; its disk guard did not fire (sampled minimum 2,208,165,888 bytes).
This was neither startup refusal nor a demonstrated render crash. No screenshot,
executor sample, deferred actual-module inventory or final harness log survived;
those observations remain unknown. Saved baseline/attachment files establish
startup admission only. No later endpoint request, rebind or replay occurred.
A request for one additional fresh WebGL original was submitted; it has not been
authorised at the time of this report. No third original is claimed.

## Source, checks and lifecycle

The repaired helper/test commit is `a373de9ba`. The locked canonical build passed
after the async worker refreshed its owned producer reviews; the initial foreign
producer-hash refusal is retained. Only the two owned helper/test paths were
committed, followed immediately by strict pull/push. The canonical mixed tree's
module is distinct from the immutable original runtime and is not substituted
for its execution identity.

Both originals used exact runtime Git `3ab982f2d53a2beb354afe06ed3887860b716ad6`
and the retained `06eaa397...` module, with recorded passive scalar observer
suffixes. The current tree and foreign GPU-stream/host-import/test-run work were
not adopted into either original. Git, binary diffs, new-file patches, modules,
media paths/hashes and recovery recipes are recorded; there are no source-tree
archives, media copies, frame series or new workers/boxes/deployments.

`tools/native-supervise.cjs` provided finite process-group/descendant ownership
and actual child wait receipts. Software's browser close was awaited; WebGL's
external termination has a complete supervisor receipt and absent survivors.
The submitting tool combines stdout/stderr; it does not establish separate EOF
receipts for those originals. No native File/Quit or guest ExitProcess is claimed.
A run-local JavaScript durable wrapper passed caller-SIGTERM survival, separate
stdout/stderr EOF, and owner-SIGKILL/independent finite watchdog cleanup controls,
for a future authorised fresh scope. It did not launch a third original.

Home remained above 1.5 GB; no RAM gate. Box ID null, state NOT_CREATED, expiry
null, stop receipt N/A. Full27, backend parity, FPS, audio and Windows reference
correctness remain open. Startup repair is demonstrated on both originals;
meaningful motion is demonstrated on software only, so the complete task goal
remains unfinished. Result metadata is written last. Release and stop.
