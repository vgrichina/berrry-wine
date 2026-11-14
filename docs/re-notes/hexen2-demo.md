# Hexen II Demo (Raven Software / Activision, 1997)

App `hexen2_demo` (candidate `hexen-2-demo`), demo 1.11. On the public
desktop since 2026-11-13 by the owner's decision (`test/binaries/SOURCES.md`).
Starts with Quake-style controls: `lib/hexen2-modern-controls.ini` mounts as
`data1\config.cfg` and `lib/hexen2-autoexec.ini` (`+mlook`) as `autoexec.cfg`.
Registered 75a71cc30. Quake-engine game: data in `data1/pak0.pak` and
`progs.dat`.

**The bundled sublicence forbids reverse engineering**: debug it from traces
and runtime behaviour only.

## Source

- archive.org **`HexenII_1020` is mislabelled**: its `h2demo.zip` is the
  *Heroes of Might and Magic II* demo (`H2DEMOW.EXE`). Not used.
- The real one is a member of `win-98-games-e-j.-7z`, served directly as
  `.../Win98_Games-E-J.7z/Hexen2%20demo-SW-OpenGL.exe` (15334912 bytes,
  SHA-1 `dcb5ab7c…`): a collector's WinZip SFX holding the InstallShield
  setup plus an already installed `Install/Hexen2/` tree. The fetcher copies
  that tree to `installed/`.
- `HEXEN II SUBLICENSE.doc`: Activision, personal use of one copy, no
  copies, distribution or reverse engineering. It was localOnly for that
  reason until the owner chose to publish it anyway (2026-11-13).

## Two executables

- **`GLRoot/glh2.exe`** (OpenGL) is the registered route. It sits in
  `GLRoot\` next to a bundled `opengl32.dll` that is a **3Dfx Voodoo MiniGL**.
  The fetcher copies `glh2.exe` beside `data1\` *without* that DLL, so
  `LoadLibrary("opengl32.dll")` reaches our GL. (Like Heretic II and Kingpin,
  that load answers `0x00400000`, the exe's own handle; harmless so far.)
  It opens with an informational OK box ("GLHexen is a special, accelerated
  version…") only while `HKLM\Software\Hexen2` `Flag` (REG_BINARY) is
  absent, writing it as it shows; the registry seeds `Flag` so it never shows.
- **`h2.exe`** (software) loads SciTech WinDirect / PM Pro (`wdir32.dll`,
  `pmpro32.dll`, with 16-bit partners `wdir16.dll`/`pmpro16.dll`); both
  stop with MessageBox "Unable to link to KERNEL32.DLL!", presumably the
  16-bit thunk entry points. Not pursued.

## Route (headless, `--batch-size=50000`, `--headless-gl`)

No notice since the seeded `Flag`; the main menu is up by about b600. Enter at
900/1000/1100/1200/1300 goes Single Player → New Mission → class (Paladin) →
difficulty. The first load then shows "Meshing models/…" until about b7500:
GLQuake-style triangle-strip building for every model, very slow under
emulation (its `.ms2` cache would make later loads faster if it persisted).
First person as the Paladin by b8000; Right turns, Up walks. Evidence:
`scratch/runs/20261011T0830Z-hexen2_demo-gameplay-claude1863`.

Not looked at: the browser, combat, sound, the software build, why meshing
is so slow (worth a profile; Kingpin's level load has the same shape).
