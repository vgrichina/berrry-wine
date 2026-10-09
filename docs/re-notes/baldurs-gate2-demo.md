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
