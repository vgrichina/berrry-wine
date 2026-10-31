# SiN Demo (Ritual Entertainment / Activision, 1998)

App `sin_demo` (candidate `sin-demo`, localOnly), "OS Rev 0.93 Demo".
Registered ff0c51dde. Quake II engine: `sin.exe` imports only system DLLs;
`ref_gl.dll`/`ref_soft.dll` and `base/gamex86.dll` load at runtime, data in
`base/pak0.pak`.

## Source and licence

archive.org `swizzle_demu_Sin`, `Sin.exe` (35471872 bytes, SHA-1
`81a61458…`): a WinZip self-extractor whose `data\` folder is a ready
install (the setup.exe beside it is not needed). The P-Z collection item also
has `SinDemo-OpenGL-SW.exe`; not used. `readme.htm`/`readme.doc` contain no
licence or redistribution terms, only a 1998 contest, so it is a localOnly
"no stated terms" fixture like forsaken-demo.

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

Next boundary: obtain the exact SHA-1-pinned original in a newly authorized
bounded acquisition, review its complete README/licence set, compare all
installed members, then pass the current lifecycle/process gate before the
native HARDCORPS → GAME → HQ/lift/helipad/flyover → settled rooftop route.
Boat ID/state/expiry: N/A (local preflight only).
