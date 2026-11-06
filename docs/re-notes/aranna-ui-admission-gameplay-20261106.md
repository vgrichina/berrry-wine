# Aranna actual UI admission and cursor boundary — 2026-11-06

Ordinary registered demo gameplay was **not reached**. The improved observer proves why the first actual UI-down invocation returns false: the manager supplies `(0, 0)` to the real rectangle hit tests, including the control whose rectangle matches the rendered Single Player button. A later ordinary click produces a distinct, personally reviewed **“Multiplayer not available in demo”** dialog and the actual UI member returns `AL=1`. This is useful menu progress, but neither a named Single Player action nor state18, a loaded mission, displacement or gameplay acceptance.

No production source change or causal emulator defect is claimed. Guest execution and immutable media remain evidence; no guest bytes/state were changed and no transition was forced. Prior semantic routing to state18 remains established by [the preceding investigation](aranna-semantic-menu-20261106.md), not by this run.

## Reproduction identity and qualification

Evidence: `scratch/runs/20261106-aranna-ui-admission-gameplay/`. Runtime grant began 16:32:24.647644Z after independently verified Conan/PTCT cleanup, with a finite cleanup deadline of 17:17:24.647644Z. One local original ran 16:45:47–16:53:29Z and exited normally at its existing command deadline. No second original, boxes, nested workers or deployment.

The exact build/source commit was `1e60f32ec8ee1403eacc77f878ae9224e73018aa`, including published collector repair `1bf538bf4`. `preoriginal-source.json`, its binary diff and new-file patches preserve relevant uncommitted inputs without a source archive. `tested-inputs.json` pins the source/helper closure, including tracked shell, manifest and font inputs. Existing media paths and SHA-256 identities are in `media-references.json`; media was not copied. `postoriginal-closure.json` confirms unchanged source/helper/media/module identities after the original closed. Later shared changes were documentation only.

`flock /tmp/wine-build.lock bash tools/build.sh` passed before controls and the original. Regenerated disabled modules matched both shipped binaries byte for byte. The standard observer instantiated by the actual owning CPU was 2,203,412 bytes, SHA-256 `cfab7296984f802dd19a8110c0ff462c4e91f4d615d16cda9945b6efa230a406`; standard/compat observer metadata records the import/export contracts and build closure.

`browser-controls-v3-terminal.json` and `validation-finished.json` record passing standard/compat × disabled/observed × ordinaryAPI/owningWorker controls. These exercise nonzero GPRs, lazy flags, live x87 payload/environment, input/API/COM results, faults and SEH, native UI gates, hit/miss paths, and indirect generated name storage. Missing/wrong return PC/SP, target/session, module, and Worker slot/endpoint negatives reject. Earlier generated-fixture failures and their repairs remain in `setup-repairs.json` and the two failed control directories; neither was an original-game failure.

The registered generated full-shell control qualified launch, capture and the serialized command consumer before the original, including personally reviewed balanced click/Enter captures and pre-input actual CPU identity. See `full-shell-proof.json`, `full-shell-http-identity.json`, and `controls-http-identity.json`. `original-http-identity.json` verifies the current served source/media; capture state and `input-guard.jsonl` verify the instantiated CPU before each ordinary command. The original owner is slot0, endpoint1, target `D7650C006BA54FD75214172D3B96F7DD`, session `550E376B7C217FA4F7884E0CB5323581`. These are actual CDP module-byte identities, not merely selected loader URLs.

## Actual owning admission and pre-hit gates

The run-owned transform reuses the retained lifecycle, observer, HTTP/closure/instance guards, packet reviewer and generated controls. It admits UI details from the proven actual wrapper/caller transaction before consulting any control name:

- Call PC `0043b4a8`, wrapper `006f003f`, native member `006ead80`, return PC/SP `0043b4af` / `074ffa34`.
- Actual binding `[006ead80,074ffb70,09f0115c,006f003f]`; native receiver/manager `09f0115c`.
- Manager disable byte `+110 = 0`. The containing dword is nonzero; treating it as a Boolean would be incorrect.
- Interface array `[08d75cb4,08d75d08)` contains 21 pointers and is traversed backward. One proven participating interface is `08acb36c`: byte0=0, byte2=1, byte7b=1, list root `0a1bfcc4`, count9. Native control gates test `+108`, `+139`, then type `+8` before hit dispatch.

