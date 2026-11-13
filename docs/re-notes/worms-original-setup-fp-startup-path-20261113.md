# Original Worms SETUP pre-main FP selection and lazy interrupt patches

2026-11-13 — **NO_NATIVE_RESULT**. The original startup selects hardware or
software handling using an x87 control-word probe **and an environment-derived
NO87 count**. It installs real guest interrupt vectors before its first lazy
INT37 site. ToyVM's inspected decoder, vector services, interrupt frame, x87
handlers and code-write invalidation provide matching source contracts for the
hardware path. No small proven general host defect was found; no production
code was changed. No executed branch, first screen or forced hardware result
is claimed. The software parser and return protocol are established below;
its complete arithmetic implementation remains unqualified.

Evidence: `scratch/runs/20261113-worms-setup-fp-2300/`. This resolves the
pre-main context left conditional in the
[entry analysis](worms-original-setup-entry-cd-path-20261113.md) and
[first-screen/config analysis](worms-original-setup-first-screen-config-path-20261113.md).
All addresses are load-image offsets: file offset = image +50h. DOS relocation
makes DS=S+08D2h, so DS:d maps to image 8D20h+d. Static original bytes and
derived patch bytes are kept separately; no patched executable was saved/run.

## Environment and feature selection

The original startup at2809 asks INT21/AH30 for DOS version. For AL>=3,
281C loads the environment segment from PSP:002C;2820 clears SI and BP.
For each NUL-terminated environment entry,2824 loads its first word, ORs
2020h, and compares it with6F6Eh (`no`).282E compares the next word with3738h
(`87`). Each match increments BP. It tests the **first four bytes**, not an
exact environment-variable name or value: `NO87=1`, `no87=` and `No87extra`
match; `XNO87=1` and `NO86=1` do not. It never tests an `=`, numeric value or
BIOS equipment bit.2866 stores BP in DS:0C6C. The initialized image word at
998C is zero, but startup overwrites it: zero file bytes do not settle runtime
selection. For DOS<3 the scan and BP initialization are bypassed; incoming BP
must not be silently replaced with zero. ToyVM's inspected AH30 service returns
DOS6, but no original service invocation was executed here.

28AA calls initializer dispatcher692C with AX=00FF. The priority1 type0
near record at9AC2 calls24B0 through691C. At24B2 it executes **raw FNINIT**
(`db e3`), pushes AX, and24B7 executes **FNSTCW ss:[bx]** into that stack
word.24BA pops the resulting word into AX. These instructions precede vector
installation and run even when NO87 later selects software handling.

24BB loads BX=[0C6C];24BF compares **AH with03h**. On mismatch it increments
BX, then24C5 tests the full word. BX=0 selects255A; otherwise it selects3EAA.
This is a control-word test, not CPUID, INT11, CR0 inspection or a direct
test of whether the host implements floating point. The exact 16-bit formula is
`hardware iff (NO87_count + (AH == 3 ? 0 : 1)) mod 65536 == 0`.

| Probe high byte | Count | Original branch |
|---|---:|---|
| 03 | 0 | hardware |
| 03 | 1 | software |
| other | 0 | software |
| other | FFFF | hardware through INC wrap |

ToyVM's emitted `finit` sets FCW=037Fh and `fnstcw` stores that word. Thus
**if those instructions complete with those effects**, and the environment
count is zero, the source predicts the hardware branch. The environment,
actual loaded registers/memory, delivery mode and completed probe are not
observed. Changing the BIOS coprocessor bit or hardwiring a hardware answer
would not resolve this original branch.

## Vector installation and first pre-main FP dependency

24C9/24DA choose the following table, with each segment word set to CS:

| Vectors | Software selection | Hardware selection |
|---|---:|---:|
| 34h–3Bh | 3EAA | 255A |
| 3Ch | 3EE7 | 2572 |
| 3Dh | 2547 | 259E |

2529 calls2478. Starting at DS:0AFC, AL=34h and CX=10, it gets each old
vector with INT21/AH35 into ES:BX, exchanges the table's offset/segment with
that old vector, then sets the new vector with AH25, DS:DX. It increments AL
and repeats through3Dh inclusive. The old vectors remain in the data table;
2543 calls the same exchange routine for restoration. This is guest-owned
vector installation, not a request for a host INT37 arithmetic service.

