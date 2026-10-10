# Deus Ex: Invisible War demo

Original media: `test/binaries/win98-games-a-d/DeusEx Invisible War-D3D`.
All 16 local files (236357810 bytes) were hashed and transferred unchanged to
`bx_hx8msa33:/home/user/deusex-iw-media-20261010`. Source identity inventory:
`scratch/deusex-iw-20261010/selection.json` and the self-contained first run
`scratch/runs/20261010T1527Z-deusex-iw-startup/selection.json`.

InstallShield version 7 cabinets are readable by `tools/is-cab.js`.
Extraction verified MD5 and lengths for 816 entries. Descriptor 31,
`setup.skin`, failed verification: do not report a complete installer.
Conflicting setup resource filenames were preserved separately under
`.conflicting-entries/<index>/`; identical duplicates share a canonical file.
The receipt records every entry, conflict and failure. No installer or licence
dialog was answered.

The game executable `DX2.exe` is 6090752 bytes, SHA256
`da394a4b5eb6254d9bee648b4bb1bee557b516cca61bb24b55020d29bab72f46`.
Its direct imports are DInput8, D3D8, DSound and Windows APIs; no original
non-system DLL appears in its direct import list. Extracted files remain on
the boat at `/home/user/deusex-iw-extracted-20261010`. There is no local corpus
registration or public deployment.

## Reconstructed virtual layout

The archive directory tree is not the installed tree. The original
`Default.ini` refers to `..\Content\DX2`; EXE strings refer to
`..\System\Shaders`. Use `C:\System\DX2.exe`, working directory
`C:\System`, and these tested mounts:

- `DX2/*` -> `C:\Content\DX2\*`
- `Data/*` -> `C:\Data\*`
- Remaining canonical files -> `C:\System\*`

This is an investigation mapping, not proof of every install destination.
The startup probe mounts 808 canonical files eagerly; a required/lazy policy
is not yet qualified. Keep original config and executable bytes unchanged.

## Startup evidence, 2026-10-10

Browser: headless Chrome 151, default WebGL/guest Worker, 1000x800, no inputs.
Source `cedee9b54`; module SHA256
`c43dd314eb864e55c395c0617cfc89e51a018613e8ae3aba7f2c45fde58ea5e6`.

- `20261010T1527Z-deusex-iw-startup`: flat archive mounts reach a game window,
  then the generic “Flesh failed to initialize” message.
- `20261010T1530Z-deusex-iw-layout`: System/Content reconstruction reads the
  original configuration and many content files. File tracing identifies the
  missing `C:\Data\Normalize.dds`; it had been mounted under System/Data.
- `20261010T1532Z-deusex-iw-data-root`: corrected Data mount reads the entire
  original texture (1572992 bytes), then immediately shows the same error.
  Browser closed normally at 15:34:19Z.

`Data/normalize.dds` SHA256 is
`d2a3eec5d57593fe5ee5bd840d71cca958826f4813908689e7ea5e0bb708f27d`.
Its DDS header reports 256x256, 32-bit RGB, caps `0x1008`, caps2 `0xFE00`
(cubemap/all faces), and no mip count. The failed texture lookup is resolved;
do not repeat downloads or infer a missing texture from the generic message.
Next, trace the DDS load return and D3D8 cubemap/device initialization directly
after that read. A graphics capability or implementation defect is not yet
established. No menu, player-controlled gameplay, audio or FPS is qualified.
