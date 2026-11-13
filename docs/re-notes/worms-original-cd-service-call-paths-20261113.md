# Original Worms: bounded CD-service call paths

2026-11-13, static retained-evidence investigation, **NO_NATIVE_RESULT**.
The retained original bytes do **not** establish a caller requiring MSCDEX
1501h, 1510h, a version response, CD audio commands, or a protected-mode CD
thunk. They establish real-mode startup and generic handle IOCTL code in the
launcher/stub. SETUP's entry, DOS4GW's entry and WRMS's protected main code are
outside the retained byte coverage. Their CD dependencies remain unknown;
implementing a device-driver interface on this evidence would be speculative.

This supplements the [original DOS launch contract](worms-original-dos-launch-contract-20261113.md).
Its earlier source-capability paragraph predates the current uncommitted CD
subset; the comparison below uses the exact source pins in this run. The
original install/configuration, extender, gameplay and audio remain untested.

## Evidence and reproduction

All new evidence is in `scratch/runs/20261113-worms-call-path-1440/`.
Run from the checkout root:

```sh
python3 scratch/runs/20261113-worms-call-path-1440/analyze.py
python3 scratch/runs/20261113-worms-call-path-1440/check.py
```

Inputs are exclusively the four existing `*.disasm.txt`, `headers.json` and
`validation.json` in `scratch/runs/20261113-worms-dos-static-0940/`, plus the
original contract above. No original executable, disc, media provider or remote
range was read, downloaded or staged. The original prefix receipts are inherited,
not newly verified media hashes. Original headers were removed by the previous
run; full prefix hashes cannot be independently recomputed from byte columns
because those exclude MZ headers and elide some zero runs.

Exact retained disassembly SHA-256 values:

| File | SHA-256 |
|---|---|
| WORMS.EXE.disasm.txt | `a5cdbd297f97e0dc558e75ad55315512088af15fef42246eabf8f385f3adadb7` |
| WRMS.EXE.disasm.txt | `59add218d4ec5b2d79ab3da7f95f6101b4c0820775b3d386972eef5ce5cc7288` |
| SETUP.EXE.disasm.txt | `f9f60b9596674928bde89b2bc8ffdc8522b7de19069e6ced9d63f098874bafc6` |
| DOS4GW.EXE.disasm.txt | `71bb5f0442c3334ca078df153a9d12831fd4c73bb08f8c92ecfd8e4523744c9a` |

`analysis.json` records original prefix hashes, exact byte windows with file/image
offsets and SHA-256, candidate control-flow paths, all unresolved transfers and
interrupt predecessor windows. `*.cfg.txt` contains compact control-flow events.
`source-head.txt`, `source-pins.json`, `relevant-uncommitted.diff`, and
`new-*.patch` recover the compared dirty source from Git. Owned document/helper
patches and `seals.json` identify this result without archiving the source tree.

## Method and limits

Addresses below are MZ **load-image offsets**, before relocation. Add 0x40
for WORMS file offsets, 0x60 for WRMS, 0x50 for SETUP and 0x200 for DOS4GW.
Entry = header CS × 16 + IP. The analyzer follows direct calls/jumps and both
conditional successors, assumes calls/interrupts can return, and records indirect
or far transfers as unresolved. Returns end a walk. This is a syntactic candidate
graph, not a stack-sensitive proof of execution, branch feasibility or completeness.
In particular, unresolved callbacks, RETF trampolines, generated code and child
programs prevent a whole-program absence claim.

Only explicitly printed byte columns are reconstructed in memory. A static
GNU objdump i8086 decode repairs known-byte targets that the original linear
listing missed, notably WORMS 0x9fe, 0xaa7 and main 0x8. It never invents omitted
bytes or decodes LE metadata as protected code. The retained linear listing has
`add cl,ch` at 0x9fd because it absorbed the actual entry's E9 opcode into a data
instruction. Similarly, linear offset 0x7 absorbs main's PUSH BX at 0x8.
Literal matches or attractive assembly alone cannot establish original code.

The analyzer visits 5,173 candidate instructions/33 INT sites in WORMS and
3,138/35 in WRMS; SETUP and DOS4GW have zero because their entries are absent.
These are coverage descriptions, not runtime instruction counts. Checks reproduce
all four analyses, verify annotated bytes/hashes, detect an explicitly seeded
generic INT2F table entry, and reject an out-of-prefix entry mutant.

