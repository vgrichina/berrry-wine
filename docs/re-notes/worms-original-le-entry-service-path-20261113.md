# Original WRMS: recovered LE entry and protected interrupt boundary

2026-11-13 — **NO_NATIVE_RESULT**. The exact original WRMS member was recovered
into RAM and verified before analysis. Its actual LE entry is ordinary 32-bit
Watcom startup, followed by initializer dispatch and an application call at
object 1 offset `50a0h`. A concrete application register-frame path selects
INT33/AX=0000h. No original MSCDEX request, CD packet, version response, audio
success or complete call coverage is established by this bounded analysis.
Original installation, DOS4GW operation, gameplay and audio remain unproved.

This closes the missing-entry/page evidence in the
[retained-prefix investigation](worms-original-cd-service-call-paths-20261113.md).
It does not reinterpret the MZ external-DOS4GW search/overlay stub as game code.
SETUP1600 owns its separate installer investigation; this run made no SETUP or
DOS4GW request.

## Exact input and recovery

Run: `scratch/runs/20261113-worms-le-entry-1620/`. The
[fullstream intake](worms-original-cd-intake-20261113.md) and its original
`scratch/runs/20261113-worms-cd-stream-0810/manifest.json` pin `WRMS.EXE;1`:
LBA **204**, **426117 bytes**, SHA-256
`483f9f2376f76224602e67fc608f19ea13c218c0ef66643de30f2daf18d51ada`.
The original manifest hash is
`ab192a904b8e37d898b679405ac3103481b9a67ace676b3fe561264b4c4dcec0`.

`recover.py` makes nine ordinary HTTPS Range requests exclusively within this
member's raw extent at
<https://archive.org/download/worms_team17/CDWORMS.bin>.
Eight requests are 56448 bytes each; the final request is 37781 bytes. The raw
span is `[479808,969173)`; its last byte is the final declared member byte.
Every response had status 206, exact Content-Range total **578432064**, exact
Content-Length and exact received length. `http.json` retains headers, final
redirect URLs and response hashes. No failed/denied retry occurred.

For member byte `x`, raw address is
`(204 + floor(x/2048))*2352 + 16 + (x mod 2048)`.
Sector sync and Mode 1 are checked; raw headers/trailers and final payload
padding are excluded from the member hash. The complete hash passed before
any LE analysis. No whole-CD or other-media request, media copy on `/home`,
archive or execution occurred. Temporary member/window files used `/dev/shm`
only and were removed after verification.

Reproduce from the checkout root (no retries; fresh RAM path required):

```sh
timeout --signal=TERM --kill-after=5s 600s python3 -u scratch/runs/20261113-worms-le-entry-1620/recover.py
python3 scratch/runs/20261113-worms-le-entry-1620/analyze.py
python3 scratch/runs/20261113-worms-le-entry-1620/check.py
```

`check.py` also works offline after RAM removal: it verifies the retained
receipts, page mapping, initializer bytes and every annotated window hash.
With the verified RAM member present it additionally reproduces the parser and
windows, rejects wrong/truncated identity, five encoded/invalid page mutants,
an out-of-file physical page and an unsupported source-list fixup mutant.
No emulator, Machine, VM, WASM, browser, native guest or build was invoked.

## LE layout actually parsed

