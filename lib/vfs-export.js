const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

function normalizeGuestPath(value) {
  return String(value).replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
}

function guestParents(guestPath) {
  const parts = normalizeGuestPath(guestPath).split('\\');
  const parents = [];
  while (parts.length > 1) {
    parts.pop();
    parents.push(parts.join('\\'));
  }
  return parents;
}

/**
 * Export a VirtualFS snapshot to a host directory.
 *
 * A Windows guest can contain a file and a directory at the same normalized
 * path when a buggy installer creates both. Host filesystems cannot represent
 * that namespace. Preserve the directory tree and write the colliding file
 * beside it with a deterministic suffix instead of aborting the whole export.
 */
function saveVfsToHost(vfs, outputRoot, options = {}) {
  const suffix = options.suffix ? String(options.suffix).toLowerCase() : '';
  // Guest-path prefix (e.g. c:\program files\myth_tfl): an installer capture
  // exports only the tree it installed, not every disc file Setup read.
  const prefix = options.prefix ? normalizeGuestPath(options.prefix) : '';
  const skipPaths = new Set((options.skipPaths || []).map(normalizeGuestPath));
  const log = options.log || (() => {});
  const directoryKeys = new Set([...vfs.dirs].map(normalizeGuestPath));
  const occupiedKeys = new Set(directoryKeys);

  for (const key of vfs.files.keys()) {
    const normalized = normalizeGuestPath(key);
    occupiedKeys.add(normalized);
    for (const parent of guestParents(normalized)) directoryKeys.add(parent);
  }

  const written = [];
  for (const [key, value] of vfs.files.entries()) {
    const normalized = normalizeGuestPath(key);
    if (skipPaths.has(normalized)) continue;
    if (suffix && !normalized.endsWith(suffix)) continue;
    if (prefix && normalized !== prefix && !normalized.startsWith(prefix + '\\')) continue;
    // Mounted ISO/CUE/ZIP entries deliberately stay provider-backed until a
    // guest reads them. A snapshot is the writable machine state, not a copy
    // of the source disc, and touching `.data` on one of these entries either
    // duplicates the whole medium or raises VfsPendingError. Installed files
    // are resident entries, so omit lazy source-media files from the export.
    if (value && value._provider) {
      log(`[save-vfs] skip lazy media file ${key}`);
      continue;
    }

    const rel = String(key).replace(/^c:\\/i, '');
    let exportRel = rel;
    if (directoryKeys.has(normalized)) {
      let counter = 1;
      do {
        const tag = counter === 1 ? '.__vfs_file__' : `.__vfs_file__${counter}`;
        exportRel = rel + tag;
        counter++;
      } while (occupiedKeys.has(normalizeGuestPath('c:\\' + exportRel)));
      log(`[save-vfs] file/directory collision: ${key} -> ${exportRel}`);
    }

    const outputPath = path.join(outputRoot, ...exportRel.split('\\'));
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, Buffer.from(value.data));
    log(`[save-vfs] ${outputPath} (${value.data.length} bytes)`);
    written.push({ guestPath: key, outputPath, collision: exportRel !== rel });
  }
  return written;
}

/**
 * Bring a child process's C:\ back into its parent's VirtualFS.
 *
 * `before` maps each lowercase guest path the parent exported for the child
 * (saveVfsToHost rows) to the host file holding it; `outputRoot` is what the
 * child exported when it ended. Files the child added or changed are written
 * and files it deleted are deleted, through the VirtualFS calls the guest
 * itself uses, so an attached overlay journals them like any other write.
 * Returns { written, deleted }.
 */
