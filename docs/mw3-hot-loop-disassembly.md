# MW3 hot loops and Chrome native code

Investigated 2026-09-30. V8 compiles our interpreter into native code; it does
not turn a MW3 guest loop into a specialized native loop. The generated code
still decodes emulator operations, accesses memory-backed guest state, and
dispatches between operations. Floating-point arithmetic itself uses native
scalar instructions.

```text
MW3 x86 loop
    |
    v
decoded handlers / uop records
    |
    v
V8-compiled native interpreter
    +-- load operation + operand locations
    +-- load guest values / maintain x87 tags and stack
    +-- native ADD / MUL / DIV
    +-- store guest result
    +-- dispatch next operation
```

## Evidence and scope

This uses the exact WASM from the [post-merge profile](mw3-postmerge-profile.md),
frozen commit `837f0a74`, SHA-256
`c1c92840fde2c9ae2809154ea64ea9ab91b11effdb0a541099b695f1567a6b93`.
The matching named module's noncustom sections were verified against it.

Chrome **151.0.7922.108**, matching the measured browser, compiled this module
on the dedicated AMD x86-64 ASCII box. Flags `--perf-prof`, `--no-liftoff`, and
`--no-wasm-lazy-compilation` produced a Linux jitdump with real TurboFan code
bytes. GNU objdump disassembled selected objects at their original addresses,
preserving relative branch/call destinations. The box is archived afterward.

This extraction is **compile-only, forced optimized tier**. It is not a native
instruction-pointer profile of the earlier gameplay run, nor evidence of the
time spent in each instruction or of that run's exact tier distribution.
Object sizes include tables/padding; cold paths are not per-operation work.

Saved evidence under `build/lazy-games/mw3-disasm/`:

- [Guest x86](../build/lazy-games/mw3-disasm/guest-loops.txt) and
  [threshold continuation](../build/lazy-games/mw3-disasm/threshold-continuation.txt).
- [Chrome manifest](../build/lazy-games/mw3-disasm/chrome-x64-manifest.json),
  raw `jit-chrome/jit-*.dump`, selected `.chrome-x64.bin` objects, and `.asm` files.
- `capture-chrome.js`, `read-jitdump.js`, and frozen `04-measured.wat`,
  `07b-measured.wat`, `07d-measured.wat` for reproduction/source comparison.

These are local build artifacts, not tracked source files. A separate local
ARM64 V8 15.4 extraction is exploratory only; its concatenated object layout
does not preserve external relative-call targets. The x86-64 files above are
the evidence used here.

## What the guest loops do

Counts below come from two earlier census windows, not CPU samples or the
exact later timing windows. Entries/present establish frequency, not cost.

| Guest address | Entries/present | Operation |
|---|---:|---|
| `0x4fd394` | 4,420 / 4,428 | Project an array of three-component vertices |
| `0x51bc31` | 3,589 / 3,595 | Clamp floats to [0,1], compare against approximately 1/255 |
| `0x51bf10` | 3,590 / 3,595 | Quantized sine-table lookup |
| `0x5242fd` | 3,479 / 3,483 | Squared-length threshold, followed by linear-combination test |

### Projection: `0x4fd394`

Twenty-one x86 instructions per iteration, excluding the final return:

```text
r = 1 / src.z
dst.x = float32((src.x * r) * scaleX + offsetX)
dst.y = float32((src.y * r) * scaleY + offsetY)
dst.z = float32(r * depthScale)
src += 12; dst += 12; count--
```

The loop already performs **one divide per vertex**, reusing the reciprocal.
It contains five multiplies, two adds, and three float32 stores. This pseudocode
describes the arithmetic; it does not authorize reassociation or elimination
of the guest's rounding points.

The initial `FLD; FDIV` is followed by integer pointer/count updates before
the remaining x87 sequence. Those integer instructions split the float
islands. The measured compiler has no x87 uop lowering, and the existing
x87 island requires at least three operations. Extending regions across this
boundary is a candidate, not a measured speedup.

### Clamp: `0x51bc31`

The loop walks backward through float values, compares against 1 and 0,
stores a bound when needed, then compares against double constant
`0.003921569` at `0x598a10`. A passing value sets a flag. The following loop
also accumulates qualifying values into an indexed array.

The guest uses `FCOMP; FNSTSW AX; TEST AH; Jcc` for comparisons. The
`FNSTSW/TEST/Jcc` portion is **already fused** by handler H439. Many
`FLD/FCOMP` pairs still fall below the three-operation island threshold.
NaN follows a specific guest branch path, so ordinary host min/max is not
automatically equivalent. The data's higher-level purpose is not established;
there is no evidence this is a texture scan.

### Sine lookup: `0x51bf10`

The helper multiplies by float `20.3718318939209` (approximately 64/pi),
uses a double magic constant (`1.5 * 2^52`) and a spill to obtain a rounded
integer, then masks/mirrors the phase and loads a float table entry. Bit 6
selects the sign; the lower six bits select the mirrored quarter-wave index.

