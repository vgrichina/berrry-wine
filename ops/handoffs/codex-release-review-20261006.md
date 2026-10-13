# Codex task release review — 2026-10-06

Codex's coordinator (codex:01a0ff91) and its subagents (/root/coverage_audit,
/root/restore_evidence, /root/corpus_categories) stopped at 2026-10-05T21:21Z on
"You've hit your usage limit … try again at Oct 12th, 2026 9:42 AM". Their
coordinator-to-subagent messages are encrypted in the rollout, so each task's
state below is its own TODOS record. The coordinator's last words: Arena dungeon
control evidence pushed (57e1a949), Daggerfall longer run live, Tomb Raider III
demo chosen as the replacement lane (now claude:202b4b39), and the DOS/ToyVM
corpus task handed to claude:1863d2b5.

## Preserved work

- `archive/codex-shared-tree-20261006` (428c9abe): every modified tracked and
  untracked non-ignored file in ~/wine-assembly on top of its HEAD 2683a6e3,
  607 files (incl. 138 ops/release-evidence and 131 ops/handoffs files). Not
  reviewed for merge; a later merge must take it file by file against origin/main.
- One `archive/<name>` branch per Codex worktree (wt-dredmor-lazy, wt-hype-getmessage,
  wt-jig-current, wt-jig-directx7, wt-jig-getwindowrect, wt-main-publish-small,
  wt-morrowind-live-buttons, wt-screenshot-easy, comi-audio-source). `git cherry`
  shows 12 commits whose patch id is not on main (8 VB Surface7, 2 Arena/Ultima IV,
  1 Dredmor, 1 VB stdcall); an earlier per-function review found their content
  landed on main reworked, so these branches are a record, not pending merges.
- Off-box copy: scratch/codex-archive-20261006.bundle on the laptop.
- The Codex rollout itself stays at ~/.codex/sessions/2026/10/03/.

## Released tasks (109): owner -> unowned, status unchanged, prev-owner recorded

### ready (67)

- **NFS3-RENDERER-BENCH** — Compare NFS3 speed and correctness in Glide, D3D and original software  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 5/5 evidence paths present  
  Next: Verify available backend-review evidence and exact missing package paths; preserve failed renderer-identity gate before any new qualification.
- **OPS-GAME-FPS-BASELINE** — Measure browser FPS for strongest local and desktop game candidates  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 8/8 evidence paths present  
  Next: Inventory exact available fixtures and released route packages, then qualify gameplay for the first ready candidate; canceled conditional launches stay canceled.
