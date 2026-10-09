# TODOS

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

- [~] Compare NFS3 speed and correctness in Glide, D3D and original software
  id: NFS3-RENDERER-BENCH
  status: active
  created: 2026-10-02T04:00:31.545Z
  created-by: user-request via ops-dashboard
  candidate: need-for-speed-3-demo
  Next: Review CDP SwiftShader versus Glide endpoint Intel/Mesa identity discrepancy from the completed failed attempt; propose evidence-backed correction without rerunning.
  Done: Report all three guest renderer paths on the same identified source/WASM/browser/CPU/GPU, resolution and controlled race/weather/input route. Separate original game software rendering from our software backend; verify no hidden GPU fallback or SwiftShader substitution. Save reviewed race images, repeated warmed-up FPS/frame-time median and p95, CPU profiles, draw/triangle/texture/upload/readback/fallback counters, sample counts and spread, plus same-path control. Report unavailable paths explicitly. Record bottlenecks and a predeclared performance acceptance budget; historical high-load FPS is not a current baseline.
  Evidence: ops/handoffs/nfs3-renderer-bench.md; scratch/nfs3-renderer-bench-20261002/closure-report.json; scratch/nfs3-renderer-bench-20261002/local-resource-preflight.json; ops/handoffs/nfs3-capacity-recheck.md; ops/handoffs/nfs3-software-prep.md
  owner: codex:01a0f9db-07f4-71d2-9fe8-42d5efc7f642
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
  status: backlog
  created: 2026-10-02T04:00:31.545Z
  created-by: user-request via ops-dashboard
  candidate: pirates-2004
  Next: Captain-route stop remains independent and unmeasured. Before claiming current-main actual rectangular/filter2 transfer, reconcile missing archived implementation under PIRATES-TRANSFER-REENTRANCY; main058b82eba still explicitly traps those shapes. Preserve historical no-transfer outcome; do not rerun old-build recipe as current-main acceptance.
  Done: Identify the route failure and either validate the actual game transfer/readback with reviewed images or record a precise blocking dependency. Link unresolved terrain defects separately; a zero-transfer run is not a rendering pass.
  Evidence: ops/handoffs/mig-pirates-stretch.md; ops/handoffs/mig-pirates-stretch-recipe.md

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

- [ ] Diagnose Pirates white terrain with a controlled capture
  id: PIRATES-TERRAIN-REVIEW
  status: backlog
  created: 2026-10-02T04:16:51.185761+00:00
  created-by: orchestrator-handoff-audit
  depends-on: PIRATES-ROUTE-FOLLOWUP
  candidate: pirates-2004
  Next: Separate terrain rendering from the captain-route stop and reproduce the visible defect on an identified reachable gameplay state.
  Done: Reviewed terrain evidence identifies the failing contract and focused correction or concrete dependency; no zero-transfer pass used as terrain proof.
  Evidence: ops/handoffs/01a0f736-78f1-7822-8b37-159d6f8ed94d.md

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


- [~] Measure browser FPS for strongest local and desktop game candidates
  id: OPS-GAME-FPS-BASELINE
  status: active
  candidate: jazz-jackrabbit-2-demo-installer, reflexive-collapse-crunch, reflexive-ricochet-xtreme, unreal-special-edition, gta2-demo
  done: Publish run performance metadata with guest present counts, wall duration, per-sample p95 frame time, renderer/GPU, hardware-versus-SwiftShader, scene, build hash and measurement date; review playable route before measuring. No menu, browser rAF or CLI batch timing relabelled as gameplay FPS.
  Next: Review ordinary Ricochet ball-launch input and evolving-gameplay scene admission; preserve ready-board diagnostic without publishing it as gameplay FPS. Continue GTA2 after NFS3 clean release.
  Notes: Ricochet root100hash/arithmetic audit and eight images reviewed: apparently unlaunched ball/full bricks/zero score, gameplay measurement unaccepted. Host released; NFS3 transferring. Collapse association preparation under root review/callsite proof assigned; Jazz route and Unreal package remain pending.
  owner: codex:01a0f9db-07f4-71d2-9fe8-42d5efc7f642
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

