#!/usr/bin/env node
'use strict';
// PE writer/emitter adapted from test-icm-callback-ownership-native.js.
// No compile path. --offline validates bytes/wiring, never executes the VM.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const d32 = v => [v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24];
function buildPe({ dll, imageBase, entryRva, code, codeRva = 0x1000, imports = [], exportName = null,
                   exportRva = 0, extra = [] }) {
  const SECT = 0x1000, RAW = 0x200, VSIZE = 0x18000;
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
const REGISTERS = [1, 2, 3, 5, 6, 7];
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

const KINDS = ['ordinary', 'nested', 'sliced', 'timeout', 'nested-timeout', 'capacity', 'error'];
const OUT = DATA + 0x40, IN = DATA + 0x60, SNAP = DATA + 0x100;
const CALLBACK = BASE + 0x2400, LEAF = BASE + 0x2800;
const CANARY = 0x51ac0ffe, STACK = BASE + 0x16000;
function fixtures(kind) {
  assert(KINDS.includes(kind));
  let iat;
  const boot = new X86();
  const exe = buildPe({ imageBase: BASE, entryRva: 0x2000, codeRva: 0x2000,
    imports: [['user32.dll', ['CreateWindowExA', 'SendMessageA']]],
    extra: [[0x1c00, Buffer.from('STATIC\0')], [0x1c20, Buffer.from('RichEdit20A\0')]],
    code(imports) {
      iat = imports;
      function create(name, parent, id) {
        boot.push(0).push(BASE).push(id);
        if (parent) boot.emit(0xff, 0x35, d32(DATA)); else boot.push(0);
        boot.push(100).push(200).push(0).push(0).push(parent ? 0x50000004 : 0x80000000)
          .push(0).push(name).push(0).api(iat, 'CreateWindowExA');
      }
      create(BASE + 0x1c00, false, 0); boot.store(0, DATA);
      create(BASE + 0x1c20, true, 101); boot.store(0, DATA + 4);
      create(BASE + 0x1c20, true, 102); boot.store(0, DATA + 8);
      boot.set(DATA + 12, 0xb007c0de).emit(0xc3);
      return boot.finish();
    },
  }).img;
  function send(a, hwnd, stream) {
    a.push(stream).push(1).push(0x449).emit(0xff, 0x35, d32(hwnd)).api(iat, 'SendMessageA');
  }
  function count(a, address) { a.emit(0xff, 5, d32(address)); }
  function body(a, counter, text, length) {
    // Each independent stream supplies one chunk and then EOF.
    a.emit(0x83, 0x3d, d32(counter), 1).branch([0x0f, 0x85], 'eof');
    a.emit(0x8b, 0x44, 0x24, 8, 0xc7, 0, d32(text)); // buffer
    a.emit(0x8b, 0x44, 0x24, 16, 0xc7, 0, d32(length)).branch(0xe9, 'return');
    a.label('eof').emit(0x8b, 0x44, 0x24, 16, 0xc7, 0, d32(0));
    a.label('return').seed(0x44000000).emit(0xb8, d32(kind === 'error' ? 37 : 0), 0xc2, 16, 0);
  }
  const a = new X86(); count(a, DATA + 16);
  // Record the actual callback ABI on every entry, including EOF.
  for (let i = 0; i < 5; i++) a.emit(0x8b, 0x44, 0x24, i * 4).store(0, DATA + 0x80 + i * 4);
  if (kind === 'capacity') {
    // SendMessage's 20-byte caller frame is above the prospective 20-byte
    // EDITSTREAM frame. These probes are below both, not API arguments.
    a.emit(0x89, 0xe0, 0x83, 0xe8, 40).store(0, DATA + 32);
    a.emit(0x89, 0xe0, 0x83, 0xe8, 20).store(0, DATA + 36);
    for (let i = 0; i < 5; i++) a.emit(0xc7, 0x44, 0x24, 0xd8 + i * 4, d32(CANARY + i));
    send(a, DATA + 4, OUT); count(a, DATA + 28);
    a.emit(0xcc); // An admitted recursive frame must never return.
  } else {
    if (kind === 'nested' || kind === 'nested-timeout') {
      a.emit(0x83, 0x3d, d32(DATA + 16), 1).branch([0x0f, 0x85], 'after-nested');
      a.push(CANARY).seed(0x33000000).snapshot(SNAP);
      send(a, DATA + 8, IN); a.snapshot(SNAP + 32);
      a.emit(0x58).store(0, DATA + 24).label('after-nested');
    }
    if (kind === 'sliced') {
      a.emit(0xb9, d32(1000100)).label('slice').emit(0x49).branch([0x0f, 0x85], 'slice');
      a.set(DATA + 40, 0x51ce0001);
    }
    if (kind === 'timeout') a.seed(0x55000000).label('spin').branch(0xe9, 'spin');
    else body(a, DATA + 16, 0x004e574f, 3); // "OWN"
  }
  const leaf = new X86(); count(leaf, DATA + 20);
  if (kind === 'nested-timeout') leaf.seed(0x55000000).label('spin').branch(0xe9, 'spin');
  else body(leaf, DATA + 20, 0x00006e69, 2); // "in"
  const code = a.finish(), leafCode = leaf.finish();
  code.copy(exe, 0x200 + 0x2400 - 0x1000);
  leafCode.copy(exe, 0x200 + 0x2800 - 0x1000);
  assert(code.length < 0x400 && leafCode.length < 0x400);
  return { exe, code, leafCode, boot: boot.finish(), iat };
}

const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
function writeFixtures(dir, kind) {
  fs.mkdirSync(dir, { recursive: true });
  const f = fixtures(kind);
  for (const [name, bytes] of [['fixture.exe', f.exe], ['callback.bin', f.code],
    ['leaf.bin', f.leafCode], ['boot.bin', f.boot]]) fs.writeFileSync(path.join(dir, name), bytes);
  return f;
}

// Structural source checks are deliberately supplementary. No AST evaluator,
// modeled run(), token implementation, or private export is substituted.
function checkWiring(edit, window, controls, classes) {
  const start = edit.indexOf('(func $edit_stream_call');
  const end = edit.indexOf('(func $edit_hex_nibble', start);
  assert(start >= 0 && end > start);
  const call = edit.slice(start, end);
  const enter = call.indexOf('(call $sync_depth_enter)');
  const write = call.indexOf('(i32.store offset=16');
  assert(enter >= 0 && enter < write, 'acquisition precedes guest ESP/frame writes');
  const leave = call.indexOf('(call $sync_depth_leave)');
  for (const field of ['child', 'root', 'depth']) {
    const guard = call.indexOf(`(if (${field === 'depth' ? 'i32' : 'i64'}.ne (local.get $expected_${field})`);
    assert(guard > call.indexOf('(call $run ') && guard < leave, `retained ${field} guard before retirement`);
  }
  for (const field of ['eip', 'esp', 'eax', 'ecx', 'edx', 'ebx', 'esi', 'edi', 'ebp',
    'handler_set_eip', 'steps', 'yield_reason', 'yield_flag']) {
    assert(call.slice(leave).includes(`(local.get $old_${field})`), `restore ${field}`);
  }
  assert.match(call, /\(call \$run \(i32.const 1000000\)\)/);
  assert.match(call, /\(i32.ge_u \(local.get \$rounds\) \(i32.const 64\)\)/);
  assert.match(edit, /\(local.set \$error \(call \$edit_stream_call/);
  assert.match(edit, /\(local.set \$text_len \(call \$edit_stream_read/);
  assert.match(window, /\(func \$handle_SendMessageA/);
  assert.match(window, /\(call \$control_wndproc_dispatch/);
  assert.match(controls, /\(i32.const 25\)/);
  assert.match(controls, /\(call \$edit_wndproc/);
  assert.match(classes, /\(call \$richedit_class_version \(local.get \$guest\)\)/);
  assert.match(classes, /\(then \(return \(i32.const 25\)\)\)/);
}

function disassemble(file, bytes, origin) {
  fs.writeFileSync(file, bytes);
  const r = spawnSync('objdump', ['-D', '--insn-width=16', '-b', 'binary', '-m', 'i386', '-M', 'intel',
    `--adjust-vma=${origin}`, file], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout.split('\n').filter(l => /^\s*[0-9a-f]+:\s/.test(l));
  assert(lines.length > 0);
  assert.doesNotMatch(r.stdout, /\(bad\)|\.byte/);
  const addresses = new Set(lines.map(l => parseInt(l.trim().split(':')[0], 16)));
  for (const l of lines) {
    const m = /\b(?:j[a-z]+|call)\s+(?:0x)?([0-9a-f]+)\s*$/.exec(l);
    if (m) assert(addresses.has(parseInt(m[1], 16)), 'branch lands on a decoded instruction');
  }
  return r.stdout;
}

function checkPe(f, kind) {
  const b = f.exe, pe = b.readUInt32LE(0x3c), opt = pe + 24;
  assert.equal(b.readUInt16LE(0), 0x5a4d);
  assert.equal(b.readUInt32LE(pe), 0x4550);
  assert.equal(b.readUInt16LE(pe + 4), 0x14c);
  assert.equal(b.readUInt16LE(opt), 0x10b);
  assert.equal(b.readUInt32LE(opt + 16), 0x2000);
  assert.equal(b.readUInt32LE(opt + 28), BASE);
  assert.equal(b.readUInt32LE(opt + 56), 0x19000);
  assert.deepEqual(b.subarray(0x1600, 0x1600 + f.code.length), f.code);
  assert.deepEqual(b.subarray(0x1a00, 0x1a00 + f.leafCode.length), f.leafCode);
  assert.equal(b.readUInt32LE(opt + 104), 0x1400);
  const at = rva => rva - 0x1000 + 0x200;
  for (const name of ['CreateWindowExA', 'SendMessageA']) {
    const nameRva = b.readUInt32LE(at(f.iat[name]));
    assert.equal(b.subarray(at(nameRva) + 2, at(nameRva) + 2 + name.length).toString(), name);
  }
  assert.equal(f.boot.toString('hex').split(Buffer.from([0xff, 0x15, ...d32(BASE + f.iat.CreateWindowExA)]).toString('hex')).length - 1, 3,
    'three public CreateWindowExA entries');
  if (!['capacity', 'timeout'].includes(kind)) assert(f.code.includes(Buffer.from([0xc2, 16, 0])), 'stdcall callback ret 16');
  if (!['capacity', 'timeout'].includes(kind)) {
    assert(f.code.includes(Buffer.from([0x8b, 0x44, 0x24, 16, 0xc7, 0, ...d32(3)])), 'write count through pcb ABI argument');
    assert(f.code.includes(Buffer.from([0x8b, 0x44, 0x24, 8, 0xc7, 0, ...d32(0x004e574f)])), 'write chunk through buffer ABI argument');
  }
  if (kind === 'capacity') {
    for (let i = 0; i < 5; i++) assert(f.code.includes(Buffer.from([0xc7, 0x44, 0x24, 0xd8 + i * 4, ...d32(CANARY + i)])));
  }
  if (kind.startsWith('nested') || kind === 'capacity') assert(f.code.includes(Buffer.from([0xff, 0x15, ...d32(BASE + f.iat.SendMessageA)])));
  if (kind === 'sliced') assert(f.code.includes(Buffer.from([
    0xb9, ...d32(1000100), 0x49, 0x0f, 0x85, ...d32(-7),
  ])), 'slice fixture must execute more than one million loop iterations');
  if (kind === 'timeout' || kind === 'nested-timeout') {
    const spin = kind === 'timeout' ? f.code : f.leafCode;
    assert.deepEqual(spin.subarray(-5), Buffer.from([0xe9, ...d32(-5)]),
      'timeout fixture must end in an unconditional self-loop');
  }
}

function checkObservations(o, kind) {
  assert.equal(o.callbackCount, kind === 'capacity' ? 63 : ['timeout', 'error'].includes(kind) ? 1 : 2);
  if (kind === 'capacity') {
    assert.equal(o.trap, 'unreachable');
    assert.equal(o.returned, 0, 'no recursive SendMessage returned');
    assert.equal(o.esp, o.expectedEsp, 'failed acquisition did not change guest ESP');
    assert.deepEqual(o.frame, Array.from({ length: 5 }, (_, i) => CANARY + i), 'failed acquisition did not write callback frame');
    return;
  }
  assert.equal(o.trap, null);
  assert.equal(o.result, ['timeout', 'error'].includes(kind) ? 0 : 3);
  assert.equal(o.error, kind === 'timeout' ? 1 : kind === 'error' ? 37 : 0);
  assert.equal(o.text, ['timeout', 'error'].includes(kind) ? '' : 'OWN');
  assert.deepEqual(o.after, o.before, 'all supported interrupted registers/control state restored');
  assert.equal(o.canary, CANARY, 'outer guest stack canary');
  assert.equal(o.abi.cookie, 0xc00c1234);
  assert.equal(o.abi.capacity, ['timeout', 'error'].includes(kind) ? 4096 : 4093,
    'last callback receives remaining capacity after the first three bytes');
  for (const name of ['ret', 'buffer', 'pcb']) assert(o.abi[name] > 0, `real callback ${name}`);
  if (kind === 'nested' || kind === 'nested-timeout') {
    assert.equal(o.innerCount, kind === 'nested' ? 2 : 1);
    assert.equal(o.innerError, kind === 'nested' ? 0 : 1);
    assert.equal(o.innerText, kind === 'nested' ? 'in' : '');
    assert.equal(o.nestedCanary, CANARY);
    assert.equal(o.nestedAfter[0], kind === 'nested' ? 2 : 0, 'nested LRESULT');
    for (const reg of REGISTERS) {
      assert.equal(o.nestedBefore[reg], seedValue(reg, 0x33000000));
      assert.equal(o.nestedAfter[reg], o.nestedBefore[reg], `nested restored register ${reg}`);
    }
    assert(o.nestedBefore[4] > 0);
    assert.equal(o.nestedAfter[4], o.nestedBefore[4], 'nested stdcall ESP');
  }
  assert.equal(o.sliced, kind === 'sliced' ? 0x51ce0001 : 0);
  assert.equal(o.siblings, 70, 'more successful siblings than owner capacity');
  assert.equal(o.siblingResults, 210, 'all 70 sibling LRESULTs');
  assert.equal(o.siblingCallbacks, 140, 'data and EOF on every sibling');
}

function checkSibling(o, before) {
  assert.equal(o.result, 3, 'each sibling LRESULT');
  assert.equal(o.callbacks, 2, 'each sibling supplies data and EOF');
  assert.equal(o.error, 0, 'each sibling dwError');
  assert.equal(o.text, 'OWN', 'each sibling visible text');
  assert.equal(o.canary, CANARY, 'each sibling stack canary');
  assert.deepEqual(o.after, before, 'each sibling restores caller');
}

// Real PE load + real interpreted x86. This intentionally keeps the module
// instance in scope after a trap; test/run.js exits before its --dump then.
// The normal host imports/PE loader and public message API remain unmodified.
async function nativeCase(kind, dir, wasm) {
  const { createHostImports } = require('../lib/host-imports');
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer, renderer: null,
    resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} }, onExit: () => {} };
  const imports = createHostImports(ctx); imports.host.memory = memory;
  const { instance } = await WebAssembly.instantiate(fs.readFileSync(wasm), imports);
  const e = instance.exports; ctx.exports = e;
  const f = writeFixtures(dir, kind), mem = new Uint8Array(memory.buffer);
  checkPe(f, kind);
  assert(e.get_staging_size() >= f.exe.length);
  mem.set(f.exe, e.get_staging());
  assert.equal(e.load_pe(f.exe.length) >>> 0, BASE + 0x2000);
  // load_pe sets the entry EIP and normal guest stack. No export patching,
  // hand-built thunk metadata, fabricated token state or guard bypass.
  for (let n = 0; n < 100 && e.get_eip(); n++) e.run(10000);
  assert.equal(e.get_eip(), 0, 'bootstrap returned normally');
  const wa = g => g - e.get_image_base() + e.get_guest_base();
  const dv = new DataView(memory.buffer);
  const rd = g => dv.getUint32(wa(g), true);
  const wr = (g, v) => dv.setUint32(wa(g), v >>> 0, true);
  assert.equal(rd(DATA + 12), 0xb007c0de, 'ordinary CreateWindowExA bootstrap completed');
  for (const g of [DATA, DATA + 4, DATA + 8]) assert(rd(g) !== 0, 'real window created');
  // Fail closed if CreateWindowExA routed to anything other than the WAT
  // fallback edit state. Never substitute a test-only window on failure.
  assert.equal(e.get_edit_text_len(rd(DATA + 4)), 0);
  function streamInit(g, callback) { wr(g, 0xc00c1234); wr(g + 4, 0xdeadbeef); wr(g + 8, callback); }
  streamInit(OUT, CALLBACK); streamInit(IN, LEAF);
  const names = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi'];
  names.forEach((name, i) => e[`set_${name}`](i === 4 ? STACK : seedValue(i, 0x11000000)));
  wr(STACK, CANARY);
  e.set_eip(0); e.set_steps(123); e.set_handler_set_eip(0); e.set_yield_state(5, 1);
  const state = () => Object.fromEntries([...names, 'eip', 'steps', 'handler_set_eip',
    'yield_reason', 'yield_flag'].map(name => [name, e[`get_${name}`]() >>> 0]));
  const o = { before: state(), trap: null, result: null };
  try { o.result = e.send_message(rd(DATA + 4), 0x449, 1, OUT); }
  catch (error) {
    if (!(error instanceof WebAssembly.RuntimeError) || !/unreachable/.test(error.message)) throw error;
    o.trap = 'unreachable';
  }
  o.callbackCount = rd(DATA + 16);
  if (kind === 'capacity') {
    const frame = rd(DATA + 32);
    assert(frame >= STACK - 8192 && frame < STACK, 'capacity probe stays in fixture stack');
    Object.assign(o, { returned: rd(DATA + 28), esp: e.get_esp() >>> 0,
      expectedEsp: rd(DATA + 36), frame: Array.from({ length: 5 }, (_, i) => rd(frame + i * 4)) });
  } else {
    const text = hwnd => {
      const len = e.get_edit_text_len(hwnd), out = e.guest_alloc(len + 1);
      e.get_edit_text(hwnd, out, len + 1);
      return Buffer.from(mem.subarray(wa(out), wa(out) + len)).toString('latin1');
    };
    Object.assign(o, { after: state(), canary: rd(STACK), error: rd(OUT + 4), text: text(rd(DATA + 4)),
      innerCount: rd(DATA + 20), innerError: rd(IN + 4), innerText: text(rd(DATA + 8)),
      nestedCanary: rd(DATA + 24), sliced: rd(DATA + 40),
      nestedBefore: Array.from({ length: 8 }, (_, i) => rd(SNAP + i * 4)),
      nestedAfter: Array.from({ length: 8 }, (_, i) => rd(SNAP + 32 + i * 4)),
      abi: Object.fromEntries(['ret', 'cookie', 'buffer', 'capacity', 'pcb'].map((name, i) => [name, rd(DATA + 0x80 + i * 4)])) });
    // Reset the guest-owned counters and EDITSTREAM between siblings. Each
    // uses the ordinary callback on this SAME live instance after timeout.
    // Load fresh callback bytes at a fresh address to avoid stale code cache.
    const good = fixtures('ordinary').code, cb = e.guest_alloc(good.length);
    mem.set(good, wa(cb));
    o.siblings = 0; o.siblingResults = 0; o.siblingCallbacks = 0;
    for (let n = 0; n < 70; n++) {
      wr(DATA + 16, 0); streamInit(OUT, cb);
      const result = e.send_message(rd(DATA + 4), 0x449, 1, OUT);
      const sibling = { result, callbacks: rd(DATA + 16), error: rd(OUT + 4),
        canary: rd(STACK), after: state(), text: text(rd(DATA + 4)) };
      checkSibling(sibling, o.before);
      o.siblingResults += result;
      o.siblingCallbacks += sibling.callbacks; o.siblings++;
    }
  }
  fs.writeFileSync(path.join(dir, 'observations.json'), JSON.stringify(o, null, 2) + '\n');
  checkObservations(o, kind);
}

function offline(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const source = name => fs.readFileSync(path.join(ROOT, 'src', name), 'utf8');
  const edit = source('09c3-wndprocs5-edit.wat'), window = source('09a5-handlers-window.wat');
  const controls = source('09c3-controls.wat'), classes = source('09c0-window-table.wat');
  const wiring = s => checkWiring(s, window, controls, classes);
  wiring(edit);
  let negatives = 0;
  function reject(fn) { assert.throws(fn, assert.AssertionError); negatives++; }
  reject(() => wiring(edit.replace('(call $sync_depth_enter)', ';; deleted acquisition')));
  for (const field of ['child', 'root', 'depth']) reject(() => wiring(edit.replace(
    `(if (${field === 'depth' ? 'i32' : 'i64'}.ne (local.get $expected_${field})`, '(if (i32.const 0)')));
  reject(() => wiring(edit.replace('(local.set $error (call $edit_stream_call', '(local.set $error (call $wrong_callback')));
  reject(() => checkWiring(edit, window, controls.replaceAll('$edit_wndproc', '$wrong_proc'), classes));
  for (const kind of KINDS) {
    const caseDir = path.join(dir, kind), f = writeFixtures(caseDir, kind);
    checkPe(f, kind);
    for (const [name, code, origin] of [['callback', f.code, CALLBACK], ['leaf', f.leafCode, LEAF], ['boot', f.boot, BASE + 0x2000]]) {
      const asm = disassemble(path.join(caseDir, name + '.bin'), code, origin);
      fs.writeFileSync(path.join(caseDir, name + '.asm'), asm);
    }
    if (kind === 'ordinary') {
      const broken = { ...f, code: Buffer.from(f.code), exe: Buffer.from(f.exe) };
      const ret = broken.code.indexOf(Buffer.from([0xc2, 16, 0])); assert(ret > 0);
      broken.code[ret + 1] = 12; broken.code.copy(broken.exe, 0x1600);
      reject(() => checkPe(broken, kind));
      const badPe = { ...f, exe: Buffer.from(f.exe) }; badPe.exe.writeUInt16LE(0x8664, 0x84);
      reject(() => checkPe(badPe, kind));
      const wrongPcb = { ...f, code: Buffer.from(f.code), exe: Buffer.from(f.exe) };
      const pcb = wrongPcb.code.indexOf(Buffer.from([0x8b, 0x44, 0x24, 16, 0xc7, 0])); assert(pcb > 0);
      wrongPcb.code[pcb + 3] = 12; wrongPcb.code.copy(wrongPcb.exe, 0x1600);
      reject(() => checkPe(wrongPcb, kind));
    }
    if (kind === 'capacity') {
      const broken = { ...f, code: Buffer.from(f.code) };
      const probe = broken.code.indexOf(Buffer.from([0xc7, 0x44, 0x24, 0xd8])); assert(probe > 0);
      broken.code[probe + 3] = 0xdc;
      broken.exe = Buffer.from(f.exe); broken.code.copy(broken.exe, 0x1600);
      reject(() => checkPe(broken, kind));
    }
    if (kind === 'sliced') {
      const broken = { ...f, code: Buffer.from(f.code), exe: Buffer.from(f.exe) };
      const loop = broken.code.indexOf(Buffer.from([0xb9, ...d32(1000100)]));
      assert(loop > 0); broken.code.writeUInt32LE(1, loop + 1);
      broken.code.copy(broken.exe, 0x1600);
      reject(() => checkPe(broken, kind));
    }
    if (kind === 'timeout' || kind === 'nested-timeout') {
      const field = kind === 'timeout' ? 'code' : 'leafCode';
      const broken = { ...f, [field]: Buffer.from(f[field]), exe: Buffer.from(f.exe) };
      // A callback returning 1 could imitate the timeout result/error oracle.
      Buffer.from([0xb8, ...d32(1)]).copy(broken[field], broken[field].length - 5);
      broken[field].copy(broken.exe, field === 'code' ? 0x1600 : 0x1a00);
      reject(() => checkPe(broken, kind));
    }
  }
  // A malformed relative branch must fail the independently decoded CFG.
  const badBranch = Buffer.from([0xe9, 0xfe, 0xff, 0xff, 0xff]);
  reject(() => disassemble(path.join(dir, 'reject-branch.bin'), badBranch, CALLBACK));
  fs.unlinkSync(path.join(dir, 'reject-branch.bin'));
  // Test the acceptance oracle on explicit observations, not a CPU model.
  const capacity = { callbackCount: 63, trap: 'unreachable', returned: 0,
    esp: STACK - 20, expectedEsp: STACK - 20,
    frame: Array.from({ length: 5 }, (_, i) => CANARY + i) };
  checkObservations(capacity, 'capacity');
  for (const field of ['callbackCount', 'returned', 'esp']) reject(() => checkObservations({ ...capacity, [field]: capacity[field] + 1 }, 'capacity'));
  reject(() => checkObservations({ ...capacity, frame: [0, ...capacity.frame.slice(1)] }, 'capacity'));
  for (const kind of KINDS.filter(k => k !== 'capacity')) {
    const nestedBefore = Array.from({ length: 8 }, (_, r) => r === 4 ? STACK - 24 : seedValue(r, 0x33000000));
    const o = { callbackCount: ['timeout', 'error'].includes(kind) ? 1 : 2, trap: null,
      result: ['timeout', 'error'].includes(kind) ? 0 : 3,
      error: kind === 'timeout' ? 1 : kind === 'error' ? 37 : 0,
      text: ['timeout', 'error'].includes(kind) ? '' : 'OWN',
      before: { esp: STACK, eax: 123, ecx: 456, yield_reason: 5, yield_flag: 1 },
      after: { esp: STACK, eax: 123, ecx: 456, yield_reason: 5, yield_flag: 1 },
      canary: CANARY, abi: { cookie: 0xc00c1234, capacity: ['timeout', 'error'].includes(kind) ? 4096 : 4093, ret: 1, buffer: 2, pcb: 3 },
      innerCount: kind === 'nested' ? 2 : 1, innerError: kind === 'nested' ? 0 : 1,
      innerText: kind === 'nested' ? 'in' : '', nestedCanary: CANARY, nestedBefore,
      nestedAfter: nestedBefore.map((v, r) => r === 0 ? kind === 'nested' ? 2 : 0 : v),
      sliced: kind === 'sliced' ? 0x51ce0001 : 0, siblings: 70, siblingResults: 210, siblingCallbacks: 140 };
    checkObservations(o, kind);
    for (const field of ['callbackCount', 'result', 'error', 'canary', 'siblingCallbacks'])
      reject(() => checkObservations({ ...o, [field]: o[field] + 1 }, kind));
    reject(() => checkObservations({ ...o, after: { ...o.after, esp: STACK - 4 } }, kind));
    reject(() => checkObservations({ ...o, after: { ...o.after, yield_flag: 0 } }, kind));
    if (kind.startsWith('nested')) reject(() => checkObservations({ ...o,
      nestedAfter: o.nestedAfter.map((v, r) => r === 3 ? v + 1 : v) }, kind));
  }
  // Aggregate totals alone allow compensating bad siblings (0 + 6 == 3 + 3,
  // or 1 + 3 callbacks == 2 + 2). Qualify every call before accumulating it.
  const siblingBefore = { esp: STACK, eax: 123, yield_flag: 1 };
  const sibling = { result: 3, callbacks: 2, error: 0, text: 'OWN',
    canary: CANARY, after: { ...siblingBefore } };
  checkSibling(sibling, siblingBefore);
  for (const [field, value] of [['result', 0], ['result', 6],
    ['callbacks', 1], ['callbacks', 3], ['error', 1], ['text', 'bad'],
    ['canary', 0], ['after', { ...siblingBefore, esp: STACK - 4 }]]) {
    reject(() => checkSibling({ ...sibling, [field]: value }, siblingBefore));
  }
  const receipt = { status: 'OFFLINE_PASS', native: 'UNEXECUTED', negatives,
    scenarios: KINDS, sourceSha256: sha256(Buffer.from(edit)),
    scope: 'PE32/i386 bytes, independent objdump CFG, source wiring/order, rejecting controls; no VM execution' };
  fs.writeFileSync(path.join(dir, 'offline-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt));
}

async function main() {
  const arg = prefix => process.argv.find(a => a.startsWith(prefix))?.slice(prefix.length);
  const dir = path.resolve(arg('--artifacts=') || path.join(ROOT, 'scratch/runs/20261023-richedit-stream-native-fixture/generated'));
  if (process.argv.includes('--offline')) return offline(dir);
  const wasm = process.env.WINE_ASSEMBLY_WASM, hash = process.env.WA_RICHEDIT_WASM_SHA256;
  const source = process.env.WA_RICHEDIT_SOURCE_REV;
  assert(wasm && /^[0-9a-f]{64}$/.test(hash || '') && /^[0-9a-f]{40}$/.test(source || ''),
    'Require WINE_ASSEMBLY_WASM, WA_RICHEDIT_WASM_SHA256, WA_RICHEDIT_SOURCE_REV from exact-source normalbuild receipt; never auto-build');
  assert.equal(sha256(fs.readFileSync(wasm)), hash);
  const kind = arg('--native-case=');
  if (kind) { assert(KINDS.includes(kind)); return nativeCase(kind, dir, wasm); }
  fs.mkdirSync(dir, { recursive: true });
  const receipt = { source, wasm: path.resolve(wasm), sha256: hash, node: process.version,
    provenance: 'Operator must verify exact-source build receipt; hash alone does not prove source compatibility.',
    status: 'RUNNING', cases: [] };
  const save = () => fs.writeFileSync(path.join(dir, 'native-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  save();
  try {
    for (const scenario of [...KINDS, 'ordinary']) {
      const caseDir = path.join(dir, `${receipt.cases.length}-${scenario}`);
      const r = spawnSync(process.execPath, [__filename, `--native-case=${scenario}`, `--artifacts=${caseDir}`],
        { cwd: ROOT, encoding: 'utf8', timeout: 150000, maxBuffer: 1024 * 1024 });
      fs.mkdirSync(caseDir, { recursive: true });
      fs.writeFileSync(path.join(caseDir, 'run.log'), (r.stdout || '') + (r.stderr || ''));
      receipt.cases.push({ kind: scenario, exit: r.status, signal: r.signal, error: r.error?.message || null }); save();
      assert.ifError(r.error); assert.equal(r.signal, null); assert.equal(r.status, 0);
    }
    receipt.status = 'PASS';
  } catch (error) { receipt.status = 'FAIL'; receipt.failure = error.message; throw error; }
  finally { save(); }
}

module.exports = { fixtures, checkPe, checkWiring, checkObservations, checkSibling };
if (require.main === module) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
