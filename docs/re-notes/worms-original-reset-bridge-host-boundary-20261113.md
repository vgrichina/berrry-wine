# Original DOS4GW reset bridge versus ToyVM host boundary

2026-11-13 — **NO_NATIVE_RESULT**. ToyVM's current DOS host does not provide
the reset/firmware return required by the demonstrated **conditional own-initial**
bridge. The port-reset branch rejects FEh; the empty-IDT branch either reflects
through the IVT in the nonpaged engine or terminates with a shutdown error in
the paged delivery helper. Neither supplies the intended real-mode continuation.
This establishes a host primitive gap **if this path is selected**, not an
observed WRMS failure or proof that its later runtime selects this branch.

Run: `scratch/runs/20261113-worms-reset-host-2140/`. Read the
[retained original bridge analysis](worms-original-protected-real-interrupt-bridge-20261113.md)
for descriptor construction, original window identities and protected frames.
No production change was made. No original instruction, guest, CPU engine,
WASM module, native game, browser or full build was run. Startup, gameplay,
audio and screenshot acceptance remain **OPEN**.

## Exact conditional route and firmware contract

The retained member is DOS4GW.EXE, SHA-256
`dd9f4f342533f99570475b62e53231a468de2e3d83e4fc31e80c27d3a7d6b49c`.
All 47 sealed2120 artifacts, 15 original windows/915 bytes and three data slices
were hash-checked in place. No media recovery, download or staging was needed.
`windows.json` retains exact file offsets, byte strings, VMAs and per-window
hashes; source decoding here is not execution.

Selector18 is constructed with base C<<4 and D=0; selector20 has base D<<4 and
B=0. They are not paragraph addresses computed from selector numbers.
The initial mutable word09BC=0A9F makes 0018:092C reach the reset helper.
At 0AA4 it disables interrupts, saves the master PIC mask, word PUSHA and
FLAGS, then pushes C and 0B3F. It subtracts word[09C4], initially **0022**,
from SP. Through the base-zero selector38 it writes **SP at physical0467**
and the relocated data paragraph in BX at **0469**. This pair describes the
intended real stack, not directly a CS:IP continuation.

Byte[0ED0]=0 selects `MOV AL,FE; OUT 64,AL; HLT; JMP HLT`. Nonzero selects
writing the pseudo-descriptor limit at08D0 to zero, `LIDT16 [08D0]`, then
`INT FF` at0AE0. The condition's selected runtime value is not observed.
The latter sequence intends fault escalation, not a BIOS service numbered FF.

Beforehand, 08B2/033C saves the old0467/0469 pair at0F56, publishes a temporary
09DB/data-paragraph pair, and saves the 32 bytes at physical03E0..03FF
(IVT F8..FF). 08CA selects CMOS index0F and writes byte[10EE] through71.
Its selected value is unknown. On successful firmware return, 0B3F calls0360:
it restores0467/0469 and03E0..03FF, restores data ES, then POPA, restores the
PIC mask and eventually pops BX/AX and returns to0EF8. The retained0360 code
does not POPF. Original code continues to own further mode/state restoration.
The 0AE2/0B14 variant publishes a direct code return plus a separately saved
stack; it must not be substituted for the selected0A9F shape.

