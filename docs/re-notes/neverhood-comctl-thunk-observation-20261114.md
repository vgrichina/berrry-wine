# Neverhood COMCTL32 thunk prerequisite — 2026-11-14

**The complete COMCTL32 connection remains unresolved.** This task implements
and executes a bounded prerequisite: owned, scoped reading of relocated NE
data exports. The original ISO route was repeated with a production
ThunkConnect32 request and **without the observation guard**. It now stops at
`Missing NE image COMMCTRL`, before original SETUP95 entry or any UI. No
connection, first UI, installation or gameplay success is claimed.

Evidence: `scratch/runs/20261114-neverhood-comctl-thunk/result.json`.

## Actual original contract

The read-only metadata reproduction selected the pinned 577808-byte
`test/binaries/dlls/comctl32.dll`, SHA-256
`28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4`.
Its runtime base is `0x535000`, DllMain `0x54f1cd`, and the connection call
is at EIP `0x5615d2`, ESP `0x74fffcc`, return `0x54f1e6`.
The six arguments are:

1. Data32 `0x59d2ec`;
2. `Cctl1632_ThunkData16` at `0x56161f`;
3. `commctrl.dll` at `0x54f214`;
4. `comctl32.dll` at `0x54f224`;
5. HMODULE `0x535000`;
6. reason `1`, process attach.

The captured bytes begin **LS01**, checksum **0x1e9a**, with **LB01** at +12,
zero target pointer at +8, and relay offsets **0x24 / 0x44** at +28 / +32.
The two 32-byte relay areas contain CC padding. This classifies an LS layout;
the marker does not establish an FT-only layout, nor does the older DSETUPE
checksum describe this module. `actual-call.json` contains the bounded original
header, names, stack and caller bytes. The initial diagnostic throws before
the former stub and writes no guest state.

The public [Wine thunk implementation at the previously pinned revision](https://github.com/wine-mirror/wine/blob/cc5d1d86ee7d60649e6f858106db046c77c8b12c/dlls/krnl386.exe16/thunk.c)
corroborates the LS header fields and matching companion-data requirement.
It is implementation evidence, not proof of Microsoft's complete late-binding
or lifecycle behavior.

## Bounded implementation and its limits

`win16_bridge_module_data_span` validates the exact live frame, its execution
scope, ready module, descriptor ownership, data type and complete range.
`readGuestData` copies bytes while that scope remains held; no raw guest view
escapes. This supplies a previously missing safe way to inspect the relocated
LS16 header/table without treating a data export as executable code.

ThunkConnect32's unconditional TRUE is replaced in the working tree by request
operation 5. It preserves the original six-argument frame, performs bounded
actual-header inspection and uses existing NE source and lifecycle services
to acquire the requested companion. The generic scalar settlement refuses
this operation: a supplied TRUE cannot publish a connection. Unsupported
notifications and layouts remain explicit diagnostics. If a matching companion
is supplied, the current bounded implementation inspects its header and
releases its temporary reference, then reports that relay publication is still
unimplemented. It does **not** install relays or retain a persistent binding.

Required residual work is a native connection owner tied to the PE image
generation, permanent companion reference, validated relocated target table,
required QT/FT relays, and correct notification/detach retirement. Existing
callback gates, target pins and far return/QT machinery are preserved. These
unimplemented pieces are not replaced by TRUE, zero, patched original bytes,
or a forced host COMCTL32.

## Companion source check

The repository-recorded VC6 recipe in `test/binaries/dlls/SOURCES.md` was
reproduced. Wrapper, `vcredist.exe`, and `50comupd.exe` match all three recorded
full SHA-256 values. Its `comc95.dll` matches the selected COMCTL32 exactly.
The complete seven-member `50comupd.exe` listing contains no `commctrl.dll`.
No existing recorded identity recipe for this named companion/export/checksum
was found in the repository search. No guessed OS package was downloaded.
Temporary package files were hash-verified and removed after the compact
recipe/membership receipt was retained.

The original media remains `scratch/media/neverhood-original.iso`,
651438080 bytes, full SHA-256
`94de724bb47eb2aa588ac4eff28ddc6fd10edebcf2be4dd131ef76875ef5ffd3`.
The unguarded run uses the same ISO SETUP95 route, native dependency registry
and isolated overlay argument as the preceding observation. Import
initialization still stops before the ISO mount/controller stages, so no live
D: mount, overlay, launcher frame or ordinary input is claimed.

## Validation and publication

The previous module fails the new executable data test because the primitive
is absent. The rebuilt canonical module passes the native data test and the
actual PE-import request test. Controls cover relocated data, code/foreign
module/thread rejection, bounds, nested scopes, copy exception unwind,
unload/stale handles, retired frames after module-slot reuse, and async request
retirement. Guest HMODULE aliases retain the existing reuse contract; an old
scope cannot authorize reading a replacement image. The contract parser test
uses the observed LS fields and rejects malformed/unmapped layouts. These
fixture results prove the bounded primitives, **not** the original connection.

Full build passed under both `/tmp/wine-heavy-runtime.lock` and
`/tmp/wine-build.lock`. NE image/source/service and four actual full-runtime
lifecycle, nested DllMain, QT return and executable-pin tests pass. The reduced
module transaction test fails to compile on missing `host_beep_thread_begin`;
the same failure reproduces with exact pre-task Git source supplied in memory.
Both failure logs are retained. An initial expected silent-stub inventory
ratchet failure was corrected by removing exactly ThunkConnect32's entry;
the pin is 235. No gate was skipped.

**Production changes remain uncommitted WIP**, since a real connection is
unfinished and the extra focused gate fails. The observation note is the only
published change. The census also includes incoming foreign WIP and is not
published independently. Exact Git revision, relevant tracked diff, owned new
tests as patches, source/build hashes and recovery recipes are retained.

The unguarded original child was actually waited with exit 1, both pipes
reached EOF, and its independent deadline did not fire. No PNG was produced;
there is no image to view. No box was created: ID none, NOT_CREATED, expiry
null, stop receipt N/A. The run result records cleanup and released ownership.