- **GAMEPLAY-abedemo** — Gameplay screenshot and FPS: abedemo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Qualify complete-frame measurement during actual gameplay; retain narrow input scope from reviewed batch17 evidence.
- **GAMEPLAY-aoe1** — Gameplay screenshot and FPS: aoe1  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Qualify complete-frame measurement during actual gameplay; retain narrow input scope from reviewed batch17 evidence.
- **GAMEPLAY-aoe2** — Gameplay screenshot and FPS: aoe2  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Diagnose actual owning-Worker graphics initialization rejection. Unicode repair cleared prior DirectX6.1a failure; ordinary run now shows DirectDraw graphics error, with no gameplay/FPS.
- **GAMEPLAY-best-of-moorhuhn** — Gameplay screenshot and FPS: Best Of Moorhuhn extras  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Confirm in-round Training1 action, cover other playable package variants, then qualify complete-frame measurements.
- **GAMEPLAY-bricks** — Gameplay screenshot and FPS: Bricks  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Title click starts the level 1 sliding-block board. Drag (305,293) to (259,293) shows no verified block displacement. Puzzle scene reviewed; controls and completed move remain unverified. Gameplay frame measurement remains unqualified.
- **GAMEPLAY-broken_sword_demo** — Gameplay screenshot and FPS: Broken Sword Demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Qualify complete-frame measurement; reviewed response is hotspot cursor only, walking unverified.
- **GAMEPLAY-curse_monkey_island_demo** — Gameplay screenshot and FPS: Curse of Monkey Island Demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Gameplay scene and limited input response reviewed. Derive and independently qualify a complete gameplay-frame counter before reporting FPS.
- **GAMEPLAY-cwordzap** — Gameplay screenshot and FPS: CWordZap  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Ordinary Ready click starts letter board; selecting S O T places letters into word row and End Word displays SOT. Score remains0:0; no accepted-word/scoring claim. Gameplay frame measurement remains unqualified.
- **GAMEPLAY-diablo_demo** — Gameplay screenshot and FPS: Diablo Demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Diagnose persistent dark transition after complete name entry; prior served-source closure rejection recorded, future helper includes all library JavaScript. No gameplay/FPS.
- **GAMEPLAY-diablo-shareware** — Gameplay screenshot and FPS: Diablo Shareware  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Qualify complete-frame measurement during actual gameplay; retain narrow input scope from reviewed batch17 evidence.
- **GAMEPLAY-dungeon_keeper_demo** — Gameplay screenshot and FPS: Dungeon Keeper Demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Complete ordinary menu-to-gameplay input route with exact failed-request logging; no active scene or specific compatibility fault established.
- **GAMEPLAY-elasto-mania** — Gameplay screenshot and FPS: Elasto Mania  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Ordinary Enter progression reaches Level16 NewWave motorcycle field. Up held1200ms overlaps loading, and only one final field capture is available; acceleration/control response is unverified. Gameplay frame measurement remains unqualified.
- **GAMEPLAY-freecell16** — Gameplay screenshot and FPS: freecell16  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 3/3 evidence paths present  
  Next: Setup and ordinary card move now pass on worker-owned input routing fix. Reviewed gameplay image saved; qualify a meaningful per-game frame measurement. Dialog clipping remains.
- **GAMEPLAY-funtris** — Gameplay screenshot and FPS: Funtris  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 3/3 evidence paths present  
  Next: Implement bounded gravity-update/input-response metrics from source plan; no proven complete-frame boundary, so gameplay FPS remains unknown. Reviewed gameplay/input saved; never relabel GDI tile blits or gravity updates as frames.
- **GAMEPLAY-gallinelle-xxl** — Gameplay screenshot and FPS: Gallinelle XXL  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Qualify complete gameplay frame measurement; active hunting scene and ammo decrement reviewed, no hit or sustained-play claim.
- **GAMEPLAY-generally** — Gameplay screenshot and FPS: GeneRally  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Run corrected post-countdown gate allowing00.00 before first movement; verify driving. Intro overlay stayed identical30sec until ordinary Enter acknowledged it. After countdown, track and car visible with no overlay/lights; timer00.00. Overly strict private gate incorrectly required nonzero timer before movement, so no driving input issued before120sec deadline. Gate corrected offline; no movement
- **GAMEPLAY-heroes-2-demo** — Gameplay screenshot and FPS: Heroes of Might and Magic II demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Use verified adventure-map route and capture one isolated hero movement, then qualify complete-frame measurement.
- **GAMEPLAY-heroes-3-demo-installer** — Gameplay screenshot and FPS: Heroes of Might and Magic III demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Qualify complete-frame measurement during actual gameplay; retain narrow input scope from reviewed batch17 evidence.
- **GAMEPLAY-hype_glide_demo** — Gameplay screenshot and FPS: Hype Demo (Glide 3, experimental)  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Gameplay screenshots/control accepted: run20261005-hype-wh-getmessage-gameplay, root reviewed4shots, ordinary Enter/Space/Up/Down, main376abd87. Remaining task is scene-qualified frame FPS only; no repeat screenshot or pending merge task.
- **GAMEPLAY-jardinains** — Gameplay screenshot and FPS: Jardinains!  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Complete ordinary menu-to-gameplay route; preserve menu-only evidence and unknown input mapping.
- **GAMEPLAY-jazz-jackrabbit-2-demo-installer** — Gameplay screenshot and FPS: Jazz Jackrabbit 2 demo installer  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Complete intro/menu route with timely ordinary Escape inputs and reach a player-controlled level; previous intro-only deadline is inconclusive.
- **GAMEPLAY-jigssawme** — Gameplay screenshot and FPS: jigssawme  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 27/28 evidence paths present  
  Next: Narrow gameplay complete: root-reviewed ordinary green-piece drag, run20261005-jigssawme-clipped-puzzle-drag,37 hashes verified, evidence main0cf9ff1d/175395a9 and Telegram478/479. Remaining: full-board640x480 clipping investigation and supported scene-qualified FPS measurement; no solve/snapping claim. Ready queue; restore_evidence refilled with WinBoard.
