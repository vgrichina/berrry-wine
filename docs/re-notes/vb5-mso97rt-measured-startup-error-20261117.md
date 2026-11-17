# VB5 MSO97RT resource-name dependency

The retained installed run bound COMCTL32 and reached a VB main window, then
showed "Unexpected error; quitting" after ten MRT70.DLL datafile-load failures.
This task performs no new original invocation, endpoint request, reinstall or
original-file edit. Evidence is in
`scratch/runs/20261117-vb5-mso97rt-measured-startup-error-repair/`.

Read-only disassembly of installed MSO97RT (SHA-256
`8f6f3c85055a56216f2eb64d9efba3f2ac07d752666e6155d83523c25a111588`)
identifies the actual name construction. Original VA `0x306c2490` calls
GetLocaleInfoA with LCType `0x80000003` and a four-character buffer, then copies
return-count minus one characters between `MRT7` and `.DLL`. Import-table
inspection resolves the call through `0x306c13cc` to GetLocaleInfoA. This is
LOCALE_SABBREVLANGNAME with LOCALE_NOUSEROVERRIDE. Microsoft's
[documented en-US value](https://learn.microsoft.com/en-us/windows/win32/intl/locale-sabbrev-constants)
is `ENU`. The runtime's generic fallback returned `0`, creating `MRT70.DLL`.
The installed resource DLL is the unchanged `Mrt7ENU.dll`, SHA-256
`e4b48de0474444fed1e0f5cde92b7915ace556f61a09259cd0919b2d7d66df1c`.

The five qualified-path/stem pairs match one cold resource search: requested
locale, primary-language default, then three fallback locales. The resource
handle remains zero after all failures. `_MsoFInitOffice@20`, original entry
`0x306c1e11`, checks this through `0x306c2434`. Its failed guard branches from
`0x306c1e5d` to `0x306de810`, calls SetLastError(0xE0040001), releases its
critical section and returns zero. The retained module loaded at `0x00d7b000`;
subtract its observed base and add preferred base `0x306c0000` to translate
trace return addresses into these original VAs.

VB calls that export through `0x57cbac` at `0x4f852c`. Startup tests the returned
BOOL at `0x45bf4a`; failure selects error `0xC351` at `0x45c23f`. This establishes
a startup-failure dependency on loading the resource DLL. The observed message
also exists verbatim in VB5IDECC's string resource `0x59d9`. The complete
error-code-to-string route has not been executed or fully established here;
the message is generic and does not by itself identify a unique failure.

The repair implements SABBREVLANGNAME in the existing en-US GetLocaleInfoA/W
surface, using the shared writer for character counts, flag checks and buffer
validation. It does not change DLL resolution policy or install replacement
DLLs. The authored x86 regression uses the original request/concatenation
sequence and the installed resource DLL as data only. On the unchanged module,
both main and actual CPU Worker construct MRT70.DLL and fail to load it. On the
repaired module both construct MRT7ENU.DLL, obtain a nonzero handle, locate
resource type 217/name 1, verify its 304-byte size and initial bytes, then free
the module. No original entry point executes. A separate explicit MRT70 lookup
still fails. ANSI/Wide size queries, short-buffer canaries and invalid numeric
flags are covered, with the existing date/calendar/time-zone regressions.

The public API trace prints the immediate raw EAX before an asynchronous
LoadLibraryExA operation finishes. Its zero line on the successful fixture is
not the final caller-visible result: the authored x86 checks that final result
and uses the returned handle for FindResource/LoadResource/LockResource.

The fixture runs use sealed Git sources plus the explicit owned patch, retain
the tested module before execution, and verify identical inputs in main,
CPU Worker and OS child. Independent deadline watchdogs are armed before the
native runs; native, outer and watchdog waits/EOF receipts are retained. These
fixtures terminate through guest ExitProcess/ExitThread, unlike the prior
original's host cleanup. No screenshot or user input is needed for this
nonvisual resource regression. All 86 original blobs, 258 index records,
836 registry entries and eight provenance hashes remain unchanged.

The repair proves the resource-name/load dependency; usable IDE/AxButton
startup remains unmeasured. The next required measurement, under a new original
allowance, is whether initialization passes the resource guard and what the
first later dependency is. This task does not spend such an allowance or
reopen the permanently UNKNOWN predecessor endpoint.
