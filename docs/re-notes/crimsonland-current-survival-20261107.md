# Crimsonland current Survival: installed DirectX prerequisite blocks allocation

Run `scratch/runs/20261107-crimsonland-current-survival/` stops at the first
concrete dependency blocker on current main, before allocating a browser box.
The unchanged registered `crimsonland` closure supplies neither an authentic
installed DirectX component version resource nor a DxDiag provider. The original
EXE requires DirectX 8.1 before its launcher. This is a current local dependency
check, not a new browser warning capture or reviewed Survival gameplay.

The audited source commit is `d9091912da1b342cca4296621cc9af0b8e9a64cc`.
`source-before.json`, `relevant-source.patch`, `relevant-new-source.patch` and
`new-source-pins.json` preserve source identity and uncommitted changes without
archiving the tree. All 61 registered input paths were hashed, including the
original EXE, seeded DLLs, media and manifest; no input was copied or changed.
EXE SHA-256 remains
`93cdcdc872c836e75122e3a1d41312c74761cf4736181d3541521e82f6cb2031`;
manifest SHA-256 is
`391e32ab82e9a4e55be48f24507bda782539e82065c89a458d232a5e6d7c3b03`.

The fresh disassembly retained in `startup.asm` and `detection.asm` confirms
the original call to detection at `0x42c71d`, the unsigned comparison against
`0x00080100` at `0x42c729`, and warning branch at `0x42c737`. The detector first
tries DxDiag, then examines named installed component resources. No current
manifest row mounts any of its eight component filenames, and neither the
registration nor manifest adds a DxDiag registration.

`audit.cjs` compiles the current canonical source closure and exercises the real
VERSION exports in a disposable API fixture with the production DirectX system
mount helper. All eight exact system-path `GetFileVersionInfoSizeA` calls return
zero: `ddraw.dll`, `d3drg8x.dll`, `dplayx.dll`, `dinput.dll`, `d3d8.dll`,
`mpg2splt.ax`, `dpnet.dll` and `d3d9.dll`. Existing static module placeholders
carry no component version resource. `com-probe.cjs` separately calls the actual
host COM bridge for the detector's CLSID/IID and obtains
`REGDB_E_CLASSNOTREG` (`0x80040154`) with a null output pointer. These are fixture
API calls, not inputs or memory changes to a running original guest.

The retained fixture module is 2,182,456 bytes, SHA-256
`7dcb949af0f4cd99e06453aaa96143db5f3b238ed1d972bafcb75ea2e9876a03`.
The on-disk shipped module separately hashes to
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`;
it was not instantiated by this run. Neither hash is claimed as an observed
production browser module. Current `node test/test-static-dx-version.js`
passes 61 checks, including rejecting fabricated versions and reading genuine
file resources. Source and registered-input hashes remain unchanged afterward.

Because the prerequisite fails before original startup, selected driver action,
ACK, release and production guest/render qualification were not attempted.
No immutable browser deadline or allocation UUID was needed; no box, browser,
original game, pointer lock, menu click, key or button action ran. Actual owning
D3D8 backend identity, movement, aim, firing, enemies and score are unobserved;
the second backend comparison remains pending. Historical October Tutorial and
Survival evidence is not reused as current validation. This adds a named blocked
Crimsonland case, not active D3D coverage or parity evidence.

No emulator mismatch was demonstrated and no emulator code was changed. A locked
build is not required for this documentation-only change. `local-postflight.json`
records source/media preservation, more than 2 GB free on `/home`, no owned live
runtime PIDs, ports, profiles or held input, and no allocation attempt. Boat
ID/state/expiry are all N/A; no lifecycle action or shutdown handoff applies.

Next: resolve the authentic installed-state prerequisite in a separately reviewed
dependency task, including its installation effects and recovery recipe. The
unchanged-manifest constraint prevents applying that installation here. Then
qualify the real driver closure, literal actions, exact ACK and independent
release locally before a fresh bounded browser allocation. Do not fabricate
component versions or reuse the dated gameplay result.