- [~] Keep two new games moving toward playable gameplay with screenshots
  id: NEW-GAMES-PIPELINE
  status: active
  reclaimed: 2026-10-07T07:42:56.312Z
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  accepted: 2026-10-04T02:11:10.446Z
  accepted-by: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Next: User-first Return Fire native/browser windowed gameplay and colors verified; audio/logical FPS follow-up. Alice CRT heap lifetime investigation second; BG2 installer preflight queued. One worker/runtime on temporary boats.
  done: Recurring user priority, not complete after two games; each child task needs a working launch route, visible player-controlled gameplay, ordinary input response and a reviewed screenshot linked to its run and source.
  notes: Known freeware/shareware/demo titles first; public NFS/Diablo/StarCraft variants do not count as new games. Serialize browser and benchmark ownership; preserve review gates. Standing policy in ops/ORCHESTRATOR.md.

- [~] Inventory every game and complete gameplay screenshot/FPS coverage
  id: OPS-ALL-GAMEPLAY-COVERAGE
  status: active
  reclaimed: 2026-10-07T07:42:56.312Z
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  created: 2026-10-03T08:30:54.631Z
  created-by: user via Telegram
  accepted: 2026-10-03T08:30:54.631Z
  accepted-by: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Next: Nine October9 owned records repaired to dashboard schema with original metadata retained; actual reader accepts9/9, zero matching warnings. SimCity reviewed city/budget images now exposed (2 gameplay images); failed startup, EULA hold and native-only tests remain unqualified. Continue existing FPS/audio and two-backend obligations; evidence ops/handoffs/run-metadata-schema-repair-20261009.json.
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
  status: active
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  prev-owner: claude:1863d2b5-bc58-4c0b-9c15-00fc951f0256 (fleet stopped)
  created: 2026-10-06T02:09:48.337Z
  accepted-by: claude:80aa9e95-435b-4acb-aeea-8ae3d860613c
  Next: October9 coverage reconciles retained Morrowind prison movement (4image hashes + module verified), Pirates sailing images (6referenced logs missing, no fresh backend qualification), AoWII software army movement (render defects remain), and BW2 fixed Worker startup/live normal intro. QuakeII/Crimsonland/AlienShooter/WC3 two-backend results retained. PBO standalone Chrome reproduction completed; do not restart speculative renderer diagnosis. Finish ordinary BW2 route, then queued DisciplesII; retain software/WebGL/FPS/audio/current-main gaps per docs/gl-d3d-corpus-status.md. Winamp held, HeroesII laptop-owned.
  Done: Status table for the full GL/D3D set in docs (software + WebGL per app, with run ids), and each fixed app has a reviewed in-game screenshot and commit on main.
  Evidence: memory project_gl_d3d_corpus_goal (27-app set, 2026-09-22); tools/gfx-app-census.js; tools/gl-name-census.js

- [ ] D3DIM async-flip PBO trips Chrome "READ-usage buffer written again before being read back"
  id: D3DIM-ASYNC-PBO-WARN-20261006
  status: blocked
  note: 2026-10-06T21:25Z parked at WIND-DOWN, not started. Next: page probe on MW3 menu wrapping the D3DIM executor's readPixels/fenceSync/getBufferSubData (lib/d3dim-gpu.js asyncFlip path) to find which PBO is written again before its readback; likely reuse of one PIXEL_PACK_BUFFER across flips while an earlier read is inflight -> ring of PBOs or wait on the fence before reuse.
  note: 2026-10-06T20:25Z claude:1863d2b5 claimed: code read finds no write-before-read path; next a page probe wrapping readPixels/fenceSync/getBufferSubData on MW3's live context (browser queue).
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
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
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
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
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: none (automatic security rejection; exited1)
  created: 2026-10-06T04:51:54.000Z
  accepted-by: claude:80aa9e95-435b-4acb-aeea-8ae3d860613c
  Next: Hold rejected crash diagnostic; no retry/rephrase. WIP preserved, remote bx_fugmje42 authoritatively stopped after expiry, full cleanup/evidence retrieval incomplete. See ops/handoffs/antara-security-hold-20261008.md. No installation/gameplay qualification.
  Done: Working registered launch, ordinary player input visibly changes actual gameplay, reviewed gameplay screenshot with run/source identity, scoped fixes + tests on main. FPS, audio and browser separate.
  Evidence: scratch/new-game-antara-20261006 (work), scratch/runs/<id> (reviewed captures)

- [ ] New-game lane: Arx Fatalis demo (original local MSI/CAB media)
  id: NEW-GAME-ARX-FATALIS-DEMO-20261007
  status: blocked
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
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

