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

## 2026-11-01: extra repaint disproved; onward Scavenge observation interrupted

Run: `scratch/runs/20261101-battlezone-dialog-capture-harvest/`.
The exact `urban-chaos-ready-wait-repair` release, fresh launcher terminal
files, and direct cleanup passed at **16:35:46 UTC**. Input main
`6f4fa1d5ecb75f03aea8e0b354dbe7c051ca3c5f` was repinned to
`a17c5a7c85aae38a97653b801da68de6147048df`; the runtime deadline was
17:00:46 UTC. Scratch preparation preceded the gate; build, tests and the
single original followed it. The mandatory locked build, existing
`test/test-control-stdin-frozen-cli.js`, and observer validation passed.
No production capture correction or new regression test was committed:
the proposed extra repaint does not repair the real capture path.

At frozen **10810**, the actual native dialog again shows **MISSION COMPLETED**
(resource 130, control 1237, callback **0x5bd890**). Both control PNG and an
explicit `renderer.repaint()` followed by control PNG remain completely black.
Scheduled `png` at the following batch is also black. All three corresponding
native backing captures have identical RGB hashes and **261,547 nonblack
pixels**, matching the predecessor. Whole **512-MB memory hash**, EIP, API
count, and batch are unchanged around the frozen control capture and explicit
repaint. The scheduled pair separately requires one guest batch; it is not
presented as a frozen comparison.

The earlier suggestion that `controlPng` merely lacks the scheduled handler's
repaint is incomplete: **`canvasToPng` → `presentForRead` → `dxPresentHook`
already calls `renderer.repaint()`**. The actual visible dialog's GDI write
sequence is **18584**, while the main DirectDraw layer's write sequence is
**18585**, with **coverSeq 0**. Publication is not held. The exclusive compositor
in `lib/renderer.js` gates window backings against the newest present sequence;
this rejects the dialog backing at this checkpoint. No bounded
`test/run.js`-only correction was established; changing renderer freshness
rules is outside the assigned file ownership. No renderer rule, callback,
guest memory, concurrency or SEH
algorithm was changed; no replacement frame or game-specific fallback was added.
Existing native backing capture remains the readable evidence route.

Ordinary **Next Mission at 90,15** reaches the reviewed briefing at **10903**;
ordinary **Launch at 550,15** reaches onward gameplay at **11895**, with scrap
**08/30**. The live Utility menu lists two Scavengers; selecting **1** shows
**3 Scavenge**. The Scavenge action bracket is
**12125/12150/12151/12171**, preceded by the matched 25/1/20 neutral interval.
The actual key release is dequeued, routed and dispatched at **12153**. Reviewed
no-input checkpoints **12471** and **12771** (300 and 600 batches after settling)
still show **08/30**. This establishes the issued order and bounded observation,
not collection, scrap gain, or escort mechanics.

**First changed blocker:** the driver and disk monitor terminated unexpectedly;
their tool sessions returned **143**, while the original's exit hook recorded
**code 0**. At discovery around **16:46:22 UTC**, the original and both helpers
were absent. Shutdown cause is **unestablished**, and no game crash/freeze is
inferred. The driver did not write its normal `exit.json`. No second original
or further input followed. The surviving owned board watcher was explicitly
stopped. Last complete input-state evidence is **12771**, not a shutdown sample:
known scheduled/pending/cross-thread/renderer queues are empty; used physical
and async keys, including VK1, are false. Pressed latches remain true for some
keys; numeric mouse mask, guest post queue and SDL consumption remain unknown.

The original launched with **2,237,816,832 bytes** free. All recorded disk
samples exceed 2 GB; the recorded minimum is **2,181,066,752 bytes**. Monitoring
ended unexpectedly too, so continuity across that final gap is not established.
The truncated original gzip is retained unchanged; `log-recovery.json` gives a
lossless recovery recipe and hash for the exact retained prefix. The separately
named recovered-prefix gzip validates; missing shutdown output is not invented.
Terminal journals were losslessly compressed with recovery recipes.

