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
the payload has been copied onto the dashboard host. At the initial preflight the
coordinator's `test/binaries/dos-games/constructor-demo/GAME.EXE` was absent;
see the 2026-11-01 recovery below for current local state. The dashboard now
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

## 8042 output port and A20 gating (2026-10-14)

Original DOS4GW file offset 29A1 waits for controller input-buffer-empty,
writes D1h to port64h, waits, writes the output byte to port60h, then waits.
The helper at29F8 tests status bit1 up to65536 times before reporting error26.
The emulator had no port64 handler, so its default FFh made IBF permanently
full; the matched parent records exactly65536 status reads.

The controller now consumes D0/D1 synchronously, reports IBF/OBF from its
state, and maintains an output latch. D0 queues a real reply; D1 consumes one
subsequent data byte. Keyboard bytes and the IRQ1 data latch survive controller
replies. A20 changes the actual address mask: off clears bit20 alone while
preserving higher address lines, on uses the existing16MB address space.
Existing XMS allocation/lock openBus calls use that same enable path, keeping
controller readback coherent. No memory size changed. Existing XMS03–06
nominal enable/disable/refcount behavior remains outside this change.

The first original attempt failed explicitly on command FFh. This is the
documented pulse-none command, so its no-op output behavior was added and tested;
unknown commands and CPU reset requests still fail explicitly. The command and
status definitions are supported by [QEMU pckbd.c](https://github.com/qemu/qemu/blob/master/hw/input/pckbd.c).
The initial failure and exact preceding source/test remain in the evidence.

Seven API groups fail on immutable parent68ac64f2b and pass on the candidate.
Native tests across four dispatch variants prove FFFF:0510 aliases0000:0500
when A20 is off and becomes distinct when on, while00300500 aliases00200500
rather than00000500. They also preserve the stored bytes across toggles.
Controller sequencing/status/readback, keyboard preservation, explicit failures,
and existing XMS allocation/lock interactions pass. IVT native/diagnostic checks,
word-register and PM timer regressions, overlay hot-uop replacement, allocator,
EXEC, DOS files,24 path checks, browser VM, bundles and tier checks pass.

Original GAME.EXE performs D1/DF then FF, leaves the output latch DFh with A20
enabled, and enters protected mode (CR0=11h). It stops after633142 dispatches
at the existing stuck-code guard, CS:IP=3C78:FFFFA7E2, without traps, unsupported
instructions or a protected-transfer stop. The mode3 screen remains blank.
The next issue is the far control-transfer/address state at that stop; there
is no menu, HQ or building-gameplay claim.

Both matched original arms preserve all28 hashes. The parent log records the
full8042 timeout; its reviewed console PNG visibly shows only the DOS/ prefix,
so the log is the complete text evidence. The candidate reviewed PNG is blank.
All92 observed PID/group checks are independently absent. Evidence:
scratch/runs/20261014T0141Z-constructor-8042-a20/. The corrected suite contains
21 passing commands including the expected parent API failure.

## Protected near-branch target width (2026-10-14)

A passive observer on controller checkpoint50544aa9e captured a valid protected
D=0 CS descriptor: selector3C78, base1348E0h, limitB2FFh. Execution went from
offset95EAh to FFFFA7E2h in one handback. The decoder then refused bytes FEFF
at the incorrectly wrapped linear address;202 repeated no-work handbacks
triggered the stuck guard. This was not a timed guest loop. The observer did
not resolve the individual branch inside that3630-dispatch handback.

decodeOne used its fetch-width helper for relative near-branch destinations.
Protected D=0 code needs wide fetch offsets when its descriptor allows them,
but a16-bit near transfer truncates the target independently of that fetch
width. The correction separates target width for JMP rel8/16/32, ordinary
Jcc rel8/16/32 and CALL rel16/32, including66 overrides. CALL return fixups
match the pushed operand width. Fetch and untaken conditional fallthrough
remain wide; LOOP and JCXZ are unchanged. See [Intel volume2A JMP/Jcc/CALL](https://cdrdv2-public.intel.com/812383/253666-sdm-vol-2a.pdf).

Four decoder groups prove16-bit underflow/overflow,66 overrides in both
D-bit defaults, high-EIP D=0 fetch and wide untaken fallthrough, and the
16-bit CALL return fixup. The unchanged test fails on parent50544aa9e.
Four native dispatch variants execute protected16-bit backward/forward
wrapping jumps and a wrapping CALL/RET, verifying the reached code and result.
The existing8042 native aliases, IVT hook/diagnostic checks, overlay hot-uop
reload, PM timer/word-register, allocator, EXEC, DOS file/path, browser VM,
bundle and tier checks all pass (22 commands including expected parent failure).

Original GAME.EXE now prints the reviewed **DOS/4GW Protected Mode Run-time
Version1.97** banner. It remains in mode3 with CR0=11h and spends the30M
dispatch budget without a stuck, trap, unsupported-opcode or protected-transfer
stop. The hottest observed entries are80:323E,80:06FC and80:0954, about31K
each; the final address is80:0C34. This budget stop is not evidence of a freeze,
and no menu, HQ or building gameplay has been established.

All28 original hashes match before/after both arms. Parent blank and candidate
banner PNGs were visually reviewed. All48 suite PID/group checks and the six
earlier passive-observer checks are independently absent. Evidence:
scratch/runs/20261014T0151Z-constructor-near-width/; the prior passive capture
is included as its pm-stop subdirectory. No guest state, RNG, memory size or
stuck-guard behavior was patched.

### 2026-10-14: EXEC preserves held DOS allocations (UVCONFIG)

The unchanged 200M-dispatch / 30-second run on 11e8935 stopped at
41,597,432 dispatches after ordinary initialization and SFX loading, with
protected RETF type rejection at CS80:0C78 targeting selector005C.
This was not a budget freeze. Three captured code signatures independently
map CS80 offsets to DOS4GW.EXE file offset206324 + IP. The transfer sequence
at0C74 is operand-size-32 PUSH EDX, PUSH EAX, RETF; earlier instructions read
the callback offset/selector from ES:[DI+2]/[DI+6].

A separate bounded passive capture found valid shared LDT/GDT base110010h,
LDT limit3FFFh/access82h. Descriptor005C bytes6700741E00810000 describe a
286 TSS, so RETF correctly refuses it. The callback table at ES=A8,
base7E60h had instead been overwritten by the environment strings for
C:\.\UVCONFIG: the apparent offset is ASCII H=C: and selector005C is
the backslash. EXEC chose environment07E6 because allocTop equaled the DOS
ceiling, ignoring an existing128-paragraph allocation at07E6. It replaced
that tracked block with a4-paragraph environment and put PSP07EB inside it.

EXEC now searches a whole environment/MCB/PSP/minimum-image gap that excludes
every held block and its header. Child max allocation stops at the next held
MCB. Existing free holes are split around the reserved interval, and the
global high-water mark stays above live allocations. The legacy imageTop
fallback for never-shrunk launcher stubs remains; this is not a wholesale
redesign of EXEC allocation strategy. RETF validation is unchanged.

Four added groups in the already-tiered exec-boundaries test cover the
default-ceiling held block, fragmented gaps and max-allocation cap, atomic
no-fit failure, load-only placement, and subsequent allocation refusing to
hand out child/held bytes. Parent11e8935 fails the held-block assertion;
candidate passes all8 boundary groups and the21-command suite of existing
allocator/EXEC/path/interrupt/8042/IVT/overlay/near-width native regressions,
bundle regeneration/reproducibility and tier membership.

The original now reaches43,307,267 dispatches and exits without a protected
transfer stop, trap, stuck guard, or unsupported operation. The reviewed
console capture reports "No Graphics hardware detected by UniVBE! (0x0)";
the framebuffer is blank. This is a graphics-detection failure, not verified
menu/HQ/building gameplay. All28 original pins remain intact. Independent
cleanup found6 PID/groups absent for each passive run and46 for the suite.
Evidence: scratch/runs/20261014T0205Z-constructor-exec-held (when disk guard
permits export); remote /home/user/constructor-exec-held-evidence-20261014
contains the prior startup-progress and RETF-stop captures, scripts, pins,
bounded logs, images and cleanup receipts. Port counts are limited to60/64/92;
the first passive observer did not capture LDT fields, corrected in the
second by using generated mget_ldtb/mget_pm_ldt_* exports.

### 2026-10-14: graphics contract and optional Trident experiment

Source3415419, unchanged original GAME launch: the passive default-VGA run
repeats43,307,267dispatches, UVCONFIG exit6 then parent exit1. Parent issues
three successful VBE4F00 queries and mode-info queries100/101; child issues
two more successful4F00 queries. All controller replies are0102. There are
no VBE mode-set or protected-interface requests before failure. Capped port
census shows chipset probes and PCI configuration scanning; not a VBE query
failure. The host returns unsupported chipset BIOS queries unchanged.

Static GAME.EXE file offsets (not runtime addresses) establish why simply
implementing VBE2 would not avoid this path. At034E2A bytes6A016A01 push two
true arguments, then034E34 calls0A2BCC with the path argument. That function
calls version-query0A28D8 at0A2C27. At0A2C57 it tests its second stack argument
[ESP+164h]; only if zero does it compare the returned version with0200h at
0A2C61 and return status2 for an existing VBE2 implementation. The sole
direct caller sets that ignore-existing-VBE argument to1. Later034F8A
checks a minimum runtime version0102h. Exact bytes/disassembly are in
game-graphics-branches.txt. Independently, the primary VESA2 specification
requires4F0A's32-bit protected interface: changing the advertised version
alone would be an inaccurate capability claim.
Reference: https://www.phatcode.net/res/221/files/vbe20.pdf (section4.13).

Two bounded original experiments select the existing documented
svga=trident option; emulator source and all28 original files remain
unchanged, no input or guest-state edits. Its existing API contract test
demonstrates CRTC1F readback and independently persisted64KiB banks through
sequencer0E, rather than just changing a vendor string. Both original runs
reach156,076,089dispatches: UVCONFIG returns0, parent reaches sound
configuration then exits1 with Problem reading SETSND.CFG. BUT generated
UVCONFIG.DAT and UNIVBE.DRV identify InteGraphics SuperVGA / IGA168x internal
DAC and clock, not Trident. This is evidence of incomplete hardware probing,
not validated graphics compatibility, and no graphics mode or gameplay was
observed. Retained generated files are host evidence only; they were not
installed into the original fixture or reused by a later run.

Current Trident implementation supplies a ROM identification string, CRTC
readback and one bank selector. It has no old/new extended-sequencer register
banks, chip-version read side effects, or complete protected/extended
register and mode-programming model. Generic sequencer and CRTC indexes are
masked to0F/1F with writable array backing. UVCONFIG genuinely probes
extended sequencer A7/C5, which alias ordinary indexes7/5 here. That alias is
an observed model limitation; it is not yet proven the cause of the final
InteGraphics selection. Generated driver identities therefore prevent
accepting the option as a correct chipset solution. A bounded future
hardware correction must test chip detection rejection as well as accepted
chip identity, bank/window persistence, old/new register access, and actual
mode geometry/pixels; a full SVGA model is larger than an identity patch.

The original manifest has no SETSND.CFG. Its SETSOUND.BAT invokes
MUSIC/SNDSETUP.EXE in MUSIC then returns to the parent directory. Once
graphics hardware behavior is credible, the ordinary sound setup workflow
is the next legitimate way to create sound configuration; no synthetic
configuration or audio bypass was inserted.

Combined evidence scratch/runs/20261014T0217Z-constructor-graphics-contract:
default passive capture, two Trident captures, generated driver hashes and
bytes, static branches, existing-model conformance test and reviewed
console images. All22 independently checked PID/groups are absent.
No additional emulator change is proposed from these experiments alone.

## 2026-11-01 original fixture recovery and next executable dependency

Run: `scratch/runs/20261101-constructor-original-fixture-recovery/`.
Static/acquisition assignment only; Urban owns runtime/source/build. The fresh
public `DESKTOP_APPS` export in `lib/apps.js` has 46 entries and no Constructor
entry (full list, source hash and HEAD retained in `public-list.json`). This
checks the current public picker definition, not a remote deployed website.

The exact original URL above returned HTTP 200 after one Archive redirect in
5.193630 seconds, with no retries. Actual downloaded bytes are **32,062,553**
and SHA-256 **`5d764f6d2f536d6aae6fd18122bc9bf2be20e84f101cbcdeafb1bcbd20eeed18`**.
Every ZIP member was checked before persistence: no absolute/traversing paths,
backslashes, drive prefixes, symlinks or special files; the 28 regular names
exactly equal the checked-in manifest. ZIP CRC, size and SHA-256 checks pass
for every file, totaling **63,205,318 bytes**. Directory names/case are original;
the five `DATA.FIL` resources and both `DOS4GW.EXE` paths remain separate.
`GAME.EXE` matches `d0ac2f05b9a813dc723f170f7418fbfd9af269abcbce8905062c3b63f27dc587`;
its MZ/LE identity and original sound-setup batch also match the earlier notes.
No substituted executable, generated configuration or retail payload was used.

The complete fixture is now persistent at
`test/binaries/dos-games/constructor-demo/`, with all 28 local sizes/hashes
rechecked after writing. Transfer waited for Urban's exact author
`2026-11-01T20:42:58+00:00 RELEASE runtime/source/build` statement, terminal
receipts and direct absence checks of its reported runtime PIDs. Free disk was
about 2.18 GB before transfer and **2,113,626,112 bytes** immediately afterward,
above the 2 GB floor. No thresholds or other owners' artifacts were changed.
Only the verified payload persists; the downloaded archive's own tmpfs copy
was removed after local verification. The two bounded release-watch helpers
were explicitly interrupted and reaped (exit130; actual waits84.975262 and
27.330045 seconds); the final watcher predicate/receipt accepts the explicit
author RELEASE without waiting for its later note-publication DONE. An initial
persist attempt failed before creating files because the `dos-games` parent
was absent; creating the required parent corrected this acquisition-only issue.

Current source review (hashes in `source-review.json`) changes the interpretation
of the early dependency list:

- `tools/toyvm/dos.js` `resolvePath`/`hostKey`/`hostPath` preserve relative
  directories and reject host symlinks. The old flat-basename blocker is
  historical. The existing pure-JS `test/test-toyvm-dos-paths.js` passes all
  24 groups across Node and both shipped bundles, including distinct resources.
  Reading all 28 restored files through the actual current `Machine` host API
  reproduces every manifest hash; a root `DATA.FIL` lookup correctly misses.
- The environment-MCB, contiguous PSP resize, EXEC overlay and held-allocation
  fixes described above are present. `test/test-toyvm-exec-boundaries.js`
  passes eight handler-contract groups without executing guest instructions.
  Static LE/DOS4GW detection is an identity/dependency fact, not evidence that
  DPMI absence is the next failure. The historical original reached UVCONFIG;
  this assignment has made no current runtime attempt.
- `tools/toyvm/live.js` `bindInput` forwards absolute mouse coordinates, buttons
  and deltas to INT33 polling state, and `site.js` installs that binding. The
  earlier focus-only observation is historical. Existing mouse-input and
  chord-repair DOM/state regressions pass without guest/Wasm/browser execution.
  Callbacks, custom ranges and actual Constructor controls remain unqualified.
- **First remaining actionable compatibility boundary: credible UniVBE chipset
  detection and hardware behavior.** Current `vesaCallImpl` still reports VBE
  1.2, serves banked modes and omits 4F0A; `portOut` still masks sequencer
  indexes to 0Fh, aliasing A7/C5 to 07/05. The optional Trident model still
  consists of ROM identity, CRTC readback and bank selection, without the
  extended register model described above. These source facts preserve the
  relevance of the historical default "No Graphics hardware" exit and the
  optional run's wrong InteGraphics identity. The exact cause of that wrong
  selection is still unproven. Raising the VBE version or using the Trident
  option alone is not a justified repair.

Once the fixture is persistent and a future runtime assignment is authorized,
the existing CLI can mount its directory from the executable's parent:

```sh
timeout --signal=TERM --kill-after=5s 90s node tools/toyvm/run-dos.js \
  test/binaries/dos-games/constructor-demo/GAME.EXE \
  --dispatches=200000000 --seconds=30
```

This is a proposed bounded **default-hardware startup diagnostic**, unexecuted
here. It needs the ordinary ToyVM runner dependencies and serialized runtime
ownership; it does not need a replacement EXE or a new registry entry. The
existing focused graphics regression is `test/test-toyvm-vbe.js` (guest/native,
**not run here**): it checks served/refused VBE modes and rendered banked pixels,
but does not qualify UniVBE chip identification or extended sequencer banks.
A future hardware correction also needs focused detection/extended-register
coverage and the unchanged original startup. Only after credible graphics is
the original `MUSIC/SNDSETUP.EXE` workflow the next sound-configuration
dependency; `SETSND.CFG` is absent from this authentic manifest. No setup was run.

`node tools/toyvm-dos-corpus.js --check --only=constructor-demo` passes: 28 files,
60.3 MiB, generated metadata up to date. Its `extender,flat-fs-collision` labels
remain the stored static assessment; the collision label contradicts current
directory-aware source and the passing real-payload host API check. These labels
were not rewritten in this note-only assignment and are not new runtime results.

Recovery recipe from the repository root (only after the live runtime owner's
exact release and with disk staying above 2,000,000,000 bytes). Check ownership
first; preserve any existing destination. Keep the archive on tmpfs and persist
only fully verified members; no compilation container is involved:

```sh
constructor_stage=$(mktemp -d /dev/shm/constructor-original.XXXXXX)
curl --fail --location --max-redirs 5 --connect-timeout 15 --max-time 180 \
  --max-filesize 33000000 --retry 0 \
  --output "$constructor_stage/CONSTRUC.zip" \
  https://archive.org/download/CONSTRUC/CONSTRUC.zip
python3 - "$constructor_stage/CONSTRUC.zip" <<'PY'
import hashlib, json, os, stat, sys, zipfile
from pathlib import Path, PurePosixPath
archive = Path(sys.argv[1])
assert archive.stat().st_size == 32062553
assert hashlib.sha256(archive.read_bytes()).hexdigest() == \
    '5d764f6d2f536d6aae6fd18122bc9bf2be20e84f101cbcdeafb1bcbd20eeed18'
pins = json.loads(Path('test/toyvm-dos-corpus/files/constructor-demo.json').read_text())['files']
expected = {f['path']: f for f in pins}
assert len(expected) == 28 and sum(f['size'] for f in pins) == 63205318
dest = Path('test/binaries/dos-games/constructor-demo')
assert not dest.exists() and not dest.is_symlink(), 'Preserve existing files'
assert all(not p.is_symlink() for p in dest.parents)
def free():
    s = os.statvfs('.')
    return s.f_bavail * s.f_frsize
with zipfile.ZipFile(archive) as z:
    for i in z.infolist():
        p = PurePosixPath(i.filename)
        assert not p.is_absolute() and '..' not in p.parts
        assert not any(c in i.filename for c in ['\\', ':', '\0'])
        assert stat.S_IFMT(i.external_attr >> 16) in (0, stat.S_IFREG, stat.S_IFDIR)
    entries = [i for i in z.infolist() if not i.is_dir()]
    assert len(entries) == 28 and {i.filename for i in entries} == set(expected)
    for i in entries:
        f = expected[i.filename]
        data = z.read(i)  # checks CRC and complete decompression
        assert len(data) == i.file_size == f['size']
        assert hashlib.sha256(data).hexdigest() == f['sha256']
    assert free() > 2000000000 + 63205318 + 16*1024*1024
    dest.mkdir(parents=True)
    for i in entries:
        assert free() > 2000000000 + i.file_size + 1024*1024
        out = dest / i.filename
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open('xb') as stream:
            stream.write(z.read(i)); stream.flush(); os.fsync(stream.fileno())
        assert hashlib.sha256(out.read_bytes()).hexdigest() == expected[i.filename]['sha256']
assert free() > 2000000000
print('Verified authentic 28-file closure, 63205318 bytes')
PY
# After successful verification only, remove this acquisition's own tmpfs copy.
rm -- "$constructor_stage/CONSTRUC.zip"
rmdir -- "$constructor_stage"
```

Run-local acquisition headers/timings, all 28 verification rows, static source
pins, pure contract logs and actual helper waits are retained under the run ID.
No guest run, build, browser, boat, deployment, EULA, gameplay, FPS, audio or
qualification claim. Box ID/state/expiry: N/A; coordinator lifecycle untouched.

## Restored original default startup (2026-11-01)

Run `20261101-constructor-original-startup` executes the restored original
once on local native Node **v24.18.1**, after Urban's exact `058aed059` author
release, terminal launcher exit0 and fresh direct absence checks for all40
reported PIDs. The runtime/source/build claim was serialized; the other worker
was restricted to synthetic inspector tests. No source, test, registry or build
file was changed, and no project build was run.

**Observed boundary: UVCONFIG returns6 with “No Graphics hardware detected by
UniVBE! (0x0)”; GAME.EXE then exits1 at `0549:26EB`.** The CLI reports43.3M
dispatches (rounded),113802 handbacks and4.32 guest seconds, ending in mode3.
Its OS process exits0 because the runner completed normally; that is distinct
from the guest's failure. `startup.png` was emitted and visually reviewed: the
80x25 text console contains the graphics error followed by initialization/SFX
messages. Text overlaps on the first two lines, as recorded in both PNG and
console dump. There is no usable menu, intro or gameplay screen, and no inputs
were supplied. No FPS or audio result follows from the runner's counters.

Identity was pinned before guest execution and rechecked afterward:

- Source checkpoint `f23123e6cf47d9eaae1d939690a0ac0e141f0ee3`;378 actual
  source/support/manifest files match before and after. The existing default
  ToyVM tailcall module is generated in memory by the ordinary runner; this
  does not use `build/wine-assembly.wasm`.
- A scratch-only `--require` observer wraps the existing `compileWat`, hashes
  its original WAT and returned bytes, checks the source pins, and returns
  those same bytes. Before execution, actual module SHA-256 is
  `03495d5463de5ee69a82104a0d37d35e7ce9d2662c26f5d06278312c159e080b`
  (343736bytes); emitted WAT SHA-256 is
  `29bdf4e754aa46d8e2f083b5bbb8e9fb9c9f2725c4b2503a25b11786234dfbc0`.
  `actual-module.json` also records loaded JS hashes and compile options.
- All28 authentic files retain the manifest's exact sizes/SHA-256 values,
  totaling63205318bytes, including GAME.EXE's pinned `d0ac2f05...dc587`.
  The complete on-disk file set remains exactly those28 originals. Guest-created
  `settings/hang.log` and `settings/SYSTEM.INI` stayed in the in-memory overlay;
  no generated driver/configuration was persisted into the fixture.
- Freshly requiring current `lib/apps.js` yields46 public `DESKTOP_APPS`, none
  matching Constructor. Its source SHA-256 is recorded in `prerequisites.json`.
  Runner/compiler imports and `pngjs` resolve without installation. An initial
  inline prerequisite command had a syntax typo before imports; the corrected
  check passed before this sole original launch.

The actual command in `command.json` retains the documented default hardware,
`timeout --signal=TERM --kill-after=5s 90s`, `--dispatches=200000000` and
`--seconds=30`, adding only the identity observer and existing diagnostics:
`--trace-int --trace-fault --trace-entry=40 --trace-entry-regs
--trace-io=3c4,3c5 --report --text --png=.../startup.png`.
No alternate EXE, `--svga`, VBE-version substitution or guest patch was used.

The trace narrows the dependency beyond a generic VBE failure. All five
controller queries `INT10/AX=4F00` and both mode-info queries (100h/101h)
return AX=004Fh. There is no4F02 mode-set or4F0A request. The original EXECs
`./UVCONFIG.EXE` (309382bytes) with `-gen -p.\settings\`; the child returns6
via `INT21/AX=4C06` from `0EFE:0163`, resuming the parent at `0549:10B7`.
The parent's4D00 call obtains6; its final4C01 is at `0549:26EB`.
Missing-file diagnostics for settings/univbe.drv and settings/UVCONFIG.EXE
therefore do not mean the packaged root UVCONFIG was absent or never ran.
Other unhandled-call/decoder diagnostics remain in the log; none is established
as the causal failure by this run.

At41.6272–41.6278M dispatches the child probes sequencer indexesA7/C5 through
port3C4 and reads/writes3C5 using helpers `2B5D:0001`/`2B5D:0028`. C5 readback
follows writes0/FF; A7 receives87. Current unchanged source masks the index
with0Fh, so these accesses address07/05 internally. This is an observed probe
sequence plus a source-backed aliasing fact, **not proof of a chipset identity
or of which conditional makes detection fail**. In particular it does not
validate the historical optional Trident/InteGraphics selection.

The first remaining dependency is a graphics hardware/register model that the
original UniVBE detector can correctly recognize and then drive. The justified
next diagnostic is to map the caller and conditional branches around this
A7/C5 probe sequence in the original UVCONFIG code, correlating expected
readbacks with the captured values. Use that decision to specify a focused
extended-register/alias regression before implementing hardware behavior.
Do not infer a vendor from successful readback or repair this by raising the
advertised VBE version. This task makes no further original attempt.

The matching recovery-run directory/path, EXEC-boundary and mouse contract
evidence was reused: all10 recorded source/test hashes still match, with four
small logs copied into this run and origin recorded in
`static-evidence-reuse.json`. No broad corpus rerun occurred.
`test/test-toyvm-vbe.js` was not run: the actual original already distinguishes
successful VBE queries from later detection rejection, and that mode-rendering
test cannot identify the failed chipset branch.

The supervisor caps logs at8000000bytes and stops the original at free disk
2020000000bytes. Actual output is147446bytes; minimum observed free disk was
2108801024bytes, no guard fired, and disk remained above2GB. GNU timeout owned
the Node child and reaped it; the Python supervisor actually waited for timeout
PID4171289 (exit0, total4.739611s, final wait0.000111s). Its board watcher
PID4171288 received TERM and was reaped with exit-15 (wait0.001469s).
Node4171290, timeout, watcher and supervisor4171287 were directly absent after
completion. Separate publication-watch termination/wait is retained in
`publication-watch-oswait.json`. Shutdown of this task's own processes was
explicitly delegated; no coordinator/foreign runtime was stopped.

Recovery: keep the authentic fixture untouched and use the earlier verified
archive recovery recipe only if it is actually missing, under new ownership
and the stated disk guard. No download occurred here. To inspect this result,
read `result.json`, `startup.log`, `startup.png`, identity manifests and wait/
cleanup receipts under `scratch/runs/20261101-constructor-original-startup/`;
regenerate no configuration and do not relaunch the original merely to view
the evidence. `run.py` is the bounded execution recipe, not authorization for
a second run. Local box ID/state/expiry: N/A. Browser, boat, EULA, deployment,
sound setup and ordinary gameplay remain unperformed.

### 2026-11-01 authentic UVCONFIG probe branches (static only)

Run `20261101-constructor-uvconfig-probe-branches` maps the retained original
startup to a concrete generic sequencer false-positive contract and the
subsequent exit6 memory gate. A7/C5 rejection alone is not the exit6 cause.
No original or emulator was executed, and no source, tests or build changed.
The I/O is observed; intermediate registers and branches below are reconstructed
from those observations and pinned executable bytes, not an instruction/stack
capture. Detector names are the executable's labels, not identified hardware.

Inputs: unchanged authentic28-file closure (63205318bytes), manifest
`test/toyvm-dos-corpus/files/constructor-demo.json`, and its309382-byte
`UVCONFIG.EXE`, SHA256
`3a37035f71c213d4dfff0b752415815584f49af1b156afc48f0255b2f993a815`.
The retained input is `20261101-constructor-original-startup/startup.log`
(147446bytes), with that run's identity/module provenance unchanged. Read-only
source input `tools/toyvm/dos.js` hashes to
`eb60e2775196edd80113836830a36482ac50a1d425f3e505d09c4bac68b0f4bc`.
`analysis.json` pins these inputs, the manifest's28 files, the ten matching
reused contract source/test files, recovery pin record, Python interpreter and
GNU objdump. No unchanged contract was rerun. `analyze.py` uses only Python
stdlib byte/trace assertions and `/usr/bin/objdump -D -b binary -m i8086 -M intel`
on entry-aligned slices; it never imports the emulator or executes guest code.

The MZ header is2A00h bytes with2403 relocations. For original segment S and
offset O, file offset is `2A00h + 10h*S + O`. This child's load segment is0EFEh;
add that to original segment operands. This gives the caller chain:

| Function | Original segment:offset | Retained runtime segment:offset |
| --- | --- | --- |
| main's detector call | 36BE:0872 | 45BC:0872 |
| initialization/detector wrapper | 07EB:DAAA | 16E9:DAAA |
| dispatcher called at DC90 | 07EB:BFFF | 16E9:BFFF |
| A7/C5 detector, called at C068 | 07EB:5B28 | 16E9:5B28 |
| indexed read / write / masked test | 1B76:0000 / 0032 / 01CE | 2A74:0000 / 0032 / 01CE |
| raw input / output entry | 1C5F:0001 / 0028 | 2B5D:0001 / 0028 |

Raw IN is actually at0009 and OUT at0031; the trace's `near` positions name
their entries. Far segment operands are relocation-checked in the executable.
Before detector dispatch,149F checks INT10h AX=1A00h VGA presence, including
AL=1Ah and display-type checks. The retained original reaches the probes; its
VBE query success does not establish a vendor-specific register implementation.

The shared masked test at2A74:01CE saves the register, writes
`saved & ~mask`, reads `clear & mask`, writes `saved | mask`, reads `set & mask`,
then restores the saved byte. At0244/0248 it rejects nonzero clear bits; at
024D/0250 it rejects set bits unequal to the mask. It returns AX=1 only when
both checks pass, otherwise0. Both C5 calls use mask00FFh. The retained30 I/O
rows at41.6272–41.6278M give:

| A7 state | Saved C5 | Write/read clear | Write/read set | Restored C5 | Test AX |
| --- | --- | --- | --- | --- | --- |
| 00h | 00h | 00h / 00h | FFh / FFh | 00h | 1 |
| 87h | 00h | 00h / 00h | FFh / FFh | 00h | 1 |

Detector5B28 is tag0Dh, whose string table says **Macronix** (pointer table
file45770h, string46533h). It saves A7, writes00h, tests C5 at5B95, writes87h,
then tests C5 at5BBA. Three PCI searches can accept independently: vendor10D9h
with devices0066h,8888h,8625h; each AX != FFFFh jumps to5C65. The three retained
INT1Ah AX=B101h/CX=10D9h attempts and later A7 restoration are consistent with
all misses. PCI helper2B3B:0112 checks mechanisms1/2 then BIOS presence; an
absent PCI service is not itself a generic hardware defect.

Without that override, `analysis.json` records the computed file offsets and asserts
`83 7e fa 00 0f 85 74 02 83 7e f8 00 0f 84 6c 02` at07EB:5C55.
These decode to `CMP [bp-6],0; JNE 5ED1; CMP [bp-8],0; JE 5ED1`.
Thus the required pair is **0,1**, not1,1. The captured pair takes5C59 to5ED1,
restores A7=00h, and returns AX=1 at5EE2 (continue searching). The dispatcher
compares AX with1 atC070. A preselected tag0Dh can skip this test, but this
trace contains both probes. No vendor identity follows from register aliasing.

The later26 I/O rows at42.9872–42.9877M match a different detector:
16E9:76E8, dispatched atC45F for tag17h. The executable labels17h **Hualon**
(table file45798h, string4659Bh). At7718/772F it tests EDh and EEh with00FFh;
772B/7742 jump to failure782D if either test returns0. Both captured tests
save00h, read00h after clearing and FFh after setting, restore00h, hence pass.
7749 stores tag17h. With memory unspecified,77B0 reads E7h; observed00h makes
`TEST AL,10h` at77B8 / `JE 77C7` take the256KiB assignment
`ES:[BX+4]=0100h` at77CA. A set bit would assign0200h at77BF.
The remaining calls0FFE/04C5 update mode/capability tables; the detector
returns AX=2 at7828. The dispatcher comparison atC467 therefore returns that
result viaC5C4 rather than trying later detectors.

Wrapper DC99 tests AX=2. DCA4 then compares memory `[+4]` with0200h
(512KiB); DCAA `JGE DCB2` is not taken for0100h. **DCAC sets AX=6** and
DCAF returns viaDE5F. In main,087A decrements the status and the six-word
switch at0BA0 maps status6 to089C (status1 instead maps088B, the distinct
no-supported-chip error). The status6 path reaches0981 `PUSH 6`,0983 far call
0000:505B, C-runtime cleanup5001, then0000:015A. At015C–0161, AH=4Ch and
AL=argument6 reach INT21h. This matches the retained child exit6 and
`0EFE:0163 AX=4C06`, then parent resumption0549:10B7. The parent's final
“No Graphics hardware” text alone did not distinguish this false detection
and memory gate from the child's no-supported-chip path.

The first demonstrated wrong **generic emulation contract** is unrestricted
sequencer writability exposing unsupported extension probes as successful.
In the pinned source, the default model is `svga='none'`;3C4 uses
`seqIndex=value&0Fh`,3C5 reads the16-byte array, and `vgaSeqWrite` unconditionally
stores the byte. Thus ED/EE become freely writable0D/0E, while E7 becomes07.
The observed A7/C5 aliases07/05 by themselves did not prove causation or
Macronix hardware. The later ED/EE probe and explicit memory gate identify
the concrete false-positive route. Making C5 obey an invented A7 unlock in
the default model would select another detector rather than establish a fix.

Proposed minimal next change: a pure-JS default-Machine contract regression
that performs the executable's save/clear/read/set/read/restore00FFh test
through3C4/3C5 for EDh and EEh. It must not report both as implemented writable
extensions with `svga='none'`; current code gives1,1 and fails that assertion.
The focused fix should make this test pass while preserving defined VGA
sequencer behavior (especially map mask and memory mode), register restoration,
and existing explicitly selected model contracts. Implementation belongs in
the model-specific index-decode/read/write policy in `tools/toyvm/dos.js`, with
normal generated copies afterward. Determine the unimplemented-register read
value and legitimate alias policy from the intended default adapter contract;
do not replace the16-byte array with256 writable registers or assume FFh reads
without that evidence. This task proposes the regression; no new-pass emulator
result is claimed. Further valid supported-SVGA detection, at least512KiB,
and its real memory/banking behavior remain prerequisites for successful
configuration. Neither a VBE version bump, E7 bit fabrication, speculative
Trident identity nor hardware/executable substitution follows from this map.

Evidence:15 focused `.bin`/`.disasm` pairs,14 pinned instruction-byte checks,
switch/label/relocation checks, line-numbered retained trace excerpts and
`analysis.json` in the named run. All28 fixture hashes and exact file closure,
all ten reused contract pins, and note whitespace checks pass. No broad tests
or build are appropriate for this documentation-only change. Original runtime
ownership was never acquired; local box/state/expiry N/A. Only this analysis
watcher's shutdown is delegated and directly waited, with cleanup receipts
retained. No menu/gameplay/FPS/audio/full27 conclusion is made.

### 2026-11-01 default sequencer contract repair

Run `20261101-constructor-sequencer-default-contract` repairs the demonstrated
generic false positive in `tools/toyvm/dos.js`. The input source is the exact
`d12f0d1e1` source, SHA256
`eb60e2775196edd80113836830a36482ac50a1d425f3e505d09c4bac68b0f4bc`.
No original game/configurator was executed, and its fixture was untouched.

The existing model declares default `svga='none'` to be plain VGA.
[IBM's September 1992 Video Subsystems technical reference](https://bitsavers.trailing-edge.com/pdf/ibm/pc/ps2/42G2193_PS2_Hardware_Interface_Technical_Reference_Video_Subsystems_Sep92.pdf),
printed page 2-45, figures 2-25/2-26, defines sequencer address bits 2–0 and
five data registers, indexes 00h–04h. Higher address bits are reserved, with
unspecified readback. The register map does **not** specify data-port reads
at absent indexes 5–7. Consequently zero here is an explicit deterministic
ToyVM policy retaining the previous initial read value, **not** a hardware
measurement or an IBM guarantee. No FFh bus-read assumption is made.

The default now decodes three index bits, ignores data writes to absent
indexes 5–7 and reads those indexes as zero. Thus EDh/EEh decode to absent
05h/06h instead of writable backing slots 0Dh/0Eh. Defined register storage,
map-mask updates, memory-mode transitions and word OUT splitting retain their
existing behavior. The shared sixteen-byte storage and explicit selected
Trident four-bit decoding, XOR-2 bank writes, version/bank readback and CRTC
signature remain unchanged. This adds no chipset identity or memory claim.

`test/test-toyvm-vbe.js --sequencer-only` exercises actual `Machine.portIn`/
`portOut`, using the retained authentic save/clear/read/set/read/restore test
with mask FFh. Before the source change both default ED/EE probes report
clear=00h, set=FFh, writable=true, restored=00h; the regression exits1.
Afterward both report clear=00h, set=00h, writable=false, restored=00h and
all69 focused checks pass. Coverage includes omitted/default and explicit
`none`, other absent indexes, defined register bit tests/restoration, index
aliases, word OUT, actual planar/rechained pixel preservation, map-mask
controls, absent default vendor signature and selected-model negatives.

Full VBE passes102 checks, including its existing guest mode/banked-pixel
checks. Existing DAC-default, retrace and Node-only browser-bundle tests pass;
no browser was launched. The mandatory
`flock /tmp/wine-build.lock bash tools/build.sh` passes, including generated
bundle reproducibility. Both committed ToyVM bundles were regenerated normally.

Evidence retains the old failure, new passes, exact commands/waits, policy
reference, retained authentic trace/analysis, source pins and recovery recipe.
The95 pinned ToyVM/support/generated/test files are unchanged during tests;
the compiler observer records actual module bytes and synthetic COM hashes.
VBE uses ToyVM module SHA256
`03495d5463de5ee69a82104a0d37d35e7ce9d2662c26f5d06278312c159e080b`
(343736 bytes); the repair is in host JS, so that module matches the earlier
startup's module. The mandatory project build is a separate artifact.

Only this generic contract is repaired. Supported SVGA detection, real
memory/banking and the original configuration remain unverified; no playable
Constructor claim follows. No E7 bit, model switch, VBE-version change,
download, deployment or broad corpus run occurred. Disk remained above2GB;
bounded task processes are waited/reaped and no foreign artifact is deleted.
Local box ID/state/expiry: N/A; coordinator lifecycle is untouched.
