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

Browser1350Z comparison stops at graphics-minimum modal, no JS crash.
Harness omitted d3d9-programmable query used by successful CLI flags;
host-imports.js explicitly gates that profile on this query. Preserve
failed comparison evidence; corrected browser-programmable618944 is
started after clean shutdown, with identical fixture and ordinary Escape.
Do not infer new GPU capability defect from the mismatched profile.

Corrected WebGL profile1353Z still stops at the same graphics modal;
closed13:54:59Z. Thus missing programmable flag was not sufficient to
explain the rejection. d3d9-host capability0x30017 advertises BLENDOP
and exact565 only for software; d3d9 caps comments explicitly say WebGL
ADD-only. Preserve that truthful gate. Next browser-software route sets
both d3d9-renderer=software and d3d9-programmable, and records the actual
d3d9Bridge.backend separately from the legacy global renderer selector.

Actual software-browser1358Z passes graphics but exits just after MLANG
load, ~15s from launch, before scheduled Escape. Worker filename fix
087b18311 is now main: worker had dropped msg.fileName before loadDll,
which would break recorded-path codec lookup. Baseline boundary regression
fails/candidate passes; build and real COM owner test pass. Broader batching
test GDI-upload assertion fails identically on baseline. Fix does NOT clear
this earlier MLANG exit: no-input browser1404Z reproduces exactly, closes
14:06:02Z. Next equivalent threaded CLI with ExitProcess/ExitThread trace;
cooperative CLI still works. Held Alice loader WIP not included.

Threaded CLI comparison 20261010T1406Z also reaches the reviewed GENIUS
intro frame, six guest threads still active at the45s deadline. This is
not a generic threaded-codec failure. Browser exit trace1410Z closes
14:11:54Z/errors[]; main API trace records second MLANG CoCreateInstance
at return0x0240116c, then host reports zero-EIP exit6ms later. No
ExitProcess or ExitThread appears in the selected trace. Next inspect
Worker COM continuation/register restoration and compare MLANG activation
in CLI; absence of an exit call is not proof of the precise corruption.
Evidence scratch/runs/20261010T1406Z-cmr-threaded-exit and
scratch/runs/20261010T1410Z-cmr-browser-exit-trace. No gameplay claim.

Browser COM register trace1413Z confirms MLANG load preserves EIP/ESP
but changes nonvolatile EBX/ESI/EBP (before EBX=1033, EBP=0x074ff5b0;
after EBX=39821312, EBP=122679536). Diagnostic harness1414Z restores
only EBX/ESI/EDI/EBP around the existing COM handler: it gets beyond
MLANG and creates two more codec threads, then traps at EIP1. Thus
restoring those registers alone is NOT a validated fix. Investigate
initializer completion/abandoned frames and loader concurrency; expose
existing DllMain logger in the isolated harness before modifying product
code. Both runs terminal with retained evidence; no gameplay claim.

Root-cause evidence1416Z/1418Z: existing callDllMain logger reports
MLANG DllMain at0x025fd3d3 abandoned at0x025fd8b4, yield5 halt4.
Pending get_loadlib_name resolves to comctl32.dll. Other observed COM
initializers return EAX1 cleanly. Browser comLoadDll does not provide
an onLoadLibraryYield service, then clears the yield after restoring
only EIP/ESP, leaving the unfinished MLANG frame/register state behind.
Do not ship the register-only workaround: nested loading must complete
or fail truthfully before the original COM activation resumes. Compare
CLI built-in/native comctl resolution and implement a resumable owning
initializer continuation if required. Runs terminal14:17:33/14:18:38Z.

