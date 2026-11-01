# Rayman 2: The Great Escape (demo)

Ubisoft, 1999, Direct3D (GliDX6) / Glide (GliVD1) 3D platformer. Candidate
`rayman2-demo`, app `rayman2_demo`, local only.

## Source and layout

- archive.org `Rayman2TheGreatEscape`, `Rayman2Demo.zip` (59,378,961 bytes,
  sha1 b133d45c0b388c43e0466af2813f460895655f8c).
- The zip is a ready-to-run tree: `Rayman2Demo.exe` (internal name
  MainWinR.exe, 208 exports), `BinData\`, `dll\GliDX6vr.dll`,
  `dll\GliVD1vr.dll`, and the Ubisoft sound modules `WAVPWBVR.dll` and
  `APMP5BVR.dll` (plus the `S` variants, chosen by `dll\SND_CPA.ini`).
- The candidate extracts it to `installed/rayman2` (guest `c:\rayman2`).

## Renderer configuration

The renderer comes from `C:\WINDOWS\UbiSoft\Ubi.ini` `[Rayman2]`:
`GLI_DllFile`, `GLI_Dll`, `GLI_Driver`, `GLI_Device` and `GLI_Mode`. The exe
loads `dll\<GLI_DllFile>vr.dll`. With no ini it loads `dll\vr.dll` and stops on
"Graphics Dll not found, run install". The candidate writes the ini
(`postExtract` writeText) for `GliDX6` / `Direct3D HAL` / `1 - 640 x 480 x 16`.

## Two emulator bugs it found (fixed with the registration)

1. **EnumZBufferFormats from a guest thread returned to address 0.** The
   renderer runs on the game thread (CreateThread at 0x401870) and calls
   IDirect3D3::EnumZBufferFormats there. The thread-instance thunk table
   (`$sync_thread_thunk_globals`) never rebuilt CACA000D, so the callback's
   return address was 0. qsort (CACA002D) and LineDDA (CACA0012) had the same
   gap. `test-thread-thunk-sync.js` now checks that every thunk the PE loader
   allocates is rebuilt.
2. **CreateWindowEx overwrote the EXE's export directory.** The CREATESTRUCT
   scratch lived at `image_base+0x100`. This exe's PE header starts at 0xB0, so
   its data directories sit there, and the class-name pointer replaced the
   export RVA at 0x400128. WAVPWBVR's init then failed
   `GetProcAddress(exe, "_SND_fn_vDisplayError@8")`, asserted (error 0x1d) and
   hit DebugBreak, ending the game thread. The scratch is now a heap block per
   instance (`$wnd_scratch`).

After both, the CLI (`--app=rayman2_demo`) reaches 3D gameplay: Rayman in the
grass with the demo logo by batch ~8000. The game thread is heavy (about
80 batches/s).

## Controls (Readme.txt) and touch layout

Arrows move relative to the camera, A jumps (and skips text), Space fires,
Ctrl strafes and recentres the camera, Shift walks, keypad 0 holds look mode.
The touch layout is a pad plus Fire/Jump, Strafe/Walk, and Look/Esc.

## 2026-11-01 original movement attempt: disk-floor blocker

Run `scratch/runs/20261101-rayman2-original-movement/` tested actual main
`ebed72ce2055025648297c367d116a9aba8256f9`, after AoWII's fresh final/result
and explicit runtime/source/build release (09:25:18 UTC). Gate time was
09:25:48 UTC; the 30-minute runtime deadline was 09:55:48 UTC.

The first and only original run stopped on the required disk floor:
startup free space was 2,231,074,816 bytes, then the guard observed
1,991,426,048 bytes (required strictly above 2,000,000,000). The controller
requested shutdown and delivered SIGTERM; the CLI performed orderly shutdown,
wrote `final.png`, and exited 0 after 171.315 seconds, at batch 148. The
outstanding 8000-batch step and queued read-only snapshot never replied.
The first failure is the disk-floor guard, not a demonstrated guest fault.
No second original run or access retry was made.

The reviewed final 640x480 PNG shows Rayman standing in the grassy 3D world
with the demo logo. No player input was sent before shutdown. There is no
before/held/released/settled movement sequence, and ordinary movement, A jump,
and Space fire remain unverified. The historical ~8000-batch entry estimate
above is not this run's measured entry point: this command used
`--batch-size=100000`, and its only image is the shutdown capture.

The command was `node --require <run>/observe.cjs test/run.js
--app=rayman2_demo --no-build --wasm=build/wine-assembly.wasm --quiet-api
--quiet-blocks --batch-size=100000 --max-seconds=1200 --max-batches=100000
--control-stdin --frozen --no-close --trace-input-dispatch
--png=<run>/final.png`; exact argv, raw compressed output, controls, exit,
identity manifests, review and cleanup are retained in the run directory.

Reused the accepted per-file build only after all 4,392 accepted input hashes
and 141 recorded read hashes matched. Actual emitted module SHA-256 was
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`;
the region mirror matched too. All 4,444 pinned source/build inputs, 155
observed runtime file reads, and 193 original-tree/manifest files were
unchanged. EXE size 1,399,808 and SHA-256
`8b1d1a4312add1a027900216d52f660b8b45d2166642ec51cc4d6a7171ad3cb3`,
manifest SHA-256
`78fa8c79b10e90ec1281ab250bfdec44289afcd9680bdcb6a826d23a48f12ca1`.
Registered defaults, original INIs/media and guest state were not edited.

The identity observer passed actual sync/async execution, whole-512-MB
read-only hashing, unchanged native/host clocks, and emitted late-10001
retention checks. Runtime read hashes cover string-path readFileSync,
readFile and promises.readFile observations, not all descriptor/direct OS IO
or WAT compilation reads. Disk continued falling after the guard; the
post-shutdown observation was 1,288,658,944 bytes, not a continuous minimum.
Native local box ID/state/expiry are N/A. No audio, FPS, backend parity,
broad playability or full27 claim follows from this capture. A future
movement attempt requires restored disk headroom; this assignment stopped
without repairing or cleaning foreign work.
