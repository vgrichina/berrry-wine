#!/usr/bin/env node
'use strict';
// Public-API real PE fixture. Generation and static validation do not execute a VM.
// PE writer / assembler adapted from test-icm-callback-ownership-native.js;
// existing fixtures are intentionally unchanged.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { parseDump } = require('./test-icm-callback-ownership-native');
const ROOT = path.resolve(__dirname, '..');
const d32 = v => [v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24];
const BASE = 0x400000, DATA = BASE + 0x5000;
const REGISTERS = [1, 2, 3, 5, 6, 7];
const seedValue = (reg, seed) => seed + reg * 0x101;
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

const KINDS = ['edit-ordinary', 'edit-nested', 'edit-error', 'edit-timeout',
  'help-ordinary', 'help-nested', 'help-timeout'];
const SNAP = DATA + 0x100, INNER = DATA + 0x200;
const STREAM = DATA + 0x40, STREAM2 = DATA + 0x60;
const COOKIE = DATA + 0x80, COOKIE2 = DATA + 0x90;
const CALLBACK = BASE + 0x4000;
const STR = { cls: BASE + 0x1800, help: BASE + 0x1820,
  register: BASE + 0x1860, first: BASE + 0x18e0, next: BASE + 0x1920,
  unknown: BASE + 0x1960 };