Correction/comparison1428Z: the browser harness blocked native OLE files
but still advertised the full default DLL_PATHS list. CLI hid the entire
common DLL directory. Baseline JS with DLL_PATHS empty and common DLL
URLs blocked (fixture DLLs retained) no longer immediately exits: running
true at60s, blank white render surface, codec threads exit/restart, and
stack-overlap diagnostics for reused thread IDs2/3. Not movie/gameplay
qualified. Nested initializer candidate1425Z and caller-preserving1426Z
get past MLANG but still trap EIP1 after missing advertised oleaut32.
Candidate remains uncommitted in wt-cmr-nested-loader-20261010; focused
mock tests pass but runtime/correctness work remains. Current boat source
is restored baseline, not candidate. Next isolate thread restart/stack
reuse and compare truthful common-DLL policy; do not attribute all browser
failures to the nested initializer alone.

Serial scheduler comparison1431Z still fails: quartz thread1 explicitly
logs UNIMPLEMENTED API FreeLibraryAndExitThread at runtime0207eb55.
Original quartz ImageBase35500000; IAT RVA1104 names that KERNEL32
API, called at RVA5cb5c after CoUninitialize (IAT140c). This is a
concrete missing API, not evidence that a spinlock or more serialization
will fix the app. Current main FreeLibrary is a remembered-handle stub;
a correct no-return release/exit needs the held real module-lifetime
implementation and concurrent-mapping correctness. Do not substitute
ExitThread-only. Task FREELIBRARY-EXITTHREAD-CMR3-20261010 records it.

## Shared DLL count prerequisite (10 October, 19:54 UTC)

Two independently instantiated Node workers sharing the same WASM memory
still overwrite DLL table row zero when their loads are strictly serialized:
each instance starts with its private count at zero. Distinct fixed load
addresses isolate this from the separate staging-buffer race. The unchanged
source fails the second worker's expected count of two with an actual one.

The row count now resides in an allocated shared region, with atomic reads
and publication after metadata initialization. All WAT module-table consumers
read that count. Host and worker synchronization retain their legacy fallback
but skip count replay for modules advertising the shared registry; a delayed
snapshot must never overwrite authoritative process state.

`test/test-dll-shared-count.js` reproduces the old failure with real workers
and checks stale publication/adoption through production ThreadManager paths.
The candidate passes the full build plus the focused worker count, dynamic
module filename, inherited globals and DllMain context tests. Evidence:
`scratch/runs/20261010T1953Z-dll-shared-count`.

This does not serialize simultaneous mapping or implement unload. Shared
PE_STAGING, address selection, reentrant initialization and module-graph
lifetime still require synchronization before FreeLibraryAndExitThread can
be implemented correctly. CMR3 gameplay remains unqualified.

## Original CMR3 native quartz A/B (14 October, 00:22 UTC)

Run `scratch/runs/20261014T0022Z-cmr3-original-validation` compares held DLL
lifecycle commit `50f814bcbcaa7e5be4dad6a2ef1dc4cfe7ac3303` against its exact
parent-main `2481d17cf12d24b94cc08562000cfc240d29aef8`. Canonical modules are
candidate `80a8bdf93d9f1f2da53e27c7ba10fa1831cef274be7c9b4d21af87d85002f0ad`
and baseline `0918dec0eba2b3f0a6a0f0c1423fe273a9c95f530acb3108d01699f481ffb7ab`.
Actual browser module responses match these hashes. Each software run lasted
180 seconds in Chrome 151.0.7922.108 with the default Worker scheduler,
software D3D9 programmable, and a 1000x800 browser viewport.

The fixture contains 302 original mapped files: cabinet extraction gives 333
records, excludes 32 installer resources, then adds the separate original
Rally_3PC.exe. EXE SHA remains `50ac9d5efbadd8b9d593ac229e82711a0742f6b2dd4eaac58a1d573cd981408c`.
The explicit native DLL/AX set has 12 files, including original quartz
`41925fbcdf3d29232ec80a2ec55969d3c153457ad5421ef594457e0d95593c56`;
registry SHA is `b676b3d6bc165eacf0dd33af01a0e7200da465562253f8b26443e4bdd0d9c07c`.
Common native-DLL URLs were blocked and the common DLL registry emptied;
built-in OLE was used. Original EXE/assets/native DLLs and source hashes
passed before/after checks. No guest-state/cache patch or silent stub.

