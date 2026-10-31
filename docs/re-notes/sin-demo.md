# SiN Demo (Ritual Entertainment / Activision, 1998)

App `sin_demo` (candidate `sin-demo`, localOnly), "OS Rev 0.93 Demo".
Registered ff0c51dde. Quake II engine: `sin.exe` imports only system DLLs;
`ref_gl.dll`/`ref_soft.dll` and `base/gamex86.dll` load at runtime, data in
`base/pak0.pak`.

## Source and licence

archive.org `swizzle_demu_Sin`, `Sin.exe` (35471872 bytes, SHA-1
`81a61458…`): a WinZip self-extractor whose `data\` folder is a ready
install (the setup.exe beside it is not needed). The P-Z collection item also
has `SinDemo-OpenGL-SW.exe`; not used. The installed `readme.htm` and
`quickguide.doc` contain gameplay instructions; the README also contains
1998 contest rules. No software licence or redistribution permission was
found in the installed documentation. Keep this fixture private/localOnly.

## Running

- `base/default.cfg` sets `vid_ref sw` and `gl_driver 3dfxgl`; the app's
  args select `vid_ref gl` / `gl_driver opengl32` (our GL) and raise
  `cl_timeout`/`timeout` as for kingpin_demo (same Quake II loopback; not
  separately shown to be needed here). CLI needs `--headless-gl`.
- `LoadLibraryA("opengl32")` again answers `0x00400000` (see
  heretic2-demo.md); harmless.

## Route (headless, `--batch-size=50000`)

1. HARDCORPS log-on screen ("Logon Name: blade") by about b800: Enter at
   1150.
2. Circular main menu with GAME selected: Enter at 1400, 1500, 1600, 1700
   through the game menu.
3. Intro maps (JC at headquarters, Blade in the lift, the helipad briefing)
   then a reload (the loading screens recur at about b8000-b8500) and the
   first map's scripted fly-over of the city. Space at 7000/7500 did not
   visibly shorten it.
4. Player control on the rooftop from about b12500: HUD (items, ammo,
   health 89, armor). Up walks, Right turns (into a stairwell).

Evidence: `scratch/runs/20261011T0910Z-sin_demo-gameplay-claude1863`.
Not looked at: the browser, combat, sound, the software renderer.

## 2026-10-31 original-browser preflight: stopped before runtime

Run `20261031T1940Z-sin-native-browser` reread published main
`dbd1a8adfcd0278bf444d0298652a70e4ff2caa8` (strict-known-host SSH remote
readback matched). Fresh public `lib/apps.js` returned HTTP 200, SHA-256
`63bb9815e404dd7e446d3748e195c621782a04c8358580bd2cf1a864cb57e209`;
its evaluated `DESKTOP_APPS` excludes `sin_demo`. The local registry retains
the candidate and its exact arguments:
`+set vid_ref gl +set gl_driver opengl32 +set cl_timeout 100000 +set timeout 100000`.
The fixture remains localOnly; no distribution or deployment was performed.

Fresh [Archive.org metadata](https://archive.org/metadata/swizzle_demu_Sin)
returned HTTP 200 and identifies original `Sin.exe` as **35,471,872 bytes**,
SHA-1 **`81a6145811b2f0d51357559aaef8e1e386ed7840`**, MD5
`721389ac005ca313f765dce2a45f832b`. This matches the candidate corpus pin.
The one bounded acquisition of
`https://archive.org/download/swizzle_demu_Sin/Sin.exe` returned **HTTP 500
before any archive bytes**. No retry, alternate source, extraction or runtime
followed. Original-member verification is therefore **unresolved**, not passed.

Cheap local checks hashed all **22 installed files** (including `sin.exe`)
and the browser manifest; all **21 manifest entries** exist and match their
recorded sizes. These checks establish the installed baseline only. The local
`readme.htm` was read before investigation: it includes demo instructions and
the 1998 contest rules, with no code-reading restriction found in that file.
The original archive's complete README/licence set could not be reviewed.
No guest code was disassembled or investigated. Original `base/default.cfg`
confirms arrows forward/back/turn, comma/period strafe, Mouse1 attack, Space
moveup, C movedown and U use. Configs, assets, saves and registration were
preserved.

