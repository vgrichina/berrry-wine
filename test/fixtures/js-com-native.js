'use strict';
// PE layout adapted from test/test-icm-callback-ownership-native.js.
const assert = require('node:assert/strict');
const d32 = v => [v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24];
function buildPe({ dll, imageBase, entryRva, code, codeRva = 0x1000, imports = [], exportName = null,
                   exportRva = 0, extra = [] }) {
  const SECT = 0x1000, RAW = 0x200, VSIZE = 0x6000;
  const img = Buffer.alloc(RAW + 0x5000);
  const at = (rva) => RAW + (rva - SECT);
  const iat = {};
  // Imports at RVA 0x1400: descriptors, then per-DLL OFT/IAT/names.
  let impDir = 0, impSize = 0;
  if (imports.length) {
    impDir = 0x1400;
    impSize = (imports.length + 1) * 20;
    let p = impDir + impSize;
    const desc = [];
    for (const [name, funcs] of imports) {
      const oft = p; p += (funcs.length + 1) * 4;
      const ft = p; p += (funcs.length + 1) * 4;
      desc.push({ name, funcs, oft, ft });
    }
    for (const d of desc) {
      d.nameRva = p; img.write(d.name + '\0', at(p), 'ascii'); p += d.name.length + 1;
      d.funcs.forEach((f, i) => {
        p = (p + 1) & ~1;
        img.writeUInt16LE(0, at(p));
        img.write(f + '\0', at(p) + 2, 'ascii');
        img.writeUInt32LE(p, at(d.oft) + i * 4);
        img.writeUInt32LE(p, at(d.ft) + i * 4);
        iat[f] = d.ft + i * 4;
        p += 2 + f.length + 1;
      });
    }
    desc.forEach((d, i) => {
      const o = at(impDir) + i * 20;
      img.writeUInt32LE(d.oft, o);
      img.writeUInt32LE(d.nameRva, o + 12);
      img.writeUInt32LE(d.ft, o + 16);
    });
    assert(p < 0x1600, 'import tables overflow');
  }
  // Export directory at RVA 0x1600: one named function.
  let expDir = 0, expSize = 0;
  if (exportName) {
    expDir = 0x1600; expSize = 0x80;
    const e = at(expDir);
    img.writeUInt32LE(expDir + 0x40, e + 12);       // Name
    img.writeUInt32LE(1, e + 16);                    // Base
    img.writeUInt32LE(1, e + 20);                    // NumberOfFunctions
    img.writeUInt32LE(1, e + 24);                    // NumberOfNames
    img.writeUInt32LE(expDir + 0x28, e + 28);        // AddressOfFunctions
    img.writeUInt32LE(expDir + 0x2C, e + 32);        // AddressOfNames
    img.writeUInt32LE(expDir + 0x30, e + 36);        // AddressOfNameOrdinals
    img.writeUInt32LE(exportRva, e + 0x28);
    img.writeUInt32LE(expDir + 0x50, e + 0x2C);
    img.writeUInt16LE(0, e + 0x30);
    img.write(dll + '\0', e + 0x40, 'ascii');
    img.write(exportName + '\0', e + 0x50, 'ascii');
  }
  const bytes = typeof code === 'function' ? code(iat) : code;
  Buffer.from(bytes).copy(img, at(codeRva));
  for (const [rva, b] of extra) Buffer.from(b).copy(img, at(rva));

  const pe = 0x80, opt = pe + 24, sec = opt + 0xE0;
  img.writeUInt16LE(0x5A4D, 0);
  img.writeUInt32LE(pe, 0x3C);
  img.writeUInt32LE(0x00004550, pe);
  img.writeUInt16LE(0x014C, pe + 4);
  img.writeUInt16LE(1, pe + 6);
  img.writeUInt16LE(0xE0, pe + 20);
  img.writeUInt16LE(exportName ? 0x2102 : 0x0102, pe + 22);   // EXECUTABLE | 32BIT (| DLL)
  img.writeUInt16LE(0x010B, opt);
  img.writeUInt32LE(0x1000, opt + 4);
  img.writeUInt32LE(entryRva, opt + 16);
  img.writeUInt32LE(SECT, opt + 20);
  img.writeUInt32LE(imageBase, opt + 28);
  img.writeUInt32LE(0x1000, opt + 32);
  img.writeUInt32LE(0x200, opt + 36);
  img.writeUInt16LE(4, opt + 40);
  img.writeUInt16LE(4, opt + 48);
  img.writeUInt32LE(SECT + VSIZE, opt + 56);
  img.writeUInt32LE(RAW, opt + 60);
  img.writeUInt16LE(2, opt + 68);                               // GUI
  img.writeUInt32LE(0x100000, opt + 72);
  img.writeUInt32LE(0x1000, opt + 76);
  img.writeUInt32LE(0x100000, opt + 80);
  img.writeUInt32LE(0x1000, opt + 84);
  img.writeUInt32LE(16, opt + 92);
  img.writeUInt32LE(expDir, opt + 96);
  img.writeUInt32LE(expSize, opt + 100);
  img.writeUInt32LE(impDir, opt + 104);
  img.writeUInt32LE(impSize, opt + 108);
  img.write('.text\0\0\0', sec, 'ascii');
  img.writeUInt32LE(VSIZE, sec + 8);
  img.writeUInt32LE(SECT, sec + 12);
  img.writeUInt32LE(0x5000, sec + 16);
  img.writeUInt32LE(RAW, sec + 20);
  img.writeUInt32LE(0xE0000060, sec + 36);
  return { img, iat };
}

