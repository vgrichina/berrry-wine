# Quake III demo: current native arena, 2026-11-12

Evidence run: `scratch/runs/20261112-quake3-current-native-arena-0204/`.
This checkpoint uses the registered original `quake3_demo`, native single-player
menus, unchanged default skill and media, and actual guest/render Workers.
It does not measure FPS, establish visual parity or audio, or close the full
GLD3D-CORPUS-27 scope.

The [native Major encounter follow-up](quake3-native-major-encounter-20261112.md)
adds reviewed visible opponents, pointer-lock aim/fire attempts and explicit
player deaths to Major on both backends. Outgoing damage and a player frag
remain unverified.

## Identity and route

The served closure is pinned by `runtime-pins.json` and `runtime-pins-v2.json`
against main `cb3d8d7ab455068ac510756c291ea4ee0cf43baa`, including the
`199cf5b4e` optional broker-hook repair. Git and relevant binary diffs provide
the source recovery record; no source or repeated media archives were made.
The canonical locked build passed. The actual standard module, recovered from
CDP WebAssembly bytecode in the page, guest Worker, and render Worker, is
2,189,682 bytes, SHA-256
`1165f15cb29fa4ff4b67621f3ce66f8df68fb50baea929d0b76e9b2f66118135`.

The original registered pak0 is 46,853,694 bytes, SHA-256
`e77abad2466f45a0a7ea018445528f9b95a0fe7789fa1abc1a7718bbf0754b08`.
Exact executable, seed, DLL and media paths/hashes are in the pin manifest.
No guest code was skipped and no memory, media or configuration patches were
applied. Engine-created configuration was only inspected.

On a fresh native menu: Enter selects Single Player; Up focuses Fight on the
Q3DM1 Arena Gate level screen; Enter opens Difficulty; Enter starts Fight with
Bring It On selected. Allow the original local server and game media to load
for several minutes. A connection screen alone is not evidence of failure.
The software exploration also preserved unproductive menu inputs, including
returning through Back; the final route above avoids those inputs.

Each input admission follows a separately retrieved, checksum-verified,
completed full image and an explicit visual review. Trusted CDP key and mouse
pulses have an independent prearmed release, and are tied to the same process,
guest module, canvas, renderer endpoint/context and Worker epoch.

## Software arena

The `software-arena` case reached the original textured Arena Gate courtyard,
with sky, statues, machinegun and live HUD. Reviewed `arena-current.png` is
followed by balanced W input and `moved-forward.png`, showing the camera
closer to the statue pedestal. Balanced native left mouse input produced
`fired-machinegun.png`: ammunition fell from 100 to 98 and the weapon pose
changed. The after-release image does not claim a captured muzzle flash.

The owning GL endpoint is explicitly software, with completed native software
draws/presents joined to its legacy display transport. The shell canvas and
legacy endpoint's default WebGL label do not identify this scene's producer.
The released input state has buttons zero and an empty queue. Chrome and its
runtime parent both returned zero with separate stdout/stderr EOF records.

## Preserved failures and limits

The first attempts preserved a missing run metadata file, a missing transitive
driver helper, and an interrupted upload authorization. These happened before
native game input. Their closure and provider records remain in the run.

The first WebGL browser reached the native level menu, then a
`Page.captureScreenshot` request remained pending until the command deadline.
Its failure, pending-CDP trace, parent status and EOF were retained. This does
not establish a guest startup, renderer or input defect. The run-local capture
helper now uses the supported `fromSurface:false` viewport capture option.
That harness adjustment changes neither the production runtime nor game
semantics. A stale-scene input was refused before dispatch in the later WebGL
run; it was refreshed and reviewed before any replacement input.

A read-only configuration probe attempted an unopened asynchronous VFS entry
and failed; the narrowed probe succeeded without native input or guest writes.
No production defect has been demonstrated or speculative source fix made.

## WebGL arena and validation

The `webgl-viewport` case followed the native route and reached the same
textured Arena Gate courtyard, reviewed as `game-media.png`. Balanced W
input led to `moved-forward.png`, with the camera beside the right statue
pedestal and closer to the central arch. Native left mouse input led to
`fired-machinegun.png`, with ammo falling from 100 to 96. The next released
world still shows ammo 96, active Major and changing health.

The owning renderer Worker reports WebGL 1.0 through ANGLE, Intel Mesa UHD
Graphics 620. Its joined producer has positive completed WebGL draws,
vertices, presents and display write sequence; software-front execution is
zero. Across the arena/movement/fire/released captures, software presents
advance 2082→2111→2137→2165 and WebGL presents 1517→1570→1625→1647.
These counters establish producer continuity and progress, not measured FPS.
Endpoint, context, Worker, module and epoch identities remain stable.

The canonical locked build and six focused native-input regressions passed.
`verify-evidence.py` rehashed all 478 retrieved records after two independent
remote GETs, checked 57 PNGs, matched served full/ranged bytes to the closure,
verified actual module identities and producer progress, and checked balanced
input pulses, empty released queues, and Chrome/runtime parent zero exits with
separate EOF. The failed observations remain beside the successful cases.

The independently watched private box `bx_572gh2kw` was stopped normally at
2026-11-12 02:42:06Z, before its initial 03:05:24.757Z expiry. Its final state
is archived with expiry cleared; stop receipt
`stop_44661c1b7400e307` is completed, error null, forced false. The durable
lifecycle command and both watchdog wait/EOF records returned zero. The local
transport wrapper was observed as exit 143 and is retained explicitly; it is
not substituted for the durable actual parent records.

The original native arena, player displacement and firing checkpoint is
complete on both current backends. Further work can measure gameplay FPS,
compare rendering and validate audio; the full 27-candidate scope remains open.
