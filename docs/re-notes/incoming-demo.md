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

## Ordinary helicopter flight with paired controls (2026-11-01)

Reviewed run `scratch/runs/20261101-incoming-helicopter-margin/` demonstrates
ordinary helicopter departure and flight in phase **2/10**. One unchanged
original used stock `incoming_demo`, `c:\incoming`, the retained phase-progress
route, batch size 100000 and its unchanged 200 ms control clock. Turret combat
was replayed only to reach the helicopter; it is not requalified here.

The 10:57:08 UTC gate pinned actual main
`86bf6a3a0c539c6992e2cab6b08a0d57befe0ea0`, after Motocross worker
`01a196bc-cfb9-78d2-8eaa-4fd57a8ebfd1` supplied fresh launcher final/result
files and its 10:56:53 explicit runtime/source/build release. The coordinator's
authenticated redundant Icewind ZIP reclamation supplied the changed disk
margin; this worker performed no foreign cleanup. Gate free disk was
2,588,110,848 bytes, startup 2,583,040,000, and the runtime guard minimum
2,558,226,432, continuously sampled against the 2,000,000,000-byte floor.
There was no separate 2.2 GB startup or RAM gate. The earlier 123-second run
remains a disk stop with no helicopter progress.

The retained paired PNGs separate player flight from the automatic camera:

| Control comparison | Before | Held | Released | Later, without input |
|---|---|---|---|---|
| Up arrow, 8 batches | `helicopter-neutral100.png` (8867) | `helicopter-up-held8.png` (8875) | `helicopter-up-released2.png` (8877) | `helicopter-up-settled40.png` (8917) |
| Q, 40 batches | `helicopter-up-settled40.png` (8917) | `helicopter-q-held40.png` (8957) | `helicopter-q-released2.png` (8959) | `helicopter-q-settled80.png` (9039) |
| Q, 60 batches | `helicopter-q-settled80.png` (9039) | `helicopter-forward-held60.png` (9099) | `helicopter-forward-released2.png` (9101) | `helicopter-forward-settled40.png` (9141) |
| Up arrow, 200 batches | `helicopter-rotate-left-settled40.png` (9350) | `helicopter-flight-held200.png` (9550) | `helicopter-flight-released2.png` (9552) | `helicopter-flight-settled100.png` (9652) |
| Z, 120 batches | `helicopter-flight-settled100.png` (9652) | `helicopter-heading-held120.png` (9772) | `helicopter-heading-released2.png` (9774) | `helicopter-heading-settled100.png` (9874) |
| Up arrow, 100 batches | `helicopter-heading-settled100.png` (9874) | `helicopter-flight-confirm-held100.png` (9974) | `helicopter-flight-confirm-released2.png` (9976) | `helicopter-flight-confirm-settled100.png` (10076) |

Arrival at batch 8767 and the 100-batch neutral comparison retain the helicopter
over the pad against the warehouse, radar dish, crates and barrels. The short
Up/Q sequence shifts the helicopter relative to that pad before the cockpit
switch. At 9039 the HUD visibly reads phase 2/10 with the green waypoint arrow.
Subsequent cockpit comparisons show the radar building/dish moving below the
view, then the large dish passing close beneath the helicopter and out of
view while the hills enlarge ahead. Z produces a visible bank that levels
after release. These later cockpit sequences establish ordinary controlled
flight beyond the camera transition. The shipped chart calls Q forward and
Z rotate left; the Q captures visibly gain height, so filenames containing
`forward` identify the chart's Q input rather than a measured horizontal axis.
“Settled” names mean the stated no-input interval, not proven zero velocity.

`consumed-controls-review.json`, input-state/DI snapshots and compressed runtime
logs retain actual consumption. From neutral to the first Up hold/release,
WM dequeue/route/dispatch totals advance 46 to 47 to 48, and DirectInput
sequence/head advance 44/13 to 45/14 to 46/15. Final Up before/held/released/
later totals are 60/61/62/62 and sequence/head 58/27, 59/28, 60/29, 60/29.
All retained keyboard rings are active, empty and without overflow. Some
two-batch releases precede WM dispatch; their later snapshots retain dispatch
completion. API tracing was explicitly enabled only at batch 9652 and records
544 GetDeviceData calls with 544 successful zero returns during the later
Z/Up sequences. Earlier sequences have WM and ring evidence, not that API
trace. This does not trace every guest key-array read; SDL consumption and
the guest postqueue remain unknown.