All **4,062 scoped source/module pins, 153 fixture files and manifest members,
and 156 observed runtime-read hashes** match afterward. This source scope is
tracked/untracked JS/CJS/MJS/JSON/WAT/WATX/shell/Python/WASM files under
`src/lib/tools/test`, plus host/package/module pins; it is not the predecessor's
4,444-entry scope. The actual compilation again observes module SHA-256
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
Observer validation executes sync/async modules against whole 512-MB readonly
memory, preserves clock identity, and retains late event 10,001. Runtime read
coverage is synchronous string/URL and complete bounded descriptor reads, not
all asynchronous/direct OS or compiler-source reads. All **38 key edges / 19
pairs** match dequeue/route/dispatch order; **81 PNGs** pass CRC/deflate checks
(four are explicitly historical references). Known owned PIDs/groups and
matching helpers are absent, with no new child temps. Native local box
ID/state/expiry are N/A; own shutdown was explicitly delegated. Only this note
and ignored evidence changed. No FPS, audio, browser/GPU or full-suite claim.

## 2026-11-01: generic exclusive freshness repaired; native launch blocked

Run: `scratch/runs/20261101-battlezone-renderer-dialog-freshness/`.
The exact `urban-chaos-guard-gameplay` author release, fresh launcher
final/result (exit 0), and direct owned-process/group cleanup passed at
**17:14:58 UTC**. Input `6ca46f8ffced6b6e4331e8fa4efa33e4d91c6872`
was repinned to main `f20e19b24651f2e37fe53b422378205328338270`.
The gate deadline was **17:39:58 UTC**, inside the overall 18:00 UTC limit.
Only scratch preparation preceded this gate; source edits, build and tests
followed it. No original was launched in this run.

The generic renderer now measures exclusive GDI backing freshness against
the **last covering presentation (`coverSeq`)**, consistently with shared
native children. A newer DirectDraw write through a window-bound clipper
does not overwrite other visible window pixels. Comparing their backings
with that write's `writeSeq` incorrectly drops the active native dialog.
The correction applies to top-level and own-child backings in both the
screen compositor and its post-processing source. Existing visibility,
ancestor clipping and stack order remain authoritative. The last real
covering sequence survives later clipped writes, so previously covered
backings remain rejected until an actual newer GDI paint. There is no
game-specific branch, modal exemption, unconditional overlay or replacement
frame. The complete production delta changes three freshness predicates
and comments; callback/context, worker publication holds, concurrency and
SEH algorithms are unchanged.

`test/test-renderer-dialog-freshness.js` exercises the actual renderer's
lazy exclusive `repaint`, post-processing source and ordinary PNG encoding
with already-painted fixture backings. The final test fails against the
exact pre-change renderer: the newer clipped presentation replaces the
expected dialog pixel with the underlying primary pixel. It passes against
the correction, including real newer covering presentation, later clipped
write without stale revival, newer native repaint, hidden dialog/child,
modeless owned popup, and overlapping front-window order. An initial child
fixture omitted the absolute screen-geometry exports; those were supplied
before the final old-source negative and passing regression. These pixel
checks establish compositor behavior, not fresh Battlezone gameplay.

