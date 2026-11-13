# Original DOS4GW: own-initial protected/real interrupt bridge

2026-11-13 — **NO_NATIVE_RESULT**. Original bytes establish the own-initial
INT33 bridge's frame layout, real-vector invocation and protected result
restoration. They do **not** establish that WRMS ran with these initial vectors,
that the reset-based transition returned, or any actual mouse/DOS result.
Original startup, installation, gameplay, audio and screenshot acceptance remain
**OPEN**. No production file changed; no original instruction was executed.

Run: `scratch/runs/20261113-worms-interrupt-bridge-2120/`.
Read alongside the [copy-helper routing](worms-original-copy-helper-routing-20261113.md),
[BW/descriptor mapping](worms-original-bw-payload-selector-map-20261113.md),
[LE frames](worms-original-le-entry-service-path-20261113.md) and
[entry routing](worms-original-dos4gw-entry-routing-20261113.md).
The correct initial own gates remain **INT21=0070:0C9E**, **INT23=0070:05EB**,
**INT31=0070:44D6**, **INT33=0070:00CC**.

## Selector 18 is constructed, not multiplied as a paragraph

Let `L` be the unknown DOS MZ load segment, `C=word[DS:09B6]`, and
`D=word[DS:09B4]`. MZ relocations 9 and 8 target file **0BB6/0BB4**, with
addends **01BD/0000**. Thus initially `C=L+01BD`, `D=L`, subject to DOS word
relocation; later relocation/movement must use their updated values.

The GDT template at data **08C0** has selector **18** at **08D8**:
`FFFF 0000 00 9B 00 00`. Its limit is FFFF, access is 9B and D=0.
**199A**, specifically **1A1D–1A33**, loads C, clears DX, shifts DX:AX left
four through **27A4**, and writes base bytes at **08DA/08DC**. Byte 7 stays
zero. Therefore this own constructor gives selector18 base **C<<4**, 16-bit
code. The analogous selector20 template at **08E0** has access93/B=0 and
gets its base from D. This is descriptor evidence, not `18h<<4` arithmetic.

Consequently own-initial **0018:092C**, **0018:0EF8**, **0018:0F34** and
**0018:1068** map to entry-code offsets, whose original file formula is
**1DD0+offset**. Selector70 instead uses the separate embedded-block mapping
**9B10+offset** and the mutable paragraph pair established by the earlier notes.
No numerical runtime linear address is observed.

## INT33 saves a 32-bit interrupt frame and builds two word frames

The sealed stub **0070:00CC** is exactly `E8 31 03 33`: word `CALL 0400`,
then inline vector **33**, not executable fall-through code. The own gate is
a **32-bit interrupt gate** (8E00), although the target code descriptor is
16-bit. The common handler saves word registers, pops the stub return into SI,
records the original ESP, and pops **three dwords**, with explicit 66 prefixes,
into saved EIP, padded CS and EFLAGS. This is the own frame ABI consumed by the
code; a different privilege/stack entry context is not silently substituted.

Define **B = old word[0996] - 0180h**, **S = B - 0032h**. All offsets below
are hexadecimal bytes; a word is two bytes, a dword four.

| Stored location | Meaning before the outbound switch |
|---|---|
| B+02 / B+04 / B+06 | original SS / DS / ES words |
| B+1E / B+22 / B+26 | original EIP / padded CS / EFLAGS dwords |
| B+2A | original ESP pointing at the protected interrupt frame |
| S+00 | word continuation **0EF8** |
| S+02 / S+04 | DS / ES words for the real service |
| S+06,08,0A,0C,0E,10,12,14 | PUSHA-order DI,SI,BP,ignored-SP,BX,DX,CX,AX words |
| S+16 / S+18 / S+1A | real target IP / CS / FLAGS words; IP/CS filled later |
| S+1C / S+1E / S+20 | service return IP=**0F34** / CS filled at 0EF8 / FLAGS |

The original FLAGS low word is saved also at data09CA. The S+20 copy has
**TF cleared**; the S+1A copy additionally has **IF cleared**. The vector byte
is saved at data09CC. The handler switches SS to20, SP to S and far-jumps
**0018:092C**. This frame uses word saves; it is not a DPMI 32h-byte register
structure, and it does not demonstrate arbitrary protected-buffer translation.

## The exact outbound boundary, then the real-vector transfer