The green arrow remains visible, but no waypoint arrival, changed objective,
or helicopter phase completion was captured. The script's distance-gated
cockpit switch corroborates departure only; no numeric position or distance
was measured. Score 7000 belongs to the replayed route and is not claimed as
new helicopter combat. No weapon was held during these flight comparisons.

Accepted module `dd43e4a...09aaf4` was reused with all 4,392 accepted build-input
and 141 prior observed-read pins matching. All 4,444 current source/build pins
and 335 original-tree/manifest files matched before/after; both full original
archives and three config copies were verified. EXE and manifest SHA-256 remain
`4830a5d5091a6c4f528cd2aa3d7821873346b6e5a823ac4e71692d18d2f4402c` and
`df0fafd26f474beacb39ccb67a2f6c380ecfac2fd4a6a57f0f34825fc4f6a4a4`.
The actual runtime compilation hash matches the accepted module, and all 447
observed file-read hashes match. The retained observer passed actual sync/async
execution, whole shared 512 MiB read-only, native/import clock identity and
emitted late-10001 retention checks. Coverage remains synchronous file reads
and complete closed-descriptor reads up to 24 MiB, excluding async/stream,
incomplete, unclosed and larger descriptor reads; observations flush at exit.
Runtime compilation is not compiler source-read evidence.

The original exited 0 after 472.113 seconds; no second original was needed.
The manifest check passed. No tracked source/helper/test/config/registration/
backend edits were made. Own runtime, driver, replay process groups, watcher
and new temporary paths are checked in the cleanup evidence. Native-local
box ID/state/expiry are N/A. Waypoint arrival/completion, audio, FPS and full
playthrough remain unclaimed.

## Waypoint arrival attempt: navigation unresolved (2026-11-01)

Run `scratch/runs/20261101-incoming-helicopter-waypoint-arrival/` does **not**
establish waypoint arrival, a changed objective, or helicopter phase completion.
One unchanged original replayed the accepted margin route and controls at
batch size 100000 and the same 200 ms batch clock. The pad, warehouse, radar
dish and cockpit flight endpoint were reproduced. This setup is already
accepted by `4088515ae`; it is not new progress.

The first unresolved obstacle was maintaining a verified waypoint approach
from the green arrow. Consumed Left/Right and X inputs changed the view and
marker, but the attempt did not establish a reliable forward bearing from
the marker's different projected shapes. Initial Up flight brought the cooling
towers close ahead; Q gained height and cleared them. Subsequent Up segments
crossed ridges and pylons, while the marker remained visible and off-center
or flattened. Those images establish motion, not decreasing waypoint distance.
No runtime position, distance, or coordinate was measured or synthesized.
The mission script's approach-triggered objective is context, not proof that
its distance condition was reached. At the final batch **23796**, both
`navigation-stop.png` and `final.png` still show **phase 2/10**, score 7000,
and the green arrow, without an arrival or changed-objective message.
This is a navigation limit of this attempt, not an identified game or emulator
defect. No second original was launched without a concrete improved route.

Paired full PNGs, input-state, DirectInput and snapshot files retain the actual
controls. Useful comparisons are:

