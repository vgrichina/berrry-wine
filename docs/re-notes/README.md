# Reverse-engineering notes

One file per guest binary we have dug into, holding the facts that are expensive
to re-derive and cheap to write down: module load bases, container/asset layout,
which Win32 or COM paths the app actually uses, the function addresses we have
already disassembled, and the hypotheses that have been *ruled out*.

These notes exist because the same disassembly keeps getting redone. Before
starting an investigation on an app that has a file here, read it. When you
finish one, add what you learned.

Paint dock-collapse geometry and remaining repaint artifacts: [mspaint.md](mspaint.md).

Blobby Volley's `settings.dat` format, the per-player CONTROL field, why player
two must not be preset to the computer, and why two emulator processes in one
room have to share a wall clock: [blobby-volley.md](blobby-volley.md).

## What belongs here

- **Load bases and address arithmetic.** Runtime VA ↔ original VA per module.
- **Asset/container layout** — archive formats, offsets, how the app reads them.
- **Traced API profile** — which APIs the app calls and how often, especially
  when the answer is surprising (Diablo never calls `Blt` or `Flip`).
- **Named addresses.** Every function entry we have identified, with what it does.
- **Reproduction commands** that reach a given screen headlessly.
- **Dead ends, explicitly.** A hypothesis someone spent an hour disproving is
  worth as much as a positive finding, and it only stays worth that if it is
  written down. Mark withdrawn conclusions rather than deleting them, so nobody
  re-derives them from an old transcript.

## What does not belong here

- Emulator-side design (that is `docs/*.md` proper) or the memory map of our own
  linear memory (`docs/memory-map.md`).
- Anything a tool prints on demand. Record the *command*, not a stale dump.

## Ground rules

- **Say how each number was obtained.** A VA with no provenance is a rumor.
  Prefer a one-line command the reader can re-run.
- **Runtime bases shift.** They depend on load order and on every preceding
  module's `sizeOfImage`, so they change when the app's DLL set changes. Use the
  `module+0xORIG_VA` syntax in `--trace-at` / `--count` / `--break` instead of
  hand-computing a delta, and treat any base written here as a fact to re-check
  rather than one to trust.
- Disassembly addresses in these files are **original VAs** (what
  `tools/disasm_fn.js` prints for the file on disk) unless a line says otherwise.

## Index

