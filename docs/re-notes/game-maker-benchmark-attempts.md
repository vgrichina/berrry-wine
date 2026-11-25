# Game Maker 5–7 benchmark attempts (2026-11-24)

Three archive.org Game Maker games were tried as interpreter benchmarks. Metrojd GM7 now
plays and is registered (local-only `metrojd_gm7`). The other two remain blocked, and their
downloads were removed; each item can be refetched by its identifier.

| Game | archive.org item / file (SHA-1) | Runner | Blocker |
|---|---|---|---|
| Garden Gnome Carnage (Remar, 2007) | `Garden_Gnome_Carnage` / `ggc.exe` (27b763d719c06c06a3a5dacc8b8e9878f630307e) | GM6/7, D3D8, packed | The packer stub at `0x5f16ec` walks down from its return address in 64 KB steps looking for `MZ` (kernel32 base hunt). No PE header is found below the thunk zone, the scan wraps to `0x80ff0000` and faults with `ESHAREDHEAP_ACCESS` at batch 72. Needs the entry return address inside a mapped kernel32 image. |
| Metrojd (Remar) | `Metrojd` / `Metrojd.zip` | `metrojd.exe` GM5 (DirectDraw) and `metrojd_gm7.exe` GM7 | GM5: the runner reads the whole exe (`ReadFile` 0x2bc763 bytes), extracts WAVs to `C:\WINDOWS\TEMP\gm_ttt_*`, then raises Delphi `EReadError` "Stream read error" and shows "Unexpected error occured when running the game." at batch ~38000. GM7: was `UNIMPLEMENTED API: DirectMusic segment from RIFF WAVE` at batch 48210; **fixed, plays — see "Metrojd GM7 plays" below**. |
| Seven Minutes (Tuukka Virtanen, 2008) | `7_Minutes_game` / `SevenMinutes.zip` | GM7 | Loading bar at ~30% after 100000 default batches; with any batch size it reaches runtime-generated code at `0x0c3f0e..`, ESP goes odd (`0x074ff725`) and `$th_pop_run` hits `unreachable` (batch 1137 at 100k blocks, 10926 at 10k, 36297 at 3k). GM7's code-protection layer; not a trivial fix. |

GM6–8 normal sounds load through DirectMusic as RIFF WAVE segments. Until 2026-11-24 every
GM6–8 game with sound effects stopped there; Spelunky Classic avoided it only because its audio
goes through `supersound.dll`.

## Metrojd GM7 plays (2026-11-24)

DirectMusic WAVE segments landed in `src/09a7m-directmusic.wat`, together with the
audiopath's `IDirectSoundBuffer8` (`GetObjectInPath`, DX type 66, `IDirectMusicPathBuffer8_*`
rows), so `metrojd_gm7.exe` is now registered as the local-only app `metrojd_gm7`
(files: `test/binaries/candidates/metrojd/`, hashes in `test/binaries/SOURCES.md`).
The GM5 build `metrojd.exe` is still blocked as in the table above.

