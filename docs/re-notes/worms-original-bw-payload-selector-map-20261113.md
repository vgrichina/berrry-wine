# Original DOS4GW: BW modules and the embedded selector-0070 handlers

2026-11-13 — **NO_NATIVE_RESULT**. Static original-byte evidence locates the
initial protected handlers in the DOS-loaded **MZ segment 0991h**, independently
of the appended BW modules. It also parses five BW module spans, their segment
records and 1,110 relocation offsets. No original instructions were executed,
and no decompression or speculative unpacked address translation was performed.

**Correction to the [preceding routing note](worms-original-dos4gw-entry-routing-20261113.md):
the initial own INT21 gate is `0070:0C9E`, not `0070:05EB`. `05EB` belongs to
INT23.** The preceding note's retained original bytes already demonstrate this;
its prose mislabeled the slot. INT31 remains `0070:44D6`.

Run: `scratch/runs/20261113-worms-bw-mapping-1840/`. This is a static format and
mapping result, not installation, extender startup, native execution, gameplay,
audio, MSCDEX compatibility or screenshot acceptance.

## Identity and custody

The prior run's **47 seals** passed before reuse. Its retained header and windows
did not cover the needed loader/descriptor instructions, so the one authorized
recovery used the same six root-member-only ranges, without retry. Root
`DOS4GW.EXE;1`, LBA 34, length **265420**, SHA-256
`dd9f4f342533f99570475b62e53231a468de2e3d83e4fc31e80c27d3a7d6b49c`
passed complete identity before static extraction. `http.json` records all six
HTTP 206 responses, exact Content-Range total 578432064, Content-Length,
received lengths and response hashes; sector sync and Mode 1 were checked.
The raw union is `[79968,384620)`; extraction uses
`(34 + memberOffset//2048)*2352 + 16 + memberOffset%2048`.

The exact member existed only at `/dev/shm/worms-bw-mapping-1840.exe` and was
removed after live checks. `ram-removal.json` records its final hash and removal.
No peer member, duplicate, whole CD, denied retry, bypass or media on `/home`
was used. The recovery ran under an independent 360-second GNU timeout with
TERM and five-second KILL escalation. No box was created: ID **none**, state
**NOT_CREATED**, expiry null, stop receipt N/A.

## The mapping that establishes the handlers

Let `L` be the unobserved MZ load segment and `P` the current 32-bit paragraph
value in `DS:0A12:0A10`. Entry-segment offsets below map to file
`1DD0h + offset`; protected-block offsets map initially to **`9B10h + offset`**.
Neither formula treats a protected selector as a paragraph.

1. MZ relocation **44** targets file **C10h**, initial word **0991h**; file
   C12h is zero. This is the initial `DS:0A10` field because startup DS/SS
   addresses the MZ load-image base. Thus initially `P = L + 0991h`.
2. Helper **1F24h** is exactly `MOV AX,0F28h; SUB AX,0991h; SHL AX,4; RET`.
   It returns **5970h**, a size, not an allocation address. The embedded block's
   original file base is `200h + 9910h = 9B10h`.
3. The GDT template begins at DS:08C0. Its selector-0070 slot is **DS:0930**,
   with access byte **9Bh** and a 16-bit code-segment default. Routine
   **199Ah**, specifically **1A4Dh–1A6Dh**, writes its base from `P << 4`.
   **1F2Eh** refreshes the limit to **596Fh**, writes all four base bytes from
   `P << 4`, and requests descriptor index **0Eh** through **1CAAh**.
   That constructor multiplies the index by eight: `0Eh * 8 = 70h`.
4. The initial gate loop at **016Ch** installs selector 0070 in every default
   gate. Its override words give the table below. Gate address is
   `00C0h + vector*8`, not `vector*4`.

| Initial own gate | Offset-word address | Embedded original file offset |
|---|---:|---:|
| INT21 `0070:0C9E` | 01C8 | **A7AE** |
| INT23 `0070:05EB` | 01D8 | **A0FB** |
| INT31 `0070:44D6` | 0248 | **DFE6** |
| INT33 default `0070:00CC` | 0258 | **9BDC** |

The helper's paragraph-rounded extent ends at file F480h, but the declared
MZ load ends at **F474h**. Only **5964h / 22884** bytes of this block are
file-backed by the MZ image. The final twelve bytes of its rounded allocation
are not demonstrated DOS-loaded bytes; the following BW header must not be
silently assigned to that tail. All handlers above are within the file-backed
part. Its hash is
`b243ce000a8ad112a7761b92d5915826584b771f87b289602d11075f59a5575a`.

`P` is mutable. The far allocator at MZ segment 0000:0B12 adjusts its low word
when it moves the entry code. **1E9Fh–1EDEh** has a low-memory path that updates
0A10, then explicitly `REP MOVSW`s the helper-sized block to its new paragraph
base and refreshes the descriptor. Its branch requires 0A12=0. A separate
**5932h–5991h** path requests allocation, a transfer from selector 70 to 60
through helper **6102h**, then updates 0A10/0A12. The latter helper's body is
not retained here; a complete proof of the high-memory copy remains open.
No concrete allocation result or runtime linear base is claimed.