| App | File |
|---|---|
| Abe's Oddysee demo | [abes-oddysee-demo.md](abes-oddysee-demo.md) |
| Age of Empires III trial | [age-of-empires3-demo.md](age-of-empires3-demo.md) |
| Beyond Good and Evil demo | [beyond-good-evil-demo.md](beyond-good-evil-demo.md) |
| Dungeon Lords demo | [dungeon-lords-demo.md](dungeon-lords-demo.md) |
| Age of Empires (1997 shareware demo) | [age-of-empires.md](age-of-empires.md) |
| Arcanum demo | [arcanum-demo.md](arcanum-demo.md) |
| Bricks I | [bricks.md](bricks.md) |
| Civilization II: Multiplayer Gold Edition (Indeo 4 movies, headless Indeo install) | [civilization-2-mge.md](civilization-2-mge.md) |
| DX-Ball | [dxball.md](dxball.md) |
| Enigma 1.01 (SDL + Lua; unregistered; UPX-unpacked route, provider order, open Start Game click blocker) | [enigma.md](enigma.md) |
| Diablo pre-release demo (1996) | [diablo-demo.md](diablo-demo.md) |
| Diablo II Shareware demo | [diablo2-demo.md](diablo2-demo.md) |
| Diablo Shareware | [diablo-shareware.md](diablo-shareware.md) |
| Diablo retail CD | [diablo-retail.md](diablo-retail.md) |
| Grand Theft Auto 2 Wild Demo | [gta2-demo.md](gta2-demo.md) |
| Half-Life: Uplink | [half-life-uplink.md](half-life-uplink.md) |
| Heroes of Might and Magic III (demo) | [heroes3-demo.md](heroes3-demo.md) |
| Heroes of Might and Magic II (demo) | [heroes2-demo.md](heroes2-demo.md) |
| Hitman: Codename 47 demo | [hitman-demo.md](hitman-demo.md) |
| Taipei (Entertainment Pack) | [taipei.md](taipei.md) |
| Microsoft Hearts Network (Win16) | [mshearts16.md](mshearts16.md) |
| Hype: The Time Quest demo | [hype.md](hype.md) |
| Icy Tower v1.3.1 | [icy-tower.md](icy-tower.md) |
| Jardinains! v1.2 | [jardinains.md](jardinains.md) |
| Rattler Race (Entertainment Pack) | [rattler-race.md](rattler-race.md) |
| Pyramid (Funpack) | [pyramid.md](pyramid.md) |
| Solitaire, 16-bit Win98 (`sol16`) | [sol16.md](sol16.md) |
| FreeCell, 16-bit Win98 (`freecell16`) | [freecell16.md](freecell16.md) |
| JigSawedME 1.3 (VB6; version-resource byte counts) | [jigsawedme.md](jigsawedme.md) |
| Rattler Race (Win16 WEP2, VB1; player is the yellow snake, arrows/mouse steer) | [wep16-rattler.md](wep16-rattler.md) |
| Klotski (Win16 WEP3; route, board geometry, pick arithmetic, selector erase fix) | [wep16-klotski.md](wep16-klotski.md) |
| Tut's Tomb (Win16 WEP2; wndproc map, first-show WM_SIZE fix, hover-then-click) | [wep16-tutstomb.md](wep16-tutstomb.md) |
| Tic Tac Drop (Win16 WEP4, VB3; SOUND by name, drop route, computer never moves) | [wep16-tictacdp.md](wep16-tictacdp.md) |
| Maxwell's Maniac (Win16 WEP4; click slides the gate, WM_TIMER frame = GetDC..ReleaseDC, ~18 Hz) | [wep16-maxwell.md](wep16-maxwell.md) |
| JigSawed (Win16 WEP, VB1; Thunder OK, SetActiveWindow, child-surface clip) | [wep16-jigsawed.md](wep16-jigsawed.md) |
| Cruel (Win16 WEP1; maximize invalidation, redeal rule) | [wep16-cruel.md](wep16-cruel.md) |
| FreeCell (Win16 WEP2; corrupt WEP2 CARDS.DLL fixture, cdtDrawExt modes, move animation) | [wep16-freecell.md](wep16-freecell.md) |
| Moorhuhn 1, 2, Winter-Edition, 3, Tennis and CD extras | [moorhuhn.md](moorhuhn.md) |
| Myth: The Fallen Lords (demo + retail ISO) | [myth-tfl.md](myth-tfl.md) |
| NetHack 3.4.3 for Windows | [nethack-win32.md](nethack-win32.md) |
| Liquid War 5.6.2 | [liquid-war.md](liquid-war.md) |
| Little Fighter 2 v1.9 | [little-fighter-2.md](little-fighter-2.md) |
| War Wind (USA) and War Wind II (Europe) CD installs | [war-wind.md](war-wind.md) |
| Over 1000 Games for Windows (Nodtronics CD) | [over1000games-shareware.md](over1000games-shareware.md) |
| Pawn 3 | [pawn.md](pawn.md) |
| Plus! 98 DirectAnimation theme savers (CORBIS, FASHION, HORROR, WOTRAVEL) | [plus98-directanimation-savers.md](plus98-directanimation-savers.md) |
| Pocket Tanks shareware | [pocket-tanks.md](pocket-tanks.md) |
| Tomb Raider II demo (Venice) | [tomb-raider-2-demo.md](tomb-raider-2-demo.md) |
| Tomb Raider III demo (India/Jungle) | [tomb-raider-3-demo.md](tomb-raider-3-demo.md) |
| Total Annihilation demo | [total-annihilation.md](total-annihilation.md) |
| The Elder Scrolls: Arena (GOG) | [elder-scrolls-arena-gog.md](elder-scrolls-arena-gog.md) |
| Ultima IV: Quest of the Avatar (GOG) | [ultima4-gog.md](ultima4-gog.md) |
| Quake II (demo) | [quake2-demo.md](quake2-demo.md) |
| Forsaken demo (InstallShield 3 DATA.Z, execute-buffer cache slots, licence) | [forsaken-demo.md](forsaken-demo.md) |
| Starlancer demo (packed lancer.exe, self-resolved imports, DirectInput cursor offset, menu route) | [starlancer-demo.md](starlancer-demo.md) |
| Quake III Arena (demo 1.11) | [quake3-demo.md](quake3-demo.md) |
| Re-Volt demo (DirectPlay lobby registration, load-time CRC, licence) | [re-volt-demo.md](re-volt-demo.md) |
| Rollcage demo (working directory, ATD GFX chaining /FRONTEND child, DirectInput-only keys, licence) | [rollcage-demo.md](rollcage-demo.md) |
| Dethkarz demo (Install Path GOB, "Device Libraries" renderers, Glide-default driver dialog, maximized WM_SIZE loop) | [dethkarz-demo.md](dethkarz-demo.md) |
| Shogo demo (LithTech launcher vs direct Client.exe, menu-to-level route, licence) | [shogo-demo.md](shogo-demo.md) |
| MDK2 demo (IS6 groups, launcher config.lua, GL-init deadlock via suspended worker, projective glVertex4fv blocker) | [mdk2-demo.md](mdk2-demo.md) |
| Midtown Madness Trial (D3D device names, absolute DirectInput mouse, mouse driving) | [midtown-madness-trial.md](midtown-madness-trial.md) |
| Monster Truck Madness 2 Trial (MFC CFormView WM_CREATE, DisplayDibWindow, renderer DLL probing) | [monster-truck-madness2-trial.md](monster-truck-madness2-trial.md) |
| Heretic II Demo (early InstallShield 5 cabs, time bomb, GL window position) | [heretic2-demo.md](heretic2-demo.md) |
| Hellbender Trial (System\ install layout, Quick Configuration dialog art) | [hellbender-trial.md](hellbender-trial.md) |
| Expendable Demo (launcher -> Go.exe, registry options, DirectInput Device2, route) | [expendable-demo.md](expendable-demo.md) |
| Rayman 2 demo (Ubi.ini renderer, thread thunk sync, CREATESTRUCT scratch over the PE header) | [rayman2-demo.md](rayman2-demo.md) |
| Incoming demo (Rage, Direct3D; zip tree, menu-to-turret route, in-game key chart) | [incoming-demo.md](incoming-demo.md) |
| Tachyon: The Fringe demo (NovaLogic, Direct3D; IS5 cab, registry D3D cfg, menu-to-cockpit route) | [tachyon-demo.md](tachyon-demo.md) |
| Trespasser demo (DreamWorks Interactive, Direct3D; msvcirt, reserved-page commits, menu-to-level route) | [trespasser-demo.md](trespasser-demo.md) |
| Battlezone demo (Activision, Direct3D; vendor DLLs, sub-1 MB heap fragmentation, INI .trn eager, keypad bindings) | [battlezone-demo.md](battlezone-demo.md) |
| Evolva demo (Direct3D 7; IS5 cab groups, ImageLoader COM self-registration, HKLM XxxDir paths, SearchPath lists, DirectInput COM, vertex-fog specular) | [evolva-demo.md](evolva-demo.md) |
| Requiem: Avenging Angel demo (Direct3D; IS5 files split across 5 volumes, Enter = console, readme keymap) | [requiem-demo.md](requiem-demo.md) |
| Kingpin Demo (Quake II engine GL, loopback timeouts during a slow level load) | [kingpin-demo.md](kingpin-demo.md) |
| Hexen II Demo (GL build vs bundled 3Dfx MiniGL, WinDirect software build, slow meshing) | [hexen2-demo.md](hexen2-demo.md) |
| SiN Demo (Quake II engine GL, long scripted intro before control) | [sin-demo.md](sin-demo.md) |
| Soldier of Fortune Demo (Quake II engine GL; a DLL imports from the EXE; runtime traces only) | [soldier-of-fortune-demo.md](soldier-of-fortune-demo.md) |
| Command & Conquer: Red Alert (Win95 demo) | [red-alert-95-demo.md](red-alert-95-demo.md) |
| Die by the Sword (demo) | [die-by-the-sword-demo.md](die-by-the-sword-demo.md) |
| Dark Colony (magazine demo) | [dark-colony-demo.md](dark-colony-demo.md) |
| Daytona USA Deluxe (Win95 demo) | [daytona-usa-deluxe-demo.md](daytona-usa-deluxe-demo.md) |
| Blood II: The Chosen (demo) | [blood2-demo.md](blood2-demo.md) |
| Sid Meier's Pirates! (2004) | [pirates-2004.md](pirates-2004.md) |
| Disciples: Sacred Lands (demo) | [disciples-demo.md](disciples-demo.md) |
| Commandos: Behind Enemy Lines (demo) | [commandos-demo.md](commandos-demo.md) |
| Age of Wonders (beta demo) | [age-of-wonders-demo.md](age-of-wonders-demo.md) |
| Age of Wonders II (beta demo; world, army moves, UI clean since the viewport clip) | [age-of-wonders2-demo.md](age-of-wonders2-demo.md) |
| Sid Meier's Alpha Centauri (demo) | [alpha-centauri-demo.md](alpha-centauri-demo.md) |
| Betrayal in Antara (demo, parked) | [betrayal-in-antara-demo.md](betrayal-in-antara-demo.md) |
| Comanche Gold (demo, parked) | [comanche-gold-demo.md](comanche-gold-demo.md) |
| Croc 2 (demo, parked) | [croc2-demo.md](croc2-demo.md) |
| Descent: FreeSpace (demo) | [freespace-demo.md](freespace-demo.md) |
| Dark Earth (demo) | [dark-earth-demo.md](dark-earth-demo.md) |
| Asghan (demo, parked) | [asghan-demo.md](asghan-demo.md) |
| Delta Force (demo) | [delta-force-demo.md](delta-force-demo.md) |
| Daikatana (demo, parked) | [daikatana-demo.md](daikatana-demo.md) |
| Crusaders of Might and Magic (demo) | [crusaders-mm-demo.md](crusaders-mm-demo.md) |
| GeneRally | [generally.md](generally.md) |
| Tetravex | [tetravex.md](tetravex.md) |
| TetriNET (two-seat virtual LAN, Delphi) | [tetrinet.md](tetrinet.md) |
| SkiFree (16-bit, WEP3) | [wep16-ski.md](wep16-ski.md) |
| Winarc | [winarc.md](winarc.md) |
| Atlantis: The Lost Tales (demo) | [atlantis-demo.md](atlantis-demo.md) |
| Dark Reign (demo) | [dark-reign-demo.md](dark-reign-demo.md) |
| Descent 3 (demo) | [descent3-demo.md](descent3-demo.md) |
| Anno 1602 (demo) | [anno1602-demo.md](anno1602-demo.md) |
| Drakan: Order of the Flame (demo) | [drakan-demo.md](drakan-demo.md) |
| Braveheart (demo) | [braveheart-demo.md](braveheart-demo.md) |
| Anachronox (demo) | [anachronox-demo.md](anachronox-demo.md) |
| Die Hard: Nakatomi Plaza (demo, in progress) | [diehard-nakatomi-demo.md](diehard-nakatomi-demo.md) |
| Driver (demo) | [driver-demo.md](driver-demo.md) |
| Colin McRae Rally 2.0 (demo) | [cmr2-demo.md](cmr2-demo.md) |
| Populous: The Beginning (demo) | [populous-the-beginning-demo.md](populous-the-beginning-demo.md) |
| Colin McRae Rally (demo) | [colin-mcrae-rally-demo.md](colin-mcrae-rally-demo.md) |
| Aliens versus Predator (Alien demo) | [avp-alien-demo.md](avp-alien-demo.md) |
| Aliens versus Predator (Marine demo) | [avp-marine-demo.md](avp-marine-demo.md) |
| Carmageddon II (demo) | [carmageddon2-demo.md](carmageddon2-demo.md) |
| Rodent's Revenge (Win16) | [wep16-rodent.md](wep16-rodent.md) |
| ScummVM 0.8 — Flight of the Amazon Queen | [scummvm-fotaq.md](scummvm-fotaq.md) |
| Serious Sam: The First Encounter (demo) | [serious-sam.md](serious-sam.md) |
| Outwars (trial) | [outwars-trial.md](outwars-trial.md) |
| Pharaoh (demo) | [pharaoh-demo.md](pharaoh-demo.md) |
| Homeworld (demo) | [homeworld-demo.md](homeworld-demo.md) |
| Giants: Citizen Kabuto (demo) | [giants-demo.md](giants-demo.md) |
| SimCity 2000 Win95 Demo | [simcity-2000-demo.md](simcity-2000-demo.md) |
| SkiFree (Entertainment Pack) | [skifree.md](skifree.md) |
| Snood 2.2W | [snood.md](snood.md) |
| Worms 2 October demo | [worms2-demo.md](worms2-demo.md) |
| Warcraft III: Reign of Chaos demo | [warcraft3-demo.md](warcraft3-demo.md) |
| Windows Installer 2.0 for Win9x (instmsi.exe) | [windows-installer-2.0.md](windows-installer-2.0.md) |
| American McGee's Alice demo | [alice-demo.md](alice-demo.md) |
| Alien Shooter (Reflexive) | [alien-shooter.md](alien-shooter.md) |
| Sid Meier's Alpha Centauri Classic (Win95 ISO) | [alpha-centauri.md](alpha-centauri.md) |
| Age of Empires II Trial | [aoe2-trial.md](aoe2-trial.md) |
| Army Men (1998) original demo (preflight, acquisition, setup, licence pane, CMOS RTC, remote launch, recovery, BltFast observer/conformance) | [army-men-demo.md](army-men-demo.md), [army-men-acquisition.md](army-men-acquisition.md), [army-men-setup-startup.md](army-men-setup-startup.md), [army-men-licence-pane.md](army-men-licence-pane.md), [army-men-cmos-rtc-20261019.md](army-men-cmos-rtc-20261019.md), [army-men-remote-launch-preparation-20261019.md](army-men-remote-launch-preparation-20261019.md), [army-men-authorized-recovery-20261019.md](army-men-authorized-recovery-20261019.md), [army-men-paired-observer-20261020.md](army-men-paired-observer-20261020.md), [army-men-observer-abi-fix-20261020.md](army-men-observer-abi-fix-20261020.md), [army-men-bltfast-conformance-20261020.md](army-men-bltfast-conformance-20261020.md) |
| Arx Fatalis demo (local media, packed-entry allocation, startup fault) | [arx-fatalis-demo.md](arx-fatalis-demo.md), [arx-allocation-correctness-20261007.md](arx-allocation-correctness-20261007.md), [arx-ordinary-startup-fault-20261007.md](arx-ordinary-startup-fault-20261007.md) |
| Atomic Bomberman demo | [atomic-bomberman-demo.md](atomic-bomberman-demo.md) |
| Aliens versus Predator 2 (single-player demo) | [avp2-demo.md](avp2-demo.md) |
| Baldur's Gate II demo | [baldurs-gate2-demo.md](baldurs-gate2-demo.md) |
| Baldur's Gate previews | [baldurs-gate-demos.md](baldurs-gate-demos.md) |
| Barrage 1.0.5 Win32 | [barrage-105.md](barrage-105.md) |
| Beneath a Steel Sky (GOG ScummVM) | [beneath-a-steel-sky-gog.md](beneath-a-steel-sky-gog.md) |
| Beyond Good and Evil Windows demo (second note; see also beyond-good-evil-demo.md) | [beyond-good-and-evil-demo.md](beyond-good-and-evil-demo.md) |
| Black & White 2 demo | [black-white-2.md](black-white-2.md) |
| Broken Sword demo | [broken-sword-demo.md](broken-sword-demo.md) |
| Caesar III demo | [caesar3-demo.md](caesar3-demo.md) |
| Captain Claw demo | [captain-claw-demo.md](captain-claw-demo.md) |
| Carmageddon TDR2000 alpha test demo | [carmageddon-tdr2000-demo.md](carmageddon-tdr2000-demo.md) |
| Warhammer 40,000: Chaos Gate demo | [chaos-gate-demo.md](chaos-gate-demo.md) |
| Circus Linux! 1.0.0 | [circuslinux-100.md](circuslinux-100.md) |
| Colin McRae Rally 3 demo (two notes) | [colin-mcrae-rally-3-demo.md](colin-mcrae-rally-3-demo.md), [colin-mcrae-rally3-demo.md](colin-mcrae-rally3-demo.md) |
| Comanche 3 DOS demo (installer, AH5A review, later execution, memory repair) | [comanche3-demo.md](comanche3-demo.md), [comanche3-ah5a-review-20261007.md](comanche3-ah5a-review-20261007.md), [comanche3-later-execution-20261007.md](comanche3-later-execution-20261007.md), [comanche3-memory-repair-20261007.md](comanche3-memory-repair-20261007.md) |
| Conan (2004) demo | [conan-demo.md](conan-demo.md) |
| Constructor (1997) DOS demo | [constructor-demo.md](constructor-demo.md) |
| Crimsonland (relative pointer input, main-thread exit) | [crimsonland-relative-input-20261008.md](crimsonland-relative-input-20261008.md), [crimsonland-owning-exit-20261008.md](crimsonland-owning-exit-20261008.md) |
| The Curse of Monkey Island demo | [curse-monkey-island-demo.md](curse-monkey-island-demo.md) |
| Classic WordZap (idle audit) | [cwordzap.md](cwordzap.md) |
| The Elder Scrolls II: Daggerfall (GOG) | [daggerfall-gog.md](daggerfall-gog.md) |
| Dark Reign 2 demo | [dark-reign2-demo.md](dark-reign2-demo.md) |
| Darkstone demo 1.0 | [darkstone-demo.md](darkstone-demo.md) |
| Deus Ex demo | [deus-ex-demo.md](deus-ex-demo.md) |
| Deus Ex: Invisible War demo | [deus-ex-invisible-war-demo.md](deus-ex-invisible-war-demo.md) |
| Diablo II (next bounded evidence run, 2026-10-19) | [diablo2-runtime-readiness-20261019.md](diablo2-runtime-readiness-20261019.md) |
| Disciples II demo | [disciples2-demo.md](disciples2-demo.md) |
| Dungeon Keeper demo | [dungeon-keeper-demo.md](dungeon-keeper-demo.md) |
| Dungeon Siege demo (original retry, thread snapshot boundary) | [dungeon-siege-demo.md](dungeon-siege-demo.md), [dungeon-siege-original-retry.md](dungeon-siege-original-retry.md), [dungeon-siege-thread-snapshot.md](dungeon-siege-thread-snapshot.md) |
| Dungeon Siege: Legends of Aranna demo | [dungeon-siege-legends-aranna-demo.md](dungeon-siege-legends-aranna-demo.md) |
| Dungeons of Dredmor (Steam beta, public release) | [dungeons-of-dredmor.md](dungeons-of-dredmor.md), [dungeons-of-dredmor-release.md](dungeons-of-dredmor-release.md) |
| DX5 SDK `boids.exe` | [dx-sdk-boids.md](dx-sdk-boids.md) |
| DX SDK Direct3D Retained Mode samples (globe, viewer, flip3dtl) | [dx-sdk-d3drm-samples.md](dx-sdk-d3drm-samples.md) |
| Elasto Mania 1.0 | [elasto-mania.md](elasto-mania.md) |
| EmPipe (idle audit) | [empipe.md](empipe.md) |
| Fallout Win95 interactive demo | [fallout-demo.md](fallout-demo.md) |
| FIFA 98: Road to World Cup demo | [fifa98-demo.md](fifa98-demo.md) |
| Flight of the Amazon Queen (GOG ScummVM) | [flight-of-the-amazon-queen-gog.md](flight-of-the-amazon-queen-gog.md) |
| Four Stones | [fourstones.md](fourstones.md) |
| Funtris (idle audit) | [funtris.md](funtris.md) |
| Heroes of Might and Magic II demo: why it feels slow (2026-10-04) | [heroes2-performance-20261004.md](heroes2-performance-20261004.md) |
| Hock-A-Loogie | [hock-a-loogie.md](hock-a-loogie.md) |
| Icewind Dale demo | [icewind-dale-demo.md](icewind-dale-demo.md) |
| Interstate '76 Arsenal demo | [interstate76-arsenal-demo.md](interstate76-arsenal-demo.md) |
| Jazz Jackrabbit 2 shareware 1.23s | [jazz2-demo.md](jazz2-demo.md) |
| Jedi Knight: Dark Forces II demo (start with jedi-status; preflight, installer, licence, layout, components input, renderer input, DirectX predicate, alternate recovery) | [jedi-status-20261021.md](jedi-status-20261021.md), [jedi-knight-demo.md](jedi-knight-demo.md), [jedi-knight-installer-handoff.md](jedi-knight-installer-handoff.md), [jedi-original-accept-launch-20261020.md](jedi-original-accept-launch-20261020.md), [jedi-original-layout-install-20261021.md](jedi-original-layout-install-20261021.md), [jedi-components-input-fix-20261020.md](jedi-components-input-fix-20261020.md), [jedi-input-review-integrate-20261020.md](jedi-input-review-integrate-20261020.md), [jedi-directx-predicate-20261021.md](jedi-directx-predicate-20261021.md), [jedi-original-alternate-recovery-20261021.md](jedi-original-alternate-recovery-20261021.md) |
| JezzBall (WEP4) | [jezzball.md](jezzball.md) |
| .kkrieger Chapter I beta | [kkrieger-beta.md](kkrieger-beta.md) |
| Kobo Deluxe 0.5.1 (not acquired: upstream 403) | [kobo-deluxe.md](kobo-deluxe.md) |
| LBreakout2 2.5.1 | [lbreakout2-251.md](lbreakout2-251.md) |
| LMarbles 1.0.8 | [lmarbles-first-launch.md](lmarbles-first-launch.md) |
| Lords of the Realm II demo | [lords2-demo.md](lords2-demo.md) |
| Lure of the Temptress (GOG ScummVM) | [lure-of-the-temptress-gog.md](lure-of-the-temptress-gog.md) |
| Mad Bomber 0.2.5 (start with madbomber-status; package, corpus launch, CRT/DBCS/LockFile checkpoints, MIDI, gameplay, browser FPS) | [madbomber-status-20261021.md](madbomber-status-20261021.md), [madbomber-025.md](madbomber-025.md), [madbomber-corpus-launch-20261020.md](madbomber-corpus-launch-20261020.md), [madbomber-dbcs-contract.md](madbomber-dbcs-contract.md), [madbomber-fdopen-design.md](madbomber-fdopen-design.md), [madbomber-fdopen-retry.md](madbomber-fdopen-retry.md), [madbomber-lockfile-design.md](madbomber-lockfile-design.md), [madbomber-rewind-retry.md](madbomber-rewind-retry.md), [madbomber-after-midi-original-20261020.md](madbomber-after-midi-original-20261020.md), [madbomber-current-main-gameplay-20261021.md](madbomber-current-main-gameplay-20261021.md), [madbomber-browser-gameplay-20261021.md](madbomber-browser-gameplay-20261021.md), [madbomber-browser-fps-20261021.md](madbomber-browser-fps-20261021.md) |
| Marbles (`MARBLES.EXE`) | [marbles.md](marbles.md) |
| MechWarrior 3 demo | [mechwarrior3-demo.md](mechwarrior3-demo.md) |
| Classic Media Player (`mplay32.exe`) | [media-player.md](media-player.md) |
| Messiah demo (MCI error-constant contract) | [messiah-demo.md](messiah-demo.md), [messiah-mci-contract-20261020.md](messiah-mci-contract-20261020.md) |
| Morrowind (GOTY retail ISO) | [morrowind.md](morrowind.md) |
| Motocross Madness demo | [motocross-madness-demo.md](motocross-madness-demo.md) |
| Need for Speed Windows demos (NFS III Glide renderer) | [need-for-speed.md](need-for-speed.md), [need-for-speed-glide.md](need-for-speed-glide.md) |
| Neverwinter Nights demo (native display-list boundary) | [neverwinter-nights-demo.md](neverwinter-nights-demo.md) |
| Nocturne demo | [nocturne-demo.md](nocturne-demo.md) |
| Nox demo | [nox-demo.md](nox-demo.md) |
| Oni demo | [oni-demo.md](oni-demo.md) |
| Organic Art / D3DRM screensavers (Plus! 98) | [organic-art-screensavers.md](organic-art-screensavers.md) |
| Outcast demo | [outcast-demo.md](outcast-demo.md) |
| Outlaws demo (acquisition, first launch, PM/Pro loader, NE bridge, QT_Thunk, KERNEL32 image, guest NE lifecycle) | [outlaws-demo.md](outlaws-demo.md), [outlaws-demo-first-launch.md](outlaws-demo-first-launch.md), [outlaws-pmpro-loader.md](outlaws-pmpro-loader.md), [outlaws-ne-bridge-ownership.md](outlaws-ne-bridge-ownership.md), [outlaws-qt-abi.md](outlaws-qt-abi.md), [outlaws-kernel32-image.md](outlaws-kernel32-image.md), [outlaws-guest-lifecycle.md](outlaws-guest-lifecycle.md) |
| Space Cadet Pinball (mobile presentation) | [pinball.md](pinball.md) |
| Plus! 98 Direct3D screensavers (ARCHITEC, FALLINGL, GEOMETRY, JAZZ, OASAVER, ROCKROLL, SCIFI) | [plus98-dx-screensavers.md](plus98-dx-screensavers.md) |
| Rage of Mages demo | [rage-of-mages-demo.md](rage-of-mages-demo.md) |
| Rage of Mages II: Necromancer demo | [rage-of-mages2-demo.md](rage-of-mages2-demo.md) |
| Recoil demo | [recoil-demo.md](recoil-demo.md) |
| Reflexive corpus compatibility probe | [reflexive.md](reflexive.md) |
| Return Fire demo | [return-fire-demo.md](return-fire-demo.md) |
| Ricochet Xtreme 1.4 | [ricochet-xtreme.md](ricochet-xtreme.md) |
| Rodent's Revenge 2000 (VB6 remake) | [rodent2000.md](rodent2000.md) |
| RollerCoaster Tycoon (demo) | [rollercoaster-tycoon.md](rollercoaster-tycoon.md) |
| Runenlegen | [runenlegen.md](runenlegen.md) |
| Sacrifice demo | [sacrifice-demo.md](sacrifice-demo.md) |
| Sanity: Aiken's Artifact demo | [sanity-demo.md](sanity-demo.md) |
| Shadow Man (genuine DSETUP/VERSION, installed launcher and Configuration) | [shadow-man-dsetup-qualified-20261022.md](shadow-man-dsetup-qualified-20261022.md), [shadow-man-launcher-evidence-accepted-20261023.md](shadow-man-launcher-evidence-accepted-20261023.md) |
| Shadow Warrior Classic Complete (GOG) | [shadow-warrior-gog.md](shadow-warrior-gog.md) |
| Silver demo | [silver-demo.md](silver-demo.md) |
| SimCity 2000 Network Edition demo (2KCLIENT / 2KSERVER) | [simcity-2000-network-edition.md](simcity-2000-network-edition.md) |
| Sid Meier's SimGolf demo | [simgolf-demo.md](simgolf-demo.md) |
| Slave Zero demo | [slave-zero-demo.md](slave-zero-demo.md) |
| Solitaire (NT debug build in Entertainment Pack) | [solitaire.md](solitaire.md) |
| StarCraft shareware | [starcraft-shareware.md](starcraft-shareware.md) |
| SuperTux 0.1.3 | [supertux-013.md](supertux-013.md) |
| System Shock 2 demo | [system-shock2-demo.md](system-shock2-demo.md) |
| Thief II: The Metal Age demo | [thief2-demo.md](thief2-demo.md) |
| Tony Hawk's Pro Skater 2 demo | [thps2-demo.md](thps2-demo.md) |
| Command & Conquer: Tiberian Sun demo | [tiberian-sun-demo.md](tiberian-sun-demo.md) |
| Tile World | [tile-world.md](tile-world.md) |
| Total Annihilation demo (second note; see also total-annihilation.md) | [total-annihilation-demo.md](total-annihilation-demo.md) |
| Turok 2 demo | [turok2-demo.md](turok2-demo.md) |
| Unreal-family demo installers | [unreal-family-demos.md](unreal-family-demos.md) |
| Urban Chaos demo | [urban-chaos-demo.md](urban-chaos-demo.md) |
| Visual Basic 5.0 CCE (and other free VB/Delphi editions) | [visual-basic-5-cce.md](visual-basic-5-cce.md) |
| Warcraft III demo: 512 KiB integration (2026-10-22) | [wc3-512-integration-20261022.md](wc3-512-integration-20261022.md) |
| Chip's Challenge (Win16 WEP4) | [wep16-chips.md](wep16-chips.md) |
| Fuji Golf (Win16 WEP3) | [wep16-fujigolf.md](wep16-fujigolf.md) |
| Go Figure! (Win16 WEP4) | [wep16-gofigure.md](wep16-gofigure.md) |
| Tetris for Windows (Win16 WEP1) | [wep16-tetris.md](wep16-tetris.md) |
| TriPeaks (Win16 WEP) | [wep16-tripeaks.md](wep16-tripeaks.md) |
| WordZap (Win16 WEP3; display-DC publication) | [wep16-wordzap.md](wep16-wordzap.md) |
| Winamp wVis popup routing | [winamp-wvis.md](winamp-wvis.md) |
| WinBoard 4.2.7 (GNU Chess route) | [winboard.md](winboard.md) |
| Worms Armageddon demo | [worms-armageddon-demo.md](worms-armageddon-demo.md) |

