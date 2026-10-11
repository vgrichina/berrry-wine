// Shared process boot steps for both hosts (CLI test/run.js and browser index.html).
//
// The DLL set an app needs was worked out twice, and the two answers differed:
// the CLI walked the whole dependency graph (Kodak Imaging's IMGCMN imports
// OIFIL400, which imports its siblings), while the browser resolved only the
// EXE's own import directory. An app therefore booted headless and trapped in
// the browser on the first cross-DLL ordinal, with neither host saying why.
//
// Both hosts now call resolveDllGraph() and supply only a `loadSpec` callback
// that turns a name (or a host-specific spec such as a URL or file path) into
// { name, bytes } — fs.readFileSync over the search dirs for the CLI, fetch()
// over lib/dll-registry.js's URL map for the browser.

'use strict';

const dllReg = (typeof require === 'function')
  ? require('./dll-registry')
  : (typeof window !== 'undefined' ? window.dllRegistry : null);

// Files installed by Windows itself that are data rather than loadable DLLs.
// Keep this list shared by the CLI and browser boot paths just like DLL_PATHS;
// otherwise a guest type library can resolve in one host and fail in the
// other. stdole2 is the standard OLE Automation type library referenced by
// newer typelibs (including InstallShield 11's isprobe.tlb).
//
// localOnly: a Microsoft system file tools/deploy-berrry.js does not publish.
// The browser skips it on a deployed site rather than fetching a known 404
// (and its .part000 retry) on every launch; nothing on the live desktop needs
// it — its one consumer so far is InstallShield 11 (Black & White 2 setup).
const SYSTEM_DATA_FILES = [
  { url: 'test/binaries/tlbs/stdole2.tlb', vfsPath: 'c:\\windows\\system\\stdole2.tlb', localOnly: true },
];

function mountSystemDataFiles(vfs, files) {
  if (!vfs || !vfs.files) return 0;
  // Both hosts call this once at boot, so it is also where the Win16 system
  // modules (defined below) become files.
  let mounted = mountWin16SystemModules(vfs) + mountDirectXSystemModules(vfs);
  for (const file of files || []) {
    if (!file || !file.vfsPath || !file.bytes) continue;
    vfs.files.set(String(file.vfsPath).toLowerCase(), {
      data: file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file.bytes),
      attrs: 0x20,
    });
    mounted++;
  }
  return mounted;
}

// The 16-bit system modules the emulator answers for itself
// ($win16_module_id's fixed ids). On an installed Win9x machine each is a file
// in C:\WINDOWS\SYSTEM, and apps probe for them by path before deciding what
// to use: Authorware (Civilization II's Civilopedia) _lopen's
// SYSTEM\MMSYSTEM.DLL and, if that fails, never looks up waveOut at all and
// later far-calls through the null pointer it left behind. The loader never
// reads these files -- the module ids resolve before any file is consulted --
// so each is a minimal but well-formed NE header naming the module, enough for
// anything that opens it to see a real 16-bit library.
const WIN16_SYSTEM_MODULE_FILES = [
  ['KRNL386.EXE', 'KERNEL'], ['USER.EXE', 'USER'], ['GDI.EXE', 'GDI'],
  ['KEYBOARD.DRV', 'KEYBOARD'], ['SOUND.DRV', 'SOUND'], ['SHELL.DLL', 'SHELL'],
  ['MMSYSTEM.DLL', 'MMSYSTEM'], ['COMMDLG.DLL', 'COMMDLG'],
];

function win16ModuleStub(moduleName) {
  const NE = 0x40;
  const HDR = 0x40;
  const nameBytes = Array.from(moduleName, ch => ch.charCodeAt(0) & 0xff);
  const resident = [nameBytes.length, ...nameBytes, 0, 0, 0];
  const residentOff = HDR;                        // segment + resource tables are empty
  const modrefOff = residentOff + resident.length;
  const importOff = modrefOff;                    // no module references
  const entryOff = importOff + 1;                 // imported-names table is one NUL
  const nonresOff = entryOff + 2;                 // entry table: one empty bundle
  const nonres = [nameBytes.length, ...nameBytes, 0, 0, 0];
  const bytes = new Uint8Array(NE + nonresOff + nonres.length);
  const dv = new DataView(bytes.buffer);
  bytes[0] = 0x4d; bytes[1] = 0x5a;               // MZ
  dv.setUint32(0x3c, NE, true);
  bytes[NE] = 0x4e; bytes[NE + 1] = 0x45;         // NE
  bytes[NE + 2] = 5; bytes[NE + 3] = 10;          // linker 5.10
  dv.setUint16(NE + 0x04, entryOff, true);
  dv.setUint16(NE + 0x06, 2, true);
  dv.setUint16(NE + 0x0C, 0x8000, true);          // library module
  dv.setUint16(NE + 0x20, nonres.length, true);
  dv.setUint16(NE + 0x22, HDR, true);             // segment table (0 entries)
  dv.setUint16(NE + 0x24, residentOff, true);     // resource table == resident: none
  dv.setUint16(NE + 0x26, residentOff, true);
  dv.setUint16(NE + 0x28, modrefOff, true);
  dv.setUint16(NE + 0x2A, importOff, true);
  dv.setUint32(NE + 0x2C, NE + nonresOff, true);  // absolute file offset
  bytes[NE + 0x36] = 2;                           // target OS: Windows
  dv.setUint16(NE + 0x3E, 0x030A, true);          // expects Windows 3.10
  bytes.set(resident, NE + residentOff);
  bytes.set(nonres, NE + nonresOff);
  return bytes;
}