**092C** is `NOP; JMP word[09BC]`. Initially 09BC=**0A9F**;
09BE=0AA4, 09C0=02FC, 09C2=02B5 and 09C4=0022. These are mutable dispatch
words, not a measurement after initialization.

**0A9F** saves AX (whose low byte is the vector) and BX=S, then loads BX
from a relocated immediate initially equal to D. **0AA4** masks the PIC,
saves word registers/FLAGS, pushes C and continuation **0B3F**, reserves
word[09C4] bytes, and writes **SS:SP** to low-memory **0469:0467** through
selector38. State byte **0ED0** selects either `OUT 64,FE; HLT` or loading
an empty IDT followed by `INT FF`. This crosses a **firmware/reset boundary**.
Neither firmware code nor its restored register/stack state is in this member.
The reserved gap and intended return words do not prove a successful return.

The preparation through **08B2/033C** saves low-memory reset/vector context;
the **0B3F/0360** continuation restores that context, restores word registers
and the PIC mask, conditionally handles state0035/003F, then pops BX/AX and
returns through S to **0EF8**. Separate **0AE2/0B14** code saves a different
return context; it is retained as an alternate window, not selected here.
No BIOS behavior, CMOS outcome or alternate machine branch is invented.

**If this transition returns with its intended real-mode context**, 0EF8
stores real CS at S+1E and exchanges AX/BX, giving BX=vector and preserving
S in AX until the target fetch. It computes **4*vector**, chooses ES=0 by
default, and can use a saved-vector table only for vectors **08..2E** with a
nonzero flag at data[10BE+vector]. For **33**, `4*33-20=AC >98`, so that table
branch is excluded regardless of its flag. The actual target is therefore
the **real IVT dword at 0000:00CC**, not a guessed mouse address.

If the target segment word is zero, **0F22/0F31** takes **0251**; no mouse
result follows. Otherwise **0F27/0F2A** patch the target CS/IP at BP+16/BP+14
with BP=S+2. `POP DS; POP ES; POPA; IRET` restores the saved word inputs and
consumes the first six-byte frame. The handler sees the second six-byte return
frame at S+1C. This is a concrete vector invocation using **16-bit IRET**;
there is no literal INT33 opcode in this common real-mode path.

## Result restoration and the stack-width prefix branch

If the selected real handler returns through its expected interrupt frame,
**0F34** captures returned FLAGS, disables interrupts, saves DX, **EBX as a
dword**, BP, DS and ES, reloads the relocated data paragraph and obtains B
from0996. It calls **0290**, then pops returned ES into DX and far-jumps
**0070:047C**. The call uses mutable **09C0/09C2**; their initial own path
includes **02FC →0018:0334 →2978 →0337**, with optional paging/task restoration
at2978. Selected control registers, dispatch mutations and service success are
unobserved.

**047C** uses the saved original SS as DS and `LAR` tests its descriptor B bit.
At **0493**, `JAE 0496` skips precisely the **66** prefix at0495: the small-stack
path executes `MOV BX,[BP+2A]` after EBX was cleared; the big-stack path executes
`MOV EBX,[BP+2A]`. The retained secondary decode at0496 verifies this intentional
instruction entry. Reading only a linear listing misses the word-width branch.

The code reconstructs the protected return at the saved stack offset: original
EIP dword, original CS word, original upper EFLAGS word, and returned FLAGS low
word masked with **0EFFh** (`AND DH,0E`). Returned ES/DS survive only if equal
to their original selectors; a changed segment value is replaced by zero.
It restores the arena cursor by0180, restores original SS and ESP, then pops
DX, DS, BP and dword EBX and finishes with **66 CF / IRETD**. AX/CX/SI/DI
results are carried through the continuation, rather than copied from an
invented DPMI frame. The code provides no general conversion of a real-mode
output segment into a protected selector. No full upper-register guarantee or
actual service result is inferred from these word-oriented saves.

## What connects to WRMS, and what remains conditional

The recovered WRMS path **5A3D →3576A →35AE2 →37DCA →37E02 →37F41** loads
EAX/EBX/ECX/EDX/ESI/EDI from input-frame offsets **00/04/08/0C/10/14** and
DS/ES from the segment snapshot. Only the first **word** of the 1Ch-byte input
frame is cleared by the mouse caller: **AX=0000** is justified; upper EAX,
other frame contents, actual selectors and flags are unknown. If its INT33
still uses the own-initial gate, the word AX slot above reaches the real IVT
handler as zero. That handler address, installed mouse driver and returned
AX/BX/etc. remain unknown.

