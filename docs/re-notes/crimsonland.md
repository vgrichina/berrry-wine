# Crimsonland

Historical source last updated, 2026-10-12. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

## 2026-10-31: complete INF review; host installation replay prerequisite

Run `scratch/runs/20261031T2334Z-crimsonland-authentic-install/` reviews
`cd62d1dd74299b301642d2d6c16ba11c97b3621b` and descendant
`a0db7c56da9f42a6ce3ba8777d61cc8254a2e888`. The generic builtin repair is
present. **No candidate installation or mount recipe was enabled:** the first
concrete unsupported host operation is the selected INF's registry deletion.
The local manifest imports an additive registry snapshot; it cannot express
the required subtree removal. Component registration also requires actual
installer effects absent from the copy plan. This is a host installation
prerequisite, not an observed guest failure or a new loader-policy defect.

### Full baseline, source and destination review

`full-scope-review.json` independently parses the original `directx.inf`,
retains every directive's source line and CSV fields, and matches all138
baseline copy rows against the predecessor's `selected-scope.json` and the
signed package's retained size/SHA-256 inventory. Nothing reruns or rewrites
the predecessor audit. There are96 distinct package sources and138 distinct
destinations; all rows have a bare filename, with no per-row rename, temporary
name or copy flags. The selected backup sections copy **package bytes** into
`sysbckup`; they are not a plan to save the guest's current DLLs there.

| Copy sections | Actions | Destination |
| --- | ---: | --- |
| DirectX_System_98, DXSystemFiles, DirectX8_System, WIN9X_DXTRANS | 43 + 1 + 38 + 2 | `C:\windows\system` |
| WIN_SYSBACKUP, DXSysbackup | 40 + 1 | `C:\windows\sysbckup` |
| Help_Subsection | 2 | `C:\windows\help` |
| DirectX_Drivers | 2 | `C:\windows\System32\Drivers` |
| Inf_Subsection | 3 | `C:\windows\inf` |
| DirectX_Migrate | 6 | `C:\windows\system\DirectX\Migrate` |

The four AddReg groups expand to114 rows:10 HKLM and104 HKCR, comprising111
default string rows, two key-only rows and one binary `FilterData` row. They
cover the authentic DxDiag executable App Paths entry, DirectMusic GM path,
CheckVerDLLs settings, DirectX VB classes/interfaces/type library and MPEG
decoder registration. They do not supply a fabricated DxDiag COM provider.
`del.control` has three rows: remove `DisplayName`, `UninstallString`, then
the `DirectXDrivers` uninstall subtree. The five DelFiles groups expand to31
rows:10 setup files, three `dxbackup` paths, one help file,11 obsolete INFs
and six obsolete system files. `DXSetupDelFiles` uses DIRID28700 with
`directx\setup`; its base remains unresolved by the host recipe contract.
It must not be guessed as a Windows/system directory. These are reviewed
actions, not applied changes; queue ordering, replacement decisions and
directory deletion behavior are not inferred from the filenames alone.

### Original selector corrects the conservative Win98 baseline

Only four small setup binaries were extracted into this new run, all verified
against the accepted full payload inventory. No entire media copy was made.
Original `dsetup32.dll` at its preferred base `0x400000` provides the missing
selection evidence (`os-selection.asm`, `section-selection.asm`):

* `0x4061a1`: Win98-family predicate requires platform1, major4, minor10,
  and `HIWORD(dwBuildNumber) != 0x045a`.
* `0x4061e5`: the SE predicate additionally requires
  `LOWORD(dwBuildNumber) >= 2222`.
* `0x40627b` classifies that family; `0x40b61c..0x40b63d` chooses
  `WIN98SE_INSTALL` when the SE predicate succeeds, otherwise `WIN98_INSTALL`.

Current `$winver=0xC0000A04` is expanded by `version_info` to4.10,
build16384, platform1. Consequently **the original selector, if reached,
chooses `WIN98SE_INSTALL` (136 actions)**. The predecessor correctly left
selection unproved, but its conservative138-action Win98 baseline is not
the actual branch predicted from today's engine responses. The only copy
difference is `WIN9X_DXTRANS` (`dxtrans.dll`, `dxtmsft.dll`); all four directive
lists are identical. Both complete scopes and this explicit difference remain
in the evidence; no silent reduction was installed. This result does not
establish that the emulated environment is an authentic98SE installation.
`installer-selection.json` records boundary controls at builds1998,2221,
2222 and16384, plus Me encodings. This is static branch translation, not
guest setup execution.

### First unsupported host action and causal limit

The original copy path calls `SetupInstallFromInfSectionA` at `0x40b686`
through the function pointer resolved at `0x407749..0x407767`, with section
flags `0x16`, copy flags `0x80000002` and callback `0x409343`. It does not
merely enumerate files. `lib/browser-shell.js` reads the local manifest's
`files` and `registry`; `StorageImports.importStore` in `lib/storage.js`
overlays values and explicitly skips null entries. A fresh process-local JS
fixture proves that neither null nor omission removes an existing sentinel
key. No persistent or DirectX registry state was changed by this fixture.
Thus the required `DelReg` subtree operation cannot be faithfully encoded by
that existing candidate manifest contract. Guest registry-delete imports do
exist; the manifest has no operation that invokes them. No builtin
`SetupInstallFromInfSectionA` API is registered either; the package's native
SetupAPI is a distinct, unexecuted path, not evidence of host replay support.

The original setup also processes `Win98_DirectX_Inf` (13 component entries,
including `dinput.inf,Win98RegInstall` and `dxver.inf`) and separately schedules
`DXDllRegister` / `DX8RetailDLLs` from `dxdllreg.inf`. The latter contains
`RegisterOCXs` for DirectShow, sound, play, input and retail music DLLs;
copying those INFs does not execute their DLL registration. The genuine
`dxver.inf` contains Version/RC writes, but these were not applied or used as
a detector shortcut. `component-actions.json`, `component-setup.asm` and
`registration-flow.asm` retain the original actions and callers. A verified
installed-state export or supported replay of these effects is missing.

