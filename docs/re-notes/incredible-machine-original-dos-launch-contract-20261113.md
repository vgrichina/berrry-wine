# The Incredible Machine original v1.0: DOS install and launch contract

This concerns owner187's original TIM floppy candidate, not a later TIM release,
another game, or a replacement engine. Its ordinary chain is **INSTALL.COM
(Smart Start configuration/copy/menu) → DOS EXEC TIM.EXE → embedded LZ91 unpacker
→ original real-mode program → RESOURCE.MAP/RESOURCE.001–004**. The repository's
ToyVM DOS loader has the corresponding COM, MZ and EXEC mechanisms. No original
installer, startup or puzzle has been run in this investigation; compatibility
and publisher authenticity remain unproved.

Evidence: `scratch/runs/20261113-tim-dos-static-0910/`. Source context begins at
main `31e6ae35af213a726652c1ef82363d6a738ba822`; `source-pins.json`,
`relevant-start.patch` and final Git/diff metadata identify the actual sources
read, including relevant uncommitted changes. No source/media archive was made.
See also [complete floppy intake](incredible-machine-original-floppy-intake-20261113.md).

## Identity and static method

Borrowed paths were opened read-only after exact full-byte identity checks:

| Input | Bytes | SHA-256 |
| --- | ---: | --- |
| `/dev/shm/wine-owner187-tim.7z` | 429273 | `bfd1ea462ca82384fc6dff49343aaf6c7a47df087b0eb3e79f1c8398c55d828c` |
| `/dev/shm/wine-owner187-tim-disk.img` | 1474560 | `d0e78876d50609b254420cdf7c0724a117a8ed714ea7c683c19e0d2094ce0657` |
| Image member `TIM.EXE` | 111951 | `34c844ba4586f27c817442ac5ed2f5b76e35d0c6521a9a9d4e7db66404e7c51c` |
| Image member `INSTALL.COM` | 30830 | `a2a609fa8aab61e950c00e3b59f98edf03a26ff183665eb813a3a60b94cfa531` |

`inspect.py` verifies all 11 payload hashes against the earlier complete FAT12
manifest, compares the archive's streamed disk member with the borrowed image,
and parses packed data and resource records in process memory. Bounded objdump
slices use anonymous memory file descriptors; no extracted binary is staged on
/home or retained in RAM files. `repo-static-scan.json` independently records the
repository scanner's real-mode MZ/LZEXE and flat-COM classifications. Signature
classification alone does not qualify every instruction or device request.

The LZ91 data decoder is a translation of the actual stub's bitstream operations,
not guest execution. It emits 211216 decoded bytes, SHA-256
`090d7d0eed4a77e279fc48875aca96074ddb7ced167126b7ee987bf318bd1286`,
and parses 2324 bounded relocation targets. The decoded image is an analysis
view before applying a runtime load bias; it is not a replacement launch binary.
Reproduce with `python3 scratch/runs/20261113-tim-dos-static-0910/inspect.py`
while the verified borrowed inputs and earlier manifest remain available.

## Installer, executable and working directory

Offsets below are original file offsets for INSTALL.COM and packed TIM.EXE,
or explicitly **decoded-image offsets** for the unpacked TIM analysis view.

INSTALL.COM is a genuine flat COM, starting `e8 00 00 58`, not an MZ under a
misleading extension. Its initial call/pop detects the PSP:0100 placement and
far-returns with CS advanced by 0x10 paragraphs, so subsequent internal offsets
match file offsets. At file 0x73 it shrinks its DOS allocation (AX=4A00h).
Its Smart Start main function is file 0xee. It offers graphics, sounds/music,
copy to hard drive, backup and Play choices; those labels are static menu data,
not observed UI screens.

The installer must find **INSTALL.COM in the current directory**. Function
0x5c58 opens that literal name, seeks to the last four bytes, verifies `RES:`,
then reads the preceding DWORD (0x7840) and seeks to the appended title record.
The record contains `The Incredible Machine`, `TIM.EXE`, and disk/configuration
metadata. Function 0x5d0c separates TIM from its `.EXE` extension; the launcher
at 0x80 builds the executable name from these initialized fields. Keeping only
the initial COM code and dropping its appended record would break this chain.

Copy function 0x208c substitutes that TIM stem into the destination template
`C:\SIERRA\########` (file 0x6372), then changes its drive letter to the user's
selection. Thus the static default is **C:\SIERRA\TIM**; the actual chosen
destination must be observed and recorded later. The COM includes DOS MKDIR,
CHDIR, create/open/read/write/seek wrappers at 0x4682/0x466d and 0x44b5–0x466c.
The `echo off`, `cd \sierra\########`, `########` strings are batch templates;
no generated batch name or exact installed output is established here.

