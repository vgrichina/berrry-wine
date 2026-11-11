# Aliens versus Predator 2 single-player demo

## BltFast compressed upload defect (11 October 2026)

Retained traces identify BltFast uploads from temporary surfaces442/444/497
to textures441/443/496. A bounded host-only observer on bx_g3cm9v9z confirms
source format kinds9/11/7 (DXT3/DXT5/DXT1) and destination kinds1/4/1
(RGB565/ARGB4444/RGB565). The temporary sources are freed immediately after
copying. This explains why the earlier surviving-surface census saw no DXT.
Blt had decompression, but BltFast copied compressed block bytes as pixels.

The candidate decodes into destination-format scratch storage before the
existing rectangle copy, with an explicit allocation-failure return. Real-WAT
pixel tests fail on the unchanged implementation and pass after the fix.
Expanded coverage includes RGB565, ARGB4444/8888, non-block-aligned sizes,
source rectangles, destination offsets/padding and unchanged source blocks.
The original Marine-menu model is visibly textured after the fix (reviewed).
Evidence: scratch/runs/20261011T0835Z-avp2-bltfast-dxt.

This was a rebuilt retained diagnostic source, not current-main qualification.
The restored snapshot lacked build outputs, stdole2.tlb and pngjs; those were
restored remotely before the successful capture. Earlier failed harness
attempts are not game failures. The original mission run completed cleanly at
08:38:56Z with the candidate: reviewed before/after forward-input captures show
textured walls, equipment and Marine clothing/face. Evidence:
scratch/runs/20261011T0836Z-avp2-bltfast-gameplay. Main integration/revalidation,
audio and logical FPS remain unqualified.

Local original installer:
`test/binaries/win98-games-a-d/alien vs predator 2-sp demo-D3D.exe`,
165836576 bytes, SHA256
`e335063b508f5b4bc8c8235787d839567f16ce13eb63b74a96ccb5a839d3fbe3`.
InstallShield SFX contains a MSZip CAB at offset168618, with Disk1/data1.cab,
data1.hdr and data2.cab. Host extraction with 7z then unshield preserves the
original AVP2_Demo_Files payload; it does not prove installer compatibility.
The complete media is on temporary boat bx_hx8msa33 under
`/home/user/avp2-original-20261010/extracted/AVP2_Demo_Files`.
Local installed path `test/binaries/candidates/avp2-demo` is still absent.

Running original AVP2.exe writes avp2cmds.txt and requests ShellExecute of
`lithtech.exe -cmdfile avp2cmds.txt`. The captured command file contains:

```
lithtech.exe -windowtitle "Aliens vs. Predator 2" -rez AVP2 -rez AVP2.REZ -rez SOUNDS.REZ -rez AVP2L.REZ -rez AVP2DLL.REZ -rez MULTI.REZ
```

`--capture-launch` preserved the 67-file VFS handoff at
`/home/user/avp2-handoff-20261010`. Replaying that original child command
reaches the rendered Single Player menu. No config or guest-memory patches.
Default autoexec selects d3d.ren, 640x480, 32-bit textures.

## Current result: HUD font error before gameplay

Evidence: `scratch/runs/20261010T0237Z-avp2-hud-font`.
Module `b84324ed9ad9c04a780d418348b22a065642cdea08422a74b06d2635019116de`.
Native cooperative, frozen200ms clock, batch-size100000; not FPS evidence.
Keydown13/keyup13 (not just WM_CHAR keypress13) opens Single Player, then
Marine. Click491,435 launches Unwelcome Guests at Normal difficulty.
After5862 total batches a real MessageBox reports:
`ERROR: Could not initialize font in HUDMgr`.
The rotating Marine model already has corrupted textures on the menu.
Do not count either menu or loading strip as gameplay.

