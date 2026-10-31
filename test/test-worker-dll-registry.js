'use strict';

// Exercise the shipped classic-Worker bootstrap and dependency walker without
// an interpreter. Only graphics/transport imports are omitted: DLL policy and
// PE import inspection use the production modules in a window-less realm.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const loader = require('../lib/dll-loader');
const nodeBoot = require('../lib/process-boot');

function image(imports = []) {
  const b = Buffer.alloc(4096), pe = 0x80, section = pe + 24 + 0xe0;
  b.writeUInt32LE(pe, 0x3c);
  b.writeUInt32LE(0x4550, pe);
  b.writeUInt16LE(1, pe + 6);
  b.writeUInt16LE(0xe0, pe + 20);
  b.writeUInt32LE(0x1000, pe + 128);
  b.writeUInt32LE(0xe00, section + 8);
  b.writeUInt32LE(0x1000, section + 12);
  b.writeUInt32LE(0xe00, section + 16);
  b.writeUInt32LE(0x200, section + 20);
  let cursor = 0x200 + (imports.length + 1) * 20;
  const rva = off => off - 0x200 + 0x1000;
  imports.forEach(([dll, symbol], i) => {
    const desc = 0x200 + i * 20;
    b.writeUInt32LE(rva(cursor), desc + 12);
    cursor += b.write(dll + '\0', cursor);
    cursor = (cursor + 3) & ~3;
    b.writeUInt32LE(rva(cursor), desc);
    const thunk = cursor;
    cursor += 8;
    if (typeof symbol === 'number') b.writeUInt32LE((0x80000000 | symbol) >>> 0, thunk);
    else {
      b.writeUInt32LE(rva(cursor), thunk);
      cursor += 2;
      cursor += b.write(symbol + '\0', cursor);
    }
  });
  return b;
}

const finished = {}, imported = [];
const context = { URL, Uint8Array, DllLoader: loader,
  location: { href: 'https://example.invalid/lib/guest-worker.js?v=registry-test' },
  importScripts(...urls) {
    for (const url of urls) {
      imported.push(url);
      const name = url.split('?')[0];
      if (name === 'dll-registry.js' || name === 'process-boot.js')
        vm.runInContext(fs.readFileSync(require.resolve('../lib/' + name), 'utf8'), context, { filename: name });
    }
    throw finished; // stop after the actual bootstrap imports, before transport
  },
};
context.self = context;
vm.createContext(context);
assert.throws(() => vm.runInContext(fs.readFileSync(require.resolve('../lib/guest-worker'), 'utf8'), context),
  error => error === finished);
assert.equal(typeof context.window, 'undefined');

const root = image([['OLEAUT32.DLL', 161], ['KERNEL32.DLL', 'GetLastError'],
  ['missing-vendor.dll', 'VendorOnly']]);
const automation = image([['MSVCRT.DLL', 'malloc']]);
const files = new Map([['oleaut32.dll', automation], ['msvcrt.dll', image()]]);
function walk(boot, loaded = []) {
  const requests = [], iterator = boot.loadLibraryDependencies(root, 'component.dll', new Set(loaded),
    name => name === 'GetLastError' || name === 'malloc');
  let step = iterator.next();
  while (!step.done) {
    requests.push(step.value);
    step = iterator.next(files.get(step.value) || null);
  }
  return { requests, result: Array.from(step.value, x => ({ fileName: x.fileName, fatal: x.fatal })) };
}
const expected = walk(nodeBoot);
assert.deepEqual(expected.requests, ['oleaut32.dll', 'msvcrt.dll', 'missing-vendor.dll']);
assert.deepEqual(expected.result, [
  { fileName: 'msvcrt.dll', fatal: false },
  { fileName: 'oleaut32.dll', fatal: false },
  { fileName: 'missing-vendor.dll', fatal: true },
]);
assert.deepEqual(walk(context.processBoot), expected,
  'browser Worker must load registered ordinal dependencies just like Node');
assert.deepEqual(walk(context.processBoot, ['oleaut32.dll']), walk(nodeBoot, ['oleaut32.dll']),
  'already mapped dependencies stay skipped');
assert.equal(context.dllRegistry.dllPath('OLEAUT32.DLL'), 'binaries/dlls/oleaut32.dll');
assert.ok(imported.every(url => url.endsWith('?v=registry-test')), 'registry shares Worker source identity');
console.log('PASS classic Worker DLL registry: ordinal/nested dependencies, system fallback, missing vendor, loaded skip');