Evidence in the ignored run directory includes `archive-metadata.json`,
`acquisition.json`, `public-membership.json`, `manifest-check.json`,
`original-inputs.json` and `verification-final.json`. No browser, server,
heavy CLI or build was launched, no browser lock was acquired, and no guest
input was sent. No new screenshots or gameplay, hit, kill, objective, audio
or FPS claim is made. The historical CLI route above remains route guidance,
not browser evidence. No emulator failure or source repair boundary was reached.

Historical next boundary (superseded for the local pinned target below):
obtain the exact SHA-1-pinned original in a newly authorized
bounded acquisition, review its complete README/licence set, compare all
installed members, then pass the current lifecycle/process gate before the
native HARDCORPS → GAME → HQ/lift/helipad/flyover → settled rooftop route.
Boat ID/state/expiry: N/A (local preflight only).

## 2026-10-31 owner-pinned local browser target

Run `20261031T1953Z-sin-pinned-browser` starts from owner input
`24a30ec0f`. The owner's October 31 rule identifies the target by the
actual installed game bytes, rather than an upstream package or compilation
container. The historical HTTP 500 acquisition is not a blocker for this
target. No download is required or attempted. These are **local pins**;
independent comparison with upstream members remains unverified.

The local README identifies this as the **pre-release SiN Demo**. Its complete
text and the complete installed quick guide were reviewed before investigation.
All **23 size/SHA-256 entries** in
`20261031T1940Z-sin-native-browser/original-inputs.json` match at preparation:
22 installed files plus the browser manifest. The executable is
`installed/sin.exe`, **521,216 bytes**, SHA-256
`b247ddbcf4081ed0b2e59533e2d4e17347815303b100048112254721c6afc162`;
`.wine-assembly-browser.json` is **2,406 bytes**, SHA-256
`499bea8a1fb51d4b5827c4aaf5c9bcce776707fbeb436a549de73847a74ebd1d`.
All 21 manifest members also match their sizes. Fresh public `lib/apps.js`
excludes `sin_demo` from `DESKTOP_APPS`; the local candidate registration and
its exact arguments above remain intact. The shipped `base/default.cfg`
confirms arrows for movement/turning, comma/period for strafing, Mouse1 for
attack, Space for jump, C for crouch and U for use; its bindings take precedence
over inconsistent control descriptions in the README prose.

### Browser result: turning observed; requested rooftop actions unproven

The single browser run lasted **19:55:32–20:00:55 UTC**. It waited for the
current `blood2-pinned-build-browser-main-oct31` run's **NEWFULLRELEASE
19:55:09**, then independently acquired `/tmp/wine-browser.lock` on FD9 and
checked actual Chrome/global crashpad/profile processes before launch.
Free disk was 3,782,889,472 bytes at admission and never fell below
3,621,347,328 bytes during the monitored lifetime. The durable Python parent
retained FD9 while waiting for the controller and cleanup monitor.

Tested checkout: `0d991322565949fc51ddf036696e0c840c854e03`, with clean
runtime source. The loaded/served module SHA-256 was
`d39f362187ce89abda47fa53bca6bb6576badd8d21b78e44c6fbad973d1636d8`.
Chrome `151.0.7922.108` used `defaultViewport: null`, a native **1024×768
content area**, default isolated guest Worker, normal WebGL (SwiftShader
harness), and unchanged registered clock/audio paths. The guest retained its
default 640×480 rendering surface. No console/map/state injection, INI/cvar
edit, save load, clock change or registration change was used.