- **GAMEPLAY-liquid-war** — Gameplay screenshot and FPS: Liquid War  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Reviewed arena with red/yellow teams white walls and04:00 timer before ordinary cursor move. Final capture shows03:35 timer and changed team distribution; autonomous simulation also changes this, so cursor-steering response not independently verified. FPS remains unqualified.
- **GAMEPLAY-little-fighter-2-installer** — Gameplay screenshot and FPS: Little Fighter 2 installer  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Complete arena rendering reviewed after primary-size repair; qualify full-frame measurement. Retain reduced-roster limitation and earlier limited movement response; latest control observation is combat-confounded.
- **GAMEPLAY-moorhuhn-3-puzzles** — Gameplay screenshot and FPS: Moorhuhn 3 Bonus Puzzles  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Cover other puzzle variants and qualify complete-frame measurement; Fisch piece drag reviewed only.
- **GAMEPLAY-mshearts16** — Gameplay screenshot and FPS: Hearts  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 3/3 evidence paths present  
  Next: Dealer selection, ordinary setup, offline hand and three-card pass now reviewed. Qualify game-specific frame measurement; clipping tracked separately under WIN16-DIALOG-GEOMETRY.
- **GAMEPLAY-nethack-win32** — Gameplay screenshot and FPS: NetHack for Windows  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Gameplay scene reviewed; complete ordinary control-response route and qualify a complete-frame measurement.
- **GAMEPLAY-pinball** — Gameplay screenshot and FPS: Pinball  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Reviewed Space Cadet table with BALL 1 and score 0 after F2. Space held 1200ms and Z held 300ms; captures show changing table lights but no verified ball movement or flipper response. Gameplay scene only, no successful launch/control claim. Gameplay frame measurement remains unqualified.
- **GAMEPLAY-pinball_plus95** — Gameplay screenshot and FPS: pinball_plus95  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Gameplay scene reviewed; complete ordinary control-response route and qualify a frame counter; retain scene-only evidence.
- **GAMEPLAY-pyramid** — Gameplay screenshot and FPS: Pyramid  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: After Start and real Game > New menu clicks, bottom-row second card (2 hearts) visibly inverts after ordinary click. Selection only, no pair removal/completed deal. Gameplay frame measurement remains unqualified.
- **GAMEPLAY-qbob** — Gameplay screenshot and FPS: QBob  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Gameplay scene reviewed; complete ordinary control-response route and qualify a complete-frame measurement.
- **GAMEPLAY-rct** — Gameplay screenshot and FPS: RollerCoaster Tycoon  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Qualify complete-frame measurement during actual gameplay; retain narrow input scope from reviewed batch17 evidence.
- **GAMEPLAY-reflexive-crimsonland** — Gameplay screenshot and FPS: Crimsonland  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Localize observed early ExitProcess0 after launcher Play using saved guest/loader evidence, then repair and requalify gameplay.
- **GAMEPLAY-reflexive-zuma-deluxe** — Gameplay screenshot and FPS: Zuma Deluxe  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Diagnose loading-screen progress on actual owning threads; BASS startup failure cleared, fallback MSVCRT present. No active gameplay/FPS yet.
- **GAMEPLAY-runenlegen** — Gameplay screenshot and FPS: Runenlegen  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 3/3 evidence paths present  
  Next: Full12x8 Beginner board and ordinary placement already verified on14aadaac; geometry fixce4f60b2 is in main640b85a4/current main. Do not repeat screenshot/integration work. Remaining task is scene-qualified FPS measurement with valid counter and exact current build identity.
