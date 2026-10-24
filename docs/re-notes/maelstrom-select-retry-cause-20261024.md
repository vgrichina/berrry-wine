# Maelstrom: distinguish native errno retry from a CheckSockets return

No real implementation defect is proven by this offline investigation, so no
networking or interpreter change is made. The exact next predicate is
**`u32[EAX] == 4` at runtime PC `007a3366`, immediately after native `_errno`
returns**. At that boundary EBP holds the completed select result and
`[ESP+0x124]` identifies the caller of this CheckSockets invocation. Neither
that errno nor that caller was observed in the existing capture.

The important correction to the previous uncertainty is that this is **native
MSVCRT C errno**, not Winsock's `WSAGetLastError`, and the native code clears it
before every select attempt. A parked select's EAX cannot answer this predicate.

## Authentic retry path

The byte-checked SDL_net.dll at preferred base `10000000` was loaded at
`007a2000`; add `006a2000` to preferred addresses below. The retained
[disassembly](maelstrom-select-retry-cause-20261024/native-0.txt) and
[proof result](maelstrom-select-retry-cause-20261024/proof-result.json) establish:

| Preferred address | Meaning |
| --- | --- |
| `100012f2` | EDI receives IAT `10002010`, imported `MSVCRT.dll!_errno`. |
| `1000130d–1000130f` | Call `_errno`; write zero through its returned pointer. This also happens after retry. |
| `10001315–1000133e` | Rebuild the read fd_set from the socket set. |
| `1000133e–1000135d` | Supply a freshly assembled timeval, readfds, NULL writefds, NULL exceptfds, and largest socket handle + 1 as nfds; call WSOCK32 ordinal 18 (select). |
| `10001362` | Save select's EAX into EBP. |
| `10001364–10001369` | Call `_errno`; compare `*EAX` with 4; JE back to `1000130d`. The test is unconditional, including after a zero or positive select result. |
| `1000136b` | If not retrying, classify saved EBP; nonpositive results skip readiness marking. |
| `10001375–1000139a` | For a positive result, visit sockets and mark members using `__WSAFDIsSet`. |
| `1000139c–100013a7` | Restore registers/frame and return saved EBP as CheckSockets EAX. |

Native MSVCRT is actually loaded and its imports are patched into SDL_net in
the [raw prior output](maelstrom-select-retry-cause-20261024/prior-output.log).
The final EDI `0052e430` maps to preferred `7800c430` in this DLL, agreeing with
the actual `_errno` implementation. Its bytes call `_getptd` then add eight to
the returned thread-data pointer. `_getptd`'s fast path uses `TlsGetValue` and
preserves Win32 LastError with GetLastError/SetLastError. This does not make C
errno an alias for `WSAGetLastError`. See the two short
[CRT](maelstrom-select-retry-cause-20261024/native-1.txt)
[slices](maelstrom-select-retry-cause-20261024/native-2.txt).
The emulator's `$handle__errno` is therefore not the native function whose
pointer EDI contains in this capture.

The EXE contains four byte-bound relative CALL references to its CheckSockets
import trampoline: `40e125`, `40e6b6`, `40ea7a`, `40ed93`. Only the first has
return `40e12a`. The relative-call scan does not exclude indirect callers.
Without the caller frame, select-return counts cannot identify which invocation
they belong to. A missing `40e12a` trace is not proof that all 972 returns retried
inside the same CheckSockets call, or proof of any errno value.

## Historical implementation versus current main

[Source proof](maelstrom-select-retry-cause-20261024/source-proof.json) binds
the exact Git blobs and byte-exact function excerpts. The historical source is
`b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`; current-main donor is
`9183b84473507ffe7c0598725e080a821c747945`. Six relevant functions are identical:
`vsock_filter_set`, `vsock_timeval_ms`, `handle_select`, `vsock_block`,
`handle_WSAGetLastError`, and the emulator `handle__errno`.

Select counts ready sockets without rewriting its input sets while waiting.
For the supplied read set (count one, handle `53000000`), nfds `53000001` is
largest-handle-plus-one, not a request to scan that many handles; the handler
does not use nfds. Timeval `(1,0)` becomes 1000ms. A finite deadline is retained
across parks. `vsock_block(24)` restores the stdcall frame, sets EIP to the current
thunk and prevents auto-pop, then yields with reason 8. On completion select
clears waiting, filters sets (empty on timeout), and writes the readiness count
to EAX. Its ordinary completion has no `-1` assignment and does not bridge
Winsock errors into native C errno. `WSAGetLastError` reads a separate emulator
global. No change to these functions is justified by the available evidence.

