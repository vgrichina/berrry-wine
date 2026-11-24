# Spelunky Classic v1.1 (Derek Yu, 2008/2009 freeware)

App id `spelunky_classic` (local-only, `lib/apps.js`). Download, hashes and
licence terms: `test/binaries/SOURCES.md`, section "Spelunky Classic v1.1".
Evidence: `scratch/runs/20261124-spelunky/`.

## What the binary is

- `Spelunky.exe` is the **Game Maker 8 runner** (Delphi VCL) with the game data
  appended to the image. Rendering is **Direct3D 8** (`d3d8.dll`); textures and
  render-target surfaces go through a D3DX-style helper DLL the runner loads at
  run time (`DllMain` at runtime `0x010200d9`, CheckDeviceFormat callers at
  `0x0102410b`).
- Sound: `supersound.dll` (GM extension, DirectSound via `DSOUND.DLL`) for the
  game's own `.ogg`/`.wav` files, plus GM's built-in sound, which asks for a
  DirectMusic `IDirectMusicPerformance8`.
- Imports: oleaut32, advapi32, user32, kernel32, msimg32, gdi32, version, mpr,
  ole32, comctl32, shell32, winspool.drv, comdlg32, winmm, d3d8, ddraw, wsock32.

## Load bases (headless, `--trace-api`)

| Module | Runtime base | Preferred |
|---|---|---|
| Spelunky.exe | `0x00400000` | same |
| supersound.dll | `0x00862000` | `0x10000000` |
| msvcrt | `0x00994000` | |
| oleaut32 | `0x00ad8000` | |
| comctl32 | `0x00c6a000` | |
| D3DX-style helper | `~0x01020000` | |

## Startup sequence and what each step needed

1. **TSplashForm** carries a `TWebBrowser` ActiveX (`SplashWeb`).
   `CoCreateInstance(CLSID_WebBrowser {8856F961-340A-11D0-A96B-00C04FD705A2})`.
   Delphi's `TOleControl` then runs GetMiscStatus, SetClientSite, QI, GetExtent;
   `TOleControl.SetParent` (`0x0050f7a4`) calls `GetClientSite` and
   `IOleControl::OnAmbientPropertyChange(DISPID_UNKNOWN)`.
   Provided by `src/09a7l-webbrowser.wat` (blank control; navigation is
   `crash_unimplemented`).
2. **RichEdit 1.0** `EM_EXGETSEL`/`EM_EXSETSEL`/`EM_EXLIMITTEXT` on class 24
   (Delphi `TRichEditStrings.Insert`); without them the runner raised an
   `EReadError` while streaming its form. Fixed in `09c3-wndprocs5-edit.wat`.
3. **Loading splash**: ~170 s of wall time headless (≈ batch 19 842 at
   `--batch-size=100000`). This is per-byte stream decoding of the appended
   game data in guest code, *not* API-bound (`--trace-api-counts`).
4. **"No sound device detected. Sounds might not play."** message box. The
   check at `~0x004852cf` calls the `CoCreateInstance` thunk at `0x00409054`
   with the IID at `0x004853c0` (`IDirectMusicPerformance8`,
   `{679C4137-C62E-4147-B2B4-9D569ACB254C}`); message text at `0x004853d8`.
   Fixed 2026-11-24 by `09a7m-directmusic.wat` (DirectMusic 8 Performance /
   Loader / Segment / AudioPath / SegmentState, Standard MIDI Files sequenced
   in WAT onto the host MIDI-out device): both CoCreateInstance calls return
   S_OK, `InitAudio(NULL, NULL, hwnd, DMUS_APATH_DYNAMIC_STEREO, 64,
   DMUS_AUDIOF_ALL, NULL)` returns S_OK, and no box appears.
   The GM8 sound unit (`0x00485100..0x00486500`): probe `0x00485280`;
   add-sound `0x00485110` (one CreateStandardAudioPath per sound, kind 2 =
   3D gets type 6); load-from-file `0x00485530` (LoadObjectFromFile, then
   SetParam(GUID_StandardMIDIFile), Download); load-from-memory `0x00485684`
   (GetObject with DMUS_OBJ_CLASS|DMUS_OBJ_MEMORY); delete `0x00485820`;
   master volume `0x004858e0` / tempo `0x0048594c` (SetGlobalParam);
   play `0x004859bc` (SetRepeats, PlaySegmentEx DEFAULT for background music
   or SECONDARY, 10 stack dwords); stop `0x00485bfc`; IsPlaying
   `0x00485c90`; volume `0x00485d2c` (AudioPath SetVolume); pan
   `0x00485d8c+` (AudioPath GetObjectInPath for an IDirectSoundBuffer8 —
   still a crash stub). **Spelunky itself never adds a GM built-in sound**
   (`0x00485110` hit count 0): all its music and effects are `.ogg`/`.wav`
   through supersound/DirectSound, so after the probe it only calls master
   volume. MIDI events reach the host only for GM games that use built-in
   MIDI sounds.
