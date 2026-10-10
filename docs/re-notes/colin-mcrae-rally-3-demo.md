# Colin McRae Rally 3 demo

## Original assets and launch

Investigated 2026-10-10. Installer: `ColinMcRay-Rally3-pcdemo-D3D.exe`,
126663356 bytes, SHA-256
`d1dff3e9e718859c6a127b7efcbd85189198ff823f504db2470dbdeacd183ec0`.
Extracted original `Rally_3PC.exe` SHA-256:
`50ac9d5efbadd8b9d593ac229e82711a0742f6b2dd4eaac58a1d573cd981408c`.
The fixture has 333 original files. Audio assets are in `Data/Sounds`
(plural); do not mistake `Data/Sound` being absent for missing assets.

Temporary-box fixture and registry: `/home/user/cmr3-game-20261010/`.
The launch controller is `scratch/cmr3-demo-20261010/rgb565-original.js`.
Use the original executable, VFS tree, saved registry, software D3D9 with
programmable support, and a bounded run. No input was required to reproduce
the startup stop; no approval or license dialog was answered.

## Graphics progress

The original requests fullscreen R5G6B5 display/backbuffer format 23.
The RGB565 candidate supplies packed guest storage, correct row pitches,
per-write destination quantization, and format-aware upload/readback,
Present and Reset. Direct and worker paths were tested. Multisampling and
565 StretchRect/conversion remain unsupported.

`scratch/runs/20261010T1010Z-cmr3-rgb565-tests` records the canonical build,
focused regressions and isolated native precision tests. The existing
PS1.4 fixture in `test-d3d9-software-backend.js` fails on unchanged main too;
this is not a full-suite pass. A later correction preserves historical
nonsoftware render-target widening used by Black & White 2, while software
keeps real 565 storage. That fallback is not exact WebGL 565 precision;
its final rebuild/retest is separate from the 1010 evidence.

## Current startup blocker: DirectSound notifications

Reviewed run `scratch/runs/20261010T1012Z-cmr3-rgb565-original` uses candidate
WASM `8c23deecf4c26f982044591cff64b634105bca6835f7e85ea198b00699f35a5d`.
CreateDevice succeeds and SetGammaRamp receives device `0x08140028`.
The game reads `Data/Sounds/dsstdfx.bin` and
`Data/Sounds/frontend/frontend.big`, then calls through a NULL sound interface.
The screenshot is black. Exit code zero does not mean successful startup;
there is no gameplay qualification.

Original addresses:

- `0x517795`: buffer QueryInterface, IID at `0x54257c`.
- IID bytes `830721b0cd89d011af0800a0c925cd16` identify
  `B0210783-89CD-11D0-AF08-00A0C925CD16` (IDirectSoundNotify).
- `0x5177cf`: call through returned interface vtable slot 3, count 1 and
  notification array `0x074ff870`; return address `0x5177d2`.
- Current `dsbuf_iid_kind_wa` recognizes IUnknown, Buffer, 3DBuffer and
  3DListener, but not Notify. The notification method is absent from api_table.

Implement actual event delivery, not a dummy interface or success stub.
Notifications must wake waiting threads without requiring the guest to poll
GetCurrentPosition. Existing host voice cursors wrap modulo buffer length;
comparing only successive wrapped values loses whole laps. Account for loop
refresh, seek, frequency changes, natural end, explicit Stop and release.

Microsoft's [interface contract](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee418244(v=vs.85))
requires CTRLPOSITIONNOTIFY for secondary buffers. The
[method contract](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee418245(v=vs.85))
replaces the notification array while stopped and signals offsets or the stop
sentinel. Preserve COM identity, copied-array lifetime and failure atomicity.
The existing audio-completion pump and `set_event` path are integration points;
browser AudioWorklet and worker delivery need explicit tests.

## Notification candidate validation (2026-10-10 11:29 UTC)

The candidate now passes the canonical build, native COM notification tests,
worklet clock/lap/epoch tests, RPC registration, and a genuinely blocked native
worker wakeup. Registry capacity grew from 304 to 308 bytes; the three Notify
IUnknown methods use existing handler aliases. The host test needed the actual
worker liveAudioRing setting and ThreadManager.closeSyncHandle API.

Evidence: scratch/runs/20261010T1128Z-cmr3-dsnotify-tests. The old
test-directsound-loop-refresh fails identically with baseline dbb1658a3 audio
modules (expects one buffer source although refresh replaces it). Other listed
audio regressions pass; this is not an all-tests-pass claim. Candidate is not
yet committed or browser validated.

