- [x] Dark Reign2 genuine WebGL mip chains and original unit movement
  Result: Publishedde461ff9a implements bounded explicit mips and independent MIN/MAG/MIP, SDK enum normalization before caps. Locked build PASS; owning WebGL1/2 each37pixel checks, native38 and batching PASS. Original DemoMission1 Normal loads; no-order control stable, commanded selected units translate with fixed landmarks (paired captures reviewed). No software fallback/renderer error. Exact canonical1a021b0f/companion74b34125 retained; companion unexecuted. Keyed cross-level mip unsupported, broader mission/FPS open.
  Evidence: docs/re-notes/dark-reign2-webgl-mip-chain-20261104.md; scratch/runs/20261104-dark-reign2-webgl-mip-chain/. Snapshot verified02:33:53.320Z; bx_44kza28q actual normalSTOPPED02:34:37.205Z after recovery.

- [x] Owner-requested corpus addition: Stronghold Crusader original demo
  id: TG150-STRONGHOLD-CRUSADER-20261103
  status: published original UK v1.1 village and cheese delivery; native Save/Load unavailable in tested demo route; military gameplay active
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  Result: Publishedd6b48b1527 verifies ordinary dairy worker production and cheese delivered to granary: food types1to2 plus cheese stack, total40to39to38 under full rations. No netfoodgain/native-save/FPS claim. Coordinator inspected delivery capture and verified2434 manifest payload hashes; both actual modules retained. Canvas2D/DirectDraw guestWorkers, not accelerated WebGL.
  Lifecycle: bx_e94v5mct retained for fresh spear-delivery/recruitment worker01a1a483-068d-7c30-ba40-32450ec9e0a5 session4609; expiry03:35:44Z, recovery03:25Z, coordinator shutdown. Worker acknowledged healthy idle hydrated before use.
  Next: Published4a345c82e verifies Armoury/Barracks/Poleturner construction, but Armoury has zero spears and recruitment shows missing spear; no unit recruited or commanded. Root verified2024 recovered payload hashes. Fresh worker restores food/popularity and wood, observes actual spear delivery, then recruits and moves one Spearman. Published413afa3bb confirms native Save/Load unavailable in tested route; persistence remains unproved, no repeated Save attempt.
  Evidence: docs/re-notes/stronghold-browser-food-20261104.md; scratch/runs/20261104-stronghold-browser-food/. Original EXE9024c533 and1856filepin unchanged; canonicalcffca869 actual/compat580f49f3 retained only.

# TODOS

- [x] Measure Hype logical gameplay FPS in browser
  id: HYPE-BROWSER-FPS-20261013
  status: done (one bounded instrumented browser logical callback interval)
  owner: coordinator
  worker: none (independent acceptance complete)
  Result: Accepted12e430474/prior56c92dc2 on exactb88c818ba;188callbacks/10708.68ms=17.5558518884 logicalFPS,108real paired samples,authenticated slot1/internal1/exported2. Ten rejection checks and four gameplay images independently reviewed; old106wrong-owner samples invalid. Canonical728e1de8/build66tests reused;59originals verified. Software ANGLE/SwiftShader WebGL only; displayedFPS/hardwareGPU/nativeSoftware/fullgame/audio/parity/causal overhead unqualified.
  Access: Coordinator snapshot-stop bx_2ghgsv9d completed12:36:32.756Z errornull; no runnable slot or new runtime action. Old SSH/resume denial not retried. No public deployment.
  Evidence: docs/reviews/hype-fps-independent-integration-20261021.md; scratch/runs/20261021-hype-counter-owner-measure; scratch/runs/20261021-hype-fps-independent-integrate.

## Hock gameplay/scoring qualification — 2026-10-21

Placement/startup notification corrections are runtime-qualified on exact candidate
776d37d55d2f749dcb29203e3bd26b8a5e9c05bd and accepted for integration. Full HUD,
clock 120→86 and input passed the original 45-second route. Subsequent sealed
real-input gameplay on the same module shows score 0/20→5/20.
Exact collision/target, completion, audio quality, FPS and Windows parity remain open.
See [integration acceptance](docs/reviews/hock-qualified-notify-integration-20261021.md).

- [x] Add original Hock-A-Loogie (1995) requested in Telegram103
  id: TG103-HOCK-A-LOOGIE-1995-20261020
  status: accepted original corpus registration, registered CLI startup, normal browser selector/Launch and bounded mouse gameplay/scoring
  Done: Original game registered, player-controlled gameplay and reviewed screenshots with exact source/runtime evidence.
  Evidence: [scoring review and integration](docs/reviews/hock-scoring-runtime-20261021.md); report54b0ee54ba8053d7d430350dc332e1ff1ddcce92 on qualified inputs integrated at d2034ccf750f2482fa78012b30039800e75b9f54. Original39-file package, real mouse charge/release, visible0/20→5/20; source/module/package identities retained. Capacity hold resolved; evidence integrated without runtime/build.
  Browser acceptance: Association b000885e and launcher fix52c165ee/evidence6ccf7691 independently reviewed against main71bc4a6d. Actual normal selector plus Launch reaches original selection and real mouse gameplay0/20→10/20;102outer/85inner seals and source/module/original39-file38-companion mapping verified. See [independent integration](docs/reviews/hock-toolbar-independent-integration-20261021.md). Registered CLI startup was independently accepted at71bc4a6d; prior explicit-EXE0→5 remains separate evidence.
  Limits: Whole-game completion, persistence, keyboard coverage, audio quality, FPS and Windows parity remain unqualified. Exact collision instant/struck target remain unqualified. Broader goals remain open; coordinator assigns any further work. No public deployment. SAME bx_egnm3u4y remains coordinator-reported RUNNING/idle10:06UTC, expiry10:44:02.530UTC; coordinator owns shutdown, no runtime replay/lifecycle action in this review.

## Coordinated migration queue — 2026-10-01

Historical sections below are preserved; they are not automatically ready work.
Coordinator: codex:01a0f9d8-c0cd-73b3-a357-fb3ff1c784c0.
Resource and acknowledgment ledger: `ops/handoffs/orchestrator-status.md`.

**No product decision needed for current independent work.** FP comparisons and
result download are complete. REP final validation remains blocked by automated
review. Codex handoff reconciliation is
complete, including one explicitly reconstructed documentary handoff. Five
Claude roots are deferred under the updated orchestration scope; their files
and jobs remain preserved. No old-session wakeup is requested.

- [x] Receive in-scope Codex handoffs and reconcile resource ownership
  id: MIG-HANDOFF
  owner: codex:01a0f9d8-c0cd-73b3-a357-fb3ff1c784c0
  started: 2026-10-01T23:44:20Z
  Next: complete; eight root handoffs accepted plus one reconstructed Codex handoff. Five Claude roots deferred; preserve unverified jobs and their ownership.
  Done: all in-scope Codex custody documented without inferring process termination.
  Evidence: ops/handoffs/initial-inventory.md; ops/handoffs/orchestrator-status.md.

- [x] Review and verify released dashboard blocker workflow
  id: MIG-OPS
  owner: codex:01a0f9db-07f4-71d2-9fe8-42d5efc7f642
  started: 2026-10-01T23:45:00Z
  Next: complete; UTF-8 regression passes. Ops owner reloaded8098 with CPU/RSS work,10/10tests and browser/live checks pass; Unicode fix active.
  Done: bounded review and relevant tests recorded, defects fixed or explicitly queued.
  Evidence: ops/handoffs/ops-dashboard.md; ops/handoffs/mig-ops-review.md.

- [x] Verify existing PCP artifact correctness
  id: MIG-FP
  owner: codex:01a0f9db-4a5d-7733-ade9-8b71d8e3f05f
  started: 2026-10-01T23:45:00Z
  Next: complete; 400 sequences/14834ops pass, 264 preserved files unchanged. Native/game gates remain.
  Done: parity result and remaining native/game gates recorded.
  Evidence: ops/handoffs/fp-next-root.md; ops/handoffs/mig-fp-parity.md.

- [x] Review remaining Serious Sam production integration
  id: MIG-SAM
  candidate: serious-sam-demo
  owner: codex:01a0f9db-89c0-73b3-b528-fe8bf239e061
  started: 2026-10-01T23:45:00Z
  Next: complete; timer TLS/SEH isolation recommended after frozen replay, preserve mixed-file ownership.
  Done: precise next task with ownership boundaries and validation; goal remains incomplete.
  Evidence: ops/handoffs/01a0f6ff-da61-7710-a604-d9442103dbbd.md; ops/handoffs/mig-sam-review.md.

- [ ] Defer NFS2 and IS3 root migration
  id: MIG-NFS2
  status: deferred
  owner: codex:01a0f9d8-c0cd-73b3-a357-fb3ff1c784c0
  Next: Claude migration deferred per updated ops/ORCHESTRATOR.md; preserve files/jobs and do not take overlapping claims. IS3/icon commits and tests are recorded but do not imply root transfer.
  Done: resume only when scope includes Claude migration.

- [x] Verify handed-off renderer specular correction in isolated candidate
  id: MIG-RENDER
  owner: codex:01a0f9d8-c0cd-73b3-a357-fb3ff1c784c0
  Next: complete; fixed72 and actual shared-worker WebGL/native software pass after narrow fog correction. Broader migration remains incomplete.
  Done: unchanged analytical expected pixels pass; exact tested module/source evidence retained.
  Evidence: ops/handoffs/01a0eb29-4302-7e20-9b06-7084fb37358b.md; ops/handoffs/mig-render-validation.md.

- [x] Correct generated fixed fog/specular guard without widening guest support
  id: MIG-RENDER-FOG
  owner: codex:01a0f9db-4a5d-7733-ade9-8b71d8e3f05f
  Next: complete; unchanged analytical fog/specular pixels pass and both mixed guest/generated negative checks reject.
  Done: existing analytical fog/specular pixels pass while unsupported guest/mixed paths remain rejected.
  Evidence: ops/handoffs/mig-render-fog-review.md; ops/handoffs/mig-render-validation.md.

- [x] Prepare coherent texture-registry validation snapshot
  id: MIG-RENDER-TEXTURES
  owner: codex:01a0f9db-4a5d-7733-ade9-8b71d8e3f05f
  Next: complete;9/9 gates PASS,144 protected hashes unchanged,12file manifest/backups/logs downloaded and own jobs cleaned. Separate Q2 route assigned; empty-quad excluded.
  Done: registry/lowering/GL/Glide correctness checks on identified source, or concrete failing gate recorded before further migration.
  Evidence: ops/handoffs/mig-render-textures-validation.md; scratch/mig-render-textures-validation-20261002/result.json.

- [x] Validate Q2 world and movement with shared texture registry
  id: MIG-RENDER-Q2
  candidate: quake-2-demo-installer
  owner: codex:01a0f9db-4a5d-7733-ade9-8b71d8e3f05f
  Next: complete; reviewed textured world and scripted-W framechangePASS6205colors/40457pixels. Physical traversal unproven;284source hashes stable, no budget rejection on this route. Own jobs cleaned, remote slot released.
  Done: reviewed world/movement images, registry budget behavior and exact tested identities; or concrete failure. No performance acceptance or merge.
  Evidence: ops/handoffs/mig-render-q2.md; scratch/runs/20261002T010210Z-quake-2-demo-installer-mig-render-registry/result.json.

- [x] Replay Serious Sam production TLS diagnostic artifact to intro
  id: MIG-SAM-REPLAY
  candidate: serious-sam-demo
  owner: codex:01a0f9db-89c0-73b3-b528-fe8bf239e061
  Next: bounded replay complete with FAILED visual criterion: near-black87000 despite quitfalse/credits0. Follow-up paired replay assigned; production TLS visual pass remains unproven.
  Done:87000 intro state and reviewed capture, or concrete failure evidence; stop only own new run.
  Evidence: ops/handoffs/mig-sam-review.md; ops/handoffs/mig-sam-replay.md.

- [x] Isolate Serious Sam near-black intro checkpoint
  id: MIG-SAM-VISUAL
  candidate: serious-sam-demo
  owner: codex:01a0f9db-89c0-73b3-b528-fe8bf239e061
  Next: complete; both87000/90000 images byte-identical across405db/363d, brightGODGAMES90000, hosts unchanged and both runs stopped. Earlier black frame is transition.
  Done: frame-phase versus module difference recorded with reviewed paired evidence; no unsupported TLS blame.
  Evidence: ops/handoffs/mig-sam-replay.md.

- [x] Capture matching FP native code on dedicated x64 box
  id: MIG-FP-NATIVE-X64
  owner: codex:01a0f9db-07f4-71d2-9fe8-42d5efc7f642
  Next: complete; six captures/30function records/121download hashes verified. Both engines retain spilled countdown; no speed claim. ARM64 remains next after local slot release.
  Done: captures downloaded and reviewed with tier/engine/hash provenance; no speed claim.
  Evidence: ops/handoffs/mig-fp-native-plan.md; ops/handoffs/mig-fp-native-x64.md.

- [x] Capture matching FP native code on local ARM64
  id: MIG-FP-NATIVE-ARM64
  owner: codex:01a0f9db-07f4-71d2-9fe8-42d5efc7f642
  Next: complete; six captures/30functions/input hashes verified. Countdown remains spilled; affected Ion fast frames shrink16bytes. CPU released, version differences retained; no speed claim.
  Done: actual disassembly reviewed with version/tier/module provenance; no timing conclusion.
  Evidence: ops/handoffs/mig-fp-native-plan.md; ops/handoffs/mig-fp-native-arm64.md.

- [x] Restore missing MW3 assets and verify frozen P browser baseline
  id: MIG-FP-BROWSER-BASELINE
  owner: codex:01a0f9db-07f4-71d2-9fe8-42d5efc7f642
  Next: complete;43assets verified, cockpit and3windows PASS;23artifacts downloaded/hash matched, source stable and own jobs cleaned. CDP SwiftShader contradicts endpointIntel string; diagnostic evidence only.
  Done: reviewed gameplay route or concrete failure with exact source/module/renderer provenance; no variant timing campaign or EPYC comparison.
  Evidence: ops/handoffs/fp-next-root.md; ops/handoffs/mig-fp-browser-baseline.md.

- [x] Prepare existing FP copied-kernel comparison recipe
  id: MIG-FP-KERNEL-PLAN
  owner: codex:01a0f9db-07f4-71d2-9fe8-42d5efc7f642
  Next: complete;112frozen inputs pinned and exact3pair recipe reviewed. MIG-FP-KERNEL assigned on dedicated ASCII host after quiet preflight.
  Done: concrete recipe with MIXED_CONTROL census guard and explicit mixed-kernel versus pure-path/gameplay coverage limits; no new variant/default change.
  Evidence: ops/handoffs/fp-next-root.md; ops/handoffs/mig-fp-native-arm64.md; ops/handoffs/mig-fp-native-x64.md.

- [x] Prepare matching FP native-code capture commands
  id: MIG-FP-NATIVE-PLAN
  owner: codex:01a0f9db-4a5d-7733-ade9-8b71d8e3f05f
  Next: plan complete; local captures wait for Serious Sam CPU release, remote prerequisites need separate verification.
  Done: executable matching P/PCM/PCP V8/Ion capture plan with prerequisites explicit.
  Evidence: ops/handoffs/mig-fp-native-plan.md.

- [x] Audit incoming owner evidence and missing handoffs
  id: MIG-OWNERS
  owner: codex:01a0f9db-07f4-71d2-9fe8-42d5efc7f642
  Next: audit complete; nine original roots still lack durable handoffs, keep individual blockers open.
  Done: received/released/retained resource distinctions and ready candidates recorded without runtime disturbance.
  Evidence: ops/handoffs/mig-ownership-audit.md.

- [x] Receive Pirates Worker sailing handoff
  id: MIG-PIRATES
  owner: codex:01a0f9d8-c0cd-73b3-a357-fb3ff1c784c0
  Next: handoff accepted; preserve8159, review exact StretchRect/Worker hunks before game-path validation.
  Evidence: ops/handoffs/01a0f736-78f1-7822-8b37-159d6f8ed94d.md.
  Done: accepted handoff and safe next task.

- [x] Verify Pirates actual-game rectangular StretchRect path
  id: MIG-PIRATES-STRETCH
  candidate: pirates-2004
  owner: codex:01a0f9db-89c0-73b3-b528-fe8bf239e061
  Next: bounded route complete with INCONCLUSIVE transfer outcome; guest stopped after captain before any transfer. Root reviewed image and verified58artifact hashes;143inputs unchanged. Cause unresolved; no rerun assigned.
  Done: opcode0x30015 and ordered source readback observed with reviewed game captures, or concrete route failure. A zero-transfer sailing pass is insufficient; white terrain remains separate.
  Evidence: ops/handoffs/mig-pirates-stretch.md; scratch/mig-pirates-stretch-20261002/result.json.

- [x] Complete MMX root resource audit
  id: MIG-MMX
  owner: codex:01a0f9d8-c0cd-73b3-a357-fb3ff1c784c0
  Next: durable root/three-child handoff acknowledged; preserve notes/artifacts/server58114, no slower default enabled and no new optimization campaign assigned.
  Evidence: ops/handoffs/01a0eef4-21b2-76b3-8352-48b0d6ac6e7f.md.
  Done: checkpoint accepted, remaining work scoped from owner evidence.

- [ ] Defer four older Claude roots; accept reconstructed Codex coordination history
  id: MIG-LEGACY
  status: deferred
  owner: codex:01a0f9d8-c0cd-73b3-a357-fb3ff1c784c0
  Next: Claude PID10341,36638,68796,53759 deferred with claims preserved. Codex01a0a731 documentary reconstruction accepted; completed commits are ancestors and dedicated files clean. Preserve its unverified processes.
  Done: Codex migration closed; Claude work stays deferred until scope changes.
  Evidence: ops/handoffs/reconstructed-remaining.md; ops/ORCHESTRATOR.md.

- [x] Revalidate transferred bounded wave capability writes
  id: MIG-AUDIO-CAPS
  owner: codex:01a0f9d8-c0cd-73b3-a357-fb3ff1c784c0
  Next: complete;920ABI/input/full isolatedbuildPASS, committedcd50cfdf only4ownedpaths; foreign timeSetEvent hunk preserved.
  Done: current920-case caps and existing input suite validated, isolated/full build identity recorded, report finished and only owned hunks integrated.
  Evidence: ops/handoffs/01a04d26-4255-7ee2-bb58-9e2cbedb68df.md; ops/handoffs/mig-audio-caps.md.

- [x] Integrate persistent multimedia timer TLS and SEH context
  id: MIG-SAM-TIMER
  candidate: serious-sam-demo
  owner: codex:01a0f9db-89c0-73b3-b528-fe8bf239e061
  Next: complete; new context fixture plus five regressions and static gates PASS. Narrow source additions preserved uncommitted; private diagnostic intro replay assigned.
  Done: stable FS base, separate persistent registered callback TLS, main TLS/SEH restoration, late templates/TlsFree and waveOut regressions pass; no fault/REP/launcher expansion.
  Evidence: ops/handoffs/mig-sam-timer.md; scratch/mig-sam-timer-20261002/.

- [x] Replay production timer context in private Serious Sam diagnostic module
  id: MIG-SAM-TIMER-REPLAY
  candidate: serious-sam-demo
  owner: codex:01a0f9db-89c0-73b3-b528-fe8bf239e061
  Next: complete; private0c5d6ab0 matches both prior modules PNG/snapshot/GL at87000/90000;250inputs unchanged and own8147 quit0. Private fault/REP transforms remain.
  Done: exact source/module/host identity and intro result, own8147 run stopped, retained8138/8146 untouched. Current-source replay is not a timer-only A/B or gameplay completion.
  Evidence: ops/handoffs/mig-sam-timer-replay.md; scratch/runs/20261002T005200Z-serious-sam-production-timer-intro/result.json.

- [x] Scope remaining Serious Sam production fault and REP restart integration
  id: MIG-SAM-FAULT-PLAN
  candidate: serious-sam-demo
  owner: codex:01a0f9db-4a5d-7733-ade9-8b71d8e3f05f
  Next: complete; REP-specific absent-page slice proposed, separate MOVSW and raw-SEH classifier gaps identified. New fixture/fallback audit assigned without production changes.
  Done: concrete ready or blocked steps with exact source dependencies and precise-PC strategy; no broad diagnostic instrumentation shipped.
  Evidence: ops/handoffs/mig-sam-review.md; ops/handoffs/mig-sam-timer-replay.md.

- [x] Run existing FP copied projection kernel pairs
  id: MIG-FP-KERNEL
  owner: codex:01a0f9db-07f4-71d2-9fe8-42d5efc7f642
  Next: Complete: three pairs passed correctness/census/island gates; nine downloaded evidence hashes verified,115inputs unchanged and own jobs stopped. Timing inconclusive against biased P/P control; no default change.
  Done: source/module/work identities, parity/census/island coverage and paired spread against P/P null recorded; own jobs cleaned. Mixed workload does not validate PCP pure-path benefit or game speed.
  Evidence: ops/handoffs/mig-fp-kernel.md; scratch/mig-fp-kernel-20261002/analysis.json
  status: done

- [x] Establish decoded REP sparse-fault restart regression
  id: MIG-SAM-FAULT-FIXTURE
  candidate: serious-sam-demo
  owner: codex:01a0f9db-4a5d-7733-ade9-8b71d8e3f05f
  Next: complete; both diagnostic baselines expose stale blockheadPC/writekind0/repeated premarker; MOVSD also stale progress. Two immutable165file snapshots/logs retained; narrow REP correction assigned.
  Done: precise fault/progress/retry baseline evidence and MOVSW/fallback coverage limits, without weakening expected behavior or promoting diagnostic shortcuts.
  Evidence: ops/handoffs/mig-sam-fault-plan.md.

- [!] Correct REP MOVS restart on absent sparse pages
  id: MIG-SAM-REP-RESTART
  candidate: serious-sam-demo
  owner: codex:01a0f9db-4a5d-7733-ade9-8b71d8e3f05f
  Next: incomplete handoff accepted; seven file/patch hashes verified. Matrices/regressions/zero-count/block paths pass. Corrected uop log passes with2entries/1COPYdeopt, tool exit unconfirmed. ContinueSearch, direct MOVS code-write review and final static gates remain after automated review stopped the worker.
  Done: correct single fault, first absent byte, failed-element preservation and retry at REP for widths1/2/4 DF0/1, with source identities and coverage limits. No generic fault-policy/classifier/layout changes or canonical build.
  Evidence: ops/handoffs/mig-sam-rep-restart.md; scratch/mig-sam-rep-restart-20261002/evidence-summary.json.
  blocker: Worker execution stopped by automated cybersecurity-risk flag; final validation incomplete.
  waiting-on: automated review resolution
  needs: Resolve the blocked validation step before promoting or committing this change.

- [x] Review remaining Serious Sam diagnostic fault transforms
  id: MIG-SAM-FAULT-REMAINDER
  candidate: serious-sam-demo
  owner: codex:01a0f9db-89c0-73b3-b528-fe8bf239e061
  Next: complete;3transforms obsolete,5generic/classifier dependencies remain. Original builder is incompatible with current REP signatures; no replay or implementation assigned until REP review gates resolve.
  Done: exact redundant versus still-needed transforms and safe next validation documented.
  Evidence: ops/handoffs/mig-sam-fault-remainder.md.

---

Snapshot of remaining work, written 2026-08-16 by picking up five Claude sessions
that ran the night of 2026-08-15 and stopped mid-flight. Each item names the
session that owns it, the files it touches, and what the *next* concrete step is.

Session transcripts live in
`~/.claude/projects/-Users-vg-Documents-projects-phone-wine-assembly/<id>.jsonl`.
Coordination history is `messageboard.txt` (append-only; entries 1180-1220 cover
this stretch).

Tree state at time of writing: HEAD `209aa00`, working tree clean, build green,
corpus sweep 106 PASS / 0 FAIL.

---

## 0. Blocking question: are the 24 e2e failures real? — ANSWERED 2026-08-16

**Answer: they are real, but they are not new, and the font commits are
exonerated.** A baseline worktree at `eff03cb^` (680db80) produced a
byte-identical fail set to HEAD across all six sampled tests, so neither
`eff03cb`/`45e58ae` nor the `WNDPROC_DIALOG` move caused any of them. Against
the session-start commit `9c49b65`: `spider-messagebox`, `find-cancel`,
`solitaire-resize` and `cwordzap-render` fail identically there too — they
predate the whole night. `mspaint-options` was *worse* at `9c49b65` (the run
did not complete at all); only its margin-gray assert is left. Only
`regedit-deep` truly regressed, bisected to `88c6a72` — seeding `HKLM\System`
gives HKLM a third child, so the tree has 10 visible rows where the test pinned
9. Expectation fixed in `48379a7`; the emulator was correct.

What is left of this item is the individual failures, each of which is now a
plain bug with no shared cause. Note also that `lib/storage.js` seeds both
`HKLM\SOFTWARE` and `HKLM\Software` and key paths compare case-sensitively, so
regedit shows two keys where Windows shows one.

The original writeup follows.

**Priority: highest. Nobody owns this yet.**

`test/run-all.sh` in the shared tree at 23:58 gave **151 passed / 27 failed**:
unit 92/2, e2e 58/24, smoke 1/1. The two unit failures are known and owned
(`test-winhelp-wat-parser`, `test-gdi-public-api-status` 245-vs-244).

**All six sampled failures are now closed** (2026-08-16). Five of the six were
tests pinned to stale geometry or to the retired JS renderer's palette — the
emulator was right and the assert was wrong. Only `test-cwordzap-render` was a
genuine emulator bug. Two reusable lessons for the rest of the 24:

1. Before believing a pixel/click assert, check the *live* geometry
   (`dump-windows`) and the Win98 classic palette (the real Plus! 98 theme
   files in `test/output/wordpad-mixed-format-roundtrip/vfs/screensavers/*.the`
   settle any color question). A coordinate hardcoded months ago is the prime
   suspect.
2. `run.js` now has `close-click:TARGET` and `corner-drag:HWND:DX:DY`, which
   derive their points from the live window rect. Prefer them over magic
   screen coordinates so the next placement change doesn't silently rot the
   test into a no-op.

Also: timing-sensitive tests (`test-mspaint-options` 9s, `test-mspaint-stretch-icons`
10s `execFileSync` timeouts) go red purely from machine load. Check `uptime`
before believing them.

The original sampled table:

| Test | Assert that fails |
|---|---|
| `test-regedit-deep` | `tree displays classic folder glyphs (0 yellow px)` |
| `test-mspaint-options` | `tool-options margin stayed button-face gray` |
| ~~`test-spider-messagebox`~~ | FIXED `dcbc468` — the assert pinned the retired JS renderer's 64,64,64 outer shadow; Win98's COLOR_3DDKSHADOW is black (every Plus! 98 `.the` ships `ButtonDkShadow=0 0 0`). Emulator was correct. Also filled in the missing `GetSysColor` indices 21/23/24. 7/7. |
| ~~`test-find-cancel`~~ | FIXED `35bb495` — the test clicked (390,72), which is inside the dialog's *client* area; the close box is x 379..395, y 45..59. Emulator was correct. New `close-click:TARGET` input action derives the point from the live window rect. 11/11. |
| ~~`test-solitaire-resize`~~ | FIXED `c7efdb6` — the test pressed 19px below the window (it assumed y=20, Solitaire opens at y=0), so it grabbed nothing. Resize itself always worked. Now drags the live corner via a new `corner-drag` input action. 3/3. |
| ~~`test-cwordzap-render`~~ | FIXED `e2503be` — **a real emulator bug**, unlike the others here: `StretchDIBits` rejected BI_RLE4/BI_RLE8 outright (`$gdi_raster_desc_from_bmi` accepts only BI_RGB/BI_BITFIELDS), so the splash drew nothing. Now decoded through the existing `$gdi_bitmap_create_dibitmap` path. 7/7. |

Most plausible sources, both of which landed **without an e2e run**:

- `eff03cb` "Delete the JavaScript text path" + `45e58ae` (fonts session; it said
  outright that the e2e tier was never run against either commit)
- the `WNDPROC_DIALOG 0xFFFE0002 -> 0xFFFF0004` move (board entry 22:30), which
  fits the `find-cancel` dialog-hwnd failures

**Next step:** run `bash test/run-all.sh e2e` at the commit *before* the font-path
deletion, in a worktree, and diff the FAIL name sets against the current run.

**Do not repeat the mistake that wasted the last attempt:** the abandoned worktree
at `~/.claude/jobs/b303255f/tmp/wt5` symlinked only `test/binaries`, so it had no
fonts and failed 83+ tests including every `test-wat-gdi-*`. Its numbers are
meaningless. Delete it. A baseline worktree needs the font assets too.

---

## 1. Win16 / NE — Phase 6: three of the four are playable, one is complete

Phase 1 (`0c23c78`) loads and links NE images, Phase 2 (`84c98a1`) runs them,
Phase 3 (`ff6f45a`, `9a0f12f`, `3b18812`, `90e548a`) gives them an API layer,
Phase 4 (`919f011`, `5e8a9f3`, `e78ba7f`, `0af03d5`) adds NE DLL loading, and
Phase 5 (`d5a09f7`) gets Hearts running.

Phase 6 (`fd04a70`, `df6b6b5`, `653da1d`, `3716c6f`, `f82cc5d`, `7f464ce`,
`72b3ba8`) makes them look right rather than merely run.

**Minesweeper is complete** — Game/Help menu, red LED counters, yellow smiley,
raised minefield. **Solitaire deals a full hand, and keeps dealing** — stock,
four foundations, seven tableau columns each with its face-up top card over a
face-down fan, hand after hand. **FreeCell deals a full board out of
CARDS.DLL** — eight columns of card faces, free cells, "FreeCell Game #2574"
in the title (it opens empty by design; Game▸New Game, command 102, deals).
**Hearts creates its frame, its status bar and its buttons, runs its message
loop, initialises DDEML and puts up a real message box.** All four are in the
browser shell under "16-bit (Win16 / NE)" (`8dc244e`), covered by
`test/test-win16-web.js`, which asserts Minesweeper's colour art, that both
card games actually deal, and that Solitaire's *second* hand is as full as its
first.

Most of the bugs behind the previously-empty tables were **not** Win16-only
and are worth knowing about for 32-bit apps too:

- `$handle_AdjustWindowRectEx` ignored `dwExStyle` while
  `$defwndproc_do_nccalcsize` honours it, so any `WS_EX_CLIENTEDGE` window
  sized through it came back four pixels narrower than the app asked for.
- `$handle_PatBlt` reads its width and height back off the stack frame rather
  than from its arguments — the Win16 bridge wrote only the rop there, so
  every 16-bit `PatBlt` filled a garbage rectangle. It is the only handler in
  the bridge that reads past argument 2; the other 97 were audited.
- `GetDeviceCaps(NUMCOLORS)` answered Win32's `-1`, which a 16-bit caller
  compares as a signed word. Minesweeper's `cmp ax,2 / jle` therefore chose
  its monochrome bitmap set and drew the whole board in 1-bit art.
- `$menu_load` and `rsrc_exists` both meant "PE resource", so no 16-bit app
  had a menu bar. An NE menu is the same MENUITEMTEMPLATE with ANSI labels.
- **A DLL's exported prologue was never patched.** `push ds / pop ax / nop` is
  three bytes the linker leaves meaning "AX = the caller's DS", and the loader
  is expected to replace them with `mov ax, DGROUP`. Without it every export
  runs on its caller's data segment and reads the caller's variables as its
  own — nothing faults, it just reads the wrong memory. CARDS.DLL found
  FreeCell's data where its card-bitmap cache should be.
- **A 16-bit task never became the active window.** WM_ACTIVATEAPP,
  WM_ACTIVATE and WM_SETFOCUS are delivered from CreateWindowExA through
  32-bit continuation thunks, which a 16-bit task cannot be resumed on.
- ShowWindow's WM_SIZE arrived *after* whatever WinMain posted, rather than
  before it as on Windows, so Solitaire dealt onto a table with no layout.
- **The local heap never reused a freed block.** `LocalFree` was a no-op and
  `LocalAlloc` a bump pointer. An app that churns — Solitaire allocates a node
  per card and frees all 28 on the next deal — exhausts a 4KB heap in two
  hands. A NULL from LocalAlloc is rarely reported by the caller, so this
  reads as a feature quietly not working rather than as an error.

The address scheme, because everything else depends on it: every segment base
is 64KB aligned, so the low word of a linear address *is* the offset inside its
segment. `$esp` therefore stays a linear address with SP as its low half, and
the pre-existing 16-bit push/pop handlers needed no changes at all.

- Files: `src/05c-seg16-ops.wat` (handlers 363-387 — segmented EA, far
  transfers, segment-register moves, string ops), `src/09e-win16-api.wat` (the
  API layer, ~70 entry points), `src/07-decoder.wat` (`$code16` inverts the
  66/67 prefixes; `$decode_modrm16`), `src/08c-ne-loader.wat`,
  `src/01-header.wat`
- Tooling: `tools/ne-dump.js`, `tools/ne-exports.js`,
  `tools/gen_win16_ordinals.js` → `src/win16-ordinals.generated.json` (1,468
  names, 10 modules; all 269 ordinals the four apps import resolve).
  **`--trace-win16`** logs every call with the ten stack words nearest the top
  (BitBlt's Pascal frame is exactly ten and its destination DC is the deepest)
  and the AX/DX/EIP/ESP that came back, and decodes the 16-bit MSG behind
  `lpMsg` for the four message-pump entry points — reach for it first on
  anything here. `tools/png-probe.js --at=x,y` reads a dumped surface's alpha,
  which is how you tell "filled black" from "never drawn".
  `tools/ne-disasm.js --all` sweeps a whole segment linearly rather than
  following one function to its first `ret`, which is how you grep a module for
  every write to a struct field — none of the `find_*` tools read NE images or
  16-bit ModRM.
  Two facts worth not rediscovering: a Win16 module name is not its filename
  (SOUND ships as `mmsound.drv`), and not every import is by ordinal.

### The three things that make the layer work

**The handle map** (`$win16_h16`/`$win16_h32`). A Win16 handle is 16 bits and
ours are 32-bit values like `0x00310001`. Rather than narrow every allocator,
the two spaces are joined at the dispatch boundary and nothing on the 32-bit
side learns Win16 exists. The table lives in the one arena slot past the last
usable selector, so no far pointer can name it.

**The bridge into the 32-bit handlers** (`$win16_call32_begin`/`_end`). Most of
Win16 is Win32 with narrower arguments, so the Win16 side widens onto a scratch
stdcall frame and calls `$handle_*` directly. It refuses a handler that moved
EIP (marker `0xCA16A9F7`), because a redirect into guest code carries a 32-bit
frame a 16-bit task cannot survive — ShowWindow and CreateWindow are written
out for that reason.

**The continuation** (`$WIN16_CONT_OFFSET`). An API that must run the window
procedure before returning pushes a far return address into the thunk segment;
`$th_retf16` recognises it and `$win16_dispatch` finishes the API. This is how
CreateWindow delivers WM_CREATE *before* it returns, which matters: Solitaire
never stores the handle CreateWindow gives it, because its WM_CREATE handler
sets the global instead.

### Open

- ~~**Solitaire's deal stops part way.**~~ FIXED `72b3ba8`, and the diagnosis
  in the previous version of this item was wrong in an instructive way — the
  animation tick at `seg 4:0x13ac` is a *drag* tick, `+0x14` means "a card is
  in hand", and it is correctly zero. The deal is synchronous: the loop at
  `seg 4:0xdd3` places all 28 cards every time. What failed was drawing them.
  `$win16_LocalAlloc` was a bump pointer and `LocalFree` a no-op, as its own
  comment admitted; Solitaire allocates one 26-byte node per card and frees all
  28 on the next deal, so a 4KB heap runs dry mid-way through the second hand
  and entirely by the third. A NULL from LocalAlloc is not an error the game
  reports — the pile just declines the card — so it looked like an animation
  that stalled. The heap now has a first-fit free list.
  The two "unexplained" observations were both artifacts of the harness, worth
  writing down so nobody chases them again: `test/run.js` gives the guest a
  synthetic clock of **200ms per batch**, so a 250ms timer is due on nearly
  every pump iteration and thousands of WM_TIMER in a short run are expected
  (the browser uses real time); and `--dump` runs its address through `g2w`, so
  `--dump=0xac00` never reads TIMER_TABLE at all — that address is a raw WASM
  offset below GUEST_BASE, not a guest address.
- ~~**Menu commands crash or draw nothing.**~~ FIXED. Every menu command of
  FreeCell, Solitaire and Minesweeper now runs — `test/test-win16-menus.js`
  drives all of them from each app's own `RT_MENU` via `tools/menu-sweep.js`,
  which is worth reaching for on any app, 16- or 32-bit: "it launches" says
  nothing about the twenty-seven things its menus do. Five causes, and only two
  of them were Win16 plumbing:
  - `SetWindowPos` (USER.232) was missing. Four of FreeCell's five commands go
    through one centre-the-dialog routine that calls it.
  - `ShellAbout` was missing, and reached two different ways: Solitaire and
    Minesweeper import SHELL.22, FreeCell imports the name. A built-in module
    called by name never reached module dispatch at all — `$win16_dispatch`
    trapped first — so there is now a name path beside the ordinal one.
  - `DispatchMessage` entered any non-zero window procedure as a far pointer.
    SendMessage had always checked; nothing had posted to a window of *ours*
    until ShellAbout put one up, and then CS took 0xFFFF.
  - `SetDlgItemText`/`SetDlgItemInt`/`GetDlgItemInt` (USER.92/94/95).
  - **A 16-bit MOVSD copied two bytes and advanced four.** `$th_string16` read
    its packed element size as "byte or word", so the 0x66-prefixed forms —
    which is how a compiler copies a RECT in one instruction pair — moved half
    the data and left every other word stale. This is an execution-core bug,
    not a Win16-layer one, and it is the reason Solitaire's Deck dialog drew
    twelve unreadable smears while opening perfectly well. Also fixed: the
    DRAWITEMSTRUCT behind WM_DRAWITEM is 48 bytes in Win32 and 26 in Win16, and
    a 16-bit procedure `les`-es the pointer it is handed, so it is now rebuilt
    in the task's own DGROUP (`$win16_msg_lparam16`, scratch reserved at the
    bottom of DGROUP by the NE loader).