The mandatory `flock /tmp/wine-build.lock bash tools/build.sh` passed, as
did the new regression and focused existing native-child-overlay, owned-popup
clipping, debug scaling, GPU client-origin, worker repaint-boundary,
lossless-PNG, frozen-control-CLI and callback-census tests, plus census
negative controls. Only the declared `lib/renderer.js:host-file` census seal
was refreshed after full-delta review; ownership and nonlocal holds remain
pending. The observed regression actually read renderer SHA-256
`a7c304c678a6a91622b693c8fb5416ace4c002245c3653b65fb18fdaf59d0924`;
all **31 observed read pins** match afterward. All **4,063 scoped
source/module pins and 153 fixture paths** are unchanged between the
post-repair preflight snapshots. This includes original `bl_rel.exe`
3,732,992 bytes / SHA-256
`0554156663000fc1c0c0ad2275e460fa6fc9acda4abdd26c720b69019d04617a`
and original `Input.map`. The local built module remains
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`;
there is no newly loaded original-runtime module to attest. The scratch
observer validation executes sync/async modules against whole readonly
512-MB memory, retains event 10,001 and preserves clock identity; actual
monotonic clock reads are bounded by the before/after readings.

Prior driver/monitor status **143** was investigated using the retained
termination record and launcher code. Original exit hook **0** does not
establish a game crash; the historical signal sender/reason remains unknown.
Urban's published diagnosis likewise leaves that cause unknown and records
its detached finite supervisor's normal exit after 6,196 watchdog samples.
This run prepared the same detached-session/finite-deadline approach with
signal logging, heartbeat checks and owned shutdown. Its detached gate/disk
watcher survived its short launcher; disk sampling remained above 2 GB.
Finite sampling does not prove disk state between samples.

**First native prerequisite failure, 17:17:48 UTC:** immediate launch
headroom was **2,179,108,864 bytes**, below the required **2,200,000,000**.
Original attempts stopped with **zero originals**, no retry and no foreign
cleanup. The independently tested production repair is retained. Fresh
standard capture matching the readable actual mission-complete dialog,
ordinary Next Mission/Launch, onward gameplay and any harvesting remain
**unverified with this correction**. Historical dialog/native and black
standard PNGs were inspected as prior evidence only. There are no new game
input, release, neutral-dispatch, FPS, audio or full-suite claims. Owned
watchers/helpers were stopped and checked absent; native box ID/state/expiry
are N/A, with delegated own shutdown and ownership handed back.

## 2026-11-01: independent heartbeat stops fixed-capture preparation

Run `scratch/runs/20261101-battlezone-fixed-capture-harvest/` launched
**zero originals**. Fresh standard mission-complete capture and mission 2
arrival, harvesting or another objective change remain unverified.

Only scratch controller/route preparation ran while waiting for the exact
`urban-chaos-native-encounter` release. The accepted startup/mission route,
original `Input.map`, prior black/native dialog evidence, renderer repair
notes and Urban detached supervisor were read. A detached primary supervisor
and a separate detached heartbeat/disk enforcer were started. At
**17:28:28 UTC**, independent sample **465** observed primary counter **454**
at **1.119649 seconds** old, exceeding its one-second freshness limit.
The enforcer stopped the owned supervisor with SIGTERM. The supervisor
subsequently wrote counter **455** and recorded that signal; the cause of the
heartbeat delay is unknown. This is a preparation guard failure, with no
game process or game crash. The first-failure rule stopped all attempts;
there was no retry, original, build, regression execution or observer execution.

The supervisor signal handler overwrote the initiating `guard-failure.json`.
The initiating traceback survives in `independent-exit.json`, and the exact
sample/timestamps survive in `independent-guard.json`; the stop record explains
this overwrite. Primary sampling recorded a minimum of **2,178,494,464 bytes**
free; independent sampling recorded **2,178,514,944 bytes**. Both exceed the
2,000,000,000-byte floor. Finite sampling, including the observed stale interval,
does not establish unsampled disk history. No launch-headroom success is
claimed because no launch was attempted.

After the failure, the exact Urban author release, fresh launcher final/result
(exit 0), and direct **21 PID / 19 group** absence checks allowed documentation
and publication only. Dispatch main `ebd313fd0` was repinned to actual main
`2bc06c8a987c8b924e7b9c34447435089bbda2c0`; no runtime gate was opened.
Static post-failure read pins retain the original EXE, original map, renderer,
regression, CLI and built-module hashes. These are local file reads, not fresh
runtime/module/read-observer evidence. Previously accepted renderer/build
results were consulted without duplicating acceptance tests.

Both owned PIDs and groups are absent, matching helpers and new child temps
are absent, and delegated shutdown is complete. Local native box ID/state/expiry
are N/A. Recovery is by reading the retained scratch scripts and JSON records;
the runtime maximum remains one, but this assignment permits no new attempt.
Only this note and ignored evidence changed. No FPS, audio or full-suite claim.

## 2026-11-01: guarded capture stopped at observer launcher prerequisite

Run `scratch/runs/20261101-battlezone-guarded-capture-harvest/` launched
**zero originals**. The repaired standard mission-complete capture and mission 2
arrival, harvesting or another objective change remain **unverified**.

Scratch preparation recovered the accepted startup/mission route, original
`Input.map`, native/standard comparison and ordinary onward Scavenge controls.
The exact `urban-chaos-guard-diagnostic-encounter` author release, fresh launcher
final/result (exit 0), and direct cleanup passed at **17:49:57 UTC**. Dispatch
`7d47a40e5f518743ea7db2a5d4b6fb596084f1b5` was repinned to actual main
`c32bdc566aca2652f1d54a85b7173818b1105777`; the runtime deadline was
**18:14:57 UTC**, within the overall 19:45 UTC limit. All **4,063 accepted
source/module pins** matched again at the gate, allowing reuse of the renderer
worker's locked build and focused tests. No fresh build or regression ran.

After the gate, the tested Urban scratch guard implementation was adopted.
Its retained healthy, delayed, stale, dead-process, replaced-identity and
explicit-failure-file controls passed. Three-second monotonic freshness and
process start-tick identity checks retain direct independent disk/process/deadline
enforcement. First guard failure uses exclusive file creation, separate from
later rejection and shutdown records. The prior one-second guard was not reused.
Detached primary and independent guards advanced without a guard failure.

**First prerequisite failure, 17:50:18 UTC:** this worker mistakenly passed
Node's `offline.cjs` observer validation to the detached **Python `runpy`**
helper. Python rejected its first JavaScript line with `SyntaxError`; the
observer never executed. `helper-observer-terminal.json` retains the full error,
and `firstfailure.json` preserves the initiating failure separately from shutdown.
The first-failure rule stopped attempts: no retry, original, gameplay input,
loaded-module observation, fresh observer success or final game-release sample.
This is a worker launcher error, not a renderer regression, guard failure or
game crash. The prepared capture comparison was never executed.

Both guards stopped normally on the explicit owned stop request, after
**131 primary / 130 independent samples**. Each recorded a minimum of
**2,158,096,384 bytes** free, above the 2,000,000,000-byte floor. Finite samples
do not prove unsampled disk history. No original launch-headroom success is
claimed. Static file hashes do not establish loaded runtime identity or observed
runtime reads. Owned process/group absence and temporary-file checks are retained
in `cleanup.json`; local native box ID/state/expiry are N/A and own shutdown was
explicitly delegated.

Recovery instructions preserve the failed scripts and require using Node for
the `.cjs` observer in a separately authorized attempt, with a cheap detached
launcher check before any original. No corrected launcher was replayed here.
Only this note and ignored evidence changed. The remaining task is the actual
standard/native dialog comparison followed by visible mission 2 objective
progress. No FPS, audio or full-suite claim.

## 2026-11-01: standard mission-complete capture verified; mission 2 turret built

Run `scratch/runs/20261101-battlezone-node-controller-gameplay/` verifies the
repaired **ordinary standard PNG**, then advances mission 2 through resource
gain, Recycler arrival/deployment and a completed defensive Turret build.
One unchanged original ran; no production source or test changed.

At frozen **batch 10810**, `dialog-standard.png` visibly reads **MISSION
COMPLETED**, the debrief and **NEXT MISSION**. The contemporaneous real native
dialog backing (`dialog-standard-native.png`, HWND 0x10018, callback
**0x5bd890**, resource 130) has exactly the same decoded RGB bytes:
**261,547 nonblack pixels**, SHA-256
`ff54a979824a960bdbb1b52bdd83fec55cac7d79ee35e4f6a6501cdbbaa1587c`.
This is the standard capture succeeding, with the backing used only for
comparison. Whole **512-MB memory hash**, EIP, API count and batch are unchanged
around the frozen comparison. No repaint message, memory patch or replacement
frame was used. The first mission's individual collection/escort mechanism
is still not independently established by its displayed result.

Ordinary **Next Mission at 90,15**, then **Launch at 550,15**, reaches mission 2
at **11894** with scrap **08/30**, pilot **10/13**, and the Command Tower at
**260 m**. The live briefing explicitly orders fighting attackers and using
the Recycler to build defensive turrets. Utility **3** lists two Scavengers;
selecting **1** exposes **3 Scavenge**. The matched neutral bracket is
**12078/12103/12104/12124**; the Scavenge input bracket is
**12124/12149/12150/12170**. At **13970**, after 1,800 no-input batches, scrap
still reads 08/30, but pilot capacity has risen to **10/15** and **5 Recycler**
has become available. Its live menu confirms a Recycler with Go To Geyser.

The selected Recycler's reticle explicitly offers **Space Go To Geyser**.
The Space input bracket **14108/14133/14134/14154** follows the matched neutral
**14062/14087/14088/14108**. During the ensuing no-input observation, the large
Recycler moves into the foreground. Scrap is **08/30 at 15054**, then
**14/30 at 15354** and remains 14/30 at 15954. Selecting Recycler again at
**16046** identifies it at **29 m** with a construction menu and **0 Pack Up**,
establishing arrival/deployment rather than only an issued movement order.
This menu offers **4 Turret**, costing **05** scrap. Pressing **4** has matched
neutral **16046/16071/16072/16092** and input
**16092/16117/16118/16138**; scrap changes **14/30 → 09/30**. After another
1,200 no-input batches, Defense becomes available and scrap rises to **12/30**.
The reviewed Defense inventory and final standard PNG at **17430** list
**1 Turret**. These establish a concrete mission objective change and resource
gains beyond the predecessor's unchanged 08/30. The exact Scavenger delivery
that caused each gain was not visually identified; do not equate the HUD
increments alone with a proved harvesting mechanism or mission 2 victory.

Scratch preparation fixed the predecessor's interpreter mistake with explicit
Node/Python argv arrays. Cheap detached controls retained durable exit-0,
exit-7 and timeout receipts before any original. The exact
`urban-chaos-detached-controller-encounter` author release, fresh launcher
final/result (exit 0), and direct cleanup opened the gate at **18:09:17 UTC**.
Dispatch `19f8b03404cbb6a79bdedf02c33f9e39255610dc` was repinned to actual main
`7699f3fb00184b5d46c2cd98ad03569c5017318d`; deadline **18:34:17 UTC**.
All **4,063 accepted source/module pins** matched, allowing reuse of the
renderer repair's locked build and focused regression/renderer/capture/census
tests. Identical observer/validation bytes also allow reuse of the accepted
sync/async whole-512-MB readonly, actual monotonic clock-bounds and late-10,001
retention validation. No duplicate build, production test or offline observer
execution ran. The fresh frozen comparison supplies separate whole-memory
readonly evidence for the actual dialog capture.

Urban's newer retained runtime failure exposed a **3.012139-second** stale
published primary heartbeat with matching PID/start identity; its publication
delay cause remains unknown. This concrete scratch dependency was resolved
before the original: six-second bounded freshness and atomic heartbeat
replacement without per-sample fsync passed healthy advancing I/O, measured
**3.5-second healthy delay**, **6.15-second stale**, dead-process,
replaced-identity and explicit-failure controls. Immutable first-failure and
terminal receipts retain durable atomic-link/fsync behavior. The detached
primary supervisor and independent direct disk/process/deadline enforcement
remain separate sessions. No unchanged one-second or failing three-second
policy was replayed, and no historical signal sender was inferred.

The coordinator's direct same-task amendments at **18:11:51 / 18:16:44 UTC**
replace the original 2,150,000,000-byte launch margin with **2,100,000,000**;
the worker explicitly acknowledged this before launch at **18:17:07**.
Short board-tail checks initially missed the earlier direct answer; the full
coordination tail recovered it. The 2,020,000,000-byte early stop,
2,000,000,000-byte floor and deadline stayed unchanged. Actual launch headroom
was **2,135,273,472 bytes**. Controller-sampled minimum was
**2,049,708,032 bytes**; independent minimum **2,049,712,128**, primary minimum
**2,089,832,448**. Primary/independent histories retain **4,575/4,573 samples**
with largest timestamp gaps **2.228/2.403 seconds**. Both guards stopped
normally, without a failure. Finite samples do not establish unsampled disk
history.

The original and driver both have fresh OS wait receipts **0**, after
**726.545 seconds** of original runtime, with normal quit before the gate
deadline; the supervisor and independent guard also have normal terminal
receipts. All **18 actual detached commands** have durable successful terminal
receipts. All **48 key edges / 24 balanced pairs** match actual dequeue,
route and main-window DispatchMessage order. Final **17430** has empty known
scheduled/pending/cross-thread/renderer queues, used physical/async keys and
VK1 released. Pressed latches may remain set; numeric mouse-button mask,
guest post queue and SDL consumption are unknown.

Before/after **4,063 source/module pins**, all **153 fixture paths/tree members**
and **156 observed runtime-read hashes** match. Actual compilation observes
module SHA-256
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`;
the renderer read remains
`a7c304c678a6a91622b693c8fb5416ace4c002245c3653b65fb18fdaf59d0924`.
Original `bl_rel.exe` remains 3,732,992 bytes / SHA-256
`0554156663000fc1c0c0ad2275e460fa6fc9acda4abdd26c720b69019d04617a`,
with original `Input.map`. Read coverage is sync string/URL and complete
bounded descriptor reads, not every async/direct OS read or compiler-source
read evidence. **128 PNGs** pass CRC/complete-deflate checks and the complete
runtime gzip validates. Selected game milestones were visually inspected.
Closed own journals were losslessly compressed with byte hashes and recovery
commands; `RECOVERY.txt` preserves the controller recipes. Owned process,
group, watcher and new-temp absence is checked directly in `cleanup.json`.
Native box ID/state/expiry are N/A; delegated own shutdown is complete.
Only this note and ignored evidence changed. No FPS, audio or full-suite claim.