RESOURCE.CFG is absent from the floppy. The COM opens it through pointer
0x659a; its save function 0x471 creates the selected path and writes **three
one-byte configuration values** at 0x4de–0x53c. These derive from sound and
graphics selection routines/tables. Do not invent a text configuration or guess
the three byte values. Play choice `5` is handled at 0x3a5: it saves changed
configuration as needed and calls 0x571 to change directory/drive to the chosen
game directory. Returning success from main leads to AX=4B00h / INT 21h at
0xc3–0xc6, with the constructed TIM.EXE name at DS:00e1 and EXEC block at
ES:00d3. The block inherits the environment and uses the empty command tail at
00d1. There is no evidence for a required game command-line switch.

TIM.EXE has a 32-byte MZ header, 219 pages with 335 bytes in the last page,
zero outer relocations, min-extra allocation 0x19c0 paragraphs, max 0xffff,
SS:SP=3457:0080 and CS:IP=1aa0:000e relative to its DOS load segment.
The declared file extent is exactly 111951 bytes: **no appended MZ overlay**.
The `LZ91` marker is at file 0x1c. Entry is file 0x1aa2e; the unpacker relocates
its working code, expands the stream starting at file 0x20, then applies its
own relocation stream. Its final far jump restores original CS:IP=0000:0000,
SS:SP=3389:0080, biased by the load segment. Zero outer MZ relocations therefore
does not mean the original program has no segment relocations.

The decoded entry starts Borland DOS initialization; it establishes data segment
load+0x2d3c and uses DOS version/environment/memory calls. Decoded text identifies
`This is version 1.00 of 'The Incredible Machine.'` and reports a requirement
of at least **550k free memory**. That is a program-stated requirement, not a
measured successful allocation. No PE/NE/LE/LX header or recognized DOS extender
is identified by the static scanner. Offset 0x3c in this short-header packed MZ
is code/data, not a meaningful Windows new-header pointer.

Ordinary installed startup is therefore `TIM.EXE` with an empty tail, **from the
installed game directory**, retaining its resource companions and installer-made
configuration. The installer is the evidence-backed way to choose hardware and
copy/configure the release. Direct TIM.EXE launch from loose floppy bytes is a
separate untested shortcut: decoded 0xe0b4 opens RESOURCE.CFG and branches over
its three reads if unavailable (0xe0c3 → 0xe120), but that fallback does not prove
equivalence to an installed launch. The later TIM.CFG read also has a missing-file
branch (decoded 0x12bbf → 0x12be3); TIM.CFG is not a missing floppy payload.

## Resources and persistent files

RESOURCE.MAP is 1338 bytes: four initial index/hash bytes, a WORD volume count
of four, then each 13-byte volume name, WORD count and `(DWORD key, DWORD offset)`
records. At each volume offset are a 13-byte member-name field, DWORD payload
length and that payload. All 159 records fit exactly: successive records are
contiguous and the final member ends at each volume's exact file length.
`resource-members.json` retains every member offset, size and SHA-256.

| Container | Members | Relevant contents |
| --- | ---: | --- |
| RESOURCE.001 | 62 | fonts, mouse/control-panel/parts bitmaps, palettes, SIERRA.SCR |
| RESOURCE.002 | 85 | L3.LEV–L87.LEV, in index order rather than numeric order |
| RESOURCE.003 | 10 | VM.OVL, SX.OVL, TIM.SX, PASSWORD.TXT, TITLE.GKC, CREDITS.GKC, ICONS.BMP and three parts bitmaps |
| RESOURCE.004 | 2 | L2.LEV and L1.LEV |

Decoded 0x964b supplies RESOURCE.MAP to the resource-opening path. Decoded
0xe153 supplies `vm.ovl` to initialization; the container proves where its bytes
reside, without establishing that initialization succeeds. These are resource
members, not evidence that extra loose VM.OVL/SX.OVL files must be downloaded.
Keep the four original volumes and map unchanged. Also retain CATOMATC.TIM,
MOUSE.TIM, TONSOFUN.TIM and READ.ME from the full 11-file intake; this analysis
does not authorize trimming companions.

`password.txt` is both a contained resource and a decoded file/resource name;
its presence does not constitute an owner's manual. The executable contains a
prompt to select three parts from a page of the user's manual and password-gated
puzzle messages. Whether these prompts occur in the actual startup route is
unknown. Stop and record a real prompt if encountered; this task supplies no
answers or bypass. Game settings/saved machines require a writable game namespace;
TIM.CFG appears in decoded read/write paths at 0x12ba7/0x12bed. Exact runtime
created files and install-copy contents remain to be hashed after a later run.

## Comparison with the current repository route