Controller139686/guest139693 exited normally at02:37:00Z. A preceding
controller failed before boot due to a copied source path; no guest result
belongs to that failed controller. Next: trace font API/resource creation
through the HUD failure, preserve the original settings, and separately
diagnose the texture corruption. The missing real ole32.dll warning is
recorded, but no evidence yet links it to the HUD error.

### Font-failure localization (2026-10-10 02:42Z)

Replay controller142017/guest142024 exited0 at02:39:40Z and reproduced the same HUDMgr error. Evidence: scratch/runs/20261010T0239Z-avp2-font-trace. Exported original cshell.dll has preferred base0x10000000. Error string0x101b2970 is referenced at0x10036b58 after factory0x1011bfd0 returns null (call0x10036b3b). The factory checks parameters, allocates either0x1cbc or0x18b8 bytes, then calls a virtual initializer at0x1011c087. These are candidate failure branches, not an identified failing API. Next trace the branch and initializer before changing any runtime behavior. Full log and DLLs remain on bx_hx8msa33 at /home/user/avp2-font-20261010 and /home/user/avp2-font-dlls-20261010; local disk below2GiB prevents bulk copying.

### Bitmap loader failure confirmed (02:47Z)

Factory tracing in run20261010T0244Z-avp2-font-branch proves allocation/constructor succeed, then the bitmap-font virtual initializer returns zero. Vtable preferred10190384 selects initializer1011dae0. Run20261010T0247Z-avp2-bitmap-load-failure further proves common setup succeeds but the engine callback at interface+0x170 returns zero at1011db09; execution branches directly to1011dbba. Dimensions and glyph scanning are never reached. Engine setup40d06a assigns callback40d680 (its0x45c stack frame matches the trace). It calls40d740 for resource loading/decoding and40ca70 for surface creation. Next discriminate those results and capture the original resource name. No GDI/font stub change is justified yet.

### DIB exhaustion and next API (03:24Z)

Original PCX streams and decoding succeed. Renderer surface creation returns DDERR_OUTOFVIDEOMEMORY (8876017c). Live first-failure census proves all 16128 DIB pages occupied: 2472 DirectDraw surfaces own15507 pages, including ~9.8MiB SYSTEMMEMORY allocations. The earlier terminal census saw shutdown reclamation and cannot describe the failing allocation. Evidence runs20261010T0304Z-avp2-live-arena-full and20261010T0306Z-avp2-live-surface-owners. Formats RGB565/ARGB1555/ARGB4444/XRGB8888; no DXT.

Removing offscreen sixteen-row slack alone still fails HUD initialization. Heap-backed SYSTEMMEMORY candidate (98eaa5051be16e775513b179b01e2f72ac8a0d5094f41679e53322cf2dfd27e1) instead reaches a fail-fast IDirect3DDevice7::Load at batch5664, d3d renderer callsite011363c8, vtable+ac. Controller156307/guest156315 terminal1 at03:23:14Z; evidence20261010T0323Z-avp2-systemmemory-next-api. A guest thread also reports EIP0 at previous9ac149; not yet investigated. No gameplay qualification.

Heap storage must pass g2w_affine_span over the entire allocation because sparse backing can be split. Added that guard after the above replay. Canonical build, backbuffer storage/accounting and 420MiB cumulative allocation-release test, and mip-chain test pass. Guarded replay157591/157598 started03:24:01Z on bx_hx8msa33 with600s deadline; next inspect result and implement real D3D7 Load. Changes remain unmerged.

### Rectangular texture upload (03:28Z)

Guarded memory replay157591/157598 terminal1 at03:25:33Z repeats D3D7 Load (run20261010T0325Z-avp2-safe-memory-next-api). Existing handler supports only null POINT/RECT; AVP2 passes source RECT at074f8ccc. Candidate implements rectangle copying with origin halving/far-edge rounding per mip, source-subset matching, preflight bounds and write notification. Reference: https://raw.githubusercontent.com/wine-mirror/wine/master/dlls/ddraw/device.c (copy_mipmap_chain and d3d_device7_Load). Canonical build and initial stdcall/mip/rectangle/invalid-bounds tests pass. Destination-offset and smaller-destination tests added afterward and pending run; palette/color-key propagation needs review before merge. Replay159023/159030 started03:27:30Z with600s deadline on same boat.

