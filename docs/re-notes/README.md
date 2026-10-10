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
| Klotski (Win16 WEP3; route, board geometry, pick arithmetic, open blank selector) | [wep16-klotski.md](wep16-klotski.md) |
| JigSawed (Win16 WEP, VB1; Thunder OK, SetActiveWindow, child-surface clip) | [wep16-jigsawed.md](wep16-jigsawed.md) |
| Cruel (Win16 WEP1; maximize invalidation, redeal rule) | [wep16-cruel.md](wep16-cruel.md) |
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
| Command & Conquer: Red Alert (Win95 demo) | [red-alert-95-demo.md](red-alert-95-demo.md) |
| Die by the Sword (demo) | [die-by-the-sword-demo.md](die-by-the-sword-demo.md) |
| Dark Colony (magazine demo) | [dark-colony-demo.md](dark-colony-demo.md) |
| Daytona USA Deluxe (Win95 demo) | [daytona-usa-deluxe-demo.md](daytona-usa-deluxe-demo.md) |
| Blood II: The Chosen (demo) | [blood2-demo.md](blood2-demo.md) |
| Sid Meier's Pirates! (2004) | [pirates-2004.md](pirates-2004.md) |
| Disciples: Sacred Lands (demo) | [disciples-demo.md](disciples-demo.md) |
| Commandos: Behind Enemy Lines (demo) | [commandos-demo.md](commandos-demo.md) |
| Age of Wonders (beta demo) | [age-of-wonders-demo.md](age-of-wonders-demo.md) |
| Age of Wonders II (beta demo; main menu only) | [age-of-wonders2-demo.md](age-of-wonders2-demo.md) |
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
| SimCity 2000 Win95 Demo | [simcity-2000-demo.md](simcity-2000-demo.md) |
| SkiFree (Entertainment Pack) | [skifree.md](skifree.md) |
| Snood 2.2W | [snood.md](snood.md) |
| Worms 2 October demo | [worms2-demo.md](worms2-demo.md) |
| Warcraft III: Reign of Chaos demo | [warcraft3-demo.md](warcraft3-demo.md) |
| Windows Installer 2.0 for Win9x (instmsi.exe) | [windows-installer-2.0.md](windows-installer-2.0.md) |
