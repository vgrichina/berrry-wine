# Game Maker 5–7 benchmark attempts (2026-11-24): all blocked

Three archive.org Game Maker games were tried as interpreter benchmarks. None is
registered; the downloads were removed. Each item can be refetched by its identifier.

| Game | archive.org item / file (SHA-1) | Runner | Blocker |
|---|---|---|---|
| Garden Gnome Carnage (Remar, 2007) | `Garden_Gnome_Carnage` / `ggc.exe` (27b763d719c06c06a3a5dacc8b8e9878f630307e) | GM6/7, D3D8, packed | The packer stub at `0x5f16ec` walks down from its return address in 64 KB steps looking for `MZ` (kernel32 base hunt). No PE header is found below the thunk zone, the scan wraps to `0x80ff0000` and faults with `ESHAREDHEAP_ACCESS` at batch 72. Needs the entry return address inside a mapped kernel32 image. |
| Metrojd (Remar) | `Metrojd` / `Metrojd.zip` | `metrojd.exe` GM5 (DirectDraw) and `metrojd_gm7.exe` GM7 | GM5: the runner reads the whole exe (`ReadFile` 0x2bc763 bytes), extracts WAVs to `C:\WINDOWS\TEMP\gm_ttt_*`, then raises Delphi `EReadError` "Stream read error" and shows "Unexpected error occured when running the game." at batch ~38000. GM7: `UNIMPLEMENTED API: DirectMusic segment from RIFF WAVE` at batch 48210 (`src/09a7m-directmusic.wat`, owned by another lane). |
| Seven Minutes (Tuukka Virtanen, 2008) | `7_Minutes_game` / `SevenMinutes.zip` | GM7 | Loading bar at ~30% after 100000 default batches; with any batch size it reaches runtime-generated code at `0x0c3f0e..`, ESP goes odd (`0x074ff725`) and `$th_pop_run` hits `unreachable` (batch 1137 at 100k blocks, 10926 at 10k, 36297 at 3k). GM7's code-protection layer; not a trivial fix. |

GM6–8 normal sounds load through DirectMusic as RIFF WAVE segments, so every GM6–8 game with
sound effects hits the Metrojd GM7 blocker until wave segments exist; Spelunky Classic avoids it
only because its audio goes through `supersound.dll`.