- **GAMEPLAY-scummvm-fotaq** — Gameplay screenshot and FPS: ScummVM + Flight of the Amazon Queen  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Reviewed gameplay and limited input response; qualify complete-frame measurement. No full-game compatibility claim.
- **GAMEPLAY-simcity2000_demo** — Gameplay screenshot and FPS: SimCity 2000 Demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Gameplay scene reviewed; complete ordinary control-response route and qualify a complete-frame measurement.
- **GAMEPLAY-simcity2000_net** — Gameplay screenshot and FPS: SimCity 2000 Network Edition  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Prepare and review ordinary local virtual-peer browser route per ops/handoffs/gameplay-network-preparation-20261003.md, then capture actual gameplay; all declared files present.
- **GAMEPLAY-snake** — Gameplay screenshot and FPS: Rattler  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Early route now captures living upward movement without life loss; steering remains unverified. Qualify ordinary steering and source-backed frame timing; prior failed run retained.
- **GAMEPLAY-snood** — Gameplay screenshot and FPS: Snood  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restored fixtures and ordinary frozenCLI mouse gameplay verified84075; root-reviewed board/shot4623changedpixels. Scene-qualified FPS remains unmeasured; collect meaningful real-time frame evidence when performance slot available.
- **GAMEPLAY-sol16** — Gameplay screenshot and FPS: sol16  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Reviewed limited gameplay input and screenshots saved; qualify a game-specific frame counter before publishing FPS. Initial seven-column tableau visible, but caption area is blank gray. Ordinary stock click exposes three waste cards. Limited stock draw works; caption defect remains, no complete-game or FPS claim.
- **GAMEPLAY-starcraft-shareware** — Gameplay screenshot and FPS: StarCraft Shareware  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Reviewed gameplay and limited input response; qualify complete-frame measurement. No full-game compatibility claim.
- **GAMEPLAY-taipei** — Gameplay screenshot and FPS: Taipei  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Reviewed limited gameplay input and screenshots saved; qualify a game-specific frame counter before publishing FPS. Personally reviewed title, populated Game #28753 board and ordinary click: top-left tile changes to magenta selection highlight. No matching pair removal or completed game is claimed; no FPS measurement.
- **GAMEPLAY-tetravex** — Gameplay screenshot and FPS: tetravex  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Gameplay board and clean ordinary tile-drag response reviewed. Define a meaningful complete-frame counter or document event-driven rendering limits; FPS remains unknown.
- **GAMEPLAY-tetrinet** — Gameplay screenshot and FPS: TetriNET  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Qualify complete gameplay frame measurement. Local two-seat join and limited host Left/Space response reviewed; no external network, sustained-play or physical FPS claim.
- **GAMEPLAY-total_annihilation_demo** — Gameplay screenshot and FPS: Total Annihilation Demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Gameplay scene reviewed; complete ordinary control-response route and qualify a frame counter; retain scene-only evidence.
- **GAMEPLAY-tworld** — Gameplay screenshot and FPS: Tile World  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/2 evidence paths present  
  Next: Reviewed Level1 ordinary chip collection6→3 is complete; callback repair9a996fc1 is in current main. Do not repeat screenshot, rebase or integration work. Remaining task is scene-qualified FPS with source-backed counter and exact runtime identity.
