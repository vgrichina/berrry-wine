# Original TIM installer: copy, configuration and ordinary Play path

2026-11-13. **NO_NATIVE_RESULT.** This is a static original-byte trace plus pure
JavaScript prototype tests. No original program was executed, no menu was
answered, no RESOURCE.CFG or installed tree was generated. Installation, native
execution, L1 and screenshot evidence remain **OPEN**.

Evidence: `scratch/runs/20261113-tim-install-copy-1940/`. Read with
[tim-original-installer-startup-probes-20261113.md](tim-original-installer-startup-probes-20261113.md),
[incredible-machine-original-dos-launch-contract-20261113.md](incredible-machine-original-dos-launch-contract-20261113.md)
and predecessor `scratch/runs/20261113-tim-fcb-search-1820/README.txt`.
All addresses below are hexadecimal **INSTALL.COM file offsets**, also internal
logical offsets after its entry segment adjustment; they are not observed
runtime physical addresses. PSP/segments, handles, buffers, detected devices,
user selections and actual mounted default drive/cwd remain runtime values.

## Inputs and first-menu boundary

Only the already borrowed `/dev/shm/wine-owner187-tim-disk.img` was opened,
read-only. Its inherited image SHA-256 is
`d0e78876d50609b254420cdf7c0724a117a8ed714ea7c683c19e0d2094ce0657`
(not rehashed by reading the whole image). Existing manifest cluster coordinates
selected exactly the 30,830-byte INSTALL.COM; its freshly verified SHA-256 is
`a2a609fa8aab61e950c00e3b59f98edf03a26ff183665eb813a3a60b94cfa531`.
Only another 416 root-directory bytes were read: eleven file entries, label and
end marker, SHA-256
`a6e1021d06bc72e1f62370d0c5dec5f50e1b4cad13bab626f482f930473f2a4a`.
No other member payload, full image, FAT staging or network input was needed.
`input.json`, `root-entries.json`, `code-bytes.json` and bounded `.asm` slices
record exact input coordinates, raw metadata and byte hashes. COM was assembled
in process memory; disassembly used anonymous memfd slices, not a staged COM.

The footer reader at `5c58` opens INSTALL.COM, seeks end-4 to verify `RES:`,
then end-8 to read the resource-data offset. At that offset the original footer
holds title "The Incredible Machine", `TIM.EXE`, disk count 1, device masks and
required space `000c3500` (800,000 bytes). The reader splits the stem into
`7802="TIM"` and extension pointer `7800` to `.EXE`; `6596/6598` point to title
and stem buffers. Those buffers are empty in the on-disk initial data and are
populated by the reader, not evidence of an absent runtime title.

With a missing original RESOURCE.CFG, prior selection bytes `73f2/73f3` start
FF; detection and selection routines supply later choices. At `0266`, however,
the menu's selection local is explicitly **0**. `02b0 CALL 0f22` passes menu
structure `6271`, selection 0 and redraw 1. `0f8f -> 4336` reaches blocking
BIOS INT16/AH00. Thus the proved initial highlighted action is **Change
Graphics**, not copying or playing. Compaction `01ee..024f` retains original
IDs '1'..'5' in `73d6`, separately renumbering visible digits. The dispatcher
compares those original IDs: graphics at `0313`, sound `0324`, copy `0335`,
backup `0380`, Play `03a5`. Copy/backup visibility depends on label/drive probes.
An A: root source with writable C: is a proposed later runtime setup, not an
observed selection or an automatic installation branch.

## Conditional copy route and source/destination context

If the user selects original ID '3', `0335 -> 1c7a(mode=0)` presents a drive
chooser. It probes DOS36 through `46f3`; arrow/letter/Enter/Escape handling is
inside `1f60..202a`. Return AL is a selected ASCII drive letter or 0 for cancel;
`033f` returns to the main menu on 0. Original preferred-index bytes `6364..6367`
are FF, so no chosen drive is proved here. `0347 -> 35f1` checks required space:
`360d` converts the letter to DOS's 1-based drive (C -> DL=03), `5f9a` invokes
AH36 at `5fa9`, using AX sectors/cluster, BX free clusters, CX bytes/sector and
DX total clusters. Insufficient space leads to the original dialog and prevents
copy. No actual free-space value is asserted.

