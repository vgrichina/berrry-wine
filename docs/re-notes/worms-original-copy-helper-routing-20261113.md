# Original DOS4GW: copy helper and conditional placement routing

2026-11-13 — **NO_NATIVE_RESULT**. Helper **6102h is an ordinary byte copy**,
not a decompressor. Actual caller and descriptor bytes establish the symbolic
high-placement transfer and BW payload destination construction. They do not
establish which allocation, machine-mode or external-host branch was selected
by an original run. Original installation, extender startup, gameplay, audio
and screenshot acceptance remain **OPEN**.

Run: `scratch/runs/20261113-worms-copy-helper-2040/`. Only this new note is
changed in Git. The [sealed preceding mapping](worms-original-bw-payload-selector-map-20261113.md)
remains authoritative for initial **INT21=0070:0C9E**, **INT23=0070:05EB**,
**INT31=0070:44D6** and the initial embedded-block file base **9B10h**.
Entry-code offsets in this note map to file **1DD0h+offset**; protected-block
offsets map initially to **9B10h+offset**. Neither formula assumes a runtime
load base or treats a selector as a paragraph.

## Identity, recovery and bounded evidence

All **68 seals** of run 1840 passed before reuse. Its retained caller windows,
header/relocation evidence and descriptor listing were used first; helper 6102
was outside those windows. The one authorized fresh recovery read only root
`DOS4GW.EXE;1`, LBA 34, **265420 bytes**, SHA-256
`dd9f4f342533f99570475b62e53231a468de2e3d83e4fc31e80c27d3a7d6b49c`.
The unchanged six-range recipe checks HTTP 206, exact Content-Range including
total **578432064**, Content-Length, received length, identity encoding,
sector sync and Mode 1. The raw union is **[79968,384620)**; extraction uses
`(34 + memberOffset//2048)*2352 + 16 + memberOffset%2048`.

Full identity passed before window extraction. The member existed only in
`/dev/shm/worms-copy-helper-2040.exe`; `ram-removal.json` records its final
verified hash and removal after live checks. No other member, whole CD,
denied retry, bypass or media on `/home` was used. Recovery had a prearmed
independent **360-second GNU timeout**, TERM then KILL after five seconds.
No box was created: ID none, state **NOT_CREATED**, expiry null, stop receipt
N/A. No VM, CPU interpreter, WASM, guest, browser, GL, game, full build or
worker was used.

New evidence is **20 windows / 1803 bytes** plus six small data slices.
`windows.json` gives original file offsets, bytes, hex and SHA-256; `.asm`
files use GNU objdump's 16-bit context. Inline thunk words are retained as
data, not mistaken for instructions. In particular **22BBh and 3F74h below
belong to the protected block**, not the entry segment. Exploratory wrong-base
decodes were superseded by these exact final windows and supply no conclusions.

## Exact helper contract

Entry-code **6102h–611Fh**, file **7ED2h**, is exactly 30 bytes, SHA-256
`9a804e282d2e53aeaa20fc1dd8222de1eda3cb6ef8a2d1d20292ffb5a8ffa9ab`.
It saves BP, SI, DI and DS, then loads:

| Stack word after BP setup | Meaning |
|---|---|
| BP+04 | source selector into DS |
| BP+06 | source offset into SI |
| BP+08 | destination selector into ES |
| BP+0A | destination offset into DI |
| BP+0C | byte count into CX |

The operation at **6117h** is literal **F3 A4 / REP MOVSB**. Offsets, count
and arguments are all **16 bits**; there are no 66h/67h overrides. CX=0 copies
zero bytes. ES and CX are not restored; DS, SI, DI and BP are restored. The
routine neither checks selectors/limits nor reports a transfer result. It has
**no CLD**: direction is inherited from DF. Thus forward copying additionally
requires DF=0; it is not an overlap-safe general memmove. These are instruction
semantics, not observations of an executed transfer.

## Own high-placement transfer

The full entry routine starts at **58E6h**. Its first test is specifically
signed `word[0A12] < 1`; otherwise it returns at 5990h. It clears the candidate
paragraph pair. If byte **0047 bit 80h** is set, it builds an **INT15** request
with AX=BFDEh, BX=2, CX=DX=0 via **6084h**, then returns. This branch does
not perform the 6102 copy and is not assigned an invented BIOS result.