- [ ] Quake II WebGL ordinary world movement validation
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
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: none (bad-transfer worker exited1 at2026-10-08T13:02:23.732Z after automatic cybersecurity rejection)
  candidate: test/binaries/win98-games-a-d/CnC-TiberianSun-demo-SW/extracted
  Next: Parent10002 DirectDraw repaint loop and registered COM shadow-CPU activation repaired, including AddRef ULONG edge correction; root11182 hashes and real owner/paint regressions passed. Ordinary campaign loading now reaches first OleRun, then owning trap atEIP00d88176/ESP00d88168 in heap frame data. Next capture first bad control-flow producer, including activation continuation integrity; do not assume an independent guest defect or redo cleared menu/COM causes. Final AddRef edge tested/build-only d8d4096 differs from actual browser ff3281; gameplay still unqualified.
  Evidence: Shared historical task and fresh worker title audit2026-10-07. Darkstone already has controlledTown/camera evidence, so it is not rerun or counted as a new title. Tiberian Sun remains nonpublic and unqualified.
  Done: Registered original launch reaches a mission, ordinary input visibly commands units, reviewed screenshot with exact source/run identity, scoped tested changes pushed main. FPS/audio require separate evidence.
  Blocker: Diagnostic preparation was rejected automatically for possible cybersecurity risk. No retry, rephrasing, or delegation of rejected operation. Existing work preserved; no new gameplay evidence.

- [~] Diagnose original Winamp MilkDrop exception and validate visualization
  id: GLD3D-WINAMP-EXCEPTION-20261007
  status: blocked
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
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

- [ ] Gameplay screenshot and FPS: Arcanum: Of Steamworks & Magick Obscura Demo
  id: GAMEPLAY-arcanum-demo
  status: ready

  candidate: arcanum-demo
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: none (coverage worker exited0; gameplay both backends and WebGL measurement reviewed)
  prev-owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5 — Codex out of credits until 2026-10-12; its uncommitted shared-tree work is preserved on archive/codex-shared-tree-20261006 (see ops/handoffs/codex-release-review-20261006.md)
  created: 2026-10-03T08:42:45.967Z
  accepted: 2026-10-03T08:42:45.967Z
  accepted-by: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Next: Remaining software scene-qualified FPS only. Root reviewed ordinary crash-site movement on software/WebGL and336 contained hashes. WebGL434 visible compositor submissions/20.127145s=21.562919/s verified from raw samples; physical scanout/unique pixels not claimed. Initial software observer missed OffscreenCanvas; raw zero rejected, not 0FPS. Corrected observer contracts pass; use them for a future bounded software measurement without repeating already-qualified screenshots. Run20261008T1431Z-arcanum-gameplay-qualified, reference7e4/moduled8d4096; no engine fix.
  Done: Reviewed gameplay screenshot and scene-qualified frame measurement with raw samples, counter proof and tested build identity; retain explicit failures.
  Evidence: scratch/gameplay-coverage-20261003/tasks/GAMEPLAY-arcanum-demo.json
  notes: Migration missing-file blocker cleared against current registered route: arcanum_demo. Historical missing-path report is superseded for this route; gameplay remains unverified.

- [ ] Gameplay screenshot and FPS: Black & White 2 Demo
  id: GAMEPLAY-black_white_2_demo
  status: ready
  Next: Normal-route browser ended at fixed90minute deadline05:05:50Z, moving island flyover only. Final242 artifacts retained run20261009T0335Z-black-white2-staging-fix; no player-control/FPS credit. Diagnose current missing declaration binding/rendered right edge, then validate ordinary gameplay; old drive34 already ruled out SetFVF(0) for that route.

  candidate: black_white_2_demo
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: root direct; no subagent (one-worker budget)
  prev-owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5 — Codex out of credits until 2026-10-12; its uncommitted shared-tree work is preserved on archive/codex-shared-tree-20261006 (see ops/handoffs/codex-release-review-20261006.md)
  created: 2026-10-03T08:42:45.967Z
  accepted: 2026-10-03T08:42:45.967Z
  accepted-by: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Done: Reviewed gameplay screenshot and scene-qualified frame measurement with raw samples, counter proof and tested build identity; retain explicit failures.
  Evidence: scratch/gameplay-coverage-20261003/tasks/GAMEPLAY-black_white_2_demo.json
  notes: Migration missing-file blocker cleared against current registered route: black_white_2_demo. Historical missing-path report is superseded for this route; gameplay remains unverified.

