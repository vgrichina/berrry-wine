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
Configured replay is pending; no gameplay/compatibility claim yet.

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