`0353 -> 208c` substitutes stem TIM in `6328 -> 6372`, originally
`C:\SIERRA\########`, and substitutes the chosen letter. The resulting path is
conditionally `<selected drive>:\SIERRA\TIM`. The graphics-mapped index selects
a word from `65b5`; all nine original entries are zero. Consequently the
ordinary branch at `20f4` loops disk 1 through original count 1, calling `256f`;
the nonzero-table alternative `2a39` is not justified for this original table.
Original ID '4' is a different chooser(mode=1)/backup route through `202b`, not
an alias for ordinary installation and not followed as an answered choice.

In `256f`, `2596` sets ordinary-copy search attributes `74f3=0` (backup uses 8).
`25e9 -> 46cb` saves current drive and cwd using DOS19/47. `2608` computes the
same-drive flag `74f1`; `260e` records the uppercase destination in `74ed`.
This does not select the destination as current drive. `261d -> 457d` probes
DOS48 with BX=FFFF and reserves 16,000 bytes before allocating the transfer
buffer at `2634`; allocation failure is original error 3.

`2665 -> 3413(disk=1, mode=0)` checks source media via `353a`. Ordinary mode
retains the source default drive; the same-drive/backup swap paths can select a
drive through `475e`/AH0E (`348c/3528`). Thus source opens and searches are
relative to the current **source** cwd, whereas destination operations use the
absolute substituted path. Same-drive swap prompts, cancellation and actual
media replacement remain unexecuted runtime branches.

`353a` constructs the stem-based label wildcard; `35b5 -> 4730` executes
`AX=0d00; INT21` at `4733`, then `35d3 -> 47df(pattern=74da, attr=0a)`.
The FCB wrapper first searches attr08 and, on failure, attr02. For TIM's stem,
the fixed fields are `TIM ?      `, matching the raw `TIM 1      ` label.
This reset/search path is also reached by the startup label check before menu
filtering; it is not evidence that copy was selected.

## FCB consumer and actual file services

`26b7 -> 22e1` enumerates `638b="????????.???"` with attr0 through `47df`.
The original input is extended FCB `6486`: marker FF, attr `648c`, drive
`648d=0`, name `648e` (8), extension `6496` (3). The DTA is `645a`.
`4771` rebuilds the input's name/extension and search attribute without clearing
its private continuation fields. `480f/481a` uses that wrapper before AH12.

The original result consumers are decisive:

| Original consumer | Absolute result | Meaning |
| --- | --- | --- |
| `483f` | `6462..6469`, `646a..646c` | 8+3 name, trimmed into NUL-terminated dotted name |
| `48a0`, instruction `48a3: A0 60 64` | `6460` = extended DTA+6 | **search attribute prefix**, not directory attribute |
| Raw entry, not that consumer | `646d` = DTA+19 | actual directory-entry attribute |

The original label attr is 28, but its requested search prefix is 08. Ordinary
copy requests 00 although ordinary original file attrs are 20. Pure calls to
the actual current DOS prototype reproduce both distinctions and all 32 raw
label-entry bytes. FindNext, including the original field rebuild, preserves
the current FCB helper's continuation and physical directory order. No offset
change, TIM special case or invented label is warranted.

The eleven original regular entries, in order, are INSTALL.COM, RESOURCE.002,
RESOURCE.MAP, RESOURCE.001, RESOURCE.003, RESOURCE.004, CATOMATC.TIM,
TONSOFUN.TIM, MOUSE.TIM, TIM.EXE, READ.ME. These are enumeration metadata, not a
claim that eleven outputs were installed. `22e1` builds 29-byte work records;
`2152` opens a candidate and reads four bytes to recognize a possible `FILE`
container, expanding records when present. Other payloads were not read here;
container presence, decoded contents and actual transfer sizes remain unknown.