252C calls6810→69A8.69A8 conditionally sets save/restore callback offsets
DS:0D64/0D66 to6994/699E when [0B25] is nonzero, loads AX=[0D6C], and jumps
to6814. The initialized [0B24:0B25] bytes are zero; **the initial word at
DS:0D6C is not established by the retained windows**. It is pushed as the
later FLDCW operand, so no particular restored control word is invented.

The first inline FP interrupt is **6819**, before24B0 returns and before
application main0014. On the hardware branch its original stream has these
derived boundaries:

| Original site/bytes | Conditional hardware decoding after lazy patch |
|---|---|
| 6819 `cd 37 e3` | WAIT; FNINIT; next681C |
| 681C `cd 35 e8` | WAIT; FLD1; next681F |
| 681F `cd 35 ee` | WAIT; FLDZ; next6822 |
| 6822 `cd 3a f9` | WAIT; FDIVP ST(1),ST; next6825 |
| 6825 `cd 35 c0` | WAIT; FLD ST(0); next6828 |
| 6828 `cd 35 e0` | WAIT; FCHS; next682B |
| 682B `cd 3a d9` | WAIT; FCOMPP; next682E |
| 682E `cd 39 7e fc` | WAIT; FNSTSW [BP−4]; next6832 |
| 6832 `cd 3d` | WAIT; NOP; next6834 |
| 683E `cd 37 e3` | WAIT; FNINIT; next6841 |
| 6841 `cd 35 6e fe` | WAIT; FLDCW [BP−2]; next6845 |

6834 reads the stored status word into AX. It sets AL=2, uses SAHF to test
the status high byte's equality flag, and changes AL to3 when unequal. The
sequence compares opposite-signed results of1/0: it is a coprocessor-type
distinction, not another direct hardware/software selector. ToyVM's emitted
operations use f64 division, negation and ordered comparison; source therefore
predicts unequal opposite infinities under these conditions. This is a source
inference, not an observed AL=3, exact x87 exception fidelity or an executed
probe. FNINIT masks exceptions; ToyVM does not raise all numeric exceptions.

After6814 returns,252F stores AL in[0B24];[0B25] becomes zero for software
selection or AL for hardware selection.24B0 restores BX/DS and returns at2542.
The separate priority2 initializer69C9 normally skips its repeat probe when
[0B24] is nonzero. If zero, its conditional raw probe and count test remain
real instructions. Other initializer callbacks must also return before
28AD→68C0→68CE→0014. Returning from the priority1 callback alone does not
prove arrival at main or the later mode2/B800 drawing routine0300.

## Hardware patch, software parse, and return addresses

On a real-mode INT, saved IP points **after the two-byte CD/vector pair**, at
the inline ModRM/escape operand.255A pushes SI/DS/BP, then LDS SI,[BP+6]
loads that saved CS:IP. It adds A4h to the vector byte at IP−1 (34..3B→D8..DF),
writes9Bh at IP−2, and writes IP−2 back into the saved frame. IRET replays
WAIT plus the newly derived x87 instruction. For example043A's
`cd 37 46 fa` becomes `9b db 46 fa`: WAIT; FILD dword [BP−6], next043E.
Merely returning after CD37 would decode its operands as ordinary code.

2572 handles3Ch separately: it restores the next escape byte's high bits
with OR C0h and derives a segment prefix from their complement. High-bit
inputs00/40/80/C0 produce3E/36/2E/26 (DS/SS/CS/ES). It writes WAIT and that
prefix, then rewinds saved IP by two. It is not a ninth ordinary x87 escape.
259E handles3Dh by writing `9b 90` and rewinding saved IP. The software3Dh
handler2547 instead writes `90 90` and **does not rewind**; its first return
already resumes after the pair. These are distinct original contracts.

Software3EAA pushes ten words including a duplicate BP, calls2908 to reload
relocated DS, selects software state at DS:0C86, and LES SI,[BP+14h] reads
saved CS:IP.3ED9 reads the original vector byte and inline ModRM; SI advances
past that ModRM. DL becomes vector−34h. Memory forms call the addressing
table at CS:410E;3F59 writes the advanced SI to saved IP before arithmetic
dispatch through422D/43AD. Register forms write it at3F94 and dispatch via
42AD. In particular **INT37 E3 indexes42F3, whose original word is4B59**.
That arithmetic target's body is not retained/qualified here. It must not be
replaced with hardware255A or a new host FP emulator.

