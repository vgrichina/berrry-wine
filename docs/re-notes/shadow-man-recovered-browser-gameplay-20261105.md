# Shadow Man recovered browser gameplay

One ordinary original browser session reached the German main menu and rendered
player-controlled gameplay. Personally reviewed screenshots show forward movement
after Up and changed facing/camera angle after Right. Trusted browser key presses
and releases have matching guest key messages. No emulator repair was needed.

Lords1635 released at 16:55:00 UTC, then Aranna1710 at 17:03:28 UTC. Independent
checks found 294 recorded PIDs absent, 115 ports refused, 25 profiles absent,
four locks free, no heavy processes, and sufficient disk before execution.

Evidence: `scratch/runs/20261105-shadow-man-recovered-browser-gameplay/`.
A fresh local read verified all 2046 recovered members, 177700067 bytes, against
`scratch/runs/20261105-shadow-man-browser-gameplay/required-input-recovery.json`.
The canonical media remains at
`scratch/game-media/shadow-man-installed-20261105/`; no media was copied.

The original `parent-vfs/` paths map to `C:\`, preserving all 2045 unique guest
file names. The original registry has 74 entries. The genuine retained 50-byte
configuration is referenced from the preceding run and mounted at the original
installed `grafix.cfg` path; SHA-256 is
`0407969d4bf39f2287f8d99bd37feac1212e6492f41038a817f77f39ef79d42d`.
The documented browser harness registration seam supplies the installed launcher
path and working directory, original registry, and original Miles DLL seed.
No persistent app or corpus entry is needed for this local qualification.

Original launcher SHA-256:
`850c69cfa4a0d610072a67763d54179bc4cdc58875560ce5ede33bfa44d19fe0`.
Original game SHA-256:
`4b32868bb30a8ca089483203f8c2b637507f12de4f11f39bf45b1fa41d5f5772`.
The accepted CLI result at `debc24bfc46a9d1882b29be1b6e563816ac79498`
already establishes enabled Play and movement; that investigation is not repeated.

## Browser route and reviewed response

The caller started at 2026-11-05T17:05:21.061Z with a nine-minute outer bound.
Chrome 151.0.7922.108 ran the ordinary local `index.html?debug&eager-files`
browser shell at 1000 x 800 with guest threads in Workers and the harness's
SwiftShader/WebGL option. This is a local browser result, without physical GPU,
native Windows, audio, FPS, long-session, save/load, or normal game-exit claims.

Source commit was `c2f7658a527c22fbdee6f7cb0e44e2fb2592271a` at launch; the
authoritative full SHA and tracked runtime file hashes are in `source-before.json`.
The relevant tracked binary diff is empty. The pre-existing untracked
`lib/wininit-boot.js` is retained as a new-file patch, not a source archive.
Both launcher and child module observations identify 2173299 bytes, SHA-256
`10462bd9693cf4f51d382d33767674b736b84e74346f328306d59e35c5e60031`.

The first screenshot shows the original enabled Spielen control. Its measured
canvas rectangle was page (10,160), 660 x 602; the ordinary click at page
(283,538) produced mouse down/up and the original installed child launch. The
launcher recorded ExitProcess(0). Acclaim artwork and the selected German
Neues Abenteuer menu were reviewed before Enter. Enter press/release reached
the rendered opening cinematic; Escape press/release preceded the level view.
No configuration dialog or disabled-Play investigation was repeated.

The idle comparison retains the same stationary scene, with only idle animation.
ArrowUp was pressed at 17:08:53.658Z and released at 17:08:56.362Z. Reviewed
held/released frames show the character and following camera advancing toward
the square stone pillar, then a standing pose at the advanced location.
ArrowRight was pressed at 17:09:17.011Z and released at 17:09:18.952Z. The
reviewed frames show changed facing and camera angle around the pillar, followed
by a settled standing view. The console records trusted browser events targeted
at `screen` and guest WM_KEYDOWN/WM_KEYUP for both keys (0x26 and 0x27).
Actual holds include screenshot/protocol overhead; queued wait lengths are not
presented as exact input durations.

All twelve screenshots were personally inspected. Individual review records
bind their hashes. In a fixed scene-only rectangle, the descriptive changed-pixel
fractions were 0.42% for idle, 25.62% after Up and 44.15% after Right. These
measurements support the visual review; they are not the acceptance criterion.
The final host VFS reread matches original launcher, game, Miles DLL and genuine
saved configuration hashes. All 74 original registry entries remained unchanged.

## Checks, limitations and cleanup

The shared launcher/game DLL graph check passed, including original Miles
328704 bytes, SHA-256
`09e2dec3d1e996571fb2c95e5de393410d486f1728c86473b550282edd83588c`.
All 2046 browser mounts passed length/hash and collision checks. The production
queued-input validator and helper syntax checks passed. The required
`flock /tmp/wine-build.lock bash tools/build.sh` passed before the browser run.
There was one browser launch and one original guest session, no retry or forced
guest state. No persistent app/corpus entry or shared production source changed;
this unregistered title's result stays in the investigation note and task record.

Incidental missing app-icon/favicon requests and background connection-refused
messages are retained in the console. They did not block the reviewed route;
their origin and audio/network effects were not qualified. No concrete emulator
or input defect was demonstrated, so no speculative repair or regression was added.

Supported queued quit completed the final readout and closed Chrome normally at
17:10:08.239Z (exit 0, no signal). The caller tool subsequently returned 143
without emitting its terminal/cleanup receipts. Its termination cause is
unproven and the missing receipts are explicitly preserved as unknown, rather
than described as normal caller shutdown. This happened after all input and
screenshots. No normal guest exit is claimed.

Independent cleanup confirms caller 3126765, probe 3126795, Chrome 3126807 and
owned watcher 3111476 absent; both ports 39101/46373 refuse connections, the
throwaway profile is absent, and all four runtime/build locks are free. Box
ID/state/expiry are N/A; coordinator lifecycle ownership remains unchanged.
No boxes, subworkers, deployment, platform flag, or held-lane retry occurred.

The note-only commit and immediate pinned-SSH publication are recorded in the run's
publication evidence. Next work, if assigned, can qualify longer gameplay,
audio, save/load, normal exit, or persistent corpus registration from this route.
