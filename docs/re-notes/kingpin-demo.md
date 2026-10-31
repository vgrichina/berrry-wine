# Kingpin: Life of Crime Demo (Xatrix / Interplay, 1999)

App `kingpin_demo` (candidate `kingpin-demo`, localOnly), alpha demo v0.22n.
Quake II engine: `kingpin.exe` imports only system DLLs; `ref_gl.dll` (or
`3dfxgl.dll` as the GL driver) and `main/gamex86.dll` load at runtime; the
data is `main/Pak0.pak` plus loose `main/` files. Registered 8373af6cd.

**The readme licence forbids decompiling or disassembly**: debug it from
traces and runtime behaviour only.

## Source and licence

The archive.org item `win-98-games-k-o.-7z` is one 5.9 GB 7z, but the
download service serves single members of it:
`.../Win98_Games-K-O.7z/Kingpin-DEMO-OpenGL.EXE` (110023168 bytes, SHA-1
`551cd726…`), a collector's WinZip self-extractor of the demo tree that
`7z x` opens. `readme.txt`: personal noncommercial home use only; no
copying, distribution, decompiling or disassembly. Hence localOnly.

## Running

- Args `+set vid_ref gl +set gl_driver opengl32`: ref_gl through opengl32.
  On the CLI GL needs `--headless-gl` (or `--gl-renderer=software`).
- **Slow first-level load and the loopback timeouts.** After GAME → EASY
  the LOADING plaque stays up from about b500 to b3000 at the 200 ms/batch
  headless clock, with almost no API calls (CPU in ref_gl/gamex86). That is
  more than Quake II's 120 s `cl_timeout`/`timeout`: the console shows
  "Loading plaque timed out", "Can't find pic: net" (the lag icon) and then
  "Server connection timed out", and Escape lands in the main menu. Either
  `--tick-ms-per-batch=20` or `+set cl_timeout 100000 +set timeout 100000`
  gets into the level; the registry uses the cvars, since they also apply in
  the browser. The real fix is a faster load: worth a profile.
- The intro cut-scene runs to about b6000, then first person in the alley.

## Route (headless, `--batch-size=50000`)

Enter at 300/400/500 (GAME → EASY), space at 5000, Up from 6200 walks into
the wall ahead, Right at 6550 turns toward a corrugated-metal shed. Evidence:
`scratch/runs/20261011T0800Z-kingpin_demo-gameplay-claude1863`.

This historical headless route is separate from the browser evidence below.

## Original browser gameplay reviewed, 2026-10-31

**Player-controlled browser gameplay reached.** No emulator repair was needed.
Evidence is local and ignored:
`scratch/runs/20261031T1914Z-kingpin-native-browser/`; the controlled session
is in its `browser/` subdirectory. `result.json`, `reviewed-scenes.json`,
`browser/verification-summary.json` and `full-release-final.json` record
the observations, screenshot hashes, identity checks and cleanup.

### Provenance and tested identity

Before launch, downloaded the collector repack named in
`test/candidate-corpus/manifest.json` and verified its full SHA-1
`551cd7267945aa13ff9b5cfdd6991d56279e2738` (110023168 bytes; SHA-256
`2a5511a7f570889938165606ced3f24de0daa718ba1bf7335744122eb0aeb10a`).
All **800 installed files** matched the corresponding ZIP members by SHA-256,
including the executable
`f95dff8f4f97890679e4db4179e8dc39a43d0c1d2871dd4bca901af6aa122f04`.
All 799 manifest entries were present and size matched; the executable is
additional to those entries. `provenance.json` preserves each member hash.
The temporary downloaded repack was removed after comparison. Recovery uses
the existing corpus recipe (`node tools/fetch-candidate-corpus.js
--id=kingpin-demo`) on an absent fixture; do not overwrite this preserved tree.

