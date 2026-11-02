# Braveheart demo (Red Lemon Studios / Eidos 1999)

Registry id `braveheart_demo`. Real-time tactics over a 3D battlefield. The
"Covermount Demo" ships three renderers side by side: `brave.exe` (Glide),
`bhd3d.exe` (Direct3D) and `bhsoft.exe` (software, into DirectDraw). The
registry entry runs `bhsoft.exe`. Fixture:
`test/binaries/win98-games-a-d/braveheart-demo-Glide` (InstallShield 5
Disk1); the installed tree lives beside it in
`braveheart-demo-Glide-installed/braveheart covermount demo` (199 MB,
`dad.io` is 133 MB of it).

## Install (headless)

The Drakan/Driver recipe (docs/re-notes/drakan-demo.md) unchanged:
`SETUP.EXE --vfs-include='*' --tick-ms-per-batch=5 --capture-launch=cap`,
then `cap/windows/temp/_istmp1.dir/_ins5576._mp` with `--vfs-tree=cap
--tick-ms-per-batch=5 --control=PORT --frozen --save-vfs=inst
--save-vfs-prefix='c:\program files'`: Next (413,394) on Welcome,
Destination and Program Folder, ~1.2M batches of copying (about 3 minutes),
Finish. Target: `C:\Program Files\Red Lemon Studios\Braveheart Covermount
Demo`. No emulator fixes were needed for the install or the game.

## Running it

