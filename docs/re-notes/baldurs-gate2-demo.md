# Baldur's Gate II demo

Distinct from the Baldur's Gate 1 previews in baldurs-gate-demos.md. No BG2
entry exists in the inspected DESKTOP_APPS list or current app registry.

Original local package directory:
`test/binaries/win98-games-a-d/Baldurs-Gate-2_demo-SW-OpenGL/`.
Seven split Wise installer files are present: `bg2demogs.EXE` and
`bg2demogs.W02` through `bg2demogs.W07`. The first six are102400000 bytes each;
W07 is33270892 bytes, total647670892. EXE header strings identify Wise and
"Baldur's Gate II Demo". No payload modification or installation yet.

Run `20261009T0852Z-bg2-installer-preflight` contains exact paths, sizes and
SHA256 for every part. Initial executable SHA256:
`772c67fd2d73599e60a43c74466df11641a55f68ccce02fb82b38e26e666f689`.

Next: transfer the original split package to a temporary boat, inspect the
installer route and extract/install there. Keep all split siblings mounted
together. Installed executable/support paths remain unknown until this is
done. Local disk is near the2GiB floor, so do not extract locally. Serialize
runtime behind Alice; no concurrent second worker under the budget policy.

Acceptance requires registered launch, ordinary input changing gameplay and
a reviewed screenshot with original media/build identity. Installer, menu and
automatic cinematic captures do not qualify. No public deployment or approval
of agreements is authorized by this task.

Original-media transfer started21:12:13Z to bx_42ztf6q5:/home/user/bg2-original-20261009. SCP was unavailable to this API key; existing authorized exec-based file transfer is used instead. Local controller2285616 has immutable21:42:13Z deadline and per-file original/remote SHA256 checks. Receipt scratch/bg2-transfer-20261009/receipt.json is authoritative; partial transfer is not installation. This only copies original files while the one guest-runtime slot stays serialized.

## Remote media staged (2026-10-09T21:38:58Z)

Resumed controller2307995 completed all seven original Wise parts,647670892 bytes, with per-file SHA256 verification on bx_42ztf6q5:/home/user/bg2-original-20261009. Receipt and initial file inspection retained in scratch/runs/20261009T2139Z-bg2-staged-media/. Remote box lacks 7z and unshield; archive listing did not run, even though the piped shell returned0. Next obtain a suitable extractor on the temporary box, inspect the Wise package and determine installed executable/support paths. No installer acceptance, game run or gameplay evidence yet. Boat expires22:04:59Z.

## Outer Wise package extracted

REWise c3d3b68903a90ec53ff7b0a4ae704adc6302814b from https://codeberg.org/CYBERDEV/REWise documents concatenating split W02/W03 files. Original part hashes were rechecked during concatenation. Its default Makefile placed -lz before objects and failed linking; relinking identical objects with -lz last succeeded. Controller131426 completed21:56:59Z. Run20261009T2157Z-bg2-extracted retains extractor revision, exact build command/controller, original hashes and46-file inventory;659095831 extracted bytes. Original failed build129175 is retained remotely, no installer payload was touched by that attempt.

The outer package is a wrapper around another InstallShield installer: /home/user/bg2-extract-v2-20261009/files/MAINDIR/data1.cab, data1.hdr anddata2.cab. Extract those next with unshield; final game asset tree remains unknown. Extra/BGMain.exe is7139374 bytes SHA256944db091d82c6144db8c9a21c085e4504bdc549fca8003c31e309646567bb98b. Extra appears to contain demo overrides, not a complete independently runnable installation; do not launch it with missing resources or silently synthesize config. No game run or agreement acceptance.

Inner InstallShield extraction134145 completed21:59:27Z,651 files830851985 bytes, evidence run20261009T2200Z-bg2-inner-extracted. Grouped files are under /home/user/bg2-inner-20261009/files: hd0_cab contains BGMain.exe/BGConfig.exe/Keymap.ini, plus hd0_data, hd0_music, hd0_override, hd0_scripts, hd0_characters, hd0_sounds andhd0_cache. InstallShield engine groups are also present; do not mistake them for game assets. Next confirm installer destination/group mapping and demo Extra overrides, assemble the original installed tree and run normal startup. No gameplay or final installed layout claim yet.

