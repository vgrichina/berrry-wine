# Hype browser gameplay captured; FPS blocked by counter-owner attribution

Bounded HYPE-BROWSER-FPS-20261013 task, exact integrated main `b88c818ba3a071877e889e7cc779975a193591ce`.
Two browser attempts, no third. **No accepted wall-clock logical FPS**. The
accepted validator rejects `measurement.json` (exit 1, `fps: null`). This is a
capture-harness attribution failure, not evidence that Hype runs at zero FPS
or a production emulator defect. Source-changing repairs were not attempted.

## Actual result and first reproducible measurement blocker

Attempt 1 reached the original New Game menu. Its shell-background launch was
still owned by the synchronous Boat API command; the 30-second timeout sent
SIGTERM. `browser-start.json` retains command `cmd_xmlbpkpggcin`, exitCode 0 but
success false/timedOut true. The harness recorded cleanup at 12:06:51.511Z.
Attempt 2 used documented `boat exec --detach`, process21991, Chrome22013,
command `cmd_8zggxydd1wxg`, and closed normally at 12:10:30.633Z.

On attempt 2 ordinary Enter200ms selected New Game; Space600ms passed the
instructions. Personally inspected after-space, world-before-measure,
during-up, during-down and world-after-measure PNGs show the nighttime
street/knight. ArrowUp600ms moves forward relative to barrels and terrain;
ArrowDown600ms reverses the movement; the final frame remains in the world.
This is bounded original browser gameplay/input evidence, not full-game,
audio, displayed-frame-rate, or hardware-GPU qualification.

The first measurement selector found two instances with exported current
thread ID1 (guest and render origins) and rejected before sampling. An exact
`/lib/guest-worker.js?` URL filter resolved that namespace ambiguity within the
same second browser session, but still selected **slot0**, as counter-arm.json
explicitly records. Its get_current_thread_id is1. The immutable source
`src/13-exports.wat:1821` sets current_thread_id to internal tid+1; the startup
log's guest-worker1/internal tid1 is therefore a different owner (exported2).
The source note's historical tid1 and the exported ID are not interchangeable.
The sampler did not authenticate the callback-emitting owner.

Live 64-byte code at0x43f610 matches the original EXE, and the selected instance
counter stayed enabled, pace0, same instance/code, without observed setter
messages. Nevertheless all 106 raw paired samples were count0 over
10468.57000000ms, while ordinary-input gameplay visibly advanced.
Those are real performance.now samples of the **wrong instance**, not a zero
FPS measurement. Do not divide swaps by two or substitute guest clocks.
The accepted emission observer's bounded packet counts are not a logical
counter; its existing measurement validator is reused unchanged. No new
observer/validator implementation or source fix was promoted.

Recovery requires authenticating the actual callback-emitting owning instance
(slot, internal tid, exported current-thread ID, and live code) before a new
coordinator-authorized measurement. Both allowed browser attempts are spent;
this worker makes no further run or replacement assignment.

## Source, build and environment

6731 selected exact Git blobs, including the full src/lib/tools/test closure,
were checked against Git blob IDs before and after execution. All59 original
assets (38067871 bytes) matched the prior assets.json SHA256 before transfer
and again on the box before/after capture. No local asset package was created;
original files were read-only. Source was archived in memory from Git objects,
not copied from root WIP. The prior recovery/browser manifests were reused.

Cheap gates passed: CLAUDE size,127-fragment manifest/paren checks, unchanged
401-boundary callback census,66 accepted observer/validator tests. Canonical
`bash tools/build.sh` exited0. Its archive-only initial run lacked HEAD for
the append-only API-table baseline. Exact commit/root/src tree and table blob
metadata were then transferred; `git rev-parse HEAD` matched the pinned commit
and `node tools/check-api-table.js` passed against HEAD. No gate/source was
edited, refreshed or bypassed. No further rebuild was needed.

Canonical module1878508 bytes:
`728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`.
Compatibility module1881081 bytes:
`25519647def1c2a25f505a81743d21dec55472ede8780f809edf09b6bb231018`.
Browser resource timing identifies the actual1878508-byte native WASM fetch
at `http://127.0.0.1:8080/build/wine-assembly.wasm?v=dev`; tail calls true,
live module/layout retained, immutable server artifacts checked after capture.
The direct `WINE_WASM_IDENTITY` opt-in field was null because perf-stream was
not requested; hash attribution comes from the observed no-store artifact
route and exact server bytes, not a fabricated browser hash receipt.
Original EXE SHA256:
`635f394121e50001227b97741dbf304f0a88f819c6f2ba2378cf61d9fa2a6344`.

Node24.18.1; Chrome151.0.7922.108; Linux x86_64;4vCPU/8GB assigned default
box on AMD Ryzen9 9950X. Actual live render endpoint api=glide/backend=webgl.
CDP SystemInfo identifies ANGLE Vulkan1.3 SwiftShader Device(Subzero),
SwANGLE driver5.0.0: **software-rendered WebGL**, not the native software
Glide backend or hardware-GPU timing. Guest execution used real Workers.
The primary driver viewport was1000x760; the exact-session Puppeteer attachment
used its default800x600 viewport, reflected in measurement PNGs. This
attachment did not create a new browser/game session. Screenshots and input
are part of the observed interval and would contribute measurement overhead.

## Commands, exits, evidence and handoff

Remote root `/home/user/hype-browser-fps`; source `repo/`; complete59 originals
under `repo/test/binaries/candidates/hype-time-quest-demo`; source archive and
Git metadata retained. Private localhost8080 only, no deployment/host route.
Documented file upload/download URL APIs and Boat exec only; old SSH403 was
not retried and no transfer API denial occurred. No credentials changed.

Reproduction helpers: stage.js, prerequisites.js, git-metadata.js,
browser.js (second-attempt version), measure-existing.js, preserve.js.
Remote archive additionally retains exact first/second browser harnesses.
Commands and exits are in *-exec.json, git-api-table.json, browser2-start.json,
validator-tests-exit.json and validation-exit.json. Primary evidence is
recovered/evidence/attempt2/ (screenshots, raw106 samples, original inputs,
code authentication, GPU/environment, errors and cleanup), with attempt1
preserved separately. Canonical-build.log and all cheap-gate logs retained.
Archive evidence-recovery.tgz SHA256
`1cdc7f829f9daaef180f2cdf86279907b3b84122bdb77c271d85a1d6c58edba6`.

All task browser/server processes closed; source/build/assets remain intact.
Box **bx_2ghgsv9d left RUNNING**, API state idle/healthok, expiry
2026-10-21T14:01:16.889Z. Coordinator owns lifecycle and shutdown. Evidence
recovered12:11UTC, before13:40 preservation deadline. No stop/delete/resume,
manual snapshot, new box, agents, main merge, broad fix, laptop/fleet work.
Branch task/hype-browser-fps-authorized-oct21; publication receipt records
commit and independently verified remote branch. Local task cap64MiB and
2285895680+600MiB free reserve preserved. Hype has no candidateId in the exact
candidate manifest, so this evidence remains in investigation notes rather
than attaching a dashboard result to an unrelated candidate.

Pinned ops/check-run-evidence.js ran against the shared repository (exit1):
existing Zuma outside-run containment error and historical missing/invalid
records retained in dashboard-check.json. No new Hype dashboard record was
published because the exact manifest has no Hype candidateId.
