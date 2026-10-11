# Quake III Arena demo 1.11

Local-only app id `quake3_demo` (2026-10-10, w4). OpenGL only.

## Provenance and license boundary

- Installer `Q3ADemo.exe`, "Q3Demo v1.11 Win32", 3 Dec 1999, from
  [Jason2Brownlee/Quake3OfficialArchive](https://github.com/Jason2Brownlee/Quake3OfficialArchive)
  (`bin/Q3ADemo.exe`); the same 46.6 MiB file is on
  [archive.org](https://archive.org/details/QuakeIiiArenaDemo).
- 48,907,862 bytes, SHA-1 `95fb0e8f595506dd30b57635db151f2e0762be02`,
  SHA-256 `6af96cb1b5c97535c9923d8855ca85ec21b21b65b48738b2c5e674e17c65835d`
  (candidate `quake-3-arena-demo-installer` in `test/candidate-corpus/manifest.json`).
- The installer shows id Software's "LIMITED USE SOFTWARE LICENSE AGREEMENT"
  for "this game demo program entitled QUAKE III: ARENA". Section 3
  (Permitted Distribution and Copying): so long as the agreement accompanies
  each copy, a non-exclusive, limited right to copy and distribute the
  software free of charge for non-commercial purposes (magazine cover discs
  included); CD copies labelled "SHAREWARE" or "DEMO"; no commercial
  distribution. Section 2 forbids, among others, renting/selling,
  distribution outside section 3, and (j) publicly displaying the software.
  So it is a local candidate fixture, not a public deployment input, and it is
  registered in `LOCAL_CANDIDATE_APPS`.

## Install

The package is Installer VISE (MindVision); neither `unzip` nor `7z` opens it,
so the original installer runs in the emulator:
`node test/run.js --exe=.../Q3ADemo.exe --vfs-include=**/* --batch-size=10000 --control-stdin --frozen`.
Welcome -> Next (452,393); Software License Agreement (scroll the text by
clicking the scrollbar track at (568,250); Page Down only moves the caret) ->
Yes (452,393); destination `c:\Q3Ademo` -> Next; Ready To Install -> Next;
copying `demoq3\pak0.pk3` (46,853,694 bytes) takes ~50k batches at
`--batch-size=10000` (about two minutes); Finished. The 304-file `c:\q3ademo`
tree was exported from `ctx.vfs` with a control `eval` (keys are lowercase)
into `test/binaries/candidates/quake-3-arena-demo-installer/installed/`, and
`node tools/gen-installed-manifest.js <installed> quake3.exe` wrote the
303-entry `.wine-assembly-browser.json`. No registry state is needed.

## Running

- Main menu (SINGLE PLAYER / MULTIPLAYER / SETUP / DEMOS / CINEMATICS / EXIT)
  draws on both GL arms. Software GL (`--gl-renderer=software`) runs at about
  13 batches/s at `--batch-size=200000`.
- Straight to a map: `--args='+map q3dm1'` (Arena Gate, free for all,
  fraglimit 20). Loading (BSP, game media, items) takes ~8000 batches at
  `--batch-size=200000`; then the player stands in the arena with the machine
  gun, 100 health / 100 ammo.
- Input: keyboard through window messages and DirectInput both work; Up moves
  forward, Left turns, Ctrl fires (holding it empties the machine gun and the
  game switches to the gauntlet, "OUT OF AMMO").
- WebGL (`--headless-gl --gl-renderer=webgl --gl-census`), 8600 batches:
  33 distinct GL entry points, 6.57M GL calls, 297k packed draws, 3160 presents.