- ~~**Hearts goes straight to the client path and finds no dealer.**~~ FIXED,
  and it was five bugs in five different layers, none of them the DDE guess the
  previous version of this item made. Hearts now puts up its own startup dialog
  ("What is your name?" / "I want to be dealer"), OK closes it, and it goes on
  to ask for the dealer's computer name — `test/test-win16-hearts-startup.js`
  pins the whole sequence.
  - **The command line was `"\r"`, not `""`.** InitTask handed back the DOS
    command tail, carriage-return-terminated. That pointer *is* WinMain's
    lpCmdLine, which is documented null-terminated, so MFC compared the first
    byte, saw 0x0D, and concluded it had been given a command line telling it
    to join a game. One byte.
  - **Every Win16 dialog-item API read the wrong argument.** `$win16_arg16` is
    ESP-relative and `$win16_call32_begin` moves ESP to the 32-bit scratch
    stack, so an argument read after the bridge opens comes off that frame
    instead — index 0 being the zero written there as a return address. Ten
    functions did it, so GetDlgItem asked for control 0 whatever it was passed.
    `$win16_arg16` now traps if called while the bridge is open.
  - **One posted message was delivered twice.** `$handle_PostMessageA` decided
    "is this window another instance's?" with `i32.and`, which evaluates both
    operands — so the host call that queues the message on the owning instance
    ran for our own windows too, and then this side queued it again. Not a
    Win16 bug: any app posting to itself got the message twice.
  - **Creating a dialog never ran the WH_CALLWNDPROC filter.** CreateWindow
    always had; DialogBox did not. MFC attaches its C++ object to the HWND from
    inside that call, and its dialog procedure's first act is to look the object
    back up — it called a virtual through the null it got.
  - **DefDlgProc's share was missing.** MFC subclasses the dialog and passes
    IDOK down the chain expecting the dialog to close, so the procedure our
    window hands back on subclassing has to end the dialog, and the pump has to
    route to the *window* procedure once one is installed rather than to the
    DLGPROC.

  Three more things stood between that and a game, all now fixed:
  - **NDDEAPI.DLL would not load**, and Hearts greys out the whole "How do you
    want to play?" group when it cannot ask `NDdeGetWindow` whether network DDE
    is there. NDDEAPI is now a module the emulator implements, and its one
    entry point answers with a window of ours: DDEML is implemented in WAT
    rather than by a separate agent process, so that is the truthful answer
    rather than a zero. A module we implement has no export table for
    GetProcAddress to read, so the entry point gets a fixed thunk-segment slot
    the way the pumps do.
  - **Control messages are numbered per class from WM_USER in Win16** and in
    distinct ranges in Win32 — BM_, EM_, LB_, CB_, SBM_ and STM_ all start at
    0x400 — so which block a number belongs to can only be decided from the
    class of the window being addressed. `BM_GETCHECK` arriving as 0x400 meant
    every radio button answered "not me".
  - **PeekMessage cannot be bridged the ordinary way.** It is the one handler
    that ends by setting EIP from its own stack frame, so an idle PM_NOREMOVE
    loop yields; across the bridge that address is the scratch frame's zero.

  Hearts now deals: `test/test-win16-hearts-startup.js` drives name, dealer, OK
  and New Game and checks a green table with cards on it.

  **Its menu commands are covered now too** —
  `test/test-win16-hearts-menus.js`, 18 checks, every command on both menus.
  The sweep never reached them because it drives a freshly launched app, and
  Hearts at that moment is inside its modal startup dialog; answering the
  dialog first is what makes the menu bar live. Two commands were broken and
  neither fault was Hearts-specific:

  - **`ClientToScreen` and `ScreenToClient` (USER.28/29) did not exist.** MFC
    centres every dialog with GetParent/GetClientRect/ClientToScreen, so this
    was on the path of any 16-bit MFC dialog. Game > Score died there.
  - **A dialog was never seeded its own first paint.** `$win16_dlg_run` marked
    every *control* dirty and never the dialog window, which no dialog built
    only from controls can notice. Template 502 (the Score Sheet) holds one OK
    button and the task draws the whole score grid from WM_PAINT, so the sheet
    came up as an empty grey box. Painting it then wanted `GDI.56 CreateFont`,
    also missing.

  **CORRECTION to what this file used to say here:** it claimed the DDE server
  wrapper near `seg 1:0x79ec` is never reached and "only the client one ever
  runs", so something upstream had already chosen client mode. That is no
  longer true, and it stopped being true when the startup dialog started
  working. Choosing "I want to be dealer" now takes the server path: a traced
  dealer run calls `DdeInitialize`, eight `DdeCreateStringHandle`,
  `DdeNameService` and three `DdePostAdvise`, and **never** `DdeConnect`. There
  is nothing left to find upstream of the dialog.
- **DDEML conversations: established, but not yet carrying transactions.**
  `src/09f-win16-ddeml.wat` now joins two instances in one room. A registered
  service name is *kept* (it never was — a registration nobody recorded is a
  server no client can find), `DdeConnect` puts a CONNECT on the wire and
  waits, the instance holding that service answers, and both sides record who
  they are talking to. `DdeDisconnect` tells the peer rather than forgetting
  it locally, since a conversation the other side still believes in is a
  server holding a seat for a player who has gone.
  `test/test-win16-dde-room.js` is the gate: two instances, separate memories,
  separate DDE tables, on one loopback segment — 14 checks including that
  nobody answers for a service that was never registered.

  Two things worth knowing before extending it:

  - **The room is one queue with one reader.** `$vsock_pump` owns it and used
    to *discard* any frame whose magic it did not recognise, so a DDE frame was
    eaten before DDEML saw it. It now hands `DDE1` frames to
    `$win16_dde_deliver`. Leaving them queued is not an option either: nothing
    else drains, so the socket stream would stall behind them. Any third
    protocol on this wire has to be demultiplexed in the same place.
  - **`DdeConnect` parks by not returning.** A Win16 API is entered with its
    arguments still on the task's stack and nothing popped until
    `$win16_api_return`, so declining to return re-enters the same call with
    the same arguments next pass. No continuation slot, nothing to unwind.
    This is why it is native rather than bridged — across the Win16 bridge the
    frame it would park on belongs to a scratch stack about to be discarded,
    which is the same reason `PeekMessage` cannot be bridged.

  **Hearts will still not join, and it is NOT a name-matching bug.** Both
  sides were traced and their interned strings dumped out of the handle table
  at guest `0x8F9200` (that address is `WIN16_ARENA + 127*0x10000 + 0x9200`;
  `--dump` reads it directly):

  | | service | topic |
  |---|---|---|
  | dealer registers | `MSHearts` | `Hearts` |
  | client asks for | `\\DEAL\NDDE$` | `Hearts$` |

  That is NetDDE working exactly as designed. The client does not connect to
  the dealer's application at all — it connects to the **NetDDE agent** on the
  named machine (`\\COMPUTER\NDDE$`) and names a **DDE share** as the topic;
  the trailing `$` is the share marker. The agent on the far side looks that
  share up in the machine's share database, which maps `Hearts$` onto the
  local pair (`MSHearts`, `Hearts`), and makes the real connection locally on
  the client's behalf. No string the client sends will ever equal a name the
  dealer registered.

  Hearts does not create the share itself: it imports no NDDEAPI entry
  statically and only `LoadLibrary`s it for `NDdeGetWindow`. On a real Win98
  box the share is part of the *machine*, put there at install time. So the
  piece to write is a **DDE share table** — share name to (service, topic) —
  consulted when a CONNECT names `\\host\NDDE$`, modelling the share database
  a Win98 install ships with. It belongs in the emulator as a table, not as an
  `if (this is Hearts)`.

  ~~**`XTYP_CONNECT` is not offered to the server's own callback.**~~ DONE.
  A DDEML server is not a table of names, it is an application with a callback,
  and that is where it says yes or no. The drain now QUEUES the question and
  the task's own message pump asks it — the callback cannot be run from the
  drain, because `$vsock_pump` is called from inside arbitrary API handlers and
  redirecting EIP there returns into the wrong frame. The callback is entered
  with a far return onto `$WIN16_DDE_CB`, which acts on the answer and then
  finishes the interrupted `GetMessage` with an idle message, so the task's
  loop never notices the detour. A conversation stays in state 2, offered, until
  the application accepts; a refusal is silence, which is what `DdeConnect`
  against a server returning FALSE sees.
  `test/test-win16-dde-connect-callback.js` pins both answers: two instances on
  a loopback segment, both running a real 16-bit message loop, with the
  server's callback a hand-written stub whose answer the test chooses.

  ~~**`DdeClientTransaction` fails, so nothing crosses.**~~ DONE for
  `XTYP_REQUEST`, which is the one Hearts opens with (`Join`). It follows the
  same three steps: the drain queues the question against the conversation it
  arrived on, the pump asks the application, and the handle the callback
  returns is emitted as a DATA frame. The client parks on the shared
  `$win16_dde_park` and the drain turns the reply into a data handle, so
  `DdeGetData` reads it like any other. A transaction nobody answers in time
  fails with `DMLERR_DATAACKTIMEOUT` and **leaves the conversation up** —
  tearing a session down over one slow item would be wrong.

  A conversation now remembers its topic, because `XTYP_REQUEST` hands the
  callback the topic and the item and only the conversation knows the former.

  ~~**`DdePostAdvise` has no advise loops to feed.**~~ DONE, and this is the
  one Hearts actually runs on: its dealer posts an advise after each move
  rather than being polled. A client's `XTYP_ADVSTART` is offered to the
  server's application like any other transaction; if it agrees, the loop is
  recorded against that conversation. `DdePostAdvise` then turns into
  `XTYP_ADVREQ` back to the same application — "what does it say now?" — and
  the answer is pushed as `XTYP_ADVDATA` to a client that is not waiting on
  anything, so it goes straight to *that* application's callback. Asking twice
  for one item does not open two loops, and a loop dies with its conversation:
  one left pointing at a closed conversation would push into a handle that has
  since been reused. `XTYP_POKE` and `XTYP_EXECUTE` cross too.

  `XTYP_WILDCONNECT` works too: a connect naming no service asks who is out
  there, every instance with a service to offer is a candidate, and the
  application is asked what it will serve rather than whether it will serve
  this. An instance serving nothing still answers nobody. `DDE_FBUSY` is
  honoured as its own answer — "not now" is neither yes nor no, so the caller
  keeps waiting and a wait that only ever saw busy ends in `DMLERR_BUSY`
  rather than a timeout. `DdeClientTransaction` uses the caller's `dwTimeout`,
  clamped so a hopeful two milliseconds still gives the far machine a chance.

  **`XTYP_MONITOR` is refused, on purpose.** A monitor is a DDE spy that
  expects to be told about every transaction in the system, and none of that
  is delivered. An instance that registered happily and then saw nothing would
  be the worst outcome — a debugging tool silently reporting that nothing is
  happening — so `DdeInitialize` with `APPCLASS_MONITOR` fails with
  `DMLERR_DLL_USAGE`, which is what Windows uses for a class the DLL will not
  serve. Implement the delivery before accepting the registration.

  **Also fixed while checking the codes:** `DMLERR_LOW_MEMORY` is `0x4007`, not
  `0x4001` — `0x4001` is `DMLERR_BUSY`. Five sites were returning "busy" where
  they meant "out of memory", which an app retrying on busy would loop on.

  **On testing any of this:** use the in-process harness. Two instances on a
  `LoopbackSegment`, each with a real NE loaded so selectors and a message loop
  exist, is deterministic and runs in seconds. The two-process
  `test-win16-hearts-join.js` is the end-to-end shape but it is timing-bound
  and this machine is regularly at load 80–200, where the dealer needs three
  minutes merely to register; it is not in `run-all.sh` for that reason.
  Minesweeper is the host of choice for the in-process tests: Hearts needs
  CARDS.DLL staged before it runs at all, and nothing in these tests is about
  the app.
- ~~**Named resources returned 0.**~~ FIXED. A NAMEINFO id with bit 15 clear
  is not an id: it is an offset from the start of the resource table to a
  Pascal string, and the walker matched integer ids only, so every `Load*`
  handed a string failed outright. That is not a rare corner — Solitaire's
  group icon is stored as `"SOL"`, which is why it had no icon.
  `$win16_find_resource_ex` takes a name to match instead of an id, comparing
  without case the way USER does, and `$win16_res_lookup` picks between the two
  from the argument's selector. `LoadIcon` and `LoadBitmap` go through it.
  `LoadMenu` and `LoadAccelerators` deliberately do **not** yet: they bridge to
  the 32-bit `$handle_Load*A`, which take an integer id and walk the PE tree,
  so accepting a name there means teaching those handlers a second grammar.
  Nothing in the four apps needs it — Hearts' named `HEARTSMENU` arrives by
  another path — so it is left rather than half-done.
- Known execution-core gaps, all of which trap loudly and none of which the
  four apps reach: INT (including the INT 3Fh moveable-segment thunks), 16↔32
  thunking. `tools/ne-dump.js --resources` shows what a module
  actually ships, including named types and ids; `--menus` and `--dialogs`
  decode the RT_MENU and RT_DIALOG templates, which are the two resources whose
  16-bit layout shares nothing with the 32-bit one and so cannot be read with
  `tools/parse-rsrc.js`. `--menus-json=` is what `tools/menu-sweep.js` falls
  back to when the PE walker finds nothing, and `--seg-bytes=N:OFF[:LEN]` reads
  raw segment bytes, which is the only way to look at the DGROUP string a
  disassembly names as `push 0x1e8`.
- Tracing for message-queue problems, added while chasing the Hearts duplicate:
  `--trace-win16` now prints `post ->` for every message going into the posted
  queue and `task-loop ->` / `dlg-pump ->` for every one coming out, each with
  the queue depth. A message delivered twice is either pushed twice or popped
  twice, and only both halves together say which. `--input=N:dump-msgq` prints
  the queue itself, which `--dump` cannot: it lives at WASM 0x400, below
  GUEST_BASE, so that address goes through `g2w` and lands somewhere else.
- ~~**Solitaire showed an empty table, and cards could not be dragged.**~~
  FIXED, and neither was a Solitaire bug.
  - **The initial erase arrived too late.** It was left to the non-client flag,
    which GetMessage drains *after* the post queue — so it landed behind
    whatever the app had posted for itself. Solitaire posts its deal from
    WM_CREATE and draws each card as it deals rather than from WM_PAINT, so the
    erase painted the table green over a hand already laid out and nothing
    asked for it back. The cards appearing "only when you touch a menu" was the
    menu invalidating the window. `$win16_ShowWindow` now posts the erase with
    its own WM_SIZE/activation group, ahead of the app's, which is the order
    Windows gives it: there the erase happens inside ShowWindow before the
    task's message loop runs at all.
    Worth recording what did *not* work, since both look right: invalidating
    the window when the erase is delivered fixes Solitaire but costs a full
    repaint per erase per window, which timed mspaint's tool sweep out; and
    invalidating at ShowWindow is dropped on the floor, because the window has
    no size yet and the paint phase silently discards an empty update rect.
  - **PtInRect had x and y the wrong way round.** Its POINT is one argument
    passed *by value*, so a doubleword push puts x nearest the top of the stack
    — the opposite of the separate x and y of InflateRect beside it. The test
    asked whether (y, x) was in the rectangle, which is false for every card, so
    the button-down that starts a drag found nothing under the cursor. Any
    future Win16 API taking a POINT by value has the same trap: `ChildWindowFromPoint`
    and `WindowFromPoint` are the two that are not implemented yet.
  - `GDI.103 PtVisible` was missing; Solitaire asks it while drawing the stack
    it has picked up. `test/test-win16-solitaire-play.js` covers both the
    untouched deal and a drag that empties the column it came from.
- Structure width is the recurring bug class here, and it is worth stating
  plainly: **a structure that crosses the boundary is a different size in the
  two worlds.** `SystemParametersInfo(SPI_GETWORKAREA)` wrote a 32-bit RECT
  into FreeCell's 8-byte one, four bytes below its own return address, and the
  task returned to zero. A watchpoint on that slot named it in one run. The
  APIs that carry a structure now convert explicitly and stop on one they do
  not know rather than guessing at a width.
- Argument *order* is the second recurring bug class, and it bites in both
  directions: `CreateWindowEx` takes `dwExStyle` as its **first** parameter, so
  Pascal pushes it deepest and no other index shifts, while
  `AdjustWindowRectEx` takes it **last**, where every other index does shift.
- Argument *width* is the third, and it is the nastiest because it is silent
  and delayed. A Win16 `HHOOK`, `HSZ`, `HCONV` and `HDDEDATA` are all **far
  pointers**, not words. Getting one wrong pops two bytes too few, and the
  caller's frame drifts two bytes at a time until some unrelated `RETF` half a
  screen away reads a garbage CS and the trap names a function that has
  nothing to do with it. Do not guess a Win16 signature: `tools/ne-dump.js
  --relocs=N` gives the offset of every import call site and
  `tools/ne-disasm.js` shows what the app actually pushes there.

## 2. Fonts — e2e verification and the original measurement (session `ea1ba02f`)

- Files: `src/10b-gdi-font.wat`, `src/10c-truetype.wat`, `lib/host-imports.js`,
  `lib/font-substitutions.js`, `fonts/substitutions.json`,
  `tools/v86-reference/*`, `test/fixtures/font-metrics.json`,
  `test/test-wat-font-metrics-reference.js`
- Commits `eff03cb`, `45e58ae` have unit coverage and a byte-identical notepad
  render, but **no e2e run** — see item 0, which is largely this.
- Its own stated next step ("#1"): the original measurement question, now that the
  measurement infrastructure exists; item #3 on its list comes free with it.
- Still open and font-shaped: `test-winhelp-reference` fails on
  `WinHelp close glyph differs from Win98`.

## 3. Async I/O demo path (session `410075d6`)

The blocking question is **answered**: the user picked Blobby Volley directly,
so the telnet-first detour is dropped.

- **Blobby Volley single-player is done** (`bd9a56a`) — it plays, with no
  emulator change needed. See `apps/blobby-volley.md`, covered by
  `test/test-blobby-volley.js` (9 checks, e2e tier).
- **The DirectPlay lobby now runs** (`f9e2d25`). `NETZWERKSPIEL` reaches both
  end states: host → `Open` + `CreatePlayer` → "WARTE AUF EINEN GAST…", guest →
  `EnumSessions` → "GEFUNDENE SPIELE: LOCAL SESSION". Covered by
  `test/test-blobby-network.js` (10 checks, e2e tier). Two fixes: the
  `DirectPlayCreate` handler popped 20 bytes for a 3-arg function (which
  quietly killed the game thread), and it was an `E_FAIL` stub even though
  `IDirectPlay3` was already implemented behind `CoCreateInstance`.
- **Still open: traffic between two processes.** `Send` returns `DP_OK` without
  sending, `Receive` returns `DPERR_NOMESSAGES`, and `EnumSessions` fabricates
  its one session — so a host and a guest cannot meet. This is the remaining
  real async I/O, and it pairs with the virtual LAN in item 4:
  `src/09d-winsock.wat` + `lib/vlan-wire.js` already join two emulator
  processes into one room, and the guest screen offers a **Host-IP** field that
  maps straight onto `--vlan-ip`.
- **Telnet** (`apps/telnet.md`) remains available as a cheaper async-I/O proof if
  DirectPlay turns out to be a long haul: 0x0 `WS_POPUP` window, never calls
  `ShowWindow`, pumps forever; the XP console client also needs console
  rendering.

## 4. Virtual LAN / TetriNET (session `b303255f`) — mostly landed

- `ecd3a6b` + `209aa00` now carry the round-trip gate and the prop-atom fix.
  Verified: corpus 106 PASS / 0 FAIL, `test-vlan-tetrinet` 6/6.
- Files: `src/09d-winsock.wat`, `src/09a5-handlers-window.wat`,
  `test/test-vlan-tetrinet.js`, `test/test-wat-winsock-hostname.js`
- Remaining: the browser wiring for the virtual LAN (`lib/vlan-wire.js` currently
  proves loopback + cross-process; the browser side is unbuilt).

## 5. WinHelp (session `351afaf4`) — clean, one open item

- `87a9546` verified: parser 606/7, `test-help` 5/5, `winhelp-dll-macro` 6/6.
- Files: `src/09c6-winhelp-core.wat`, `src/09c7-winhelp-hlp.wat`,
  `src/09c9-winhelp-ui.wat`, `tools/hlp-wat-check.js`
- Open: the close-glyph mismatch above (font work, not parser work).

---

## Cross-cutting, carried over from earlier sessions

- ~~**`CW_USEDEFAULT` ignores only x, not y**~~ — FIXED `7d4d1af`. x and y are a
  pair, so `x=CW_USEDEFAULT` makes the system pick both and ignore the caller's
  y. Solitaire and Notepad now open in the y=20 cascade slot. The 20px shift
  fixed three e2e tests (`solitaire-maximize`, `notepad-find-next-positive`,
  `notepad-find-not-found-msgbox`) and broke exactly one, `notepad-menu`, which
  sampled a fixed desktop point for the File dropdown; its anchor is now derived
  from the live window origin. Verified with a full before/after e2e diff in a
  clean worktree, plus unit 92/2 and corpus 106 PASS / 0 FAIL.
- ~~**mspaint scrollbar travel**~~ — FIXED `2bc5c16`, and it was never an
  emulator bug. `test-mspaint-scrollbar-thumb` (3/5 → 6/6) and
  `test-mspaint-large-scroll` (2/5 → 5/5) were pinned to the geometry of a
  212x283 view; the frame's client inset is now correctly 6px, the view is
  202x274, and Paint's page/4 arrow scroll moved with it. New rot-proof input
  actions in `test/run.js`: `scroll-click`, `scroll-drag`, `dump-scrollbar`,
  `caption-click`, and `assert-standard-scroll` now takes `N%` of the bar's own
  page size. Three mspaint `execFileSync` timeouts also raised to 45s — they are
  hang ceilings, not performance budgets, and were going red on box load alone.
- **Screensaver GDI-bridge regression** — `apps/screensavers.md` Task 0, fixed
  2026-08-15 via the RLE DIB path; re-read before trusting it, since
  `test-cwordzap-render`'s RLE4 asserts are failing again in the current e2e run.
- ~~**d3rm `MeshBuilder::Load` / ProgressiveMesh**~~ — RESOLVED 2026-08-16. The
  `D3DRMERR_NOTFOUND` was correct: our DX SDK extract ships no `camera.x`, and
  the one we had was a ProgressiveMesh copied under that name in April, which a
  MeshBuilder refuses by design. Given a real plain `Mesh` file the viewer loads
  and renders — DX5 D3DIM Viewer `KNOWN_BAD_RENDER` → **PASS**, corpus 106 → 107
  PASS. Retained-mode geometry works; see `apps/screensavers.md` Task 3.
- **CITYSCAP blank screen** (Task 2, MEDIUM), **FOXTROT white silhouettes**
  (Task 1, LOW).
- **CD Player** renders frame and menu but not its transport controls — the only
  other unresolved emulator bug among the sweep WARNs.
- **External-asset WARNs** (not emulator bugs; each names its blocker in
  `test/test-all-exes.js`): Kodak Preview needs OIDIS400+OIADM400, HyperTerminal
  needs HYPERTRM.dll, Welcome98 needs `welcome.dat`, IP Config has no adapter,
  JigSawedME and Rodent2000 need the VB6 runtime, XP EOL is version-gated by
  design.

---

## Hazard worth knowing about

Something in this shared tree rewrites whole `src/` files that other agents have
dirty. A verified `$prop_key` fix was reverted from disk between a read and a
commit; `git commit <path>` then silently committed only the other file, and the
loss was visible only in the `1 file changed` stat. **Check the file count in
commit output — do not assume your hunks landed.**

## Follow-through and 3D performance — user requested 2026-10-01

- [x] Reconcile Codex handoffs and turn unfinished outcomes into tasks
  id: OPS-HANDOFF-FOLLOWTHROUGH
  status: done
  created: 2026-10-02T04:00:31.545Z
  created-by: user-request via ops-dashboard
  Next: Complete: all nine original roots and child dispositions mapped to integrated, queued, blocked or deferred outcomes; six missing follow-ups added without launching backlog.
  Done: Each handoff has an explicit disposition: integrated, queued with a task ID, blocked with a concrete reason, or deferred. Update TODOS and STATUS from evidence; distinguish accepted custody from completed implementation. Preserve the automated-review block and deferred Claude ownership.
  Evidence: ops/handoffs/ops-handoff-followthrough.md
  owner: codex:01a0f9d8-c0cd-73b3-a357-fb3ff1c784c0
  accepted: 2026-10-02T04:11:37.233064+00:00
  accepted-by: codex:01a0f9d8-c0cd-73b3-a357-fb3ff1c784c0

- [x] Build a repair queue from failing EXE candidates
  id: EXE-FAILURE-TRIAGE
  status: done
  created: 2026-10-02T04:00:31.545Z
  created-by: user-request via ops-dashboard
  Next: Complete:167result hashes checked,5failed/1harness-error deduplicated; actionable findings mapped to Zuma, Pirates route/terrain, SAM production and Q2 traversal tasks. Historical/unknown captures kept distinct.
  Done: Each actionable failure has a candidate-linked task with route, build, evidence, reproduction and done criteria. Distinguish historical/unreviewed evidence, application failures and harness errors; merge duplicates and shared root causes. Unknown or missing captures are not automatically failures. Do not launch the whole corpus concurrently.
  Evidence: ops/handoffs/exe-failure-triage.md; scratch/exe-failure-triage-20261002/run-inventory.json
  owner: codex:01a0f9db-89c0-73b3-b528-fe8bf239e061
  accepted: 2026-10-02T04:11:37.233064+00:00
  accepted-by: codex:01a0f9d8-c0cd-73b3-a357-fb3ff1c784c0

- [x] Reproduce and resolve Zuma startup QueueUserAPC failure
  id: EXE-ZUMA-STARTUP
  status: done
  created: 2026-10-02T04:00:31.545Z
  created-by: user-request via ops-dashboard
  candidate: reflexive-zuma-deluxe
  Next: None for startup triage: reviewed title/loading reached on c474288d with no historical missing QueueUserAPC; menu/gameplay unverified and would require a separate task.
  Done: A current reviewed run either demonstrates the historical failure is resolved or reproduces and fixes its cause with a focused regression. Capture startup/menu evidence and exact build/command; do not claim gameplay from a menu alone or add a silent-success stub.
  Evidence: ops/handoffs/exe-zuma-startup.md; ops/handoffs/exe-zuma-preflight.md; scratch/runs/20261002T042949Z-reflexive-zuma-deluxe-startup/result.json
  accepted: 2026-10-02T04:11:37.233064+00:00
  accepted-by: codex:01a0f9d8-c0cd-73b3-a357-fb3ff1c784c0
  owner: codex:01a0f9db-89c0-73b3-b528-fe8bf239e061
  Notes: Planned60s observation ended normally4290batches/exit0; outer90s guard unused,6084 frozen hashes unchanged. Root reviewed640x480 title/loading PNG; no hang or gameplay claim. Both earlier harness failures preserved.

- [ ] Compare NFS3 speed and correctness in Glide, D3D and original software
  id: NFS3-RENDERER-BENCH
  status: backlog
  created: 2026-10-02T04:00:31.545Z
  created-by: user-request via ops-dashboard
  candidate: need-for-speed-3-demo
  Next: Reclaimed 2026-10-31 from released Codex owner. Review the retained CDP SwiftShader versus Glide Intel/Mesa discrepancy and define the same-source three-renderer comparison; any heavy benchmark runs on a separate boat after a gameplay route is verified. Existing failed attempt is not a timing baseline.
  Done: Report all three guest renderer paths on the same identified source/WASM/browser/CPU/GPU, resolution and controlled race/weather/input route. Separate original game software rendering from our software backend; verify no hidden GPU fallback or SwiftShader substitution. Save reviewed race images, repeated warmed-up FPS/frame-time median and p95, CPU profiles, draw/triangle/texture/upload/readback/fallback counters, sample counts and spread, plus same-path control. Report unavailable paths explicitly. Record bottlenecks and a predeclared performance acceptance budget; historical high-load FPS is not a current baseline.
  Evidence: ops/handoffs/nfs3-renderer-bench.md; scratch/nfs3-renderer-bench-20261002/closure-report.json; scratch/nfs3-renderer-bench-20261002/local-resource-preflight.json; ops/handoffs/nfs3-capacity-recheck.md; ops/handoffs/nfs3-software-prep.md
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  accepted: 2026-10-02T04:11:37.233064+00:00
  accepted-by: codex:01a0f9d8-c0cd-73b3-a357-fb3ff1c784c0
  Notes: Root34 downloaded hashes/cleanup/post-input checks pass; car/road image reviewed but no qualified timing. Failure occurred before qualification windows at backend identity gate. Host explicitly released for GTA2 then Unreal; all three original renderer paths remain required.

- [x] Audit the actual shared 3D rendering pipeline across APIs
  id: RENDER-SHARED-AUDIT
  status: done
  created: 2026-10-02T04:00:31.545Z
  created-by: user-request via ops-dashboard
  Next: Complete: main/private API-backend matrices, semantic/resource gaps and proposed slices S1-S5 documented. Backlog implementation awaits scheduling; no broad private merge.
  Done: Publish an implementation-backed API/backend matrix, ownership boundaries, duplicate semantic lowering and remaining divergence, with bounded migration tasks and representative correctness/performance fixtures. Distinguish one shared worker or texture registry from a shared drawing contract. Preserve API-specific semantics at adapters and explicit fallback behavior. Do not claim the proposal is already implemented.
  Evidence: ops/handoffs/render-shared-audit.md; scratch/render-shared-audit-20261002/source-manifest.json
  owner: codex:01a0f9db-4a5d-7733-ade9-8b71d8e3f05f
  accepted: 2026-10-02T04:11:37.233064+00:00
  accepted-by: codex:01a0f9d8-c0cd-73b3-a357-fb3ff1c784c0

- [x] Keep the coordinator picking up tasks and completed handoffs
  id: OPS-COORDINATOR-CONTINUITY
  status: done
  created: 2026-10-02T04:00:31.545Z
  created-by: user-request via ops-dashboard
  Next: Use the durable inbox at each queue/handoff boundary under the existing active native goal; refresh truthful runtime evidence and acknowledge exact reviewed notice IDs.
  Done: New ready tasks and worker handoffs are acknowledged and reconciled without manual prompting, with deduplicated wake requests and at most one coordinator. Never send wake text into a tool approval or a busy terminal. Test idle, busy, approval, disconnect and restart cases using fixtures. Before going idle, convert unfinished outcomes into follow-ups and record why remaining work cannot proceed; do not bypass blocked review or take deferred claims.
  Evidence: ops/handoffs/coordinator-continuity.md; ops/coordinator-inbox.js; ops/coordinator-inbox.test.js; scratch/coordinator-live-scan.json; scratch/coordinator-live-ack-restart.json; scratch/coordinator-natural-handoff.json
  accepted: 2026-10-02T04:11:37.233064+00:00
  accepted-by: codex:01a0f9d8-c0cd-73b3-a357-fb3ff1c784c0
  owner: codex:01a0f9db-4a5d-7733-ade9-8b71d8e3f05f
  Notes: 10 fixture tests PASS; live busy scan51 notices,2 exact ack/restart persistence, and natural Zuma handoff change delivered with prior version retained until explicit ack.4 notices acknowledged total; remaining pending preserved. Native goal owns continuation; no wake daemon or terminal input.

- [ ] Implement the next bounded shared 3D command-contract slice
  id: RENDER-SHARED-IMPLEMENT
  status: backlog
  created: 2026-10-02T04:00:31.545Z
  created-by: user-request via ops-dashboard
  depends-on: RENDER-SHARED-AUDIT
  Next: Use the audited matrix to select and record the smallest shared semantic slice, exact owned files and per-API regression cases before implementation.
  Done: The chosen slice uses one explicit drawing/resource contract with thin API adapters and GPU/software executors, removes the corresponding duplicate interpretation, and passes differential pixel/state/resource-lifetime and ordering tests for affected APIs plus representative game captures. Record unsupported semantics and remaining migration tasks; a shared worker alone is not completion.
  Evidence: docs/render-command-unification.md; ops/handoffs/mig-render-textures-validation.md

- [ ] Profile and optimize the shared 3D path with repeatable performance gates
  id: RENDER-PERF-GATE
  status: backlog
  created: 2026-10-02T04:00:31.545Z
  created-by: user-request via ops-dashboard
  depends-on: NFS3-RENDERER-BENCH, RENDER-SHARED-AUDIT
  Next: Select the largest measured shared bottleneck from the renderer matrix, declare workload/metric/regression budget and compare one bounded change against an unchanged control on a quiet host.
  Done: Show repeatable improvement beyond control noise with unchanged reviewed images/state and no regression beyond the declared budgets across representative legacy D3D, D3D8/9, OpenGL and Glide GPU/software workloads. Attribute CPU emulation, translation, submission, GPU, readback and presentation costs separately. Save raw measurements/profiles/build hashes and reject changes whose gains disappear in game routes. No default switch on microbenchmark-only evidence.
  Evidence: docs/render-command-unification.md; docs/re-notes/need-for-speed.md; ops/handoffs/mig-fp-kernel.md

- [ ] Diagnose Pirates stopping before the target rendering operation
  id: PIRATES-ROUTE-FOLLOWUP
  status: active (title-to-native-Load dependency unresolved; runtime slot released)
  created: 2026-10-02T04:00:31.545Z
  created-by: user-request via ops-dashboard
  candidate: pirates-2004
  Next: ce79828e8 exact13 recipe files identical; no supported causal drift or repair. Retain 70589baac boarding entry (50 Englishmen/40 Pirates), no duel outcome/capture/save. Revisit only with a supported discriminating ordinary-input test; do not repeat blind title retries.
  Done: Identify the route failure and either validate the actual game transfer/readback with reviewed images or record a precise blocking dependency. Link unresolved terrain defects separately; a zero-transfer run is not a rendering pass.
  Evidence: docs/re-notes/pirates-2004.md; scratch/runs/20261031T0215Z-pirates-small-slice/result.json; scratch/runs/20261031T0220Z-pirates-main-sailing/result.json; ops/handoffs/mig-pirates-stretch.md; ops/handoffs/mig-pirates-stretch-recipe.md

- [x] Verify Quake II world traversal beyond a changed frame
  id: Q2-MOVEMENT-FOLLOWUP
  status: done
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  created: 2026-10-02T04:00:31.545Z
  created-by: user-request via ops-dashboard
  candidate: quake-2-demo-installer
  Next: Complete: original ordinary forward/reverse/idle traversal independently reviewed on WebGL2534731b3 and software069662726. Runs20261007T213620Z-quake2-ordinary-traversal and20261008T000901Z-quake2-software-ordinary retain reference identities; no redundant run.
  Done: Reviewed before/after world captures and position/landmark evidence demonstrate actual traversal, with exact build, route and renderer provenance. Retain texture/resource checks and distinguish movement from animation or camera-only changes.
  Evidence: ops/handoffs/mig-render-q2.md

- [x] Recover and review screenshots and diagrams from historical runs
  id: OPS-HISTORICAL-VISUALS
  status: done
  created: 2026-10-02T04:03:23.368Z
  created-by: user-request
  Next: None for this bounded recovery/audit. Unlinked-candidate and unresolved-association searches are recorded separately as backlog; no new game runs or automatic restorations.
  Done: Publish confidently associated screenshots/diagrams as file-backed run bundles with exact original path, content hash, source timestamp basis, build/route when known and provenance. Link candidate, session and task only with evidence; unknowns stay unknown. Deduplicate by image hash, visually inspect contact sheets, classify blank/loading/error/gameplay captures and select a representative frame. Preserve failed/black-frame evidence in run details rather than deleting or calling it a pass. Review the 147 previously quarantined ambiguous bundles; restore only verified associations, never infer GeneRally from prose containing generally. Produce a coverage report listing recovered images, missing sources and unresolved associations; do not execute historical commands or rerun games to fabricate historical captures. Keep historical/unreviewed status explicit, and link failures to EXE-FAILURE-TRIAGE without claiming current compatibility.
  Evidence: ops/handoffs/ops-visual-acceptance.md; ops/handoffs/ops-quarantine-review.md; ops/handoffs/ops-visual-coverage.md; scratch/ops-visual-acceptance-20261002/final-verification.json
  accepted: 2026-10-02T04:11:37.233064+00:00
  accepted-by: codex:01a0f9d8-c0cd-73b3-a357-fb3ff1c784c0
  owner: codex:01a0f9d8-c0cd-73b3-a357-fb3ff1c784c0
  Notes: Final18images/18distinct hashes and metadata verified; seven new images reviewed,522protected inputs unchanged,441quarantine files preserved.147rows reconcile9supported/5incorrect/133unresolved with rootNFS2proof. All9supported rows and separately correctedNFS3 copy published; coverage30of76,46unlinked. No current compatibility/performance claim.