## Cross-cutting and dated investigation notes

These files cover a subsystem shared by many apps, or are dated reports from a
single bounded task. They are not per-binary notes, but they are indexed here so
nobody redoes them.

| Topic | Files |
|---|---|
| CRT functions (descriptor metadata, `_iob`, `_fdopen`, `_fpreset`, rewind, setbuf, setjmp) | [crt-descriptor-prerequisite.md](crt-descriptor-prerequisite.md), [crtdll-iob.md](crtdll-iob.md), [crt-fdopen-binary.md](crt-fdopen-binary.md), [crt-fpreset.md](crt-fpreset.md), [crt-rewind.md](crt-rewind.md), [crt-setbuf.md](crt-setbuf.md), [crt-setjmp.md](crt-setjmp.md) |
| Callback invocation ownership (census, CRT init/exit, qsort, bsearch, property sheets, synchronous window, multimedia timer, token concurrency) | [callback-ownership-census.md](callback-ownership-census.md), [callback-census-reconcile-20261020.md](callback-census-reconcile-20261020.md), [crt-init-exit-invocation-ownership.md](crt-init-exit-invocation-ownership.md), [qsort-invocation-ownership.md](qsort-invocation-ownership.md), [bsearch-invocation-ownership.md](bsearch-invocation-ownership.md), [propsheet-invocation-ownership.md](propsheet-invocation-ownership.md), [sync-window-invocation-ownership.md](sync-window-invocation-ownership.md), [mm-timer-owner-20261021.md](mm-timer-owner-20261021.md), [callback-token-concurrency-20261021.md](callback-token-concurrency-20261021.md), [circus-icm-native-fixture-20261020.md](circus-icm-native-fixture-20261020.md) |
| COM ownership and token boundaries (JS callbacks, public activation, compiled tokens, native acceptance) | [js-com-callback-owner-20261020.md](js-com-callback-owner-20261020.md), [js-com-owner-review-20261020.md](js-com-owner-review-20261020.md), [com-public-activation-ownership-20261020.md](com-public-activation-ownership-20261020.md), [com-token-real-boundaries-20261020.md](com-token-real-boundaries-20261020.md), [com-token-integrate-sparse-review-20261020.md](com-token-integrate-sparse-review-20261020.md), [com-native-qualified-20261020.md](com-native-qualified-20261020.md) |
| Audio and MIDI (beep lifetime, saved carry, MIDI stream/timing, native MIDI, MCI integration) | [beep-output-prerequisite.md](beep-output-prerequisite.md), [audio-saved-carry-20261020.md](audio-saved-carry-20261020.md), [audio-carry-lifecycle-review-20261020.md](audio-carry-lifecycle-review-20261020.md), [midi-stream-lifecycle-20261020.md](midi-stream-lifecycle-20261020.md), [midi-timing-corrections-20261020.md](midi-timing-corrections-20261020.md), [midi-native-qualified-20261020.md](midi-native-qualified-20261020.md), [mci-audited-integration-20261020.md](mci-audited-integration-20261020.md) |
| D3D palette keys and texture caps (P8 all-key, filtered index, alpha vs key, state144, legacy texture caps) | [d3d-allkey-decode-20261020.md](d3d-allkey-decode-20261020.md), [d3d-allkey-independent-review-20261020.md](d3d-allkey-independent-review-20261020.md), [d3d-alpha-key-contract-20261020.md](d3d-alpha-key-contract-20261020.md), [d3d-filtered-index-identity-20261020.md](d3d-filtered-index-identity-20261020.md), [d3d-index-independent-review-20261020.md](d3d-index-independent-review-20261020.md), [d3d-state144-contract-20261020.md](d3d-state144-contract-20261020.md), [legacy-texture-caps-native-20261020.md](legacy-texture-caps-native-20261020.md), [legacy-caps-early-exit-20261020.md](legacy-caps-early-exit-20261020.md), [legacy-caps-bootstrap-review-20261020.md](legacy-caps-bootstrap-review-20261020.md), [legacy-caps-fixture-review-20261020.md](legacy-caps-fixture-review-20261020.md) |
| D3D9 POSITIONT native IR (2026-10-23 chain, ends in qualified integration) | [render-shared-positiont-ir-20261023.md](render-shared-positiont-ir-20261023.md), [render-positiont-rhw-admission-repair-20261023.md](render-positiont-rhw-admission-repair-20261023.md), [render-positiont-depth-repair-20261023.md](render-positiont-depth-repair-20261023.md), [render-positiont-tiny-rhw-cause-repair-20261023.md](render-positiont-tiny-rhw-cause-repair-20261023.md), [render-positiont-tiny-rhw-independent-review-20261023.md](render-positiont-tiny-rhw-independent-review-20261023.md), [render-positiont-tiny-rhw-native-qualification-20261023.md](render-positiont-tiny-rhw-native-qualification-20261023.md), [render-positiont-allocator-reuse-cause-20261023.md](render-positiont-allocator-reuse-cause-20261023.md), [render-positiont-com-qualification-fixture-20261023.md](render-positiont-com-qualification-fixture-20261023.md), [render-positiont-reuse-independent-qualification-20261023.md](render-positiont-reuse-independent-qualification-20261023.md), [render-positiont-qualified-integrate-20261023.md](render-positiont-qualified-integrate-20261023.md) |
| Window/process lookup ports (FindWindow, process aliases) | [iw-lookup-correct-port-20261020.md](iw-lookup-correct-port-20261020.md), [process-alias-correct-port-20261020.md](process-alias-correct-port-20261020.md) |
| WinHelp native DLL path | [winhelp-native-path-failure-20261020.md](winhelp-native-path-failure-20261020.md), [winhelp-path-review-integration-20261020.md](winhelp-path-review-integration-20261020.md) |
| SetLocalTime virtual calendar | [setlocaltime-compatibility.md](setlocaltime-compatibility.md) |
| Ledger/dashboard reconciliations and saved requests | [alice-return-fire-reconciliation-20261018.md](alice-return-fire-reconciliation-20261018.md), [dashboard-actionable-reconciliation-20261020.md](dashboard-actionable-reconciliation-20261020.md), [telegram-backlog-20261013.md](telegram-backlog-20261013.md) |