Events87–91 preserve manager bounds/flags, actual branch selections, interface/list snapshots, control snapshots and raw name-related words. They belong to the existing kind18 transaction. Hit/control admission now accepts that proven owner without requiring the unqualified direct-name predicate. All retained quotas are unchanged: kind24/25 remain bounded at32, with at most32 new UI details admissions and128 branch details per UI invocation. Both original UI invocations reach the128-edge detail bound: their branch tails are **incomplete**, despite complete owning invocation endpoints. The original exhausts all32 hit admissions during the second click. Absence of later packets is unknown, not proof of no execution.

`original-packet-review.json` passes with 367 matched starts/ends and no open transaction or packet assembly error. `ui-owning-transactions.json`, `actual-hit-receivers.json`, `measured-boundary.json`, `ui-native.log` and `hit-native.log` preserve exact register/stack/endpoint evidence and immutable native instructions. Raw packets remain in `original/observations.jsonl`. The post-stop terminal screenshot was saved, but its CPU-state sidecar failed with `TargetCloseError` after the Worker had closed (`original/capture-error.json`). Earlier pre-input identity/state captures and the completed packet review remain valid; terminal identity is unknown. No restart was attempted.

## First false return and the distinct second response

After ordinary EULA acceptance and balanced Escape inputs, `original/menu-ready.png` shows the readable Main Menu. The game again performs the actual4→5 state store. The first ordinary canvas click at page `(340,355)` visually targets Single Player; renderer down/up are balanced. Invocation251 enters the actual UI member with manager `+78/+7c = (0,0)` and ends at the expected caller with `AL=0`.

The candidate control `0a4f40b0` has rectangle `[280,132,517,178]`, matching the visible Single Player resource. Its actual vtable slot address is `0073099c`, target `006f34f0`; calls274/275 return to `006eae6f` / `006eaedf`, both with return SP `074ff9f0` and `AL=0`. Both stack arguments are `(0,0)`. Native target compares the coordinates against the rectangle and returns false for this input; no instruction-semantics discrepancy is identified. This is an actual hit-test receiver, not the separate frontend `004bccac` result.

Its raw `control+a4` is **zero**, not a direct name pointer. Raw `+a8` is `08af0f54`; its representation/content is not qualified by these captures. The candidate's semantic name therefore remains **unknown**. Rectangle correspondence is not substituted for a verified runtime name. Sentinel reads through null `+a4` are not string evidence.

`original/after-single-player.png` remains Main Menu. A subsequent balanced Enter and ordinary `move:400,153` also leave Main Menu visible (`after-enter-hover.png`; this is a combined Enter/move capture, not an isolated Enter result). The next balanced canvas click produces the distinct demo Multiplayer dialog (`after-settled-click.png`). UI invocation339 now sees `(400,251)` and returns `AL=1`. This establishes real actual-member activation, not Single Player activation.

The browser was pointer-locked to the canvas. The second trusted DOM down still reports page `(340,355)`, but the actual renderer down receives approximately `(400,298.60035)`, queues `(400,299)`, and the game repeatedly recenters to `(400,300)`. Nearby actual `GetCursorPos` snapshots return `(400,301)`, `(400,300)`, `(400,299)`, `(400,300)`. Thus an absolute-looking browser click under pointer lock does not establish an absolute guest click at `(400,153)`. No coordinate mutation was used to repair or bypass this.

Three renderer down/up pairs are complete and separately retained in `balanced-input-review.json`. Document listeners are incomplete (four downs including launcher, one up); they must not be presented as balanced document pairs. Keyboard evidence records three balanced Escape pairs and one balanced Enter pair. Every ordinary command references a personally inspected preceding capture and its hash. `personal-review.json` and per-capture review/state files preserve those decisions.

## Next boundary and cleanup

Trace the **actual writer of manager `09f0115c+78/+7c`** and its cursor/delta sample, admitted from the proven owning input path, through pointer-lock relative movement and game recentering. Explain the first `(0,0)` and later `(400,251)` values before treating a visual absolute click as a verified Single Player action. Qualify the candidate's raw `+a8` name representation separately. Retarget admission to that boundary within existing quotas; do not increase quotas or repeat this unchanged original. Only evidence of a concrete emulator operation differing from the applicable x86/Win32 contract would justify a production fix and focused regression.

All owned local processes, ports, profiles and runtime locks were released and independently probeable after the original. `final-cleanup.json` records absent owned PIDs/profiles, refused ports, four free locks, and more than2GB free on `/home`. No assigned boxes exist. `result.json` is published last after evidence and publication metadata. Outcome remains failed for the requested gameplay goal, with a narrower input-coordinate boundary established.
