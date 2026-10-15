#!/usr/bin/env node
'use strict';
// Compile the real module builder and loader handlers, not the full emulator.
// External allocator/registry/host dependencies are controlled by this fixture.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { compileClosure } = require('../tools/watx-closure');
require('child_process').execFileSync(process.execPath, [path.join(__dirname, '../tools/gen-kernel32-image.js'), '--check']);
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, 'src', f), 'utf8');
const all = fs.readdirSync(path.join(root, 'src')).filter(f => /\.wat$/.test(f)).map(read).join('\n');
function form(source, name) {
  const start = source.search(new RegExp('\\(func \\$' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=\\s)'));
  assert(start >= 0, name);
  let depth = 0, quoted = false, comment = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (comment) { if (c === '\n') comment = false; continue; }
    if (quoted) { if (c === '\\') i++; else if (c === '"') quoted = false; continue; }
    if (c === '"') { quoted = true; continue; }
    if (c === ';' && source[i + 1] === ';') { comment = true; continue; }
    if (c === '(') depth++;
    if (c === ')' && !--depth) return source.slice(start, i + 1);
  }
  throw new Error('Unclosed ' + name);
}
const selected = [
  'handle_GetModuleHandleA_locked', 'handle_GetModuleHandleA',
  'handle_GetProcAddress_pinned', 'handle_GetProcAddress',
  'handle_LoadLibraryA', 'loadlib_normalize_name', 'loadlib_path_in_dir',
  'loadlib_path_in_system_dirs', 'loadlib_absent_on_win98',
  'dll_synthetic_reference', 'freelib_mark_loaded',
  'guest_name_tail_is_dll', 'guest_name_has_dll_ext',
  'guest_name_is_static_system_dll', 'static_sys_dll_name_at', 'static_sys_dll_from_handle',
  'emit_path_part', 'store_char', 'resolve_image_export',
  'dll_name_match', 'thunk_reserve', 'thunk_publish', 'update_thunk_end',
  'dll_load_lock_begin', 'lock_acquire', 'lock_release',
  'handle_GetModuleFileNameA_locked', 'handle_GetModuleFileNameW_locked',
];
const loader = read('08-pe-loader.wat');
const image = loader.slice(loader.indexOf(';; BEGIN KERNEL32 IMAGE'), loader.indexOf(';; END KERNEL32 IMAGE'));
assert(image.includes('(func $kernel32_populate_exports'));
let code = selected.map(n => form(all, n)).join('\n') + '\n' + image;
// The anonymous release export is included verbatim too.
const base = read('09a0-handlers-base.wat');
const release = base.slice(base.indexOf('  (func (export "release_synthetic_dll_reference")'), base.indexOf('  ;; 12: LoadLibraryA'));
code += release;
const defined = new Set([...code.matchAll(/\(func \$([^\s()]+)/g)].map(m => m[1]));
const called = new Set([...code.matchAll(/\(call \$([^\s()]+)/g)].map(m => m[1]));
const external = [...called].filter(n => !defined.has(n));
const declarations = external.map(n => {
  const body = form(all, n);
  const signature = body.slice(body.indexOf(n) + n.length).match(/^(?:\s*\((?:export|param|result)[^)]*\))*/)[0].replace(/\(export[^)]*\)/g, '');
  return `(import "mock" "${n}" (func $${n} ${signature}))`;
});
const regions = [...new Set([...code.matchAll(/\(region.addr \$([^\s()]+)/g)].map(m => m[1]))];
const regionBases = Object.fromEntries(regions.map((n, i) => [n, 0x10000 + i * 0x1000]));
const fixture = { image_base: 0x40000, GUEST_BASE: 0x40000, THUNK_BASE: 0x30000,
  reg_base: 0x20000, DLL_TABLE: 0x22000, DLL_SHARED: 0x23000,
  DLL_SYNTHETIC_REFS: 0x24000, STATIC_SYS_DLL_NAMES: 0x25000,
  STATIC_SYS_DLL_HANDLE_BASE: 0x5d110000, exe_name_wa: 0x26000,
  STATIC_SYS_DIR: regionBases.RESERVED_PAGE_STRINGS + 0x25c,
  THUNK_NEXT_SHARED: 0x29000, thunk_guest_base: 0x30000 };
const globals = [...new Set([...code.matchAll(/\(global\.(?:get|set) \$([^\s()]+)/g)].map(m => m[1]))];
const exportsWat = selected.filter(n => n.startsWith('handle_')).map(n => `(export "${n}" (func $${n}))`).join('\n');
const source = `(import "mock" "memory" (memory 32 32 shared))\n${declarations.join('\n')}
  ${regions.map(n => `(region.declare-fixed $${n} (base ${regionBases[n]}) (size 4096) (align 4096) (owner "fixture"))`).join('\n')}
  ${globals.map(n => `(global $${n} (mut i32) (i32.const ${fixture[n] || regionBases[n] || 0}))`).join('\n')}
  ${code} ${exportsWat}
  (export "ensure" (func $kernel32_ensure_locked))
  (export "identity" (func $kernel32_module))
  (export "retain" (func $freelib_mark_loaded))`;
const compiled = compileClosure({ source, vfs: new Map() });
assert(compiled.success, compiled.error);
const memory = new WebAssembly.Memory({ initial: 32, maximum: 32, shared: true });
const sparse = process.argv.includes('--sparse');
const wa = p => sparse && p >= 0x30000000 ? p - 0x30000000 : p;
const bytes = new Uint8Array(memory.buffer), rawView = new DataView(memory.buffer);
const dv = new Proxy(rawView, { get(target, key) {
  if (/^(get|set)/.test(String(key))) return (p, ...args) => target[key](wa(p), ...args);
  return target[key];
} });
const string = p => { p = wa(p); let s = ''; while (bytes[p]) s += String.fromCharCode(bytes[p++]); return s; };
const put = (p, s) => { bytes.set(Buffer.from(s + '\0'), wa(p)); return p; };
let heap = sparse ? 0x30080000 : 0x80000, loaded = -1, allocations = 0;
const api = new Map(require('../src/api_table.json').map(a => [a.name, a.id]));
const mock = Object.fromEntries(external.map(n => [n, () => { throw new Error('Unexpected dependency: ' + n); }]));
Object.assign(mock, {
  memory, g2w: wa, gl8: p => dv.getUint8(p), gl16: p => dv.getUint16(p, true), gl32: p => dv.getUint32(p, true),
  gs8: (p, v) => dv.setUint8(p, v), gs16: (p, v) => dv.setUint16(p, v, true), gs32: (p, v) => dv.setUint32(p, v, true),
  tolower: c => c >= 65 && c <= 90 ? c + 32 : c,
  heap_alloc: size => { allocations++; const p = heap; heap += size; return p; },
  lookup_api_id: p => api.get(string(p)) ?? -1,
  str_eq: (a, b) => +(string(a) === string(b)),
  lock_owner_id: () => 1,
  find_loaded_dll: () => loaded, dll_pin_module: () => 0, dll_unpin_module_index: () => {},
  dll_row_init_pending: () => 0, dll_retain_locked: () => 1,
  host_has_dll_file: () => 0,
});
(async () => {
  const module = await WebAssembly.compile(compiled.wasmBinary);
  const e = (await WebAssembly.instantiate(module, { mock })).exports;
  put(regionBases.RESERVED_PAGE_STRINGS + 0x30, 'KERNEL32.dll');
  put(fixture.STATIC_SYS_DIR, 'C:\\WINDOWS\\SYSTEM\\');
  put(fixture.exe_name_wa, 'fixture.exe');
  dv.setUint32(fixture.THUNK_NEXT_SHARED, 3, true);
  bytes.fill(0xab, fixture.THUNK_BASE, fixture.THUNK_BASE + 24);
  const call = (name, a = 0, b = 0, c = 0) => {
    dv.setUint32(fixture.reg_base + 16, 0x100, true);
    e[name](a, b, c, 0, 0, 0);
    return dv.getUint32(fixture.reg_base, true);
  };
  assert.equal(call('handle_GetModuleHandleA'), fixture.image_base);
  const h = call('handle_GetModuleHandleA', put(0x27000, 'KERNEL32'));
  assert(h && h !== fixture.image_base);
  assert.equal(e.release_synthetic_dll_reference(h), 0, 'GetModuleHandle does not add a releasable reference');
  assert(bytes.slice(fixture.THUNK_BASE, fixture.THUNK_BASE + 24).every(b => b === 0xab), 'existing imported thunk records remain untouched');
  assert.equal(dv.getUint16(h, true), 0x5a4d);
  const pe = h + dv.getUint32(h + 60, true);
  assert.equal(dv.getUint32(pe, true), 0x4550);
  const exp = h + dv.getUint32(pe + 120, true);
  const eat = h + dv.getUint32(exp + 28, true);
  const manifest = require('../src/kernel32-exports.json');
  const nameTable = h + dv.getUint32(exp + 32, true);
  const nameCount = dv.getUint32(exp + 24, true);
  const names = Array.from({ length: nameCount }, (_, i) => string(h + dv.getUint32(nameTable + i * 4, true)));
  assert.deepEqual(names, [...names].sort(), 'PE name pointers use ASCII lexical order');
  assert.equal(new Set(names).size, nameCount);
  for (const item of manifest.exports) {
    const rva = dv.getUint32(eat + (item.ordinal - 1) * 4, true);
    const ptr = call('handle_GetProcAddress', h, item.name ? put(0x27000, item.name) : item.ordinal);
    assert.equal(ptr, h + rva, item.api);
    assert.equal(bytes[wa(ptr)], 0xe9);
    const target = (ptr + 5 + dv.getInt32(ptr + 1, true)) >>> 0;
    assert.equal(dv.getUint32(target + 4, true), api.get(item.api));
    assert.equal(string(fixture.image_base + dv.getUint32(target, true) + 2), item.api,
      'dispatcher name is hint-relative guest RVA: ' + item.api);
  }
  for (const ordinal of [0, 35, 36, 37, 1025, 65535])
    assert.equal(call('handle_GetProcAddress', h, ordinal), 0);
  for (const name of ['QT_Thunk', 'MessageBoxA', '_acmdln', 'FixtureExeCallback'])
    assert.equal(call('handle_GetProcAddress', h, put(0x27000, name)), 0, name);
  // A separate synthetic EXE exports its own callback at ordinal 1. KERNEL32
  // must never expose it, even when the executable really has that export.
  const exe = fixture.image_base;
  dv.setUint16(exe, 0x5a4d, true); dv.setUint32(exe + 60, 128, true);
  dv.setUint32(exe + 128, 0x4550, true); dv.setUint32(exe + 248, 4096, true);
  dv.setUint32(exe + 252, 256, true);
  for (const [offset, value] of [[16, 1], [20, 1], [24, 1], [28, 4352], [32, 4356], [36, 4360]])
    dv.setUint32(exe + 4096 + offset, value, true);
  dv.setUint32(exe + 4352, 8192, true); dv.setUint32(exe + 4356, 4400, true);
  dv.setUint16(exe + 4360, 0, true); put(exe + 4400, 'FixtureExeCallback');
  assert.equal(call('handle_GetProcAddress', exe, put(0x27000, 'FixtureExeCallback')), exe + 8192);
  assert.equal(call('handle_GetProcAddress', exe, 1), exe + 8192);
  assert.equal(call('handle_GetProcAddress', h, put(0x27000, 'FixtureExeCallback')), 0);
  const before = allocations;
  const second = (await WebAssembly.instantiate(module, { mock })).exports;
  assert.equal(second.identity(), h);
  assert.equal(second.ensure(), h);
  assert.equal(allocations, before);
  assert.equal(dv.getUint32(fixture.THUNK_NEXT_SHARED, true), manifest.exports.length + 3);
  for (const name of ['kernel32', 'KERNEL32.DLL', 'C:\\WINDOWS\\SYSTEM\\kernel32.dll', 'c:/windows/kernel32.dll'])
    assert.equal(call('handle_LoadLibraryA', put(0x27000, name)), h, name);
  assert.equal(call('handle_LoadLibraryA', put(0x27000, 'C:\\private\\kernel32.dll')), 0);
  for (let i = 0; i < 4; i++) assert.equal(second.release_synthetic_dll_reference(h), 1);
  assert.equal(second.release_synthetic_dll_reference(h), 0);
  assert.equal(second.identity(), h, 'process module stays mapped after explicit refs drain');
  assert.equal(call('handle_GetModuleFileNameA_locked', h, 0x28000, 260), 30);
  assert.equal(string(0x28000), 'C:\\WINDOWS\\SYSTEM\\KERNEL32.dll');
  call('handle_GetModuleFileNameW_locked', h, 0x28000, 260);
  assert.equal(Buffer.from(bytes.slice(0x28000, 0x28000 + 60)).toString('utf16le'), 'C:\\WINDOWS\\SYSTEM\\KERNEL32.dll');
  loaded = 0; dv.setUint32(fixture.DLL_TABLE, 0x60000, true);
  assert.equal(call('handle_GetModuleHandleA', put(0x27000, 'kernel32.dll')), 0x60000);
  assert.equal(call('handle_LoadLibraryA', put(0x27000, 'kernel32.dll')), 0x60000);
  console.log(`PASS ${sparse ? 'sparse' : 'direct'}: ${manifest.exports.length} EAT/GPA exports and dispatch names; holes, foreign exports, shared identity, refs, paths and mapped precedence`);
})().catch(error => { console.error(error); process.exitCode = 1; });
