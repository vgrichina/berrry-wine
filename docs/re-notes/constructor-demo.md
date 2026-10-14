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

## PSP contiguous resize correction (2026-10-14)

The next bounded original comparison confirmed the memory-error cause.
After releasing the block at 0443, the loader requested AH=4Ah on PSP 0100
with BX=FFFF. The parent reported 40448 available paragraphs despite a
retained four-paragraph block at 9EFC. Retrying that size returned success
but left the PSP MCB at 834 paragraphs: the PSP-specific resize path moved
the global frontier without consuming the adjacent free region.

The correction derives the current PSP size from its MCB, consumes only
adjacent free space when growing, returns a shrunk tail to the allocator,
and stops at the next held MCB. An oversized request grows to the contiguous
maximum and reports CF/AX=8/BX=that maximum, consistent with
[FreeDOS DosMemChange](https://github.com/FDOS/kernel/blob/master/kernel/memmgr.c).
No memory ceiling or guest byte changed.

Three new regressions prove grow/shrink/reuse, the maximum before a held
neighbor, and refusal to borrow disconnected free space. The exact previous
23670bef80 DOS module fails the actual-MCB-size assertion. All ten MCB
groups, eleven EXEC environment groups, EXEC boundary/resident, DOS files,
rename/termination, 24 path checks, native rename across four dispatch
variants, browser-bundle VM tests and bundle freshness pass.

The candidate original request now reports and actually owns 40443
paragraphs, preserving the block at 9EFC. It reaches INT 21h AX=4B03
(load overlay), then exits with **Bad format on exec**. The DOS handler
currently rejects EXEC subfunctions other than AL=00/01 with AX=1; AL=03
is the next concrete missing behavior. No protected-mode, menu or gameplay
claim follows from this progress. Both text captures were reviewed; all
28 original hashes match before and after each run. All 34 observed PID
and process-group checks were independently absent at release.

Evidence: scratch/runs/20261014T0106Z-constructor-psp-resize/. The matched
parent DOS module was loaded from immutable commit 23670bef80 through a
diagnostic Node require preloader; other runtime source files were unchanged.

## EXEC overlay loading and cache replacement (2026-10-14)

INT 21h AX=4B03 now loads an overlay at the caller's segment with the
independent relocation bias from ES:BX. It preserves the PSP, environment,
arena and caller control flow. MZ/ZM loading validates the declared body and
relocation table before any writes, excludes appended data, and refuses
out-of-range relocation targets or destinations. Flat overlays load at offset
zero with the DOS 0xFFFE transfer bound, matching [FreeDOS task.c](https://github.com/FDOS/kernel/blob/master/kernel/task.c).
Successful loading flushes translated code and releases live-uop heads so
reloading the same address executes the replacement bytes.

The eight API groups fail against immutable parent 56d339a15 and pass on the
candidate. Native reload tests return distinct 1234h/5678h values across all
four dispatch variants. Disabling invalidation produces the expected stale-code
failure. The live-uop variant installs a hot arithmetic head and releases one
head on replacement, then returns the second value. Its initial short fixture
installed no heads and failed the coverage assertion; that failure remains in
the evidence, and the corrected hot-loop fixture passes. The filename-based
unit tier includes the new test: tools/test-tiers.js --check reports 1892 files,
1484 unit, 402 e2e and 6 smoke. MCB, EXEC, DOS file/rename/termination, 24 path,
native rename, browser VM and generated-bundle checks also pass.

Original GAME.EXE now loads DOS4GW.EXE rather than printing Bad format on exec.
Its 30M-dispatch bounded run remains in real mode with a blank mode-3 display;
it has not reached a menu or gameplay. An enriched observer finds CS:IP
02CD:6309, CR0=10h, with no trap, unsupported opcode or protected-mode stop.
The initial observer's vm.get('ip') was an interpreter field; only the enriched
vm.get('gip') value is the guest IP. Both artifacts are retained.

Original disassembly identifies a search for duplicate IVT far pointers below
vector BFh. DS is genuinely zero (the instruction is not relocated). The scan
compares each earlier vector against later vectors and restarts after SI wraps.
Current initialization assigns every vector a distinct F000:(0100+vector)
target, unlike BIOS shared default IRET handlers. This is the next source-backed
conformance lead; no IVT change was included in this overlay correction.
AH=38h was unhandled once but is not established as the scan's cause.

Evidence: scratch/runs/20261014T0123Z-constructor-exec-overlay/. Original
28-file hashes remain unchanged. Parent error and candidate blank captures
were reviewed. The initial suite, enriched observer, failed coverage attempt
and passing hot-uop attempt have 60 independently absent PID/group checks.
No guest bytes, memory ceiling, RNG, browser or gameplay bypass changed.

## Shared default interrupt handler (2026-10-14)

The matched original observer confirms DS=0 and the duplicate-vector scan at
02CD:6309. The parent's IVT has distinct far pointers; its 1M budget expires
inside that search. BIOS initialization normally gives otherwise-unused vectors
a shared IRET handler, then installs service/IRQ handlers; see
[SeaBIOS ivt_init](https://github.com/coreboot/seabios/blob/master/src/post.c).
The emulator now supplies an actual shared IRET instruction for unused software
vectors, preserving all 18 implemented service vectors, hardware entries and
defined-but-unimplemented BIOS/DOS services on their diagnostic host paths.
The dispatch loop recognizes only the actual host-entry range. Hook detection
compares the complete far pointer, including guest hooks in the ROM segment.

Four API groups fail on immutable overlay parent 567dc3bb3 and pass on the
candidate. Four native variants prove flags, stack and BX preservation, DOS
get/set-vector save/restore, and guest-hook chaining through the saved IRET.
An actual INT13/AHFF also must reach both existing unhandled diagnostic counters;
the unused vector must not reach host service dispatch. Word-register and
protected-mode timer regressions, overlay reload including hot-uop release,
MCB/EXEC/file tests, 24 path groups, browser VM, bundles and tier checks pass.

The first native fixture failed: startup PUSHF was F203h and actual IRET returned
7203h, differing only in reserved bit 15. Two diagnostic attempts preserve that
finding. The corrected synthetic program explicitly POPFs valid 0202h before
setting carry and comparing full flags. The same corrected fixture is used for
the parent/candidate comparison; no emulator flag behavior changed.

Original GAME.EXE now passes the scan and exits after 306734 dispatches with
**DOS/16M error: [26] 8042 timeout**. CR0 remains 10h (real mode), with no trap,
unsupported instruction or protected-transfer stop. The next source lead is
the keyboard controller/A20 protocol, not a reason to patch the guest or skip
the extender's hardware check. AH38, INT15/BF, INT2F/16 and INT15/C0 diagnostics
are retained and are not yet established as this timeout's cause.

Both original runs verify all 28 hashes before and after. Blank parent and
candidate timeout captures were visually reviewed. All 66 observed PID/group
checks are independently absent. Evidence, including the initial failed fixture
and corrected suite, is in scratch/runs/20261014T0133Z-constructor-default-ivt/.
No protected-mode startup, menu, HQ or building gameplay has been established.
