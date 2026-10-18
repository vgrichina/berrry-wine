# CRTDLL setjmp / longjmp source audit

2026-10-18. Original Circus 1.0.0 imports both `_setjmp` and `longjmp` from
CRTDLL (retained pe-closure.json in 20261018-circuslinux-source). The original
run after setbuf stops at `_setjmp`, EIP 00464038, return 00409ddc, buffer
009dcfec. The retained disassembly tests EAX after the call and branches on
zero. A first-return-only implementation would conceal missing error recovery.

## ABI evidence

Wine's [CRTDLL export specification](https://github.com/wine-mirror/wine/blob/master/dlls/crtdll/crtdll.spec)
forwards these exports to its CRT implementation. Its
[i386 implementation](https://github.com/wine-mirror/wine/blob/master/dlls/msvcrt/except_i386.c)
and [jump-buffer definition](https://github.com/wine-mirror/wine/blob/master/include/msvcrt/setjmp.h)
establish the following compatibility model; this is upstream implementation
evidence, not execution against an original Windows CRTDLL oracle.

| Offset | i386 field |
|---|---|
| 0 | EBP |
| 4 | EBX |
| 8 | EDI |
| 12 | ESI |
| 16 | ESP at setjmp entry, including the return-address slot |
| 20 | caller return EIP |
| 24 | SEH registration from FS:[0] |
| 28 | try level |

The newer setjmp3 form extends this with cookie, unwind callback and six
unwind-data words; old setjmp must not blindly overwrite those extensions.
Initial setjmp returns zero. Longjmp returns to that saved call with the supplied
value, normalizing zero to one; resumed ESP must be past the saved return slot
while preserving the caller's cdecl arguments. SEH differences require unwind
processing before register restoration, not just copying FS:[0].

## Repository boundaries that prevent a safe handler-only patch

1. `src/09a6-handlers-crt.wat` currently implements `_setjmp3` by clearing
   64 bytes and returning zero. It does not save registers or support a paired
   nonlocal jump. It cannot be reused as an implementation of this ABI.
2. `src/09b-dispatch.wat` saves the entry nonvolatile registers and restores
   them after the generated dispatch. A longjmp handler that restores its
   saved EBX/ESI/EDI/EBP would have that work silently undone. It needs an
   explicit nonlocal dispatch path that also sets both EIP redirection signals
   (`steps=0`, `handler_set_eip=1`) for decoded and thunk-zone entry paths.
3. Restoring registers is insufficient across native callback lifetimes.
   `src/13-exports.wat` saves and clears `api_handler_depth` around each run,
   so testing that depth cannot reliably reject nested guest execution.
   `propsheet_page_callback` in `src/09a9-comctl32.wat`, for example, invokes
   nested run under sync depth and subsequently restores its prior register
   context. A jump escaping that callback could later be overwritten by the
   host continuation. Deferred callback state also needs a separate audit.
4. Main-thread TIB StackBase/StackLimit exist in `src/08-pe-loader.wat`.
   A bounded implementation must validate saved/current stack ownership for
   worker and cooperative contexts too. A shared jump-buffer pointer alone
   does not prove that the same thread owns the saved execution context.

## Proposed bounded implementation and required tests

The tractable first subset is a genuine pair for ordinary same-thread guest
calls with empty SEH chains and no crossing of host callback lifetimes. Reject
SEH/unwind callbacks, invalid ownership and unsupported callback state before
modifying registers or buffers. Do not turn setjmp into a successful first
return until the matching longjmp path is implemented and tested. Do not add
emulator metadata in ABI buffer bytes that an old caller may not allocate.

Before implementation, enumerate synchronous/deferred callback ownership and
identify one reliable guard or saved-context token, then add the nonlocal
dispatcher exception. The JS conformance fixture must execute actual x86
through both API imports: initial zero, nested guest call to longjmp, second
return with positive/negative values and zero normalized to one; preserved
EBX/ESI/EDI/EBP and exact ESP/return address; multiple independent buffers and
threads; SEH, callback-crossing and foreign-thread rejection without partial
mutation. Exercise both decoded CALL and thunk-zone dispatch. Direct WAT
handler tests alone would miss the unconditional register-restoration bug.

This checkpoint stops at design because a correct pair crosses dispatcher,
thread ownership and callback lifetime contracts. No API rows, handlers or
test claims were added; existing fail-fast `_setjmp`/`longjmp` remain intact.
No build, runtime, game or browser was run. A first-return stub or alias to
the current `_setjmp3` would not meet the required behavior.