## Original handoff follow-ups — reconciled 2026-10-02

- [ ] Validate FP variants in matched-work game windows
  id: FP-GAME-GATES
  status: backlog
  created: 2026-10-02T04:16:51.185761+00:00
  created-by: orchestrator-handoff-audit
  depends-on: MIG-FP-KERNEL
  Next: Prepare P/P control and P/PCM/PCP game windows with FP_SHARE_CALENDAR=1, reviewed pixels/API/tier counters and exact host identities.
  Done: Matched work and meaningful timing precision/control established, or exact failed gate recorded; no default switch from microkernel evidence.
  Evidence: ops/handoffs/fp-next-root.md; ops/handoffs/mig-fp-kernel.md

- [!] Complete Serious Sam production integration and ordinary gameplay
  id: SAM-PRODUCTION-FOLLOWTHROUGH
  status: blocked
  created: 2026-10-02T04:16:51.185761+00:00
  created-by: orchestrator-handoff-audit
  depends-on: MIG-SAM-REP-RESTART
  candidate: serious-sam-demo
  Next: After REP review clears, validate generic fault/classifier contracts, integrate only owned tested timer/TLS/memory slices and review diagnostic transform removal before launcher/input work.
  Done: Production build reaches menu and level with supported input, verified movement/combat and no private diagnostic shortcuts; exact source/module and focused regressions retained.
  Evidence: ops/handoffs/mig-sam-fault-remainder.md; ops/handoffs/01a0f6ff-da61-7710-a604-d9442103dbbd.md
  blocker: REP validation remains incomplete after automated review; do not retry through another channel.
  waiting-on: MIG-SAM-REP-RESTART review resolution

- [ ] Integrate tested private renderer changes without losing main work
  id: RENDER-PRIVATE-INTEGRATION
  status: backlog
  created: 2026-10-02T04:16:51.185761+00:00
  created-by: orchestrator-handoff-audit
  depends-on: RENDER-SHARED-AUDIT
  Next: Use audit to select a coherent private patch, reconcile intervening main changes and create a frozen integration candidate; exclude unvalidated empty-quad optimization.
  Done: Selected changes validated on current integration base with affected API games/tests and exact identities; unvalidated changes kept separate and any merge follows explicit ownership review.
  Evidence: ops/handoffs/01a0eb29-4302-7e20-9b06-7084fb37358b.md; ops/handoffs/mig-render-textures-validation.md

- [x] Diagnose Pirates white terrain with a controlled capture
  id: PIRATES-TERRAIN-REVIEW
  status: done (four-stream capability mismatch corrected; textured native coast verified)
  created: 2026-10-02T04:16:51.185761+00:00
  created-by: orchestrator-handoff-audit
  depends-on: PIRATES-ROUTE-FOLLOWUP
  candidate: pirates-2004
  Next: Accepted44d8b27fd plus7a850207f: original four-stream declarations rejected by cap1 now pass cap16 with NSB/requirements/native return/cache hit verified. Coordinator personally inspected23/28 green/rock/beach coast; focused checker rerun PASS296source40support1374original2129responses104URLs5negativecontrols24draws31programmed52trusted and complete cleanup. Later draw meshes differ from factory meshes; shared shader alone does not prove same-mesh causality. Focused white-terrain defect corrected; broader rendering/transfer/FPS qualification remains open.
  Done: Reviewed terrain evidence identifies the failing contract and focused correction or concrete dependency; no zero-transfer pass used as terrain proof.
  Evidence: docs/re-notes/pirates-2004.md; scratch/runs/20261031T0215Z-pirates-small-slice/result.json; scratch/runs/20261031T0220Z-pirates-main-sailing/result.json; scratch/runs/20261031T0458Z-pirates-knownsource/verification.json; ops/handoffs/01a0f736-78f1-7822-8b37-159d6f8ed94d.md

- [ ] Review nested transfer packet preservation
  id: PIRATES-TRANSFER-REENTRANCY
  status: backlog
  created: 2026-10-02T04:16:51.185761+00:00
  created-by: orchestrator-handoff-audit
  candidate: pirates-2004
  Next: October8 main058b82eba audit: only whole-surface/filter0 support; archived428c9abed rectangle/filter2 packet implementation is absent from main. Isolate archived source/tests, audit nested callback deferral and per-invocation stage/packet ownership, prove negative/positive nested pixel/cleanup behavior before integration. See ops/handoffs/pirates-stretch-main-reconciliation-20261008.md.
  Done: Explicit ownership/lifetime contract and focused nested-call regression, or exact unsupported case recorded; no unchecked pooling/copy removal.
  Evidence: ops/handoffs/01a0f736-78f1-7822-8b37-159d6f8ed94d.md

- [ ] Reconcile remaining historical recovery changes against current main
  id: RECOVERY-PATCH-RETRIAGE
  status: backlog
  created: 2026-10-02T04:16:51.185761+00:00
  created-by: orchestrator-handoff-audit
  Next: Perform read-only patch-equivalence audit of codex/recovery-main-20260910 and current main, separating landed, obsolete and missing runtime/overlay/save/screensaver changes.
  Done: Each remaining change has current evidence and explicit disposition/task; no stale branch bulk merge or old-build acceptance reused.
  Evidence: ops/handoffs/01a08812-a2da-7333-83fc-851ef8fff7b1.md


- [ ] Measure browser FPS for strongest local and desktop game candidates
  id: OPS-GAME-FPS-BASELINE
  status: backlog
  candidate: jazz-jackrabbit-2-demo-installer, reflexive-collapse-crunch, reflexive-ricochet-xtreme, unreal-special-edition, gta2-demo
  done: Publish run performance metadata with guest present counts, wall duration, per-sample p95 frame time, renderer/GPU, hardware-versus-SwiftShader, scene, build hash and measurement date; review playable route before measuring. No menu, browser rAF or CLI batch timing relabelled as gameplay FPS.
  Next: Reclaimed 2026-10-31 from released Codex owner. Select a verified evolving-gameplay route before measuring; retain unlaunched Ricochet board as diagnostic only. Heavy benchmarks run on a separate boat. Current UT2003/Pirates gameplay work keeps priority over benchmark dispatch.
  Notes: Ricochet root100hash/arithmetic audit and eight images reviewed: apparently unlaunched ball/full bricks/zero score, gameplay measurement unaccepted. Host released; NFS3 transferring. Collapse association preparation under root review/callsite proof assigned; Jazz route and Unreal package remain pending.
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  accepted: 2026-10-02T05:21:49.472399+00:00
  accepted-by: codex:01a0f9d8-c0cd-73b3-a357-fb3ff1c784c0
  Evidence: ops/handoffs/ops-game-fps-baseline.md; ops/handoffs/ops-fps-labels.md; ops/handoffs/ops-historical-fps-semantics.md; scratch/ops-gta2-fps-20261002/root-review.md; ops/handoffs/ops-unreal-fps-preparation.md; ops/handoffs/ops-jazz2-package.md; ops/handoffs/ops-collapse-v2-package.md; ops/handoffs/ops-ricochet-measurement.md

- [ ] Investigate remaining unlinked historical visuals and uncertain associations
  id: OPS-HISTORICAL-UNLINKED
  status: backlog
  created: 2026-10-02T05:58:39.995255+00:00
  created-by: orchestrator-historical-audit
  depends-on: OPS-HISTORICAL-VISUALS
  Next: Select a bounded evidence-only batch from46unlinked candidates or133 unresolved exact associations after scheduling; use existing source paths/tests/notes before any separately scoped transcript work.
  Done: Publish only confidently associated existing captures with exact hashes/provenance, update coverage and disposition deltas, preserve originals and explicit unknowns; never rerun games to fabricate historical evidence.
  Evidence: ops/handoffs/ops-visual-acceptance.md; ops/handoffs/ops-quarantine-review.md; scratch/ops-visual-acceptance-20261002/final-verification.json
  Notes: The completed18-image recovery/147-bundle audit remains accepted. This deeper search is unscheduled, not permission to take deferred Claude claims or restore incorrect associations.


## Codex reclaimed work — 2026-10-07

Current scoped ownership after reconciling the stopped fleet. The shared operational ledger retains other historical and released tasks. See ops/handoffs/codex-resume-20261007.md.

- [ ] Finish rescued CRT nonlocal jumps after invocation ownership prerequisite
  id: CRT-NONLOCAL-TRIAGE-20261031
  owner: codex
  status: waiting on existing callback/JS/concurrency/SEH ownership and dual-dispatch prerequisite
  Next: Resolve the existing census gate before porting rescued 704b2158f/6828ee2ac; do not bypass it. Owner seven-topic integration otherwise reconciled: remove431e1922b, Uplink9e0860421, Win16bedaaaa7f and ToyVM68ac26542 pushed with focused tests and four full builds. D3D9 alpha5649dd4d7, P8 guard3186dd59ca and DOS renamecdddc109b/568009245 already on main/superseded. Older ToyVM IP-width test fails identically before/after; stencil browser harness unavailable (missing puppeteer), not a pass. GLTron50batch CLI only startup, no gameplay claim.
  Evidence: scratch/runs/20261031T0443Z-land-seven-topics/result.json; tools/callback-ownership-census.js; existing callback ownership task below


