/**
 * Virtual filesystem backed by in-memory Map.
 * Provides host imports for Win32 file I/O APIs.
 * Files are stored as Uint8Array in memory. Directory entries tracked separately.
 */

// Generic rights and their file-data equivalents. Keep validation ahead of
// provider reads and guest-buffer translation, including zero-byte requests.
const FILE_READ_ACCESS = 0x90000001; // GENERIC_READ | GENERIC_ALL | FILE_READ_DATA
const FILE_WRITE_ACCESS = 0x50000002; // GENERIC_WRITE | GENERIC_ALL | FILE_WRITE_DATA
const GENERIC_EXECUTE = 1 << 29; // Access-mask bit, not a linear-memory address.
// Map generic rights before comparing masks: GENERIC_READ and FILE_READ_DATA
// are different bits, but the former includes the latter. Preserve the original
// requested mask on handles for diagnostics and DUPLICATE_SAME_ACCESS.
function fileAccessMask(access) {
  let mapped = access & 0x0fffffff;
  if (access & 0x80000000) mapped |= 0x00120089; // FILE_GENERIC_READ
  if (access & 0x40000000) mapped |= 0x00120116; // FILE_GENERIC_WRITE
  if (access & GENERIC_EXECUTE) mapped |= 0x001200a0; // FILE_GENERIC_EXECUTE
  if (access & 0x10000000) mapped |= 0x001f01ff; // FILE_ALL_ACCESS
  return mapped >>> 0;
}
function fileDataAccessError(fh, write) {
  if (!fh) return 6; // ERROR_INVALID_HANDLE
  return (fh.access & (write ? FILE_WRITE_ACCESS | 4 : FILE_READ_ACCESS)) ? 0 : 5;
}

// How big a file entry is without reading it. A lazily-backed entry knows its
// size from the directory listing that created it, so asking for it must not
// pull the bytes in — FindFirstFile over a populated drive would otherwise
// materialize every file on it just to fill in nFileSizeLow.
function entrySize(entry) {
  if (!entry) return 0;
  if (entry._size !== undefined) return entry._size;
  return entry.data.length;
}

const FILE_NOTIFY_CHANGE_FILE_NAME = 0x00000001;
const FILE_NOTIFY_CHANGE_DIR_NAME = 0x00000002;
const FILE_NOTIFY_CHANGE_ATTRIBUTES = 0x00000004;
const FILE_NOTIFY_CHANGE_SIZE = 0x00000008;
const FILE_NOTIFY_CHANGE_LAST_WRITE = 0x00000010;

const FILETIME_UNIX_EPOCH = 116444736000000000n;

// Entry identity is shared by adopted filesystems, unlike their open handles.
// Keep runtime locks outside entries so snapshots/exports never serialize them.
const fileByteLocks = new WeakMap();
const filePendingReads = new WeakMap();
function byteRangesOverlap(a, b) {
  // A zero-byte lock reserves its starting point for subsequent lock requests.
  if (a.start === a.end) return b.start <= a.start && a.start < b.end;
  if (b.start === b.end) return a.start <= b.start && b.start < a.end;
  return a.start < b.end && b.start < a.end;
}

function splitFileTime(value) {
  const ticks = BigInt.asUintN(64, value);
  return {
    lo: Number(ticks & 0xFFFFFFFFn) >>> 0,
    hi: Number(ticks >> 32n) >>> 0,
  };
}

function currentFileTime() {
  return splitFileTime(FILETIME_UNIX_EPOCH + BigInt(Date.now()) * 10000n);
}

function cloneFileTime(value) {
  return { lo: value.lo >>> 0, hi: value.hi >>> 0 };
}

function sameFileTime(a, b) {
  return (a.lo >>> 0) === (b.lo >>> 0) && (a.hi >>> 0) === (b.hi >>> 0);
}

function preserveFileTime(value) {
  return value && (value.lo >>> 0) === 0xFFFFFFFF && (value.hi >>> 0) === 0xFFFFFFFF;
}

function ensureFileTimes(entry) {
  if (!entry.creationTime || !entry.lastAccessTime || !entry.lastWriteTime) {
    const now = currentFileTime();
    if (!entry.creationTime) entry.creationTime = cloneFileTime(now);
    if (!entry.lastAccessTime) entry.lastAccessTime = cloneFileTime(now);
    if (!entry.lastWriteTime) entry.lastWriteTime = cloneFileTime(now);
  }
  return entry;
}

function createFileEntry(data, attrs) {
  return ensureFileTimes({ data, attrs });
}

// ---- provider-backed (lazy) entries ---------------------------------------
//
// Phase ① of docs/design-byo-media.md. An entry may name its bytes through a
// `lib/byte-provider.js` ChunkCache plus an (offset, length) window instead of
// carrying a materialized Uint8Array — that is what lets a mounted ISO or zip
// be a set of files without allocating the container.
//
// Two access shapes exist, and the difference matters:
//
//   * `readFile` reads *ranges*. It asks the chunk cache synchronously and,
//     on a miss, returns a distinguishable `pending` result. A miss must never
//     look like a short read: the guest would take it for end-of-file.
//   * `entry.data` materializes the *whole* file. Every pre-existing consumer
//     in this file and its callers keeps working through this accessor, and a
//     write through the setter drops the provider — copy-on-write, for free.
//     It is correct but not cheap, so the read path deliberately does not use
//     it.
//
// THE CONTRACT, and why it is drawn here. A JS host import cannot suspend and
// resume its WASM caller; parking has to happen in WAT, before the handler
// pops its stdcall frame. ReadFile and read-only MapViewOfFile do that (see
// their handlers and $io_block). Every *other* consumer of a lazy entry runs
// to completion in the same turn and therefore needs the bytes now:
//
//     _lread / _hread          src/09a-handlers.wat — continues immediately
//     writable mapped views      this file — materialize before writeback
//     DLL and resource loading   host.js, lib/dll-loader.js
//     audio and GDI asset reads  src/09a3-*, src/09a4-*
//     writeFile / setEndOfFile / createFile(TRUNCATE) / copyFile — this file
//
// So a provider that can read synchronously (Node fd, resident bytes, a chunk
// cache that already holds the range) serves all of them through this
// accessor, and an async-only provider (Blob, HTTP Range) must be
// pre-materialized with `vfs.materialize(path)` before any of them touches
// it. Hitting one of them with an unfilled async-only provider throws
// VfsPendingError: that is a mount bug, and a loud one beats inventing bytes
// or unwinding through nested WASM frames. Spawned guest threads use the same
// explicit IO_WAIT contract through the cooperative or Worker scheduler.

// Resolved lazily and tolerantly: this file also loads in hosts that never
// mount a container and therefore never ship lib/byte-provider.js.
let _bpCache;
function _byteProvider() {
  if (_bpCache !== undefined) return _bpCache;
  _bpCache = null;
  if (typeof window !== 'undefined' && window.byteProvider) _bpCache = window.byteProvider;
  else if (typeof require !== 'undefined') {
    try { _bpCache = require('./byte-provider'); } catch (_) { _bpCache = null; }
  }
  return _bpCache;
}

class VfsPendingError extends Error {
  constructor(path, offset, length) {
    super(`VFS entry ${path} is backed by an async-only provider and was used ` +
      `by a consumer that cannot wait (@${offset}+${length}). ` +
      `Call vfs.materialize('${path}') at mount time, or mount it behind a ` +
      `provider that reads synchronously.`);
    this.name = 'VfsPendingError';
    this.vfsPending = { path, offset, length };
  }
}

function providerReadSync(entry, off, len) {
  const p = entry._provider;
  if (!p || !p.tryRead) return null;
  return p.tryRead((entry._offset || 0) + off, len);
}

function providerWindowValue(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new RangeError(`setProviderFile: ${label} must be a non-negative safe integer`);
  }
  return number;
}

// Whole-file consumers must not ask a bounded ChunkCache to make the entire
// file resident at once: files larger than its LRU capacity evict their first
// chunks before the final `tryRead`. Materialization is terminal (the provider
// is dropped when the bytes are installed), so read bounded windows directly
// from the cache's underlying provider when that standard shape is available.
// A custom cache without an exposed provider still gets bounded requests
// through its own readRange/fill contract.
const MATERIALIZE_CHUNK_SIZE = 4 * 1024 * 1024;
function providerReadAsync(cache, absolute, len) {
  const source = cache && cache.provider && typeof cache.provider.readRange === 'function'
    ? cache.provider : cache;
  if (source && typeof source.readRange === 'function') {
    return Promise.resolve(source.readRange(absolute, len));
  }
  if (!cache || typeof cache.fill !== 'function' || typeof cache.tryRead !== 'function') {
    return Promise.reject(new Error('materialize: provider has no asynchronous read path'));
  }
  return Promise.resolve(cache.fill(absolute, len)).then(() => {
    const bytes = cache.tryRead(absolute, len);
    if (!bytes) throw new Error(`materialize: fill did not satisfy @${absolute}+${len}`);
    return bytes;
  });
}

function defineProviderData(entry, path) {
  let data = null;
  Object.defineProperty(entry, 'data', {
    configurable: true,
    enumerable: true,
    get() {
      if (data === null) {
        const whole = providerReadSync(entry, 0, entry._size);
        if (!whole) throw new VfsPendingError(path, 0, entry._size);
        data = new Uint8Array(whole);
        entry._provider = null;
        entry._offset = 0;
        entry._size = data.length;
      }
      return data;
    },
    set(v) {
      data = v;
      entry._provider = null;
      entry._offset = 0;
      entry._size = v.length;
    },
  });
}

// Preserve a lazy file's original provider window while adding a zero-filled
// tail. No download is needed just to extend the logical file. Both streaming
// materialization and the synchronous-read/async-fill protocol use this view.
function extendFileEntry(entry, size) {
  const oldSize = entrySize(entry);
  if (entry._provider) {
    const source = entry._provider, sourceOffset = entry._offset || 0;
    const prefixLength = (off, len) => Math.min(len, Math.max(0, oldSize - off));
    const join = (prefix, count, len) => {
      if (!(prefix instanceof Uint8Array) || prefix.length !== count) {
        throw new Error('extended file: short provider read');
      }
      const bytes = new Uint8Array(len);
      bytes.set(prefix);
      return bytes;
    };
    entry._provider = {
      size,
      tryRead(off, len) {
        const count = prefixLength(off, len);
        const prefix = count ? source.tryRead(sourceOffset + off, count) : new Uint8Array(0);
        return prefix === null ? null : join(prefix, count, len);
      },
      fill(off, len) {
        const count = prefixLength(off, len);
        return count ? source.fill(sourceOffset + off, count) : Promise.resolve();
      },
      async readRange(off, len) {
        const count = prefixLength(off, len);
        const prefix = count ? await providerReadAsync(source, sourceOffset + off, count) : new Uint8Array(0);
        return join(prefix, count, len);
      },
    };
    entry._offset = 0;
    entry._size = size;
  } else {
    const bytes = new Uint8Array(size);
    bytes.set(entry.data);
    entry.data = bytes;
    delete entry._capacityData;
    if (entry._size !== undefined) entry._size = size;
  }
}

// Open-file records by handle. A Win9x kernel handle is a small number, and
// some runtimes keep only its low 16 bits: Asghan's Borland I/O layer stores
// the CreateFile result as a WORD (`movzx ebx, word [0x44e304]`) and reads
// with handle 0xb for our 0x7000000b. So a lookup that misses on a value
// below 0x10000 falls back to the Win32 handle with those low bits. An exact
// key always wins, so the 16-bit _l* HFILE namespace (small keys of its own)
// is untouched; the alias only answers for a value nothing else owns.
const VFS_HANDLE_BASE = 0x70000000;
class VfsHandleMap extends Map {
  _key(handle) {
    const k = handle >>> 0;
    if (k > 0 && k < 0x10000 && !super.has(k)) {
      const wide = (VFS_HANDLE_BASE | k) >>> 0;
      if (super.has(wide)) return wide;
    }
    return handle;
  }
  get(handle) { return super.get(this._key(handle)); }
  has(handle) { return super.has(this._key(handle)); }
  delete(handle) { return super.delete(this._key(handle)); }
}

class VirtualFS {
  constructor() {
    this.files = new Map();    // normalized path → { data: Uint8Array, attrs: number }
    this.dirs = new Set();     // normalized paths of directories
    this.handles = new VfsHandleMap();  // handle → { path, pos, access, data (ref to files entry) }
    this._fileIdentity = { ids: new WeakMap(), next: 1 }; // filesystem-entry IDs, not handle IDs
    this.findHandles = new Map(); // handle → { pattern, results[], index }
    this.changeNotifications = new Map(); // waitable handle → directory watch
    this.readOnlyDrives = new Set(); // lower-case drive letters backed by immutable media
    // Main-thread lazy I/O state. Other guest threads have private state in
    // _threadIo; pending records carry their owner across async completion.
    // Faults latch failed fills so the retry reports failure, not another park.
    this.pendingRead = null;
    this.readFaults = new Map(); // handle → { pos, error }
    // Retry history cannot live in pendingRead: imports and fill completion
    // retire that scheduler slot before the same guest call runs again.
    this._readRetries = new WeakMap(); // open-file record → last missing range
    this._threadIo = new Map(); // 1-based guest thread ID → private I/O state
    this._nextHandle = 0x70000001;  // positive as a signed int: Delphi FileOpen treats < 0 as failure
    // The Win16-compatible _l* APIs expose a 16-bit HFILE. Keep those handles
    // separate from the high-valued Win32/VFS handle namespace: Win9x CRTs
    // use values above 0xffff for their own heap-backed descriptor objects.
    this._nextLegacyHandle = 4;
    // MSVCRT _findfirst treats a successful Win32 search handle as a signed
    // integer and rejects negative values before checking INVALID_HANDLE_VALUE.
    // Keep this namespace positive while remaining distinct from file handles.
    this._nextFindHandle = 0x6A000001;
    this.cwd = 'C:\\';
    this._tempCounter = 1;

    // Pre-create standard directories
    this.dirs.add('c:');
    this.dirs.add('c:\\');
    this.dirs.add('c:\\windows');
    this.dirs.add('c:\\windows\\system');
    this.dirs.add('c:\\windows\\temp');
    this.dirs.add('c:\\windows\\desktop');
    this.dirs.add('c:\\windows\\application data');
    this.dirs.add('c:\\windows\\start menu');
    this.dirs.add('c:\\windows\\start menu\\programs');
    this.dirs.add('c:\\windows\\start menu\\programs\\startup');
    this.dirs.add('c:\\temp');
    this.dirs.add('c:\\program files');
  }

