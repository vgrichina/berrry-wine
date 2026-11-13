# Original Worms SETUP first text screen and SETUP.CFG path

2026-11-13 — **NO_NATIVE_RESULT**. Original SETUP reaches a text-screen drawing
routine **before** attempting SETUP.CFG. The later save path proves an ordinary
DOS zero-length-write truncation dependency; actual ToyVM source did not shorten
the file. A two-line general host correction and six pure tests remain
**uncommitted WIP** pending authorized focused runtime verification and locked
build. Only this note is committed. No menu selection, configuration contents,
installed output, screenshot, native startup or gameplay result is claimed.

Evidence: `scratch/runs/20261113-worms-setup-screen-2200/`. The exact existing
entry note is [worms-original-setup-entry-cd-path-20261113.md](worms-original-setup-entry-cd-path-20261113.md),
not the differently named task reference. The
[reset-host analysis](worms-original-reset-bridge-host-boundary-20261113.md)
concerns a conditional DOS4GW protected/real bridge; it is not an established
prerequisite for this standalone real-mode SETUP first screen.

## Byte identity and static scope

All addresses below are SETUP load-image offsets, file offset = image +50h.
MZ relocation makes DS=S+08D2h; DS:d maps to image 8D20h+d. The entry remains
26B2→275B→28AD/68C0→68CE/0014, with initializer dispatch at28AA/692C.
Prior sealed entry and reset-host evidence was verified in place.

One additional authorized recovery used the prior Mode1/2352 helper, redirected
to this run's receipt directory. It requested raw BIN sectors169–188:
HTTP206, **Content-Range `bytes 397488-444527/578432064`**, length47,040,
identity encoding, every sector sync/mode validated. The extracted member was
exactly39,746 bytes, full SHA-256
`92805b6402fb28b8b6d07e57038ce97d9939fd6febbdb9c5c7dde639c62b0771`.
Only after that check were bounded windows disassembled. No retries, full CD,
member file, source archive or `/home` media staging occurred. Original member
buffers and objdump memfds were removed; `ram-release.json` records normal
completion. New windows plus reused windows cover12,007 unique image bytes,
not a retained complete executable. `windows.json` records offsets/bytes/hashes.

GNU timeout independently bounded the recovery process to900 seconds and the
board watcher to1,800 seconds; pure test commands had30-second deadlines.
No box was created: ID **none**, state **NOT_CREATED**, expiry **null**, stop
receipt **N/A**. No CPU engine, Machine constructor, guest, VM, WASM module,
native/browser/game execution or full build ran. Disk was below1.5GB; no workers,
capacity/reserve changes or general cleanup were performed.

## First visible drawing, before config or drive selection

Main0014 sets text-memory offset DS:189A=0 and segment DS:189C=B800h, then
calls0300 at0053. The apparent monochrome test at0031–0044 reads a **byte**
from DS:0063, clears AH and compares AX with03B4h. On these original bytes the
comparison cannot match, so the B800 branch follows. This is not a BIOS-data-area
word read at physical0463, and does not justify altering the original program.

| Original edge | Concrete effect |
|---|---|
| 0303/030C→114D→1161/2696 | Frame AX=0002, interrupt selector10h: BIOS video mode2. The adapter's AX=0010 is the interrupt number, not video function10h. |
| 030F–0313→0F67→104A | x=0,y=0,width-limit79,height-limit24; inclusive loops write character B1h with attribute7Fh across80×25 text cells. First cell is physical B8000/B8001. |
| 0316–0324→0DFF | Original box drawing uses x=2,y=1 and supplied74/3 dimensions, attribute17h; it calls direct text-cell/attribute writers104A/107B. |
| 0327–0333→0FAF | DS:04EA literal **`Worms! CD Installation.`**, x=5,y=2, attribute1Bh. |
| 0336–0342→0FAF | DS:0502 literal **`(C)1995 Team17 Limited`**, x=51,y=2, attribute1Bh. |
| 0345→02FC…RET | Returns to0056; only then does0059 open SETUP.CFG. |