- [~] Keep two new games moving toward playable gameplay with screenshots
  id: NEW-GAMES-PIPELINE
  Current 2026-11-04T03:58Z: DeusExfade2000a tested feasible preparation offline, but live two Left pulses measured zero and second world capture turned blank teal; stopped before Down/Up/Space, Z96 unreached. Published479b341a6 identifies missing ownership/publication/input observations;33 boundary cases+driver integration+6queue14timing passed, no production cause proved. Fresh deusex-owned-publication-pulse worker01a1a4c6-4b36-7262-98c9-f78106c77266 session42948 collects these boundaries on bx_affrncy3, at most one guarded25msLeft pulse after inspected qualified original world; recover04:36Z/expiry04:46:29Z coordinator shutdown. Returned bx_dzkgnet6 stopped with verified snapshot04:05:29Z. Darkstone b8773d9f8 software Ardyl manual victory personally inspected: LIFE35/35to16/35, Victories0-0to1-0; all1504artifact SHA256 PASS. Published05c4a29ce original WebGL SwiftShader Town/FManual/Ardyl aimed Skeleton defeat accepted: LIFE32/35to20/35, Victories0+0to1+0 and EXP increase; four captures personally inspected,863fullSHA PASS. bx_3ub9q4br normalSTOPPED04:28:49Z with verified snapshot. Software and WebGL combat demonstrated; physicalGPU/FPS/audio/fullgame remain unqualified. Fresh offline legacy-integer-center-interpolation worker01a1a4d3-62de-74e3-a4a5-619c606cfda8 session76001 investigates observed spatial MINLINEAR mismatch while preserving top-left coverage; no box/browser allocated. MDK2 offline632639d35 traced the first failure to premature title Enter, tested25 readiness controls; 4454bdf5f integrated observer but stopped after uninspectedtitle advances; NewGame visible/unactivated. Published2b7c8a1ff inspectionbarrier6tests+25selectorcontrols passed;14livecaptures separatelyVIEWed, stopped3216 because observe rejected openinganimation transitiontrue. NewGame/Medium/tutorial unreached. Fresh mdk2-opening-observation worker01a1a4c7-5cee-76b0-9b78-283febb1ca0b session97842 on bx_wnjq4738 recover04:49Z expiry04:59:39Z coordinator shutdown tests bounded16step animation observation while retaining strict selection/inspection guards; explicit WebGL1 7d1a1289 accepted, publicCOM mip460484dc6 canonical direct34pixels PASS; fresh public child-mip mutation/queued/compat worker on bx_4hx68dxv recover04:28Z. No local heavy runtime or source/media archives; full27/backend gameplay and broader crash freedom remain open; rejected queued-texture diagnostic excluded.
  Current 2026-11-03T17:00Z — Alice20a45ddfe native main/cooperative holds and original DLL relocation pass; actual UD2 exits CLI before inspectable fault retention. Root full SHA256SUMS, published ancestry and normal STOPPED/snapshot verified. No original Alice launched. Fresh Alice7555/thread01a1a25a-fa97-7b93-8d6d-bf6f64bf4673 repairs host fault retention on exact9a6516bba. Jedi12013/thread01a1a257-7579-7623-93bf-4a4161566e5f repairs REP first-store interruption on exact20a45ddfe (correction to prior status); candidate remains unlanded and no campaign admitted. TWO workers, distinct prospective gameplay lanes. Alice ground/knife, Jedi live binding/damage, broader GL visual parity and historical27 remain open; CACA003B hold unchanged.
  Current update 2026-11-03T12:00Z — THREE workers: fresh Alice native CLI69774 (original geometry/script-informed wind-to-knife route), GL92075 finishing full context-copy closeout, Jedi29720 closing observed-sector route. Alice a136f1768 reviewed316local6061archive17inherited fullSHA/published/normal STOPPED; final gnome dialogue capture personally reviewed, weapon/attack still unverified and no authentic save retained. GL published8028df6ba with reported full native/delayed Worker/WebGL1+2 copy coverage; final closeout/review pending, existing cyan/green shared-texture failure preserved for prepared fresh successor. Jedi reports reaching lower route then incoming damage/player death before positive armed-hostile identification; no shot/hostile-defeat qualification. Historical27 and broader crash scope remain open. Review: scratch/runs/20261103-coordinator-alice-attack-review/review.json.
  Current update 2026-11-03T11:38Z — THREE live workers: Alice27972 closeout, GL92075 full context-copy implementation, Jedi29720/thread01a1a130-9fe3-7f91-8fb0-2120bcb8b9da read-only observed-sector route. Prior Jedi CLI e4f498fba reviewed556local192archive fullSHA/publishedpath/normal STOPPED; ledge/slope navigation limit, no hostile/shot or proven emulator fault. Fresh Jedi owns bx_62924zgv expiry13:35:19.218Z, native CLI independent of Chrome. Root confirmed Alice browser exit0 at11:26:13.646774Z and no browser helpers; GL ACKed11:34:22 handoff and reports native1416/actualWorker1419 plus real WebGL1+2 direct/Worker PASS, now enabling/testing public route. Alice retains boat/file closeout ownership. Evidence: scratch/runs/20261103-coordinator-jedi-cli-review/review.json and scratch/runs/20261103-coordinator-alice-browser-handoff/receipt.json. Full GL copy/historical27 and hostile gameplay remain open.
  Current update 2026-11-03T11:00Z — Device7 Load5a834874f reviewed baselineFAIL/repairedPASS with locked build and8focused PASS. Jedi bf1493217 visible collapse remains likely civilian, hostility unverified. Static hostile-route0b6dd16d2 reviewed130 local/40 archive fullSHA and own normal STOPPED; no guest consumed. THREE workers: Alice27972 ONE1800s browser opening/knife/attack started10:56:03; GL92075 full context-copy transaction, Chrome waits for Alice release; fresh Jedi97671 thread01a1a112-a258-7451-8dea-572a65d5e3e6 executes planned hostile route using native CLI on its own boat NOW. Previous coordinator runtime gate was too broad: separate CLI execution requires no Alice/GL release. Full copy and historical27 remain open.
  Current update 2026-11-03T10:30Z — GL copy-context preparation worker38354 stopped at its required Jedi/Alice release gates; root verified all9 scratch manifest files and10 inherited inputs (20261103-coordinator-gl-complete-review). No production change, build, runtime, boat or commit occurred; complete transaction remains unsupported. Replaced it with fresh D3DIM28490/thread01a1a0f5-254c-7430-9623-2bb5695bcddd repairing the reproduced Device7::Load invalid-surface success defect on independent source/test paths with native tests on a separate boat. THREE assignments: Jedi20187 first visible combat, Alice27972 ordinary weapon acquisition/visible attack, D3DIM28490 validation repair. Browser order remains Jedi → Alice. Published native hint prerequisite c35d96ebd and its reviewed evidence remain accepted; full copy, target damage and historical27 remain open.
  Current update 2026-11-03T10:05Z — Alice23482 terminal0 published bf2908314: ordinary New Game/Easy reached HUD17080, separate W movement17580 and horizontal ArrowRight turn17800 visibly verified; two primary-button trials have no verified attack effect or established cause. Root personally reviewed four captures, verified137 local/6200 archived fullSHA members plus self-manifest, main/origin ancestry and completed normal STOPPED snapshots (review20261103-coordinator-alice-controls-review). Fresh Alice27972/thread01a1a0dd-c6ae-7ae3-b5d9-ca99884a3931 prepares ordinary weapon acquisition and visible attack. THREE live handles confirmed; production order GL68555 full copy-context transaction → Jedi20187 first combat → fresh Alice; browser runs serialized. GL same own finite boat bx_pfhp9zcc original expiry11:31:01.245, disk margin restored by259489808B hash-verified released duplicates (recovery20261103-reviewed-icewind-duplicate-margin). Historical27/full copy and target-damage gameplay remain open.
  Current update 2026-11-03T09:09Z — Jedi continuation12339 terminal0 published dc1fe1906: ordinary Player/Medium/Single Player/New Game reached first-person courtyard; root personally reviewed forward displacement, horizontal turn, pistol recoil and ammo100→99. Impact/target damage/audio/vertical look remain unverified. Root407 local+113 retrieved fullSHA/archive/ancestry/completed normal STOPPED snapshot verified (review20261103-coordinator-jedi-gameplay-review); finite629.224s harness termination is not ordinary guest exit. Alice23482 now owns bx_7vanbwq9 ordinary browser opening-to-controls; GL68555 follows Alice. Fresh Jedi20187/thread01a1a0aa-0ec3-71d0-a8e2-3ec288e5ab62 prepares first visible combat encounter until exact Alice THEN GL releases. THREE workers/two distinct game lanes; historical27/full wglCopyContext remain open.
  Current update 2026-11-03T08:58Z — Jedi93437 exited1 selected-model capacity at ordinary Single Player screen, no final; no new gameplay claim. Fresh12339/thread01a1a0a1-02e0-7bc0-a30c-b96c2cd7778a adopts ONLY existing bx_6g6ecnj4/session (original expiry09:28:27.753), bounded continuation/evidence/recovery/normal stop, no repeat run. Alice23482 gate transferred to exact jedi-loading-capacity-continuation-nov03 AUTHOR RELEASE; GL68555 follows continuation THEN Alice. THREE workers/two game lanes retained. Root capacity review20261103-coordinator-jedi-loading-capacity-review; prior GL69acd0c84 independently reviewed, full copy still pending.
  Current update 2026-11-03T08:53Z — GL polygon/color-material69acd0c84 published: native57 + delayed Worker57 cases/2 immutable leases/zero fallback, direct and Worker WebGL1+2 228 cases,22 focused passing invocations and locked build. Root verified234 artifact hashes/archive/ancestry/normal STOPPED snapshot and viewed line/fill PNGs (review20261103-coordinator-gl-period-review). wglCopyContext remains unsupported; unchanged faithful NICEST and shared-texture cyan/green failures retained. Fresh GL68555 implements complete mask transaction after exact Jedi93437 THEN Alice23482 releases; scratch prep meanwhile. Jedi now owns separate finite boat bx_6g6ecnj4 for ordinary loading-to-gameplay run; Alice longer ordinary opening-to-controls run next. THREE workers/two game lanes; gameplay effects and historical27 still open.
  Current update 2026-11-03T08:34Z — Alice8031 terminal0/published e29de578e admission repair +17ea1557f findings: actual-host/native-PE old-fail/new-pass, focused tests and locked build pass; unrelated existing Worker nestedCOM assertion reproduced on released module and retained. Root verified760 local hashes/all600 archived evidence files, ancestry and completed normal STOPPED snapshot; personally reviewed ordinary menu/Easy/loading/opening dialogue (review20261103-coordinator-alice-admission-review). Actual16080 reached Alice/Cat dialogue within1200s; movement/look/attack effects remain unverified. Fresh23482 gets ONE longer ordinary1800s playthrough, scratch prep until exact GL96496 THEN Jedi93437 releases. THREE live assignments/two game lanes; source/build/runtime serialized, boat-side staging near2GB disk floor. GL polygon/color-material implementation active; wglCopyContext unsupported, historical27 and existing shared-texture WebGL failure remain open.
  Current update 2026-11-03T07:56Z — Jedi47506 terminal0/publisheda193f9a55: general cross-OS-process window discovery/lifetime/posting/focus repair; actual-process old-fail/new-pass,11 focused regressions and locked build pass. Original Play now retires the duplicate engine through its own FindWindow branch and reaches Player/Medium → Single Player → New Game → Fuel Station Launch Loading. Root reviewed final loading PNG (not gameplay),276 artifact hashes/86 retrieved stored+original hashes/archive/ancestry/normal STOPPED snapshot (review20261103-coordinator-jedi-desktop-review). Fresh93437 gets one ordinary600s loading/gameplay attempt after active Alice8031 browser admission repair THEN GL96496 polygon/color-material implementation. THREE assignments/two game lanes. GL c4bc527b0 missing-state findings remain prerequisite; wglCopyContext unsupported, existing WebGL shared-texture cyan-vs-green failure retained, historical27/gameplay goals open.
  Current update 2026-11-03T07:16Z — Alice25283 terminal0/published170272978 findings only: original browser stalled before menu at actualstep1649/mainSlice1093, main awaits callback gate held by runnable unfinished attach owner2. Root verified489 manifest members fullSHA, 92MB archive/ancestry/completed STOPPED and personally viewed gray blocked capture (review20261103-coordinator-alice-browser-review); no browser gameplay/fire claim. Fresh8031 owns faithful browser admission regression/general owner-advance repair then ordinary gameplay continuation. Jedi3055 ended model-at-capacity with scratch prep only; fresh47506 continues cross-process desktop visibility. THREE current assignments GL5139 mask-selected copy (own finite boat/runtime) THEN Jedi47506 THEN Alice8031; game successors prepare scratch-only until exact releases. Historical27 remains open.
  Current update 2026-11-03T06:58Z — Jedi10321 terminal0/published7ad347a35: general WinExec waits for GetMessage/finite timeout; both original launch calls preserved. Root verified215 manifest members and64 retrieved members fullSHA/archive/ancestry, old-fail/new-pass +10 focused tests/locked build, completed STOPPED receipt and personally viewed original New Player screen. Movie completion accepted, gameplay unverified. Next measured cause: CLI cross-process FindWindow cannot see existing wKernel/Jedi Knight window. Review20261103-coordinator-jedi-readiness-review. THREE assignments Alice25283 browser gameplay (own boat active) THEN GL5139 mask-selected copy THEN fresh Jedi3055 desktop/window visibility and ordinary profile continuation; successors prepare scratch-only while gated. Two game lanes preserved; historical27 open.
  Current update 2026-11-03T06:43Z — GL5777 terminal0/publisheda08985c2b: completed server values and ordered source prefix now publish under the process GL lock. Root verified81 manifest members plus archive82/fullSHA, source/fixture diff, native/actual Worker/WebGL1+2 pass logs, locked build and completed STOPPED receipt (review20261103-coordinator-gl-publication-repair-review). wglCopyContext remains unsupported; no historical27/gameplay claim. THREE workers Jedi10321 startup readiness now owns runtime THEN Alice25283 browser gameplay THEN fresh GL5139/thread01a1a024-8ca0-7d13-a557-1ede7bcc863a mask-selected copy implementation, scratch preparation while gated. Two game lanes remain Jedi/Alice.
  Current update 2026-11-03T06:18Z — Alice59892 terminal0/published648b877e5; root207 manifest members fullSHA MATCH, archive/ancestry and completed STOPPED boat receipt verified; movement and look captures personally reviewed. Ordinary native New Game/Easy and player-controlled gameplay accepted; browser/GPU, audio/FPS and effective fire unverified. Review20261103-coordinator-alice-gameplay-review. THREE workers GL5777 producer publication repair THEN Jedi10321 startup readiness THEN fresh Alice25283/thread01a1a00c-5e47-7380-bcf6-ca3478dbeb42 browser gameplay/fire-effect lane; successors prepare while runtime gates are pending. Historical27 remains open.
  Current update 2026-11-03T05:59Z — Jedi52541 terminal0/published47b47bc6b; root160 manifest members fullSHA MATCH, archive/ancestry/locked build and focused regressions verified; ordinary Play now starts unchanged engine and renders intro movie (capture personally reviewed). Two original WinExec calls create two engines; readiness/movie EOF unresolved, no player-control or gameplay claim. Own boat stopped/completed/error:null with retained snapshot. Review20261103-coordinator-jedi-launch-path-review. THREE fresh/current assignments Alice59892 native activation THEN GL5777 producer publication repair THEN Jedi10321 startup-readiness investigation; new Jedi thread01a19ffa-d33a-7ee3-933a-520dbc9349ca. Alice/Jedi remain prospective game lanes; historical27 open.
  Current update 2026-11-03T05:46Z — GL17052 ended after static preparation because ordered Jedi/Alice releases were pending; no source edits, build/runtime, boat or commit. Root verified all5 static evidence members (review20261103-coordinator-gl-publication-review); prerequisite repair remains incomplete and wglCopyContext unsupported. Fresh worker5777 gl-publication-fixture-repair-nov03 prepares the expected-success regression fixture, then explicitly waits for Jedi52541 THEN Alice59892 exact releases before implementation/runtime. THREE assigned workers; two prospective game lanes remain Jedi/Alice; no gameplay or historical27 change.
  Current update 2026-11-03T05:44Z — GL3658 terminal0/published 0e449fb1c; root113 manifest members fullSHA MATCH and publication ancestry verified (review20261103-coordinator-gl-copy-review). Two native producers reproduce stale shared color/line-width snapshots and pending source commands until source publication; wglCopyContext stays unsupported. Locked build and focused baseline sharing/actual Worker regressions PASS; no WebGL copy acceptance, gameplay or historical27 qualification. Fresh GL17052 owns the bounded producer-state publication prerequisite, static first. THREE assignments now Jedi52541 faithful launch-path repair THEN Alice59892 single-trace native activation THEN GL17052; Alice/Jedi remain the two prospective game lanes.
  Current update 2026-11-03T05:34Z — Alice82263 terminal0/published f21b9fc2b; root113 manifest members fullSHA MATCH, solid-teal capture reviewed, exact boat stopped/completed/error:null receipt verified (review20261103-coordinator-alice-key-review). Two trace addresses forced one-block batches: no menu, key dispatch or gameplay was reached; no engine fault established. Fresh Alice59892 has verified single trace429c10 preserves100000-block startup and all15 original hashes; runtime follows GL3658 THEN Jedi52541. All THREE process handles live; Alice/Jedi remain the two prospective game lanes, historical27 remains open.
  Current update 2026-11-03T05:23Z — Jedi92624 terminal0/published cab910b9e; root31 retrieved artifact/4156 current source SHA MATCH and original Unable-to-start capture reviewed. Genuine DSOUND.VXD/DDHELP provisioning passes original prerequisite predicate; ordinary Play now reaches unquoted WinExec long-path failure (C:\Program.exe missing), no child/engine/gameplay. All28 originals/76-key registry unchanged. Stop accepted error:null/helpers absent/info404/preview410, but metadata removal prevents literal terminal STOPPED receipt; verification gap retained. Review20261103-coordinator-jedi-play-review. THREE live assignments Alice82263 native menu-key activation (own finite boat/runtime) THEN GL3658 wglCopyContext THEN fresh Jedi52541 faithful Win98 launch-path provenance (static preparation). Two prospective game titles remain Alice/Jedi; historical27 and gameplay qualification remain open.
  Current update 2026-11-03T05:12Z — GL64819 terminal0/published c1f211fdc: full16 stored-width logic operations accepted after root450 artifact/4108 source hash verification, native/actualWebGL1+2/Workers and lockedbuild PASS; 51 mandatory names remain. Review20261103-coordinator-gl-logic-review; boat STOPPED. THREE assignments Jedi92624 originalPlay THEN Alice82263 nativekey activation THEN fresh GL3658 wglCopyContext (static preparation now). Alice/Jedi remain prospective game lanes; no new gameplay or historical27 qualification.
  Current update 2026-11-03T03:57:08.970209+00:00 — Alice35407 terminal0/published31516fa78, root181 artifactSHA MATCH and fullypainted main menu PNG reviewed; real cooperative gate regression old-fail/new-pass0.204s plus fault/ordinary/lifecycle and full lockedbuild PASS. New Game/gameplay not reached, boat STOPPED. Jedi98237 static provisioning terminal0/publishedf3a549c15, root41 hashes MATCH; genuine two-file recovery/VFS checks accepted, no guest/boat. THREE fresh/current assignments GL64819 THEN Jedi92624/thread01a19f8c-eeb8-7170-ba3f-9b5425ce347f THEN Alice82263/thread01a19f8c-2f2c-7290-9077-632d300301b6. Two prospective titles remain Alice and Jedi; no fourth worker.
  Current update 2026-11-03T03:38:17.517026+00:00 — Jedi89418 terminal0/publishedc5b6e44b7, root113 manifest hashes MATCH and original warning PNG reviewed: missing genuine DSOUND.VXD; DDHELP.EXE not reached, no gameplay. Boat STOPPED before expiry. Fresh98237/thread01a19f7b-d912-7151-95da-eeea318ae421 establishes authentic DirectX provisioning; static now. THREE assignments Alice35407 THEN GL64819 THEN Jedi98237 source/heavy order. Alice and Jedi prerequisites retain two prospective title lanes.
  Current update 2026-11-03T03:32:16.695575+00:00 — Shadow38979 terminal0 publisheddebc24bfc; root161 artifact hashes MATCH, real50B defaults saved/reopened and enabledPlay original menu-to-gameplay/Up+Right movement captures reviewed. CLI short demonstration accepted; browser/audio/FPS/save-load/normal exit and corpus registration remain unqualified. Boat STOPPED/errornull/helpers absent. Fresh GL64819/thread01a19f76-5bc3-7b72-b8e6-a4eec3ad63f9 launched full16 logic semantics; static until Jedi89418 THEN Alice35407 actual terminals/exact releases. Jedi runtime gate opened03:31UTC within original03:35UTC expiry; Alice is second prospective title lane.
  Current update 2026-11-03T03:20:10.226704+00:00 — Jedi36383 terminal1/model capacity before guest, no final; reviewed once/deduplicated. Fresh Jedi89418/thread01a19f67-24f1-7011-9b1d-00c0fd831a46 reclaims verified28-original installed tree and static predicate evidence on bx_bkn8mbm5 with unchanged03:35UTC expiry/shutdown delegation. THREE actual live handles Shadow38979 THEN Jedi89418 THEN Alice35407; Alice static real cooperative DLL-owner fixture preparation. Shadow snapshot transfer interrupted by actual disk-floor violation, no guest consumed; lossless reviewed-transcript recovery restored free2.100GB and pending-only continuation queued. GL full16 native/WebGL logic-operation task prepared for next available slot, not dispatched; historical27 still open.
  Current update 2026-11-03T03:11:12.567668+00:00 — GL76045 terminal0 published bd1a15a25; root101 retrieved artifacts/4129 source seals all SHA MATCH; native actualWorker1366 zeroFallback, WebGL1/2/browserWorker/mutations/focused and final lockedbuild PASS. Two encoder context/hardening failures reproduce baseline; glLogicOp remains unsupported, historical27 still open. Ownboat STOPPED/errornull/helpers absent. Fresh Alice35407/thread01a19f63-267f-7e22-a0b0-9d8ec0c4aa45 targets real cooperative DLL gate scheduling repair and original startup after regression; static-only now. THREE assignments Shadow38979, Jedi36383, Alice35407; heavy/source order Shadow THEN Jedi THEN Alice. Canonical module24880b0e/source-seal3051e43d handed to both games.
  Current update 2026-11-03T02:48:32.088226+00:00 — Shadow23131 exited1 from model-service capacity before any boat/runtime, no final; reviewed transcript and actual terminal. Fresh Shadow38979/thread01a19f4e-8119-73a2-99d5-60f09bf0fcd4 reclaims prepared original payload/harness. THREE live GL76045, Shadow38979, Jedi36383; heavy GL THEN fresh Shadow THEN Jedi. Jedi original restored28 files/fullSHA match; four-file DirectX predicate includes DSOUND.VXD/DDHELP.EXE absent from installed tree; current runtime trace pending.
  Current update 2026-11-03T02:32:43.670587+00:00 — Queue35888 terminal0 published2a57101e2 reviewed123 hashes, old lookup fail/new interpreter and final locked build pass; boat stopped, Zuma initializer0x989000 still fails/no gameplay. THREE live assignments: GL76045, Shadow23131, fresh Jedi36383/thread01a19f3f-b3c3-7083-b0c2-bc602a5e3710. Heavy GL THEN Shadow THEN Jedi, static preparation permitted. Shadow Man and Jedi are the two prospective new-title lanes.
  Current update 2026-11-03T02:12:16.019823+00:00 — Alice40130 terminal0: published1284082a0, root74 SHA matches/gray screenshot reviewed; measured main FreeLibrary waits on gate held by unscheduled cooperative DLL attach, no engine repair/gameplay. Handed bx_4rk22xvp verified STOPPED/errornull. Fresh Shadow Man23131/thread01a19f2d-1298-7a61-ae2f-ad6df033384f prepares accepted installed launcher Configuration OK/persistence then ordinary enabled Spielen and gameplay if reachable. Source/heavy Queue35888 THEN GL76045 THEN Shadow23131; static preparation now. Shadow Man active; coordinator-owned Jedi Knight recovery is the second eligible new-title lane, exact original package fullSHA reverified02:18:34Z, fresh worker next free slot. No fourth worker.
  Current update 2026-11-03T02:05:29.107101+00:00 — Queue73929 terminal0 reviewed13 final byte/SHA MATCH; static test preparation only, no production/runtime/build/commit/boat. Fresh recovery35888/thread01a19f27-3576-7fe0-9cee-bd2fb44ea8af carries actual QueueUserAPC export repair. Corrected source/heavy order Alice40130 THEN Queue35888 THEN GL76045; GL notification queued, not ACK. No gameplay/new-title claim.
  Current update 2026-11-03T02:02:22.359774+00:00 — GL76327 actual terminal1 model-capacity error; final/RECOVERY absent,13 scratch artifacts preserved and16 observed source hashes unchanged. No implementation/native execution/build/commit/boat. Reconstructed scratch-only handoff retained in20261103-coordinator-gl-interruption/review.json. Fresh recovery76045/thread01a19f24-462e-75f3-890a-12d2d9aa3a20 implements exact-color prerequisite. Source/heavy Alice40130 THEN QueueUserAPC73929 THEN GL76045; Queue dependency correction queued, not acknowledged yet. No GL availability/gameplay/new-title claim.
  Current update 2026-11-03T02:00:36.967500+00:00 — Export recovery38749 terminal0 reviewed60 final byte/SHA MATCH;8020361e3 HEAD=origin/main, actual old PE lookup FAIL/new interpreter ABI and QUARTZ/final locked build PASS. Zuma single startup now missing QueueUserAPC then initializer0x989000 failure; reviewed desktop ReadMe, no gameplay/rootcause. Coordinator stopped handed boat bx_p8gumtz4 after evidence verification; STOPPED/errornull. Fresh QueueUserAPC worker73929/thread01a19f22-a57d-77f3-b3dd-fd775ca7ef32 prepares static now; source/heavy Alice40130 THEN GL76327 THEN QueueUserAPC73929 exact releases. Lords178 files missing; two eligible new-title lanes remain unestablished.
  Current update 2026-11-03T01:46:29.127244+00:00 — Export6995 actual terminal1 model-capacity error; final absent, static-only manifest/ordinal/syntax checks; uncommitted3source/test edits preserved. Reconstructed exact-claim transfer to fresh38749/thread01a19f15-d1b5-7b73-85b8-36244da5724e kernel32-deviceiocontrol-export-recover-nov03. Alice40130 and GL76327 notified: source/heavy gate waits for RECOVERY terminal/exact release THEN Alice THEN GL. No runtime/fullbuild/commit/gameplay acceptance; two eligible new-title lanes remain unestablished.
  Current update 2026-11-03T01:36:44.896192+00:00 — Reviewed GL2498 142, second95953 4, Zuma72711 50 final hashes MATCH. Zuma docs74c6d01bd published: actual missing DeviceIoControl then initializer failure; no gameplay, ownboat stopped after evidence retrieval. Lords99901 six and Icewind23351 seven final hashes MATCH; Lords stopped before locating payload, Icewind cabinet already hardlinked so zero saving. Fresh Lords retained-payload locate26838/thread01a19f0c-cd43-7d20-8ba9-fc09626cdab1 performs targeted read-only file recovery; fresh released-GL-text76034/thread01a19f0c-d09a-71c1-b3fe-6a1e6c8eed1b attempts different bounded lossless evidence compression; Zuma56312/thread01a19f0a-16a2-7f52-bde5-4e697b554bca diagnoses real export semantics after Lords terminal/release. Root six decoded log hashes MATCH/2756608 physical bytes recovered, still below2GB; no durable headroom claim. Only Lords is a prospective new title; second eligible new title remains unestablished. No new gameplay or glLogicOp availability.
  Current update 2026-11-03T01:15:45.446494+00:00 — FreeSpace72847 terminal0 reviewed20 final hashes MATCH/exact release/helpers reaped; authentic Win98 ordering/failure semantics still unproven, sixops untouched/no code/build/boat/startup and already-public title does not count. Fresh second-local-gameplay95953/thread01a19ef9-9f20-7840-800e-c9dd3884b796 selects distinct locally actionable non-public candidate excluding Zuma/first worker claim. Current heavy order GL2498 THEN gameplay72711 THEN gameplay95953. Both candidate eligibility checks pending; no new gameplay acceptance.
  Current update 2026-11-03T01:14:28.562458+00:00 — Oni8089 terminal0 reviewed19 final hashes MATCH/exact scratch release/helpers absent; disk parent1967534080B/child1990582272B stopped preparation, no source/build/tests/boat/original. Fresh local-ready-gameplay72711/thread01a19ef8-63b8-7491-ac3a-ad1f99039471 selects Zuma only if currently non-public/actionable, otherwise one local unqualified title. Candidate eligibility and two-new-title coverage remain unproven until checked. Source/heavy order GL2498 THEN FreeSpace72847 THEN gameplay72711; FreeSpace dependency correction queued. glClearIndex remains unsupported/backlog.
  Current update 2026-11-03T01:10:25.229531+00:00 — Brave66123 terminal0 reviewed113 final hashes MATCH, docs1671b5c5c published; parent1999269888/child1985236992 floor breach stopped runner-15 and SSH403;zero transfer/build/initializer controls/browser/original, actual DLL cause unresolved. Ownboat STOPPED after SHA metadata/helpers absent. Fresh FreeSpace72847 researches authentic Win98 pending-boot contract then first actual startup after GL2498 THEN Oni8089 releases; replaces blocked Brave lane, no guessed boot semantics. Three workers remain; no gameplay acceptance.
  Current update 2026-11-03T00:57:48.203233+00:00 — Oni68301 terminal0 reviewed478 final byte/SHA MATCH,024c732b0 published; genuine glColor4d/glPrioritizeTextures native ABI,queued software12 zeroFallback,WebGL1/2,13 semantic mutations,22 regressions,locked build PASS. Existing context7vs8/uniform55vs53 FAIL retained;50/345 static mandatory gaps;no original replay/gameplay. Ownboat STOPPED after212 retrieved SHA evidence/helpers absent. Fresh Oni8089/thread01a19ee9-2017-7692-a0bd-d49fe2888b2c prepares genuine glClearIndex contract after Brave66123 THEN GL2498 terminal/release. Three live lanes preserved. Coordinator independently verified24 losslessly compressed released terminal logs,12582912 physical bytes recovered; capacity only, stability unproven.
  Current update 2026-11-03T00:30:44.823863+00:00 — GL63829 terminal0 reviewed587 final byte/SHA MATCH, published94d26f406 originmain ancestor. RGB555 stored precision/queue metadata/exact-width accumulation PASS locked build, WebGL1/2/actual browser Worker,12 intended mutations. Native queued18 zeroFallback measures irreversible f32 integer-color collisions; full16 glLogicOp unavailable. Ownboat STOPPED/errornull/helpers absent;305 retrieval SHA before stop; failed phases/baseline window TypeError retained, no gameplay or whole-run floor claim. Fresh GL2498/thread01a19ed0-6efe-73e2-b378-72047d8b6471 preserves exact integer source through state/arrays/lists/transport after Oni68301 THEN Brave66123. Owner148 delivered1793: no current owner decision/upload needed.
  Current update 2026-11-03T00:05:40.154928+00:00 — Oni86567 terminal1 from model-capacity error during dependency waiting; no final/source/heavy/boat or gameplay result. Monitor1944350 and scoped helpers absent; reconstructed scratch-only release. Fresh Oni68301/thread01a19eb9-624b-73c1-9d81-7337a9c9fc72 continues genuine glColor4d/glPrioritizeTextures from prior design after GL63829. Brave66123 dependency correction queued to wait fresh Oni recovery; no nonexistent predecessor-final wait. Three worker handles GL63829/Oni68301/Brave66123 remain assigned.
  Current update 2026-11-02T23:35:40.367443+00:00 — Brave99754 terminal0 reviewed73 final hashes MATCH/docsdb7c37da4 remote ancestor/ownboat STOPPED/helpers absent. Transfer guard min1991254016B killed own transfer exit-15; no compiled controls/build/browser/original, initializer identity/cause UNRESOLVED. Existing worker logger/error forwarding loses available identity/outcome; prepared hooks UNVALIDATED. Coordinator lossless recovery51 released files independently decoded SHA/bytes verified saved18948096B; free~2.06GB, stability unproven. Fresh Brave66123 continues real compiled diagnostic controls then one changed-diagnostic original only after GL63829 THEN Oni86567 release. No gameplay acceptance.
  Current update 2026-11-02T23:25:19.810270+00:00 — Oni81836 terminal0 reviewed197 final hashes MATCH; genuine residency3785da2fa published/remote ancestor. Native/direct and actualqueued27queries+8literal cases zeroFallback, WebGL1/2 sixteen pixels, old export failure+7mutations/focused/lockedbuild PASS. Existing fixed-function uniform55vs53 failure retained. Ownboat bx_n9c9g3rs STOPPED/errornull/helpers absent; guarded heavy minimum2051690496B, no whole-turn coverage claim. Static52/345 mandatory gaps; no gameplay/replay. Fresh Oni86567/thread01a19e94-9594-7802-9b63-2bdb8cde6bc9 implements genuine glColor4d/glPrioritizeTextures after Brave THEN GL.
  Current update 2026-11-02T23:15:49.058115+00:00 — GL42283 terminal0 reviewed208 final hashes MATCH; repair306ccf2fd/auditc8e67ed38 originmain ancestors. WebGL1/2 literal20 cases,5 intended mutations,native/direct and actualqueued-software10GL zeroFallback, focused/lockedbuild PASS; queuedWebGL untested and glLogicOp unsupported. Boat bx_cfhb4jrh STOPPED/helpers absent. Phase1 diskbreach1996500992 stopped own test; phase2 watcher terminal record missing, continuous coverage UNVERIFIED. Same-task fail-closed monitor clarification sent Oni/Brave. Fresh GL63829/thread01a19e8b-c5f8-7570-a608-d6a0b291f372 addresses stored-width ordering/full16 semantics after Oni81836 THEN Brave99754. No gameplay or historical27 claim; held tasks unchanged.
  Current update 2026-11-02T11:36:04.443989+00:00 — Accepted GTA documentation e3aa732de: full fresh-process checkpoint parity, observer controls, focused tests and locked build PASS; stack valid through child16342016, leaving3971697 dispatches before known invalid state20313713. First invalidating transfer unlocated; no CPU repair or gameplay claim. Coordinator verified98 remote evidence hashes,14 handoff hashes, packed/decoded checkpoint and published document; helpers absent, boat STOPPED. Accepted 1D451708e35 retains79 mandatory MDK2 misses; no original MDK2 replay. Superseding update: texture-copy a8b85a569 accepted;72 mandatory MDK2 misses remain.
  worker: THREE: gl-full-logic-operations-nov03 (64819/thread01a19f76-5bc3-7b72-b8e6-a4eec3ad63f9), jedi-provisioned-original-play-nov03 (92624/thread01a19f8c-eeb8-7170-ba3f-9b5425ce347f), alice-menu-native-key-activation-nov03 (82263/thread01a19f8c-2f2c-7290-9077-632d300301b6). Source/heavy/boat order GL THEN Jedi THEN Alice; waiting workers prepare static. Own finite-TTL boats, localfree>2GB, no simultaneous browsers. Alice and Jedi are prospective new-title lanes.
  Current update 2026-11-02T01:56:37.888697+00:00: Released DungeonSiege/SimGolf recovery completed0bytes/no edits;4486 files preserved. Explicit immutable handoff release absent for DungeonSiege, SimGolf no useful duplicates; both scopes exhausted. Battlezone remains below2.4GB prerequisite, no retry. GTA static analysis finds28 distinct page faults and forward instruction/memory progress, not an established polling stall; awaits release to publish findings. Prior GTA6de repair tests/fullbuild PASS and DOS-text-only capture remain applicable.
  worker: THREE: MDK2 drawable01a199dc-e66f-7a72-b24a-683202089b55 handle6904 owns serialized runtime; GTA startup01a199ea-4c69-74f2-aec4-cddf34714274 handle88091 static then SECOND; fresh MDK2 accumulation01a199f8-c310-7461-b922-0778d39920e4 handle22123 primary-spec research only then THIRD after both exact releases/helper cleanup. Accumulation depends on resolving six actual drawable failures; genuine semantics and tests required before availability. No original MDK2 while remaining mandatory exports unsupported. D3D automatic rejection remains stopped. No new gameplay.
  Current update 2026-11-02T00:46:41.497182+00:00: Reviewed published MDK2 e742c18b3 once, remote MATCH, all10 source pins unchanged and all68 reported PIDs independently absent. Twenty real integer colors normalize signed/unsigned values through native float-color path with alpha/current queries/display-list snapshots/software pixels and resolved ABI tests. Corrected savedold lookup FAIL/new PASS; fourteen regressions/freshness/locked full build PASS. 188 mandatory exports remain unsupported; no original replay/startup/gameplay claim. GTA eb21 prerequisites remain accepted; full task switch now in progress.
  worker: GTA commit-aware task switch 01a199ad-a72d-70a0-8e74-942c9ef1223b handle29542 owns serialized source/build/runtime for coherent taskgate/commit/fault attribution and reverse NT IRET before at most one changed-source original. Fresh MDK2 accumulationbuffer 01a199b8-bdb2-70d3-91eb-ff80209029be handle68508 STATIC primary research until GTA terminal/result/final/exact AUTHOR RELEASE/helper cleanup; implement coherent glAccum/glClearAccum/accumclear across supported routes with real pixels and lifecycle checks. cap2 fallback10min or completion/input.
  Current update 2026-11-01T23:38:58.822339+00:00: Reviewed published995c90daf: optional Trident SR0B old/new selection and independent SR0D storage repaired; old-fail/new-pass, default VGA negatives, bank persistence, both bundles and locked build PASS. Ten helper PIDs independently absent. No original retry or gameplay. Fresh worker addresses documented old-mode SR0E bank/window semantics after GTA releases shared runtime; identity/capacity/mode-pixel gaps still prevent supported-adapter claims.
  Current update 2026-11-01T23:26:12.484312+00:00: GTA52165cda8 published reviewed successive menu input -> RunGTA -> K.EXE exit0/host0 natural26.71s; startup/final PNGs show no gameplay. All117 fixture files and230 source pins unchanged, all4helpers independently absent. Original GTA.BAT calls generated DINO.BAT after K.EXE; fresh worker inspects exact overlay/EXEC then supports faithful batch handoff without default executable bypass. Constructor currently owns source/build/runtime; GTA waits for exact release before edits/tests/original.
  Current update 2026-11-01T23:21:40.039837+00:00: Published37791d8f1 successive checkpoints and held-open stdin natural exit fix reviewed with focused tests/bundles/locked build PASS. Constructor cf7ba641a actual default original rejects unsupported VGA (reviewed PNG); UVCONFIG1/parent1 hostwait0, no gameplay. All26 helpers independently absent and commits remote ancestors. Fresh GTA uses capture-before-each-input toward gameplay; Constructor repairs bounded real Trident old/new register contract, no false InteGraphics acceptance or unchanged original retry. TEST.WAV authentic present; audio untested.
  Current update 2026-11-01T23:09:11.847919+00:00: Combined code a416f0142 published with mandatory lockedbuild, GC/checkpoint/keyboard/DAC/retrace/bundleparity PASS. GTA note2f9a26905 and paired captures reviewed: one Enter reaches English PressAnyKey only; guest budgetspent exitedfalse, host stdin remains alive until90s SIGTERM actualwait-15. All16 helpers independentlyABSENT; both commits ancestors. Fresh runner task fixes answeredstdin exit and supports successive bounded live input; Constructor then tests default original against changed GC without fabricated hardware/config. No gameplay/full27 claim.
  Current update 2026-11-01T22:55:43.655838+00:00: GTA focused checkpoint/keyboard tests PASS; Constructor remaining DAC/retrace/both bundle74GC+COM PASS. Required build fails solely on generated bundles embedding changed runner; both owners preserved code and released all paths. Reviewed doc-only8d0120ad7/1f2f1bc13 once remote ancestors and all17 helper PIDs absent. Fresh implementation worker now owns all six source/test/bundle paths, authorized regenerate coherent bundles, fix/build/test/commit together; next GTA bounded original waits for publication. No gameplay/full27 claim.
  Current update 2026-11-01T22:44:07.253850+00:00: Forsaken25 gzip-to-xz archives reclaimed222334976B with decoded hashes and1085 protected file pins preserved; scope exhausted. Actual free space2.34GB. GTA doc-only f2fd12a5f retains runner/test WIP: real one-shot Enter checks passed before invalid exactdispatch assertion; capture surface bug also needs repair. Both terminal0 author RELEASE all28 PIDs independently absent. Fresh GTA fixes and completes meaningful tests/build before publication; Constructor then completes remaining focused tests/build on preserved four WIP files. No original gameplay or full27 completion claimed.
  Current update 2026-11-01T22:30:28.718258+00:00: Rune60 immutable hardlinks recovered91246592B with all pins preserved; scope exhausted. Constructor dependency-only worker stopped at2.126GB<2.15GB with four WIP hashes unchanged, no build retry. Both terminal0 author RELEASE helper77715 independentlyabsent. GTA generic input source implementation/small tests starts under unchanged2GB floor, mandatory build waits>=2.15GB. Fresh released gzip-text to xz recompression verifies decoded hashes and restoration recipes; different recovery method, no unchanged raw-log census. No new gameplay or full27 claim.
  Current update 2026-11-01T22:26:48.206014+00:00: Reviewed released Forsaken0B and Constructor8b20f142 once, both terminal0 author RELEASE all11 helpers independently absent. Constructor178 focused PASS, mandatory build DISKABORT, four source/test/generated bundle WIP paths preserved uncommitted. Fresh Rune exact hash duplicate recovery changes prerequisite; no unchanged low-headroom build or GTA retry. Remaining DAC/retrace/bundle checks and required build before codecommit. No new gameplay or full27 claim.
  Current update 2026-11-01T22:12:05.518069+00:00: Reviewed526a7ce355 full note once: GTA STATIC guard1990922240B below2GB, no implementation/tests/original; terminal0 author RELEASE two reported PIDs absent remote ancestryPASS. Prior23.4MB recovery did not sustain headroom. Replace unchanged GTA retry with bounded specific released330MB evidence-directory lossless recovery; no broad census or foreign cleanup. Constructor focused regression ongoing; no new gameplay or full27 claim.
  Current update 2026-11-01T22:09:21.233766+00:00: Reviewed19ce5388a/c2105cd0d/741117e0a once. GTA requires supported postcheckpoint keyboard primitive; first implementation worker stopped below2GB before edits. Constructor authentic reserved-bit detector falseacceptance mapped statically; default GC01/02 repair now assigned, supported SVGA remains unproved. Lossless25 completed reviewed worker rollouts recovered23387062B, free2047832064B at dispatch; guards unchanged. Both fresh workers serialize source/build/runtime; no new gameplay or full27 claim.
  Current update 2026-11-01T21:54:21.072546+00:00: Reviewed124d0bda1/3ce0c5dad full notes once: GTA exact117-file demo recovered and default original reaches rendered language menu only; Constructor repaired default UVCONFIG now0 but parent1 on missing SETSND.CFG, accepting graphics detector unvalidated. Both terminal0 author RELEASE remote ancestry PASS all11 reported helpers independently absent. Fresh GTA ordinary input toward gameplay; Constructor static authentic accepting-detector mapping and sound setup recipe. No gameplay, supported SVGA or full27 claim.
  Current update 2026-11-01T21:42:08.714466+00:00: Reviewed38bc16240/bd2791445 full notes once, both terminal0 author RELEASE, all four helpers independently absent and remote ancestry PASS. All RPG candidates plus Shadow Warrior/Comanche already qualified; GTA1 eligible with exact9.5MB archive pin. Fresh GTA worker recovers/verifies117 files then one default original startup; Constructor worker tests original default startup after changed-source sequencer repair77a0cea88. No supported SVGA, new gameplay or full27 claim; existing guards unchanged.
  Current update 2026-11-01T21:29:31.326532+00:00: Reviewed77a0cea88/ec54897d6 once: default VGA sequencer address/unsupported-register policy repaired with authentic port regression old-fail/new-pass, focused checks and locked build PASS; supported SVGA/configuration/gameplay remain unverified. Urban recovered2767106B from seven authorized released logs but still3097856B short of2.1GB launch, zero originals. All11 helperPIDs independently absent, terminal0 authorRELEASE and remote ancestryPASS. Replace blocked lanes with two bounded local original DOS candidate pools; exclude public/already-qualified titles, no downloads or source/build changes. RPG initial static finding: all three candidates already qualified; awaiting final report. No full27 or new gameplay claim.
  Current update 2026-11-01T21:16:21.457288+00:00: Reviewed581b708d3/d12f0d1e1 once: Urban zero originals, first launch sample2096635904B short3364096B; guards unchanged. Constructor retained authentic ED/EE unrestricted writability selects tag17 then256KiB fails512KiB gate; static14bytechecks/15slices, no causal stack capture. Fresh generic default-register policy regression/repair must use documented adapter contract, preserve standard/explicit-model behavior, no hardware fabrication. Urban new recovery scope only seven recently released terminal logs, no repeated exhausted census; original waits exact repair release and sustained headroom. Four recorded PIDs independently absent, both commits remote ancestors; no gameplay or full27 claim.
  Current update 2026-11-01T21:04:24.762752+00:00: Reviewedbf77b2c885/f3bb8e295 once: Constructor actual UVCONFIG exit6 and no-graphics text PNG, no gameplay; A7/C5 register alias observed but failed conditional/chip identity unproved. Urban synthetic inspect-brk pauses named-event Workers despite empty execArgv; main-thread-only inspector preload passes readiness/API, first-reason3 capture, watchdog and genuine stall/dead-client negatives. No actual allocator discriminator yet. Recorded runtime/watch PIDs independently absent, both commits ancestors origin/main, terminal0 and author RELEASE. Fresh Urban one-original diagnostic uses validated attachment; Constructor static maps original detection branches. No unchanged encounter retry/public deployment.
  Current update 2026-11-01T20:50:38.437895+00:00: Reviewed058aed059 and629a06e22 once: Urban dummy capture passes but sole original failed batch0 NamedEventAuthority deadline, no reason3/allocator/gameplay evidence. Actual originalwait1 before driverwait0; recorded PIDs directly absent. Constructor authentic28file/63205318B closure restored with all size/SHA and actual hostPath checks; current directory/mouse blockers historical, UniVBE boundary awaits actual startup. Both launchers0 author RELEASE and commits ancestors origin/main. Fresh workers target exact startup boundary and synthetic inspector coexistence, no unchanged Urban replay or public deployment.
  Current update 2026-11-01T20:39:15.840662+00:00: Reviewede48dcc193 once:46publicapps pinned; ChaosGate documented fixture missing and held compatibility work not reopened; Constructor28files missing but exact32MBoriginal archive/28hash manifest known. Fresh recovery assignment authorized one small authentic demo, no game/build during Urban runtime; disk>2GB, no multiGBcompilation. Bounded two-candidate failure is not a global pool blocker. Urban dummy preparation passed and runtimegate claimed20:38:12; actual first-refusal outcome pending.
  Current update 2026-11-01T20:27:33.775646+00:00: Reviewedbc6f89f70 and4c2213f3e once: closed logs recovered16.75MB but Battlezone remains197711872B short of2.4GB launch margin, zero originals; immediate log scope exhausted. Urban actual reason3 means fresh sparse commit failed after current reuse did not serve request; rewind eligibility/live/peer state unavailable. Proposed inspector capture UNEXECUTED, must validate dummy first. Both predecessor launchers0 and author RELEASE, static watcher4133006 absent. Rootobserver4115178 SIGTERM/actualwait0, terminal durable; no writer culprit claim. Two fresh assignments replace completed workers.
  Current update 2026-11-01T20:15:37.266443+00:00: Urban891591d11 reviewed: actual streetHUD2011 PNG, ACK2036 then180s timeout with first1MiB/32296B allocation refusals. No ArrowUp/encounter; OOM-to-stall causality and actual exit-only loaded/compile byte observers UNKNOWN. Original OSwait-9 durable before driverwait0; root35PIDs/34groups absent, published ancestor af500af41. Fresh static successor must distinguish retained evidence from missing live allocator state before another original.
  Current update 2026-11-01T20:11:37.965908+00:00: Reviewed7f0b1803e: lossless31-file recovery saved51884563B but margin remains203401216B short; zero originals and native m3 preserved. New successor adds bounded closed terminal worker log compression scope; no active/coordinator/laptop logs. Urban author reports heap refusals afterACK2036 and180s timeout; original actualOSwait-9, driver0, no gameplayedge/encounter. This is provisional author evidence pending completion review, not allocator causality proof.
  Current update 2026-11-01T20:03:27.947547+00:00: Battlezone346788a42 reviewed once: native save reload and red Fighter121m PNG establish restored Turrets and identified target; defensefire/kill/objective remainUNVERIFIED. First directdiskstop2004004864B stopped one originalOSwait-15, driverOSwait0. All102ownedPIDs/groups independentlyABSENT, launcher0 remoteMATCH. Released Icewind losslesscompression restored2160MB; successor must recover sustained2.4GB to avoid unchanged low-margin retry. Urban one original started after exact Battlezone release; scoped allocator/shutdown proofs reused. Coordinator passive disk writer observer owns finite shutdown20:29UTC; transient writer remainsUNKNOWN.
  Current update 2026-11-01T19:54:26.016600+00:00: Urban scratch shutdown repair079959006 reviewed once: old-fail/new-pass and15 lifecycle cases PASS, durable actual waits and bounded single-owner cleanup; all319ownedPIDs independentlyABSENT, launcher0 remoteMATCH. Historical originalwait gap remainsUNKNOWN, no new game proof. Battlezone same-original native file reload established; actual fullhealth selectedTurret68m capture reviewed, defensecombat/objectiveadvance pending. Fresh Urban will use reviewed helpers for one ordinary encounter attempt after Battlezone releases runtime and sustained launch headroom passes.
  Current update 2026-11-01T19:41:19.047193+00:00: Urban c157668dc reviewed once: actual Setup25 only, zero physical inputs/HUD/encounter; first real disk stop2003222528B with observed floor2GB maintained, transient writer unknown. All50ownedPIDs independentlyABSENT, launcher0 remoteMATCH. Nodehook0 differs from driverOSwait1; originalOSwait receipt missing because repeated shutdown signals interrupted finally. Fresh scratch-only shutdown repair requires durable original wait and immutable guard failures before another Urban original. Battlezone tested repeated-stop cleanup before its one native-save reload attempt; reload/defense outcome pending.
  Current update 2026-11-01T19:33:34.437004+00:00: Battlezone732f271c reviewed once: scratch heartbeat race controls PASS; one original/driver OSwait0, actual deployedTurret68m standard capture reviewed, twoTurrets and perimeterplacement established. Both native save hashes PASS, reload and identified defensecombat/nextobjective unverified. All115ownedPIDs independentlyABSENT launcher0 remote main MATCH. Reclaimed110MB released Icewind duplicate after matching retained source/bootstrap hashes; recovery recipe preserved. Fresh Battlezone prepares latest native save reload while Urban tests repaired allocator in ordinary gameplay.
  Current update 2026-11-01T19:04:48.684308+00:00: Urban0f9dfbb45 reviewed full allocator source/regression: old17051 balanced pairs fail, repaired102000 pairs use one1MiB map plus20000 varied pairs PASS; live/peer protection and zeroed reuse PASS. Lockedbuild/fivefocused PASS, launcher0 all21ownedPIDs independently absent remote main MATCH. Actual game causality unmeasured. Fresh Urban ordinary encounter follows Battlezone mission2 runtime; no original game replay during repair.
  Current update 2026-11-01T18:54:21.828825+00:00: Battlezone02b44b894 reviewed once: originalOSwait0, driver-15,258batches and zero inputs; guard clock sampled before heartbeat read produced -9.17ms age, no mission2 progress/game crash.22ownedPIDs independently absent, remote main MATCH. Fresh worker corrects deterministic read-order race with real future/stale/identity negative controls before one ordinary mission2 attempt; scratch preparation only during Urban allocator repair.
  Current update 2026-11-01T18:47:56.742686+00:00: Urban allocator probe55d995e94 reviewed once: 17051 balanced alloc/free pairs exhaust288MiB backing with zero live allocations; largest header35816B cannot satisfy35848B. Passive metadata unchanged, synthetic fragmentation retention proven; actual game first-refusal and crash causality remain unmeasured. Three owned PIDs independently absent, launcher0, commit ancestor of remote main. Fresh generic empty-arena repair with production-WASM regression and locked build; no original game replay.
  Current update 2026-11-01T18:38:55.210420+00:00: Battlezone39242f4b7 reviewed actual standard MISSION COMPLETED, deployed Recycler PackUp and Defense1Turret screenshots. Original/driver0, all55ownedPIDs independently absent and remote main matched. Scrap08->14, Turret purchase14->09, later12; exact harvest mechanism and mission2 victory remain unverified. Fresh successor pursues ordinary mission2 defense/combat after Urban allocator discriminator; accepted exact-input tests reused.
  Current update 2026-11-01T18:22:08.833345+00:00: Urban heap diagnosis a34f36480 reviewed: temporary D3D vertex packs request about26–44KB; 1MiB messages are arena commit refusals. Successful HUD run also logged20432 OOM lines, so no crash/guard causality established. Capacity versus fragmentation/commit bookkeeping remains unmeasured. Executable/source pins and retained disassembly checked, remote main matched, own watcher absent. Fresh no-game probe targets the missing allocator measurement; no further original game replay authorized.
  Current update 2026-11-01T18:12:11.100550+00:00: Urban7699f3fb reviewed once: one original stopped after1936 with guest heap allocation failures and3.012s stale heartbeat; exact causal timing unknown. No new HUD or encounter. Detached command controls passed, but original OS wait/driver terminal receipts missing and original gzip incomplete; recovered prefix retained. All47ownedPIDs independentlyABSENT, strictSSHremoteMATCH. Fresh worker investigates allocator/caller statically rather than replaying unchanged game.
  Current update 2026-11-01T17:55:27.169271+00:00: Battlezone19f8b0340 reviewed once: zero originals; worker passed Node observer to Python runpy and hit SyntaxError before observer execution. All7cleanupPIDs independentlyABSENT strictSSHremoteMATCH. No renderer/guard/game crash established, no new gameplay. Fresh successor corrects interpreter dispatch with durable terminal receipts and cheap smoke tests; ordinary scratch preparation errors may be repaired within assignment before original, avoiding repeated closeout-only flights.
  Current update 2026-11-01T17:50:54.316388+00:00: Urban c32bdc566 reviewed once: no-game controls separately detect stale/dead/replaced/failure file, healthy delayed1.5s accepted by measured3s guard policy. Actual loading386 PNG inspected. Tool controller terminal143 while original and guards live, sender/reason unknown; original quit0, no encounter. All24 cleanup PIDs independently absent and strictSSHremoteMATCH. Fresh detached-controller worker addresses that concrete lifecycle gap while Battlezone uses tested guards and detached helpers.
  Current update 2026-11-01T17:39:58.736117+00:00: Both predecessors terminal0 reviewed once. Urban2bc06c8a Setup only, original exit0 after20s guard rejected combined predicate without operand; no encounter or crash established. Battlezone7d47a40e zero originals: heartbeat age1.119649s exceeded arbitrary1s before primary advanced, independent SIGTERM overwrote shared failurefile; initiating traceback retained. All21Urban+7Battlezone cleanup PIDs independently absent; strictSSHremote7d47MATCH. Fresh successors require measured guard tolerance, negative controls and immutable first failure before original gameplay.
  Current update 2026-11-01T17:26:07.564173+00:00: Renderer feb493438 reviewed once: full production/census diff limited to existing coverSeq freshness, actual renderer PNG/postprocess regression oldsourceFAIL/newPASS, mandatory lockedbuild and focused checks PASS. Twentyone listed PIDs independentlyABSENT; remote main ebd313fd contains fix. Zero originals after2.2GB start prerequisite failure; actual Battlezone standard dialog/onward harvest remains unverified. Fresh worker assigned that concrete gap, behind Urban ordinary encounter; no repeated closeout or duplicate dispatch.
  Current update 2026-11-01T17:22:58.695907+00:00: Urban f20e19b246 reviewed once: actual HUD and ArrowUp movement from street into car-park passage, matched neutral stationary. Detached supervisor live throughout one original exit0; prior tool143 cause remains unknown. Eighteen listed cleanup PIDs independentlyABSENT strictSSHremoteMATCH. Fresh encounter worker already launched; no duplicate dispatch. Battlezone renderer build and regression passed; zero originals after first start-headroom failure. Lossless reviewed terminal log archive reclaimed10001070B with SHA roundtrip and recovery receipt terminal-rollouts-1720.json; no active logs touched.
  Current update 2026-11-01T16:58:57.020964+00:00: Battlezone6ca46f8ff reviewedONCE twoPNGs actualMISSIONCOMPLETED and onwardgameplay scrap08/30 after600noinput, noharvest. Extra control/scheduled repaint disproven; exclusive renderer freshness rejects active dialog gdi18584 versusDX18585 coverSeq0, publicationnotheld. Fresh worker owns bounded generic renderer fix/regression preserving occlusion. Driver/monitor143 causeUNKNOWN originalexitHook0, elevenPIDs independentlyABSENT strictSSHremoteMATCH. Urban followup now owns runtime; no source overlap.
  Current update 2026-11-01T16:40:27.031438+00:00: Urban generic wait-any repair2a3f3272 and notea17c5a7c reviewed once: full handle validation before lowest-ready acquisition; locked build and7focused checks including realWAT consumption PASS. Setup and rendered mission opening PNGs reviewed; noHUD/movement yet. Auxiliary guard143 causeUNKNOWN, primaryguard remainedLIVE; original orderlyexit0, listed15PIDs plus launcher/worker independentlyABSENT, strictSSHremoteMATCH. Fresh worker diagnoses guard lifecycle before next bounded original; ownership census remains pending, existing holds unchanged.
  Current update 2026-11-01T16:14:21.333203+00:00: Battlezone435e93f8f terminal0 reviewedONCE threePNG MISSION COMPLETED native dialog resource130/control1237, ordinary NextMission/Launch then mission2 Scavenge order consumed; harvest/scrapgain unverified. EightPIDs independentlyABSENT remoteancestor verified. Diskguard1978392576B stopped original exit0, continuous2GB requirement FAILED. Root lossless437 terminal ledger-reviewed rollouts reclaimed236057966B free2275254272B SHAroundtrip/statPASS recoverablegzip. Fresh capture/harvest lane requires2.2GB launch headroom. Urban generic repair owns runtime after exact release.
  Current update 2026-11-01T16:07:38.718754+00:00: Urban4d9446b48 reviewed once: real WAT API proves INFINITE wait-any incorrectly fails valid named-event set before consuming already-signaled auto-reset event; timeout0 matched control consumes correctly. Six PIDs independentlyABSENT, remote verified. Original exit0 at25batches zeroinputs noSetup. Fresh worker fixes bounded generic ready-now semantics only; CRT nonlocal/callback/concurrency/SEH holds remain. Battlezone black-dialog runtime live.
  Current update 2026-11-01T15:52:24.628860+00:00: Both predecessors reviewed terminal0, thirteenPIDs independentlyABSENT and strictSSHremote verified. Battlezonea5981a610 new180m approach thenblacknativeDialog0x10018/control1237, noarrival/meaningproved; twoPNG reviewed. UrbanChaosa1c43c412 localizedRSXcompletionwait but traceoriginal hostJSOOM45.5s beforestep25reply zeroinputs; rootcauseunknown. Fresh tasks require bounded diagnostic evidence, notunchanged replay. Root existing D3D9COMqueueWATPresent testPASS18.422s273pinsUNCHANGED published32c49ed87, test run20261101-d3d9-com-software-pixels, nofull27/GPUclaim.
  Current update 2026-11-01T15:37:24.640647+00:00: UrbanChaos88cf06d749 reviewed terminal0 and teal PNG;31step25 replies within180s,775batches32identical captures noSetup/title/gameplay, zeroinputs. FivePIDs independentlyABSENT remoteMATCH; smaller requests fixed helper timeout but startup cause UNKNOWN. Fresh worker compares historical native Setup route/current window-dialog readiness before launch; no blind repeat. Battlezone arrival owns runtime since15:32:43.
  Current update 2026-11-01T15:11:14.702645+00:00: Battlezone60500ae55 reviewed threePNG native Scavenger build scrap05to01, Space GoTo with identified approach663mto384m fixedforeground; arrival/damage/objective not proved. EightPIDs independentlyABSENT, remoteMATCH. Original719.25s exit0;32balanced keyedges consumed finalsampledreleased, numericmousemaskunknown. OptionalPillow absent noquantitativepixelclaim; nativeobserver/pins/122PNGchecksPASS. Fresh arrival/scavenging task uses corrected scratch wiring, no dependency install. UrbanChaos smaller-step runtime now owns execution.
  Current update 2026-11-01T14:58:57.282995+00:00: UrbanChaosc6fba571 reviewed terminal0, fivePIDs independently absent and remoteMATCH. Teal startup capture; no gameplay inputs. Helper step75 timed out120s although original advanced98batches/174s, so no game freeze established. Fresh assignment authorizes smaller scratch requests before ordinary alley/combat route. Battlezone runtime owns shared execution; root owns no runtime.
  Current update 2026-11-01T14:43:12.248338+00:00: Reviewed QuakeIIfbb83926b threePNG restored8/18HP21 then10/18HP30 upper stair passage; final eight guest-save exports match clean shutdown, new save F9 untested, goals0/1. Eight owned PIDs absent and remote ancestry verified. Battlezonead94d102f stopped observer wrapper missing SWEEP_CASE_DIR before any original; six owned PIDs absent remoteMATCH. Fresh task explicitly corrects scratch-only environment then validates observer, preserves production source. Refilled with TWO distinct nonpublic titles, Quake public follow-up retained as recoverable checkpoint.
  Current update 2026-11-01T14:05:30.105283+00:00: Reviewed ThiefII855212580 once, two PNGs left timber-building edge and downward wooden floor. No interaction/crossing established, other routes untested; six recorded PIDs independently absent and strictSSH remote MATCH. Thief route task ended; fresh Battlezone targets hit/damage or command outcome beyond accepted vehicle entry/ammo decrement. QuakeII active under corrected exact-author gate.
  Current update 2026-11-03T10:25Z — Root bounded native Device7::Load probe at0702aef5a reproduces whole-texture S_OK for null surfaces and a non-surface COM object, while rectangular form rejects both with0x80070057; all four return with correct28-byte ABI and no trap. This is a validation discrepancy, not a reproduced application crash. Evidence scratch/runs/20261103-d3dim-load-validation-probe/result.json and reproducible probe.cjs; instrumented canonical-closure module SHA101d3c14ac6d429b65156c0bd91124e8a1d25c659dac69b49a4813b322a2fd5c. Fresh worker28490/thread01a1a0f5-254c-7430-9623-2bb5695bcddd launched10:29Z from scratch/usage-watch/d3dim-load-surface-validation-nov03.task.txt after blocked GL completion review; independent D3DIM source/test ownership and separate native boat, no browser or blanket game-release gate. Full27 and broad crash coverage remain unproven.
  Current update 2026-11-01T13:48:06.863615+00:00: Reviewed QuakeII2ec46b5d eight-file8kill21HP native save/export; restored count remains unverified. ThiefIIc69379d3 right-route wall/parapet attempt no interaction; left route untested. Both launchers terminal0 and10PIDs absent. Lossless stopped-worker rollout compression recovered217642263B. Native D3D9 lighting36pixelcases PASS4.450s; see docs/re-notes/d3d9-native-lighting-pixels-20261101.md. Early Quake gate error disclosed and stopped.
  Current update 2026-11-01T13:27:48.222903+00:00: QuakeII8f2f8a802 reviewed four PNGs: identified living guard, shot impact/collapse, F1 kills8/18 at21HP. Nine own PIDs independently absent and strictSSH remote MATCH. Original seven-kill save unchanged and exported guest bytes match; eighth kill NOT saved. Successor targets ordinary F6/export/restore plus onward room. Disk floor recovered by lossless SHA-verified compression; recovery receipts retained.
  Current update 2026-11-01T13:14:07.256798+00:00: ThiefII e6814d7b reviewed three captures: torch-side barred window above raised sill, no interaction; four own PIDs independently absent and strictSSH remote MATCH. Prior short release queued hundreds of batches; successor must observe consumed release and settled presentation, use another reachable route, and verify door/loot rather than highlight alone. Other routes untested; no emulator defect.
  Current update 2026-11-01T12:58:56.250636+00:00: QuakeII recovery90aa4059d reviewed three captures: F9 restored21HP7/18 kills; closed-door approach before interruption, no attack/eighth kill/onward room. Eight prior PIDs and recovery watcher independently absent; strictSSH remote MATCH. Existing host saves unchanged; no guest VFS export/final count, W/D/End final samples or long door neutral control, limits recorded. Fresh continuation addresses encounter and controls. HereticII f581e849f remains attempted route blocked by intact crate, no enemy hit/objective; prior completion already deduplicated.
  Current update 2026-11-01T12:19Z: Dark Reign2 dd82ceb03 selected-unit movement reviewed once with four PNGs: stationary neutral group, displaced ordered units with fixed scenery. One original216.184s exit0, three recorded PIDs independently absent, strictSSH remote MATCH. Retained identities/observer and evidence checks PASS with disclosed coverage limits. Outcast84358006a bypass ends at water/steep bank without hostile impact/damage; Incoming arrival and Dethkarz damage remain unproved.
  status: two distinct new-title lanes UrbanChaos confrontation and Battlezone Scavenger arrival/scavenging assigned, serialized. Battlezone build and commanded approach663to384m reviewed; arrival/objective pending. QuakeII restored8kill and advanced10kill upper route with recoverable new save; objective and new save restoration pending. Full27/GPU/FPS/audio remain open.
  reclaimed: 2026-10-07T07:42:56.312Z
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  accepted: 2026-10-04T02:11:10.446Z
  accepted-by: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Current update 2026-11-01T07:05:47.946294+00:00: GL98fa718e3 original lines/fog PASS verification reviewed; Redline7c16acb92 zero originals/diagnostics/builds with precise disk blocker. Independent six own PIDs absent. Lossless89 terminal reviewed diagnostic logs/controls recovered44638402B with SHA roundtrip/restore receipt scratch/runs/20261101-coordinator-reviewed-compression/bulk-terminal-0710.json. Fresh Redline12104 sole runtime and Tachyon9958 queued behind release; no broader gameplay/full27 qualification.
  Current update 2026-11-01T07:00:46.773504+00:00: Reviewed Redline698550faa corrected scratch driver, syntax/identity evidence, zero originals/diagnostics/builds; watcher3282796 independently absent. Lossless old reviewed Redline snapshot compression recovered13918942B with SHA roundtrip receipt scratch/runs/20261101-coordinator-reviewed-compression/redline-snapshot-0701.json, free2306187264B before fresh worker. Redline01a195e8-dc81-76e2-960a-e7ac4e1911d2 handle25584 queues behind GL95311.
  Current update 2026-11-01T06:59:24.873576+00:00: Tachyon bd8f046fb reviewed no original/build/new input; synthetic observer PASS, independent15 fixture hashes MATCH watcher absent. Fresh GL01a195e7-9833-79c0-aee2-97349052b9f1 handle95311 queued behind Redline29343. Lossless terminal reviewed transcript compression recovered3500482B with SHA roundtrip receipt scratch/runs/20261101-coordinator-reviewed-compression/terminal-events-0659.json; disk still marginal for original startup.
  Current update 2026-11-01T06:56:16.708775+00:00: Reviewed Redline574a35dc4 note, consumed-input checkpoints and actual coherent cinematic images; no player proof. Six own PIDs absent. Fresh skip-cutscene worker29343 queued behind Tachyon92435; evidence scratch/runs/20261101-redline-primary-movement-retry/. GL next lines/fog task prepared but not launched; cap2.
  Current update 2026-11-01T06:45:26.144370+00:00: Redline6bab4e51e no original/tests/builds disk blocker reviewed independent4390source/70fixture pins MATCH. Lossless diagnostic compression SHA/roundtrip receipt in scratch/runs/20261101-coordinator-reviewed-compression/ preserved; free2318942208B before retry. GL ea9b18ae9 actual sequential logs PASS8/8+9/9, source MATCH ownPIDs absent. Fresh Redline1139 sole runtime, Tachyon92435 queued behind it.
  Current update 2026-11-01T06:41:28.123172+00:00: Reviewed Tachyonf1f9faf19 actual six control images, input dispatch, locked build/observer logs; independent4390source/15original hashes MATCH ownPIDs absent. Flight controls qualified with limits above. Fresh GL01a195d6 handle17476 queued behind Redline01a195cf handle11577. Reviewed transcript compression lossless but startup free remains below2300MB; no launch threshold waived. Evidence scratch/runs/20261101-tachyon-flight-gated/.
  Current update 2026-11-01T06:34:56.547740+00:00: Reviewed e06fe9784 actual source/test diff, beforeFAIL/afterPASS logs, locked build, coherent primary and striped wrong-surface images. Independent4389source/70fixture hashes MATCH and own runtime PIDs absent. Generic final-capture selection fixed; gameplay after repair UNVERIFIED. Fresh Redline01a195cf handle11577 prepares scratch only behind Tachyon01a195c8 handle87984, which acquired runtime06:31:57. Normal gate wait nonterminal; cap2. Evidence scratch/runs/20261101-redline-canonical-presentation/.
  Current update 2026-11-01T06:25:20.080001+00:00: Tachyon predecessor stopped offline at closed runtime gate; zero originals/tests/builds/commits. Independent15file hashes/note MATCH. Fresh 01a195c8-7c8f-7a41-9095-0642258ea75c handle87984 explicitly waits for Redline final/result+runtime/source/build RELEASE, prepares scratch driver only before gate. Deadline30min/fallback10min. Redline86286 remains live; cap2.
  Current update 2026-11-01T06:22:47.104319+00:00: Rune cave/W qualified. Redline521f103fd sampled texture bytes intact but final scene striped; same-frame canonical target/presentation task active. DarkReign2 10e747bbd proves native mip LOD sampling missing; lane blocked, no inflated caps. Tachyon replaces it for original flight controls, first checking later accepted evidence. Starlancer licence question Telegram1772 pending. GL tests/full27 unqualified; cap2 serialized runtime startup2300MB/floor2000MB. Fresh workers Redline01a195c5-fae9-7d23-8b81-3b3deab4cb72 handle86286 output scratch/usage-watch/redline-canonical-presentation-nov01/ sole runtime/source/build; Tachyon01a195c5-ff11-7b30-85e0-81d1cee6946c handle91769 output scratch/usage-watch/tachyon-native-flight-control-nov01/ scratch-only until Redline final/result+runtime/source/build RELEASE; deadline06:52UTC fallback06:32UTC
  Current update 2026-11-01T06:11:05.889123+00:00: Rune cave/W qualified. Redline repair149286afd gives upload success but inspected severe stripes, gameplay unqualified; fresh pixel/render cause task active. DarkReign2 note480c35a5d records first startup failure: HAL/RGB reject mipmapping, guest exits e0000002 batch10, actual teal PNG no input; independent4389source/29original hashes MATCH ownPIDs absent. Fresh task checks exact requested capability against actual renderer support before any generic repair, gated behind Redline. GL mipmap/texgen unrun; Starlancer awaits Telegram1772 licence decision. Cap2 serialized runtime startup2300MB/floor2000MB. Fresh workers Redline01a195b8-6d0f-7590-a252-04807f189792 handle88655 output scratch/usage-watch/redline-striped-render-cause-nov01/ sole runtime/source/build deadline06:37UTC fallback06:17UTC; DarkReign2 01a195bb-611d-7521-902d-11e8a24b93d3 handle64111 output scratch/usage-watch/dark-reign2-mipmap-contract-nov01/ scratch-only until Redline final/result and board runtime/source/build RELEASE deadline06:40UTC fallback06:20UTC
  Current update 2026-11-01T06:08:00.894295+00:00: Rune cave/W movement qualified. Redline DirectDraw4/7 creator registry fix149286afd passed meaningful beforeFAIL/afterPASS regression and locked build; selected texture upload succeeds but inspected scene has severe stripes, gameplay unqualified. Fresh Redline traces actual pixel/format/pitch/render consumption. GLsoftware stopped before tests when predecessor changed its baseline; no coverage claim. Fresh DarkReign2 pursues original mission input; startup blocker being recorded. Starlancer licence question Telegram1772 pending; no acceptance. Cap2 serialized runtime startup2300MB/floor2000MB. Fresh workers DarkReign2 01a195b5-6b82-7ec3-a8df-d285f5f79a14 handle24157 output scratch/usage-watch/dark-reign2-native-mission-nov01/ sole runtime/source/build deadline06:35UTC fallback06:15UTC; Redline01a195b8-6d0f-7590-a252-04807f189792 handle88655 output scratch/usage-watch/redline-striped-render-cause-nov01/ scratch-only until DarkReign2 final/result and board runtime/source/build RELEASE deadline06:37UTC fallback06:17UTC
  Current update 2026-11-01T05:52:07.295054+00:00: Rune cave/W movement qualified; Redline upload failure diagnosis continues. Starlancer stopped before launch at documented EULA prerequisite, gate honored, independent104original hashes and note SHA unchanged; flight unqualified. Owner licence-authority question delivered Telegram1772. Replaced freed slot with two unreviewed WAT software GL texture fixtures (mipmap/texgen), serialized behind Redline; no accepted reruns, generic repairs or GPU claims. Cap2; disk floor2000MB/startup2300MB. Fresh Redline01a195a6-88b2-75e1-b040-32f520b5e475 handle11905 sole runtime/source/build output scratch/usage-watch/redline-upload-internal-cause-nov01/ deadline06:18UTC fallback05:58UTC; GLsoftware01a195a9-e166-7a82-a1b9-9daaeefcf9e1 handle20208 output scratch/usage-watch/gl-software-texture-sweep-nov01/ scratch-only until Redline final/result and board runtime/source/build RELEASE deadline06:22UTC fallback06:02UTC
  Current update 2026-11-01T05:49:46.559146+00:00: Rune cave gameplay and ordinary W movement reviewed and qualified at c18c7d742; jump/combat/audio remain unqualified. Redline e069ca366 selected CreateSurface succeeds then upload453de3 returns0; internal failing operation unknown, textures missing. Fresh Redline traces upload API/guard with validated readonly diagnostics. Fresh Starlancer pursues original flight from known loadout route, stopping at unresolved licence requirement; no new acceptance authorized. Independent4389source70Redline/289Rune hashes MATCH ownPIDs/tempABSENT. Cap2 serialized runtime, startup2300MB/free floor2000MB. Fresh workers Redline01a195a6-88b2-75e1-b040-32f520b5e475 handle11905 output scratch/usage-watch/redline-upload-internal-cause-nov01/ sole runtime/source/build deadline06:18UTC fallback05:58UTC; Starlancer01a195a7-bbd5-7e23-9eae-33a4a0c506dd handle48661 output scratch/usage-watch/starlancer-original-flight-nov01/ scratch-only until Redline final/result and runtime/source/build RELEASE; deadline06:19UTC fallback05:59UTC
  Current update 2026-11-01T05:03:21.711709+00:00: Reviewed Redlineb2a6364 actual missing-texture PNG/notes/offline archive and actual VFS/readonly checks; freshlockedbuildPASS root4389source/70fixture rehashMATCH ownPIDsABSENT remote main integrated. TGA absent/BTF390 present does not prove executed lookup; no repair. Fresh Redline01a1957d handle75484 offline existing narrow guest execution trace validation behind Rune01a19575 sole runtime; no repeated API census.
  Current update 2026-11-01T04:54:31.835477+00:00: Reviewed Rune12493534 production/test/census SHA-only diff and actual main-menu PNG, meaningful emitted regression beforeFAIL/afterPASS, mandatorylockedbuild/focusedPASS. Root postfix4388source/289pins MATCH ownPIDs absent strictSSHremoteMATCH. Staged due callback now yields before successor reacquires; gameplay unverified. Fresh Rune01a19575 handle79251 ordinary NewGame/map task offline behind Redline01a19569 sole runtime, deadline05:24UTC.
  Current update 2026-11-01T04:41:57.932516+00:00: Reviewed Redline651ddc419 notes/actual missing-texture PNG/offline and identity artifacts, root source4388 only current Rune-owned2 delta, ownPIDs absent strictSSHremoteMATCH. Two runs retain all610CreateSurface but selected4181d5 missing; no repair or selected API-success/absence claim. Fresh archive-member cause01a19569 handle26260 offline behind Rune01a19560, requiring a materially different validated observation before guest and no repeated unchanged second run.
  Current update 2026-11-01T04:31:47.069437+00:00: Reviewed Rune6af01e35d actual title PNG/raw same-turn release-reacquire controls, causal/offline checks, source4388/pins289 independently MATCH allownruntime/temp absent strictSSHremoteMATCH. Mixer timer owner does release correctly; main stays parked during same-turn reacquisition. DirectSound outputs succeed, no generic repair proven. Fresh Rune01a19560 handle97214 prepares exact CACA003B callback completion/due-entry/run return/main retry offline behind Redline01a19556 sole runtime gate04:28:30; held algorithms remain out of scope.
  Current update 2026-11-01T04:21:25.758651+00:00: Reviewed Redline d989ed98c notes/actual missing-texture PNG/raw retention counters/offline checks, full4388source/70fixture rehash MATCH strictSSHremoteMATCH ownPIDs absent. Live backend450729 proven, selected first loader/API failure remains unobserved: second trace quota exhausted by IsLost, no absence/success inference. No generic repair. Fresh Redline01a19556 handle9092 prepares isolated selected file/container frames before CreateSurface offline behind Rune01a1954c sole runtime gate04:19:41.
  Current update 2026-11-01T04:10:06.559925+00:00: Reviewed Rune1c0b6a7a4 actual title PNG, raw original GetMessageA consumer/foreground forwarding and Galaxy lock evidence, offline/routing PASS; existing input-consumption VM fixture fails missing mainSchedulerObserver, unchanged. Full4388source/289original-pin hashes independently MATCH strictSSHremoteMATCH all own PIDs absent. Both Escape edges reach correct owner1, retained through183100 because main waits Galaxy CS1196ba78 owned Win32tid4; missing release/continuation cause unobserved. No new delivery repair or menu/gameplay. Fresh Rune01a1954c-85a7-7382-a03f-fb6cbee6082a handle86592 scratch-only owner-cause preparation behind Redline01a19546 sole runtime after040906 gate.
  Current update 2026-11-01T04:03:06.880856+00:00: Reviewed Redline3f458cead actual gameplay PNG, 366 draw records/177 selected IDs, actual guest bind guard/disassembly, offline read-only checks, fresh lockedbuild and full4388source/70fixture/128loaded-read identities each PASS; strictSSH remote MATCH and all own runtime gone. Selected bank dimensions/format-1 prevent realization before pool binding, distinct UI upload success does not prove gameplay texture success. No generic repair yet; fresh Redline01a19546 handle22117 prepares backend450729/upload453de3 first-failure trace offline until Rune01a1953c final and runtime/source/build release. Rune gate opened04:02:18 for original polling-owner diagnostic.
  Current update 2026-11-01T03:52:13.821011+00:00: Reviewed Runeef35ed520 production/test/notes, actual original title PNG, same real-template recycled-slot FAILbefore/PASSafter, mandatorylockedbuild and IsDialogMessage/EndDialog/sharedWATtables PASS. Source/module/original142/loaded-read pins MATCH remote main MATCH; two natural exits0 all own runtime gone. Clearing stale32B dialog header repairs renderer Escape loss. Remaining polling focus/destination0 and exact dequeuing thread unknown; no menu/gameplay. Fresh Rune01a1953c-37ab-7273-bc70-a1fc38f0e8a7 handle23227 offline preparation until Redline01a19536 final artifacts and runtime/source/build release.
  Current update 2026-11-01T03:45:50.017134+00:00: Reviewed Redline85d79e17f actual gameplay PNG, complete binding-call counts, resource-detail quota limits, read-only/offline validation, original/source/module identities and runtime cleanup; remote main MATCH. No SetTexture/GetHandle/TextureLoad/TEXTUREHANDLE, successful Texture2 QI pool differs from nonzero upload surfaces; guest selection/transfer cause unknown. Fresh Redline01a19536-5527-7391-99b7-fd6b3cdb00ea handle8003 scratch-only disassembly/driver prep until Rune01a19532 final artifacts and runtime/source/build release, then bounded causal trace/repair. Rune owns dialog record-reset source/test integration.
  Current update 2026-11-01T03:41:46.495081+00:00: Reviewed Rune5d68275e6 actual title PNG, physical down/up dispatch and offline/build/source/module/original-pin evidence; one83.125s exit0 child0 all runtime released. Escape DOWN missing before queue, UP reaches original HWND10018; nonexistent scalar probes unavailable, exact branch unresolved. Remote MATCH no speculative repair. Fresh Rune01a19532 handle30068 scratch-only source/driver preparation until Redline01a1952a final+runtime/source RELEASE; then causal generic repair plus regression/lockedbuild and ordinary menu/gameplay.
  Current update 2026-11-01T03:33:02.388539+00:00: Reviewed Redline2f31f7e19 actual gameplay PNG, frozen device7 slot0/effectiveCOLOROP4, 1630surface snapshot, offline read-only tests, mandatorylockedbuild/fixturePASS and unchanged source/module/loaded-read pins. No repair; exact upstream binding cause unobserved. Remote MATCH allruntime released. Fresh Redline01a1952a handle56128 prepares call/HRESULT chain offline until Rune01a19524 final+runtime/source RELEASE.
  Current update 2026-11-01T03:26:58.444354+00:00: Reviewed childstate66028ecbb production/test diff and actual logs: 203-file missing-output regression fails before, preserves203 after; 14cases plus VFSexport/childDLLidentity/processboot/shellrouting PASS and mandatory lockedbuild PASS. Paired VFS/registry token+digest completion prevents missing/partial/stale/failed export application, preserves completeempty and guest17/host0. Tested source hashes/strictSSHremote MATCH, integration RELEASED. Fresh Rune01a19524-fecf-7132-b9f7-10b46df8bf95 handle44528 prepares offline Escape tracing, no runtime/source edits until Redline01a1951f final and runtime/source release.
  Current update 2026-11-01T03:21:00.059099+00:00: Reviewed Rune aaa464a3c actual title/Escape PNG, validation and remote main. Two original CLI exits0, child detection0, full pins/source/module identity unchanged and runtime released. Next Rune observation: trace physical Escape delivery/consumption on same ordinary route. Fresh Redline01a1951f-9dce-7242-9138-a85e37694d9f handle2192 deadline03:50 fallback03:30 starts only scratch offline expression/driver validation; guest/build/source edits gated on childstate repair final artifacts plus board release.
  Current update 2026-11-01T03:16:32.492219+00:00: Fresh child-state completion worker01a1951b-85cd-7213-ab7b-c45d1656dd34 handle91557 output scratch/usage-watch/child-state-completion-repair-nov01/ deadline03:47UTC fallback03:27UTC. Proven separate crash-loss path: absent child output interpreted as empty snapshot deletes parent VFS. First phase scratch-only synthetic reproducer/proposal; production edits/build gated on Rune01a19518 final artifacts and actual runtime release. No original guest/browser in repair task. Redline snapshot waits for this integration to avoid mismatched runtime sources.
  Current update 2026-11-01T03:13:15.160610+00:00: Reviewed Redline b266a8ca7 actual gameplay PNG identical to retained image, build/source/pins PASS, single diagnostic exit0 all runtime PIDs gone. Resource snapshot failed require-not-defined before state read; trace alone ambiguous, texture cause UNPROVEN no repair. Fresh Rune01a19518 handle38046 ordinary wizard/menu/gameplay after accepted DLL identity fix. Next Redline frozen read-only state/rawpixels diagnostic prepared, no launch until Rune runtime releases.
  Current update 2026-11-01T03:07:20.419067+00:00: Reviewed Rune af316dc21 actualsoftwarewizard and Detected.log, source/testdiff, mandatorylockedbuild/fourfocusedPASS and strictSSHremoteMATCH. Live Corehandle returnedCrootCore -> cwdRoot -> Default.ini error2; exactparentDLLguestpath exportmapping repairs cwdSystem/INIopens, actualD3DDrv detection childexit0. Both142pins unchanged allownPIDsgone, gameplay not yetobserved. FreshRedline01a19512 handle39705 texture/HUD cause after reachedgameplay; nextRune ordinary wizard/input progression.
  Current update 2026-11-01T03:02:43.821189+00:00: Reviewed Redline ed841c8ef actual right-held.png firstperson gameplay and delivered Up/Right/fire response evidence. Default backlog drains/pump returns; successful second run uses 100x main block budget with unchanged200ms clock. Incomplete textures/HUD remain, no sustainedplayability/audio/browser claim. Two runs exit0 originalpins/module168c61dae unchanged ownPIDsgone remoteMATCH. FreshRune01a1950e handle3237 child-only normal-speed NO-breakpoint trace; only confirmed DLLidentity cause permits repair plus focusedtest/lockedbuild.
  Current update 2026-11-01T02:54:54.266694+00:00: ReviewedRune662fe152c single diagnostic/actualsoftwareonlywizard. Two breakpoints forceBATCHSIZE1; child stopped beforeappInit atwatchdog40s no failedINIchain, no productionrepair/test. Currentmodule168c61dae input4385/pinsPASS ownPIDscollected. FreshRedline01a19507-8d04-73b0-84e2-8250010d5fda handle55458 defaultclock/minimaldiagnostics eventualdrain/pump/mission; Rune next NO breakpoints trace atnormal speed then only proven DLLidentityrepair.
  Current update 2026-11-01T02:51:25.217144+00:00: Reviewed6b0fa5430 currentbuild168c61dae/layoutccbc PASS originalfixture unchanged; actualStadiumCityPNG menuonly. Completed4861updates decrease accumulator1019073to858660 exactly4861x33 whilepump967; progressing backlog immediatecause, remainingdrain/mission unknown. Mutexmainowner1 worker2wait no circularproof. AllPIDscollected. FreshRune01a19504 handle9119 one focused missingINI childtrace then only confirmed transportrepair with focusedtests/mandatorybuild; serialruntime, next Redline eventualdrain/pump diagnosis after Rune.
  Current update 2026-11-01T02:50:12.918484+00:00: Reviewed published6745ab3f3 once: actual helper probes prove child Core.dll becomes C:\Core.dll instead of C:\System\Core.dll; original Core derives baseDir from DLL hModule then sets cwd. Exact first failed INI/read remains unknown. No runtime/build; original pins PASS. Absent-output203deletion merge is separate. Prepared one focused child trace then evidence-backed generic transport repair; launch only after Redline sole runtime ends.
  Current update 2026-11-01T02:45:50.055663+00:00: Reviewed18dd486c Redline static stack/disassembly: fixed-step catchup precedes PeekMessage; one UIcallback returned, current accumulator/traversal counts absent so cause unknown. No guest launched because retainedmodule layout3a035 mismatches current JSccbc after95b5a. Fresh01a194ff handle54041 explicitly builds current under lock then measures accumulator/return/pump, preserving original game. Rune01a194fc remains static-only. No speculative repair or gameplay claim.
  Current update 2026-11-01T02:41:18.846722+00:00: Reviewed Runeac80c5c4d and actual software-only wizard PNG, published6b5d59f5f. Exact original renderer child executes then fails MisingIni/appInit before renderer result, despite original INIs in exported tree; lookup cause unknown. Both child cleanups required SIGKILL, all assigned PIDs gone; absent output merged203deletions only into disposable parent VFS, not original disk. No Next/gameplay/Detected.log. Fresh Redline01a194fb handle53345 traces missioncallback/dispatch; next Rune childINI/transport diagnosis. Incoming95b5a2440 runtime merged after Rune testing; retained2be3cebaa belongs accepted9ba runtime, not new main.
  Current update 2026-11-01T02:34:04.405963+00:00: Reviewed published1dd8b642 Redline original CLI and actual mission-selector PNG. Three bounded runs exited0; original fixture unchanged. Ordinary held mouse+Enter advanced NewGame with actual input dispatch, but Stadium City remained unchanged through52200 batches; UI callback/dispatch cause unknown, no gameplay. Fresh Rune01a194f4-9f9a-7da1-9953-260606b45d9a handle75872 executes original requested renderer child via documented --spawn-processes and pursues ordinary wizard/menu/player control, serial local CLI only. Redline next scope is callback return/UI traversal/event ownership, not blind retries.
  Current update 2026-11-01T02:25:31.537956+00:00: Reviewed36592af3b Rune original CLI run and actual wizard capture; fixture142files and shipped INIs unchanged, actual module2be3cebaa. No child executed because spawnProcesses disabled; D3D renderer untested, no ordinary UI input/gameplay. Existing documented --spawn-processes is next bounded Rune route, no speculative production repair. Fresh Redline01a194ec-d4e8-7ff1-80cc-38b133061347 owns original DISPLAY/Play/menu/input through existing --app=redline_demo, serial bounded local CLI only, no browser/transfer workaround.
  Current update 2026-11-01T02:21:57.101795+00:00: Fresh Rune worker pursues ordinary first-run/menu/gameplay using existing --app=rune_demo, pinned142 original files and unchanged shipped configuration/empty args. Bounded serial local CLI only, no benchmark/browser/box or transfer retry; CLI evidence cannot establish browser/WebGL qualification. Stop first concrete blocker. Coordinator owns Redline next original --app=redline_demo DISPLAY/Play route, serialized after Rune. Both browser lanes still need authorized file transfer after SCP403; no channel workaround.
  Current update 2026-11-01T00:13:52.591611+00:00: Reviewed published ae0ee3c4 Redline original local-only registration:65 unchanged independently copied files,59 manifest companions, original cwd/emptyargs/DISPLAY route; mandatory build and focused full-pin/source-preservation/file-policy/census/Rune regression PASS. Completion01a19468 deduped once. Both Rune and Redline are ready for authorized original browser testing; no gameplay claim. Runtime transfer remains SCP403, owner notified Telegram1768, assigned box independently stopped. No new allocation or channel workaround. No live workers; next browser assignment requires authorized functioning transfer. Crimsonland remains parked pending faithful installation or authentic installed-state export.
  Current update 2026-11-01T00:01:07.356069+00:00: Reviewed Redline5d11816fb original65-member recovery and Rune d559be7f2 first SCP403 api_key_action_forbidden before runtime. Fresh bx_wqqv4dah independently verified stopped235039.864; no access retry/alternate channel or gameplay claim. Owner notified Telegram1768 delivered API-success; authorized transfer permission/path needed. Redline fresh01a19468-8f71-7491-bee1-8f4917099c3f handle19099 prepares canonical unchanged60-gamefile fixture plus ordinary local-only entry, static focused tests and mandatory build, no runtime/box/download. Rune remains ready; Crimsonland parked pending faithful installation. One worker under cap2, no runtime boxes, disk >2GB.
  Current update 2026-10-31T23:49Z: Fresh Rune worker01a1945d-9ffe-7fb0-afd4-2ca66bc41475 handle93570 runs ordinary original first-run/browser gameplay on separately allocated bx_wqqv4dah. API exec verified node/Chrome/current access; no prior denied box retry. Expiry2026-11-01T00:23:29.680Z, guest cutoff00:12, evidence handback00:16, worker-delegated shutdown00:18/coordinator backstop00:19 UTC. Minimal untracked runtime bundle only, no repository copy/public ports. Redline01a1945a remains static original-media lane; two workers under cap2, one browser. Original pins/default configuration retained; no gameplay claim until actual captures. Disk >2GB.
  Current update 2026-10-31T23:45:35.270655+00:00: Reviewed published4efd70796 full authentic DirectX INF scope, actual additive-registry deletion fixture and original setup selector: current4.10/build16384 predicts WIN98SE136 copies, predecessor138 retained explicitly. No candidate mutation; full deletion/queue/component registration replay or verified authentic installed-state export required, not another detector-only run. Crimsonland parked at that prerequisite. Fresh Redline01a1945a-782e-7990-a0a4-aa8d510c6522 handle71046 original small demo source/recovery/pins only, <=200MB added storage and >2GB free, no runtime/remote access. Rune registeredcd62d1dd7, browser host access pending. One worker under cap2.
  Current update 2026-10-31T23:31:52.779243+00:00: Published cd62d1dd7: Rune local-only registration and consistent builtin DLL execution with authentic file/resource visibility retained. Coordinator reviewed census hashes and expanded compiler string pool; mandatory full build plus focused loader/Rune/census tests PASS. Both worker WIPs reviewed and deduped once; no gameplay claim. Fresh 01a1944d-f6d0-7ef2-a993-1ad63e09598f handle48776 reviews full authentic138-action DirectX INF installation and prepares faithful candidate recipe only if justified. Cheap static/VFS only, no access retry or runtime boxes. One production worker; cap2 is a ceiling. Disk >2GB.
  Current update 2026-10-31T23:16:09.268884+00:00: Reviewed Rune b589b8b8d full142-original canonical fixture/hash/141companion manifest and Crimsonland02a8cbe2b actual loader/VFS evidence; both published ancestors. Authentic fullpath D3D8 LoadLibrary bypasses builtin startup policy, dependency walk skips DDRAW16private imports; candidate unchanged. Fresh Rune01a1943f-6321 registers local-only ordinary first-run route; genericloader01a1943f-6590 repairs consistent builtin execution independently of real file/resources, old-fail/new-pass tests and serialized mandatory builds. No browser/game/access retry or box allocated. Original bytes preserved, disk >2GB, cap2. Browser qualification remains pending authorized host access.
  Current update 2026-10-31T23:05:03.969194+00:00: Rune65224c0ca original142-file demo and Crimsonland0f897faee authenticDX81 media reviewed once; both commits ancestors of main, no runtime qualification. Fresh Rune01a19435-4e19 handle14147 prepares canonical candidate fixture/host manifest using unchanged originals; Crimsonland01a19435-49fe handle29328 prepares justified authentic dependency mappings with native-loader policy first. No engine/shared registry edits, no browser/access retry; disk >2GB, cap2.
  Current update 2026-10-31T22:53:05.035248+00:00: Rune1b8e2b411 reviewed disk-only prerequisite stop; no recovered pins or gameplay. Disk now2.82GB after verified341251986B Icewind cabinet dedup; all original bytes/paths retained, recovery receipt scratch/runs/20261031T2258Z-coordinator-disk/. Fresh Rune01a1942a-5c12 handle52865 direct-source/media recovery with package+expanded-size preflight and >2GB floor. Crimsonland01a19421-6158 remains live authenticDX81 media/documentation; no runtime allocated.
  Current update 2026-10-31T22:50:12.850283+00:00: Alice239b5e259 reviewed assigned-host SSH403/publickey failure before any transfer/runtime; no gameplay. Box bx_knya4u7y independently verified stopped224519, no retry/resume/new box. Media stays ready pending authorized host access. Fresh Rune01a19427-a9bb handle6001 recovers original demo/pins/launch prerequisites, cheap-only; Crimsonland01a19421-6158 handle92614 remains authenticDX81 media-only. Two workers, no runtime allocated. Owner notified Telegram1767.
  Current update 2026-10-31T22:44:52.858805+00:00: Alice recovery d41903f45 reviewed exact archive/original15/PK3CRC/14-companion manifest; fresh Alice01a19422-9f22 handle18068 owns ordinary NewGame/Easy/W browser test on separate temporary boat bx_knya4u7y, sole runtime. Guest cutoff23:03, handback23:06, explicit delegated shutdown23:08, expiry23:13:53 UTC. No second checkout/public hosting. Crimsonland01a19421-6158 handle92614 authentic Win9xDX8.1 media recovery remains cheap-only. Two slots occupied.
  Current update 2026-10-31T22:43:17.559021+00:00: Reviewed c6733097a native detector: authentic system d3d8.dll fixed-resource major4 >=4.8.1.881 or major5 >=5.1.2600.881; no proved generic API defect. Original60/past evidence unchanged. Fresh Crimsonland01a19421-6158 handle92614 recovers provenance-backed Win9x DirectX8.1 media and dependency mapping, cheap-only no installer/game/browser execution or fabricated resources. Alice01a1941c-b70b handle44538 extracting authentic media and host manifest. Both slots occupied; no runtime allocated. Corpus05278c67e corrects stale UT2004 WebGL and Nox/FreeSpace status.
  Current update 2026-10-31T22:38:19.054333+00:00: ReturnFire launcher5d014a0e reviewed complete visible native controls and trusted Play; prior teal-only view was viewer error, no paint defect. Crimsonland2a64e65c reviewed original DirectX8.1 warning before launcher, no combat/input. Both terminal/published with full cleanup. Fresh Alice01a1941c-b70b handle44538 recovers authentic demo media for ordinary gameplay; fresh Crimsonland01a1941c-c75d handle32255 audits exact original installed-component/version-resource contract. Both cheap-only, no runtime allocated; no repeated warning run. Two-worker cap.
  Current update 2026-10-31T22:31:46.148187+00:00: Crimsonland01a19411 interrupted143 without final, cause unknown; viewport setup timed out before navigation, no game result. Independently verified full cleanup/release223105 in 20261031T2232Z-crimsonland-interruption. Fresh Crimsonland01a19416 handle27945 repairs harness then targets native combat, cheap prep until CURRENT ReturnFire01a19414 full release. ReturnFire consumed reconstructed release and began sole heavy slot223131 target224831 hard224931 cleanup225031. Two workers.
  Current update 2026-10-31T22:28:49.786047+00:00: ReturnFire9f695796c reviewed oldFAIL/newPASS/build logs and retained before/after colored Play/H deployment/W movement-release captures; accepted at actual HTTP module aee25464, unchanged58 original files. Incoming Big5 merge outside tested source. All32 runtime identities absent, durable waits0; launcher visibility/audio/FPS remain open. Fresh ReturnFire01a19414-2064 handle73994 investigates visible launcher, cheap prep until CURRENT Crimsonland01a19411 explicitrelease+actualgate. Crimsonland sole runtime started222757 target224457 hard224557 cleanup224657. Review20261031T2231Z-coordinator-review.
  Current update 2026-10-31T22:26:07.580692+00:00: Icewind fd4d9bba2 and966bba074 reviewed: local provider0 intentionally skips network initialization/Open then polls retained activation reference; valid NOCONNECTION triggers cleanup, no proven generic COM identity/refcount/ABI defect. Park at original local-provider handling dependency; no Party/gameplay. Fresh Crimsonland01a19411-7a40 handle77387 targets native combat/enemy/kill/score beyond accepted Tutorial; cheap prep until current ReturnFire terminal publication+actual runtime gate. ReturnFire worker reports generic caps repair oldFAIL/newPASS/buildPASS and complete-color deployment after NEWFULLRELEASE222500; final publication/capture review pending. Review20261031T2226Z-coordinator-review.
  Current update 2026-10-31T22:09:33.825135+00:00: Icewind eccebf738 terminal0 reviewed once: trusted CreateGame clears then returns to menu, personally reviewed paired captures; no character/gameplay or defined generic defect. Native CoCreate succeeds; first session-initialization failure remains unknown, late faulty observers quarantined. Original1106/CD2/module pins unchanged and own runtime released. Fresh Icewind01a19402-8ae2-7440-b5b6-3d2ab21e0936 handle74539 examines first caller/order and waits CURRENT ReturnFire explicit release plus independent actual gate before heavy work. ReturnFire65465 remains live with sole browser priority. Review20261031T2210Z-coordinator-review.
  Current update 2026-10-31T22:06:00.000009+00:00: SlaveZero01a193f0-a63e terminal1 automatic possible-cybersecurity-risk rejection, no final message; no retry/rephrase/delegation. Coordinator existing normal quit acknowledged220429, independent22PID-start absence/wholeChrome+crashpad empty/portsclosed/profilegone/inputclear/FD9free220514; controller/helpers/adopted wait0, outer supervisor wait missing. Hold original diagnostic; no new gameplay/causal acceptance. Fresh independent ReturnFire01a193ff-449f-7a50-88a4-b23df8211dbe handle65465 targets original58-file registered indexed browser Play/H/W paired deployment/movement, replacing absent historical captures. Icewind01a193f0-6bdc runtime released220256 after CreateGame clearing then menu; worker still publishing, no character/tavern/gameplay acceptance. Two workers, serializedheavy. Review20261031T2205Z-coordinator-review.
  Current update 2026-10-31T21:49:59.089934+00:00: Reviewed terminal290accd0d and bbcaa1b14 once, personal preteardown screenshots/release receipts. Icewind original optical scan and labelled menu accepted; first CreateGame mouse event not sent due scratch OffscreenCanvas geometry error; no gameplay. SlaveZero firstfatal512stack preserved, producer0x837 still missing due routine capture saturation; no genericfix. Fresh Icewind01a193f0-6bdc handle75090 browser-verifies corrected geometry then native creation/PrologueDONE/tavern movement. Fresh SlaveZero01a193f0-a63e-7802-b242-7c0b6c8f1ba4 handle55126 cheaply tests corrected filter before cap and waits CURRENT NEW Icewind explicitrelease plus actualgate. Two workers only serialheavy. Review20261031T2152Z-coordinator-review.
  Current update 2026-10-31T21:36:07.655963+00:00: Icewind e9753b0cb terminal0 reviewed once: loading-only screenshot, eightcase guard correction not yet browser-tested; static original optical mount prerequisite accepted, no startup/gameplay. Fresh Icewind01a193e3-eedb handle47840 tests exact corrected guard then dynamic optical calls, waiting CURRENT SlaveZero01a193e2-c9b5 release and independent actual gate. Two production workers only. Coordinator60e87da66 remoteexact verified; prior late Icewind-install notice deduped without reread.
  Current update 2026-10-31T21:35:01.753040+00:00: Nox78f63a919 accepted after personal paired40/41/43 and45/46/48 review: native jump/landing and action arm-extension then idle, no enemy-hit claim; 105 trusted balanced events and durable runtime release PASS. Fresh SlaveZero01a193e2-c9b5 handle89194 traces original command0x837 producer/object generation, waits current Icewind release plus actual gate. Icewind runtime213042-213044 stopped before proven guest execution because scratch guard rejected optional HTTP404 headers; no disc scan/gameplay claim, own runtime NEWFULLRELEASE213219 corrected213241. Worker still publishing; next fresh assignment must test HTTP200/404/data/blob header handling before runtime, preserving original KEY/INI/CD2. Latest late Icewind-install completion already deduped; no repeated closeout. Review20261031T2136Z-coordinator-review.
  Current update 2026-10-31T21:26:25.009609+00:00: Reviewed Nox9b2312119: sole browser stopped in loading due to scratch headerguard rejecting data:image; HTTP isolation553responses PASS, scratch sixcase oldFAIL/newPASS correction accepted, no jump/action. Durable runtime cleanup PASS. Reviewed Icewinda11833847: original native SetupComplete/Finish guestExit0,1079file470164222B closure and27CD2joins pinned; browser NoDiscDetected/GameAborted, no gameplay. All own processes durably reaped/released. Fresh Nox01a193db-0c7d handle58767 uses corrected harness for native jump/action; fresh Icewind01a193db-0c7a handle9976 determines original disc contract preserving KEY/INI and waits CURRENT Nox release before heavy work. Owner142 answered delivered1764 and accepted Nox movement photos1765/1766. Review20261031T2128Z-nox-icewind-review.
  Current update 2026-10-31T21:13:21.311497+00:00: Nox776db4c83 accepted reviewed before/held/released screenshots60/62/64: trusted right-button movement from corridor into crystal room, balanced masks0/2/0; original125-file and served module/source/compiler pins match. Supervisor143 sender unknown lost durable wait receipts; independent final21PID absence/closed ports/profile gone/FD9 free verified, no orderly shutdown claim. Fresh Nox01a193cd-d236 handle44286 first establishes durable scratch supervisor lifetime, then native Space jump/left-action after CURRENT Icewind release. Icewind01a193bf-313a handle44632 started original installer at21:06:47 after corrected safe recovery2027732992B; runtime target21:23:47 hard21:24:47 cleanup21:25:47. Cleanup filter had touched one active foreign Nox profile file; worker corrected filter/restored uncertain files, causality for143 unknown. Review20261031T2113Z-nox-review. Full27/crash sweep remain open.
  Current update 2026-10-31T20:55:59.814715+00:00: Nox4868487 generic selector catalog repair accepted with focused241app tests PASS; browser selected/served Nox but harness oneclick failed activation, no guest/gameplay. Fresh 01a193bf-2b53-7350-9e9a-c3a98c613fbb handle72425 uses registered ?candidates&app=nox_demo then native Network/Host/Bunker movement. Icewinde0a17ba recovered authenticated standalone645596503B original ZIP SHA1cc6345ae7decb43341bde25bb1302f422a42666c; extraction correctly stopped before disk floor. Fresh 01a193bf-313a-7390-8588-5508d9eca16d handle44632 owns safe lossless completed-data space recovery then native installer/closure, waits CURRENT Noxdirect NEWFULLRELEASE before heavy work. Review20261031T2056Z-nox-icewind-review.
  Current update 2026-10-31 20:45Z: Icewind8f72fa264 audit accepted: original CHITIN.KEY absent, legacy modified KEY/expanded assets cannot establish original browser movement. Terminal worker60216 replaced with fresh icewind-original-recovery-main-oct31 worker01a193b3-7160-74e0-ab26-6fddc0c58591 handle4243; authenticate standalone original package or intact guest installation, preserve prepared fixture, then ordinary installer/browser if ready. Heavy work waits CURRENT Nox01a193af-6d9c NEWFULLRELEASE and actual FD9 gate. Review20261031T2044Z-icewind-review. No runtime or gameplay acceptance from audit.
  Current update 2026-10-31 20:39Z: Nox6ae0e926a exact125-file recovery accepted; harness omitted candidates opt-in and selected Notepad, so no Nox gameplay. Fresh nox-candidates-browser-gameplay-main-oct31 handle35722 fixes launch precondition then targets original Network/Host/Bunker movement. FreeSpacecef243fdc retains uncommitted lib/wininit-boot.js and test/test-wininit-boot.js: Win98 order/error semantics unproved, no boot/runtime/game and original250-file installer checkpoint unchanged. Replaced this blocked task with fresh icewind-native-browser-gameplay-main-oct31 handle60216, targeting missing browser tavern movement beyond Party Formation/CLI acceptance. Icewind waits CURRENT Nox NEWFULLRELEASE and actual FD9 gate before all heavy work. Review20261031T2038Z-nox-wininit-review; both predecessors terminal.
  Current update 2026-10-31 20:28Z: SiN2d14f5852 reviewed aim/attack effects, health100to99, no enemy damage or exact restart cause (18.245s capture gap). FreeSpace9ed9d4b54 genuine DX7a NEEDRESTART retains250files/installerregistry; four pending WININIT replacements, no flight. Fresh Nox01a193a3-eb87 handle32489 targets missing browser gameplay after exact demo recovery; FreeSpace01a193a3-efe3 handle70944 targets generic boot completion and waits CURRENT Nox NEWFULLRELEASE for all heavy work. Review scratch/runs/20261031T2028Z-sin-freespace-review/review.json. Two production workers, serialized browser/build/heavyCLI. Earlier chronology follows.
  Next: Shogo7c510cfe0 accepted captures12/13/14 first-person street walk/Bullgut pickup/turn/fire ammo40to38; all69 owner pins match, FULLRELEASE200829. No targeted hit/kill/mission/audio/FPS, New Game/difficulty not separately captured. SlaveZeroeecf56f5c bounded review accepted: original command0x837 enters deleting destructor/stop/teardown; recursive mutex path follows original code, no defined-use emulator violation or gameplay. Missing producer/caller above EXE0x41b9bc and thread completion remain open. Fresh FreeSpace01a1939c tests retained6.34MB DirectX7a installer SHA564de93dcc50 to supply genuine missing prerequisite, then native flight if installation succeeds; waits CURRENT SiN01a19392 release plus actual FD9 wholeChrome gate. No fabricated registry stamp or compilation download. SiN01a19392 sole browser started201030 after independent currentShogo release, using native air-assault controls rather than repeated forward-walk assumption. BloodII64c9d009b published and coordinator accepted captures09/11 native elevator exit/movement/turn/pistol fire ammo50to48; owner local DEMO V1.0A BUILD109 all98files+manifest match; health100to29to0 cause unknown, no enemy hit/kill/objective/jump/audio/FPS. SiNb16c76d3c reviewed13/16/17: firstperson turning followed RESTART LEVEL; translation/fire/jump unproven, sourcepins apply tested0d9913225 before later runtime/font merge. HereticII6e91d9608 accepted walking/spell/jumping; Kingpin7d3458055 controls and Darkstone combat remain accepted. SlaveZero0d2c79f firstaudiofatal beforeNEWGAME remains undefined pendingclose; next preclose teardown initiation/completion join. Targetbuilds ALL LANES are hashes of files actually run; no7.17GBcompilation download. Review20261031T2005Z-blood2-coordinator-review; two workers onebrowser/heavyCLI, full27/crashsweep open.
  done: Recurring user priority, not complete after two games; each child task needs a working launch route, visible player-controlled gameplay, ordinary input response and a reviewed screenshot linked to its run and source.
  notes: Known freeware/shareware/demo titles first; public NFS/Diablo/StarCraft variants do not count as new games. Serialize browser and benchmark ownership; preserve review gates. Standing policy in ops/ORCHESTRATOR.md.

