'use strict';
const fs = require('node:fs');
const path = require('node:path');

// A process image is a loader input, not mutable machine state. The snapshot
// exporter deliberately excludes borrowed media, including an already-read PE.
// Read only this selected image into a separate temporary loader file; retain
// its original provider and the independent inherited readonly mount context.
function childExecutable(vfs, guestExe, written, temporaryRoot) {
  const row = written.find(row => String(row.guestPath).toLowerCase() === guestExe);
  if (row) return row;
  const entry = vfs.files.get(guestExe);
  if (!entry || !entry._provider) return null;
  // Native fd sources provide synchronous reads. An unfilled async source
  // throws VfsPendingError: do not launch partial bytes or fake success.
  const bytes = entry.data;
  const outputPath = path.join(temporaryRoot, 'process-image.exe');
  fs.writeFileSync(outputPath, Buffer.from(bytes), { flag: 'wx' });
  return { guestPath: guestExe, outputPath };
}
module.exports = { childExecutable };
