# Incoming (demo, "Lux et Robur")

Rage Software, 1998, Direct3D (DirectDraw + D3D, DirectInput keyboard,
DirectSound, DirectPlay) arcade shooter: you fly or drive vehicles and man gun
turrets. Candidate `incoming-demo`, app `incoming_demo`, local only.

## Source and layout

- archive.org `incoming_201401`, `incoming.exe` (3,971,633 bytes, sha1
  c00f73f19088d50c8fb3690fc7a0fea503ea5f5f).
- That file is a WinZip self-extractor, and the zip inside is a ready-to-run
  tree (no installer): `incoming.exe` (the game, 926,208 bytes),
  `gameindex.exe`, `asc\` (language text, level scripts `levels.txt`,
  `africa\*.odl/.wdl/.bin`, `pads\PAD0.CTL`), `ppm\` (256x256 PPM textures),
  `pcobject\` (`.ian` models), `wavs\`, and `save\incoming.cfg` plus `store.lev`.
- The candidate extracts the zip to `installed/incoming` (guest
  `c:\incoming`). The working directory must be the game folder: it opens
  `asc\language\.\keychar.txt` relative to it, and a bare `--exe=` run stops on
  the "Incoming Error Report." MessageBox "File asc\language\.\keychar.txt not
  found !!".
- Imports: USER32, GDI32, WINMM, ole32, DDRAW, DINPUT, DPLAYX, DSOUND,
  KERNEL32. The readme lists its command-line switches (`-notfullscreen`,
  `-nosound`, `-nolighting` ...); none are needed.

## Route (headless, `--batch-size=100000`)

- About 1,500 batches of loading ("Please wait.... loading Incoming." window,
  646x506), then the 640x480 3D main menu: Start Game / Load Game / Game
  Options / Exit.
- Enter on Start Game, then Enter three more times (about 400 batches apart),
  goes through the Mission Briefing (Kenya, ADATA installation) into phase 1/10
  in the gun turret. Frames at 3,400 batches and later show gameplay.
- In the browser, four taps on the touch Enter button do the same.
- Game Options = Down x2 + Enter; Controller is the fifth item. Its Keyboard
  page is the authoritative key chart: Space fire primary, L Shift fire
  secondary, arrows left/right/up/down, Q forward, A reverse, Z/X rotate
  left/right. The touch layout uses exactly these keys.
- Don't press Enter blind in the Video submenu: it toggles the first setting
  (Lighting).

## Verified behaviour

- Left held about 90 batches turns the turret about 180 degrees, toward the base.
- Space fires: the score went to -3000 with "RADAR DAMAGED" when the turret
  faced the friendly radar dish.
- L Ctrl does nothing, as the chart says.
- Browser at 844x390: holding the dpad turns the turret, and holding Fire draws
  tracers.

Evidence: `scratch/runs/20261011T1822Z-incoming-demo-w4/`.

## Native hostile combat and onward phase (2026-11-01)

Reviewed run `scratch/runs/20261101-incoming-native-phase-progress/` advances
beyond the earlier friendly-radar shot. One original `incoming_demo` execution
used the stock registration and `c:\incoming` working directory. Brief Enter
holds across batches selected Start Game, Campaign Action, and the Kenya
briefing; same-batch `keypress` taps did not select Start Game in this run.

From score 0 and phase 1/10, ordinary arrow holds aimed toward red-bracketed
alien fighters. Space primary fire and left Shift secondary fire produced
visible weapon effects, hostile explosions, and score increases to 250, 500,
and ultimately a retained 6,500. Damage is established by the score/explosion
sequence, not inferred from tracers. The paired captures include
`hostile-before-fire.png`, `primary-held8.png`, `secondary-held8.png`,
`hostile-score250.png`, `hostile-score500.png`, and `hostile-score6500.png`.

At batch 8265, `phase-complete.png` visibly says **PHASE COMPLETE** and shows
the turret from an external camera. By batch 8565 the native camera has moved
to a helicopter on its pad with **FOLLOW WAYPOINT VIA GREEN ARROW**; firing
keys were released and `helicopter-waypoint.png` retains that new objective.
This matches the original `africa_action.mdl` next `phasestart`, which switches
the hero to `rez` and sets the waypoint. The numeric phase-2 HUD was not
captured. This proves the onward native transition, not completion of the
helicopter phase or the demo.

`input-consumption.json` and the streamed `runtime.log.gz` retain actual
WM_KEYDOWN/WM_KEYUP dequeue, routing, and DispatchMessageA consumption, plus
successful native IDirectInputDevice_GetDeviceData calls. Read-only snapshots
of the acquired DirectInput keyboard ring show sequence/head advancement and
empty buffers without overflow: before firing sequence/head 24/24,
primary held 27/27, secondary held 34/3, and released 36/5 (capacity 31).
Corresponding WM dequeue/route/dispatch totals are 26/26/26, 29/29/29,
36/36/36, and 38/38/38. These establish consumed controls; they do not trace
every guest key-array read. SDL consumption and the guest postqueue remain
unknown.

The runtime gate pinned main `ca136b9678f8bb18f5e2e75fe5d70b7febf4b6df` after
Dethkarz's fresh terminal evidence and explicit release. Accepted module
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4` was
reused: all 4,392 accepted build-input pins and 141 prior observed-read pins
matched. Before/after checks matched 4,444 current source/build pins and all
335 original-tree/manifest files; full before/after original archives and
original configs are retained in the run. The original EXE remains
`4830a5d5091a6c4f528cd2aa3d7821873346b6e5a823ac4e71692d18d2f4402c`.
The runtime observer recorded the matching module compilation bytes and 447
actual file reads. It covers synchronous file reads and complete closed
descriptor reads up to 24 MiB, not asynchronous/stream reads or incomplete,
unclosed, or larger descriptors; it flushes at process exit. Runtime module
compilation is not evidence of compiler source reads. Its actual sync/async
execution, whole shared 512 MiB memory/clock read-only checks, and emitted late
10001 retention check passed.