- [~] Inventory every game and complete gameplay screenshot/FPS coverage
  id: OPS-ALL-GAMEPLAY-COVERAGE
  status: blocked (saved runtime box stopped; owner resume required)
  reclaimed: 2026-10-07T07:42:56.312Z
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  created: 2026-10-03T08:30:54.631Z
  created-by: user via Telegram
  accepted: 2026-10-03T08:30:54.631Z
  accepted-by: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Next: Disk reserve restored; saved bx_9ef2wdsw still stopped and scoped resume403. Await owner resume for serialized scene-qualified capture/FPS validation, after independent source/evidence checks. Darkstone matching-landmark movement reviewed and trace mergedcffd439e2; no new FPS/backend correctness claim. Existing per-game evidence gaps remain explicit.
  Done: Each game has a reviewed actual-gameplay screenshot and valid scene-qualified FPS evidence, or an explicit per-game blocker with exact missing paths; menus, intros and raw Flip event rates are not gameplay FPS.
  Evidence: ops/handoffs/migration-core-ready-20261003.md

- [x] New-game lane: original Daggerfall ordinary player-controlled dungeon
  id: NEW-GAME-DAGGERFALL-20261005
  status: done
  reclaimed: 2026-10-07T07:42:56.312Z
  candidate: gog-free-elder-scrolls-daggerfall
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: /root/coverage_audit
  prev-owner: /root/coverage_audit — Codex out of credits until 2026-10-12; its uncommitted shared-tree work is preserved on archive/codex-shared-tree-20261006 (see ops/handoffs/codex-release-review-20261006.md)
  created: 2026-10-05T18:27:59.455Z
  accepted: 2026-10-05T18:27:59.455Z
  accepted-by: /root/coverage_audit
  Next: Qualified narrow ordinary dungeon movement on October7; documentation integrated remote main 724637d9, save repair fe7cfb95. Root reviewed forward/reverse/idle wall geometry in scratch/runs/20261007-daggerfall-dungeon-controls/result.json (708 artifact hashes). Runtime source3b8189/module8eb; optional bundle403 and driver exit1 preserved, clean process closure. No FPS, audio or sustained-play claim; worker refills lane.
  Done: Reviewed actual first-person dungeon and finite ordinary movement response, exact source/fixture/input receipts and cleanup; character-review screens do not count.
  Evidence: scratch/new-games-pipeline-20261005/daggerfall-reserve/activation.json; docs/re-notes/daggerfall-gog.md; tools/run-daggerfall-gameplay.js

