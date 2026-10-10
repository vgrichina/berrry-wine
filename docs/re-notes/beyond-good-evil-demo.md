# Beyond Good and Evil demo

Original: `test/binaries/win98-games-a-d/BeyondGood&Evil-DX9-D3D/EnglishOfficialDemoBGE_WIN.exe`, 164275440 bytes, SHA256 `09a48b84ebfeae808b257b6ab561eb0096478b19dc09ea0a5435ab8f41a82baf`. Original staged and hash verified on bx_hx8msa33. No public desktop or prior qualified entry found at selection. Task NEW-GAME-BEYOND-GOOD-EVIL-DEMO-20261010.

Entry0x40b1cc; command parser0x40635e returns4 (normal startup) at0x406ce3. Self-child CreateProcessA call0x406ad5 uses format at0x41251c, ` -deleter %s`; success returns1 through0x406df6, so parent exits before extraction. Explicit child reaches setup.dll/igdi.dll/_setup.dll.

`7z` cannot open the original. Extracted disk1 data1.cab832826 bytes indexes25 files, including BGE.exe5771264 bytes and sally_clean.bf194865152 bytes; these game files are not yet extracted. Do not confuse the directory listing with complete payload.

## Correct child route and native dependencies (2026-10-10 04:42Z)

The earlier deleter-as-cleanup-only inference was wrong. The original parent requests a self child with `-deleter`; replaying that argument (`--args=-deleter --stuck-after=0 --save-vfs=DIR`) actually extracts the InstallShield bootstrap and cabinets. No buttons need to be answered. The original parent exits because the CLI records the child boundary. CreateProcessA also loses its command-line argument when lpApplicationName is non-null; tracked separately as CREATEPROCESS-CHILD-ARGS-20261010.

Both demos now reach the visible InstallShield error `-5003:0x7e`. Native setup.dll initially reports missing comctl32.dll/shell32.dll. Staging those exact existing fixtures removes those missing-import warnings but does not resolve the error. A trace then shows many missing WinINet dynamic exports. Native WININET.DLL from the existing Delphi6 Win95 Support fixture loads successfully, but the error persists: missing WinINet exports alone are not proven as its cause. Next trace the first failing module/export or error-construction path with this complete recorded dependency set, or decode the original appended multi-volume installer payload. Do not declare a complete game tree from data1.cab alone.

Dependency SHA256: shell32 `533c5809a9b6bdb236cce17a14c03ff251c4ca4d00790ea8e8034ee5d14d7f61`; comctl32 `28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4`; wininet `6e0d08e5a31a4b96a3951b7bc8ced1b3c6e1db7d78c3e71a2694f9dce4fa2448`. All runtime/extraction occurred on bx_hx8msa33; no approvals accepted. Evidence: scratch/runs/20261010T0439Z-installshield-child and scratch/runs/20261010T0442Z-installshield-native-deps. This is installer progress, not gameplay.
