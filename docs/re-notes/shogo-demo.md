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

## Reviewed local browser gameplay (2026-10-31)

Run `scratch/runs/20261031T2006Z-shogo-pinned-browser/` tested current main
`a46645505d4cab9c6774d965307303c5a2921c6e` with the existing direct-client
registration and unchanged cwd/arguments. All **69 size/SHA256 pins** passed
before and after, including Client.exe outside the 67-member manifest.
The complete local Readme.txt was reviewed; no redistribution grant was found.
A fresh public `DESKTOP_APPS` fetch excluded Shogo (source SHA256
`63bb9815e404dd7e446d3748e195c621782a04c8358580bd2cf1a864cb57e209`).
This remains private local testing; no upstream download was required.

The browser used the default isolated guest Worker, normal WebGL/audio/clock,
Chrome's SwiftShader backend, native 1024×768 content geometry and
`defaultViewport: null`. No guest-state, configuration, save, clock, asset or
emulator source changes were made. Before input, HTTP isolation and served
source/compiler/module/fixture identities were checked. All 528 source files,
867 compiler/tool files and 89 runtime inputs matched after the run; the module
was `d39f362187ce89abda47fa53bca6bb6576badd8d21b78e44c6fbad973d1636d8`.
Current main's font/host changes are included in those pins; the compiled WAT
and compiler inputs still matched the previously tested module. An initial
preflight stopped before runtime because its inherited historical tool-census
pin was stale; `preflight-adjustment.json` records that boundary. There was
one browser runtime and no emulator repair or runtime retry.

Personally reviewed captures establish this bounded route:

- `01-startup.png`: main menu with Single Player highlighted. A balanced Enter
  advanced to the native demo information sequence; Escape then preceded the
  City of Ghosts loading screen. New Game and difficulty screens were **not
  separately captured**, so the selected difficulty is unverified. Historical
  CLI batch counts do not fill that browser evidence gap.
- `06-avernus-briefing.png`: Avernus briefing with “press a key.” Space advanced
  into the native introduction. `08`–`10` show scripted mech/city cameras and
  dialogue, not player-controlled gameplay.
- `11-after-intro.png`: settled first-person street, weapon, crosshair and HUD
  (energy 961, armor 951, ammunition 50).
- `12-walk-held.png` / `12-walk.png`: balanced Up input translated the street
  view forward and displayed “Picked up the Bullgut!”
- `13-turn-held.png` / `13-turn.png`: balanced Right input visibly turned the
  street view toward the corner building/billboard; Bullgut ammunition was 40.
- `14-fire-held.png` / `14-fire.png`: balanced Ctrl input produced a bright
  weapon/projectile flash while ammunition fell 40 → 39 → 38. Energy/armor
  fell to 894/873; this does not establish an outgoing hit or kill.

The 18 finite captures were personally reviewed. `reviewed-scenes.json`
corrects capture filenames that describe intended rather than observed states;
`result.json` allows only the seven first-person gameplay images as gameplay
scenes. The run does not establish enemy hits, kills, mission completion,
mouse look, audio listening or FPS. Walking collected a weapon; the mission's
Madison Tunnel objective was not completed.

Verification includes all 291 HTTP responses isolated, 277 successful response
hash joins, 15 trusted native events (six balanced key pairs and one launch
mouse pair), and minimum free disk 3,612,303,360 bytes. Missing optional shell
resources and ole32.dll probes returned 404 and are retained in HTTP evidence;
no fatal emulator failure was observed. No new build or source patch was made.

SiN's current `NEWFULLRELEASE200105` was independently checked before launch,
including PID/start identities, closed ports and absent profile, under inherited
FD9 `/tmp/wine-browser.lock`. Runtime ran 20:06:24–20:08:23 UTC. Durable Python
`Popen.wait` retained FD9 through cleanup; `full-release-final.json` independently
confirmed all 23 owned PID/start identities absent, all Chrome/global crashpad
processes absent, ports 35037/42761 closed, profile removed, held inputs empty
and lock free. No signals were needed. Boat ID/state/expiry: N/A, local
correctness. Heavy performance measurement belongs on a separate Boat.

Next boundary: separately capture the native New Game/difficulty screens if
that menu route needs qualification, then establish a targeted hit or mission
progress through ordinary controls. Audio and FPS remain separate checks.

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
- Ctrl firing is now reviewed in the browser run above; mouse look remains untested.
- Wall time is high: about 2400 batches take 10+ minutes in the CLI.