- **GAMEPLAY-warcraft3-demo** — Gameplay screenshot and FPS: Warcraft III: Reign of Chaos Demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Diagnose profile-screen guest wait using saved owning-thread state; no gameplay or FPS qualified.
- **GAMEPLAY-wep16_cruel** — Gameplay screenshot and FPS: wep16_cruel  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Gameplay scene reviewed; complete ordinary control-response route and qualify a frame counter; retain scene-only evidence.
- **GAMEPLAY-wep16_freecell** — Gameplay screenshot and FPS: wep16_freecell  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Gameplay scene reviewed; complete ordinary control-response route and qualify a frame counter; retain scene-only evidence.
- **GAMEPLAY-wep16_jigsawed** — Gameplay screenshot and FPS: wep16_jigsawed  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 3/3 evidence paths present  
  Next: Capture originating instruction/stack for RuntimeError after About creation; ordinary capture does not prove close-click causality. All declared/import DLLs present; no missing guest path established.
- **GAMEPLAY-wep16_klotski** — Gameplay screenshot and FPS: wep16_klotski  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Reviewed active Daisy puzzle and one ordinary tile-move response on5ff4844e; qualify frame measurement separately, retain setup clipping and picking-offset caveats.
- **GAMEPLAY-wep16_maxwell** — Gameplay screenshot and FPS: wep16_maxwell  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Gameplay scene reviewed; complete ordinary control-response route and qualify a frame counter; retain scene-only evidence.
- **GAMEPLAY-wep16_rattler** — Gameplay screenshot and FPS: wep16_rattler  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Gameplay scene reviewed; complete ordinary control-response route and qualify a frame counter; retain scene-only evidence.
- **GAMEPLAY-wep16_rodent** — Gameplay screenshot and FPS: Rodent's Revenge  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Gameplay scene reviewed; complete ordinary control-response route and qualify a frame counter; retain scene-only evidence.
- **GAMEPLAY-wep16_ski** — Gameplay screenshot and FPS: wep16_ski  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Gameplay scene reviewed; complete ordinary control-response route and qualify a frame counter; retain scene-only evidence.
- **GAMEPLAY-wep16_tetris** — Gameplay screenshot and FPS: wep16_tetris  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Gameplay/Left response and open-menu Escape repair reviewed. Qualify complete-frame measurement; separate TASKBAR-RESTORE-INPUT remains unproven.
- **GAMEPLAY-wep16_tictacdp** — Gameplay screenshot and FPS: wep16_tictacdp  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 3/3 evidence paths present  
  Next: Trace the preserved Sub or Function not defined error after ordinary piece drag; identify the guest call before another input qualification. Keep reviewed startup board scene, FPS unknown.
- **GAMEPLAY-wep16_tutstomb** — Gameplay screenshot and FPS: wep16_tutstomb  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Gameplay scene reviewed; complete ordinary control-response route and qualify a frame counter; retain scene-only evidence.
- **GAMEPLAY-winarc** — Gameplay screenshot and FPS: winarc  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Cover remaining playable Winarc subgames and qualify complete-frame measurement; Memory single-card reveal reviewed only.
- **MIG-FIXTURE-RESTORE** — Restore and verify missing game fixture sets  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 3/3 evidence paths present  
  Next: Queued selective recovery: latest owner audit has218 complete declared routes,5 missing-file entries/156 exact paths and18 unregistered entries. Reconcile exact gaps in scratch/local-owner-restore-final/report.json; no active transfer claimed.
- **TASKBAR-RESTORE-INPUT** — Investigate taskbar restore click after Tetris minimization  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/2 evidence paths present  
  Next: Reproduce non-restoration before proposing a repair. Current actual physical click restores with stable DOM target and observed SC_RESTORE; historical cause remains unknown. No longer blocks independent coverage.
- **AOE2-GRAPHICS-INIT** — Diagnose Age of Empires II graphics initialization failure  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 3/3 evidence paths present  
  Next: Queued, no live worker/runtime. Capture exact palette resource50500 lookup/parser/GDI outcome. Initial graphics setup returns1; later parent error17 follows palette stage. Installed interfac.drs contains resource50500; guest lookup/parser result still unknown.
- **DIABLO2-GLIDE-MENU-FREEZE-20261004** — Diablo II Glide: frozen menu animation and looping audio  
  prev /root/coverage_audit; no paths  
  Next: 
