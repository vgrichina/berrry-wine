# Neverhood: the observed FT entry is a QT fall-through

Evidence: `scratch/runs/20261117-neverhood-ft-prolog-word-stack/`.

The original run's `FT_Prolog` trap does **not** establish a valid genuine
FT caller. The original installation is blocked earlier, at unpublished LS32
QT relay execution. Removing the DWORD-alignment check would admit the wrong
frame. No production ABI repair or new original run is claimed here.

## Genuine caller and frame

The existing ISO is `scratch/media/neverhood-original.iso`, SHA-256
`94de724bb47eb2aa588ac4eff28ddc6fd10edebcf2be4dd131ef76875ef5ffd3`.
Reading its existing DSETUPE member at bytes 650446848..650492927 reproduces
SHA-256 `bdb0ec0953570355b9d6995f8c70e067bd314911090acf32fbe9883f33875945`.
No media or member copy is needed. `caller-proof.json` pins the retained
disassembly, byte windows and original stdout log.

The actual instruction at preferred `0x1000476a` is
`CALL DWORD PTR [0x10004719]`. That pointer contains `0x1000959c`, the QT
relay. The separate pointer at `0x1000471d` contains `0x100095bc`, the FT
relay 32 bytes later. The caller continuation at `0x10004770` reconstructs
EAX from DX:AX, unmaps four EBP slots, executes LEAVE and RET 36. It never
builds an FT bitmap or calls FT_Thunk/FT_Exit.

Both original relay slots contain 32 INT3 bytes each. Native FT publication
replaces only the FT slot. It intentionally preserves the QT slot, whose
bytes are checked on each connection validation. However, decoder opcode
`0xCC` emits handler 45 (`th_block_end`) with the next instruction address;
it does not trap. Consequently execution crosses all 32 original QT bytes
and reaches the adjacent published FT relay.

The old original trace independently records this exact transition:

| Observation | Actual value |
| --- | --- |
| Loaded DSETUPE base | `0x006cc000` |
| QT relay start | `0x006d559c` |
| Previous block before FT relay | `0x006d55bb`, original INT3 |
| FT relay start | `0x006d55bc` |
| Prolog return | `0x006d0770`, genuine QT continuation |
| EBP | `0x074fd490` |
| ESP | `0x074fd42a` |
| `[ESP+4]` | `0x90001a3f`, packed QT argument |

The WORD alignment is explained by the genuine packet, without an FT call:
EBP minus 4 flags bytes, 60 scratch bytes, 2 HWND bytes, eight DWORD arguments
and the 4-byte CALL return equals `0x074fd42a`. The existing FT code would
instead interpret `[ESP+4]` as its caller return, replace `[ESP]` with old EBP,
and return into this QT continuation with a different EBP and ESP.

The pinned primary [Wine thunk implementation](https://github.com/wine-mirror/wine/blob/cc5d1d86ee7d60649e6f858106db046c77c8b12c/dlls/krnl386.exe16/thunk.c)
distinguishes the protocols: QT consumes an already prepared argument packet
under the caller's EBP; FT_Prolog creates a new frame and 64-byte buffer before
its compiler body converts structures and invokes FT_Thunk. FT_Exit restores
that frame and returns to the thunk's caller. Its implementations contain no
DWORD-alignment requirement. This is a compatibility reference, not recovered
Microsoft implementation evidence.

## Native counterexample and limits

`test/test-neverhood-ft-word-stack.cjs` is explicitly a baseline diagnostic,
not an acceptance test for a repaired word-aligned FT ABI. Its authored PE/NE
connects through ordinary imports, keeps the original QT slot intact and
uses the genuine caller's frame arithmetic. It independently records every
executed block through all 32 INT3s and the adjacent published FT relay.

With the observed ESP `0x074fd42a`, current Prolog rejects alignment before
acquiring a parent. Moving the same invalid QT-shaped frame by two bytes
passes alignment, acquires an FT parent and resumes the QT body with an FT
EBP/ESP; the packed argument remains in the supposed FT caller-return slot.
The diagnostic stops before executing that corrupted continuation, aborts
the exact native frame, and checks restored header/relay bytes and no live
FT frame or execution depth after retirement.

A separate authored, valid FT caller completes at DWORD alignment. Its WORD
variant currently traps. That remains an unqualified compatibility limitation;
it is not the causal repair for this original. No new alignment rejection is
introduced or justified by this report, and no claim is made that odd FT
stacks are forbidden by the actual ABI. Genuine word-stack frame/map/copyback,
reentrant restoration and Worker cancellation acceptance remain undone.

The diagnosis passes on both the exact previous production module
`1360defeb5faa36d2007b4c4c3b5651e8c11e0a9fd80c4b07661b220e09c75b1`
and Git-only main `81c21498cc441f514657ee969681fa7cdf2c19a6`, with only existing
read-only FT/LS32/NE test observation exports appended. The latter module is
`c5486cdad6e409a6c6b396b516309afceefbeabe7c0ee6a7fd1e87ed29392412`.
Source pins and the reconstruction recipe are retained; foreign WIP is excluded.

The existing full native FT suite passes, including its actual CPUWorker,
cooperative, nested/reentrant, mapping/copyback/restoration, cancellation,
invalid-frame, busy-lifetime and retirement controls. Native LS32, SMapLS and
KERNEL.651 pass, as do QT stack/driver and static NE caller controls. These
preserve the previous supported FT behavior; they do not qualify word FT.
An extra attempt to run the checkout's **untracked** legacy
`test/test-ne-thunk-contract.js` fails because its `inspectThunkConnect32`
import is absent from published main. That foreign file is neither changed
nor counted as a passing regression. Exact waits and stderr are retained.
The final canonical `flock /tmp/wine-build.lock bash tools/build.sh` passes.
Its first attempt caught a raw-literal gate failure in VB-owned shared WIP;
that owner corrected the expression without relaxing the gate before the
successful final build. The shared canonical module is not substituted for
the immutable Git-only module used by this diagnosis.

## Next concrete boundary

Implement and qualify actual LS32 QT relay publication/execution and ensure
an unsupported QT slot cannot silently cross into FT. Keep unsupported
DirectXSetup guarded. Do not substitute an FT frame for the genuine QT packet,
patch the guest, or infer QT support from unrelated direct QT invocation tests.
After material repair and published synchronous native-control receipt
qualification, prepare the authorized immutable original pipeline. This
worker has not consumed that authorization, contacted an old endpoint, or
claimed installed Play, a room or native Quit. No boxes were created.
