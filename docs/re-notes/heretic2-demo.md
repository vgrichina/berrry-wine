# Heretic II Demo (Raven Software / Activision, 1998)

App `heretic2_demo` (candidate `heretic-2-demo`, localOnly). A Quake II-engine
third-person action game: `Heretic2.exe` is a 28 KB stub that imports
`Quake2Main` from `quake2.dll`; `H2Common.dll` is shared by everything; the
renderer (`ref_gl.dll` / `ref_soft.dll`), `SndDll.dll` and, under `Base\`,
`gamex86.dll`, `Player.dll` and `Client Effects.dll` are `LoadLibrary`'d at
runtime. Registered 274f69e21.

## Licence

`license.txt` in `_user1.cab` is Activision's standard licence: personal use
of one copy, no copying or distribution without written consent. Hence
localOnly, never deployed. (`rules.txt` beside it is a 1998 contest, not a
licence.)

## Install

archive.org `h2_demo_us`, `h2_demo_us.exe` (40079639 bytes, SHA-1
`d6593f2a1a12e39edd92338f95566e9c360d0c4e`): an InstallShield self-extractor that `7z x` unpacks into
`data1.cab`..`data4.cab`, `setup.ins` etc. One file group, "Program
Executable Files", 1825 files, 64 MB.

**unshield cannot read these cabs.** The common header is version
`0x01000004` ("major version 0", treated as 5). Every file descriptor has
flags 6 (compressed | obfuscated) but the data is not obfuscated, so
unshield's de-obfuscation corrupts it ("Decompression failed with code -3");
`-O` segfaults (1.5.1 and upstream master 0d1e7cb alike). The data is plain
IS5: `[u16 length][raw deflate]` chunks. Descriptors are packed 0x2a apart,
with no MD5. `tools/is5-extract.js` handles it, including files split across
volumes; the fetcher step is `is5Extract`.

## Running

- `--app=heretic2_demo` mounts the tree; the two static-import DLLs are in
  `dlls`. Ad hoc: `--exe=.../Heretic2.exe --dlls=quake2.dll,H2Common.dll
  --vfs-include='**/*'`.
- **Time bomb** (quake2.dll `0x1002df50`, called as a game starts):
  `time()` must lie between `0x35649ff8` (1998-05-21) and `0x363c8deb`
  (1998-11-01), otherwise MessageBox "Unauthorized access not permitted!"
  and exit. The app entry pins `wallClock: '1998-09-01T12:00:00Z'`; ad hoc,
  `--wall-clock-ms=904651200000`.
- **Renderer.** `Base\default.cfg` sets `vid_ref soft` (works, DirectDraw)
  and `gl_driver 3DfxGL_Ht2` (a 3Dfx MiniGL in `drivers\`; `D3DGL` and
  `Veritegl` are the other two). The entry's args pick `vid_ref gl` with
  `gl_driver opengl32`. On the CLI GL needs `--headless-gl` or
  `--gl-renderer=software`; without a backend `wglMakeCurrent` fails and the
  game falls back to ref_soft.
- **GL window position.** Quake II `MoveWindow()`s its window to
  `vid_xpos`/`vid_ypos`, defaults 3/22, even the fullscreen `WS_POPUP`, so
  the GL frame sat 22 px down the screen. The args set both to 0.
- `LoadLibraryA("opengl32")` answers `0x00400000`: our emulated GL module's
  handle aliases the exe's. Harmless here (GetProcAddress finds the wgl
  entry points) but worth knowing if a module-handle comparison ever bites.
- `SndDll.dll` imports ole32.dll (not present; its imports fall to stubs).
  A3D initialises and is torn down; DirectSound is used.

## Route (headless, `--batch-size=50000`)

Main menu by b200. Enter at 300/400/500/600 (Game → new game → difficulty)
starts the first area by about b700. Up from b1000 walks Corvus to the
lectern (tutorial text), Right turns him toward the hall with the
stained-glass doors. Evidence:
`scratch/runs/20261011T0645Z-heretic2_demo-gameplay-claude1863`.

This historical headless route does not establish browser gameplay. See the
original-browser run below for separately reviewed evidence.

## Original browser gameplay reviewed, 2026-10-31

Run: `scratch/runs/20261031T1941Z-heretic2-original-browser/`. Documentation
only; no emulator change or guest code inspection. The input main was
`595b9f443b3fb9f92bbc8d25f37b08031cb3f125`; the reread published main at launch
was `721079ad7ae08c7c27368b56102c1aa781c672b1`, verified against remote main
over strict known-host SSH. `heretic2_demo` remains absent from public
`DESKTOP_APPS` and present in the local candidate selector. No deployment.

### Fresh original provenance and terms

Archive.org's `h2_demo_us` metadata returned HTTP 200 and identified
`h2_demo_us.exe`, 40,079,639 bytes, SHA-1
`d6593f2a1a12e39edd92338f95566e9c360d0c4e`, MD5
`ebbaa3ddf3fc5ed84dfbef5f60afe78c`. One bounded acquisition into this unique
run directory succeeded, HTTP 200, with the exact size and SHA-1; SHA-256
`a7b29d478abfffc2221e2d713c2068d1e9f44292875db007160fefc7c0064307`.
No retry or alternate acquisition was used.

The corpus recipe's `7z` installer extraction followed by
`tools/is5-extract.js` on `data1.cab` produced 1,825 files, 63,842,666 bytes.
Every original member was compared by SHA-256 with the installed tree:
**all 1,825 match**, with no missing, changed, or extra installed files.
All 1,824 browser-manifest sizes also match. Evidence:
`archive-metadata.json`, `archive-pin.json`, `acquisition.json`,
`corpus-recipe.json`, `original-comparison.json`, `manifest-check.json`.
The derived duplicate extraction was removed after comparison to recover disk;
the exact installer, member hashes and recovery recipe remain in the run.

The complete original `Readme.htm` and `_user1.cab`'s 11,728-byte `license.txt`
were read before runtime. The latter was extracted with the existing IS5 tool;
7z cannot open that cabinet. The licence restricts use to personal use, restricts
copying/distribution and forbids reverse engineering, deriving source,
modification, decompilation and disassembly. This run kept original guest
binaries/assets/configs/saves unchanged, inspected no guest code, and remained
private and local. `licence-review.json` records the document hashes.

### Native routes and reviewed controls

The original menu differs from the old batch shorthand: **Game → Tutorial**
starts the lectern room directly. **Game → Easy** starts the separate demo
campaign through its intro. There is no separately observed “New Game” page.
Both routes were exercised in one browser lifetime using visible checkpoints
and trusted, balanced keyboard events. No console/map/state injection,
config/save/cvar edits or added clock overrides were used.

- `01-startup.png`, `03-game-menu-settled.png`: original book menu and
  Game submenu, with Tutorial initially selected. Two separate Enter presses
  start Tutorial; `06-first-area.png` shows Corvus facing the lectern.
- `07-walk-to-lectern-held.png`, `08-lectern-settled.png`: Up held for
  1,400 ms then released moves Corvus to the book; the tutorial caption appears.
- `10-hall-settled.png`, `12-stained-glass-hall.png`: separate Right holds
  of 850 and 1,500 ms turn him toward the stained-glass double doors.
- `13-attack-held.png`: the original `Ctrl +attack` binding produces a visible
  red spell effect. `14-jump-held.png` shows Corvus airborne after the original
  `a +moveup` binding; `15-landed.png` shows him back on the floor.
- `17-native-escape-menu.png`, `21-easy-selected.png`, `23-easy-start.png`:
  Escape opens the book, Enter opens Game, Down selects Easy, Enter starts its
  intro. Escape opens the menu over the intro; another Escape resumes it.
  `27-easy-resumed.png` shows the Raven logo. A balanced Space press advances
  to loading; `31-easy-area-loaded.png` shows the playable docks.
- `32-easy-walk-held.png`, `33-easy-turn.png`, `34-easy-attack-held.png`,
  `35-easy-jump-held.png`, `36-easy-landed.png`: finite Up/Right/Ctrl/a inputs
  demonstrate walking, turning, a red projectile effect, jumping and landing
  in the campaign area too. `38-final-menu.png` shows native Escape still works.

These named screenshots were personally reviewed. Menus, logos and loading
screens are route evidence only. The tutorial and docks captures establish
player-controlled gameplay. No outgoing hit, kill, objective completion,
audio quality, sustained combat, touch qualification or FPS measurement is
claimed. The docks health display changes from 100 to 94; its cause was not
established. Tutorial captions remain visible after switching to Easy in this
lifetime; their reset behavior was not investigated.

### Identity, environment and cleanup

Chrome `151.0.7922.108`, native 1024×768 content area, `defaultViewport: null`,
default isolated guest Worker, normal WebGL and emulator audio/clock paths.
The existing registered `wallClock: '1998-09-01T12:00:00Z'` was preserved,
as were the actual arguments
`+set vid_ref gl +set gl_driver opengl32 +set vid_xpos 0 +set vid_ypos 0`.
The browser used the standard local SwiftShader harness; listening was not
qualified. HTTP COOP/COEP isolation was checked before launch and guest input.

Before/after identities match for all 528 source/UI files, 866 compiler/tool
files and 1,846 original/manifest/shared-runtime pins. The served module is
SHA-256 `d39f362187ce89abda47fa53bca6bb6576badd8d21b78e44c6fbad973d1636d8`;
it and source/compiler bytes also match the tested predecessor manifests.
All 970 actual HTTP responses carry isolation headers; all 964 served-file
receipts (including prelaunch probes) join exact byte pins. Actual responses
include ten 404s: optional build/auth/icon/font-bundle requests and the four
`ole32.dll` lookup locations; these are recorded rather than counted as files.
All 41 recorded native events are trusted, with 19 balanced key pairs and one
Launch mouse pair. `verification-summary.json`, `identity-before.json`,
`identity-after.json`, `served.jsonl` and `actual-http-responses.jsonl` retain
the checks. No fresh build was needed for this documentation-only change.

Runtime ran 19:42:54–19:46:02 UTC, after current Slave Zero terminal lifecycle
`NEWFULLRELEASE193605` and an independent entire-Chrome/global-crashpad/profile
PID/start gate. Inherited FD 9 held `/tmp/wine-browser.lock` through durable
Python `Popen.wait` for controller, monitor and watcher cleanup. Launch reserve
was 2,506,145,792 bytes; continuously sampled minimum was 2,296,856,576 bytes,
above the 2.1 GB early-stop threshold. No deadline/resource stop or runtime
signal was needed.

Independent final release at 19:46:02 UTC verifies all 24 owned runtime/helper
PID/start identities absent, entire Chrome/global crashpad/profile process set
empty, HTTP 39777 and DevTools 41911 closed, profile removed, held inputs empty
and lock free. Evidence: `full-release-proof.json`, `monitor-end.json`,
`controller-wait.json`, `boardwatch-wait.json`, `wrapper-raw-exit.json`.
Boat ID/state/expiry: N/A, local run. No agents, workers, successors or deploy.

Next boundary: continue the original Easy docks route to a confirmed targeted
hit or native objective interaction; qualify audio and FPS separately. No
emulator failure or defined-use repair boundary was encountered in this run.
