# Original Worms SETUP: recovered entry and bounded CD-call analysis

2026-11-13. **NO_NATIVE_RESULT.** The original missing entry is recovered and
hash-verified. It enters ordinary real-mode Watcom startup and application main,
without an intervening unpacker. The demonstrated device operation is generic
INT21/AX=4400h handle classification. The only literal INT2F is a generic runtime
table entry; its concrete direct wrapper callers select INT10, INT16 and INT21.
No original MSCDEX request, device pointer, version or audio dependency is proved.
Installation, DOS4GW, protected WRMS execution, gameplay and audio remain **OPEN**.

This extends [the previous retained-prefix analysis](worms-original-cd-service-call-paths-20261113.md)
and uses [the complete-CD intake](worms-original-cd-intake-20261113.md).
Publisher authenticity remains unverified: matching the independently streamed
candidate establishes pinned byte identity, not an authenticated publisher pressing.

## Exact recovery

Evidence: `scratch/runs/20261113-worms-setup-entry-1600/`. No production edits.
The prior complete-CD `manifest.json` is pinned by SHA-256
`ab192a904b8e37d898b679405ac3103481b9a67ace676b3fe561264b4c4dcec0`.
It identifies `SETUP.EXE;1`, extent **169**, **39,746 bytes**, complete-member SHA-256
`92805b6402fb28b8b6d07e57038ce97d9939fd6febbdb9c5c7dde639c62b0771`.
The original candidate BIN is
<https://archive.org/download/worms_team17/CDWORMS.bin>, 578,432,064 bytes,
complete-disc SHA-256
`e353ccf735d26f2c56d87614ab26f700f2ee5dfb79dd1848c18208276ff5d888`
(inherited full-stream verification, not rehashed here).

The actual track contract is track 1 MODE1/2352, INDEX01 at BIN sector zero.
Read only raw sectors **169–188**, inclusive: HTTP Range
`bytes=397488-444527`. Each successful response must be **206**, Content-Range
`bytes 397488-444527/578432064`, Content-Length **47,040**, identity encoding,
and an exactly sized body. Check every sector's sync and mode=1; extract bytes
`[16,2064)` per 2,352-byte sector, concatenate and truncate to 39,746. The full
member hash must match **before any disassembly**. The five small successful
analysis passes each fetched this same range (235,200 aggregate raw bytes);
there were no failed/denied-access retries, unrelated sectors or alternate media.
Raw-range SHA-256 on all five passes:
`8f794f28eda6d206a510ff9ebc71af4cd22e60776f5d5f33d464d844cd5d9f86`.
Each receipt retains status, final redirected URL, headers, lengths and hashes.

Original bytes existed only in Python memory and short-lived Linux memfds for
static objdump. No disc/member file was written to `/home` or elsewhere. Processes
exited normally; memfds close in `finally`. Only **6,094 unique load-image bytes**
in selected windows, the MZ header, compact listings and analysis receipts remain.

## Entry, relocation and instruction context

Let **S** be the DOS MZ load segment. Addresses below are load-image offsets;
add **50h** for file offsets. The header declares 78 pages, last page 322 bytes,
five header paragraphs, 12 relocation records at file 20h, CS:IP=0000:26B2,
SS:SP=0A64:0A00 and minimum allocation 0155h paragraphs. Declared size is exactly
39,746 bytes: no appended overlay is needed for this entry path. Every relocation
word is within the declared image; header/records are retained in `header.json`.
This is MZ real-mode code, not a PE/LE or a flat 32-bit decode.

