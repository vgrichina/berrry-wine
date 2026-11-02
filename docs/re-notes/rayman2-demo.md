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

After both, the historical CLI (`--app=rayman2_demo`) reached Rayman in the
grass with the demo logo around batch 8000 under its earlier command. That
estimate and its historical throughput are not readiness measurements for
the commands below; observe the opening sequence before sending movement.

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

## 2026-11-01 native resume: ordinary movement and A jump reviewed

Run `scratch/runs/20261101-rayman2-native-movement-resume/` passed the
DarkReign2 worker's fresh launcher final/result plus explicit
runtime/source/build release gate at 12:15:51 UTC. Actual source baseline
was main `dd82ceb03a91273408caf743e64f4a5e4bde06a5`, rather than dispatch
main `84358006a197266af7bb1f17ebf80de605d5d736`. One original ran for
678.118 seconds and exited 0 at batch 121; no second original was needed.

With the registered defaults, `--batch-size=100000 --frozen
--control-stdin --trace-input-dispatch`, the observed readiness captures
were batch 25 (loading), 50 and 75 (letterboxed opening camera sequence),
then 95 (grassy player view with HUD, no letterboxing). Steps were only
25, 25, 25 and 20 batches, with image review between them. No player input
was sent during these steps; there was no blind 8000-batch advance.

The matched no-input interval has before/held/released/settled PNGs at
95/101/102/105, using the same 6+1+3 batch spacing as the movement trial.
The upper-left gray ridge, uphill dark ground patch, and pale grass/soil
patches around Rayman's feet remain fixed; small idle-pose differences
are not displacement. Right down was scheduled, dequeued, routed and
dispatched to `Rayman II` HWND `0x10001` at batch 105. The held image at
111 shows the running pose and a changed viewpoint beside the rock wall;
Right up was consumed at 111, with released/settled images at 112/115.
Rayman returns to an idle stance at the changed terrain position. The
camera turns and continues settling after release, so screen-coordinate
motion alone is not the movement evidence: the running-to-idle response,
changed player/ground relationship, persistent rock-wall location and
stationary matched no-input interval together support ordinary movement.
No world-coordinate distance or camera-independent speed was measured.

A down at 115 and up at 116 were also fully dequeued, routed and
dispatched. `jump-before/held/released/settled.png` captures are at
115/116/117/121. At 117 the feet are visibly elevated above the separate
ground shadow; at 121 Rayman has landed back in the standing pose beside
the same wall. This is a reviewed jump/landing, not merely a text skip.
The four key edges are retained in `input-consumption.json`; frozen
input-state records show the known scheduled/renderer/cross-thread queues
empty after consumption. Guest post-queue state remains unknown, and the
Right/A pressed-edge latch remains set after physical/async release;
that latch is not a held key. No Space/fire trial was made.

All 4,392 accepted input hashes and 141 accepted read hashes matched before
reusing module `dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`;
actual runtime compilation observed those module bytes. All 4,444 pinned
source/build inputs, 155 observed runtime reads, and all 193 original
tree/manifest identities and installed-tree membership matched afterward.
The EXE remains 1,399,808 bytes with SHA-256
`8b1d1a4312add1a027900216d52f660b8b45d2166642ec51cc4d6a7171ad3cb3`;
manifest SHA-256 remains
`78fa8c79b10e90ec1281ab250bfdec44289afcd9680bdcb6a826d23a48f12ca1`.
Original INIs/media, registered defaults and guest state were not edited.

The observer passed fresh actual sync/async execution, whole-512-MB
read-only hashing, native/host clock identity and emitted late-10001
retention checks. Its string-path readFileSync/readFile/promises.readFile
coverage excludes comprehensive descriptor/direct OS IO; runtime module
compilation is not compiler-source read proof. All 17 PNGs passed chunk
CRC and image-data decompression checks, and the compressed runtime log
decoded completely. The live controller's sampled disk minimum was
2,226,053,120 bytes, above the required 2,000,000,000; no disk stop occurred.
Native box ID/state/expiry are N/A, and delegated runtime shutdown completed.
No audio, FPS, backend parity, broad playability or full27 claim follows.

