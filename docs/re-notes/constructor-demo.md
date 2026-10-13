# Constructor (1997) original DOS demo

Requested in Telegram message 63 from
<https://x.com/oldyzach/status/2110085411389469074>. The acquired release is the
original 20-minute demo, not the retail game or a remaster. Although the Archive
item labels it Windows, this package's executable is DOS. No native Windows
demo has been verified.

## Original media and executable

- Source: <https://archive.org/details/CONSTRUC>
- Package: <https://archive.org/download/CONSTRUC/CONSTRUC.zip>
- ZIP: 32,062,553 bytes; SHA-1 `c5ad871e252035b91a1d97e38f48cf153b5e51af`;
  SHA-256 `5d764f6d2f536d6aae6fd18122bc9bf2be20e84f101cbcdeafb1bcbd20eeed18`.
- Extracted payload: 28 original files, 63,205,318 bytes, preserving directories.
  Every file is pinned in `test/toyvm-dos-corpus/files/constructor-demo.json`.
- `GAME.EXE`: 994,161 bytes;
  SHA-256 `d0ac2f05b9a813dc723f170f7418fbfd9af269abcbce8905062c3b63f27dc587`.
  Starts with MZ; `e_lfanew` is 10,832 and the four bytes there are `4c450000`
  (`LE`, not `PE`). The existing scanner identifies external DOS/4GW; the
  original package supplies `DOS4GW.EXE`.

The payload is an ignored local fixture. On `bx_yqnspudj`, acquisition and
source-only scan artifacts are under
`/home/user/constructor-preflight-20261013/`; the extracted tree is under
`corpus/test/binaries/dos-games/constructor-demo`. Local metadata does not imply
the payload has been copied onto the dashboard host. The coordinator's
`test/binaries/dos-games/constructor-demo/GAME.EXE` is absent. The dashboard now
checks the local entry of blocked titles too, reporting this missing path
separately from the retained compatibility blockers. That presence check is
not a full payload hash verification.

## Intended original route, not observed gameplay

`README.TXT` explicitly identifies a twenty-minute timed demo and instructs
running `GAME` from its installation directory (`C:\CN`). Press Enter through
the splash screens, choose PLAY GAME, select a team color and enter a player
name, then ACCEPT. The documented scene begins at HQ with foremen. Its first
construction task is laying the lumber yard foundation, assigning a work gang,
then staffing the completed yard to produce wood. These are instructions from
the original media; none of those screens or actions has been observed here.

## Current ToyVM dependencies

The source assessment uses main `2d4ca864e` and the existing
`tools/toyvm-dos-corpus.js`, without executing a guest:

1. **Directory-aware file access:** five distinct original resources are named
   `DATA.FIL`, in `DATA`, `FLICS`, `GFX`, `LFX`, and `SFX`. Their sizes and hashes
   differ. ToyVM's `tools/toyvm/dos.js` `hostPath()` drops directories and looks
   up only the basename. Flattening this payload loses required assets. The
   duplicate root and `MUSIC/DOS4GW.EXE` is a second basename collision.
2. **Title-specific extender qualification:** `GAME.EXE` uses external DOS/4GW.
   The generator retains its unqualified extender assessment. ToyVM has paging
   and has reached protected mode for other programs; this is not a claim that
   every protected-mode game is unsupported or that DPMI caused a failure.
   Constructor has no native attempt or observed startup failure yet.
3. **Browser mouse delivery:** the current DOS browser route wires keyboard
   input; its canvas pointer handler focuses the canvas rather than forwarding
   guest mouse coordinates/buttons. CLI INT 33h support alone does not supply
   the original README's mouse-driven menus and construction controls.

No CD-ROM or VBE 2.0 requirement was inferred merely from the game's age or
platform. No silent service stubs, guest changes, or renamed resource workaround
were used. The shared DOS dashboard row links provenance and these notes and
remains blocked with no launch route or gameplay claim.

## Validation

The original archive was extracted and scanned on `bx_yqnspudj`. The selected
generator and `--check --only=constructor-demo` agree. All 28 file sizes/hashes
are recorded, including the LE program and distinct resource files. The existing
22 corpus scanner/assessment checks pass. Dashboard view-model validation checks
the Constructor row, provenance, file list, notes, missing local payload, and
absence of a launch URL. All 14 dashboard corpus/view tests pass, including a
regression that adds a missing blocked entry and confirms compatibility remains
blocked even once the local entry exists. Initial sparse-checkout dependency
failures were resolved by including the original dashboard modules and rerunning.
Source-only receipts are retained in
`scratch/runs/20261013T2354Z-constructor-corpus-preflight/`.
No emulator, build, or browser was launched; screenshots, audio, performance,
gameplay, and saving remain untested.
