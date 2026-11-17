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
NULL/zero-byte binary data writes an empty value; zero-count REG_SZ uses the
Win16 bounded string convention.
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

The final focused suite passes 87 cases. Canonical locked build and
nested/fixed/QT/FT/LS32/SMapLS/Win4 regressions also pass.
Incoming foreign hunks stay byte-exact and excluded from this commit. No foreign
revision hashes are refreshed. A subsequent original is authorized only after
publication and a fresh Git-only complete source/module/helper qualification;
its outcome will be recorded after actual waits and cleanup.


## Original outcome and allocation correction

Initial material commits `799439f0a8e5` and `8945cae0bd24` are published on main.
The single fresh original used complete published Git
`fa5ed3fc81352fb039ef370889c089019f6189af`, production module
`cff5da9a64e3df960918df28ae7e06bd1db7cfae49d189f4281d82ea09e7f274`,
4,595 verified Git source hashes and zero WIP patch bytes. Its actual child and
CPUWorker inheritance passed. Registry73, nested41, fixed/QT/FT/LS32/SMapLS/Win4,
BUTTON7 and fresh hashes of all 257 CD members passed before the fixed clocks.
The production symbol map has byte-identical executable sections.

Genuine SETUPX returned LONG 0 from KERNEL217 twice at return 5880. The retained
backend trace records two real opens of HKLM\Enum. This is new runtime path
evidence; the previous closed pipeline's path remains unknown. Five personally
reviewed finite menu actions completed in 169–240 ms, with independent physical
UP acknowledgements: Install, accept default directory, create it, acknowledge
installation success, and defer the requested Windows restart. The actual guest
wrote Installed=1 and copied NHC.exe, Smackw32.dll, setup95.exe, HD.BLB and
readme.txt into the default installation directory. Their retained output hashes
match unchanged CD members. The screen explicitly reported successful install.

After restart was deferred, the installed launcher still displayed disabled
Play. Its exact cause is not established. No Play DOWN or room was reached.
The final Exit review was older than 30 seconds; the controller refused before
DOWN and permanently latched UNKNOWN. This was an operator freshness error,
not a native Exit failure. No later HTTP, recapture, rebind, replay or second
original occurred. Host cancellation then produced actual native wait0 and
watchdog wait0 with both EOFs and a runtime-closed record. This is not nativeQuit.
The tool's outer wait was 143; the internal outer wait receipt is absent and
its cause is unknown. The holder's tool wait was also 143 without a normal-close
receipt; all relevant processes are absent. Neither missing receipt is promoted
to a successful wait. The production module was retrieved and hash-verified
before the holder disappeared. No boxes were created.

Post-run review found KERNEL216 returned INVALID_PARAMETER for SETUPX's valid
GlobalAlloc output (selector 022f, offset 012d, capacity 251; allocation 1024).
Allocator descriptors use GLOBAL/POOLED flags rather than NE's data bit, so the
first validator misclassified them as code. The final correction accepts only
canonical live allocation heads, checks allocator identity and arena bounds,
and limits access to the smaller of descriptor extent and real allocation.
Freed/malformed allocator descriptors remain invalid, including for input
strings. Pooled selectors use the same ownership checks.

Fourteen added native cases execute real GlobalAlloc/GlobalFree and registry
far calls in ordinary and pooled blocks, covering valid open/enumeration output,
allocation-bound overflow, freed output, and unterminated input at the actual
allocation end. The authored enumeration uses the observed 012d/251 layout.
The final correction is qualified and published separately. Its effect on the
original's Play/restart outcome is unmeasured: the one original remains closed
and is not rerun. A successor needs new original authorization and must preserve
this distinction. Long-running outer waiters also need an independent lifetime;
the missing outer/holder receipts in this attempt remain UNKNOWN.
