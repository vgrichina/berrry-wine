# KKnD corpus intake, 2026-11-06

Owner Telegram163 requested the game shown at https://x.com/exQUIZitely/status/2118524267604140164. The post identifies Beam Software's **KKnD: Krush, Kill 'n' Destroy (1997)**. X returned403; the post text was recovered through `https://api.fxtwitter.com/exQUIZitely/status/2118524267604140164`. This is the original game, not KKnD2.

Archive.org offers two distinct original demos. Preserve this distinction when registering and reporting results.

| Demo | Download | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Original DOS | https://archive.org/download/kknd-demo/kknd-demo.ZIP | 5684907 | `7ff2ef0abe45322027750cee26caf871d970474d92d98272598ab15426cc0be4` |
| Windows Xtreme | https://archive.org/download/KKNDXT/KKND_XT.EXE | 7737611 | `b0974e129ab1c02d4fdf7cd202494f39f426a1e08cbd37759db125a9a114248d` |

Each download's length and SHA-1 match its Archive.org metadata: respectively `3c4be2d6c04ab221ec28f4a781fad3f10bd384a9` and `90222373c1ff06a02509f0d811385c0571e398df`. Local files are in `scratch/runs/20261106-kknd-corpus-intake/`, alongside the two item metadata JSON files and `media-inventory.json`. These public URLs and hashes are recovery recipes; do not copy media into subsequent run evidence.

The DOS ZIP has21 files, including `KKND.EXE` (1059993bytes), HMI sound drivers, configuration, and LEVELS assets. Static examination finds the DOS/4G signature in its MZ entry. It belongs on the DOS route; no Win32 compatibility is inferred from an EXE extension.

Archive.org labels KKNDXT a Windows demo of Xtreme, the edition adding missions to the original. Its outer executable has an NE header at offset656. Python's ZIP reader sees only `setup.lid`; 7-Zip reports header errors and embedded `os.dat` with trailing data. Neither listing establishes a complete payload. Preserve the installer intact and use the supported Win16 installation route or a documented complete installer parser. Do not treat partial ZIP members as the installed game.

Intake involved metadata/download/hash checks and static container inspection only. No installer, game, emulator or browser ran. Registry integration and ordinary gameplay remain pending under `NEW-GAME-KKND-DEMO-20261106`.
