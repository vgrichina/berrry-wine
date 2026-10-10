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
