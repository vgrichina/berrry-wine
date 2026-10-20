'use strict';
// Source-slice qualification only. No full VM, browser, Worker or game.
// node this-file.js REPO [OUTPUT.json] [--generate-map]
const fs = require('fs'), cp = require('child_process'), vm = require('vm');
const path = require('path'), assert = require('assert/strict'), crypto = require('crypto');
const repo = path.resolve(process.argv[2] || '.');
const base = 'aacd0b19d2ccb9edd804573c4edcde461a059032';
const seals = {}, results = [], modules = [];
function gate() {
  const s = fs.statfsSync(repo), available = s.bavail * s.bsize, required = 2277507072;
  if (available < required) { console.error(JSON.stringify({blocked: true, available, required})); process.exit(42); }
  return {available, required};
}
function read(file) {
  const p = path.join(repo, file);
  const text = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') :
    cp.execFileSync('git', ['show', `${base}:${file}`], {cwd: repo, encoding: 'utf8', maxBuffer: 8e6});
  seals[file] = crypto.createHash('sha256').update(text).digest('hex');
  return text;
}
function fn(text, name) {
  const start = text.search(new RegExp('\\(func \\$' + name + '\\s'));
  assert(start >= 0, name);
  let depth = 0, quoted = false;
  for (let i = start; i < text.length; i++) {
    if (!quoted && text.slice(i, i + 2) === ';;') { i = text.indexOf('\n', i); continue; }
    if (text[i] === '"' && text[i - 1] !== '\\') quoted = !quoted;
    if (!quoted && text[i] === '(') depth++;
    if (!quoted && text[i] === ')' && --depth === 0) return text.slice(start, i + 1);
  }
  throw Error(name);
}
function eq(label, actual, expected) { assert.equal(actual, expected, label); results.push({label, actual, expected}); }
function reject(label, body) { assert.throws(body, assert.AssertionError); results.push({label, rejected: true}); }
const compiler = vm.createContext({console: {log() {}, warn() {}, error() {}}, TextEncoder, TextDecoder,
  Float32Array, Float64Array, Uint8Array, ArrayBuffer, Map, Set, RegExp, Array, Object, String,
  Number, Math, Promise, Date, setTimeout, clearTimeout, setImmediate, parseInt, parseFloat, isNaN});
for (const file of ['compiler-parser.js', 'compiler-stages.js', 'compiler-codegen.js', 'compiler.js'])
  vm.runInContext(read('tools/watx-src/' + file), compiler);
