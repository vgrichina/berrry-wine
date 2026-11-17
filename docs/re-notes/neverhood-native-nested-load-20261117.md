# Invocation-owned QT nested Win16 image loading

Evidence: `scratch/runs/20261117-neverhood-native-nested-image-load/`.

The previous original's KERNEL.95 argument was **reconstructed**, rather than
captured as a runtime string: its retained `0257:00d6` argument and `0885131b`
return match genuine DSETUP6E code2:1310, its relocation at 1317, and data5:d6
containing `setupx.dll`. Published caa970b11 repaired fixed-library QT stack
validation but could not acquire this image-backed library.

The new direction uses a native yield19 request in the running NE invocation,
with a unique serial and full frame token. It never overwrites the suspended
PE request. Each settlement revalidates process/actor ownership, the QT ancestor,
its live native connection and pins, its exact stack alias/mapping lease,
selectors, EIP/ESP and the native far return. FT and unrelated callback callers
retain their existing gates. Fixed-library acquisition cannot be bypassed by
falling through to source loading.

The host first retains an already loaded native image by canonical identity.
Only an absent image triggers normal source discovery and closure preparation;
new sources must contain their matching ordinal-zero resident module identity.
The existing native lifecycle performs LibMain, required Win4 usage
notifications, pinning, export ownership, reference accounting and final WEP.
LoadLibrary returns the real registered handle, or documented error2 for a
missing source. FreeLibrary releases the real reference and preserves AX.
Failed acquisition or rejected settlement unwinds acquired references, including
cancellation after publication. Native frame teardown restores the outer caller
and its QT alias on success and faults.

Actual CPUWorker QT calls can await source discovery while retaining the exact
callback command owner. They recheck ownership after every await and reject late
bytes after retirement. Initializers are never replayed to discover sources.
Synchronous initializer reentry can load a new source under the QT ancestor;
async-only source discovery for an additional dynamic load from a running
initializer remains unsupported and fails explicitly. This change does not
silently authorize arbitrary FT or callback loading.

The authored suite executes real far KERNEL.95/96 instructions at both packed
stack alignments. It covers new sources, already-loaded references without a
resolver lookup, initializer reentry, missing/wrong sources, initializer and
Win4 notification faults, cancellation before and after publication, stale
frame/request/process generations, foreign actors, lease/selector mutations,
and retired owners. Actual CPUWorker cases cover source awaits, failures and
retirement while bytes are pending. All accepted cases balance native module
references, unwind connection pins and restore the caller. Diagnostic mutation
helpers are test-only exports appended to the diagnostic module.

Genuine SETUPX runs its actual initializer and WEP from a new source beneath an
authored QT caller. A second authored PE caller enters unchanged genuine
DSETUP6E's registered LS/QT target and executes its actual KERNEL.95 call.
Here the copied runtime name is captured as `setupx.dll`, settlement returns a
real already-loaded SETUPX handle, and the far return is 131b. The fixture stops
after native settlement and before device installation; this proves the nested
caller, not installation or an original application run.

Publication requires the focused native regressions and canonical locked build.
The one newly authorized original must then use current published Git-only
sources/module and unchanged complete media/defaults/real clocks. Its result is
recorded below only after actual waits and terminal cleanup.

The final prepublication proof passes 41 nested cases (32 local authored,
seven actual CPUWorker, two genuine DLL cases), fixed-module alias/mutation
controls, QT, full FT, LS32, SMapLS and compiled Win4 notification/lifetime
regressions. Each final proof subprocess has an actual exit-zero wait and both
streams drained. The shared canonical `flock /tmp/wine-build.lock bash
tools/build.sh` passes. A shorter earlier canonical wrapper timed out while
compiling; its receipt is retained and is not counted as a passing build.
Incoming foreign NE/lifecycle changes are preserved byte-exact and excluded
from the material commit. Source evidence is Git plus the owned patch and
manifest pins; no source archive or media copy is made.
