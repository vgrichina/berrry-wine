# Diablo II software town movement — 2026-11-06

**Registered `diablo2_demo` reaches town and moves through an ordinary ground
click on the software backend.** Personally reviewed captures show Single Player,
Barbarian selection, the name `BOAT`, the glowing-door loading screen, town,
and movement followed by idle arrival. This adds bounded software coverage to
`GLD3D-CORPUS-27-20261006`; it is not full27 qualification. The earlier WebGL
demonstration was not repeated.

Evidence: `scratch/runs/20261106-diablo2-software-town/`. See
`review/town-ready.png`, `review/town-before.png`, `review/town-click.png`,
`review/town-after.png`, `review/town-arrived.png`, their matching state/capture
records, `capture-reviews.json`, `terrain-check.json` and `audit.json`.
The initial and idle-before terrain positions agree. One ordinary left click
on open ground east of the hero produces a walking pose and left/up camera
scroll past the wagon and tent. The later idle capture retains the arrival
terrain position. Static-template comparisons support that direction and zero
idle displacement; their differing best matches are heuristic, not an exact
camera displacement measurement.

## Software selection and actual execution

The supported ordinary selector is `?d3d-renderer=software` (also available through
the GPU selector). `index.html` maps it to `WINE_D3DIM_GPU=false`.
`GuestWorkerLink` then requests `{api:'legacy', backend:'software'}` through the
process render factory. In `lib/d3d-render-worker.js`, that endpoint has no GPU
adapter: replay calls the production `d3dim_worker_draw` export and increments
`evidence.d3dimSoftwareDrawCallsCompleted`. A UI label alone was not accepted.

Before the original, a focused generated public COM fixture used the ordinary
query, guest Worker and actual `WineAssembly` process factory. All 26 draw/pixel
oracle observations passed, including held-queue state transitions. Actual owner
`71BD30CD9969C46C3AD953CCB976C911`, endpoint 1, completed 26 native software draws
and fence sequence 52, error zero, with the GPU adapter absent and GL renderer
null. Normal retirement adopted the render heap; controller and Chrome were
absent, both ports refused connections and the profile was removed. The fixture
uses calc.exe only to initialize public thunks; it does not execute that app.
No original was launched until these route controls passed.

The original's actual render owner is `0B5C2A2157305119BB7D27E0F2688459`, endpoint 1,
`legacy/software`. Across town before → arrival, guest-reported completed native
software draws advance **103,504 → 173,303**, with completed fence sequence
**192,759 → 296,232**. Independent owner observations advance
103,660 → 173,424 draws and 192,994 → 296,321 completed sequence. Sampling is
sequential, so these are not atomic paired snapshots. Every reviewed checkpoint
has no GPU adapter, null GL renderer, zero endpoint control errors, zero
guest-local fallbacks and zero GPU-fallback software draws. These establish
native software execution and owner progress, not FPS or performance.

## Input and recovery

The existing atomic numbered ACK transport passes nine controls. Six controls
exercise the actual run-local browser executor: stale zero-effect recovery on
the same queue, fresh reviewed/current-app-checked action, consumed-ID refusal,
terminal partial/UNKNOWN handling and expiration during the app check. The
12-second scene guard, reviewed capture hash, current registered-app check,
duplicate-ID refusal and no-replay behavior remain intact.

In the original, command 3 expires before dispatch and is refused with zero
effects. Command 4 refreshes; command 5 selects Barbarian from that personally
reviewed fresh scene, on the same live queue. The consumed ID is not retried.
Name input uses the recovered, separately tested balanced CDP keyDown/text/keyUp
bridge through this same guarded queue. `BOAT` is visibly present before OK.
Read-only settling waits reveal the selection/name/loading transitions. Exactly
one ground click is dispatched; subsequent operations only observe and quit.

## Identity, retrieval and lifecycle

Source main commit: `36f61c7b559070ae38e511229b6a9c13642b3cdb`, with the recorded
relevant dirty diff and untracked `lib/wininit-boot.js` patch. Production source
and module pins match the preceding recovered-scene run. All 594 runtime pins
match remotely before and after execution and locally after retrieval; all 25
genuine installed files match the established fixture hashes. Media are
referenced by existing path and SHA-256. All 187 successful pinned HTTP responses
and bundles match their bytes. Live guest/render Worker bytecode matches standard
module `6cd858302895de91df5af17e3a3742281e31f369ddb6528d7b96252b3423caac`;
the unique loaded module is retained. Compat was provisioned only.

Chrome is 151.0.7922.108, V8 15.1.206.16, isolated guest Workers, 1024×768
viewport and 640×480 game buffer. No production repair, local emulator execution,
build, original guest memory/config/save edit, media substitute, combat, second original
or second backend occurred. Git plus recorded patches remains the source archive;
no source/media archive was created. Optional Python image-analysis packages were
unavailable; read-only terrain analysis used existing `pngjs` instead.

Fresh boat `bx_4tb98wwb` was created after persisting/fsyncing its UUID
Idempotency-Key. Initial expiry was 2026-11-07 00:34:37.900 UTC. The one original
began 23:35:42.792 UTC. Chrome exited zero at 23:41:02.340; normal cleanup finished
23:41:02.362. Both private ports refused connections, profile/writer lock were
absent, and the later process check confirmed controller and Chrome absent.
All 173 inventoried run files were retrieved or matched to local retained inputs
and captures. Delegated normal stop `stop_3748fb54b79c382f` completed
23:41:56.041 UTC, `forced=false`, `error=null`; API state is archived and active
expiry null. Start through confirmed stop took 373.249 seconds, within 35 minutes.
No automated safety flag, HTTP403, held-operation retry, resume or relaunch was
observed. Local free disk remained above 2 GB.

Only this findings note is published. Transport, generated route and keyboard
controls, pin/HTTP/module audit, capture review and normal-stop receipt are
retained with artifacts first and `result.json` last. No emulator defect is
established. The requested town movement coverage is satisfied; longer gameplay
and combat remain outside this run. No further execution is needed for this task.