// Never replaces a file already mounted at that path (an app that ships its
// own copy, or a test mounting real bytes).
function mountWin16SystemModules(vfs) {
  if (!vfs || !vfs.files) return 0;
  let mounted = 0;
  for (const [file, module] of WIN16_SYSTEM_MODULE_FILES) {
    const key = 'c:\\windows\\system\\' + file.toLowerCase();
    if (vfs.files.has(key)) continue;
    vfs.files.set(key, { data: win16ModuleStub(module), attrs: 0x20 });
    mounted++;
  }
  return mounted;
}

// The DirectX DLLs the emulator dispatches statically ($STATIC_SYS_DLL_NAMES'
// DirectX range in src/01-header.wat). Installers decide whether DirectX is
// present by looking for the file before they read its version: NFS II's
// InstallShield script tests GetFileAttributes("C:\WINDOWS\SYSTEM\DDRAW.DLL"),
// and when that failed it reported "No versions of DirectX have been detected"
// and offered to run DirectX 3 setup on a machine that answers DirectX 6.1a.
//
// Each file is a minimal PE DLL with no code and one RT_VERSION resource
// holding the same VS_FIXEDFILEINFO as $DX_VERSION_INFO (4.06.03.0518), so a
// version read that goes to the file (GetFileVersionInfoW has no by-name
// answer) agrees with the one GetFileVersionInfoA gives by name. The entries
// are marked `staticModule`: has_dll_file skips them, so LoadLibrary of the
// full path keeps resolving to the static module instead of mapping this stub.
//
// D3D8.DLL is a file only (no by-name entry): we implement Direct3D 8, and the
// DirectX SDK's GetDXVersion sample -- which games ship -- decides "8.1 or
// newer" by d3d8.dll's file version alone (>= 4.08.01.0881) once the DxDiag
// provider is unavailable. Without the file Crimsonland refused to start with
// "DirectX8.1 or newer not detected". The DirectPlay8 and Direct3D 9 files
// (dpnet.dll, d3d9.dll) are deliberately absent: a game that finds them may
// switch to a path we do not provide (DirectPlay8) or have not chosen to claim.
//
// OPENGL32.DLL is here for the same reason as the DirectX files, though it is
// not DirectX: we dispatch it statically, and a game may look for the file
// before loading it. Serious Sam's Engine SearchPathA's OPENGL32.DLL (then
// 3DFXVGL.DLL) and, finding neither, reported "Cannot set display mode! ...
// unable to find display mode with OpenGL acceleration". It carries Win98
// SE's own version, not a DirectX one.
const DIRECTX_SYSTEM_MODULE_FILES = ['DDRAW.DLL', 'DSOUND.DLL', 'DPLAYX.DLL', 'D3DRM.DLL', 'D3D8.DLL',
  'OPENGL32.DLL'];
// File version per stub as [major, minor, build, private]; 6.1a (Win98 SE)
// unless listed. 4.08.01.0881 is the DirectX 8.1 runtime's d3d8.dll.
const DIRECTX_MODULE_VERSIONS = { 'D3D8.DLL': [4, 8, 1, 881], 'OPENGL32.DLL': [4, 10, 0, 2222] };
const DIRECTX_DEFAULT_VERSION = [4, 6, 3, 518];

function directXVersionInfo(version = DIRECTX_DEFAULT_VERSION) {
  const blob = new Uint8Array(92);
  const dv = new DataView(blob.buffer);
  dv.setUint16(0, 92, true);                      // wLength
  dv.setUint16(2, 52, true);                      // wValueLength
  const key = 'VS_VERSION_INFO';
  for (let i = 0; i < key.length; i++) dv.setUint16(6 + i * 2, key.charCodeAt(i), true);
  const [major, minor, build, priv] = version;
  const ms = ((major << 16) | minor) >>> 0, ls = ((build << 16) | priv) >>> 0;
  const fixed = [0xFEEF04BD, 0x00010000, ms, ls, ms, ls,
    0x3f, 0, 4 /* VOS__WINDOWS32 */, 2 /* VFT_DLL */, 0, 0, 0];
  fixed.forEach((v, i) => dv.setUint32(40 + i * 4, v, true));
  return blob;
}

