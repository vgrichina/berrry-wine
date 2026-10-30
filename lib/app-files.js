'use strict';

// The default download policy for an app's companion files: which load at
// launch and which stay on the server and stream as the guest reads them.
//
// Both hosts call normalizeLazyFiles() on the same files[] (lib/browser-shell.js
// before wine.loadFiles, test/run.js before mounting), so a headless
// `--lazy-ranges` run audits exactly the decision the page makes.
//
// A lazy file is a read-only provider-backed VFS entry (lib/filesystem.js).
// ReadFile, read-only MapViewOfFile, Win32 _lread/_hread, mmio refills, the
// AVI reader, PlaySound/sndPlaySound, BASS_SampleLoad and LoadImage /
// ImageList_LoadImage from a file park the guest on a cache miss, and the MCI
// waveaudio/sequencer devices attach a streamed file when it arrives; other
// consumers need the bytes in the same turn (the Win16 _lread bridge, DLL and
// resource loading, fonts, help, writable mappings, writes). So the policy keeps eager, BY FILE CLASS (never by
// size), what those consumers read, and streams everything else -- small
// files too.
//
// Rules, in order:
//   1. app.lazyFiles === false            -> every file eager (per-app opt-out)
//   2. a Win16 (NE) main image            -> every file eager (its _lread
//      bridge cannot park)
//   3. a file that already says how it loads (loadMode, httpRange true/false,
//      eager:true, preloadRanges, decodeImage) -> left exactly as written
//   4. all sizes known and their total < APP_EAGER_BYTES -> every file eager
//      (Solitaire-sized apps load as before)
//   5. a file whose size is unknown (no `size`, no sizeOf answer) -> eager
//   6. per file eager: an extension a synchronous consumer reads
//      (EAGER_EXTENSIONS), or a path app.persistFiles names (the guest
//      writes it)
//   7. otherwise streamed: {httpRange:true, size}. host.js mounts a sized
//      entry up to one release part with no HEAD, and a host without Range
//      support hands its first read the whole file (acceptWhole).
(function () {
  const APP_EAGER_BYTES = 16 * 1024 * 1024;

  // Read by something that cannot park on a cache miss: the PE/DLL loader
  // (images, codecs, plug-ins, type libraries), resource and font loading,
  // INI/registry-ish config, fonts and WinHelp.
  // AVI is not here: the 09a7f reader behind AVIFile and MCI avivideo parks a
  // missed chunk read and restarts the call, like ReadFile.
  const EAGER_EXTENSIONS = new Set([
    'exe', 'dll', 'drv', 'ocx', 'ax', 'acm', 'cpl', 'vxd', 'asi', 'm3d', 'flt', 'tlb', 'olb',
    'ini', 'inf', 'cfg', 'reg',
    // Unreal-engine localization tables are INI files: Core.int and friends
    // are read through GetPrivateProfileString, which cannot park. Unreal
    // Special streamed core.int and died with VfsPendingError in
    // ini_get_string (Telegram #31).
    'int',
    // Battlezone's mission terrain descriptors (data\addon\misn*.trn) are INI
    // text read with GetPrivateProfileInt when a mission launches.
    'trn',
    'ttf', 'ttc', 'fon', 'fnt',
    'hlp', 'cnt', 'chm',
    // AoE II's EBUEula.dll hands EULA.RTF to a reader that cannot park.
    'rtf',
  ]);
  // Audio and images have no class of their own: every reader of a sound or
  // picture file parks or attaches late -- PlaySound/sndPlaySound,
  // BASS_SampleLoad, mmio, ReadFile, the MCI devices (readFileAsync), and
  // LoadImage/ImageList_LoadImage(LR_LOADFROMFILE) bitmaps -- so they stream
  // like any data file. Colin McRae's demo used to load 591 .wav before its
  // first frame because its exe names PlaySound. (LoadCursorFromFile and
  // icon/cursor LoadImage do not read the file at all yet.)

  function fileUrl(file) {
    return typeof file === 'string' ? file : (file && file.url) || '';
  }

  function extensionOf(url) {
    const leaf = String(url).replace(/[?#].*$/, '').replace(/^.*[\\/]/, '');
    const dot = leaf.lastIndexOf('.');
    return dot < 0 ? '' : leaf.slice(dot + 1).toLowerCase();
  }

  function vfsPathsOf(file) {
    if (typeof file === 'string') return ['c:\\' + file.replace(/^.*[\\/]/, '').toLowerCase()];
    if (Array.isArray(file.vfsPaths)) return file.vfsPaths.map(normalizePath);
    if (file.vfsPath) return [normalizePath(file.vfsPath)];
    return ['c:\\' + fileUrl(file).replace(/^.*[\\/]/, '').toLowerCase()];
  }

  function normalizePath(path) {
    let p = String(path || '').toLowerCase().replace(/\//g, '\\');
    if (!/^[a-z]:/.test(p)) p = 'c:\\' + p.replace(/^\\+/, '');
    return p;
  }

  // Same glob shape as lib/vfs-persistence.js persistFiles.
  function patternRegex(pattern) {
    const escaped = normalizePath(pattern)
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp('^' + escaped + '$');
  }

  function declaresLoading(file) {
    return typeof file === 'object' && file !== null && (
      file.loadMode !== undefined || file.httpRange !== undefined || file.eager === true ||
      file.preloadRanges !== undefined || file.decodeImage);
  }

  function sizeFor(file, sizeOf) {
    if (typeof file === 'object' && file && Number.isSafeInteger(file.size) && file.size >= 0) return file.size;
    if (typeof sizeOf === 'function') {
      const size = sizeOf(fileUrl(file), file);
      if (Number.isSafeInteger(size) && size >= 0) return size;
    }
    return null;
  }

  // Returns { files, summary }. `files` is a new array; entries left eager are
  // the original objects, lazy ones are shallow copies. Never mutates `app`.
  function normalizeLazyFiles(app, files, options = {}) {
    const list = Array.isArray(files) ? files : [];
    const summary = {
      policy: 'lazy', eagerFiles: 0, lazyFiles: 0, eagerBytes: 0, lazyBytes: 0, unknownSizes: 0,
    };
    const finish = (out, policy) => {
      summary.policy = policy;
      for (let i = 0; i < out.length; i++) {
        const size = sizeFor(out[i], options.sizeOf);
        const lazy = typeof out[i] === 'object' && out[i] &&
          (out[i].loadMode === 'lazy' || out[i].loadMode === 'background' ||
           (out[i].httpRange === true && out[i].loadMode !== 'required'));
        if (lazy) { summary.lazyFiles++; summary.lazyBytes += size || 0; }
        else { summary.eagerFiles++; summary.eagerBytes += size || 0; }
        if (size === null) summary.unknownSizes++;
      }
      return { files: out, summary };
    };
    if (app && app.lazyFiles === false) return finish(list.slice(), 'eager: app.lazyFiles false');
    if (options.isWin16) return finish(list.slice(), 'eager: Win16 image');

    const sizes = list.map(file => sizeFor(file, options.sizeOf));
    if (sizes.every(size => size !== null)) {
      const total = sizes.reduce((sum, size) => sum + size, 0);
      if (total < APP_EAGER_BYTES) return finish(list.slice(), 'eager: small app');
    }
    const persist = (app && Array.isArray(app.persistFiles) ? app.persistFiles : []).map(patternRegex);
    const out = list.map((file, i) => {
      if (!fileUrl(file) || declaresLoading(file)) return file;
      const size = sizes[i];
      // Unknown size: eager. An unsized entry is a registry the size map does
      // not cover yet; it keeps the pre-policy behaviour rather than a guess
      // (AoE II's unsized EULA.RTF streamed into a non-parking reader once).
      if (size === null) return file;
      const ext = extensionOf(fileUrl(file));
      if (EAGER_EXTENSIONS.has(ext)) return file;
      if (persist.length && vfsPathsOf(file).some(path => persist.some(re => re.test(path)))) return file;
      // httpRange, not a sized loadMode 'lazy': a sized loadMode entry
      // refuses to fall back when the host answers a Range request with 200,
      // which a plain static server does (the launch then stalls on
      // "Download problem"). The size rides along so host.js can mount it
      // with no HEAD, and accept a 200 as the whole file.
      const base = typeof file === 'string' ? { url: file } : { ...file };
      return { ...base, httpRange: true, size };
    });
    return finish(out, 'lazy');
  }

  // A registry entry can carry `iniSet: {Section: {Key: 'value'}}` to change
  // keys in a mounted INI file -- what a player does in the game's own
  // settings screen, decided once in the registry so both hosts mount the
  // same file. Deus Ex's installer writes SoftDrv as its renderer; UE1 has no
  // command-line override for it. Each key is replaced in place, or appended
  // to its section (the section is appended when absent); line endings and
  // every other byte are kept. Bytes are treated as Latin-1, as UE1 does.
  function applyIniSet(bytes, iniSet) {
    let text = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.split(/\r?\n/);
    const sectionOf = name => lines.findIndex(line =>
      line.trim().toLowerCase() === '[' + name.toLowerCase() + ']');
    for (const [section, keys] of Object.entries(iniSet)) {
      let head = sectionOf(section);
      if (head < 0) {
        if (lines.length && lines[lines.length - 1] === '') lines.pop();
        lines.push('', '[' + section + ']', '');
        head = lines.length - 2;
      }
      for (const [key, value] of Object.entries(keys)) {
        let end = head + 1;
        while (end < lines.length && !/^\s*\[/.test(lines[end])) end++;
        const want = key.toLowerCase();
        const at = lines.slice(head + 1, end).findIndex(line =>
          line.split('=')[0].trim().toLowerCase() === want);
        if (at >= 0) {
          lines[head + 1 + at] = key + '=' + value;
        } else {
          // After the section's last non-blank line.
          let tail = end;
          while (tail > head + 1 && lines[tail - 1].trim() === '') tail--;
          lines.splice(tail, 0, key + '=' + value);
        }
      }
    }
    const out = lines.join(eol);
    const result = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) result[i] = out.charCodeAt(i) & 0xFF;
    return result;
  }

  // An app's files[] plus the generated local media manifest
  // (tools/fetch-candidate-corpus.js). A registry entry that names a guest
  // path is a deliberate choice -- an iniSet edit of a file the installer
  // shipped, say -- so it replaces the manifest's entry for that path instead
  // of being shadowed by it: both hosts mount files in order, last one wins.
  // Paths compare case-insensitively, as the VFS does.
  function mergeLocalManifestFiles(registryFiles, manifestFiles) {
    const pathsOf = file => (typeof file === 'object' && file
      ? [].concat(file.vfsPaths || [], file.vfsPath || []) : [])
      .map(p => String(p).toLowerCase().replace(/\//g, '\\'));
    const claimed = new Set();
    for (const file of registryFiles || []) for (const p of pathsOf(file)) claimed.add(p);
    const kept = (manifestFiles || []).filter(file => !pathsOf(file).some(p => claimed.has(p)));
    return [...(registryFiles || []), ...kept];
  }

  const api = {
    applyIniSet,
    mergeLocalManifestFiles,
    APP_EAGER_BYTES,
    EAGER_EXTENSIONS,
    normalizeLazyFiles,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.appFiles = api;
})();