These are source semantics, not observed completion values. The prior parked
read set and timeval describe a pending request. Native TLS contents, an actual
retry branch, completed select EAX, packet state and CheckSockets caller remain
unobserved. The prior Sync barrier diagnosis remains valid conditionally once
the caller/return is established; startup budget diagnosis is not repeated.

## One distinguishing observation, not executed

Use a single bounded snapshot at **`007a3366`**, the native `_errno` CALL return
before `CMP [EAX],4`. Capture registers plus only `eax:4,esp+0x124:12`:

```
--trace-at=0x7a3366 --trace-at-start-batch=36163 --trace-at-limit=1
--trace-at-mem=eax:4,esp+0x124:12
```

EBP is saved select result; `[EAX]` chooses retry versus `007a336b`; the three
stack words identify CheckSockets return PC, socket-set pointer and timeout
argument. Offset `0x124` is its `0x114` local frame plus four saved registers.
If the caller is `0040e12a` and errno is four, this directly selects the internal
retry. If errno differs, classify EBP and the observed caller before assigning
the missing trace to a Sync timeout or packet path. A different caller corrects
the attribution. One record does not establish the history of all 972 returns.

The canonical runner at `d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e` supports
these expressions and single-PC delayed tracing. This is an unexecuted
replacement diagnostic, not authorization for another run, more observation
batches, altered inputs or packet injection. No guest, browser, build, module
instantiation, acquisition or box operation occurred here.

## Verification and recovery

Run [the offline verifier](../../tools/maelstrom-select-retry-proof.py) using:

```
python3 tools/maelstrom-select-retry-proof.py \
  --original /tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6 \
  --crt /home/user/wine-assembly/test/binaries/dlls/msvcrt.dll \
  --evidence docs/re-notes/maelstrom-select-retry-cause-20261024 \
  --source-repo /home/user/wine-assembly-shadow-man-span-static-canonical-oct23 \
  --current-repo . --git-stderr /tmp/maelstrom-select-retry-git-stderr.log
```

Under fresh MemAvailable >=805306368 and CPU/wall 60 seconds, it checks complete
EXE/SDL_net/MSVCRT identities, native import bindings and instruction anchors,
four relative caller references, actual historical/current function equality,
runner identity, seven rejecting native-byte mutations and nine algebraic
errno/result controls. These controls validate static predicates; they execute
neither guest instructions nor a WASM instance. The unchanged implementation
passes this semantics check: there is no claimed repair/regression rejecting
an unchanged baseline. The source hash/extraction recipe is explicit in the
receipt; installed objdump is run in place and separately identified.

Input capture donor is `4f9711d8255babd5d3c443312c8d5ed5fdb00b45`; accepted Sync
logic donor is `6c265033d01e547a3d9320316cc17027bbb7cb0b`. Raw output, command,
terminal, analysis and recipe-identity are copied byte-for-byte with `prior-`
prefixes; complete identities are sealed in this bundle. The prior runner SHA
is `4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`;
the read-only historical module SHA remains
`8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`.
No module was copied or instantiated. The original 42000-batch host exit zero
is not guest exit; the 972 counter is not 972 Sync iterations. Parked EAX
`53000001` is not a completed return value.

Task-root admission, test, accounting, publication and cleanup receipts live
at `/tmp/maelstrom-select-retry-cause-oct24`. The focused checkout uses explicit
noncone paths and read-only alternates; root tracked/index/refs and all donors
remain read-only, with append-only board ownership. Alternate-depth diagnostics
are retained in bounded `git-stderr.log`; an early extraction leaked diagnostic
lines to capture once, charged conservatively, then subsequent Git stderr was
redirected. No denial/retry occurred. No mount argv or runtime exists in this
offline task, so mount validation is inapplicable. Git publication uses the
supplied dedicated identity and known-hosts file with strict checks.

No box is assigned. Prior `bx_rfd49qx6` was reported snapshot-stopped by the
coordinator; no lifecycle query or mutation was issued, and its former expiry
was `2026-10-24T10:02:43.642Z`. Coordinator retains lifecycle ownership. The
worker stops after publication, final resource/cleanup receipts and writing the
ops result last; the coordinator owns any follow-up observation assignment.