Intel specifies that an IDT limit violation faults, and failure while invoking
#DF causes processor shutdown. A zero IDT limit is explicitly a way to force
shutdown on an exception. Shutdown signaling and motherboard reset/firmware
handling are distinct from a CPU performing a software IRET. Gate type controls
interrupt operand width; SS.B controls implicit stack-pointer width, while66
changes instruction operand size. These rules support the original mixed
word/dword frames without proving a firmware return.
[Intel 80386 Programmer's Reference Manual, §§9.8.8, 9.8.13, 10.1, 16.1](https://css.csail.mit.edu/6.858/2012/readings/i386.pdf).

IBM's published AT BIOS gives a concrete example of firmware dependence:
its block-move service selects shutdown code9, and SHUT9 reloads SS:SP from
the BDA IO_ROM pair, handles A20, restores saved registers and uses a far return
with a two-byte adjustment. That service has its own stack contract. It does
not establish the selected CMOS code, BIOS revision or reserved-gap consumption
for this DOS4GW path. In particular, a **22h-byte reservation is not permission
to invent a BIOS unwind**, nor is writing0467 equivalent to setting the usual
warm-boot flag at0472. The retained windows do not establish a0472 write.
[IBM AT BIOS1.ASM, BLOCKMOVE/SHUT9, published-source transcription](https://raw.githubusercontent.com/Gawlas/IBM-PC-BIOS/master/IBM%20PC%20AT/AT%20BIOS%20V3/BIOS1.ASM).

## What ToyVM actually does

References below use the pinned working files, including incoming WIP, rather
than claiming that HEAD alone reproduces the shared checkout.

| Boundary | Current source behavior | Consequence within this conditional route |
|---|---|---|
| OUT64,FE | `dos.js:3470` `portOut_` accepts only D0/D1/FF controller commands; FE throws `Unsupported 8042 controller command 0xfe` | No reset or arrival at HLT/0B3F |
| D1/output-port reset | Clearing output bit0 throws `Unsupported 8042 CPU reset request` | This alternative is also unsupported; not the demonstrated opcode |
| CMOS70/71 | Output falls through and is dropped; reads float FF | No stored shutdown byte/NMI latch consumed by firmware |
| PIC21 | Mask write/read supported | Saving/masking/restoring the mask is not the missing reset primitive |
| LIDT16 | `decode.js:941`, `emit.js:3080` load the word limit and low24 base | The empty table is representable |
| INTFF, PE=1, PG=0 | `emit.js` `$faultsw`→`$fault`→`$idtgate`; the limit miss returns0, causing word-frame physical-IVT fallback | No #GP→#DF shutdown/reset. PE is not cleared; CS still loads under protected semantics |
| INTFF, PG=1 | `paging-exec.js:247` checks delivery, escalates FF→#GP→#DF, then throws `386 shutdown: fault delivering #DF` | Terminal host error, no reset/firmware continuation |
| Firmware installation | `dos.js:2346` installs host-vector entries, default IRET, keyboard code, configuration data/fonts; no reset entry or0467 consumer | BDA bytes alone do not implement the return |
| Driver exception exit | `run-dos.js:1137` records paged delivery failure and ends the run | No hidden retry as a warm reset |

`run-dos.js` binds the VM's port callbacks to `Machine.portIn/portOut`.
`vm.js` itself defaults to dropped writes/floating reads; that bare default is
not the DOS runner's reset behavior. The emitted OUT handler calls the imported
host function; it does not catch and convert its Error into a BIOS return.
HLT decodes to an end/handback handler, not a firmware-reset operation.

For the nonpaged fallback, installed IVT FF initially holds F000:0200, whose
byte is IRET. However, the original033C code temporarily rewrites that area of
the IVT. Thus neither the current FF target nor the next address/fault can be
predicted from the initial host IVT. Even an unchanged F000 segment would be
loaded while PE remains set, so it cannot be described as a successful real
BIOS call. The source proves the incorrect fallback boundary, not an observed
downstream crash address. The paged helper's three-attempt terminal chain is
checked with register doubles and no instruction execution.

## Frames after a hypothetical successful transition

The own initial protected INT33 gate is386 type8E: its same-level frame is
three dwords even though the target code descriptor is16-bit. ToyVM's nonpaged
`$fault` uses the gate type to push32, and `$sset` derives code/stack widths
separately. This shape agrees with the saved EIP/CS/EFLAGS consumed by the
original bridge; no new width mismatch is established for this same-level ABI.
Privilege changes, paging/task state and descriptor mutations remain context
requirements, not guaranteed by this comparison.

If reset really resumes the intended real state, 0EF8 resolves vector33 from
physical0000:00CC and enters it using word IRET at0F30, exposing the second
six-byte return frame. Vector33 is outside the original saved08..2E override
range. This use of IRET still reaches ToyVM's host service when the IVT points
to F000:0133: `DosSession.step` recognizes that address, regardless of whether
the transfer instruction was INT or IRET. A guest-installed IVT33 instead
leads to the guest handler. No claim of its runtime installation is made.

`dos-loop.js:1380` `serviceInterrupt` reads word IP/CS/FLAGS at SP+0/+2/+4,
merges service word writes with upper general-register halves, and advances SP
by6 while retaining its upper half. The actual `int33` method answers AX=0
with AX=FFFF/BX=2. Synthetic register/memory checks exercise that existing
host endpoint at ordinary and wrapping SP, including the0F34 continuation.
This is a host contract check, **not an original mouse result or reset run**.
The endpoint is present; adding an external DPMI service would not supply the
missing reset primitive. INT21/AH30 also has a host answer (AX=0006/BX=CX=0),
conditional on actually reaching its endpoint through the original DOS path.

Original0F34 reenters protected mode via mutable09C0/09C2 and reaches0070:047C.
Its small-stack branch skips the66 prefix to read BX rather than EBX; the
return ends with **66 CF at04F0**, decoded by ToyVM as IRETD. The original
rebuilds the three-dword protected return and combines returned low FLAGS
with saved upper EFLAGS. ToyVM has both word IRET and dword IRETD handlers;
its paged IRET helper separately validates frames. Nothing here executes or
qualifies these handlers against original firmware, privilege or paging state.

## Decision and next observation

No narrow pure-host ABI repair was established: the isolated real-service
frame already agrees. The demonstrated gaps involve reset, fault delivery and
firmware state across multiple subsystems. Accepting FE as a no-op, clearing PE
and jumping straight to0B3F, or guessing an unwind from22h would create fake
compatibility. No production patch is proposed or left by this task.

A future authorized runtime observation should first record actual09BC/09BE/
09C0/09C2/09C4,0ED0,10EE, descriptor18/20/38/70, CR0/CR3, IDTR and SS:ESP
at092C and immediately before AD0/AE0. Preserve the0467/0469 pair and stack
bytes surrounding its target, IVT F8..FF and33, and CMOS0F/NMI state. A claimed
successful firmware return additionally needs the BIOS identity and observed
CS:IP, DS/ES/SS:ESP, flags, A20 and mode at0B3F, then0EF8/0F34 and protected
047C/04F0. Probe the selected runtime first; do not choose external DPMI or a
reset rewrite merely from an absent handler. Later vectors/runtime selection
remain unproved.

## Reproduction and custody

`node scratch/runs/20261113-worms-reset-host-2140/check.cjs` passes **108** checks:
prior seals, exact windows/data, source pins, original-byte decoder forms,
actual peripheral prototypes, actual host-service register/frame handling and
the JS exception helper with register doubles. Four deliberate controls
(accept-reset, invent-cmos, drop-iretd-prefix, eight-byte-return) each fail the
appropriate assertion. WASM allocation/compilation/instantiation entry points
are guarded to throw. No CPU or Machine constructor is used.

The run retains exact starting Git SHA, incoming relevant binary diff, loaded
source hashes, relevant untracked files as new-file patches, task delta and
helper/document patches, reverse-patch checks and artifact seals. Git is the
source archive; no source-tree snapshot/archive was made. Incoming production
WIP remains untouched and uncommitted. Publication is docs-only whitespace
validation and main pull/push; no build was run under the task's restriction.
The bounded task-local messageboard watcher is stopped before sealing.
Box ID **none**, state **NOT_CREATED**, expiry null, stop receipt **N/A**.
