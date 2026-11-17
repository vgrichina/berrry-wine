'use strict';

// Resolve a module by guest identity, never by the opaque host blob basename.
// Both static imports and late loads use this after the complete base/overlay
// mount. An explicit path is exact: a same-named file elsewhere is no alias.
const path = require('node:path').win32;
function findInstalledDll(vfs, request, exePath) {
  if (!vfs || !vfs.files) return null;
  const name = String(request || '').replace(/\//g, '\\');
  if (!name || name.includes('\0')) return null;
  let candidates;
  if (name.includes('\\') || name.includes(':')) {
    candidates = [vfs._resolvePath(name)];
  } else {
    const cwd = vfs.getCurrentDirectory();
    candidates = [exePath && path.join(path.dirname(exePath), name),
      path.join(cwd, name), 'c:\\windows\\system\\' + name,
      'c:\\windows\\' + name];
  }
  for (const candidate of new Set(candidates.filter(Boolean))) {
    const guest = path.normalize(candidate).toLowerCase();
    const entry = vfs.files.get(guest);
    if (!entry || entry.staticModule) continue;
    const bytes = entry.data;
    if (!bytes) throw new Error('DLL bytes not resident: ' + guest);
    return { name: path.basename(guest), path: guest, bytes };
  }
  return null;
}
module.exports = { findInstalledDll };
