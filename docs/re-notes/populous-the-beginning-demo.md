# Populous: The Beginning demo (Bullfrog, 1998)

`lib/apps.js` id **`populous_tb_demo`** (localhost-only), exe
`test/binaries/candidates/populous-the-beginning-demo/extracted/popTBDemo.exe`
(software renderer, DirectDraw 640x480x8, `imageBase` 0x400000) with the bundled
`WEANETR.dll` (Bullfrog's MLDPlay network layer, origBase 0x10000000) and
`QMixer.dll` (QSound mixer, origBase 0x18000000) as app DLLs. `SFMAN32.DLL`
(SoundFont manager) is only reached through LoadLibrary and comes from the VFS.
Source: archive.org item `POPULOUS` (`POPULOUS.EXE`, WinZip SFX, md5
5328fd544622c74cc649114dd9e1fe2c). Fetch/prepare:
`node tools/fetch-candidate-corpus.js --id=populous-the-beginning-demo [--prepare]`.
The SFX holds the InstallShield 5 setup *beside* the uncompressed game tree,
so the game runs from `extracted/` without running setup. `D3DPopTBDemo.exe`
(the hardware renderer) and `DemoHW_SW_Select.exe` (the chooser) are untested.

## Registry

`popTBDemo.exe+0x41f416` reads `HKLM\SOFTWARE\Bullfrog Productions Ltd\Populous:
The Beginning (Demo)`: `InstallDrive` (only the first letter is kept, upper-cased,
at `0x7afecf`) and `InstallDirectory` (a leading `\` or `/` is stripped, at
`0x7afed0`). Missing either -> "Missing or incomplete Registry information".
`startupRegistry` sets `C:` and `\`, i.e. the game tree is `C:\`.

## Route to gameplay

```sh
node test/run.js --app=populous_tb_demo --quiet-api --control=8187 --frozen --tick-ms-per-batch=20 \
  --max-seconds=900 --max-batches=100000000
node tools/ctl.js -s :8187 step 16600            # main menu from ~15000
node tools/ctl.js -s :8187 cmd relmousemove:-2000:-2000
node tools/ctl.js -s :8187 cmd relmousemove:320:142   # game cursor onto NEW GAME
node tools/ctl.js -s :8187 cmd di-mousedown; ... step 300; ... cmd di-mouseup
```

then NO on the tutorial prompt (+0,+241), a click on the "Journey Begins"
briefing, ~60000 batches of level flyby (one OK on "I have created my
reincarnation site"), and the player has control. Evidence:
`scratch/runs/20261006T1210Z-populous_tb_demo-gameplay-w6`.

- **Input is DirectInput only, on two guest threads.** The window procedure
  (`0x4f6430` -> handler `0x49a360`) passes every mouse/keyboard message to
  DefWindowProc. Threads `0x4fb600` (keyboard) and `0x4fb9e0` (mouse) call
  `SetCooperativeLevel(NULL, DISCL_NONEXCLUSIVE|DISCL_BACKGROUND)`,
  `SetEventNotification`, then loop on `WaitForSingleObject(event, 200)` +
  `GetDeviceData(10 records)`. The mouse object is the thread parameter
  (`0x91f754` in this build); the game cursor is at `+0x20/+0x24`, starts at
  (320,240) and is clamped to the screen, so `relmousemove:-2000:-2000` parks
  it at (0,0).
- **Menu buttons need a held press** (`di-mousedown`, step ~300, `di-mouseup`):
  a down/up pair inside one game frame is not seen. In the world a long hold is
  a drag-select, so use a short press there (~25 batches).
- Camera: `keydown:37` (renderer keydown, which also feeds DI) rotates the
  world; a bare `di-keydown` did not.
- Idle at the main menu for ~2000 batches at 20 ms/batch and the game starts
  its ROLLING DEMO (loading screen, then an attract-mode level with no HUD).

## Emulator fixes this game needed (2026-10-06)

- `timeGetSystemTime` (WINMM) was unimplemented.
- **Unicode DirectPlay.** `weanetr.dll`'s `MLDPlay::AreWeLobbied`
  (`weanetr+0x10010800`) creates `CLSID_DirectPlayLobby` as
  `IID_IDirectPlayLobby3` (W, `2DB72490`, not 3A `2DB72491`) and
  `CLSID_DirectPlay` as `IID_IDirectPlay3` (W, `133EFE40`). When that failed
  the provider returned 0 instead of 0x20 ("not lobbied"), and the exe
  (`0x4cd16b`: `cmp eax, 0x20`) opened the multiplayer "CONNECTED" lobby
  screen instead of the main menu. IDirectPlay2/3 (W) now return the
  IDirectPlay4W wrapper; IDirectPlayLobby/2/3 (W) get the `IDirectPlayLobby3W`
  vtable (test: `test/test-directplay-unicode-lobby.js`).
- **DirectInput cooperative level with a NULL HWND.**
  `SetCooperativeLevel(NULL, NONEXCLUSIVE|BACKGROUND)` binds the desktop on real
  DirectInput (and in Wine); we returned E_HANDLE, so both input threads never
  acquired and `GetDeviceData` returned DIERR_NOTACQUIRED forever (no cursor,
  no clicks, no keys). Test: `test/test-directinput-device.js`.

## Known gaps

- A stale game-cursor sprite stays at (0,0) on the menu after the large park move.
- Not yet checked: browser, audio (QMixer/DirectSound), the D3D renderer, a
  full level.

## Ordinary shaman movement verified (2026-11-01)

Run `scratch/runs/20261101-populous-original-unit-control/` establishes
ordinary input-caused unit displacement, beyond the earlier mission/camera
evidence. One local original execution exited 0 after 387.674 seconds. No
download, installer, EULA replay, guest modification, or registration change.
The October run referenced above is absent from this checkout; no retained
accepted displacement result was found to reuse.

The Homeworld predecessor's fresh worker `final.txt`/`result.json` and explicit
08:33:09 UTC runtime/source/build release were both present before runtime
ownership began at 08:33:34. Actual main was
`f62e481bc9b213db9d83f1f1764266bd0bc570a3`. The accepted locked build from
`d86935e8274cd5d70a53bcc50c5d8bf5632d95c3` was reused: all 4,392 accepted
inputs and 141 prior actual reads matched. The actual loaded 2,026,995-byte
production module was SHA-256
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
Before/after checks matched 4,444 current source/build pins, 386 original-file
and manifest pins (384 manifest entries), and all 220 actual runtime reads,
including 101 original-file reads. The copied read-only identity observer
passed actual sync/async execution, whole shared 512 MB unchanged, native and
host clock identity, and emitted late-event 10,001 checks.

Command: `node --require <run>/observe.cjs test/run.js --app=populous_tb_demo
--no-build --wasm=build/wine-assembly.wasm --quiet-api --quiet-blocks
--tick-ms-per-batch=20 --max-seconds=1200 --max-batches=200000
--control-stdin --frozen --no-close --trace-input-dispatch --png=<run>/final.png`.
Registered originals/defaults, cooperative threads, native CLI, 640x480
software capture; no batch-size override. Full commands and replies are in
`command.json`, `controls.ndjson`, and `manual-controls.ndjson`.

Reviewed route: menu at batch 14,000; New Game held click 16,450–16,750;
NO tutorial 16,900–17,200; Journey Begins 17,400–17,700; actual flyby at
24,700; reincarnation-site prompt at 54,700; OK 64,750–65,050; mission with
no FLYBY MODE label at 121,050. Inspect captures rather than assuming these
timings. A park and positive relative move queued together initially left the
cursor at the corner; a separate relative move and held menu click worked.

The installed `Guide.txt` specifies left-click to select, left-click on the
landscape to move, and right-click to deselect. Earlier world clicks produced
selection changes without the intended shaman displacement, so they are not
the accepted movement evidence. After clearing selection with an ordinary
right-click, the accepted sequence was:

- Hover the central shaman at game cursor (371,218), then left down/up at
  133,575/133,600 (25 batches). `shaman-selected.png` at 134,600 shows the
  gold selection marker and one-unit cursor indicator.
- Move the cursor by (-40,+84) to (331,302), without camera keys or scrolling.
  `shaman-destination-before.png` at 135,100 retains the shaman in the stone
  circle, feet approximately (371,234).
- Left down/up at 135,100/135,125. Read-only DirectInput ring snapshots show
  selection head/tail 41→43, cursor movement 43→45, and destination events
  45→47; retained destination words are `0x10293ab0`/`0x20293ca4`. Pending
  events are zero afterward. Schedule/MSG observations alone are not treated
  as DirectInput consumption proof.
- Reviewed intermediate captures at 136,125, 138,125 and 141,125 show the
  same selected blue shaman walking toward the foreground, approximately
  (354,254) and then (342,280). Arrival at 144,125 and settled at 147,125
  place her at approximately (332,305), beside the requested point.

`landmarks.json` compares the before/intermediate/arrival/settled images:
tree canopy `[428,328,482,363)`, hut roof `[280,392,310,415)`, and terrain
`[110,265,175,305)` each have **zero changed pixels** throughout. Stone
patches have small animation differences, retained explicitly; other followers,
smoke, water, selection markers and tooltips also animate. The fixed landmarks
and moving selected shaman establish unit movement, not camera displacement.

`verification.json`, `input-consumption.json`, `review.json`, original/source
pins, gzip runtime log, captures, and normal exit record retain the evidence.
Startup free disk was 2,349,559,808 bytes; observed minimum 2,287,992,832.
Own runtime/driver/observer/watcher PIDs, process group and new temporary
directories were absent after cleanup. Box ID/state/expiry: N/A. No claim
about audio, FPS, browser/GPU rendering, mission completion, or full playability.
