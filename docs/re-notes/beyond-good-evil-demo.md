# Beyond Good and Evil demo

Original: `test/binaries/win98-games-a-d/BeyondGood&Evil-DX9-D3D/EnglishOfficialDemoBGE_WIN.exe`, 164275440 bytes, SHA256 `09a48b84ebfeae808b257b6ab561eb0096478b19dc09ea0a5435ab8f41a82baf`. Original staged and hash verified on bx_hx8msa33. No public desktop or prior qualified entry found at selection. Task NEW-GAME-BEYOND-GOOD-EVIL-DEMO-20261010.

Entry0x40b1cc; command parser0x40635e returns4 (normal startup) at0x406ce3. Self-child CreateProcessA call0x406ad5 uses format at0x41251c, ` -deleter %s`; success returns1 through0x406df6, so parent exits before extraction. Explicit child reaches setup.dll/igdi.dll/_setup.dll.

`7z` cannot open the original. Extracted disk1 data1.cab832826 bytes indexes25 files, including BGE.exe5771264 bytes and sally_clean.bf194865152 bytes; these game files are not yet extracted. Do not confuse the directory listing with complete payload.

## Correct child route and native dependencies (2026-10-10 04:42Z)

The earlier deleter-as-cleanup-only inference was wrong. The original parent requests a self child with `-deleter`; replaying that argument (`--args=-deleter --stuck-after=0 --save-vfs=DIR`) actually extracts the InstallShield bootstrap and cabinets. No buttons need to be answered. The original parent exits because the CLI records the child boundary. CreateProcessA also loses its command-line argument when lpApplicationName is non-null; tracked separately as CREATEPROCESS-CHILD-ARGS-20261010.

Both demos now reach the visible InstallShield error `-5003:0x7e`. Native setup.dll initially reports missing comctl32.dll/shell32.dll. Staging those exact existing fixtures removes those missing-import warnings but does not resolve the error. A trace then shows many missing WinINet dynamic exports. Native WININET.DLL from the existing Delphi6 Win95 Support fixture loads successfully, but the error persists: missing WinINet exports alone are not proven as its cause. Next trace the first failing module/export or error-construction path with this complete recorded dependency set, or decode the original appended multi-volume installer payload. Do not declare a complete game tree from data1.cab alone.

Dependency SHA256: shell32 `533c5809a9b6bdb236cce17a14c03ff251c4ca4d00790ea8e8034ee5d14d7f61`; comctl32 `28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4`; wininet `6e0d08e5a31a4b96a3951b7bc8ced1b3c6e1db7d78c3e71a2694f9dce4fa2448`. All runtime/extraction occurred on bx_hx8msa33; no approvals accepted. Evidence: scratch/runs/20261010T0439Z-installshield-child and scratch/runs/20261010T0442Z-installshield-native-deps. This is installer progress, not gameplay.

## Payload extracted; settings failure decoded (2026-10-10 05:02Z)

Original data2.cab is byte959506 length161366740, SHA25662d215895f3367b5005a6a5d68427367843d418e713fce75762cd837c1b946a2. Unshield now extracts25 files; BGE.exe5771264 bytes and sally_clean.bf194865152 bytes really exist. Selected original game groups are hardlinked under /home/user/bge-game-20261010 on bx_hx8msa33. This supersedes the earlier missing-payload state.

Actual game opens jade.spe/sally_clean.bf but requires HKCU Software\Ubisoft\Beyond Good & Evil\SettingsApplication.INI\Basic video. Run original SettingsApplication.exe instead of inventing settings. Its blank MessageBoxIndirectA carries integer text resource0x90: RT_STRING type6/id10/lang1033 decodes to DirectX older than9.0b. Call0x4096cd follows comparison against0x90002. Version helper0x40bb30 tries DxDiag COM at0x40ad90 then file fallback0x40b0d0; the fallback only promotes to9.0, so raising the d3d9.dll numeric file version alone cannot provide9.0b. Next inspect the actual DxDiag property-query result and native provider availability. No config/version spoof or dialog approval. Evidence scratch/runs/20261010T0502Z-new-game-startup.

## Settings saved; UpdateTexture implemented (2026-10-10 05:24Z)

Native dxdiagn.dll from the existing Pirates fixture (SHA25650e31067ca6872ae0b7b35a65bf2a9d07c1de539b2d603a9472a48f5375c8307) creates/initializes successfully. It reports7.0 from the default DirectX registry profile. Using the existing Pirates per-title DX9 Version=4.09.00.0904 with software programmable D3D9 opens the original settings UI; the global default stays unchanged. A1024x768 CLI screen makes the settings buttons visible. The original utility writes Basic video, Performance, Sound and Key bindings; carry its exported registry rather than inventing those fields. Boat snapshot: /home/user/bge-settings-save-20261010/registry.json. Evidence0515/0517.

With those settings, actual BGE.exe reaches UpdateTexture at0x4aa8ce (COM slot31), batch282. Source is256x1 single-mip A8R8G8B8 SYSTEMMEM; destination is the matching DEFAULT texture, both usage0. The implementation copies complete matching mip chains, including cube faces and compressed small mips, with destination snapshot-generation updates. It validates type, format, ownership, pools, all source locks and matching destination levels before mutation. A source with more levels matches the destination's bottom-aligned levels. This is a conservative whole-level upload; dirty regions are optimization hints rather than clipping bounds.

Limits: GPU-owned render-target texture destinations still fail fast pending a fenced upload implementation; volume/autogenerated texture creation remains unsupported. No fake success for those paths. Contract reference: https://learn.microsoft.com/en-us/windows/win32/api/d3d9/nf-d3d9-idirect3ddevice9-updatetexture.

Canonical build and direct/Worker color-surface suite pass (mip matching, cube faces, raw/compressed bytes, invalid pools/formats/kinds/owners, late lock without partial writes, cache generation and stdcall). Color target/alias suites pass. Original game now passes the texture call and reaches MsgWaitForMultipleObjectsEx at0x4027c3, ret0x4027da, batch322: count0, handlesNULL, timeout0, wakeMask0xff, flags6 (alertable+inputavailable). Next implement/check real message-wait semantics. Evidence scratch/runs/20261010T0524Z-bge-update-texture-fix. No gameplay screenshot yet.