03:32Z: rectangular Load replay159023/159030 terminal0 at03:29:14Z reaches mission scene with HUD/transmission prompt, run20261010T0329Z-avp2-mission-first-scene, screenshot reviewed and sent Telegram987. Textures badly corrupted; scene alone is not control qualification. W movement replay159670/159677 live03:31:50Z, deadline03:39:46Z. Added palette/color-key copy after this tested module; additional tests pending. Own worktree fast-forwarded to d8a00c63f without touching shared HEAD/index; held Alice files remain separate.

03:38Z: corrected W command (keydown:87, not invalid space-delimited form) completed161117/161124 terminal0 at03:36:10Z, run20261010T0336Z-avp2-w-input. View changes, but moving teammate makes no-input comparison necessary. Canonical build and eight relevant surface/texture suites pass after syncing src/lib to main d8a00c63f plus candidate (hash audit has zero mismatches). Includes mip storage/accounting,420MiB repeated release, caller-owned pixels, palette/color-key copy, subrectangle/mip-subset and invalid bounds. Run20261010T0338Z-avp2-main-regressions. Missing calc.exe initially stopped surface3 test; copied original94208-byte fixture and remaining suites passed. Current-main idle/input paired replay queued serialized, no release-ready claim.

### Gameplay control and stored-texture corruption (03:50Z)

Paired idle/input runs on module09116cb69758880ee0613d33d050e5427be2063d34ec604cb9baa187e91ce90f complete successfully. Pre-input frames are pixel-identical; after500 steps with W held,156225/307200 pixels differ from the same-step idle frame, and the viewpoint advances toward the teammate. Run20261010T0344Z-avp2-main-paired-input proves ordinary control; severe texture corruption still blocks release readiness, audio/FPS remain unqualified.

Built-in --dump-dx-surfaces at the Marine menu (controller165558/guest165565 terminal0 at03:44:47Z) confirms corruption exists in stored textures: slots441/496 RGB565 and443 ARGB4444 show vertical coloured stripes and zero lower rows, run20261010T0347Z-avp2-corrupt-textures. Full dump remains /home/user/avp2-menu-surfaces-20261010/surfaces on bx_hx8msa33. Compression treated as ordinary pixels is a hypothesis. The previous live census finding no DXT only described surviving surfaces; it does not rule out a temporary compressed source released after upload. Next trace source/destination formats at Texture::Load.

## Original installer source recovered (2026-10-14)

