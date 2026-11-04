# Original GLTron live gameplay interval — 2026-11-04

**No gameplay FPS was measured.** The one software launch reached personally
viewed active gameplay, then failed the runner's capture-age guard before
arming. WebGL was not launched and software was not retried.

Evidence: `scratch/runs/20261104-gltron-live-gameplay-interval/`.
Input: `477c16e1870085bd0562554ea69eb3b74324ad26` and
`docs/re-notes/gltron-complete-boot-gameplay-fps-20261104.md`.

## Operator sequence designed before Chrome

Wait for the explicit MDK2 continuous-construction-onward local heavy release.
Hold one external `/tmp/wine-local-runtime.lock` across one software launch
followed by one WebGL launch. Stop the pair at the first fault; no backend
retry or separate diagnostic launch. Reserve 360 combined browser seconds,
60 bootstrap seconds, 60 per command, and 180 cleanup seconds, with absolute
Chrome/cleanup cutoffs of 23:30Z/23:33Z.

For each backend, capture and personally view startup and each original menu
before the next dependent native key. Use balanced Return keys for Game,
arena and unpause only as the actual reviewed scene permits. Capture fresh
active gameplay with a named image; personally view it and immediately submit
the measurement command. The browser records the capture-start monotonic time,
callback table and owning generation. Actual arming requires that exact named
active-gameplay capture to be at most five seconds old, the same generation,
and the current translated callback table to still be `0x42a200`. A missed
review deadline is a first fault, not permission to retry arming.

The marker is the production nonzero-dt branch at `0x4051a9`, pace zero.
Sample the owning main-thread-1 lifetime counter every 250 ms for 5.5 seconds,
checking scene, translated pointers, ownership, generation, tiers, visibility,
frozen state and foreign counters. Preserve monotonic getter brackets and
count deltas, including reset/wrap checks and a minimum five-second interval
after read uncertainty. Preserve the exact first rejected callback translation
at arming or in the interval; attempt an owning-context capture before normal
closure. Personally view the resulting after capture before accepting a rate.
Ordinary balanced steering may maintain a live round when the viewed scene
requires it; no guest code/state/config/pacing edits, freezing or host steps.

Backend attribution requires the actual owning GL bridge/context evidence.
The measured rate includes marker dispatch, guest tick reads, block/uop
boundary enforcement, decoded-cache recycle and periodic observations; no
uninstrumented overhead percentage is established. Callback-table sampling
cannot detect a scene transition wholly inside one guest slice. Counts mean
entered nonzero-dt gameplay updates, not completed updates, physics substeps
or presentation.

## Outcome

The required `mdk2-continuous-onward LOCAL HEAVY RELEASE` arrived at 19:54:54Z.
One external local flock covered the attempted pair. The production boot graph
passed with 654 pins, 92 original media files, all 365 prior HTTP records and
1,010 offline routes. The previous 81-file seal (2,453,581 bytes) is unchanged.
The exact prelaunch Git commit, relevant binary diff, new-file patches, and
existing media/module path/hash references are retained in the run. No source,
media or module snapshots were made.

Personally viewed `software/startup.png` (original main menu), `game-menu.png`,
`arena.png` (GAME IS PAUSED) and `gameplay-before.png` (yellow cycle and new
trail, without the pause message). Each dependent native Return followed the
preceding view; all three keydown/keyup pairs were trusted and targeted at
`screen`. The active capture completed at 19:56:14.306Z. Software ownership
was established by the matching main bridge and `OpenGLHostBridge` context
with `software: true`, software enabled 1 and no WebGL context. The visible
D3DIM dropdown does not identify this GL backend.

The actual owning module was canonical SHA-256
`78a0b1d61b23428a1ae909d739440ae0de059bbbd84a69a2ad3e4c37471ad664`,
page-main generation 1, main thread 1, chain 0, uop 1, debug-tier guard 0.
Frozen was false and host steps remained zero. All 234 served responses
matched the production pins, including all 92 original media files.

At approximately 19:56:20Z the measurement request rejected with
`STALE_GAMEPLAY_REVIEW`: the capture-start-to-arm age was exactly
6335.849999904633 ms, above the runner's 5000 ms limit. The exact live callback
remained **`0x42a200`**, translated from guest VA `0x42b230` to offset 250416.
Marker and count were both zero; no setter or observation interval ran.
This failure was the capture/view/command handoff exceeding the chosen
freshness budget, not a callback mismatch or a production counter failure.

The retained rejection capture `software/counter-rejected.png` was personally
viewed and shows **PLAYER 1 CRASHED** and debris. It is a failure capture,
not an after-interval gameplay review. A table match alone therefore does not
prove a live player. The exact collision time and cause were not measured;
this does not establish the cause of the previous run's changed callback.
There is no software rate, WebGL rate, paired comparison or post-interval
acceptance. The pair stopped at this first fault.

## Tested offline changes and prospective handoff repair

Before Chrome, the actual old arming producer failed the new stale-review
test. The revised producer passed the five wrong-age/name/generation/scene
negatives and retained the exact rejection. Both compiled modules executed
the original dt branch under all four chaining/uop settings, plus actual
translated pre-arm and interval rejection guards for zero, paused and adjacent
foreign callback tables. Invalid game-pointer translation retains the callback
read that preceded it. Reset, wrap, monotonic bracket, owner, generation, tier,
visibility/frozen and bounded-storage tests passed. The existing production
marker/uop tests passed 50 checks per module. The locked full build passed.

After the runtime first fault, the actual shot producer was extracted and
changed to return the exact capture path, hash and capture epoch in the command
ACK. A single operator tool invocation can now submit the capture command and
VIEW its returned image, then submit the reviewed action on the next turn.
This removes the avoidable ACK-only turn followed by a separate image-path
handoff used in this attempt. The old producer failed this new test; the new
producer passes capture-start -> pixels -> VIEW ordering and rejects overwrite
and foreign paths. This is an offline repair of the handoff, **not proof** that
future personal review will fit five seconds or keep a round alive. The
five-second deadline and actual active-table guard remain unchanged. Ordinary
balanced steering may still be needed after a reviewed live scene, before an
interval. No second original tested the repair.

Final focused validation passes 55 checks including both modules; final syntax,
diff checks and `flock /tmp/wine-build.lock bash tools/build.sh` pass. The final
source patch records the offline repair separately from the prelaunch patch.

## Closure and next dependency

Chrome PID 1031770, start ticks 186935344, actually exited 0 with signal null
after the direct normal `Browser.close` request. Node PID 1031753, start ticks
186935310, and the wrapper exited; both owned PIDs are absent. HTTP port 37609
refused connections, the server reported not listening, and the correct local
flock was available. Combined Chrome lifetime including closure was 36.596
seconds. Explicit local heavy release was posted at 19:57:15Z. The owned
profile was removed only after closure verification.

Stop here. The next dependency is a separately authorized original pair with
the direct capture-to-VIEW relay, an active live round maintained through
personal review and at least five seconds of guarded counter observation, and
personally reviewed active gameplay afterward. No retry is authorized here.

Box ID/state/expiry: N/A. Coordinator owns future boxes and shutdown. Normal
closure of this worker's local Chrome is delegated; retain PID/start identity,
actual zero exit with null signal, Node/server/port/flock closure evidence.
Git SHA plus relevant binary diffs and owned new-file patches is the source
archive. Media and modules remain at existing paths with SHA-256 references.