## 2026-11-01: mission 2 defense attempt stopped by heartbeat read-order race

Run `scratch/runs/20261101-battlezone-mission2-defense/` adds **no game
progress** beyond the predecessor's deployed Recycler and purchased Turret.
One original launched; the first real guard failure stopped it during startup,
before the accepted route sent any game input. No retry ran.

The exact `urban-chaos-allocator-probe-nov01` worker
`01a19858-8ae8-77b0-92ac-ca7ae8890f24` author release, fresh launcher final/result
and directly absent owned PIDs/groups opened the gate at **18:40:09 UTC**.
Dispatch `39242f4b76421b468157ee51d7593037fcb527de` was repinned to main
`f1f89cb096421bbcd8ed13d2fa19ae50346fd5e7`; the fixed deadline was **19:05:09**.
Disk initially prevented launch. Coordinator-owned lossless cleanup subsequently
met the unchanged 2,100,000,000-byte launch margin, with the 2,020,000,000-byte
stop and 2,000,000,000-byte floor retained. Launch main was
`f37832b9091a0b4774ad9296deebc7c752573e56`, with **2,101,334,016 bytes** free.

At **18:49:54.288751 UTC**, immutable `guard-failure.json` records
**future-monotonic-heartbeat**, age **−0.009168345 seconds**, with matching
primary PID/start identity. The unchanged guard sampled its comparison clock
at **1606203.522861289**, then read a concurrently published heartbeat stamped
**1606203.532029634**. Its source samples the clock before reading the file;
the retained values expose that read-order race. Later explicit-failure
rejections and shutdown records remain separate from this initiating failure.
The six-second stale limit was not exceeded. No guard correction or relaxed
threshold was tried in this assignment.