The direct helpers calculate `segment:offset = [189C]:([189A]+160*y+2*x)`.
104A writes the character and current DS:0A68 attribute;0FAF writes a NUL-ended
literal with the supplied attribute. This is a concrete first-screen construction,
not an observed framebuffer. A display requires the mode/page/text-memory path
to work and startup initializers to return; it does not require config success,
a drive-space answer, keyboard input, MSCDEX, DOS4GW or protected WRMS execution.

Current `tools/toyvm/dos.js` int10 accepts mode2, resets VGA/text-page state and
selects page0. `setTextPage(0)` selects B8000; `newConsole` accessors read that
same memory. The first drawing uses no BIOS character-print service. The
framebuffer selector supports text when VGA bpp=0. Source agreement establishes
the necessary host data route, not actual visible pixels, font/blink fidelity or
an executed screen. The conditional FPU initialization/lazy patching detailed
in the entry note remains a separate pre-main context; software-FP support must
not be assumed from its hardware branch.

## Config open/read and subsequent UI boundary

At0047 DX=03BB, the retained `rb` mode. Screen code preserves DX through its
calls. At0056 AX=03BE (`SETUP.CFG`);0059 calls1CE7, which sets BX=0 and calls
1CD0→1C1B. Mode parser1B77 resolves `rb` to stream bits41h. The read branch
sets the low DOS access bits to0 and binary flag0200h, then1C8B calls296D.
At2998–299A it invokes **INT21/AH3D**, DS:DX=relative path, AL access0.
This is the current DOS directory at that time, not a proved installed path.
Failure yields stream pointer0; it is not distinguished as “missing config”
versus another open failure by main.

On success,0060 branches to024A. At0255→1E6F, registers are AX=189E,
BX=1,DX=005E,CX=stream: request **94 bytes**, not merely the first eight.
The binary stream code uses existing buffered bytes, direct373E→INT21/AH3F
at3745, or a refill at2320 (not newly resolved here). A normal non-device stream
gets a200h-byte buffer through36E1; a94-byte request can therefore use the refill
branch. This task establishes the direct DOS read wrapper and the bounded
stream branch, without pretending that the omitted2320 body was traced here.
Main does **not** check the fread return count at0258. It copies four words:

| Source | Runtime destination |
|---|---|
| DS:189E | DS:1902 |
| DS:18A0 | DS:1904 |
| DS:18A2 | DS:1900 |
| DS:18A4 | DS:18FE |

The remaining86 bytes are part of the same transfer. No checksummed/versioned
format, valid configuration values, semantic field names or required complete
94-byte file are inferred. A short read is not promoted to a valid configuration.
At0272 it closes via1FE5→2007→2092. The close path may query position through
37EE/6B2B (6B2B not newly resolved), adjust buffered position via3834/AH42,
and invokes3874→INT21/AH3E at387D. Stream seek branches are conditional.

On open failure SI=0,0064 calls0409. The first space query0428→2450→245A
uses **INT21/AH36, DL=3**. The installer then calls0BB1 at0070 with its actual
DS:0A42 pointer table. That routine draws using direct text helpers, calls1522
with BIOS INT10/AH02 cursor positioning, and reaches0C92→1167→117D/2696 with
**INT16/AH00**. No selected drive, menu answer or input sequence is supplied.
A returnFFFF from0BB1 takes the original termination path; no successful choice
is assumed. Success of the initial config open skips this drive-selection path.

Both main routes eventually reach0275, which calls094E to draw current settings
and0BB1 again with DS:09BC. At02A0–02AA the program increments the returned
index, bounds it to0..5 and uses the original CS:0008 table. Its fifth table
slot points to02D1;02D4 calls0347 and marks the exit flag afterward. This is
the proved save edge. No user-facing choice name is attached to that slot.

## Save service and narrow host repair

0347 supplies DS:0519 **`wb`** and DS:03BE **`SETUP.CFG`** to1CE7. It copies
the four runtime words back into189E..18A4, then0379 calls2119 with
AX=189E,BX=1,DX=005E,CX=stream: write94 bytes. At037E it closes through1FE5.
Main does not check the open or write return here; this is a path, not a claim
that a file was successfully created or that all94 bytes have known meanings.

