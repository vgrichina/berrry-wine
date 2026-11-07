# Aranna relative movement, 2026-11-07

The variable duplicate movement is an emulator cursor queue defect, corrected and published on main in `8c51623f2f3bd785e2fb04b85536ce19c11538c3`. Both unchanged generated full-shell controls now pass. The ONE original invocation ended at a harness lifecycle blocker before gameplay input; native original map/world movement remains unverified. Evidence: `scratch/runs/20261107-aranna-relative-move/`.

## Cause and correction

The retained failed standard seq2 journal contains one trusted DOM mousemove `(2,-145)`, one relative handler invocation and one WM_MOUSEMOVE enqueue. It does not show duplicate CDP delivery. A guest can poll the live GetCursorPos, consume its displacement and call SetCursorPos to recenter before the queued message is removed. The renderer then made the message's old cursor snapshot active, exposing that displacement to GetCursorPos a second time. Poll/message scheduling explains why the next movement could apply only once.

`lib/renderer-input.js` now tags queued browser and guest mouse records with a cursor-warp serial. SetCursorPos advances that serial. GetCursorPos uses an active record's cursor snapshot only while the serial is current; after a warp it uses the current live cursor. Historical message lParam, ordering and button snapshots remain intact, including saved/restored worker event context. No multiplier is assumed. The callback census hash/review was updated for this synchronous metadata change.

The tiny real native PE queues mouse_event `(2,-145)`, polls `(402,155)`, recenters `(400,300)`, removes the older WM_MOUSEMOVE and checks that GetCursorPos still returns `(400,300)` while historical lParam stays unchanged. Old renderer: Exit105 on standard and compat; fixed renderer: Exit0 on both. `tools/aranna-control-input.test.js` also tests browser/guest input queues under poll-first/message-first schedules, zero displacement on DOWN/UP, button snapshots, ordinary event ordering, restored active contexts and fresh motion after a warp (six passing tests including the native test).

An earlier hypothesis was wrong: commit `f82b5f2b7` removed polling from a generated helper, supported only by an arithmetic model. The full shell then produced zero movement because this fixture intentionally skips wndproc accumulation while relative intent is enabled. That failed control is retained as `control-point-standard-ready`; its inference is withdrawn. The final fix removes that helper and uses the unchanged predecessor fixture. There was no original under this experiment.

Atomic publication repair `344c54a2cebb0af51858c80b78c18e665dc52080` is preserved. Its focused four-test regression passes. No predecessor UNKNOWN was replayed or reclassified; production pointer-lock, guest-state and stale-action guards remain enabled.

## Qualification and module identity

Fresh `control-point-standard-final` and `control-point-compat-final` use the composed production shell, trusted browser input and unchanged generated fixture. Both reach exact native `(399,155)` once, retain zero displacement on DOWN/UP, perform neutral clicks and type six characters `Aranna`. Natural pointer-lock expiry/unlock, zero-effect stale refusal, unlocked retarget `(410,165)`, neutral pre-click movement, observation-only unsettled state, trusted reacquisition and final relative hover/click all pass. Each has five balanced DOWN/UP pairs, four native-hover transactions, 545 completed observation transactions, zero incomplete transactions and no UNKNOWN. Captures were personally reviewed at original resolution; black frames are retained without inferring dialog changes. Detailed receipts are in `route-qualification.json` and per-command records.

Exact WASM SHA-256 identities (standard original uses the standard observer):

| Module | SHA-256 |
| --- | --- |
| standard baseline | `07f1cc970038f8ab31313b8b200edf26caa63473f293f5fc937f5cfe5c5c7f6e` |
| standard observer | `e7d6617cecdf3275db05454763c07cad7e6eb557afc2a14ca3413d960328fd31` |
| compat baseline | `1d4bd4330ea16947959e3f4472339d5a32a61216cd8b5246198d11046b652c3e` |
| compat observer | `6b5edb202b5e03d84056b8663869f8485de2b5a7d592ece0e350dc43a88a005d` |

The unchanged WASM passivity/broker reports were inherited explicitly (`inherited-controls.json`), not rerun against the corrected JS. Fresh composed controls and native regression above ran the corrected JS. Actual instantiated module copies and startup worker identities are retained. Original runtime source pin is commit `227beb484667040cbf1039622a3b25ffda3d025b`, containing the published fix, plus `source-identity-v7.json` and its binary diff/new-file patches. Post-runtime source check passed. Git and patches provide source recovery; no source/media archive was made. All 28 referenced existing media files passed pre/post size and SHA checks.

Focused queue/native, atomic publication, mouse drag, relative input/clip, pointer-lock gate/latch, mapping (six valid/five invalid), selection (nine refusals), and route contract (32 cases) passed. Required `flock /tmp/wine-build.lock bash tools/build.sh` passed (`locked-build-queue-reviewed.log`) before the fix commit. An initial build required the expected renderer census hash review, then passed. `test/test-mouse-event.js:53` fails an X-button async-state expectation identically with the old renderer; both logs are retained. No unrelated button API change was made.

## First original blocker and cleanup

Pre-original independent cleanup proved all generated resources absent, but failed because the runtime-lock holder had disappeared. The foreground holder exited143; the precise reason is not established. A replacement background holder also did not persist. A shell command separated the failed assertion and launch with a semicolon, so the failed check did not prevent the ONE original launch. This is a harness preparation/admission defect, not a game compatibility finding. The wrapper did not itself enforce current lock-holder liveness. Coordinator notice was appended at 03:38:59Z. No held-risk retry or automated-risk refusal occurred.

Original started 03:38:28.972Z, normal Quit0 was atomically published immediately on recognizing the lifecycle blocker, and terminal was 03:39:13.938Z, code0 (well within original+cleanup 40 minutes). There were no ordinary original guest commands, no EULA acceptance, no Choose Hero/name/Normal/map/world input, and no retry/relaunch. Startup and terminal screenshots are both 1001x800. Personally inspected startup shows the Aranna EULA; terminal shows shell Ready with no guest window. Startup SHA `e1b44e566bc371d1cfb1f080df4fee910104a969af6b26b6d0ede0ad65f57bbf`; terminal SHA `3baeec7438becedcc08a53bc8e7ea124d27886d5aa6f375322fea4f5a9ddcccd`. Their different hashes establish changed pixels; review establishes the actual contents.

Final independent cleanup (`final-cleanup.json`) confirms all 45 recorded owned PIDs absent, all nine local ports refused (32869,33759,34867,35669,36569,36713,38411,38675,41653), and all four temporary browser profiles absent. Original supervisor1360643/child1360661/Chrome1360673 are absent. Original HTTP33759/CDP38411 refuse connections. Profiles removed: `/tmp/wine-assembly-input-GMfu9O`, `-OIhDBV`, `-WH9LIo`, `-o8tmpf`. Build/local-runtime/browser/heavy-runtime locks were all independently free at release; free disk was approximately 2.99GB. No boxes were assigned or created (ID/state/expiry: none); no box stop/delete/resume occurred. Explicit source/build/runtime release was appended to the shared messageboard after cleanup; Lords2 retains the next runtime turn.

Next work requires a separately authorized fresh original after making launch admission fail closed on current lock ownership and all preparation checks. This invocation stops at the lifecycle blocker. Generated correction is demonstrated; original world movement is not claimed.