- [ ] Gameplay screenshot and FPS: Deus Ex demo
  id: GAMEPLAY-deus-ex-demo
  status: ready

  candidate: deus-ex-demo
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: none (queued under one-worker budget)
  prev-owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5 — Codex out of credits until 2026-10-12; its uncommitted shared-tree work is preserved on archive/codex-shared-tree-20261006 (see ops/handoffs/codex-release-review-20261006.md)
  created: 2026-10-03T08:42:45.967Z
  accepted: 2026-10-03T08:42:45.967Z
  accepted-by: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Next: Registered deus_ex_demo fixture rechecked2026-10-08: 112 declared executable/DLL/asset/manifest paths exist, declared sizes match. Missing-file blocker is cleared; queue ordinary gameplay and scene-qualified FPS validation after current sole lane. Presence does not prove runtime readiness. Receipt scratch/runs/20261008T0810Z-queued-fixture-recheck/fixture-presence.json; docs ops/handoffs/queued-fixture-recheck-20261008.md.
  Done: Reviewed gameplay screenshot and scene-qualified frame measurement with raw samples, counter proof and tested build identity; retain explicit failures.
  Evidence: scratch/gameplay-coverage-20261003/tasks/GAMEPLAY-deus-ex-demo.json
  notes: Migration missing-file blocker cleared against current registered route: deus_ex_demo. Historical missing-path report is superseded for this route; gameplay remains unverified.

- [x] New-game lane: Age of Wonders II demo
  id: NEW-GAME-AGE-OF-WONDERS2-DEMO-20261008
  status: done
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: none; browser41887 exited0; bx_2sdgzsm6 stopped03:11:23.355Z
  candidate: test/binaries/win98-games-a-d/Age of Wonders2 demo-SW.exe
  Next: Initial ordinary gameplay verified: select party and click destination twice, army moves and movement20->13. Generic FVF RESERVED1 fix plus control-failing/candidate-passing native tests integrated with this task update. Evidence run20261009T0306Z-age-of-wonders2-gameplay,67 hashes. Rendering overlap/FPS/audio tracked separately; no release claim.
  Evidence: Original installer SHA256 1244f0114965d011d1e28b97e207db15c902d124ebb25af8a6c97748beb73dc0. Runs20261008T1518Z-age-of-wonders2-demo-before and-after retain crash/menu evidence, original payload identities and runtime inputs. No gameplay qualification yet; held Scenario click eventual outcome unknown.
  Done: Normal registered launch, actual player-controlled gameplay, reviewed screenshot with original/source/build identity and tested changes pushed main. FPS/audio require separately valid measurements.

- [ ] New-game lane: Dungeon Siege demo
  id: NEW-GAME-DUNGEON-SIEGE-DEMO-20261008
  status: blocked
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: none; browser56868 exited0, bx_f8a9afpr stopped2026-10-09T01:31:52Z
  candidate: test/binaries/win98-games-a-d/DungeonSiege-demo-D3D.exe
  Next: Await user decision on accepting demo EULA under the instruction not to answer approvals. Generic lazy RTF fix main b493bc3b9 passes; original EULA window renders, screenshot Telegram947. Evidence scratch/runs/20261009T0125Z-dungeon-siege-eula (36 hashes). No gameplay/FPS/audio qualification.
  Evidence: Local original installer 192188416 bytes, SHA256 a501306cad88c0fc41f986d92109343d68ac79fc11aaa6611724d84be628f3f8. Experimental local registration and checked CAB extraction integrated ef51b4f59; registration is not gameplay qualification.
  Done: Normal registered launch, actual player-controlled gameplay, reviewed screenshot with original/source/build identity and tested changes pushed main. FPS/audio require separately valid measurements.

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
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: root; native and browser movement verified, input/FPS/audio follow-up ready; all runtimes terminal
  candidate: test/binaries/win98-games-a-d/Discipless2_demo-D3D.exe
  Next: Registered native and browser gameplay verified: ordinary leader move20/20->16/20 and camera follow, reviewed run20261009T0728Z-disciples2-browser-gameplay, photo967. Registration fd5aa4a35 on main. Browser50788/50800 clean stop07:28:27Z. Menu repeat-click issue remains despite1000ms holds and both down/up reaching renderer/input log; inspect guest consumption/activation.30.10599s presentation sample2432 events/1649 uploads is80.7813/54.7732 per second, not logical FPS. Qualify gameplay counter and audio separately. No public promotion. Alice real GL implementation is next unblocked implementation lane.
  Evidence: scratch/disciples2-preflight-20261009/preflight.json
  Done: Registered normal launch, actual gameplay control, reviewed screenshot, fixes/tests pushed main.