| Image offset (file = image + 50h) | Original instruction/context |
|---|---|
| **26B2** (**file 2702**) | `e9 a6 00`: JMP **275B**. Bytes 26B5–275A contain runtime text/data; they are not a fall-through instruction stream. |
| **275B** | `fb b9 d2 08 8e c1`: STI; CX=08D2h before relocation; ES=CX. Relocation at **275D** makes ES=S+08D2h. Startup later sets SS and DS to this relocated data segment. |
| **2860**, **28B2** | Relocated DX=08D2h reloads DS. Data offset d corresponds to image **8D20h+d**, not image d. SETUP.CFG at DS:03BE is image **90DE**, file **912E**. |
| **2872–287A** | DI=0DD2h, CX=191Ah−DI, AL=0, REP STOSB: BSS clearing in ES, not decompression. Initialized data ends at image 9AF2; zeroing starts there. |
| **28AA → 692C** | AX=00FFh runs Watcom initialization records at DS:0DA2–0DC6 (image **9AC2–9AE6**), six-byte records. The priority-1, **type-0 near** record calls **24B0** in CS=S via **691C**. DOS relocates the trailing segment word at **9AC6**, but this near dispatch does not consume it; type 1 would take the separate far-call branch at 6913. This resolves an actual startup callback instead of ignoring it. |
| **28AD → 68C0 → 68CE → 0014** | Ordinary direct calls enter installer application main at **0014** (file **0064**). Main opens SETUP.CFG through the stream library at 0059; no unpack/next-entry gap precedes this application code. |
| **0064 → 0409 → 0428 → 2450 → 245A** | First drive-space request uses BX=3, AX=BX; callee copies AX to DX and sets **AH=36h** before INT21. Thus DL=3 for the first request. Returned fields go to the caller's stack buffer. This is DOS drive-space probing, not an MSCDEX inquiry. |

There is real **lazy code patching**, which must not be mistaken for packing or
ordinary inline instructions. Initializer **24B0** selects FP handlers according
to the FPU/control state; **2478** gets/sets vectors 34h through 3Dh using
INT21/AH=35h/25h. On its hardware branch, handler **255A** reads the interrupt's
saved CS:IP, adds A4h to the preceding vector byte, overwrites CD with 9Bh,
and rewinds saved IP by two. Handler **259E** similarly writes `9b 90` for 3Dh.
The alternate software handler starts at **3EAA** and parses inline operands;
its complete arithmetic dispatch is not proved by the hardware-branch model.

For example, image **043A** `cd 37 46 fa` becomes `9b db 46 fa`
(FWAIT; FILD dword [BP−6]), next original instruction **043E**. Image **0468**
`cd 39 56 ea` consumes four bytes; **046C** `cd 38 1e 50 05` consumes five,
then execution reaches FSTSW at **0471**. A linear decode's far JMP at **046B**
starts inside these operands and is false evidence. `cfg.json` retains original
bytes and derived boundaries separately. No patched executable was run or saved.

## Interrupt and IOCTL callers

| Original path | Registers and evidence |
|---|---|
| Main 0255 → 1E6F → 1EAA → 36E1 → 36E4 → 2D4D → 2D59 → **6A08** | A conditional stream-buffer path calls the generic device classifier. 2D56 loads incoming AX from the stream's handle word at [BX+8]. At **6A0B**, BX=that handle; **6A0D** sets AX=4400h; **6A10** issues INT21 and tests DL bit 7. Handle number is runtime-dependent and is not invented. Full [6A08,6A24) hash: `d1d0d2ca9084816ee0fb2f16a38ce907daa856ae0462023bd3038590219bcd69`. |
| Library **2AF3/2AF6**, **2B12/2B15** | AX=4400h then AX=4401h, BX=SI/incoming handle; second call sets DL bit 5 and clears DH. These sites are outside the bounded entry graph; no original entry caller or CD request packet is established. |
| **2696 → 2611 → 2652 → 6892 → 689F → 759E** | Register-frame adapter preserves the caller's interrupt number into BL. **75A2–75AA** clears BH and calculates **7603h + 3×BL**. **75E1–7602** loads AX/BX/CX/DX/SI/DI/BP/ES/DS from the supplied frame and RETF-dispatches through the stacked code target. |
| Calls at **1161**, **117D**, **153F**, **155C** | Supplied interrupt numbers are respectively **0010h, 0016h, 0010h, 0021h**. They select **7633** (INT10), **7645** (INT16), **7633**, **7666** (INT21). At 1536 the frame AH is 02h (video); at 1556 it is 07h (DOS input). Caller AX=interrupt number is distinct from frame AX restored by 75E1. |
| Generic table **7690**, file **76E0** | `cd 2f c3`, SHA-256 `2742d4966037c66d4fe05a550bf55cf1c05c332519f3789c416e5166ff3ed55a`. BL=2F would select it, but no concrete caller above supplies 2F. The complete verified member has no other literal `cd 2f` and no literal `mov ax,15xx`; these scans do not exclude indirect/generated calls or computed register values. |