Original replay scratch/runs/20261010T1129Z-cmr3-dsnotify-original uses WASM
0f61837f4c0df01f5d0c138e56a7d2cdfb16fc0e03536e4ea37eccff980de7b0.
It passes Notify setup repeatedly and displays the demo splash (reviewed),
then calls NULL at batch83. New return address 0x4f86c6: entry 0x4f86a0
reads object field +0x4c, then calls vtable +0x38 with four arguments
(pointer to zeroed 64-bit value, 0x25, NULL, 0). Interface identity remains
to be established. No ordinary input or approval dialog was answered.
Exit code zero again does not mean gameplay success.

Browser validation: scratch/runs/20261010T1143Z-dsnotify-chrome uses real
Chrome AudioContext/AudioWorklet, shared memory and a browser Worker blocked
in Atomics.wait. All nine checks pass: registration, module load, promotion,
position wakeup, suspension, Stop and Release cleanup. Browser closed cleanly.
Implementation1e409f8f5 was pushed to codex/dsound-notify-20261010; main
integration follows merged verification. This validates the notification layer,
not CMR3 gameplay or its later null interface.

## Graph creation failure identified

The seeking IID at5427c0 is36b73880-c2c8-11cf-8b46-00805f6cef60;
field+4c comes from QueryInterface at4f8384. Graph creation4f8257 requests
CLSID e436ebb3-524f-11ce-9f53-0020af0ba770, IID
56a868a9-0ad4-11ce-b03a-0020af0ba770. These are the DirectShow FilterGraph
and IGraphBuilder; vtable+38 is IMediaSeeking::SetPositions.
[Microsoft graph docs](https://learn.microsoft.com/en-us/windows/win32/directshow/filter-graph-manager),
[seeking contract](https://learn.microsoft.com/en-us/windows/win32/api/strmif/nf-strmif-imediaseeking-setpositions).

Native ole32 is auto-selected from the remote test/binaries/dlls directory
(not the CMR3 payload). It returns80070008 at4f825d; its dynamic lookup of
RpcServerRegisterIfEx returnedNULL earlier. Run1156Z-cmr3-graph-create.
With explicit --dlls pointing only to the original MathCPU.dll, built-in COM
returns80040154 (class not registered). The requested media is
C:\Data\Video\frontend\blink.wmv. No bypass or success stub was added.

Missing on the temporary fixture: /home/user/bg2-main-route-20261009/test/binaries/dlls/quartz.dll,
/home/user/bg2-main-route-20261009/test/binaries/dlls/devenum.dll, and
/home/user/cmr3-game-20261010/quartz.dll. Local reusable DX redistributable
copies exist under test/binaries/candidates/morrowind/dx81/x and
test/binaries/candidates/pirates-2004/dx9; prepare DirectShow registration
through the existing regsvr32 workflow, keeping app-specific dependencies
explicit. Morrowind notes/preparation document ordering devenum before quartz.

DirectShow preparation1206Z: devenum exported107 registry entries but also
logged an EIP-zero after Exit; quartz registration traps at NdrDllCanUnloadNow.
Dynamic DLL search loaded native ole32/oleaut32 despite explicit --dlls.
Next isolated A/B removes the common native directory from search temporarily,
restores it in finally, retaining real quartz/devenum/msvcrt app-local files.
Evidence scratch/runs/20261010T1206Z-cmr3-audio-com; registration not complete.

Built-in OLE registration succeeds: `20261010T1207Z-cmr3-builtin-com`,
502 exported keys including FilterGraph InprocServer32. Common native DLL
directory restored after test. Replay now uses that registry plus three real
DirectShow files copied beside original EXE; MathCPU and msvcrt explicit seeds.

Registered graph replay reaches subsequent CoCreateInstance at4f9811:
CLSID at5427f0=C1F400A0-3F08-11D3-9F0B-006008039E37 (SampleGrabber),
IID at5427d0=56A86895-0AD4-11CE-B03A-0020AF0BA770 (IBaseFilter).
Next dependency is qedit, not another graph stub. Batch85 NULL remains.

Qedit registration667keys succeeds and replay loads quartz1cd9000,
qedit1ef7000,devenum1f78000. New NULL at4f87b8 (return4f87bd), batch94,
objectESI7b3b30e0. Evidence20261010T1213Z-cmr3-qedit-replay. Next inspect
media/render interface setup and HRESULT; still no gameplay.

Object+58 is filled by D3D9 device slot36 at4f84b3 (CreateOffscreenPlainSurface),
then used via surface slot13 LockRect at4f87ba. Next probe the creation args
(width/height/format/pool2) and HRESULT4f84b9. The new NULL is a graphics
allocation issue, not a remaining SampleGrabber class lookup.

Surface trace establishes zero width AND height, format22, SYSTEMMEM pool2.
Thus rejecting the allocation is correct; earlier graphics-allocation hypothesis
is narrowed to missing upstream media dimensions. Width/height are derived
by4f9d30 calling SampleGrabber::GetConnectedMediaType then matching VideoInfo.
Next trace4f97e0..4f9e00 (graph construction/GetConnectedMediaType HRESULT).

Media-type trace20261010T1223Z-cmr3-media-type: GetConnectedMediaType
at4f9d49 returns80040209 (not connected). AddSourceFilter return4f98d7=0,
then connection helper4f9a90 returns80004005 at4f98e7. Qedit exists and
its object is valid; source connection/decoder discovery is next. Available
DX81 qasf.dll is being registered as a dependency experiment, not a proven fix.

Existing1223Z trace narrows connection failure without another runtime:
4f9ab6 EAX0 (input pin helper),4f9ae0 EAX0 (source enumeration),
4f9b12 EAX80040217 (graph Connect), then helper returns E_FAIL.
Investigate this source-to-sample-grabber connection and codec discovery;
zero surface dimensions are downstream of failed media connection.

Static original blink.wmv inspection (remote, no runtime): ASF header
3026b2758e66cf11a6d900aa0062ce6c,2871567 bytes. Stream metadata names
Windows Media Video V8 / fourcc WMV2,640x480, and Windows Media Audio
V8 / format0x0161 stereo44100Hz. Registry677 has WM ASF Reader class
187463a0... in qasf.dll but no .wmv/.asf source association or ASF signature
registration. WMVCore/WMV decoder files absent from staged fixture and
local test/binaries search including ignored files. Graph Connect80040217
is VFW_E_CANNOT_CONNECT (Microsoft DirectShow error codes); this supports
a missing reader/decoder route hypothesis, not yet a proven sole cause.
Next bounded registry trace prepared in scratch/cmr3-demo-20261010/filter-registry.js.

QASF version caveat: Microsoft documents DirectShow8.1 QASF as a wrapper
for Windows Media Format SDK7.0, not the complete WM runtime. Older ASF
default source differs; registration of QASF alone need not install the
source routing. Reference: https://learn.microsoft.com/en-us/windows/win32/directshow/using-windows-media-in-directshow

Acquired original Microsoft MPSetup.exe on remote boat via archived official
URL from Winetricks wmp9 recipe; SHA256
678c102847c18a92abf13c3fae404c3473a0770c871a046b45efe623c9938fc0
verified,13951112 bytes. Direct Microsoft URL404; archive succeeded.
Remote /home/user/cmr3-wmp9-source-20261010/source.json records provenance.
7z extraction succeeded; initial cabextract unavailable (initial-result.json
retained). Extracted WMVCORE/WMASF/WMADMOD/WMVDMOD/QASF/MSDMO.
PE exports confirm only WMVCORE,WMADMOD,WMVDMOD,QASF need registration;
WMASF/MSDMO are dependencies. register-wmp9.js prepared, NOT executed;
serialized behind BGE browser. No fixture overwritten or installer executed.

Native WMP registration first traps DMORegister; explicitly loading original
MSDMO reaches SHDeleteKeyA, previously unimplemented (return0065204c).
Implemented ANSI/Unicode shell recursive deletion with real case-insensitive
subtree removal; NULL/empty subkey retains the open key and clears contents.
API4499/4500 appended. Existing registry-delete host mode0/1 retained;
mode2/3 adds shell clearing semantics. Regression fails baseline2!=0,
canonical build/storage/snapshot tests pass. Original WMVCORE/WMADMOD/
WMVDMOD/QASF registration then completes,677->770 keys. Evidence
20261010T1301Z-shdelete-registry includes baseline failure and original
native registration before/after. Original game replay is separate.
Contract: https://learn.microsoft.com/en-us/windows/win32/api/shlwapi/nf-shlwapi-shdeletekeya

Replay1302Z enters native WM ASF Reader but child thread dies at
WMVCORE runtime21dd597 (original8549597), IAT RVA1208. Reported
KERNEL32.#00005 is misleading: PE import descriptor identifies WMASF.DLL
ordinal5. Explicitly preload native WMASF, not a fake kernel32 API.
Replay1304Z then reads the ASF header/body but crashes at batch108,
EIP1 after return4f9acd (source-filter EnumPins). Original game unchecked
source/filter error is now next target: capture4f98d7 AddSourceFilter
HRESULT and source object before connection. Wrapper restored native
folder at13:04:57. No playback/gameplay qualification; screenshot1302Z
remains demo splash. SHDeleteKey fix is main72e9d1834.

Verbose replay identifies CMultiLanguage275c23e2-3747-11d0-9fea-00aa003f8646
/IID275c23e1 missing. Acquired IE6 archive via Winetricks URL,80,472,659B,
SHA256 e34e0557d939e7e83185f5354403df99c92a3f3ff80f5ee0c75f6843eaa6efb2.
90s initial download timed out; bounded streaming retry succeeds130s.
MLANG.DLL574976B extracted from IEMIL_4.CAB. Native registration770->981
keys succeeds; native CMR1318Z now AddSourceFilter returns0. Graph Connect
still returns80040217 on both source pins; DMOGetName finds registered
WMAudio/WMVideo decoder entries. No fatal trap in this20000-batch/11s
replay, but screenshot still splash and playback/gameplay unqualified.
Next trace source-pin media types/decoder matching rather than adding
random registry classes. Evidence20261010T1318Z-cmr3-mlang.

Follow-up log audit: decoder matching is not yet the first problem. The
1318Z log repeatedly loads wmadmod.dll at different addresses until DLL
table capacity64 is exhausted; wmvdmod.dll then cannot load. Static PE
inspection of both original codec DLLs finds internal export name
DEFFILE.dll. storage.js COM loaded-module search compares only that
export name, not the recorded module path. Next implement path-aware
COM module resolution and regression with distinct DLL filenames sharing
an export name; do not increase table capacity to hide duplicate loading.

Recorded-path candidate in lib/storage.js resolves modules by DLL_PATH_TABLE
filename (case-insensitive, slash-normalized), retaining export-name fallback
only for old rows without a recorded path. The real owner/shadow COM test
now includes two distinct recorded filenames both exporting DEFFILE.dll;
baseline requests another load, candidate resolves each correct factory.
Registry tests pass. Original replay1329Z loads each codec without exhausting
the DLL table; second graph Connect returns0 (first/audio still80040217).
This is a narrower success than complete video/audio/gameplay qualification.

Replay terminal13:30:19Z, code0, native-DLL directory restored. Reviewed
640x480 screenshot now shows the animated introductory video frame
("GENIUS"), beyond the old static demo splash. 164728260 MMX instructions
retired; no gameplay/FPS/audio qualification inferred. Canonical build,
COM owner/shadow regression and registry suite PASS. Evidence:
scratch/runs/20261010T1329Z-cmr-com-module-path (baseline failure, source
diff, tests, original replay log/identity/cleanup and reviewed screenshot).

Correction: first-pin80040217 is not evidence of broken audio. Static
4f9838..4f98bf initializes the SampleGrabber media type with GUID from
542900 (7669647300001000800000aa00389b71, MEDIATYPE_Video), then calls
SetMediaType before enumerating source pins. An audio pin cannot connect
to that video-only target; the second successful connection is the relevant
result. Audio remains unmeasured, not proven broken. Disassembly retained
in run1329Z/media-type-disassembly.txt. Long replay1331Z finishes120s
without trap, later Codemasters intro frame reviewed:934 batches,748
software D3D requests waited87.3s. That is not a gameplay FPS metric.
Next ordinary Escape to skip intro or browser hardware rendering/menu input.

1337Z ordinary Escape down300/up310: capture350 blank during transition,
final120s later Codemasters logo visible; terminal0/restored13:39:46Z,
1409batches. Not a demonstrated hang or menu. Raw identity route string
was inherited incorrectly; source-note.json records actual Escape args.
Prepared (not run) WebGL/Worker browser route using original fixture and
real WMP/MLANG registry, explicit native MathCPU/msvcrt/msdmo/WMASF. Added
verified existing msvcrt dependency to remote fixture only, SHA256
887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1.
Browser comparison avoids software rendering waits; no guest state patch.
