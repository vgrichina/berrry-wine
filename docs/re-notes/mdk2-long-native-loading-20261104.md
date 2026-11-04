# MDK2 long native loading, 2026-11-04

**Original New Game/Medium completed the initial level1 resource load and reached personally reviewed intro comic panels. Playable scene, tutorial and player control remain unproved.** The old queue105/active6122816 boundary progressed naturally. No production fix was needed or demonstrated.

Evidence: `scratch/runs/20261104-mdk2-long-native-loading/` (RUN). This follows [the resource-loader cause note](mdk2-resource-loader-cause-20261104.md) and [the compatible-scene run](mdk2-compatible-scene-progress-20261104.md). Only this note is committed; run helpers, logs and captures remain evidence in RUN.

The single browser stopped at step **13824**, after one separately reviewed comic Escape envelope still left comic panels visible and a new resource request active. No further guest steps or input were issued. This is an incomplete transition, not evidence that Escape failed, that the game stalled, or that a playable scene exists.

## Identity and prerequisites

Fresh `bx_n78z26e7` was the coordinator-assigned fork of the stopped predecessor snapshot. No source box was accessed and no box was allocated, resumed or stopped here. Fresh owner release recorded expiry **08:05:29.706Z**, closeBy **07:45Z**, recoverBy **07:50Z**, and coordinator shutdown ownership. The finite helper further limited this browser to **07:23:39.292Z**, fifteen minutes after its launch.

`prepare-inputs.cjs` generated a fresh set of **28 small files**, byte-identical to `20261104-mdk2-resource-loader-cause/next-input-hashes.json`. Those files and the fresh release were the only staged startup inputs; subsequent personal reviews were small JSON approvals. Existing media, modules and installed Puppeteer were reused. Prebrowser and post-close checks verified:

- All **432 historical runtime pins**, including original PE SHA-256 `b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1`.
- Historical source identity `1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`, canonical module `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`, and compat module `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3`.
- Actual CommonJS Puppeteer **24.31.0** import and retained lock SHA-256 `6244fdfa21eed2369547f97ecc11734967b30a6133543120f8579914abcebc33`.
- Original registered MDK2 selector, WebGL selection, isolated HTTP and both full module hashes, process identity preflight and actual controller ACK/barrier tests.

The hydrated runtime has no `.git`; its historical source identity is established by the retained manifest and actual byte checks, not a remote Git HEAD claim. The local preparation HEAD was `b07e2e08c3446cc8e244da6f72c2acbde1a63a38`. The historical driver was never run against the concurrent changed modules.

Before Chrome, **41 focused loader/controller integration tests** and **134 staged controller tests** passed locally; the original archive/source checks and **18 scene-transition tests** also passed locally. **175 remote tests passed**, with one retained historical replay skipped and the source-only decoder test explicitly excluded. Initial remote commands expecting `.git` failed without launching Chrome. The first remote suite and a negative-name-filter attempt hit the known absent `tools/mpq`; the explicit skip-pattern suite passed before launch. No decoder, source tree or media was copied to satisfy that prerequisite.

The integration tests use actual controller/driver command code against modeled page execution and synthetic memory; they are not game execution. The native measurements below come from this actual browser. No production code changed, so a full production build was not required.

## Personally reviewed native route

Every fresh screenshot was personally viewed before dependent advancement, with a new SHA/step/session-matching approval. The unchanged native selector retained its ownership, balanced trusted input, native rest, unchanged-state, isolation, canonical-module and contiguous ACK guards.

| Step | Actual observation |
| --- | --- |
| 0–3072 | Input-free startup, BioWare splash, original title/legal screen. |
| 3120–3200 | Original Escape opening envelope, then separately reviewed opening quanta; New Game becomes visible and highlighted with native freeze nil. |
| 3264 | Native New Game callback completed; fresh difficulty dialog has Medium highlighted. |
| 3312–3344 | Native Medium callback completed; original title fade remains identified even after pixels turn black. |
| 3360 | Nil `Level`, level1/checkpoint9, applied/pending game; resource6174784, size192320, completion0. |
| 3424 | That request completed: completion1, active0, completed bytes1175012. Nil construction persists. |
| 3472 | Actual `l1`/`loadscreen1`, checkpoint9; queue105, active/request6122816, size699228, prepared1, requestPending0, completion0, retries0, bytes0. |
| 3984 | Same entry reaches completion1/status2, bytes699228. Queue105 alone had concealed progress. |
| 4048 | Original **HECTIC / LOADING** cover is visible. Active request changes; bytes760660. Switch to the separately guarded loading-artwork controller. |
| 4560 / 6096 | Queue177/184, bytes1616880/3084431; changing requests. Queue growth is observed, not treated as failure. |
| 9168 | Queue84, bytes7014457. Reviewed loading lettering has advanced; no comic panels yet. |
| 12240 / 13264 | Queue31/4, bytes9980592/11025764. Loading lettering finishes turning red. |
| 13776 | Queue0, active0, prepared0, completion1, bytes**11352133**. Original comic panels are visible: Kurt with mop and doctor holding a green vial. |
| 13824 | After ONE separately reviewed comic Escape press16/release32 envelope, comic panels remain visible at a changed view. Queue0 but new active/request6146816, type6, size50739, completion0, prepared1, retries0. No tutorial/player scene is identified. |

