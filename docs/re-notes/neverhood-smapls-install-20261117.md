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

## Published original continuation and concrete next blocker

Material repair `b894cb2871f23bc97f010fe39cb92da64741192a` was published before
preparing the immutable runtime. Its 4573 source entries use that Git tree,
an empty owned patch, and no foreign WIP. The retained production module is
SHA-256 `1360defeb5faa36d2007b4c4c3b5651e8c11e0a9fd80c4b07661b220e09c75b1`.
The same module passed the compiled ABI witness and the released controller's
actual native positive fixture. Both complete fixture dialogs were personally
viewed before their separate finite clicks; actual native/controller waits
passed. No helper limits were changed.

Exactly one new complete original SETUP95 pipeline used the full pinned CD,
genuine dependencies, defaults and real clocks. Its independent 2420-second
watchdog was armed before the fixed 2400-second native run, with 240 seconds
reserved for Quit. The unsupported DirectXSetup guard stayed armed. The old
UNKNOWN endpoints were never contacted. The small run-specific wrapper binds
the released runtime helper to this newly authorized run; the published helper
itself is unchanged. Only five HTTP requests occurred: capture, bind, one
Install intent, independent release, and its observation. There was no retry.

The complete original launcher was personally viewed, then Install was clicked
within its 30-second menu freshness bound. From intent, the guarded confirmation
receipt arrived in 104.375 ms, independent physical-UP acknowledgement in
268.766 ms, and immutable completion in 616.986 ms (limits 500/1750/3000 ms).
These are receipt timings, not exact native dispatch timestamps. The observation
at 543.537 ms already showed genuine DirectX installation windows and physical
UP. The passive log observer records host observation times explicitly, not
exact effect times. Native execution continued through DirectX INF reads,
audio driver INF/dx_ver.dll/isna.dll copies, DSOUND loading and waveOut open.
Thus this run has both timely input receipts and subsequent native progress;
it does not establish the cause of the previous run's late receipts.

The next concrete failure is API #3557, FT_Prolog, return `0x006d0770`, batch
22833. The native crash log records ESP `0x074fd42a`, EBP `0x074fd490`, and the
preceding genuine DSETUPE relay at preferred `0x100095bc`. The existing
`win16_ft_prolog` rejects `(ESP & 3) != 0` before creating its frame. This
recorded ESP is 2 modulo 4, so the present guard necessarily rejects this
compiler call shape; its handler deliberately traps on rejection. The new
MapLS implementation did not alter this guard. Earlier FT fixture passes do
not qualify the original unaligned FT_Prolog entry. Repairing that separate
ABI requires its own real prolog/frame semantics and native witnesses.

Native exited 1 with actual wait and both pipes at EOF; watchdog exited 0,
also waited with both EOF. Runtime descriptors closed. The sealed-source
holder is absent; its tool wait returned 143 without an orderly helper-close
receipt, so descriptor release is attributed to process termination, not a
fabricated successful helper close. No box was created (ID/expiry null,
stop receipt not applicable). Media postflight matches preflight. There is no
installation-complete, Play, first-room or native-Quit claim, and no second
original was launched. Selected screenshots are the original launcher and
the two personally reviewed native qualification dialogs; no frame series
or source archive was made. Detailed pins, waits, timings and closure are in
`result.json` in the evidence directory.
