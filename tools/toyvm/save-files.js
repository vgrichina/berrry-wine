'use strict';
const fs = require('fs');
const path = require('path');

// Explicit CLI export only; guest writes themselves never reach the host.
// Keep the DOS relative namespace and refuse aliases, traversal and symlink
// destinations so an export cannot leave the chosen output directory.
function saveFiles(directory, records) {
  const entries = [...records];
  const names = new Set();
  for (const [name] of entries) {
    if (typeof name !== 'string' || /[\\:\x00-\x1f]/.test(name)
      || name.split('/').some(p => !p || p === '.' || p === '..') || names.has(name.toLowerCase())) throw new Error('Invalid export path: ' + name);
    names.add(name.toLowerCase());
  }
  const root = path.resolve(directory);
  fs.mkdirSync(root, { recursive: true });
  const saved = [];
  for (const [name, rec] of entries) {
    let at = root;
    const parts = name.split('/');
    for (let i = 0; i < parts.length; i++) {
      at = path.join(at, parts[i]);
      let stat;
      try { stat = fs.lstatSync(at); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      if (stat && stat.isSymbolicLink()) throw new Error('Symlink export path: ' + name);
      if (i < parts.length - 1) {
        if (stat && !stat.isDirectory()) throw new Error('Non-directory export path: ' + name);
        if (!stat) fs.mkdirSync(at);
      }
    }
    fs.writeFileSync(at, Buffer.from(rec.data.subarray(0, rec.len)));
    saved.push({ path: at, size: rec.len });
  }
  return saved;
}
module.exports = { saveFiles };