Named snapshot alice-bg2-20261009 saved3864395776 bytes before temporary-box expiry. Fork bx_hx8msa33 created22:01:05Z, expires23:01:05Z; verify all source/media paths after hydration. Old bx_42ztf6q5 has no live guest/build.

## Main-build character creation and opening dungeon (2026-10-09)

Original installer layout assembled at /home/user/bg2-installed-v2-20261009 on bx_hx8msa33. Main280d28eb1/module527004d9 reaches character creation, opening dungeon and completed Imoen dialogue using ordinary inputs; run20261009T2227Z-bg2-opening-dungeon. Movement not yet verified: prior controller28492/28499 exited22:31:39Z before request59 executed. Fresh bounded movement replay32192 now runs /tmp/bg2-movement-play.js; collect response59 and cleanup. Original demo BGMain SHA944db091; no guest patches or approvals. Register and verify browser after movement; local installed candidate path remains missing.

Installer setup.inx strings confirm hd0 group destinations, Extra overrides and Alias HD0/CD1-CD4 paths. Assembly script/audit are retained in scratch/runs/20261009T2209Z-bg2-install-layout. Windows case-insensitive overlay semantics applied; only installer path aliases synthesized, no gameplay settings changed. Chitin.key references76 files absent from the demo after case-insensitive resolution; exact names in assembly.json, not yet an observed runtime failure. The complete original demo overlay executable SHA256 is944db091d82c6144db8c9a21c085e4504bdc549fca8003c31e309646567bb98b.

Name entry needs ordinary keydown/keyup (65 inserted a); keypress alone did not populate this field. Ended Imoen dialogue with visible ordinary responses, step58 shows dungeon and both party portraits. Prior run request59 has no response and must not count as movement. First character-creation controller24705/24712 also terminated before its late requests46-49; retained run20261009T2221Z-bg2-character-creation distinguishes them.

## Ordinary player movement verified (2026-10-09T22:36Z)

Original BG2 demo native player movement verified on main280d28eb1/module527004d9, run20261009T2236Z-bg2-player-movement; photo978. Ordinary creation/dialogue, select hero via portrait, ground click moves hero away from cage while companion remains nearby.32192/32199 terminal0 at22:36:40Z. Next register complete original media then browser/audio/FPS; frozen native run is not FPS evidence. Installed tree /home/user/bg2-installed-v2-20261009 on bx_hx8msa33; missing local test/binaries/candidates/baldurs-gate2-demo. CLI warnings name missing remote test/binaries/dlls/{shell32,comctl32,ole32}.dll; restore exact fixtures for follow-up. Alice remains second lane under one-worker budget.

Run controller replayed only previously acknowledged ordinary inputs1-58. Request59 clicked terrain; camera shift alone was insufficient proof. Request60 selected the hero portrait (603,41); request61 clicked walkable ground (186,319), advancing200 batches. Reviewed step59/61 show the green-armored player move from beside the central cage to the lower-left walkway while the cage stays fixed and the companion remains behind. This is player control, not an automatic cinematic. Exact source, original executable hash, all inputs/responses, controller, output and clean termination are retained in the self-contained run.

Two existing Baldur Chapters I/II compatibility patches refused unexpected bytes for this different executable, explicitly logged, so those patches were not applied. Three missing real-system-DLL warnings also remain; gameplay proof is scoped to the recorded native route, not complete Windows DLL coverage or browser parity.

## Registered browser route (2026-10-09T23:57Z)

Added local-only app `baldurs_gate2_demo` and corpus candidate `baldurs-gate2-demo`. The complete support manifest contains 644 files (original executable separate), including audio. Installer path aliases resolve against C:\. On temporary bx_hx8msa33, original-main module527004d9 and default browser Worker/WebGL render the menu; ordinary Single Player/New Game clicks reach character generation. Run `20261009T2357Z-bg2-browser-registration` records this partial browser evidence. Browser gameplay, sound quality and FPS remain unverified. The bounded controller61300 is still active; do not launch another browser until it is terminal.