The ordinary transfer uses existing general services:

| Calls/offsets | DOS contract and original behavior |
| --- | --- |
| `273b -> 2cc6`, open `2d85 -> 45e7` | AH3D AL0, DS:DX relative source filename; BX receives runtime handle |
| `2db7 -> 4638`; `2fbd -> 4654` | AH42 absolute offset from record+8, or current-position query AX4201/CX:DX=0 |
| `2f70 -> 44b5` | AH3F, BX source handle, CX bounded count, DS:DX transfer slice; actual FILE branch uses decoder `50a3/526e` |
| `279f -> 24e1` | recursively splits absolute destination; probes AH3D, then AH39 at `251d`; does not chdir |
| `27b9 -> 3104`, `31de/31f9` | append record name to destination, AH4300 get attrs; AH4301 clears readonly when necessary |
| `3211/323f`, `4618` | continuation opens read/write (AH3D AL2) and seeks absolute; new output AH3C CX=record attrs |
| `32ba -> 4519` | AH40, BX output handle, CX chunk count, DS:DX buffered bytes; compares actual vs wanted count |
| `32e1 -> 46ac`, `3334/3353` | short write: close/delete (AH41), error 6; otherwise closes completed or swap-temporary handles via AH3E |

Directory path-not-found (3) or cancellation/global critical-error state `7520`
can terminate with error 2; source/output open, seek or create failures return
original error paths (output error 5). Existing-directory mkdir failure is not
uniformly fatal. The critical-error/retry UI and same-drive media prompts are
not bypassed. `3323` restores the destination path terminator; `27f2` frees the
transfer buffer. No success is established without actual complete I/O.

The current source already recognizes these handle/directory/attribute
services and FCB11/12. AH57 get/set exists, but the reviewed ordinary route
contains no timestamp-service call; no AH2A date requirement was demonstrated.
FCB raw directory dates/times survive in the DTA, but these consumers read name
and prefix attrs. This does **not** establish installed timestamp preservation.

## Batch, RESOURCE.CFG and Play

On ordinary copy success `2124 -> 3855` creates `<destination>.BAT` via AH3C
CX=0; conditionally C:\SIERRA\TIM.BAT, alongside the game directory.
`6368..636f` point to `echo off\r\n`, `<drive>:\r\n`,
`cd \sierra\########\r\n`, `########\r\n`. `3897 -> 0404/0424`
substitutes TIM; `38a3` replaces the drive character; `38e5 -> 4519` writes
those four strings by their lengths, closing through `460c`.
There is an original quirk: `38b0 -> 3967` searches the fourth string for '.';
the pinned template has none and substitution adds none. `3986` returns AX=0;
`38ba..38c8` therefore copies `.EXE` to DS:0000, not into the batch line.
Under these original data values the fourth line remains `TIM\r\n`.
This is a static conditional memory-write observation, not an executed batch,
an emulator deficiency, or grounds to repair original code.

Copy success returns to main: `035b` saves selected drive `73f1`, `0361` sets
`6270=1`, `0366 -> 0471` attempts configuration, updates prior selections on
success, then `0379 -> 026a` redraws the menu. It does **not** auto-EXEC TIM.
Graphics/sound menus alter selections; saving is reached through successful
copy or Play's changed-selection check, not by mere initial highlighting.

`0471` calls `05d6(buffer,1)` at `0483`: choose saved original source path
`73f4` when `6270=0`, otherwise selected destination `6328`; append TIM.EXE
and probe AH3D with the original retry/cancel UI. Its nonzero return points at
the filename portion. `0491..0496` overwrites that portion with RESOURCE.CFG
(`659a -> 65d2`), then `04a3 -> 4618` creates/truncates it with CX=0.
This is the intended **three binary bytes**, with no text header or newline:

| File offset | Original producer | Intended byte |
| --- | --- | --- |
| 0 | `04d8 -> 1b2a`; write `04eb -> 4519` | graphics mapping `631f[selected graphics ID at 74d5]` |
| 1 | `04f8 -> 1328`; load `04fe`; write `0512` | `62ae[selected sound ID at 74b8]` |
| 2 | `051f -> 1328`; load `0525`; write `0539 -> 4519` | `62b6[selected sound ID at 74b8]` |

