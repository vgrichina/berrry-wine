# Shogo: Mobile Armor Division demo (Monolith 1998, LithTech 1.0, Direct3D)

App id `shogo_demo`, candidate `shogo-demo` (registered 2026-10-11, w5).

## Target build pin (owner decision, 2026-10-31)

The target is the local **PC Gamer Demo Version** actually run. Its69
size/SHA256 pins are retained in
`scratch/runs/20261031T1957Z-shogo-local-pin/target-file-hashes.json`:
67 manifest members, the separately loaded Client.exe and the manifest itself.
All67 earlier member pins matched. The manifest omits Client.exe, so verifying
its members alone does not verify the executable being run.

Client.exe SHA256 is `129b5f625ebcc2ce5f4a4d836dc1127c77837b220351ec5bf832327a5adbf45e`; manifest SHA256 is
`24418ab0a2f4912fb7c1dfb5af018d51b4f8e0e817ca59a058cbfa5f409de40d`. Verification and fresh public desktop exclusion are in
`scratch/runs/20261031T1957Z-shogo-local-pin/verification.json`.

These local file pins select the build under the owner's file-based target
rule; an upstream package comparison has not been performed. The earlier
HTTP500 fetching ShogoDemo.zip does not block this local target. Do not
fetch compilation containers. Keep the local-only registration and read the
complete local terms before investigation. This check launched no runtime;
the historical CLI route below does not establish browser gameplay.

Next: a fresh worker, once a slot is free, should verify all69 pins and use
the original Single Player/New Game/difficulty/briefing route to the Avernus
street, then capture ordinary movement, turning and firing. Serialize it
behind the current browser owner and distinguish incoming damage from
confirmed outgoing hits, kills or objectives.

## Source and licence

- archive.org item `ShogoMobileArmorDivisionDemo`, `ShogoDemo.zip`: 30,823,950 bytes, SHA-1 `f372ab1a822002107980e6648fe101d10c19fb19`.
- The zip holds an InstallShield 3 setup (`SETUP.EXE`, `setup.pkg`, `_INST32I.EX_`) and the game laid out loose under `Game/`. That directory is all the candidate needs; its `copyTree` puts it at `installed/shogodemo`.
- The game is the "PC Gamer Demo Version", about 43 MB of `SHOGODEM.REZ` plus the engine DLLs.
- **No licence grant.** `Game/Readme.txt` says only "Copyright 1998 Monolith Productions, Inc.", so the candidate is `localOnly`.

## Launch

- `ShogoDem.exe` is a launcher with Play Demo / Display / Advanced / More Games / Quit. It renders, and the first Play Demo asks for a detail level.
- It then spawns:

  ```
  CLIENT.EXE -windowtitle "Shogo Demo" -rez shogodem.rez ++globaldetail 1 ++Sound16Bit 1
  ```

  with the game directory as cwd. The readme's default install is `c:\games\ShogoDemo`; the registration mounts it as `c:\shogodemo` (fileRoot `installed`), and the path does not matter as long as the cwd is the game directory. With the cwd pointing elsewhere the client exits (code 0) right after its window, before `cshell.dll`.
- Through the launcher (`--spawn-processes`) the child reached its Direct3D splash and stayed there.
- Started directly with those arguments, `Client.exe` reaches the main menu. **The registration runs the client directly.**
- The client loads its renderer and modules by name from the current directory (`LoadLibrary`):
  - `d3d.ren` (the LithTech Direct3D renderer; `soft.ren` is the software one);
  - `cshell.dll` and `cres.dll`;
  - `imusic25.dll` and its `imrt*`/`msynth25`/`am18`/`ima` set;
  - `softsnd.dll`.
- `ole32.dll` is missing from a fresh checkout and its imports fall to stubs. That is harmless here.

## Headless route (CLI, `--batch-size=200000`)

The client is slow to boot: about 700 batches to the main menu. Send each Enter as both `keydown:13` and `di-keydown:13`.

1. Main menu by batch 690, "single player" highlighted.
2. Enter at batches 700, 800, 900 and 1000 runs Single Player, then New Game, then difficulty, then the level load.
3. The Avernus mission briefing ("press a key...") shows by about batch 1900.
4. Space (`keydown:32` plus `di-keydown:32`) at batch 1950 starts the level: a city street, the mech's weapon in view, and an Energy / Armor / Ammunition HUD.
   - Between batches 2150 and 2400 Energy drops 930 → 893 and Armor 914 → 872 under enemy fire, and traffic moves.
   - Holding Up from batch 2450 walks the mech forward. It was destroyed by about 2650, and the game went back to the main menu.

Evidence: `scratch/runs/20261011T1030Z-shogo_demo-gameplay-w5`.

## Open

- The launcher route: why the spawned child stays on the splash.
- Firing (Ctrl, from the readme) and mouse look were not exercised before the mech died.
- Wall time is high: about 2400 batches take 10+ minutes in the CLI.