The seven literal E8 calls to the four adapter functions match the decoded call
sites exactly (`literal-frame-calls.json`). This cross-check does not prove that
no indirect caller exists. Main's ten guarded switch tables are decoded from
their actual CMP/JA/index bytes, rather than treating table words as instructions.
The graph has 7,554 candidate instructions/65 INT21 sites with conditional hardware
FP boundaries; the stricter graph stops at original inline FP interrupts. Calls
may return and both branch successors are explored: these are static candidates,
not observed execution or a proof that all paths are feasible.

The remaining precise analysis gaps are runtime call targets at **1D8E/1D92/1DA4**,
initializer dispatcher **68EC/6900/6913/691C**, formatting callbacks such as
**2F14**, FP save/restore callbacks **3A1E/3C1D**, and the software FP dispatch
tables following **3F54/3F74**. `cfg.json` lists every unresolved transfer.
There is **no remaining missing SETUP entry byte or established compressed stream**;
there is also no justified whole-program absence claim. A stronger CD dependency
claim requires resolving these contexts or separately authorized original execution.
DOS4GW's file 4152h entry and WRMS's protected LE pages remain outside this task.

## Current implementation and reproducible checks

`source-head.txt`, `source-pins.json`, and `relevant-uncommitted.diff` identify the
compared main checkout and dirty DOS source. The existing untracked MSCDEX/media
helper reconstruction patches are in the prior call-path run's
`new-{mscdex,cdrom-media,readonly-iso}.js.patch`; the hashes are pinned here.
The current subset implements 1500/1505/1508/150B/150D, with real-mode/VM86 bounded
buffers. It supplies no 1501 device headers, 1510 driver dispatch, version or audio
success. None becomes a demonstrated installer prerequisite from this analysis.
INT21/4400 handles the demonstrated generic query; 4401 remains invalid-function,
with no established entry path to SETUP's library site. No fake result or driver
pointer was introduced, and no 1510 dependency is assumed.

Offline checks (no network, guest, build or media needed):

```sh
python3 -B scratch/runs/20261113-worms-setup-entry-1600/check.py
```

`checks.json` records seven passing groups, including bad HTTP status/range/length/
hash receipts, malformed MZ entry/relocations, all ten switch guard/target mutants,
original FP operand boundaries, and seeded INT2F opcode/caller-number mutants.
Offline checks validate retained evidence and reported receipts; they cannot
rehash a full member that was deliberately not retained.

For a newly authorized repeat of the **same bounded member read**, run:

```sh
timeout --signal=TERM --kill-after=5s 180s python3 -B -u \
  scratch/runs/20261113-worms-setup-entry-1600/recover.py --trace </dev/null
```

`recover.py` enforces the manifest pin, exact sector map, HTTP bounds and complete
member hash before calling `trace.py`. `finalize.py` compacts selected evidence;
new helper/document patches and `seals.json` preserve method and evidence hashes.
Git is the source archive; no source tree or full resource was archived.
Independent GNU timeout deadlines bounded each recovery process. All exited;
original buffers are gone. Box ID **none**, state **NOT_CREATED**, expiry **null**,
stop receipt **not applicable**. No VM/DOS guest/WASM/native/browser/game/build,
box, worker or capacity operation was performed.
