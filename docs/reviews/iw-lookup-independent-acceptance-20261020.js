'use strict';
// Independent source-slice review. No full build, guest, renderer runtime or IPC.
// node this-file.js [object-complete-repo] [optional-output.json]
const fs = require('fs'), cp = require('child_process'), vm = require('vm');
const assert = require('assert/strict'), crypto = require('crypto');
const repo = process.argv[2] || process.cwd();
const candidate = 'aacd0b19d2ccb9edd804573c4edcde461a059032';
const main = 'a54049d11955307d06309e146e85c1aca3196657';
const read = (file, rev = candidate) => cp.execFileSync('git', ['show', `${rev}:${file}`],
  {cwd: repo, encoding: 'utf8', maxBuffer: 8 * 1024 ** 2});
const results = [], modules = [], seals = {};
function source(file, rev = candidate) {
  const text = read(file, rev);
  seals[`${rev}:${file}`] = crypto.createHash('sha256').update(text).digest('hex');
  return text;
}
function eq(label, actual, expected) {
  assert.equal(actual, expected, label); results.push({label, actual, expected});
}
function negative(label, actual, required) {
  assert.throws(() => assert.equal(actual, required), assert.AssertionError);
  results.push({label, actual, required, acceptanceOracleRejected: true});
}
function watFunction(text, name) {
  const start = text.search(new RegExp('\\(func \\$' + name + '\\s')); assert(start >= 0, name);
  let depth = 0, quoted = false;
  for (let i = start; i < text.length; i++) {
    if (!quoted && text.slice(i, i + 2) === ';;') { i = text.indexOf('\n', i); continue; }
    if (text[i] === '"' && text[i - 1] !== '\\') quoted = !quoted;
    if (!quoted && text[i] === '(') depth++;
    if (!quoted && text[i] === ')' && --depth === 0) return text.slice(start, i + 1);
  }
  throw Error(name);
}
const user = source('src/09a-handlers1-user.wat');
const controls = source('src/09c3a-dialog-runtime.wat');
const classSource = source('src/09c0-window-table.wat');
const wideSource = source('src/09a5c-handlers-wide.wat');
const creation = watFunction(source('src/09a5-handlers-window.wat'), 'handle_CreateWindowExA');
const child = watFunction(controls, 'ctrl_create_child');
eq('production ctrl_create_child has no renderer publication', /host_create_window|host_dialog_loaded/.test(child), false);
eq('production child does publish WND row', child.includes('(call $wnd_table_set'), true);
eq('W registration passes original WNDCLASS to register_data',
  watFunction(wideSource, 'handle_RegisterClassW').includes('(local.get $class_name_wa) (call $g2w (local.get $arg0))'), true);
eq('register_data copies original 40-byte WNDCLASS',
  watFunction(classSource, 'class_table_register_data').includes('(local.get $wndclass_wa) (i32.const 40)'), true);
eq('CreateWindowExA translates atom as a pointer for host class',
  creation.includes('(local.set $class_wa (call $g2w (local.get $arg1)))') &&
  creation.includes('(call $host_set_window_class (local.get $hwnd) (local.get $class_wa))'), true);
const compiler = vm.createContext({console, TextEncoder, TextDecoder, Float32Array,
  Float64Array, Uint8Array, ArrayBuffer, Map, Set, RegExp, Array, Object, String,
  Number, Math, Promise, Date, setTimeout, clearTimeout, setImmediate, parseInt, parseFloat, isNaN});
for (const f of ['compiler-parser.js', 'compiler-stages.js', 'compiler-codegen.js', 'compiler.js'])
  vm.runInContext(source('tools/watx-src/' + f), compiler, {filename: f});
