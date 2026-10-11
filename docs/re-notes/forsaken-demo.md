# Forsaken demo (Acclaim/Probe, 1998, Direct3D 5)

App id `forsaken_demo`, candidate `forsaken-demo` (registered 2026-10-11, w5).

## Source and licence

- archive.org item `FORSAKEN_201610`, `FORSAKEN.zip`: 42,762,069 bytes, SHA-1
  `2b8083248a8772710a0ae446e3442ca2b1ac5aab`.
- The zip is the CD's installer: InstallShield 3 (`SETUP.EXE`, `_INST32I.EX_`)
  with the game in `DATA.Z` (37 MB), plus `DIRECTX5/` redistributables and
  `CHKINST.EXE`/`INSTALL.BAT`.
- **No licence text anywhere.** `readme.txt` (revised 1.27.98), `readme.rtf`,
  `release.txt` ("Forsaken Shareware Demo, Version 1.0") and the exe's strings
  carry no EULA or redistribution terms. Without an explicit grant the
  candidate is `localOnly`.

## Layout

`tools/is3-extract.js` unpacks `DATA.Z` (873 files). The fetch tool's
`is3Extract` post-extract step runs it. `7z` and `unshield` both refuse this
format. The extracted root holds `ForsakenDemo.exe` (3.7 MB), `a3d.dll`,
`biodome.dmo`, `forsaken.scg`, `data/` (levels `volcano`, `subway`) and `opt/`.
The installer's default path is `C:\Program Files\Acclaim\Forsaken Demo`.
The game also runs from `C:\`, which is how the manifest mounts it. Static
imports are system DLLs only: DDRAW, DINPUT, DPLAYX, WINMM, WSOCK32,
AVIFIL32/MSVFW32, ole32 and the core four. No registry seeding is needed.

## Route (headless, `--batch-size=200000`)

- Boot: a 3D attract flythrough, then the in-3D menu. The first frames are
  white before the menu draws.
- Enter at batches 300, 450, 600 and 750 selects Single Player Game, Start
  (level Volcano), and the level briefing with its loading bar.
- By batch 1050 the player is in the Volcano level, with the HUD showing
  LIVES 5, SHLD/HULL 128, POWER 1, PULS 2000, MUG 5 and the message "The
  volcano could erupt any minute, get outta here".
- Ctrl (VK 17) fires the pulsar: two green bolts, and PULS drops to 1998.
  Up (VK 38) changes the view. 'A' did nothing.

```
node test/run.js --app=forsaken_demo --no-build --quiet-api --quiet-blocks \
  --batch-size=200000 --max-batches=1260 --stuck-after=100000000 \
  --input=300:keydown:13,301:keyup:13,450:keydown:13,451:keyup:13,600:keydown:13,601:keyup:13,750:keydown:13,751:keyup:13,1050:png:ingame.png,1180:keydown:17,1182:keyup:17,1188:png:fire.png
```

## The bug it found

The level load creates about 300 execute buffers after many other DirectX
objects. Our execute-buffer cache table (`$D3DIM_EB_CACHE_PTRS`) was keyed by
`DX_OBJECTS` slot but held only 512 entries (out of `$DX_MAX` 8192). Every
buffer in a slot of 512 or above got E_OUTOFMEMORY from `SetExecuteData`. The
game reported "Mload : SetExecuteData Failed", then "RenderScene failed". The
fix gives the table its own `$DX_MAX`-sized region, and
`test/test-d3dim-execute-buffer-slots.js` covers it.

## Open

- The attract and menu frames look heavily over-exposed (additive blending
  saturates to white). The in-game frames look right. This has not been
  compared with real hardware.
- Movement keys beyond Up were not mapped. Forsaken's default controls are in
  `readme.txt` §VI.

Evidence: `scratch/runs/20261011T0420Z-forsaken_demo-gameplay-w5`.