- [ ] AoWII rendering overlap and gameplay measurement
  id: AOW2-RENDERING-COVERAGE-20261009
  status: ready
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Next: Diagnose terrain crossing lower UI/black polygons after validated FVF fix; measure actual gameplay FPS and audio separately. Initial army movement is verified, release readiness is not. Use temporary box and serialized browser.
  Evidence: scratch/runs/20261009T0306Z-age-of-wonders2-gameplay/result.json

- [ ] New-game lane: American McGee's Alice demo
  id: NEW-GAME-ALICE-DEMO-20261009
  status: active
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  worker: root direct; first-error trace20640 live on bx_42ztf6q5; prior watch40779 terminal21:04:42Z
  candidate: test/binaries/win98-games-a-d/american McGees-alice_demo-OpenGL.exe
  Next: First free proved: Z_Free00444f18 -> CRT, header084909e0, tag4 cleanup00444f51 from00454464. Later guard trace caller029b706b maps fgame original1007706b freeing the same user pointer084909f0 via imported allocator. Need earlier Com_Error438ad0 message to distinguish primary load error from cleanup double-free; trace20640 active on bx_42ztf6q5,240s bounded. Source run20261009T2104Z-alice-free-caller; current boat rebuild527004d9 matches exactly, run2108. BG2 installer preparation second lane queued under one-worker budget. No gameplay qualification.
  Done: Original demo launches with ordinary input, player-controlled gameplay independently reviewed, exact build/media and screenshots retained; menus do not qualify.
  Evidence: scratch/alice-preflight-20261009/preflight.json; scratch/alice-preflight-20261009/import-audit.json; scratch/alice-preflight-20261009/transfer.json; docs/re-notes/alice-demo.md


- [ ] Sizeless virtual decommit corrupts neighboring allocation
  id: VIRTUAL-DECOMMIT-NEIGHBOR-20261009
  status: ready
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  Next: test-virtual-decommit-zero fails neighboring allocation page0 untouched with unchanged HEAD helpers and prefix candidate. Static cause: virtual_map_decommit_zero chooses each scanned record end when size0, so all higher allocations are zeroed. Bound once to the owning reservation before scanning; handle invalid/interior bases and split mappings with tests. Do not attribute this baseline failure to prefix patch. Native tests only on temporary boat, serialize with game lanes.
  Evidence: scratch/runs/20261009T0608Z-virtual-prefix-initial/result.json

- [ ] New-game lane: Baldurs Gate II demo
  id: NEW-GAME-BALDURS-GATE2-DEMO-20261009
  status: queued
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  candidate: baldurs-gate2-demo
  Next: Static preflight complete: seven original Wise split installer parts647670892B hashed in run20261009T0852Z-bg2-installer-preflight. Source test/binaries/win98-games-a-d/Baldurs-Gate-2_demo-SW-OpenGL/bg2demogs.EXE and .W02 through.W07. Next remote-only transfer/install, then identify real executable/support paths, currently unknown. Runtime queued behind Alice under one-worker budget; do not extract locally near2GiB floor. Distinct nonpublic unqualified title, replaces qualified DisciplesII novel-slot credit.
  Done: Registered working launch, ordinary player input changes visible gameplay, reviewed screenshot linked to exact run/source. No installer/menu credit or public deployment.

- [ ] User priority: Return Fire demo
  id: NEW-GAME-RETURN-FIRE-DEMO-20261009
  status: active
  owner: codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5
  candidate: return-fire-demo
  priority: user-first
  Next: Correct windowed depth/palette and ordinary H/W gameplay verified in native run20261009T2046Z-return-fire-realized-native and browser run20261009T2050Z-return-fire-realized-browser. Build/focused display suites pass run20261009T2045Z-return-fire-realized-build. Audio output presence now observed in run20261009T2052Z-return-fire-browser-audio (99/100 non-silent windows, running44100Hz clock); recording retained, sound quality/sync and logical FPS still unverified. Registered local-only, no public deploy.
  Done: Registered launch, ordinary input visibly changes gameplay, reviewed screenshot with original source/build evidence; FPS/audio separate.
