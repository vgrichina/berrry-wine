# Aliens versus Predator 2 single-player demo

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