## External DPMI is a separate descriptor construction

After the conditional host entry, **6FD9h** requests six descriptors with
INT31/0000. It obtains the selector increment at 6FC6h and advances BX three
times before saving the replacement selector at **0C3C**, **0AF4**, **0A00**
and **0A08**. The selector value comes from the host, not a constant 0070.

**702Ah–7044h** gets that descriptor, replaces its low limit word with
`1F24()-1`, multiplies **only the low word 0A10** by 16, and writes the
result into descriptor base bytes 2–4. It sets the descriptor and loads DS
from BX at **7046h**. **7071h–707Bh** derives access rights from current CS
and calls INT31/0009. **707Dh** loads CX from the new DS; **70BAh–70BFh**
installs INT21 at **CX:0C9E**.

Consequently the handler offset is the same embedded-block offset. It is
not entry segment 01BD:0C9E. However, this constructor leaves descriptor
**base byte 7** as obtained from the host and ignores 0A12 in its multiplication.
Its full symbolic base is therefore
`(hostDescriptorByte7 << 24) | (word[0A10] << 4)`.
Equivalence to the low-memory block requires that retained high base byte be
zero and the block be in that low paragraph context. Host return values and
success of all relevant calls were not observed. Do not promote this conditional
mapping into a measured DPMI-host address or into the high-memory own path.

The external loop covers INT10–2E with exclusions; it does not install INT33.
It patches protected offset **0400h** into a far jump to **5692h** at
7051h–705Bh. Thus the own initial default-stub path below must not be attributed
unchanged to external-host INT33.

## What the actual handler bytes establish

All protected listings use the descriptor's 16-bit code context, with the
original operand/address overrides preserved.

* **INT21 / 0C9E:** builds a saved-register/stack frame, obtains the extender
  data selector through CS:5680, and indexes its handler table after incrementing
  AH. For AH30, table word at **06CC** is **0CFC**. That path calls **0D73**.
  If DS:002E is zero, 0D73 goes to **0D43**, which passes vector **21h** and
  frame pointers through the published far pointer at DS:0022. The prior
  external initialization publishes the **7364h** INT31/0302 wrapper there.
  If DS:002E is nonzero, it far-jumps **0018:1068**. That entry-segment routine
  prepares the saved registers, calls the mode helper **092Ch**, issues the
  literal **INT21 at 10B5h**, and later returns through **0070:0D81**.
  These bytes demonstrate the two forwarding paths; no DOS version result is
  invented.
* **AHFF:** increment wraps FF to zero; table word **066A = 08B4** selects
  the extender service dispatcher. It uses the saved DX high byte as a table
  index (maximum 1Ah), not AX's low byte. Table **0C30 = 08DD** selects
  subservice zero, which checks AL <=5 then exchanges AL with DS:0980.
  Here AL was loaded from saved DX, so the argument is DL. The preceding WRMS
  FF00 call cannot be assigned a result without its register/state context.
* **INT31 / 44D6:** saves a frame, checks stack/caller descriptor attributes,
  selects an AH group through **44B8**, then an AL function. Group zero's
  pointer is **4420**, whose function-six word at **442C** is **4711**.
  That routine calls selector validator **4550**, reads descriptor base bytes
  2/3/4/7, writes the low/high words to saved DX/CX and returns through **4547**.
  The requested selector, validation result and returned base remain runtime
  inputs, not inferred WRMS selector values.
* **INT23 / 05EB:** starts `MOV AX,4C00h; INT21`. This also independently
  explains why identifying it as the DOS version-service gate was wrong.
* **Own initial INT33:** offset **00CC** contains `CALL 0400h` followed by
  inline vector byte **33h**. The common routine reads that byte through the
  saved return offset, stores the vector at DS:09CC and far-jumps
  **0018:092C**. This establishes the initial stub/transition path, not the
  eventual real-mode mouse implementation, a later override, or an external
  host's INT33 ownership.

Selected code hashes (full windows and file-offset provenance in `windows.json`):

| Window | Bytes | SHA-256 |
|---|---:|---|
| protected INT21 entry | 94 | `f2ec6de0b9ad39bc8df3a0a0e61bf3ce99ce61f8a0654df2eda8fd04b0b30273` |
| protected INT31 dispatcher | 122 | `3652428fb0a3a00480c714f513129c61be63e73e9753a61755bbfef3af04c7f1` |
| helper 1F24 and descriptor refresh | 59 | `aabd9204fe217a12988b057029ecb26d409bc71598cfaa1a4da26ecfc232b5b1` |

## Actual BW records and the remaining load-context boundary

Reader **304Fh** seeks using DS:11DC:11DA, reads the requested header, skips an
MZ using **300Bh**'s page-length arithmetic, and recognizes BW. **30D8h** reads
B0h bytes for the configuration scan. **31B3h** is configuration aggregation
after that scan, not a payload decompressor. The scan follows the absolute
next-header dword at **BW+1C** when nonzero; its final target can be a trailer.

