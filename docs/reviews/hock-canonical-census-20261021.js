'use strict';
// Bounded source-slice tests. No full build, browser, or game qualification.
// Run from the repository root with --process or --publication.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { parseSource, compile } = require('../../tools/watx');

if (process.argv.includes('--process')) {
  // The older process-only fixtures predate named-event fields. Supply the
  // constructor's empty containers; never rewrite a production method/oracle.
  const adapt = text => {
    const needle = 'const t=new T();';
    assert.equal(text.split(needle).length, 2);
    return text.replace(needle, needle +
      't._issuedAuthorityEvents=new Set();t._authorityEvents=new Map();');
  };
  let text = adapt(fs.readFileSync('docs/reviews/process-alias-boundary-fix-20261020.js', 'utf8'));
  const needle = "const old=blob('docs/re-notes/process-alias-correct-port-20261020.js');";
  assert(text.includes(needle));
  text = text.replace(needle, "const old=adapt(blob('docs/re-notes/process-alias-correct-port-20261020.js'));");
  new Function('require', 'adapt', text.replace(/^#![^\n]*\n/, ''))(require, adapt);
} else if (process.argv.includes('--publication')) {
  const forms = file => parseSource(fs.readFileSync(file, 'utf8'), file);
  const print = n => Array.isArray(n) ? '(' + n.slice(1).map(print).join(' ') + ')' : n;
  const table = forms('src/09c0-window-table.wat');
  const fn = name => { const n = table.find(n => n[1] === 'func' && n[2] === name); assert(n); return print(n); };
  const create = forms('src/09a5-handlers-window.wat').find(n => n[2] === '$handle_CreateWindowExA');
  const publications = [];
  function walk(n) { if (!Array.isArray(n)) return; if (n[1] === 'call' && n[2] === '$host_set_window_class') publications.push(n); n.slice(2).forEach(walk); }
  walk(create); assert.equal(publications.length, 1);
  // Compile the exact changed call plus both production conversion helpers.
  // Class registry and guest-address translation are explicit fixture imports.
  let call = print(publications[0]);
  if (process.argv.includes('--stale-pointer')) call = '(call $host_set_window_class (local.get $hwnd) (local.get $arg1))';
  const text = `
    (import "f" "memory" (memory 2))
    (import "f" "g2w" (func $g2w (param i32) (result i32)))
    (import "f" "find" (func $class_find_slot (param i32) (result i32)))
    (import "f" "record" (func $class_record_addr (param i32) (result i32)))
    (import "f" "wide" (func $class_name_is_wide (param i32) (result i32)))
    (import "f" "publish" (func $host_set_window_class (param i32 i32)))
    (global $TEXT_SCRATCH i32 (i32.const 8192))
    ${fn('$class_wide_name_key')} ${fn('$class_publication_name')}
    (func (export "publish") (param $hwnd i32) (param $arg1 i32) ${call})`;
  const result = compile(text, new Map(), {standardWat: true, runtimeBuiltins: false});
  assert(result.success, result.error);
  const memory = new WebAssembly.Memory({initial: 2});
  const bytes = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
  let wide = 0, live = true, generation = 1n;
  const owner = { wnd_lookup_generation: () => generation };
  const win = { wasm: {exports: owner}, memory: memory.buffer };
  const renderer = {windows: {17: win}, setWindowClass(hwnd, name) { this.windows[hwnd].className = name; }};
  const { createHostImports } = require('../../lib/host-imports');
  const host = createHostImports({getMemory: () => memory.buffer, renderer, exports: owner}).host;
  const x = new WebAssembly.Instance(new WebAssembly.Module(result.wasmBinary), {f: {
    memory, g2w: p => p - 65536, find: p => live && p === 0xc001 ? 0 : -1,
    record: () => 256, wide: () => wide, publish: host.set_window_class,
  }}).exports;
  bytes.set(Buffer.from('AnsiClass\0'), 1024); dv.setUint32(300, 65536 + 1024, true);
  x.publish(17, 0xc001); assert.equal(win.className, 'AnsiClass');
  x.publish(17, 65536 + 1024); assert.equal(win.className, 'AnsiClass');
  for (let atom = 0x80; atom <= 0x85; atom++) {
    x.publish(17, atom); assert.equal(win.className, ['Button','Edit','Static','ListBox','ScrollBar','ComboBox'][atom - 0x80]);
  }
  wide = 1; bytes.set(Buffer.from('WideClass\0', 'utf16le'), 2048); dv.setUint32(300, 65536 + 2048, true);
  x.publish(17, 0xc001); assert.equal(win.className, 'WideClass');
  bytes.fill(88, 8192, 8202); assert.equal(win.className, 'WideClass', 'host copies transient scratch synchronously');
  host.set_window_class(17, -2); assert.equal(win._lookupLifetime.invalid, true);
  generation++; x.publish(17, 0xc001); assert.equal(win._lookupLifetime.generation, 2n);
  assert(!win._lookupLifetime.invalid, 'new publication replaces retired lifetime');
  live = false; x.publish(17, 0xc001); assert.equal(win.className, '', 'missing atom does not publish stale name');
  console.log('PASS production class publication: ANSI/W atoms, six USER atoms, scratch copy, retirement/republication, missing atom');
} else throw new Error('Specify --process or --publication');