The relevant implementation is [ToyVM DOS](../../tools/toyvm/dos.js:169), not
the Win32 PE interpreter. `loadExe` chooses MZ/ZM versus flat COM by signature,
copies the declared MZ body and applies outer relocations, constructs a PSP and
returns initial registers. LZ91 remains original guest code to execute normally;
there is no need to register the statically decoded view. DOS INT 21h/4Bh
handles EXEC children, including memory ownership and return to the parent.
Both TIM's MZ envelope and INSTALL.COM's launch request match this route's
implemented forms; successful execution is still untested.

The current source supports component-wise DOS paths, C: current directories,
MKDIR/CHDIR/getcwd, immutable host originals plus guest write overlays, and
`Machine.changeDisk('A', image)`/`readFat12` for read-only FAT12 volumes. This
supersedes the generated corpus manifest's old `flat-fs`/`no-batch` summaries:
it would be incorrect to cite those summaries as today's missing CHDIR/MKDIR
boundary. The runner now also contains a deliberately restricted batch launcher;
the TIM installer-to-EXE chain itself needs no batch interpreter.

There are two precise entry surfaces:

- For an authorized **installed tree**, `runDos({exe: '<root>/TIM.EXE', ...})`
  defaults fileRoot to its containing host directory and CWD to guest C:\.
  That maps all same-directory companions together. If mounting a larger C:
  tree, use its `fileRoot` and `currentDirectory: 'SIERRA/TIM'` options so relative
  resource/config names resolve in the game directory. Keep the original packed
  TIM.EXE; pass no inferred args or environment overrides.
- For a genuine **A: installer run**, the underlying Machine can insert the
  verified image with `changeDisk`, read `A:\INSTALL.COM`, load it through
  `loadExe`, and select A: before ordinary DOS startup. This requires an authorized
  driver preserving the normal PSP/environment/arena/IVT setup and an independent
  writable C: overlay. The reviewed `run-dos.js` CLI and `live.js` start path do
  not expose an initial floppy-image/current-A: boot option; pointing that CLI
  at `disk.img` would interpret FAT bytes as COM code. No ready-made TIM floppy
  CLI command is claimed here. Existing floppy tests are source references only;
  none were executed in this task.

The PE parser in `lib/pe.js` expects a Windows signature at e_lfanew; this packed
DOS file does not meet that contract. No TIM entry was found in `lib/apps.js`,
`test/toyvm-dos-corpus/titles.json`, `test/dos-game-corpus/manifest.json` or
`tools/toyvm/program-config.js`. No app/corpus ID, installed directory or browser
availability has been fabricated. The concrete delivery gap is an unperformed
installed intake / ordinary floppy-driver setup, not a demonstrated CPU fault.
Device, packed-code coherency, memory and resource-loader behavior must be
observed before calling this original supported.

## First later authorized original input/capture test

After separate authorization for installation/runtime, verify these exact media
again, prearm an observable independent deadline/input-release watchdog, and run
the original INSTALL.COM with genuine read-only A: and writable isolated C:.
Capture the actual Smart Start hardware/copy choices, accept an ordinary detected
configuration, hash the generated RESOURCE.CFG and complete installed output,
and record destination/CWD. Preserve all originals. Do not substitute hand-made
configuration, an unpacked executable, or a different TIM release.

Start the installed packed TIM.EXE normally, with bounded time/dispatches and
automatic key rotation off. Capture each actual prompt and the first puzzle
frame. RESOURCE.004's L1.LEV statically names **TUTORIAL: PUT THE BALL IN THE
HOOP**, with objective **Make the basketball go through the hoop** (payload
SHA-256 `c46d65ffa5f10d2a80c7c63e17c20fefa0294caa0d2ab76107762a496f843904`).
This identifies the first candidate puzzle to recognize; it predicts no screen
coordinates or solution.

On the fresh reviewed puzzle, use the release note's Tab/arrows to select an
observed hotspot or movable part, then one bounded Space/Enter press and release
(documented left-mouse equivalents). Capture before/after selection or placement,
and, when the visible controls establish it, ordinary simulation progress toward
the hoop. Record the precise input, releases, frames and any failure boundary.
Do not replay guessed coordinates or claim puzzle completion from a static level
title. Menu/config changes alone are startup evidence; original puzzle input
and its visible consequence are the next gameplay milestone. Esc opens the
Control Panel; Alt-V there can corroborate version through the ordinary UI.

This run made no guest/config writes, downloads, build, fixture/native/game run,
browser session, media staging, capacity probe or production edit. Borrowed RAM
and all other run paths were preserved; no private RAM files were created.
Box ID **NONE**, state **NOT_CREATED**, expiry **null**, stop receipt **N/A**;
no runtime watchdog was needed because no runtime or box was created.