Offsets in this table are **member file offsets**. Table pointers in the LE
header are header-relative except the data-page file pointer. The structural
reference is the [Open Watcom LE/LX format header](https://raw.githubusercontent.com/open-watcom/open-watcom-v2/master/bld/watcom/h/exeflat.h).
`le.json` retains the exact parsed object/page tables and fixup-page offsets.

| Field | Original value |
|---|---|
| LE header / module flags | `2a50h` / `00000200h` |
| Object table / page map | `2b14h` / `2b44h` |
| Object 1 | size `3dbdfh`, preferred base `10000h`, flags `2045h` (read, execute, preload, 32-bit), map index 1, 62 pages |
| Object 2 | size `222840h`, preferred base `50000h`, flags `2043h` (read, write, preload, 32-bit), map index 63, 16 pages |
| Entry / stack | object 1:`34a3ch`; object 2:`222840h` |
| Page size / last physical page bytes | `1000h` / `285h` |
| Fixup page table / record table | `2c86h` / `2dc2h` |
| Imports / directives / iterated map | zero import modules, zero directives, zero iterated-map pointer |
| Data pages | `1ae00h` |

The **actual** 78 four-byte LE map entries contain big-endian 24-bit physical
page numbers 1 through 78, each flag zero. Entry page index within object 1 is
52, module page 53, map bytes `00 00 35 00`. Therefore, and only after parsing
that entry, entry file offset is `1ae00h + 52*1000h + a3ch = 4f83ch`.
There is no evidence of packed/iterated/range encoding in these page entries.
The analyzer refuses those forms; it does not generalize ordinary-page mapping
to unknown files. Object 2's unbacked virtual tail is not read as file bytes.

All 79 fixup-page offsets are monotonic and bounded. The 11597 decoded records
are internal single-source forms: 3253 source-07/target-00, 8343 source-07/
target-10 and one source-05/target-10. Target flags 10h select 32-bit target
offsets; 00h uses 16-bit target offsets. No unsupported record form was
encountered. `fixup-summary.json` retains per-page bounds/hashes and counts;
`windows.json` retains relevant page records, signed source offsets and which
operands overlap each window. Additive, chained, source-list, import and other
unhandled forms stop parsing explicitly; no relocations are silently applied.

Assembly addresses below are **object-relative**, before loader relocation,
decoded with `objdump -b binary -m i386 -M intel`. Preferred object bases are
metadata, not observed runtime selector bases. Near relative branches/calls
remain meaningful within the object; absolute operands are interpreted through
their symbolic object/offset fixups, not assumed runtime linear addresses.
For example, startup operands at `34abch` and `34ac2h` reference object 2
offsets `edd0h` and `edbch`. The table-address operand at `37e08h` references
object 1:`37ea8h`. This is relocation context, not proof that a loader ran.

## Bounded reachable service paths

| Path | What the recovered bytes establish |
|---|---|
| `34a3c → 34ab4` | `eb 76` skips the banner/data. Decoding that banner linearly produces false instructions; only the jump and actual target are used. |
| `34ab4 → 34ad9` | STI, stack alignment, runtime state stores; EBX=`50484152h`, EAX cleared then AH=30h; **INT21/AH30h**. Return values choose extender-dependent paths. No returned version is asserted. |
| Conditional startup branches | `34b2a`/`34b4d`: AH4Ah INT21; `34b78`: AX=FF00h, DX=0078h INT21; `34b94`: AX=0006h INT31. These depend on prior results and supplied selector/environment state; branch feasibility is unproved. |
| `34cbf → 3676a` | EAX=FFh; dispatcher selects six-byte initializer entries from object 2 `[f250h,f27ah)`, calls their relocated pointer at `367a7`, marks state 2, repeats. |
| `34cc6 → 3671a → 3675a → 50a0` | Runtime-to-application bridge, with helper calls `38c46h`/`38c4fh` and arguments from object 2:`2217ach`/`2217b0h`. This application call is conditional on all earlier initialization returning. |
| `50b0 → 5a3d → 5a51 → 3576a → 35ae2 → 37dca → 37e02` | Application supplies interrupt number **33h**, input/output frame at ESP, first frame word zero. Segment helper `37518h` snapshots current selectors. Dispatch computes `37ea8h + 3*33h = 37f41h`, loads frame registers, switches DS from the segment frame, and RET-dispatches to **`cd 33 c3`**. Hence AX=0000h mouse reset candidate, not a CD call. Upper EAX frame bits and other unset frame fields are not invented. |

The initializer table's seven pointers are object 1 offsets `36805h`, `34d14h`,
`36abfh`, `37597h`, `3c1b8h`, `3c3c8h`, `3c380h`, with initial state zero and
priorities 20h, 01h, 02h, 20h, 20h, 20h, 20h. Each pointer has a matching internal
32-bit-offset fixup in module page 78. Their exact 42-byte table hashes to
`146da7f5fb9b4ffce2a431dc5c7bfc6a2e8b216f8394b405de4e47c91bc94f33`.
Callback bodies and mutation of the table are not exhaustively followed here.

The same generic protected interrupt table contains `cd 2f c3` at `37f35h`.
This is selectable machinery, **not an established caller with AX=15xxh**.
Exploratory `cdCandidate.asm` shows local INT2F AX=1600h/FAxxh sites near
`3bfb6h`; reachability from this bounded entry graph is not established.
Exploratory `cdFrame.asm` shows EAX=2Fh passed to application helper `26a16h`,
not to the interrupt wrapper. Neither is promoted into CD-service evidence.

## Hashes, checks and next boundary

| Exact unrelocated window | Bytes | SHA-256 |
|---|---:|---|
| entry `34a3ch` | 2 | `326483fa1d1597f096d675f0ac348108412053844fdb555a3f36c2d41c83d772` |
| startup `[34ab4h,34d05h)` | 593 | `d037b58f817c84c23c1ad359504e6623294d1e42967f13781a423539e7dc5891` |
| initializer dispatcher `3676ah` | 75 | `dce350abc59afb18f45d022445c36b2ea9c603c2af3fd8f4bc417bc2ff4a6272` |
| application bridge `3671ah` | 79 | `5c845b6af21a5fb237c9be95c3e8b7e289633827436930b8abe0d3787de683e0` |
| protected INT33/RET `37f41h` | 3 | `422c455bb03eb3620b0b21ee56e2332d5a900e5c2059708552a871005eab21b5` |

All twelve final window hashes/mappings are in `windows.json`; annotated small
assembly files reproduce their hashes independently. `check.py` passed with
RAM present and again offline after removal. Relevant current MSCDEX/DOS/media
source pins, binary diffs and new-file patches are retained alongside exact Git
SHA and owned helper/document patches; `seals.json` seals the compact evidence.
Production files were read only. Publication is a documentation-only diffcheck
and strict pull/push, with no build or execution claim.

The compared `mscdex.js` still supports 1500/150B/150D/1505/1508, refuses buffered
protected non-VM86 transfers, and has no 1501/1510/150C implementation. The newly
recovered generic protected table does not justify adding those services or
assuming DOS4GW's real-mode translation contract. The exact next **service**
boundary is the original extender's handling of protected INT21 at `34ad9h`
and the frame-dispatched INT33 at `37f41h`, including runtime selector state and
returned registers. The next **CD-code** boundary is a reachable application
caller supplying INT2F/AX15xx or an actual driver request frame; resolving more
application callees/initializer bodies is needed before choosing a CD service.
No all-calls absence or successful startup claim follows from the selected windows.

Box ID none; state **NOT_CREATED**; expiry null; stop receipt not applicable.
The fetch used an independent TERM/KILL deadline; its completion and the
task-local messageboard watcher stop are recorded. Ownership is released at end.
