#!/usr/bin/env node
'use strict';
// Full VM, real x86 through normal ICM imports. No compilation or patched exports.
// --generate-only=DIR is source-only; default requires an explicitly pinned module.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const d32 = v => [v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24];
// PE writer adapted from test-icm-installable-driver.js. Code lives at RVA
// 0x2000, apart from imports/exports and zero-initialized observation data.
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

const BASE = 0x400000, DATA = BASE + 0x1800;
const VIDC = 0x63646976, FOURCC = 0x574f4358; // 'XCOW'
const ID = 0xd1d0, MSG = 0x7001, NEST = 0x7002, SLICE = 0x7003;
const TIMEOUT = 0x7004, CAPACITY = 0x7005;
const SNAP = DATA + 0x40, INNER = DATA + 0x100;
const ENTER_TEXT = DATA + 0x300, RETURN_TEXT = DATA + 0x340;
const REGISTERS = [1, 2, 3, 5, 6, 7]; // ECX EDX EBX EBP ESI EDI
const seedValue = (reg, seed) => seed + reg * 0x101;

class X86 {
  constructor() { this.bytes = []; this.labels = new Map(); this.fixups = []; }
  emit(...bytes) { this.bytes.push(...bytes.flat()); return this; }
  label(name) {
    assert(!this.labels.has(name), `duplicate label ${name}`);
    this.labels.set(name, this.bytes.length); return this;
  }
  branch(op, name) {
    this.emit(op); this.fixups.push([this.bytes.length, name]);
    return this.emit(0, 0, 0, 0);
  }
  push(value) { return this.emit(0x68, d32(value)); }
  api(iat, name) {
    assert(Number.isInteger(iat[name]), `missing import ${name}`);
    return this.emit(0xff, 0x15, d32(BASE + iat[name]));
  }
  store(reg, address) { return this.emit(0x89, 0x05 | reg << 3, d32(address)); }
  set(address, value) { return this.emit(0xc7, 5, d32(address), d32(value)); }
  seed(seed) {
    for (const reg of REGISTERS) this.emit(0xb8 + reg, d32(seedValue(reg, seed)));
    return this;
  }
  snapshot(address) {
    for (let reg = 0; reg < 8; reg++) this.store(reg, address + reg * 4);
    return this;
  }
  send(iat, msg, p1, p2) {
    return this.push(p2).push(p1).push(msg).emit(0xff, 0x35, d32(DATA))
      .api(iat, 'ICSendMessage');
  }
  finish() {
    const b = Buffer.from(this.bytes);
    for (const [at, name] of this.fixups) {
      assert(this.labels.has(name), `missing label ${name}`);
      b.writeInt32LE(this.labels.get(name) - at - 4, at);
    }
    assert(b.length < 0x3000, 'code exceeds reserved PE range');
    return b;
  }
}