Original graphics table is `00 08 05 02 03 01 04`; `1b2a` modifies entries
6320/6321/6324 according to mask65a1 bits80/10/01/08 before indexing. Sound
tables are `00 00 03 02 06 02 05 07` and `00 fe fe fe 03 00 01 fe`.
Each write passes SS:BP-1, count DWORD=1 to `4519` (AH40 chunks). Actual IDs,
bytes, runtime stack address and handle are not observed; no CFG was made.
The caller checks `7520` between writes, closes and returns its zero-error
predicate; it does not independently validate every short count. Intended
three-byte layout therefore is not proof of a successful three-byte file.
Startup reads only two configuration bytes into `73f3/73f2`, an asymmetry
which does not authorize changing this original writer.

If the user chooses Play, `03a5` compares `1328`/`1b1a` current selections to
prior `73f2/73f3`. Changes invoke `0471`; failure returns to the menu (`03ed`).
`0571 -> 05d6(buffer,1)` prepares the executable directory, removes the final
filename, then `05b4 -> 466d` uses AH3B with its absolute path. Only afterward
`05ca -> 475e` selects its drive through AH0E. The per-drive cwd change and
default-drive selection are separate, both needed for the later relative EXEC.
Successful preparation restores text mode/critical handler and releases UI
memory, returning 1 to `0079`. The entry constructs `TIM.EXE` at DS:00e1,
resizes the PSP block at `00b7` (AX4a00, BX004e), and executes at `00c6`
(AX4b00, DS:DX=DS:00e1, ES:BX=DS:00d3, inherited environment and empty tail
at 00d1). On EXEC return it unconditionally exits at `00cb` with AX4c00;
there is no carry-dependent EXEC error dialog. This is the ordinary launch
contract, not observed child startup or successful native installation.

## Narrow service repair, validation and remaining boundary

The demonstrated next gap was AH0D: original `35b5 -> 4730` supplies AX0d00,
but incoming `int21Call` declined it. The namespace writes overlay bytes and
directory changes immediately and has no deferred disk cache. A general AH0D
case now acknowledges this write-through flush without closing handles,
changing positions/metadata/cwd/DTA/FCB searches, or inventing media actions.
It uses no TIM paths or original identifiers. The caller ignores return state;
this was an unhandled reachable service, not a proved fatal startup blocker.
Original swap/reset behavior on a real guest remains untested.

Three new pure tests cover both incoming CF states, live handles and immediate
writes/metadata/cwd, and unfinished FCB continuation. Removing only the new
case in memory makes all three fail; the actual patch passes. Four run-local
prototype tests verify original metadata/consumer offsets and reset handling.
Together with the 103 predecessor regressions, **110/110 pure tests pass**.
Byte checks pin 30 original call edges, 11 instruction sequences, 28 slice
hashes, original tables and two negative byte mutations. No CPU/Machine
construction, guest, VM/WASM, browser, native run, full build or generated
bundle was used. These checks demonstrate source/prototype contracts only.

`dos.js` and `test/toyvm-disk-reset.test.js` remain **uncommitted production
WIP**, preserving all incoming MZ/EXEC/FCB/CD/BIOS work. A code commit requires
an authorized real focused runtime, regenerated bundles and the locked build;
none was authorized here. Evidence records incoming/full relevant binary diffs,
task delta, complete new-file patches, exact Git/source pins and SHA seals.
Only this note is eligible for docs-only publication.

The next runtime dependency is explicit: authorized mounting/default A: cwd,
first-menu capture, deliberate user menu/drive/device selections, actual
source-container recognition, copy/write/error-path behavior, installed CFG and
ordinary EXEC validation. No additional file-service feature is justified by
this static trace. Box ID NONE, state NOT_CREATED, expiry null, stop receipt
N/A; only this task's bounded board watcher is stopped on release.
