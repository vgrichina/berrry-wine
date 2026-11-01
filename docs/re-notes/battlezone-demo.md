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

## Not checked

Ad screen visibility (black headless), audio, the AVIs, multiplayer, the
RTS construction/escort command flow beyond the attempts above, WebKit.
