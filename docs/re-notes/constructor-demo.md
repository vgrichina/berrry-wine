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

## Initial ToyVM dependencies

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

## Directory filesystem source work (2026-10-14)

The initial basename blocker was reproduced with the real `Machine` file API
on `db2e8905a`: five synthetic directories containing different `DATA.FIL`
bytes all read the root `DATA.FIL` instead. Without a root copy they miss.
This is a filesystem defect, independent of the game's DOS/4GW startup.

The source change mounts `fileRoot` at C:\ and keeps complete relative names
through `openFile`, whole-file/EXEC reads, create, copy-on-write, temporary
files, delete, rename, attributes and FindFirst/FindNext. Case-insensitive
component lookup retains the existing trailing-dot/CP437 blank compatibility.
Slash and backslash separators, `.` and `..`, root-relative and C:-relative
paths resolve against an actual current directory. `..` at root stays at root;
host symlinks are outside the mounted namespace. AH=3Bh changes to an existing
directory; AH=47h returns it without a drive or leading slash. C: remains the
only mounted drive; another drive's paths fail and its AH=47h request returns
error 15. AH=0Eh reports three as the highest drive index plus one and leaves
C: selected for unavailable requests. Directory creation/removal and other
unimplemented services remain unimplemented.

Guest overlay keys now contain their directories. An open original-file handle
remembers its resolved path if cwd changes before a write. Writes do not mutate
host originals; deleting or renaming originals (including shadowed originals)
returns access denied instead of falsely succeeding or revealing old bytes.
Missing directories no longer alias root. Two old rename fixtures were adjusted
to create/use the directory they had previously expected to be discarded.
FindFirst stores a directory token in the DTA reserved bytes, preserving copied
and nested searches across cwd changes; repeated searches reuse directory tokens.
CLI `--save-files` preserves relative overlay paths and refuses traversal and
symlink destinations. Root-only callers retain root-only map keys.

The same fix includes both generated browser bundles and their filesystem shim,
the dashboard manifest validator and the browser loader. Ordinary files retain
their complete manifest paths. Ambiguous case/dot aliases, path traversal and
file/directory conflicts are refused. Previously declared `requiredOriginalFiles`
overlays retain their explicit `guestPath` (for example the original U4 save
templates); preserving these mappings does not restore implicit basename aliases.
Entry programs retain their manifest path too.

Validation is pure JavaScript: 24 filesystem/API groups across Node and both
shipped bundles, 15 existing temporary-file groups, 14 existing rename groups,
19 dashboard loader/server tests, and the overlay export contract pass. The
bundle reproducibility check and `git diff --check` pass. The required-original
file test's synthetic portion passes; its original U4 fixture portion is
explicitly skipped locally because that payload is absent. The initial sparse
bundle generation lacked `fonts/Terminal.fon`; adding the tracked font to the
isolated checkout resolved that setup failure before generation succeeded.

These checks execute no guest and establish no Constructor startup, input,
audio or gameplay result. The original 28-file fixture was not modified or
re-extracted. The catalog remains blocked pending actual original DOS/4GW
startup and browser mouse delivery, followed by the ordinary menu-to-HQ and
building-controls route. No demo limit was changed. A later serial runtime
validation should run `test/test-toyvm-dos-rename.js --native`,
`test/test-toyvm-dos-files.js` and `test/test-toyvm-browser-bundle.js`, then use
the pinned original Constructor fixture; those guest/native checks have **not**
run for this change.

## Environment-MCB startup blocker (2026-10-14)

The first original GAME.EXE attempt on full-path checkpoint 9a74aad7d
spent 200M dispatches in a blank mode-3 screen. Its two dominant INT 21h
return sites were 110:1089 and 110:22fa. Static MZ disassembly (96-byte
header) maps them to AH=49h free and the AH=52h list-of-lists wrapper:
the loader walks MCBs, frees blocks owned by its PSP except retained blocks,
then restarts the walk.

A bounded observer confirmed 5,714 AH=49h calls for ES=0060 paired with
5,714 AH=52h calls in just 1M dispatches. The environment MCB owner stayed
0100 after every purported successful free. installArena wrote the initial
environment's header, but never enrolled it in memBlocks; AH=49h therefore
did nothing, and mcbSync reconstructed only the arena above the PSP.

The fix enrolls the initial environment as an ordinary allocation and
reconstructs the arena from that block while preserving the intervening
DOS-owned block. It permits real freeing, splitting, reuse and coalescing.
The focused old-code regression fails on the unchanged owner; the candidate's
seven MCB groups pass. EXEC environment/boundary/resident tests, DOS
files/rename/termination tests, and all 24 pure-JS full-path tests pass.
Two existing EXEC failure tests now compare allocator snapshots rather than
assuming the initial environment is absent from the allocation map. The same
updated EXEC fixture also passes against the parent. Both browser source
bundles were regenerated and pass freshness checking.

The original candidate now frees segment 0060 once, changing owner 0100 to
zero, and makes only three list-of-lists calls. It then exits with the visible
message **Not enough memory on exec**, before any AH=4Bh call. It has not
reached DOS/4GW protected mode, a menu, HQ, or building gameplay. This is a
resolved startup loop and a newly exposed loader-memory blocker, not gameplay
support. The next bounded diagnostic should record AH=48h/4Ah requested and
returned sizes, carry flags, MCB boundaries and the loader's required size;
do not increase memory or bypass the guest check.

Both runs hash-checked all 28 originals before and after. No guest changes,
memory/RNG patches, input injection, browser run, or silent service stub was
used. The old arm had a 1M-dispatch bound and the candidate a 30M bound;
the latter exited early. Captures were reviewed: blank parent and the
candidate's memory-error text. Evidence, including the initial fixture
failure, corrected tests, process cleanup and bounded observer, is in
scratch/runs/20261014T0055Z-constructor-environment-mcb/. The tested source
depends on the still-separate full-path change 9a74aad7d. The initial
investigation's unmet mouse/gameplay requirements still apply.
