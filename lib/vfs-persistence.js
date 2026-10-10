// Opt-in persistence for mutable browser VFS files.
//
// The emulator mounts application media into a fresh in-memory VirtualFS for
// every process. Apps that explicitly list `persistFiles` may retain only
// those matching paths in localStorage; installers, caches and temporary files
// remain ephemeral by default.

(function () {
  const PREFIX = 'wine-assembly:vfs:';
  // A saved file shadows the mounted one forever, so shipping a fix to an
  // asset an app persists never reaches anyone who has already run it. This
  // records which reset an app's stored copies have already been through, so
  // changing `persistReset` in lib/apps.js drops them once and never again.
  const RESET_PREFIX = 'wine-assembly:vfs-reset:';
  const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

  function normalizePath(path) {
    return String(path || '').toLowerCase().replace(/\//g, '\\');
  }

  function patternRegex(pattern) {
    const escaped = normalizePath(pattern)
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp('^' + escaped + '$');
  }

  function encodeBytes(bytes) {
    let binary = '';
    const stride = 0x8000;
    for (let i = 0; i < bytes.length; i += stride) {
      binary += String.fromCharCode(...bytes.subarray(i, i + stride));
    }
    if (typeof btoa === 'function') return btoa(binary);
    return Buffer.from(binary, 'binary').toString('base64');
  }

  function decodeBytes(encoded) {
    const binary = typeof atob === 'function'
      ? atob(encoded)
      : Buffer.from(encoded, 'base64').toString('binary');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xFF;
    return bytes;
  }

  function savedFileTime(value) {
    if (!value || !Number.isFinite(value.lo) || !Number.isFinite(value.hi)) return null;
    return { lo: value.lo >>> 0, hi: value.hi >>> 0 };
  }

  function attach(vfs, options) {
    options = options || {};
    // A frame denied storage (third-party, blocked) throws on the read
    // itself; it then runs unpersisted, like any app without patterns.
    let storage = options.storage || null;
    if (!storage) {
      try { storage = typeof localStorage !== 'undefined' ? localStorage : null; } catch (_) { storage = null; }
    }
    const appId = String(options.appId || '').replace(/[^a-z0-9_.-]/gi, '_');
    const patterns = (options.patterns || []).map(patternRegex);
    const maxFileBytes = Math.max(1, options.maxFileBytes || DEFAULT_MAX_BYTES);
    const log = typeof options.log === 'function' ? options.log : () => {};
    const resetToken = options.resetToken == null ? null : String(options.resetToken);
    const onFlush = typeof options.onFlush === 'function' ? options.onFlush : () => {};
    const enabled = !!(vfs && vfs.files && storage && appId && patterns.length);
    const keyPrefix = PREFIX + appId + ':';
    const originals = new Map();
    const pending = new Set();
    let scheduled = false;
    let lastFlush = { attempted: 0, saved: 0, failed: 0, pending: 0 };

    const resolve = path => normalizePath(
      vfs && typeof vfs._resolvePath === 'function' ? vfs._resolvePath(path) : path);
    const matches = path => patterns.some(pattern => pattern.test(path));
    const keyFor = path => keyPrefix + encodeURIComponent(path);

    function persist(path) {
      path = resolve(path);
      if (!enabled || !matches(path)) return false;
      const entry = vfs.files.get(path);
      try {
        if (!entry) {
          storage.removeItem(keyFor(path));
          return true;
        }
        const bytes = entry.data;
        if (!(bytes instanceof Uint8Array) || bytes.length > maxFileBytes) {
          log(`Persistent file skipped: ${path} (${bytes ? bytes.length : 0} bytes)`);
          return false;
        }
        storage.setItem(keyFor(path), JSON.stringify({
          version: 1,
          attrs: entry.attrs >>> 0,
          creationTime: savedFileTime(entry.creationTime),
          lastAccessTime: savedFileTime(entry.lastAccessTime),
          lastWriteTime: savedFileTime(entry.lastWriteTime),
          data: encodeBytes(bytes),
        }));
        return true;
      } catch (error) {
        log(`Persistent file write failed: ${path}: ${error && error.message ? error.message : error}`);
        return false;
      }
    }

    function flush() {
      scheduled = false;
      const paths = Array.from(pending);
      let saved = 0;
      for (const path of paths) {
        if (persist(path)) {
          pending.delete(path);
          saved++;
        }
      }
      // Retain failures for an explicit flush or the next mutation. Scheduling
      // another microtask here would spin forever while storage is full.
      lastFlush = { attempted: paths.length, saved, failed: paths.length - saved,
        pending: pending.size };
      try {
        onFlush(Object.assign({}, lastFlush));
      } catch (error) {
        // A UI observer cannot undo a successful storage write or discard the
        // pending retry state. Keep notification failures out of the save path.
        try { log(`Persistent file notification failed: ${error && error.message || error}`); } catch (_) {}
      }
      return saved;
    }

    function schedule(path) {
      path = resolve(path);
      if (!enabled || !matches(path)) return;
      pending.add(path);
      if (scheduled) return;
      scheduled = true;
      Promise.resolve().then(() => { if (scheduled) flush(); });
    }

    function restore() {
      if (!enabled) return 0;
      let restored = 0;
      const keys = [];
      try {
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key && key.startsWith(keyPrefix)) keys.push(key);
        }
      } catch (error) {
        log(`Persistent file listing failed: ${error && error.message ? error.message : error}`);
        return 0;
      }
      for (const key of keys) {
        let path = key;
        try {
          path = normalizePath(decodeURIComponent(key.slice(keyPrefix.length)));
          if (!matches(path)) continue;
          const saved = JSON.parse(storage.getItem(key));
          if (!saved || saved.version !== 1 || typeof saved.data !== 'string') continue;
          const data = decodeBytes(saved.data);
          if (data.length > maxFileBytes) continue;
          const entry = { data, attrs: saved.attrs >>> 0 || 0x80 };
          const creationTime = savedFileTime(saved.creationTime);
          const lastAccessTime = savedFileTime(saved.lastAccessTime);
          const lastWriteTime = savedFileTime(saved.lastWriteTime);
          if (creationTime) entry.creationTime = creationTime;
          if (lastAccessTime) entry.lastAccessTime = lastAccessTime;
          if (lastWriteTime) entry.lastWriteTime = lastWriteTime;
          vfs.files.set(path, entry);
          if (typeof vfs.ensureParentDirs === 'function') {
            vfs.ensureParentDirs(path);
          } else if (vfs.dirs && typeof vfs._parentDir === 'function') {
            vfs.dirs.add(vfs._parentDir(path));
          }
          restored++;
        } catch (error) {
          log(`Persistent file restore failed: ${path}: ${error && error.message ? error.message : error}`);
        }
      }
      return restored;
    }

    function wrap(name, replacement) {
      if (!enabled || typeof vfs[name] !== 'function') return;
      const original = vfs[name];
      originals.set(name, original);
      vfs[name] = replacement(original);
    }

    // Drop this app's stored copies once, when the token it was last reset
    // for is not the token it is asking for now. Equality, not ordering: the
    // question is "has this reset happened here", and a token that has never
    // been seen is one that has not. It runs before restore() so the cleared
    // copies are not hydrated on the very run that clears them; a profile
    // that has never persisted anything writes the token and clears nothing.
    //
    // This is deliberately a reset and not a migration: it hands the person
    // back the file we ship, and they set their preferences again. The cost
    // is real and worth naming -- for Blobby the same file holds the result
    // table (see docs/re-notes/blobby-volley.md), so those go too.
    function applyReset() {
      if (!enabled || resetToken === null) return null;
      const stampKey = RESET_PREFIX + appId;
      let previous = null;
      try {
        previous = storage.getItem(stampKey);
      } catch (error) {
        // A storage that cannot be read cannot be reset either; leaving the
        // saved files in place is the conservative half of that failure.
        log(`Persistent reset check failed: ${error && error.message ? error.message : error}`);
        return null;
      }
      if (previous === resetToken) return null;
      const cleared = [];
      try {
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key && key.startsWith(keyPrefix)) cleared.push(key);
        }
        for (const key of cleared) storage.removeItem(key);
        storage.setItem(stampKey, resetToken);
      } catch (error) {
        log(`Persistent reset failed: ${error && error.message ? error.message : error}`);
        return null;
      }
      if (cleared.length) {
        log(`Saved files reset (${cleared.length}) — this app now starts from the shipped copy`);
      }
      return { token: resetToken, previous, cleared: cleared.length };
    }

    const reset = applyReset();

    // Restore before wrapping so hydration itself never queues another write.
    const restored = restore();

    wrap('createFile', original => function (path, access, creation) {
      const result = original.call(this, path, access, creation);
      if (result && creation !== 3) schedule(path);
      return result;
    });
    wrap('writeFile', original => function (handle, data, length) {
      const file = this.handles && this.handles.get(handle >>> 0);
      const result = original.call(this, handle, data, length);
      if (result && result.ok && file) schedule(file.path);
      return result;
    });
    wrap('setEndOfFile', original => function (handle) {
      const file = this.handles && this.handles.get(handle >>> 0);
      const result = original.call(this, handle);
      if (result && file) schedule(file.path);
      return result;
    });
    wrap('setFileTimes', original => function (handle, creation, access, write) {
      const file = this.handles && this.handles.get(handle >>> 0);
      const result = original.call(this, handle, creation, access, write);
      if (result === 0 && file) schedule(file.path);
      return result;
    });
    wrap('deleteFile', original => function (path) {
      const resolved = resolve(path);
      const result = original.call(this, path);
      if (result) schedule(resolved);
      return result;
    });
    wrap('moveFile', original => function (source, destination) {
      const resolvedSource = resolve(source);
      const resolvedDestination = resolve(destination);
      const result = original.call(this, source, destination);
      if (result) {
        schedule(resolvedSource);
        schedule(resolvedDestination);
      }
      return result;
    });
    wrap('copyFile', original => function (source, destination, failIfExists) {
      const resolvedDestination = resolve(destination);
      const result = original.call(this, source, destination, failIfExists);
      if (result) schedule(resolvedDestination);
      return result;
    });

    return {
      enabled,
      reset,
      restored,
      flush,
      persist,
      get lastFlush() { return Object.assign({}, lastFlush); },
      get pendingCount() { return pending.size; },
      detach() {
        const saved = flush();
        for (const [name, original] of originals) vfs[name] = original;
        originals.clear();
        return saved;
      },
    };
  }

  const api = { attach, normalizePath, patternRegex };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.VfsPersistence = api;
})();
