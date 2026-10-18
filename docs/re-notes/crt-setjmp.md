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

## Invocation ownership handoff

The existing depth is not a sufficient identity token: two sequential callbacks
can have the same depth, and a deferred callback can outlive a run slice. Keep
an emulator-private, per-thread invocation stack with monotonically allocated
IDs, not a depth stored in jmp_buf. A guest thread starts in one root invocation.
Entering any host-owned guest callback pushes a new ID; its matching completion
pops it. A run budget/yield and ordinary guest CALL/RET do neither. A callback
that is suspended across host slices retains its ID. IDs must never be reused
on wrap, thread-slot reuse or process-memory reset; fail-fast before exhaustion
or include a fresh lifetime generation.

Keep a private saved-jump record keyed by guest buffer address, process/thread
lifetime and current invocation ID, with the ABI context snapshot. This avoids
inventing fields past the old buffer's 32-byte saved prefix. Repeated setjmp at
the same address replaces that owner's record. Longjmp requires matching
ownership, live invocation, unchanged supported ABI fields, empty current and
saved SEH chains, and saved/current ESP within that thread's TIB bounds before
any mutation. For the initial conservative subset, allow only the root
invocation (no callback setjmp/longjmp at all). An outer record survives a
callback that returns normally, but is unusable while any child is active.
Reject forged/unregistered buffers instead of guessing their ownership.

The callback-entry census below identifies separate mechanisms that must be
covered; none can be inferred from `api_handler_depth` alone.

| Mechanism | Exact source anchors | Required ownership action |
|---|---|---|
| Synchronous nested WAT run | `src/04-cache.wat` sync_depth_enter/leave; callers in `09a7g-video-icm.wat`, `09a9-comctl32.wat`, `09c3a-dialog-runtime.wat`, `09c3-wndprocs5-edit.wat`, `09c9-winhelp-ui.wat`, `09e-win16-api.wat`, `11-seh.wat`, `13-exports.wat` | Push/pop alongside paired sync depth; verify exceptional exits. SEH/Win16 remain rejected. |
| Cross-thread SendMessage | `src/13-exports.wat` thread_send_begin/end | Owner-thread child invocation survives worker slices; native immediate completion must not strand a token. |
| JS-driven COM callback | `lib/storage.js` _runComCallback and its callers; `src/13-exports.wat` call_func | Explicit begin/end exported bracket; each host caller must finish or abort it, including exceptions. |
| Timer, wave and APC injection | `src/13-exports.wat` fire_mm_timer, mm_timer_in_cb, wave_callback_saved, apc_resume_alert_sleep and their definitions/callers | Push at injection and pop when restoring interrupted context, not at each run call. |
| Deferred API callbacks | `src/09b-dispatch.wat` CACA continuations; `src/09a6-handlers-crt.wat` qsort_continue, bsearch, initterm, atexit | Begin before guest callback entry and finish on matching continuation; keep the token across yields. |
| Typed generic CACA0011 contexts | `src/09b-dispatch.wat` OLEC, DPEN, DPES, DIEN, DPLA/DPLT, CCTL, KHK1/GMK1, TACC, FTNC, MFEC, SYS1 | Associate the invocation with the concrete retained context; chaining another callback must finish the old child and begin a fresh child. |
| USER creation/dialog/hook/send continuations | `src/09b-dispatch.wat`, `src/09a5-handlers-window.wat`, `src/09a-handlers3-sync.wat` | Same retained-context rule; failure/destruction/quit paths must close ownership. |

This is a mechanism census, not proof every call site is already enumerated.
Before handlers land, the implementation worker must classify every guest
callback EIP assignment and every externally callable context-injection export.
Relevant producer files beyond the table include `09a0-handlers-base.wat`,
`09a0b-handlers-base-late.wat`, `09a2-handlers-console.wat`,
`09a7b-ole.wat`, `09a8-handlers-directx.wat`, `09d4-dplay-net.wat`, and JS
thread-manager/worker dispatch. Add a maintained source census gate similar to
the existing sync-depth write gate; reject unknown producers rather than
declaring the guard complete. Stack scanning for CACA words is not an
ownership proof: guest data can imitate markers and nested state may be private.

### Dispatcher integration

Use a per-call disposition returned from the nonlocal restore path, rather than
a sticky instance flag. In `src/09b-dispatch.wat`, a dedicated longjmp branch
must bypass restore_win32_nonvolatile only after all validation succeeds;
ordinary calls retain their existing epilogue. It sets restored ESP/EIP and
both redirect signals, and performs existing log/resource-scope cleanup.
Do not bypass the outer win32_dispatch cleanup. Add private state through
`src/00-regions.wat` and its generated mirror, with initialization/lifetime
reset in `src/08-pe-loader.wat` and `src/13-exports.wat`; implement handlers in
`src/09a6-handlers-crt.wat` only after the ownership hooks are sealed. Append
the two API rows and regenerate both tables at that point.

### Guard acceptance tests before original retry

- Actual guest jumps through decoded CALL and direct thunk entry preserve the
  four nonvolatile registers and exact stack; return values include 0→1 and -1.
- A jump remains valid across ordinary run-budget yields and an API without a
  callback. Normal returned callbacks restore the parent token.
- Reject root→active callback, callback→root, sibling callback at equal depth,
  callback-after-return, foreign thread, reused thread slot, and reused process
  memory. Each rejection leaves buffer/registers/ownership state unchanged.
- Test one synchronous nested run, one deferred CACA callback spanning slices,
  JS COM, cross-thread SendMessage, and timer/wave/APC injection. Include abort,
  exception and destruction paths so leaked/mis-popped tokens are observable.
- Reject nonempty SEH, changed ABI buffer fields and unregistered buffers before
  restoration. Exhaustion must fail-fast, never reuse a live identity.

Implementation handoff is intentionally broader than two CRT handlers. No
existing counter has yet been demonstrated to cover all these lifetimes;
the first worker milestone is the sealed producer census and token tests,
followed by real jump handlers. This audit added no runtime or API behavior.