The common continuation4001 reloads the saved next address: when it sees a
further CD it chains through3F79's original parser; otherwise3FF6 restores
ES/DS/DI/SI/BP, discards the duplicate BP through POP BX, restores the remaining
registers and IRETs at4000. Thus software continuation consumes original inline
operands and can process adjacent FP escapes before returning. It does not
implement the hardware replay rule. Linear disassembly's apparent IRETs inside
the422D..43BD tables are **data bytes**, not additional established returns.
Complete software arithmetic, addressing helpers and all its exception paths
remain open; the parser/return edge does not certify them.

## Actual ToyVM source boundary and checks

`check.cjs` imports actual `decodeOne` and actual `Machine.prototype.int21Call`
without constructing a Machine/CPU. WASM APIs are replaced with throwing guards.
It verifies raw FNINIT/FNSTCW,443 original instruction decodes in bounded
startup/vector/patch/parser bodies, the derived hardware instruction lengths,
all ten real AH25/AH35 vector round trips on register/memory doubles, original
bytes/calls, environment/branch algebra and relevant source contracts.

`decode.js` ends CD37 after two bytes with next-IP=site+2; WAIT is a separate
NOP carrying `wait` metadata. `emit.js` real-mode `$fault` pushes FLAGS, CS,
next-IP and reads the IVT. `iret` pops modified IP/CS/FLAGS. All derived probe
x87 operations have decoder handlers. `$wr8` checks compiled-byte bitmap hits
by physical address and raises SMC invalidation; it is not restricted to an
explicit CS override, which matters because255A writes through LDS-loaded DS.
Actual cache invalidation/re-entry is a runtime requirement, not exercised here.
The host DOS default for an unknown37h does not emulate inline operands;
normal installation must route to the original handler instead of that default.

`paging-exec.js` checks x87 against CR0.EM/TS and WAIT against MP+TS, raising
#NM. This applies to its paged execution path; it must not be generalized to
every nonpaged dispatcher. Real/protected/VM86 selection and actual CR0 were
not sampled. The standalone MZ entry is real-mode code; neither a protected
DOS4GW bridge nor an assumed hardware answer is needed to describe its bytes.

Offline reproduction:

```sh
timeout 30s node scratch/runs/20261113-worms-setup-fp-2300/check.cjs
```

769 checks and924 overlap-byte comparisons pass. Four seeded controls
(`env`, `patch`, `rewind`, `vector`) fail respectively on an incorrect NO87
prefix expectation, A3h patch increment, unrevised saved IP and wrong vector
retrieval. Prior entry1600 and screen2200 seals are verified in place.

One authorized exact range recovery reused entry1600's helper: sectors169–188,
HTTP206, Content-Range `bytes 397488-444527/578432064`,47,040 raw bytes,
identity encoding, every sync and Mode1 byte checked, extracted39,746-byte
member full SHA-256
`92805b6402fb28b8b6d07e57038ce97d9939fd6febbdb9c5c7dde639c62b0771`
checked before static objdump. Only selected windows remain. Member buffers
were removed and memfds closed. GNU timeout independently bounded recovery
to180 seconds and the append-only board watcher to1,800 seconds.

Git SHA, incoming relevant binary diff, final relevant diff, empty production
task delta, new helper/document patches, source hashes and artifact seals are
retained. Incoming zero-write/FCB/CD/palette/loader/host/GPU WIP was preserved;
no runtime test or build was run and no code was committed. No whole CD or
`/home` media, archive, CPU engine, guest, VM, WASM, native/browser/game run,
worker, resource/reserve change or general cleanup was used. Box ID **none**,
state **NOT_CREATED**, expiry **null**, stop receipt **N/A**.

Next evidence would be an expressly authorized original startup observation
recording DOS version/environment, C6C, probe control word, selected vectors,
6819 saved frame/patch/return, software dispatch if selected, callback returns
and arrival at0014. Main, first screen, config persistence, installation,
protected WRMS, gameplay and audio remain **OPEN**.
