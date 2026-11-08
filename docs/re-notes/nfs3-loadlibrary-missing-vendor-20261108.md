# NFS3: missing vendor DLL failure and native suffix retry

The general loader repair lets the original `d3dtest.dll` retry `d3da` and
resolve the authentic renderer exports. Native setup then hits a separate
null virtual call while creating its chooser. Direct3D selection, chosen-game
state transfer and race control remain unqualified. No runtime box was allocated:
box ID, expiry and stop receipt are null, state **NOT ALLOCATED**.

Evidence: `scratch/runs/20261108-nfs3-loadlibrary-missing-vendor/`.
Source recovery uses the recorded Git SHA and relevant binary diff; media is
referenced by existing path and SHA-256. No source/media archive was created.

## Loader contract and regression

[Microsoft's LoadLibraryA documentation](https://learn.microsoft.com/en-us/windows/win32/api/libloaderapi/nf-libloaderapi-loadlibrarya)
specifies NULL on failure and GetLastError for the extended error. Its naming
rules append `.dll` to an extensionless name; a trailing period suppresses that
suffix. [System error codes](https://learn.microsoft.com/en-us/windows/win32/debug/system-error-codes--0-499-)
define 126 as `ERROR_MOD_NOT_FOUND`.

Previously, after native-file lookup failed, an arbitrary bare `.dll` name
returned the EXE base. It now returns zero/error 126 unless a recognized system
module implements the request. Existing normalization, native mapping yields,
cached retains, locks, reference lifetimes, dependencies and real built-in
identities retain their existing paths. `d3d9.dll` remains an implemented module
with its own identity. The optional absent `uxtheme.dll` case now also sets 126.
There is no `d3d` alias, guest patch or renderer injection.

The actual-handler policy fixture fails against the original source with
`d3d: actual 4194304, expected 0`. The repaired fixture checks unrelated missing
vendor names, case/path/stem/trailing-period normalization, error 126, no
synthetic reference mutation, successful built-in LastError preservation and
available qualified vendor native loading. The system-path neighbor also checks
A/W/Ex entry points. Its previously empty harness now explicitly mounts the
system files whose qualified availability the existing execution policy requires.

Focused missing-dependency, built-in policy, system-path, synchronous-send,
startup rollback, import-graph and real PE lifecycle regressions pass. The last
includes both main/cooperative and real Worker thread cases, nested lookup,
unload, failed attach, cached sibling handles and join notifications. The
locked full build passes. The callback census records a narrow lifetime review;
broader retained-context ownership remains pending.

## Production native setup and next failure

The clean local Chromium run executes the published native catalogue installer,
first setup and second setup after reload using the existing registrations and
133-file fixture. All 133 media files (22,070,305 bytes), plus the manifest,
were freshly hash-verified. Native catalogue writes and the utility's own first
`Software Renderer / softtri` choice transfer through ordinary shared storage.
The chosen-game registration remains free of startup renderer writes, and the
standing Glide defaults are unchanged.

The first exploratory run crossed the build's publication time and fetched both
old and repaired modules; it is not the clean qualification. `bootstrap-clean`
fetches only the repaired 2,182,404-byte production module, SHA-256
`f5cfb1c6dea588eb538831d42069c699f6b7a6306cb530b8eb0abb437af754a7`.
The real guest main Worker and secondary Worker are recorded in its logs/state.
Served JS/HTML response hashes and the fetched module bytes are retained.

Second setup now records:

```text
LoadLibraryA("d3dtest.dll") -> module 0x0086f000
GetProcAddress(0x0086f000, "D3DTEST_GetCards")
LoadLibraryA("d3d")
LoadLibraryA("d3da")
GetProcAddress(0x008ae000, "_THRASH_about@0")
... authentic _THRASH_* exports on the same native module ...
```

Original `d3dtest.dll` at runtime `0x008703db` tests the first LoadLibrary result;
only zero executes its own `%sa` formatting and second call at `0x008703fc`.
This is the original suffix retry, not a host replacement. `D3DTEST_IsHAL`
repeats the same route. Entry traces and module-handle arguments prove native
retry/export resolution; a yielding LoadLibrary entry alone is not a final
return-value observation.

The chooser window appears but remains blank. Secondary thread 1 exits at EIP
zero with `prev_eip=0x41f430`, `prev2_eip=0x41f41a`, `ESP=0x7effff38`,
`EBP=0x7effff94`, `EDI=0`, `ECX=0`, `ESI=0x85`. Retained guest stack words start
with `0x41f441, 0x85, 1, 0`. Original executable disassembly at `0x41f430`
pushes lParam, loads the vtable from `[EDI]`, sets ECX from EDI, pushes wParam
and message, then calls `[EAX+0xa0]` at `0x41f43b`. The return address
`0x41f441` matches the stack. Guest memory at zero and the corresponding vtable
slot are zero. These observations identify a null object/virtual dispatch during
`WM_NCPAINT` (0x85); they do not establish why the object lookup is null.

Additional run-specific Worker import observers were exploratory diagnostics,
not accepted return-value instrumentation. The first response override broke
Worker isolation headers and fell back to cooperative execution; subsequent
message routing/collector attempts did not produce usable return records.
Their logs and hook/source hashes are retained separately. Acceptance above
uses the unmodified production Worker in `bootstrap-clean`, the executed native
retry branch and native handle arguments, not those observer attempts. The
unrouted observer browser was explicitly closed and its stuck collector stopped.

Next work is the native chooser's window-object/message dispatch during creation.
No click or game input was sent after this failure. The remote-runtime gate did
not pass, so no watchdog/allocation/stop action was needed. All task browsers and
loopback servers close in `finally`. Physical GPU remains unknown; no actual
D3DIM/context/fallback acceptance, acceleration, steering, road-relative motion,
FPS, parity, three-renderer benchmark, full27 or audio claim is made.