- **GAMEPLAY-PERFORMANCE-BATCH-20261005** — Measure gameplay performance for 44 scene-reviewed games  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: SkiFree shared-HUD backing proven with actual native/host producer and strict live preflight; attempt5 accepted72/5.00329sec=14.390531 presentations/s, but personally reviewed sample was stopped/crash-recovery at925m/0m/s, not continuous downhill FPS. Publish exact scene-qualified raw result; prepare normal-input downhill sample with movement review. Hype guarded exclusive-layer sample ready, Jig 

### backlog (36)

- **GAMEPLAY-arcanum-demo** — Gameplay screenshot and FPS: Arcanum: Of Steamworks & Magick Obscura Demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-baldurs-gate-chapters-1-2-demo** — Gameplay screenshot and FPS: Baldur's Gate Chapters I & II  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-baldurs-gate-interactive-demo** — Gameplay screenshot and FPS: Baldur's Gate interactive demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-black_white_2_demo** — Gameplay screenshot and FPS: Black & White 2 Demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-caesar3_demo** — Gameplay screenshot and FPS: Caesar III Demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-civilization-2-mge-win32** — Gameplay screenshot and FPS: Civilization II: Multiplayer Gold Edition  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-civilization-2-win16** — Gameplay screenshot and FPS: Sid Meier's Civilization II  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-darkstone_demo** — Gameplay screenshot and FPS: Darkstone Demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-deus-ex-demo** — Gameplay screenshot and FPS: Deus Ex demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-diablo-2-demo-installer** — Gameplay screenshot and FPS: Diablo II Demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-gog-free-beneath-a-steel-sky** — Gameplay screenshot and FPS: Beneath a Steel Sky GOG installer  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-gog-free-elder-scrolls-daggerfall** — Gameplay screenshot and FPS: The Elder Scrolls II: Daggerfall GOG installer  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 3/3 evidence paths present  
  Next: Original fixtures are available and registered; new-game attempt6 reached opening parchment, no dungeon/control. Source route7 preparation in NEW-GAME-DAGGERFALL-20261005. After reviewed player control, perform separate scene-qualified presentation/FPS measurement; creator/story screens do not satisfy this combined task.
- **GAMEPLAY-gog-free-flight-of-the-amazon-queen** — Gameplay screenshot and FPS: Flight of the Amazon Queen GOG installer  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-gog-free-lure-of-the-temptress** — Gameplay screenshot and FPS: Lure of the Temptress GOG installer  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-gog-free-shadow-warrior-classic** — Gameplay screenshot and FPS: Shadow Warrior Classic Complete GOG installer  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-gta2-demo** — Gameplay screenshot and FPS: Grand Theft Auto 2 demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-half-life-uplink-installer** — Gameplay screenshot and FPS: Half-Life: Uplink  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-hitman_glide_demo** — Gameplay screenshot and FPS: Hitman Demo 2 (Glide 3, experimental)  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-icewind-dale-demo** — Gameplay screenshot and FPS: Icewind Dale demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-mcm** — Gameplay screenshot and FPS: mcm  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-morrowind** — Gameplay screenshot and FPS: Morrowind (retail, own ISO)  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-mw3** — Gameplay screenshot and FPS: mw3  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-need-for-speed-2-full** — Gameplay screenshot and FPS: Need for Speed II (retail CD)  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-need-for-speed-2-se-full** — Gameplay screenshot and FPS: Need for Speed II SE (retail CD)  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-nfs2se_glide_demo** — Gameplay screenshot and FPS: Need for Speed II SE Demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-pirates-2004** — Gameplay screenshot and FPS: Sid Meier's Pirates! (2004)  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-quake-2-demo-installer** — Gameplay screenshot and FPS: Quake II Demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-reflexive-alien-shooter** — Gameplay screenshot and FPS: Alien Shooter  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-reflexive-ricochet-xtreme** — Gameplay screenshot and FPS: Ricochet Xtreme  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-serious-sam-demo** — Gameplay screenshot and FPS: Serious Sam: The First Encounter Demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-simgolf-demo-installer** — Gameplay screenshot and FPS: Sid Meier's SimGolf Demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-unreal-special-edition** — Gameplay screenshot and FPS: Unreal Special Edition OEM demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-unreal-tournament-2003-demo** — Gameplay screenshot and FPS: Unreal Tournament 2003 demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-unreal-tournament-2004-demo** — Gameplay screenshot and FPS: Unreal Tournament 2004 demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-unreal-tournament-3-demo-installer** — Gameplay screenshot and FPS: Unreal Tournament 3 demo installer  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.
- **GAMEPLAY-unreal-tournament-demo-348** — Gameplay screenshot and FPS: Unreal Tournament demo  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 1/1 evidence paths present  
  Next: Restore the exact missing fixture paths in the task evidence, then qualify the ordinary gameplay route.