The actual load routine **32C6h** reads 1Ch bytes, saves the following four-byte
next pointer, then **adds 30h to 11DA**. Its subsequent seek at **33F7h** adds
80h to this adjusted base. The descriptor table is therefore at **BW+B0h**,
not BW+80h. Failing to account for the first addition reads reserved zeroes.
Header words **+38/+3A** supply the last selector byte and first selector;
the table contains `(last-first)//8+1` eight-byte records.

The loader consumes these records as an initial limit word, access byte at +5,
and allocation/context word at +6. **347Ah–34B4h** computes allocation paragraphs
as `min((limit+16)//16, context & 1FFFh)` for nonzero limit; bit **2000h**
sets the stored-data length to zero. For these records, the stored byte count
is zero for an absent record, otherwise the retained SI limit plus one when
its low nibble is nonzero. **364Ah–3657h** shows that increment before calling
**3A89h**. This describes the observed record convention, not a general BW
format specification. Context bits 8000h/4000h also participate in allocation
and bookkeeping branches; they are not labeled compression flags here.

| Module | BW file base | Segment data spans: selector / file offset / bytes | Next offset | Fixups |
|---|---:|---|---:|---:|
| EXPLOAD.EXP | F474 | 80/F544/52E0; 90/14824/C80; 98/154A4/150 | 155F4 | 160 |
| LINEXE.EXP | 155F4 | 80/156C4/9150; 90/1E814/1D60; 98/20574/1E0 | 20754 | 236 |
| INT31W.EXP | 20754 | 80/20824/3B90; 90/243B4/C60; 98/25014/150 | 25164 | 163 |
| WVMM.EXP | 25164 | 80/25234/B300; 90/30534/1DB0; 98/322E4/230 | 32514 | 275 |
| DOS4GW.EXP | 32514 | 80/325F4/B950; 88/3DF44/130; 98/3E074/2A00; A0/40A74/240 | 40CB4 | 276 |

All table numbers are hex except the decimal fixup counts. Omitted slots are
zero stored length, not missing data. `format.json` records every descriptor,
allocation count, segment hash, and zero-fill remainder. In all five modules,
the header dword **+20** equals the exact next-offset minus module-base span.
After the fifth module, **40CB4** contains the 24-byte trailer
`WATCOM patch level .a` with terminators, not another BW header.

Header word **+12** supplies the relocation stream selector: 98 in the first
four modules and A0 in the fifth. **3730h–3785h** and **3D80h–3E18h** establish
groups of tagged target selector, count, then count word offsets. Masking the
target with FFF8h selects the target segment. Low bits end a stream; bit 2h
terminates the sequence. Every actual stream here terminates with bit 2h in
its only relocation segment. All 1,110 offsets fit their target allocations;
the parser consumes the count lists and verifies zero tail padding. The rebase
routine adds a selector delta to target words >=80h. No runtime delta is
assumed and no fixups are applied to guessed runtime storage.

**3A89h** maintains a byte-counted input buffer and calls **6102h** with source,
destination and length. Its refill **3A13h** constructs DOS seek/read requests.
The retained windows establish disk spans and call arguments; the body of
6102h and all possible module-selection/placement branches are not established
by this run. No claimed decompressed image, actual allocation base or complete
BW runtime map follows from these disk spans. Further work on that branch
requires actual helper bytes and its selected allocator context. It does not
justify using any appended module's unrelated bytes for the embedded handlers.

## Reproduction and validation

Offline, from the checkout root:

```sh
python3 scratch/runs/20261113-worms-bw-mapping-1840/check.py
```

`parse.py` and `windows.py` require the exact RAM member; `recover.py` is the
retained six-range recipe, not authorization for an additional request. The
window helper uses bounded GNU objdump only. Final evidence retains **30 code
windows / 2646 bytes**, small header/descriptor/relocation slices and hashes,
not a member or source archive.

**294 live checks** and **240 offline checks** passed: prior seals, exact
member/window/segment hashes, disassembly-column coverage, constructor/service
opcode pins and changed-code mutants, gate-index arithmetic, all five segment
span/relocation parses, malformed headers/tables/allocations/relocation counts
and offsets, strict HTTP receipt/header mutants, and Mode 1/header mutants.
The offline result does not claim to hash removed media.

The run preserves exact Git SHA, relevant uncommitted diffs, full owned-new-file
patches, helper patches, tool versions and SHA-256 seals. Only this note is
committed; production remains untouched. Docs-only whitespace and strict
pull/push validation apply; no build, Machine, DOS guest, VM, WASM, native,
browser, game, box or worker was used. The own board watcher was stopped.

Next work is the actual 6102/allocator branch if a complete BW load map is
needed, then later vector overrides and WRMS's selected runtime register/frame
context. No newly demonstrated MSCDEX AX15xx caller or protected-buffer
incompatibility is claimed.