function directXModuleStub(file) {
  const RSRC_FILE = 0x200;
  const RSRC_RVA = 0x1000;
  const version = directXVersionInfo(
    DIRECTX_MODULE_VERSIONS[String(file || '').toUpperCase()] || DIRECTX_DEFAULT_VERSION);
  const rsrcSize = 0x58 + version.length;
  const bytes = new Uint8Array(RSRC_FILE + 0x200);
  const dv = new DataView(bytes.buffer);
  bytes[0] = 0x4d; bytes[1] = 0x5a;               // MZ
  dv.setUint32(0x3c, 0x40, true);
  bytes.set([0x50, 0x45, 0, 0], 0x40);            // PE\0\0
  dv.setUint16(0x44, 0x14c, true);                // i386
  dv.setUint16(0x46, 1, true);                    // one section
  dv.setUint16(0x54, 0xE0, true);                 // optional header size
  dv.setUint16(0x56, 0x2102, true);               // DLL | 32-bit | executable
  const opt = 0x58;
  dv.setUint16(opt, 0x10b, true);                 // PE32
  dv.setUint32(opt + 28, 0x10000000, true);       // ImageBase
  dv.setUint32(opt + 32, 0x1000, true);           // SectionAlignment
  dv.setUint32(opt + 36, 0x200, true);            // FileAlignment
  dv.setUint16(opt + 40, 4, true);                // OS 4.0
  dv.setUint16(opt + 48, 4, true);                // subsystem 4.0
  dv.setUint32(opt + 56, 0x2000, true);           // SizeOfImage
  dv.setUint32(opt + 60, RSRC_FILE, true);        // SizeOfHeaders
  dv.setUint16(opt + 68, 2, true);                // Windows GUI
  dv.setUint32(opt + 92, 16, true);               // NumberOfRvaAndSizes
  dv.setUint32(opt + 96 + 2 * 8, RSRC_RVA, true); // resource directory
  dv.setUint32(opt + 96 + 2 * 8 + 4, rsrcSize, true);
  const sec = opt + 0xE0;
  bytes.set([0x2e, 0x72, 0x73, 0x72, 0x63], sec); // .rsrc
  dv.setUint32(sec + 8, rsrcSize, true);
  dv.setUint32(sec + 12, RSRC_RVA, true);
  dv.setUint32(sec + 16, 0x200, true);
  dv.setUint32(sec + 20, RSRC_FILE, true);
  dv.setUint32(sec + 36, 0x40000040, true);       // initialized data, readable
  // Type 16 (RT_VERSION) -> id 1 -> language 0x409 -> the data entry.
  const dir = (at, id, target) => {
    dv.setUint16(RSRC_FILE + at + 14, 1, true);   // one id entry
    dv.setUint32(RSRC_FILE + at + 16, id, true);
    dv.setUint32(RSRC_FILE + at + 20, target, true);
  };
  dir(0x00, 16, 0x80000018);
  dir(0x18, 1, 0x80000030);
  dir(0x30, 0x409, 0x48);
  dv.setUint32(RSRC_FILE + 0x48, RSRC_RVA + 0x58, true);
  dv.setUint32(RSRC_FILE + 0x4c, version.length, true);
  bytes.set(version, RSRC_FILE + 0x58);
  return bytes;
}

// The guest-filesystem half of a CLI LoadLibrary lookup: the exact VFS path
// first (a bare LoadLibraryA("lang.dll") is relative to the current
// directory, and keys are case-folded), then the usual fallbacks. A DirectX
// system-file stub (mountDirectXSystemModules, staticModule) stands for a
// module the emulator dispatches itself and has no code or exports: mapping it
// as a DLL zeroed every DDRAW import of NFS III's softtria.dll/d3da.dll and the
// game jumped to 0 at boot. The browser's has_dll_file already skips these.
function findVfsDllBytes(vfs, fileName, fullName) {
  if (!vfs || !vfs.files) return null;
  let resolved = '';
  try { resolved = vfs._resolvePath(fullName); } catch (_) {}
  const usable = entry => entry && entry.data && !entry.staticModule ? entry.data : null;
  const own = resolved && usable(vfs.files.get(resolved));
  if (own) return own;
  for (const p of [String(fullName).toLowerCase(), 'c:\\' + fileName,
    'c:\\plugins\\' + fileName, 'c:\\windows\\system\\' + fileName]) {
    const hit = usable(vfs.files.get(p));
    if (hit) return hit;
  }
  return null;
}

function mountDirectXSystemModules(vfs) {
  if (!vfs || !vfs.files) return 0;
  let mounted = 0;
  for (const file of DIRECTX_SYSTEM_MODULE_FILES) {
    const key = 'c:\\windows\\system\\' + file.toLowerCase();
    if (vfs.files.has(key)) continue;
    vfs.files.set(key, { data: directXModuleStub(file), attrs: 0x20, staticModule: true });
    mounted++;
  }
  return mounted;
}

// seeds       — host-specific specs to load first, in order, whatever the
//               EXE's imports say (the browser's per-app `dlls` list, which
//               carries app-local DLLs the registry cannot name).
// loadSpec    — async (spec) => { name, bytes } | null. Returning null means
//               "not shipped here", and the walk simply skips it.
// isLoadable  — (name) => bool; defaults to the shared registry's list, which
//               is what separates "load this as a real PE" from "let the WAT
//               stub handlers answer for it".
// onMissing   — (name, spec) => void; a seed or loadable DLL loadSpec could
//               not find.
async function resolveDllGraph(opts) {
  const {
    exeBytes = null,
    seeds = [],
    loadSpec,
    detectRequiredDlls,
    isLoadable = (dllReg && dllReg.isLoadableDll) || (() => true),
    onLog = null,
    onMissing = null,
  } = opts || {};

  const configs = [];
  const queued = new Set();
  const queue = [];

  const depsOf = (bytes) => {
    if (!detectRequiredDlls || !bytes) return [];
    try { return detectRequiredDlls(bytes) || []; } catch (_) {
      // A DLL we cannot parse simply contributes no dependencies.
      return [];
    }
  };

  const take = async (spec, { checkLoadable }) => {
    const nameHint = String(spec).split(/[\\/]/).pop();
    if (queued.has(nameHint.toLowerCase())) return;
    if (checkLoadable && !isLoadable(nameHint)) return;
    let cfg = null;
    try { cfg = await loadSpec(spec); } catch (e) {
      if (onLog) onLog(`DLL ${nameHint}: ${e && e.message ? e.message : e}`);
      return;
    }
    if (!cfg || !cfg.bytes) {
      // A DLL the registry says to load as a real PE, or a seed the app
      // names, that is not on disk: its imports fall to WAT stubs, and an
      // ordinal import from it later crashes as "<ord>" with nothing tying
      // it back here. test/binaries/dlls is gitignored, so a fresh worktree
      // has none of them.
      if (onMissing) onMissing(nameHint, spec, { seed: !checkLoadable });
      return;
    }
    const key = String(cfg.name || nameHint).toLowerCase();
    if (queued.has(key)) return;
    queued.add(key);
    queued.add(nameHint.toLowerCase());
    configs.push(cfg);
    for (const dep of depsOf(cfg.bytes)) {
      if (!queued.has(String(dep).toLowerCase())) queue.push(dep);
    }
  };

  for (const seed of seeds) await take(seed, { checkLoadable: false });

  const required = depsOf(exeBytes);
  if (required.length && onLog) onLog(`Detected DLLs: ${required.join(', ')}`);
  // Old MFC builds import their matching CRT during DllMain, so msvcrt20 has
  // to come first even when the import directory lists MFC first.
  const ordered = dllReg && dllReg.orderDlls ? dllReg.orderDlls(required) : [...required];
  queue.push(...ordered);

  while (queue.length) await take(queue.shift(), { checkLoadable: true });

  return configs;
}

