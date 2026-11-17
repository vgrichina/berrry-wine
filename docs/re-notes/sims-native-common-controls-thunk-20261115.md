# Sims native common-controls prerequisite — 2026-11-15

The genuine matching companion is present in the retained Windows 98 SE ISO,
under the archive name **KOMMCTRL.DLL**. The former 48112-byte COMMCTRL candidate
is the Windows 3.11 setup library. It is not the installed Win9x companion.
The recovered member has internal module name COMMCTRL and exports the required
LS01 data with checksum 7834. This resolves the source/identity question;
ordinary installer startup and a native connection remain unproved.

Evidence: `scratch/runs/20261115-sims-native-common-controls-thunk/result.json`.
Read with [the original Sims result](sims-complete-collection.md),
[the earlier rejected candidate](neverhood-commctrl-connection-20261114.md),
and [the actual kernel/loader boundary](neverhood-thunk-kernel-loader-boundary-20261113.md).

## Exact originals and recovery

The selected local `test/binaries/dlls/comctl32.dll` remains untouched:
577808 bytes, fixed version **5.80.2614.3600**, SHA-256
`28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4`.
Its recorded redistributable source is VC6RedistSetup_enu.exe > vcredist.exe >
50comupd.exe > comc95.dll; see `test/binaries/dlls/SOURCES.md` for every wrapper
identity. The original Sims attempt requested Cctl1632_ThunkData16, LS01/LB01,
checksum 7834, QT offset 36 and FT offset 68. No alternate COMCTL32 is selected.