Local media copy remains incomplete. API transfer stopped at23:47:12Z on the2GiB disk guard. Private SSH connection timed out; both processes exited and its temporary authorized key was removed at23:55:10Z. Port forwarding is unavailable to this API key. Compressed, per-chunk/per-file-hashed API transfer now resumes verified files using `scratch/bg2-transfer-20261009/download-compressed.js`, with a45-minute deadline and disk guard; its receipt must prove completion before publishing the local manifest. Original inventory is645 files850839386 bytes. Remote complete fixture is unaffected. Local comctl32.dll exists but shell32.dll/ole32.dll are absent; none were substituted in this browser run.

## Browser opening scene stalls (2026-10-10)

Run `20261010T0014Z-bg2-browser-cutscene` preserves complete ordinary inputs, captures, logs, controller and served-module identity. Character import explicitly says disabled for demo. Created male human lawful-good fighter through normal menus, allocated original proficiency points, named him with ordinary A key, and accepted. Opening dungeon renders, but repeated captures show the same magic-particle pattern. Escape does not establish a skip. A20.032-second observation records0 guest presents/uploads while769116 blocks execute; logical FPS is unknown. This is a browser presentation/progress blocker, not evidence of player control or a diagnosed cause. No runtime exception appears in captured browser errors. Native cooperative gameplay does not resolve this Worker-route difference.

Controller61300 and Chrome61312 ended cleanly at00:14:37.156Z on immutable1200-second deadline. The later thread-popup request arrived after termination and produced no capture; it is not evidence. Fresh diagnostic controller73552 replays only the same ordinary inputs through Accept (omits Escape), then takes8 read-only scheduler snapshots30 seconds apart plus presentation counters. It has its own1500-second guard and private browser output `/home/user/bg2-browser-diagnostic-20261010`; collect that controller before any further runtime. No guest-state edits or speculative fix.

Diagnostic73552/73564 finished00:33:36.758Z, terminal0. **Replay did not reach dungeon**: name was not accepted, final reviewed image is character creation. Run `20261010T0033Z-bg2-browser-thread-stall` records this harness mismatch honestly. Its607 presentations over20.052s and8 stable thread snapshots are a healthy-menu control, not stall evidence. Main previous EIP00912326 leads to PeekMessageA (IAT00a065e0); worker00434d10 follows Sleep (00a06448),00434d9a follows SuspendThread (00a06380), and00434e62 precedes WaitForSingleObject (00a06454). Those states alone cannot identify a broken scheduler. Disassembly excerpts include unaligned leading instructions; only the explicit aligned API-call boundaries support these mappings.

Follow-up controller79682 uses the same original input replay, then explicitly reopens Name, enters A, completes it and accepts, with screenshots and8 read-only thread/register/clock/game-object samples. No guest writes. Output `/home/user/bg2-browser-deep-20261010`,1500-second immutable deadline. Boat extended to archiveAfter01:43:39Z. Media transfer hit its45-minute deadline00:41:21Z after83 completed files799219683 transferred bytes (plus prior verified files); prior receipt preserved, terminal verified, a new bounded resume now copies only missing files. Complete local manifest remains unpublished pending full645-file hash verification.

## Local media complete; replay input mismatch localized

Resumed transfer completed00:48:34.888Z: all645 original installed files850839386 bytes SHA256 verified. The644-support-file `.wine-assembly-browser.json` and `.original-inventory.json` are now published under local `test/binaries/candidates/baldurs-gate2-demo`. Run `20261010T0054Z-bg2-installed-media` preserves both transfer receipts and inventory. This removes the missing-local-media blocker; it does not establish browser gameplay.

Second diagnostic79682/79694 completed00:52:22.833Z, terminal0, but again remained in character creation. Reviewed replay030 shows the Name button; replay031 after its click does not show the modal; replay032 after A still has no name. Run `20261010T0052Z-bg2-browser-replay-mismatch` retains these exact checkpoints plus8 clock/register/memory samples, all scoped to the menu. Manual Appearance click worked. Subsequent manual Done/Name sequence arrived after controller shutdown and produced no capture. Next instrument ordinary click delivery and positively confirm the Name modal before typing, then capture the original dungeon stall. Do not infer its scheduler cause from the menu snapshots. All runtimes and transfers are terminal.