// A loaded module is also a file in an installed Windows tree. Keep the
// authentic bytes visible at both the app-directory compatibility alias and
// the Win9x system directory so SearchPath/CreateFile/resource extraction can
// reopen the module after the PE loader has mapped it.
function mountLoadedDllFiles(vfs, configs) {
  if (!vfs || !vfs.files) return 0;
  let mounted = 0;
  for (const config of configs || []) {
    if (!config || !config.name || !config.bytes) continue;
    const name = String(config.name).split(/[\\/]/).pop().toLowerCase();
    const entry = { data: config.bytes, attrs: 0x20 };
    vfs.files.set('c:\\' + name, entry);
    vfs.files.set('c:\\windows\\system\\' + name, entry);
    mounted++;
  }
  return mounted;
}

// Copy the EXE into the staging buffer and hand it to the WAT loader.
//
// Self-extracting installers append their archive after the PE image, so the
// file can be far larger than the loader needs. The staging buffer sits below
// emulator-private tables — the API hash table among them — and an unbounded
// copy walks straight through them, after which every import resolves to
// api_id 0xFFFF and the app dies on its first call. Both hosts had their own
// transcription of that clamp.
function mzImageSignature(bytes) {
  if (!bytes || bytes.length < 0x40 || bytes[0] !== 0x4d || bytes[1] !== 0x5a) return '';
  const offset = (bytes[0x3c] | (bytes[0x3d] << 8) |
    (bytes[0x3e] << 16) | (bytes[0x3f] << 24)) >>> 0;
  if (offset + 2 > bytes.length) return '';
  return String.fromCharCode(bytes[offset], bytes[offset + 1]);
}

