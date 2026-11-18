'use strict';
const path = require('node:path').win32;
const registry = require('./dll-registry');

// Match the browser's mounted-private-module admission. Real sibling modules
// supplied by ordinary imported media need no registered app or manual seeds.
// Keep builtin system implementations and exact application-directory scope.
function isMountedPrivateDll(vfs, name, exePath) {
  if (!vfs?.files || !exePath || !name || /[\\/:]/.test(name) ||
      registry.isBuiltinOnlyDll(name)) return false;
  const key = path.join(path.dirname(exePath), name).toLowerCase();
  const entry = vfs.files.get(key);
  return !!entry && !entry.staticModule;
}
module.exports = { isMountedPrivateDll };
