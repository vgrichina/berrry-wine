// Offline host-only fixture: executes authentic JS VirtualFS, no WASM or x86.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
for (const path of process.argv.slice(2)) {
  const context = {module: {exports: {}}, require: () => ({}), console, TextEncoder, TextDecoder};
  vm.runInNewContext(fs.readFileSync(path, 'utf8'), context, {filename: path});
  const vfs = new context.module.exports.VirtualFS();
  const handle = vfs.createFile('C:\\windows\\temp\\probe', 0xc0000000, 2);
  assert(handle);
  let total = 0;
  while (total < 0x88000) {
    const n = Math.min(4096, 0x88000-total), bytes = new Uint8Array(n).fill(total/4096 & 255);
    const result = vfs.writeFile(handle, bytes, n);
    assert(result.ok && result.bytesWritten === n);
    total += n;
  }
  const entry = vfs.files.get('c:\\windows\\temp\\probe');
  assert.equal(entry.data.length, 0x88000);
  assert.equal(entry.data[0x11000], 17);
  const rejected = vfs.writeFile(0x123456, new Uint8Array(4096), 4096);
  assert(!rejected.ok && rejected.bytesWritten === 0 && rejected.error === 6);
  // Literal predicate from 404789/40478e; not a guest execution.
  const callbackError = (requested, written) => written === requested ? 0 : -4;
  assert.equal(callbackError(4096,4096),0); // even stale last_error=112 cannot change it
  assert.equal(callbackError(4096,0),-4);
  console.log(JSON.stringify({source:path, total, writes:136, crossedCapturedLength:69632,
    invalidHandleReject:rejected, callbackFull:0, callbackShort:-4,
    scope:'host VirtualFS and predicate only; no actual historical API invocation proved'}));
}
