# Dark Reign demo (Activision, 1997)

`lib/apps.js` id **`dark_reign_demo`** (localhost-only), exe
`test/binaries/win98-games-a-d/Dark Reign-SWonlyProbablyMaybeD3D/DATA/DKReign.exe`
(MSVC, `imageBase` 0x400000) with ANET2/MSS32/SMACKW32/WINET2 from the same
directory. The InstallShield 3 setup ships the game tree uncompressed in
`DATA\`, which runs as is. Manifest: `node tools/gen-win98-games-a-d-manifests.js`.
The registry entry sets **`nullPageFaults: true`** (see below).

## Route to gameplay

```sh
node test/run.js --app=dark_reign_demo --quiet-api --batch-size=50000 --max-batches=3710 \
  --input='1480:mousemove:320:252,1490:mousemove:320:180,1500:mousemove:320:100,1510:mousedown:320:100,1514:mouseup:320:100,1800:mousemove:320:150,1810:mousemove:320:200,1830:mousedown:320:200,1834:mouseup:320:200,2700:keydown:27,2703:keyup:27' --no-close --png=/tmp/dr.png
```

Main menu at ~1300 batches; Single Player (320,100) -> Training 2 (320,200);
the mission loads in ~500 batches; Escape closes the briefing.

**The mouse is DirectInput buffered (`GetDeviceData`) and the game draws its
own cursor, which moves by relative deltas.** `renderer-input.js` derives a
delta from the previous host pointer position, so the first `mousemove` only
sets the reference: start every route with a move to the game cursor's
start (320,252), then aim clicks by the *difference* between where the game
cursor is drawn and where it should go (read it off a capture). The
keyboard is DirectInput `GetDeviceState`. Left click selects and orders.

## What was fixed to get here

- msvcrt imports: `_mkdir`, `setvbuf`, `getc`/`fgetc`, `__p___mb_cur_max`,
  `__p__pctype` (834ee8ba), `_makepath` (c8b9005e).
- **`_stat` zeroed 64 bytes of a 36-byte `struct _stat`** (c8b9005e). The game
  keeps one at `[ebp-0x38]` in `0x46a420` (the resource loader), so the extra
  bytes zeroed the saved EBP and return address, and the function returned to
  NULL after reading `.\dark\local\gamemsgs.txt`. Symptom: `[eip-zero]` right
  after a `strncpy` at `0x46a616`. Arming `--watch` hid it only because a
  watchpoint ends the batch at every change and shifts the whole route.
- **NULL guard page** (6f9aa1b4). `0x425166` walks the EBP chain to record a
  call stack (debug allocator), stopping at a return address >= 0x80000000 or
  when reading the outermost frame (`[0+4]`) faults into its `__except`. On our
  NULL sentinel it read zeros forever, on the mission-load bar at ~45%.
  `nullPageFaults` raises for guest accesses below 0x1000 only (Win98's rule);
  `--fault-null=raise` is not a substitute, as it also raises for MSS's
  `0xac44` probe, which Win98 answers.

- **Browser only: "Invalid cursor file [.\dark\graphics\intface\mouse.crs]"**
  ~20 s after launch under the default lazy file policy (`?eager-files` and
  the CLI were fine). The cursor loader at `0x4147a0` opens the file through
  `0x445a30` (msvcrt `_open(path, _O_BINARY)`) and reads its header with
  `_read(fd, buf, 4)`. The CRT read family used the BOOL host read, which
  reports a nonresident lazy chunk as a failure, so `_read` returned -1. The
  msvcrt readers (`_read`, `fread`, `fgets`, `getc`/`fgetc`) now park on
  IO_WAIT and retry like `ReadFile` (`test/test-crt-lazy-read-park.js`).
  Reproduce headless with `--lazy-ranges`.

## Leads

- T1 is MSS's DirectSound service thread (`CreateThread(0x97c2b0)`), which
  `SuspendThread`s main around its mixing pass.
- Multiplayer (ANET2/WINET2) is untried.

## Reviewed Training 2 selection and movement (2026-11-01)

One local original CLI invocation established ordinary player control with the
registered defaults and unchanged original files. Main menu was reviewed at
batch 1300, Single Player at 1614, and Training 2's briefing over the mission at
2334. The documented balanced Escape at 2700/2703 dismissed the briefing;
`mission-before.png` at 2803 shows the map, buildings, units and HUD. The Menu
sidebar remained open, including after another balanced Escape at 2803/2806.
The neutral capture at 2906 has the same unit and landmark positions.

The upper unit is a **Construction Rig**, initially around screen (242,80).
With the host pointer last at (320,200), normal `mousemove:337:13` at 2906
provided relative (+17,-187) motion. The reviewed hover at 2916 identified the
rig. `mousedown:337:13` at 2916 and matching `mouseup` at 2920 selected it:
`selected.png` at 2940 shows its selection box and the sidebar changing to
Build with construction choices. Hover alone was not counted as selection.

Normal `mousemove:405:73` at 2940 added relative (+68,+60) motion, putting the
game cursor over nearby open ground around (309,129). In `order-before.png`
at 2950 the selected rig is still at its original location. An ordinary left
destination click, down at 2950 and up at 2954, caused visible displacement:
`order-after-20.png` at 2974 shows the rig around (263,104), `after.png` at
3054 shows arrival around (314,130), and `settled.png` at 3104 shows it staying
there. Buildings, terrain details and the lower unit remain fixed. This is
unit translation toward the clicked ground, rather than animation or camera
scrolling. No further input followed the destination release.

Actual DirectInput consumption is retained separately from MSG dispatch.
Read-only snapshots of the generated `DI_MOUSE_INPUT_STATE` region show the
buffered ring head/tail advancing 8→10 for hover motion, 10→11→12 for selection
down/up, 12→14 for destination motion, and 14→15→16 for the destination click.
Consumed ring slots retain the relative-axis events and type-1/type-2 button
events; pending ring count is zero at each capture. The head advances in
`di_mouse_event_take`, called by `IDirectInputDevice_GetDeviceData`. Bounded
GetDeviceData/GetDeviceState API traces, successful HRESULTs, ordinary input
dispatch logs and frozen host queue snapshots are also retained. Dispatch
alone does not prove DirectInput consumption; its correlation remains
unavailable. The separate unbuffered axis accumulators are not claimed empty.

Actual main after the Alice final/result plus explicit runtime/source/build
release gate was `c940f231dbccd0b0cdf4dd82c4570db38b3eb1a0`. The accepted locked
build was reused after all 4,392 accepted inputs, 141 prior runtime reads,
module and generated mirror matched. The actual instantiated production module
was SHA-256
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
All 4,444 current source pins, 257 original/manifest pins, 255 manifest entries
and 228 actual runtime read identities passed post-run verification. This
includes the original EXE, loaded DLLs, manifest and assets, not a compilation
container. The reused observer passed actual synchronous/asynchronous emitted
execution, whole shared 512 MB read-only and clock-identity checks, and bounded
late-10,001 retention. No source, registration, guest or config edit was needed.

Shutdown evidence has a limit: after the reviewed final capture, the controller
session returned status 143 before writing its `finally` summary. The original
child's exit code and the controller's minimum-free-disk summary are unavailable;
the child's exit observer did persist its final 228-read identity manifest.
Flushed log content was recovered losslessly from the unfinished gzip stream.
Controller, original PID/group, both watchers and temporary paths were verified
absent. Startup free space was 2,375,577,600 bytes; the active controller enforced
the >2 GB floor. No second original was run. Local-only run: box ID/state/expiry
are N/A.

Evidence: `scratch/runs/20261101-dark-reign-original-mission-control/`, including
the reviewed before/selected/intermediate/after PNGs, `review.json`, controls,
DirectInput snapshots, `input-consumption.json`, actual module/read identities,
unchanged source/original pins, observer validation, exit limitations and cleanup.
This establishes Training 2 mission arrival, selection and destination movement;
it does not establish mission completion, combat, audio, FPS, GPU or full-suite
playability.