## What the original launcher and stub actually show

| Original path/site | Registers, bytes and interpretation |
|---|---|
| WORMS entry 0x9fe → 0xaa7 | `e9 a6 00` branches to `fb b9 3a 03 8e c1` (STI; CX=033Ah; ES=CX). This is the real-mode Watcom startup, not code at the start of the linear listing. Relocation adjusts the segment constant. |
| WORMS startup 0xbf9 → 0x21f9 → 0x2207 → 0x8 | Direct call to application main after runtime initialization. Main 0x1f supplies AX=00BCh to wrapper 0x388: the retained DS string is SETUP.CFG. Success branch 0x3c requests 005Eh bytes through 0x42e into DS:0440h and closes via 0x5a4. No MSCDEX request is established by this file I/O. |
| WORMS 0x2351 → INT21 at 0x2359 | BX receives incoming AX (handle), AX=4400h; after INT21, DL bit 7 determines the returned boolean. Bytes `53 51 52 89 c3 b8 00 44 cd 21 19 c9 f6 c2 80 …`. Span [2351,236d) SHA-256 `d1d0d2ca9084816ee0fb2f16a38ce907daa856ae0462023bd3038590219bcd69`. Candidate callers include 0x111b through stream initialization; this is generic character-device detection, not a CD-device request packet. |
| WORMS library 0xeb8 / 0xed7 | AX=4400h then 4401h; BX=SI (incoming handle), second call sets DL bit 5 and clears DH. Full span [eb3,ee4) is hashed in analysis.json. These library sites are outside the direct entry candidate graph; indirect reachability is unresolved. Neither establishes CD control. |
| WORMS 0x2edf | AH=4Bh; AL is selected as 0 or 4 at 0x2ebf–0x2ec5 and preserved across the preparatory INT21/indirect callback. DS:DX is a supplied filename and ES:BX the EXEC block. Actual helper/game launches are described in the original contract; child CD services cannot be inferred from this call. |
| WRMS 0x30e → 0x3dc → 0x528 → 0x920 → 0x92e → main 0x66 | Real-mode external DOS4GW search/launch stub. The retained entry bytes `e9 cb 00` lead to Watcom startup (`fb b9 62 02 8e c1`). This main is the stub, not the LE game's entry. |
| WRMS 0x1f95 → INT21 at 0x1f9d | Same 28-byte generic AX=4400h/BX=handle/TEST DL,80h function and same SHA-256 as WORMS 0x2351. It is in the direct candidate graph. Library 0x172b/0x174a similarly contain 4400h/4401h but are outside that graph. |
| WRMS overlay transfer | 0x1d5a has `b8 03 4b ff 2e 72 03`: AX=4B03h, indirect far jump through DS:0372h. Earlier code copies a trampoline from 0x1b20; its `0e 1f cd 21` loads DS=CS and issues INT21 before transferring to the loaded MZ. This is the previously traced overlay boundary, requiring copy/stack/segment analysis beyond a direct-call CFG. No CD request follows from AX=4B03h itself. |

WORMS has no `cd 2f` in its explicitly retained bytes. This supports a narrow
statement about its unchanged literal instructions, not about helper programs,
indirect calls or dynamically created code. No observed startup success follows.

WRMS has exactly one retained `cd 2f`: image 0x2322, file 0x2382, followed by
RET. The three bytes `cd 2f c3` hash to
`2742d4966037c66d4fe05a550bf55cf1c05c332519f3789c416e5166ff3ed55a`.
It sits in the runtime's three-byte-per-interrupt table beginning at 0x2295.
Wrapper 0x2230 clears BH and computes table target **0x2295 + 3 × BL**;
0x2273 loads AX/BX/CX/DX/SI/DI/BP/ES/DS from a supplied register frame and RETF
dispatches through the stacked target. Thus BL=2Fh would select 0x2322, but no
concrete BL=2Fh/frame AX=15xx caller is established. The table entry is executable
generic machinery, not a data false positive and not proof of MSCDEX usage.
One concrete candidate caller of wrapper chain 0x1d61 → 0x200d → 0x2230 is
0xe9e–0xeae: it sets the input frame's AH byte to **52h**, passes AX=**0021h**
as the interrupt number, and supplies the stack register frame. The wrappers
preserve that number into BL, selecting **0x22f8: INT21; RET**, not INT2F.
0x2273 restores the frame's AX before dispatch. AL and the other frame values
are not fully initialized in this local window; no missing values are invented.
The independent 0x1de6 wrapper accepts a caller-supplied interrupt number;
its reachability/arguments are unresolved here. No constant 1501h/1510h MOV AX byte pattern is retained; that
search cannot exclude register arithmetic, frame-driven values or missing code.