function mergeVfsTreeBack(vfs, before, outputRoot) {
  const after = new Map();
  const walk = (dir, rel) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const hostPath = path.join(dir, entry.name);
      const guestRel = rel ? `${rel}\\${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(hostPath, guestRel);
      else if (entry.isFile() && !/\.__vfs_file__\d*$/.test(entry.name)) {
        after.set(normalizeGuestPath(`c:\\${guestRel}`), hostPath);
      }
    }
  };
  walk(outputRoot, '');
  // Finish all reads before applying any writes/deletions. An unreadable
  // export must not leave half a snapshot applied to the parent.
  return applyVfsTreeBack(vfs, before,
    new Map([...after].map(([key, file]) => [key, fs.readFileSync(file)])));
}

function applyVfsTreeBack(vfs, before, after, requireOriginals = false) {
  const originals = new Map([...before]
    .filter(([, file]) => requireOriginals || fs.existsSync(file))
    .map(([key, file]) => [key, fs.readFileSync(file)]));
  let written = 0;
  let deleted = 0;
  for (const [guestPath, data] of after) {
    const old = originals.get(guestPath);
    if (old && Buffer.compare(old, data) === 0) continue;
    const handle = vfs.createFile(guestPath, 0x40000000, 2); // GENERIC_WRITE, CREATE_ALWAYS
    if (!handle) continue;
    vfs.writeFile(handle, new Uint8Array(data), data.length);
    vfs.closeHandle(handle);
    written++;
  }
  for (const guestPath of before.keys()) {
    if (!after.has(guestPath) && vfs.deleteFile(guestPath)) deleted++;
  }
  return { written, deleted };
}

const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function readSnapshotFile(file) {
  if (!fs.lstatSync(file).isFile()) throw new Error('snapshot entry is not a regular file');
  return fs.readFileSync(file);
}

// Walk only the expected root, never paths supplied by the completion record.
// Keep the bytes we validate so applying the snapshot does not reread it.
function readChildTree(root) {
  const files = new Map(), entries = [], names = new Set();
  const walk = (dir, rel) => {
    if (!fs.lstatSync(dir).isDirectory()) throw new Error('snapshot root is not a directory');
    for (const name of fs.readdirSync(dir).sort()) {
      if (!name || name === '.' || name === '..' || /[\\:\x00]/.test(name))
        throw new Error('unsafe snapshot path');
      const relative = rel ? `${rel}\\${name}` : name;
      const key = normalizeGuestPath(`c:\\${relative}`);
      if (names.has(key)) throw new Error('ambiguous snapshot path');
      names.add(key);
      const file = path.join(dir, name), stat = fs.lstatSync(file);
      if (stat.isDirectory()) {
        entries.push([relative, 'directory']);
        walk(file, relative);
      } else if (stat.isFile()) {
        const bytes = readSnapshotFile(file);
        entries.push([relative, digest(bytes)]);
        if (!/\.__vfs_file__\d*$/.test(name)) files.set(key, bytes);
      } else throw new Error('snapshot contains a link or nonregular entry');
    }
  };
  walk(root, '');
  return { files, hash: digest(JSON.stringify(entries)) };
}

function parseChildRegistry(bytes) {
  const registry = JSON.parse(bytes.toString('utf8'));
  if (!registry || Array.isArray(registry) || typeof registry !== 'object' ||
      Object.entries(registry).some(([key, value]) => !/^(reg:|ini:)/.test(key) || typeof value !== 'string'))
    throw new Error('invalid child registry snapshot');
  return registry;
}

// Private --spawn-processes transport. Standalone --save-vfs/--reg-export keep
// their existing behavior. Publish LAST, only after both exports succeeded;
// a fresh root also makes an intentionally empty tree explicit.
function saveCompletedChildState(vfs, storage, outDir, regOut, completion, token) {
  if (!token) throw new Error('missing child snapshot token');
  fs.rmSync(completion, { force: true });
  fs.mkdirSync(outDir); // refuses stale/reused output
  for (const [key, value] of vfs.files) {
    if (value && value._provider) continue;
    if (!/^c:\\/i.test(key) || key.slice(3).split('\\').some(part =>
      !part || part === '.' || part === '..' || /[/:\x00]/.test(part)))
      throw new Error('unsafe child export path');
  }
  saveVfsToHost(vfs, outDir);
  const registryBytes = Buffer.from(JSON.stringify(storage.exportStore()));
  parseChildRegistry(registryBytes);
  fs.writeFileSync(regOut, registryBytes);
  const tree = readChildTree(outDir);
  const record = { version: 1, token, treeHash: tree.hash, registryHash: digest(registryBytes) };
  fs.writeFileSync(completion + '.tmp', JSON.stringify(record));
  fs.renameSync(completion + '.tmp', completion);
}

function mergeCompletedChildState(vfs, storage, before, outDir, regOut, completion, token) {
  let tree, registry;
  try {
    const record = JSON.parse(readSnapshotFile(completion).toString('utf8'));
    if (!token || !record || record.version !== 1 || record.token !== token ||
        !/^[a-f0-9]{64}$/.test(record.treeHash) || !/^[a-f0-9]{64}$/.test(record.registryHash))
      throw new Error('invalid or stale child completion');
    tree = readChildTree(outDir);
    const registryBytes = readSnapshotFile(regOut);
    registry = parseChildRegistry(registryBytes);
    if (record.treeHash !== tree.hash || record.registryHash !== digest(registryBytes))
      throw new Error('child snapshot digest mismatch');
  } catch (error) {
    return { merged: false, reason: error.message };
  }
  const result = applyVfsTreeBack(vfs, before, tree.files, true);
  storage.clearStore();
  const keys = storage.importStore(registry);
  return { merged: true, ...result, keys };
}

module.exports = { saveVfsToHost, mergeVfsTreeBack, saveCompletedChildState, mergeCompletedChildState };
