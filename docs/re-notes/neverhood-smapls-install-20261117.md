# Neverhood SMapLS ABI and installation continuation, November 17

Evidence: `scratch/runs/20261117-neverhood-smapls-abi-install/`.

The previous original pipeline remains permanently UNKNOWN. It reached genuine
DSETUPE's `SMapLS_IP_EBP_12` import, which was absent from the API table, after
reading the real DirectX INF. Its late confirmation (564.7 ms) and independent
UP acknowledgement (1907.1 ms) are not successful input qualification. No old
endpoint is contacted. Installation, Play, first room and native Quit remain
unproved at this implementation checkpoint.

## Evidence and ABI

The retained genuine DSETUPE member has SHA-256
`bdb0ec0953570355b9d6995f8c70e067bd314911090acf32fbe9883f33875945`.
Its selected byte windows, import table and disassembly are retained in
`20261113-neverhood-dsetupe-2320`; `abi-references.json` pins those records.
At preferred VA `0x1000478f`, its compiler stub establishes EBP, reserves its
scratch area, pushes a WORD HWND, calls the EBP+12 mapping helper, pushes EAX,
and calls the LS relay. It sign-extends AX, calls the matching unmap, executes
LEAVE and RET 8. The driver stub at `0x10004739` maps offsets 12/16/20/24,
reconstructs EAX from DX:AX, unmaps, and returns with RET 36. Other original
thunks import the offset-8 pair. The WORD push makes the helper's entry stack
unaligned to four bytes; no stdcall pointer parameter may be inferred from it.

The primary [Wine selector implementation](https://github.com/wine-mirror/wine/blob/cc5d1d86ee7d60649e6f858106db046c77c8b12c/dlls/krnl386.exe16/selector.c)
corroborates the register ABI: SMapLS takes EAX, returns the far value in EAX
and unmap state in EDX. For values below 65536, EAX passes through and EDX is
zero. An EBP helper reads its named DWORD slot and replaces it with that
state. Matching unmap reads and clears the slot while preserving EAX. Bare
SUnMapLS instead takes its token in EAX and preserves EAX. MapLS/MapSL/UnMapLS
use one stack DWORD each. The original compiler never interprets the opaque
frame token; the native implementation uses the far pointer as the token.

No Microsoft kernel binary is retained in this investigation. The
[kernel export specification](https://github.com/wine-mirror/wine/blob/cc5d1d86ee7d60649e6f858106db046c77c8b12c/dlls/kernel32/kernel32.spec)
corroborates name ownership. Added named ordinals follow this emulator's
existing export-manifest convention; they are **not** asserted to be original
Win98 ordinals or recovered Microsoft implementation bytes.

## Implementation and lifetime

The existing native-thunk handler fragment now owns shared LS alias rows in
the selector table. A distinct flag identifies the row; its otherwise unused
NE-segment field holds the reference count. DLL_LOAD_LOCK serializes lookup,
allocation and release across CPU instances. Repeated mappings of the same
window share a selector and retain independent references. Zero-reference
rows can be reused. Extra/unknown unmaps cannot underflow the count. Active
mapping references also hold the existing process-arena activity pin so its
metadata cannot retire before matching unmaps.

Aliases address the caller's original guest storage, without copying it.
They use 64 KiB aligned bases to preserve this interpreter's segmented-address
invariant, rather than copying Wine's internal 32 KiB window choice. The
entire alias window must have affine guest backing. Unmapped/non-affine
windows fail mapping with zero; this is an explicit emulator limitation,
not a claim about Microsoft invalid-pointer behavior. Mapping does not extend
the caller's allocation lifetime. As in the reference, zero references permit
reuse rather than promising that every stale far value immediately faults.
An unmapped/overflowing EBP slot traps before it can mutate mapping state.

The API table is append-only. Only MapLS/MapSL/UnMapLS, the register helpers
and the five demonstrated EBP map/unmap pairs are added. Their normal thunk
dispatch pops just the return address for register helpers. Existing APIs,
the original guest/DLL bytes, and the unsupported DirectXSetup guard remain
unchanged. Foreign NE/OLE/scene work is excluded from the later immutable
runtime source, even though the mandatory shared-tree build sees shared WIP.

## Qualification checkpoint

`test/test-neverhood-smapls-abi.cjs` constructs an authored PE and executes
ordinary x86 CALLs through its import table in the compiled production module.
It distinguishes all five slots and neighboring canaries, EAX/EDX and cookie
state, null/integer inputs, invalid mapping windows/frames, shared references,
retirement refusal, double/unknown unmaps, separate CPU instances and nested
EBP frames. A separately loaded authored NE uses LES and an ES read/write
through the returned far pointer, proving mutation of the original linear
storage. WORD-push entry and actual RET 8/RET 36 cleanup cover the demonstrated
unaligned compiler-call shapes. Nonvolatile registers, ECX and ESP are checked
from native stores; unmap retains an arbitrary signed result in EAX.

The full canonical locked build passes. The normal thunk/NE static suites
and compiled KERNEL.651 suite pass. Initial FT/LS compiled regression attempts
used a production module without their test-only exports and failed with
missing-export errors; those attempts are retained. Their purpose-built
module adds only their existing observation adapters; the reruns pass, including
actual Worker FT execution, nested/reentrant calls and normal connection detach.
No installation or latency claim follows from these ABI tests. A fresh
original remains conditional on immutable-module and actual finite
confirmation/release qualification with the original numeric limits.
