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

## Restored display format repair — 2026-11-02

Run: `scratch/runs/20261102-braveheart-presentation-cause-next/`. This
localizes and repairs a generic format disagreement observed during the menu
to battle transition. It does **not** establish that the unreadable battlefield
is repaired, nor verify unit commands, frame completion or convergence.

The saved baseline image and mission brief were reviewed first. Its trace lacks
surface descriptors and Unlock counts, so neither a pitch defect nor absent
completion follows from its 623/620 counters. Guest disassembly identified the
retained offscreen pointer setup at `0x48d6fc..0x48d734`, presentation selector
`[0xda3108]`, and descriptors at `0xda49fc` / `0xda4a68`. A primary Lock
followed by an offscreen Lock clears the emulator's scalar
`present_lock_whole`; that is a static counter limitation, not a diagnosis of
the baseline battlefield.

After GL69793 and Oni96725 terminal results, final files, exact AUTHOR RELEASEs
and scoped helper absence, one bounded read-only native diagnostic used the
registered original, default WebGL renderer, real clock and threads. Source
snapshot `3f8e6102c613c6fcc07fc58fc5661e40605faa1a` matched all 3936 accepted
inputs and all 145 fixtures. The browser used the baseline module
`307168f9e0475fd3c10f87cbc5d98f05006c6d4494d2f564381a9a0ebe289fe6`.
No guest writes, patches, injected state, forced renderer or clock changes were
used. This diagnostic added surface descriptors, per-row byte hashes, current
mode and shared dirty/lock samples to the original route.

The reviewed menu/mission surfaces were 800×600 RGB565, pitch 1600. During
Conduct Raid, mode-active became zero, the guest's depth variable
`[0xda4b44]` became 32, and the selected presentation function became
`0x4fe980` (Flip). Its newly retained offscreen pointer instead referred to a
640×480 RGB565 surface with pitch 1280 and masks `f800/07e0/001f`.
`presentation-state.jsonl` retains the literal descriptors and surface table.
The guest's windowed initialization at `0x4fe1cc..0x4fe203` obtains depth
from GetDeviceCaps(BITSPIXEL) × GetDeviceCaps(PLANES). The emulator's GDI
current-depth query correctly returns the restored 32-bit desktop, while
DirectDraw's default allocation used the remembered 16-bit request. The
16-bit descriptor's pitch is internally consistent: this is a demonstrated
current-format disagreement, not a pitch diagnosis from a screenshot.

The controller closed during asset loading, before the noisy battlefield was
re-observed. Its neutral captures were black with zero simulation steps, so
this run supplies no new evidence about battlefield completion or a stall.
The original was not replayed after the repair.

The repair makes GetDisplayMode's pixel format/pitch and default CreateSurface
formats use the existing current-display depth helper, also used by GDI.
Remembered explicit mode values remain intact for repeat-mode notification
suppression; existing surface formats and explicit offscreen formats remain
intact. Display dimensions, presentation selection, renderer, clock, route,
original files and `api_table.json` were not changed.

`test/test-directdraw-restored-display-format.js` emits literal expected/actual
descriptors for six transitions (8/16/32-bit selected modes, restored 8/32-bit
desktops), including two shared-memory instances, odd-width row alignment,
primary/offscreen Locks, explicit and existing formats, and repeat-mode
notifications. The exact final test failed 12 format checks on old source
(exit 1) and passed on repaired source (exit 0). Four existing regressions
also passed: GetDisplayMode depth, palette format, GDI 16-bit layout and
shared fullscreen state. `flock /tmp/wine-build.lock bash tools/build.sh`
passed on the own boat. Fixed module: 2071475 bytes, SHA-256
`6fbd12aef206e346c0bde3688fc8b2ee94d410810613f2291410f388cbf9bda8`.
The first build attempt lacked two generated ToyVM bundles; regeneration
matched their local hashes before the successful full build. The boat had no
Git HEAD for the append-only API-table comparison; the local HEAD-aware API
gate separately passed, and the unchanged table hash was checked on the boat.
Preliminary test/transfer mistakes are retained in the run, including an
invalid "new" trial that actually ran old source after a transfer argument
limit. Only the SHA-verified final old/new trials support the repair result.

The original browser evidence comprises 86 retrieved and SHA-verified files
and 27 CRC-checked PNGs. The final build/test evidence comprises 51 further
verified members, including the fixed module. Recovery inputs and manifests
remain in this ignored run directory. Own boat `bx_ujxkt2u2` had original
expiry `2026-11-02T19:30:40.054Z`, recorded before use; cleanup and final state
are recorded in `cleanup.json` and `box-final.json`. Evidence verification
preceded the explicitly delegated shutdown. The transfer/runtime/retrieval
guard enforced owner `/home` free >2000000000 bytes; its minimum was 2030542848 bytes
(`local-disk-final.json`). No foreign fixture cleanup, downloads, workers or
public deployment occurred.

Next: a separately dispatched changed-module browser observation can determine
whether this generic repair makes the battlefield readable. A harness pass
is not gameplay acceptance; the private lane still needs that observation.

## Repaired-module native observation — 2026-11-02

