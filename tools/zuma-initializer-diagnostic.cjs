'use strict';

// Offline inventory and private, passive loader observation. Does not launch
// an app. instrument() returns source for a future authorized private route;
// it never writes the production loader or changes its execution budget.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { readPE } = require('../lib/pe');
const { disasmAt } = require('./disasm');
const { guestToWasm } = require('../lib/mem-utils');
const { importsByDll } = require('../lib/dll-loader');
const registry = require('../lib/dll-registry');
const root = 'test/binaries/candidates/reflexive-zuma-deluxe/';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

function inventory(file) {
  const b = fs.readFileSync(file), p = readPE(b), h = b.readUInt32LE(60);
  const entry = p.imageBase + p.entryRva;
  const off = p.va2off(entry);
  const bass = /bass\.dll$/i.test(file);
  const relocOff = bass ? p.va2off(p.imageBase + b.readUInt32LE(h + 160)) : -1;
  const packedRelocations = relocOff < 0 ? undefined : Array.from({ length: 4 }, (_, i) => {
    const v = b.readUInt16LE(relocOff + 8 + i * 2);
    return { type: v >>> 12, rva: b.readUInt32LE(relocOff) + (v & 4095) };
  });
  return { file, sha256: sha(b), bytes: b.length, imageBase: p.imageBase,
    sizeOfImage: b.readUInt32LE(h + 80), entryRva: p.entryRva,
    hypotheticalEntryAt989000: 0x989000 + p.entryRva,
    sections: p.sections,
    entryDisassembly: off < 0 ? null : disasmAt(b, off, entry, 96, undefined, { linear: true }),
    packedRelocations,
    bassStage2HasRaw: bass ? p.va2off(p.imageBase + 0x26a72) >= 0 : undefined };
}

function audit() {
  const manifest = fs.readFileSync(root + '.wine-assembly-browser.json');
  const paths = [root + 'game/Zuma.exe', ...JSON.parse(manifest).files
    .filter(f => /\.(dll|exe)$/i.test(f.url)).map(f => root + f.url)];
  const unique = [...new Set(paths)], shared = new Set();
  for (const file of unique) {
    for (const { dll } of importsByDll(fs.readFileSync(file))) {
      const fallback = registry.dllPath(dll);
      if (fallback) shared.add('test/' + fallback);
    }
  }
  return { manifestSha256: sha(manifest), images: unique.map(inventory),
    sharedCandidates: [...shared].map(inventory),
    conclusion: '0x989000 is a rebased module base, not an EIP or authenticated file identity. Match a live DLL row/path and entry RVA before attributing it.' };
}

// All reads are bounded and translated individually: sparse pages need not
// be adjacent in Wasm. Reject the mapper's NULL sentinel, never label it data.
function readGuest(e, addr, length) {
  if (!Number.isInteger(addr) || addr <= 0 || addr > 0xffffffff ||
      !Number.isInteger(length) || length < 0 || length > 256 || addr + length > 0x100000000)
    return { address: addr, unavailable: 'range' };
  const b = e.memory.buffer, out = [];
  for (let i = 0; i < length; i++) {
    const w = guestToWasm(addr + i, e, b, e.get_image_base()) >>> 0;
    if (w === 0xf0 || w >= b.byteLength) return { address: addr, unavailable: 'mapping' };
    out.push(new Uint8Array(b)[w]);
  }
  return { address: addr, hex: out.map(v => v.toString(16).padStart(2, '0')).join('') };
}