- `winplay.dll` (the movie player: `Player_InitMovie` ...) and its chain
  `winstr.dll` -> `dec130.dll`/`edec.dll`/`winsdec.dll`, plus `mss32.dll`,
  must load as real PEs (the entry's `dlls:`). Without them the first movie
  call crashes as an unimplemented API.
- Intro movies (Eidos logo, then the game's) are interlaced by design; Esc
  skips each one. Window `keydown:27` is enough.
- Mission Brief: "Take the Field" at (535,450) needs a real press
  (mousedown, a few hundred batches, mouseup); ctl `click` is too quick.
- In battle the cursor is DirectInput: `relmousemove:DX:DY`, then
  `di-mousedown:1`/`di-mouseup:1` selects a unit (portrait + order bar +
  health bar), button 2 moves the camera. The cursor redraws only when a
  frame completes, so give each input a frame (several thousand batches)
  before reading the screen.

## Headless clock spiral (read before calling the battle frozen)

At the default `--tick-ms-per-batch=200` the battle freezes on one frame for
good. It is not a hang: the sim is a fixed 16 ms tick fed by a sliding window
of the last eight frame deltas, and every frame costs more guest time than it
simulates, so the window only grows.

- `0x504be0` returns milliseconds (CRT time: seconds*1000 + ms).
- `0x4916e8` shifts the eight-entry delta ring at `0xc5aef8`, stores the new
  delta, and writes `sum >> 7` (i.e. average/16 ms) to `[0xc5aef4]`, the
  step count.
- `0x491776..0x4917b1` runs `[0xc5aef4]` steps over the 250 objects at
  `0xc526dc` (stride 0x50).

Measured with `--input`/ctl `dump-mem:0xc5aef4:4`: 180,176 steps per frame at
200 ms/batch; at 5 ms/batch it starts at 551 and creeps up (~1,650 after
100k batches, still diverging slowly); dropping to 1 ms/batch (ctl POST
`{"action":"tick","ms":1}`) converges to under 200 within ~30k batches. So
run the battle at `--tick-ms-per-batch=1` (or 5 to reach it faster, then 1).
The browser uses real time. Convergence was a hypothesis here, not an
observation; the 2026-11-02 browser run below does not establish convergence.

Route (CLI): `--tick-ms-per-batch=5`, Esc every 40k batches x6 -> Mission
Brief by ~160k; Take the Field; battle frames from ~390k.
Evidence: `scratch/runs/20261006T1640Z-braveheart_demo-gameplay`.


## Native browser observation — 2026-11-02

Run: `scratch/runs/20261102-braveheart-native-browser/`. This is an honest
first-blocker result, not accepted battlefield gameplay. One original ran in
headful Chrome 151.0.7922.108 with the default host renderer (`webgl`), real
clock, guest worker and threads. No guest patches, injected state, renderer
selection, clock changes, download or public promotion were used.

The prelaunch registry check found `braveheart_demo` in APPS and
LOCAL_CANDIDATE_APPS, absent from DESKTOP_APPS. The registered `bhsoft.exe`
and six real movie/audio DLLs were retained. All 145 installed files
(207704346 bytes) matched the coordinator's locally observed hashes; those
hashes are not upstream provenance. All 143 browser-manifest entries matched
actual file sizes. Exact per-file identities are in `original-inputs.json`;
`bhsoft.exe` SHA-256 is
`70ae3feedc1f977ca8b8ed32560ebdaa381a25b6261f2cbc77396c887e2a8955`
and browser-manifest SHA-256 is
`2b4fd55edf1b74adb3a102893b12e052283130cbb22aeaca5d048b23dd40b77f`.

After the ordered predecessor releases, source snapshot
`345270459395baf28e88d68ace9c3d311f1f4e70` matched all 3936 accepted inputs
of `20261102-gl-stipple-implementation-recover` and its locked full build
(exit 0). Tested module: 2071475 bytes, SHA-256
`307168f9e0475fd3c10f87cbc5d98f05006c6d4494d2f564381a9a0ebe289fe6`.
No production code changed for this investigation. `snapshot-inputs.json`,
`accepted-build-inputs.json` and `build-identity.json` pin runtime/compiler
inputs. The immutable transfer included `src/api_table.json`; all 3010
members were verified before and after extraction. Archive SHA-256:
`4ec58adf4645baf981a176e4b68b3ac9908cef2bb8627cfa2714b72ae209e85a`.

Actions were chosen after viewing each screen: interlaced Eidos movie →
balanced native Escape → Game Features → visible Back → main menu → visible
Raid Town → Stephen Feherty mission brief → visible Conduct Raid → lazy asset
loading. The shipped readme names renderer executables but supplies no
battlefield control instructions. The older CLI Take the Field route above
was not imposed on the browser's different visible screens. Native event
records contain 11 trusted events and four balanced press/release pairs;
actual holds were 4451, 2368, 1443 and 4312 ms, including capture overhead.
`04-raid-town-settled` provides the before image for Conduct Raid;
`05-conduct-raid-held`, `-released`, `-settled` preserve its input sequence.

The first blocker was persistent unreadable software presentation: a noisy
green/brown strip across the upper canvas with the lower area black, seen
through `07-loading-progress`, both `08-neutral-render-check` captures and
`09-final-neutral-blocker`. The latter was personally reviewed after
retrieval. Its cause is unlocalized. No readable Take the Field button,
unit selection or ordinary battlefield command was reached. Inputs stopped
at that blocker; no unchanged original was replayed.

Read-only simulation samples were 10, 14, 13, 21, 39, then 12 steps, with
changing delta rings, guest registers, work statistics and real tick values.
The final ring was `[168,172,144,377,170,152,151,212]`; final guest tick
261836, host stepTicks 28615. The recorded frame-end/pump counters remained
623/620 across the malformed presentation samples. These counters do not
establish displayed FPS, completed game frames, a browser stall or sustained
simulation convergence. Preserve `retrieved/input-state.jsonl` rather than
substituting the historical fixed-clock CLI spiral for this observation.

The controller and Chrome exited 0 with input released, server closed and
profile removed. All 111 evidence files were retrieved and SHA-verified
before the explicitly delegated shutdown of own boat `bx_d5ebwy9z`
(original expiry `2026-11-02T19:12:47.558Z`); `box-final.json` records its
final state. Forty-five PNGs passed chunk CRC verification. The guarded
boat/transfer/run phase kept owner /home free above 2000000000 bytes
(minimum 2034028544). During the earlier scratch-only
predecessor wait, unrelated staging reduced observed free disk below that
floor; `preparation-disk-limit.json` preserves this limitation. Continuous
whole-task floor compliance is therefore not claimed.

Recovery: use this run's `RECOVERY.txt`, manifests and retrieved captures.
Local ignored fixture/module bytes require the pinned local archive or
existing installed files; Git alone does not recover them. A future task
should localize the unreadable presentation from these observations before
another original run. Browser battlefield interaction and convergence remain
unverified. No public registry change is warranted.
