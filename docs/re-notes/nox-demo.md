# Nox original Windows demo

## Fixture and provenance

The February 2000 original multiplayer demo is preserved at
<https://archive.org/download/NoxDemo/noxdemo.exe>. Archive metadata identifies
Westwood Studios / Electronic Arts. The publisher-hosted [GameStar April 2000
CD index](https://download.gamestar.de/public/32500/32580/04_2000_cd.pdf), page 1,
independently lists `Demos\Nox\Noxdemo.exe` as Nox Multiplayer. This corroborates
the historical filename, not the identity of the Archive copy.

Downloaded on `bx_yqnspudj`, 2026-10-13, without copying the archive to the
space-constrained coordination checkout:

| Artifact | Identity |
| --- | --- |
| `noxdemo.exe` | 46,083,584 bytes |
| MD5 | `1b96a80a11370a449c6515648578c80f` |
| SHA1 | `78c5187fd27d1264e4cce1b053e1c02bfc0b38ca` |
| SHA256 | `ba01f1b43ff1d95f4cd2ab63abe4572e9b26ab22f1b7bd8b99d852fba6607eec` |
| Extracted `nox.exe` | 1,593,344 bytes; SHA256 `496123ad275e5d626f31a845033c7ddb7d86fbbf3c2532d2e1f639f8bc77a781` |
| Extracted `mss32.dll` | 331,776 bytes; SHA256 `d7028f4f8d458b359b8cb8e6bbdf00d2ecc145643e88e9e641be98fae0bada23` |

Remote root: `/home/user/nox-demo-preflight-20261013`. `acquisition.json` records
the final redirect and verified hashes. Native `7z` archive extraction of the
WinZip self-extractor, then `distribution/Install/Game1.CAB`, yields `game/`:
125 original files, 50,450,550 bytes. Every path and size agrees with shipped
`distribution/Setup/FILESIZE.INI`; `game-manifest.json` pins every SHA256.
No native installer was executed and no license dialog was accepted.

Keep the fixture private/local-only. The shipped `Setup/LICENSE.TXT` is
restrictive; historical demo availability does not establish public
redistribution permission. Preserve the entire original distribution.

## Executable and dependency closure

`nox.exe` statically imports `mss32.dll` plus KERNEL32, USER32, GDI32, ADVAPI32,
SHELL32, ole32, WINMM, DDRAW, DINPUT, WSOCK32 and IMM32. The original Miles DLL
imports KERNEL32, USER32 and WINMM. `MP3DEC.ASI` imports KERNEL32 and mss32;
retain it, `mss16.dll` and `mssb16.tsk`. Preserve the original window resources,
`nox.csf`, configuration, audio/video bags and indexes, and maps:
`Bunker`, `Estate`, `FortNox`, `So_Woods`.

The separate original `distribution/Wolapi/` contains WOLAPI.DLL, PATCHW32.DLL
and registration utilities. They were not needed to reach the tested local
Network host route. Peer networking and Westwood Online are untested.

The pinned CLI checkout warned that real shell32.dll/ole32.dll files were not
on disk, but this route did not encounter an ordinal crash. The demo attempts
to open `music\title.wav`, which is absent from its own complete manifest; no
replacement was supplied. Audio quality is unassessed.

## Ordinary route and input

Both runs used original `game/nox.exe`, original `mss32.dll` via `--dll-seed`,
and `--vfs-include=**/*`, with no fabricated registry state or game patches.
Pinned source: `5e012cb3c575373a54a004862b3fb89cdf34766e` in remote
`/home/user/wa-focus-source-work`; module SHA256
`9b3ef6f173daaa8be90733a4b8449733d74ca861062d0383a709f4be02ce1c77`.
Its source tree `77c9daabd16e1c096467385b3cf8efc5672b6780` matches the tested
dialog-focus candidate `33efb438`. No new build or runtime fix was needed.

The inspected route is:

1. Westwood logo, then Nox title and Click to Continue.
2. Multiplay → Network → Host Game.
3. Place the host flag on the world map.
4. Select the available Conjurer; accept the character and default Jack name.
5. Dismiss the Chat Area information dialog. This area is not the arena.
6. The Game panel selects Bunker by default; click GO.
7. Inspect Jack, carpet, green body and blue crystals in the rendered arena.

Menu control needs relative mouse deltas and held presses across guest
execution. An absolute move alone did not reposition the game's pointer.
Do not assume its internal cursor remains at the host's absolute point when
entering flag placement: the game recenters that cursor. The saved control
sequence records the inspected correction.

Shipped `default.cfg` binds right mouse to MoveForward, left mouse to Action,
and Space/middle mouse to Jump. Only right-button movement was qualified here.

## Evidence and qualification

Initial investigation:
`scratch/runs/20261013T2149Z-nox-original-startup/investigation.json`.
It reaches Bunker and shows movement, but its movement commands are the
standard CLI `di-mousedown:2` / `di-mouseup:2` adapter. That run alone does not
establish the ordinary renderer right-button path.

Followthrough:
`scratch/runs/20261013T2203Z-nox-renderer-control/investigation.json`.
All 125 fixture hashes were checked again before launching. After inspecting
the Bunker screenshot, supported control eval called the ordinary handlers:

```js
renderer.handleMouseDown(437, 380, 2);
// Execute 20 guest batches, capture while held.
renderer.handleMouseUp(437, 380, 2);
// Execute 5 batches, capture; execute another 20 idle batches, capture.
```

The caller does not assign host button state, call a device-memory writer, or
modify guest game state. The normal renderer handles those input duties.
Logs show WM_RBUTTONDOWN `0x204` and WM_RBUTTONUP `0x205` delivered to NOX
`0x10001`; focus and main window stay `0x10001`, the mapping is 640×480 at
1:1, and the observed host button mask is `0 → 2 → 0`.

Root reviewed `001-arena-before.png`, `003-right-held.png` and
`005-idle-after-release.png`: Jack moves relative to the carpet and green
body, and camera scrolling exposes the adjacent room. The matching idle
control changes 192 pixels; the held comparison changes 123,557 pixels
(120,142 inside the world viewport). Images and input/state records support
the conclusion; pixel differences alone are not the gameplay criterion.

Release is proven as an input event and cleared button state, **not immediate
motion cessation**. The released and later idle screenshots still differ in
camera/world placement; this run does not distinguish animation, camera
settling or movement inertia. Do not describe the release interval as a
stationary control or infer continuous right-button state from those pixels.

The followthrough exited 0 at `2026-10-13T22:03:55.259Z`; driver 140433,
guest 140457 and process group 140457 were independently absent at
`22:04:06.130Z`. Eighteen remote artifacts were copied and hash-verified.

This qualifies a narrow original-game CLI launch and player-controlled
movement through the ordinary renderer. Registration, registered browser
launch, DOM input/pointer capture, other controls, combat, audio, FPS,
physical devices, real network peers and completion remain separate.
Evidence remains `investigation.json` until a matching candidate is registered.

## Registered CLI verification (2026-10-13 22:10 UTC)

Exact candidate `3540d8304237d6db016d0c4179088306072b8fc3` uses
`--app=nox_demo` with no EXE or DLL override. Native SFX extraction followed
by the registered Game1.CAB preparation reproduced all 125 original game
files with matching SHA-256 hashes and generated the browser file manifest.
The tested source closure matches module
`9b3ef6f173daaa8be90733a4b8449733d74ca861062d0383a709f4be02ce1c77`.

Run `20261013T2210Z-nox-registered` repeats Network/Host/Bunker and normal
renderer right-button hold20/release5/idle20. Root reviewed arena-before and
right-held captures: Jack moves relative to the carpet/body and camera reveals
the corridor. Button mask0/2/0 and WM down/up delivery were observed.
The same post-release settling/inertia limitation above remains. Guest exit0
at22:11:34.223Z; driver146061, guest146111 and guest group were absent at
22:11:54.066Z. This validates registered CLI launch and narrow movement, not
browser/DOM controls, audio, FPS, peer networking or a complete game.

## Local recovery and failed browser preparation (2026-10-31)

Run `20261031T2026Z-nox-browser` first verified that
`test/binaries/candidates/nox-demo/game/nox.exe` was absent. The old local
recovery staging directory contained no fixture. The retained registered-run
`launch.json` still contained all 125 original file hashes.

A single bounded download from the Archive URL above succeeded on October 31:
46,083,584 bytes, SHA256
`ba01f1b43ff1d95f4cd2ab63abe4572e9b26ab22f1b7bd8b99d852fba6607eec`.
Native `7z` extraction of the SFX and its `Install/Game1.CAB` recovered 125
files totaling 50,450,550 bytes. Every path, size and SHA256 matched the retained
October 13 manifest; every original destination path and size also matched
`distribution/Setup/FILESIZE.INI`. Both executable/DLL pins in the table above
matched. This compares newly downloaded Archive bytes with the retained local
pin; it does not authenticate an independent publisher-hosted binary.

Recovery recipe, with an unused fixture destination and a private evidence
directory chosen first:

```bash
curl --fail --location --connect-timeout 20 --max-time 90 \
  --max-filesize 46083584 --output "$RUN/noxdemo.exe" \
  https://archive.org/download/NoxDemo/noxdemo.exe
sha256sum "$RUN/noxdemo.exe"
# Require the exact size and archive SHA256 above before extraction.
7z x -y "$RUN/noxdemo.exe" \
  -otest/binaries/candidates/nox-demo/distribution
7z x -y test/binaries/candidates/nox-demo/distribution/Install/Game1.CAB \
  -otest/binaries/candidates/nox-demo/game
# Compare all extracted hashes and FILESIZE.INI before preparing the registry.
node tools/fetch-candidate-corpus.js --id=nox-demo --prepare
```

Retained evidence includes `acquisition.json`, download headers and command,
`game-manifest.json`, `manifest-comparison.json`, `filesize-comparison.json`,
and the recovery scripts. The archive remains inside the run directory;
the entire extracted distribution and original game remain at the registered
fixture path. The existing preparation command generated
`.wine-assembly-browser.json`; `lib/apps.js` still registers original `nox.exe`,
original `mss32.dll`, that manifest, required files and concurrency eight.
No registration/source changes, native installer, license acceptance, invented
files, altered configuration or external multiplayer connections were used.

**No browser Nox gameplay was demonstrated.** The sole browser allocation
started at 20:28:22 UTC, with target/hard/cleanup deadlines of
20:45:22/20:46:22/20:47:22. Preparation rebuilt current main
`dbc6b7947d04f6042011b6f6d45c01f06a41b733` (a descendant of the assigned
`9ed9d4b542315b5108775dca1c11c241b30d52ff`) using
`flock /tmp/wine-build.lock bash tools/build.sh`; it passed. Module SHA256 was
`d39f362187ce89abda47fa53bca6bb6576badd8d21b78e44c6fbad973d1636d8`.
Source, compiler, original-file and module pins matched before and after the
attempt. Chrome was `151.0.7922.108`, with a native 1024×768 page viewport.

The harness used `/index.html?debug&no-log`, omitting the existing private-host
`?candidates` opt-in. It also assumed `page.select('#app-select','nox_demo')`
would select Nox without checking the returned selection. The saved
`selector-before-launch.json` instead records `app: "notepad"`. Source review
also finds no exact `nox_demo` option in `index.html`, although the app registry
and local-candidate catalog contain it. Thus the debug picker is not a proven
Nox launch route even after enabling local candidates.

The first observed failure was the pin-enforcing evidence server rejecting
unplanned `/binaries/notepad.exe` with HTTP 500. The browser console recorded
`Unable to load binaries/notepad.exe: HTTP 500`; the harness then timed out
after 45 seconds waiting for a running guest. These are harness/setup failures,
not a demonstrated emulator violation or Nox startup failure. Logs, HTTP
responses, selected registry state and `failure.json` preserve the failure.
No screenshot was captured before teardown; a subsequent read-only capture
helper found the already-closed DevTools port. No second browser/runtime was
started. No Nox executable or DLL was fetched by this attempt, and there are
no new arena, movement, attack, audio or FPS findings.

Cleanup finished at 20:29:14. The controller was durably reaped with exit 1;
both monitor and board watcher were reaped with exit 0, without signals.
Independent release at 20:30:08 verified all 20 recorded PID/start identities
absent, whole Chrome/global crashpad empty, ports 38289 and 33007 closed,
profile gone, no held inputs and the browser lock free. Build/browser/heavy
preparation inherited FD9 on `/tmp/wine-browser.lock`. No test box was allocated
(Boat ID/state/expiry N/A). `full-release-final.json` records the handoff.

Next: prepare a private registered browser route with `?candidates`, verify the
actual Nox launch target before activation, and capture the first failure
before teardown. A registered `?app=nox_demo` launch route is a candidate for
that next attempt, not a tested result here. Then follow the original
Network/Host/Bunker menus and collect trusted right-button before/held/released
captures. `default.cfg` justifies left-button Action and Space/middle Jump if
an additional action is reached. The older CLI qualification remains unchanged.

## Candidate selector repair and bounded browser attempt (2026-10-31 20:42 UTC)

Run `20261031T2039Z-nox-candidates` used the recovered local fixture without
acquisition or preparation changes. All 125 original files (50,450,550 bytes)
again matched the retained hashes and all shipped `FILESIZE.INI` paths/sizes.
The browser manifest, original configuration and distribution size table were
pinned alongside the game. This is a comparison against the retained local pin,
not new independent upstream authentication.

Cheap inspection found a generic launcher defect: `initDesktop()` removed
disallowed static options but never created missing catalog options. A catalog
entry could therefore have a desktop icon without a selectable launch value.
Debug mode skipped that function entirely. The page now initializes the selector
from the applicable public/candidate/debug catalogs independently of desktop
construction, retaining existing options and adding missing ones without
duplicates. No Nox-specific executable, guest state or runtime bypass was added.

`test/test-desktop-selector-catalog.js` executes the real selector initializer
against a small select model. The old page fails because a catalog app is
missing; the repaired page passes public/private and normal/debug combinations,
selection retention and repeated initialization. The existing
`test/test-app-selector-options.js` now checks runtime population instead of
requiring a separate handwritten option for every catalog entry, and retains
catalog-disjointness checks. Both focused checks pass.

The canonical `flock /tmp/wine-build.lock bash tools/build.sh` passed before
launch. Tested HEAD was `8f72fa26491b444037e90c4f2d84eddbf26bf2b2`, a descendant
of assigned `6ae0e926a61e7e6e0edb3d099c9a0ebaf16e91fc`, plus the selector patch
preserved as `runtime-index.patch`. Module SHA256 remained
`d39f362187ce89abda47fa53bca6bb6576badd8d21b78e44c6fbad973d1636d8`.
The runtime source/compiler manifests and all original input pins matched
before/after. `build-identity.json`'s legacy `dirty` field excludes `index.html`;
the index patch and source-manifest hash record the actual tested page.

Before heavy work, an independent actual gate verified all preceding Nox
PID/start identities absent, ports 38289/33007 closed, profile gone, whole
Chrome/global crashpad empty, and FreeSpace's terminal no-runtime state. The
build and browser controller/monitor/watcher inherited FD9 on the browser lock.
Free disk exceeded 3.3 GB throughout the browser allocation. No Boat was used
(ID/state/expiry N/A).

The single Chrome 151.0.7922.108 allocation ran from 20:42:13 to 20:43:10 UTC,
with target/hard/cleanup deadlines 20:59:13/21:00:13/21:01:13. It used native
1024×768 viewport geometry, default WebGL/Worker settings and ordinary private
`/index.html?candidates&no-log`. No clock/audio/runtime overrides or external
peers were used. Unrelated desktop executable-icon fallbacks were returned as
404 by the private evidence server; Nox assets were served from their exact
pins. External page requests were blocked.

Before activation, the harness asserted the real `nox_demo` option exists,
the selected value is `nox_demo`, and its registered EXE path is the original
`test/binaries/candidates/nox-demo/game/nox.exe`. An HTTP 200 preflight returned
1,593,344 bytes with original SHA256
`496123ad275e5d626f31a845033c7ddb7d86fbbf3c2532d2e1f639f8bc77a781`.
`selector-before-launch.json`, its screenshot and `registered-exe-served.json`
preserve these successful prerequisites.

**Nox still did not run.** After closing the page Read Me, the harness called
Puppeteer's desktop-icon click with `clickCount: 2`. That emits one click with
double-click metadata, rather than two distinct clicks. The actual trusted
input record contains only one icon mousedown/up pair. The desktop handler
requires two click callbacks less than 500 ms apart. The reviewed
`failure-before-teardown.png` shows the Nox icon selected on the desktop,
without a guest or launch window. The controller timed out after 45 seconds
waiting for a running guest. This is another concrete harness activation
failure, not an emulator startup result. Nox EXE reads for its icon and HTTP
preflight do not establish guest execution. No browser Network/Host/Bunker,
movement, combat, audio or FPS result exists, and there was no retry.

The first failure image and page text were captured before teardown. The
controller was durably reaped with exit 1; monitor/watcher were reaped with
exit 0, with no signals. `full-release-final.json` at 20:43:34 independently
verified all 19 recorded PID/start identities absent, ports 44345/44817 closed,
profile gone, no held inputs, whole Chrome/global crashpad empty and lock free.
`NEWFULLRELEASE` was announced for the waiting successor before publication.

Next: use the registered direct URL `?candidates&app=nox_demo`, with the same
preflight identity assertions, or issue two distinct balanced trusted clicks
to the normal desktop icon. Do not use `clickCount: 2` as a substitute for this
handler's two-click contract. A fresh authorized browser allocation must first
establish actual Nox execution, then follow Network/Host/Bunker and capture
room-relative before/held/released right-button movement. Original readme and
bindings remain the only basis for any additional native action.


## Registered direct browser gameplay (2026-10-31 20:56–21:03 UTC)

Run `20261031T2057Z-nox-direct` establishes original-demo browser execution
and narrow trusted right-button movement. The working route is private
`/index.html?candidates&app=nox_demo&no-log`, using the existing direct-launch
implementation in `index.html` (around line 2607). No desktop double-click,
launcher edit, emulator repair, acquisition or additional runtime was needed.

The tested checkout was `41b2af821707ea44d918a7fc9890a54b96e140d8` on main,
a documentation-only descendant of assigned `e0a17ba9351bfe1e50cbf96d3e9174dfca922abb`.
All 528 accepted source pins and 867 compiler pins matched the predecessor's
successful canonical build. The existing module and the actual HTTP-served
module both matched SHA256
`d39f362187ce89abda47fa53bca6bb6576badd8d21b78e44c6fbad973d1636d8`.
It was therefore reused without rebuilding unchanged inputs. Independent
post-run checking found all source/compiler and 149 original-input pins
unchanged. The foreign WININIT prototype was neither edited nor integrated.

Before launch, all 125 original game files again matched retained SHA256 and
shipped `FILESIZE.INI` paths/sizes (50,450,550 bytes). Original configuration,
manifest, distribution table and DLL inputs were preserved. This is the
accepted local-byte comparison, not new upstream authentication. The preflight
asserted selected registry ID `nox_demo` and the registered original path
`test/binaries/candidates/nox-demo/game/nox.exe`; an HTTP 200 returned its
1,593,344 original bytes and SHA256 `496123ad275e5d626f31a845033c7ddb7d86fbbf3c2532d2e1f639f8bc77a781`.
The same target/selection/path were checked again while pausing the executable
request on the direct route. A Worker had already been instantiated at that
point; its existence alone was not counted as guest execution. Subsequent
`running: true`, the NOX window, title and game scenes establish execution.

Chrome was `151.0.7922.108`, headless with an actual 1024×768 native page
viewport (`defaultViewport: null`, no viewport emulation). COOP/COEP and
`crossOriginIsolated` passed. Normal guest Workers, WebGL and wall clock were
used, with no SwiftShader-selection, audio, clock or guest-state overrides.
No audio-quality or FPS measurement was made. External page requests were
blocked; no external game peers were supplied. Missing optional desktop icons,
build-info/auth and font-bundle endpoints fell back normally; served source,
fonts, module and game files were hash-pinned. The original shell32/ole32
absence warnings remained and did not prevent this route.

Trusted balanced DOM input reached Click to Continue → Multiplay → Network →
Host Game → map flag → Conjurer → default Jack → Chat Area. The information
dialog was dismissed with its visible OK. Chat Area was not counted as arena
play. Shipped `default.cfg` defines Home as `ToggleServerMenu`; Home opened
the Game panel, which visibly selected `bunker`. Clicking GO loaded the tiled
Bunker corridor. Escape opens the quit menu, not this server panel. The game
recenters its software cursor at flag placement; ordinary mouse motion to an
edge and back allowed visible cursor alignment without changing guest state.
Menu presses were held across execution and released between actions.

Reviewed movement captures are:

- `60-arena-before.png` and `61-idle-control.png`: Jack stands in the same
  dead-end corridor; tiled floor and wall/torch geometry retain their positions.
- `62-right-held.png`: during a requested 1,400 ms right-button hold, Jack runs
  northeast along the corridor into the adjoining room with two blue crystal
  pillars. The fixed corridor torch moves from above/right of Jack to
  below/left as the camera follows. This is movement relative to the room.
- `62-right.png`: immediately after release; the renderer mask is cleared and
  WM_RBUTTONUP (`0x205`) is queued to NOX hwnd `0x10001`.
- `63-idle-after-release.png` and `64-released-settled.png`: released captures
  show the crystal room; the later capture retains its settled geometry.

`native-input.json` records trusted button-2 down/up at page point (718,230),
1,466 ms apart including capture overhead. `input-state.jsonl` records masks
`0,0,2,0,0,0` across the six captures above, with focus `0x10001`. The release
queue is subsequently drained. The initial released frame still differs from
the later frame in camera/world placement, so this proves balanced release,
not immediate motion cessation. No attack, jump, networking with peers, audio,
FPS or complete-game qualification is claimed. No emulator failure was observed.

The allocation began at 20:56:50 UTC, with target/hard/cleanup deadlines
21:13:50/21:14:50/21:15:50. Before inherited-FD9 heavy work, an actual independent
gate checked predecessor PID/start identities, whole Chrome/global crashpad,
ports 44345/44817 and profile absence, together with Icewind's terminal
no-runtime record. Controller, supervisor, monitor and board watcher inherited
FD9 on `/tmp/wine-browser.lock`. Free disk started above 2.75 GB and remained
above the 2.1 GB early-stop threshold. Boat ID/state/expiry are N/A.

**Lifecycle limitation:** the supervising tool returned exit 143; the supervisor
identity disappeared before the final quit command, and the remaining process
tree disappeared before `finally` and the controller/helper `Popen.wait`
receipts were written. The sender/cause is unknown. No successful durable
controller/helper reap or orderly browser close is claimed. The final live
screenshot and balanced input record were saved before disappearance; an image
at the termination itself could not be captured. There was no restart or retry.
`interrupted-lifecycle.json` retains this first observed failure.

At 21:03:51, independent `/proc` PID/start checks found all 21 recorded OWN
identities absent, whole Chrome/global crashpad empty, ports 46121/42971 closed,
and FD9 free. Only then was this run's remaining profile removed. Final input
records have no held keys/buttons. `full-release-final.json` records actual
release and the missing wait receipts; NEWFULLRELEASE was announced for the
waiting Icewind worker, which must still perform its own actual gate.

Recovery: retain the current private original fixture and all run evidence;
use the same registered direct URL and verify pins before any fresh allocation.
If further runtime work is requested, first repair the supervisor lifetime so
it survives the full allocation and records durable waits. No additional Nox
build or acquisition is needed while the accepted source/compiler pins match.
This assignment stops after publishing these findings.

## Native Jump/Action follow-up: harness stop, durable lifetime (2026-10-31 21:19 UTC)

Run `20261031T2112Z-nox-action` did **not** extend gameplay verification.
The sole browser attempt stopped during startup because the scratch harness
incorrectly applied its HTTP response-header guard to an embedded `data:image`
response. No Jump, Action, menu navigation, movement, enemy hit or kill was
observed in this run. The preceding Bunker movement evidence remains the latest
gameplay result. No emulator violation or repair is established.

Before allocating the browser, the worker inspected the predecessor's
`lifetime.py` and `interrupted-lifecycle.json`. Its exit 143 remains attributed
to an unknown sender, not the emulator. A cheap scratch-only detached-supervisor
check then started and durably waited for four child roles (controller, server,
monitor and helper), with all return codes zero. Its socket closed, temporary
profile disappeared, and recorded child identities were absent. The caller also
durably waited for that supervisor. Evidence is `cheap-start.json`,
`cheap-waits.json`, `cheap-cleanup.json` and `cheap-supervisor-wait.json`.

The current Icewind original-install worker's **21:19:01 NEWFULLRELEASE** was
required; the older Nox release was insufficient. `independent-preheavy-gate.json`
records fresh PID/start absence checks against both workers, whole Chrome/global
crashpad absence, closed ports including Icewind's 34721/40747, absent profiles,
and cleared held-input records. Only then did the supervisor acquire FD9 on
`/tmp/wine-browser.lock`; controller, monitor and board watcher inherited it.
`lock-history.jsonl` contains a simultaneous four-holder PID/start/FD9 proof.
No foreign signals, deletion, profile/transcript mutation or WININIT integration
was performed. Boat ID/state/expiry are N/A.

The actual tested main revision was
`75a2966e602c932efefb0eaf98ed3d7168dae4b0`, descending from assigned
`776db4c83a4d574934d4448d3a9ea1df0de4120e`. All 528 accepted source and
867 compiler pins matched; all 125 original game files matched retained hashes
and shipped `FILESIZE.INI` sizes. The accepted module was reused without a
build, and its actual HTTP response matched SHA256
`d39f362187ce89abda47fa53bca6bb6576badd8d21b78e44c6fbad973d1636d8`.
Post-run pin checks remained unchanged. The original `default.cfg` explicitly
binds `SPACE = Jump` and `MOUSE_BUTTON_LEFT = Action`; no guessed bindings were
needed. Neither binding was exercised because startup was interrupted first.

The one allocation began at 21:19:18 UTC with target/hard/cleanup deadlines
21:36:18/21:37:18/21:38:18. It used the registered private
`?candidates&app=nox_demo&no-log` route, Chrome 151.0.7922.108, normal isolated
guest Workers/WebGL/audio/clock and a native 1024×768 viewport. No external game
peers, injected guest state or game-specific bypass was used. Minimum recorded
free disk exceeded 2.84 GB. No FPS, audio-quality or full-game claim is made.

The copied predecessor harness's `page.on('response')` listener sets
`closing = true` whenever a response lacks COOP/COEP. Its response log contains
an embedded PNG with a `data:` URL and no HTTP headers. That URL is allowed by
the request policy, but its response erroneously trips the guard. All actual
HTTP responses in this run had the required headers. Page isolation itself was
true. Replaying the exact listener with the recorded response reproduces this
early stop; no page-error or emulator-error record exists. The controller
finished its initial capture, skipped the command loop and closed normally.

`00-firstlaunch.png` was captured before teardown and reviewed: it shows
"Starting Nox Multiplayer Demo / Loading program", not an arena or action.
This is the retained failure-state image, taken by the initial snapshot rather
than a dedicated failure callback. The subsequently submitted startup-wait
command timed out unprocessed. `native-input.json` has no keyboard/button
down/up events; there are no before/during/after Jump or Action pairs.

The narrow scratch-only correction in `driver-fixed.cjs` limits the response
header guard to HTTP(S). `test-response-guard.cjs` extracts and executes the
actual old listener, then the corrected listener: old FAIL/new PASS on embedded
data and inherited-origin blob responses; valid HTTP passes, while missing
COOP, missing COEP and wrong COEP still stop. Six cases pass for the correction.
`response-guard-test.json` records this result. The corrected driver was **not**
executed in a browser: the one-attempt/no-restart limit was retained. Neither
emulator implementation nor registered selector/acquisition code was changed.

This run establishes durable orderly cleanup for its short allocation, not
proof against every possible future supervisor interruption. Detached session
supervision and fsynced receipts retained controller `Popen.wait = 0`, monitor
and board-watcher waits zero, and the caller's supervisor `Popen.wait = 0`.
The static server ran inside the controller, so its evidence is successful
server closure rather than a separate server-process wait. Chrome exited zero
with no signal; no runtime signals were recorded. `full-release-final.json`
at 21:20:41 independently found all 20 recorded PID/start identities absent,
whole Chrome/global crashpad empty, ports 33833/33501 closed, profile gone,
held inputs empty and FD9 free. NEWFULLRELEASE was announced at 21:20:52.

Recovery: retain this run, the unchanged original fixture and accepted module.
A future authorized allocation should copy the corrected scratch driver into
its own unique run, retain the tested detached supervision and actual release
gate, then use the proven direct route and Network/Host/Bunker sequence.
Capture idle/before, held Space trajectory and released landing, followed by
balanced left-button Action frames if useful. Only visible original effects
may support an action or combat claim. This worker stops after documenting and
publishing this first causal harness failure; no further browser was allocated.

## Native Space Jump/landing and left Action demonstrated (2026-10-31 21:27 UTC)

Run `20261031T2127Z-nox-jump-action` extends the accepted Bunker movement
result with original **Space Jump/landing and left-mouse Action animation**.
This was one browser allocation, without restart, rebuild, acquisition, external
peers, guest-state injection or guessed bindings. No right-button movement was
repeated. No enemy damage, kill, audio quality, FPS or complete-game result is
claimed. No emulator failure occurred.

Before runtime, the worker copied the predecessor's `driver-fixed.cjs` into this
run and reran its exact `test-response-guard.cjs` unchanged. All six cases passed:
data/blob responses retain inherited isolation; HTTP missing/wrong isolation
headers still stop. The regenerated corrected driver matched the copied hash
exactly and became this run's `driver.cjs`. `commandloop-test.json` exercises
extracted actual key/mouse/move/wait/capture branches with mocked DOM controls,
including balanced release; it checks the quit contract. This cheap check is
not browser evidence. The detached lifetime check separately durably waited for
controller/server/monitor/helper and supervisor, all zero, with socket closed,
profile gone and child identities absent. Neither predecessor was edited.

All 125 original game files matched retained SHA256 and shipped `FILESIZE.INI`
sizes; all 528 source and 867 compiler pins matched. The actual tested revision
is recorded in `build-identity.json` (assigned input
`a1183384798d9981d8fd4f9a0f65177cb442a3e7` remains an ancestor).
`actual-http-module.json` records both fetched module responses, including the
browser's `/build/wine-assembly.wasm?v=dev`: SHA256
`d39f362187ce89abda47fa53bca6bb6576badd8d21b78e44c6fbad973d1636d8`.
Post-run original/source/compiler/module checks also matched. The shipped
`default.cfg` remains `SPACE = Jump`, `MOUSE_BUTTON_LEFT = Action`.

The registered private `?candidates&app=nox_demo&no-log` route reached native
Network → Host Game → flag placement → Conjurer → Jack acceptance → Chat Area.
After dismissing its native explanation, Home opened the game panel with Bunker
selected; Go loaded the arena corridor. The first Home pair did not leave the
panel visible; a second balanced Home pair opened it. No navigation shortcut or
binding change was needed. Normal isolated guest Workers, WebGL, audio defaults
and wall clock ran in Chrome 151.0.7922.108 with a native 1024×768 viewport.

Reviewed full-frame evidence, all inside this run:

| Input | Before | During | Released / settled | Visible result |
|---|---|---|---|---|
| Space, actual 674 ms | `35-jump-before.png` | `36-jump-held-02.png` | `36-jump.png`, `38-landed.png` | Bent airborne pose and world/camera displacement; landing partly occluded by the corridor wall. |
| Space aimed toward crystal room, actual 353 ms | `40-jump-clear-before.png` | `41-jump-clear-held-02.png` | `42-landing-clear-01.png`, `42-landing-clear-03.png`, `43-landed-clear.png` | Extended jump pose and travel out of the occluded corridor, then upright landing and settled room view. |
| Left Action, actual 1,204 ms including screenshots | `45-action-before.png` | `46-action-held-01.png` | `46-action.png`, `48-action-settled.png` | Character extends an arm in an unarmed attack pose, then returns to idle at the same room position. No hit target or damage is established. |

`native-input.json` contains 105 trusted DOM events; `input-pairs.json` records
all balanced key/button pairs. There are no remaining held inputs. The left
Action renderer mask is 0 before, 1 during each held capture, and 0 on release
and settled capture. Space keydown/keyup events are trusted and balanced.
The screenshots show native animation/travel, not merely input acceptance.
The shorter second jump improves the wall-occluded first pair; both attempts
occurred inside the same uninterrupted browser session.

Runtime started 21:27:05 UTC (target/hard/cleanup 21:44:05/21:45:05/21:46:05)
and Chrome exited at 21:29:45. Minimum observed free disk was 2,702,876,672
bytes. Before FD9 acquisition, the actual independent gate checked terminal
Noxaction and Icewind releases, their recorded PID/start identities, whole
Chrome/global crashpad absence, ports, profiles and input release. Supervisor,
controller, monitor and board watcher inherited FD9 on `/tmp/wine-browser.lock`.
Boat ID/state/expiry are N/A; local shutdown was explicitly delegated.

`full-release-final.json` at 21:30:10 records controller, monitor, watcher and
supervisor durable waits all zero, Chrome exit zero without signal, internal
server closed, all 22 recorded OWN PID/start identities absent, whole
Chrome/global crashpad empty, ports 46501/45319 closed, profile gone, inputs
released and lock free. No runtime signals were needed. NEWFULLRELEASE was
announced immediately for the waiting Icewind disc-contract worker; that worker
must independently gate its own allocation. No foreign profile, transcript,
evidence, process or WININIT WIP was mutated.

Recovery: retain this run, accepted module and original fixture. The corrected
scratch driver is now browser-tested through native Jump/landing and Action.
No emulator fix or further runtime is required for this assignment. Any future
combat claim needs an actually observed target and damage in a separately
assigned task; this worker stops after publishing this outcome.

## Native item pickup and inventory/HUD change (2026-11-02)

Run `20261102-nox-native-item-interaction` demonstrates an original Bunker
**Potion of Restore Health pickup**, beyond the accepted movement, Jump and
empty Action animation. One uninterrupted browser session ran from
13:44:43 to 13:52:06 UTC. No emulator or registration change, fixture download,
guest-state injection, peers or additional browser session was used. Nox
remains a private local candidate, absent from the public `DESKTOP_APPS`.

All 125 retained original game files (50,450,550 bytes) matched their saved
SHA256 manifest, with no extra/missing game files. All shipped `FILESIZE.INI`
destination paths and sizes also matched. Original `nox.exe` remains SHA256
`496123ad275e5d626f31a845033c7ddb7d86fbbf3c2532d2e1f639f8bc77a781`.
These checks pin the retained target; they add no upstream authentication.
Original `default.cfg` specifies `MousePickup = Left`, `I`/`Q = ToggleInventory`,
right mouse `MoveForward`, left mouse `Action`, and Space `Jump`. The native
Conjurer panel also visibly says that Conjurers equip bows and staves.

Actual Rayman2 fresh and GL boolean/pointer-query terminal results, final
artifacts, exact author releases and helper cleanup preceded execution.
All 7,228 accepted GL inputs matched before reuse of its tested module from
main `57cf336895b6c551068ba3c23bea86624ecd5dd0`. The outdated `d39f` build was
not used. Both the preflight module response and the browser's
`/build/wine-assembly.wasm?v=dev` response matched SHA256
`d6e20ba99816b54b75d2423983ab7c80a0bf9bb1776b570a46d244f881b3291d`.
The finite remote materialization verified 4,037 files; all 529 browser-source,
871 tool and 152 retained original/support checks matched again after runtime.
There was no new build because the accepted prerequisites matched.

The private route was `?candidates&app=nox_demo&no-log` → Multiplay → Network
→ Host Game → flag placement → Conjurer → default Jack → Chat Area. After
dismissing its explanation, two separate balanced Home presses left the native
Game panel open with Bunker selected; Go loaded the arena. This run spawned in
a different room from the October 31 corridor, beside blue crystal structures
and a visible red floor potion. Navigation followed the actual scene.

Reviewed paired evidence, relative to this run:

| Input / observation | Before | After | Visible effect |
|---|---|---|---|
| Inventory via `I` | `retrieved/34-inventory-before.png` | `retrieved/48-inventory-after.png` | Three clothing icons and an empty fourth top-row slot become four icons, including a red potion in that slot. |
| Right-button approach, corrected hover, then left pickup | `retrieved/44-potion-hover.png` | `retrieved/46-pickup-after.png` | Native hover explicitly reads `PICK UP` / `Potion of Restore Health`; the floor potion disappears and the lower-right HUD gains a red potion with count 1. |

The first left press (`41-pickup`) was mis-aimed below the potion and produced
no pickup; it is not counted as success. Ordinary mouse movement corrected
the aim until the native pickup label appeared. The successful left press
(`45-pickup-confirmed-target`) lasted 359 ms in the trusted DOM record,
including its held screenshot. Renderer button masks were 0 before, 1 during,
and 0 after. All 176 retained DOM events were trusted; 17 key/button pairs were
balanced with no held input remaining. Pickup, floor removal, inventory and
HUD change are observed; potion use/healing, weapon equipment, crystal effects,
combat, enemy damage, kills and objectives remain untested. An empty view is
not evidence of missing enemies or a combat defect. No audio, FPS, full-game
or full-corpus claim is made.

Chrome `151.0.7922.108` used native 1024×768 geometry, isolated guest Workers,
WebGL and ordinary defaults on fresh boat `bx_7xjujn97`, TTL 3600 seconds,
original expiry `2026-11-02T14:41:28.729Z` recorded before use. Local launch
free space exceeded 2.4 GB; the one-second guard's minimum was 2,373,750,784
bytes, above its 2.02 GB stop floor. Cheap local and remote guard/controller
checks passed before Chrome. One preflight Python quoting error occurred
before any test/browser execution, was recorded, and its corrected rerun passed.

Controller and Chrome exited 0; supervisor/controller/Chrome PIDs
11311/11312/11324 were absent, both ports closed, profile absent and all
Chrome/crashpad processes absent before harvest. All 27 PNGs passed integrity
checks. The 7,910,474-byte evidence archive, SHA256
`67f8967cdd6addc61e327618a7d59a3178a15f184bf0d60a68056bab0e8a39c6`,
and all 118 manifest-listed files were independently retrieved/hash-verified
before explicitly delegated shutdown. Boat state was confirmed **STOPPED** at
`2026-11-02T13:55:08.193Z`. `result.json`, `final.txt`, `RECOVERY.txt`, paired
captures, input records and cleanup receipts preserve the result and recovery.
