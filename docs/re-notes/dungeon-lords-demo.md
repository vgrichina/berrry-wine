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