**Resume condition:** supply a reviewed installation replay that handles the
original section selection, deletion, setup queue/component registration and
their initial-state conditions, or an authentic verified installation result
with a recovery recipe. That work exceeds a file/manifest-only change under
the present constraints. Preserve this checkpoint before any new candidate
mutation; do not substitute16 core files or detector-only DLLs. Ordinary
browser Play/combat remains pending separately authorized host access.

Validation: static full-scope comparison and selector boundary controls,
four extracted setup pins, actual pure JS manifest/policy fixture, syntax
and documentation whitespace checks. Original60, predecessor157, recovered
media84, predecessor mount12 and all61 candidate files including its manifest
remain unchanged. No engine/lib/src, tools/test source, original guest,
resource/version, builtin policy or persistent registry changes; no build was
required for this documentation-only commit. No browser/game/installer,
downloads, runtime remote access, agents or boxes. Boat ID/state/expiry N/A.
The run retains pins, disassembly, full directive inventory and recovery
instructions; final disk verification remains above2GB.

## 2026-10-31: consistent builtin execution with authentic system files

Integration validation: the mandatory locked build passed for tail-call and
compatibility WASM, including data-segment overlap checks. Focused registration,
builtin execution and callback-census mutation checks passed. Evidence:
`scratch/runs/20261031T2327Z-coordinator-census/`. The compiler-managed string
pool grew from 6144 to 6656 bytes for the additional module names; its generated
JavaScript layout mirror was regenerated and all layout gates passed.

Run `scratch/runs/20261031T2325Z-builtin-execution-repair/` retains the focused
repair evidence. No candidate files or manifest were changed; this is not an
installation or runtime qualification.

The patch centralizes system/native policy in `lib/dll-registry.js`, keeps
explicit native-loadable exceptions, and rejects attempts to map builtin-only
modules through the native mapper. The actual `LoadLibraryA` handler chooses
builtin execution independently of `has_dll_file`; existing filesystem attributes
check qualified requests so a missing path cannot inherit an available basename.
Builtin module identity names extend the existing 64-slot table to 50 names,
preserving the original eleven slots and four-entry DirectX ordinal range.
`GetModuleHandle` and `GetProcAddress` use those identities and builtin thunks.
Original file data and its resource/version lookup remain independent; no original
file receives `staticModule`, no resources/registry/DxDiag are fabricated, and no
DDRAW native closure or game-specific exception is introduced.

The new small source fixture compiles and calls the actual WAT loader, identity
and export handlers with real VFS/host imports and JS dependency planners; it
does not execute x86. Against the original assigned WAT, the first full-path
D3D8 assertion fails with native-map yield 5. The changed WAT passes with both
synthetic and retained authentic D3D8 input (SHA-256
`c999fb98e33efaf1c2667501de5cb91fdd816f5f3c1f87f4f76b7a60e8efafbe`).
Controls cover basename/full-path/stem identity, distinct builtin handles,
Direct3DCreate8 API binding, absent private exports, missing qualified paths,
native-loadable modules and startup/dependency policy. The authentic bytes and
RT_VERSION blob remain identical. Exact commands/statuses are retained in
`focused-results.json` and its individual logs.

The coordinator reviewed the three changed callback-census hashes, retaining
pending ownership and the nonlocal API gate. The new builtin branch resolves a
handle synchronously through the existing DLL lock and reference machinery;
no callback boundary or EIP restoration target changed. Integration checks and
the required build are recorded in
`scratch/runs/20261031T2327Z-coordinator-census/`. Full-tree compatibility,
including legacy tests that assume missing system paths load without a mounted
file, remains outside the focused validation.

The full authentic `WIN98_INSTALL` 138-action installation/INF review remains
outstanding, followed by separately authorized ordinary runtime validation.
No browser, guest, game, installer, download, remote runtime access or box
lifecycle action occurred. Boat ID/state/expiry N/A; no runtime was acquired.

## 2026-10-31: authentic installation stopped at a reproducible loader-policy blocker

Run `scratch/runs/20261031T2306Z-crimsonland-dx81-mount/` audits main
`65224c0ca25da0937337734303740847f14ee34e` and reuses the recovered package,
INF/core plans and pins from `20261031T2243Z-crimsonland-authentic-dx81`.
**Candidate installation is blocked before mutation.** The package is ready;
ordinary startup with these dependencies is not ready under current loading
policy. No candidate dependency paths or host manifest were changed. The
original60, existing host manifest, all157 predecessor pins and all84 retained
recovery-run files remain unchanged. No browser, guest, installer, build,
download, remote box, agent or lifecycle operation ran; Boat ID/state/expiry N/A.

### Selected installation scope and actual file identity

The review baseline is **the complete `WIN98_INSTALL` scope**, all138 copy
actions plus its associated authentic directives. `selected-scope.json`
preserves their exact source/destination/size/SHA-256 plan. Crimsonland has no
`winver` override: `src/01-header.wat` defaults to `0xC0000A04`; the version
handler reports Win9x4.10, build16384, empty CSD. This does not identify 98SE
build2222 or Me. The Win98 baseline is conservative, not proof of the setup
program's conditional branch selection. Neither the16-file proposal nor a
single detector-satisfying DLL substitutes for the full INF installation.
CopyFiles, AddReg, DelReg, DelFiles, LoadDLLS and component/setup actions were
not applied; a copy-only tree must not be described as a completed installation.