- [x] New-game lane: Die Hard: Nakatomi Plaza demo (Piranha/Fox 2002, LithTech, Direct3D)
  id: NEW-GAME-DIEHARD-NAKATOMI-DEMO-20261006
  status: done
  reclaimed: 2026-10-07T07:42:56.312Z
  Next: Narrow ordinary player-control qualified and root accepted2026-10-07. No further gameplay retry required; FPS/audio/sustained-level remain separate coverage obligations. Refill lane Arx Fatalis source preparation.
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: /root/restore_evidence
  created: 2026-10-06T18:40:00.000Z
  candidate: test/binaries/win98-games-a-d/Diehard nacatomi demoD3D.exe (local, no download)
  Earlier: 2026-10-06T20:00Z -- installs headless (03e2f5f3 LoadLibrary system path); boots past every emulator blocker so far: 33e4ff16 (_EH_prolog EBP), b15fa588 (__p___argv/argc), 0dbe4ab6 (D3D8 16-bit mode + back-buffer view, Reset, CopyRects, A1R5G5B5/X1R5G5B5 textures; A/B on other D3D8 apps clean). lithtech.exe initializes D3D8 at 640x480x16, presents, and is on its loading screen decompressing rez data at 1.8M batches (~7 min). Notes 16191cf9 docs/re-notes/diehard-nakatomi-demo.md. Waiting on orchestrator: long local run vs boat. Then registration (apps.js + corpus-categories + manifest) and gameplay input.
  Done: registered app, reviewed gameplay screenshot with input evidence, result.json (candidateId = app id), commit on main, manifest generator command posted.
  Evidence: main236e8be9 thread-zero-poll fix; localregistration mainfea60cb9; scratch/runs/20261007-diehard-nakatomi-player-control (34hashes, four reviewed gameplay images); docs0be37005 pending root publication.

- [x] USER REPORT: Drakan demo crashes in the browser (Threads on): 'render endpoint is closed' + fs_read_file_result threw in notifyGuestWrite
  id: DRAKAN-WEB-THREADS-LAZY-CRASH-20261006
  status: done
  reclaimed: 2026-10-07T07:42:56.312Z
  note: 2026-10-06T21:25Z d3ec2640: invalidate_code_range runs with d3dim_lazy_bypass -- the page shadow no longer traps materializing a lazy D3DIM surface after a Worker ReadFile; Drakan reaches its main menu in the page with Threads on (scratch/runs/20261006T2120Z-drakan-threads-lazy). Next: fence the destination of host writes (ReadFile etc.) in the guest BEFORE the host writes so a later readback cannot overwrite file bytes read into an armed surface; regression test for that; Threads-off page check. Also: headless probe clicks/Enter do not dismiss the beta MessageBox in guest-Worker mode (renderer handleMouseDown via evalfile does) -- probe issue, pre-existing.
  note: 2026-10-06T21:00Z claude:1863d2b5 taking it.
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: /root/corpus_categories
  created: 2026-10-06T20:57:00.000Z
  Next: Completed October7: owner-side host-write fence maina1710870, actual-WASM/VFS negative control and candidate + Worker regression/full gates PASS; actual browser level personally reviewed with Threads on and off, clean process/server closure. Acceptance doc/hashes integrated mainea63ceed; ops/handoffs/drakan-threads-acceptance-20261007.json. No new movement, FPS, sound quality or PBO-warning-resolution claim.
  Done: Drakan reaches its level in the page with Threads on and off; regression test for the lazy read completion in Worker mode; commit on main.
  Evidence: user Telegram 2026-10-06T20:5xZ (log pasted in the orchestrator session)


## GL/D3D reconciliation — October 7

- [ ] GL/Direct3D corpus: every 3D app works on software and WebGL
  id: GLD3D-CORPUS-27-20261006
  Current update 2026-11-04T03:45Z: GLTron5a200e267 paired original gameplay accepted. MDK24c1ecd939 original attract only; fresh offline menu-cause tests inspected selection before another runtime. Darkstoneff970b100 Town/FManual owning software endpoint verified, Ardyl transition black/combat unproven; fresh leased native combat follows. Legacyc6884b098 both actual modules480directWebGL/1440queued Worker exactRGB each and40rendered negatives total accepted on WebGL2 SwiftShader; fresh explicit WebGL1 followup01a1a4ac-cb36 active, physicalGPU unknown. Exact historical27 membership, both-backend per-title gameplay and broader crash freedom remain open; rejected queued-texture diagnostic excluded.
  Current update2026-11-04T02:49Z: de461ff9a genuine D3D7 mip chains and original DarkReign2 selected-unit WebGL2 movement reviewed; owning WebGL1/2 each37pixels and fullbuild pass. Keyed cross-level mips unsupported. Fresh GLTron current original software/WebGL trail-shadow gameplay worker01a1a46f-dccb-74e0-9611-493bc26b5c96 session76507 on bx_92ssqvkw expiry03:42:18Z/recovery03:32Z coordinator shutdown; persistent original console history is expected behavior, not a repair target. MDK2 rightdummy defeat accepted8f9ff6d4c; fresh recovery01a1a46e continues existing leftdummy browser after predecessor143/no final, causeUNKNOWN. GL/D3D full corpus/backend coverage/crash freedom remain open; rejected queued-texture diagnostic is not retried.
  Current update 2026-11-04T01:50Z: fd1b3e0c6 verifies DeusEx count8 reload and stable low wood/native count10; root108files fullSHA and gameplay17/19/32 inspected, intermediate26blank excluded. Both-backend gameplay remains open. Alice1188e9bf5 timeout not reproduced, original cause UNKNOWN/no repair. Graphics queued-texture worker01a1a435 exited1 after automatic cybersecurity review rejection; no final/repair accepted and no retry/rephrasing/delegation. Partial evidence snapshot preserved, box normal STOPPED. Independent Dark Reign2 paired-backend original unit movement01a1a43c-691e-7362-997d-349adb7bbf01 replaces that lane, not the rejected diagnostic. Legacy1329b1ba6 public cube rejection/BORDER fallback remains scoped; no historical27 completion claim.
  Current update 2026-11-04T01:20Z: Published cb5fb1b716 repairs MDK2 local selector and verifies original browser/WebGL1 NewGame/Medium, Up/Down movement and reversible Space Sniper Bullet. Root inspected five gameplay captures and independently SHA256-verified all740 recovered files/BOTH modules cffca869/580f49f3; compatibility module was recovered, not a second browser execution. Focused regressions and locked build PASS. Final Down WM_KEYUP remained queued and deadline quit got no reply; no terminal-drain/ordinary-quit claim. Named snapshot verified and actual normal STOP bx_j37q6y9a01:18:38.420Z. Alice01a1a404 now has sole runtime release for changed timeout diagnostic; fresh MDK2 jump/fire01a1a423 prepares only until explicit release. Legacy be2fc9746 bounded sampler remains accepted; exact historical27 membership, per-title both-backend gameplay, jumping/shooting and broader crash freedom remain open.
  Current update 2026-11-03T13:15Z: Reviewed7baae9487 corrects raw Worker drawable records and serializable software response metadata. Original old-fail/new-pass assertions,17 scoped checks and locked build passed;169 archived payloads and286 closeout files SHA-verified, own boat normal STOPPED with snapshot. Review scratch/runs/20261103-coordinator-gl-drawable-review/. This covers that concrete Worker fixture/response bug; historical27 membership, per-title software/WebGL gameplay and broader crash-freedom remain unproven. Current two slots preserve Alice/Jedi gameplay lanes, Jedi temporarily repairing staging without a guest.
  Current update 2026-11-01T16:12Z: Published32c49ed87 extends scoped evidence to actual D3D9 COM calls through immutable shared queue, native software WAT and canonical Present. Existing test/test-d3d9-software-bridge.js passed18.422s with273 input hashes unchanged, including caller-buffer mutation, material/light RGBA, disabled light, emissive, viewport/stateblock/scissor coverage and retirement. Run scratch/runs/20261101-d3d9-com-software-pixels/; docs/re-notes/d3d9-com-software-pixels-20261101.md. This closes a direct-call-only evidence gap for this fixture; full historical27 membership and both-backend gameplay remain open.
  Current update 2026-11-01T13:48:06.863615+00:00: Existing actual-WAT D3D9 software lighting test PASS36pixelcases plus malformed descriptor rejection and allocation retirement in4.450s;289input pins unchanged. docs/re-notes/d3d9-native-lighting-pixels-20261101.md records scope and corrected game gate. No Windows API end-to-end/GPU/full27/FPS/audio/crash-freedom claim.
  Current update 2026-11-01T13:27:48.222903+00:00: QuakeII8f2f8a802 native eighth kill reviewed with four captures and21HP; checkpoint onward pending. ThiefII alternate route active, fresh QuakeII queued. Existing fixture scopes/full27/backend/FPS/audio/crash-freedom limits unchanged.
  Current update 2026-11-01T13:14:07.256798+00:00: ThiefII e6814d7b attempted-route window blocker reviewed without interaction. QuakeII opened mechanical door and identified guard; outcome pending. Fresh ThiefII alternate route queued. Accepted native fixtures retain scoped evidence; full27/backend/FPS/audio/crash freedom remain unproven.
  Current update 2026-11-01T12:58:56.250636+00:00: Accepted native transform/lighting0a33e2db4 and stencil/depth3fc209ff3 retain their scoped contract/software-pixel evidence and module-comparison limits. Dark Reign2 dd82ceb03 unit movement and Rayman2 065d2c683 movement/jump reviewed. HereticII f581e849f attempted-route crate blocker; QuakeII90aa4059d native restore21HP7kills reviewed, no encounter outcome. ThiefII interaction owns runtime; fresh QuakeII continuation queued behind release. Exact historical27 membership, per-title/backend coverage, FPS/audio and crash freedom remain unproven. Reuse accepted checks unless inputs change or a specific gap warrants rerun.
  Current update 2026-11-01T06:45:26.144370+00:00: Reviewed actual WAT software mipmap8/8 and texgen9/9 PASS unchanged pixel assertions, sequential timeout120s, noteea9b18ae9. Independent4390source hashes MATCH all5 ownPIDs absent. Actual WAT noncustom sections match canonical build; metadata differs only. No GPU/full27 qualification. Evidence scratch/runs/20261101-gl-software-texture-current-gate/. Redline movement retry active; Tachyon onward queued, cap2 serialized runtime.
  Current update 2026-11-01T06:41:28.123172+00:00: Tachyon local original flight throttle/turn/fire reviewed f1f9faf19, no full27/backend parity claim. Redline e06fe9784 capture chooser fixed, postfix movement unverified. Fresh GL01a195d6 handle17476 actual WAT software mipmap/texgen pixel assertions queued behind Redline runtime release; no tests run yet, gate-open current baseline required. Browser/held-algorithm exclusions unchanged.
  Current update 2026-11-01T04:54:31.835477+00:00: Rune12493534 generic timer handoff fix passes real regression/mandatorybuild and first main menu inspected; ordinary NewGame/map remains next, no gameplay qualification. Fresh Rune01a19575 prepares offline behind Redline01a19569 archive-member runtime. Full27/backend/FPS/audio/crash freedom and browser/REP holds remain open.
  Current update 2026-11-01T04:31:47.069437+00:00: Rune6af01e35d proves correct Galaxy release then same-turn reacquisition with main parked, not missing release. Fresh timer-handoff investigation01a19560 offline behind Redline01a19556 sole runtime selected-loader trace. Full27/backend/FPS/audio/crash freedom and browser/REP holds remain open.
  Current update 2026-11-01T04:21:25.758651+00:00: Redline backend identity now proven but first selected-loader failure unresolved; fresh01a19556 scratch-only isolated retention. Rune01a1954c sole runtime observes Galaxy mixer lock ownership after04:19:41 gate. Full27/backend/FPS/audio/crash freedom open; browser/REP holds unchanged.
  Current update 2026-11-01T04:10:06.559925+00:00: Rune input destination is proven correct; Galaxy critical-section owner continuation blocks menu/gameplay. Fresh Rune01a1954c scratch-only behind Redline01a19546 selected-texture upload causal trace. Full27/backend/FPS/audio/crash freedom remain open; accepted gaps and browser/REP holds unchanged.
  Current update 2026-11-01T04:03:06.880856+00:00: Two active new-title lanes continue: Redline3f458cead establishes unrealized selected gameplay textures before pool binding; first loader failure remains next. Runeef35ed520 fixes stale dialog Escape swallowing, but polling destination0 still blocks menu/gameplay. Fresh backend Redline01a19546 is scratch-only behind Rune01a1953c sole runtime. Full27/backend/FPS/audio and crash freedom remain open; accepted backend gaps and browser/REP holds unchanged.
  Current update 2026-11-01T02:41:18.846722+00:00: Reviewed Runeac80c5c4d and actual software-only wizard PNG, published6b5d59f5f. Exact original renderer child executes then fails MisingIni/appInit before renderer result, despite original INIs in exported tree; lookup cause unknown. Both child cleanups required SIGKILL, all assigned PIDs gone; absent output merged203deletions only into disposable parent VFS, not original disk. No Next/gameplay/Detected.log. Fresh Redline01a194fb handle53345 traces missioncallback/dispatch; next Rune childINI/transport diagnosis. Incoming95b5a2440 runtime merged after Rune testing; retained2be3cebaa belongs accepted9ba runtime, not new main.
  Current update 2026-11-01T02:34:04.405963+00:00: Redline1dd8b642 original CLI reaches reviewed mission selection, no gameplay; bounded run3 stalls with main active, queued input and unknown callback cause. Rune renderer-child followup01a194f4 handle75872 is sole live runtime worker, deadline03:03UTC fallback02:43UTC. Published constructor9ba1c215c build/tests remain accepted; full27/GPU/crash freedom open. Browser authorized transfer and REP holds unchanged.
  Current update 2026-11-01T02:25:31.537956+00:00: Published9ba1c215c constructor repair and exact pending census review accepted; mandatory build and original scoped/scheduler/park/options PASS. Rune36592af3b original CLI reaches inspected graphics wizard, child renderer test acknowledged but not executed (spawnProcesses off), no gameplay. Existing --spawn-processes is next Rune followup. Redline worker01a194ec-d4e8-7ff1-80cc-38b133061347 output scratch/usage-watch/redline-original-cli-progress-nov01/ handle83894 pursues original local CLI DISPLAY/Play/input; deadline02:55UTC fallback02:35UTC. No live browser/box. Full27/GPU/gameplay/crash freedom open; REP held; authorized browser transfer unresolved.
  Observed gameplay (updated 2026-10-31): QuakeII original browser ref_gl/WebGL1 reached seven kills at health21; native F6 checkpoint exported as eight files and restored byte-for-byte in a fresh browser (run20261031T0055Z-quake2-courtyard). Root inspected seventh-kills.png and verification.json: 65 original assets, 424 served responses and external remount pass. Observed renderer is ANGLE Intel Mesa UHD620, software flag0; retained moduled69d1158 has unknown compiled-source identity. Later doorway attempt found no eighth kill and recovered the retained21HP/7-kill checkpoint (run20261031T0213Z-quake2-door); level completion remains open. Earlier GLTron original browser WebGL round reached crash/winner and native restart (run20261030T2230Z-gltron-browser, module7e8d3194, notes802fc9e66). Four screensaver apps retain bounded software observations in20261030T2226Z-d3drm-four-scenes: Architecture/RockRoll/OrganicArt recognizable scenes, Jazz partial; retained1dbddeaf predates current main. These observations do not establish current-main parity or full27 coverage.
  note: 2026-10-31T04:00Z bounded original Forsaken software route reached inspected Volcano briefing/loading scene at1129batches/60.030s; firing scheduled1180 was not reached, so no movement/combat acceptance. All876 original/runtime input hashes unchanged; retained module7f9da4e9 compiledsource unknown, run20261031T0400Z-forsaken-volcano. Fresh worker pursues actual browser gameplay past briefing. Daikatana route80b11f423 preserved without verified exit; Pirates8581ed6dd records effective-state boundary and generic page crashes without production cause/fix.
  status: active (UT2003 repair/UT2004 WebGL/Forsaken movement accepted; Pirates textured coast repaired/native landing party accepted; full27 both-backend coverage incomplete)
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  worker: FOUR independent lanes: MDK2 browser jump/fire01a1a423; Stronghold browser village01a1a43c-3b52; Dark Reign2 paired movement01a1a43c-691e; fresh DeusEx low-wood reload. Independent leased runtimes only; shared full builds flock-serialized. Gates checked immediately before each launch.
  prev-owner: claude:1863d2b5-bc58-4c0b-9c15-00fc951f0256 (fleet stopped)
  created: 2026-10-06T02:09:48.337Z
  accepted-by: claude:80aa9e95-435b-4acb-aeea-8ae3d860613c
  Next: MDK2081a33477 ordinary movement/sniper and legacybe2fc9746 public-COM rendered sampler coverage accepted. Full historical27 membership, per-title both-backend/browser gameplay and remaining crashes remain open. Current gameplay lanes are Alice observed desktop timeout, MDK2 browser jump/fire and DeusEx saved-footing traversal; queued texture lifetime crash sweep targets one uncovered release/delete/reuse transition, avoids duplicating accepted suites, and must fix/test/publish any concrete bug in the same task; do not select an arbitrary27 set. No source snapshots or duplicate evidence media. Latest disk receipt00:07:56Z is7869976576B free, below owner8GB target but above2GB floor.
  note: 2026-10-30T21:09Z coordinator: Main1beaec304 fixes SDL GetProcAddress fallback advertising unsupported compiled-array extensions. Material Begin/End lighting/validation/display-list repair27d8413c6 is on main with locked build and focused GL tests passing. Original Frozen River real-ticks run (module9e37f0f1 matching repaired sources; run20261030T2127Z-tuxracer-closeout) verifies actual Left/Right/Up dispatch and SDL0->1->0, inspected turns and120-second checkpoint fish8/speed11/time01:46.79, exit0. Root inspected frame and delivered Telegram1650. All140 retained files SHA verified; Boat snapshot verified STOPPED before expiry. Subsequent original Frozen River native software run finished Practice RaceOver02:08.45/Herring17/Score0 and native Enter returned to matching best-result selection (run20261030T2133Z-tuxracer-finish, source27d8413c6/module69bd55de/runnerc82398cf,158 original assets verified). Root inspected finish frame and delivered Telegram1651; notesf0d0831aaa pushed, locked build/material-display-list tests passed. Successful run222.773s exited0, own processes/control port cleaned, no Boat. Earlier controller SIGTERM retained without finish claim. Original browser/WebGL FrozenRiver Practice also finished01:29.76/Herring8/Score623 with native Enter returning matching best result (run20261030T2145Z-tuxracer-browser, original module69bd55de and158 verified assets). Root inspected RaceOver frame and delivered Telegram1653. Repair8f6c7bec9 on main restores GLU power-of-two texture resizing, eliminating opaque tree billboards; focused tests, WebGL1/2 pixel checks, display-list tests and locked build passed. Extra GLU-scale suite retains a pre-existing API-table hash assertion before scale cases. Exact race/final frontend distinction retained in source manifests; cleanup verified, no Boat. Hardware GPU, full-scene parity, competitive timing/audio/performance remain unqualified. Original CaesarIII browser city gameplay subsequently built roads/housing/well/prefecture and population0->45; inspected Large tent has7occupants at September population41 (run20261030T2200Z-caesar3-city, source d4fb06b46/module1dbddeaf, documentation4ed5e6dd1 on origin/main). Root inspected occupied-tent screenshot and delivered Telegram1655. Focused gameplay and locked build passed, but later build module differs from pinned gameplay due concurrentGL edits; manifest retains distinction. Own browsers/servers stopped, no Boat. Population150 objective/services remain incomplete; this2D city does not qualify a GL/D3D backend. Fresh QuakeII browser gameplay worker1018201 takes the freed slot. Darkstone original registered demo now verifies native left-click Town-to-Land of Ardyl transition on software and WebGL, plus visible software player locomotion across a clearing (run20261030T2110Z-darkstone-locomotion; notes7066a1433). Retained sourceba96fc3ad/module6085eff5, all15 assets and1292 served files pinned; actual consumed mouse messages and owning draw progress retained. Root inspected clearing frame and delivered Telegram1649. Software clean exit0; WebGL143 cause unknown, exact owned Chrome cleanup verified. Subsequent committed-main repair328b6631a restores legacy texture-combiner diffuse alpha instead of opaque foreground trees/palisade; focused native/GPU descriptor tests, rejecting mutation, texture-wrap tests and locked build passed. Original WebGL and software Town/Ardyl runs on module4649ee5f verify translucent foreground and native movement beside birch (run20261030T2124Z-darkstone-occlusion); root inspected repaired WebGL frame and delivered Telegram1652. Notes10952264c and repair verified on origin/main; owned browsers/server cleaned, quit acknowledged but outer143 cause unknown. Original WebGL skeleton combat then showed enemy death and surviving player LIFE32/35, MANA25/25, nonzero EXP (run20261030T2158Z-darkstone-combat, documentation dc988e7cb, same committed module4649ee5f and15 unchanged assets). Root inspected inventory frame; automatic engagement preceded held-left input, so sole-click causality is not established. Fresh worker1005873 pursues software manual combat. Full-scene backend parity, software combat/audio/FPS and historical27 membership remain unproven. GLTron production repair d4fb06b46 on main fixes CRT/import corruption and missing GL calls; focused tests and locked build passed. Original92 assets verified, software module1dbddeaf ran180s with native Return/A/S/Escape through menus, light-cycle gameplay, crash/winner and menu return without guest trap (run20261030T2141Z-gltron-main-gameplay). Root inspected arena frame, Telegram1654 delivered. Software white/black trail/shadow artifacts remain; fresh worker1004734 repairs them. Browser/audio/parity unqualified; local cleanup verified, no Boat. Enigma Chrome Tutorial2 completed and automatically reached inspected Tutorial3 (run20261030T2059Z-enigma-level2, source934fd8290/moduleaa2bf6fa; Telegram1646); this2D result does not qualify a GL/D3D backend. Sole Tux/Enigma Boats snapshot-verified STOPPED; Darkstone local Chrome/server cleanup verified, outer143 teardown unexplained. Both-backend gameplay for the full27 remains open.
  note: 2026-10-31 ReVolt59a615fc5 repairs preDX7 attachment lookup; known-source before/after locked builds and focused regressions, inspected race-accelerate.png native acceleration/steering but overturned/no lap. Run20261031T0403Z-revolt-backbuffer retained8459597 exact dirty source snapshot. UT2004 native match verified; Forsaken50bb30050 confirms known-source GPU stale pixels with no cause/repair established; Deus Ex940371775 default-worker browser door traversal accepted; Pirates a7725adaf known-source native sailing reviewed; four matching sequences preserve attached properties, ordinary maps empty and separate maps populated. Accepted83ae79866 original separate-map writer/encoded reader contract; four same-mesh triples and two actual draw correlations, native-coast.png inspected. Intended shader/pass selection remains unproved. Fresh selection worker01a19073-4c9b-78d0-a1f4-b40c63f5da5c launcher1601892 bound35min deadline0610UTC; no crash reproduced or repair claimed. Full27 both-backend qualification remains open.
  note: 2026-10-31 fresh coordinator reviewed Forsaken598564490 and explicit/combat-final.png: native movement/fire/ammo consumption and player death are observed, but retained briefing fragments/overbrightness prevent readable sustained gameplay. Module7f9da4e9 compiled source unknown; no production fix or full backend acceptance. Run20261031T0401Z-forsaken-play.
  Done: Status table for the full GL/D3D set in docs (software + WebGL per app, with run ids), and each fixed app has a reviewed in-game screenshot and commit on main.
  Evidence: memory project_gl_d3d_corpus_goal (27-app set, 2026-09-22); tools/gfx-app-census.js; tools/gl-name-census.js
- [ ] D3DIM async-flip PBO trips Chrome "READ-usage buffer written again before being read back"
  id: D3DIM-ASYNC-PBO-WARN-20261006
  status: blocked
  note: 2026-10-06T21:25Z parked at WIND-DOWN, not started. Next: page probe on MW3 menu wrapping the D3DIM executor's readPixels/fenceSync/getBufferSubData (lib/d3dim-gpu.js asyncFlip path) to find which PBO is written again before its readback; likely reuse of one PIXEL_PACK_BUFFER across flips while an earlier read is inflight -> ring of PBOs or wait on the fence before reuse.
  note: 2026-10-06T20:25Z claude:1863d2b5 claimed: code read finds no write-before-read path; next a page probe wrapping readPixels/fenceSync/getBufferSubData on MW3's live context (browser queue).
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  prev-owner: claude:1863d2b5-bc58-4c0b-9c15-00fc951f0256 (my change, fcfa4989) (fleet stopped)
  created: 2026-10-06T20:20:00Z
  Next: Warning isolated outside emulator: Chrome151 standalone4x4 WebGL2 yields six identical warnings despite8 correct pixel readbacks/GL_NO_ERROR. Matching browser source retains readback shadow allocation in GetBufferSubDataCHROMIUM path. Emulator trace216writes215reads has zero overwrite violations; one pending at capture end. No speculative renderer fix. Browser warning remains; no user input required. Recheck after browser-side correction; performance impact unmeasured. Receipt ops/handoffs/pbo-chrome151-reproduction-20261007.json.
  Evidence: scratch/runs/20261006T1935Z-gld3d-webgl-recheck/c/mw3-2.console

- [x] New-game lane: Croc 2 demo (Fox Interactive / Argonaut 1999, software 3D platformer)
  id: NEW-GAME-CROC2-DEMO-20261006
  status: done
  reparked: 2026-10-06T16:20Z -- second look (e37aa7c6 re-notes): D3DDevice/DisplayDevice seeds select a hardware D3D record but the game stays on its software renderer (no CreateDevice); Demo Mode at ~8 presents/s with defaults; at tick 10 the picture freezes ~120k with main computing and T2 in InterlockedExchange+CS. Not a clock artifact alone. Next: what main waits on (T2 handshake).
  resumed: 2026-10-06T16:00Z by claude:d10ba697 -- testing whether the black front end after Enter is the headless 200ms/batch clock (menu idle timeout) rather than a render bug.
  candidate: win98-games-a-d/Croc2DemoSW-D3D.exe (local, no download)
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: /root/coverage_audit
  prev-owner: claude:d10ba697-f69c-4855-aeff-e6a61b6e2735 (fleet stopped)
  created: 2026-10-06T05:27:48.000Z
  accepted-by: claude:80aa9e95-435b-4acb-aeea-8ae3d860613c
  Next: Completed narrow ordinary Jungle movement/reversal/settled idle, personally reviewed by root; main20bdd9c6 registration and600be49b findings. Evidence scratch/runs/20261007-croc2-jungle-controls/result.json, 500 artifact hashes, exit0/clean closure. No FPS/audio/sustained-play claim. Refill lane with Antara source investigation.
  Done: Working registered launch, ordinary player input visibly changes actual gameplay, reviewed gameplay screenshot with run/source identity, scoped fixes + tests on main. FPS, audio and browser separate.
  Evidence: scratch/new-game-croc2-20261006 (work), scratch/runs/<id> (reviewed captures)