function stagePe(exports, memoryBuffer, exeBytes, log) {
  const say = log || ((m) => console.log(m));
  const staging = exports.get_staging();
  const cap = exports.get_staging_size();
  const staged = Math.min(exeBytes.length, cap);
  const signature = mzImageSignature(exeBytes);
  let image = null;
  let overlaySections = null;
  let stagedBytes = exeBytes.subarray(0, staged);
  if (staged < exeBytes.length) {
    if (signature === 'NE') {
      // Win16 installers commonly append a large compressed archive to a
      // small NE launcher. The NE loader consumes the header, segments and
      // resources from the staged prefix; the program reopens its full file
      // through the VFS when it needs the appended payload.
      say(`[ne] staging ${staged} of ${exeBytes.length} bytes ` +
        `(buffer is ${cap}); appended self-extractor data stays in the VFS`);
    } else {
      say(`[pe] staging ${staged} of ${exeBytes.length} bytes ` +
        `(buffer is ${cap}); mapping PE section tails directly`);
      const pe = (typeof require === 'function')
        ? require('./pe')
        : (typeof window !== 'undefined' ? window.peLib : null);
      if (!pe || typeof pe.readPE !== 'function') {
        throw new Error('PE section reader is unavailable for an oversized executable');
      }
      image = pe.readPE(exeBytes);

      // WinZip-style SFX launchers put the appended ZIP in one final,
      // discardable PE section and reopen their own file to read it. Mapping a
      // very large overlay into our fixed direct-image arena would overwrite
      // PE_STAGING and the runtime regions beyond it before load_pe can read
      // the MZ header. Keep that exact final overlay in the VFS and present a
      // launcher-only image to the WAT loader.
      const stagingEnd = staging + cap;
      const guestBase = exports.get_guest_base() >>> 0;
      overlaySections = new Set(image.sections.filter(section => {
        const mappedSize = Math.max(section.vsize, section.rawSize);
        const destination = guestBase + section.rva;
        return !!(section.chr & 0x02000000) && section.rawOff > 0 &&
          section.rawSize > 0 && section.rawOff + section.rawSize === exeBytes.length &&
          destination < stagingEnd && destination + mappedSize > staging;
      }));
      if (overlaySections.size) {
        stagedBytes = new Uint8Array(stagedBytes);
        const view = new DataView(stagedBytes.buffer, stagedBytes.byteOffset, stagedBytes.byteLength);
        const optionalSize = view.getUint16(image.peOff + 20, true);
        const sectionTable = image.peOff + 24 + optionalSize;
        image.sections.forEach((section, index) => {
          if (!overlaySections.has(section)) return;
          const sectionHeader = sectionTable + index * 40;
          view.setUint32(sectionHeader + 8, 0, true);  // VirtualSize
          view.setUint32(sectionHeader + 16, 0, true); // SizeOfRawData
        });
        const sectionAlignment = view.getUint32(image.peOff + 56, true);
        const retainedEnd = image.sections.reduce((end, section) => overlaySections.has(section)
          ? end : Math.max(end, section.rva + Math.max(section.vsize, section.rawSize)), 0);
        const launcherSize = Math.ceil(retainedEnd / sectionAlignment) * sectionAlignment;
        view.setUint32(image.peOff + 80, launcherSize, true); // SizeOfImage
        const overlayBytes = [...overlaySections].reduce((sum, section) => sum + section.rawSize, 0);
        say(`[pe] leaving ${overlayBytes} discardable SFX overlay bytes in the VFS; ` +
          `launcher image is ${launcherSize} bytes`);
      }
    }
  }
  new Uint8Array(memoryBuffer).set(stagedBytes, staging);
  if (staged < exeBytes.length && signature !== 'NE') {
    const guestBase = exports.get_guest_base() >>> 0;
    const memory = new Uint8Array(memoryBuffer);
    let hydrated = 0;
    for (const section of image.sections) {
      if (overlaySections && overlaySections.has(section)) continue;
      // PointerToRawData=0 is BSS. Do not use the UDATA characteristic alone:
      // packers commonly combine CODE/IDATA/UDATA on one section that still
      // has real raw bytes, and the WAT loader maps those bytes as initialized.
      if (!section.rawOff || !section.rawSize) continue;
      const start = Math.max(staged, section.rawOff);
      const end = Math.min(exeBytes.length, section.rawOff + section.rawSize);
      if (end <= start) continue;
      const destination = guestBase + section.rva + (start - section.rawOff);
      if (destination < 0 || destination + (end - start) > memory.length) {
        throw new Error(`PE section ${section.name || '?'} exceeds guest image memory`);
      }
      memory.set(exeBytes.subarray(start, end), destination);
      hydrated += end - start;
    }
    say(`[pe] prehydrated ${hydrated} mapped section-tail bytes`);
  }
  return staged;
}

function stageAndLoadPe(exports, memoryBuffer, exeBytes, log) {
  const say = log || ((m) => console.log(m));
  const staged = stagePe(exports, memoryBuffer, exeBytes, log);
  const entry = exports.load_pe(staged) >>> 0;
  say('PE loaded. Entry: 0x' + entry.toString(16).padStart(8, '0'));
  return { entry, staged };
}

// Win9x hands an application's VirtualAlloc/heap memory out low in its
// address space, bottom-up from 0x00400000, so nothing a Win98 program ever
// sees is above 0x10000000 -- and some code relies on it: Age of Wonders'
// image library aligns record pointers with `and esi, 0x0FFFFFFC`, which on
// our top-down arena (from 0x7F000000) silently drops the top nibble and the
// sprite blitter then runs on garbage. An app with that assumption sets
// virtualAllocTop: 0x10000000 in lib/apps.js; reservations then start just
// below 256MB and grow down towards the direct window. Must follow load_pe,
// which resets the cursor, and precede the first DllMain.
function applyVirtualAllocTop(exports, top) {
  if (!top || !exports.set_virtual_alloc_top) return false;
  exports.set_virtual_alloc_top(top >>> 0);
  return true;
}

// The staging buffer doubles as scratch for these two: load_pe has already
// consumed it by the time either is called.
function writeToStaging(exports, memoryBuffer, text) {
  const bytes = new TextEncoder().encode(text);
  const staging = exports.get_staging();
  new Uint8Array(memoryBuffer).set(bytes, staging);
  return { off: staging, len: bytes.length };
}

function setExeName(exports, memoryBuffer, name) {
  if (!exports.set_exe_name) return;
  const { off, len } = writeToStaging(exports, memoryBuffer, name);
  exports.set_exe_name(off, len);
}

function exeDriveForPath(guestPath) {
  const match = /^([a-z]):[\\/]/i.exec(String(guestPath || ''));
  return match ? match[1].toUpperCase().charCodeAt(0) : 0x43;
}

function setExeDrive(exports, guestPath) {
  if (!exports.set_exe_drive) return;
  exports.set_exe_drive(exeDriveForPath(guestPath));
}

function setExtraCmdline(exports, memoryBuffer, args) {
  if (!exports.set_extra_cmdline || !args) return;
  const { off, len } = writeToStaging(exports, memoryBuffer, args);
  exports.set_extra_cmdline(off, len);
}