The actual package SHA-256 remains
`d1762981f497a623b2f3e725c0916b96e716bd4a8845c5a4cc7f764b1a5cc5f7`.
All40 retained payload files and16 core pins match. A temporary **in-memory**
`VirtualFS`, using the real `mountDirectXSystemModules` helper, demonstrates
the exact proposed system mapping: authentic `d3d8.dll`,1209344bytes, at
`c:\windows\system\d3d8.dll`, SHA-256
`c999fb98e33efaf1c2667501de5cb91fdd816f5f3c1f87f4f76b7a60e8efafbe`.
The helper preserves these bytes. Actual `has_dll_file` returns1 for the full
path, and actual `findVfsDllBytes` returns the same hash. The explicit
`loadMode:required,httpRange:false` manifest example survives the ordinary
lazy-policy helper unchanged. This is a local mapping check, not a candidate
installation, HTTP receipt, WASM mapping or guest execution.

The original synthetic D3D8 placeholder is1024bytes, has `staticModule:true`
and no RT_VERSION, and is excluded by native DLL lookup. The authentic file
contains real executable code/imports and its original4.8.1.881 resource;
it carries no synthetic marker. Marking it `staticModule` would misrepresent
its identity and is not a supported solution.

### Exact causal loader contract

1. `lib/dll-registry.js` excludes D3D8/DDRAW/DSOUND/DINPUT8 from its native
   loadable list. `resolveDllGraph` therefore leaves their startup imports to
   builtin dispatch even if authentic files are visible. Seeds bypass that
   gate, so adding native DLL seeds would change execution policy as well.
2. `handle_LoadLibraryA` in `src/09a0-handlers-base.wat` checks real-file
   availability before falling back to a static system identity. An explicit
   load of the authentic full path can consequently select native D3D8.
3. The actual `loadLibraryDependencies` generator, given these original D3D8
   bytes and API names from current `src/api_table.json`, requests **zero**
   dependencies. DDRAW is unlisted for native loading but classified as a
   Windows system DLL, so the walk skips it despite its authentic file being
   available. `missingImportDependencies` likewise reports no missing DLL.
4. Authentic D3D8 imports16 private DDRAW names:
   `DdEntry12,11,6,2,3,10,9,20,7,17,19,18,1,8,16,13` (each with the
   `DdEntry` prefix). **None exists in the current API table.** With DDRAW
   unmapped, `process_dll_imports` in `src/08b-dll-loader.wat` creates unknown
   API thunks; `patchDllImports` can resolve exports only from mapped modules.
   Thus that native closure cannot correctly execute a private import call.

This is a demonstrated policy/dependency mismatch, not an observed game crash
or a claim about which call startup would reach first. Copying the complete
INF file set does not change the native dependency gate; copying only D3D8
would conceal the same issue behind detector success. Making DDRAW native is
also a wider runtime change requiring its Win9x helper/driver contracts, not
an app-local manifest correction.

**Next executable step:** a separately authorized generic loader change must
make the module execution choice explicit and consistent across startup imports,
LoadLibrary, dependency walking, module handles and export resolution while
keeping authentic files/resources independently readable. If builtin DirectX
execution is selected, native file visibility must not silently override it;
do not encode that choice as a false `staticModule` file marker. If native
execution is selected, resolve the full authentic DDRAW closure rather than
treating its16 private exports as builtin APIs. Use this retained pure-helper
reproducer for an old-fail/new-pass regression in that change. No generic
implementation was attempted here and no such change is presumed approved.

After that policy is resolved, claim exact dependency/manifest paths, recover
the138-action scope from the retained package, verify every pin and actual VFS
mapping, and separately review the INF actions. The subsequent ordinary route
is `index.html?candidates&app=crimsonland`, original EXE, empty extra arguments,
normal launcher Play. Until installation/policy is resolved, the unchanged
route retains the original DirectX warning; no new startup success is claimed.

Verification: `node scratch/runs/20261031T2306Z-crimsonland-dx81-mount/audit.cjs`
passes original/media/source/manifest hashes and actual pure JS loader/VFS
checks without instantiating WASM. Scratch syntax and documentation diffcheck
pass. `loader-contract.json`, `source-pins.json`, `validation.json`,
`blocked-mapping-example.json` and `RECOVERY.txt` retain the exact checkpoint.
Final local free disk exceeded2GB; no original or predecessor cleanup occurred.

## 2026-10-31: authentic Win9x DirectX 8.1 media recovered; installation review ready

Run `scratch/runs/20261031T2243Z-crimsonland-authentic-dx81/` starts from a
descendant of `c6733097a2ff970a388aeaa15906b96dc8d93ba3`. It recovers the
**Win98/Me final DirectX 8.1 package**, without executing its installer, a game,
or a browser. No engine, registry, candidate manifest or original guest file
was changed. Boat ID/state/expiry N/A; no runtime or box was allocated.

The local search is retained in `home-media-paths.txt` and
`local-d3d8-pins.json`: all 36 discovered local `d3d8.dll` copies are 1,024-byte
fixture variants, including the excluded UT files. The historical Morrowind
`dx81/x` directory is absent. The inspected Icewind CAB is DX7-era media and
does not supply the target. No compilation archive was downloaded.

### Package provenance and repeatable extraction