function compile(text, imports) {
  const built = compiler.compile(text, new Map(), {standardWat: true, runtimeBuiltins: false});
  assert(built.success, JSON.stringify(built.diagnostics));
  modules.push({bytes: built.wasmBinary.length,
    sha256: crypto.createHash('sha256').update(built.wasmBinary).digest('hex')});
  return new WebAssembly.Instance(new WebAssembly.Module(built.wasmBinary), {h: imports}).exports;
}
const hostModule = {exports: {}};
vm.runInNewContext(source('lib/host-window.js'), {module: hostModule, console: {log() {}}, process: {env: {}}});
function fixture(rev = candidate) {
  const memory = new WebAssembly.Memory({initial: 4});
  const bytes = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
  let cursor = 0x11000;
  function put(text, wide = false) {
    const p = cursor; cursor += (text.length + 1) * (wide ? 2 : 1) + 4;
    for (let i = 0; i < text.length; i++)
      wide ? dv.setUint16(p + i * 2, text.charCodeAt(i), true) : bytes[p + i] = text.charCodeAt(i);
    return p;
  }
  function str(p, wide = false) {
    let result = '';
    for (let i = 0; i < 1024; i++, p += wide ? 2 : 1) {
      const c = wide ? dv.getUint16(p, true) : bytes[p];
      if (!c) return result;
      result += String.fromCharCode(c);
    }
    throw Error('unterminated');
  }
  const rows = [], trace = [], classes = new Map();
  const ctx = {renderer: {windows: {}, scheduleRepaint() {}}};
  const host = hostModule.exports.createWindowHost(ctx, {
    readStr: p => str(p), readStrW: p => str(p, true)}).imports;
  const row = hwnd => rows.find(r => r.hwnd === hwnd);
  const key = (p, wide = false) => p < 65536 ? p : classes.get(str(p, wide).toLowerCase()) ?? -2;
  const imports = {
    memory, g2w: p => p < 65536 ? 240 : p,
    class_name_key: p => key(p), class_wide_name_key: p => key(p, true),
    class_find_slot: k => [...classes.values()].includes(k) ? k : -1,
    class_record_addr: k => 4096 + k * 64,
    wnd_get_class_slot: h => row(h)?.slot ?? -1,
    title_table_get_ptr: h => row(h)?.title ?? 0,
    wide_ascii_eq: (a, b) => +(str(a, true).toLowerCase() === str(b).toLowerCase()),
    guest_ansi_eq_wasm_ci: (a, b) => +(str(a).toLowerCase() === str(b).toLowerCase()),
    wnd_slot_hwnd: i => rows[i]?.hwnd ?? 0,
    wnd_get_parent: h => row(h)?.parent ?? 0,
    wnd_z_get: h => row(h)?.z ?? 0,
    wnd_table_find: h => rows.findIndex(r => r.hwnd === h),
    host_find_window: (...args) => host.find_window(...args),
    wnd_table_set(h, proc) { rows.push({hwnd: h, proc, z: rows.length + 1, parent: 0}); trace.push(['publishWND', h]); },
    wnd_set_parent(h, p) { row(h).parent = p; },
    wnd_set_style(h, s) { row(h).style = s; return 0; },
    ctrl_table_set(i, c, id) { rows[i].control = c; rows[i].id = id; },
    ctrl_geom_set() {}, heap_alloc: () => 32768, heap_free() {},
    wnd_send_message(h, msg) { trace.push(['callback', h, msg]); return 1; },
    paint_flag_set_inv() {},
  };
  const sigs = {
    g2w: [1, 1], class_name_key: [1, 1], class_wide_name_key: [1, 1], class_find_slot: [1, 1],
    class_record_addr: [1, 1], wnd_get_class_slot: [1, 1], title_table_get_ptr: [1, 1],
    wide_ascii_eq: [2, 1], guest_ansi_eq_wasm_ci: [2, 1], wnd_slot_hwnd: [1, 1],
    wnd_get_parent: [1, 1], wnd_z_get: [1, 1], wnd_table_find: [1, 1], host_find_window: [5, 1],
    wnd_table_set: [2, 0], wnd_set_parent: [2, 0], wnd_set_style: [2, 1], ctrl_table_set: [3, 0],
    ctrl_geom_set: [5, 0], heap_alloc: [1, 1], heap_free: [1, 0], wnd_send_message: [4, 1],
    paint_flag_set_inv: [1, 0],
  };
  const body = ['find_window_matches', 'find_window_z_first', 'find_window_z_next', 'find_window_core']
    .map(n => watFunction(source('src/09a-handlers1-user.wat', rev), n)
      .replace('(func $find_window_core ', '(func $find_window_core (export "find") ')).join('\n');
  const wat = `(import "h" "memory" (memory 4))
    ${Object.entries(sigs).map(([n, [argc, ret]]) => `(import "h" "${n}" (func $${n}
      (param ${Array(argc).fill('i32').join(' ')}) ${ret ? '(result i32)' : ''}))`).join('\n')}
    (global $MAX_WINDOWS i32 (i32.const 32))
    (global $next_hwnd (mut i32) (i32.const 700))
    (global $WNDPROC_CTRL_NATIVE i32 (i32.const -1))
    ${body}
    ${child.replace('(func $ctrl_create_child', '(func $ctrl_create_child (export "child")')}
  `;
  const exports = compile(wat, imports);
  function add(h, name, parent = 0, publish = true, registeredWide = false) {
    const slot = classes.size + 1;
    classes.set(name.toLowerCase(), slot);
    dv.setUint32(4096 + slot * 64 + 44, put(name, registeredWide), true);
    rows.push({hwnd: h, slot, title: put('Title'), parent, z: rows.length + 1});
    if (publish) ctx.renderer.windows[h] = {hwnd: h, className: name, title: 'Title',
      isChild: !!parent, parentHwnd: parent, zOrder: rows.length};
    return slot;
  }
  return {exports, ctx, host, rows, trace, put, add, str};
}
// Actual production child allocation function, with bounded table/callback imports.
// Unlike the reviewed helper, no renderer row is fabricated for this child.
for (const rev of [main, candidate]) {
  const f = fixture(rev); f.add(100, 'Parent');
  const h = f.exports.child(100, 2, 7, 0, 0, 80, 20, 0x50000000, 0);
  eq(`${rev} child allocated`, h, 700);
  eq(`${rev} child callback occurred`, f.trace[1][2], 1);
  eq(`${rev} child absent from renderer`, f.ctx.renderer.windows[h], undefined);
  const found = f.exports.find(100, 0, 0, 0, 0);
  eq(`${rev} production-created child lookup`, found, rev === main ? h : 0);
  if (rev === candidate) {
    negative('D1 acceptance: live WAT-only direct child must be discoverable', found, h);
    f.ctx.renderer = null;
    eq('renderer-disabled fixture masks D1', f.exports.find(100, 0, 0, 0, 0), h);
  }
}
// WNDCLASSW retains its original UTF-16 pointer at record+44, even though
// class hashing uses a narrowed scratch key. Query by atom must not read it as A.
for (const rev of [main, candidate]) {
  const f = fixture(rev), atom = f.add(200, 'WideClass', 0, true, true);
  for (const wide of [0, 1]) {
    const found = f.exports.find(0, 0, atom, 0, wide);
    eq(`${rev} W-registered atom queried wide=${wide}`, found, rev === main ? 200 : 0);
    if (rev === candidate) negative(`D2 acceptance wide=${wide}`, found, 200);
  }
  eq(`${rev} name-form wide control`, f.exports.find(0, 0, f.put('WideClass', true), 0, 1), 200);
}
// Production CreateWindowExA sends g2w(atom) to host_set_window_class;
// the low-address sentinel decodes empty, regardless of real WND class identity.
{
  const f = fixture(), atom = f.add(300, 'AtomCreated');
  f.ctx.renderer.setWindowClass = (h, text) => f.ctx.renderer.windows[h].className = text;
  f.host.set_window_class(300, 240);
  const found = f.exports.find(0, 0, atom, 0, 0);
  eq('D3 atom-created metadata decodes empty', f.ctx.renderer.windows[300].className, '');
  negative('D3 acceptance: atom-created window must match its registered class', found, 300);
  f.host.set_window_class(300, f.put('AtomCreated'));
  eq('D3 repaired publication negative control', f.exports.find(0, 0, atom, 0, 0), 300);
}
// Live child after argument omitted from desktop must not invalidate iteration.
{
  const f = fixture(); f.add(400, 'Parent');
  f.add(401, 'HiddenFromDesktop', 400, false);
  f.add(402, 'VisibleInDesktop', 400);
  f.rows.find(r => r.hwnd === 401).z = 10;
  negative('D1 valid unpublished after is rejected', f.exports.find(400, 401, 0, 0, 0), 402);
  f.ctx.renderer = null;
  eq('same after works in local fallback', f.exports.find(400, 401, 0, 0, 0), 402);
}
// Correct coherent-destruction result and deliberate stale-row adversary.
{
  const f = fixture(); f.add(500, 'Gone');
  f.host.destroy_window(500);
  eq('authoritative miss suppresses retained WND row', f.exports.find(0, 0, f.put('Gone'), 0, 0), 0);
  f.ctx.renderer = null;
  eq('unavailable desktop exposes deliberately stale row', f.exports.find(0, 0, f.put('Gone'), 0, 0), 500);
  f.rows.length = 0;
  eq('coherent unpublication fallback', f.exports.find(0, 0, 0, 0, 0), 0);
}
const output = {candidate, main, verdict: 'reject pending publication and class encoding corrections',
  checks: results.length, results, modules, seals,
  limits: 'Actual compiled core/matcher/z-order/ctrl_create_child. Controlled table, class lookup, callbacks, allocator and g2w. W registration copy verified from source; complete CreateWindow/DestroyWindow chains, renderer, Worker RPC, CLI IPC, Unicode/codepages and gameplay not executed.'};
if (process.argv[3]) {
  const s = fs.statfsSync(repo), available = s.bavail * s.bsize, required = 2277507072;
  if (available < required) { console.error(JSON.stringify({blocked: true, available, required})); process.exit(42); }
  fs.writeFileSync(process.argv[3], JSON.stringify(output, null, 2) + '\n');
}
console.log(JSON.stringify({checks: results.length, verdict: output.verdict, modules}, null, 2));
