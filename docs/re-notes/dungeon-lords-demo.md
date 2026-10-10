# Dungeon Lords demo

## Original media inventory (2026-10-10)

- Local source: `test/binaries/win98-games-a-d/Dungeon Lords-Demo1.5-Win98-D3Dprobably.exe`
- Bytes: 582511033
- SHA-256: `3833f80a791bac45a2f0676d37778cdcef55a486f3a736cf21026b12cef8aa9c`
- PE32 x86 GUI executable; initial bootstrap contains InstallShield strings.
- No entry in the inspected public `DESKTOP_APPS` list or prior qualification in the task/re-note index. This is not a release or redistribution decision.

Original bytes are staged on temporary boat `bx_hx8msa33` with verified SHA-256. No installed game path has been established. No installer approval, gameplay, audio or FPS result is claimed.

Task: `NEW-GAME-DUNGEON-LORDS-DEMO-20261010`; owner root Codex, one worker with serialized runtime resources.

Boat staging completed with matching SHA-256. `7z l` cannot open the original as an archive (2026-10-10 03:55Z); this is an extraction-tool limitation, not a guest result. The tail contains `setup.ini`, naming Dungeon Lords CE (Demo), DreamCatcher Interactive and InstallShield EngineVersion10.50.0.125. Next capture the original bootstrap self-extraction/child launch on the boat without accepting installer dialogs, then inventory the produced cabinets.

## Bootstrap observation (2026-10-10)

Run `scratch/runs/20261010T0402Z-dungeon-lords-bootstrap`: original setup starts at `0x0040ce02`, calls ShellExecute with `C:\setup.exe -deleter`, then Exit(0). The harness reports eip-zero after that exit. The captured launch is the same setup.exe with `-deleter`, not a game or InstallShield engine. No cabinet payload was extracted; the 49 captured files are bootstrap/system scaffolding. Next use a bounded startup API trace to identify the extraction failure before the self-delete branch. Do not follow the deleter as a game launch.

## Early-exit narrowing (04:12Z)

Breakpoint0x40b14c proves WIN32_FIND_DATA contains correct582511033-byte source size (0x22b869b9), not the8MiB PE staging prefix. Headers are read before this check. No-uop reproduces the early self-deleter path. Next follow the returned size check and caller branch into cleanup; no evidence yet of truncated metadata or uop failure. Evidence scratch/runs/20261010T0410Z-new-games-bootstrap-diagnostics.

## Correct child route and native dependencies (2026-10-10 04:42Z)

The earlier deleter-as-cleanup-only inference was wrong. The original parent requests a self child with `-deleter`; replaying that argument (`--args=-deleter --stuck-after=0 --save-vfs=DIR`) actually extracts the InstallShield bootstrap and cabinets. No buttons need to be answered. The original parent exits because the CLI records the child boundary. CreateProcessA also loses its command-line argument when lpApplicationName is non-null; tracked separately as CREATEPROCESS-CHILD-ARGS-20261010.

Both demos now reach the visible InstallShield error `-5003:0x7e`. Native setup.dll initially reports missing comctl32.dll/shell32.dll. Staging those exact existing fixtures removes those missing-import warnings but does not resolve the error. A trace then shows many missing WinINet dynamic exports. Native WININET.DLL from the existing Delphi6 Win95 Support fixture loads successfully, but the error persists: missing WinINet exports alone are not proven as its cause. Next trace the first failing module/export or error-construction path with this complete recorded dependency set, or decode the original appended multi-volume installer payload. Do not declare a complete game tree from data1.cab alone.

Dependency SHA256: shell32 `533c5809a9b6bdb236cce17a14c03ff251c4ca4d00790ea8e8034ee5d14d7f61`; comctl32 `28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4`; wininet `6e0d08e5a31a4b96a3951b7bc8ced1b3c6e1db7d78c3e71a2694f9dce4fa2448`. All runtime/extraction occurred on bx_hx8msa33; no approvals accepted. Evidence: scratch/runs/20261010T0439Z-installshield-child and scratch/runs/20261010T0442Z-installshield-native-deps. This is installer progress, not gameplay.
