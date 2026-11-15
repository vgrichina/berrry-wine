# Native LS FT relay — 2026-11-15

This implements the bounded LS32 PE-to-NE FT path after pairing commit
`601bc085935d18894fbd6ca8bb89354a74bf9932` and report `9ba115235`.
Pairing alone remains insufficient: normal ThunkConnect32 succeeds only after
native ownership, a real relocated NE target table and executable FT relay
have been installed and the original six-argument request revalidated.

Primary ABI: Wine `dlls/krnl386.exe16/thunk.c`, commit
`cc5d1d86ee7d60649e6f858106db046c77c8b12c`, pinned at
`scratch/runs/20261115-sims-kernel651-native-thunk/wine-thunk.c`, SHA-256
`d42151b944101cb94c054950b1d99168f51c74ef5d1a08bbe866329dae4f7473`.
Evidence, source patches, exact Git/module/source pins, failed development
controls and direct watchdog/wait records are in
`scratch/runs/20261115-sims-native-ft-relay/`. Git is the source archive;
no media, source-tree or module archives are required.

## Implemented ABI

The native writer emits the primary 16 bytes: MOVZX EDX,CL; load the selected
DWORD FAR address from the real NE table; PUSH the ordinary PE-facing
FT_Prolog API thunk; RET. The primary emits near RET (C3), despite its lret
comment. Target selection uses CL only; upper ECX flags/count never widen it.
Both the target index and original relocated target remain checked.

At Prolog entry S points to the compiler-body return address; S+4 is its
caller return. Native ownership saves these before replacing [S] with old
EBP. B=S becomes EBP; the body starts with ESP=B-64. The entire buffer is
zeroed, with saved EBX/ESI/EDI/ECX at -4/-8/-12/-16, bitmap -20, original
EAX -48 and target FAR -52. The guest frame is ABI data, never authority.
Native metadata binds the owner, generation, frame chain, target and returns.
Only these register entry points bypass ordinary stdcall nonvolatile
restoration; the build checker requires their precise native delegates.

At FT_Thunk entry T, A=T+4 and N=B-A-64. The supported packet is even and
0..128 bytes, within one original stack window. Bit i in the bitmap selects
a DWORD at A+2*i. Selected DWORDs must fit wholly and cannot overlap; their
flat pointer values must lie in the copied packet. Conversion writes only
the private 16-bit copy, using its actual SS and packet-relative offset.
The actual far return measures even cleanup within that packet. Native
settlement copies back the packet, restores the parked PE context, then
merges independent EAX/EDX/ECX and measured ESP cleanup. The compiler body
assembles a long return in EBX. FT_Exit0 through FT_Exit56 return EBX in EAX,
restore the three saved registers and old EBP, and perform LEAVE/RET n while
preserving the body's other outputs, flags and segments.

The pinned C conversion loop contradicts its WORD-offset comment: it indexes
DWORD newstack[i], casts its value to a pointer, writes through it and
subtracts oldstack from a BYTE dereference. That unsafe C expression is not
reproduced. The implementation follows the documented WORD-offset,
stack-relative contract, checked by independent guest instruction oracles.
Incoming DS/ES/FS/GS reach the actual NE target; FT does not apply QT's
segment-clearing policy. Original selector/descriptor limits remain checked.

## Lifetime and failure behavior

Published connections belong to the native process epoch and PE image
generation, independently of the consumed attach request. The retained NE
alias, LS16 registration and native NE pin remain until checked retirement.
The temporary pairing PE callback pin transfers to generation ownership;
actual FT activations acquire their own PE callback pins. This avoids a
persistent-pin/unload cycle. An idle connection can be used by another
thread in the same process. Active frames remain thread-owned: same-thread
nested compiler bodies restore the native LIFO chain; concurrent foreign
thread use and busy connection retirement fail.

Calls revalidate original LS16/LS32 headers, checksum, names, actual PE export,
original target table, complete QT guard and exact emitted FT bytes.
Malformed or mutated input cannot supply a replacement target. A stale
process/generation cannot execute or restore bytes in a new image. Detach
restores owned header/relay bytes before releasing the original NE alias.

FT children unwind before persistent Prolog owners. Failed attach, guest or
NE trap, cancellation, bounded invocation exhaustion, abandoned DllMain
iteration, and Worker retirement use native cleanup before caller restoration
or generation finalization. Specific DLL cleanup preserves an unrelated
parked outer NE request. Worker stop joins its real command owner before
connection release. Busy retirement preserves the executing resources.

QT publication and other thunk directions are unsupported here and retain
their original guards. This is not general NE-to-PE thunk support. The FT
NE call executes synchronously within a bounded native invocation; an
asynchronous yield from that target is rejected. Oversized packets are
rejected rather than silently truncated. Thread notification reasons beyond
ordinary process attach/detach are not added by this feature.

## Qualification

`test/test-native-ft-relay.js` generates independent original x86 PE/NE
fixtures; it does not write target guest headers to simulate a connection.
Ordinary compiled imports establish the connection, execute two distinct
relocated FAR targets and detach locally, through the cooperative export
facade, and in a real Node Worker. Guest code records the complete 64-byte
frame and actual 16-bit stack, WORD scalar, converted FAR pointer, selector
values, copied structure mutation, separate AX/DX/CX and callee cleanup.

Native controls cover all fifteen Exit sizes, zero/128-byte packets, several
actual RETF cleanup sizes, upper ECX flags, incoming segment semantics,
nested compiler-body reentry, malformed/overlapping bitmap and pointer spans,
mutated target/header/relay/export/name/request, stale generation, foreign
process, cross-thread idle/busy behavior, normal DLL detach, BOOL-failed
attach, guest/NE traps, cancellation, invalid/bounded budgets and real Worker
retirement while connected or busy. Each failure checks native frame/request,
pin/alias lifetime and caller restoration rather than accepting a host TRUE.

Qualification uses committed HEAD plus only whole owned feature files;
unrelated shared op5/data-span/census and host WIP are excluded through exact
HEAD reads and retained separately for restoration. The independently run
19-suite regression set covers LS32, LS16, NE image/extent, invoke/QT/stack
ownership, local/cooperative/Worker lifecycle, Win4 entry, brush/GDI/system
colors and twelve native quit cases. The full locked build passed before publication. Its existing quiet-handler pin mismatch was independently
reproduced on HEAD: both HEAD and the FT view have the identical 235-entry
inventory, so its count/hash repair is included without adding stubs. The clean-commit
audit also admits a proved unchanged-parent inventory with a decreasing count;
added handlers and unexplained same-count re-pins still fail.

The retained source-view compiler is a small run recipe, not a source snapshot.
To reproduce the instrumented controls in this shared checkout:

```sh
node scratch/runs/20261115-sims-native-ft-relay/compile-owned.cjs
WA_TEST_WASM=build/native-ft-owned.wasm node --require ./scratch/runs/20261115-sims-native-ft-relay/owned-head-hook.cjs test/test-native-ft-relay.js --compiled
```

The ordinary production module is built with `flock /tmp/wine-build.lock bash
tools/build.sh`; this run uses the recorded HEAD source-view hooks to exclude
unrelated shared WIP. Both production and instrumented module hashes are
recorded, and the genuine attach uses the production module.

## Genuine selected attach

One ordinary attach retest is reserved until the qualified feature is
published. Its result will distinguish native connection settlement, actual
FT execution, complete DLL attach and the exact next unsupported primitive.
No installer or Sims UI is claimed by the synthetic qualification.