function setEnvironmentVariable(exports, memoryBuffer, name, value) {
  if (!exports.set_process_environment_a || !exports.get_staging) return false;
  name = String(name);
  if (!name || name.includes('\0') || name.includes('=')) {
    throw new Error(`invalid process environment name: ${JSON.stringify(name)}`);
  }
  if (value !== null && value !== undefined && String(value).includes('\0')) {
    throw new Error(`process environment value for ${name} contains NUL`);
  }
  const mem = new Uint8Array(memoryBuffer);
  const nameBytes = new TextEncoder().encode(name);
  const valueBytes = value === null || value === undefined
    ? null : new TextEncoder().encode(String(value));
  const nameGuest = exports.get_staging() >>> 0;
  const valueGuest = valueBytes ? nameGuest + nameBytes.length + 1 : 0;
  mem.set(nameBytes, nameGuest);
  mem[nameGuest + nameBytes.length] = 0;
  if (valueBytes) {
    mem.set(valueBytes, valueGuest);
    mem[valueGuest + valueBytes.length] = 0;
  }
  return !!exports.set_process_environment_a(nameGuest, valueGuest);
}

// Resolved on use, not at load: the browser loads these as classic scripts and
// the order of the <script> tags is not this file's business.
function dllLoader() {
  if (typeof require === 'function') return require('./dll-loader');
  return (typeof window !== 'undefined' && window.DllLoader) || null;
}

function dibLoader() {
  if (typeof require === 'function') return require('./dib');
  if (typeof window === 'undefined') return null;
  if (typeof window.extractBitmapBytes === 'function') return window;
  return window.dibLib || null;
}

function readGuestCString(memoryBuffer, wasmAddr, max) {
  const mem = new Uint8Array(memoryBuffer);
  const limit = max || 260;
  let out = '';
  for (let i = 0; i < limit; i++) {
    const ch = mem[wasmAddr + i];
    if (!ch) break;
    out += String.fromCharCode(ch);
  }
  return out;
}

// A DLL's bitmap resources are drawn by the host, not the guest, so both hosts
// keep a loadAddr -> { bitmapBytes } map on whatever object they call a context.
function registerDllBitmaps(host, fileName, bytes, loadAddr, say) {
  const dib = dibLoader();
  if (!host || !dib || typeof dib.extractBitmapBytes !== 'function') return;
  try {
    const bitmapBytes = dib.extractBitmapBytes(bytes);
    const count = Object.keys(bitmapBytes).length;
    if (!count) return;
    host.dllResources = host.dllResources || {};
    host.dllResources[loadAddr] = { bitmapBytes };
    say(`DLL resources: ${fileName} has ${count} bitmaps`);
  } catch (_) {}
}

// The LoadLibraryA yield (yield_reason=5). The WAT handler has already parked
// EIP/ESP; everything below is the same in both hosts except where the bytes
// come from, so that — and only that — is the callback.
//
// findDll(fileName, fullName) -> bytes | null | Promise of either.
// onLoaded({ result, fileName, bytes }) runs after the image is in memory and
// before its imports are patched: the CLI records the module base there so
// `module+0xVA` probes resolve, the browser remembers the bytes for a later
// LoadLibrary of the same name.
function pendingLoadLibraryName(exports, memoryBuffer) {
  const nameWA = exports.get_loadlib_name ? exports.get_loadlib_name() >>> 0 : 0;
  const dllName = nameWA ? readGuestCString(memoryBuffer, nameWA) : '';
  return { dllName, fileName: dllName.split('\\').pop().toLowerCase() };
}

