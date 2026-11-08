# NFS3: live Win9x device enumeration and native bootstrap

Implemented the missing Config Manager registry tree. Original production Worker
`3DSetup.exe` now opens `HKDD\Config Manager\Enum`, enumerates the virtual
display and monitor, reads their `HardWareKey` values, and reaches the end of
that enumeration. The chooser and Direct3D race control remain unqualified.
No remote box was allocated (ID, expiry and stop receipt null; state
**NOT ALLOCATED**). All local probe browsers close in `finally`.

Evidence: `scratch/runs/20261108-nfs3-win9x-device-enumeration/`. No input,
renderer injection, clock/RNG override, guest patch, replacement DLL, source
archive or media archive was used. Physical GPU remains unknown. Three-renderer
benchmarks, full27, audio, FPS and parity remain open.

## Platform contract

Microsoft's KB250568 describes Config Manager as the RAM hardware tree,
recreated at startup from the current device configuration ([Microsoft-authored
article, retained mirror](https://www.betaarchive.com/wiki/index.php/Microsoft_KB_Archive/250568)).
The current compatibility implementation in [Wine's own wineboot source](https://github.com/wine-mirror/wine/blob/master/programs/wineboot/wineboot.c)
creates `Config Manager\Enum` independently of individual device creation.
[Wine's PnP implementation](https://github.com/wine-mirror/wine/blob/master/dlls/ntoskrnl.exe/pnp.c)
creates eight-digit hexadecimal child keys with `HardWareKey` strings pointing
to device instances and a DWORD `Problem` value. Microsoft documents
[root-enumerated devices and vendor namespaces](https://learn.microsoft.com/en-us/windows-hardware/drivers/install/hardware-ids).
The Microsoft KB describes Win9x; the current Wine implementation and current
Microsoft driver documentation support the representation, not a claim that
this emulator boots a real Win98 PnP driver stack.

The emulator already exposes one fixed primary **Wine-Assembly Display** and
one **Default Monitor** through `EnumDisplayDevicesA/W`. The registry now
represents those same two virtual devices, using explicitly emulator-owned
`ROOT\WINEASSEMBLYDISPLAY\0000` and `ROOT\WINEASSEMBLYMONITOR\0000` instances
under `HKLM\Enum`. Each has `DeviceDesc` and `Class`; its live HKDD record
links through `HardWareKey` and reports `Problem=0`. These are virtual instance
names, not fabricated PCI/physical GPU IDs, driver filenames or D3D capabilities.
No PCI device, network adapter or other unimplemented bus device is invented.
This fixed inventory matches the current fixed display service; hotplug and a
full Configuration Manager API implementation are outside this change.

Config Manager records use a RAM backing map through the ordinary registry
service. Case-insensitive paths, relative opens, value lookup, key/value
iteration, metadata, writes and deletion use the same registry machinery as
other keys. Export/import excludes this live subtree, and preexisting persisted
copies cannot introduce stale physical devices. Clear/reseed reconstructs it.
Closed/unknown open/create/query/set/enum/close handles fail; enumeration requires
space for the terminator and reports `ERROR_MORE_DATA` without truncating output.
Absent keys and values retain their normal failures, and enumeration ends with
`ERROR_NO_MORE_ITEMS`. There is no unconditional successful open or empty-tree
shortcut.

## Ordinary native setup and next dependency

The retained predecessor trace failed at opening Config Manager, after the
utility wrote an empty description. With the service implemented, a production
Chromium Worker run passes that point, then reports **“Could not open 3D Data
registry key.”** The bundled `Setup/english/SETUP.INS` explicitly launches
`3ddata.exe` before `3dsetup.exe`. Executing that original catalogue installer
through the production launcher writes the EA catalogue using native
`RegCreateKey`/`RegSetValue`; its real catalogue includes vendor/card IDs as
catalogue data, not installed physical hardware. It exits with code zero.

Local-only app registrations now expose that bootstrap, the original setup,
and the original game using its chosen renderer. Setup receives only the
`DisplayName` installation metadata specified by `SETUP.INS`; it receives no
selected renderer or renderer capability values. All use the existing 133-file
manifest and ordinary shared storage. Existing Glide entries are unchanged.
The chosen-renderer game entry has no startup registry writes.

On first native setup with no description, the utility itself selects and writes
**Software Renderer / softtri**, then exits zero. This is its installer/default
path, not a user-selected Direct3D result. A second ordinary launch (also repeated
after a full page reload, preserving native registry state) reads that native
choice, loads the shipped `d3dtest.dll` and resolves `D3DTEST_GetCards`.

Detailed ordinary API tracing then records:

```text
LoadLibraryA("d3dtest.dll") -> native handle 0x0086f000
GetProcAddress(0x0086f000, "D3DTEST_GetCards")
LoadLibraryA("d3d")
GetProcAddress(0x00400000, "_THRASH_about@0")
... 33 other _THRASH_* requests against the EXE handle ...
Program exited (worker), EIP/diagnostic registers zero
```

The last line is the host's terminal diagnostic, not a successful native
`ExitProcess` or accepted chooser. No further input was attempted.
The shipped tree contains `d3da.dll`, not `d3d.dll`. Static inspection of the
actual requested module explains the bounded next dependency:
`d3dtest.dll` original VA `0x100013d9` calls LoadLibrary; `0x100013e2` takes the
nonzero branch directly to export lookup. Only a zero result formats `%sa`
(at original VA `0x1002cf08`) and retries, naturally requesting `d3da`.
The current general LoadLibrary handler normalizes the first request to
`d3d.dll`, finds no file/static module, but its bare-`.dll` fallback returns the
EXE image base. This suppresses the utility's authentic suffix fallback.
The trace demonstrates the wrong nonzero handle path; it does not establish
that every later symptom has this sole cause.

Next work is a general missing-vendor-DLL LoadLibrary failure contract, with
regression coverage that preserves genuinely implemented built-in system DLLs
(including the existing `d3d9.dll` API-backed case), followed by the utility's
own retry of the shipped `d3da.dll`. Do not alias `d3d` to `d3da`, inject a chosen
renderer, or patch the guest. This is separate loader behavior; it was not
changed speculatively in the registry fix. Until that ordinary path qualifies,
no runtime box or original-game inputs are justified.

## Validation and recovery

`test/test-storage-registry.js` records a failing-before Config Manager open
and passing-after live enumeration, relative A/W opens, linked values, absent
values/keys, buffer canaries, closed handles and snapshot isolation. Existing
registry/INI/COM/state-transfer checks also pass. The display enumeration test
now compares actual API device descriptions against the registry records.
Focused DirectX metadata and snapshot-diff tests pass. The focused registration
check preserves Glide and rejects renderer seeds on the native route. The
locked full build passes; the final run's build/test logs are retained.
The broad debug-app suite was not claimed: the predecessor documented unrelated
stale Uplink assertions.

Native catalogue and first-setup writes demonstrably transfer between production
Workers and across reload through normal shared storage. This does not prove
successful setup-to-D3D-game transfer: the native chooser is still blocked as
above. Screenshots show the intervening error or the desktop after terminal
exit, not a working chooser or race.

All 133 standing media files (22,070,305 bytes) were freshly SHA-256 verified;
the manifest and paths are recorded without copying media. Source recovery uses
Git SHA plus relevant binary diffs, including relevant untracked code as patches.
The fetched production WASM is 2,182,500 bytes, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
The detailed run additionally hashes served JS/HTML responses. Browser:
Chrome 151.0.7922.108; isolated real guest main Worker, 1000×800 viewport.
No D3DIM context/module/fallback acceptance, acceleration, steering or road
displacement is claimed. No remote allocation, watchdog, resume, deletion or
public deployment occurred; no task box remains billing.
