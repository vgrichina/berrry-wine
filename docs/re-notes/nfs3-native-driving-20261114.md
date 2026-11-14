# NFS3 native driving attempt, 2026-11-14

Fresh original setup is blocked before its renderer chooser or game UI by
COMCTL32's native thunk connection. No fresh cockpit, Controls/transmission,
Pause, Continue, held driving, speed or scene consequence was observed.
Historical cockpit 0 MPH is not driving evidence.

Evidence: `scratch/runs/20261114-nfs3-native-driving/`. Runtime source HEAD was
`9afbc3e6df17030388d49fad017fdea047f8870e`, with relevant foreign WIP captured
in `relevant-source.patch` and new/helper files in
`owned-and-relevant-new.patch`. Loaded module path was
`build/wine-assembly.wasm`, SHA-256
`c7f5bada4da4b4ed95b235add0aa1c9843176805d29d5b1ee79359752a19d348`.
All 135 original media pins matched before launch and again at finalization.
No source archives, repeated media or binary module dumps were made.

## Actual original result

Reconstructed preparation helpers from retained patches, then used registered
`nfs3_device_data` followed by `nfs3_device_setup`, carrying only each fresh
native registry export into the next process. The catalogue exited 0 and
exported 118 entries. Setup loaded original COMCTL32 at `0x551000`, DllMain
`0x56b1cd`, then trapped at `0x57d5d2`, yield 18, halt 3:
`Missing NE image COMMCTRL`. Its captured contract is LS01/LB01, checksum
`0x1e9a`, `commctrl.dll!Cctl1632_ThunkData16`, QT offset 36, FT offset 68.
`setup/stdout.log` and `setup/stderr.log` retain the actual failure and stack.
The control endpoint never opened; the read-only capture request was refused
and produced no PNG. No input attempt, binding, DOWN, pointer action or replay
occurred. No fresh chooser selection/export or game launch was attempted.

This is the same original connection prerequisite described in
[the COMCTL32 investigation](neverhood-comctl-thunk-observation-20261114.md).
Current foreign `lib/ne-guest-bridge.js` first resolves the missing companion,
then explicitly refuses LS relay publication until a native connection owner
and FT prolog exist. Recovering a DLL alone cannot complete this route.
A quarantined candidate companion belongs to another worker and was untouched.
No production repair was attempted: finishing the shared native connection
implementation exceeds a bounded NFS input/render repair and would overwrite
foreign WIP. No guard, native chooser, guest state, clock or configuration was
weakened or injected. The old chooser export was hashed only, never imported.

## Verification and lifecycle

The actual guarded CLI consumption regression and real shared-WASM UI-owner
regression pass. They were rerun under the heavy lock with logs and actual
exit/EOF receipts in `focused-tests.json`; an initial invocation lacked that
lock and is not the serialized verification receipt. The reconstructed pure
controller validations also pass (eight control requirements, thirteen invalid
pointer reviews). These fixtures establish no gameplay result.
No production code changed and no new full build was run; this is a docs-only
commit. Runtime helper patches preserve the exact tested source.

Both original phases held `/tmp/wine-heavy-runtime.lock`, checked the current
source/module/media pins and actual child census, and armed an observable
independent finite deadline/disk watchdog before launch. The setup diagnostic
logs were buffered by the helper until process exit. After bounded endpoint
failure, SIGTERM requested orderly shutdown but did not exit within eight
seconds; owned SIGKILL yielded actual return -9 with both EOFs. Catalogue
returned 0 with both EOFs. Both watchdogs returned 0 with both EOFs, all four
PIDs are absent, and the heavy lock is released. No deadline was extended.
Box ID NONE, state NOT_CREATED, expiry null, stop receipt N/A.

Next: complete and qualify the native COMCTL32/COMMCTRL connection prerequisite,
then repeat fresh native catalogue/setup/Direct3D selection and unchanged export
before Controls/transmission review, two settled Pause frames, ordinary Continue
and independently released held driving. This task stops at the concrete
original setup blocker; no screenshot or gameplay acceptance is claimed.
