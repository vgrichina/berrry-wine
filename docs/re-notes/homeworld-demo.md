# Homeworld demo

Relic's 1999 3D space RTS, the downloadable demo ("Homeworld Downloadable
Version", menu shows `Version DLD_05.1`). Registered as `homeworld_demo`.

## Payload and licence

`test/candidate-corpus/manifest.json`, id `homeworld-demo`: archive.org
`HomeworldDemo/HWDemo.exe` (65.7 MB, SHA-1 `27fd4faf...`), a **Wise**
installer (`WiseMain` in its strings; 7z cannot open it). The tree comes from
running that installer in the emulator, `tools/install-homeworld-demo.js`
(fetcher step `installHomeworldDemo`): Welcome, licence, destination
(`C:\Sierra\Homeworld Downloadable`), program group, start -- Next is at
(366,382) on every page at `--batch-size=10000` from about batch 2050, and the
copy is done by about batch 3500. It installs 16 entries, 75 MB:
`homeworld.exe`, `homeworlddl.big`, `dl_music.wxd`, `dl_demo.vce`, the
renderers `rgl.dll` / `rglsw.dll` / `rgld3d.dll` / `3dfx\`, `binkw32.dll`,
`movies\`.

Licence: Sierra's demo EULA (`eula.txt`) -- one copy for personal use, no
copying or reproduction, **no reverse engineering or disassembly**. Kept
`localOnly`; investigate with API traces only.

## Launch: the "insert CD" box is a working-directory problem

`Invalid or missing Homeworld CD. Please insert valid CD.` means the game did
not find `DL_Music.wxd`. It looks in the working directory first
(`FindFirstFileA("DL_Music.wxd")`), then on `D:\`. With `--vfs-tree` the tree
is mounted at `C:\`, so the CLI needs `--exe-guest-path=C:\homeworld.exe
--cwd=C:\`; a cwd of `C:\Sierra\Homeworld Downloadable` reproduces the box.

## Route to gameplay (CLI, `--batch-size=100000`)

| Batch | Action | Screen |
|---|---|---|
| ~1400 | | main menu (Training / Single Player / ...) |
| 1000 | click (320,221) Single Player | fleet picker (Kushan / Taiidan) |
| 1300 | click (554,448) START! | "Training alert" |
| 1600 | click (322,267) START! | mission load screen, progress bar |
| ~4000 | | bar full |
| 4600 | | in-engine intro: the Mothership in its shipyard |
| 4710 | Esc | intro skipped |
| 5600 | | Kharak, the fleet, HUD "MOTHERSHIP" |
| 5700 | click (320,240) | "1 x MOTHERSHIP" selected |

Evidence: `scratch/runs/20261011T1810Z-homeworld-demo-w6` (game6-s4600, game7-*).

## Renderer

The registry has no renderer choice yet, and the game starts on its software
renderer `rglsw.dll` (loaded through `rgl.dll`), 640x480.

## Ordinary Scout movement verified (2026-11-01)

Run `scratch/runs/20261101-homeworld-original-fleet-control/` establishes
movement control beyond the earlier Mothership selection. The historical
`20261011T1810Z-homeworld-demo-w6` directory was absent; no retained accepted
movement result was found to reuse. The fresh run used the existing registered
`homeworld_demo`, original installed files and defaults, with native CLI only.
No installer, download, EULA replay, guest disassembly or game-state probe was
used. The installed quick-reference card documents **M**, then left-clicking
the movement disk, as the ordinary horizontal movement order.

After the DarkReign worker's fresh final/result and explicit runtime/source/build
release, actual main was pinned at `3e2c521ff7c02e4a8e0e5d077b2e4a041c38153a`.
The accepted locked build from `d86935e8274cd5d70a53bcc50c5d8bf5632d95c3`
was reused only after all 4,392 accepted inputs and 141 prior reads matched.
Actual runtime compilation loaded WASM SHA-256
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`;
all 129 observed file reads matched their retained identities. Before/after
checks matched 4,444 source/module inputs and 17 installed-file/manifest pins.
The executable SHA-256 was
`84b4f03bdb06a6639f26ae527084754b1aec2aa0b6d93b283863d87c6bb55796`.
The observer passed actual sync/async execution, whole-512-MB read-only and
clock-identity checks, including emitted late-event retention after 10,001
events. It observes file/module identity, not game memory.

Use `node --require <run>/observe.cjs test/run.js --app=homeworld_demo
--no-build --wasm=build/wine-assembly.wasm --quiet-api --quiet-blocks
--batch-size=100000 --control-stdin --frozen --no-close
--trace-input-dispatch --max-seconds=1200 --max-batches=10000`;
`command.json` preserves the exact invocation and output path. Batch numbers
below identify capture/input boundaries, not frame rate or real-time speed.

| Batch | Ordinary input / reviewed capture |
|---|---|
| 1400 | Main menu; Single Player at (320,221), down/up 1400/1410 |
| 1510 | Default Kushan selected; START (554,448), down/up 1510/1520 |
| 1620 | Training alert; START (322,267), down/up 1620/1630 |
| 2630 / 4630 | Loading / in-engine intro; Escape down/up 4630/4640, dispatched 4634/4655 |
| 5540 / 5640 | Mission before / neutral comparison: fleet beside Kharak |
| 5640 / 5650 | Click Scout at (260,207), down/up dispatched 5643/5652 |
| 5680 | `ship-selected.png`: **7 x SCOUT**, seven health bars |
| 5680 / 5690 | M down/up, dispatched 5682/5691 |
| 5710 / 5720 | Movement disk, then pointer at (450,350); `order-before.png` |
| 5720 / 5730 | Destination down/up at (450,350), dispatched 5722/5731 |
| 5750 / 5850 | `order-after-20.png` / `order-after-120.png`: turning, trails, displacement |
| 6150 / 6300 | Later / settled captures: Scouts remain in their new formation |

The reviewed sequence shows input-caused ship displacement. Before the order,
the upper Scout's health bar spans x=253–273 at y=195–196; after movement it
spans x=331–355 at y=218–219 (batch 5850). The group changes orientation and
position relative to Kharak's disk, moving from its left side to its lower/right
area. Later captures preserve the new arrangement. The neutral comparison
shows small ambient changes, and background patches are **not pixel-identical**;
the conclusion uses relative ship/planet positions, turning and trails, not a
claim of perfectly static camera pixels. No camera-control input was issued
during the movement comparison. The `7 x SCOUT` label persists after the order.
Input dequeue and DispatchMessage traces support delivery; matching tuples are
not treated as unique schedule-to-dispatch correlation IDs.

One original execution ran 256.983 seconds and exited 0 after an explicit CLI
quit. Startup free disk was 2,357,993,472 bytes; observed minimum was
2,300,223,488 bytes. Own runtime/driver/observer/watchers, runtime group and new
temporary directories were checked absent. Box ID/state/expiry: N/A (local CLI).
`review.json`, `input-consumption.json`, `pixel-comparison.json`,
`verification.json`, `exit.json`, `final.txt` and `result.json` retain the
bounded evidence. This establishes ordinary Scout selection and movement;
it makes no mission-completion, audio, FPS or broad-playability claim.