The already retained source is
[Windows 98 SE OEM X05-29232](https://archive.org/details/microsoft-windows-98-second-edition-oem-x05-29232),
`scratch/media/win98se-oem-x05-29232.iso`, 655591424 bytes,
SHA-1 `fa040cd3f7fd472e9612b1721bc72d7b82538450`, SHA-256
`2adfb46df8a9c7bbd2f67bff07461cc2f9d9ec8e01f0e112cb044c9e3e62f607`.
No new OS image or DLL was downloaded. Independent single-cabinet listings
of all uppercase WIN98/*.CAB members found the old COMMCTRL and genuine
KOMMCTRL together in PRECOPY1. The ordinary installed COMCTL32 is listed in
WIN98_27.CAB. Listing by the literal filename COMMCTRL alone missed the
required archive member.

An isolated extraction of that ISO's COMCTL32 confirms a different PE:
version **5.80.2614.3500**, SHA-256
`2b2f3147fd6c95d939b01b50390732a359866322c4feaaeeccaa8c70c12f8aae`.
It was inspected only and is not selected. The loaded redistributable PE
remains version 3600/hash 28a41e6a above. Companion compatibility established
here is exact export/layout/checksum agreement; successful initialization and
connection behavior across these originals remain untested.

The decisive source evidence is the original PRECOPY2.CAB member SUBASE.INF:

```text
commctrl.dll, kommctrl.dll, kommctrl.dll
```

LAYOUT.INF independently lists `kommctrl.dll=1,,155136`. This is the original
setup's installed-name mapping, not a substitute DLL or a changed NE module.
PRECOPY1 SHA-256 is
`81aa96efa1c0bdc665e46738f9c72439e46360193a6d7c5574c794aad41a25cf`;
PRECOPY2 SHA-256 is
`a52d6e1fad1b85aef3e0eba4ed1d35a8b982cc572fdcb358fba09b2ce282af81`.

Reproduce locally without downloading another source:

```sh
7z e -y -oDEST scratch/media/win98se-oem-x05-29232.iso win98/PRECOPY1.CAB win98/PRECOPY2.CAB
cabextract -s -q -F kommctrl.dll -d DEST DEST/PRECOPY1.CAB
cabextract -s -q -F subase.inf -d DEST DEST/PRECOPY2.CAB
cabextract -s -q -F layout.inf -d DEST DEST/PRECOPY2.CAB
sha256sum DEST/kommctrl.dll DEST/subase.inf DEST/layout.inf
```

The original companion is **155136 bytes**, version string **4.10.1998**
(fixed version **4.10.0.1998**), SHA-256
`39bbfafa8b759ebfcf6a00ee878fa494581a9144891bbd788bded61441de13f9`.
SUBASE.INF SHA-256 is
`10f3852dd331dbd493ed9be68e767419d959a2c47fe541cd1e33adc24cdb16a2`;
LAYOUT.INF SHA-256 is
`8c53dfe81d9e278bda073d5c2ca5b3af3bf08a9fe2c132d0a1fabe7ddac03129`.
These three small original inputs are retained outside runs under
`test/binaries/sims-native-common-controls/`. No stock binary is committed,
installed into the default DLL search path or added to a deployment manifest.
The exact four Sims archives/BINs and original empty overlay remain intact.

## Real companion contract and earlier blocker

The NE name/entry tables identify COMMCTRL, exported data ordinal **301**,
`CCTL1632_THUNKDATA16`, segment **9:0010**. Its file offset **9616** contains
`LS01`, DWORD checksum **0x1e9a**, and an unrelocated table pointer
**FFFF:0010**. That pointer needs the real NE relocation/lifetime service;
it is not an executable or a usable runtime selector. The pinned PE's unique
LS01 header at file offset 430828 independently agrees with the checksum.
This is static format/checksum agreement, not a connected relocated table.

The next demonstrated admission blocker is `lib/ne-image.js:inspectNeDll`:
the genuine NE's expected-Windows-version WORD is **0x0400**, and the current
Win32-owned lifecycle refuses it with
`NE DllEntryPoint lifecycle is not implemented`. This happens before staging,
LibMain, companion data inspection or the later connection-publication guard.
Lowering the original version or bypassing admission would skip required
behavior and is not a repair.

The actual untouched companion separately exports DLLENTRYPOINT ordinal
**300**, **2:0176**, returning `retf 0x10`. Its helper **1:001c** inserts the
real LS data pointer and tail-jumps through imported **KERNEL.#651**.
The header initializer at **2:0000** is a distinct entry. These disassemblies
reinforce the existing requirement for Win9x attach/detach notification and
ThunkConnect16 registration; neither is supplied by the legacy LibMain/WEP
lifecycle. These paths have not been executed in this task.

The prior [Wine implementation](https://github.com/wine-mirror/wine/blob/cc5d1d86ee7d60649e6f858106db046c77c8b12c/dlls/krnl386.exe16/thunk.c)
also compares the two headers/checksums before producing LS relays. It is
implementation corroboration, not proof of Microsoft's complete lifecycle.
The later current bridge guard still requires a native PE-generation
connection owner and FT prolog before relay publication. Recovering the
companion does not implement either of them.

## Validation and bounded outcome

`test/test-sims-native-common-controls-thunk.js` has a media-independent
legacy/modern admission control, an explicit `--media` identity/export/version
check and an explicit `--compiled` parked PE-import diagnostic. The latter
requires WA_TEST_WASM and the three SIMS_COMCTL32/SIMS_COMMCTRL/SIMS_SUBASE_INF
paths. It is a blocker characterization, not native connection acceptance.
Default execution does not silently claim that the proprietary media or full
module were tested.

The new test remains **uncommitted WIP**: its compiled diagnostic requires the
released but still uncommitted ThunkConnect32 operation-5 closure. Publishing
it as clean-main connection coverage would be misleading. This task publishes
the investigation note only, preserving the complete test as a new-file Git
patch in evidence. No portion of the foreign NE closure is adopted or staged.

The locked full build and twelve focused commands pass on main
`466774bfb3ca942fb8ea16fd5337e3f217d53ec8` plus the recorded relevant binary
patch. The actual canonical module is 2202556 bytes, SHA-256
`c775a3171c5caf5a0991ecbcf1d9c0a4f07882570c05f0ea466586a9ea19ea06`.
All 322 source pins remain unchanged through the controls. The compiled PE
request supplies the untouched genuine companion through the normal resolver
and reaches the lifecycle refusal twice; its parked registers/header/relay
bytes remain unchanged, foreign-owner resolution is refused, cancelled tokens
stay retired, and generic TRUE cannot settle it. No original companion guest
instruction executes: admission stops before staging.

Adjacent controls pass actual relocated-data ownership and unload/stale-frame
checks, missing-companion/async request retirement, PE/EAT reference lifecycle
and nested DllMain/WEP, QT returns through ordinary and cooperative owners,
executable target pinning and mismatched targets, and direct/sparse stack
leases. The Win16 quit regression passes all twelve local/Worker cases,
including normal callback return, unsupported-API trap, process exit 0/37,
child exit 37 and TerminateApp. These are existing primitive regressions;
none proves a valid common-controls connection or FT prolog.

The independent watchdog is observable before launch. Native, watchdog,
supervisor and outer process have actual exit-0 waits with both streams at
EOF. All eighteen recorded execution PIDs are absent, and heavy ownership is
released. The predecessor-release verifier initially expected an obsolete
JSON key; the final schema was then checked against all 75 predecessor PIDs
and 25 native process groups. Its explicit release had already been read
before this task launched; the verifier mistake caused no execution overlap.

No engine repair, foreign NE closure adoption, original installer retry,
UI transport qualification, screenshot or gameplay is claimed here. The
previous original remains closed at Missing NE image COMMCTRL; the new
DllEntryPoint refusal is a separate diagnostic using the genuine companion.

The next repair must implement and test real Win9x notification ordering,
registration, rollback/detach ownership and repeated loads, then native
connection retention and QT/FT publication through the compiled boundary.
Malformed/mismatched/foreign/stale failures must remain failures. An original
Sims retry is warranted only after those prerequisites change and pass their
controls. Installer completion, serial/media checks, household and chosen
action remain open. No box was created: ID/expiry null, NOT_CREATED, stop N/A.