function snapshot(e, loadAddr, dllMain, phase, detail) {
  const regs = {};
  for (const n of ['eip', 'esp', 'eax', 'ebx', 'ecx', 'edx', 'ebp', 'esi', 'edi',
    'yield_reason', 'yield_flag', 'last_run_halt', 'current_thread_id', 'fs_base']) {
    if (typeof e['get_' + n] === 'function') regs[n] = e['get_' + n]() >>> 0;
  }
  const b = e.memory.buffer, dv = new DataView(b);
  const word = a => Number.isInteger(a) && a >= 0 && a + 4 <= b.byteLength ? dv.getUint32(a, true) : null;
  const rows = [];
  const count = e.get_dll_count?.() >>> 0;
  if (count > 64) throw new Error('DLL diagnostic row cap exceeded');
  for (let i = 0; i < count; i++) {
    const t = (e.get_dll_table() >>> 0) + i * 32;
    const row = { index: i, words: Array.from({ length: 8 }, (_, j) => word(t + j * 4)) };
    if (e.get_dll_path_table) {
      const ptr = word((e.get_dll_path_table() >>> 0) + i * 4);
      row.path = readGuest(e, ptr, 128);
    }
    if (e.get_dll_lifecycle_table && e.get_dll_lifecycle_stride) {
      const a = e.get_dll_lifecycle_table() + i * e.get_dll_lifecycle_stride();
      row.lifecycle = Array.from({ length: 16 }, (_, j) => word(a + j * 4));
    }
    rows.push(row);
  }
  // Stack is captured before restoration. First word at the parked caller
  // is its real return continuation; the initializer's sentinel is separate.
  return { phase, loadAddr, dllMain, detail, regs, rows,
    header: readGuest(e, loadAddr, 128), entry: readGuest(e, dllMain, 192),
    code: readGuest(e, regs.eip, 128), stack: readGuest(e, regs.esp, 128),
    pointers: ['ecx', 'edx', 'esi', 'edi'].map(n => ({ register: n, ...readGuest(e, regs[n], 32) })) };
}

function createObserver(emit, target = 0x989000) {
  let records = 0;
  return (e, base, entry, phase, detail) => {
    if ((base >>> 0) !== target || records >= 3) return;
    records++;
    emit(snapshot(e, base, entry, phase, detail));
  };
}

// Prepend this to the private loader response in the actual owning Worker.
// mem-utils is already a production loader prerequisite. Console retention
// belongs to the future authorized harness; there is no launcher here.
function browserObserverSource(target = 0x989000) {
  if (!Number.isInteger(target) || target <= 0 || target > 0xffffffff) throw new Error('Invalid target');
  return `(function () { const guestToWasm = globalThis.memUtils.guestToWasm;\n${readGuest}\n${snapshot}\n${createObserver}\nglobalThis.__zumaInitializerDiagnostic = createObserver(record => console.log('[zuma-initializer] ' + JSON.stringify(record)), ${target});\n})();\n`;
}

function instrument(source) {
  // Exact anchors fail closed on source drift. Catch observer errors locally;
  // real loader throws, yields, return values and register writes are intact.
  const insertions = [
    ['function* dllMainSteps(exports, loadAddr, dllMain, log, options = {}) {',
      "\n  const zumaObserve = (phase, detail) => { try { globalThis.__zumaInitializerDiagnostic?.(exports, loadAddr, dllMain, phase, detail); } catch (_) {} };\n  zumaObserve('caller');"],
    ['  if (log) log(`Calling DllMain at 0x${dllMain.toString(16)}...`);',
      "\n  zumaObserve('entry');"],
    ['  // Restore ESP (DllMain is stdcall, it cleaned up the 12 bytes of args,',
      "  zumaObserve('final', { completed, exited, returnValue, halt, yieldReason, fault: fault ? String(fault.message) : null });\n"]
  ];
  for (const [anchor, addition] of insertions) {
    if (source.split(anchor).length !== 2) throw new Error('Loader diagnostic anchor mismatch');
    source = anchor.startsWith('  // Restore') ? source.replace(anchor, addition + anchor)
      : source.replace(anchor, anchor + addition);
  }
  return source;
}

module.exports = { audit, inventory, readGuest, snapshot, createObserver, browserObserverSource, instrument };
if (require.main === module) process.stdout.write(JSON.stringify(audit(), null, 2) + '\n');
