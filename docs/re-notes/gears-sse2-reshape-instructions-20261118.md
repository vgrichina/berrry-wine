# Issue30 gears: real SSE2 reshape instructions

Evidence: `scratch/runs/20261118-gears-sse2-reshape-instructions/`.
The unchanged release is 16384 bytes, SHA256
`ef3de2e8bc52f1285fc603f374ac1f39781211590f2f38c1eb2c870418812240`,
from K4sum1/windows-glxgears-built release 1.0. The reporter's binary SHA
remains unknown. This follows the published process-filter repair
`d9209a25f`; its ordinary upload stopped on `66 0f 6e ca` at 401ec9.

The interpreter already allocates eight 128-bit XMM registers in a separate
128-byte slice per guest thread. `init_thread` selects and clears that slice;
fresh process memory supplies process isolation. This repair retains that
representation, the handler table, normal dispatch and existing MMX state.
It adds legacy MOVD between XMM and GPR/m32, CVTDQ2PS, MOVSD, CVTPS2PD and
CVTSS2SD in the existing SSE handlers. DIVSS and MOVSS were already supported.
These instructions cover the reached reshape function through its return.

Semantics were checked against the
[Intel instruction reference, Volume 2](https://cdrdv2-public.intel.com/782156/325383-sdm-vol-2abcd.pdf):
MOVD pp. 4-55 onward, CVTDQ2PS pp. 3-269 onward, MOVSD pp. 4-114 onward,
CVTPS2PD pp. 3-286 onward and CVTSS2SD pp. 3-298 onward.
MOVD into XMM clears bits 32–127; the reverse moves only the low dword.
CVTDQ2PS converts all four signed lanes, including aliased operands and
integers beyond exact single precision. MOVSD from memory clears the upper
qword, while register forms preserve it; stores write exactly eight bytes.
CVTPS2PD promotes the low two floats, reading only m64 for a memory operand.
CVTSS2SD changes the low double and preserves the upper qword, reading m32.
Promotion preserves signed zero, subnormals, infinities and NaN sign/payload,
and quiets signaling NaNs in the supported masked environment. An explicit
bit mapping avoids WebAssembly's permission to canonicalize NaNs.

The supported SSE environment remains reset rounding, nearest with ties even,
with masked exceptions. LDMXCSR/STMXCSR and nondefault rounding, exception-mask,
DAZ/FTZ control remain explicit unsupported instructions. This does not claim
a new MXCSR interface or full SSE2 support, and does not change CPUID.
Legacy CVTDQ2PS m128 requires alignment; misalignment records the operand
address and actual instruction EIP before existing SEH delivery, without
writing its destination. The existing unhandled-SEH termination policy adds
DE00 to an exhausted exception's exit value; its actual exception is C0000005.
Unsupported prefixes/conversion variants remain fatal decoder traps.

The decoder distinguishes mandatory prefixes and preserves the unprefixed
MMX instructions. Existing EA translation handles register, absolute, base,
SIB and segmented operands; narrow transfers use the existing width-specific
guest memory helpers. No guest patch, API bypass, silent SSE implementation,
optimization variant or Worker configuration change was introduced.
Feature-owned callback census reviews describe the precise alignment-fault
EIP transition and retain pending general invocation ownership.

Self-checking authored PEs execute real instruction bytes in native and
compatibility modules. The control checks 67 groups twice in independent
process memories: selectors, zero/preserved lanes, register/memory directions,
signed conversion and ties, promotion special values, scalar division, GPRs,
EFLAGS and ESP. Same-address guest self-modification switches between
prefixed XMM MOVD and unprefixed MMX MOVD, checking cache invalidation and
instruction lengths. Ten unsupported-prefix/environment inputs trap, and an
unaligned packed conversion raises the expected fault at 402001.

Three simultaneous guest OS threads rendezvous atomically, then repeatedly
yield and execute four-level recursive SSE calls. Each checks fresh XMM state,
its own persistent XMM7, restored guest stack/XMM0 and successful thread exit;
main checks its own XMM7 afterward. A separate PE invokes actual nested public
exception-filter callbacks: the child sees the outer callback's XMM value,
the outer sees the child's write, and the guest restores its saved live value
from its own stack. These controls also pass ordinary browser file upload,
default slice 100000, normal guest Workers, with no module override for the
sealed browser controls. Old native and normal Worker controls fail at the
first newly supported MOVD using the identical control EXE.

Regressions pass: 144 scalar SSE cases, 53 MMX operations over 29868 checks,
x87 instance/save/restore isolation, and census mutation tests. The locked
full build passes after adding the focused fault-boundary reviews. Failed
preliminary checks are retained: an invalid expectation about POPFD's existing
flag model was replaced with actual before/after preservation; the alignment
test now accounts for the existing unhandled exit tag. Two preliminary Node
thread runs used a wrong EXE argument, and a later run hit the harness's stuck
detector while waiting for live threads. Correct runs explicitly select the
fixture and disable that detector under finite supervision. Two premature
sealed checks lacked their not-yet-written module; subsequent sealed checks
pass. Those preliminary scopes are not acceptance evidence.

The affected original uses ordinary upload with default slice 100000, Workers
enabled, no module override or app setting change. Its actual module is
`f678ee1f7c4a82da5e406c56b0d9b3518c72e8f2fdff0f022d101822c7821238`
(2414068 bytes). All 120 successful source/module readbacks match local files;
the additional response is an empty 404 for the absent local `build-info.js`.
the retained manifest checks source consistency before launch. It passes
reshape and reaches 401070, the gear-building routine. The next explicit
unsupported instruction is **F2 0F 59 1D 68 43 40 00**, `MULSD xmm3,
qword [404368]`, at **401087**, reported EIP **401088**. That routine also
contains SUBSD, ADDSD, DIVSD, CVTPD2PS and CVTDQ2PD, beyond the bounded reshape
repair. `next-blocker-disassembly.txt` retains the exact bytes.

The whole `affected-original/startup.png` was personally reviewed: upload icon
and diagnostic desktop, no rendered gears or natural motion. CreateWindow and
ShowWindow logs alone are not rendered-frame evidence. No ordinary guest exit
was reached; the trap closed the runtime scope, and subsequent browser cleanup
is recorded separately. No closed endpoint was revisited.

Runtime scopes retain finite native supervision, independent watchdogs,
actual waits and both pipe EOFs. No descendants leaked and no supervisor
termination was required. Preliminary bounded in-process checks are retained
as logs. Box ID/state/expiry/stop receipt: null / NOT_CREATED / null / null.
No agents, Codex workers, boxes, Python, Wine or public deployment were used.
Recovery uses exact Git revisions, relevant binary diffs, owned new-file
patches, retained tested modules and small authored fixtures; no source-tree
snapshot or game-media copy was made. See the run's `RECOVERY.md` and final
`result.json` for publication receipts, exact modules and scope outcomes.