Run: `scratch/runs/20261102-braveheart-restored-format-gameplay/`. The
restored-format repair is active, but this bounded original run still reaches
an unreadable post-loading image. Readable battlefield gameplay, Take the
Field, unit selection and ordinary commands remain unverified. The remaining
presentation cause is not localized; no further repair or original replay was
attempted.

Admission followed GL22106, then Oni71461 actual terminal results, final files,
exact AUTHOR RELEASEs and named/scoped helper absence. Their 291 and 168 final
artifact hashes were independently checked. The predecessor repair's 272
final hashes and published commit were also checked. Scratch-only gate polling
remained live at 41-second intervals before admission.

The browser used immutable source from published repair commit
`ab3596819df988f9eea258604f66a0104eea7d36`, paired with its tested
2071475-byte module SHA-256
`6fbd12aef206e346c0bde3688fc8b2ee94d410810613f2291410f388cbf9bda8`.
All 396 runtime-source and 1005 compiler/source records matched the
predecessor identities with the published repair applied. The current
checkout's 3936 accepted-baseline inputs were separately rehashed: the repair
and subsequent GL changes are explicitly recorded in
`accepted-inputs-current-refresh.json.gz`. Those later GL changes were not
mixed into this observation. The shared build was left unchanged. No new
production code or build was needed for this documentation-only task.

All 145 installed original files matched before and after use. The registered
`bhsoft.exe`, six real DLLs, default WebGL host renderer, real clock and guest
threads were retained. API-table SHA-256 remained
`8319e5f866cf102879f4debfff34a421924a8a71d87cacf8d56c5a66afaaead5`.
Local and public DESKTOP_APPS refreshes both excluded `braveheart_demo`
(46 local / 44 public entries). Source was streamed directly from immutable
Git objects and fixtures from their installed paths; no local archive or
fixture copy was created. All 4015 streamed members matched exact hashes on
the own boat before launch.

Reviewed route: visible movie → balanced Escape → Game Features → Back →
main menu → Raid Town → Stephen Feherty mission brief → Conduct Raid. One
Back press initially missed because canvas coordinates omitted the 34-pixel
page header; its before/held/released/settled captures and trusted events are
retained. The corrected native page-coordinate press reached the menu. Menu
entry is historical capability, not new gameplay progress.

`06-conduct-raid-before`, `-held`, `-released`, `-settled` preserve the entry
sequence. At settled entry, mode-active was zero, guest depth was 32, and the
new offscreen descriptor was 640×480, 32-bit, pitch 2560, RGB masks
`00ff0000/0000ff00/000000ff`; the primary surface was also 32-bit. Thus the
old restored-depth disagreement was absent in this observed allocation.

Eighteen seconds of neutral waiting then produced the first concrete blocker:
a noisy magenta strip across the top with the lower area black
(`07-loading-neutral`). No gameplay input followed. After another six seconds
of neutral settling, personally reviewed `08-final-neutral-blocker` still had
that unreadable presentation. The final retained descriptor and both surface
records were 1024×768, 32-bit, pitch 4096, with the same RGB masks. The literal
guest dimensions/stride/depth tuple was `[1024,768,3072,32]`; this observation
alone does not diagnose the remaining encoding or presentation defect. The
older second guest descriptor still described its existing 800×600 RGB565
surface; the repair intentionally preserves existing surface formats.

Read-only simulation samples changed from zero during loading to 6 and 8;
the final delta ring was `[158,150,141,141,157,140,116,126]`. Shared dirty
samples changed from 11321 to 11799 to 12579, with differing offscreen row
hashes. Frame-end/pump counters stayed 934/931. The final shared lock count
was 1. These are retained observations, not evidence of readable completed
battlefield frames, displayed FPS, a browser stall or sustained convergence.
The preserved scalar completion-counter limitation still applies.

Four mouse pairs and one Escape pair produced 14 trusted native events.
Actual holds were 574/809/848/947 ms for the mouse and 559 ms for Escape,
including capture overhead. Each pair has reviewed before/held/released/
settled page captures. Final input had an empty queue, no active event, zero
mouse buttons, and Escape false in both physical and async key state.
Controller and Chrome exited 0; server/profile and named/scoped remote
helpers were absent.

All 120 evidence files (11574746 bytes) passed remote/local SHA comparison and
an independent local reread; all 49 PNGs passed chunk CRC checks. This
verification completed before the explicitly delegated shutdown of own boat
`bx_qcyyf29j`. Its original expiry `2026-11-02T21:03:15.325Z` was recorded
before use; STOPPED was confirmed at `2026-11-02T20:11:28.467Z`.
`shutdown-admission.json`, `retrieval-verification.json`,
`retrieved/remote-helper-cleanup.json` and `boat-state.json` preserve ordering.
The guarded transfer minimum was 2043191296 bytes and retrieval minimum
2020298752 bytes, both above the required 2000000000-byte owner disk floor.
A separate shared-disk excursion during the earlier scratch-only wait is
retained in `preparation-disk-limit.json`; whole-task floor compliance is not
claimed.

Recovery and exact member identities are in this run's `RECOVERY.md`, compressed
input manifests and retrieved evidence. Git recovers the published runtime
source, but not ignored fixture/module bytes. The next bounded task should
localize the remaining unreadable presentation from these descriptors, rows
and pixels before another original run. No public promotion is warranted.
