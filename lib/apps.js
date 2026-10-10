// The app registry: what each launchable app is made of — its exe, the DLLs
// it needs beside it, and the data files that have to exist in the VFS before
// it starts (help files, card decks, level data, sound banks).
//
// This lived inside index.html, which meant it was browser-only knowledge: an
// app could be listed with the wrong asset set and nothing headless would
// notice, and test/run.js had no way to say "run what the desktop runs". Both
// hosts read it from here now. Paths are repo-relative and use the top-level
// `binaries` symlink, so they resolve the same from the page and from Node.
//
// An entry may also carry `launchPrefs: ({ screenW, screenH }) => [poke, ...]`
// — the app's own stored settings, pre-set from the size of the screen it is
// about to run on, before it reads them. Each poke is
// `{ key, addr, expected, replacement, label }` and is skipped (with a warning)
// unless `expected` is really there, so it cannot corrupt a differently-built
// binary of the same name. Both hosts apply it right after load_pe; see
// LAUNCH_PREFS in lib/app-profiles.js, which holds the same thing keyed by exe
// name for apps launched by bare `--exe=` with no entry here — RollerCoaster
// Tycoon's resolution byte lives there.
//
// Presentation options an entry may carry, all of them phone-shaped screens
// only (single-app mode):
//   relativeMouse — true: always relative motion / Pointer Lock; false: always
//                   absolute. Absent: decided at runtime from the guest
//                   (a SetCursorPos recentring loop, or a DirectInput mouse
//                   acquired DISCL_EXCLUSIVE; docs/mouse-model-audit.md).
//                   Cursor hiding/clipping is independent.
//   hideHostCursor — hide the browser pointer during exclusive presentation
//                   for a game that paints its own absolute-position cursor.
//   mobileTouch   — 'direct' keeps touch at absolute screen coordinates;
//                   'trackpad' makes a drag send relative motion and a tap
//                   click the guest's virtual cursor. The default 'auto'
//                   follows the live relative-mouse heuristic/latch.
//   touchControls — on-screen buttons/pad/swipe field (lib/touch-controls.js).
//   mobileCrop    — which part of the window 'zoom' (fill) mode fills with.
//                   Its optional fitFocusLandscape focuses a measured board
//                   in landscape Fit; portrait Fit still keeps the full window.
//   mobileZoom    — `{ portrait, landscape }`: how many phone pixels one guest
//                   pixel is worth, PER ORIENTATION (a missing key is 1:1).
//                   The guest desktop is the stage divided by the factor on
//                   BOTH axes, and the single-app fit scales it back out, so
//                   the picture is magnified by exactly that factor with no
//                   gutters and no crop. For an app that draws at a fixed pixel
//                   scale, where a bigger desktop means more playfield rather
//                   than a bigger picture. The two orientations are separate
//                   because how big a fixed sprite READS is its size against
//                   the screen it is on, and a phone's two screens are very
//                   different shapes. See Win98Renderer.singleAppBackingSize.
//   singleAppArgs — command-line override for phone/single-app launches only.
//   singleAppMaximize — `false`: never auto-maximize this app on the phone,
//                   even though it has a maximize box, because "maximize"
//                   picks one of its own fixed layouts sized for a landscape
//                   monitor (Snood's Small/Medium/Big/Huge) instead of laying
//                   out to the client rect. It is left at its own size and
//                   zoomed like any fixed window.
//   singleAppMinDesktop — `{ w, h }`: the smallest desktop this app may be
//                   started on, met by scaling both axes together. The phone
//                   desktop can be 400 wide or 300 tall; an app that sizes a
//                   back buffer from SM_CXSCREEN/SM_CYSCREEN once, at startup,
//                   keeps that buffer when its window later grows the desktop.
//                   See Win98Renderer._singleAppMinDesktopApplied.
//   keepAspect    — maximizing this app means "the largest rect that fits at
//                   its own aspect ratio", not "the whole canvas", because it
//                   stretches its artwork to the client rect per axis instead
//                   of showing more of it. The single-app fit then letterboxes
//                   what is left. See Win98Renderer._singleAppMaximizeRect.
//   mdiCrop       — an MDI app: on the phone, maximize its frame to the whole
//                   desktop and its active document window inside it, then
//                   present only the frame's menu bar and MDICLIENT (plus any
//                   floating palettes, dialogs and menus). The frame caption,
//                   borders and status bar are not shown. See
//                   Win98Renderer._mdiCropRect.
//   exclusiveCrop — temporary native sub-frame inside an exclusive surface;
//                   applied only while sourceW/sourceH match the live backing.
//   threads       — `false` keeps this app on the cooperative scheduler even
//                   though the page runs guest threads in Workers by default
//                   (index.html WINE_THREADS, host.js _maybeStartGuestWorker).
//                   Set only for an app measured to break or slow down there.
//   perf.logicalFrame — optional app-specific logical frame/game-step counter.
//                   `{ label, address, verifier }` arms WAT hit counters and
//                   lets the HUD show GAME/s beside generic PRESENT/s. Only
//                   set this after RE has proven the boundary for this binary.
//                   Addresses are linear VAs; a Win16 app gives `{ seg, off }`
//                   (an NE segment of its own module), resolved after load
//                   through the loader's segment table (run.js --trace-win16
//                   prints the map that turns a traced address into one).
//   inputHooks     — declarative corrections for a measured browser-input
//                   mismatch. `pointerSnap` maps named-window hit rectangles
//                   in native window coordinates to stable delivery points;
//                   lib/renderer-input.js interprets the data without knowing
//                   which app supplied it.