## Recovered app and dated investigation notes

Recovered branch investigations retain their observation dates. Their historical
results supplement the current app notes; an old blocker or candidate result does
not replace a newer main finding. Preparation-only and superseded notes are omitted.

| Topic | File |
|---|---|
| Airstrike authentic closure — independent static acceptance, 2026-10-23 | [airstrike-closure-independent-accept-20261023.md](airstrike-closure-independent-accept-20261023.md) |
| Airstrike: dispatched Space → SDL → startup wait | [airstrike-dispatched-space-application-cause-oct27.md](airstrike-dispatched-space-application-cause-oct27.md) |
| Airstrike focus/menu Quit controller — 2026-10-27 | [airstrike-focus-menu-controller-20261027.md](airstrike-focus-menu-controller-20261027.md) |
| Airstrike pre6a — authentic legacy zlib closure, 2026-10-23 | [airstrike-legacy-zlib-20261023.md](airstrike-legacy-zlib-20261023.md) |
| Airstrike original local registration: independent rejection — 2026-10-24 | [airstrike-local-registration-independent-review-20261024.md](airstrike-local-registration-independent-review-20261024.md) |
| Airstrike pre6a original Win32 recovery — 2026-10-23 | [airstrike-original-20261023.md](airstrike-original-20261023.md) |
| Original Airstrike pre6a bounded runtime assignment — 2026-10-24 | [airstrike-original-bounded-runtime-20261024.md](airstrike-original-bounded-runtime-20261024.md) |
| Airstrike sustained ordinary play — 2026-10-27 | [airstrike-sustained-gameplay-20261027.md](airstrike-sustained-gameplay-20261027.md) |
| Original Army Men paired capture: startup blocker | [army-men-actual-scroll-newbox-20261020.md](army-men-actual-scroll-newbox-20261020.md) |
| Army Men actual-call observer: blocked before implementation | [army-men-bltfast-observer-blocker-20261020.md](army-men-bltfast-observer-blocker-20261020.md) |
| GetFullPathName directory separator compatibility | [army-men-fullpath-separator-20261019.md](army-men-fullpath-separator-20261019.md) |
| Army Men original closure and actual Boot Camp capture | [army-men-original-closure-capture-20261020.md](army-men-original-closure-capture-20261020.md) |
| Army Men: actual paired BltFast capture | [army-men-paired-capture-abi-20261020.md](army-men-paired-capture-abi-20261020.md) |
| Army Men runtime closure follow-up: CPU DLL blocker | [army-men-runtime-closure-retry-20261020.md](army-men-runtime-closure-retry-20261020.md) |
| BG-FETCH-IS5-20261011 reconciliation | [bg-is5-extractor-reconcile-20261020.md](bg-is5-extractor-reconcile-20261020.md) |
| Census-fixed callback native acceptance — 2026-10-20 | [callback-native-census-fixed-20261020.md](callback-native-census-fixed-20261020.md) |
| Native COM owner boundaries — 2026-10-20 | [com-native-owner-boundaries-20261020.md](com-native-owner-boundaries-20261020.md) |
| Crimsonland | [crimsonland.md](crimsonland.md) |
| D3D late-batch create rejection, 2026-10-23 | [d3d-late-batch-failure-20261023.md](d3d-late-batch-failure-20261023.md) |
| Independent D3D late-batch fixture acceptance, 2026-10-23 | [d3d-late-batch-independent-qualification-20261023.md](d3d-late-batch-independent-qualification-20261023.md) |
| Recovered D3D native observations, 2026-10-23 | [d3d-memory-recovered-native-qualification-20261023.md](d3d-memory-recovered-native-qualification-20261023.md) |
| Qualified D3D fixture integration, 2026-10-23 | [d3d-qualified-fixture-integration-20261023.md](d3d-qualified-fixture-integration-20261023.md) |
| Independent render-artifact review, 2026-10-23 | [d3d-render-artifact-independent-review-20261023.md](d3d-render-artifact-independent-review-20261023.md) |
| Reserved-page observer source candidate (2026-10-19) | [dungeon-siege-fault-observer.md](dungeon-siege-fault-observer.md) |
| RichEdit / WinHelp public callback fixture — 2026-10-20 | [edit-winhelp-native-fixture-20261020.md](edit-winhelp-native-fixture-20261020.md) |
| Enigma accepted-guards diagnostic startup, 2026-10-24 | [enigma-accepted-guards-startup-20261024.md](enigma-accepted-guards-startup-20261024.md) |
| Enigma unpacked diagnostic: explicit provider set stops at SDL_getenv | [enigma-diagnostic-loader-startup-20261024.md](enigma-diagnostic-loader-startup-20261024.md) |
| Historical Enigma FindFirst compatibility (2026-10-24) | [enigma-historical-findfirst-compat-20261024.md](enigma-historical-findfirst-compat-20261024.md) |
| Enigma: complete explicit providers pass SDL; startup hits output guard | [enigma-provider-complete-startup-20261024.md](enigma-provider-complete-startup-20261024.md) |
| Enigma quiet-filesystem diagnostic startup (2026-10-24) | [enigma-quiet-filesystem-startup-20261024.md](enigma-quiet-filesystem-startup-20261024.md) |
| Enigma recovered-capacity lossless startup, 2026-10-24 | [enigma-recovered-lossless-startup-20261024.md](enigma-recovered-lossless-startup-20261024.md) |
| Enigma: register-derived loader is the embedded Lua package loader | [enigma-register-load-cause-20261024.md](enigma-register-load-cause-20261024.md) |
| Enigma authentic startup: blocked before staging | [enigma-separated-output-authentic-startup-20261024.md](enigma-separated-output-authentic-startup-20261024.md) |
| Enigma authentic single-frame startup: blocked before guest | [enigma-single-frame-authentic-startup-20261024.md](enigma-single-frame-authentic-startup-20261024.md) |
| GLTron integrated original-media static acceptance, 2026-10-29 | [gltron-integrated-real-media-analysis-oct29.md](gltron-integrated-real-media-analysis-oct29.md) |
| Historical quarantine 24 / 102 / 144 — bounded disposition, 2026-10-20 | [historical-three-associations-20261020.md](historical-three-associations-20261020.md) |
| Hock-A-Loogie (1995) — local candidate, static evidence only | [hock-a-loogie-1995.md](hock-a-loogie-1995.md) |
| Input consumption clock repair: acceptance blocker — 2026-10-24 | [input-consumption-clock-domain-repair-blocker-20261024.md](input-consumption-clock-domain-repair-blocker-20261024.md) |
| Input consumption timing technical review — 2026-10-24 | [input-consumption-independent-review-20261024.md](input-consumption-independent-review-20261024.md) |
| IW process-handle selective review — 2026-10-20 | [iw-process-handle-selective-review-20261020.md](iw-process-handle-selective-review-20261020.md) |
| FindWindow selective current-main review — 2026-10-20 | [iw-window-lookup-review-20261020.md](iw-window-lookup-review-20261020.md) |
| Jedi Knight missing-payload diagnosis — 2026-10-21 | [jedi-missing-payload-20261021.md](jedi-missing-payload-20261021.md) |
| Jedi Knight original demo recovery — 2026-10-20 | [jedi-original-recovery-20261020.md](jedi-original-recovery-20261020.md) |
| JS COM real-x86 conformance fixture — 2026-10-20 | [js-com-native-fixture-20261020.md](js-com-native-fixture-20261020.md) |
| JS COM native execution — 2026-10-20 | [js-com-native-run-20261020.md](js-com-native-run-20261020.md) |
| Original legacy D3D capability fixture: native run failed | [legacy-caps-native-run-20261020.md](legacy-caps-native-run-20261020.md) |
| Mad Bomber original SDL error consumer — 2026-10-24 | [madbomber-authentic-sdl-error-consumer-20261024.md](madbomber-authentic-sdl-error-consumer-20261024.md) |
| Current-main WAT MIDI lifecycle qualification: blocked | [madbomber-current-wat-midi-lifecycle-qualification-20261030.md](madbomber-current-wat-midi-lifecycle-qualification-20261030.md) |
| Mad Bomber: midiStreamStop | [madbomber-midi-stream-stop-20261030.md](madbomber-midi-stream-stop-20261030.md) |
| Independent midiStreamStop acceptance (2026-10-30) | [madbomber-midi-stream-stop-independent-20261030.md](madbomber-midi-stream-stop-independent-20261030.md) |
| midiStreamStop integration blocked on current main | [madbomber-midi-stream-stop-main-integration-blocker-20261030.md](madbomber-midi-stream-stop-main-integration-blocker-20261030.md) |
| Mad Bomber native WinMM qualification — 2026-10-20 | [madbomber-native-qualification-20261020.md](madbomber-native-qualification-20261020.md) |
| Mad Bomber WinMM error-text source review — 2026-10-20 | [madbomber-wave-error-text-review-20261020.md](madbomber-wave-error-text-review-20261020.md) |
| Maelstrom accepted boundary: one original guest, 2026-10-24 | [maelstrom-accepted-boundary-guest-20261024.md](maelstrom-accepted-boundary-guest-20261024.md) |
| Maelstrom breakpoint-boundary technical review — REJECT | [maelstrom-breakpoint-boundary-audit-independent-20261024.md](maelstrom-breakpoint-boundary-audit-independent-20261024.md) |
| Maelstrom errno latch: canonical compilation and controlled native observations | [maelstrom-errno-api-canonical-native-20261025.md](maelstrom-errno-api-canonical-native-20261025.md) |
| Maelstrom zero-record errno capture: offline closeout | [maelstrom-errno-trace-reachability-20261024.md](maelstrom-errno-trace-reachability-20261024.md) |
| Original Maelstrom exact select capture: preguest timing blocker | [maelstrom-exact-select-original-capture-20261024.md](maelstrom-exact-select-original-capture-20261024.md) |
| Original Maelstrom corrected-deadline observation — 2026-10-24 | [maelstrom-head-corrected-deadline-capture-20261024.md](maelstrom-head-corrected-deadline-capture-20261024.md) |
| Maelstrom head observer technical review, 2026-10-24 | [maelstrom-head-observer-recovered-accept-20261024.md](maelstrom-head-observer-recovered-accept-20261024.md) |
| Maelstrom 3.0.6 original Win32: one bounded runtime, 2026-10-24 | [maelstrom-original-bounded-runtime-20261024.md](maelstrom-original-bounded-runtime-20261024.md) |
| Maelstrom 3.0.6: original Win32 acquisition and static closure | [maelstrom-original-win32-20261024.md](maelstrom-original-win32-20261024.md) |
| Original Maelstrom: first frame pending in input drain, 2026-10-24 | [maelstrom-poststart-phase-capture-20261024.md](maelstrom-poststart-phase-capture-20261024.md) |
| Maelstrom original post-P state boundary, 2026-10-24 | [maelstrom-poststart-state-cause-20261024.md](maelstrom-poststart-state-cause-20261024.md) |
| Maelstrom reason 8 and the six missed boundaries — 2026-10-24 | [maelstrom-reason8-boundary-cause-20261024.md](maelstrom-reason8-boundary-cause-20261024.md) |
| Maelstrom retained probe technical review, 2026-10-24 | [maelstrom-retained-probe-independent-20261024.md](maelstrom-retained-probe-independent-20261024.md) |
| Maelstrom: final API is select; SDL drain attribution is not established | [maelstrom-sdl-event-drain-cause-20261024.md](maelstrom-sdl-event-drain-cause-20261024.md) |
| Maelstrom: distinguish native errno retry from a CheckSockets return | [maelstrom-select-retry-cause-20261024.md](maelstrom-select-retry-cause-20261024.md) |
| Maelstrom: repeated select returns within the first RunFrame Sync | [maelstrom-select-return-capture-20261024.md](maelstrom-select-return-capture-20261024.md) |
| Maelstrom: single CheckSockets return capture remains unresolved | [maelstrom-single-return-sync-capture-20261024.md](maelstrom-single-return-sync-capture-20261024.md) |
| Maelstrom startup divergence: trace fanout changed the execution budget | [maelstrom-startup-divergence-cause-20261024.md](maelstrom-startup-divergence-cause-20261024.md) |
| Maelstrom Sync: packet barrier, with no overall timeout | [maelstrom-sync-loop-cause-20261024.md](maelstrom-sync-loop-cause-20261024.md) |
| Maelstrom: one bounded packet-return capture did not reach Sync | [maelstrom-sync-packet-return-capture-20261024.md](maelstrom-sync-packet-return-capture-20261024.md) |
| Maelstrom 3.0.6 original Win32: tree-mounted runtime, 2026-10-24 | [maelstrom-tree-mounted-runtime-20261024.md](maelstrom-tree-mounted-runtime-20261024.md) |
| MIDI callback census audit: blocked by unsafe saved frame | [midi-callback-census-20261020.md](midi-callback-census-20261020.md) |
| Final MIDI native observations: canonical build blocked | [midi-native-qualification-20261020.md](midi-native-qualification-20261020.md) |
| NFS II SE original installer reference attempt (2026-10-28) | [nfs2se-original-installer-output-20261028.md](nfs2se-original-installer-output-20261028.md) |
| Penguin Command: bounded cannon block-entry decision trace, 2026-10-24 | [penguin-command-cannon-block-decision-20261024.md](penguin-command-cannon-block-decision-20261024.md) |
| Penguin Command matched ordinary-firing experiment, 2026-10-24 | [penguin-command-controlled-firing-gameplay-20261024.md](penguin-command-controlled-firing-gameplay-20261024.md) |
| Penguin Command immediate A-key state, 2026-10-24 | [penguin-command-immediate-shot-state-20261024.md](penguin-command-immediate-shot-state-20261024.md) |
| Penguin Command original static closure: technical review, 2026-10-23 | [penguin-command-independent-closure-accept-20261023.md](penguin-command-independent-closure-accept-20261023.md) |
| Original Penguin Command integrated-clock firing checkpoint, 2026-10-24 | [penguin-command-integrated-clock-firing-20261024.md](penguin-command-integrated-clock-firing-20261024.md) |
| Penguin Command original Windows recovery — 2026-10-23 | [penguin-command-original-20261023.md](penguin-command-original-20261023.md) |
| Penguin Command 1.6.11 original runtime prerequisite blocker — 2026-10-24 | [penguin-command-original-bounded-runtime-20261024.md](penguin-command-original-bounded-runtime-20261024.md) |
| Penguin Command original A-key path, 2026-10-24 | [penguin-command-original-keypath-cause-20261024.md](penguin-command-original-keypath-cause-20261024.md) |
| Original Penguin Command matched firing test, 2026-10-24 | [penguin-command-postrelease-matched-firing-20261024.md](penguin-command-postrelease-matched-firing-20261024.md) |
| Original Penguin Command quiet execution, 2026-10-24 | [penguin-command-quiet-original-gameplay-20261024.md](penguin-command-quiet-original-gameplay-20261024.md) |
| Penguin Command 1.6.11 retained executable closure — 2026-10-23 | [penguin-command-retained-closure-20261023.md](penguin-command-retained-closure-20261023.md) |
| Original Penguin Command 1.6.11 execution, 2026-10-24 | [penguin-command-retained-codec-gameplay-20261024.md](penguin-command-retained-codec-gameplay-20261024.md) |
| Original Penguin visible-projectile attempt, 2026-10-27 | [penguin-visible-projectile-gameplay-20261027.md](penguin-visible-projectile-gameplay-20261027.md) |
| Quake II Outer Base: gameplay map and frozen-CLI lessons | [quake2-outer-base-gameplay-map.md](quake2-outer-base-gameplay-map.md) |
| Independent region-census acceptance: REJECT | [region-census-independent-accept-20261027.md](region-census-independent-accept-20261027.md) |
| POSITIONT COM fixture technical review, 2026-10-23 | [render-positiont-com-fixture-independent-review-20261023.md](render-positiont-com-fixture-independent-review-20261023.md) |
| Independent repaired POSITIONT source acceptance, 2026-10-23 | [render-positiont-depth-independent-accept-20261023.md](render-positiont-depth-independent-accept-20261023.md) |
| POSITIONT diagnostic build/COM qualification: BLOCKED before build | [render-positiont-diagnostic-com-qualification-20261023.md](render-positiont-diagnostic-com-qualification-20261023.md) |
| POSITIONT guarded diagnostic build passed; COM baseline failed | [render-positiont-guarded-com-qualification-20261023.md](render-positiont-guarded-com-qualification-20261023.md) |
| Independent POSITIONT source review, 2026-10-23 | [render-positiont-independent-review-20261023.md](render-positiont-independent-review-20261023.md) |
| Independent POSITIONT numerical source acceptance, 2026-10-23 | [render-positiont-numerical-independent-review-20261023.md](render-positiont-numerical-independent-review-20261023.md) |
| RichEdit native callback fixture technical review — 2026-10-23 | [richedit-fixture-independent-review-20261023.md](richedit-fixture-independent-review-20261023.md) |
| RichEdit EDITSTREAM native ownership fixture — 2026-10-23 | [richedit-stream-native-fixture-20261023.md](richedit-stream-native-fixture-20261023.md) |
| Standalone Screen Savers applet recovery | [screensaver-applet-recovery-20261020.md](screensaver-applet-recovery-20261020.md) |
| Screen Savers fixed candidate: independent source-slice acceptance | [screensaver-fixed-independent-review-20261020.md](screensaver-fixed-independent-review-20261020.md) |
| ScreenSaver full-module qualification: canonical build blocked | [screensaver-fullvm-lifecycle-20261020.md](screensaver-fullvm-lifecycle-20261020.md) |
| Screen Savers renderer input delivery | [screensaver-input-boundary-20261020.md](screensaver-input-boundary-20261020.md) |
| ScreenSaver callback census reconciliation — 2026-10-20 | [screensaver-ownership-census-20261020.md](screensaver-ownership-census-20261020.md) |
| Screen Savers recovery source review — rejected | [screensaver-source-review-20261020.md](screensaver-source-review-20261020.md) |
| Shadow Man accepted guard canonical invocation — blocked before compilation | [shadow-man-accepted-guard-canonical-20261023.md](shadow-man-accepted-guard-canonical-20261023.md) |
| Shadow Man candidate canonical qualification, 2026-10-28 | [shadow-man-admitted-remote-native-20261028.md](shadow-man-admitted-remote-native-20261028.md) |
| Shadow Man callback census correction — source inventory only | [shadow-man-callback-census-correction-20261028.md](shadow-man-callback-census-correction-20261028.md) |
| Shadow Man declaration-law technical review: blocked (2026-10-23) | [shadow-man-declaration-laws-correct-path-accept-20261023.md](shadow-man-declaration-laws-correct-path-accept-20261023.md) |
| Shadow Man original demo — InstallShield bootstrap | [shadow-man-demo.md](shadow-man-demo.md) |
| Shadow Man static inspector technical review — 2026-10-23 | [shadow-man-excerpt-bound-static-accept-20261023.md](shadow-man-excerpt-bound-static-accept-20261023.md) |
| Shadow Man fresh-selection technical review — 2026-10-23 | [shadow-man-fresh-selection-independent-accept-20261023.md](shadow-man-fresh-selection-independent-accept-20261023.md) |
| Shadow Man fresh selected-send repair — 2026-10-23 | [shadow-man-fresh-selection-repair-20261023.md](shadow-man-fresh-selection-repair-20261023.md) |
| Shadow Man retained full-module handler capture — 2026-10-23 | [shadow-man-memory-recovered-handler-qualification-20261023.md](shadow-man-memory-recovered-handler-qualification-20261023.md) |
| Shadow Man native bound guard — blocked at fresh memory admission | [shadow-man-native-bound-canonical-20261023.md](shadow-man-native-bound-canonical-20261023.md) |
| technical review of Shadow Man synthetic native handler capture | [shadow-man-native-handler-independent-accept-20261023.md](shadow-man-native-handler-independent-accept-20261023.md) |
| Shadow Man diagnostic arming and module identity repair | [shadow-man-null-arming-identity-repair-20261023.md](shadow-man-null-arming-identity-repair-20261023.md) |
| Shadow Man corrected capture technical review | [shadow-man-null-arming-independent-accept-20261023.md](shadow-man-null-arming-independent-accept-20261023.md) |
| Shadow Man NULL boundary capture preflight: blocked before helper verification | [shadow-man-null-boundary-capture-preflight-20261023.md](shadow-man-null-boundary-capture-preflight-20261023.md) |
| Shadow Man NULL boundary capture mechanism | [shadow-man-null-capture-mechanism-20261023.md](shadow-man-null-capture-mechanism-20261023.md) |
| Shadow Man Beenden: modal ownership boundary established; zero writer unobserved | [shadow-man-null-exit-diagnosis-20261023.md](shadow-man-null-exit-diagnosis-20261023.md) |
| Shadow Man diagnostic hooks: REQUEST CHANGES | [shadow-man-null-hook-independent-review-20261023.md](shadow-man-null-hook-independent-review-20261023.md) |
| Shadow Man original Beenden: first-zero causality, 2026-10-23 | [shadow-man-original-first-zero-cause-20261023.md](shadow-man-original-first-zero-cause-20261023.md) |
| Original Shadow Man Beenden boundary: first precise capture blocker | [shadow-man-original-null-capture-20261023.md](shadow-man-original-null-capture-20261023.md) |
| Shadow Man patch-bound static acceptance — 2026-10-23 | [shadow-man-patch-bound-static-accept-20261023.md](shadow-man-patch-bound-static-accept-20261023.md) |
| Shadow Man canonical module admission — BLOCKED before staging | [shadow-man-ready-canonical-module-20261023.md](shadow-man-ready-canonical-module-20261023.md) |
| Shadow Man reviewed helper plan: runtime staged; settings fixture blocked | [shadow-man-reviewed-helper-config-runtime-20261023.md](shadow-man-reviewed-helper-config-runtime-20261023.md) |
| Shadow Man defaults saved and Spielen enabled; ordinary exit reaches NULL | [shadow-man-settings-observer-repair-runtime-20261023.md](shadow-man-settings-observer-repair-runtime-20261023.md) |
| Shadow Man complete span inventory and guarded canonical static qualification | [shadow-man-span-static-canonical-20261023.md](shadow-man-span-static-canonical-20261023.md) |
| Shadow Man independent static acceptance: REJECT | [shadow-man-span-static-independent-accept-20261023.md](shadow-man-span-static-independent-accept-20261023.md) |
| Shadow Man static declaration-law repair (2026-10-23) | [shadow-man-static-declaration-laws-repair-20261023.md](shadow-man-static-declaration-laws-repair-20261023.md) |
| Shadow Man zero-transfer canonical/native observations, 2026-10-23 | [shadow-man-zero-transfer-canonical-native-20261023.md](shadow-man-zero-transfer-canonical-native-20261023.md) |
| Shadow Man zero-transfer independent source acceptance, 2026-10-23 | [shadow-man-zero-transfer-independent-review-20261023.md](shadow-man-zero-transfer-independent-review-20261023.md) |
| Shadow Man immediate zero-transfer provenance, 2026-10-23 | [shadow-man-zero-transfer-provenance-20261023.md](shadow-man-zero-transfer-provenance-20261023.md) |
| Shared native Module size-bound controls — PASS | [shared-native-bound-boundary-controls-20261023.md](shared-native-bound-boundary-controls-20261023.md) |
| ShellExecuteEx selective reconciliation, 2026-10-20 | [shell-launch-selective-review-20261020.md](shell-launch-selective-review-20261020.md) |
| TuxRacer retained cooperative mutex handoff acceptance — 2026-10-30 | [tuxracer-accepted-handoff-native-input-runtime-oct30.md](tuxracer-accepted-handoff-native-input-runtime-oct30.md) |
| TuxRacer SDL audio mutex release boundary — 2026-10-30 | [tuxracer-audio-thread2-release-runtime-oct30.md](tuxracer-audio-thread2-release-runtime-oct30.md) |
| Tux Racer bounded transport: runtime executed, evidence retrieval blocked | [tuxracer-bounded-transport-rebuild-runtime-oct30.md](tuxracer-bounded-transport-rebuild-runtime-oct30.md) |
| Tux Racer retained runtime: title and main menu confirmed | [tuxracer-exact-log-runtime-disposition-oct30.md](tuxracer-exact-log-runtime-disposition-oct30.md) |
| TuxRacer retained handoff publication and one bounded progression attempt | [tuxracer-handoff-publication-practice-runtime-oct30.md](tuxracer-handoff-publication-practice-runtime-oct30.md) |
| Tux Racer live native input: acknowledgement without observed consumption | [tuxracer-live-native-practice-progression-oct30.md](tuxracer-live-native-practice-progression-oct30.md) |
| Tux Racer post-title input observation | [tuxracer-main-menu-input-consumption-oct30.md](tuxracer-main-menu-input-consumption-oct30.md) |
| TuxRacer Practice mouse-consumption boundary | [tuxracer-practice-mouse-consumption-runtime-oct30.md](tuxracer-practice-mouse-consumption-runtime-oct30.md) |
| Tux Racer retained original media, integrated lexical scanner | [tuxracer-real-media-lexical-oct29.md](tuxracer-real-media-lexical-oct29.md) |
| Retained TuxRacer stall sampler | [tuxracer-stall-probe-implementation-oct30.md](tuxracer-stall-probe-implementation-oct30.md) |
| TuxRacer prompt native Practice click | [tuxracer-timely-practice-input-runtime-oct30.md](tuxracer-timely-practice-input-runtime-oct30.md) |
| Tux Racer title poll stall: causal observation blocked by provider transport | [tuxracer-title-poll-stall-causal-runtime-oct30-preserved-headroom.md](tuxracer-title-poll-stall-causal-runtime-oct30-preserved-headroom.md) |
| WinHelp qualified-path native/fullVM requalification — 2026-10-20 | [winhelp-native-qualified-path-20261020.md](winhelp-native-qualified-path-20261020.md) |
| Zuma Deluxe: current ordinary launch | [zuma-deluxe.md](zuma-deluxe.md) |