For `wb`,296D first tries AH3D with access1. If an ordinary existing file opens,
29B7/6A08 asks **INT21/AX4400** and tests device bit7. The non-device truncate
branch29D8–29E7 sets **BX=handle,CX=0,AH=40**, leaving its pointer at the
freshly opened start. For open error2 and the create flag,2A33–2A35 calls
**AH3C**, then closes and reopens; other open errors follow failure handling.
Binary stream writes may buffer at2119, flush3758→6D39→INT21/AH40 at6D74,
or call3C2D, whose binary direct write is INT21/AH40 at3C90. Append seeks at
3C69/6D5A are conditional flag branches, not mandatory `wb` behavior.

DOS defines CX=0 for function40h as setting file size to the current pointer.
This is documented in Microsoft's published
[MS-DOS Encyclopedia, file-handle Write function](https://www.pcjs.org/documents/books/mspl13/msdos/encyclopedia/section2/).
The incoming actual `writeFile` only changed `rec.len` when the end exceeded
the old length. Thus this exact original call on an existing file returned
success yet left the old EOF. A subsequent94-byte overwrite could retain an
old suffix. That is a general pure-host defect, conditional on reaching save
with an existing ordinary file; it does not explain a missing first screen.

Owned WIP in `tools/toyvm/dos.js` adds the DOS EOF comment and changes only
the length condition to `n === 0 || end > rec.len`. Existing readonly checks,
growth, byte writes and temporary shared-handle refresh remain in use. New
`test/toyvm-zero-write.test.js` uses actual prototype methods on synthetic
register/storage doubles. It covers truncate-to-zero, middle truncation,
extension, shared temporary-handle EOF/readback, readonly rejection and nonzero
overwrite suffix preservation. The fixture bytes are arbitrary test data,
**not an invented SETUP.CFG**. Three of six tests failed before the change;
all six pass afterward, along with three existing disk-reset pure tests.
The original full94-byte stream, filesystem persistence, multi-handle behavior
outside these checked paths and guest execution remain unqualified.

## Actual host contracts, checks and next boundary

The current real-mode host has AH3D/3C/3E/3F/40/42 and4400 handling. Reads
return actual bounded data/counts, including EOF and short files; readonly
media denies writes with error5. File keys/current directories determine which
volume receives a relative SETUP.CFG. No writable destination or persistence
across a run is fabricated here. The initial mode2 call, direct B800 memory,
drive-space sentinel, file/device query and BIOS scan/ASCII key word all have
matching host contracts at the checked level. No broad absence claim follows.

The pure checks call actual int21Call/int16/int10 methods without constructing
a Machine. They exercise C: space and unavailable-drive returns, reads of
0/3/94/113-byte synthetic files, invalid handles, readonly writes,4400, close,
BIOS key words and empty blocking-read handback, and cursor clipping. Source
checks pin mode/page behavior. `check.cjs` blocks every WASM allocation,
compilation and instantiation entry point before importing the DOS module.
No instruction engine or guest routine is executed by those checks.

Reproduction from this working state:

```sh
node scratch/runs/20261113-worms-setup-screen-2200/check.cjs
timeout --signal=TERM --kill-after=2s 30s node --test \
  test/toyvm-zero-write.test.js test/toyvm-disk-reset.test.js
```

The first command passes183 checks plus840 overlap-byte comparisons; exact
call edges, service opcodes, mode strings, prior seals and source hashes are
included. Seeded mode3, wrong-range and read-overcount controls each fail.
Syntax, whitespace and reverse-patch checks pass. Starting Git SHA,
incoming relevant binary diff, source pins, tracked task delta, relevant
untracked helper/test new-file patches and this note's patch are retained;
undoing just the owned two-line source delta reproduces the exact incoming
DOS SHA. ToyVM/GPU/host incoming WIP was preserved. Git is the source archive.

Next is authorized focused runtime verification plus locked build before the
code can be committed. An original first-screen observation should separately
record initializers, mode2 return, B800 writes and the0059 open result. Config
qualification additionally needs actual cwd/drive, handle/error, fread count,
chosen save branch, truncate return, write count, close result and recovered
file bytes/hash. Until then original startup, config persistence, installation,
protected WRMS, gameplay, audio and screenshots remain **OPEN**.
