# Win16 registry adaptation for genuine SETUPX

Evidence: `scratch/runs/20261117-neverhood-win16-registry-install/`.

The preceding original stopped at KERNEL217, called by unchanged SETUPX code
segment 2 at 587b, returning to 5880. Its registry path was not captured and
remains unknown. That pipeline is terminal UNKNOWN and was never queried again.

SETUPX imports KERNEL216–227. Wine's primary implementation and export spec
establish their DWORD HKEY, Pascal DWORD/far-pointer arguments, callee stack
cleanup and LONG return in DX:AX. SETUPX export47 at 5844 independently confirms
the three DWORD arguments and 12-byte pop for RegOpenKey. Its instructions push
key, name segment/offset, output segment/offset, and call the relocated KERNEL217
thunk at 587b. References:

- https://github.com/wine-mirror/wine/blob/master/dlls/krnl386.exe16/registry.c
- https://github.com/wine-mirror/wine/blob/master/dlls/krnl386.exe16/krnl386.exe16.spec

The adapter implements those twelve registry exports against the existing
shared Win32 registry backend. It corrects old DWORD argument indexing for
RegSetValue, preserves missing-key errors and unmodified failed-open outputs,
and supports ANSI/default values, DWORDs, binary data, sizing and MORE_DATA.
Historical Win16 roots 0/1 map to HKCR. Handles are actual backend handles;
FlushKey validates the handle. Registry changes occur only through real calls.

Every far pointer is checked before a backend call, including output buffers
on missing-key paths. Checks cover canonical selectors, descriptor extent,
readability/writability, overflow, bounded NUL scans and affine memory spans.
The only external descriptor accepted is an exact active ancestor QT stack
lease. Its frame/request/actor/process/connection generations, native return,
retirement, cancellation and mapping ownership use existing bridge validators.
An invalid pointer returns INVALID_PARAMETER; an invalid execution owner/stack
traps before reading parameters. No arbitrary API gate is enabled.

The authored native suite executes x86 far calls for every ordinal and checks
callee stack cleanup, preserved GPRs and segment registers inside the guest,
then exact outer restoration. It covers shared keys/data, missing and closed
handles, sizing, ANSI and binary bytes, invalid/read-only/code/wrapping outputs,
and invalid query/set buffers before backend calls. A real Win32 x86 caller
resolves ADVAPI32, reads the Win16 DWORD and writes another value which a native
Win16 caller reads. A standalone NE executable exercises index-1 code selectors.

Both packed QT alignments exercise actual leased-stack pointers. Wrong actor,
stale request/process generation, mutated lease/descriptor, retirement and
cancellation reject calls and restore the outer stack. Four actual CPUWorker
cases exercise valid leased output and rejected code output, with joined
shutdown and retired loader ownership. Finally, unchanged genuine SETUPX
export47 executes its real KERNEL217 call for existing and missing authored test
keys; its captured return is 5880 and its genuine LONG results are 0 and 2.
These authored paths do not establish the original installer's registry path.

The prepublication focused suite passes 69 cases. Canonical locked build and
nested/fixed/QT/FT/LS32/SMapLS/Win4 regressions also pass.
Incoming foreign hunks stay byte-exact and excluded from this commit. No foreign
revision hashes are refreshed. A subsequent original is authorized only after
publication and a fresh Git-only complete source/module/helper qualification;
its outcome will be recorded after actual waits and cleanup.