Diagnostic correction: `get_sleep_yielded` in `src/13-exports.wat` reads **and clears** the flag. The second replay's8 memory samples called it; their earlier read-only description is incorrect and those samples may perturb scheduler state. Preserve them as tainted menu diagnostics, not causal evidence. First replay's standard thread snapshots did not call it. Follow-up90293 stops its replay before Name and enables only the existing renderer-input observer; it contains neither these memory samples nor this getter.

## Actual dungeon critical-section stall (2026-10-10T01:23Z)

Controller90293 stopped replay before Name, revealing an earlier divergence: character was a cleric with alignment/abilities/skills unfinished, so Name was unavailable. The visible state was completed manually through normal inputs; renderer observer confirms pointer packets at expected guest coordinates. Confirmed Name modal, ordinary A, Done and Accept reach the dungeon. This is a harness sequencing problem, not a demonstrated broken Name control. The current cleric differs from the earlier fighter, so do not call it an identical character comparison.

Cutscene visibly advances through intruder dialogue and character movement, then stops before player dialogue, **without Escape**. Run `20261010T0123Z-bg2-dungeon-critical-section` preserves actual dungeon evidence. A20.028s late sample records0 presents/uploads despite898086 executed blocks. Browser errors are empty. Read-only registers show main/active-worker clocks advancing by roughly10 seconds between snapshots; no frozen-clock explanation is established.

Worker slot5 (guest tid6) repeatedly parks at EnterCriticalSection thunk07500528, return0045b374, guest CS00c1d816 / WASM0082f816. Direct lock words at01:23Z are debug0, LockCount-1, recursion1, owner1, semaphore0, spin0. Main guest thread1 is polling PeekMessageA around00912326. The original0045b360 wrapper enters its object+8 CS; caller path0063870d →0099ecfa invokes the object's virtual lock method. Owner/recursion evidence narrows the next investigation, but does not prove who failed to release or whether an ownership transition is incorrect. Trace acquisition/release and initialization for this lock before any runtime patch. These live probes omit the destructive sleep getter; their controllers are preserved.

Ordinary stop completed90293/Chrome90305 at01:23:50.174Z, terminal0. All runtime/transfer jobs are terminal. Native player movement remains valid; browser player movement, sound quality and logical gameplay FPS remain unverified. Local media is complete, so no fixture-transfer blocker remains.
# Concurrent packed critical-section reproduction (2026-10-10)

The browser's stuck section at guest `00c1d816` is misaligned by two bytes.
The original implementation avoids a WebAssembly unaligned-atomic trap by
using an unprotected load/store for the owner claim. A standalone test with
two actual Node workers sharing the original main module `527004d9…` reproduces
overlapping owners, lost protected increments, and a final owner with
recursion 1 but LockCount -1. The aligned control completes 100,000 increments
without overlap and releases normally. Evidence:
`scratch/runs/20261010T0131Z-unaligned-cs-race`.

The candidate serializes packed owner claim/release using the existing
split-lock mutex, held only for memory accesses, never across guest execution,
host imports, callbacks or parking. Aligned sections retain their CAS path.
Canonical build and concurrent Enter/TryEnter/recursive tests across offsets
0,1,2,3,5,6,7 pass, as do the original reproducer and 26 existing CS checks.
Candidate module: `9b307a5c28acffd256dceacf43e261e3997a171cb21a01d1804ebba1cc61774c`.
Browser verification on that candidate now passes the opening cutscene and
Imoen's dialogue, followed by two ordinary player-directed floor movements.
Run `20261010T0146Z-bg2-browser-lock-fix` contains reviewed before/after images,
trusted input records, and the served module hash. The worker that previously
parked on the corrupt section now waits normally on its event. Controller
101560 and Chrome 101572 exited cleanly at 01:45:36Z. Final concurrency tests
also exercise non-owner Leave and abandoned-section reuse for packed layouts.

Audio and logical gameplay FPS remain unqualified. A pointer alignment issue
is visible after entering gameplay: the guest cursor does not match the page
click location. Keyboard dialogue choices and floor clicks still establish
control, but coordinate mapping needs its own investigation. Do not describe
the game as fully qualified from this run alone.