The archived [original demo CD](https://archive.org/details/Aliens_Versus_Predator_2_Demo_20th_Century_Fox_2001) supplies the exact previously recorded installer. The complete ISO is 233,406,464 bytes, SHA1 `0527a9c9ab662b0747ed0ca764b58fcf6376ebc2`. Its `avp2spdemo.exe` is 165,836,576 bytes and SHA256 `e335063b508f5b4bc8c8235787d839567f16ce13eb63b74a96ccb5a839d3fbe3`, matching the old local file exactly. The multiplayer installer on that disc is a separate fixture.

Source ISO and verification receipt are preserved under `scratch/runs/20261014-avp2-source-recovery/`. Only source acquisition and exact installer identity were verified here. Complete installed payload recovery, original launcher-generated avp2cmds.txt export and current gameplay still require validation; no command file was synthesized. The obsolete Archive item avp2spdemo returned no file metadata and is not used by this recovery.

### Original cabinet payload recovered (2026-10-14)

The verified original installer was unpacked with 7z, then unshield 1.5.1
using group `AVP2 Demo Files`. Extraction succeeded for all 18 original
files (247851457 bytes), including AVP2.exe, lithtech.exe, four REZ files,
and Profiles/Default.prf. Per-file SHA256 inventory, extraction logs, original
ISO and payload are retained in
`scratch/runs/20261014-avp2-source-recovery/`. Evidence copies were byte-compared.

Recovery commands, after verifying the installer hash above:

```sh
7z x avp2spdemo.exe -ocabinet
unshield -d payload -g 'AVP2 Demo Files' x cabinet/Disk1/data1.cab
```

This recovers original source files, not the previously captured 67-file
launcher handoff. No avp2cmds.txt was synthesized and no launcher was run.
Automating the recipe and validating the real launcher-generated command file
remain open; this extraction does not establish current-main gameplay.

### Generic recovery recipe preparation (2026-10-15)

The task-branch recipe now pins the original ISO above, extracts its
`avp2spdemo.exe`, unpacks `Disk1/data1.cab`, and copies only the original
`AVP2 Demo Files` group into `game/`. It does not manufacture `avp2cmds.txt`.
`node tools/verify-avp2-recovery.js PATH_TO_GAME` checks all 18 original
file sizes and SHA256 values, failing on missing files or mismatches.

The verifier passed against the retained independently recovered payload and
a fresh forced generic recovery on bx_tgbme2h7. The original ISO hash, exact
installer SHA256 and all 18 original payload sizes/hashes passed. Run
20261015-avp2-generic-recovery preserves both attempts: first extraction failed
because unshield was absent and the early-IS5 fallback rejects this IS6 cabinet
(version 0x100600c). Installing unshield 1.5.1 resolved that dependency; the
fresh forced fetch/verification process122200 exited0 at00:08:22.982Z.

Use `node tools/fetch-candidate-corpus.js --id=avp2-demo` with unshield
installed, then `node tools/verify-avp2-recovery.js`. The durable receipt is
`docs/avp2-recovery-20261015.json`. Original launcher execution and its generated
command file remain separate runtime work; no gameplay claim follows.

## Original launcher registration, 2026-10-18

The local-only registry route `avp2_demo` now selects original `game/AVP2.exe`, with the 18-file cabinet payload and C:\ working directory. It is not promoted to the desktop and has not been run on current main. The launcher must generate its own command file and child launch; no command file or configuration override is supplied.

All 18 retained payload sizes/hashes passed `tools/verify-avp2-recovery.js` against `/home/user/wine-assembly/scratch/runs/20261014-avp2-source-recovery/original-payload`. Direct manifest-writer validation produced the expected 17 companion files including lithtech.exe and Profiles/Default.prf. The existing candidate-browser-manifest regression and browser cache-version gate passed. The generic `--prepare` attempt on this payload-only tree failed because it reruns source extraction and the source-cd installer is absent there; a full recipe tree is needed for that command. The direct writer check is not a successful end-to-end recovery run. Original payload hashes still pass afterward.

The historical 67-file capture was an entire VFS snapshot, not a second cabinet inventory. Its difference from 18 does not establish 49 missing original files. Recover or regenerate the authentic capture before comparing contents. CLI ShellExecute requires capture/replay; the browser child-launch path exists but this route remains unvalidated. The stopped saved runtime bx_9ef2wdsw and scoped resume403 block fresh launcher, gameplay, audio and FPS validation.

### Local runtime validation after TG90 authorization

User authorized same-box testing. Canonical build on d21c954463faf03d0d511e1d9b6fa9fe4a12ec9f passed. Original registered AVP2.exe exited0 and generated its real136-byte command file plus68-file VFS capture. Captured lithtech.exe child replay reached the reviewed Single Player menu, exit0 at the100-second harness limit. Run `20261018-avp2-local-launch` contains module identity, logs, actual handoff and reviewed child.png. No gameplay, audio or FPS qualification. Disk remained above3GB; dashboard preserved. Next: ordinary menu input through this authentic handoff, then paired movement evidence. Remote box resume no longer blocks this locally authorized lane.

### Live ordinary-input mission checkpoint, 2026-10-18

Run `20261018-avp2-local-controlled` uses the same canonical module and authentic handoff. Waiting for the reviewed visible menu then Enter at batches1316–1364 opens Single Player; Enter1432–1588 opens Marine; click491,435 at1868 launches Unwelcome Guests. Textured mission/HUD reviewed, before-move at6059. Ordinary W6062–6184 was released, after-move6187 reviewed, then clean controller quit (exit0). Viewpoint appears to advance but NPC animation confounds a two-frame comparison; paired idle comparison is still needed. No audio/FPS qualification: CLI uses frozen200ms/batch clock. Earlier scheduled800/1000/1400 sequence remained on main menu; failed attempt retained in `20261018-avp2-local-mission`, not counted as gameplay.

### Paired idle/input movement qualification, 2026-10-18

Run20261018-avp2-paired-plan replayed the actual recorded menu batches in two fresh sequential original-child runs, with identical canonical module d6187fed and authentic launcher handoff. Both exited0 at6200batches (153.660s idle,150.577s forward). Screens at6059 were pixel-identical (0/307200 differences). W was held6062–6184 only in the forward arm; matching6187screens differ289504/307200pixels. Root reviewed both: corridor architecture remains stationary in the idle arm, while forward view approaches the teammate and shifts static scene geometry. This qualifies original mission launch plus ordinary forward control and reviewed gameplay screenshot for this tested source. No audio/FPS/browser-device qualification; frozen200ms guest clock is not performance evidence.

### Registered browser launcher verified, 2026-10-18

Run20261018-avp2-browser-launch independently verifies original AVP2.exe -> actual ShellExecute lithtech.exe -cmdfile avp2cmds.txt -> Single Player Demo1.0.9.2 main menu on Chrome151 with D3DIM WebGL. Canonical module d6187fed and all18 original assets verified over HTTP; source0da708e7. Controller/browser exit0 after52.175s. Root reviewedscene5. Cooperative non-isolated512MiB environment; no browser gameplay inputs, audible-quality or FPS qualification. Core original launch plus controlled gameplay is satisfied by this browser route and the separate pairedCLI movement evidence; browser gameplay/device/audio/FPS follow-up remains.

### Browser ordinary gameplay checkpoint, 2026-10-18

Run20261018-avp2-browser-gameplay on source9c4c0cb80, canonical moduled6187fed, Chrome151 WebGL cooperative512MiB reaches original Marine mission through ordinary reviewed menus. Root reviewedscene61/63: bounded D input shifts static wall/support/corridor geometry, confirming browser control. W approached teammate but was not alone used as control proof. Browser exited0 and cleanup completed after296.305s, postflightmodule unchanged and trackedtree clean. The controller shell reported143 for an unexplained reason; do not treat this as a clean controller exit. Screenshot sentTelegram1432.

Existing FPS graph reports214presents over35.837s (~5.97presents/s), with logicalFps null. This CPU/software-GPU debug-page measurement is not hardware-device or logicalFPS qualification. Running22050Hz stereo16-bit audio voices/context metadata does not prove audible quality. Observer attachment briefly resized viewport to800x600 before correction to1100x800; this harness limitation is retained, not attributed to emulator. Further audible-quality/logicalFPS/device evidence remains open.

### Original gameplay audio capture, 2026-10-18

Run `20261018-avp2-audio-capture` on source `a38fa1b73e130836a42ba25995a84c6714dc610b` and unchanged canonical module `d6187fedf42d597311446e527d586b74a06db4f7f5eaaa6b51e483c5cc06603b` reaches the Marine mission through the original browser launcher. Root reviewed scene62: first-person corridor, knife and HUD after ordinary movement. Viewport remained1100x800. The shipped recorder captured10.113 seconds of actual game audio/video; no synthetic audio was injected. WebM3453326 bytes contains Opus stereo48kHz; decoded961920 interleaved samples have peak0.2445162 and RMS0.05301665. This proves non-silence, not correct music, timing or freedom from looping; no listening review performed.

Browser exit0, Node exit0 and parent-observed controller exit0 are separately recorded. Cleanup completed after285.900s; canonical module unchanged and tracked tree clean. This new run does not explain the earlier outer execution143. Recording increased overhead:33 presentation events over11.549s including transfer, approximately2.86events/s, is not logicalFPS. Hardware-device and audible-quality qualification remain open. Full evidence, WebM, decoded PCM and independent exit receipts remain in the run directory.

### Retained audio signal review, 2026-10-18

Offline script and results: `scratch/runs/20261018-avp2-audio-signal-review/`. Input PCM SHA256 `b0c65e263a136f870d4ca8d014d0710843c113e1391c15b8eef0f9c63b36289d` matches the original artifact manifest. Decoded stereo48kHz duration is10.02s (distinct from recorder wall duration10.113s). No nonfinite or clipped samples; longest exact-zero span20ms; no identical full100ms PCM windows. Peak0.2445162/RMS0.05301665 match prior measurements, DC mean0.0000065754. These are signal checks, not listening review: lossy encoding may hide source repetition, and no timing reference exists. Audible quality, correct effects/music, logicalFPS and device behavior remain unqualified. No browser, guest execution or original artifact changes.

### Current original Marine weapon consequence, 2026-11-11

Run `scratch/runs/20261111-avp2-current-marine-encounter-0820/` reaches original
`AVP2.exe` → launcher-generated command file → `lithtech.exe` → Marine →
Unwelcome Guests / Normal in current Chrome/WebGL with workers. All eighteen
original cabinet files and the manifest match their retained hashes; companions
and configuration were not edited. Instantiated guest/render-worker bytecode
matches module `d0481f03459ec4f612864c57a290a12afb1e22fb09cd476a190dca967a829a10`
from main `820fb518d`.

Two demonstrated shared DirectDraw defects were fixed and published:
`0db20330c` accepts DONOTPERSIST on managed textures and matching mip queries
(original renderer request caps2 `0x40090` previously returned E_NOTIMPL), and
`820fb518d` implements Surface7 SetPriority/GetPriority with per-surface DWORD
storage. After successful texture creation the original renderer had trapped
at vtable slot `0xb4`, returning to `d3d.ren` preferred `100408b3`.
Native x86 COM regressions fail before each fix, then pass with both normal and
compat modules; locked builds pass. Tests cover descriptor/caps and mip pixels,
priority defaults, full DWORD readback across COM views and invalid outputs.

The baseline Marine was flat white. The repaired original menu, squad intro,
weapon and world are textured. Personally reviewed full captures show pulse
rifle selection, a bounded primary-fire burst at the unoccupied APC side, muzzle
flash, and ammunition **99 → 94**; health **100** and armor **050** stay unchanged.
W advances the viewpoint along the APC toward the door, with static geometry
changing. Final Tab displays **Locate Sergeant Hall**. No enemy damage or
objective completion is claimed. Key events are trusted and balanced; native
mouse-UP acknowledges and ammunition stays94 afterward, but document capture
omits mouseup following pointer-lock acquisition. That observation limit is
retained in `native-input-proof.json`. The shipped readme explicitly excludes
Save/Load, and no ordinary save was produced.

Final184 evidence paths (153 unique contents) and all earlier recovered maps
are locally hash-verified, with lossless gzip maps and no source/media archive.
Browser, controller and supervising parent exit0 with actual waits/EOF;
independent PID/profile/port absence is recorded. Private box `bx_thnvda9b`
was normally stopped and independently confirmed archived at08:49:27Z,
receipt `stop_fe089fd9a4dd4d4b`, before fixed09:03:03Z expiry. The independent
watchdog exits0 unfired. Next gameplay step is the displayed Hall objective;
this run ends at the measured weapon consequence.