function compile(text, imports) {
  const built = compiler.compile(text, new Map(), {standardWat: true, runtimeBuiltins: false});
  assert(built.success, JSON.stringify(built.diagnostics || built.error));
  modules.push({bytes: built.wasmBinary.length, sha256: crypto.createHash('sha256').update(built.wasmBinary).digest('hex')});
  return new WebAssembly.Instance(new WebAssembly.Module(built.wasmBinary), {h: imports}).exports;
}
// Execute the unchanged repository region generator against a read-only virtual
// source tree. Unmaterialized sparse paths come from the exact base object.
function sourceModule(file, cache = new Map()) {
  file = file.replace(/\\/g, '/');
  if (!file.endsWith('.js') && !file.endsWith('.json')) file += '.js';
  if (cache.has(file)) return cache.get(file).exports;
  const mod = {exports: {}}; cache.set(file, mod);
  if (file.endsWith('.json')) return mod.exports=JSON.parse(read(file));
  const virtualFs = {...fs,
    readFileSync(p, encoding) {
      const rel = path.relative(repo, p);
      if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
        const text = read(rel); return encoding ? text : Buffer.from(text);
      }
      return fs.readFileSync(p, encoding);
    },
    readdirSync(p, options) {
      if (path.resolve(p) === path.join(repo, 'src') && !options)
        return cp.execFileSync('git', ['ls-tree', '--name-only', `${base}:src`], {cwd: repo, encoding: 'utf8'}).trim().split('\n');
      return fs.readdirSync(p, options);
    },
    existsSync(p) {
      if (path.resolve(p).startsWith(repo + '/src/')) return true;
      return fs.existsSync(p);
    },
  };
  const req = name => {
    if (name === 'fs') return virtualFs;
    if (name.startsWith('.') || name.startsWith(repo + '/'))
      return sourceModule(path.relative(repo, path.resolve(repo, path.dirname(file), name)), cache);
    return require(name);
  };
  vm.runInThisContext('(function(require,module,exports,__dirname,__filename,process){\n' + read(file).replace(/^#![^\n]*\n/, '') + '\n})',
    {filename: file})(req, mod, mod.exports, path.join(repo, path.dirname(file)), path.join(repo, file),
    {...process, argv:['node',file,'--check'], exit(code){throw Error(`${file} exited ${code}`);}});
  return mod.exports;
}
if (process.argv.includes('--generate-map')) {
  const mirror = sourceModule('tools/gen-region-map.js').render();
  gate(); fs.writeFileSync(path.join(repo, 'lib/region-map.generated.js'), mirror.text);
}
const table = read('src/09c0-window-table.wat'), user = read('src/09a-handlers1-user.wat');
const wide = read('src/09a5c-handlers-wide.wat');
const child = fn(read('src/09c3a-dialog-runtime.wat'), 'ctrl_create_child');
const create = fn(read('src/09a5-handlers-window.wat'), 'handle_CreateWindowExA');
const publication = create.match(/\(call \$host_set_window_class[\s\S]*?\(call \$class_publication_name \(local.get \$arg1\)\)\)/);
assert(publication, 'actual creation publication expression');
const expose = (text, name, exp = name) => text.replace('(func $' + name, '(func $' + name + ` (export "${exp}")`);
// Exercise the real WND allocation/reset/removal functions as well as the
// controlled table used to isolate host ordering below. Non-lookup parallel
// tables and graphics teardown are explicit traced boundaries, not VM claims.
function lifetimeFixture(mutation = false) {
  const memory = new WebAssembly.Memory({initial: 2, maximum: 2, shared: true});
  const bytes = new Uint8Array(memory.buffer), trace = [];
  const names = ['wnd_record_addr','wnd_thread_addr','wnd_table_find','wnd_table_set',
    'wnd_slot_reset','wnd_table_remove','wnd_lookup_live','wnd_lookup_retire'];
  let body = names.map(n => ['wnd_table_set','wnd_table_remove'].includes(n) ?
    expose(fn(table,n),n) : fn(table,n)).join('\n');
  if (mutation) body = body.replace(
    '(i32.store8 (i32.add (region.addr $WND_LOOKUP_RETIRED 0) (local.get $slot)) (i32.const 0))', '(nop)');
  const deps = [...new Set([...body.matchAll(/\(call \$([\w_]+)/g)].map(m=>m[1]))].filter(n=>!names.includes(n));
  const imports = {memory};
  const signatures = deps.map(n=>{
    let argc=1,ret=0;
    if (n.startsWith('lock_')) argc=0;
    if (n==='zero_memory' || n==='win16_h16_forget_window') argc=2;
    if (n.endsWith('_addr_for_slot')) ret=1;
    imports[n]=(...args)=>{
      trace.push([n,...args]);
      if(n==='zero_memory') bytes.fill(0,args[0],args[0]+args[1]);
      if(ret) return 12000 + args[0]*32;
    };
    return `(import "h" "${n}" (func $${n} ${argc?'(param '+Array(argc).fill('i32').join(' ')+')':''} ${ret?'(result i32)':''}))`;
  }).join('\n');
  const ex=compile(`(import "h" "memory" (memory 2 2 shared))
    ${signatures}
    (layout WndRecord (field hwnd i32) (field wndproc i32) (field parent i32)
      (field userdata i32) (field style i32) (field state_ptr i32))
    (region.declare-fixed $WND_LOOKUP_RETIRED (base 8448) (size 256) (align 16))
    (global $WND_RECORDS i32 (i32.const 4096))
    (global $WND_THREAD_TABLE i32 (i32.const 10000))
    (global $FLASH_TABLE i32 (i32.const 11000))
    (global $SHOW_STATE_TABLE i32 (i32.const 11500))
    (global $MAX_WINDOWS i32 (i32.const 32))
    (global $current_thread_id i32 (i32.const 7))
    (global $wnd_find_hint0 (mut i32) (i32.const -1))
    (global $wnd_find_hint1 (mut i32) (i32.const -1))
    ${body}`,imports);
  return {ex,trace,memory};
}
{
  const f=lifetimeFixture(), e=f.ex;
  eq('NULL is not an empty live slot',e.wnd_lookup_live(0),0);
  e.wnd_table_set(100,0x401000);
  eq('actual WND table allocation starts live',e.wnd_lookup_live(100),1);
  e.wnd_lookup_retire(100);
  eq('actual WND retirement keeps row undiscoverable',e.wnd_lookup_live(100),0);
  e.wnd_table_set(100,0x402000);
  eq('subclass update cannot revive retired lifetime',e.wnd_lookup_live(100),0);
  e.wnd_table_remove(100);
  eq('actual removal leaves no live row',e.wnd_lookup_live(100),0);
  e.wnd_table_set(100,0x401000);
  eq('actual allocation resets retirement for reused handle/slot',e.wnd_lookup_live(100),1);
  eq('retirement storage is shared memory',f.memory.buffer instanceof SharedArrayBuffer,true);
  reject('reject missing actual slot retirement reset',()=>{
    const bad=lifetimeFixture(true).ex;
    bad.wnd_table_set(100,1);bad.wnd_lookup_retire(100);bad.wnd_table_remove(100);bad.wnd_table_set(100,1);
    assert.equal(bad.wnd_lookup_live(100),1);
  });
}
function fixture(mutation = '') {
  const memory = new WebAssembly.Memory({initial: 4, maximum: 4, shared: true});
  const b = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
  let cursor = 0x12000, ex;
  const rows = [], trace = [], controls = new Map();
  const put = (s, w = false) => {
    const p = cursor; cursor += (s.length + 1) * (w ? 2 : 1) + 16;
    for (let i = 0; i < s.length; i++) w ? dv.setUint16(p + 2 * i, s.charCodeAt(i), true) : b[p + i] = s.charCodeAt(i);
    return p;
  };
  const str = (p, w = false) => {
    let out = '';
    for (let i = 0; i < 1024; i++, p += w ? 2 : 1) {
      const c = w ? dv.getUint16(p, true) : b[p]; if (!c) return out; out += String.fromCharCode(c);
    }
    throw Error('unterminated fixture string');
  };
  const row = h => rows.find(r => r.hwnd === (h >>> 0));
  const ctx = {renderer: {windows: {}, scheduleRepaint() {},
    setWindowClass(h, name) { this.windows[h].className = name; }}, getMemory: () => memory.buffer};
  const hostModule = {exports: {}};
  let hostText = read('lib/host-window.js');
  if (mutation === 'no-reconcile') hostText = hostText.replace('if (canReconcile) {', 'if (false) {');
  if (mutation === 'no-retire') hostText = hostText.replace('owner.wnd_lookup_retire(h);', 'void h;');
  vm.runInNewContext(hostText, {module: hostModule, console: {log() {}}, process: {env: {}}});
  const host = hostModule.exports.createWindowHost(ctx, {readStr: p => str(p), readStrW: p => str(p, true)}).imports;
  const imports = {
    memory, g2w: p => p < 65536 ? 240 : p, w2g: p => p,
    gl32: p => dv.getUint32(p, true),
    lock_wnd_acquire() { trace.push('lock'); }, lock_wnd_release() { trace.push('unlock'); },
    memcpy: (d, s, n) => b.copyWithin(d, s, s + n), zero_memory: (p, n) => b.fill(0, p, p + n),
    wnd_get_class_slot: h => row(h)?.slot ?? -1, title_table_get_ptr: h => row(h)?.title ?? 0,
    wide_ascii_eq: (a, c) => +(str(a, true).toLowerCase() === str(c).toLowerCase()),
    guest_ansi_eq_wasm_ci: (a, c) => +(str(a).toLowerCase() === str(c).toLowerCase()),
    wnd_slot_hwnd: i => rows[i]?.hwnd ?? 0,
    wnd_get_parent: h => row(h)?.parent ?? 0, wnd_z_get: h => row(h)?.z ?? 0,
    wnd_table_find: h => rows.findIndex(r => r.hwnd === h),
    host_find_window: (...a) => host.find_window(...a), host_set_window_class: (...a) => host.set_window_class(...a),
    wnd_table_set(h, proc) {
      const i = rows.length; rows.push({hwnd: h, proc, z: (i + 1) * 1024, parent: 0});
      // Execute the retirement reset expression from the production slot reset.
      ex.reset_lookup(i); trace.push(['publishWND', h]);
    },
    wnd_set_parent(h, p) { row(h).parent = p; }, wnd_set_style(h, s) { row(h).style = s; return 0; },
    ctrl_table_set(i, c, id) { controls.set(rows[i].hwnd, c); row(rows[i].hwnd).id = id; },
    ctrl_table_get_class: h => controls.get(h) || 0,
    ctrl_geom_set() {}, heap_alloc: () => 32768, heap_free() {},
    wnd_send_message(h, msg) { trace.push(['callback', h, msg]); return 1; },
    paint_flag_set_inv() {},
  };
  const sigs = {
    g2w:[1,1], w2g:[1,1], gl32:[1,1], lock_wnd_acquire:[0,0], lock_wnd_release:[0,0],
    memcpy:[3,0], zero_memory:[2,0], wnd_get_class_slot:[1,1], title_table_get_ptr:[1,1],
    wide_ascii_eq:[2,1], guest_ansi_eq_wasm_ci:[2,1], wnd_slot_hwnd:[1,1], wnd_get_parent:[1,1],
    wnd_z_get:[1,1], wnd_table_find:[1,1], host_find_window:[5,1], host_set_window_class:[2,0],
    wnd_table_set:[2,0], wnd_set_parent:[2,0], wnd_set_style:[2,1], ctrl_table_set:[3,0],
    ctrl_table_get_class:[1,1], ctrl_geom_set:[5,0], heap_alloc:[1,1], heap_free:[1,0],
    wnd_send_message:[4,1], paint_flag_set_inv:[1,0],
  };
  const tableFns = ['class_name_key','class_wide_name_key','builtin_class_atom','builtin_ctrl_class_id_key',
    'class_name_hash','class_record_addr','class_find_slot','class_table_register_data',
    'class_table_register_encoded','class_name_is_wide','class_publication_name',
    'wnd_lookup_live','wnd_lookup_retire','wnd_lookup_retired','wnd_lookup_slot'].map(n => {
      let text = fn(table, n);
      if (['class_find_slot','class_table_register_data','class_publication_name'].includes(n)) text = expose(text, n);
      if (mutation === 'ansi-registration' && n === 'class_name_is_wide')
        text = '(func $class_name_is_wide (param $slot i32) (result i32) (i32.const 0))';
      return text;
    }).join('\n');
  const reset = fn(table, 'wnd_slot_reset').split('\n')[1];
  const functions = ['find_window_matches','find_window_z_first','find_window_z_next',
    'find_window_local_match','find_window_core'].map(n => n === 'find_window_core' ?
    expose(fn(user, n), n, 'find') : fn(user, n)).join('\n');
  let publish = publication[0];
  if (mutation === 'atom-pointer') publish = '(call $host_set_window_class (local.get $hwnd) (call $g2w (local.get $arg1)))';
  const wat = `(import "h" "memory" (memory 4 4 shared))
    ${Object.entries(sigs).map(([n,[argc,ret]]) => `(import "h" "${n}" (func $${n}
      ${argc ? '(param ' + Array(argc).fill('i32').join(' ') + ')' : ''} ${ret ? '(result i32)' : ''}))`).join('\n')}
    (region.declare-fixed $CLASS_NAME_WIDE (base 8192) (size 64) (align 16))
    (region.declare-fixed $WND_LOOKUP_RETIRED (base 8448) (size 256) (align 16))
    (global $CLASS_RECORDS i32 (i32.const 4096))
    (global $MAX_CLASSES i32 (i32.const 64))
    (global $CLASS_ATOM_BASE i32 (i32.const 49152))
    (global $SHARED_COUNTERS i32 (i32.const 9000))
    (global $TEXT_SCRATCH i32 (i32.const 65536))
    (global $MAX_WINDOWS i32 (i32.const 32))
    (global $next_hwnd (mut i32) (i32.const 700))
    (global $WNDPROC_CTRL_NATIVE i32 (i32.const -1))
    (global $reg_base i32 (i32.const 10000))
    (global $wndproc_addr (mut i32) (i32.const 0))
    (global $wndproc_addr2 (mut i32) (i32.const 0))
    (global $wndclass_style (mut i32) (i32.const 0))
    (global $wndclass_bg_brush (mut i32) (i32.const 0))
    (global $image_base i32 (i32.const 4194304))
    (global $exe_size_of_image i32 (i32.const 65536))
    ${tableFns} ${functions}
    ${expose(child, 'ctrl_create_child', 'child')}
    ${expose(fn(wide, 'handle_RegisterClassW'), 'handle_RegisterClassW', 'registerW')}
    ${expose(fn(wide, 'handle_RegisterClassExW'), 'handle_RegisterClassExW', 'registerExW')}
    (func (export "reset_lookup") (param $slot i32) ${reset})
    (func (export "publish") (param $hwnd i32) (param $arg1 i32) ${publish})
  `;
  ex = compile(wat, imports);
  ctx.exports = {...ex, wnd_get_parent: imports.wnd_get_parent, wnd_z_get: imports.wnd_z_get};
  function register(name, encoding = 0, extended = false) {
    const p = put(name, !!encoding), wc = cursor; cursor += 64;
    dv.setUint32(wc + (extended ? 40 : 36), p, true);
    let atom;
    if (encoding) { (extended ? ex.registerExW : ex.registerW)(wc,0,0,0,0,0); atom = dv.getUint32(10000, true); }
    else atom = ex.class_table_register_data(p, wc);
    return {atom, slot: ex.class_find_slot(atom), p, wc};
  }
  function add(h, name, parent = 0, published = true, encoding = 0) {
    const c = register(name, encoding);
    imports.wnd_table_set(h, 0x401000);
    Object.assign(row(h), {slot: c.slot, title: put('Title'), parent});
    if (published) ctx.renderer.windows[h] = {hwnd:h, className:name, title:'Title', isChild:!!parent,
      parentHwnd:parent, zOrder:rows.length, wasm:{exports:ctx.exports}, wasmMemory:memory};
    return c;
  }
  return {ex, ctx, host, rows, row, trace, put, str, add, register, imports, dv};
}
{
  const f = fixture(); f.add(100, 'Parent');
  const h = f.ex.child(100,2,7,0,0,80,20,0x50000000,0);
  eq('actual ctrl_create_child allocated', h, 700);
  eq('actual ctrl_create_child sent WM_CREATE', f.trace.some(x => Array.isArray(x) && x[0] === 'callback' && x[2] === 1), true);
  eq('actual child has no renderer publication', f.ctx.renderer.windows[h], undefined);
  eq('D1 attached renderer finds production child', f.ex.find(100,0,0,0,0), h);
  eq('D1 native Edit child filter by atom', f.ex.find(100,0,0x81,0,0), h);
  eq('D1 native Edit child rejects Button filter', f.ex.find(100,0,0x80,0,0), 0);
  f.host.destroy_window(h);
  eq('retirement suppresses still-present native row', f.ex.find(100,0,0,0,0), 0);
  f.ctx.renderer = null;
  eq('separate no-renderer fallback respects retirement', f.ex.find(100,0,0,0,0), 0);
  f.ex.reset_lookup(f.rows.findIndex(r => r.hwnd === h));
  eq('separate no-renderer live fallback', f.ex.find(100,0,0,0,0), h);
}
{
  const f = fixture(); f.add(400,'Frame',0,false); f.add(401,'Local',400,false); f.add(402,'Rendered',400);
  f.row(401).z = 10000;
  eq('D1 unpublished parent valid', f.ex.find(400,0,0,0,0),401);
  eq('D1 unpublished after valid', f.ex.find(400,401,0,0,0),402);
  eq('D1 unrelated after rejected', f.ex.find(0,401,0,0,0),0);
  eq('D1 unknown parent rejected', f.ex.find(999,0,0,0,0),0);
  eq('D1 desktop alias', f.ex.find(0x10000,0,0,0,0),400);
}
for (const extended of [false,true]) {
  const f = fixture(), c = f.register('WideClass',1,extended);
  f.imports.wnd_table_set(200,0x401000); f.row(200).slot=c.slot;
  f.ctx.renderer.windows[200]={hwnd:200,className:'WideClass',title:'Title',zOrder:1,
    wasm:{exports:f.ctx.exports},wasmMemory:{buffer:f.ctx.getMemory()}};
  for (const w of [0,1]) eq(`D2 real RegisterClass${extended?'Ex':''}W atom query ${w}`,f.ex.find(0,0,c.atom,0,w),200);
  eq('D2 retained name pointer is original UTF16',f.dv.getUint32(4096+c.slot*48+44,true),c.p);
  f.register('WideClass',0);
  eq('D2 A replacement clears encoding',f.ex.find(0,0,c.atom,0,0),200);
  f.register('WideClass',1);
  eq('D2 W replacement restores encoding',f.ex.find(0,0,c.atom,0,0),200);
}
for (const encoding of [0,1]) {
  const f=fixture(), c=f.add(300,'AtomCreated',0,true,encoding);
  f.ctx.renderer.windows[300].className='';
  f.ex.publish(300,c.atom);
  eq(`D3 actual creation publication registered encoding=${encoding}`,f.ctx.renderer.windows[300].className,'AtomCreated');
  eq('D3 name query after atom publication',f.ex.find(0,0,f.put('AtomCreated'),0,0),300);
  eq('D3 atom query after atom publication',f.ex.find(0,0,c.atom,0,0),300);
}
for (const [i,name] of ['Button','Edit','Static','ListBox','ScrollBar','ComboBox'].entries()) {
  const f=fixture(); f.add(300,name); f.ex.publish(300,0x80+i);
  eq(`D3 builtin publication ${name}`,f.ctx.renderer.windows[300].className,name);
  eq(`D3 builtin lookup ${name}`,f.ex.find(0,0,0x80+i,0,0),300);
}
{
  const f=fixture(); f.add(500,'Gone'); f.host.destroy_window(500);
  eq('published retirement suppresses stale WND',f.ex.find(0,0,f.put('Gone'),0,0),0);
  f.ctx.renderer=null;
  eq('retirement persists without desktop',f.ex.find(0,0,f.put('Gone'),0,0),0);
}
{
  const f=fixture(); f.add(100,'Local');
  const foreign=fixture(); foreign.add(900,'Foreign'); const win=foreign.ctx.renderer.windows[900];
  f.ctx.renderer.windows[900]=win;
  eq('foreign host strings found without pointer transfer',f.ex.find(0,0,f.put('Foreign'),0,0),900);
  f.host.destroy_window(900);
  eq('foreign destroy retires owner memory',foreign.ex.wnd_lookup_live(900),0);
  eq('foreign destroy preserves caller lifetime',f.ex.wnd_lookup_live(100),1);
  f.ctx.renderer.windows[901]={hwnd:901,className:'HostOnly',title:'Title',zOrder:2,wasm:{exports:f.ctx.exports}};
  eq('renderer-only publication remains discoverable',f.ex.find(0,0,f.put('HostOnly'),0,0),901);
  delete f.ctx.renderer.windows[901].wasm;
  eq('unowned renderer-only publication remains discoverable',f.ex.find(0,0,f.put('HostOnly'),0,0),901);
}
for (const mutation of ['no-reconcile','no-retire','ansi-registration','atom-pointer']) {
  const f=fixture(mutation);
  reject(`reject mutation ${mutation}`,()=>{
    if(mutation==='no-reconcile'){ f.add(100,'Parent');const h=f.ex.child(100,2,7,0,0,80,20,0,0);assert.equal(f.ex.find(100,0,0,0,0),h); }
    if(mutation==='no-retire'){ f.add(500,'Gone');f.host.destroy_window(500);assert.equal(f.ex.find(0,0,f.put('Gone'),0,0),0); }
    if(mutation==='ansi-registration'){const c=f.add(200,'WideClass',0,true,1);assert.equal(f.ex.find(0,0,c.atom,0,0),200);}
    if(mutation==='atom-pointer'){const c=f.add(300,'AtomCreated');f.ex.publish(300,c.atom);assert.equal(f.ex.find(0,0,c.atom,0,0),300);}
  });
}
{
  const f=fixture(), c=f.add(100,'WideClass',0,false,1);
  eq('unpublished W registration atom and A title',f.ex.find(0,0,c.atom,f.put('Title'),0),100);
  eq('unpublished W registration atom and W title',f.ex.find(0,0,c.atom,f.put('Title',true),1),100);
  eq('unpublished W name filter',f.ex.find(0,0,f.put('WideClass',true),0,1),100);
  eq('unpublished title rejects mismatch',f.ex.find(0,0,c.atom,f.put('Wrong'),0),0);
  eq('unknown atom rejects',f.ex.find(0,0,0xefff,0,0),0);
  f.add(101,'Other');
  f.host.destroy_window(100);
  eq('retired after rejects attached',f.ex.find(0,100,0,0,0),0);
  f.ctx.renderer=null;
  eq('retired after rejects no renderer',f.ex.find(0,100,0,0,0),0);
  eq('desktop alias without renderer',f.ex.find(0x10000,0,0,0,0),101);
}
{
  const f=fixture(); f.add(100,'Parent'); f.add(101,'Child',100,false);
  f.host.destroy_window(100);
  eq('retired parent rejects attached',f.ex.find(100,0,0,0,0),0);
  f.ctx.renderer=null;
  eq('retired parent rejects no renderer',f.ex.find(100,0,0,0,0),0);
}
{
  const f=fixture(); f.add(100,'Parent'); f.add(101,'Pane',100,false);
  f.add(102,'Pane',100); f.add(103,'Grandchild',101,false);
  for (const wide of [0,1]) {
    eq(`case insensitive class/title ${wide}`,f.ex.find(100,0,f.put('pAnE',!!wide),f.put('tItLe',!!wide),wide),102);
    eq(`strict after continues ${wide}`,f.ex.find(100,102,f.put('Pane',!!wide),0,wide),101);
    eq(`direct child only ${wide}`,f.ex.find(100,0,f.put('Grandchild',!!wide),0,wide),0);
    eq(`title mismatch ${wide}`,f.ex.find(100,0,0,f.put('Missing',!!wide),wide),0);
  }
}
sourceModule('test/test-host-window-related.js');
eq('existing complete host relation regression',true,true);
sourceModule('tools/gen-host-import-sigs.js');
eq('existing import signatures unchanged and fresh',true,true);
sourceModule('tools/check-wat-logical-and.js');
eq('existing logical AND gate',true,true);
const fragmentGate=sourceModule('tools/check-wat-fragments.js');
for(const file of ['src/00-regions.wat','src/01-header.wat','src/09a-handlers1-user.wat',
  'src/09a5-handlers-window.wat','src/09a5c-handlers-wide.wat','src/09c0-window-table.wat'])
  eq('existing fragment gate '+file,fragmentGate.checkFragment(file).errors.length,0);
eq('generated region map fresh',sourceModule('tools/gen-region-map.js').render().text,read('lib/region-map.generated.js'));
const output={base,checks:results.length,results,modules,seals,
  limits:'Actual compiled lookup, native child construction, class hash/table registration, W/ExW registration adapters, class publication expression, WND table allocation/reset/removal and retirement. Controlled parallel tables, geometry, allocator/callback boundaries. No fullVM/game/WorkerRPC/IPC or runtime qualification.'};
if(process.argv[3] && !process.argv[3].startsWith('--')) {
  output.admission=gate(); fs.writeFileSync(process.argv[3],JSON.stringify(output,null,2)+'\n');
}
console.log(JSON.stringify({checks:results.length,modules:modules.length}));