// Windows maps a DLL's static imports before the DLL itself, and runs their
// DllMains first. The boot walk (resolveDllGraph) does that for the EXE's
// graph, but a LoadLibrary at run time mapped only the named file, so an
// import of a module nothing had loaded yet fell to the WAT stubs: Blood 2's
// Client.exe LoadLibrary's ima.dll, which imports IMUSIC25.DLL and
// MSYNTH25.DLL, and trapped on _AllocAAEngine2@8. Same gate as the boot walk:
// only names the registry loads as real PEs, and only ones not mapped yet.
//
// A generator so the async and the synchronous yield pumps share one walk:
// it yields each file name to look up and is resumed with the bytes (or
// null). The result is post-order, dependencies before their dependents.
function* loadLibraryDependencies(bytes, fileName, loaded) {
  const loader = dllLoader();
  const isLoadable = (dllReg && dllReg.isLoadableDll) || (() => false);
  const seen = new Set(loaded);
  seen.add(String(fileName).toLowerCase());
  const order = [];
  const visit = function* (image) {
    let names = [];
    try { names = loader && loader.detectRequiredDlls ? loader.detectRequiredDlls(image) || [] : []; } catch (_) {}
    for (const name of names) {
      const key = String(name).toLowerCase();
      if (seen.has(key) || !isLoadable(key)) continue;
      seen.add(key);
      const found = yield key;
      if (!found) { order.push({ fileName: key, bytes: null }); continue; }
      const dep = found instanceof Uint8Array ? found : new Uint8Array(found);
      yield* visit(dep);
      order.push({ fileName: key, bytes: dep });
    }
  };
  yield* visit(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  return order;
}

// A dependency is looked for beside the module that imports it.
function besideModule(modulePath, fileName) {
  const cut = String(modulePath).lastIndexOf('\\');
  return cut < 0 ? fileName : modulePath.slice(0, cut + 1) + fileName;
}

function loadedDllNames(exports, memoryBuffer) {
  const loader = dllLoader();
  try {
    return loader && loader.loadedModuleNames ? loader.loadedModuleNames(exports, memoryBuffer) : new Set();
  } catch (_) { return new Set(); }
}

function completeLoadLibraryYield(opts, bytes, lookupError, deps = []) {
  const { exports, memoryBuffer, findDll, resourceHost = null, onLoaded = null,
    advanceGuestTime = null, log = null, trace = null } = opts || {};
  const say = log || (() => {});
  const loader = dllLoader();
  // A load WAT asked for on its own behalf (an installable codec driver, see
  // 09a7g-video-icm.wat) rides on whatever guest call was running: keep that
  // call's volatile registers instead of returning the module handle.
  const keepRegs = exports.take_loadlib_keep_regs ? exports.take_loadlib_keep_regs() : 0;
  const savedRegs = keepRegs ? [exports.get_eax(), exports.get_ecx(), exports.get_edx()] : null;
  const finish = (eax) => {
    if (savedRegs) {
      exports.set_eax(savedRegs[0]);
      exports.set_ecx(savedRegs[1]);
      exports.set_edx(savedRegs[2]);
    } else if (exports.set_eax) exports.set_eax(eax);
    if (loader && loader.resumeAfterLoadLibraryYield) {
      loader.resumeAfterLoadLibraryYield(exports, memoryBuffer, trace);
    }
    if (exports.clear_yield) exports.clear_yield();
  };

  const nameWA = exports.get_loadlib_name ? exports.get_loadlib_name() >>> 0 : 0;
  const dllName = nameWA ? readGuestCString(memoryBuffer, nameWA) : '';
  const fileName = dllName.split('\\').pop().toLowerCase();
  if (!dllName) { finish(0); return null; }

  if (lookupError) say(`[LoadLibrary] ${fileName}: ${lookupError && lookupError.message ? lookupError.message : lookupError}`);
  if (!bytes || !loader || !loader.loadDll) {
    say(`[LoadLibrary] DLL not found: ${fileName}`);
    finish(0);
    return null;
  }

  const map = (image, name, modulePath) => {
    const result = loader.loadDll(exports, memoryBuffer, image, modulePath);
    say(`[LoadLibrary] ${name} loaded at 0x${result.loadAddr.toString(16)}, ` +
      `dllMain=0x${(result.dllMain >>> 0).toString(16)}`);
    registerDllBitmaps(resourceHost, name, image, result.loadAddr, say);
    if (onLoaded) onLoaded({ result, fileName: name, bytes: image });
    if (loader.patchDllImports) {
      loader.patchDllImports(exports, memoryBuffer, [{ name, bytes: image }], [result], say);
    }
    return result;
  };
  const initialize = [];
  for (const dep of deps) {
    if (!dep.bytes) {
      say(`[LoadLibrary] ${fileName} imports ${dep.fileName}, not found: its imports fall to WAT stubs`);
      continue;
    }
    try {
      initialize.push(map(dep.bytes, dep.fileName, besideModule(dllName, dep.fileName)));
    } catch (e) {
      say(`[LoadLibrary] ${dep.fileName} (imported by ${fileName}) load error: ${e && e.message ? e.message : e}`);
    }
  }

  const image = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let result;
  try {
    result = map(image, fileName, dllName);
  } catch (e) {
    say(`[LoadLibrary] load error: ${e && e.message ? e.message : e}`);
    finish(0);
    return null;
  }
  initialize.push(result);
  // Clear the yield before DllMain: some DLLs (d3dxof's template registry) do
  // real work there, and callDllMain saves/restores EIP/ESP around it.
  if (exports.clear_yield) exports.clear_yield();
  for (const module of initialize) {
    if (module.dllMain && loader.callDllMain) {
      loader.callDllMain(exports, module.loadAddr, module.dllMain, say, {
        advanceGuestTime, onLoadLibraryYield: opts.onLoadLibraryYield,
      });
    }
  }
  finish(result.loadAddr);
  return result;
}

async function handleLoadLibraryYield(opts) {
  const { exports, memoryBuffer, findDll } = opts || {};
  const { dllName, fileName } = pendingLoadLibraryName(exports, memoryBuffer);
  let bytes = null;
  let lookupError = null;
  if (dllName) {
    try { bytes = await findDll(fileName, dllName); } catch (e) { lookupError = e; }
  }
  let deps = [];
  if (bytes) {
    const walk = loadLibraryDependencies(bytes, fileName, loadedDllNames(exports, memoryBuffer));
    for (let step = walk.next(); ; ) {
      if (step.done) { deps = step.value; break; }
      let found = null;
      try { found = await findDll(step.value, besideModule(dllName, step.value)); } catch (_) {}
      step = walk.next(found);
    }
  }
  return completeLoadLibraryYield(opts, bytes, lookupError, deps);
}

// The same yield serviced synchronously, for a LoadLibraryA issued from inside
// a DllMain. callDllMain runs an initializer to completion in one synchronous
// loop, so it cannot await the host's handler: without this it resumed the
// guest with the load still pending, and LoadLibraryA "returned" whatever EAX
// held (UBER.DLL's DllMain got 0x074ff7b0 for Myth's modules\TCPIP.DLL and
// Myth reported no network modules). findDllSync must answer from memory:
// bytes, or null for "not present" (LoadLibrary fails with NULL). Returning a
// Promise means the bytes need I/O -- the yield is left for the async path.
function serviceLoadLibraryYieldSync(opts) {
  const { exports, memoryBuffer, findDllSync } = opts || {};
  if (!exports || !exports.get_yield_reason || (exports.get_yield_reason() >>> 0) !== 5) return false;
  const { dllName, fileName } = pendingLoadLibraryName(exports, memoryBuffer);
  let bytes = null;
  let lookupError = null;
  if (dllName && findDllSync) {
    try { bytes = findDllSync(fileName, dllName); } catch (e) { lookupError = e; }
    if (bytes && typeof bytes.then === 'function') return false;
  }
  let deps = [];
  if (bytes) {
    const walk = loadLibraryDependencies(bytes, fileName, loadedDllNames(exports, memoryBuffer));
    for (let step = walk.next(); ; ) {
      if (step.done) { deps = step.value; break; }
      let found = null;
      try { found = findDllSync(step.value, besideModule(dllName, step.value)); } catch (_) {}
      if (found && typeof found.then === 'function') return false;
      step = walk.next(found);
    }
  }
  completeLoadLibraryYield(opts, bytes, lookupError, deps);
  return true;
}

// The COM DLL yield (yield_reason=3), raised when CoCreateInstance needs an
// in-proc server. Unlike LoadLibrary this does not resume the caller: clearing
// the yield re-enters the CoCreateInstance handler, which retries and now finds
// the class registered. Only the failure paths touch EAX/ESP.
async function handleComDllYield(opts) {
  const { exports, memoryBuffer, findDll, exeBytes = null, resourceHost = null,
    advanceGuestTime = null, log = null } = opts || {};
  const say = log || (() => {});
  const loader = dllLoader();
  const REGDB_E_CLASSNOTREG = 0x80040154;
  const E_FAIL = 0x80004005;
  // CoCreateInstance is a 5-argument stdcall; the handler yielded before its
  // own epilogue, so a failure has to drop the return address and the args.
  const failWith = (hr) => {
    if (exports.clear_yield) exports.clear_yield();
    // CoCreateInstance clears *ppv on every failure. Miles' A3D provider
    // (Pirates! 2004) releases whatever its uninitialized interface pointer
    // held when the class is missing, and it held stack garbage that called
    // into the thunk zone and crashed the process. ppv is the fifth argument,
    // above the parked return address.
    const esp = exports.get_esp() >>> 0;
    if (exports.guest_read32 && exports.guest_write32) {
      const ppv = exports.guest_read32(esp + 20) >>> 0;
      if (ppv) exports.guest_write32(ppv, 0);
      // Return to the caller. EIP is still parked on the CoCreateInstance
      // thunk -- right for success, where clearing the yield re-enters the
      // handler -- so popping the frame without moving EIP re-ran the thunk
      // on the caller's stack: a second "CoCreateInstance" with garbage
      // arguments, then a NULL call and ExitProcess (Pirates! after Miles
      // asked for the absent A3D class).
      if (exports.set_eip) exports.set_eip(exports.guest_read32(esp) >>> 0);
    }
    exports.set_eax(hr);
    exports.set_esp(esp + 24);
  };

  const nameWA = exports.get_com_dll_name ? exports.get_com_dll_name() >>> 0 : 0;
  if (!nameWA) {
    say('[COM] yield but no pending DLL name');
    if (exports.clear_yield) exports.clear_yield();
    return null;
  }
  const dllName = readGuestCString(memoryBuffer, nameWA);
  const fileName = dllName.split('\\').pop().toLowerCase();
  say(`[COM] Loading DLL: ${fileName}`);

  let bytes = null;
  try { bytes = await findDll(fileName, dllName); } catch (e) {
    say(`[COM] ${fileName}: ${e && e.message ? e.message : e}`);
  }
  if (!bytes || !loader || !loader.loadDll) {
    say(`[COM] DLL not found: ${fileName}`);
    failWith(REGDB_E_CLASSNOTREG);
    return null;
  }

  const image = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    const result = loader.loadDll(exports, memoryBuffer, image, dllName);
    say(`[COM] DLL loaded at 0x${result.loadAddr.toString(16)}`);
    registerDllBitmaps(resourceHost, fileName, image, result.loadAddr, say);
    if (exeBytes && loader.patchExeImports) {
      loader.patchExeImports(exports, memoryBuffer, exeBytes, [{ name: fileName, bytes: image }], say);
    }
    if (result.dllMain && loader.callDllMain) {
      loader.callDllMain(exports, result.loadAddr, result.dllMain, say, { advanceGuestTime });
    }
    if (exports.clear_yield) exports.clear_yield();
    return result;
  } catch (e) {
    say(`[COM] DLL load error: ${e && e.message ? e.message : e}`);
    failWith(E_FAIL);
    return null;
  }
}

// Named uniquely: the browser loads this as a classic script beside
// lib/dll-registry.js, and two top-level `const api` would be a SyntaxError.
const processBootApi = {
  SYSTEM_DATA_FILES, resolveDllGraph, mountLoadedDllFiles, mountSystemDataFiles,
  WIN16_SYSTEM_MODULE_FILES, win16ModuleStub, mountWin16SystemModules,
  DIRECTX_SYSTEM_MODULE_FILES, DIRECTX_MODULE_VERSIONS, directXModuleStub, mountDirectXSystemModules,
  stagePe, stageAndLoadPe, applyVirtualAllocTop, setExeName, setExeDrive,
  exeDriveForPath, setExtraCmdline,
  setEnvironmentVariable,
  readGuestCString, registerDllBitmaps, handleLoadLibraryYield, serviceLoadLibraryYieldSync, handleComDllYield, findVfsDllBytes,
  loadLibraryDependencies, besideModule,
};

if (typeof module !== 'undefined' && module.exports) module.exports = processBootApi;
if (typeof window !== 'undefined') window.processBoot = processBootApi;
