'use strict';

// Private, launch-owned Node IPC transport. This is a fork-time snapshot and
// a completion delta, not a concurrently shared filesystem. No host VFS tree,
// executable copy, registry file, or media bundle is written by this module.
const { createHash } = require('node:crypto');
const { serialize, deserialize } = require('node:v8');
const hash = b => createHash('sha256').update(b).digest('hex');
const times = ['creationTime', 'lastAccessTime', 'lastWriteTime'];
const volumes = ['volumeLabels', 'volumeSerials', 'driveTypes', 'volumeSizes'];
const CHUNK = 1024 * 1024;
function canonical(p, dir = false) {
  if (typeof p !== 'string' || p !== p.toLowerCase() ||
      !(dir && /^c:(\\)?$/.test(p)) && !/^c:\\[^\\]/.test(p) ||
      p.slice(3).split('\\').some(s => (!s && p.length > 3) || s === '.' || s === '..' || /[/:\x00]/.test(s)))
    throw new Error('unsafe mutable memory path');
  return p;
}
function fileRecord(e) {
  const r = { data: Buffer.from(e.data), attrs: e.attrs ?? null, name: e.name ?? null,
    staticModule: !!e.staticModule };
  for (const k of times) r[k] = e[k] ? { ...e[k] } : null;
  validateFile(r);
  return r;
}
function validateFile(r) {
  const uint = x => Number.isInteger(x) && x >= 0 && x <= 0xffffffff;
  if (!r || !(r.data instanceof Uint8Array) || typeof r.staticModule !== 'boolean' || !(r.attrs === null || uint(r.attrs)) ||
      !(r.name === null || typeof r.name === 'string' && !/[\\/\x00]/.test(r.name)) ||
      times.some(k => !(r[k] === null || r[k] && uint(r[k].lo) && uint(r[k].hi))))
    throw new Error('invalid memory file metadata/bytes');
}
function signature(r) {
  const { data, ...meta } = r;
  return hash(data) + ':' + JSON.stringify(meta);
}
function registry(r) {
  if (!r || Array.isArray(r) || typeof r !== 'object' || Object.entries(r).some(
    ([k, v]) => !/^(reg:|ini:)/.test(k) || typeof v !== 'string')) throw new Error('invalid memory registry');
}
function capture(vfs, storage) {
  const readonly = require('./readonly-media-context').capture(vfs);
  const files = [], dirs = [];
  for (const [p, e] of vfs.files) {
    if (vfs.readOnlyDrives.has(p[0])) continue;
    canonical(p); files.push([p, fileRecord(e)]);
  }
  for (const p of vfs.dirs) {
    if (!vfs.readOnlyDrives.has(p[0])) { canonical(p, true); dirs.push(p); }
  }
  const store = storage.exportStore(); registry(store);
  return { version: 1, files, dirs, registry: store, readonly,
    volumes: Object.fromEntries(volumes.map(k => [k, [...(vfs[k] || [])].filter(([d]) => d === 'c')])),
    cwd: vfs.getCurrentDirectory() };
}
function validate(s) {
  if (!s || s.version !== 1 || !Array.isArray(s.files) || !Array.isArray(s.dirs) ||
      !Array.isArray(s.readonly) || typeof s.cwd !== 'string') throw new Error('invalid memory snapshot');
  registry(s.registry);
  const names = new Set();
  for (const row of s.files) {
    if (!Array.isArray(row) || row.length !== 2) throw new Error('invalid memory file row');
    const [p, r] = row; canonical(p); validateFile(r);
    if (names.has(p)) throw new Error('duplicate memory file'); names.add(p);
  }
  const dirs = new Set();
  for (const p of s.dirs) { canonical(p, true); if (dirs.has(p)) throw new Error('duplicate memory directory'); dirs.add(p); }
  for (const k of volumes) {
    if (!Array.isArray(s.volumes?.[k]) || s.volumes[k].length > 1 || s.volumes[k].some(row =>
      !Array.isArray(row) || row.length !== 2 || row[0] !== 'c')) throw new Error('invalid memory volume');
  }
  return s;
}
function baseline(s) {
  validate(s);
  return { files: new Map(s.files.map(([p, r]) => [p, signature(r)])), dirs: new Set(s.dirs),
    registry: { ...s.registry }, readonly: JSON.stringify(s.readonly), volumes: JSON.stringify(s.volumes) };
}
function restore(vfs, storage, s) {
  validate(s);
  // Adopt the exact mutable namespace, including absence/whiteouts relative to
  // the normal boot mounts. Readonly sources must already have been restored.
  for (const p of [...vfs.files.keys()]) if (!vfs.readOnlyDrives.has(p[0])) vfs.files.delete(p);
  for (const p of [...vfs.dirs]) if (!vfs.readOnlyDrives.has(p[0])) vfs.dirs.delete(p);
  for (const [p, r] of s.files) vfs.files.set(p, entry(r));
  for (const p of s.dirs) vfs.dirs.add(p);
  for (const k of volumes) {
    if (!vfs[k]) vfs[k] = new Map();
    vfs[k].delete('c'); for (const [d, value] of s.volumes[k]) vfs[k].set(d, value);
  }
  storage.clearStore(); storage.importStore(s.registry);
}
function entry(r) {
  const e = { data: new Uint8Array(r.data), staticModule: r.staticModule };
  for (const k of ['attrs', 'name', ...times]) if (r[k] !== null) e[k] = typeof r[k] === 'object' ? { ...r[k] } : r[k];
  return e;
}
function delta(before, after) {
  validate(after);
  if (JSON.stringify(after.readonly) !== before.readonly || JSON.stringify(after.volumes) !== before.volumes)
    throw new Error('child changed source ownership or volume context');
  const now = new Map(after.files);
  return { version: 1,
    files: after.files.filter(([p, r]) => before.files.get(p) !== signature(r)),
    whiteouts: [...before.files.keys()].filter(p => !now.has(p)),
    addedDirs: after.dirs.filter(p => !before.dirs.has(p)),
    removedDirs: [...before.dirs].filter(p => !after.dirs.includes(p)),
    registry: after.registry };
}
function merge(vfs, storage, before, d) {
  let rollback;
  try {
    if (!d || d.version !== 1 || !Array.isArray(d.files) ||
        !['whiteouts', 'addedDirs', 'removedDirs'].every(k => Array.isArray(d[k]))) throw new Error('invalid memory delta');
    registry(d.registry);
    const paths = new Set();
    for (const row of d.files) {
      if (!Array.isArray(row) || row.length !== 2) throw new Error('invalid memory delta row');
      const [p, r] = row; canonical(p); validateFile(r);
      if (paths.has(p)) throw new Error('duplicate memory change'); paths.add(p);
    }
    for (const p of d.whiteouts) {
      canonical(p); if (!before.files.has(p) || paths.has(p)) throw new Error('invalid memory whiteout'); paths.add(p);
    }
    // Validate every touched path and registry key before the first mutation.
    if (JSON.stringify(require('./readonly-media-context').capture(vfs)) !== before.readonly)
      throw new Error('parent source ownership changed');
    const currentVolumes = Object.fromEntries(volumes.map(k => [k, [...(vfs[k] || [])].filter(([d]) => d === 'c')]));
    if (JSON.stringify(currentVolumes) !== before.volumes) throw new Error('parent volume context changed');
    for (const p of paths) {
      const e = vfs.files.get(p);
      if (vfs.dirs.has(p) !== before.dirs.has(p) || d.files.some(([f]) => f === p) && vfs.dirs.has(p))
        throw new Error('parent file/directory collision: ' + p);
      if ((e ? signature(fileRecord(e)) : undefined) !== before.files.get(p)) throw new Error('parent file conflict: ' + p);
      if ([...vfs.handles.values()].some(h => !h.closed && h.path === p)) throw new Error('parent file still open: ' + p);
    }
    const dirs = new Set();
    for (const [list, existed] of [[d.addedDirs, false], [d.removedDirs, true]]) for (const p of list) {
      canonical(p, true);
      if (dirs.has(p) || before.dirs.has(p) !== existed || vfs.dirs.has(p) !== existed)
        throw new Error('parent directory conflict: ' + p);
      dirs.add(p);
      if (!existed && (vfs.files.has(p) || d.files.some(([f]) => f === p)))
        throw new Error('memory file/directory collision: ' + p);
      if (existed && [...vfs.files.keys(), ...vfs.dirs].some(k => k.startsWith(p + '\\') &&
          !before.files.has(k) && !before.dirs.has(k))) throw new Error('parent added directory contents');
    }
    const store = storage.exportStore(), merged = { ...store };
    for (const k of new Set([...Object.keys(before.registry), ...Object.keys(d.registry)])) {
      if (before.registry[k] === d.registry[k]) continue;
      if (store[k] !== before.registry[k]) throw new Error('parent registry conflict: ' + k);
      if (d.registry[k] === undefined) delete merged[k]; else merged[k] = d.registry[k];
    }
    // Preserve original entry identities and backing bytes on any refusal.
    // Normal VFS/overlay hooks still run, but watcher delivery is deferred until
    // the namespace and registry commit. A rolled-back dirty overlay path will
    // consequently flush its restored value, never a partial child value.
    const files = new Map(vfs.files), oldDirs = new Set(vfs.dirs);
    const handles = new Set(vfs.handles.keys()), notify = vfs._notifyChange;
    const pending = [];
    rollback = () => {
      vfs._notifyChange = notify;
      for (const h of vfs.handles.keys()) if (!handles.has(h)) { vfs.closeHandle(h); vfs.handles.delete(h); }
      vfs.files.clear(); for (const [p, e] of files) vfs.files.set(p, e);
      vfs.dirs.clear(); for (const p of oldDirs) vfs.dirs.add(p);
      storage.clearStore(); storage.importStore(store);
    };
    vfs._notifyChange = (...args) => pending.push(args);
    for (const p of paths) if (vfs.files.has(p)) vfs.files.set(p, entry(fileRecord(vfs.files.get(p))));
    for (const p of d.addedDirs) if (!vfs.createDirectory(p)) throw new Error('memory merge mkdir refused: ' + p);
    for (const [p, r] of d.files) {
      // Keep normal VFS notification/overlay hooks and exact file metadata.
      const h = vfs.createFile(p, 0x40000000, 2);
      if (!h) throw new Error('memory merge write refused: ' + p);
      const written = vfs.writeFile(h, r.data, r.data.length);
      if (!written?.ok || written.bytesWritten !== r.data.length) throw new Error('memory merge write refused: ' + p);
      const e = vfs.files.get(p);
      e.staticModule = r.staticModule;
      for (const k of ['attrs', 'name', ...times]) { delete e[k]; if (r[k] !== null) e[k] = typeof r[k] === 'object' ? { ...r[k] } : r[k]; }
      vfs.closeHandle(h); vfs._notifyChange(p, 0x1f);
    }
    for (const p of d.whiteouts) if (!vfs.deleteFile(p)) throw new Error('memory merge delete refused: ' + p);
    for (const p of d.removedDirs) if (!vfs.removeDirectory(p)) throw new Error('memory merge rmdir refused: ' + p);
    storage.clearStore(); storage.importStore(merged);
    rollback = null; vfs._notifyChange = notify;
    const notificationErrors = [];
    for (const args of pending) try { notify.apply(vfs, args); } catch (e) { notificationErrors.push(e.message); }
    return { merged: true, written: d.files.length, deleted: d.whiteouts.length,
      ...(notificationErrors.length ? { notificationErrors } : {}) };
  } catch (e) {
    if (rollback) {
      try { rollback(); }
      catch (failure) { return { merged: false, partialApplied: true, reason: e.message, rollbackError: failure.message }; }
    }
    return { merged: false, reason: e.message };
  }
}
// Sequential chunks honor IPC backpressure. The launch token and message kind
// are private capabilities bound to one actual ChildProcess, not guest ACKs.
async function send(channel, token, kind, value) {
  const bytes = serialize(value);
  const emit = msg => new Promise((resolve, reject) => {
    if (!channel.connected) return reject(new Error('memory IPC disconnected'));
    channel.send({ t: 'vfs-memory', token, kind, ...msg }, e => e ? reject(e) : resolve());
  });
  await emit({ op: 'begin', version: 1, size: bytes.length, hash: hash(bytes) });
  let seq = 0;
  for (let offset = 0; offset < bytes.length; offset += CHUNK) await emit({ op: 'chunk', seq: seq++, data: bytes.subarray(offset, offset + CHUNK) });
  await emit({ op: 'end', seq });
}
function receive(channel, token, kind, timeout = 60000) {
  let header, chunks = [], length = 0, seq = 0, complete = false;
  const state = { value: null, error: null };
  let resolve, reject;
  state.promise = new Promise((a, b) => { resolve = a; reject = b; });
  // A parent may not inspect the promise until close. Preserve failures without
  // producing an unhandled rejection while its guest is still running.
  state.promise.catch(() => {});
  const fail = e => { state.error ||= e; chunks = []; clearTimeout(timer); reject(e); };
  const timer = setTimeout(() => fail(new Error('memory IPC incomplete/timeout')), timeout);
  const message = m => {
    if (!m || m.t !== 'vfs-memory') return;
    try {
      if (state.error) return;
      if (m.token !== token || m.kind !== kind || complete) throw new Error('memory IPC ownership/order mismatch');
      if (m.op === 'begin') {
        if (header || m.version !== 1 || !Number.isSafeInteger(m.size) || m.size < 1 || !/^[a-f0-9]{64}$/.test(m.hash)) throw new Error('invalid memory IPC header');
        header = m;
      } else if (m.op === 'chunk') {
        if (!header || m.seq !== seq++ || !(m.data instanceof Uint8Array) || !m.data.length || m.data.length > CHUNK || length + m.data.length > header.size)
          throw new Error('invalid memory IPC chunk');
        chunks.push(m.data); length += m.data.length;
      } else if (m.op === 'end') {
        if (!header || m.seq !== seq || length !== header.size) throw new Error('incomplete memory IPC');
        const bytes = Buffer.concat(chunks); chunks = [];
        if (hash(bytes) !== header.hash) throw new Error('memory IPC digest mismatch');
        state.value = deserialize(bytes); complete = true; clearTimeout(timer); resolve(state.value);
      } else throw new Error('invalid memory IPC operation');
    } catch (e) { fail(e); }
  };
  const disconnected = () => { if (!complete) fail(new Error('memory IPC EOF before completion')); };
  channel.on('message', message); channel.once('disconnect', disconnected);
  if (!channel.connected) queueMicrotask(disconnected);
  state.dispose = () => { clearTimeout(timer); channel.removeListener('message', message); channel.removeListener('disconnect', disconnected); };
  return state;
}
module.exports = { capture, validate, baseline, restore, delta, merge, send, receive };