const HELP_BLOB = '5418925c6c66c548daadd61531ea4c2083288e7a';
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
function helpCall(a, iat, macro, file = 0) {
  return a.push(macro).push(0x102).push(file).push(0).api(iat, 'WinHelpA');
}
function editCall(a, iat, stream = STREAM, handle = DATA) {
  return a.push(stream).push(1).push(0x449).emit(0xff, 0x35, d32(handle))
    .api(iat, 'SendMessageA');
}
function fixtures(kind) {
  assert(KINDS.includes(kind), `unknown case ${kind}`);
  const help = kind.startsWith('help-');
  const mode = kind.endsWith('nested') ? 1 : kind.endsWith('timeout') ? 2 :
    kind.endsWith('error') ? 3 : 0;
  const a = new X86();
  let imports;
  const extra = [
    [0x1800, Buffer.from('RICHEDIT\0')],
    [0x1820, Buffer.from('c:\\ew-native.hlp\0')],
    [0x1860, Buffer.from('RegisterRoutine("c:\\ew-native.dll","Probe","UU")\0')],
    [0x18e0, Buffer.from(`Probe(${mode},4660)\0`)],
    [0x1920, Buffer.from('Probe(0,71)\0')],
    [0x1960, Buffer.from('UnregisteredProbe(0)\0')],
  ];
  const exe = buildPe({
    imageBase: BASE, entryRva: 0x2000, codeRva: 0x2000,
    imports: [['user32.dll', ['CreateWindowExA', 'SendMessageA', 'WinHelpA']],
      ['kernel32.dll', ['ExitProcess']]],
    extra,
    code(iat) {
      imports = iat;
      if (help) {
        // A real HLP document is loaded by WinHelpA; RR then binds our real DLL.
        helpCall(a, iat, STR.register, STR.help).store(0, DATA);
      } else {
        for (const hwndSlot of [DATA, DATA + 4]) {
          // Top-level native RichEdit controls, no synthetic HWND/state/export.
          for (const arg of [0, BASE, 0, 0, 32, 64, 0, 0, 0x80000004, 0, STR.cls, 0])
            a.push(arg);
          a.api(iat, 'CreateWindowExA').store(0, hwndSlot);
        }
        for (const [stream, cookie] of [[STREAM, COOKIE], [STREAM2, COOKIE2]]) {
          a.set(stream, cookie).set(stream + 8, CALLBACK).set(cookie, 0);
        }
        a.set(COOKIE + 4, mode).set(COOKIE2 + 4, 0);
      }
      a.push(0x51ac0ffe).seed(0x11000000).snapshot(SNAP);
      if (help) helpCall(a, iat, STR.first);
      else editCall(a, iat);
      a.snapshot(SNAP + 32);
      if (help) {
        a.emit(0xa1, d32(DATA + 0xa0)).store(0, DATA + 0xa8);
        a.emit(0xa1, d32(DATA + 0xa4)).store(0, DATA + 0xac);
      }
      // Keep first dwError/text before reuse; WM_GETTEXT is public too.
      if (!help) {
        a.emit(0xa1, d32(STREAM + 4)).store(0, DATA + 8);
        a.push(DATA + 0x300).push(16).push(13).emit(0xff, 0x35, d32(DATA))
          .api(iat, 'SendMessageA').store(0, DATA + 12);
        a.set(COOKIE, 0).set(COOKIE + 4, 0);
      }
      a.seed(0x22000000).snapshot(SNAP + 64);
      if (help) helpCall(a, iat, STR.next);
      else editCall(a, iat);
      a.snapshot(SNAP + 96);
      a.label('siblings');
      if (help) helpCall(a, iat, STR.next);
      else { a.set(COOKIE, 0); editCall(a, iat); }
      a.emit(0x01, 0x05, d32(DATA + 20), 0xff, 0x05, d32(DATA + 16))
        .emit(0x83, 0x3d, d32(DATA + 16), 70).branch([0x0f, 0x85], 'siblings');
      if (help) helpCall(a, iat, STR.unknown).store(0, DATA + 24);
      a.emit(0x58).store(0, DATA + 28);
      a.set(DATA + 32, 0xc001c0de).push(0).api(iat, 'ExitProcess').emit(0xcc);
      return a.finish();
    },
  }).img;

  const cb = new X86();
  // Four EDITSTREAMCALLBACK stdcall args: cookie, buffer, cb, pcb.
  cb.emit(0x8b, 0x54, 0x24, 4); // edx=cookie (guest-owned data)
  cb.emit(0xff, 0x42, 8); // count every real callback entry
  cb.emit(0x83, 0x7a, 4, 2).branch([0x0f, 0x84], 'timeout');
  cb.emit(0x83, 0x7a, 4, 1).branch([0x0f, 0x85], 'copy');
  // Clear mode before recursion, and use a distinct control/stream/buffer.
  cb.emit(0xc7, 0x42, 4, d32(0)).seed(0x33000000).snapshot(INNER);
  editCall(cb, imports, STREAM2, DATA + 4).snapshot(INNER + 32);
  cb.label('copy').emit(0x8b, 0x54, 0x24, 4);
  cb.emit(0x8b, 0x44, 0x24, 12).store(0, DATA + 0x38); // requested cb
  cb.emit(0x31, 0xc0, 0x83, 0x3a, 0).branch([0x0f, 0x85], 'eof');
  cb.emit(0x8b, 0x4c, 0x24, 8, 0xc6, 1, 0x58); // buffer[0]='X'
  cb.emit(0xc7, 2, d32(1), 0xb8, d32(1)); // offset=1, count=1
  cb.label('eof').emit(0x8b, 0x4c, 0x24, 16, 0x89, 1); // *pcb=count
  cb.emit(0x31, 0xc0, 0x83, 0x7a, 4, 3).branch([0x0f, 0x85], 'return');
  cb.emit(0xb8, d32(123));
  // Intentional ABI-hostile nonvolatile clobbers test this VM's stronger
  // callback isolation contract; this is not a native-Windows ABI claim.
  cb.label('return').seed(0x44000000).emit(0xc2, 16, 0);
  cb.label('timeout').seed(0x55000000).set(DATA + 36, 0x71ae0001);
  cb.label('spin').branch(0xe9, 'spin');
  const editCode = cb.finish();
  editCode.copy(exe, 0x200 + 0x4000 - 0x1000);

  const d = new X86();
  d.emit(0xff, 0x05, d32(DATA + 0x3c));
  d.emit(0x83, 0x7c, 0x24, 4, 2).branch([0x0f, 0x84], 'timeout');
  d.emit(0x83, 0x7c, 0x24, 4, 1).branch([0x0f, 0x85], 'result');
  d.seed(0x33000000).snapshot(INNER);
  helpCall(d, imports, STR.next).snapshot(INNER + 32);
  d.label('result').emit(0x8b, 0x44, 0x24, 8).store(0, DATA + 0xa0);
  // WinHelpA reports acceptance, not the routine's EAX; record result publicly
  // in the EXE's own data, then return a deliberately different value.
  d.emit(0x05, d32(0x1000)).store(0, DATA + 0xa4);
  d.seed(0x44000000).emit(0xb8, d32(0x76543210), 0xc2, 8, 0);
  d.label('timeout').seed(0x55000000).set(DATA + 36, 0x71ae0001);
  d.label('spin').branch(0xe9, 'spin');
  const dll = buildPe({ dll: 'ew-native.dll', imageBase: 0x10000000,
    entryRva: 0x1000, codeRva: 0x2000, code: d.finish(),
    exportName: 'Probe', exportRva: 0x2000,
    extra: [[0x1000, [0xb8, ...d32(1), 0xc2, 12, 0]]] }).img;
  return { exe, dll, exeCode: a.finish(), editCode, dllCode: d.finish() };
}