- [~] Run DOSBox-packaged games directly in ToyVM for the dedicated DOS production route
  id: TOYVM-DOS-NATIVE-GAMEPLAY-20261007
  status: active
  Browser input: absolute mouse position, button transitions and polling deltas wired through shared launchers; focused DOM/INT33-state fixtures only. No browser gameplay acceptance, pointer lock/relative input, wheel, guest-programmed ranges or mouse callbacks. Native gameplay and existing per-title blockers remain open.
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  worker: /root
  created: 2026-10-07T09:08:16.475Z
  requested-by: user via Telegram, dedicated DOS VM preferred over DOSBox inside Win98
  Next: Reviewed CALL gate/RETF and hidden segment cache repair integrated4f1e083b/fcd391dd, fallback tests/bundlesc2cded63.36 targeted cases,16 real/VM86 cases, four existingCPU suites, full backend-install and bundle checks PASS;92 integrated source pins match tested tree. Recheck original Daggerfall extender next with bounded correctness run; paging/earlier invalid stack remain unresolved, ArenaCD/U4world still open. No native gameplay qualification.
  Done: Every DOSBox-packaged corpus title has a direct dedicated-DOS/ToyVM launch route with ordinary player-controlled gameplay, reviewed native screenshot and source/run identity, sound/input/save validation and honest FPS evidence or explicit remaining per-title blockers. Implement compatibility gaps rather than substituting DOSBox wrapper evidence. Main dashboard clearly distinguishes native and Win98+DOSBox results, routes to the native player when supported, and exposes required/lazy loading and actionable errors. Scoped fixes/tests integrated to main; no public deployment.
  Evidence: test/toyvm-dos-corpus/manifest.json; test/toyvm-dos-corpus/titles.json; ops/dos-corpus.json; tools/toyvm-dos-corpus.js; user instruction2026-10-07. Daggerfall/Arena DOSBox gameplay does not establish native compatibility.
- [~] New-game lane: Betrayal in Antara demo (Sierra 1997, SCI32 RPG)
  id: NEW-GAME-BETRAYAL-ANTARA-DEMO-20261006
  status: blocked
  candidate: win98-games-a-d/Betrayl-a-Antara-DEMO-SW (16-bit Sierra SETUP.EXE installs the game; local, no download)
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  worker: none (automatic security rejection; exited1)
  created: 2026-10-06T04:51:54.000Z
  accepted-by: claude:80aa9e95-435b-4acb-aeea-8ae3d860613c
  Next: Hold rejected crash diagnostic; no retry/rephrase. WIP preserved, remote bx_fugmje42 authoritatively stopped after expiry, full cleanup/evidence retrieval incomplete. See ops/handoffs/antara-security-hold-20261008.md. No installation/gameplay qualification.
  Done: Working registered launch, ordinary player input visibly changes actual gameplay, reviewed gameplay screenshot with run/source identity, scoped fixes + tests on main. FPS, audio and browser separate.
  Evidence: scratch/new-game-antara-20261006 (work), scratch/runs/<id> (reviewed captures)

- [ ] New-game lane: Arx Fatalis demo (original local MSI/CAB media)
  id: NEW-GAME-ARX-FATALIS-DEMO-20261007
  status: blocked
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  worker: none; arx-fault exited1
  candidate: test/binaries/win98-games-a-d/Arx_Fatalis-demo-D3D-Glide
  Next: Automated possible-cybersecurity-risk rejection stopped diagnostic; no retry/rephrase. Root cleaned remote and preserved scratch/runs/20261007-arx-diagnostic-interrupted. Prior introAV unresolved; Darkstone refills lane.
  Done: Original asset closure registered locally, ordinary reviewed player scene and control evidence, scoped tested fixes integrated on main; no FPS claim without separate measurement.
  Evidence: scratch/wt-diehard-20261007/scratch/refill-after-diehard/shortlist.json; original ARX.exe SHAebd3e2b3; no currentmain registration or historical qualified run found.

- [x] Additional game lane: Carmageddon TDR2000 demo
  id: NEW-GAME-TDR2000-DEMO-20261007
  status: done
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: fresh CLI tdr (scratch/fresh-workers-20261007)
  candidate: test/binaries/win98-games-a-d/Carmageddon TDR2000 demo-D3D
  requested-by: user Telegram two more games in parallel, 2026-10-07
  Next: Completed mainb7cdb5fd: durable local-only registry/manifest, exact2963rows (148required/2815lazy), focused tests and fail-closed diskguard. Ordinary actualrace forward/reverse/brake screenshots reviewed; evidence1124777f, sentTelegram851/852. FPS/audio unmeasured; no public deployment.
  Done: Faithful registered launch, ordinary player-controlled gameplay, reviewed screenshot with source/run identity and scoped tested changes on main; audio/FPS claims require separate evidence.

- [~] Additional game lane: Comanche 3 demo
  id: NEW-GAME-COMANCHE3-DEMO-20261007
  status: done
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: none (comanche-catalog exited0; root integration review passed)
  candidate: test/binaries/win98-games-a-d/Commanche3-demo-SW
  requested-by: user Telegram two more games in parallel, 2026-10-07
  depends-on: TOYVM-386-PAGING-20261007
  Next: Complete scoped original controlled flight plus normal registered ToyVM dashboard launch. Root verified245 flight and21 startup artifact hashes, reviewed startup image, and passed29 ops/launcher plus22 generator cases. Eleven originals remain gitignored; no private route required. No public deployment or current live8098 claim; FPS/audio/combat/mission completion remain unqualified.
  Done: Faithful registered launch, ordinary player-controlled gameplay, reviewed screenshot with source/run identity and scoped tested changes on main; audio/FPS claims require separate evidence.

- [x] Quake II WebGL ordinary world movement validation
  id: GLD3D-QUAKE2-TRAVERSAL-20261007
  status: done
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: none (fresh q2-gl-validation completed)
  Next: Completed main2534731b3: fb1be916 ordinary Game/Easy/W/S/idle worldtranslation personally reviewed byroot. Sixscreens/38artifacts contained and present; Telegramphotos860/861 sent. Actualbrowser/driver cleanclosure,16ancillaryVLANAPIrefusals retained; FPS/audio/network unqualified.
  Done: Current source/host/run identity, reviewed actual gameplay and input movement, scoped corpus table update on main; FPS/audio separate.

- [x] Implement generic 386 paging for original DOS extenders
  id: TOYVM-386-PAGING-20261007
  handoff: ops/handoffs/toyvm-paging-implementation-20261007.md
  status: done
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: none (fresh toyvm-paging-integrate completed)
  Next: Complete main72e306790 with foundation4b0955e79. All47 correctness groups passed; root verified1495 artifacts and integrated source pins. Original authenticated16KiB copy maps correctly and preservesIVT, progresses Loading Install for75s without CPU faults; installation/gameplay remain separate.
  Evidence: docs/re-notes/comanche3-later-execution-20261007.md; scratch/runs/20261007-comanche3-paging-diagnostic/evidence-index.json; source emit.js dropsCR3 and maskslinear24bits.
  Done: Generic paging correctness reviewed with fault semantics and original Comanche startup progressing beyond paged copy; no gameplay claim without ordinary control evidence.

- [ ] New-game lane: Command & Conquer: Tiberian Sun demo
  id: NEW-GAME-TIBERIAN-SUN-DEMO-20261006
  status: blocked
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  worker: none (bad-transfer worker exited1 at2026-10-08T13:02:23.732Z after automatic cybersecurity rejection)
  candidate: test/binaries/win98-games-a-d/CnC-TiberianSun-demo-SW/extracted
  Next: Parent10002 DirectDraw repaint loop and registered COM shadow-CPU activation repaired, including AddRef ULONG edge correction; root11182 hashes and real owner/paint regressions passed. Ordinary campaign loading now reaches first OleRun, then owning trap atEIP00d88176/ESP00d88168 in heap frame data. Next capture first bad control-flow producer, including activation continuation integrity; do not assume an independent guest defect or redo cleared menu/COM causes. Final AddRef edge tested/build-only d8d4096 differs from actual browser ff3281; gameplay still unqualified.
  Evidence: Shared historical task and fresh worker title audit2026-10-07. Darkstone already has controlledTown/camera evidence, so it is not rerun or counted as a new title. Tiberian Sun remains nonpublic and unqualified.
  Done: Registered original launch reaches a mission, ordinary input visibly commands units, reviewed screenshot with exact source/run identity, scoped tested changes pushed main. FPS/audio require separate evidence.
  Blocker: Diagnostic preparation was rejected automatically for possible cybersecurity risk. No retry, rephrasing, or delegation of rejected operation. Existing work preserved; no new gameplay evidence.

- [~] Diagnose original Winamp MilkDrop exception and validate visualization
  id: GLD3D-WINAMP-EXCEPTION-20261007
  status: blocked
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  worker: none (worker exited1 after automated rejection)
  Next: HELD: automated cybersecurity-risk rejection terminated Winamp diagnostic worker at23:52:06. No retry/rephrasing/delegation of rejected diagnostic. Root recovered14 existing outputs and verified driver/browser exited; no exception cause or visualization qualification.
  Done: Demonstrated generic cause repaired with regression and ordinary original visualization reviewed; FPS/audio separate.
  Evidence: scratch/runs/20261007-winamp-milkdrop-complete-closure; ops/handoffs/winamp-milkdrop-ordinary-20261007.md

- [x] Validate original Quake II OpenGL workload on emulator software backend
  id: GLD3D-QUAKE2-SOFTWARE-20261007
  status: done
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: none (q2-software exited0)
  Next: Done scoped software forward/reverse/idle gameplay, reviewed original ref_gl and owning renderer software proof; main069662726. Exact reference096889e/fb1be916, not current-main build validation. FPS/audio/network unqualified.
  Done: Reviewed ordinary gameplay/input evidence, exact backend/source/module/original identity, scoped GL table update on main; FPS/audio separate.
  Evidence: scratch/runs/20261008T000901Z-quake2-software-ordinary; ops/handoffs/quake2-software-ordinary-20261008.md

- [x] Validate Crimsonland Tutorial control on WebGL
  id: GLD3D-CRIMSONLAND-WEBGL-20261008
  status: done
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: none (crimsonland-relative-input exited0)
  Next: Done scoped WebGL Tutorial movement and relative aiming; root reviewed3images and100contained hashes. Integrated6f4f74b19. Original referencef62/module4dc5; no engine patch. FPS/audio/combat/long-session qualification remain separate.
  Done: Reviewed ordinary gameplay/input with actual WebGL backend and original source/module/media identity; GL table and scoped changes on main.
  Evidence: scratch/runs/20261008T0105Z-crimsonland-relative-input; ops/handoffs/crimsonland-relative-input-20261008.md; Telegram879.

- [~] Validate Alien Shooter Mission 01 control on WebGL
  id: GLD3D-ALIEN-SHOOTER-WEBGL-20261008
  status: done
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: completed; actual exit0 2026-10-08T01:26:18Z
  Next: Complete scoped WebGL Mission01 movement/aiming acceptance; root reviewed images/backend and all109 contained hashes. Findings integrated bf8d2e134; run20261008T0114Z-alien-shooter-webgl. No FPS/audio/combat-completion or current-main runtime claim.
  Done: Reviewed actual Mission01 ordinary player movement and aim on owning WebGL backend, source/module/originalmedia identities, scoped commits and GL table on main.
  Evidence: historical software scratch/runs/20261006T0612Z-alien_shooter-w4-gameplay2; reviewed WebGL scratch/runs/20261008T0114Z-alien-shooter-webgl.

- [x] Warcraft III original Prologue ordinary WebGL gameplay
  id: GLD3D-WARCRAFT3-PROLOGUE-20261008
  status: done
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: none (exited0; coordinator review passed)
  Next: Complete scoped WebGL Prologue gameplay validation: root reviewed Thrall selection and two opposing ordinary right-click moves against fixed terrain; 675 contained artifact hashes pass. Run20261008T0156Z-warcraft3-campaign-world-runtime, referencef62/module4dc5. No FPS/audio/combat/campaign-completion claim.
  Done: Reviewed original Prologue ordinary unit selection/move evidence with exact source/backend, scoped fixes tested and pushed; FPS/audio separate.

- [x] Warcraft III original Prologue software-backend gameplay
  id: GLD3D-WARCRAFT3-SOFTWARE-20261008
  status: done
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: none (worker exited0; root review PASS)
  Next: Complete: root reviewed software Thrall selection/two opposing moves with matching host/owning OpenGL software backend;666 contained hashes and helper negative/review contracts PASS. Integrated0d9515322; run0400 referencef62/module4dc5. FPS/audio/combat/campaigncompletion/current-main runtime remain unverified.
  Done: Reviewed software gameplay/control images and owning backend/module/source evidence, scoped fixes/tests if needed, pushed main.

- [x] Expose real held keyboard controls in ToyVM web sessions
  id: TOYVM-HELD-KEY-WEB-20261008
  status: done
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: none (fresh toyvm-held-key-web exited0 07:08:27)
  Next: Complete on main d87b54eca. Root180 contained evidence hashes and held/released/mission-menu captures verified; actual Machine/LiveRun tests and bundle reproducibility pass. Browser initial lifecycle closure proves ordinary holds, release, repeat, blur and Stop. Final keypad/code mapping and modifier-wait corrections unit/full-build tested but not original-media browser rerun. No production deployment or Comanche cockpit/gameplay qualification.
  Evidence: tools/toyvm/dos.js pushKey; tools/toyvm/live.js key; ops/toyvm-live/live.js canvas keydown; tools/toyvm/site.js generated canvas handler; native Comanche roster response with held input.
  Done: Meaningful key press/release and focus-loss tests plus reviewed browser held-input game response; scoped source/bundles/site changes pushed to main.

- [x] Gameplay screenshot and FPS: Arcanum: Of Steamworks & Magick Obscura Demo
  id: GAMEPLAY-arcanum-demo
  status: done

  candidate: arcanum-demo
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  worker: none (software measurement accepted on main ab0f4ec508; stale backlog reconciled 2026-11-03)
  prev-owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5 — Codex out of credits until 2026-10-12; its uncommitted shared-tree work is preserved on archive/codex-shared-tree-20261006 (see ops/handoffs/codex-release-review-20261006.md)
  created: 2026-10-03T08:42:45.967Z
  accepted: 2026-10-03T08:42:45.967Z
  accepted-by: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Next: Complete for the tested historical builds. Ordinary crash-site movement on software/WebGL was reviewed with336 contained hashes. Accepted software follow-up ab0f4ec508 measured691 visible compositor submissions/25.40109s=27.203557/s on sourcec26252c4a/modulef644bbb2; retained raw-sample validation and archiveSHA rechecked2026-11-03. Earlier WebGL434 submissions/20.127145s=21.562919/s used a different build/interval, so these are not a backend performance comparison. Logical gameFPS, physical scanout, unique pixel frames, current-main runtime, audio and Windows parity remain unqualified. Initial DOM-only software zero remains rejected; corrected OffscreenCanvas measurement supersedes that gap. See docs/re-notes/arcanum-demo.md and run20261022-arcanum-software-frame-measure; no new runtime needed.
  Done: Reviewed gameplay screenshot and scene-qualified frame measurement with raw samples, counter proof and tested build identity; retain explicit failures.
  Evidence: scratch/gameplay-coverage-20261003/tasks/GAMEPLAY-arcanum-demo.json
  notes: Registered route arcanum_demo; historical missing-file and software-observer blockers are superseded by accepted gameplay and corrected measurement evidence. Runtime bx_4sszn2zj snapshot-stopped2026-10-22T03:20:19.397Z, stop_7eb1565f41c1e5e9 completed.

- [x] Gameplay screenshot and FPS: Black & White 2 Demo
  id: GAMEPLAY-black_white_2_demo
  status: done
  Next: Done. Update 2026-10-23 on main aa09d05dc (wasm 43375d0f, boat bx_6f7u7wm3), run 20261023T1030Z-black_white_2_demo-claudea7d5-goldscroll: the Gold Scroll IS consumed (objective up by 9088s; 6th click at game cursor (495,284), where the mouse-button hint icon shows, removes scroll/beam/objective box, then the scripted field/storehouse pan); 10000s, 0 failed commands, no latch. Every press reaches the consumer; the left click is consumed by binding test 0x64c510->0x64c551, not by 0x611830 (binding 1 has no case there by design). Still open: free play and an isolated drag (budget ended ~600s after the scroll; next run --seconds=12500). fps 0.09 vs 0.146 measured 2026-10-23 (run 20261023T1350Z-black_white_2_demo-claude263-lockperf-ab, boat bx_2bxb3m3w): NOT lock contention. f5329feb1^ vs f5329feb1, same boat and Node, paired: render-worker CPU/draw equal (land load 126.45/125.98, 100.54/99.35, 108.35/105.34 ms; Land3 intro 11.93/12.01 ms), $lock_acquire 0.01% of worker time. Node v24 is ~10-15% cheaper per draw than v20, so it explains part of the gap; scene and host account for the rest. Perf lead DONE 2026-10-23 (run 20261023T1720Z-black_white_2_demo-claude84e-drawctx-reuse): per-draw ~852 KB contexts reserved fresh arenas because $heap_shrink split each whole large arena; $heap_shrink now leaves those intact, and render-worker CPU/draw in the Land3 intro drops 10.68->7.37 / 11.44->8.34 ms (rep 1 / rep 2, 1200-1500 s), with the same frame on the frozen clock; see re-notes 'the per-draw context arena, fixed'. Earlier, on main bb9c496ed (wasm ccd5b0a8, software D3D9 CLI, boat bx_vug3ywn9), run 20261023T0422Z-black_white_2_demo-claude739-camera. Intro -> 'Click on the Gold Scroll' objective at ~5700s, 0 failed commands in 8000s. Wheel zoom attributed (idle 1.09% vs 28.8% land diff); Storehouse/Field selected by clicks. Objective scene, idle, fixed view: 27 presents/185s = 0.146 fps, ~641 draws/present (presents.ndjson). Open, retained in docs/re-notes/black-white-2.md 2026-10-23: drags not isolated (no-input drift after first input), Gold Scroll not consumed so no free play, and a harness-triggered raster -1 latch at ~787s (also on 0304a8549; the captured draw replays clean).

  candidate: black_white_2_demo
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: claude:a7d5626d-5272-4c19-a872-63bb2dd1db1d (lane BW2-GOLD-SCROLL-RUNTIME from claude:80aa9e95, 2026-10-23; before: claude:739271c7)
  prev-owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5 — Codex out of credits until 2026-10-12; its uncommitted shared-tree work is preserved on archive/codex-shared-tree-20261006 (see ops/handoffs/codex-release-review-20261006.md)
  created: 2026-10-03T08:42:45.967Z
  accepted: 2026-10-03T08:42:45.967Z
  accepted-by: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Done: Reviewed gameplay screenshot and scene-qualified frame measurement with raw samples, counter proof and tested build identity; retain explicit failures.
  Evidence: scratch/runs/20261023T1030Z-black_white_2_demo-claudea7d5-goldscroll/result.json; scratch/runs/20261023T0422Z-black_white_2_demo-claude739-camera/result.json (earlier: scratch/gameplay-coverage-20261003/tasks/GAMEPLAY-black_white_2_demo.json)
  notes: Migration missing-file blocker cleared against current registered route: black_white_2_demo. Reviewed post-intro gameplay and FPS recorded 2026-10-23; Gold Scroll consumed and Field-tutorial pan reached 2026-10-23 (run 20261023T1030Z); full free play is still unverified.

- [ ] Gameplay screenshot and FPS: Deus Ex demo
  id: GAMEPLAY-deus-ex-demo
  status: active (count12 fresh reload and Small0 native support verified; count14 preserved, onward traversal and FPS open)

  candidate: deus-ex-demo
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  worker: fresh01a1a4d0-03f9-70e3-aba8-f5f411039206 session1722; scratch/usage-watch/deusex-capture-publication-contract-nov04/; offline causal publication/capture helper repair, no runtime or box
  prev-owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5 — Codex out of credits until 2026-10-12; its uncommitted shared-tree work is preserved on archive/codex-shared-tree-20261006 (see ops/handoffs/codex-release-review-20261006.md)
  created: 2026-10-03T08:42:45.967Z
  accepted: 2026-10-03T08:42:45.967Z
  accepted-by: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Next: Published6a74fbc16 original count14 restore visible but publication735to736 held/crossed rejects qualification; no pulse or onward gameplay. Missing pinned API-table HTTP500 found late, repaired offline only; limitation preserved. Fresh worker traces historical publication lifecycle and executable helper capture/approval contract; no guard weakening or runtime retries. Root45files+canonical fullSHA PASS. bx_affrncy3 normalSTOPPED04:27:19.117Z snapshotverified04:27:19.078Z.
  Latest run: scratch/runs/20261104-deusex-owned-publication-pulse/; docs/re-notes/deusex-owned-publication-pulse-20261104.md. Observer33, queue6, timing14 and real driver integration passed; staging negatives repaired offline; BaseSmall0 readiness and old blank-world cause remain unknown.
  Done: Reviewed gameplay screenshot and scene-qualified frame measurement with raw samples, counter proof and tested build identity; retain explicit failures.
  Evidence: docs/re-notes/deus-ex-demo.md; scratch/runs/20261031T0447Z-deusex-browser/; scratch/gameplay-coverage-20261003/tasks/GAMEPLAY-deus-ex-demo.json
  notes: Original Training gameplay and first-door traversal are verified on the default guestWorker software browser route. This does not qualify WebGL, audio, FPS, Liberty Island or completion. Historical missing-path reports are superseded for registered deus_ex_demo.

- [x] New-game lane: Age of Wonders II demo
  id: NEW-GAME-AGE-OF-WONDERS2-DEMO-20261008
  status: done
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: none; browser41887 exited0; bx_2sdgzsm6 stopped03:11:23.355Z
  candidate: test/binaries/win98-games-a-d/Age of Wonders2 demo-SW.exe
  Next: Initial ordinary gameplay verified: select party and click destination twice, army moves and movement20->13. Generic FVF RESERVED1 fix plus control-failing/candidate-passing native tests integrated with this task update. Evidence run20261009T0306Z-age-of-wonders2-gameplay,67 hashes. Rendering overlap/FPS/audio tracked separately; no release claim.
  Evidence: Original installer SHA256 1244f0114965d011d1e28b97e207db15c902d124ebb25af8a6c97748beb73dc0. Historical runs20261008T1518Z-age-of-wonders2-demo-before and-after record the earlier crash/menu investigation; its unknown Scenario outcome was superseded by the October9 army-movement observation described above and in docs/re-notes/age-of-wonders2-demo.md. These are historical reports; the October9 run is absent locally and has not been re-reviewed here.
  Done: Normal registered launch, actual player-controlled gameplay, reviewed screenshot with original/source/build identity and tested changes pushed main. FPS/audio require separately valid measurements.

- [ ] New-game lane: Dungeon Siege demo
  id: NEW-GAME-DUNGEON-SIEGE-DEMO-20261008
  status: blocked (automatic review rejected follow-up source/dataflow diagnostic)
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  worker: /root/dungeon_siege_thread_snapshot (reservedPageFaults registration and SEH control preparation)
  candidate: test/binaries/win98-games-a-d/DungeonSiege-demo-D3D.exe
  Next: Preserve recovered fault-context-2 evidence (first API-skipped outcome at EIP004178eb/address08407705, clean bounded exit). Automatic review rejected worker follow-up source/dataflow analysis as possible cybersecurity risk; narrower operation unspecified. Do not retry, rephrase or delegate that diagnostic. Original gameplay remains unqualified; Conan refills active lane.
  Previous checkpoint (licence-decision hold superseded): Await user decision on accepting demo EULA under the instruction not to answer approvals. Generic lazy RTF fix main b493bc3b9 passes; original EULA window renders, screenshot Telegram947. Evidence scratch/runs/20261009T0125Z-dungeon-siege-eula (36 hashes). No gameplay/FPS/audio qualification.
  Evidence: Local original installer 192188416 bytes, SHA256 a501306cad88c0fc41f986d92109343d68ac79fc11aaa6611724d84be628f3f8. Experimental local registration and checked CAB extraction integrated ef51b4f59; registration is not gameplay qualification.
  Done: Normal registered launch, actual player-controlled gameplay, reviewed screenshot with original/source/build identity and tested changes pushed main. FPS/audio require separately valid measurements.
  Authorization: docs/license-acceptance-authorization-20261018.json; acceptedInGuest=true observed in acceptance-2/acceptance.json; historical authorization receipt remains unchanged.


- [x] Restore registered local candidates missing from the launch picker
  id: OPS-PICKER-MISSING-CANDIDATES-20261008
  status: done
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Result: Added20 missing LOCAL_CANDIDATE_APPS options to the existing Local Candidates group in index.html. Dynamic picker derives its catalog from this select; existing eligibility filters remain unchanged. No public deployment or gameplay qualification.
  Validation: Existing test/test-app-selector-options.js failed before on20missing entries and passes after for all173apps across3lists, including duplicate/list-disjointness checks. No browser run required for this static option correction. Receipt scratch/picker-completeness-20261008/receipt.json.

- [x] Implement missing ANSI resource enumeration callback chain
  id: WIN32-ENUM-RESOURCE-ANSI-20261008
  status: done
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: none (coordinator implemented and validated directly)
  Result: Implemented, validated and pushed main77cca122f; fresh original Dungeon Siege progressed beyond old resource trap to next missing API VerLanguageNameA. No gameplay claim.
  Evidence: ops/handoffs/resource-enumeration-ansi-20261008.md; scratch/runs/20261008T2343Z-resource-enum-ansi/result.json. Unchanged-main control fails nested callback assertion; candidate passes full hash/thunk chain, actual LANGIDs, CP1252, nested/early-stop/error/DLL contracts and ESP restoration; canonical build and thread-resource-sync pass.
  Done: Generic contract and nesting tests pass, original runtime limitation is accurately updated, reviewed changes pushed main; no silent-success stub.

- [x] Real 256-color display mode and SimCity verification
  id: SIMCITY-256-COLOR-20261009
  status: done
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: coordinator direct, isolated wt-simcity-256-20261009
  Result: Real indexed desktop and palette-preserving copies verified on original SimCity2000: warning absent, demo city simulation advances, ordinary centering click changes viewport, water palette animation restored. Before: scratch/runs/20261009T0010Z-simcity-truecolor-before; after: scratch/runs/20261009T0048Z-simcity-indexed-desktop. Canonical build and indexed/palette/window regressions pass. FPS/audio not measured.
  Done: Contract regressions, browser before/after and ordinary gameplay evidence reviewed; explicit-path commit pushed main.

- [x] Implement version-resource language descriptions
  id: WIN32-VERLANGUAGE-20261009
  status: done
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Result: VerLanguageNameA/W lookup, bounded copying and generated API dispatch implemented; canonical build plus language/locale/version regressions pass on temporary box.
  Evidence: scratch/runs/20261009T0105Z-version-language; ops/handoffs/version-language-20261009.md.
  Limitation: Original Dungeon Siege startup validation remains separate; no gameplay/FPS/audio qualification.

- [x] Park lazy RTF opens without losing formatting or handles
  id: VFS-LAZY-RTF-OPEN-20261009
  status: done
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: coordinator direct; one-worker budget
  Result: Original Dungeon Siege now renders its EULA without the lazy-file trap. Native A/W thread/stack/retry, canonical build,45 VFS and50 lazy tests pass. Evidence scratch/runs/20261009T0122Z-lazy-rtf-open; browser proof scratch/runs/20261009T0125Z-dungeon-siege-eula (36 hashes), HTTP206 EULA bytes0-6531. Pushed main b493bc3b9. Accept untouched pending user decision.
  Scope: Thread-owned IO_WAIT for CreateFileA/W RTF expansion, preserving ordinary lazy opens and delayed loading UX. No blanket eager manifest or formatting bypass.

- [x] Keep ordinary Worker slices out of suspended send callbacks
  id: WORKER-SEND-SLICE-OWNERSHIP-20261009
  status: done
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Evidence: main28a104092; run20261009T0203Z-age-of-wonders2-send-ownership. Actual boundary trace shows nested EIP0 sentinel consumed by normal slice; real Worker control regression fails, candidate12checks/timing/scheduler/build pass. Original AoWII advances to scenario setup; later Start exit remains separate work.


- [ ] New-game lane: Disciples II demo
  id: NEW-GAME-DISCIPLES2-DEMO-20261009
  status: active
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  worker: root; native and browser movement verified, input/FPS/audio follow-up ready; all runtimes terminal
  candidate: test/binaries/win98-games-a-d/Discipless2_demo-D3D.exe
  Next: Registered native and browser gameplay verified: ordinary leader move20/20->16/20 and camera follow, reviewed run20261009T0728Z-disciples2-browser-gameplay, photo967. Registration fd5aa4a35 on main. Browser50788/50800 clean stop07:28:27Z. Menu repeat-click issue remains despite1000ms holds and both down/up reaching renderer/input log; inspect guest consumption/activation.30.10599s presentation sample2432 events/1649 uploads is80.7813/54.7732 per second, not logical FPS. Qualify gameplay counter and audio separately. No public promotion. Alice real GL implementation is next unblocked implementation lane.
  Evidence: scratch/disciples2-preflight-20261009/preflight.json
  Done: Registered normal launch, actual gameplay control, reviewed screenshot, fixes/tests pushed main.

- [ ] AoWII rendering overlap and gameplay measurement
  id: AOW2-RENDERING-COVERAGE-20261009
  status: current native visual gap closed; gameplay FPS/audio remain open
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  Next: Preserve reviewed current army movement and lower-panel clipping evidence. Logical gameplay FPS and audio need separate evidence; no browser/GPU/general-playability claim. Do not repeat accepted viewport9a438f1b9 or vblank918f25772 repairs.
  Evidence: mainebed72ce2055025648297c367d116a9aba8256f9; docs/re-notes/age-of-wonders2-demo.md; scratch/runs/20261101-aow2-current-original-control/. Two originals exit0; selected/settled/native-final PNGs reviewed20/20to5/20, fixed mountain patches and clean lower panel; five own PIDs independently absent, remote main MATCH. Control waiter timeouts and descriptor/stream read-hook limits retained.

- [ ] New-game lane: American McGee's Alice demo
  id: NEW-GAME-ALICE-DEMO-20261009
  status: active (ordinary wind-brush crossing and dry landing reviewed; knife/attack pending)
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  worker: none; observed-timeout worker01a1a404 terminal, released to distinct Stronghold browser lane
  candidate: test/binaries/candidates/alice-demo/alice.exe
  Next: Published1188e9bf5 bounded phase/lifecycle diagnostic did not reproduce the original timeout; cause remains UNKNOWN, no causal repair. Root verified669 recovered files including BOTHcffca869/580f49f3 modules and inspected cap117 wooden walkway. No completed gnome dialogue/knife/attack claim. Inputs ended847.402s; idle retirement917.637s exceeded900s limit and is disclosed. Named alice-observed-timeout-20261104 snapshot verified, bx_u3jnuyts actual normal STOP01:43:15.853Z. Existing original wind crossing/dry landing evidence retained; future changed diagnosis must preserve first failure, no speculative timeout increase or unchanged retry.
  Done: Original demo launches with ordinary input, player-controlled gameplay independently reviewed, exact build/media and screenshots retained; menus do not qualify.
  Evidence: main11462d25b5729d0ab481b57292654e3a2c624091; docs/re-notes/alice-authentic-ground-gameplay-20261103.md; scratch/runs/20261103-alice-authentic-ground-gameplay/. Root reviewed cave PNG, full6132payload SHA PASS, actual normal STOPPED bx_tahsef2b18:26:20.951Z/snapshot verified. No ground continuity, airborne, route or knife claim.


- [x] Sizeless virtual decommit corrupts neighboring allocation
  id: VIRTUAL-DECOMMIT-NEIGHBOR-20261009
  status: done (main13da5a055 and prior build/regression receipts verified)
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Next: Closed by reconciliation: current main retains13da5a055 zero-size decommit bound and neighboring-allocation regression. Board Oct11 01:44 records full build/decommit suites PASS;01:52 requests closure, shared task already reconciled Oct12. No duplicate implementation or new runtime performed.
  Evidence: scratch/runs/20261009T0608Z-virtual-prefix-initial/result.json

- [x] New-game lane: Baldurs Gate II demo
  id: NEW-GAME-BALDURS-GATE2-DEMO-20261009
  status: done
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  candidate: baldurs-gate2-demo
  Next: Gameplay qualification complete on main5aafa6658; current-main moduleb84324ed revalidates dialogue and floor movement. Apparent pointer mismatch was diagnostic Puppeteer.connect default viewport mutation; preserved viewport fixes mapping without runtime changes. Audio/FPS remain coverage follow-ups.
  Done: Registered working launch, ordinary player input changes visible gameplay, reviewed screenshot linked to exact run/source. No installer/menu credit or public deployment.

  Current evidence: docs/re-notes/alice-host-receipt-ground-route-20261103.md, published4ad02d281; coordinator full2060local-file SHA PASS (includes complete7456payload archive), native assessment and gnome screenshot reviewed. Own boat bx_974w85x2 STOPPED/nonforced/errornull20:00:35.847Z, snapshot completed/verified20:00:33.613Z. No native guest fault; optional input-state missing-flag host rejection retained.

- [ ] User priority: Return Fire demo
  id: NEW-GAME-RETURN-FIRE-DEMO-20261009
  blocker: none for bounded launcher/deployment/movement scope; sustained play/audio/FPS remain separate.
  worker: none (bounded launcher follow-up complete)
  status: bounded gameplay and visible native launcher accepted; broader coverage open
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  candidate: return-fire-demo
  priority: user-first
  Next: Launcher follow-up5d014a0e complete: reviewed visible Hard/Easy controls and trusted Play route in20261031T2230Z-return-fire-launcher at actualHTTPed3f924a. No paint defect; prior teal-only image view corrected. Retain pinned full-color deployment/movement20261031T2213Z-return-fire-presentation fix9f695796c. Sustained play/audio/FPS remain separate.
  Done: Registered launch, ordinary input visibly changes gameplay, reviewed screenshot with original source/build evidence; FPS/audio separate.

- [ ] Serialize shared DLL mapping and lifetime mutation
  id: DLL-CONCURRENT-MAPPING-20261009
  status: review (serialization and unload merged; CMR3/Alice gameplay revalidation pending)
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  Next: Load/publication serialization cfe411bdc/1b3c20aec/7a2953021/89524faca and real unload83947f6a6 are on main. Historical comments about stub FreeLibrary and held-branch adaptation are superseded. Current next action is fresh CMR3/Alice original gameplay validation; reproduce a current boundary before changing loader behavior.
  Done: Concurrent load/free/import tests preserve exact images and module ownership, callback execution stays live without deadlock, normal Alice gameplay/browser revalidated.

- [x] New-game lane: Aliens versus Predator 2 single-player demo
  id: NEW-GAME-AVP2-DEMO-20261010
  status: done (original browser launch and paired CLI gameplay reviewed; device/audio/FPS separate)
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: none
  candidate: test/binaries/win98-games-a-d/alien vs predator 2-sp demo-D3D.exe
  Next: Supersede stale HUD-font blocker: original Marine forward-input and textured scene reviewed in run20261011T0836Z-avp2-bltfast-gameplay; BltFast fix merged6613fe863. Manifest/re-note retain exact limits: historical retained-source capture, not current-main revalidation; no registered dashboard launch. Original18-file payload hashes reverified; local avp2_demo launcher registration prepared without synthesized command file. TG90 local test generated authentic68-file handoff and reviewed Single Player menu at d21c95446; run20261018-avp2-local-launch. Next ordinary menu input and paired movement on this tested source. Historical67-file VFS count does not establish missing original media. Do not redo fixed HUD/DXT diagnosis. FPS/audio remain unqualified.
  Done: Original demo launch, ordinary player input visibly changes gameplay, reviewed screenshot with exact source/build/run evidence.

- [x] Validate original .kkrieger startup on separate test box
  id: KKRIEGER-STARTUP-20261014
  status: done (original launch and one ordinary forward movement reviewed)
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Next: Root reviewed4fullframes and completedbodyz0 to0.686228 afterordinaryW, stableorientation, host/guestrelease observed. All160artifacts23116287B independentlyhashverified; report2193c3869. Core one-input/screenshot criterion met; smoothcontrol/FPS/audio/combat and dualbackend remainunqualified under KKRIEGER-CONTROL-LATENCY-20261015.

- [ ] Revalidate original CMR3 menu-to-Stages progression
  id: CMR3-POST-SPLASH-NULL-20261010
  status: blocked (original diagnostic replay automatic-review hold)
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  Next: 85638 exact937466 original replay reached UK Warwick loading, then invalid native free list. Diagnostic729d3fc73 passed native suites, but original replay105999 was automatically rejected for possible cybersecurity risk (exact action unspecified) and stopped clean13:08:09. Do not retry/rephrase/delegate that diagnostic; no driving or cause established. Independent ordinary conformance remains permitted.

- [ ] Validate merged DLL unload and CMR3 progression
  id: FREELIBRARY-EXITTHREAD-CMR3-20261010
  status: blocked (implementation merged; original diagnostic replay under automatic-review hold)
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  Next: Main83947f6a6 plus57a148044/321e734aa integrate generation-aware unload/thread exit with recorded suites. Recovered original85638 progresses to UK Warwick loading then native free-list failure; this is not evidence of a new unload defect. CMR3 diagnostic replay105999 is held by automatic review; do not restart it. No driving qualification.