| Input | Before | Held | Released | Later without input |
|---|---|---|---|---|
| Right, 120 batches; radar installation comes into view | `nav03-right-before.png` (10310) | `nav03-right-held120.png` (10430) | `nav03-right-released2.png` (10432) | `nav03-right-later40.png` (10472) |
| Up, 600 batches; approach to cooling towers | `nav08-up-before.png` (11300) | `nav08-up-held600.png` (11900) | `nav08-up-released2.png` (11902) | `nav08-up-later40.png` (11942) |
| Q, 220 batches; tower clearance | `nav09-q-before.png` (11942) | `nav09-q-held220.png` (12162) | `nav09-q-released2.png` (12164) | `nav09-q-later40.png` (12204) |
| Up, 4000 batches; ridges and pylons, no objective change | `nav31-up-before.png` (18996) | `nav31-up-held4000.png` (22996) | `nav31-up-released2.png` (22998) | `nav31-up-later40.png` (23038) |
| X, 400 batches; bank and later leveling | `nav35-x-before.png` (23254) | `nav35-x-held400.png` (23654) | `nav35-x-released2.png` (23656) | `nav35-x-later40.png` (23696) |

The longer Up approaches also retain full captures every 250 batches, including
all sixteen intervals of `nav31`. These reviewed intervals show no objective
change; they do not rule out a message between captures. Filenames describe
actual keys and batch counts, not inferred motion axes or zero velocity.
There are no arrival PNGs because arrival was not observed.

`consumed-controls-review.json` and compressed logs retain 18,662 traced
GetDeviceData calls and 18,662 successful zero returns, with tracing enabled
from batch 8767 through 23796. The Right pair advances WM dequeue/route/
dispatch totals 66/67/68/68 and DirectInput sequence 64/65/66/66. The final
long Up pair advances WM totals 122/123/124/124 and sequence 120/121/122/122.
The final X release initially remains queued in the keyboard ring and WM
dispatch; its later capture proves both have drained, ending at WM 132 and
DirectInput sequence/head 130/6, active and empty without overflow. This does
not trace every guest key-array read; SDL consumption and guest postqueue
remain unknown. No weapons were held during navigation.

The 11:21:28 UTC gate pinned actual main
`6830abe76f8c15392579972587142d3ba7a4f2a9`, after Dethkarz worker
`01a196ca-6ce1-7fc1-9963-2692d1f4c7cc` supplied fresh launcher terminal files
and its 11:20:16 explicit runtime/source/build release. Accepted module
`dd43e4a...09aaf4`, all 4,392 accepted input pins and 141 prior read pins
matched. All 4,444 current source/build pins, 335 original-tree/manifest files,
full before/after original archives and three configuration copies matched.
The EXE and manifest SHA-256 remain respectively
`4830a5d5091a6c4f528cd2aa3d7821873346b6e5a823ac4e71692d18d2f4402c` and
`df0fafd26f474beacb39ccb67a2f6c380ecfac2fd4a6a57f0f34825fc4f6a4a4`.
The actual compilation hash and all 447 observed file-read hashes match.
Fresh retained-observer sync/async execution, whole shared 512 MiB read-only,
clock identity and emitted late-10001 checks passed. Read coverage remains
synchronous file reads and complete closed descriptor reads up to 24 MiB;
async/stream, incomplete, unclosed and larger reads are excluded, with exit-only
flush. Runtime compilation is not compiler source-read evidence.

The original exited 0 after 1489.698 seconds, within the 30-minute gate window.
Startup free disk was 2,451,689,472 bytes and the runtime minimum was
2,317,357,056 bytes; the board/disk watcher through the post-run checks reached
2,298,896,384 bytes, above the 2,000,000,000-byte floor. The driver
tool session returned 143 for an unestablished reason, but its complete
finally receipt, normal node exit and fully decodable gzip through final
statistics/PNG are retained; this is not an incomplete-log reconstruction.
Manifest and identity checks passed. Runtime/watcher groups, the driver PID,
matching own script processes and temporary paths are absent. The driver's
group ID was not recorded before exit; that coverage limit is retained in
cleanup evidence. Native-local box ID/state/expiry are N/A. No tracked
source, helper, test, configuration, registration or backend was changed.
Waypoint arrival remains open; this single assignment stops at the documented
navigation blocker without requalifying flight, combat, audio, FPS or a full
playthrough.

## Not checked

Audio output, DirectPlay, completion of flying/driving phases after the turret,
Threads vs cooperative mode differences, WebKit.
