# Baldur’s Gate II demo: ordinary party recruitment, 2026-11-07

Current-main original browser gameplay progressed beyond the previously accepted opening dialogue and floor movement. Ordinary dialogue freed and recruited Minsc, visibly producing three party portraits and “The Party Has Gained Experience: 3000”. Jaheira remained imprisoned; her dialogue visibly added the journal objective to find a way to release her. No combat or enemy response was reached.

Evidence: `scratch/runs/20261107-bg2-current-combat/` (ignored). Tested runtime Git commit `3375c2476e4d91c809fec75ea1b2496c7c82deb6`; subsequent shared-main changes were not substituted into this running application. The exact relevant tracked diff and new-file patches, fixture inventory, runtime pins, unique captures, input ownership records, and terminal retrieval hashes are retained there. No source tree or media archive was created.

## Original and input qualification

The complete registered original closure was checked: 645 files including BGMain.exe and the 644-file support manifest, totaling 850,839,386 bytes. BGMain.exe SHA-256 is `944db091d82c6144db8c9a21c085e4504bdc549fca8003c31e309646567bb98b`. The staged runtime closure contained 1,280 individually pinned files, 907,396,393 bytes. The executed Wasm module was `e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467` (2,182,493 bytes).

Before the one original runtime, generated actual-Chromium controls qualified immutable application/module and live process, Worker, document, canvas and renderer ownership. Nine replacement cases rejected input without effects. Stale/slow captures, partial delivery, UNKNOWN and late acknowledgements rejected further replay. Native trusted balanced mouse and keyboard events and release independent of delayed diagnostics were checked. Generated controls launched no original. These checks describe this helper and this run, not a general input guarantee.

The actual gameplay owner was the page’s Win98Renderer using Canvas2D, process 1000, endpoint 1, with six guest Worker slots. No D3D render-worker owner was present. The browser was actual Chromium 151. Native CDP attached without Puppeteer or any attachment viewport change. Its initial 1024×768 viewport remained fixed; the 640×480 guest image occupied a measured 684×513 letterboxed region within the 684×536 canvas. This avoids the earlier observer-resize issue.

## Reviewed route and consequences

Character creation was recovered through newly reviewed screenshots, not replayed setup coordinates: male, human, Fighter, lawful good, rolled attributes 9/18/10/15/13/11, two proficiency points each in long sword, short sword and two-handed sword, default appearance/sound, and name `a`. The Name modal and final Accept were available after this ordinary completed allocation. The opening cutscene ran normally. Reviewed Imoen dialogue then added her to the party.

The hero inventory baseline showed 55/58 health, AC 6, empty equipment/backpack and zero gold (`review/hero-inventory-before.png`). Ordinary floor clicks moved the hero southwest out of the cage platform and then north (`review/cage-exit-walk.png`, `review/north-walk.png`). Some cage/wall targets showed barred or unavailable movement; no emulator divergence was established.

At Jaheira’s cell, ordinary conversation produced the visible journal update (`review/jaheira-return.png`). At Minsc’s cell, dialogue provoked his anger, followed by his statement that the bars bent with his berserker strength and visible repositioning (`review/minsc-rage.png`). Subsequent conversation accepted him into the party: `review/minsc-party-added.png` shows the third portrait and 3,000 party experience award. These are direct visible consequences beyond the historical opening acceptance.

The party then approached the western equipment room. Native arrow keys scrolled the camera; a brief overscroll into black was corrected after reviewing the capture. The furthest reviewed scene inside the equipment room was `review/equipment-table.png`: the central table is cyan-highlighted, gear and a chest are visible, one party member stands beside the table, and others remain near the doorway. No opened container panel, acquired item, door transition or first combat is claimed. The next ordinary task is to enter/interact with this room, obtain equipment or Jaheira’s key if available, and seek an encounter through visible controls.

## Bounds and cleanup

One fresh UUID-idempotent box, `bx_kznkqtuy`, was created at 08:59:45 UTC. The original runtime started at 09:01:36. Its immutable runtime cap closed Chromium normally at 09:28:45 (exit 0, no signal); no stopped box was resumed and no second original was launched. Terminal verification checks the original process and Chrome are absent, no profile-owning process remains, both listening ports are closed, the profile is removed, and the 1,280 runtime file hashes still match. Unique terminal artifacts are individually retrieved and SHA-256 verified before the task-delegated nonforced box stop; the exact receipt and stopped-state evidence are in the run directory.

This is party-interaction evidence only. There is no emulator fix, first-combat, FPS, audio, cross-device or full-playability claim. Historical acceptance5aafa6658 and viewport-preserved moduleb84324ed movement remain valid.