function checkRestored(rd, address, seed, result) {
  assert.equal(rd(address + 32), result, 'public API result');
  for (const reg of REGISTERS) {
    assert.equal(rd(address + reg * 4), seedValue(reg, seed), `seed r${reg}`);
    assert.equal(rd(address + 32 + reg * 4), rd(address + reg * 4), `restore r${reg}`);
  }
  assert.notEqual(rd(address + 16), 0);
  assert.equal(rd(address + 48), rd(address + 16), 'exact stdcall ESP');
}
function checkSuccess(out, kind) {
  assert(KINDS.includes(kind));
  assert.match(out, /\[Exit\] code=0/);
  assert.doesNotMatch(out, /\*\*\* CRASH/);
  const rd = parseDump(out), help = kind.startsWith('help-');
  const failedEdit = kind === 'edit-error' || kind === 'edit-timeout';
  assert.notEqual(rd(DATA), 0, 'public setup succeeded');
  checkRestored(rd, SNAP, 0x11000000, failedEdit ? 0 : 1);
  checkRestored(rd, SNAP + 64, 0x22000000, 1);
  if (kind.endsWith('nested')) checkRestored(rd, INNER, 0x33000000, 1);
  assert.equal(rd(DATA + 16), 70);
  assert.equal(rd(DATA + 20), 70, '70 same-VM siblings return successfully');
  assert.equal(rd(DATA + 28), 0x51ac0ffe, 'stack canary');
  assert.equal(rd(DATA + 32), 0xc001c0de, 'caller completion');
  assert.equal(rd(DATA + 36), kind.endsWith('timeout') ? 0x71ae0001 : 0);
  if (help) {
    assert.equal(rd(DATA), 1, 'RegisterRoutine accepted');
    assert.equal(rd(DATA + 24), 0, 'unknown macro refused');
    assert.equal(rd(DATA + 0xa0), 71, 'actual DLL argument');
    assert.equal(rd(DATA + 0xa4), 0x1047, 'actual DLL computed result');
    assert.equal(rd(DATA + 0xa8), kind.endsWith('timeout') ? 0 : 0x1234,
      'outer arguments survive nested call');
    assert.equal(rd(DATA + 0xac), kind.endsWith('timeout') ? 0 : 0x2234,
      'outer DLL computation before siblings');
    assert.equal(rd(DATA + 0x3c), kind.endsWith('nested') ? 73 : 72);
  } else {
    assert.notEqual(rd(DATA + 4), 0, 'second real RichEdit');
    assert.equal(rd(DATA + 8), kind === 'edit-error' ? 123 : kind === 'edit-timeout' ? 1 : 0);
    assert.equal(rd(DATA + 12), failedEdit ? 0 : 1, 'WM_GETTEXT length');
    assert.equal(rd(DATA + 0x300), failedEdit ? 0 : 0x58, 'streamed text');
    assert.equal(rd(STREAM + 4), 0, 'fresh sibling dwError');
    assert.equal(rd(COOKIE + 8), failedEdit ? 143 : 144, 'real outer callback entries');
    assert.equal(rd(COOKIE2 + 8), kind.endsWith('nested') ? 2 : 0);
    assert(rd(DATA + 0x38) >= 1 && rd(DATA + 0x38) <= 4096, 'real buffer capacity');
  }
}

function writeFixtures(dir, kind, helpBytes) {
  fs.mkdirSync(dir, { recursive: true });
  const f = fixtures(kind), overlay = path.join(dir, 'overlay');
  fs.mkdirSync(path.join(overlay, 'blobs'), { recursive: true });
  for (const [name, bytes] of Object.entries(f))
    fs.writeFileSync(path.join(dir, name === 'exe' ? 'fixture.exe' :
      name === 'dll' ? 'ew-native.dll' : `${name}.bin`), bytes);
  const records = [['c:\\ew-native.dll', f.dll], ['c:\\ew-native.hlp', helpBytes]]
    .map(([guest, bytes], i) => {
      const blob = `f${i}.bin`;
      fs.writeFileSync(path.join(overlay, 'blobs', blob), bytes);
      return { path: guest, kind: 'file', attrs: 128, size: bytes.length,
        creationTime: null, lastAccessTime: null, lastWriteTime: null, blob };
    });
  fs.writeFileSync(path.join(overlay, 'index.json'), JSON.stringify({ version: 1, records }));
  return { exe: path.join(dir, 'fixture.exe'), overlay };
}