Original **4036505** has OS wait **0** after **87.513 seconds**, with the log
ending at **258 batches** and an orderly SIGTERM shutdown. Driver OS wait is
**−15** from owned supervisor cleanup. There are **zero game-input records**;
the initial 280-batch step never acknowledged completion. No fresh PNG,
mission 2 combat/objective evidence, native save or final frozen key sample
exists. Previously reviewed standard PNGs and the original `Input.map` informed
preparation only. This is a harness blocker, not evidence of a game crash.

All **4,063 source/module pins**, **153 fixture paths/tree members**, and
**128 observed runtime-read hashes** match. The actual compiled module remains
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
Exact pins allowed reuse of the accepted locked build, focused tests and
readonly observer validation; detached Node/Python exit-0, exit-7 and timeout
controls passed in scratch. No production build, test or source changed.
Primary/independent histories contain **2,300/2,297 samples**, minimum free
disk **2,080,223,232 bytes**; finite samples do not establish unsampled history.
Owned process/group, watcher and new-temp absence is checked directly.
Native box ID/state/expiry are N/A; delegated own shutdown is complete.

`RECOVERY.txt` preserves the exact route and blocker. Before a separately
authorized original attempt, correct and test the heartbeat comparison's read
ordering while retaining genuine future/stale, identity, failure-file and
independent disk/deadline enforcement. Then advance the existing Turret through
ordinary positioning/deployment to visible defense combat or additional orders.
No FPS, audio or full-suite claim.

## Not checked

Ad screen visibility (black headless), audio, the AVIs, multiplayer, the
individual Scavenger harvesting/delivery or escort mechanics beyond the
resource gains, Recycler deployment and Turret build above, mission 2 victory,
WebKit.
