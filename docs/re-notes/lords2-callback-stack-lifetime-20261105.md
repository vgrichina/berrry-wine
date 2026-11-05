# Lords II: callback stack lifetime, 2026-11-05

Task NEW-GAME-LORDS2-DEMO-20261015; predecessor input main
`7d15155129a6538466316d193b51eeb87389384b`. Evidence directory:
`scratch/runs/20261105-lords2-callback-stack-lifetime/`. No original run,
guest modification, selector/frame forcing, browser, box, or subworker is used.

## Result

No emulator mismatch was demonstrated, so this change records a bounded
evidence gap and does not change emulator behavior. The retained
code and caller context identify the suspect storage as a guest stack-local C++
subobject retained by a guest HWND-to-object map. This is distinct from USER's
invocation-owned callback/continuation frames. The open question is why HWND
`013b` survives in that map after its destruction wrappers return zero.

## Causal chain recovered from unchanged evidence

Source evidence is the predecessor's `live-write-history.json`,
`live-operands.json`, and `causal-code-disassembly.txt`; their SHA-256 identities
are in `retained-analysis.json`. Static reads use the existing unpacked
`scratch/runs/20261105-lords2-recovered-original-gameplay/generated-setup.exe`
without copying or executing it. Its retained SHA-256 is
`7dbf696d4f08464ca1e187686368fe89c5b71b3162c094f463d0e5ec4eaca567`.
NE segments 2/3/4/5 correspond to runtime selectors `004f/0057/005f/0067`;
stack/data selector `0087` has base `001f0000` in this instance.

1. The caller at `004f:80ae` establishes BP `88c6`, allocates its local frame,
   and passes `SS:[BP-6a]`, linear `001f885c`, to `0057:e0d4`. That constructor
   adds `48` at `0057:e110` and invokes `0067:c926`. Thus watched object
   `001f88a4` is aggregate-local `885c+48`, not emulator callback scratch.
2. `0067:c926` calls the base constructor `005f:8d2e`, then installs vtable
   `0067:c9a0`. Guest attachment at `005f:8f6e` stores the HWND at object `+14`
   and inserts the object's far pointer through `0067:34aa` into the guest map
   identified by `DS:4f1e`. Lookup `005f:8f48` uses `0067:3468`; detach
   `005f:8fa8` removes the entry through `0067:354c` and clears member `+14`.
   These routines establish the registration/lookup ownership statically;
   the retained trace does not show the dynamic insertion itself.
3. Caller `004f:89b4` destroys the same aggregate through `0067:98dc`. Its
   `+48` subobject goes through `0067:54b8`, `005f:9430`, `005f:930a`, and
   final base teardown. The observed `c9a0/db4e/e188/87a8` writes are normal
   guest destructor-chain vtable transitions followed by `leave; retf 4`.
4. `005f:9430` looks up the object in the permanent map, calls USER.53
   `DestroyWindow(this->HWND)`, and detaches explicitly only when its prior
   permanent-map lookup was false. With a permanent entry, destruction
   notifications must cause the guest cleanup. Object member `+14` is still
   `013b` before/after both destructor wrappers (events 447,449,451,453).
   Captured EAX is zero at events 449/451; the preceding block `0067:54d7`
   and the wrapper's normal return path imply a zero DestroyWindow result.
   This API result is an inference from wrapper code/registers, not a retained
   API-entry/return trace. No notification sequence or handle-table mutation
   was captured.
5. Later `005f:9cb4` receives HWND `013b`, looks up the object through
   `005f:8f48`, and calls `005f:a26c` with `0087:88a4`. Its LES/virtual dispatch
   consumes the already-reused local. The ordinary CALL at `005f:8697`
   correctly installs return `005f:869c` at `001f88a4`; this explains reuse,
   not the retention cause. It requires no change to CALL/LEAVE/RETF.
   The retained consumer stack contains HWND `013b`, notification word zero,
   command ID `0007`, message `0111` (WM_COMMAND), and return `005f:9d05`.
   `005f:9923` invokes the command virtual handler with those three words;
   `005f:9cb4` interprets them as ID, notification and child HWND. This is a
   command-dispatch lookup, not evidence that USER itself retained the C++
   pointer. The exact parent HWND/WndProc registration and command producer
   are not captured by these records.
6. The retained callback wrapper also calls KERNEL.55 Catch with a stack-local
   catch buffer (`005f:8e12`, `[BP-34]`). Static presence alone does not prove
   that Throw bypassed cleanup. No Catch/Throw execution event or matching
   restored frame is retained.

## Contracts and narrow implementation review