function parseArgs(args) {
  const opts = {};
  for (const arg of args) {
    const match = /^--(generate-only|artifacts|wasm|sha256|source|help-file|case)=(.+)$/.exec(arg);
    assert(match, `unknown or empty argument: ${arg}`);
    assert(!(match[1] in opts), `duplicate argument: ${match[1]}`);
    opts[match[1]] = match[2];
  }
  if (opts.case) assert(KINDS.includes(opts.case), 'invalid --case');
  if (opts['generate-only']) {
    for (const key of ['artifacts', 'wasm', 'sha256', 'source'])
      assert(!opts[key], `--generate-only conflicts with --${key}`);
  } else {
    for (const key of ['artifacts', 'wasm', 'sha256', 'source'])
      assert(opts[key], `runtime requires --${key}`);
    assert(/^[0-9a-f]{64}$/.test(opts.sha256), 'invalid --sha256');
    assert(/^[0-9a-f]{40}$/.test(opts.source), 'invalid --source');
  }
  return opts;
}
function runnerArgs(f, wasm) {
  return [path.join(__dirname, 'run.js'), `--exe=${f.exe}`, `--overlay-dir=${f.overlay}`,
    '--no-build', `--wasm=${path.resolve(wasm)}`, '--quiet-api', '--no-renderer',
    '--max-batches=4000', '--batch-size=1000', '--max-seconds=120',
    `--dump=0x${DATA.toString(16)}:1024`];
}
function main() {
  // The requested filename is automatically discovered in the unit tier.
  // With no arguments run only offline validation, never an implicit VM/build.
  if (process.argv.length === 2) {
    const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ew-native-check-'));
    try {
      const r = spawnSync(process.execPath,
        [path.join(__dirname, 'fixtures/edit-winhelp-native/validate.js'), dir],
        { encoding: 'utf8', timeout: 30000 });
      process.stdout.write(r.stdout || '');
      process.stderr.write(r.stderr || '');
      assert.ifError(r.error); assert.equal(r.status, 0, 'offline validation failed');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    return;
  }
  const opts = parseArgs(process.argv.slice(2));
  const helpBytes = fs.readFileSync(opts['help-file'] || path.join(ROOT, 'test/binaries/help/freecell.hlp'));
  const blobHash = crypto.createHash('sha1').update(`blob ${helpBytes.length}\0`).update(helpBytes).digest('hex');
  assert.equal(blobHash, HELP_BLOB, 'use the repository pinned freecell.hlp, not arbitrary media');
  const dir = path.resolve(opts['generate-only'] || opts.artifacts);
  const kinds = opts.case ? [opts.case] : KINDS;
  if (opts['generate-only']) {
    for (const kind of kinds) writeFixtures(path.join(dir, kind), kind, helpBytes);
    console.log(`Generated ${kinds.length} real PE fixtures; fullVM UNEXECUTED.`);
    return;
  }
  assert.equal(sha256(fs.readFileSync(opts.wasm)), opts.sha256, 'pinned module SHA256');
  fs.mkdirSync(dir, { recursive: true });
  const receipt = { source: opts.source, wasm: path.resolve(opts.wasm), sha256: opts.sha256,
    provenance: 'Operator must match source to canonical build receipt; no automatic build.',
    helpBlob: blobHash, node: process.version, status: 'RUNNING', cases: [] };
  const save = () => fs.writeFileSync(path.join(dir, 'runtime-receipt.json'), JSON.stringify(receipt, null, 2));
  save();
  try {
    for (const kind of kinds) {
      const caseDir = path.join(dir, kind), f = writeFixtures(caseDir, kind, helpBytes);
      const args = runnerArgs(f, opts.wasm);
      const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8',
        timeout: 150000, maxBuffer: 8 * 1024 * 1024 });
      const out = (r.stdout || '') + (r.stderr || '');
      fs.writeFileSync(path.join(caseDir, 'run.log'), out);
      receipt.cases.push({ kind, args, status: r.status, signal: r.signal,
        error: r.error?.message || null, exeSha256: sha256(fs.readFileSync(f.exe)), verdict: 'PENDING' });
      save();
      assert.ifError(r.error); assert.equal(r.signal, null); assert.equal(r.status, 0);
      checkSuccess(out, kind);
      receipt.cases.at(-1).verdict = 'PASS'; save();
    }
    receipt.status = 'PASS';
  } catch (error) { receipt.status = 'FAIL'; receipt.failure = error.message; throw error; }
  finally { save(); }
}
module.exports = { fixtures, checkSuccess, parseArgs, runnerArgs, KINDS };
if (require.main === module) main();