On the ordinary branch, **5932h** gets the **5970h-byte** block size from
1F24h, calls **198Ah**, then requests **0597h paragraphs** through **1E68h**.
The result is a symbolic paragraph value **Q = DX:AX**, saved at BP-12/BP-10.
Zero skips the descriptor/copy. A nonzero result calls **1E7Ch** with:

`selector=0060, paragraphLow=Q.low, paragraphHigh=Q.high, limit=FFFF, access=92`.

This is not a guessed descriptor API. The inline word following 1E7Ch's call
is **3F74h**. The actual protected routine **3F74h–3FB2h** masks the selector
with FFF8h, loads DS=8 to write the descriptor table, stores limit and access,
shifts the entire DX:AX paragraph pair left four times, and stores all base
bytes **2,3,4,7**. It reloads SS, restores flags and returns with DS=20.
Its 63-byte hash is
`e8c9a59bb44f52abdaa4075208e2835919f7d9ed84b1b4766b2e684bde14bcd7`.
Selector 60 is a writable data descriptor with 16-bit default in the retained
template; the routine leaves byte 6 unchanged. This establishes destination
base **(Q << 4) modulo 2^32**, with 64 KiB limit, in this own-table context.

**5964h–596Fh** passes helper 6102 the exact tuple:

`source=0070:0000, destination=0060:0000, byteCount=5970h`.

After **11C1h**, a nonzero saved Q is written to **0A10/0A12**, then **1F2Eh**
refreshes selector 70's **596Fh limit** and full paragraph-derived base.
Consequently the same handler offsets can refer to the copied block at Q's
base; literal original file9B10 is then provenance, not a runtime linear base.
The requested rounded size includes the preceding note's twelve-byte tail
beyond the declared MZ-loaded extent: source contents of that tail are still
not established by file-backed code evidence.

The allocation thunk's inline target is **22BBh**. **1E86h** consumes that
target word, saves the caller return on the stack indexed by **0AFA**, pushes
protected continuation **3E8Fh**, and far-jumps through **0AF2**. Initial data
at file CF2 is `A3 3E 70 00 9D 1E 18 00 FA 0A`: outbound pointer
**0070:3EA3** and inbound **0018:1E9D**. Both endpoints are `JMP CX`.
Protected 3E8F pops the saved caller return, decrements 0AFA and uses 0AF6.
This explains how 1E68 reaches protected 22BB without interpreting its inline
word as entry-segment instructions or executing any of them.

The complete retained **22BBh–24E3h** allocator follows a list bounded by
DS:0098:009A and 009C:009E, reads link and size fields through **4031h**, rejects
insufficient blocks, splits a larger block and rewrites links through **4047h**.
The ordinary success return **240Ah–2411h** returns the saved block paragraph
in DX:AX and accounts for the requested paragraph count through **2282h**.
It also has a **DS:002E=0Bh / 587Ch / 57B8h** conditional path and an exhaustion
path using **1206h, 40B7h and 3B52h**, which can retry or return zero. Neither
the free-list state nor those environment-dependent results is observed.
4031/4047 themselves branch on **DS:002F >=3**. These precise remaining
branches prevent assigning a concrete Q or claiming allocation success.

## BW reads and destination descriptors

The sealed **3A89h** caller now has a resolved operation: it copies from
**0020:word[11D0]** into the destination selector/offset supplied as its first
two word arguments. It chooses the smaller available-buffer/request count
(a zero remaining request is handled by its existing wrap/count convention),
passes that word count to 6102, advances both offsets and subtracts the count.
Its refill **3A13h** forms DOS seek/read requests. This is buffered raw-byte
transfer; 6102 performs no data-format transformation.

New **34B4h–3645h** evidence supplies the preceding placement context:

* Zero allocation paragraphs leave a zero candidate. Context bit **8000h**
  (byte 11EB bit80) selects the DOS allocation route via **395Ch**, optionally
  adding seven paragraphs and aligning to eight. It can substitute the selected
  destination selector in local bookkeeping; it checks the descriptor is free.
* Otherwise **35ABh** calls **3901h** with the paragraph count. That routine
  first tries **1E68h** except when service state byte **0980=1** or signed
  **0980>=3**. Zero or bypass falls back through **11C1h ->395Ch ->198Ah**;
  failure then tries 1E68h again. **395Ch** forms DOS **AH48h** via 26D0h,
  returns zero on saved carry, otherwise the returned paragraph with DX=0.
