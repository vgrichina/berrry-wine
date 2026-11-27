# Civilization IV — base Windows demo

Investigated 2026-11-27 at main `36c1e6c12267e0cbd55b78dc543f780bffd29fff`
plus shared WIP. Source-discovery evidence:
`scratch/runs/20261127-civilization4-demo-root/`; completed root acquisition:
`scratch/runs/20261127-civilization-acquisition-root/`; full offline extraction
and PE evidence: `scratch/runs/20261127-civilization4-payload-root/`.
The complete ZIP was acquired and hashed by root, then independently rehashed
and its full InstallShield payload extracted offline by the payload worker.
Acquisition and extraction executed no supplied binaries. The subsequent first
emulator startup and its API failure are recorded below; no Windows installation
or Wine reference run was performed.

## Edition and provenance

The target is **Sid Meier's Civilization 4 Demo**, the base game's Windows demo
distributed in November 2005 by Firaxis / 2K Games. It provides the tutorial and
a 100-turn demo game. [CivFanatics' base-game page](https://civfanatics.com/civ4/)
identifies India, Rome, Inca and Greece and a technology cutoff at Divine Right.
[Worthplaying's contemporaneous distribution page](https://worthplaying.com/article/2005/11/23/news/29224-sid-meiers-civilization-iv-demo-available-now/)
dates the 314 MB demo to November 23, 2005 and identifies Firaxis and 2K Games.
[Gameswelt's November 30 report](https://www.gameswelt.de/civilization-iv/news/ja-wirklich-82014)
explicitly says distribution had been unofficial the preceding week and that
they could now legally offer it. Therefore November 23 is an observed early
distribution date, not an asserted publisher authorization date.

[Take-Two's October 25 publisher announcement](https://ir.take2games.com/static-files/ab986f83-80e8-46f5-b2a5-19acf06c9ac0)
establishes the base game's publisher/developer identity and retail release;
it is **not** a demo announcement. The original official demo/download site
`https://www.2kgames.com/civ4/downloads.htm` currently redirects to `https://2k.com/`
(HEAD there returned 404); a Wayback attempt also failed. No accessible original
publisher demo announcement or publisher-signed whole-file digest was recovered.

The available archival package independently identifies itself as the demo:
bounded ZIP-member inspection recovered `setup.ini` with:

```ini
AppName=Sid Meier's Civilization 4 Demo
CompanyName=Firaxis Games
ProductGUID=2A241A64-9AD1-4D94-A227-6C3D5D2F854D
EngineVersion=11.0.0.28844
```

Its InstallShield header names `Civ4DemoComponent`, five demo-language components,
`Demo.Civ4WorldBuilderSave`, and the target `Civilization4.exe`. Its English
readme links to 2K support and documents the original Windows requirements.
Together with historical authorized public distribution, this supports selecting
the **demo**, rather than retail media or a cracked release. These metadata checks
do not cryptographically authenticate every byte of the archival copy.
The extracted game version resource is measured below; InstallShield
11.0.0.28844 is an installer engine version, not the game's version.
Do not relabel this package v1.09/v1.74.

## Direct source and identity

Preferred reproducible URL:

<https://archive.org/download/SidMeiersCivilizationIvDemo/Civ4_Demo.zip>

[Item provenance](https://archive.org/details/SidMeiersCivilizationIvDemo) and
[machine-readable file metadata](https://archive.org/metadata/SidMeiersCivilizationIvDemo)
identify creator Firaxis Games, publisher 2K Games, year 2005, collection
`classicpcgames`, and an upload in June 2012. This is a preservation mirror,
not a current publisher-hosted binary.

| Field | Observed / advertised value |
| --- | --- |
| Filename | `Civ4_Demo.zip` |
| Exact size | **329,530,194 bytes** (314.2645 MiB) |
| HEAD result | 302 to `https://dn711105.ca.archive.org/0/items/SidMeiersCivilizationIvDemo/Civ4_Demo.zip`, then 200 |
| MIME | `application/zip` |
| Last-Modified | `Sun, 24 Jun 2012 07:29:54 GMT` (mirror timestamp) |
| ETag | `"4fe6c1f2-13a43b52"` (not a content hash) |
| Range proof | 206, `bytes 329464658-329530193/329530194`, 65,536 bytes |
| Archive-advertised MD5 | `87f735426aaf0acaa3e1a7c26b203c27` — not locally computed |
| Root-measured whole-file SHA-1 | `4fd521d55c312c357ed415e6b2e5ca49fa42e765` — also matches mirror metadata |
| Root-measured whole-file SHA-256 | `a4e125748ddf2ece6e25c91a8fc0ae68d833654d9abbd63bb92e68ca998d9ce1` |
| Acquisition | Complete, 2026-11-27 07:44:18.604 UTC; root receipt `civilization4-acquisition.json` |

Use the stable `archive.org/download/` URL; its redirect host may change.
The initial source worker's range inspection retained only 202,363 raw ZIP bytes: tail
65,536 + English-readme entry 10,337 + setup-INI entry 447 + data1-header entry
126,043. Root subsequently acquired all **329,530,194 bytes**. The payload
worker independently reproduced the SHA-1/SHA-256 above from that full file.
The archive and adjacent extracted cabinets remain root-owned, read-only to
this worker, at `/dev/shm/wine-civilization-acquisition-20261127-root/`.
These are volatile local media, not a persistent corpus fixture or publisher
authentication. No archive was copied to `/home` or Git.

Other copies must retain separate identities:

* [ModDB Windows demo](https://www.moddb.com/games/civilization-iv-original/downloads/civilization-iv-windows-demo)
  lists `Civilization4_Demo.zip`, **329,531,718 bytes**, MD5
  `49f7fd527e0f8eff0b910a822227ad2e`, uploaded September 24, 2016.
  Its `/downloads/start/111635` endpoint returned a Cloudflare challenge to curl.
  The listing says official demo, but those are page claims; the archive is
  **1,524 bytes larger** than the preferred copy. Do not mix their hashes.
* [Uptodown](https://civilization.en.uptodown.com/windows/download) advertises a
  314.27 MB ZIP dated November 24, 2005 with SHA-256
  `cd8be99bd2c053d667a89d08338e25c24b658798a10f318623866f4cafaaeaad`.
  This was web-page metadata only; no binary identity or direct transfer verified.
* [Winetricks 20210206 source](https://github.com/Winetricks/winetricks/blob/20210206/src/winetricks#L17999)
  documents another `Civilization4_Demo.zip` from CNET with a different advertised
  SHA-256, `aaafc7fcbf0fc16c9b28c2422400721a40818b867e9291268877c5d3841122a2`.
  It corroborates `setup.exe` and the installation path; it was only read as
  source, never executed. That digest also must not be applied to the Archive copy.

## Package, extraction and runtime

The ZIP's central directory was inspected, not inferred from its extension.
It contains `setup.exe`, `setup.ini`, `setup.inx`, `setup.ibt`, `setup.isn`,
`layout.bin`, `engine32.cab`, `data1.hdr`, `data1.cab`, `data2.cab`, five localized
readmes, and `DirectX9/` redistributable files including
`Jun2005_d3dx9_26_x86.cab` and `Jun2005_d3dx9_26_x64.cab`.

This is **ZIP → InstallShield 11 installer/cabinet media**, not a portable game.
Unzip all files together. `setup.exe` is the installer, not the game.
Installed runtime: **`Civilization4.exe`**, with expected Windows path
`C:\Program Files\Firaxis Games\Sid Meier's Civilization 4 Demo\Civilization4.exe`
(or `Program Files (x86)` on 64-bit Windows). The basename is confirmed in the
cabinet metadata and now actual extracted PE bytes. Install behavior remains
unmeasured. Do not substitute `Civ4BeyondSword.exe`.

The header also names `binkw32.dll`, `Mss32.dll`, `python24.dll`,
`boost_python-vc71-mt-1_32.dll`, `hapdbg.dll`, `vort_dls.dll`, `zlib1.dll` and
asset/script trees. Preserve the complete installed layout, not just the EXE.
Guest-supplied scripting data are part of the game; no Python tooling is needed
or authorized for this acquisition workflow.

Primary package readme requirements: Windows 2000/XP; Pentium 4/Athlon equivalent
1.2 GHz; 256 MB RAM on Windows 2000 or 512 MB on XP; **1.7 GB free space**;
64 MB DirectX 9.0c-compatible graphics with hardware T&L (GeForce 2/Radeon 7500
or better); compatible sound. It lists Windows 2000 SP1+ with IE6+ and XP
Home/Professional SP1+. These are readme requirements, not measured installation
size or proof of modern-host/emulator compatibility. The included June 2005
D3DX9_26 payload is concrete prerequisite evidence; no DLL loading was tested.

## Measured offline extraction and recovery

The payload worker performed no download. Root's acquisition receipt records
the URL, completed size and hashes above. To recover lost volatile media, acquire
that exact URL into an owner-approved destination, then verify size, SHA-1 and
SHA-256 before extracting. The earlier MD5 remains mirror metadata only.
The offline extraction below **was executed successfully**, using `7z` for the
ZIP prerequisite and root-prepared adjacent `data1.cab`, `data1.hdr`, `data2.cab`
for `unshield`. Root had already prepared those three members with `7z`.
For reconstruction from only the ZIP, first run:

```bash
7z x Civ4_Demo.zip -ociv4-demo-installer data1.cab data1.hdr data2.cab
unshield l civ4-demo-installer/data1.cab > cab-list.txt
unshield -d civ4-demo-payload x civ4-demo-installer/data1.cab
# Use the retained, reviewed Node script from the payload evidence directory:
node restore-cab-paths.cjs cab-list.txt civ4-demo-payload
7z x Civ4_Demo.zip -ociv4-demo-prerequisite DirectX9/Jun2005_d3dx9_26_x86.cab
cabextract -d civ4-demo-d3dx-x86 civ4-demo-prerequisite/DirectX9/Jun2005_d3dx9_26_x86.cab
```

Save the following as `restore-cab-paths.cjs` before running the recipe. It is
the same script used for the measured extraction:

```js
// Restore directory names sanitized by unshield 1.5.1. No guest execution.
// Usage: node restore-cab-paths.cjs CAB_LIST PAYLOAD_DIR
const fs=require('fs'),path=require('path');
const [list,dir]=process.argv.slice(2);
if(!list||!dir)throw Error('Usage: node restore-cab-paths.cjs CAB_LIST PAYLOAD_DIR');
const root=fs.realpathSync(dir),entries=[],targets=new Set();
for(const l of fs.readFileSync(list,'utf8').split('\n')){
 const m=l.match(/^\s+(\d+)\s+(.+\\.+)$/);if(!m)continue;
 const parts=m[2].split('\\'),name=parts.pop();
 const raw=[...parts,name].join('/');
 if([...parts,name].some(p=>p==='.'||p==='..'||p.includes('/')))throw Error('unsafe path');
 const normalized=parts.map(p=>p.replace(/[<>\[\] ]/g,'_')).concat(name).join('/');
 const src=path.join(root,normalized),dst=path.join(root,raw);
 if(targets.has(dst))throw Error('duplicate destination');targets.add(dst);
 const st=fs.lstatSync(src);if(!st.isFile()||st.size!==+m[1])throw Error('source mismatch '+src);
 if(src!==dst&&fs.existsSync(dst))throw Error('destination exists '+dst);
 entries.push({src,dst,bytes:st.size});
}
if(entries.length!==3484)throw Error('unexpected package file count');
let moved=0;for(const e of entries)if(e.src!==e.dst){fs.mkdirSync(path.dirname(e.dst),{recursive:true});fs.renameSync(e.src,e.dst);moved++;}
for(const e of entries)if(fs.statSync(e.dst).size!==e.bytes)throw Error('post-rename mismatch');
console.log(JSON.stringify({files:entries.length,moved,bytes:entries.reduce((a,e)=>a+e.bytes,0),method:'rename only; no duplicate payload bytes'},null,2));
```

Keep both cabinets and header adjacent. **Restore the directory names**:
`unshield` 1.5.1 sanitizes spaces and special characters in directory paths,
affecting 145 files including 99 common-group files under
`Assets/Sounds/Resouces and Improvements/`. An actual `-R` extraction produced
the same sanitized paths; that option alone is insufficient. The initial
default output was removed before the `-R` extraction, preserving the cap.
Both extractions returned exit 0. The retained `restore-cab-paths.cjs` validates
the original cabinet list, rejects collisions and unsafe paths, and renames
files without copying payload bytes. It restored all 145 paths. Final
validation compares **all 3,484 paths and sizes** against the original listing;
the per-file hash manifest records those restored paths. Extraction yielded
**3,484 files / 456,038,220 logical bytes** including installer support groups
and zero-byte placeholders. `payload-files.json` records each path, size and
SHA-256. The game group `Civ4DemoComponent` contains **3,433 files /
447,363,916 bytes**. Its contents belong at the game root, preserving `Assets/`,
`Mods/`, `PublicMaps/`, `Resource/` and `Shaders/`; do not flatten their basenames
or treat the installer support groups as game files. Each of the five language
groups contains one distinct 524,416-byte
`Assets/Art/Interface/Screens/Purchase/BuyIt.dds`, absent from the common group.
Select one language overlay (for example `Civ4DemoEnglish`) for reconstruction;
the inferred merge is a layout recipe, not a tested installer-equivalent install.

Full extraction went only to the worker-owned
`/dev/shm/wine-civilization4-payload-20261127/`, after measuring 2,462,142,464
bytes free there; combined own extracted output remained below **800 MB**.
`/home` remained above 1.5 GB; only bounded metadata evidence was stored there.
No guest assets are tracked. Volatile output is recoverable from the pinned
ZIP, these commands and the per-file manifest; its continued availability is
not guaranteed.

### Actual game PE

| Field | Measured value |
| --- | --- |
| File | `Civ4DemoComponent/Civilization4.exe` |
| Size | 12,357,632 bytes |
| SHA-256 | `1d823338909fb25caa91fac4d4cfc038e7dae52da21fbb801f6d69defadeeec8` |
| Format | PE32 GUI, Intel i386 (`0x14c`), six sections |
| Image base / entry RVA | `0x400000` / `0x738814` |
| Fixed file / product version | `0.21.1.0` / `0.21.0.1688` |
| String FileVersion / ProductVersion | Both `0, 21, 0, 1688, (40976)` |

Keep the fixed and string version fields distinct; the apparent disagreement
exists in the actual resource. `tools/pe-version.js` and `tools/pe-imports.js
--all` produced the retained version and complete symbol-import evidence.
The EXE has 21 static DLL descriptors, and no delay-import descriptors:

```text
boost_python-vc71-mt-1_32.dll hapdbg.dll zlib1.dll GDI32.dll binkw32.dll
WS2_32.dll MSVCP71.dll VERSION.dll python24.dll MSVCR71.dll WSOCK32.dll
ADVAPI32.dll KERNEL32.dll USER32.dll ole32.dll SHELL32.dll OLEAUT32.dll
WINMM.dll d3dx9_26.dll mss32.dll DSOUND.dll
```

### Prerequisite closure remains incomplete

The common group supplies the game-side Python 2.4, Boost, Bink, Miles,
Hap and zlib DLLs plus `vort_dls.dll`, scripts, XML and packed art. The ZIP's
included x86 D3DX cabinet extracted successfully: `d3dx9_26.dll` is
**2,297,552 bytes**, PE32/i386, with string version `9.07.239.0000`
(fixed file `9.7.1.0`, product `9.7.239.0`). `cabextract` reported possible
6,848 trailing bytes, then completed without errors; this is not a signature
verification. Select x86 for this i386 game, not the included x64 cabinet.

**Both MSVCR71.dll and MSVCP71.dll are included**, inside `MsiData1.cab` in
the embedded `Sid Meier's Civilization 4 Demo.msi`. The earlier absence claim
only inspected outer filenames and missed this nested cabinet. Recovery from
the pinned original ZIP was measured in
`scratch/runs/20261127-civilization4-msi-runtime-root/`:

| File | Bytes | Version string | SHA-256 |
| --- | ---: | --- | --- |
| `msvcr71.dll` | 348160 | 7.10.3052.4 | `8094af5ee310714caebccaeee7769ffb08048503ba478b879edfef5f1a24fefe` |
| `msvcp71.dll` | 499712 | 7.10.3077.0 | `df96156f6a548fd6fe5672918de5ae4509d3c810a57bffd2a91de45a3ed5b23b` |

Both are i386 PE32. Their exports match all 145 MSVCR71 and 72 MSVCP71
exact-name imports from the game EXE; the latter DLL's 93 CRT imports also
match the recovered MSVCR71 exports. This establishes static symbol coverage,
not execution compatibility. No external runtime download is needed for this
pair. Neither PE contains an embedded Authenticode certificate; these hashes
identify the recovered bytes and do not authenticate their publisher.

With the three original InstallShield cabinet/header files adjacent, recover
the nested MSI and two DLLs without executing any installer:

```bash
unshield -j -d civ4-demo-msi x civ4-demo-installer/data1.cab '*.msi'
7z e -ociv4-demo-crt "civ4-demo-msi/Sid Meier's Civilization 4 Demo.msi" \
  FL_msvcr71_dll_3_____X86.3643236F_FC70_11D3_A536_0090278A1BB8 \
  FL_msvcp71_dll_2_____X86.3643236F_FC70_11D3_A536_0090278A1BB8
mv civ4-demo-crt/FL_msvcr71_dll_3_____X86.3643236F_FC70_11D3_A536_0090278A1BB8 civ4-demo-crt/msvcr71.dll
mv civ4-demo-crt/FL_msvcp71_dll_2_____X86.3643236F_FC70_11D3_A536_0090278A1BB8 civ4-demo-crt/msvcp71.dll
```

The MSI is 2089984 bytes, SHA-256
`e8b6f5d9b0db540ad0eb34abb62bf492802b1dc0911e00d536a1a5442edff11a`.
Its File/Component tables target both CRT DLLs to `INSTALLDIR`, with no
component condition, in the selected feature. The outer installer's evaluated
absolute target and stage order remain unmeasured. The MSI also includes
conditional MSXML3 components; the separate DirectX INF targets the Windows
system directory. Do not infer that every nested component belongs beside the
game EXE. Setup-table evidence is retained in
`scratch/runs/20261127-civilization4-setup-sequence-root/`.

A static scan of all 40 common-group EXE/DLL/PYD files, plus D3DX,
finds `python23.dll` missing for bundled wx
`_iewin.pyd` and `_ogl.pyd`; `_iewin.pyd` additionally imports absent
`MSVCP60.dll`. Whether those older optional modules execute is unknown. The
remaining unresolved names are Windows platform DLLs listed in
`dependency-closure.json`; they still require a compatible OS/emulator surface.
File presence alone does not establish loader search paths, symbol coverage,
dynamic loads, Direct3D capability, registry/settings creation or runtime closure.
No substitute DLLs were downloaded or copied from unrelated fixtures.

One actual bounded emulator startup was subsequently performed with the
complete common payload, one English overlay, original x86 D3DX and the two
recovered CRT DLLs mounted app-local. The clean published WASM was 2553420
bytes, SHA-256
`11a470569b6decdc5cd9527ca1513d23c156bdd6cdf6a9faddf5271e2e162cff`;
existing dirty host/harness bytes were pinned separately. Both CRT DLLs and
D3DX mapped, the eleven invoked DLL entry points returned 1, and the game
read its bundled font. Startup then **failed in batch 1 on unimplemented
`SendMessageCallbackA`**, EIP `0x00823ec1`, exit 1. No meaningful screen or menu
was observed. This reconstructed VFS is not a measured Windows installation.
Evidence: `scratch/runs/20261127-civilization4-first-startup-root/`.

Offline extraction is reproducible, but a runnable installation and prerequisite
closure are **not established**. Keep corpus acquisition/manual status separate
from installed-fixture/runtime status. Any reference behavior must come from an
owner-provided real Windows VM, never Wine. No retail key/disc requirement was
observed or tested for this demo.

## Beyond the Sword is a different target

The [current official Steam storefront](https://store.steampowered.com/app/8800/Civilization_IV_Beyond_the_Sword/)
calls Beyond the Sword the second expansion and links its demo to
`steam://install/8820`. This is **not the base demo**, even when a search result
shortens its title to Civilization IV demo. Current HTML records demo app 8820.

[July 25, 2007 reporting](https://www.gameswelt.de/civilization-iv/news/neues-level-zum-anspielen-86804)
distinguishes two expansion demos: roughly 717 MB Final Frontier (75 turns) and
586 MB Charlemagne (100 turns). Neither matches the 2005 base-demo package.
Do not use Steam app 8820, a Warlords/Colonization package, expansion patches,
or full retail/Complete media as a substitute for this corpus candidate.

## Scope and handoff

Acquisition, complete raw extraction, PE identity, language overlay and original
CRT recovery are measured. The nested-MSI recovery supersedes the initial
07:49:39 UTC missing-runtime report. The first emulator startup exposed the
API failure above; an installed fixture, full prerequisite closure, menu and
gameplay remain unverified. No boxes were created. Corpus entries retain
manual preparation status until a complete fixture is established.
