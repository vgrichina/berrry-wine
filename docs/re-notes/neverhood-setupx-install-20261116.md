# Genuine Neverhood SETUPX qualification, November 16

The unchanged SETUPX from existing Windows 98 SE media now completes native
LibEntry and WEP. Two demonstrated loader defects were repaired: a Windows
4.0 NE version does not require the optional resident DllEntryPoint export,
and KRNL386.EXE resolves to its actual internal NE module identity, KERNEL.
Neither repair adds API success, changes guest code, or forces a DLL override.

Evidence: `scratch/runs/20261116-neverhood-genuine-setupx-install-progress/`.
The existing Windows ISO retains SHA-256
`2adfb46df8a9c7bbd2f67bff07461cc2f9d9ec8e01f0e112cb044c9e3e62f607`.
Its `WIN98/PRECOPY2.CAB` is 1,335,443 bytes, SHA-256
`a52d6e1fad1b85aef3e0eba4ed1d35a8b982cc572fdcb358fba09b2ce282af81`.
`cabextract -s -p -F setupx.dll CAB` recovers unchanged 745,168-byte SETUPX,
SHA-256 `6cd5c194743fdf676112c0808b724a78f8f8650a54059d046a15fe270f5f55f4`.
Single-cabinet extraction warns about adjacent cabinets; it exits zero, and
the recovered complete member has the recorded size and hash.

SETUPX declares version 0x0400, header initializer 1:0044, a real WEP, and
no resident DllEntryPoint. Its complete static import-module closure is
KERNEL, USER, GDI and KEYBOARD. The actual original DSETUP6E imports twelve
SETUPX ordinals: 2, 4, 101, 110, 200–203, 211, 213, 305 and 319. All exist
in this genuine image. Admission is distinct from executing those functions.

The first corrected native attempt entered the genuine initializer and
trapped at KERNEL ordinal 95. A passive fault capture established the actual
LoadLibrary string `KRNL386.EXE`, passed as selector 303, offset 4042. It
did not settle that call. One diagnostic attempt used a nonexistent
guest_read16 export; its failure is retained, followed by corrected byte reads.

The same ISO's `WIN98/WIN98_45.CAB` (1,802,240 bytes, SHA-256
`0161d7b52be41b6ae0bc2adccad9f0b2cc8bd43f954250d8a283985ad3582382`)
contains 127,040-byte KRNL386.EXE, SHA-256
`fd48ebe1cc8c6558ab26c1c0e7b5492aa8f3a0dc54a2da801ec82ef093a662e7`.
Its genuine resident module name is KERNEL and its import table is empty.
The exact basename alias therefore uses the existing KERNEL identity and
ordinary reference handling. A near name remains unsupported; no new function
exports or fallback success were introduced. This is identity qualification,
not execution of the original operating-system kernel.

The focused native alias regression obtains the same handle (257) through
both names, counts all six actual acquisition/dependency references, frees
them through ordinary FreeLibrary/unload, restores usage to zero and restores
the caller. KRNL387.EXE still traps. The genuine SETUPX then attaches and
retires normally, with its original LibEntry and WEP executing and no caller
register/segment/stack drift. Clean Git plus owned changes compiled to module
SHA-256 `b84dabfcf0d904bbd25940cd6249c6d0ff0fb2b8128bb2ca348f2f12498a8481`.
No source or Wasm archive is stored in the run.

The optional-notification regression executes actual generated x86 LibMain
and final WEP only, including repeat load/release. Existing notification,
rollback, local/cooperative/Worker, common-controls native thunk attachment,
NE lifecycle, guest lifecycle, image extent/bounds and invocation regressions
pass. Canonical locked full builds pass. Foreign WIP is preserved and excluded
from publication and the Git-backed qualification module.

Wine's [NE notification implementation](https://github.com/wine-mirror/wine/blob/master/dlls/krnl386.exe16/ne_segment.c)
independently returns without notification when GetProcAddress16 cannot find
DllEntryPoint; the version word alone does not mandate it. The stricter checks
for present malformed or nonexecutable exports remain.

The single original setup route is conditional on publication of this repair.
It must use the complete pinned Neverhood ISO/SETUP95, genuine SETUPX and the
previously qualified COMMCTRL, real clocks/defaults, an immutable module
prepared before the runtime begins, 1800 native seconds, an independently
prearmed 1820-second watchdog and a fixed 180-second Quit reserve. The current
reviewed-context input contract is reused read-only. The exact unsuffixed
DirectXSetup guard still stops before its unsupported handler executes.
The extended qualification also loads the unchanged original DSETUP6E with
SETUPX supplied as its real dependency. Both attach and retire successfully;
the actual LibEntry, notification and WEP calls restore the caller. This is
NE dependency initialization, not a Win32 DSETUPE ThunkConnect32 replay or a
DirectXSetup call. `native-transitive/qualification.json` retains the result.

The original route was not launched. Before admission, the concurrent native
reviewed-context worker demonstrated that `controlSnapshot.windows`, populated
from `renderer.windows`, omits actual USER child buttons. Its generated native
MessageBox has a live focused BUTTON while the listed windows contain only
the main window and modal container. Binding the actual button is unavailable;
targeting the container would discard the button's own semantic identity. The
coordinator assigned the released core census repair to the VB reviewed-context
worker at 12:40 UTC. This task leaves those owned core files untouched.

The next prerequisite is a published and qualified native child census with
capture-time and consume-time button identity and label checks. The conditional
original route remains unused; installed Play, first-room gameplay and native
Quit remain unproved. No host cleanup of an original was needed and no box was
created. The unused original supervisor/controller wrappers were removed:
they read mutable borrowed helpers and had not qualified immutable launch
inheritance. They must not be mistaken for an admitted original runtime.
Two final canonical build attempts failed on active foreign changes (first
native control-reader attribution, then renderer producer lifetime hashes).
The core repair itself was already published after two successful locked full
builds. Both owners repaired their gates; a third final locked full build then
passed before publishing the extended qualification and wrapper removal.
The run's result.json records this concrete next blocker and the published
dependency repair separately.
