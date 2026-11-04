# GLTron complete review handoff and guarded interval — 2026-11-04

Run: `scratch/runs/20261104-gltron-complete-handoff-interval/`.
Input: `12ab883a545b97051c3a5bdadaa6732897fcbe70` and
`gltron-direct-view-live-interval-20261104.md`. The predecessor's 103 sealed
files, 3,854,998 bytes, remain unchanged; older accepted seals are retained.

The first actual offline queue/shot/successful-ACK relay returned the exact
historical startup PNG, SHA-256
`cf4dbff932964894c71947068cf26c5b60a1992803fc8e86f82664faaeebc840`.
Personally VIEWed that exact ACK path in the same tool invocation: GLTron logo,
yellow cycle and Game/Video/Audio/Quit menu. The immediately following actual
`review-only` invocation passed at 4,814 ms. The actual pre-Chrome gate accepted
that proof. This is historical image replay, not new gameplay or an FPS result.

The failed-ACK negative exposed a real prerequisite defect. The old actual
review client and pre-Chrome gate accepted matching capture metadata despite
the producing shot's failed ACK. `old-failed-ack-gate.json` records the old
producer failure. The causal offline repair binds the reviewed capture to the
latest queued shot, exact shot name, successful ACK and identical capture
metadata, including path, hash and capture epoch. The pre-Chrome consumer
rechecks that binding and rejects a changed proof. No guest behavior changes.
`new-failed-ack-gate.json` records the same failed-ACK producer being rejected
before Chrome. Focused tests exercise the actual client and consumer with
failed/path/hash/epoch ACKs, changed capture metadata and stale/failed proof.

After that repair, personally VIEWed a fresh actual historical queue/shot/ACK
relay under `repaired/offline-relay/`; the immediately following `review-only`
passed at 4,521 ms. The repaired pre-Chrome consumer accepted that exact proof.
The 479 ms margin does not establish latency under browser load or guarantee
live round survival. Neither rehearsal is a logical update interval.

The release gate requires the explicit current
`mdk2-medium-through-loading LOCAL HEAVY RELEASE`; prior MDK task releases do
not qualify. Stronghold's current explicit local release was 20:20:46Z.
One external local flock must cover software then WebGL, one launch per
backend, stopping the entire pair at the first fault. Limits remain 360
combined browser seconds, 60 bootstrap, 60 per command, 180 cleanup, absolute
23:30Z browser / 23:33Z cleanup with full reserve. No diagnostic Chrome.

The unchanged production marker is original `0x4051a9`, entered nonzero-dt,
lifetime count with zero pacing. A live capture must be personally VIEWed
before immediate measurement within the unchanged five-second review guard.
Minimum-five-second monotonic read brackets, reset/wrap checks, exact owning
backend/translation, generation/main thread and all four execution tiers,
visibility, scene/liveness, frozen/host-step and foreign-counter guards remain
required. Positive player speed, winner -1, pauseflag 1 and round/data identity
remain required; callback `0x42a200` alone proves none of these. Startup, Game
menu and paused arena require personal review before dependent ordinary input.
Bounded balanced native A/S maintenance is the only steering mutation. No
guest code/state/config/pacing writes, freeze, host steps or time exclusions.
Accept a rate only after personally reviewing the actual interval's after
capture as live gameplay. Physical GPU performance is not established;
observer, steering and marker overhead remain included, with no quantified
overhead estimate.

## First dependency fault and offline causal repair

At 20:28:39Z an invocation intended to test pre-Chrome release rejection
unexpectedly launched one software Chrome. The loose substring matcher
accepted this worker's 20:27:58Z **waiting-for-release** board entry as the MDK
release. The test invocation also omitted the required external local flock;
the old runner did not enforce that precondition. This was an operator error
and a real launcher defect, not an authorized gameplay outcome. The complete
rehearsals had passed; the resource-release prerequisite had not.

The exact falsely matched board line is retained in
`repaired/resource-releases.json` and `firstfault-causal-repair.json`.
Immediately requested ordinary `quit`, the only queued command: no gameplay
key, scene capture, measurement or WebGL launch. No original/backend retry.
The actual MDK release arrived later, at 20:29:22Z, after this Chrome exited.
That later release does not qualify the earlier launch.

The known owning startup context is retained in `repaired/software/ready.json`
at 20:28:41.485Z: canonical module
`78a0b1d61b23428a1ae909d739440ae0de059bbbd84a69a2ad3e4c37471ad664`,
generation 1, main thread 1, callbacks 0, marker/count 0, chain 0/uop 1,
tier guard 0, frozen false and host steps 0. No GL context had been observed
at that snapshot. This is bootstrap state, not live gameplay; no later
owning-context capture or personal browser review exists. The rate is unknown.

The causal repair anchors release recognition to the timestamp and exact
MDK worker name, rejects foreign-sender mentions, undated, old and future
entries, and checks the release time. It rejects the actual offending line
and the recorded prelaunch board. A new preflight also proves that this Node
process or an ancestor holds the required exclusive flock on the exact local
lock file, using `/proc/locks` and descriptor device/inode identity. Actual
child-process tests accept the correctly inherited flock and reject absent
and different-file locks. An unflocked actual `--run` now rejects before any
proof, server or Chrome. These repairs were tested offline; no further Chrome.

Normal `Browser.close` requested at 20:29:01.429Z. Chrome PID 1082242, start
ticks 187132903, actually exited 0/signal null at 20:29:01.562Z. Node PID
1082229, start ticks 187132865, and wrapper exited 0; exact PIDs and owned
profile processes are absent. HTTP 33185 and DevTools 35305 refuse connections,
server is closed and the profile was removed after checks. Browser lifetime
was 21,786 ms. The local flock was available at closure; this worker never
held it during the unintended launch. No signals or foreign process kills.
Explicit local heavy release and correction posted at 20:29:42Z.

Validation: 74 focused checks, including both unchanged compiled
modules executing original branches under all four tiers and executable
scene/liveness negatives; full locked build, syntax and diff checks pass.
Preflight records 654 pins, all 92 media, 365 prior HTTP requests and 1,010
offline HTTP routes. The prior 50 marker checks per unchanged module remain
reusable. Git SHA plus relevant binary and owned-new-file patches are the
source archive; existing media/modules are referenced by path and SHA only.
Box ID/state/expiry N/A; coordinator owns future boxes and shutdown.
The bounded outcome is the exact pre-Chrome dependency fault and tested causal
fix, with no logical interval/FPS or paired comparison. A future separately
authorized attempt requires a fresh full rehearsal, genuine current release,
proven local flock, and all unchanged live interval/after-review guards.