Selected source: [direct DX81eng.exe mirror](https://am.net/lib/tools/Microsoft/DirectX/dx81eng.exe).
Actual package **12,144,784 bytes**, SHA-256
`d1762981f497a623b2f3e725c0916b96e716bd4a8845c5a4cc7f764b1a5cc5f7`;
SHA-1 `c3fc3333c083a0344af15c6c4a56fbfa7f3a83f8` independently agrees with
the [historical package catalogue](https://www.shoplack.com/detail.aspx?id=409).
The old Microsoft `download/win98/Install/8.1/W98Me/EN-US/DX81eng.exe`
URL and the tested Microsoft alternatives return HTTP 404. Fetch headers,
final URLs, failures and the distinct DX8.1b mirror pin are retained in
`fetch-*.json` and `provenance.json`. The alternate 8.1b package was not used
for this component set and its redundant downloaded copy was removed.
[Bethesda's publisher instructions](https://help.bethesda.net/app/answers/detail/a_id/17667/~/a-message%2C-a-required-.dll-file-is-missing%2C-dinput8.dll%2C-was-not-found%2C)
also distinguish Win98/Me `DX81eng.exe` from the Windows 2000 `DX81NT` package.

`verify-authenticode.py` verifies the actual PE Authenticode file digest,
signed-content digest, RSA signature and embedded certificate-chain signatures
through **Microsoft Corporation → Microsoft Code Signing PCA → Microsoft Root
Authority**. `authenticode-verification.json` pins all three certificates.
This is historical cryptographic evidence using legacy MD5, with no claim of
current trust-store, revocation or timestamp trust validation. Initial generic
OpenSSL CMS/SMIME attempts did not handle the old Authenticode content correctly;
their failures remain recorded, and the explicit format-aware check passed.

Recovery recipe: claim a fresh ignored destination, require `/home` free above
2 GB plus package/extraction headroom, fetch the exact selected URL if necessary,
check its SHA-256 above, then use **7-Zip 23.01**, without running the EXE:

```sh
7z t DX81eng.exe
7z x -y -oRECOVERY_DIRECTORY DX81eng.exe
```

The PE resource `.rsrc/RCDATA/CABINET` is an embedded LZX:21 CAB, ID 28547.
All **327 files / 26,608,972 bytes** passed archive CRC validation; each extracted
file's size and SHA-256 is in `payload-manifest.json`. `package-list.txt` and
`extract.log` retain the extraction details. A second streaming extraction of
`d3d8.dll` reproduced its exact SHA-256 (`d3d8-reextract.sha256`). The signed
package, 16 proposed core files, authentic INFs and catalog remain retained.
Other extracted copies were removed to reduce disk use; recover them from the
pinned package and compare against the complete manifest. Free disk was
2,513,637,376 bytes initially, 2,455,703,552 after extraction, and briefly
2,004,103,168 during unrelated shared-tree growth; media writes then stopped.
Removing 32,204,908 redundant owned bytes left 2,400,190,464 bytes free, including
concurrent external cleanup. Another worker reported a shared-disk dip to
1,419,689,984 bytes at 22:50, below the requested floor; this run was then doing
static planning, with no media extraction/download writes. The coordinator
subsequently recovered duplicate storage and this run's final check saw
2,823,360,512 bytes free. The floor was therefore not maintained by the shared
host throughout the task; these are observations, not continuous disk telemetry.

### Authentic component and installation contract

Recovered `extracted/d3d8.dll`: **1,209,344 bytes**, SHA-256
`c999fb98e33efaf1c2667501de5cb91fdd816f5f3c1f87f4f76b7a60e8efafbe`.
Its unmodified 844-byte RT_VERSION is retained separately, SHA-256
`ddecc77fc5c2f5c45eb0f50ca4cbb88abc128342e7728c7c0601805daf5fbae7`.
The 13 raw root `VS_FIXEDFILEINFO` DWORDs, in order, are:

```text
feef04bd 00010000 00040008 00010371 00040008 00010371
0030003f 00000008 00010001 00000002 00000000 00000000 00000000
```

Thus **file MS/LS = `00040008` / `00010371` → 4.8.1.881**, exactly meeting
the original major-4 threshold. Its PE sections are executable `.text`
(1,102,336 raw bytes), `.data`, `.data1`, `.rsrc`, `.reloc`; direct imports are
USER32, ADVAPI32, VERSION, GDI32, **DDRAW**, KERNEL32. Full symbol lists,
sections and fixed words for all 98 payload PEs are in `payload-manifest.json`;
the original EXE/four game DLL import lists are in `game-imports.json`.
Authentic NE/LE companions are identified separately, not mistaken for PE errors.
Although this DLL's PE OS header says 5.1, the signed package's Win9x INF,
major-4 fixed version and `VOS_DOS_WINDOWS32` fixed OS word establish its intended
Win9x distribution. Neither that header nor a major-5 detector match alone
establishes Win98 runtime compatibility.

`directx.inf` has `$CHICAGO$`, catalog `dx8w9x.cat`, driver version
`10-30-2001,4.08.01.0881`, and explicit WIN98/WIN98SE/WINME install sections.
`installation-plan.py` resolves its copy directives and destination IDs into
`installation-plan.json`: **138 Win98 / 136 Win98SE / 93 Me copy actions**, each
with exact source, destination, size and SHA-256. All referenced source files
were present in the selected package. Default destination ID 11 is
`C:\WINDOWS\SYSTEM`; help, INF, sysbckup, migrate and driver directories are
resolved separately. Authentic INF registry/deletion directives are retained
for review and have not been applied.

For a narrower app dependency review, `core-component-plan.json` pins 16 files:
`d3d8`, `ddraw`, `ddhelp`, `d3dim`, `d3dim700`, `d3dramp`, `ddraw16`, `ddraw.vxd`,
`dxapi.sys`, `dinput8`, `dinput`, `dinput.vxd`, `dsound`, `dsound3d`, `dsound.vxd`,
`msvcrt` (normal DLL/EXE suffixes as listed in the plan). The original app imports
D3D8 and DSOUND; grim.dll additionally imports DINPUT8 and MSVCRT. D3D8 itself
requires authentic DDRAW. Same-package core versions are 4.8.1.881, while
legitimate older companions retain their own versions. External OS imports
include NTDLL `RtlUnwind` through DDRAW and RPCRT4 `UuidFromStringA` through
DSOUND; the complete names are preserved. Dynamic helpers, NE/LE/VxDs and driver
behavior still require review. This 16-file proposal is not a complete Windows
installation or a proven minimal executable closure.

**Next separate change:** select the appropriate authentic INF installation
scope, claim the candidate dependency paths, and recover exact pinned bytes.
For manifest mounting, the concrete target entry is, for example,
`{"url":"dependencies/dx81/d3d8.dll","vfsPath":"c:\\windows\\system\\d3d8.dll","size":1209344,"loadMode":"required","httpRange":false}`
relative to the existing Crimsonland manifest; retain the SHA-256 in its recovery
pins and verify the actual mounted bytes. Use the same explicit system mapping
for the selected companions, preserving original60. Review loading policy first:
`mountDirectXSystemModules` preserves existing authentic files, but real files
lack the synthetic `staticModule` flag and can be offered to native DLL loading
by `has_dll_file` / `findVfsDllBytes`. Merely adding an entry can therefore affect
more than detection. Do not mark authentic bytes synthetic to force a result,
manufacture DxDiag registration, or infer rendering/input/audio compatibility
from the version resource. Then run the ordinary startup in a separately
allocated session and diagnose its first real failure.

Checks: archive CRC327; repeat target extraction; authentic signature/digest;
raw fixed words/sections/imports; all payload pins and INF copy-source coverage;
original60 and all157 files in the three predecessor evidence directories
unchanged; scratch syntax and docs diff whitespace. No build or heavy tests.

## 2026-10-31: static audit resolves the authentic DirectX resource requirement

Run `scratch/runs/20261031T2240Z-crimsonland-dx-contract/` audits descendant
`c24d17db6629c06d36dd1fd6dfbc6b92c869e6dd` of input `2a64e65c` without
executing a browser/game, building, downloading, or changing engine/guest files.
All **60 predecessor original-file pins match**, including EXE SHA-256
`93cdcdc872c836e75122e3a1d41312c74761cf4736181d3541521e82f6cb2031`.
The predecessor directory remains byte-for-byte unchanged. Its retained
`native-dx-startup.asm`, `native-dx-detection.asm` and
`first-unresolved-dependency.json` are reused; the new
`native-component-check.asm` extends the original disassembly through
`0x41df5c`. `native-data.json` resolves strings, GUIDs and import slots directly
from the original PE; `source-pins.json` identifies the audited API sources.

**Concrete recovery target:** an authentic installed
`C:\WINDOWS\SYSTEM\d3d8.dll` whose `VS_FIXEDFILEINFO.dwFileVersionMS/LS`
reports **major 4 and version >= 4.8.1.881**, or **major 5 and version >=
5.1.2600.881**, is sufficient for this fallback to identify DirectX 8.1.
These are original comparison constants, not versions assigned to our static
module handles. Earlier DirectDraw/DirectPlay checks need not succeed first.
This establishes the startup requirement, not subsequent DLL execution or
gameplay compatibility. No causal generic API contract defect was proved.

### Native control flow and all component comparisons

At `0x41cf90`, detection first tries the DxDiag COM provider (`0x41d090`),
CLSID `{A65B8071-3BFE-4213-9A5B-491DA4461CA7}`, IID
`{9C6B4CB0-23F8-49CC-A3ED-45A55000A6D2}`. It initializes the provider with
SDK header version `0x6f`, obtains `DxDiag_SystemInfo`, and reads
`dwDirectXVersionMajor` / `dwDirectXVersionMinor` as `VT_UI4` (`0x13`) and
`szDirectXVersionLetter` as `VT_BSTR` (`8`). A negative HRESULT falls through
at `0x41cfdc` to the component scan (`0x41d2c0`). The current local COM class
handlers have no DxDiag provider; host activation in `lib/storage.js` requires
an actual registered in-process server and returns `REGDB_E_CLASSNOTREG`
with a null output when registration is absent. Crimsonland's registration
does not seed that server. The separate Pirates app's DxDiag registration is
not a Crimsonland dependency installation.

The component scan calls `GetSystemDirectoryA(buffer, 260)` at `0x41d2d7`
(IAT `0x46f020`) and appends these original suffix strings. Every threshold
below is inclusive, using unsigned MS-then-LS comparison at `0x41df30`;
`0x41def0` packs `(a,b,c,d)` into `MS=(a<<16)|b`, `LS=(c<<16)|d`.
Checks run in table order and successful checks write the reported generation;
this is a heuristic scan, not a requirement that every DLL exist.

| File suffix (string VA) | Original file-version threshold | Reported generation; comparison area |
| --- | --- | --- |
| `\ddraw.dll` (`0x473a30`) | `4.2.0.95`; `4.3.0.1096`; `4.4.0.68` | 1.0; 2.0; 3.0 (`0x41d365`–`0x41d452`) |
| `\d3drg8x.dll` (`0x473a20`) | `4.4.0.70` | 3.0a (`0x41d4c3`) |
| `\ddraw.dll` | `4.5.0.155`; `4.6.0.318`; `4.6.0.436` | 5.0; 6.0; 6.1 (`0x41d587`–`0x41d67b`) |
| `\dplayx.dll` (`0x473a14`) | `4.6.3.518` | 6.1a (`0x41d6ec`) |
| `\ddraw.dll` | `4.7.0.700` | 7.0 (`0x41d7af`) |
| `\dinput.dll` (`0x473a08`) | `4.7.0.716` | 7.0a (`0x41d872`) |
| `\ddraw.dll` | major 4, `4.8.0.400`; or major 5, `5.1.2258.400` | 8.0 (`0x41d939`–`0x41d9ce`) |
| `\d3d8.dll` (`0x4739fc`) | major 4, `4.8.1.881`; or major 5, `5.1.2600.881` | **8.1** (`0x41da43`–`0x41dade`) |
| `\d3d8.dll` | major 4, `4.8.1.901`; or major 5, `5.1.2600.901` | 8.1a (`0x41daf7`–`0x41db7a`) |
| `\mpg2splt.ax` (`0x4739ec`) | `6.3.1.885` | 8.1b (`0x41dbeb`) |
| `\dpnet.dll` (`0x4739e0`) | major 4, `4.9.0.134`; or major 5, `5.2.3677.134` | 8.2 (`0x41dcb2`–`0x41dd47`) |
| `\d3d9.dll` (`0x4739d4`) | readable root fixed-file version; **no numerical threshold** | 9.0 (`0x41ddac`–`0x41dde1`) |

`0x41de30` requires a positive `GetFileVersionInfoSizeA(filename,&ignored)`
result, allocates that many bytes, requires nonzero BOOL from
`GetFileVersionInfoA(filename,0,size,block)`, then requires nonzero BOOL and a
non-null result from `VerQueryValueA(block,"\\",&fixed,&length)`.
The VERSION import thunks `0x46ddf4/0x46ddee/0x46dde8` resolve to IAT
`0x46f198/0x46f19c/0x46f1a0`. At `0x41deb3`/`0x41deba` it reads the root
fixed structure at **+8 (`dwFileVersionMS`) and +12 (`dwFileVersionLS`)**.
It ignores product version, localized string versions, the returned length,
and the DirectX registry Version string. Missing/unreadable resources make
this helper return `E_FAIL`, not a made-up version.

The scan itself returns `S_OK` even when no component matches, writing
major/minor zero and a space letter (`0x41ddef`–`0x41de27`). Therefore a
successful detection HRESULT does not mean DirectX is installed.
`0x41d020` packs the reported generation as `(major<<16)|(minor<<8)|letter`,
where a space contributes zero and lowercase a–z contributes 1–26.
Startup checks HRESULT sign at `0x42c725`, then performs an **unsigned**
comparison of the output DWORD against `0x00080100` at `0x42c729`.
Only a nonnegative result with a lower generation enters `0x42c737`.
A negative detection HRESULT instead enters the different error dialog at
`0x42c7a3`. The prerequisite warning uses `MessageBoxA(...,0x23)` and requires
`IDYES=6` to enter the hyperlink path; other responses exit. The retained
warning is consistent with the zero-generation successful fallback.

### Current API audit and actionable recovery

`src/09a0b-handlers-base-late.wat`'s `$get_fixed_windows_directory` supplies
`C:\WINDOWS\SYSTEM`, returns 17 characters excluding NUL, and has room for
the terminator in this 260-byte call. The original app adds its own separator.
`src/09a1-comctl-handlers.wat`'s VERSION handlers delegate to
`$file_version_resource` / `$file_version_info_size_named` /
`$file_version_info_named`: they open the named VFS file read-only with
`OPEN_EXISTING`, parse its PE/NE RT_VERSION, copy the actual resource, and
query its root binary value through `$version_query`. The A handlers clean
up 12/20/20 stack bytes respectively, matching these stdcall imports.
`lib/filesystem.js` resolves exact normalized paths; absent files fail rather
than substituting a basename. Static module handles and dispatched D3D exports
do not supply version-resource bytes. No mismatch in this exercised contract
is established by the static audit. This is not exhaustive validation of all
VERSION API edge cases, and no new runtime return trace was collected.

The pinned Crimsonland manifest/registration supplies none of the eight scan
filenames or DxDiag. A local filename search found `d3d8.dll`/`ddraw.dll` in
the UT2003/UT2004 `installed/windows/system/` trees, but each is a **1,024-byte
PE with only a non-executable `.rsrc` section**. Raw fixed words encode
4.8.1.881 / 4.6.3.518, respectively; these files lack authentic runtime code
and recovery provenance and must not be reused as an authentic DirectX install.
`excluded-local-fixtures.json` retains their hashes and sections. Version
decoding here uses raw fixed offsets +8/+12: `tools/pe-version.js`'s current
`describe()` display reads shifted fields and is unsuitable for quoting those
versions without that correction; this offline utility issue does not cause
the guest's VERSION API result.

Next action: recover the real Win9x DirectX 8.1 `d3d8.dll` from provenance-backed
Microsoft redistributable media or a licensed installation, retaining the
package/file hashes, extraction recipe and unmodified RT_VERSION. Verify its
raw fixed-file words against the **4.8.1.881** threshold before adding the
authentic file at the exact system VFS path in a separate reviewed dependency
change. Prefer the appropriate complete authentic runtime set where required;
one resource suffices for this detector, not for full runtime compatibility.
An authentic NT-family DLL is not implied to be executable on this Win98 model.
If the authentic named resource is subsequently present but this chain fails,
capture the first incorrect API return and write an old-fail/new-pass generic
regression then. Do not restore the historical invented 4.8.1.901/4.9.0.904
versions or manufacture a resource-only DLL to pass the scan.

Cheap checks: original 60-file SHA-256/size verification, full predecessor-file
preservation, original import/string/GUID decoding, manifest absence, audited
source hashes, scratch script syntax and documentation diff whitespace check.
No engine tests/build or runtime were allocated; Boat ID/state/expiry N/A.

## 2026-10-31: browser geometry repaired; original DirectX prerequisite blocks combat

Run `scratch/runs/20261031T2232Z-crimsonland-combat-recovery/` repairs the
scratch harness setup and records the first genuine game failure. The preceding
`20261031T2226Z-crimsonland-native-combat` directory is unchanged. Its controller
timed out at browser.cjs:37 while sizing a blank window, before navigation or
module loading. Worker termination 143 has unknown cause; no denial was observed.
The coordinator's reconstructed release is retained separately in
`20261031T2232Z-crimsonland-interruption/full-release-final.json`.

The fresh harness keeps `defaultViewport:null`, uses the existing initial tab,
allows browser chrome geometry to settle, and requests the outer size derived
from the measured content-area difference. Actual geometry changed from
1016×621 content / 1024×768 outer to **1024×768 content / 1032×915 outer**.
The exact content-size assertion passed before navigation and every capture;
there was no emulated viewport, forced focus/cursor, or bypassed geometry wait.
This validates the corrected setup, without proving which part of initial-tab
selection or geometry settling caused the predecessor's timeout.

Tested HEAD was `09935fa5d870a5f9b3912459aba1d157a1136737`. All retained
60 original-file, 529 source-file and 867 compiler-file SHA-256 pins matched
before reuse and after execution, as did the original manifest. The original
EXE is `93cdcdc872c836e75122e3a1d41312c74761cf4736181d3541521e82f6cb2031`.
The actually loaded uncached HTTP 200 module was 2,023,821 bytes,
`ed3f924ab4c2d8805d862ccb4ca0747f37632bfa1bf2bc4b21bececa820ec622`,
matching the prior canonical build exactly. No build, engine change, compilation
container download, or guest/config/save/memory edit was needed for this run.

The normal `index.html?candidates&app=crimsonland` route ran an isolated guest
Worker with WebGL selected and reached the original **“DirectX8.1 or newer not
detected”** message. The full logged text requires installed DirectX 8.1 and
asks whether to open its download page. Reviewed captures `01-native-startup.png`
and `02-first-dependency-still-visible.png` are byte-identical
(`e5a35234022058f7b3979c08876c9c3420123df348cfae89814cdd03d974c992`),
with 52,080 non-teal pixels and 69 colors. A second image-view rendering appeared
teal, but decoded PNG pixels and exact hashes confirm the same visible warning;
that viewer observation is not a guest paint-loss diagnosis.

This is the first unresolved dependency: the original installed-component/version
check does not accept the current original-file closure. It is not evidence of
a generic engine defect. The retained original disassembly calls detection at
`0x41cf90`, compares its reported generation against `0x80100`, and enters this
warning branch at `0x42c737`; non-Yes answers take the exit path. No button was
clicked and no input was sent. The native launcher, Pointer Lock, movement,
firing, enemies, kills and score were not reached or newly qualified. Historical
Tutorial acceptance remains limited to its dated source/module.

Recovery: use the retained scripts and exact pins, require the current heavy
slot's explicit full release and independently verify process/port/profile/input
state before inheriting FD9. Resolve the authentic installed DirectX
component/resource requirement, or prove a precise generic API contract defect,
before another combat attempt. Do not fabricate component versions or bypass
the original check. `RECOVERY.txt`, `first-unresolved-dependency.json`, the HTTP
receipt, source inventories and paired captures preserve the concrete checkpoint.

The sole allocation ran 22:33:56–22:34:22 UTC after ReturnFire's explicit release
and an independent gate. Header-guard tests and scratch JS syntax checks passed.
Normal browser/server closure produced Chrome exit 0; controller, supervisor and
launcher were durably reaped with exit 0, six adopted children with status 0,
and the owned board watcher with qualified TERM / wait -15. The monitor exited 0.
Independent release found all 20 owned PID/start identities absent, no whole-host
Chrome/crashpad, ports 38633/34067 closed, profile absent, input set empty and
FD9 free. Minimum free disk was 2,656,055,296 bytes. Local host: Boat ID/state/
expiry N/A. No agents, successor, or deployment was launched.

## 2026-10-31: pinned-module startup recheck

Run `scratch/runs/20261031T0114Z-crimson-alien-startup-sweep/` pins module
`f2911e1fcfc094d3c6d998bbdb071bdd800ede18cd0082a5eed53de15cf08bb9`
and hashes all 60 local candidate files, including its manifest. The complete
concurrent source snapshot is unverified. Sequential eight-second CLI probes
ended normally: the inspected cooperative frame shows the original DirectX
8.1 warning; the threaded frame is blank teal. This does not establish a
threading defect or gameplay acceptance. Clicking the native **No** button
at batch 10000 in a separate cooperative run produced guest ExitProcess(0)
and an inspected empty desktop; **Cancel** behaved the same way. **Yes**
reached unimplemented `HlinkNavigateString` (guest return address `0x42c77d`)
and trapped at batch 10000, process exit 1. The later scheduled launcher click
was not reached. None of these paths advanced to the launcher.

The current `test/test-static-dx-version.js` passes all **12** checks against
that pinned module. It requires an installed file resource and explicitly
rejects invented versions for static module handles. The historical
23-assertion synthetic-version claim below no longer describes current
behavior. Do not restore fabricated component versions merely to suppress
the warning. Next resolve actual installed DirectX component/resource
requirements; the hyperlink is a separate unsupported path, not gameplay.
Retain the original input files.
Logs, native input command, frames, file pins and artifact hashes are retained
in the run directory. No browser, server or Boat was provisioned.

## DirectX startup detection (historical)

The original `DirectX8.1 or newer not detected` message is at guest string
`0x474ec0`, used by the startup path around `0x42c700`. Version detection
`0x41cf90` tries COM DxDiag (`0x41d090`) then SDK-style component file
version checks (`0x41d2c0`). Registry DirectX Version overrides do not affect
that fallback. `0x41de30` performs GetFileVersionInfoSizeA,
GetFileVersionInfoA, and VerQueryValueA("\\") and reads VS_FIXEDFILEINFO.

The static system-module list omitted d3d8.dll and d3d9.dll despite runtime
implementation of their exports. Therefore named version queries failed. The fix appends their identities after the existing Glide identities (no
existing pseudo handles shift), recognizes their version resources, and
reports component generations 4.8.1.901 and 4.9.0.904. Legacy DirectPlay
remains 4.6.3.518. This fixes the actual API chain without changing guest
code or bypassing its detection. Extended `test-static-dx-version.js`
passes all 23 assertions using the compiled canonical artifact.

## Launch and rendering

Seed `grim.dll`, `vorbis.dll`, `vorbisfile.dll`, `ogg.dll`; include the whole
asset tree. DLL DllMain calls return success. The launcher Play button is
control ID 1000 (normal mouse around312,134). Default screen mode is
800x600x32. Startup now reaches this real launcher and its D3D8 adapter.

The first asset load spends time in grim.dll JPEG decoding: relocated
`0x6215b2` is original `0x100425b2`, YCbCr-to-RGB table conversion. `grim.dll` base in the observed run was0x5df000, original0x10000000. Do not interpret an early black frame as a stopped guest.

A software CLI run ended by explicit quit after369batches/276seconds;
154759ms was spent waiting on just four software D3D requests, so software
rendering is impractical for this capture on the loaded local machine. Native CLI reported that a GPU window was required. Browser GPU acceptance
is being pursued separately. No gameplay claim from these startup probes.

Browser verification on localhost58114 reached the renderer launcher and loading
artwork with two guest Workers; gameplay was not verified in the bounded run. Latest capture: `crimson-browser-live.png`.

## 2026-10-04: owning exit diagnostic, still no gameplay

All 61 declared fixture paths are present (hash inventory in
`scratch/new-game-crimsonland-20261004/static-audit.json`). Current direct launch
with ordinary visible Play at312,135 still exits to desktop. This was a diagnostic
with a private passive Worker import wrapper, not an uninstrumented baseline. Run: `scratch/runs/20261004-crimsonland-startup-exit1`; canonical WASM f40d4ca3,
host f2139768, private Worker76c8a73c derived from canonical3665f7c9. Browser/server session1512 closed cleanly02:20:05Z. GPU was enabled in browser
flags; actual WebGL rendering was not established before the exit.

The owning ExitProcess callback captures current_thread_id2 (1-based),
ESP0x31c7fb0, EBP0x31c7ff8, code0. Stack words at0x31c7fa8/0x31c7fb4/0x31c7fc4
are0x454e02/0x454d5b/0x454813. Exact mapped code around the first return matches
the pinned EXE at image base0x400000. This identifies CRT cleanup entered from
0x45480e in the thread wrapper's exception body0x454808, via0x454d4e/0x454d5f. The wrapper's scope table0x46f838 contains{-1,filter0x4547f4,body0x454808}.

Do not infer original exception code0: current src/11-seh.wat's nontrivial-filter
shortcut skips executing the filter that normally writes the exception code to
[EBP-0x20], and that captured local is0. The original fault location/code remains
unobserved. A focused next diagnostic should capture existing host.log_i32
CAE8C000/code/EIP triples emitted by raise_exception_access before the SEH walk,
with bounded owning registers/live code/DLL mappings. It needs no breakpoints,
trace flag, guest writes or speculative exception-handler repair.

## Original fault and DirectSound mapping hypothesis (2026-10-04)

Run scratch/runs/20261004-crimsonland-original-fault2 captures the existing
CAE8C000 / C0000005 / 43c544 owning log triple before SEH cleanup. Exact live
code matches the pinned EXE. At43c544 the EXE copies an audio buffer following
IDirectSoundBuffer::Lock (vtable+2c), then would call Unlock (+4c). Captured
source03c63d3c, destination08616004, byte count542ba, ECX150ae; app sound object
4c84e8 has PCM mono44100/16-bit format and DSBuffer wrapper08009298. This is
not proof of either operand's missing mapping, and the observer lacks DF/fault
address. No gameplay scene or FPS was obtained; browser/server closed cleanly.

Source candidate: Lock converts stored backing WA to a guest pointer using only
linear arithmetic, whereas CreateSoundBuffer allocates through heap_alloc and
stores g2w(buffer). Sparse heap allocations need the existing w2g inverse. The
observed destination corresponds to backing08228004 under the current formula,
inside the virtual backing arena. Actual backing/PTE/heap records remain needed
before assigning the failure to this candidate. See scratch/new-game-crimsonland-20261004/
mapping-plan.md. No shared engine edits or REP/SEH experiments were made.

### Mapping proof, attempt4

Immutable run scratch/runs/20261004-crimsonland-dsound-mapping4 confirms the
DirectSound pointer-contract error. Slot83/type5 stores344762bytes at WASM
0x08228004. Lock returns0x08616004, whose entire85-page span and endpoint map
to0xF0 with no PTE. Unique virtual record6 maps guest0x7e600000,size1MiB to
backing0x08228000, so the actual allocation payload is0x7e600004. All85 corrected
pages and endpoint map contiguously; source span is valid direct memory. Wrapper,
DX entry, map count and heap count rereads agree. Original fault remainsC0000005
at43c544; no fault-address/DF capture or REP implementation claim. Session17727
closed cleanly02:38:52.188Z, no gameplay. Attempt3's mapping observer failed on a
nonexistent NULL_SENTINEL region key; preserved as harness-limited, corrected and
tested against the actual region map before attempt4.

### Repaired production-shaped candidate reaches interactive tutorial

Run scratch/runs/20261004-crimsonland-gameplay-candidate1 uses isolated ordinary
production modulefa783563 (1664773bytes), compiled by tools/build-compile-wat.js
from exact current include closure, with no test exports or private Worker hooks. Canonical f40 artifact remains unchanged. DirectSound Lock now uses existing w2g. The actual-handler regression covers20cases over two instances, linear/sparse
allocations, offsets, ring wrap and ENTIREBUFFER. Before-source control fails
specifically on the sparse returned pointer after direct cases pass.

Visible Play opens loading screen and main menu, rather than prior immediate
thread exception/exit. PLAY GAME -> Tutorial reaches rendered terrain/player. Ordinary ArrowRight1000ms then ArrowDown800ms scrolls terrain and bonuses around
the centered player, and advances the tutorial movement instruction to bonus
pickup. Three reviewed gameplay images are in the published run. FPS remainsnull;
no combat/level completion or audio-quality qualification was performed.