## Exact missing evidence

| Program | Retained coverage and missing boundary |
|---|---|
| SETUP | Original prefix [file 0,2000h); load-image bytes end at 1fb0h. Header entry is CS:IP=0000:26b2, **file 2702h**, outside the prefix. Prefix function bodies and INT21s cannot be assigned an entry path. Bytes from that entry and its reachable application/initialization/device functions are missing. Packing/unpacking behavior is not established. |
| DOS4GW | Prefix [file 0,1000h); image end e00h. Entry CS:IP=01bd:2382 gives image **3f52h**, file **4152h**. The inspected prefix contains neither its entry nor enough runtime/transition code to trace real/protected interrupt bridging. |
| WRMS LE main | LE header file 2a50h, object table 2b14h, page map 2b44h, fixup page table 2c86h, fixup records begin 2dc2h. Prefix ends at file 4000h; fixups are incomplete. Data pages start at **file 1ae00h**, so **zero LE code pages** are retained. Entry is object 1 offset **34a3ch** (object page index 52, in-page a3ch; logical module page 53). A physical file offset requires the page map/flags, not assumed contiguous placement. |

The retained WRMS i8086 text after image offset 29f0h (file LE header 2a50h)
is metadata interpreted in the wrong execution context. It cannot establish
main-game CD opcode absence, support, packing or a call path. Required missing
evidence is the exact original entry/application pages and relevant callees,
page-map/fixup context and correct 32-bit disassembly (or a separately authorized
original call trace with register frames and mode/selector state). No such media
recovery or runtime probe was attempted here.

## Current implementation boundary

Compared files: `tools/toyvm/mscdex.js` and the dirty `tools/toyvm/dos.js`,
with their CD-media dependencies pinned in `source-pins.json`. No production
file was edited. `dos.js` routes AH=15h through `int2fMscdex`.

| Service | Implemented behavior versus demonstrated original dependency |
|---|---|
| INT2F AX=1500h | Mounted drive count in BX, first drive in CX when present. No demonstrated original caller. |
| 150Bh / 150Dh | Drive membership with BX=ADADh / sorted drive list into ES:BX. No demonstrated original caller. |
| 1505h / 1508h | Descriptor / cooked sector reads from mounted providers; bounded ES:BX transfer, drive CX, descriptor DX or sector SI:DI/count DX. No demonstrated original caller. |
| 1501h / 1510h / 150Ch | Device-header list / device request dispatch / MSCDEX version are unhandled; source makes no version or audio success claim. Retained originals do not prove which is needed. |
| Protected buffers | `destination()` rejects protected non-VM86 buffers; 1505/1508 return not-ready 21, 150D takes the unhandled path. Scalar 1500/150B do not use this buffer gate. A real-mode/VM86 thunk could satisfy buffered services within their bounds; no original extender thunk has been traced. |
| INT21 AX=4400h | Existing DOS handler returns handle/device information; this corresponds to the demonstrated generic code. It does not create a CD-driver header or implement CD control packets. AX=4401h currently returns invalid function, but these library sites have no established original entry path here. |

`Machine.lin()` still masks the DOS offset to 16 bits in protected mode;
selector-base support is not general 32-bit-pointer support. Neither this fact
nor the MSCDEX buffer refusal proves that DOS4GW bypasses a thunk or fails.
The README/CUE's CD-data/audio contract remains valid independently of the
unresolved original call sequence.

The next necessary boundary is **evidence of an original installer or protected
game CD call**, including caller reachability and register/request-buffer values.
The present evidence supports retaining the bounded subset and generic IOCTL
semantics; it does not justify choosing 1510h/device headers/audio/thunk work as
the next demonstrated dependency. Under the retained-only constraint this
boundary cannot be resolved further. No build, guest, native/browser/VM/WASM,
game, service or worker was run. Box ID none; state NOT_CREATED; expiry null;
stop receipt not applicable. Task-local watcher/deadline shutdown is recorded.
