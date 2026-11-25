# Issue30 gears: scalar-double gear-builder instructions

Evidence: `scratch/runs/20261118-gears-sse2-gear-builder-arithmetic/`.
This follows `e83a02274`'s reshape instruction repair. The unchanged release
EXE is 16384 bytes, SHA256
`ef3de2e8bc52f1285fc603f374ac1f39781211590f2f38c1eb2c870418812240`.
Recovery: [K4sum1 release 1.0](https://github.com/K4sum1/windows-glxgears-built/releases/download/1.0/glxgears.x86.exe).
The reporter's own binary SHA remains unknown.

The existing SSE handlers now implement legacy ADDSD, MULSD, SUBSD, DIVSD,
CVTPD2PS and CVTDQ2PD. The original reaches these in its gear builder at
401070, previously stopping on MULSD at 401087. Scalar operations read m64
or the low source qword and preserve the upper destination qword. CVTPD2PS
converts both doubles and zeros the upper qword; its legacy m128 operand
requires alignment. CVTDQ2PD reads only the low two signed dwords (m64) and
writes two exact doubles. Register aliases read inputs before replacement.
Memory operands retain existing width-specific translation, including sparse
page boundaries. The eight-register per-thread XMM representation is unchanged.

Primary references are the [Intel SDM Volume 2](https://cdrdv2-public.intel.com/782156/325383-sdm-vol-2abcd.pdf)
entries for these six instructions and [Volume 1](https://cdrdv2-public.intel.com/671436/253665-sdm-vol-1.pdf),
section 4.8.3/table 4-7. Arithmetic propagates the first NaN operand, quieting
signaling NaNs and retaining sign/payload; invalid non-NaN operations return
the negative quiet-NaN indefinite. Double-to-single conversion retains NaN
sign and the high payload bits and quiets signaling NaNs. Explicit bit handling
avoids WebAssembly's permitted NaN canonicalization. Finite operations use
Wasm double arithmetic/demotion in the supported nearest, ties-even mode.

The supported environment remains reset rounding and masked exceptions;
MXCSR status reporting, LDMXCSR/STMXCSR, alternate rounding, exception masks
and DAZ/FTZ remain unsupported. No full SSE2 claim, CPUID change, guest patch,
trap interception, silent instruction, Worker override or optimization variant
was introduced. Unsupported prefixes and conversion/environment forms trap.
The existing alignment exception path records the actual instruction EIP and
operand address before SEH, without modifying the destination.

Self-checking authored PEs execute 271 groups twice in separate process memories
in native and compatibility modules. Coverage includes every scalar destination
selector, aliases, register/absolute/SIB sources, preserved source and upper
lanes, GPRs/EFLAGS/ESP, positive/negative finite results, ties-even rounding,
overflow, signed zeros, infinities, invalid operations, NaN priority/payloads
and gradual subnormal inputs/results. Additional PEs check aligned/unaligned
m64 at the end of a sparse page, cross-page m64, and a real exception filter
that verifies misaligned CVTPD2PS fault EIP/address and unchanged destination
before continuing through the edited CONTEXT. Native width checks enable the
existing unmapped-access trap so an accidental wider read fails.

Three concurrent guest threads rendezvous atomically and yield repeatedly,
execute four-level recursive double-arithmetic calls, check fresh/persistent
per-thread XMM and stack state, and exit successfully; main checks its own
XMM afterward. A separate nested public exception-filter fixture verifies
shared live XMM semantics across nested calls and guest-owned stack restoration.
Ordinary browser upload with default slice 100000 and normal Workers passes
the arithmetic, concurrent-thread, nested-filter, sparse-width and alignment
fixtures. Native and browser
old-module controls fail on the first added scalar instruction with the same
control EXE. SSE scalar, MMX, reshape and x87 isolation regressions pass.

The affected original uses ordinary upload, slice 100000, normal Workers and
no module override. Tested module SHA256 is
`15dad7370e66f19628a314809c929ef5e00c86436013be7b3167dc96901746b2`.
Its sealed source manifest and successful response readbacks establish the
tested source/module identity; the absent local build-info.js yields an empty
404. The original now passes the reached arithmetic/conversion sequence and
reaches a separate explicit missing API: **_libm_sse2_sin_precise**, at
**403110**, with return address **401186** in the gear builder. The retained
disassembly identifies the genuine direct call at 401181 and import thunk.
This is a CRT math helper blocker, outside the instruction repair. CVTSD2SS
at its return address is still unsupported and has not executed; do not
claim support for that later conversion.

The whole affected-original/startup.png was personally reviewed: desktop,
uploaded EXE icon and trap diagnostics; no rendered gears. No natural motion
or ordinary guest exit was reached. The trap closed the runtime scope; browser
cleanup is separate and no endpoint was replayed after closure.

Preliminary failures remain recorded: an authored sparse-width fixture omitted
its VirtualAlloc import and called NULL; its initial in-process run exhausted
the bounded loop, and CLI diagnostics exposed the missing import. Corrected
fixtures pass. The first feature-owned census filename sorted before the
reshape addition it revised; renaming it after that addition fixed the review
anchor without editing another owner's census. These are test/review setup
failures, not accepted runtime outcomes.

The final locked full build passes and reproduces the tested native and
compatibility modules byte for byte. The current callback census gate,
reconciliation tests and run-evidence regression tests pass. An optional
historical Shadow Man census mutation test fails on the pre-existing
`$win32_dispatch_inner` review hash in the pending shared overlay; its log is
retained and the foreign dispatch/census sources were not edited.

All runtime launches use finite native supervision and independent watchdogs,
with actual waits and pipe EOF receipts. Exact Git revisions, relevant binary
diffs, new-file patches, tested modules and fixture recovery are retained in
the run; result.json is written last. Box ID/state/expiry/stop receipt are
null / NOT_CREATED / null / null. No agents, Codex workers, boxes, Python, Wine or
public deployment were used; foreign UT/Alice/NFS/host-NE work is preserved.

## Update 2026-11-24

The `_libm_sse2_sin_precise` blocker is fixed, with its cos/sqrt siblings and `_time64`;
CVTSD2SS was already supported on main. gears.exe now opens its window and animates:
see [gears-libm-sse2-time64-20261124.md](gears-libm-sse2-time64-20261124.md).