Route (headless, needs `--headless-gl`; without it `IDirect3D8_CreateDevice` is
`D3DERR_NOTAVAILABLE` because no D3D executor exists, and the runner shows "Failed to
initialize drawing surfaces"):

```
node test/run.js --app=metrojd_gm7 --headless-gl --stuck-after=0 --quiet-api \
  --max-batches=70000 --no-close --png=out.png \
  --input=62000:keydown:39,64000:keyup:39,68500:keydown:38,69500:keyup:38
```

The first room is up by batch ~60000 (~25 s wall). Arrows move, up jumps (readme:
left/right run, hold up to jump, Esc quits). Running and jumping trigger `PlaySegmentEx`
SECONDARY on the sound's own audiopath (three plays in that route). Each play reaches the host as
`voice_open(22050, 1, 16)`, then volume, pan and `voice_play_ring`, and ends with
`voice_stop`/`voice_close` at the guest-clock deadline.

### GM7 sound unit (metrojd_gm7.exe)

- Globals: performance `[0x5878ac]`, loader `[0x5878b0]`. Sound table at `[0x58bea0]`,
  20 bytes per sound: +0 used, +4 kind (0 normal, 1 background, 2 3D, 3 multimedia),
  +8 segment, +0xc audiopath, +0x10 name.
- Load: one `CreateStandardAudioPath(DMUS_APATH_DYNAMIC_STEREO, or DYNAMIC_3D for kind 2,
  64, TRUE)` per sound. Then Loader `GetObject` (desc 0x402 CLASS|MEMORY, dwSize 0x350) or
  `LoadObjectFromFile` (+0x38, after `SetSearchDirectory` +0x14), `SetParam(GUID at
  [0x589a80])`, then `Download(perf)`.
- Play: `SetRepeats(loop ? -1 : 0)` and `PlaySegmentEx(seg, 0, 0, 0x4000` (background)
  or `0x80` (secondary)`, 0, 0, &state, 0, path)`; the state is released at once.
  Stop is `StopEx(seg, 0, 0, 0)`, the playing check `IsPlaying(seg, 0)`, volume
  AudioPath `SetVolume` (+0x14). Master volume and tempo go through `SetGlobalParam`.
- Pan, `0x48a26b`: `GetObjectInPath(DMUS_PCHANNEL_ALL, DMUS_PATH_BUFFER, 0,
  GUID_All_Objects, 0, IID_IDirectSoundBuffer8 @0x48a318)`, then `SetPan` (+0x40) and
  `Release`. Every sound runs it once at load with pan 0.
- Not reached yet (all fail-fast):
  - `0x48a32c` calls `SetFX` (+0x54);
  - the 3D functions use the IDirectSound3DBuffer `SetPosition` +0x4c, `SetVelocity` +0x50,
    `SetMinDistance` +0x44 and `SetMaxDistance` +0x40;
  - `GetObjectInPath` for any interface other than IDirectSoundBuffer/8.

### Is it interpreter-bound? Not by a dispatch loop

Measured with `--handler-hist --handler-hist-thread=0 --handler-hist-start=62000
--handler-hist-stop=70000`, with arrow/jump input in the room. The window holds 3.59M
block entries and 11.8M ops (3.28 ops per block). The JSON keeps the top 400 blocks, which
cover 97.1% of entries, and **every one of them is in the exe** (the Delphi runner); no DLL
block made the list.

`tools/hot-loop-census.js` regions:

| Region | Share | What it is |
|---|---|---|
| `0x405988..0x405dd1` | 15.4% | Delphi RTL record finalize/copy. `0x405a58` walks a type-info field table, calling `0x405aa4` per field (GML value records). |
| `0x4aec28..0x4aec61` | 13.4% | Bounds-checked list getters. `0x4aec50` is "instance by index" (`[eax+edx*4+0x20]`, 0..7 guard at `0x4aec28`). |
| `0x54076e..0x5409b4` | 6.7% | Per-instance step prologue: copies x/y to xprevious/yprevious (+0x58..0x64 → +0x78..0x84) for every instance. |
| `0x4d7d94..0x4d7dcc` | 6.4% | Collision scan over all instances (solid flag +0xd1, test `0x4ae7c4`). |
| `0x4c07a7..0x4c0869` | 5.1% | Per-instance event code (x87 math, `0x4b198c` event-exists test). |
| `0x52b3d4..0x52b864` | 5.0% | SEH-framed GML value/expression helper (type tag 8 check at `0x52b403`). |

GM7 has no bytecode dispatch loop: GML runs as a tree walk spread over many Delphi
functions. Its time goes to per-instance engine loops and RTL value-record management,
not to one hot `jmp [table+reg*4]`. It is a benchmark for call/return-heavy Delphi
code (the uop icall/ret path), not for an interpreter fold. Evidence:
`scratch/runs/20261124-dmusic-wave/` (`hist-62000-70000.json`, `hot-loop-census.txt`,
`disasm-hot.txt`, `run6.log`).

### Room size and Present (448x448 room, 640x480 window)

`metrojd_gm7.exe` creates its D3D8 device windowed (`0x4a3a7b`): back buffer = the
desktop mode (640x480), SwapEffect COPY, `hDeviceWindow` 0 (focus window, the 640x480
`TRunnerForm` 0x10019). The room is 448x448: `0x4a3f80` stores the view size in
`[0x587a68]`/`[0x587a6c]` and sets a 448x448 viewport. Each frame `0x4a42d4` presents
source `(0,0,[0x587a68],[0x587a6c])` onto a destination from `0x49d47c`, which
aspect-fits the room into the client when the scale double `[0x587a04]` is negative
(-0.01 here): `(80,0,560,480)`. Read with `--break=0x4a437a` (the instruction after the
Present call): the rects sit at ESP+0x10 and ESP+0x20.

The live window was already right: the ring stretches the source onto the
destination (`$d9g_present`). Only the CLI `--png` was wrong. It showed the room in the
top-left 448x448 and the rest black. `d3d9_gps_sync_front` read the back buffer back and
re-presented it whole at 0,0, and the capture then picked that raw back-buffer DIB.
Fixed 2026-11-24: `$d9g_present` records whether a Present was *placed* (source
sub-rect, destination offset or stretch; `d9g_mem+2956`, export
`d3d9_gps_present_placed`). A placed capture leaves the ring frame on the window
(stat 70), and `test/run.js` then captures the screen instead of a DX slot. Test:
case 5 of `test/test-d3d9-gps-present-stretch.js`. Evidence:
`scratch/runs/20261124-metrojd-width/` (`before.png` raw DIB, `before-canvas.png`
raw buffer laid over the left 80 px, `before-mid.png` the live window, `after.png`).

## More GM5/GM7 runners for the Delphi arm D corpus (2026-11-25)

Every Game Maker 5.3A and 7 runner links the Delphi 6-7 System unit, so all five
fold-bench arm D helpers (`_LStrClr`, `_LStrAsg`, `_FinalizeRecord`,
`_FinalizeArray`, `_CopyRecord`) match their signatures exactly
(`node tools/delphi-detect.js PATH`). The added samples, with provenance in
`test/binaries/SOURCES.md` under "Delphi corpus": Remar's Castle of Elite,
Herocore, Hero and Retrobattle, each in GM5 and GM7; Seiklus 1.7; and Robo-Logan
Quick Draw (GM7, CC0). Run them with every file in the game directory mounted
(`--vfs-include=*`, or `--app=` for the registered GM5 ids), because the runners
load fmod/jbfmod or Audiere with LoadLibrary.

- GM5 (`castle_gm5`, `herocore_gm5`, `hero_gm5`, `retrobattle_gm5`, `seiklus`)
  reaches its window and loading screen. The runner then shows "Unexpected error
  occured when running the game", which is open.
- GM7 Remar games crash between batch 26K and 73K. Herocore's crash is a
  `jmp [0x5fa3f4]` (the `GlobalFree` IAT slot) that lands in heap data. Not
  investigated.
- Robo-Logan stops on `UNIMPLEMENTED API: <ord>` at batch 22049 (EIP 0x489865, a
  COM vtable call).
- With `--branch-clock` at 20000 batches, arm D on and off produce identical API
  counts and end frames for all nine GM samples. Arm D's native-call count ranges
  from 6.8K to 20.6K. `_CopyRecord` is 0 native in every one of these runs,
  against 286 in Spelunky (GM8). The cause is not investigated. Evidence:
  `scratch/runs/20261125-delphi-corpus/`.