Personally reviewed captures show HARDCORPS logon → circular GAME → NEW GAME
→ Rookie, then the headquarters conversation, helipad/helicopter sequence and
city scene. The menu itself displays **OS Rev: 0.93 Demo**. The next scene is
a first-person, gun/turret-like view overlooking rooftops, with the HUD and
scripted dialogue. This was not assumed to be settled on-foot rooftop control.
Two finite Up-arrow checks (900 ms and 2,000 ms) did **not** establish walking.
A **600 ms Right-arrow press visibly changed the view** toward the SinTEK
billboard and nearby roof (`16-turn-check.png`). During the later forward
check, the native **RESTART LEVEL** menu appeared, naming **Entering Air
Assault on FCB** (`17-forward-check-held.png`, `18-terminal-menu.png`).
The exact transition/death cause was not captured or established. No restart
or second launch was attempted.

Thus the requested settled rooftop **walk plus fire/jump is not demonstrated**.
The narrower result is native menu navigation and visible first-person turning
in the air-assault scene. No fire or jump was sent, and no hit, kill, objective,
audio-listening, FPS or touch qualification is claimed. The CLI batch-12500
route remains historical guidance. No emulator fatal or defined-use violation
was identified, so there is no justified source/test repair boundary and no
source patch, rebuild or repair-test claim.

All **23 owner-pinned sizes and SHA-256 hashes**, all **21 manifest sizes**,
**528 source files**, **866 compiler files**, **43 game/shared runtime inputs**
and the module match before/after. All 186 served-file records matched pinned
bytes and a final disk readback. All 188 observed HTTP responses carried
COOP/COEP; 182 successful responses joined to file hashes. Six HTTP 404s were
recorded for static-harness ancillary paths (build-info, auth, favicons,
font bundle and the candidate icon), without a demonstrated gameplay link.
All **17 native events** were trusted: **7 balanced key pairs**, one launch
mouse pair and one mouse move. No guest Mouse1 attack occurred.

Independent cleanup at **20:01:05 UTC** found all 21 recorded runtime
PID/start identities absent, actual Chrome/global crashpad/profile processes
empty, ports **40155/45035 closed**, profile removed, held inputs empty and
the browser lock free. Runtime cleanup required no signals. The separate
preparation watcher was PID/start checked, terminated and durably reaped;
its parent and child were also absent. No foreign process was signalled.
Boat ID/state/expiry: **N/A**, local correctness run; no deployment.

Evidence: ignored run `20261031T1953Z-sin-pinned-browser`, including
`pin-before.json`, `pin-after.json`, `reviewed-scenes.json`,
`verification-summary.json`, `identity-before.json`, `identity-after.json`,
`native-input.json`, `served.jsonl`, `actual-http-responses.jsonl` and
`full-release-final.json`. Next boundary: in a separately authorized fresh
native run, establish the air-assault/on-foot phase and complete a finite
attack or jump plus clear translation before the restart transition; capture
the transition itself if it recurs. This run does not support an emulator
repair or an upstream-verification claim.

## 2026-10-31 fresh Air Assault attack/aim control

Run `20261031T2007Z-sin-air-assault` reviewed the preceding logs, captures
and complete installed README/quick guide first. The logs did not explain
the earlier restart. The guide says vehicle travel may be outside the
player's control. Original `base/default.cfg` additionally binds **Ctrl to
attack**, **Delete to look down**, Page Down to look up and arrows to turn.
No forward-walking probe was repeated.

The current Shogo worker posted NEWFULLRELEASE at 20:09:18, reporting cleanup
at 20:08:29. An independent actual Chrome/global-crashpad/profile check then
passed under inherited FD9. A **fresh full build** ran with
`flock /tmp/wine-build.lock bash tools/build.sh`, retaining FD9 through
durable Python `Popen.wait`; all build gates passed. This reconciles the
runtime/font changes merged after the previous SiN run, rather than reusing
its complete-source parity claim. Tested HEAD was
`7c510cfe06582313faa2ce6ff2deccaf2a95f0ad`; current build inputs were unchanged
through compilation. The rebuilt and served module remained **1,898,762
bytes**, SHA-256
`d39f362187ce89abda47fa53bca6bb6576badd8d21b78e44c6fbad973d1636d8`.