The sole original ran 551.986 seconds and exited 0. Startup disk was
2,201,100,288 bytes free; observed minimum was 2,151,043,072 bytes. No tracked
source, tests, helpers, configuration, registration, or backend was changed.
Own runtime/driver/group/watcher and temporary-file cleanup is recorded;
native-local box ID/state/expiry are N/A. Audio, FPS, full playthrough, and
broader renderer compatibility remain unclaimed.

## Helicopter control follow-up: launch blocked (2026-11-01)

`scratch/runs/20261101-incoming-helicopter-waypoint-control/` records a
pre-runtime disk blocker, not new helicopter progress. After Motocross worker
`01a19693-acbd-7e02-98c0-8ebb78e4484c` supplied fresh terminal files and its
10:24:06 UTC explicit runtime/source/build release, the actual 10:24:41 UTC
gate pinned main `3cddaa00c6c68e724b99b3b009fd1d417b52c516`. Free disk was
2,135,310,336 bytes: 64,689,664 bytes below this task's 2,200,000,000-byte
startup requirement. No disposable scratch belonging to this assignment could
close that gap; no foreign files were cleaned. Zero originals were launched.

The retained route and three earlier helicopter images were reviewed. The
pad, warehouse, and radar dish supply useful landmarks, but those images do
not isolate ordinary control from the native camera transition. No new
before/held/released/settled helicopter PNGs or consumed controls exist for
this follow-up; flight and waypoint progress remain open.

Identity-only checks matched the accepted module and all 4,392 accepted input
pins plus 141 prior observed-read pins. Before/after checks matched 4,444
current source/build pins and 335 original-tree/manifest files; full original
archives and configuration copies are retained. The unchanged observer passed
actual synchronous/asynchronous execution, whole shared 512 MiB read-only and
clock checks, and emitted late-10001 retention. These are observer checks, not
an original-game execution or compiler-read proof. Its synchronous-read,
bounded closed-descriptor, asynchronous/stream, and exit-flush coverage limits
above still apply; this follow-up has no game-runtime read coverage.

