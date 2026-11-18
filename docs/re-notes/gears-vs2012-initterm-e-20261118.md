# VS2012 glxgears: reproduced issue 30 CRT startup trap

Published repair: `d10a60148`.
Evidence: `scratch/runs/20261118-gears-vs2012-initterm-e-repro/`.

The genuine K4sum1/windows-glxgears-built release 1.0 x86 executable
(16384 bytes, SHA256
`ef3de2e8bc52f1285fc603f374ac1f39781211590f2f38c1eb2c870418812240`)
reproduced the reported normal-browser Worker trap at **402ef8**, including
every register in the issue's final trap line. Its unmodified instruction at
that address is `jmp [404078]`, importing MSVCR110!`_initterm_e`. The actual
diagnostic explicitly reports `UNIMPLEMENTED API: _initterm_e`. This identifies
an API implementation gap rather than a slice100000 scheduling diagnosis.
The reporter's exact executable identity remains unconfirmed.

The fix appends API 4710 and implements a distinct error-returning initializer
walk through the existing invocation-owned CRT callback machinery. It skips
NULL entries in the half-open range, returns zero for empty/successful ranges,
and stops at the first nonzero initializer EAX, returning that exact DWORD.
Each nested invocation owns its cursor/result; parent/root/child identity,
mode, capacity and expected return ESP checks remain in force. The caller
retains its cdecl arguments. The new continuation is CACA0042. Only exit and
cexit drain the exit registry and close streams; void `_initterm` continues
ignoring callback return values. Both dispatch and name-hash tables were
regenerated, and the handler ESP checker recognizes the same delegated cdecl
cleanup. There is no guest patch, silent success stub or runtime bypass.

The contract reference is Microsoft's
[`_initterm`, `_initterm_e`](https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/initterm-initterm-e).
The authored real PE checks empty and all-NULL ranges, ordered successful
callbacks, high-bit nonzero error propagation, no calls after failure,
nested success/failure isolation, callee-saved registers, cdecl ESP, void
`_initterm` continuing after nonzero EAX, and an exit callback reentering the
initializer walker. The exact final control fails with the retained old module
and passes with the new module in native compiled execution and a normal
browser Worker upload. Tail-call and compatibility compiled tests pass.
Existing `test-crt-init-exit-ownership.js` nesting, registry, stale/mode/ESP,
capacity and cross-instance checks also pass. The locked full build passed.

The first authored fixture overlapped main and callback code. It was corrected
before accepting its semantic result; failed native receipts and the original
control bytes remain. A directory named `control-v2-old-browser` actually used
the new module because the initial driver did not yet implement the requested
old-module pin. Its module hash and ExitProcess(0) identify it as the **new**
control. `control-v2-old-browser-pinned` implements and verifies the old pin,
and traps on `_initterm_e`. Folder names do not override measured identities.

One fresh affected upload after publication got past `_initterm_e`, then
trapped explicitly on **KERNEL32!EncodePointer**, EIP **402928**, return address
402931, argument FFFFFFFF. The unchanged caller's `call [404028]` is at 40292b;
the emulator reports the preceding instruction as EIP. This is the concrete
next startup blocker. No gears window was created. Visible moving gears,
render-counter movement and ordinary affected-program exit were **not reached**;
they must not be inferred from the authored control's exit. The browser scope
was closed after the identified trap, with no replay or later endpoint request.
Issue 30 is not declared fixed.

Both affected runs used Chromium 151.0.7922.108, headless SwiftShader, actual
main guest Worker, cross-origin isolation, the normal file input/import launch
dialog, and default slice100000. File input used Puppeteer's uploadFile against
the page's existing multiple file input; no registered-app overrides were used.
Before served WASM SHA256:
`514478fe584a69e23792575ab94ea497e859b9034d978e5d2ed943d0e8f49c98`.
After served WASM SHA256:
`ff2321ccb5d068aadd279f03cafb7b245a1d863e29ad8f898356e638bc7a3c41`.
Actual served responses, modules, Git identities, relevant binary patches,
source hashes, EXE/import identities and selected reviewed screenshots are
retained. The baseline module predates this worker's source checkout; its
original build provenance is referenced separately rather than attributing
the current checkout to those old bytes.

All five owned browser scopes finished with actual native-supervisor and
independent-watchdog waits covering stdout and stderr EOF, and no leaks.
Runtime/watchdog deadlines were 900/920 seconds, cleanup at 1080, with more
than the required 180-second ordinary-Quit reserve remaining when every scope
finished. No guest input beyond launch was sent. Box ID, expiry and stop
receipt are null; state NOT_CREATED. No Wine, Python, agents, Codex workers, boxes,
deployment or external posts were used. Foreign runtime and census WIP was
preserved; the own-path runtime commit was immediately strictly pulled/pushed.