The sole browser lifetime was **20:10:30–20:17:09 UTC**: default isolated
guest Worker, normal WebGL, unchanged registered audio/clock and arguments,
`defaultViewport: null`, native 1024×768 content and default 640×480 guest
surface. Four native Enter presses led from startup through logged-in GAME,
NEW GAME and Rookie; HARDCORPS was not separately captured this time.
Reviewed frames show HQ, lift, helipad, city and the first-person
mounted-gun-like Air Assault view. This establishes no on-foot phase.

**Native attack and aim responses are now demonstrated.** Two finite Ctrl
holds (requested 2,000 ms and 1,600 ms, with intermediate captures) produced
barrel/lighting animation and visible impact particles on the wall and roof
(`16-original-attack-held-03.png`, `18-aimed-attack-held-03.png`). A 250 ms
Delete/Right hold changed pitch and bearing toward rooftop figures
(`17-original-aim.png`); a later 80 ms Delete/Left adjustment was balanced.
The visible ammo counter stayed **0**; no ammo-consumption or infinite-ammo
claim follows. No enemy wound, hit, kill or completed objective was confirmed.
The gun/impact response is the firing evidence.

Pilot subtitles report “They've nailed our aileron!”, “Our tail took a hit,
sir!” and “Sir, we are going down!” while the view banks over the roof.
Health reads **100, then 99** (the initially reported 93 was a visual
misread, corrected using a magnified crop of the retained original frame).
Native **RESTART LEVEL / Entering Air Assault on FCB** recurred without any
forward input. All inputs were released before the later observations.
The last captured flight frame, `21-transition-17.png`, is at
**20:15:58.321**, still health 99; the first menu frame,
`22-transition-01.png`, is at **20:16:16.566**. This **18.245-second capture
gap** leaves the exact death/transition frame and cause unresolved.
Read-only observations continued until the menu was reviewed; no menu item
was activated and no restart/retry occurred. No emulator failure or justified
source/test repair boundary was identified. No source patch was made.

All **23 owner-pinned sizes/SHA-256 hashes**, including direct `sin.exe` and
the browser manifest, and all **21 manifest member sizes** match before and
after. Fresh public `DESKTOP_APPS` excludes SiN; it remains private/localOnly.
No archive/container download, guest-state/config/cvar/save/clock/asset patch
or registration change occurred. **528 source files, 867 compiler files,
43 fixture/shared runtime inputs and the module** match before/after.
All **186 served records** match pinned bytes and disk readback; all **188
HTTP responses** carried isolation headers, with 182 successful hash joins
and six ancillary 404s. All **23 native events** were trusted: **10 balanced
key pairs**, one launch mouse pair and one mouse move. No forward, jump or
guest mouse attack was sent. Audio listening and FPS remain unqualified.

Independent cleanup at **20:17:20 UTC** found all **21 recorded runtime
PID/start identities** absent, actual Chrome/global crashpad/profile empty,
ports **46445/41171 closed**, profile removed, held inputs empty and FD9 lock
free. The durable runtime parent reaped controller/monitor normally with no
cleanup signals. Build and preparation-watcher identities were also absent.
Some tool command/watcher sessions returned 143; the controller independently
recorded completion of their observations and normal quit. This is a helper
lifecycle limitation, not evidence of an emulator failure. Minimum monitored
runtime free disk was **3,520,258,048 bytes**. No foreign process was signalled.
Boat ID/state/expiry: **N/A**, local correctness; no deployment.

Evidence in the ignored run includes `old-to-current-drift.json`,
`prebuild-current-inputs.json`, `build.log`, `build-wait.json`,
`reviewed-scenes.json`, `verification-summary.json`, before/after identity and
fixture checks, trusted input/HTTP records and `full-release-final.json`.
Next boundary is confirmed targeted enemy damage or native objective progress;
if investigating restart specifically, close the recorded capture gap and
identify its native transition before proposing an emulator repair.