Reviewed captures are under `RUN/recovered/browser/`: `startup-3072.png`, `native-selector-76.png`, `native-selector-79.png`, `comic-control-126.png`, `comic-control-150.png`, `comic-control-153.png`, `comic-control-246.png`, `comic-control-326.png`, `comic-control-336.png`, and final `comic-control-346.png`. The complete 54-capture measurements and hashes are in `native-observation-timeline.json`; `final-personal-review.json` records the final classification.

There were **16 construction observations / 688 steps**, including seven nil-Level16 and nine identified-level1 64 quanta. Then **19 loading-artwork observations / 9728 steps** reached the comic, followed by the one-shot comic48 envelope. Construction and comic ledgers share initial time **07:12:20.555Z**; final screenshot was **07:19:17.087Z**, within the aggregate 540-second allowance. No cap/deadline failure was manufactured. The tested comic controller sets `skipAttempted=true` before its single Escape and rejects subsequent control actions; it contains no post-skip comic-observation action. The final scene therefore ended this admissible route. Unused loading/step allowance does not authorize relabeling comic panels as loading or construction.

This directly resolves the predecessor's uncertainty: active6122816 did complete after more execution credits. Its stable queue was not a deadlock. Frozen inspection time itself did not advance the guest. The next unproved boundary is **comic completion / transition after the one-shot Escape**, with a new resource in flight. Native consumption of the game's pause/movie-cancel command and its callback were not measured by this menu-command observer; balanced browser Escape events alone do not prove either.

## Final diagnostics and recovery

After stopping advancement, a read-only CDP attachment inspected the **same existing Chrome**, without creating a page/browser or issuing input, execution credits, native game calls, guest writes or forced Lua/scene changes. `owning-state.json` records actual owning-worker getters, not startup PCs:

- Main guest thread: PC **0x461c12**, yieldReason0, yieldFlag0, lastRunHalt1 (budget), waitHandle0, csWaitAddr/owner0.
- File worker: PC **0x4515cd**, yieldReason0, yieldFlag0, lastRunHalt3; handle921600, suspendCount0, state active, inFlight false, lastRunBlocks24604. Exact original disassembly places this PC at the return after the SleepEx wrapper call. It does not prove a current blocking wait or a failed request.
- Both remained frozen at step13824 / guest264378ms / zero credits. These are one-boundary observations, not a scheduling trace or proof of the final resource's fate.

The first scalar query did not enumerate worker targets; the explicit target query initially had a parent-session detach error. V8's side-effect evaluator then refused WASM getter evaluation. Those diagnostic failures are retained in `remote-commands.jsonl` and `owning-state-side-effect-rejected.json`. The exact historical WAT getter bodies were audited as pure global/memory loads (`audited-read-only-getters.wat` excerpts) before collecting the successful getters. No runtime guard, game state or execution setting was changed. Selected original PE PC disassembly is retained separately.

`validation.json` verifies **354 contiguous successful ACKs**, **233 step commands totaling13824**, maximum64 per command, **54 screenshots / 53 prerequisite approvals plus final personal review**, no driver/bootstrap/controller first-error latch, original launch click plus balanced screen Escape/Enter/Enter/Escape pairs, and all **200 served pins** matching.

Chrome8974 closed normally at **07:21:43.256Z**. All **1135 closed artifacts / 26622288 bytes** were recovered and size/SHA-256 verified, then checked stable. Driver/Chrome process identities are absent, port**35785** is closed, all432 runtime pins and all29 staged inputs/release remain unchanged. The existing original module recovery paths/hashes were verified rather than copied again. Git SHA, relevant binary diff, owned new-file patches and artifact hashes preserve provenance; no source/media archive or repeated module/media copy was made.

**Handback:** `bx_n78z26e7` remains **RUNNING / API idle**, healthy/hydrated, expiry **2026-11-04T08:05:29.706Z**. Shutdown belongs to the coordinator. No second browser, reload, runtime retry, source-box access, local heavy runtime, other game, subworker, successor or deployment occurred. Next work requires a source-grounded, tested post-comic continuation/consumption guard; this single task stops after publication with no gameplay claim.