* The resulting paragraph pair is saved at **1202/1204**. The loader builds
  descriptor bytes **11E4..11EB**, including limit `(paragraphs<<4)-1`,
  paragraph-derived base, access **F2h** and high base byte. At **3637h–3643h**
  it writes all eight descriptor bytes through the table selector/offset saved
  in the caller's BP-04/BP-06, indexed by `destinationSelector & FFF8h`.
  Context bit **4000h** separately marks the selector bookkeeping table.

The sealed **3646h–3679h** then calls 3A89 with that selected selector,
offset zero and the stored-data count, and zero-fills an allocation remainder
through **1E77h** when required. Resolving 6102 therefore supports the prior
BW **stored segment spans as direct input bytes**, conditionally transferred
to constructed destinations. It does not identify a measured destination,
successful DOS allocation, selected module/runtime selector delta, or a
fully loaded image. No speculative translation or decompression is applied.

## Low-memory and external-host boundaries

The separate **1E9Fh** low-memory move requires **0A12=0**, explicitly clears
DF, exchanges the old/new low paragraph value at 0A10, and uses **REP MOVSW**
for 5970h bytes before 1F2Eh. Its retained continuation updates the DOS-owned
block size through **AH4Ah/INT21**. When 0A12 is nonzero, its **1F0Ah** branch
instead computes an extent from the DOS MCB and rejoins the resize path;
it does not execute that low-memory copy. These branches must remain separate
from 58E6h's high-placement copy and from an external DPMI host.

The actual own transition context is partly established, without claiming a
working mode switch. **198Ah** supplies selectors **18h/20h/20h/20h** through
DS:001E. The retained original pointer is entry **0DB2h** at relocated MZ
segment 01BDh. It calls **0293h**, loads the requested DS/ES and far-returns.
0293h uses mutable dispatch words **09C0/09C2**; their original values are
**02FCh/02B5h**. The retained 02FCh path loads GDT/IDT, sets PE with LMSW and
far-jumps **0018:0334**, which branches to **2978h**.

Conversely **11C1h ->0D80h** checks descriptors before calling **0931h**.
0931h dispatches through mutable **09BE**, initially **0AA4h**. That actual
path writes a transition stack through selector38's offsets 0467/0469 and
branches on **0ED0**: a keyboard-controller reset request through port64 with
HLT, or an empty-IDT **INT FF** path. No reset outcome, resumed low-mode frame,
2978h continuation, or real-mode mouse service is proved here. In particular,
the preceding note's initial INT33 stub route does not by itself establish
which transition dispatch survived initialization or a later vector override.

External DPMI keeps its separate host-allocated selector and descriptor
construction described in the preceding note: the preserved host descriptor
base byte7 and low-word-only paragraph multiplication still limit that mapping.
The own high-placement full-width writer does not repair or prove that external
branch. The earlier offsets 0C9E/05EB/44D6 remain valid initial gate facts;
runtime descriptor/vector state remains the missing context.

## Reproduction and checks

`python3 scratch/runs/20261113-worms-copy-helper-2040/check.py` passes
**245 offline checks**; before RAM removal **263 live checks** passed. Nine additional static caller-parser
checks were subsequently added and passed offline (no additional recovery).
These cover prior seals, exact member identity, every retained window/data
hash, disassembly byte coverage and instruction boundaries, a closed parser
for the complete helper grammar, every single-byte helper mutant, truncation
and width-override mutants, allocator/descriptor/transition code mutants,
strict six-range HTTP receipts and changed status/length/range/encoding,
and Mode1/sync/short-header mutants. No original instructions are executed.

`recover.py` preserves the exact one-use recipe, not permission to fetch again.
`windows.py`, `window-specs.json` and `window.py` reproduce the bounded static
extractions given the verified RAM member. Exact Git SHA, relevant binary diff,
owned new-file/helper patches and artifact seals are retained in the run;
Git remains the source archive. Documentation whitespace and strict main
pull/push checks apply; no production edits or full build were needed.

The transfer/routing uncertainty at 6102 is resolved. What remains is concrete
allocator/environment state, the selected own-versus-external initialization,
transition continuations and later WRMS vector/frame context. Those require
new evidence; this static result is not native compatibility acceptance.
