# VS2012 gears: process-scoped pointer encoding

The previous `_initterm_e` repair advanced the unchanged genuine VS2012 x86
release 1.0 gears executable (16384 bytes, SHA256
`ef3de2e8bc52f1285fc603f374ac1f39781211590f2f38c1eb2c870418812240`)
to `KERNEL32!EncodePointer(FFFFFFFF)`, EIP 402928, return 402931.
The reporter's executable SHA remains unknown.

Microsoft's [EncodePointer contract](https://learn.microsoft.com/en-us/previous-versions/bb432254(v=vs.85))
requires a process-specific secret; [DecodePointer](https://learn.microsoft.com/en-us/previous-versions/bb432242(v=vs.85))
reverses the encoding. The repair appends both stdcall APIs and implements
`rotr32(pointer XOR secret, secret & 31)` and its inverse. All DWORD bit
patterns are opaque inputs, including NULL, high bits and FFFFFFFF. Neither
API dereferences or translates the pointer. Only EAX and stdcall ESP change;
last error and other GPRs are preserved.

A dedicated allocator-declared four-byte region holds the immutable secret.
Fresh process memory starts at zero; first use samples nonzero CSPRNG entropy
and atomically publishes the winning candidate. Competing instances use the
winner. Subsequent calls do not sample entropy. Guest threads share process
memory, and host teardown discards it; a new process receives fresh memory.
This uses the existing process-memory lifetime rather than a PID-derived key
or a per-Worker JS variable. No frozen structure was extended or native base
address copied. NFS's concurrent host-import owner supplied the small
`entropy_u32` host export using Web Crypto (Node's Web Crypto fallback), with
no weak entropy fallback. Its commit is a required predecessor.

This is an opaque reversible implementation of the public API contract.
It makes no Windows bit-exact or security-equivalence claim.

Evidence is retained in
`scratch/runs/20261118-gears-encode-pointer-crt-startup/`.
The authored PE exercises actual imports, both inverse directions for nine
DWORDs, repeated-call stability, encoded NULL, all GPRs, ESP, last error and a
real cdecl `_initterm_e` constructor that calls an encoded/decoded function.
Its threaded variant creates and joins two guest threads, checking the main
thread's FFFFFFFF encoding from each. Native instances also test fresh
process/lifetime separation, shared-thread values, zero-entropy retry and a
reentrant competing first-use publication. The old retained module traps on
EncodePointer; the repair passes native and compatibility execution. The
threaded PE passes native OS threads and normal browser Worker upload with
ExitProcess(0). Existing `_initterm_e`, void initializer and CRT exit ownership
regressions pass.

One preliminary old-module browser control correctly refused to start because
its region mirror came from the new layout. The paired old control serves the
old mirror from recorded Git, verifies the old module hash, and reaches the
actual EncodePointer trap. The first CLI threaded command used a positional
path, so the runner selected Notepad; it is explicitly excluded. The corrected
`--exe=` command loads entry 402000, starts both authored threads and exits 0.

The pointer repair was published as b2566682bf9b60d09111fccaf89eca42c94fc88b,
after the required host entropy export cf7044e37c472fe8fe3c7b7d1eab969420a2d7d8.
Both strict pull/push operations succeeded. The locked full build passed.
The exact final pointer module was SHA256
`4f64a76f005654733d461714036bc1717edb582ed74a5f057cf8743ac5a3bd74`.
A browser lifetime control uploaded the authored threaded PE in two fresh pages:
both exited 0, both had real Workers, and both used PID 1000 but different
encoded NULL values. This complements same-process cross-thread stability.

## Confirmed next startup requirement

The unchanged EXE on that published module advanced to
`MSVCR110!_controlfp_s(NULL, 10000, 30000)`, EIP 4030e6, return 402ee4.
The repair shares the existing live per-thread x87 control-word update with
`_controlfp`, accepts an optional output pointer, returns zero on valid calls,
and preserves cdecl stack cleanup, other registers and errno. Unsupported
selected bits take the existing default fatal CRT invalid-parameter path
(STATUS_INVALID_CRUNTIME_PARAMETER, C0000417); they do not silently succeed.
Custom invalid-parameter-handler registration remains unimplemented and
fail-fast, so this does not claim custom-handler recovery support.

The [secure control-word contract](https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/controlfp-s?view=msvc-170)
and [invalid-parameter policy](https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/invalid-parameter-functions?view=msvc-170)
were checked. Guest tests exercise the exact NULL call, output queries,
precision and rounding control, exception masks, ignored denormal controls,
and actual FISTP rounding results. The CPU advertises no SSE2, so DN control
is a documented no-op here. Existing floating arithmetic still uses f64 and
does not reproduce selectable x87 arithmetic precision; that pre-existing
limitation is not a claim of this wrapper repair.

The old pointer module traps on the authored secure-wrapper import. Native,
compatibility and ordinary browser Worker controls pass with the repair;
the invalid-bit browser control terminates with C0000417. Existing
`_controlfp`, pointer encoding, `_initterm_e`, void initialization and exit
regressions pass. The locked full build passed. The repair was published as
fdd36c88e6702f5947dd24a4c929c68723cfc9a9 with immediate strict pull/push (0/0).
Its exact tested module is SHA256
`12520027984b3003006746db7971302b06b3ad999e946c38d428d024f060ee63`.

## Affected executable result

A fresh ordinary upload after publication used the unchanged 16384-byte EXE,
the default slice 100000 and the normal guest Worker. Every WAT source matched
the tested build manifest before launch; actual browser source/module response
hashes are retained. The module was the exact 12520027 build, without a module
route override. It passes the repaired startup calls and now traps at
`MSVCR110!__crtSetUnhandledExceptionFilter(00402b57)`, EIP 004030c8,
return 00402ba2. No window or gears were visible in the personally reviewed
`affected-after-controlfp/startup.png`. No input was sent; affected-program
ordinary exit and moving gears are not proved by authored fixture exits.

This is the concrete remaining blocker. The existing Win32 setter stores a
filter in a Wasm-instance global rather than process memory, and the existing
`UnhandledExceptionFilter` explicitly does not invoke the installed guest
filter. A CRT alias alone would not provide coherent process-wide filter
registration and delivery. That requires a separate exception-lifecycle repair
with real callback coverage, beyond this pointer/FP startup repair; no success
stub was added to bypass it. The [Win32 filter contract](https://learn.microsoft.com/en-us/windows/win32/api/errhandlingapi/nf-errhandlingapi-setunhandledexceptionfilter)
requires process-wide registration and subsequent invocation.

Both affected scopes and every authored browser scope closed with actual native
and watchdog waits, stdout/stderr EOF, no leaked group and at least 180 seconds
of reserved ordinary-Quit time. No box was created (ID/expiry/stop receipt null).
All evidence, unique modules, source manifests, binary diffs, new-file patches,
selected named PNGs and recovery recipes are indexed by the run's result.json.
Git is the source archive; the input media remains at its original evidence
location with the release URL and hash recorded for recovery.