Published main was reread and matched the origin remote as
`2380f286559c166ac1161405fd2d3eea87bfe5b9` immediately before runtime
(input `e875d370578dee0318b75bceb51b0238fca21e28` is its ancestor).
Origin used HTTPS for that check; setting `GIT_SSH_COMMAND` alone did not
change its transport. `prelaunch-transport-correction.json` records this
correction to the harness metadata. Final publication explicitly rewrites
origin to SSH for the strict-known-host pull, push and remote-main check.
Executed module SHA-256:
`d39f362187ce89abda47fa53bca6bb6576badd8d21b78e44c6fbad973d1636d8`.
The previously tested 362 source and 866 compiler files matched before launch.
The controlled session pinned 528 source/UI files, 866 compiler files and
821 fixture inputs (800 installed files, manifest, shared DLLs and typelib);
all hashes and the module matched again after shutdown. No build was rerun
and no emulator source changed. Fresh public `lib/apps.js` remained SHA-256
`63bb9815e404dd7e446d3748e195c621782a04c8358580bd2cf1a864cb57e209`,
with `kingpin_demo` absent from public `DESKTOP_APPS`.

### Visible native route and input response

On a private loopback HTTP server with COOP/COEP isolation, open
`index.html?debug&no-log`, select **Kingpin Demo**, retain **WebGL** and
default **Threads**, then click **Launch**. The existing registration,
manifest and arguments above were preserved. Chrome used a native
1024×768 content viewport with `defaultViewport: null`; the original
`gl_mode 0` game surface remained 640×480. Audio and clock stayed normal;
assets, INI/config, saves and guest state were not edited or injected.

From the original splash, **Escape → Enter (GAME) → Enter (EASY)** starts
the game. GAME directly presents EASY/MEDIUM/HARD, with no separate New
Game row. Reviewed captures `02`/`04` show the menu and difficulty;
`05` shows LOADING, `06` the scripted third-person alley intro, and `07`/`08`
the settled first-person alley with crosshair and health 68. The intro alone
is not counted as player control.

Balanced trusted browser input then produced these personally reviewed results:

- `09-native-forward.png`: Up moves from the open alley toward the brick wall.
- `10-native-right-turn.png`: Right turns toward the burning barrel.
- `14` raises the initially holstered pipe; `15-native-pipe-swing-held.png`
  shows Mouse1 swinging it. This is melee attack, not firearm discharge.
- `17-native-jump-held.png` and `18-native-landed.png`: `a` raises the
  viewpoint and it returns after landing.
- `19-native-crouch-held.png`: `c` lowers the viewpoint.
- `21-mouse-look-settled.png`: trusted mouse movement changes yaw and pitch.
- `23` faces the open alley again; `24-native-strafe-left.png` shows comma
  translating left toward the fence without a turn key.
- `25-native-pause-menu.png`: Escape returns to the native menu.

The original `Pak0.pak/default.cfg` was read as configuration data to verify
bindings: Up/Down forward/back, Left/Right turn, comma/period strafe,
Mouse1 attack, `a` jump, `c` crouch, `f` activate, `/` next weapon, Escape
menu. **Space is backward, not jump.** Reading the original config and
readme involved no guest disassembly or decompilation.

### Bounds and limits

Runtime waited for the current Slave Zero filtered-audio NEWFULLRELEASE
(19:17:58 UTC), then independently checked the entire Chrome/global crashpad/
profile process set while holding inherited lifetime FD9 on
`/tmp/wine-browser.lock`. Python `Popen.wait` retained the lock through all
runtime cleanup. An initial 19:19 session was closed before guest input:
the scratch HTTP allowlist had omitted optional `stdole2.tlb` and UI assets.
Its complete cleanup was verified before the corrected 19:20–19:24 session;
only one browser ran at a time, within the initial 19:36 target deadline.
`harness-correction.json` preserves this limitation and correction.

Corrected-session checks passed: 285 HTTP responses all isolated, 283 served
hash joins, 52 trusted events with 3 mouse and 13 key down/up pairs balanced,
and all inputs released. Disk minimum was 2415022080 bytes, above the 2 GB
floor and 2.1 GB early-stop threshold. No runtime signals were needed.
Independent final release at 19:25:02 verified both sessions' 38 recorded
PID/start identities and all own helpers absent, the global Chrome/crashpad/
profile set empty, all four HTTP/debug ports closed, both profiles removed,
and the lock free. Boat ID/state/expiry: N/A; runtime was correctness-local.

No outgoing hit, kill, objective completion, audio quality, FPS, touch or
sustained-combat result is established. No emulator failure was encountered,
so there is no defined repair boundary or oldFAIL/newPASS claim. Next concrete
boundary: navigate original `sr1` to a native interactable/NPC and verify an
activate/dialog response or targeted melee hit; listening and performance
need separate qualification. Original demo files and captures remain private;
no assets or runtime evidence were committed or deployed.