## 2026-11-02 fresh native run: firing and pirate attack contact reviewed

Run `scratch/runs/20261102-rayman2-native-encounter-fresh/` consumed the
Battlezone existing-defense handoff's actual terminal/result/final, exact
AUTHOR RELEASE and helper cleanup before execution. One original ran on fresh
finite-TTL boat `bx_7rm9fd4k` (original expiry 13:59:03.766 UTC), using the
registered defaults and the existing frozen stdin controller. It exited 0 at
batch 126 after 542.835 seconds. No shared controller or emulator code changed.

Readiness captures at 10/25/40/55/65/75/85 were reviewed between small steps:
gray window, loading, opening camera sequence, then the grassy player view
with HUD. Batch 85 briefly shows 0/50 lums and 0/2 cages. A final neutral
10-batch step reached 95 before player input. The local shell for that step
ended 143 after the successful step reply; the live original remained at 95,
and a fresh read-only capture confirmed it. No original was restarted.

Space down/up at 95/96 gives a throwing pose at 97, then a separate bright
projectile above Rayman with a sparkling trail at 99 (`fire-settled.png`;
the filename does not mean the projectile had settled). At 101 Rayman is
idle again and only fading sparkles remain. This is ordinary firing beyond
the earlier movement/jump result; animation alone is not the evidence.

Up down/up at 101/107, with released capture at 109, brings the ship and a
pirate on its right balcony into the playable view. Ctrl down at 109 and
Space down at 110 are followed by a four-batch step. At 114 a small bright
player shot crosses the ship's foreground and a large flaming object emerges
near the pirate. Both keys are released at 114. The flaming object moves
away from the balcony at 116; at 119 flames and smoke surround Rayman.
At 122 and 126 he has a translucent recovery appearance and the yellow
health bar remains shorter. At fixed image row y=65, the yellow/red boundary
is x=152 before the attack and x=146 in both later captures (yellow pixels
end at 151 and 145 respectively). This supports player attack contact and
health loss, not a hit inferred solely from a pose. It measures pixels,
not guest health points. The cause of the encounter trigger was not isolated.

All eight key edges were scheduled, dequeued, routed and dispatched to
`Rayman II` HWND `0x10001`. At 126 the known scheduled, pending, renderer
and cross-thread queues are empty; physical/async Up, Ctrl and Space are
released. Their pressed-edge latches remain set, which is not a held key.
Guest post-queue and SDL consumption remain unknown. No A/Right replay,
memory/progress edit, menu rebinding or compatibility workaround was used.

The unchanged accepted COPY module was reused only after all 4,375 tested
prerequisites matched. Its actual runtime compilation hash is
`68cccb08e53a59d84c0ec566ea0fa5056d5e30aab40ef9d89b55c4e6d3a2ae69`;
the materialized source baseline was main `8905ffb3bbb748b060212187304fbcbcb0c1cfaf`.
All 5,045 transferred inputs, 155 observed runtime reads, and 193 original
fixture/manifest identities plus installed-tree membership matched afterward.
The EXE and manifest retain the hashes pinned above. Observer sync/async
execution, whole-512-MB read-only hashing, clock identity and late retention
checks passed. Its string-path read coverage does not cover every descriptor
or direct OS read. All 22 PNGs passed CRC/decompression checks.

The evidence archive SHA-256 is
`efe06cd35ec860f86e4be8699249b09e04c741def792531183f7ac6bcf067579`;
it and all 79 contained file hashes were verified locally before delegated
shutdown. The boat is confirmed STOPPED at 13:12:29.669 UTC; own runtime and
helper PIDs are absent. Local launch free space exceeded 2.4 GB; the guard's
sampled minimum through retrieval was 2,389,708,800 bytes, above the 2.02 GB
stop floor. Initial insufficient headroom was resolved by coordinator cleanup
before launch. No enemy damage/kill, collectible, opened passage or objective
completion is proved. No audio, FPS, full-game or full27 claim follows.