### review (4)

- **GAMEPLAY-gog-free-elder-scrolls-arena** — Gameplay screenshot and FPS: The Elder Scrolls: Arena GOG installer  
  prev /root/restore_evidence; 12/12 evidence paths present  
  Next: Fresh ordinary dungeon controls reviewed (right/left, short backward/forward, stable idle); root reviewing publication107 hashes/commit57e1a949. Separate scene-qualified FPS measurement remains open; no repeat gameplay required.
- **COMI-AUDIO-DIAG** — Diagnose Monkey Island demo audio issues  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 4/4 evidence paths present  
  Next: Current-default f5b222ee/module1a343c5f ordinary ship-hold capture completed:12.0047s attributed audio,7–8 queued sources and no sampled clock rebase. Await user listening review of Telegram470; no sound-quality-fixed claim, new player-control qualification or FPS. No redundant app-option patch or repeat capture without concrete symptom.
- **SCUMMVM-AV-DIAG** — Investigate ScummVM fullscreen and missing sound  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 3/4 evidence paths present  
  Next: GetCaps fix integrated main5b7c3912; ordinary Alt+Enter accepted with live advancing640x480 exclusive full-page intro, run20261005-scummvm-getcaps-fullscreen. Browser fullscreen consent unclicked; no new gameplay/FPS. Later-intro audio Telegram477 remains quality-unqualified pending listening; do not repeat clip or claim music fixed.
- **TOYVM-LONGRUN-BG-20261005** — Investigate ToyVM longer runs and background compilation  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 2/3 evidence paths present  
  Next: Source audit now main5a7648c4; existing Worker overlap confirmed, final separate-module compilation/install foreground and lifecycle/accounting gaps identified. Larger matched-work duration sweep has NOT run: isolated worker provisioning blocked by boat401/bench SSH publickey denial (CLAUDE-TOYVM-LONGRUN-BG). BRW diagnostic P5/P6 are complete, not a live grant: recommendation records P5 parity and

### blocked (1)

- **CORPUS-MISSING-RESTORE** — Restore missing files for existing EXE corpus routes  
  prev codex:01a0ff91-cf9d-7f42-ba93-f9e7616b35a5; 3/3 evidence paths present  
  Next: Restored67of156 paths including all55Chapters files; live dashboard route available, no runtime qualification. Remaining89all Baldur interactive: pinnedISO source403/noarchivefilelisting and alternateMediaFire404. Need an accessible originalsource or matching localISO SHA1 3796defce51a3e867aa216bc27f0be0689fdadf0, then normal extraction. Exact paths/HTTP receipts: scratch/corpus-path-repair-202610

### active (1)

- **NEW-GAME-DAGGERFALL-20261005** — New-game lane: original Daggerfall ordinary player-controlled dungeon  
  prev /root/coverage_audit; 3/3 evidence paths present  
  Next: Attempt7 findings mainb2da032d and683hashes rootverified.132sec operator gap is not guest slowness; no dungeon. Route8 prepared900sec with Palace observation-only/actor-positive skip, robust release, unchanged phasebounds; root testsPASS and35pins/actualguard/readiness agree. Queued after Arena, no current runtime.