function fixtures(kind) {
  assert(['ordinary', 'nested', 'sliced', 'timeout', 'capacity'].includes(kind));
  const a = new X86();
  let imports;
  const exe = buildPe({
    imageBase: BASE, entryRva: 0x2000, codeRva: 0x2000,
    imports: [['msvfw32.dll', ['ICOpen', 'ICSendMessage', 'ICClose']],
      ['kernel32.dll', ['ExitProcess', 'OutputDebugStringA']]],
    extra: [[0x1b00, Buffer.from('ICM_CAPACITY_ENTER\n\0')],
      [0x1b40, Buffer.from('ICM_CAPACITY_RETURNED\n\0')]],
    code(iat) {
      imports = iat;
      a.push(2).push(FOURCC).push(VIDC).api(iat, 'ICOpen').store(0, DATA);
      // A stack canary remains above every pushed API frame.
      a.push(0x51ac0ffe).seed(0x11000000).snapshot(SNAP);
      const msg = { ordinary: MSG, nested: NEST, sliced: SLICE,
        timeout: TIMEOUT, capacity: CAPACITY }[kind];
      a.send(iat, msg, 0x1234, 0x5678).snapshot(SNAP + 32);
      if (kind === 'capacity') a.push(RETURN_TEXT).api(iat, 'OutputDebugStringA');
      // Independent call with different arguments and register state, on the
      // SAME live HIC/VM after nested completion or bounded timeout.
      a.seed(0x22000000).snapshot(SNAP + 64)
        .send(iat, MSG, 0x31, 0x47).snapshot(SNAP + 96);
      // More siblings than the ownership stack can hold: a leaked child on
      // successful return must not hide behind one additional passing call.
      a.label('siblings').send(iat, MSG, 0x31, 0x47)
        .emit(0x01, 0x05, d32(DATA + 28), 0xff, 0x05, d32(DATA + 24))
        .emit(0x83, 0x3d, d32(DATA + 24), 70).branch([0x0f, 0x85], 'siblings');
      a.emit(0x58).store(0, DATA + 4); // pop canary
      a.emit(0xff, 0x35, d32(DATA)).api(iat, 'ICClose').store(0, DATA + 8);
      a.set(DATA + 12, 0xc001c0de).push(0).api(iat, 'ExitProcess').emit(0xcc);
      return a.finish();
    },
  }).img;

  // DLL code calls the EXE's already-resolved IAT. No preferred DLL address
  // assumptions, relocations, production exports, or synthetic dispatch.
  const d = new X86();
  d.emit(0x8b, 0x44, 0x24, 12); // uMsg at original DriverProc ESP+12
  for (const [msg, label] of [[3, 'open'], [MSG, 'sum'], [NEST, 'nested'],
    [SLICE, 'sliced'], [TIMEOUT, 'timeout'], [CAPACITY, 'capacity']]) {
    d.emit(0x3d, d32(msg)).branch([0x0f, 0x84], label);
  }
  d.emit(0xb8, d32(1), 0xc2, 20, 0); // lifecycle messages
  d.label('open').emit(0x8b, 0x44, 0x24, 20); // lParam2 = ICOPEN*
  d.emit(0x81, 0x78, 4, d32(VIDC)).branch([0x0f, 0x85], 'bad');
  d.emit(0x81, 0x78, 8, d32(FOURCC)).branch([0x0f, 0x85], 'bad');
  d.emit(0xb8, d32(ID), 0xc2, 20, 0);
  d.label('bad').emit(0x31, 0xc0, 0xc2, 20, 0);
  d.label('nested').seed(0x33000000).snapshot(INNER)
    .send(imports, MSG, 0x111, 0x222).snapshot(INNER + 32);
  // Preserve the nested result in memory, then use original outer args after
  // nested stdcall cleanup. Wrong ESP/EIP restoration breaks the outer sum.
  d.branch(0xe9, 'sum');
  d.label('sliced').emit(0xb9, d32(1000100));
  d.label('loop').emit(0x49).branch([0x0f, 0x85], 'loop');
  // >1,000,000 taken loop blocks: must cross icm_drv_call's inner run budget.
  d.set(DATA + 16, 0x51ce0001).branch(0xe9, 'sum');
  d.label('timeout').set(DATA + 20, 0x71ae0001);
  d.label('spin').branch(0xe9, 'spin'); // 64 real inner slices, then unsupported
  d.label('capacity').push(ENTER_TEXT).api(imports, 'OutputDebugStringA')
    .send(imports, CAPACITY, 0, 0)
    .push(RETURN_TEXT).api(imports, 'OutputDebugStringA')
    .branch(0xe9, 'sum');
  d.label('sum');
  // Record actual DriverProc ABI args for the LAST independent call.
  for (let i = 0; i < 5; i++) {
    d.emit(0x8b, 0x44, 0x24, 4 + i * 4).store(0, DATA + 0x180 + i * 4);
  }
  d.emit(0x8b, 0x44, 0x24, 16, 0x03, 0x44, 0x24, 20, 0x03, 0x44, 0x24, 4);
  // Deliberately clobber even nonvolatile registers to stress the VM's
  // documented full callback-context save/restore, not Windows ABI leniency.
  d.seed(0x44000000).emit(0xc2, 20, 0);
  const driver = buildPe({
    dll: 'xcow.dll', imageBase: 0x10000000, entryRva: 0x1000,
    codeRva: 0x2000, code: d.finish(), exportName: 'DriverProc', exportRva: 0x2000,
    extra: [[0x1000, [0xb8, ...d32(1), 0xc2, 12, 0]]],
  }).img;
  return { exe, driver, exeCode: a.finish(), driverCode: d.finish() };
}

