# Battlezone (demo)

Activision, 1998, Direct3D (its own `plugin\dx5draw.dll` renderer) tank
action/RTS hybrid. Candidate `battlezone-demo`, app `battlezone_demo`, local only.

## Source and layout

- archive.org `Bzone`, `Bzone.rar` (47,633,321 bytes, sha1
  6a4c384207d3f1030135fb9f84251f477ba761ba). It's a CD-style tree:
  `Setup.exe`/`Splash\`, an InstallShield 5 `Install\` folder, and
  `Install\data\`, which already is the game: `bl_rel.exe`, `bzone.zfs`
  (14 MB archive) plus `bzone.zix` index, `addon\` missions, `bitmap\`
  menu art, `anims\` AVIs, `plugin\dx5draw.dll`, `Input.map`, and its own
  MSVCRT/MSVCP50/STRLKUP/ANET2 DLLs.
- The candidate extracts the RAR to `rar/` and mounts `rar/Bzone/Install` as
  `c:\`, so the game is `c:\data\bl_rel.exe` with `c:\data` as the working
  directory. No installer run needed.
- RAR entries carry the read-only attribute. The fetcher's unar fallback now
  extracts into a fresh staging dir and merges it over the destination: a
  codec-less 7z (Ubuntu's DFSG build, every boat) leaves the entries it can't
  decode as empty read-only files that `unar -f` can't overwrite.
- `bl_rel.exe` imports `Strlkup.dll` and `anet2.dll`. Both are declared in
  the app's `dlls`; undeclared, `StrLookupFind` hits `crash_unimplemented` at
  mission launch.

## Route (headless, `--batch-size=100000`)

- Batch ~80: the "BzoneAd2" ad screen, a GDI `SetDIBitsToDevice` of
  `bitmap\bzonead2.bmp`, repainted every idle pass. It captures black
  headless. A click at 320,240 (batch 280) moves on.
- Main menu (`main.BMP`): Single Player 172,108; Stars and Stripes 120,160;
  mission briefing (Luna, Luna Outpost 3); LAUNCH 550,15. Gameplay is up by
  about batch 1700 (moon base, pilot on foot beside a light tank).
- The browser route is the same, with taps.

## Emulator bug it found: heap fragmentation under 1 MB

Every ad repaint pass allocates 4 KB (file buffer), 1072 bytes (BITMAPINFO,
never freed) and 921,608 bytes (pixels), then frees the 4 KB and the pixels.
Large blocks only got their own arena from 1 MB up, so the 900 KB block went
back on the ordinary free list. The next pass carved the leaked BITMAPINFO
from it, which left it too short for the next 900 KB request. Every pass took
fresh space; about 335 passes in, the heap returned NULL and the main menu
background drew grey. `$HEAP_LARGE` is now the Windows heap's
VirtualMemoryThreshold, 0x7F000 (508 KB). `test-heap-large-block-arena.js`
replays the pattern 1200 times.

## Controls (data\Input.map)

Q forward, S back, W turbo, A/D strafe, keypad 4/6 steer (`RightArrow` in the
map is the keypad key; `GreyRightArrow` etc. move the track camera), F/C
pitch, E jump, left mouse or keypad 0 (`Insert`, distinct from `GreyInsert`)
fires, right mouse or keypad Enter cycles weapons, Space is the reticle
command, Alt the target command, 1-9 the command menus, Esc the main menu.
Verified headless: keypad 4 turns, Q drives, the grey Left arrow does not
steer. The touch layout maps the stick to Q/S/keypad 4/6.

## Browser

The default lazy file policy streamed `addon\misn*.trn`, but those files are
INI text read by `GetPrivateProfileInt` at mission launch, which can't park:
VfsPendingError. `trn` is now in `lib/app-files.js` EAGER_EXTENSIONS.

## Original combat and vehicle entry (2026-11-01)

Run `scratch/runs/20261101-battlezone-original-combat-control/` reviews one
unchanged registered original, native local CLI, cooperative backend, 640×480:
`--app=battlezone_demo --no-build --batch-size=100000 --control-stdin --frozen`.
The GL predecessor's fresh final/result and 08:47:07 runtime/source/build
RELEASE were checked before the 08:48:54 gate; actual main was
`b05826e4a6d67eab69ddbacb00a685c019b474c5`. The historical accepted Battlezone
run directory was absent locally; the retained note/board established driving
only, so it did not replace this combat check.

The accepted build was reused after all 4,392 accepted inputs and 141 prior
read hashes matched. Actual runtime compilation observed module SHA-256
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
All 153 local fixture files, including the browser manifest and original
companions, matched before/after; the 3,732,992-byte EXE matched
`0554156663000fc1c0c0ad2275e460fa6fc9acda4abdd26c720b69019d04617a`.
All 4,444 source pins and 153 actual runtime file-read hashes also matched.
Read observations cover synchronous file reads and complete bounded descriptor
reads, not every possible OS/asynchronous read. These are actual runtime reads,
not compilation-time source reads relabeled at final flush. The observer's
separate actual sync/async, whole shared 512 MB readonly, clock identity, and
emitted late-10,001 retention checks passed.

Ordinary route: ad click at batch 280; initially black main-menu captures
repainted on a held Single Player press at 670/release 695. Stars and Stripes
at 920/945, Launch at 1020/1045, visible mission at 1745. Briefing instructions
say to get in a vehicle at Luna Outpost 3 and point the reticle at vehicles and
press I for additional information. I produced no reviewed information panel;
Space on the distant light tank remained “No Action.” No entry key was invented.

**Firing accepted:** the early green arcs while aiming at the friendly tank
were ambiguous and are not counted as projectile evidence. A later ground aim
shows a blue shot streak and orange impact flare. The clean stationary series
is `stationary-fire-before` (6730), `held100` (6830), `held250` (6980),
`released` (7030), and `settled` (7330), all PNGs with matching input-state
records. Left-button down was queued at 6730 and up at 6980, both at 320,240.
The impact area differs by 1,313 pixels while held and returns exactly to its
baseline after settling. Two terrain patches and the left vehicle patch are
pixel-identical across all five captures: the shot effect is not camera motion
or selection alone. The pilot ammo bar does not visibly decrease. Radar,
small HUD changes, and upper-screen rendering artifacts are not counted as
combat effects. The earlier `ground-fire-held1000.png` also shows the blue
streak, but its aim changed during that press, so it is not the fixed-camera
comparison.

**Vehicle entry and vehicle fire accepted:** Q held from 7930 to 8430 walked
into the nearby vehicle. `vehicle-info-held250.png` still shows the pilot's
Plasma Rifle/Sniper Rifle; `approach500.png`, `vehicle-entry-released.png`
(8530), and `vehicle-entry-settled.png` (8730) show AT-Stabber, Thermal Hornet,
and Solar Flare instead. This ordinary forward approach boarded the vehicle
without a separate entry key. The HUD transition supports entry beyond camera
movement. A subsequent centered left-button hold from 8730 to 8980 visibly
fires the AT-Stabber: `tank-fire-before/held100/held250/released/settled.png`
show ammo **83 → 77 → 67 → 66 → 66**, with yellow shot streaks while held.
The last decrement occurs before release processing finishes. Vehicle terrain
continues to drift slightly after the approach; this series is not a claim of
a fixed camera, and its ammo count is the independent firing outcome.

Actual input evidence is the bounded raw dequeue/route/DispatchMessage trace
and frozen queue/counter records, not merely scheduled commands. The mouse
DirectInput FIFO head remained zero and is explicitly **not** claimed as
consumed; the window-message path consumed the button edges. No guest game
structures were inspected. One original exited 0 after 551.64 seconds, with
no crash/trap. Own runtime/driver/watcher PIDs, process group, and child temps
were absent afterward; minimum free disk was 2,270,924,800 bytes. Box ID/state/
expiry are N/A. No source, test, helper, backend, registration, or default was
changed. The note and ignored run evidence are the only deliverables.

## Target-hit / unit-command attempt: prerequisite stop (2026-11-01)

Run `scratch/runs/20261101-battlezone-target-hit-command/` stopped before
launching an original. It adds **no target-hit, visible unit damage, or unit
command outcome** to the accepted entry/firing evidence above. Battlezone
remains a local candidate (`LOCAL_CANDIDATE_APPS`), absent public
`DESKTOP_APPS`; no registration changed.

The valid gate opened at **14:32:52 UTC**, after the exact
`quake2-eight-save-restoration DONE/PUSH RELEASE` messageboard action naming
`runtime/source/build`, fresh terminal launcher `final.txt`/`result.json`,
and direct predecessor PID/process-group cleanup checks. WAIT entries and
quoted conditions were not accepted as releases. Dispatch main was
`8552125804a6994de385d7f00858e789fd59024f`; actual main at the gate was
`fbb83926ba331962cc85e2c44f1b623e778e262f`. No runtime, build, or test ran
before this gate. The 25-minute gate deadline was 14:57:52 UTC.

All **4,392 accepted build-input pins and 141 prior read pins matched**,
including canonical module SHA-256
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
The actual before/after inventory contained 4,444 source pins and all 153
fixture files, including the manifest and companions; hashes and fixture
tree membership stayed unchanged. The EXE remained 3,732,992 bytes, SHA-256
`0554156663000fc1c0c0ad2275e460fa6fc9acda4abdd26c720b69019d04617a`.
These establish build eligibility and file identity, not an actual original
module load or runtime-read observation in this attempt.

**First blocker:** the scratch launcher invoked `offline.cjs` without setting
`SWEEP_CASE_DIR`. The observer takes its output directory from that variable;
`observe.cjs:44` called `path.join` with `undefined` in `save()`, producing
`TypeError [ERR_INVALID_ARG_TYPE]` and Node exit 1 at 14:32:57 UTC. This was
a worker harness prerequisite failure, not a Battlezone compatibility failure.
The sync/async instance exercises preceded the throw, but the emitted
late-10,001 check and final whole-512-MB readonly verification did not
complete. The observer contract is **not passed** for this attempt.

Per the first-failure stop condition, the harness was not repaired or rerun.
There were **zero original launches, zero gameplay inputs, and no new game
captures**, so no consumed-control, released-control, matched-neutral,
target-health, hit, kill, or command-response claim is made. The bundled
briefing's Recycler/Scavenger objective and `Input.map` were read in scratch
preparation, but the prepared command route was never executed. Existing
vehicle entry and firing/ammo decrement remain the earlier accepted results.
Local native box ID/state/expiry are N/A. No tracked source, helper, test,
configuration, backend, or registration changed. Evidence retains the gate,
pin comparisons, exact exception, and cleanup/publication records. A future
separately authorized attempt needs a complete observer validation before
launching the original; this assignment stops at the prerequisite failure.

## Corrected observer and reticle unit outcome (2026-11-01)

Run `scratch/runs/20261101-battlezone-target-hit-corrected/` adds an
**ordinary reticle command with an observable Scavenger approach**. It does
not add target damage, a kill, destination arrival, or mission completion.
The earlier vehicle-entry and firing/ammo results are not counted again.
Battlezone remains in `LOCAL_CANDIDATE_APPS`, absent public `DESKTOP_APPS`.

The exact `urban-chaos-confrontation DONE/PUSH RELEASE` action naming
`runtime/source/build`, fresh terminal launcher final/result, and directly
checked predecessor PID/group cleanup opened the gate at **14:49:06 UTC**.
Dispatch was `ad94d102f5b4a239e86d7b38970455dada45dabe`; actual main was
`c6fba571254a85245166115a08880cec00dc911d`. The gate deadline was 15:14:06
UTC. Before that gate, preparation stayed in scratch without tests or runtime.

The authorized scratch correction sets `SWEEP_CASE_DIR=__dirname` before
`offline.cjs` requires the observer. Its actual synchronous/asynchronous
execution, whole shared 512-MB readonly hash, native/import clock identity,
and emitted late-10,001 retention checks all passed before game launch.
All 4,392 accepted build inputs and 141 prior read pins matched, permitting
`--no-build`. Actual runtime compilation observed module SHA-256
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
Before/after inventories matched all 4,444 source pins and 153 original files,
including manifest, companions, and tree membership. The EXE remained
3,732,992 bytes, SHA-256
`0554156663000fc1c0c0ad2275e460fa6fc9acda4abdd26c720b69019d04617a`.
All 153 observed runtime-read hashes matched. Observation covers synchronous
string/URL reads and complete bounded descriptor reads, not every possible
asynchronous/direct OS read or compilation-time source read.

One original used the registered native cooperative CLI with
`--app=battlezone_demo --no-build --batch-size=100000 --control-stdin --frozen`.
The first 280-batch request returned after 147 seconds, within its 180-second
deadline; this was slow startup, not a timeout or established freeze. Reviewed
captures then followed ad 280/305, Single Player 326/351, Stars and Stripes
372/397, Launch 418/443, and visible mission at 1364. The actual briefing
orders the player to have the Recycler build a Scavenger; `Input.map` supplies
numbered menus and Space as the reticle command.

**Build outcome:** 5 opened the Recycler menu at 1410/1435. It offered
`1 Scavenger` for four scrap. Pressing 1 at 1502/1527 changed scrap **05/30
to 01/30** and enabled the Utility menu. Utility 3 then listed `1 Scavenger`;
selecting it opened its Follow Me / Go To Nav / Scavenge / Pick Me Up menu.
This supports a built, selectable unit, beyond an unchanged menu selection.

**Reticle outcome:** the first Space command at 1846/1871 displayed Follow
Light Tank and closed the menu, but the unit was already moving during the
neutral interval; that interval alone is inconclusive. Subsequent ordinary
relative mouse input established a terrain reticle. With the Scavenger
selected, `terrain-command-ready.png` (4764) explicitly offers **Space Go To**.
A matched 100/1/300-batch neutral bracket precedes Space down at 5165 and up
at 5265. The menu closes, and a yellow vehicle crosses the reticle area in
`reticle-goto-settled.png` (5566); that sprite alone is not the final identity
or arrival evidence.

A second, nearer terrain point is visible as a green ground highlight in
`near-goto-ready.png` (6408), again with **Space Go To** and the selected
Scavenger. The matched neutral bracket is 6408/6508/6509/6809; the command
bracket is `reticle-near-goto-before/held/released/settled.png` at
**6809/6909/6910/7210**. Space down/up were consumed, with no steering,
translation, or mouse movement during either bracket or the later approach.
Later fixed-view captures identify **Scavenger** with a world marker and a
decreasing range: `near-arrival1800.png` (9010) shows **663 m** and
`near-arrival2700.png` (9910) shows **384 m**. Its marker and radar position
also change while the foreground/base view remains visually fixed. Together
with the native Go To affordance and consumed command, this is an observable
commanded-unit approach, not camera drift, projectiles, or menu closure alone.
Arrival and the later escort/harvesting objective were not established.
Early live range readings in tens of metres were incorrect; the retained
captures support hundreds of metres and are authoritative.

All 32 key edges (16 balanced pairs) match the actual dequeue and
DispatchMessage order, with each key dequeue routed. Mouse/menu edges also
have raw consumption records; native dialog processing is not uniformly a
main-window DispatchMessage path. Final scheduled/pending/cross-thread/
renderer queues are empty; all used sampled physical/async keys, including
left-button VK1, are false. The numeric renderer mouse-button mask was
sampled **unknown**, not zero; pressed latches remain true for some used keys.
Guest post-queue and SDL consumption are unknown. No guest game structures
were inspected. All 122 retained PNGs passed CRC/deflate checks, and the full
runtime gzip validated.

An optional quantitative pixel comparison failed because Python Pillow was
absent (`ModuleNotFoundError: No module named PIL`). It was not installed,
repaired, or retried; gameplay stopped and no quantitative scene-difference
claim is made. The retained matched neutral and command captures were visually
reviewed. This analysis dependency is not a Battlezone crash or defect.

The original exited 0 after 719.25 seconds at batch 9910, without a crash/trap.
Minimum controller-sampled free disk was 2,046,517,248 bytes; the auxiliary
guard remained active through publication. Finite sampling cannot establish
unsampled disk history. Own runtime/helpers/watchers/groups and new child
temps were checked absent after shutdown. Local native box ID/state/expiry
are N/A; own shutdown was explicitly delegated. Only this note and ignored
scratch evidence changed; no tracked source/helper/test/configuration/backend
or registration changed.


## Scavenger arrival attempt: black native dialog (2026-11-01)

Run `scratch/runs/20261101-battlezone-scavenger-arrival/` extends the
identified commanded Scavenger approach to **180 m**, then stops at a
**black native-dialog transition**. It establishes neither destination arrival
nor scavenging/escort progress. The already accepted construction and
663 m → 384 m approach are setup, not new success. Battlezone remains a
`LOCAL_CANDIDATE_APPS` entry, absent public `DESKTOP_APPS`; no registration
changed.

The gate opened at **15:32:43 UTC**, after the exact author
`urban-chaos-small-step-confrontation` posted `DONE/PUSH RELEASE` naming
`runtime/source/build`, both fresh terminal launcher files existed with exit
0, and predecessor PID/group/child-temp cleanup was checked directly. No WAIT
or generic release substring qualified. Dispatch main was
`60500ae55fa28dc658402496afb6e36f88d4296f`; actual main was
`88cf06d749e4eff628e660b331b8030651edc063`. The gate deadline was 15:57:43
UTC, within the overall 17:15 UTC limit. Preparation before the gate was
scratch-only, without runtime or tests.

All **4,392 accepted build inputs and 141 prior read pins matched**, allowing
`--no-build`. The corrected scratch wiring sets `SWEEP_CASE_DIR=__dirname`
before requiring the observer. Its actual sync/async execution, whole shared
512-MB readonly hash, native/import clock identity, and emitted late-10,001
retention checks passed before launching the original. The actual runtime
compile observed module SHA-256
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
Before/after inventories matched **4,444 source pins and all 153 fixture files**,
including manifest, companions, and fixture tree membership. The original
EXE remained 3,732,992 bytes, SHA-256
`0554156663000fc1c0c0ad2275e460fa6fc9acda4abdd26c720b69019d04617a`.
All 153 observed runtime-read hashes matched. Read coverage is synchronous
string/URL reads and complete bounded descriptor reads, not all asynchronous
or direct OS reads; runtime identity is not compiler-source-read evidence.

One unchanged original used the registered native cooperative CLI:
`--app=battlezone_demo --no-build --batch-size=100000 --control-stdin --frozen`.
Actual captures were reviewed through the ad/menu route, Stars and Stripes
briefing, and mission. The live briefing orders vehicle entry, building a
Scavenger, and escorting it while it gathers bio-metal. The bundled `Input.map`
was read; no bindings were invented. Reusing the accepted route reproduced
scrap 05/30 → 01/30 and a selectable Scavenger whose menu includes
`3 Scavenge`. No Scavenge order was issued before the blocker.

The near terrain point visibly offers **Space Go To** at batch 6408.
The retained matched neutral bracket is **6408/6508/6509/6809**;
`reticle-near-goto-before/held/released/settled.png` is
**6809/6909/6910/7210**, with Space down at 6809 and up at 6909.
There is no translation, steering, or mouse movement during these brackets
or the later wait. The reused route reaches the identified **384 m** marker
at batch 9910. New reviewed captures then show **265 m at 10210** and
**180 m at 10510**, with the unit marker/radar moving in the same scene.
These remain approach evidence, not arrival.

**First visible-feedback blocker:** between batch 10510 and the next capture
at **10810**, the runtime logs `CreateDialog` for **HWND 0x10018**, a
427×274-dialog-unit template, with control **1237**. The capture becomes
entirely black. A readonly renderer window inventory later shows that dialog
visible, owned by BattleZone HWND 0x10001, with an empty title and 640×480
surface. The retained bounded no-input capture sequence at
10810/11110/11410/11710 stays black; a standard-library PNG/zlib decoder
confirms zero nonblack RGB pixels in each. This does not reveal the dialog's
message or establish whether it represents defeat, an objective result, or
another game state. No arrival, harvesting, scrap gain, target hit/kill, or
mission completion is claimed. Gameplay inputs stopped; there was no dialog
bypass, repair, retry, or second original. The runtime remained responsive
to inspection and quit, so black output is not labeled a crash or freeze.

All **32 key edges / 16 balanced pairs** match actual dequeue and
DispatchMessage order, and every key dequeue has a route record. Mouse/menu
edges retain raw consumption evidence; native menu/dialog handling does not
uniformly use main-window DispatchMessage. Final batch 11710 has empty known
scheduled/pending/cross-thread/renderer queues. All used sampled physical and
async keys, including left-button VK1, are false; some pressed latches remain
true. The numeric renderer mouse-button mask, guest post-queue, and SDL
consumption remain unknown. No guest game structures were inspected.
Retained PNG CRC/deflate and full runtime gzip checks passed. Image analysis
used Python's standard library only, without Pillow or dependency installation.

The original exited **0 after 367.89 seconds**, with no recorded crash/trap.
The supervising tool session separately reported status 143 after the gate log
recorded `HELPERS STOPPED`; its cause is not established and is not relabeled
as the original game exit. Controller-sampled minimum free disk was **2,036,707,328 bytes**, above the
2,000,000,000-byte floor; guard and publication samples are retained. Finite
sampling does not establish unsampled history. Own native runtime shutdown
was explicitly delegated; box ID/state/expiry are N/A. No tracked source,
helper, test, configuration, backend, or registration changed. Only this note
and ignored scratch evidence are deliverables. A future investigation would
need to explain the black dialog before accepting arrival or scavenging;
this assignment stops at that blocker.

## Black dialog identified; ordinary onward Scavenge order (2026-11-01)

Run `scratch/runs/20261101-battlezone-black-dialog/` identifies the formerly
black dialog as a **MISSION COMPLETED** screen and recovers its actual native
presentation. Ordinary **Next Mission → Launch → Utility → Scavenger →
Scavenge** subsequently reaches the second mission and issues its displayed
Scavenge order. A disk-floor breach stops observation before a harvesting,
scrap-gain, arrival, or escort outcome is established. No second original ran.

Preparation read the original PE resources, imports, aligned disassembly,
saved actual window inventory, and bundled `Input.map`. The changed hypothesis
was **H1: the CLI main canvas omits the native dialog backing**, rather than
the guest drawing a black dialog. Two templates initially matched the logged
geometry: resource **130**, static control **1237**, `END MISSION`, and resource
**131**, the same control/geometry labeled `BACK`. Both are 427×274 dialog
units; control 86,7 70×14 becomes logged pixel geometry 129,11 105×21.
Control ID or geometry alone therefore could not establish meaning.

The exact `urban-chaos-bounded-wait` author release, fresh terminal launcher
`final.txt`/`result.json` (exit 0), and directly verified predecessor cleanup
opened the gate at **15:57:55 UTC**. Dispatch was
`a1c43c412f2406bb58081ad4fa654b36b2973af3`; actual main was repinned to
`4d9446b48ccc83286c5ed82ee61e14f2b3f303e0`, with deadline 16:22:55 UTC.
All **4,392 accepted build inputs and 141 read pins matched**. Corrected
`SWEEP_CASE_DIR` observer validation exercised actual sync/async execution,
whole shared 512-MB readonly hashing, native/import clock identity, and emitted
late-10,001 retention before the original. Offline records are separately named.
Actual original compilation observed module SHA-256
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
All **4,444 source pins, 153 fixture files/tree members, and 156 observed
runtime-read hashes** matched afterward. The EXE remains 3,732,992 bytes,
SHA-256 `0554156663000fc1c0c0ad2275e460fa6fc9acda4abdd26c720b69019d04617a`.
Read coverage remains synchronous string/URL and complete bounded descriptor
reads, not all async/direct OS reads or compiler-source-read evidence.

The unchanged original used `--app=battlezone_demo --no-build
--batch-size=100000 --control-stdin --frozen`, reusing the predecessor's actual
controller route. Construction and the 663→384→265→180 m approach are setup.
At **10810**, readonly `dialog_get_proc_export(0x10018)` returns **0x5bd890**.
The PE call at **0x5bd72e** invokes imported `DialogBoxParamA` with template
**130** and that callback. Its initialization references custom label
`NEXT MISSION` (original VA 0x626fc4) and `MISSION COMPLETED` (0x626fac),
explaining why the template's static label alone is insufficient.

`native-dialog-direct.png` reads the existing dialog `_backCanvas` without
painting or guest writes. Existing `dlg-png` at the next batch produces
`native-dialog-scheduled.png`: both visibly show **MISSION COMPLETED**, the
debrief, and **NEXT MISSION**. Their decoded RGB bytes match exactly, with
**261,547 nonblack pixels**; the corresponding main-canvas capture has **zero**.
The matched neutral native captures also match exactly. This establishes the
displayed mission result, without independently proving the first Scavenger's
arrival, collection, or escort mechanics. The debrief describes Soviet forces,
the loss of a Recycler at Eagle's Nest 1, and recall of combat units; it is not
an inferred defeat message.

The narrow capture reproducer is the actual game's `DialogBoxParamA(130,
callback=0x5bd890)` reached by `accepted-route.json`, then frozen
`{action:"png",path:...}` versus the existing `dlg-png:PATH` plus one step,
or a direct readonly backing encode as in `inspect-dialog.py`. No repaint,
callback patch, memory write, or fabricated dialog is needed. The available
repair target is **`test/run.js` `controlPng` (around line 7388)**: it encodes
`renderer.canvas` via `canvasToPng` without the `renderer.repaint()` used by
the scheduled `png` handler around line 10141. `canvasToPng` only invokes the
DirectDraw present hook. The capture discrepancy is proved; a generic repair
and standalone API fixture were not implemented or tested here. No guest
callback/JS/concurrency/SEH algorithm was altered.

The Next Mission neutral bracket is **10811/10836/10837/10857**; ordinary
mouse down/up at visible **90,15** produces **10857/10882/10883/10903** and
the next briefing (native HWND 0x1001a, callback 0x5b4a10). After a matched
25/1/20 neutral bracket, clicking visible **Launch at 550,15** produces
**11249/11274/11275/11295**. Actual onward gameplay is reviewed at **12195**:
scrap 08/30, pilot 10/13, Command Tower at 260 m. Utility **3** lists two
Scavengers. Selecting **1** displays `3 Scavenge`; pressing **3** has bracket
**12425/12450/12451/12471**, preceded by a matched 25/1/20 neutral bracket.
The consumed order closes the command menu; scrap remains 08/30. This is
an issued native Scavenge order, not evidence of completed collection.

**First substantive blocker:** during the next requested 300-batch no-input
wait, controller-sampled free disk fell to **1,978,392,576 bytes**, below the
required 2,000,000,000-byte floor. The guard requested SIGTERM; the original
handled it orderly and exited **0 after 594.73 seconds at batch 12744**,
before that step replied. No retry, second original, foreign cleanup, bypass,
or further gameplay followed. Own redundant evidence was losslessly compacted
or removed with recovery commands; sampled free disk recovered above the floor.
The continuous-disk requirement **failed**; later recovery does not erase it.
The supervising gate session separately returned 143 after `HELPERS STOPPED`;
that is not the original's exit status. No game crash/freeze is established.

All **38 key edges / 19 pairs** match actual dequeue, route, and main-window
DispatchMessage order. Mouse actions retain raw native-dialog consumption
records. The last complete state sample is **12471**, after Scavenge release:
known scheduled/pending/cross-thread/renderer queues empty, all used sampled
physical/async keys and VK1 false. Pressed latches remain true for some keys;
numeric mouse-button mask, guest post-queue and SDL consumption are unknown.
This is not an at-shutdown state sample. **210 PNGs** pass CRC/deflate checks;
the runtime gzip validates. Analysis uses stdlib PNG/zlib, without Pillow.
Own PIDs/groups/watchers/child temps were checked absent; native local box
ID/state/expiry are N/A and own shutdown was delegated. Only this note and
ignored evidence changed; no source/helper/test/configuration/backend or
registration changed. No FPS, audio, browser/GPU, or full-suite claim is made.

## Not checked

Ad screen visibility (black headless), audio, the AVIs, multiplayer, the
completed harvesting/scrap gain or escort mechanics beyond the build, Go To,
displayed mission result and onward Scavenge order above, WebKit.