  _normPath(p) {
    let n = p.toLowerCase().replace(/\//g, '\\');
    // Collapse . and .. components, skip empty parts (from double backslashes)
    const parts = n.split('\\');
    const out = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === '' && i > 0) continue; // skip empty parts (but keep drive root)
      if (part === '.') continue;
      if (part === '..') {
        // Win32 clamps parent traversal at a drive root. Keeping the `..`
        // here turns C:\..\Maps into a literal, unreachable directory; UE1
        // uses that spelling while its executable lives conceptually in
        // C:\System, and an ad-hoc root-mounted executable must still discover
        // the sibling asset directory.
        if (out.length > 1) out.pop();
        continue;
      }
      out.push(part);
    }
    n = out.join('\\');
    if (n.length > 3 && n.endsWith('\\')) n = n.slice(0, -1);
    return n;
  }

  _resolvePath(p) {
    // Classify after accepting Win32's alternate separator. Otherwise C:/dir
    // is mistaken for drive-relative C:dir and gets the current directory twice.
    let resolved = p.replace(/\//g, '\\');
    const driveRelative = /^([a-zA-Z]):([^\\].*)?$/.exec(resolved);
    if (driveRelative) {
      const drive = driveRelative[1].toLowerCase();
      const suffix = driveRelative[2] || '';
      const cwdDrive = this.cwd.slice(0, 1).toLowerCase();
      const base = drive === cwdDrive ? this.cwd : `${drive}:\\`;
      resolved = suffix ? base.replace(/\\$/, '') + '\\' + suffix : base;
    // If relative (no drive letter), prepend CWD
    } else if (!/^[a-zA-Z]:/.test(resolved) && !resolved.startsWith('\\\\')) {
      if (resolved.startsWith('\\')) {
        // Root-relative path (\foo) — prepend drive letter from CWD
        resolved = this.cwd.slice(0, 2) + resolved;
      } else {
        resolved = this.cwd.replace(/\\$/, '') + '\\' + resolved;
      }
    }
    return this._normPath(resolved);
  }

  _parentDir(p) {
    // Strip trailing backslash before computing parent
    let s = (p.length > 3 && p.endsWith('\\')) ? p.slice(0, -1) : p;
    const idx = s.lastIndexOf('\\');
    if (idx <= 2) return s.slice(0, 3); // root
    return s.slice(0, idx);
  }

  _fileName(p) {
    let s = (p.length > 3 && p.endsWith('\\')) ? p.slice(0, -1) : p;
    const idx = s.lastIndexOf('\\');
    return idx >= 0 ? s.slice(idx + 1) : s;
  }

  // Mount helpers normally receive a file path rather than an explicit drive
  // declaration. Register the drive itself as well as every parent so Win32
  // drive scans can chdir to and enumerate non-C media roots.
  ensureParentDirs(path) {
    const norm = this._normPath(path);
    if (/^[a-z]:/i.test(norm)) {
      this.dirs.add(norm.slice(0, 2));
      this.dirs.add(norm.slice(0, 2) + '\\');
    }
    let p = norm;
    while (true) {
      const idx = p.lastIndexOf('\\');
      if (idx <= 2) break;
      p = p.slice(0, idx);
      this.dirs.add(p);
    }
  }

  setDriveReadOnly(drive, readOnly = true) {
    const letter = String(drive || '').replace(/:$/, '').toLowerCase();
    if (!/^[a-z]$/.test(letter)) throw new Error(`invalid drive letter: ${drive}`);
    if (readOnly) this.readOnlyDrives.add(letter);
    else this.readOnlyDrives.delete(letter);
  }

  _isReadOnlyPath(path) {
    const norm = this._resolvePath(path);
    return norm.length >= 2 && norm[1] === ':' && this.readOnlyDrives.has(norm[0]);
  }

  _watchDirectory(path) {
    const norm = this._resolvePath(path);
    return /^[a-z]:$/i.test(norm) ? norm + '\\' : norm;
  }

  registerChangeNotification(handle, path, watchSubtree, filter, callbacks = {}) {
    handle >>>= 0;
    const directory = this._watchDirectory(path);
    if (!handle || this.changeNotifications.has(handle) ||
        !(this.dirs.has(directory) || this.dirs.has(directory.replace(/\\$/, '')))) {
      return false;
    }
    this.changeNotifications.set(handle, {
      directory,
      watchSubtree: !!watchSubtree,
      filter: filter >>> 0,
      armed: true,
      pending: false,
      signal: typeof callbacks.signal === 'function' ? callbacks.signal : () => false,
      reset: typeof callbacks.reset === 'function' ? callbacks.reset : () => false,
      close: typeof callbacks.close === 'function' ? callbacks.close : () => false,
    });
    return true;
  }

  _changeMatches(watch, path) {
    const changed = this._resolvePath(path);
    if (changed === watch.directory) return false;
    const prefix = watch.directory.endsWith('\\')
      ? watch.directory : watch.directory + '\\';
    if (!changed.startsWith(prefix)) return false;
    return watch.watchSubtree || this._parentDir(changed) === watch.directory;
  }

  _notifyChange(path, filter) {
    filter >>>= 0;
    if (!filter) return;
    for (const [handle, watch] of this.changeNotifications) {
      if (!(watch.filter & filter) || !this._changeMatches(watch, path)) continue;
      if (!watch.armed) {
        watch.pending = true;
        continue;
      }
      watch.armed = false;
      watch.signal(handle);
    }
  }

  nextChangeNotification(handle) {
    handle >>>= 0;
    const watch = this.changeNotifications.get(handle);
    if (!watch || !watch.reset(handle)) return false;
    if (watch.pending) {
      watch.pending = false;
      watch.armed = false;
      watch.signal(handle);
    } else {
      watch.armed = true;
    }
    return true;
  }

  closeChangeNotification(handle) {
    handle >>>= 0;
    const watch = this.changeNotifications.get(handle);
    if (!watch) return false;
    this.changeNotifications.delete(handle);
    return !!watch.close(handle);
  }

  createFile(path, access, creation) {
    return this.createFileResult(path, access, creation).handle;
  }

  createFileResult(path, access, creation) {
    if (this._diskHandlesRetired) return { handle: 0, error: 6 };
    const norm = this._resolvePath(path);
    const name = this.files.has(norm)
      ? (this.files.get(norm).name || this._fileName(norm))
      : this._fileName(String(path).replace(/\//g, '\\'));
    const rights = fileAccessMask(access);
    if (creation < 1 || creation > 5 || !Number.isInteger(creation)) return { handle: 0, error: 87 };
    // Truncation requires write-data access, not merely append or attributes.
    // Validate before allocating a handle, notifying watchers or changing data.
    if (creation === 5 && !(rights & 2)) return { handle: 0, error: 5 };
    // \\.\NAME is the Win32 device namespace: a driver, VxD or volume, never
    // a file. The VFS has no devices, so every disposition fails as a missing
    // device does -- OPEN_ALWAYS must not quietly create a file there. A
    // device the emulator does model is claimed in WAT before this is reached
    // (QUARTZ.VXD, 09a0c); any other VxD handed a file here would have its
    // DeviceIoControl fail in ways the caller never expects from a device.
    if (/^[\\/]{2}\.[\\/]/.test(String(path))) return { handle: 0, error: 2 };
    // Win9x CreateFile cannot open a directory under any disposition and
    // fails it with ERROR_ACCESS_DENIED, not FILE_NOT_FOUND. Myth's
    // directory-exists probe (CreateFile dir, OPEN_EXISTING) reads 5 as
    // "exists"; a 2 sends it into CreateDirectory/recursion forever.
    if (!this.files.has(norm) && this._isDirectory(norm)) return { handle: 0, error: 5 };
    const wantsWrite = (rights & 0x116) !== 0;
    const exists = this.files.has(norm);
    // Lookups are exact. There used to be a basename fallback here for a
    // missing non-C: path, meant for games scanning drive letters for their
    // CD; it silently served Colin McRae Rally c:\demo\english.txt for
    // Q:\Game\language\english.txt. Media belongs at the drive the game asks
    // for (D: is the CD-ROM), and a miss reports what Win32 reports: no such
    // directory is ERROR_PATH_NOT_FOUND, no such file in a real one
    // ERROR_FILE_NOT_FOUND.
    const missingError = this.dirs.has(this._parentDir(norm)) ? 2 : 3;
    const changesFile = creation === 1 || creation === 2 || creation === 5 ||
      (creation === 4 && !exists);
    if ((wantsWrite || changesFile) && this._isReadOnlyPath(norm)) return { handle: 0, error: 19 };
    // Reserve before any creation/truncation side effect. Failed opens may
    // leave a gap in the opaque handle sequence, but never replace a live one.
    const h = this._allocateFileHandle();
    if (!h) return { handle: 0, error: 4 };
    const oldSize = exists ? entrySize(this.files.get(norm)) : 0;
    let changeFilter = 0;
    // creation: 1=CREATE_NEW, 2=CREATE_ALWAYS, 3=OPEN_EXISTING, 4=OPEN_ALWAYS, 5=TRUNCATE_EXISTING
    switch (creation) {
      case 1: // CREATE_NEW
        if (exists) return { handle: 0, error: 80 }; // ERROR_FILE_EXISTS
        this.files.set(norm, createFileEntry(new Uint8Array(0), 0x80)); // FILE_ATTRIBUTE_NORMAL
        changeFilter = FILE_NOTIFY_CHANGE_FILE_NAME | FILE_NOTIFY_CHANGE_LAST_WRITE;
        break;
      case 2: { // CREATE_ALWAYS: truncation does not replace file identity
        const prior = this.files.get(norm);
        const replacement = prior || createFileEntry(new Uint8Array(0), 0x80);
        replacement.data = new Uint8Array(0);
        delete replacement._capacityData;
        delete replacement._size;
        delete replacement._provider;
        this.files.set(norm, replacement);
        changeFilter = exists
          ? FILE_NOTIFY_CHANGE_LAST_WRITE | (oldSize ? FILE_NOTIFY_CHANGE_SIZE : 0)
          : FILE_NOTIFY_CHANGE_FILE_NAME | FILE_NOTIFY_CHANGE_LAST_WRITE;
        break;
      }
      case 3: // OPEN_EXISTING
        if (!exists) return { handle: 0, error: missingError };
        break;
      case 4: // OPEN_ALWAYS
        if (!exists) {
          this.files.set(norm, createFileEntry(new Uint8Array(0), 0x80));
          changeFilter = FILE_NOTIFY_CHANGE_FILE_NAME | FILE_NOTIFY_CHANGE_LAST_WRITE;
        }
        break;
      case 5: // TRUNCATE_EXISTING
        if (!exists) return { handle: 0, error: missingError };
        this.files.get(norm).data = new Uint8Array(0);
        delete this.files.get(norm)._capacityData;
        changeFilter = FILE_NOTIFY_CHANGE_LAST_WRITE | (oldSize ? FILE_NOTIFY_CHANGE_SIZE : 0);
        break;
      default:
        return { handle: 0, error: 87 };
    }
    this.files.get(norm).name = name;
    this.handles.set(h, { path: norm, pos: 0, access,
      entry: this.files.get(norm), fileOwner: { refs: 1, locks: new Set() } });
    // Ensure every parent exists; archive caches commonly create the output
    // file before separately enumerating both parent levels.
    this.ensureParentDirs(norm);
    this._notifyChange(norm, changeFilter);
    return { handle: h, error: exists && (creation === 2 || creation === 4) ? 183 : 0 };
  }

  // One positive disk-handle namespace for opens and duplicates. Keep the
  // existing tombstone policy: neither live nor closed records are overwritten.
  _allocateFileHandle() {
    let next = this._nextHandle >>> 0;
    if (next < 0x70000001 || next > 0x7fffffff) next = 0x70000001;
    const first = next;
    while (this.handles.has(next)) {
      next = next === 0x7fffffff ? 0x70000001 : next + 1;
      if (next === first) return 0;
    }
    this._nextHandle = next === 0x7fffffff ? 0x70000001 : next + 1;
    return next;
  }

  // Separate handle lifetime/access from the shared seek position of one open
  // file. Ordinary opens keep their plain record until the first duplication.
  _shareFilePosition(record, position) {
    Object.defineProperty(record, '_position', { value: position });
    Object.defineProperty(record, 'pos', {
      enumerable: true, configurable: true,
      get() { return position.value; },
      set(value) { position.value = value; },
    });
    return record;
  }

  // Positive handle on success, negative Win32 error for a recognized file,
  // zero for a different handle namespace (dispatched by the WAT caller).
  duplicateFileHandle(handle, desiredAccess, inherit, options, sameProcess = true) {
    handle >>>= 0;
    const source = this.handles.get(handle);
    if (!source) return handle >= 0x70000000 && handle <= 0x7fffffff ? -6 : 0;
    const closeSource = (options & 1) !== 0;
    const finish = value => {
      if (closeSource) this.closeHandle(handle);
      return value;
    };
    // Cross-process transfer is unsupported, but CLOSE_SOURCE still applies
    // on failure. Do not leak this handle or its locks through the rejection.
    if (!sameProcess) return finish(-6);
    if (source.closed) return finish(-6); // ERROR_INVALID_HANDLE
    if (options & ~3) return finish(-87); // ERROR_INVALID_PARAMETER
    const access = (options & 2) ? source.access : desiredAccess;
    if ((fileAccessMask(access) & ~fileAccessMask(source.access)) !== 0) return finish(-5);
    const next = this._allocateFileHandle();
    if (!next) return finish(-4); // ERROR_TOO_MANY_OPEN_FILES
    const position = source._position || { value: source.pos };
    if (!source._position) this._shareFilePosition(source, position);
    const duplicate = this._shareFilePosition({ ...source, access, inherit: !!inherit, closed: false }, position);
    // Descriptor flags and position are inherited, never FILE ownership.
    delete duplicate.crtStreamOwner;
    this.handles.set(next, duplicate);
    if (duplicate.fileOwner) duplicate.fileOwner.refs++;
    return finish(next);
  }

  fileEntry(fh) { return fh && (fh.entry || this.files.get(fh.path)); }

  lockFile(handle, offsetLow, offsetHigh, lengthLow, lengthHigh, unlock = false) {
    const fh = this.getOpenFile(handle);
    const entry = this.fileEntry(fh);
    if (!fh || !entry) return 6;
    if (!(fileAccessMask(fh.access) & 3)) return 5;
    const start = (BigInt(offsetHigh >>> 0) << 32n) | BigInt(offsetLow >>> 0);
    const length = (BigInt(lengthHigh >>> 0) << 32n) | BigInt(lengthLow >>> 0);
    const end = start + length;
    if (end > (1n << 64n)) return 87;
    const owner = fh.fileOwner ||= { refs: 1, locks: new Set() };
    let locks = fileByteLocks.get(entry);
    if (!locks) fileByteLocks.set(entry, locks = new Set());
    if (unlock) {
      for (const lock of locks) {
        if (lock.owner === owner && lock.start === start && lock.end === end) {
          locks.delete(lock);
          owner.locks.delete(lock);
          return 0;
        }
      }
      return 158; // ERROR_NOT_LOCKED
    }
    for (const lock of locks) {
      if (byteRangesOverlap(lock, { start, end })) return 33;
    }
    for (const read of filePendingReads.get(entry) || []) {
      if (read.owner !== owner && byteRangesOverlap(read, { start, end })) return 33;
    }
    const lock = { start, end, owner, locks };
    locks.add(lock);
    owner.locks.add(lock);
    return 0;
  }

  fileLockError(fh, position, count) {
    if (!count) return 0;
    const locks = fileByteLocks.get(this.fileEntry(fh));
    if (!locks?.size) return 0;
    const start = BigInt(position), end = start + BigInt(count);
    for (const lock of locks) {
      // Zero-byte locks constrain locks, but contain no bytes for I/O.
      if (lock.owner !== fh.fileOwner && lock.start !== lock.end &&
          start < lock.end && lock.start < end) return 33;
    }
    return 0;
  }

  closeAllDiskHandles() {
    // Reject late Worker calls after teardown has begun, even before the
    // asynchronous Worker retirement barrier completes.
    this._diskHandlesRetired = true;
    for (const [handle, record] of this.handles) {
      if (!record.closed) this.closeHandle(handle);
    }
  }

  createLegacyFile(path, access, creation) {
    const internal = this.createFile(path, access, creation);
    if (!internal) return 0;

    let h = this._nextLegacyHandle;
    while (h < 0xFFFF && this.handles.has(h)) h++;
    if (h >= 0xFFFF) {
      this.handles.delete(internal >>> 0);
      return 0;
    }

    const state = this.handles.get(internal >>> 0);
    this.handles.delete(internal >>> 0);
    this.handles.set(h, state);
    this._nextLegacyHandle = h + 1;
    return h;
  }

  getIoState(threadId = 1) {
    threadId >>>= 0;
    // Keep the direct VFS API as the main thread's state, not a second mirror.
    if (threadId === 1) return this;
    let state = this._threadIo.get(threadId);
    if (!state) {
      state = { pendingRead: null, readFault: 0, readFaults: new Map(),
        _readRetries: new WeakMap(), active: true };
      this._threadIo.set(threadId, state);
    }
    return state;
  }

  getPendingRead(threadId = 1) {
    return (threadId === 1 ? this : this._threadIo.get(threadId >>> 0))?.pendingRead || null;
  }

  releaseIoState(threadId) {
    const state = this._threadIo.get(threadId >>> 0);
    if (!state) return;
    state.active = false;
    if (state._lockRead) state._lockRead.reads.delete(state._lockRead);
    for (const cancel of state._mappingCleanups || []) cancel();
    state._mappingCleanups?.clear();
    state.pendingRead = null;
    state.readFaults.clear();
    state._readRetries = new WeakMap();
    this._threadIo.delete(threadId >>> 0);
  }

  readFile(handle, buf, nToRead, threadId = 1) {
    const io = this.getIoState(threadId);
    handle = handle >>> 0;
    const fh = this.getOpenFile(handle);
    const accessError = fileDataAccessError(fh, false);
    if (accessError) return { ok: false, bytesRead: 0, error: accessError };
    const lockError = this.fileLockError(fh, fh.pos, nToRead);
    if (lockError) return { ok: false, bytesRead: 0, error: lockError };
    const entry = this.fileEntry(fh);
    if (!entry) return { ok: false, bytesRead: 0 };
    // Provider-backed entry: serve the range straight out of the chunk cache
    // without materializing the file. A cache miss is reported as `pending`,
    // never as a short read — the caller (fs_read_file) turns it into an
    // IO_WAIT yield, fills the chunk, and re-enters this same call.
    if (!fh.readData && entry._provider) {
      // A fill that failed (or that kept failing to satisfy the same read) is
      // latched here, so the very next attempt completes the call as a Win32
      // read failure. Without the latch a dead provider is an infinite
      // park/retry loop, which presents as a hang with no error anywhere.
      const fault = io.readFaults.get(handle);
      if (fault && (fault.fileRecord !== fh || fault.entry !== entry || fault.provider !== entry._provider)) {
        io.readFaults.delete(handle);
      } else if (fault && fault.pos === fh.pos) {
        io.readFaults.delete(handle);
        io._readRetries.delete(fh);
        return { ok: false, bytesRead: 0, faulted: true, error: fault.error };
      }
      const avail = Math.max(0, entry._size - fh.pos);
      const toRead = Math.min(nToRead, avail);
      if (toRead === 0) return { ok: true, bytesRead: 0 };
      const bytes = providerReadSync(entry, fh.pos, toRead);
      if (!bytes) {
        const prev = io._readRetries.get(fh);
        // Bound repeated unsatisfied fills for this range independently of peer
        // handles and scheduler-slot cleanup. This is a provider safeguard,
        // not a Windows retry-count contract.
        const again = prev && prev.entry === entry && prev.provider === entry._provider &&
          prev.pos === fh.pos && prev.length === toRead
          ? prev.attempts + 1 : 1;
        if (again > 3) {
          // Loud on purpose: the guest only sees ERROR_READ_FAULT, and a game
          // that ignores it draws from an empty buffer with nothing to say why.
          console.warn(`[io] lazy read of ${fh.path} @${fh.pos}+${toRead} still not resident ` +
            `after ${again - 1} fills; failing it as ERROR_READ_FAULT`);
          io._readRetries.delete(fh);
          if (io.pendingRead?.fileRecord === fh) io.pendingRead = null;
          return { ok: false, bytesRead: 0, faulted: true, error: 30 };
        }
        return {
          ok: false,
          bytesRead: 0,
          pending: {
            ioState: io,
            fileRecord: fh,
            entry,
            provider: entry._provider,
            path: fh.path,
            handle,
            pos: fh.pos,
            attempts: again,
            offset: (entry._offset || 0) + fh.pos,
            length: toRead,
          },
        };
      }
      io.readFaults.delete(handle);
      // A scatter retry may first replay a cached prefix. Only progress at
      // the missing range retires its history; the prefix must not reset it.
      if (io._readRetries.get(fh)?.pos === fh.pos) io._readRetries.delete(fh);
      buf.set(bytes.subarray(0, toRead));
      fh.pos += toRead;
      return { ok: true, bytesRead: toRead };
    }
    const source = fh.readData || entry.data;
    const avail = Math.max(0, source.length - fh.pos);
    const toRead = Math.min(nToRead, avail);
    buf.set(source.subarray(fh.pos, fh.pos + toRead));
    fh.pos += toRead;
    return { ok: true, bytesRead: toRead };
  }

  writeFile(handle, data, nToWrite) {
    handle = handle >>> 0;
    const fh = this.getOpenFile(handle);
    const accessError = fileDataAccessError(fh, true);
    if (accessError) return { ok: false, bytesWritten: 0, error: accessError };
    if (this._isReadOnlyPath(fh.path)) return { ok: false, bytesWritten: 0, error: 19 }; // ERROR_WRITE_PROTECT
    if (!nToWrite) return { ok: true, bytesWritten: 0 };
    let entry = this.fileEntry(fh);
    if (!entry) {
      entry = createFileEntry(new Uint8Array(0), 0x80);
      this.files.set(fh.path, entry);
    }
    const oldSize = entrySize(entry);
    // FILE_APPEND_DATA alone permits extending, not overwriting existing data.
    const writePos = (!(fh.access & FILE_WRITE_ACCESS) || (fh.crtOpenFlags & 8)) ? oldSize : fh.pos;
    const lockError = this.fileLockError(fh, writePos, nToWrite);
    if (lockError) return { ok: false, bytesWritten: 0, error: lockError };
    ensureFileTimes(entry);
    fh.pos = writePos;
    const newEnd = fh.pos + nToWrite;
    let backing = entry._capacityData || entry.data;
    if (newEnd > backing.length) {
      // Grow geometrically. Archive decompressors write thousands of small
      // chunks; reallocating exactly to newEnd on each call is quadratic.
      let capacity = Math.max(1024, backing.length || 1);
      while (capacity < newEnd) capacity = Math.max(capacity * 2, newEnd);
      const grown = new Uint8Array(capacity);
      grown.set(entry.data);
      backing = grown;
    }
    if (fh.pos > oldSize) backing.fill(0, oldSize, fh.pos);
    backing.set(data.subarray(0, nToWrite), fh.pos);
    const logicalSize = Math.max(oldSize, newEnd);
    entry._capacityData = backing;
    entry.data = backing.subarray(0, logicalSize);
    fh.pos += nToWrite;
    if (nToWrite) {
      entry.lastWriteTime = currentFileTime();
      this._notifyChange(fh.path, FILE_NOTIFY_CHANGE_LAST_WRITE |
        (logicalSize !== oldSize ? FILE_NOTIFY_CHANGE_SIZE : 0));
    }
    return { ok: true, bytesWritten: nToWrite };
  }

  setFilePointer(handle, distance, moveMethod) {
    const result = this.setFilePointerResult(handle, distance, moveMethod);
    return result.error ? 0xffffffff : result.position;
  }

  setFilePointerResult(handle, distance, moveMethod, maxPosition = Number.MAX_SAFE_INTEGER) {
    handle = handle >>> 0;
    const fh = this.getOpenFile(handle);
    if (!fh) return { error: 6 }; // ERROR_INVALID_HANDLE
    if (typeof distance !== 'bigint' && !Number.isSafeInteger(distance)) return { error: 87 };
    const entry = this.fileEntry(fh);
    const size = fh.readData ? fh.readData.length : entrySize(entry);
    let base;
    switch (moveMethod) {
      case 0: base = 0; break;       // FILE_BEGIN
      case 1: base = fh.pos; break; // FILE_CURRENT
      case 2: base = size; break;    // FILE_END
      default: return { error: 87 }; // ERROR_INVALID_PARAMETER
    }
    const position = BigInt(base) + BigInt(distance);
    if (position < 0n) return { error: 131 }; // ERROR_NEGATIVE_SEEK: no cursor change
    // Backing providers use exact JS Number offsets. Reject unrepresentable
    // positions rather than silently rounding a guest's 64-bit request.
    if (position > BigInt(maxPosition)) return { error: 87 };
    fh.pos = Number(position);
    return { error: 0, position: fh.pos };
  }

  setEndOfFile(handle) {
    return this.setEndOfFileResult(handle) === 0;
  }

  setEndOfFileResult(handle) {
    handle = handle >>> 0;
    const fh = this.getOpenFile(handle);
    if (!fh) return 6; // ERROR_INVALID_HANDLE
    // Append-only access cannot authorize truncation or arbitrary extension.
    if (!(fh.access & FILE_WRITE_ACCESS)) return 5; // ERROR_ACCESS_DENIED
    if (this._isReadOnlyPath(fh.path)) return 19; // ERROR_WRITE_PROTECT
    const entry = this.fileEntry(fh);
    if (!entry) return 6;
    const oldSize = entry.data.length;
    const newSize = Math.max(0, fh.pos);
    if (newSize === oldSize) return 0;
    let backing = entry._capacityData || entry.data;
    if (newSize > backing.length) {
      let capacity = Math.max(1024, backing.length || 1);
      while (capacity < newSize) capacity = Math.max(capacity * 2, newSize);
      const grown = new Uint8Array(capacity);
      grown.set(entry.data);
      backing = grown;
    }
    if (newSize > oldSize) backing.fill(0, oldSize, newSize);
    entry._capacityData = backing;
    entry.data = backing.subarray(0, newSize);
    ensureFileTimes(entry).lastWriteTime = currentFileTime();
    this._notifyChange(fh.path, FILE_NOTIFY_CHANGE_SIZE | FILE_NOTIFY_CHANGE_LAST_WRITE);
    return 0;
  }

  // File bytes are committed to the in-memory VFS by writeFile itself, so a
  // flush has no deferred data to move. It still has the Win32-observable
  // validation contract: only a live writable disk-file handle can succeed.
  // Return an error code so the WAT handler can preserve BOOL/GetLastError.
  flushFileBuffers(handle) {
    handle >>>= 0;
    const fh = this.getOpenFile(handle);
    if (!fh || !this.fileEntry(fh)) return 6; // ERROR_INVALID_HANDLE
    if (this._isReadOnlyPath(fh.path) ||
        !(fileAccessMask(fh.access) & 2)) {
      return 5; // ERROR_ACCESS_DENIED
    }
    return 0;
  }

  getFileTimes(handle) {
    handle >>>= 0;
    const fh = this.getOpenFile(handle);
    if (!fh) return { error: 6 }; // ERROR_INVALID_HANDLE
    const entry = this.fileEntry(fh);
    if (!entry) return { error: 6 };
    ensureFileTimes(entry);
    return {
      error: 0,
      creationTime: cloneFileTime(entry.creationTime),
      lastAccessTime: cloneFileTime(entry.lastAccessTime),
      lastWriteTime: cloneFileTime(entry.lastWriteTime),
    };
  }

  getFileInformation(handle) {
    const fh = this.getOpenFile(handle);
    const entry = fh && this.fileEntry(fh);
    if (!entry) return { error: 6 };
    const size = fh.readData ? fh.readData.length : entrySize(entry);
    if (!Number.isSafeInteger(size) || size < 0) return { error: 87 };
    ensureFileTimes(entry);
    let identity = this._fileIdentity.ids.get(entry);
    if (!identity) {
      identity = this._fileIdentity.next++;
      this._fileIdentity.ids.set(entry, identity);
    }
    return {
      error: 0, size, identity,
      attrs: (entry.attrs || 0x80) | (this._isReadOnlyPath(fh.path) ? 1 : 0),
      creationTime: cloneFileTime(entry.creationTime),
      lastAccessTime: cloneFileTime(entry.lastAccessTime),
      lastWriteTime: cloneFileTime(entry.lastWriteTime),
      // Match GetVolumeInformation's mounted serial or default C: serial.
      volumeSerial: (this.volumeSerials?.get(fh.path[0]) || 0x12345678) >>> 0,
    };
  }

  setFileTimes(handle, creationTime, lastAccessTime, lastWriteTime) {
    handle >>>= 0;
    const fh = this.getOpenFile(handle);
    if (!fh) return 6; // ERROR_INVALID_HANDLE
    if (this._isReadOnlyPath(fh.path) ||
        !(fileAccessMask(fh.access) & 0x100)) {
      return 5; // ERROR_ACCESS_DENIED
    }
    const entry = this.fileEntry(fh);
    if (!entry) return 6;
    ensureFileTimes(entry);

    let changed = false;
    const assign = (key, value) => {
      if (!value || preserveFileTime(value) || sameFileTime(entry[key], value)) return;
      entry[key] = cloneFileTime(value);
      changed = true;
    };
    assign('creationTime', creationTime);
    assign('lastAccessTime', lastAccessTime);
    assign('lastWriteTime', lastWriteTime);
    if (changed) this._notifyChange(fh.path, FILE_NOTIFY_CHANGE_LAST_WRITE);
    return 0;
  }

  getFileSize(handle) {
    handle = handle >>> 0;
    const fh = this.getOpenFile(handle);
    if (!fh) return 0xFFFFFFFF;
    const entry = this.fileEntry(fh);
    return fh.readData ? fh.readData.length : entrySize(entry);
  }

  getOpenFile(handle) {
    const record = this.handles.get(handle >>> 0);
    return record && !record.closed ? record : null;
  }

  // CRT descriptors use the same non-recycled handle identity and lifetime
  // as Win32 files. Metadata is process-owned, never Worker-instance state.
  // Query bits: known CRT=1, read=2, write=4, explicit binary=8,
  // explicit text=16, default translation=32, append=64.
  // Zero includes closed, foreign and standard-console descriptors. Querying
  // must not touch file contents (including lazy providers) or the cursor.
  queryCrtDescriptor(handle) {
    const record = this.getOpenFile(handle);
    if (!record || record.crtOpenFlags === undefined) return 0;
    const flags = record.crtOpenFlags;
    return 1 | (fileDataAccessError(record, false) ? 0 : 2) |
      (fileDataAccessError(record, true) ? 0 : 4) |
      (flags & 0x8000 ? 8 : flags & 0x4000 ? 16 : 32) |
      (flags & 8 ? 64 : 0);
  }

  // Linearization point for _fdopen: allocation/initialization has finished
  // but its FILE has not been published. A close before this call fails;
  // a close after it closes the adopted descriptor normally. Handle numbers
  // are never recycled, so the latter cannot redirect a FILE to another file.
  // No provider I/O, cursor change, allocation, or guest-memory access here.
  // Return errno, or -1 for an explicitly unsupported translation/append mode.
  adoptCrtDescriptor(handle, rights, append, owner) {
    const state = this.queryCrtDescriptor(handle);
    if (!state) return 9; // EBADF: closed, foreign, console
    if (!owner || ![2, 4, 6].includes(rights) || (append !== 0 && append !== 1)) return 22;
    if (!(state & 8) || (append && !(state & 64))) return -1;
    if ((state & rights) !== rights) return 13; // EACCES
    const record = this.getOpenFile(handle);
    if (record.crtStreamOwner !== undefined) return 22; // already adopted
    record.crtStreamOwner = owner >>> 0;
    return 0;
  }

  closeHandle(handle) {
    handle = handle >>> 0;
    if (this.handles.has(handle)) {
      const record = this.handles.get(handle);
      if (record.closed) return false;
      // Retain a tombstone for namespace/duplicate validation, never for I/O.
      // Other handles retain their own lifetime and the shared seek state.
      record.closed = true;
      for (const read of filePendingReads.get(this.fileEntry(record)) || []) {
        if (read.record === record) read.reads.delete(read);
      }
      if (record.fileOwner && --record.fileOwner.refs === 0) {
        for (const lock of record.fileOwner.locks) lock.locks.delete(lock);
        record.fileOwner.locks.clear();
      }
      for (const io of [this, ...this._threadIo.values()]) {
        io.readFaults.delete(handle);
        io._readRetries.delete(record);
        if (io.pendingRead?.fileRecord === record) io.pendingRead = null;
      }
      return true;
    }
    if (this.findHandles.has(handle)) {
      this.findHandles.delete(handle);
      return true;
    }
    return true; // non-file handles (events etc) — don't fail
  }

  getFileAttributes(path) {
    if (typeof path !== 'string' || path.length === 0) {
      return 0xFFFFFFFF; // INVALID_FILE_ATTRIBUTES
    }
    const norm = this._resolvePath(path);
    const entry = this.files.get(norm);
    if (!entry && this._isDirectory(norm)) return 0x10; // FILE_ATTRIBUTE_DIRECTORY
    if (this.dirs.has(norm)) return 0x10;
    if (entry) return (entry.attrs || 0x80) | (this._isReadOnlyPath(norm) ? 0x01 : 0);
    return 0xFFFFFFFF; // INVALID_FILE_ATTRIBUTES
  }

  setFileAttributes(path, attrs) {
    const norm = this._resolvePath(path);
    if (this._isReadOnlyPath(norm)) return false;
    const entry = this.files.get(norm);
    if (entry) {
      if (entry.attrs !== attrs) {
        entry.attrs = attrs;
        this._notifyChange(norm, FILE_NOTIFY_CHANGE_ATTRIBUTES);
      }
      return true;
    }
    if (this.dirs.has(norm)) {
      this._notifyChange(norm, FILE_NOTIFY_CHANGE_ATTRIBUTES);
      return true;
    }
    return false;
  }

  _shellPathKind(path) {
    const norm = this._resolvePath(path);
    if (this.files.has(norm)) return 'file';
    if (this.dirs.has(norm) || this.dirs.has(norm + '\\')) return 'dir';
    return '';
  }

  _shellPathChildren(path) {
    const norm = this._resolvePath(path).replace(/\\$/, '');
    const prefix = norm + '\\';
    return {
      files: [...this.files.keys()].filter(item => item.startsWith(prefix)),
      dirs: [...this.dirs].filter(item =>
        item !== norm && item !== norm + '\\' && item.startsWith(prefix)),
    };
  }

  _shellUniqueDestination(path) {
    const norm = this._resolvePath(path);
    if (!this._shellPathKind(norm)) return norm;
    const parent = this._parentDir(norm);
    const name = this._fileName(norm);
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    for (let n = 2; n < 10000; n++) {
      const candidate = `${parent}\\${stem} (${n})${ext}`;
      if (!this._shellPathKind(candidate)) return candidate;
    }
    return '';
  }

  _shellExpandSource(path, filesOnly) {
    const raw = String(path || '');
    const slash = Math.max(raw.lastIndexOf('\\'), raw.lastIndexOf('/'));
    const wildcard = Math.min(
      ...[raw.indexOf('*'), raw.indexOf('?')].filter(index => index >= 0));
    if (Number.isFinite(wildcard) && wildcard <= slash) return null;
    if (!Number.isFinite(wildcard)) {
      const norm = this._resolvePath(raw);
      return this._shellPathKind(norm) ? [norm] : [];
    }

    const norm = this._resolvePath(raw);
    const dir = this._parentDir(norm);
    const pattern = this._fileName(norm) === '*.*' ? '*' : this._fileName(norm);
    const regex = new RegExp('^' + pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
    const found = [];
    for (const file of this.files.keys()) {
      if (this._parentDir(file) === dir && regex.test(this._fileName(file))) {
        found.push(file);
      }
    }
    if (!filesOnly) {
      for (const child of this.dirs) {
        if (child !== dir && this._parentDir(child) === dir &&
            regex.test(this._fileName(child))) found.push(child);
      }
    }
    found.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
    return found;
  }

  _shellCopyPath(src, dst, recursive) {
    const srcKind = this._shellPathKind(src);
    const dstKind = this._shellPathKind(dst);
    if (srcKind === 'file') {
      if (dstKind === 'dir') return 0x80; // DE_FILEDESTISFLD
      if (this._isReadOnlyPath(dst)) return 0x10000 | 5;
      return this.copyFile(src, dst, false) ? 0 : 0x402;
    }
    if (srcKind !== 'dir') return 0x7C; // DE_INVALIDFILES
    if (dstKind === 'file') return 0x7E; // DE_FLDDESTISFILE
    const srcNorm = this._resolvePath(src).replace(/\\$/, '');
    const dstNorm = this._resolvePath(dst).replace(/\\$/, '');
    if (dstNorm.startsWith(srcNorm + '\\')) return 0x76; // DE_DESTSUBTREE
    if (this._isReadOnlyPath(dstNorm)) return 0x10000 | 5;

    const children = this._shellPathChildren(srcNorm);
    const dirs = recursive ? children.dirs : [];
    const files = children.files.filter(file =>
      recursive || this._parentDir(file) === srcNorm);
    for (const dir of dirs) {
      const target = dstNorm + dir.slice(srcNorm.length);
      if (this._shellPathKind(target) === 'file') return 0x7E;
    }
    for (const file of files) {
      const target = dstNorm + file.slice(srcNorm.length);
      if (this._shellPathKind(target) === 'dir') return 0x80;
      if (this._isReadOnlyPath(target)) return 0x10000 | 5;
    }

    this.ensureParentDirs(dstNorm);
    if (!this.dirs.has(dstNorm)) {
      this.dirs.add(dstNorm);
      this._notifyChange(dstNorm, FILE_NOTIFY_CHANGE_DIR_NAME);
    }
    for (const dir of dirs.sort((a, b) => a.length - b.length)) {
      const target = dstNorm + dir.slice(srcNorm.length);
      if (!this.dirs.has(target)) {
        this.dirs.add(target);
        this._notifyChange(target, FILE_NOTIFY_CHANGE_DIR_NAME);
      }
    }
    for (const file of files) {
      const target = dstNorm + file.slice(srcNorm.length);
      if (!this.copyFile(file, target, false)) return 0x402;
    }
    return 0;
  }

  _shellDeletePath(path, recursive) {
    const kind = this._shellPathKind(path);
    if (kind === 'file') {
      if (this._isReadOnlyPath(path)) return 0x78;
      return this.deleteFile(path) ? 0 : 0x402;
    }
    if (kind !== 'dir') return 0x7C;
    const norm = this._resolvePath(path).replace(/\\$/, '');
    if (/^[a-z]:$/i.test(norm)) return 0x74;
    if (this._isReadOnlyPath(norm)) return 0x78; // DE_ACCESSDENIEDSRC
    const children = this._shellPathChildren(norm);
    const files = children.files.filter(file =>
      recursive || this._parentDir(file) === norm);
    for (const file of files) {
      if (!this.deleteFile(file)) return 0x402;
    }
    if (!recursive && children.dirs.length) return 0x402;
    for (const dir of children.dirs.sort((a, b) => b.length - a.length)) {
      if (this.dirs.delete(dir)) this._notifyChange(dir, FILE_NOTIFY_CHANGE_DIR_NAME);
    }
    if (!this.dirs.delete(norm) && !this.dirs.delete(norm + '\\')) return 0x402;
    this._notifyChange(norm, FILE_NOTIFY_CHANGE_DIR_NAME);
    return 0;
  }

  _shellMovePath(src, dst, recursive) {
    const srcKind = this._shellPathKind(src);
    const dstKind = this._shellPathKind(dst);
    if (srcKind === 'file') {
      if (dstKind === 'dir') return 0x80;
      if (this._isReadOnlyPath(src)) return 0x78;
      if (this._isReadOnlyPath(dst)) return 0x10000 | 5;
      return this.moveFile(src, dst) ? 0 : 0x402;
    }
    if (srcKind !== 'dir') return 0x7C;
    if (dstKind === 'file') return 0x7E;
    const srcNorm = this._resolvePath(src).replace(/\\$/, '');
    const dstNorm = this._resolvePath(dst).replace(/\\$/, '');
    if (dstNorm.startsWith(srcNorm + '\\')) return 0x76;
    if (this._isReadOnlyPath(srcNorm)) return 0x78;
    if (this._isReadOnlyPath(dstNorm)) return 0x10000 | 5;
    const children = this._shellPathChildren(srcNorm);
    if (!recursive && (children.files.length || children.dirs.length)) return 0x402;
    const copied = this._shellCopyPath(srcNorm, dstNorm, recursive);
    if (copied) return copied;
    return this._shellDeletePath(srcNorm, recursive);
  }

  // Win9x SHFileOperation is the shell's bulk path mutator. The UI flags are
  // intentionally presentation-only here; the browser has no Explorer copy
  // dialog, but the requested filesystem effects and failure codes are real.
  shellFileOperation(func, fromPaths, toPaths, flags) {
    func >>>= 0;
    flags >>>= 0;
    if (![1, 2, 3, 4].includes(func) || !Array.isArray(fromPaths) ||
        fromPaths.length === 0 || fromPaths.some(path => !path || path.length >= 260) ||
        !Array.isArray(toPaths) || toPaths.some(path => !path || path.length >= 260)) {
      return 0x7C; // DE_INVALIDFILES
    }

    const sources = [];
    for (const path of fromPaths) {
      const expanded = this._shellExpandSource(path, !!(flags & 0x0080));
      if (expanded === null || expanded.length === 0) return 0x7C;
      for (const item of expanded) if (!sources.includes(item)) sources.push(item);
    }
    if (func === 3) {
      if (toPaths.length) return 0x7C;
      for (const source of sources) {
        const result = this._shellDeletePath(source, !(flags & 0x1000));
        if (result) return result;
      }
      return 0;
    }

    if (func === 4) {
      if (sources.length !== 1 || toPaths.length !== 1) return 0x72;
      const source = sources[0];
      let target = this._resolvePath(toPaths[0]);
      if (this._parentDir(source) !== this._parentDir(target)) return 0x73;
      if (source === target) return 0x71;
      if (this._shellPathKind(target) && (flags & 0x0008)) {
        target = this._shellUniqueDestination(target);
      }
      if (!target) return 0x402;
      return this._shellMovePath(source, target, !(flags & 0x1000));
    }

    if (toPaths.length === 0) return 0x7C;
    const pairs = [];
    if (flags & 0x0001) { // FOF_MULTIDESTFILES
      if (toPaths.length !== sources.length) return 0x7A; // DE_MANYDEST
      for (let i = 0; i < sources.length; i++) {
        pairs.push([sources[i], this._resolvePath(toPaths[i])]);
      }
    } else {
      if (toPaths.length !== 1) return 0x7A;
      let destination = this._resolvePath(toPaths[0]);
      const destinationIsDir = this._shellPathKind(destination) === 'dir' ||
        /[\\/]$/.test(toPaths[0]) || sources.length > 1;
      if (sources.length > 1 && this._shellPathKind(destination) === 'file') return 0x72;
      if (destinationIsDir && !this._shellPathKind(destination)) {
        this.ensureParentDirs(destination);
        this.dirs.add(destination);
        this._notifyChange(destination, FILE_NOTIFY_CHANGE_DIR_NAME);
      }
      for (const source of sources) {
        pairs.push([source, destinationIsDir
          ? destination.replace(/\\$/, '') + '\\' + this._fileName(source)
          : destination]);
      }
    }

    for (let [source, target] of pairs) {
      if (source === target) return 0x71;
      if (this._shellPathKind(target) && (flags & 0x0008)) {
        target = this._shellUniqueDestination(target);
      }
      if (!target) return 0x402;
      const result = func === 1
        ? this._shellMovePath(source, target, !(flags & 0x1000))
        : this._shellCopyPath(source, target, !(flags & 0x1000));
      if (result) return result;
    }
    return 0;
  }

  // A child process ran on a copy of this filesystem (browser-shell
  // snapshotVfs: the same entry objects in a new Map) and has ended. `before`
  // is this filesystem's file map when the child started. A child entry that
  // is not the one it inherited is the child's write; a path it inherited and
  // no longer has, its delete. Both go through createFile/writeFile/deleteFile
  // so anything wrapped around this VFS (an overlay journal) sees them as
  // ordinary guest writes. Returns { written, deleted }.
  mergeChildFrom(before, child) {
    let written = 0;
    let deleted = 0;
    for (const dir of child.dirs) if (!this.dirs.has(dir)) this.createDirectory(dir);
    for (const [path, entry] of child.files) {
      if (!entry || entry === before.get(path) || entry === this.files.get(path)) continue;
      if (entry._provider) continue;  // lazy source media, not the child's write
      const handle = this.createFile(path, 0x40000000, 2);  // GENERIC_WRITE, CREATE_ALWAYS
      if (!handle) continue;
      this.writeFile(handle, entry.data, entry.data.length);
      this.files.get(path).name = entry.name || this._fileName(path);
      this.closeHandle(handle);
      written++;
    }
    for (const path of before.keys()) {
      if (!child.files.has(path) && this.files.has(path) && this.deleteFile(path)) deleted++;
    }
    return { written, deleted };
  }

  deleteFile(path) {
    const norm = this._resolvePath(path);
    if (this._isReadOnlyPath(norm)) return false;
    const deleted = this.files.delete(norm);
    if (deleted) this._notifyChange(norm, FILE_NOTIFY_CHANGE_FILE_NAME);
    return deleted;
  }

  createDirectory(path) {
    const norm = this._resolvePath(path);
    if (this._isReadOnlyPath(norm)) return false;
    if (this.dirs.has(norm)) return false; // already exists
    this.dirs.add(norm);
    // Ensure parent exists
    this.dirs.add(this._parentDir(norm));
    this._notifyChange(norm, FILE_NOTIFY_CHANGE_DIR_NAME);
    return true;
  }

  removeDirectory(path) {
    const norm = this._resolvePath(path);
    if (this._isReadOnlyPath(norm)) return false;
    const deleted = this.dirs.delete(norm);
    if (deleted) this._notifyChange(norm, FILE_NOTIFY_CHANGE_DIR_NAME);
    return deleted;
  }

  moveFile(src, dst) {
    const normSrc = this._resolvePath(src);
    const normDst = this._resolvePath(dst);
    if (this._isReadOnlyPath(normSrc) || this._isReadOnlyPath(normDst)) return false;
    const entry = this.files.get(normSrc);
    if (!entry) return false;
    this.files.set(normDst, entry);
    if (normSrc !== normDst) this.files.delete(normSrc);
    entry.name = this._fileName(String(dst).replace(/\//g, '\\'));
    this.dirs.add(this._parentDir(normDst));
    this._notifyChange(normSrc, FILE_NOTIFY_CHANGE_FILE_NAME);
    this._notifyChange(normDst, FILE_NOTIFY_CHANGE_FILE_NAME);
    return true;
  }

  copyFile(src, dst, failIfExists) {
    const normSrc = this._resolvePath(src);
    const normDst = this._resolvePath(dst);
    if (this._isReadOnlyPath(normDst)) return false;
    const entry = this.files.get(normSrc);
    if (!entry) return false;
    const existed = this.files.has(normDst);
    if (failIfExists && existed) return false;
    const oldSize = existed ? entrySize(this.files.get(normDst)) : 0;
    const copy = {
      name: this._fileName(String(dst).replace(/\//g, '\\')),
      attrs: entry.attrs,
      creationTime: cloneFileTime(ensureFileTimes(entry).creationTime),
      lastAccessTime: cloneFileTime(entry.lastAccessTime),
      lastWriteTime: cloneFileTime(entry.lastWriteTime),
    };
    if (entry._provider) {
      // Copying off a mounted container shares the source's provider window
      // rather than pulling the bytes in. An installer copying a 600MB file
      // off a CD would otherwise materialize the whole extent here, which is
      // exactly what the lazy entry exists to avoid. The copy is still
      // independent: writing to either side drops that side's provider.
      copy._provider = entry._provider;
      copy._offset = entry._offset || 0;
      copy._size = entry._size;
      defineProviderData(copy, normDst);
    } else {
      copy.data = new Uint8Array(entry.data);
    }
    this.files.set(normDst, copy);
    this.dirs.add(this._parentDir(normDst));
    this._notifyChange(normDst,
      (existed ? 0 : FILE_NOTIFY_CHANGE_FILE_NAME) |
      FILE_NOTIFY_CHANGE_LAST_WRITE |
      (oldSize !== entrySize(entry) ? FILE_NOTIFY_CHANGE_SIZE : 0));
    return true;
  }

  findFirstFile(pattern) {
    const norm = this._resolvePath(pattern);
    const dir = this._parentDir(norm);
    const pat = this._fileName(norm);
    let results = [];

    // Win32/DOS wildcard semantics treat *.* as every entry, including names
    // with no dot (notably a CD's top-level data directory).
    const matchPat = pat === '*.*' ? '*' : pat;
    const regex = new RegExp('^' + matchPat.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');

    const collect = (searchDir) => {
      const found = [];
      // Win9x FindFirstFile exposes the filesystem's synthetic directory
      // records. Shells normally hide `.` and turn `..` into their parent row;
      // omitting both here left FAR with no way to navigate up. At a drive root
      // `..` resolves back to that root, but remains an enumerable record.
      if (this.dirs.has(searchDir)) {
        if (regex.test('.')) found.push({ name: '.', size: 0, attrs: 0x10 });
        if (regex.test('..')) found.push({ name: '..', size: 0, attrs: 0x10 });
      }
      // Search files
      for (const [path, entry] of this.files) {
        if (this._parentDir(path) === searchDir && regex.test(this._fileName(path))) {
          ensureFileTimes(entry);
          found.push({
            name: entry.name || this._fileName(path), size: entrySize(entry), attrs: entry.attrs || 0x80,
            creationTime: cloneFileTime(entry.creationTime),
            lastAccessTime: cloneFileTime(entry.lastAccessTime),
            lastWriteTime: cloneFileTime(entry.lastWriteTime),
          });
        }
      }
      // Search subdirectories
      for (const d of this.dirs) {
        if (this._parentDir(d) === searchDir && d !== searchDir && regex.test(this._fileName(d))) {
          found.push({ name: this._fileName(d), size: 0, attrs: 0x10 }); // DIRECTORY
        }
      }
      return found;
    };

    // DOSBox validates a host mount root with FindFirstFile("C:\\").  The
    // normal matcher treats the normalized drive root (`c:`) as both a parent
    // and a filename, so it can never find the root that is already present in
    // `dirs`.  Win32 accepts this drive-root probe; represent it as the same
    // directory result an exact lookup of any other directory would return.
    if (/^[a-z]:$/i.test(norm) && this.dirs.has(norm)) {
      results = [{ name: norm + '\\', size: 0, attrs: 0x10 }];
    } else {
      results = collect(dir);
    }

    // Host filesystem iteration order is platform-dependent and can produce
    // pathological Win32 enumerations like SC10, SC11, ... SC4, sc0, sc3.
    // Keep the synthetic directory records first, then use a deterministic
    // case-insensitive natural sort so game asset scans (notably RCT's
    // \Scenarios\*.SC4 walk) see a stable Windows-like order.
    if (results.length > 1) {
      results.sort((a, b) => (
        (a.name === '.' ? -2 : a.name === '..' ? -1 : 0) -
        (b.name === '.' ? -2 : b.name === '..' ? -1 : 0) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
      ));
    }

    // Exact, like createFile: no basename or current-directory retry. Both
    // used to answer a miss with some other file of the same name or pattern
    // (AoE's flat campaign\*.cpn layout, since mounted at c:\campaign).
    if (results.length === 0) return { handle: 0, entry: null };

    const h = (this._nextFindHandle++) | 0;
    this.findHandles.set(h, { results, index: 1 });
    return { handle: h, entry: results[0] };
  }

  findNextFile(handle) {
    const fh = this.findHandles.get(handle);
    if (!fh || fh.index >= fh.results.length) return null;
    return fh.results[fh.index++];
  }

  findClose(handle) {
    this.findHandles.delete(handle);
    return true;
  }

  // Register a file that exists but whose bytes have not been read yet.
  // `load()` is called at most once, the first time anything touches .data,
  // and its result replaces the accessor with a plain property so every later
  // read is an ordinary Map lookup. Writing .data (truncate, write, setEndOfFile)
  // discards the loader the same way.
  //
  // The loader is injected rather than imported because this file also runs in
  // the browser, where there is no fs to lazily read from.
  setLazyFile(path, { attrs = 0x20, size = 0, load }) {
    // Lookup keys remain folded; enumeration exposes the mounted spelling.
    const entry = ensureFileTimes({ attrs, _size: size, name: this._fileName(String(path).replace(/\//g, '\\')) });
    let data = null;
    Object.defineProperty(entry, 'data', {
      configurable: true,
      enumerable: true,
      get() {
        if (data === null) {
          data = load();
          entry._size = data.length;
        }
        return data;
      },
      set(v) {
        data = v;
        entry._size = v.length;
      },
    });
    this.files.set(this._normPath(path), entry);
    return entry;
  }

  // Mount a file whose bytes live behind a byte provider (lib/byte-provider.js)
  // — an ISO extent, a stored zip member, a dropped File, a remote URL read
  // over Range. `offset`/`length` carve the window out of the provider, so a
  // container mounts N files against one provider and one chunk cache.
  //
  // The provider is wrapped in a ChunkCache unless it already is one, because
  // the read path's synchronous `tryRead` is what the cache adds; a bare
  // provider has no synchronous shape to offer.
  setProviderFile(path, { provider, offset = 0, length, attrs = 0x20, chunkCache } = {}) {
    if (!provider) throw new Error('setProviderFile: no provider');
    const bp = chunkCache || _byteProvider();
    const cache = (provider.tryRead && provider.fill) ? provider
      : (bp ? bp.cached(provider) : null);
    if (!cache) {
      throw new Error('setProviderFile: lib/byte-provider.js is unavailable and ' +
        'the provider offers no tryRead/fill of its own');
    }
    const providerSize = providerWindowValue(cache.size, 'provider size');
    const start = providerWindowValue(offset, 'offset');
    if (start > providerSize) {
      throw new RangeError(`setProviderFile: offset ${start} exceeds provider size ${providerSize}`);
    }
    const available = providerSize - start;
    const size = length === undefined ? available : providerWindowValue(length, 'length');
    if (size > available) {
      throw new RangeError(`setProviderFile: window ${start}+${size} exceeds provider size ${providerSize}`);
    }
    const norm = this._normPath(path);
    const entry = ensureFileTimes({
      attrs,
      name: this._fileName(String(path).replace(/\//g, '\\')),
      _provider: cache,
      _offset: start,
      _size: size,
    });
    defineProviderData(entry, norm);
    this.files.set(norm, entry);
    this.ensureParentDirs(norm);
    return entry;
  }

  // Async companion to a `pending` result from readFile(): pull the missing
  // chunk in, after which the identical call succeeds synchronously. The host
  // run loop awaits this while the guest is parked on the IO_WAIT yield.
  fillPendingRead(pending) {
    if (!pending || !pending.provider) return Promise.resolve(false);
    // A numeric handle can be closed/reused while the provider awaits I/O.
    // Mapping fills have their own lifetime and do not carry a fileRecord.
    const io = pending.ioState || this;
    const current = () => io.active !== false && (!pending.fileRecord ||
      (this.getOpenFile(pending.handle) === pending.fileRecord &&
       this.fileEntry(pending.fileRecord) === pending.entry &&
       pending.entry._provider === pending.provider));
    const clear = () => { if (io.pendingRead === pending) io.pendingRead = null; };
    if (!current()) { clear(); return Promise.resolve(false); }
    // Count attempts only when the provider is actually asked. A scheduler
    // retry whose pending slot was lost to a peer is not a failed fill.
    if (pending.fileRecord) {
      io._readRetries.set(pending.fileRecord, {
        entry: pending.entry, provider: pending.provider, pos: pending.pos,
        length: pending.length, attempts: pending.attempts,
      });
    }
    const failed = err => {
      // A rejected fetch, a revoked File, a truncated Range response. Latch
      // the failure against this handle and position: the retried ReadFile
      // returns FALSE with ERROR_READ_FAULT rather than parking again.
      clear();
      if (current()) {
        io.readFaults.set(pending.handle, {
          fileRecord: pending.fileRecord, entry: pending.entry, provider: pending.provider,
          pos: pending.pos, error: 30, message: String((err && err.message) || err),
        });
      }
      return false;
    };
    let filling;
    try { filling = pending.provider.fill(pending.offset, pending.length); }
    catch (err) { return Promise.resolve(failed(err)); }
    return Promise.resolve(filling).then(
      () => { clear(); return current(); }, failed);
  }

  // Pull a provider-backed entry's bytes in and turn it into an ordinary
  // eager entry. Mount code calls this *before* handing a lazily mounted file
  // to a synchronous consumer that cannot use the ReadFile/MapViewOfFile park
  // path — see the contract note above defineProviderData. Resolves to the
  // materialized Uint8Array.
  async materialize(path) {
    const norm = this._resolvePath(path);
    const entry = this.files.get(norm);
    if (!entry) throw new Error(`materialize: no such file ${path}`);
    return this.materializeEntry(entry);
  }

  // Open sections retain a file object, not its directory name. Materialize
  // that exact object even if the namespace changes while a read is pending.
  async materializeEntry(entry) {
    if (!entry._provider) return entry.data;
    const provider = entry._provider;
    const offset = entry._offset || 0;
    const size = entry._size;
    const out = new Uint8Array(size);
    const chunkSize = provider.provider && typeof provider.provider.readRange === 'function'
      ? MATERIALIZE_CHUNK_SIZE
      : Math.max(1, Math.min(MATERIALIZE_CHUNK_SIZE, provider.chunkSize || MATERIALIZE_CHUNK_SIZE));
    for (let off = 0; off < size; off += chunkSize) {
      const want = Math.min(chunkSize, size - off);
      const bytes = await providerReadAsync(provider, offset + off, want);
      if (!(bytes instanceof Uint8Array) || bytes.length !== want) {
        const got = bytes && typeof bytes.length === 'number' ? bytes.length : 'non-byte result';
        throw new Error(`materialize: short provider read @${offset + off}+${want} (got ${got})`);
      }
      out.set(bytes, off);
    }
    // A write/truncate may have replaced the provider while an async range was
    // in flight. Preserve that newer eager value instead of resurrecting the
    // old media bytes over it.
    if (entry._provider !== provider || (entry._offset || 0) !== offset || entry._size !== size) {
      return entry.data;
    }
    entry.data = out;
    return entry.data;
  }

  // Adopt another VFS's world: file entries, directories, and per-drive
  // metadata. A ShellExecute chain-launch (a CD launcher handing off to the
  // game its installer just wrote) boots a NEW process that must see the SAME
  // filesystem. Entry objects are shared, not copied — the caller is exiting,
  // and a provider-backed entry (a mounted ISO) has live state that cannot be
  // deep-copied anyway. Per-handle runtime state (open handles, finds,
  // pending reads) deliberately stays behind.
  adoptFrom(other) {
    if (other._fileIdentity) this._fileIdentity = other._fileIdentity;
    for (const [path, entry] of other.files) this.files.set(path, entry);
    for (const dir of other.dirs) this.dirs.add(dir);
    for (const drive of other.readOnlyDrives) this.readOnlyDrives.add(drive);
    for (const key of ['volumeLabels', 'volumeSerials', 'driveTypes', 'volumeSizes']) {
      if (!(other[key] instanceof Map)) continue;
      if (!(this[key] instanceof Map)) this[key] = new Map();
      for (const [drive, value] of other[key]) this[key].set(drive, value);
    }
    this.cwd = other.cwd;
  }

  getTempPath() {
    return 'C:\\WINDOWS\\TEMP\\';
  }

  getTempFileName(dir, prefix, unique) {
    if (unique) return dir.replace(/\\$/, '') + '\\' + (prefix || 'tmp') + unique.toString(16) + '.tmp';
    const name = dir.replace(/\\$/, '') + '\\' + (prefix || 'tmp') + (this._tempCounter++).toString(16) + '.tmp';
    // Create the file
    const norm = this._normPath(name);
    this.files.set(norm, createFileEntry(new Uint8Array(0), 0x80));
    this._notifyChange(norm, FILE_NOTIFY_CHANGE_FILE_NAME | FILE_NOTIFY_CHANGE_LAST_WRITE);
    return name;
  }

  getCurrentDirectory() {
    // GetCurrentDirectory preserves the trailing slash only for a drive root.
    // Keeping our internal separator on ordinary directories made FAR treat
    // every CWD as a root and suppress its synthetic `..` panel entry.
    return this.cwd.length > 3 && this.cwd.endsWith('\\')
      ? this.cwd.slice(0, -1)
      : this.cwd;
  }

  // A directory exists when it was created or declared, or when a mounted
  // file lives under it: manifest/--vfs-include mounts write file keys only.
  // Myth: The Fallen Lords chdirs to C:\Modules (holding only a mounted
  // tcpip.dll) and enumerates *.*; refusing the chdir listed C:\ instead and
  // the game reported "no network modules". Learned dirs are cached.
  _isDirectory(norm) {
    if (this.dirs.has(norm)) return true;
    const prefix = norm.replace(/\\$/, '') + '\\';
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) { this.ensureParentDirs(key); return true; }
    }
    return false;
  }

  setCurrentDirectory(path) {
    const resolved = this._resolvePath(path);
    // SetCurrentDirectory succeeds only for an existing directory. Treating
    // arbitrary strings (including filenames and application-specific aliases)
    // as directories lets failed probes poison the process CWD.
    if (!this._isDirectory(resolved)) return false;
    this.cwd = resolved.endsWith('\\') ? resolved : resolved + '\\';
    return true;
  }

  getFullPathName(path) {
    // Lookup keys intentionally drop trailing separators. The Win32 display
    // result must retain an explicit directory terminator (including '/').
    const input = path.replace(/\//g, '\\');
    let resolved = this._resolvePath(input);
    if ((input.endsWith('\\') || /^[a-z]:$/i.test(resolved)) && !resolved.endsWith('\\')) {
      resolved += '\\';
    }
    // Retain existing case-folding policy; only uppercase the drive.
    return resolved.charAt(0).toUpperCase() + resolved.slice(1);
  }
}

/**
 * Create host imports for filesystem operations.
 * @param {object} ctx - context with getMemory(), exports
 * @returns {object} host import functions
 */
var _mu3 = typeof require !== 'undefined' ? require('./mem-utils') : (typeof window !== 'undefined' && window.memUtils || {});
// The fixed memory map, generated from the `region.declare-fixed` forms in
// src/00-regions.wat (docs/watx-region-safety-design.md §6): $GUEST_BASE for the
// two address translations, and $VIRTUAL_BACKING_BASE for the ceiling the file
// mapping allocator must not cross — that one was an adjacency written as a
// number, which is precisely what a declared region is for.
var _regionMap = typeof require !== 'undefined' ? require('./region-map.generated')
  : (typeof self !== 'undefined' ? self.RegionMap : globalThis.RegionMap);

// Shared "who called me?" hint for trace logs. Walks the stack looking for dwords
// that are preceded by a valid call opcode (E8/FF) and formats them compactly.
function _frameHint(ctx) {
  try {
    const e = ctx.exports;
    const esp = e.get_esp() >>> 0;
    const imageBase = e.get_image_base();
    const dv = new DataView(ctx.getMemory());
    const ra = dv.getUint32(
      _mu3.guestToWasm(esp, e, ctx.getMemory(), imageBase), true);
    let out = ` ra=0x${ra.toString(16)}`;
    if (_mu3.walkStackFrame) {
      const frames = _mu3.walkStackFrame(new Uint8Array(ctx.getMemory()), esp, imageBase);
      const f = _mu3.formatFrames(frames, 8);
      if (f) out += ' ' + f;
    }
    return out;
  } catch (_) { return ''; }
}

function expandRtfStylesheet(rtf) {
  if (typeof rtf !== 'string' || !rtf.startsWith('{\\rtf')) return rtf;
  const marker = '{\\stylesheet';
  const start = rtf.indexOf(marker);
  if (start < 0) return rtf;

  let depth = 0;
  let end = -1;
  for (let i = start; i < rtf.length; i++) {
    const ch = rtf[i];
    if (ch === '\\') {
      i++;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) {
      end = i + 1;
      break;
    }
  }
  if (end < 0) return rtf;

  const stylesheet = rtf.slice(start, end);
  const styles = new Map();
  const groupPattern = /\{\\s(\d+)([\s\S]*?);\}/g;
  let match;
  while ((match = groupPattern.exec(stylesheet))) {
    const number = Number(match[1]);
    const basedOn = /\\sbasedon(-?\d+)/.exec(match[2]);
    const controls = [];
    const controlPattern = /\\([a-z]+)(-?\d+)? ?/gi;
    let control;
    while ((control = controlPattern.exec(match[2]))) {
      const name = control[1].toLowerCase();
      if (name === 's' || name === 'sbasedon' || name === 'snext' || name === 'sautoupd') continue;
      controls.push(control[0].trimEnd());
    }
    styles.set(number, {
      basedOn: basedOn ? Number(basedOn[1]) : null,
      controls,
    });
  }
  if (!styles.size) return rtf;

  const resolved = new Map();
  const resolve = (number, visiting) => {
    if (resolved.has(number)) return resolved.get(number);
    const style = styles.get(number);
    if (!style || visiting.has(number)) return '';
    const next = new Set(visiting);
    next.add(number);
    const inherited = style.basedOn === null ? '' : resolve(style.basedOn, next);
    const value = inherited + style.controls.join('');
    resolved.set(number, value);
    return value;
  };

  const prefix = rtf.slice(0, start);
  const suffix = rtf.slice(end).replace(/\\s(\d+)(?=[\\\s{}])/g, (whole, number) => {
    const controls = resolve(Number(number), new Set());
    // A style application replaces the prior style's character properties.
    // Prefix with \plain so bold/italic/color from the previous paragraph do
    // not leak when the derived/base style omits an explicit "off" control.
    return controls ? whole + '\\plain' + controls : whole;
  });
  return prefix + stylesheet + suffix;
}

function createFilesystemImports(ctx) {
  // Reuse existing VFS if provided (e.g., for threads sharing the same filesystem)
  const vfs = ctx.vfs || new VirtualFS();

  // Expose vfs on ctx for external access (e.g., pre-populating files)
  ctx.vfs = vfs;

  // Win98's en-US OEM file API page is CP437. The VFS stores JavaScript
  // Unicode names, so narrow Kernel32 filename APIs decode on entry and encode
  // on return according to the process-wide SetFileApisToOEM/ANSI selection.
  // Shell APIs and named kernel objects deliberately keep their ANSI contract.
  const CP437_HIGH =
    'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒ' +
    'áíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐' +
    '└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀' +
    'αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\u00A0';
  const CP1252_CONTROLS =
    '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ';
  const cp437Bytes = new Map(Array.from(CP437_HIGH,
    (char, index) => [char, index + 0x80]));
  const cp1252Bytes = new Map(Array.from(CP1252_CONTROLS,
    (char, index) => [char, index + 0x80]));
  if (vfs.fileApisAnsi === undefined) vfs.fileApisAnsi = true;

  const decodeFileApiByte = byte => {
    if (!vfs.fileApisAnsi) {
      return byte < 0x80 ? String.fromCharCode(byte) : CP437_HIGH[byte - 0x80];
    }
    return byte < 0x80 || byte >= 0xA0
      ? String.fromCharCode(byte)
      : CP1252_CONTROLS[byte - 0x80];
  };
  const encodeFileApiChar = char => {
    const code = char.charCodeAt(0);
    if (!vfs.fileApisAnsi) return code < 0x80 ? code : (cp437Bytes.get(char) || 0x3F);
    if (code < 0x80 || (code >= 0xA0 && code <= 0xFF)) return code;
    return cp1252Bytes.get(char) || 0x3F;
  };

  const readRawStrA = (wasmAddr, maxLen = 260) =>
    _mu3.readStrA(ctx.getMemory(), wasmAddr, maxLen);
  // Kernel object names use the ANSI codepage, never SetFileApisToOEM's
  // filename mode. Share their Unicode representation with W entry points.
  const readObjectNameA = wasmAddr => readRawStrA(wasmAddr)
    .replace(/[\x80-\x9f]/g, char => CP1252_CONTROLS[char.charCodeAt(0) - 0x80]);
  const readStrA = (wasmAddr, maxLen = 260) => {
    const raw = readRawStrA(wasmAddr, maxLen);
    let result = '';
    for (let i = 0; i < raw.length; i++) {
      const byte = raw.charCodeAt(i) & 0xFF;
      result += decodeFileApiByte(byte);
    }
    return result;
  };
  const readStrW = (wasmAddr, maxLen = 260) => _mu3.readStrW(ctx.getMemory(), wasmAddr, maxLen);
  const readStr = (wasmAddr, isWide) => isWide ? readStrW(wasmAddr) : readStrA(wasmAddr);

  // SHFileOperationA's PCZZSTR values are lists of MAX_PATH-bounded strings,
  // terminated by one additional NUL. Keep the aggregate bounded too: a bad
  // guest pointer must become DE_INVALIDFILES rather than a host-side scan.
  const readMultiStrA = (wasmAddr) => {
    if (!wasmAddr) return [];
    const mem = new Uint8Array(ctx.getMemory());
    const result = [];
    let cursor = wasmAddr >>> 0;
    let total = 0;
    while (total < 32768 && result.length < 1024) {
      if (cursor >= mem.length) return null;
      if (mem[cursor] === 0) return result;
      const chars = [];
      let terminated = false;
      for (let i = 0; i < 260 && total < 32768; i++, total++) {
        if (cursor >= mem.length) return null;
        const ch = mem[cursor++];
        if (ch === 0) {
          terminated = true;
          break;
        }
        chars.push(ch);
      }
      if (!terminated || chars.length >= 260) return null;
      result.push(String.fromCharCode(...chars));
    }
    return null;
  };

  const g2w = (guestAddr) => {
    const exports = ctx.exports;
    return exports ? _mu3.g2w(guestAddr, exports.get_image_base(), ctx.getMemory && ctx.getMemory()) : guestAddr;
  };

  // Bytes contiguous in linear memory from a guest address. Sparse
  // VirtualAlloc mappings are adjacent to the guest but their backings are
  // not, so a transfer that spans two of them has to be split — see g2wSpan.
  const g2wSpan = (guestAddr, max) => {
    const exports = ctx.exports;
    if (!exports || !_mu3.g2wSpan) return max;
    return _mu3.g2wSpan(guestAddr, max, exports.get_image_base(), ctx.getMemory && ctx.getMemory());
  };

  // A view over a guest range that is safe to walk linearly, plus how far it
  // reaches. Callers loop while there is more to move.
  const guestChunk = (guestAddr, remaining) => {
    const len = Math.max(1, Math.min(remaining, g2wSpan(guestAddr, remaining)));
    return { view: new Uint8Array(ctx.getMemory(), g2w(guestAddr), len), len };
  };

  const notifyGuestWrite = (guestAddr, size) => {
    if (size && ctx.exports && ctx.exports.invalidate_code_range) {
      ctx.exports.invalidate_code_range(guestAddr >>> 0, size);
    }
  };

  const writeGuestBytes = (guestAddr, bytes) => {
    let offset = 0;
    while (offset < bytes.length) {
      const chunk = guestChunk((guestAddr + offset) >>> 0, bytes.length - offset);
      chunk.view.set(bytes.subarray(offset, offset + chunk.len));
      offset += chunk.len;
    }
    notifyGuestWrite(guestAddr, bytes.length);
  };

  // Change-notification handles are ordinary process wait objects owned by
  // ThreadManager. The VFS owns only their directory/filter/latch metadata.
  // Keep callbacks late-bound because hosts create ThreadManager after this
  // import table.
  const changeCallbacks = {
    signal: handle => !!(ctx.signalSyncHandle && ctx.signalSyncHandle(handle >>> 0)),
    reset: handle => !!(ctx.resetSyncHandle && ctx.resetSyncHandle(handle >>> 0)),
    close: handle => !!(ctx.closeSyncHandle && ctx.closeSyncHandle(handle >>> 0)),
  };

  const writeStrA = (guestAddr, str) => {
    const total = str.length + 1;
    let offset = 0;
    while (offset < total) {
      const chunk = guestChunk(guestAddr + offset, total - offset);
      for (let i = 0; i < chunk.len; i++) {
        const pos = offset + i;
        if (pos >= str.length) {
          chunk.view[i] = 0;
        } else {
          chunk.view[i] = encodeFileApiChar(str[pos]);
        }
      }
      offset += chunk.len;
    }
    notifyGuestWrite(guestAddr, total);
    return str.length;
  };

  const _matchesBytes = (bytes, pos, pattern) => {
    if (pos + pattern.length > bytes.length) return false;
    for (let i = 0; i < pattern.length; i++) {
      if (bytes[pos + i] !== pattern[i]) return false;
    }
    return true;
  };

  const _writeAscii = (dst, pos, s) => {
    for (let i = 0; i < s.length; i++) dst[pos + i] = s.charCodeAt(i) & 0xFF;
    return pos + s.length;
  };

  const _isRtfWrite = (fh, src) => {
    if (!fh || !String(fh.path || '').endsWith('.rtf')) return false;
    const rtfHeader = [0x7B, 0x5C, 0x72, 0x74, 0x66]; // {\rtf
    if (fh.pos === 0) return _matchesBytes(src, 0, rtfHeader);
    const entry = vfs.fileEntry(fh);
    return !!entry && _matchesBytes(entry.data, 0, rtfHeader);
  };

  const _patchRichEditRtfSentinelSize = (handle, data, nToWrite) => {
    const twips = ctx._richeditLastYHeightTwips | 0;
    if (!(twips > 0 && twips < 32767)) return data;
    const halfPoints = Math.round(twips / 10);
    if (!(halfPoints > 0 && halfPoints <= 999)) return data;
    const selectionLo = Math.max(0, ctx._richeditLastSelectionLo | 0);
    const selectionHi = Math.max(selectionLo, ctx._richeditLastSelectionHi | 0);

    const src = data.subarray(0, nToWrite);
    const fh = vfs.handles.get(handle >>> 0);
    if (!_isRtfWrite(fh, src)) return data;

    const fsSentinel = [0x5C, 0x66, 0x73, 0x33, 0x32, 0x37, 0x37]; // \fs3277
    const upSentinel = [0x5C, 0x75, 0x70, 0x33, 0x32, 0x37, 0x36]; // \up3276
    let changed = false;
    const out = [];
    let bodyPos = 0;
    let inBody = false;
    let selected = false;

    const pushAscii = value => {
      for (let j = 0; j < value.length; j++) out.push(value.charCodeAt(j) & 0xFF);
    };
    const startRunIfNeeded = () => {
      if (!inBody) return;
      if (!selected && bodyPos === selectionLo) {
        pushAscii('\\fs' + halfPoints + ' ');
        selected = true;
      }
      if (selected && bodyPos === selectionHi) {
        pushAscii('\\fs20 '); // WordPad's default 10pt body size.
        selected = false;
      }
    };

    for (let i = 0; i < src.length;) {
      if (_matchesBytes(src, i, upSentinel)) {
        pushAscii('\\up0');
        i += upSentinel.length;
        changed = true;
        continue;
      }
      if (_matchesBytes(src, i, fsSentinel)) {
        pushAscii(selectionLo === 0 ? '\\fs' + halfPoints : '\\fs20');
        i += fsSentinel.length;
        if (i < src.length && src[i] === 0x20) out.push(src[i++]);
        inBody = true;
        selected = selectionLo === 0;
        changed = true;
        continue;
      }

      startRunIfNeeded();
      const byte = src[i];
      out.push(byte);
      i++;
      if (!inBody) continue;

      // RTF control words and raw line breaks are syntax, not document text.
      if (byte === 0x0D || byte === 0x0A || byte === 0) continue;
      if (byte === 0x7B || byte === 0x7D) continue; // { or }
      if (byte === 0x5C && i < src.length) {
        const next = src[i];
        if (next === 0x27 && i + 2 < src.length) { // \'hh: one ANSI char
          out.push(src[i++], src[i++], src[i++]);
          bodyPos++;
          continue;
        }
        if (next === 0x5C || next === 0x7B || next === 0x7D) {
          out.push(src[i++]);
          bodyPos++;
          continue;
        }
        while (i < src.length && ((src[i] >= 0x41 && src[i] <= 0x5A) ||
               (src[i] >= 0x61 && src[i] <= 0x7A))) out.push(src[i++]);
        if (i < src.length && (src[i] === 0x2D || (src[i] >= 0x30 && src[i] <= 0x39))) {
          if (src[i] === 0x2D) out.push(src[i++]);
          while (i < src.length && src[i] >= 0x30 && src[i] <= 0x39) out.push(src[i++]);
        }
        if (i < src.length && src[i] === 0x20) out.push(src[i++]);
        continue;
      }
      bodyPos++;
    }

    return changed ? Uint8Array.from(out) : data;
  };

  const writeStrW = (guestAddr, str) => {
    const total = (str.length + 1) * 2;
    let offset = 0;
    while (offset < total) {
      const chunk = guestChunk(guestAddr + offset, total - offset);
      for (let i = 0; i < chunk.len; i++) {
        const bytePos = offset + i;
        const charPos = bytePos >>> 1;
        const value = charPos < str.length ? str.charCodeAt(charPos) : 0;
        chunk.view[i] = (bytePos & 1) ? value >>> 8 : value & 0xFF;
      }
      offset += chunk.len;
    }
    notifyGuestWrite(guestAddr, total);
    return str.length;
  };

  const writeStr = (guestAddr, str, isWide) => isWide ? writeStrW(guestAddr, str) : writeStrA(guestAddr, str);

  const gs32 = (guestAddr, val) => {
    // Production uses the same sparse-safe, code-invalidating writer as x86.
    if (ctx.exports && ctx.exports.guest_write32) {
      ctx.exports.guest_write32(guestAddr, val);
      return;
    }
    // Lightweight hosts without the writer still need page-aware output.
    let offset = 0;
    while (offset < 4) {
      const { view, len } = guestChunk((guestAddr + offset) >>> 0, 4 - offset);
      for (let i = 0; i < len; i++) view[i] = val >>> ((offset + i) * 8);
      offset += len;
    }
    notifyGuestWrite(guestAddr, 4);
  };

  const gl32 = guestAddr => {
    if (ctx.exports && ctx.exports.guest_read32) return ctx.exports.guest_read32(guestAddr) >>> 0;
    let offset = 0, value = 0;
    while (offset < 4) {
      const { view, len } = guestChunk((guestAddr + offset) >>> 0, 4 - offset);
      for (let i = 0; i < len; i++) value |= view[i] << ((offset + i) * 8);
      offset += len;
    }
    return value >>> 0;
  };

  // Fill WIN32_FIND_DATAA/W structure at guest address
  const fillFindData = (guestAddr, entry, isWide) => {
    // Encode locally, then scatter the complete structure across guest pages.
    const size = isWide ? 592 : 320;
    const mem = new Uint8Array(size);
    const dv = new DataView(mem.buffer);
    // dwFileAttributes at offset 0
    dv.setUint32(0, entry.attrs, true);
    const writeFileTime = (offset, value) => {
      if (!value) return;
      dv.setUint32(offset, value.lo >>> 0, true);
      dv.setUint32(offset + 4, value.hi >>> 0, true);
    };
    writeFileTime(4, entry.creationTime);
    writeFileTime(12, entry.lastAccessTime);
    writeFileTime(20, entry.lastWriteTime);
    // nFileSizeHigh at offset 28
    dv.setUint32(28, 0, true);
    // nFileSizeLow at offset 32
    dv.setUint32(32, entry.size, true);
    // cFileName at offset 44 (ANSI: 260 bytes, Wide: 520 bytes)
    if (isWide) {
      for (let i = 0; i < entry.name.length; i++)
        dv.setUint16(44 + i * 2, entry.name.charCodeAt(i), true);
    } else {
      for (let i = 0; i < entry.name.length; i++) {
        mem[44 + i] = encodeFileApiChar(entry.name[i]);
      }
    }
    writeGuestBytes(guestAddr, mem);
  };

  // Handles alias section objects; views own the section independently of
  // whichever handle created them. A name lives while any handle/view does.
  const _mappings = new Map();
  let _nextMappingHandle = 0xFB000001;
  // MapViewOfFile allocations: base addr → size (for UnmapViewOfFile)
  const _mappedViews = new Map();
  const newMappingHandle = (mapping, access = 0x000f003f, inherit = false) => {
    if (_nextMappingHandle >= 0xFC000000) return 0;
    const handle = (_nextMappingHandle++) | 0;
    _mappings.set(handle, { mapping, access, inherit: !!inherit });
    return handle;
  };
  const namedMapping = name => {
    if (!name) return null;
    for (const { mapping } of _mappings.values()) if (mapping.name === name) return mapping;
    for (const view of _mappedViews.values()) if (view.mapping.name === name) return view.mapping;
    for (const operation of _pendingProviderMappings.values()) {
      if (operation.mapping.name === name) return operation.mapping;
    }
    return null;
  };
  // A provider-backed read-only mapping is filled while the guest is parked
  // on IO_WAIT, then returned when the identical MapViewOfFile retries. Keep
  // the provider entry lazy: large CD archives otherwise exist once in the
  // browser heap and again in guest memory for no useful reason.
  // A parked host operation is a reference to the section, not another lookup
  // of its possibly closed handle. Repeated scheduler polls reuse its work.
  const _pendingProviderMappings = new Map();

  // Copy a run of a mapped view back onto whatever backs the section: the VFS
  // file for a file-backed mapping, the section's own bytes for a pagefile
  // one (a named anonymous section is how two guest components share state,
  // so its writes have to land somewhere the next MapViewOfFile can read).
  // Both UnmapViewOfFile and FlushViewOfFile are this operation over a
  // different span, which is why it is not written twice.
  const syncMappedView = (base, from, view, bytes) => {
    // FILE_MAP_READ and FILE_MAP_COPY views never write through to the file.
    // In particular, a read-only provider mapping has no eager entry.data to
    // receive a writeback and must stay provider-backed after it is unmapped.
    if (!(view.access & 2)) return;
    const mapping = view.mapping;
    if (!mapping) return;
    const dest = mapping.anon || (mapping.entry && mapping.entry.data);
    if (!dest) return;
    const destOffset = view.offset + (from - base);
    const toSync = Math.min(bytes, dest.length - destOffset);
    if (toSync <= 0) return;
    // Same split as the map side: a sparse-backed view is not one contiguous
    // run in linear memory.
    let synced = 0;
    while (synced < toSync) {
      const chunk = guestChunk(from + synced, toSync - synced);
      dest.set(chunk.view, destOffset + synced);
      synced += chunk.len;
    }
  };

  const releaseMappedAllocation = base => {
    if (!base) return;
    if (ctx.exports.guest_map_alloc) {
      // Use the allocator's matching release, never HeapFree on sparse views.
      if (ctx.exports.guest_map_free) ctx.exports.guest_map_free(base);
    } else if (ctx.exports.guest_free) ctx.exports.guest_free(base);
  };

  // Native Win98 views share one section address. Handles, published views and
  // parked provider operations retain that backing independently.
  const maybeReleaseSection = mapping => {
    const shared = mapping.shared;
    if (!shared || shared.references) return;
    for (const record of _mappings.values()) if (record.mapping === mapping) return;
    ctx.exports.guest_section_free(shared.base);
    delete mapping.shared;
  };
  const closeMappingHandle = handle => {
    const record = _mappings.get(handle | 0);
    if (!record) return 0;
    _mappings.delete(handle | 0);
    maybeReleaseSection(record.mapping);
    return 1;
  };
  const missingSectionRanges = (shared, start, end) => {
    const gaps = [];
    for (const [lo, hi] of shared.initialized) {
      if (hi <= start) continue;
      if (lo >= end) break;
      if (lo > start) gaps.push([start, lo]);
      start = Math.max(start, hi);
    }
    if (start < end) gaps.push([start, end]);
    return gaps;
  };
  const markSectionInitialized = (shared, start, end) => {
    const ranges = [];
    for (const [lo, hi] of shared.initialized) {
      if (hi < start) ranges.push([lo, hi]);
      else if (lo > end) { ranges.push([start, end]); start = lo; end = hi; }
      else { start = Math.min(start, lo); end = Math.max(end, hi); }
    }
    ranges.push([start, end]);
    shared.initialized = ranges;
  };
  const publishSharedView = token => {
    const { mapping, shared, offset, size, access } = token;
    const address = shared.base + offset;
    let view = _mappedViews.get(address);
    if (!view) {
      view = { mapping, shared, offset, size, access, tokens: new Set() };
      _mappedViews.set(address, view);
    }
    view.size = Math.max(view.size, size);
    view.access |= access;
    view.tokens.add(token);
    token.published = true;
    return address;
  };
  const releaseSharedView = token => {
    if (token.released) return;
    token.released = true;
    if (token.published) {
      const address = token.shared.base + token.offset;
      const view = _mappedViews.get(address);
      view.tokens.delete(token);
      if (!view.tokens.size) _mappedViews.delete(address);
    }
    token.shared.references--;
    maybeReleaseSection(token.mapping);
  };
  const mapSharedSection = (handle, mapping, access, offset, size, io, operationKey, finish) => {
    let shared = mapping.shared;
    if (!shared) {
      const base = ctx.exports.guest_section_reserve(mapping.size) >>> 0;
      if (!base) return finish(0, 8);
      shared = mapping.shared = { base, references: 0, initialized: [] };
    }
    const token = { mapping, shared, offset, size, access, published: false, released: false };
    shared.references++;
    const pageProtection = (access & 3) ? 4 : 2; // Win98 COPY pages are shared writable pages
    if (!ctx.exports.guest_section_commit(shared.base, offset, size, pageProtection)) {
      releaseSharedView(token);
      return finish(0, 8);
    }
    // A short view still exposes its last whole page. Initialize those bytes
    // too, but never fetch past the section's declared maximum size.
    const end = Math.min(mapping.size, offset + Math.ceil(size / 4096) * 4096);
    const copyFresh = (start, bytes) => {
      // Another parked read may have completed while this one awaited data.
      // Never overwrite a range that a returned view could already have dirtied.
      for (const [lo, hi] of missingSectionRanges(shared, start, start + bytes.length)) {
        for (let pos = lo; pos < hi;) {
          const chunk = guestChunk(shared.base + pos, hi - pos);
          chunk.view.set(bytes.subarray(pos - start, pos - start + chunk.len));
          pos += chunk.len;
        }
        markSectionInitialized(shared, lo, hi);
      }
    };
    const fillEager = () => {
      const data = mapping.anon || mapping.entry.data;
      for (const [lo, hi] of missingSectionRanges(shared, offset, end)) {
        copyFresh(lo, data.subarray(lo, hi));
        // Newly committed bytes past current file data are already zero.
        markSectionInitialized(shared, lo, hi);
      }
    };
    const entry = mapping.entry;
    if (!entry?._provider) {
      fillEager();
      return finish(publishSharedView(token));
    }
    const provider = entry._provider;
    const providerOffset = entry._offset || 0;
    const sourceEnd = Math.min(end, entry._size);
    const operation = { mapping, io, ready: false, address: 0, error: 0,
      retired: false, filling: null, pending: null };
    operation.cancel = () => {
      operation.retired = true;
      if (_pendingProviderMappings.get(operationKey) === operation) _pendingProviderMappings.delete(operationKey);
      releaseSharedView(token);
    };
    operation.pending = { ioState: io, handle: handle >>> 0, pos: offset, path: mapping.filePath,
      offset: providerOffset + offset, length: Math.max(0, sourceEnd - offset),
      provider: { fill: () => operation.filling || (operation.filling = (async () => {
        try {
          if (operation.retired) return;
          if (access & 2) {
            await vfs.materializeEntry(entry);
            if (operation.retired) return;
            fillEager();
          } else {
            for (const [lo, hi] of missingSectionRanges(shared, offset, sourceEnd)) {
              for (let pos = lo; pos < hi;) {
                const want = Math.min(MATERIALIZE_CHUNK_SIZE, hi - pos);
                const bytes = await providerReadAsync(provider, providerOffset + pos, want);
                if (operation.retired) return;
                if (!(bytes instanceof Uint8Array) || bytes.length !== want) {
                  throw new Error(`MapViewOfFile: short provider read @${providerOffset + pos}+${want}`);
                }
                copyFresh(pos, bytes);
                pos += want;
              }
            }
            if (sourceEnd < end) markSectionInitialized(shared, Math.max(offset, sourceEnd), end);
          }
          operation.address = publishSharedView(token);
        } catch (error) {
          releaseSharedView(token);
          if (!operation.retired) operation.error = 30;
          throw error;
        } finally { operation.ready = true; }
      })()) } };
    _pendingProviderMappings.set(operationKey, operation);
    if (!io._mappingCleanups) io._mappingCleanups = new Set();
    io._mappingCleanups.add(operation.cancel);
    io.pendingRead = operation.pending;
    return finish(0, 997);
  };

  // Bump allocator for file mappings — uses free WASM space above DLL table
  // These are WASM addresses; converted to guest addresses via w2g.
  const MAP_ALLOC_BASE = 0x07992400; // after 8MB PE staging + DLL metadata
  // End of the direct guest window: sparse VirtualAlloc backing starts here, so
  // the limit IS the next region's base and is read from it rather than retyped.
  const MAP_ALLOC_END  = _regionMap.BASE.VIRTUAL_BACKING_BASE;
  let _mapAllocPtr = MAP_ALLOC_BASE;
  const mapAlloc = (size) => {
    const aligned = (size + 0xFFF) & ~0xFFF; // page-align
    if (_mapAllocPtr + aligned > MAP_ALLOC_END) return 0;
    const ptr = _mapAllocPtr;
    _mapAllocPtr += aligned;
    return ptr; // WASM address
  };
  const w2g = () => {
    const exports = ctx.exports;
    return exports ? exports.get_image_base() - _regionMap.GUEST_BASE : 0;
  };

  const INVALID_HANDLE = 0xFFFFFFFF;
  const _traceFs = () => ctx.trace && ctx.trace.has('fs');

  const imports = {
    // mode -1 queries; 0 selects OEM; 1 selects ANSI. Keeping the state on
    // the shared VFS makes this process-wide across real guest Workers.
    fs_file_api_ansi: mode => {
      if ((mode | 0) >= 0) vfs.fileApisAnsi = !!mode;
      return vfs.fileApisAnsi ? 1 : 0;
    },

    // CreateFileA/W(path, access, shareMode, secAttr, creation, flagsAttrs, hTemplate)
    // WAT passes: pathWA, access, creation, flagsAttrs, isWide
    fs_create_file_result: (pathWA, access, creation, flagsAttrs, isWide, resultWA, threadId = 1) => {
      const path = readStr(pathWA, isWide);
      // RTF compatibility needs the complete stylesheet before publishing a
      // handle (GetFileSize must already describe the expanded read view).
      // Only this consumer materializes; ordinary lazy opens still fetch no
      // bytes. Park before returning a handle, using the same per-thread wait
      // and delayed Loading UI as ReadFile/MapViewOfFile.
      if (creation === 3 && path.toLowerCase().endsWith('.rtf')) {
        const io = vfs.getIoState(threadId);
        const norm = vfs._resolvePath(path);
        const entry = vfs.files.get(norm);
        let operation = io._rtfOpen;
        const retire = () => {
          if (io.pendingRead === operation?.pending) io.pendingRead = null;
          if (io._rtfOpen === operation) io._rtfOpen = null;
        };
        const errorResult = error => {
          new DataView(ctx.getMemory()).setUint32(resultWA, INVALID_HANDLE, true);
          return error;
        };
        if (operation && (operation.path !== norm || operation.entry !== entry ||
            operation.provider !== entry?._provider || operation.access !== access ||
            operation.flagsAttrs !== flagsAttrs)) {
          retire();
          operation = null;
        }
        if (operation?.ready) {
          retire();
          if (operation.error) return errorResult(operation.error);
          operation = null;
        }
        if (entry?._provider && !providerReadSync(entry, 0, entry._size)) {
          if (!operation) {
            // Run normal open validation, but keep no provisional handle
            // alive while waiting. Retry revalidates the current namespace;
            // deletion/replacement or an access change cannot revive an old
            // handle. OPEN_EXISTING has no creation/truncation side effects.
            const probe = vfs.createFileResult(path, access, creation);
            if (!probe.handle) return errorResult(probe.error);
            vfs.closeHandle(probe.handle);
            operation = { path: norm, entry, provider: entry._provider,
              access, flagsAttrs, ready: false, error: 0, promise: null };
            io._rtfOpen = operation;
            const own = operation;
            const provider = {
              gameData: !!own.provider.gameData,
              fill: () => {
                if (io.active === false || io._rtfOpen !== own)
                  return Promise.reject(new Error('RTF open was retired'));
                if (own.promise) return own.promise;
                own.error = 0;
                own.ready = false;
                own.promise = vfs.materializeEntry(entry).then(() => {
                  own.ready = true;
                }, error => {
                  own.error = 30; // ERROR_READ_FAULT, not false EOF/success
                  own.ready = true;
                  own.promise = null; // GameWait may explicitly retry a fill.
                  throw error;
                });
                return own.promise;
              },
            };
            own.pending = { ioState: io, provider, path: norm, offset: 0,
              length: entry._size };
          }
          io.pendingRead = operation.pending;
          return errorResult(997); // internal IO_WAIT; guest retries its thunk
        }
        if (operation) retire();
      }
      return imports.fs_create_file(pathWA, access, creation, flagsAttrs, isWide, resultWA);
    },

    // Optional resultWA is private to the result import; old callers retain
    // the handle-only ABI. Result output is the calling thread's EAX slot.
    fs_create_file: (pathWA, access, creation, flagsAttrs, isWide, resultWA = null) => {
      const path = readStr(pathWA, isWide);
      if (ctx.log) ctx.log(`[FS] CreateFile("${path}", access=0x${access.toString(16)}, creation=${creation})`);
      const result = vfs.createFileResult(path, access, creation);
      const h = result.handle;
      const finish = () => {
        if (resultWA === null) return h || INVALID_HANDLE;
        new DataView(ctx.getMemory()).setUint32(resultWA, h || INVALID_HANDLE, true);
        return result.error;
      };
      if (_traceFs()) {
        let caller = '';
        if (!path || path.length < 3) {
          caller = _frameHint(ctx);
        }
        console.log(`[fs] CreateFile("${path}", access=0x${access.toString(16)}, creation=${creation}) → ${h ? '0x'+(h>>>0).toString(16) : 'FAIL'}${caller}`);
      }
      if (!h) return finish();
      // RichEdit 2.x accepts stylesheet declarations but does not reliably
      // apply inherited style properties from Win98-era RTF. Present an
      // equivalent direct-control view to readers while leaving stored bytes
      // untouched for round-trip fidelity and other consumers.
      if (creation === 3 && String(path || '').toLowerCase().endsWith('.rtf')) {
        const fh = vfs.handles.get(h >>> 0);
        const entry = fh && vfs.fileEntry(fh);
        if (fh && entry && entry.data.length) {
          let source = '';
          for (let i = 0; i < entry.data.length; i++) source += String.fromCharCode(entry.data[i]);
          const expanded = expandRtfStylesheet(source);
          if (expanded !== source) {
            const bytes = new Uint8Array(expanded.length);
            for (let i = 0; i < expanded.length; i++) bytes[i] = expanded.charCodeAt(i) & 0xFF;
            fh.readData = bytes;
          }
        }
      }
      return finish();
    },

    // One broker operation opens and tags the descriptor before publishing
    // it to guest code. No separate registration RPC can race with close.
    fs_crt_open: (pathWA, flags) => {
      if ((flags & 3) === 3 || (flags & 0xc000) === 0xc000) return INVALID_HANDLE;
      const access = flags & 2 ? 0xc0000000 : flags & 1 ? 0x40000000 : 0x80000000;
      const creation = flags & 0x100
        ? flags & 0x400 ? 1 : flags & 0x200 ? 2 : 4
        : flags & 0x200 ? 5 : 3;
      const handle = imports.fs_create_file(pathWA, access, creation, 0x80, 0);
      if ((handle >>> 0) !== INVALID_HANDLE) {
        const record = vfs.getOpenFile(handle);
        record.crtOpenFlags = flags >>> 0;
        if (flags & 8) vfs.setFilePointer(handle, 0, 2);
      }
      return handle;
    },

    fs_crt_descriptor_query: handle => vfs.queryCrtDescriptor(handle),
    fs_crt_descriptor_adopt: (handle, rights, append, owner) =>
      vfs.adoptCrtDescriptor(handle, rights, append, owner),

    // _lopen/_lcreat compatibility. These APIs return a 16-bit HFILE even
    // though the backing VFS normally uses high-valued Win32 handles.
    fs_create_legacy_file: (pathWA, access, creation, flagsAttrs, isWide) => {
      const path = readStr(pathWA, isWide);
      const h = vfs.createLegacyFile(path, access, creation);
      if (_traceFs()) {
        console.log(`[fs] LegacyOpen("${path}", access=0x${access.toString(16)}, creation=${creation}) → ${h ? '0x'+h.toString(16) : 'FAIL'}`);
      }
      return h || INVALID_HANDLE;
    },

    // SearchPathA(lpPath, lpFileName, lpExtension, nBufLen, lpBuffer, lpFilePartPtr)
    //   Search current dir + optional lpPath for lpFileName [+ lpExtension].
    //   On success: writes full path into lpBuffer, returns length (excl. NUL).
    //   On failure: returns 0.
    fs_search_path: (pathWA, fileNameWA, extWA, bufLen, bufGA, filePartPtrGA, isWide) => {
      if (!fileNameWA) return 0;
      const origName = readStr(fileNameWA, isWide);
      if (!origName) return 0;
      const names = [origName];
      if (extWA && !origName.includes('.')) {
        const ext = readStr(extWA, isWide);
        if (ext) names.push(origName + (ext.startsWith('.') ? ext : ('.' + ext)));
      }
      // Apps sometimes double-append the extension (e.g. "Grad_k2.gif.gif").
      // Try stripping a duplicated trailing ".X.X" suffix as a fallback.
      const m = origName.match(/^(.+?)(\.[^.\\\/]+)\2$/);
      if (m) names.push(m[1] + m[2]);
      const candidates = [];
      const cwd = vfs.getCurrentDirectory();
      const pathStr = pathWA ? readStr(pathWA, isWide) : '';
      // lpPath is a semicolon-separated list, searched in order and before
      // anything else. Joined as one directory, Evolva's
      // "C:\evolva;c:\evolva\Textures" found none of its textures, fonts,
      // sounds or movies and the whole game drew white.
      const pathDirs = pathStr.split(';').map(d => d.trim().replace(/\\+$/, '')).filter(Boolean);
      for (const nm of names) {
        for (const d of pathDirs) candidates.push(d + '\\' + nm);
      }
      for (const nm of names) {
        candidates.push(nm);
        if (cwd) candidates.push(cwd.replace(/\\$/, '') + '\\' + nm);
        // Win9x SearchPath(NULL, ...) includes the system and Windows
        // directories. Stock SHELL32 relies on that contract when its icon
        // cache expands the bare module name "shell32.dll" before opening the
        // PE resources. Omitting these locations makes an installed system
        // DLL look absent and turns the shell's icon/attribute result into -1.
        candidates.push('c:\\windows\\system\\' + nm);
        candidates.push('c:\\windows\\' + nm);
      }
      const name = origName;
      const tryCand = (cand) => {
        const attrs = vfs.getFileAttributes(cand);
        if ((attrs >>> 0) !== 0xFFFFFFFF && (attrs & 0x10) === 0) {
          return vfs.getFullPathName(cand);
        }
        return null;
      };
      const emitHit = (full, note) => {
        if (_traceFs()) console.log(`[fs] SearchPath("${name}") → "${full}"${note ? ' ' + note : ''}`);
        // SearchPath reports the size it needs and writes NOTHING when the
        // caller's buffer is too small. Writing anyway overruns whatever the
        // caller sized -- usually a stack buffer -- and the damage surfaces
        // later as a return into garbage, which is how CD Player died.
        if (bufGA && full.length + 1 > (bufLen >>> 0)) {
          if (_traceFs()) console.log(`[fs] SearchPath buffer too small: need ${full.length + 1}, have ${bufLen >>> 0}`);
          return full.length + 1;
        }
        if (bufGA) writeStr(bufGA, full, isWide);
        if (filePartPtrGA) {
          const lastSlash = full.lastIndexOf('\\');
          const off = (lastSlash >= 0) ? lastSlash + 1 : 0;
          gs32(filePartPtrGA, bufGA + off * (isWide ? 2 : 1));
        }
        return full.length;
      };
      for (const cand of candidates) {
        const full = tryCand(cand);
        if (full) return emitHit(full);
      }
      // Long-name → 8.3 fallback. Plus!98 screensaver .SCN files reference meshes
      // by descriptive names ("Grapple-198", "Octahedronc", "Io-half-torus") that
      // map to 8.3 files on disk (GRAPPLE.X, OCTAHEDR.X, IO-HALF.X). Try progressive
      // truncation of the basename stem, stripping trailing separators each time.
      for (const nm of names) {
        const dot = nm.lastIndexOf('.');
        if (dot <= 0) continue;
        const stem = nm.slice(0, dot);
        const ext = nm.slice(dot);
        const dirs = ['', 'c:\\windows\\system\\', 'c:\\windows\\'];
        if (cwd) dirs.push(cwd.replace(/\\$/, '') + '\\');
        for (const d of pathDirs) dirs.push(d + '\\');
        for (let n = stem.length - 1; n >= 3; n--) {
          const trimmed = stem.slice(0, n).replace(/[-._ ]+$/, '');
          if (trimmed.length < 3) break;
          const tryName = trimmed + ext;
          for (const d of dirs) {
            const full = tryCand(d + tryName);
            if (full) return emitHit(full, `(truncated from "${nm}")`);
          }
        }
      }
      if (_traceFs()) console.log(`[fs] SearchPath("${name}"${pathStr ? `, path="${pathStr}"` : ''}) → NOT FOUND`);
      return 0;
    },

    fs_read_file: (handle, bufGA, nToRead, nReadGA, threadId = 1) =>
      imports.fs_read_file_result(handle, bufGA, nToRead, nReadGA, threadId) === 0 ? 1 : 0,

    // One operation result: 0 success, 997 lazy fill/retry, otherwise error.
    // Keep pendingRead/readFault for legacy callers and the existing scheduler.
    fs_read_file_result: (handle, bufGA, nToRead, nReadGA, threadId = 1) => {
      const io = vfs.getIoState(threadId);
      if (nReadGA) gs32(nReadGA, 0);
      const accessError = fileDataAccessError(vfs.getOpenFile(handle), false);
      if (accessError) {
        io.pendingRead = null;
        io.readFault = 0;
        return accessError;
      }
      const fhDbg = (ctx._debugReadFile || (ctx.trace && ctx.trace.has && ctx.trace.has('fs'))) ? vfs.handles.get(handle >>> 0) : null;
      const posBefore = fhDbg ? fhDbg.pos : -1;
      // Read in runs that each stay inside one mapping. A single large read
      // into sparse VirtualAlloc memory used to walk past the end of its
      // mapping and overwrite whichever backing followed — Pinball (Plus! 95)
      // destroyed its own allocator's free list this way and then span
      // forever on the broken chain.
      let error = 0, bytesRead = 0, moved = 0;
      io.pendingRead = null;
      io.readFault = 0;
      // A lazy file's chunk cache holds a bounded number of chunks, and one
      // ReadFile may ask for more than that (Caesar III reads its 9.2 MB
      // c3.555 in one call against a 4 MB cache). Restarting such a call
      // from the top after every park re-fetches the evicted head forever and
      // the read faults. So a call that parks keeps its progress -- the bytes
      // already copied are in the guest's own buffer -- and the identical
      // retried call resumes there; each piece is bounded to half the cache
      // so it can be resident at once. The guest still sees one full read.
      const fhStart = vfs.handles.get(handle >>> 0);
      const progress = io._readProgress;
      io._readProgress = null;
      if (progress && fhStart && progress.fileRecord === fhStart &&
          progress.bufGA === (bufGA >>> 0) && progress.nToRead === nToRead &&
          (fhStart.pos === progress.startPos + progress.bytesRead || fhStart.pos === progress.startPos)) {
        moved = progress.moved;
        bytesRead = progress.bytesRead;
        fhStart.pos = progress.startPos + progress.bytesRead;
      }
      const startPos = fhStart ? fhStart.pos - bytesRead : 0;
      const lockError = vfs.fileLockError(fhStart, startPos, nToRead);
      if (lockError) {
        fhStart.pos = startPos;
        return lockError;
      }
      const pieceLimit = () => {
        const entry = fhStart && !fhStart.readData && vfs.fileEntry(fhStart);
        const cache = entry && entry._provider;
        if (!cache || !cache.maxChunks || !cache.chunkSize) return Infinity;
        return Math.max(cache.chunkSize, Math.floor(cache.maxChunks * cache.chunkSize / 2));
      };
      try {
        while (moved < nToRead) {
          const chunk = guestChunk((bufGA + moved) >>> 0, nToRead - moved);
          const len = Math.min(chunk.len, pieceLimit());
          const view = len < chunk.len ? chunk.view.subarray(0, len) : chunk.view;
          const r = vfs.readFile(handle, view, len, threadId);
          if (r.faulted) {
            // A lazy fill failed for good. Complete the call as a Win32 read
            // failure — never as a park, and never as a short read.
            io.pendingRead = null;
            io.readFault = r.error || 30;
            if (nReadGA) gs32(nReadGA, 0);
            return io.readFault;
          }
          if (r.pending) {
            // A provider-backed file whose chunk is not resident. Report zero
            // bytes and hand the guest back unread: $handle_ReadFile sees the
            // pending flag, restores its stdcall frame and parks on the IO_WAIT
            // yield, the host fills the chunk, and this exact call runs again.
            // Bytes already gathered by earlier iterations of this loop are
            // not reported -- a partial count would be indistinguishable from
            // end-of-file, which is the failure this whole path exists to
            // avoid -- but they are kept: the retry of this identical call
            // resumes after them (see _readProgress above) instead of
            // re-reading what the cache may already have evicted. The visible
            // file position still rewinds to where the call began, so while
            // parked the call has not happened yet, as before.
            const fhPending = vfs.handles.get(handle >>> 0);
            if (fhPending) {
              io._readProgress = { fileRecord: fhPending, bufGA: bufGA >>> 0, nToRead,
                startPos, moved, bytesRead };
              fhPending.pos = startPos;
            }
            io.pendingRead = r.pending;
            if (nReadGA) gs32(nReadGA, 0);
            return 997;
          }
          if (!r.ok) { error = r.error || 30; break; }
          bytesRead += r.bytesRead;
          moved += len;
          if (r.bytesRead < len) break;   // hit end of file
        }
      } finally {
        // A later chunk may park or fail after earlier chunks changed memory.
        // Notify the actual written prefix on every exit, not only success.
        notifyGuestWrite(bufGA, bytesRead);
      }
      if (nReadGA) gs32(nReadGA, error ? 0 : bytesRead);
      if (fhDbg) {
        console.log(`[FS] ReadFile(h=0x${(handle>>>0).toString(16)}, buf=0x${(bufGA>>>0).toString(16)}, n=0x${nToRead.toString(16)}, read=0x${bytesRead.toString(16)}, pos=0x${posBefore.toString(16)}, path=${fhDbg.path}) tid=${threadId | 0}${ctx.ioTraceTag ? ' ' + ctx.ioTraceTag() : ''}`);
      }
      return error;
    },

    // Positional I/O is one broker operation: no other guest thread can
    // observe the temporary cursor. Retain the ordinary sparse scatter,
    // cache-miss and code-invalidation paths, restoring the cursor on all exits.
    // Returns a Win32 error (0 success,997 cache fill needed), not BOOL.
    fs_read_file_at: (handle, bufGA, count, nReadGA, offsetLow, offsetHigh, threadId = 1) => {
      const io = vfs.getIoState(threadId);
      io.pendingRead = null;
      io.readFault = 0;
      const fh=vfs.getOpenFile(handle);
      if(nReadGA)gs32(nReadGA,0);
      if(!fh)return 6;
      const offset=(offsetHigh>>>0)*0x100000000+(offsetLow>>>0);
      if(!Number.isSafeInteger(offset))return 87;
      const original=fh.pos;
      try {
        fh.pos=offset;
        const error=imports.fs_read_file_result(handle,bufGA,count>>>0,nReadGA,threadId);
        if(error)return error;
        return count && fh.pos===offset?38:0; // ERROR_HANDLE_EOF
      } finally {fh.pos=original;}
    },

    // Legacy BOOL callers still ask whether a failed read needs a lazy fill.
    // ReadFile, positional reads and the msvcrt readers (_read, fread, fgets,
    // getc) use the single-operation result instead. Retain this channel
    // until the remaining Win16/front-door users are migrated; changing the
    // BOOL contract would treat an error as success.
    // 1 = park and retry, 2 = a lazy fill failed for good,
    // 0 = an ordinary read failure.
    fs_read_pending: (threadId = 1) => {
      const io = vfs.getIoState(threadId);
      return io.pendingRead ? 1 : (io.readFault ? 2 : 0);
    },

    // Legacy CRT callers consume BOOL; Win32 needs the operation's error in
    // the same RPC, not a second lookup into process-shared mutable state.
    fs_write_file: (handle, bufGA, nToWrite, nWrittenGA) =>
      imports.fs_write_file_result(handle, bufGA, nToWrite, nWrittenGA) === 0 ? 1 : 0,

    fs_write_file_result: (handle, bufGA, nToWrite, nWrittenGA) => {
      if (nWrittenGA) gs32(nWrittenGA, 0);
      const accessError = fileDataAccessError(vfs.getOpenFile(handle), true);
      if (accessError) return accessError;
      const fhDbg = _traceFs() ? vfs.handles.get(handle >>> 0) : null;
      const posBefore = fhDbg ? fhDbg.pos : -1;
      // Same mapping hazard as the read path: gather across runs rather than
      // trusting one translation to cover the whole length.
      let data;
      if (g2wSpan(bufGA, nToWrite) >= nToWrite) {
        data = new Uint8Array(ctx.getMemory(), g2w(bufGA), nToWrite);
      } else {
        data = new Uint8Array(nToWrite);
        let moved = 0;
        while (moved < nToWrite) {
          const { view, len } = guestChunk((bufGA + moved) >>> 0, nToWrite - moved);
          data.set(view, moved);
          moved += len;
        }
      }
      data = _patchRichEditRtfSentinelSize(handle, data, nToWrite);
      const { ok, error } = vfs.writeFile(handle, data, data.length);
      if (_traceFs()) {
        const entry = fhDbg ? vfs.files.get(fhDbg.path) : null;
        console.log(`[fs] WriteFile(h=0x${(handle>>>0).toString(16)}, n=0x${nToWrite.toString(16)}, wrote=0x${ok ? nToWrite.toString(16) : '0'}, pos=0x${posBefore.toString(16)}, size=0x${entry ? entry.data.length.toString(16) : '0'}, path=${fhDbg ? fhDbg.path : '?'})`);
      }
      // Report the caller's source byte count even if compatibility rewriting
      // changes the stored stream length.
      if (nWrittenGA) gs32(nWrittenGA, ok ? nToWrite : 0);
      return ok ? 0 : (error || 29); // ERROR_WRITE_FAULT for unclassified failures
    },

    // FlushFileBuffers is synchronous from the guest's point of view. VFS
    // writes already update their backing entry before WriteFile returns, so
    // this bridge reports the remaining observable result: validation/error.
    fs_flush_file_buffers: (handle) => {
      const error = vfs.flushFileBuffers(handle);
      if (_traceFs()) {
        console.log(`[fs] FlushFileBuffers(h=0x${(handle >>> 0).toString(16)}) → ${error ? `FAIL error=${error}` : 'ok'}`);
      }
      return error;
    },

    fs_duplicate_handle: (handle, access, inherit, options, sameProcess = 1) =>
      vfs.duplicateFileHandle(handle, access, inherit, options, !!sameProcess),

    fs_lock_file: (handle, offsetLow, offsetHigh, lengthLow, lengthHigh, unlock) =>
      vfs.lockFile(handle, offsetLow, offsetHigh, lengthLow, lengthHigh, !!unlock),

    // Mapping handles have the high bit set; keep status separate from their
    // value rather than overloading the file-only signed-result convention.
    fs_duplicate_mapping_result: (handle, access, inherit, options, resultWA) => {
      const source = _mappings.get(handle | 0);
      const finish = (duplicate, error = 0) => {
        if (options & 1) closeMappingHandle(handle);
        new DataView(ctx.getMemory()).setUint32(resultWA, duplicate, true);
        return error;
      };
      if (!source) return finish(0, 6);
      if (options & ~3) return finish(0, 87);
      const desired = (options & 2) ? source.access : access >>> 0;
      if (desired & ~0x000f003f) return finish(0, 87);
      if (desired & ~source.access) return finish(0, 5);
      const duplicate = newMappingHandle(source.mapping, desired, inherit);
      return finish(duplicate, duplicate ? 0 : 4);
    },

    fs_close_handle: (handle) => {
      // Reserve the mapping namespace even after close, so stale handles do
      // not fall through to the legacy unknown-handle success path.
      if ((handle >>> 24) === 0xFB) return closeMappingHandle(handle);
      // File handles and kernel synchronization handles share Win32's
      // CloseHandle entry point.  Let the process scheduler release an event
      // or semaphore slot before falling through to ordinary VFS bookkeeping.
      if (vfs.changeNotifications.has(handle >>> 0)) {
        return vfs.closeChangeNotification(handle) ? 1 : 0;
      }
      if (ctx.closeSyncHandle && ctx.closeSyncHandle(handle >>> 0)) return 1;
      return vfs.closeHandle(handle) ? 1 : 0;
    },

    fs_set_file_pointer: (handle, distance, moveMethod) => {
      const fhDbg = _traceFs() ? vfs.handles.get(handle >>> 0) : null;
      const posBefore = fhDbg ? fhDbg.pos : -1;
      const result = vfs.setFilePointer(handle, distance, moveMethod);
      if (_traceFs()) {
        console.log(`[fs] SetFilePointer(h=0x${(handle>>>0).toString(16)}, distance=${distance | 0}, method=${moveMethod}, pos=0x${posBefore.toString(16)}) → 0x${(result>>>0).toString(16)} path=${fhDbg ? fhDbg.path : '?'}`);
      }
      return result;
    },

    // Keep the optional high word guest-addressed; resultWA is private EAX.
    // Return the error alongside the low/high outputs in the same RPC;
    // no shared error slot.
    fs_seek_result: (handle, low, highGA, method, resultWA) => {
      const dv = new DataView(ctx.getMemory());
      const distance = highGA
        ? (BigInt(gl32(highGA) | 0) << 32n) + BigInt(low >>> 0)
        : BigInt(low | 0);
      const result = vfs.setFilePointerResult(handle, distance, method,
        highGA ? Number.MAX_SAFE_INTEGER : 0xffffffff);
      dv.setUint32(resultWA, result.error ? 0xffffffff : result.position >>> 0, true);
      if (!result.error && highGA) gs32(highGA, Math.floor(result.position / 0x100000000));
      return result.error;
    },

    fs_set_end_of_file: (handle) => imports.fs_set_end_of_file_result(handle) === 0 ? 1 : 0,

    fs_set_end_of_file_result: (handle) => {
      const fhDbg = _traceFs() ? vfs.handles.get(handle >>> 0) : null;
      const error = vfs.setEndOfFileResult(handle);
      if (_traceFs()) {
        const entry = fhDbg ? vfs.files.get(fhDbg.path) : null;
        console.log(`[fs] SetEndOfFile(h=0x${(handle>>>0).toString(16)}) → ${error ? 'FAIL' : 'ok'} size=0x${entry ? entrySize(entry).toString(16) : '0'} path=${fhDbg ? fhDbg.path : '?'}`);
      }
      return error;
    },

    fs_get_file_size: (handle) => {
      const sz = vfs.getFileSize(handle);
      if (ctx.log) ctx.log(`[FS] GetFileSize(0x${(handle>>>0).toString(16)}) → ${sz}`);
      return sz;
    },

    // Separate status from the low DWORD: 0xffffffff is a legitimate size.
    // Metadata queries must not materialize a provider-backed file.
    fs_file_size_result: (handle, lowWA, highGA) => {
      if (!vfs.getOpenFile(handle)) return 6; // ERROR_INVALID_HANDLE
      const size = vfs.getFileSize(handle);
      if (!Number.isSafeInteger(size) || size < 0) return 87;
      const dv = new DataView(ctx.getMemory());
      dv.setUint32(lowWA, size >>> 0, true);
      if (highGA) gs32(highGA, Math.floor(size / 0x100000000));
      return 0;
    },

    fs_file_information: (handle, infoGA) => {
      const info = vfs.getFileInformation(handle);
      if (info.error) return info.error;
      const words = [info.attrs,
        info.creationTime.lo, info.creationTime.hi,
        info.lastAccessTime.lo, info.lastAccessTime.hi,
        info.lastWriteTime.lo, info.lastWriteTime.hi,
        info.volumeSerial, Math.floor(info.size / 0x100000000), info.size >>> 0,
        1, // FAT-like filesystem: one link
        Math.floor(info.identity / 0x100000000), info.identity >>> 0];
      const bytes = new Uint8Array(words.length * 4);
      const dv = new DataView(bytes.buffer);
      words.forEach((value, index) => dv.setUint32(index * 4, value, true));
      writeGuestBytes(infoGA, bytes);
      return 0;
    },

    // GetFileTime / SetFileTime share one synchronous host bridge. Pointers
    // are guest addresses (or zero); the return value is a Win32 error code so
    // the WAT handlers can preserve BOOL plus GetLastError semantics.
    fs_file_time: (handle, set, creationGA, accessGA, writeGA) => {
      const readTime = ga => ga ? {
        lo: gl32(ga),
        hi: gl32((ga + 4) >>> 0),
      } : null;
      const writeTime = (ga, value) => {
        if (!ga || !value) return;
        const bytes = new Uint8Array(8);
        const dv = new DataView(bytes.buffer);
        dv.setUint32(0, value.lo >>> 0, true);
        dv.setUint32(4, value.hi >>> 0, true);
        writeGuestBytes(ga, bytes);
      };

      if (set) {
        return vfs.setFileTimes(handle,
          readTime(creationGA), readTime(accessGA), readTime(writeGA));
      }
      const result = vfs.getFileTimes(handle);
      if (result.error) return result.error;
      writeTime(creationGA, result.creationTime);
      writeTime(accessGA, result.lastAccessTime);
      writeTime(writeGA, result.lastWriteTime);
      return 0;
    },

    fs_get_file_attributes: (pathWA, isWide) => {
      const path = readStr(pathWA, isWide);
      const attrs = vfs.getFileAttributes(path);
      if (ctx.log) ctx.log(`GetFileAttributes("${path}") → 0x${(attrs>>>0).toString(16)}`);
      if (_traceFs()) {
        const ok = (attrs >>> 0) !== 0xFFFFFFFF;
        let caller = '';
        if (!ok || !path || path.length < 6 || path.startsWith('.')) {
          caller = _frameHint(ctx);
        }
        console.log(`[fs] GetFileAttributes("${path}") → ${ok ? '0x'+(attrs>>>0).toString(16) : 'INVALID'}${caller}`);
      }
      return attrs;
    },

    fs_set_file_attributes: (pathWA, attrs, isWide) => {
      const path = readStr(pathWA, isWide);
      return vfs.setFileAttributes(path, attrs) ? 1 : 0;
    },

    fs_delete_file: (pathWA, isWide) => {
      const path = readStr(pathWA, isWide);
      return vfs.deleteFile(path) ? 1 : 0;
    },

    fs_create_directory: (pathWA, isWide) => {
      const path = readStr(pathWA, isWide);
      if (ctx.log) ctx.log(`CreateDirectory("${path}")`);
      const ok = vfs.createDirectory(path);
      if (_traceFs()) console.log(`[fs] CreateDirectory("${path}") → ${ok ? 'created' : 'failed'}`);
      return ok ? 1 : 0;
    },

    fs_remove_directory: (pathWA, isWide) => {
      const path = readStr(pathWA, isWide);
      return vfs.removeDirectory(path) ? 1 : 0;
    },

    fs_move_file: (srcWA, dstWA, isWide) => {
      const src = readStr(srcWA, isWide);
      const dst = readStr(dstWA, isWide);
      return vfs.moveFile(src, dst) ? 1 : 0;
    },

    fs_copy_file: (srcWA, dstWA, failIfExists, isWide) => {
      const src = readStr(srcWA, isWide);
      const dst = readStr(dstWA, isWide);
      return vfs.copyFile(src, dst, failIfExists) ? 1 : 0;
    },

    fs_shell_file_operation: (fromWA, toWA, func, flags) => {
      const from = readMultiStrA(fromWA);
      const to = readMultiStrA(toWA);
      if (!from || !to) return 0x7C; // DE_INVALIDFILES
      const result = vfs.shellFileOperation(func, from, to, flags);
      if (_traceFs()) {
        console.log(`[fs] SHFileOperation(${func}, ${JSON.stringify(from)}, ` +
          `${JSON.stringify(to)}, 0x${(flags >>> 0).toString(16)}) → 0x${result.toString(16)}`);
      }
      return result;
    },

    fs_find_first_file: (patternWA, findDataGA, isWide) => {
      const pattern = readStr(patternWA, isWide);
      if (ctx.log) ctx.log(`FindFirstFile("${pattern}")`);
      const { handle, entry } = vfs.findFirstFile(pattern);
      if (!handle) {
        if (_traceFs()) console.log(`[fs] FindFirstFile("${pattern}") → FAIL`);
        return INVALID_HANDLE;
      }
      if (ctx._debugFindFile) console.log(`[FF] FindFirst("${pattern}") => "${entry.name}" size=${entry.size}`);
      if (_traceFs()) console.log(`[fs] FindFirstFile("${pattern}") → "${entry.name}" size=${entry.size}`);
      fillFindData(findDataGA, entry, isWide);
      return handle;
    },

    fs_find_next_file: (handle, findDataGA, isWide) => {
      const entry = vfs.findNextFile(handle);
      if (!entry) {
        if (_traceFs()) console.log(`[fs] FindNextFile(0x${(handle>>>0).toString(16)}) → end`);
        return 0;
      }
      if (ctx._debugFindFile) console.log(`[FF] FindNext => "${entry.name}" size=${entry.size}`);
      if (_traceFs()) console.log(`[fs] FindNextFile(0x${(handle>>>0).toString(16)}) → "${entry.name}" size=${entry.size}`);
      fillFindData(findDataGA, entry, isWide);
      return 1;
    },

    fs_find_close: (handle) => {
      return vfs.findClose(handle) ? 1 : 0;
    },

    fs_register_change_notification: (handle, pathWA, watchSubtree, filter, isWide) => {
      const path = readStr(pathWA, isWide);
      return vfs.registerChangeNotification(
        handle, path, watchSubtree, filter, changeCallbacks) ? 1 : 0;
    },

    fs_next_change_notification: handle =>
      vfs.nextChangeNotification(handle) ? 1 : 0,

    fs_close_change_notification: handle =>
      vfs.closeChangeNotification(handle) ? 1 : 0,

    fs_get_temp_path: (bufSize, bufGA, isWide) => {
      const p = vfs.getTempPath();
      return writeStr(bufGA, p, isWide);
    },

    fs_get_temp_file_name: (pathWA, prefixWA, unique, bufGA, isWide) => {
      const dir = readStr(pathWA, isWide);
      const prefix = prefixWA ? readStr(prefixWA, isWide) : 'tmp';
      const name = vfs.getTempFileName(dir, prefix, unique);
      writeStr(bufGA, name, isWide);
      return unique || vfs._tempCounter;
    },

    fs_get_current_directory: (bufSize, bufGA, isWide) => {
      const p = vfs.getCurrentDirectory();
      return writeStr(bufGA, p, isWide);
    },

    fs_set_current_directory: (pathWA, isWide) => {
      const path = readStr(pathWA, isWide);
      const ok = vfs.setCurrentDirectory(path);
      if (_traceFs()) console.log(`[fs] SetCurrentDirectory("${path}") → ${ok ? `"${vfs.getCurrentDirectory()}"` : 'FAIL'}`);
      return ok ? 1 : 0;
    },

    fs_get_full_path_name: (fileWA, bufSize, bufGA, filePartGA, isWide) => {
      const file = readStr(fileWA, isWide);
      // RtlGetFullPathName_U treats an empty filename as invalid.  Resolving it
      // against the current directory fabricates "C:" and lets optional empty
      // installer paths overwrite unrelated path fields with the drive name.
      if (!file) {
        return 0;
      }
      const full = vfs.getFullPathName(file);
      // TCHAR count includes NUL only when reporting required capacity. Do
      // not overwrite a short buffer (or lpFilePart) while sizing the result.
      if ((bufSize >>> 0) <= full.length) return full.length + 1;
      const len = writeStr(bufGA, full, isWide);
      // filePart points to filename portion within buffer
      if (filePartGA) {
        const lastSlash = full.lastIndexOf('\\');
        const filePartOffset = (lastSlash >= 0) ? lastSlash + 1 : 0;
        // filePartGA points to a DWORD that receives the pointer to filename
        const charSize = isWide ? 2 : 1;
        gs32(filePartGA, full.endsWith('\\') ? 0 : bufGA + filePartOffset * charSize);
      }
      return len;
    },

    // CreateFileMappingA(hFile, protect, sizeHi, sizeLo) → mapping handle
    fs_create_file_mapping_result: (...args) => imports.fs_create_file_mapping(...args),

    fs_create_file_mapping: (hFile, protect, sizeHi, sizeLo, nameWA, resultWA = null) => {
      const finish = (handle, error = 0) => {
        if (resultWA === null) return handle;
        new DataView(ctx.getMemory()).setUint32(resultWA, handle, true);
        return error;
      };
      hFile = hFile >>> 0;
      const name = nameWA ? readObjectNameA(nameWA) : '';
      // INVALID_HANDLE_VALUE means "back this with the pagefile", i.e. plain
      // shared memory with no file behind it. Apps use a named one to publish
      // their presence to a sibling process — Kodak Imaging creates
      // "EastManSoftwarePrvFile" so its Preview counterpart can find it.
      const anonymous = hFile === 0xFFFFFFFF;
      const fh = anonymous ? null : vfs.getOpenFile(hFile);
      if (!anonymous && !fh) return finish(0, 6);
      // This host currently supports only sections below 4 GiB. Never silently
      // discard the high DWORD and create a different, smaller section.
      if (sizeHi) return finish(0, 87);
      const pageProtection = protect & 0xff;
      if (![2, 4, 8, 0x20, 0x40, 0x80].includes(pageProtection)) return finish(0, 87);
      const writable = pageProtection === 4 || pageProtection === 0x40;
      const executable = pageProtection >= 0x20;
      if (fh) {
        const required = 1 | (writable ? 2 : 0) | (executable ? 0x20 : 0);
        if ((fileAccessMask(fh.access) & required) !== required) return finish(0, 5);
        if (writable && vfs._isReadOnlyPath(fh.path)) return finish(0, 19);
      }
      if (anonymous) {
        const bytes = sizeLo >>> 0;             // high dword is out of range here
        if (!bytes) return finish(0, 87);
        const existing = namedMapping(name);
        if (existing) {
          const h = newMappingHandle(existing);
          return finish(h, h ? 183 : 4);
        }
        let anon;
        try { anon = new Uint8Array(bytes); }
        catch (_) { return finish(0, 8); }
        const h = newMappingHandle({ anon, name, writable, executable, pageProtection, size: bytes });
        if (!h) return finish(0, 4);
        if (ctx.log) ctx.log(`CreateFileMapping(pagefile, ${bytes}B${name ? ', "' + name + '"' : ''}) → 0x${h.toString(16)}`);
        return finish(h);
      }
      // A named section is reopenable by name. Win32 hands back the existing
      // one rather than a second section, so an app that names its mapping can
      // find it again — which is the whole point of naming it.
      const existing = namedMapping(name);
      if (existing) {
        const h = newMappingHandle(existing);
        return finish(h, h ? 183 : 4);
      }
      const entry = vfs.fileEntry(fh);
      if (!entry) return finish(0, 6);
      const fileSize = entrySize(entry);
      const sectionSize = (sizeLo >>> 0) || fileSize;
      if (!sectionSize) return finish(0, 1006); // ERROR_FILE_INVALID
      if (sectionSize > fileSize) {
        if (!writable) return finish(0, 5);
        try { extendFileEntry(entry, sectionSize); }
        catch (error) {
          if (ctx.log) ctx.log(`[FS] CreateFileMapping extension failed: ${error.message}`);
          return finish(0, error instanceof RangeError ? 8 : 30);
        }
        ensureFileTimes(entry).lastWriteTime = currentFileTime();
        vfs._notifyChange(fh.path, FILE_NOTIFY_CHANGE_SIZE | FILE_NOTIFY_CHANGE_LAST_WRITE);
      }
      const h = newMappingHandle({ entry, filePath: fh.path, name, writable, executable, pageProtection, size: sectionSize });
      if (!h) return finish(0, 4);
      if (ctx.log) ctx.log(`CreateFileMapping(0x${hFile.toString(16)}${name ? ', "' + name + '"' : ''}) → 0x${h.toString(16)}`);
      return finish(h);
    },

    // OpenFileMapping(lpName) → handle, or 0 when nothing published that name.
    // Zero is a real answer here, not a stub: the section belongs to whichever
    // process created it, and in a single-process world an unclaimed name
    // genuinely does not exist.
    fs_open_file_mapping_result: (...args) => imports.fs_open_file_mapping(...args),
    fs_open_file_mapping: (nameWA, access = 0x000f003f, inherit = false, wide = false, resultWA = null) => {
      const finish = (handle, error = 0) => {
        if (resultWA === null) return handle;
        new DataView(ctx.getMemory()).setUint32(resultWA, handle, true);
        return error;
      };
      if (!nameWA) return finish(0, 87);
      const name = wide ? readStrW(nameWA) : readObjectNameA(nameWA);
      if (!name) return finish(0, 2);
      if (access & ~0x000f003f) return finish(0, 87);
      // OpenFileMapping treats FILE_MAP_COPY as FILE_MAP_READ, not as a
      // separate section access right (MapView still chooses the view mode).
      const granted = (access & 1) ? (access & ~1) | 4 : access;
      const mapping = namedMapping(name);
      if (mapping) {
        const h = newMappingHandle(mapping, granted, inherit);
        if (ctx.log) ctx.log(`OpenFileMapping("${name}") → 0x${h.toString(16)}`);
        return finish(h, h ? 0 : 4);
      }
      if (ctx.log) ctx.log(`OpenFileMapping("${name}") → not found`);
      return finish(0, 2);
    },

    // MapViewOfFile(hMapping, access, offsetHi, offsetLo, size) → guest addr
    fs_map_view_of_file_result: (hMapping, access, offsetHi, offsetLo, size, resultWA, threadId) =>
      imports.fs_map_view_of_file(hMapping, access, offsetHi, offsetLo, size, threadId, resultWA),

    fs_map_view_of_file: (hMapping, access, offsetHi, offsetLo, size, threadId = 1, resultWA = null) => {
      const finish = (address, error = 0) => {
        if (resultWA === null) return address;
        new DataView(ctx.getMemory()).setUint32(resultWA, address, true);
        return error;
      };
      const io = vfs.getIoState(threadId);
      io.pendingRead = null;
      io.readFault = 0;
      const operationKey = [threadId, hMapping, access, offsetHi, offsetLo, size]
        .map(value => value >>> 0).join(':');
      const operation = _pendingProviderMappings.get(operationKey);
      if (operation && operation.io === io && !operation.ready) {
        io.pendingRead = operation.pending;
        return finish(0, 997);
      }
      const resumed = operation && operation.io === io;
      const handleRecord = _mappings.get(hMapping | 0);
      const mapping = resumed ? operation.mapping : handleRecord?.mapping;
      if (resumed) {
        _pendingProviderMappings.delete(operationKey);
        io._mappingCleanups.delete(operation.cancel);
        if (operation.error) {
          io.readFault = operation.error;
          return finish(0, operation.error);
        }
        if (operation.address) return finish(operation.address);
      }
      if (!mapping) return finish(0, 6);
      if (!resumed) {
        // FILE_MAP_WRITE permits read/COPY views too. COPY is a view mode,
        // not a grant of write access to the shared backing section.
        const granted = handleRecord.access | ((handleRecord.access & 2) ? 4 : 0);
        const required = ((access & 2) ? 2 : ((access & 5) ? 4 : 0)) | (access & 0x20);
        if (required & ~granted) return finish(0, 5);
      }
      // Validate before touching lazy bytes or allocating guest address space.
      // FILE_MAP_COPY never grants shared writeback; FILE_MAP_ALL_ACCESS has
      // FILE_MAP_WRITE set and therefore requires a writable section.
      if (!(access & 7)) return finish(0, 87);
      if (((access & 2) && !mapping.writable) ||
          ((access & 0x20) && !mapping.executable)) return finish(0, 87);
      // Native Win98, unlike NT, accepts COPY only for a file-backed
      // PAGE_WRITECOPY section. ALL_ACCESS includes bit 1 but is WRITE mode.
      if ((access & 7) === 1 && (mapping.anon || mapping.pageProtection !== 8)) return finish(0, 87);
      const entry = mapping.entry;
      if (!mapping.anon && !entry) return finish(0, 6);
      const offset = offsetLo >>> 0; // high offsets exceed the supported media ceiling
      if (offsetHi) return finish(0, 87);
      // GetSystemInfo reports 64 KiB allocation granularity. File offsets must
      // match it; a merely 4 KiB page-aligned offset is not sufficient.
      if (offset % 65536 !== 0) return finish(0, 87); // native Win98 ERROR_INVALID_PARAMETER
      const dataSize = mapping.anon ? mapping.anon.length
        : (entry._provider ? entry._size : entry.data.length);
      const mapSize = (size >>> 0) || (mapping.size - offset);
      if (mapSize <= 0 || offset >= mapping.size || mapSize > mapping.size - offset) return finish(0, 87);

      if (ctx.exports.guest_section_reserve && ctx.exports.guest_section_commit && ctx.exports.guest_section_free) {
        return mapSharedSection(hMapping, mapping, access >>> 0, offset, mapSize, io, operationKey, finish);
      }

      // A writable mapping needs eager bytes for FlushViewOfFile/UnmapViewOfFile
      // writeback. A read-only mapping can stream straight into its guest view.
      if (entry && entry._provider) {
        const provider = entry._provider;
        const providerOffset = (entry._offset || 0) + offset;
        const sourceSize = Math.min(mapSize, Math.max(0, dataSize - offset));
        const mapAlloc = ctx.exports.guest_map_alloc || ctx.exports.guest_alloc;
        const guestAddr = (access & 2) ? 0 : mapAlloc(mapSize);
        if (!(access & 2) && !guestAddr) return finish(0, 8);
        const operation = { mapping, io, ready: false, pending: null, filling: null,
          retired: false, address: 0, error: 0 };
        let released = false;
        const release = () => {
          if (released || !guestAddr) return;
          released = true;
          _mappedViews.delete(guestAddr);
          releaseMappedAllocation(guestAddr);
        };
        operation.cancel = () => {
          operation.retired = true;
          if (_pendingProviderMappings.get(operationKey) === operation) {
            _pendingProviderMappings.delete(operationKey);
          }
          release();
        };
        const pending = {
          ioState: io,
          handle: hMapping >>> 0,
          pos: offset,
          path: mapping.filePath,
          offset: providerOffset,
          length: sourceSize,
          provider: {
            fill: () => operation.filling || (operation.filling = (async () => {
              try {
                if (operation.retired) return;
                if (access & 2) {
                  await vfs.materializeEntry(entry);
                  return;
                }
                for (let copied = 0; copied < sourceSize;) {
                  const want = Math.min(MATERIALIZE_CHUNK_SIZE, sourceSize - copied);
                  const bytes = await providerReadAsync(provider, providerOffset + copied, want);
                  // The allocation may already have been reused by another
                  // thread while the provider was waiting. Never touch it.
                  if (operation.retired) return;
                  if (!(bytes instanceof Uint8Array) || bytes.length !== want) {
                    const got = bytes && typeof bytes.length === 'number'
                      ? bytes.length : 'non-byte result';
                    throw new Error(`MapViewOfFile: short provider read ` +
                      `@${providerOffset + copied}+${want} (got ${got})`);
                  }
                  let moved = 0;
                  while (moved < bytes.length) {
                    const chunk = guestChunk(guestAddr + copied + moved, bytes.length - moved);
                    chunk.view.set(bytes.subarray(moved, moved + chunk.len));
                    moved += chunk.len;
                  }
                  copied += want;
                }
                _mappedViews.set(guestAddr,
                  { size: mapSize, mapping, offset, access: access >>> 0 });
                operation.address = guestAddr;
                if (ctx.log) ctx.log(`[FS] MapViewOfFile async → guest ` +
                  `0x${guestAddr.toString(16)} (${(mapSize / 1024) | 0}KB, ` +
                  `file=${mapping.filePath})`);
                if (_traceFs()) console.log(`[fs] MapViewOfFile async → ` +
                  `0x${guestAddr.toString(16)} size=0x${mapSize.toString(16)} ` +
                  `path=${mapping.filePath}`);
              } catch (error) {
                release();
                if (!operation.retired) operation.error = 30;
                throw error;
              } finally {
                operation.ready = true;
              }
            })()),
          },
        };
        operation.pending = pending;
        _pendingProviderMappings.set(operationKey, operation);
        if (!io._mappingCleanups) io._mappingCleanups = new Set();
        io._mappingCleanups.add(operation.cancel);
        io.pendingRead = pending;
        return finish(0, 997);
      }

      // A pagefile-backed section carries its bytes directly; an eager
      // file-backed entry does too.
      const data = mapping.anon || entry.data;

      // Allocate via guest heap (VirtualAlloc-style page-aligned bump)
      // so mapped memory stays in low guest address space, away from
      // emulator-private regions (thunks, thread cache, etc.)
      const mapAlloc = ctx.exports.guest_map_alloc || ctx.exports.guest_alloc;
      const guestAddr = mapAlloc(mapSize);
      if (!guestAddr) return finish(0, 8);
      // Copy data into WASM memory. HeapAlloc starts in the low direct guest
      // window but spills to sparse high chunks once that window reaches
      // emulator-private memory, and those chunks are contiguous to the guest
      // yet NOT in linear memory -- so translate per run instead of computing
      // one naive `guestAddr + (GUEST_BASE - image_base)` base. RollerCoaster
      // Tycoon maps a multi-megabyte scenario, landed in a sparse chunk, and
      // the naive address pointed past the end of memory: Uint8Array.set threw
      // "offset is out of bounds" and killed the run.
      const src = data.subarray(offset, offset + mapSize);
      let copied = 0;
      while (copied < src.length) {
        const chunk = guestChunk(guestAddr + copied, src.length - copied);
        chunk.view.set(src.subarray(copied, copied + chunk.len));
        copied += chunk.len;
      }

      _mappedViews.set(guestAddr, { size: mapSize, mapping, offset, access: access >>> 0 });
      if (ctx.log) ctx.log(`[FS] MapViewOfFile → guest 0x${guestAddr.toString(16)} (${(mapSize/1024)|0}KB, ${mapping.anon ? 'pagefile' : 'file=' + mapping.filePath})`);
      return finish(guestAddr);
    },

    // UnmapViewOfFile(baseAddr) → BOOL
    fs_unmap_view: (baseAddr) => {
      baseAddr >>>= 0;
      const view = _mappedViews.get(baseAddr);
      if (!view) return 0;
      syncMappedView(baseAddr, baseAddr, view, view.size);
      if (view.shared) releaseSharedView(view.tokens.values().next().value);
      else {
        _mappedViews.delete(baseAddr);
        releaseMappedAllocation(baseAddr);
      }
      if (ctx.log) ctx.log(`[FS] UnmapViewOfFile(0x${baseAddr.toString(16)}) - synced and freed`);
      return 1;
    },

    // FlushViewOfFile(lpBaseAddress, dwNumberOfBytesToFlush) → BOOL.
    //
    // The same writeback UnmapViewOfFile does, without giving the view up: an
    // app that keeps a mapping open for the length of a session (Kodak Imaging
    // holds one over its thumbnail cache) calls this to make its edits durable
    // and carries on writing through the same pointer. lpBaseAddress may point
    // anywhere *inside* a view, and 0 bytes means "to the end of the view",
    // both per MSDN.
    fs_flush_view: (baseAddr, bytes) => {
      baseAddr >>>= 0; bytes >>>= 0;
      for (const [base, view] of _mappedViews) {
        if (baseAddr < base || baseAddr >= base + view.size) continue;
        const span = bytes ? Math.min(bytes, base + view.size - baseAddr)
                           : base + view.size - baseAddr;
        syncMappedView(base, baseAddr, view, span);
        if (ctx.log) ctx.log(`[FS] FlushViewOfFile(0x${baseAddr.toString(16)}, ${span}B) - synced`);
        return 1;
      }
      // Not inside any view we handed out. Win32 fails this with
      // ERROR_INVALID_ADDRESS rather than pretending it wrote something.
      if (ctx.log) ctx.log(`[FS] FlushViewOfFile(0x${baseAddr.toString(16)}) - not a mapped view`);
      return 0;
    },

    // FileTimeToSystemTime — convert FILETIME (100ns since 1601) to SYSTEMTIME
    fs_filetime_to_systemtime: (ftGA, stGA) => {
      const lo = gl32(ftGA);
      const hi = gl32((ftGA + 4) >>> 0);
      // FILETIME → milliseconds since Unix epoch
      // FILETIME epoch: 1601-01-01, Unix epoch: 1970-01-01
      // Difference: 11644473600 seconds = 116444736000000000 in 100ns ticks
      const ftBig = BigInt(hi) * 0x100000000n + BigInt(lo);
      const unixMs = Number((ftBig - 116444736000000000n) / 10000n);
      const d = new Date(unixMs);
      if (isNaN(d.getTime())) return 0;
      const bytes = new Uint8Array(16);
      const dv = new DataView(bytes.buffer);
      dv.setUint16(0, d.getUTCFullYear(), true);
      dv.setUint16(2, d.getUTCMonth() + 1, true);
      dv.setUint16(4, d.getUTCDay(), true);
      dv.setUint16(6, d.getUTCDate(), true);
      dv.setUint16(8, d.getUTCHours(), true);
      dv.setUint16(10, d.getUTCMinutes(), true);
      dv.setUint16(12, d.getUTCSeconds(), true);
      dv.setUint16(14, d.getUTCMilliseconds(), true);
      writeGuestBytes(stGA, bytes);
      return 1;
    },

    fs_get_short_path_name: (longWA, shortGA, bufSize, isWide) => {
      // Just copy long → short (no 8.3 conversion needed in virtual FS).
      // The buffer contract still holds: a caller passing NULL, or a buffer
      // one character too small, is asking how much to allocate, and Win32
      // answers with the length *including* the terminator and writes nothing.
      const long = readStr(longWA, isWide);
      if (!shortGA || bufSize <= long.length) return long.length + 1;
      return writeStr(shortGA, long, isWide);
    },
  };
  // Hold a read's entire range while a provider fill parks it. Otherwise a
  // peer could lock a later chunk after an earlier chunk reached guest memory,
  // turning the retry into a lock failure with a partially modified buffer.
  const readFileResult = imports.fs_read_file_result;
  imports.fs_read_file_result = (handle, buffer, count, output, threadId = 1) => {
    const io = vfs.getIoState(threadId);
    const old = io._lockRead;
    if (old) old.reads.delete(old);
    io._lockRead = null;
    const fh = vfs.getOpenFile(handle), entry = vfs.fileEntry(fh);
    let read;
    if (fh && entry && count) {
      let reads = filePendingReads.get(entry);
      if (!reads) filePendingReads.set(entry, reads = new Set());
      const start = BigInt(fh.pos);
      read = { start, end: start + BigInt(count >>> 0), owner: fh.fileOwner, record: fh, reads };
      reads.add(read);
    }
    let result;
    try {
      result = readFileResult(handle, buffer, count, output, threadId);
      return result;
    } finally {
      if (read) {
        if (result === 997) io._lockRead = read;
        else read.reads.delete(read);
      }
    }
  };
  return imports;
}

// Export for Node.js and browser
if (typeof module !== 'undefined') {
  module.exports = { createFilesystemImports, VirtualFS, expandRtfStylesheet, VfsPendingError };
}
if (typeof window !== 'undefined') {
  window.FilesystemImports = { createFilesystemImports, VirtualFS, expandRtfStylesheet, VfsPendingError };
}