5. **Direct3D 8 init**. Without `--headless-gl` the runner shows "Failed to
   initialize drawing surfaces"; with it the device, textures and LockRect all
   succeed and the first frame is presented.
6. **Game scripts**: load all `sound/*.ogg|wav` through supersound (63
   DirectSound buffers), read `settings.cfg`, `keys.cfg`, `gamepad.cfg`, poll
   `joyGetPos(0)`/`(1)` (both `JOYERR_UNPLUGGED`, fine).
7. **Render-target surfaces**: the D3DX helper walks
   `IDirect3D8::CheckDeviceFormat(usage=D3DUSAGE_RENDERTARGET, rtype=TEXTURE)`
   over 29 formats, three times. Until 2026-11-24 the D3D8 handler answered
   `D3DERR_NOTAVAILABLE` for every one, although `CreateTexture` does make
   render-target textures. With no surface the game ran its own end path:
   stop all sound buffers, `DeleteFileA`+write `stats.txt`, destroy every
   form, `PostQuitMessage(0)`, `ExitProcess(0)` (ret `0x00405851`) — a clean
   exit with no dialog, so it reads like the game choosing to quit.
   Fix: `$d3d9_render_target_texture_format` (09ae) is the one rule both
   `CreateTexture` and D3D8 `CheckDeviceFormat` read
   (`test/test-d3d8-render-target-texture-format.js`).
8. **Title**: with the fix the intro and title room render (run 15: 5180
   presents, 1.2M draws, no exit by the 280 s limit; `title-intro.png`).
   Input reaches the title room (`title-room-after-input.png`). **Not yet
   done:** the route from the title room into a level (Spelunky's own
   controls: arrows / Z jump / X whip by default per `keys.cfg`).

## Reproduction

```sh
caffeinate -u -t 2
node test/run.js --app=spelunky_classic --headless-gl --quiet-api \
  --max-seconds=280 --max-batches=1000000 --batch-size=100000 --stuck-after=0 \
  --no-close --input=20500:keydown:13,20510:keyup:13 --png=OUT.png
```

- `--stuck-after=0`: before 2026-11-24 the stuck detector otherwise ended
  the run during the modal sound message box; with DirectMusic there is no
  box and the Enter input is no longer needed.
- Browser: dev server, `?app=spelunky_classic`.

A fresh worktree lacks the gitignored `test/binaries/dlls/` (`ole32.dll`,
`shell32.dll`), and the loader says so; copy them in before chasing an
`<ord>` crash.

## Ruled out

- The crash labelled `UNIMPLEMENTED API: ... KERNEL32.DLL#18` during splash
  setup was a **mislabel**; the trace showed
  `WebBrowserOleObject_GetClientSite`.
- Slow loading is not an API storm and not the bundled DLLs.
- The post-init exit is not a crash, a failed Present, or input: no keyboard
  read occurs between config load and the end path; the Enter keyup from the
  sound box was consumed by the form before scripts ran.