[Microsoft's CWnd destruction note](https://learn.microsoft.com/en-us/cpp/mfc/tn017-destroying-window-objects?view=msvc-170)
distinguishes the C++ object from its HWND and describes final cleanup through
WM_NCDESTROY. [DestroyWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-destroywindow)
returns zero on failure and sends WM_DESTROY/WM_NCDESTROY during destruction.
[Wine's USER16 implementation](https://raw.githubusercontent.com/wine-mirror/wine/master/dlls/user.exe16/window.c)
corroborates DestroyWindow16's widening bridge and RegisterClass16's structure
copy. [CreateWindow's parameter contract](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-createwindowa)
passes lpParam through CREATESTRUCT during creation; it does not transfer
ownership of an arbitrary pointed-to C++ object to USER.

`src/05c-seg16-ops.wat` pushes far CALL return IP/CS, pops RETF and its explicit
argument count, and implements LEAVE relative to SS. `src/09e-win16-api.wat`
copies/narrows RegisterClass input, stores the far procedure value, and builds
WndProc arguments and continuation records on the active guest stack.
CallWindowProc uses the existing return frame with the callback argument
cleanup. DestroyWindow allocates its invocation record on that same stack,
synchronously dispatches WM_DESTROY/WM_NCDESTROY and retires the window. It
returns zero immediately for a retired/unmapped handle or missing window-table
entry. Catch writes caller state into the guest-provided buffer; Throw restores
that state. No inspected path owns the guest's map entry or extends the
lifetime of the local aggregate. Host detached imports and cooperative dispatch
were read narrowly; no retained event identifies a cooperative task restoration
or abort as the cause here.

## Generated regression

Prepared `callback-regression.cjs` assembles a small two-segment NE with actual
USER/KERNEL relocations. It uses `load_ne`, runtime-created selectors, ordinary
guest instructions and real host imports. It tests:

- Stack WNDCLASS registration, immediate reuse of that structure, and successful
  creation from the copied callback registration.
- A caller-owned local object passed through WM_NCCREATE's CREATESTRUCT and
  through nested SendMessage/CallWindowProc while its owner is live.
- Nested far CALL/LEAVE/RETF with Pascal argument cleanup; preserved stack,
  BP, segments, and callee-saved registers.
- Synchronous DestroyWindow, exactly one WM_NCDESTROY, retired IsWindow, intact
  live local guards, and no callback after owner return and frame reuse.
- A positive map-detach case and a generated negative control that retains
  its own guest map pointer. Only the latter reads `eeee:eeee` from the local
  after an ordinary new frame takes ownership and overwrites it.
- Catch/Throw with a caller-owned buffer and two nested abandoned far frames;
  return value, SP/BP/SI/DI/DS/ES restoration and unreachable return markers.

Both generated cases passed on both production modules, including the expected
read of reused storage only in the retained-guest-map control. The nested
callback frames remained below the live caller object. This covers the ordinary same-task lifetime and unwind
contracts; it does not recreate the unknown failing HWND's history, a
cross-task callback, an unobserved Throw, or every cooperative blocking path.

## Bounded remaining evidence gap and next diagnostic

The next diagnostic should trace the *first* USER.53 call from `005f:9430`
for narrow HWND `013b`, not another final-fault/writer capture. With separately
authorized original execution, record one bounded sequence containing:

1. Narrow handle widening entry, full HWND, window-table presence, stored
   WndProc/DlgProc and owner task/thread immediately before destruction; identify
   the exact early-zero branch if taken and the API's actual AX result.
2. All WM_DESTROY/WM_NCDESTROY entries/exits for that HWND, including SS:SP/BP,
   callback far procedure, continuation stack bounds and current instance.
3. The guest map entry for HWND 013b at attach, destruction and detach, including
   calls `005f:8f6e`, `005f:8fa8` and guest map removal `0067:354c`.
4. Only if encountered in that interval, Catch/Throw buffer address and saved
   versus restored SP/BP/CS/SS, plus cooperative snapshot/restore identity.

This distinguishes an already-retired handle with stale guest mapping from
wrong widening/window ownership, missing cleanup notification, or nonlocal
unwind across the destructor. Preserve the invalid-handle guard and coverage/
ownership assertions. A repair is warranted only once this identifies a
specific emulator transition contrary to the documented contract.

## Reproduction and publication

Ordered releases were observed at 16:28:38 (coordinator Strong1555 recovery),
16:40:09 (rectangular1610), and 16:49:43 (RFsource1620). The held Stronghold
operation was untouched. Independent cleanup verified 272 PIDs absent, 111 ports
refused, 23 profiles absent and four locks free before runtime ownership.

- Full build: `flock /tmp/wine-build.lock bash tools/build.sh`, PASS, 33.462 s.
  Build input: `95131b6cf196cef66b81fbf873a894351f2fc83f`.
- Generated NE regression: standard and compat, both detach and retained-map
  cases PASS, including Catch/Throw and all architectural/ownership assertions.
- `test/test-win16-far-fault.js`: standard and compat PASS (invalid/null/module
  owners, wrapping ES operands, real relocations, collector context lifetime).
- Focused test input: `cecd6e8a62ae386702066ee9168c4f59fa54f629`.
  Relevant source diff from build input is empty. The first harness attempt
  failed because it called a nonexistent `guest_read16` export; replacing it
  with two exported byte reads corrected the harness. Its failure log remains.
  No emulator failure or weakened assertion is hidden by that correction.

| Module | Bytes | SHA-256 |
| --- | ---: | --- |
| `build/wine-assembly.wasm` | 2173299 | `10462bd9693cf4f51d382d33767674b736b84e74346f328306d59e35c5e60031` |
| `build/wine-assembly.compat.wasm` | 2175945 | `eb59d32227cc18233f93c7b757e0700f9558f0a31af7e3d38090669d4fc15158` |

Run commands from the checkout, after acquiring the shared runtime and build
ownership required by messageboard:

```sh
node scratch/runs/20261105-lords2-callback-stack-lifetime/callback-regression.cjs build/wine-assembly.wasm
node scratch/runs/20261105-lords2-callback-stack-lifetime/callback-regression.cjs build/wine-assembly.compat.wasm
WINE_TEST_WASM=build/wine-assembly.wasm node test/test-win16-far-fault.js
WINE_TEST_WASM=build/wine-assembly.compat.wasm node test/test-win16-far-fault.js
```

`regression-standard.json` / `regression-compat.json` retain the actual selector,
stack, register and data observations. `validation.json` retains the build and
first harness failure; `validation-focused.json` retains the passing final
checks. `source-provenance.json`, relevant binary diffs and owned new-file
patches provide recovery without source archives or media copies. Generated NE
inputs are small run-specific fixtures, not guest-program extracts. No original
execution was authorized or performed. No boxes were assigned; box ID/state/
expiry and box lifecycle are N/A. Own runtime processes, watcher, profiles,
ports and locks are cleaned and released on completion.