The first prepared route had conflicting query parameters. The debug toolbar's
`d3d-renderer=webgl` overrides `d3d9-renderer=software`; actual WebGL truthfully
showed the graphics-minimum modal. That run is preserved under
`candidate-original/`. Both comparison runs correct only the first query to
software. Actual backend fields and reviewed toolbar screenshots confirm it.
The local test server also blocks `/src/api_table.json`, so selected API names
are logged without argument/return-address detail. This is a trace limitation,
not evidence of missing guest APIs; guest dispatch uses its compiled table.

After ordinary Escape at approximately 38 seconds, baseline quartz thread 1
traps at runtime `0x0207eb55` (quartz base `0x02022000`, RVA `0x5cb55`) in
`FreeLibraryAndExitThread`, with return `0x0207eb62` and HMODULE `0x02022000`
on its saved stack. It repeats on the next media transition. The candidate
logs two corresponding API calls followed by thread 1 `exited (yield=2)`;
there is no unimplemented-API trap. Subsequent real native media threads start.
This validates progress through the original quartz release/exit boundary;
the browser trace does not independently establish final physical unmapping
or all reference-count transitions.

Both arms show the original splash, moving title video with PRESS RETURN TO
CONTINUE, and the main menu with STAGES highlighted. Thus reaching the menu
is not a differential success claim: the baseline's background thread traps
do not stop the entire application. Both have conspicuous rectangular video
artifacts. Reviewed ordinary click/Return inputs (100/700/120/900 ms holds)
did not enter Stages before their deadlines. Input order and settings match,
but screenshot review caused different later wall-clock timings; candidate
needed the second Return to leave the title, baseline accepted the first.
Neither arm qualifies racing, gameplay performance, or audible sound. Next
investigation is the remaining main-menu input/progression boundary, with
explicit frame/thread/input evidence rather than assuming the unload fix
also solves it.

All 88 observed browser/build PIDs and their positive/negative process-group
IDs were independently absent at `2026-10-14T00:22:35.696Z`. Runtime was
released before source-only packaging. `export-manifest.json` pins all 154
transferred remote artifacts; every local file hash was verified with a 2 GiB
free-space floor. `investigation.json` records reviewed screenshot paths and
limits. No corpus candidate ID exists, so no dashboard result was attached
to an unrelated game. The shared HEAD/index and production files were untouched.

## Original-source recovery research (15 October)