- [~] New-game lane: Colin McRae Rally 3 demo
  id: NEW-GAME-CMR3-DEMO-20261010
  status: blocked (automatic-review replay hold; native diagnostic tested and merged)
  runtime-revalidated: 2026-10-15 native recovery56105 terminal0; serialized remote runtime available, no transport blocker.
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  candidate: test/binaries/win98-games-a-d/ColinMcRay-Rally3-pcdemo-D3D.exe
  Next: Preserve rejected replay105999; do not retry/rephrase/delegate around automatic possible-cybersecurity-risk rejection (exact operation unspecified). Root stopped via ordinary ctl quit13:08:09, postflight identities unchanged and runtime inventory empty13:10:11. Diagnostic729d3fc73 merged after native lifetime/backend plus intended reason-zero negativecontrol/restored PASS104186. No new driving or corruption cause established. Fresh /root/new_game_refill_20261015 selects an independent unqualified title.
  Done: Original launch, player-controlled gameplay and reviewed screenshot with tested identity.
  Evidence: scratch/cmr3-demo-20261010/selection.json

- [~] New-game lane: Recoil demo
  id: NEW-GAME-RECOIL-DEMO-20261011
  status: blocked (core gameplay merged; device/audio/FPS follow-ups require runtime)
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  source: https://archive.org/details/RecoilDemo
  Next: Main f9376176448849d53c9cfbcfc47e330691457ac0 cherry-picks d189a725a qualification notes; ancestor and exact note content verified2026-10-15. No integration blocker remains. Historical run20261011T2056Z-recoil-main-tap-gameplay records ordinary touch route and padLeft tank/view turn on274902b02.15.10 guest presentation events/s is not logical/display FPS or controlled benchmark. Physical phone/WebKit/audio remain unverified; no new runtime or release qualification from this reconciliation.
  Done: Ordinary launch and player-controlled gameplay with reviewed screenshot/build identity, registered and pushed main; FPS/audio separately measured.
  Reconciled 2026-10-18: Current main containsf93761764 and tested274902b02. Historical documentation integration and disk blockers are cleared. Physical phone/WebKit/audio and scene-qualified FPS remain unverified; saved runtime box requires owner resume.

- [x] Make .kkrieger launchable in private Wine Ops
  id: TG87-KKRIEGER-OPS-LAUNCH
  status: done
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Evidence: 40fe91b98237f5cf21beef64235d78a94fead740; scratch/tg87-ops-launch-verification.json; Telegram1402
  Done: Private catalog registered and available, launch HTML/module/original EXE HTTP200 with exact hashes;10launch testsPASS including realindex anchor. No public deployment or movement qualification.


## Palette integration reconciliation — October 15

- [x] Correct indexed legacy GPU texture color-key behavior if internal key contract confirms raw indices
  id: D3D-INDEXED-COLORKEY-20261014
  status: done (bounded implementation and integration validation merged)
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Next: Merged6b269258 is an ancestor of main; exact combined canonical build,16CPU suites,42observations eachWebGL1/2 and22each actualWorker syncmode PASS. See docs/palette-combined-validation-20261015.txt; this supersedes stale execution/access/ownership blockers. DefaultFALSE filtered-key semantics and alpha-key precedence remain separate open tasks D3D-FILTERED-KEY-STATE144-20261014 and D3D-ALPHA-KEY-PRECEDENCE-20261014, not completed by these results.

- [x] Correct cross-format indexed texture color-key conversion
  id: D3D-TEXTURE-LOAD-INDEXED-KEY-20261014
  status: done (bounded implementation and integration validation merged)
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Next: Merged6b269258 is an ancestor of main; exact combined canonical build,16CPU suites,42observations eachWebGL1/2 and22each actualWorker syncmode PASS. See docs/palette-combined-validation-20261015.txt; this supersedes stale execution/access/ownership blockers. DefaultFALSE filtered-key semantics and alpha-key precedence remain separate open tasks D3D-FILTERED-KEY-STATE144-20261014 and D3D-ALPHA-KEY-PRECEDENCE-20261014, not completed by these results.

- [x] Implement and validate legacy palette alpha semantics
  id: D3D-PALETTE-ALPHA-API-20261014
  status: done (bounded implementation and integration validation merged)
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Next: Merged6b269258 is an ancestor of main; exact combined canonical build,16CPU suites,42observations eachWebGL1/2 and22each actualWorker syncmode PASS. See docs/palette-combined-validation-20261015.txt; this supersedes stale execution/access/ownership blockers. DefaultFALSE filtered-key semantics and alpha-key precedence remain separate open tasks D3D-FILTERED-KEY-STATE144-20261014 and D3D-ALPHA-KEY-PRECEDENCE-20261014, not completed by these results.

- [x] Correct software ordinary-palette point-sampled key identity
  id: D3D-SOFTWARE-POINT-KEY-20261014
  status: done (bounded implementation and integration validation merged)
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Next: Merged6b269258 is an ancestor of main; exact combined canonical build,16CPU suites,42observations eachWebGL1/2 and22each actualWorker syncmode PASS. See docs/palette-combined-validation-20261015.txt; this supersedes stale execution/access/ownership blockers. DefaultFALSE filtered-key semantics and alpha-key precedence remain separate open tasks D3D-FILTERED-KEY-STATE144-20261014 and D3D-ALPHA-KEY-PRECEDENCE-20261014, not completed by these results.

- [x] Add full-VM palette-alpha regression with real watched decoder/cache
  id: D3D-PALETTE-FULLVM-REGRESSIONS-20261014
  status: done (bounded implementation and integration validation merged)
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Next: Merged6b269258 is an ancestor of main; exact combined canonical build,16CPU suites,42observations eachWebGL1/2 and22each actualWorker syncmode PASS. See docs/palette-combined-validation-20261015.txt; this supersedes stale execution/access/ownership blockers. DefaultFALSE filtered-key semantics and alpha-key precedence remain separate open tasks D3D-FILTERED-KEY-STATE144-20261014 and D3D-ALPHA-KEY-PRECEDENCE-20261014, not completed by these results.

- [~] New-game lane: Jedi Knight Dark Forces II original demo
  id: NEW-GAME-JEDI-KNIGHT-DEMO-20261015
  blocker: Protected cold GetCommandLineA lacks resumable allocator/string/argv phases. Existing admission rejects before effects; the complete first-loss/script fixture remains unqualified.
  worker: none; service audit worker91088 terminal0, replaced by fresh MDK2 lane below
  status: blocked (technical service-continuation dependency; no owner hold)
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  Next: Implement audited persistent allocator/dispatcher/string/argv phases from a2ae4283d before protected fixture admission. Do not remove guards or substitute an isolated opcode pass. Original CALL safety440403b4c remains accepted; no new native execution occurred in the service audit. Resume condition: concrete continuously armed real-import continuation and full native fixture pass. MDK2 replaces this blocked worker while Alice continues gameplay.
  Evidence: docs/re-notes/jedi-protected-service-continuity-20261103.md; scratch/runs/20261103-jedi-protected-service-continuity/ (13 payload SHA PASS); docs/re-notes/jedi-memory-call-protected-safety-20261103.md
  Done: Registered original launch, ordinary player-controlled gameplay and reviewed screenshot with exact source/run identity.
  Authorization: docs/license-acceptance-authorization-20261018.json; accepted installation evidence docs/reviews/jedi-installation-evidence-integration-20261021/README.md.

- [~] New-game lane: original MDK2 demo gameplay and GL prerequisites
  id: NEW-GAME-MDK2-DEMO-20261103
  status: active (original browser/WebGL1 movement, jump/landing and chaingun impact verified; next tutorial objective open)
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  worker: fresh 01a1a468-b39c-7a61-8629-d6786d1fa057 session47513; output scratch/usage-watch/mdk2-left-target-grenade-nov04/.
  Next: Defeat remaining left shooting dummy and reach grenade instruction with ordinary controls. Published8f9ff6d4c verifies RIGHT dummy breakup/disappearance only. Original scripts require10hits each and both deaths for next instruction. Coordinator inspected right-dummy capture and independently verified1662 full hashes/BOTHmodules. Actual owningWebGL1 ANGLEIntelMesa; canonicalcffca869/compat580f49f3 retained, compatibility unexecuted.
  Current evidence: docs/re-notes/mdk2-tutorial-target-onward-20261104.md; scratch/runs/20261104-mdk2-tutorial-target-onward/. Retainedbx_kbzzavgf expiry03:06:56.554Z coordinator shutdown; fresh successor recovery by03:00Z. Full tutorial/exit/FPS unverified.
  Evidence: color-index c96b1b241 genuine13API typedstate/arrays/query/list/context semantics; lockedfullbuild/native/actualqueuedWorker/WebGL1+2 and24regressions PASS, lost-index mutation rejected. Coordinator167local/102recovered payloadSHA PASS, BOTHmodules retained; actualSTOPPED/completedverifiedsnapshot and pixels checked. WGL20fed4877/856be2942 now implements all three with selected glyph semantics, native/actualqueuedWorker/WebGL1+2 and discriminating ink/rollback negatives; locked builds and34regressions PASS. Original actualcanonicalcffca869 context1/current1 rendered inspected640x480 explicitDemo attract,29media unchanged; original gameplay UNVERIFIED. All356 local recovery hashes verified, BOTH modules retained; completed snapshot and normal STOPPED bx_erf7ybua22:57:04Z. docs/re-notes/mdk2-wgl-layer-font-family-20261103.md. Earlier selection/evaluator accepted with recorded limits.
  Latest evidence: docs/re-notes/mdk2-ordinary-menu-control-20261103.md, published081a33477; source1537186c3 includes856be2942, canonicalcffca869/compat580f49f3,29originalpins unchanged. Four gameplay captures inspected,204final localSHA PASS (106recovered payloadfiles),314sequentialrequests/max64/7475completedbatches, ordinaryexit0. Verifiedsnapshot before normal STOPPED bx_a9f4vb8k23:44:35.584Z. This supersedes historical gameplay-unverified evidence below only for explicit software CLI route.
  Done: Original pinned demo reaches ordinary player-controlled gameplay with reviewed screenshots and exact source/run identity; full corpus backend coverage remains separate.

- [ ] Improve and validate original .kkrieger control responsiveness
  id: KKRIEGER-CONTROL-LATENCY-20261015
  status: ready (local browser attempt failed before menu; failure diagnostics prepared)
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  Next: Read-only CS wait/main EIP/cooperative-owner samples merged0b95d3233,10focused testsPASS. Retained run118738 suggests audio critical-section/main-loop delay but owner/duration attribution unproved. TG90 authorizes persistent-box testing. Local attempt20261018-kkrieger-local-latency ended detached Frame before menu; no CS-owner samples. Host stderr/lifecycle diagnostics prepared; next serialized retry after AVP2 pair, inspect root cause before scheduler changes.
  Evidence: docs/kkrieger-position-capture-20261015.md; scratch/runs/20261015-kkrieger-position-capture

- [~] New-game lane: Outlaws original Windows single-player demo
  id: NEW-GAME-OUTLAWS-DEMO-20261015
  status: done (original launch, forward and registered turning reviewed)
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: /root/outlaws_original_qt_prepare
  Next: Root reviewedsettledturn before/held/idle directionalworldchange health10/tint0 allsamples; oneLeft500ms releasedorientationheld. Priorforward also reviewed. Run20261018-outlaws-settled-turn-observation root3149pins31original/groupemptyPASS exits0. Corequalified; combat/audioFPS/browser/fullgame remain unverified. Fresh /root/new_game_refill_after_outlaws screeningreplacement.
  Done: Original working launch, ordinary player-controlled gameplay and reviewed screenshot with exact run/source identities.

- [x] New-game lane: Army Men original 1998 Windows demo
  id: NEW-GAME-ARMY-MEN-DEMO-20261015
  status: done (original CLI launch, ordinary movement/fire/scroll and reviewed screenshots; accepted integration b88c818ba)
  owner: coordinator; bounded gameplay evidence independently accepted and integrated
  Next: Exact c740f914 CLI runtime-access hold superseded by actual bx_e8a7pw8v execution. Separately assign historic-stripe reproduction/first bad frame-call if it recurs, or broader browser/full-game qualification; do not repeat completed source reviews. Coordinator snapshot-stop completed2026-10-21T11:48:43.227Z; no current runtime admission implied. Independent review: docs/reviews/army-gameplay-evidence-integrate-20261021.md.
  Validation: 20261021-army-integrated-gameplay-scroll: clean c740f914/7303 tracked identities,419 originals/support hashes and reused canonical728e1de8 verified before/after; no fresh build. Ordinary Numpad8 movement relative to terrain and Space-release muzzle flash/HUD response inspected; explicit scroll before/held/released shows no stripes in bounded capture. Two default CLI runs exit0 (16.147s/14.841s);53 runtime seals. Prior observer baseline/released PNGs byte-identical to default. Full-surface/historic stripe cause/hits/kills/full-game/audio/FPS/browser/parity remain unqualified. Report docs/reviews/army-integrated-gameplay-scroll-20261021.md; evidence acceptance integrated at b88c818ba3a071877e889e7cc779975a193591ce, with no source fixes.
  Previous checkpoint (licence-decision hold superseded): Five-second observation175219 proves original8792-byte licence renders normally; earlier blank capture premature, no emulator defect. Root reviewed settled PNG and trace; Telegram1406 delivered, Yes/No untouched. Archivef2486e1, independentpostflight14:50:54 unchanged active[]. Refill worker /root/new_demo_refill selecting another actionable original demo.
  Done: Original launch, ordinary player-controlled gameplay and reviewed screenshot with source/run identity.
  Authorization: docs/license-acceptance-authorization-20261018.json; acceptedInGuest=true: ordinary Yes observed in scratch/runs/20261019-army-men-authorized-child/acceptance.json; Setup Complete separately verified in 20261019-army-men-authorized-install-buffer. Authorization receipt remains unchanged.


- [x] Retain Worker ownership until retirement and termination complete
  id: IW-RETIREMENT-SLOT-OWNERSHIP-20261015
  status: done (merged main3fdb29373; combined native conformance passed)
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Next: Combined canonical04ede fullbuild passed; retry237863 all8 native arms passed including exact negative receiver control/restored result. Independent16:18:59.497 source/dependency/donor preservation and idle verified. Root production diff vs tested6c221 is empty; merged/pushed main3fdb29373. Original Invisible War gameplay and pointer-message marshalling remain separate unproved work.

- [x] Resolve independent cross-process send deadlocks
  id: IW-INDEPENDENT-SEND-ADMISSION-20261015
  status: done (merged main3fdb29373; combined native conformance passed)
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Next: Combined canonical04ede fullbuild passed; retry237863 all8 native arms passed including exact negative receiver control/restored result. Independent16:18:59.497 source/dependency/donor preservation and idle verified. Root production diff vs tested6c221 is empty; merged/pushed main3fdb29373. Original Invisible War gameplay and pointer-message marshalling remain separate unproved work.

- [x] Implement OEM character to keyboard scan mapping for Outlaws
  id: OUTLAWS-OEMKEYSCAN-20261015
  status: done
  owner: /root/outlaws_oemkeyscan_native
  Next: Merged main9ca647939 after normal gatedbuild, fullmodule lookup/thunk/ESP tests, missing baseline and restored PASS; root independently verified archive d4bdcb14. Original replay now passes initial OemKeyScan blocker; further loader issue belongs to game lane.
  Evidence: scratch/runs/20261015-outlaws-original-startup; archiveSHA241f8911ad2071909fcdeb368d9ff91bb98f76e950744d6abf6314ccc01285dc; independent postflight14:19:27 unchanged active[].

- [~] New-game lane: Lords of the Realm II original playable Windows demo
  id: NEW-GAME-LORDS2-DEMO-20261015
  status: blocked (automatic-review hold on GetWindow/GetNextWindow follow-up)
  owner: /root/new_demo_refill
  Next: Worker turn rejected for possible cybersecurity risk during scoped GetWindow/GetNextWindow follow-up; exact internal action not disclosed. Do not retry/rephrase/delegate. WIP preserved in scratch/runs/20261015-lords2-review-hold and source worktree; original250171 reached GetNextWindow invalid1446 after GetParent fix, no gameplay. Fresh independent new_game_refill_after_lords selects replacement lane.
  Done: Registered original launch, actual ordinary player control and reviewed gameplay screenshot with source/run identity.

- title: USER ASK - add a FIFA game to the corpus (user linked FIFA Street; that is console-only, so a Win9x FIFA demo instead)
  id: USER-FIFA-DEMO-20261012
  status: done (core registration, reviewed keyboard gameplay, touch layout; device qualification separate)
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  prev-owner: claude:65967384-f1a3-4c67-9257-ecc5f4c71983 (stopped w4)
  created: 2026-10-12T00:15:00.000Z
  created-by: user via Telegram #48/#49 (x.com/exquizitely post about FIFA Street, "Another cool addition to corpus")
  Next: Merged/pushed7ea9cce4c adds4wayarrows/S Pass-Restart/EscMenu; rootregistry+touchtestsPASS. Independentordinaryactionreview accepts selectedplayer response, photo1452 delivered. Core complete, no further repetitive keyboardcapture. FIFA-TOUCH-AUDIO-FPS-20261018 tracks unvalidatedgeometry/simultaneoustouch/device/audioFPS; no publicrelease.
  Done: a FIFA demo registered with reviewed match gameplay + touch layout; commit.

- [x] Implement documented explicitly enabled DX7 color-key blending
  id: D3D-COLORKEY-BLEND-ENABLED-20261015
  status: done (explicit TRUE implementation and combined validation merged)
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Next: Merged6b269258 is an ancestor of main. Exact combined canonical build,16CPU suites,42 observations each WebGL1/2 and22 each actual Worker sync mode passed, including state144 TRUE RGBA substitution and alpha/depth cases. Retained archive68e7b0f SHA independently reverified. This closes the stale test-box blocker only for explicit TRUE; default/FALSE filtering and alpha-key precedence remain open.
  Evidence: docs/palette-combined-validation-20261015.txt; docs/legacy-colorkey-sdk-contract.md; scratch/runs/20261015-palette-combined

- [ ] AVP2 browser gameplay, audio and FPS follow-up
  id: AVP2-BROWSER-AUDIO-FPS-20261018
  status: blocked (listening/reference and runtime/device validation unavailable)
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  Next: Existing gameplay/audio and offline signal review are complete at54325b3f1; do not repeat them. Remaining audiblequality needs listening plus a reference; no listening-capable tool is available in this session. LogicalFPS/device need a new measurement-capable run, held on safe diskheadroom (current2.297GB, recent dropbelow2GiB). Retain exact evidence20261018-avp2-audio-capture and20261018-avp2-audio-signal-review; no fresh success claim.
  Evidence: scratch/runs/20261018-avp2-browser-launch; scratch/runs/20261018-avp2-paired-plan


- [~] Black & White 2 draw-layout provenance follow-up
  id: BW2-DRAW-LAYOUT-PROVENANCE-20261018
  status: blocked (live Worker placement/correlation and stopped runtime box)
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  Next: Observer and capture adapters integrated through e6fd3b86f; independent review corrections201758750 and root12JS tests PASS. Live Worker logging/transport placement, matching region-map receipt and request correlation remain unverified. Savedbx_9ef2wdsw stopped; prior scopedresume403 unresolved. No producer attribution or current original draw evidence.
  Done: Identify actual producer with current evidence, then justified fix and meaningful regression; retain accepted camera controls.

- [ ] Qualify FIFA98 touch usability, audio and logical gameplay FPS
  id: FIFA-TOUCH-AUDIO-FPS-20261018
  status: blocked (browser admission below4GiB; device/audio/FPS evidence missing)
  owner: unowned
  Next: Core keyboardgameplay accepted and touchlayout7ea9cce4c merged. Validate touchgeometry/simultaneousinput on device, audio listening/reference and logicalFPS separately. Existing captures do not establish these. Preserve originals; no publicdeployment.

- [~] New-game lane: SuperTux 0.1.3 original Windows release
  id: NEW-GAME-SUPERTUX013-20261018
  status: done (registered first-level movement and jump reviewed)
  owner: /root/supertux_registration
  Next: Registered realticks run20261018-supertux-registered-gameplay verifies same-life left/right and Options-confirmed Space jump/landing; root reviewed right and jump sequence,3119pins/originals/groupemptyPASS, both exits0. Docs aea0ceb44 main. Audio/FPS/browser/device/fullgame remain unqualified. Refill worker new_game_refill_after_supertux selects next actionable nonpublic title.
  Done: Working original launch, ordinary player gameplay and reviewed screenshot; register separately without publicdeploy.

- [~] New-game lane: LBreakout2 2.5.1 original Windows release
  id: NEW-GAME-LBREAKOUT2-20261018
  status: done (registered paddle movement and ball launch reviewed)
  owner: /root/new_game_refill_after_supertux
  Next: Controlledrun20261018-lbreakout2-controlled-gameplay rootreviewed same-life paddle320->196->442 idle and separateSpaceballrelease; laterlifeloss retained. Both exit0/root3413pins230originals/groupemptyPASS. Docsdf05a7330 pushed. No sustainedplay/audio/FPS/device claim. Fresh new_game_refill_after_lbreakout selecting replacement.
  Done: Working original launch, ordinary player gameplay and reviewed screenshot with exact source/run identity.

- [~] New-game lane: LGames LMarbles 1.0.8 original Windows release
  id: NEW-GAME-LMARBLES-20261018
  status: done (registered selection and movement independently reviewed)
  owner: /root/new_game_refill_after_lbreakout
  Next: Run20261018-lmarbles-corrected-selection: root reviewed selectionring and blue tile2,1->4,1 Moves18->17 ordinaryRight with balancedrelease; independent3279pins86original/groupemptyPASS bothexit0. Core qualified; clippedhostedges/audioFPS/browser/fullgame remain unverified. Fresh /root/new_game_refill_after_lmarbles selecting replacement source-only.
  Done: Working original launch, ordinary player gameplay and reviewed screenshot with exact source/run identity.

- [~] New-game lane: LGames LTris 1.2.8 original Windows release
  id: NEW-GAME-LTRIS-20261018
  status: done (registered lateral player control independently reviewed)
  owner: /root/new_game_refill_after_lmarbles
  Next: Root reviewed samegreenI20px left atsamey with PiecesPlaced0 then releaseidle retainsx whilegravitymovesy. Registeredrun20261018-ltris-registered-gameplay root3234pins40originalarchive/module/groupemptyPASS exits0. Rotation testednextsquare ambiguous, right/audioFPS/browser/fullgame unqualified. Fresh /root/new_game_refill_after_ltris selectingreplacement.
  Done: Original working launch, ordinary player-controlled gameplay and reviewed screenshot with exact run/source identity.

- [x] New-game lane: LGames Barrage 1.0.5 original Windows release
  id: NEW-GAME-BARRAGE-20261018
  status: done (reviewed original aim/fire and released idle)
  owner: /root/new_game_refill_after_ltris
  Next: Root reviewed 20261018-barrage-reviewed-gameplay: two crosshair moves, one250ms shot impact, ammo36to30 holds releasedidle. Root3244pins45original/module/groupemptyPASS exits0. No durable score/audio/FPS/browser/fullgame claim. Replacement source screening assigned /root/refill_after_barrage.
  Done: Original working launch, ordinary player-controlled gameplay and reviewed screenshot with exact run/source identity.

- [~] New-game lane: Circus Linux! 1.0.0 original Windows release
  id: NEW-GAME-CIRCUS-LINUX-20261018
  worker: none (RichEdit source delivered; remaining prerequisites coordinator-owned)
  status: active (remaining callback source prerequisites; ICM native validation pending)
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  Next: Property-page/CRT/qsort/bsearch fixes are already main. ICM ownership066436de plus real-x86 fixture1bae355 are off main pending fullVM. edit-stream-owner-oct20 delivered RichEdit edit_stream_call source3c01665c; its fullVM remains pending and remaining callback/JS/concurrency/SEH prerequisites keep jump APIs disabled. Runtime403 blocks native/gameplay evidence, not source work.
  Done: Original working launch, ordinary player-controlled gameplay and reviewed screenshot with exact run/source identity.

- [x] New-game lane: Mad Bomber 0.2.5 original Windows release
  id: NEW-GAME-MADBOMBER-20261018
  worker: none (scoped gameplay acceptance complete)
  status: done (original launch, ordinary player-controlled gameplay and reviewed screenshots accepted)
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Evidence: CLI acceptance0c0fa3eb and browser acceptancef09e09c6: original registered launch, Enter One Player, Space starts bombs, ordinary mouse bucket movement, catch splash and score0→1→3 with reviewed screenshots and exact run/source/module identities. See docs/re-notes/madbomber-status-20261021.md and docs/reviews/madbomber-gameplay-integration-20261021/README.md, docs/reviews/madbomber-browser-integration-20261021/README.md.
  Notes: Prior runtime403 and unobserved SDL/gameplay blockers are superseded for this Done criterion. MADBOMBER-WINMM-ERROR-TEXT-20261019 retains separate native API qualification; it does not reopen accepted original gameplay. FPS acceptance768044a7 (docs/reviews/madbomber-fps-integration-20261021/README.md) covers only94logical entries/4438.655ms=21.1775864536FPS in one instrumented interval. Audio quality, sustained play/performance, display/uninstrumented/native hardware FPS, full-game completion and Windows parity remain unqualified.
  Done: Original working launch, ordinary player-controlled gameplay and reviewed screenshot with exact run/source identity.

- [~] Legacy texture cube API conformance
  id: D3D-LEGACY-TEXTURE-CAPS-AUDIT-20261013
  worker: Published604542782 all8 canonical/compat queuedWorker/direct WebGL1/2 public child overwrite cells PASS176observations144draws24renderednegatives; root18fullSHAverified normalSTOPPED snapshotverified04:21:53Z. Publishede8647f27f adds spatial point/bilinear/trilinear oracle and rendered nearest-only negative PASS; first positive canonical queuedWorkerWebGL1 MINLINEAR fails RGB121,50,107 vs113.752,42.28,103.405 after four passing observations. Zero completed positive cells; seven others unexecuted. Root11fullSHA PASS; bx_2am3q4y3 normalSTOPPED04:32:11Z snapshotverified. Fresh legacy-integer-center-interpolation worker01a1a4d3-62de-74e3-a4a5-619c606cfda8 session76001 already owns offline causal repair preserving top-left coverage and independent oracle; no duplicate dispatch/runtime. PhysicalGPU/full27 unknown. No sourcearchives/mediaevidencecopies.
  status: partial (capability corrections and public COM software/WebGL/queued Worker sampler rendering accepted; broader advertised behavior audit remains)
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  Next: Do not reintegrate historical branch patches: current main includes cube122109793, BORDER93addaa3c and fixture-bootstrap682d0c824; common producer masks are texture0xF7DF/address0xF7. Retained actual public COM fixture passes47calls/45descriptors on pinned modulebc5412c1 (docs/re-notes/legacy-caps-early-exit-20261020.md), with current offline1053negative controls PASS. Existing Surface4/7 COM regression asserts failed cube creation, null output and intact guards; docs/legacy-surface47-abi-20261019.txt records both-dispatch historical candidate passes (a74ccff4/c0192423). That historical raw evidence is not currently located. Continue the advertised software/GPU behavior audit and current-runtime cube rejection/backend rendering coverage; do not create a duplicate source-only rejection test. Historical native pass does not prove current runtime or independent-face storage/backend/gameplay. Surface4/7 ABI already merged. Reconciliation evidence: scratch/runs/20261103-legacy-caps-main-reconcile/.
  Accepted 2026-11-04: be2fc974600230e15c1f05ee06c05890d2411dab; public DD7/QI D3D7/CreateSurface/CreateDevice real x86 vtable, software18/WebGL18/queued Worker26 exact pixels, same-device point/linear and wrap/clamp transitions, four held batches, nearest-only/stale-wrap negative controls rejected. Bothcanonicalcffca869/compat580f49f3 tested, locked build PASS;39 local indexed SHA256 checked. Snapshot verified and bx_5jkb55xs normal STOP23:59:07Z. Test test/test-legacy-texture-rendered-contract.js and note docs/re-notes/legacy-texture-rendered-contract-20261103.md. This bounded sampler contract does not establish full27/gameplay or all advertised capabilities.
  Accepted 2026-11-04:1329b1ba6 public DD7/D3D7 cube E_NOTIMPL/null/guards/descriptor integrity plus characterized unadvertised BORDER fallback (software WRAP/GPU CLAMP), both actual modules/software/WebGL/queued Worker; six negative controls rejected and locked build passed. Root verified14 recovered files/BOTH modules. Named snapshot verified, bx_46nt6vad normal STOP01:36:28.061Z. Genuine cube storage and BORDER-color support remain unimplemented/unadvertised. Evidence docs/re-notes/legacy-caps-cube-border-20261104.md.
  Done: Correct advertised API and software/GPU behavior with versioned contract and tests.

- [ ] Authorized original installer acceptance
  id: NEW-GAME-AOE3-DEMO-20261010
  blocker: Existing sandbox.resume 403 api_key_action_forbidden; requires documented authorized runtime access change and coordinator allocation, not a retry.
  status: blocked (authorized acceptance; runtime and original-media prerequisites)
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  worker: none (awaiting authorized runtime and verified original closure)
  candidate: test/binaries/win98-games-a-d/Age-of-empire-3trial-Win98-SW.exe
  Next: Ordinary Accept/Yes authorization persists from20261018; acceptedInGuest=false until observed. Recover/verify original installer, supporting assets and historical receipt, then use an authorized bounded runtime to observe acceptance and installed payload. Local exact-path observations and unknown remote availability are in docs/re-notes/dashboard-actionable-reconciliation-20261020.md.
  Previous checkpoint (licence-decision hold superseded): Original reaches EULA with InterlockedExchangeAdd candidate, XP profile, native MSXML4 and its resource DLL. Screenshot991 sent; no button answered. Evidence scratch/runs/20261010T0430Z-aoe3-eula. Await user review before gameplay; pipeline refilled Beyond Good and Evil.
  Done: Ordinary original launch reaches player-controlled gameplay with reviewed screenshot and run/build identity; tested fixes on main.
  Authorization: docs/license-acceptance-authorization-20261018.json; acceptedInGuest=false until observed.


- [ ] Authorized original installer acceptance
  id: NEW-GAME-CONAN-DEMO-20261010
  blocker: Existing sandbox.resume 403 api_key_action_forbidden; requires documented authorized runtime access change and coordinator allocation, not a retry.
  status: blocked (authorized acceptance; runtime and original-media prerequisites)
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  worker: none (awaiting authorized runtime and verified original closure)
  candidate: test/binaries/win98-games-a-d/Conan cauldron-DX9-D3D/ConanPC-Demo.exe
  Next: Ordinary Accept/Yes authorization persists from20261018; acceptedInGuest=false until observed. Recover/verify original installer, supporting assets and historical receipt, then use an authorized bounded runtime to observe acceptance and installed payload. Local exact-path observations and unknown remote availability are in docs/re-notes/dashboard-actionable-reconciliation-20261020.md.
  Previous checkpoint (licence-decision hold superseded): Original staged and SHA verified on bx_hx8msa33. Ordinary language/welcome/destination inputs reach EULA with I Reject selected, run20261010T0803Z-conan-destination. Do not answer acceptance. No installer process running; extracted game not yet available. Refill actionable new-game slot while this remains held.
  Done: Original launch, player-controlled gameplay, reviewed screenshot and tested fixes on main; no public deployment.
  Authorization: docs/license-acceptance-authorization-20261018.json; acceptedInGuest=false until observed.


- [ ] Authorized original installer acceptance
  id: NEW-GAME-ARANNA-DEMO-20261010
  blocker: Existing sandbox.resume 403 api_key_action_forbidden; requires documented authorized runtime access change and coordinator allocation, not a retry.
  worker: none (awaiting authorized runtime and verified original closure)
  status: blocked (authorized acceptance; runtime and original-media prerequisites)
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  candidate: test/binaries/win98-games-a-d/DungeonSiegelegendsofaranna_demo-D3D.exe
  Next: Ordinary Accept/Yes authorization persists from20261018; acceptedInGuest=false until observed. Recover/verify original installer, supporting assets and historical receipt, then use an authorized bounded runtime to observe acceptance and installed payload. Local exact-path observations and unknown remote availability are in docs/re-notes/dashboard-actionable-reconciliation-20261020.md.
  Previous checkpoint (licence-decision hold superseded): Generic RTF fix cedee9b54 now shows readable original EULA; before1504Z/after1523Z browser evidence reviewed. No acceptance provided and no input sent. Payload /home/user/aranna-game-20261010 remains on bx_hx8msa33; no gameplay/FPS/audio qualification. Active slot refilled Invisible War.
  Done: Original launch, ordinary player-controlled gameplay and reviewed screenshot with source/build identity; fixes committed on main.
  Authorization: docs/license-acceptance-authorization-20261018.json; acceptedInGuest=false until observed.


- [~] Shadow Man original demo: installed launcher/configuration response accepted
  id: NEW-GAME-SHADOW-MAN-DEMO-20261013
  blocker: No current CLI startup/control blocker observed. Browser, longer gameplay, audio, save/load, normal guest exit and corpus registration remain unqualified.
  worker: none (38979 terminal0 reviewed; successor GL64819 launched; Jedi and Alice retain two prospective game lanes)
  status: partial (original CLI menu-to-gameplay and ordinary movement accepted; registration/browser pending)
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  Next: Use established original configuration/Play route for a future bounded browser or longer gameplay qualification; first add a correctly pinned corpus entry if registration is assigned. Publisheddebc24bfc evidence run20261103-shadow-man-config-recover, root review20261103-coordinator-shadow-review. Do not repeat the old disabled-Play investigation.
  Accepted: acceptedInGuest=true observed2026-10-22T20:01:25.326828Z (ordinary Ja, batch1191279, destination screen follows); installer ExitProcess(0), all1959 original payload hashes match. Historical authorization JSON remains unchanged. On2026-10-23 one original launcher session/one ordinary Konfiguration1024 action opened Configuration HWND0x10006; both genuine PNGs independently reviewed. Canonical SHA256ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553; source/main58e90870.
  Historical limits (2026-10-23): Spielen disabled; no settings accepted/saved, gameplay, normal configuration/game guest exit, Windows/browser/audio/FPS qualification. ABANDONED wndproc after64rounds/yield15 remains a limitation; parent OSexit-9 is not a guest exit. bx_vufrds5w snapshot-STOPPED2026-10-23T01:26:26.642Z; coordinator owns lifecycle.
  Evidence: docs/re-notes/shadow-man-launcher-evidence-accepted-20261023.md; scratch/runs/20261023-shadow-man-launcher-evidence-status-integrate/REPORT.md. Candidate340803e35428c88f1946e52112e322b1733fb346; restorationd6c7a71cad22bc37ebc73e586c92fd5497901689; original installba485e8a27ad8a0cc25a14d40427e8cbfd38eec3.
  Done: Original launch, ordinary player-controlled gameplay and reviewed screenshot with source/input/build identity, or exact remaining blocker.
  Authorization: docs/license-acceptance-authorization-20261018.json (historical authorization receipt; actual acceptance is separately observed above).

- [~] Include all supported games in Wine Ops, including Outlaws
  id: TG98-OPS-SUPPORTED-GAMES-20261019
  status: done (live private Ops coverage verified)
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Next: Integrated602be17c 21focused tests/root PASS. PrivateOps-only restart2722049 preserves emulator40fe91b98/module02b41f09 and data root; live351entries/all347registered IDs covered includingOutlaws. No false launch on old emulator. Receipt20261019-ops-supported-rollout; Telegram1481.
  Done: Supported registry coverage tested, Outlaws visible with accurate launch/readiness, scoped rollout verified.

- [x] Implement SetLocalTime virtual guest calendar
  id: SETLOCALTIME-COMPAT-20261019
  status: done (API implementation qualified; original Mad Bomber separate)
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Evidence: main d537eddbe; normal build, exact tail/compat native API and real Worker controls PASS; root host/CMOS/DST tests PASS.

- [x] Validate original Mad Bomber after SetLocalTime support
  id: MADBOMBER-SETLOCALTIME-ORIGINAL-20261019
  status: done (original CRT initialization progressed; SDL remains blocked)
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: /root/setlocaltime_compat
  Result: Original run20261019-madbomber-setlocaltime-2 resolves SetLocalTime to00db9a34 and original CRT DllMain returns1. SDL DllMain returns0 after waveOutGetErrorTextA lookup returns0; separate API diagnosis follows. No gameplay. All3408pins unchanged, process groups/lease released and evidence recovered.

- [ ] Resolve original Mad Bomber SDL WinMM error-text dependency
  id: MADBOMBER-WINMM-ERROR-TEXT-20261019
  status: partial (historical exact-source fullVM public API qualification accepted; original SDL observation separate)
  owner: codex:01a19022-1426-76b3-ae98-6265fb15fd66
  worker: none (independent historical API review complete)
  Evidence: Implementation7fd352855 and source reviewfe540cf2; retained native qualification01dfb0d98 independently accepted in docs/re-notes/madbomber-winmm-native-independent-review-20261024.md. Exact historicalb41a7c5 normal module8fac3993: unchanged public A/W native fixture exit0, host exit0, wrong-hash rejection exit1 before compile/memory. This does not qualify the current-main module or original SDL.
  Next: Coordinator-owned original SDL observation remains outside this API evidence; keep this checkbox open until its exact requirement is reviewed. Existing original gameplay acceptance under NEW-GAME-MADBOMBER-20261018 remains intact. No runtime allocation or retry is implied.
