# Original Stronghold route attempt stopped before ChooseType

The one authorized original-demo browser reached the title and main menu, then stopped at the first unexpected picture: the Crusader activation left the main menu visible. **ChooseType, the published route adapter's two gestures, Zephyr, native Start, world entry and military/hostile interaction were not reached.** This is an unsuccessful gameplay attempt, with personally reviewed actual captures and recovered evidence; offline modeled route success is not live gameplay.

Evidence: `scratch/runs/20261104-stronghold-original-route-gameplay/`. The retained runtime was reused on assigned **bx_87cqdcba**, a coordinator-provided fresh fork. No source box was accessed, no lifecycle action or second browser/reload/retry occurred.

## Original identity and preparation

Runtime source remains **1188e9bf57ef35bd3363fb88b7ca0da442ce696d**, with the predecessor's recorded constructor repair and source-diff references. The exact local preparation Git SHA, empty relevant current binary diff, individual executed small-input hashes, and predecessor repair references are in `source-reference.json` and `relevant-source.patch`. Owned new helpers and this note are recoverable from new-file patches. Git holds source history; no source/scratch/docs/media archive, node_modules copy or repeated module/media copy was created.

Original EXE: `test/binaries/candidates/stronghold-crusader-demo/installed/App_Executables/Stronghold Crusader multiplayer demo.exe`, SHA-256 **9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f**. Actual served canonical module: **cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee**; retained companion: **580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3**. Existing installed paths and all **2,415 runtime pins** matched before and after execution. Runtime used guest Workers and the original DirectDraw/Canvas presentation; the toolbar's GPU choice is not evidence of WebGL rendering.

Read source-grounding **5747079c8a9615034d75b1d6b016a44fe845b65c** and actual adapter publication **4d9264bca620973cb2cc9f460b0b69441f5654d9**. Its five small inputs were individually hashed and inspected remotely; only its two absent adapter helpers needed transfer. The other three pinned dependencies were already present. The only other transferred runtime inputs were this run's small driver and allocation JSON, with explicit hashes. Retained observer, runtime pin inventory, dependencies, media and modules were referenced in place.

Before Chrome, actual Puppeteer **25.7.0** CommonJS and dynamic ESM imports, five real HTTP responses with pinned SHA and COOP/COEP, actual constructor telemetry, and retained transport/ACK/queue/cleanup fixtures passed. The new actual-driver integration passed **208 offline checks**: real renderer/host construction and actual state/capture/review/immutable queue closures, `mailboxDispatch` installation, two route commands, route handoff and separate unchanged NativeStartDriver construction/capture. Synthetic page responses produced six balanced modeled events at native `(543,292)` and `(67,491)`, **384 modeled steps**, and zero Start calls. These tests did not run the game. Separate unchanged native-start and real constructor focused tests passed. No production file changed; no full build was required.

The driver calls `routeDispatch` directly because the wrapper owns its queue; there is no nested `boundary.run`. After successful handoff it separately permits `install-native`, preserving unchanged `NativeStartDriver` and `guardNativeCommands` on the same queue, with separate fresh review and original Start `(718,569)`. This integration was tested offline but **never installed in the live browser**, because its ChooseType prerequisite was not met.

## Actual execution and personally reviewed captures

Chrome **24766** ran **06:46:48.890–06:49:10.612Z**, about **141.7 seconds**, under a finite **07:01:48.889Z** deadline, below the authorized fifteen minutes and well before 07:15Z. The original registered selector and Launch were used exactly once.

Fresh actual images personally inspected:

- `review/startup2048.png`, `startup4096.png`, `startup6144.png`, `startup8192.png`: original loading artwork/progress and streamed-media overlays; no navigation input.
- `review/startup10240.png`: original **Enter Your Title / Lord Crusader / Start Game** dialog. Explicit constructor-backed null/null/zero, ownership and empty queue qualified before one balanced Enter pair, with a complete 64-step ACK after each half.
- `review/title-result.png`, step **10368**: original Demo V1.1 main menu, Crusader enabled. Original `mainToCrusader` exact menu recognition passed and computed native `(304,144)` → browser **`(337.3375,360.4433333333333)`**.
- `review/crusader-type.png`, step **10432**: despite its requested filename, the actual picture still shows the **main menu with Crusader hover text**. It is not ChooseType, scenario or world. This first unexpected picture ended all stepping/input; only quit and evidence recovery followed.

The worker made a coordinate transcription error: the submitted click used **`(337.3375,361.5566666666667)`**, one logical Y pixel below the computed point. `input-12.json` independently records actual native **`(304,145)`**, not `(304,144)`. Also, raw Puppeteer `click` queued move, WM_NCHITTEST, down and up before any subsequent guest step. This startup click therefore lacked the per-event execution/ACK discipline provided by the later route adapter. All four queued events were consumed by the next complete 64-step request and final input was drained, but the menu did not transition. Neither the one-pixel discrepancy nor atomic input timing is individually proved to be the cause; **no game/runtime defect is established**.

The initial offline diagnostic incorrectly expected the strict non-hover main-menu patch to match this hovered image. It rejected with `unknown`; the corrected diagnostic retains `unknown` for both strict menu and route recognizers and separately states the personal visual observation. No recognizer or guard was changed to accept it. The actual source projection mismatch and recorded native `(304,145)` are asserted in `offline-menu-diagnosis.json` / `verification.json`. No retry was attempted to distinguish causes.

The first missing boundary is **actual reviewed ChooseType following original Crusader activation**. The right-towers `(543,292)` and preset-1 `(67,491)` gestures remain live-unexecuted in this attempt. There was no Arrival/picker/default fallback, Start qualification, scenario review, world claim, gameplay action, guest write/call, forced scene or synthetic native claim.

## Recovery, tests and handoff

`verify.py` passes **15 sequential final mailbox replies**, **163 complete 64-step per-guest ACKs**, **10,432 actual steps**, all **1,032 served-file pin receipts**, actual native input fields, balanced final controls and explicit empty/null/null/zero input. This validates evidence and bounded execution, not route or gameplay success.

The writer's immutable closed snapshot recovered and full-SHA verified **212 logical files / 6,961,495 bytes**, reusing already recovered identical captures rather than copying them again. `recovery-closed-verified.json` names every unique local recovery path and full SHA-256; `recovered/closed/snapshot-manifest.json` seals the closed stream. Modules and media remain pinned path/hash references, not duplicate recovery payloads. Own helper/note patches and `final-artifacts.json` seal the remaining local evidence.

Actual exec **06:49:57.698Z** verifies Chrome **24766** and driver **24750** absent, private HTTP port **39069** closed and all **2,415 pins unchanged**. Chrome exited normally with code **0**. API inspection reports assigned **bx_87cqdcba RUNNING/API-idle, healthy and hydrated**, expiry **2026-11-04T07:43:10.325Z**. **Coordinator retains shutdown ownership; the box is left RUNNING.** Recovery completed before 07:20Z. No allocation, access to bx_c5e39n22, resume, stop, delete, local browser/heavy CLI, other game, subworker/successor, deployment, game-check alteration or Save/Load occurred.

Next work requires a separately authorized attempt whose original-menu transport derives the exact point internally and acknowledges/drains move, press and release separately before installing the already tested route adapter. This single-task worker stops with the original gameplay goal unfulfilled and the concrete driver/operator failure preserved.