The original upstream is recorded in `test/binaries/SOURCES.md`: Internet
Archive item `win-98-games-a-d.-7z`, archive `Win98_Games-A-D.7z`.
Its current metadata matches the historical 7,169,873,753-byte archive and
SHA-1 `c53417bcc617790d9671ec385c49ee6f018846c9`. The archive viewer lists
the exact `ColinMcRay-Rally3-pcdemo-D3D.exe` member at 126,663,356 bytes.
The [single-member URL](https://archive.org/download/win-98-games-a-d.-7z/Win98_Games-A-D.7z/ColinMcRay-Rally3-pcdemo-D3D.exe)
returned HEAD 200 on 15 October, so a remote recovery can try this member
without downloading the entire archive. No payload was fetched during this
research: matching the recorded SHA-256 remains mandatory before extraction.

`docs/cmr3-recovery-20261015.json` preserves the source links, historical
half-open carve ranges, EXE identity, and outstanding recovery gates. These
ranges come from the earlier extraction notes, not fresh byte inspection.
Keep both named cabinet volumes; the separate EXE occupies 1,556,480 bytes
starting at 119,757,306. Do not confuse the 333 CAB records with the later
302-file mounted original tree: the latter excludes 32 installer resources
and includes the separate EXE. The subsequent session audit below recovered
the exact exclusion list.

The startup INSTALL_PATH/CD_PATH values alone cannot recreate the later
saved registry, native media registrations, or twelve-file DLL/AX set.
Recover their receipts/snapshot or reproduce the authentic registration
sequence with new evidence before claiming equivalent launch preparation.
No installer, mapping, registry, app registration, or runtime was fabricated.
The separate IA `cmr3-pc-demo.7z` item contains a 126,895,173-byte installer
and an upgrade; it is not a verified replacement for this tested original.

Further source-only recovery found the retained original agent sessions.
`docs/cmr3-historical-receipts-20261015.json` records their IDs, event ordinals
and timestamps and preserves the actual mapping audit's 32 excluded paths,
seven group mappings, zero collisions and 301 mapped cabinet files. It also
preserves all twelve native DLL/AX sizes and SHA-256 values from the original
preflight output, independently agreeing with the restoration worker's native
manifest output. The older support receipt has different `msdmo.dll` and
`qasf.dll` versions; use the final twelve-file preflight identities, not those
earlier support bytes. `regsvr32.exe` is an additional preparation tool, not
one of the twelve runtime DLL/AX files.

The registry's exact historical path is
`/home/user/dll-original-fixtures-20261013/registry-native.json` (184,922 bytes).
Its bytes and the full 302-file preflight inventory remain absent in the
searched local scratch trees; metadata and hashes alone do not restore them.
Original controller patches survive in the route session, but include the
documented conflicting renderer query before later correction. They must be
reviewed/adapted before reuse. The recovery JSON includes the bounded remote
single-member acquisition arguments, still unexecuted pending runtime-owner
coordination. No native registration or guest execution occurred in this audit.

The subsequent authorized remote recovery succeeded on `bx_erf37bxf`:
installer download/hash/carves process 26104 exited zero at 09:24:23;
unshield installation 26582 and extraction/mapping 27812 exited zero.
Original installer and EXE SHA-256 values match. Distro unshield 1.5.1-1
extracted exactly 333 records; the recovered 32 exclusions matched exactly,
with 301 mapped cabinet files plus the separate EXE, zero case-insensitive
collisions and every copied file hash verified. The 302 original files total
158,742,926 bytes. `docs/cmr3-original-inventory-20261015.json` preserves their
paths, lengths and hashes; this is a fresh verified-source inventory, not a
recovery of the missing historical 302-file manifest.

Reproduce in a fresh remote workspace using `tools/cmr3-source-recovery.js`
with an absolute fresh acquisition output, then `tools/cmr3-assemble-original.js`
with that acquisition and a separate absolute fresh assembly output. Curl
and `/usr/bin/unshield` are required. Both preserve originals and failure
receipts; neither executes a Windows binary or creates registry settings.
The tested acquisition has a 360-second outer deadline and assembly 180
seconds, in addition to their internal subprocess bounds.

Evidence: `scratch/runs/20261015-cmr3-original-recovery` contains 16 transferred
artifacts (221,846 bytes), all size/SHA-256 checked, plus terminal process
records. Sources, carved cabinets and extracted originals remain remotely
under `/home/user/cmr3-recovery-20261015`. Postflight at 09:26:01 found no
remaining acquisition/extraction processes and released the slot. Native
DLL/AX bytes and full saved registry remain prerequisites for launch; this
milestone makes no menu, racing or gameplay claim.

Post-run source review hardened both recipes to reserve a 2 GiB free-space
floor plus a conservative 512 MiB expansion budget before writes. Assembly
now independently compares every carved byte range against the verified
installer, so changing a cabinet and its editable receipt together cannot
pass validation. Two synthetic tests cover the space boundary, an authentic
range, a tampered carve with a matching edited receipt, and truncated bytes.
These checks pass locally; the revised recipes have not been rerun end to
end. The successful original-byte recovery above used the earlier script
versions preserved with its evidence.

## Native dependency recovery (15 October, 10:07 UTC)

All twelve historical native DLL/AX identities are now recovered under
`/home/user/cmr3-native-recovery-r3-20261015/native` on `bx_erf37bxf`.
Four seed files matched retained local originals; archived WMP9 and IE6
packages matched their historical SHA-256 pins and supplied seven more.
The public IA DirectX 8.1 ZIP matched its metadata SHA-1 and supplied the
exact 519,680-byte `qedit.dll` hash. Full package and native identities are
in `docs/cmr3-native-recovery-result-20261015.json`.

Initial acquisition 53906 failed after successful downloads/extractions
because the recipe expected a nested DirectX.cab. The verified DX81eng.exe
instead exposes its original files directly to 7z. That failed tree/log is
retained. Corrected recipe `00a4d0a33` supports direct or cabinet layouts,
always requiring the exact native identity. Three synthetic tests cover
both layouts, same-size wrong bytes and source-package hash rejection.
Final fresh-output run 56105 reverified all three retained package pins,
extracted and checked all twelve native files, and exited zero at 10:06:44.
No network transfer was repeated. The earlier direct-only repair 55537 is
preserved separately; final validation uses the committed corrected recipe.

Evidence `scratch/runs/20261015-cmr3-native-recovery` retains 58 remote
artifacts (66,282 bytes), all size/SHA-256 verified, plus three terminal
records and staging identity receipts. Postflight at 10:07:11 found no
remaining recovery processes and released the runtime slot. Original
packages, extracted files and failed attempts remain on the remote box.
No registry registration, Windows guest or game was executed. The full
registry snapshot remains missing; actual native registration is the next
preparation prerequisite, not a claim that launch is ready.

## Native registration recipe prepared (15 October)

`tools/cmr3-register-native.js` and
`docs/cmr3-registry-preparation-20261015.md` prepare the historical nine-step
sequence in an isolated clean checkout, without executing it. Authenticated
regsvr32 disassembly identifies the DllRegisterServer return at 0x401341;
the existing runner trace will record EAX there. Acceptance requires S_OK,
guest exit zero and an exported native InprocServer32 entry at every step.
Host exit zero alone is insufficient. Pure JS rejection/order tests pass.
No runtime/build/remote action occurred in preparation; canonical source/module
pinning and a fresh root runtime grant remain prerequisites. The output is a
newly generated registry, never asserted equal to the missing historical bytes.

First bounded native registration on 15 October tested `6dfbff842` after a
fresh canonical build (module `d463bdae09d9a4e8926c31f0a594535331a2a85d39d494c0e281b920ce9f0fa5`).
Process73364 exited1 at10:34:13: devenum/quartz/qedit/QASF passed real HRESULT,
guest exit and native COM checks; WMVCORE returned S_OK and exited0 but left
the 671-entry snapshot byte-identical and no WMVCORE InprocServer32 value.
The strict recipe stopped before the remaining four steps. Review the real
export's intended effects before changing the oracle; no DLL defect inferred.
Postflight10:34:53 found no survivors and unchanged6491sources/module/native12/
original302. Evidence `scratch/runs/20261015-cmr3-native-registration` retains
40 verified artifacts plus terminal receipts. Full registry remains incomplete;
no game or retry executed. Runtime released to root.

Static followup resolves WMVCORE's distinct contract: exact native SHAe79cace0
DllRegisterServer ordinal7/RVA76e7d writes embedded PRXFILE/200/1033 to
C:\WINDOWS\WMSysPr9.prx; it does not register an InprocServer32 class. Profile
is316640bytes/SHA25695f1edbc3cb9aa70a374a61b43bd16818636b0190aa841504130bb718c39c2c7.
Source recipe now requires fresh exact VFS output plus unchanged registry,
HRESULT/Exit0; other DLL native-class checks remain. Genuine output is carried
into the next staging VFS and must later be mounted for game replay. Six JS
tests and offline authentic-resource exporter roundtrip pass; no guest retry.
Failed73364 lacks VFS capture, so file effect remains inconclusive. Full static
proof and preservation contract: docs/cmr3-registry-preparation-20261015.md.

Freshbox bx_9ef2wdsw registration53813 PASS11:53:15 on exactdc0611212,
canonical02b41f09 (1803164B). Original302/native12 recovered and reverified;
all9actual HRESULT/Exit0 pairs pass, WMVCORE profile316640/SHA95f1 matches
embeddedresource and is retained for future VFS mounting. Native FilterGraph,
SampleGrabber, ASFReader, WMA/WMV decoders and MultiLanguage keys inspected.
Newregistry972entries/182940B SHA7e59a8770cf1c8d180943539247f3bd3dd5990f3e2eb1be91971250d2e9c7a54
differs from missinghistorical184922B; never claimed byte-recovered.
Postflight11:53:54 survivors[] and source/module/original/native unchanged;
108artifacts3152085B hashverified in scratch/runs/20261015-cmr3-fresh-registration.
No game executed; slot releasedroot. Exactpaths and pins in
docs/cmr3-fresh-registration-result-20261015.json. Earlier73364 remainsfailed
because it lacked profile evidence; no retroactive qualification.

## Fresh registered original menu replay (15 October, 12:05 UTC)

Corrected sole CLI run58821 uses exactdc0611212/canonical02b41 with all302
originals/native12/new972-entry registry and actual generated WMSysPr9.prx.
Software D3D9 programmable/cooperative route reaches animated title and main
menu STAGES with ordinary Escape1s/Return1s. Second Return2s at1033–1054
encounters explicit unsupported line-list draw afterbatch1049: primitive2,
count12, limit256;14,259 repetitions. Lastmenu shots05/06/07 identical.
`Device.prepareBatch` in lib/d3d9-software-backend.js accepts only[1,4,5,6].
Real line semantics, not guard deletion or silent skip, are next. Actual draw
vertex/shader/state snapshot absent; line failure not proven sole blocker.
Eight abandoned parkedEnter calls/three heldCS also retained in complete log.
No race/playercontrol/audio/FPS/browser qualification; road is menu video.

Evidence scratch/runs/20261015-cmr3-registered-gameplay-r2, reviewed screenshots;
25remote artifacts4668070B verified. Earlier rendererless57843 and preguest
mkdir57376 failures retained; corrected rendererPNG preflight precedes guest.
58821terminal0 12:05:09.206/source+fixtures unchanged; runtimeProcesses[]
12:06:20.251, slotreleased. No corpuscandidate exists, investigation.json
publishedlast instead of attaching evidence to unrelatedgame. Exact recovery,
controls, limitations and source/test handoff: docs/cmr3-registered-gameplay-20261015.md.

## Line-list original replay (15 October, 12:46 UTC)

One original run on clean main78a06540f/canonical937466db now passes Stages,
1 player, Ford Focus RS WRC02, automatic, UK and Special Stage1. Screenshot
2246 shows LOADING UK WARWICK with the route map. At batch2402 the first
explicit renderer failure becomes `D3D9 software: invalid native free list`
(output.log line1653;2725 copies). Later/final frame dark gray; no race or
driving established. Device.prepare's d3d_render_coalesce_heap negative return
is the checked boundary, not a diagnosis of the damaged node or cause.
Shutdown RECLAIM native heap handoff rejection and8abandoned Enter calls
also retained. No guest-state edits, forced transitions or driving input.

85638terminal0 12:46:35.289;85684child0 12:46:34.803 after explicitctlquit.
Source6518/module/original302/native12/registry972/profile unchanged; sanitized
runtimepostflight12:46:56.583 survivors[]. Evidence26artifacts2044242B verified
in scratch/runs/20261015-cmr3-lines-gameplay; all13screenshots/final reviewed.
Exact menu batches, environment, staging recovery and next source boundary:
docs/cmr3-lines-gameplay-20261015.md. Audio/FPS/browser remain unqualified.