(function () {
  const DESKTOP_APPS = [
      ['notepad',     'Notepad',     '\u{1F4DD}'],
      ['calc',        'Calculator',  '\u{1F9EE}'],
      ['mspaint98',   'Paint',       '\u{1F3A8}'],
      ['wordpad',     'WordPad',        '\u{1F4C4}'],
      ['regedit',     'RegEdit',        '\u{1F9E9}'],
      ['taskman',     'Task Manager',   '\u{1F4CA}'],
      ['sndrec32_98', 'Sound Recorder', '\u{1F399}'],
      ['freecell',    'FreeCell',    '\u{1F0CF}'],
      ['sol',         'Solitaire',   '\u{2660}'],
      ['cruel',       'Cruel',       '\u{1F0A1}'],
      ['golf',        'Golf',        '\u{26F3}'],
      ['pegged',      'Pegged',      '\u{1F3AF}'],
      ['snake',       'Rattler',     '\u{1F40D}'],
      // Rodent's Revenge ships in two playable builds here. Keep the 16-bit
      // WEP2 original as the desktop edition; the separately selectable VB6
      // remake is registered below as rodent2000 with its bundled level files.
      ['wep16_rodent', "Rodent's Revenge", '\u{1F42D}'],
      ['wep16_jezzball', 'JezzBall', '\u{1F534}'],
      ['taipei',      'Taipei',      '\u{1F004}'],
      ['tictac',      'TicTactics',  '\u{274C}'],
      ['reversi',     'Reversi',     '\u{26AB}'],
      ['winmine_wep', 'Minesweeper', '\u{1F4A3}'],
      ['ski32',       'SkiFree',     '\u{26F7}'],
      ['pinball',     'Pinball',     '\u{1F3D0}'],
      ['spider',      'Spider',      '\u{1F578}'],
      ['marbles',     'Marbles',     '\u{1F535}'],
      ['bricks',      'Bricks',      '\u{1F9F1}'],
      ['empipe',      'EmPipe',      '\u{1F6E0}'],
      ['funtris',     'Funtris',     '\u{1F9E9}'],
      ['peaks',       'Peaks',       '\u{26F0}'],
      ['pyramid',     'Pyramid',     '\u{2666}'],
      ['fourstones',  'FourStones',  '\u{1F536}'],
      ['cwordzap',    'CWordZap',    '\u{1F524}'],
      ['qblackjack',  'Blackjack',   '\u{1F0A1}'],
      ['dxball',      'DX-Ball',     '\u{1F534}'],
      ['blobby_volley', 'Blobby Volley', '\u{1F3D0}'],
      ['winamp',      'Winamp',      '\u{1F3B5}'],
      // Both ship their own freely-copyable demo/shareware data and both are
      // verified running on the deployed site, so they are desktop apps rather
      // than localhost-only candidates.
      ['starcraft_shareware', 'StarCraft Demo', '\u{1F680}'],
      ['diablo_shareware', 'Diablo Shareware', '\u{1F525}'],
      ['heroes2_demo', 'Heroes II Demo', '\u{1F3F0}'],
      ['rct',          'RollerCoaster Tycoon', '\u{1F3A2}'],
      // id's demo license (DOCS/license.txt §3) allows free electronic
      // distribution as long as that license goes along with it; the source
      // and hashes are in lib/quake2-demo-source.txt.
      ['quake2_demo', 'Quake II Demo', '\u{1F680}'],
      // EA's own NFS demos (published 2026-09-30, test/binaries/SOURCES.md).
      // The desktop gets the Glide builds: the fastest renderer for both.
      ['nfs2se_glide_demo', 'Need for Speed II SE Demo', '\u{1F3CE}'],
      ['nfs3_glide_demo', 'Need for Speed III Demo', '\u{1F3CE}'],
      // Maxis's own time-limited Win95 interactive demo (no Load/Save, sent
      // back to the menu after 30 minutes); provenance and the publishing
      // decision are in test/binaries/SOURCES.md.
      ['simcity2000_demo', 'SimCity 2000 Demo', '\u{1F3D9}'],
      // Phenomedia's 1999 promotional freeware; provenance and the publishing
      // decision are in test/binaries/SOURCES.md.
      ['moorhuhn',     'Moorhuhn',    '\u{1F414}'],
    ];
    // Local candidates shown in the app selector on localhost networks: apps
    // whose assets exist in this working tree but are not published.
    const LOCAL_CANDIDATE_APPS = [
      ['dungeon_siege_demo', 'Dungeon Siege Demo (experimental)', '\u{2694}'],
      ['carmageddon_tdr2000_demo', 'Carmageddon TDR2000 Alpha Test Demo', '🚗'],
      ['croc2_demo', 'Croc 2 Demo (experimental)', '\u{1F40A}'],
      ['winboard', 'WinBoard 4.2.7 (experimental)', '\u{265F}'],
      ['dungeons_of_dredmor_release', 'Dungeons of Dredmor (Steam release, experimental)', '\u{1F3F0}'],
      ['dungeons_of_dredmor', 'Dungeons of Dredmor (Steam beta, experimental)', '\u{1F3F0}'],
      ['pirates_2004', "Sid Meier's Pirates! (experimental)", '\u{1F3F4}'],
      // Size-coded demoscene intros remain available for local compatibility
      // testing, but are not part of the production desktop yet.
      ['heaven7',      'Heaven Seven', '\u{2728}'],
      ['cashcow',      'Cashcow', '\u{1F404}'],
      ['bakkslide7',   'Bakkslide 7', '\u{25FC}'],
      ['ptct',          'Please the Cookie Thing', '\u{1F36A}'],
      ['cdplayer', 'CD Player', '\u{1F4BF}'],
      ['far_manager_170', 'Far Manager 1.70', '\u{1F5C2}'],
      ['simcity2000_net', 'SimCity 2000 Network Edition', '\u{1F3D9}'],
      ['simcity2000_net_server', 'SC2K Net Server', '\u{1F5A7}'],
      ['winrar_310', 'WinRAR 3.10', '\u{1F5DC}'],
      ['cave_story', 'Cave Story', '\u{1F573}'],
      ['generally', 'GeneRally', '\u{1F3C1}'],
      ['generally_track_editor', 'GeneRally Track Editor', '\u{1F6E3}'],
      ['pocket_tanks', 'Pocket Tanks', '\u{1F4A3}'],
      ['pocket_tanks_installer', 'Pocket Tanks Installer', '\u{1F4A3}'],
      ['little_fighter_2', 'Little Fighter 2', '\u{1F94A}'],
      ['little_fighter_2_installer', 'Little Fighter 2 Installer', '\u{1F94A}'],
      ['icy_tower', 'Icy Tower', '\u{1F9CA}'],
      ['icy_tower_installer', 'Icy Tower Installer', '\u{1F9CA}'],
      ['snood', 'Snood 2.2W', '\u{1F535}'],
      ['snood_installer', 'Snood 2.2W Installer', '\u{1F4BF}'],
      ['windows_installer_20', 'Windows Installer 2.0 (experimental)', '\u{1F4E6}'],
      ['ricochet_xtreme', 'Ricochet Xtreme', '\u{1F534}'],
      ['alien_shooter', 'Alien Shooter', '\u{1F47E}'],
      ['collapse_crunch', 'Collapse! Crunch', '\u{1F9F1}'],
      ['zuma_deluxe', 'Zuma Deluxe (experimental)', '\u{1F7E2}'],
      ['crimsonland', 'Crimsonland (experimental)', '\u{1F47E}'],
      ['elasto_mania', 'Elasto Mania', '\u{1F3CD}'],
      ['jardinains', 'Jardinains!', '\u{1F9F1}'],
      ['jardinains_installer', 'Jardinains! Installer', '\u{1F9F1}'],
      ['ultima4_gog', 'Ultima IV (GOG DOSBox)', '🎲'],
      ['daggerfall_gog', 'Daggerfall (original GOG DOSBox)', '🎲'],
      ['arena_gog', 'The Elder Scrolls: Arena (GOG DOSBox)', '🎲'],
      ['nethack_win32', 'NetHack', '\u{2694}'],
      ['qbob', 'QBob', '\u{1F535}'],
      ['tetrinet', 'TetriNET', '\u{1F9E9}'],
      ['moorhuhn_2', 'Moorhuhn 2', '\u{1F414}'],
      ['moorhuhn_winter', 'Moorhuhn Winter-Edition', '\u{2744}'],
      ['moorhuhn_3', 'Moorhuhn 3', '\u{1F414}'],
      ['moorhuhn_tennis', 'Moorhuhn Tennis', '\u{1F3BE}'],
      ['moorhuhn_3_puzzle', 'Moorhuhn 3 Puzzle', '\u{1F9E9}'],
      ['moorhuhn_3_puzzle_fisch', 'Moorhuhn 3 Puzzle: Fisch', '\u{1F41F}'],
      ['moorhuhn_3_puzzle_leuchtturm', 'Moorhuhn 3 Puzzle: Leuchtturm', '\u{1F9E9}'],
      ['moorhuhn_training_1', 'Moorhuhn Training-Area 1', '\u{1F3AF}'],
      ['moorhuhn_training_2', 'Moorhuhn Training-Area 2', '\u{1F3AF}'],
      ['moorhuhn_2_making_of', 'Making of Moorhuhn 2', '\u{1F3AC}'],
      ['gallinelle', 'Gallinelle (Moorhuhn, Italian)', '\u{1F414}'],
      ['curse_monkey_island_demo', 'Curse of Monkey Island Demo', '\u{1F435}'],
      ['arcanum_demo', 'Arcanum Demo', '\u{2699}'],
      ['atomic_bomberman_june_demo', 'Atomic Bomberman Demo', '\u{1F4A3}'],
      ['broken_sword_demo', 'Broken Sword Demo', '\u{2694}'],
      ['dungeon_keeper_demo', 'Dungeon Keeper Demo', '\u{1F608}'],
      ['populous_tb_demo', 'Populous: The Beginning Demo', '\u{1F30B}'],
      ['descent3_demo', 'Descent 3 Demo', '\u{1F680}'],
      ['crusaders_mm_demo', 'Crusaders of Might and Magic Demo', '\u{1F5E1}'],
      ['anno1602_demo', 'Anno 1602 Demo', '\u{26F5}'],
      ['driver_demo', 'Driver Demo', '\u{1F697}'],
      ['diehard_nakatomi_demo', 'Die Hard: Nakatomi Plaza Demo', '\u{1F52B}'],
      ['drakan_demo', 'Drakan: Order of the Flame Demo', '\u{1F409}'],
      ['braveheart_demo', 'Braveheart Demo', '\u{1F3F4}'],
      ['cmr2_demo', 'Colin McRae Rally 2.0 Demo', '\u{1F3CE}'],
      ['anachronox_demo', 'Anachronox Demo', '\u{1F916}'],
      ['daikatana_demo', 'Daikatana Demo', '\u{1F5E1}'],
      ['asghan_demo', 'Asghan: The Dragon Slayer Demo', '\u{1F409}'],
      ['delta_force_demo', 'Delta Force Demo', '\u{1F3AF}'],
      ['comanche_gold_demo', 'Comanche Gold Demo', '\u{1F681}'],
      ['darkstone_demo', 'Darkstone Demo', '\u{1F48E}'],
      ['red_alert_95_demo', 'Command & Conquer: Red Alert Demo', '\u{1F6E1}'],
      ['die_by_the_sword_demo', 'Die by the Sword Demo', '\u{1F5E1}'],
      ['dark_colony_demo', 'Dark Colony Demo', '\u{1F47D}'],
      ['daytona_usa_deluxe_demo', 'Daytona USA Deluxe Demo', '\u{1F3CE}'],
      ['blood2_demo', 'Blood II: The Chosen Demo', '\u{1FA78}'],
      ['disciples_demo', 'Disciples: Sacred Lands Demo', '\u{1F5E1}'],
      ['disciples2_demo', 'Disciples II: Dark Prophecy Demo', '\u{1F5E1}'],
      ['return_fire_demo', 'Return Fire Demo', '\u{1F681}'],
      ['baldurs_gate2_demo', "Baldur's Gate II: Shadows of Amn Demo", '\u{1F409}'],
      ['commandos_demo', 'Commandos: Behind Enemy Lines Demo', '\u{1F396}'],
      ['age_of_wonders_demo', 'Age of Wonders Beta Demo', '\u{1F409}'],
      ['age_of_wonders2_demo', 'Age of Wonders II Beta Demo', '\u{1F409}'],
      ['atlantis_demo', 'Atlantis: The Lost Tales Demo', '\u{1F531}'],
      ['dark_reign_demo', 'Dark Reign Demo', '\u{2622}'],
      ['colin_mcrae_rally_demo', 'Colin McRae Rally Demo', '\u{1F697}'],
      ['avp_alien_demo', 'Aliens versus Predator: Alien Demo', '\u{1F47E}'],
      ['avp_marine_demo', 'Aliens versus Predator: Marine Demo', '\u{1F52B}'],
      ['carmageddon2_demo', 'Carmageddon II: Carpocalypse Now Demo', '\u{1F3CE}'],
      ['alpha_centauri_demo', "Sid Meier's Alpha Centauri Demo", '\u{1FA90}'],
      ['freespace_demo', 'Descent: FreeSpace Demo', '\u{1F680}'],
      ['dark_earth_demo', 'Dark Earth Demo', '\u{1F311}'],
      ['jazz2_demo', 'Jazz Jackrabbit 2 Demo', '\u{1F407}'],
      ['simgolf_demo', "Sid Meier's SimGolf Demo", '\u{26F3}'],
      ['black_white_2_demo', 'Black & White 2 Demo', '\u{262F}'],
      ['quake2_demo_installer', 'Quake II Demo Installer', '\u{1F4BF}'],
      ['heroes3_demo', 'Heroes III Demo', '\u{1F3F0}'],
      ['heroes3_demo_installer', 'Heroes III Demo Installer', '\u{1F4BF}'],
      ['diablo2_demo', 'Diablo II Demo', '\u{1F525}'],
      ['diablo2_glide_demo', 'Diablo II Demo (Glide 3)', '\u{1F525}'],
      ['hitman_glide_demo', 'Hitman Demo 2 (Glide 3, experimental)', '\u{1F575}'],
      ['hype_glide_demo', 'Hype Demo (Glide 3, experimental)', '\u{2694}'],
      ['diablo2_demo_installer', 'Diablo II Demo Installer', '\u{1F525}'],
      ['warcraft3_demo', 'Warcraft III Demo', '\u{2694}'],
      ['gta2_demo', 'Grand Theft Auto 2 Demo', '\u{1F697}'],
      ['nfs2_demo', 'Need for Speed II Demo', '\u{1F3CE}'],
      ['nfs3_demo', 'Need for Speed III: Hot Pursuit Demo', '\u{1F3CE}'],
      ['halflife_uplink', 'Half-Life: Uplink', '\u{1F52C}'],
      ['halflife_uplink_installer', 'Half-Life: Uplink Installer', '\u{1F52C}'],
      ['deus_ex_demo', 'Deus Ex Demo', '\u{1F576}'],
      ['unreal_special_demo', 'Unreal Special Edition', '\u{1F30C}'],
      ['ut348_demo', 'Unreal Tournament Demo (348)', '\u{1F3AF}'],
      ['ut2003_demo', 'Unreal Tournament 2003 Demo', '\u{1F52B}'],
      ['ut2004_demo', 'Unreal Tournament 2004 Demo', '\u{1F3DF}'],
      ['icewind_dale_demo', 'Icewind Dale Demo', '\u{2744}'],
      ['baldurs_gate_noninteractive_demo',
        "Baldur's Gate Non-interactive Demo", '\u{1F3AC}'],
      ['baldurs_gate_interactive_demo',
        "Baldur's Gate Interactive Demo", '\u{1F409}'],
      ['baldurs_gate_chapters_1_2_demo',
        "Baldur's Gate Chapters I & II", '\u{1F409}'],
      ['civ2_win16', 'Civilization II (Win16 retail)', '\u{1F4BF}'],
      ['civ2_mge', 'Civilization II: MGE (Win32 retail)', '\u{1F4BF}'],
      // Retail, not a demo: localhost-only, built from the visitor's own disc by
      // tools/prepare-morrowind.js, and refused by name in tools/deploy-berrry.js.
      ['morrowind', 'Morrowind (retail, own ISO)', '\u{1F4BF}'],
      // Retail, localhost-only: the archive.org ISO (candidate
      // myth-the-fallen-lords) as CD D: plus the Small install its own VISE
      // Setup.exe wrote (docs/re-notes/myth-tfl.md). Refused by tools/deploy-berrry.js.
      ['myth_tfl', 'Myth: The Fallen Lords (retail, own ISO)', '\u{1F4BF}'],
      // ScummVM 0.8.0 (SDL 1.2, GPL) with Revolution's freeware floppy FOTAQ.
      ['scummvm_fotaq', 'ScummVM: Flight of the Amazon Queen', '\u{1F451}'],
      // Core Design's own 1998 India/Jungle playable demo (Direct3D HAL).
      ['tomb_raider_3_demo', 'Tomb Raider III Demo', '\u{1F5FF}'],
      // Core Design's own 1998 Venice playable demo (Direct3D HAL).
      ['tomb_raider_2_demo', 'Tomb Raider II Demo', '\u{1F6A4}'],
    ];

    // Debug-only apps: reachable from the full app list but not the
    // desktop display. Runenlegen and Tile World draw real screens
    // (tools/wep32-compare.js checks them). Liquid War and Hearts need
    // browser LAN wiring end-to-end before player-vs-player works.
    const DEBUG_ONLY_APPS = [
      ['diablo_demo', 'Diablo Demo', '\u{1F525}'],
      ['worms2_demo', 'Worms 2 Demo', '\u{1FAB1}'],
      ['fallout_demo', 'Fallout Demo', '\u{2622}'],
      ['total_annihilation_demo', 'Total Annihilation Demo', '\u{1F4A5}'],
      ['caesar3_demo', 'Caesar III Demo', '\u{1F3DB}'],
      ['captain_claw_demo', 'Captain Claw Demo', '\u{1F3F4}'],
      ['mshearts16',  'Hearts',      '\u{2665}'],
      ['runenlegen',  'Runenlegen',  '\u{1FAA8}'],
      ['tworld',      'Tile World',  '\u{1F511}'],
      ['liquid_war',        'Liquid War',    '\u{1F4A7}'],
      ['liquid_war_server', 'LW Server',     '\u{1F5A7}'],
    ];

    const rctFiles = [
      "AUTORUN.INF",
      "Data/csg1.dat",
      "Data/csg1i.dat",
      "Data/css1.dat",
      "Data/css10.dat",
      "Data/css11.dat",
      "Data/css12.dat",
      "Data/css13.dat",
      "Data/css14.dat",
      "Data/css15.dat",
      "Data/css16.dat",
      "Data/css17.dat",
      "Data/css2.dat",
      "Data/css3.dat",
      "Data/css4.dat",
      "Data/css5.dat",
      "Data/css6.dat",
      "Data/css7.dat",
      "Data/css8.dat",
      "Data/css9.dat",
      "Data/game.cfg",
      "Data/kanji.dat",
      "Data/mp.dat",
      "Data/tutoriak.dat",
      "Data/tutorial.dat",
      "English/English.txt",
      "English/Hasbro Interactive.url",
      "English/RCT.exe",
      "English/README.TXT",
      "English/RollerCoaster Tycoon Web Site.url",
      "English/license.txt",
      "Llogo.bmp",
      "SLOGO.BMP",
      "Saved Games/001",
      "Scenarios/SC.IDX",
      "Scenarios/SC10.SC4",
      "Scenarios/SC11.SC4",
      "Scenarios/SC15.SC4",
      "Scenarios/SC17.SC4",
      "Scenarios/SC4.SC4",
      "Scenarios/SC8.SC4",
      "Scenarios/SC9.SC4",
      "Scenarios/sc0.SC4",
      "Scenarios/sc3.SC4",
      "Setup.exe",
      "Tracks/Big Twister.TD4",
      "Tracks/Big Twister.TP4",
      "Tracks/Chipper Dipper.TD4",
      "Tracks/Chipper Dipper.TP4",
      "Tracks/Crazy Caterpillar.TD4",
      "Tracks/Crazy Caterpillar.TP4",
      "Tracks/Demon Drop.TD4",
      "Tracks/Demon Drop.TP4",
      "Tracks/Exterminator.TD4",
      "Tracks/Exterminator.TP4",
      "Tracks/Logger's Revenge.TD4",
      "Tracks/Logger's Revenge.TP4",
      "Tracks/Manic Miner.TD4",
      "Tracks/Manic Miner.TP4",
      "Tracks/Manic Mouse.TD4",
      "Tracks/Manic Mouse.TP4",
      "Tracks/Mini Cars.TD4",
      "Tracks/Mini Cars.TP4",
      "Tracks/Mini Maze.TD4",
      "Tracks/Mini Maze.TP4",
      "Tracks/Mini Miner.TD4",
      "Tracks/Mini Miner.TP4",
      "Tracks/Ropey Rapids.TD4",
      "Tracks/Ropey Rapids.TP4",
      "Tracks/Scorpion.TD4",
      "Tracks/Scorpion.TP4",
      "Tracks/Spiral Maze.TD4",
      "Tracks/Spiral Maze.TP4",
      "Tracks/Thunder Looper.TD4",
      "Tracks/Thunder Looper.TP4",
      "UniFish3.exe",
    ].flatMap(p => {
      const url = 'binaries/shareware/rct/' + p;
      const mapped = [{ url, vfsPath: 'c:\\' + p,
        httpRange: /^Data\/(?:csg1|css1|css2|css13|css17)\.dat$/i.test(p) }];
      if (p.startsWith('English/')) {
        mapped.push({ url, vfsPath: 'c:\\' + p.slice('English/'.length),
          httpRange: mapped[0].httpRange });
      }
      return mapped;
    });

    const aoe1Files = [
      "Aelaunch.dll",
      "Aggres_1.per",
      "Aggres_2.per",
      "Aggres_3.per",
      "Aichall.ai",
      "Aoe.ply",
      "AoEHlp.dll",
      "Archer_1.ai",
      "Archer_2.ai",
      "Arial.ttf",
      "Arialbd.ttf",
      "Armies_1.cpn",
      "Assyri_1.ai",
      "Assyri_2.ai",
      "Assyrian.doc",
      "Bablnian.doc",
      "Babylo_1.ai",
      "Babylo_2.ai",
      "Bird.wav",
      "Cavalr_1.ai",
      "Cavalr_2.ai",
      "Cavarc_1.ai",
      "Choson_1.ai",
      "Choson_2.ai",
      "Choson.doc",
      "Closedpw.exe",
      "Comic.ttf",
      "Comicbd.ttf",
      "Coprgtb.ttf",
      "Coprgtl.ttf",
      "data/Border.drs",
      "data/Graphics.drs",
      "data/Interfac.drs",
      "data/Sounds.drs",
      "data/Terrain.drs",
      "De316f_1.ai",
      "De34c1_1.ai",
      "De451c_1.ai",
      "De494f_1.ai",
      "De4ef6_1.ai",
      "De4fe1_1.ai",
      "De5149_1.ai",
      "De8dfc_1.ai",
      "Deathm_1.ai",
      "Deathm_2.ai",
      "Deathm_3.ai",
      "Deathm_4.ai",
      "Default.ai",
      "Default.cty",
      "Default.per",
      "Defens_1.per",
      "Desert1.wav",
      "dplay50a.EXE",
      "Egyptc_1.ai",
      "Egyptian.doc",
      "Egyptw_1.ai",
      "Elepha_1.ai",
      "Empires.dat",
      "Empires.hlp",
      "eula.txt",
      "Forest1.wav",
      "Greek.doc",
      "Greekp_1.ai",
      "Hittit_1.ai",
      "Hittit_2.ai",
      "Hittite.doc",
      "Im04fa_1.ai",
      "Im867c_1.ai",
      "Immort_1.ai",
      "Immort_2.ai",
      "Immort_3.ai",
      "Immort_4.ai",
      "Infant_1.ai",
      "Infant_2.ai",
      "Infant_3.ai",
      "language.dll",
      "Learn.txt",
      "Lost.mid",
      "Minoac_1.ai",
      "Minoan.doc",
      "Multip_1.scn",
      "Music1.mid",
      "Music2.mid",
      "Music3.mid",
      "Music4.mid",
      "Music5.mid",
      "Music6.mid",
      "Music7.mid",
      "Music8.mid",
      "Music9.mid",
      "Ocean1.wav",
      "Open.mid",
      "Passiv_1.per",
      "Passive.per",
      "Persia_1.ai",
      "Persian.doc",
      "Phalan_1.ai",
      "Phalan_2.ai",
      "Phnician.doc",
      "Phoeni_1.ai",
      "Priest_1.ai",
      "Priest_2.ai",
      "Readme.doc",
      "Reigno_1.cpn",
      "Rules.rps",
      "Savegame.txt",
      "Scenario.inf",
      "setup.exe",
      "setupenu.dll",
      "Shadow.col",
      "Shang.doc",
      "Shangc_1.ai",
      "Shangc_2.ai",
      "Shangh_1.ai",
      "Sumeri_1.ai",
      "Sumeri_2.ai",
      "Sumerian.doc",
      "Supera_1.per",
      "Tileedge.dat",
      "Trirem_1.ai",
      "Trirem_2.ai",
      "Warele_1.ai",
      "Wind1.wav",
      "Wind2.wav",
      "Won.mid",
      "Wonder_1.ai",
      "Yamato_1.ai",
      "Yamato.doc",
    ].map(p => {
      const url = 'binaries/shareware/aoe/aoe_ex/' + p;
      const name = p.toLowerCase().replace(/\//g, '\\');
      let vfsPath = 'c:\\' + name;
      if (/\.cpn$/i.test(p)) vfsPath = 'c:\\campaign\\' + name;
      else if (/\.scn$|^scenario\.inf$/i.test(p)) vfsPath = 'c:\\scenario\\' + name;
      else if (/\.(mid|wav)$/i.test(p)) vfsPath = 'c:\\sound\\' + name;
      else if (/^empires\.dat$/i.test(p)) vfsPath = 'c:\\data\\' + name;
      else if (/^tileedge\.dat$/i.test(p)) vfsPath = 'c:\\data\\' + name;
      if (/^data\/.*\.drs$/i.test(p)) {
        return { url, vfsPaths: [vfsPath, 'c:\\' + p.split('/').pop().toLowerCase()] };
      }
      return { url, vfsPath };
    });

    const aoe2Root = 'binaries/shareware/aoe2/aoe2_ex/';
    const aoe2CampaignMedia = [
      'backgrd8.SLP', 'backgrd8.pal', 'backgrd8.sin',
      'c8s1_beg.SLP', 'c8s1_beg.mm', 'c8s1_end.SLP', 'c8s1_end.mm',
      'c8s2_beg.SLP', 'c8s2_beg.mm', 'c8s2_end.SLP', 'c8s2_end.mm',
      'c8s3_beg.SLP', 'c8s3_beg.mm', 'c8s3_end.SLP', 'c8s3_end.mm',
      'c8s4_beg.SLP', 'c8s4_beg.mm', 'c8s4_end.SLP', 'c8s4_end.mm',
      'c8s5_beg.SLP', 'c8s5_beg.mm', 'c8s5_end.SLP', 'c8s5_end.mm',
      'c8s6_beg.SLP', 'c8s6_beg.mm', 'c8s6_end.SLP', 'c8s6_end.mm',
      'c8s7_beg.SLP', 'c8s7_beg.mm', 'c8s7_end.SLP', 'c8s7_end.mm',
      'cam8.bln', 'intro.bln', 'intro.mm', 'intro.pal', 'intro.sin',
      'intro.slp', 'introbkg.SLP',
    ].map(name => `campaign/media/${name}`);
    const aoe2CampaignSound = [
      'c8s1.mp3', 'c8s1end.mp3', 'c8s2.mp3', 'c8s2end.mp3',
      'c8s3.mp3', 'c8s3end.mp3', 'c8s4.mp3', 'c8s4end.mp3',
      'c8s5.mp3', 'c8s5end.mp3', 'c8s6.mp3', 'c8s6end.mp3',
      'c8s7.mp3', 'c8s7end.mp3', 'intro.mp3',
    ].map(name => `Sound/campaign/${name}`);
    const aoe2Files = [
      // These are loaded dynamically rather than appearing in the EXE import
      // table. Without them the web host exits cleanly before creating AoE2's
      // main window, even though a local CLI run can find the sibling DLL.
      'EBUEula.dll',
      'EULA.RTF',
      'language.dll',
      'Data/interfac.drs',
      'Data/gamedata.drs',
      'Data/terrain.drs',
      'Data/graphics.drs',
      'Data/sounds.drs',
      'Data/empires2.dat',
      'Data/blendomatic.dat',
      'Data/BlkEdge.Dat',
      'Data/TileEdge.Dat',
      'Data/PatternMasks.dat',
      'Data/FilterMaps.dat',
      'Data/LoQMaps.dat',
      'Data/STemplet.dat',
      'Data/lightMaps.dat',
      'Data/view_icm.dat',
      'Data/shadow.col',
      'FONTS/arial.ttf',
      'FONTS/ArialN.TTF',
      'FONTS/Georgia.TTF',
      'FONTS/Georgiab.TTF',
      'FONTS/Georgiai.TTF',
      'FONTS/LBLACK.TTF',
      'FONTS/LBRITE.TTF',
      'FONTS/LBRITED.TTF',
      // The menu is present without these files, but creating a player then
      // enumerates campaign\\*.cpn and scenario\\*.scn. Mount the complete
      // shipped trial campaign rather than exposing empty gameplay buttons.
      'campaign/cam8.cpn',
      ...aoe2CampaignMedia,
      ...aoe2CampaignSound,
      'Scenario/Trial Coastal Map.scn',
      'Scenario/Trial Multiplayer Coastal Map.scn',
      'Scenario/scenario.inf',
      ...[
        'lost.mid', 'music1.mid', 'music2.mid', 'music3.mid', 'music4.mid',
        'music5.mid', 'music6.mid', 'music7.mid', 'music8.mid', 'open.mid',
        'won.mid',
      ].map(name => `Sound/midi/${name}`),
    ].map(path => (path.includes('/')
      // The game opens Data\*.drs, Sound\..., Campaign\... relative to its
      // directory; a bare URL mounts at C:\<basename>, where those relative
      // opens fail ("Could not initialize graphics system"). Mount each file
      // at its own relative path and keep the basename alias.
      ? { url: aoe2Root + path, vfsPaths: ['c:\\' + path.replace(/\//g, '\\'),
        'c:\\' + path.split('/').pop()] }
      : aoe2Root + path));

    const pinballFiles = [
      'binaries/pinball/wavemix.inf',
      'binaries/pinball/PINBALL.DAT',
      'binaries/pinball/FONT.DAT',
      'binaries/pinball/table.bmp',
      'binaries/pinball/PINBALL.MID',
      'binaries/pinball/PINBALL2.MID',
      'binaries/pinball/SOUND1.WAV',
      'binaries/pinball/SOUND104.WAV',
      'binaries/pinball/SOUND105.WAV',
      'binaries/pinball/SOUND108.WAV',
      'binaries/pinball/SOUND111.WAV',
      'binaries/pinball/SOUND112.WAV',
      'binaries/pinball/SOUND12.WAV',
      'binaries/pinball/SOUND13.WAV',
      'binaries/pinball/SOUND131.WAV',
      'binaries/pinball/SOUND136.WAV',
      'binaries/pinball/SOUND14.WAV',
      'binaries/pinball/SOUND16.WAV',
      'binaries/pinball/SOUND17.WAV',
      'binaries/pinball/SOUND18.WAV',
      'binaries/pinball/SOUND181.WAV',
      'binaries/pinball/SOUND19.WAV',
      'binaries/pinball/SOUND20.WAV',
      'binaries/pinball/SOUND21.WAV',
      'binaries/pinball/SOUND22.WAV',
      'binaries/pinball/SOUND24.WAV',
      'binaries/pinball/SOUND240.WAV',
      'binaries/pinball/SOUND243.WAV',
      'binaries/pinball/SOUND25.WAV',
      'binaries/pinball/SOUND26.WAV',
      'binaries/pinball/SOUND27.WAV',
      'binaries/pinball/SOUND28.WAV',
      'binaries/pinball/SOUND29.WAV',
      'binaries/pinball/SOUND3.WAV',
      'binaries/pinball/SOUND30.WAV',
      'binaries/pinball/SOUND34.WAV',
      'binaries/pinball/SOUND35.WAV',
      'binaries/pinball/SOUND36.WAV',
      'binaries/pinball/SOUND38.WAV',
      'binaries/pinball/SOUND39.WAV',
      'binaries/pinball/SOUND4.WAV',
      'binaries/pinball/SOUND42.WAV',
      'binaries/pinball/SOUND43.WAV',
      'binaries/pinball/SOUND45.WAV',
      'binaries/pinball/SOUND49.WAV',
      'binaries/pinball/SOUND49D.WAV',
      'binaries/pinball/SOUND5.WAV',
      'binaries/pinball/SOUND50.WAV',
      'binaries/pinball/SOUND528.WAV',
      'binaries/pinball/SOUND53.WAV',
      'binaries/pinball/SOUND54.WAV',
      'binaries/pinball/SOUND55.WAV',
      'binaries/pinball/SOUND560.WAV',
      'binaries/pinball/SOUND563.WAV',
      'binaries/pinball/SOUND57.WAV',
      'binaries/pinball/SOUND58.WAV',
      'binaries/pinball/SOUND6.WAV',
      'binaries/pinball/SOUND65.WAV',
      'binaries/pinball/SOUND68.WAV',
      'binaries/pinball/SOUND7.WAV',
      'binaries/pinball/SOUND713.WAV',
      'binaries/pinball/SOUND735.WAV',
      'binaries/pinball/SOUND8.WAV',
      'binaries/pinball/SOUND827.WAV',
      'binaries/pinball/SOUND9.WAV',
      'binaries/pinball/SOUND999.WAV',
    ];

    const pinballPlus95Files = [
      'binaries/pinball-plus95/wavemix.inf',
      'binaries/pinball-plus95/PINBALL.DAT',
      'binaries/pinball-plus95/FONT.DAT',
      'binaries/pinball-plus95/table.bmp',
      'binaries/pinball-plus95/PINBALL.MID',
      'binaries/pinball-plus95/PINBALL2.MID',
      'binaries/pinball-plus95/SOUND1.WAV',
      'binaries/pinball-plus95/SOUND104.WAV',
      'binaries/pinball-plus95/SOUND105.WAV',
      'binaries/pinball-plus95/SOUND108.WAV',
      'binaries/pinball-plus95/SOUND12.WAV',
      'binaries/pinball-plus95/SOUND131.WAV',
      'binaries/pinball-plus95/SOUND14.WAV',
      'binaries/pinball-plus95/SOUND16.WAV',
      'binaries/pinball-plus95/SOUND17.WAV',
      'binaries/pinball-plus95/SOUND18.WAV',
      'binaries/pinball-plus95/SOUND19.WAV',
      'binaries/pinball-plus95/SOUND20.WAV',
      'binaries/pinball-plus95/SOUND21.WAV',
      'binaries/pinball-plus95/SOUND22.WAV',
      'binaries/pinball-plus95/SOUND24.WAV',
      'binaries/pinball-plus95/SOUND25.WAV',
      'binaries/pinball-plus95/SOUND26.WAV',
      'binaries/pinball-plus95/SOUND27.WAV',
      'binaries/pinball-plus95/SOUND28.WAV',
      'binaries/pinball-plus95/SOUND29.WAV',
      'binaries/pinball-plus95/SOUND3.WAV',
      'binaries/pinball-plus95/SOUND30.WAV',
      'binaries/pinball-plus95/SOUND34.WAV',
      'binaries/pinball-plus95/SOUND35.WAV',
      'binaries/pinball-plus95/SOUND36.WAV',
      'binaries/pinball-plus95/SOUND38.WAV',
      'binaries/pinball-plus95/SOUND39.WAV',
      'binaries/pinball-plus95/SOUND4.WAV',
      'binaries/pinball-plus95/SOUND42.WAV',
      'binaries/pinball-plus95/SOUND43.WAV',
      'binaries/pinball-plus95/SOUND45.WAV',
      'binaries/pinball-plus95/SOUND49.WAV',
      'binaries/pinball-plus95/SOUND49D.WAV',
      'binaries/pinball-plus95/SOUND5.WAV',
      'binaries/pinball-plus95/SOUND50.WAV',
      'binaries/pinball-plus95/SOUND54.WAV',
      'binaries/pinball-plus95/SOUND55.WAV',
      'binaries/pinball-plus95/SOUND57.WAV',
      'binaries/pinball-plus95/SOUND58.WAV',
      'binaries/pinball-plus95/SOUND7.WAV',
      'binaries/pinball-plus95/SOUND8.WAV',
      'binaries/pinball-plus95/SOUND9.WAV',
    ];

    const dxSdkBinFiles = [
      'binaries/dx-sdk/bin/banana.ppm',
      'binaries/dx-sdk/bin/camera.x',
      'binaries/dx-sdk/bin/checker.ppm',
      'binaries/dx-sdk/bin/lake.ppm',
      'binaries/dx-sdk/bin/mslogo.x',
      'binaries/dx-sdk/bin/pm_bship.x',
      'binaries/dx-sdk/bin/pm_cam.x',
      'binaries/dx-sdk/bin/pm_chrry.x',
      'binaries/dx-sdk/bin/pm_cube.x',
      'binaries/dx-sdk/bin/pm_dship.x',
      'binaries/dx-sdk/bin/pm_egg.x',
      'binaries/dx-sdk/bin/pm_land4.x',
      'binaries/dx-sdk/bin/pm_mslog.x',
      'binaries/dx-sdk/bin/pm_multi.x',
      'binaries/dx-sdk/bin/pm_rmlog.x',
      'binaries/dx-sdk/bin/pm_sph0.x',
      'binaries/dx-sdk/bin/pm_sph1.x',
      'binaries/dx-sdk/bin/pm_sph2.x',
      'binaries/dx-sdk/bin/pm_sph3.x',
      'binaries/dx-sdk/bin/pm_sph4.x',
      'binaries/dx-sdk/bin/pm_torus.x',
      'binaries/dx-sdk/bin/pm_tpot.x',
      'binaries/dx-sdk/bin/pm_tpot0.x',
      'binaries/dx-sdk/bin/pm_tpot1.x',
      'binaries/dx-sdk/bin/pm_tpot2.x',
      'binaries/dx-sdk/bin/pm_tpot3.x',
      'binaries/dx-sdk/bin/pm_tree.x',
      'binaries/dx-sdk/bin/sphere2.x',
      'binaries/dx-sdk/bin/sphere3.x',
      'binaries/dx-sdk/bin/tex1.ppm',
      'binaries/dx-sdk/bin/tex2.ppm',
      'binaries/dx-sdk/bin/tex3.ppm',
      'binaries/dx-sdk/bin/tex4.ppm',
      'binaries/dx-sdk/bin/tex5.ppm',
      'binaries/dx-sdk/bin/tex6.ppm',
      'binaries/dx-sdk/bin/tex7.ppm',
      'binaries/dx-sdk/bin/win95.ppm',
    ];

    // The Viewer sample asks MeshBuilder::Load for three plain Mesh files.
    // The files locally present under these names are ProgressiveMesh copies,
    // which correctly fail that interface's type filter with
    // D3DRMERR_NOTFOUND. Use the same tracked plain-Mesh fixtures as the CLI
    // smoke test so the browser and CLI launch the same valid scene.
    const dxViewerFiles = [
      ...dxSdkBinFiles.filter(file => !/(?:camera|mslogo|sphere2)\.x$/i.test(file)),
      { url: 'test/fixtures/d3drm/tetra.x', vfsPath: 'c:\\camera.x' },
      { url: 'test/fixtures/d3drm/cube.x', vfsPath: 'c:\\mslogo.x' },
      { url: 'test/fixtures/d3drm/cube.x', vfsPath: 'c:\\sphere2.x' },
    ];

    // Public DX-Ball 1.09 freeware payload. Keep readme.txt in the mounted set
    // so the author's notice and the original-package links remain available.
    const dxballRoot = 'packages/freeware/dxball/';
    const dxballFiles = [
      '12flight.mds', 'acker-gs.mds', 'ao-laser.wav', 'bang.wav',
      'bassdrum.wav', 'bigbolt.pcx', 'boing.wav', 'brain.mds',
      'byeball.wav', 'candy.sbk', 'chisel2.sbk', 'default.bds',
      'effect.wav', 'effect2.wav', 'ethno_pa.mds', 'fanfare.wav',
      'freebee.mds', 'glass.wav', 'gmfigaro.mds', 'gunfire.wav',
      'highscor.pcx', 'humm.wav', 'intro.pcx', 'mainmenu.pcx',
      'mainmenu.sbk', 'mball2.sbk', 'mbbkgrnd.pcx', 'orchblas.wav',
      'orchestr.wav', 'padexplo.wav', 'peow!.wav', 'readme.txt',
      'ricochet.wav', 'saucer.wav', 'score.dat', 'sfont.sbk',
      'sweepdow.wav', 'swordswi.wav', 'sysfont.sbk', 'tank.wav',
      'thefont.sbk', 'thudclap.wav', 'voltage.wav', 'whine.wav',
      'wowpulse.wav', 'xploshor.wav', 'xplosht1.wav',
    ].map(name => dxballRoot + name);

    // Public Blobby Volley 1.7.4 freeware payload. Instructions.txt carries
    // the authors' notice and is mounted beside the three runtime PAKs.
    const blobbyRoot = 'packages/freeware/blobby-volley/';
    // settings.dat is the game's OWN save file, captured by walking the
    // settings menu once and letting volley.exe write it on a clean exit —
    // not a file we invented. It ships because the shipped default is
    // SPIELER 1: Comp. (leicht): player one is always the network HOST
    // (Instructions.txt 3.2.1), so out of the box the person hosting a match
    // has no controls at all and their blob only twitches as the AI chases
    // the ball. That reads exactly like a broken network game. The mounted
    // copy sets player one to the keyboard on A/D/W and leaves player two on
    // the mouse, which is what the touch layout below is built around.
    const blobbyFiles = [
      'graph.pak', 'sound.pak', 'text.pak', 'Instructions.txt', 'settings.dat',
    ].map(name => blobbyRoot + name);
    const caveStoryRoot = 'test/binaries/candidates/cave-story/';
    const generallyRoot = 'test/binaries/candidates/generally/';
    const pocketTanksRoot =
      'test/binaries/candidates/pocket-tanks-installer/installed/';
    const littleFighter2Root =
      'test/binaries/candidates/little-fighter-2-installer/installed/';
    const icyTowerRoot = 'test/binaries/candidates/icy-tower/installed/';
    const snoodRoot = 'test/binaries/candidates/snood/installed/';
    const ricochetXtremeRoot = 'test/binaries/candidates/reflexive-ricochet-xtreme/';
    const alienShooterRoot = 'test/binaries/candidates/reflexive-alien-shooter/';
    const collapseCrunchRoot = 'test/binaries/candidates/reflexive-collapse-crunch/';
    const zumaDeluxeRoot = 'test/binaries/candidates/reflexive-zuma-deluxe/';
    const crimsonlandRoot = 'test/binaries/candidates/reflexive-crimsonland/';
    const elastoManiaRoot = 'test/binaries/candidates/elasto-mania/';
    const jardinainsRoot = 'test/binaries/candidates/jardinains/installed/';
    const nethackRoot = 'test/binaries/candidates/nethack-win32/';
    const qbobRoot = 'test/binaries/candidates/qbob/';
    const scummvmFotaqRoot = 'test/binaries/candidates/scummvm-fotaq/';
    // The tree the demo's own MSI installer writes (Sierra\Arcanum Preview),
    // captured from a run of Setup.exe; see test/candidate-corpus/manifest.json.
    const arcanumDemoRoot = 'test/binaries/candidates/arcanum-demo/';
    const tetrinetRoot = 'test/binaries/candidates/tetrinet/';
    const moorhuhnRoot = 'test/binaries/candidates/moorhuhn/';
    const moorhuhn2Root = 'test/binaries/candidates/moorhuhn-2/';
    const moorhuhnWinterRoot = 'test/binaries/candidates/moorhuhn-winter/';
    const moorhuhn3Root = 'test/binaries/candidates/moorhuhn-3/';
    const moorhuhnTennisRoot = 'test/binaries/candidates/moorhuhn-tennis/installed/';
    // Every Moorhuhn shooter (1, Gallinelle, 2, Winter, 3) reloads on the
    // right button and draws its shells in the same bottom-right strip
    // (measured 2026-09-28 from a round of each), so the zone lies over them:
    // tapping the ammunition reloads it. A fresh object per entry, so no two
    // apps share one config.
    const moorhuhnReloadZone = () => ({ mouseButton: 2, label: 'Reload',
      rect: { x: 0.64, y: 0.86, w: 0.36, h: 0.14 } });
    // Need for Speed II/III drive on the arrow keys: Up is gas, Down brake,
    // Left/Right steer, Space the handbrake; the menus take the same arrows
    // plus Enter and Esc. Every driving key is held while the finger is down
    // (the default), because the game polls key state per frame. A fresh
    // object per entry, so no two apps share one config.
    // The left thumb gets a full 8-way pad, not two steer buttons: a diagonal
    // holds gas (or brake) and a turn together, and the same pad walks the
    // menus. Gas/Brake stay on the right for two-thumb driving; the pad and
    // a button holding one vk are reference-counted, not fought over.
    const nfsTouchControls = () => ({
      screenAnchored: true,
      dpad: { pos: 'bl', ways: 8 },
      buttons: [
        // br rows are row-reverse: the first button sits at the right edge.
        { vk: 0x26, label: 'Gas', pos: 'br', width: 96, height: 96 },
        { vk: 0x28, label: 'Brake', pos: 'br', width: 80, height: 80 },
        { vk: 0x20, label: 'Handbrake', pos: 'br', row: 1 },
        // Both menu keys top-left: top-right is the shell's own close chip.
        { vk: 0x1B, label: 'Esc', pos: 'tl', hold: false },
        { vk: 0x0D, label: 'Enter', pos: 'tl', hold: false },
      ],
    });
    const moorhuhn3Puzzle = name => {
      const root = 'test/binaries/candidates/moorhuhn-3-puzzles/' + name + '/';
      return {
        exe: root + 'setup.exe',
        files: ['bananistan.tmp', 'banner.jpg', 'bar.jpg', 'data.pck', 'index.scr',
          'loader.da_', 'pbin.da_', 'puzzle.pzl', 'sp.gif'].map(file => root + file),
        requiredFiles: true,
        // One frame is one board repaint pass. setup.exe is byte-identical in
        // all three packages. 0x40478c polls every loop and leaves at once
        // when nothing is dirty; 0x4047a2 is its draw path (DrawDibBegin,
        // the 8-row DrawDibDraw strips, DrawDibEnd), and 0x404872, after
        // DrawDibEnd, fires once per pass (docs/re-notes/moorhuhn.md).
        perf: { logicalFrame: { label: 'FRAME', address: 0x004047a2, verifier: 0x00404872 } },
      };
    };

    // Local-only trees extracted from the verified Archive.org Windows 98
    // A-D demo/shareware collection documented in test/binaries/SOURCES.md.
    // tools/gen-win98-games-a-d-manifests.js inventories each ignored tree
    // so the browser mounts the same working directory as the CLI harness.
    const win98GamesADRoot = 'test/binaries/win98-games-a-d/';
    const dungeonSiegeDemoRoot = win98GamesADRoot + 'DungeonSiege demo-D3D/extracted/';
    const curseMonkeyIslandRoot = win98GamesADRoot +
      'Curse of Monkey Island demo-SW/';
    // Installed by tools/install-atomic-bomberman-demo.js from archive.org.
    const atomicBombermanJuneRoot = win98GamesADRoot +
      'Atomic Bomberman Demo-archive/installed/';
    const brokenSwordRoot = win98GamesADRoot + 'Broken_Sword_demo-SW/installed/';
    const dungeonKeeperRoot = win98GamesADRoot +
      'Dungeon Keeper Demo-SWonly/installed/';
    const darkstoneRoot = win98GamesADRoot + 'DarkstoneDemo-D3D/installed/';
    const anno1602Root = win98GamesADRoot + 'Anno1602-demo-SW/extracted/';
    const driverDemoRoot = win98GamesADRoot + 'Driver-Demo-Glide-D3D/installed/';
    const cmr2DemoRoot = win98GamesADRoot + 'Colin-Mcrae-Rally2-demo-D3D/extracted/';
    const populousTbRoot =
      'test/binaries/candidates/populous-the-beginning-demo/extracted/';
    const redAlert95DemoRoot = win98GamesADRoot + 'CnC-Red Alert Demo-SW/INSTALL/';
    const dieByTheSwordDemoRoot = win98GamesADRoot + 'Die by the sword demo-SW+Glide/';
    const darkColonyDemoRoot = win98GamesADRoot + 'DarkColony-MagDemo-SW/';
    const atlantisDemoRoot = win98GamesADRoot + 'ATLANTIS demo SW/';
    const darkReignDemoRoot = win98GamesADRoot + 'Dark Reign-SWonlyProbablyMaybeD3D/DATA/';
    const colinMcRaeDemoRoot = win98GamesADRoot + 'ColinMcrae-Rally1-Demo/SETUP/';
    const carmageddon2DemoRoot = win98GamesADRoot + 'Carmageddon2Demo-D3D-Glide/installed/';
    const avpAlienDemoRoot = win98GamesADRoot + 'Alien vs Predator - Alien demo-D3D/extracted/';
    const avpMarineDemoRoot = win98GamesADRoot + 'Alien vs Predator-MarineDemo-D3D/';
    const alphaCentauriDemoRoot = win98GamesADRoot + 'Alpha Centauri demo-SW/programs/';
    const freespaceDemoRoot = win98GamesADRoot + 'Descent-Freespace demo-SW/installed/';
    const darkEarthDemoRoot = win98GamesADRoot + 'Dark_Earth_demo-NeedMountedCD-SW/';
    const descent3DemoRoot = win98GamesADRoot + 'Descent3 demo10-installed/installed/games/descent3demo/';
    const diehardDemoRoot = win98GamesADRoot + 'Diehard-nakatomi-demo-installed/program files/fox/die hard nakatomi plaza demo/';
    const drakanDemoRoot = win98GamesADRoot + 'DrakanOrderOfTheFlameDemoD3D-installed/drakan demo/';
    const braveheartDemoRoot = win98GamesADRoot + 'braveheart-demo-Glide-installed/braveheart covermount demo/';
    const anachronoxDemoRoot = win98GamesADRoot + 'Anachronox-Demo-SW-OpenGL-installed/anoxdemo/';
    const daikatanaDemoRoot = win98GamesADRoot + 'Daikatana demo-SW/installed/';
    const asghanDemoRoot = win98GamesADRoot + 'Asghan-demo-installed/';
    const deltaForceDemoRoot = win98GamesADRoot + 'Delta Force-demo-SWonly/installed/';
    const comancheGoldDemoRoot = win98GamesADRoot + 'Commanche Gold-DEMO-SW/installed/';
    const comancheGoldDemoDir = 'c:\\program files\\novalogic\\comanche gold demo\\';
    const daytonaDemoRoot = win98GamesADRoot + 'DaytonaUSA Deluxe-SWonly/GAME/';
    const blood2DemoRoot = win98GamesADRoot + 'Blood2-demoD3D/Game/';
    const disciplesDemoRoot = win98GamesADRoot + 'Disciples demo SW/installed/';
    const commandosDemoRoot = win98GamesADRoot + 'Commandos demo-SWonly/installed/';
    const ageOfWondersDemoRoot = win98GamesADRoot + 'Age Of Wonders demo-SW/installed/';
    const ageOfWonders2DemoRoot = win98GamesADRoot + 'Age of Wonders2 demo-SW/extracted/';

    // Installed payload from Epic's original 1.23s shareware package. Keep it
    // localhost-only: the executable is useful as a fast-scrolling 8-bit
    // DirectDraw/Miles regression, but the bundled demo terms have not been
    // cleared for public deployment. Every game resource sits beside the exe.
    const jazz2DemoRoot =
      'test/binaries/candidates/jazz-jackrabbit-2-demo-installer/installed/';
    const jazz2DemoFiles = [
      'animssw.j2a banlist.lst boss2.j2b data.j2d diam2.j2t diamond.j2b',
      'dutch.j2s english.j2s filter.lst flash.j2e french.j2s funkyg.j2b',
      'german.j2s god.j2v godlq.j2v godsnd.j2v home.j2e intro.j2b',
      'intro.j2v introlq.j2v italian.j2s labrat.j2b labrat1n.j2t logo.j2v',
      'logolq.j2v menu.j2b monk.j2e order.j2b prince.j2e psych2.j2t',
      'rescue.j2e share.j2e share1.j2l share1.j2m share2.j2l share2.j2m',
      'share3.j2l share3.j2m sharect2.j2l sharectf.j2l sharetrs.j2l',
      'spanish.j2s uninst.j2',
    ].flatMap(group => group.split(' ')).map(name => jazz2DemoRoot + name);

    // Original demo installers kept as localhost-only compatibility probes.
    // Their payloads have not been extracted or cleared for deployment, so
    // the labels make it explicit that selecting one starts its setup program.
    const localDemoInstallerRoot = 'test/binaries/candidates/';
    const simgolfDemoRoot = localDemoInstallerRoot +
      'simgolf-demo-installer/installed/';
    const simcity2000DemoRoot = localDemoInstallerRoot +
      'simcity-2000-demo/installed/';
    const simcity2000NetRoot = localDemoInstallerRoot +
      'simcity-2000-network-edition-demo/';
    const civ2Win16Root = localDemoInstallerRoot + 'civilization-2-win16/';
    const civ2MgeRoot = localDemoInstallerRoot + 'civilization-2-mge-win32/';
    const mythRoot = localDemoInstallerRoot + 'myth-the-fallen-lords/';
    const morrowindRoot = localDemoInstallerRoot + 'morrowind/';

    // Official Baldur's Gate previews prepared by the pinned local-only
    // candidate-corpus recipes. Preserve their installed directory layout:
    // Infinity resolves KEY/BIF resources through the C:\ aliases in each INI.
    const infinityTreeFiles = (root, names) => names.trim().split(/\s+/).map(name => ({
      url: root + name,
      vfsPath: 'c:\\' + name.replace(/\//g, '\\'),
    }));
    const baldursGateNoninteractiveRoot = localDemoInstallerRoot +
      'baldurs-gate-noninteractive-demo/';
    const baldursGateNoninteractiveFiles = infinityTreeFiles(
      baldursGateNoninteractiveRoot,
      `CHITIN.KEY Chitin.ini Music/sst1.MUS Music/sst1/sst1a.acm
       NID.bif NID2.bif ReadMe.txt`);

    const baldursGateInteractiveRoot = localDemoInstallerRoot +
      'baldurs-gate-interactive-demo/installed-extracted/MinimumData/';
    // The visual/gameplay candidate deliberately omits the optional 37 MB of
    // adaptive-music ACM stems. Everything used by its movies, menus,
    // character creator, scripts, voices and Candlekeep areas is mounted.
    const baldursGateInteractiveFiles = infinityTreeFiles(
      baldursGateInteractiveRoot,
      `Baldur.exe Baldur.ini CD1/Movies/MovieCD1.bif CD1/Movies/Movies.bif
       CD1/data/AREA2600.bif CD1/data/AREA260a.bif CD1/data/AREA2700.bif
       CD1/data/AREA2800.bif CD1/data/CHASound.bif CD1/data/CREAnim.bif
       CD1/data/CRESound.bif CD1/data/NPCSound.bif CD1/data/RndEncnt.bif
       Chitin.key Config.exe Keymap.ini Music/BC1.mus Music/BC2.mus
       Music/BD1.mus Music/BD2.mus Music/BF1.mus Music/BF2.mus Music/BL1.mus
       Music/BL2.mus Music/BP1.mus Music/BP2.mus Music/BW1.mus Music/CDay1.mus
       Music/CDay2.mus Music/CNite.mus Music/Chapter.mus Music/Dream.mus
       Music/Dung1.mus Music/Dung2.mus Music/Dung3.mus Music/FDay.mus
       Music/FNite.mus Music/Fort.mus Music/PDay.mus Music/Pnite.mus
       Music/TDay1.mus Music/TDay2.mus Music/TNite.mus Music/Tav1.mus
       Music/Tav2.mus Music/Tav3.mus Music/Tav4.mus Music/Temple.mus
       Music/Theme.mus Music/chants.mus Scripts/None.bs Scripts/cleric1.bs
       Scripts/cleric2.bs Scripts/cleric3.bs Scripts/cleric4.bs
       Scripts/default.bs Scripts/fighter1.bs Scripts/fighter2.bs
       Scripts/fighter3.bs Scripts/fighter4.bs Scripts/mage1.bs
       Scripts/mage2.bs Scripts/mage3.bs Scripts/mage4.bs Scripts/thief1.bs
       Scripts/thief2.bs Scripts/thief3.bs Scripts/thief4.bs
       Sounds/sndlist.txt data/ARMisc.bif data/Areas.bif data/CHAAnim.bif
       data/Creature.bif data/Default.bif data/Dialog.bif data/Effects.bif
       data/Gui.bif data/Items.bif data/OBJAnim.bif data/SFXSound.bif
       data/Spells.bif data/scripts.bif dialog.tlk luaAuto.cfg
       override/Splash1.bmp override/Splash2.bmp override/Splash3.bmp
       override/Splash4.bmp`);

    const baldursGateChaptersRoot = localDemoInstallerRoot +
      'baldurs-gate-chapters-1-2-demo/installed-extracted/MinimumData/';
    const baldursGateChaptersFiles = infinityTreeFiles(
      baldursGateChaptersRoot,
      `Baldur.exe Baldur.ini Chitin.key Config.exe Keymap.ini
       Override/AutorunVE.BMP Override/StartVE.bmp Override/WorldMap.WMP
       Override/splash1.bmp Override/splash2.bmp Override/splash3.bmp
       Override/splash4.bmp Override/ws2_32a.dll Override/ws2helpa.dll
       cd1/data/AREA2300.bif cd1/data/AREA230A.bif cd1/data/AREA230b.bif
       cd1/data/AREA2600.bif cd1/data/AREA260a.bif cd1/data/AREA2700.bif
       cd1/data/AREA3300.bif cd1/data/AREA330a.bif cd1/data/AREA330b.bif
       cd1/data/AREA330c.bif cd1/data/AREA330d.bif cd1/data/AREA4800.bif
       cd1/data/AREA480X.bif cd1/data/AREA4900.bif cd1/data/AREA490X.bif
       cd1/data/AREA5400.bif cd1/data/AREA540a.bif cd1/data/AREA540b.bif
       cd1/data/AREA540c.bif cd1/data/AREA540d.bif
       cd1/movies/MovieCD1.bif cd1/movies/Movies.bif data/ARMisc.bif
       data/AreasVE.bif data/CHAAnim.bif data/CHASound.bif data/CREAnim.bif
       data/CRESound.bif data/Creature.bif data/Default.bif data/Dialog.bif
       data/Effects.bif data/Gui.bif data/Items.bif data/NPCSound.bif
       data/OBJAnim.bif data/SFXSound.bif data/Spells.bif data/scripts.bif
       dialog.tlk`);

    // These two official demos are deliberately localhost-only: their bundled
    // terms do not grant redistribution. The candidate fetcher prepares the
    // ignored trees below; no proprietary bytes enter a public deployment.
    const deusExDemoRoot = localDemoInstallerRoot + 'deus-ex-demo/installed/';
    const deusExDemoDlls = [
      'Window.dll', 'Core.dll', 'Engine.dll', 'WinDrv.dll', 'SoftDrv.dll',
      'D3DDrv.dll', 'Render.dll', 'Fire.dll', 'IpDrv.dll', 'Extension.dll',
      'ConSys.dll', 'DeusEx.dll', 'DeusExText.dll', 'Galaxy.dll',
    ].map(name => deusExDemoRoot + 'system/' + name.toLowerCase());
    // Renderer, measured fullscreen in headful Chrome (?no-threads, 2026-10-06,
    // PRESENT/s = the game's frame rate): main menu SoftDrv 10.2 / D3DDrv
    // 11.2, Training corridor SoftDrv 10.3 / D3DDrv 5.8 (D3DDrv's WebGL frame
    // readback blocks ~19% of each step, and it has no gamma ramp, so it is
    // also darker). SoftDrv is the faster correct one in play; D3DDrv.dll stays
    // mounted so the other renderer is one edit away. Every other renderer's
    // DLL is mounted beside its .int below: UE1 loads the device class from
    // the guest's own C:\System, and the page has no host disk to fall back
    // on the way the CLI does, so GlideDrv "exited in the page" (Assertion
    // failed: RenDev) only because GlideDrv.dll was never mounted.
    const deusExRenderer = 'SoftDrv.SoftwareRenderDevice';
    const deusExIniSet = {
      'Engine.Engine': {
        GameRenderDevice: deusExRenderer,
        WindowedRenderDevice: deusExRenderer,
        RenderDevice: deusExRenderer,
      },
      // Fullscreen, like the other DirectX games: the page shows the display
      // mode, and UE1's GlideDrv cannot draw into a window at all.
      'WinDrv.WindowsClient': { StartupFullscreen: 'True' },
    };
    // UE1 resolves packages beside the executable at C:\ and its content in
    // sibling directories such as C:\Maps. Keep exactly that installed view.
    const deusExDemoFiles = [
      `ConSys.u Core.int Core.u D3DDrv.int DefUser.ini Default.ini DeusEx.ini
       DeusEx.int DeusEx.u DeusExCharacters.u DeusExConAudioAIBarks.u
       DeusExConAudioMission00.u DeusExConAudioMission01.u DeusExConText.u
       DeusExConversations.u DeusExDeco.u DeusExItems.u DeusExSounds.u
       DeusExText.u DeusExUI.u Engine.int Engine.u Extension.u Fire.u
       Galaxy.int GlideDrv.dll GlideDrv.int IpDrv.int IpDrv.u IpServer.int
       IpServer.u MeTaLDrv.dll MeTaLDrv.int OpenGlDrv.dll OpenGlDrv.ini
       OpenGlDrv.int SGLDrv.dll SGLDrv.int Setup.int SoftDrv.int Startup.int User.ini WinDrv.int
       Window.int`,
    ].flatMap(group => group.trim().split(/\s+/))
      .map(name => ({
        url: deusExDemoRoot + 'system/' + name.toLowerCase(),
        vfsPaths: ['c:\\' + name, 'c:\\System\\' + name],
        ...(name === 'DeusEx.ini' ? { iniSet: deusExIniSet } : {}),
      }))
      .concat([
        `Maps/00_Training.dx Maps/00_TrainingCombat.dx
         Maps/00_TrainingFinal.dx Maps/01_NYC_UNATCOHQ.dx
         Maps/01_NYC_UNATCOIsland.dx Maps/DX.dx Maps/DXOnly.dx Maps/Entry.dx
         Help/Logo.bmp Help/LogoSmall.bmp
         Music/Credits_Music.umx Music/LibertyIsland_Music.umx
         Music/Title_Music.umx Music/Training_Music.umx Music/UNATCO_Music.umx
         Sounds/Ambient.uax Sounds/MoverSFX.uax`,
        `Textures/Area51Textures.utx Textures/BatteryPark.utx Textures/BobPage.utx
         Textures/Catacombs.utx Textures/Cmd_Tunnels.utx Textures/Constructor.utx
         Textures/CoreTexBrick.utx Textures/CoreTexCeramic.utx
         Textures/CoreTexConcrete.utx Textures/CoreTexDetail.utx
         Textures/CoreTexFoliage.utx Textures/CoreTexGlass.utx
         Textures/CoreTexMetal.utx Textures/CoreTexMisc.utx
         Textures/CoreTexPaper.utx Textures/CoreTexSky.utx
         Textures/CoreTexStone.utx Textures/CoreTexTextile.utx
         Textures/CoreTexTiles.utx Textures/CoreTexWallObj.utx
         Textures/CoreTexWood.utx Textures/DXFonts.utx Textures/Effects.utx
         Textures/HK_MJ12Lab.utx Textures/InfoPortraits.utx
         Textures/Mobile_Camp.utx Textures/NYCBar.utx Textures/NewYorkCity.utx
         Textures/OceanLab.utx Textures/Palettes.utx Textures/Paris.utx
         Textures/Render.utx Textures/Rocket.utx Textures/Supertanker.utx
         Textures/UNATCO.utx Textures/V_Com_Center.utx`,
      ].flatMap(group => group.trim().split(/\s+/)).map(name => ({
        url: deusExDemoRoot + name.toLowerCase(),
        vfsPath: 'c:\\' + name.replace(/\//g, '\\'),
      })));

    // Authentic installer-produced trees for local Unreal compatibility
    // probes. Special has no OpenGLDrv.dll and uses its software renderer;
    // UT2003/2004 ship OpenGLDrv.dll and their local INIs select it.
    const unrealSpecialDemoRoot = localDemoInstallerRoot +
      'unreal-special-edition/installed/';
    const ut2003DemoRoot = localDemoInstallerRoot +
      'unreal-tournament-2003-demo/installed/';
    const ut2004DemoRoot = localDemoInstallerRoot +
      'unreal-tournament-2004-demo/installed/';
    // Its own Setup.exe's install; the manifest is written by
    // tools/gen-tree-manifest.js with --exe=System/UnrealTournament.exe.
    const ut348DemoRoot = localDemoInstallerRoot +
      'unreal-tournament-348-demo/extracted/';

    const icewindDaleDemoRoot = localDemoInstallerRoot +
      'icewind-dale-demo/installed-extracted/Recommended_compressed/';
    const icewindDaleDemoVoiceSets = [
      ['Female_Fighter_1', 'DFF'], ['Female_Fighter_2', 'HeFC'],
      ['Female_Fighter_3', 'HeFF'], ['Female_Mage_1', 'DFC'],
      ['Female_Mage_2', 'EFM'], ['Female_Mage_3', 'GFC'],
      ['Female_Thief_1', 'HaFT'], ['Female_Thief_2', 'HFT'],
      ['Male_Fighter_1', 'DMC'], ['Male_Fighter_2', 'DMF'],
      ['Male_Fighter_3', 'HMF'], ['Male_Mage_1', 'EMM'],
      ['Male_Mage_2', 'GMM'], ['Male_Mage_3', 'GMT'],
      ['Male_Thief_1', 'EMT'], ['Male_Thief_2', 'HeMT'],
    ];
    const icewindDaleDemoVoiceFiles = icewindDaleDemoVoiceSets.flatMap(
      ([directory, prefix]) => Array.from({ length: 40 }, (_, index) => {
        const number = String(index + 1).padStart(2, '0');
        const name = `Sounds/${directory}/${prefix}_${number}.wav`;
        return {
          url: icewindDaleDemoRoot + name,
          vfsPath: 'c:\\' + name.replace(/\//g, '\\'),
        };
      }));
    const icewindDaleDemoOverrideNames = [
      ...[[1, 9], [12, 60], [62, 79], [81, 87]].flatMap(([first, last]) =>
        Array.from({ length: last - first + 1 }, (_, index) =>
          `ARUN_${String(first + index).padStart(2, '0')}.wav`)),
      ...Array.from({ length: 40 }, (_, index) =>
        `EVER_${String(index + 1).padStart(2, '0')}.wav`),
      ...Array.from({ length: 40 }, (_, index) =>
        `HROT_${String(index + 1).padStart(2, '0')}.wav`),
      ...Array.from({ length: 21 }, (_, index) =>
        `IGN_${String(index + 1).padStart(2, '0')}.wav`),
      `NARR_CH1.WAV NARR_CH2.WAV NARR_CH3.WAV NARR_PL.WAV`,
    ].flatMap(group => typeof group === 'string' ? group.trim().split(/\s+/) : group);
    const icewindDaleDemoOverrideFiles = icewindDaleDemoOverrideNames.map(name => ({
      url: icewindDaleDemoRoot + 'Override/' + name,
      vfsPath: 'c:\\override\\' + name,
    }));
    const icewindDaleDemoCdFiles = [
      `AR100A.cbf AR100B.cbf AR100C.cbf AR100D.cbf AR120X.cbf
       AR2000.cbf AR200A.cbf AR200B.cbf AR210A.cbf AR210B.cbf AR210C.cbf
       AR210D.cbf AR3000.cbf AR3001.cbf AR3101.cbf AR3201.cbf AR3301.cbf
       AR3401.cbf AR3501.cbf AR3502.cbf AR3503.cbf CREmani.cbf CREmaru.cbf
       CREmgve.cbf MVEfile1.bif MVEfile2.bif IWDCD.2`,
    ].flatMap(group => group.trim().split(/\s+/)).map(name => ({
      url: icewindDaleDemoRoot + 'Data/' + name,
      // The portable demo uses both CD2 layouts depending on which resource
      // path is being resolved. Keep C: for the merged local install and both
      // authentic D: aliases for the CD check/resource loader.
      vfsPaths: [
        'c:\\data\\' + name,
        'd:\\data\\' + name,
        'd:\\cd2\\data\\' + name,
      ],
    }));
    const icewindDaleDemoFullFiles = [
      `AR100A.bif AR100B.bif AR100C.bif AR100D.bif AR120X.bif
       AR2000.bif AR200A.bif AR200B.bif AR210A.bif AR210B.bif AR210C.bif
       AR210D.bif AR3000.bif AR3001.bif AR3101.bif AR3201.bif AR3301.bif
       AR3401.bif AR3501.bif AR3502.bif AR3503.bif CREmani.bif CREmaru.bif
       CREmgve.bif`,
    ].flatMap(group => group.trim().split(/\s+/)).map(name => ({
      url: icewindDaleDemoRoot + 'Full/Data/' + name,
      vfsPath: 'c:\\data\\' + name,
    }));
    // Create Game makes Infinity's installed-resource pass open every archive
    // whose CHITIN.KEY location is HD0 (bit 0), even when character generation
    // has not requested a resource from it yet. Omitting the first non-menu
    // archive (BCSgen.bif) produces ChDimm.cpp:817 / "Media Removed From Drive"
    // after the DirectPlay session opens. Keep all 34 location=1 archives that
    // exist in the Recommended install; location=9 CD-area and movie archives
    // remain out of this local browser route until gameplay asks for them.
    const icewindDaleDemoFiles = [
      'Dialog.tlk', 'icewind.ini', 'Keymap.ini', 'Language.ini',
    ].map(name => icewindDaleDemoRoot + name).concat([
      { url: icewindDaleDemoRoot + 'CHITIN-full.KEY', vfsPath: 'c:\\CHITIN.KEY' },
    ], [
      // Character generation enumerates C:\Sounds after Appearance.
      `Sounds/sndlist.txt`,
      `Data/SPLbmp.bif Data/ITMfile.bif Data/BCSgen.bif Data/CREfile.bif
       Data/DLGfile.bif Data/ARfile.bif Data/ARTport.bif Data/DEFAULT.bif
       Data/CREanim.bif Data/GUIbam.bif Data/GUIchui.bif Data/GUIdesc.bif
       Data/GUIfont.bif Data/GUIicon.bif Data/GUImos.bif Data/AR2100.bif
       Data/STOfiles.bif Data/SPLbam.bif Data/BCSeh.bif Data/BCSkp.bif
       Data/SNDgen.bif Data/AR1000.bif Data/SPLfile.bif Data/CHRanim.bif
       Data/ITMbam.bif Data/ITMinv.bif Data/GUImisc.bif Data/BAMmisc.bif
       Data/BCSku.bif Data/BCSvs.bif Data/BCScv.bif Data/SNDcreat.bif
       Data/MVEfileL.bif Data/SNDspell.bif`,
    ].flatMap(group => group.trim().split(/\s+/)).map(name => ({
      url: icewindDaleDemoRoot + name,
      vfsPath: 'c:\\' + name.replace(/\//g, '\\'),
    }))).concat(icewindDaleDemoVoiceFiles, icewindDaleDemoOverrideFiles,
      icewindDaleDemoCdFiles,
      icewindDaleDemoFullFiles);

    // Payload produced by the original Half-Life Uplink InstallShield setup.
    // The launcher opens everything relative to C:\ and loads its renderer and
    // game DLLs by name after boot, so keep the installed layout intact.
    const halfLifeUplinkRoot = localDemoInstallerRoot +
      'half-life-uplink-installer/installed/';
    const halfLifeUplinkDlls = [
      'hw.dll', 'sw.dll', 'hl_res.dll', 'a3dapi.dll',
      'valve/dlls/hl.dll', 'valve/cl_dlls/client.dll',
    ].map(name => halfLifeUplinkRoot + name);
    const halfLifeUplinkFiles = [
      `hldemo.dat logo.bmp readme.txt valve.ico
       media/intro.avi media/uplink.avi
       media/launch_deny1.wav media/launch_deny2.wav
       media/launch_dnmenu1.wav media/launch_glow1.wav
       media/launch_select1.wav media/launch_select2.wav media/launch_upmenu1.wav`,
      `valve/pak0.pak valve/cached.wad valve/decals.wad valve/gfx.wad
       valve/dlls/hl.dll valve/cl_dlls/client.dll
       valve/credits.txt valve/default.cfg valve/language.cfg valve/liblist.gam
       valve/settings.scr valve/skill.cfg valve/titles.txt valve/valve.rc`,
      `media/order/default.html media/order/default.ico
       media/order/images/arrow.gif media/order/images/box.gif
       media/order/images/box_small.gif media/order/images/bridge.gif
       media/order/images/cgw.gif media/order/images/creature.jpg
       media/order/images/e3award.jpg media/order/images/experience.gif
       media/order/images/gordon.gif media/order/images/gordon_tall.gif
       media/order/images/gordonclose.gif media/order/images/goty.gif
       media/order/images/grayblur.jpg media/order/images/grayblur2.jpg
       media/order/images/halflife.gif media/order/images/hgrunts.jpg
       media/order/images/multiplayer.jpg media/order/images/orangeblur.jpg
       media/order/images/orangeblur2.jpg media/order/images/orangeblurdark.jpg
       media/order/images/redblur.jpg media/order/images/screen1.jpg
       media/order/images/screenstrip.jpg media/order/images/sniper.gif
       media/order/images/solds.gif media/order/images/stars.gif
       media/order/images/surface.jpg media/order/images/usa_today.gif
       media/order/images/weapon.jpg media/order/images/worldcraft.jpg
       media/order/images/xen.jpg`,
    ].flatMap(group => group.trim().split(/\s+/)).map(name => ({
      url: halfLifeUplinkRoot + name,
      vfsPath: 'c:\\' + name.toLowerCase().replace(/\//g, '\\'),
    })).concat([{
      // valve.rc comments out its default.cfg line but always executes
      // autoexec.cfg. The extracted first-run payload has no autoexec, so
      // seed it with the installer's complete keyboard defaults.
      url: halfLifeUplinkRoot + 'valve/default.cfg',
      vfsPath: 'c:\\valve\\autoexec.cfg',
    }]);

    // Quake II's official self-extractor is also a ZIP, so local setup can
    // expose the actual software-rendered game instead of its blocked stub.
    const warcraft3DemoRoot = localDemoInstallerRoot + 'warcraft3-demo/';
    const warcraft3DemoFiles = [
      { url: warcraft3DemoRoot + 'war3.mpq', vfsPath: 'c:\\war3.mpq' },
      { url: warcraft3DemoRoot + 'Maps/(4)Deadlock.w3m',
        vfsPath: 'c:\\Maps\\(4)Deadlock.w3m' },
    ].concat([
      'Mssfast.m3d', 'Mssdolby.m3d', 'Msseax2.m3d', 'Mp3dec.asi', 'Reverb3.flt',
    ].map(name => ({ url: warcraft3DemoRoot + 'redist/miles/' + name,
      vfsPath: 'c:\\redist\\miles\\' + name })));

    const quake2DemoRoot = localDemoInstallerRoot +
      'quake-2-demo-installer/installed-extracted/Install/Data/';
    const quake2GameDll = quake2DemoRoot + 'baseq2/gamex86.dll';
    const quake2RefSoft = quake2DemoRoot + 'ref_soft.dll';
    const quake2RefGl = quake2DemoRoot + 'ref_gl.dll';
    const quake2DemoFiles = [
      {
        url: quake2GameDll,
        vfsPaths: ['c:\\baseq2\\gamex86.dll', 'c:\\gamex86.dll'],
      },
      { url: quake2DemoRoot + 'baseq2/pak0.pak', vfsPath: 'c:\\baseq2\\pak0.pak' },
      { url: 'lib/quake2-modern-controls.ini', vfsPath: 'c:\\baseq2\\config.cfg' },
      // Published, so these two go wherever the game goes: id's demo license
      // requires the first to accompany it (§3), and the second says where
      // the files came from -- id's own installer, with its hashes.
      { url: quake2DemoRoot + 'DOCS/license.txt', vfsPath: 'c:\\docs\\license.txt' },
      { url: 'lib/quake2-demo-source.txt', vfsPath: 'c:\\docs\\source.txt' },
      quake2RefSoft,
      quake2RefGl,
      // The player models ship loose beside the pak, not inside it. Without
      // them every OTHER player in a deathmatch is ref_gl's null model -- a
      // shaded diamond -- while gibs (models/objects/, in the pak) look fine,
      // and Player Setup has no model or skin to show.
      ...[
        ['male', ['cipher', 'claymore', 'flak', 'grunt', 'howitzer', 'major',
          'nightops', 'pointman', 'psycho', 'rampage', 'razor', 'recon', 'scout',
          'sniper', 'viper']],
        ['female', ['athena', 'brianna', 'cobalt', 'doomgal', 'ensign', 'jezebel',
          'jungle', 'lotus', 'stiletto', 'venus', 'voodoo']],
      ].flatMap(([model, skins]) => [
        'tris.md2', 'weapon.md2', 'weapon.pcx',
        ...(model === 'male' ? ['skin.pcx'] : []),
        ...skins.flatMap(skin => [skin + '.pcx', skin + '_i.pcx']),
      ].map(name => ({
        url: quake2DemoRoot + 'baseq2/players/' + model + '/' + name,
        vfsPath: 'c:\\baseq2\\players\\' + model + '\\' + name,
      }))),
    ];

    // The Heroes III InstallShield cabinet can likewise be unpacked without
    // running setup. This demo builds two malformed initial resource paths
    // when no installed AppPath exists, so alias its LODs at those paths too.
    const heroes3DemoRoot = localDemoInstallerRoot +
      'heroes-3-demo-installer/installed-extracted/Program_Files/';
    const heroes3DemoFiles = [
      'BINKW32.DLL', 'MP3DEC.ASI', 'MSS32.DLL', 'SMACKW32.DLL',
    ].map(name => heroes3DemoRoot + name).concat([
      {
        url: heroes3DemoRoot + 'Data/H3BITMAP.LOD',
        vfsPaths: ['c:\\data\\h3bitmap.lod', 'c:\\datah3bitmap.lod'],
      },
      {
        url: heroes3DemoRoot + 'Data/H3SPRITE.LOD',
        vfsPaths: ['c:\\data\\h3sprite.lod', 'c:\\datah3sprite.lod'],
      },
      { url: heroes3DemoRoot + 'Data/HEROES3.SND', vfsPath: 'c:\\data\\heroes3.snd' },
      { url: heroes3DemoRoot + 'Data/VIDEO.VID', vfsPath: 'c:\\data\\video.vid' },
      { url: heroes3DemoRoot + 'Maps/H3demo.h3m', vfsPath: 'c:\\maps\\h3demo.h3m' },
      ...[
        'StrongHold.mp3', 'Surrender Battle.mp3', 'WATER.MP3',
        'Win Scenario.mp3', 'Retreat Battle.mp3', 'UltimateLose.mp3',
        'LoseCombat.mp3', 'Defend Castle.mp3', 'Win Battle.mp3',
        'LoseCastle.mp3', 'MAINMENU.MP3', 'DIRT.MP3', 'COMBAT01.MP3',
        'AITHEME0.MP3',
      ].map(name => ({
        url: heroes3DemoRoot + 'MP3/' + name,
        vfsPath: 'c:\\mp3\\' + name,
      })),
    ]);

    // The outer Heroes III package can only hand off to Setup.exe via a new
    // process, which Wine Assembly intentionally does not spawn. Setup.exe in
    // turn unpacks this real InstallShield engine. Keep that deterministic
    // second-stage engine beside the original Disk1 payload so selecting the
    // installer reaches the same Welcome wizard without crossing either
    // single-process boundary.
    const heroes3InstallerRoot = localDemoInstallerRoot +
      'heroes-3-demo-installer/';
    const heroes3InstallerEngineRoot = heroes3InstallerRoot +
      'installer-engine/';
    const heroes3InstallerDiskRoot = heroes3InstallerRoot +
      'installer-files/Disk1/';
    const heroes3InstallerFiles = [
      '_INST32I.EX_', 'Setup.exe', 'lang.dat', 'DATA.TAG', '_sys1.hdr',
      'setup.ins', '_user1.hdr', 'SETUP.INI', 'setup.lid', 'data1.cab',
      '_Setup.dll', '_sys1.cab', '_ISDel.exe', '_user1.cab', 'data1.hdr',
      'layout.bin', 'os.dat',
    ].map(name => ({
      url: heroes3InstallerDiskRoot + name,
      vfsPath: 'c:\\' + name,
    })).concat([
      heroes3InstallerEngineRoot + 'zdatai51.dll',
      heroes3InstallerEngineRoot + '_wutl951.dll',
    ]);

    // Payload produced by Blizzard's original Diablo II Shareware setup. The
    // EXE dynamically loads the renderer/game DLL graph by basename, while the
    // MPQs and locale file are opened from the working directory. Preload the
    // selected DirectDraw graph; leave the mutually exclusive D3D/GDI/Glide
    // renderers as ordinary files so they consume a module slot only if the
    // game actually selects one of them (as on Win98).
    const diablo2DemoRoot = localDemoInstallerRoot +
      'diablo-2-demo-installer/installed-extracted/';
    const diablo2DemoDlls = [
      'd2cmp.dll', 'd2lang.dll', 'd2net.dll', 'd2sound.dll', 'd2win.dll',
      'd2gfx.dll', 'd2ddraw.dll',
      'binkw32.dll', 'smackw32.dll', 'ijl11.dll', 'storm.dll', 'fog.dll',
    ].map(name => diablo2DemoRoot + name);
    const diablo2DemoFiles = [
      'd2.lng', 'd2direct3d.dll', 'd2gdi.dll', 'd2glide.dll',
      'd2char.mpq', 'd2data.mpq', 'd2music.mpq', 'd2sfx.mpq',
      'd2speech.mpq', 'patch_d2.mpq', 'd2readme.htm', 'license.txt',
    ].map(name => diablo2DemoRoot + name);

    // Payload copied by the authentic GTA2 InstallShield wizard. Its license
    // permits playing the demo but does not grant site redistribution, so the
    // complete tree remains an ignored localhost-only fixture.
    const gta2DemoRoot = localDemoInstallerRoot +
      'gta2-demo/installed/Program_Executable_Files/';
    const gta2DemoTree = `
      3dfx.dll D3DPoly.dll DMAGlide.dll Dmavideo.dll Polygon.dll d3ddll.dll
      data/Audio/FSTYLE.RAW data/Audio/FSTYLE.SDT data/Audio/bil.lst
      data/Audio/bil.raw data/Audio/bil.sdt data/Audio/dmaudio.dma
      data/Audio/fstyle.lst data/Keyboard/ENG_KB.cfg data/Keyboard/FRE_KB.cfg
      data/Keyboard/GER_KB.cfg data/Keyboard/ITA_KB.cfg
      data/Keyboard/POR_KB.cfg data/Keyboard/SPA_KB.cfg data/bob_e.gxt
      data/e.gxt data/frontend/1.tga data/frontend/1_Options.tga
      data/frontend/1_Play.tga data/frontend/1_Quit.tga data/frontend/2.tga
      data/frontend/2_Bonus1.tga data/frontend/2_Bonus2.tga
      data/frontend/2_Bonus3.tga data/frontend/2_League.tga
      data/frontend/2_Level1.tga data/frontend/2_Level2.tga
      data/frontend/2_Level3.tga data/frontend/2_Name.tga
      data/frontend/2_Restart.tga data/frontend/3.tga
      data/frontend/3_Tables.tga data/frontend/Credits.tga
      data/frontend/DemoInfo.tga data/frontend/GameComplete.tga
      data/frontend/LevelComplete.tga data/frontend/MPLose.tga
      data/frontend/Mask.tga data/frontend/Mask2.tga data/frontend/Mask3.tga
      data/frontend/PlayerDead.tga data/fstyle.sty data/nyc.gci
      data/test1.seq data/wil.sty data/wildemo.SCR data/wildemo.gmp
      data/wildemo/wil_le1.SCR data/wildemo/wil_le2.SCR
      data/wildemo/wil_ye1.SCR data/wildemo/wil_ye2.SCR
      data/wildemo/wil_ze1.SCR data/wildemo/wil_ze2.SCR gta2_manager.exe
      player/hiscores.hsc player/plyslot0.dat player/plyslot1.dat
      player/plyslot2.dat player/plyslot3.dat player/plyslot4.dat
      player/plyslot5.dat player/plyslot6.dat player/plyslot7.dat readme.txt
    `.trim().split(/\s+/).map(name => ({
      url: gta2DemoRoot + name.replace('gta2_manager.exe', 'gta2 manager.exe'),
      vfsPath: 'c:\\' + name.replace('gta2_manager.exe', 'gta2 manager.exe')
        .replace(/\//g, '\\'),
    }));
    const gta2Mss32 = gta2DemoRoot + 'mss32.dll';

    // Official Diablo pre-release demo. DIABDEMO.EXE and STORM.DLL are the
    // payload extracted by Blizzard's self-extracting DIABLO.EXE. Storm then
    // reopens that original package as Z:\DIABLO.EXE to read the demo's MPQ
    // data, matching the layout used by the focused CLI compatibility run.
    const diabloCandidateRoot = 'test/binaries/candidates/diablo/';
    const diabloArchive = diabloCandidateRoot + 'DIABLO.EXE';

    // Retail-era Diablo Shareware installed by the CD's original AUTORUN.EXE
    // inside Wine Assembly. Keep this separate from BLIZDEMO.EXE on the same
    // disc: that executable is Blizzard's promotional reel, not the game.
    const diabloSharewareRoot =
      'test/binaries/candidates/diablo-shareware/installed/';

    // Payload from Blizzard's official StarCraft demo distribution. Keep its
    // original installer mounted as the CD container the game can reopen.
    const starcraftInstalledRoot =
      'test/binaries/candidates/starcraft-demo-official/installed/';
    const starcraftInstaller =
      'test/binaries/candidates/starcraft-demo-official/SCDemo.exe';
    const starcraftInstallDir = 'c:\\program files\\starcraft shareware\\';
    const starcraftFile = name => ({
      url: starcraftInstalledRoot + name,
      // The native-install compatibility run mounted its working files at the
      // drive root. Also expose their real installed locations so registry-
      // derived paths and relative opens both resolve without copying bytes.
      vfsPaths: ['c:\\' + name, starcraftInstallDir + name],
    });

    // The official Fallout demo distribution is already its installed form:
    // its readme directs users to unzip it with directory names preserved.
    const falloutDemoRoot = 'test/binaries/candidates/fallout-demo/falldemo/';

    // Payload installed by the original October 1997 Worms 2 demo setup.
    // WORMS2DEMO.EXE is only a promotional screen carousel which eventually
    // calls CreateProcessA("worms2.dat"). The latter is the untouched native
    // game PE, so launch it directly in the browser's one-process sandbox.
    const worms2DemoRoot =
      'test/binaries/candidates/worms-2-demo/installed-10oct/';
    const worms2EffectNames = `
      airstrike bananaimpact baseballbatimpact baseballbatrelease blowtorch
      communicator cowmoo crateimpact crossimpact crowdpart1 crowdpart2
      cursorselect dragonballimpact dragonballrelease drill drillimpact
      explosion1 explosion2 explosion3 firepunchimpact fuse girderimpact
      grenadeimpact handgunfire holydonkey holygrenade kamikazerelease keyclick
      keyerase magicbullet minearm minedud mineimpact minetick minigunfire
      ninjaropefire ninjaropeimpact nukeanthem nukepart1 nukepart2 oldwoman
      pausetick petrol ricochet rocketpowerup rocketrelease salvationarmy
      sheepbaa shotgunfire shotgunreload sizzle snotplop splash splish
      suddendeath teambounce teamdrop teleport throwpowerup throwrelease
      timertick twang1 twang2 twang3 twang4 twang5 twang6 uzifire warningbeep
      weaponhoming wormburned wormdiepart1 wormdiepart2 wormdiepart3
      wormdiepart4 wormdiepart5 wormimpact wormpop wormselect wormspring
      wormwalk1 wormwalk2
    `.trim().split(/\s+/);
    const worms2SpeechNames = `
      amazing boring brilliant bummer bungee byebye collect comeonthen coward
      dragonpunch drop excellent fatality fire fireball firstblood flawless
      goaway grenade hello hmm hurry illgetyou incoming jump1 jump2 justyouwait
      kamikaze laugh leavemealone missed nooo ohdear oinutter ooff1 ooff2
      ooff3 oops orders ouch ow1 ow2 ow3 perfect revenge runaway stupid surf
      takecover traitor uh-oh victory watchthis whatthe whoops wobble yessir
      youllregretthat
    `.trim().split(/\s+/);
    const worms2DemoFiles = [
      'controls.txt', 'guide.txt', 'readme.txt',
      'data/gfx/gfx.dir', 'data/land.dat',
      'data/level/medieval/level.dir',
      'data/water/blue/colour.txt', 'data/water/blue/water.dir',
      ...worms2EffectNames.map(name => `data/wav/effects/${name}.wav`),
      ...worms2SpeechNames.map(name => `data/wav/speech/${name}.wav`),
    ].map(name => ({
      url: worms2DemoRoot + name,
      vfsPath: 'c:\\' + name.toLowerCase().replace(/\//g, '\\'),
    }));

    // The official Heroes II demo is a ready-to-run archive. Preserve its
    // directory layout: the game opens the aggregate and scenario through
    // C:\\DATA and C:\\MAPS after switching its working directory to C:\\.
    const heroes2DemoRoot = 'test/binaries/candidates/heroes-2-demo/files/';
    const heroes2DemoFiles = [
      'MSS32.DLL', 'SMACKW32.DLL',
      'DATA/CAMPAIGN.HS', 'DATA/H2OFFER.SMK', 'DATA/HEROES2.AGG',
      'DATA/STANDARD.HS', 'GAMES/TUTORIAL.GM1',
      'HELP/HEROES2.CNT', 'HELP/HEROES2.HLP', 'MAPS/BROKENA.MP2',
      'FILE_ID.DIZ', 'README.TXT', 'license.txt',
    ].map(name => ({
      url: heroes2DemoRoot + name,
      vfsPath: 'c:\\' + name.toLowerCase().replace(/\//g, '\\'),
      httpRange: name === 'DATA/HEROES2.AGG',
    }));

    // Payload produced by the original Total Annihilation demo self-extractor.
    // Use the validated nested copy: installed/TADemo.exe is the known all-zero
    // extraction artifact, while this executable and HPI match the native
    // installer's ADD resources and run together from the drive root.
    const totalAnnihilationDemoRoot =
      'test/binaries/candidates/total-annihilation-demo/installed-fixed/cavedog/totala/demo/';

    // Payload produced by the Caesar III demo's original ZipMagic wrapper,
    // Win16 bootstrap, and native InstallShield engine. Keep the game files at
    // C:\ because this build changes its current directory there and opens all
    // of its installed assets by relative name.
    const caesar3DemoRoot =
      'test/binaries/candidates/caesar-3-demo/installed/';
    const caesar3DemoCoreNames = [
      'bigpeople.555', 'Briefing1a.555', 'C3_mm.eng', 'c3_model.txt',
      'C3.555', 'c3.emp', 'c3.eng', 'c3.inf', 'c3.sg2', 'c3map.inf',
      'C3title.555', 'Caesar3.ini', 'carthage.555', 'carthage.sg2',
      'Demo1.555', 'Demo2.555', 'Demo3.555', 'language.inf',
      'Map_panels.555', 'mission1.pak', 'panelwindows.555',
      'Picture0.555', 'Picture1.555', 'Picture2.555', 'Picture3.555',
      'Picture4.555', 'Picture5.555', 'rclick wavs.txt', 'Readme.doc',
      'readme.txt', 'scoreb.555', 'Senate.555', 'Sierra.inf', 'status.txt',
      'The_empire.555', 'title.555',
    ];
    const caesar3DemoWavNames = `
      academy ampitheatre barber Baths Build1 burning_ruin char_pit clay
      Colloseum dock1 dock2 empty_land explo1 fanfare fanfare2 fort1 forum
      Fountain1 Fountain2 furniture_workshop gardens1 gardens2 gardens3
      gardens4 glad_pit glad_pit2 Granary granary1 granary2 Hippodrome hospital
      house_mid1 house_mid2 house_mid3 house_poor1 house_poor2 house_poor3
      house_poor4 house_slum1 house_slum2 house_slum3 house_slum4 Icon1 library
      lion_pit market1 market2 market3 market4 meat_farm mine Oracle PANEL1
      PANEL2 panel3 Park Plebs pottery_workshop Pupils_starv2 Resevoir
      Rioter_exact1 Rioter_exact2 Rioter_exact3 rome1 School Setup shipyard1
      shipyard2 Theatre timber warehouse1 warehouse2 weapons_workshop wharf1
      wheat wine_workshop
    `.trim().split(/\s+/).map(name => `Wavs/${name}.wav`);
    const caesar3DemoFiles = [
      ...caesar3DemoCoreNames,
      ...caesar3DemoWavNames,
    ].map(name => ({
      url: caesar3DemoRoot + name,
      vfsPath: 'c:\\' + name.toLowerCase().replace(/\//g, '\\'),
    }));

    // Liquid War 5.6.2. The client and the server are separate programs from
    // the same tree and share its assets: lw.dat holds the sprites and the
    // built-in maps, custom/ holds the user maps and textures the menus offer.
    const liquidWarRoot = 'test/binaries/candidates/liquid-war/LW5/';
    const liquidWarFiles = [
      'data/lw.dat',
      'custom/map/meditate.bmp', 'custom/map/pacman.bmp',
      'custom/map/paille.bmp', 'custom/map/t4.bmp',
      'custom/texture/bluesq.bmp', 'custom/texture/clovers.bmp',
      'custom/texture/meditate.bmp', 'custom/texture/rust.bmp',
      'custom/texture/warning.bmp',
      'custom/music/colossus.mid',
      // Mount each one where the game looks for it. A bare string mounts at
      // c:\<basename>, and Liquid War opens "data\lw.dat" by that relative
      // path from c:\ — so the datafile with every sprite in it was simply
      // not there. Allegro's failure to load it is silent: the window thread
      // parks in its own loop and the main thread sits in
      // WaitForSingleObject on that thread's handle forever, which is what
      // "no window in the browser" was. The custom/ trees are enumerated with
      // FindFirstFile("custom\map\*.*"), so they need their directories too.
    ].map(name => ({ url: liquidWarRoot + name, vfsPath: name.replace(/\//g, '\\') }));

    // Far's trial license permits redistributing only its complete, unmodified
    // package. The ignored corpus fixture supplies the executable and the four
    // language/help companions it opens beside itself; do not materialize a
    // separately extracted icon in the tracked web assets.
    const farManager170Root =
      'test/binaries/candidates/far-manager-170/FarManager170/';
    const farManager170Files = [
      'FarEng.hlf', 'FarEng.lng', 'FarRus.hlf', 'FarRus.lng',
    ].map(name => farManager170Root + name);

    // Prepared locally from the intact, hash-pinned WinRAR SFX. Its license
    // allows distributing only the original installer, so the installed tree
    // and its runtime-extracted desktop icon both remain ignored.
    const winrar310Root = 'test/binaries/candidates/winrar-310/installed/';
    const winrar310Files = [
      'Default.SFX', 'Descript.ion', 'Dos.SFX', 'File_Id.diz',
      'License.txt', 'Order.txt', 'Rar.exe', 'Rar.txt', 'RarExt.dll',
      'RarFiles.lst', 'Rar_Site.txt', 'ReadMe.txt', 'Register.txt',
      'TechNote.txt', 'UnRAR.exe', 'Uninstall.exe', 'Uninstall.lst',
      'UnrarSrc.txt', 'WhatsNew.txt', 'WinCon.SFX', 'WinRAR.cnt',
      'WinRAR.hlp', 'Zip.SFX',
      'Formats/UNACEV2.DLL', 'Formats/ace.fmt', 'Formats/arj.fmt',
      'Formats/bz2.fmt', 'Formats/cab.fmt', 'Formats/gz.fmt',
      'Formats/iso.fmt', 'Formats/lzh.fmt', 'Formats/tar.fmt',
      'Formats/uue.fmt',
    ].map(name => ({
      url: winrar310Root + name,
      vfsPath: name.replace(/\//g, '\\'),
    }));

    // A guest reaches its help file only through the VFS, and the CLI harness
    // has a fallback that silently resolves any name against binaries/help.
    // The browser has no such fallback, so each app must mount its own .hlp
    // (and .cnt, which drives the Help Topics contents tree).
    const helpFiles = name => [`binaries/help/${name}.hlp`, `binaries/help/${name}.cnt`];
    const screenSaverFiles = names => names.map(name => `binaries/screensavers/${name}`);
    const plus98ThemeFrames = (prefix, count, theme) => Array.from({ length: count }, (_, index) => {
      const filename = `${prefix}${String(index + 1).padStart(2, '0')}.JPG`;
      return {
        url: `binaries/screensavers/${filename}`,
        decodeImage: true,
        vfsPaths: [
          `c:\\${filename}`,
          `c:\\program files\\plus!\\themes\\${theme}\\${filename}`,
        ],
      };
    });
    const organicArtSceneFiles = screenSaverFiles([
      'CA_2001.SCN', 'CA_ATOMI.SCN', 'CA_BIOTA.SCN', 'CA_CAVPO.SCN',
      'CA_CHRLA.SCN', 'CA_CHROM.SCN', 'CA_DEMIT.SCN', 'CA_DIAGR.SCN',
      'CA_DRAGO.SCN', 'CA_ENCOM.SCN', 'CA_GOLDS.SCN', 'CA_GREEN.SCN',
      'CA_K-TAL.SCN', 'CA_K-TW3.SCN', 'CA_LIGHT.SCN', 'CA_LOVBU.SCN',
      'CA_PEBBL.SCN', 'CA_RINGT.SCN', 'CA_SCULP.SCN', 'CA_SINGL.SCN',
      'CA_SKYDA.SCN', 'CA_SKYLA.SCN', 'CA_SQUGG.SCN', 'CA_STAIN.SCN',
      'CA_T-O-A.SCN',
      '2001.X', 'ALIEN.X', 'BOLD6.GIF', 'BONE.GIF', 'BWROOM.GIF',
      'CAT01.GIF', 'CLAW.X', 'CLOUDS.GIF', 'COMPASS.X', 'COMPLEX.X',
      'COMTOR.X', 'CRAFT.X', 'CREATURE.GIF', 'FLARE.GIF', 'GAGWHIYE.GIF',
      'GRAD02.GIF', 'GRAD05.GIF', 'GRAD06.GIF', 'GRAD11.GIF',
      'GRADBACK.GIF', 'GRADBLU2.GIF', 'GRADMELN.GIF', 'GRAD_K2.GIF',
      'GRANITE.GIF', 'GRAPPLE.X', 'GRDDKPRP.GIF', 'GRDINTAN.GIF',
      'GRDMELON.GIF', 'GRDYLRED.GIF', 'GROTTO02.GIF', 'IO-HALF.X',
      'JESTER.X', 'JESTER76.X', 'LAND4.X', 'LIMEFLW.GIF', 'LSPH16.X',
      'LSPH8.X', 'MESS.X', 'OCTAHEDR.X', 'ORANLEAF.GIF', 'P6DIE.GIF',
      'PEBBLE.X', 'PINCER.X', 'PODULE.X', 'RMSUNBG.GIF', 'RMSUNSET.GIF',
      'SKY.GIF', 'SPHERE0.X', 'SPOT_BR.GIF', 'SPOT_YBL.GIF', 'SQUIRL.X',
      'STARSCAP.GIF', 'STELLA.X', 'TORBALL.X', 'TWISTPUR.GIF',
      'VOPCONTI.GIF', 'VOPSTAIN.GIF', 'WINGS.X', 'YELOFTHR.GIF',
    ]);

    const mw3DatabaseFiles = [
      'zbd/interp.zbd', 'zbd/mechlib.zbd', 'zbd/motion.zbd',
      'zbd/reader.zbd', 'zbd/rimage.zbd', 'zbd/rlab.zbd',
      'zbd/rmechtex.zbd', 'zbd/rmechtex16.zbd', 'zbd/rmechtexs.zbd',
      'zbd/soundsM.zbd', 'zbd/c4/anim.zbd', 'zbd/c4/gamez.zbd',
      'zbd/c4/reader.zbd', 'zbd/c4/readeria1.zbd', 'zbd/c4/readeria2.zbd',
      'zbd/c4/readeria3.zbd', 'zbd/c4/readerm1.zbd', 'zbd/c4/readerm2.zbd',
      'zbd/c4/readerm3.zbd', 'zbd/c4/readerm4.zbd', 'zbd/c4/readermp1.zbd',
      'zbd/c4/rtexture.zbd', 'zbd/c4/rtexture2.zbd', 'zbd/c4/rtexture3.zbd',
      'zbd/c4/texture.zbd', 'zbd/c4/texture1.zbd', 'zbd/c4/texture2.zbd',
    ].map(rel => ({
      url: `binaries/shareware/mw3/ex/Database_Files/${rel}`,
      vfsPath: `c:\\${rel.replace(/\//g, '\\')}`,
    }));

    // Motocross Madness trial opens its media both relative to the working
    // directory (ui\cursor.tga, ui\profile\*.*) and below the registry's
    // HardDriveRootPath (see lib/storage.js). A real install has the cwd and
    // that root in one Program Files directory, so all media mounts there and
    // the entry names it as workingDirectory. It must not be C:\: the scene
    // list also probes the CD root, which is "" when no CD is present, so
    // \teraform\quarries\Quarry01.scn resolves against C:\ and a second hit
    // there makes MCM's duplicate filter drop its sole quarry. Keep the
    // hierarchy: rider/bike art and terrain are opened below SBIKE, UI and
    // TERAFORM, and the scene list is teraform\<category>\*.scn.
    const mcmInstallRoot =
      'c:\\program files\\microsoft games\\motocross madness trial\\';
    const mcmFiles = [
      ['', 'DRIVERDB.BIN DSETUP.DLL DSETUP16.DLL DSETUP32.DLL EULA.TXT IMPACT.TTF KVDD.DLL LANG.DLL README.TXT SETUP.EXE SETUPENU.DLL'],
      ['AUDIO/', 'BIKE.WAV DECEL.WAV FALL01.WAV FALL02.WAV FALL03.WAV FALL04.WAV FALL05.WAV FALL06.WAV IDLE.WAV LAND01.WAV LAUNCH.WAV WRECK01.WAV WRECK02.WAV WRECK03.WAV WRECK04.WAV WRECK05.WAV WRECK06.WAV'],
      ['GEOMETRY/', '0.SLT 1.SLT 2.SLT 3.SLT 4.SLT 5.SLT 6.SLT 7.SLT 8.SLT 9.SLT FINISH01.SLT FIVE.SLT FOUR.SLT ONE.SLT PODIUM.SLT POINTER.SLT THREE.SLT TWO.SLT VISCUE.SLT X.SLT YOUIND.SLT'],
      ['GOODIES/DRIVERS/', '3DMFG.HTM ALTTAB.HTM ATIR.HTM ATIR2.HTM ATIR2U.HTM ATIRP.HTM ATIRPCI.HTM ATIX.HTM CLAB1.HTM CLAB2.HTM DANGER.HTM DIAS.HTM DIAS1.HTM DIAS2.HTM DIAS3.HTM DIAV.HTM FOG.HTM GOMENU.HTM HERC.HTM IDENTIFY.HTM MATRX2.HTM MATRX3.HTM MATRXG.HTM MATRXM.HTM NOT.HTM NVIDIA.HTM NVIDMFG.HTM ORCHID.HTM PARTICLE.HTM PERM2.HTM POWERVR.HTM REAL.HTM S3VIR.HTM SCRIPT.HTM SHADOWS.HTM STBG.HTM STBN.HTM'],
      ['GOODIES/DRIVERS/REG/', 'FOG1.REG FOG2.REG ISPOWER.REG ISPWROFF.REG SORRY.HTM'],
      ['HELP/', 'DRIVERS.HTM HELP.HTM'],
      ['HELP/CONTENTS/GRAPHICS/', 'BULL014.GIF BUTTN019.GIF GAMEPAD.GIF JOYSTK.GIF MOUSE.GIF MUDTILE.GIF STUNTS18.GIF STUNTS96.GIF TRACK2.GIF'],
      ['MAPS/', 'LENS.CMP LENS.TEX OBJECTS.CMP OBJECTS.TEX OVERLAY.CMP OVERLAY.TEX PARTICLE.CMP PARTICLE.TEX UIFX.CMP UIFX.TEX'],
      ['SBIKE/', 'BACKOVER.VUB BARHOP.VUB BARKNL.VUB BBARHOP.VUB BBARKNL.VUB BBIGKHUN.VUB BCROSS01.VUB BCROSS02.VUB BCROSS03.VUB BDBCNCN.VUB BFENDBND.VUB BFISHWRP.VUB BHANDSHK.VUB BHEELCLK.VUB BIGKDUMP.VUB BIGKHUN.VUB BIKE.MCF BIKE.SLT BIKE.VUT BLOOKBCK.VUB BLUBKRID.CMP BLUBKRID.TEX BNACNAC.VUB BSARNWRP.VUB BSCHIMPF.VUB BSPLITS.VUB BSUPRMAN.VUB BTAILSTD.VUB BTWIST.VUB BXSPLITS.VUB CROSS01.VUB CROSS02.VUB CROSS03.VUB DBCNCN.VUB ENDOVER.VUB FALL01.VUB FALL02.VUB FALL03.VUB FEETHIT.VUB FEETHITL.VUB FENDBND.VUB FISHWRP.VUB GRNBKRID.CMP GRNBKRID.TEX HANDSHK.VUB HBARS45.VUB HEADHIT.VUB HEADHITL.VUB HEELCLK.VUB KAHUNDMP.VUB LAND1.FRC LAND2.FRC LAND3.FRC LEANR01.VUB LEANR02.VUB LEANR03.VUB LEFTHIT.VUB LEFTHITL.VUB LEFTOVER.VUB LOOKBCK.VUB NACNAC.VUB PINWHL.VUB PINWHL2.VUB PINWHL3.VUB REDBKRID.CMP REDBKRID.TEX RIDE01D.VUB RIDE01U.VUB RIDE02D.VUB RIDE02U.VUB RIDE03D.VUB RIDE03U.VUB RIDE04D.VUB RIDE04U.VUB RIDER.MCF RIDER.SLT RIDER.VUT RITEHIT.VUB RITEHITL.VUB RITEOVER.VUB SARNWRP.VUB SCHIMPF.VUB SPLITS.VUB SUPRMAN.VUB TAILSTD.VUB TWIST.VUB VICTORY.VUB WIN01.VUB WIN02.VUB WIN03.VUB WIN04.VUB WIN05.VUB WIN06.VUB WIN07.VUB WIN08.VUB WIN09.VUB WINNER.LST WINNER.MCF WINNER.VUT XSPLITS.VUB YLWBKRID.CMP YLWBKRID.TEX'],
      ['TERAFORM/NATIONAL/', 'DAY31.CUB NATION16.DAT NATION16.SCN NATION16.TGA NATION16.TRN'],
      ['TERAFORM/QUARRIES/', 'CUBE05.CUB QUARRY01.DAT QUARRY01.SCN QUARRY01.TGA QUARRY01.TRN'],
      ['UI/', '1BUTMB.DAT 3BUTEXT.DAT CONTROL.CTL COPY.TGA CURSOR.TGA DIALOG01.DAT DIALOG02.DAT DIALOG03.DAT DIALOG04.DAT DIALOG08.DAT DIALOG11.DAT DIALOG13.DAT DIALOG14.DAT DIALOG15.DAT DIALOG16.DAT DIALOG17.DAT DIALOG19.DAT DIALOG20.DAT DIALOG22.DAT DIALOG23.DAT EVENT.DAT GENERIC.DAT GLOBAL.DAT LOADING.DAT MAIN.DAT OPTIONS.DAT PRESET.CTL SCORES.DAT SINGLE.DAT TEXTMB.DAT UILST.INI USER.DAT WAIT.DAT WAIT.TGA'],
      ['UI/ART/', 'POWER01.TGA POWER02.TGA POWER03.TGA UNAV.TGA'],
      ['UI/ART/16X12/', 'BIKE_01.TGA BIKE_02.TGA BIKE_03.TGA BIKE_04.TGA BIKE_05.TGA BIKE_06.TGA BIKE_07.TGA BIKE_08.TGA BIKE_09.TGA BIKE_10.TGA BIKE_11.TGA BIKE_12.TGA POSE_01A.TGA POSE_02A.TGA POSE_03A.TGA POSE_04A.TGA POSE_05A.TGA POSE_06A.TGA POSE_07A.TGA POSE_08A.TGA POSE_09A.TGA POSE_10A.TGA POSE_11A.TGA POSE_12A.TGA'],
      ['UI/ART/24X18/', 'BIKE_01.TGA BIKE_02.TGA BIKE_03.TGA BIKE_04.TGA BIKE_05.TGA BIKE_06.TGA BIKE_07.TGA BIKE_08.TGA BIKE_09.TGA BIKE_10.TGA BIKE_11.TGA BIKE_12.TGA POSE_01A.TGA POSE_02A.TGA POSE_03A.TGA POSE_04A.TGA POSE_05A.TGA POSE_06A.TGA POSE_07A.TGA POSE_08A.TGA POSE_09A.TGA POSE_10A.TGA POSE_11A.TGA POSE_12A.TGA'],
    ].flatMap(([dir, names]) => names.split(' ').map(name => {
      return {
        url: `binaries/shareware/mcm/mcm_ex/${dir}${name}`,
        vfsPath: mcmInstallRoot + (dir + name).replace(/\//g, '\\'),
      };
    }));

    // The original Entertainment Pack volumes: 16-bit NE, four directories,
    // one <STEM>.EXE and (almost always) a <STEM>.HLP per game. The DLLs are
    // NE too and are not listed — host.js fetches whatever the exe's own
    // module-reference table names out of the exe's own directory, which is
    // how ABOUTWEP, IWLIB, WEPUTIL, WEP4UTIL and VBRUN100 arrive. What is
    // listed is only what a game opens through the filesystem: the CLI mounts
    // the whole directory and the page cannot, so a data file missing here is
    // a game that runs in one host and not the other.
    // `modules` are NE DLLs the game loads by name at runtime instead of
    // importing — the pack's WEPUTIL, Rattler Race's FIELD100, Go Figure!'s
    // Visual Basic custom controls, the level DLL Stones ships one of per
    // screen. They are in no table anywhere, so the page has to be told; find
    // a game's set with `node test/run.js --app=<id> --trace-win16`.
    const wep16 = (vol, stem, data = [], modules = [], hasHelp = true) => ({
      exe: `binaries/wep16/${vol}/${stem}.EXE`,
      files: [
        ...(hasHelp ? [`binaries/wep16/${vol}/${stem}.HLP`] : []),
        ...data.map(name => `binaries/wep16/${vol}/${name}`),
      ],
      ...(modules.length ? { win16Modules: modules } : {}),
    });
    // Volume 4's games share one sound set and pick from it by name, so each
    // of them gets all of it rather than a guess at which clips are whose.
    const wep4Sounds = [
      'ALERT.WAV', 'BELL.WAV', 'BLIP2.WAV', 'BOUNCE.WAV', 'BUMMER.WAV',
      'CLICK1.WAV', 'CLICK3.WAV', 'DITTY1.WAV', 'DOOR.WAV', 'EXPLOSON.WAV',
      'GAP.WAV', 'HIT3.WAV', 'JEZZDEAD.WAV', 'LOSEGAME.WAV', 'NEWBALL.WAV',
      'OOF3.WAV', 'POP2.WAV', 'STRIKE.WAV', 'TELEPORT.WAV', 'WATER2.WAV',
      'WINLEVEL.WAV', 'WIPE.WAV',
    ];

    // Cooperative browser scheduling is part of an app's compatibility
    // profile, alongside its DLLs, mounts and input mode. Keep the shared
    // card-game value as one immutable object so those entries cannot drift.
    const CARD_RUN_SLICE = Object.freeze({ cooperative: 25000, compat: 100 });

    // Winamp's skinned Equalizer buttons are wider than the tiny native hit
    // points its window procedure accepts. A real click anywhere in the drawn
    // button therefore needs to arrive at the button's measured centre. Keep
    // that application knowledge in the registry; renderer-input only applies
    // the generic native-coordinate mapping described here.
    const WINAMP_INPUT_HOOKS = Object.freeze({
      pointerSnap: Object.freeze([Object.freeze({
        windowTitle: 'Winamp Equalizer',
        nativeSize: Object.freeze([275, 116]),
        buttons: Object.freeze([0, 1]), // browser left / harness left
        targets: Object.freeze([
          Object.freeze({ hit: Object.freeze([10, 14, 43, 33]), point: Object.freeze([26, 24]) }),
          Object.freeze({ hit: Object.freeze([39, 14, 76, 33]), point: Object.freeze([55, 24]) }),
          Object.freeze({ hit: Object.freeze([211, 14, 269, 33]), point: Object.freeze([237, 24]) }),
        ]),
      })]),
    });

    const APPS = {
      // Original InstallShield payload plus its original loose-file overlays.
      // Locally installed media only; no public desktop or synthesized settings.
      carmageddon_tdr2000_demo: {
        exe: win98GamesADRoot + 'Carmageddon TDR2000 demo-D3D-installed/Tdr2000Demo.exe',
        dlls: [win98GamesADRoot + 'Carmageddon TDR2000 demo-D3D-installed/Mss32.dll'],
        files: [],
        localFileManifest: win98GamesADRoot + 'Carmageddon TDR2000 demo-D3D-installed/.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      notepad:  { exe: 'binaries/notepad.exe', files: helpFiles('notepad') },
      calc:     { exe: 'binaries/calc.exe', dlls: ['binaries/dlls/msvcrt.dll'], files: helpFiles('calc') },
      freecell: { exe: 'binaries/entertainment-pack/freecell.exe', dlls: ['binaries/entertainment-pack/cards.dll'], files: helpFiles('freecell'), runSlice: CARD_RUN_SLICE },
      sol:      { exe: 'binaries/entertainment-pack/sol.exe', dlls: ['binaries/entertainment-pack/cards.dll'], files: ['binaries/help/sol.hlp'], runSlice: CARD_RUN_SLICE },
      cruel:    { exe: 'binaries/entertainment-pack/cruel.exe', dlls: ['binaries/entertainment-pack/cards.dll'], runSlice: CARD_RUN_SLICE },
      golf:     { exe: 'binaries/entertainment-pack/golf.exe', dlls: ['binaries/entertainment-pack/cards.dll'], runSlice: CARD_RUN_SLICE },
      // keepAspect: Pegged scales its cross-shaped board to the client rect on
      // each axis independently, so a portrait phone turns every hole into a
      // vertical ellipse. See lib/renderer.js _singleAppMaximizeRect.
      //
      // The NUMBER is the client aspect the board wants, not the one the app
      // was born with. Pegged asks for a 240x240 OUTER window and stretches a
      // 7x7 grid into whatever client that leaves, so its own default client
      // (241x203 here, 232x195 on real Win98) already makes every hole a 1.25
      // wide ellipse -- `true` would preserve that distortion on the phone.
      // Measured at 375x667 by photographing the board and taking the peg
      // grid's bounding box: 1.188 (the natural aspect) -> 285x254 CSS, holes
      // 20x16; 1.074 -> 285x264; 0.91 -> 285x310 (overshot, now tall); 0.99 ->
      // 285x290 with holes 20x19, i.e. a square board and round holes. It is
      // also the bigger picture -- the board gains 14% of its height and the
      // teal above and below drops from 43% of the screen to 38%.
      pegged:   { exe: 'binaries/entertainment-pack/pegged.exe', keepAspect: 0.99 },
      snake:    {
        exe: 'binaries/entertainment-pack/snake.exe',
        // Rattler Race steers the snake with the arrow keys and starts a level
        // on F2. Measured, not assumed: with the game running, one Left
        // keydown moves 5.5% of the window's pixels against a 0% frame-to-
        // frame baseline, and Up/Down each move the snake too. Four-way — a
        // snake has no diagonals, and an accidental two-key diagonal on an
        // eight-way pad reads as whichever arrow arrived last.
        // Same treatment as Rodent's Revenge next door, and for the same
        // reason: the part of this window worth the phone's screen is the
        // playfield, not the menu bar and score strip above it. Measured off a
        // rendered frame -- the 266x352 window's red-bordered field runs
        // x 3..262, y 81..347 -- so the crop is the field including its wall,
        // and `contain` keeps every cell on screen rather than filling the
        // phone with the middle of it. The rest of the phone belongs to the
        // controls below.
        //
        // It also settles the clipping: Rattler puts its own window at x=158,
        // which hangs 24px off the right of a 400-wide phone desktop, and the
        // single-app crop is the window union CLAMPED to the canvas, so the
        // score box used to be cut through a digit. A contain crop sizes the
        // desktop around the window's whole extent first.
        // The crop STARTS above the score strip, not at the field's red wall
        // (y 81). Portrait got the strip for free, because `contain` grows the
        // crop back up to reach the screen's aspect -- but landscape is short
        // and grows it not at all, so a field-only crop showed no score
        // whatever. Lives and score are game state in Rattler; they are worth
        // the few percent of board scale that including them costs.
        //
        // Every bound below is measured off a rendered frame, in window-local
        // pixels of the 266x352 window (a `--trace`-free capture of the guest
        // desktop for the columns, and the phone-sized browser Fit picture,
        // divided by its 1.0653 scale, for the rows where the lives are drawn):
        //
        //   x 0..2, 263..265   the 3D window border -- furniture
        //   x 3..262           the red playfield wall and everything inside it
        //   x ..259            the rightmost column the score readout touches,
        //                      so a right edge at 262 clears it by 3px
        //   y 39               the menu bar's shadow, the last row of chrome
        //   y 46..65           the life icons (their heads start at 46)
        //   y 47..66           the sunken score box
        //   y 69..76           the level bar
        //   y 81..347          the playfield including its wall
        //   y 41..347          the client rect (3px border, 41px of chrome)
        //
        // y 47 was one row too low and sliced the tops off the snake heads --
        // the report that produced this crop. 44 keeps them with two rows of
        // air and still clears the menu shadow; 348 is one past the field's
        // bottom wall, so the bottom border goes the way the side ones do.
        //
        // Fractions rather than pixels-from-the-top is safe HERE and would not
        // be everywhere: a panel of fixed pixel height reads as a smaller and
        // smaller fraction as the window grows, so a crop like this one drifts
        // into the artwork on any app that maximizes. Rattler does not -- its
        // window is 266x352 with `_maximized` false on a 640x480 desktop, on a
        // 424x494 one and on a 667x375 one, three different canvases and the
        // same rect -- so the denominator is a constant and the fractions are
        // just a different spelling of the pixels.
        mobileCrop: { x: 3 / 266, y: 44 / 352, w: 260 / 266, h: 304 / 352, contain: true },
        touchControls: {
          viewToggle: true,
          landscapeCenterControls: true,
          // Cross pad: Rattler turns the snake on a keystroke and holding an
          // arrow does not steer it any harder.
          dpad: { pos: 'bl', ways: 4, style: 'cross' },
          swipes: true,
          buttons: [
            { vk: 0x71, label: 'New game', pos: 'br' },
          ],
        },
      },
      // keepAspect: Taipei lays its 144-tile turtle out to fill the client rect
      // per axis, so a portrait client draws tall narrow tiles rather than more
      // board. Reversi, next door, is deliberately NOT flagged: it draws a
      // fixed-size board centred in whatever it is given, which is the
      // behaviour full-canvas maximize is right for.
      taipei:   { exe: 'binaries/entertainment-pack/taipei.exe', keepAspect: true },
      tictac:   { exe: 'binaries/entertainment-pack/tictac.exe', runSlice: CARD_RUN_SLICE },
      reversi:  { exe: 'binaries/entertainment-pack/reversi.exe',
        runSlice: CARD_RUN_SLICE,
        // Measured off a native 640x480 capture: the window is 320x384 at
        // 20,20 and the green baize runs x=24..335, y=62..399 on screen, so
        // window-relative the board is 4,42 312x338 and every edge of the
        // remainder is caption, menu bar or the 4px frame. Reversi does not
        // resize -- the window is that size on a 424x494 phone desktop as
        // much as on a 640x480 one -- so these denominators are constants and
        // the fractions are just a different spelling of those pixels.
        // `contain` because a board game's board must never be cut: the
        // 8x8 grid is the whole state of the game.
        mobileCrop: { x: 4 / 320, y: 42 / 384, w: 312 / 320, h: 338 / 384, contain: true },
      },
      winmine_wep: { exe: 'binaries/entertainment-pack/winmine.exe', runSlice: CARD_RUN_SLICE },
      // The original 16-bit NE builds. Their DLLs are NE too, so they do not
      // go in `dlls` (which loads 32-bit PEs) — host.js fetches them from the
      // exe's own directory once it sees the task is 16-bit.
      winmine16:  { exe: 'binaries/win98-16bit/WINMINE.EXE', runSlice: CARD_RUN_SLICE },
      freecell16: { exe: 'binaries/win98-16bit/FREECELL.EXE', runSlice: CARD_RUN_SLICE },
      sol16:      { exe: 'binaries/win98-16bit/SOL.EXE', runSlice: CARD_RUN_SLICE },
      mshearts16: {
        exe: 'binaries/win98-16bit/MSHEARTS.EXE',
        runSlice: CARD_RUN_SLICE,
        // Hearts is a NetDDE game: one player deals, the others join the
        // table. It never names a machine on the wire — the conversation is
        // opened by broadcast on the segment — so unlike Liquid War there is
        // no address for anyone to type in.
        //
        // `room: 'auto'` (lib/vlan-room.js): the dealer's DdeNameService opens
        // a room without asking anything, a player's DdeConnect is shown who
        // is dealing (src/09f-win16-ddeml.wat). The dealer is known to be
        // dealing from its own service table -- asking over the wire would
        // reach its XTYP_CONNECT callback, which seats whoever asked.
        lan: {
          exe: 'MSHEARTS.EXE',
          label: 'Hearts',
          onDemand: true,
          room: 'auto',
          hostProbe: { protocol: 'serving', dde: true },
          hint: 'One of you picks “I want to be the dealer”, the other picks '
            + '“I want to connect to another game” and types any name.',
        },
      },
      // All 29 Entertainment Pack games. The three recovered last (Rodent's
      // Revenge, Fuji Golf, and Tic Tac Drop) are pinned to Archive.org-primary
      // source hashes in docs/win16-app-sources.md. Re-measure the complete
      // 31-executable corpus with `node tools/wep32-compare.js
      // --dir=test/binaries/wep16` (WEP1/WEP2 each also contain IdleWild).
      wep16_cruel:    wep16('WEP1', 'CRUEL'),
      wep16_golf:     wep16('WEP1', 'GOLF'),
      // IdleWild's six screens are NE modules of their own, under an .IW
      // extension — deliberately not listed: see win16FileCandidates.
      wep16_idlewild: wep16('WEP1', 'IDLEWILD', [], ['WEPUTIL']),
      wep16_pegged:   wep16('WEP1', 'PEGGED'),
      wep16_tetris:   wep16('WEP1', 'TETRIS', ['TETRIS.INI', 'TETRIS.HST']),
      wep16_tic:      wep16('WEP1', 'TIC'),
      wep16_tp:       wep16('WEP1', 'TP'),
      wep16_winmine:  wep16('WEP1', 'WINMINE'),
      wep16_freecell: wep16('WEP2', 'FREECELL', [], ['WEPUTIL']),
      wep16_jigsawed: wep16('WEP2', 'JIGSAWED',
        ['BRICKS.BMP', 'FISH.BMP', 'RUG.BMP', 'TANKER.BMP', 'TREES.BMP'],
        ['WEPUTIL']),
      // The game step is the exported TIMERPROC 1:0x80c (ne-exports): the
      // flooz advances once per timer tick, inside one long fill call per
      // piece that pumps the timer itself, so no fill function marks a step.
      // 308 TIMERPROC entries in the first 160 batches (20000 blocks) after
      // the start dialog.
      wep16_pipe:     { ...wep16('WEP2', 'PIPE'),
        perf: { logicalFrame: { label: 'GAME', address: { seg: 1, off: 0x80c } } } },
      wep16_rattler:  wep16('WEP2', 'RATTLER', ['FIELD100.DLL'], ['FIELD100', 'WEPUTIL']),
      // VBRUN checks the custom-control DLL through the filesystem before it
      // asks KERNEL to load the module, so FIELD100 is both data and a module.
      // Rodent's Revenge is played entirely from the keyboard: an arrow
      // keydown/keyup pair moves the mouse one square and pushes the block in
      // front of it, F2 deals a new game and F3 pauses (docs/re-notes/
      // wep16-rodent.md, and test/test-win16-vb-gameplay.js proves the key
      // reaches the VB picture child that owns focus). Four-way, because the
      // mouse moves on the grid axes only. Pause is left off deliberately —
      // a phone screen is small and it is not needed to play.
      wep16_rodent:   { ...wep16('WEP2', 'RODENT', ['FIELD100.DLL'], ['FIELD100', 'WEPUTIL']),
        // The 276px FIELD100 board includes the one-tile outer wall. Keep
        // every cell visible; the remaining phone area belongs to controls.
        // The fixed 282x357 window has caption/menu at y=0..37, the
        // stopwatch crown beginning at y=40, and the board at y=78..356.
        // Landscape is height-limited: drop only caption/menu furniture and
        // the final ~13px outer-wall row. Keep lives and the whole stopwatch.
        mobileCrop: { x: 3 / 282, y: 78 / 357, w: 276 / 282, h: 276 / 357,
          contain: true, portraitTrimX: 12,
          fitFocusLandscape: { width: 282, top: 38, bottom: 13 } },
        touchControls: {
          viewToggle: true,
          boardLayout: true,
          landscapeLeftInset: 8,
          // A tile game, not a joystick game: one keystroke moves the mouse
          // one square, and a held direction has to keep producing them. The
          // continuous pad holds a key instead, which is exactly one step per
          // press however long you lean on it.
          dpad: { pos: 'bl', ways: 4, style: 'cross' },
          // And the board itself takes a flick, which is how anyone actually
          // plays a grid game on a phone. Under 30px it is still a tap and
          // still reaches the guest, so the menus keep working.
          swipes: true,
          buttons: [
            { vk: 0x71, label: 'New game', pos: 'br' },
          ],
        },
      },
      // Stones loads the screen it is about to play as a module.
      wep16_stones:   wep16('WEP2', 'STONES',
        ['STONE.SAV', 'STONE00.DLL', 'STONE01.DLL', 'STONE02.DLL',
         'STONE03.DLL', 'STONE04.DLL', 'STONEE00.DLL', 'STONEE01.DLL',
         'STONEE02.DLL', 'STONEE03.DLL'],
        ['WEPUTIL', 'STONE00', 'STONE01', 'STONE02', 'STONE03', 'STONE04',
         'STONEE00', 'STONEE01', 'STONEE02', 'STONEE03']),
      wep16_tutstomb: wep16('WEP2', 'TUTSTOMB', [], ['WEPUTIL']),
      wep16_fujigolf: wep16('WEP3', 'FUJIGOLF', ['FUJIGOLF.DAT']),
      wep16_klotski:  wep16('WEP3', 'KLOTSKI', ['KLOTSKI.SCO']),
      wep16_lifegen:  wep16('WEP3', 'LIFEGEN', [], ['WEPUTIL']),
      // SKI is the one game in the pack that ships without a help file.
      wep16_ski:      wep16('WEP3', 'SKI', [], [], false),
      wep16_tetravex: wep16('WEP3', 'TETRAVEX'),
      wep16_tripeaks: wep16('WEP3', 'TRIPEAKS'),
      wep16_wordzap:  wep16('WEP3', 'WORDZAP'),
      wep16_blakjak:  wep16('WEP4', 'BLAKJAK', wep4Sounds),
      wep16_chess:    wep16('WEP4', 'CHESS', ['OPENING.BK', 'OPENING.TXT', ...wep4Sounds]),
      // WinMain (2:0x627) only pumps messages; the game ticks from a message
      // handler and draws each tick through 7:0x0 (GetDC returns to 7:0x18;
      // WM_PAINT repaints go through BeginPaint at 2:0x29a6 instead). About 9
      // draws per guest second on Lesson 1 with no input.
      wep16_chips:    { ...wep16('WEP4', 'CHIPS',
        ['CHIPS.DAT', 'CHIP01.MID', 'CHIP02.MID', ...wep4Sounds]),
        perf: {
          logicalFrame: {
            label: 'GAME',
            address: { seg: 7, off: 0x0 },
            verifier: { seg: 7, off: 0x18 },
          },
        },
      },
      // Go Figure! is a Visual Basic app: its controls are .VBX modules.
      wep16_gofigure: wep16('WEP4', 'GOFIGURE',
        [...wep4Sounds, 'GAUGE.VBX', 'THREED.VBX', 'CMDIALOG.VBX'],
        ['GAUGE', 'THREED', 'CMDIALOG', 'WEP4UTIL']),
      // The step is JezzBall's timer frame function 1:0x3046 (one IsIconic,
      // GetDC, 4 BitBlt, ReleaseDC pass per frame; IsIconic returns to
      // 1:0x30a2). A Win16 step is { seg, off } in the task's own module:
      // run.js and host.js resolve it through the loader's segment table.
      // Pinned by test/test-win16-jezzball-logical-frame-gameplay.js.
      wep16_jezzball: { ...wep16('WEP4', 'JEZZBALL', wep4Sounds),
        perf: {
          logicalFrame: {
            label: 'GAME',
            address: { seg: 1, off: 0x3046 },
            verifier: { seg: 1, off: 0x30a2 },
          },
        },
      },
      wep16_maxwell:  wep16('WEP4', 'MAXWELL', wep4Sounds),
      // These VBX files are likewise opened before their NE modules load.
      wep16_tictacdp: wep16('WEP4', 'TICTACDP',
        ['TicTacDp.brd', 'CMDIALOG.VBX', 'THREED.VBX'], ['CMDIALOG', 'THREED']),
      mspaint98: { exe: 'binaries/mspaint.exe', files: helpFiles('mspaint') },
      notepad98: { exe: 'binaries/win98-apps/notepad98.exe', files: helpFiles('notepad') },
      wordpad:   {
        exe: 'binaries/win98-apps/wordpad.exe',
        files: helpFiles('wordpad'),
        // WordPad calls LoadLibrary for RichEdit during document-view setup.
        // Preload the native editor and its shaping dependency so their
        // DllMain/import initialization completes before WordPad creates the
        // RichEdit20A child, matching the CLI harness.
        dlls: ['binaries/dlls/riched20.dll', 'binaries/dlls/usp10.dll'],
      },
      write:     { exe: 'binaries/win98-apps/write.exe' },
      mplayer:  { exe: 'binaries/win98-apps/mplayer.exe' },
      mplay32:  { exe: 'binaries/win98-apps/mplay32.exe' },
      cdplayer: { exe: 'binaries/win98-apps/cdplayer.exe' },
      sndrec32_98: {
        exe: 'binaries/win98-apps/sndrec32.exe',
        audioCapture: true,
      },
      sndvol32: { exe: 'binaries/win98-apps/sndvol32.exe' },
      vol98:    { exe: 'binaries/win98-apps/vol98.exe' },
      fontview: {
        exe: 'binaries/win98-apps/fontview.exe',
        // This Win98 build previews NE-format .FON resources and uses the
        // VC++ 2.0/MFC 3.0 runtime pair. Load the CRT first because MFC30
        // imports it during DllMain initialization.
        dlls: ['binaries/dlls/msvcrt20.dll', 'binaries/dlls/mfc30.dll'],
        files: ['binaries/win98-apps/vgasys.fon'],
        requiredFiles: true,
        args: 'vgasys.fon',
      },
      kodakimg: { exe: 'binaries/win98-apps/kodakimg.exe' },
      kodakprv: { exe: 'binaries/win98-apps/kodakprv.exe' },
      hypertrm: { exe: 'binaries/win98-apps/hypertrm.exe' },
      telnet:   { exe: 'binaries/win98-apps/telnet.exe' },
      winipcfg: { exe: 'binaries/win98-apps/winipcfg.exe' },
      explorer98: {
        exe: 'binaries/explorer98/explorer.exe',
        // SHDOCVW forwards compatibility-shell entry points through ordinal
        // exports in SHDOC401. Loading the authentic pair is required for its
        // post-SHCreateThread startup check (SHDOC401 ordinal 200) to succeed.
        dlls: [
          'binaries/explorer98/dlls/browseui.dll',
          'binaries/explorer98/dlls/shdoc401.dll',
          'binaries/explorer98/dlls/ole32.dll',
          'binaries/explorer98/dlls/shlwapi.dll',
          'binaries/explorer98/dlls/shdocvw.dll',
          'binaries/explorer98/dlls/shell32.dll',
        ],
        startupRegistry: [
          // Explorer's aggregated desktop/browser object. The Win98
          // BROWSEUI.DLL binary contains this CLSID and both interfaces the
          // shell requests during startup.
          { keyPath: 'HKCR\\CLSID\\{ECD4FC4D-521C-11D0-B792-00A0C90312E1}\\InprocServer32',
            valueName: '', type: 1, data: 'C:\\WINDOWS\\SYSTEM\\BROWSEUI.DLL' },
        ],
      },
      regedit:  { exe: 'binaries/win98-apps/regedit.exe' },
      taskman:  { exe: 'binaries/win98-apps/taskman.exe' },
      // WELCOME.EXE opens welcome.dat before it does anything else and exits
      // when it is not there — it holds the tour's per-topic state. Windows
      // keeps it under the per-user Application Data tree, not next to the
      // exe, so it has to be mounted at that path.
      welcome98: {
        exe: 'binaries/win98-apps/welcome.exe',
        files: [{
          url: 'binaries/win98-apps/welcome.dat',
          vfsPath: 'c:\\windows\\application data\\microsoft\\welcome\\welcome.dat',
        }, {
          // Welcome opens this alongside welcome.dat on startup; without it the
          // OpenFile fails and the greeting plays silently.
          url: 'binaries/win98-apps/welcom98.wav',
          vfsPath: 'c:\\windows\\application data\\microsoft\\welcome\\welcom98.wav',
        }],
      },
      tour98:   { exe: 'binaries/win98-apps/tour98.exe' },
      sysmon:   { exe: 'binaries/win98-apps/sysmon.exe' },
      rsrcmtr:  { exe: 'binaries/win98-apps/rsrcmtr.exe' },
      cleanmgr: { exe: 'binaries/win98-apps/cleanmgr.exe' },
      claass:   { exe: 'binaries/xp/claass.exe' },
      xp_eos:   { exe: 'binaries/xp/xp_eos.exe' },
      mspaint_ep: {
        exe: 'binaries/entertainment-pack/mspaint.exe',
        debugPickerSection: 'other-apps',
      },
      mspaint: {
        exe: 'binaries/nt/mspaint.exe',
        dlls: ['binaries/dlls/msvcrt.dll', 'binaries/dlls/mfc42u.dll'],
        winver: 0x05650004,
        debugPickerSection: 'other-apps',
      },
      ski32: {
        exe: 'binaries/entertainment-pack/ski32.exe',
        debugPickerSection: 'other-games',
        // One game step per SetTimer tick: startup sets the interval
        // [0x40c678] to 40 ms and the TIMERPROC [0x40c940] = 0x4047c0, which
        // only calls the step 0x401000 while the game object exists. The 't'
        // key also jumps to 0x401000 (single-step), so the verifier is the
        // timer's return site 0x4047ce, which no other path reaches.
        perf: {
          logicalFrame: {
            label: 'GAME',
            address: 0x00401000,
            verifier: 0x004047ce,
          },
        },
        // SkiFree draws every sprite at one fixed pixel size — the skier is
        // 31x23 guest pixels on any desktop — so the whole phone's worth of
        // desktop buys more snow, never a bigger skier.
        //
        // LANDSCAPE ONLY, and the reason is that 31 CSS px is not one size: on
        // a 667x375 viewport it is 8.3% of the screen's height and reads tiny,
        // on a 375x667 one it is 4.3% of the height but sits on a screen with
        // room to spare and reads fine. Portrait was reported as right at 1:1
        // and a build that magnified both was reported as too big there, so
        // portrait keeps exactly its 400x711 desktop and its 29 CSS px skier.
        //
        // The landscape factor is BRACKETED by two reports, not guessed: 1.0
        // (667x375 desktop, 31 CSS px skier) came back "too small", and 1.5
        // (445x250, 46 CSS px) came back "too big". 1.25 is the midpoint of
        // that bracket — a 534x300 desktop and a 39 CSS px skier — and it is
        // also where the picture stops degrading: rendered side by side
        // (tools/zoom-compare-sheet.js) the "Tree Slalom" start sign already
        // overlaps the "F2 = Restart / F3 = Pause" hint sign at 1.5, in both
        // 667x375 and 710x375, while 1.25 keeps them apart. He starts ~31%
        // down the window whatever its height, so the look-ahead is ~207 guest
        // rows here against ~172 at 1.5 and ~259 at 1.0.
        mobileZoom: { landscape: 1.25 },
        // No dpad on purpose: SkiFree's skier follows the pointer, so a tap or
        // a drag on the canvas already steers it and a pad would only cover
        // the slope. What touch cannot reach is the keyboard-only pair — F
        // makes the skier go fast, F2 starts a new run.
        //
        // Fast is a `char`, not a bare `vk`, and that is the whole bug the
        // first version of this entry had. ski32.exe's wndproc honours exactly
        // four virtual keys on WM_KEYDOWN (RETURN 0x0d, ESCAPE 0x1b, F2 0x71,
        // F3 0x72 — jump table at 0x4063a8/0x4063bc); everything else is read
        // as a WM_CHAR through the table at 0x40684c/0x40686c, which covers
        // characters 0x58..0x79 only. Lowercase 'f' (0x66) toggles the speed
        // flag at 0x40c670; uppercase 'F' (0x46) is below that range and is
        // discarded, and a WM_KEYDOWN of vk 0x46 never reaches the toggle at
        // all. A pill only ever sent the virtual key, so Fast did nothing.
        // New game keeps its bare vk because F2 really is a virtual key here.
        touchControls: {
          viewToggle: false,
          keyboardCorner: 'bl',
          keyboardRow: 0,
          buttons: [
            { vk: 0x46, char: 0x66, label: 'Fast', pos: 'br' },
            { vk: 0x71, label: 'New game', pos: 'bl' },
          ],
        },
      },
      liquid_war: {
        exe: liquidWarRoot + 'lwwin.exe',
        debugPickerSection: 'other-games',
        files: liquidWarFiles,
        requiredFiles: true,
        // The room is keyed on the executable, so a Liquid War player only
        // ever sees other Liquid War players (and the server below, which
        // names the same exe). The client joins whoever is serving when it
        // first opens a socket; it then connects to the server's seat.
        lan: {
          exe: 'lwwin.exe',
          label: 'Liquid War',
          onDemand: true,
          room: 'auto',
          hint: 'pick Net game and connect to {host}.',
        },
      },
      // The dedicated server is the same tree's other executable. It has no
      // game window of its own — it prints to a console and waits — so it is
      // only interesting with a client pointed at it.
      liquid_war_server: {
        exe: liquidWarRoot + 'lwwinsrv.exe',
        debugPickerSection: 'other-games',
        files: liquidWarFiles,
        requiredFiles: true,
        args: '-private -2 -nobeep',
        // The server shares the client's room: it is the thing the other
        // player's client is looking for. It is serving while it listens
        // on 8035, which only the emulator's socket table can say.
        lan: {
          exe: 'lwwin.exe',
          label: 'Liquid War',
          onDemand: true,
          room: 'auto',
          hostProbe: { protocol: 'serving', listen: 8035 },
        },
      },
      far_manager_170: {
        exe: farManager170Root + 'Far.exe',
        files: farManager170Files,
        requiredFiles: true,
        preExtractIcon: false,
      },
      winrar_310: {
        exe: winrar310Root + 'WinRAR.exe',
        files: winrar310Files,
        requiredFiles: true,
        preExtractIcon: false,
      },
      winmine:  { exe: 'binaries/xp/winmine.exe', debugPickerSection: 'other-games', runSlice: CARD_RUN_SLICE },
      sndrec32_xp: { exe: 'binaries/xp/sndrec32.exe', debugPickerSection: 'other-apps' },
      pinball: {
        exe: 'binaries/pinball/pinball.exe',
        singleAppArgs: '-fullscreen',
        debugPickerSection: 'other-games',
        files: pinballFiles,
        // Native fullscreen avoids the window's (17,-9) startup offset.
        // Normal shows the complete 641x481 scene; Table contains the entire
        // playfield, never an aspect-fill slice through its top or flippers.
        //
        // These four numbers are the table's own bounding box in that scene,
        // measured off a rendered fullscreen frame (tools/png-rows.js --cols
        // --list, first and last line with any lit pixel): the artwork runs
        // x 23..382 and y 32..447, and its axis of symmetry is x=203 -- the
        // trapezoid's top edge is centred on 202.5 and its bottom on 203.
        //
        // The crop that was here before ran x 32..384 / y 32..481, which was
        // wrong twice over and was reported as "the table is a lil bit off
        // center": it started 9px INSIDE the table's left edge, so the bottom
        // left corner of the frame was cut off, and it carried 33 rows of
        // dead black below the table. Together those put the table's axis 5px
        // left of the picture's centre -- 16 device px at the phone's 3.2x
        // portrait scale, which is exactly what "a lil bit" looks like.
        //
        // landscapeView: 'window' -- in landscape the scarce axis is height,
        // so the WHOLE 641x481 scene is fitted to it and runs top to bottom
        // with no black bars; the gutters land left and right, where a phone
        // held sideways has room to spare and nothing is lost. Cropping to
        // the table there would throw the score panel away to buy a little
        // width nobody is short of. The chip still offers Fill on top of it.
        //
        // fitTrim is the app's own black margin, measured off the presented
        // canvas rather than guessed: scanning every source row and column of
        // the 641x481 window for a pixel above luma 8 finds 23 dead columns on
        // the left, 32 on the right, 32 dead rows on top and 33 at the bottom,
        // and nothing dead anywhere inside. Landscape fit is sized by the
        // height, so those 65 rows were costing 13.5% of the scale for
        // nothing. Note the left/top/bottom numbers are the same ones the
        // table crop starts at -- this is one border, seen twice.
        mobileCrop: { x: 23 / 641, y: 32 / 481, w: 360 / 641, h: 416 / 481,
          contain: true, fitLabel: 'Normal', zoomLabel: 'Table',
          fitTrim: { left: 23 / 641, right: 32 / 641,
            top: 32 / 481, bottom: 33 / 481 } },
        // The bindings test/test-pinball-playable.js drives: Z and '/' are the
        // flippers, Space is the plunger, F2 starts a new game. The two
        // flippers must be held together, which is why the overlay tracks
        // touches by identifier.
        //
        // The nudges are X (from the left) and '.' (from the right), and both
        // were measured rather than assumed: with a ball in play, holding
        // either moves 1.7% / 0.7% of the table's pixels against the 0.13%
        // the same frames drift on their own. They stay buttons because a
        // nudge is a deliberate act you should not commit by leaning on the
        // table; the flippers and the plunger are in-place zones instead.
        touchControls: {
          zonesOnCrop: true,
          landscapeView: 'window',
          // The flippers are not buttons in a corner: they are the parts of
          // the table you press. Left half flips left, right half flips
          // right. A small lower-right zone overrides that half beside the
          // plunger lane. The top 18% is left un-zoned so the title bar, the
          // Game menu and the two nudge chips still take an ordinary tap.
          //
          // A zone is invisible, which is the point (the control IS the
          // table) and is also how a player fails to find it. `caption` names
          // it in the letterbox UNDER the table -- never on the playfield.
          // `captionX` is a fraction of the table's width: the right flipper's
          // caption is pulled in from its zone centre so it clears the
          // plunger's in landscape, where the table is only ~300 CSS px wide.
          zones: [
            { vk: 0x5A, title: 'Left flipper', caption: 'Flipper',
              captionX: 0.24, rect: { x: 0, y: 0.18, w: 0.5, h: 0.82 } },
            { vk: 0xBF, title: 'Right flipper', caption: 'Flipper',
              captionX: 0.62, rect: { x: 0.5, y: 0.18, w: 0.5, h: 0.82 } },
            // y 0.70..1.0 of the NEW crop is scene rows 323..448, the plunger
            // lane. The old 0.72..0.97 was measured against a crop with 33
            // dead rows on the end, so its lower quarter was off the table.
            { vk: 0x20, title: 'Plunger', caption: 'Launch',
              captionX: 0.93, rect: { x: 0.88, y: 0.70, w: 0.12, h: 0.30 } },
          ],
          buttons: [
            // The nudges go in the table's own top corners, which the
            // perspective leaves black and empty, as arrows pointing the way
            // the table moves. They stay buttons -- a nudge is a deliberate
            // act you should not commit by leaning on the table -- but a
            // button that is ON the side it shoves needs no word on it.
            //
            // `fit` is the largest circle that lies inside one of those black
            // triangles, measured off a rendered frame row by row rather than
            // guessed. The table's artwork edges run x 92 -> 72 on the left
            // and 313 -> 333 on the right between rows 35 and 155, i.e. a
            // slope of one pixel out per six rows, and the crop's own corner
            // is (23, 32). Inscribing a circle against those three lines
            // gives centre (54.9, 63.9) and radius 31.9 source px -- so, as
            // fractions of the 360x416 crop: cx 0.0886, cy 0.0767, r 0.0885
            // of the WIDTH. The right corner is the mirror image.
            { vk: 0x58, icon: 'arrow-left', title: 'Nudge left',
              pos: 'board-tl', size: 40,
              fit: { cx: 0.0886, cy: 0.0767, r: 0.0885 } },
            { vk: 0xBE, icon: 'arrow-right', title: 'Nudge right',
              pos: 'board-tr', size: 40,
              fit: { cx: 0.0886, cy: 0.0767, r: 0.0885 } },
            // New game is destructive. In landscape the bottom-left rail is
            // beside the left flipper, so move this chip to the phone's top
            // left; portrait retains its bottom-left position.
            { vk: 0x71, icon: 'restart', chip: true, title: 'New game',
              pos: 'bl', landscapePos: 'tl' },
          ],
        },
      },
      pinball_plus95: {
        exe: 'binaries/pinball-plus95/pinball.exe',
        files: pinballPlus95Files,
        debugPickerSection: 'other-games',
      },
      dxball: {
        exe: dxballRoot + 'dxball.exe',
        files: dxballFiles,
        requiredFiles: true,
        preExtractIcon: false,
        mobileTouch: 'direct',
        touchControls: {
          boardLayout: true,
          mouseJoystick: { pos: 'bl', maxSpeed: 900, responseExponent: 3 },
          buttons: [{ mouseButton: 0, label: 'Launch', pos: 'br' }],
        },
      },
      blobby_volley: {
        exe: blobbyRoot + 'volley.exe',
        files: blobbyFiles,
        requiredFiles: true,
        preExtractIcon: false,
        mobileTouch: 'direct',
        // volley.exe rewrites settings.dat on a clean exit, so keeping it
        // means a person's own keys and player modes survive a reload
        // instead of reverting to the mounted copy.
        persistFiles: ['c:\\settings.dat'],
        // The shipped settings.dat changed 2026-09-20: player two moved off
        // the mouse, which is the only control a network client cannot use.
        // Anyone who had already played was running their own saved copy and
        // would never have seen that fix, so this drops the saved copy once.
        // Bump the token whenever the shipped file changes again: it changed
        // 2026-09-21, player two is the computer so a solo launch plays ADAM.
        persistReset: 'settings-2026-09-21-p2-computer',
        // NETZWERKSPIEL is DirectPlay, carried on the segment by
        // src/09d4-dplay-net.wat: the guest finds the host's session by
        // broadcast, so nobody types an address.
        lan: {
          exe: 'volley.exe',
          label: 'Blobby Volley',
          // Somebody hosting shows up in the list at launch, as for Quake.
          // With nobody hosting, nothing is asked until NETZWERKSPIEL makes
          // the guest's own DirectPlay call ask for a room (`onDemand`), so a
          // two-player game on one keyboard is never interrupted. Hosting
          // (EIN SPIEL HOSTEN → SPIEL BEGINNEN!) goes online without a
          // question and shows the page link to share; SPIELE SUCHEN shows the list when anyone is serving.
          onDemand: true,
          room: 'auto',
          // Serving means a DirectPlay session is open on this machine: the
          // probe asks with the provider's own ENUM_REQ, which only a host
          // answers, and labels the room "<session> 1/2".
          hostProbe: { protocol: 'dplay' },
          // Where a joiner goes from there. Discovery is DirectPlay's own
          // broadcast, so nobody types an address.
          join: {
            // Picked from the list while the game was searching (SPIELE
            // SUCHEN is EnumSessions, why 4): the host's reply fills the
            // game's own session list, and Up Enter takes the one session in
            // it -- the keys test-web-blobby-rtc.js used to press by hand.
            // Anywhere else (SPIEL BEGINNEN is Open, a host) there is no
            // list to pick from, and the hint says where to go instead.
            //
            // Joined from the list at launch (why 5) the game is still
            // booting: wait for the main menu to be drawn, then walk it the
            // way test-blobby-vlan.js does -- NETZWERKSPIEL, ALS GAST
            // SPIELEN..., SPIELE SUCHEN -- which ends at the same list.
            //
            // Paced by the screen, not a clock: the menu is perfectly still
            // until a key moves its highlight or changes the page (measured,
            // identical frames 16 guest-seconds apart), so each key waits for
            // the picture to answer it and settle. A key that moves nothing
            // stops the walk and the hint takes over.
            inGame: async ({ why, heard, press, step, settle, frame, colours, sleep }) => {
              if (why === 5) {
                for (let i = 0; i < 1200 && colours() <= 64; i++) await sleep(250);  // a slow phone boots slowly
                if (colours() <= 64) return false;
                // The menu fades in; it is ready once it stops changing.
                await settle({ stableMs: 500, maxMs: 8000 });
                if (!await step(['Down', 'Enter', 'Down', 'Enter', 'Down', 'Down', 'Enter'])) return false;
              } else if (why !== 4) return false;
              for (let i = 0; i < 150 && !heard(); i++) await sleep(200);
              if (!heard()) return false;
              // The list is drawn on the game's next refresh, not the frame's:
              // wait for that redraw, and press anyway if it never shows.
              await settle({ change: frame(), stableMs: 300, maxMs: 4000 });
              await press(['Up', 'Enter']);
              return true;
            },
            hint: 'pick NETZWERKSPIEL → ALS GAST SPIELEN… → SPIELE SUCHEN',
          },
          // "Host a new game" on the game-over card boots the game again in
          // a room of its own; this walks it from the main menu to hosting,
          // the keys test-blobby-vlan.js presses: NETZWERKSPIEL, EIN SPIEL
          // HOSTEN…, then the third entry, SPIEL BEGINNEN!. Paced by the
          // screen, as the join walk is.
          host: {
            inGame: async ({ step, settle, colours, sleep }) => {
              for (let i = 0; i < 1200 && colours() <= 64; i++) await sleep(250);
              if (colours() <= 64) return false;
              await settle({ stableMs: 500, maxMs: 8000 });
              return step(['Down', 'Enter', 'Enter', 'Down', 'Down', 'Enter']);
            },
            hint: 'pick NETZWERKSPIEL → EIN SPIEL HOSTEN… → SPIEL BEGINNEN!',
          },
          hint: 'Both of you pick NETZWERKSPIEL → MULTIPLAYER-OPTIONEN. One picks '
            + 'EIN SPIEL HOSTEN… → SPIEL BEGINNEN!, the other ALS GAST SPIELEN… '
            + '→ SPIELE SUCHEN and chooses the session found. Each machine drives '
            + 'its own player with ← → to move and ↑ to jump (on a phone: the pad '
            + 'to move, the one button to jump) — the shipped '
            + 'settings.dat gives both players those keys precisely so the same '
            + 'controls work whichever side you are. Instructions.txt 3.2.2 — the '
            + 'client "always gets the keys you specified for player two" — so the '
            + 'mouse that moves player two in a LOCAL game does nothing in a '
            + 'network match, measured in test-blobby-vlan.js.',
        },
        // A keyboard pad, not a mouse one, and it sends BOTH players' keys at
        // once: A/D/W (player one) together with the arrows (player two).
        // That is what lets one layout be correct everywhere without touching
        // the game's stock key assignment. In a network match each machine
        // applies only the set belonging to the player it owns and ignores
        // the other -- measured, the host holding player two's key moves that
        // blob 0.0px against 67px of natural drift (test-blobby-vlan.js) --
        // so the host's press drives red, the guest's identical press drives
        // green. In a local game both blobs answer, which is the same thing
        // one keyboard already does.
        // The arrows also have to be here for a second reason: Blobby's menus
        // are arrow+Enter driven, a phone tap does not work them at all
        // (measured: tapping SPIEL STARTEN does nothing), and the selection
        // does not wrap past ENDE -- so the pad needs both vertical
        // directions and an Enter button, or a phone cannot leave the menu.
        // A mouse joystick can do none of this: it emits no key events at all
        // (lib/touch-controls.js), and the mouse reaches player two only in a
        // LOCAL game.
        // settings.dat is the game's own stock file, regenerable with
        // tools/blobby-settings.js --control=keyboard,computer; its format,
        // and why a stored COMPUTER never reaches a network match (both
        // entry points overwrite CONTROL for the match), are in
        // docs/re-notes/blobby-volley.md.
        // Touch only, applied to whatever copy of settings.dat is about to be
        // mounted (ours, or the player's own restored one): player two's jump
        // moves off the arrow key onto Enter.
        //
        // WHY: a touch button has to carry BOTH players' jump keys, because
        // the network client is driven by player two's set and either side may
        // be the client. Player two's stock jump is UP -- which is also how
        // this game's menus move -- so one button could never be both "jump"
        // and "confirm", and the old layout needed two, with the Jump button
        // walking the menu selection every time it was pressed there. With
        // player two on Enter, both jump keys (W and Enter) are inert in the
        // menus and one button does both jobs on both sides.
        //
        // Only player two moves, and only on a touch device. Two people at one
        // keyboard keep two distinct key sets (A/D/W against arrows), and a
        // desktop player keeps the stock arrow jump entirely.
        //
        // Safe because the game indexes its key-state table with the raw VK
        // and no whitelist (0x004421dc: `movzx ebx, word [ecx]` /
        // `mov byte [edx+ebx+0x97ce35], 1`), and because no in-match code
        // gives Enter its own meaning -- every in-match read of the last-key
        // word is an any-key test (0x00448c16). See docs/re-notes/.
        // Player two's jump moves off UP, which is also how the menus move, on
        // to a key no menu and no other player owns. SPACE, not ENTER: the pad
        // sends only the local player's keys (see `lanClientTouchControls`), so
        // the jump key has to be inert for the OTHER blob, and ENTER is the
        // menu confirm every layout must carry.
        touchPatches: [
          { path: 'c:\\settings.dat', offset: 0x14, uint32: 0x20, size: 117 },
        ],
        // The default: this machine drives player one -- solo, and the host
        // seat of a LAN match.
        touchControls: {
          boardLayout: true,
          dpad: {
            pos: 'bl',
            ways: 4,
            vks: {
              left: [0x41],          // A
              right: [0x44],         // D
              // Vertical is menu navigation and nothing else: jumping is the
              // button, and no blob ducks.
              up: [0x26],            // UP
              down: [0x28],          // DOWN
            },
          },
          buttons: [
            // W jumps player one; ENTER confirms in the menus and, after the
            // patch above, belongs to no player at all.
            { vk: [0x57, 0x0d], label: 'Jump', pos: 'br' },
          ],
        },
        // ...and this is the same layout for the seat that owns player two.
        // lib/browser-shell.js swaps to it at joinVlan when this machine is not
        // the host (10.0.0.1). Without the swap the pad has to send both key
        // sets, and in a solo match one thumb then walks both blobs -- which is
        // exactly what it did.
        lanClientTouchControls: {
          boardLayout: true,
          dpad: {
            pos: 'bl',
            ways: 4,
            vks: {
              left: [0x25],          // LEFT
              right: [0x27],         // RIGHT
              up: [0x26],            // UP -- menu only
              down: [0x28],          // DOWN
            },
          },
          buttons: [
            { vk: [0x20, 0x0d], label: 'Jump', pos: 'br' },
          ],
        },
      },
      cave_story: {
        exe: caveStoryRoot + 'doukutsu/Doukutsu.exe',
        files: [],
        localFileManifest: caveStoryRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        touchControls: {
          dpad: { pos: 'bl', ways: 4 },
          buttons: [
            { vk: 0x5A, label: 'Jump', pos: 'br' },
            { vk: 0x58, label: 'Fire', pos: 'br', row: 1 },
          ],
        },
      },
      generally: {
        exe: generallyRoot + 'GeneRally.exe',
        files: [],
        localFileManifest: generallyRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        touchControls: {
          dpad: { pos: 'bl', ways: 8 },
          buttons: [{ vk: 0x1B, label: 'Menu', pos: 'br' }],
        },
      },
      generally_track_editor: {
        exe: generallyRoot + 'TrackEditor.exe',
        files: [],
        localFileManifest: generallyRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
      },
      pocket_tanks_installer: {
        exe: 'test/binaries/candidates/pocket-tanks-installer/ptanks.exe',
      },
      pocket_tanks: {
        exe: pocketTanksRoot + 'pockettanks.exe',
        // The main loop at 0x489d85 pumps messages (0x48b690) then calls the
        // frame function 0x472000 (its only caller) until [0x5090d8] is set;
        // verifier = that call's return 0x489d8f. The battlefield renders
        // continuously, one GetDC/BitBlt/ReleaseDC pass per frame.
        perf: {
          logicalFrame: {
            label: 'GAME',
            address: 0x00472000,
            verifier: 0x00489d8f,
          },
        },
        files: [],
        localFileManifest: pocketTanksRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        // Windows 2000: on Windows 98 the game refuses LAN play ("Network
        // games require Windows 2000 or newer").
        winver: 0x05650005,
      },
      little_fighter_2: {
        exe: littleFighter2Root + 'lf2.exe',
        files: [],
        localFileManifest: littleFighter2Root + '.wine-assembly-browser.json',
        requiredFiles: true,
        // P3 is the arrow-key player in the shipped configuration; its three
        // action keys are Enter (attack), Shift (jump) and Ctrl (defend).
        touchControls: {
          dpad: { pos: 'bl', ways: 8 },
          buttons: [
            { vk: 0x0D, label: 'Attack', pos: 'br' },
            { vk: 0x10, label: 'Jump', pos: 'br', row: 1 },
            { vk: 0x11, label: 'Defend', pos: 'br', row: 2 },
          ],
        },
      },
      little_fighter_2_installer: {
        exe: 'test/binaries/candidates/little-fighter-2-installer/lf2_v19.exe',
      },
      icy_tower: {
        exe: icyTowerRoot + 'icytower13.exe',
        files: [],
        localFileManifest: icyTowerRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        touchControls: {
          dpad: { pos: 'bl', ways: 4, style: 'cross' },
          buttons: [{ vk: 0x20, label: 'Jump', pos: 'br' }],
        },
      },
      icy_tower_installer: {
        exe: 'test/binaries/candidates/icy-tower/icytower13_install.exe',
      },
      snood: {
        exe: snoodRoot + 'snood.exe',
        // SC_MAXIMIZE makes Snood recreate itself at its fixed 936x735 "Huge"
        // layout; on a portrait phone's 600-wide desktop the board ran off
        // the right edge ("Snood wasn't fully rendering game board"). Keep its
        // 600x479 Medium window and let the phone zoom it.
        singleAppMaximize: false,
        // Snood builds its back buffer at the screen size it starts on. The
        // phone desktop started at 400x711 (portrait) or ~667x300 (landscape),
        // so everything past x=400 or below y=300 stayed black for the run,
        // board included. 1024x768 rather than Win98's 640x480 floor so its
        // Big (760x563) and Huge (936x735) layouts fit too; the phone zooms
        // to the window, so the default Medium board is not drawn any smaller.
        singleAppMinDesktop: { w: 1024, h: 768 },
        files: [],
        localFileManifest: snoodRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
      },
      snood_installer: {
        exe: 'test/binaries/candidates/snood/SnoodWin22Install.exe',
      },
      // Windows Installer 2.0 redistributable for Win9x (instmsi.exe, Spanish
      // build). IExpress -> msiinst.exe -> msiexec.exe x3, each started with
      // CreateProcess and waited on, so it needs real child processes:
      // spawnProcesses runs them as child instances (test/run.js and host.js).
      // The chain completes on the CLI and, since be3d5da3, in the browser.
      // The last msiexec ends on a modal "completed successfully" box; its OK
      // is control 3001. docs/re-notes/windows-installer-2.0.md.
      windows_installer_20: {
        exe: 'test/binaries/candidates/windows-installer-2.0-win9x/sources/instmsi.exe',
        spawnProcesses: true,
      },
      ricochet_xtreme: {
        exe: ricochetXtremeRoot + 'game/Ricochet.exe',
        dlls: [ricochetXtremeRoot + 'game/IFC22.dll'],
        files: [],
        localFileManifest: ricochetXtremeRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        persistFiles: ['c:\\ricochet.cfg'],
      },
      alien_shooter: {
        exe: alienShooterRoot + 'game/AlienShooter.exe',
        files: [],
        localFileManifest: alienShooterRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
      },
      collapse_crunch: {
        exe: collapseCrunchRoot + 'game/Collapse3.exe',
        files: [],
        localFileManifest: collapseCrunchRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
      },
      zuma_deluxe: {
        exe: zumaDeluxeRoot + 'game/Zuma.exe',
        files: [],
        localFileManifest: zumaDeluxeRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
      },
      crimsonland: {
        exe: crimsonlandRoot + 'game/crimsonland.exe',
        dlls: ['grim.dll', 'ogg.dll', 'vorbis.dll', 'vorbisfile.dll'].map(name => crimsonlandRoot + 'game/' + name),
        files: [],
        localFileManifest: crimsonlandRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
      },
      // presentCap: 60. Measured 2026-09-28 (box, headless Chrome, in a
      // level): 490 presents/s and 99% of a core uncapped, 60/s and 23%
      // capped. Menus present thousands of times a second by locking the
      // whole primary. The level clock is time-based: on the 16 ms/batch CLI
      // clock the on-screen timer advanced 4.79 s in 4.80 guest-s uncapped
      // and 5.00 s in 5.00 guest-s capped.
      elasto_mania: {
        presentCap: 60,
        exe: elastoManiaRoot + 'Elma/Elma.exe',
        files: [],
        localFileManifest: elastoManiaRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        persistFiles: ['c:\\state.dat', 'c:\\stats.txt', 'c:\\Rec\\*.rec'],
        touchControls: {
          dpad: { pos: 'bl', ways: 8 },
          buttons: [{ vk: 0x20, label: 'Turn', pos: 'br' }],
        },
      },
      jardinains: {
        exe: jardinainsRoot + 'jardinains.exe',
        files: [],
        localFileManifest: jardinainsRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        asyncMultimediaTimer: true,
      },
      jardinains_installer: {
        exe: 'test/binaries/candidates/jardinains/jardinains_1_2.exe',
      },
      // ScummVM 0.8.0 + Flight of the Amazon Queen (floppy, freeware). The
      // command line points ScummVM straight at the game (-p path, target
      // queen) so it boots the game rather than the launcher dialog.
      // queen.tbl is ScummVM's engine table and has to sit beside the exe.
      // docs/re-notes/scummvm-fotaq.md has the route and open issues.
      scummvm_fotaq: {
        exe: scummvmFotaqRoot + 'scummvm.exe',
        dlls: [scummvmFotaqRoot + 'SDL.dll'],
        files: [
          { url: scummvmFotaqRoot + 'queen.tbl', vfsPath: 'c:\\queen.tbl' },
          { url: scummvmFotaqRoot + 'games/FOTAQ_Floppy/queen.1',
            vfsPath: 'c:\\games\\FOTAQ_Floppy\\queen.1' },
          // GPL: the license travels with the binary.
          { url: scummvmFotaqRoot + 'COPYING.txt', vfsPath: 'c:\\COPYING.txt' },
        ],
        requiredFiles: true,
        args: '-pC:\\games\\FOTAQ_Floppy queen',
      },
      winboard: {
        exe: 'binaries/candidates/winboard-installer/installed/winboard.exe',
        dlls: ['binaries/dlls/msvcrt.dll'],
        files: [],
        localFileManifest: 'binaries/candidates/winboard-installer/.wine-assembly-browser.json',
        requiredFiles: true,
        workingDirectory: 'C:\\',
        // Original bundled GNU Chess 4.0.80 via normal WinBoard engine options.
        args: '-cp -fcp GNUChess -scp GNUChess',
      },
      ultima4_gog: {
        exe: 'binaries/candidates/gog-free-ultima-iv/installed/DOSBOX/DOSBox.exe',
        dlls: ['binaries/candidates/gog-free-ultima-iv/installed/DOSBOX/SDL.dll', 'binaries/candidates/gog-free-ultima-iv/installed/DOSBOX/SDL_net.dll', 'binaries/dlls/msvcrt.dll'],
        files: [],
        localFileManifest: 'binaries/candidates/gog-free-ultima-iv/.wine-assembly-browser.json',
        requiredFiles: true,
        // Restore user saves after original templates mount; never reset them.
        persistFiles: ['c:\\cloud_saves\\*.sav'],
        args: '-conf "c:\\ultima4-wa.conf" -noconsole',
      },
      daggerfall_gog: {
        exe: 'binaries/candidates/gog-free-elder-scrolls-daggerfall/installed/DOSBOX/DOSBox.exe',
        dlls: ['binaries/candidates/gog-free-elder-scrolls-daggerfall/installed/DOSBOX/SDL.dll', 'binaries/candidates/gog-free-elder-scrolls-daggerfall/installed/DOSBOX/SDL_net.dll', 'binaries/dlls/msvcrt.dll'],
        files: [],
        localFileManifest: 'binaries/candidates/gog-free-elder-scrolls-daggerfall/.wine-assembly-browser.json',
        requiredFiles: true,
        args: '-conf "c:\\dosbox_daggerfall.conf" -conf "c:\\dosbox-wa.conf" -conf "c:\\dosbox-launch.conf" -noconsole',
      },
      arena_gog: {
        exe: 'binaries/candidates/gog-free-elder-scrolls-arena/installed/DOSBOX/DOSBox.exe',
        dlls: ['binaries/candidates/gog-free-elder-scrolls-arena/installed/DOSBOX/SDL.dll', 'binaries/candidates/gog-free-elder-scrolls-arena/installed/DOSBOX/SDL_net.dll', 'binaries/dlls/msvcrt.dll'],
        // GOG creates this Windows-side directory; DOS mkdir truncates to8.3.
        mounts: [async vfs => {
          const dir = 'c:\\cloud_saves';
          const attrs = vfs.getFileAttributes(dir) >>> 0;
          if (attrs !== 0xffffffff && !(attrs & 0x10)) throw new Error('Arena save directory conflicts with existing file');
          if (attrs === 0xffffffff && !vfs.createDirectory(dir)) throw new Error('Arena save directory creation failed');
          const after = vfs.getFileAttributes(dir) >>> 0;
          if (after === 0xffffffff || !(after & 0x10)) throw new Error('Arena save directory missing');
          return {root: dir};
        }],
        files: [],
        localFileManifest: 'binaries/candidates/gog-free-elder-scrolls-arena/.wine-assembly-browser.json',
        requiredFiles: true,
        persistFiles: ['c:\\cloud_saves\\*'],
        args: '-conf "c:\\arena-wa.conf" -noconsole',
      },
      nethack_win32: {
        exe: nethackRoot + 'installed/NetHackW.exe',
        files: [],
        localFileManifest: nethackRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        environment: { HACKDIR: 'C:\\' },
        persistFiles: ['c:\\user-*.0', 'c:\\record'],
      },
      arcanum_demo: {
        // DirectInput mouse: the game reads relative motion and draws its
        // own cursor.
        relativeMouse: true,
        hideHostCursor: true,
        mobileTouch: 'trackpad',
        exe: arcanumDemoRoot + 'installed/arcanum.exe',
        dlls: [
          arcanumDemoRoot + 'installed/binkw32.dll',
          arcanumDemoRoot + 'installed/mss32.dll',
        ],
        files: [],
        localFileManifest: arcanumDemoRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      qbob: {
        exe: qbobRoot + 'QBob.exe',
        files: [],
        localFileManifest: qbobRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
      },
      tetrinet: {
        exe: tetrinetRoot + 'TETRINET.EXE',
        files: [],
        localFileManifest: tetrinetRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        // One exe is both ends: Start Server listens on 31457 (read from the
        // emulator's socket table -- a listener sends nothing to watch for),
        // Connect is given the server's address.
        lan: {
          exe: 'TETRINET.EXE',
          label: 'TetriNET',
          onDemand: true,
          room: 'auto',
          hostProbe: { protocol: 'serving', listen: 31457 },
          hint: 'open Client Settings, enter {host} as the server and Connect.',
        },
      },
      // Space leaves the title for name entry (typed, then Enter); the round
      // is mouse-only. Keys reach the game through its WH_KEYBOARD hook.
      // A click on the title does nothing: the title loop polls only Space
      // and Esc, so a phone has no way in without these two keys.
      moorhuhn: {
        exe: moorhuhnRoot + 'Moorhuhn.exe',
        // The in-round frame step 0x408780 (reads the frame's input record
        // through 0x412b50; the frame's present returns from its Flip
        // wrapper at 0x407de9), called per frame from 0x4070c9 -> 0x4070ce. The
        // PeekMessage loop at 0x40e89c mostly idles (0x4152a0 returns 0)
        // and is not the frame boundary. Hunt round batches 600-850:
        // 2020 steps = 2020 main-thread frame ends; 0x4070ce 2950 vs
        // 0x407de9 2949 over the whole run. Title/menu frames present
        // through other paths, so GAME/s is the in-round rate.
        perf: {
          logicalFrame: {
            label: 'GAME',
            address: 0x00408780,
            verifier: 0x004070ce,
          },
        },
        files: [],
        localFileManifest: moorhuhnRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        keepAspect: true,
        mobileTouch: 'trackpad',
        // The crosshair is game art. Its WM_SETCURSOR asks for IDC_ARROW in
        // some states (mode byte 0x42f6f4), and the pointer starts as the
        // arrow until the first WM_SETCURSOR hides it -- on a phone that drew
        // a Windows arrow over the crosshair mid-round.
        hideHostCursor: true,
        touchControls: {
          buttons: [
            { vk: 0x20, label: 'Start', pos: 'bl' },
            { vk: 0x0D, char: 0x0D, label: 'OK', pos: 'bl', row: 1 },
          ],
          // Right button: its wndproc keeps wParam & (MK_LBUTTON|MK_RBUTTON).
          zones: [moorhuhnReloadZone()],
        },
      },
      // Its own DLLs are static imports, and it needs the real MSVCRT
      // (_strdate is not in the built-in one). fmod.dll is UPX-packed and
      // resolves MSACM32 by GetProcAddress; its DllMain fails if any is absent.
      // presentCap: 60. Measured 2026-09-28 (box, headless Chrome, in a
      // round): 480 presents/s and 98% of a core uncapped, 60/s and 34%
      // capped. run.js --present-distinct finds 224-281 changed frames per
      // guest second in a round, so it really draws above 60. The round
      // clock is time-based: at equal guest time both arms read 1:03 (CLI)
      // and 1:06 (browser) though the capped arm drew 50x fewer frames.
      moorhuhn_2: {
        presentCap: 60,
        exe: moorhuhn2Root + 'Moorhuhn2.exe',
        dlls: ['test/binaries/dlls/msvcrt.dll'].concat(
          ['mudGE.dll', 'wtnlib.dll', 'fmod.dll', 'pluginpack.dll',
            'FModPlugin.dll'].map(name => moorhuhn2Root + name)),
        files: [],
        localFileManifest: moorhuhn2Root + '.wine-assembly-browser.json',
        requiredFiles: true,
        keepAspect: true,
        // In a round pluginpack.dll reads the mouse as buffered DirectInput
        // (GetDeviceData) and ADDS each delta to its own clamped crosshair
        // (0x10015720), so a touch's absolute position means nothing to it:
        // a tap jumps the crosshair by finger-minus-previous-finger, not to
        // the finger. Drag steers, tap shoots at the crosshair -- a desktop
        // mouse. The crosshair is game art, so no host pointer is drawn over
        // it. Reload is the right button (Readme.htm), and the game only
        // reloads an EMPTY magazine. The zone lies over the shells the game
        // draws bottom-right, so tapping the ammunition reloads it.
        mobileTouch: 'trackpad',
        hideHostCursor: true,
        touchControls: {
          zones: [moorhuhnReloadZone()],
        },
      },
      // Moorhuhn 1's engine, but a click (not Space) starts the round, and
      // the headless load takes ~1100 batches of 100000.
      moorhuhn_winter: {
        exe: moorhuhnWinterRoot + 'MoorhuhnWinter.exe',
        files: [],
        localFileManifest: moorhuhnWinterRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        keepAspect: true,
        mobileTouch: 'trackpad',
        hideHostCursor: true,   // crosshair is game art, as in Moorhuhn 1/2
        // FAQ.html: "nachgeladen mit der rechten Maustaste".
        touchControls: { zones: [moorhuhnReloadZone()] },
      },
      // Packed, with an anti-speed-hack watchdog: it calibrates RDTSC across
      // Sleep(1001) and exits if the TSC and GetTickCount later disagree by a
      // second. A click leaves the title, a second click and Space start the
      // round; headless that is ~3050 batches of 200000 (title ~2400).
      // presentCap: 60. Measured 2026-09-28 in a round: 79 presents/s
      // uncapped in headless Chrome (84 in a real browser), 60/s capped, and
      // page CPU fell from 8.9s to 7.8s per 45s. The round clock is
      // time-based: capped, 0:39 at the same wall time as uncapped, and on
      // the CLI 45 of 56 countdown seconds per guest second against 37 of 44.
      // Capped, 95% of presents change the picture against 69% uncapped.
      moorhuhn_3: {
        presentCap: 60,
        exe: moorhuhn3Root + 'installed-extracted/App_Executables/Moorhuhn3.exe',
        files: [],
        localFileManifest: moorhuhn3Root + '.wine-assembly-browser.json',
        requiredFiles: true,
        keepAspect: true,
        mobileTouch: 'trackpad',
        hideHostCursor: true,   // crosshair is game art
        // MH3DL_FAQ.html: "nachgeladen mit der rechten Maustaste".
        touchControls: { zones: [moorhuhnReloadZone()] },
        // Game step: 0x4144b0, called once per pass of the frame loop at
        // 0x413f74 (timeGetTime, step, Flip, a 10 ms busy-wait). Verifier:
        // 0x413fd9, where the loop bumps its frame counter [0x4876a4] after
        // the wait. The code is unpacked at run time (docs/re-notes/moorhuhn.md).
        // The loop drives every screen (menus, the round, the high score), so
        // a GAME/s sample needs its scene checked.
        perf: { logicalFrame: { label: 'GAME', address: 0x004144b0, verifier: 0x00413fd9 } },
      },
      // A Flash Player 6 projector with the game appended to its own image.
      // The shipped moorhuhn_tennis.exe only unpacks it to TEMP and
      // CreateProcesses it, so the registry runs the projector directly;
      // the manifest says how installed/ is produced. Hover, then press and
      // release "weiter" with a gap: a bare click does not advance it.
      moorhuhn_tennis: {
        exe: moorhuhnTennisRoot + 'MH_Tennis_V14.exe',
        files: ['source.swf', 'basepath.txt'].map(name => moorhuhnTennisRoot + name),
        requiredFiles: true,
      },
      // Moorhuhn 3's CD bonus puzzles are Jigs@w Puzzle (Tibo Software)
      // self-extractors that unpack to C:\WINDOWS\TEMP\tsldrl6660 and
      // ShellExecute setup.exe there; the registry runs that setup.exe from
      // the unpacked folder (produced with run.js --capture-launch).
      moorhuhn_3_puzzle: moorhuhn3Puzzle('moorhuhn3'),
      moorhuhn_3_puzzle_fisch: moorhuhn3Puzzle('fisch'),
      moorhuhn_3_puzzle_leuchtturm: moorhuhn3Puzzle('leuchtturm'),
      // Best Of Moorhuhn CD extras. On the CD each is a Jester wrapper that
      // writes a Flash projector to TEMP\Jgl_Rt and runs it under global
      // hooks (which hide the projector menu); the registry runs the
      // projector itself, exported mid-run with --input=B:vfs-export.
      moorhuhn_training_1: {
        exe: 'test/binaries/candidates/best-of-moorhuhn/spiel1.exe',
        files: [],
        requiredFiles: true,
      },
      moorhuhn_training_2: {
        exe: 'test/binaries/candidates/best-of-moorhuhn/spiel2.exe',
        files: [],
        requiredFiles: true,
      },
      moorhuhn_2_making_of: {
        exe: 'test/binaries/candidates/best-of-moorhuhn/making_of.exe',
        files: [],
        requiredFiles: true,
      },
      // The 2003 Italian Moorhuhn 1 build; same route as moorhuhn (Space,
      // a typed name and Enter reach the round).
      gallinelle: {
        exe: 'test/binaries/candidates/gallinelle-xxl/Game/Gallinelle.exe',
        files: ['test/binaries/candidates/gallinelle-xxl/Game/Gallinelle.dat'],
        requiredFiles: true,
        keepAspect: true,
        // Same engine and presentation as moorhuhn.
        mobileTouch: 'trackpad',
        hideHostCursor: true,
        touchControls: {
          buttons: [
            { vk: 0x20, label: 'Start', pos: 'bl' },
            { vk: 0x0D, char: 0x0D, label: 'OK', pos: 'bl', row: 1 },
          ],
          zones: [moorhuhnReloadZone()],
        },
      },
      // The demo installer's ten files, extracted without running it
      // (provenance.json). The welcome box and the setup dialog both come up
      // on every launch; OK on each, then Enter twice on the title ring
      // (passport, then New Game) reaches Jungle. Left idle, the ring times
      // out into the jungle.DEM attract demo, which any key ends.
      tomb_raider_3_demo: {
        exe: 'test/binaries/candidates/tomb-raider-3-demo/extracted/Program_Executable_Files/tomb3.exe',
        // The game opens data\ and pix\ relative to its own directory, so
        // each file keeps its subdirectory instead of the default c:\<name>.
        files: [
          'pix/Title.bmp', 'pix/legal.bmp', 'pix/release.bmp', 'pix/INDIA.BMP',
          'data/jungle.DEM', 'data/JUNGLE.TR2', 'data/MAIN.SFX',
          'data/TITLE.TR2', 'data/tombPC.dat',
        ].map(path => ({
          url: 'test/binaries/candidates/tomb-raider-3-demo/extracted/Program_Executable_Files/' + path,
          vfsPath: 'c:\\' + path.replace('/', '\\'),
        })),
        requiredFiles: true,
      },
      // The Venice demo, extracted from its WinZip SFX without running it
      // (provenance.json). Every launch opens its options property sheet
      // (real comctl32): a click on OK — dlg-cmd IDOK does not close it —
      // and the game goes straight into Venice, no title menu.
      tomb_raider_2_demo: {
        exe: 'test/binaries/candidates/tomb-raider-2-demo/game/TOMB2.EXE',
        // TOMB2.EXE opens DATA\ relative to its own directory.
        files: ['DATA/DEMOPC.DAT', 'DATA/BOAT.TR2'].map(path => ({
          url: 'test/binaries/candidates/tomb-raider-2-demo/game/' + path,
          vfsPath: 'c:\\' + path.replace('/', '\\'),
        })),
        requiredFiles: true,
      },
      curse_monkey_island_demo: {
        exe: curseMonkeyIslandRoot + 'COMI.EXE',
        files: [],
        localFileManifest: curseMonkeyIslandRoot +
          '.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // The "SECOND Alpha Release - 06/02/97" public demo. It shows "Software
      // expired. Contact Interplay." over the game on a present-day calendar.
      // The only Atomic Bomberman: the April 1997 alpha that used to sit
      // beside it needed its expiry patched out of the binary and had no
      // working network play, so it was dropped on 2026-09-22.
      // presentCap: 60. Measured 2026-09-28: it presents by locking the
      // whole primary, and nothing paces it. The main menu ran at 3,500-6,500
      // presents per second, 95% of them new pictures: an 11-frame animation
      // advanced once per present. The arena ran at 355/s in headless Chrome
      // and used 98% of a core; capped it ran at 60/s and 30%. The match clock
      // is time-based: on the CLI, 12 clock-seconds in 12.0 guest-s uncapped
      // and 15 in 15.6 capped.
      atomic_bomberman_june_demo: {
        presentCap: 60,
        exe: atomicBombermanJuneRoot + 'BM95DEMO.EXE',
        // One game tick = 0x422ab8: pump messages (0x423bb0), then the
        // update/draw step 0x422b1c, which returns to 0x422ad1. In the arena
        // every tick presents once (Lock/Unlock at 0x431c2e, 32 of 32 in a
        // traced window). The static title screen spins ticks without
        // presenting, so GAME/s is a frame rate only in gameplay. Four sites
        // call 0x422b1c; the verifier is the tick's own.
        perf: {
          logicalFrame: {
            label: 'GAME',
            address: 0x00422b1c,
            verifier: 0x00422ad1,
          },
        },
        files: [],
        localFileManifest: atomicBombermanJuneRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 12,
        wallClock: '1997-07-01T12:00:00Z',
        // IPX, carried on the segment as AF_IPX datagrams (src/09d-winsock.wat).
        // The socket opens only once a player picks a network game, so the
        // room is asked for then and a solo game never sees a lobby. The
        // server broadcasts itself; the joiner picks it from a list.
        lan: {
          exe: 'BM95DEMO.EXE',
          label: 'Atomic Bomberman',
          onDemand: true,
          room: 'auto',
          // The server broadcasts itself on socket 0x6446 for the joiners'
          // list and a joiner never broadcasts there, so watching for that
          // is how the shell knows to offer this room to others. The
          // announce carries the server's name at +18 ("Bombs Ahoy").
          hostProbe: { protocol: 'announce', port: 0x6446, label: '^[\\s\\S]{18}([^\\x00]+)' },
          hint: 'One of you picks “Start Network Game”, the other '
            + '“Join Network Game” and picks the server from the list; '
            + 'the server presses Enter to start.',
        },
        // Held, not pulsed: the game polls key state in its menus and its
        // arena alike, so the pad's default 1 ms down/up pulse lands between
        // two polls and is never seen.
        touchControls: {
          dpad: { pos: 'bl', ways: 4, style: 'cross', hold: true },
          buttons: [
            { vk: 0x20, label: 'Bomb', pos: 'br' },
            // Only Esc skips the publisher logos and backs out of a submenu.
            { vk: 0x1B, label: 'Esc', pos: 'tl' },
          ],
        },
      },
      broken_sword_demo: {
        exe: brokenSwordRoot + 'winsword.exe',
        dlls: [brokenSwordRoot + 'smackw32.dll'],
        files: [],
        localFileManifest: brokenSwordRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 12,
        // Mouse-driven gameplay needs no synthetic buttons. Declaring the
        // empty layout still exposes the mobile keyboard and Fit/Fill chrome.
        touchControls: {},
      },
      // presentCap: 60. Measured 2026-09-28 on its intro only: this tree
      // stops on a black screen after the Bullfrog logo and never reaches
      // the main menu (test-dungeon-keeper-gameplay.js fails there too), so
      // gameplay is unmeasured. The intro presented ~6,000/s in headless
      // Chrome (63,868 presents against 193 capped) with 0.7 new pictures
      // per guest second, and it is clock-paced: on the 100 ms/batch CLI
      // clock vortex -> logo -> black happen at the same guest time in both
      // arms (3-4 s and 9-10 s).
      dungeon_keeper_demo: {
        presentCap: 60,
        exe: dungeonKeeperRoot + 'KEEPER95.EXE',
        dlls: [
          dungeonKeeperRoot + 'MSS32.DLL',
          dungeonKeeperRoot + 'WSND7R.DLL',
          dungeonKeeperRoot + 'SMACKW32.DLL',
        ],
        files: [],
        localFileManifest: dungeonKeeperRoot +
          '.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 12,
      },
      // Populous: The Beginning demo (Bullfrog 1998), archive.org POPULOUS.
      // The WinZip SFX holds the InstallShield setup and the game tree side by
      // side; the game only needs the keys setup writes: InstallDrive (first
      // letter used) and InstallDirectory (a leading slash is stripped).
      populous_tb_demo: {
        exe: populousTbRoot + 'popTBDemo.exe',
        dlls: [populousTbRoot + 'WEANETR.dll', populousTbRoot + 'QMixer.dll'],
        files: [],
        localFileManifest:
          'test/binaries/candidates/populous-the-beginning-demo/.wine-assembly-browser.json',
        startupRegistry: [
          ['InstallDrive', 'C:'], ['InstallDirectory', '\\'],
        ].map(([valueName, data]) => ({
          keyPath: 'HKLM\\SOFTWARE\\Bullfrog Productions Ltd\\Populous: The Beginning (Demo)',
          valueName, type: 1, data,
        })),
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // Anno 1602 demo (Max Design/Sunflowers 1998), software DirectDraw.
      anno1602_demo: {
        exe: anno1602Root + '1602.exe',
        dlls: ['Maxnet.dll', 'Maxsound.dll', 'Language.dll'].map(n => anno1602Root + n),
        files: [],
        localFileManifest: anno1602Root + '.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // Driver demo (Reflections/GT Interactive 1999), Direct3D 3 (DX6).
      driver_demo: {
        exe: driverDemoRoot + 'game.exe',
        files: [],
        localFileManifest: driverDemoRoot + '.wine-assembly-browser.json',
        workingDirectory: 'c:\\program files\\gt interactive\\driver demo',
        exeGuestPath: 'c:\\program files\\gt interactive\\driver demo\\game.exe',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // Colin McRae Rally 2.0 demo (Codemasters 2000), Direct3D 7. The game
      // finds its data through the paths its setup script records.
      cmr2_demo: {
        exe: cmr2DemoRoot + 'CMR2Demo.exe',
        files: [],
        localFileManifest: cmr2DemoRoot + '.wine-assembly-browser.json',
        workingDirectory: 'c:\\cmr2demo',
        exeGuestPath: 'c:\\cmr2demo\\CMR2Demo.exe',
        // Setup writes all four; without Sku_Type and Install_Version the
        // game logs "Program finished normally" and quits before its window.
        // "Full" (not "Minimum") reads Game\\Tracks and Cars from Game_HDPath.
        startupRegistry: [
          ['Game_HDPath', 'c:\\cmr2demo'], ['Game_CDPath', 'c:\\cmr2demo'],
          ['Install_Version', 'Full'], ['Sku_Type', 'EUROPE'],
        ].map(([valueName, data]) => ({
          keyPath: 'HKLM\\Software\\Codemasters\\Colin McRae Rally 2',
          valueName, type: 1, data,
        })),
        requiredFiles: true,
        fileConcurrency: 10,
      },
      darkstone_demo: {
        exe: darkstoneRoot + 'darkstonedemo.exe',
        files: [],
        localFileManifest: darkstoneRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // Westwood's 1997 Win95 demo. Mouse coordinates are the game's own
      // 640x400 mode: the menu buttons sit 40px above where the letterboxed
      // screen shows them (GetCursorPos is not letterbox-corrected).
      red_alert_95_demo: {
        exe: redAlert95DemoRoot + 'RA95.EXE',
        files: [],
        localFileManifest: redAlert95DemoRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
      },
      // Treyarch's 1998 demo. Pick "Do Not Use 3D Hardware" in its startup
      // dialog for the software renderer. Menus and play read the keyboard
      // through DirectInput: arrows/Enter in menus, W walks, the keypad
      // swings the sword (arrows move the sword arm, not the player).
      die_by_the_sword_demo: {
        exe: dieByTheSwordDemoRoot + 'dbts_demo.exe',
        // Rlapi.dll is a static import; it imports SIMFORCE.dll in turn.
        dlls: [dieByTheSwordDemoRoot + 'rlapi.dll', dieByTheSwordDemoRoot + 'SIMFORCE.dll'],
        files: [],
        localFileManifest: dieByTheSwordDemoRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
      },
      // Cryo's 1997 demo, run from its directory (Watcom, DirectDraw 640x480,
      // MSS audio). The map menu's floating panels are buttons: the ship
      // starts the demo scene; Escape quits. In a scene the view turns while
      // the mouse rests against a screen edge.
      atlantis_demo: {
        exe: atlantisDemoRoot + 'ATLANTIS.EXE',
        dlls: [atlantisDemoRoot + 'MSS32.DLL'],
        files: [],
        localFileManifest: atlantisDemoRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // Firaxis' 1999 100-turn demo. The WinZip self-extractor carries a
      // ready-to-run programs\ directory beside its InstallShield cabs, so it
      // runs from there (docs/re-notes/alpha-centauri-demo.md). Its dialogs
      // are laid out for an 800x600+ desktop: on the CLI pass --screen=1024x768.
      // Quick Start lands a random faction; numpad keys move the active unit.
      alpha_centauri_demo: {
        exe: alphaCentauriDemoRoot + 'terran.exe',
        files: [],
        localFileManifest: alphaCentauriDemoRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // Volition's 1998 four-mission demo, installed by its own InstallShield
      // 5 setup in the emulator to C:\Games\FreeSpaceDemo. fs.exe is the game;
      // freespace.exe beside it is the launcher/configurator. At startup it
      // warns that the Microsoft ADPCM codec is missing (no ACM codecs here)
      // and asks whether to go on: Yes (dlg-cmd:6) plays without that audio.
      // Software renderer; T targets, the mouse flies the ship.
      freespace_demo: {
        exe: freespaceDemoRoot + 'fs.exe',
        files: [],
        localFileManifest: freespaceDemoRoot + '.wine-assembly-browser.json',
        workingDirectory: 'c:\\games\\freespacedemo',
        exeGuestPath: 'c:\\games\\freespacedemo\\fs.exe',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // Kalisto/MicroProse 1997 demo. Its InstallShield 3 setup, run in the
      // emulator from the CD image, put the program in C:\DARKDEMO; the game
      // data stays on the CD, which must be D: ("Fatal error 4" without it).
      // Space or Enter (typed keys: WM_CHAR) leave the controls page and the
      // monitor settings; NEW starts; arrow keys move Arkhan.
      dark_earth_demo: {
        exe: darkEarthDemoRoot + 'installed/dkedemo.exe',
        files: [],
        localFileManifest: darkEarthDemoRoot + 'installed/.wine-assembly-browser.json',
        workingDirectory: 'c:\\darkdemo',
        exeGuestPath: 'c:\\darkdemo\\dkedemo.exe',
        cdAudio: {
          // The disc's own cue spells the image in upper case; this one
          // matches the file on a case-sensitive host.
          cue: darkEarthDemoRoot + 'dark-earth.cue',
          drive: 'D',
          volumeLabel: 'DARKEARTH',
        },
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // 3DO 1999 action-RPG. At boot it asks "Use This DLL?" for gfx_d3d.dll,
      // then gfx_sw.dll; No then Yes picks the software renderer (the route the
      // gameplay evidence used). Its level files are memory images with pointers
      // relocated to fixed pools at 0x04000000/0x05000000/0x06000000/0x08000000,
      // which exist only because 00-regions.wat leaves $GUEST_FIXED_POOL_* holes
      // there (docs/re-notes/crusaders-mm-demo.md).
      crusaders_mm_demo: {
        exe: win98GamesADRoot + 'Crusaders MM demo-D3D/installed/crusaders demo.exe',
        files: [],
        localFileManifest: win98GamesADRoot + 'Crusaders MM demo-D3D/installed/.wine-assembly-browser.json',
        workingDirectory: 'c:\\program files\\3do\\crusaders of might and magic demo',
        exeGuestPath: 'c:\\program files\\3do\\crusaders of might and magic demo\\crusaders demo.exe',
        requiredFiles: true,
      },
      descent3_demo: {
        exe: descent3DemoRoot + 'main.exe',
        // main.exe links the demo's Soar AI stub statically (every export is
        // `xor eax,eax; ret`); unbound, the first SoarInit at level load traps.
        dlls: [descent3DemoRoot + 'soar.dll'],
        files: [],
        localFileManifest: descent3DemoRoot + '.wine-assembly-browser.json',
        workingDirectory: 'c:\\games\\descent3demo',
        exeGuestPath: 'c:\\games\\descent3demo\\main.exe',
        // main.exe refuses to start unless "Descent 3 Demo.exe" (the
        // launcher) ran it, which it signals with -launched.
        args: '-launched',
        startupRegistry: [
          // The launcher's setup records the renderer; without it the game
          // stops with "Generic renderer error". 2 = RENDERER_OPENGL.
          { keyPath: 'HKLM\\SOFTWARE\\Outrage\\Descent3Demo',
            valueName: 'PreferredRenderer', type: 4, data: 2 },
        ],
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // Ion Storm/Eidos 2001 role-playing game on a Quake II engine, OpenGL only
      // (ref_gl.dll; headless needs --gl-renderer=software). Unpacked from its
      // InstallShield 6 cabinets (tools/gen-win98-games-a-d-manifests.js;
      // docs/re-notes/anachronox-demo.md). The args are anox_640gl.bat's.
      anachronox_demo: {
        exe: anachronoxDemoRoot + 'anox.exe',
        dlls: ['anoxgfx.dll', 'gamex86.dll', 'MSVCRT.DLL'].map(d => anachronoxDemoRoot + d),
        files: [],
        localFileManifest: anachronoxDemoRoot + '.wine-assembly-browser.json',
        workingDirectory: 'c:\\anoxdemo',
        exeGuestPath: 'c:\\anoxdemo\\anox.exe',
        // The menu and dialogue cursor is Quake II's recentring mouse
        // (GetCursorPos + SetCursorPos to the centre each frame). Absolute page
        // positions read as distance-from-centre every frame and pin it to a
        // corner, so menus and dialogue lines never take a click.
        relativeMouse: true,
        args: '+set gl_driver opengl32 +set u_gl_mode 3 +set u_vid_fullscreen 1 +set gl_mode 3 +set vid_fullscreen 1',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // Ion Storm/Eidos 2000 first-person shooter on a Quake II engine, OpenGL
      // only (ref_gl.dll; headless needs --gl-renderer=software). Installed
      // headlessly from its InstallShield 5 Disk1 (re-notes daikatana-demo.md).
      // Miles (mss32.dll) maps ~30 providers before dlls\physics.dll, which is
      // why the DLL table is 64 slots. A headless level load at the default
      // 200 ms/batch clock takes ~1 guest hour of registration; use
      // --tick-ms-per-batch=5.
      daikatana_demo: {
        exe: daikatanaDemoRoot + 'daikatana.exe',
        dlls: [daikatanaDemoRoot + 'mss32.dll'],
        files: [],
        localFileManifest: daikatanaDemoRoot + '.wine-assembly-browser.json',
        workingDirectory: 'c:\\program files\\eidos interactive\\daikatana demo',
        exeGuestPath: 'c:\\program files\\eidos interactive\\daikatana demo\\daikatana.exe',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // Silmarils/Grolier 1998 3D action-adventure, the software renderer
      // (_start.exe; _st_dx3d.exe and _st_3dfx.exe are the D3D and Glide
      // builds). The WinRAR SFX was unpacked host-side, then its own
      // installer and setup ran in the emulator into C:\ASGHAN.DEM (re-notes
      // asghan-demo.md); _start.stp is that setup's saved choice. Its Borland
      // RTL keeps file handles as WORDs (VFS 16-bit alias, 636ffe63). Enter
      // leaves the title, Enter on NEW GAME starts the level; Up runs.
      asghan_demo: {
        exe: asghanDemoRoot + '_start.exe',
        dlls: ['cw3220.dll', 'smackw32.dll'].map(d => asghanDemoRoot + d.toUpperCase()),
        files: [],
        localFileManifest: asghanDemoRoot + '.wine-assembly-browser.json',
        workingDirectory: 'c:\\asghan.dem',
        exeGuestPath: 'c:\\asghan.dem\\_start.exe',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // NovaLogic's 1998 software-renderer demo. Its InstallShield 5 SETUP.EXE
      // installed this tree in the emulator. In-game it runs a fixed-timestep
      // simulation: under the CLI's default 200 ms/batch clock one step costs
      // about a batch, so it never catches up and never draws a frame -- give
      // the headless run a small tick once the mission loads (re-notes).
      delta_force_demo: {
        exe: deltaForceDemoRoot + 'dfdemo.exe',
        dlls: [deltaForceDemoRoot + 'netsock.dll'],
        // The game reads its data pack beside the exe.
        files: ['df.pff', 'df.cd'].map(name => ({ url: deltaForceDemoRoot + name, vfsPath: 'c:\\dfdemo\\' + name })),
        workingDirectory: 'c:\\dfdemo',
        exeGuestPath: 'c:\\dfdemo\\dfdemo.exe',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // NovaLogic 1998 software voxel helicopter sim (docs/re-notes/
      // comanche-gold-demo.md). Its 33 ms timeSetEvent thread races main's
      // startup: the 4th tick runs a generated sound mixer that main patches
      // only after ~0.7M blocks of initialisation (patch at batch 7 of
      // 100k), which a Pentium finishes first and this interpreter does not. startupClock slows the guest
      // clock until the first DirectDraw present, then gameplay runs at real
      // speed. (The window is shown before the timer is even armed.)
      comanche_gold_demo: {
        exe: comancheGoldDemoRoot + 'demo.exe',
        dlls: [comancheGoldDemoRoot + 'msvcrt.dll', comancheGoldDemoRoot + 'netsock.dll'],
        files: ['cgold.pff', 'c3.nam', 'c3.sav', 'setup.cd', 'wsetup.cfg']
          .map(name => ({ url: comancheGoldDemoRoot + name, vfsPath: comancheGoldDemoDir + name })),
        workingDirectory: comancheGoldDemoDir.slice(0, -1),
        exeGuestPath: comancheGoldDemoDir + 'demo.exe',
        startupClock: { factor: 0.01, maxMs: 30000, endOn: 'firstPresent:directdraw' },
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // Red Lemon/Eidos 1999 strategy/tactics, the software-renderer build
      // (bhsoft.exe) of a demo that also ships Glide and Direct3D exes. The
      // InstallShield 5 Disk1 was installed headlessly
      // (tools/gen-win98-games-a-d-manifests.js; docs/re-notes/braveheart-demo.md).
      braveheart_demo: {
        exe: braveheartDemoRoot + 'bhsoft.exe',
        dlls: ['mss32.dll', 'winplay.dll', 'winstr.dll', 'winsdec.dll', 'dec130.dll', 'edec.dll']
          .map(d => braveheartDemoRoot + d),
        files: [],
        localFileManifest: braveheartDemoRoot + '.wine-assembly-browser.json',
        workingDirectory: 'c:\\program files\\red lemon studios\\braveheart covermount demo',
        exeGuestPath: 'c:\\program files\\red lemon studios\\braveheart covermount demo\\bhsoft.exe',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // Original installed payload and installer path seeds; local route only.
      croc2_demo: {
        "exe": "binaries/win98-games-a-d/Croc2 demo-SW/installed/croc2.exe",
        "dlls": [
          "binaries/win98-games-a-d/Croc2 demo-SW/installed/ads.dll"
        ],
        "files": [],
        "localFileManifest": "binaries/win98-games-a-d/Croc2 demo-SW/installed/.wine-assembly-browser.json",
        "workingDirectory": "c:\\program files\\fox\\croc 2 demo",
        "exeGuestPath": "c:\\program files\\fox\\croc 2 demo\\croc2.exe",
        "startupRegistry": [
          {
            "keyPath": "HKLM\\Software\\Argonaut Software\\Croc2Demo\\1.00",
            "valueName": "InstallPath",
            "type": 1,
            "data": "C:\\Program Files\\Fox\\Croc 2 Demo\\"
          },
          {
            "keyPath": "HKLM\\Software\\Argonaut Software\\Croc2Demo\\1.00",
            "valueName": "CDPath",
            "type": 1,
            "data": "C:\\Program Files\\Fox\\Croc 2 Demo\\"
          }
        ],
        "requiredFiles": true,
        "fileConcurrency": 10
      },
      // Original Wise-installed demo; local experimental route only.
      diehard_nakatomi_demo: {
        exe: diehardDemoRoot + 'lithtech.exe',
        dlls: ['binaries/dlls/msvcrt.dll', 'binaries/dlls/msvcp60.dll', diehardDemoRoot + 'mss32.dll', diehardDemoRoot + 'soundmax.dll'],
        files: [],
        localFileManifest: diehardDemoRoot + '.wine-assembly-browser.json',
        workingDirectory: 'c:\\program files\\fox\\die hard nakatomi plaza demo',
        exeGuestPath: 'c:\\program files\\fox\\die hard nakatomi plaza demo\\lithtech.exe',
        args: '-rez engine.rez -rez nakatomi.rez',
        requiredFiles: true,
        fileConcurrency: 4,
      },
      // Surreal/Psygnosis 1999 action-adventure, Direct3D 6 (DX6 HAL). The
      // InstallShield 5 Disk1 was installed headlessly
      // (tools/gen-win98-games-a-d-manifests.js; docs/re-notes/drakan-demo.md).
      // dragon.rfl is the game logic DLL; the engine LoadLibrary()s it.
      drakan_demo: {
        exe: drakanDemoRoot + 'drakan.exe',
        files: [],
        localFileManifest: drakanDemoRoot + '.wine-assembly-browser.json',
        workingDirectory: 'c:\\program files\\psygnosis\\drakan demo',
        exeGuestPath: 'c:\\program files\\psygnosis\\drakan demo\\drakan.exe',
        startupRegistry: [
          // What the first-run "Riot Engine Options" sheet writes on OK:
          // primary display driver, 640x480x16, dithering, shadows, bilinear,
          // full texture quality. Without it every launch opens that sheet.
          { keyPath: 'HKLM\\SOFTWARE\\Surreal\\Riot Engine', valueName: 'Settings100', type: 3,
            data: [0,1,0,0,0,0,0,0,47,4,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,30,0,0,0,128,2,0,0,224,1,0,0,16,0,0,0,0,0,0,0,1,0,0,0,3,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,7,0,0,0,142,0,0,0,33,0,0,0] },
        ],
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // Rebellion's 1999 Direct3D Alien demo, extracted from its RAR
      // self-extractor (tools/gen-win98-games-a-d-manifests.js). Enter starts
      // the demo from the main menu; the arrow keys move and turn.
      avp_alien_demo: {
        exe: avpAlienDemoRoot + 'avp_alien_demo.exe',
        dlls: [avpAlienDemoRoot + 'smackw32.dll'],
        files: [],
        localFileManifest: avpAlienDemoRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // The Marine demo of the same engine, an installed tree beside its
      // InstallShield media (the manifest ships only what the game opens).
      // Enter starts the demo; the arrow keys move and the numpad turns.
      avp_marine_demo: {
        exe: avpMarineDemoRoot + 'AvP_Marine_Demo.exe',
        dlls: [avpMarineDemoRoot + 'SMACKW32.DLL'],
        files: [],
        localFileManifest: avpMarineDemoRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // SCi/Stainless 1998 BRender demo, installed by its own InstallShield 3
      // setup run in the emulator (tools/gen-win98-games-a-d-manifests.js).
      // carma2_d3d.exe is the Direct3D build the carma2.exe launcher picks;
      // the race starts by itself after the controls screen. Keypad 8
      // accelerates, keypad 2 brakes, keypad 4/6 steer.
      carmageddon2_demo: {
        exe: carmageddon2DemoRoot + 'carma2_d3d.exe',
        dlls: [carmageddon2DemoRoot + 'smackw32.dll'],
        files: [],
        localFileManifest: carmageddon2DemoRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // Codemasters' 1998 CD demo, run from SETUP\ as its autorun does. The
      // game finds its data through HKLM\SOFTWARE\Codemasters\Rally\1.00
      // CDPath (its setup writes the CD drive there); without it every path
      // starts at the compiled-in "Q:\Game".
      colin_mcrae_rally_demo: {
        exe: colinMcRaeDemoRoot + 'GAME.EXE',
        dlls: [colinMcRaeDemoRoot + 'QMIXER.DLL'],
        files: [],
        localFileManifest: colinMcRaeDemoRoot + '.wine-assembly-browser.json',
        startupRegistry: [
          { keyPath: 'HKLM\\Software\\Codemasters\\Rally\\1.00',
            valueName: 'CDPath', type: 1, data: 'C:' },
          { keyPath: 'HKLM\\Software\\Codemasters\\Rally\\1.00',
            valueName: 'Language', type: 1, data: 'ENGLISH' },
        ],
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // Activision's 1997 RTS demo, from the uncompressed DATA\ tree its setup
      // copies. The mouse is DirectInput buffered (GetDeviceData) and the game
      // draws its own cursor, which moves by relative deltas. Single Player ->
      // Training 2; Escape closes the briefing. nullPageFaults: its debug
      // allocator walks the EBP chain to record a call stack and stops only
      // when reading the outermost frame faults into its __except, as on Win98.
      dark_reign_demo: {
        exe: darkReignDemoRoot + 'DKReign.exe',
        dlls: ['ANET2.DLL', 'MSS32.DLL', 'SMACKW32.DLL', 'WINET2.DLL']
          .map(name => darkReignDemoRoot + name),
        files: [],
        localFileManifest: darkReignDemoRoot + '.wine-assembly-browser.json',
        nullPageFaults: true,
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // SSI/Gametek's May 1997 magazine demo, run unpacked from its directory.
      // The mouse is DirectInput relative (GetDeviceState) with the game's
      // own cursor starting at (0,0). Space builds the selected unit; arrow
      // keys scroll the map.
      dark_colony_demo: {
        exe: darkColonyDemoRoot + 'dc.exe',
        files: [],
        localFileManifest: darkColonyDemoRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // Sega's 1997 Win95 demo, laid out as its Setup installs it (GAME\ plus
      // DOC\English\ in one directory). Keyboard is DirectInput: Enter starts,
      // X is gas, Z brake, arrows steer (Up/Down shift).
      daytona_usa_deluxe_demo: {
        exe: daytonaDemoRoot + 'DAYTONA USA Deluxe Demo WWW.exe',
        dlls: ['ddse.dll', 'dpctrl.dll', 'DXERROR.dll', 'Resource.dll', 'WINCPUID.DLL']
          .map(name => daytonaDemoRoot + name),
        files: [],
        localFileManifest: daytonaDemoRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // Monolith's 1998 LithTech demo, run from its unpacked Game directory
      // with the command line its B2Demo.exe launcher builds for CLIENT.EXE.
      // Direct3D through d3d.ren. The keyboard is DirectInput with an
      // application-defined data format: Enter through the menus, arrows move
      // and turn, Ctrl fires.
      blood2_demo: {
        exe: blood2DemoRoot + 'Client.exe',
        // Mouse-look is the DirectInput mouse (defaults.cfg: enabledevice
        // "##Mouse", X/Y-axis -> Axis1/Axis2, MouseLook 1). Absolute page input
        // stops turning when the host pointer reaches the page edge, so capture
        // it: Pointer Lock on the desktop, the virtual trackpad on a phone.
        relativeMouse: true,
        mobileTouch: 'trackpad',
        args: '-rez B2Demo.rez -windowtitle "Blood2 Demo" -config defaults.cfg',
        files: [],
        localFileManifest: blood2DemoRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // Strategy First's 1999 demo, installed by its own Wise setup in the
      // emulator. disciple.ini names every data directory under
      // C:\Program Files\Disciples Demo, so the tree mounts back there.
      disciples_demo: {
        exe: disciplesDemoRoot + 'exe/discipdm.exe',
        dlls: ['shw32.dll', 'c4dll-r.dll', 'mss32.dll', 'smackw32.dll', 'msvcrt.dll']
          .map(name => disciplesDemoRoot + 'exe/' + name),
        files: [],
        localFileManifest: disciplesDemoRoot + '.wine-assembly-browser.json',
        workingDirectory: 'c:\\program files\\disciples demo\\exe',
        // The game derives its install root from its own module path, which
        // must therefore be the installed one, not C:\discipdm.exe.
        exeGuestPath: 'c:\\program files\\disciples demo\\exe\\discipdm.exe',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      return_fire_demo: {
        desktopColorDepth: 8, // Original demo requires a real indexed desktop.
        exe: 'test/binaries/candidates/return-fire-demo/RFIRE/DEMO.EXE',
        files: [],
        localFileManifest: 'test/binaries/candidates/return-fire-demo/.wine-assembly-browser.json',
        requiredFiles: true,
      },
      baldurs_gate2_demo: {
        exe: 'test/binaries/candidates/baldurs-gate2-demo/BGMain.exe',
        files: [],
        localFileManifest: 'test/binaries/candidates/baldurs-gate2-demo/.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 10,
        persistFiles: ['c:\\characters\\*.chr', 'c:\\characters\\*.res', 'c:\\save\\*', 'c:\\mpsave\\*'],
        windowlessGraceMs: 120000,
      },
      // Original playable demo. New Quest is available; New Saga is demo-disabled.
      // Files are installed unmodified by the original Wise setup.
      disciples2_demo: {
        exe: 'test/binaries/candidates/disciples2-demo/installed/discipl2.exe',
        dlls: ['shw32.dll', 'c4dll-r.dll', 'msvcrt.dll', 'mss32.dll', 'binkw32.dll']
          .map(name => 'test/binaries/candidates/disciples2-demo/installed/' + name),
        files: [],
        localFileManifest: 'test/binaries/candidates/disciples2-demo/.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // Pyro's 1998 playable demo (two missions), software DirectDraw at
      // 640x480. The WinZip self-extractor holds the installed tree, so it is
      // unzipped as is (see tools/gen-win98-games-a-d-manifests.js). Any key
      // leaves the welcome screen; the mouse drives the menus, a portrait
      // selects a commando and a left click on the ground walks him there.
      commandos_demo: {
        exe: commandosDemoRoot + 'Comandos.exe',
        dlls: [commandosDemoRoot + 'MSS32.DLL'],
        files: [],
        localFileManifest: commandosDemoRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // Triumph Studios' 1999 beta demo (tutorial + "The First Conflict"),
      // installed by its own InstallShield setup in the emulator. A Delphi 3
      // app built with runtime packages: aow.exe and every .dpl import each
      // other, so all of them are seeded in dependency order (VCL30 first).
      // Its image library masks heap pointers to 28 bits, which a Win98 heap
      // never exceeds; virtualAllocTop keeps our VirtualAlloc arena there too.
      // Mouse only: an orb picks the mode, click a party to select it, click
      // a hex to plot the path and click it again to move.
      age_of_wonders_demo: {
        exe: ageOfWondersDemoRoot + 'aow.exe',
        dlls: ['vcl30', 'vclx30', 'vcldb30', 'vcladdon', 'gfxepack', 'ilpack', 'dcpack',
          'enginep', 'soundp', 'network', 'localize', 'hsepack', 'aowepack', 'aowint',
          'aowtools', 'aowtcpck', 'aowdplay', 'ims', 'videop']
          .map(name => ageOfWondersDemoRoot + name + '.dpl'),
        files: [],
        localFileManifest: ageOfWondersDemoRoot + '.wine-assembly-browser.json',
        workingDirectory: 'c:\\program files\\triumph studios\\age of wonders beta demo',
        exeGuestPath: 'c:\\program files\\triumph studios\\age of wonders beta demo\\aow.exe',
        virtualAllocTop: 0x10000000,
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // Original 2002 beta demo ZIP payload, extracted without changing files.
      // Explicit Borland packages are required for their mutually imported IATs.
      age_of_wonders2_demo: {
        exe: ageOfWonders2DemoRoot + 'AoW2.exe',
        dlls: ['vcl50.bpl', 'vclx50.bpl', 'Ml42ND50.bpl']
          .map(name => ageOfWonders2DemoRoot + name),
        files: [],
        localFileManifest: ageOfWonders2DemoRoot + '.wine-assembly-browser.json',
        workingDirectory: 'c:\\aow2demo',
        exeGuestPath: 'c:\\aow2demo\\AoW2.exe',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      // Unmodified original CAB payload. Extraction is not Windows installation.
      dungeon_siege_demo: {
        exe: dungeonSiegeDemoRoot + 'DungeonSiegeDemo.exe',
        dlls: ['BinkW32.dll', 'Mss32.dll'].map(name => dungeonSiegeDemoRoot + name),
        files: [],
        localFileManifest: dungeonSiegeDemoRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 6,
      },
      nfs2_demo: {
        exe: 'test/binaries/candidates/need-for-speed-2-demo/game/nfsw.exe',
        // Neither NFS II executable carries an icon resource; EA shipped the
        // icons as loose .ico files on the retail CDs. See icons/sources/README.md.
        iconFile: 'icons/sources/nfs2.ico',
        files: [],
        localFileManifest: 'test/binaries/candidates/need-for-speed-2-demo/.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 10,
        touchControls: nfsTouchControls(),
        perf: {
          // The race's per-frame render step, entered on the game's worker
          // thread (T2): 0x443bb1 runs the race session once and calls this
          // from its loop at 0x444052, the only call site. It presents once
          // through 0x43f0af (474 steps vs 473 presents in a counted race).
          // Found with --trace-stack-scan; nfsw.exe has no frame pointers.
          logicalFrame: {
            label: 'GAME',
            address: 0x0043f116,
            verifier: 0x00444057,
          },
        },
      },
      nfs2se_glide_demo: {
        exe: 'build/nfs2se-demo/NFS2SEA.EXE',
        iconFile: 'icons/sources/nfs2sea.ico',
        files: [],
        localFileManifest: 'build/nfs2se-browser.json',
        environment: { THRASH_DRIVER: '1' },
        requiredFiles: true,
        fileConcurrency: 10,
        touchControls: nfsTouchControls(),
      },
      nfs3_glide_demo: {
        exe: 'test/binaries/candidates/need-for-speed-3-demo/game/nfs3demo.exe',
        files: [],
        localFileManifest: 'test/binaries/candidates/need-for-speed-3-demo/.wine-assembly-browser.json',
        startupRegistry: [
          { keyPath: 'HKLM\\Software\\Electronic Arts\\Need For Speed III Demo',
            valueName: 'Thrash Driver', type: 1, data: 'voodoo' },
          { keyPath: 'HKLM\\Software\\Electronic Arts\\Need For Speed III Demo',
            valueName: 'D3D Device', type: 4, data: 0 },
        ],
        requiredFiles: true,
        fileConcurrency: 10,
        touchControls: nfsTouchControls(),
      },
      nfs3_demo: {
        exe: 'test/binaries/candidates/need-for-speed-3-demo/game/nfs3demo.exe',
        files: [],
        localFileManifest: 'test/binaries/candidates/need-for-speed-3-demo/.wine-assembly-browser.json',
        // Glide, not the default software renderer (5.9/8.1 fps against
        // Glide's 22.6/22.3, 2026-09-30, docs/nfs-renderer-benchmark.md).
        // Direct3D is level with Glide but draws a black horizontal line
        // across the middle of the race view (2026-10-05), so it waits for
        // that fix; tools/nfs-renderer-bench.js --cases=d3d still reaches it.
        startupRegistry: [
          { keyPath: 'HKLM\\Software\\Electronic Arts\\Need For Speed III Demo',
            valueName: 'Thrash Driver', type: 1, data: 'voodoo' },
          { keyPath: 'HKLM\\Software\\Electronic Arts\\Need For Speed III Demo',
            valueName: 'D3D Device', type: 4, data: 0 },
        ],
        requiredFiles: true,
        fileConcurrency: 10,
        touchControls: nfsTouchControls(),
      },
      deus_ex_demo: {
        relativeMouse: true,
        exe: deusExDemoRoot + 'system/deusex.exe',
        dlls: deusExDemoDlls,
        files: deusExDemoFiles,
        requiredFiles: true,
        fileConcurrency: 10,
        // Native package initialization and the software viewport both happen
        // before the first top-level frame is useful.
        windowlessGraceMs: 120000,
        mobileTouch: 'trackpad',
        touchControls: {
          dpad: { pos: 'bl', ways: 8,
            vks: { up: 0x57, down: 0x53, left: 0x41, right: 0x44 } },
          buttons: [
            { vk: 0x20, label: 'Jump', pos: 'br' },
            { vk: 0x49, label: 'Inventory', pos: 'br', row: 1 },
            { vk: 0x58, label: 'Crouch', pos: 'br', row: 2 },
          ],
        },
      },
      unreal_special_demo: {
        relativeMouse: true,
        exe: unrealSpecialDemoRoot + 'system/unreal.exe',
        dlls: ['core.dll', 'engine.dll', 'window.dll', 'msvcrt.dll']
          .map(name => unrealSpecialDemoRoot + 'system/' + name),
        files: [],
        localFileManifest: unrealSpecialDemoRoot +
          '.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 12,
        args: '-window',
        windowlessGraceMs: 300000,
      },
      // First run opens the setup wizard. Its 3D-device probe ShellExecutes
      // a second copy (testrendev=D3DDrv...), polls 100 x Sleep(100) for its
      // Detected.ini and then carries on; Next three times reaches the UWindow
      // menu on the INI's SoftDrv. The manifest (tools/gen-tree-manifest.js
      // --flatten=System) mounts System\ at both c:\ and c:\System\: the game
      // opens its INI beside the exe and packages through ..\System.
      ut348_demo: {
        relativeMouse: true,
        exe: ut348DemoRoot + 'System/UnrealTournament.exe',
        dlls: ['Core.dll', 'Engine.dll', 'Window.dll', 'MSVCRT.dll']
          .map(name => ut348DemoRoot + 'System/' + name),
        files: [],
        localFileManifest: ut348DemoRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 12,
        args: '-window',
      },
      ut2003_demo: {
        relativeMouse: true,
        // Authentic Antalus startup advances ~21% farther in a fixed 140s
        // window with the semantic x87 pipeline/island folds enabled.
        x87Fusion: true,
        cpuSSE: true,
        exe: ut2003DemoRoot + 'system/ut2003.exe',
        dlls: ['core.dll', 'engine.dll', 'window.dll', 'msvcr70.dll', 'ifc23.dll']
          .map(name => ut2003DemoRoot + 'system/' + name),
        files: [],
        localFileManifest: ut2003DemoRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 12,
        args: '-d3d -window -nosound',
        windowlessGraceMs: 300000,
        // Same as ut2003_demo_server: without a GPU the client spins on
        // CreateDevice ("D3D9 requires a GPU window" ~500k times in 220 s).
        d3d9WithoutGpu: 'software',
      },
      // Listen server from the same authentic demo install. The standalone
      // UCC commandlet currently stalls before Winsock during class discovery;
      // ut2003.exe reaches the real IpDrv UDP path with this direct map URL.
      ut2003_demo_server: {
        relativeMouse: true,
        cpuSSE: true,
        exe: ut2003DemoRoot + 'system/ut2003.exe',
        dlls: ['core.dll', 'engine.dll', 'window.dll', 'msvcr70.dll', 'ifc23.dll']
          .map(name => ut2003DemoRoot + 'system/' + name),
        files: [],
        localFileManifest: ut2003DemoRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 12,
        args: 'DM-Antalus?game=XGame.XDeathmatch?listen -d3d -window -nosound',
        windowlessGraceMs: 300000,
        // No no-3D path: a GPU-less CLI run must get the software D3D9 backend
        // (test/run.js), or every CreateDevice retry leaks a thread into OOM.
        d3d9WithoutGpu: 'software',
      },
      ut2004_demo: {
        relativeMouse: true,
        exe: ut2004DemoRoot + 'system/ut2004.exe',
        dlls: ['core.dll', 'engine.dll', 'window.dll', 'msvcr71.dll']
          .map(name => ut2004DemoRoot + 'system/' + name),
        files: [],
        localFileManifest: ut2004DemoRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 12,
        // OpenGLDrv aborts on 298 GL names our GetProcAddress lacks; the D3D8
        // renderer reaches gameplay (docs/re-notes/unreal-family-demos.md).
        args: '-d3d -window -nosound',
        windowlessGraceMs: 300000,
      },
      icewind_dale_demo: {
        exe: icewindDaleDemoRoot + 'IDDemo.exe',
        files: icewindDaleDemoFiles,
        requiredFiles: true,
        fileConcurrency: 10,
        persistFiles: [
          'c:\\characters\\*.chr', 'c:\\characters\\*.res',
          'c:\\save\\*', 'c:\\mpsave\\*',
        ],
        windowlessGraceMs: 60000,
      },
      baldurs_gate_noninteractive_demo: {
        exe: baldursGateNoninteractiveRoot + 'Baldur.exe',
        files: baldursGateNoninteractiveFiles,
        requiredFiles: true,
        fileConcurrency: 10,
        windowlessGraceMs: 60000,
      },
      baldurs_gate_interactive_demo: {
        exe: baldursGateInteractiveRoot + 'BGDemo.exe',
        files: baldursGateInteractiveFiles,
        requiredFiles: true,
        fileConcurrency: 10,
        persistFiles: [
          'c:\\characters\\*.chr', 'c:\\characters\\*.res',
          'c:\\save\\*', 'c:\\mpsave\\*',
        ],
        windowlessGraceMs: 120000,
      },
      baldurs_gate_chapters_1_2_demo: {
        exe: baldursGateChaptersRoot + 'BGMain.exe',
        files: baldursGateChaptersFiles,
        requiredFiles: true,
        fileConcurrency: 10,
        persistFiles: [
          'c:\\characters\\*.chr', 'c:\\characters\\*.res',
          'c:\\save\\*', 'c:\\mpsave\\*',
        ],
        windowlessGraceMs: 120000,
      },
      civ2_win16: {
        exe: civ2Win16Root + 'cd/CIV2/CIV2.EXE',
        // The movies are IV41. The disc's Video for Windows 1.1 setup installs
        // Intel's 16-bit driver and names it in SYSTEM.INI [drivers]; the DLL
        // ships KWAJ-compressed, so vfw/ comes from the recipe in
        // docs/re-notes/civilization-2-mge.md. Without it MSVIDEO finds no
        // decompressor and the game skips its videos.
        files: [
          { url: civ2Win16Root + 'vfw/ir41.dll',
            vfsPath: 'c:\\windows\\system\\ir41.dll', optional: true },
        ],
        startupIni: [
          { fileName: 'system.ini', section: 'drivers', key: 'VIDC.IV41', value: 'ir41.dll' },
        ],
        localFileManifest: civ2Win16Root + '.wine-assembly-browser.json',
        requiredFiles: true,
        preExtractIcon: false,
        // The artwork packs are resource-only NE DLLs named by the game's
        // module database, so none of them appears in CIV2.EXE's import table.
        // Stage them alongside WinG for its runtime LoadLibrary calls.
        win16Modules: [
          'WING', 'CIV2ART', 'CV', 'INTRO', 'MK', 'PV', 'SS', 'TILES',
          'TIMERDLL', 'WONDER',
        ],
        cdAudio: {
          cue: civ2Win16Root +
            "Sid Meier's Civilization II (USA) (En,Fr,De).cue",
          drive: 'D',
          volumeLabel: 'CIV2',
        },
      },
      // Original retail payload, kept in the local candidate corpus.
      dungeons_of_dredmor_release: {
        exe: 'test/binaries/candidates/dungeons-of-dredmor-release/game/Dungeons of Dredmor.exe',
        dlls: ["test/binaries/candidates/dungeons-of-dredmor-release/game/SDL.dll","test/binaries/candidates/dungeons-of-dredmor-release/game/SDL_ttf.dll","test/binaries/candidates/dungeons-of-dredmor-release/game/libexpat.dll","test/binaries/candidates/dungeons-of-dredmor-release/game/steam_api.dll","test/binaries/candidates/dungeons-of-dredmor-release/game/OpenAL32.dll"],
        localFileManifest: 'test/binaries/candidates/dungeons-of-dredmor-release/.wine-assembly-browser.json',
        requiredFiles: true,
        preExtractIcon: false,
      },
      dungeons_of_dredmor: {
        exe: 'test/binaries/candidates/dungeons-of-dredmor/package/98811_8/Dungeons of Dredmor.exe',
        dlls: ["test/binaries/candidates/dungeons-of-dredmor/package/98811_8/jpeg.dll","test/binaries/candidates/dungeons-of-dredmor/package/98811_8/libcurl.dll","test/binaries/candidates/dungeons-of-dredmor/package/98811_8/libexpat.dll","test/binaries/candidates/dungeons-of-dredmor/package/98811_8/libogg-0.dll","test/binaries/candidates/dungeons-of-dredmor/package/98811_8/libpng13.dll","test/binaries/candidates/dungeons-of-dredmor/package/98811_8/libvorbis-0.dll","test/binaries/candidates/dungeons-of-dredmor/package/98811_8/libvorbisfile-3.dll","test/binaries/candidates/dungeons-of-dredmor/package/98811_8/mikmod.dll","test/binaries/candidates/dungeons-of-dredmor/package/98811_8/msvcr80.dll","test/binaries/candidates/dungeons-of-dredmor/package/98811_8/SDL_image.dll","test/binaries/candidates/dungeons-of-dredmor/package/98811_8/SDL_mixer.dll","test/binaries/candidates/dungeons-of-dredmor/package/98811_8/SDL_ttf.dll","test/binaries/candidates/dungeons-of-dredmor/package/98811_8/SDL.dll","test/binaries/candidates/dungeons-of-dredmor/package/98811_8/steam_api.dll","test/binaries/candidates/dungeons-of-dredmor/package/98811_8/zlib1.dll"],
        localFileManifest: 'test/binaries/candidates/dungeons-of-dredmor/.wine-assembly-browser.json',
        requiredFiles: true,
        preExtractIcon: false,
      },
      pirates_2004: {
        d3d9Programmable: true,
        bigMemory: true,
        exe: 'test/binaries/candidates/pirates-2004/digital/app/Pirates!.exe',
        dlls: [
          'test/binaries/candidates/pirates-2004/digital/app/msvcr71.dll',
          'test/binaries/candidates/pirates-2004/digital/app/msvcp71.dll',
        ],
        files: [{
          url: 'test/binaries/candidates/pirates-2004/dx9/dxdiagn.dll',
          vfsPath: 'c:\\windows\\system\\dxdiagn.dll',
        }, {
          url: 'test/binaries/candidates/pirates-2004/local-config.ini',
          vfsPath: 'c:\\My Documents\\My Games\\c:\\Config.ini',
        }],
        startupRegistry: [{
          keyPath: 'HKCR\\CLSID\\{A65B8071-3BFE-4213-9A5B-491DA4461CA7}\\InprocServer32',
          valueName: '', type: 1, data: 'c:\\windows\\system\\dxdiagn.dll',
        }, {
          keyPath: 'HKLM\\SOFTWARE\\Microsoft\\DirectX',
          valueName: 'Version', type: 1, data: '4.09.00.0904',
        }],
        localFileManifest: 'test/binaries/candidates/pirates-2004/.wine-assembly-browser.json',
        requiredFiles: true,
        preExtractIcon: false,
      },
      // Morrowind GOTY retail. Nothing here is ours to publish: the tree under
      // morrowindRoot is written from the visitor's own ISO by
      // tools/prepare-morrowind.js and stays gitignored, and the deploy tool
      // refuses that directory outright. See docs/re-notes/morrowind.md.
      morrowind: {
        exe: morrowindRoot + 'installed/Morrowind.exe',
        dlls: [morrowindRoot + 'installed/binkw32.dll'],
        files: [],
        localFileManifest: morrowindRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        preExtractIcon: false,
        fileConcurrency: 12,
        // At 512 MB the sparse arena runs out while DirectShow builds the
        // title-music graph and the game quits with "Music Error".
        bigMemory: true,
        // The CD check wants a DRIVE_CDROM holding AutoRunMorrowind.exe; the
        // cue's one data track only gives D: that type and label.
        cdAudio: {
          cue: morrowindRoot + 'cd/Morrowind.cue',
          drive: 'D',
          volumeLabel: 'MORROWIND',
        },
        // What Morrowind Launcher writes on first run: 640x480x32 through
        // the hardware D3D8 device. Without it the game has no mode to set.
        startupRegistry: [
          ['Screen Width', 4, 640], ['Screen Height', 4, 480],
          ['Screen Depth', 4, 32], ['Backbuffers', 4, 1],
          ['Multisamples', 4, 0], ['Fullscreen', 3, [1]],
          ['Pixelshader', 3, [0]], ['Stencil', 3, [1]], ['Mipmap', 3, [1]],
          ['Mipmap Skip Level', 4, 0], ['Hardware', 3, [1]],
          ['Multipass', 3, [0]], ['Vertex Processing', 4, 0],
          ['Swap Effect', 4, 1], ['Refresh Rate', 4, 0],
          ['Presentation Interval', 4, 0], ['Adapter', 4, 0],
          ['Gamma', 4, 1065353216],
        ].map(([valueName, type, data]) => ({
          keyPath: 'HKLM\\SOFTWARE\\Bethesda Softworks\\Morrowind',
          valueName, type, data,
        })),
      },
      myth_tfl: {
        // installed/ is the "Small" install Setup.exe writes when run from the
        // mounted ISO (exe, DLLs, tags.gor, scrap.gor). artsound.gor and
        // cutscene.gor stay on the CD and are read lazily from D:\TAGS\.
        exe: mythRoot + 'installed/myth_tfl.exe',
        dlls: [
          mythRoot + 'installed/uber.dll',
          mythRoot + 'installed/mclient.dll',
          mythRoot + 'installed/smackw32.dll',
        ],
        localFileManifest: mythRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        preExtractIcon: false,
        // One cooked data track: the ISO mounts lazily as DRIVE_CDROM D:
        // labelled MYTH_TFL, the CD the game checks for and streams from.
        cdAudio: {
          cue: mythRoot + 'sources/myth-tfl.cue',
          drive: 'D',
          volumeLabel: 'MYTH_TFL',
        },
      },
      civ2_mge: {
        exe: civ2MgeRoot + 'installed/civ2.exe',
        dlls: [civ2MgeRoot + 'installed/XDaemon.dll'],
        // Every movie on the disc is Indeo 4 (IV41), decoded by Intel's own
        // ir41_32.dll behind the installable-driver ICM path. The disc ships
        // it in "Win_95nt Indeo/IVI_95NT.EXE"; indeo/ is what that installer
        // leaves in C:\WINDOWS\SYSTEM (recipe: docs/re-notes/civilization-2-mge.md).
        // Optional, as on a machine that skipped the Indeo install: the game
        // runs, it just has no codec for its movies.
        files: [
          { url: civ2MgeRoot + 'indeo/ir41_32.dll',
            vfsPath: 'c:\\windows\\system\\ir41_32.dll', optional: true },
        ],
        startupRegistry: [
          { keyPath: 'HKLM\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Drivers32',
            valueName: 'vidc.iv41', type: 1, data: 'ir41_32.dll' },
        ],
        localFileManifest: civ2MgeRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        preExtractIcon: false,
        cdAudio: {
          cue: civ2MgeRoot +
            'Civilization II - Multiplayer Gold Edition (USA).cue',
          drive: 'D',
          volumeLabel: 'CIV2MGE',
        },
      },
      jazz2_demo: {
        exe: jazz2DemoRoot + 'jazz2.exe',
        // A 1k cooperative slice keeps the J2V decoder and title-to-level
        // transition responsive. Once the guest runs in a Worker it only adds
        // rendezvous overhead: measured Worker duty was 65.5% at 1k versus
        // 94.5% at 100k while page FPS stayed 60.
        runSlice: { cooperative: 1000, worker: 100000 },
        // Nagle-style pacing of small TCP sends on the virtual LAN (ms; see
        // $vsock_nagle_ms in src/09d-winsock.wat). The server sends its 36-byte
        // and 2-byte join records back to back, and a client that receives both
        // at once never answers; a real stack spaces them. 1/5 two-seat joins
        // on a loaded boat without it, 4/4 with it. Per app: a blanket hold
        // broke Little Fighter 2 and SimCity 2000 Network Edition.
        vlanNagleMs: 200,
        files: jazz2DemoFiles,
        requiredFiles: true,
        fileConcurrency: 10,
        // Skip the long shareware logo video and request the shareware episode
        // directly. Network discovery is irrelevant for the local
        // single-player dropdown and delays startup substantially.
        args: 'Share1.j2l -nonetwork',
        touchControls: {
          dpad: { pos: 'bl', ways: 8 },
          buttons: [
            { vk: 0x20, label: 'Jump', pos: 'br' },
            { vk: 0x11, label: 'Fire', pos: 'br', row: 1 },
          ],
        },
      },
      simgolf_demo: {
        exe: simgolfDemoRoot + 'golf.exe',
        dlls: [
          simgolfDemoRoot + 'Terrain.dll',
          simgolfDemoRoot + 'jgl.dll',
          simgolfDemoRoot + 'sound.dll',
          simgolfDemoRoot + 'Mss32.dll',
          simgolfDemoRoot + 'binkw32.dll',
        ],
        files: [],
        localFileManifest: localDemoInstallerRoot +
          'simgolf-demo-installer/.wine-assembly-browser.json',
        requiredFiles: true,
        fileConcurrency: 10,
        keepAspect: true,
      },
      // SimCity 2000's own setup is the only source of the HKCU\Software\Maxis
      // key the game refuses to start without ("Sim City 2000 has not been
      // properly registered with the system"), and of the Paths subkey it finds
      // every asset through. Both live in the manifest's `registry` block, which
      // each host imports at launch; tools/gen-simcity2000-manifest.js writes it.
      simcity2000_demo: {
        desktopColorDepth: 8, // Real indexed desktop: palette cycling needs retained pixel indices.
        exe: simcity2000DemoRoot + 'simdemo.exe',
        files: [],
        localFileManifest: localDemoInstallerRoot +
          'simcity-2000-demo/.wine-assembly-browser.json',
        requiredFiles: true,
        // Shows more of the city at a bigger size rather than stretching it,
        // so the frame takes the whole phone; the city window fills it.
        mdiCrop: true,
      },
      // The client. Join Game -> Internet -> the server's room address logs in
      // to a 2KSERVER.EXE over Winsock (TCP 2586). Its own Start New Game
      // instead spawns a local server over pipes and named semaphores, which
      // is not emulated yet. tools/gen-simcity2000-net-manifest.js
      simcity2000_net: {
        exe: simcity2000NetRoot + 'installed/2KCLIENT.EXE',
        files: [],
        localFileManifest: simcity2000NetRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        mdiCrop: true,
        lan: {
          exe: '2KCLIENT.EXE',
          label: 'SimCity 2000 Network Edition',
          onDemand: true,
          room: 'auto',
          hint: 'pick Join Game, Internet, and log in to {host}.',
        },
      },
      // The server, File > Start New Game. It shares the client's room and is
      // serving while it listens on 2586, which only the socket table can say.
      simcity2000_net_server: {
        exe: simcity2000NetRoot + 'installed/2KSERVER.EXE',
        files: [],
        localFileManifest: simcity2000NetRoot + '.wine-assembly-browser.json',
        requiredFiles: true,
        lan: {
          exe: '2KCLIENT.EXE',
          label: 'SimCity 2000 Network Edition',
          onDemand: true,
          room: 'auto',
          hostProbe: { protocol: 'serving', listen: 2586 },
        },
      },
      black_white_2_demo: {
        exe: 'test/binaries/win98-games-a-d/Black and White 2-DX9-D3D/installed/BW2Demo.exe',
        dlls: ['d3dx9_25.dll', 'binkw32.dll', 'dbghelp.dll'].map(name =>
          'test/binaries/win98-games-a-d/Black and White 2-DX9-D3D/installed/' + name),
        files: [],
        localFileManifest: 'test/binaries/win98-games-a-d/Black and White 2-DX9-D3D/installed/.wine-assembly-browser.json',
        requiredFiles: true,
        keepAspect: true,
        // The game maintains a DirectInput software cursor. Pointer lock
        // keeps relative motion available beyond the browser canvas edges.
        relativeMouse: true,
        // Local experimental profile; backend selection stays user-controlled.
        // This is not a claim of complete gameplay compatibility.
        d3d9Programmable: true,
        // Its land load commits the whole 316MB sparse backing pool and asks
        // for far more; measured, not guessed (docs/re-notes/black-white-2.md
        // has the samples). At the land pick 792MB of backing is live and the
        // loader then asks for one 430MB range, so this app is why host.js
        // tries 2GB first. It is the only entry in the registry that asks for
        // anything but the 512MB every other app gets.
        bigMemory: true,
      },
      quake2_demo: {
        exe: quake2DemoRoot + 'quake2.exe',
        // quake2.exe has no resource section, so no icon. This is the icon
        // retail quake2.exe was built with, from id's GPL source release
        // (icons/sources/README.md has the commit and hash).
        iconFile: 'icons/sources/quake2.ico',
        // ref_gl's immediate-mode startup is expensive; the gameplay-proven
        // 10k budget still yields to browser input and presentation.
        runSlice: { cooperative: 10000 },
        // Preload both authentic renderer DLLs. The dropdown selects the
        // hardware-accelerated compatibility renderer; ref_soft stays mounted
        // for the Video menu and the dedicated renderer-switch regression.
        dlls: [quake2GameDll, quake2RefSoft, quake2RefGl],
        files: quake2DemoFiles,
        requiredFiles: true,
        // Restore a user's rewritten config over the bundled first-launch
        // WASD/mouse defaults, then persist later in-game control changes.
        persistFiles: ['c:\\baseq2\\config.cfg'],
        // Start at the ordinary game menu through ref_gl. Gameplay tests inject
        // their own map command without changing what a user sees here.
        args: '+set vid_ref gl +menu_main',
        // Quake's GetCursorPos/SetCursorPos loop needs browser-relative motion.
        // Declare it explicitly so capture does not depend on the timing of
        // its late ClipCursor/ShowCursor calls on slower browser engines.
        relativeMouse: true,
        // UDP deathmatch over the virtual LAN. Solo play never makes a socket
        // (WSAStartup only), so the lobby waits for the first socket(), which
        // is Start Network Server or Join Network Server. The joiner's list is
        // filled by the game's own broadcast, so either seat may host.
        // No two-copies-in-one-tab option: both would fight over one mouse
        // lock and one keyboard.
        //
        // `room: 'auto'` is the star room (lib/vlan-room.js): no lobby, the
        // first socket() joins the game's room or starts it. `hostProbe` is how
        // the shell learns this machine is SERVING, which the wire cannot say
        // (every client binds 27910 too): Quake's own server-info query, which
        // SVC_Info answers only while a server with maxclients > 1 is up. The
        // reply's status line ("noname demo1 1/4") labels the Join card.
        // `join.launchArgs` is what that card launches with, {host} being the
        // owner's seat, so a joiner lands straight in the match.
        lan: {
          exe: 'quake2.exe',
          label: 'Quake II',
          local: false,
          onDemand: true,
          room: 'auto',
          hostProbe: {
            port: 27910,
            // 31, not the retail 34: the demo's CL_PingServers pushes 0x1f
            // beside its "info %i" (exe 0x4094bb). 34 gets "wrong version".
            query: '\xff\xff\xff\xffinfo 31',
            label: '^\\xff{4}info\\n(.*)$',
          },
          // `join.hint` is for a game already running when the room is joined
          // (the mid-game toast): past its command line, it joins from its
          // own menus.
          join: {
            launchArgs: '+connect {host}',
            // The ordinary launch opens the main menu, which would sit over
            // the match the joiner just landed in.
            dropArgs: ['+menu_main'],
            // A game already running when the toast is answered, joined
            // through its console. Which keys get there depends on where
            // the game is, so this reads it: cls.state and cls.key_dest,
            // both compared in Con_ToggleConsole_f (exe 0x415710). ` is not
            // the answer while disconnected -- that runs "d1", the attract
            // demo -- but then key_game already feeds the console, so only
            // the menus have to be closed first. In a level, ` opens it.
            inGame: async ({ why, host, peek, type, sleep }) => {
              const STATE = 0xa86a60;     // 1 disconnected .. 4 active
              const FOCUS = 0xa86a64;     // 0 game, 1 console, 3 menu
              // Only the toast (why 0) joins a game that is past its menus;
              // a room joined at socket() leaves the player in Multiplayer.
              if (why) return false;
              if (peek(STATE) === null) return false;
              for (let i = 0; i < 6 && peek(FOCUS) === 3; i++) {
                await type('\x1b');
                await sleep(300);
              }
              if (peek(FOCUS) === 3) return false;
              if (peek(STATE) !== 1 && peek(FOCUS) !== 1) {
                await type('`');
                await sleep(300);
              }
              await type(`connect ${host}\n`);
              return true;
            },
            hint: 'open Multiplayer → Join Network Server',
          },
          hint: 'One of you picks Multiplayer → Start Network Server → Begin, '
            + 'the other Multiplayer → Join Network Server and the server '
            + 'that appears in the list.',
        },
        mobileTouch: 'trackpad',
        touchControls: {
          cursor: false,
          aimOnly: true,
          aimSensitivity: 5,
          screenAnchored: true,
          dpad: { pos: 'bl', style: 'cross', hold: true,
            vks: { up: 0x26, down: 0x28, left: 0x41, right: 0x44 } },
          buttons: [
            // Bottom-up flex rows are created in declaration order.
            { vk: 0x43, label: 'Crouch', pos: 'br' },
            { vk: 0x20, label: 'Jump', pos: 'br' },
            { vk: 0x0D, label: 'Fire', pos: 'br', row: 1, width: 152, height: 76 },
            { vk: 0x1B, label: 'Esc', pos: 'tl', hold: false },
          ],
        },
      },
      quake2_demo_installer: {
        exe: localDemoInstallerRoot +
          'quake-2-demo-installer/q2-314-demo-x86.exe',
      },
      heroes3_demo: {
        exe: heroes3DemoRoot + 'h3demo.exe',
        dlls: [
          heroes3DemoRoot + 'BINKW32.DLL',
          heroes3DemoRoot + 'MSS32.DLL',
          heroes3DemoRoot + 'SMACKW32.DLL',
        ],
        files: heroes3DemoFiles,
        requiredFiles: true,
      },
      heroes3_demo_installer: {
        exe: heroes3InstallerEngineRoot + '_ins5576._mp',
        dlls: [
          heroes3InstallerEngineRoot + 'zdatai51.dll',
          heroes3InstallerEngineRoot + '_wutl951.dll',
        ],
        files: heroes3InstallerFiles,
        requiredFiles: true,
      },
      diablo2_demo: {
        mobileTouch: 'direct',
        exe: diablo2DemoRoot + 'diablo ii.exe',
        dlls: diablo2DemoDlls,
        files: diablo2DemoFiles,
        requiredFiles: true,
        fileConcurrency: 10,
        // Diablo II picks its renderer from the registry, not the command
        // line, and with no VideoConfig key it falls back to the GDI path.
        // Render=1 is the Direct3D backend -- the one that reaches
        // IDirect3DDevice3::DrawIndexedPrimitiveVB during the Act I load,
        // which is where the stdcall-arity crash fixed in fb397db1 lived.
        // Seeded under both hives because the game reads HKCU first and
        // falls back to HKLM; the CLI A/B that proved this path used exactly
        // these two keys (docs/re-notes/diablo2-demo.md).
        startupRegistry: [
          { keyPath: 'HKCU\\Software\\Blizzard Entertainment\\Diablo II\\VideoConfig',
            valueName: 'DeviceName', type: 1, data: 'Direct3D HAL' },
          { keyPath: 'HKCU\\Software\\Blizzard Entertainment\\Diablo II\\VideoConfig',
            valueName: 'Render', type: 4, data: 1 },
          { keyPath: 'HKCU\\Software\\Blizzard Entertainment\\Diablo II\\VideoConfig',
            valueName: 'dwFlags', type: 4, data: 1 },
          { keyPath: 'HKLM\\Software\\Blizzard Entertainment\\Diablo II\\VideoConfig',
            valueName: 'DeviceName', type: 1, data: 'Direct3D HAL' },
          { keyPath: 'HKLM\\Software\\Blizzard Entertainment\\Diablo II\\VideoConfig',
            valueName: 'Render', type: 4, data: 1 },
          { keyPath: 'HKLM\\Software\\Blizzard Entertainment\\Diablo II\\VideoConfig',
            valueName: 'dwFlags', type: 4, data: 1 },
        ],
      },
      diablo2_demo_installer: {
        exe: localDemoInstallerRoot +
          'diablo-2-demo-installer/DiabloIIDemo.exe',
      },
      // Original Glide 3 demos; statically assembled installer layouts.
      // Gameplay is not yet validated. See docs/glide3-corpus.md and each
      // local launch-manifest.json for the source-to-installed path evidence.
      hitman_glide_demo: {
        // Original renderer recenters with SetCursorPos after mouse messages.
        relativeMouse: true,
        exe: localDemoInstallerRoot + 'hitman-codename-47-demo/launch-game/Hitman.Exe',
        // Runtime modules import the bundled XML parser and EAX audio wrapper.
        // Seed both so named/ordinal imports resolve to original PE code.
        dlls: ['Globals.dll', 'xmlparse.dll', 'EAX.dll'].map(name =>
          localDemoInstallerRoot + 'hitman-codename-47-demo/launch-game/' + name),
        files: [],
        localFileManifest: localDemoInstallerRoot + 'hitman-codename-47-demo/.wine-assembly-browser.json',
        workingDirectory: 'C:\\',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      hype_glide_demo: {
        exe: localDemoInstallerRoot + 'hype-time-quest-demo/launch-game/MaiDFXvr_bleu.exe',
        dlls: ['Mfc42.dll', 'Msvcrt.dll'].map(name =>
          localDemoInstallerRoot + 'hype-time-quest-demo/launch-game/' + name),
        files: [],
        localFileManifest: localDemoInstallerRoot + 'hype-time-quest-demo/.wine-assembly-browser.json',
        workingDirectory: 'C:\\',
        requiredFiles: true,
        fileConcurrency: 10,
      },
      gta2_demo: {
        exe: gta2DemoRoot + 'gta2.exe',
        dlls: [gta2Mss32],
        files: gta2DemoTree,
        requiredFiles: true,
        fileConcurrency: 10,
        touchControls: {
          dpad: { pos: 'bl', ways: 8 },
          buttons: [
            { vk: 0x11, label: 'Fire', pos: 'br' },
            { vk: 0x0D, label: 'Enter', pos: 'br', row: 1 },
            { vk: 0x20, label: 'Brake', pos: 'br', row: 2 },
          ],
        },
      },
      halflife_uplink: {
        relativeMouse: true,
        exe: halfLifeUplinkRoot + 'hldemo.exe',
        // A 1k slice underfeeds Uplink's immediate-mode OpenGL world and
        // streamed audio. A New Game -> Easy run at 10k sustained about 8.6
        // presents/s while keeping a slice near one frame budget.
        runSlice: { cooperative: 10000 },
        dlls: halfLifeUplinkDlls,
        files: halfLifeUplinkFiles,
        requiredFiles: true,
        fileConcurrency: 10,
        startupRegistry: [
          // The demo's first-run OpenGL default is its bundled 3Dfx mini
          // driver. Wine-Assembly exposes the system OpenGL 1.x/WGL bridge,
          // which GoldSrc names "Default" in gldrv\\drvmap.txt.
          { keyPath: 'HKCU\\Software\\Valve\\HLDemo\\Settings',
            valueName: 'EngineGLDriver', type: 1, data: 'Default' },
          { keyPath: 'HKCU\\Software\\Valve\\HLDemo\\Settings',
            valueName: 'EngineType', type: 4, data: 2 },
        ],
        // OpenGL benefits from a larger cooperative quantum; the CPU software
        // renderer must yield more often or map startup blocks Safari's page.
        // GoldSrc can replace either renderer from Video Modes without exit.
        rendererRunSlices: { software: 1000, opengl: 10000 },
        // Uplink performs a lengthy software/OpenGL renderer probe before it
        // creates the Half-Life window.
        windowlessGraceMs: 60000,
        mobileTouch: 'trackpad',
        touchControls: {
          dpad: { pos: 'bl', ways: 8,
            vks: { up: 0x57, down: 0x53, left: 0x41, right: 0x44 } },
          buttons: [
            { vk: 0x20, label: 'Jump', pos: 'br' },
            { vk: 0x09, label: 'Use', pos: 'br', row: 1 },
            { vk: 0x11, label: 'Crouch', pos: 'br', row: 2 },
          ],
        },
      },
      halflife_uplink_installer: {
        exe: localDemoInstallerRoot +
          'half-life-uplink-installer/hluplink.exe',
      },
      diablo_demo: {
        mobileTouch: 'direct',
        hideHostCursor: true,
        exe: diabloCandidateRoot + 'DIABDEMO.EXE',
        dlls: [diabloCandidateRoot + 'STORM.DLL'],
        // This August 1996 demo predates the later spawn0.sv format. It saves
        // one game as C:\\Save\\Game00.sav plus Level*.sav companions.
        persistFiles: ['c:\\save\\*.sav'],
        // Diablo's loading loop waits for timeSetEvent without pumping the
        // window queue, so the browser host must invoke the existing
        // cooperative callback hook between main-thread slices.
        asyncMultimediaTimer: true,
        files: [
          // The 55.9 MB MPQ is named DIABLO.EXE, so the lazy default's 'exe'
          // rule would keep it eager; it is data, read by ReadFile only. It
          // streams: measured on the route menu -> New Game -> Warrior ->
          // name -> Tristram -> walk (run.js --lazy-ranges=5 --trace-fs,
          // tools/io-range-census.js): 15.1 MB unique, and no read under a
          // nested synchronous message, so unlike diablo_shareware it needs
          // no preloadRanges.
          { url: diabloArchive, vfsPaths: ['c:\\diablo.exe', 'z:\\diablo.exe'], httpRange: true },
          { url: diabloCandidateRoot + 'DIABLO.TXT', vfsPath: 'c:\\diablo.txt' },
        ],
        requiredFiles: true,
      },
      diablo_shareware: {
        mobileTouch: 'direct',
        hideHostCursor: true,
        exe: diabloSharewareRoot + 'diablo_s.exe',
        dlls: [
          diabloSharewareRoot + 'storm.dll',
          diabloSharewareRoot + 'diabloui.dll',
          diabloSharewareRoot + 'smackw32.dll',
        ],
        // Character creation writes the single-player archive beside the EXE
        // as spawn_0.sv (with further slots following the same pattern).
        persistFiles: ['c:\\spawn_*.sv'],
        files: [
          // Storm reads menu sprites through its worker while WM_INITDIALOG
          // synchronously waits for completion, and the cooperative nested
          // wait cannot await a network fetch (a miss there decodes black
          // art). So the archive streams by HTTP range, except these ranges,
          // which load before the guest starts and stay resident: the MPQ
          // header and tables, every file diabloui.dll names (its dialog
          // art), and every block read under a nested synchronous message on
          // the traced route menu -> new Warrior -> Tristram (which adds
          // music\sintro.wav, streamed during the menus). 4.6 MB of 50 MB.
          // Measured with run.js --trace-fs and tools/io-range-census.js
          // --names-from=diabloui.dll; re-measure if spawn.mpq changes (a
          // size mismatch loads the whole file instead).
          {
            url: diabloSharewareRoot + 'spawn.mpq',
            vfsPath: 'c:\\spawn.mpq',
            httpRange: true,
            preloadRanges: {
              schemaVersion: 1,
              size: 50274091,
              ranges: [[0, 67680], [89774, 1447685], [30528477, 33157471],
                [49476519, 49541435], [49548535, 49641962], [49676876, 49931055],
                [49934147, 50173535], [50177032, 50274091]],
            },
          },
          diabloSharewareRoot + 'diablo.ini',
          diabloSharewareRoot + 'battle.snp',
          diabloSharewareRoot + 'standard.snp',
        ],
        asyncMultimediaTimer: true,
        requiredFiles: true,
        fileConcurrency: 4,
      },
      worms2_demo: {
        exe: worms2DemoRoot + 'worms2.dat',
        files: worms2DemoFiles,
        requiredFiles: true,
        fileConcurrency: 12,
      },
      starcraft_shareware: {
        exe: starcraftInstalledRoot + 'starcraft.exe',
        dlls: [
          starcraftInstalledRoot + 'storm.dll',
          starcraftInstalledRoot + 'smackw32.dll',
        ],
        files: [
          { url: starcraftInstalledRoot + 'starcraft.exe',
            vfsPath: starcraftInstallDir + 'starcraft.exe' },
          { ...starcraftFile('stardated.mpq'), httpRange: true },
          { url: starcraftInstaller,
            vfsPath: 'c:\\install.exe', httpRange: true },
          starcraftFile('storm.dll'),
          starcraftFile('smackw32.dll'),
          starcraftFile('local.dll'),
          starcraftFile('battle.snp'),
          starcraftFile('standard.snp'),
          starcraftFile('license.txt'),
          starcraftFile('readme.cnt'),
          starcraftFile('readme.hlp'),
        ],
        requiredFiles: true,
        // Cooperative, not Worker: measured 2026-09-28 at load ~8, the Worker
        // backend ran the same guest work (6.8M vs 6.9M blocks/s) but presented
        // 44.8/s against 70.5/s and showed 7.6 distinct frames/s against 14.0.
        threads: false,
        // Save Game writes C:\save\<player>\<name>.sng (player "Anonymous"
        // under the ophelia launch below) relative to the C:\ working dir.
        persistFiles: ['c:\\save\\*.sng'],
        perf: {
          // Addresses in the MOUNTED exe (starcraft-demo-official), not the
          // 1KB-larger starcraft-shareware one they were first found in, where
          // they are 0x004b2ed0 / 0x004411e7 -- mid-instruction here, so the
          // HUD read GAME 0.0/s even in gameplay. Same call site in both:
          // `call <game step>` at 0x004411eb here, 0x004411db there.
          logicalFrame: {
            label: 'GAME',
            address: 0x004b29f0,
            verifier: 0x004411f7,
          },
        },
        // Jump straight into the first Terran mission while leaving Storm's
        // DirectSound mixer enabled. The old `nosound` token was a temporary
        // compatibility shortcut and made the registered app silent.
        args: 'ophelia terran1',
        startupRegistry: [
          { keyPath: 'HKLM\\Software\\Blizzard Entertainment\\Starcraft Shareware',
            valueName: 'InstallPath', type: 1,
            data: 'C:\\Program Files\\Starcraft Shareware' },
          { keyPath: 'HKLM\\Software\\Blizzard Entertainment\\Starcraft Shareware',
            valueName: 'Program', type: 1,
            data: 'C:\\Program Files\\Starcraft Shareware\\Starcraft.exe' },
          { keyPath: 'HKLM\\Software\\Blizzard Entertainment\\Starcraft Shareware',
            valueName: 'StarCD', type: 1, data: 'C' },
        ],
      },
      // No presentCap: it slows the game. Measured 2026-09-28 on the map:
      // 3,600 presents/s and 99% of a core uncapped in headless Chrome, 175/s
      // and 14% at ?present-cap=60. But Max Stone's walk from the start hex
      // to x=318 took 1.55 guest-s uncapped and 2.62 capped on the 1 ms/batch
      // CLI clock (1.6 against 2.5 on 10 ms/batch), through the same 52
      // animation frames. The walk is paced by frames drawn as well as by the
      // clock (mechanism not traced).
      fallout_demo: {
        exe: falloutDemoRoot + 'Falldemo.exe',
        // The game loop's per-frame return 0x454a8c (after get-input; the
        // pump below it, 0x486bda, spins ~180k times through loading and
        // menus and is not a frame). Map walk, batches 3150-3250 at
        // 100000 blocks / 10 ms ticks: 117 steps = 117 pump-bounded frames,
        // with ~5.3 partial Lock/Unlock presents per frame, so a cap must
        // pace per step, not per frame end. Verifier 0x43345a (404 = 404
        // over the whole run).
        perf: {
          logicalFrame: {
            label: 'GAME',
            address: 0x00454a8c,
            verifier: 0x0043345a,
          },
        },
        files: [falloutDemoRoot + 'Falldemo.dat'],
        requiredFiles: true,
        // Fallout draws straight into the primary: each main-loop turn copies
        // ~5 dirty rects as NULL-rect Lock/Unlock pairs between two
        // PeekMessage calls, so it has ~5.2 frame ends per game frame. The cap
        // is safe only because the limiter paces once per pump-bounded frame
        // ($present_pump, 09a8). Measured 2026-09-28 on box4, first-area walk
        // (1 ms/batch): uncapped 1.55 guest-s, cap 60 1.59 guest-s at 56
        // frames/guest-s; the old per-frame-end limiter took 2.62 guest-s.
        // `run.js --present-frames` re-checks it (docs/re-notes/fallout-demo.md).
        presentCap: 60,
      },
      heroes2_demo: {
        exe: heroes2DemoRoot + 'H2DEMOW.EXE',
        dlls: [heroes2DemoRoot + 'MSS32.DLL', heroes2DemoRoot + 'SMACKW32.DLL'],
        files: heroes2DemoFiles,
        requiredFiles: true,
        // Single/multiplayer saves are NAME.GM1 through NAME.GM6 in the
        // working-directory root; campaign saves use NAME.GMC.
        persistFiles: ['c:\\*.gm?', 'c:\\*.gmc'],
        // Use the demo's real Miles and Smacker libraries. Only Red Book CD
        // audio is unavailable because the browser has no mounted game CD.
        args: '/R0',
      },
      total_annihilation_demo: {
        exe: totalAnnihilationDemoRoot + 'tademo.exe',
        files: [{
          url: totalAnnihilationDemoRoot + 'tademo.hpi',
          vfsPath: 'c:\\tademo.hpi',
        }],
        requiredFiles: true,
      },
      // Untouched game payload installed by the official Sierra/Impressions
      // demo's ZipMagic + InstallShield chain. The outer extractor remains in
      // the corpus for installer regressions; the web launcher starts the game.
      // The demo's War3Demo.exe is also the import provider for Game.dll: the
      // DLL takes 460 of its imports from the EXE by ordinal. Renderer init is
      // OpenGL-only here (the DirectX path wants a d3d8 we do not have), so it
      // needs a host with a real WebGL context.
      warcraft3_demo: {
        exe: warcraft3DemoRoot + 'War3Demo.exe',
        dlls: [
          warcraft3DemoRoot + 'Game.dll',
          warcraft3DemoRoot + 'Storm.dll',
          warcraft3DemoRoot + 'Mss32.dll',
          warcraft3DemoRoot + 'ijl15.dll',
        ],
        files: warcraft3DemoFiles,
        requiredFiles: true,
        fileConcurrency: 8,
        args: '-opengl -window',
      },
      caesar3_demo: {
        exe: caesar3DemoRoot + 'c3.exe',
        dlls: [caesar3DemoRoot + 'SMACKW32.DLL'],
        files: caesar3DemoFiles,
        requiredFiles: true,
        fileConcurrency: 12,
      },
      captain_claw_demo: {
        exe: 'test/binaries/candidates/captain-claw-demo/installed/clawdemo.exe',
        dlls: ['test/binaries/candidates/captain-claw-demo/installed/mss32.dll'],
        // The main loop at 0x4ac879 drains PeekMessageA, then makes one
        // virtual frame call per pass (`call [edx+0x20]` at 0x4ac8ed, which
        // returns to 0x4ac8f0). Every frame (menu and level) goes through it.
        // Counted over 400 batches: 463 passes, 462 returns, 464 per-frame
        // ReleaseDC/GetTickCount sites beneath it.
        perf: {
          logicalFrame: {
            label: 'GAME',
            address: 0x004ac8e7,
            verifier: 0x004ac8f0,
          },
        },
        files: ['test/binaries/candidates/captain-claw-demo/installed/clawdemo.rez'],
        requiredFiles: true,
        startupRegistry: [
          { keyPath: 'HKLM\\Software\\Monolith Productions\\Claw Demo\\1.0',
            valueName: 'Skip Joystick Calibration Test', type: 4, data: 1 },
          { keyPath: 'HKLM\\Software\\Monolith Productions\\Claw Demo\\1.0',
            valueName: 'Skip Title Screen', type: 4, data: 1 },
          { keyPath: 'HKLM\\Software\\Monolith Productions\\Claw Demo\\1.0',
            valueName: 'Skip Logo Movies', type: 4, data: 1 },
        ],
      },
      funtris:    {
        exe: 'binaries/wep32-community/Funpack/Funtris.exe',
        dlls: ['binaries/wep32-community/Funpack/FunPack.dll'],
        startupRegistry: [
          { keyPath: 'HKCU\\Software\\Funpack Software\\Funtris\\Options', valueName: 'GetStarted', type: 4, data: 0 },
        ],
        dismissStartupDialog: { title: 'Funtris', command: 1 },
        // The board is the well plus the score/next-piece panel beside it, and
        // it is a small part of the window. Portrait Fill uses the measured
        // board union; landscape keeps the full window width in both modes
        // and trims only vertical furniture.
        //
        // Measured in the page (tallest solid-black band = the well, then
        // every non-grey pixel across that band = well + panel) at two window
        // sizes, because Funtris reflows: it tracks the client width and
        // CENTRES the board vertically, so the fractions move with the window.
        //   400x577 window -> content 12,122 372x370  (y 0.211..0.853)
        //   410x724 window -> content 12,186 382x390  (y 0.257..0.796)
        // The rect below is the union with a margin, so it is a superset at
        // both and `contain` scales it down rather than cutting anything.
        mobileCrop: { x: 0.028, y: 0.19, w: 0.935, h: 0.68, contain: true,
          // Landscape preserves the entire window width in both modes. Fit
          // trims only the menu; Fill trims further above/below the playfield.
          // A width-preserving vertical crop cannot also cover a wider phone
          // without distortion, so Fill may leave a small horizontal band.
          fitFocusLandscape: { top: 40 },
          fillLandscapeCrop: { x: 0, y: 45 / 375, w: 1, h: 324 / 375, contain: true } },
        // Measured with a brick falling (Start! menu, then one key per arm,
        // each arm diffed against a key-free control run of the same length):
        // Left, Right, Up and Down each change the playfield, and Space
        // changes the most of all — the classic move/rotate/soft-drop/hard-
        // drop set. Four-way, so a sloppy diagonal cannot rotate the piece
        // while moving it.
        touchControls: {
          viewToggle: true,
          landscapeCenterControls: true,
          // Cross pad with repeat: a brick moves a column per keystroke, and
          // the repeat is what slides it across the well. Down is the drop the
          // thumb already has, so Space gets no button of its own -- the
          // hard drop is reachable from the keyboard pill and nowhere else,
          // which is the right trade for a phone-sized control deck.
          dpad: { pos: 'bl', ways: 4, style: 'cross' },
          buttons: [
            // Funtris's Game menu is "&New\tF2" (id 40001), so the keyboard
            // reaches its new-game action after all and the button does not
            // need the WM_COMMAND kind.
            { vk: 0x71, label: 'New game', pos: 'br' },
          ],
        },
      },
      peaks:      {
        exe: 'binaries/wep32-community/Funpack/Peaks.exe',
        dlls: ['binaries/wep32-community/Funpack/FunPack.dll'],
        startupRegistry: [
          { keyPath: 'HKCU\\Software\\Funpack Software\\Peaks\\Options', valueName: 'GetStarted', type: 4, data: 0 },
        ],
        dismissStartupDialog: { title: 'Peaks', command: 1 },
      },
      pyramid:    {
        exe: 'binaries/wep32-community/Funpack/Pyramid.exe',
        runSlice: CARD_RUN_SLICE,
        dlls: ['binaries/wep32-community/Funpack/FunPack.dll'],
        startupIni: [
          { fileName: 'win.ini', section: 'intl', key: 'iCDateCount', value: -1 },
        ],
        startupRegistry: [
          { keyPath: 'HKCU\\Software\\Funpack Software\\Pyramid\\Options', valueName: 'GetStarted', type: 4, data: 0 },
        ],
      },
      fourstones: {
        exe: 'binaries/wep32-community/Funpack/FourStones.exe',
        dlls: ['binaries/wep32-community/Funpack/FunPack.dll'],
        startupRegistry: [
          { keyPath: 'HKCU\\Software\\Funpack Software\\Four Stones\\Options', valueName: 'GetStarted', type: 4, data: 0 },
        ],
        dismissStartupDialog: { title: 'Four', command: 1 },
      },
      // keepAspect: WordZap StretchBlt's its title art (and its board) across
      // the whole client rect, so a portrait client draws the logo half again
      // as tall as it is wide. Measured against a native 640x480 render.
      // Fixed 648x383 layout: maximized on the phone it was squeezed into a
      // 408x408 window that cut off its word grid (phone sweep 2026-10-06).
      cwordzap:   { exe: 'binaries/wep32-community/Wordzap/CWordZap.exe', keepAspect: true, singleAppMaximize: false,
        singleAppMinDesktop: { w: 1024, h: 768 } },
      bricks:     {
        exe: 'binaries/wep32-community/Bricks/bricks.exe',
        // The wep32 archive ships only the exe and brk1.dll; the game plays
        // its effects with PlaySound("bricks%02i.wav") from the exe directory
        // and goes silent without them. The 15 WAVs come from the author's
        // own winbricks/sound.zip (see test/binaries/SOURCES.md).
        files: [
          'binaries/wep32-community/Bricks/brk1.dll',
          ...Array.from({ length: 15 }, (_, i) => `binaries/wep32-community/Bricks/bricks${String(i).padStart(2, '0')}.wav`),
        ],
        // Its board is a fixed size at the top-left of the client area, so a
        // phone maximize (648x1152 portrait) left most of the window grey and
        // shrank the board to fit it (phone sweep 2026-10-06).
        singleAppMaximize: false,
        singleAppMinDesktop: { w: 1024, h: 768 },
      },
      pawn:       {
        exe: 'binaries/wep32-community/Pawn/Pawn.exe',
        // The 3D board loads its own font and piece textures from the exe
        // directory; without them it stops at "File ALPHFONT.TTF not found!".
        files: [
          'binaries/wep32-community/Pawn/ALPHFONT.TTF',
          'binaries/wep32-community/Pawn/pawn.bok',
          'binaries/wep32-community/Pawn/pawn.cfg',
          'binaries/wep32-community/Pawn/Square black.bmp',
          'binaries/wep32-community/Pawn/Square white.bmp',
        ],
      },
      qblackjack: {
        exe: 'binaries/wep32-community/QBlackjack/QuickBlackjack.exe',
        startupRegistry: [
          { keyPath: 'HKCU\\Software\\Wesley Steiner\\Quick Blackjack\\Player', valueName: 'Purse', type: 4, data: 500 },
          { keyPath: 'HKCU\\Software\\Wesley Steiner\\Quick Blackjack\\Player', valueName: 'Change', type: 4, data: 0 },
          { keyPath: 'HKCU\\Software\\Wesley Steiner\\Quick Blackjack\\Tabletop', valueName: 'Animation', type: 4, data: 0 },
        ],
      },
      runenlegen: { exe: 'binaries/wep32-community/Runenlegen/Runenlegen.exe' },
      tetravex:   { exe: 'binaries/wep32-community/Tetravex/Tetravex.exe' },
      winarc:     { exe: 'binaries/wep32-community/Winarc/Winarc.exe' },
      jigssawme:  {
        exe: 'binaries/wep32-community/Jigssawme/JigSawedME.exe',
        files: [
          'binaries/wep32-community/Jigssawme/LDMinMax6.ocx',
          'binaries/wep32-community/Jigssawme/piecelock.wav',
        ],
        requiredFiles: true,
        startupRegistry: [
          { keyPath: 'HKCR\\CLSID\\{af3f3434-a691-11d3-a934-00e029417274}\\InprocServer32',
            valueName: '', type: 1, data: 'C:\\LDMinMax6.ocx' },
        ],
      },
      rodent2000: {
        exe: 'binaries/wep32-community/Rodent2000/Rodent2000.exe',
        // VB6 calls its Timer event procedures through runtime tables, so
        // the step has no static caller: 0x42a810 is the timer event that
        // moves the cats and redraws through the sprite routine 0x429d80
        // (second call returns to 0x42acd5). From New Game to batch 3500
        // at 2000 blocks: 92 entries = 92 draws = 92 returns, ~12 per 100
        // batches against ~15 WM_TIMER.
        perf: {
          logicalFrame: {
            label: 'GAME',
            address: 0x0042a810,
            verifier: 0x0042acd5,
          },
        },
        files: [
          ...['00000', '00001', '00002', '00003', '00004', 'new'].map(level => ({
            url: `binaries/wep32-community/Rodent2000/Levels/${level}.rodent_level`,
            vfsPath: `c:\\levels\\${level}.rodent_level`,
          })),
        ],
        requiredFiles: true,
      },
      tworld: {
        exe: 'binaries/wep32-community/TWorld/tworld.exe',
        dlls: ['binaries/wep32-community/TWorld/SDL.dll'],
        files: [
          // Level packs (.dac descriptors live in sets/, .dat level data in data/)
          { url: 'binaries/wep32-community/TWorld/sets/cc-ms.dac',     vfsPath: 'c:\\sets\\cc-ms.dac' },
          { url: 'binaries/wep32-community/TWorld/sets/CCLP1-MS.dac',  vfsPath: 'c:\\sets\\cclp1-ms.dac' },
          { url: 'binaries/wep32-community/TWorld/sets/CCLP2-MS.dac',  vfsPath: 'c:\\sets\\cclp2-ms.dac' },
          { url: 'binaries/wep32-community/TWorld/sets/CCLP3-MS.dac',  vfsPath: 'c:\\sets\\cclp3-ms.dac' },
          { url: 'binaries/wep32-community/TWorld/sets/intro-ms.dac',  vfsPath: 'c:\\sets\\intro-ms.dac' },
          { url: 'binaries/wep32-community/TWorld/data/CHIPS.DAT',     vfsPath: 'c:\\data\\chips.dat' },
          { url: 'binaries/wep32-community/TWorld/data/CCLP1.dat',     vfsPath: 'c:\\data\\cclp1.dat' },
          { url: 'binaries/wep32-community/TWorld/data/CCLP2.dat',     vfsPath: 'c:\\data\\cclp2.dat' },
          { url: 'binaries/wep32-community/TWorld/data/CCLP3.dat',     vfsPath: 'c:\\data\\cclp3.dat' },
          { url: 'binaries/wep32-community/TWorld/data/intro.dat',     vfsPath: 'c:\\data\\intro.dat' },
          // Resources (font/tiles + ruleset config + sound effects)
          { url: 'binaries/wep32-community/TWorld/res/rc',             vfsPath: 'c:\\res\\rc' },
          { url: 'binaries/wep32-community/TWorld/res/font.bmp',       vfsPath: 'c:\\res\\font.bmp' },
          { url: 'binaries/wep32-community/TWorld/res/tiles.bmp',      vfsPath: 'c:\\res\\tiles.bmp' },
          { url: 'binaries/wep32-community/TWorld/res/unslist.txt',    vfsPath: 'c:\\res\\unslist.txt' },
        ],
      },
      // Sizes its window from the screen: on a 400-wide phone desktop it came
      // out 408 wide and clipped its own status bar (phone sweep 2026-10-06).
      empipe:     { exe: 'binaries/wep32-community/EmPipe/EMPIPE.EXE', requiredFiles: true,
        // The game ticks on timer 1: WM_TIMER calls 0x405397 (from
        // 0x402649), which for id 1 runs 0x40539e and then either the flow
        // advance 0x4050f7 or the pre-flow countdown 0x404b2a; other timer
        // ids go to 0x40503d. Counted after Next + Accelerate: 192 timer-1
        // ticks (81 flow + 111 countdown), 32 other. No single address
        // fires once per timer-1 tick besides the step, so no verifier.
        perf: { logicalFrame: { label: 'GAME', address: 0x0040539e } },
        singleAppMinDesktop: { w: 1024, h: 768 }, files: [
        'binaries/wep32-community/EmPipe/EMPIPEE.HLP',
        'binaries/wep32-community/EmPipe/EMPIPEE.TXT',
        'binaries/wep32-community/EmPipe/EMPIPE.EXE.manifest',
        'binaries/wep32-community/EmPipe/EMPCLEAR.MID', 'binaries/wep32-community/EmPipe/EMPGMOV.MID',
        'binaries/wep32-community/EmPipe/EMPSCR1.MID', 'binaries/wep32-community/EmPipe/EMPSCR2.MID',
        'binaries/wep32-community/EmPipe/EMPSCR3.MID', 'binaries/wep32-community/EmPipe/EMPSCR4.MID',
        'binaries/wep32-community/EmPipe/EMPSCR5.MID', 'binaries/wep32-community/EmPipe/EMPSTART.MID',
      ] },
      spider:     { exe: 'binaries/plus98/SPIDER.EXE', dlls: ['binaries/entertainment-pack/cards.dll'], files: ['binaries/plus98/SPIDER.CHM', 'binaries/plus98/SPIDER.HLP'], runSlice: CARD_RUN_SLICE },
      marbles:    { exe: 'binaries/plus98/MARBLES.EXE',
        // Marbles draws its own pointer and moves it ONLY from DirectInput
        // relative deltas -- it polls GetDeviceState once per WM_MOUSEMOVE and
        // never reads the Win32 cursor, so an absolute tap cannot aim it at
        // all (a WM_MOUSEMOVE onto QUIT leaves PLAY highlighted). Trackpad is
        // the only touch mode the game can be played in: a drag walks its
        // pointer, a tap clicks wherever that pointer is.
        mobileTouch: 'trackpad',
        // The frame function 0x419886 waits until timeGetTime is 31 ms past
        // the last frame (Sleep(2) spin, so <= ~32 fps), draws (0x401023)
        // and presents through 0x401154 -> 0x4127b0 (the Flip at 0x412a2e is
        // its only Flip site). Both present paths rejoin at 0x419a51. Counted
        // over 700 batches: 595 entries, 594 at 0x419a51, 594 presents.
        perf: {
          logicalFrame: {
            label: 'GAME',
            address: 0x00419886,
            verifier: 0x00419a51,
          },
        },
        files: [
        'binaries/plus98/LLOGO.BMP', 'binaries/plus98/LSPLASH.BMP',
        'binaries/plus98/CHOOSE1.BMP', 'binaries/plus98/CHOOSE2.BMP',
        'binaries/plus98/COMMON01.BMP', 'binaries/plus98/COMMON02.BMP', 'binaries/plus98/COMMON03.BMP',
        'binaries/plus98/COMMON04.BMP', 'binaries/plus98/COMMON05.BMP', 'binaries/plus98/CMNBONUS.BMP',
        'binaries/plus98/LEVEL-01.BMP', 'binaries/plus98/LEVEL-01.DAT', 'binaries/plus98/LEVEL1BG.BMP',
        'binaries/plus98/TRANS1A.BMP', 'binaries/plus98/TRANS2A.BMP',
        'binaries/plus98/DIALOG.BMP', 'binaries/plus98/OPTIONS.BMP', 'binaries/plus98/TEXTFONT.BMP',
        'binaries/plus98/CRACK.BMP', 'binaries/plus98/GRASTILE.BMP',
        'binaries/plus98/B1.MID', 'binaries/plus98/CRD.MID', 'binaries/plus98/LVL1.MID',
        'binaries/plus98/2.WAV', 'binaries/plus98/MARBLES.ICO',
      ] },
      winamp:     {
        exe: 'binaries/winamp.exe',
        inputHooks: WINAMP_INPUT_HOOKS,
        debugPickerSection: 'other-apps',
        // A visualizer has to be listed here as well as mounted below:
        // LoadLibraryA resolves a guest path against modules that are already
        // loaded and never opens the VFS, so a plug-in Winamp discovers at
        // runtime comes back as a junk handle unless it was preloaded.
        // MilkDrop is the MMX one that survives the enumeration walk -- 145
        // movq/14 pxor sites in its .text, so it exercises the SIMD path.
        dlls: [
          'binaries/plugins/candidates/vis_w.dll',
          'binaries/plugins/candidates/vis_milk.dll',
          'binaries/plugins/vis_avs.dll',
        ],
        files: [
          // Winamp's Visualization prefs enumerate C:\Plugins\*.DLL when that
          // pane opens. The AVS here is the 2.6.1 that this Winamp's own 2.95
          // installer extracts -- the 2.8 in plugins/candidates is the Winamp 5
          // build, and its enumeration entry point never returns, which takes
          // the whole pane down with it. AVS resolves its own config against
          // the Winamp directory, so vis_avs.dat and the .ape effect library
          // are mounted at the root rather than under plugins.
          { url: 'binaries/plugins/in_mp3.dll', vfsPath: 'c:\\plugins\\in_mp3.dll' },
          { url: 'binaries/plugins/out_wave.dll', vfsPath: 'c:\\plugins\\out_wave.dll' },
          { url: 'binaries/plugins/candidates/vis_w.dll', vfsPath: 'c:\\plugins\\vis_w.dll' },
          { url: 'binaries/plugins/candidates/vis_milk.dll', vfsPath: 'c:\\plugins\\vis_milk.dll' },
          { url: 'binaries/plugins/vis_avs.dll', vfsPath: 'c:\\plugins\\vis_avs.dll' },
          { url: 'binaries/plugins/vis_avs.dat', vfsPath: 'c:\\vis_avs.dat' },
          { url: 'binaries/plugins/avs/fyrewurx.ape', vfsPath: 'c:\\avs\\fyrewurx.ape' },
          'binaries/demo.mp3',
          'binaries/winamp.ini',
          'binaries/winamp.m3u',
          'binaries/whatsnew.txt',
        ],
        winampDemo: 'C:\\demo.mp3',
        resetIniOnLaunch: ['winamp.ini'],
      },
      // Winamp pointed at a tracker module instead of an mp3. Kept separate
      // from `winamp` on purpose: the Visualization prefs pane enumerates
      // C:\Plugins\*.DLL and does not survive a non-visualizer plug-in in that
      // directory, so in_mod.dll cannot join the vis fixture.
      //
      // Not an MMX A/B, despite appearances. in_mod does compute a CPU-feature
      // byte (detector at 0x1000d379, result stored to 0x1001fd98) and does
      // pass it to the mixer factory at 0x1001018d, and --no-mmx does flip it
      // -- 0x01 vs 0x00, checked with --dump. But the mixer it actually runs is
      // the same either way: --handler-hist --handler-hist-thread=3 puts the
      // identical MMX blocks (0x1000d911..0x1000d9b3) on top in both configs,
      // ~19% of the decode thread's dispatches. The byte selects something,
      // just not whether the mix is vectorised.
      winamp_mod: {
        exe: 'binaries/winamp.exe',
        inputHooks: WINAMP_INPUT_HOOKS,
        // Preloaded as well as mounted: LoadLibraryA resolves a guest path
        // against already-loaded modules and never opens the VFS.
        dlls: ['binaries/plugins/in_mod.dll'],
        files: [
          { url: 'binaries/plugins/in_mod.dll', vfsPath: 'c:\\plugins\\in_mod.dll' },
          { url: 'binaries/plugins/out_wave.dll', vfsPath: 'c:\\plugins\\out_wave.dll' },
          { url: 'binaries/devhell1.xm', vfsPath: 'c:\\devhell1.xm' },
          'binaries/winamp.ini',
          'binaries/whatsnew.txt',
        ],
        args: 'C:\\devhell1.xm',
        winampDemo: 'C:\\devhell1.xm',
        resetIniOnLaunch: ['winamp.ini'],
      },
      winamp291_inst: { exe: 'binaries/installers/winamp291.exe' },
      winamp295_inst: { exe: 'binaries/installers/winamp295.exe' },
      mirc59:     { exe: 'binaries/installers/mirc59.exe' },
      abedemo:    { exe: 'binaries/shareware/abe/installed/abedemo.exe', files: [
        'binaries/shareware/abe/installed/gamebgn.ddv',
        'binaries/shareware/abe/installed/r1p18p19.ddv',
        'binaries/shareware/abe/installed/r1p19p18.ddv',
        'binaries/shareware/abe/installed/demoopen.ddv',
        'binaries/shareware/abe/installed/c1.lvl',
        'binaries/shareware/abe/installed/r1.lvl',
        'binaries/shareware/abe/installed/s1.lvl',
        'binaries/shareware/abe/installed/readme.txt',
      ], touchControls: {
        dpad: { pos: 'bl', ways: 8 },
        buttons: [
          { vk: 0x20, label: 'Jump', pos: 'br' },
          { vk: 0x11, label: 'Action', pos: 'br', row: 1 },
          { vk: 0x10, label: 'Run', pos: 'br', row: 2 },
        ],
      } },
      aoe1:       { exe: 'binaries/shareware/aoe/aoe_ex/Empires.exe', files: aoe1Files, requiredFiles: true, fileConcurrency: 10 },
      // The TTFs each of these three ships are the faces its installer would
      // have put in the Windows font directory; mounted here, they answer by
      // name instead of falling through to the default face.
      // The .drs archives hold the interface/game graphics, while the trial
      // campaign and scenarios are loose files enumerated only after a player
      // has been created. Keep the registry complete for both web and CLI.
      aoe2:       { exe: 'binaries/shareware/aoe2/aoe2_ex/EMPIRES2.EXE',
        fileConcurrency: 10, files: aoe2Files, requiredFiles: true,
        perf: {
          // One drawn game frame: 0x005d27e1 `call 0x00444100`, whose
          // 0x004441fb call to 0x00444420 Blts the frame to the primary
          // (the only Blt in steady gameplay); verifier = that call's return
          // landing. 1:1 with the Blt in --count runs (docs/re-notes/aoe2-trial.md).
          logicalFrame: { label: 'FRAME', address: 0x00444100, verifier: 0x005d27e6 },
        },
      },
      mcm:        {
        exe: 'binaries/shareware/mcm/mcm_ex/MCM.EXE',
        files: mcmFiles,
        workingDirectory: mcmInstallRoot,
        requiredFiles: true,
        fileConcurrency: 10,
        persistFiles: [mcmInstallRoot + 'ui\\uilst.ini',
          mcmInstallRoot + 'ui\\profile\\*\\*.prf'],
      },
      mw3:        { exe: 'binaries/shareware/mw3/ex/Program_Files/mech3demo.exe', files: [
        'binaries/shareware/mw3/ex/Font_Files/arial.ttf',
        'binaries/shareware/mw3/ex/Font_Files/impact.ttf',
        'binaries/shareware/mw3/ex/Font_Files/lucon.ttf',
        ...mw3DatabaseFiles,
      ], dlls: [
        // MW3 imports std::_Lockit's constructor/destructor from the VC++ 5
        // runtime shipped by its installer. The browser cannot discover the
        // sibling Shared_DLLs directory the CLI searches, so carry the exact
        // runtime beside the app manifest as an explicit load seed. Its menu
        // captions are resolved through the installer's Mech3Msg resource DLL;
        // preload that too because it is not in the EXE import table.
        'binaries/shareware/mw3/ex/Shared_DLLs/MSVCP50.DLL',
        'binaries/shareware/mw3/ex/Program_Files/Mech3Msg.dll',
      ], requiredFiles: true, fileConcurrency: 10, copySuperops: true,
        // Game step: 0x46aa90, the active state's per-frame callback (reached
        // from WinMain through the state table at 0x58e118), which runs
        // input, update and the scene, then presents through 0x5419c0.
        // Verifier: that present call's return 0x46aa79.
        perf: { logicalFrame: { label: 'GAME', address: 0x0046aa90, verifier: 0x0046aa79 } } },
      rct:        { exe: 'binaries/shareware/rct/English/RCT.exe', files: rctFiles, requiredFiles: true, fileConcurrency: 10 },
      // Exceed's Mekka & Symposium 2000 64K intro. Its first window is a
      // setup dialog; command 1 is the Run/OK button that starts the demo.
      heaven7: {
        exe: 'binaries/demoscene/heaven-seven/HEAVEN7W.EXE',
        // Its dense payload is unpacked around the setup dialog. A generic
        // 100k cooperative slice delays the Start timer and looks frozen;
        // 5k stays responsive, while a Worker keeps the efficient 100k size.
        runSlice: { cooperative: 5000, worker: 100000 },
        dismissStartupDialog: { command: 1 },
      },
      // Aardbei's DreamHack 1999 64K intro. The documented "w" switch keeps
      // its 512x384 DrawDib presentation in a desktop window.
      cashcow: {
        exe: 'binaries/demoscene/cashcow/CASHCOW.EXE',
        args: 'w',
      },
      // Hellcore & Omnicolour's Win32 port of their Takeover 1999 winner.
      // Command 1002 is the setup dialog's Start button.
      bakkslide7: {
        exe: 'binaries/demoscene/bakkslide7/BAKKSLIDE7.EXE',
        // Like Heaven Seven, unpacking needs short cooperative turns but has
        // no reason to pay that scheduling overhead inside a guest Worker.
        runSlice: { cooperative: 5000, worker: 100000 },
        // Its fullscreen DirectDC path writes outside DirectDraw's presented
        // surfaces. Select the real 4:3-window radio first: that path uses its
        // MMX surface transfer and gives the browser a normal primary frame.
        dismissStartupDialogs: [{ control: 1001 }, { command: 1002 }],
        // Its packed payload takes several seconds to build the DirectDraw
        // window after the setup dialog closes on the browser interpreter.
        windowlessGraceMs: 30000,
      },
      // Aardbei's Mekka & Symposium 2000 OpenGL 64K intro. The first window
      // is its resolution chooser; command 1 starts the selected mode.
      ptct: {
        exe: 'binaries/demoscene/ptct/PTCT.exe',
        dismissStartupDialog: { command: 1 },
        windowlessGraceMs: 30000,
      },
      dx_ddex1:   { exe: 'binaries/dx-sdk/bin/ddex1.exe', files: dxSdkBinFiles },
      dx_ddex2:   { exe: 'binaries/dx-sdk/bin/ddex2.exe', files: dxSdkBinFiles },
      dx_ddex3:   { exe: 'binaries/dx-sdk/bin/ddex3.exe', files: dxSdkBinFiles },
      // presentCap: 60 on ddex4/ddex5. Measured 2026-09-28 (box, headless
      // Chrome): ~100,000 Flips/s and 99% of a core uncapped, 60-69/s and
      // 10-11% capped. Uncapped, only 89 of ~44,000 presents per guest second
      // change the picture. Each sprite steps its animation when GetTickCount
      // is more than 50, 78 or 13 ms past its last step (0x401040 in ddex4).
      // The cap rounds those periods up to whole frames: 60 steps/s instead
      // of ~71 for the 13 ms sprite, and ~15 instead of ~20 for the 50 ms one.
      // A real vsync'd Flip at 60 Hz rounded them the same way.
      dx_ddex4:   { exe: 'binaries/dx-sdk/bin/ddex4.exe', files: dxSdkBinFiles, presentCap: 60 },
      dx_ddex5:   { exe: 'binaries/dx-sdk/bin/ddex5.exe', files: dxSdkBinFiles, presentCap: 60 },
      dx_flip2d:  { exe: 'binaries/dx-sdk/bin/flip2d.exe', files: dxSdkBinFiles },
      dx_palette: { exe: 'binaries/dx-sdk/bin/palette.exe', files: dxSdkBinFiles },
      dx_stretch: { exe: 'binaries/dx-sdk/bin/stretch.exe', files: dxSdkBinFiles },
      dx_donut:   { exe: 'binaries/dx-sdk/bin/donut.exe', files: dxSdkBinFiles },
      // presentCap: 60. Measured 2026-09-28 on its title screen, 735 -> 60
      // presents/s and 98% -> 23% of a core in headless Chrome. Gameplay is
      // not reachable: Enter shows LEVEL 001, then the game calls a
      // released DirectInput device through NULL. It had been refused
      // IDirectInputDevice2A because its DirectInput was created at version
      // 0x300. The LEVEL 001 screen is timed: on the 16 ms/batch CLI clock it
      // lasted 3.0 guest-s uncapped and 2.9 capped.
      dx_donuts:  { exe: 'binaries/dx-sdk/bin/donuts.exe', files: dxSdkBinFiles, presentCap: 60 },
      dx_foxbear: { exe: 'binaries/dx-sdk/foxbear/foxbear.exe', files: ['binaries/dx-sdk/foxbear/foxbear.art'] },
      dx_tunnel:  { exe: 'binaries/dx-sdk/bin/tunnel.exe', files: dxSdkBinFiles },
      dx_twist:   { exe: 'binaries/dx-sdk/bin/twist.exe', files: dxSdkBinFiles },
      dx_boids:   { exe: 'binaries/dx-sdk/bin/boids.exe', files: dxSdkBinFiles },
      dx_globe:   { exe: 'binaries/dx-sdk/bin/globe.exe', files: dxSdkBinFiles },
      dx_bellhop: { exe: 'binaries/dx-sdk/bin/bellhop.exe', files: dxSdkBinFiles },
      dx_viewer:  { exe: 'binaries/dx-sdk/bin/viewer.exe', files: dxViewerFiles },
      dx_flip3dtl: { exe: 'binaries/dx-sdk/bin/flip3dtl.exe', files: dxSdkBinFiles },
      dx_wormhole: { exe: 'binaries/dx-sdk/bin/wormhole.exe', files: dxSdkBinFiles },
      // presentCap: 60 on the D3DRM screensavers below. Measured 2026-09-25
      // (box, headful): 94-3397 presents/s uncapped, and run.js
      // --present-distinct finds 100% of their presents change the picture
      // (OASAVER 12.9%, still ~400 real frames/s) -- an honest frame rate
      // above the cap. Capped, displayed frames rose (OASAVER 13 -> 38/s,
      // GEOMETRY 34 -> 57/s). SCR_WIN98 self-paces at 20/s and is left alone.
      scr_architec: { exe: 'binaries/screensavers/ARCHITEC.SCR', args: '/s', presentCap: 60, files: [
        'binaries/screensavers/ARCHITEC.SCN',
        'binaries/screensavers/AR_MESH.X',
        'binaries/screensavers/AR_TEXTU.GIF',
        'binaries/screensavers/AR_WALLP.GIF',
        'binaries/screensavers/AR_WALLP.PAL',
        'binaries/screensavers/AR_WVLFT.BMP',
        'binaries/screensavers/AR_WVLIN.GIF',
      ] },
      scr_cathy:    { exe: 'binaries/screensavers/CATHY.SCR', args: '/s' },
      scr_cityscap: { exe: 'binaries/screensavers/CITYSCAP.SCR', args: '/s' },
      scr_corbis:   { exe: 'binaries/screensavers/CORBIS.SCR', args: '/s', requiredFiles: true,
        files: plus98ThemeFrames('CP_SCN', 16, 'corbis') },
      scr_doonbury: { exe: 'binaries/screensavers/DOONBURY.SCR', args: '/s' },
      scr_fallingl: { exe: 'binaries/screensavers/FALLINGL.SCR', args: '/s', presentCap: 60, requiredFiles: true, files: screenSaverFiles([
        'FALLINGL.SCN', 'LEAF.X', 'LEAF1.GIF', 'LEAF2.GIF', 'LEAF2.X', 'LEAVES.GIF',
      ]) },
      scr_fashion:  { exe: 'binaries/screensavers/FASHION.SCR', args: '/s', requiredFiles: true,
        files: plus98ThemeFrames('FA_SCN', 13, 'fashion') },
      scr_foxtrot:  { exe: 'binaries/screensavers/FOXTROT.SCR', args: '/s' },
      scr_ga_saver: { exe: 'binaries/screensavers/GA_SAVER.SCR', args: '/s' },
      scr_geometry: { exe: 'binaries/screensavers/GEOMETRY.SCR', args: '/s', presentCap: 60, requiredFiles: true, files: screenSaverFiles([
        'GEOMETRY.SCN', 'GE_BACK.GIF', 'GE_MESH1.X', 'GE_MESH2.X',
      ]) },
      scr_horror:   { exe: 'binaries/screensavers/HORROR.SCR', args: '/s', requiredFiles: true,
        files: plus98ThemeFrames('HO_SCR', 15, 'horror') },
      scr_jazz:     { exe: 'binaries/screensavers/JAZZ.SCR', args: '/s', presentCap: 60, requiredFiles: true, files: screenSaverFiles([
        'JAZZ.SCN', 'JA_NOTE2.X', 'JA_NOTE4.X',
      ]) },
      scr_oasaver:  { exe: 'binaries/screensavers/OASAVER.SCR', args: '/s', presentCap: 60, requiredFiles: true, files: organicArtSceneFiles },
      scr_peanuts:  { exe: 'binaries/screensavers/PEANUTS.SCR', args: '/s' },
      scr_phodisc:  { exe: 'binaries/screensavers/PHODISC.SCR', args: '/s' },
      scr_rockroll: { exe: 'binaries/screensavers/ROCKROLL.SCR', args: '/s', presentCap: 60, requiredFiles: true, files: screenSaverFiles([
        'ROCKROLL.SCN', 'RO_GIT.X', 'RO_PICK.X', 'RO_BACK.GIF', 'RO_TEX01.GIF',
        'RO_WVLIN.GIF', 'RO_WALLP.PAL',
      ]) },
      scr_scifi:    { exe: 'binaries/screensavers/SCIFI.SCR', args: '/s', presentCap: 60, requiredFiles: true, files: screenSaverFiles([
        'SCIFI.SCN', 'SF_BACK.GIF', 'SF_BIRD.GIF', 'SF_PINCE.X',
      ]) },
      scr_win98:    { exe: 'binaries/screensavers/WIN98.SCR', args: '/s' },
      scr_wotravel: { exe: 'binaries/screensavers/WOTRAVEL.SCR', args: '/s', requiredFiles: true,
        files: plus98ThemeFrames('WO_SCN', 14, 'wotravel') },
    };

  // Reuse the installed payload and scheduling policy; only the game's
  // original renderer selection differs. Do not preload d2glide.dll: the
  // game loads its chosen renderer dynamically after reading VideoConfig.
  APPS.diablo2_glide_demo = {
    ...APPS.diablo2_demo,
    startupRegistry: APPS.diablo2_demo.startupRegistry.map(entry => ({ ...entry,
      ...(entry.valueName === 'Render' ? { data: 3 } : {}) })),
  };

  // Mounted-media identities are generated at runtime rather than declared
  // as APPS entries. They still own their measured scheduling policy here,
  // and installed children preserve the identity through runSliceAppKey.
  const MEDIA_RUN_SLICE = Object.freeze({
    // The localized Speed Demons WISE installer spends its copy phase in a
    // Win16 decompressor and 32KB _lwrite loop. Its measured 500k path remains
    // responsive because the installer pumps messages between chunks.
    'cue:speed-demons': Object.freeze({ cooperative: 500000 }),
    'iso:speed-demons': Object.freeze({ cooperative: 500000 }),
    // Quick Start builds the first SMAC world synchronously. This measured
    // budget turns the otherwise static-looking terrain phase into practical
    // progress.
    'iso:sidmeieralphacentauriclassic-windows95':
      Object.freeze({ cooperative: 500000 }),
  });

  // Diablo is intentionally absent. Browser A/Bs measured essentially the
  // same cumulative blocked time at 100k and 20k (12159ms versus 12224ms),
  // while the smaller value also cut the Worker budget fivefold. See
  // docs/re-notes/diablo-shareware.md.

  // A cooperative budget is a ceiling, not a duration: _runCooperativeSlice in
  // host.js runs ~1ms quanta and stops at 8ms of wall clock whatever the block
  // count says. So compatibility dispatch (no wasm tail calls: iOS before
  // Safari 18.2) gets the same default. It used to be capped at 500 blocks, a
  // July value from before that deadline existed; measured on an iPhone with
  // Moorhuhn 2 it held the guest to ~14% of the main thread and 0.64 presents/s,
  // starving fmod into repeating its buffer. 20000 gave 9.6/s at an 8ms step
  // p50 with 60fps page composite, and 100000 no more than that. Stack depth
  // does not depend on this number either: $run bounds each inner chain.
  const DEFAULT_RUN_SLICE = 100000;

  function resolveRunSlice(appKey, compatDispatch = false, workerMode = false) {
    const app = APPS[appKey];
    const policy = (app && app.runSlice) || MEDIA_RUN_SLICE[appKey];
    if (!policy) return DEFAULT_RUN_SLICE;
    if (workerMode && Number.isFinite(policy.worker) && policy.worker > 0) {
      return policy.worker;
    }
    if (compatDispatch && Number.isFinite(policy.compat) && policy.compat > 0) {
      return policy.compat;
    }
    return Number.isFinite(policy.cooperative) && policy.cooperative > 0
      ? policy.cooperative : DEFAULT_RUN_SLICE;
  }

  function appFileUrl(file) {
    if (!file) return "";
    return typeof file === "string" ? file : (file.url || "");
  }

  // COPY_RUN remains rollback-gated. Both hosts read the app opt-in, while
  // the CLI also has explicit A/B flags; a deliberate `--no-…` must win over
  // both the registry and an accidental simultaneous enable flag.
  function resolveCopySuperops(app, explicitEnable, explicitDisable) {
    if (explicitDisable) return false;
    return !!explicitEnable || !!(app && app.copySuperops);
  }

  // Stamp the generated byte sizes (lib/app-file-sizes.generated.js, written
  // by tools/gen-app-file-sizes.js) onto the inline files[] entries. The
  // lazy-file policy (lib/app-files.js) streams a large data file only when it
  // knows its size, and both hosts read this registry, so a size recorded here
  // gives the page and run.js the same decision. An entry that already says
  // how it loads (size, loadMode, httpRange) is left exactly as written.
  (function stampFileSizes() {
    if (typeof process !== "undefined" && process.env && process.env.WA_APP_FILE_SIZES_OFF) return;
    let sizes = null;
    if (typeof window !== "undefined" && window.wineAppFileSizes) sizes = window.wineAppFileSizes;
    else if (typeof require === "function") {
      try { sizes = require("./app-file-sizes.generated.js"); } catch (_) { sizes = null; }
    }
    if (!sizes) return;
    for (const app of Object.values(APPS)) {
      if (!Array.isArray(app.files)) continue;
      app.files = app.files.map(item => {
        const url = typeof item === "string" ? item : item && item.url;
        const size = url ? sizes[url] : undefined;
        if (!Number.isSafeInteger(size)) return item;
        if (typeof item === "string") return { url: item, size };
        if (Number.isSafeInteger(item.size) || item.loadMode !== undefined ||
            item.httpRange !== undefined) return item;
        return { ...item, size };
      });
    }
  })();

  const wineApps = {
    APPS, DESKTOP_APPS, LOCAL_CANDIDATE_APPS, DEBUG_ONLY_APPS,
    appFileUrl, resolveCopySuperops, resolveRunSlice,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = wineApps;
  if (typeof window !== "undefined") window.wineApps = wineApps;
})();
