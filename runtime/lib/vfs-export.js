const fs = require('fs');
const path = require('path');

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
  let written = 0;
  let deleted = 0;
  for (const [guestPath, hostPath] of after) {
    const data = fs.readFileSync(hostPath);
    const old = before.get(guestPath);
    if (old && fs.existsSync(old) && Buffer.compare(fs.readFileSync(old), data) === 0) continue;
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

module.exports = { saveVfsToHost, mergeVfsTreeBack };