That 2.2 GB startup requirement was superseded by later owner resource
instructions; it is not a current launch prerequisite. A settled helicopter
baseline and ordinary held/released controls with fixed landmarks or HUD
evidence remain needed. Native-local box ID/state/expiry are N/A. No tracked
source, helper, test, configuration, registration, or backend changed.

## Helicopter owner-floor retry: runtime disk stop (2026-11-01)

`scratch/runs/20261101-incoming-helicopter-owner-floor/` launched one original,
using the retained phase-progress input route, stock `incoming_demo`, and
`c:\incoming`. The 10:40:13 UTC gate pinned main
`558e59dcf36b92471184154015cb46ac7b563950` after Motocross worker
`01a196a5-dfb9-7eb1-8a0e-ebdaf7f8800f` supplied fresh worker terminal files and
its 10:39:21 explicit runtime/source/build release. The initial assignment
specified the owner AGENTS 1.5 GB floor. Before this gate, the coordinator's
10:29:05 board entry and updated task reported a newer resumed owner goal of
**more than 2,000,000,000 bytes continuously**, with no separate 2.2 GB startup
gate; this worker acknowledged that update at 10:30:04. Gate free disk was
2,045,960,192 bytes and original startup free disk was 2,040,881,152 bytes.

The first blocker occurred during execution: the guard sampled
**1,983,717,376 bytes free**, 16,282,624 below that newer continuous floor,
and requested orderly shutdown. The original exited 0 after 123.205 seconds,
at batch 4151. `final.png` was reviewed and still shows turret phase 1/10.
This is an actual runtime disk stop, not the earlier 2.2 GB startup refusal;
the original 1.5 GB floor remained satisfied. Free space subsequently
recovered, but the transient drop's cause was not established. No foreign
files were cleaned, and no second original was launched without a concrete
changed hypothesis resolving that floor within this assignment's files.

There are **no new helicopter before/held/released/settled images or consumed
helicopter controls**. The prior helicopter images were reviewed against the
pad, warehouse, radar dish, crates, and barrels; their camera-transition
ambiguity remains unresolved. The unchanged mission script's phase-2
`camera_task` waits for the hero's distance from `replen1` to exceed 500 before
`cam_mode cockpit`, supporting a future departure comparison but not proving
motion in this run. `input-consumption.json` retains 42 WM dequeues, routes,
and DispatchMessageA consumptions plus successful GetDeviceData calls from
the replayed turret route only. Turret combat is not requalified here;
helicopter flight, waypoint progress, and completion remain open.

The accepted `dd43e4a...09aaf4` module was reused with all 4,392 accepted
build-input pins and 141 prior observed-read pins matching. Before/after
checks matched all 4,444 current source/build pins and 335 original-tree and
manifest files; full original archives and three configuration copies were
verified. EXE and manifest SHA-256 remain respectively
`4830a5d5091a6c4f528cd2aa3d7821873346b6e5a823ac4e71692d18d2f4402c` and
`df0fafd26f474beacb39ccb67a2f6c380ecfac2fd4a6a57f0f34825fc4f6a4a4`.
The observer recorded the matching runtime compilation bytes and 447 matching
actual file reads. Whole shared 512 MiB read-only, actual synchronous and
asynchronous execution, clock identity, and emitted late-10001 observer checks
passed. Read coverage remains limited to synchronous file reads and complete
closed descriptor reads up to 24 MiB; asynchronous/stream, incomplete,
unclosed, and larger descriptor reads are not covered. Observation flushes at
exit, and runtime compilation is not compiler source-read evidence.

Runtime/driver/replay process groups, the board watcher, and temporary paths
are checked in the run's cleanup evidence. Native-local box ID/state/expiry
are N/A. No tracked source, helper, test, configuration, registration, or
backend was changed. The bounded result is the measured disk-floor stop;
full playthrough, audio, FPS, and broader compatibility remain unclaimed.

## Not checked

Audio output, DirectPlay, completion of flying/driving phases after the turret,
Threads vs cooperative mode differences, WebKit.