function writeFixtures(dir, kind) {
  fs.mkdirSync(dir, { recursive: true });
  const f = fixtures(kind), overlay = path.join(dir, 'overlay');
  fs.mkdirSync(path.join(overlay, 'blobs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'fixture.exe'), f.exe);
  fs.writeFileSync(path.join(dir, 'exe-code.bin'), f.exeCode);
  fs.writeFileSync(path.join(dir, 'driver-code.bin'), f.driverCode);
  const files = [
    ['c:\\windows\\system\\xcow.dll', f.driver],
    ['c:\\windows\\system.ini', Buffer.from('[drivers32]\r\nVIDC.XCOW=xcow.dll\r\n')],
  ];
  const records = files.map(([guest, bytes], i) => {
    const blob = `f${i}.bin`;
    fs.writeFileSync(path.join(overlay, 'blobs', blob), bytes);
    return { path: guest, kind: 'file', attrs: 128, size: bytes.length,
      creationTime: null, lastAccessTime: null, lastWriteTime: null, blob };
  });
  fs.writeFileSync(path.join(overlay, 'index.json'), JSON.stringify({ version: 1, records }));
  return { exe: path.join(dir, 'fixture.exe'), overlay };
}

function parseDump(out) {
  const mem = new Map();
  for (const line of out.split('\n')) {
    const m = /^\s+0x([0-9a-f]+)\s+((?:[0-9a-f]{2} )+)/i.exec(line);
    if (m) m[2].trim().split(/\s+/).forEach((v, i) => mem.set(parseInt(m[1], 16) + i, parseInt(v, 16)));
  }
  return address => {
    for (let i = 0; i < 4; i++) assert(mem.has(address + i), `missing dump byte at ${address + i}`);
    return (mem.get(address) | mem.get(address + 1) << 8 |
      mem.get(address + 2) << 16 | mem.get(address + 3) << 24) >>> 0;
  };
}

function checkRestored(rd, address, seed, result) {
  assert.equal(rd(address + 32), result >>> 0, 'callback result / original arguments');
  for (const reg of REGISTERS) {
    assert.equal(rd(address + reg * 4), seedValue(reg, seed), 'seed reached guest');
    assert.equal(rd(address + 32 + reg * 4), rd(address + reg * 4), `restored register ${reg}`);
  }
  assert.notEqual(rd(address + 16), 0, 'nonzero caller ESP');
  assert.equal(rd(address + 48), rd(address + 16), 'stdcall ESP restored exactly');
}

function checkSuccess(out, kind) {
  assert.match(out, /\[Exit\] code=0/);
  assert.doesNotMatch(out, /\*\*\* CRASH/);
  const rd = parseDump(out);
  assert.notEqual(rd(DATA), 0, 'ICOpen returned a live HIC');
  checkRestored(rd, SNAP, 0x11000000, kind === 'timeout' ? -1 : ID + 0x1234 + 0x5678);
  checkRestored(rd, SNAP + 64, 0x22000000, ID + 0x31 + 0x47);
  assert.equal(rd(DATA + 4), 0x51ac0ffe, 'caller stack canary');
  assert.equal(rd(DATA + 8), 0, 'ICClose');
  assert.equal(rd(DATA + 12), 0xc001c0de, 'resumed caller reached completion');
  if (kind === 'nested') checkRestored(rd, INNER, 0x33000000, ID + 0x111 + 0x222);
  assert.equal(rd(DATA + 16), kind === 'sliced' ? 0x51ce0001 : 0);
  assert.equal(rd(DATA + 20), kind === 'timeout' ? 0x71ae0001 : 0);
  assert.equal(rd(DATA + 24), 70, 'independent sibling calls exceed ownership capacity');
  assert.equal(rd(DATA + 28), 70 * (ID + 0x31 + 0x47), 'all sibling return values');
  assert.equal(rd(DATA + 0x180), ID, 'dwDriverId');
  assert.notEqual(rd(DATA + 0x184), 0, 'hDriver');
  assert.equal(rd(DATA + 0x188), MSG, 'uMsg');
  assert.equal(rd(DATA + 0x18c), 0x31, 'lParam1');
  assert.equal(rd(DATA + 0x190), 0x47, 'lParam2');
}

function main() {
  const generate = process.argv.find(v => v.startsWith('--generate-only='));
  const dir = path.resolve(generate ? generate.slice('--generate-only='.length) :
    process.env.WA_ICM_ARTIFACTS || path.join(ROOT, 'scratch/icm-native'));
  const kinds = ['ordinary', 'nested', 'sliced', 'timeout', 'capacity'];
  if (generate) {
    for (const kind of kinds) writeFixtures(path.join(dir, kind), kind);
    console.log('Generated five x86 PE fixtures; native suite UNEXECUTED.');
    return;
  }
  // Never auto-build or silently use a possibly stale workspace module.
  const wasm = process.env.WINE_ASSEMBLY_WASM;
  const sha = process.env.WA_ICM_WASM_SHA256;
  const source = process.env.WA_ICM_SOURCE_REV;
  assert(wasm && sha && /^[0-9a-f]{40}$/.test(source || ''),
    'Set WINE_ASSEMBLY_WASM, WA_ICM_WASM_SHA256 and WA_ICM_SOURCE_REV from an approved exact-source normalbuild receipt');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(wasm)).digest('hex'), sha);
  fs.mkdirSync(dir, { recursive: true });
  const receipt = { source, wasm: path.resolve(wasm), sha256: sha, node: process.version,
    provenance: 'Source revision supplied by operator; verify against normalbuild receipt.',
    status: 'RUNNING', cases: [] };
  const save = () => fs.writeFileSync(path.join(dir, 'runtime-receipt.json'), JSON.stringify(receipt, null, 2));
  save();
  try {
    // Fresh run.js processes per scenario; the successful calls within each
    // EXE share one live VM. Run ordinary again AFTER the terminal fault.
    for (const kind of [...kinds, 'ordinary']) {
      const caseDir = path.join(dir, `${receipt.cases.length}-${kind}`);
      const f = writeFixtures(caseDir, kind);
      const args = [path.join(__dirname, 'run.js'), `--exe=${f.exe}`, `--overlay-dir=${f.overlay}`,
        '--no-build', `--wasm=${path.resolve(wasm)}`, '--quiet-api', '--no-renderer',
        '--max-batches=4000', '--batch-size=1000', '--max-seconds=120',
        `--dump=0x${DATA.toString(16)}:1024`];
      const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8',
        timeout: 150000, maxBuffer: 8 * 1024 * 1024 });
      const out = (r.stdout || '') + (r.stderr || '');
      fs.writeFileSync(path.join(caseDir, 'run.log'), out);
      receipt.cases.push({ kind, args, status: r.status, signal: r.signal,
        error: r.error?.message || null, verdict: 'PENDING' }); save();
      assert.ifError(r.error); assert.equal(r.signal, null);
      if (kind === 'capacity') {
        assert.equal(r.status, 1);
        assert.match(out, /\*\*\* CRASH at batch \d+: unreachable/);
        assert.equal((out.match(/ICM_CAPACITY_ENTER/g) || []).length, 63,
          '63 real DriverProc entries before acquisition of child 64 traps');
        assert.doesNotMatch(out, /ICM_CAPACITY_RETURNED|\[Exit\] code=0/);
      } else {
        assert.equal(r.status, 0); checkSuccess(out, kind);
      }
      receipt.cases.at(-1).verdict = 'PASS'; save();
      console.log(`PASS ICM real-x86 ${kind}`);
    }
    receipt.status = 'PASS';
  } catch (error) {
    receipt.status = 'FAIL'; receipt.failure = error.message; throw error;
  } finally { save(); }
}

module.exports = { fixtures, parseDump, checkSuccess };
if (require.main === module) main();