On return the WRMS wrapper writes six register dwords at those same offsets
and carry as a dword at18 (`SBB EAX,EAX`). Its caller tests the returned low
word at00 for zero. This connects the frame fields and return test without
claiming mouse presence or absence. The bridge's low-FLAGS mask preserves CF;
it does not establish the CF value returned by any original driver.

For startup **INT21/AH30**, the own gate/table routes through **0CFC →0D73**.
With state002E nonzero, **0018:1068** uses the same092C transition helper,
loads the saved word registers, executes literal **INT21 at10B5**, captures
FLAGS and results, reenters through0290 and jumps **0070:0D81**. Newly retained
**0D81–0D9E** restores the protected caller stack and nesting state; the sealed
**0CFF–0D37** copies eight result words, updates FLAGS and ends in IRETD.
This DOS-specific frame is separate from the generic INT33 S layout. No DOS
version is assigned. State002E=0 instead uses the published pointer at0022;
the external-host wrapper remains conditional.

The conditional WRMS **FF00/DX0078** operands are exact word writes. With the
own-initial dispatcher still installed, saved DH=0 selects subservice0 and
saved DL=78 fails its `AL<=5` test: the static branch writes AX=FFFF and goes
to08D7 without the successful exchange at08E6 or carry clear at08D3. This is
a conditional code consequence, **not an observed runtime result**. The later
INT31/0006 likewise needs WRMS's actual DS and descriptor-validation result;
the earlier selector-base decoder does not supply those values.

An external DPMI host patches protected0400 into a different far jump and uses
host-selected descriptors; it cannot inherit this ABI automatically. Own high
placement may move selector70's block without changing its offsets. Later BW
modules/WRMS initialization may override vectors. None of those selections or
overrides is proved. The next concrete context boundary is the runtime state
of **09BC/09C0/09C2**, descriptor18/20/70, the reset/firmware return frame,
real IVT33 and WRMS's actual gate and register frame after initialization.
These are required before assigning addresses, results or compatibility.

## Reproduction, identity and custody

All **220 prior seals** passed before reuse (55 copy-helper, 68 BW, 50 LE,
47 entry-routing). Missing continuation bytes required the one authorized
root **DOS4GW.EXE;1**, LBA34, **265420-byte** recovery. The unchanged six206
range recipe verified exact Content-Range/Length/received lengths, identity
encoding, Mode1/sync and full SHA-256
`dd9f4f342533f99570475b62e53231a468de2e3d83e4fc31e80c27d3a7d6b49c`
before extraction. Its raw union was **[79968,384620)**, total578432064.
No whole CD, other member, denied retry, bypass or media on /home was used.
An independent prearmed GNU timeout imposed **360s**, TERM then KILL after5s.
The exact RAM member was hash-verified again and removed (`ram-removal.json`).

`python3 scratch/runs/20261113-worms-interrupt-bridge-2120/check.py` reproduces
the **596 offline checks** against retained code/data and prior sealed evidence;
**615 live checks** passed before RAM removal. New code evidence is **15
windows / 915 bytes**, plus three small data slices.
Checks cover exact bytes/disassembly coverage, descriptor fields/relocation,
word/dword frame offsets, both stack widths, real-vector table bounds, FLAGS
halves, WRMS operand provenance, changed-code/vector/HTTP/Mode1 mutants.
Synthetic sentinel frames are serialized-layout arithmetic, never instruction
execution. `window-specs.json` and `window.py` reproduce bounded objdump windows
only with a verified member; `recover.py` records the one-use recipe and grants
no further fetch permission. Exact code hashes are in `windows.json`.

Exact Git SHA, relevant uncommitted binary diff, owned new-file patches,
helper patches, test reports and artifact SHA-256 seals are retained; no source
snapshot/archive was made. Publication is docs-only whitespace validation and
strict main pull/push. No VM/CPU/WASM/guest/native/browser/GL/game/full build,
box or worker was used. Box ID none, state **NOT_CREATED**, expiry null,
stop receipt N/A; the task-local board watcher is stopped before sealing.