The 33 table entries at `0x5b7990` match `sin(i*pi/64)` to within
`3.27e-8`. This is a 128-bin quantized sine approximation, **not an FSIN or
host transcendental call**. Rounding mode and the spill matter to equivalence.

### Thresholds: `0x5242fd`, continuation `0x52432f`

The first region computes two squared components and their sum, spills to
float32, reloads, and compares with a threshold. The continuation computes
a three-component linear combination plus a constant and compares again.
Rejected cases zero an output. This resembles geometric rejection work;
the exact semantic role remains unproven. There is no square root here.

## What Chrome emits

| WASM function | Index | Native object bytes | Existing sampled self ms/present |
|---|---:|---:|---:|
| `uop_fast` | 1303 | 11,456 | 3.88–4.23 |
| `x87_island_fast` | 1143 | 19,840 | 3.27–3.73 |
| `branch_end_at` | 406 | 3,520 | 2.40–2.67 |
| `th_load32_rop` | 457 | 1,728 | 1.19–1.31 |
| `fpu_exec_mem` | 848 | 11,264 | 0.98–1.03 |

These timing rows cover all callers. They do not assign these milliseconds
to the four guest loops above. Total guest execution was 28.25–31.20 ms/present.

### Uop ADD: actual native interpreter work

[Full native listing](../build/lazy-games/mw3-disasm/uop_fast.chrome-x64.asm).
The common loop at `0x1dfea9d3c900` saves the uop PC, checks V8's interrupt
flag, loads the opcode, checks its range, and indirectly jumps through an
86-entry table. Opcode 3 targets `0x1dfea9d3eb58`:

```asm
# AT&T syntax; rbx = WASM memory base, r11 = record offset
mov  0x4(%rbx,%r11), %r8d    # destination slot address
mov  0x8(%rbx,%r11), %r9d    # source A slot address
mov  (%rbx,%r9),     %r9d    # source A value
mov  0xc(%rbx,%r11), %r11d   # source B slot address
mov  (%rbx,%r11),    %r11d   # source B value
add  %r11d,          %r9d
mov  %r9d,           (%rbx,%r8)
mov  -0x30(%rbp),    %r12d   # recover uop PC
lea  0x10(%r12),     %eax    # next record
jmp  common_loop
```

Ten native instructions in this arm plus nine in the ordinary common-loop
path: three operand-location loads, two value loads, a result store, and
dispatch bookkeeping for one arithmetic uop. A guest instruction may lower
to multiple uops. This establishes overhead structure, not cycles or cache
misses, and is not an argument that uops are slower than the previous handlers.

### x87 island: hardware arithmetic surrounded by state handling

[Full native listing](../build/lazy-games/mw3-disasm/x87_island_fast.chrome-x64.asm).
The function reserves a 224-byte stack frame and caches ST0 in `xmm0`.
It still loads handler/operand records, decodes addresses, and dispatches
operation groups (an indirect branch at `0x1dfea9dee53b`).

Arithmetic is native: `vaddsd`, `vmulsd`, `vdivsd`, with `vcvtss2sd` on float32
loads and `vcvtsd2ss` on stores. For example `0x1dfea9df2ab4` is a single
`vaddsd %xmm3,%xmm0,%xmm0`; tag/status maintenance surrounds it.

The FST m32 path at `0x1dfea9df041a` converts ST0 to float32, moves the bits
into an integer register, spills ST0 and state, calls the store-helper stub,
then reloads state. The FSTP path additionally updates tags/TOP and loads the
new ST0. The source identifies this common store as `gs32`; the native call
targets a WASM jump-table stub, not the body's displayed base address.

Thus there is already register caching and hardware arithmetic. The remaining
candidate costs include repeated interpretation, stack/tag transitions, and
helper-call spills. Their individual timing is not measured by this dump.

### Memory and block boundaries

[gl32_native](../build/lazy-games/mw3-disasm/gl32_native.chrome-x64.asm) has a
direct-window fast path: after the range check it reaches
`0x1dfeaa9b8414`, performs one load, and returns. Byte assembly exists on a
conditional page-crossing path; the disassembly does not show every load
paying that cost. Likewise the larger store helper contains dirty/code-page
and synchronization paths, not evidence that each store takes every path.

[branch_end_at](../build/lazy-games/mw3-disasm/branch_end_at.chrome-x64.asm)
performs block bookkeeping: mode/yield/budget checks, page resolution,
possible uop promotion and chain patching, step accounting and dispatch.
Its measured 2.40–2.67 ms/present is more than simply executing guest Jcc.

## What this resolves and what remains

The guest code explains frequent small arithmetic loops. Native code confirms
that decode, guest-state access and dispatch survive WASM JIT compilation.
It rules out repeated divides in projection, expensive sine evaluation in
the table helper, and unconditional byte-by-byte ordinary loads as explanations.

To rank changes, the next evidence must attach cost to these paths: native-PC
samples/branch-miss measurements or guest-loop-scoped timing with controls.
Static instruction counts cannot choose between extending x87 islands,
changing uop operand storage, or reducing block-boundary work. No optimization
was implemented or performance gain claimed in this investigation.
