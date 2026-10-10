# Colin McRae Rally 3 demo

Original: test/binaries/win98-games-a-d/ColinMcRay-Rally3-pcdemo-D3D.exe
126663356 bytes, SHA256 d1dff3e9e718859c6a127b7efcbd85189198ff823f504db2470dbdeacd183ec0.

The InstallShield Setup Player bootstrap ShellExecutes itself and exits in the
CLI. This is not an installed game or successful launch. Original uncompressed
InstallShield cabinets are embedded: data1.cab starts103051, data1.hdr657893,
data2.cab706495. Carve data1 up to the hdr and hdr up to data2; unshield reads
data2's own metadata and ignores trailing installer records. Correct volume
names matter: naming data2 as data1 lists333 entries but fails324 extractions.
With both volumes, unshield extracts333 files with zero failures.

Rally_3PC.exe is a separate uncompressed installer record: Disk1 path record
119757270, payload119757306, decimal size1556480, version0.0.0.0. Original
PE SHA25650ac9d5efbadd8b9d593ac229e82711a0742f6b2dd4eaac58a1d573cd981408c.
No executable patch. Assets Boot_Data/Car_Data/Sound_Data/Track_Data are placed
under Data/, matching literal game paths; App_Self_Reg_DLLs at the root.
Fonts and Shaders are provisionally same-named root directories, not yet
validated by gameplay. Scripts/receipts: scratch/cmr3-demo-20261010/.

## Startup registry dependency

First direct run creates PC_CMR3 then calls NULL at batch0 after CreateFileA
fails on D:\prj\CodeMasters\RALLY_3PC\Pccd1\Data\Strings\Whole_E.lng.
The data exists as Data/strings/Whole_E.Lng; this is the wrong base path.

Function0x446c10 calls string-registry reader0x446a20 twice. Key at0x553140 is
HKLM\SOFTWARE\CODEMASTERS\Colin McRae Rally 3 Demo. Value names are
INSTALL_PATH (0x557dd0, fallback developer path0x557de0) and CD_PATH
(0x557dc4, fallback Z: at0x557dcc). Use the original registry configuration
point rather than aliasing arbitrary developer directories. The prepared
CLI snapshot sets both roots to C:, matching the mounted original files.
Configured replay finds the strings and reaches graphics/audio checks; no gameplay claim.

## Graphics capability and next audio blocker

Configured startup succeeds in loading strings, then0x4b22b0 tests caps
PrimitiveMiscCaps bit0x800 at0x4b22e5. This is BLENDOP: software implements
ADD/SUBTRACT/REVSUBTRACT/MIN/MAX, but caps previously returned zero. A backend
query now reports that bit only for enabled software with native renderer
exports. WebGL stays zero because its current path only sets blend factors.
Contract: https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dpmisccaps

Canonical build and adapter tests pass, covering disabled/missing/WebGL cases,
request-capacity independence, closed bridge, and real host-import routing.
Original replay passes the graphics check and reaches DirectSoundEnumerateA
callback0x448100, then reports no sound card. Investigate actual callback
contract/identity next; do not skip this check. Evidence:
scratch/runs/20261010T0830Z-cmr3-blend-caps.

## Concrete sound-device enumeration

The original callback at0x448100 tests lpGUID ([esp+4]); only a non-NULL
GUID makes it set the byte at lpContext ([esp+16]) to1. It returns TRUE
for either entry. The prior handler called it only with the default NULL
alias, so this game concluded that no sound card existed. Microsoft documents
both the Primary Sound Driver NULL alias and the same output with its proper
name and GUID, with FALSE cancelling further callbacks:
https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee417545(v=vs.85)

Candidate: default alias followed by Wine Assembly Audio, the implemented
software playback endpoint. Stable GUID words57415344/4a714d31/82476a91/01000000
are accepted by DirectSoundCreate8 (legacy Create/Initialize already accept
the device). The 112-byte DSES invocation frame is guest-stack-owned, with
callback strings and iterator state, sharing the CACA0007 return continuation.
No heap allocation or global iterator; nested enumerations are independent.
Canonical build and callback ABI/cancellation/nesting/device-open tests pass.
Original replay accepts the concrete entry and advances into graphics
configuration. Its 20000-batch endpoint is a black canvas, not gameplay or
audible sound evidence. Run: scratch/runs/20261010T0840Z-cmr3-sound-enum.

## Post-enumeration graphics-device failure

The black startup canvas is a NULL call, not merely slow rendering. At
0x5078b0 the original calls vtable+0x54 (SetGammaRamp), but device global
0x97c650 is zero. No CreateDevice preceded it. CheckDeviceType has rejected
fullscreen R5G6B5 (23); initializer0x507240 returns7 at0x5072ab and its
caller still invokes gamma setup. Longer1million-batch run0843 is identical.

Original registry BITDEPTH is an enum:0 selects16-bit,1 selects24-bit,
2 selectsA8/X8R8G8B8 (comparison0x447a2b). Tried BITDEPTH2 with ADAPTER_PID
and ADAPTER_VID0 matching software adapter metadata. Run0849 proves the
game resets BITDEPTH to0: helper0x446c00 treats zero as missing and returns
the fallback (-1 for adapter IDs), forcing the reset at0x447933. This attempt
is not a working32-bit configuration. Next: real16-bit rendering support or
a viable original settings route. Do not spoof hardware or patch the game.
Evidence: scratch/runs/20261010T0843Z-cmr3-startup-null and
scratch/runs/20261010T0849Z-cmr3-32bit.