const B = 0x400000, D = B + 0x3000;
const A = { cls: D, innerCls: D + 16, dllCls: D + 32, iid: D + 48,
  factory: D + 64, inner: D + 68, vtable: D + 80, innerVtable: D + 100,
  cookie: D + 128, innerCookie: D + 132, out: D + 136,
  done: D + 140, add: D + 144, release: D + 148, create: D + 152,
  dll: D + 156, nested: D + 160, hr: D + 164, before: D + 168, after: D + 172,
  dllClassHR: D + 176, dllCreateHR: D + 180, dllFactory: D + 184 };
const M = { add: B + 0x2200, release: B + 0x2300, create: B + 0x2400,
  innerAdd: B + 0x2500, innerRelease: B + 0x2600, park: B + 0x2700,
  dll: 0x602000 };
class Code {
  constructor() { this.b = []; }
  emit(...x) { this.b.push(...x.flat()); return this; }
  push(n) { return this.emit(0x68, d32(n)); }
  api(iat, name) { assert(iat[name]); return this.emit(0xff, 0x15, d32(B + iat[name])); }
  store(address) { return this.emit(0xa3, d32(address)); }
  inc(address) { return this.emit(0xff, 5, d32(address)); }
  result(n, pop) { return this.emit(0xb8, d32(n), 0xc2, pop, 0); }
  bytes() { assert(this.b.length < 256); return Buffer.from(this.b); }
}
function fixtures(badRet = false) {
  const methods = {};
  const data = Buffer.alloc(0x200);
  const put = (p, n) => data.writeUInt32LE(n >>> 0, p - D);
  put(A.cls, 0x13572468); put(A.innerCls, 0x24681357); put(A.dllCls, 0x76543210);
  put(A.iid, 0x11223344);
  put(A.factory, A.vtable); put(A.inner, A.innerVtable);
  [0, M.add, M.release, M.create].forEach((v, i) => put(A.vtable + i * 4, v));
  [0, M.innerAdd, M.innerRelease, M.create].forEach((v, i) => put(A.innerVtable + i * 4, v));
  const extra = [[0x3000, data]];
  const exe = buildPe({ imageBase: B, entryRva: 0x2000, codeRva: 0x2000,
    imports: [['ole32.dll', ['CoRegisterClassObject', 'CoRevokeClassObject', 'CoCreateInstance', 'CoGetClassObject']]],
    extra, code(iat) {
      const register = (c, cls, obj, cookie) =>
        c.push(cookie).push(1).push(1).push(obj).push(cls).api(iat, 'CoRegisterClassObject');
      const revoke = (c, cookie) =>
        c.emit(0xff, 0x35, d32(cookie)).api(iat, 'CoRevokeClassObject');
      const p = new Code();
      p.emit(0x89, 0xe0).store(A.before);
      register(p, A.cls, A.factory, A.cookie);
      p.push(A.out).push(A.iid).push(1).push(0x12345678).push(A.cls)
        .api(iat, 'CoCreateInstance').store(A.hr);
      revoke(p, A.cookie);
      p.push(A.out).push(A.iid).push(0).push(1).push(A.dllCls)
        .api(iat, 'CoGetClassObject').store(A.dllClassHR);
      p.emit(0xa1, d32(A.out)).store(A.dllFactory);
      p.push(A.out).push(A.iid).push(1).push(0x12345678).push(A.dllCls)
        .api(iat, 'CoCreateInstance').store(A.dllCreateHR);
      p.emit(0x89, 0xe0).store(A.after).emit(0xb8, d32(0xc001c0de)).store(A.done)
        .result(0, 16); // call_func's four argument slots
      const add = new Code().inc(A.add);
      // A real public COM import from inside the JS-run x86 AddRef callback.
      register(add, A.innerCls, A.inner, A.innerCookie);
      revoke(add, A.innerCookie);
      methods.add = add.result(2, badRet ? 8 : 4).bytes();
      methods.release = new Code().inc(A.release).result(1, 4).bytes();
      const create = new Code().inc(A.create);
      create.emit(0x8b, 0x44, 0x24, 16, 0xc7, 0, d32(0x55667788))
        .result(0x80004005, 16); // HRESULT must survive a nonzero out pointer
      methods.create = create.bytes();
      methods.innerAdd = new Code().inc(A.nested).result(2, 4).bytes();
      methods.innerRelease = new Code().result(1, 4).bytes();
      methods.park = Buffer.from([0x90, 0xeb, 0xfd]); // real suspended decoded loop
      for (const [name, bytes] of Object.entries(methods)) extra.push([M[name] - B, bytes]);
      return p.bytes();
    } }).img;
  const dllCode = new Code().inc(A.dll)
    .emit(0x8b, 0x44, 0x24, 12, 0xc7, 0, d32(A.factory)).result(0, 12).bytes();
  const dll = buildPe({ dll: 'jscom.dll', imageBase: 0x600000,
    entryRva: 0, codeRva: 0x2000, code: dllCode,
    exportName: 'DllGetClassObject', exportRva: 0x2000 }).img;
  return { exe, dll, methods: { ...methods, dll: dllCode } };
}
module.exports = { fixtures, A, M, B };
